# 入口位置与客服中心样式调查

## 2026-09-10：原版设置样式及页面内导出

按用户提供的“从电脑上的 App 取文件”方案，PreferencePanes 0.9.0 使用本机国际版 6.4.0/91000200 内置的 b-style 4.0.1 和 AppSettings 1.1.2 原版 CSS。文件原文及 SHA-256 保存在包的 `src/browser/vendor`，不复制业务 JavaScript；通用控件只适配原版 CSS 的 DOM 类名和固定作用域标记。原手写开关、设置行、输入框外观和颜色表已删除。默认样式放在 CSS layer 内，项目 CSS 保持覆盖能力。

网站提供 `settings/official/` 原文件镜像和 `settings/official-styles.zip` 下载包，明确属于官方文件镜像，不是官方公网 CDN。无需手机连接电脑即可下载。JSBridge SDK 仍直接引用 s1.hdslb.com 官方地址。

主题和键盘接收官方 SDK 事件；清空缓存和重置通过 `ability.alert` 原生确认，参数由本机原生实现核实。搜索使用官方 VField 外观，本地过滤已读取的 BoxJS 字段。

导航按钮仍需核对目标容器。已从本机 Swift 字段元数据取得 CommonButton 的 id/type/content/url/badge/menu/visible，以及按钮点击结果 id；尚未确认可覆盖居中 logo＋标题和当前返回行为，因此未删除现有公共导航。页面内“复制客户端能力”只导出 SDK 版本及 V1/V2 方法清单，不读取用户资料和持久化配置。

## 2026-09-09：官方域名下的本机 Mock 入口

用户截图确认 `0454427` 版本仍不能退出。本机客户端存在 JSBridge URL 白名单，在方法分发之前检查来源域名；失败会记录 `is not allowed to call jsbridge method!` 后返回。github.io 不在内置名单中，单独加载官方 SDK 不会改变网页来源。

根据用户授权，Enhanced 入口改为 `https://app.bilibili.com/settings/?navhide=1`。Enhanced 安装首页与 15 项静态资源的精确映射；Surge 使用 Map Local、Loon 使用远程文件 Mock，下载源仍是 `https://biliverse.github.io/settings/`。不具备原生远程文件 Mock 的平台使用网站构建的 `settings/mock.js`，直接返回同次构建的 HTML、JS、CSS 和 PNG 字节；通过 util 的 done 适配宿主，不联网、不读写存储。该脚本与页面构建时间一致。

四个业务模块各自的 `/configs/{module}` 规则和 PreferencePanes 通用 API 规则同时支持 app.bilibili.com 与原 github.io 域名。页面、配置和存储请求保持同源；原 `/x/...` 官方接口不被静态规则接管。源文件、渲染器和业务配置的仓库职责不变，PreferencePanes 不需要修改或发布。

静态映射保持请求 URL，不使用会把浏览器地址改回 github.io 的 302 跳转。普通 github.io 页面仍可访问；App 内全屏退出必须从更新后的 Enhanced 入口进入。域名满足内置白名单是必要条件，最终关闭行为仍需客户端验证。

## 2026-09-09：游戏中心返回行为复核

Apifox 客户端快捷请求实际取得 [游戏中心 HTML](https://app.biligame.com/) 与它引用的 [gamecenter-h5 脚本](https://s1.hdslb.com/bfs/static/gameweb/gamecenter-h5/gamecenter-h5.bc85b1e3aadf770e3c47.js)，均为 HTTP 200。Apifox 项目接口列表只有最近游玩记录，没有游戏中心网页定义，因此使用快捷请求读取公开页面，未修改现有接口。

游戏中心的 `goBack` 判断 `curPageIndex <= 1 && checkBiliApp()`：最外层调用 `closeWebview()`，其余页面调用 Vue Router 的 `back()`。单独的 `closeBrowser` 操作也直接关闭 WebView。`closeWebview` 先 `isSupport("global.closeBrowser")`，支持时通过 `biliBridge.callNative({method:"global.closeBrowser"})` 调用；不支持时调用旧客户端的 `biliapp.closeBrowser()`。

原 Biliverse 页面未加载官方 SDK，直接发送 V2 消息，也没有进行能力查询。官方 `useNative` 是 V2 API，而游戏中心的 `isSupport` / `callNative` 使用旧通道；同名方法并不意味着两条通道都支持。之前仅验证消息形状的测试无法证明退出有效。

现在首页直接引用 [官方 JSBridge SDK](https://s1.hdslb.com/bfs/seed/jinkela/short/jsb/js-bridge.min.js)（本次取得 3.3.5），由 SDK 处理初始化、回调与 iOS/Android 编码。根页面按游戏中心的查询与调用方式退出，子页面仍由 ModuleFrame 返回。等待 SDK 初始化后，若无旧通道则跳过该通道的能力查询，避免旧 `biliapp` 容器等待不存在的回调；没有可用退出接口时显示错误。

验证使用实际下载的官方 SDK，在 iOS WKWebView 对象消息与 Android 字符串消息两种宿主模型中执行，模拟旧通道支持关闭、V2 不支持关闭，确认依次发送能力查询和关闭请求。Apifox 不运行 Bilibili 原生 WebView，这些证据不能代替真机退出验证。该修复只部署网站，无需发布 PreferencePanes 或更新业务模块。

## 2026-09-09：首次全屏调查记录

当前 App 入口数据的游戏中心是 `bilibili://game_center/user?sourceFrom=100003`，属于原生路由。数据库中的旧 H5 游戏地址已返回 404。App 二进制和其它现用 H5 地址均包含 `navhide=1`；Biliverse 入口使用此参数关闭原生导航，保留网页常驻顶栏。

首次调查在本机官方 App 内置 `message-settings-CDqsRNlJ.js` 找到 `biliBridge.useNative("global.closeBrowser")`，并参考 `svgs-D7nnNgVc.js` 的 V2 消息编码。用户随后确认主页没有退出效果；该实现已被上面的游戏中心 SDK 接入替代，不再手工发送 V2 消息。

日期：2026-09-06。三个变更分别提交：入口上移、入口简称、客服中心样式。

## 我的页面入口

`Enhanced/src/function/database.mjs` 的 `Mine.sections_v2` 第一组现有四项：离线缓存、历史记录、我的收藏、稍后再看；`style=1`。推荐服务亦为 `style=1`，已有多项图标入口和 HTTPS 跳转。

本次未获得“一行五项”的客户端运行时证据，不能把 JSON 数组能够追加等同于客户端支持第五个同排按钮。当前安装的 `com.bilibili.inter` 无法通过 UI 工具连接。采用用户明确允许的推荐服务方案：手机放在推荐服务第一项，iPad 放在 `ipad_recommend_sections` 第一项，移除旧位置重复入口。推荐区域缺失时创建同契约的推荐区域。原快捷区四项不改。

显示名称单独改为 `Biliverse`，入口 URL 与新版透明图标地址保持原值。自动化测试验证分组、顺序、去重、旧位置迁移和 `Mine.Switch=false` 行为；原生 App 显示仍需设备验证。

## 官方客服中心

实际查看 [客服中心](https://www.bilibili.com/h5/customer-service?contact_hidden=2)：桌面 UA 跳转至 `/v/customer-service`；手机 UA 保留 H5。以 390×844、中文 locale 检查了移动端页面，确认 `self-panel is-zh` 中的“自助服务”：四列圆形彩色图标，上图下文字，两行后提供轮播分页。

从官方 HTML 引用取得的资源：

- [CSS](https://s1.hdslb.com/bfs/static/2233-monorepo/customer-service-h5/static/css/index.545c1c91.css)，SHA-256 `58332df98008ab8b1861d7e2501486f4a60846ad151e6c7c08175b2aa6a2cd01`。
- [JS](https://s1.hdslb.com/bfs/static/2233-monorepo/customer-service-h5/static/js/index.fe09e4e3.js)，SHA-256 `90fb7646f8bd2b583049d56b59d1334c165e07cab2841b13f160fe7cecea7e5f`。

这是 Vue 组件 `SelfPanel` / `SelfItem`，不是一个开放的自助服务表单 SDK。`SelfPanel` 接收 title/list，数据来自 `serviceData.self`；条目消费 `image`、`title`、`h5_url`。中文布局在宽度 <500 时按四列分组，每页八项；较宽屏改用六列或八列。该列数仅证明客服中心 H5 的行为，不证明原生“离线缓存”区的列数。

直接照搬业务 JS 有两个问题：`openLink` 调用 `ability.openScheme`，点击同时调用 `h5cs_selfhelp_click` 埋点；中文名称显示为 `item.title.slice(0,7)`，会截断 `Enhanced` / `Redirect`。这些业务依赖不应进入 Biliverse 设置页。

## 采用方案

`index.html` 直接用 stylesheet 链接加载上方官方 CSS。self-panel、self-item 的 flex 布局、方向、对齐和图标滤镜来自该外部样式；`bilibili-self-service.css` 只做适配，将375px设计基准的 rem 尺寸改为固定像素，不随屏幕宽度缩放字号。新增适配限定在根页面：固定四项、每项25%宽、56px圆形浅色底、完整模块名称和预留连接状态行。圆形浅色底承载已处理的 Biliverse 透明图标。

根页面继续由 Enhanced 管理，四个 HEAD 并发探测、失败禁用与成功跳转逻辑保持；二级参数表单仍沿用原来的 AppSettings 表单样式。因为只有四个入口，不引入 VSwipe、Vue业务运行时或官方埋点。官方CSS在浏览器运行时从CDN加载，本地适配CSS仍内嵌在HTML。引用带哈希的文件固定版本，不自动跟随客服站的下次发布；若官方下架旧文件需更新链接并重新验证。

亮暗模式同时适配图标资源和圆形底色，支持 App `themeId` 覆盖系统颜色偏好。以上是官方布局/CSS 的定向复用，不宣称直接运行了官方客服业务组件。
