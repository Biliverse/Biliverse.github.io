import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { rollup } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";

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
// 不支持远程文件 Mock 的代理直接返回同次构建的静态资源，包含 PNG 原始字节。
// Proxies without remote file mocks return same-build static resources, including original PNG bytes.
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png" };
const assets = Object.fromEntries([...outputs].map(([name, body]) => [name === "settings/index.html" ? "/settings/" : `/${name}`, [types[path.extname(name)], name.endsWith(".png") ? [...body] : body.toString()]]));
const bundle = await rollup({ input: path.join(root, "settings/mock.mjs"), plugins: [nodeResolve(), {
  name: "website-assets",
  resolveId(id) { if (id === "#website-assets") return id; },
  load(id) { if (id === "#website-assets") return `export default ${JSON.stringify(assets)};`; },
}] });
try {
  const { output } = await bundle.generate({ format: "iife" });
  outputs.set("settings/mock.js", output[0].code);
} finally { await bundle.close(); }
// 原版文件单独提供镜像和下载包，不加入页面 Mock 的运行时资源集合。
// Mirror and archive original files separately from the runtime page Mock resource set.
const provenanceURL = new URL(import.meta.resolve("@nsnanocat/preference-panes/styles/provenance.json"));
const provenance = JSON.parse(await readFile(provenanceURL, "utf8"));
const originals = ["provenance.json", ...provenance.files.map(item => item.file)];
for (const name of originals) outputs.set(`settings/official/${name}`, await readFile(new URL(name, provenanceURL)));
for (const [name, body] of outputs) {
  const target = path.join(root, stamp ? "doc_build" : "docs/public", name);
  if (check) {
    if (!(await readFile(target)).equals(Buffer.from(body))) throw new Error(`Stale settings asset: ${name}`);
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
}
const archive = path.join(root, stamp ? "doc_build" : "docs/public", "settings/official-styles.zip");
if (check) {
  for (const name of originals) {
    if (!execFileSync("unzip", ["-p", archive, name]).equals(outputs.get(`settings/official/${name}`))) throw new Error(`Stale official style archive: ${name}`);
  }
} else {
  await rm(archive, { force: true });
  execFileSync("zip", ["-q", "-X", "-j", archive, ...originals.map(name => path.join(root, stamp ? "doc_build" : "docs/public", "settings/official", name))]);
}
console.log(JSON.stringify({ outputs: outputs.size, check }));
