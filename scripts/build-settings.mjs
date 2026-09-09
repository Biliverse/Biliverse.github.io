import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { build } from "@nsnanocat/preference-panes";

const root = path.resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");
const boxjs = JSON.parse(await readFile(path.resolve(root, "../Enhanced/template/boxjs.settings.json"), "utf8"));
const outputs = new Map(Object.entries(await build(boxjs)));
// 首页和安装文件由本站维护，PreferencePanes 只生成 Enhanced 模块页。
// This site owns the landing page and installation files; PreferencePanes builds only the Enhanced page.
for (const name of ["index.html", "home.js", "home.css", ...["sgmodule", "plugin", "snippet", "stoverride", "conf"].map(extension => `PreferencePanes.${extension}`)])
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
console.log(JSON.stringify({ module: "Enhanced", outputs: outputs.size, check }));
