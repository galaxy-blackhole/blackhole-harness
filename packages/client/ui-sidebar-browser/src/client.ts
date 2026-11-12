/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao nua client — chi xuat factory createPlugin cho build.ts bundle
 */

// Bundle browser KHONG duoc la ESM: tang nap tai no bang the script classic, nen build.ts goi phan nay o
// dang CJS roi boc trong loi goi window.__ModuleLoader__.load({ id, factory }). File nay chi xuat factory —
// khong tu goi load, khong import goi ngoai (chi module noi bo da bundle san).
export { createPlugin } from "./plugin.ts";
export type { SidebarBrowserPlugin } from "./plugin.ts";
