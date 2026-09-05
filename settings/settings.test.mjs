import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "../..");
const store = new Map();
let writable = true;
globalThis.$environment = { "surge-version": "settings-test" };
globalThis.$persistentStore = { read: key => store.get(key) ?? null, write: (value, key) => { if (!writable) return false; store.set(key, value); return true; } };
globalThis.$argument = {};
const names = ["Enhanced", "Global", "Redirect", "ADBlock"];
const requests = {};
for (const name of names) requests[name] = (await import(pathToFileURL(path.join(root, name, "src/process/Request.mjs")))).Request;
function request(name, method = "GET", values, headers = {}) {
  return { url: `https://app.bilibili.com/biliverse/settings/api/${name}`, method, headers: { "X-Biliverse-Settings": "1", "Content-Type": "application/json", ...headers }, ...(values ? { body: JSON.stringify({ values }) } : {}) };
}

for (const name of names) test(`${name}: Enhanced owns settings API and saves module settings locally`, async () => {
  store.clear(); const Request = requests[name];
    globalThis.$argument = { Storage: "Argument", LogLevel: "ERROR" };
    let response = (await Request(request(name))).$response;
    assert.equal(response.status, 200);
    const data = JSON.parse(response.body);
    assert.equal(data.module, name);
    assert.equal(data.values.LogLevel, "ERROR");
    const { argsFull } = await import(pathToFileURL(path.join(root, name, "arguments-builder.full.config.ts")));
    assert.deepEqual(data.fields.map(field => field.key), [...argsFull.map(field => field.key), ...(argsFull.some(field => field.key === "Storage") ? [] : ["Storage"])]);
    response = (await Request(request(name, "POST", { ...data.values, LogLevel: "OFF", Storage: "PersistentStore" }))).$response;
    assert.equal(response.status, 200);
    globalThis.$argument = { Storage: "Argument", LogLevel: "ERROR" };
    response = (await Request(request(name))).$response;
    assert.equal(JSON.parse(response.body).values.LogLevel, "OFF");
    assert.equal(globalThis.$argument.Storage, "Argument", "request arguments must be restored after reading");
    response = (await Request(request(name, "POST", { Storage: "Argument" }))).$response;
    assert.equal(response.status, 200);
    response = (await Request(request(name))).$response;
    assert.equal(JSON.parse(response.body).values.LogLevel, "ERROR");
});

for (const name of names) test(`${name}: HEAD probe is read-only`, async () => {
  store.clear(); globalThis.$argument = {};
  const response = (await requests[name](request(name, "HEAD"))).$response;
  assert.equal(response.status, 200);
  assert.equal(response.body, "");
  assert.equal(store.size, 0);
});

test("reject unknown fields, invalid enum/types, duplicate choices and cross-origin writes without changing storage", async () => {
  store.clear(); globalThis.$argument = { LogLevel: "OFF" };
  const Request = requests.Enhanced;
  for (const values of [{ Unknown: true }, { "Home.Switch": "yes" }, { LogLevel: "SECRET" }, { "Home.Tab": ["recommend", "recommend"] }, JSON.parse('{"__proto__":{"polluted":true}}')]) {
    assert.equal((await Request(request("Enhanced", "POST", values))).$response.status, 400);
  }
  assert.equal((await Request(request("Enhanced", "POST", { LogLevel: "OFF" }, { Origin: "https://example.org" }))).$response.status, 403);
  const missing = request("Enhanced", "POST", { LogLevel: "OFF" }); delete missing.headers["X-Biliverse-Settings"];
  assert.equal((await Request(missing)).$response.status, 403);
  assert.equal(store.size, 0);
  assert.equal({}.polluted, undefined);
  writable = false;
  assert.equal((await Request(request("Enhanced", "POST", { LogLevel: "OFF" }))).$response.status, 500);
  writable = true;
});

test("empty arrays replace prior selections and unrelated modules/caches survive saves", async () => {
  store.clear(); globalThis.$argument = { LogLevel: "OFF" };
  const Request = requests.Enhanced;
  store.set("BiliBili", JSON.stringify({ Global: { Settings: { Locales: ["HKG"] } }, Enhanced: { Caches: { sentinel: 42 } } }));
  assert.equal((await Request(request("Enhanced", "POST", { "Home.Top": [], Storage: "PersistentStore" }))).$response.status, 200);
  assert.deepEqual(JSON.parse((await Request(request("Enhanced"))).$response.body).values["Home.Top"], []);
  const saved = JSON.parse(store.get("BiliBili"));
  assert.deepEqual(saved.Global.Settings.Locales, ["HKG"]);
  assert.equal(saved.Enhanced.Caches.sentinel, 42);
  const tab = (await Request({ url: "https://app.bilibili.com/x/resource/show/tab/v2", method: "GET", headers: {} })).$response;
  assert.deepEqual(JSON.parse(tab.body).data.top, [], "real plugin consumer uses the saved empty selection");
});

test("local HTML is fully embedded; settings API refuses other hosts", async () => {
  const { settingsResponse } = await import(pathToFileURL(path.join(root, "Enhanced/src/function/settings.mjs")));
  const response = settingsResponse({ url: "https://app.bilibili.com/biliverse/settings/", method: "GET" }, {});
  assert.equal(response.status, 200);
  assert.match(response.headers["Content-Type"], /text\/html/);
  assert.match(response.body, /data:image\/png;base64/);
  assert.doesNotMatch(response.body, /(?:src|href)="https?:/);
  assert.equal(settingsResponse({ url: "https://evil.example/biliverse/settings/api/Enhanced", method: "GET" }, {}), undefined);
});

test("phone/iPad entry follows official settings exactly once, including when Mine customization is disabled", async () => {
  store.clear();
  const { addSettingsEntry } = await import(pathToFileURL(path.join(root, "Enhanced/src/function/settingsEntry.mjs")));
  for (const ipad of [false, true]) {
    const items = [{ id: 1, uri: "bilibili://user_center/setting", title: "设置" }, { id: 2, title: "后续项" }];
    const data = ipad ? { ipad_more_sections: items } : { sections_v2: [{ items }] };
    addSettingsEntry(data, ipad); addSettingsEntry(data, ipad);
    assert.equal(items.length, 3); assert.equal(items[1].title, "Biliverse 设置"); assert.equal(items[2].id, 2);
  }
  globalThis.$argument = { Mine: { Switch: false }, LogLevel: "OFF" };
  const { Response } = await import(pathToFileURL(path.join(root, "Enhanced/src/process/Response.mjs")));
  const upstream = { code: 0, data: { sections_v2: [{ items: [{ uri: "bilibili://user_center/setting", title: "设置" }] }] } };
  const result = await Response({ url: "https://app.bilibili.com/x/v2/account/mine" }, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(upstream) });
  assert.equal(JSON.parse(result.body).data.sections_v2[0].items.find(item => item.uri === "https://app.bilibili.com/biliverse/settings/").title, "Biliverse 设置");
});
