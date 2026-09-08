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

/**
 * 将 /api/ 后的 URL 路径转换为 util 的路径片段；非 API 路径不处理。
 * Convert URL segments after /api/ to util path segments; ignore non-API paths.
 * @param {string} url 请求完整 URL / Absolute request URL.
 * @returns {string[] | undefined} 键路径片段 / Key path segments.
 * @throws {TypeError} API 路径无效或包含危险片段 / Invalid or unsafe API path.
 */
function parseSettingsPath(url) {
  const pathname = new URL(url).pathname;
  if (!pathname.startsWith("/api/")) return;
  let parts;
  try {
    parts = pathname.slice(5).replace(/\/$/, "").split("/").map(decodeURIComponent);
  } catch {
    throw new TypeError("Invalid encoded key path");
  }
  if (!parts.every((part) => /^[a-zA-Z0-9_-]+$/.test(part) && !["__proto__", "prototype", "constructor"].includes(part)))
    throw new TypeError("Invalid key path");
  return parts;
}

/**
 * 将 BoxJS 数组、app 或订阅转换为模块字段，保留原文件为唯一字段来源。
 * Normalize a BoxJS array, app or subscription using the source JSON as the field authority.
 * @param {unknown} config BoxJS JSON / BoxJS document.
 * @param {string} module API 第一段模块名 / First API path segment.
 * @returns {import("../index.js").ModuleDefinition} 存储根和字段 / Storage root and fields.
 */
function normalizeBoxJs(config, module) {
  parseSettingsPath(`https://example.invalid/api/${module}`);
  const apps = Array.isArray(config) ? [] : (config?.apps ?? [config]);
  if (!Array.isArray(apps)) throw new TypeError("Expected BoxJS apps array");
  for (const candidate of apps) {
    if (!candidate || typeof candidate !== "object") throw new TypeError("Expected BoxJS app object");
    if (candidate.settings !== undefined && !Array.isArray(candidate.settings)) throw new TypeError("Expected BoxJS settings array");
  }
  const owners = apps.filter((candidate) =>
    candidate.settings?.some(
      (entry) => typeof entry.id === "string" && entry.id.startsWith("@") && entry.id.slice(1).split(".")[1] === module,
    ),
  );
  const entries = Array.isArray(config) ? config : owners.flatMap((candidate) => candidate.settings);
  const app = owners.length === 1 ? owners[0] : undefined;
  if (!Array.isArray(entries)) throw new TypeError("Expected BoxJS settings array, app or subscription");
  let storageKey;
  const fields = [];
  for (const entry of entries) {
    if (typeof entry.id !== "string" || !entry.id.startsWith("@")) throw new TypeError("BoxJS settings require @root.path IDs");
    const [root, ...parts] = entry.id.slice(1).split(".");
    if (parts[0] !== module) continue;
    if (parts.length < 2) throw new TypeError("A BoxJS setting must be below the module root");
    parseSettingsPath(`https://example.invalid/api/${parts.map(encodeURIComponent).join("/")}`);
    if (!root || (storageKey && root !== storageKey)) throw new TypeError("A module must use one storage root");
    storageKey = root;
    const type = { boolean: "boolean", checkboxes: "array", selects: "select", text: "string", textarea: "string", number: "number" }[
      entry.type
    ];
    if (!type) throw new TypeError(`Unsupported BoxJS control: ${entry.type}`);
    const field = {
      key: parts.join("."),
      name: entry.name,
      type: type === "select" ? typeof entry.val : type,
      description: entry.desc ?? "",
      control: entry.type,
      ...(entry.placeholder === undefined ? {} : { placeholder: entry.placeholder }),
      ...(entry.rows === undefined ? {} : { rows: entry.rows }),
      ...(entry.autoGrow === undefined ? {} : { autoGrow: entry.autoGrow }),
    };
    if (type === "select" && !["string", "number", "boolean"].includes(field.type))
      throw new TypeError(`Select requires a scalar val: ${entry.id}`);
    if (entry.items) field.options = entry.items.map((item) => ({ key: item.key, label: item.label }));
    if (Object.hasOwn(entry, "val")) field.defaultValue = normalizeStoredValue(field, entry.val);
    if (
      typeof field.name !== "string" ||
      (field.placeholder !== undefined && typeof field.placeholder !== "string") ||
      (field.rows !== undefined && (!Number.isInteger(field.rows) || field.rows < 1)) ||
      (field.autoGrow !== undefined && typeof field.autoGrow !== "boolean") ||
      fields.some((other) => other.key === field.key || other.key.startsWith(`${field.key}.`) || field.key.startsWith(`${other.key}.`))
    )
      throw new TypeError(`Invalid or overlapping BoxJS field: ${entry.id}`);
    if (
      field.options &&
      (new Set(field.options.map((item) => item.key)).size !== field.options.length ||
        field.options.some((item) => !scalar(item.key) || typeof item.label !== "string"))
    )
      throw new TypeError(`Invalid options: ${entry.id}`);
    if (Object.hasOwn(field, "defaultValue") && !validValue(field, field.defaultValue))
      throw new TypeError(`Invalid BoxJS val: ${entry.id}`);
    fields.push(field);
  }
  if (!fields.length) throw new TypeError(`No BoxJS settings for module: ${module}`);
  const common = fields[0].key.split(".").slice(0, -1);
  for (const field of fields) while (!field.key.startsWith(`${common.join(".")}.`)) common.pop();
  const metadata = {};
  if (app) {
    for (const key of ["id", "name", "author", "repo", "script", "icon", "description", "desc"]) {
      if (app[key] === undefined) continue;
      if (typeof app[key] !== "string") throw new TypeError(`Invalid BoxJS app ${key}`);
      metadata[key] = app[key];
    }
    for (const key of ["icons", "descs"]) {
      if (app[key] === undefined) continue;
      if (!Array.isArray(app[key]) || app[key].some((item) => typeof item !== "string")) throw new TypeError(`Invalid BoxJS app ${key}`);
      metadata[key] = [...app[key]];
    }
  }
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
 * @param {import("../index.js").SettingsField} field 字段 / Field.
 * @param {unknown} value 存储值 / Stored value.
 * @returns {unknown} 控件值 / Control value.
 */
function normalizeStoredValue(field, value) {
  if (field.type === "boolean" && (value === "true" || value === "false")) return value === "true";
  if (field.type === "number" && typeof value === "string" && value.trim() !== "") return Number(value);
  if (field.type === "array" && typeof value === "string") value = value === "" || value === "[]" ? [] : value.split(",");
  if (field.options) {
    const match = (item) => field.options.find((option) => String(option.key) === String(item))?.key ?? item;
    return field.type === "array" && Array.isArray(value) ? value.map(match) : match(value);
  }
  return value;
}

function scalar(value) {
  return (
    typeof value === "boolean" ||
    (typeof value === "string" && value.length <= 2048) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function validValue(field, value) {
  if (field.type === "array") {
    if (!Array.isArray(value) || value.some((item) => !scalar(item)) || new Set(value).size !== value.length) return false;
  } else if (typeof value !== field.type || !scalar(value)) return false;
  return !field.options || (field.type === "array" ? value : [value]).every((item) => field.options.some((option) => option.key === item));
}

/**
 * 创建页面会话缓存；打开时重读，选项操作仅在 HTTP 200 后更新缓存。
 * Create a page-session cache; reload on open and mutate cache only after HTTP 200.
 * @param {import("./index.js").PreferencesClientOptions} options 请求与通知 / Requests and notifications.
 * @returns {import("./index.js").PreferencesClient} 通用客户端 / Generic client.
 */
function createPreferencesClient({ fetch: request = globalThis.fetch.bind(globalThis), notify = () => {}, timeout = 10000 } = {}) {
  const sessions = new Map();
  async function send(path, method, body, signal, resource = false) {
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
        headers: resource ? {} : { "X-Settings-Client": "1", ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
        ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      return response;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  const configPath = (module) => {
    if (typeof module !== "string" || !module) throw new TypeError("module is required");
    const parts = parseSettingsPath(`https://example.invalid/api/${encodeURIComponent(module)}/`);
    if (parts.length !== 1) throw new TypeError("Expected a module name");
    return `/configs/${encodeURIComponent(module)}`;
  };
  const snapshot = (module) => {
    const state = sessions.get(module);
    if (!state?.definition) throw new Error("Open the module first");
    return structuredClone({ definition: state.definition, values: state.values });
  };
  async function change(module, key, method, value) {
    const state = sessions.get(module);
    if (!state?.definition) throw new Error("Open the module first");
    if (state.saving) throw new Error("A settings write is already in progress");
    const field = state.definition.fields.find((field) => field.key === key);
    state.saving = true;
    try {
      if (!field || (method === "POST" && !validValue(field, value))) throw new TypeError("Invalid setting value");
      await send(`/api/${key.split(".").map(encodeURIComponent).join("/")}`, method, value);
      if (sessions.get(module) === state) {
        if (method === "DELETE") {
          delete state.values[key];
          if (Object.hasOwn(field, "defaultValue")) state.values[key] = structuredClone(field.defaultValue);
        } else state.values[key] = structuredClone(value);
      }
      notify({ kind: "success", operation: method === "DELETE" ? "delete" : "write", module, key });
    } catch (error) {
      notify({ kind: "error", operation: method === "DELETE" ? "delete" : "write", module, key, message: error.message });
      throw error;
    } finally {
      state.saving = false;
    }
  }
  return {
    async probe(module) {
      try {
        await send(configPath(module), "HEAD", undefined, undefined, true);
        return true;
      } catch {
        return false;
      }
    },
    async open(module) {
      const previous = sessions.get(module);
      if (previous?.saving) throw new Error("Cannot refresh while saving");
      previous?.controller.abort();
      const state = { controller: new AbortController(), definition: null, values: {}, saving: false };
      sessions.set(module, state);
      try {
        const resource = configPath(module);
        const definition = normalizeBoxJs(await (await send(resource, "GET", undefined, state.controller.signal, true)).json(), module);
        if (definition.settingsPath.length < 2) throw new TypeError("BoxJS fields must share a settings subtree below the module root");
        const subtree = await (
          await send(`/api/${definition.settingsPath.map(encodeURIComponent).join("/")}/`, "GET", undefined, state.controller.signal)
        ).json();
        if (!subtree || typeof subtree !== "object" || Array.isArray(subtree)) throw new TypeError("Expected a settings subtree object");
        if (sessions.get(module) !== state) throw new Error("Module session was replaced");
        state.definition = definition;
        for (const field of definition.fields) {
          const value = Lodash.get(subtree, field.key.split(".").slice(definition.settingsPath.length), field.defaultValue);
          if (value !== undefined) state.values[field.key] = normalizeStoredValue(field, value);
        }
        return snapshot(module);
      } catch (error) {
        if (sessions.get(module) === state) sessions.delete(module);
        throw error;
      }
    },
    snapshot,
    leave(module) {
      sessions.get(module)?.controller.abort();
      sessions.delete(module);
    },
    set: (module, key, value) => change(module, key, "POST", value),
    remove: (module, key) => change(module, key, "DELETE"),
  };
}

/**
 * 挂载从 BoxJS 实时生成的设置面板和短暂通知。
 * Mount runtime-generated BoxJS controls and transient notifications.
 * @param {import("./index.js").PreferencesPanelOptions} options 容器与请求；页面路径 /settings/{module} 对应配置 / Container and requests; /settings/{module} selects config.
 * @returns {{destroy(): void}} 清理接口 / Cleanup handle.
 */
function mountPreferencePanes({ element: root, fetch, title = "Preferences" }) {
  const document = root.ownerDocument;
  const window = document.defaultView;
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const shell = node("div", "pp-panel");
  const header = node("header", "pp-header");
  const back = node("button", "pp-back", "返回");
  back.type = "button";
  const heading = node("h1", "pp-title", title);
  const viewport = node("div", "pp-viewport");
  const toast = node("div", "pp-toast");
  toast.setAttribute("role", "status");
  toast.hidden = true;
  header.append(back, heading);
  shell.append(header, viewport, toast);
  root.append(shell);
  let timer,
    routedPath,
    generation = 0,
    active = null,
    saving = false,
    pendingRoute = false,
    destroyed = false;
  const notify = (event) => {
    if (destroyed) return;
    toast.textContent = event.kind === "error" ? `操作失败：${event.message}` : event.operation === "delete" ? "删除成功" : "修改成功";
    toast.dataset.kind = event.kind;
    toast.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      toast.hidden = true;
    }, 2400);
  };
  const client = createPreferencesClient({ ...(fetch ? { fetch } : {}), notify });
  function replace(view, direction) {
    const old = viewport.firstElementChild;
    viewport.replaceChildren(view);
    if (old && !document.defaultView.matchMedia("(prefers-reduced-motion: reduce)").matches)
      view.animate(
        [
          { opacity: 0.4, transform: `translateX(${direction * 24}px)` },
          { opacity: 1, transform: "translateX(0)" },
        ],
        { duration: 180, easing: "ease-out" },
      );
  }
  async function open(module) {
    const version = ++generation;
    active = module;
    back.disabled = window.history.length <= 1;
    heading.textContent = module;
    replace(node("p", "pp-loading", "读取设置…"), 1);
    try {
      await client.open(module);
      if (version === generation) controls();
    } catch (error) {
      if (version !== generation) return;
      const view = node("section", "pp-error");
      view.append(node("p", "", `加载失败：${error.message}`));
      const retry = node("button", "", "重新读取");
      retry.onclick = () => open(module);
      view.append(retry);
      replace(view, 1);
    }
  }
  function controls() {
    const { definition, values } = client.snapshot(active);
    heading.textContent = definition.metadata?.name || active;
    const view = node("section", "pp-fields");
    const growingInputs = [];
    const metadata = definition.metadata;
    if (metadata) {
      const info = node("div", "pp-module-info");
      const iconURL = metadata.icon || metadata.icons?.[1] || metadata.icons?.[0];
      const resourceURL = (value) => {
        const url = new window.URL(value, window.location.href);
        if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("Module metadata URLs must use HTTP or HTTPS");
        return url.href;
      };
      if (iconURL) {
        const image = node("img", "pp-module-icon");
        image.src = resourceURL(iconURL);
        image.alt = "";
        info.append(image);
      }
      const details = node("div", "pp-module-details");
      if (metadata.author) details.append(node("p", "pp-description", metadata.author));
      for (const description of [metadata.desc ?? metadata.description, ...(metadata.descs ?? [])])
        if (description) details.append(node("p", "pp-description", description));
      if (metadata.repo) {
        const link = node("a", "pp-module-source", "项目主页");
        link.href = resourceURL(metadata.repo);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        details.append(link);
      }
      info.append(details);
      view.append(info);
    }
    for (const field of definition.fields) {
      const row = node("fieldset", "pp-field");
      row.append(node("legend", "", field.name));
      if (field.description) row.append(node("p", "pp-description", field.description));
      const value = values[field.key];
      let read, write;
      if (field.options && field.type !== "array") {
        const select = node("select", "pp-input");
        select.setAttribute("aria-label", field.name);
        field.options.forEach((option, index) => {
          const item = node("option", "", option.label);
          item.value = String(index);
          select.append(item);
        });
        write = (value) => {
          select.selectedIndex = field.options.findIndex((option) => option.key === value);
        };
        row.append(select);
        read = () => field.options[select.selectedIndex]?.key;
      } else if (field.type === "array" && field.options) {
        const inputs = field.options.map((option) => {
          const label = node("label", "pp-choice", option.label);
          const input = node("input", "");
          input.type = "checkbox";
          input.checked = Array.isArray(value) && value.includes(option.key);
          label.prepend(input);
          row.append(label);
          return { input, key: option.key };
        });
        read = () => inputs.filter((option) => option.input.checked).map((option) => option.key);
        write = (value) => {
          for (const option of inputs) option.input.checked = Array.isArray(value) && value.includes(option.key);
        };
      } else {
        const multiline = field.control === "textarea" || field.type === "array";
        const input = node(multiline ? "textarea" : "input", "pp-input");
        input.setAttribute("aria-label", field.name);
        if (field.placeholder) input.placeholder = field.placeholder;
        if (multiline && field.rows) input.rows = field.rows;
        const grow = () => {
          if (!multiline || !field.autoGrow || !input.isConnected) return;
          input.style.height = "auto";
          const baseline = input.getBoundingClientRect().height;
          const style = window.getComputedStyle(input);
          const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
          input.style.height = `${Math.max(baseline, input.scrollHeight + borders)}px`;
        };
        if (multiline && field.autoGrow) {
          input.addEventListener("input", grow);
          growingInputs.push(grow);
        }
        if (field.type === "boolean") {
          input.type = "checkbox";
          write = (value) => {
            input.checked = value === true;
          };
          read = () => input.checked;
        } else {
          if (!multiline) input.type = field.type === "number" ? "number" : "text";
          write = (value) => {
            input.value = field.type === "array" ? JSON.stringify(value ?? []) : (value ?? "");
            grow();
          };
          read = () =>
            field.type === "array"
              ? JSON.parse(input.value)
              : field.type === "number"
                ? input.value === ""
                  ? Number.NaN
                  : Number(input.value)
                : input.value;
        }
        row.append(input);
      }
      write(value);
      const actions = node("div", "pp-actions");
      for (const [operation, label] of [
        ["write", "保存"],
        ["delete", "删除覆盖值"],
      ]) {
        const button = node("button", "", label);
        button.type = "button";
        button.onclick = async () => {
          if (saving) return;
          saving = true;
          back.disabled = true;
          view.querySelectorAll("button,input,select,textarea").forEach((input) => {
            input.disabled = true;
          });
          let success = false;
          try {
            if (operation === "delete") await client.remove(active, field.key);
            else {
              let value;
              try {
                value = read();
              } catch (error) {
                notify({ kind: "error", message: error.message });
                throw error;
              }
              await client.set(active, field.key, value);
            }
            success = true;
          } catch {
            /* 客户端已显示错误通知 / Client already displayed an error notification. */
          } finally {
            saving = false;
            back.disabled = window.history.length <= 1;
            view.querySelectorAll("button,input,select,textarea").forEach((input) => {
              input.disabled = false;
            });
            if (success && !destroyed) {
              // 只更新当前控件，保留其它尚未保存的输入。
              // Update this control without discarding other unsaved inputs.
              write(client.snapshot(active).values[field.key]);
            }
            if (!destroyed && pendingRoute) route();
          }
        };
        actions.append(button);
      }
      row.append(actions);
      view.append(row);
    }
    viewport.replaceChildren(view);
    for (const grow of growingInputs) grow();
  }
  function route() {
    if (saving) {
      pendingRoute = true;
      return;
    }
    pendingRoute = false;
    if (active) client.leave(active);
    routedPath = window.location.pathname;
    const match = /^\/settings\/([a-zA-Z0-9_-]+)\/?$/.exec(routedPath);
    if (!match) {
      generation++;
      active = null;
      heading.textContent = title;
      replace(node("p", "pp-error", "页面地址应为 /settings/模块标识。"), 1);
      return;
    }
    open(match[1]);
  }
  const onPopState = () => {
    if (window.location.pathname !== routedPath) route();
  };
  const onPageShow = (event) => {
    if (event.persisted) route();
  };
  back.onclick = () => {
    if (!saving) window.history.back();
  };
  window.addEventListener("popstate", onPopState);
  window.addEventListener("pageshow", onPageShow);
  route();
  return {
    destroy() {
      destroyed = true;
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      generation++;
      if (active) client.leave(active);
      clearTimeout(timer);
      shell.remove();
    },
  };
}

const modules = ["Enhanced", "Global", "Redirect", "ADBlock"];
const root = document.querySelector("#preferences");
const client = createPreferencesClient({ timeout: 3500 });
let panel,
	revision = 0,
	routedPath;
const theme = navigator.userAgent.match(/themeId\/(\d+)/)?.[1];
if (theme) document.documentElement.dataset.theme = theme === "2" ? "dark" : "light";

function node(tag, className, text) {
	const element = document.createElement(tag);
	element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}

function icon(module) {
	const picture = node("picture", "logo");
	const source = node("source", "");
	source.media = theme ? (theme === "2" ? "all" : "not all") : "(prefers-color-scheme: dark)";
	const base = module ? `/settings/assets/${module}_` : "/settings/logo_settings_";
	source.srcset = `${base}dark.png`;
	const image = node("img", "");
	image.src = `${base}light.png`;
	image.alt = "";
	picture.append(source, image);
	return picture;
}

function render() {
	routedPath = location.pathname;
	const version = ++revision;
	panel?.destroy();
	panel = undefined;
	root.replaceChildren();
	if (routedPath !== "/settings/") {
		panel = mountPreferencePanes({ element: root, title: "Biliverse" });
		return;
	}
	const home = node("section", "biliverse-home");
	const brand = icon();
	brand.className = "brand-logo";
	home.append(brand);
	home.append(node("h1", "", "Biliverse"));
	const section = node("section", "self-panel is-zh");
	section.append(node("h2", "header", "插件"));
	const container = node("div", "container");
	const scrollView = node("div", "scroll-view");
	const rows = node("div", "scroll");
	scrollView.append(rows);
	container.append(scrollView);
	section.append(container);
	home.append(section, node("p", "settings-note", "设置保存在当前代理工具中。使用本地设置前，请将配置类型设为 PersistentStore。"));
	root.append(home);
	for (const module of modules) {
		const button = node("button", "self-item is-zh");
		button.type = "button";
		button.disabled = true;
		button.dataset.module = module;
		const status = node("span", "module-status", "检测中");
		button.append(icon(module), node("span", "name", module), status);
		rows.append(button);
		button.onclick = () => {
			history.pushState(null, "", `/settings/${module}`);
			render();
			if (!matchMedia("(prefers-reduced-motion: reduce)").matches) root.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], { duration: 260, easing: "ease-out" });
		};
		client.probe(module).then(available => {
			if (revision !== version) return;
			button.disabled = !available;
			status.textContent = available ? "" : "未响应";
		});
	}
}

window.addEventListener("popstate", () => {
	if (routedPath !== location.pathname) {
		render();
		if (location.pathname === "/settings/" && !matchMedia("(prefers-reduced-motion: reduce)").matches) root.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }], { duration: 260, easing: "ease-out" });
	}
});
window.addEventListener("pageshow", event => {
	if (event.persisted && location.pathname === "/settings/") render();
});
render();
