/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mô hình chi tiết dùng chung của thẻ Tool: nhãn trường, thẻ trạng thái, mục kiểm tra, danh sách thực thể và biên nhận của các tool điều khiển
 */

/** Dữ liệu thô từ dây — bản gốc đọc trực tiếp nên ở đây giữ nguyên cách truy cập không kiểu. */
type Wire = any;

/** Ghế dịch của hội thoại: trả chuỗi đã bản địa hoá theo khoá, kèm tham số nội suy. */
type TranslateSeat = (key: string, params?: Record<string, unknown>) => string;

/** Sắc thái tĩnh của thẻ trạng thái. */
type BadgeTone = "neutral" | "info" | "success" | "warning" | "error";

/** Thẻ trạng thái đã bản địa hoá, không hàm ý một đăng ký trực tiếp. */
interface DetailBadge {
	/** Chữ trên thẻ. */
	label: string;
	/** Sắc thái tĩnh. */
	tone: BadgeTone;
}

/** Một cặp nhãn/giá trị trong khối chi tiết. */
interface DetailField {
	/** Nhãn trường. */
	label: string;
	/** Giá trị trường. */
	value: string;
}

/** Một thực thể, biến nhãn, hoặc nhóm giá trị gặp lại được của kết quả Tool. */
interface ToolDetailItem {
	/** Tiêu đề mục. */
	title?: string;
	/** Dòng phụ dưới tiêu đề. */
	subtitle?: string;
	/** Mô tả đầy đủ. */
	description?: string;
	/** Thẻ trạng thái nhỏ. */
	badge?: DetailBadge;
	/** Trạng thái của mục. */
	status?: {
		/** Mã trạng thái. */
		value: "completed" | "in_progress" | "pending";
		/** Nhãn trạng thái đã bản địa hoá. */
		label: string;
	};
	/** Trạng thái trước đó, khi mục vừa đổi trạng thái. */
	previousStatus?: string;
	/** Thay đổi của mục. */
	change?: {
		/** Loại thay đổi. */
		value: "added" | "removed" | "updated";
		/** Nhãn thay đổi đã bản địa hoá. */
		label: string;
	};
	/** Các cặp nhãn/giá trị của mục. */
	fields: DetailField[];
	/** Các dòng văn bản thô. */
	lines?: readonly string[];
	/** Khối markdown. */
	markdown?: string;
	/** Khối mã nguồn. */
	code?: {
		/** Thân mã. */
		text: string;
		/** Ngôn ngữ của khối mã. */
		language?: string;
	};
	/** Vị trí file mà mục trỏ tới. */
	location?: {
		/** Đường dẫn file. */
		path: string;
		/** Dòng trong file. */
		line?: number;
	};
	/** Các nhóm mục con gặp lại được. */
	groups?: {
		/** Nhãn nhóm. */
		label: string;
		/** Các mục con. */
		items: ToolDetailItem[];
	}[];
}

/** Dữ liệu hiển thị đã bản địa hoá mà các thẻ chi tiết dùng chung. */
interface ToolDetailsModel {
	/** Các mục chi tiết. */
	items: ToolDetailItem[];
	/** Dòng tóm tắt. */
	summary: string;
	/** Nhãn hiện khi không có mục nào. */
	empty: string;
	/** Dòng chú thích đầu khối. */
	caption: string;
	/** Dòng tóm tắt khi mở rộng, bỏ trạng thái biến nhãn trong thân. */
	expandedSummary?: string;
	/** Nhóm các mục không đổi. */
	unchanged?: {
		/** Nhãn nhóm. */
		label: string;
		/** Các mục không đổi. */
		items: ToolDetailItem[];
	};
}

/**
* Narrow parsed JSON to an object record.
* @param value - Parsed result or argument value.
* @returns Whether named fields can be read.
*/
export function detailRecord(value: unknown): value is Record<string, any> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
* Check a recorded string field that must contain visible text.
* @param value - Parsed field value.
* @returns Whether the field is a non-empty string after trimming.
*/
export function nonempty(value: unknown): boolean {
	return typeof value === "string" && value.trim() !== "";
}

/**
* Decode an entire JSON result without accepting a partial prefix.
* @param text - Recorded text.
* @returns Parsed JSON, or undefined for non-JSON output.
*/
export function detailJson(text: string): Wire {
	try {
		return JSON.parse(text);
	} catch {
		return;
	}
}

/** Khoá bản địa hoá của các trạng thái ghi nhận được. */
export const STATUS_KEYS: Record<string, string> = {
	running: "detail.status.running",
	idle: "detail.status.idle",
	ready: "detail.status.ready",
	inactive: "detail.status.inactive",
	provisioning: "detail.status.provisioning",
	failed: "detail.status.failed",
	error: "detail.status.failed",
	completed: "detail.status.completed",
	complete: "detail.status.completed",
	done: "detail.status.completed",
	pending: "detail.todo.pending",
	in_progress: "detail.todo.in_progress",
	deleted: "detail.status.deleted",
	killed: "detail.status.killed",
	blocked: "detail.goal.blocked",
	accepted: "detail.status.accepted",
	queued: "detail.status.queued"
};

/**
* Give a recorded status its localized name and a static semantic color.
* @param status - Result status, retained verbatim when the vocabulary is unknown.
* @param t - Conversation translator.
* @returns A badge that does not imply a live subscription.
*/
export function detailBadge(status: string, t: TranslateSeat): DetailBadge {
	const key = Object.hasOwn(STATUS_KEYS, status) ? STATUS_KEYS[status] : void 0;
	const tone = [
		"completed",
		"complete",
		"done",
		"accepted"
	].includes(status) ? "success" : ["failed", "error"].includes(status) ? "error" : [
		"blocked",
		"killed",
		"pending",
		"queued",
		"inactive"
	].includes(status) ? "warning" : [
		"running",
		"in_progress",
		"provisioning"
	].includes(status) ? "info" : "neutral";
	return {
		label: key === void 0 ? status : t(key),
		tone
	};
}

/** Khoá bản địa hoá của các trường ghi nhận được trong tham số hoặc kết quả Tool. */
export const FIELD_KEYS: Record<string, string> = {
	id: "detail.field.id",
	revision: "detail.field.revision",
	platform: "detail.field.platform",
	provider: "detail.field.provider",
	model: "detail.field.model",
	role: "detail.field.role",
	context: "detail.field.context",
	ownerName: "detail.field.owner",
	ready: "detail.field.ready",
	blockedBy: "detail.field.dependencies",
	writeScopes: "detail.field.writeScopes",
	writeScopeWarnings: "detail.field.warnings",
	diagnostics: "detail.field.diagnostics",
	methods: "detail.field.methods",
	inputSchema: "detail.field.inputSchema",
	outputSchema: "detail.field.outputSchema",
	currentPackageId: "detail.field.currentPackage",
	nextPackageId: "detail.field.nextPackage",
	latestRun: "detail.field.latestRun",
	packages: "detail.field.packages",
	registrations: "detail.field.registrations",
	props: "detail.field.props",
	data: "detail.field.data",
	source: "detail.field.source",
	arguments: "row.input",
	content: "detail.field.content",
	message: "detail.field.message",
	messageId: "detail.field.messageId",
	status: "detail.state",
	root: "detail.field.root",
	pid: "detail.field.pid",
	type: "detail.field.type",
	time: "detail.field.time",
	seq: "detail.field.seq",
	turn: "detail.field.turn",
	step: "detail.field.step",
	callId: "detail.field.callId",
	agentsStarted: "detail.field.agents",
	output: "row.output",
	result: "detail.field.result"
};

/**
* Name a known tool field while preserving extension-owned field names.
* @param key - Recorded JSON property name.
* @param t - Conversation translator.
* @returns Localized known label or the original property name.
*/
export function detailLabel(key: string, t: TranslateSeat): string {
	const label = Object.hasOwn(FIELD_KEYS, key) ? FIELD_KEYS[key] : void 0;
	return label === void 0 ? key : t(label);
}

/**
 * Đổi một giá trị đã ghi nhận thành chuỗi hiển thị.
 * Nhận: value — giá trị bất kỳ; t — ghế dịch của hội thoại.
 * Trả: mẫu dịch cho null/boolean, nguyên văn cho chuỗi, JSON cho phần còn lại.
 */
export function scalar(value: Wire, t: TranslateSeat): string {
	if (value === null) return t("detail.none");
	if (typeof value === "boolean") return t(value ? "detail.yes" : "detail.no");
	return typeof value === "string" ? value : (JSON.stringify(value) as string);
}

/** Thứ tự ưu tiên của các khoá dùng làm tiêu đề khi kiểm tra một bản ghi mở. */
export const INSPECTION_KEY_ORDER: string[] = [
	"subject",
	"title",
	"name",
	"pluginId",
	"packageId",
	"id",
	"summary"
];

/** Các khoá dùng làm mô tả chi tiết khi kiểm tra một bản ghi mở. */
export const INSPECTION_DETAIL_KEYS: string[] = ["description", "purpose"];

/** Số mục tối đa của một lượt kiểm tra trước khi phần dư được gộp lại thành một dòng. */
export const MAX_INSPECTION_ITEMS = 40;

/**
* Project open inspection records into readable fields and named disclosures.
* @param value - Parsed JSON, including provider-owned extension fields.
* @param t - Conversation translator.
* @param depth - Current disclosure depth; deeper records remain available as code.
* @returns Entity rows preserving the order of visible values.
*/
export function inspectionItems(value: Wire, t: TranslateSeat, depth = 0): ToolDetailItem[] {
	if (depth > 4 && value !== null && typeof value === "object") return [{
		code: {
			text: JSON.stringify(value, null, 2),
			language: "json"
		},
		fields: []
	}];
	if (Array.isArray(value)) {
		const items: ToolDetailItem[] = value.slice(0, MAX_INSPECTION_ITEMS).flatMap((entry: Wire) => inspectionItems(entry, t, depth + 1));
		if (value.length > MAX_INSPECTION_ITEMS) items.push({
			description: t("detail.moreInInspect", { count: value.length - MAX_INSPECTION_ITEMS }),
			fields: []
		});
		return items.length === 0 ? [{
			description: t("detail.empty"),
			fields: []
		}] : items;
	}
	if (!detailRecord(value)) return [{
		description: scalar(value, t),
		fields: []
	}];
	const titleKey = INSPECTION_KEY_ORDER.find((key) => typeof value[key] === "string" && value[key] !== "");
	const descriptionKey = INSPECTION_DETAIL_KEYS.find((key) => typeof value[key] === "string" && value[key] !== "");
	const title = titleKey === void 0 ? void 0 : String(value[titleKey]);
	const fields: DetailField[] = [];
	const groups: {
		label: string;
		items: ToolDetailItem[];
	}[] = [];
	for (const [key, field] of Object.entries(value)) {
		if (key === titleKey || key === descriptionKey || key === "status" && typeof field === "string") continue;
		if (key === "inputSchema" || key === "outputSchema") {
			groups.push({
				label: detailLabel(key, t),
				items: [{
					fields: [],
					code: {
						text: JSON.stringify(field, null, 2),
						language: "json"
					}
				}]
			});
			continue;
		}
		if (Array.isArray(field) && field.length === 0) continue;
		if (key === "arguments" && typeof field === "string") {
			const args = detailJson(field);
			if (detailRecord(args)) {
				groups.push({
					label: detailLabel(key, t),
					items: inspectionItems(args, t, depth + 1)
				});
				continue;
			}
		}
		if (field !== null && typeof field === "object") groups.push({
			label: detailLabel(key, t),
			items: inspectionItems(field, t, depth + 1)
		});
		else fields.push({
			label: detailLabel(key, t),
			value: scalar(field, t)
		});
	}
	return [{
		...title === void 0 && typeof value.status !== "string" ? {} : { title: title ?? t("detail.field.result") },
		...descriptionKey === void 0 ? {} : { description: String(value[descriptionKey]) },
		...typeof value.status === "string" ? { badge: detailBadge(value.status, t) } : {},
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
export function detailList(items: ToolDetailItem[], summary: string, t: TranslateSeat): ToolDetailsModel {
	return {
		items,
		summary,
		caption: t("detail.recordedResult"),
		empty: t("detail.empty")
	};
}

/** Đuôi đánh dấu phần output đã bị cắt trong văn bản kết quả ghi nhận. */
export const OUTPUT_TRUNCATED = "\n[output truncated]";

/**
 * Đọc một trường chuỗi trong tham số đã ghi nhận.
 * Nhận: args — đối tượng tham số đã phân tích; key — tên trường.
 * Trả: giá trị khi là chuỗi, ngược lại là chuỗi rỗng.
 */
export function arg(args: Wire, key: string): string {
	const value = args[key];
	return typeof value === "string" ? value : "";
}

/**
 * Dựng biên nhận một mục cho hành động điều khiển đã hoàn tất.
 * Nhận: title — tiêu đề mục; badge — thẻ trạng thái; t — ghế dịch; fields — các cặp nhãn/giá trị; description — mô tả tuỳ chọn.
 * Trả: mô hình chi tiết gồm một mục kèm dòng tóm tắt khi mở rộng.
 */
export function receipt(title: string, badge: DetailBadge, t: TranslateSeat, fields: DetailField[] = [], description?: string): ToolDetailsModel {
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

/**
 * Dựng danh sách tác nhân từ JSON toàn phần của kết quả hoặc từ văn bản đã ghi nhận.
 * Nhận: text — văn bản kết quả; json — JSON toàn phần đã phân tích; t — ghế dịch.
 * Trả: mô hình danh sách, hoặc null khi định dạng không nhận ra.
 */
export function agentList(text: string, json: Wire, t: TranslateSeat): ToolDetailsModel | null {
	if (Array.isArray(json)) return detailList(inspectionItems(json, t), t("detail.agents.count", { count: json.length }), t);
	if (text === "(no subagents)") return detailList([], t("detail.agents.count", { count: 0 }), t);
	const items: ToolDetailItem[] = [];
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

/**
 * Dựng danh sách việc nền từ văn bản đã ghi nhận.
 * Nhận: text — văn bản kết quả; t — ghế dịch.
 * Trả: mô hình danh sách, hoặc null khi định dạng không nhận ra.
 */
export function jobList(text: string, t: TranslateSeat): ToolDetailsModel | null {
	if (text === "(no background jobs)") return detailList([], t("detail.jobs.count", { count: 0 }), t);
	const items: ToolDetailItem[] = [];
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

/**
 * Dựng danh sách phiên terminal từ văn bản đã ghi nhận.
 * Nhận: text — văn bản kết quả; t — ghế dịch.
 * Trả: mô hình danh sách, hoặc null khi định dạng không nhận ra.
 */
export function terminalList(text: string, t: TranslateSeat): ToolDetailsModel | null {
	if (text === "(no terminal sessions)") return detailList([], t("detail.terminals.count", { count: 0 }), t);
	const items: ToolDetailItem[] = [];
	for (const line of text.split("\n")) {
		const match = /^(\S+)(?: \((.*?)\))? \[([^\]]+)\] (running|exited code=(\S+) signal=(\S+))(?: pid=(\d+))?$/u.exec(line);
		if (match === null) return null;
		const [, id, name, type, state, exitCode, signal, pid] = match;
		if (id === void 0 || type === void 0 || state === void 0) return null;
		const fields: DetailField[] = [{
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

/**
 * Dựng chi tiết kết quả LSP: hover thành khối markdown, phần còn lại thành danh sách vị trí.
 * Nhận: args — tham số đã ghi nhận; text — văn bản kết quả; t — ghế dịch.
 * Trả: mô hình chi tiết, hoặc null khi thiếu tham số hay định dạng không nhận ra.
 */
export function lspDetails(args: Wire, text: string, t: TranslateSeat): ToolDetailsModel | null {
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
	const items: ToolDetailItem[] = [];
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
export function controlDetails(name: string, args: Wire, text: string, json: Wire, t: TranslateSeat): ToolDetailsModel | null {
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
		case "list_subagent_models": return detailList(text.split("\n").map((line): ToolDetailItem => {
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
