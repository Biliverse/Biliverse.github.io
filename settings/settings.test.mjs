import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir, mkdtemp, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("preview serves static pages and reads configuration only from sibling module build artifacts", { timeout: 15000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "biliverse-preview-"));
  let child;
  try {
    const site = path.join(root, "site");
    const artifacts = path.join(root, "Example/dist");
    await mkdir(path.join(site, "scripts"), { recursive: true });
    await mkdir(path.join(site, "docs/public/settings/Example"), { recursive: true });
    await mkdir(artifacts, { recursive: true });
    await copyFile(new URL("../scripts/preview-settings.mjs", import.meta.url), path.join(site, "scripts/preview-settings.mjs"));
    await writeFile(path.join(site, "docs/public/settings/Example/index.html"), "<main>static module page</main>");
    await writeFile(path.join(artifacts, "config.dev.bundle.js"), '$done({response:{status:200,body:"example-config"}});');
    await writeFile(path.join(artifacts, "settings.dev.bundle.js"), '$done({response:{status:200,body:$request.method+" "+$request.url}});');
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
    assert.equal(await (await fetch(`${base}/settings/Example`)).text(), "<main>static module page</main>");
    assert.equal(await (await fetch(`${base}/configs/Example`)).text(), "example-config");
    assert.equal((await fetch(`${base}/configs/Example`, { method: "HEAD" })).status, 200);
    const api = `${base}/api/Example/Settings/key`;
    assert.equal(await (await fetch(api)).text(), `GET ${api}`);
    await writeFile(path.join(artifacts, "config.dev.bundle.js"), '$done({response:{status:200,body:"rebuilt-config"}});');
    assert.equal(await (await fetch(`${base}/configs/Example`)).text(), "rebuilt-config");
    for (const pathname of ["/configs/Missing", "/api/Missing/key", "/settings/assets/Example.boxjs.json"])
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
  const app = await readFile(new URL("../docs/public/settings/assets/app.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(app, /Home\.Top_left|请选择启用的首页标签页/);
  assert.deepEqual(await readFile(new URL("../docs/public/settings/index.html", import.meta.url)), Buffer.from(html));
});

test("independent proxy profiles use the module-owned Gist without claiming configuration routes", async () => {
  for (const extension of ["sgmodule", "plugin", "snippet", "stoverride", "conf"]) {
    const text = await readFile(new URL(`PreferencePanes.${extension}`, import.meta.url), "utf8");
    assert.ok(text.includes("https://gist.githubusercontent.com/VirgilClyne/97d7611df1c0b29a254ce8f527137576/raw/settings.dev.bundle.js"));
    assert.doesNotMatch(text, /script-path=https:\/\/biliverse|url: https:\/\/biliverse.*assets/);
    const patterns = text.split("\n").flatMap(line => {
      if (line.includes("pattern=")) return [line.match(/pattern=([^,]+)/)[1]];
      if (line.includes("- match:")) return [line.trim().slice("- match: ".length)];
      if (line.startsWith("http-request ")) return [line.split(" ")[1]];
      return line.startsWith("^") ? [line.split(" ")[0]] : [];
    }).map(pattern => new RegExp(pattern));
    for (const pathname of ["/api/Enhanced/Settings/key", "/settings/Enhanced"])
      assert.ok(patterns.some(pattern => pattern.test(`https://biliverse.github.io${pathname}`)), extension);
    for (const pathname of ["/settings/", "/settings/Global", "/api/Global/", "/configs/Enhanced"])
      assert.ok(patterns.every(pattern => !pattern.test(`https://biliverse.github.io${pathname}`)), extension);
  }
});
