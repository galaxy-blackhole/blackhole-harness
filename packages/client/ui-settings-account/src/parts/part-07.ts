/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			const profile = details?.profile?.status === "ready" ? details.profile.value : void 0;
			const wallets = details?.balance?.status === "ready" ? details.balance.value : void 0;
			const bonusWallets = details?.balance?.status === "ready" ? details.balance.bonusWallets.filter((wallet) => new Big(wallet.balance).gt(0)) : [];
			const showBonusRow = details?.balance?.status !== "ready" || bonusWallets.length > 0;
			const attempt = state?.attempt;
			const active = attempt !== null && attempt !== void 0 && [
				"initializing",
				"waiting-browser",
				"exchanging",
				"committing"
			].includes(attempt.phase);
			const signedIn = state?.status === "credential-stored";
			(0, react.useEffect)(() => () => {
				releasePage.current?.();
				releasePage.current = void 0;
			}, []);
			(0, react.useEffect)(() => {
				if (signedIn) return;
				releasePage.current?.();
				releasePage.current = void 0;
			}, [signedIn]);
			const showPage = (open, page) => {
				releasePage.current?.();
				releasePage.current = open(page, () => {
					releasePage.current = void 0;
				});
			};
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
			/**
			* @param event - click on a Platform destination link.
			* @returns nothing; on Desktop the embedded page replaces the pending navigation.
			*/
			const openUsage = (event) => {
				if (openPlatformPage !== void 0 && signedIn) {
					event.preventDefault();
					showPage(openPlatformPage, "usage");
				}
			};
			/**
			* The Platform entry the balance rows share with the Usage action: an embedded page on
			* Desktop, a new tab elsewhere. A wallet read that failed still reaches the same
			* destination, so the user can inspect the balance the Harness could not load; the
			* destination comes from the account links, not from the wallet response.
			* @param label - localized link copy.
			* @param className - link treatment for the row that renders it, absent when the sheet has no such rule.
			* @returns the Platform anchor.
			*/
			const platformLink = (label, className) => (0, react_jsx_runtime.jsx)("a", {
				className,
				href: state?.links.usageUrl,
				"aria-disabled": state === void 0,
				target: "_blank",
				rel: "noreferrer",
				onClick: openUsage,
				children: label
			});
			const status = failed || streamFailed || attempt?.phase === "failed" ? t("failed") : attempt?.phase === "expired" ? t("expired") : active ? t(attempt.phase === "initializing" ? "initializing" : attempt.phase === "waiting-browser" ? "waiting" : "completing") : signedIn ? profile?.contact ?? t(details?.profile === void 0 ? "loading" : "profileUnavailable") : t("signInDescription");
			if (!signedIn && !active) return (0, react_jsx_runtime.jsx)("section", {
				className: AccountSection_module_css_default.signedOut,
				"aria-label": t("nav"),
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: AccountSection_module_css_default.signedOutContent,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.signedOutCopy,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: AccountSection_module_css_default.signedOutTitle,
							children: t("settingsSignedOutTitle")
						}), (0, react_jsx_runtime.jsx)("span", {
							className: AccountSection_module_css_default.signedOutDescription,
							role: "status",
							children: failed || streamFailed ? t("failed") : t("settingsSignedOutDescription")
						})]
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: AccountSection_module_css_default.signInButton,
						disabled: busy || state === void 0,
						onClick: () => {
							run(start);
						},
						children: t("signIn")
					})]
				})
			});
			return (0, react_jsx_runtime.jsxs)("section", {
				className: AccountSection_module_css_default.section,
				"aria-label": t("nav"),
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.card,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: AccountSection_module_css_default.identity,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: AccountSection_module_css_default.avatar,
								"data-avatar-status": signedIn ? avatar?.status : void 0,
								children: (0, react_jsx_runtime.jsx)(AccountAvatar, {
									avatar: signedIn ? avatar : void 0,
									avatarFailed
								})
							}), (0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.identityCopy,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.name,
									children: signedIn ? profile?.name ?? t("signedIn") : t("signedOut")
								}), (0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.status,
									role: "status",
									children: status
								})]
							})]
						}), signedIn && (0, react_jsx_runtime.jsxs)("a", {
							className: AccountSection_module_css_default.accountInfo,
							href: new URL("/", state.links.usageUrl).href,
							target: "_blank",
							rel: "noopener noreferrer",
							children: [t("accountInfo"), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 12 })]
						})]
					}),
					active && (0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.actions,
						children: [attempt.authorizeUrl && (0, react_jsx_runtime.jsx)("a", {
							className: AccountSection_module_css_default.linkButton,
							href: authorizeUrlWithTheme(attempt.authorizeUrl, colorScheme),
							target: "_blank",
							rel: "noreferrer",
							children: t("open")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: busy || attempt.phase === "committing",
							onClick: () => {
								run(() => cancel(attempt.id));
							},
							children: t("cancel")
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.balanceCard,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.row,
								children: [(0, react_jsx_runtime.jsx)("span", { children: t("balance") }), signedIn && wallets !== void 0 && wallets.length > 0 ? (0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.amount,
									children: wallets.map((wallet) => (0, react_jsx_runtime.jsx)("span", { children: formatBalance(wallet.balance, wallet.currency === "CNY" ? "¥" : "$") }, wallet.currency))
								}) : !signedIn || details?.balance === void 0 ? (0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.unavailable,
									children: t(!signedIn ? "balanceSignedOut" : "loading")
								}) : platformLink(t("balanceUnavailable"), AccountSection_module_css_default.unavailableLink)]
							}),
							signedIn && showBonusRow && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }), (0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.row,
								children: [(0, react_jsx_runtime.jsx)("span", { children: t("bonusBalance") }), (0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.bonusValue,
									children: bonusWallets.length > 0 ? (0, react_jsx_runtime.jsx)("span", {
										className: AccountSection_module_css_default.amount,
										children: bonusWallets.map((wallet) => (0, react_jsx_runtime.jsx)("span", { children: formatBalance(wallet.balance, wallet.currency === "CNY" ? "¥" : "$") }, wallet.currency))
									}) : details?.balance === void 0 ? (0, react_jsx_runtime.jsx)("span", {
										className: AccountSection_module_css_default.unavailable,
										children: t("loading")
									}) : platformLink(t("balanceUnavailable"), AccountSection_module_css_default.unavailableLink)
								})]
							})] }),
							(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }),
							(0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.row,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.secondary,
									children: t("more")
								}), (0, react_jsx_runtime.jsxs)("div", {
									className: AccountSection_module_css_default.links,
									children: [platformLink(t("usage"), AccountSection_module_css_default.linkButton), (0, react_jsx_runtime.jsx)("a", {
										className: `${AccountSection_module_css_default.linkButton} ${AccountSection_module_css_default.primary}`,
										href: state?.links.topUpUrl,
										"aria-disabled": state === void 0,
										target: "_blank",
										rel: "noreferrer",
										onClick: (event) => {
											if (openPlatformPage !== void 0 && signedIn) {
												event.preventDefault();
												showPage(openPlatformPage, "top-up");
											}
										},
										children: t("topUp")
									})]
								})]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/bonus-notices.js
		/**
		* @param expiresAt - server expiration timestamp.
		* @param at - milliseconds since epoch.
		* @returns whether the bonus can no longer be shown.
		*/
		function expired(expiresAt, at) {
			const expires = Date.parse(expiresAt);
			return !Number.isNaN(expires) && expires <= at;
		}
		/**
		* Own the read, display, and acknowledgement lifecycle of bonus notices.
		* @param options - collaborators and timings.
		* @returns the controller the account plugin drives from account and settings state.
		*/
		function createBonusNoticeController(options) {
			let scope;
			/** Notice currently published to the sidebar, including the expiration checked at display time. */
			let current;
			/** Newest read; an older read still in flight has its result dropped once a newer one starts. */
			let readGeneration = 0;
			let ackTimer;
			let ackInFlight = false;
			let ackDelay = options.ackRetryDelayMs;
			/** Orders the card on screen already reported, so one mount cannot acknowledge twice. */
			const reported = /* @__PURE__ */ new Set();
			const clearAckTimer = () => {
				if (ackTimer !== void 0) {
					clearTimeout(ackTimer);
					ackTimer = void 0;
				}
			};
			const setCurrent = (notice) => {
				if (notice === void 0 && current === void 0) return;
				if (notice?.orderId === current?.orderId && notice?.message === current?.message && notice?.expiresAt === current?.expiresAt) return;
				if (notice?.orderId !== current?.orderId) reported.clear();
				current = notice;
				options.publish(notice ?? null);
			};
			const scheduleAck = (delay) => {
				clearAckTimer();
				ackTimer = setTimeout(() => {
					runAcks();
				}, delay);
			};
			/** Drop acknowledgement work of the previous account or lifecycle, so its carry-over cannot reach the next one. */
			const resetAcks = () => {
				clearAckTimer();
				ackInFlight = false;
				ackDelay = options.ackRetryDelayMs;
			};
			const startAcks = () => {
				if (scope !== void 0 && scope.pending.length > 0) scheduleAck(0);
			};
			/**
			* Apply one read result. A newly offered order replaces the on-screen card;
			* an offer equal to the on-screen card refreshes its copy in place, and an
			* empty batch leaves a card the user has already seen alone.
			*/
			const apply = (scopeAtRead, batch) => {
				if (scopeAtRead.accountId !== batch.accountId) {
					scopeAtRead.accountId = batch.accountId;
					scopeAtRead.pending.length = 0;
					resetAcks();
					setCurrent(void 0);
				}
				const candidate = batch.bonuses[0];
				if (candidate === void 0) {
					if (current !== void 0 && !reported.has(current.orderId)) setCurrent(void 0);
					return;
				}
				if (candidate.orderId === current?.orderId) {
					setCurrent({
						orderId: candidate.orderId,
						message: candidate.message,
						expiresAt: candidate.expiresAt
					});
					return;
				}
				if (expired(candidate.expiresAt, Date.now())) return;
				setCurrent({
					orderId: candidate.orderId,
					message: candidate.message,
					expiresAt: candidate.expiresAt
				});
			};
			/**
			* Read once for one live lifecycle. A newer read supersedes one in flight: the
			* older result is dropped instead of applied, so only the newest read can report
			* an account change.
			* @param scopeAtRead - lifecycle this read belongs to.
			* @returns after this read settles.
			*/
			function runRead(scopeAtRead) {
				const generation = ++readGeneration;
				return (async () => {
					let batch;
					try {
						batch = await options.read();
					} catch {
						batch = null;
					}
					if (scope !== scopeAtRead || generation !== readGeneration) return;
					if (batch !== null) apply(scopeAtRead, batch);
				})();
			}
			/**
			* Acknowledge presented orders one at a time. A protocol failure backs off up
			* to the ceiling and retries for the rest of the signed-in lifecycle, which
			* never persists. A false answer settles the order without a retry: this
			* session cannot make the server accept it. A hidden window keeps retrying,
			* because the presented frame is what a pending acknowledgement proves.
			*/
			async function runAcks() {
				const scopeAtCall = scope;
				if (scopeAtCall === void 0 || ackInFlight) return;
				const accountId = scopeAtCall.accountId;
				const orderId = scopeAtCall.pending[0];
				/* v8 ignore next -- an acknowledgement runs only while a read named the account and left a pending order */
				if (accountId === void 0 || orderId === void 0) return;
				ackInFlight = true;
				/** @returns whether this call still owns the lifecycle and account it started for. */
				const owns = () => scope === scopeAtCall && scopeAtCall.accountId === accountId;
				let acknowledged;
				try {
					acknowledged = await options.acknowledge(accountId, orderId);
				} catch {
					if (!owns()) return;
					ackInFlight = false;
					scheduleAck(ackDelay);
					ackDelay = Math.min(ackDelay * 2, options.ackRetryMaxDelayMs);
					return;
				}
				if (!owns()) return;
				ackInFlight = false;
				/* v8 ignore next -- the call owns the scope, and this order is its head until this shift */
				if (scopeAtCall.pending[0] === orderId) scopeAtCall.pending.shift();
				ackDelay = options.ackRetryDelayMs;
				if (acknowledged && scopeAtCall.pending.length > 0) scheduleAck(0);
				else clearAckTimer();
			}
			/** Queue a presented order, so an acknowledgement interrupted by a failure retries within this sign-in. */
			const report = (orderId) => {
				const scopeAtReport = scope;
				if (scopeAtReport === void 0 || current?.orderId !== orderId || reported.has(orderId)) return;
				reported.add(orderId);
				if (!scopeAtReport.pending.includes(orderId)) scopeAtReport.pending.push(orderId);
				ackDelay = options.ackRetryDelayMs;
				scheduleAck(0);
			};
			const endLifecycle = () => {
				if (scope === void 0) return;
				resetAcks();
				scope = void 0;
				reported.clear();
				setCurrent(void 0);
			};
			return {
				begin() {
					scope ??= { pending: [] };
					runRead(scope);
				},
				end: endLifecycle,
				refresh() {
					if (scope === void 0) return Promise.resolve();
					startAcks();
					return runRead(scope);
				},
				shown(orderId) {
					if (current?.orderId !== orderId) return;
					if (expired(current.expiresAt, Date.now())) return;
					report(orderId);
				},
				dismiss(orderId) {
					if (current?.orderId !== orderId) return;
					report(orderId);
					setCurrent(void 0);
				}
			};
		}
		//#endregion
		//#region lib/types/client/client-metadata.js
		/**
		* Build the request identity for one account call.
		* @param locale - active UI language; the Host reduces it to the Platform wire locale.
		* @param version - client build version inlined by the bundle.
		* @returns the metadata the account Remote methods carry.
		* @throws Error when the build carries no version, instead of reporting an empty one.
		*/
		function accountClientMetadata(locale, version) {
			if (version === void 0 || version === "") throw new Error("account: this client build carries no DSH_CLIENT_VERSION");
			return {
				version,
				locale,
				timezoneOffsetSeconds: -(/* @__PURE__ */ new Date()).getTimezoneOffset() * 60
			};
		}
		//#endregion
		//#region lib/types/client/locales/onboarding.js
		/** Chinese first-run copy from the onboarding requirements. */
export {};
