import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

async function runOpenURLAdapter(supported, failure) {
  const source = (await readFile(new URL('index.mjs', import.meta.url), 'utf8')).replace(
    /^import .*?;$/m,
    'const { ActionMenu, ModuleFrame, ModuleStatus, Navigation } = globalThis.__settingsNavigation;',
  );
  const frames = [];
  const nativeCalls = [];
  const assigned = [];
  class ModuleFrame extends EventTarget {
    constructor(url, options) {
      super();
      this.element = {};
      this.state = { title: 'Enhanced', actions: [], busy: false };
      this.url = url;
      this.options = options;
      frames.push(this);
    }
    load() {
      return Promise.resolve();
    }
  }
  class Navigation extends EventTarget {
    constructor(_container, _home, create) {
      super();
      this.current = 'Enhanced';
      create('Enhanced', new AbortController().signal);
    }
    destroy() {}
  }
  class ModuleStatus extends EventTarget {
    state = { status: 'installed' };
    check() {}
    destroy() {}
  }
  class ActionMenu {
    update() {}
    open() {}
    destroy() {}
  }
  const button = {
    dataset: { module: 'Enhanced' },
    disabled: false,
    querySelector: () => ({}),
    addEventListener() {},
  };
  const home = { querySelectorAll: () => [button] };
  const page = {
    querySelector: () => ({ hidden: false, textContent: '' }),
    append() {},
  };
  const root = {
    dataset: {},
    classList: { toggle() {} },
    style: { setProperty() {} },
  };
  const bridge = {
    initPromise: Promise.resolve(),
    isWbTypeCommon: true,
    isSupport: async (method) => {
      assert.equal(method, 'ability.openScheme');
      return supported;
    },
    addChannel() {},
    useNative: async () => ({ code: 0 }),
    callNative: (request) => nativeCalls.push(request),
  };
  const descriptors = new Map();
  for (const [name, value] of Object.entries({
    __settingsNavigation: { ActionMenu, ModuleFrame, ModuleStatus, Navigation },
    document: {
      documentElement: root,
      title: 'Biliverse',
      querySelector: (selector) => {
        if (selector === '[data-preference-panes-home]') return home;
        if (selector === 'template[data-preference-panes-module]')
          return { content: { firstElementChild: { cloneNode: () => page } } };
        return {};
      },
    },
    navigator: { userAgent: '' },
    window: {
      biliBridge: bridge,
      location: { assign: (url) => assigned.push(url) },
      addEventListener() {},
    },
  })) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  try {
    await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Math.random()}`);
    const url = 'bilibili://main/top_category';
    const accepted = frames[0].dispatchEvent(new CustomEvent('open-url', { cancelable: true, detail: { url } }));
    if (failure) nativeCalls[0].callback(failure);
    return { accepted, assigned, frame: frames[0], nativeCalls, url };
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test('the landing page loads the official SDK and one project-owned page script', async () => {
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/data-module=/g) ?? []).length, 4);
  assert.equal((html.match(/data-module-status/g) ?? []).length, 4);
  assert.doesNotMatch(html, /data-(?:page|json|css)=/);
  assert.match(html, /s1\.hdslb\.com\/bfs\/seed\/jinkela\/short\/jsb\/js-bridge\.min\.js/);
  assert.match(html, /s1\.hdslb\.com\/bfs\/static\/2233-monorepo\/customer-service-h5\/static\/css/);
  assert.match(html, /src="\/settings\/index\.mjs"/);
  assert.doesNotMatch(html, /src="\/settings\/assets\/host\.mjs"/);
  assert.doesNotMatch(html, /home\.js|bilibili\.mjs|navigation\.mjs|export-capabilities|navigation-error/);
});

test('website output contains its page script and no PreferencePanes runtime', async () => {
  const assets = await readdir(new URL('../docs/public/settings/assets/', import.meta.url));
  for (const file of ['host.mjs', 'index.mjs', 'navigation.mjs', 'bilibili.mjs'])
    assert.equal(assets.includes(file), false);
  for (const file of ['home.js', 'home.css', 'bilibili.mjs'])
    await assert.rejects(access(new URL(`../docs/public/settings/${file}`, import.meta.url)), { code: 'ENOENT' });
  assert.deepEqual(
    await readFile(new URL('../docs/public/settings/index.html', import.meta.url)),
    await readFile(new URL('index.html', import.meta.url)),
  );
  const page = await readFile(new URL('../docs/public/settings/index.mjs', import.meta.url), 'utf8');
  assert.match(page, /window\.biliBridge/);
  assert.match(page, /ui\.observeThemeChange/);
  assert.match(page, /new ActionMenu/);
  assert.match(page, /result\.data\?\.id === ['"]biliverse\.more['"]\) menu\.open\(\)/);
  assert.doesNotMatch(page, /menu: \{ content:/);
  assert.match(page, /ui\.observeNavigationClick/);
  assert.doesNotMatch(page, /liveUI\.selectPanel/);
  assert.match(page, /from ['"]\/settings\/assets\/navigation\.mjs['"]/);
  assert.match(page, /status\.check\(`\/api\/\$\{encodeURIComponent\(button\.dataset\.module\)\}`\)/);
  assert.match(page, /const moduleName = encodeURIComponent\(button\.dataset\.module\)/);
  assert.match(page, /new ModuleFrame\(`\/settings\/\$\{moduleName\}`/);
  assert.match(page, /await bridge\.isSupport\('ability\.openScheme'\)/);
  assert.match(page, /frame\.addEventListener\('open-url'/);
  assert.match(page, /https:\/\/biliverse\.github\.io\/settings\/theme\.css\?v=0\.9\.10/);
  assert.match(page, /['"]X-PreferencePanes-JSON['"]: `\/api\/\$\{moduleName\}`/);
  assert.match(page, /['"]X-PreferencePanes-CSS['"]: moduleStylesheet/);
  assert.doesNotMatch(page, /dataset\.(?:page|json|css)/);
  assert.doesNotMatch(page, /BilibiliHost|host\.mjs/);
});

test('Bilibili URL adapter only owns supported navigation and falls back after native failure', async () => {
  const unsupported = await runOpenURLAdapter(false);
  assert.equal(unsupported.accepted, true);
  assert.equal(unsupported.frame.url, '/settings/Enhanced');
  assert.deepEqual(unsupported.frame.options.headers, {
    'X-PreferencePanes-JSON': '/api/Enhanced',
    'X-PreferencePanes-CSS': 'https://biliverse.github.io/settings/theme.css?v=0.9.10',
  });
  assert.deepEqual(unsupported.nativeCalls, []);
  assert.deepEqual(unsupported.assigned, []);

  const supported = await runOpenURLAdapter(true, { code: 103 });
  assert.equal(supported.accepted, false);
  assert.equal(supported.nativeCalls.length, 1);
  assert.equal(supported.nativeCalls[0].method, 'ability.openScheme');
  assert.deepEqual(supported.nativeCalls[0].data, { url: supported.url });
  assert.deepEqual(supported.assigned, [supported.url]);
});

test('local preview routes module BoxJS APIs separately from the fixed storage API and web artifact', async () => {
  const source = await readFile(new URL('../scripts/preview-settings.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes("const match = /^\\/api\\/([a-zA-Z0-9_-]+)$/.exec(url.pathname);"));
  assert.ok(source.includes("const api = /^\\/api\\/(?:get|set|delete)$/.test(url.pathname);"));
  assert.ok(source.includes('const web ='));
  assert.ok(source.includes("${api ? 'api' : 'web'}.js"));
  assert.doesNotMatch(source, /\$httpClient|relayConfig|\/configs\//);
});
