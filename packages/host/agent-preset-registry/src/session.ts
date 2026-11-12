/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Định nghĩa PROJECTION `agentPreset` trên log phiên — port 1:1 `agentPresetProjectionDefinition`.
 */

import { z } from "zod";

/** Bề mặt zod THẬT mà file này dùng — ép kiểu MỘT lần vì repo có ambient shim "zod" tối thiểu
 *  (`packages/client/ui-sidebar-right/src/externals.d.ts`) chỉ khai bề mặt của gói client; chạy thật vẫn
 *  là zod 4 của kernel. Giữ đúng biểu thức của bản gốc: union(string, null). */
const zod = z as unknown as {
  /** Union nhiều schema. */
  union(types: readonly unknown[]): unknown;
  /** Schema chuỗi. */
  string(): unknown;
  /** Schema literal (nhận null). */
  literal(value: unknown): unknown;
};

/** Schema trạng thái chiếu: preset hiện tại hoặc null. */
const agentPresetSchema = zod.union([zod.string(), zod.literal(null)]);

/**
 * Định nghĩa projection `agentPreset`: giá trị khởi tạo từ header phiên (sự thật lúc TẠO), tiến theo
 * event `agent-preset/selected`; wire view chính là state.
 */
export const agentPresetProjectionDefinition = {
  /** Khoá chiếu. */
  key: "agentPreset",
  /** Schema trạng thái đã lưu. */
  stateSchema: agentPresetSchema,
  /** Khởi tạo từ header phiên. */
  init: (header: { readonly agentPreset?: string | null }): string | null => header.agentPreset ?? null,
  /** Áp một event: chỉ đổi khi event là lượt chọn preset. */
  apply: (state: string | null, event: { readonly type: string; readonly data?: { readonly agentPreset?: string | null } }): string | null =>
    event.type === "agent-preset/selected" ? (event.data as { readonly agentPreset: string | null }).agentPreset : state,
  /** Mặt WIRE của projection. */
  wire: {
    /** Schema khung nhìn. */
    viewSchema: agentPresetSchema,
    /** Khung nhìn = state. */
    view: (state: string | null): string | null => state,
  },
  /** Phiên bản trạng thái. */
  stateVersion: 1,
};