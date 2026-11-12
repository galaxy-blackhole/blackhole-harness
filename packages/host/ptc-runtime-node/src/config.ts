/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chế độ thực thi + hạn tài nguyên của provider PTC (Node): Config · ResolvedConfig · schema NodeConfig ·
 *      validateConfig — port 1:1 vùng config của @deepseek-ai/dsh-ptc-runtime-node (index.js 688–725)
 */

import z from "@deepseek-ai/schemastery";

import type { LaunchConfig } from "./launch.ts";

/* Execution mode and resource limits for the Node PTC provider. */

/** Bề mặt TỐI THIỂU của schemastery mà module này gọi — bản gốc `import z from "@deepseek-ai/schemastery"`. */
interface SchemaApi {
  /** Schema đối tượng trên một shape cố định. */
  object(shape: Record<string, SchemaNode>): SchemaNode;
  /** Union của các nhánh (bản gốc: `executionMode` và `launch`). */
  union(list: readonly SchemaNode[]): SchemaNode;
  /** Hằng chuỗi (bản gốc: `z.const(...)`). */
  const(value: string): SchemaNode;
  /** Số (bản gốc: `z.number()`). */
  number(): SchemaNode;
  /** Chuỗi (bản gốc: `z.string()`). */
  string(): SchemaNode;
}

/**
 * Một nút schema: hai phương thức bản gốc gọi trên kết quả (`default` · `required`) và bề mặt
 * Standard Schema mà cordis đọc (`~standard.validate`) — đúng thứ kernel dùng để áp default/kiểm config.
 */
interface SchemaNode {
  /** Giá trị mặc định khi Loader không cấu hình trường này. */
  default(value: unknown): SchemaNode;
  /** Trường BẮT BUỘC (không có default). */
  required(): SchemaNode;
  /** Giao diện chuẩn (Standard Schema) mà cordis gọi để chuẩn hoá config. */
  readonly "~standard": {
    /** Phiên bản giao diện (schemastery đặt 1). */
    readonly version: number;
    /** Chuẩn hoá + kiểm config; trả `{ value }` hoặc `{ issues }`. */
    validate(value: unknown): { readonly value?: unknown; readonly issues?: unknown };
  };
}

// 19/10/2026 (Lead chốt: GIỮ 1:1): import TĨNH như bản gốc, không createRequire. Phân giải lúc chạy do
// `mount.ts` symlink peer vào profile (gbh.peers có "@deepseek-ai/dsh-...", cordis+schemastery tự động);
// phân giải lúc typecheck nhờ symlink trong node_modules của gói (gitignored, cùng cách attachment-local).
// Khai SchemaApi/SchemaNode ở trên chỉ dùng để MÔ TẢ bề mặt z; NodeConfig vẫn là schema schemastery THẬT.

/** Hằng số lớn nhất của hẹn giờ Node — bản gốc lấy `MAX_TIMER_DELAY_MS` từ @deepseek-ai/dsh-timeout. */
const MAX_TIMER_DELAY_MS = 2147483647;

/**
 * Deployment-varying runtime bounds and launch choices.
 * Nhận: không (chỉ là khai báo kiểu) — mọi trường đều tùy chọn vì Loader áp default từ NodeConfig.
 * Trả: không (không sinh mã lúc chạy).
 */
export interface Config {
  /** Worker invocation in the subprocess world; omitted selects the local carrier. */
  launch?: LaunchConfig;
  /** per-call starts fresh processes; persistent-in-memory retains a REPL per owner under the same file policy. */
  executionMode?: "per-call" | "persistent-in-memory";
  /** Default elapsed deadline, including nested tool and approval waits. */
  timeoutMs?: number;
  /** Maximum numeric elapsed budget accepted by resolve. */
  maxTimeoutMs?: number;
  /** Combined serialized logs, completion and diagnostic byte cap. */
  maxOutputBytes?: number;
  /** V8 old-generation heap limit in MiB; native allocations are excluded. */
  maxOldGenerationSizeMb?: number;
  /** Maximum control frame, outstanding argument and queued control-output bytes. */
  maxMessageBytes?: number;
  /** Maximum simultaneous host binding calls accepted from a program. */
  maxPendingCalls?: number;
  /** Managed process termination and output-drain grace in milliseconds. */
  graceMs?: number;
}

/**
 * Configuration after Loader defaults and executable selection.
 * Nhận: không (chỉ là khai báo kiểu).
 * Trả: không (không sinh mã lúc chạy).
 */
export type ResolvedConfig = Required<Config>;

/**
 * Loader defaults for the Node PTC provider.
 * Nhận: không — schema tự áp default khi Loader không cấu hình.
 * Trả: SchemaNode — schema cấu hình `Config` (mặc định: per-call · 120000 · 600000 · 67108864 · 512 ·
 *   134217728 · 128 · 3000; `launch` không default).
 */
// Kiểu suy ra từ schemastery THẬT (không ép về SchemaNode) — 1:1 với bản gốc, vẫn giữ mô tả bề mặt ở trên.
export const NodeConfig = z.object({
  executionMode: z.union([z.const("per-call"), z.const("persistent-in-memory")]).default("per-call"),
  timeoutMs: z.number().default(12e4),
  maxTimeoutMs: z.number().default(6e5),
  maxOutputBytes: z.number().default(67108864),
  maxOldGenerationSizeMb: z.number().default(512),
  maxMessageBytes: z.number().default(134217728),
  maxPendingCalls: z.number().default(128),
  graceMs: z.number().default(3e3),
  launch: z.union([z.object({
    kind: z.const("node-script").required(),
    executable: z.string().required(),
    bootstrapPath: z.string()
  }), z.object({
    kind: z.const("embedded").required(),
    executable: z.string().required()
  })])
});

/**
 * Validate resolved Node limits and paths.
 * Nhận: config — cấu hình đã được Loader áp default, kèm executable đã chọn.
 * Trả: không; ném Error với thông điệp `ptc-runtime-node: …` khi một hạn không hợp lệ.
 */
export function validateConfig(config: ResolvedConfig): void {
  for (const [key, value] of Object.entries(config)) if (typeof value === "number" && (!Number.isFinite(value) || value <= 0)) throw new Error(`ptc-runtime-node: ${key} must be positive and finite`);
  for (const key of [
    "timeoutMs",
    "maxTimeoutMs",
    "graceMs"
  ] as const) if (config[key] > MAX_TIMER_DELAY_MS) throw new Error(`ptc-runtime-node: ${key} exceeds the supported timer range`);
  if (!Number.isSafeInteger(config.maxOutputBytes) || config.maxOutputBytes < 4) throw new Error("ptc-runtime-node: maxOutputBytes must be an integer of at least 4");
  if (!Number.isSafeInteger(config.maxMessageBytes) || config.maxMessageBytes > 4294967295) throw new Error("ptc-runtime-node: maxMessageBytes must fit an unsigned 32-bit frame length");
  if (!Number.isSafeInteger(config.maxPendingCalls)) throw new Error("ptc-runtime-node: maxPendingCalls must be an integer");
  if (!Number.isSafeInteger(config.maxOldGenerationSizeMb)) throw new Error("ptc-runtime-node: maxOldGenerationSizeMb must be an integer");
}
