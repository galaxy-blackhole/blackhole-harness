/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Điểm vào nửa browser: CHỈ xuất factory, để build.ts bọc thành script classic đăng ký MỘT id
 */

// Bundle browser KHÔNG được là ESM: loader nạp bằng thẻ script classic, nên build.ts gói phần này ở dạng
// CJS rồi bọc trong lời gọi window.__ModuleLoader__.load({ id, factory }).
export { createPlugin } from "./plugin.ts";
export type { ClientContextLike, GeneralPlugin, RequireFn } from "./plugin.ts";
