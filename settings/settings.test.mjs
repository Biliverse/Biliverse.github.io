import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdtemp, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import vm from "node:vm";

test("preview serves current module context after rebuilding without restarting", { timeout: 15000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "biliverse-preview-"));
  let child;
  try {
    await mkdir(path.join(root, "scripts"));
    await mkdir(path.join(root, "docs/public/settings/assets"), { recursive: true });
    await copyFile(new URL("../scripts/preview-settings.mjs", import.meta.url), path.join(root, "scripts/preview-settings.mjs"));
    const script = await readFile(new URL("../docs/public/settings/assets/Enhanced.request.js", import.meta.url), "utf8");
    const target = path.join(root, "docs/public/settings/assets/Enhanced.request.js");
    await writeFile(target, script);
    child = spawn(process.execPath, [path.join(root, "scripts/preview-settings.mjs")], { env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "inherit"] });
    const base = await new Promise((resolve, reject) => {
      let output = "";
      child.stdout.on("data", chunk => {
        output += chunk;
        const match = /http:\/\/127\.0\.0\.1:\d+/.exec(output);
        if (match) resolve(match[0]);
      });
      child.once("error", reject);
      child.once("exit", code => reject(new Error(`Preview exited: ${code}`)));
    });
    const url = `${base}/settings/Enhanced`;
    const response = await fetch(url, { headers: { "X-PreferencePanes-JSON": "/configs/Enhanced", "X-PreferencePanes-CSS": "/settings/theme.css" } });
    assert.equal(response.status, 200);
    const html = await response.text();
    const context = JSON.parse(decodeURIComponent(html.match(/name="preference-panes-inputs" content="([^"]+)"/)[1]));
    assert.deepEqual(context, { url, module: "Enhanced", json: "/configs/Enhanced", css: "/settings/theme.css" });
    assert.match(html, /app.mjs\?v=0\.7\.2/);
    // 模拟重建后覆盖脚本，服务必须立即返回新产物而非进程内旧副本。
    // Simulate replacing a rebuilt script; serve it immediately instead of the old in-process copy.
    await writeFile(target, '$done({response:{status:200,headers:{"Content-Type":"text/html"},body:"rebuilt-page"}});');
    assert.equal(await (await fetch(url)).text(), "rebuilt-page");
    // 使用另一个模块名验证三类路由，不依赖 Enhanced 特例。
    // Verify all three route families using another module, without an Enhanced special case.
    const assets = path.join(root, "docs/public/settings/assets");
    await writeFile(path.join(assets, "Example.request.js"), '$done({response:{status:200,body:$request.method+" "+$request.url}});');
    await writeFile(path.join(assets, "Example.config.js"), '$done({response:{status:200,body:"example-config"}});');
    for (const pathname of ["/settings/Example", "/settings/Example/", "/api/Example/Settings/key"]) {
      assert.equal(await (await fetch(`${base}${pathname}`)).text(), `GET ${base}${pathname}`);
    }
    assert.equal(await (await fetch(`${base}/configs/Example`)).text(), "example-config");
    assert.equal((await fetch(`${base}/configs/Example`, { method: "HEAD" })).status, 200);
    for (const pathname of ["/settings/Missing", "/configs/Missing", "/api/Missing/key"]) assert.equal((await fetch(`${base}${pathname}`)).status, 404);
    await writeFile(path.join(assets, "example.css"), "body {}");
    assert.equal(await (await fetch(`${base}/settings/assets/example.css`)).text(), "body {}");
  } finally {
    if (child && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    await rm(root, { recursive: true, force: true });
  }
});

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
  assert.match(html, /id="app-navbar"/);
  assert.doesNotMatch(script, /srcdoc|DOMParser|\.replace\(|pp-header/);
  assert.match(script, /import \{ Navigation, ModuleFrame \} from "\/settings\/assets\/navigation.mjs\?v=0\.7\.2"/);
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
  assert.match((await run("GET", "/settings/Enhanced")).body, /v=0\.7\.2/);
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
