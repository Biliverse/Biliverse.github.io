# Biliverse 本地设置

主入口为 `https://biliverse.github.io/settings/`。Enhanced 插入 App 入口，并只输出设置字段的 BoxJS JSON。本站维护主菜单、设置图标、安装映射和部署；PreferencePanes 提供完整页面、导航、控件、通知及独立代理执行端。Enhanced 不导入该包、不构建或处理设置页面，也不通过自己的 Request 响应设置 API。

## 安装

先安装一次独立 PreferencePanes 通用模块，再更新 Enhanced 模块订阅。通用模块统一提供页面与存储 API，Enhanced 仅提供配置 Mock。替换旧版 Enhanced 订阅可移除其中旧的页面/API 规则。

| 代理 | 通用模块 |
| --- | --- |
| Surge | [PreferencePanes.sgmodule](https://biliverse.github.io/settings/PreferencePanes.sgmodule) |
| Loon | [PreferencePanes.plugin](https://biliverse.github.io/settings/PreferencePanes.plugin) |
| Quantumult X | [PreferencePanes.snippet](https://biliverse.github.io/settings/PreferencePanes.snippet) |
| Stash | [PreferencePanes.stoverride](https://biliverse.github.io/settings/PreferencePanes.stoverride) |
| Shadowrocket | [PreferencePanes.conf](https://biliverse.github.io/settings/PreferencePanes.conf) |

主菜单只并发 HEAD /configs/{module}，不探测 API。缺少配置 Mock 时入口禁用；直接打开模块地址也会先 GET 配置，缺失、无字段或无效 JSON 时不读取设置 API、不生成表单。通用模块不匹配 /configs/，不会替已关闭的业务插件返回 JSON。

## 当前职责

| 来源 | 内容 |
| --- | --- |
| @nsnanocat/preference-panes/dist/settings/ | index.html、app.mjs、panel.css、home.css |
| settings/site.boxjs.json | 本站的品牌、四个模块入口、亮暗图标、官方 CSS 链接 |
| Enhanced/template/boxjs.settings.json | full argument config 通过标准 arguments-builder 生成的 BoxJS |
| settings/proxies.json | 通用模块的可信存储根、允许访问的模块名单与页面资源映射，不含配置 Mock |
| settings/icons/ | 本站维护的 Enhanced 设置图标，原始产品 logo 仍归业务项目 |
| @nsnanocat/preference-panes/dist/preference-panes.proxy.js | 包提供的预构建代理运行时，包含宿主适配、资源请求和存储读写 |
| settings/PreferencePanes.* | 独立通用模块安装文件，统一接管 /api/ 与 /settings/ |
| Enhanced 的代理模板 | 仅安装 /configs/Enhanced 的 BoxJS Mock |

HTML 不含模块名单、字段表或项目地址。根菜单从本站 site.boxjs.json 的 apps[].module 得到模块路径；设置控件在打开模块时根据配置 Mock 返回的 BoxJS 生成。设置构建从 Enhanced 读取的唯一文件是 template/boxjs.settings.json；不读取其 package.json、设置图标、安装配置、Request 或 dist。旧 settings/ 目录和 npm 接入依赖已从 Enhanced 删除。

构建读取包内代理运行时，再附加 PreferencePanes.runPreferences(安装映射)，生成 assets/PreferencePanes.request.js，由独立通用模块安装一次，处理所有允许的业务模块。API 不下载配置或安装映射。另生成 assets/Enhanced.config.js，仅为没有原生远程 Mock 的平台返回 BoxJS JSON，不包含任何存储、页面或网络下载逻辑。

Global、Redirect、ADBlock 尚未提供新版配置 Mock，因此入口禁用。所有模块静态地址和 HTML Mock 下载源都使用同一个通用外壳；直接访问缺少 JSON 的模块也不会回退到旧的固化表单。旧版读写脚本暂不迁移，旧 API 可达不能让新版入口变为可用。

## 路径与时序

| 路径 | 行为 |
| --- | --- |
| /settings/ | 通用主菜单，读取站点 JSON；每次进入并发 HEAD /configs/{module} |
| /settings/{module} | 通用设置页，从 URL 取得模块名 |
| /configs/{module} | 插件 Mock 返回 BoxJS；同名路径不部署线上文件 |
| /api/{module}/… | 插件中包提供的存储桥接，不是线上服务 |
| /settings/assets/ | Pages 托管的 HTML、JS、CSS、BoxJS 和菜单 JSON 下载源 |

打开、再次进入或刷新模块页，各读取一次 BoxJS 和设置子树，建立当前页面内存缓存。主菜单不读取持久化设置。控件修改立即串行 POST，对 HTTP 200 显示成功通知并更新内存；失败回滚该项，保存后不追加 GET。单选使用下拉框，多选进入二级选项页，前进后退保留滚动位置且不重新读取。

API 只按安装映射读写任意 JSON 路径，使用 util 的 Storage/Lodash，不下载 BoxJS、不重复校验字段和枚举。单键 DELETE 是 API 能力，页面不展示逐项保存或删除按钮。页面底部支持查看/刷新 Caches、清空 Caches、重置模块。

要让 Enhanced 使用保存的设置，应将“配置类型”切换为 PersistentStore；保存其它字段不会暗中切换配置来源。未设置字段使用插件默认值，已保存的空数组保留为空。修改在插件下一次处理业务请求时生效。

## Mock 与资源

Surge/Loon 在 Enhanced 中仅安装原生配置 Mock，其它平台仅安装 Enhanced.config.js 配置响应。页面与 API 规则全部位于独立 PreferencePanes 模块。页面下载源与拦截路径分离；通用模块不得拦截 /configs/。Enhanced 的业务 argument 不传给设置脚本。

自定义请求全部使用 biliverse.github.io，需要代理对该域名启用 MITM，不占用哔哩哔哩官方 API。关闭插件后仍可打开线上主菜单，但 /configs/{module} 探测失败，对应按钮禁用。

## 样式和图标

官方客服中心 CSS 链接放在 site.boxjs.json 的 stylesheets 数组中，由通用页面加载；圆形入口沿用 self-panel/self-item 类名。包内 home.css 提供基础布局与主题适配，panel.css 保留分组列表、下拉框和二级多选样式。没有引入官方业务 JS、JSBridge 或埋点。

样式来源证据见 [客服中心调研](customer-service-research.md) 和 [表单来源](provenance.json)。这些来源记录不代表官方提供了对外 SDK 或授权声明。

新图标为透明像素边界裁切、居中补齐正方形的 256×256 PNG，保留原文件。亮暗版本通过显式 icon/iconDark 指定，不把 BoxJS 的透明/彩色 icons 数组当成亮暗版本。App UA themeId 优先，否则跟随系统主题。生成记录见 icons-manifest.json；prepare-settings-icons.py 与 icons.test.py 用于重现和校验。

## 构建与部署

本仓库通过 pnpm 安装 PreferencePanes。同级 Enhanced 只用于读取 BoxJS。其它未迁移模块仍沿用旧配置生成流程。

```sh
pnpm install --frozen-lockfile
node scripts/build-settings.mjs
node scripts/build-settings.mjs --check
node --test settings/settings.test.mjs
node scripts/preview-settings.mjs
```

生成器从包复制四个静态文件到 docs/public/settings/assets/，发布菜单、Enhanced BoxJS、Enhanced.config.js、PreferencePanes.request.js 与五种独立安装文件，并更新主入口与 Enhanced 路径的 HTML。未迁移模块继续使用原有生成流程。不要手改生成文件。

预览静态文件来自 Pages 输出；Enhanced API 直接执行已生成的独立脚本，不导入 Enhanced Request。其它未迁移模块仍使用旧 Request。所有预览均使用独立内存存储，不读取用户代理配置。PORT 可指定端口。浏览器预览不替代所有代理 App 的实机验证。

Pages 自动部署仅监听 main；dev 的改动需同步到 main 才会上线。先发布包，再安装依赖并部署 Pages 资源，最后更新模块脚本。不要在托管目录新增 /configs/{module} 或 /api/{module} 的静态文件，否则会破坏插件可用性探测或存储接口语义。
