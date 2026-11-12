/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao nua browser: CHI xuat factory, de build.ts boc thanh script classic dang ky MOT id
 */

// Bundle browser KHONG duoc la ESM: bo nap tai no bang the script classic, nen build.ts goi phan nay o dang
// CJS roi boc trong loi goi window.__ModuleLoader__.load({ id, factory }). File nay chi xuat factory —
// khong tu goi load, khong import goi ngoai (moi thu lay qua require cua bang module).
export { createPlugin } from "./plugin.ts";
export type { ClientPlugin } from "./plugin.ts";
