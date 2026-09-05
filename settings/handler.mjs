import { $app, Storage, Lodash as _ } from "@nsnanocat/util";

// MODULE, fields and page are injected by scripts/build-settings.mjs.
export function settingsResponse(request, settings) {
	const url = new URL(request.url);
	if (url.origin !== "https://app.bilibili.com" || !url.pathname.startsWith("/biliverse/settings/")) return;
	const requestedModule = url.pathname.match(/^\/biliverse\/settings\/api\/([^/]+)$/)?.[1];
	const moduleName = requestedModule ?? MODULE;
	const moduleFields = fieldsByModule?.[moduleName] ?? fields;
	const storedSettings = Storage.getItem("BiliBili", {})?.[moduleName]?.Settings ?? {};
	const moduleSettings = storedSettings.Storage === "PersistentStore" ? storedSettings : (moduleName === MODULE ? settings : {});
	const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
	const reply = (status, data) => ({ status, headers, body: JSON.stringify(data) });
	if ($app === "Worker") return reply(501, { error: "设置页面仅支持本地插件脚本，不支持云端 Rewrite 模式。" });
	if (page && (url.pathname === "/biliverse/settings/" || url.pathname === `/biliverse/settings/${MODULE}/`)) {
		if (request.method !== "GET") return reply(405, { error: "仅支持 GET" });
		return { status: 200, headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" }, body: page };
	}
	if (!requestedModule || !fieldsByModule?.[moduleName]) return;
	const requestHeaders = Object.fromEntries(Object.entries(request.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
	if (requestHeaders["x-biliverse-settings"] !== "1" || (requestHeaders.origin && requestHeaders.origin !== url.origin)) return reply(403, { error: "请从 Biliverse 设置页面访问。" });
	if (request.method === "HEAD") return { status: 200, headers, body: "" };
	if (request.method === "GET") {
		const values = Object.fromEntries(moduleFields.map(field => [field.key, _.get(moduleSettings, field.key, field.defaultValue)]));
		values.Storage = Storage.getItem("BiliBili", {})?.[moduleName]?.Settings?.Storage ?? globalThis.$argument.Storage ?? "Argument";
		return reply(200, { module: moduleName, fields: moduleFields, values });
	}
	if (request.method !== "POST") return reply(405, { error: "仅支持 GET、POST" });
	if (!requestHeaders["content-type"]?.startsWith("application/json")) return reply(415, { error: "请使用 JSON 请求体。" });
	if (typeof request.body !== "string" || request.body.length > 65536) return reply(400, { error: "请求体为空或过大。" });
	let input;
	try { input = JSON.parse(request.body); } catch { return reply(400, { error: "JSON 格式错误。" }); }
	if (!input?.values || typeof input.values !== "object" || Array.isArray(input.values)) return reply(400, { error: "缺少设置值。" });
	const entries = Object.entries(input.values);
	if (!entries.length) return reply(400, { error: "没有需要保存的设置。" });
	for (const [key, value] of entries) {
		const field = moduleFields.find(item => item.key === key);
		if (!field) return reply(400, { error: `未知设置：${key}` });
		const values = field.type === "array" ? value : [value];
		const validType = field.type === "array" ? Array.isArray(value) : typeof value === field.type;
		if (!validType || (field.type === "number" && !Number.isFinite(value)) || (typeof value === "string" && value.length > 2048)) return reply(400, { error: `设置类型错误：${key}` });
		if (field.options && values.some(item => !field.options.some(option => option.key === item))) return reply(400, { error: `选项不存在：${key}` });
		if (field.type === "array" && new Set(value).size !== value.length) return reply(400, { error: `选项重复：${key}` });
	}
	// Preserve effective arguments and unexposed settings when switching to local storage.
	const stored = Storage.getItem("BiliBili", {});
	const savedRoot = _.merge({}, stored, { [moduleName]: { Settings: _.merge({}, moduleSettings, stored?.[moduleName]?.Settings) } });
	const saved = savedRoot[moduleName].Settings;
	for (const [key, value] of entries) _.set(saved, key, value);
	savedRoot[moduleName].Settings = saved;
	if (!Storage.setItem("BiliBili", savedRoot)) return reply(500, { error: "本地存储写入失败，设置未保存。" });
	return reply(200, { saved: true });
}
