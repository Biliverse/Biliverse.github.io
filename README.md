# Biliverse 本地设置首页

同一份 PreferencePanes `home.html` 原样部署到 `/settings/index.html`。源码 `settings` 目录提供固定路径的 `home.json`、`theme.css`、`bridge.mjs`、`bridge.d.mts` 和 `assets`，不维护项目首页 HTML 或启动脚本。JSON 定义品牌、章节、入口、真实图标与官网／组织／论坛链接。

官网入口声明 `target: "internal"`，共用框架嵌入页面并保留标题与返回；GitHub 组织和官方论坛声明 `target: "_blank"`，由 Bridge 请求原生新页，失败时保留设置页并显示错误。`_self` 可用于整页跳转，省略时保持原宿主路由；模块设置项的单参数 URL 调用保持原行为。该方式不保证启动指定外部浏览器。

`theme.css` 维护官方色板依赖、Biliverse 粉色与日夜配色；网格、列表、四／六／八列与居中版本由默认样式提供。`bridge.mjs` 是唯一的项目映射，直接引用官方 SDK，将共用接口转换为 Common WebView 原生标题、MORE、确认、Toast、主题、键盘和链接调用；菜单忙碌状态与当前标题复用框架，监听与原生回调由映射释放。官方 SDK 与 CSS 均不复制打包，Bilibili 协议不进入通用框架。可选 CSS 或 Bridge 的 HEAD 返回 404 才使用默认网页功能；200 才加载，其它错误直接显示。普通浏览器提供了 Bilibili Bridge 时需要真实 Common WebView，否则初始化会报错。

Enhanced 首页 Mock 和固定存储 API 分别使用 PreferencePanes 最新正式版的 `home.html`、`api.js`；正式版 JSON、品牌 CSS、Bridge 和图片随 Enhanced 自身版本 Release 发布。内容源码仍只在本仓库维护，Enhanced 按确定提交打包；更新网站不会改变已发布 Enhanced 的专用资源。模块与字段子页在同一文档中渲染，各业务模块只提供自己的 BoxJS API，原有存储和业务协议保持不变。

```sh
pnpm settings:build
pnpm settings:check
pnpm build
pnpm settings:test
pnpm settings:preview
```

构建默认读取 PreferencePanes `releases/latest/download/home.html`，每次构建和部署获取最新正式版。验收未发布的模板时，先构建 PreferencePanes，再为上述命令指定同一份本地文件：

```sh
export PREFERENCE_PANES_HOME=/Users/clyne/GitHub/NSNanoCat/PreferencePanes/dist/home.html
```

构建只复制 JSON、已提供的可选资源和 JSON 引用的本地图片。预览标记、部署时间与提交号追加到生成 JSON 的 `footer`；预览与部署 HTML 与框架字节一致。原图保存在源码 `assets` 中，不复制无引用的原图或类型定义到网站。

本地预览读取 Enhanced、兄弟模块和 PreferencePanes 构建产物，以独立内存模拟代理存储。先构建这些仓库，再打开命令输出的 HTTP 地址；`file://` 无法提供固定资源与 API。

目录迁移保留原图和历史资料：图标处理记录位于 `scripts/icons-manifest.json`，处理脚本位于 `scripts/prepare-settings-icons.py`，测试位于 `tests`，历史样式研究位于 `research/customer-service-research.md`。Common WebView 与 Bridge 研究仍保留在 Biliverse/API。


首页与设置页的默认 CSS 已合并为 PreferencePanes 的 `styles.css`，复用同一安装与清理逻辑，构建时随页面内置。默认 CSS 源码为一份；Biliverse 额外提供一份 `theme.css`，DualSubs 不提供品牌 CSS。

## 本地验收记录（2026-10-09）

两站预览／部署 HTML 与 PreferencePanes `dist/home.html` 的 SHA-256 相同。共用框架 71 项、Enhanced 53 项、Universal 4 项及两站打包／Bridge 测试通过；两站 TypeScript 检查与完整构建通过。原图哈希与图标透明度／居中校验通过。

浏览器实际渲染验证了 390／600／800px 下的四／六／八列、混合分组、真实图标、居中版本／页脚、帮助链接与 API 面板别名。未提供 Bridge 时无模块导入或 SDK 请求；品牌 CSS 覆盖有效。JSON 失败、可选资源 HEAD 500／503、CSS 与 Bridge 加载失败、Bridge 语法与初始化失败均显示错误。Bilibili Bridge 使用本地 SDK 测试替身验证原生标题、MORE、主题和无重复网页标题栏／Toast；确认、取消、键盘、退出与迟到回调通过行为测试。

iOS 18.6 Safari 模拟器实际检查了首页四列、设置导航、菜单、共享缓存确认／取消及返回。iOS 15 和真实 Bilibili Common WebView 本次未覆盖，仍需设备验收；本次产物未发布。

CSS 合并后重新通过框架 71 项及两站 6 项测试、框架类型检查和两站完整构建。浏览器核对首页与 iframe 各安装一份相同默认样式，品牌覆盖和四／六／八列有效；实际挂载／卸载面板保持外层网页的边距、字体、颜色和配色模式。iOS 18.6 Safari 回归首页、设置页、菜单与返回正常。

外链打开方式补齐后通过框架 72 项及两站 7 项测试、框架类型检查和 Apifox 一致性校验，两站设置产物已重新生成。Codex 浏览器实际验证官网内部导航、沿网页历史返回到官网及设置首页、GitHub 新标签和原设置页保留；Bilibili 新页仅验证了 SDK 测试替身的成功／失败及迟到回调，实际容器行为仍需 Common WebView 设备验收。

## 单文档框架配套

首页、模块和字段共用 PreferencePanes 内联 `home.html`。首页只 HEAD 探测，点击模块才 GET 配置并读取 Settings；字段子页复用会话。网站仍只提供 home.json、可选 theme.css / bridge.mjs 及图标，不部署旧模块 HTML 或 JS。Bilibili Bridge 与品牌 CSS 原样保留。

构建与验收默认使用 PreferencePanes 最新正式版的 `home.html`，不固定版本号。本地验收可用 `PREFERENCE_PANES_HOME` 指向框架产物。
