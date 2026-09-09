import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");
// 网站只部署包内公共前端，不读取或构建业务模块配置。
// Deploy only the package's common frontend, without reading or building module configuration.
const resources = new URL("../dist/module/", import.meta.resolve("@nsnanocat/preference-panes"));
const html = await readFile(new URL("index.html", resources), "utf8");
const outputs = new Map([
  ["settings/Enhanced/index.html", html],
  ["settings/assets/Enhanced.html", html],
  ["settings/assets/Enhanced.css", await readFile(path.join(root, "settings/theme.css"))],
]);
for (const name of ["app.mjs", "navigation.mjs"]) outputs.set(`settings/assets/${name}`, await readFile(new URL(name, resources)));
for (const name of ["index.html", "home.js", "home.css", "theme.css", ...["sgmodule", "plugin", "snippet", "stoverride", "conf"].map(extension => `PreferencePanes.${extension}`)])
  outputs.set(`settings/${name}`, await readFile(path.join(root, "settings", name)));
for (const [name, body] of outputs) {
  const target = path.join(root, "docs/public", name);
  if (check) {
    if (!(await readFile(target)).equals(Buffer.from(body))) throw new Error(`Stale settings asset: ${name}`);
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
}
console.log(JSON.stringify({ outputs: outputs.size, check }));
