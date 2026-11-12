/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-tool",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		//#region ../../util/workspace-path/src/index.ts
		/** Whether a path uses a Windows drive or UNC prefix. */
		function isWindowsStylePath(value) {
			return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
		}
		/**
		* Whether a path is absolute in either spelling the Host accepts: POSIX (`/a/b`) or Windows drive or UNC.
		* @param path - the path to classify.
		* @returns `true` for an absolute path; `false` for a Workspace-relative one.
		*/
		function isAbsoluteWorkspacePath(path) {
			return path.startsWith("/") || isWindowsStylePath(path);
		}
		/**
		* Resolve a Workspace-relative path into the Host-facing spelling used by path operations.
		* @param cwd - Session Workspace root, when known.
		* @param path - Absolute or Workspace-relative path.
		* @returns an absolute path when a Workspace root is available, otherwise the original path.
		*/
		function resolveWorkspacePath(cwd, path) {
			if (isAbsoluteWorkspacePath(path)) return path;
			if (cwd === void 0 || cwd === "") return path;
			const separator = isWindowsStylePath(cwd) && cwd.includes("\\") ? "\\" : "/";
			return `${cwd.replace(/[/\\]+$/, "")}${separator}${path.replace(/^[/\\]+/, "")}`;
		}
		/**
		* Abbreviate a POSIX home directory for display.
		* @param path - Absolute or already-short display path.
		* @param home - Host account home; absent skips abbreviation.
		* @returns `~` or `~/…` for the POSIX home and its descendants, otherwise `path`.
		*/
		function abbreviateHomePath(path, home) {
			if (home === void 0 || home === "") return path;
			if (isWindowsStylePath(path) || isWindowsStylePath(home)) return path;
			const root = home.replace(/\/+$/, "");
			if (root === "" || root === "/") return path;
			if (path.replace(/\/+$/, "") === root) return "~";
			if (path.startsWith(`${root}/`)) return `~${path.slice(root.length)}`;
			return path;
		}
		/**
		* Strip the workspace root from a workspace-rooted absolute path (display only).
		* @param text - the path to shorten.
		* @param cwd - session workspace root; absent or empty leaves the path unchanged.
		* @returns the path relative to the workspace root, or unchanged when it is not rooted there.
		*/
		function relativizeToCwd(text, cwd) {
			if (cwd === void 0 || cwd === "") return text;
			const root = cwd.replace(/[/\\]+$/, "");
			if (text.startsWith(`${root}/`) || text.startsWith(`${root}\\`)) return text.slice(root.length + 1);
			return text;
		}
		//#endregion
		//#region lib/types/client/tool/models/recorded-path.js
		/** Operation-time filesystem locations carried by settled tool results. */
		/**
		* Read one absolute location from opaque persisted result metadata.
		* @param meta - tool-owned result metadata from the Session log.
		* @param field - the file path or command working directory.
		* @returns the recorded path, or undefined for old or malformed metadata.
		*/
		function recordedAbsolutePath(meta, field) {
			if (meta === null || typeof meta !== "object" || Array.isArray(meta)) return void 0;
			const value = meta[field];
			return typeof value === "string" && isAbsoluteWorkspacePath(value) ? value : void 0;
		}
		//#endregion
		//#region lib/types/client/tool/models/tool-call-model.js
		/** Locale key per generic row variant. */
		const VARIANT_TITLE_KEYS = {
			search: "tool.title.search",
			read: "tool.title.read",
			bash: "tool.title.bash",
			write: "tool.title.write",
			edit: "tool.title.edit",
			code: "tool.title.code",
			others: "tool.title.generic"
		};
		/**
		* Known tool name -> variant.
		*
		* `cordis_define` is deliberately absent: ui-cordis registers a keyed
		* `tool.call.toolview` entry for it, and a keyed hit REPLACES the generic row
		* (this table is only reached through GenericToolCard, the dispatch fallback in
		* ToolCallTree). An entry here would be unreachable, and a second title for the
		* same call would be a second answer to a question the card already owns.
		*/
		const TOOL_VARIANTS = {
			bash: "bash",
			pwsh: "bash",
			read: "read",
			read_image: "read",
			web_fetch: "read",
			web_search: "search",
			grep: "search",
			glob: "search",
			write: "write",
			edit: "edit",
			run_code: "code",
			cordis_package_inspect: "read",
			cordis_runtime_inspect: "read",
			cordis_run: "others",
			cordis_stop: "others",
			cordis_undefine: "others"
		};
		/** Tool-owned titles that refine a generic row variant without replacing it. */
		const TOOL_TITLE_KEYS = {
			cordis_package_inspect: "tool.title.inspect",
			cordis_runtime_inspect: "tool.title.inspect",
			cordis_run: "tool.title.runCordis",
			cordis_stop: "tool.title.stopCordis",
			cordis_undefine: "tool.title.removeCordis",
			pwsh: "tool.title.pwsh",
			read_image: "tool.title.readImage",
			todo_write: "todo.rowTitle",
			ask_user_question: "ask.rowTitle",
			create_goal: "tool.title.createGoal",
			get_goal: "tool.title.getGoal",
			update_goal: "tool.title.updateGoal",
			schedule_create: "tool.title.createSchedule",
			schedule_list: "tool.title.listSchedules",
			schedule_delete: "tool.title.deleteSchedule",
			schedule_update: "tool.title.updateSchedule",
			cordis_inspect_list: "tool.title.inspectProviders",
			cordis_inspect_query: "tool.title.queryRuntime",
			cordis_inspect_self: "tool.title.inspectPlugins",
			workflow: "tool.title.workflow",
			ralph: "tool.title.ralph",
			session_event_read: "tool.title.readEvent",
			session_event_search: "tool.title.searchEvents",
			session_event_trace: "tool.title.traceEvent",
			session_search: "tool.title.searchSessions",
			session_trace: "tool.title.traceSession",
			list_subagent_models: "tool.title.listModels",
			subagent: "tool.title.subagent",
			list_agents: "tool.title.listAgents",
			send_message: "tool.title.sendMessage",
			interrupt_agent: "tool.title.interruptAgent",
			job_list: "tool.title.listJobs",
			job_output: "tool.title.readJob",
			job_kill: "tool.title.killJob",
			terminal_open: "tool.title.openTerminal",
			terminal_read: "tool.title.readTerminal",
			terminal_list: "tool.title.listTerminals",
			terminal_signal: "tool.title.signalTerminal",
			terminal_close: "tool.title.closeTerminal",
			lsp: "tool.title.lsp",
			spawn_teammate: "tool.title.spawnTeammate",
			team_task_create: "tool.title.createTeamTask",
			team_task_get: "tool.title.getTeamTask",
			team_task_update: "tool.title.updateTeamTask",
			team_task_list: "tool.title.listTeamTasks",
			wait_agent: "tool.title.waitAgent"
		};
		/**
		* Classify a tool name into its row variant.
		* @param toolName - wire tool name.
		* @returns matching variant, others when unknown.
		*/
		function classifyTool(toolName) {
			return TOOL_VARIANTS[toolName] ?? "others";
		}
		/**
		* Select a tool-owned or generic title without reading arguments.
		* @param toolName - wire tool name.
		* @returns the localized title key.
		*/
		function toolTitleKey(toolName) {
			return TOOL_TITLE_KEYS[toolName] ?? VARIANT_TITLE_KEYS[classifyTool(toolName)];
		}
		function deriveAutoReviewDenial(block) {
			if (!("kind" in block) || !block.isError) return null;
			const error = block.error;
			if (error?.name !== "AutoReviewDeniedError" || error.code !== "AUTO_REVIEW_DENIED") return null;
			return { reason: typeof error.reason === "string" ? error.reason : null };
		}
		/**
		* Flatten a settled result's content blocks to display text: text blocks
		* verbatim, other block shapes as pretty JSON. Empty content on a failed call
		* falls back to the structured error's `name: code` line.
		* @param node - the settled result node.
		* @returns the flattened result text (may be empty).
		*/
		function resultText(node) {
			const parts = [];
			for (const block of node.content) if (block.type === "text") parts.push(block.text);
			else parts.push(JSON.stringify(block, null, 2));
			if (parts.length === 0 && node.error !== void 0) parts.push(`${node.error.name}: ${node.error.code}`);
			return parts.join("\n");
		}
		function parseArgs(argsRaw) {
			try {
				return JSON.parse(argsRaw);
			} catch {
				return;
			}
		}
		function firstLine(text) {
			const nl = text.indexOf("\n");
			return nl === -1 ? text : text.slice(0, nl);
		}
		function pickString(args, keys) {
			for (const key of keys) {
				const v = args[key];
				if (typeof v === "string" && v !== "") return v;
			}
		}
		/** Summary key preference per variant (args-derived; result-derived summaries are a ledger item). */
		const SUMMARY_KEYS = {
			bash: ["description", "command"],
			read: [
				"path",
				"file_path",
				"url"
			],
			search: [
				"query",
				"pattern",
				"url"
			],
			write: ["path", "file_path"],
			edit: ["path", "file_path"],
			code: ["description"],
			others: []
		};
		function deriveSummary(variant, argsRaw) {
			const parsed = parseArgs(argsRaw);
			if (typeof parsed !== "object" || parsed === null) return firstLine(argsRaw);
			const args = parsed;
			if (variant === "search" && Array.isArray(args.queries)) {
				const queries = args.queries.filter((query) => typeof query === "string" && query !== "");
				if (queries.length > 0) return queries.map(firstLine).join(", ");
			}
			const picked = pickString(args, SUMMARY_KEYS[variant]);
			if (picked !== void 0) return firstLine(picked);
			for (const v of Object.values(args)) if (typeof v === "string" && v !== "") return firstLine(v);
			return firstLine(argsRaw);
		}
		/** Path keys only — never `url` (web_fetch lands on the read variant). */
		const FILE_PATH_KEYS = ["path", "file_path"];
		/** File-tool variants whose summary may be an openable workspace path. */
		const FILE_PATH_VARIANTS = new Set([
			"read",
			"write",
			"edit"
		]);
		/**
		* Summary material read the same way at every stage from the argument view: a
		* complete `file_path` for file tools, otherwise the `description` text so far.
		* Empty when the view carries neither, so the caller falls back to the raw text.
		*/
		function argumentSummary(variant, args, cwd, home) {
			if (FILE_PATH_VARIANTS.has(variant)) {
				const path = args.complete("file_path") ? args.text("file_path") : void 0;
				const filePath = path !== void 0 && path !== "" && args.complete("file_path") ? firstLine(path) : void 0;
				return {
					summary: filePath === void 0 ? "" : abbreviateHomePath(relativizeToCwd(filePath, cwd), home),
					filePath
				};
			}
			const description = args.text("description");
			return {
				summary: description === void 0 ? "" : firstLine(description),
				filePath: void 0
			};
		}
		function deriveFilePath(variant, argsRaw) {
			if (!FILE_PATH_VARIANTS.has(variant)) return void 0;
			const parsed = parseArgs(argsRaw);
			if (typeof parsed !== "object" || parsed === null) return void 0;
			const picked = pickString(parsed, FILE_PATH_KEYS);
			return picked === void 0 ? void 0 : firstLine(picked);
		}
		/**
		* Format one argument payload when its generic input body becomes visible.
		* @param variant - row presentation selected for the Tool name.
		* @param argsRaw - original argument JSON or incomplete raw text.
		* @returns display body, or null for empty input.
		*/
		function formatToolBody(variant, argsRaw) {
			if (argsRaw === "") return null;
			const parsed = parseArgs(argsRaw);
			if (parsed === void 0) return argsRaw;
			if (variant === "code" && typeof parsed === "object" && parsed !== null) {
				const code = parsed.code;
				if (typeof code === "string" && code !== "") return code;
			}
			return JSON.stringify(parsed, null, 2);
		}
		/**
		* Derive the full row model from a frozen call slice.
		* @param toolName - wire tool name (dispatch-supplied; survives windowless results).
		* @param block - preparing call, dispatched call, or result from the snapshot.
		* @param cwd - session workspace root; workspace-rooted path summaries display relative to it.
		* @param home - host account home; a leftover POSIX home path displays as `~`.
		* @returns the row model.
		*/
		function toolRowModel(toolName, block, cwd, home) {
			const variant = classifyTool(toolName);
			const titleKey = toolTitleKey(toolName);
			const done = "kind" in block;
			const argsRaw = done ? block.call?.argsRaw ?? "" : block.phase === "start" ? block.argsRaw : null;
			const primary = argumentSummary(variant, block.args, cwd, home);
			const argumentPath = primary.filePath ?? (argsRaw === null ? void 0 : deriveFilePath(variant, argsRaw));
			const recordedPath = done ? recordedAbsolutePath(block.meta, "path") : void 0;
			const canUseArgumentPath = argumentPath !== void 0 && (isAbsoluteWorkspacePath(argumentPath) || done && !block.isError && block.parentCallId === void 0);
			const filePath = argumentPath === void 0 ? void 0 : recordedPath ?? (canUseArgumentPath ? argumentPath : void 0);
			const state = !done ? block.phase === "preparing" ? "preparing" : "running" : block.error?.code === "interrupted" ? "stopped" : block.isError ? "error" : "ok";
			const base = primary.summary !== "" || argsRaw === null ? primary.summary : argsRaw === "" ? block.callId : abbreviateHomePath(relativizeToCwd(deriveSummary(variant, argsRaw), cwd), home);
			const summary = [titleKey === "tool.title.generic" ? toolName : "", base].filter(Boolean).join(" · ");
			const output = done ? resultText(block) || null : null;
			const errorSummary = state === "error" && output !== null ? firstLine(output) : null;
			return {
				variant,
				titleKey,
				summary,
				filePath,
				bodyRaw: argsRaw === "" ? null : argsRaw,
				output,
				errorSummary,
				autoReviewDenial: deriveAutoReviewDenial(block),
				state
			};
		}
		//#endregion
		//#region lib/types/client/tool/models/raw-tool-call.js
		const parsedCalls = /* @__PURE__ */ new WeakMap();
		/**
		* Parse the call head paired with one immutable Tool block.
		* @param block - preparing, dispatched, or settled Tool block.
		* @returns the Tool name and object arguments, or null during preparation or when valid arguments are unavailable.
		*/
		function parsedToolCall(block) {
			if (!("kind" in block) && block.phase === "preparing") return null;
			const cached = parsedCalls.get(block);
			if (cached !== void 0 || parsedCalls.has(block)) return cached ?? null;
			const call = "kind" in block ? block.call : block;
			if (call === null) {
				parsedCalls.set(block, null);
				return null;
			}
			let value;
			try {
				value = JSON.parse(call.argsRaw);
			} catch {
				parsedCalls.set(block, null);
				return null;
			}
			if (typeof value !== "object" || value === null || Array.isArray(value)) {
				parsedCalls.set(block, null);
				return null;
			}
			const parsed = {
				name: call.name,
				args: value
			};
			parsedCalls.set(block, parsed);
			return parsed;
		}
		/**
		* Read the exact single text block consumed by first-party card derivations.
		* @param block - settled Tool result.
		* @returns its text, or undefined for any other content layout.
		*/
		function singleResultText(block) {
			if (block.content.length !== 1) return void 0;
			const only = block.content[0];
			return only?.type === "text" ? only.text : void 0;
		}
		//#endregion
		//#region lib/types/client/tool/models/read-card-model.js
		/** Whether a model-supplied argument is a 1-based line position or count: an integer of at least 1. */
		function positiveInteger$1(value) {
			return typeof value === "number" && Number.isInteger(value) && value >= 1;
		}
		function validReadCall(block) {
			const call = parsedToolCall(block);
			if (call?.name !== "read") return false;
			const { file_path: path, offset, limit } = call.args;
			if (typeof path !== "string" || path.trim() === "") return false;
			if (offset !== void 0 && !positiveInteger$1(offset)) return false;
			if (limit !== void 0 && !positiveInteger$1(limit)) return false;
			return true;
		}
		function readMeta(meta) {
			if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
			const { path, offset, lines, totalLines, lang } = meta;
			if (typeof path !== "string" || typeof offset !== "number" || !Number.isInteger(offset) || offset < 1) return null;
			if (typeof totalLines !== "number" || !Number.isInteger(totalLines) || totalLines < 0 || !Array.isArray(lines)) return null;
			if (lang !== void 0 && typeof lang !== "string") return null;
			const narrowed = [];
export {};
