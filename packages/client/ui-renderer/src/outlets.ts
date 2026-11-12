/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Port 1:1 vung outlet cua bundle goc (dong 1110-1277): mo neo - phan loai kieu o - RootOutlet - renderer
 */
import type { RendererBindings, RendererRuntime } from "./bindings.ts";
import { SlotAssemblyError } from "./errors.ts";
import { SlotOutletRef } from "./refs.ts";
import type { ScopedSlots, RenderOpts } from "./scoped-slots.ts";
import type { SlotRenderer, SlotRendererHost, SlotSpec, StoredEntry, StandardSourceBinding } from "./slots-api.ts";
import { ANCHOR_STYLE } from "./ids.ts";

/** Props của một outlet slot thường. */
export interface SlotOutletProps {
  /** Khoá slot. */
  slotKey: string;
  /** Phần prop của chủ sở hữu ô. */
  ownerProps: Record<string, unknown>;
  /** Tuỳ chọn render. */
  opts?: RenderOpts;
  /** Ô nội tuyến ngay tại mỏ neo (khi slot chưa khai). */
  declaredInline: boolean;
}

/** Props của outlet gốc. */
export interface RootOutletProps {
  /** Phần prop của chủ sở hữu ô 'root' (vỏ cấp {}). */
  ownerProps: Record<string, unknown>;
}

/** Bề mặt outlet mà client/registry dùng. */
export interface Outlets {
  /** Outlet của một slot (mỏ neo + điều phối theo kiểu ô). */
  SlotOutlet(props: SlotOutletProps): unknown;
  /** Outlet gốc — điểm render DUY NHẤT ở cấp ctx. */
  RootOutlet(props: RootOutletProps): unknown;
  /** Renderer cài vào SlotRegistry qua `install(createSlotRenderer())`. */
  createSlotRenderer(): SlotRenderer;
}

/**
 * Dựng máy móc outlet (port 1:1 vùng `SlotOutlet`/`RootOutlet`/`createSlotRenderer`, dòng 1110–1277).
 *
 * Nhận: `runtime`, `bindings`, `scoped`.
 * Trả: bề mặt outlet; đồng thời điền `SlotOutletRef` để factories/scoped-slots dùng được.
 */
export function createOutlets(runtime: RendererRuntime, bindings: RendererBindings, scoped: ScopedSlots): Outlets {
  const { jsx, jsxs } = runtime.jsx;
  const { Fragment } = runtime.jsx as RendererRuntime["jsx"] & { Fragment: unknown };
  const { useSyncExternalStore } = runtime.hooks;
  const { useHost, useScopeBinding, ScopeProvider, RootStandardProvider, HostContext } = bindings;
  const {
    cachedSlotInject,
    emptySlotInject,
    entryKeyOf,
    sessionGenerationKeyOf,
    useLocaleRevision,
    SlotErrorBoundary,
    StrictSessionEntry,
    SessionMaybeEntry,
    RootEntry,
  } = scoped;

  /**
   * Mỏ neo của MỌI outlet: `display:contents` để vỏ KHÔNG tham gia bố cục (cha grid/flex thấy con của
   * chính slot), nên mỏ neo thuần là bề mặt định địa chỉ. Hằng ở phạm vi module để vỏ không bao giờ diff
   * lại prop style.
   */

  /**
   * Outlet của một slot (bản gốc: `SlotOutlet`).
   *
   * Nhận: `props.slotKey` + prop chủ sở hữu + opts.
   * Trả: cây React (mỏ neo `span`/`div` theo `inline` của spec).
   */
  function SlotOutlet(props: SlotOutletProps): unknown {
    const { slotKey, ownerProps, opts, declaredInline } = props;
    const host = useHost();
    useSyncExternalStore(
      (fn: () => void) => host.subscribe(slotKey, fn),
      () => host.getVersion(slotKey),
    );
    useLocaleRevision(host.locale);
    const scopeBinding = useScopeBinding();
    const spec = host.specOf(slotKey);
    const Anchor = (spec === undefined ? declaredInline : spec.inline === true) ? "span" : "div";
    return jsx(Anchor, {
      "data-slot": slotKey,
      style: ANCHOR_STYLE,
      children: spec === undefined ? null : renderOutletContent(host, slotKey, ownerProps, opts, scopeBinding, spec),
    });
  }

  /**
   * Điều phối theo kiểu ô đằng sau mỏ neo: single/keyed/list/chain, fallback, mặt lỗi
   * (bản gốc: `renderOutletContent`).
   *
   * Nhận: `host`, `slotKey`, `ownerProps`, `opts`, `scopeBinding`, `spec`.
   * Trả: nội dung của mỏ neo.
   * @throws {SlotAssemblyError} khi slot phiên nghiêm ngặt render mà thiếu binding.
   */
  function renderOutletContent(
    host: SlotRendererHost,
    slotKey: string,
    ownerProps: Record<string, unknown>,
    opts: RenderOpts | undefined,
    scopeBinding: StandardSourceBinding,
    spec: SlotSpec,
  ): unknown {
    const Anchor = spec.inline === true ? "span" : "div";
    if (spec.kind === "chain" && opts?.fallbackOnly === true) return renderChainResult(slotKey, null, opts, Anchor);
    if (spec.scope === "session" && scopeBinding.key === undefined) {
      throw new SlotAssemblyError("strict session slot '" + slotKey + "' rendered without a scope binding");
    }
    const entries = host.entriesOf(slotKey);
    const slotInjected = cachedSlotInject(spec.inject as Record<string, unknown> | undefined);
    /**
     * Bọc một chỗ ngồi trong error boundary đúng scope của nó.
     * Nhận: `entry`, `key` — React key, `owner` — phần prop của chủ sở hữu.
     * Trả: cây React.
     */
    const guarded = (entry: StoredEntry, key: unknown, owner: Record<string, unknown> = ownerProps): unknown => {
      const hasHookContext = opts !== undefined && Object.hasOwn(opts, "hookContext");
      const hookContext = opts?.hookContext;
      /**
       * Báo lỗi của chỗ ngồi này (chain KHÔNG rút lui mục).
       * Nhận: `error`. Trả: không.
       */
      const onEntryError = (error: unknown): void => {
        host.reportEntryError(slotKey, entry, error, { abdicate: spec.kind !== "chain" });
      };
      const entryProps = { entry, ownerProps: owner, slotKey, slotInjected, hookContext, hasHookContext };
      if (spec.scope === "session") return jsx(StrictSessionEntry, { ...entryProps, anchor: Anchor, onEntryError }, key);
      return jsx(
        SlotErrorBoundary,
        {
          slotKey,
          anchor: Anchor,
          onEntryError,
          children: spec.scope === "session-maybe" ? jsx(SessionMaybeEntry, entryProps) : jsx(RootEntry, entryProps),
        },
        key,
      );
    };
    /** Mỏ neo đánh dấu ô ĐÃ CHẾT (mục còn trong sổ nhưng không render được). */
    const deadCell = (): unknown => jsx(Anchor, { "data-slot-error": slotKey });
    if (spec.kind === "single") {
      const entry = host.entriesOfSlot(slotKey)[0];
      if (entry === undefined) return entries.length > 0 ? deadCell() : jsx(Fragment, { children: opts?.fallback ?? null });
      return guarded(entry, entryKeyOf(entry));
    }
    if (spec.kind === "keyed") {
      const entry = host.entriesOfSlot(slotKey).find((candidate) => candidate.options["key"] === opts?.entryKey);
      if (entry === undefined) {
        return entries.some((candidate) => candidate.options["key"] === opts?.entryKey)
          ? deadCell()
          : jsx(Fragment, { children: opts?.fallback ?? null });
      }
      return guarded(entry, entryKeyOf(entry));
    }
    if (spec.kind === "chain") {
      let elected: unknown = null;
      for (const entry of entries) {
        let matched: unknown;
        try {
          matched = entry.select?.(ownerProps);
        } catch (error) {
          console.error("chain selector crashed in '" + slotKey + "' (" + (entry.registrant ?? "unknown registrant") + "), treating as declined:", error);
          continue;
        }
        if (matched !== null && matched !== undefined) {
          elected = guarded(entry, entryKeyOf(entry), { ...ownerProps, matched });
          break;
        }
      }
      return renderChainResult(slotKey, elected, opts, Anchor);
    }
    const rows: { entry: StoredEntry | undefined; id: unknown; order: number }[] = host.entriesOfSlot(slotKey).map((entry) => ({
      entry,
      id: entry.options["id"],
      order: (entry.options["order"] as number | undefined) ?? 0,
    }));
    const rowIds = new Set(rows.map((row) => row.id));
    for (const entry of entries) {
      if (rowIds.has(entry.options["id"])) continue;
      rowIds.add(entry.options["id"]);
      rows.push({ entry: undefined, id: entry.options["id"], order: (entry.options["order"] as number | undefined) ?? 0 });
    }
    let list = [...rows].sort((left, right) => left.order - right.order);
    if (opts?.only !== undefined) list = list.filter((item) => item.id === opts.only);
    if (list.length === 0) return jsx(Fragment, { children: opts?.fallback ?? null });
    return jsx(Fragment, {
      children: list.map((item, index) =>
        item.entry !== undefined
          ? guarded(item.entry, "e" + String(entryKeyOf(item.entry)))
          : jsx(Anchor, { "data-slot-error": slotKey }, "x" + String(item.id ?? index)),
      ),
    });
  }

  /**
   * Vẽ kết quả chọn chuỗi, giữ ĐÚNG vị trí cây của fallback overlay
   * (bản gốc: `renderChainResult`).
   *
   * Nhận: `slotKey`, `elected` — chỗ ngồi trúng cử (null nếu không ai), `opts`, `Anchor`.
   * Trả: cây React.
   */
  function renderChainResult(slotKey: string, elected: unknown, opts: RenderOpts | undefined, Anchor: string): unknown {
    if (opts?.overlay !== true) return elected ?? jsx(Fragment, { children: opts?.fallback ?? null });
    return jsxs(Fragment, {
      children: [
        jsx(Anchor, {
          "data-chain-overlay-fallback": slotKey,
          style: { display: elected === null ? "contents" : "none" },
          children: opts.fallback ?? null,
        }),
        elected,
      ],
    });
  }

  /**
   * Outlet GỐC: điểm render DUY NHẤT ở cấp ctx của vỏ — 'root' chưa đăng ký là lỗi THỨ TỰ BOOT, không
   * bao giờ là màn trắng im lặng (bản gốc: `RootOutlet`).
   *
   * Nhận: `props.ownerProps` — phần của chủ sở hữu ô gốc.
   * Trả: cây React.
   * @throws {SlotAssemblyError} khi chưa có đăng ký 'root' nào.
   */
  function RootOutlet(props: RootOutletProps): unknown {
    const host = useHost();
    useSyncExternalStore(
      (fn: () => void) => host.subscribe("root", fn),
      () => host.getVersion("root"),
    );
    useLocaleRevision(host.locale);
    const entry = host.entriesOfSlot("root")[0];
    if (entry === undefined) {
      if (host.entriesOf("root").length > 0) return jsx("div", { "data-slot-error": "root" });
      throw new SlotAssemblyError("renderSlot('root') before any 'root' registration (boot order)");
    }
    return jsx("div", {
      "data-slot": "root",
      style: ANCHOR_STYLE,
      children: jsx(
        SlotErrorBoundary,
        {
          slotKey: "root",
          onEntryError: (error: unknown) => {
            host.reportEntryError("root", entry, error, { abdicate: true });
          },
          children: jsx(RootEntry, {
            entry,
            ownerProps: props.ownerProps,
            slotKey: "root",
            slotInjected: emptySlotInject,
            hookContext: undefined,
            hasHookContext: false,
          }),
        },
        entryKeyOf(entry),
      ),
    });
  }

  /**
   * Dựng renderer cài vào SlotRegistry (bản gốc: `createSlotRenderer`).
   *
   * Cây gốc: HostContext → RootStandardProvider → ScopeProvider('session-maybe') → RootOutlet. Đúng thứ
   * tự của bản gốc — đổi thứ tự provider làm `useRootBinding`/`useScopeBinding` ném lỗi lắp ráp.
   *
   * Nhận: không.
   * Trả: renderer `{ renderRoot(host, ownerProps) }`.
   */
  function createSlotRenderer(): SlotRenderer {
    return {
      /**
       * Vẽ cây gốc.
       * Nhận: `host` — face host; `ownerProps` — phần của chủ sở hữu ô 'root'.
       * Trả: cây React.
       */
      renderRoot(host: SlotRendererHost, ownerProps: Record<string, unknown>): unknown {
        return jsx(HostContext.Provider as unknown as unknown, {
          value: host,
          children: jsx(RootStandardProvider, {
            children: jsx(ScopeProvider, { scope: "session-maybe", children: jsx(RootOutlet, { ownerProps }) }),
          }),
        });
      },
    };
  }

  SlotOutletRef.current = SlotOutlet;

  return { SlotOutlet, RootOutlet, createSlotRenderer };
}
