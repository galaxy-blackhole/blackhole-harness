/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào nửa browser: CHỈ xuất factory, để build.ts bọc thành script classic đăng ký MỘT id.
 */

// Bundle browser KHÔNG được là ESM: bộ nạp tải nó bằng thẻ script classic, nên build.ts gói phần này ở dạng
// CJS rồi bọc trong lời gọi window.__ModuleLoader__.load({ id, factory }). File này chỉ xuất factory —
// không tự gọi load, không import gói ngoài (mọi thứ lấy qua require của bảng module).
export { createPlugin } from "./plugin.ts";
export type { SidebarFilesPlugin } from "./plugin.ts";
export type { ClientContextLike, RequireFn } from "./types.ts";
