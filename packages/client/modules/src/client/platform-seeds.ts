/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 09/11/2026
 * desc Bang alias SEED nền tảng ở phía client runtime: MỘT module nền có HAI khoá id (id STOCK do vỏ
 *      SPA cấp, id GBH mà bundle của ta require) — tra seed theo id SONG SINH thay vì đoán
 */
//
// 09/11/2026 — VÌ SAO CÓ TỆP NÀY (đo trên app đang chạy ở cổng 5439, không đoán):
//   · Vỏ SPA đang phục vụ là bản STOCK — đo bằng hash: trang tải `assets/index-CN7NIWNw.js` sha
//     `4bc914bf…` = `apps/host/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-CN7NIWNw.js`
//     (dùng `__DSH_BOOT__`). `SZ()` của nó cấp 11 khoá seed dưới ID STOCK
//     (`@deepseek-ai/dsh-client-ui-slots` · `@deepseek-ai/dsh-client-store` · `…-primitives` · `…-dockkit`),
//     ĐÚNG 0 khoá GBH. Giá trị của khoá ui-slots có đủ bề mặt renderer cần
//     (`SlotCore` · `SlotOwnershipError` · `StaleAuthorizationError` · `resolveSlotLabel` · `standardHookPropName`).
//   · Bundle client của ta đã qua chuẩn hoá id seed lúc build (`tools/lib/id-normalize.ts`, §SEED_MODULES§)
//     nên require ID GBH (`@galaxy-blackhole/gbh-client-ui-slots` · `@galaxy-blackhole/gbh-client-store` · …).
//   · Đồ thị boot của Host KHÔNG có dòng/alias nào cho bốn id đó (đo: 75 dòng, 0 dòng chứa "ui-slots")
//     ⇒ require trượt cả ba nhánh seed · loadCache · factories ⇒ ném
//     `client-modules: require("…ui-slots") missed the module table` ⇒ factory ui-renderer chết
//     ⇒ trang hiện "Failed to load plugins", (8) UI render 0 slot.
//   Bốn id dưới đây là ĐÚNG bốn id GBH của §SEED_MODULES§ — nguồn sự thật DUY NHẤT ở phía build;
//   `tests/client/client-modules-platform-seeds.test.ts` chạy cổng đối chiếu bảng dẫn xuất với §SEED_MODULES§.

/**
 * Bốn module NỀN của vỏ SPA, khai bằng ID CỦA TA — đúng thứ tự và đúng bộ của `SEED_MODULES`
 * (`tools/lib/id-normalize.ts`). Chỉ bốn id này được phép tra seed theo id song sinh; mọi id khác
 * giữ nguyên hành vi cũ (không nới bảng module).
 */
export const PLATFORM_SEED_MODULES: readonly string[] = Object.freeze([
  "@galaxy-blackhole/gbh-client-store",
  "@galaxy-blackhole/gbh-client-ui-slots",
  "@galaxy-blackhole/gbh-client-ui-primitives",
  "@galaxy-blackhole/gbh-client-ui-dockkit",
]);

/** Tiền tố hai hệ id — quy ước đặt tên của repo (xem `tools/lib/id-normalize.ts` §bangId§). */
const TIEN_TO_TA = "@galaxy-blackhole/gbh-";
/** Tiền tố id gốc (stock) của cùng quy ước. */
const TIEN_TO_GOC = "@deepseek-ai/dsh-";

/**
 * Bảng HAI CHIỀU id GBH ↔ id stock của bốn module nền, dựng MỘT LẦN từ bảng trên.
 *
 * KHÔNG viết id stock thành chuỗi literal trong tệp này: `tools/p1b/denta-profile.ts` (chạy trong
 * `scripts/sync-lib-to-profile.sh` — bước bắt buộc trước mỗi lượt boot) đổi MỌI id stock sang id GBH
 * trong bản cài profile, kể cả trong chính tệp này; literal sẽ bị đổi thành id GBH ⇒ hai vế của cặp
 * trùng nhau ⇒ alias tự triệt tiêu đúng lúc cần nhất. Dẫn xuất theo tiền tố thì bản cài giữ nguyên.
 */
const BANG_SONG_SINH: ReadonlyMap<string, string> = ((): ReadonlyMap<string, string> => {
  const cap: Array<readonly [string, string]> = [];
  for (const ta of PLATFORM_SEED_MODULES) {
    const goc = TIEN_TO_GOC + ta.slice(TIEN_TO_TA.length);
    cap.push([ta, goc], [goc, ta]);
  }
  return new Map(cap);
})();

/**
 * Id SONG SINH của một specifier trong bảng module nền tảng của vỏ SPA.
 *
 * Nhận: `spec` — specifier mà factory vừa require (id GBH hoặc id stock của một module nền).
 * Trả: khoá còn lại của CÙNG một module nền, hoặc undefined khi spec không thuộc bốn module nền.
 */
export function seedAliasOf(spec: string): string | undefined {
  return BANG_SONG_SINH.get(spec);
}
