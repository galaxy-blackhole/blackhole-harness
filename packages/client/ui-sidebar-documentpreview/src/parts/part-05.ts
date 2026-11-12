/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				footnotes
			}), [
				copyLabel,
				copiedLabel,
				footnotes,
				codeLabel,
				wrapLabel,
				unwrapLabel
			]);
			const text = content.kind === "text" ? content.text : "";
			const split = (0, react.useMemo)(() => splitFrontmatter(text), [text]);
			if (content.kind !== "text") return null;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MarkdownBody_module_css_default.document,
				"data-document-markdown": true,
				children: [split === void 0 ? null : (0, react_jsx_runtime.jsx)(FrontmatterBox, { source: split.source }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
					text: split?.body ?? text,
					streaming: !content.eof,
					labels,
					pathImages
				})]
			});
		}
		/**
		* Frame one frontmatter block and choose its field list or verbatim source.
		* @param props - YAML between the frontmatter delimiters.
		* @returns the metadata box; it collapses when the document has no content.
		*/
		function FrontmatterBox({ source }) {
			const verbatim = (0, react_jsx_runtime.jsx)("pre", {
				className: MarkdownBody_module_css_default.frontmatterSource,
				children: source
			});
			return (0, react_jsx_runtime.jsx)("div", {
				className: MarkdownBody_module_css_default.frontmatter,
				"data-document-frontmatter": true,
				children: (0, react_jsx_runtime.jsx)(react.Suspense, {
					fallback: verbatim,
					children: (0, react_jsx_runtime.jsx)(FrontmatterFields, {
						source,
						fallback: verbatim
					})
				})
			});
		}
		//#endregion
		//#region lib/types/client/markdown/locales.js
		/** Markdown implementation labels and primitive chrome. */
		const zh$6 = {
			"viewer.label": "Markdown",
			"code.copy": "复制",
			"code.copied": "已复制",
			"footnotes": "脚注"
		};
		/** English labels, paired with the Chinese key set. */
		const en$6 = {
			"viewer.label": "Markdown",
			"code.copy": "Copy",
			"code.copied": "Copied",
			"footnotes": "Footnotes"
		};
		//#endregion
		//#region lib/types/client/markdown/index.js
		/** Implementation identity shared by metadata and the document slot. */
		const MARKDOWN_BODY_ID = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown";
		/**
		* Describe the Markdown implementation without taking ownership of loading.
		* @param title - locale-owned implementation name.
		* @returns builtin Markdown registration metadata.
		*/
		function markdownDefinition(title) {
			return {
				id: MARKDOWN_BODY_ID,
				extensions: ["md", "markdown"],
				priority: "builtin",
				title,
				loading: "text-pages",
				wrap: false
			};
		}
		/**
		* Register locale, metadata, and the document body for the owning plugin lifetime.
		* @param ctx - plugin context carrying locale, document registry, and slots.
		*/
		function apply$8(ctx) {
			const t = ctx.locale.bind("documentMarkdown");
			ctx.effect(() => ctx.locale.register("documentMarkdown", {
				zh: zh$6,
				en: en$6
			}), "document-markdown: dictionaries");
			ctx.effect(() => ctx.documentPreviews.register(markdownDefinition(() => t("viewer.label"))), "document-markdown: metadata");
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
				name: "sidebar.right.tab.document",
				key: MARKDOWN_BODY_ID,
				locale: "documentMarkdown"
			}, MarkdownBody)), "document-markdown: body");
		}
		//#endregion
		//#region lib/types/client/html/bytes.js
		/** UTF-8 decoding for file bytes and encoding only for the iframe's script payload. */
		const BASE64_CHUNK_BYTES = 32768;
		/**
		* Decode complete UTF-8 text, rejecting invalid byte sequences.
		* @param data - complete UTF-8 bytes.
		* @returns decoded text; invalid UTF-8 throws.
		*/
		function decodeText(data) {
			return new TextDecoder("utf-8", { fatal: true }).decode(data);
		}
		/**
		* Encode Unicode text for the iframe's base64 payload.
		* @param text - Unicode text.
		* @returns base64 of its UTF-8 bytes.
		*/
		function encodeText(text) {
			const bytes = new TextEncoder().encode(text);
			const chunks = [];
			for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES)));
			return btoa(chunks.join(""));
		}
		//#endregion
		//#region lib/types/client/html/bootstrap.js
		/** A fixed bootstrap runs inside the opaque iframe; no Host callbacks enter its document. */
		/**
		* Build the outer iframe document. Its resource URLs are created inside the sandbox,
		* because that opaque origin cannot load resource URLs created by the parent.
		* @param bundle - complete HTML bytes and optional static dependencies.
		* @returns bootstrap HTML; invalid UTF-8 throws before navigation.
		*/
		function createHtmlDocument(bundle) {
			return `<!doctype html><meta charset="utf-8"><script>(()=>{
const bytes=data=>Uint8Array.from(atob(data),character=>character.charCodeAt(0));
const text=data=>new TextDecoder('utf-8',{fatal:true}).decode(bytes(data));
const bundle=JSON.parse(text("${encodeText(JSON.stringify({
				html: decodeText(bundle.data),
				assets: bundle.assets.map((asset) => ({
					kind: asset.kind,
					reference: asset.reference,
					text: decodeText(asset.data)
				}))
			}))}"));
let html=bundle.html;
if(bundle.assets.length){
  const parsed=new DOMParser().parseFromString(html,'text/html');
  for(const asset of bundle.assets){
    const script=asset.kind==='script';
    const url=URL.createObjectURL(new Blob([asset.text],{type:script?'application/javascript':'text/css'}));
    const attribute=script?'src':'href';
    for(const element of parsed.querySelectorAll(script?'script[src]':'link[rel~="stylesheet" i][href]')){
      if(element.getAttribute(attribute)===asset.reference)element.setAttribute(attribute,url);
    }
  }
  html='<!doctype html>'+parsed.documentElement.outerHTML;
}
document.open();document.write(html);document.close();
})()<\/script>`;
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/dompurify@3.4.16/node_modules/dompurify/dist/purify.es.mjs
		/*! @license DOMPurify 3.4.16 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.16/LICENSE */
		function _OverloadYield(e, d) {
			this.v = e, this.k = d;
		}
		function _arrayLikeToArray(r, a) {
			(null == a || a > r.length) && (a = r.length);
			for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
			return n;
		}
		function _arrayWithHoles(r) {
			if (Array.isArray(r)) return r;
		}
		function _iterableToArrayLimit(r, l) {
			var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
			if (null != t) {
				var e, n, i, u, a = [], f = !0, o = !1;
				try {
					if (i = (t = t.call(r)).next, 0 === l) {
						if (Object(t) !== t) return;
						f = !1;
					} else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
				} catch (r) {
					o = !0, n = r;
				} finally {
					try {
						if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
					} finally {
						if (o) throw n;
					}
				}
				return a;
			}
		}
		function _nonIterableRest() {
			throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
		}
		/*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */
		function _slicedToArray(r, e) {
			return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
		}
		function _unsupportedIterableToArray(r, a) {
			if (r) {
				if ("string" == typeof r) return _arrayLikeToArray(r, a);
				var t = {}.toString.call(r).slice(8, -1);
				return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
			}
		}
		function AsyncGenerator(e) {
			var t, n;
			function resume(t, n) {
				try {
					var r = e[t](n), o = r.value, u = o instanceof _OverloadYield;
					Promise.resolve(u ? o.v : o).then(function(n) {
						if (u) {
							var i = "return" === t && o.k ? t : "next";
							if (!o.k || n.done) return resume(i, n);
							n = e[i](n).value;
						}
						settle(!!r.done, n);
					}, function(e) {
						resume("throw", e);
					});
				} catch (e) {
					settle(2, e);
				}
			}
			function settle(e, r) {
				2 === e ? t.reject(r) : t.resolve({
					value: r,
					done: e
				}), (t = t.next) ? resume(t.key, t.arg) : n = null;
			}
			this._invoke = function(e, r) {
				return new Promise(function(o, u) {
					var i = {
						key: e,
						arg: r,
						resolve: o,
						reject: u,
						next: null
					};
					n ? n = n.next = i : (t = n = i, resume(e, r));
				});
			}, "function" != typeof e.return && (this.return = void 0);
		}
		AsyncGenerator.prototype["function" == typeof Symbol && Symbol.asyncIterator || "@@asyncIterator"] = function() {
			return this;
		}, AsyncGenerator.prototype.next = function(e) {
			return this._invoke("next", e);
		}, AsyncGenerator.prototype.throw = function(e) {
			return this._invoke("throw", e);
		}, AsyncGenerator.prototype.return = function(e) {
			return this._invoke("return", e);
		};
		const entries = Object.entries;
		const setPrototypeOf = Object.setPrototypeOf;
		const isFrozen = Object.isFrozen;
		const getPrototypeOf = Object.getPrototypeOf;
		const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
		let freeze = Object.freeze;
		let seal = Object.seal;
		let create = Object.create;
		let _ref = typeof Reflect !== "undefined" && Reflect;
		let apply$7 = _ref.apply;
		let construct = _ref.construct;
		if (!freeze) freeze = function freeze(x) {
			return x;
		};
		if (!seal) seal = function seal(x) {
			return x;
		};
		if (!apply$7) apply$7 = function apply(func, thisArg) {
			for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
			return func.apply(thisArg, args);
		};
		if (!construct) construct = function construct(Func) {
			for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
			return new Func(...args);
		};
		const arrayForEach = unapply(Array.prototype.forEach);
		Array.prototype.indexOf;
		const arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
		const arrayPop = unapply(Array.prototype.pop);
		const arrayPush = unapply(Array.prototype.push);
		Array.prototype.slice;
		const arraySplice = unapply(Array.prototype.splice);
		const arrayIsArray = Array.isArray;
		const stringToLowerCase = unapply(String.prototype.toLowerCase);
		const stringToString = unapply(String.prototype.toString);
		const stringMatch = unapply(String.prototype.match);
		const stringReplace = unapply(String.prototype.replace);
		const stringIndexOf = unapply(String.prototype.indexOf);
		const stringTrim = unapply(String.prototype.trim);
		const numberToString = unapply(Number.prototype.toString);
		const booleanToString = unapply(Boolean.prototype.toString);
		const bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
		const symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
		const objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
		const objectToString = unapply(Object.prototype.toString);
		const regExpTest = unapply(RegExp.prototype.test);
		const typeErrorCreate = unconstruct(TypeError);
		/**
		* Creates a new function that calls the given function with a specified thisArg and arguments.
		*
		* @param func - The function to be wrapped and called.
		* @returns A new function that calls the given function with a specified thisArg and arguments.
		*/
		function unapply(func) {
			return function(thisArg) {
				if (thisArg instanceof RegExp) thisArg.lastIndex = 0;
				for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) args[_key3 - 1] = arguments[_key3];
				return apply$7(func, thisArg, args);
			};
		}
		/**
		* Creates a new function that constructs an instance of the given constructor function with the provided arguments.
		*
		* @param func - The constructor function to be wrapped and called.
		* @returns A new function that constructs an instance of the given constructor function with the provided arguments.
		*/
		function unconstruct(Func) {
			return function() {
				for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) args[_key4] = arguments[_key4];
				return construct(Func, args);
			};
		}
		/**
		* Add properties to a lookup table
		*
		* @param set - The set to which elements will be added.
		* @param array - The array containing elements to be added to the set.
		* @param transformCaseFunc - An optional function to transform the case of each element before adding to the set.
		* @returns The modified set with added elements.
		*/
		function addToSet(set, array) {
			let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
			if (setPrototypeOf) setPrototypeOf(set, null);
			if (!arrayIsArray(array)) return set;
			let l = array.length;
			while (l--) {
				let element = array[l];
				if (typeof element === "string") {
					const lcElement = transformCaseFunc(element);
					if (lcElement !== element) {
						if (!isFrozen(array)) array[l] = lcElement;
						element = lcElement;
					}
				}
				set[element] = true;
			}
			return set;
		}
		/**
		* Clean up an array to harden against CSPP
		*
		* @param array - The array to be cleaned.
		* @returns The cleaned version of the array
		*/
		function cleanArray(array) {
			for (let index = 0; index < array.length; index++) if (!objectHasOwnProperty(array, index)) array[index] = null;
			return array;
		}
		/**
		* Shallow clone an object
		*
		* @param object - The object to be cloned.
		* @returns A new object that copies the original.
		*/
		function clone$1(object) {
			const newObject = create(null);
			for (const _ref2 of entries(object)) {
				var _ref3 = _slicedToArray(_ref2, 2);
				const property = _ref3[0];
				const value = _ref3[1];
				if (objectHasOwnProperty(object, property)) if (arrayIsArray(value)) newObject[property] = cleanArray(value);
				else if (value && typeof value === "object" && value.constructor === Object) newObject[property] = clone$1(value);
				else newObject[property] = value;
			}
			return newObject;
		}
		/**
		* Convert non-node values into strings without depending on direct property access.
		*
		* @param value - The value to stringify.
		* @returns A string representation of the provided value.
		*/
		function stringifyValue(value) {
			switch (typeof value) {
				case "string": return value;
				case "number": return numberToString(value);
				case "boolean": return booleanToString(value);
				case "bigint": return bigintToString ? bigintToString(value) : "0";
				case "symbol": return symbolToString ? symbolToString(value) : "Symbol()";
				case "undefined": return objectToString(value);
				case "function":
				case "object": {
					if (value === null) return objectToString(value);
					const valueAsRecord = value;
					const valueToString = lookupGetter(valueAsRecord, "toString");
					if (typeof valueToString === "function") {
						const stringified = valueToString(valueAsRecord);
export {};
