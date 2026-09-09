import { Navigation } from "/settings/assets/navigation.mjs";

// 本站只提供品牌、入口和配置探测；历史、动画、取消与释放由共用导航负责。
// This site supplies branding, entries and probes; shared navigation owns history, motion and lifecycle.
const theme = navigator.userAgent.match(/themeId\/(\d+)/)?.[1];
if (theme) {
  document.documentElement.dataset.theme = theme === "2" ? "dark" : "light";
  for (const source of document.querySelectorAll("picture source")) source.media = theme === "2" ? "all" : "not all";
}
const buttons = [...document.querySelectorAll("button[data-module]")];
const home = document.querySelector(".biliverse-home");
const homeBack = home.querySelector(".home-navbar button");
const navbar = home.querySelector(".home-navbar");
const template = document.querySelector("#module-template");
let generation = 0;
const navigation = new Navigation(document.querySelector("#pages"), home, (module, signal) => {
  const button = buttons.find(button => button.dataset.module === module);
  if (!button) return;
  const host = template.content.firstElementChild.cloneNode(true);
  const message = host.querySelector(".module-message");
  const status = host.querySelector("[role=status]");
  host.querySelector("button").onclick = () => navigation.back();
  status.textContent = "正在打开设置…";
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 10000);
  (async () => {
    try {
      const response = await fetch(button.dataset.page, {
        cache: "no-store", credentials: "omit", signal: controller.signal,
        headers: {
          "X-PreferencePanes-JSON": `/configs/${module}`,
          "X-PreferencePanes-CSS": "/settings/theme.css",
        },
      });
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (signal.aborted) return;
      const frame = document.createElement("iframe");
      frame.title = `${module} 设置`;
      frame.srcdoc = html;
      frame.onload = () => { message.hidden = true; };
      host.append(frame);
    } catch (error) {
      if (signal.aborted) return;
      status.textContent = controller.signal.aborted ? "加载超时，请返回后重试" : `无法打开设置：${error.message}`;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  })();
  return host;
});
homeBack.onclick = () => navigation.back();
// 挂载后观察大图标，滚出导航栏下方的可见区域时切换到栏中央小图标。
// Observe the mounted hero icon and show its centered compact variant once it scrolls past the bar.
const brandObserver = new IntersectionObserver(([entry]) => navbar.toggleAttribute("data-compact", !entry.isIntersecting), {
  rootMargin: `-${navbar.getBoundingClientRect().height}px 0px 0px 0px`,
});
brandObserver.observe(home.querySelector(".brand-logo"));
for (const button of buttons) button.onclick = () => navigation.open(button.dataset.module);

/**
 * 导航到主页时并发探测配置，不读取模块设置。
 * Probe configurations concurrently on home entry without reading module settings.
 * @returns {void} 探测已发起 / Probes started.
 */
function probe() {
  homeBack.disabled = !navigation.canGoBack;
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
