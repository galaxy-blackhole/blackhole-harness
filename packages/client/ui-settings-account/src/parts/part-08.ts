/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		const onboardingCopy = {
			onboardingArtworkLocale: "zh",
			onboardingWelcome: "欢迎使用",
			onboardingBrand: "DeepSeek Harness",
			onboardingIntroduction: "DeepSeek Harness 会以本地文件夹作为工作区，通过调用各种工具，读写本机文件，完成搜索整理资料、制作文档表格、编写代码、排查问题等各种任务。",
			onboardingStart: "开始设置",
			onboardingCredit: "准备可用额度",
			onboardingCreditDescription: "DeepSeek Harness 执行任务时，会根据模型与工具使用的 token 量扣除额度。请提前添加额度，避免任务在执行过程中被迫中断。你的余额只会在 Agent 实际执行任务时消耗。",
			onboardingTopUp: "去充值",
			onboardingLater: "下一步",
			onboardingFundedTopUp: "去充值",
			onboardingPurposePrefix: "你希望",
			onboardingPurposeSuffix: "帮你做什么？",
			onboardingPurposeDescription: "我们会根据你的选择调整界面和工具，以更适合你的工作方式。",
			onboardingOffice: "办公与创作",
			onboardingOfficeDescription: "编辑文档、整理数据和制作演示文稿等",
			onboardingDevelopment: "代码与开发",
			onboardingDevelopmentDescription: "修改代码、调试问题、运行命令和管理项目文件等",
			onboardingContinue: "继续",
			onboardingProcess: "你希望看到多少工作过程？",
			onboardingProcessDescription: "这只会影响工作过程的展示方式，不会影响 DeepSeek Harness 的工作能力。",
			onboardingCompact: "聚焦结果",
			onboardingCompactDescription: "只看结果，保持界面简洁明了",
			onboardingStandard: "关键细节",
			onboardingStandardDescription: "结果优先，仅展示重要步骤和关键操作",
			onboardingDetailed: "完整过程",
			onboardingDetailedDescription: "查看完整工作过程，方便调试和排查问题",
			onboardingEnter: "进入应用",
			onboardingBack: "上一步",
			onboardingSkip: "跳过",
			onboardingSkipTitle: "跳过设置？",
			onboardingSkipDescription: "你可以随时前往 设置 → 通用设置 中调整工作过程、性能与用量展示方式或开启代码工作工具。",
			onboardingKeepSetting: "继续设置",
			onboardingNoCreditTitle: "暂时跳过充值？",
			onboardingNoCreditDescription: "没有可用额度时，DeepSeek Harness 将无法开始新的任务。你可以稍后前往 设置 → 账号与余额 进行充值。",
			onboardingUnderstood: "我知道了",
			onboardingGoTopUp: "前往充值",
			onboardingSaveFailed: "未能保存设置，请重试。",
			onboardingRetry: "重试",
			onboardingLoading: "正在加载设置…"
		};
		//#endregion
		//#region lib/types/client/locales.js
		/** Account settings copy, owned by the account feature. */
		/** English account dictionary. */
		const en = {
			modelSignInRequired: "Model unavailable. Please sign in and try again.",
			sessionExpired: "You have signed out of your account, please log in again.",
			onboardingArtworkLocale: "en",
			onboardingWelcome: "Welcome to",
			onboardingBrand: "DeepSeek Harness",
			onboardingIntroduction: "DeepSeek Harness works in a local folder and uses tools to read and write files on your computer. It can help you research and organize information, create documents and spreadsheets, write code, troubleshoot issues, and more.",
			onboardingStart: "Get started",
			onboardingCredit: "Add credits",
			onboardingCreditDescription: "DeepSeek Harness charges credits based on the tokens used by models and tools. Add credits in advance to keep your tasks running without interruption. Your balance is only used while the agent is working on a task.",
			onboardingTopUp: "Add credits",
			onboardingLater: "Next",
			onboardingFundedTopUp: "Add credits",
			onboardingPurposePrefix: "What would you like",
			onboardingPurposeSuffix: "to help with?",
			onboardingPurposeDescription: "We’ll tailor the interface and tools to fit the way you work.",
			onboardingOffice: "Office & creative work",
			onboardingOfficeDescription: "Edit documents, organize data, create presentations, and more",
			onboardingDevelopment: "Coding & development",
			onboardingDevelopmentDescription: "Edit code, debug issues, run commands, manage project files, and more",
			onboardingContinue: "Continue",
			onboardingProcess: "How much detail would you like to see?",
			onboardingProcessDescription: "This only changes how progress is shown, not what DeepSeek Harness can do.",
			onboardingCompact: "Results only",
			onboardingCompactDescription: "See just the results in a clean, simple interface",
			onboardingStandard: "Key details",
			onboardingStandardDescription: "Focus on results, with only the most important steps and actions shown",
			onboardingDetailed: "Full details",
			onboardingDetailedDescription: "See the full process for easier debugging and troubleshooting",
			onboardingEnter: "Open app",
			onboardingBack: "Back",
			onboardingSkip: "Skip",
			onboardingSkipTitle: "Skip setup?",
			onboardingSkipDescription: "You can change how progress, performance, and usage are displayed, or enable Coding Tools, anytime in Settings → General.",
			onboardingKeepSetting: "Continue setup",
			onboardingNoCreditTitle: "Skip adding credits?",
			onboardingNoCreditDescription: "DeepSeek Harness can’t start new tasks without credits. You can add them later in Settings → Account.",
			onboardingUnderstood: "Got it",
			onboardingGoTopUp: "Add credits",
			onboardingSaveFailed: "Could not save settings. Try again.",
			onboardingRetry: "Retry",
			onboardingLoading: "Loading settings…",
			close: "Close",
			addApiKey: "Add API Key",
			retry: "Sign in again",
			loginTitle: "Get started",
			loginDescription: "Sign in to your DeepSeek account or add an API Key to get started. Your projects and files are stored locally.",
			browserTitle: "Waiting for sign in",
			browserPrompt: "Page did not open automatically? ",
			copyLink: "Copy sign-in link",
			copiedLink: "Link copied",
			copyFailed: "Copy failed",
			browserDescription: ", then open it in your browser to finish signing in.",
			timeoutTitle: "Sign in timed out",
			timeoutDescription: "Sign in again to continue.",
			failureTitle: "Could not sign in",
			platformFailed: "Could not complete the operation. Try again.",
			platformRetry: "Retry",
			loading: "Loading…",
			backToHarness: "Back to DeepSeek Harness",
			settings: "Settings",
			contactUs: "Feedback",
			menu: "Account menu",
			nav: "Account",
			signedIn: "Signed in to DeepSeek",
			signedOut: "Not signed in",
			signIn: "Sign in",
			signOut: "Sign out",
			signOutUnknownDescription: "Could not check running tasks. Signing out may interrupt tasks using this account. Sign out now?",
			signOutDescription: "Signing out will not delete any data. You can sign in to this account again.",
			signOutRunningDescription: "Tasks are currently running. Signing out will interrupt them. Sign out now?",
			cancel: "Cancel",
			open: "Open browser",
			initializing: "Starting sign in…",
			waiting: "Continue in your browser",
			completing: "Completing sign in…",
			expired: "Sign in expired. Try again.",
			failed: "Could not complete the operation. Try again.",
			noResponse: "Something went wrong. Please check your network connection and try again.",
			settingsSignedOutTitle: "You are not signed in to DeepSeek Harness",
			settingsSignedOutDescription: "Sign in to DeepSeek Harness to get your dedicated API Key",
			signInDescription: "Use your DeepSeek account to get started.",
			profileUnavailable: "Account details are not available yet.",
			balance: "Topped-up balance",
			bonusBalance: "Granted balance",
			balanceUnavailable: "View on Platform",
			balanceSignedOut: "Sign in to view",
			accountInfo: "More account information",
			more: "More",
			usage: "View usage",
			topUp: "Top up",
			quotaTitle: "No balance available",
			quotaDescription: "DeepSeek Harness cannot start a new task with this account when no balance is available. Would you like to top up? You can also top up later in Settings → Account.",
			quotaTopUp: "Top up",
			bonusNoticeTitle: "Bonus credited"
		};
		/** Chinese account settings copy. */
		const zh = {
			modelSignInRequired: "当前模型暂不可用，请登录后再试",
			sessionExpired: "登录信息已失效，请重新登录",
			...onboardingCopy,
			close: "关闭",
			addApiKey: "添加 API Key",
			retry: "重新登录",
			loginTitle: "开始使用",
			loginDescription: "登录 DeepSeek 账号，或添加 API Key，即可开始使用。你的项目和文件保存在本地。",
			browserTitle: "等待登录",
			browserPrompt: "没有自动打开新页面？",
			copyLink: "复制登录链接",
			copiedLink: "链接已复制",
			copyFailed: "复制失败",
			browserDescription: "，手动打开登录页完成登录。",
			timeoutTitle: "登录已超时",
			timeoutDescription: "请重新登录后继续操作。",
			failureTitle: "登录失败",
			platformFailed: "操作未完成，请重试",
			platformRetry: "重试",
			loading: "加载中…",
			backToHarness: "返回 DeepSeek Harness",
			settings: "设置",
			contactUs: "意见反馈",
			menu: "账号菜单",
			nav: "账号与余额",
			signedIn: "已登录 DeepSeek",
			signedOut: "尚未登录",
			signIn: "登录",
			signOut: "退出登录",
			signOutUnknownDescription: "暂时无法确认任务状态。退出登录可能会中断使用此账号的任务，是否继续？",
			signOutDescription: "退出登录不会丢失任何数据，你仍可以登录此账号。",
			signOutRunningDescription: "当前有进程正在执行中，点击“退出登录”，将会打断进程，是否即刻退出登录？",
			cancel: "取消",
			open: "打开浏览器",
			initializing: "正在发起登录…",
			waiting: "请在浏览器中继续",
			completing: "正在完成登录…",
			expired: "登录已过期，请重试。",
			failed: "操作未完成，请重试。",
			noResponse: "操作未完成，可能是网络异常，请检查你的网络状况后重试",
			settingsSignedOutTitle: "当前未登录 DeepSeek Harness 账号",
			settingsSignedOutDescription: "登录 DeepSeek Harness 账号获取专属 API Key",
			signInDescription: "登录 DeepSeek 账号以开始使用",
			profileUnavailable: "账号资料暂不可用",
			balance: "充值余额",
			bonusBalance: "赠金余额",
			balanceUnavailable: "前往开放平台查看",
			balanceSignedOut: "登录后查看",
			accountInfo: "更多账号信息",
			more: "更多",
			usage: "查询用量",
			topUp: "充值",
			quotaTitle: "当前无可用余额",
			quotaDescription: "没有可用额度时，DeepSeek Harness 无法开始新的任务，是否前往充值？或者可以稍后前往 设置 → 账号与余额 进行充值。",
			quotaTopUp: "去充值",
			bonusNoticeTitle: "赠金已到账"
		};
		//#endregion
		//#region lib/types/client/AccountQuotaNotice.js
		/** Account-owned take-over of the frame-wide quota notice for account balances. */
		/**
		* @param props - the claimed notice, account state, and the shared Platform page channel.
		* @returns the balance Modal, nothing while awaiting account state or a Platform page's return, or the fallback Toast.
		*/
		function AccountQuotaNotice({ matched, openPlatformPage, useAccount, usePlatformPage, t }) {
			const { dismiss, keepOpen, message } = matched;
			const accountStatus = useAccount((snapshot) => snapshot.view?.status);
			const accountFailed = useAccount((snapshot) => snapshot.failed);
			const signedIn = accountStatus === "credential-stored";
			const platformPage = usePlatformPage((current) => current);
			const [opened, setOpened] = (0, react.useState)(false);
			const previousSignedIn = (0, react.useRef)(signedIn);
			const releaseHold = (0, react.useRef)(void 0);
			const releasePage = (0, react.useRef)(void 0);
			const releaseClaims = () => {
				releasePage.current?.();
				releasePage.current = void 0;
				releaseHold.current?.();
				releaseHold.current = void 0;
			};
			(0, react.useEffect)(() => releaseClaims, []);
			(0, react.useEffect)(() => {
				if (previousSignedIn.current && !signedIn) {
					releaseClaims();
					dismiss();
				}
				previousSignedIn.current = signedIn;
			}, [dismiss, signedIn]);
			if (accountStatus === void 0 && !accountFailed && openPlatformPage !== void 0) return null;
			if (!signedIn || openPlatformPage === void 0) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: message,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 18 }),
				onDone: dismiss
			});
			if (opened || platformPage !== null) return null;
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: t("quotaTitle"),
				closeLabel: t("close"),
				onClose: dismiss,
				description: t("quotaDescription"),
				footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					onClick: dismiss,
					children: t("cancel")
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					onClick: () => {
						releaseHold.current = keepOpen();
						releasePage.current = openPlatformPage("top-up", () => {
							releasePage.current = void 0;
							dismiss();
						});
						setOpened(true);
					},
					children: t("quotaTopUp")
				})] })
			});
		}
		//#endregion
		//#region lib/types/onboarding-settings.js
		/** Device-local onboarding progress stored in the Host settings document. */
		/** Account feature's durable onboarding namespace. */
		const DESKTOP_ONBOARDING_NAMESPACE = "ui-settings-account";
		/** Validated defaults for a fresh installation. */
		const OnboardingSettingsFields = {
			version: Schema.const(1).default(1),
			step: Schema.union([
				"welcome",
				"credit",
				"purpose",
				"process",
				"done"
			]).default("welcome"),
			purpose: Schema.union([
				"office",
				"development",
				"both",
				Schema.const(null)
			]),
			process: Schema.union([
				"compact",
				"standard",
				"detailed",
				Schema.const(null)
			]),
			completion: Schema.union([
				"completed",
				"skipped",
				"api-key",
				Schema.const(null)
			]),
			usage: Schema.union(["compact", "detailed"]).default("compact"),
			developerTools: Schema.boolean().default(false)
		};
		Schema.object(OnboardingSettingsFields);
		//#endregion
		//#region lib/types/client/onboarding-balance.js
		/** Available onboarding credit includes both purchased and granted wallets. */
		/**
		* Check purchased and granted credit without treating a pending query as zero.
		* @param balance - current account balance result.
		* @returns whether either wallet group has positive credit.
		*/
		function hasOnboardingCredit(balance) {
			return balance?.status === "ready" && [...balance.value, ...balance.bonusWallets].some((wallet) => new Big(wallet.balance).gt(0));
		}
		//#endregion
		//#region lib/types/client/onboarding-state.js
		function freshProgress() {
			return {
				version: 1,
				step: "welcome",
				purpose: null,
				process: null,
				completion: null,
				usage: "compact",
				developerTools: false
			};
		}
		/** Host-backed progress; completing writes active preferences before the durable done marker. */
		var DesktopOnboardingController = class {
			progress;
			chat;
			setDeveloperTools;
			account;
			readApiKeyPresence;
			settings;
			/** Private observable projected into the shell overlay's framework hook. */
			state = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				status: "loading",
				visible: false,
				progress: freshProgress(),
				error: null,
				creditFunded: false
			});
			disposers;
			saving = false;
			completing = false;
			draft;
			updates = Promise.resolve(true);
			disposed = false;
			credentialGeneration = 0;
			hasApiKey;
			checkingKeys = false;
			error = null;
			failedWrite;
			creditFunded;
			/**
			* @param progress - installation-scoped durable progress.
			* @param chat - existing Chat settings owner.
			* @param setDeveloperTools - persist enablement through the shared developer-tools preference.
			* @param account - safe account state, initially unresolved.
			* @param settings - shared settings reader exposing initial failures and retry.
			* @param readApiKeyPresence - reads configured model-credential metadata without secrets.
			*/
			constructor(progress, chat, setDeveloperTools, account, readApiKeyPresence, settings) {
				this.progress = progress;
				this.chat = chat;
				this.setDeveloperTools = setDeveloperTools;
				this.account = account;
				this.readApiKeyPresence = readApiKeyPresence;
				this.settings = settings;
				this.disposers = [
					settings.subscribe(() => {
						this.derive();
					}),
					progress.subscribe(() => {
						this.derive();
					}),
					chat.subscribe(() => {
						this.derive();
					}),
					account.subscribe(() => {
						this.derive();
					})
				];
				this.derive();
			}
			/** Recheck credential metadata after a provider or credential invalidation. */
			invalidateCredentials() {
				this.credentialGeneration++;
				this.checkingKeys = false;
				this.hasApiKey = void 0;
				if (this.failedWrite?.next.completion === "api-key") {
					this.error = null;
					this.failedWrite = void 0;
				}
				this.derive();
			}
			/**
			* Preview a step or selection immediately and serialize its persistence; the last rejected write restores saved progress.
			* @param change - user-selected progress fields.
			* @returns whether Host settings accepted the complete next progress value.
			*/
			async update(change) {
				if (this.completing || this.saving && this.draft === void 0 || this.disposed || this.account.getSnapshot().view?.status !== "credential-stored") return false;
export {};
