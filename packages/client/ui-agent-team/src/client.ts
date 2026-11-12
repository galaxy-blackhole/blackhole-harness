/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào nửa browser của row agent-team — factory mà `lib/client.js` của ta gọi; dựng TeamAction từ
 *      runtime do loader cấp rồi đăng ký từ điển + occupant slot (port 1:1 index.js của bundle gốc, dòng 500-508)
 */

import { PACKAGE_NAME, SET_LIMITS_STYLE_TAG, STYLE_TAG } from "./ids.ts";
import { inject as agentTeamInject, registerAgentTeamUi } from "./mount.ts";
import type { AgentTeamClientCtx } from "./mount.ts";
import { createSetTeamLimitsRow } from "./set-team-limits-row.ts";
import { createTeamAction } from "./team-action.ts";
import type { TeamComponentRuntime, TeamPrimitives, TeamReact } from "./team-types.ts";

/** Hàm `require` do bảng module của loader cấp cho factory (gọi lúc vạt chất hoá). */
export type RequireFn = (specifier: string) => unknown;

/** CSS của TeamAction, do `build.ts` nhúng bằng `define`; chạy từ nguồn (test) thì tra biến toàn cục. */
declare const __GBH_AGENT_TEAM_CSS__: string;

/** CSS RIÊNG của hàng toolview `set_team_limits` — cũng nhúng bằng `define` (ADR 0013). */
declare const __GBH_SET_LIMITS_CSS__: string;

/** Runtime JSX do bảng module cấp (`react/jsx-runtime`). */
interface JsxRuntime {
  /** Dựng element MỘT con. */
  jsx: (type: unknown, props: Record<string, unknown> | null, key?: unknown) => unknown;
  /** Dựng element NHIỀU con. */
  jsxs: (type: unknown, props: Record<string, unknown> | null, key?: unknown) => unknown;
  /** Fragment của React. */
  Fragment: unknown;
}

/**
 * Chèn thẻ `<style>` cho CSS của module, đúng khuôn của bản gốc (chỉ chèn một lần theo `data-plugin-css`).
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

/**
 * Nạp CSS của TeamAction (một module duy nhất, đúng thứ tự bản gốc).
 * Nhận: không.
 * Trả: không.
 */
function injectStyles(): void {
  injectStyle(STYLE_TAG, typeof __GBH_AGENT_TEAM_CSS__ === "string" ? __GBH_AGENT_TEAM_CSS__ : "");
  injectStyle(SET_LIMITS_STYLE_TAG, typeof __GBH_SET_LIMITS_CSS__ === "string" ? __GBH_SET_LIMITS_CSS__ : "");
}

/**
 * Dựng plugin nửa browser từ `require` của loader.
 * Nhận: requireFn — hàm require do loader cấp (react · react/jsx-runtime · react-dom · primitive).
 * Trả: { inject, apply } — đúng hình dạng module nửa browser của bản gốc.
 */
export function createPlugin(requireFn: RequireFn): { inject: string[]; apply(ctx: AgentTeamClientCtx): void } {
  const react = requireFn("react") as TeamReact;
  const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntime;
  const reactDom = requireFn("react-dom") as { createPortal: (children: unknown, container: unknown) => unknown };
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as TeamPrimitives;
  injectStyles();
  const runtime: TeamComponentRuntime = {
    react,
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    Fragment: jsxRuntime.Fragment,
    createPortal: reactDom.createPortal,
    primitives,
  };
  const { TeamAction } = createTeamAction(runtime);
  const SetTeamLimitsRow = createSetTeamLimitsRow(runtime);
  return {
    inject: agentTeamInject,
    apply(ctx: AgentTeamClientCtx): void {
      registerAgentTeamUi(ctx, TeamAction, SetTeamLimitsRow);
    },
  };
}
