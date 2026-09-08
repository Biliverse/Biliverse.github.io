# Biliverse 本地设置

主入口为 `https://biliverse.github.io/settings/`。Enhanced 将名为 Biliverse 的入口插入“我的”页面“推荐服务”首位，并提供配置 JSON；PreferencePanes 提供完整页面、导航、控件、通知和存储桥接。此仓库负责托管包内静态文件与配置，不从 Enhanced 的前端构建目录取文件。

## 当前职责

| 来源 | 内容 |
| --- | --- |
| @nsnanocat/preference-panes/dist/settings/ | index.html、app.mjs、panel.css、home.css |
| Enhanced/settings/site.boxjs.json | 品牌、四个模块入口、亮暗图标、官方 CSS 链接 |
| Enhanced/template/boxjs.settings.json | full argument config 通过标准 arguments-builder 生成的 BoxJS |
| Enhanced/settings/install.json | 代理的可信存储根、模块名与资源映射，不下发给浏览器 |
| Enhanced 的模板和 Request 入口 | 原生 Mock 规则、业务入口注入、调用包的 PreferencesHandler |

HTML 不含模块名单、字段表或项目地址。根菜单从 site.boxjs.json 的 apps[].module 得到模块路径；设置控件则在打开模块时根据配置 Mock 返回的 BoxJS 生成。Enhanced 不再维护页面 JS、CSS、HTML、build-preferences.mjs 或专用页面 Rollup 配置。

Global、Redirect、ADBlock 尚未迁移到新版包，其旧页面和读写脚本仍由现有生成器维护。新版主菜单仅对返回配置 Mock 的模块启用按钮；不会把旧接口可达误判为新版接入完成。

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

Surge/Loon 使用原生静态 Mock，Egern 沿用 Surge 转换。其它现有模板将请求交给 PreferencePanes 的通用资源处理器，从 install.json 的 source 下载同一份文件。资源下载路径与拦截路径分离，避免循环匹配。存储 API 独立处理，不触发资源下载。

自定义请求全部使用 biliverse.github.io，需要代理对该域名启用 MITM，不占用哔哩哔哩官方 API。关闭插件后仍可打开线上主菜单，但 /configs/{module} 探测失败，对应按钮禁用。

## 样式和图标

官方客服中心 CSS 链接放在 site.boxjs.json 的 stylesheets 数组中，由通用页面加载；圆形入口沿用 self-panel/self-item 类名。包内 home.css 提供基础布局与主题适配，panel.css 保留分组列表、下拉框和二级多选样式。没有引入官方业务 JS、JSBridge 或埋点。

样式来源证据见 [客服中心调研](customer-service-research.md) 和 [表单来源](provenance.json)。这些来源记录不代表官方提供了对外 SDK 或授权声明。

新图标为透明像素边界裁切、居中补齐正方形的 256×256 PNG，保留原文件。亮暗版本通过显式 icon/iconDark 指定，不把 BoxJS 的透明/彩色 icons 数组当成亮暗版本。App UA themeId 优先，否则跟随系统主题。生成记录见 icons-manifest.json；prepare-settings-icons.py 与 icons.test.py 用于重现和校验。

## 构建与部署

本仓库通过 pnpm 安装 PreferencePanes。同级模块仓库用于读取 BoxJS、业务 JSON、图标和未迁移模块的旧配置；不需要 Enhanced/dist/settings。

```sh
pnpm install --frozen-lockfile
node scripts/build-settings.mjs
node scripts/build-settings.mjs --check
node --test settings/settings.test.mjs
node scripts/preview-settings.mjs
```

生成器从包复制四个静态文件到 docs/public/settings/assets/，复制菜单和 Enhanced BoxJS，并更新主入口与 Enhanced 路径的 HTML。未迁移模块继续使用原有生成流程。不要手改生成文件。

预览静态文件来自 Pages 输出，API 使用各模块 Request 处理器与独立内存存储，不读取用户代理配置。PORT 可指定端口。浏览器预览不替代所有代理 App 的实机验证。

Pages 自动部署仅监听 main；dev 的改动需同步到 main 才会上线。先发布包，再安装依赖并部署 Pages 资源，最后更新模块脚本。不要在托管目录新增 /configs/{module} 或 /api/{module} 的静态文件，否则会破坏插件可用性探测或存储接口语义。
