/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Diem vao nua browser: dang ky MOT id module (id cua ta, cung la id bundle TU KHAI) voi factory cua plugin.
 */

import { PACKAGE_NAME } from "./ids.ts";
import { createPlugin, type RequireFn } from "./plugin.ts";

/** Bang module cua trang: CHI id truyen vao `load()` moi vao bang module. */
const loader = (globalThis as unknown as {
  __ModuleLoader__: { load(registration: { id: string; factory: (require: RequireFn) => unknown }): void };
}).__ModuleLoader__;

// id CHINH = ten package cua ta (cung la id bundle tu khai; khai lai o `gbh.row.moduleIds` de cong mount
// kiem duoc — khuon nay lay id qua hang nen phep quet van ban khong thay).
// KHONG dang ky id stock: do lai bang grep trong profile, 0 bundle nao require("@galaxy-blackhole/gbh-client-hmr")
// (row nay la LA cua do thi: no chi inject "modules" chu khong duoc bundle khac require).
loader.load({ id: PACKAGE_NAME, factory: createPlugin });

/** Danh dau file nay la MODULE (tranh che do script toan cuc lam dung ten voi package client khac). */
export {};
