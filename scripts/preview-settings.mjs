import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// 预览真实发布产物；代理只使用独立内存，不导入 Enhanced 业务代码。
// Preview the real deployment artifacts with isolated storage, without importing Enhanced business code.
const publicDir = path.resolve(import.meta.dirname, "../docs/public");
const store = new Map();
const scripts = {
  api: await readFile(path.join(publicDir, "settings/assets/Enhanced.request.js"), "utf8"),
  configs: await readFile(path.join(publicDir, "settings/assets/Enhanced.config.js"), "utf8"),
};
const server = http.createServer(async (request, reply) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === "/") { reply.writeHead(302, { Location: "/settings/" }); reply.end(); return; }
    const group = /^\/(api|configs)\/Enhanced(?:\/|$)/.exec(url.pathname)?.[1];
    if (group) {
      let body = "";
      for await (const chunk of request) body += chunk;
      const result = await new Promise(resolve => vm.runInNewContext(scripts[group], {
        $environment: { "surge-version": "preview" }, $script: { startTime: Date.now() / 1000 },
        $persistentStore: { read: key => store.get(key), write: (value, key) => { store.set(key, value); return true; } },
        $request: { url: url.href, method: request.method, headers: request.headers, body },
        $done: value => resolve(value.response), console, setTimeout, clearTimeout,
      }));
      reply.writeHead(result?.status ?? 404, result?.headers); reply.end(result?.body); return;
    }
    if (!url.pathname.startsWith("/settings/") || !["GET", "HEAD"].includes(request.method)) { reply.writeHead(404); reply.end(); return; }
    let target = path.join(publicDir, url.pathname.slice(1));
    if (!path.extname(target)) target = path.join(target, "index.html");
    try {
      const body = await readFile(target);
      const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png" }[path.extname(target)] ?? "text/plain";
      reply.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" }); reply.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
      reply.writeHead(404); reply.end();
    }
  } catch (error) { console.error(error); reply.writeHead(500); reply.end("Preview failed"); }
});
server.listen(Number(process.env.PORT ?? 0), "127.0.0.1", () => console.log(`Biliverse settings: http://127.0.0.1:${server.address().port}/settings/`));
