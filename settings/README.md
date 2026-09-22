# Biliverse 定制设置入口

本站维护 Biliverse 设置主页、一个与主页配套的页面脚本、可选项目主题和图片素材。Enhanced 唯一映射 PreferencePanes latest 的 `index.html`、`index.mjs`、`navigation.mjs`，并安装固定存储 `api.js`；每个业务模块将自己的同版 BoxJS JSON 直接 Mock 到 `/api/{module}`。

主页 HTML 只以 data 属性声明模块名，并直接引入 Bilibili 官方 JSBridge SDK。`index.mjs` 是 Biliverse 页面自己的业务脚本：它导入 `/settings/assets/navigation.mjs` 的通用 Navigation/ModuleFrame/ModuleStatus 网页组件，按 `/settings/{module}` 打开模块页，通过 `X-PreferencePanes-JSON` 传入 `/api/{module}` BoxJS 地址，并通过 `X-PreferencePanes-CSS` 传入本站 `theme.css`。页面脚本直接调用全局 `biliBridge` 实现 common 容器的主题、导航、菜单、确认、提示和 `open-url` 原生跳转。只有 `ability.openScheme` 可用时网站才接管链接；原生调用明确失败时退回顶层标准导航。PreferencePanes 不包含任何 Bilibili SDK 逻辑；github.io 不托管模块页面、通用 API 或 BoxJS JSON。

## 安装与升级

接入模板按职责包含三类规则：

- 配置 Mock：从同版业务仓库的 Gist/Release 取得 BoxJS JSON，非原生 Mock 平台使用同版纯配置响应脚本。
- 项目主页：把本站的 index.html、index.mjs、theme.css 和图片素材映射到 app.bilibili.com。页面统一请求同源 `/settings/theme.css`，接入模板再将该请求映射到本站真实 CSS 文件，避免请求地址与远程文件地址自引用。官方 CSS 和 JSBridge SDK 始终直接使用官方地址。
- 通用设置前后端：仅 Enhanced 将 `/settings/{module}`、`/settings/assets/index.mjs`、`/settings/assets/navigation.mjs` 分别映射到 PreferencePanes latest 的 `index.html`、`index.mjs`、`navigation.mjs`，并安装只处理固定 `/api/get|set|delete` 的 `api.js`。页面资源不经过响应脚本。

Enhanced 的接入模板包含 `/api/Enhanced` BoxJS Mock，以及唯一通用设置前端和固定存储 API。Global、Redirect、ADBlock 的接入模板只包含各自的 `/api/{module}` BoxJS Mock，不重复映射 PreferencePanes 页面资源或 `api.js`。PreferencePanes 的三个页面文件与 `api.js` 必须来自同一 Release，再更新 Enhanced 模板。

网站不持有模块字段或默认值。主页只把 `/api/{module}` 作为 BoxJS 资源 Header 交给通用模块页面；浏览器随后获取业务模板直接返回的原始 BoxJS，解析控件、默认值和展示信息，并在调用固定 form 存储接口前校验完整 `@root.path` 与值。`api.js` 不解析 BoxJS，只负责 util `Storage` 深路径读写。业务脚本选择 PersistentStore 后使用这些设置。

## 本地验证

```sh
pnpm settings:build
pnpm settings:check
pnpm settings:test
pnpm settings:preview
```

预览读取同级业务仓库 `dist/config.dev.bundle.js`，以及 NSNanoCat/PreferencePanes 的 `dist/api.js`、`dist/module/index.html`、`index.mjs`、`navigation.mjs`，以独立内存模拟 Enhanced 映射通用静态页面、提供固定存储 API、各模块直接提供 BoxJS API 的代理拓扑。先构建这些仓库。预览不会复制 API、设置前端或配置到网站目录。

网站构建只复制主页 HTML、index.mjs、theme.css 和单套透明图标素材。原始图标保持不变，处理记录见 icons-manifest.json；客服中心样式依据见 customer-service-research.md，Common WebView 与 Bridge 的当前结论统一保存在 Biliverse/API 的 common-webview-settings 报告及 Apifox 文档中。
