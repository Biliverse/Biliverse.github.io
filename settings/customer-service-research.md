# 入口位置与客服中心样式调查

## 2026-09-09：全屏与退出补充

当前 App 入口数据的游戏中心是 `bilibili://game_center/user?sourceFrom=100003`，属于原生路由。数据库中的旧 H5 游戏地址已返回 404。App 二进制和其它现用 H5 地址均包含 `navhide=1`；Biliverse 入口使用此参数关闭原生导航，保留网页常驻顶栏。

本机官方 App 内置 `message-settings-CDqsRNlJ.js` 调用 `biliBridge.useNative("global.closeBrowser")` 关闭页面；`svgs-D7nnNgVc.js` 内 JSBridge 3.3.5 的 V2 传输使用 biliInjectV2.postMessage(JSON.stringify({method,data,callbackId}))。网站复用这两种现有桥接入口，只在项目主页调用退出；模块和二级页仍先沿共同历史返回。普通浏览器使用 history.back。自动测试验证调用协议，原生容器最终效果仍需真机复测。

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
