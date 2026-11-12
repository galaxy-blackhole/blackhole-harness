/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Các hàm SO SÁNH/ĐỊNH DANH thuần của bộ điều khiển truy cập: JSON độc lập thứ tự khoá cho
 *      principal, so tài nguyên, so danh sách hành động, chốt nhánh không thể tới, và chờ huỷ.
 */

import type { Principal } from "@deepseek-ai/dsh-typert-protocol";

import type { RemoteAccessAction, RemoteAccessResource } from "./types.ts";

/**
 * Chốt nhánh KHÔNG THỂ TỚI của một union đã đóng.
 * Nhận: giá trị lẽ ra không tồn tại.
 * Trả: không bao giờ trả; luôn ném lỗi nêu giá trị.
 */
export function assertNever(value: never): never {
  throw new Error("remote access: unreachable value " + JSON.stringify(value));
}

/**
 * Văn bản JSON ĐỘC LẬP thứ tự khoá để định danh MỘT principal (kể cả đối tượng lồng nhau).
 * Nhận: giá trị bất kỳ (principal).
 * Trả: chuỗi JSON đã sắp xếp khoá ở mọi cấp.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left < right ? -1 : 1,
    );
    return (
      "{" +
      entries.map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item)).join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

/**
 * Hai tài nguyên BẰNG nhau khi cùng loại và cùng id; `global` không mang id.
 * Nhận: hai tài nguyên.
 * Trả: true khi bằng nhau.
 */
export function sameResource(left: RemoteAccessResource, right: RemoteAccessResource): boolean {
  return left.kind === right.kind && (left as { id?: unknown }).id === (right as { id?: unknown }).id;
}

/**
 * Hai danh sách hành động bằng nhau (cùng độ dài, cùng thứ tự, cùng phần tử).
 * Nhận: hai danh sách.
 * Trả: true khi bằng nhau.
 */
export function sameActions(left: readonly RemoteAccessAction[], right: readonly RemoteAccessAction[]): boolean {
  return left.length === right.length && left.every((action, index) => action === right[index]);
}

/**
 * Chờ MỘT tín hiệu bị huỷ (trả ngay khi đã huỷ).
 * Nhận: tín hiệu cần chờ.
 * Trả: promise hoàn tất khi tín hiệu huỷ.
 */
export function abortion(signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) resolve();
    else
      signal.addEventListener(
        "abort",
        () => {
          resolve();
        },
        { once: true },
      );
  });
}

/** Principal rỗng dùng cho chỗ cần kiểu mà không cần danh tính thật (chỉ để thoả kiểu). */
export type AnyPrincipal = Principal;
