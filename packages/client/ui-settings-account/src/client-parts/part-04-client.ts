/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc MẢNH DE-BUNDLE 5/N: lát NGUYÊN VĂN của @deepseek-ai/dsh-client-ui-settings-account/lib/client.js (tách theo dòng
 *      để giữ luật ≤1000 dòng/tệp; nối lại theo thứ tự tên tệp là ra bản gốc từng byte). KHÔNG sửa tay.
 */
// @ts-nocheck
			return (0, react_jsx_runtime.jsxs)("div", {
				className: `${DesktopOnboarding_module_css_default.content} ${DesktopOnboarding_module_css_default.process}`,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: DesktopOnboarding_module_css_default.copy,
						children: [(0, react_jsx_runtime.jsx)("h1", {
							id: "desktop-onboarding-title",
							ref: heading,
							tabIndex: -1,
							children: t("onboardingProcess")
						}), (0, react_jsx_runtime.jsx)("p", {
							className: DesktopOnboarding_module_css_default.subtitle,
							children: t("onboardingProcessDescription")
						})]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: DesktopOnboarding_module_css_default.processCards,
						role: "radiogroup",
						"aria-labelledby": "desktop-onboarding-title",
						children: options.map((option) => (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "radio",
							"data-process": option.value,
							"aria-checked": process === option.value,
							tabIndex: process === option.value || process === null && option.value === "compact" ? 0 : -1,
							className: `${DesktopOnboarding_module_css_default.card} ${process === option.value ? DesktopOnboarding_module_css_default.selected : ""}`,
							"aria-disabled": busy,
							onClick: () => {
								if (!busy) onSelect(option.value);
							},
							onKeyDown: (event) => {
								onKeyDown(event, option.value);
							},
							children: [
								(0, react_jsx_runtime.jsx)("span", {
									className: DesktopOnboarding_module_css_default.processIcon,
									children: (0, react_jsx_runtime.jsx)("img", {
										src: option.icon,
										width: option.size,
										height: option.size,
										alt: ""
									})
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: DesktopOnboarding_module_css_default.cardTitle,
									children: t(option.titleKey)
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: DesktopOnboarding_module_css_default.cardDescription,
									children: t(option.descriptionKey)
								})
							]
						}, option.value))
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: DesktopOnboarding_module_css_default.primaryAction,
						children: process !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: DesktopOnboarding_module_css_default.action,
							variant: "primary",
							"aria-disabled": busy,
							onClick: () => {
								if (!busy) onComplete();
							},
							children: t("onboardingEnter")
						})
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/OnboardingConfirmation.js
		/** Credit and setup confirmations with contained keyboard focus. */
		/** @param props - confirmation action, localized copy and navigation callbacks. @returns a focus-contained dialog. */
		function OnboardingConfirmation({ kind, t, busy, canRecharge, onClose, onContinueSetup, onContinue, onRecharge, onSkip }) {
			const credit = kind !== "skip";
			const title = t(credit ? "onboardingNoCreditTitle" : "onboardingSkipTitle");
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				headless: true,
				backdropBlur: false,
				title,
				onClose,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: DesktopOnboarding_module_css_default.confirmation,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: DesktopOnboarding_module_css_default.confirmationHeading,
							children: [(0, react_jsx_runtime.jsx)("h2", { children: title }), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: DesktopOnboarding_module_css_default.confirmationClose,
								"aria-label": t("close"),
								onClick: onClose,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
							})]
						}),
						(0, react_jsx_runtime.jsx)("p", { children: t(credit ? "onboardingNoCreditDescription" : "onboardingSkipDescription") }),
						(0, react_jsx_runtime.jsxs)("div", {
							className: DesktopOnboarding_module_css_default.confirmationActions,
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								className: DesktopOnboarding_module_css_default.dialogButton,
								variant: "outline",
								disabled: busy,
								onClick: kind === "credit-skip" ? onSkip : kind === "credit" ? onContinue : onContinueSetup,
								children: t(credit ? "onboardingUnderstood" : "onboardingKeepSetting")
							}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								className: DesktopOnboarding_module_css_default.dialogButton,
								variant: "primary",
								disabled: busy || credit && !canRecharge,
								onClick: credit ? onRecharge : onSkip,
								children: t(credit ? "onboardingGoTopUp" : "onboardingEnter")
							})]
						})
					]
				})
			});
		}
		//#endregion
		//#region lib/types/client/DesktopOnboarding.js
		const onboardingPages = {
			welcome: "onboarding_welcome",
			credit: "onboarding_recharge",
			purpose: "onboarding_use_case",
			process: "onboarding_process",
			done: void 0
		};
		/**
		* @param props - durable choices, account state, localized copy and the shared recharge page channel.
		* @returns the active first-run page.
		*/
		function DesktopOnboarding({ state, account, openPlatformPage, update, complete, retry, t, locale, track, exiting = false }) {
			const [dialog, setDialog] = (0, react.useState)(null);
			const heading = (0, react.useRef)(null);
			const page = (0, react.useRef)(null);
			const releaseRecharge = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => () => {
				releaseRecharge.current?.();
				releaseRecharge.current = void 0;
			}, []);
			const progress = state.progress;
			const targetStep = progress.step;
			const [step, setStep] = (0, react.useState)(targetStep);
			const busy = state.status === "loading" || state.status === "saving" || exiting || step !== targetStep;
			(0, react.useEffect)(() => {
				if (step === targetStep) return;
				const element = page.current;
				if (!state.visible || element?.animate === void 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
					setStep(targetStep);
					return;
				}
				const animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
					duration: 40,
					fill: "forwards",
					easing: "ease-out"
				});
				animation.finished.then(() => {
					setStep(targetStep);
				}, (_error) => {});
				return () => {
					animation.cancel();
				};
			}, [
				targetStep,
				step,
				state.visible
			]);
			(0, react.useEffect)(() => {
				heading.current?.focus();
			}, [step]);
			const pageName = onboardingPages[step];
			const shownPage = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!state.visible || pageName === void 0 || exiting) {
					shownPage.current = null;
					return;
				}
				if (state.status === "loading") return;
				if (shownPage.current === pageName) return;
				shownPage.current = pageName;
				track?.("onboarding_page_view", { page_name: pageName });
			}, [
				state.visible,
				state.status,
				step,
				pageName,
				exiting,
				track
			]);
			const shownPopup = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (dialog === null || !state.visible || state.status === "loading" || step === "done") {
					shownPopup.current = null;
					return;
				}
				if (shownPopup.current === dialog) return;
				shownPopup.current = dialog;
				track?.("onboarding_popup_view", { popup_name: dialog === "skip" ? "skip_setting" : "skip_charge" });
			}, [
				dialog,
				track,
				state.visible,
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
				for (const listener of listeners) listener();
			};
			const avatar = new AccountAvatarLoader((value) => {
				publish({
					...snapshot,
					avatar: value
				});
			});
			ctx.effect(() => () => {
				avatar.dispose();
			}, "account: profile picture lifetime");
			/** @returns the client identity for one account call, read at call time so it carries the language and zone in effect then. */
			const client = () => accountClientMetadata(ctx.locale.getSnapshot().active, "0.2.1-alpha.4");
			const notices = createBonusNoticeController({
				ackRetryDelayMs: config.bonusAckRetryDelayMs,
				ackRetryMaxDelayMs: config.bonusAckRetryMaxDelayMs,
				read: async () => {
					const result = await ctx.remote.account.getUnnotifiedBonuses(client());
					if (!result.ok) throw new Error("account bonus read failed");
					return result.value;
				},
				acknowledge: async (accountId, orderId) => {
					const result = await ctx.remote.account.ackBonusNotified(accountId, orderId, client());
					if (!result.ok) throw new Error("account bonus acknowledgement failed");
					return result.value;
				},
				publish: (notice) => {
					const { notice: _replaced, ...withoutNotice } = snapshot;
					publish(notice === null ? withoutNotice : {
						...withoutNotice,
						notice
					});
				}
			});
			ctx.effect(() => () => {
				notices.end();
			}, "account: bonus notice lifetime");
			let revision = 0;
			let refreshing;
			const refresh = () => {
				if (snapshot.view?.status !== "credential-stored") return Promise.resolve();
				if (refreshing !== void 0) return refreshing;
				const generation = revision;
				const read = async (field, query) => {
					let value;
					try {
						value = await query();
					} catch {
						value = { status: "failed" };
					}
					if (value?.status === "failed") console.error("[deepseek-account] account read failed", { field });
					if (generation === revision && value !== null) publish({
						...snapshot,
						details: {
							...snapshot.details,
							[field]: value
						}
					});
				};
				const request = Promise.all([read("profile", async () => {
					const result = await ctx.remote.account.getProfile(client());
					if (!result.ok) throw new Error("account profile failed");
					if (generation === revision && result.value?.status === "ready") avatar.setUrl(result.value.value.avatarUrl);
					return result.value;
				}), read("balance", async () => {
					const result = await ctx.remote.account.getBalance(client());
					if (!result.ok) throw new Error("account balance failed");
					return result.value;
				})]).then(() => void 0);
				refreshing = request;
				request.finally(() => {
					if (refreshing === request) refreshing = void 0;
				});
				return request;
			};
			ctx.effect(() => () => {
				revision++;
			}, "account: details request lifetime");
			const stream = ctx.remote.$stream({
				name: "account",
				open: (signal) => ctx.remote.account.watch(signal),
				ended: () => /* @__PURE__ */ new Error("account stream ended")
			});
			let disposed = false;
			ctx.effect(() => () => {
				disposed = true;
				return stream.dispose();
			}, "account: state stream");
			(async () => {
				for await (const frame of stream) {
					revision++;
					refreshing = void 0;
					avatar.reset();
					const initialize = frame.value.status === "credential-stored" && frame.value.attempt?.phase === "succeeded" && snapshot.view?.attempt?.phase !== "succeeded";
					const { notice, ...previous } = snapshot;
					publish({
						...previous,
						view: frame.value,
						details: void 0,
						avatar: void 0,
						failed: false,
						...frame.value.status === "credential-stored" && notice ? { notice } : {}
					});
					browser.update(frame.value);
					frame.accept();
					if (frame.value.status === "credential-stored") notices.begin();
					else notices.end();
					if (initialize) (async () => {
						try {
							if (!(await ctx.remote.session.initializeDefaultModel()).ok) console.error("[deepseek-account] default model initialization failed", { reason: "refused" });
						} catch (_error) {
							console.error("[deepseek-account] default model initialization failed", { reason: "disconnected" });
						}
					})();
					refresh();
				}
			})().catch(() => {
				if (!disposed) publish({
					...snapshot,
					failed: true
				});
			});
			const nativePlatform = globalThis.dshPlatform;
			const platformPages = createPlatformPages();
			ctx.effect(() => () => {
				platformPages.dispose();
			}, "account: platform page request");
			const refreshAccount = async () => {
				avatar.retry();
				await Promise.all([refresh(), notices.refresh()]);
			};
			/**
			* Narrow the shared channel to one surface's post-return read: only a viewer
			* returning from top-up re-reads, so a superseded page or a plugin teardown
			* never triggers account work.
			* @param reRead - that surface's read after a returned top-up page.
			* @returns the opener that surface injects.
			*/
			const platformPageOpener = (reRead) => (page, onClose) => platformPages.open(page, (reason) => {
				onClose(reason);
				if (reason === "returned" && page === "top-up") refreshAfterReturn(refreshing, reRead);
			});
			const operations = {
				avatarFailed: (value) => {
					avatar.failed(value);
				},
				subscribeSessionExpired: (listener) => ctx.remote.$on("deepseek-account/session-expired", listener),
				subscribeModelSignInRequired: (listener) => ctx.remote.$on("deepseek-account/model-sign-in-required", listener),
				...nativePlatform === void 0 ? {} : { openPlatformPage: platformPageOpener(refreshAccount) },
				refreshAccount,
				contactUs() {
					const profile = snapshot.details?.profile;
					const context = {
						uid: profile?.status === "ready" ? profile.value.id : null,
						version: "0.2.1-alpha.4",
						width: window.screen.width,
						height: window.screen.height,
						pixelRatio: window.devicePixelRatio
					};
					const openForm = (deviceInfo) => {
						window.open(contactUrl(config, {
							...context,
							deviceInfo
						}), "_blank", "noopener,noreferrer");
					};
					const readDeviceInfo = globalThis.dshDesktop?.deviceInfo;
					if (readDeviceInfo === void 0) {
						openForm(navigator.userAgent);
						return;
					}
					(async () => {
						let deviceInfo = "";
						try {
							deviceInfo = await readDeviceInfo();
						} catch (_error) {}
						openForm(deviceInfo);
					})();
				},
				showLogin(visible) {
					publish({
						...snapshot,
						loginVisible: visible
					});
				},
				setOnboarding(active) {
					publish({
						...snapshot,
						onboarding: active
					});
				},
				bonusNoticeShown(orderId) {
					notices.shown(orderId);
				},
				bonusNoticeDismissed(orderId) {
					notices.dismiss(orderId);
				},
				hooks: {
					account: {
						getSnapshot: () => snapshot,
						subscribe: (listener) => {
							listeners.add(listener);
							return () => {
								listeners.delete(listener);
							};
						}
					},
					theme: {
						getSnapshot: () => ctx.theme.getTheme(),
						subscribe: (listener) => ctx.on("theme/change", listener)
					}
				},
				async start() {
					publish({
						...snapshot,
						loginVisible: true,
						loginFailed: false
					});
					const transport = globalThis.__DSH_TRANSPORT__;
					const request = async () => {
						const result = await ctx.remote.account.startSignIn(client(), desktop && transport?.streamBaseUrl !== void 0 ? new URL(transport.streamBaseUrl).origin : window.location.origin, desktop ? "desktop" : "web");
						if (!result.ok) throw new Error("account start failed");
						return result.value;
					};
					try {
						if (desktop) await request();
						else await browser.start(request, () => snapshot.view);
					} catch (error) {
						publish({
							...snapshot,
							loginFailed: true
						});
						throw error;
					}
				},
				async cancel(id) {
					if (!(await ctx.remote.account.cancelSignIn(id)).ok) throw new Error("account cancel failed");
				},
				async hasRunningAccountTasks() {
					const result = await ctx.remote.account.hasRunningAccountTasks();
					if (!result.ok) throw new Error("account task query failed");
					return result.value;
				},
				async signOut() {
					const result = await ctx.remote.account.signOut(client());
					if (result.ok) return;
					throw result.error;
				}
			};
			if (desktop) {
				const controller = new DesktopOnboardingController(ctx.configForms.get(DESKTOP_ONBOARDING_NAMESPACE), ctx.configForms.get("ui-chat"), (enabled) => ctx.configForms.developerTools.setEnabled(enabled), operations.hooks.account, readOnboardingApiKeyPresence, ctx.configForms.describe());
				ctx.effect(() => () => {
					controller.dispose();
				}, "account: desktop onboarding lifetime");
				ctx.effect(() => {
					const refreshCredentials = () => {
						controller.invalidateCredentials();
					};
					const disposers = [
						ctx.remote.$on("credentials/reference-updated", refreshCredentials),
						ctx.remote.$on("llm/adapters-updated", refreshCredentials),
						ctx.configForms.describe().subscribe(refreshCredentials)
					];
					return () => {
						for (const dispose of disposers) dispose();
					};
				}, "account: desktop credential readiness");
				ctx.slots.inject("shell.overlay", () => ctx.slots.register({
					name: "shell.overlay",
					id: "desktop-onboarding",
					locale: "settings.account",
					inject: () => ({
						hooks: {
							account: operations.hooks.account,
							onboarding: controller.state
						},
						setVisible: (visible) => {
							if (snapshot.desktopOnboardingVisible !== visible) publish({
								...snapshot,
								desktopOnboardingVisible: visible
							});
						},
						...nativePlatform === void 0 ? {} : { openPlatformPage: platformPageOpener(refresh) },
						update: (change) => controller.update(change),
						complete: (reason) => controller.complete(reason),
						retry: () => controller.retry(),
						track: (name, attributes) => ctx.get("productAnalytics")?.track(name, attributes)
					})
				}, DesktopOnboardingEntry));
			}
			ctx.slots.inject("settings.models.sign-in", () => ctx.slots.register({
				name: "settings.models.sign-in",
				locale: "settings.account",
				inject: () => operations
			}, AccountOnboarding));
			ctx.slots.inject("shell.quota-notice", () => ctx.slots.register({
				name: "shell.quota-notice",
				locale: "settings.account",
				select: (owner) => owner.code === "ACCOUNT_QUOTA" ? owner : null,
				inject: () => ({
					hooks: {
						account: operations.hooks.account,
						platformPage: platformPages
					},
					...nativePlatform === void 0 ? {} : { openPlatformPage: platformPageOpener(refreshAccount) }
				})
			}, AccountQuotaNotice));
			if (nativePlatform !== void 0) ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "account.platform-page",
				locale: "settings.account",
				inject: () => ({
					platform: nativePlatform,
					hooks: { page: platformPages },
					closePage: platformPages.close
				})
			}, AccountPlatformHost));
			ctx.slots.inject("settings.launcher", () => ctx.slots.register({
				name: "settings.launcher",
				locale: "settings.account",
				inject: () => operations
			}, AccountMenu));
			ctx.slots.inject("settings.section", () => {
				let unregister;
				const update = () => {
					if (snapshot.view?.status === "credential-stored") unregister ??= ctx.slots.register({
						name: "settings.section",
						id: "account",
						order: -10,
						label: () => t("nav"),
						locale: "settings.account",
						inject: () => operations
					}, AccountSection);
					else {
						unregister?.();
						unregister = void 0;
					}
				};
				listeners.add(update);
				update();
				return () => {
					listeners.delete(update);
					unregister?.();
				};
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
