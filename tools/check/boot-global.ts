/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Helper dùng chung cho MỌI công cụ đo: đọc global đồ thị boot — CHỈ __GBH_BOOT__ (19/10/2026: alias __DSH_BOOT__ đã bỏ)
 */

// VI SAO CO FILE NAY (task-31, Wave D)
//   19/10/2026 (task-137): host CHỈ phát `__GBH_BOOT__` (alias `__DSH_BOOT__` đã bỏ theo quyết định Lead).
//   Công cụ đo phải đọc theo đúng thứ tự đó; vẫn nhận tên CŨ để chạy được trên app/fixture cũ (fallback).
//   Bản thân biểu thức trong `page.evaluate` KHÔNG import được helper (Playwright serialize hàm) nên chỗ đó
//   dùng literal inline; các helper dưới đây dùng cho phía Node (HTML string, object scope).

/** Tên global CHÍNH mang đồ thị boot. */
export const BOOT_GLOBAL = "__GBH_BOOT__";

/** Tên global CŨ — DÙNG CHO APP/FIXTURE CŨ khi so sánh; app của ta KHÔNG còn phát tên này. */
export const BOOT_GLOBAL_LEGACY = "__DSH_BOOT__";

/** Hai tên global theo thứ tự ưu tiên (mới trước) — dùng cho thông điệp/thông báo. */
export const BOOT_GLOBAL_NAMES: readonly string[] = Object.freeze([BOOT_GLOBAL, BOOT_GLOBAL_LEGACY]);

/**
 * Vị trí global đồ thị boot trong HTML: tên MỚI trước, tên CŨ sau.
 * @param html nội dung HTML của trang.
 * @returns chỉ số bắt đầu của tên global (để cắt JSON theo sau), hoặc -1 khi không thấy cả hai.
 */
export function bootGlobalIndex(html: string): number {
  const fresh = html.indexOf(BOOT_GLOBAL);
  if (fresh >= 0) return fresh;
  // 19/10/2026 (task-137): mặc định CHỈ dò __GBH_BOOT__. Alias __DSH_BOOT__ chỉ để so sánh với app/fixture
  // stock cũ, và phải bật tường minh bằng GBH_BOOT_READ_LEGACY=1.
  return readLegacyAllowed() ? html.indexOf(BOOT_GLOBAL_LEGACY) : -1;
}

/**
 * Có cho phép đọc tên global CŨ hay không (mặc định KHÔNG).
 * Nhận: không. Trả: true khi env `GBH_BOOT_READ_LEGACY=1|true|on`.
 */
export function readLegacyAllowed(): boolean {
  const raw = (process.env.GBH_BOOT_READ_LEGACY ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

/**
 * Trang có global đồ thị boot không (một trong hai tên).
 * @param html nội dung HTML của trang.
 * @returns true khi thấy __GBH_BOOT__ hoặc __DSH_BOOT__.
 */
export function hasBootGlobal(html: string): boolean {
  return bootGlobalIndex(html) >= 0;
}

/**
 * Đọc payload đồ thị boot từ một object toàn cục phía Node (giả lập window/globalThis).
 * @param scope object có thể chứa một trong hai tên global.
 * @returns payload, hoặc null khi không có.
 */
export function readBootPayload(scope: Record<string, unknown> | undefined): unknown {
  if (scope === undefined) return null;
  const fresh = scope[BOOT_GLOBAL];
  if (fresh !== undefined) return fresh;
  if (!readLegacyAllowed()) return null;
  const legacy = scope[BOOT_GLOBAL_LEGACY];
  return legacy === undefined ? null : legacy;
}