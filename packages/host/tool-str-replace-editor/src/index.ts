/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ai/dsh-tool-str-replace-editor: công cụ `str_replace_editor` (view · create · str_replace · insert) trên seam ctx.fs, kèm chính sách sandbox và cắt kết quả theo maxOutputChars.
 */

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";

import { DEFAULT_DESCRIPTION } from "./description.ts";
import { registerStrReplaceEditor } from "./register.ts";
import type { EditorContext } from "./seams.ts";

/** Tên plugin cordis — NGUYÊN VĂN bản gốc. */
export const name = "tool-str-replace-editor";

/** Service bắt buộc — NGUYÊN VĂN mảng `inject` của bản gốc. */
export const inject: string[] = ["tools", "fs"];

/** Cấu hình của công cụ soạn thảo thay chuỗi — NGUYÊN VĂN hợp đồng bản gốc. */
export interface Config {
  /** Ngưỡng ký tự trước khi cắt kết quả trả về (mặc định 16000). */
  maxOutputChars?: number;
  /** Mô tả hướng mô hình (mặc định là {@link DEFAULT_DESCRIPTION}). */
  description?: string;
}

/** Schema cấu hình lúc chạy — NGUYÊN VĂN `z.object({ maxOutputChars: z.number().default(16e3), description: z.string().default(DEFAULT_DESCRIPTION) })`. */
export const Config = z.object({
  maxOutputChars: z.number().default(16e3),
  description: z.string().default(DEFAULT_DESCRIPTION)
});

/**
 * Cài công cụ `str_replace_editor` lên context — NGUYÊN VĂN thứ tự kiểm và chuỗi lỗi của bản gốc.
 * Nhận: ctx — context host mang `tools`/`fs`; config — cấu hình đã chuẩn hoá (mặc định điền sẵn).
 * Trả: không.
 * @throws {Error} khi `maxOutputChars` không phải số nguyên dương an toàn, hoặc `description` rỗng — NGUYÊN VĂN.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = {
    maxOutputChars: config.maxOutputChars ?? 16e3,
    description: config.description ?? DEFAULT_DESCRIPTION
  };
  if (!Number.isSafeInteger(resolved.maxOutputChars) || resolved.maxOutputChars <= 0) throw new Error("tool-str-replace-editor: maxOutputChars must be a positive safe integer");
  if (resolved.description.trim().length === 0) throw new Error("tool-str-replace-editor: description must be non-empty");
  registerStrReplaceEditor(ctx as unknown as EditorContext, resolved);
}
