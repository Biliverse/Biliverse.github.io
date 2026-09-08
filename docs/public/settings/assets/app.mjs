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
 * 将 BoxJS 数组、app 或订阅转换为模块字段，保留原文件为唯一字段来源。
 * Normalize a BoxJS array, app or subscription using the source JSON as the field authority.
 * @param {unknown} config BoxJS JSON / BoxJS document.
 * @param {string} module API 第一段模块名 / First API path segment.
 * @returns {import("../index.js").ModuleDefinition} 存储根和字段 / Storage root and fields.
 * @throws {TypeError} 配置结构、字段路径、默认值或展示属性无效 / Invalid configuration, field path, default or presentation attribute.
 */
function normalizeBoxJs(config, module) {
	validatePathParts([module]);
	const apps = Array.isArray(config) ? [] : (config?.apps ?? [config]);
	if (!Array.isArray(apps)) throw new TypeError("Expected BoxJS apps array");
	for (const candidate of apps) {
		if (!candidate || typeof candidate !== "object") throw new TypeError("Expected BoxJS app object");
		if (candidate.settings !== undefined && !Array.isArray(candidate.settings)) throw new TypeError("Expected BoxJS settings array");
	}
	const owners = apps.filter(candidate => candidate.settings?.some(entry => typeof entry.id === "string" && entry.id.startsWith("@") && entry.id.slice(1).split(".")[1] === module));
	const entries = Array.isArray(config) ? config : owners.flatMap(candidate => candidate.settings);
	const app = owners.length === 1 ? owners[0] : undefined;
	let storageKey;
	const fields = [];
	for (const entry of entries) {
		if (typeof entry.id !== "string" || !entry.id.startsWith("@")) throw new TypeError("BoxJS settings require @root.path IDs");
		const [root, ...parts] = entry.id.slice(1).split(".");
		if (parts[0] !== module) continue;
		if (parts.length < 2) throw new TypeError("A BoxJS setting must be below the module root");
		validatePathParts(parts);
		if (!root || (storageKey && root !== storageKey)) throw new TypeError("A module must use one storage root");
		storageKey = root;
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
	const metadata = {};
	if (app) {
		for (const key of ["id", "name", "author", "repo", "script", "icon", "description", "desc", "icons", "descs"]) {
			if (app[key] === undefined) continue;
			const multiple = key === "icons" || key === "descs";
			const values = multiple ? app[key] : [app[key]];
			if (!Array.isArray(values) || values.some(item => typeof item !== "string")) throw new TypeError(`Invalid BoxJS app ${key}`);
			metadata[key] = multiple ? [...values] : app[key];
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
 * @property {import("./index.js").ModuleSnapshot["values"]} values 当前显示值 / Current display values.
 * @property {boolean} saving 是否正在写入 / Whether a mutation is in progress.
 */

/**
 * 创建页面会话缓存；打开时重读，选项操作仅在 HTTP 200 后更新缓存。
 * Create a page-session cache; reload on open and mutate cache only after HTTP 200.
 * @param {import("./index.js").PreferencesClientOptions} options 请求与通知 / Requests and notifications.
 * @returns {import("./index.js").PreferencesClient} 通用客户端 / Generic client.
 */
function createPreferencesClient({ fetch: request = globalThis.fetch.bind(globalThis), notify = () => {}, timeout = 10000 } = {}) {
	/** @type {Map<string, ModuleSession>} 模块会话表 / Module session map. */
	const sessions = new Map();
	/**
	 * 发送同源请求，处理超时与取消；数据 GET 的 404 交给调用方处理。
	 * Send a same-origin request with timeout and cancellation; callers handle missing-data GET responses.
	 * @param {string} path 相对请求路径 / Relative request path.
	 * @param {"HEAD" | "GET" | "POST" | "DELETE"} method HTTP 方法 / HTTP method.
	 * @param {unknown} body POST 值，其它方法忽略 / POST value, ignored by other methods.
	 * @param {AbortSignal | undefined} signal 会话取消信号 / Session cancellation signal.
	 * @param {boolean} [resource=false] 是否为无标记头的配置资源 / Whether this is a config resource without the marker header.
	 * @returns {Promise<Response>} 未消费正文的响应 / Response with an unread body.
	 * @throws {Error} 非 200 且非数据 GET 404、超时、取消或网络错误 / Non-200 status except missing-data GETs, timeout, cancellation or network error.
	 */
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
			if (response.status !== 200 && !(!resource && method === "GET" && response.status === 404)) throw new Error(`HTTP ${response.status}`);
			return response;
		} finally {
			clearTimeout(timer);
			signal?.removeEventListener("abort", abort);
		}
	}
	/**
	 * 由合法模块名生成配置 Mock 路径。
	 * Build the config Mock path from a valid module name.
	 * @param {string} module 模块标识 / Module identifier.
	 * @returns {string} 配置路径 / Config path.
	 */
	const configPath = module => {
		validatePathParts([module]);
		return `/configs/${encodeURIComponent(module)}`;
	};
	/**
	 * 获取独立快照，避免调用方修改内部缓存。
	 * Return an independent snapshot so callers cannot mutate the cache.
	 * @param {string} module 已打开模块 / Open module.
	 * @returns {import("./index.js").ModuleSnapshot} 会话快照 / Session snapshot.
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
		 * 探测配置 Mock，不读写存储。
		 * Probe the config Mock without accessing storage.
		 * @param {string} module 模块标识 / Module identifier.
		 * @returns {Promise<boolean>} 是否返回 HTTP 200 / Whether HTTP 200 was returned.
		 */
		async probe(module) {
			try {
				await send(configPath(module), "HEAD", undefined, undefined, true);
				return true;
			} catch {
				return false;
			}
		},
		/**
		 * 替换旧会话，读取一次配置与一次设置子树。
		 * Replace the previous session and read config and settings subtree once each.
		 * @param {string} module 模块标识 / Module identifier.
		 * @returns {Promise<import("./index.js").ModuleSnapshot>} 新快照 / New snapshot.
		 * @throws {Error} 读取失败、会话被替换或写入尚未完成 / Read failure, replaced session or unfinished write.
		 */
		async open(module) {
			const previous = sessions.get(module);
			if (previous?.saving) throw new Error("Cannot refresh while saving");
			previous?.controller.abort();
			const state = { controller: new AbortController(), definition: null, values: {}, saving: false };
			sessions.set(module, state);
			try {
				const definition = normalizeBoxJs(await (await send(configPath(module), "GET", undefined, state.controller.signal, true)).json(), module);
				if (definition.settingsPath.length < 2) throw new TypeError("BoxJS fields must share a settings subtree below the module root");
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
 * 挂载从 BoxJS 实时生成的设置面板和短暂通知。
 * Mount runtime-generated BoxJS controls and transient notifications.
 * @param {import("./index.js").PreferencesPanelOptions} options 容器与请求；页面路径 /settings/{module} 对应配置 / Container and requests; /settings/{module} selects config.
 * @returns {import("./index.js").PreferencesPanel} 面板生命周期句柄 / Panel lifecycle handle.
 */
function mountPreferencePanes({ element: root, fetch, title = "Preferences" }) {
	const document = root.ownerDocument;
	const window = document.defaultView;
	/**
	 * 创建元素，文本统一通过 textContent 写入。
	 * Create an element and assign text only through textContent.
	 * @template {keyof HTMLElementTagNameMap} T
	 * @param {T} tag HTML 标签 / HTML tag.
	 * @param {string} className 样式类名 / CSS class name.
	 * @param {string} [text] 纯文本内容 / Plain-text content.
	 * @returns {HTMLElementTagNameMap[T]} 对应类型的元素 / Element of the corresponding type.
	 */
	const node = (tag, className, text) => {
		const el = document.createElement(tag);
		el.className = className;
		if (text !== undefined) el.textContent = text;
		return el;
	};
	const shell = node("div", "pp-panel");
	const header = node("header", "pp-header");
	const back = node("button", "pp-back", "‹");
	back.setAttribute("aria-label", "返回");
	back.type = "button";
	const heading = node("h1", "pp-title", title);
	const viewport = node("div", "pp-viewport");
	const toast = node("div", "pp-toast");
	toast.setAttribute("role", "status");
	toast.hidden = true;
	header.append(back, heading, node("span", "pp-nav-spacer"));
	shell.append(header, viewport, toast);
	root.append(shell);
	let timer,
		secondaryRoute,
		routedPath,
		generation = 0,
		active = null,
		saving = false,
		pendingRoute = false,
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
	const client = createPreferencesClient({ fetch, notify });
	/**
	 * 切换加载或错误视图，按用户的动态效果偏好播放过渡。
	 * Replace a loading or error view, respecting reduced-motion preferences.
	 * @param {HTMLElement} view 新视图 / New view.
	 * @param {number} direction 过渡方向，正数从右侧进入 / Transition direction; positive enters from the right.
	 * @returns {void} 无返回值 / No return value.
	 */
	function replace(view, direction) {
		const old = viewport.firstElementChild;
		viewport.replaceChildren(view);
		if (old && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
			view.animate(
				[
					{ opacity: 0.4, transform: `translateX(${direction * 24}px)` },
					{ opacity: 1, transform: "translateX(0)" },
				],
				{ duration: 180, easing: "ease-out" },
			);
	}
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
	/**
	 * 从会话快照创建控件与操作按钮，不重新读取网络配置。
	 * Build controls and actions from the session snapshot without fetching config again.
	 * @returns {void} 无返回值 / No return value.
	 */
	function controls() {
		const { definition, values } = client.snapshot(active);
		heading.textContent = definition.metadata?.name || active;
		const view = node("section", "pp-fields");
		/** @type {Array<() => void>} 挂载后执行的多行高度更新 / Textarea sizing callbacks run after mounting. */
		const growingInputs = [];
		const editors = new Map();
		const summaries = [];
		const groups = new Map();
		const scrollPositions = new WeakMap();
		let activeEditor;
		let queue = Promise.resolve(),
			pendingWrites = 0;
		/**
		 * 根据 hash 切换多选页，保留上级 DOM 和滚动位置。
		 * Switch multi-select views by hash while retaining parent DOM and scroll position.
		 * @returns {void} 无返回值 / No return value.
		 */
		const showEditor = () => {
			let key;
			try {
				key = decodeURIComponent(window.location.hash.slice(1));
			} catch {
				key = "";
			}
			const editor = editors.get(key);
			const previous = activeEditor?.node ?? view;
			const next = editor?.node ?? view;
			if (previous !== next) {
				scrollPositions.set(previous, previous.scrollTop);
				previous.remove();
				viewport.append(next);
				next.scrollTop = scrollPositions.get(next) ?? 0;
				if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) next.animate([{ transform: `translateX(${editor ? 100 : -100}%)` }, { transform: "translateX(0)" }], { duration: 260, easing: "cubic-bezier(.22,.61,.36,1)" });
			}
			activeEditor = editor;
			heading.textContent = editor?.title ?? definition.metadata?.name ?? active;
			back.disabled = saving || (!editor && window.history.length <= 1);
		};
		secondaryRoute = showEditor;
		/**
		 * 串行执行页面操作，输入可继续编辑，完成后处理延后导航。
		 * Serialize page actions while inputs remain editable, then process deferred navigation.
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
					/* 请求层已通知错误 / The request layer has already reported the error. */
					if (!destroyed) failure();
				})
				.finally(() => {
					pendingWrites--;
					saving = pendingWrites > 0;
					if (destroyed && !saving) client.leave(active);
					back.disabled = saving || (!activeEditor && window.history.length <= 1);
					if (!saving && !destroyed && pendingRoute) route();
				}));
		}
		const metadata = definition.metadata;
		if (metadata) {
			const info = node("div", "pp-module-info");
			const iconURL = metadata.icon || metadata.icons?.[1] || metadata.icons?.[0];
			/**
			 * 将元数据地址解析为可显示的 HTTP(S) URL。
			 * Resolve a metadata address into an HTTP(S) URL suitable for display.
			 * @param {string} value 绝对或相对地址 / Absolute or relative address.
			 * @returns {string} 完整地址 / Absolute URL.
			 * @throws {TypeError} 非 HTTP(S) 协议 / Non-HTTP(S) protocol.
			 */
			const resourceURL = value => {
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
			for (const description of [metadata.author, metadata.desc ?? metadata.description, ...(metadata.descs ?? [])]) if (description) details.append(node("p", "pp-description", description));
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
			const match = /^\[([^\]]+)\]\s*(.*)$/.exec(field.name);
			const group = match?.[1] ?? "通用";
			if (!groups.has(group)) {
				const section = node("section", "form-group");
				const rows = node("div", "form-group__row");
				section.append(node("h2", "form-group__title", group), rows);
				groups.set(group, rows);
				view.append(section);
			}
			const row = node("div", "form-row pp-field");
			const label = node("div", "form-row__text");
			label.append(node("span", "form-row__title", match?.[2] ?? field.name));
			if (field.description) label.append(node("span", "form-row__subtitle", field.description));
			row.append(label);
			const value = values[field.key];
			/** @type {() => unknown} 读取尚未保存的输入 / Read the unsaved input. */
			let read;
			/** @type {(value: unknown) => void} 更新当前控件 / Update the current control. */
			let write;
			let inputContainer = row;
			let eventName = "change";
			switch (true) {
				case Boolean(field.options) && field.type !== "array": {
					const select = node("select", "pp-input");
					select.setAttribute("aria-label", field.name);
					field.options.forEach((option, index) => {
						const item = node("option", "", option.label);
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
					const page = node("section", "pp-choice-page");
					if (field.description) page.append(node("p", "pp-description", field.description));
					const choices = node("div", "form-group__row");
					page.append(choices);
					inputContainer = choices;
					editors.set(field.key, { node: page, title: match?.[2] ?? field.name });
					const summary = node("span", "form-row__value pp-summary");
					const link = node("button", "pp-choice-link");
					link.type = "button";
					link.setAttribute("aria-label", field.name);
					link.append(summary, node("span", "pp-chevron", "›"));
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
					link.onclick = () => {
						window.history.pushState({ ...window.history.state, preferencePane: active }, "", `#${encodeURIComponent(field.key)}`);
						showEditor();
					};
					row.addEventListener("click", event => {
						if (!link.contains(event.target)) link.click();
					});
					const inputs = field.options.map(option => {
						const label = node("label", "form-row pp-choice", option.label);
						const input = node("input", "");
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
					const input = node(multiline ? "textarea" : "input", "pp-input");
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
		const maintenance = node("section", "pp-maintenance");
		maintenance.append(node("h2", "pp-title", "模块数据"));
		const actions = node("div", "pp-actions");
		const cacheView = node("button", "", "查看 Caches");
		const cacheClear = node("button", "", "清空 Caches");
		const reset = node("button", "pp-danger", "重置模块");
		const output = node("pre", "pp-cache");
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
		viewport.replaceChildren(view);
		for (const grow of growingInputs) grow();
		showEditor();
	}
	/**
	 * 按页面 pathname 切换模块，写入尚未完成时延后导航。
	 * Route by the page pathname, deferring navigation while a mutation is pending.
	 * @returns {void} 无返回值 / No return value.
	 */
	function route() {
		if (saving) {
			pendingRoute = true;
			return;
		}
		pendingRoute = false;
		secondaryRoute = undefined;
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
	/**
	 * 仅在 pathname 改变时处理历史导航。
	 * Handle history navigation only when the pathname changes.
	 * @returns {void} 无返回值 / No return value.
	 */
	const onPopState = () => {
		if (window.location.pathname !== routedPath) route();
		else secondaryRoute?.();
	};
	const onHashChange = () => secondaryRoute?.();
	/**
	 * 从浏览器往返缓存恢复时重新读取当前模块。
	 * Reload the current module when restored from the browser back-forward cache.
	 * @param {PageTransitionEvent} event 页面恢复事件 / Page restoration event.
	 * @returns {void} 无返回值 / No return value.
	 */
	const onPageShow = event => {
		if (event.persisted) route();
	};
	back.onclick = () => {
		if (saving) return;
		if (window.location.hash && window.history.state?.preferencePane !== active) {
			window.history.replaceState(window.history.state, "", window.location.pathname);
			secondaryRoute?.();
		} else window.history.back();
	};
	window.addEventListener("popstate", onPopState);
	window.addEventListener("pageshow", onPageShow);
	window.addEventListener("hashchange", onHashChange);
	route();
	return {
		/**
		 * 移除监听器、定时器、会话和挂载内容。
		 * Remove listeners, timers, session and mounted content.
		 * @returns {void} 无返回值 / No return value.
		 */
		destroy() {
			destroyed = true;
			window.removeEventListener("popstate", onPopState);
			window.removeEventListener("pageshow", onPageShow);
			window.removeEventListener("hashchange", onHashChange);
			generation++;
			if (active && !saving) client.leave(active);
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
