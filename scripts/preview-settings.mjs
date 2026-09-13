import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';

// 预览真实发布产物；Enhanced 提供唯一通用前后端，各模块只提供配置。
// Preview the real deployment artifacts with Enhanced owning the shared frontend/backend and modules owning only configs.
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
      $httpClient: {
        head: (options, callback) => relayConfig(options, 'HEAD', callback),
        get: (options, callback) => relayConfig(options, 'GET', callback),
      },
      console,
      setTimeout,
      clearTimeout,
    }),
  );

async function configResponse(resource) {
  const url = new URL(resource.url);
  const match = /^\/configs\/([a-zA-Z0-9_-]+)\/?$/.exec(url.pathname);
  if (!match) return { status: 404, headers: {}, body: '' };
  try {
    const script = await readFile(path.resolve(import.meta.dirname, '../..', match[1], 'dist/config.dev.bundle.js'), 'utf8');
    return (await execute(script, { url: url.href, method: resource.method, headers: resource.headers ?? {}, body: resource.body })) ?? { status: 404, headers: {}, body: '' };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { status: 404, headers: {}, body: '' };
  }
}

async function relayConfig(options, method, callback) {
  try {
    const result = await configResponse({ ...options, method });
    callback(null, { status: result.status, headers: result.headers }, result.body);
  } catch (error) {
    callback(error);
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
    const config = /^\/configs\/([a-zA-Z0-9_-]+)\/?$/.exec(url.pathname);
    const api = /^\/api\//.test(url.pathname);
    const web =
      /^\/settings\/([a-zA-Z0-9_-]+)\/?$/.test(url.pathname) ||
      ['/settings/assets/index.mjs', '/settings/assets/navigation.mjs'].includes(url.pathname);
    if (config || api || web) {
      let body = '';
      for await (const chunk of request) body += chunk;
      let result;
      if (config) result = await configResponse({ url: url.href, method: request.method, headers: request.headers, body });
      else {
        const file = path.resolve(import.meta.dirname, '../../..', `NSNanoCat/PreferencePanes/dist/${api ? 'api' : 'web'}.js`);
        const script = await readFile(file, 'utf8');
        result = await execute(script, { url: url.href, method: request.method, headers: request.headers, body });
      }
      reply.writeHead(result?.status ?? 404, result?.headers);
      reply.end(result?.body);
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
      // 本站资源始终来自当前检出，正式与预览环境都直接引用官方依赖。
      // Site resources always use the current checkout; both production and preview use official dependencies directly.
      const output = mime.startsWith('text/')
        ? body.toString().replaceAll('https://biliverse.github.io/settings/theme.css', '/settings/theme.css')
        : body;
      reply.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      reply.end(request.method === 'HEAD' ? undefined : output);
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
