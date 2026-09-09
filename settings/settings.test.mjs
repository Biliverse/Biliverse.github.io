import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("the landing page is site-owned and contains only configuration discovery", async () => {
  const html = await readFile(new URL("index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("home.js", import.meta.url), "utf8");
  assert.equal((html.match(/data-module=/g) ?? []).length, 4);
  assert.ok(html.includes("<h1>Biliverse</h1>"));
  assert.doesNotMatch(html, /assets\/app\.mjs|pp-fields|安装模块/);
  assert.doesNotMatch(script, /\/api\/|mount\(/);
  assert.match(script, /method: "HEAD"/);
  assert.match(script, /"X-PreferencePanes-JSON"/);
  assert.match(script, /"X-PreferencePanes-CSS"/);
  assert.match(script, /frame.srcdoc = html/);
  assert.match(script, /import \{ Navigation \} from "\/settings\/assets\/navigation.mjs"/);
  assert.doesNotMatch(script, /pushState|replaceState|\.animate\(|popstate|biliverseModule/);
  assert.deepEqual(await readFile(new URL("../docs/public/settings/index.html", import.meta.url)), Buffer.from(html));
});

test("the published module reads and writes independently without claiming the homepage or configs", async () => {
  const script = await readFile(new URL("../docs/public/settings/assets/Enhanced.request.js", import.meta.url), "utf8");
  const data = new Map([["BiliBili", JSON.stringify({ Global: { sentinel: true } })]]);
  const run = (method, pathname, value) => new Promise(resolve => vm.runInNewContext(script, {
    $environment: { "surge-version": "test" }, $script: { startTime: Date.now() / 1000 },
    $persistentStore: { read: key => data.get(key), write: (value, key) => { data.set(key, value); return true; } },
    $request: { url: `https://biliverse.github.io${pathname}`, method, headers: { "X-Settings-Client": "1", "Content-Type": "application/json" }, body: JSON.stringify(value) },
    $done: result => resolve(result.response), console: { log() {}, error() {} }, setTimeout, clearTimeout,
  }));
  for (const pathname of ["/settings/", "/settings/Global", "/configs/Enhanced"]) assert.equal(await run("GET", pathname), undefined);
  assert.match((await run("GET", "/settings/Enhanced")).body, /v=0\.7\.1/);
  assert.equal((await run("POST", "/api/Enhanced/Settings/Home/Top_left", "mine")).status, 200);
  assert.equal(JSON.parse((await run("GET", "/api/Enhanced/Settings/Home/Top_left")).body), "mine");
  assert.equal((await run("DELETE", "/api/Enhanced/")).status, 200);
  assert.deepEqual(JSON.parse(data.get("BiliBili")), { Global: { sentinel: true } });
});

test("independent proxy profiles claim only Enhanced module routes", async () => {
  for (const extension of ["sgmodule", "plugin", "snippet", "stoverride", "conf"]) {
    const text = await readFile(new URL(`PreferencePanes.${extension}`, import.meta.url), "utf8");
    assert.ok(text.includes("Enhanced.request.js?v=0.7.1"));
    const patterns = text.split("\n").flatMap(line => {
      if (line.includes("pattern=")) return [line.match(/pattern=([^,]+)/)[1]];
      if (line.includes("- match:")) return [line.trim().slice("- match: ".length)];
      if (line.startsWith("http-request ")) return [line.split(" ")[1]];
      return line.startsWith("^") ? [line.split(" ")[0]] : [];
    }).map(pattern => new RegExp(pattern));
    for (const pathname of ["/api/Enhanced/Settings/key", "/settings/Enhanced"])
      assert.ok(patterns.some(pattern => pattern.test(`https://biliverse.github.io${pathname}`)), extension);
    for (const pathname of ["/settings/", "/settings/Global", "/api/Global/", "/configs/Enhanced", "/settings/assets/Enhanced.request.js"])
      assert.ok(patterns.every(pattern => !pattern.test(`https://biliverse.github.io${pathname}`)), extension);
  }
});
