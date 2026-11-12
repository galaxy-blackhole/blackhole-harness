/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/schedule-create-card.js
		/** JSON document of one raw wire text, or undefined when the text is not JSON. */
		function parseJson(text) {
			try {
				return JSON.parse(text);
			} catch {
				return;
			}
		}
		/** Whether one wire value is a plain JSON object rather than an array or scalar. */
		function isRecord$1(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/** First physical line of one task instruction, without surrounding whitespace. */
		function firstLine(text) {
			const newline = text.search(/\r?\n/);
			return (newline === -1 ? text : text.slice(0, newline)).trim();
		}
		/** Concatenated text of a settled result, or null when it is not exactly one text block. */
		function resultText(block) {
			const first = block.content[0];
			if (first === void 0 || first.type !== "text" || first.text === "") return null;
			if (block.content.length !== 1) return null;
			return first.text;
		}
		/** Whether one wire value is an array whose entries are all numbers. */
		function isNumberArray(value) {
			return Array.isArray(value) && value.every((entry) => typeof entry === "number");
		}
		/**
		* Narrow one opaque value to a complete Schedule rule.
		*
		* The value arrives from replayed wire JSON, so each rule kind is checked for
		* the fields `formatScheduleFrequency` reads. A missing identity or an
		* incomplete rule returns undefined and the card renders without a task.
		*
		* The result JSON normally carries the stored title. A result recorded before
		* that field existed carries none, so this narrowing derives the display title
		* from the instruction's first line; when the instruction has no such line it
		* returns undefined.
		* @param value - opaque value parsed from logged JSON.
		* @returns the narrowed rule, or undefined when it is not a complete task.
		*/
		function narrowScheduleRecord(value) {
			if (!isRecord$1(value)) return void 0;
			const { id, prompt, scheduledAt, kind } = value;
			if (typeof id !== "string" || id === "" || typeof prompt !== "string" || prompt === "" || typeof scheduledAt !== "string") return void 0;
			const title = typeof value.title === "string" && value.title.trim() !== "" ? value.title : firstLine(prompt);
			if (title === "") return void 0;
			switch (kind) {
				case "after": return typeof value.afterSeconds === "number" ? {
					id,
					kind: "after",
					title,
					prompt,
					afterSeconds: value.afterSeconds,
					scheduledAt
				} : void 0;
				case "at": return {
					id,
					kind: "at",
					title,
					prompt,
					scheduledAt
				};
				case "every": return typeof value.everySeconds === "number" ? {
					id,
					kind: "every",
					title,
					prompt,
					everySeconds: value.everySeconds,
					scheduledAt
				} : void 0;
				case "daily": return typeof value.time === "string" && typeof value.timeZone === "string" ? {
					id,
					kind: "daily",
					title,
					prompt,
					time: value.time,
					timeZone: value.timeZone,
					scheduledAt
				} : void 0;
				case "weekly": return typeof value.time === "string" && typeof value.timeZone === "string" && isNumberArray(value.weekdays) ? {
					id,
					kind: "weekly",
					title,
					prompt,
					time: value.time,
					timeZone: value.timeZone,
					weekdays: value.weekdays,
					scheduledAt
				} : void 0;
				case "cron": return typeof value.expression === "string" && typeof value.timeZone === "string" ? {
					id,
					kind: "cron",
					title,
					prompt,
					expression: value.expression,
					timeZone: value.timeZone,
					scheduledAt
				} : void 0;
				default: return;
			}
		}
		/** Task title a still-running call announces from its own arguments. */
		function pendingTitle(argsRaw) {
			const parsed = parseJson(argsRaw);
			if (!isRecord$1(parsed)) return void 0;
			if (typeof parsed.title === "string" && parsed.title.trim() !== "") return parsed.title.trim();
			if (typeof parsed.prompt !== "string") return void 0;
			const title = firstLine(parsed.prompt);
			return title === "" ? void 0 : title;
		}
		/**
		* Derive the transcript card of one `schedule_create` call.
		* @param block - raw call or result block carried by the Session journal.
		* @param toolName - wire Tool name, used when no task title is available.
		* @returns the created task, its title, and the settled result text.
		*/
		function scheduleCreateCardModel(block, toolName) {
			const settled = "kind" in block;
			const argsRaw = settled ? block.call?.argsRaw ?? "" : block.phase === "start" ? block.argsRaw : "";
			const output = settled ? resultText(block) : null;
			const task = settled ? narrowScheduleRecord(parseJson(output ?? "")) : void 0;
			return {
				task,
				title: task === void 0 ? pendingTitle(argsRaw) ?? toolName : taskName(task),
				output
			};
		}
		//#endregion
