/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-experimental-session-inspector/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/chat-node/reveal-target.js
		/** Precise and nearby Chat reveal candidates from the Inspector's loaded Chat snapshot. */
		function nearest(nodes, seq) {
			let best;
			for (const node of nodes) if (best === void 0 || Math.abs(node.anchorSeq - seq) < Math.abs(best.anchorSeq - seq)) best = node;
			return best;
		}
		function primaryTarget(target, visible) {
			if (target.nodeKey !== void 0 || target.anchorSeq === void 0) return target;
			const inTurn = target.turn === void 0 ? visible : visible.filter((node) => (node.location.kind === "turn" || node.location.kind === "step") && node.location.turn.turn === target.turn);
			const inStep = target.step === void 0 ? inTurn : inTurn.filter((node) => node.location.kind === "step" && node.location.step.step === target.step);
			const rootCallId = target.rootCallId ?? target.callId;
			const tool = rootCallId === void 0 ? void 0 : visible.find((node) => node.kind === "tool-call" && node.data.root.callId === rootCallId);
			const exact = inStep.find((node) => node.anchorSeq === target.anchorSeq);
			const kind = target.nodeKind === void 0 ? void 0 : inStep.find((node) => node.kind === target.nodeKind);
			const node = tool ?? exact ?? kind ?? nearest(inStep, target.anchorSeq) ?? nearest(inTurn, target.anchorSeq);
			if (node === void 0) return target;
			const turn = target.turn ?? (node.location.kind === "turn" || node.location.kind === "step" ? node.location.turn.turn : void 0);
			return {
				...target,
				nodeKey: node.key,
				...turn === void 0 ? {} : { turn }
			};
		}
		function nodeTarget(node) {
			const location = node.location;
			return {
				nodeKey: node.key,
				anchorSeq: node.anchorSeq,
				...location.kind === "turn" || location.kind === "step" ? { turn: location.turn.turn } : {},
				...location.kind === "step" ? { step: location.step.step } : {}
			};
		}
		function targetKey(target) {
			return JSON.stringify([
				target.anchorSeq,
				target.callId,
				target.rootCallId,
				target.nodeKey,
				target.nodeKind,
				target.groupKey,
				target.groupPart,
				target.turn,
				target.step
			]);
		}
		/**
		* Preserve the primary identity or tool/exact/kind/nearest placement, then rank visible neighbors.
		* Explicit-node primaries include missing model coordinates, even when the node is hidden.
		* Request coordinates take precedence over the node's position.
		* Without a known anchor sequence, only the original target is returned.
		* @param target - Object identity or original event coordinates supplied by another View.
		* @param nodes - Current Session's loaded Chat nodes; equal-distance candidates retain input order.
		* @returns Primary target followed by distinct Step, Turn, and Session neighbors with only node coordinates.
		*/
		function resolveChatRevealTargets(target, nodes) {
			const visible = nodes.filter((node) => node.visibility === "visible");
			const explicit = target.nodeKey === void 0 ? void 0 : nodes.find((node) => node.key === target.nodeKey);
			const position = explicit === void 0 ? void 0 : nodeTarget(explicit);
			const referenceSeq = target.anchorSeq ?? position?.anchorSeq;
			const turn = target.turn ?? position?.turn;
			const step = target.step ?? position?.step;
			const primary = position === void 0 ? primaryTarget(target, visible) : {
				...target,
				anchorSeq: target.anchorSeq ?? position.anchorSeq,
				...turn === void 0 ? {} : { turn },
				...step === void 0 ? {} : { step }
			};
			if (referenceSeq === void 0) return [primary];
			const rank = (candidate) => {
				const sameTurn = turn === void 0 || candidate.turn === turn;
				if (sameTurn && step !== void 0 && candidate.step === step) return 0;
				return sameTurn && turn !== void 0 ? 1 : 2;
			};
			const neighbors = visible.map(nodeTarget).sort((left, right) => rank(left) - rank(right) || Math.abs(left.anchorSeq - referenceSeq) - Math.abs(right.anchorSeq - referenceSeq));
			const candidates = [primary];
			const seen = new Set([targetKey(primary)]);
			for (const candidate of neighbors) {
				const key = targetKey(candidate);
				if (seen.has(key)) continue;
				seen.add(key);
				candidates.push(candidate);
			}
			return candidates;
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/chat-node/picker.js
		/** One-shot Inspector picking through a real click-catching mask over the main Chat. */
		const POINTER_ACTIONS = [
			"pointerdown",
			"pointerup",
			"mousedown",
			"mouseup",
			"auxclick",
			"dblclick",
			"contextmenu"
		];
		/** Owns the mask, preview, and geometry observers for one picking gesture. */
		var InspectorChatPicker = class {
			getRoot;
			owner;
			picked;
			cancelled;
			released;
			mask;
			overlay;
			root;
			observing;
			resizing;
			/**
			* @param getRoot - Current Session's displayed main Chat.
			* @param owner - Inspector button; hiding or removing it cancels picking.
			* @param picked - True completes selection; false keeps the mask for another pick.
			* @param cancelled - Clear the owning panel's picking state.
			* @param released - Forget this gesture after its DOM resources are released.
			*/
			constructor(getRoot, owner, picked, cancelled, released) {
				this.getRoot = getRoot;
				this.owner = owner;
				this.picked = picked;
				this.cancelled = cancelled;
				this.released = released;
			}
			/**
			* Begin picking in the visible main Chat.
			* @returns Whether a visible Chat was found and its mask installed.
			*/
			start() {
				const root = this.getRoot();
				if (root === void 0 || !displayed(root) || !displayed(this.owner)) return false;
				const mask = document.createElement("div");
				if (!placeChatHighlight(mask, root)) return false;
				mask.className = inspector_module_css_default.chatPickMask;
				mask.dataset.sessionInspectorPicker = "";
				mask.setAttribute("aria-hidden", "true");
				this.root = root;
				this.mask = mask;
				mask.addEventListener("pointermove", this.move);
				mask.addEventListener("pointerleave", this.hide);
				mask.addEventListener("click", this.click);
				mask.addEventListener("wheel", this.wheel, { passive: false });
				for (const type of POINTER_ACTIONS) mask.addEventListener(type, this.suppress);
				document.body.append(mask);
				window.addEventListener("keydown", this.keydown, true);
				window.addEventListener("blur", this.cancel);
				window.addEventListener("scroll", this.position, true);
				window.addEventListener("resize", this.position);
				this.observing = new MutationObserver(this.verify);
				for (const start of [this.owner, root]) for (let element = start; element !== null; element = element.parentElement) this.observing.observe(element, {
					attributes: true,
					attributeFilter: [
						"hidden",
						"style",
						"class"
					],
					childList: true
				});
				if (typeof ResizeObserver !== "undefined") {
					this.resizing = new ResizeObserver(this.position);
					this.resizing.observe(root);
				}
				return true;
			}
			/** Remove the mask and observers without calling panel callbacks during unmount. */
			dispose() {
				const mask = this.mask;
				if (mask !== void 0) {
					mask.removeEventListener("pointermove", this.move);
					mask.removeEventListener("pointerleave", this.hide);
					mask.removeEventListener("click", this.click);
					mask.removeEventListener("wheel", this.wheel);
					for (const type of POINTER_ACTIONS) mask.removeEventListener(type, this.suppress);
					mask.remove();
				}
				this.mask = void 0;
				this.root = void 0;
				window.removeEventListener("keydown", this.keydown, true);
				window.removeEventListener("blur", this.cancel);
				window.removeEventListener("scroll", this.position, true);
				window.removeEventListener("resize", this.position);
				this.observing?.disconnect();
				this.observing = void 0;
				this.resizing?.disconnect();
				this.resizing = void 0;
				this.hide();
				this.released();
			}
			currentRoot() {
				const root = this.root;
				return root !== void 0 && this.getRoot() === root && displayed(root) && displayed(this.owner) ? root : void 0;
			}
			position = () => {
				this.hide();
				this.verify();
			};
			verify = () => {
				if (this.mask === void 0) return;
				const root = this.currentRoot();
				if (root === void 0 || !placeChatHighlight(this.mask, root)) this.cancel();
			};
			hit(event) {
				if (this.mask === void 0) return void 0;
				const root = this.currentRoot();
				if (root === void 0) {
					this.cancel();
					return;
				}
				const element = document.elementsFromPoint(event.clientX, event.clientY).find((element) => element !== this.mask && element !== this.overlay);
				return element !== void 0 && inChat(element, root) ? {
					element,
					root
				} : void 0;
			}
			hide = () => {
				this.overlay?.remove();
				this.overlay = void 0;
			};
			/** Stop the gesture and clear its owning panel's picking state. */
			cancel = () => {
				if (this.mask === void 0) return;
				this.dispose();
				this.cancelled();
			};
			move = (event) => {
				const hit = this.hit(event);
				const match = hit === void 0 ? void 0 : matchChatElement(hit.element, hit.root);
				if (match === void 0) {
					this.hide();
					return;
				}
				const overlay = this.overlay ?? document.createElement("div");
				overlay.className = inspector_module_css_default.chatPick;
				overlay.dataset.sessionInspectorHighlight = "pick";
				overlay.setAttribute("aria-hidden", "true");
				if (!placeChatHighlight(overlay, match.element)) {
					this.hide();
					return;
				}
				if (this.overlay === void 0) {
					document.body.append(overlay);
					this.overlay = overlay;
				}
			};
			suppress = (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
			};
			click = (event) => {
				this.suppress(event);
				if (event.button !== 0) return;
				const hit = this.hit(event);
				const match = hit === void 0 ? void 0 : matchChatElement(hit.element, hit.root);
				if (match !== void 0 && this.picked(match.target)) this.dispose();
			};
			wheel = (event) => {
				this.suppress(event);
				const hit = this.hit(event);
				for (let element = hit?.element ?? null; element !== null; element = element.parentElement) {
					if (!(element instanceof HTMLElement) || !element.matches("[data-conversation-scroll], [data-step-process-body]")) continue;
					const vertical = event.deltaY < 0 ? element.scrollTop > 0 : element.scrollTop + element.clientHeight < element.scrollHeight;
					const horizontal = event.deltaX < 0 ? element.scrollLeft > 0 : element.scrollLeft + element.clientWidth < element.scrollWidth;
					if (!(event.deltaY !== 0 && vertical || event.deltaX !== 0 && horizontal)) continue;
					const style = getComputedStyle(element);
					const scale = event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? element.clientHeight : event.deltaMode === WheelEvent.DOM_DELTA_LINE ? Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) || 1 : 1;
					element.scrollBy({
						top: event.deltaY * scale,
						left: event.deltaX * scale,
						behavior: "instant"
					});
					break;
				}
			};
			keydown = (event) => {
				if (event.key !== "Escape") return;
				this.suppress(event);
				this.cancel();
			};
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/index.js
		/** Session-scoped Sidebar tab backed by the existing Chat and Session-log models. */
		/**
		* Register the Session Inspector Sidebar page and its Session-scoped sources.
		* @param ctx - Client plugin context owning the tab registration and Session-bound model cache.
		*/
		function registerInspectorTab(ctx) {
			let activePicker;
			let disposed = false;
			ctx.effect(() => () => {
				disposed = true;
				activePicker?.dispose();
			}, "session-inspector: chat picker");
			const t = ctx.locale.bind(NS);
			const id = "@deepseek-ai/dsh-experimental-session-inspector";
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id,
				kind: "session-inspector-log",
				title: () => t("tab.title"),
				guide: [{
					id: "open",
					order: 60,
					title: () => t("tab.title"),
					description: () => t("tab.description")
				}]
			}), "session-inspector: sidebar tab");
			const models = /* @__PURE__ */ new WeakMap();
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: id,
				locale: NS,
				inject: (sessionId) => {
					const binding = ctx.sessions.binding(sessionId);
					if (binding === void 0) throw new Error(`session-inspector: unknown Session ${sessionId}`);
					let sources = models.get(binding);
					if (sources === void 0) {
						const conversation = ctx.uiConversation.binding(binding);
						const chat = new ChatNodeModel(conversation);
						const log = new SessionLogModel(binding.eventSource);
						const chatRoot = () => ctx.uiSession.adapter.current.getSnapshot().key === sessionId ? mainChatRoot() : void 0;
						sources = {
							hooks: {
								chatRows: chat,
								logRows: log
							},
							keyedHooks: {
								chatRecord: chat.row,
								logRecord: log.row
							},
							chatRoot,
							pickChat: (owner, picked, cancelled) => {
								if (disposed) return void 0;
								activePicker?.cancel();
								const picker = new InspectorChatPicker(chatRoot, owner, picked, cancelled, () => {
									if (activePicker === picker) activePicker = void 0;
								});
								if (!picker.start()) return void 0;
								activePicker = picker;
								return () => {
									picker.dispose();
								};
							},
							resolveChatTargets: (target) => resolveChatRevealTargets(target, conversation.snapshot.getSnapshot().views.get("chat")?.nodes.values() ?? []),
							recordType: (key, mode) => (mode === "chat-node" ? chat.row(key) : log.row(key))?.getSnapshot()?.type,
							loadOlder: () => binding.session.loadOlder(),
							objects: chat.objects(sessionId),
							logChatTarget: (key) => {
								const anchor = log.chatAnchor(key);
								if (anchor === void 0) return void 0;
								return sessionLogChatTarget(anchor);
							},
							pickRow: (target, mode) => {
								if (mode === "chat-node") return chat.pick(target);
								const snapshot = conversation.snapshot.getSnapshot();
								const groups = snapshot.views.grouped("chat");
								const reference = target.groupKey === void 0 ? void 0 : groups?.entries.find((entry) => entry.kind === "group" && entry.key === target.groupKey);
								const group = reference?.kind === "group" ? groups?.groupSource(reference.key).getSnapshot() : void 0;
								const nodeKey = target.nodeKey ?? group?.members[0]?.key;
								const node = nodeKey === void 0 ? void 0 : snapshot.views.get("chat")?.nodes.get(nodeKey);
								const location = node?.location;
								return log.pick({
									...target,
									...node === void 0 ? {} : {
										anchorSeq: node.anchorSeq,
										nodeKind: node.kind
									},
									...location?.kind === "turn" || location?.kind === "step" ? { turn: location.turn.turn } : {},
									...location?.kind === "step" ? { step: location.step.step } : {}
								});
							}
						};
						models.set(binding, sources);
					}
					return sources;
				}
			}, SessionInspectorView));
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/index.js
		/** Browser plugin contributing the Session Inspector Log sidebar tab. */
		/** Services required to register the localized Session-bound sidebar tab. */
		const inject = [
			"slots",
			"locale",
			"sessions",
			"uiSession",
			"uiConversation",
			"sidebarRightTabs"
		];
		/**
		* Register the Inspector tab for this plugin's lifetime.
		* @param ctx - Client plugin context owning the dictionaries and registrations.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				en,
				zh
			}), "session-inspector: dictionaries");
			registerInspectorTab(ctx);
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
} // __DSH_FRAGMENT_END__

export {};
