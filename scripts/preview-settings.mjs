import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';

// 预览真实发布产物；Enhanced 映射静态页面资源并提供固定存储 API，各模块直接提供自己的 BoxJS API。
// Preview the real deployment artifacts with Enhanced mapping static page resources and providing the fixed storage API while modules expose their BoxJS APIs directly.
const publicDir = path.resolve(import.meta.dirname, '../docs/public');
const store = new Map();

const execute = (script, request) =>
  new Promise((resolve) =>
    vm.runInNewContext(script, {
      $environment: { 'surge-version': 'preview' },
      $script: { startTime: Date.now() / 1000 },
      $persistentStore: {
        read: (key) => store.get(key),
        write: (value, key) => {
          store.set(key, value);
          return true;
        },
      },
      $request: request,
      $done: (value) => resolve(value.response),
      console,
    }),
  );

async function configResponse(resource) {
  const url = new URL(resource.url);
  const match = /^\/api\/([a-zA-Z0-9_-]+)$/.exec(url.pathname);
  if (['get', 'set', 'delete'].includes(match?.[1])) return { status: 404, headers: {}, body: '' };
  if (!match) return { status: 404, headers: {}, body: '' };
  try {
    const script = await readFile(
      path.resolve(import.meta.dirname, '../..', match[1], 'dist/config.dev.bundle.js'),
      'utf8',
    );
    return (
      (await execute(script, {
        url: url.href,
        method: resource.method,
        headers: resource.headers ?? {},
        body: resource.body,
      })) ?? { status: 404, headers: {}, body: '' }
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { status: 404, headers: {}, body: '' };
  }
}

const server = http.createServer(async (request, reply) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/') {
      reply.writeHead(302, { Location: '/settings/' });
      reply.end();
      return;
    }
    const config = /^\/api\/([a-zA-Z0-9_-]+)$/.exec(url.pathname) && !/^\/api\/(?:get|set|delete)$/.test(url.pathname);
    const api = /^\/api\/(?:get|set|delete)$/.test(url.pathname);
    const page = /^\/settings\/([a-zA-Z0-9_-]+)\/?$/.test(url.pathname);
    const asset = {
      '/settings/assets/index.mjs': 'index.mjs',
      '/settings/assets/navigation.mjs': 'navigation.mjs',
    }[url.pathname];
    if (config || api) {
      let body = '';
      for await (const chunk of request) body += chunk;
      let result;
      if (config)
        result = await configResponse({ url: url.href, method: request.method, headers: request.headers, body });
      else {
        const file = path.resolve(import.meta.dirname, '../../../NSNanoCat/PreferencePanes/dist/api.js');
        const script = await readFile(file, 'utf8');
        result = await execute(script, { url: url.href, method: request.method, headers: request.headers, body });
      }
      reply.writeHead(result?.status ?? 404, result?.headers);
      reply.end(result?.body);
      return;
    }
    if (page || asset) {
      const file = path.resolve(
        import.meta.dirname,
        '../../../NSNanoCat/PreferencePanes/dist/module',
        asset ?? 'index.html',
      );
      const body = await readFile(file);
      reply.writeHead(200, {
        'Content-Type': asset ? 'text/javascript' : 'text/html',
        'Cache-Control': 'no-store',
      });
      reply.end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    if (!url.pathname.startsWith('/settings/') || !['GET', 'HEAD'].includes(request.method)) {
      reply.writeHead(404);
      reply.end();
      return;
    }
    let target = path.join(publicDir, url.pathname.slice(1));
    if (!path.extname(target)) target = path.join(target, 'index.html');
    try {
      const body = await readFile(target);
      const mime =
        {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'text/javascript',
          '.mjs': 'text/javascript',
          '.json': 'application/json',
          '.png': 'image/png',
        }[path.extname(target)] ?? 'text/plain';
      reply.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      reply.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
      reply.writeHead(404);
      reply.end();
    }
  } catch (error) {
    console.error(error);
    reply.writeHead(500);
    reply.end('Preview failed');
  }
});
server.listen(Number(process.env.PORT ?? 0), '127.0.0.1', () =>
  console.log(`Biliverse settings: http://127.0.0.1:${server.address().port}/settings/`),
);
