/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua client cua row ui-sidebar: vo cot sidebar, danh sach panel toan cuc va ghe window-chrome
 */

import { EFFECT, INJECT, NS, SLOTS, TRACKED_PANELS } from "./ids.ts";
import { en, zh } from "./locales.ts";
import {
  createHeaderLeadingControls,
  createSidebarRoot,
  type PanelMetadata,
  type ShellDeps,
  type ShellPrimitives,
  type ShellReact,
} from "./components.ts";
import { vi } from "./locales-vi.ts";

/** Hàm `require` do bảng module của loader cấp cho factory (gọi lúc vạt chất hoá). */
export type RequireFn = (specifier: string) => unknown;

/** CSS của hai module, do `build.ts` nhúng bằng `define`; chạy từ nguồn (test) thì tra biến toàn cục. */
declare const __GBH_SIDEBAR_CSS__: string;
declare const __GBH_SIDEBAR_HEADER_CSS__: string;

/** Runtime JSX do bảng module cấp (`react/jsx-runtime`). */
interface JsxRuntime {
  /** Dựng element một con. */
  jsx: ShellDeps["jsx"];
  /** Dựng element nhiều con. */
  jsxs: ShellDeps["jsxs"];
}

/** Phần hook của module `react` (KHÔNG có `jsx` — đó là lý do phải gộp với jsx-runtime). */
type ReactHooks = Omit<ShellReact, "jsx" | "jsxs">;

/** Store quan sát được của `dsh-client-store` (chỉ dùng hai hàm này). */
interface SnapshotStore<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot: () => T;
  /** Công bố ảnh chụp mới. */
  set: (next: T) => void;
}

/** Bề mặt `dsh-client-store` mà row này dùng. */
interface StoreModule {
  /** Tạo một store ảnh chụp từ giá trị đầu. */
  createSnapshotStore: <T>(initial: T) => SnapshotStore<T>;
}

/** Một dòng đăng ký trong một slot (phần mà `entriesOfSlot` trả về). */
interface SlotEntry {
  /** Tuỳ chọn đăng ký; `id`/`order`/`label` là ba trường row này đọc. */
  options: { id: string; order?: number; label?: unknown };
}

/** Bề mặt `dsh-client-ui-slots` mà row này dùng. */
interface SlotsModule {
  /** Phân giải nhãn của một đăng ký (chuỗi, hàm, hoặc khoá từ điển). */
  resolveSlotLabel: (label: unknown) => string | undefined;
}

/** Dịch vụ điều hướng workspace (`uiWorkspace`). */
interface WorkspaceNavigation {
  /** Bắt đầu phiên mới, có thể trong một workspace cụ thể. */
  startSession: (workspaceId?: string) => void;
}

/** Dịch vụ đo lường sản phẩm (tuỳ chọn, `productAnalytics`). */
interface ProductAnalytics {
  /** Ghi một sự kiện. */
  track: (event: string, payload: Record<string, unknown>) => void;
}

/** Bề mặt shell mà plugin dùng. */
interface ClientContext {
  /** Đăng ký hiệu ứng vòng đời. */
  effect: (callback: () => void | (() => void), label?: string) => void;
  /** Tra một seam tuỳ chọn (có thể vắng). */
  get: (name: string) => unknown;
  /** Từ điển. */
  locale: {
    /** Đăng ký bản dịch; trả hàm gỡ. */
    register: (namespace: string, copy: Record<string, Record<string, string>>) => () => void;
    /** Nghe thay đổi ngôn ngữ; trả hàm gỡ. */
    subscribe: (listener: () => void) => () => void;
  };
  /** Layout: cột sidebar và panel chính. */
  layout: {
    /** Đóng/mở cột sidebar. */
    toggleSidebar: () => void;
    /** Chọn một panel toàn cục. */
    selectPanel: (id: string) => void;
  };
  /** Phím tắt của shell. */
  shortcuts: {
    /** Danh mục phím tắt (nguồn quan sát được). */
    catalog: unknown;
  };
  /** Sổ đăng ký slot. */
  slots: {
    /** Mọi đăng ký hiện có của một slot. */
    entriesOfSlot: (slot: string) => SlotEntry[];
    /** Nghe thay đổi của một slot; trả hàm gỡ. */
    subscribe: (slot: string, listener: () => void) => () => void;
    /** Đăng ký một occupant; trả hàm gỡ. */
    register: (definition: Record<string, unknown>, component: unknown) => () => void;
    /** Chỉ đăng ký khi slot đã có người phục vụ. */
    inject: (slot: string, register: () => unknown) => void;
  };
}

/** Bề mặt plugin mà Loader nhận từ bundle. */
export interface ClientPlugin {
  /** Seam mà fiber của sidebar cần. */
  inject: string[];
  /** Cài từ điển, danh sách panel và hai occupant (`sidebar`, `shell.leading`). */
  apply: (ctx: ClientContext) => void;
}

/** Id gắn vào `data-plugin-css` của hai thẻ style, để không chèn hai lần và HMR gỡ được. */
const STYLE_TAGS = {
  /** CSS của cột sidebar. */
  sidebar: "@galaxy-blackhole/gbh-client-ui-sidebar/SidebarRoot.module.css",
  /** CSS của ghế window-chrome. */
  header: "@galaxy-blackhole/gbh-client-ui-sidebar/HeaderLeadingControls.module.css",
} as const;

/**
 * Chèn một thẻ style vào document nếu chưa có.
 * Nhận: id thẻ, nội dung CSS và văn bản CSS (có thể rỗng khi chạy từ nguồn).
 * Trả: không.
 */
function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector('style[data-plugin-css="' + tagId + '"]') !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-sidebar";
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/** Chèn CSS của hai module (mỗi thứ một lần). */
function injectStyles(): void {
  injectStyle(STYLE_TAGS.sidebar, typeof __GBH_SIDEBAR_CSS__ === "string" ? __GBH_SIDEBAR_CSS__ : "");
  injectStyle(STYLE_TAGS.header, typeof __GBH_SIDEBAR_HEADER_CSS__ === "string" ? __GBH_SIDEBAR_HEADER_CSS__ : "");
}

/**
 * Tập ctx ĐÃ cài — phạm vi MODULE, khoá theo `ctx` (không phải cờ boolean).
 *
 * Vì sao khoá theo ctx: row này đăng ký HAI id module ⇒ bộ nạp gọi factory hai lần ⇒ hai plugin instance,
 * nhưng **cùng một ctx**. Cờ boolean ở phạm vi module sẽ chặn đúng ca đó, nhưng lại **dính giữa các ca
 * test trong cùng file** (bài học 17/10/2026: ca "idempotent" pass giả, ca "log lỗi" fail). Khoá theo ctx
 * giữ nguyên phạm vi module mà mỗi ctx mới lại được cài bình thường.
 */
// CONG PHAI LA BOOLEAN PHAM VI MODULE, KHONG khoa theo ctx (bai hoc 17/10/2026): ca that la
// HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber}) ⇒ ctx MOI) ⇒ cong
// khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service has been registered.
// Do duoc: 12 goi con lastCtx trong artifact. Gia phai tra: boolean dinh giua cac ca test
// cung file ⇒ nap module TUOI moi ca.
let sidebarInstalled = false;

/**
 * Dựng mặt plugin của nửa browser.
 *
 * Chỉ `require` năm specifier, đúng như bản gốc và đúng thứ tự: `@galaxy-blackhole/gbh-client-store`,
 * `@galaxy-blackhole/gbh-client-ui-slots`, `react/jsx-runtime`, `@galaxy-blackhole/gbh-client-ui-primitives`,
 * `react`. Tất cả được gọi LÚC VẬT CHẤT HOÁ factory nên script chỉ đăng ký (hợp đồng C2).
 * Nhận: hàm require của bảng module.
 * Trả: plugin `{ apply, inject }`.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const store = requireFn("@galaxy-blackhole/gbh-client-store") as StoreModule;
  const slotsModule = requireFn("@galaxy-blackhole/gbh-client-ui-slots") as SlotsModule;
  const { jsx, jsxs } = requireFn("react/jsx-runtime") as JsxRuntime;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as ShellPrimitives;
  const hooks = requireFn("react") as ReactHooks;
  // ⚠️ \`react\` KHÔNG có \`jsx\`/\`jsxs\` — chúng ở \`react/jsx-runtime\`. Component nhận HAI nguồn tách bạch
  // (đúng như bản gốc): \`jsx\`/\`jsxs\` để dựng element, \`react\` chỉ để lấy hook. Trộn lẫn ⇒
  // \`react.jsx is not a function\` làm #root tụt 99.349 → 49.046 ký tự (sự cố 17/10/2026).
  injectStyles();
  const HeaderLeadingControls = createHeaderLeadingControls({ jsx, jsxs, react: hooks, primitives });
  const SidebarRoot = createSidebarRoot({ jsx, jsxs, react: hooks, primitives });

  /**
   * Cài từ điển, danh sách panel toàn cục và hai occupant của row này.
   * Nhận: context gốc của client.
   * Trả: không.
   */
  function apply(ctx: ClientContext): void {
    // Lần cài thứ hai cho CÙNG một ctx là NO-OP (id thứ hai chỉ là một KHOÁ khác của cùng bundle).
    if (sidebarInstalled) return;
    try {
      applyInner(ctx);
    } catch (error) {
      console.error("gbh-client-ui-sidebar: apply nem loi", error);
      throw error;
    }
    // CO CHI BAT SAU KHI DANG KY THANH CONG (bai hoc 18/10/2026, React #130): neu apply nem giua
    // duong (vi du service slots chua san sang o entry thu nhat) thi co PHAI con false — de entry thu
    // hai con co hoi dang ky. Bat co ngay dau apply ⇒ entry thu hai thoat som ⇒ slot RONG ⇒ renderer
    // gap element type undefined ⇒ React #130.
    sidebarInstalled = true;
  }

  function applyInner(ctx: ClientContext): void {
    const workspaceNavigation = ctx.get("uiWorkspace") as WorkspaceNavigation | undefined;
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), EFFECT.dictionaries);
    const panels = store.createSnapshotStore<readonly PanelMetadata[]>([]);
    /**
     * Đọc lại danh sách panel từ sổ đăng ký slot và công bố khi có thay đổi thật.
     * Nhận: không.
     * Trả: không.
     */
    const syncPanels = (): void => {
      const next = ctx.slots
        .entriesOfSlot(SLOTS.panellist)
        .map(({ options }) => ({
          id: options.id,
          order: options.order ?? 0,
          label: slotsModule.resolveSlotLabel(options.label) ?? options.id,
        }))
        .sort((a, b) => a.order - b.order);
      const previous = panels.getSnapshot();
      if (
        previous.length === next.length &&
        previous.every((panel, index) => {
          const candidate = next[index];
          return candidate !== undefined && panel.id === candidate.id && panel.order === candidate.order && panel.label === candidate.label;
        })
      )
        return;
      panels.set(next);
    };
    ctx.effect(() => ctx.slots.subscribe(SLOTS.panellist, syncPanels), EFFECT.panelEntries);
    ctx.effect(() => ctx.locale.subscribe(syncPanels), EFFECT.panelLabels);
    /**
     * Dựng mặt mà hai occupant chuyển cho renderer.
     * Nhận: không.
     * Trả: hành động đã inject + hai nguồn quan sát được (panel, phím tắt).
     */
    const injectProps = (): Record<string, unknown> => ({
      startSession: (workspaceId?: string) => {
        workspaceNavigation?.startSession(workspaceId);
      },
      toggleSidebar: () => {
        ctx.layout.toggleSidebar();
      },
      selectPanel: (id: string) => {
        const menuName = TRACKED_PANELS[id];
        if (menuName !== undefined) (ctx.get("productAnalytics") as ProductAnalytics | undefined)?.track("sidebar_menu_click", { menu_name: menuName });
        ctx.layout.selectPanel(id);
      },
      hooks: { panels, shortcuts: ctx.shortcuts.catalog },
    });
    // Tên slot ghi thẳng bằng CHUỖI (không qua hằng) để grep và `bun run check:rows` đối chiếu được
    // với bản gốc — công cụ đó so tên slot theo văn bản.
    ctx.slots.inject("sidebar", () =>
      ctx.slots.register(
        {
          name: "sidebar",
          locale: NS,
          children: {
            "sidebar.brand.mark": { kind: "single", scope: "root" },
            "sidebar.brand.name": { kind: "single", scope: "root" },
            "sidebar.toggle.badge": { kind: "single", scope: "root" },
            "sidebar.panellist": { kind: "list", scope: "root" },
            "sidebar.workspaces": { kind: "single", scope: "root" },
            "sidebar.settings": { kind: "single", scope: "root" },
            "sidebar.footer.action": { kind: "list", scope: "root" },
          },
          inject: injectProps,
        },
        SidebarRoot,
      ),
    );
    ctx.slots.inject("shell.leading", () =>
      ctx.slots.register({ name: "shell.leading", locale: NS, inject: injectProps }, HeaderLeadingControls),
    );
    syncPanels();
  }

  return { apply, inject: [...INJECT] };
}
