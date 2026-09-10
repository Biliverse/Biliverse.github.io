import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

test('the landing page is declarative and delegates behavior to PreferencePanes', async () => {
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/data-module=/g) ?? []).length, 4);
  for (const attribute of ['data-page=', 'data-json=', 'data-css=', 'data-module-status'])
    assert.equal((html.match(new RegExp(attribute, 'g')) ?? []).length, 4);
  assert.match(html, /s1\.hdslb\.com\/bfs\/seed\/jinkela\/short\/jsb\/js-bridge\.min\.js/);
  assert.match(html, /s1\.hdslb\.com\/bfs\/static\/2233-monorepo\/customer-service-h5\/static\/css/);
  assert.match(html, /src="\/settings\/assets\/host\.mjs"/);
  assert.doesNotMatch(html, /home\.js|bilibili\.mjs|navigation\.mjs|export-capabilities|navigation-error/);
});

test('website output contains only landing material and no PreferencePanes runtime', async () => {
  const assets = await readdir(new URL('../docs/public/settings/assets/', import.meta.url));
  for (const file of ['host.mjs', 'app.mjs', 'navigation.mjs', 'bilibili.mjs'])
    assert.equal(assets.includes(file), false);
  for (const file of ['home.js', 'home.css', 'bilibili.mjs'])
    await assert.rejects(access(new URL(`../docs/public/settings/${file}`, import.meta.url)), { code: 'ENOENT' });
  assert.deepEqual(
    await readFile(new URL('../docs/public/settings/index.html', import.meta.url)),
    await readFile(new URL('index.html', import.meta.url)),
  );
});

test('static mock serves only same-build HTML and image material', async () => {
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
  for (const pathname of ['/settings/assets/host.mjs', '/settings/Enhanced', '/configs/Enhanced', '/api/get']) {
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
