/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào nửa browser — chỉ xuất factory createPlugin cho build.ts bọc thành script classic
 */

// Bundle browser KHÔNG được là ESM: loader nạp nó bằng thẻ script classic, nên build.ts gói phần này ở dạng
// CJS rồi bọc trong lời gọi window.__ModuleLoader__.load({ id, factory }). File này chỉ xuất factory.
export { createPlugin } from "./plugin.ts";
export type { RequireFn, StoreModuleLike } from "./plugin.ts";
export type { MarketPlugin } from "./types.ts";
