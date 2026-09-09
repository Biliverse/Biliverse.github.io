# Biliverse 设置入口与模块资源

`https://biliverse.github.io/settings/` 是本站自行维护的静态定制入口，源文件为 index.html、home.css、home.js。品牌、四个圆形入口和官方客服 CSS 链接都在本站，首页只并发 HEAD `/configs/{module}`；JSON 不可访问时入口禁用，不导入 PreferencePanes 渲染器，也不读取设置值。

## Enhanced 0.7.0 接入

本站安装 `@nsnanocat/preference-panes@0.7.0`，构建时只读取 Enhanced 的 `template/boxjs.settings.json`，调用 `build(boxjs)` 生成 Enhanced 模块页。默认模块样式来自包；将来定制时仅增加该模块 CSS 输入。

模块产物为 `/settings/Enhanced/`、assets/Enhanced.html、Enhanced.boxjs.json、Enhanced.css、Enhanced.request.js、Enhanced.config.js 和公共 app.mjs。PreferencePanes 不生成本站首页，不读取 site.boxjs.json/proxies.json，也不要求本站拼接代理代码。

Enhanced 只安装 `/configs/Enhanced` 的 JSON Mock，保留 App 内 Biliverse 入口注入；没有 npm 依赖、页面或读写代码。独立 PreferencePanes 安装文件由本站维护，只接管 Enhanced 模块页与 `/api/Enhanced/…`，不接管项目主页或 `/configs/`。资源使用 0.7.0 版本 URL 刷新代理缓存。

Global、Redirect、ADBlock 尚无对应新版 JSON Mock，首页仍显示禁用状态。本站不再生成它们的旧固化表单或向其仓库写入设置脚本。

## 安装

更新 Enhanced dev 模块订阅，并安装或更新下面对应代理的独立设置模块：

| 代理 | 文件 |
| --- | --- |
| Surge | [PreferencePanes.sgmodule](https://biliverse.github.io/settings/PreferencePanes.sgmodule) |
| Loon | [PreferencePanes.plugin](https://biliverse.github.io/settings/PreferencePanes.plugin) |
| Quantumult X | [PreferencePanes.snippet](https://biliverse.github.io/settings/PreferencePanes.snippet) |
| Stash | [PreferencePanes.stoverride](https://biliverse.github.io/settings/PreferencePanes.stoverride) |
| Shadowrocket | [PreferencePanes.conf](https://biliverse.github.io/settings/PreferencePanes.conf) |

模块页先导入 JSON/CSS，再直接生成设置表单；读取一次持久化设置，修改立即保存。单选为下拉框，多选为二级页，返回不重读设置。Caches 与重置操作按需执行。要让 Enhanced 使用持久化值，将“配置类型”切换为 PersistentStore。

## 构建与验证

```sh
pnpm install --frozen-lockfile
pnpm settings:build
pnpm settings:check
pnpm settings:test
pnpm settings:preview
```

预览执行已生成的模块脚本，存储为独立内存。首页是真实静态文件，不使用 PreferencePanes 的文件导入测试台。该包的测试台仅用于开发模块页。

发布顺序为包 → 本站 main/Pages → Enhanced dev。dev 本身不会触发 Pages 发布。原始图片保持不变，透明裁切与亮暗图标记录见 icons-manifest.json；官方样式来源见 customer-service-research.md 与 provenance.json。
