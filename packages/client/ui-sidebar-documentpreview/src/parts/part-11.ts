/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				_executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
				while (shadowNode = shadowIterator.nextNode()) {
					_executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
					_sanitizeElements(shadowNode, fragment);
					_sanitizeAttributes(shadowNode, fragment);
					if (_isDocumentFragment(shadowNode.content)) _sanitizeShadowDOM2(shadowNode.content);
					if (_readNodeType(shadowNode) === NODE_TYPE.element) {
						const innerSr = getShadowRoot(shadowNode);
						if (_isDocumentFragment(innerSr)) {
							_sanitizeAttachedShadowRoots(innerSr);
							_sanitizeShadowDOM2(innerSr);
						}
					}
				}
				_executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
			};
			/**
			* _sanitizeAttachedShadowRoots
			*
			* Walks `root` and feeds every attached shadow root we encounter into
			* the existing _sanitizeShadowDOM pipeline. The default node iterator
			* does not descend into shadow trees, so nodes inside an attached
			* shadow root would otherwise be skipped entirely.
			*
			* Two real input paths put attached shadow roots in front of us:
			*   1. IN_PLACE on a DOM node that already has shadow roots attached.
			*   2. DOM-node input where importNode(dirty, true) deep-clones the
			*      shadow root because it was created with `clonable: true`.
			*
			* This pass runs once, up front, so the main iteration loop (and the
			* existing _sanitizeShadowDOM template-content recursion) stay
			* untouched — string-input paths are not affected.
			*
			* @param root the subtree root to walk for attached shadow roots
			*/
			const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots(root) {
				const stack = [{
					node: root,
					shadow: null
				}];
				while (stack.length > 0) {
					const item = stack.pop();
					if (item.shadow) {
						_sanitizeShadowDOM2(item.shadow);
						continue;
					}
					const node = item.node;
					const isElement = _readNodeType(node) === NODE_TYPE.element;
					const childNodes = getChildNodes(node);
					if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push({
						node: childNodes[i],
						shadow: null
					});
					if (isElement) {
						const rootName = getNodeName ? getNodeName(node) : null;
						if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
							const content = node.content;
							if (_isDocumentFragment(content)) stack.push({
								node: content,
								shadow: null
							});
						}
					}
					if (isElement) {
						const sr = getShadowRoot(node);
						if (_isDocumentFragment(sr)) stack.push({
							node: null,
							shadow: sr
						}, {
							node: sr,
							shadow: null
						});
					}
				}
			};
			DOMPurify.sanitize = function(dirty) {
				let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
				let body = null;
				let importedNode = null;
				let currentNode = null;
				let returnNode = null;
				IS_EMPTY_INPUT = !dirty;
				if (IS_EMPTY_INPUT) dirty = "<!-->";
				if (typeof dirty !== "string" && !_isNode(dirty)) {
					dirty = stringifyValue(dirty);
					if (typeof dirty !== "string") throw typeErrorCreate("dirty is not a string, aborting");
				}
				if (!DOMPurify.isSupported) return dirty;
				if (SET_CONFIG) {
					ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
					ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
				} else _parseConfig(cfg);
				if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) ALLOWED_TAGS = clone$1(ALLOWED_TAGS);
				if (hooks.uponSanitizeAttribute.length > 0) ALLOWED_ATTR = clone$1(ALLOWED_ATTR);
				DOMPurify.removed = [];
				const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
				if (inPlace) {
					_neutralizePatchLinkage(dirty);
					const nn = _readNodeName(dirty);
					if (typeof nn === "string") {
						const tagName = transformCaseFunc(nn);
						if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
							_neutralizeRoot(dirty);
							throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
						}
					}
					if (_isClobbered(dirty)) {
						_neutralizeRoot(dirty);
						throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
					}
					try {
						_sanitizeAttachedShadowRoots(dirty);
					} catch (error) {
						_neutralizeRoot(dirty);
						throw error;
					}
				} else if (_isNode(dirty)) {
					body = _initDocument("<!---->");
					importedNode = body.ownerDocument.importNode(dirty, true);
					if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") body = importedNode;
					else if (importedNode.nodeName === "HTML") body = importedNode;
					else body.appendChild(importedNode);
					_sanitizeAttachedShadowRoots(body);
				} else {
					if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
					body = _initDocument(dirty);
					if (!body) return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
				}
				if (body && FORCE_BODY) _forceRemove(body.firstChild);
				const walkRoot = inPlace ? dirty : body;
				try {
					const nodeIterator = _createNodeIterator(walkRoot);
					while (currentNode = nodeIterator.nextNode()) {
						_sanitizeElements(currentNode, walkRoot);
						_sanitizeAttributes(currentNode, walkRoot);
						if (_isDocumentFragment(currentNode.content)) _sanitizeShadowDOM2(currentNode.content);
					}
				} catch (error) {
					if (inPlace) {
						_neutralizeRoot(dirty);
						arrayForEach(DOMPurify.removed, (entry) => {
							if (entry.element) _neutralizeSubtree(entry.element);
						});
					}
					throw error;
				}
				if (inPlace) {
					let rootWasRemoved = false;
					arrayForEach(DOMPurify.removed, (entry) => {
						if (entry.element) {
							if (entry.element === dirty) rootWasRemoved = true;
							_neutralizeSubtree(entry.element);
						}
					});
					if (rootWasRemoved) throw typeErrorCreate("a node selected for removal could not be safely returned; refusing to sanitize in place");
					if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(dirty);
					return dirty;
				}
				if (RETURN_DOM) {
					if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(body);
					if (RETURN_DOM_FRAGMENT) {
						returnNode = createDocumentFragment.call(body.ownerDocument);
						while (body.firstChild) returnNode.appendChild(body.firstChild);
					} else returnNode = body;
					if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) returnNode = importNode.call(originalDocument, returnNode, true);
					return returnNode;
				}
				let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
				if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
				if (SAFE_FOR_TEMPLATES) serializedHTML = _stripTemplateExpressions(serializedHTML);
				return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
			};
			DOMPurify.setConfig = function() {
				_parseConfig(arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {});
				SET_CONFIG = true;
				SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
				SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
			};
			DOMPurify.clearConfig = function() {
				CONFIG = null;
				SET_CONFIG = false;
				SET_CONFIG_ALLOWED_TAGS = null;
				SET_CONFIG_ALLOWED_ATTR = null;
				trustedTypesPolicy = defaultTrustedTypesPolicy;
				emptyHTML = "";
			};
			DOMPurify.isValidAttribute = function(tag, attr, value) {
				if (!CONFIG) _parseConfig({});
				return _isValidAttribute(transformCaseFunc(tag), transformCaseFunc(attr), value);
			};
			DOMPurify.addHook = function(entryPoint, hookFunction) {
				if (typeof hookFunction !== "function") return;
				if (!objectHasOwnProperty(hooks, entryPoint)) return;
				arrayPush(hooks[entryPoint], hookFunction);
			};
			DOMPurify.removeHook = function(entryPoint, hookFunction) {
				if (!objectHasOwnProperty(hooks, entryPoint)) return;
				if (hookFunction !== void 0) {
					const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
					return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
				}
				return arrayPop(hooks[entryPoint]);
			};
			DOMPurify.removeHooks = function(entryPoint) {
				if (!objectHasOwnProperty(hooks, entryPoint)) return;
				hooks[entryPoint] = [];
			};
			DOMPurify.removeAllHooks = function() {
				hooks = _createHooksMap();
			};
			return DOMPurify;
		}
		var purify_default = createDOMPurify();
		//#endregion
		//#region lib/types/client/html/basic-document.js
		/** Static HTML preview with no scripts, network resources, forms or nested frames. */
		/**
		* Prepare static content before the browser can load any document resources.
		* @param data - complete UTF-8 HTML bytes.
		* @returns document with the restrictive CSP first in its head.
		*/
		function createBasicHtmlDocument(data) {
			const clean = purify_default.sanitize(decodeText(data), {
				WHOLE_DOCUMENT: true,
				FORBID_TAGS: [
					"noscript",
					"base",
					"link",
					"meta",
					"iframe",
					"frame",
					"object",
					"embed",
					"set",
					"animate",
					"animateMotion",
					"animateTransform"
				],
				FORBID_ATTR: ["href", "xlink:href"]
			});
			const parsed = new DOMParser().parseFromString(clean, "text/html");
			const policy = parsed.createElement("meta");
			policy.setAttribute("http-equiv", "Content-Security-Policy");
			policy.setAttribute("content", "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'");
			parsed.head.prepend(policy);
			return `<!doctype html>${parsed.documentElement.outerHTML}`;
		}
		//#endregion
		//#region lib/types/client/html/pack.js
		const MAX_ASSET_BYTES = 4 * 1024 * 1024;
		const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
		const MAX_ASSETS = 64;
		/** Whether this reference can be read relative to the original document, never the parent application URL. */
		function relative(reference) {
			return reference.length > 0 && !/^(?:[a-z][a-z\d+.-]*:|[/\\#?])/iu.test(reference) && !reference.includes("\0");
		}
		/**
		* Collect static dependencies without executing or mounting document elements in the parent page.
		* A base element leaves URL resolution to the browser. Only direct .js classic scripts and .css
		* links are packed; local CSS url/import, modules and dynamically constructed URLs are unsupported.
		* @param data - complete UTF-8 HTML bytes.
		* @param readRelative - original-document-scoped read, never exposed to the iframe.
		* @param signal - stops reads and prevents publication after cancellation.
		* @returns complete HTML and its finite static asset set; decoding, limits and read failures reject.
		*/
		async function packHtml(data, readRelative, signal) {
			signal.throwIfAborted();
			let total = data.byteLength;
			if (total > MAX_TOTAL_BYTES) throw new Error("HTML package exceeds its total byte limit");
			const template = document.createElement("template");
			template.innerHTML = decodeText(data);
			const assets = [];
			if (template.content.querySelector("base[href]") !== null) return {
				data,
				assets
			};
			const seen = /* @__PURE__ */ new Set();
			for (const element of template.content.querySelectorAll("script[src],link[href]")) {
				const script = element.localName === "script";
				const type = element.getAttribute("type")?.trim().toLowerCase() ?? "";
				if (script && ![
					"",
					"text/javascript",
					"application/javascript"
				].includes(type)) continue;
				if (!script && !(element.getAttribute("rel") ?? "").toLowerCase().split(/\s+/u).includes("stylesheet")) continue;
				const reference = element.getAttribute(script ? "src" : "href");
				const suffix = reference.search(/[?#]/u);
				const path = suffix === -1 ? reference : reference.slice(0, suffix);
				if (!relative(reference) || !(script ? /\.js$/iu : /\.css$/iu).test(path)) continue;
				const kind = script ? "script" : "stylesheet";
				const key = `${kind}:${reference}`;
				if (seen.has(key)) continue;
				if (assets.length >= MAX_ASSETS) throw new Error("HTML package exceeds its asset count limit");
				signal.throwIfAborted();
				const asset = await readRelative(reference, signal);
				signal.throwIfAborted();
				const size = asset.data.byteLength;
				if (size > MAX_ASSET_BYTES) throw new Error("HTML asset exceeds its byte limit");
				total += size;
				if (total > MAX_TOTAL_BYTES) throw new Error("HTML package exceeds its total byte limit");
				decodeText(asset.data);
				assets.push({
					kind,
					reference,
					data: asset.data
				});
				seen.add(key);
			}
			return {
				data,
				assets
			};
		}
		//#endregion
		//#region lib/types/client/html/read-relative.js
		/**
		* Bind a package reader to the original HTML file's address.
		* @param readRelated - workspace reader using the Session in the root HTML address.
		* @param address - root HTML file address.
		* @param lifetime - tab lifetime.
		* @param addResource - subscribes to the dependency path reported by the Host.
		* @returns a reader that strips URL query/fragment, decodes one path, and preserves Host failures.
		*/
		function createReadHtmlRelative(readRelated, address, lifetime, addResource) {
			return async (reference, signal) => {
				const suffix = reference.search(/[?#]/u);
				const path = decodeURIComponent(suffix === -1 ? reference : reference.slice(0, suffix));
				if (path.length === 0 || /^(?:[a-z][a-z\d+.-]*:|[/\\])/iu.test(path) || path.includes("\0") || path.includes("\\")) throw new Error("HTML dependency must use a relative file path");
				const combined = AbortSignal.any([lifetime, signal]);
				combined.throwIfAborted();
				const file = hostFileOf(address);
				const result = await readRelated(address, path, combined);
				combined.throwIfAborted();
				if (!result.ok) {
					if ("path" in result.error.details && typeof result.error.details.path === "string") addResource(sessionFileAddress(file.sessionId, result.error.details.path));
					throw new Error(result.error.message);
				}
				addResource(sessionFileAddress(file.sessionId, result.value.absolutePath));
				return result.value;
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/html/HtmlBody.module.css.mjs
		const css$6 = ".HyIruq_frame{background:var(--dsw-alias-bg-base);border:none;width:100%;height:100%;min-height:240px;display:block}.HyIruq_status{color:var(--dsw-alias-label-secondary);white-space:normal;margin:0;padding:10px}";
		const tagId$6 = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/HtmlBody.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var HtmlBody_module_css_default = {
			"frame": "HyIruq_frame",
			"status": "HyIruq_status"
		};
		//#endregion
		//#region lib/types/client/html/HtmlBody.js
		/** Static or interactive HTML in an opaque iframe, without parent application access. */
		/** One mounted file owns its root Blob; replacing content also replaces the browsing context. */
		function HtmlFrame({ data, resourceAddress, readRelated, addResource, setResources, signal, frameName, t }) {
			const [frame, setFrame] = (0, react.useState)();
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				const resources = /* @__PURE__ */ new Set();
				const readRelative = createReadHtmlRelative(readRelated, resourceAddress, signal, (address) => {
					resources.add(address);
					addResource(address);
				});
				let url;
				(async () => {
					try {
						const bundle = await packHtml(data, readRelative, controller.signal);
						controller.signal.throwIfAborted();
						const html = createHtmlDocument(bundle);
						url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
						setFrame({
							data,
							readRelated,
							url
						});
					} catch {
						if (!controller.signal.aborted) setFrame({
							data,
							readRelated,
							url: void 0
						});
					} finally {
						if (!controller.signal.aborted && !signal.aborted) setResources([...resources]);
					}
				})();
				return () => {
					controller.abort();
					if (url !== void 0) URL.revokeObjectURL(url);
				};
			}, [
				data,
				readRelated,
				resourceAddress,
export {};
