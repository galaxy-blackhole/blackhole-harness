/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nua HOST cua row ui-sidebar-documentpreview: giu NGUYEN VAN be mat export cua ban goc
 *   (Config = schema schemastery z.object · apply bom global __GBH_DOCUMENT_PREVIEW_CONFIG__)
 */

import z from "@deepseek-ai/schemastery";

import type { DocumentPreviewConfig } from "./config.ts";

/** Kiểu tối thiểu của schemastery mà nửa host dùng (giữ đúng chuỗi gọi của bản gốc). */
interface SchemaApi {
  /** Schema đối tượng. */
  object(shape: Record<string, unknown>): unknown;
  /** Số tự nhiên (nguyên >= 0). */
  natural(): { min(value: number): { max(value: number): { default(value: number): unknown } } };
}

/**
 * Schema chuẩn (Standard Schema) — ĐÚNG thứ cordis đọc ở trường ~standard của Config.
 * Cordis gọi validate(raw) để chuẩn hoá config trước khi chạy plugin.
 */
export interface StandardSchemaLike {
  /** Giao diện chuẩn mà cordis dùng. */
  readonly "~standard": {
    /** Phiên bản giao diện (schemastery đặt 1). */
    readonly version: number;
    /** Chuẩn hoá + kiểm config; trả { value } hoặc { issues }. */
    validate(value: unknown): { readonly value?: unknown; readonly issues?: unknown };
  };
}

/** schemastery dưới dạng API gọi được (bản gốc import mặc định "@deepseek-ai/schemastery"). */
const schema = z as unknown as SchemaApi;

/**
 * Schema cấu hình của bàn xem tài liệu — NGUYÊN VĂN hình dạng + biên + mặc định của bản gốc
 * (lib/types/config.js trong bundle gốc). Export một HÀM THƯỜNG ở đây từng làm boot ném
 * "Cannot read properties of undefined (reading 'validate')" ⇒ entry không activate.
 */
export const Config = schema.object({
  office: schema.object({
    maxCachedEntries: schema.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(8),
    maxCachedBytes: schema.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(64 * 1024 * 1024),
    maxPending: schema.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(8),
    maxReaders: schema.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(32),
  }),
  excel: schema.object({
    maxBytes: schema.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(16 * 1024 * 1024),
    maxCells: schema.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(25e4),
    timeoutMs: schema.natural().min(1).max(2147483647).default(15e3),
  }),
}) as StandardSchemaLike;

/**
 * Nhúng cấu hình ĐÃ ĐƯỢC CORDIS CHUẨN HOÁ vào trang trình duyệt (bản gốc: đẩy thẳng config).
 * Nhận: ctx — context của Host phục vụ trang; config — cấu hình cordis đã validate theo Config ở trên.
 * Trả: không.
 */
export function apply(
  ctx: { on(event: string, listener: (table: unknown[]) => void): unknown },
  config: DocumentPreviewConfig,
): void {
  ctx.on("webserver/index-inject", (table: unknown[]) => {
    table.push({ kind: "global", name: "__GBH_DOCUMENT_PREVIEW_CONFIG__", value: config });
  });
}

/** Cấu hình của bàn xem tài liệu — tái xuất KIỂU cho nơi khác (không thêm export giá trị, giống bản gốc). */
export type { DocumentPreviewConfig };
