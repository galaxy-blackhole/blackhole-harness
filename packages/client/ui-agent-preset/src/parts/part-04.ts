/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			* @returns once the snapshot reflects the host.
			*/
			async load() {
				const roster = await beginRosterRead(this.ctx, this.store);
				if (roster === void 0) return;
				const { presets } = roster;
				if (presets.length === 0) {
					this.set({
						status: "unavailable",
						options: []
					});
					return;
				}
				this.set({
					status: "ready",
					error: null,
					options: presetOptions(presets)
				});
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-agent-preset/src/client/AgentPresetSeat.module.css.mjs
		const css$2 = ".cubgiG_menuAnchor{min-width:54px;max-width:100%}.cubgiG_seat{border-radius:var(--dsw-radius-sm);min-width:0;max-width:min(100%,240px);min-height:28px;color:var(--dsw-alias-label-primary);white-space:nowrap;cursor:pointer;background:0 0;border:none;align-items:center;gap:4px;padding:0 8px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}.cubgiG_seat:not(:disabled):hover,.cubgiG_seat[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}.cubgiG_seat:disabled{cursor:default;color:var(--dsw-alias-label-quaternary)}.cubgiG_seatIcon{color:var(--dsw-alias-label-primary);flex:none}.cubgiG_seatLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.cubgiG_introIcon{animation:.15s cubic-bezier(.16,1,.3,1) both cubgiG_seat-icon-in}@keyframes cubgiG_seat-icon-in{0%{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}.cubgiG_introText{white-space:pre;display:inline-block}.cubgiG_introChar{white-space:pre;opacity:0;animation:.4s ease-out forwards cubgiG_seat-char-in;display:inline-block}@keyframes cubgiG_seat-char-in{0%{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.cubgiG_introIcon,.cubgiG_introChar{opacity:1;animation:none}}.cubgiG_chevron{color:var(--dsw-alias-label-caption);flex:none}.cubgiG_item{flex-direction:column;gap:2px;max-width:280px;display:flex}.cubgiG_itemName{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}.cubgiG_itemDesc{color:var(--dsw-alias-label-caption);white-space:normal;font-size:12px;line-height:16px}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-agent-preset/AgentPresetSeat.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-agent-preset";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var AgentPresetSeat_module_css_default = {
			"chevron": "cubgiG_chevron",
			"introChar": "cubgiG_introChar",
			"introIcon": "cubgiG_introIcon",
			"introText": "cubgiG_introText",
			"item": "cubgiG_item",
			"itemDesc": "cubgiG_itemDesc",
			"itemName": "cubgiG_itemName",
			"menuAnchor": "cubgiG_menuAnchor",
			"seat": "cubgiG_seat",
			"seat-char-in": "cubgiG_seat-char-in",
			"seat-icon-in": "cubgiG_seat-icon-in",
			"seatIcon": "cubgiG_seatIcon",
			"seatLabel": "cubgiG_seatLabel"
		};
		//#endregion
		//#region lib/types/client/AgentPresetSeat.js
		/**
		* The agent-preset chip on the new-session screen, beside the workspace
		* picker.
		*
		* It lives here rather than in the composer because the choice is only
		* available before a conversation starts: once a turn has run, the session's
		* history was produced under that preset's tools and the host refuses to swap
		* them. A control that spends most of its life disabled belongs on the screen
		* where it still works.
		*
		* The menu opens on the staged choice, which starts as the deployment default.
		* Picking stages; the choice reaches a session when one becomes current.
		*/
		const INTRO_TEXT_DELAY_MS = 150;
		const INTRO_CHAR_STAGGER_MS = 40;
		const INTRO_TEXT_REVEAL_MS = 200;
		const INTRO_CHAR_FADE_MS = 400;
		/** Duration of a selection-refusal banner, including a revision becoming unavailable during a pick. */
		const REFUSAL_HOLD_MS = 8e3;
		/**
		* Per-character start offset for the introduce reveal.
		* @param count - character count of the shown preset name.
		* @returns milliseconds between successive character starts.
		*/
		function introStaggerMs(count) {
			if (count <= 1) return 0;
			return Math.min(INTRO_CHAR_STAGGER_MS, INTRO_TEXT_REVEAL_MS / (count - 1));
		}
		/**
		* Render the new-session agent-preset chip.
		* @param props - composed slot props.
		* @returns The chip and any pending selection refusal, or null outside the main view.
		*/
		function AgentPresetSeat({ sessionId, useSessionRetainInfo, load, select, dismissRefusal, introduced, useAgentPresetSeat, useDeveloperTools, t }) {
			const developerTools = useDeveloperTools((value) => value);
			const state = useAgentPresetSeat((snapshot) => snapshot);
			const main = useSessionRetainInfo((info) => sessionId === void 0 || (info?.retainedBy.mainView ?? 0) > 0);
			const [open, setOpen] = (0, react.useState)(false);
			const toastSeq = (0, react.useRef)(0);
			const [toast, setToast] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (state.error !== null && typeof state.error === "object") {
					toastSeq.current += 1;
					setToast({
						seq: toastSeq.current,
						error: state.error
					});
				} else setToast(null);
			}, [state.error]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const options = (0, react.useMemo)(() => state.options.filter((option) => developerTools || !requiresCodingTools(option)), [state.options, developerTools]);
			(0, react.useEffect)(() => {
				setOpen(false);
			}, [developerTools, options.length]);
			const chosen = state.options.find((option) => option.id === state.current);
			const label = (chosen === void 0 ? void 0 : presetDisplayText(chosen, t))?.name ?? state.current;
			const ready = state.options.length > 0 && state.current !== "";
			const [introducing, setIntroducing] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!state.introduce || !ready) return;
				const characters = Array.from(label);
				if (characters.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
					introduced();
					return;
				}
				setIntroducing(true);
				const done = window.setTimeout(() => {
					setIntroducing(false);
					introduced();
				}, INTRO_TEXT_DELAY_MS + (characters.length - 1) * introStaggerMs(characters.length) + INTRO_CHAR_FADE_MS);
				return () => {
					window.clearTimeout(done);
				};
			}, [
				state.introduce,
				ready,
				label,
				introduced
			]);
			if (!main) return null;
			const characters = Array.from(label);
			const stagger = introStaggerMs(characters.length);
			const shownLabel = introducing ? (0, react_jsx_runtime.jsx)("span", {
				className: AgentPresetSeat_module_css_default.introText,
				children: characters.map((character, index) => (0, react_jsx_runtime.jsx)("span", {
					className: AgentPresetSeat_module_css_default.introChar,
					style: { animationDelay: `${INTRO_TEXT_DELAY_MS + index * stagger}ms` },
					children: character
				}, index))
			}) : label;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [ready && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open: open && options.length > 0,
				onClose: () => {
					setOpen(false);
				},
				items: options.map((option) => {
					const text = presetDisplayText(option, t);
					return {
						id: option.id,
						label: (0, react_jsx_runtime.jsxs)("span", {
							className: AgentPresetSeat_module_css_default.item,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: AgentPresetSeat_module_css_default.itemName,
								children: text.name
							}), (0, react_jsx_runtime.jsx)("span", {
								className: AgentPresetSeat_module_css_default.itemDesc,
								children: text.description ?? t("noDescription")
							})]
						})
					};
				}),
				selectedId: state.current,
				onSelect: (id) => {
					setOpen(false);
					select(id);
				},
				align: "start",
				portal: true,
				className: AgentPresetSeat_module_css_default.menuAnchor,
				anchor: (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: AgentPresetSeat_module_css_default.seat,
					"aria-haspopup": "menu",
					"aria-expanded": open && options.length > 0,
					title: (typeof state.error === "object" ? state.error?.reason : state.error) ?? t("seatHint"),
					disabled: state.busy || options.length === 0,
					onClick: () => {
						setOpen((value) => !value);
					},
					children: [
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutlineRegular, { className: introducing ? `${AgentPresetSeat_module_css_default.seatIcon} ${AgentPresetSeat_module_css_default.introIcon}` : AgentPresetSeat_module_css_default.seatIcon }),
						(0, react_jsx_runtime.jsx)("span", {
							className: AgentPresetSeat_module_css_default.seatLabel,
							children: shownLabel
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: AgentPresetSeat_module_css_default.chevron })
					]
				})
			}), toast !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: t("switchRefused", {
					name: presetDisplayText(toast.error.preset, t).name,
					reason: toast.error.reason
				}),
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
				holdMs: REFUSAL_HOLD_MS,
				anchor: document.querySelector("[data-composer-card]"),
				onDone: () => {
					dismissRefusal(toast.error);
				}
			}, toast.seq)] });
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-agent-preset/src/client/PresetGuideDialog.module.css.mjs
		const css$1 = ".LSQftG_guideDialog{box-sizing:border-box;gap:0;width:min(640px,100%);height:min(600px,100%);max-height:100%;padding:0}.LSQftG_guideLayout{flex-direction:column;height:100%;min-height:0;display:flex}.LSQftG_guideHeader{flex:none;padding:24px 24px 20px 28px}.LSQftG_guideTitleRow{justify-content:space-between;align-items:center;gap:16px;display:flex}.LSQftG_guideTitle{margin:0;font-size:20px;font-weight:600;line-height:28px}.LSQftG_guideIntro{color:var(--dsw-alias-label-secondary);margin:8px 0 0;font-size:14px;line-height:22px}.LSQftG_guideClose{border-radius:var(--dsw-radius-md);width:32px;height:32px;min-height:32px;color:var(--dsw-alias-label-tertiary);padding:0}.LSQftG_guideTabs{flex:none;margin:0 28px 22px}.LSQftG_guidePanel{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);overscroll-behavior:contain;scrollbar-gutter:stable;min-height:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;flex:1;padding:0 24px 24px 28px;font-size:16px;overflow-y:auto}.LSQftG_guidePanel:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.LSQftG_guidePanel h3{margin:28px 0 10px;font-size:16px;font-weight:600;line-height:24px}.LSQftG_guidePanel h3:first-child{margin-top:0}.LSQftG_guidePanel p{color:var(--dsw-alias-label-primary);margin:0 0 16px;font-size:16px;line-height:1.625}.LSQftG_guidePanel blockquote{border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-module-platform);border:0;margin:10px 0 14px;padding:14px 16px}.LSQftG_guidePanel blockquote p{color:var(--dsw-alias-label-primary);margin:0}.LSQftG_guidePanel[data-guide-page=usage] p{color:var(--dsw-alias-label-secondary);margin-bottom:12px;font-size:14px;line-height:22px}.LSQftG_guidePanel[data-guide-page=usage] h3{margin:0}.LSQftG_guideExample+.LSQftG_guideExample{margin-top:28px}.LSQftG_guideExampleHeader{flex-wrap:wrap;align-items:center;gap:8px 10px;margin-bottom:8px;display:flex}.LSQftG_guideExampleTag{flex-shrink:0;gap:4px}.LSQftG_guidePanel[data-guide-page=usage] blockquote{margin:8px 0;padding:12px 16px}.LSQftG_guidePanel[data-guide-page=usage] blockquote p{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;line-height:26px}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-agent-preset/PresetGuideDialog.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-agent-preset";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var PresetGuideDialog_module_css_default = {
			"guideClose": "LSQftG_guideClose",
			"guideDialog": "LSQftG_guideDialog",
			"guideExample": "LSQftG_guideExample",
			"guideExampleHeader": "LSQftG_guideExampleHeader",
			"guideExampleTag": "LSQftG_guideExampleTag",
			"guideHeader": "LSQftG_guideHeader",
			"guideIntro": "LSQftG_guideIntro",
			"guideLayout": "LSQftG_guideLayout",
			"guidePanel": "LSQftG_guidePanel",
			"guideTabs": "LSQftG_guideTabs",
			"guideTitle": "LSQftG_guideTitle",
			"guideTitleRow": "LSQftG_guideTitleRow"
		};
		//#endregion
		//#region lib/types/client/PresetGuideDialog.js
		/** Read-only help stays local to Settings and never changes the selected preset. */
		const guides = new Map([
			["standard", {
				name: "presetStandardName",
				intro: "guideStandardIntro",
				explanation: "guideStandardExplanation",
				usage: "guideStandardUsage"
			}],
			["ptc", {
				name: "presetPtcName",
				intro: "guidePtcIntro",
				explanation: "guidePtcExplanation",
				usage: "guidePtcUsage"
			}],
			["minimal", {
				name: "presetMinimalName",
				intro: "guideMinimalIntro",
				explanation: "guideMinimalExplanation",
				usage: "guideMinimalUsage"
			}],
			["cordis", {
				name: "presetCordisName",
				intro: "guideCordisIntro",
				explanation: "guideCordisExplanation",
				usage: "guideCordisUsage"
			}]
		]);
		/**
		* Look up help only for known, shipped presets.
		* @param id - preset identifier from the roster.
		* @param trust - roster source; custom presets own their capability claims.
		* @returns the shipped guide, or undefined for unknown and custom presets.
		*/
		function presetGuide(id, trust) {
			return trust === "system" ? guides.get(id) : void 0;
		}
		/** Keep keyboard focus inside a preset reader while Tab moves through its controls.
		* @param event Keyboard event from the active reader.
		*/
		function trapPresetReaderTab(event) {
			if (event.key !== "Tab") return;
			const targets = Array.from(event.currentTarget.querySelectorAll("button:not([disabled]):not([tabindex=\"-1\"]), [tabindex=\"0\"]")).filter((element) => !element.closest("[hidden]"));
			const first = targets[0];
			const last = targets[targets.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		}
		/** Curated usage dictionaries contain only level-three example sections. */
		function GuideUsage({ text, t }) {
			const labels = {
				code: {
					copyLabel: t("guideCopy"),
					copiedLabel: t("guideCopied"),
					toolbarLabels: {
						codeLabel: t("codeBlock.title"),
						wrapLabel: t("codeBlock.wrap"),
						unwrapLabel: t("codeBlock.unwrap")
					}
				},
				footnotes: t("guideFootnotes")
			};
			return text.split(/(?=^### )/m).map((section) => {
				const headingEnd = section.indexOf("\n");
				const title = section.slice(4, headingEnd);
				return (0, react_jsx_runtime.jsxs)("section", {
					className: PresetGuideDialog_module_css_default.guideExample,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: PresetGuideDialog_module_css_default.guideExampleHeader,
						children: [(0, react_jsx_runtime.jsx)("h3", { children: title }), (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							tone: "neutral",
							className: PresetGuideDialog_module_css_default.guideExampleTag,
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutlineRegular, { size: 12 }), t("guideExampleTask")]
						})]
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
						text: section.slice(headingEnd + 1),
						labels
					})]
				}, title);
			});
		}
		/**
		* Open read-only help without changing the selected preset.
		* @param props - localized guide, initial page, and close callback.
		* @returns the modal reader with independent scroll positions for each page.
		*/
		function PresetGuideDialog({ guide, initialPage, t, onClose }) {
			const [page, setPage] = (0, react.useState)(initialPage);
			const guideId = (0, react.useId)();
			const content = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => {
				content.current?.querySelector("[role=\"tab\"][aria-selected=\"true\"]")?.focus();
			}, []);
			const onKeyDown = (event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					onClose();
				} else trapPresetReaderTab(event);
			};
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				headless: true,
				onClose,
				title: t(guide.name),
				className: PresetGuideDialog_module_css_default.guideDialog,
				children: (0, react_jsx_runtime.jsxs)("div", {
					ref: content,
					className: PresetGuideDialog_module_css_default.guideLayout,
					role: "presentation",
					onKeyDownCapture: onKeyDown,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: PresetGuideDialog_module_css_default.guideHeader,
							children: [(0, react_jsx_runtime.jsxs)("div", {
								className: PresetGuideDialog_module_css_default.guideTitleRow,
								children: [(0, react_jsx_runtime.jsx)("h2", {
									className: PresetGuideDialog_module_css_default.guideTitle,
									children: t(guide.name)
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									className: PresetGuideDialog_module_css_default.guideClose,
									"aria-label": t("close"),
									onClick: onClose,
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 18 })
								})]
							}), (0, react_jsx_runtime.jsx)("p", {
								className: PresetGuideDialog_module_css_default.guideIntro,
								children: t(guide.intro)
							})]
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SegmentedTabs, {
							className: PresetGuideDialog_module_css_default.guideTabs,
							label: t("guideSections"),
							value: page,
							onChange: setPage,
							items: [{
								value: "explanation",
								label: t("modeExplanation"),
								id: `${guideId}-explanation-tab`,
								panelId: `${guideId}-explanation-panel`
							}, {
								value: "usage",
								label: t("howToUse"),
								id: `${guideId}-usage-tab`,
								panelId: `${guideId}-usage-panel`
							}]
						}),
						["explanation", "usage"].map((section) => (0, react_jsx_runtime.jsx)("div", {
							id: `${guideId}-${section}-panel`,
							role: "tabpanel",
							"aria-labelledby": `${guideId}-${section}-tab`,
							className: PresetGuideDialog_module_css_default.guidePanel,
							"data-guide-page": section,
							hidden: page !== section,
							tabIndex: 0,
							children: section === "usage" ? (0, react_jsx_runtime.jsx)(GuideUsage, {
								text: t(guide.usage),
								t
							}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
								text: t(guide.explanation),
								labels: {
									code: {
										copyLabel: t("guideCopy"),
										copiedLabel: t("guideCopied"),
										toolbarLabels: {
											codeLabel: t("codeBlock.title"),
											wrapLabel: t("codeBlock.wrap"),
export {};
