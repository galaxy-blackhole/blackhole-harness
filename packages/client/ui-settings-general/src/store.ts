/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Dựng store của row ui-settings-general từ context — nửa WIRING sở hữu
 */

import type { ConfigFormsSurface, GeneralStore } from "./types.ts";

/** Bề mặt context tối thiểu mà row dùng (chỉ khai phần ĐÃ dùng). */
export interface GeneralContextLike {
  /** Trạng thái kết nối realtime. */
  connection: { state: unknown };
  /** Danh mục phím tắt. */
  shortcuts: {
    readonly catalog: unknown;
    /** Đăng ký một phím tắt; trả hàm gỡ (dùng trong `ctx.effect`). */
    register(definition: unknown): () => void;
  };
  /** Bề mặt configForms (do gói ui-settings cấp). */
  configForms: ConfigFormsSurface;
}

/**
 * Dựng store dùng chung cho 7 file UI.
 * Nhận: context của plugin.
 * Trả: store với 4 nguồn mà bản gốc phơi qua hook root.
 */
export function createStore(ctx: GeneralContextLike): GeneralStore {
  return {
    desktopUpdate: ctx.connection.state,
    connectionState: ctx.connection.state,
    shortcuts: ctx.shortcuts.catalog,
    developerTools: ctx.configForms.developerTools.enabled,
  };
}