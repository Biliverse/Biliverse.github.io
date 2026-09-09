// 定制入口只探测 JSON，不载入模块渲染器或读取持久化设置。
// The custom landing page only probes JSON, without loading module renderers or persistence.
const theme = navigator.userAgent.match(/themeId\/(\d+)/)?.[1];
if (theme) {
  document.documentElement.dataset.theme = theme === "2" ? "dark" : "light";
  for (const source of document.querySelectorAll("picture source")) source.media = theme === "2" ? "all" : "not all";
}
const buttons = [...document.querySelectorAll("button[data-module]")];
let generation = 0;
for (const button of buttons) button.onclick = () => { location.href = button.dataset.page; };

/**
 * 每次进入独立首页并发探测各配置 Mock。
 * Probe configuration Mocks concurrently whenever the standalone landing page is entered.
 * @returns {void} 探测已发起 / Probes started.
 */
function probe() {
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
probe();
window.addEventListener("pageshow", event => { if (event.persisted) probe(); });
