import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFile, readdir } from "node:fs/promises";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "../..");
const store = new Map();
let writable = true;
globalThis.$environment = { "surge-version": "settings-test" };
globalThis.$persistentStore = { read: key => store.get(key) ?? null, write: (value, key) => { if (!writable) return false; store.set(key, value); return true; } };
globalThis.$argument = {};
// Migrated modules execute the site-hosted script; legacy modules still use their business entry.
const names = ["Global", "Redirect", "ADBlock"];
test("site-hosted Enhanced script works without Enhanced code or arguments", async () => {
  const script = await readFile(new URL("../docs/public/settings/assets/Enhanced.request.js", import.meta.url), "utf8");
  const data = new Map([["BiliBili", JSON.stringify({ Global: { sentinel: true } })]]);
  let downloads = 0;
  const run = (method, pathname, value) => new Promise(resolve => vm.runInNewContext(script, {
    $environment: { "surge-version": "test" }, $script: { startTime: Date.now() / 1000 },
    $persistentStore: { read: key => data.get(key), write: (value, key) => { data.set(key, value); return true; } },
    $httpClient: { get: (_request, done) => { downloads++; done(null, { status: 200, headers: {} }, "[]"); } },
    $request: { url: `https://biliverse.github.io${pathname}`, method, headers: { "X-Settings-Client": "1", "Content-Type": "application/json" }, body: JSON.stringify(value) },
    $done: result => resolve(result.response), console: { log() {}, error() {} }, setTimeout, clearTimeout,
  }));
  assert.equal((await run("HEAD", "/configs/Enhanced")).status, 200);
  assert.equal(downloads, 1);
  assert.equal((await run("POST", "/api/Enhanced/Settings/Home/Top_left", "mine")).status, 200);
  assert.equal(JSON.parse((await run("GET", "/api/Enhanced/Settings/Home/Top_left")).body), "mine");
  assert.equal((await run("DELETE", "/api/Enhanced/")).status, 200);
  assert.deepEqual(JSON.parse(data.get("BiliBili")), { Global: { sentinel: true } });
  assert.equal(downloads, 1, "API operations never download configuration");
});
const requests = {};
for (const name of names) requests[name] = (await import(pathToFileURL(path.join(root, name, "src/process/Request.mjs")))).Request;
function request(name, method = "GET", values, headers = {}) {
  return { url: `https://biliverse.github.io/settings/api/${name}`, method, headers: { "X-Biliverse-Settings": "1", "Content-Type": "application/json", ...headers }, ...(values ? { body: JSON.stringify({ values }) } : {}) };
}

for (const name of names) test(`${name}: owns its settings API and saves module settings locally`, async () => {
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

test("static pages and assets bypass every API script, including other modules", async () => {
  for (const name of names) {
    const { settingsResponse } = await import(pathToFileURL(path.join(root, name, "src/function/settings.mjs")));
    for (const pathname of ["/settings/", `/settings/${name}/`, `/settings/assets/${name}.html`, "/settings/logo.png", ...names.filter(n => n !== name).map(n => `/settings/api/${n}`)]) {
      assert.equal(settingsResponse({ url: `https://biliverse.github.io${pathname}`, method: "GET" }, {}), undefined);
    }
    assert.equal(settingsResponse({ url: `https://evil.example/settings/api/${name}`, method: "GET" }, {}), undefined);
    assert.equal(settingsResponse({ url: `https://app.bilibili.com/settings/api/${name}`, method: "GET" }, {}), undefined);
    const script = await readFile(path.join(root, name, "src/function/settings.mjs"), "utf8");
    assert.doesNotMatch(script, /<!doctype|data:image|const page =/i);
  }
});

test("native Mock targets resolve to Pages files and cannot intercept their own downloads or APIs", async () => {
  const publicDir = path.join(root, "Biliverse.github.io/docs/public");
  for (const name of names) {
    const asset = await readFile(path.join(publicDir, `settings/assets/${name}.html`), "utf8");
    assert.ok(asset.includes('<link rel="stylesheet" href="https://s1.hdslb.com/bfs/static/2233-monorepo/customer-service-h5/static/css/index.545c1c91.css">'));
    assert.equal(asset, await readFile(path.join(publicDir, `settings/${name}/index.html`), "utf8"));
    assert.match(asset, /data:image\/png;base64/);
    const dir = path.join(root, name, "template");
    for (const filename of ["surge.handlebars", "surge.dev.handlebars", "loon.handlebars", "loon.dev.handlebars"]) {
      const template = await readFile(path.join(dir, filename), "utf8");
      const line = template.split("\n").find(line => line.includes(`settings/assets/${name}.html`));
      assert.ok(line, `${name}/${filename}: missing remote static Mock`);
      assert.match(line, filename.startsWith("surge") ? /data-type=file/ : /mock-response-body data-type=html/);
      const matcher = new RegExp(line.split(" ")[0]);
      assert.ok(matcher.test(`https://biliverse.github.io/settings/${name}/`));
      assert.ok(matcher.test(`https://biliverse.github.io/settings/${name}/?v=1`));
      for (const other of ["", `assets/${name}.html`, `api/${name}`, "logo.png", ...names.filter(n => n !== name).map(n => `${n}/`)]) {
        assert.equal(matcher.test(`https://biliverse.github.io/settings/${other}`), false);
      }
    }
    for (const filename of (await readdir(dir)).filter(file => file.endsWith(".handlebars") && !file.includes("rewrite"))) {
      const template = await readFile(path.join(dir, filename), "utf8");
      if (!template.includes("settings\\/api\\/")) continue;
      assert.doesNotMatch(template, /hostname = biliverse.github.io, %APPEND%/);
      for (const line of template.split("\n").filter(line => line.includes("settings\\/api\\/"))) {
        assert.doesNotMatch(line, /v\{\{@package,/);
        if (line.includes("script-path=")) assert.match(line, /\/request(?:\.dev)?\.bundle\.js,/);
      }
    }
  }
  assert.deepEqual(await readFile(path.join(publicDir, "settings/logo.png")), await readFile(path.join(root, "Biliverse.github.io/settings/logo.png")));
  for (const mode of ["light", "dark"]) {
    assert.deepEqual(await readFile(path.join(publicDir, `settings/logo_settings_${mode}.png`)), await readFile(path.join(root, `Biliverse.github.io/settings/logo_settings_${mode}.png`)));
  }
});

test("phone/iPad recommended services contain the entry exactly once, including when Mine customization is disabled", async () => {
  store.clear();
  const { addSettingsEntry } = await import(pathToFileURL(path.join(root, "Enhanced/src/function/settingsEntry.mjs")));
  for (const ipad of [false, true]) {
    const items = [{ id: 1, uri: "bilibili://user_center/setting", title: "设置" }, { id: 2, title: "后续项" }];
    const data = ipad ? { ipad_more_sections: items } : { sections_v2: [{ items }] };
    addSettingsEntry(data, ipad); addSettingsEntry(data, ipad);
    const recommended = ipad ? data.ipad_recommend_sections : data.sections_v2.find(section => section.title === "推荐服务").items;
    assert.equal(items.length, 2); assert.equal(recommended.length, 1); assert.equal(recommended[0].title, "Biliverse");
    assert.equal(recommended[0].icon, "https://biliverse.github.io/settings/logo_settings_light.png");
  }
  globalThis.$argument = { Mine: { Switch: false }, LogLevel: "OFF" };
  const { Response } = await import(pathToFileURL(path.join(root, "Enhanced/src/process/Response.mjs")));
  const upstream = { code: 0, data: { sections_v2: [{ items: [{ uri: "bilibili://user_center/setting", title: "设置" }] }] } };
  const result = await Response({ url: "https://app.bilibili.com/x/v2/account/mine" }, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(upstream) });
  assert.equal(JSON.parse(result.body).data.sections_v2.find(section => section.title === "推荐服务").items[0].title, "Biliverse");
});
