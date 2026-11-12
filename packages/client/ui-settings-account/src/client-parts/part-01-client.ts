/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc MẢNH DE-BUNDLE 2/N: lát NGUYÊN VĂN của @deepseek-ai/dsh-client-ui-settings-account/lib/client.js (tách theo dòng
 *      để giữ luật ≤1000 dòng/tệp; nối lại theo thứ tự tên tệp là ra bản gốc từng byte). KHÔNG sửa tay.
 */
// @ts-nocheck
			return url.href;
		}
		//#endregion
		//#region lib/types/client/authorize-url.js
		/** Platform authorization links that carry the active application palette into the login page. */
		/**
		* Add the resolved application palette to a Platform authorization link without
		* dropping any parameter the Host already put on it.
		* @param authorizeUrl - authorization URL of the current account attempt.
		* @param colorScheme - resolved scheme of the active application theme.
		* @returns the authorization URL carrying `theme=light` or `theme=dark`.
		*/
		function authorizeUrlWithTheme(authorizeUrl, colorScheme) {
			const url = new URL(authorizeUrl);
			url.searchParams.set("theme", colorScheme);
			return url.href;
		}
		//#endregion
		//#region lib/types/client/browser-login.js
		/** Keeps a preopened browser tab separate from Host authorization state. */
		var BrowserLogin = class {
			destination;
			popup = null;
			navigated = false;
			attempt;
			/** @param destination - maps the Host authorization URL to the page the tab opens, read when the tab navigates. */
			constructor(destination) {
				this.destination = destination;
			}
			/**
			* Preopen a tab and bind it to the attempt returned by the Host.
			* @param request - authenticated Host start request.
			* @param latest - most recent streamed state, including frames received before the response.
			* @returns after this UI is following the new attempt.
			*/
			async start(request, latest) {
				this.begin();
				try {
					this.follow(await request());
					this.update(latest());
				} catch (error) {
					this.dispose();
					throw error;
				}
			}
			/** Preopen a tab during the user's click; blocked popups need the copy-link route. */
			begin() {
				this.dispose();
				this.popup = window.open("about:blank", "_blank");
				if (this.popup) this.popup.opener = null;
			}
			/**
			* Bind the preopened tab to its Host attempt.
			* @param view - initial RPC response identifying this UI's attempt.
			*/
			follow(view) {
				this.attempt = view.attempt?.id;
				this.update(view);
			}
			/**
			* Navigate or close the pending tab when its attempt changes.
			* @param view - latest Host state.
			*/
			update(view) {
				const attempt = view?.attempt;
				if (attempt?.id !== this.attempt) return;
				if (attempt && [
					"failed",
					"expired",
					"cancelled"
				].includes(attempt.phase)) {
					this.dispose();
					return;
				}
				if (attempt?.phase === "succeeded") {
					if (!this.navigated) this.popup?.close();
					this.popup = null;
					this.attempt = void 0;
					return;
				}
				if (!attempt?.authorizeUrl || this.navigated) return;
				this.navigated = true;
				if (this.popup && !this.popup.closed) this.popup.location.replace(this.destination(attempt.authorizeUrl));
			}
			/** Close the owned authorization tab and stop following its attempt. */
			dispose() {
				this.popup?.close();
				this.popup = null;
				this.attempt = void 0;
				this.navigated = false;
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-account/src/client/SignInDialog.module.css.mjs
		const css$7 = "._76YFJG_dialog{user-select:none;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-inverted)}._76YFJG_content{flex-direction:column;width:100%;display:flex}._76YFJG_header{justify-content:space-between;align-items:center;gap:8px;padding:22px 24px 12px;display:flex}._76YFJG_title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px}._76YFJG_close{box-sizing:border-box;border-radius:var(--dsw-radius-sm);width:28px;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:0;flex:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}._76YFJG_close:hover{background:var(--dsw-alias-interactive-bg-hover)}._76YFJG_actions{box-sizing:border-box;justify-content:flex-end;align-items:center;gap:8px;width:100%;padding:0 24px;display:flex}._76YFJG_primaryButton,._76YFJG_secondaryButton{box-sizing:border-box;border-radius:var(--dsw-radius-md);min-width:72px;height:36px;font-size:14px;line-height:22px}._76YFJG_primaryButton{padding:0 16px;font-weight:500}._76YFJG_secondaryButton{border:.5px solid var(--dsw-alias-border-l2);padding:0 14px}._76YFJG_description{color:var(--dsw-alias-label-primary);margin:0;padding:0 24px;font-size:14px;line-height:22px}._76YFJG_link{color:inherit;font:inherit;cursor:pointer;background:0 0;border:0;padding:0;text-decoration:underline}._76YFJG_spinner{flex:none;animation:1s linear infinite _76YFJG_spin}._76YFJG_primaryButton:has(._76YFJG_spinner){opacity:1}@keyframes _76YFJG_spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){._76YFJG_spinner{animation:none}}";
		const tagId$7 = "@deepseek-ai/dsh-client-ui-settings-account/SignInDialog.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-account";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var SignInDialog_module_css_default = {
			"actions": "_76YFJG_actions",
			"close": "_76YFJG_close",
			"content": "_76YFJG_content",
			"description": "_76YFJG_description",
			"dialog": "_76YFJG_dialog",
			"header": "_76YFJG_header",
			"link": "_76YFJG_link",
			"primaryButton": "_76YFJG_primaryButton",
			"secondaryButton": "_76YFJG_secondaryButton",
			"spin": "_76YFJG_spin",
			"spinner": "_76YFJG_spinner",
			"title": "_76YFJG_title"
		};
		//#endregion
		//#region lib/types/client/SignInDialog.js
		/** Account authorization dialog; errors allow retry after cancelling any active attempt. */
		/** @param props - safe account state, localized copy, and user actions. @returns login dialog. */
		function SignInDialog({ account, colorScheme, start, cancel, close, useApiKey, t }) {
			const [busy, setBusy] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			const [copyResult, setCopyResult] = (0, react.useState)(null);
			const attempt = account.view?.attempt;
			(0, react.useEffect)(() => {
				setCopyResult(null);
			}, [attempt?.id, attempt?.authorizeUrl]);
			(0, react.useEffect)(() => {
				if (copyResult === null) return;
				const timer = setTimeout(() => {
					setCopyResult(null);
				}, 2e3);
				return () => {
					clearTimeout(timer);
				};
			}, [copyResult]);
			const authorizeUrl = attempt?.authorizeUrl;
			const phase = attempt?.phase;
			const active = busy || phase === "initializing" || phase === "waiting-browser" || phase === "exchanging" || phase === "committing";
			const expired = phase === "expired";
			const localFailure = failed || account.loginFailed || account.failed;
			const error = localFailure || phase === "failed";
			const failureKey = !localFailure && phase === "failed" && attempt?.errorCode === "no-response" ? "noResponse" : "failed";
			const waiting = active && !error;
			const committing = phase === "committing";
			(0, react.useEffect)(() => {
				if (account.view?.status === "credential-stored") close();
			}, [account.view?.status, close]);
			const run = async (action) => {
				setBusy(true);
				setFailed(false);
				try {
					await action();
				} catch {
					setFailed(true);
				} finally {
					setBusy(false);
				}
			};
			const dismiss = () => {
				if (committing || busy) return;
				if (active && attempt) run(async () => {
					await cancel(attempt.id);
					close();
				});
				else close();
			};
			const retry = async () => {
				if (active && attempt) await cancel(attempt.id);
				await start();
			};
			const copyLink = async (authorizeUrl) => {
				try {
					await navigator.clipboard.writeText(authorizeUrlWithTheme(authorizeUrl, colorScheme));
					setCopyResult({ messageKey: "copiedLink" });
				} catch {
					setCopyResult({ messageKey: "copyFailed" });
				}
			};
			const title = error ? t("failureTitle") : active ? t("browserTitle") : expired ? t("timeoutTitle") : t("loginTitle");
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				headless: true,
				title,
				onClose: dismiss,
				className: SignInDialog_module_css_default.dialog,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: SignInDialog_module_css_default.content,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: SignInDialog_module_css_default.header,
						children: [(0, react_jsx_runtime.jsx)("h2", {
							className: SignInDialog_module_css_default.title,
							children: title
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: SignInDialog_module_css_default.close,
							"aria-label": t("close"),
							onClick: dismiss,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
						})]
					}), waiting ? (0, react_jsx_runtime.jsxs)("p", {
						className: SignInDialog_module_css_default.description,
						children: [
							t("browserPrompt"),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SignInDialog_module_css_default.link,
								disabled: !authorizeUrl,
								onClick: authorizeUrl ? () => {
									copyLink(authorizeUrl);
								} : void 0,
								children: t(copyResult?.messageKey ?? "copyLink")
							}),
							t("browserDescription")
						]
					}) : (0, react_jsx_runtime.jsx)("p", {
						className: SignInDialog_module_css_default.description,
						children: error ? t(failureKey) : expired ? t("timeoutDescription") : t("loginDescription")
					})]
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: SignInDialog_module_css_default.actions,
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						className: SignInDialog_module_css_default.secondaryButton,
						disabled: committing || busy,
						onClick: active ? dismiss : useApiKey,
						children: t(active ? "cancel" : "addApiKey")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: SignInDialog_module_css_default.primaryButton,
						disabled: busy || committing || waiting || account.view === void 0,
						"aria-label": waiting ? t("waiting") : void 0,
						onClick: () => {
							run(retry);
						},
						children: waiting ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutlineRegular, { className: SignInDialog_module_css_default.spinner }) : t(expired || error ? "retry" : "signIn")
					})]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/AccountOnboarding.js
		/** Account choice inside the model credential onboarding step. */
		/** @param props - onboarding completion, account state and actions. @returns account dialog while signed out. */
		function AccountOnboarding({ complete, useApiKey, useAccount, useTheme, setOnboarding, showLogin, start, cancel, t }) {
			const account = useAccount((value) => value);
			const colorScheme = useTheme((snapshot) => snapshot.active.colorScheme);
			(0, react.useEffect)(() => {
				setOnboarding(true);
				return () => {
					setOnboarding(false);
				};
			}, [setOnboarding]);
			(0, react.useEffect)(() => {
				if (account.view?.status === "credential-stored") complete();
			}, [account.view?.status, complete]);
			if (!account.view || account.view.status === "credential-stored") return null;
			return (0, react_jsx_runtime.jsx)(SignInDialog, {
				account,
				colorScheme,
				start,
				cancel,
				t,
				close: () => {
					showLogin(false);
					complete();
				},
				useApiKey: () => {
					showLogin(false);
					useApiKey();
				}
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-account/src/client/PlatformOverlay.module.css.mjs
		const css$6 = "._44HXVa_overlay{z-index:1001;background:var(--dsw-alias-bg-base);flex-direction:column;display:flex;position:fixed;inset:0}[data-windows-titlebar] ._44HXVa_overlay{padding-top:var(--dsh-windows-titlebar-height)}._44HXVa_header{-webkit-app-region:initial;box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l1);flex:none;height:48px;padding:6px 16px}._44HXVa_controls{align-items:center;gap:24px;padding-top:5px;display:flex}._44HXVa_trafficLights{flex:none;width:60.667px;height:14px;display:none}html[data-platform=darwin] ._44HXVa_trafficLights{display:block}._44HXVa_back{box-sizing:border-box;border-radius:var(--dsw-radius-sm);height:28px;color:var(--dsw-alias-label-secondary);font:inherit;white-space:nowrap;cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;gap:8px;padding:0 6px;font-size:14px;line-height:22px;display:inline-flex}._44HXVa_viewport{min-height:0;color:var(--dsw-alias-label-secondary);flex:1;position:relative}._44HXVa_status{flex-direction:column;justify-content:center;align-items:center;gap:16px;display:flex;position:absolute;inset:0}._44HXVa_failure{color:var(--dsw-alias-label-tertiary);text-align:center;font-size:14px;line-height:22px}._44HXVa_retry._44HXVa_retry{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);min-width:58px;height:32px;padding:0 12px;font-size:13px;font-weight:400;line-height:20px}._44HXVa_spinner{width:24px;height:24px;animation:1s linear infinite _44HXVa_spin;position:relative}._44HXVa_spinner:before{content:\"\";background:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkiIGhlaWdodD0iMjIiIHZpZXdCb3g9IjAgMCAxOSAyMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgY2xpcC1wYXRoPSJ1cmwoI3BhaW50MF9hbmd1bGFyXzI5ODhfMzIzMjlfY2xpcF9wYXRoKSIgZGF0YS1maWdtYS1za2lwLXBhcnNlPSJ0cnVlIj48ZyB0cmFuc2Zvcm09Im1hdHJpeCgwLjAwNjk1MDQ4IDAuMDA2OTUwNDggLTAuMDA2OTUwNDggMC4wMDY5NTA0OCAxMC44Nzk3IDEwLjg3OTMpIj48Zm9yZWlnbk9iamVjdCB4PSItMTg2Ny40MiIgeT0iLTE4NjcuNDIiIHdpZHRoPSIzNzM0Ljg1IiBoZWlnaHQ9IjM3MzQuODUiPjxkaXYgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwiIHN0eWxlPSJiYWNrZ3JvdW5kOmNvbmljLWdyYWRpZW50KGZyb20gOTBkZWcscmdiYSgyNDYsIDI0NiwgMjQ2LCAwLjk5NDMpIDBkZWcscmdiYSgwLCAwLCAwLCAwLjgzKSAyNzMuMDI3ZGVnLHJnYmEoMCwgMCwgMCwgMCkgMjg3LjY5NGRlZyxyZ2JhKDI1NSwgMjU1LCAyNTUsIDEpIDM1MC40OTdkZWcscmdiYSgyNDYsIDI0NiwgMjQ2LCAwLjk5NDMpIDM2MGRlZyk7aGVpZ2h0OjEwMCU7d2lkdGg6MTAwJTtvcGFjaXR5OjAuNSI+PC9kaXY+PC9mb3JlaWduT2JqZWN0PjwvZz48L2c+PHBhdGggZD0iTTMuMTg2MjcgMTguNTcyMkMtMS4wNjIwOSAxNC4zMjM2IC0xLjA2MjA5IDcuNDM1MDIgMy4xODYyNyAzLjE4NjM5QzcuNDM0ODggLTEuMDYyMjIgMTQuMzIzMyAtMS4wNjIwNSAxOC41NzIxIDMuMTg2MzlMMTcuMDg3OCA0LjY3MDdDMTMuNjU5MSAxLjI0MjM2IDguMTAwMTEgMS4yNDMyMiA0LjY3MTYxIDQuNjcxNzNDMS4yNDMzNSA4LjEwMDI2IDEuMjQzMzUgMTMuNjU4MyA0LjY3MTYxIDE3LjA4NjhDOC4xMDAxMSAyMC41MTUzIDEzLjY1OTEgMjAuNTE2MiAxNy4wODc4IDE3LjA4NzlMMTguNTcyMSAxOC41NzIyQzE0LjMyMzMgMjIuODIwNiA3LjQzNDg4IDIyLjgyMDggMy4xODYyNyAxOC41NzIyWiIgZGF0YS1maWdtYS1ncmFkaWVudC1maWxsPSJ7JiMzNDt0eXBlJiMzNDs6JiMzNDtHUkFESUVOVF9BTkdVTEFSJiMzNDssJiMzNDtzdG9wcyYjMzQ7Olt7JiMzNDtjb2xvciYjMzQ7OnsmIzM0O3ImIzM0OzowLjAsJiMzNDtnJiMzNDs6MC4wLCYjMzQ7YiYjMzQ7OjAuMCwmIzM0O2EmIzM0OzowLjgyOTk5OTk4MzMxMDY5OTQ2fSwmIzM0O3Bvc2l0aW9uJiMzNDs6MC43NTg0MDg3MjUyNjE2ODgyM30seyYjMzQ7Y29sb3ImIzM0Ozp7JiMzNDtyJiMzNDs6MC4wLCYjMzQ7ZyYjMzQ7OjAuMCwmIzM0O2ImIzM0OzowLjAsJiMzNDthJiMzNDs6MC4wfSwmIzM0O3Bvc2l0aW9uJiMzNDs6MC43OTkxNDk2OTIwNTg1NjMyM30seyYjMzQ7Y29sb3ImIzM0Ozp7JiMzNDtyJiMzNDs6MS4wLCYjMzQ7ZyYjMzQ7OjEuMCwmIzM0O2ImIzM0OzoxLjAsJiMzNDthJiMzNDs6MS4wfSwmIzM0O3Bvc2l0aW9uJiMzNDs6MC45NzM2MDE4MTgwODQ3MTY4MH1dLCYjMzQ7dHJhbnNmb3JtJiMzNDs6eyYjMzQ7bTAwJiMzNDs6MTMuOTAwOTUzMjkyODQ2NjgwLCYjMzQ7bTAxJiMzNDs6LTEzLjkwMDk1MzI5Mjg0NjY4MCwmIzM0O20wMiYjMzQ7OjEwLjg3OTY3Nzc3MjUyMTk3MywmIzM0O20xMCYjMzQ7OjEzLjkwMDk1NDI0NjUyMDk5NiwmIzM0O20xMSYjMzQ7OjEzLjkwMDk1NDI0NjUyMDk5NiwmIzM0O20xMiYjMzQ7Oi0zLjAyMTY2NzAwMzYzMTU5MTh9LCYjMzQ7b3BhY2l0eSYjMzQ7OjAuNTAsJiMzNDtibGVuZE1vZGUmIzM0OzomIzM0O05PUk1BTCYjMzQ7LCYjMzQ7c3RvcHNWYXImIzM0OzpbeyYjMzQ7Y29sb3ImIzM0Ozp7JiMzNDtyJiMzNDs6MC4wLCYjMzQ7ZyYjMzQ7OjAuMCwmIzM0O2ImIzM0OzowLjAsJiMzNDthJiMzNDs6MC44Mjk5OTk5ODMzMTA2OTk0Nn0sJiMzNDtwb3NpdGlvbiYjMzQ7OjAuNzU4NDA4NzI1MjYxNjg4MjN9LHsmIzM0O2NvbG9yJiMzNDs6eyYjMzQ7ciYjMzQ7OjAuMCwmIzM0O2cmIzM0OzowLjAsJiMzNDtiJiMzNDs6MC4wLCYjMzQ7YSYjMzQ7OjAuMH0sJiMzNDtwb3NpdGlvbiYjMzQ7OjAuNzk5MTQ5NjkyMDU4NTYzMjN9LHsmIzM0O2NvbG9yJiMzNDs6eyYjMzQ7ciYjMzQ7OjEuMCwmIzM0O2cmIzM0OzoxLjAsJiMzNDtiJiMzNDs6MS4wLCYjMzQ7YSYjMzQ7OjEuMH0sJiMzNDtwb3NpdGlvbiYjMzQ7OjAuOTczNjAxODE4MDg0NzE2ODB9XSwmIzM0O3Zpc2libGUmIzM0Ozp0cnVlfSIvPgo8ZGVmcz4KPGNsaXBQYXRoIGlkPSJwYWludDBfYW5ndWxhcl8yOTg4XzMyMzI5X2NsaXBfcGF0aCI+PHBhdGggZD0iTTMuMTg2MjcgMTguNTcyMkMtMS4wNjIwOSAxNC4zMjM2IC0xLjA2MjA5IDcuNDM1MDIgMy4xODYyNyAzLjE4NjM5QzcuNDM0ODggLTEuMDYyMjIgMTQuMzIzMyAtMS4wNjIwNSAxOC41NzIxIDMuMTg2MzlMMTcuMDg3OCA0LjY3MDdDMTMuNjU5MSAxLjI0MjM2IDguMTAwMTEgMS4yNDMyMiA0LjY3MTYxIDQuNjcxNzNDMS4yNDMzNSA4LjEwMDI2IDEuMjQzMzUgMTMuNjU4MyA0LjY3MTYxIDE3LjA4NjhDOC4xMDAxMSAyMC41MTUzIDEzLjY1OTEgMjAuNTE2MiAxNy4wODc4IDE3LjA4NzlMMTguNTcyMSAxOC41NzIyQzE0LjMyMzMgMjIuODIwNiA3LjQzNDg4IDIyLjgyMDggMy4xODYyNyAxOC41NzIyWiIvPjwvY2xpcFBhdGg+PC9kZWZzPgo8L3N2Zz4K) 50%/100% 100% no-repeat;width:18.572px;height:21.759px;position:absolute;top:1.121px;left:1.12px}@keyframes _44HXVa_spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){._44HXVa_spinner{animation:none}}";
		const tagId$6 = "@deepseek-ai/dsh-client-ui-settings-account/PlatformOverlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-account";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var PlatformOverlay_module_css_default = {
			"back": "_44HXVa_back",
			"controls": "_44HXVa_controls",
			"failure": "_44HXVa_failure",
			"header": "_44HXVa_header",
			"overlay": "_44HXVa_overlay",
			"retry": "_44HXVa_retry",
			"spin": "_44HXVa_spin",
			"spinner": "_44HXVa_spinner",
			"status": "_44HXVa_status",
			"trafficLights": "_44HXVa_trafficLights",
			"viewport": "_44HXVa_viewport"
		};
		//#endregion
		//#region lib/types/client/overlay-inert.js
		/** Shared inert ownership for overlapping account overlays. */
		const owners = /* @__PURE__ */ new WeakMap();
		/**
		* Disable background interaction until every account overlay releases the element.
		* @param element - background element covered by an overlay.
		* @returns an idempotent release restoring the original inert state after the last owner.
		*/
		function acquireOverlayInert(element) {
			const state = owners.get(element) ?? {
				count: 0,
				previous: element.inert
			};
			state.count++;
			owners.set(element, state);
			element.inert = true;
			let released = false;
			return () => {
				if (released) return;
				released = true;
				if (--state.count === 0) {
					element.inert = state.previous;
					owners.delete(element);
				}
			};
		}
		//#endregion
		//#region lib/types/client/PlatformOverlay.js
		/** Desktop Platform viewport; the native child owns remote content and credentials. */
		/** @param props - native commands, localized copy, and return action. @returns full-window Platform container. */
		function PlatformOverlay({ bridge, page, backLabel, loadingLabel, failureLabel, retryLabel, onClose }) {
			const layer = (0, react.useRef)(null);
			const back = (0, react.useRef)(null);
			const viewport = (0, react.useRef)(null);
			const [attempt, setAttempt] = (0, react.useState)(0);
			const [status, setStatus] = (0, react.useState)("loading");
			(0, react.useLayoutEffect)(() => {
				const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
				const background = Array.from(document.body.children).filter((element) => element instanceof HTMLElement && element !== layer.current).map((element) => acquireOverlayInert(element));
				back.current?.focus();
				return () => {
					for (const release of background) release();
					if (previousFocus?.isConnected) previousFocus.focus();
				};
			}, []);
			(0, react.useLayoutEffect)(() => {
				back.current?.focus();
			}, [page, attempt]);
			(0, react.useEffect)(() => {
				const element = viewport.current;
				let closed = false;
				const bounds = () => {
					const rect = element.getBoundingClientRect();
					return {
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height
					};
				};
				const fail = () => {
					if (!closed) setStatus("failed");
				};
				setStatus("loading");
				bridge.open(page, bounds()).then(() => {
					if (!closed) setStatus("loaded");
				}, fail);
				const observer = new ResizeObserver(() => {
					bridge.setBounds(bounds()).catch(fail);
				});
				observer.observe(element);
				return () => {
					closed = true;
					observer.disconnect();
					bridge.close().catch(() => {});
				};
			}, [
				bridge,
				page,
				attempt
			]);
			return (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("div", {
				ref: layer,
				className: PlatformOverlay_module_css_default.overlay,
				role: "dialog",
				"aria-modal": "true",
				"aria-label": backLabel,
				children: [(0, react_jsx_runtime.jsx)("header", {
					className: PlatformOverlay_module_css_default.header,
					"data-window-drag": true,
					children: (0, react_jsx_runtime.jsxs)("div", {
						className: PlatformOverlay_module_css_default.controls,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: PlatformOverlay_module_css_default.trafficLights,
							"aria-hidden": "true"
						}), (0, react_jsx_runtime.jsxs)("button", {
							ref: back,
							className: PlatformOverlay_module_css_default.back,
							onClick: onClose,
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutlineRegular, { size: 16 }), backLabel]
						})]
					})
				}), (0, react_jsx_runtime.jsx)("div", {
					ref: viewport,
					className: PlatformOverlay_module_css_default.viewport,
					children: status !== "loaded" && (0, react_jsx_runtime.jsx)("div", {
						className: PlatformOverlay_module_css_default.status,
						role: "status",
						"aria-label": status === "loading" ? loadingLabel : void 0,
						children: status === "failed" ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
							className: PlatformOverlay_module_css_default.failure,
							children: failureLabel
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							className: PlatformOverlay_module_css_default.retry,
							onClick: () => {
								setAttempt((value) => value + 1);
							},
							children: retryLabel
						})] }) : (0, react_jsx_runtime.jsx)("span", {
							className: PlatformOverlay_module_css_default.spinner,
							"aria-hidden": "true"
						})
					})
				})]
			}), document.body);
		}
		//#endregion
		//#region lib/types/client/AccountPlatformHost.js
		/**
		* @param props - the native commands, the live page request, and its dismissal.
		* @returns the native Platform container, or null while no page is requested.
		*/
		function AccountPlatformHost({ platform, usePage, closePage, t }) {
			const claim = usePage((current) => current);
			if (claim === null) return null;
			return (0, react_jsx_runtime.jsx)(PlatformOverlay, {
				bridge: platform,
				page: claim.page,
				backLabel: t("backToHarness"),
				loadingLabel: t("loading"),
				failureLabel: t("platformFailed"),
				retryLabel: t("platformRetry"),
				onClose: closePage
			});
		}
		//#endregion
		//#region lib/types/client/SignOutDialog.js
		/** Account sign-out confirmation with the current task impact. */
		/** @param props - task impact at opening, localized copy, and account actions. @returns sign-out confirmation. */
		function SignOutDialog({ running, signOut, close, t }) {
			const [busy, setBusy] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			const dismiss = () => {
				if (!busy) close();
			};
			const confirm = async () => {
				setBusy(true);
				setFailed(false);
				try {
					await signOut();
					close();
				} catch {
					setFailed(true);
				} finally {
					setBusy(false);
				}
			};
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				headless: true,
				title: t("signOut"),
				onClose: dismiss,
				className: SignInDialog_module_css_default.dialog,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: SignInDialog_module_css_default.content,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: SignInDialog_module_css_default.header,
							children: [(0, react_jsx_runtime.jsx)("h2", {
								className: SignInDialog_module_css_default.title,
								children: t("signOut")
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SignInDialog_module_css_default.close,
								"aria-label": t("close"),
								disabled: busy,
								onClick: dismiss,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
							})]
						}),
						(0, react_jsx_runtime.jsx)("p", {
							className: SignInDialog_module_css_default.description,
							children: t(running === "unknown" ? "signOutUnknownDescription" : running ? "signOutRunningDescription" : "signOutDescription")
						}),
						failed && (0, react_jsx_runtime.jsx)("p", {
							className: SignInDialog_module_css_default.description,
							role: "alert",
							children: t("failed")
						})
					]
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: SignInDialog_module_css_default.actions,
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						className: SignInDialog_module_css_default.secondaryButton,
						disabled: busy,
						onClick: dismiss,
						children: t("cancel")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: SignInDialog_module_css_default.primaryButton,
						disabled: busy,
						onClick: () => {
							confirm();
						},
						children: t("signOut")
					})]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/LogoutIcon.js
		/** Figma IcDsLogOutOutline16 glyph, stored inline for theme-aware rendering. */
		/** @returns the account menu logout glyph. */
		function LogoutIcon() {
			return (0, react_jsx_runtime.jsx)("span", {
				style: {
					width: 16,
					height: 16,
					position: "relative"
				},
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsxs)("svg", {
					style: {
						position: "absolute",
						left: 1.168,
						top: 1.214
					},
					width: "13.664",
					height: "13.571",
					viewBox: "0 0 14 14",
					fill: "none",
					xmlns: "http://www.w3.org/2000/svg",
					children: [(0, react_jsx_runtime.jsx)("path", {
						d: "M3.9961 1.40039C3.37842 1.40039 2.96028 1.40039 2.63867 1.42871C2.32631 1.45627 2.17171 1.50666 2.06641 1.56543C1.85606 1.68288 1.68189 1.85605 1.56446 2.06641C1.50569 2.17173 1.45625 2.32627 1.42871 2.63867C1.40036 2.9603 1.39942 3.37827 1.39942 3.9961L1.39942 9.5752C1.39942 10.193 1.40036 10.611 1.42871 10.9326C1.45625 11.245 1.50569 11.3996 1.56445 11.5049C1.68188 11.7153 1.85605 11.8884 2.06641 12.0059C2.17171 12.0646 2.32631 12.115 2.63867 12.1426C2.96028 12.1709 3.37842 12.1709 3.9961 12.1709V13.5713C3.4033 13.5713 2.91297 13.5721 2.51563 13.5371C2.10906 13.5013 1.73277 13.4233 1.38379 13.2285C0.946838 12.9845 0.585697 12.6235 0.341799 12.1865C0.14725 11.8377 0.0700118 11.4621 0.0341815 11.0557C-0.000847399 10.6583 1.58129e-06 10.1681 1.85029e-06 9.5752L2.09416e-06 3.9961C1.83027e-06 3.40325 -0.000846367 2.91297 0.0341818 2.51563C0.0700164 2.10924 0.147239 1.73362 0.341799 1.38477C0.585703 0.947758 0.946825 0.586744 1.38379 0.342775C1.73277 0.148001 2.10906 0.0700381 2.51563 0.0341813C2.91297 -0.000823893 3.40331 1.37805e-06 3.9961 1.71712e-06L3.9961 1.40039Z",
						fill: "currentColor"
					}), (0, react_jsx_runtime.jsx)("path", {
						d: "M13.6426 6.51953C13.6705 6.6957 13.6705 6.8756 13.6426 7.05176C13.5902 7.38188 13.4302 7.64112 13.2539 7.86035C13.0857 8.06937 12.8546 8.29971 12.6006 8.55371L9.3086 11.8447L8.31836 10.8545L11.6104 7.56348C11.637 7.53681 11.6628 7.51104 11.6875 7.48633H3.74317V6.08594H11.6885C11.6635 6.06088 11.6374 6.03487 11.6104 6.00781L8.31836 2.7168L9.3086 1.72656L12.6006 5.01758C12.8547 5.27169 13.0857 5.50185 13.2539 5.71094C13.4303 5.93018 13.5902 6.18939 13.6426 6.51953Z",
						fill: "currentColor"
					})]
				})
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-account/src/client/AccountAvatar.module.css.mjs
		const css$5 = ".ZCYJYW_image{corner-shape:round;object-fit:cover;border-radius:50%;width:100%;height:100%;display:block}";
		const tagId$5 = "@deepseek-ai/dsh-client-ui-settings-account/AccountAvatar.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-account";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var AccountAvatar_module_css_default = { "image": "ZCYJYW_image" };
		//#endregion
		//#region lib/types/client/AccountAvatar.js
		/** Shared account picture with an icon fallback for missing or unavailable images. */
		/**
		* Render a decorative avatar next to the account identity.
		* @param props - shared browser load outcome and rendered-image failure reporter; absent data uses the default icon.
		* @returns picture or the default account icon.
		*/
		function AccountAvatar({ avatar, avatarFailed }) {
			return avatar?.status === "ready" ? (0, react_jsx_runtime.jsx)("img", {
				className: AccountAvatar_module_css_default.image,
				src: avatar.url,
				alt: "",
				referrerPolicy: "no-referrer",
				onError: () => {
					avatarFailed(avatar);
				}
			}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutlineMedium, { size: 16 });
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-account/src/client/AccountNotice.module.css.mjs
		const css$4 = ".zwW4-W_card{z-index:40;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);width:260px;max-width:calc(100vw - 16px);color:var(--dsw-alias-label-secondary);border-radius:16px;padding:20px;font-size:14px;line-height:22px;position:fixed;box-shadow:0 2px 4px #0000000d}.zwW4-W_copy{overflow-wrap:anywhere;flex-direction:column;gap:2px;display:flex}.zwW4-W_copy p{white-space:pre-wrap;margin:0}.zwW4-W_title{align-items:flex-start;gap:2px;font-weight:500;line-height:20px;display:flex}.zwW4-W_icon{width:14px;height:14px;color:var(--dsw-alias-brand-primary-new-colorprimary-new-color);flex:none;margin-top:1px;display:flex}.zwW4-W_close{width:18px;height:18px;color:var(--dsw-alias-label-caption);cursor:pointer;background:0 0;border:0;justify-content:center;align-items:center;padding:4px;display:flex;position:absolute;top:6px;right:6px}.zwW4-W_close:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px;border-radius:4px}";
		const tagId$4 = "@deepseek-ai/dsh-client-ui-settings-account/AccountNotice.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-account";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var AccountNotice_module_css_default = {
			"card": "zwW4-W_card",
			"close": "zwW4-W_close",
			"copy": "zwW4-W_copy",
			"icon": "zwW4-W_icon",
			"title": "zwW4-W_title"
		};
		//#endregion
		//#region lib/types/client/AccountNotice.js
		/**
		* Sidebar bonus notice. The card reports a display once it has a position, the
		* document is visible, and it has painted one frame: that is the whole signal,
		* and the card measures no cover, so a painted card behind the open Settings
		* overlay reports the same way as any other. Closing counts as a display too,
		* because the user acted on it. An award that expired before a render is not
		* drawn at all.
		*/
		/** @param expiresAt - server expiration timestamp. @returns whether the award can still be spent. */
		function live(expiresAt) {
			const expires = Date.parse(expiresAt);
			return Number.isNaN(expires) || expires > Date.now();
		}
		/**
		* @param run - callback to invoke once one presented frame has passed.
		* @returns a canceller for a card that unmounts or hides first.
		*/
		function afterPaint(run) {
			if (typeof requestAnimationFrame !== "function") {
				const timer = setTimeout(run, 0);
				return () => {
					clearTimeout(timer);
				};
			}
			let cancelled = false;
			let timer;
			const frame = requestAnimationFrame(() => {
				timer = setTimeout(() => {
					if (!cancelled) run();
				}, 0);
			});
			return () => {
				cancelled = true;
				cancelAnimationFrame(frame);
				if (timer !== void 0) clearTimeout(timer);
			};
		}
		/** @param props - notice copy and identity, sidebar anchor, and display callbacks.
		* @returns a non-modal notice above the account launcher until closed.
		*/
		function AccountNoticeCard({ notice, anchor, title, closeLabel, onShown, onDismiss }) {
			const [position, setPosition] = (0, react.useState)();
			const reported = (0, react.useRef)(false);
			(0, react.useLayoutEffect)(() => {
				if (!anchor.current || !live(notice.expiresAt)) return;
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
							/* GBH: chưa đăng nhập thì launcher là NÚT CÀI ĐẶT, không mở menu tài khoản. */
							"aria-label": signedIn ? t("menu") : t("settings"),
							"aria-haspopup": signedIn ? "menu" : "dialog",
							"aria-expanded": signedIn ? open : settingsOpen,
							onClick: () => {
								if (!signedIn) {
									openSettings();
									return;
								}
								setOpen((value) => !value);
							},
							children: [signedIn ? (0, react_jsx_runtime.jsx)("span", {
								className: AccountMenu_module_css_default.avatar,
								"data-avatar-status": account.avatar?.status,
								children: (0, react_jsx_runtime.jsx)(AccountAvatar, {
									avatar: account.avatar,
									avatarFailed
								})
							}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineMedium, { size: 14 }), wide && (0, react_jsx_runtime.jsx)("span", {
								className: AccountMenu_module_css_default.label,
								children: signedIn ? label : t("settings")
							})]
						}),
						items: !signedIn ? [] : [
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
