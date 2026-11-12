/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt cắt SEAM của bộ điều khiển truy cập, khai theo CẤU TRÚC (không `declare module` nào — luật
 *      000d): vòng đời hiệu ứng, tiêm phụ thuộc, log, lời gọi Remote đang phục vụ, và bảng chèn index
 *      của webserver.
 */

import type { RemoteInvocation } from "@deepseek-ai/dsh-typert-protocol";

/** Một dòng chèn vào chỉ mục HTML của webserver. */
export interface IndexInjectionEntry {
  /** Loại dòng chèn; tool này chỉ dùng `global`. */
  readonly kind: "global";
  /** Tên thuộc tính `globalThis` sẽ mang giá trị. */
  readonly name: string;
  /** Giá trị (ở đây: baseline truy cập). */
  readonly value: unknown;
}

/** Context CON của `webServer` mà row này tiêm vào để gắn listener chèn index. */
export interface WebServerChildContext {
  /**
   * Gắn listener cho MỘT sự kiện của webserver.
   * Nhận: tên sự kiện và listener (bảng chèn index).
   * Trả: giá trị do kernel trả về.
   */
  on(event: "webserver/index-inject", listener: (table: IndexInjectionEntry[]) => void): unknown;
}

/** Context của plugin mà service này chạm tới. */
export interface RemoteAccessContext {
  /**
   * Đăng ký MỘT hiệu ứng dọn thuộc fiber này.
   * Nhận: hàm dựng callback dọn, và nhãn.
   * Trả: hàm dọn của đăng ký.
   */
  effect(callback: () => () => void, label: string): () => void;
  /**
   * Tiêm phụ thuộc: chờ service có mặt rồi chạy callback trên context con.
   * Nhận: danh sách khoá service, và callback nhận context con.
   * Trả: giá trị do kernel trả về.
   */
  inject(deps: string[], callback: (ctx: WebServerChildContext) => void): unknown;
  /** Log của kernel. */
  readonly logger: {
    /**
     * Ghi MỘT cảnh báo.
     * Nhận: thông điệp (chuỗi hoặc giá trị), và (tuỳ chọn) lỗi kèm theo.
     * Trả: không.
     */
    warn(message: unknown, error?: unknown): void;
  };
  /** Lời gọi Remote đang được phục vụ trên chính context truy cập service (có thể vắng). */
  readonly invocation: RemoteInvocation | undefined;
}
