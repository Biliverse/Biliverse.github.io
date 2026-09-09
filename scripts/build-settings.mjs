import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");
const stamp = process.argv.includes("--stamp");
// 网站只部署包内公共前端，不读取或构建业务模块配置。
// Deploy only the package's common frontend, without reading or building module configuration.
const outputs = new Map([["settings/assets/navigation.mjs", await readFile(new URL(import.meta.resolve("@nsnanocat/preference-panes/navigation")))]]);
for (const name of ["index.html", "home.js", "home.css", "theme.css", "bilibili.mjs"])
  outputs.set(`settings/${name}`, await readFile(path.join(root, "settings", name)));
for (const record of JSON.parse(await readFile(path.join(root, "settings/icons-manifest.json"), "utf8")))
  for (const source of record.outputs) outputs.set(`settings/assets/${path.basename(source)}`, await readFile(path.join(root, source)));
// 发布产物记录本次构建时间和提交号；源文件与本地预览不伪装成已发布版本。
// Stamp publication output with build time and revision; source and local previews remain explicitly unpublished.
if (stamp) {
  const builtAt = new Date();
  const revision = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const label = `构建于 <time datetime="${builtAt.toISOString()}">${builtAt.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" })} UTC+8</time> · ${revision}`;
  outputs.set("settings/index.html", outputs.get("settings/index.html").toString().replace("本地预览（未构建）", label));
}
for (const [name, body] of outputs) {
  const target = path.join(root, stamp ? "doc_build" : "docs/public", name);
  if (check) {
    if (!(await readFile(target)).equals(Buffer.from(body))) throw new Error(`Stale settings asset: ${name}`);
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
}
console.log(JSON.stringify({ outputs: outputs.size, check }));
