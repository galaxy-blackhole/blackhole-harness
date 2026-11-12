/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua browser cua row ui-jobs: tu dien khoa job + job-list (MENU bung) trong hang dau session
 */

import { en, zh } from "./locales.ts";
import { LOCALE_KEY, SLOT_OCCUPANT_ID, SLOT_ORDER } from "./ids.ts";
import { vi } from "./locales-vi.ts";

/** require do bang module cap cho factory. */
type RequireFn = (id: string) => unknown;

/** Job dang chay hoac da ket thuc, theo doi tu seam jobs cua Host. */
interface JobRow {
  id?: string;
  status?: string;
  title?: string;
  output?: string;
}

/** jsx runtime (React) do bang module cap. */
interface JsxRuntime {
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  Fragment: unknown;
}

/** Phan react ma component dung (hook + ref). */
interface ReactModule {
  useState<T>(initial: T): [T, (next: T) => void];
  useRef<T>(initial: T | null): { current: T | null };
  useEffect(run: () => void | (() => void), deps?: readonly unknown[]): void;
}

/** react-dom: menu duoc render qua portal. */
interface ReactDomModule {
  createPortal(children: unknown, container: unknown): unknown;
}

/** Bay primitive cua ban goc (API trich tu bundle goc — xem README muc API). */
interface PrimitivesModule {
  MenuSurface: unknown;
  StateDot: unknown;
  TerminalBlock: unknown;
  IconChevronDownOutlineRegular: unknown;
  IconStopFillRegular: unknown;
  useAnchoredPosition(input: {
    open: boolean;
    anchorRef: unknown;
    panelRef: unknown;
    gap: number;
    margin: number;
  }): Record<string, unknown> | undefined;
  useDismissOnOutsidePointer(
    rootRef: unknown,
    open: boolean,
    setOpen: (next: boolean) => void,
    panelRef: unknown,
  ): void;
}

/** Store quan sat duoc ma seam jobs cap qua hooks.jobs. */
interface JobsStore {
  value?: { rows?: JobRow[] };
}

/** Props ma slot inject truyen cho component (hop dong face cua ban goc). */
interface JobActionProps {
  hooks?: { jobs?: unknown };
  sessionId?: string;
  watchRows?: (sessionId: string) => unknown;
  observe?: (sessionId: string, id: string) => unknown;
  killJob?: (sessionId: string, jobId: string) => Promise<boolean | undefined>;
  t?: (key: string, params?: Record<string, unknown>) => string;
}

/** Runtime cua bundle: bon module lay tu bang module. */
interface ClientRuntime {
  jsx: JsxRuntime["jsx"];
  jsxs: JsxRuntime["jsxs"];
  Fragment: unknown;
  react: ReactModule;
  createPortal: ReactDomModule["createPortal"];
  primitives: PrimitivesModule;
}

/** Context phia browser (chi khai phan row nay dung). */
interface ClientContext {
  effect(callback: () => void | (() => void), label?: string): void;
  locale: { register(key: string, copy: Record<string, unknown>): () => void };
  jobs: {
    state: unknown;
    watchRows(sessionId: string): unknown;
    observe(sessionId: string, id: string): unknown;
    kill(sessionId: string, jobId: string): Promise<{ ok?: boolean }>;
  };
  slots: {
    register(definition: Record<string, unknown>, component: unknown): () => void;
    inject(slot: string, register: () => unknown): void;
  };
}

/** Khoang cach giua nut va menu (ban goc dung gia tri nho, don vi px). */
const MENU_GAP = 6;
/** Le an toan so voi mep khung nhin. */
const VIEWPORT_MARGIN = 8;

/** Trang thai coi la dang chay. */
const LIVE_STATUS = ["running", "stopping"];

/**
 * Nut job-list trong hang dau session: bam ra MENU bung liet ke job.
 *
 * Tai hien theo ban goc (da doc bundle goc, khong chep code): neo menu bang useAnchoredPosition,
 * dong khi bam ra ngoai bang useDismissOnOutsidePointer, render qua createPortal vao MenuSurface,
 * moi job mot dong co StateDot, xem output trong TerminalBlock, nut kill goi killJob.
 * Khong co job nao thi tra null (ban goc: visibleCount === 0 => return null).
 * @param props - hook jobs, watchRows, observe, killJob, sessionId, ham dich t va runtime cua bundle.
 * @returns element React, hoac null khi khong co job.
 */
function JobListAction(props: JobActionProps & { runtime: ClientRuntime }): unknown {
  const { jsx, jsxs, Fragment, react, createPortal, primitives } = props.runtime;
  const t = props.t ?? ((key: string): string => key);
  const store = (props.hooks?.jobs ?? {}) as JobsStore;
  const rows = Array.isArray(store.value?.rows) ? (store.value?.rows as JobRow[]) : [];
  const [open, setOpen] = react.useState(false);
  const [expanded, setExpanded] = react.useState("");
  const rootRef = react.useRef<unknown>(null);
  const menuRef = react.useRef<unknown>(null);
  const sessionId = props.sessionId ?? "";
  const menuPosition = primitives.useAnchoredPosition({
    open,
    anchorRef: rootRef,
    panelRef: menuRef,
    gap: MENU_GAP,
    margin: VIEWPORT_MARGIN,
  });
  primitives.useDismissOnOutsidePointer(rootRef, open, setOpen, menuRef);
  react.useEffect(() => {
    if (sessionId !== "" && props.watchRows !== undefined) props.watchRows(sessionId);
  }, [sessionId]);
  if (rows.length === 0) return null;
  const isLive = (row: JobRow): boolean => row.status !== undefined && LIVE_STATUS.indexOf(row.status) >= 0;
  const liveRows = rows.filter(isLive);
  const settledRows = rows.filter((row) => !isLive(row));
  const countText = t(liveRows.length === 1 ? "count.live.one" : "count.live.other", { count: liveRows.length });
  const trigger = jsxs("button", {
    type: "button",
    ref: rootRef,
    "aria-label": t("list.aria"),
    "aria-expanded": open,
    onClick: () => setOpen(!open),
    children: [
      liveRows.length > 0 ? jsx(primitives.StateDot, { state: "running" }) : null,
      jsx("span", { children: countText }),
      jsx(primitives.IconChevronDownOutlineRegular, {}),
    ],
  });
  if (!open) return trigger;
  const itemOf = (row: JobRow, key: string): unknown => {
    const live = isLive(row);
    const rowId = row.id ?? "";
    return jsxs(
      "li",
      {
        children: [
          jsx(primitives.StateDot, { state: row.status ?? "failed" }),
          jsx("span", { children: row.title ?? rowId }),
          live
            ? jsx(primitives.IconStopFillRegular, {
                "aria-label": t("kill.stop"),
                onClick: () => {
                  if (props.killJob !== undefined) void props.killJob(sessionId, rowId);
                },
              })
            : null,
          jsx("button", {
            type: "button",
            "aria-label": t(expanded === rowId ? "row.collapseAria" : "row.expandAria"),
            onClick: () => setExpanded(expanded === rowId ? "" : rowId),
            children: t(expanded === rowId ? "terminal.collapse" : "terminal.noOutput"),
          }),
          expanded === rowId
            ? jsx(primitives.TerminalBlock, { output: row.output ?? "", runStateDot: false })
            : null,
        ],
      },
      key,
    );
  };
  const body = jsxs("ul", {
    "aria-label": t("list.aria"),
    children: [
      liveRows.length > 0 ? jsx("li", { "aria-hidden": "true", children: t("section.live") }) : null,
      ...liveRows.map((row, index) => itemOf(row, "live-" + String(index))),
      settledRows.length > 0
        ? jsx("li", { "aria-hidden": "true", children: t("section.settledCount", { count: settledRows.length }) })
        : null,
      ...settledRows.map((row, index) => itemOf(row, "settled-" + String(index))),
    ],
  });
  const menu = jsx(primitives.MenuSurface, { ref: menuRef, style: menuPosition, children: body });
  return jsxs(Fragment, { children: [trigger, createPortal(menu, globalThis.document?.body)] });
}

/**
 * Da dang ky chua.
 *
 * Bundle nay dang ky HAI id module (ta + stock) trong MOT lan thuc thi, nhung loader tao MOT PLUGIN
 * INSTANCE CHO MOI id => apply duoc goi HAI lan. Lan thu hai dang ky lai slot/locale se nem loi
 * (da gap that trong lab ngay 17/10/2026: 12+ row hai-id cua ta deu ket o trang thai loading).
 */
let installed = false;


/**
 * Tao plugin phia browser cua row ui-jobs.
 * @param requireFn - ham require do bang module cap.
 * @returns doi tuong plugin { apply, inject }.
 */
export function createPlugin(requireFn: RequireFn): { apply(ctx: ClientContext): void; inject: string[] } {
  const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntime;
  const runtime: ClientRuntime = {
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    Fragment: jsxRuntime.Fragment,
    react: requireFn("react") as ReactModule,
    createPortal: (requireFn("react-dom") as ReactDomModule).createPortal,
    primitives: requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule,
  };
  /** Seam phia browser ma row nay can (giong ban goc). */
  const inject = ["jobs", "slots", "locale"];
  /**
   * Dang ky tu dien khoa job va nut job-list trong hang dau session (idempotent).
   * @param ctx - context phia browser.
   */
  function apply(ctx: ClientContext): void {
    // CỜ CHỈ BẬT SAU KHI applyInner CHẠY XONG (bài học React #130): bật sớm ⇒ lần cài sau thoát sớm
    // ⇒ slot không bao giờ được đăng ký lại.
    if (installed) return;
    try {
      applyInner(ctx);
      installed = true;
    } catch (error) {
      console.error("gbh-client-ui-jobs: apply nem loi", error);
      throw error;
    }
  }

  /**
   * Than cua apply: dang ky tu dien va nut job-list.
   * @param ctx - context phia browser.
   */
  function applyInner(ctx: ClientContext): void {
    ctx.effect(() => ctx.locale.register(LOCALE_KEY, { vi, en, zh }), "ui-jobs: dictionaries");
    ctx.slots.inject("conversation.session.header.actions", () =>
      ctx.slots.register(
        {
          name: "conversation.session.header.actions",
          id: SLOT_OCCUPANT_ID,
          order: SLOT_ORDER,
          locale: LOCALE_KEY,
          inject: () => ({
            hooks: { jobs: ctx.jobs.state },
            sessionId: "",
            watchRows: (sessionId: string) => ctx.jobs.watchRows(sessionId),
            observe: (sessionId: string, id: string) => ctx.jobs.observe(sessionId, id),
            killJob: async (sessionId: string, jobId: string) => (await ctx.jobs.kill(sessionId, jobId)).ok,
            runtime,
          }),
        },
        JobListAction,
      ),
    );
  }
  return { apply, inject };
}
