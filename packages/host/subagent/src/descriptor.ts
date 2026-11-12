/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bản ghi bền của subagent con: sự kiện phiên `subagent/descriptor` có phiên bản, ẩn với model, nhận diện mọi subagent có phiên — port 1:1 descriptor.js (191 dòng) của @deepseek-ai/dsh-subagent, thay augmentation SessionEventMap bằng seam CẤU TRÚC.
 */

import { snapshotJsonValue } from "@deepseek-ai/dsh-util-values";

import type { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import type { ToolRestriction } from "@galaxy-blackhole/gbh-host-tools";

/**
 * Mục tối thiểu của một sự kiện phiên mà phép gộp descriptor cần.
 *
 * Bản gốc nhận `readonly SessionEvent[]` nhờ cộng gộp `SessionEventMap`; bản viết lại KHÔNG cộng gộp
 * module (ADR 000d) nên khai theo CẤU TRÚC: mọi phần tử có `type` và `data` đều nhận được, kể cả
 * `SessionEvent[]` của kernel.
 */
export interface SubagentDescriptorLogEvent {
  /** Loại sự kiện phiên; chỉ `subagent/descriptor` mới được gộp. */
  readonly type: string;
  /** Payload bền CHƯA được kiểm; `parseSubagentDescriptor` mới là nơi thu hẹp nó. */
  readonly data: unknown;
}

/**
 * Phiên bản định dạng descriptor hiện tại, đóng vào MỌI sự kiện `subagent/descriptor` được ghi và
 * được {@link foldSubagentDescriptor} đòi đúng nguyên văn. Hỗ trợ thêm một đầu vào bố cục là một lần
 * đổi phiên bản CÓ CHỦ Ý, không bao giờ là một trường thừa ngầm.
 */
export const SUBAGENT_DESCRIPTOR_VERSION = 3;

/** Bốn khoá dùng chung của mọi payload descriptor được hỗ trợ. */
const DESCRIPTOR_BASE_KEYS = ["version", "mode", "provider", "label"];

/** Khoá của payload one-shot: đúng bốn khoá gốc. */
const ONE_SHOT_DESCRIPTOR_KEYS: ReadonlySet<string> = new Set(DESCRIPTOR_BASE_KEYS);

/** Khoá của payload continuable: bốn khoá gốc + năm trường bố cục có thể phục hồi. */
const CONTINUABLE_DESCRIPTOR_KEYS: ReadonlySet<string> = new Set([
  ...DESCRIPTOR_BASE_KEYS,
  "agentProvider",
  "agentModel",
  "agentReasoningEffort",
  "persona",
  "toolFilter",
]);

/** Khoá của một toolFilter bền: `allow` và/hoặc `deny`. */
const TOOL_FILTER_KEYS: ReadonlySet<string> = new Set(["allow", "deny"]);

/**
 * Trường chung của mọi payload `subagent/descriptor` được hỗ trợ.
 *
 * Khai tại chỗ, KHÔNG xuất khẩu, đúng như bản gốc.
 */
interface SubagentDescriptorBase {
  /** Phiên bản định dạng descriptor ({@link SUBAGENT_DESCRIPTOR_VERSION}). */
  readonly version: number;
  /** Con là một lượt one-shot kết thúc hay một cuộc trò chuyện có thể resume. */
  readonly mode: "one-shot" | "continuable";
  /** Tên provider `ctx.subagents` đã lập ra con. */
  readonly provider: string;
}

/** Một subagent có phiên KHÔNG thể cold-resume sau khi lượt chạy kết thúc. */
export interface OneShotSubagentDescriptorData extends SubagentDescriptorBase {
  /** Luôn là một lượt one-shot. */
  readonly mode: "one-shot";
  /**
   * `description` ngắn của lần uỷ nhiệm đầu, giữ làm nhãn tạo bền của con để phép liệt kê nhận ra
   * cuộc trò chuyện mà không phát lại kết quả tool của cha hay lộ prompt của con.
   */
  readonly label?: string;
}

/** Một subagent có phiên mà bố cục đã khai hỗ trợ cold resume. */
export interface ContinuableSubagentDescriptorData extends SubagentDescriptorBase {
  /** Luôn là một cuộc trò chuyện có thể resume. */
  readonly mode: "continuable";
  /** `description` ngắn của lần uỷ nhiệm đầu, dùng cho phép liệt kê bền. */
  readonly label: string;
  /** `agentOptions.provider` đã phân giải của con, khi được khai. */
  readonly agentProvider?: string;
  /** `agentOptions.model` đã phân giải của con, khi được khai. */
  readonly agentModel?: string;
  /** `agentOptions.reasoningEffort` đã phân giải của con, khi được khai. */
  readonly agentReasoningEffort?: ReasoningEffortId;
  /** Persona riêng của con, đè persona của deployment khi resume. */
  readonly persona?: string;
  /** Phạm vi tool của con, áp lại khi resume. */
  readonly toolFilter?: ToolRestriction;
}

/** Danh tính bền được hỗ trợ của subagent cùng bố cục tiếp nối tuỳ chọn. */
export type SubagentDescriptorData = OneShotSubagentDescriptorData | ContinuableSubagentDescriptorData;

/** Các trường bố cục continuable TRƯỚC khi phép snapshot đóng dấu phiên bản định dạng. */
export type ContinuableSubagentDescriptorInput = Omit<ContinuableSubagentDescriptorData, "version">;

/**
 * Cho biết một giá trị JSON đã lưu có phải bản ghi đối tượng hay không.
 * Nhận: `value` — giá trị bất kỳ đọc từ log bền.
 * Trả: `true` khi là đối tượng khác `null` và không phải mảng.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Từ chối mọi trường nằm ngoài schema đã khai của MỘT bản ghi có phiên bản.
 * Nhận: `value` — bản ghi cần kiểm; `keys` — tập khoá hợp lệ; `path` — tên bản ghi trong thông điệp lỗi.
 * Trả: không; ném lỗi nguyên văn của bản gốc khi gặp khoá lạ.
 */
function assertKnownKeys(value: Record<string, unknown>, keys: ReadonlySet<string>, path: string): void {
  const unknown = Object.keys(value).find((key) => !keys.has(key));
  if (unknown !== undefined) {
    throw new Error(`persisted subagent descriptor ${path} has unknown field "${unknown}"`);
  }
}

/**
 * Đọc MỘT trường chuỗi tuỳ chọn từ một bản ghi descriptor đã lưu.
 * Nhận: `value` — bản ghi; `key` — tên trường cần đọc.
 * Trả: giá trị chuỗi, hoặc `undefined` khi bản ghi không có trường đó.
 * @throws {Error} khi trường có mặt nhưng không phải chuỗi (thông điệp nguyên văn của bản gốc).
 */
function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  if (!Object.hasOwn(value, key)) return undefined;
  const field = value[key];
  if (typeof field !== "string") {
    throw new Error(`persisted subagent descriptor ${key} must be a string`);
  }
  return field;
}

/**
 * Đọc MỘT trường mảng chuỗi tuỳ chọn từ một giới hạn tool đã lưu.
 * Nhận: `value` — bản ghi toolFilter; `key` — tên trường (`allow` hoặc `deny`).
 * Trả: mảng chuỗi đã kiểm, hoặc `undefined` khi bản ghi không có trường đó.
 * @throws {Error} khi trường có mặt nhưng không phải mảng toàn chuỗi (thông điệp nguyên văn của bản gốc).
 */
function optionalStringArray(value: Record<string, unknown>, key: string): string[] | undefined {
  if (!Object.hasOwn(value, key)) return undefined;
  const field = value[key];
  if (!Array.isArray(field)) {
    throw new Error(`persisted subagent descriptor toolFilter.${key} must be an array of strings`);
  }
  const items: readonly unknown[] = field;
  if (items.some((item) => typeof item !== "string")) {
    throw new Error(`persisted subagent descriptor toolFilter.${key} must be an array of strings`);
  }
  return items as string[];
}

/**
 * Kiểm và dựng lại MỘT giới hạn tool đã lưu.
 * Nhận: `value` — payload thô của trường `toolFilter`.
 * Trả: `ToolRestriction` chỉ chứa các khoá đã có mặt (`allow` và/hoặc `deny`).
 * @throws {Error} khi giá trị không phải bản ghi, có khoá lạ, hoặc thiếu cả `allow` lẫn `deny`.
 */
function parseToolFilter(value: unknown): ToolRestriction {
  if (!isRecord(value)) {
    throw new Error("persisted subagent descriptor toolFilter must be an object");
  }
  assertKnownKeys(value, TOOL_FILTER_KEYS, "toolFilter");
  const allow = optionalStringArray(value, "allow");
  const deny = optionalStringArray(value, "deny");
  if (allow === undefined && deny === undefined) {
    throw new Error("persisted subagent descriptor toolFilter must declare allow and/or deny");
  }
  return {
    ...(allow !== undefined ? { allow } : {}),
    ...(deny !== undefined ? { deny } : {}),
  };
}

/**
 * Kiểm MỘT payload descriptor đã lưu cho runtime hiện tại.
 * Nhận: `value` — thân sự kiện `subagent/descriptor` thô.
 * Trả: descriptor đã kiểm, hoặc `undefined` khi phiên bản không phải
 *   {@link SUBAGENT_DESCRIPTOR_VERSION} (runtime này không phân loại được con).
 * @throws {Error} khi payload cùng phiên bản nhưng không khớp schema đã khai đầy đủ.
 */
function parseSubagentDescriptor(value: unknown): SubagentDescriptorData | undefined {
  if (!isRecord(value)) {
    throw new Error("persisted subagent descriptor payload must be an object");
  }
  const version = value["version"];
  if (typeof version !== "number") {
    throw new Error("persisted subagent descriptor version must be a number");
  }
  if (version !== SUBAGENT_DESCRIPTOR_VERSION) return undefined;
  const mode = value["mode"];
  if (mode !== "one-shot" && mode !== "continuable") {
    throw new Error('persisted subagent descriptor mode must be "one-shot" or "continuable"');
  }
  assertKnownKeys(value, mode === "one-shot" ? ONE_SHOT_DESCRIPTOR_KEYS : CONTINUABLE_DESCRIPTOR_KEYS, "payload");
  const provider = value["provider"];
  if (typeof provider !== "string") {
    throw new Error("persisted subagent descriptor provider must be a string");
  }
  if (mode === "one-shot") {
    const label = optionalString(value, "label");
    return {
      version: SUBAGENT_DESCRIPTOR_VERSION,
      mode,
      provider,
      ...(label !== undefined ? { label } : {}),
    };
  }
  const label = value["label"];
  if (typeof label !== "string") {
    throw new Error("persisted subagent descriptor label must be a string");
  }
  const agentProvider = optionalString(value, "agentProvider");
  const agentModel = optionalString(value, "agentModel");
  const agentReasoningEffort = optionalString(value, "agentReasoningEffort");
  const persona = optionalString(value, "persona");
  const toolFilter = Object.hasOwn(value, "toolFilter") ? parseToolFilter(value["toolFilter"]) : undefined;
  return {
    version: SUBAGENT_DESCRIPTOR_VERSION,
    mode,
    provider,
    label,
    ...(agentProvider !== undefined ? { agentProvider } : {}),
    ...(agentModel !== undefined ? { agentModel } : {}),
    // Bản gốc chỉ kiểm trường này là chuỗi; nhãn `ReasoningEffortId` là kiểu chỉ-tĩnh của tuyến đã
    // ghi ra chính giá trị đó, nên ép lại đúng nhãn SAU khi đã kiểm kiểu chuỗi.
    ...(agentReasoningEffort !== undefined ? { agentReasoningEffort: agentReasoningEffort as ReasoningEffortId } : {}),
    ...(persona !== undefined ? { persona } : {}),
    ...(toolFilter !== undefined ? { toolFilter } : {}),
  };
}

/**
 * Kiểm và tách rời một đầu vào descriptor continuable.
 * Nhận: `input` — các trường bố cục continuable do bên gọi thu thập.
 * Trả: payload descriptor continuable đã đóng phiên bản và đã tách rời.
 * @throws {Error} khi một trường không tuần tự hoá JSON KHÔNG mất mát.
 */
export function snapshotSubagentDescriptor(input: ContinuableSubagentDescriptorInput): ContinuableSubagentDescriptorData {
  const candidate = {
    version: SUBAGENT_DESCRIPTOR_VERSION,
    mode: input.mode,
    provider: input.provider,
    label: input.label,
    ...(input.agentProvider !== undefined ? { agentProvider: input.agentProvider } : {}),
    ...(input.agentModel !== undefined ? { agentModel: input.agentModel } : {}),
    ...(input.agentReasoningEffort !== undefined ? { agentReasoningEffort: input.agentReasoningEffort } : {}),
    ...(input.persona !== undefined ? { persona: input.persona } : {}),
    ...(input.toolFilter !== undefined ? { toolFilter: input.toolFilter } : {}),
  };
  const snapshot = snapshotJsonValue(candidate);
  if (snapshot === undefined) {
    throw new Error("subagent descriptor is not losslessly JSON-serializable");
  }
  return snapshot;
}

/**
 * Gộp một log con đã lưu về descriptor được hỗ trợ. Sự kiện `subagent/descriptor` ĐẦU TIÊN là
 * nguồn có thẩm quyền — provider đã lập ra con ghi đúng một sự kiện, nên một sự kiện cùng loại về
 * sau không thể viết lại bố cục đã khai.
 * Nhận: `events` — các sự kiện phiên con đã nạp.
 * Trả: descriptor, hoặc `undefined` khi log không có sự kiện đó hay phiên bản của nó không phải
 *   {@link SUBAGENT_DESCRIPTOR_VERSION} (runtime này không phân loại được con).
 * @throws {Error} khi payload cùng phiên bản đã lưu không khớp schema đã khai đầy đủ.
 */
export function foldSubagentDescriptor(events: readonly SubagentDescriptorLogEvent[]): SubagentDescriptorData | undefined {
  const event = events.find((candidate) => candidate.type === "subagent/descriptor");
  if (event === undefined) return undefined;
  return parseSubagentDescriptor(event.data);
}
