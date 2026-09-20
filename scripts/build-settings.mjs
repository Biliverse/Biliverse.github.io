import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const stamp = process.argv.includes('--stamp');
// 网站部署项目主页、主页脚本及其素材，不保存通用面板或业务配置。
// Deploy the project landing page, its page script and materials, without the generic panel or business configuration.
const outputs = new Map();
for (const name of ['index.html', 'index.mjs', 'theme.css'])
  outputs.set(`settings/${name}`, await readFile(path.join(root, 'settings', name)));
for (const record of JSON.parse(await readFile(path.join(root, 'settings/icons-manifest.json'), 'utf8')))
  for (const source of record.outputs)
    outputs.set(`settings/assets/${path.basename(source)}`, await readFile(path.join(root, source)));
// 发布产物记录本次构建时间和提交号；源文件与本地预览不伪装成已发布版本。
// Stamp publication output with build time and revision; source and local previews remain explicitly unpublished.
if (stamp) {
  const builtAt = new Date();
  const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const label = `构建于 <time datetime="${builtAt.toISOString()}">${builtAt.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })} UTC+8</time> · ${revision}`;
  outputs.set(
    'settings/index.html',
    outputs.get('settings/index.html').toString().replace('本地预览（未构建）', label),
  );
}
const targetRoot = path.join(root, stamp ? 'doc_build/settings' : 'docs/public/settings');
if (!check) await rm(targetRoot, { recursive: true, force: true });
for (const [name, body] of outputs) {
  const target = path.join(root, stamp ? 'doc_build' : 'docs/public', name);
  if (check) {
    if (!(await readFile(target)).equals(Buffer.from(body))) throw new Error(`Stale settings asset: ${name}`);
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
}
console.log(JSON.stringify({ outputs: outputs.size, check }));
