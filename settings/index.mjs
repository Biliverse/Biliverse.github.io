import { ActionMenu, ModuleFrame, ModuleStatus, Navigation } from '/settings/assets/navigation.mjs';

const bridge = window.biliBridge;
await bridge.initPromise;
if (!bridge.isWbTypeCommon) throw new Error('Biliverse requires a Bilibili common WebView');

const root = document.documentElement;
const container = document.querySelector('[data-preference-panes-pages]');
const home = document.querySelector('[data-preference-panes-home]');
const template = document.querySelector('template[data-preference-panes-module]');
const buttons = [...home.querySelectorAll('[data-module][data-page][data-json]')];
let frame;
let navigationRevision = 0;
let navigationState = { title: document.title, actions: [], busy: false };
const menu = new ActionMenu((id) => frame.perform(id));

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

applyTheme(navigator.userAgent.includes('themeId/2') ? 2 : 1);
bridge.addChannel(
  'ui.observeThemeChange',
  (result) => {
    if (result.code === 0 && result.data?.theme) applyTheme(result.data.theme);
  },
  { immediately: true },
);
bridge.addChannel('ui.observeKeyboardStatus', (result) => {
  if (result.code === 0 && typeof result.data?.status === 'boolean')
    root.style.setProperty('--pp-keyboard-height', `${result.data.status ? result.data.height : 0}px`);
});

/**
 * 将当前项目页面直接同步到官方导航栏。
 * Synchronize the current project view directly with the official navigation bar.
 * @returns {Promise<void>} 官方导航已更新 / Official navigation updated.
 */
async function updateNavigation() {
  navigationState = navigation.current ? frame.state : { title: document.title, actions: [], busy: false };
  menu.update(navigationState.actions, navigationState.busy);
  const revision = ++navigationRevision;
  await bridge.useNative('ui.setTitle', { title: navigationState.title });
  if (revision !== navigationRevision) return;
  await bridge.useNative('ui.setNavigationButton', {
    buttons:
      !navigationState.busy && navigationState.actions.length
        ? [
            {
              id: 'biliverse.more',
              type: 3,
              visible: true,
            },
          ]
        : [],
  });
}

bridge.addChannel('ui.observeNavigationClick', (result) => {
  if (result.code !== 0 || navigationState.busy) return;
  if (result.data?.id === 'biliverse.more') menu.open();
});

const navigation = new Navigation(container, home, (module, signal) => {
  const button = buttons.find((button) => button.dataset.module === module);
  if (!button) return;
  const page = template.content.firstElementChild.cloneNode(true);
  const message = page.querySelector('[data-module-message]');
  frame = new ModuleFrame(button.dataset.page, {
    signal,
    headers: {
      'X-PreferencePanes-JSON': button.dataset.json,
      ...(button.dataset.css ? { 'X-PreferencePanes-CSS': button.dataset.css } : {}),
    },
  });
  frame.addEventListener('confirm', (event) => {
    event.preventDefault();
    bridge.callNative({
      method: 'ability.alert',
      data: {
        type: 'confirm',
        title: navigationState.title,
        message: event.detail.message,
        confirmButton: '确定',
        cancelButton: '取消',
      },
      onConfirm: () => event.detail.resolve(true),
      onCancel: () => event.detail.resolve(false),
      onNeutral: () => event.detail.resolve(false),
      callback: (result) => {
        if (result instanceof Error || result === 'error') event.detail.reject(new Error('Native confirmation failed'));
      },
    });
  });
  frame.addEventListener('notice', (event) => {
    event.preventDefault();
    bridge.useNative('liveUI.toast', { type: 'short', msg: event.detail.message });
  });
  frame.addEventListener('change', updateNavigation);
  frame.element.onload = () => {
    message.hidden = true;
  };
  page.append(frame.element);
  frame.load().catch((error) => {
    if (!signal.aborted) message.textContent = error.message;
  });
  return page;
});

const statuses = buttons.map((button) => {
  const status = new ModuleStatus(button.querySelector('[data-module-status]'));
  status.addEventListener('change', () => {
    button.disabled = status.state.status !== 'installed';
  });
  button.addEventListener('click', () => navigation.open(button.dataset.module));
  return { button, status };
});

/**
 * 每次回到主页重新探测全部模块配置。
 * Probe every module configuration whenever the landing page is entered.
 * @returns {void} 无返回值 / No return value.
 */
function probe() {
  updateNavigation();
  if (navigation.current) return;
  for (const { button, status } of statuses) status.check(button.dataset.json);
}

bridge.useNative('ui.setNavigationHide', { hide: false });
navigation.addEventListener('change', probe);
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  for (const { status } of statuses) status.destroy();
  menu.destroy();
  navigation.destroy();
});
probe();
