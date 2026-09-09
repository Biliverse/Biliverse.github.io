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
 * 直接订阅官方 SDK 的主题和键盘事件，监听器随宿主文档释放。
 * Subscribe to official SDK theme and keyboard events for the host document's lifetime.
 * @param {{theme: (value: {theme: number, night: number}) => void, keyboard: (height: number) => void}} callbacks 环境更新回调 / Environment callbacks.
 * @param {Window} [host] 宿主窗口 / Host window.
 * @returns {Promise<void>} 已完成能力查询和事件注册 / Capability checks and subscriptions completed.
 */
export async function observeAppearance(callbacks, host = window) {
  if (!inBilibili(host)) return;
  const bridge = host.biliBridge;
  await bridge.initPromise;
  const registrations = [
    { method: "ui.observeThemeChange", data: { immediately: true }, onChangeTheme: callbacks.theme },
    { method: "ui.observeKeyboardStatus", data: {}, onShow: ({ height }) => callbacks.keyboard(height), onHide: () => callbacks.keyboard(0), onChangeHeight: ({ height }) => callbacks.keyboard(height) },
  ];
  await Promise.all(registrations.map(async registration => {
    if (await bridge.isSupport(registration.method)) bridge.callNative(registration);
  }));
}

/**
 * 使用官方原生确认框；普通网页由 PreferencePanes 使用浏览器对话框。
 * Use the official native confirmation dialog; PreferencePanes handles standalone browser dialogs.
 * @param {string} message 确认内容 / Confirmation message.
 * @param {Window} [host] 宿主窗口 / Host window.
 * @returns {Promise<boolean>} 用户是否确认 / Whether the user confirmed.
 */
export async function confirmBilibili(message, host = window) {
  const bridge = host.biliBridge;
  await bridge.initPromise;
  if (!(await bridge.isSupport("ability.alert"))) throw new Error("客户端不支持原生确认框");
  return new Promise((resolve, reject) => bridge.callNative({
    method: "ability.alert",
    data: { type: "confirm", title: "Biliverse", message, confirmButton: "确定", cancelButton: "取消" },
    onConfirm: () => resolve(true), onCancel: () => resolve(false), onNeutral: () => resolve(false),
    callback: result => { if (result instanceof Error || result === "error") reject(new Error("客户端确认框调用失败")); },
  }));
}

/**
 * 直接调用当前容器已注册的原生 Toast，参数来自客户端实现。
 * Call the registered native Toast using the client-verified payload.
 * @param {string} message 提示文字 / Notice text.
 * @param {Window} [host] 宿主窗口 / Host window.
 * @returns {Promise<void>} 提示已提交给客户端 / Notice dispatched to the client.
 */
export async function toastBilibili(message, host = window) {
  const bridge = host.biliBridge;
  await bridge.initPromise;
  if (!(await bridge.isSupport("biliapp.showToast"))) throw new Error("客户端不支持原生提示");
  bridge.callNative({ method: "biliapp.showToast", data: { title: message } });
}

/**
 * 导出当前容器的方法清单到剪贴板，不读取用户资料或持久化配置。
 * Export container methods to the clipboard without reading user information or persistent settings.
 * @param {Window} [host] 宿主窗口 / Host window.
 * @returns {Promise<void>} 已复制能力清单 / Capabilities copied.
 */
export async function exportCapabilities(host = window) {
  const bridge = host.biliBridge;
  let timer, expired = false;
  try {
    await Promise.race([
      (async () => {
        await bridge.initPromise;
        const v1 = await new Promise(resolve => bridge.callNative({ method: "global.getAllSupport", callback: resolve }));
        const v2 = bridge.isBiliInjectV2() ? await bridge.useNative("global.getAllSupport") : null;
        const content = JSON.stringify({ sdk: bridge.jsbVersion, v1, v2: v2?.data ?? null }, null, 2);
        if (!(await bridge.isSupport("ability.copyToClipboard"))) throw new Error("客户端不支持复制能力清单");
        if (expired) return;
        await new Promise((resolve, reject) => bridge.callNative({ method: "ability.copyToClipboard", data: { content }, callback: result => result?.code === 0 ? resolve() : reject(new Error("复制失败")) }));
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error("客户端未响应能力导出请求")); }, 10000); }),
    ]);
  } finally { clearTimeout(timer); }
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
