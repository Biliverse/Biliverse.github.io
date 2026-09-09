import { Navigation, ModuleFrame, ModuleStatus, ActionMenu } from "/settings/assets/navigation.mjs?v=0.9.0";
import { inBilibili, closeBilibili, observeAppearance, confirmBilibili, exportCapabilities } from "./bilibili.mjs?v=official-ui-1";

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
const navbar = document.querySelector("#app-navbar");
const homeBack = navbar.querySelector("button");
const navbarTitle = navbar.querySelector("h1");
const navbarImage = navbar.querySelector(".pp-brand img");
const navbarDark = navbar.querySelector(".pp-brand source");
const homeIcon = { light: navbarImage.getAttribute("src"), dark: navbarDark.getAttribute("srcset") };
const template = document.querySelector("#module-template");
const statuses = buttons.map(button => {
  const status = new ModuleStatus(button.querySelector(".module-status"));
  status.addEventListener("change", () => { button.disabled = status.state.status !== "installed"; });
  return { button, status };
});
let moduleFrame;
const actionMenu = new ActionMenu(id => moduleFrame.perform(id));
navbar.querySelector(".home-nav-spacer").append(actionMenu.element);
actionMenu.element.hidden = true;
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
    "X-PreferencePanes-CSS": "/settings/theme.css?v=0.9.0",
  } });
  moduleFrame = frame;
  if (inBilibili()) frame.addEventListener("confirm", event => {
    event.preventDefault();
    confirmBilibili(event.detail.message).then(event.detail.resolve, event.detail.reject);
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
homeBack.onclick = async () => {
  if (navigation.current) { moduleFrame.back(); return; }
  if (!inBilibili()) { navigation.back(); return; }
  try { await closeBilibili(); }
  catch (error) { window.alert(error.message); }
};
// 挂载后观察大图标，滚出导航栏下方的可见区域时切换到栏中央小图标。
// Observe the mounted hero icon and show its centered compact variant once it scrolls past the bar.
const brandObserver = new IntersectionObserver(([entry]) => navbar.toggleAttribute("data-compact", !entry.isIntersecting), {
  rootMargin: `-${navbar.getBoundingClientRect().height}px 0px 0px 0px`,
});
brandObserver.observe(home.querySelector(".brand-logo"));
for (const button of buttons) button.onclick = () => navigation.open(button.dataset.module);

/**
 * 在常驻顶栏同步标题与图标，子页沿用当前模块图标。
 * Synchronize title and icon in the persistent bar, retaining module branding in child views.
 * @returns {void} 无返回值 / No return value.
 */
function updateNavbar() {
  const module = navigation.current;
  const button = module ? buttons.find(button => button.dataset.module === module) : null;
  navbar.toggleAttribute("data-module", Boolean(module));
  navbarTitle.textContent = module ? moduleFrame.state.title : "Biliverse";
  navbarImage.src = button ? button.querySelector("img").getAttribute("src") : homeIcon.light;
  navbarDark.srcset = button ? button.querySelector("source").getAttribute("srcset") : homeIcon.dark;
  navbarImage.alt = module ? "" : "Biliverse";
  homeBack.disabled = module ? !moduleFrame.state.canGoBack : !navigation.canGoBack && !inBilibili();
  const actions = module ? moduleFrame.state.actions : [];
  actionMenu.element.hidden = actions.length === 0;
  actionMenu.update(actions, Boolean(module && moduleFrame.state.busy));
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
