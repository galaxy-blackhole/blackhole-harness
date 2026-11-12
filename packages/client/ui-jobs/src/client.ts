/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Diem vao nua browser: xuat factory de build.ts boc thanh script classic dang ky MOT id module
 */

// Bundle browser KHONG duoc la ESM: loader nap no bang the script classic, nen build.ts bundle phan nay
// o dang CJS roi boc trong window.__ModuleLoader__.load({ id: id CUA TA, factory }). MOT bundle MOT id:
// file nay khong biet va khong khai id cua goi goc. Vi vay file nay chi xuat factory, khong tu goi load
// (goi o tang script la viec cua build), va khong import goi ngoai.
export { createPlugin } from "./plugin.ts";
