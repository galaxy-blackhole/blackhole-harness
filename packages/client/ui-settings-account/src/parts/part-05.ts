/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				const element = anchor.current;
				const update = () => {
					const rect = element.getBoundingClientRect();
					setPosition({
						left: Math.max(8, Math.min(rect.left, window.innerWidth - 268)),
						bottom: Math.max(8, window.innerHeight - rect.top + 4)
					});
				};
				update();
				const observer = new ResizeObserver(update);
				observer.observe(element);
				window.addEventListener("resize", update);
				window.addEventListener("scroll", update, true);
				return () => {
					observer.disconnect();
					window.removeEventListener("resize", update);
					window.removeEventListener("scroll", update, true);
				};
			}, [
				anchor,
				notice.orderId,
				notice.expiresAt
			]);
			(0, react.useEffect)(() => {
				if (position === void 0 || reported.current || !live(notice.expiresAt)) return;
				let cancel;
				const attempt = () => {
					if (reported.current || cancel !== void 0 || !live(notice.expiresAt)) return;
					if (document.visibilityState === "hidden") return;
					cancel = afterPaint(() => {
						cancel = void 0;
						if (reported.current || document.visibilityState === "hidden" || !live(notice.expiresAt)) return;
						reported.current = true;
						onShown(notice.orderId);
					});
				};
				attempt();
				document.addEventListener("visibilitychange", attempt);
				return () => {
					document.removeEventListener("visibilitychange", attempt);
					cancel?.();
				};
			}, [
				position,
				notice.orderId,
				notice.expiresAt,
				onShown
			]);
			if (!live(notice.expiresAt)) return null;
			return (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("aside", {
				className: AccountNotice_module_css_default.card,
				style: position ?? { visibility: "hidden" },
				children: [(0, react_jsx_runtime.jsxs)("div", {
					role: "status",
					className: AccountNotice_module_css_default.copy,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: AccountNotice_module_css_default.title,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: AccountNotice_module_css_default.icon,
							"aria-hidden": "true",
							children: (0, react_jsx_runtime.jsxs)("svg", {
								width: "14",
								height: "14",
								viewBox: "0 0 14 14",
								fill: "none",
								children: [(0, react_jsx_runtime.jsx)("path", {
									d: "M3.6355 6.93969C3.6355 4.8398 5.33779 3.1375 7.43768 3.1375C9.53757 3.1375 11.23987 4.8398 11.23987 6.93968V11.363H3.6355V6.93969Z",
									fill: "currentColor",
									fillOpacity: "0.2",
									stroke: "currentColor",
									strokeWidth: "0.875"
								}), (0, react_jsx_runtime.jsx)("path", {
									d: "M1.641 11.3645H12.36M5.053 13.3095H8.9479M7.4375 4.27422V2.70137912",
									stroke: "currentColor",
									strokeWidth: "0.875"
								})]
							})
						}), (0, react_jsx_runtime.jsx)("span", { children: title })]
					}), (0, react_jsx_runtime.jsx)("p", { children: notice.message })]
				}), (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: AccountNotice_module_css_default.close,
					"aria-label": closeLabel,
					onClick: () => {
						onDismiss(notice.orderId);
					},
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 10 })
				})]
			}), document.body);
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-account/src/client/AccountMenu.module.css.mjs
		const css$3 = ".yHnPSG_root{flex:1;min-width:0}.yHnPSG_anchor{width:100%}.yHnPSG_trigger{user-select:none;border-radius:var(--dsw-radius-md);width:100%;height:44px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border:0;align-items:center;gap:8px;padding:6px;font-size:14px;display:flex}.yHnPSG_trigger[data-collapsed=true]{box-sizing:border-box;justify-content:center;gap:0;width:36px;height:36px;padding:0}.yHnPSG_trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}.yHnPSG_avatar{corner-shape:round;background:var(--dsw-alias-bg-skeleton);width:24px;height:24px;color:var(--dsw-alias-label-tertiary);border-radius:50%;flex:none;justify-content:center;align-items:center;display:flex}.yHnPSG_label{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.yHnPSG_trigger[data-signed-out=true]:not([data-collapsed=true]){height:32px;padding:6px 2px 6px 6px;line-height:20px}.yHnPSG_signedOutMenu[role=menu]{min-width:124px;max-width:280px;padding:4px}.yHnPSG_signedOutMenu [role=menuitem]{border-radius:var(--dsw-radius-md);gap:8px;min-height:40px;padding:8px 10px;font-size:14px;line-height:22px}.yHnPSG_signedOutMenu [role=menuitem]>span:first-child:not(:last-child){width:16px;height:16px;color:var(--dsw-alias-menu-icon)}.yHnPSG_signedOutMenu [role=menuitem]>span:first-child:not(:last-child) svg{width:16px;height:16px}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-settings-account/AccountMenu.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-account";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var AccountMenu_module_css_default = {
			"anchor": "yHnPSG_anchor",
			"avatar": "yHnPSG_avatar",
			"label": "yHnPSG_label",
			"root": "yHnPSG_root",
			"signedOutMenu": "yHnPSG_signedOutMenu",
			"trigger": "yHnPSG_trigger"
		};
		//#endregion
		//#region lib/types/client/AccountMenu.js
		/** Sidebar account launcher and locally authoritative sign-out action. */
		/** The signed-in label stays empty while the profile loads.
		* @param props - sidebar geometry, settings navigation and account operations.
		* @returns account menu launcher.
		*/
		function AccountMenu({ subscribeSessionExpired, subscribeModelSignInRequired, wide, settingsShortcut, openSettings, openOnboarding, settingsOpen, useAccount, useTheme, signOut, hasRunningAccountTasks, refreshAccount, bonusNoticeShown, bonusNoticeDismissed, contactUs, showLogin, start, cancel, avatarFailed, t }) {
			const anchor = (0, react.useRef)(null);
			const settingsWasOpen = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (settingsOpen && !settingsWasOpen.current) refreshAccount();
				settingsWasOpen.current = settingsOpen;
			}, [refreshAccount, settingsOpen]);
			const account = useAccount((state) => state);
			const colorScheme = useTheme((snapshot) => snapshot.active.colorScheme);
			const signedIn = account.view?.status === "credential-stored";
			const [signInNotice, setSignInNotice] = (0, react.useState)(0);
			(0, react.useEffect)(() => subscribeModelSignInRequired?.(() => {
				setSignInNotice((value) => value + 1);
			}), [subscribeModelSignInRequired]);
			const [expiryNotice, setExpiryNotice] = (0, react.useState)(false);
			(0, react.useEffect)(() => subscribeSessionExpired?.(() => {
				setExpiryNotice(true);
			}), [subscribeSessionExpired]);
			const profile = account.details?.profile;
			const label = profile === void 0 ? null : profile.status === "ready" ? profile.value.name ?? profile.value.contact ?? t("signedIn") : t("signedIn");
			const [open, setOpen] = (0, react.useState)(false);
			const trigger = (0, react.useRef)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [signOutImpact, setSignOutImpact] = (0, react.useState)();
			const requestSignOut = async () => {
				setBusy(true);
				try {
					setSignOutImpact(await hasRunningAccountTasks());
					setOpen(false);
				} catch (_error) {
					setSignOutImpact("unknown");
					setOpen(false);
				} finally {
					setBusy(false);
				}
			};
			const beginSignIn = () => {
				setOpen(false);
				start().catch(() => void 0);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: anchor,
				className: AccountMenu_module_css_default.root,
				children: [
					signInNotice > 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
						text: t("modelSignInRequired"),
						onDone: () => {
							setSignInNotice(0);
						}
					}, signInNotice),
					expiryNotice && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
						text: t("sessionExpired"),
						onDone: () => {
							setExpiryNotice(false);
						}
					}),
					signedIn && !account.desktopOnboardingVisible && !account.onboarding && account.notice && (0, react_jsx_runtime.jsx)(AccountNoticeCard, {
						notice: account.notice,
						anchor,
						title: t("bonusNoticeTitle"),
						closeLabel: t("close"),
						onShown: bonusNoticeShown,
						onDismiss: bonusNoticeDismissed
					}, account.notice.orderId),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
						open,
						side: "top",
						portal: true,
						autoFocus: true,
						className: AccountMenu_module_css_default.anchor,
						listClassName: signedIn ? void 0 : AccountMenu_module_css_default.signedOutMenu,
						anchor: (0, react_jsx_runtime.jsxs)("button", {
							ref: trigger,
							type: "button",
							className: AccountMenu_module_css_default.trigger,
							"data-collapsed": !wide,
							"data-signed-out": !signedIn,
							"aria-label": t("menu"),
							"aria-haspopup": "menu",
							"aria-expanded": open,
							onClick: () => {
								setOpen((value) => !value);
							},
							children: [signedIn ? (0, react_jsx_runtime.jsx)("span", {
								className: AccountMenu_module_css_default.avatar,
								"data-avatar-status": account.avatar?.status,
								children: (0, react_jsx_runtime.jsx)(AccountAvatar, {
									avatar: account.avatar,
									avatarFailed
								})
							}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineMedium, { size: 14 }), wide && (0, react_jsx_runtime.jsx)("span", {
								className: AccountMenu_module_css_default.label,
								children: signedIn ? label : t("more")
							})]
						}),
						items: [
							{
								id: "settings",
								label: t("settings"),
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineMedium, { size: 16 }),
								...settingsShortcut === void 0 ? {} : { shortcut: settingsShortcut }
							},
							{
								id: "contact",
								label: t("contactUs"),
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPaperPlaneOutlineMedium, { size: 16 })
							},
							...signedIn ? [{
								id: "signout",
								label: t("signOut"),
								icon: (0, react_jsx_runtime.jsx)(LogoutIcon, {}),
								disabled: busy
							}] : [{
								id: "signin",
								label: t("signIn"),
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutlineMedium, { size: 16 })
							}]
						],
						onClose: () => {
							setOpen(false);
						},
						onSelect: (id) => {
							if (id === "settings") {
								setOpen(false);
								trigger.current?.focus();
								openSettings();
							} else if (id === "contact") {
								setOpen(false);
								contactUs();
							} else if (id === "signin") beginSignIn();
							else requestSignOut();
						}
					}),
					account.loginVisible && !account.onboarding && (0, react_jsx_runtime.jsx)(SignInDialog, {
						account,
						colorScheme,
						start,
						cancel,
						t,
						close: () => {
							showLogin(false);
						},
						useApiKey: () => {
							showLogin(false);
							openOnboarding("deepseek-official");
						}
					}),
					signedIn && signOutImpact !== void 0 && (0, react_jsx_runtime.jsx)(SignOutDialog, {
						running: signOutImpact,
						signOut,
						close: () => {
							setSignOutImpact(void 0);
						},
						t
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/platform-pages.js
		/**
		* One native Platform view for the whole account feature. The Account settings
		* page, the frame-wide quota notice, and the desktop onboarding recharge step
		* request a page here instead of mounting their own container, because the
		* Desktop host owns a single WebContentsView and its `open` destroys whatever
		* was showing before.
		*/
		/**
		* Create the plugin-scoped request channel shared by the account surfaces and
		* the one host that renders their pages. The snapshot store supplies the
		* observable and isolates a throwing subscriber from the rest.
		* @returns the request channel.
		*/
		function createPlatformPages() {
			const store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			let owner;
			let token = null;
			return {
				getSnapshot: () => store.getSnapshot(),
				subscribe: (listener) => store.subscribe(listener),
				open(page, onClose) {
					const previous = owner;
					const own = {};
					token = own;
					owner = onClose;
					store.set({ page });
					previous?.("superseded");
					return () => {
						if (token !== own) return;
						token = null;
						owner = void 0;
						store.set(null);
					};
				},
				close() {
					if (store.getSnapshot() === null) return;
					const retiring = owner;
					token = null;
					owner = void 0;
					store.set(null);
					retiring?.("returned");
				},
				dispose() {
					token = null;
					owner = void 0;
					if (store.getSnapshot() === null) return;
					store.set(null);
				}
			};
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/big.js@7.0.1/node_modules/big.js/big.mjs
		/************************************** EDITABLE DEFAULTS *****************************************/
		var DP = 20, RM = 1, MAX_DP = 1e6, MAX_POWER = 1e6, NE = -7, PE = 21, STRICT = false, NAME = "[big.js] ", INVALID = NAME + "Invalid ", INVALID_DP = INVALID + "decimal places", INVALID_RM = INVALID + "rounding mode", DIV_BY_ZERO = NAME + "Division by zero", P = {}, UNDEFINED = void 0, NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
		function _Big_() {
			function Big(n) {
				var x = this;
				if (!(x instanceof Big)) return n === UNDEFINED && arguments.length === 0 ? _Big_() : new Big(n);
				if (n instanceof Big) {
					x.s = n.s;
					x.e = n.e;
					x.c = n.c.slice();
				} else {
					if (typeof n !== "string") {
						if (Big.strict === true && typeof n !== "bigint") throw TypeError(INVALID + "value");
						n = n === 0 && 1 / n < 0 ? "-0" : String(n);
					}
					parse(x, n);
				}
				x.constructor = Big;
			}
			Big.prototype = P;
			Big.DP = DP;
			Big.RM = RM;
			Big.NE = NE;
			Big.PE = PE;
			Big.strict = STRICT;
			Big.roundDown = 0;
			Big.roundHalfUp = 1;
			Big.roundHalfEven = 2;
			Big.roundUp = 3;
			return Big;
		}
		function parse(x, n) {
			var e, i, nl;
			if (!NUMERIC.test(n)) throw Error(INVALID + "number");
			x.s = n.charAt(0) == "-" ? (n = n.slice(1), -1) : 1;
			if ((e = n.indexOf(".")) > -1) n = n.replace(".", "");
			if ((i = n.search(/e/i)) > 0) {
				if (e < 0) e = i;
				e += +n.slice(i + 1);
				n = n.substring(0, i);
			} else if (e < 0) e = n.length;
			nl = n.length;
			for (i = 0; i < nl && n.charAt(i) == "0";) ++i;
			if (i == nl) x.c = [x.e = 0];
			else {
				for (; nl > 0 && n.charAt(--nl) == "0";);
				x.e = e - i - 1;
				x.c = [];
				for (e = 0; i <= nl;) x.c[e++] = +n.charAt(i++);
			}
			return x;
		}
		function round(x, sd, rm, more) {
			var xc = x.c;
			if (rm === UNDEFINED) rm = x.constructor.RM;
			if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) throw Error(INVALID_RM);
			if (sd < 1) {
				more = rm === 3 && (more || !!xc[0]) || sd === 0 && (rm === 1 && xc[0] >= 5 || rm === 2 && (xc[0] > 5 || xc[0] === 5 && (more || xc[1] !== UNDEFINED)));
				xc.length = 1;
				if (more) {
					x.e = x.e - sd + 1;
					xc[0] = 1;
				} else xc[0] = x.e = 0;
			} else if (sd < xc.length) {
				more = rm === 1 && xc[sd] >= 5 || rm === 2 && (xc[sd] > 5 || xc[sd] === 5 && (more || xc[sd + 1] !== UNDEFINED || xc[sd - 1] & 1)) || rm === 3 && (more || !!xc[0]);
				xc.length = sd;
				if (more) for (; ++xc[--sd] > 9;) {
					xc[sd] = 0;
					if (sd === 0) {
						++x.e;
						xc.unshift(1);
						break;
export {};
