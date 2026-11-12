/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Schema tham số + schema đầu ra của 9 tool agent-team gốc — nguyên văn từ bundle gốc, dựng lại
 *      bằng `as const` để kiểu suy ra khớp đúng giá trị mà model được hứa — cộng schema đầu ra của
 *      HAI tool BỔ SUNG `set_team_limits` và `reset_teammate` (không có ở bản gốc).
 */

import type { InferValue, ValueSchemaSpec } from "@galaxy-blackhole/gbh-host-tools";

export const MEMBER_VIEW_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		target: {
			type: "string",
			required: true
		},
		role: {
			type: "string",
			required: true,
			enum: ["lead", "teammate"]
		},
		status: {
			type: "string",
			required: true,
			enum: [
				"running",
				"inactive",
				"provisioning",
				"failed"
			]
		},
		description: { type: "string" },
		provider: { type: "string" },
		context: {
			type: "string",
			enum: ["fresh", "fork"]
		},
		model: { type: "string" },
		diagnostics: {
			type: "array",
			required: true,
			items: { type: "string" }
		}
	}
} as const;
/** One shared task, matching the public `TeamTaskView`. */
export const TASK_VIEW_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		id: {
			type: "string",
			required: true
		},
		revision: {
			type: "integer",
			required: true
		},
		subject: {
			type: "string",
			required: true
		},
		description: {
			type: "string",
			required: true
		},
		status: {
			type: "string",
			required: true,
			enum: [
				"pending",
				"in_progress",
				"completed",
				"deleted"
			]
		},
		ownerName: { type: "string" },
		blockedBy: {
			type: "array",
			required: true,
			items: { type: "string" }
		},
		writeScopes: {
			type: "array",
			required: true,
			items: { type: "string" }
		},
		ready: {
			type: "boolean",
			required: true
		},
		writeScopeWarnings: {
			type: "array",
			required: true,
			items: { type: "string" }
		}
	}
} as const;
export const SPAWN_VALUE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: { member: {
		...MEMBER_VIEW_SCHEMA,
		required: true
	} }
} as const;
/**
 * Đầu ra của tool BỔ SUNG `reset_teammate`: ĐÚNG hình dạng `spawn_teammate` — dòng roster sau khi
 * teammate được nạp lại (cùng tên · mô tả · provider, id phiên không đổi).
 */
export const RESET_VALUE_SCHEMA = SPAWN_VALUE_SCHEMA;
export const MEMBER_LIST_VALUE_SCHEMA = {
	type: "array",
	items: MEMBER_VIEW_SCHEMA
} as const;
export const SEND_VALUE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: { sent: {
		type: "boolean",
		required: true,
		const: true
	} }
} as const;
/** `noProgress` is present only on the model-only shortcut that skips the wait. */
export const WAIT_VALUE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		timedOut: {
			type: "boolean",
			required: true
		},
		noProgress: {
			type: "object",
			additionalProperties: false,
			properties: {
				reason: {
					type: "string",
					required: true,
					const: "no-active-peer"
				},
				message: {
					type: "string",
					required: true
				}
			}
		}
	}
} as const;
export const INTERRUPT_VALUE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: { previousStatus: {
		type: "string",
		required: true,
		enum: ["running", "inactive"]
	} }
} as const;
/** Trần triển khai đang có hiệu lực — chỉ tool bổ sung `set_team_limits` của ta dùng. */
export const TEAM_LIMITS_VALUE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		maxMembers: {
			type: "integer",
			required: true
		},
		maxTasks: {
			type: "integer",
			required: true
		}
	}
} as const;
export const TASK_LIST_VALUE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		tasks: {
			type: "array",
			required: true,
			items: TASK_VIEW_SCHEMA
		},
		nextCursor: { type: "integer" }
	}
} as const;

/**
 * Khai một schema đầu ra chuẩn kèm JSON gọn cho model đọc: mọi kết quả Team là bản ghi cố định,
 * nên chính schema đã khai là thứ khiến bộ biên dịch đối chiếu `execute` với giá trị đã hứa cho model.
 * @param schema - schema giá trị chuẩn của MỘT tool.
 * @returns khai báo `output` mà {@link defineTool} nhận.
 */
export function jsonOutput<O extends ValueSchemaSpec>(schema: O) {
	return {
		schema,
		render: (_args: unknown, value: InferValue<O>) => [{
			type: "text" as const,
			text: JSON.stringify(value),
		}],
	};
}
