/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			if (typeof data === "function") return [data];
			throw new ValidationError(`expected function but got ${data}`, options);
		});
		Schema.extend("is", (data, { constructor }, options) => {
			if (typeof constructor === "function") {
				if (data instanceof constructor) return [data];
				throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
			} else {
				if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
				let prototype = Object.getPrototypeOf(data);
				while (prototype) {
					if (prototype.constructor?.name === constructor) return [data];
					prototype = Object.getPrototypeOf(prototype);
				}
				throw new ValidationError(`expected ${constructor} but got ${data}`, options);
			}
		});
		function property(data, key, schema, options) {
			try {
				const [value, adapted] = Schema.resolve(data[key], schema, {
					...options,
					path: [...options.path || [], key]
				});
				if (adapted !== void 0) data[key] = adapted;
				return value;
			} catch (e) {
				if (!options?.autofix) throw e;
				delete data[key];
				return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
			}
		}
		Schema.extend("array", (data, { inner, meta }, options) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
			return [data.map((_, index) => property(data, index, inner, options))];
		});
		Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in data) {
				let rKey;
				try {
					rKey = Schema.resolve(key, sKey, options)[0];
				} catch (error) {
					if (strict) continue;
					throw error;
				}
				result[rKey] = property(data, key, inner, options);
				data[rKey] = data[key];
				if (key !== rKey) delete data[key];
			}
			return [result];
		});
		Schema.extend("tuple", (data, { list }, options, strict) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			const result = list.map((inner, index) => property(data, index, inner, options));
			if (strict) return [result];
			result.push(...data.slice(list.length));
			return [result];
		});
		function merge(result, data) {
			for (const key in data) {
				if (key in result) continue;
				result[key] = data[key];
			}
		}
		Schema.extend("object", (data, { dict }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in dict) {
				const value = property(data, key, dict[key], options);
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
		//#region lib/types/theme-settings.js
		/** Theme preferences stored in the Host user-settings document. */
		/** Built-in preferences accepted at the registry and settings boundaries. */
		const THEME_PREFERENCES = [
			"light",
			"dark",
			"system"
		];
		/** Settings namespace owned by the theme plugin. */
		const THEME_SETTINGS_NAMESPACE = "ui-theme";
		/** Field carrying the selected built-in theme preference. */
		const THEME_PREFERENCE_FIELD = "preference";
		/** Field carrying the conversation content font size. */
		const FONT_SIZE_FIELD = "fontSize";
		/** Default preference when the user-settings document has no override. */
		const DEFAULT_PREFERENCE = "system";
		/** Independently configurable font roles. */
		const FONT_ROLES = [
			"text",
			"code",
			"terminal"
		];
		/**
		* Font sizes by role. `text` is the conversation content size; `code` is the
		* code-block size (inline code stays 1px larger); `terminal` is the sidebar
		* terminal cell font size.
		*/
		const FONT_SIZE_SPECS = {
			text: {
				field: FONT_SIZE_FIELD,
				variable: "--dsh-content-font-size",
				min: 10,
				max: 22,
				default: 14
			},
			code: {
				field: "codeFontSize",
				variable: "--dsh-code-font-size",
				min: 10,
				max: 16,
				default: 11
			},
			terminal: {
				field: "terminalFontSize",
				variable: "--dsh-terminal-font-size",
				min: 10,
				max: 20,
				default: 13
			}
		};
		/** Default font sizes by role. */
		const DEFAULT_FONT_SIZES = Object.freeze({
			text: FONT_SIZE_SPECS.text.default,
			code: FONT_SIZE_SPECS.code.default,
			terminal: FONT_SIZE_SPECS.terminal.default
		});
		/** Settings field carrying each role's font-family list. */
		const FONT_FAMILY_FIELDS = {
			text: "textFontFamily",
			code: "codeFontFamily",
			terminal: "terminalFontFamily"
		};
		/**
		* Body variable carrying one role's normalized font list; the token sheet
		* places it ahead of that role's built-in stack.
		* @param kind - font role.
		* @returns the CSS custom property name.
		*/
		function fontFamilyVariable(kind) {
			return `--dsh-font-family-${kind}`;
		}
		/**
		* Integer px schema for one role's font size.
		* @param spec - the role's range and default.
		* @returns the validated number schema.
		*/
		function fontSizeSchema(spec) {
			return Schema.number().step(1).min(spec.min).max(spec.max).default(spec.default);
		}
		/**
		* Collect every role's size from a settings section.
		* @param section - accepted theme settings.
		* @returns integer px sizes by role.
		*/
		function sectionFontSizes(section) {
			return Object.freeze({
				text: section.fontSize,
				code: section.codeFontSize,
				terminal: section.terminalFontSize
			});
		}
		/**
		* Whether one value is an accepted size for a role.
		* @param role - font role.
		* @param px - candidate size.
		* @returns true for an integer within the role's range.
		*/
		function isFontSize(role, px) {
			const spec = FONT_SIZE_SPECS[role];
			return Number.isInteger(px) && px >= spec.min && px <= spec.max;
		}
		Schema.object({
			[THEME_PREFERENCE_FIELD]: Schema.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE),
			[FONT_SIZE_FIELD]: fontSizeSchema(FONT_SIZE_SPECS.text),
			[FONT_SIZE_SPECS.code.field]: fontSizeSchema(FONT_SIZE_SPECS.code),
			[FONT_SIZE_SPECS.terminal.field]: fontSizeSchema(FONT_SIZE_SPECS.terminal),
			[FONT_FAMILY_FIELDS.text]: Schema.string().default(""),
			[FONT_FAMILY_FIELDS.code]: Schema.string().default(""),
			[FONT_FAMILY_FIELDS.terminal]: Schema.string().default("")
		});
		/** CSS Fonts generic and system family keywords, which must stay unquoted. */
		const GENERIC_FAMILIES = new Set([
			"serif",
			"sans-serif",
			"monospace",
			"cursive",
			"fantasy",
			"system-ui",
			"ui-serif",
			"ui-sans-serif",
			"ui-monospace",
			"ui-rounded",
			"emoji",
			"math",
			"fangsong",
			"-apple-system",
			"blinkmacsystemfont"
		]);
		/**
		* Normalize user input into a CSS font-family list. Names are comma separated;
		* quotes, backslashes, angle brackets, and control characters are dropped, and
		* every non-generic name is double-quoted, so the result is always a valid list
		* safe to embed in inline CSS and boot scripts. Normalizing a result returns it unchanged.
		* @param value - user-entered or stored font list.
		* @returns the normalized list, or `''` when no family name remains.
		*/
		function normalizeFontFamily(value) {
			return value.split(",").map((name) => name.replace(/["'\\<>\u0000-\u001f\u007f]/gu, "").replace(/\s+/gu, " ").trim()).filter((name) => name !== "").map((name) => GENERIC_FAMILIES.has(name.toLowerCase()) ? name : `"${name}"`).join(", ");
		}
		/**
		* Narrow one wire or registry value to a persistable preference.
		* @param value - value crossing the settings or registry boundary.
		* @returns whether the value is a built-in preference.
		*/
		function isThemePreference(value) {
			return THEME_PREFERENCES.some((preference) => preference === value);
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/client/FontSizeRow.module.css.mjs
		const css$2 = ".bVCLcG_row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}.bVCLcG_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.bVCLcG_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.bVCLcG_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}.bVCLcG_control{align-items:center;gap:8px;display:inline-flex}.bVCLcG_stepper{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);justify-content:center;align-items:center;min-width:72px;height:36px;display:inline-flex;position:relative}.bVCLcG_value{text-align:center;font-variant-numeric:tabular-nums;min-width:18px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}.bVCLcG_unit{color:var(--dsw-alias-label-secondary);font-size:14px;line-height:22px}.bVCLcG_arrows{opacity:0;flex-direction:column;gap:2px;display:flex;position:absolute;right:8px}.bVCLcG_stepper:hover .bVCLcG_arrows,.bVCLcG_stepper:focus-within .bVCLcG_arrows{opacity:1}.bVCLcG_arrow{border-radius:var(--dsw-radius-xs);background:color-mix(in srgb, var(--dsw-alias-bg-layer-1) 75%, transparent);width:17px;height:12px;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.bVCLcG_arrow:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1)}.bVCLcG_arrow:disabled{color:var(--dsw-alias-label-caption);cursor:default}.bVCLcG_expander{border-radius:var(--dsw-radius-xs);width:24px;height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.bVCLcG_expander:hover{background:var(--dsw-alias-interactive-bg-hover)}.bVCLcG_expander svg{transition:transform var(--ds-transition-duration-fast) var(--ds-ease-in-out)}.bVCLcG_expander[aria-expanded=true] svg{transform:rotate(180deg)}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-theme/FontSizeRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-theme";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var FontSizeRow_module_css_default = {
			"arrow": "bVCLcG_arrow",
			"arrows": "bVCLcG_arrows",
			"control": "bVCLcG_control",
			"desc": "bVCLcG_desc",
			"expander": "bVCLcG_expander",
			"row": "bVCLcG_row",
			"rowText": "bVCLcG_rowText",
			"stepper": "bVCLcG_stepper",
			"title": "bVCLcG_title",
			"unit": "bVCLcG_unit",
			"value": "bVCLcG_value"
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/client/FontFamilyRow.module.css.mjs
		const css$1 = ".vnGTiq_field{flex:0 240px;min-width:0}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-theme/FontFamilyRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-theme";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var FontFamilyRow_module_css_default = { "field": "vnGTiq_field" };
		//#endregion
		//#region lib/types/client/FontFamilyRow.js
		/**
		* Font-family preference row rendered inside the font settings group, once
		* per font role: title + role description + a text field holding the
		* comma-separated family list. Blur or Enter normalizes and commits the list;
		* an empty field restores the built-in stack. The field shows the persisted
		* list and resets whenever that list changes.
		*/
		/**
		* Render one font-family row.
		* @param props - composed slot props.
		* @returns the row element tree.
		*/
		function FontFamilyRow({ t, role, setFontFamily, useStore }) {
			const value = useStore((s) => s.fontFamilies[role]);
			const title = t(`fontFamily.${role}.title`);
			const commit = (input) => {
				input.value = normalizeFontFamily(input.value);
				setFontFamily(input.value);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: FontSizeRow_module_css_default.row,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: FontSizeRow_module_css_default.rowText,
					children: [(0, react_jsx_runtime.jsx)("div", {
						className: FontSizeRow_module_css_default.title,
						children: title
					}), (0, react_jsx_runtime.jsx)("div", {
						className: FontSizeRow_module_css_default.desc,
						children: t(`fontFamily.${role}.description`)
					})]
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
					className: FontFamilyRow_module_css_default.field,
export {};
