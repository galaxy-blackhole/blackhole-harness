/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
							}
						}]
					}] } : {}
				}, ...inspectionItems(value, t)], match[1], t);
			}
			const split = text.indexOf("\nFinal report:\n");
			if (split < 0) return null;
			const header = text.slice(0, split);
			const rounds = /\b(\d+) rounds?\b/u.exec(header)?.[1];
			const report = detailJson(text.slice(split + 15));
			if (!detailRecord(report) || typeof report.summary !== "string" || !Array.isArray(report.evidence) || !report.evidence.every((value) => typeof value === "string") || !Array.isArray(report.nextSteps) || !report.nextSteps.every((value) => typeof value === "string") || typeof report.blocker !== "string") return null;
			const badge = header.startsWith("Ralph worker reported completion ") ? {
				label: t("detail.ralph.reportedComplete"),
				tone: "success"
			} : header.startsWith("Ralph worker reported a blocker ") ? {
				label: t("detail.ralph.reportedBlocker"),
				tone: "warning"
			} : header.startsWith("Ralph reached its ") ? {
				label: t("detail.ralph.limit"),
				tone: "warning"
			} : void 0;
			if (badge === void 0) return null;
			const groups = [];
			if (report.nextSteps.length > 0) groups.push({
				label: t("detail.report.nextSteps"),
				items: [{
					fields: [],
					lines: report.nextSteps
				}]
			});
			if (typeof args.objective === "string") groups.push({
				label: t("detail.field.task"),
				items: [{
					fields: [],
					description: args.objective
				}]
			});
			const fields = rounds === void 0 ? [] : [{
				label: t("detail.goal.rounds"),
				value: rounds
			}];
			if (report.blocker !== "") fields.push({
				label: t("detail.goal.reason"),
				value: report.blocker
			});
			return detailList([{
				title: report.summary,
				badge,
				fields,
				...report.evidence.length === 0 ? {} : { lines: report.evidence },
				groups
			}], report.summary, t);
		}
		const TRACE_FIELDS = {
			Created: "detail.field.time",
			Availability: "detail.field.availability",
			Parent: "detail.field.parent",
			"Best match": "detail.field.bestMatch",
			Target: "detail.field.target",
			"Replaced by": "detail.trace.replacedBy",
			"Replacement chain": "detail.trace.replacementChain",
			"Events replaced by target": "detail.trace.replaces",
			"Events cited directly as sources": "detail.trace.sources",
			"Direct derived events": "detail.trace.derived"
		};
		function textFields(text, t, locale) {
			return text.split("\n").flatMap((line) => {
				const match = /^\s*([^:]+): (.+)$/u.exec(line);
				if (match === null || match[1] === void 0 || match[2] === void 0) return [];
				const key = Object.hasOwn(TRACE_FIELDS, match[1]) ? TRACE_FIELDS[match[1]] : void 0;
				if (key === void 0) return [];
				return [{
					label: t(key),
					value: match[1] === "Created" ? dateText(match[2], locale) : match[2] === "none" ? t("detail.none") : match[2]
				}];
			});
		}
		function searchDetails(name, text, t, locale) {
			if (text === "No prior session matches found." || text.endsWith("\n\nNo prior event matches found.")) return detailList([], t("detail.matches.count", { count: 0 }), t);
			const blocks = text.split(/\n(?=\d+\. )/u).filter((block) => /^\d+\. /u.test(block));
			if (blocks.length === 0) return null;
			const items = [];
			for (const block of blocks) {
				const snippet = /\n\s*Snippet: ([\s\S]*?)(?:\n\nResult cap reached\.|$)/u.exec(block)?.[1];
				if (name === "session_search") {
					const match = /^\d+\. Session (\S+) — (.*)/u.exec(block);
					if (match === null || match[1] === void 0 || match[2] === void 0) return null;
					items.push({
						title: match[2],
						subtitle: match[1],
						...snippet === void 0 ? {} : { description: snippet.trimEnd() },
						fields: textFields(block, t, locale)
					});
				} else {
					const match = /^\d+\. seq (\d+) \| ([^|]+) \| ([^|]+) \| ([^\n]+)/u.exec(block);
					if (match === null || match[1] === void 0 || match[2] === void 0 || match[3] === void 0 || match[4] === void 0) return null;
					items.push({
						title: snippet?.trimEnd() ?? match[2],
						subtitle: `${match[2].trim()} · #${match[1]}`,
						fields: [{
							label: t("detail.field.time"),
							value: dateText(match[4], locale)
						}, {
							label: t("detail.field.surface"),
							value: match[3].trim()
						}]
					});
				}
			}
			return {
				...detailList(items, t("detail.matches.count", { count: items.length }), t),
				...text.includes("Result cap reached.") ? { caption: t("detail.matches.capped") } : {}
			};
		}
		function eventReadDetails(text, t, locale) {
			const match = /^Session (\S+) — ([^\n]*)\nTarget event seq (\d+):\n```json\n([\s\S]*?)\n```([\s\S]*)$/u.exec(text);
			if (match === null || match[1] === void 0 || match[2] === void 0 || match[3] === void 0 || match[4] === void 0) return null;
			const event = detailJson(match[4]);
			if (!detailRecord(event) || typeof event.type !== "string" || !detailRecord(event.data)) return null;
			const fields = [{
				label: t("detail.field.seq"),
				value: match[3]
			}];
			if (typeof event.time === "number") fields.push({
				label: t("detail.field.time"),
				value: dateText(event.time, locale)
			});
			const groups = [];
			const adjacent = match[5]?.trim();
			if (adjacent) groups.push({
				label: t("detail.event.neighbors"),
				items: [{
					fields: [],
					description: adjacent
				}]
			});
			return detailList([
				{
					title: event.type,
					subtitle: `${match[2]} · ${match[1]}`,
					fields
				},
				...inspectionItems(event.data, t),
				...groups.length === 0 ? [] : [{
					fields: [],
					groups
				}]
			], `${event.type} · #${match[3]}`, t);
		}
		function traceDetails(name, text, t, locale) {
			const match = /^Session (\S+) — ([^\n]*)\n([\s\S]*)$/u.exec(text);
			if (match === null || match[1] === void 0 || match[2] === void 0 || match[3] === void 0) return null;
			if (name === "session_event_trace") return detailList([{
				title: match[2],
				subtitle: match[1],
				fields: textFields(match[3], t, locale)
			}], match[2], t);
			const sections = match[3].split("\n\n");
			const items = [{
				title: match[2],
				subtitle: match[1],
				fields: textFields(sections[0] ?? "", t, locale)
			}];
			for (const section of sections.slice(1)) {
				const firstBreak = section.indexOf("\n");
				const label = section.startsWith("Ancestors (nearest first):") ? t("detail.trace.ancestors") : section.startsWith("Descendants:") ? t("detail.trace.descendants") : void 0;
				if (label === void 0 || firstBreak < 0) return null;
				const body = section.slice(firstBreak + 1);
				items.push({
					title: label,
					fields: [],
					...body === "- none" || body === "- none (target is a root session)" ? { description: t("detail.none") } : { lines: body.split("\n").map((line) => line.replace(/^(\s*)- /u, "$1")) }
				});
			}
			return detailList(items, match[2], t);
		}
		/**
		* Present successful inspection, query, and workflow text as named records.
		* @param name - Wire tool name.
		* @param args - Recorded argument object.
		* @param text - Recorded result text.
		* @param json - Parsed whole-result JSON, or undefined for non-JSON text.
		* @param t - Conversation translator.
		* @param locale - Date display locale.
		* @returns Structured details, or null when an output format is unknown.
		*/
		function inspectionDetails(name, args, text, json, t, locale) {
			if (hasSpillNotice(text)) return null;
			switch (name) {
				case "cordis_inspect_list":
				case "cordis_inspect_query":
				case "cordis_inspect_self": return cordisDetails(name, args, json, t);
				case "workflow":
				case "ralph": return workflowDetails(name, args, text, t);
				case "session_search":
				case "session_event_search": return searchDetails(name, text, t, locale);
				case "session_event_read": return eventReadDetails(text, t, locale);
				case "session_trace":
				case "session_event_trace": return traceDetails(name, text, t, locale);
				default: return null;
			}
		}
		//#endregion
		//#region lib/types/client/tool/models/details-card-model.js
		function count(value) {
			return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
		}
		function formatDate(date, locale, fallback) {
			try {
				return new Intl.DateTimeFormat(locale, {
					year: "numeric",
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
					timeZoneName: "short"
				}).format(date);
			} catch {
				return fallback;
			}
		}
		/**
		* Derive the compact todo list from a todo_write call.
		* @param args - Parsed todo_write arguments.
		* @param t - Conversation dictionary translator.
		* @returns Localized todo details, or null for unsupported input.
		*/
		function todosDetail(args, t) {
			if (!Array.isArray(args.todos)) return null;
			const items = [];
			const seen = /* @__PURE__ */ new Set();
			for (const todo of args.todos) {
				if (!detailRecord(todo) || !nonempty(todo.content)) return null;
				const status = todo.status;
				if (status !== "completed" && status !== "in_progress" && status !== "pending") return null;
				const title = todo.content.trim();
				if (seen.has(title)) return null;
				seen.add(title);
				items.push({
					title,
					status: {
						value: status,
						label: t(`detail.todo.${status}`)
					},
					fields: []
				});
			}
			return {
				items,
				empty: t("detail.todo.empty")
			};
		}
		function goalDetail(value, t) {
			if (!detailRecord(value)) return null;
			if (value.goal === null) return {
				items: [],
				empty: t("detail.goal.empty")
			};
			const goal = value.goal;
			if (!detailRecord(goal) || !nonempty(goal.id) || !nonempty(goal.objective) || !count(goal.revision) || !count(goal.roundsStarted) || !count(goal.maxGoalRounds)) return null;
			const phase = goal.phase;
			if (phase !== "active" && phase !== "paused" && phase !== "blocked" && phase !== "complete") return null;
			if (value.activation !== "armed" && value.activation !== "disarmed") return null;
			const fields = [{
				label: t("detail.state"),
				value: t(phase === "active" && value.activation === "disarmed" ? "detail.goal.disarmed" : `detail.goal.${phase}`)
			}, {
				label: t("detail.goal.rounds"),
				value: `${goal.roundsStarted} / ${goal.maxGoalRounds}`
			}];
			if (goal.blockedReason !== void 0) {
				if (!detailRecord(goal.blockedReason) || !nonempty(goal.blockedReason.code) || !nonempty(goal.blockedReason.message)) return null;
				fields.push({
					label: t("detail.goal.reason"),
					value: goal.blockedReason.message
				});
			}
			return { items: [{
				title: goal.objective,
				fields
			}] };
		}
		/** ISO-weekday keys, Monday first: a stored weekly rule names days 1 through 7. */
		const WEEKDAY_KEYS = [
			"detail.weekday.1",
			"detail.weekday.2",
			"detail.weekday.3",
			"detail.weekday.4",
			"detail.weekday.5",
			"detail.weekday.6",
			"detail.weekday.7"
		];
		function interval(seconds, t) {
			if (seconds % 86400 === 0) return t("detail.days", { count: seconds / 86400 });
			if (seconds % 3600 === 0) return t("detail.hours", { count: seconds / 3600 });
			if (seconds % 60 === 0) return t("detail.minutes", { count: seconds / 60 });
			return t("detail.seconds", { count: seconds });
		}
		/** A stored wall clock without its zero seconds, the figure the schedule surfaces state. */
		function shortTime(time) {
			return time.replace(/:00\.000$/, "").replace(/\.000$/, "");
		}
		/** Localized weekday list of a stored weekly rule, or undefined when the set is empty or out of range. */
		function weekdayText(days, t) {
			if (!Array.isArray(days) || days.length === 0) return void 0;
			const labels = [];
			for (const day of days) {
				if (typeof day !== "number" || !Number.isInteger(day)) return void 0;
				const key = WEEKDAY_KEYS[day - 1];
				if (key === void 0) return void 0;
				labels.push(t(key));
			}
			return labels.join(t("detail.weekday.join"));
		}
		function scheduleItem(value, t, locale) {
			if (!detailRecord(value) || !nonempty(value.id) || !nonempty(value.prompt) || typeof value.scheduledAt !== "string" || value.deliveryMode !== "host" && value.deliveryMode !== "session-local" || value.state !== "scheduled" && value.state !== "overdue") return null;
			const date = new Date(value.scheduledAt);
			if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.scheduledAt) return null;
			let frequency;
			switch (value.kind) {
				case "at":
					frequency = t("detail.schedule.once");
					break;
				case "after":
					if (!count(value.afterSeconds) || value.afterSeconds === 0) return null;
					frequency = t("detail.schedule.once");
					break;
				case "every":
					if (!count(value.everySeconds) || value.everySeconds === 0) return null;
					frequency = t("detail.schedule.every", { interval: interval(value.everySeconds, t) });
					break;
				case "daily":
					if (!nonempty(value.time) || !nonempty(value.timeZone)) return null;
					frequency = t("detail.schedule.daily", {
						time: shortTime(value.time),
						zone: value.timeZone
					});
					break;
				case "weekly": {
					const days = weekdayText(value.weekdays, t);
					if (!nonempty(value.time) || !nonempty(value.timeZone) || days === void 0) return null;
					frequency = t("detail.schedule.weekly", {
						days,
						time: shortTime(value.time),
						zone: value.timeZone
					});
					break;
				}
				case "cron":
					if (!nonempty(value.expression) || !nonempty(value.timeZone)) return null;
					frequency = t("detail.schedule.cron", {
						expression: value.expression,
						zone: value.timeZone
					});
					break;
				default: return null;
			}
			const dateText = formatDate(date, locale, value.scheduledAt);
			return {
				title: nonempty(value.title) ? value.title : value.prompt,
				fields: [
					{
						label: t("detail.schedule.when"),
						value: dateText
					},
					{
						label: t("detail.schedule.frequency"),
						value: frequency
					},
					{
						label: t("detail.state"),
						value: t(`detail.schedule.${value.state}`)
					}
				]
			};
		}
		/**
		* Derive a supported successful result, retaining generic output on unknown or malformed data.
		* @param block - Logged root or nested Tool call and its optional result.
		* @param t - Conversation dictionary translator.
		* @param locale - Display locale for absolute dates in the viewer's time zone.
		* @returns Localized detail data, or null for raw input/output.
		*/
		function detailsCardModel(block, t, locale) {
			if (!("kind" in block) || block.isError) return null;
			const call = parsedToolCall(block);
			if (call === null) return null;
			const text = singleResultText(block);
			if (text === void 0) return null;
			const value = detailJson(text);
			const details = controlDetails(call.name, call.args, text, value, t) ?? inspectionDetails(call.name, call.args, text, value, t, locale);
			if (details !== null) return details;
			if (value === void 0) return null;
			switch (call.name) {
				case "create_goal":
				case "get_goal":
				case "update_goal": return goalDetail(value, t);
				case "schedule_create":
				case "schedule_update": {
export {};
