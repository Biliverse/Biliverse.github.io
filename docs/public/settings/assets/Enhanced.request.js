var PreferencePanes = (function (exports) {
    'use strict';

    class URLSearchParams {
        constructor(params, onUpdate) {
            switch (typeof params) {
                case "string": {
                    if (params.length === 0)
                        break;
                    if (params.startsWith("?"))
                        params = params.slice(1);
                    const pairs = params.split("&").map(pair => {
                        const separator = pair.indexOf("=");
                        return separator < 0 ? [pair, ""] : [pair.slice(0, separator), pair.slice(separator + 1)];
                    });
                    pairs.forEach(([key, value]) => {
                        this.#params.push(key ? this.#decodeQueryComponent(key) : key);
                        this.#values.push(this.#decodeQueryComponent(value));
                    });
                    break;
                }
                case "object":
                    if (Array.isArray(params)) {
                        Object.entries(params).forEach(([key, value]) => {
                            this.#params.push(key);
                            this.#values.push(value);
                        });
                    }
                    else if (Symbol.iterator in Object(params)) {
                        for (const [key, value] of params) {
                            this.#params.push(key);
                            this.#values.push(value);
                        }
                    }
                    break;
            }
            this.#updateSearchString(this.#params, this.#values);
            this.#onUpdate = onUpdate;
        }
        // Create 2 seperate arrays for the params and values to make management and lookup easier.
        #param = "";
        #params = [];
        #values = [];
        #onUpdate;
        #decodeQueryComponent(str) {
            return decodeURIComponent(str.replace(/\+/g, " "));
        }
        #encodeQueryComponent(str) {
            return encodeURIComponent(str)
                .replace(/%20/g, "+")
                .replace(/[!'()~]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
        }
        // Update the search property of the URL instance with the new params and values.
        #updateSearchString(params, values) {
            if (params.length === 0)
                this.#param = "";
            else
                this.#param = params
                    .map((param, index) => {
                    switch (typeof values[index]) {
                        case "object":
                            return `${this.#encodeQueryComponent(param)}=${this.#encodeQueryComponent(JSON.stringify(values[index]))}`;
                        case "boolean":
                        case "number":
                        case "string":
                            return `${this.#encodeQueryComponent(param)}=${this.#encodeQueryComponent(values[index])}`;
                        case "undefined":
                        default:
                            return this.#encodeQueryComponent(param);
                    }
                })
                    .join("&");
            this.#onUpdate?.(this.#param);
        }
        // Add a given param with a given value to the end.
        append(name, value) {
            this.#params.push(name);
            this.#values.push(value);
            this.#updateSearchString(this.#params, this.#values);
        }
        // Remove all occurances of a given param
        delete(name, value) {
            while (this.#params.indexOf(name) > -1) {
                this.#values.splice(this.#params.indexOf(name), 1);
                this.#params.splice(this.#params.indexOf(name), 1);
            }
            this.#updateSearchString(this.#params, this.#values);
        }
        // Return an array to be structured in this way: [[param1, value1], [param2, value2]] to mimic the native method's ES6 iterator.
        entries() {
            return this.#params.map((param, index) => [param, this.#values[index]]);
        }
        // Return the value matched to the first occurance of a given param.
        get(name) {
            return this.#values[this.#params.indexOf(name)];
        }
        // Return all values matched to all occurances of a given param.
        getAll(name) {
            return this.#values.filter((value, index) => this.#params[index] === name);
        }
        // Return a boolean to indicate whether a given param exists.
        has(name, value) {
            return this.#params.indexOf(name) > -1;
        }
        // Return an array of the param names to mimic the native method's ES6 iterator.
        keys() {
            return this.#params;
        }
        // Set a given param to a given value.
        set(name, value) {
            if (this.#params.indexOf(name) === -1) {
                this.append(name, value); // If the given param doesn't already exist, append it.
            }
            else {
                let first = true;
                const newValues = [];
                // If the param already exists, change the value of the first occurance and remove any remaining occurances.
                this.#params = this.#params.filter((currentParam, index) => {
                    if (currentParam !== name) {
                        newValues.push(this.#values[index]);
                        return true;
                        // If the currentParam matches the one being changed and it's the first one, keep the param and change its value to the given one.
                    }
                    else if (first) {
                        first = false;
                        newValues.push(value);
                        return true;
                    }
                    // If the currentParam matches the one being changed, but it's not the first, remove it.
                    return false;
                });
                this.#values = newValues;
                this.#updateSearchString(this.#params, this.#values);
            }
        }
        // Sort all key/value pairs, if any, by their keys then by their values.
        sort() {
            // Call entries to make sorting easier, then rewrite the params and values in the new order.
            const sortedPairs = this.entries().sort();
            this.#params = [];
            this.#values = [];
            sortedPairs.forEach(pair => {
                this.#params.push(pair[0]);
                this.#values.push(pair[1]);
            });
            this.#updateSearchString(this.#params, this.#values);
        }
        // Return the search string without the '?'.
        toString = () => this.#param;
        // Return and array of the param values to mimic the native method's ES6 iterator..
        values = () => this.#values.values();
    }

    class URL {
        constructor(url, base) {
            switch (typeof url) {
                case "string": {
                    const urlIsValid = /^(blob:|file:)?[a-zA-z]+:\/\/.*/.test(url);
                    const baseIsValid = base ? /^(blob:|file:)?[a-zA-z]+:\/\/.*/.test(base) : false;
                    // If a string is passed for url instead of location or link, then set the properties of the URL instance.
                    if (urlIsValid)
                        this.href = url;
                    // If the url isn't valid, but the base is, then prepend the base to the url.
                    else if (baseIsValid)
                        this.href = base + url;
                    // If no valid url or base is given, then throw a type error.
                    else
                        throw new TypeError('URL string is not valid. If using a relative url, a second argument needs to be passed representing the base URL. Example: new URL("relative/path", "http://www.example.com");');
                    break;
                }
                case "object":
                    break;
                default:
                    throw new TypeError("Invalid argument type.");
            }
        }
        #url = {
            hash: "",
            host: "",
            hostname: "",
            href: "",
            password: "",
            pathname: "",
            port: Number.NaN,
            protocol: "",
            search: "",
            searchParams: new URLSearchParams(""),
            username: "",
        };
        // refer: http://www.ietf.org/rfc/rfc3986.txt
        static #URLRegExp = /^(?<scheme>([^:\/?#]+):)?(?:\/\/(?<authority>[^\/?#]*))?(?<path>[^?#]*)(?<query>\?([^#]*))?(?<hash>#(.*))?$/;
        static #AuthorityRegExp = /^(?<authentication>(?<username>[^:]*)(:(?<password>[^@]*))?@)?(?<hostname>[^:]+)(:(?<port>\d+))?$/;
        get hash() {
            return this.#url.hash;
        }
        set hash(value) {
            if (value.length !== 0) {
                if (value.startsWith("#"))
                    value = value.slice(1);
                this.#url.hash = `#${encodeURIComponent(value)}`;
            }
        }
        get host() {
            return this.port.length > 0 ? `${this.hostname}:${this.port}` : this.hostname;
        }
        set host(value) {
            [this.hostname, this.port] = value.split(":", 2);
        }
        get hostname() {
            return encodeURIComponent(this.#url.hostname);
        }
        set hostname(value) {
            this.#url.hostname = value ?? "";
        }
        get href() {
            let authority = "";
            if (this.username.length > 0) {
                authority += this.username;
                if (this.password.length > 0)
                    authority += `:${this.password}`;
                authority += "@";
            }
            return `${this.protocol}//${authority}${this.host}${this.pathname}${this.search}${this.hash}`;
        }
        set href(value) {
            if (value.startsWith("blob:") || value.startsWith("file:"))
                value = value.slice(5);
            const urlMatch = value.match(URL.#URLRegExp);
            if (!urlMatch)
                throw new TypeError("Invalid URL format.");
            this.protocol = urlMatch.groups.scheme ?? "";
            const authorityMatch = urlMatch.groups.authority.match(URL.#AuthorityRegExp);
            this.username = authorityMatch.groups.username ?? "";
            this.password = authorityMatch.groups.password ?? "";
            this.hostname = authorityMatch.groups.hostname ?? "";
            this.port = authorityMatch.groups.port ?? "";
            this.pathname = urlMatch.groups.path ?? "";
            this.search = urlMatch.groups.query ?? "";
            this.hash = urlMatch.groups.hash ?? "";
        }
        get origin() {
            return `${this.protocol}//${this.host}`;
        }
        get password() {
            return encodeURIComponent(this.#url.password);
        }
        set password(value) {
            if (this.username.length > 0)
                this.#url.password = value ?? "";
        }
        get pathname() {
            return `/${this.#url.pathname}`;
        }
        set pathname(value) {
            value = `${value}`;
            if (value.startsWith("/"))
                value = value.slice(1);
            this.#url.pathname = value;
        }
        get port() {
            if (Number.isNaN(this.#url.port))
                return "";
            const port = this.#url.port.toString();
            if (this.protocol === "ftp:" && port === "21")
                return "";
            if (this.protocol === "http:" && port === "80")
                return "";
            if (this.protocol === "https:" && port === "443")
                return "";
            return port;
        }
        set port(value) {
            switch (value) {
                case "":
                    this.#url.port = Number.NaN;
                    break;
                default: {
                    const port = Number.parseInt(value, 10);
                    if (port >= 0 && port < 65535)
                        this.#url.port = port;
                }
            }
        }
        get protocol() {
            return `${this.#url.protocol}:`;
        }
        set protocol(value) {
            if (value.endsWith(":"))
                value = value.slice(0, -1);
            this.#url.protocol = value;
        }
        get search() {
            if (this.#url.search.length > 0)
                return `?${this.#url.search}`;
            else
                return "";
        }
        set search(value) {
            value = `${value}`;
            if (value.startsWith("?"))
                value = value.slice(1);
            this.#url.search = value;
            this.#url.searchParams = new URLSearchParams(this.#url.search, search => {
                this.#url.search = search;
            });
        }
        get searchParams() {
            return this.#url.searchParams;
        }
        get username() {
            return encodeURIComponent(this.#url.username);
        }
        set username(value) {
            this.#url.username = value ?? "";
        }
        static parse = (url, base) => new URL(url, base);
        /**
         * Returns the string representation of the URL.
         *
         * @returns {string} The href of the URL.
         */
        toString = () => this.href;
        /**
         * Converts the URL object properties to a JSON string.
         *
         * @returns {string} A JSON string representation of the URL object.
         */
        toJSON = () => JSON.stringify({
            hash: this.hash,
            host: this.host,
            hostname: this.hostname,
            href: this.href,
            origin: this.origin,
            password: this.password,
            pathname: this.pathname,
            port: this.port,
            protocol: this.protocol,
            search: this.search,
            searchParams: this.searchParams,
            username: this.username,
        });
    }

    var assets = {"page":{"type":"text/html","body":"<!doctype html>\n<html lang=\"zh-CN\">\n    <head>\n        <meta charset=\"utf-8\">\n        <meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n        <meta name=\"color-scheme\" content=\"light dark\">\n        <title>Module Preferences</title>\n        <style>body { margin: 0; }</style>\n    </head>\n    <body>\n        <main id=\"preferences\"></main>\n        <script type=\"module\" src=\"/settings/assets/app.mjs?v=0.7.2\"></script>\n    </body>\n</html>\n"},"/settings/assets/app.mjs":{"type":"text/javascript","body":"/**\n * 解析已经取得的 pathname，避免重复构造 URL。\n * Parse an existing pathname without constructing another URL.\n * @param {string} pathname 以 / 开头的 URL pathname / URL pathname beginning with /.\n * @returns {string[] | undefined} 解码后的路径，非 API 路径不处理 / Decoded path, or undefined outside /api/.\n * @throws {TypeError} 转义编码或路径片段非法 / Invalid percent encoding or path segments.\n */\n\n/**\n * 校验原始路径片段，不进行 URL 编码转换。\n * Validate raw path segments without URL encoding conversion.\n * @param {string[]} parts 原始路径片段 / Raw path segments.\n * @returns {string[]} 同一数组，不复制或修改 / The same array without copying or mutation.\n * @throws {TypeError} 空片段、非法字符或原型属性名 / Empty segments, invalid characters or prototype property names.\n */\nfunction validatePathParts(parts) {\n    if (!parts.every(part => typeof part === \"string\" && /^[a-zA-Z0-9_-]+$/.test(part) && ![\"__proto__\", \"prototype\", \"constructor\"].includes(part))) throw new TypeError(\"Invalid key path\");\n    return parts;\n}\n\n/**\n * BoxJS 的共同目录：模块、存储根和展示元数据都来自同一份 JSON。\n * Shared BoxJS catalog deriving modules, storage roots and metadata from one JSON document.\n */\nclass BoxJS {\n    /**\n     * 建立路径索引，不解析控件类型，也不读写持久化存储。\n     * Index field paths without interpreting controls or accessing persistence.\n     * @param {unknown} input 字段数组、单个 app 或 apps 订阅 / Field array, app or apps subscription.\n     */\n    constructor(input) {\n        if (!input || typeof input !== \"object\") throw new TypeError(\"Expected BoxJS JSON\");\n        this.document = JSON.parse(JSON.stringify(input));\n        const apps = Array.isArray(this.document) ? [{ settings: this.document }] : (this.document.apps ?? [this.document]);\n        if (!Array.isArray(apps)) throw new TypeError(\"Expected BoxJS apps array\");\n        this.modules = new Map();\n        for (const app of apps) {\n            if (!app || !Array.isArray(app.settings)) throw new TypeError(\"Expected BoxJS settings array\");\n            for (const entry of app.settings) {\n                if (typeof entry.id !== \"string\") throw new TypeError(\"BoxJS settings require string IDs\");\n                if (!entry.id.startsWith(\"@\")) {\n                    if (Array.isArray(this.document)) throw new TypeError(\"BoxJS settings require @root.path IDs\");\n                    continue;\n                }\n                const [storageKey, ...parts] = entry.id.slice(1).split(\".\");\n                if (!storageKey || storageKey.startsWith(\"@\") || parts.length < 2) throw new TypeError(\"A BoxJS setting must be below a literal storage root and module\");\n                validatePathParts(parts);\n                const module = parts[0];\n                let target = this.modules.get(module);\n                if (!target) {\n                    target = { module, storageKey, entries: [], owners: new Set() };\n                    this.modules.set(module, target);\n                }\n                if (target.storageKey !== storageKey) throw new TypeError(`A module must use one storage root: ${module}`);\n                target.entries.push(entry);\n                target.owners.add(app);\n            }\n        }\n        this.metadata = metadata(Array.isArray(this.document) ? {} : this.document);\n        for (const target of this.modules.values()) target.metadata = target.owners.size === 1 ? metadata([...target.owners][0]) : {};\n    }\n\n    /**\n     * 提取一个模块的原生 BoxJS，保留所属 app 的元数据。\n     * Select a module's native BoxJS while retaining owning-app metadata.\n     * @param {string} module 模块标识 / Module identifier.\n     * @returns {unknown} 可直接用作配置 Mock 的 JSON / JSON suitable for a configuration Mock.\n     */\n    select(module) {\n        const target = this.modules.get(module);\n        if (!target) throw new TypeError(`No BoxJS settings for module: ${module}`);\n        if (Array.isArray(this.document)) return target.entries;\n        const apps = [...target.owners].map(app => ({ ...app, settings: app.settings.filter(entry => target.entries.includes(entry)) }));\n        return this.document.apps ? { ...this.document, apps } : apps[0];\n    }\n\n    /**\n     * 取得本次导入的唯一模块，避免把模块数据变成项目目录。\n     * Get the single imported module without turning module data into a project directory.\n     * @returns {object} 唯一模块的目录项 / The single module entry.\n     */\n    get module() {\n        if (this.modules.size !== 1) throw new TypeError(\"Import BoxJS JSON for exactly one module\");\n        return this.modules.values().next().value;\n    }\n}\n\n/**\n * 保留标准 BoxJS 展示信息；script 仅为元数据，不执行。\n * Retain standard BoxJS presentation data; script is metadata only and never executed.\n * @param {object} source BoxJS app 或订阅 / BoxJS app or subscription.\n * @returns {object} 经过类型检查的展示信息 / Type-checked presentation metadata.\n */\nfunction metadata(source) {\n    const result = {};\n    for (const key of [\"id\", \"name\", \"author\", \"repo\", \"script\", \"icon\", \"description\", \"desc\", \"icons\", \"descs\"]) {\n        if (source[key] === undefined) continue;\n        const multiple = key === \"icons\" || key === \"descs\";\n        const values = multiple ? source[key] : [source[key]];\n        if (!Array.isArray(values) || values.some(item => typeof item !== \"string\")) throw new TypeError(`Invalid BoxJS app ${key}`);\n        result[key] = multiple ? [...values] : source[key];\n    }\n    return result;\n}\n\n/**\n * 统一解析模块页的资源地址：Header 优先于查询参数，再使用模块约定。\n * Resolve module resource locations: headers override query parameters and module conventions.\n * @param {URL} url 已解析的页面请求地址 / Parsed page request URL.\n * @param {Record<string, string | undefined>} [headers] 请求头，名称不区分大小写 / Case-insensitive request headers.\n * @returns {{url: string, module: string, json: string, css: string}} 页面上下文与两个资源输入 / Page context and two resource inputs.\n */\nfunction pageInputs(url, headers = {}) {\n    const match = /^\\/settings\\/([a-zA-Z0-9_-]+)\\/?$/.exec(url.pathname);\n    if (!match) throw new TypeError(\"Open a concrete module URL\");\n    const module = match[1];\n    const values = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));\n    const json = values[\"x-preferencepanes-json\"] ?? url.searchParams.get(\"json\") ?? `/configs/${module}`;\n    const css = values[\"x-preferencepanes-css\"] ?? url.searchParams.get(\"css\") ?? `/settings/assets/${module}.css`;\n    if (!json.trim()) throw new TypeError(\"JSON resource URL is required\");\n    return { url: url.href, module, json, css };\n}\n\n/**\n * 创建元素，所有展示文本通过 textContent 写入。\n * Create elements and assign display text through textContent only.\n * @template {keyof HTMLElementTagNameMap} T\n * @param {T} tag 元素标签 / Element tag.\n * @param {string} className 样式类名 / CSS class.\n * @param {string} [text] 纯文本 / Plain text.\n * @returns {HTMLElementTagNameMap[T]} 创建的元素 / Created element.\n */\nfunction element(tag, className, text) {\n    const node = document.createElement(tag);\n    node.className = className;\n    if (text !== undefined) node.textContent = text;\n    return node;\n}\n\n/**\n * 元数据地址只允许 HTTP(S) 和相对地址。\n * Allow only HTTP(S) and relative metadata addresses.\n * @param {string} value 元数据地址 / Metadata address.\n * @returns {string} 完整地址 / Absolute address.\n */\nfunction resourceURL(value) {\n    const url = new URL(value, document.baseURI);\n    if (![\"http:\", \"https:\"].includes(url.protocol)) throw new TypeError(\"Metadata URLs must use HTTP(S)\");\n    return url.href;\n}\n\n/**\n * 展示标准 BoxJS 图标；icons 保持透明/彩色语义，不解释为亮暗版本。\n * Display standard BoxJS icons, preserving transparent/color rather than light/dark semantics.\n * @param {import(\"../index.js\").BoxJSMetadata} metadata 展示信息 / Presentation metadata.\n * @param {string} className 样式 / CSS class.\n * @returns {HTMLImageElement | null} 图标或无图标 / Icon or no icon.\n */\nfunction icon(metadata, className) {\n    const source = metadata.icon || metadata.icons?.[1] || metadata.icons?.[0];\n    if (!source) return null;\n    const image = element(\"img\", className);\n    image.src = resourceURL(source);\n    image.alt = \"\";\n    return image;\n}\n\n/**\n * 共享加载失败视图，不创建配置表单或数据读取。\n * Share a load-error view without creating controls or reading settings.\n * @param {Error} error 失败原因 / Failure reason.\n * @param {() => unknown} retry 重试动作 / Retry action.\n * @returns {HTMLElement} 错误视图 / Error view.\n */\nfunction errorView(error, retry) {\n    const view = element(\"section\", \"pp-error\");\n    const button = element(\"button\", \"\", \"重新读取\");\n    button.type = \"button\";\n    button.onclick = retry;\n    view.append(element(\"p\", \"\", `加载失败：${error.message}`), button);\n    return view;\n}\n\nvar defaults = \"/* 分组列表沿用 Bilibili 设置页的行结构，样式限定在面板内。\\n * Grouped rows follow the Bilibili settings layout, scoped to the panel. */\\n.pp-panel {\\n    --pp-text: #18191c;\\n    --pp-background: #f6f7f8;\\n    --pp-surface: #fff;\\n    --pp-border: #e3e5e7;\\n    --pp-muted: #9499a0;\\n    --pp-accent: #fb7299;\\n    font:\\n        15px / 1.5 -apple-system,\\n        BlinkMacSystemFont,\\n        \\\"Segoe UI\\\",\\n        sans-serif;\\n    color: var(--pp-text);\\n    background: var(--pp-background);\\n    position: relative;\\n    min-height: 100vh;\\n}\\n.pp-panel * {\\n    box-sizing: border-box;\\n    letter-spacing: 0;\\n}\\n.pp-header {\\n    height: calc(52px + env(safe-area-inset-top));\\n    padding: env(safe-area-inset-top) 12px 0;\\n    display: flex;\\n    align-items: center;\\n    background: var(--pp-surface);\\n    border-bottom: 1px solid var(--pp-border);\\n    position: sticky;\\n    top: 0;\\n    z-index: 1;\\n}\\n.pp-title {\\n    font-size: 17px;\\n    font-weight: 500;\\n    margin: 0;\\n    min-width: 0;\\n    overflow-wrap: anywhere;\\n}\\n.pp-brand {\\n    flex: 1;\\n    min-width: 0;\\n    display: flex;\\n    align-items: center;\\n    justify-content: center;\\n    gap: 8px;\\n    text-align: center;\\n}\\n.pp-brand-icon {\\n    display: none;\\n    flex: none;\\n    width: 28px;\\n    height: 28px;\\n}\\n.pp-brand-icon:not(:empty) {\\n    display: block;\\n}\\n.pp-brand-icon img {\\n    display: block;\\n    width: 100%;\\n    height: 100%;\\n    object-fit: contain;\\n}\\n.pp-nav-spacer {\\n    width: 44px;\\n    flex: none;\\n}\\n.pp-panel button {\\n    font: inherit;\\n    cursor: pointer;\\n    border: 0;\\n    background: none;\\n    color: inherit;\\n}\\n.pp-panel .pp-back {\\n    width: 44px;\\n    height: 44px;\\n    flex: none;\\n    font-size: 34px;\\n    line-height: 32px;\\n    padding: 0;\\n}\\n.pp-panel button:disabled {\\n    opacity: 0.5;\\n    cursor: wait;\\n}\\n.pp-viewport {\\n    position: relative;\\n    height: calc(100vh - 52px - env(safe-area-inset-top));\\n    overflow: hidden;\\n}\\n:root[data-preference-panes-embedded] .pp-header {\\n    display: none;\\n}\\n:root[data-preference-panes-embedded] .pp-viewport {\\n    height: 100vh;\\n}\\n@supports (height: 100dvh) {\\n    .pp-viewport {\\n        height: calc(100dvh - 52px - env(safe-area-inset-top));\\n    }\\n    :root[data-preference-panes-embedded] .pp-viewport {\\n        height: 100dvh;\\n    }\\n}\\n.pp-fields,\\n.pp-choice-page {\\n    position: absolute;\\n    inset: 0;\\n    overflow: auto;\\n    padding: 12px max(16px, calc((100% - 688px) / 2)) calc(28px + env(safe-area-inset-bottom));\\n    background: var(--pp-background);\\n}\\n.pp-panel .form-group {\\n    margin: 0 0 12px;\\n}\\n.pp-panel .form-group__title {\\n    font-size: 12px;\\n    line-height: 17px;\\n    font-weight: 400;\\n    color: var(--pp-muted);\\n    padding-left: 12px;\\n    margin: 12px 0 6px;\\n}\\n.pp-panel .form-group__row {\\n    border-radius: 8px;\\n    overflow: hidden;\\n    background: var(--pp-surface);\\n}\\n.pp-panel .form-row {\\n    position: relative;\\n    display: flex;\\n    align-items: center;\\n    width: 100%;\\n    min-height: 46px;\\n    padding: 12px;\\n    border: 0;\\n    border-bottom: 1px solid var(--pp-border);\\n    background: var(--pp-surface);\\n    gap: 12px;\\n}\\n.pp-panel .form-row:last-child {\\n    border-bottom: 0;\\n}\\n.pp-panel .form-row__text {\\n    flex: 1;\\n    min-width: 0;\\n    margin: 0;\\n    display: flex;\\n    flex-direction: column;\\n}\\n.pp-panel .form-row__title {\\n    font-size: 15px;\\n    line-height: 22px;\\n    color: var(--pp-text);\\n    text-align: left;\\n}\\n.pp-panel .form-row__subtitle {\\n    font-size: 12px;\\n    line-height: 18px;\\n    color: var(--pp-muted);\\n    overflow-wrap: anywhere;\\n    margin-top: 2px;\\n}\\n.pp-choice-link {\\n    display: flex;\\n    align-items: center;\\n    justify-content: flex-end;\\n    gap: 8px;\\n    max-width: 45%;\\n    min-width: 44px;\\n    min-height: 44px;\\n    padding: 0;\\n    text-align: right;\\n    flex: 1;\\n}\\n.pp-summary {\\n    color: var(--pp-muted);\\n    font-size: 13px;\\n    line-height: 18px;\\n    display: -webkit-box;\\n    -webkit-line-clamp: 2;\\n    -webkit-box-orient: vertical;\\n    overflow: hidden;\\n    overflow-wrap: anywhere;\\n}\\n.pp-chevron {\\n    color: var(--pp-muted);\\n    font-size: 22px;\\n    flex: none;\\n}\\n.pp-input {\\n    font: inherit;\\n    color: var(--pp-text);\\n    background: var(--pp-surface);\\n    border: 1px solid var(--pp-border);\\n    border-radius: 6px;\\n    padding: 8px;\\n    min-width: 0;\\n    max-width: 45%;\\n    width: 45%;\\n}\\nselect.pp-input {\\n    text-overflow: ellipsis;\\n    font-size: 13px;\\n}\\n.pp-panel .pp-multiline {\\n    display: block;\\n}\\n.pp-multiline .pp-input {\\n    max-width: 100%;\\n    width: 100%;\\n    margin-top: 10px;\\n}\\n.pp-switch {\\n    appearance: none;\\n    -webkit-appearance: none;\\n    position: relative;\\n    flex: none;\\n    width: 32px;\\n    height: 20px;\\n    max-width: none;\\n    border: 0;\\n    border-radius: 15px;\\n    padding: 0;\\n    background: #c9ccd0;\\n    cursor: pointer;\\n    transition: background 0.2s;\\n}\\n.pp-switch::before {\\n    content: \\\"\\\";\\n    position: absolute;\\n    top: 3px;\\n    left: 3px;\\n    width: 14px;\\n    height: 14px;\\n    border-radius: 50%;\\n    background: white;\\n    transition: transform 0.2s;\\n}\\n.pp-switch:checked {\\n    background: var(--pp-accent);\\n}\\n.pp-switch:checked::before {\\n    transform: translateX(12px);\\n}\\n.pp-choice {\\n    justify-content: space-between;\\n    cursor: pointer;\\n}\\n.pp-choice input {\\n    width: 20px;\\n    height: 20px;\\n    flex: none;\\n    accent-color: var(--pp-accent);\\n    margin: 0;\\n}\\n.pp-description {\\n    font-size: 12px;\\n    line-height: 1.6;\\n    color: var(--pp-muted);\\n    white-space: pre-wrap;\\n    overflow-wrap: anywhere;\\n}\\n.pp-module-info {\\n    display: flex;\\n    gap: 12px;\\n    margin: 12px 0;\\n}\\n.pp-module-icon {\\n    width: 48px;\\n    height: 48px;\\n    object-fit: contain;\\n    flex: none;\\n}\\n.pp-module-details {\\n    min-width: 0;\\n    overflow-wrap: anywhere;\\n}\\n.pp-module-source {\\n    color: inherit;\\n    text-decoration: underline;\\n}\\n.pp-maintenance {\\n    margin-top: 24px;\\n}\\n.pp-actions {\\n    display: flex;\\n    flex-wrap: wrap;\\n    gap: 8px;\\n}\\n.pp-actions button,\\n.pp-error button {\\n    min-height: 44px;\\n    padding: 8px 12px;\\n    border-radius: 6px;\\n    background: var(--pp-surface);\\n}\\n.pp-panel .pp-danger {\\n    color: #e45656;\\n}\\n.pp-cache {\\n    max-height: 320px;\\n    overflow: auto;\\n    white-space: pre-wrap;\\n    overflow-wrap: anywhere;\\n}\\n.pp-toast {\\n    pointer-events: none;\\n    position: fixed;\\n    bottom: calc(30px + env(safe-area-inset-bottom));\\n    left: 50%;\\n    transform: translateX(-50%);\\n    max-width: 90vw;\\n    padding: 10px 16px;\\n    border-radius: 8px;\\n    background: #333e;\\n    color: white;\\n    font-size: 13px;\\n    z-index: 20;\\n}\\n.pp-toast[data-kind=\\\"error\\\"] {\\n    background: #8d2424;\\n}\\n.pp-panel :focus-visible {\\n    outline: 2px solid var(--pp-accent);\\n    outline-offset: -2px;\\n}\\n@media (prefers-color-scheme: dark) {\\n    .pp-panel {\\n        --pp-text: #e3e5e7;\\n        --pp-background: #17181a;\\n        --pp-surface: #232427;\\n        --pp-border: #343538;\\n    }\\n}\\n:root[data-theme=\\\"dark\\\"] .pp-panel {\\n    --pp-text: #e3e5e7;\\n    --pp-background: #17181a;\\n    --pp-surface: #232427;\\n    --pp-border: #343538;\\n}\\n:root[data-theme=\\\"light\\\"] .pp-panel {\\n    --pp-text: #18191c;\\n    --pp-background: #f6f7f8;\\n    --pp-surface: #fff;\\n    --pp-border: #e3e5e7;\\n}\\n@media (prefers-reduced-motion: reduce) {\\n    .pp-panel .pp-switch,\\n    .pp-panel .pp-switch::before {\\n        transition: none;\\n    }\\n}\\n\";\n\n/**\n * 将 BoxJS 数组、app 或订阅转换为模块字段，保留原文件为唯一字段来源。\n * Normalize a BoxJS array, app or subscription using the source JSON as the field authority.\n * @param {unknown} config BoxJS JSON / BoxJS document.\n * @param {string} module API 第一段模块名 / First API path segment.\n * @returns {import(\"../index.js\").ModuleDefinition} 存储根和字段 / Storage root and fields.\n * @throws {TypeError} 配置结构、字段路径、默认值或展示属性无效 / Invalid configuration, field path, default or presentation attribute.\n */\nfunction normalizeBoxJs(config, module) {\n    validatePathParts([module]);\n    const target = new BoxJS(config).modules.get(module);\n    if (!target) throw new TypeError(`No BoxJS settings for module: ${module}`);\n    const { entries, storageKey, metadata } = target;\n    const fields = [];\n    for (const entry of entries) {\n        const parts = entry.id.slice(1).split(\".\").slice(1);\n        const type = { boolean: \"boolean\", checkboxes: \"array\", selects: \"select\", text: \"string\", textarea: \"string\", number: \"number\" }[entry.type];\n        if (!type) throw new TypeError(`Unsupported BoxJS control: ${entry.type}`);\n        const field = {\n            key: parts.join(\".\"),\n            type: type === \"select\" ? typeof entry.val : type,\n\n            name: entry.name,\n            description: entry.desc ?? \"\",\n            control: entry.type,\n            ...(entry.placeholder === undefined ? {} : { placeholder: entry.placeholder }),\n            ...(entry.rows === undefined ? {} : { rows: entry.rows }),\n            ...(entry.autoGrow === undefined ? {} : { autoGrow: entry.autoGrow }),\n        };\n        if (type === \"select\" && ![\"string\", \"number\", \"boolean\"].includes(field.type)) throw new TypeError(`Select requires a scalar val: ${entry.id}`);\n        if (entry.items) field.options = entry.items.map(item => ({ key: item.key, label: item.label }));\n        if (Object.hasOwn(entry, \"val\")) field.defaultValue = normalizeStoredValue(field, entry.val);\n        if (\n            typeof field.name !== \"string\" ||\n            (field.placeholder !== undefined && typeof field.placeholder !== \"string\") ||\n            (field.rows !== undefined && (!Number.isInteger(field.rows) || field.rows < 1)) ||\n            (field.autoGrow !== undefined && typeof field.autoGrow !== \"boolean\") ||\n            fields.some(other => other.key === field.key || other.key.startsWith(`${field.key}.`) || field.key.startsWith(`${other.key}.`))\n        )\n            throw new TypeError(`Invalid or overlapping BoxJS field: ${entry.id}`);\n        if (field.options && (new Set(field.options.map(item => item.key)).size !== field.options.length || field.options.some(item => !scalar(item.key) || typeof item.label !== \"string\"))) throw new TypeError(`Invalid options: ${entry.id}`);\n        if (Object.hasOwn(field, \"defaultValue\") && !validValue(field, field.defaultValue)) throw new TypeError(`Invalid BoxJS val: ${entry.id}`);\n        fields.push(field);\n    }\n    if (!fields.length) throw new TypeError(`No BoxJS settings for module: ${module}`);\n    const common = fields[0].key.split(\".\").slice(0, -1);\n    for (const field of fields) while (!field.key.startsWith(`${common.join(\".\")}.`)) common.pop();\n    return {\n        module,\n        storageKey,\n        fields,\n        settingsPath: common,\n        ...(Object.keys(metadata).length ? { metadata } : {}),\n    };\n}\n\n/**\n * 归一化 BoxJS 的字符串存储值，不改变普通文本内容。\n * Normalize BoxJS string persistence without changing free-text values.\n * @param {import(\"../index.js\").SettingsField} field 前端字段约束 / Frontend field constraints.\n * @param {unknown} value 存储值 / Stored value.\n * @returns {unknown} 转换后的控件值；是否允许写入由 validValue 单独校验 / Converted control value; write eligibility is checked separately by validValue.\n */\nfunction normalizeStoredValue(field, value) {\n    switch (field.type) {\n        case \"boolean\":\n            if (value === \"true\" || value === \"false\") return value === \"true\";\n            break;\n        case \"number\":\n            if (typeof value === \"string\" && value.trim() !== \"\") return Number(value);\n            break;\n        case \"array\":\n            if (typeof value === \"string\") value = value === \"\" || value === \"[]\" ? [] : value.split(\",\");\n            break;\n    }\n    if (field.options) {\n        const match = item => field.options.find(option => String(option.key) === String(item))?.key ?? item;\n        return field.type === \"array\" && Array.isArray(value) ? value.map(match) : match(value);\n    }\n    return value;\n}\n\n/**\n * 校验支持的标量范围，包括文本长度与数值有限性。\n * Validate supported scalar bounds, including text length and numeric finiteness.\n * @param {unknown} value 待检查值 / Value to inspect.\n * @returns {boolean} 是否为有效标量 / Whether the scalar is valid.\n */\nfunction scalar(value) {\n    switch (typeof value) {\n        case \"boolean\":\n            return true;\n        case \"string\":\n            return value.length <= 2048;\n        case \"number\":\n            return Number.isFinite(value);\n        default:\n            return false;\n    }\n}\n\n/**\n * 检查值类型、数组唯一性及声明的选项，不进行转换。\n * Check value type, array uniqueness and declared choices without coercion.\n * @param {import(\"../index.js\").SettingsField} field 前端归一化字段 / Normalized frontend field.\n * @param {unknown} value 待写入的 JSON 值 / JSON value to write.\n * @returns {boolean} 是否符合字段约束 / Whether the value satisfies field constraints.\n */\nfunction validValue(field, value) {\n    if (field.type === \"array\") {\n        if (!Array.isArray(value) || value.some(item => !scalar(item)) || new Set(value).size !== value.length) return false;\n    } else if (typeof value !== field.type || !scalar(value)) return false;\n    return !field.options || (field.type === \"array\" ? value : [value]).every(item => field.options.some(option => option.key === item));\n}\n\n/**\n * 单个模块的临时会话；离开页面后丢弃。\n * Transient module session discarded when leaving the page.\n * @typedef {object} ModuleSession\n * @property {AbortController} controller 读取请求的取消控制器 / Abort controller for reads.\n * @property {import(\"../index.js\").ModuleDefinition | null} definition 加载完成的配置，加载中为 null / Loaded configuration, or null while loading.\n * @property {import(\"./client.mjs\").ModuleSnapshot[\"values\"]} values 当前显示值 / Current display values.\n * @property {boolean} saving 是否正在写入 / Whether a mutation is in progress.\n */\n\n/**\n * 创建页面会话缓存；打开时重读，选项操作仅在 HTTP 200 后更新缓存。\n * Create a page-session cache; reload on open and mutate cache only after HTTP 200.\n * @param {import(\"./client.mjs\").PreferencesClientOptions} options 包内目录、请求与通知 / Internal catalog, requests and notifications.\n * @returns {import(\"./client.mjs\").PreferencesClient} 通用客户端 / Generic client.\n */\nfunction createPreferencesClient({ catalog, fetch: request = globalThis.fetch.bind(globalThis), notify = () => {}, timeout = 10000 }) {\n    /**\n     * 模块会话表\n     * Module session map.\n     * @type {Map<string, ModuleSession>}\n     */\n    const sessions = new Map();\n    /**\n     * 发送同源请求，处理超时与取消；数据 GET 的 404 交给调用方处理。\n     * Send a same-origin request with timeout and cancellation; callers handle missing-data GET responses.\n     * @param {string} path 相对请求路径 / Relative request path.\n     * @param {\"HEAD\" | \"GET\" | \"POST\" | \"DELETE\"} method HTTP 方法 / HTTP method.\n     * @param {unknown} body POST 值，其它方法忽略 / POST value, ignored by other methods.\n     * @param {AbortSignal | undefined} signal 会话取消信号 / Session cancellation signal.\n     * @returns {Promise<Response>} 未消费正文的响应 / Response with an unread body.\n     * @throws {Error} 非 200 且非数据 GET 404、超时、取消或网络错误 / Non-200 status except missing-data GETs, timeout, cancellation or network error.\n     */\n    async function send(path, method, body, signal) {\n        const controller = new AbortController();\n        const abort = () => controller.abort();\n        if (signal?.aborted) abort();\n        signal?.addEventListener(\"abort\", abort, { once: true });\n        const timer = setTimeout(abort, timeout);\n        try {\n            const response = await request(path, {\n                method,\n                credentials: \"omit\",\n                cache: \"no-store\",\n                signal: controller.signal,\n                headers: { \"X-Settings-Client\": \"1\", ...(method === \"POST\" ? { \"Content-Type\": \"application/json\" } : {}) },\n                ...(method === \"POST\" ? { body: JSON.stringify(body) } : {}),\n            });\n            if (response.status !== 200 && !(method === \"GET\" && response.status === 404)) throw new Error(`HTTP ${response.status}`);\n            return response;\n        } finally {\n            clearTimeout(timer);\n            signal?.removeEventListener(\"abort\", abort);\n        }\n    }\n    /**\n     * 获取独立快照，避免调用方修改内部缓存。\n     * Return an independent snapshot so callers cannot mutate the cache.\n     * @param {string} module 已打开模块 / Open module.\n     * @returns {import(\"./client.mjs\").ModuleSnapshot} 会话快照 / Session snapshot.\n     * @throws {Error} 模块未完成加载 / Module has not finished loading.\n     */\n    const snapshot = module => {\n        const state = sessions.get(module);\n        if (!state?.definition) throw new Error(\"Open the module first\");\n        return structuredClone({ definition: state.definition, values: state.values });\n    };\n    /**\n     * 串行修改单键，仅成功后更新仍存活的会话。\n     * Serialize single-key mutations and update a still-active session only after success.\n     * @param {string} module 已打开模块 / Open module.\n     * @param {string} key 完整点分字段路径 / Complete dotted field path.\n     * @param {\"POST\" | \"DELETE\"} method 写入或删除 / Write or delete.\n     * @param {unknown} value 写入值，删除时忽略 / Write value, ignored for deletion.\n     * @param {\"write\" | \"delete\" | \"clearCaches\" | \"reset\"} [operation] 操作类型 / Operation kind.\n     * @returns {Promise<void>} 操作完成 / Operation completion.\n     * @throws {Error} 会话、字段、值或请求错误 / Session, field, value or request error.\n     */\n    async function change(module, key, method, value, operation = method === \"POST\" ? \"write\" : \"delete\") {\n        const state = sessions.get(module);\n        if (!state?.definition) throw new Error(\"Open the module first\");\n        if (state.saving) throw new Error(\"A settings write is already in progress\");\n        const field = state.definition.fields.find(field => field.key === key);\n        state.saving = true;\n        try {\n            if ((operation === \"write\" || operation === \"delete\") && (!field || (method === \"POST\" && !validValue(field, value)))) throw new TypeError(\"Invalid setting value\");\n            await send(`/api/${key.split(\".\").map(encodeURIComponent).join(\"/\")}`, method, value);\n            if (sessions.get(module) === state) {\n                switch (operation) {\n                    case \"write\":\n                        state.values[key] = structuredClone(value);\n                        break;\n                    case \"delete\":\n                    case \"clearCaches\":\n                    case \"reset\":\n                        for (const candidate of state.definition.fields) {\n                            if (candidate.key !== key && !candidate.key.startsWith(`${key}.`)) continue;\n                            delete state.values[candidate.key];\n                            if (Object.hasOwn(candidate, \"defaultValue\")) state.values[candidate.key] = structuredClone(candidate.defaultValue);\n                        }\n                        break;\n                }\n            }\n            notify({ kind: \"success\", operation, module, key });\n        } catch (error) {\n            notify({ kind: \"error\", operation, module, key, message: error.message });\n            throw error;\n        } finally {\n            state.saving = false;\n        }\n    }\n    return {\n        /**\n         * 从已导入的 JSON 创建新会话，只读取一次设置值。\n         * Create a session from imported JSON and read stored settings once.\n         * @param {string} module 模块标识 / Module identifier.\n         * @returns {Promise<import(\"./client.mjs\").ModuleSnapshot>} 新快照 / New snapshot.\n         * @throws {Error} 读取失败、会话被替换或写入尚未完成 / Read failure, replaced session or unfinished write.\n         */\n        async open(module) {\n            const binding = catalog.modules.get(module);\n            if (!binding) throw new TypeError(`No BoxJS settings for module: ${module}`);\n            const previous = sessions.get(module);\n            if (previous?.saving) throw new Error(\"Cannot refresh while saving\");\n            previous?.controller.abort();\n            const state = { controller: new AbortController(), definition: null, values: {}, saving: false };\n            sessions.set(module, state);\n            try {\n                const definition = normalizeBoxJs(catalog.select(module), module);\n                const response = await send(`/api/${definition.settingsPath.map(encodeURIComponent).join(\"/\")}/`, \"GET\", undefined, state.controller.signal);\n                let subtree = response.status === 404 ? {} : await response.json();\n                if (typeof subtree === \"string\") subtree = JSON.parse(subtree);\n                if (!subtree || typeof subtree !== \"object\" || Array.isArray(subtree)) throw new TypeError(\"Expected a settings subtree object\");\n                if (sessions.get(module) !== state) throw new Error(\"Module session was replaced\");\n                state.definition = definition;\n                for (const field of definition.fields) {\n                    const stored = field.key\n                        .split(\".\")\n                        .slice(definition.settingsPath.length)\n                        .reduce((parent, part) => Object(parent)[part], subtree);\n                    const value = stored === undefined ? field.defaultValue : stored;\n                    if (value !== undefined) state.values[field.key] = normalizeStoredValue(field, value);\n                }\n                return snapshot(module);\n            } catch (error) {\n                if (sessions.get(module) === state) sessions.delete(module);\n                throw error;\n            }\n        },\n        snapshot,\n        /**\n         * 按需读取模块 Caches，不自动读取其它设置。\n         * Read module Caches on demand without refreshing other settings.\n         * @param {string} module 已打开的模块 / Open module.\n         * @returns {Promise<unknown>} 缓存值，缺失为 undefined / Cache value, or undefined when absent.\n         */\n        async readCaches(module) {\n            const state = sessions.get(module);\n            if (!state?.definition) throw new Error(\"Open the module first\");\n            const response = await send(`/api/${encodeURIComponent(module)}/Caches`, \"GET\", undefined, state.controller.signal);\n            return response.status === 404 ? undefined : response.json();\n        },\n        /**\n         * 删除整个 Caches 节点，成功后不追加 GET。\n         * Delete the entire Caches node without a follow-up GET.\n         * @param {string} module 已打开模块 / Open module.\n         * @returns {Promise<void>} 清理完成 / Cleanup completion.\n         */\n        clearCaches: module => change(module, `${module}.Caches`, \"DELETE\", undefined, \"clearCaches\"),\n        /**\n         * 删除整个模块持久化节点，以当前 BoxJS 默认值重置页面缓存。\n         * Delete module persistence and reset the page cache using current BoxJS defaults.\n         * @param {string} module 已打开模块 / Open module.\n         * @returns {Promise<void>} 重置完成 / Reset completion.\n         */\n        reset: module => change(module, module, \"DELETE\", undefined, \"reset\"),\n        /**\n         * 取消读取并清除会话，不撤销已发送的写入。\n         * Abort reads and clear the session without undoing dispatched writes.\n         * @param {string} module 模块标识 / Module identifier.\n         * @returns {void} 无返回值 / No return value.\n         */\n        leave(module) {\n            sessions.get(module)?.controller.abort();\n            sessions.delete(module);\n        },\n        /**\n         * 写入单键并更新当前会话。\n         * Write one key and update the current session.\n         * @param {string} module 已打开模块 / Open module.\n         * @param {string} key 点分字段路径 / Dotted field path.\n         * @param {import(\"../index.js\").SettingsScalar | import(\"../index.js\").SettingsScalar[]} value 字段值 / Field value.\n         * @returns {Promise<void>} 写入完成 / Write completion.\n         */\n        set: (module, key, value) => change(module, key, \"POST\", value),\n        /**\n         * 删除单键覆盖值并显示默认值。\n         * Delete one override and display its default value.\n         * @param {string} module 已打开模块 / Open module.\n         * @param {string} key 点分字段路径 / Dotted field path.\n         * @returns {Promise<void>} 删除完成 / Delete completion.\n         */\n        remove: (module, key) => change(module, key, \"DELETE\"),\n    };\n}\n\n/**\n * 同一文档内的主页/子页导航；iframe 各自的实例通过浏览器联合历史协作。\n * Navigate home/detail views within a document; iframe instances cooperate through joint browser history.\n */\nclass Navigation extends EventTarget {\n    #container;\n    #home;\n    #create;\n    #window;\n    #key = null;\n    #view;\n    #retiring;\n    #controller;\n    #animation;\n    #scroll = new WeakMap();\n    #onHistory = () => this.#route();\n    #onPageShow = event => {\n        if (event.persisted) this.#route(true);\n    };\n\n    /**\n     * 根视图始终保留；工厂按需提供子页，可用 signal 取消离开后的异步加载。\n     * Retain the home view and create details on demand; signal cancels async work after departure.\n     * @param {HTMLElement} container 由调用方布局的页面容器 / Caller-styled view container.\n     * @param {HTMLElement} home 已创建的主页节点 / Existing home view.\n     * @param {(key: string, signal: AbortSignal) => HTMLElement | undefined} create 子页工厂；未知路径返回 undefined / Detail factory; undefined for unknown routes.\n     */\n    constructor(container, home, create) {\n        super();\n        this.#container = container;\n        this.#home = home;\n        this.#create = create;\n        this.#window = container.ownerDocument.defaultView;\n        container.replaceChildren(home);\n        this.#window.addEventListener(\"popstate\", this.#onHistory);\n        this.#window.addEventListener(\"hashchange\", this.#onHistory);\n        this.#window.addEventListener(\"pageshow\", this.#onPageShow);\n        this.#route();\n    }\n\n    /**\n     * 当前子页键；空字符串表示主页。\n     * Current detail key; empty means home.\n     */\n    get current() {\n        return this.#key;\n    }\n\n    /**\n     * 是否可以返回上一级或先前文档。\n     * Whether a parent view or previous document is available.\n     */\n    get canGoBack() {\n        return Boolean(this.#key) || this.#window.history.length > 1;\n    }\n\n    /**\n     * 加入子页历史；使用文档自身 URL，避免 srcdoc 按宿主 base URL 跳转。\n     * Push a detail using the document URL, avoiding srcdoc navigation against the host base URL.\n     * @param {string} key 子页键 / Detail key.\n     * @returns {void} 无返回值 / No return value.\n     */\n    open(key) {\n        if (key === this.#key) return;\n        const url = new URL(this.#window.location.href);\n        url.hash = encodeURIComponent(key);\n        this.#window.history.pushState({ ...this.#window.history.state, preferencePanesRoute: key }, \"\", url.href);\n        this.#route();\n    }\n\n    /**\n     * 沿浏览器联合历史返回，根页可退回宿主或上个文档。\n     * Go back through joint history, including a host or previous document from home.\n     * @returns {void} 无返回值 / No return value.\n     */\n    back() {\n        if (this.canGoBack) this.#window.history.back();\n    }\n\n    /**\n     * 解析 URL 并统一处理页面切换、加载取消与动画结束后的释放。\n     * Resolve the URL and coordinate transitions, cancellation and release after animation.\n     * @param {boolean} [reload] 从页面缓存恢复时重新创建子页 / Recreate a detail after bfcache restoration.\n     * @returns {void} 无返回值 / No return value.\n     */\n    #route(reload = false) {\n        const url = new URL(this.#window.location.href);\n        let key;\n        try {\n            key = decodeURIComponent(url.hash.slice(1));\n        } catch (error) {\n            if (!(error instanceof URIError)) throw error;\n            key = \"\";\n        }\n        if (!reload && key === this.#key) return;\n        this.#controller?.abort();\n        this.#controller = new AbortController();\n        const next = key ? this.#create(key, this.#controller.signal) : undefined;\n        if (!next) key = \"\";\n        const history = this.#window.history;\n        // 直接打开子页时建立一次主页历史；刷新不重复堆叠。\n        // Seed home history once for direct details, without stacking entries on reload.\n        if (url.hash && history.state?.preferencePanesRoute !== key) {\n            url.hash = \"\";\n            history.replaceState({ ...history.state, preferencePanesRoute: \"\" }, \"\", url.href);\n            if (key) {\n                url.hash = encodeURIComponent(key);\n                history.pushState({ ...history.state, preferencePanesRoute: key }, \"\", url.href);\n            }\n        }\n        const previous = this.#view;\n        const position = previous ? this.#window.getComputedStyle(previous).transform : \"none\";\n        this.#animation?.cancel();\n        this.#retiring?.remove();\n        this.#retiring = previous;\n        if (previous) {\n            this.#scroll.set(previous, previous.scrollTop);\n            previous.inert = true;\n        }\n        this.#key = key;\n        this.#view = next;\n        this.#home.inert = Boolean(next);\n        if (next) {\n            next.inert = false;\n            this.#container.append(next);\n            next.scrollTop = this.#scroll.get(next) ?? 0;\n        }\n        const moving = next ?? previous;\n        if (moving) {\n            const animation = moving.animate([{ transform: next ? \"translateX(100%)\" : position }, { transform: next ? \"translateX(0)\" : \"translateX(100%)\" }], { duration: this.#window.matchMedia(\"(prefers-reduced-motion: reduce)\").matches ? 0 : 280, easing: \"cubic-bezier(.22,.61,.36,1)\", fill: \"forwards\" });\n            this.#animation = animation;\n            animation.onfinish = () => {\n                if (this.#animation !== animation) return;\n                this.#retiring?.remove();\n                this.#retiring = undefined;\n                animation.cancel();\n                this.#animation = undefined;\n            };\n        }\n        this.dispatchEvent(new Event(\"change\"));\n    }\n\n    /**\n     * 释放监听器、加载、动画和节点；调用方可重新创建导航。\n     * Release listeners, loads, animations and nodes so callers can recreate navigation.\n     * @returns {void} 无返回值 / No return value.\n     */\n    destroy() {\n        this.#window.removeEventListener(\"popstate\", this.#onHistory);\n        this.#window.removeEventListener(\"hashchange\", this.#onHistory);\n        this.#window.removeEventListener(\"pageshow\", this.#onPageShow);\n        this.#controller?.abort();\n        this.#animation?.cancel();\n        this.#retiring?.remove();\n        this.#view?.remove();\n        this.#home.remove();\n    }\n}\n\n/**\n * 挂载已导入 BoxJS 对应的模块表单和短暂通知。\n * Mount the imported BoxJS module form and transient notifications.\n * @param {HTMLElement} root 包内挂载元素 / Internal mount element.\n * @param {import(\"../BoxJS.mjs\").BoxJS} catalog 包内 BoxJS 目录 / Internal BoxJS catalog.\n * @returns {import(\"./index.js\").MountedPreferences} 面板生命周期句柄 / Panel lifecycle handle.\n */\nfunction mountPanel(root, catalog) {\n    const title = catalog.module.metadata.name ?? catalog.module.module;\n    const document = root.ownerDocument;\n    const window = document.defaultView;\n    const shell = element(\"div\", \"pp-panel\");\n    shell.dataset.module = catalog.module.module;\n    const header = element(\"header\", \"pp-header\");\n    const back = element(\"button\", \"pp-back\", \"‹\");\n    back.setAttribute(\"aria-label\", \"返回\");\n    back.type = \"button\";\n    const heading = element(\"h1\", \"pp-title\", title);\n    const brand = element(\"div\", \"pp-brand\");\n    const logo = element(\"span\", \"pp-brand-icon\");\n    logo.setAttribute(\"aria-hidden\", \"true\");\n    const image = icon(catalog.module.metadata, \"\");\n    if (image) logo.append(image);\n    brand.append(logo, heading);\n    const viewport = element(\"div\", \"pp-viewport\");\n    const toast = element(\"div\", \"pp-toast\");\n    toast.setAttribute(\"role\", \"status\");\n    toast.hidden = true;\n    header.append(back, brand, element(\"span\", \"pp-nav-spacer\"));\n    shell.append(header, viewport, toast);\n    root.append(shell);\n    // 嵌入模式向宿主发布导航状态，宿主不读取或修改模块内部 DOM。\n    // Embedded mode publishes navigation state without host reads or mutations of the module DOM.\n    const publishNavigation = () => {\n        const frame = window.frameElement;\n        if (!frame?.dataset.preferencePanes) return;\n        frame.dispatchEvent(\n            new frame.ownerDocument.defaultView.CustomEvent(\"preferencepanes:change\", {\n                detail: { title: heading.textContent, module: catalog.module.module, busy: saving, canGoBack: !back.disabled },\n            }),\n        );\n    };\n    let timer,\n        navigation,\n        generation = 0,\n        active = null,\n        saving = false,\n        destroyed = false;\n    /**\n     * 展示短暂通知，不刷新设置数据。\n     * Display a transient notification without refreshing settings.\n     * @param {{kind: \"success\" | \"error\", operation?: \"write\" | \"delete\" | \"clearCaches\" | \"reset\", message?: string}} event 操作结果 / Operation result.\n     * @returns {void} 无返回值 / No return value.\n     */\n    const notify = event => {\n        if (destroyed) return;\n        switch (true) {\n            case event.kind === \"error\":\n                toast.textContent = `操作失败：${event.message}`;\n                break;\n            case event.operation === \"delete\":\n                toast.textContent = \"删除成功\";\n                break;\n            case event.operation === \"clearCaches\":\n                toast.textContent = \"Caches 已清空\";\n                break;\n            case event.operation === \"reset\":\n                toast.textContent = \"模块已重置\";\n                break;\n            default:\n                toast.textContent = \"修改成功\";\n                break;\n        }\n        toast.dataset.kind = event.kind;\n        toast.hidden = false;\n        clearTimeout(timer);\n        timer = setTimeout(() => {\n            toast.hidden = true;\n        }, 2400);\n    };\n    const client = createPreferencesClient({ catalog, notify });\n    /**\n     * 打开模块并忽略已过期的异步结果。\n     * Open a module and ignore stale asynchronous results.\n     * @param {string} module 模块标识 / Module identifier.\n     * @returns {Promise<void>} 视图加载完成，失败显示错误视图 / View load completion; failures display an error view.\n     */\n    async function open(module) {\n        const version = ++generation;\n        active = module;\n        back.disabled = window.history.length <= 1;\n        heading.textContent = module;\n        publishNavigation();\n        viewport.replaceChildren(element(\"p\", \"pp-loading\", \"读取设置…\"));\n        try {\n            await client.open(module);\n            if (version === generation) controls();\n        } catch (error) {\n            if (version !== generation) return;\n            viewport.replaceChildren(errorView(error, () => open(module)));\n            publishNavigation();\n        }\n    }\n    /**\n     * 从会话快照创建控件与操作按钮，不重新读取网络配置。\n     * Build controls and actions from the session snapshot without fetching config again.\n     * @returns {void} 无返回值 / No return value.\n     */\n    function controls() {\n        const { definition, values } = client.snapshot(active);\n        heading.textContent = definition.metadata?.name || active;\n        const view = element(\"section\", \"pp-fields\");\n        /**\n         * 挂载后执行的多行高度更新\n         * Textarea sizing callbacks run after mounting.\n         * @type {Array<() => void>}\n         */\n        const growingInputs = [];\n        const editors = new Map();\n        const summaries = [];\n        const groups = new Map();\n        let queue = Promise.resolve(),\n            pendingWrites = 0;\n        /**\n         * 导航组件处理页面切换，表单只更新当前标题与返回按钮。\n         * Let navigation own transitions; the form only updates the title and back button.\n         * @returns {void} 无返回值 / No return value.\n         */\n        const updateNavigation = () => {\n            const editor = editors.get(navigation.current);\n            heading.textContent = editor?.title ?? definition.metadata?.name ?? active;\n            back.disabled = saving || !navigation.canGoBack;\n            publishNavigation();\n        };\n        /**\n         * 串行执行模块操作，保持输入可编辑。\n         * Serialize module actions while keeping inputs editable.\n         * @param {() => Promise<void>} action 请求或写入 / Request or mutation.\n         * @param {() => void} success 成功后的局部更新 / Local update after success.\n         * @param {() => void} [failure] 失败后恢复当前输入 / Restore the current input on failure.\n         * @returns {Promise<void>} 操作完成 / Operation completion.\n         */\n        function perform(action, success, failure = () => {}) {\n            pendingWrites++;\n            saving = true;\n            back.disabled = true;\n            publishNavigation();\n            return (queue = queue\n                .then(action)\n                .then(() => {\n                    if (!destroyed) success();\n                })\n                .catch(() => {\n                    /* 请求层已通知错误。\n                     * The request layer has already reported the error. */\n                    if (!destroyed) failure();\n                })\n                .finally(() => {\n                    pendingWrites--;\n                    saving = pendingWrites > 0;\n                    if (destroyed && !saving) client.leave(active);\n                    back.disabled = saving || !navigation.canGoBack;\n                    publishNavigation();\n                }));\n        }\n        const metadata = definition.metadata;\n        if (metadata) {\n            const info = element(\"div\", \"pp-module-info\");\n            const image = icon(metadata, \"pp-module-icon\");\n            if (image) info.append(image);\n            const details = element(\"div\", \"pp-module-details\");\n            for (const description of [metadata.author, metadata.desc ?? metadata.description, ...(metadata.descs ?? [])]) if (description) details.append(element(\"p\", \"pp-description\", description));\n            if (metadata.repo) {\n                const link = element(\"a\", \"pp-module-source\", \"项目主页\");\n                link.href = resourceURL(metadata.repo);\n                link.target = \"_blank\";\n                link.rel = \"noopener noreferrer\";\n                details.append(link);\n            }\n            info.append(details);\n            view.append(info);\n        }\n        for (const field of definition.fields) {\n            const match = /^\\[([^\\]]+)\\]\\s*(.*)$/.exec(field.name);\n            const group = match?.[1] ?? \"通用\";\n            if (!groups.has(group)) {\n                const section = element(\"section\", \"form-group\");\n                const rows = element(\"div\", \"form-group__row\");\n                section.append(element(\"h2\", \"form-group__title\", group), rows);\n                groups.set(group, rows);\n                view.append(section);\n            }\n            const row = element(\"div\", \"form-row pp-field\");\n            const label = element(\"div\", \"form-row__text\");\n            label.append(element(\"span\", \"form-row__title\", match?.[2] ?? field.name));\n            if (field.description) label.append(element(\"span\", \"form-row__subtitle\", field.description));\n            row.append(label);\n            const value = values[field.key];\n            /**\n             * 读取尚未保存的输入\n             * Read the unsaved input.\n             * @type {() => unknown}\n             */\n            let read;\n            /**\n             * 更新当前控件\n             * Update the current control.\n             * @type {(value: unknown) => void}\n             */\n            let write;\n            let inputContainer = row;\n            let eventName = \"change\";\n            switch (true) {\n                case Boolean(field.options) && field.type !== \"array\": {\n                    const select = element(\"select\", \"pp-input\");\n                    select.setAttribute(\"aria-label\", field.name);\n                    field.options.forEach((option, index) => {\n                        const item = element(\"option\", \"\", option.label);\n                        item.value = String(index);\n                        select.append(item);\n                    });\n                    write = value => {\n                        select.selectedIndex = field.options.findIndex(option => option.key === value);\n                    };\n                    row.append(select);\n                    read = () => field.options[select.selectedIndex]?.key;\n                    break;\n                }\n                case field.type === \"array\" && Boolean(field.options): {\n                    const page = element(\"section\", \"pp-choice-page\");\n                    if (field.description) page.append(element(\"p\", \"pp-description\", field.description));\n                    const choices = element(\"div\", \"form-group__row\");\n                    page.append(choices);\n                    inputContainer = choices;\n                    editors.set(field.key, { node: page, title: match?.[2] ?? field.name });\n                    const summary = element(\"span\", \"form-row__value pp-summary\");\n                    const link = element(\"button\", \"pp-choice-link\");\n                    link.type = \"button\";\n                    link.setAttribute(\"aria-label\", field.name);\n                    link.append(summary, element(\"span\", \"pp-chevron\", \"›\"));\n                    row.append(link);\n                    const refresh = () => {\n                        const value = client.snapshot(active).values[field.key];\n                        summary.textContent =\n                            field.options\n                                .filter(option => Array.isArray(value) && value.includes(option.key))\n                                .map(option => option.label)\n                                .join(\"、\") || \"未选择\";\n                    };\n                    summaries.push(refresh);\n                    refresh();\n                    link.onclick = () => navigation.open(field.key);\n                    row.addEventListener(\"click\", event => {\n                        if (!link.contains(event.target)) link.click();\n                    });\n                    const inputs = field.options.map(option => {\n                        const label = element(\"label\", \"form-row pp-choice\", option.label);\n                        const input = element(\"input\", \"\");\n                        input.type = \"checkbox\";\n                        input.setAttribute(\"aria-label\", option.label);\n                        label.append(input);\n                        choices.append(label);\n                        return { input, key: option.key };\n                    });\n                    read = () => inputs.filter(option => option.input.checked).map(option => option.key);\n                    write = value => {\n                        for (const option of inputs) option.input.checked = Array.isArray(value) && value.includes(option.key);\n                    };\n                    break;\n                }\n                default: {\n                    const multiline = field.control === \"textarea\" || field.type === \"array\";\n                    const input = element(multiline ? \"textarea\" : \"input\", \"pp-input\");\n                    if (multiline) row.classList.add(\"pp-multiline\");\n                    input.setAttribute(\"aria-label\", field.name);\n                    if (field.placeholder) input.placeholder = field.placeholder;\n                    if (multiline && field.rows) input.rows = field.rows;\n                    /**\n                     * 在挂载后根据内容调整高度，同时保留基础行数。\n                     * Size mounted textareas to their contents while retaining baseline rows.\n                     * @returns {void} 无返回值 / No return value.\n                     */\n                    const grow = () => {\n                        if (!multiline || !field.autoGrow || !input.isConnected) return;\n                        input.style.height = \"auto\";\n                        const baseline = input.getBoundingClientRect().height;\n                        const style = window.getComputedStyle(input);\n                        const borders = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);\n                        input.style.height = `${Math.max(baseline, input.scrollHeight + borders)}px`;\n                    };\n                    if (multiline && field.autoGrow) {\n                        input.addEventListener(\"input\", grow);\n                        growingInputs.push(grow);\n                    }\n                    if (field.type === \"boolean\") {\n                        input.type = \"checkbox\";\n                        input.classList.add(\"pp-switch\");\n                        input.setAttribute(\"role\", \"switch\");\n                        write = value => {\n                            input.checked = value === true;\n                        };\n                        read = () => input.checked;\n                    } else {\n                        eventName = \"input\";\n                        if (!multiline) input.type = field.type === \"number\" ? \"number\" : \"text\";\n                        write = value => {\n                            input.value = field.type === \"array\" ? JSON.stringify(value ?? []) : (value ?? \"\");\n                            grow();\n                        };\n                        read = () => {\n                            switch (field.type) {\n                                case \"array\":\n                                    return JSON.parse(input.value);\n                                case \"number\":\n                                    return input.value === \"\" ? Number.NaN : Number(input.value);\n                                default:\n                                    return input.value;\n                            }\n                        };\n                    }\n                    row.append(input);\n                    break;\n                }\n            }\n            write(value);\n            let inputVersion = 0;\n            inputContainer.addEventListener(eventName, event => {\n                if (event.isComposing) return;\n                const version = ++inputVersion,\n                    module = active;\n                let value;\n                try {\n                    value = read();\n                } catch (error) {\n                    notify({ kind: \"error\", message: error.message });\n                    return;\n                }\n                const restore = () => {\n                    if (version === inputVersion) write(client.snapshot(module).values[field.key]);\n                };\n                perform(\n                    () => client.set(module, field.key, value),\n                    () => {\n                        for (const refresh of summaries) refresh();\n                    },\n                    restore,\n                );\n            });\n            if (eventName === \"input\") inputContainer.addEventListener(\"compositionend\", event => event.target.dispatchEvent(new window.Event(\"input\", { bubbles: true })));\n            groups.get(group).append(row);\n        }\n        const maintenance = element(\"section\", \"pp-maintenance\");\n        maintenance.append(element(\"h2\", \"pp-title\", \"模块数据\"));\n        const actions = element(\"div\", \"pp-actions\");\n        const cacheView = element(\"button\", \"\", \"查看 Caches\");\n        const cacheClear = element(\"button\", \"\", \"清空 Caches\");\n        const reset = element(\"button\", \"pp-danger\", \"重置模块\");\n        const output = element(\"pre\", \"pp-cache\");\n        output.hidden = true;\n        output.setAttribute(\"aria-label\", \"Caches 内容\");\n        for (const button of [cacheView, cacheClear, reset]) button.type = \"button\";\n        cacheView.onclick = () => {\n            if (saving) return;\n            let value;\n            return perform(\n                async () => {\n                    try {\n                        value = await client.readCaches(active);\n                    } catch (error) {\n                        notify({ kind: \"error\", message: error.message });\n                        throw error;\n                    }\n                },\n                () => {\n                    output.textContent = value === undefined ? \"暂无缓存\" : JSON.stringify(value, null, 2);\n                    output.hidden = false;\n                    cacheView.textContent = \"刷新 Caches\";\n                },\n            );\n        };\n        cacheClear.onclick = () => {\n            if (saving) return;\n            if (!window.confirm(`清空 ${active} 的全部 Caches？`)) return;\n            return perform(\n                () => client.clearCaches(active),\n                () => {\n                    output.textContent = \"暂无缓存\";\n                },\n            );\n        };\n        reset.onclick = () => {\n            if (saving) return;\n            if (!window.confirm(`重置 ${active}？这将删除该模块的 Settings、Caches 和其它持久化数据。`)) return;\n            return perform(() => client.reset(active), controls);\n        };\n        actions.append(cacheView, cacheClear, reset);\n        maintenance.append(actions, output);\n        view.append(maintenance);\n        navigation?.destroy();\n        navigation = new Navigation(viewport, view, key => editors.get(key)?.node);\n        navigation.addEventListener(\"change\", updateNavigation);\n        for (const grow of growingInputs) grow();\n        updateNavigation();\n    }\n    /**\n     * 已加载的表单交由导航组件返回；加载阶段可以返回先前文档。\n     * Loaded forms delegate back to navigation; loading views can return to the previous document.\n     * @returns {void} 无返回值 / No return value.\n     */\n    back.onclick = () => {\n        if (saving) return;\n        if (navigation) navigation.back();\n        else window.history.back();\n    };\n    open(catalog.module.module);\n    return {\n        /**\n         * 移除监听器、定时器、会话和挂载内容。\n         * Remove listeners, timers, session and mounted content.\n         * @returns {void} 无返回值 / No return value.\n         */\n        destroy() {\n            destroyed = true;\n            navigation?.destroy();\n            generation++;\n            if (active && !saving) client.leave(active);\n            clearTimeout(timer);\n            shell.remove();\n        },\n    };\n}\n\n/**\n * 只挂载导入 JSON 对应的模块设置页，默认样式内置，CSS 仅用于该页。\n * Mount only the imported module's settings page with built-in defaults and optional page CSS.\n * @param {import(\"../index.js\").BoxJSInput} boxjs 单个模块的 BoxJS JSON / BoxJS JSON for one module.\n * @param {string} [css] 可选 CSS 正文 / Optional CSS text.\n * @returns {import(\"./index.js\").MountedPreferences} 模块生命周期句柄 / Module lifecycle handle.\n */\nfunction mount(boxjs, css = \"\") {\n    if (typeof css !== \"string\") throw new TypeError(\"CSS must be a string\");\n    const catalog = new BoxJS(boxjs);\n    const metadata = catalog.module.metadata;\n    const image = metadata.icon || metadata.icons?.[1] || metadata.icons?.[0];\n    if (image) resourceURL(image);\n    if (metadata.repo) resourceURL(metadata.repo);\n    const existing = document.querySelector(\"#preferences\");\n    const root = existing ?? element(\"main\", \"\");\n    if (!existing) {\n        root.id = \"preferences\";\n        document.body.append(root);\n    }\n    const base = element(\"style\", \"\"),\n        custom = element(\"style\", \"\");\n    base.textContent = defaults;\n    custom.textContent = css;\n    document.head.append(base, custom);\n    const previousTitle = document.title;\n    const previousTheme = document.documentElement.dataset.theme;\n    const theme = navigator.userAgent.match(/themeId\\/(\\d+)/)?.[1];\n    if (theme) document.documentElement.dataset.theme = theme === \"2\" ? \"dark\" : \"light\";\n    document.title = metadata.name ?? catalog.module.module;\n    let panel;\n    const view = {\n        /**\n         * 释放模块视图、样式与会话，不操作项目入口页。\n         * Release the module view, styles and session without operating a project landing page.\n         * @returns {void} 无返回值 / No return value.\n         */\n        destroy() {\n            panel?.destroy();\n            base.remove();\n            custom.remove();\n            if (existing) root.replaceChildren();\n            else root.remove();\n            document.title = previousTitle;\n            if (previousTheme === undefined) delete document.documentElement.dataset.theme;\n            else document.documentElement.dataset.theme = previousTheme;\n        },\n    };\n    try {\n        root.replaceChildren();\n        panel = mountPanel(root, catalog);\n        return view;\n    } catch (error) {\n        view.destroy();\n        throw error;\n    }\n}\n\nlet view;\n/**\n * 从 URL 或代理传递的 Header 导入 JSON/CSS，支持独立文档与 srcdoc。\n * Import JSON/CSS from the URL or proxy-carried headers in standalone and srcdoc documents.\n * @returns {Promise<void>} 启动完成 / Startup completion.\n */\nasync function start() {\n    try {\n        view?.destroy();\n        view = undefined;\n        const context = document.querySelector('meta[name=\"preference-panes-inputs\"]');\n        const embedded = window.frameElement?.dataset.preferencePanes;\n        let inputs;\n        switch (true) {\n            case embedded !== undefined:\n                inputs = JSON.parse(embedded);\n                document.documentElement.dataset.preferencePanesEmbedded = \"\";\n                break;\n            case context !== null:\n                inputs = JSON.parse(decodeURIComponent(context.content));\n                break;\n            default:\n                inputs = pageInputs(new URL(location.href));\n        }\n        const resources = [inputs.json, inputs.css].map(source => {\n            if (!source) return null;\n            const url = new URL(source, inputs.url);\n            if (![\"http:\", \"https:\"].includes(url.protocol)) throw new TypeError(\"Resources must use HTTP(S) URLs\");\n            return url.href;\n        });\n        const [data, style] = await Promise.all(resources.map(url => (url ? fetch(url, { cache: \"no-store\", credentials: \"omit\" }) : null)));\n        if (data.status !== 200 || (style && style.status !== 200)) throw new Error(`HTTP ${data.status !== 200 ? data.status : style.status}`);\n        const boxjs = await data.json();\n        if (new BoxJS(boxjs).module.module !== inputs.module) throw new Error(\"Imported JSON does not match the module URL\");\n        view = mount(boxjs, style ? await style.text() : \"\");\n    } catch (error) {\n        document.querySelector(\"#preferences\").replaceChildren(errorView(error, start));\n    }\n}\nstart();\nwindow.addEventListener(\"pageshow\", event => {\n    if (event.persisted) start();\n});\n"}};

    /**
     * 解析已经取得的 pathname，避免重复构造 URL。
     * Parse an existing pathname without constructing another URL.
     * @param {string} pathname 以 / 开头的 URL pathname / URL pathname beginning with /.
     * @returns {string[] | undefined} 解码后的路径，非 API 路径不处理 / Decoded path, or undefined outside /api/.
     * @throws {TypeError} 转义编码或路径片段非法 / Invalid percent encoding or path segments.
     */
    function parseSettingsPathname(pathname) {
        if (!pathname.startsWith("/api/")) return;
        let parts;
        try {
            parts = pathname.slice(5).replace(/\/$/, "").split("/").map(decodeURIComponent);
        } catch {
            throw new TypeError("Invalid encoded key path");
        }
        return validatePathParts(parts);
    }

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
     * 统一生成不可缓存的响应，HEAD 始终省略正文。
     * Create an uncached response, always omitting the body for HEAD.
     * @param {import("../index.js").SettingsRequest} request 宿主请求 / Host request.
     * @param {number} status HTTP 状态 / HTTP status.
     * @param {unknown} body JSON 数据或资源正文 / JSON data or resource body.
     * @param {string} [type] 媒体类型 / Media type.
     * @returns {import("../index.js").SettingsResponse} 通用响应 / Common response.
     */
    function response(request, status, body, type = "application/json") {
        return {
            status,
            headers: { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
            body: request.method === "HEAD" ? "" : type === "application/json" ? JSON.stringify(body) : body,
        };
    }

    /* https://www.lodashjs.com */
    /**
     * 轻量 Lodash 工具集。
     * Lightweight Lodash-like utilities.
     *
     * 说明:
     * Notes:
     * - 这是 Lodash 的“部分方法”简化实现，不等价于完整 Lodash
     * - This is a simplified subset, not a full Lodash implementation
     * - 各方法语义可参考 Lodash 官方文档
     * - Method semantics can be referenced from official Lodash docs
     * - 导入时建议使用 `Lodash as _`，遵循 lodash 官方示例惯例
     * - Use `Lodash as _` when importing, following official lodash example convention
     *
     * 参考:
     * Reference:
     * - https://www.lodashjs.com
     * - https://lodash.com
     */
    class Lodash {
    	/**
    	 * HTML 特殊字符转义。
    	 * Escape HTML special characters.
    	 *
    	 * @param {string} string 输入文本 / Input text.
    	 * @returns {string}
    	 * @see {@link https://lodash.com/docs/#escape lodash.escape}
    	 * @see {@link https://www.lodashjs.com/docs/lodash.escape lodash.escape (中文)}
    	 */
    	static escape(string) {
    		const map = {
    			"&": "&amp;",
    			"<": "&lt;",
    			">": "&gt;",
    			'"': "&quot;",
    			"'": "&#39;",
    		};
    		return string.replace(/[&<>"']/g, m => map[m]);
    	}

    	/**
    	 * 按路径读取对象值。
    	 * Get object value by path.
    	 *
    	 * @param {object} [object={}] 目标对象 / Target object.
    	 * @param {string|string[]} [path=""] 路径 / Path.
    	 * @param {*} [defaultValue=undefined] 默认值 / Default value.
    	 * @returns {*}
    	 * @see {@link https://lodash.com/docs/#get lodash.get}
    	 * @see {@link https://www.lodashjs.com/docs/lodash.get lodash.get (中文)}
    	 */
    	static get(object = {}, path = "", defaultValue = undefined) {
    		// translate array case to dot case, then split with .
    		// a[0].b -> a.0.b -> ['a', '0', 'b']
    		if (!Array.isArray(path)) path = Lodash.toPath(path);

    		const result = path.reduce((previousValue, currentValue) => {
    			return Object(previousValue)[currentValue]; // null undefined get attribute will throwError, Object() can return a object
    		}, object);
    		return result === undefined ? defaultValue : result;
    	}

    	/**
    	 * 递归合并源对象的自身可枚举属性到目标对象
    	 * Recursively merge source enumerable properties into target object.
    	 * @description 简化版 lodash.merge，用于合并配置对象
    	 * @description A simplified lodash.merge for config merging.
    	 *
    	 * 适用情况:
    	 * - 合并嵌套的配置/设置对象
    	 * - 需要深度合并而非浅层覆盖的场景
    	 * - 多个源对象依次合并到目标对象
    	 *
    	 * 限制:
    	 * - 仅处理普通对象 (Plain Object)，不处理 Date/RegExp 等特殊对象
    	 * - Map/Set 仅支持同类型合并，不递归内部值
    	 * - 数组会被直接覆盖，不会合并数组元素
    	 * - 不处理循环引用，可能导致栈溢出
    	 * - 不复制 Symbol 属性和不可枚举属性
    	 * - 不保留原型链，仅处理自身属性
    	 * - 会修改原始目标对象 (mutates target)
    	 *
    	 * @param {object} object - 目标对象
    	 * @param {object} object - Target object.
    	 * @param {...object} sources - 源对象(可多个)
    	 * @param {...object} sources - Source objects.
    	 * @returns {object} 返回合并后的目标对象
    	 * @returns {object} Merged target object.
    	 * @see {@link https://lodash.com/docs/#merge lodash.merge}
    	 * @see {@link https://www.lodashjs.com/docs/lodash.merge lodash.merge (中文)}
    	 * @example
    	 * const target = { a: { b: 1 }, c: 2 };
    	 * const source = { a: { d: 3 }, e: 4 };
    	 * Lodash.merge(target, source);
    	 * // => { a: { b: 1, d: 3 }, c: 2, e: 4 }
    	 */
    	static merge(object, ...sources) {
    		if (object === null || object === undefined) return object;

    		for (const source of sources) {
    			if (source === null || source === undefined) continue;

    			for (const key of Object.keys(source)) {
    				const sourceValue = source[key];
    				const targetValue = object[key];

    				switch (true) {
    					case Lodash.#isPlainObject(sourceValue) && Lodash.#isPlainObject(targetValue):
    						// 递归合并对象
    						object[key] = Lodash.merge(targetValue, sourceValue);
    						break;
    					case sourceValue instanceof Map && targetValue instanceof Map:
    						// 合并 Map（空 Map 跳过）
    						if (sourceValue.size > 0) {
    							for (const [k, v] of sourceValue) {
    								targetValue.set(k, v);
    							}
    						}
    						break;
    					case sourceValue instanceof Set && targetValue instanceof Set:
    						// 合并 Set（空 Set 跳过）
    						if (sourceValue.size > 0) {
    							for (const v of sourceValue) {
    								targetValue.add(v);
    							}
    						}
    						break;
    					case Array.isArray(sourceValue) && sourceValue.length === 0 && targetValue !== undefined:
    						// 空数组不覆盖已有值
    						break;
    					case (sourceValue instanceof Map && sourceValue.size === 0 && targetValue !== undefined):
    					case (sourceValue instanceof Set && sourceValue.size === 0 && targetValue !== undefined):
    						// 空 Map/Set 不覆盖已有值
    						break;
    					case sourceValue !== undefined:
    						object[key] = sourceValue;
    						break;
    				}
    			}
    		}

    		return object;
    	}

    	/**
    	 * 判断值是否为普通对象 (Plain Object)
    	 * Check whether a value is a plain object.
    	 * @param {*} value - 要检查的值
    	 * @param {*} value - Value to check.
    	 * @returns {boolean} 如果是普通对象返回 true
    	 * @returns {boolean} Returns true when value is a plain object.
    	 * @see {@link https://lodash.com/docs/#isPlainObject lodash.isPlainObject}
    	 * @see {@link https://www.lodashjs.com/docs/lodash.isPlainObject lodash.isPlainObject (中文)}
    	 */
    	static #isPlainObject(value) {
    		if (value === null || typeof value !== "object") return false;
    		const proto = Object.getPrototypeOf(value);
    		return proto === null || proto === Object.prototype;
    	}

    	/**
    	 * 删除对象指定路径并返回对象。
    	 * Omit paths from object and return the same object.
    	 *
    	 * @param {object} [object={}] 目标对象 / Target object.
    	 * @param {string|string[]} [paths=[]] 要删除的路径 / Paths to remove.
    	 * @returns {object}
    	 * @see {@link https://lodash.com/docs/#omit lodash.omit}
    	 * @see {@link https://www.lodashjs.com/docs/lodash.omit lodash.omit (中文)}
    	 */
    	static omit(object = {}, paths = []) {
    		if (!Array.isArray(paths)) paths = [paths.toString()];
    		paths.forEach(path => Lodash.unset(object, path));
    		return object;
    	}

    	/**
    	 * 仅保留对象指定键（第一层）。
    	 * Pick selected keys from object (top level only).
    	 *
    	 * @param {object} [object={}] 目标对象 / Target object.
    	 * @param {string|string[]} [paths=[]] 需要保留的键 / Keys to keep.
    	 * @returns {object}
    	 * @see {@link https://lodash.com/docs/#pick lodash.pick}
    	 * @see {@link https://www.lodashjs.com/docs/lodash.pick lodash.pick (中文)}
    	 */
    	static pick(object = {}, paths = []) {
    		if (!Array.isArray(paths)) paths = [paths.toString()];
    		const filteredEntries = Object.entries(object).filter(([key, value]) => paths.includes(key));
    		return Object.fromEntries(filteredEntries);
    	}

    	/**
    	 * 按路径写入对象值。
    	 * Set object value by path.
    	 *
    	 * @param {object} object 目标对象 / Target object.
    	 * @param {string|string[]} path 路径 / Path.
    	 * @param {*} value 写入值 / Value.
    	 * @returns {object}
    	 * @see {@link https://lodash.com/docs/#set lodash.set}
    	 * @see {@link https://www.lodashjs.com/docs/lodash.set lodash.set (中文)}
    	 */
    	static set(object, path, value) {
    		if (!Array.isArray(path)) path = Lodash.toPath(path);
    		path.slice(0, -1).reduce((previousValue, currentValue, currentIndex) => (Object(previousValue[currentValue]) === previousValue[currentValue] ? previousValue[currentValue] : (previousValue[currentValue] = /^\d+$/.test(path[currentIndex + 1]) ? [] : {})), object)[path[path.length - 1]] = value;
    		return object;
    	}

    	/**
    	 * 将点路径或数组下标路径转换为数组。
    	 * Convert dot/array-index path string into path segments.
    	 *
    	 * @param {string} value 路径字符串 / Path string.
    	 * @returns {string[]}
    	 * @see {@link https://lodash.com/docs/#toPath lodash.toPath}
    	 * @see {@link https://www.lodashjs.com/docs/lodash.toPath lodash.toPath (中文)}
    	 */
    	static toPath(value) {
    		return value
    			.replace(/\[(\d+)\]/g, ".$1")
    			.split(".")
    			.filter(Boolean);
    	}

    	/**
    	 * HTML 实体反转义。
    	 * Unescape HTML entities.
    	 *
    	 * @param {string} string 输入文本 / Input text.
    	 * @returns {string}
    	 * @see {@link https://lodash.com/docs/#unescape lodash.unescape}
    	 * @see {@link https://www.lodashjs.com/docs/lodash.unescape lodash.unescape (中文)}
    	 */
    	static unescape(string) {
    		const map = {
    			"&amp;": "&",
    			"&lt;": "<",
    			"&gt;": ">",
    			"&quot;": '"',
    			"&#39;": "'",
    		};
    		return string.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, m => map[m]);
    	}

    	/**
    	 * 删除对象路径对应的值。
    	 * Remove value by object path.
    	 *
    	 * @param {object} [object={}] 目标对象 / Target object.
    	 * @param {string|string[]} [path=""] 路径 / Path.
    	 * @returns {boolean}
    	 * @see {@link https://lodash.com/docs/#unset lodash.unset}
    	 * @see {@link https://www.lodashjs.com/docs/lodash.unset lodash.unset (中文)}
    	 */
    	static unset(object = {}, path = "") {
    		if (!Array.isArray(path)) path = Lodash.toPath(path);
    		const result = path.reduce((previousValue, currentValue, currentIndex) => {
    			if (currentIndex === path.length - 1) {
    				delete previousValue[currentValue];
    				return true;
    			}
    			return Object(previousValue)[currentValue];
    		}, object);
    		return result;
    	}
    }

    /**
     * 当前运行平台名称（脚本平台优先，模块系统次之）。
     * Current runtime platform name (script platform first, module system second).
     *
     * 识别顺序:
     * Detection order:
     * 1) `$task` -> Quantumult X
     * 2) `$loon` -> Loon
     * 3) `$rocket` -> Shadowrocket
     * 4) `Egern` -> Egern
     * 5) `$environment["surge-version"]` -> Surge
     * 6) `$environment["stash-version"]` -> Stash
     * 7) `Cloudflare` -> Worker
     * 8) `process.versions.node` -> Node.js
     * 9) 默认回落 -> undefined
     *    default fallback -> undefined
     *
     * 说明:
     * Notes:
     * - 使用 `'key' in globalThis`，避免 `Object.keys` 对不可枚举全局变量漏检。
     * - Use `'key' in globalThis` to avoid missing non-enumerable globals with `Object.keys`.
     *
     * @type {("Quantumult X" | "Loon" | "Shadowrocket" | "Egern" | "Surge" | "Stash" | "Worker" | "Node.js" | undefined)}
     */
    const $app = (() => {
    	const has = key => key in globalThis;
    	switch (true) {
    		case has("$task"):
    			return "Quantumult X";
    		case has("$loon"):
    			return "Loon";
    		case has("$rocket"):
    			return "Shadowrocket";
    		case has("Egern"):
    			return "Egern";
    		case Boolean(globalThis.$environment?.["surge-version"]):
    			return "Surge";
    		case Boolean(globalThis.$environment?.["stash-version"]):
    			return "Stash";
    		case has("Cloudflare"):
    			//case has("ServiceWorkerGlobalScope") && has("self") && has("caches") && has("scheduler"):
    			return "Worker";
    		case Boolean(globalThis.process?.versions?.node):
    			return "Node.js";
    		default:
    			return undefined;
    	}
    })();

    /**
     * 跨平台持久化存储适配器。
     * Cross-platform persistent storage adapter.
     *
     * 设计目标:
     * Design goal:
     * - 仿照 Web Storage (`Storage`) 接口设计
     * - Modeled after Web Storage (`Storage`) interface
     * - 统一 VPN App 脚本环境中的持久化读写接口
     * - Unify persistence APIs across VPN app script environments
     *
     * 支持后端:
     * Supported backends:
     * - Surge/Loon/Stash/Egern/Shadowrocket: `$persistentStore`
     * - Quantumult X: `$prefs`
     * - Worker: 内存缓存（非持久化）
     * - Worker: in-memory cache (non-persistent)
     * - Node.js: 由 Node.js ESM 入口注入持久化后端
     * - Node.js: persistent backend injected by the Node.js ESM entry
     *
     * 支持路径键:
     * Supports path key:
     * - `@root.path.to.value`
     *
     * 与 Web Storage 的已知差异:
     * Known differences from Web Storage:
     * - 支持 `@key.path` 深路径读写（Web Storage 原生不支持）
     * - Supports `@key.path` deep-path access (not native in Web Storage)
     * - `removeItem/clear` 并非所有平台都可用
     * - `removeItem/clear` are not available on every platform
     * - 读取时会尝试 `JSON.parse`，写入对象会 `JSON.stringify`
     * - Reads try `JSON.parse`, writes stringify objects
     *
     * @link https://developer.mozilla.org/en-US/docs/Web/API/Storage
     * @link https://developer.mozilla.org/zh-CN/docs/Web/API/Storage
     */
    class Storage {
    	/**
    	 * Worker / Node.js 环境下的内存数据缓存。
    	 * In-memory data cache for Worker / Node.js runtime.
    	 *
    	 * @type {Record<string, any>|null}
    	 */
    	static data = null;

    	/**
    	 * Node.js 持久化文件名。
    	 * Data file name used in Node.js.
    	 *
    	 * @type {string}
    	 */
    	static dataFile = "box.dat";

    	/**
    	 * Node.js ESM 入口注入的存储后端。
    	 * Storage backend injected by the Node.js ESM entry.
    	 *
    	 * @type {{load: (dataFile: string) => Record<string, any>, write: (dataFile: string, data: Record<string, any>) => void}|null}
    	 */
    	static nodeBackend = null;

    	/**
    	 * `@key.path` 解析正则。
    	 * Regex for `@key.path` parsing.
    	 *
    	 * @type {RegExp}
    	 */
    	static #nameRegex = /^@(?<key>[^.]+)(?:\.(?<path>.*))?$/;

    	/**
    	 * 读取存储值。
    	 * Read value from persistent storage.
    	 *
    	 * @param {string} keyName 键名或路径键 / Key or path key.
    	 * @param {*} [defaultValue=null] 默认值 / Default value when key is missing.
    	 * @returns {*}
    	 */
    	static getItem(keyName, defaultValue = null) {
    		let keyValue = defaultValue;
    		// 如果以 @
    		switch (keyName.startsWith("@")) {
    			case true: {
    				const { key, path } = keyName.match(Storage.#nameRegex)?.groups;
    				keyName = key;
    				let value = Storage.getItem(keyName, {});
    				if (typeof value !== "object") value = {};
    				keyValue = Lodash.get(value, path);
    				try {
    					keyValue = JSON.parse(keyValue);
    				} catch {}
    				break;
    			}
    			default:
    				switch ($app) {
    					case "Surge":
    					case "Loon":
    					case "Stash":
    					case "Egern":
    					case "Shadowrocket":
    						keyValue = $persistentStore.read(keyName);
    						break;
    					case "Quantumult X":
    						keyValue = $prefs.valueForKey(keyName);
    						break;
    					case "Worker":
    						Storage.data = Storage.data ?? {};
    						keyValue = Storage.data[keyName];
    						break;
    					case "Node.js":
    						Storage.data = Storage.nodeBackend.load(Storage.dataFile);
    						keyValue = Storage.data?.[keyName];
    						break;
    					default:
    						keyValue = Storage.data?.[keyName] || null;
    						break;
    				}
    				try {
    					keyValue = JSON.parse(keyValue);
    				} catch {
    					// do nothing
    				}
    				break;
    		}
    		return keyValue ?? defaultValue;
    	}

    	/**
    	 * 写入存储值。
    	 * Write value into persistent storage.
    	 *
    	 * @param {string} keyName 键名或路径键 / Key or path key.
    	 * @param {*} keyValue 写入值 / Value to store.
    	 * @returns {boolean}
    	 */
    	static setItem(keyName = new String(), keyValue = new String()) {
    		let result = false;
    		switch (typeof keyValue) {
    			case "object":
    				keyValue = JSON.stringify(keyValue);
    				break;
    			default:
    				keyValue = String(keyValue);
    				break;
    		}
    		switch (keyName.startsWith("@")) {
    			case true: {
    				const { key, path } = keyName.match(Storage.#nameRegex)?.groups;
    				keyName = key;
    				let value = Storage.getItem(keyName, {});
    				if (typeof value !== "object") value = {};
    				Lodash.set(value, path, keyValue);
    				result = Storage.setItem(keyName, value);
    				break;
    			}
    			default:
    				switch ($app) {
    					case "Surge":
    					case "Loon":
    					case "Stash":
    					case "Egern":
    					case "Shadowrocket":
    						result = $persistentStore.write(keyValue, keyName);
    						break;
    					case "Quantumult X":
    						result = $prefs.setValueForKey(keyValue, keyName);
    						break;
    					case "Worker":
    						Storage.data = Storage.data ?? {};
    						Storage.data[keyName] = keyValue;
    						result = true;
    						break;
    					case "Node.js":
    						Storage.data = Storage.nodeBackend.load(Storage.dataFile);
    						Storage.data[keyName] = keyValue;
    						Storage.nodeBackend.write(Storage.dataFile, Storage.data);
    						result = true;
    						break;
    					default:
    						result = Storage.data?.[keyName] || null;
    						break;
    				}
    				break;
    		}
    		return result;
    	}

    	/**
    	 * 删除存储值。
    	 * Remove value from persistent storage.
    	 *
    	 * 平台说明:
    	 * Platform notes:
    	 * - Quantumult X: `$prefs.removeValueForKey`
    	 * - Surge: 通过 `$persistentStore.write(null, keyName)` 删除
    	 * - 其余平台当前返回 `false`
    	 *
    	 * @param {string} keyName 键名或路径键 / Key or path key.
    	 * @returns {boolean}
    	 */
    	static removeItem(keyName) {
    		let result = false;
    		switch (keyName.startsWith("@")) {
    			case true: {
    				const { key, path } = keyName.match(Storage.#nameRegex)?.groups;
    				keyName = key;
    				let value = Storage.getItem(keyName);
    				if (typeof value !== "object") value = {};
    				Lodash.unset(value, path);
    				result = Storage.setItem(keyName, value);
    				break;
    			}
    			default:
    				switch ($app) {
    					case "Surge":
    						result = $persistentStore.write(null, keyName);
    						break;
    					case "Loon":
    					case "Stash":
    					case "Egern":
    					case "Shadowrocket":
    						result = false;
    						break;
    					case "Quantumult X":
    						result = $prefs.removeValueForKey(keyName);
    						break;
    					case "Worker":
    						Storage.data = Storage.data ?? {};
    						delete Storage.data[keyName];
    						result = true;
    						break;
    					case "Node.js":
    						// result = false;
    						Storage.data = Storage.nodeBackend.load(Storage.dataFile);
    						delete Storage.data[keyName];
    						Storage.nodeBackend.write(Storage.dataFile, Storage.data);
    						result = true;
    						break;
    					default:
    						result = false;
    						break;
    				}
    				break;
    		}
    		return result;
    	}

    	/**
    	 * 清空存储。
    	 * Clear storage.
    	 *
    	 * @returns {boolean}
    	 */
    	static clear() {
    		let result = false;
    		switch ($app) {
    			case "Surge":
    			case "Loon":
    			case "Stash":
    			case "Egern":
    			case "Shadowrocket":
    				result = false;
    				break;
    			case "Quantumult X":
    				result = $prefs.removeAllValues();
    				break;
    			case "Worker":
    				Storage.data = {};
    				result = true;
    				break;
    			case "Node.js":
    				// result = false;
    				Storage.data = Storage.nodeBackend.load(Storage.dataFile);
    				Storage.data = {};
    				Storage.nodeBackend.write(Storage.dataFile, Storage.data);
    				result = true;
    				break;
    			default:
    				result = false;
    				break;
    		}
    		return result;
    	}
    }

    /**
     * 根据 BoxJS 目录桥接持久化存储，不下载配置或解析控件。
     * Bridge persistence using the BoxJS catalog without downloading configuration or interpreting controls.
     */
    class Store {
        #catalog;

        /**
         * 复用包内已解析的目录，构造时不访问网络或存储。
         * Reuse the parsed internal catalog without network or persistence access during construction.
         * @param {import("./BoxJS.mjs").BoxJS} catalog BoxJS 路径目录 / BoxJS path catalog.
         */
        constructor(catalog) {
            this.#catalog = catalog;
        }

        /**
         * GET 返回指定值，POST 替换指定值，DELETE 删除指定键或整个模块。
         * GET returns a value, POST replaces it, and DELETE removes a key or the entire module.
         * @param {import("./index.js").SettingsRequest} request 代理请求 / Proxy request.
         * @param {URL} [url] 包内复用的已解析地址 / Parsed URL reused within the package.
         * @returns {Promise<import("./index.js").SettingsResponse | undefined>} 响应或非接管请求 / Response, or undefined for an unhandled request.
         */
        async handle(request, url = new URL(request.url)) {
            if (!url.pathname.startsWith("/api/")) return;
            const reply = (status, data) => response(request, status, data);
            let parts;
            try {
                parts = parseSettingsPathname(url.pathname);
            } catch (error) {
                return reply(400, { error: error.message });
            }
            const binding = this.#catalog.modules.get(parts[0]);
            if (!binding) return reply(404, { error: "Module is not declared in BoxJS" });
            const requestHeaders = Object.fromEntries(Object.entries(request.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
            if (requestHeaders["x-settings-client"] !== "1" || (requestHeaders.origin && requestHeaders.origin !== url.origin)) return reply(403, { error: "Forbidden settings client" });
            let value;
            switch (request.method) {
                case "HEAD":
                    return reply(200, undefined);
                case "GET":
                case "DELETE":
                    break;
                case "POST":
                    if (requestHeaders["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") return reply(415, { error: "Expected application/json" });
                    if (typeof request.body !== "string") return reply(400, { error: "Expected a JSON string body" });
                    if (request.body.length > 65536) return reply(413, { error: "Body exceeds 65536 UTF-16 code units" });
                    try {
                        value = JSON.parse(request.body);
                    } catch {
                        return reply(400, { error: "Invalid JSON" });
                    }
                    break;
                default:
                    return { ...reply(405, { error: "Method not allowed" }), headers: { ...reply(405).headers, Allow: "HEAD, GET, POST, DELETE" } };
            }
            try {
                const root = Storage.getItem(binding.storageKey, {});
                if (!isRecord(root)) throw new TypeError("stored root must be an object");
                const parent = storageParent(root, parts, request.method === "POST");
                const key = parts.at(-1);
                switch (request.method) {
                    case "GET": {
                        const result = parent ? Lodash.get(parent, [key]) : undefined;
                        return result === undefined ? reply(404, { error: "Stored path does not exist" }) : reply(200, result);
                    }
                    case "POST":
                        Lodash.set(parent, [key], value);
                        break;
                    case "DELETE":
                        if (parent) Lodash.unset(parent, [key]);
                        break;
                }
                if (!Storage.setItem(binding.storageKey, root)) throw new Error("Storage write failed");
                return reply(200, request.method === "POST" ? { saved: true } : { deleted: true });
            } catch (error) {
                return reply(500, { error: error.message });
            }
        }
    }

    /**
     * 判断根节点是否为普通对象。
     * Determine whether a root node is a plain object.
     * @param {unknown} value 待检查值 / Value to inspect.
     * @returns {boolean} 是否为普通对象 / Whether this is a plain object.
     */
    function isRecord(value) {
        return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
    }

    /**
     * 遍历父路径，兼容旧存储中 JSON 字符串形式的中间节点。
     * Traverse parents, supporting legacy intermediate nodes serialized as JSON strings.
     * @param {Record<string, unknown>} root 存储根 / Storage root.
     * @param {string[]} parts 完整路径 / Complete path.
     * @param {boolean} create 是否创建缺失节点 / Whether to create missing parents.
     * @returns {object | undefined} 父节点，缺失且不创建时为 undefined / Parent, or undefined when absent and not creating.
     * @throws {TypeError} 无法继续遍历标量节点 / A scalar node cannot be traversed.
     */
    function storageParent(root, parts, create) {
        let parent = root;
        for (const part of parts.slice(0, -1)) {
            let next = Lodash.get(parent, [part]);
            switch (typeof next) {
                case "undefined":
                    if (!create) return;
                    next = {};
                    break;
                case "string":
                    next = JSON.parse(next);
                    break;
            }
            if (!isRecord(next) && !Array.isArray(next)) throw new TypeError("Stored parent is not an object or array");
            Lodash.set(parent, [part], next);
            parent = next;
        }
        return parent;
    }

    /**
     * 统一日志工具，兼容各脚本平台、Worker 与 Node.js。
     * Unified logger compatible with script platforms, Worker, and Node.js.
     *
     * logLevel 用法:
     * logLevel usage:
     * - 可读: `Console.logLevel` 返回 `OFF|ERROR|WARN|INFO|DEBUG|ALL`
     * - Read: `Console.logLevel` returns `OFF|ERROR|WARN|INFO|DEBUG|ALL`
     * - 可写: 数字 `0~5` 或字符串 `off/error/warn/info/debug/all`
     * - Write: number `0~5` or string `off/error/warn/info/debug/all`
     *
     * @example
     * Console.logLevel = "debug";
     * Console.debug("only shown when level >= DEBUG");
     * Console.logLevel = 2; // WARN
     */
    class Console {
    	static #counts = new Map([]);
    	static #groups = [];
    	static #times = new Map([]);

    	/**
    	 * 清空控制台（当前为空实现）。
    	 * Clear console (currently a no-op).
    	 *
    	 * @returns {void}
    	 */
    	static clear = () => {};

    	/**
    	 * 增加计数器并打印当前值。
    	 * Increment counter and print the current value.
    	 *
    	 * @param {string} [label="default"] 计数器名称 / Counter label.
    	 * @returns {void}
    	 */
    	static count = (label = "default") => {
    		switch (Console.#counts.has(label)) {
    			case true:
    				Console.#counts.set(label, Console.#counts.get(label) + 1);
    				break;
    			case false:
    				Console.#counts.set(label, 0);
    				break;
    		}
    		Console.log(`${label}: ${Console.#counts.get(label)}`);
    	};

    	/**
    	 * 重置计数器。
    	 * Reset a counter.
    	 *
    	 * @param {string} [label="default"] 计数器名称 / Counter label.
    	 * @returns {void}
    	 */
    	static countReset = (label = "default") => {
    		switch (Console.#counts.has(label)) {
    			case true:
    				Console.#counts.set(label, 0);
    				Console.log(`${label}: ${Console.#counts.get(label)}`);
    				break;
    			case false:
    				Console.warn(`Counter "${label}" doesn’t exist`);
    				break;
    		}
    	};

    	/**
    	 * 输出调试日志。
    	 * Print debug logs.
    	 *
    	 * @param {...any} msg 日志内容 / Log messages.
    	 * @returns {void}
    	 */
    	static debug = (...msg) => {
    		if (Console.#level < 4) return;
    		msg = msg.map(m => `🅱️ ${m}`);
    		Console.log(...msg);
    	};

    	/**
    	 * 输出错误日志。
    	 * Print error logs.
    	 *
    	 * @param {...any} msg 日志内容 / Log messages.
    	 * @returns {void}
    	 */
    	static error(...msg) {
    		if (Console.#level < 1) return;
    		switch ($app) {
    			case "Surge":
    			case "Loon":
    			case "Stash":
    			case "Egern":
    			case "Shadowrocket":
    			case "Quantumult X":
    			default:
    				msg = msg.map(m => `❌ ${m}`);
    				break;
    			case "Worker":
    			case "Node.js":
    				msg = msg.map(m => `❌ ${m?.stack ?? m}`);
    				break;
    		}
    		Console.log(...msg);
    	}

    	/**
    	 * `error` 的别名。
    	 * Alias of `error`.
    	 *
    	 * @param {...any} msg 日志内容 / Log messages.
    	 * @returns {void}
    	 */
    	static exception = (...msg) => Console.error(...msg);

    	/**
    	 * 进入日志分组。
    	 * Enter a log group.
    	 *
    	 * @param {string} label 分组名 / Group label.
    	 * @returns {number}
    	 */
    	static group = label => Console.#groups.unshift(label);

    	/**
    	 * 退出日志分组。
    	 * Exit the latest log group.
    	 *
    	 * @returns {*}
    	 */
    	static groupEnd = () => Console.#groups.shift();

    	/**
    	 * 输出信息日志。
    	 * Print info logs.
    	 *
    	 * @param {...any} msg 日志内容 / Log messages.
    	 * @returns {void}
    	 */
    	static info(...msg) {
    		if (Console.#level < 3) return;
    		msg = msg.map(m => `ℹ️ ${m}`);
    		Console.log(...msg);
    	}

    	static #level = 3;

    	/**
    	 * 获取日志级别文本。
    	 * Get current log level text.
    	 *
    	 * @returns {"OFF"|"ERROR"|"WARN"|"INFO"|"DEBUG"|"ALL"}
    	 */
    	static get logLevel() {
    		switch (Console.#level) {
    			case 0:
    				return "OFF";
    			case 1:
    				return "ERROR";
    			case 2:
    				return "WARN";
    			case 3:
    			default:
    				return "INFO";
    			case 4:
    				return "DEBUG";
    			case 5:
    				return "ALL";
    		}
    	}

    	/**
    	 * 设置日志级别。
    	 * Set current log level.
    	 *
    	 * @param {number|string} level 级别值 / Level value.
    	 */
    	static set logLevel(level) {
    		switch (typeof level) {
    			case "string":
    				level = level.toLowerCase();
    				break;
    			case "number":
    				break;
    			case "undefined":
    			default:
    				level = "warn";
    				break;
    		}
    		switch (level) {
    			case 0:
    			case "off":
    				Console.#level = 0;
    				break;
    			case 1:
    			case "error":
    				Console.#level = 1;
    				break;
    			case 2:
    			case "warn":
    			case "warning":
    			default:
    				Console.#level = 2;
    				break;
    			case 3:
    			case "info":
    				Console.#level = 3;
    				break;
    			case 4:
    			case "debug":
    				Console.#level = 4;
    				break;
    			case 5:
    			case "all":
    				Console.#level = 5;
    				break;
    		}
    	}

    	/**
    	 * 输出通用日志。
    	 * Print generic logs.
    	 *
    	 * 说明:
    	 * Notes:
    	 * - 多行字符串参数会按换行拆分为多个独立日志项。
    	 * - Multi-line string arguments are split into multiple log entries by line breaks.
    	 *
    	 * @param {...any} msg 日志内容 / Log messages.
    	 * @returns {void}
    	 */
    	static log = (...msg) => {
    		if (Console.#level === 0) return;
    		msg = msg.flatMap(log => {
    			switch (typeof log) {
    				case "object":
    					return [JSON.stringify(log)];
    				case "bigint":
    				case "number":
    				case "boolean":
    					return [log.toString()];
    				case "string":
    					return log.split(/\r?\n/u);
    				case "undefined":
    				default:
    					return [log];
    			}
    		});
    		Console.#groups.forEach(group => {
    			msg = msg.map(log => `  ${log}`);
    			msg.unshift(`▼ ${group}:`);
    		});
    		msg = ["", ...msg];
    		console.log(msg.join("\n"));
    	};

    	/**
    	 * 开始计时。
    	 * Start timer.
    	 *
    	 * @param {string} [label="default"] 计时器名称 / Timer label.
    	 * @returns {Map<string, number>}
    	 */
    	static time = (label = "default") => Console.#times.set(label, Date.now());

    	/**
    	 * 结束计时并移除计时器。
    	 * End timer and remove it.
    	 *
    	 * @param {string} [label="default"] 计时器名称 / Timer label.
    	 * @returns {boolean}
    	 */
    	static timeEnd = (label = "default") => Console.#times.delete(label);

    	/**
    	 * 输出当前计时器耗时。
    	 * Print elapsed time for a timer.
    	 *
    	 * @param {string} [label="default"] 计时器名称 / Timer label.
    	 * @returns {void}
    	 */
    	static timeLog = (label = "default") => {
    		const time = Console.#times.get(label);
    		if (time) Console.log(`${label}: ${Date.now() - time}ms`);
    		else Console.warn(`Timer "${label}" doesn’t exist`);
    	};

    	/**
    	 * 输出警告日志。
    	 * Print warning logs.
    	 *
    	 * @param {...any} msg 日志内容 / Log messages.
    	 * @returns {void}
    	 */
    	static warn(...msg) {
    		if (Console.#level < 2) return;
    		msg = msg.map(m => `⚠️ ${m}`);
    		Console.log(...msg);
    	}
    }

    /**
     * HTTP 状态码文本映射表。
     * HTTP status code to status text map.
     *
     * 主要用途:
     * Primary usage:
     * - 为 Quantumult X 的 `$done` 状态行拼接提供状态文本
     * - Provide status text for Quantumult X `$done` status-line composition
     * - QX 在部分场景要求 `status` 为完整状态行（如 `HTTP/1.1 200 OK`）
     * - QX may require full status line (e.g. `HTTP/1.1 200 OK`) in some cases
     *
     * 参考:
     * Reference:
     * - https://github.com/crossutility/Quantumult-X/raw/refs/heads/master/sample-rewrite-response-header.js
     *
     * @type {Record<number, string>}
     */
    const StatusTexts = {
    	100: "Continue",
    	101: "Switching Protocols",
    	102: "Processing",
    	103: "Early Hints",
    	200: "OK",
    	201: "Created",
    	202: "Accepted",
    	203: "Non-Authoritative Information",
    	204: "No Content",
    	205: "Reset Content",
    	206: "Partial Content",
    	207: "Multi-Status",
    	208: "Already Reported",
    	226: "IM Used",
    	300: "Multiple Choices",
    	301: "Moved Permanently",
    	302: "Found",
    	304: "Not Modified",
    	307: "Temporary Redirect",
    	308: "Permanent Redirect",
    	400: "Bad Request",
    	401: "Unauthorized",
    	402: "Payment Required",
    	403: "Forbidden",
    	404: "Not Found",
    	405: "Method Not Allowed",
    	406: "Not Acceptable",
    	407: "Proxy Authentication Required",
    	408: "Request Timeout",
    	409: "Conflict",
    	410: "Gone",
    	411: "Length Required",
    	412: "Precondition Failed",
    	413: "Content Too Large",
    	414: "URI Too Long",
    	415: "Unsupported Media Type",
    	416: "Range Not Satisfiable",
    	417: "Expectation Failed",
    	418: "I'm a teapot",
    	421: "Misdirected Request",
    	422: "Unprocessable Entity",
    	423: "Locked",
    	424: "Failed Dependency",
    	425: "Too Early",
    	426: "Upgrade Required",
    	428: "Precondition Required",
    	429: "Too Many Requests",
    	431: "Request Header Fields Too Large",
    	451: "Unavailable For Legal Reasons",
    	500: "Internal Server Error",
    	501: "Not Implemented",
    	502: "Bad Gateway",
    	503: "Service Unavailable",
    	504: "Gateway Timeout",
    	505: "HTTP Version Not Supported",
    	506: "Variant Also Negotiates",
    	507: "Insufficient Storage",
    	508: "Loop Detected",
    	510: "Not Extended",
    	511: "Network Authentication Required",
    };

    /**
     * `done` 的统一入参结构。
     * Unified `done` input payload.
     *
     * @typedef {object} DonePayload
     * @property {number|string} [status] 响应状态码或状态行 / Response status code or status line.
     * @property {string} [url] 响应 URL / Response URL.
     * @property {Record<string, any>} [headers] 响应头 / Response headers.
     * @property {string|ArrayBuffer|ArrayBufferView} [body] 响应体 / Response body.
     * @property {ArrayBuffer} [bodyBytes] 二进制响应体 / Binary response body.
     * @property {string} [policy] 指定策略名 / Preferred policy name.
     */

    /**
     * 结束脚本执行并按平台转换参数。
     * Complete script execution with platform-specific parameter mapping.
     *
     * 说明:
     * Notes:
     * - 这是调用入口，平台原生 `$done` 差异在内部处理
     * - This is the call entry and native `$done` differences are handled internally
     * - Worker 不调用 `$done` 或退出进程，仅记录日志
     * - Worker neither calls `$done` nor exits the process; it only logs
     * - Node.js 不调用 `$done`，而是直接退出进程
     * - Node.js does not call `$done`; it exits the process directly
     * - 未识别平台仅记录结束日志，不会强制退出
     * - Unknown runtimes only log completion and do not force an exit
     *
     * @param {DonePayload} [object={}] 统一响应对象 / Unified response object.
     * @returns {void}
     */
    function done(object = {}) {
    	switch ($app) {
    		case "Surge":
    			if (object.policy) Lodash.set(object, "headers.X-Surge-Policy", object.policy);
    			Console.log("🚩 执行结束!", `🕛 ${new Date().getTime() / 1000 - $script.startTime} 秒`);
    			$done(object);
    			break;
    		case "Loon":
    			if (object.policy) object.node = object.policy;
    			Console.log("🚩 执行结束!", `🕛 ${(new Date() - $script.startTime) / 1000} 秒`);
    			$done(object);
    			break;
    		case "Stash":
    			if (object.policy) Lodash.set(object, "headers.X-Stash-Selected-Proxy", encodeURI(object.policy));
    			Console.log("🚩 执行结束!", `🕛 ${(new Date() - $script.startTime) / 1000} 秒`);
    			$done(object);
    			break;
    		case "Egern":
    			Console.log("🚩 执行结束!");
    			$done(object);
    			break;
    		case "Shadowrocket":
    			Console.log("🚩 执行结束!");
    			$done(object);
    			break;
    		case "Quantumult X":
    			if (object.policy) Lodash.set(object, "opts.policy", object.policy);
    			object = Lodash.pick(object, ["status", "url", "headers", "body", "bodyBytes"]);
    			switch (typeof object.status) {
    				case "number":
    					object.status = `HTTP/1.1 ${object.status} ${StatusTexts[object.status]}`;
    					break;
    				case "string":
    				case "undefined":
    					break;
    				default:
    					throw new TypeError(`${Function.name}: 参数类型错误, status 必须为数字或字符串`);
    			}
    			if (object.body instanceof ArrayBuffer) {
    				object.bodyBytes = object.body;
    				object.body = undefined;
    			} else if (ArrayBuffer.isView(object.body)) {
    				object.bodyBytes = object.body.buffer.slice(object.body.byteOffset, object.body.byteLength + object.body.byteOffset);
    				object.body = undefined;
    			} else if (object.body) object.bodyBytes = undefined;
    			Console.log("🚩 执行结束!");
    			$done(object);
    			break;
    		case "Worker":
    			Console.log("🚩 执行结束!");
    			break;
    		case "Node.js":
    			Console.log("🚩 执行结束!");
    			process.exit(1);
    			break;
    		default:
    			Console.log("🚩 执行结束!");
    			break;
    	}
    }

    /**
     * 统一适配代理的完成格式；未接管的请求原样继续。
     * Adapt the host completion format and pass through unhandled requests.
     * @param {import("../index.js").SettingsResponse | undefined} result 通用响应 / Common response.
     * @returns {void} 响应已交给宿主 / Response delivered to the host.
     */
    function complete(result) {
        if (!result) {
            done({});
            return;
        }
        done($app === "Quantumult X" ? result : { response: result });
    }

    /**
     * 仅为导入的模块提供页面与存储服务，项目主页由调用方自行托管。
     * Serve only the imported module's page and persistence; callers host their own project landing pages.
     * @param {unknown} boxjs BoxJS JSON / BoxJS JSON.
     * @param {string} [css] 自定义 CSS 正文 / Custom CSS text.
     * @returns {Promise<void>} 已提交宿主响应 / Delivered host response.
     */
    async function run(boxjs, css = "") {
        const request = globalThis.$request;
        let result;
        try {
            if (typeof css !== "string") throw new TypeError("CSS must be a string");
            const catalog = new BoxJS(boxjs);
            const module = catalog.module.module;
            const url = new URL(request.url);
            switch (true) {
                case url.pathname.startsWith("/api/"):
                    result = await new Store(catalog).handle(request, url);
                    break;
                case url.pathname.startsWith("/configs/"):
                    break;
                case url.pathname === `/settings/${module}` || url.pathname === `/settings/${module}/`: {
                    // Header 由代理传入文档，浏览器再下载 JSON/CSS；代理不获取外部资源。
                    // Carry headers into the document; only the browser downloads external JSON/CSS.
                    const inputs = encodeURIComponent(JSON.stringify(pageInputs(url, request.headers)));
                    const html = assets.page.body.replace("</head>", `<meta name="preference-panes-inputs" content="${inputs}"></head>`);
                    result = response(request, 200, html, "text/html");
                    break;
                }
                case url.pathname === `/settings/assets/${module}.css`:
                    result = response(request, 200, css, "text/css");
                    break;
                default: {
                    const asset = assets[url.pathname];
                    if (asset) result = response(request, 200, asset.body, asset.type);
                }
            }
            if (result && !url.pathname.startsWith("/api/") && !["GET", "HEAD"].includes(request.method)) result = response(request, 405, { error: "Method not allowed" });
        } catch (error) {
            console.error(`PreferencePanes: ${error.message}`);
            result = response(request, 500, { error: "Settings execution failed" });
        }
        complete(result);
    }

    exports.run = run;

    return exports;

})({});

PreferencePanes.run([{"id":"@BiliBili.Enhanced.Settings.Home.Switch","name":"[首页] 启用此标签页自定义功能","type":"boolean","val":true,"desc":"启用后可自定义首页标签页、顶栏按钮等内容。"},{"id":"@BiliBili.Enhanced.Settings.Home.Tab","name":"[首页] 标签页","type":"checkboxes","val":["live","recommend","hottopic","bangumi","anime","film","koreavtw"],"items":[{"key":"live","label":"直播"},{"key":"recommend","label":"推荐"},{"key":"hottopic","label":"热门"},{"key":"bangumi","label":"番剧"},{"key":"anime","label":"动画（港澳台）"},{"key":"film","label":"影视"},{"key":"koreavtw","label":"韩综（港澳台）"},{"key":"game","label":"游戏"},{"key":"minecraft","label":"minecraft"},{"key":"anime_fan","label":"动画同人"},{"key":"funny","label":"搞笑"},{"key":"school","label":"校园"},{"key":"digital","label":"数码"}],"desc":"请选择启用的首页标签页，建议不超过7个。"},{"id":"@BiliBili.Enhanced.Settings.Home.Tab_default","name":"[首页] 默认标签页","type":"selects","val":"recommend","items":[{"key":"live","label":"直播"},{"key":"recommend","label":"推荐"},{"key":"hottopic","label":"热门"},{"key":"bangumi","label":"番剧"},{"key":"anime","label":"动画（港澳台）"},{"key":"film","label":"影视"},{"key":"koreavtw","label":"韩综（港澳台）"},{"key":"game","label":"游戏"},{"key":"minecraft","label":"minecraft"},{"key":"anime_fan","label":"动画同人"},{"key":"funny","label":"搞笑"},{"key":"school","label":"校园"},{"key":"digital","label":"数码"}],"desc":"请选择启动APP时默认展示的标签页，需选择已启用的标签页。"},{"id":"@BiliBili.Enhanced.Settings.Home.Top_left","name":"[首页] 顶栏（左侧）按钮（用户头像）","type":"selects","val":"mine","items":[{"key":"mine","label":"用户中心-我的"},{"key":"videoshortcut","label":"短视频"}],"desc":"请选择顶栏（左侧）按钮（用户头像）的作用（在biliBili粉色版中无法修改）。"},{"id":"@BiliBili.Enhanced.Settings.Home.Top","name":"[首页] 顶栏（右侧）按钮","type":"checkboxes","val":["messages"],"items":[{"key":"game_center","label":"游戏中心"},{"key":"mall","label":"会员购"},{"key":"messages","label":"消息"}],"desc":"请选择启用的顶栏（右侧）按钮。"},{"id":"@BiliBili.Enhanced.Settings.Home.Top_more","name":"[首页] 顶栏（更多）按钮","type":"checkboxes","val":["categories","search"],"items":[{"key":"categories","label":"更多分区"},{"key":"search","label":"搜索"}],"desc":"请选择启用的首页顶栏更多按钮。"},{"id":"@BiliBili.Enhanced.Settings.Bottom","name":"[底部] 导航栏按钮","type":"checkboxes","val":["home","dynamic","ogv","mall","mine"],"items":[{"key":"home","label":"首页"},{"key":"channel","label":"频道"},{"key":"dynamic","label":"动态"},{"key":"publish","label":"发布"},{"key":"ogv","label":"节目（港澳台）"},{"key":"mall","label":"会员购"},{"key":"messages","label":"消息"},{"key":"mine","label":"我的"}],"desc":"请选择启用的底部导航栏按钮，最多6个。"},{"id":"@BiliBili.Enhanced.Settings.Region.Switch","name":"[分区] 启用此标签页自定义功能","type":"boolean","val":true,"desc":"启用后可自定义分区标签页的内容。"},{"id":"@BiliBili.Enhanced.Settings.Mine.Switch","name":"[我的] 启用此标签页自定义功能","type":"boolean","val":true,"desc":"启用后可自定义我的标签页的服务内容。"},{"id":"@BiliBili.Enhanced.Settings.Mine.iPad.Switch","name":"[我的 iPad版] 启用此标签页自定义功能","type":"boolean","val":true,"desc":"启用后可自定义iPad版我的标签页的服务内容。"},{"id":"@BiliBili.Enhanced.Settings.Storage","name":"[储存] 配置类型","type":"selects","val":"Argument","items":[{"key":"Argument","label":"优先使用来自 $argument 的配置，$argument 不包含的设置项由 PersistentStore (BoxJs) 提供"},{"key":"PersistentStore","label":"只使用 PersistentStore (BoxJs) 提供的配置"},{"key":"database","label":"只使用由作者的 database.mjs 文件提供的默认配置，其他任何自定义配置不再起作用"}],"desc":"选择要使用的配置类型。未设置此选项或不通过此选项的旧版本的配置顺序依旧是 PersistentStore (BoxJs) > $argument > database。"},{"id":"@BiliBili.Enhanced.Settings.LogLevel","name":"[调试] 日志等级","type":"selects","val":"WARN","items":[{"key":"OFF","label":"关闭"},{"key":"ERROR","label":"❌ 错误"},{"key":"WARN","label":"⚠️ 警告"},{"key":"INFO","label":"ℹ️ 信息"},{"key":"DEBUG","label":"🅱️ 调试"},{"key":"ALL","label":"全部"}],"desc":"选择脚本日志的输出等级，低于所选等级的日志将全部输出。"}],"/* 首页与模块页共用 Biliverse 品牌色，模块页通过 CSS 输入加载。\n * Share the Biliverse accent between the landing page and CSS-imported module pages. */\n:root {\n  --biliverse-accent: #fb7299;\n}\n.pp-panel {\n  --pp-accent: var(--biliverse-accent);\n}\n.pp-panel[data-module=\"Enhanced\"] {\n  --biliverse-module-logo: url(\"/settings/assets/Enhanced_light.png\");\n}\n/* 未提供 BoxJS icon 的字段数组由项目主题补充图标，通用包不绑定品牌。\n * The project theme supplies an icon for field arrays without BoxJS icon metadata. */\n.pp-panel[data-module=\"Enhanced\"] .pp-brand-icon:empty {\n  display: block;\n  background: var(--biliverse-module-logo) center / contain no-repeat;\n}\n@media (prefers-color-scheme: dark) {\n  .pp-panel[data-module=\"Enhanced\"] { --biliverse-module-logo: url(\"/settings/assets/Enhanced_dark.png\"); }\n}\n:root[data-theme=\"dark\"] .pp-panel[data-module=\"Enhanced\"] {\n  --biliverse-module-logo: url(\"/settings/assets/Enhanced_dark.png\");\n}\n:root[data-theme=\"light\"] .pp-panel[data-module=\"Enhanced\"] {\n  --biliverse-module-logo: url(\"/settings/assets/Enhanced_light.png\");\n}\n.home-navbar,\n.home-navbar button,\n.biliverse-home .header,\n.self-item:enabled .name,\n.module-message button,\n.pp-panel .pp-header,\n.pp-panel .pp-back {\n  color: var(--biliverse-accent);\n}\n.module-message button {\n  border-color: var(--biliverse-accent);\n}\n");
