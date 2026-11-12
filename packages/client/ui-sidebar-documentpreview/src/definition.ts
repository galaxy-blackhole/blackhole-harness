/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dinh nghia kieu tab 'text' cua sidebar phai (id/kind/pattern/title nguyen van cua ban goc)
 */

import { TEXTPREVIEW_ID, TEXTPREVIEW_KIND } from "./ids.ts";
import { parseFileAddress } from "./workspace-path.ts";

/**
 * Tieu de tab cho mot dia chi file: ten tep da giai ma.
 *
 * Ca dia chi van la dinh danh noi dung, nen hai tep cung ten o hai thu muc khac nhau la hai tab;
 * chi chu tren chip duoc rut ngan. Giai ma theo tung doan, dung nhu luc dung dia chi.
 * Nhan: address — dia chi dang file:.
 * Tra: doan cuoi da giai ma, hoac chinh dia chi khi khong co doan nao.
 */
export function basenameOf(address: string): string {
  const name = address.slice(address.lastIndexOf("/") + 1);
  if (name === "") return address;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/**
 * Dinh nghia so dang ky cua kieu tab van ban.
 * Nhan: khong.
 * Tra: dinh nghia de dang ky voi so kieu tab.
 */
export function textDefinition(): Record<string, unknown> {
  return {
    id: TEXTPREVIEW_ID,
    kind: TEXTPREVIEW_KIND,
    // 18/10/2026 (task-29): scheme MỚI trước, scheme CŨ sau (địa chỉ đã lưu + plugin ngoài).
    patterns: ["gbh-resource://file/[\\s\\S]+", "dsh-resource://file/[\\s\\S]+"],
    priority: "fallback",
    canOpen: (address: string) => parseFileAddress(address)?.scope === "session",
    title: basenameOf,
  };
}
