/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				fields,
				...groups.length === 0 ? {} : { groups }
			}];
		}
		/**
		* Give a result list consistent historical context and empty-state copy.
		* @param items - Recorded result rows.
		* @param summary - Collapsed-row summary.
		* @param t - Conversation translator.
		* @returns A complete compact detail model.
		*/
		function detailList(items, summary, t) {
			return {
				items,
				summary,
				caption: t("detail.recordedResult"),
				empty: t("detail.empty")
			};
		}
		//#endregion
		//#region lib/types/client/tool/models/control-details-model.js
		const OUTPUT_TRUNCATED = "\n[output truncated]";
		function arg(args, key) {
			const value = args[key];
			return typeof value === "string" ? value : "";
		}
		function receipt(title, badge, t, fields = [], description) {
			return {
				...detailList([{
					title,
					badge,
					fields,
					...description === void 0 ? {} : { description }
				}], `${title} · ${badge.label}`, t),
				expandedSummary: title
			};
		}
		function agentList(text, json, t) {
			if (Array.isArray(json)) return detailList(inspectionItems(json, t), t("detail.agents.count", { count: json.length }), t);
			if (text === "(no subagents)") return detailList([], t("detail.agents.count", { count: 0 }), t);
			const items = [];
			for (const line of text.split("\n")) {
				const match = /^(\S+) \[([^\]]+)\](?: parent=(\S+) depth=(\d+))?(?: — (.*))?$/u.exec(line);
				if (match === null) return null;
				const [, id, state, parent, depth, title] = match;
				if (id === void 0 || state === void 0) return null;
				items.push({
					title: title ?? id,
					...title === void 0 ? {} : { subtitle: id },
					badge: detailBadge(state, t),
					fields: parent === void 0 ? [] : [{
						label: t("detail.field.parent"),
						value: parent
					}, {
						label: t("detail.field.depth"),
						value: depth ?? ""
					}]
				});
			}
			return detailList(items, t("detail.agents.count", { count: items.length }), t);
		}
		function jobList(text, t) {
			if (text === "(no background jobs)") return detailList([], t("detail.jobs.count", { count: 0 }), t);
			const items = [];
			for (const line of text.split("\n")) {
				const match = /^(\S+) \[([^\]]+)\] (\S+) — (.*)$/u.exec(line);
				if (match === null) return null;
				const [, id, kind, state, title] = match;
				if (id === void 0 || kind === void 0 || state === void 0 || title === void 0) return null;
				items.push({
					title,
					subtitle: id,
					badge: detailBadge(state, t),
					fields: [{
						label: t("detail.field.type"),
						value: kind
					}]
				});
			}
			return detailList(items, t("detail.jobs.count", { count: items.length }), t);
		}
		function terminalList(text, t) {
			if (text === "(no terminal sessions)") return detailList([], t("detail.terminals.count", { count: 0 }), t);
			const items = [];
			for (const line of text.split("\n")) {
				const match = /^(\S+)(?: \((.*?)\))? \[([^\]]+)\] (running|exited code=(\S+) signal=(\S+))(?: pid=(\d+))?$/u.exec(line);
				if (match === null) return null;
				const [, id, name, type, state, exitCode, signal, pid] = match;
				if (id === void 0 || type === void 0 || state === void 0) return null;
				const fields = [{
					label: t("detail.field.type"),
					value: type
				}];
				if (pid !== void 0) fields.push({
					label: t("detail.field.pid"),
					value: pid
				});
				if (exitCode !== void 0) fields.push({
					label: t("detail.field.exitCode"),
					value: exitCode
				});
				if (signal !== void 0 && signal !== "null") fields.push({
					label: t("detail.field.signal"),
					value: signal
				});
				items.push({
					title: name ?? id,
					...name === void 0 ? {} : { subtitle: id },
					badge: state === "running" ? detailBadge("running", t) : {
						label: t("detail.status.exited"),
						tone: exitCode === "0" ? "success" : "neutral"
					},
					fields
				});
			}
			return detailList(items, t("detail.terminals.count", { count: items.length }), t);
		}
		function lspDetails(args, text, t) {
			const file = arg(args, "file_path");
			const operation = arg(args, "operation");
			if (file === "" || typeof args.line !== "number" || typeof args.character !== "number") return null;
			const source = `${file}:${args.line}:${args.character}`;
			if (operation === "hover") return detailList([{
				title: source,
				location: {
					path: file,
					line: args.line
				},
				markdown: text,
				fields: []
			}], source, t);
			if (text === "No results.") return detailList([], t("detail.locations.count", { count: 0 }), t);
			const items = [];
			for (const line of text.split("\n")) {
				if (line.startsWith("… ")) {
					items.push({
						description: line,
						fields: []
					});
					continue;
				}
				const match = /^(.*):(\d+):(\d+)$/u.exec(line);
				if (match === null) return null;
				const [, path, row, column] = match;
				if (path === void 0 || row === void 0 || column === void 0) return null;
				const isUri = /^[a-z][a-z\d+.-]*:/iu.test(path) && !/^[a-z]:[\\/]/iu.test(path);
				items.push({
					title: path,
					subtitle: t("detail.location", {
						line: row,
						column
					}),
					fields: [],
					...isUri ? {} : { location: {
						path,
						line: Number(row)
					} }
				});
			}
			const count = items.filter((item) => item.title !== void 0).length;
			return detailList(items, `${file} · ${t("detail.locations.count", { count })}`, t);
		}
		/**
		* Derive entity lists and operation receipts from supported recorded output formats.
		* @param name - Wire tool name, including Team-scoped aliases.
		* @param args - Parsed recorded arguments.
		* @param text - Successful recorded result text.
		* @param json - Parsed whole-result JSON, or undefined for non-JSON text.
		* @param t - Conversation translator.
		* @returns Compact details, or null when the output format is not recognized.
		*/
		function controlDetails(name, args, text, json, t) {
			const target = arg(args, "target") || arg(args, "agent_id") || arg(args, "sessionId") || arg(args, "job_id");
			switch (name) {
				case "list_agents": return agentList(text, json, t);
				case "job_list": return jobList(text, t);
				case "terminal_list": return terminalList(text, t);
				case "lsp": return lspDetails(args, text, t);
				case "spawn_teammate":
					if (!detailRecord(json) || !detailRecord(json.member)) return null;
					return detailList(inspectionItems(json.member, t), arg(args, "name"), t);
				case "team_task_create":
				case "team_task_get":
				case "team_task_update":
					if (!detailRecord(json) || typeof json.subject !== "string") return null;
					return detailList(inspectionItems(json, t), json.subject, t);
				case "team_task_list":
					if (!detailRecord(json) || !Array.isArray(json.tasks)) return null;
					if (json.nextCursor !== void 0 && typeof json.nextCursor !== "number") return null;
					return {
						...detailList(inspectionItems(json.tasks, t), t("detail.tasks.count", { count: json.tasks.length }), t),
						...json.nextCursor === void 0 ? {} : { caption: t("detail.tasks.nextPage", { cursor: String(json.nextCursor) }) }
					};
				case "send_message": {
					const status = detailRecord(json) ? json.status : void 0;
					if (status === "accepted" || status === "queued") return receipt(target, {
						label: t(status === "queued" ? "detail.status.queued" : "detail.receipt.delivered"),
						tone: status === "queued" ? "warning" : "success"
					}, t, [], arg(args, "message"));
					return text === `message delivered to agent ${target}` ? receipt(target, {
						label: t("detail.receipt.delivered"),
						tone: "success"
					}, t, [], arg(args, "message")) : null;
				}
				case "interrupt_agent":
					if (detailRecord(json) && typeof json.previousStatus === "string") return receipt(target, {
						label: t("detail.receipt.interrupt"),
						tone: "warning"
					}, t, [{
						label: t("detail.field.previousStatus"),
						value: detailBadge(json.previousStatus, t).label
					}]);
					return text === `interrupt requested for agent ${target}` ? receipt(target, {
						label: t("detail.receipt.interrupt"),
						tone: "warning"
					}, t) : null;
				case "wait_agent":
					if (!detailRecord(json) || typeof json.timedOut !== "boolean") return null;
					if (detailRecord(json.noProgress) && typeof json.noProgress.message === "string") return detailList([{
						title: t("detail.wait.noProgress"),
						description: json.noProgress.message,
						fields: []
					}], t("detail.wait.noProgress"), t);
					return receipt(t("detail.wait.title"), {
						label: t(json.timedOut ? "detail.wait.timeout" : "detail.wait.changed"),
						tone: "neutral"
					}, t);
				case "subagent": {
					const started = /^started (background subagent job|subagent) (\S+)$/u.exec(text);
					if (started !== null) return receipt(arg(args, "prompt"), {
						label: t("detail.receipt.started"),
						tone: "info"
					}, t, [{
						label: t(started[1] === "subagent" ? "detail.field.agent" : "detail.field.job"),
						value: started[2] ?? ""
					}]);
					return detailList([{
						title: t("detail.agent.reply"),
						markdown: text,
						fields: [],
						groups: [{
							label: t("detail.field.task"),
							items: [{
								description: arg(args, "prompt"),
								fields: []
							}]
						}]
					}], t("detail.agent.reply"), t);
				}
				case "list_subagent_models": return detailList(text.split("\n").map((line) => {
					const split = line.indexOf(" — ");
					return split < 0 ? {
						description: line,
						fields: []
					} : {
						title: line.slice(0, split),
						description: line.slice(split + 3),
						fields: []
					};
				}), arg(args, "model") || arg(args, "provider") || t("detail.models.title"), t);
				case "job_output": {
					const match = /\n\[status: ([^,\]\n]+)(?:, ([^\]\n]+))?\]$/u.exec(text);
					if (match === null || match[1] === void 0) return null;
					const output = text.slice(0, match.index);
					const truncated = output.endsWith(OUTPUT_TRUNCATED);
					const code = truncated ? output.slice(0, -19) : output;
					const description = [match[2], truncated ? t("detail.output.truncated") : void 0].filter((value) => value !== void 0).join(" · ");
					return {
						...detailList([{
							title: target,
							badge: detailBadge(match[1], t),
							fields: [],
							...description === "" ? {} : { description },
							code: { text: code }
						}], `${target} · ${detailBadge(match[1], t).label}`, t),
						expandedSummary: target
					};
				}
				case "job_kill":
					if (text === `requested cancellation of job ${target}`) return receipt(target, {
						label: t("detail.receipt.cancel"),
						tone: "warning"
					}, t, [], arg(args, "reason"));
					if (text.startsWith(`job ${target} had already finished `)) return receipt(target, {
						label: t("detail.receipt.alreadyFinished"),
						tone: "neutral"
					}, t);
					return null;
				case "terminal_open": {
					const match = /^started terminal session (\S+)(?: \((.*?)\))? \[type: ([^\]]+)\]\n([\s\S]*)$/u.exec(text);
					if (match === null || match[1] === void 0 || match[3] === void 0 || match[4] === void 0) return null;
					return detailList([{
						title: match[2] ?? match[1],
						...match[2] === void 0 ? {} : { subtitle: match[1] },
						badge: {
							label: t("detail.receipt.started"),
							tone: "info"
						},
						fields: [{
							label: t("detail.field.type"),
							value: match[3]
						}],
						code: { text: match[4] }
					}], match[2] ?? match[1], t);
				}
				case "terminal_read": {
					const match = /\n\[lines: (\d+)-(\d+) of (\d+)\](\n\[output truncated\])?$/u.exec(text);
					if (match === null) return null;
					return detailList([{
						title: target,
						subtitle: t("detail.output.lines", {
							begin: match[1] ?? "",
							end: match[2] ?? "",
							total: match[3] ?? ""
						}),
						fields: [],
						code: { text: text.slice(0, match.index) },
						...match[4] === void 0 ? {} : { description: t("detail.output.truncated") }
					}], target, t);
				}
				case "terminal_signal": {
					const match = /^delivered (\S+) to foreground process group (\d+)$/u.exec(text);
					if (match === null || match[1] === void 0 || match[2] === void 0) return null;
					return receipt(target, {
						label: t("detail.receipt.signal"),
						tone: "success"
					}, t, [{
						label: t("detail.field.signal"),
						value: match[1]
					}, {
						label: t("detail.field.processGroup"),
						value: match[2]
					}]);
				}
				case "terminal_close":
					if (text === `closed terminal session ${target}`) return receipt(target, {
						label: t("detail.receipt.closed"),
						tone: "neutral"
					}, t);
					if (text === `terminal session ${target} was already closing`) return receipt(target, {
						label: t("detail.receipt.closing"),
						tone: "neutral"
					}, t);
					return null;
				default: return null;
			}
		}
		//#endregion
		//#region lib/types/client/tool/models/inspection-details-model.js
		function dateText(value, locale) {
			const date = new Date(value);
			if (!Number.isFinite(date.getTime())) return String(value);
			try {
				return new Intl.DateTimeFormat(locale, {
					dateStyle: "medium",
					timeStyle: "short"
				}).format(date);
			} catch {
				return String(value);
			}
		}
		function cordisDetails(name, args, value, t) {
			if (!detailRecord(value)) return null;
			if (name === "cordis_inspect_list") {
				if (!Array.isArray(value.providers)) return null;
				return detailList(inspectionItems(value.providers, t), t("detail.providers.count", { count: value.providers.length }), t);
			}
			if (name === "cordis_inspect_query") {
				if (!("data" in value) || typeof value.provider !== "string" || typeof value.method !== "string") return null;
				return detailList(inspectionItems(value.data, t), `${value.provider}.${value.method}`, t);
			}
			if (name === "cordis_inspect_self") {
				if (Array.isArray(value.plugins)) return detailList(inspectionItems(value.plugins, t), t("detail.plugins.count", { count: value.plugins.length }), t);
				return detailList(inspectionItems(value, t), String(args.pluginId ?? args.packageId ?? value.mode), t);
			}
			return null;
		}
		function workflowDetails(name, args, text, t) {
			if (name === "workflow") {
				const match = /^workflow "([\s\S]*?)" completed \((\d+) agents?\)\.\nReturn value:\n([\s\S]*)$/u.exec(text);
				if (match === null || match[1] === void 0 || match[2] === void 0 || match[3] === void 0) return null;
				const value = detailJson(match[3]);
				if (value === void 0) return null;
				return detailList([{
					title: match[1],
					badge: {
						label: t("detail.status.completed"),
						tone: "success"
					},
					fields: [{
						label: t("detail.field.agents"),
						value: match[2]
					}],
					...typeof args.code === "string" ? { groups: [{
						label: t("detail.workflow.script"),
						items: [{
							fields: [],
							code: {
								text: args.code,
								language: "javascript"
export {};
