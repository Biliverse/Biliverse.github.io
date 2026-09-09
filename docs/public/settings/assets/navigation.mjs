/**
 * 标题栏共用三点菜单；Shadow DOM 隔离项目样式，保留继承的主题色。
 * Shared title-bar overflow menu; Shadow DOM isolates layout while inheriting theme colors.
 */
class ActionMenu {
    #button;
    #popup;
    #backdrop;
    #select;
    #document;
    #key = event => {
        if (event.key === "Escape" && !this.#popup.hidden) {
            event.preventDefault();
            this.close();
            this.#button.focus();
        }
    };

    /**
     * 创建菜单，操作逻辑由调用方提供。
     * Create a menu whose actions are handled by the caller.
     * @param {(id: string) => void} select 菜单选择回调 / Selection callback.
     */
    constructor(select) {
        this.#document = document;
        this.#select = select;
        this.element = document.createElement("span");
        const root = this.element.attachShadow({ mode: "open" });
        root.innerHTML = `<style>
          :host{display:inline-flex;position:relative;width:44px;height:44px;color:inherit}
          :host([hidden]),[hidden]{display:none!important}
          button{font:inherit;cursor:pointer;border:0;color:inherit;background:none}
          button:disabled{opacity:.4;cursor:default}
          button:focus-visible{outline:2px solid currentColor;outline-offset:-3px}
          #trigger{width:44px;height:44px;padding:10px;position:relative;z-index:3}
          svg{display:block;width:24px;height:24px;fill:currentColor}
          #backdrop{position:fixed;inset:0;z-index:1}
          #items{position:absolute;right:0;top:46px;z-index:2;min-width:160px;padding:6px;background:var(--pp-surface,Canvas);color:var(--pp-text,CanvasText);border:1px solid var(--pp-border,#8884);border-radius:12px;box-shadow:0 8px 28px #0003}
          #items button{display:block;text-align:left;white-space:nowrap;width:100%;padding:11px 14px;border-radius:8px;font:14px/1.4 system-ui,sans-serif}
          #items button:hover{background:#8882}
          #items button[data-danger]{color:#e45656}
        </style><button id="trigger" type="button" aria-label="更多操作" aria-haspopup="menu" aria-expanded="false" aria-controls="items"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="4" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="12" r="2"/></svg></button><button id="backdrop" type="button" tabindex="-1" aria-label="关闭菜单" hidden></button><div id="items" role="menu" hidden></div>`;
        this.#button = root.querySelector("#trigger");
        this.#popup = root.querySelector("#items");
        this.#backdrop = root.querySelector("#backdrop");
        this.#button.onclick = () => {
            const open = this.#popup.hidden;
            this.#popup.hidden = this.#backdrop.hidden = !open;
            this.#button.setAttribute("aria-expanded", String(open));
            if (open) this.#popup.firstElementChild.focus();
        };
        this.#backdrop.onclick = () => this.close();
        this.#popup.onkeydown = event => {
            if (event.key === "Tab") {
                this.close();
                return;
            }
            const items = [...this.#popup.children];
            const index = items.indexOf(root.activeElement);
            const offsets = { ArrowDown: 1, ArrowUp: -1 };
            if (event.key in offsets) {
                event.preventDefault();
                items[(index + offsets[event.key] + items.length) % items.length].focus();
            }
        };
        document.addEventListener("keydown", this.#key);
        this.update([]);
    }

    /**
     * 同步可用操作和忙碌状态，不重建菜单触发按钮。
     * Update actions and busy state without replacing the trigger button.
     * @param {Array<{id: string, label: string, destructive?: boolean}>} items 操作列表 / Actions.
     * @param {boolean} [disabled] 是否忙碌 / Whether operations are busy.
     * @returns {void} 无返回值 / No return value.
     */
    update(items, disabled = false) {
        this.close();
        this.#button.disabled = disabled || items.length === 0;
        this.#popup.replaceChildren(
            ...items.map(item => {
                const button = this.#document.createElement("button");
                button.type = "button";
                button.setAttribute("role", "menuitem");
                button.textContent = item.label;
                button.toggleAttribute("data-danger", Boolean(item.destructive));
                button.onclick = () => {
                    this.close();
                    this.#select(item.id);
                };
                return button;
            }),
        );
    }

    /**
     * 关闭菜单。
     * Close the menu.
     * @returns {void} 无返回值 / No return value.
     */
    close() {
        this.#popup.hidden = this.#backdrop.hidden = true;
        this.#button.setAttribute("aria-expanded", "false");
    }

    /**
     * 移除监听器与节点。
     * Remove listeners and elements.
     * @returns {void} 无返回值 / No return value.
     */
    destroy() {
        this.#document.removeEventListener("keydown", this.#key);
        this.element.remove();
    }
}

/**
 * 统一解析模块页的资源地址：Header 优先于查询参数，再使用模块约定。
 * Resolve module resource locations: headers override query parameters and module conventions.
 * @param {URL} url 已解析的页面请求地址 / Parsed page request URL.
 * @param {Record<string, string | undefined>} [headers] 请求头，名称不区分大小写 / Case-insensitive request headers.
 * @returns {{url: string, module: string, json: string, css: string}} 页面上下文与两个资源输入 / Page context and two resource inputs.
 */
function pageInputs(url, headers = {}) {
    const match = /^\/settings\/([a-zA-Z0-9_-]+)\/?$/.exec(url.pathname);
    if (!match) throw new TypeError("Open a concrete module URL");
    const module = match[1];
    const values = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
    const json = values["x-preferencepanes-json"] ?? url.searchParams.get("json") ?? `/configs/${module}`;
    const css = values["x-preferencepanes-css"] ?? url.searchParams.get("css") ?? "";
    if (!json.trim()) throw new TypeError("JSON resource URL is required");
    return { url: url.href, module, json, css };
}

/**
 * 模块文档容器：原始 HTML 不改写，请求上下文随 iframe 元素传递。
 * Module document container: preserve HTML verbatim and carry request context on the iframe element.
 */
class ModuleFrame extends EventTarget {
    #url;
    #options;
    #controller = new AbortController();
    #abort = () => this.destroy();
    #state;
    #change = event => {
        this.#state = { ...event.detail, actions: event.detail.actions ?? [] };
        this.dispatchEvent(new Event("change"));
    };

    /**
     * 建立 iframe 与请求输入；调用方挂载 element 后调用 load。
     * Create the iframe and request inputs; callers mount element and then call load.
     * @param {string | URL} url 模块请求地址 / Module request URL.
     * @param {RequestInit} [options] 原生请求头和取消信号 / Native headers and cancellation signal.
     */
    constructor(url, options = {}) {
        super();
        this.#url = new URL(url, document.baseURI);
        this.#options = { ...options, headers: new Headers(options.headers) };
        const inputs = pageInputs(this.#url, Object.fromEntries(this.#options.headers));
        this.element = document.createElement("iframe");
        this.element.title = `${inputs.module} 设置`;
        this.element.dataset.preferencePanes = JSON.stringify(inputs);
        this.element.addEventListener("preferencepanes:change", this.#change);
        this.#state = { title: inputs.module, module: inputs.module, busy: false, canGoBack: true, actions: [] };
        options.signal?.addEventListener("abort", this.#abort, { once: true });
    }

    /**
     * 当前模块导航状态。
     * Current module navigation state.
     */
    get state() {
        return { ...this.#state };
    }

    /**
     * 获取原始 HTML；晚到响应在退出后不得重新挂载。
     * Fetch unmodified HTML; a late response must not remount after departure.
     * @returns {Promise<void>} HTML 已交给 iframe；表单状态通过 change 事件提供 / HTML assigned; form state is reported through change.
     */
    async load() {
        if (this.#options.signal?.aborted) this.destroy();
        const timer = setTimeout(() => this.#controller.abort(), 10000);
        try {
            const response = await fetch(this.#url, { cache: "no-store", credentials: "omit", ...this.#options, signal: this.#controller.signal });
            if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            this.#controller.signal.throwIfAborted();
            this.element.srcdoc = html;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * 使用 iframe 的联合历史返回；写入期间不导航。
     * Navigate joint iframe history back, except while a write is pending.
     * @returns {void} 无返回值 / No return value.
     */
    back() {
        if (!this.#state.busy && this.#state.canGoBack) this.element.contentWindow.history.back();
    }

    /**
     * 向模块发送菜单操作，不让宿主访问内部 DOM 或存储客户端。
     * Dispatch a menu action without host access to internal DOM or the storage client.
     * @param {string} id 当前可用操作 / Available action identifier.
     * @returns {void} 无返回值 / No return value.
     */
    perform(id) {
        if (this.#state.busy || !this.#state.actions.some(action => action.id === id)) throw new Error("Action is not available");
        this.element.dispatchEvent(new CustomEvent("preferencepanes:action", { detail: id }));
    }

    /**
     * 取消加载与事件订阅；节点保留到 Navigation 的退出动画结束。
     * Cancel loading and subscriptions; Navigation retains the node until its exit animation ends.
     * @returns {void} 无返回值 / No return value.
     */
    destroy() {
        this.#controller.abort();
        this.#options.signal?.removeEventListener("abort", this.#abort);
        this.element.removeEventListener("preferencepanes:change", this.#change);
    }
}

/**
 * 模块入口的固定状态行，只通过 HEAD 探测安装状态和业务版本。
 * Fixed module status row, probing installation and business version with HEAD only.
 */
class ModuleStatus extends EventTarget {
    #element;
    #controller;
    #state = { status: "checking", version: null };

    /**
     * 绑定调用方提供的状态行。
     * Bind a caller-owned status row.
     * @param {HTMLElement} element 状态文字容器 / Status text container.
     */
    constructor(element) {
        super();
        this.#element = element;
        this.#render("checking");
    }

    /**
     * 当前安装状态与业务版本。
     * Current installation state and business version.
     */
    get state() {
        return { ...this.#state };
    }

    /**
     * 每次进入重新探测，取消旧请求并忽略其迟到结果。
     * Reprobe on entry, cancelling old requests and ignoring late results.
     * @param {string | URL} url 配置 Mock 地址 / Configuration Mock URL.
     * @returns {Promise<void>} 探测完成 / Probe completion.
     */
    async check(url) {
        this.#controller?.abort();
        const controller = (this.#controller = new AbortController());
        this.#render("checking");
        const timer = setTimeout(() => controller.abort(), 3500);
        try {
            const response = await fetch(url, { method: "HEAD", cache: "no-store", credentials: "omit", signal: controller.signal });
            if (controller !== this.#controller) return;
            const version = response.headers.get("X-PreferencePanes-Version")?.trim() || null;
            this.#render(response.status === 200 ? "installed" : "missing", version);
        } catch {
            if (controller === this.#controller) this.#render("missing");
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * 更新状态标签，缺少版本时不伪造版本号。
     * Render the label without inventing a missing version.
     * @param {"checking" | "installed" | "missing"} status 状态 / State.
     * @param {string | null} [version] 业务版本 / Business version.
     * @returns {void} 无返回值 / No return value.
     */
    #render(status, version = null) {
        this.#state = { status, version: status === "installed" ? version : null };
        switch (status) {
            case "checking":
                this.#element.textContent = "检测中";
                break;
            case "installed":
                this.#element.textContent = version ?? "版本未知";
                break;
            case "missing":
                this.#element.textContent = "未安装";
                break;
        }
        this.#element.dataset.state = status;
        this.#element.title = this.#element.textContent;
        this.dispatchEvent(new Event("change"));
    }

    /**
     * 释放尚未完成的探测。
     * Release pending probes.
     * @returns {void} 无返回值 / No return value.
     */
    destroy() {
        this.#controller?.abort();
        this.#controller = undefined;
    }
}

/**
 * 同一文档内的主页/子页导航；iframe 各自的实例通过浏览器联合历史协作。
 * Navigate home/detail views within a document; iframe instances cooperate through joint browser history.
 */
class Navigation extends EventTarget {
    #container;
    #home;
    #create;
    #window;
    #key = null;
    #view;
    #retiring;
    #controller;
    #animation;
    #scroll = new WeakMap();
    #onHistory = () => this.#route();
    #onPageShow = event => {
        if (event.persisted) this.#route(true);
    };

    /**
     * 根视图始终保留；工厂按需提供子页，可用 signal 取消离开后的异步加载。
     * Retain the home view and create details on demand; signal cancels async work after departure.
     * @param {HTMLElement} container 由调用方布局的页面容器 / Caller-styled view container.
     * @param {HTMLElement} home 已创建的主页节点 / Existing home view.
     * @param {(key: string, signal: AbortSignal) => HTMLElement | undefined} create 子页工厂；未知路径返回 undefined / Detail factory; undefined for unknown routes.
     */
    constructor(container, home, create) {
        super();
        this.#container = container;
        this.#home = home;
        this.#create = create;
        this.#window = container.ownerDocument.defaultView;
        container.replaceChildren(home);
        this.#window.addEventListener("popstate", this.#onHistory);
        this.#window.addEventListener("hashchange", this.#onHistory);
        this.#window.addEventListener("pageshow", this.#onPageShow);
        this.#route();
    }

    /**
     * 当前子页键；空字符串表示主页。
     * Current detail key; empty means home.
     */
    get current() {
        return this.#key;
    }

    /**
     * 是否可以返回上一级或先前文档。
     * Whether a parent view or previous document is available.
     */
    get canGoBack() {
        return Boolean(this.#key) || this.#window.history.length > 1;
    }

    /**
     * 加入子页历史；使用文档自身 URL，避免 srcdoc 按宿主 base URL 跳转。
     * Push a detail using the document URL, avoiding srcdoc navigation against the host base URL.
     * @param {string} key 子页键 / Detail key.
     * @returns {void} 无返回值 / No return value.
     */
    open(key) {
        if (key === this.#key) return;
        const url = new URL(this.#window.location.href);
        url.hash = encodeURIComponent(key);
        this.#window.history.pushState({ ...this.#window.history.state, preferencePanesRoute: key }, "", url.href);
        this.#route();
    }

    /**
     * 沿浏览器联合历史返回，根页可退回宿主或上个文档。
     * Go back through joint history, including a host or previous document from home.
     * @returns {void} 无返回值 / No return value.
     */
    back() {
        if (this.canGoBack) this.#window.history.back();
    }

    /**
     * 解析 URL 并统一处理页面切换、加载取消与动画结束后的释放。
     * Resolve the URL and coordinate transitions, cancellation and release after animation.
     * @param {boolean} [reload] 从页面缓存恢复时重新创建子页 / Recreate a detail after bfcache restoration.
     * @returns {void} 无返回值 / No return value.
     */
    #route(reload = false) {
        const url = new URL(this.#window.location.href);
        let key;
        try {
            key = decodeURIComponent(url.hash.slice(1));
        } catch (error) {
            if (!(error instanceof URIError)) throw error;
            key = "";
        }
        if (!reload && key === this.#key) return;
        this.#controller?.abort();
        this.#controller = new AbortController();
        const next = key ? this.#create(key, this.#controller.signal) : undefined;
        if (!next) key = "";
        const history = this.#window.history;
        // 直接打开子页时建立一次主页历史；刷新不重复堆叠。
        // Seed home history once for direct details, without stacking entries on reload.
        if (url.hash && history.state?.preferencePanesRoute !== key) {
            url.hash = "";
            history.replaceState({ ...history.state, preferencePanesRoute: "" }, "", url.href);
            if (key) {
                url.hash = encodeURIComponent(key);
                history.pushState({ ...history.state, preferencePanesRoute: key }, "", url.href);
            }
        }
        const previous = this.#view;
        const position = previous ? this.#window.getComputedStyle(previous).transform : "none";
        this.#animation?.cancel();
        this.#retiring?.remove();
        this.#retiring = previous;
        if (previous) {
            this.#scroll.set(previous, previous.scrollTop);
            previous.inert = true;
        }
        this.#key = key;
        this.#view = next;
        this.#home.inert = Boolean(next);
        if (next) {
            next.inert = false;
            this.#container.append(next);
            next.scrollTop = this.#scroll.get(next) ?? 0;
        }
        const moving = next ?? previous;
        if (moving) {
            const animation = moving.animate([{ transform: next ? "translateX(100%)" : position }, { transform: next ? "translateX(0)" : "translateX(100%)" }], { duration: this.#window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280, easing: "cubic-bezier(.22,.61,.36,1)", fill: "forwards" });
            this.#animation = animation;
            animation.onfinish = () => {
                if (this.#animation !== animation) return;
                this.#retiring?.remove();
                this.#retiring = undefined;
                animation.cancel();
                this.#animation = undefined;
            };
        }
        this.dispatchEvent(new Event("change"));
    }

    /**
     * 释放监听器、加载、动画和节点；调用方可重新创建导航。
     * Release listeners, loads, animations and nodes so callers can recreate navigation.
     * @returns {void} 无返回值 / No return value.
     */
    destroy() {
        this.#window.removeEventListener("popstate", this.#onHistory);
        this.#window.removeEventListener("hashchange", this.#onHistory);
        this.#window.removeEventListener("pageshow", this.#onPageShow);
        this.#controller?.abort();
        this.#animation?.cancel();
        this.#retiring?.remove();
        this.#view?.remove();
        this.#home.remove();
    }
}

export { ActionMenu, ModuleFrame, ModuleStatus, Navigation };
