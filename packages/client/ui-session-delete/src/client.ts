/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Điểm vào nửa browser của row ui-session-delete — factory mà lib/client.js gọi; mount spec Remote,
 *      dựng hộp xác nhận ở React root tách rời rồi đăng ký mục menu (khuôn ui-cot-translation).
 */

import type { DialogRuntime } from "./dialog.ts";
import { INJECT, PACKAGE_NAME, STYLE_TAG } from "./ids.ts";
import type { MenuItemReact } from "./menu-item.ts";
import { registerSessionDeleteUi } from "./mount.ts";
import type { SessionDeleteClientCtx } from "./mount.ts";

/** Hàm require do bảng module của loader cấp. */
export type RequireFn = (specifier: string) => unknown;

/** CSS của row, do `build.ts` nhúng bằng `define`; chạy từ nguồn (test) thì tra biến toàn cục. */
declare const __GBH_SESSION_DELETE_CSS__: string;

/**
 * Chèn thẻ `<style>` cho CSS của row, đúng khuôn của ui-agent-team (một lần theo `data-plugin-css`).
 * Nhận: tagId — id gắn vào `data-plugin-css`; cssText — văn bản CSS.
 * Trả: không.
 */
function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/** Runtime JSX do bảng module cấp. */
interface JsxRuntime {
  /** Dựng element MỘT con. */
  jsx: (type: unknown, props: Record<string, unknown> | null) => unknown;
  /** Dựng element NHIỀU con. */
  jsxs: (type: unknown, props: Record<string, unknown> | null) => unknown;
  /** Fragment của React. */
  Fragment: unknown;
}

/** Bảng react mà component dùng. */
interface ReactModule {
  /** Hook trạng thái. */
  useState: MenuItemReact["useState"];
}

/** Bảng react-dom/client mà hộp thoại dùng. */
interface ReactDomClient {
  /** Tạo React root trên một phần tử DOM. */
  createRoot: DialogRuntime["createRoot"];
}

/**
 * Dựng plugin nửa browser từ require của loader.
 * Nhận: requireFn — require của loader (react · react/jsx-runtime · react-dom/client · primitive).
 * Trả: { inject, apply }; apply BẤT ĐỒNG BỘ vì phải mount Remote trước.
 */
export function createPlugin(requireFn: RequireFn): { inject: readonly string[]; apply(ctx: SessionDeleteClientCtx): Promise<void> } {
  const react = requireFn("react") as ReactModule;
  const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntime;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as Record<string, unknown>;
  const reactDom = requireFn("react-dom/client") as ReactDomClient;
  const runtime: DialogRuntime = {
    react: { useState: react.useState },
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    Fragment: jsxRuntime.Fragment,
    primitives,
    createRoot: reactDom.createRoot,
  };
  injectStyle(STYLE_TAG, typeof __GBH_SESSION_DELETE_CSS__ === "string" ? __GBH_SESSION_DELETE_CSS__ : "");
  return {
    inject: INJECT,
    async apply(ctx: SessionDeleteClientCtx): Promise<void> {
      await registerSessionDeleteUi(ctx, runtime);
    },
  };
}
