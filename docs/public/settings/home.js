import { Navigation, ModuleFrame, ModuleStatus } from "/settings/assets/navigation.mjs?v=0.9.3";
import { inBilibili, NativeNavigation, observeAppearance, confirmBilibili, toastBilibili, exportCapabilities } from "./bilibili.mjs?v=0.9.3";

// 本站只提供品牌、入口和配置探测；历史、动画、取消与释放由共用导航负责。
// This site supplies branding, entries and probes; shared navigation owns history, motion and lifecycle.
observeAppearance({
  theme: ({ theme, night }) => {
    const dark = theme === 2 || night === 1;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.classList.toggle("bili_dark", dark);
    for (const source of document.querySelectorAll("picture source")) source.media = dark ? "all" : "not all";
  },
  keyboard: height => document.documentElement.style.setProperty("--pp-keyboard-height", `${height}px`),
}).catch(error => console.error("Bilibili appearance subscription failed", error));
const exportButton = document.querySelector("#export-capabilities");
exportButton.hidden = !inBilibili();
exportButton.onclick = async () => {
  const status = document.querySelector("#export-status");
  exportButton.disabled = true;
  try {
    await exportCapabilities();
    status.textContent = "能力清单已复制，可粘贴分享。";
  } catch (error) { status.textContent = error.message; }
  finally { exportButton.disabled = false; }
};
const buttons = [...document.querySelectorAll("button[data-module]")];
const home = document.querySelector(".biliverse-home");
const template = document.querySelector("#module-template");
const statuses = buttons.map(button => {
  const status = new ModuleStatus(button.querySelector(".module-status"));
  status.addEventListener("change", () => { button.disabled = status.state.status !== "installed"; });
  return { button, status };
});
let moduleFrame;
const nativeNavigation = inBilibili() ? new NativeNavigation(id => moduleFrame.perform(id), reportNavigationError) : null;
window.addEventListener("pagehide", event => { if (!event.persisted) nativeNavigation?.destroy(); });
const navigation = new Navigation(document.querySelector("#pages"), home, (module, signal) => {
  const button = buttons.find(button => button.dataset.module === module);
  if (!button) return;
  const host = template.content.firstElementChild.cloneNode(true);
  const message = host.querySelector(".module-message");
  const status = host.querySelector("[role=status]");
  host.querySelector("button").onclick = () => navigation.back();
  status.textContent = "正在打开设置…";
  const frame = new ModuleFrame(button.dataset.page, { signal, headers: {
    "X-PreferencePanes-JSON": `/configs/${module}`,
    "X-PreferencePanes-CSS": "/settings/theme.css?v=0.9.3",
  } });
  moduleFrame = frame;
  if (inBilibili()) frame.addEventListener("confirm", event => {
    event.preventDefault();
    confirmBilibili(event.detail.message).then(event.detail.resolve, event.detail.reject);
  });
  if (inBilibili()) frame.addEventListener("notice", event => {
    event.preventDefault();
    toastBilibili(event.detail.message).catch(error => window.alert(error.message));
  });
  frame.addEventListener("change", () => {
    updateNavbar();
  });
  frame.element.onload = () => { message.hidden = true; };
  host.append(frame.element);
  frame.load().catch(error => {
    if (!signal.aborted) status.textContent = `无法打开设置：${error.message}`;
  });
  return host;
});
for (const button of buttons) button.onclick = () => navigation.open(button.dataset.module);

/**
 * 原生栏同步当前标题与操作，图标保留在正文。
 * Synchronize native titles/actions while keeping logos in page content.
 * @returns {void} 已提交更新 / Update submitted.
 */
function updateNavbar() {
  const state = navigation.current ? moduleFrame.state : { title: "Biliverse", actions: [], busy: false };
  document.title = state.title;
  nativeNavigation?.update(state).catch(reportNavigationError);
}

/**
 * 显示客户端能力错误，不创建第二套导航栏。
 * Surface client capability errors without creating a second navigation bar.
 * @param {Error} error 错误 / Error.
 * @returns {void} 无返回值 / No return value.
 */
function reportNavigationError(error) {
  console.error(error);
  const message = document.querySelector("#navigation-error");
  message.textContent = `原生导航不可用：${error.message}`;
  message.hidden = false;
}

/**
 * 导航到主页时并发探测配置，不读取模块设置。
 * Probe configurations concurrently on home entry without reading module settings.
 * @returns {void} 探测已发起 / Probes started.
 */
function probe() {
  updateNavbar();
  if (navigation.current) return;
  for (const { button, status } of statuses) status.check(`/configs/${encodeURIComponent(button.dataset.module)}`);
}
navigation.addEventListener("change", probe);
probe();
