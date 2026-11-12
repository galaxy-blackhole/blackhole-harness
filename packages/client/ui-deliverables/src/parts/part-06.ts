/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		}
		//#endregion
		//#region lib/types/client/review-definition.js
		/** The tab kind this package owns. */
		const CHANGES_REVIEW_KIND = "changes-review";
		/** This implementation's identity in the tab system, and the key its body registers under. */
		const CHANGES_REVIEW_ID = "@deepseek-ai/dsh-client-ui-deliverables";
		/**
		* The review type's registry definition.
		* @param t - namespace-bound translate, read fresh on every title call.
		* @returns the definition to register.
		*/
		function changesReviewDefinition(t) {
			return {
				id: CHANGES_REVIEW_ID,
				kind: CHANGES_REVIEW_KIND,
				patterns: ["dsh-resource://changes-review/**"],
				priority: "builtin",
				canOpen: (address) => parseChangesReviewAddress(address) !== void 0,
				title: (address) => {
					const turn = parseChangesReviewAddress(address)?.turn;
					return turn === void 0 ? address : t("review.title", { turn: String(turn) });
				}
			};
		}
		//#endregion
		//#region lib/types/client/review-store.js
		/**
		* The review tab's view state: which listed file is shown, whether hunks are
		* drawn side by side, and whether long lines wrap. One bucket per tab, so two
		* reviews in one session keep their own choices; the bucket ends with the
		* tab record's signal.
		*/
		function bucket(state, tabId) {
			const tab = state.byTab[tabId];
			if (tab === void 0) throw new Error(`ui-deliverables: no review state for tab "${tabId}"`);
			return tab;
		}
		/**
		* Declare the review tab's store; the registration declares it as an
		* exclusive store, so the framework mints one instance per session.
		* @returns the store handle to declare on the registration.
		*/
		function createReviewStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({ byTab: {} }),
				actions: {
					/**
					* Apply a navigation: seed a side-by-side, unwrapped tab on its first one, then show the navigated file.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param revision - the navigation revision being applied.
					* @param index - the file index the navigation named, or the current one.
					*/
					navigated: (d, tabId, revision, index) => {
						const tab = d.byTab[tabId];
						if (tab === void 0) d.byTab[tabId] = {
							index,
							split: true,
							wrap: false,
							navigated: revision
						};
						else {
							tab.index = index;
							tab.navigated = revision;
						}
					},
					/**
					* Show another listed file.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param index - original index in the summary's files array.
					*/
					selected: (d, tabId, index) => {
						bucket(d, tabId).index = index;
					},
					/**
					* Switch between the unified and the side-by-side view.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					*/
					toggledSplit: (d, tabId) => {
						const tab = bucket(d, tabId);
						tab.split = !tab.split;
					},
					/**
					* Switch line wrapping.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					*/
					toggledWrap: (d, tabId) => {
						const tab = bucket(d, tabId);
						tab.wrap = !tab.wrap;
					},
					/**
					* Drop a tab's bucket once its record is gone.
					* @param d - draft state.
					* @param tabId - the tab that ended.
					*/
					forget: (d, tabId) => {
						d.byTab = Object.fromEntries(Object.entries(d.byTab).filter(([id]) => id !== tabId));
					}
				}
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `deliverables` namespace dictionaries: cards, comparison tab, and file-mention copy. */
		/** Dictionary namespace owned by this plugin. */
		const NS = "deliverables";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"presented.nativeUnavailable": "此文件没有可用的主机路径，请在侧边栏预览",
			"presented.revealError": "无法在文件管理器中显示，请重试",
			"presented.directoryError": "无法打开所在文件夹，请重试",
			"presented.directoryOpening": "正在打开所在文件夹…",
			"presented.directoryOpened": "已请求打开所在文件夹",
			"presented.revealed": "已请求在文件管理器中显示",
			"presented.revealing": "正在文件管理器中显示…",
			"presented.unavailable": "此主机没有可用的桌面，无法使用外部程序打开文件或文件夹；文件仍可在侧边栏预览",
			"presented.retry": "重试",
			"presented.hostError": "无法读取主机桌面信息",
			"presented.preview": "在侧边栏预览",
			"presented.previewButton": "在侧边栏打开 {name}",
			"presented.previewCard": "在侧边栏预览 {name}",
			"presented.all": "全部 {count} 个文件",
			"presented.expandAria": "展开全部 {count} 个交付文件",
			"presented.collapse": "收起",
			"presented.collapseAria": "收起交付文件列表",
			"presented.opening": "正在打开…",
			"presented.opened": "已请求打开",
			"presented.error": "打开失败，点击重试",
			"presented.file": "文件",
			"row.title": "交付文件",
			"row.running": "正在交付",
			"row.preparing": "准备交付",
			"row.ok": "已交付",
			"row.error": "交付失败",
			"row.stopped": "已中断",
			"row.inspect": "查看调用",
			"changes.title": "已编辑 {count} 个文件",
			"changes.singleTitle": "已编辑 {name}",
			"changes.added": "+{count}",
			"changes.deleted": "-{count}",
			"changes.binary": "二进制",
			"changes.openReview": "在侧边栏查看本轮改动",
			"changes.all": "全部 {count} 个文件",
			"changes.expandAria": "展开全部 {count} 个改动文件",
			"changes.collapse": "收起",
			"changes.collapseAria": "收起改动文件列表",
			"changes.oversized": "过大",
			"changes.viewDiff": "查看 {name} 的改动",
			"review.title": "第 {turn} 轮改动",
			"review.selectFile": "选择要查看的文件",
			"review.split": "切换为左右对比",
			"review.unified": "切换为单栏对比",
			"review.splitAria": "左右对比",
			"review.wrap": "开启自动换行",
			"review.nowrap": "关闭自动换行",
			"review.wrapAria": "自动换行",
			"review.openFile": "在侧边栏打开整个文件",
			"review.openFileAria": "在侧边栏打开 {name}",
			"diff.loading": "正在读取改动…",
			"diff.missing": "这轮改动的内容已不可用",
			"diff.error": "无法读取改动",
			"diff.binary": "二进制文件，无法显示改动",
			"diff.oversized": "文件过大，无法显示改动",
			"diff.created": "本轮新建的文件",
			"diff.deleted": "本轮删除的文件",
			"diff.unchanged": "两侧内容相同",
			"diff.coarse": "逐行对比超时，按整个文件替换显示",
			"diff.truncated": "只显示前 {count} 行"
		};
		/** English dictionary (same key set). */
		const en = {
			"presented.nativeUnavailable": "This file has no available Host path. Preview it in the sidebar.",
			"presented.revealError": "Could not show in file manager. Try again.",
			"presented.directoryError": "Could not open containing folder. Try again.",
			"presented.directoryOpening": "Opening containing folder…",
			"presented.directoryOpened": "Requested opening containing folder",
			"presented.revealed": "Requested display in file manager",
			"presented.revealing": "Showing in file manager…",
			"presented.unavailable": "This Host has no desktop available to open files or folders in external apps. Files can still be previewed in the sidebar.",
			"presented.retry": "Retry",
			"presented.hostError": "Could not read the Host desktop information",
			"presented.preview": "Preview in sidebar",
			"presented.previewButton": "Open {name} in sidebar",
			"presented.previewCard": "Preview {name} in sidebar",
			"presented.all": "All {count} files",
			"presented.expandAria": "Show all {count} delivered files",
			"presented.collapse": "Collapse",
			"presented.collapseAria": "Collapse delivered files",
			"presented.opening": "Opening…",
			"presented.opened": "Open requested",
			"presented.error": "Could not open. Click to retry.",
			"presented.file": "File",
			"row.title": "Present files",
			"row.running": "Delivering",
			"row.preparing": "Preparing deliverables",
			"row.ok": "Delivered",
			"row.error": "Delivery failed",
			"row.stopped": "Interrupted",
			"row.inspect": "Inspect call",
			"changes.title": "Edited {count} files",
			"changes.singleTitle": "Edited {name}",
			"changes.added": "+{count}",
			"changes.deleted": "-{count}",
			"changes.binary": "binary",
			"changes.openReview": "Review this turn’s changes in the sidebar",
			"changes.all": "All {count} files",
			"changes.expandAria": "Show all {count} changed files",
			"changes.collapse": "Collapse",
			"changes.collapseAria": "Collapse changed files",
			"changes.oversized": "too large",
			"changes.viewDiff": "View changes to {name}",
			"review.title": "Review · turn {turn}",
			"review.selectFile": "Choose the file to review",
			"review.split": "Switch to split view",
			"review.unified": "Switch to unified view",
			"review.splitAria": "Split view",
			"review.wrap": "Enable line wrap",
			"review.nowrap": "Disable line wrap",
			"review.wrapAria": "Line wrap",
			"review.openFile": "Open the whole file in the sidebar",
			"review.openFileAria": "Open {name} in sidebar",
			"diff.loading": "Reading changes…",
			"diff.missing": "The contents of this turn’s changes are no longer available",
			"diff.error": "Could not read the changes",
			"diff.binary": "Binary file; changes cannot be shown",
			"diff.oversized": "File too large; changes cannot be shown",
			"diff.created": "Created in this turn",
			"diff.deleted": "Deleted in this turn",
			"diff.unchanged": "Both sides hold the same lines",
			"diff.coarse": "Line comparison timed out; shown as a whole-file replacement",
			"diff.truncated": "Showing the first {count} lines"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Required services for the tail-slot and tab-type registrations and their dictionaries. */
		const inject = [
			"slots",
			"locale",
			"uiConversation",
			"remote",
			"remote.session",
			"sidebarRightTabs",
			"sidebarRight",
			"configForms"
		];
		/**
		* Client plugin body: register the dictionaries, the turn-tail entry, and the comparison tab type.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const opener = new PresentedOpenController();
			const summaries = new ChangesSummaryStore();
			const diffs = new ChangesDiffStore();
			ctx.effect(() => () => Promise.all([
				opener.dispose(),
				summaries.dispose(),
				diffs.dispose()
			]));
			ctx.on("connection/reset", () => {
				opener.resetHost();
				summaries.reset();
				diffs.reset();
			});
			ctx.uiConversation.events.register(deliverablesDefinition);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-deliverables: dictionaries");
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				id: "@deepseek-ai/dsh-client-ui-deliverables",
				locale: NS,
				children: { "deliverables.file.actions": {
					kind: "list",
					scope: "session"
				} },
				inject: () => ({
					hooks: {
						changesDiff: diffs.state,
						presentedOpen: opener.state,
						presentedHost: opener.host,
						changesSummary: summaries.state,
						showCodeDiff: ctx.configForms.developerTools.enabled
					},
					loadChangesDiff: (sessionId, seq, index) => diffs.load(sessionId, seq, index),
					reloadPresentedHost: () => opener.loadHost(),
					loadChangesSummary: (sessionId, seq) => summaries.load(sessionId, seq),
					openPresented: (sessionId, seq, index, action, application) => opener.open(sessionId, seq, index, action, application),
					openChanged: (sessionId, seq, index, action, application) => opener.openChanged(sessionId, seq, index, action, application),
					openChangesReview: (coordinates, index) => {
						ctx.sidebarRight.openResource(changesReviewAddress(coordinates), { params: { index } });
					}
				})
			}, DeliverablesTail));
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "present",
				locale: NS
			}, PresentRow));
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.sidebarRightTabs.register(changesReviewDefinition(t)), "ui-deliverables: changes-review type");
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: CHANGES_REVIEW_ID,
				locale: NS,
				store: createReviewStore(),
				children: { "deliverables.review.file.actions": {
					kind: "list",
					scope: "session"
				} },
				inject: () => ({
					hooks: {
						changesSummary: summaries.state,
						changesDiff: diffs.state,
						presentedOpen: opener.state,
						presentedHost: opener.host
					},
					loadChangesSummary: (sessionId, seq) => summaries.load(sessionId, seq),
					loadChangesDiff: (sessionId, seq, index) => diffs.load(sessionId, seq, index),
					reloadPresentedHost: () => opener.loadHost(),
					openChanged: (sessionId, seq, index, action, application) => opener.openChanged(sessionId, seq, index, action, application)
				})
			}, ReviewTab)), "ui-deliverables: changes-review body");
			ctx.provide("chatFileMentions", { forClosing(owner) {
				const paths = selectProducedFiles(owner);
				const presented = presentedForClosing(owner);
				if (paths === null && presented.length === 0) return void 0;
				return producedFileMentions([...new Set([...paths ?? [], ...presented.map((file) => file.path)])], owner.openFile, (path) => t("presented.previewButton", { name: path }), owner.turn.data.get("deliverables")?.produced.filter((operation) => operation.seq <= owner.seq));
			} });
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
