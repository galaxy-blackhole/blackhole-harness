/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cau noi voi bang module cua loader: nam module ngoai (react, primitives, store) duoc nap MOT lan trong createPlugin
 */

import type { RequireFn } from "./plugin-types.ts";

/** Kieu dong cho du lieu den tu bundle goc (ban goc khong co kieu). */
export type Dyn = any;

/** Bang module ngoai, do createPlugin nap vao truoc khi dung bat ky component nao. */
export const ext: {
  /** Module @deepseek-ai/dsh-client-store (createSnapshotStore...). */
  store: Dyn;
  /** Module @deepseek-ai/dsh-client-ui-primitives (component + icon + hook dung chung). */
  primitives: Dyn;
  /** Module @deepseek-ai/cordis (lop Service). */
  cordis: Dyn;
  /** Module react/jsx-runtime (jsx, jsxs, Fragment). */
  jsxRuntime: Dyn;
  /** Module react (hook + Component). */
  react: Dyn;
} = { store: undefined, primitives: undefined, cordis: undefined, jsxRuntime: undefined, react: undefined };

/**
 * Nap nam module ngoai qua ham require cua bang module; goi dung MOT lan trong createPlugin.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: khong co.
 */
export function bindRuntime(requireFn: RequireFn): void {
  ext.store = requireFn("@deepseek-ai/dsh-client-store");
  ext.primitives = requireFn("@deepseek-ai/dsh-client-ui-primitives");
  ext.cordis = requireFn("@deepseek-ai/cordis");
  ext.jsxRuntime = requireFn("react/jsx-runtime");
  ext.react = requireFn("react");
}

/**
 * Tao mot phan tu React bang jsx cua runtime dang nap.
 * Nhan: type — loai phan tu; props — thuoc tinh; key — khoa trong danh sach.
 * Tra: node React.
 */
export function h(type: Dyn, props?: Dyn, key?: Dyn): Dyn {
  return ext.jsxRuntime.jsx(type, props ?? {}, key);
}

/**
 * Tao mot phan tu React nhieu con bang jsxs cua runtime dang nap.
 * Nhan: type — loai phan tu; props — thuoc tinh (co children la mang); key — khoa trong danh sach.
 * Tra: node React.
 */
export function hs(type: Dyn, props: Dyn, key?: Dyn): Dyn {
  return ext.jsxRuntime.jsxs(type, props, key);
}

/**
 * Fragment của jsx runtime đang nạp (dùng khi row cần bọc nhiều con mà không thêm node thật).
 * Nhận: không (không có đầu vào).
 * @returns giá trị `Fragment` của jsx runtime trong module-table.
 */
export function fragment(): Dyn {
  return ext.jsxRuntime.Fragment;
}
