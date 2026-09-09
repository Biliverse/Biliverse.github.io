# Biliverse 设置入口与模块资源

`https://biliverse.github.io/settings/` 是本站自行维护的静态定制入口，源文件为 index.html、home.css、home.js。品牌、四个圆形入口和官方客服 CSS 链接都在本站，首页只并发 HEAD `/configs/{module}`；JSON 不可访问时入口禁用，不导入 PreferencePanes 渲染器，也不读取设置值。

## PreferencePanes 0.7.2 接入

本站从已安装的 `@nsnanocat/preference-panes` 复制公共 HTML、app.mjs、navigation.mjs，并部署自己的 theme.css。构建不读取 Enhanced 仓库，不解析或打包业务配置。默认布局来自包；首页与模块页的粉色主题由本站维护。

网站仅保存模块 HTML 外壳、公共浏览器 JS、CSS、图标和安装规则。不保存 BoxJS JSON、配置响应脚本或内嵌配置的存储脚本。

Enhanced 的 `/configs/Enhanced` 是代理中的虚拟接口：dev 从 Enhanced 的 Gist 返回同次构建的 JSON，正式版从与业务脚本相同的 Release tag 返回 JSON。非原生 Mock 平台使用 Enhanced 同次发布的 config.bundle.js。独立设置模块的存储脚本也来自 Enhanced 发布产物，通用实现由 PreferencePanes 构建器生成；本站不生成或托管这些文件。

Global、Redirect、ADBlock 尚无对应新版 JSON Mock，首页仍显示禁用状态。本站不再生成它们的旧固化表单或向其仓库写入设置脚本。

## 安装

此次迁移需要更新 Enhanced 订阅及下面对应代理的独立设置模块，移除旧的 github.io 配置资源引用。下面安装文件默认使用 Enhanced dev Gist；正式版可将脚本来源换为对应 Release tag 的 settings.bundle.js。以后仅修改界面时，仍只需部署网站。

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

预览从同级业务仓库的 dist 读取该模块的 config.dev.bundle.js 和 settings.dev.bundle.js，存储为独立内存；先在对应模块仓库运行 npm run dev。不会把这些产物复制到网站。模块页由网站静态文件提供，配置缺失时返回 404。

迁移发布顺序为 Enhanced 构建/发布配置与脚本 → 更新订阅 → 本站 main/Pages 清理旧文件。dev 本身不会触发 Pages 发布。原始图片保持不变，透明裁切与亮暗图标记录见 icons-manifest.json；官方样式来源见 customer-service-research.md 与 provenance.json。
