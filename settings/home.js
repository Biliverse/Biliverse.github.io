import { Navigation, ModuleFrame } from "/settings/assets/navigation.mjs?v=0.8.0";
import { inBilibili, closeBilibili } from "./bilibili.mjs";

// 本站只提供品牌、入口和配置探测；历史、动画、取消与释放由共用导航负责。
// This site supplies branding, entries and probes; shared navigation owns history, motion and lifecycle.
const theme = navigator.userAgent.match(/themeId\/(\d+)/)?.[1];
if (theme) {
  document.documentElement.dataset.theme = theme === "2" ? "dark" : "light";
  for (const source of document.querySelectorAll("picture source")) source.media = theme === "2" ? "all" : "not all";
}
const buttons = [...document.querySelectorAll("button[data-module]")];
const home = document.querySelector(".biliverse-home");
const navbar = document.querySelector("#app-navbar");
const homeBack = navbar.querySelector("button");
const navbarTitle = navbar.querySelector("h1");
const navbarImage = navbar.querySelector(".pp-brand img");
const navbarDark = navbar.querySelector(".pp-brand source");
const homeIcon = { light: navbarImage.getAttribute("src"), dark: navbarDark.getAttribute("srcset") };
const template = document.querySelector("#module-template");
let generation = 0;
let moduleFrame;
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
    "X-PreferencePanes-CSS": "/settings/theme.css",
  } });
  moduleFrame = frame;
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
}

/**
 * 导航到主页时并发探测配置，不读取模块设置。
 * Probe configurations concurrently on home entry without reading module settings.
 * @returns {void} 探测已发起 / Probes started.
 */
function probe() {
  updateNavbar();
  if (navigation.current) return;
  const current = ++generation;
  for (const button of buttons) {
    button.disabled = true;
    const status = button.querySelector(".module-status");
    status.textContent = "检测中";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    fetch(`/configs/${encodeURIComponent(button.dataset.module)}`, { method: "HEAD", cache: "no-store", credentials: "omit", signal: controller.signal })
      .then(response => { if (generation === current) { button.disabled = response.status !== 200; status.textContent = button.disabled ? "未响应" : ""; } })
      .catch(() => { if (generation === current) { button.disabled = true; status.textContent = "未响应"; } })
      .finally(() => clearTimeout(timer));
  }
}
navigation.addEventListener("change", probe);
probe();
