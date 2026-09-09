var PreferencePanes = (function (exports) {
	'use strict';

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
	 * 为没有原生远程 Mock 的代理返回 BoxJS JSON，不提供存储或页面处理。
	 * Return BoxJS JSON on proxies without native remote Mock, without storage or page handling.
	 * @param {unknown} config 构建时嵌入的 BoxJS JSON / BoxJS JSON embedded at build time.
	 * @returns {void} 将响应交给宿主 / Deliver the response to the host.
	 */
	function mockConfiguration(config) {
		const method = globalThis.$request.method;
		const allowed = method === "GET" || method === "HEAD";
		const response = {
			status: allowed ? 200 : 405,
			headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Allow: "GET, HEAD" },
			body: method === "HEAD" ? "" : JSON.stringify(allowed ? config : { error: "Method not allowed" }),
		};
		done($app === "Quantumult X" ? response : { response });
	}

	exports.mockConfiguration = mockConfiguration;

	return exports;

})({});

PreferencePanes.mockConfiguration([{"id":"@BiliBili.Enhanced.Settings.Home.Switch","name":"[首页] 启用此标签页自定义功能","type":"boolean","val":true,"desc":"启用后可自定义首页标签页、顶栏按钮等内容。"},{"id":"@BiliBili.Enhanced.Settings.Home.Tab","name":"[首页] 标签页","type":"checkboxes","val":["live","recommend","hottopic","bangumi","anime","film","koreavtw"],"items":[{"key":"live","label":"直播"},{"key":"recommend","label":"推荐"},{"key":"hottopic","label":"热门"},{"key":"bangumi","label":"番剧"},{"key":"anime","label":"动画（港澳台）"},{"key":"film","label":"影视"},{"key":"koreavtw","label":"韩综（港澳台）"},{"key":"game","label":"游戏"},{"key":"minecraft","label":"minecraft"},{"key":"anime_fan","label":"动画同人"},{"key":"funny","label":"搞笑"},{"key":"school","label":"校园"},{"key":"digital","label":"数码"}],"desc":"请选择启用的首页标签页，建议不超过7个。"},{"id":"@BiliBili.Enhanced.Settings.Home.Tab_default","name":"[首页] 默认标签页","type":"selects","val":"recommend","items":[{"key":"live","label":"直播"},{"key":"recommend","label":"推荐"},{"key":"hottopic","label":"热门"},{"key":"bangumi","label":"番剧"},{"key":"anime","label":"动画（港澳台）"},{"key":"film","label":"影视"},{"key":"koreavtw","label":"韩综（港澳台）"},{"key":"game","label":"游戏"},{"key":"minecraft","label":"minecraft"},{"key":"anime_fan","label":"动画同人"},{"key":"funny","label":"搞笑"},{"key":"school","label":"校园"},{"key":"digital","label":"数码"}],"desc":"请选择启动APP时默认展示的标签页，需选择已启用的标签页。"},{"id":"@BiliBili.Enhanced.Settings.Home.Top_left","name":"[首页] 顶栏（左侧）按钮（用户头像）","type":"selects","val":"mine","items":[{"key":"mine","label":"用户中心-我的"},{"key":"videoshortcut","label":"短视频"}],"desc":"请选择顶栏（左侧）按钮（用户头像）的作用（在biliBili粉色版中无法修改）。"},{"id":"@BiliBili.Enhanced.Settings.Home.Top","name":"[首页] 顶栏（右侧）按钮","type":"checkboxes","val":["messages"],"items":[{"key":"game_center","label":"游戏中心"},{"key":"mall","label":"会员购"},{"key":"messages","label":"消息"}],"desc":"请选择启用的顶栏（右侧）按钮。"},{"id":"@BiliBili.Enhanced.Settings.Home.Top_more","name":"[首页] 顶栏（更多）按钮","type":"checkboxes","val":["categories","search"],"items":[{"key":"categories","label":"更多分区"},{"key":"search","label":"搜索"}],"desc":"请选择启用的首页顶栏更多按钮。"},{"id":"@BiliBili.Enhanced.Settings.Bottom","name":"[底部] 导航栏按钮","type":"checkboxes","val":["home","dynamic","ogv","mall","mine"],"items":[{"key":"home","label":"首页"},{"key":"channel","label":"频道"},{"key":"dynamic","label":"动态"},{"key":"publish","label":"发布"},{"key":"ogv","label":"节目（港澳台）"},{"key":"mall","label":"会员购"},{"key":"messages","label":"消息"},{"key":"mine","label":"我的"}],"desc":"请选择启用的底部导航栏按钮，最多6个。"},{"id":"@BiliBili.Enhanced.Settings.Region.Switch","name":"[分区] 启用此标签页自定义功能","type":"boolean","val":true,"desc":"启用后可自定义分区标签页的内容。"},{"id":"@BiliBili.Enhanced.Settings.Mine.Switch","name":"[我的] 启用此标签页自定义功能","type":"boolean","val":true,"desc":"启用后可自定义我的标签页的服务内容。"},{"id":"@BiliBili.Enhanced.Settings.Mine.iPad.Switch","name":"[我的 iPad版] 启用此标签页自定义功能","type":"boolean","val":true,"desc":"启用后可自定义iPad版我的标签页的服务内容。"},{"id":"@BiliBili.Enhanced.Settings.Storage","name":"[储存] 配置类型","type":"selects","val":"Argument","items":[{"key":"Argument","label":"优先使用来自 $argument 的配置，$argument 不包含的设置项由 PersistentStore (BoxJs) 提供"},{"key":"PersistentStore","label":"只使用 PersistentStore (BoxJs) 提供的配置"},{"key":"database","label":"只使用由作者的 database.mjs 文件提供的默认配置，其他任何自定义配置不再起作用"}],"desc":"选择要使用的配置类型。未设置此选项或不通过此选项的旧版本的配置顺序依旧是 PersistentStore (BoxJs) > $argument > database。"},{"id":"@BiliBili.Enhanced.Settings.LogLevel","name":"[调试] 日志等级","type":"selects","val":"WARN","items":[{"key":"OFF","label":"关闭"},{"key":"ERROR","label":"❌ 错误"},{"key":"WARN","label":"⚠️ 警告"},{"key":"INFO","label":"ℹ️ 信息"},{"key":"DEBUG","label":"🅱️ 调试"},{"key":"ALL","label":"全部"}],"desc":"选择脚本日志的输出等级，低于所选等级的日志将全部输出。"}]);
