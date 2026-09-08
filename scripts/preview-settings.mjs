import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Isolated preview store; never reads or writes the proxy application's settings.
const store = new Map();
globalThis.$environment = { "surge-version": "local-preview" };
globalThis.$persistentStore = { read: key => store.get(key) ?? null, write: (value, key) => { store.set(key, value); return true; } };
globalThis.$argument = {};
globalThis.$httpClient = { get: async (request, done) => {
  try {
    if (request.url !== "https://biliverse.github.io/settings/assets/Enhanced.boxjs.json") throw new Error("Unexpected preview resource");
    done(null, { status: 200, headers: { "Content-Type": "application/json" } }, await readFile(path.resolve(import.meta.dirname, "../docs/public/settings/assets/Enhanced.boxjs.json"), "utf8"));
  } catch (error) { done(error); }
} };
const requests = {};
const proxyScripts = new Map(await Promise.all(JSON.parse(await readFile(new URL("../settings/proxies.json", import.meta.url), "utf8")).map(async ({ module }) => [module, await readFile(new URL(`../docs/public/settings/assets/${module}.request.js`, import.meta.url), "utf8")])));
const assets = new Map([["/settings/", "settings/index.html"], ["/settings/logo.png", "settings/logo.png"]]);
assets.set("/settings/Enhanced", "settings/Enhanced/index.html");
for (const name of ["index.html", "app.mjs", "panel.css", "home.css", "site.boxjs.json", "Enhanced.boxjs.json"]) assets.set(`/settings/assets/${name}`, `settings/assets/${name}`);
for (const mode of ["light", "dark"]) assets.set(`/settings/logo_settings_${mode}.png`, `settings/logo_settings_${mode}.png`);
for (const name of ["Enhanced", "Global", "Redirect", "ADBlock"]) {
  for (const mode of ["light", "dark"]) assets.set(`/settings/assets/${name}_${mode}.png`, `settings/assets/${name}_${mode}.png`);
  if (!proxyScripts.has(name)) requests[name] = (await import(pathToFileURL(path.resolve(import.meta.dirname, "../..", name, "src/process/Request.mjs")))).Request;
  assets.set(`/settings/${name}/`, `settings/${name}/index.html`);
  assets.set(`/settings/assets/${name}.html`, `settings/assets/${name}.html`);
}
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "https://biliverse.github.io");
    if (url.pathname === "/") { response.writeHead(302, { Location: "/settings/" }); response.end(); return; }
    if (assets.has(url.pathname) && ["GET", "HEAD"].includes(request.method)) {
      const body = await readFile(path.resolve(import.meta.dirname, "../docs/public", assets.get(url.pathname)));
      const type = { ".png": "image/png", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" }[path.extname(url.pathname)] ?? "text/html";
      response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
      response.end(request.method === "HEAD" ? undefined : body); return;
    }
    const name = /^\/(?:api\/Enhanced(?:\/|$)|configs\/Enhanced$)/.test(url.pathname) ? "Enhanced" : url.pathname.match(/^\/settings\/api\/([^/]+)$/)?.[1];
    if (!requests[name] && !proxyScripts.has(name)) { response.writeHead(404); response.end(); return; }
    let body = "";
    for await (const chunk of request) { body += chunk; if (body.length > 65536) { response.writeHead(413); response.end(); return; } }
    globalThis.$argument = { Storage: "Argument", LogLevel: "OFF" };
    const headers = { ...request.headers };
    if (headers.origin === `http://${request.headers.host}`) headers.origin = url.origin;
    const input = { url: url.toString(), method: request.method, headers, body };
    const $response = proxyScripts.has(name) ? await new Promise(resolve => vm.runInNewContext(proxyScripts.get(name), {
      $request: input, $environment: globalThis.$environment, $persistentStore: globalThis.$persistentStore, $httpClient: globalThis.$httpClient,
      $script: { startTime: Date.now() / 1000 }, $done: result => resolve(result.response), console, setTimeout, clearTimeout,
    })) : (await requests[name](input)).$response;
    if (!$response) { response.writeHead(404); response.end(); return; }
    response.writeHead($response.status, $response.headers); response.end($response.body);
  } catch (error) { console.error(error); response.writeHead(500); response.end("Preview failed"); }
});
server.listen(Number(process.env.PORT || 8791), "127.0.0.1", () => console.log(`Settings preview: http://127.0.0.1:${server.address().port}/settings/`));
