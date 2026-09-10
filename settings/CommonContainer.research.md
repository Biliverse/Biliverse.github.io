# Bilibili common 容器入口调研（2026-09-10）

## 结论

iOS 自定义入口使用 `bilibili://web/general?url=<百分号编码的页面 URL>`，实际页面仍为 `https://app.bilibili.com/settings/`。scheme 由客户端路由处理，页面、配置和 API 的 HTTP 路径均不变。

SDK 文件仍直接引用官方 `https://s1.hdslb.com/bfs/seed/jinkela/short/jsb/js-bridge.min.js`。页面不修改 UA 或 `isWbTypeCommon`，也不通过网页菜单替代 common 导航。

## iOS 客户端证据

分析对象：本机 `bilibili.app`，`com.bilibili.inter`，6.4.0 / 91000200。以下为反汇编证据，不冒充公开 SDK 文档或真机运行结果。

1. `WebKitModuleModuleInitialize` 的注册代码位于 `0x1000e1538`。`0x1000e1568` 至 `0x1000e1580` 构造 Swift 小字符串 `web/general`，调用 `BFCRouter.mapBiliNative:toBlock:` 注册回调 `0x1000e19ac`。
2. 路由回调从参数字典读取 `url`，转为字符串；`0x1000e1ab8` 获取 `BFCWebViewControllerV4` 类型，`0x1000e1ad0` 调用其 URL 初始化函数 `0x10488b848`，随后展示容器。这条直接注册的回调不检查 URL 白名单。
3. 自动选择路径是另一条代码：`WebViewRouterInterceptor.handleUrl:` → `0x1000e2c70`，检查 `webview_common_enable`，并通过 `webview.v4_enable` 的 URL 正则和版本条件决定是否创建 V4。自定义入口使用上面的显式路由，不依赖自动选择命中。
4. `bilibili://browser?url=...` 会被自动选择路径拆出内部 URL，不能将它与显式 `web/general` 视为同一个选择入口。

Android 6.2.6 / 9060400 的 DEX 中另有 `bilibili://web/general/main` 和 `bilibili://web/general/web`。这些后缀不用于此 iOS 入口。`app_common=open` 仅找到直播业务 URL 示例，没有足够证据把它当作 iOS 通用容器选择参数。

## 页面约定与验证

- 入口负责选择容器；页面通过官方 SDK 的 `isWbTypeCommon` 检查实际容器，禁止伪造该标记。
- 导航使用 V2 `ui.setNavigationHide`、`ui.setTitle`、`ui.setNavigationButton`，菜单点击使用 `ui.observeNavigationClick` 通道。
- 非 common 入口明确提示更新 Enhanced 并重新从“我的”进入，不静默切换成网页菜单。
- “复制客户端能力”导出 `container.common`。更新 Enhanced 后应关闭旧 WebView，从新入口打开，再核对该值为 `true`、原生标题/菜单及返回行为。
- 入口编码、去重和导航协议已由本地测试覆盖。当前工具未能启动本机 iOS App，用户 iPhone 的实际容器结果仍需以这项导出与交互验证为准。
