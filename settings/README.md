# Biliverse 定制设置入口

本站维护 Biliverse 设置主页、一个与主页配套的页面脚本、可选项目主题和图片素材。业务插件分别安装 PreferencePanes latest 的 `web.js` 和 `api.js`：前者提供模块页面与通用网页组件，后者只处理模块数据和持久化。

主页 HTML 以 data 属性声明模块、配置、页面和 CSS 地址，并直接引入 Bilibili 官方 JSBridge SDK。`index.mjs` 是 Biliverse 页面自己的业务脚本：它从 `web.js` 加载通用 Navigation/ModuleFrame/ModuleStatus 网页组件，并直接调用全局 `biliBridge` 实现 common 容器的主题、导航、菜单、确认和提示。PreferencePanes 不包含任何 Bilibili SDK 逻辑；github.io 不托管模块页面、通用 API 或 BoxJS JSON。

## 安装与升级

业务模块本身包含四类规则：

- 配置 Mock：从同版业务仓库的 Gist/Release 取得 BoxJS JSON，非原生 Mock 平台使用同版纯配置响应脚本。
- 项目主页：把本站的 index.html、index.mjs 和图片素材映射到 app.bilibili.com；官方 CSS 和 JSBridge SDK 始终直接使用官方地址。
- 设置前端：`/settings/{module}`、app.mjs 和 navigation.mjs 引用 https://github.com/NSNanoCat/PreferencePanes/releases/latest/download/web.js。
- 模块 API：`/api/{module}` 及其 get/set/delete 动作引用 https://github.com/NSNanoCat/PreferencePanes/releases/latest/download/api.js。

Enhanced、Global、Redirect、ADBlock 的接入模板均包含配置 Mock、设置前端和模块 API。PreferencePanes 的 `api.js` 与 `web.js` 必须来自同一 Release，再更新业务模块模板。

网站不持有模块字段或默认值。`api.js` 从 BoxJS 字段 ID 确认完整 `@root.path` 并直接使用 util `Storage`；`web.js` 中的浏览器代码解析控件、默认值和展示信息。业务脚本选择 PersistentStore 后使用这些设置。

## 本地验证

```sh
pnpm settings:build
pnpm settings:check
pnpm settings:test
pnpm settings:preview
```

预览读取同级业务仓库 dist/config.dev.bundle.js，以及 NSNanoCat/PreferencePanes 的 dist/api.js 和 dist/web.js，以独立内存模拟代理。先构建这两个仓库。预览不会复制 API、设置前端或配置到网站目录。

网站构建只复制主页 HTML、index.mjs、theme.css 和单套透明图标素材。原始图标保持不变，处理记录见 icons-manifest.json；客服中心样式依据见 customer-service-research.md，Common WebView 与 Bridge 的当前结论统一保存在 Biliverse/API 的 common-webview-settings 报告及 Apifox 文档中。
