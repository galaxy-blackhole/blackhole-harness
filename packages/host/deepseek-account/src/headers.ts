/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bốn hàm THUẦN dựng danh tính client Platform cho request tài khoản: gộp Cookie, header desktop,
 *      trọn bộ header gọi, và chuẩn hoá locale đường truyền — đối chiếu từng giá trị với bản gốc.
 */

import type { AccountClientMetadata } from "./types.ts";

/** Hệ điều hành do tầng composition desktop cấp; `null` nghĩa là client web. */
export type DesktopPlatform = "darwin" | "win32" | null;

/**
 * Gộp các cặp Cookie header theo TÊN phân biệt hoa thường, giữ lại cookie không liên quan.
 * Nhận: cookie của request hiện có và cookie của deployment (giá trị được ưu tiên).
 * Trả: một Cookie header, mỗi tên xuất hiện nhiều nhất một lần; cặp không có tên bị bỏ.
 */
export function mergePlatformCookies(base: string, override: string): string {
  const cookies = new Map<string, string>();
  for (const header of [base, override]) {
    for (const pair of header.split(";")) {
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    }
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

/**
 * Nhận diện request API của app desktop gốc; `null` để request không phải desktop y nguyên.
 * Nhận: hệ điều hành do tầng composition desktop cấp.
 * Trả: header request Platform dùng chung cho client tài khoản và client chính sách cập nhật.
 */
export function desktopClientHeaders(platform: DesktopPlatform): Record<string, string> {
  if (platform === null) return {};
  return { "x-client-platform": platform === "win32" ? "desktop-win" : "desktop-mac" };
}

/**
 * Dựng trọn bộ header danh tính client Platform cho MỘT lời gọi.
 * Nhận: hệ điều hành của tầng desktop (`null` = web) và danh tính UI đang gọi.
 * Trả: năm header client (sáu khi là desktop); bundle ID cố ý để rỗng như bản gốc.
 */
export function platformClientHeaders(platform: DesktopPlatform, client: AccountClientMetadata): Record<string, string> {
  return {
    "x-client-bundle-id": "",
    "x-client-platform": "web",
    ...desktopClientHeaders(platform),
    "x-client-version": client.version,
    "x-client-locale": platformWireLocale(client.locale),
    "x-client-timezone-offset": String(client.timezoneOffsetSeconds),
  };
}

/**
 * Rút ngôn ngữ UI của bên gọi về locale Platform có gắn vùng.
 * Dùng CHUNG một phép chuẩn hoá với header và với trường locale trong thân request.
 * Nhận: ngôn ngữ UI đang bật, ví dụ `zh-CN`, `zh_TW`, hay `en-US`.
 * Trả: locale Platform của ngôn ngữ đó, `zh_CN` hoặc `en_US`.
 */
export function platformWireLocale(locale: string): "zh_CN" | "en_US" {
  return locale.toLowerCase().split(/[-_]/)[0] === "zh" ? "zh_CN" : "en_US";
}
