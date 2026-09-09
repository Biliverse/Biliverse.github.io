/**
 * 解析已经取得的 pathname，避免重复构造 URL。
 * Parse an existing pathname without constructing another URL.
 * @param {string} pathname 以 / 开头的 URL pathname / URL pathname beginning with /.
 * @returns {string[] | undefined} 解码后的路径，非 API 路径不处理 / Decoded path, or undefined outside /api/.
 * @throws {TypeError} 转义编码或路径片段非法 / Invalid percent encoding or path segments.
 */

/**
 * 校验原始路径片段，不进行 URL 编码转换。
 * Validate raw path segments without URL encoding conversion.
 * @param {string[]} parts 原始路径片段 / Raw path segments.
 * @returns {string[]} 同一数组，不复制或修改 / The same array without copying or mutation.
 * @throws {TypeError} 空片段、非法字符或原型属性名 / Empty segments, invalid characters or prototype property names.
 */
function validatePathParts(parts) {
    if (!parts.every(part => typeof part === "string" && /^[a-zA-Z0-9_-]+$/.test(part) && !["__proto__", "prototype", "constructor"].includes(part))) throw new TypeError("Invalid key path");
    return parts;
}

/**
 * BoxJS 的共同目录：模块、存储根和展示元数据都来自同一份 JSON。
 * Shared BoxJS catalog deriving modules, storage roots and metadata from one JSON document.
 */
class BoxJS {
    /**
     * 建立路径索引，不解析控件类型，也不读写持久化存储。
     * Index field paths without interpreting controls or accessing persistence.
     * @param {unknown} input 字段数组、单个 app 或 apps 订阅 / Field array, app or apps subscription.
     */
    constructor(input) {
        if (!input || typeof input !== "object") throw new TypeError("Expected BoxJS JSON");
        this.document = JSON.parse(JSON.stringify(input));
        const apps = Array.isArray(this.document) ? [{ settings: this.document }] : (this.document.apps ?? [this.document]);
        if (!Array.isArray(apps)) throw new TypeError("Expected BoxJS apps array");
        this.modules = new Map();
        for (const app of apps) {
            if (!app || !Array.isArray(app.settings)) throw new TypeError("Expected BoxJS settings array");
            for (const entry of app.settings) {
                if (typeof entry.id !== "string") throw new TypeError("BoxJS settings require string IDs");
                if (!entry.id.startsWith("@")) {
                    if (Array.isArray(this.document)) throw new TypeError("BoxJS settings require @root.path IDs");
                    continue;
                }
                const [storageKey, ...parts] = entry.id.slice(1).split(".");
                if (!storageKey || storageKey.startsWith("@") || parts.length < 2) throw new TypeError("A BoxJS setting must be below a literal storage root and module");
                validatePathParts(parts);
                const module = parts[0];
                let target = this.modules.get(module);
                if (!target) {
                    target = { module, storageKey, entries: [], owners: new Set() };
                    this.modules.set(module, target);
                }
                if (target.storageKey !== storageKey) throw new TypeError(`A module must use one storage root: ${module}`);
                target.entries.push(entry);
                target.owners.add(app);
            }
        }
        this.metadata = metadata(Array.isArray(this.document) ? {} : this.document);
        for (const target of this.modules.values()) target.metadata = target.owners.size === 1 ? metadata([...target.owners][0]) : {};
    }

    /**
     * 提取一个模块的原生 BoxJS，保留所属 app 的元数据。
     * Select a module's native BoxJS while retaining owning-app metadata.
     * @param {string} module 模块标识 / Module identifier.
     * @returns {unknown} 可直接用作配置 Mock 的 JSON / JSON suitable for a configuration Mock.
     */
    select(module) {
        const target = this.modules.get(module);
        if (!target) throw new TypeError(`No BoxJS settings for module: ${module}`);
        if (Array.isArray(this.document)) return target.entries;
        const apps = [...target.owners].map(app => ({ ...app, settings: app.settings.filter(entry => target.entries.includes(entry)) }));
        return this.document.apps ? { ...this.document, apps } : apps[0];
    }

    /**
     * 取得本次导入的唯一模块，避免把模块数据变成项目目录。
     * Get the single imported module without turning module data into a project directory.
     * @returns {object} 唯一模块的目录项 / The single module entry.
     */
    get module() {
        if (this.modules.size !== 1) throw new TypeError("Import BoxJS JSON for exactly one module");
        return this.modules.values().next().value;
    }
}

/**
 * 保留标准 BoxJS 展示信息；script 仅为元数据，不执行。
 * Retain standard BoxJS presentation data; script is metadata only and never executed.
 * @param {object} source BoxJS app 或订阅 / BoxJS app or subscription.
 * @returns {object} 经过类型检查的展示信息 / Type-checked presentation metadata.
 */
function metadata(source) {
    const result = {};
    for (const key of ["id", "name", "author", "repo", "script", "icon", "description", "desc", "icons", "descs"]) {
        if (source[key] === undefined) continue;
        const multiple = key === "icons" || key === "descs";
        const values = multiple ? source[key] : [source[key]];
        if (!Array.isArray(values) || values.some(item => typeof item !== "string")) throw new TypeError(`Invalid BoxJS app ${key}`);
        result[key] = multiple ? [...values] : source[key];
    }
    return result;
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
    const css = values["x-preferencepanes-css"] ?? url.searchParams.get("css") ?? `/settings/assets/${module}.css`;
    if (!json.trim()) throw new TypeError("JSON resource URL is required");
    return { url: url.href, module, json, css };
}

/**
 * 创建元素，所有展示文本通过 textContent 写入。
 * Create elements and assign display text through textContent only.
 * @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag 元素标签 / Element tag.
 * @param {string} className 样式类名 / CSS class.
 * @param {string} [text] 纯文本 / Plain text.
 * @returns {HTMLElementTagNameMap[T]} 创建的元素 / Created element.
 */
function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * 元数据地址只允许 HTTP(S) 和相对地址。
 * Allow only HTTP(S) and relative metadata addresses.
 * @param {string} value 元数据地址 / Metadata address.
 * @returns {string} 完整地址 / Absolute address.
 */
function resourceURL(value) {
    const url = new URL(value, document.baseURI);
    if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("Metadata URLs must use HTTP(S)");
    return url.href;
}

/**
 * 展示标准 BoxJS 图标；icons 保持透明/彩色语义，不解释为亮暗版本。
 * Display standard BoxJS icons, preserving transparent/color rather than light/dark semantics.
 * @param {import("../index.js").BoxJSMetadata} metadata 展示信息 / Presentation metadata.
 * @param {string} className 样式 / CSS class.
 * @returns {HTMLImageElement | null} 图标或无图标 / Icon or no icon.
 */
function icon(metadata, className) {
    const source = metadata.icon || metadata.icons?.[1] || metadata.icons?.[0];
    if (!source) return null;
    const image = element("img", className);
    image.src = resourceURL(source);
    image.alt = "";
    return image;
}

/**
 * 共享加载失败视图，不创建配置表单或数据读取。
 * Share a load-error view without creating controls or reading settings.
 * @param {Error} error 失败原因 / Failure reason.
 * @param {() => unknown} retry 重试动作 / Retry action.
 * @returns {HTMLElement} 错误视图 / Error view.
 */
function errorView(error, retry) {
    const view = element("section", "pp-error");
    const button = element("button", "", "重新读取");
    button.type = "button";
    button.onclick = retry;
    view.append(element("p", "", `加载失败：${error.message}`), button);
    return view;
}

var defaults = "/* 分组列表沿用 Bilibili 设置页的行结构，样式限定在面板内。\n * Grouped rows follow the Bilibili settings layout, scoped to the panel. */\n.pp-panel {\n    --pp-text: #18191c;\n    --pp-background: #f6f7f8;\n    --pp-surface: #fff;\n    --pp-border: #e3e5e7;\n    --pp-muted: #9499a0;\n    --pp-accent: #fb7299;\n    font:\n        15px / 1.5 -apple-system,\n        BlinkMacSystemFont,\n        \"Segoe UI\",\n        sans-serif;\n    color: var(--pp-text);\n    background: var(--pp-background);\n    position: relative;\n    min-height: 100vh;\n}\n.pp-panel * {\n    box-sizing: border-box;\n    letter-spacing: 0;\n}\n.pp-header {\n    height: calc(52px + env(safe-area-inset-top));\n    padding: env(safe-area-inset-top) 12px 0;\n    display: flex;\n    align-items: center;\n    background: var(--pp-surface);\n    border-bottom: 1px solid var(--pp-border);\n    position: sticky;\n    top: 0;\n    z-index: 1;\n}\n.pp-title {\n    font-size: 17px;\n    font-weight: 500;\n    margin: 0;\n    min-width: 0;\n    overflow-wrap: anywhere;\n}\n.pp-brand {\n    flex: 1;\n    min-width: 0;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;\n    text-align: center;\n}\n.pp-brand-icon {\n    display: none;\n    flex: none;\n    width: 28px;\n    height: 28px;\n}\n.pp-brand-icon:not(:empty) {\n    display: block;\n}\n.pp-brand-icon img {\n    display: block;\n    width: 100%;\n    height: 100%;\n    object-fit: contain;\n}\n.pp-nav-spacer {\n    width: 44px;\n    flex: none;\n}\n.pp-panel button {\n    font: inherit;\n    cursor: pointer;\n    border: 0;\n    background: none;\n    color: inherit;\n}\n.pp-panel .pp-back {\n    width: 44px;\n    height: 44px;\n    flex: none;\n    font-size: 34px;\n    line-height: 32px;\n    padding: 0;\n}\n.pp-panel button:disabled {\n    opacity: 0.5;\n    cursor: wait;\n}\n.pp-viewport {\n    position: relative;\n    height: calc(100vh - 52px - env(safe-area-inset-top));\n    overflow: hidden;\n}\n@supports (height: 100dvh) {\n    .pp-viewport {\n        height: calc(100dvh - 52px - env(safe-area-inset-top));\n    }\n}\n.pp-fields,\n.pp-choice-page {\n    position: absolute;\n    inset: 0;\n    overflow: auto;\n    padding: 12px max(16px, calc((100% - 688px) / 2)) calc(28px + env(safe-area-inset-bottom));\n    background: var(--pp-background);\n}\n.pp-panel .form-group {\n    margin: 0 0 12px;\n}\n.pp-panel .form-group__title {\n    font-size: 12px;\n    line-height: 17px;\n    font-weight: 400;\n    color: var(--pp-muted);\n    padding-left: 12px;\n    margin: 12px 0 6px;\n}\n.pp-panel .form-group__row {\n    border-radius: 8px;\n    overflow: hidden;\n    background: var(--pp-surface);\n}\n.pp-panel .form-row {\n    position: relative;\n    display: flex;\n    align-items: center;\n    width: 100%;\n    min-height: 46px;\n    padding: 12px;\n    border: 0;\n    border-bottom: 1px solid var(--pp-border);\n    background: var(--pp-surface);\n    gap: 12px;\n}\n.pp-panel .form-row:last-child {\n    border-bottom: 0;\n}\n.pp-panel .form-row__text {\n    flex: 1;\n    min-width: 0;\n    margin: 0;\n    display: flex;\n    flex-direction: column;\n}\n.pp-panel .form-row__title {\n    font-size: 15px;\n    line-height: 22px;\n    color: var(--pp-text);\n    text-align: left;\n}\n.pp-panel .form-row__subtitle {\n    font-size: 12px;\n    line-height: 18px;\n    color: var(--pp-muted);\n    overflow-wrap: anywhere;\n    margin-top: 2px;\n}\n.pp-choice-link {\n    display: flex;\n    align-items: center;\n    justify-content: flex-end;\n    gap: 8px;\n    max-width: 45%;\n    min-width: 44px;\n    min-height: 44px;\n    padding: 0;\n    text-align: right;\n    flex: 1;\n}\n.pp-summary {\n    color: var(--pp-muted);\n    font-size: 13px;\n    line-height: 18px;\n    display: -webkit-box;\n    -webkit-line-clamp: 2;\n    -webkit-box-orient: vertical;\n    overflow: hidden;\n    overflow-wrap: anywhere;\n}\n.pp-chevron {\n    color: var(--pp-muted);\n    font-size: 22px;\n    flex: none;\n}\n.pp-input {\n    font: inherit;\n    color: var(--pp-text);\n    background: var(--pp-surface);\n    border: 1px solid var(--pp-border);\n    border-radius: 6px;\n    padding: 8px;\n    min-width: 0;\n    max-width: 45%;\n    width: 45%;\n}\nselect.pp-input {\n    text-overflow: ellipsis;\n    font-size: 13px;\n}\n.pp-panel .pp-multiline {\n    display: block;\n}\n.pp-multiline .pp-input {\n    max-width: 100%;\n    width: 100%;\n    margin-top: 10px;\n}\n.pp-switch {\n    appearance: none;\n    -webkit-appearance: none;\n    position: relative;\n    flex: none;\n    width: 32px;\n    height: 20px;\n    max-width: none;\n    border: 0;\n    border-radius: 15px;\n    padding: 0;\n    background: #c9ccd0;\n    cursor: pointer;\n    transition: background 0.2s;\n}\n.pp-switch::before {\n    content: \"\";\n    position: absolute;\n    top: 3px;\n    left: 3px;\n    width: 14px;\n    height: 14px;\n    border-radius: 50%;\n    background: white;\n    transition: transform 0.2s;\n}\n.pp-switch:checked {\n    background: var(--pp-accent);\n}\n.pp-switch:checked::before {\n    transform: translateX(12px);\n}\n.pp-choice {\n    justify-content: space-between;\n    cursor: pointer;\n}\n.pp-choice input {\n    width: 20px;\n    height: 20px;\n    flex: none;\n    accent-color: var(--pp-accent);\n    margin: 0;\n}\n.pp-description {\n    font-size: 12px;\n    line-height: 1.6;\n    color: var(--pp-muted);\n    white-space: pre-wrap;\n    overflow-wrap: anywhere;\n}\n.pp-module-info {\n    display: flex;\n    gap: 12px;\n    margin: 12px 0;\n}\n.pp-module-icon {\n    width: 48px;\n    height: 48px;\n    object-fit: contain;\n    flex: none;\n}\n.pp-module-details {\n    min-width: 0;\n    overflow-wrap: anywhere;\n}\n.pp-module-source {\n    color: inherit;\n    text-decoration: underline;\n}\n.pp-maintenance {\n    margin-top: 24px;\n}\n.pp-actions {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 8px;\n}\n.pp-actions button,\n.pp-error button {\n    min-height: 44px;\n    padding: 8px 12px;\n    border-radius: 6px;\n    background: var(--pp-surface);\n}\n.pp-panel .pp-danger {\n    color: #e45656;\n}\n.pp-cache {\n    max-height: 320px;\n    overflow: auto;\n    white-space: pre-wrap;\n    overflow-wrap: anywhere;\n}\n.pp-toast {\n    pointer-events: none;\n    position: fixed;\n    bottom: calc(30px + env(safe-area-inset-bottom));\n    left: 50%;\n    transform: translateX(-50%);\n    max-width: 90vw;\n    padding: 10px 16px;\n    border-radius: 8px;\n    background: #333e;\n    color: white;\n    font-size: 13px;\n    z-index: 20;\n}\n.pp-toast[data-kind=\"error\"] {\n    background: #8d2424;\n}\n.pp-panel :focus-visible {\n    outline: 2px solid var(--pp-accent);\n    outline-offset: -2px;\n}\n@media (prefers-color-scheme: dark) {\n    .pp-panel {\n        --pp-text: #e3e5e7;\n        --pp-background: #17181a;\n        --pp-surface: #232427;\n        --pp-border: #343538;\n    }\n}\n:root[data-theme=\"dark\"] .pp-panel {\n    --pp-text: #e3e5e7;\n    --pp-background: #17181a;\n    --pp-surface: #232427;\n    --pp-border: #343538;\n}\n:root[data-theme=\"light\"] .pp-panel {\n    --pp-text: #18191c;\n    --pp-background: #f6f7f8;\n    --pp-surface: #fff;\n    --pp-border: #e3e5e7;\n}\n@media (prefers-reduced-motion: reduce) {\n    .pp-panel .pp-switch,\n    .pp-panel .pp-switch::before {\n        transition: none;\n    }\n}\n";

/**
 * 将 BoxJS 数组、app 或订阅转换为模块字段，保留原文件为唯一字段来源。
 * Normalize a BoxJS array, app or subscription using the source JSON as the field authority.
 * @param {unknown} config BoxJS JSON / BoxJS document.
 * @param {string} module API 第一段模块名 / First API path segment.
 * @returns {import("../index.js").ModuleDefinition} 存储根和字段 / Storage root and fields.
 * @throws {TypeError} 配置结构、字段路径、默认值或展示属性无效 / Invalid configuration, field path, default or presentation attribute.
 */
function normalizeBoxJs(config, module) {
    validatePathParts([module]);
    const target = new BoxJS(config).modules.get(module);
    if (!target) throw new TypeError(`No BoxJS settings for module: ${module}`);
    const { entries, storageKey, metadata } = target;
    const fields = [];
    for (const entry of entries) {
        const parts = entry.id.slice(1).split(".").slice(1);
        const type = { boolean: "boolean", checkboxes: "array", selects: "select", text: "string", textarea: "string", number: "number" }[entry.type];
        if (!type) throw new TypeError(`Unsupported BoxJS control: ${entry.type}`);
        const field = {
            key: parts.join("."),
            type: type === "select" ? typeof entry.val : type,

            name: entry.name,
            description: entry.desc ?? "",
            control: entry.type,
            ...(entry.placeholder === undefined ? {} : { placeholder: entry.placeholder }),
            ...(entry.rows === undefined ? {} : { rows: entry.rows }),
            ...(entry.autoGrow === undefined ? {} : { autoGrow: entry.autoGrow }),
        };
        if (type === "select" && !["string", "number", "boolean"].includes(field.type)) throw new TypeError(`Select requires a scalar val: ${entry.id}`);
        if (entry.items) field.options = entry.items.map(item => ({ key: item.key, label: item.label }));
        if (Object.hasOwn(entry, "val")) field.defaultValue = normalizeStoredValue(field, entry.val);
        if (
            typeof field.name !== "string" ||
            (field.placeholder !== undefined && typeof field.placeholder !== "string") ||
            (field.rows !== undefined && (!Number.isInteger(field.rows) || field.rows < 1)) ||
            (field.autoGrow !== undefined && typeof field.autoGrow !== "boolean") ||
            fields.some(other => other.key === field.key || other.key.startsWith(`${field.key}.`) || field.key.startsWith(`${other.key}.`))
        )
            throw new TypeError(`Invalid or overlapping BoxJS field: ${entry.id}`);
        if (field.options && (new Set(field.options.map(item => item.key)).size !== field.options.length || field.options.some(item => !scalar(item.key) || typeof item.label !== "string"))) throw new TypeError(`Invalid options: ${entry.id}`);
        if (Object.hasOwn(field, "defaultValue") && !validValue(field, field.defaultValue)) throw new TypeError(`Invalid BoxJS val: ${entry.id}`);
        fields.push(field);
    }
    if (!fields.length) throw new TypeError(`No BoxJS settings for module: ${module}`);
    const common = fields[0].key.split(".").slice(0, -1);
    for (const field of fields) while (!field.key.startsWith(`${common.join(".")}.`)) common.pop();
    return {
        module,
        storageKey,
        fields,
        settingsPath: common,
        ...(Object.keys(metadata).length ? { metadata } : {}),
    };
}

/**
 * 归一化 BoxJS 的字符串存储值，不改变普通文本内容。
 * Normalize BoxJS string persistence without changing free-text values.
 * @param {import("../index.js").SettingsField} field 前端字段约束 / Frontend field constraints.
 * @param {unknown} value 存储值 / Stored value.
 * @returns {unknown} 转换后的控件值；是否允许写入由 validValue 单独校验 / Converted control value; write eligibility is checked separately by validValue.
 */
function normalizeStoredValue(field, value) {
    switch (field.type) {
        case "boolean":
            if (value === "true" || value === "false") return value === "true";
            break;
        case "number":
            if (typeof value === "string" && value.trim() !== "") return Number(value);
            break;
        case "array":
            if (typeof value === "string") value = value === "" || value === "[]" ? [] : value.split(",");
            break;
    }
    if (field.options) {
        const match = item => field.options.find(option => String(option.key) === String(item))?.key ?? item;
        return field.type === "array" && Array.isArray(value) ? value.map(match) : match(value);
    }
    return value;
}

/**
 * 校验支持的标量范围，包括文本长度与数值有限性。
 * Validate supported scalar bounds, including text length and numeric finiteness.
 * @param {unknown} value 待检查值 / Value to inspect.
 * @returns {boolean} 是否为有效标量 / Whether the scalar is valid.
 */
function scalar(value) {
    switch (typeof value) {
        case "boolean":
            return true;
        case "string":
            return value.length <= 2048;
        case "number":
            return Number.isFinite(value);
        default:
            return false;
    }
}

/**
 * 检查值类型、数组唯一性及声明的选项，不进行转换。
 * Check value type, array uniqueness and declared choices without coercion.
 * @param {import("../index.js").SettingsField} field 前端归一化字段 / Normalized frontend field.
 * @param {unknown} value 待写入的 JSON 值 / JSON value to write.
 * @returns {boolean} 是否符合字段约束 / Whether the value satisfies field constraints.
 */
function validValue(field, value) {
    if (field.type === "array") {
        if (!Array.isArray(value) || value.some(item => !scalar(item)) || new Set(value).size !== value.length) return false;
    } else if (typeof value !== field.type || !scalar(value)) return false;
    return !field.options || (field.type === "array" ? value : [value]).every(item => field.options.some(option => option.key === item));
}

/**
 * 单个模块的临时会话；离开页面后丢弃。
 * Transient module session discarded when leaving the page.
 * @typedef {object} ModuleSession
 * @property {AbortController} controller 读取请求的取消控制器 / Abort controller for reads.
 * @property {import("../index.js").ModuleDefinition | null} definition 加载完成的配置，加载中为 null / Loaded configuration, or null while loading.
 * @property {import("./client.mjs").ModuleSnapshot["values"]} values 当前显示值 / Current display values.
 * @property {boolean} saving 是否正在写入 / Whether a mutation is in progress.
 */

/**
 * 创建页面会话缓存；打开时重读，选项操作仅在 HTTP 200 后更新缓存。
 * Create a page-session cache; reload on open and mutate cache only after HTTP 200.
 * @param {import("./client.mjs").PreferencesClientOptions} options 包内目录、请求与通知 / Internal catalog, requests and notifications.
 * @returns {import("./client.mjs").PreferencesClient} 通用客户端 / Generic client.
 */
function createPreferencesClient({ catalog, fetch: request = globalThis.fetch.bind(globalThis), notify = () => {}, timeout = 10000 }) {
    /**
     * 模块会话表
     * Module session map.
     * @type {Map<string, ModuleSession>}
     */
    const sessions = new Map();
    /**
     * 发送同源请求，处理超时与取消；数据 GET 的 404 交给调用方处理。
     * Send a same-origin request with timeout and cancellation; callers handle missing-data GET responses.
     * @param {string} path 相对请求路径 / Relative request path.
     * @param {"HEAD" | "GET" | "POST" | "DELETE"} method HTTP 方法 / HTTP method.
     * @param {unknown} body POST 值，其它方法忽略 / POST value, ignored by other methods.
     * @param {AbortSignal | undefined} signal 会话取消信号 / Session cancellation signal.
     * @returns {Promise<Response>} 未消费正文的响应 / Response with an unread body.
     * @throws {Error} 非 200 且非数据 GET 404、超时、取消或网络错误 / Non-200 status except missing-data GETs, timeout, cancellation or network error.
     */
    async function send(path, method, body, signal) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (signal?.aborted) abort();
        signal?.addEventListener("abort", abort, { once: true });
        const timer = setTimeout(abort, timeout);
        try {
            const response = await request(path, {
                method,
                credentials: "omit",
                cache: "no-store",
                signal: controller.signal,
                headers: { "X-Settings-Client": "1", ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
                ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
            });
            if (response.status !== 200 && !(method === "GET" && response.status === 404)) throw new Error(`HTTP ${response.status}`);
            return response;
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
        }
    }
    /**
     * 获取独立快照，避免调用方修改内部缓存。
     * Return an independent snapshot so callers cannot mutate the cache.
     * @param {string} module 已打开模块 / Open module.
     * @returns {import("./client.mjs").ModuleSnapshot} 会话快照 / Session snapshot.
     * @throws {Error} 模块未完成加载 / Module has not finished loading.
     */
    const snapshot = module => {
        const state = sessions.get(module);
        if (!state?.definition) throw new Error("Open the module first");
        return structuredClone({ definition: state.definition, values: state.values });
    };
    /**
     * 串行修改单键，仅成功后更新仍存活的会话。
     * Serialize single-key mutations and update a still-active session only after success.
     * @param {string} module 已打开模块 / Open module.
     * @param {string} key 完整点分字段路径 / Complete dotted field path.
     * @param {"POST" | "DELETE"} method 写入或删除 / Write or delete.
     * @param {unknown} value 写入值，删除时忽略 / Write value, ignored for deletion.
     * @param {"write" | "delete" | "clearCaches" | "reset"} [operation] 操作类型 / Operation kind.
     * @returns {Promise<void>} 操作完成 / Operation completion.
     * @throws {Error} 会话、字段、值或请求错误 / Session, field, value or request error.
     */
    async function change(module, key, method, value, operation = method === "POST" ? "write" : "delete") {
        const state = sessions.get(module);
        if (!state?.definition) throw new Error("Open the module first");
        if (state.saving) throw new Error("A settings write is already in progress");
        const field = state.definition.fields.find(field => field.key === key);
        state.saving = true;
        try {
            if ((operation === "write" || operation === "delete") && (!field || (method === "POST" && !validValue(field, value)))) throw new TypeError("Invalid setting value");
            await send(`/api/${key.split(".").map(encodeURIComponent).join("/")}`, method, value);
            if (sessions.get(module) === state) {
                switch (operation) {
                    case "write":
                        state.values[key] = structuredClone(value);
                        break;
                    case "delete":
                    case "clearCaches":
                    case "reset":
                        for (const candidate of state.definition.fields) {
                            if (candidate.key !== key && !candidate.key.startsWith(`${key}.`)) continue;
                            delete state.values[candidate.key];
                            if (Object.hasOwn(candidate, "defaultValue")) state.values[candidate.key] = structuredClone(candidate.defaultValue);
                        }
                        break;
                }
            }
            notify({ kind: "success", operation, module, key });
        } catch (error) {
            notify({ kind: "error", operation, module, key, message: error.message });
            throw error;
        } finally {
            state.saving = false;
        }
    }
    return {
        /**
         * 从已导入的 JSON 创建新会话，只读取一次设置值。
         * Create a session from imported JSON and read stored settings once.
         * @param {string} module 模块标识 / Module identifier.
         * @returns {Promise<import("./client.mjs").ModuleSnapshot>} 新快照 / New snapshot.
         * @throws {Error} 读取失败、会话被替换或写入尚未完成 / Read failure, replaced session or unfinished write.
         */
        async open(module) {
            const binding = catalog.modules.get(module);
            if (!binding) throw new TypeError(`No BoxJS settings for module: ${module}`);
            const previous = sessions.get(module);
            if (previous?.saving) throw new Error("Cannot refresh while saving");
            previous?.controller.abort();
            const state = { controller: new AbortController(), definition: null, values: {}, saving: false };
            sessions.set(module, state);
            try {
                const definition = normalizeBoxJs(catalog.select(module), module);
                const response = await send(`/api/${definition.settingsPath.map(encodeURIComponent).join("/")}/`, "GET", undefined, state.controller.signal);
                let subtree = response.status === 404 ? {} : await response.json();
                if (typeof subtree === "string") subtree = JSON.parse(subtree);
                if (!subtree || typeof subtree !== "object" || Array.isArray(subtree)) throw new TypeError("Expected a settings subtree object");
                if (sessions.get(module) !== state) throw new Error("Module session was replaced");
                state.definition = definition;
                for (const field of definition.fields) {
                    const stored = field.key
                        .split(".")
                        .slice(definition.settingsPath.length)
                        .reduce((parent, part) => Object(parent)[part], subtree);
                    const value = stored === undefined ? field.defaultValue : stored;
                    if (value !== undefined) state.values[field.key] = normalizeStoredValue(field, value);
                }
                return snapshot(module);
            } catch (error) {
                if (sessions.get(module) === state) sessions.delete(module);
                throw error;
            }
        },
        snapshot,
        /**
         * 按需读取模块 Caches，不自动读取其它设置。
         * Read module Caches on demand without refreshing other settings.
         * @param {string} module 已打开的模块 / Open module.
         * @returns {Promise<unknown>} 缓存值，缺失为 undefined / Cache value, or undefined when absent.
         */
        async readCaches(module) {
            const state = sessions.get(module);
            if (!state?.definition) throw new Error("Open the module first");
            const response = await send(`/api/${encodeURIComponent(module)}/Caches`, "GET", undefined, state.controller.signal);
            return response.status === 404 ? undefined : response.json();
        },
        /**
         * 删除整个 Caches 节点，成功后不追加 GET。
         * Delete the entire Caches node without a follow-up GET.
         * @param {string} module 已打开模块 / Open module.
         * @returns {Promise<void>} 清理完成 / Cleanup completion.
         */
        clearCaches: module => change(module, `${module}.Caches`, "DELETE", undefined, "clearCaches"),
        /**
         * 删除整个模块持久化节点，以当前 BoxJS 默认值重置页面缓存。
         * Delete module persistence and reset the page cache using current BoxJS defaults.
         * @param {string} module 已打开模块 / Open module.
         * @returns {Promise<void>} 重置完成 / Reset completion.
         */
        reset: module => change(module, module, "DELETE", undefined, "reset"),
        /**
         * 取消读取并清除会话，不撤销已发送的写入。
         * Abort reads and clear the session without undoing dispatched writes.
         * @param {string} module 模块标识 / Module identifier.
         * @returns {void} 无返回值 / No return value.
         */
        leave(module) {
            sessions.get(module)?.controller.abort();
            sessions.delete(module);
        },
        /**
         * 写入单键并更新当前会话。
         * Write one key and update the current session.
         * @param {string} module 已打开模块 / Open module.
         * @param {string} key 点分字段路径 / Dotted field path.
         * @param {import("../index.js").SettingsScalar | import("../index.js").SettingsScalar[]} value 字段值 / Field value.
         * @returns {Promise<void>} 写入完成 / Write completion.
         */
        set: (module, key, value) => change(module, key, "POST", value),
        /**
         * 删除单键覆盖值并显示默认值。
         * Delete one override and display its default value.
         * @param {string} module 已打开模块 / Open module.
         * @param {string} key 点分字段路径 / Dotted field path.
         * @returns {Promise<void>} 删除完成 / Delete completion.
         */
        remove: (module, key) => change(module, key, "DELETE"),
    };
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

/**
 * 挂载已导入 BoxJS 对应的模块表单和短暂通知。
 * Mount the imported BoxJS module form and transient notifications.
 * @param {HTMLElement} root 包内挂载元素 / Internal mount element.
 * @param {import("../BoxJS.mjs").BoxJS} catalog 包内 BoxJS 目录 / Internal BoxJS catalog.
 * @returns {import("./index.js").MountedPreferences} 面板生命周期句柄 / Panel lifecycle handle.
 */
function mountPanel(root, catalog) {
    const title = catalog.module.metadata.name ?? catalog.module.module;
    const document = root.ownerDocument;
    const window = document.defaultView;
    const shell = element("div", "pp-panel");
    shell.dataset.module = catalog.module.module;
    const header = element("header", "pp-header");
    const back = element("button", "pp-back", "‹");
    back.setAttribute("aria-label", "返回");
    back.type = "button";
    const heading = element("h1", "pp-title", title);
    const brand = element("div", "pp-brand");
    const logo = element("span", "pp-brand-icon");
    logo.setAttribute("aria-hidden", "true");
    const image = icon(catalog.module.metadata, "");
    if (image) logo.append(image);
    brand.append(logo, heading);
    const viewport = element("div", "pp-viewport");
    const toast = element("div", "pp-toast");
    toast.setAttribute("role", "status");
    toast.hidden = true;
    header.append(back, brand, element("span", "pp-nav-spacer"));
    shell.append(header, viewport, toast);
    root.append(shell);
    let timer,
        navigation,
        generation = 0,
        active = null,
        saving = false,
        destroyed = false;
    /**
     * 展示短暂通知，不刷新设置数据。
     * Display a transient notification without refreshing settings.
     * @param {{kind: "success" | "error", operation?: "write" | "delete" | "clearCaches" | "reset", message?: string}} event 操作结果 / Operation result.
     * @returns {void} 无返回值 / No return value.
     */
    const notify = event => {
        if (destroyed) return;
        switch (true) {
            case event.kind === "error":
                toast.textContent = `操作失败：${event.message}`;
                break;
            case event.operation === "delete":
                toast.textContent = "删除成功";
                break;
            case event.operation === "clearCaches":
                toast.textContent = "Caches 已清空";
                break;
            case event.operation === "reset":
                toast.textContent = "模块已重置";
                break;
            default:
                toast.textContent = "修改成功";
                break;
        }
        toast.dataset.kind = event.kind;
        toast.hidden = false;
        clearTimeout(timer);
        timer = setTimeout(() => {
            toast.hidden = true;
        }, 2400);
    };
    const client = createPreferencesClient({ catalog, notify });
    /**
     * 打开模块并忽略已过期的异步结果。
     * Open a module and ignore stale asynchronous results.
     * @param {string} module 模块标识 / Module identifier.
     * @returns {Promise<void>} 视图加载完成，失败显示错误视图 / View load completion; failures display an error view.
     */
    async function open(module) {
        const version = ++generation;
        active = module;
        back.disabled = window.history.length <= 1;
        heading.textContent = module;
        viewport.replaceChildren(element("p", "pp-loading", "读取设置…"));
        try {
            await client.open(module);
            if (version === generation) controls();
        } catch (error) {
            if (version !== generation) return;
            viewport.replaceChildren(errorView(error, () => open(module)));
        }
    }
    /**
     * 从会话快照创建控件与操作按钮，不重新读取网络配置。
     * Build controls and actions from the session snapshot without fetching config again.
     * @returns {void} 无返回值 / No return value.
     */
    function controls() {
        const { definition, values } = client.snapshot(active);
        heading.textContent = definition.metadata?.name || active;
        const view = element("section", "pp-fields");
        /**
         * 挂载后执行的多行高度更新
         * Textarea sizing callbacks run after mounting.
         * @type {Array<() => void>}
         */
        const growingInputs = [];
        const editors = new Map();
        const summaries = [];
        const groups = new Map();
        let queue = Promise.resolve(),
            pendingWrites = 0;
        /**
         * 导航组件处理页面切换，表单只更新当前标题与返回按钮。
         * Let navigation own transitions; the form only updates the title and back button.
         * @returns {void} 无返回值 / No return value.
         */
        const updateNavigation = () => {
            const editor = editors.get(navigation.current);
            heading.textContent = editor?.title ?? definition.metadata?.name ?? active;
            back.disabled = saving || !navigation.canGoBack;
        };
        /**
         * 串行执行模块操作，保持输入可编辑。
         * Serialize module actions while keeping inputs editable.
         * @param {() => Promise<void>} action 请求或写入 / Request or mutation.
         * @param {() => void} success 成功后的局部更新 / Local update after success.
         * @param {() => void} [failure] 失败后恢复当前输入 / Restore the current input on failure.
         * @returns {Promise<void>} 操作完成 / Operation completion.
         */
        function perform(action, success, failure = () => {}) {
            pendingWrites++;
            saving = true;
            back.disabled = true;
            return (queue = queue
                .then(action)
                .then(() => {
                    if (!destroyed) success();
                })
                .catch(() => {
                    /* 请求层已通知错误。
                     * The request layer has already reported the error. */
                    if (!destroyed) failure();
                })
                .finally(() => {
                    pendingWrites--;
                    saving = pendingWrites > 0;
                    if (destroyed && !saving) client.leave(active);
                    back.disabled = saving || !navigation.canGoBack;
                }));
        }
        const metadata = definition.metadata;
        if (metadata) {
            const info = element("div", "pp-module-info");
            const image = icon(metadata, "pp-module-icon");
            if (image) info.append(image);
            const details = element("div", "pp-module-details");
            for (const description of [metadata.author, metadata.desc ?? metadata.description, ...(metadata.descs ?? [])]) if (description) details.append(element("p", "pp-description", description));
            if (metadata.repo) {
                const link = element("a", "pp-module-source", "项目主页");
                link.href = resourceURL(metadata.repo);
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                details.append(link);
            }
            info.append(details);
            view.append(info);
        }
        for (const field of definition.fields) {
            const match = /^\[([^\]]+)\]\s*(.*)$/.exec(field.name);
            const group = match?.[1] ?? "通用";
            if (!groups.has(group)) {
                const section = element("section", "form-group");
                const rows = element("div", "form-group__row");
                section.append(element("h2", "form-group__title", group), rows);
                groups.set(group, rows);
                view.append(section);
            }
            const row = element("div", "form-row pp-field");
            const label = element("div", "form-row__text");
            label.append(element("span", "form-row__title", match?.[2] ?? field.name));
            if (field.description) label.append(element("span", "form-row__subtitle", field.description));
            row.append(label);
            const value = values[field.key];
            /**
             * 读取尚未保存的输入
             * Read the unsaved input.
             * @type {() => unknown}
             */
            let read;
            /**
             * 更新当前控件
             * Update the current control.
             * @type {(value: unknown) => void}
             */
            let write;
            let inputContainer = row;
            let eventName = "change";
            switch (true) {
                case Boolean(field.options) && field.type !== "array": {
                    const select = element("select", "pp-input");
                    select.setAttribute("aria-label", field.name);
                    field.options.forEach((option, index) => {
                        const item = element("option", "", option.label);
                        item.value = String(index);
                        select.append(item);
                    });
                    write = value => {
                        select.selectedIndex = field.options.findIndex(option => option.key === value);
                    };
                    row.append(select);
                    read = () => field.options[select.selectedIndex]?.key;
                    break;
                }
                case field.type === "array" && Boolean(field.options): {
                    const page = element("section", "pp-choice-page");
                    if (field.description) page.append(element("p", "pp-description", field.description));
                    const choices = element("div", "form-group__row");
                    page.append(choices);
                    inputContainer = choices;
                    editors.set(field.key, { node: page, title: match?.[2] ?? field.name });
                    const summary = element("span", "form-row__value pp-summary");
                    const link = element("button", "pp-choice-link");
                    link.type = "button";
                    link.setAttribute("aria-label", field.name);
                    link.append(summary, element("span", "pp-chevron", "›"));
                    row.append(link);
                    const refresh = () => {
                        const value = client.snapshot(active).values[field.key];
                        summary.textContent =
                            field.options
                                .filter(option => Array.isArray(value) && value.includes(option.key))
                                .map(option => option.label)
                                .join("、") || "未选择";
                    };
                    summaries.push(refresh);
                    refresh();
                    link.onclick = () => navigation.open(field.key);
                    row.addEventListener("click", event => {
                        if (!link.contains(event.target)) link.click();
                    });
                    const inputs = field.options.map(option => {
                        const label = element("label", "form-row pp-choice", option.label);
                        const input = element("input", "");
                        input.type = "checkbox";
                        input.setAttribute("aria-label", option.label);
                        label.append(input);
                        choices.append(label);
                        return { input, key: option.key };
                    });
                    read = () => inputs.filter(option => option.input.checked).map(option => option.key);
                    write = value => {
                        for (const option of inputs) option.input.checked = Array.isArray(value) && value.includes(option.key);
                    };
                    break;
                }
                default: {
                    const multiline = field.control === "textarea" || field.type === "array";
                    const input = element(multiline ? "textarea" : "input", "pp-input");
                    if (multiline) row.classList.add("pp-multiline");
                    input.setAttribute("aria-label", field.name);
                    if (field.placeholder) input.placeholder = field.placeholder;
                    if (multiline && field.rows) input.rows = field.rows;
                    /**
                     * 在挂载后根据内容调整高度，同时保留基础行数。
                     * Size mounted textareas to their contents while retaining baseline rows.
                     * @returns {void} 无返回值 / No return value.
                     */
                    const grow = () => {
                        if (!multiline || !field.autoGrow || !input.isConnected) return;
                        input.style.height = "auto";
                        const baseline = input.getBoundingClientRect().height;
                        const style = window.getComputedStyle(input);
                        const borders = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
                        input.style.height = `${Math.max(baseline, input.scrollHeight + borders)}px`;
                    };
                    if (multiline && field.autoGrow) {
                        input.addEventListener("input", grow);
                        growingInputs.push(grow);
                    }
                    if (field.type === "boolean") {
                        input.type = "checkbox";
                        input.classList.add("pp-switch");
                        input.setAttribute("role", "switch");
                        write = value => {
                            input.checked = value === true;
                        };
                        read = () => input.checked;
                    } else {
                        eventName = "input";
                        if (!multiline) input.type = field.type === "number" ? "number" : "text";
                        write = value => {
                            input.value = field.type === "array" ? JSON.stringify(value ?? []) : (value ?? "");
                            grow();
                        };
                        read = () => {
                            switch (field.type) {
                                case "array":
                                    return JSON.parse(input.value);
                                case "number":
                                    return input.value === "" ? Number.NaN : Number(input.value);
                                default:
                                    return input.value;
                            }
                        };
                    }
                    row.append(input);
                    break;
                }
            }
            write(value);
            let inputVersion = 0;
            inputContainer.addEventListener(eventName, event => {
                if (event.isComposing) return;
                const version = ++inputVersion,
                    module = active;
                let value;
                try {
                    value = read();
                } catch (error) {
                    notify({ kind: "error", message: error.message });
                    return;
                }
                const restore = () => {
                    if (version === inputVersion) write(client.snapshot(module).values[field.key]);
                };
                perform(
                    () => client.set(module, field.key, value),
                    () => {
                        for (const refresh of summaries) refresh();
                    },
                    restore,
                );
            });
            if (eventName === "input") inputContainer.addEventListener("compositionend", event => event.target.dispatchEvent(new window.Event("input", { bubbles: true })));
            groups.get(group).append(row);
        }
        const maintenance = element("section", "pp-maintenance");
        maintenance.append(element("h2", "pp-title", "模块数据"));
        const actions = element("div", "pp-actions");
        const cacheView = element("button", "", "查看 Caches");
        const cacheClear = element("button", "", "清空 Caches");
        const reset = element("button", "pp-danger", "重置模块");
        const output = element("pre", "pp-cache");
        output.hidden = true;
        output.setAttribute("aria-label", "Caches 内容");
        for (const button of [cacheView, cacheClear, reset]) button.type = "button";
        cacheView.onclick = () => {
            if (saving) return;
            let value;
            return perform(
                async () => {
                    try {
                        value = await client.readCaches(active);
                    } catch (error) {
                        notify({ kind: "error", message: error.message });
                        throw error;
                    }
                },
                () => {
                    output.textContent = value === undefined ? "暂无缓存" : JSON.stringify(value, null, 2);
                    output.hidden = false;
                    cacheView.textContent = "刷新 Caches";
                },
            );
        };
        cacheClear.onclick = () => {
            if (saving) return;
            if (!window.confirm(`清空 ${active} 的全部 Caches？`)) return;
            return perform(
                () => client.clearCaches(active),
                () => {
                    output.textContent = "暂无缓存";
                },
            );
        };
        reset.onclick = () => {
            if (saving) return;
            if (!window.confirm(`重置 ${active}？这将删除该模块的 Settings、Caches 和其它持久化数据。`)) return;
            return perform(() => client.reset(active), controls);
        };
        actions.append(cacheView, cacheClear, reset);
        maintenance.append(actions, output);
        view.append(maintenance);
        navigation?.destroy();
        navigation = new Navigation(viewport, view, key => editors.get(key)?.node);
        navigation.addEventListener("change", updateNavigation);
        for (const grow of growingInputs) grow();
        updateNavigation();
    }
    /**
     * 已加载的表单交由导航组件返回；加载阶段可以返回先前文档。
     * Loaded forms delegate back to navigation; loading views can return to the previous document.
     * @returns {void} 无返回值 / No return value.
     */
    back.onclick = () => {
        if (saving) return;
        if (navigation) navigation.back();
        else window.history.back();
    };
    open(catalog.module.module);
    return {
        /**
         * 移除监听器、定时器、会话和挂载内容。
         * Remove listeners, timers, session and mounted content.
         * @returns {void} 无返回值 / No return value.
         */
        destroy() {
            destroyed = true;
            navigation?.destroy();
            generation++;
            if (active && !saving) client.leave(active);
            clearTimeout(timer);
            shell.remove();
        },
    };
}

/**
 * 只挂载导入 JSON 对应的模块设置页，默认样式内置，CSS 仅用于该页。
 * Mount only the imported module's settings page with built-in defaults and optional page CSS.
 * @param {import("../index.js").BoxJSInput} boxjs 单个模块的 BoxJS JSON / BoxJS JSON for one module.
 * @param {string} [css] 可选 CSS 正文 / Optional CSS text.
 * @returns {import("./index.js").MountedPreferences} 模块生命周期句柄 / Module lifecycle handle.
 */
function mount(boxjs, css = "") {
    if (typeof css !== "string") throw new TypeError("CSS must be a string");
    const catalog = new BoxJS(boxjs);
    const metadata = catalog.module.metadata;
    const image = metadata.icon || metadata.icons?.[1] || metadata.icons?.[0];
    if (image) resourceURL(image);
    if (metadata.repo) resourceURL(metadata.repo);
    const existing = document.querySelector("#preferences");
    const root = existing ?? element("main", "");
    if (!existing) {
        root.id = "preferences";
        document.body.append(root);
    }
    const base = element("style", ""),
        custom = element("style", "");
    base.textContent = defaults;
    custom.textContent = css;
    document.head.append(base, custom);
    const previousTitle = document.title;
    const previousTheme = document.documentElement.dataset.theme;
    const theme = navigator.userAgent.match(/themeId\/(\d+)/)?.[1];
    if (theme) document.documentElement.dataset.theme = theme === "2" ? "dark" : "light";
    document.title = metadata.name ?? catalog.module.module;
    let panel;
    const view = {
        /**
         * 释放模块视图、样式与会话，不操作项目入口页。
         * Release the module view, styles and session without operating a project landing page.
         * @returns {void} 无返回值 / No return value.
         */
        destroy() {
            panel?.destroy();
            base.remove();
            custom.remove();
            if (existing) root.replaceChildren();
            else root.remove();
            document.title = previousTitle;
            if (previousTheme === undefined) delete document.documentElement.dataset.theme;
            else document.documentElement.dataset.theme = previousTheme;
        },
    };
    try {
        root.replaceChildren();
        panel = mountPanel(root, catalog);
        return view;
    } catch (error) {
        view.destroy();
        throw error;
    }
}

let view;
/**
 * 从 URL 或代理传递的 Header 导入 JSON/CSS，支持独立文档与 srcdoc。
 * Import JSON/CSS from the URL or proxy-carried headers in standalone and srcdoc documents.
 * @returns {Promise<void>} 启动完成 / Startup completion.
 */
async function start() {
    try {
        view?.destroy();
        view = undefined;
        const context = document.querySelector('meta[name="preference-panes-inputs"]');
        const inputs = context ? JSON.parse(decodeURIComponent(context.content)) : pageInputs(new URL(location.href));
        const resources = [inputs.json, inputs.css].map(source => {
            if (!source) return null;
            const url = new URL(source, inputs.url);
            if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("Resources must use HTTP(S) URLs");
            return url.href;
        });
        const [data, style] = await Promise.all(resources.map(url => (url ? fetch(url, { cache: "no-store", credentials: "omit" }) : null)));
        if (data.status !== 200 || (style && style.status !== 200)) throw new Error(`HTTP ${data.status !== 200 ? data.status : style.status}`);
        const boxjs = await data.json();
        if (new BoxJS(boxjs).module.module !== inputs.module) throw new Error("Imported JSON does not match the module URL");
        view = mount(boxjs, style ? await style.text() : "");
    } catch (error) {
        document.querySelector("#preferences").replaceChildren(errorView(error, start));
    }
}
start();
window.addEventListener("pageshow", event => {
    if (event.persisted) start();
});
