import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const root = path.resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const stamp = process.argv.includes('--stamp');
// 网站只部署声明式主页及其素材，不保存运行脚本或业务配置。
// Deploy only the declarative landing page and its assets, without runtime scripts or business configuration.
const outputs = new Map();
for (const name of ['index.html', 'theme.css'])
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
// 不支持远程文件 Mock 的代理返回同次构建的静态资源；CSS 从网站直连，不打包进 Mock。
// Proxies without remote file mocks return same-build assets; CSS loads directly from the site, outside mocks.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png' };
const assets = Object.fromEntries(
  [...outputs]
    .filter(([name]) => !name.endsWith('.css'))
    .map(([name, body]) => [
      name === 'settings/index.html' ? '/settings/' : `/${name}`,
      [types[path.extname(name)], name.endsWith('.png') ? [...body] : body.toString()],
    ]),
);
const bundle = await rollup({
  input: path.join(root, 'settings/mock.mjs'),
  plugins: [
    nodeResolve(),
    {
      name: 'website-assets',
      resolveId(id) {
        if (id === '#website-assets') return id;
      },
      load(id) {
        if (id === '#website-assets') return `export default ${JSON.stringify(assets)};`;
      },
    },
  ],
});
try {
  const { output } = await bundle.generate({ format: 'iife' });
  outputs.set('settings/mock.js', output[0].code);
} finally {
  await bundle.close();
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
