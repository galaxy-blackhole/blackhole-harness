/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					});
				},
				retire: (pluginId) => {
					const removed = new Set(snapshot.removed);
					removed.add(pluginId);
					publish({
						...snapshot,
						rows: snapshot.rows.filter((row) => row.pluginId !== pluginId),
						removed
					});
				},
				reset: () => {
					generation += 1;
					inFlight = void 0;
					publish({
						rows: [],
						removed: snapshot.removed,
						read: false
					});
				}
			};
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Cordis dynamic-plugin UI dictionaries. */
		const NS = "cordis";
		/** Simplified Chinese Cordis UI messages. */
		const zh = {
			"row.defineTitle": "注册 Cordis 插件",
			"a11y.preparing": "准备调用 Cordis 工具",
			"row.runTitle": "运行 Cordis 插件",
			"row.updateTitle": "更新 Cordis 插件",
			"row.stopTitle": "停止 Cordis 插件",
			"row.removeTitle": "移除 Cordis 插件",
			"purpose.missing": "(未填写用途)",
			"status.idle": "待激活",
			"status.awaitingApproval": "待审批",
			"status.failed": "运行失败",
			"status.clientPending": "Client 待激活",
			"status.running": "运行中",
			"status.removed": "已移除",
			"status.superseded": "已有更新",
			"run.removed": "包已不存在",
			"run.superseded": "已有更新的运行卡片，请查看下方",
			"panel.hint": "运行控制在左下角设置上方的 Cordis 面板",
			"panel.plugins.aria": "Cordis 插件",
			"panel.approvals.aria": "Cordis 审批",
			"panel.trigger": "Cordis Plugin",
			"panel.runningCount": "{count} running",
			"panel.title": "Cordis 插件",
			"panel.empty": "还没有定义任何插件",
			"panel.loading": "读取中…",
			"panel.readFailed": "读取插件清单失败：{message}",
			"panel.group.current": "当前会话",
			"panel.group.others": "其他会话",
			"panel.version": "版本",
			"panel.current": "当前：{packageId}",
			"panel.next": "待切换：{packageId}",
			"action.approve": "允许",
			"action.approveOnce": "仅允许此版本",
			"action.approvePlugin": "允许此插件的后续版本",
			"action.decline": "拒绝",
			"action.run": "运行",
			"action.stop": "停止",
			"action.remove": "移除",
			"action.retry": "重试",
			"action.rollback": "回退",
			"action.inspect": "查看",
			"render.failedAbdicated": "{slot} 渲染失败，已恢复默认界面：",
			"render.failedHeld": "{slot} 渲染失败：",
			"a11y.defining": "正在定义插件",
			"a11y.failed": "定义失败",
			"a11y.stopped": "定义已中断",
			"body.source": "插件代码",
			"body.hostCode": "Host",
			"body.clientCode": "Client",
			"body.output": "结果",
			"body.copy": "复制",
			"body.copied": "已复制"
		};
		/** English Cordis UI messages. */
		const en = {
			"row.defineTitle": "Register Cordis Plugin",
			"a11y.preparing": "Preparing a Cordis tool call",
			"row.runTitle": "Run Cordis Plugin",
			"row.updateTitle": "Update Cordis Plugin",
			"row.stopTitle": "Stop Cordis Plugin",
			"row.removeTitle": "Remove Cordis Plugin",
			"purpose.missing": "(no purpose given)",
			"status.idle": "Ready",
			"status.awaitingApproval": "Awaiting approval",
			"status.failed": "Run failed",
			"status.clientPending": "Client ready to activate",
			"status.running": "Running",
			"status.removed": "Removed",
			"status.superseded": "Newer run available",
			"run.removed": "This package no longer exists",
			"run.superseded": "A newer run card is available below",
			"panel.hint": "Run controls live in the Cordis panel above Settings",
			"panel.plugins.aria": "Cordis plugins",
			"panel.approvals.aria": "Cordis approvals",
			"panel.trigger": "Cordis Plugin",
			"panel.runningCount": "{count} running",
			"panel.title": "Cordis plugins",
			"panel.empty": "No plugins defined yet",
			"panel.loading": "Reading…",
			"panel.readFailed": "Reading the plugin inventory failed: {message}",
			"panel.group.current": "This session",
			"panel.group.others": "Other sessions",
			"panel.version": "Version",
			"panel.current": "Current: {packageId}",
			"panel.next": "Next: {packageId}",
			"action.approve": "Allow",
			"action.approveOnce": "Allow this version only",
			"action.approvePlugin": "Allow future versions of this plugin",
			"action.decline": "Decline",
			"action.run": "Run",
			"action.stop": "Stop",
			"action.remove": "Remove",
			"action.retry": "Retry",
			"action.rollback": "Roll back",
			"action.inspect": "Inspect",
			"render.failedAbdicated": "Rendering failed in {slot}; the default UI was restored:",
			"render.failedHeld": "Rendering failed in {slot}:",
			"a11y.defining": "Defining the plugin",
			"a11y.failed": "Definition failed",
			"a11y.stopped": "Definition interrupted",
			"body.source": "Plugin source",
			"body.hostCode": "Host",
			"body.clientCode": "Client",
			"body.output": "Result",
			"body.copy": "Copy",
			"body.copied": "Copied"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Cordis dynamic-plugin cards, inventory panel, business-view host. */
		/** Required services for historical cards, the panel, and Remote lifecycle actions. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.dynamicCordisRunner",
			"dynamicCordisRunner"
		];
		/** Mount every Cordis browser surface over the shared Host inventory. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-cordis: dictionaries");
			const port = {
				stop: async (sessionId, pluginId) => {
					const answered = await ctx.remote.dynamicCordisRunner.stopFromPanel(sessionId, pluginId);
					if (!answered.ok) return {
						ok: false,
						message: `${answered.error.code}: ${answered.error.message}`
					};
					if (answered.value.ok || answered.value.reason === "not-running") return { ok: true };
					return {
						ok: false,
						message: answered.value.message
					};
				},
				remove: async (sessionId, pluginId) => {
					const answered = await ctx.remote.dynamicCordisRunner.undefineFromPanel(sessionId, pluginId);
					if (!answered.ok) return {
						ok: false,
						message: `${answered.error.code}: ${answered.error.message}`
					};
					return answered.value.ok ? { ok: true } : {
						ok: false,
						message: answered.value.message
					};
				},
				inventory: async () => {
					const answered = await ctx.remote.dynamicCordisRunner.inventory();
					if (!answered.ok) throw new Error(`${answered.error.code}: ${answered.error.message}`);
					return answered.value;
				}
			};
			const inventory = createCordisInventory(port, (error) => {
				console.error("[ui-cordis] reading the Cordis inventory failed:", error);
			});
			const runner = ctx.dynamicCordisRunner;
			const loaded = {
				getSnapshot: () => runner.getSnapshot(),
				subscribe: (fn) => runner.subscribe(fn)
			};
			const runCards = new CordisRunCardRegistry();
			ctx.effect(() => inventory.subscribe(() => {
				const snapshot = inventory.getSnapshot();
				if (snapshot.read) runner.reconcileApprovals(snapshot.rows);
			}), "ui-cordis: reconcile pending approvals");
			ctx.remote.$on("cordis/dynamic-package", () => {
				inventory.refresh();
			});
			ctx.remote.$on("cordis/dynamic-retract", () => {
				inventory.refresh();
			});
			ctx.remote.$on("cordis/request-run", (request) => {
				if (!inventory.getSnapshot().rows.some((row) => row.pluginId === request.pluginId)) inventory.refresh();
			});
			ctx.remote.$on("cordis/request-run-resolved", () => {
				inventory.refresh();
			});
			ctx.on("connection/reset", () => {
				inventory.reset();
				inventory.refresh();
			});
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "cordis-panel",
				locale: NS,
				inject: () => ({
					hooks: {
						inventory,
						activeRuns: runner.activeRuns,
						runErrors: runner.lastRunError,
						loaded,
						renderFailures: runner.renderFailures
					},
					onApprove: (requestId, approveFutureVersions) => runner.approve(requestId, approveFutureVersions),
					onDecline: (requestId) => runner.decline(requestId),
					onRun: (request) => runner.startUserRun(request),
					onStop: async (sessionId, pluginId) => {
						const result = await port.stop(sessionId, pluginId);
						inventory.refresh();
						return result;
					},
					onRemove: async (sessionId, pluginId) => {
						const result = await port.remove(sessionId, pluginId);
						if (result.ok) inventory.retire(pluginId);
						inventory.refresh();
						return result;
					},
					onRefresh: () => {
						inventory.refresh();
					}
				})
			}, CordisPanel));
			const cardFace = () => ({ hooks: {
				inventory,
				loaded
			} });
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "cordis_define",
				locale: NS,
				inject: cardFace
			}, CordisDefineRow));
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "cordis_run",
				locale: NS,
				children: { "tool.view.cordis": {
					kind: "keyed",
					scope: "session"
				} },
				inject: (sessionId) => {
					const store = runCards.forSession(sessionId);
					return {
						hooks: {
							inventory,
							loaded,
							runCards: store,
							activeRuns: runner.activeRuns
						},
						onObserveRunCard: (pointer) => {
							store.observe(pointer);
						}
					};
				}
			}, CordisRunRow));
			ctx.slots.inject("tool.call.toolview", function* () {
				yield ctx.slots.register({
					name: "tool.call.toolview",
					key: "cordis_stop",
					locale: NS
				}, CordisActionRow);
				yield ctx.slots.register({
					name: "tool.call.toolview",
					key: "cordis_undefine",
					locale: NS
				}, CordisActionRow);
			});
			inventory.refresh();
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
