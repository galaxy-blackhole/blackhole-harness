/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao nua browser: CHI xuat factory, de build.ts boc thanh script classic dang ky MOT id
 */

// Bundle browser KHÔNG được là ESM: loader nạp bằng thẻ script classic, nên build.ts gói phần này ở dạng
// CJS rồi bọc trong lời gọi window.__ModuleLoader__.load({ id, factory }).
export { createPlugin, CLIENT_INJECT, INJECT } from "./plugin.ts";
export type { ClientContextLike, CommandDefinition, RequireFn, ShortcutsPlugin } from "./plugin.ts";
