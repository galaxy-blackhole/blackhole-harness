/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			"workspace": "pXSMma_workspace",
			"workspaceLabel": "pXSMma_workspaceLabel",
			"workspaceRow": "pXSMma_workspaceRow"
		};
		//#endregion
		//#region lib/types/client/skeleton/EmptyHero.js
		/**
		* Basename label for the workspace chip (the shared derivation);
		* separator-only paths echo the raw cwd.
		* @param cwd - workspace directory path (non-empty).
		* @returns chip label.
		*/
		function workspaceLabel(cwd) {
			const base = workspaceTitleOf(cwd);
			return base !== "" ? base : cwd;
		}
		/**
		* The workspace chip (folder + label + chevron), always interactive: before
		* the first message the workspace stays switchable — picking another one
		* moves the New Session flow to that workspace's blank session. Without a
		* label the chip renders its placeholder state: closed folder + the
		* "Choose workspace" call to action.
		* @param props.label - chip label (see {@link workspaceLabel}); omitted → placeholder.
		* @param props.menuOpen - menu expansion echo.
		* @param props.onClick - menu toggle.
		* @returns the chip button element.
		*/
		function WorkspaceChip({ buttonRef, label, menuOpen = false, onClick, t }) {
			return (0, react_jsx_runtime.jsxs)("button", {
				ref: buttonRef,
				type: "button",
				className: HeroShell_module_css_default.workspace,
				"aria-label": t("hero.chooseWorkspace"),
				"aria-haspopup": "menu",
				"aria-expanded": menuOpen,
				onClick,
				children: [
					label === void 0 ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, {
						className: HeroShell_module_css_default.folder,
						size: 16
					}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenRegular, {
						className: HeroShell_module_css_default.folder,
						size: 16
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: HeroShell_module_css_default.workspaceLabel,
						children: label ?? t("hero.chooseWorkspace")
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
						className: HeroShell_module_css_default.chevron,
						size: 12
					})
				]
			});
		}
		const HERO_SWIM_UP_PATH = "M22.403 0.567C22.145 0.477 22.068 0.718 21.939 0.85C21.895 0.893 21.86 0.947 21.824 0.997C21.515 1.421 21.13 1.721 20.591 1.77C19.829 1.867 19.221 2.244 18.712 2.958C18.535 2.227 18.116 1.839 17.516 1.626C17.203 1.506 16.887 1.379 16.663 1.064C16.508 0.839 16.462 0.581 16.383 0.329C16.332 0.176 16.283 0.02 16.121 -0.002C15.944 -0.029 15.875 0.133 15.805 0.269C15.52 0.822 15.408 1.43 15.42 2.046C15.449 3.432 16.031 4.532 17.202 5.274C17.337 5.356 17.374 5.445 17.335 5.582C17.261 5.862 17.169 6.134 17.086 6.413C17.032 6.59 16.952 6.63 16.764 6.558C16.118 6.301 15.562 5.909 15.074 5.433C14.248 4.633 13.5 3.751 12.568 3.06C12.349 2.898 12.13 2.748 11.903 2.605C10.952 1.682 12.028 0.923 12.277 0.833C12.537 0.739 12.367 0.416 11.526 0.42C10.684 0.424 9.914 0.706 8.933 1.081C8.789 1.138 8.638 1.179 8.484 1.213C7.593 1.044 6.668 1.006 5.702 1.115C3.883 1.318 2.43 2.178 1.362 3.646C0.079 5.41 -0.223 7.415 0.147 9.506C0.535 11.71 1.66 13.535 3.389 14.962C5.181 16.441 7.246 17.166 9.601 17.027C11.032 16.944 12.624 16.753 14.421 15.232C14.874 15.458 15.35 15.548 16.138 15.615C16.746 15.672 17.331 15.585 17.784 15.491C18.493 15.341 18.444 14.684 18.188 14.564C16.108 13.595 16.565 13.989 16.15 13.67C17.206 12.42 18.82 10.198 19.363 7.086C19.421 6.709 19.484 6.171 19.469 5.866C19.458 5.681 19.493 5.604 19.681 5.556C20.199 5.412 20.691 5.172 21.125 4.806C22.366 3.824 22.758 2.554 22.708 1.1C22.7 0.878 22.649 0.654 22.403 0.567ZM11.175 14.451C9.159 12.726 8.182 12.088 7.778 12.067C7.401 12.047 7.469 12.505 7.552 12.807C7.639 13.103 7.752 13.313 7.91 13.581C8.02 13.758 8.095 14.01 7.801 14.16C7.152 14.487 6.023 13.806 5.97 13.772C4.657 12.85 3.559 11.766 2.785 10.369C2.037 9.025 1.603 7.583 1.532 6.044C1.513 5.672 1.622 5.541 1.992 5.473C2.479 5.383 2.981 5.364 3.468 5.436C5.525 5.736 7.276 6.675 8.744 8.323C9.582 9.299 10.216 10.425 10.869 11.496C11.563 12.592 12.31 13.603 13.262 14.414C13.598 14.696 13.866 14.91 14.123 15.068C13.349 15.154 12.058 15.167 11.175 14.452L11.175 14.451ZM12.141 8.26C12.141 8.095 12.273 7.963 12.439 7.963C12.476 7.963 12.511 7.971 12.541 7.982C12.582 7.997 12.62 8.019 12.65 8.053C12.704 8.106 12.733 8.181 12.733 8.26C12.733 8.425 12.601 8.556 12.435 8.556C12.27 8.556 12.141 8.425 12.141 8.26ZM15.142 9.799C14.949 9.878 14.757 9.945 14.572 9.953C14.284 9.968 13.972 9.851 13.802 9.709C13.537 9.487 13.348 9.363 13.27 8.977C13.236 8.812 13.255 8.556 13.284 8.41C13.352 8.094 13.277 7.892 13.055 7.708C12.873 7.558 12.643 7.516 12.39 7.516C12.296 7.516 12.209 7.475 12.145 7.441C12.039 7.389 11.952 7.257 12.035 7.096C12.062 7.043 12.19 6.916 12.22 6.893C12.563 6.698 12.96 6.762 13.326 6.908C13.665 7.047 13.922 7.302 14.292 7.663C14.669 8.098 14.738 8.218 14.953 8.545C15.123 8.801 15.277 9.063 15.383 9.364C15.447 9.551 15.364 9.705 15.142 9.799Z";
		const HERO_SWIM_DOWN_PATH = "M23.271 2.216C23.039 2.071 22.91 2.287 22.755 2.388C22.703 2.42 22.656 2.464 22.61 2.505C22.214 2.848 21.771 3.054 21.225 2.956C20.412 2.784 19.68 2.919 19.005 3.435C18.92 2.663 18.493 2.157 17.808 1.798C17.446 1.621 17.08 1.449 16.83 1.111C16.656 0.872 16.611 0.612 16.524 0.354C16.469 0.198 16.414 0.039 16.223 0.009C16.017 -0.024 15.936 0.137 15.856 0.271C15.539 0.822 15.418 1.43 15.429 2.046C15.454 3.432 16.041 4.538 17.196 5.36C17.325 5.456 17.356 5.547 17.312 5.674C17.229 5.936 17.134 6.191 17.051 6.454C16.999 6.623 16.921 6.659 16.738 6.58C16.107 6.306 15.56 5.909 15.074 5.433C14.248 4.633 13.5 3.751 12.568 3.06C12.349 2.898 12.13 2.748 11.903 2.605C10.952 1.682 12.028 0.923 12.277 0.833C12.537 0.739 12.367 0.416 11.526 0.42C10.684 0.424 9.914 0.706 8.933 1.081C8.789 1.138 8.638 1.179 8.484 1.213C7.593 1.044 6.668 1.006 5.702 1.115C3.883 1.318 2.43 2.178 1.362 3.646C0.079 5.41 -0.223 7.415 0.147 9.506C0.535 11.71 1.66 13.535 3.389 14.962C5.181 16.441 7.246 17.166 9.601 17.027C11.032 16.944 12.624 16.753 14.421 15.232C14.874 15.458 15.35 15.548 16.138 15.615C16.746 15.672 17.331 15.585 17.784 15.491C18.493 15.341 18.444 14.684 18.188 14.564C16.108 13.595 16.565 13.989 16.15 13.67C17.206 12.42 18.82 10.198 19.278 7.246C19.318 6.948 19.375 6.534 19.371 6.293C19.371 6.145 19.411 6.092 19.597 6.098C20.113 6.109 20.619 6.051 21.096 5.891C22.503 5.375 23.169 4.232 23.448 2.804C23.49 2.586 23.491 2.356 23.271 2.216ZM11.175 14.49C9.159 13.005 8.182 12.567 7.778 12.621C7.401 12.673 7.469 13.087 7.552 13.354C7.639 13.619 7.752 13.797 7.91 14.024C8.02 14.175 8.095 14.406 7.801 14.609C7.152 15.063 6.023 14.63 5.97 14.609C4.657 13.941 3.559 12.965 2.785 11.569C2.037 10.225 1.603 8.783 1.532 7.244C1.513 6.872 1.622 6.741 1.992 6.673C2.479 6.583 2.981 6.564 3.468 6.636C5.525 6.936 7.276 7.843 8.744 9.163C9.582 9.888 10.216 10.783 10.869 11.679C11.563 12.659 12.31 13.617 13.262 14.415C13.598 14.696 13.866 14.91 14.123 15.068C13.349 15.155 12.058 15.177 11.175 14.491L11.175 14.49ZM12.141 8.26C12.141 8.095 12.273 7.963 12.439 7.963C12.476 7.963 12.511 7.971 12.541 7.982C12.582 7.997 12.62 8.019 12.65 8.053C12.704 8.106 12.733 8.181 12.733 8.26C12.733 8.425 12.601 8.556 12.435 8.556C12.27 8.556 12.141 8.425 12.141 8.26ZM15.142 9.799C14.949 9.878 14.757 9.945 14.572 9.953C14.284 9.968 13.972 9.851 13.802 9.709C13.537 9.487 13.348 9.363 13.27 8.977C13.236 8.812 13.255 8.556 13.284 8.41C13.352 8.094 13.277 7.892 13.055 7.708C12.873 7.558 12.643 7.516 12.39 7.516C12.296 7.516 12.209 7.475 12.145 7.441C12.039 7.389 11.952 7.257 12.035 7.096C12.062 7.043 12.19 6.916 12.22 6.893C12.563 6.698 12.96 6.762 13.326 6.908C13.665 7.047 13.922 7.302 14.292 7.663C14.669 8.098 14.738 8.218 14.953 8.545C15.123 8.801 15.277 9.063 15.383 9.364C15.447 9.551 15.364 9.705 15.142 9.799Z";
		/**
		* The hero fish (34px wide), static at rest. Hovering swims the whale in
		* place: a gentle head-up sway (CSS, on the hitbox hover) while the body
		* itself morphs — SMIL interpolates `d` through the tail-up and tail-down
		* targets on the same 1.6s period, so the tail wags and the fin flutters in
		* real curve deformation. Decorative — hidden from the accessibility tree;
		* reduced motion keeps the static filled logo on hover (sampled at
		* mouseenter; a mid-hover preference change takes effect on the next enter).
		* @param props.hovering - driven by the hitbox parent's pointer state.
		* @returns the fish svg element.
		*/
		function HeroFish({ hovering }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				className: HeroShell_module_css_default.fish,
				width: 34,
				height: 34 * _deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_VIEWBOX.height / _deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_VIEWBOX.width,
				viewBox: `0 0 ${_deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_VIEWBOX.width} ${_deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_VIEWBOX.height}`,
				fill: "none",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", {
					d: _deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_PATH,
					fill: "currentColor",
					children: hovering && (0, react_jsx_runtime.jsx)("animate", {
						attributeName: "d",
						values: `${_deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_PATH};${HERO_SWIM_UP_PATH};${_deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_PATH};${HERO_SWIM_DOWN_PATH};${_deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_PATH}`,
						keyTimes: "0;0.35;0.55;0.75;1",
						calcMode: "spline",
						keySplines: "0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1",
						dur: "1.6s",
						repeatCount: "indefinite"
					})
				})
			});
		}
		/**
		* Render the hero chrome (headline only; no composer, no workspace row).
		* @param props - see {@link HeroShellProps}.
		* @returns the centered hero element tree.
		*/
		function HeroShell({ t, renderSlot, children }) {
			const [hovering, setHovering] = (0, react.useState)(false);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: HeroShell_module_css_default.root,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: HeroShell_module_css_default.stack,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: HeroShell_module_css_default.headline,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: HeroShell_module_css_default.fishHitbox,
							onMouseEnter: () => {
								if (window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) setHovering(true);
							},
							onMouseLeave: () => {
								setHovering(false);
							},
							children: renderSlot("conversation.hero.brand.mark", {
								size: 34,
								className: HeroShell_module_css_default.fish
							}, { fallback: (0, react_jsx_runtime.jsx)(HeroFish, { hovering }) })
						}), (0, react_jsx_runtime.jsxs)("span", {
							className: HeroShell_module_css_default.titleGroup,
							children: [(0, react_jsx_runtime.jsx)("span", { children: t("hero.headline") }), (0, react_jsx_runtime.jsx)("span", {
								className: HeroShell_module_css_default.previewBadge,
								children: t("hero.preview")
							})]
						})]
					}), (0, react_jsx_runtime.jsx)("div", { className: HeroShell_module_css_default.body })]
				}), children]
			});
		}
		//#endregion
		//#region lib/types/client/skeleton/ConversationContent.js
		function ConversationSessionView({ renderSlot }) {
			return renderSlot("conversation.session", {});
		}
		function NoConversationWidthControls() {
			return null;
		}
		/**
		* Render the shared Conversation body and its occurrence-selected local Components.
		* @param props - Factory input, standard Session sources, and Conversation seats.
		* @returns the Conversation view, Composer, and optional width controls.
		*/
		function ConversationContent(props) {
			const { sessionId, phase, hero, useSession, useSessions, useSessionStatus, useWorkspaces, useInput, useComposerBlock, renderSlot, renderSlotChain, selectWorkspace, t, useFactorySlot } = props;
			const session = useSession((snapshot) => snapshot);
			const Views = useFactorySlot("views", ConversationSessionView);
			const WidthControls = useFactorySlot("widthControls", NoConversationWidthControls);
			const [body, setBody] = (0, react.useState)(null);
			const pendingInteraction = useSessionStatus((snapshot) => sessionId === void 0 ? void 0 : snapshot.get(sessionId)?.pendingInteraction);
			const inputState = useInput((s) => s);
			const cwd = useSessions((s) => sessionId === void 0 ? void 0 : s.byId[sessionId]?.cwd);
			const workspaces = useWorkspaces((s) => s);
			const composerBlock = useComposerBlock((block) => block);
			const [pickerOpen, setPickerOpen] = (0, react.useState)(false);
			const [pendingWorkspaceId, setPendingWorkspaceId] = (0, react.useState)();
			const pickerAnchor = (0, react.useRef)(null);
			const seatObserver = (0, react.useRef)(null);
			const seatResizeRef = (0, react.useCallback)((seat) => {
				seatObserver.current?.disconnect();
				seatObserver.current = null;
				const scroller = seat?.parentElement ?? null;
				if (seat === null || scroller === null) return;
				seatObserver.current = new ResizeObserver(() => {
					scroller.style.setProperty("--dsh-composer-height", `${seat.offsetHeight}px`);
					scroller.style.setProperty("--dsh-conversation-viewport-height", `${scroller.clientHeight}px`);
				});
				seatObserver.current.observe(seat);
				seatObserver.current.observe(scroller);
			}, []);
			const sessionWorkspace = sessionId === void 0 ? void 0 : workspaces.items.find((workspace) => workspace.sessionIds.includes(sessionId));
			const pendingWorkspace = workspaces.items.find((workspace) => workspace.workspaceId === pendingWorkspaceId);
			(0, react.useEffect)(() => {
				if (pendingWorkspaceId === void 0) return;
				if (sessionWorkspace?.workspaceId === pendingWorkspaceId || workspaces.phase === "ready" && pendingWorkspace === void 0) setPendingWorkspaceId(void 0);
			}, [
				pendingWorkspaceId,
				sessionWorkspace?.workspaceId,
				workspaces.phase,
				pendingWorkspace
			]);
			const zone = session === void 0 || inputState === void 0 ? void 0 : {
				session,
				input: inputState
			};
			const storedChipTitle = pendingWorkspace?.title ?? (sessionId === void 0 ? void 0 : sessionWorkspace?.title ?? (workspaces.phase === "ready" || cwd === void 0 || cwd === "" ? void 0 : workspaceLabel(cwd)));
			const chipTitle = storedChipTitle === void 0 ? void 0 : workspaceDisplayTitle(storedChipTitle, t("workspace.defaultName"));
			const heroWorkspaceRow = (0, react_jsx_runtime.jsxs)("div", {
				className: ConversationRoot_module_css_default.heroWorkspaceRow,
				children: [
					(0, react_jsx_runtime.jsx)(WorkspaceChip, {
						buttonRef: pickerAnchor,
						label: chipTitle,
						menuOpen: pickerOpen,
						onClick: () => {
							setPickerOpen((open) => !open);
						},
						t
					}),
					renderSlot("conversation.hero.workspace", {
						open: pickerOpen,
						anchorRef: pickerAnchor,
						selectedId: pendingWorkspaceId ?? sessionWorkspace?.workspaceId,
						onPick: (workspaceId) => {
							setPickerOpen(false);
							setPendingWorkspaceId(workspaceId);
							selectWorkspace(workspaceId).catch(() => {
								setPendingWorkspaceId((current) => current === workspaceId ? void 0 : current);
							});
						},
						onClose: () => {
							setPickerOpen(false);
						}
					}),
					renderSlot("conversation.hero.agentPreset", {}),
					sessionId === void 0 ? null : (0, react_jsx_runtime.jsx)("div", {
						className: ConversationRoot_module_css_default.heroOptions,
						children: renderSlot("conversation.hero.options", {})
					})
				]
			});
			const inert = sessionId === void 0 || hero && chipTitle === void 0;
			const inputBar = renderSlot("conversation.composer.bar", {
				variant: hero ? "hero" : "composer",
				...inert ? {
					disabled: true,
					placeholder: t("placeholder.workspace"),
					workspacePickerOpen: pickerOpen,
					onRequestWorkspace: () => {
						setPickerOpen(true);
					}
				} : !inert && composerBlock !== void 0 ? {
					blocked: composerBlock,
					placeholder: composerBlock.reason
				} : hero ? { placeholder: t("placeholder.hero") } : {}
			});
			const composerBar = (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(ConversationRoot_module_css_default.composerStack, hero && ConversationRoot_module_css_default.composerHero),
				children: [
					hero && (0, react_jsx_runtime.jsx)(HeroShell, {
						t,
						renderSlot
					}),
					hero && heroWorkspaceRow,
					zone !== void 0 && renderSlot("conversation.input.dock", zone),
					inputBar
				]
			});
			const composer = renderSlotChain("conversation.composer", {
				sessionId,
				session,
				pendingInteraction
			}, {
				fallback: composerBar,
				fallbackOnly: sessionId === void 0,
				overlay: true
			});
			const composerSeat = (0, react_jsx_runtime.jsx)("div", {
				ref: seatResizeRef,
				className: ConversationRoot_module_css_default.composerSeat,
				"data-composer-seat": "",
				"data-conversation-region": "composer",
				children: composer
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: setBody,
				className: clsx(ConversationRoot_module_css_default.body, props.variant === "embedded" && ConversationRoot_module_css_default.embeddedBody),
				"data-conversation-content": "",
				"data-conversation-session": sessionId,
				"data-conversation-region": "chat",
				"data-content-phase": phase,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: ConversationRoot_module_css_default.scrollBody,
					"data-conversation-scroll": "",
					children: [sessionId === void 0 ? null : (0, react_jsx_runtime.jsx)(Views, {}), composerSeat]
				}), (0, react_jsx_runtime.jsx)(WidthControls, {
					container: body,
					phase
				})]
			});
		}
		//#endregion
		//#region lib/types/client/skeleton/ConversationPanel.js
		/**
		* Render the Conversation with optional current-Session binding.
		* @param props - main-slot inputs and the declared Conversation renderer.
		* @returns the Conversation subtree.
		*/
		function ConversationPanel({ renderSlot }) {
			return renderSlot("main.conversation", {});
		}
		//#endregion
		//#region lib/types/client/skeleton/ConversationHeader.js
		/** Resident conversation navigation and Session-specific header content. */
		/**
		* Keeps global navigation available before a Session exists.
		* @param props - Optional Session sources and authorized header slots.
		* @returns The persistent header with any selected Session's title and views.
		*/
		function ConversationHeader({ sessionId, useSession, useConversation, renderSlot }) {
			const session = useSession((s) => s);
			const conversation = useConversation((s) => s);
			const blank = session === void 0 || conversation === void 0 || session.blank && conversationPhase(session, conversation) === "blank";
			return (0, react_jsx_runtime.jsxs)("header", {
				className: clsx(ConversationRoot_module_css_default.header, blank && ConversationRoot_module_css_default.headerBlank, sessionId === void 0 && ConversationRoot_module_css_default.headerSessionless),
				"data-window-drag": true,
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: ConversationRoot_module_css_default.headerLeading,
					"data-conversation-header-leading": "",
					children: renderSlot("conversation.header.leading", {})
				}), sessionId === void 0 ? (0, react_jsx_runtime.jsx)("div", { className: ConversationRoot_module_css_default.titleRow }) : renderSlot("conversation.session.header", { hideChrome: blank })]
			});
		}
		/**
		* Resolve a preferred registered View, then Chat, without choosing another View.
		* @param tabs - currently registered Views.
		* @param selectedId - preferred View identity, when one is stored.
		* @returns the selected View, Chat fallback, or undefined when neither is registered.
		*/
		function resolveActiveView(tabs, selectedId) {
			return (selectedId === null ? void 0 : tabs.find((view) => view.id === selectedId)) ?? tabs.find((view) => view.id === "chat");
		}
		//#endregion
		//#region lib/types/client/skeleton/DefaultConversationViews.js
		/**
		* Renders the active Session view inside the resident scrollport and keeps
		* the input draft persisted while blank Hero chrome is visible.
		* @param props - Strict Session input/store, view ledger, and render shares.
		* @returns the active view area, or null while the Session remains blank.
		*/
		function DefaultConversationViews({ view, useSession, useConversation, useConversationViews, inputActions, useStore, actions, renderSlot, bindDraftPersistence, openView, useInspectCall }) {
			const tabs = useConversationViews((value) => value);
			const inspectCall = useInspectCall((value) => value);
			const active = resolveActiveView(tabs, useStore((s) => s.view));
			const session = useSession((s) => s);
			const conversation = useConversation((s) => s);
			const viewRequest = useStore((s) => s.viewRequest ?? null);
			(0, react.useEffect)(() => {
				const unbindDraftPersistence = bindDraftPersistence(actions.setDraft);
				inputActions.persistDraft();
				return () => {
					unbindDraftPersistence();
				};
			}, [inputActions]);
			if (session.blank && conversationPhase(session, conversation) === "blank") return null;
			const viewId = view ?? active?.id;
			return (0, react_jsx_runtime.jsx)("div", {
				className: ConversationRoot_module_css_default.viewArea,
				children: viewId !== void 0 && renderSlot("conversation.view", {
					inspectCall,
					viewRequest,
					openView,
					completeViewRequest: actions.completeViewRequest
				}, { only: viewId })
			});
		}
		//#endregion
		//#region lib/types/client/skeleton/ConversationSession.js
		/** Strict per-session header/body content inserted into the resident conversation layout. */
		function deriveAncestry(list, id) {
			const chain = [];
			const seen = /* @__PURE__ */ new Set();
			let cursor = id;
			while (cursor !== void 0) {
				if (seen.has(cursor)) break;
				seen.add(cursor);
				const summary = list.byId[cursor];
				if (summary === void 0) break;
				chain.unshift({
					id: summary.id,
					displayTitle: summary.displayTitle,
					subagent: summary.origin === "subagent"
				});
				if (summary.origin !== "subagent") break;
				cursor = summary.parentId;
			}
			return chain;
		}
		function equalBreadcrumbs(left, right) {
			return left.length === right.length && left.every((item, index) => {
				const other = right.at(index);
				return other !== void 0 && item.id === other.id && item.displayTitle === other.displayTitle;
			});
		}
		/**
		* Renders Session header chrome above the resident conversation scrollport.
		* @param props - Strict Session store, view ledger, navigation, render, and locale shares.
		* @returns Session navigation controls, with title and tabs after conversation starts.
		*/
		function ConversationSessionHeader({ sessionId, hideChrome, useSessions, useConversationViews, useStore, renderSlot, open, selectView, t }) {
			const tabs = useConversationViews((value) => value);
			const active = resolveActiveView(tabs, useStore((s) => s.view));
			const ancestry = useSessions((s) => deriveAncestry(s, sessionId), equalBreadcrumbs);
			const showTabs = !hideChrome && tabs.length > 1;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("div", {
				className: ConversationRoot_module_css_default.titleRow,
				children: [!hideChrome && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("div", {
					className: ConversationRoot_module_css_default.titleCluster,
					children: [(0, react_jsx_runtime.jsxs)("nav", {
						className: ConversationRoot_module_css_default.crumbs,
						"aria-label": t("session.hierarchy"),
						children: [ancestry.map((summary, index) => {
							const last = index === ancestry.length - 1;
export {};
