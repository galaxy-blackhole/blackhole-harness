/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				state.status,
				step
			]);
			const popupClick = (button_name) => {
				track?.("onboarding_popup_click", {
					popup_name: dialog === "skip" ? "skip_setting" : "skip_charge",
					button_name
				});
			};
			if (state.visible && state.status === "loading") return (0, react_jsx_runtime.jsx)(OnboardingSurface, { children: (0, react_jsx_runtime.jsx)("div", {
				className: DesktopOnboarding_module_css_default.loading,
				role: "status",
				children: t("onboardingLoading")
			}) });
			if (!state.visible || pageName === void 0) return null;
			const click = (button_name) => {
				const selected_content = step === "purpose" && progress.purpose !== null ? {
					office: "office",
					development: "code",
					both: "code_office"
				}[progress.purpose] : step === "process" && progress.process !== null ? {
					compact: "focus_result",
					standard: "key_detail",
					detailed: "full_process"
				}[progress.process] : void 0;
				track?.("onboarding_page_click", {
					page_name: pageName,
					button_name,
					...selected_content === void 0 ? {} : { selected_content }
				});
			};
			const go = (next) => {
				update({ step: next });
			};
			const canRecharge = openPlatformPage !== void 0;
			const recharge = () => {
				setDialog(null);
				releaseRecharge.current?.();
				releaseRecharge.current = openPlatformPage?.("top-up", () => {
					releaseRecharge.current = void 0;
				});
			};
			const later = () => {
				const balance = account.details?.balance;
				if (balance?.status === "ready" && !hasOnboardingCredit(balance)) setDialog("credit");
				else go("purpose");
			};
			const purposeNext = () => {
				if (progress.purpose === "office") complete("completed");
				else go("process");
			};
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(OnboardingSurface, {
				exiting,
				children: (0, react_jsx_runtime.jsxs)("section", {
					ref: page,
					className: `${DesktopOnboarding_module_css_default.page} ${dialog !== null ? DesktopOnboarding_module_css_default.blurred : ""}`,
					"data-desktop-onboarding": step,
					lang: locale,
					"aria-labelledby": "desktop-onboarding-title",
					"aria-busy": busy,
					children: [
						step === "welcome" && (0, react_jsx_runtime.jsx)(OnboardingWelcomeStep, {
							t,
							locale,
							heading,
							busy,
							onStart: () => {
								click("next");
								go("credit");
							}
						}),
						step === "credit" && (0, react_jsx_runtime.jsx)(OnboardingCreditStep, {
							t,
							locale,
							heading,
							busy,
							funded: state.creditFunded,
							canRecharge,
							onContinue: () => {
								click("continue");
								go("purpose");
							},
							onRecharge: () => {
								click("charge");
								recharge();
							},
							onLater: () => {
								click("later");
								later();
							}
						}),
						step === "purpose" && (0, react_jsx_runtime.jsx)(OnboardingPurposeStep, {
							t,
							heading,
							busy,
							purpose: progress.purpose,
							onSelect: (purpose) => {
								update({ purpose });
							},
							onContinue: () => {
								click("next");
								purposeNext();
							}
						}),
						step === "process" && (0, react_jsx_runtime.jsx)(OnboardingProcessStep, {
							t,
							heading,
							busy,
							process: progress.process,
							onSelect: (process) => {
								update({ process });
							},
							onComplete: () => {
								click("next");
								complete("completed");
							}
						}),
						state.error !== null && (0, react_jsx_runtime.jsxs)("div", {
							className: DesktopOnboarding_module_css_default.status,
							role: "alert",
							children: [t("onboardingSaveFailed"), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								disabled: busy,
								onClick: () => {
									retry();
								},
								children: t("onboardingRetry")
							})]
						}),
						step !== "welcome" && (0, react_jsx_runtime.jsxs)("footer", {
							className: DesktopOnboarding_module_css_default.navigation,
							children: [(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								disabled: busy,
								onClick: () => {
									click("back");
									go(step === "credit" ? "welcome" : step === "purpose" ? "credit" : "purpose");
								},
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: DesktopOnboarding_module_css_default.backIcon,
									style: { maskImage: `url(data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjIwLjI3OTIiIGhlaWdodD0iMTYuODI1IiB2aWV3Qm94PSIwIDAgMjAuMjc5MiAxNi44MjUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGlkPSJWZWN0b3IgNTAwOCIgZD0iTTEuMDE5ODYgOC41ODk1OEgyMC4yNzkyTTguNTQzMDMgMC40MDc2NTZMMC44MjU1NTQgOC41ODk1OEw4LjU0MzAzIDE2LjQwNzciIHN0cm9rZT0iIzgxODU4QyIgc3Ryb2tlLXdpZHRoPSIxLjE4ODIzIi8+Cjwvc3ZnPgo=)` },
									"aria-hidden": "true"
								}), t("onboardingBack")]
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: busy,
								onClick: () => {
									click("skip");
									setDialog(step === "credit" ? "credit-skip" : "skip");
								},
								children: t("onboardingSkip")
							})]
						})
					]
				}, step)
			}), dialog !== null && (0, react_jsx_runtime.jsx)(OnboardingConfirmation, {
				kind: dialog,
				t,
				busy,
				canRecharge,
				onClose: () => {
					popupClick("close");
					setDialog(null);
				},
				onContinueSetup: () => {
					popupClick("setting");
					setDialog(null);
				},
				onContinue: () => {
					popupClick("know");
					setDialog(null);
					go("purpose");
				},
				onRecharge: () => {
					popupClick("charge");
					recharge();
				},
				onSkip: () => {
					popupClick(dialog === "skip" ? "enter" : "know");
					complete("skipped").then(() => {
						setDialog(null);
					});
				}
			})] });
		}
		//#endregion
		//#region lib/types/client/DesktopOnboardingEntry.js
		/** Framework-hook projection into the desktop introduction's pure view. */
		/**
		* Read shared state through framework hooks; sessions do not control activation.
		* @param props - shell overlay bindings and account-owned actions.
		* @returns the unfinished flow, retained briefly after successful completion unless motion is reduced.
		*/
		function DesktopOnboardingEntry({ useOnboarding, useAccount, setVisible, ...props }) {
			const locale = props.t("onboardingArtworkLocale");
			const state = useOnboarding((value) => value);
			const account = useAccount((value) => value);
			(0, react.useLayoutEffect)(() => {
				if (!state.visible) return;
				const bridge = globalThis.dshOnboarding;
				bridge?.setActive(true);
				return () => {
					bridge?.setActive(false);
				};
			}, [state.visible]);
			const [lastVisible, setLastVisible] = (0, react.useState)(state.visible ? state : null);
			const done = !state.visible && state.progress.step === "done" && account.view?.status === "credential-stored";
			const pendingCompletion = done && state.status === "saving";
			const completed = done && state.status === "ready";
			const exiting = completed && lastVisible !== null && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			(0, react.useLayoutEffect)(() => {
				if (state.visible) setLastVisible(state);
				else if (!completed && !pendingCompletion) setLastVisible(null);
			}, [
				state,
				completed,
				pendingCompletion
			]);
			(0, react.useEffect)(() => {
				if (!exiting) return;
				const timer = window.setTimeout(() => {
					setLastVisible(null);
				}, 180);
				return () => {
					window.clearTimeout(timer);
				};
			}, [exiting]);
			const displayed = state.visible ? state : exiting || pendingCompletion ? lastVisible : null;
			const visible = displayed !== null || state.status === "loading";
			(0, react.useLayoutEffect)(() => {
				setVisible(visible);
			}, [setVisible, visible]);
			if (displayed === null) return state.status === "loading" ? (0, react_jsx_runtime.jsx)(OnboardingSurface, { children: (0, react_jsx_runtime.jsx)("div", {
				role: "status",
				children: props.t("onboardingLoading")
			}) }) : null;
			return (0, react_jsx_runtime.jsx)(DesktopOnboarding, {
				...props,
				locale,
				state: pendingCompletion ? {
					...displayed,
					status: "saving"
				} : displayed,
				account,
				exiting
			});
		}
		//#endregion
		//#region lib/types/client/onboarding-credentials.js
		/** Desktop login owns model-credential discovery for both welcome and onboarding. */
		/**
		* Read the same safe credential fact used by native login.
		* @returns configured API-key presence; rejects when the desktop bridge is unavailable.
		*/
		async function readOnboardingApiKeyPresence() {
			const bridge = globalThis.dshOnboarding;
			if (bridge === void 0) throw new Error("desktop login bridge unavailable");
			return bridge.hasApiKey();
		}
		//#endregion
		//#region lib/types/client/account-refresh.js
		/** Refresh ordering for returning from an external account operation. */
		/**
		* Wait for the pre-return read, then request a fresh account snapshot.
		* @param pending - query already running before the user returned.
		* @param refresh - account owner's normal refresh operation.
		* @returns settlement of the new query, independent of the older query's outcome.
		*/
		async function refreshAfterReturn(pending, refresh) {
			try {
				await pending;
			} catch (_error) {}
			await refresh();
		}
		//#endregion
		//#region lib/types/client/account-avatar.js
		/** One account picture load shared by the sidebar and Settings for this plugin lifetime. */
		/** Owns the browser image and discards callbacks after URL replacement or plugin unload. */
		var AccountAvatarLoader = class {
			publish;
			snapshot;
			image;
			disposed = false;
			/** @param publish - publishes picture changes through the account snapshot. */
			constructor(publish) {
				this.publish = publish;
			}
			/**
			* Load a changed URL once; an absent or empty URL clears the picture.
			* @param url - latest successful profile's picture, absent when no picture is available.
			*/
			setUrl(url) {
				if (this.disposed) return;
				const source = url || void 0;
				if (this.snapshot?.url === source) return;
				if (source === void 0) {
					this.detach();
					this.update(void 0);
				} else this.load(source);
			}
			/** Retry a failed picture once; successful and pending loads remain shared. */
			retry() {
				if (!this.disposed && this.snapshot?.status === "failed") this.load(this.snapshot.url);
			}
			/**
			* Return both surfaces to fallback when a rendered picture fails.
			* @param snapshot - picture attempt rendered by the failing element; superseded attempts are ignored.
			*/
			failed(snapshot) {
				if (this.disposed || this.snapshot !== snapshot || snapshot.status !== "ready") return;
				this.detach();
				this.update({
					url: snapshot.url,
					status: "failed"
				});
			}
			/** Release the picture without publishing; the owner publishes an empty avatar with the replacement account frame. */
			reset() {
				this.detach();
				this.snapshot = void 0;
			}
			/** Release the browser image and prevent further loads or publications. */
			dispose() {
				this.disposed = true;
				this.reset();
			}
			load(url) {
				this.detach();
				const image = new Image();
				this.image = image;
				image.referrerPolicy = "no-referrer";
				const settle = (status) => {
					if (this.image !== image) return;
					image.onload = null;
					image.onerror = null;
					this.update({
						url,
						status
					});
				};
				image.onload = () => {
					settle("ready");
				};
				image.onerror = () => {
					settle("failed");
				};
				this.update({
					url,
					status: "loading"
				});
				if (this.image === image) image.src = url;
			}
			update(snapshot) {
				this.snapshot = snapshot;
				this.publish(snapshot);
			}
			detach() {
				const image = this.image;
				this.image = void 0;
				if (image === void 0) return;
				image.onload = null;
				image.onerror = null;
				image.removeAttribute("src");
			}
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Services required by account settings. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.account",
			"remote.session",
			"theme",
			"configForms"
		];
		/** Register account UI in Desktop and plain Web clients. @param ctx - client plugin context. */
		function apply(ctx) {
			const desktop = "dshDesktop" in globalThis;
			ctx.effect(() => ctx.locale.register("settings.account", {
				en,
				zh
			}), "account: dictionaries");
			const t = ctx.locale.bind("settings.account");
			const config = ContactConfig(globalThis["__DSH_CONTACT_CONFIG__"] ?? {});
			let snapshot = {
				view: void 0,
				details: void 0,
				avatar: void 0,
				failed: false,
				loginVisible: false,
				desktopOnboardingVisible: desktop
			};
			const browser = new BrowserLogin((url) => authorizeUrlWithTheme(url, ctx.theme.getTheme().active.colorScheme));
			ctx.effect(() => () => {
				browser.dispose();
			}, "account: pending browser window");
			const listeners = /* @__PURE__ */ new Set();
			const publish = (value) => {
				snapshot = value;
export {};
