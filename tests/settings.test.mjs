import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import createBridge from '../settings/bridge.mjs';

async function fixture({ supported = true, common = true, sdkFailure = false, useNative } = {}) {
  const channels = new Map();
  const removed = [];
  const calls = [];
  const urls = [];
  const properties = new Map();
  const root = {
    dataset: {},
    classList: { toggle() {}, remove() {} },
    style: { setProperty: (k, v) => properties.set(k, v), removeProperty: (k) => properties.delete(k) },
  };
  let sdk;
  const bridge = {
    initPromise: Promise.resolve(),
    isWbTypeCommon: common,
    isSupport: async () => supported,
    useNative: (method, data) => {
      calls.push({ method, data });
      return useNative?.(method, data) ?? Promise.resolve({ code: 0 });
    },
    callNative: (request) => calls.push(request),
    addChannel: (name, callback) => channels.set(name, callback),
    removeChannel: (name, callback) => {
      assert.equal(channels.get(name), callback);
      removed.push(name);
      channels.delete(name);
    },
  };
  const descriptors = new Map();
  for (const [name, value] of Object.entries({
    document: {
      title: 'Biliverse',
      documentElement: root,
      createElement: () => {
        sdk = {
          remove() {
            this.removed = true;
          },
        };
        return sdk;
      },
      head: { append: () => queueMicrotask(() => (sdkFailure ? sdk.onerror() : sdk.onload())) },
      body: { append() {} },
    },
    window: { biliBridge: bridge, location: { assign: (url) => urls.push(url) } },
    navigator: { userAgent: 'themeId/2' },
  })) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  const menu = {
    element: {},
    opened: 0,
    open() {
      this.opened++;
    },
  };
  const restore = () => {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
  try {
    return {
      host: await createBridge({ menu, back() {} }),
      channels,
      removed,
      calls,
      urls,
      root,
      properties,
      menu,
      sdk,
      restore,
    };
  } catch (error) {
    restore();
    throw error;
  }
}

test('native host owns confirmation, MORE, theme and keyboard; destroy detaches original callbacks', async () => {
  const f = await fixture();
  try {
    await f.host.update({ title: 'Enhanced', actions: [{ id: 'reset' }], busy: false });
    f.channels.get('ui.observeNavigationClick')({ code: 0, data: { id: 'biliverse.more' } });
    assert.equal(f.menu.opened, 1);
    assert.equal(f.root.dataset.theme, 'dark');
    f.channels.get('ui.observeThemeChange')({ code: 0 });
    assert.equal(f.root.dataset.theme, 'dark');
    f.channels.get('ui.observeThemeChange')({ code: 0, data: { theme: 1 } });
    assert.equal(f.root.dataset.theme, 'light');
    f.channels.get('ui.observeKeyboardStatus')({ code: 0, data: { status: true, height: 320 } });
    assert.equal(f.properties.get('--pp-keyboard-height'), '320px');
    const accepted = f.host.confirm('重置？');
    f.calls.at(-1).onConfirm();
    assert.equal(await accepted, true);
    const cancelled = f.host.confirm('清空？');
    f.calls.at(-1).onCancel();
    assert.equal(await cancelled, false);
    const pending = f.host.confirm('退出');
    const late = f.calls.at(-1);
    f.host.destroy();
    assert.equal(await pending, false);
    late.onConfirm();
    assert.equal(f.channels.size, 0);
    assert.equal(f.removed.length, 3);
    assert.equal(f.properties.size, 0);
    assert.equal(f.sdk.removed, true);
  } finally {
    f.restore();
  }
});

test('obsolete native title responses cannot publish buttons after a newer state or departure', async () => {
  const titles = [];
  const f = await fixture({
    useNative: (method) => (method === 'ui.setTitle' ? new Promise((resolve) => titles.push(resolve)) : undefined),
  });
  try {
    const old = f.host.update({ title: '旧', actions: [{ id: 'reset' }], busy: false });
    const next = f.host.update({ title: '新', actions: [], busy: true });
    titles[0]();
    await old;
    assert.equal(f.calls.filter((call) => call.method === 'ui.setNavigationButton').length, 0);
    f.host.destroy();
    titles[1]();
    await next;
    assert.equal(f.calls.filter((call) => call.method === 'ui.setNavigationButton').length, 0);
  } finally {
    f.restore();
  }
});

test('URL capability fallback remains top-level and late native failures do not navigate after exit', async () => {
  for (const supported of [false, true]) {
    const f = await fixture({ supported });
    try {
      f.host.openURL('bilibili://main/regionv2');
      if (supported) f.calls.at(-1).callback({ code: 103 });
      assert.deepEqual(f.urls, ['bilibili://main/regionv2']);
      if (supported) {
        f.host.openURL('https://example.com');
        const late = f.calls.at(-1);
        f.host.destroy();
        late.callback({ code: 103 });
        assert.equal(f.urls.length, 1);
      } else f.host.destroy();
    } finally {
      f.restore();
    }
  }
});

test('explicit new-page requests reject unsupported or failed native calls without replacing settings', async () => {
  for (const supported of [false, true]) {
    const f = await fixture({ supported });
    try {
      if (supported) {
        const failed = f.host.openURL('https://github.com/Biliverse', '_blank');
        f.calls.at(-1).callback({ code: 103 });
        await assert.rejects(failed, /新页面失败/);
        assert.deepEqual(f.urls, []);
        const opened = f.host.openURL('https://github.com/Biliverse', '_blank');
        f.calls.at(-1).callback({ code: 0 });
        await opened;
        assert.deepEqual(f.urls, []);
        const pending = f.host.openURL('https://github.com/Biliverse', '_blank');
        const late = f.calls.at(-1);
        f.host.destroy();
        late.callback({ code: 103 });
        await pending;
        assert.deepEqual(f.urls, []);
      } else {
        assert.throws(() => f.host.openURL('https://github.com/Biliverse', '_blank'), /不支持/);
        assert.deepEqual(f.urls, []);
        f.host.openURL('https://example.com', '_self');
        assert.deepEqual(f.urls, ['https://example.com']);
        f.host.destroy();
      }
    } finally {
      f.restore();
    }
  }
});

test('SDK or Common WebView initialization failures reject instead of starting a browser host', async () => {
  await assert.rejects(fixture({ sdkFailure: true }), /SDK 加载失败/);
  await assert.rejects(fixture({ common: false }), /common WebView/);
});

test('both deployment channels copy the framework unchanged and package only provided content', async () => {
  const templateSource = process.env.PREFERENCE_PANES_HOME ?? 'https://github.com/NSNanoCat/PreferencePanes/releases/latest/download/home.html';
  let template;
  if (templateSource.startsWith('https://')) {
    const response = await fetch(templateSource);
    assert.ok(response.ok, `PreferencePanes homepage template: HTTP ${response.status}`);
    template = Buffer.from(await response.arrayBuffer());
  } else template = await readFile(templateSource);
  const source = JSON.parse(await readFile(new URL('../settings/home.json', import.meta.url), 'utf8'));
  const optional = [];
  for (const name of ['theme.css', 'bridge.mjs']) {
    try {
      await readFile(new URL(`../settings/${name}`, import.meta.url));
      optional.push(name);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const images = [...new Set([source.logo, ...source.sections.flatMap(section => section.items.map(item => item.icon.src))].filter(Boolean))];
  for (const directory of process.env.SETTINGS_TEST_DIRS?.split(',') ?? ['docs/public', 'doc_build']) {
    const base = new URL(`../${directory}/settings/`, import.meta.url);
    assert.deepEqual(await readFile(new URL('index.html', base)), template);
    const generated = JSON.parse(await readFile(new URL('home.json', base), 'utf8'));
    const { footer, ...content } = generated;
    const { footer: originalFooter, ...originalContent } = source;
    assert.deepEqual(content, originalContent);
    assert.deepEqual(footer.slice(0, -1), originalFooter ?? []);
    assert.match(footer.at(-1), directory === 'doc_build' ? /^构建于 .* UTC\+8 · [a-f\d]{7,}$/ : /^本地预览（未构建）$/);
    assert.deepEqual((await readdir(base)).sort(), ['assets', 'home.json', 'index.html', ...optional].sort());
    assert.deepEqual((await readdir(new URL('assets/', base))).sort(), images.map(image => image.slice('assets/'.length)).sort());
    for (const name of [...optional, ...images])
      assert.deepEqual(await readFile(new URL(name, base)), await readFile(new URL(`../settings/${name}`, import.meta.url)));
  }
});
