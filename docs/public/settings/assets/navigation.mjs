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

export { Navigation };
