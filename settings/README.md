# Biliverse 设置入口与模块资源

`https://biliverse.github.io/settings/` 是本站自行维护的静态定制入口，源文件为 index.html、home.css、home.js。品牌、四个圆形入口和官方客服 CSS 链接都在本站，首页只并发 HEAD `/configs/{module}`；JSON 不可访问时入口禁用，不导入 PreferencePanes 渲染器，也不读取设置值。

## PreferencePanes 0.7.2 接入

本站安装 `@nsnanocat/preference-panes@0.7.2`，构建时读取 Enhanced 的 `template/boxjs.settings.json` 与本站 theme.css，调用 `build(boxjs, css)` 生成 Enhanced 模块页。默认布局来自包；首页与模块页的粉色标题、返回按钮和强调色统一由本站 theme.css 提供。

模块产物为 `/settings/Enhanced/`、assets/Enhanced.html、Enhanced.boxjs.json、Enhanced.css、Enhanced.request.js、Enhanced.config.js 和公共 app.mjs。PreferencePanes 不生成本站首页，不读取 site.boxjs.json/proxies.json，也不要求本站拼接代理代码。

Enhanced 只安装 `/configs/Enhanced` 的 JSON Mock，保留 App 内 Biliverse 入口注入；没有 npm 依赖、页面或读写代码。独立 PreferencePanes 安装文件由本站维护，只接管 Enhanced 模块页与 `/api/Enhanced/…`。0.7.2 保留既有 0.7.1 配置和 API 地址，已有 Enhanced 与独立设置模块无需改动；更新部署本站前端即可获得修复。

Global、Redirect、ADBlock 尚无对应新版 JSON Mock，首页仍显示禁用状态。本站不再生成它们的旧固化表单或向其仓库写入设置脚本。

## 安装

首次使用需要 Enhanced 的 JSON Mock 及下面对应代理的独立设置模块；已安装者升级本站 0.7.2 无需更新订阅：

| 代理 | 文件 |
| --- | --- |
| Surge | [PreferencePanes.sgmodule](https://biliverse.github.io/settings/PreferencePanes.sgmodule) |
| Loon | [PreferencePanes.plugin](https://biliverse.github.io/settings/PreferencePanes.plugin) |
| Quantumult X | [PreferencePanes.snippet](https://biliverse.github.io/settings/PreferencePanes.snippet) |
| Stash | [PreferencePanes.stoverride](https://biliverse.github.io/settings/PreferencePanes.stoverride) |
| Shadowrocket | [PreferencePanes.conf](https://biliverse.github.io/settings/PreferencePanes.conf) |

模块页先导入 JSON/CSS，再直接生成设置表单；读取一次持久化设置，修改立即保存。单选为下拉框，多选为二级页，返回不重读设置。Caches 与重置操作按需执行。要让 Enhanced 使用持久化值，将“配置类型”切换为 PersistentStore。

### Header 加载与返回

主页通过 ModuleFrame 请求 /settings/{module}，使用 X-PreferencePanes-JSON 和 X-PreferencePanes-CSS 指定两个资源地址。容器保留请求上下文，HTML 原样加载；即使得到线上静态 HTML，也不会从 about:srcdoc 猜测模块。JSON、CSS 和持久化设置仍由模块文档读取。常驻顶栏通过容器事件同步标题和返回状态，不改写 HTML 或注入隐藏样式；存储 API 的原有安装要求不变。

主页与模块二级页共用 PreferencePanes 的 Navigation 组件（/settings/assets/navigation.mjs）。home.js 只提供模块节点工厂、Header 加载与 HEAD 探测；不再自行维护 hash、历史标记、动画、滚动或退出清理。组件保持主页文档和滚动位置，模块从右侧滑入、向右滑出，动画完成后移除 iframe。后退顺序为二级多选 → 模块设置 → 定制主页；二级后退不重读，回到主页只重新 HEAD 探测。重新进入创建新 iframe 并重新读取，刷新也重新加载。主题、入口、品牌和布局仍由本站维护。

## 构建与验证

```sh
pnpm install --frozen-lockfile
pnpm settings:build
pnpm settings:check
pnpm settings:test
pnpm settings:preview
```

预览执行已生成的模块脚本，存储为独立内存。首页是真实静态文件，不使用 PreferencePanes 的文件导入测试台。该包的测试台仅用于开发模块页。

本次发布顺序为包 → 本站 main/Pages，不修改 Enhanced。dev 本身不会触发 Pages 发布。原始图片保持不变，透明裁切与亮暗图标记录见 icons-manifest.json；官方样式来源见 customer-service-research.md 与 provenance.json。
