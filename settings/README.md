# Biliverse 定制设置入口

本站维护 Biliverse 设置主页、一个与主页配套的页面脚本、可选项目主题和图片素材。Enhanced 唯一安装 PreferencePanes latest 的 `web.js` 和 `api.js`，为所有合法模块路径提供同一套设置前端与后端；每个业务模块只提供自己的同版 BoxJS JSON。

主页 HTML 只以 data 属性声明模块名，并直接引入 Bilibili 官方 JSBridge SDK。`index.mjs` 是 Biliverse 页面自己的业务脚本：它从 `web.js` 加载通用 Navigation/ModuleFrame/ModuleStatus 网页组件，按 `/settings/{module}` 打开模块页，并直接调用全局 `biliBridge` 实现 common 容器的主题、导航、菜单、确认和提示。PreferencePanes 不包含任何 Bilibili SDK 逻辑；github.io 不托管模块页面、通用 API 或 BoxJS JSON。

## 安装与升级

接入模板按职责包含三类规则：

- 配置 Mock：从同版业务仓库的 Gist/Release 取得 BoxJS JSON，非原生 Mock 平台使用同版纯配置响应脚本。
- 项目主页：把本站的 index.html、index.mjs 和图片素材映射到 app.bilibili.com；官方 CSS 和 JSBridge SDK 始终直接使用官方地址。
- 通用设置前后端：仅 Enhanced 安装 `web.js` 和 `api.js`。前者处理任意合法 `/settings/{module}` 以及 `index.mjs`、`navigation.mjs`；后者处理 `/api/{module}` 和固定 `/api/get|set|delete`。

Enhanced 的接入模板包含配置 Mock，以及唯一通用设置前后端。Global、Redirect、ADBlock 的接入模板只包含各自的配置 Mock，不引用 PreferencePanes `web.js` 或 `api.js`。PreferencePanes 的 `api.js` 与 `web.js` 必须来自同一 Release，再更新 Enhanced 模板。

网站不持有模块字段或默认值。浏览器通过 `GET /api/{module}` 获取原始 BoxJS，解析控件、默认值和展示信息，并在调用固定 form 存储接口前校验完整 `@root.path` 与值；`api.js` 不解析 BoxJS，只负责同源配置转发和 util `Storage` 深路径读写。业务脚本选择 PersistentStore 后使用这些设置。

## 本地验证

```sh
pnpm settings:build
pnpm settings:check
pnpm settings:test
pnpm settings:preview
```

预览读取同级业务仓库 dist/config.dev.bundle.js，以及 NSNanoCat/PreferencePanes 的 dist/api.js 和 dist/web.js，以独立内存模拟 Enhanced 提供唯一通用前后端、各模块只提供配置的代理拓扑。先构建这些仓库。预览不会复制 API、设置前端或配置到网站目录。

网站构建只复制主页 HTML、index.mjs、theme.css 和单套透明图标素材。原始图标保持不变，处理记录见 icons-manifest.json；客服中心样式依据见 customer-service-research.md，Common WebView 与 Bridge 的当前结论统一保存在 Biliverse/API 的 common-webview-settings 报告及 Apifox 文档中。
