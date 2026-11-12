/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Doi chieu surface cua phien (1:1 core/session/src/surface.ts ma bundle goc nhung san): su kien dan tin nhan nao duoc coi la transcript
 */

import type { SurfaceEvent } from "./types.ts";

/** Bản chạy thật của hợp các loại sự kiện sinh tin nhắn. */
const SURFACE_EVENT_TYPES = new Set(["system/message", "developer/message", "user/message", "assistant/message", "tool/result"]);

/**
 * Thu hẹp một sự kiện về sự kiện surface hợp lệ có mang dấu bắt buộc.
 * Nhận: event — sự kiện cần xét.
 * Trả: true khi cả loại lẫn dấu cùng xác định một sự kiện surface.
 */
export function isSurfaceEvent(event: SurfaceEvent): boolean {
  if (!SURFACE_EVENT_TYPES.has(event.type)) return false;
  return event.surfaceOp !== void 0;
}

/**
 * Thu hẹp một sự kiện về sự kiện surface gốc-append: một sự kiện vào surface đúng vị trí log của nó và
 * chưa từng là bản thay thế.
 *
 * Surface mô hình-visible cố ý che các khoảng đã bị thay thế, nên nó là nguồn SAI cho transcript của người:
 * một bản thay thế đã hạ cánh sẽ xoá hội thoại người dùng đã thấy. Sự kiện gốc-append là nguyên liệu bền
 * của transcript đó; bản thay thế chỉ thuộc mô hình.
 * Nhận: event — sự kiện cần xét.
 * Trả: true khi sự kiện được thêm vào đuôi surface.
 */
export function isAppendSurfaceEvent(event: SurfaceEvent): boolean {
  return isSurfaceEvent(event) && event.surfaceOp === "append";
}
