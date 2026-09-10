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
 * 订阅 common 容器的 V2 环境事件，立即同步当前主题并在退出时释放通道。
 * Observe V2 environment events, synchronize the current theme immediately, and release channels on exit.
 * @param {{theme: (value: {theme: number}) => void, keyboard: (height: number) => void}} callbacks 环境回调 / Environment callbacks.
 * @param {Window} [host] 宿主窗口 / Host window.
 * @returns {Promise<(() => void) | undefined>} 通道释放函数；普通浏览器不注册 / Channel cleanup; no registration in ordinary browsers.
 */
export async function observeAppearance(callbacks, host = window) {
  if (!inBilibili(host)) return;
  const bridge = host.biliBridge;
  await bridge.initPromise;
  const theme = (result) => {
    if (result.code !== 0) {
      console.error('Bilibili theme channel failed', result);
      return;
    }
    // 注册成功回执没有主题数据，只有状态事件才更新页面。
    // Registration acknowledgements contain no theme; only state events update the page.
    if (typeof result.data?.theme === 'number') callbacks.theme(result.data);
  };
  const keyboard = (result) => {
    if (result.code !== 0) {
      console.error('Bilibili keyboard channel failed', result);
      return;
    }
    if (typeof result.data?.status === 'boolean') callbacks.keyboard(result.data.status ? result.data.height : 0);
  };
  bridge.addChannel('ui.observeThemeChange', theme, { immediately: true });
  bridge.addChannel('ui.observeKeyboardStatus', keyboard);
  return () => {
    bridge.removeChannel('ui.observeThemeChange', theme);
    bridge.removeChannel('ui.observeKeyboardStatus', keyboard);
  };
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
 * 调用 common 容器的官方 LiveUI 原生提示，避免旧版 biliapp 方法。
 * Call the official LiveUI toast in a common container instead of the legacy biliapp method.
 * @param {string} message 提示文字 / Notice text.
 * @param {Window} [host] 宿主窗口 / Host window.
 * @returns {Promise<void>} 提示已提交 / Notice dispatched.
 */
export async function toastBilibili(message, host = window) {
  const bridge = host.biliBridge;
  await bridge.initPromise;
  await bridge.useNative('liveUI.toast', { type: 'short', msg: message });
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
        const content = JSON.stringify({ sdk: bridge.jsbVersion, container: { common: bridge.isWbTypeCommon }, v1, v2: v2?.data ?? null }, null, 2);
        if (!(await bridge.isSupport("ability.copyToClipboard"))) throw new Error("客户端不支持复制能力清单");
        if (expired) return;
        await new Promise((resolve, reject) => bridge.callNative({ method: "ability.copyToClipboard", data: { content }, callback: result => result?.code === 0 ? resolve() : reject(new Error("复制失败")) }));
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error("客户端未响应能力导出请求")); }, 10000); }),
    ]);
  } finally { clearTimeout(timer); }
}

/**
 * 原生导航的状态、异步更新和菜单事件。
 * Native navigation state, asynchronous updates and menu events.
 */
export class NativeNavigation {
  #bridge;
  #ready;
  #queue = Promise.resolve();
  #revision = 0;
  #state = { title: "Biliverse", actions: [], busy: false };
  #destroyed = false;
  #subscribed = false;
  #select;
  #error;
  #click = result => {
    if (this.#destroyed) return;
    if (result.code !== 0) { this.#error(new Error(result.message)); return; }
    const id = result.data?.id;
    if (!this.#state.busy && this.#state.actions.some(action => action.id === id)) this.#select(id);
  };

  /**
   * 创建原生标题与菜单控制器，原生返回按钮沿客户端历史工作。
   * Control native titles and menus while the native back button follows client history.
   * @param {(id: string) => void} select 菜单选择 / Menu selection.
   * @param {(error: Error) => void} error 原生通道错误 / Native channel error.
   * @param {Window} [host] 宿主窗口 / Host window.
   */
  constructor(select, error, host = window) {
    this.#bridge = host.biliBridge;
    this.#select = select;
    this.#error = error;
    this.#ready = this.#connect();
  }

  /**
   * 恢复原生栏并订阅官方点击通道。
   * Restore the native bar and subscribe to official click events.
   * @returns {Promise<void>} 初始化完成 / Initialization completed.
   */
  async #connect() {
    await this.#bridge.initPromise;
    if (this.#destroyed) return;
    // 入口负责选择 common 容器；禁止用 UA 伪装或网页菜单掩盖错误入口。
    // The entry selects the common container; never disguise another container via UA or web menus.
    if (!this.#bridge.isWbTypeCommon) throw new Error("请更新 Enhanced，并从我的页面重新进入 Biliverse（common 容器）");
    const supported = await Promise.all(["ui.setNavigationHide", "ui.setTitle", "ui.setNavigationButton", "ui.observeNavigationClick"].map(method => this.#bridge.canIUse(method)));
    if (!supported.every(Boolean)) throw new Error("common 容器未提供所需导航能力");
    await this.#bridge.useNative("ui.setNavigationHide", { hide: false });
    if (this.#destroyed) return;
    this.#bridge.addChannel("ui.observeNavigationClick", this.#click);
    this.#subscribed = true;
  }

  /**
   * 串行同步标题和菜单，跳过尚未发送的过期状态。
   * Serialize title/menu updates and skip superseded states before dispatch.
   * @param {{title: string, actions: Array<{id: string, label: string}>, busy: boolean}} state 当前页面状态 / Current page state.
   * @returns {Promise<void>} 同步完成 / Synchronization completed.
   */
  update(state) {
    this.#state = state;
    const revision = ++this.#revision;
    const render = async () => {
      await this.#ready;
      if (this.#destroyed || revision !== this.#revision) return;
      await this.#bridge.useNative("ui.setTitle", { title: state.title });
      if (this.#destroyed || revision !== this.#revision) return;
      const buttons = !state.busy && state.actions.length ? [{ id: "biliverse.more", type: 3, menu: { content: state.actions.map(action => ({ id: action.id, text: action.label })) }, visible: true }] : [];
      await this.#bridge.useNative("ui.setNavigationButton", { buttons });
    };
    this.#queue = this.#queue.then(render, render);
    return this.#queue;
  }

  /**
   * 释放通道并阻止迟到更新。
   * Release the channel and prevent late updates.
   * @returns {void} 无返回值 / No return value.
   */
  destroy() {
    this.#destroyed = true;
    this.#revision++;
    if (this.#subscribed) this.#bridge.removeChannel("ui.observeNavigationClick", this.#click);
  }
}
