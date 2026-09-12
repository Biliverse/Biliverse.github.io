import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

test('the landing page loads the official SDK and one project-owned page script', async () => {
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/data-module=/g) ?? []).length, 4);
  for (const attribute of ['data-page=', 'data-json=', 'data-css=', 'data-module-status'])
    assert.equal((html.match(new RegExp(attribute, 'g')) ?? []).length, 4);
  assert.match(html, /s1\.hdslb\.com\/bfs\/seed\/jinkela\/short\/jsb\/js-bridge\.min\.js/);
  assert.match(html, /s1\.hdslb\.com\/bfs\/static\/2233-monorepo\/customer-service-h5\/static\/css/);
  assert.match(html, /src="\/settings\/index\.mjs"/);
  assert.doesNotMatch(html, /src="\/settings\/assets\/host\.mjs"/);
  assert.doesNotMatch(html, /home\.js|bilibili\.mjs|navigation\.mjs|export-capabilities|navigation-error/);
});

test('website output contains its page script and no PreferencePanes runtime', async () => {
  const assets = await readdir(new URL('../docs/public/settings/assets/', import.meta.url));
  for (const file of ['host.mjs', 'app.mjs', 'navigation.mjs', 'bilibili.mjs'])
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
  assert.match(page, /status\.check\(`\/api\/\$\{encodeURIComponent\(button\.dataset\.module\)\}`/);
  assert.doesNotMatch(page, /status\.check\(button\.dataset\.json\)/);
  assert.doesNotMatch(page, /BilibiliHost|host\.mjs/);
});

test('static mock serves only same-build project page resources', async () => {
  const source = await readFile(new URL('../docs/public/settings/mock.js', import.meta.url), 'utf8');
  const png = await readFile(new URL('icons/Enhanced_subject.png', import.meta.url));
  const result = await new Promise((resolve) =>
    vm.runInNewContext(source, {
      $request: { url: 'https://app.bilibili.com/settings/assets/Enhanced_subject.png', method: 'GET' },
      $task: {},
      $done: resolve,
      console: { log() {}, error() {} },
      ArrayBuffer,
      Uint8Array,
    }),
  );
  assert.deepEqual(Buffer.from(result.bodyBytes), png);
  const script = await new Promise((resolve) =>
    vm.runInNewContext(source, {
      $request: { url: 'https://app.bilibili.com/settings/index.mjs', method: 'GET' },
      $task: {},
      $done: resolve,
      console: { log() {}, error() {} },
      ArrayBuffer,
      Uint8Array,
    }),
  );
  assert.match(script.body, /window\.biliBridge/);
  for (const pathname of [
    '/settings/assets/host.mjs',
    '/settings/assets/navigation.mjs',
    '/settings/Enhanced',
    '/configs/Enhanced',
    '/api/get',
  ]) {
    const missing = await new Promise((resolve) =>
      vm.runInNewContext(source, {
        $request: { url: `https://app.bilibili.com${pathname}`, method: 'GET' },
        $task: {},
        $done: resolve,
        console: { log() {}, error() {} },
        ArrayBuffer,
        Uint8Array,
      }),
    );
    assert.equal(missing.status, 'HTTP/1.1 404 Not Found');
  }
});
