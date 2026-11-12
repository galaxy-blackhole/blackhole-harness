/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bo chay dung chung: bom jsx/react/primitives cua bang module vao mot lan, giu nguyen hinh dang loi goi cua ban goc
 */

import type { JsxRuntime, PrimitivesModule, ReactModule, ToolRuntimeDeps } from "./types.ts";

/** Ban dang ky cua bang module — chi duoc dat MOT lan boi createPlugin truoc moi lan render. */
let impl: ToolRuntimeDeps | null = null;

/**
 * Bom bang module cua tang nap vao bo chay dung chung.
 * Nhan: deps — jsx/jsxs/Fragment cua react/jsx-runtime, react, primitives.
 * Tra: khong co.
 */
export function configureRuntime(deps: ToolRuntimeDeps): void {
  impl = deps;
}

/**
 * Doc mot thuoc tinh cua bang module dang duoc bom.
 * Nhan: bag — ten bang (jsx · react · primitives); key — ten thuoc tinh.
 * Tra: gia tri thuoc tinh, hoac undefined khi chua bom bang do.
 */
function readBag(bag: "jsx" | "react" | "primitives", key: string): unknown {
  if (impl === null) return undefined;
  const source = impl[bag] as unknown as Record<string, unknown>;
  return source[key];
}

/**
 * Tao doi tuong truy xuat LUOng cho mot bang module — moi lan doc deu lay gia tri THAT tai thoi diem goi.
 * Nhan: bag — ten bang can boc.
 * Tra: doi tuong proxy doc xuyen.
 */
function proxyBag(bag: "jsx" | "react" | "primitives"): Record<string, unknown> {
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === "string" ? readBag(bag, key) : undefined),
  });
}

/**
 * Doi tuong thay cho require("react/jsx-runtime") — ban goc goi jsx/jsxs/Fragment qua no.
 * Nhan: khong co (proxy).
 * Tra: doi tuong proxy doc xuyen.
 */
export const jsxRuntime: JsxRuntime = proxyBag("jsx") as unknown as JsxRuntime;

/**
 * Doi tuong thay cho require("react") — ban goc goi hook qua no.
 * Nhan: khong co (proxy).
 * Tra: doi tuong proxy doc xuyen.
 */
export const react: ReactModule = proxyBag("react") as unknown as ReactModule;

/**
 * Doi tuong thay cho require("@galaxy-blackhole/gbh-client-ui-primitives") — ban goc lay icon/primitive qua no.
 * ⚠️ CHI doc trong THAN ham render: luc nap module bang chua duoc bom.
 * Nhan: khong co (proxy).
 * Tra: doi tuong proxy doc xuyen.
 */
export const primitives: PrimitivesModule = proxyBag("primitives") as unknown as PrimitivesModule;

/**
 * Ghi nho mot component — giu nguyen chu ky cua react.memo nhung khong doi hanh vi render.
 * Dung ham nay thay react.memo o PHAM VI MODULE (luc do bang module chua duoc bom).
 * Nhan: component — ham component goc.
 * Tra: chinh ham do (React khong bat buoc phai duoc memo hoa).
 */
export function memo<T>(component: T): T {
  return component;
}

/**
 * Noi cac ten lop CSS lai, bo qua gia tri gia — thay cho thu vien clsx cua ban goc.
 * Nhan: danh sach gia tri (chuoi · so · mang · doi tuong dieu kien · gia tri gia).
 * Tra: chuoi ten lop da noi.
 */
export function classNames(...values: unknown[]): string {
  const out: string[] = [];
  const push = (value: unknown): void => {
    if (typeof value === "string" || typeof value === "number") {
      if (value !== "") out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) push(item);
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const [key, on] of Object.entries(value as Record<string, unknown>)) if (on === true) out.push(key);
    }
  };
  for (const value of values) push(value);
  return out.join(" ");
}
