import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile, readdir, mkdtemp, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import vm from "node:vm";
import { inBilibili, NativeNavigation, observeAppearance, confirmBilibili, toastBilibili, exportCapabilities } from "./bilibili.mjs";

test("native Toast uses the client title payload and does not wait for a nonexistent callback", async () => {
  let call;
  const host = { biliBridge: { initPromise: Promise.resolve(), isSupport: async name => name === "biliapp.showToast", callNative: request => { call = request; } } };
  await toastBilibili("修改成功", host);
  assert.deepEqual(call, { method: "biliapp.showToast", data: { title: "修改成功" } });
  host.biliBridge.isSupport = async () => false;
  await assert.rejects(toastBilibili("失败", host), /不支持/);
});

test("capability export contains method lists without user or storage data", async () => {
  let copied;
  const host = { biliBridge: {
    jsbVersion: "3.3.5", initPromise: Promise.resolve(), isSupport: async () => true, isBiliInjectV2: () => true,
    useNative: async () => ({ data: { methods: ["ui.setNavigationButton"] } }),
    callNative: options => {
      if (options.method === "global.getAllSupport") options.callback(["global.closeBrowser"]);
      else { copied = JSON.parse(options.data.content); options.callback({ code: 0 }); }
    },
  } };
  await exportCapabilities(host);
  assert.deepEqual(copied, { sdk: "3.3.5", v1: ["global.closeBrowser"], v2: { methods: ["ui.setNavigationButton"] } });
});

test("native confirmations use validated button fields and wait for a user decision", async () => {
  let call;
  const host = { biliBridge: { initPromise: Promise.resolve(), isSupport: async () => true, callNative: value => { call = value; } } };
  const pending = confirmBilibili("Clear?", host);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(call.data, { type: "confirm", title: "Biliverse", message: "Clear?", confirmButton: "确定", cancelButton: "取消" });
  call.callback("ok");
  call.onCancel();
  assert.equal(await pending, false);
  const confirmed = confirmBilibili("Reset?", host);
  await new Promise(resolve => setImmediate(resolve));
  call.onConfirm();
  assert.equal(await confirmed, true);
});

test("official appearance callbacks drive live theme and keyboard changes", async () => {
  const subscriptions = new Map(), themes = [], heights = [];
  const host = { navigator: { userAgent: "BiliApp" }, biliBridge: {
    initPromise: Promise.resolve(), isSupport: async () => true,
    callNative: options => subscriptions.set(options.method, options),
  } };
  await observeAppearance({ theme: value => themes.push(value), keyboard: height => heights.push(height) }, host);
  const theme = subscriptions.get("ui.observeThemeChange");
  assert.equal(theme.data.immediately, true);
  theme.onChangeTheme({ theme: 2, night: 1 });
  theme.onChangeTheme({ theme: 1, night: 0 });
  assert.deepEqual(themes, [{ theme: 2, night: 1 }, { theme: 1, night: 0 }]);
  const keyboard = subscriptions.get("ui.observeKeyboardStatus");
  keyboard.onShow({ height: 320 });
  keyboard.onChangeHeight({ height: 280 });
  keyboard.onHide();
  assert.deepEqual(heights, [320, 280, 0]);
  await observeAppearance({ theme() { assert.fail(); }, keyboard() { assert.fail(); } }, { navigator: { userAgent: "Mozilla" } });
});

test("website mocks return same-build resources without requests or storage access", async () => {
  const source = await readFile(new URL("../docs/public/settings/mock.js", import.meta.url), "utf8");
  const png = await readFile(new URL("icons/Enhanced_subject_dark.png", import.meta.url));
  for (const qx of [false, true]) {
    for (const method of ["GET", "HEAD"]) {
      const result = await new Promise(resolve => vm.runInNewContext(source, {
        $request: { url: "https://app.bilibili.com/settings/assets/Enhanced_subject_dark.png?v=1", method },
        $environment: { "stash-version": "test" }, $script: { startTime: Date.now() },
        ...(qx ? { $task: { fetch: () => assert.fail("No outbound requests") } } : {}),
        $done: resolve, console: { log() {}, error() {} }, ArrayBuffer, Uint8Array,
      }));
      const response = qx ? result : result.response;
      assert.equal(response.headers["Content-Type"], "image/png");
      assert.equal(response.status, qx ? "HTTP/1.1 200 OK" : 200);
      if (method === "GET") assert.deepEqual(Buffer.from(qx ? response.bodyBytes : response.body), png);
      else assert.equal(response.body, "");
    }
  }
  for (const url of ["https://app.bilibili.com/x/v2/account/mine", "https://app.bilibili.com/settings/Enhanced", "https://app.bilibili.com/configs/Enhanced", "https://app.bilibili.com/api/get", "https://app.bilibili.com/settings/home.css", "https://app.bilibili.com/settings/theme.css"]) {
    const result = await new Promise(resolve => vm.runInNewContext(source, {
      $request: { url, method: "GET" }, $task: {}, $done: resolve, console: { log() {}, error() {} },
    }));
    assert.equal(result.status, "HTTP/1.1 404 Not Found");
  }
});

test("native navigation uses official titles and built-in more menus; only active actions dispatch", async () => {
  const calls = [], selected = [], errors = [];
  let listener, removed;
  const bridge = {
    inBiliApp: true, initPromise: Promise.resolve(), canIUse: async () => true,
    callNative: request => calls.push(request),
    useNative: async (method, data) => calls.push({ method, data }),
    addChannel: (name, callback) => { assert.equal(name, "ui.observeNavigationClick"); listener = callback; },
    removeChannel: (name, callback) => { removed = [name, callback]; },
  };
  assert.equal(inBilibili({ biliBridge: bridge }), true);
  assert.equal(inBilibili({ navigator: { userAgent: "Mozilla" } }), false);
  const navigation = new NativeNavigation(id => selected.push(id), error => errors.push(error), { biliBridge: bridge });
  const actions = [{ id: "viewCaches", label: "查看缓存" }, { id: "reset", label: "重置模块" }];
  await navigation.update({ title: "Enhanced", actions, busy: false });
  assert.equal(calls[0].method, "ui.showNavigation");
  assert.deepEqual(calls.at(-2), { method: "ui.setTitle", data: { title: "Enhanced" } });
  assert.deepEqual(calls.at(-1), { method: "ui.setNavigationButton", data: { buttons: [{
    id: "biliverse.more", type: 3, menu: { content: [{ id: "viewCaches", text: "查看缓存" }, { id: "reset", text: "重置模块" }] }, visible: true,
  }] } });
  listener({ code: 0 });
  listener({ code: 0, data: { id: "unknown" } });
  listener({ code: 0, data: { id: "viewCaches" } });
  const saving = navigation.update({ title: "Enhanced", actions, busy: true });
  listener({ code: 0, data: { id: "reset" } });
  await saving;
  assert.deepEqual(calls.at(-1).data, { buttons: [] });
  await navigation.update({ title: "Biliverse", actions: [], busy: false });
  listener({ code: 0, data: { id: "reset" } });
  listener({ code: 103, message: "channel unavailable" });
  assert.equal(errors[0].message, "channel unavailable");
  navigation.destroy();
  assert.deepEqual(removed, ["ui.observeNavigationClick", listener]);
  assert.deepEqual(selected, ["viewCaches"]);
});

test("native updates are serialized and superseded states are discarded", async () => {
  const calls = [];
  let complete;
  const bridge = {
    initPromise: Promise.resolve(), canIUse: async () => true,
    callNative() {}, addChannel() {}, removeChannel() {},
    useNative: (method, data) => { calls.push(data); return new Promise(resolve => { complete = resolve; }); },
  };
  const navigation = new NativeNavigation(() => {}, assert.fail, { biliBridge: bridge });
  const first = navigation.update({ title: "Module", actions: [{ id: "reset", label: "Reset" }], busy: false });
  await new Promise(resolve => setImmediate(resolve));
  const second = navigation.update({ title: "Outdated", actions: [{ id: "viewCaches", label: "View" }], busy: false });
  const last = navigation.update({ title: "Biliverse", actions: [], busy: false });
  assert.equal(calls.length, 1);
  complete();
  await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], { buttons: [] });
  complete();
  await Promise.all([second, last]);
  navigation.destroy();
  await navigation.update({ title: "late", actions: [], busy: false });
  assert.equal(calls.length, 2);
});

test("unsupported native menus surface failure without constructing a web navigation fallback", async () => {
  const bridge = { initPromise: Promise.resolve(), canIUse: async () => false, callNative() {}, addChannel: assert.fail };
  const navigation = new NativeNavigation(assert.fail, assert.fail, { biliBridge: bridge });
  await assert.rejects(navigation.update({ title: "Biliverse", actions: [], busy: false }), /不支持原生导航菜单/);
  navigation.destroy();
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
  assert.match(html, /class="brand-logo"/);
  for (const file of ["home.css", "theme.css"]) assert.ok(html.includes(`href="https://biliverse.github.io/settings/${file}?`));
  assert.ok(script.includes('"X-PreferencePanes-CSS": "https://biliverse.github.io/settings/theme.css?'));
  assert.doesNotMatch(html + script, /app-navbar|homeBack|ActionMenu|IntersectionObserver|closeBilibili/);
  assert.doesNotMatch(script, /\/api\/|mount\(|srcdoc|DOMParser|\.replace\(|pushState|\.animate\(/);
  assert.match(script, /new ModuleStatus/);
  assert.match(script, /ModuleFrame/);
  assert.doesNotMatch(build, /boxjs|\.\.\/Enhanced|build\(boxjs/);
  assert.ok(assets.every(name => !/\.boxjs\.json$|\.(config|request)\.js$/.test(name)));
  assert.ok(!assets.includes("app.mjs") && !assets.includes("Enhanced.html"));
  assert.deepEqual(await readFile(new URL("../docs/public/settings/index.html", import.meta.url)), Buffer.from(html));
  for (const file of ["official", "official-styles.zip"]) await assert.rejects(access(new URL(`../docs/public/settings/${file}`, import.meta.url)), { code: "ENOENT" });
  assert.ok(html.includes("https://s1.hdslb.com/bfs/seed/jinkela/short/b-style/theme.min.css"));
  const mock = await readFile(new URL("../docs/public/settings/mock.js", import.meta.url), "utf8");
  assert.doesNotMatch(mock, /@bilibili\/b-style|--Ga0:|official-styles\.zip|settings\/official\//);
});
