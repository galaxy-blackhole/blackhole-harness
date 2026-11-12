/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				"> 搜索表单连续提交两次后，结果会消失。请定位原因、修复问题并运行相关测试，最后说明原因和修改内容。",
				"预期产出：代码修改、相关测试结果，以及问题原因说明。",
				"### 整理项目资料",
				"> 阅读项目中的 Markdown 记录，整理已经达成的结论和仍待确认的问题，并附上对应文件链接。",
				"预期产出：一份带来源引用的总结，方便回到原文核对。"
			].join("\n\n"),
			guidePtcIntro: "新建任务时选择「PTC 模式」，说明输入文件、处理规则和输出格式。代码由 Agent 编写。",
			guidePtcExplanation: [
				"### 怎样调用工具",
				"PTC 是 Programmatic Tool Calling，即通过程序调用工具。当前内置预设让 Agent 通过 run_code 编写 TypeScript 程序，使用生成的工具 SDK 发起调用。程序可以组织循环、条件判断、错误处理，以及适合并发执行的调用。",
				"### 哪些结果交给模型",
				"工具返回的数据先交给程序，经过筛选、计算或合并，再通过输出或返回值交给模型；图片结果会另行附加。程序中的工具调用仍会被记录，也仍受工具权限约束。",
				"### 与标准模式的区别",
				"两种模式都能编程、批量处理文件。标准模式直接向模型提供各个工具；PTC 让模型用代码组织工具调用。当前 PTC 预设未启用 workflow 工具。速度和 token 用量取决于具体任务与结果处理方式。"
			].join("\n\n"),
			guidePtcUsage: [
				"### 批量检查配置文件",
				"> 检查 configs/ 下所有 JSON 文件，按照 schema.json 找出缺失字段和不合法的值。每个问题写成 CSV 中的一行；读取失败的文件也记入报告，继续检查其余文件。保留原文件。",
				"预期产出：问题汇总和一份 CSV 报告。程序可以对多份文件执行相同检查，处理单个文件的失败，再汇总结果。",
				"### 汇总错误日志",
				"> 分析 logs/ 下的日志，按服务和错误类型统计次数，列出出现最多的十类错误，每类保留一条示例。完整统计另存为 CSV。",
				"预期产出：高频错误摘要和完整统计表。中间数据可以先在程序中聚合，再把汇总交给模型。"
			].join("\n\n"),
			guideMinimalIntro: "新建任务时选择「极简模式」。做对照测试时，保持模型、权限、任务输入和工作区起始状态一致。",
			guideMinimalExplanation: [
				"### 保留哪些能力",
				"提供持久 Shell 和 read_image 工具，并使用固定系统提示词。读取图片需要支持图片输入的模型。上下文压力达到阈值时自动压缩较早历史；Agent 空闲时可输入 /compact 手动压缩。内置预设不加载 Skills、计划，也不注入标准运行时上下文。",
				"### 什么时候选",
				"适合作为实验和对照测试的基线。Agent 仍能通过终端命令读写文件、运行脚本，但缺少管理长任务的内置辅助能力。工具少，不代表对新手更容易。"
			].join("\n\n"),
			guideMinimalUsage: [
				"### 对比基础修复表现",
				"> 运行这个项目的测试，找出失败原因，做最小修复，再运行相关测试并报告结果。",
				"分别用标准模式和极简模式，从相同的工作区状态执行这条任务，对比完成情况、工具调用和最终修改。极简模式会通过终端命令完成这些操作。"
			].join("\n\n"),
			guideCordisIntro: "新建任务时选择「创造模式」，说明希望增加什么能力、从哪里使用，以及怎样验证效果。",
			guideCordisExplanation: [
				"### 可以创造什么",
				"创造模式具备标准任务工具，并增加运行时检查、持久化插件管理，以及 Cordis 插件和 Agent 预设的开发指引。可以编写插件来添加功能或界面，也可以组合工具和提示词，创建适合特定任务的模式。",
				"### 插件与模式的关系",
				"插件为 DSH 增加能力，例如工具、服务连接或界面入口。模式是一份 Agent 预设，用来选择任务可用的工具，并约定 Agent 的工作方式。自定义模式中也可以使用自己开发的插件。",
				"### 怎样让成果生效",
				"可以要求 Agent 完成安装并验证实际效果。插件可能即时加载，也可能需要重启，取决于修改内容；新建的模式在创建新任务时选择。"
			].join("\n\n"),
			guideCordisUsage: [
				"### 添加一个界面",
				"> 帮我写一个 DSH 插件，在侧栏增加「项目笔记」入口，列出当前工作区的 Markdown 文件，点击后能预览内容。完成安装并验证页面能打开。",
				"预期产出：带侧栏入口和预览页的插件，以及仍需完成的生效步骤。",
				"### 添加一个工具",
				"> 写一个插件，提供读取项目测试报告、汇总失败用例的工具。注册工具，并用一份示例报告验证调用结果。",
				"预期产出：可调用的新工具，以及一次示例调用的验证结果。",
				"### 创建自己的模式",
				"> 基于标准模式创建「代码审查」模式，优先检查潜在错误和测试缺口，指出文件与行号，修改文件前先询问我。保存成可选择的预设。",
				"预期产出：可在新任务中选择的自定义模式。审查要求用于指导 Agent，实际可执行的操作仍由权限设置决定。"
			].join("\n\n")
		};
		//#endregion
		//#region ../../preset/agent-preset-registry/src/display.ts
		const BUILT_IN_PRESET_KEYS = {
			standard: {
				name: "presetStandardName",
				description: "presetStandardDescription"
			},
			ptc: {
				name: "presetPtcName",
				description: "presetPtcDescription"
			},
			minimal: {
				name: "presetMinimalName",
				description: "presetMinimalDescription"
			},
			cordis: {
				name: "presetCordisName",
				description: "presetCordisDescription"
			}
		};
		/**
		* Whether a roster row is one of the shipped presets whose copy the dictionaries carry.
		* A shipped preset publishes no `name`; a declaration that names itself owns its copy.
		* @param preset - roster row.
		* @returns true for a shipped preset id without a published name.
		*/
		function isBuiltInPreset(preset) {
			return preset.name === void 0 && BUILT_IN_PRESET_KEYS[preset.id] !== void 0;
		}
		/**
		* Resolve preset display copy without making user-authored metadata translatable.
		* @param preset - roster row whose copy is being rendered.
		* @param t - active locale lookup covering {@link BuiltInPresetCopyKey}.
		* @returns localized copy for a known shipped preset, otherwise declaration metadata.
		*/
		function presetDisplayText(preset, t) {
			const keys = isBuiltInPreset(preset) ? BUILT_IN_PRESET_KEYS[preset.id] : void 0;
			if (keys !== void 0) return {
				name: t(keys.name),
				description: t(keys.description)
			};
			return {
				name: preset.name ?? preset.id,
				...preset.description === void 0 ? {} : { description: preset.description }
			};
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Locale bundles for the agent-preset hero chip, header label, and management section. */
		/** English copy. */
		const en = {
			...guideEn,
			builtInGroup: "Built-in",
			customGroup: "Custom",
			sectionIntro: "Choose the agent’s tools and how it works. Use Standard mode for everyday tasks, or Creator mode to add capabilities to DSH.",
			seatHint: "Choose the agent preset for your new task",
			headerHint: "The agent preset chosen when this task started",
			nav: "Agent presets",
			setDefault: "Set as new task default",
			view: "View configuration",
			presetStandardName: "Standard mode",
			presetStandardDescription: "Work with code, files, and information. Suitable for most tasks, with search, editing, terminal commands, and other tools available as needed.",
			presetPtcName: "PTC mode",
			presetPtcDescription: "Includes all Standard mode capabilities. Better suited to tasks that call tools in batches and then filter, organize, deduplicate, count, or summarize the results.",
			presetMinimalName: "Minimal mode",
			presetMinimalDescription: "The agent uses a terminal and image reading, with context compaction. Useful for testing and comparing its basic performance.",
			presetCordisName: "Creator mode",
			presetCordisDescription: "Customize DSH through conversation. Let the agent write plugins that add features or UI, or combine tools and prompts to create your own mode.",
			inUse: "New task default",
			noDescription: "No description.",
			brokenBadge: "Failed to load",
			switchRefused: "Could not switch to {name}: {reason}",
			standardUnavailable: "Standard mode is unavailable. Restore it or choose another available mode.",
			close: "Close",
			creatorDraft: "Let the agent help me create a preset",
			createPlugin: "Let the agent create a plugin",
			createPluginDescription: "Enter Creator mode and make your own DSH plugin",
			createPluginChecking: "Checking whether Creator mode is available",
			createPluginUnavailable: "Temporarily unavailable. Reopen this menu to retry",
			createPluginMissing: "Creator mode is not included in this configuration"
		};
		/** Simplified Chinese copy. */
		const zh = {
			...guideZh,
			builtInGroup: "内置",
			customGroup: "自定义",
			sectionIntro: "选择 Agent 的工具和工作方式。日常任务用「标准模式」，扩展 DSH 的能力用「创造模式」。",
			seatHint: "选择新任务使用的 Agent 预设",
			headerHint: "本任务的 Agent 预设，在任务开始时确定",
			nav: "Agent 预设",
			setDefault: "设为新任务默认",
			view: "查看配置",
			presetStandardName: "标准模式",
			presetStandardDescription: "处理代码、文件和资料，适合大多数任务。Agent 会按需使用检索、编辑和终端等工具。",
			presetPtcName: "PTC 模式",
			presetPtcDescription: "包含标准模式的所有能力，更适合批量调用工具，并对结果进行筛选、整理、去重、统计或汇总的任务。",
			presetMinimalName: "极简模式",
			presetMinimalDescription: "Agent 使用终端和图片读取工具，并支持上下文压缩，适合测试和对比其基础表现。",
			presetCordisName: "创造模式",
			presetCordisDescription: "用对话定制 DSH：让 Agent 编写插件，添加新功能或界面；也能组合工具和提示词，创建自己的模式。",
			inUse: "新任务默认",
			noDescription: "暂无描述。",
			brokenBadge: "加载失败",
			switchRefused: "无法切换到「{name}」：{reason}",
			standardUnavailable: "标准模式不可用，请恢复该模式或选择其他可用模式。",
			close: "关闭",
			creatorDraft: "让 Agent 帮我创建预设模式",
			createPlugin: "让 Agent 创建插件",
			createPluginDescription: "进入创造模式，制作属于你的 DSH 插件",
			createPluginChecking: "正在确认创造模式是否可用",
			createPluginUnavailable: "暂时不可用，请重新打开菜单重试",
			createPluginMissing: "当前配置未提供创造模式"
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-agent-preset/src/client/AgentPresetLabel.module.css.mjs
		const css$4 = ".SVAs4q_label{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-fill-tsp-secondary);max-width:180px;height:22px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;align-items:center;gap:4px;padding:0 2px 0 0;font-size:12px;line-height:22px;display:inline-flex;overflow:hidden}.SVAs4q_icon{opacity:.7;flex:none}@container (width<=540px){.SVAs4q_label{display:none}}";
		const tagId$4 = "@deepseek-ai/dsh-client-ui-agent-preset/AgentPresetLabel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-agent-preset";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var AgentPresetLabel_module_css_default = {
			"icon": "SVAs4q_icon",
			"label": "SVAs4q_label"
		};
		//#endregion
		//#region lib/types/client/AgentPresetLabel.js
		/**
		* The session header's agent-preset label.
		*
		* Read-only by construction: a session's composition is fixed once its
		* conversation starts, and a header is only worth reading after that. Offering
		* a control here would promise a switch the host refuses; naming what the
		* session runs is the honest affordance, and the choice itself lives on the
		* new-session screen ({@link AgentPresetSeat}).
		*/
		/**
		* Render this session's agent-preset name beside its title.
		* @param props - composed slot props.
		* @returns the label, or null when the session records no preset.
		*/
		function AgentPresetLabel({ sessionId, useSessions, useAgentPresets, load, t }) {
			const preset = useSessions((state) => {
				const value = state.byId[sessionId]?.projectionValues?.agentPreset;
				return typeof value === "string" ? value : void 0;
			});
			const options = useAgentPresets((state) => state.options);
			(0, react.useEffect)(() => {
				if (preset !== void 0) load();
			}, [preset, load]);
			if (preset === void 0) return null;
			const option = options.find((entry) => entry.id === preset);
			const text = option === void 0 ? void 0 : presetDisplayText(option, t);
			return (0, react_jsx_runtime.jsxs)("span", {
				className: AgentPresetLabel_module_css_default.label,
				title: text?.description ?? t("headerHint"),
				children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutlineRegular, {
					size: 14,
					className: AgentPresetLabel_module_css_default.icon
				}), text?.name ?? preset]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-agent-preset/src/client/CreatePluginMenuItem.module.css.mjs
		const css$3 = ".ejSU7q_copy{white-space:normal;flex-direction:column;gap:2px;min-width:0;display:flex}.ejSU7q_description{overflow-wrap:anywhere;max-height:36px;color:var(--dsw-alias-label-secondary);-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:12px;line-height:18px;display:-webkit-box;overflow:hidden}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-agent-preset/CreatePluginMenuItem.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-agent-preset";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var CreatePluginMenuItem_module_css_default = {
			"copy": "ejSU7q_copy",
			"description": "ejSU7q_description"
		};
		//#endregion
		//#region lib/types/client/CreatePluginMenuItem.js
		/** Create a plugin through the existing Creator flow from the Add plugin menu. */
		/**
		* Close the Add plugin menu before opening Creator without sending a message.
		* @param props - locale, roster, dismissal and navigation callbacks.
		* @returns a stable menu item that explains why Creator is unavailable.
		*/
		function CreatePluginMenuItem({ t, useAgentPresets, load, onDismiss, startCreatorDraft }) {
			const roster = useAgentPresets((state) => state);
			const enabled = roster.status === "ready" && roster.options.some((option) => option.id === "cordis");
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			let description = t("createPluginDescription");
			if (roster.status === "idle" || roster.status === "loading") description = t("createPluginChecking");
			else if (roster.status === "error" || roster.status === "unavailable") description = t("createPluginUnavailable");
			else if (!enabled) description = t("createPluginMissing");
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutlineRegular, { size: 14 }),
				disabled: !enabled,
				onSelect: () => {
					onDismiss();
					startCreatorDraft();
				},
				children: (0, react_jsx_runtime.jsxs)("span", {
					className: CreatePluginMenuItem_module_css_default.copy,
					children: [(0, react_jsx_runtime.jsx)("span", { children: t("createPlugin") }), (0, react_jsx_runtime.jsx)("span", {
						className: CreatePluginMenuItem_module_css_default.description,
						title: description,
						children: description
					})]
				})
			});
		}
		//#endregion
		//#region lib/types/client/settings-store.js
		/**
		* Agent-preset roster store shared by the display surfaces.
		*
		* Options come from one `agentPresets.list` call. Writes target the settings
		* namespace fields the host resolves at creation; the management section is
		* the surface that writes them.
		*/
		/** The agent-preset settings namespace on the host wire. */
		const AGENT_PRESET_SETTINGS_NS = "agent-preset-registry";
		/**
		* Persist one preset as the default for sessions created later.
		*
		* The default is a settings field rather than a preset property; the
		* management section writes it here — one home for which namespace and field
		* the host resolves at session creation.
		* @param ctx - the browser plugin context carrying the Remote namespaces.
		* @param id - the preset to make default.
		* @param expectedRevision - optional fence for an automatic correction based on a previous settings read.
		* @returns the failure message, or undefined once the write landed.
		*/
		async function writeDefaultPreset(ctx, id, expectedRevision) {
			const response = await ctx.remote.settings.update(AGENT_PRESET_SETTINGS_NS, { selectedDefault: id }, expectedRevision);
			return response.ok ? void 0 : response.error.message;
		}
		/** Whether a shipped preset requires the Coding Tools preference.
		* @param preset Roster entry; named custom overrides keep their own behavior.
		* @returns True only for the built-in PTC and Minimal presets.
		*/
		function requiresCodingTools(preset) {
			return preset !== void 0 && isBuiltInPreset(preset) && (preset.id === "ptc" || preset.id === "minimal");
		}
		const EMPTY_ROSTER = { presets: [] };
		/**
		* Read the roster, turning a refusal into the message every surface shows.
		* @param ctx - the browser plugin context carrying the Remote namespaces.
		* @returns the roster, or the message to show in its place.
		*/
		async function readRoster(ctx) {
			const result = await ctx.remote.agentPresets.list();
			if (result.ok) return {
				ok: true,
				value: result.value
			};
			if (result.error.code === "gateway/invocation-unavailable") return {
				ok: true,
				value: EMPTY_ROSTER
			};
			return {
				ok: false,
				error: result.error.message
			};
		}
		/**
		* The opening move every roster-backed surface makes: refuse a read that is
		* already in flight, mark the store loading, then read.
		*
		* A surface that gets `undefined` returns without touching its snapshot
		* further — either another read owns it, or this one already wrote the
		* failure. What differs between surfaces starts after this.
		* @param ctx - the browser plugin context carrying the Remote namespaces.
		* @param store - the surface's own snapshot store.
		* @returns the roster, or undefined when the caller should return.
		*/
		async function beginRosterRead(ctx, store) {
			const before = store.getSnapshot();
			if (before.status === "loading") return void 0;
			store.set({
				...before,
				status: "loading",
				error: null
			});
			const roster = await readRoster(ctx);
			if (roster.ok) return roster.value;
			store.set({
				...store.getSnapshot(),
				status: "error",
				error: roster.error
			});
		}
		/**
		* The roster entries as the pickers render them: healthy presets only.
		*
		* The chip exists to choose the NEXT session's composition, and a broken
		* preset cannot compose one — offering it would defer the discovery of that
		* fact to a failed session start. The management section renders the full
		* roster (broken rows included) from its own store instead.
		*
		* The chip, the header label, and the management section all show the same
		* facts, and `exactOptionalPropertyTypes` makes "absent" and "present as
		* undefined" different shapes — so the spread dance belongs in one place rather than
		* once per store.
		* @param presets - the roster the host answered with.
		* @returns one option per selectable preset, in roster order.
		*/
		function presetOptions(presets) {
			return presets.filter((preset) => preset.broken === void 0).map((preset) => ({
				id: preset.id,
				...preset.name === void 0 ? {} : { name: preset.name },
				...preset.description === void 0 ? {} : { description: preset.description }
			}));
		}
		const INITIAL$2 = {
			status: "idle",
			error: null,
			options: []
		};
		/** Reads the roster for the surfaces that only display it. */
		var AgentPresetSettingsController = class {
			ctx;
			/** Roster snapshot the renderer subscribes to. */
			store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(INITIAL$2);
			/**
			* @param ctx - the browser plugin context (the roster read).
			*/
			constructor(ctx) {
				this.ctx = ctx;
			}
			set(patch) {
				this.store.set({
					...this.store.getSnapshot(),
					...patch
				});
			}
			/**
			* Load the roster. An empty roster means the deployment composes no
			* presets, which is a valid deployment rather than a failure — the
			* surfaces report `unavailable` and render nothing.
export {};
