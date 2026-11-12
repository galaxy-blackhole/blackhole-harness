/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		const _resolveObjectOption = function _resolveObjectOption(cfg, key, makeFallback) {
			const value = objectHasOwnProperty(cfg, key) ? cfg[key] : void 0;
			return value && typeof value === "object" ? clone$1(value) : makeFallback();
		};
		function createDOMPurify() {
			let window = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
			const DOMPurify = (root) => createDOMPurify(root);
			DOMPurify.version = "3.4.16";
			DOMPurify.removed = [];
			if (!window || !window.document || window.document.nodeType !== NODE_TYPE.document || !window.Element) {
				DOMPurify.isSupported = false;
				return DOMPurify;
			}
			let document = window.document;
			const originalDocument = document;
			const currentScript = originalDocument.currentScript;
			window.DocumentFragment;
			const HTMLTemplateElement = window.HTMLTemplateElement, Node = window.Node, Element = window.Element, NodeFilter = window.NodeFilter;
			window.NamedNodeMap === void 0 && (window.NamedNodeMap || window.MozNamedAttrMap);
			window.HTMLFormElement;
			const DOMParser = window.DOMParser, trustedTypes = window.trustedTypes;
			const ElementPrototype = Element.prototype;
			const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
			const remove = lookupGetter(ElementPrototype, "remove");
			const removeAttributeNode = lookupGetter(ElementPrototype, "removeAttributeNode");
			const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
			const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
			const getParentNode = lookupGetter(ElementPrototype, "parentNode");
			const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
			const getAttributes = lookupGetter(ElementPrototype, "attributes");
			const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
			const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
			const getOwnerDocument = Node && Node.prototype ? lookupGetter(Node.prototype, "ownerDocument") : null;
			const _readNodeType = function _readNodeType(node) {
				return getNodeType ? getNodeType(node) : node.nodeType;
			};
			const _readNodeName = function _readNodeName(node) {
				return getNodeName ? getNodeName(node) : node.nodeName;
			};
			if (typeof HTMLTemplateElement === "function") {
				const template = document.createElement("template");
				if (template.content && template.content.ownerDocument) document = template.content.ownerDocument;
			}
			let trustedTypesPolicy;
			let emptyHTML = "";
			let defaultTrustedTypesPolicy;
			let defaultTrustedTypesPolicyResolved = false;
			let IN_TRUSTED_TYPES_POLICY = 0;
			const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy() {
				if (IN_TRUSTED_TYPES_POLICY > 0) throw typeErrorCreate("A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the \"DOMPurify and Trusted Types\" section of the README.");
			};
			const _createTrustedHTML = function _createTrustedHTML(html) {
				_assertNotInTrustedTypesPolicy();
				IN_TRUSTED_TYPES_POLICY++;
				try {
					return trustedTypesPolicy.createHTML(html);
				} finally {
					IN_TRUSTED_TYPES_POLICY--;
				}
			};
			const _createTrustedScriptURL = function _createTrustedScriptURL(scriptUrl) {
				_assertNotInTrustedTypesPolicy();
				IN_TRUSTED_TYPES_POLICY++;
				try {
					return trustedTypesPolicy.createScriptURL(scriptUrl);
				} finally {
					IN_TRUSTED_TYPES_POLICY--;
				}
			};
			const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy() {
				if (!defaultTrustedTypesPolicyResolved) {
					defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
					defaultTrustedTypesPolicyResolved = true;
				}
				return defaultTrustedTypesPolicy;
			};
			const _document = document, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
			const importNode = originalDocument.importNode;
			let hooks = _createHooksMap();
			/**
			* Expose whether this browser supports running the full DOMPurify.
			*/
			DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
			const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
			let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
			/**
			* We consider the elements and attributes below to be safe. Ideally
			* don't add any new ones but feel free to remove unwanted ones.
			*/
			let ALLOWED_TAGS = null;
			const DEFAULT_ALLOWED_TAGS = addToSet({}, [
				...html$1,
				...svg$1,
				...svgFilters,
				...mathMl$1,
				...text
			]);
			let ALLOWED_ATTR = null;
			const DEFAULT_ALLOWED_ATTR = addToSet({}, [
				...html,
				...svg,
				...mathMl,
				...xml
			]);
			let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
				tagNameCheck: {
					writable: true,
					configurable: false,
					enumerable: true,
					value: null
				},
				attributeNameCheck: {
					writable: true,
					configurable: false,
					enumerable: true,
					value: null
				},
				allowCustomizedBuiltInElements: {
					writable: true,
					configurable: false,
					enumerable: true,
					value: false
				}
			}));
			let FORBID_TAGS = null;
			let FORBID_ATTR = null;
			const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
				tagCheck: {
					writable: true,
					configurable: false,
					enumerable: true,
					value: null
				},
				attributeCheck: {
					writable: true,
					configurable: false,
					enumerable: true,
					value: null
				}
			}));
			let ALLOW_ARIA_ATTR = true;
			let ALLOW_DATA_ATTR = true;
			let ALLOW_UNKNOWN_PROTOCOLS = false;
			let ALLOW_SELF_CLOSE_IN_ATTR = true;
			let SAFE_FOR_TEMPLATES = false;
			let SAFE_FOR_XML = true;
			let WHOLE_DOCUMENT = false;
			let SET_CONFIG = false;
			let SET_CONFIG_ALLOWED_TAGS = null;
			let SET_CONFIG_ALLOWED_ATTR = null;
			let FORCE_BODY = false;
			let RETURN_DOM = false;
			let RETURN_DOM_FRAGMENT = false;
			let RETURN_TRUSTED_TYPE = false;
			let SANITIZE_DOM = true;
			let SANITIZE_NAMED_PROPS = false;
			const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
			let KEEP_CONTENT = true;
			let IN_PLACE = false;
			let USE_PROFILES = {};
			let FORBID_CONTENTS = null;
			const DEFAULT_FORBID_CONTENTS = addToSet({}, [
				"annotation-xml",
				"audio",
				"colgroup",
				"desc",
				"foreignobject",
				"head",
				"iframe",
				"math",
				"mi",
				"mn",
				"mo",
				"ms",
				"mtext",
				"noembed",
				"noframes",
				"noscript",
				"plaintext",
				"script",
				"selectedcontent",
				"style",
				"svg",
				"template",
				"thead",
				"title",
				"video",
				"xmp"
			]);
			let DATA_URI_TAGS = null;
			const DEFAULT_DATA_URI_TAGS = addToSet({}, [
				"audio",
				"video",
				"img",
				"source",
				"image",
				"track"
			]);
			let URI_SAFE_ATTRIBUTES = null;
			const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, [
				"alt",
				"class",
				"for",
				"id",
				"label",
				"name",
				"pattern",
				"placeholder",
				"role",
				"summary",
				"title",
				"value",
				"style",
				"xmlns"
			]);
			const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
			const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
			const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
			let NAMESPACE = HTML_NAMESPACE;
			let IS_EMPTY_INPUT = false;
			let ALLOWED_NAMESPACES = null;
			const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [
				MATHML_NAMESPACE,
				SVG_NAMESPACE,
				HTML_NAMESPACE
			], stringToString);
			const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze([
				"mi",
				"mo",
				"mn",
				"ms",
				"mtext"
			]);
			let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
			const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
			let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
			const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, [
				"title",
				"style",
				"font",
				"a",
				"script"
			]);
			let PARSER_MEDIA_TYPE = null;
			const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
			const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
			let transformCaseFunc = null;
			let CONFIG = null;
			const formElement = document.createElement("form");
			const isRegexOrFunction = function isRegexOrFunction(testValue) {
				return testValue instanceof RegExp || testValue instanceof Function;
			};
			/**
			* _parseConfig
			*
			* @param cfg optional config literal
			*/
			const _parseConfig = function _parseConfig() {
				let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
				if (CONFIG && CONFIG === cfg) return;
				if (!cfg || typeof cfg !== "object") cfg = {};
				cfg = clone$1(cfg);
				PARSER_MEDIA_TYPE = SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
				transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
				ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, { transform: transformCaseFunc });
				ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, { transform: transformCaseFunc });
				ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, { transform: stringToString });
				URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
					transform: transformCaseFunc,
					base: DEFAULT_URI_SAFE_ATTRIBUTES
				});
				DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
					transform: transformCaseFunc,
					base: DEFAULT_DATA_URI_TAGS
				});
				FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, { transform: transformCaseFunc });
				FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone$1({}), { transform: transformCaseFunc });
				FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone$1({}), { transform: transformCaseFunc });
				USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone$1(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
				ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
				ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
				ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
				ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
				SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
				SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
				WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
				RETURN_DOM = cfg.RETURN_DOM || false;
				RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
				RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
				FORCE_BODY = cfg.FORCE_BODY || false;
				SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
				SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
				KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
				IN_PLACE = cfg.IN_PLACE || false;
				IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
				NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
				MATHML_TEXT_INTEGRATION_POINTS = _resolveObjectOption(cfg, "MATHML_TEXT_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS));
				HTML_INTEGRATION_POINTS = _resolveObjectOption(cfg, "HTML_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS));
				const customElementHandling = _resolveObjectOption(cfg, "CUSTOM_ELEMENT_HANDLING", () => create(null));
				CUSTOM_ELEMENT_HANDLING = create(null);
				if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
				if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
				if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
				seal(CUSTOM_ELEMENT_HANDLING);
				if (SAFE_FOR_TEMPLATES) ALLOW_DATA_ATTR = false;
				if (RETURN_DOM_FRAGMENT) RETURN_DOM = true;
				if (USE_PROFILES) {
					ALLOWED_TAGS = addToSet({}, text);
					ALLOWED_ATTR = create(null);
					if (USE_PROFILES.html === true) {
						addToSet(ALLOWED_TAGS, html$1);
						addToSet(ALLOWED_ATTR, html);
					}
					if (USE_PROFILES.svg === true) {
						addToSet(ALLOWED_TAGS, svg$1);
						addToSet(ALLOWED_ATTR, svg);
						addToSet(ALLOWED_ATTR, xml);
					}
					if (USE_PROFILES.svgFilters === true) {
						addToSet(ALLOWED_TAGS, svgFilters);
						addToSet(ALLOWED_ATTR, svg);
						addToSet(ALLOWED_ATTR, xml);
					}
					if (USE_PROFILES.mathMl === true) {
						addToSet(ALLOWED_TAGS, mathMl$1);
						addToSet(ALLOWED_ATTR, mathMl);
						addToSet(ALLOWED_ATTR, xml);
					}
				}
				EXTRA_ELEMENT_HANDLING.tagCheck = null;
				EXTRA_ELEMENT_HANDLING.attributeCheck = null;
				if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
					if (typeof cfg.ADD_TAGS === "function") EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
					else if (arrayIsArray(cfg.ADD_TAGS)) {
						if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) ALLOWED_TAGS = clone$1(ALLOWED_TAGS);
						addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
					}
				}
				if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
					if (typeof cfg.ADD_ATTR === "function") EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
					else if (arrayIsArray(cfg.ADD_ATTR)) {
						if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) ALLOWED_ATTR = clone$1(ALLOWED_ATTR);
						addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
					}
				}
				if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
					if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) FORBID_CONTENTS = clone$1(FORBID_CONTENTS);
					addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
				}
				if (KEEP_CONTENT) ALLOWED_TAGS["#text"] = true;
				if (WHOLE_DOCUMENT) addToSet(ALLOWED_TAGS, [
					"html",
					"head",
					"body"
				]);
				if (ALLOWED_TAGS.table) {
					addToSet(ALLOWED_TAGS, ["tbody"]);
					delete FORBID_TAGS.tbody;
				}
				if (cfg.TRUSTED_TYPES_POLICY) {
					if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") throw typeErrorCreate("TRUSTED_TYPES_POLICY configuration option must provide a \"createHTML\" hook.");
					if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") throw typeErrorCreate("TRUSTED_TYPES_POLICY configuration option must provide a \"createScriptURL\" hook.");
					const previousTrustedTypesPolicy = trustedTypesPolicy;
					trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
					try {
						emptyHTML = _createTrustedHTML("");
					} catch (error) {
						trustedTypesPolicy = previousTrustedTypesPolicy;
						throw error;
					}
				} else if (cfg.TRUSTED_TYPES_POLICY === null) {
					trustedTypesPolicy = void 0;
					emptyHTML = "";
				} else {
					if (trustedTypesPolicy === void 0) trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
					if (trustedTypesPolicy && typeof emptyHTML === "string") emptyHTML = _createTrustedHTML("");
				}
				if (freeze) freeze(cfg);
				CONFIG = cfg;
			};
			const ALL_SVG_TAGS = addToSet({}, [
				...svg$1,
				...svgFilters,
				...svgDisallowed
			]);
			const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
			/**
			* Namespace rules for an element in the SVG namespace.
			*
			* @param tagName the element's lowercase tag name
			* @param parent the (possibly simulated) parent node
			* @param parentTagName the parent's lowercase tag name
			* @returns true if a spec-compliant parser could produce this element
			*/
			const _checkSvgNamespace = function _checkSvgNamespace(tagName, parent, parentTagName) {
				if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "svg";
				if (parent.namespaceURI === MATHML_NAMESPACE) return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
				return Boolean(ALL_SVG_TAGS[tagName]);
			};
			/**
export {};
