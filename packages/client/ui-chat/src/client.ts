/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt có kiểu của nửa client row ui-chat: lời gọi đăng ký bundle và mô tả các lát nguồn
 */

import { PACKAGE_NAME } from "./ids.ts";

/** Hàm require do bảng module của trang cấp cho factory. */
export type RequireFn = (specifier: string) => unknown;

/** Bảng module của trang — thứ duy nhất mà bundle được phép đăng ký vào. */
export interface ModuleLoaderLike {
  /**
   * Đăng ký một factory theo id module.
   * Nhận: spec — cặp { id, factory }.
   * Trả: không có (giá trị trả của loader bị bỏ qua).
   */
  load(spec: { readonly id: string; readonly factory: (requireFn: RequireFn) => unknown }): unknown;
}

/**
 * Lời gọi đăng ký bundle — bản CÓ KIỂU của đúng dòng mà build.ts in vào lib/client.js.
 *
 * ⚠️ Giữ hai bên khớp nhau là bắt buộc: build.ts sinh văn bản
 * `window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-client-ui-chat", factory: factory });`
 * còn hàm này là bản chạy được để test đối chiếu artifact với hằng PACKAGE_NAME. Lệch id ⇒ Loader
 * import theo tên package của row mà bảng module lại khoá theo id khác ⇒ 'import failed' ⇒ UI không render.
 * Nhận: loader — bảng module của trang; factory — hàm dựng mặt plugin.
 * Trả: không có.
 */
export function loadBundle(loader: ModuleLoaderLike, factory: (requireFn: RequireFn) => unknown): void {
  loader.load({ id: PACKAGE_NAME, factory: factory });
}

/**
 * Id module mà artifact phải đăng ký — nguồn sự thật cho test đối chiếu.
 * Nhận: không có.
 * Trả: chuỗi id module.
 */
export function bundleId(): string {
  return PACKAGE_NAME;
}
