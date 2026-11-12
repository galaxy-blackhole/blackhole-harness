/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
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
});

//# sourceMappingURL=client.js.map
export {};
