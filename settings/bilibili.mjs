/**
 * 识别 Bilibili WebView，普通浏览器保留原生历史返回。
 * Identify Bilibili WebViews while leaving browser history navigation intact elsewhere.
 * @param {Window} [host] 宿主窗口 / Host window.
 * @returns {boolean} 是否为 App 容器 / Whether this is an app container.
 */
export function inBilibili(host = window) {
  return Boolean(host.biliBridge?.inBiliApp || host.biliapp?.closeBrowser || host.biliInject || host.webkit?.messageHandlers?.biliInject || /biliapp|bili-universal|BiliDroid/i.test(host.navigator.userAgent));
}

/**
 * 沿用游戏中心的能力查询及关闭流程，由官方 SDK 管理原生传输和初始化。
 * Follow the game center's capability check and close flow; the official SDK owns transport and initialization.
 * @param {Window} [host] 宿主窗口 / Host window.
 * @returns {Promise<void>} 关闭请求已发出 / Close request dispatched.
 */
export async function closeBilibili(host = window) {
  const bridge = host.biliBridge;
  await bridge?.initPromise;
  if (bridge?.isNewJsBridge() && await bridge.isSupport("global.closeBrowser")) {
    bridge.callNative({ method: "global.closeBrowser" });
    return;
  }
  if (typeof host.biliapp?.closeBrowser === "function") {
    host.biliapp.closeBrowser();
    return;
  }
  throw new Error("客户端未提供可用的关闭接口，请使用 App 的返回手势。");
}
