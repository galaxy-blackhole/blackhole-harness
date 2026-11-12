/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				if (!isNullable(value) || key in data) result[key] = value;
			}
			if (!strict) merge(result, data);
			return [result];
		});
		Schema.extend("union", (data, { list, toString }, options, strict) => {
			const messages = [];
			for (const inner of list) try {
				return Schema.resolve(data, inner, options, strict);
			} catch (error) {
				messages.push(error);
			}
			throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		});
		Schema.extend("intersect", (data, { list, toString }, options, strict) => {
			if (!list.length) return [data];
			let result;
			for (const inner of list) {
				const value = Schema.resolve(data, inner, options, true)[0];
				if (isNullable(value)) continue;
				if (isNullable(result)) result = value;
				else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
				else if (typeof value === "object") merge(result ??= {}, value);
				else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
			}
			if (!strict && isPlainObject(data)) merge(result, data);
			return [result];
		});
		Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
			const [result, adapted = data] = Schema.resolve(data, inner, options, true);
			if (preserve) return [callback(result)];
			else return [callback(result), callback(adapted)];
		});
		const formatters = {};
		function defineMethod(name, keys, format) {
			formatters[name] = format;
			Object.assign(Schema, { [name](...args) {
				const schema = new Schema({ type: name });
				keys.forEach((key, index) => {
					switch (key) {
						case "sKey":
							schema.sKey = args[index] ?? Schema.string();
							break;
						case "inner":
							schema.inner = Schema.from(args[index]);
							break;
						case "list":
							schema.list = args[index].map(Schema.from);
							break;
						case "dict":
							schema.dict = mapValues(args[index], Schema.from);
							break;
						case "bits":
							schema.bits = {};
							for (const key in args[index]) {
								if (typeof args[index][key] !== "number") continue;
								schema.bits[key] = args[index][key];
							}
							break;
						case "callback": {
							const callback = schema.callback = args[index];
							callback["toJSON"] ||= () => callback.toString();
							break;
						}
						case "constructor": {
							const constructor = schema.constructor = args[index];
							if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
							break;
						}
						default: schema[key] = args[index];
					}
				});
				if (name === "object" || name === "dict") schema.meta.default = {};
				else if (name === "array" || name === "tuple") schema.meta.default = [];
				else if (name === "bitset") schema.meta.default = 0;
				return schema;
			} });
		}
		defineMethod("is", ["constructor"], ({ constructor }) => {
			if (typeof constructor === "function") return constructor.name;
			else return constructor;
		});
		defineMethod("any", [], () => "any");
		defineMethod("never", [], () => "never");
		defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
		defineMethod("string", [], () => "string");
		defineMethod("number", [], () => "number");
		defineMethod("boolean", [], () => "boolean");
		defineMethod("bitset", ["bits"], () => "bitset");
		defineMethod("function", [], () => "function");
		defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
		defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
		defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
		defineMethod("object", ["dict"], ({ dict }) => {
			if (Object.keys(dict).length === 0) return "{}";
			return `{ ${Object.entries(dict).map(([key, inner]) => {
				return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
			}).join(", ")} }`;
		});
		defineMethod("union", ["list"], ({ list }, inline) => {
			const result = list.map(({ toString: format }) => format()).join(" | ");
			return inline ? `(${result})` : result;
		});
		defineMethod("intersect", ["list"], ({ list }) => {
			return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
		});
		defineMethod("transform", [
			"inner",
			"callback",
			"preserve"
		], ({ inner }, isInner) => inner.toString(isInner));
		//#endregion
		//#region lib/types/locale-settings.js
		/** Locale preference stored in the Host user-settings document. */
		/** Settings namespace owned by the locale plugin. */
		const LOCALE_SETTINGS_NAMESPACE = "locale";
		/** Field carrying an explicit locale selection; absence delegates to the browser. */
		const LOCALE_PREFERENCE_FIELD = "preference";
		/** Accepted BCP 47-style language ids. */
		const LOCALE_ID_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;
		/** Locale identifiers shipped by the browser client. */
		const LOCALE_IDS = ["zh", "en"];
		/** Durable locale schema; also the wire envelope the browser scope validates against. */
		const LocaleSettingsFields = { [LOCALE_PREFERENCE_FIELD]: Schema.string().pattern(LOCALE_ID_PATTERN).required(false) };
		Schema.object(LocaleSettingsFields);
		//#endregion
		//#region lib/types/locales/zh.js
		/** zh base dictionary for the common namespace: cross-feature standard words. */
		const zh$1 = {
			"ok": "确定",
			"cancel": "取消",
			"close": "关闭",
			"copy": "复制",
			"copied": "复制成功",
			"codeBlock.title": "代码块",
			"codeBlock.wrap": "自动换行",
			"codeBlock.unwrap": "取消自动换行",
			"copy.failed": "复制失败",
			"copy.value": "复制值",
			"copy.json": "复制 JSON",
			"copy.path": "复制属性路径",
			"copy.prettyJson": "复制格式化 JSON",
			"copy.compactJson": "复制紧凑 JSON",
			"copy.optionsHint": "{action}；右键点击可选择复制方式",
			"retry": "重试",
			"loading": "加载中…",
			"load.failed": "加载失败",
			"submit": "提交",
			"submitting": "正在提交…",
			"next": "下一步",
			"previous": "上一步",
			"skip": "跳过",
			"delete": "删除",
			"edit": "编辑",
			"save": "保存",
			"search": "搜索",
			"more": "更多",
			"collapse": "收起",
			"expand": "展开",
			"back": "返回",
			"brand.localBuild": "DSH 本地构建",
			"workspace.defaultName": "默认工作区",
			"unknown": "未知",
			"none": "无",
			"truncated": "已截断",
			"json.label": "JSON",
			"markdown.footnotes": "脚注",
			"markdown.truncatedCharacters": "… 已截断，共 {total} 字符",
			"number.thousand": "{value}K",
			"number.million": "{value}M"
		};
		//#endregion
		//#region lib/types/locales/en.js
		/** en base dictionary for the common namespace, checked complete against the zh key set. */
		const en$1 = {
			"ok": "OK",
			"cancel": "Cancel",
			"close": "Close",
			"copy": "Copy",
			"copied": "Copied",
			"codeBlock.title": "Code block",
			"codeBlock.wrap": "Wrap lines",
			"codeBlock.unwrap": "Do not wrap lines",
			"copy.failed": "Copy failed",
			"copy.value": "Copy value",
			"copy.json": "Copy JSON",
			"copy.path": "Copy property path",
			"copy.prettyJson": "Copy pretty JSON",
			"copy.compactJson": "Copy compact JSON",
			"copy.optionsHint": "{action}; right-click for copy options",
			"retry": "Retry",
			"loading": "Loading…",
			"load.failed": "Failed to load",
			"submit": "Submit",
			"submitting": "Submitting…",
			"next": "Next",
			"previous": "Previous",
			"skip": "Skip",
			"delete": "Delete",
			"edit": "Edit",
			"save": "Save",
			"search": "Search",
			"more": "More",
			"collapse": "Collapse",
			"expand": "Expand",
			"back": "Back",
			"brand.localBuild": "DSH Local Build",
			"workspace.defaultName": "Default workspace",
			"unknown": "Unknown",
			"none": "None",
			"truncated": "Truncated",
			"json.label": "JSON",
			"markdown.footnotes": "Footnotes",
			"markdown.truncatedCharacters": "… truncated at {total} characters",
			"number.thousand": "{value}K",
			"number.million": "{value}M"
		};
		//#endregion
		//#region lib/types/locales/settings.js
		/** `settings.locale` namespace dictionaries (the Language row's copy). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = { "language.title": "语言" };
		/** English dictionary, checked complete against the zh key set. */
		const en = { "language.title": "Language" };
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/locale/src/client/LanguageRow.module.css.mjs
		const css = ".hVGvvW_row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}.hVGvvW_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.hVGvvW_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.hVGvvW_selector{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.hVGvvW_selector:hover{background:var(--dsw-alias-interactive-bg-hover)}.hVGvvW_chevron{flex:none}";
		const tagId = "@galaxy-blackhole/gbh-client-locale/LanguageRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@galaxy-blackhole/gbh-client-locale";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var LanguageRow_module_css_default = {
			"chevron": "hVGvvW_chevron",
			"row": "hVGvvW_row",
			"rowText": "hVGvvW_rowText",
			"selector": "hVGvvW_selector",
			"title": "hVGvvW_title"
		};
		//#endregion
		//#region lib/types/client/LanguageRow.js
		/**
		* Language preference row registered into the General section item slot
		* (figma 501:30011 'Setting-Cell'): title + selector pill opening the locale
		* menu. Registered by this package — the locale feature owns its own
		* settings surface.
		*/
		/**
		* Render the Language row.
		* @param props - composed slot props.
		* @returns the row element tree.
		*/
		function LanguageRow({ t, setLocale, useStore }) {
			const active = useStore((s) => s.active);
			const options = useStore((s) => s.options);
			const [open, setOpen] = (0, react.useState)(false);
			const activeLabel = options.find((o) => o.id === active)?.label ?? active;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: LanguageRow_module_css_default.row,
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: LanguageRow_module_css_default.rowText,
					children: (0, react_jsx_runtime.jsx)("div", {
						className: LanguageRow_module_css_default.title,
						children: t("language.title")
					})
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open,
					onClose: () => {
						setOpen(false);
					},
					items: options.map((o) => ({
						id: o.id,
						label: o.label
					})),
					selectedId: active,
					onSelect: (id) => {
						setLocale(id);
						setOpen(false);
					},
					align: "end",
					portal: true,
					anchor: (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: LanguageRow_module_css_default.selector,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						onClick: () => {
							setOpen((v) => !v);
						},
						children: [activeLabel, (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: LanguageRow_module_css_default.chevron })]
					})
				})]
			});
		}
		//#endregion
		//#region lib/types/client/settings-store.js
		/**
		* Language row slot store: a mirror of the locale service snapshot. The
		* plugin's apply-world change listener is the only writer; the row component
		* reads via props.useStore.
		*/
		/**
		* Declares the Language row state and write surface.
		* @returns the store handle.
		*/
		function createLanguageRowStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					active: "",
					options: [],
					revision: -1
				}),
				actions: { sync: (d, active, options, revision) => {
					if (revision <= d.revision) return;
					d.active = active;
					d.options = options;
					d.revision = revision;
				} }
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/**
		* English is both the locale the UI opens in when the browser names no registered
		* language (and for non-browser runs), and the dictionary consulted after the
		* active locale misses a key. One constant serves both because the shipped
		* `zh`/`en` dictionaries carry identical key sets, so neither direction can
		* leave a key unresolved; the residual case points at English rather than
		* zh because a browser naming no registered language is the reader least
		* likely to read Chinese.
		*/
		const FALLBACK_LOCALE = "en";
		/** Shared namespace for shell-level texts. */
		const COMMON_NS = "common";
		/** Namespace owning this feature's settings-row copy. */
		const SETTINGS_NS = "settings.locale";
		/** The two locales and dictionaries shipped by this package. */
		const BUILT_IN_LOCALE_METADATA = {
			zh: {
				label: "中文",
				fallback: "en"
			},
			en: { label: "English" }
		};
		const BUILT_IN_LOCALES = Object.freeze(LOCALE_IDS.map((id) => Object.freeze({
			id,
			...BUILT_IN_LOCALE_METADATA[id]
		})));
		/** Case-insensitive key for BCP 47-style ids. */
		function localeKey(value) {
			return value.toLowerCase();
		}
		/** Validate and detach a language-pack contribution from its mutable input. */
		function normalizeLanguage(input) {
			if (!LOCALE_ID_PATTERN.test(input.id)) throw new Error(`locale id "${input.id}" is not a BCP 47-style tag`);
			if (input.label.trim() === "") throw new Error("locale label must not be empty");
			if (!LOCALE_ID_PATTERN.test(input.fallback)) throw new Error(`locale fallback "${input.fallback}" is not a BCP 47-style tag`);
			return Object.freeze({
				id: input.id,
				label: input.label,
				fallback: input.fallback
			});
		}
		/**
		* Point `<html lang>` at the active locale, keeping the served document in
		* sync with locale snapshot changes.
		* @param snapshot - current locale state, including the active definition.
		*/
		function syncDocumentLanguage(snapshot) {
			if (typeof document === "undefined") return;
			const language = snapshot.active === "zh" ? "zh-CN" : snapshot.active;
			if (document.documentElement.lang !== language) document.documentElement.lang = language;
		}
		/**
		* Dictionary registry plus locale preference. Lookup walks the active
		* language's declared fallback chain in the entry namespace, then repeats it
		* in the shared common namespace before showing the key itself. Reads go
		* through {@link getLocale}; preferences change only through
		* {@link setLocale}, while language packs extend the catalog through
		* {@link addLanguage}. Continuous sync uses the `locale/change` event or
		* the LocaleFace getSnapshot/subscribe pair installed through
		* `ctx.slots.installLocale`.
		*/
		var LocaleRuntime = class {
			bootstrap;
			dicts = /* @__PURE__ */ new Map();
			bound = /* @__PURE__ */ new Map();
			catalog = /* @__PURE__ */ new Map();
			fallbackChains = /* @__PURE__ */ new Map();
			snapshot;
			listeners = /* @__PURE__ */ new Set();
			ctx;
			host;
			/** Browser-derived locale standing wherever no explicit Host selection does. */
			provisional;
			/** Last explicit selection, including one awaiting an external registration. */
			preference;
export {};
