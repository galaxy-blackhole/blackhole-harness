/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao nua client: ban bien dich ghep tu src/parts theo src/manifest.ts, dang ky DUNG MOT id
 */

// Nua client KHONG phai mot module ESM chay truc tiep: no la BAN BIEN DICH ghep tu src/parts/*.ts
// (de-bundle nguyen van tu bundle goc, xem README cua goi) roi boc thanh script classic trong build.ts:
//   window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory: factory });
// File nay la mat khai bao cua nua client cho Loader va cho cong check:rows.
export { MODULE_IDS, PACKAGE_ALIASES, PACKAGE_NAME, SCHEDULE_PAGE_ID, SCHEDULE_TASK_ID, SLOT_NAMES, STOCK_PACKAGE_NAME, STYLE_MODULES } from "./ids.ts";
export { CSS_REPLACEMENTS, PART_FILES } from "./manifest.ts";
