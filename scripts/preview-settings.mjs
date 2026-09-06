import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";

// Isolated preview store; never reads or writes the proxy application's settings.
const store = new Map();
globalThis.$environment = { "surge-version": "local-preview" };
globalThis.$persistentStore = { read: key => store.get(key) ?? null, write: (value, key) => { store.set(key, value); return true; } };
globalThis.$argument = {};
const requests = {};
const assets = new Map([["/settings/", "settings/index.html"], ["/settings/logo.png", "settings/logo.png"]]);
for (const mode of ["light", "dark"]) assets.set(`/settings/logo_settings_${mode}.png`, `settings/logo_settings_${mode}.png`);
for (const name of ["Enhanced", "Global", "Redirect", "ADBlock"]) {
  requests[name] = (await import(pathToFileURL(path.resolve(import.meta.dirname, "../..", name, "src/process/Request.mjs")))).Request;
  assets.set(`/settings/${name}/`, `settings/${name}/index.html`);
  assets.set(`/settings/assets/${name}.html`, `settings/assets/${name}.html`);
}
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "https://biliverse.github.io");
    if (url.pathname === "/") { response.writeHead(302, { Location: "/settings/" }); response.end(); return; }
    if (assets.has(url.pathname) && ["GET", "HEAD"].includes(request.method)) {
      const body = await readFile(path.resolve(import.meta.dirname, "../docs/public", assets.get(url.pathname)));
      response.writeHead(200, { "Content-Type": url.pathname.endsWith(".png") ? "image/png" : "text/html; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : body); return;
    }
    const name = url.pathname.match(/^\/settings\/api\/([^/]+)$/)?.[1];
    if (!requests[name]) { response.writeHead(404); response.end(); return; }
    let body = "";
    for await (const chunk of request) { body += chunk; if (body.length > 65536) { response.writeHead(413); response.end(); return; } }
    globalThis.$argument = { Storage: "Argument", LogLevel: "OFF" };
    const headers = { ...request.headers };
    if (headers.origin === `http://${request.headers.host}`) headers.origin = url.origin;
    const { $response } = await requests[name]({ url: url.toString(), method: request.method, headers, body });
    if (!$response) { response.writeHead(404); response.end(); return; }
    response.writeHead($response.status, $response.headers); response.end($response.body);
  } catch (error) { console.error(error); response.writeHead(500); response.end("Preview failed"); }
});
server.listen(Number(process.env.PORT || 8791), "127.0.0.1", () => console.log(`Settings preview: http://127.0.0.1:${server.address().port}/settings/`));
