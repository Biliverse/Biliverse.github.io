const modules = /* MODULES */;
const logo = /* LOGO */;
const viewport = document.querySelector("#content");
let content;
const title = document.querySelector("#title");
const back = document.querySelector("#back");
let current, busy = false, revision = 0, toastTimer;
const pathModule = location.pathname.match(/^\/settings\/(Enhanced|Global|Redirect|ADBlock)\/$/)?.[1] ?? "";
const screens = new Map();
const moduleData = new Map();
let route = location.hash.slice(1) || pathModule;
let historyIndex = 0;
let activeScreen;
history.replaceState({ settingsIndex: 0, settingsRoute: route }, "", route ? `#${route}` : location.pathname);
const uaTheme = navigator.userAgent.match(/themeId\/(\d+)/);
if (uaTheme) document.documentElement.dataset.theme = uaTheme[1] === "2" ? "dark" : "light";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function themedImage(variants, className, alt) {
  const picture = element("picture", className);
  const source = element("source");
  source.media = uaTheme ? (uaTheme[1] === "2" ? "all" : "not all") : "(prefers-color-scheme: dark)";
  source.srcset = variants.dark;
  const image = element("img"); image.src = variants.light; image.alt = alt;
  picture.append(source, image);
  return picture;
}

function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2800);
}

async function probe(module) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`/settings/api/${module}`, { method: "HEAD", cache: "no-store", credentials: "omit", headers: { "X-Biliverse-Settings": "1" }, signal: controller.signal });
    return response.ok;
  } catch { return false; }
  finally { clearTimeout(timer); }
}

async function api(module, values) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`/settings/api/${module}`, {
      method: values ? "POST" : "GET", cache: "no-store", credentials: "omit", signal: controller.signal,
      headers: { "X-Biliverse-Settings": "1", ...(values ? { "Content-Type": "application/json" } : {}) },
      ...(values ? { body: JSON.stringify({ values }) } : {}),
    });
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error(`未连接到 ${module}，请安装或更新对应插件并启用 HTTPS 解密。`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `请求失败（${response.status}）`);
    if (values ? result.saved !== true : result.module !== module) throw new Error(`未连接到 ${module} 的本地设置接口。`);
    return result;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("连接超时，请检查对应插件是否已启用。");
    throw error;
  } finally { clearTimeout(timer); }
}

function row(name, subtitle) {
  const node = element("div", "form-row");
  const text = element("div", "form-row__text");
  text.append(element("span", "form-row__title", name));
  if (subtitle) text.append(element("span", "form-row__subtitle", subtitle));
  node.append(text);
  return node;
}

function group(name) {
  const section = element("section", "form-group");
  if (name) section.append(element("h2", "form-group__title", name));
  const rows = element("div", "form-group__row");
  section.append(rows);
  content.append(section);
  return rows;
}

async function save(field, value) {
  if (busy) return false;
  const module = current.module;
  const savingRoute = route;
  busy = true;
  content.querySelectorAll("button,input").forEach(node => { node.disabled = true; });
  const values = { ...current.values, [field.key]: value };
  if (field.key !== "Storage") values.Storage = "PersistentStore";
  try {
    await api(module, values);
    const updated = await api(module);
    moduleData.set(module, updated);
    for (const key of screens.keys()) if (key === module || key.startsWith(`${module}/`)) screens.delete(key);
    if (route !== savingRoute) return false;
    current = updated;
    toast(values.Storage === "PersistentStore" ? "已保存，下次请求生效" : "已切换配置来源");
    return true;
  } catch (error) { toast(error.message); return false; }
  finally {
    busy = false;
    content.querySelectorAll("button,input").forEach(node => { node.disabled = false; });
  }
}

function showHome() {
  title.textContent = "Biliverse";
  const brand = element("div", "brand");
  const image = themedImage(logo, "brand-logo", "Biliverse");
  brand.append(image, element("h2", "", "Biliverse"), element("p", "", "哔哩哔哩功能优化及增强"));
  content.append(brand);
  const section = element("section", "self-panel is-zh");
  section.append(element("h2", "header", "插件"));
  const container = element("div", "container");
  const scrollView = element("div", "scroll-view");
  const rows = element("div", "scroll");
  scrollView.append(rows); container.append(scrollView); section.append(container); content.append(section);
  for (const module of modules) {
    const link = element("a", "self-item is-zh"); link.dataset.module = module.name;
    link.setAttribute("role", "link"); link.setAttribute("aria-label", module.name); link.title = module.description;
    link.setAttribute("aria-disabled", "true"); link.classList.add("module-disabled");
    const icon = themedImage(module.icon, "logo", "");
    const status = element("span", "module-status", "检测中");
    link.append(icon, element("span", "name", module.name), status); rows.append(link);
    checkModule(link, status, module.name);
  }
  content.append(element("p", "source", "设置仅保存在当前代理工具中"));
}

function checkModule(link, status, name) {
    const version = revision;
    link.removeAttribute("href"); link.setAttribute("aria-disabled", "true"); link.classList.add("module-disabled"); status.textContent = "检测中";
    probe(name).then(available => {
      if (version !== revision) return;
      if (available) {
        link.href = `#${name}`;
        link.removeAttribute("aria-disabled"); link.classList.remove("module-disabled");
        status.textContent = "";
        return;
      }
      link.removeAttribute("href"); link.setAttribute("aria-disabled", "true"); link.classList.add("module-disabled");
      status.textContent = "未响应";
    });
}

function showModule() {
  title.textContent = current.module;
  const mode = current.values.Storage;
  content.append(element("p", "notice", mode === "PersistentStore" ? "正在使用本地设置。修改会在插件的下一次请求中生效。" : "正在使用模块参数或默认配置。保存下面的选项后将改为使用本地设置；可在“配置类型”中切换回来。"));
  const groups = new Map();
  for (const field of current.fields) {
    const match = field.name.match(/^\[([^\]]+)\]\s*(.*)$/);
    const heading = match?.[1] ?? "通用";
    if (!groups.has(heading)) groups.set(heading, group(heading));
    const item = row(match?.[2] ?? field.name, field.description);
    const value = current.values[field.key];
    if (field.type === "boolean") {
      const toggle = element("button", `v-toggle v-toggle--small${value ? "" : " v-toggle--closed"}`);
      toggle.setAttribute("role", "switch"); toggle.setAttribute("aria-checked", String(value)); toggle.setAttribute("aria-label", field.name);
      toggle.append(element("span", "v-toggle__circle"));
      toggle.onclick = async () => { if (await save(field, !value)) { content.replaceChildren(); showModule(); activeScreen.data = current; screens.set(route, activeScreen); } };
      item.append(toggle);
      groups.get(heading).append(item);
    } else {
      const selected = field.options ? field.options.filter(option => Array.isArray(value) ? value.includes(option.key) : option.key === value).map(option => option.label).join("、") : String(value ?? "");
      item.append(element("span", "form-row__value", field.key === "Storage" ? ({ Argument: "模块参数", PersistentStore: "本地设置", database: "默认配置" }[value] ?? value) : selected || "未选择"), element("span", "chevron", "›"));
      const link = element("a"); link.href = `#${current.module}/${encodeURIComponent(field.key)}`; link.append(item);
      groups.get(heading).append(link);
    }
  }
}

function showEditor(field) {
  title.textContent = field.name.replace(/^\[[^\]]+\]\s*/, "");
  content.append(element("p", "note", field.description));
  const value = current.values[field.key];
  let read;
  if (field.options) {
    const rows = group("");
    const inputs = [];
    for (const option of field.options) {
      const label = element("label", "choice");
      const item = row(option.label);
      const input = element("input"); input.type = field.type === "array" ? "checkbox" : "radio"; input.name = field.key;
      input.checked = Array.isArray(value) ? value.includes(option.key) : value === option.key;
      input.setAttribute("aria-label", option.label);
      inputs.push({ input, value: option.key }); item.append(input); label.append(item); rows.append(label);
    }
    read = () => field.type === "array" ? inputs.filter(item => item.input.checked).map(item => item.value) : inputs.find(item => item.input.checked)?.value;
  } else {
    const box = element("div", "editor");
    const input = element("input", "text-input"); input.type = field.type === "number" ? "number" : "text"; input.value = value ?? "";
    input.setAttribute("aria-label", field.name); input.maxLength = 2048; box.append(input); content.append(box);
    read = () => field.type === "number" ? Number(input.value) : input.value;
  }
  const button = element("button", "primary", "保存");
  button.onclick = async () => { if (await save(field, read())) goBack(); };
  content.append(button);
}

async function render(direction = 0) {
  const version = ++revision;
  const [module, key] = route.split("/");
  if (module && !modules.some(item => item.name === module)) { navigate("", true); return; }
  const previous = activeScreen;
  if (previous) { previous.title = title.textContent; previous.scroll = previous.node.scrollTop; }
  let screen = screens.get(route);
  const cached = Boolean(screen);
  if (!screen) {
    screen = { node: element("div", "settings-screen"), title: module || "Biliverse", data: null };
    screens.set(route, screen);
  }
  activeScreen = screen; content = screen.node; current = screen.data;
  for (const node of viewport.children) {
    for (const animation of node.getAnimations()) animation.cancel();
    if (node !== previous?.node) node.remove();
  }
  viewport.append(content);
  content.scrollTop = screen.scroll ?? 0;
  if (previous && previous.node !== content) {
    previous.node.inert = true;
    previous.node.setAttribute("aria-hidden", "true");
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260;
    const options = { duration, easing: "cubic-bezier(.22,.61,.36,1)" };
    const exit = previous.node.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-direction * 100}%)` }], options);
    content.animate([{ transform: `translateX(${direction * 100}%)` }, { transform: "translateX(0)" }], options);
    exit.onfinish = () => { if (previous !== activeScreen) previous.node.remove(); };
  }
  content.inert = false; content.removeAttribute("aria-hidden");
  viewport.dataset.direction = direction < 0 ? "back" : "forward";
  back.hidden = !module;
  title.textContent = screen.title;
  if (cached) {
    if (!module) for (const link of content.querySelectorAll("[data-module]")) checkModule(link, link.querySelector(".module-status"), link.dataset.module);
    return;
  }
  if (!module) { current = undefined; showHome(); return; }
  title.textContent = module;
  content.append(element("p", "notice", "正在读取本地设置…"));
  try {
    const result = moduleData.get(module) ?? await api(module);
    moduleData.set(module, result);
    if (version !== revision) return;
    current = result; screen.data = result; content.replaceChildren();
    if (!key) showModule();
    else {
      const field = current.fields.find(item => item.key === decodeURIComponent(key));
      if (field) showEditor(field); else navigate(module, true);
    }
    screen.title = title.textContent;
  } catch (error) {
    if (version !== revision) return;
    content.replaceChildren(element("p", "notice error", error.message));
    const retry = element("button", "primary", "重新连接"); retry.onclick = () => { screens.delete(route); render(); }; content.append(retry);
  }
}

function navigate(next, replace = false) {
  if (busy) return;
  if (activeScreen && !activeScreen.data && route) screens.delete(route);
  if (!replace) historyIndex++;
  history[replace ? "replaceState" : "pushState"]({ settingsIndex: historyIndex, settingsRoute: next }, "", next ? `#${next}` : "/settings/");
  route = next;
  render(replace ? -1 : 1);
}
function goBack() {
  if (busy) return;
  if (historyIndex > 0) history.back();
  else navigate(route.includes("/") ? route.split("/")[0] : "", true);
}
back.onclick = goBack;
viewport.addEventListener("click", event => {
  const link = event.target.closest("a[href^='#']");
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); navigate(link.hash.slice(1));
});
window.addEventListener("popstate", event => {
  const nextIndex = event.state?.settingsIndex ?? 0;
  if (activeScreen && !activeScreen.data && route) screens.delete(route);
  const direction = nextIndex < historyIndex ? -1 : 1;
  historyIndex = nextIndex; route = event.state?.settingsRoute ?? location.hash.slice(1);
  render(direction);
});
window.addEventListener("pageshow", event => { if (event.persisted && !route) render(); });
render();
