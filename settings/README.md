# Biliverse 定制设置入口

本站维护 Biliverse 设置主页、一个与主页配套的页面脚本、可选项目主题和图片素材。模块页面、通用网页组件与持久化读写由业务插件安装的 PreferencePanes latest API 负责。

主页 HTML 以 data 属性声明模块、配置、页面和 CSS 地址，并直接引入 Bilibili 官方 JSBridge SDK。`index.mjs` 是 Biliverse 页面自己的业务脚本：它从 PreferencePanes API 加载通用 Navigation/ModuleFrame/ModuleStatus 网页组件，并直接调用全局 `biliBridge` 实现 common 容器的主题、导航、菜单、确认和提示。PreferencePanes 不包含任何 Bilibili SDK 逻辑；github.io 不托管模块页面、通用 API 或 BoxJS JSON。

## 安装与升级

业务模块本身包含三类规则：

- 配置 Mock：从同版业务仓库的 Gist/Release 取得 BoxJS JSON，非原生 Mock 平台使用同版纯配置响应脚本。
- 项目主页：把本站的 index.html、index.mjs 和图片素材映射到 app.bilibili.com；官方 CSS 和 JSBridge SDK 始终直接使用官方地址。
- 通用 API：引用 https://github.com/NSNanoCat/PreferencePanes/releases/latest/download/api.js，提供模块文档、app.mjs、navigation.mjs 及无鉴权 form 存储 API。

移除旧的独立 PreferencePanes 模块，安装更新后的业务模块即可。Enhanced、Global、Redirect、ADBlock 的接入模板均包含配置 Mock 和通用 API。PreferencePanes 0.8.0 将存储请求改为 POST /api/get、set、delete；发布顺序为 API Release → 业务模块模板 → 本站清理。

网站不持有模块字段或默认值。前端从 BoxJS 完整 ID 生成 form 字段名 @root.path，API 使用 util 读写，不重复下载 BoxJS，也不做鉴权或枚举校验。业务脚本选择 PersistentStore 后使用这些设置。

## 本地验证

```sh
pnpm settings:build
pnpm settings:check
pnpm settings:test
pnpm settings:preview
```

预览读取同级业务仓库 dist/config.dev.bundle.js，以及 NSNanoCat/PreferencePanes/dist/api.js，以独立内存模拟代理。先构建这两个仓库。预览不会复制 API 或配置到网站目录。

网站构建只复制主页 HTML、index.mjs、theme.css 和单套透明图标素材。原始图标保持不变，处理记录见 icons-manifest.json；客服中心样式依据见 customer-service-research.md，Common WebView 与 Bridge 的当前结论统一保存在 Biliverse/API 的 common-webview-settings 报告及 Apifox 文档中。
