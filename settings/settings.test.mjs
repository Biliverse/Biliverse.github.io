import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir, mkdtemp, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { inBilibili, closeBilibili } from "./bilibili.mjs";

test("app exit uses the official close protocol and never fabricates browser history", async () => {
  const calls = [];
  const browser = { navigator: { userAgent: "Mozilla/5.0" } };
  assert.equal(inBilibili(browser), false);
  const app = { ...browser, biliBridge: { inBiliApp: true, useNative: async method => calls.push(method) } };
  assert.equal(inBilibili(app), true);
  await closeBilibili(app);
  const native = { ...browser, webkit: { messageHandlers: { biliInjectV2: { postMessage: text => calls.push(JSON.parse(text)) } } } };
  await closeBilibili(native);
  assert.equal(calls[0], "global.closeBrowser");
  assert.deepEqual(calls[1], { method: "global.closeBrowser", data: {}, callbackId: 0 });
  await assert.rejects(closeBilibili(browser), /App/);
});

test("preview uses the common PreferencePanes API and module-owned config artifacts", { timeout: 15000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "biliverse-preview-"));
  let child;
  try {
    const site = path.join(root, "Biliverse/site");
    const artifacts = path.join(root, "Biliverse/Example/dist");
    const common = path.join(root, "NSNanoCat/PreferencePanes/dist");
    await mkdir(path.join(site, "scripts"), { recursive: true });
    await mkdir(path.join(site, "docs/public/settings/Example"), { recursive: true });
    await mkdir(artifacts, { recursive: true });
    await mkdir(common, { recursive: true });
    await copyFile(new URL("../scripts/preview-settings.mjs", import.meta.url), path.join(site, "scripts/preview-settings.mjs"));
    await writeFile(path.join(site, "docs/public/settings/Example/index.html"), "<main>static module page</main>");
    await writeFile(path.join(artifacts, "config.dev.bundle.js"), '$done({response:{status:200,body:"example-config"}});');
    await writeFile(path.join(common, "api.js"), '$done({response:{status:200,body:$request.method+" "+$request.url}});');
    child = spawn(process.execPath, [path.join(site, "scripts/preview-settings.mjs")], { env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "inherit"] });
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
    assert.equal(await (await fetch(`${base}/settings/Example`)).text(), `GET ${base}/settings/Example`);
    assert.equal(await (await fetch(`${base}/configs/Example`)).text(), "example-config");
    assert.equal((await fetch(`${base}/configs/Example`, { method: "HEAD" })).status, 200);
    const api = `${base}/api/get`;
    assert.equal(await (await fetch(api)).text(), `GET ${api}`);
    await writeFile(path.join(artifacts, "config.dev.bundle.js"), '$done({response:{status:200,body:"rebuilt-config"}});');
    assert.equal(await (await fetch(`${base}/configs/Example`)).text(), "rebuilt-config");
    for (const pathname of ["/configs/Missing", "/settings/assets/Example.boxjs.json"])
      assert.equal((await fetch(base + pathname)).status, 404);
  } finally {
    if (child && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("website deploys only generic frontend assets and owns the custom landing page", async () => {
  const html = await readFile(new URL("index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("home.js", import.meta.url), "utf8");
  const build = await readFile(new URL("../scripts/build-settings.mjs", import.meta.url), "utf8");
  const assets = await readdir(new URL("../docs/public/settings/assets/", import.meta.url));
  assert.equal((html.match(/data-module=/g) ?? []).length, 4);
  assert.ok(html.includes("<h1>Biliverse</h1>"));
  assert.doesNotMatch(script, /\/api\/|mount\(|srcdoc|DOMParser|\.replace\(|pushState|\.animate\(/);
  assert.match(script, /method: "HEAD"/);
  assert.match(script, /ModuleFrame/);
  assert.doesNotMatch(build, /boxjs|\.\.\/Enhanced|build\(boxjs/);
  assert.ok(assets.every(name => !/\.boxjs\.json$|\.(config|request)\.js$/.test(name)));
  assert.ok(!assets.includes("app.mjs") && !assets.includes("Enhanced.html"));
  assert.deepEqual(await readFile(new URL("../docs/public/settings/index.html", import.meta.url)), Buffer.from(html));
});
