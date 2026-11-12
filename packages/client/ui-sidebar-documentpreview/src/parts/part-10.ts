/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			*
			* The realm-independent replacement reads `nodeType` through the cached
			* Node.prototype getter and compares to the DOCUMENT_FRAGMENT_NODE
			* constant (11). nodeType is a numeric value resolved from the node's
			* internal slot, identical across realms for the same kind of node.
			*
			* @param value object to check
			* @return true if value is a DocumentFragment-shaped node from any realm
			*/
			const _isDocumentFragment = function _isDocumentFragment(value) {
				if (!getNodeType || typeof value !== "object" || value === null) return false;
				try {
					return getNodeType(value) === NODE_TYPE.documentFragment;
				} catch (_) {
					return false;
				}
			};
			/**
			* Checks whether the given object is a DOM node, including nodes that
			* originate from a different window/realm (e.g. an iframe's
			* contentDocument). The previous `value instanceof Node` check was
			* realm-bound: nodes from a different window failed it, causing
			* sanitize() to silently stringify them and reset IN_PLACE to false,
			* returning the original node unsanitized. See GHSA-4w3q-35jp-p934.
			*
			* @param value object to check whether it's a DOM node
			* @return true if value is a DOM node from any realm
			*/
			const _isNode = function _isNode(value) {
				if (!getNodeType || typeof value !== "object" || value === null) return false;
				try {
					return typeof getNodeType(value) === "number";
				} catch (_) {
					return false;
				}
			};
			function _executeHooks(hooks, currentNode, data) {
				if (hooks.length === 0) return;
				arrayForEach(hooks, (hook) => {
					hook.call(DOMPurify, currentNode, data, CONFIG);
				});
			}
			/**
			* Structural-threat checks that condemn a node regardless of the
			* allowlists: mXSS via namespace confusion, risky CSS construction,
			* processing instructions, markup-bearing comments. Pure predicate;
			* the caller removes. Check order is load-bearing.
			*
			* @param currentNode the node to inspect
			* @param tagName the node's transformCaseFunc'd tag name
			* @return true if the node must be removed
			*/
			const _isUnsafeNode = function _isUnsafeNode(currentNode, tagName) {
				if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) return true;
				if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && LITERAL_TEXT_ELEMENTS[tagName] && (_isNode(currentNode.firstElementChild) || typeof currentNode.textContent === "string" && regExpTest(LITERAL_TEXT_CLOSE[tagName], currentNode.textContent))) return true;
				if (currentNode.nodeType === NODE_TYPE.processingInstruction) return true;
				if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) return true;
				return false;
			};
			/**
			* Evaluate a CUSTOM_ELEMENT_HANDLING check (a RegExp or a predicate
			* function, per the validation in _parseConfig) against a name.
			* Additional arguments are forwarded to predicate functions - the
			* attributeNameCheck predicate receives the tag name as its second
			* argument. A null/absent check never matches.
			*
			* @param check the configured tagNameCheck / attributeNameCheck value
			* @param name the name to test
			* @param args extra arguments forwarded to a predicate function
			* @return true if the check matches the name
			*/
			const _matchesNameCheck = function _matchesNameCheck(check, name) {
				if (check instanceof RegExp) return regExpTest(check, name);
				if (check instanceof Function) {
					for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
					return Boolean(check(name, ...args));
				}
				return false;
			};
			/**
			* Handle a node whose tag is forbidden or not allowlisted: keep
			* allowed custom elements (false return exits _sanitizeElements
			* early - the namespace and fallback-tag removal checks are
			* intentionally skipped for kept custom elements), else hoist
			* content per KEEP_CONTENT and remove.
			*
			* A kept custom element is the ONLY case in which this function
			* returns false, so the caller uses that return value to run the
			* afterSanitizeElements hook on the kept element and keep the
			* element-hook lifecycle consistent with normal allowlisted
			* elements (GHSA-c2j3-45gr-mqc4).
			*
			* @param currentNode the disallowed node
			* @param tagName the node's transformCaseFunc'd tag name
			* @return true if the node was removed, false if kept
			*/
			const _sanitizeDisallowedNode = function _sanitizeDisallowedNode(currentNode, tagName, root) {
				if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) return false;
				if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
					const parentNode = getParentNode(currentNode);
					const childNodes = getChildNodes(currentNode);
					if (childNodes && parentNode) {
						const childCount = childNodes.length;
						for (let i = childCount - 1; i >= 0; --i) {
							const hoisted = currentNode === root ? cloneNode(childNodes[i], true) : childNodes[i];
							parentNode.insertBefore(hoisted, getNextSibling(currentNode));
						}
					}
				}
				_forceRemove(currentNode);
				return true;
			};
			/**
			* Fork a hook-mutable allowlist off its shared binding the first time a
			* (possibly lazily-installed) uponSanitize* hook is about to see it, so the
			* hook cannot widen the per-instance default or the setConfig binding by
			* reference and leak past the call. Returns the set unchanged once it is
			* already call-local, so repeated calls across elements are idempotent.
			*
			* @param hookList the uponSanitize* hook array for this event
			* @param set the current ALLOWED_TAGS / ALLOWED_ATTR binding
			* @param defaultSet the per-instance DEFAULT_ALLOWED_* constant
			* @param setConfigSet the captured setConfig() binding, or null
			* @return a call-local clone if a hook is present and set is still shared,
			*   else set unchanged
			*/
			const _forkSharedAllowlist = function _forkSharedAllowlist(hookList, set, defaultSet, setConfigSet) {
				if (hookList.length === 0) return set;
				return set === defaultSet || set === setConfigSet ? clone$1(set) : set;
			};
			/**
			* Shared guard for a node that a hook has detached from the walk tree,
			* used after each element-hook site in _sanitizeElements. Detaching is a
			* long-standing user pattern (issue #469; draw.io-style foreignObject
			* filtering). Per the cached, unclobberable parentNode getter the node is
			* genuinely out of the tree, so it can reach neither the serialized
			* output nor an IN_PLACE live tree; treat it as removed and stop
			* processing it. Without this guard, the unsafe-node / namespace checks
			* would call _forceRemove on a parentless node and hit the REPORT-3
			* fail-closed throw — which exists for nodes DOMPurify wants gone but
			* *cannot* detach (clobbered / parentless roots), the opposite of a node
			* that is already safely gone. The walk root is exempt: a detached
			* IN_PLACE root is legitimate input and must still be fully sanitized,
			* and a kill-decision on it must keep hitting the REPORT-3 throw.
			*
			* Nodes detached by hooks stay the hook's responsibility for placement:
			* they are not recorded in DOMPurify.removed, so the post-walk IN_PLACE
			* pass (which iterates DOMPurify.removed) does not reach them. But a
			* hook-detached subtree can still hold a queued resource-event handler -
			* e.g. an <img onload> that began loading when the caller built the live
			* tree - which fires in page scope after sanitize returns even though the
			* handler never reached the returned tree. That is the audit-5 F1 hazard,
			* and the documented node.remove() hook pattern walks straight into it.
			* So on the IN_PLACE path we neutralize the detached subtree inline,
			* stripping its non-allow-listed attributes before returning, exactly as
			* the post-walk pass does for _forceRemove'd subtrees.
			*
			* @param currentNode the node a hook may have detached
			* @param root the current walk root
			* @return true if the node is detached and now handled, false otherwise
			*/
			const _handleHookDetachedNode = function _handleHookDetachedNode(currentNode, root) {
				if (currentNode === root || getParentNode(currentNode) !== null) return false;
				if (IN_PLACE) _neutralizeSubtree(currentNode);
				return true;
			};
			/**
			* _sanitizeElements
			*
			* @protect nodeName
			* @protect textContent
			* @protect removeChild
			* @param currentNode to check for permission to exist
			* @return true if node was killed, false if left alive
			*/
			const _sanitizeElements = function _sanitizeElements(currentNode, root) {
				_executeHooks(hooks.beforeSanitizeElements, currentNode, null);
				if (_handleHookDetachedNode(currentNode, root)) return true;
				if (_isClobbered(currentNode)) {
					_forceRemove(currentNode);
					return true;
				}
				const tagName = transformCaseFunc(_readNodeName(currentNode));
				ALLOWED_TAGS = _forkSharedAllowlist(hooks.uponSanitizeElement, ALLOWED_TAGS, DEFAULT_ALLOWED_TAGS, SET_CONFIG_ALLOWED_TAGS);
				_executeHooks(hooks.uponSanitizeElement, currentNode, {
					tagName,
					allowedTags: ALLOWED_TAGS
				});
				if (_handleHookDetachedNode(currentNode, root)) return true;
				if (_isUnsafeNode(currentNode, tagName)) {
					_forceRemove(currentNode);
					return true;
				}
				if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
					const removed = _sanitizeDisallowedNode(currentNode, tagName, root);
					if (removed === false) {
						_executeHooks(hooks.afterSanitizeElements, currentNode, null);
						if (_handleHookDetachedNode(currentNode, root)) return true;
					}
					return removed;
				}
				if (_readNodeType(currentNode) === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
					_forceRemove(currentNode);
					return true;
				}
				if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
					_forceRemove(currentNode);
					return true;
				}
				if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
					const content = _stripTemplateExpressions(currentNode.textContent);
					if (currentNode.textContent !== content) {
						arrayPush(DOMPurify.removed, { element: currentNode.cloneNode() });
						currentNode.textContent = content;
					}
				}
				_executeHooks(hooks.afterSanitizeElements, currentNode, null);
				return _handleHookDetachedNode(currentNode, root);
			};
			/**
			* _isValidAttribute
			*
			* @param lcTag Lowercase tag name of containing element.
			* @param lcName Lowercase attribute name.
			* @param value Attribute value.
			* @return Returns true if `value` is valid, otherwise false.
			*/
			const _isValidAttribute = function _isValidAttribute(lcTag, lcName, value) {
				if (FORBID_ATTR[lcName]) return false;
				if (_isPatchLinkageAttribute(lcName, lcTag)) return false;
				if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document || value in formElement)) return false;
				const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
				if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) return true;
				if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) return true;
				if (!nameIsPermitted) return _isBasicCustomElement(lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName, lcTag) || lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value);
				if (URI_SAFE_ATTRIBUTES[lcName]) return true;
				if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
				if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) return true;
				if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
				return !value;
			};
			const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, [
				"annotation-xml",
				"color-profile",
				"font-face",
				"font-face-format",
				"font-face-name",
				"font-face-src",
				"font-face-uri",
				"missing-glyph"
			]);
			/**
			* _isBasicCustomElement
			* checks if at least one dash is included in tagName, and it's not the first char
			* for more sophisticated checking see https://github.com/sindresorhus/validate-element-name
			*
			* @param tagName name of the tag of the node to sanitize
			* @returns Returns true if the tag name meets the basic criteria for a custom element, otherwise false.
			*/
			const _isBasicCustomElement = function _isBasicCustomElement(tagName) {
				return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
			};
			/**
			* Wrap an attribute value in the matching Trusted Types object when
			* the active policy requires it. Namespaced attributes pass through
			* unchanged (no TT support yet, see
			* https://bugs.chromium.org/p/chromium/issues/detail?id=1305293).
			*
			* @param lcTag lowercase tag name of the containing element
			* @param lcName lowercase attribute name
			* @param namespaceURI the attribute's namespace, if any
			* @param value the attribute value to wrap
			* @return the value, wrapped when Trusted Types demand it
			*/
			const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value) {
				if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) switch (trustedTypes.getAttributeType(lcTag, lcName)) {
					case "TrustedHTML": return _createTrustedHTML(value);
					case "TrustedScriptURL": return _createTrustedScriptURL(value);
				}
				return value;
			};
			/**
			* Write a modified attribute value back onto the element. On
			* success, re-probe for clobbering introduced by the new value and
			* remove the element when found; otherwise, when this writeback is the
			* recreate half of the SANITIZE_NAMED_PROPS remove-and-recreate, pop the
			* removal entry that path recorded so it does not show as removed. On
			* failure, remove the attribute instead.
			*
			* Returns true only on a clean write (the value was set and the new value
			* introduced no clobbering). The caller uses that, together with its own
			* knowledge of whether this attribute pushed a DOMPurify.removed record, to
			* decide whether to pop that record. The pop must happen ONLY for the
			* named-prop remove-and-recreate; popping on any other value change (trim,
			* template scrubbing, Trusted Types) would consume an unrelated _forceRemove
			* subtree-cleanup record and let that detached subtree keep a live event
			* handler through the IN_PLACE neutralization pass (SO-001).
			*
			* @param currentNode the element carrying the attribute
			* @param name the attribute name as present on the element
			* @param namespaceURI the attribute's namespace, if any
			* @param value the new attribute value
			* @return true if the value was written without introducing clobbering
			*/
			const _setAttributeValue = function _setAttributeValue(currentNode, name, namespaceURI, value) {
				try {
					if (namespaceURI) currentNode.setAttributeNS(namespaceURI, name, value);
					else currentNode.setAttribute(name, value);
					if (_isClobbered(currentNode)) {
						_forceRemove(currentNode);
						return false;
					}
					return true;
				} catch (_) {
					_removeAttribute(name, currentNode);
					return false;
				}
			};
			/**
			* _sanitizeAttributes
			*
			* @protect attributes
			* @protect nodeName
			* @protect removeAttribute
			* @protect setAttribute
			*
			* @param currentNode to sanitize
			* @param root the current walk root
			*/
			const _sanitizeAttributes = function _sanitizeAttributes(currentNode, root) {
				_executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
				if (_handleHookDetachedNode(currentNode, root)) return;
				const attributes = currentNode.attributes;
				if (!attributes || _isClobbered(currentNode)) return;
				ALLOWED_ATTR = _forkSharedAllowlist(hooks.uponSanitizeAttribute, ALLOWED_ATTR, DEFAULT_ALLOWED_ATTR, SET_CONFIG_ALLOWED_ATTR);
				const hookEvent = {
					attrName: "",
					attrValue: "",
					keepAttr: true,
					allowedAttributes: ALLOWED_ATTR,
					forceKeepAttr: void 0
				};
				let l = attributes.length;
				const lcTag = transformCaseFunc(currentNode.nodeName);
				while (l--) {
					const attr = attributes[l];
					const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
					const lcName = transformCaseFunc(name);
					const initValue = attrValue;
					let value = name === "value" ? initValue : stringTrim(initValue);
					let recreatedNamedProp = false;
					hookEvent.attrName = lcName;
					hookEvent.attrValue = value;
					hookEvent.keepAttr = true;
					hookEvent.forceKeepAttr = void 0;
					_executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
					value = hookEvent.attrValue;
					if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
						_removeAttribute(name, currentNode, attr);
						value = SANITIZE_NAMED_PROPS_PREFIX + value;
						recreatedNamedProp = true;
					}
					if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
						_removeAttribute(name, currentNode, attr);
						continue;
					}
					if (lcName === "attributename" && stringMatch(value, "href")) {
						_removeAttribute(name, currentNode, attr);
						continue;
					}
					if (hookEvent.forceKeepAttr) continue;
					if (!hookEvent.keepAttr) {
						_removeAttribute(name, currentNode, attr);
						continue;
					}
					if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
						_removeAttribute(name, currentNode, attr);
						continue;
					}
					if (SAFE_FOR_TEMPLATES) value = _stripTemplateExpressions(value);
					if (!_isValidAttribute(lcTag, lcName, value)) {
						_removeAttribute(name, currentNode, attr);
						continue;
					}
					value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
					if (value !== initValue) {
						if (_setAttributeValue(currentNode, name, namespaceURI, value) && recreatedNamedProp) arrayPop(DOMPurify.removed);
					}
				}
				_executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
				_handleHookDetachedNode(currentNode, root);
			};
			/**
			* _sanitizeShadowDOM
			*
			* @param fragment to iterate over recursively
			*/
			const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
				let shadowNode = null;
				const shadowIterator = _createNodeIterator(fragment);
export {};
