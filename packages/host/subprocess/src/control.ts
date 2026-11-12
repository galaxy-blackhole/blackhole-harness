/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Giao thức kênh byte THỪA KẾ dùng chung giữa các launcher subprocess và tiến trình con Node
 *      (subpath `@deepseek-ai/dsh-subprocess/control` của bản gốc)
 */
import type { Duplex } from "node:stream";
import { Socket } from "node:net";

/** Descriptor của tiến trình con dành riêng cho kênh điều khiển subprocess tuỳ chọn. */
export const SUBPROCESS_CONTROL_FD = 7;

/** Dấu khởi chạy RIÊNG TƯ, được tiêu thụ trước khi một tiến trình con Node chạy mã ứng dụng. */
export const SUBPROCESS_CONTROL_ENV = "DSH_SUBPROCESS_CONTROL";

/**
 * Tiêu thụ dấu khởi chạy rồi mở ống điều khiển thừa kế ở fd 7. Luồng trả về SỞ HỮU descriptor đó. Chỉ gọi
 * MỘT lần trước khi chạy mã không đáng tin; các thông điệp vẫn không đáng tin dù endpoint được thừa kế.
 * Nhận: không (đọc `process.env[DSH_SUBPROCESS_CONTROL]`, xoá nó, rồi mở fd 7).
 * Trả: một luồng duplex chế độ byte đã kết nối, do bên gọi sở hữu.
 * Ném khi dấu khởi chạy thiếu/không hợp lệ, hoặc khi không mở được descriptor thừa kế.
 */
export function openInheritedControlChannel(): Duplex {
  const marker = process.env[SUBPROCESS_CONTROL_ENV];
  Reflect.deleteProperty(process.env, SUBPROCESS_CONTROL_ENV);
  if (marker !== "pipe") throw new Error("subprocess control channel was not inherited");
  return new Socket({
    fd: SUBPROCESS_CONTROL_FD,
    readable: true,
    writable: true,
    allowHalfOpen: true,
  });
}
