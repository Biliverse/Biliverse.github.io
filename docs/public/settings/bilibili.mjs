/**
 * 识别 Bilibili WebView，普通浏览器保留原生历史返回。
 * Identify Bilibili WebViews while leaving browser history navigation intact elsewhere.
 * @param {Window} [host] 宿主窗口 / Host window.
 * @returns {boolean} 是否为 App 容器 / Whether this is an app container.
 */
export function inBilibili(host = window) {
  return Boolean(host.biliBridge?.inBiliApp || host.biliInjectV2 || host.webkit?.messageHandlers?.biliInjectV2 || /biliapp|bili-universal|BiliDroid/i.test(host.navigator.userAgent));
}

/**
 * 使用官方设置页的 global.closeBrowser 协议退出 App WebView。
 * Close the app WebView using the global.closeBrowser protocol used by official settings.
 * @param {Window} [host] 宿主窗口 / Host window.
 * @returns {Promise<void>} 关闭请求已发出 / Close request dispatched.
 */
export async function closeBilibili(host = window) {
  const native = host.biliInjectV2 ?? host.webkit?.messageHandlers?.biliInjectV2;
  switch (true) {
    case typeof host.biliBridge?.useNative === "function":
      await host.biliBridge.useNative("global.closeBrowser");
      break;
    case typeof native?.postMessage === "function":
      // 与官方 JSBridge 3.3.5 的 V2 编码一致；退出无需处理回调。
      // Match official JSBridge 3.3.5 V2 encoding; closing needs no callback handling.
      native.postMessage(JSON.stringify({ method: "global.closeBrowser", data: {}, callbackId: 0 }));
      break;
    default:
      throw new Error("暂时无法关闭页面，请使用 App 的返回手势。");
  }
}
