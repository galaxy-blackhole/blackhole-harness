/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Diem vao nua browser: xuat factory de build.ts boc thanh script classic dang ky HAI id module
 */

// Bundle browser KHONG duoc la ESM: loader nap no bang the script classic, nen build.ts bundle phan nay
// o dang CJS roi boc trong __ModuleLoader__.load({ id, factory }). Vi vay file nay chi xuat factory,
// khong tu goi load (goi o tang script la viec cua build), va khong import goi ngoai.
export { createPlugin } from "./plugin.ts";
