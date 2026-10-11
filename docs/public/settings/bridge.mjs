/**
 * 初始化 Bilibili Common WebView 宿主；模块表单与操作菜单由 PreferencePanes 提供。
 * Initialize the Bilibili Common WebView host; PreferencePanes owns forms and the action menu.
 * @param {{menu: import('@nsnanocat/preference-panes/navigation').ActionMenu, back: () => void}} options 共用菜单与返回动作 / Shared menu and back action.
 * @returns {Promise<import('@nsnanocat/preference-panes/browser').Bridge>} 官方原生宿主 / Official native host.
 */
export default async function createBridge({ menu }) {
  const sdk = document.createElement('script');
  sdk.src = 'https://s1.hdslb.com/bfs/seed/jinkela/short/jsb/js-bridge.min.js';
  let bridge;
  let openSchemeSupported;
  try {
    await new Promise((resolve, reject) => {
      sdk.onload = resolve;
      sdk.onerror = () => reject(new Error('Bilibili SDK 加载失败'));
      document.head.append(sdk);
    });
    bridge = window.biliBridge;
    await bridge.initPromise;
    if (!bridge.isWbTypeCommon) throw new Error('Biliverse requires a Bilibili common WebView');
    openSchemeSupported = await bridge.isSupport('ability.openScheme');
    await bridge.useNative('ui.setNavigationHide', { hide: false });
  } catch (error) {
    sdk.remove();
    throw error;
  }
  menu.element.hidden = true;
  document.body.append(menu.element);
  const root = document.documentElement;
  let revision = 0;
  let destroyed = false;
  let state = { title: document.title, actions: [], busy: false };
  const confirmations = new Set();

  /**
   * 应用官方主题事件使用的日夜标记。
   * Apply the day/night markers used by official Bilibili pages.
   * @param {number | string} value 官方主题值 / Official theme value.
   * @returns {void} 无返回值 / No return value.
   */
  function applyTheme(value) {
    const dark = value === 2 || value === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    root.classList.toggle('night-mode', dark);
    root.classList.toggle('bili_dark', dark);
  }
  const onTheme = (result) => {
    if (!destroyed && result.code === 0 && result.data?.theme) applyTheme(result.data.theme);
  };
  const onKeyboard = (result) => {
    if (!destroyed && result.code === 0 && typeof result.data?.status === 'boolean')
      root.style.setProperty('--pp-keyboard-height', `${result.data.status ? result.data.height : 0}px`);
  };
  const onNavigation = (result) => {
    if (!destroyed && result.code === 0 && !state.busy && result.data?.id === 'biliverse.more') menu.open();
  };
  applyTheme(navigator.userAgent.includes('themeId/2') ? 2 : 1);
  bridge.addChannel('ui.observeThemeChange', onTheme, { immediately: true });
  bridge.addChannel('ui.observeKeyboardStatus', onKeyboard);
  bridge.addChannel('ui.observeNavigationClick', onNavigation);

  return {
    /**
     * 将当前项目页面直接同步到官方导航栏。
     * Synchronize the current project view directly with the official navigation bar.
     * @param {object} next 当前页面状态 / Current page state.
     * @returns {Promise<void>} 官方导航已更新 / Official navigation updated.
     */
    async update(next) {
      state = next;
      const current = ++revision;
      await bridge.useNative('ui.setTitle', { title: state.title });
      if (destroyed || current !== revision) return;
      await bridge.useNative('ui.setNavigationButton', {
        buttons: !state.busy && state.actions.length ? [{ id: 'biliverse.more', type: 3, visible: true }] : [],
      });
    },
    confirm(message) {
      return new Promise((resolve, reject) => {
        const finish = (value, error) => {
          if (!confirmations.delete(cancel)) return;
          if (error) reject(error);
          else resolve(value);
        };
        const cancel = () => finish(false);
        confirmations.add(cancel);
        try {
          bridge.callNative({
            method: 'ability.alert',
            data: { type: 'confirm', title: state.title, message, confirmButton: '确定', cancelButton: '取消' },
            onConfirm: () => finish(true),
            onCancel: cancel,
            onNeutral: cancel,
            callback: (result) => {
              if (
                result instanceof Error ||
                result === 'error' ||
                (typeof result?.code === 'number' && result.code !== 0)
              )
                finish(false, new Error('Native confirmation failed'));
            },
          });
        } catch (error) {
          finish(false, error);
        }
      });
    },
    notice(detail) {
      bridge.useNative('liveUI.toast', { type: 'short', msg: detail.message }).catch((error) => {
        if (!destroyed) console.error(error);
      });
    },
    /**
     * 显式新页请求失败时保留当前设置页；未指定方式的旧调用保留原行为。
     * Preserve settings when an explicit new-page request fails; legacy calls keep their existing behavior.
     * @param {string} url 完整目标地址 / Absolute target URL.
     * @param {"_self" | "_blank"} [target] 当前页或新页；省略时使用原宿主路由 / Current or new page; omission keeps the original host route.
     * @returns {void | Promise<void>} 新页的原生响应；其它调用无返回值 / Native response for new pages; other calls return nothing.
     */
    openURL(url, target) {
      switch (target) {
        case '_self':
          return window.location.assign(url);
        case '_blank':
          if (!openSchemeSupported) throw new Error('当前宿主不支持打开新页面');
          return new Promise((resolve, reject) => {
            bridge.callNative({
              method: 'ability.openScheme',
              data: { url },
              callback: (result) => {
                if (destroyed) return resolve();
                if (result instanceof Error || result === 'error' || (typeof result?.code === 'number' && result.code !== 0)) reject(new Error('打开新页面失败'));
                else resolve();
              },
            });
          });
        default:
          if (!openSchemeSupported) return window.location.assign(url);
          try {
            bridge.callNative({
              method: 'ability.openScheme',
              data: { url },
              callback: (result) => {
                if (
                  !destroyed &&
                  (result instanceof Error || result === 'error' || (typeof result?.code === 'number' && result.code !== 0))
                )
                  window.location.assign(url);
              },
            });
          } catch (error) {
            window.location.assign(url);
          }
          break;
      }
    },
    destroy() {
      destroyed = true;
      revision++;
      for (const cancel of confirmations) cancel();
      bridge.removeChannel('ui.observeThemeChange', onTheme);
      bridge.removeChannel('ui.observeKeyboardStatus', onKeyboard);
      bridge.removeChannel('ui.observeNavigationClick', onNavigation);
      root.style.removeProperty('--pp-keyboard-height');
      delete root.dataset.theme;
      root.classList.remove('night-mode', 'bili_dark');
      sdk.remove();
    },
  };
}
