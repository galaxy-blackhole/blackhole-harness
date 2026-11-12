/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Diem vao nua client: import vung partial-json + xuat factory createPlugin cho build.ts bundle thanh script classic MOT id
 */

// Nua client KHONG phai mot module ESM chay truc tiep: build.ts bundle file nay thanh CJS roi boc trong
//   window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory: ... })
// factory goi createPlugin(require) va tra ve exports { ModelDirectory, ModelDirectoryResolver, apply, inject }.

// Vung partial-json la MA CHET trong artifact goc (khong module nao tham chieu) nhung van nam trong bundle goc.
//   Import tac dung phu de artifact cua ta phu du vung G4 — lop chi dinh nghia, khong cham DOM/require.
import "./partial-json.ts";

export { createPlugin } from "./plugin.ts";
export type { ClientPluginExports } from "./plugin.ts";
