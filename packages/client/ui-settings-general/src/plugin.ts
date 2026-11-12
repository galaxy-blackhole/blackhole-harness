/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Nửa client của row ui-settings-general: wiring 8 inject · 9 slot · 4 hook root.
 *   11/11/2026 — SUA GOC su co "cong tac 'Cong cu lap trinh' bam khong doi": dang ky `settings.general.item`
 *   thieu `inject` cua ban goc (client.js goc 1084-1087 cap { hooks.developerTools, setEnabled }) ⇒
 *   `props.setEnabled` undefined ⇒ toggle la NO-OP im lang. Nay cap lai dung hai prop do + `react` cho deps.
 */

import { createBadge } from "./badge.ts";
import { createDesktopUpdate } from "./desktop-update.ts";
import { SettingsDocumentStore } from "./document-store.ts";
import { createItems } from "./items.ts";
import { createOverlay } from "./overlay.ts";
import { createPanel } from "./panel.ts";
import { createSections } from "./sections.ts";
import { createCloseLabel, createDocumentAction, createHeaderContent } from "./shell-parts.ts";
import { createSettingsRoot } from "./settings-root.ts";
import { createSettingsShellStore } from "./settings-store.ts";
import { createStore } from "./store.ts";
import { createTrigger } from "./trigger.ts";
import type { GeneralDeps, JsxRuntimeLike, RemoteSeam } from "./types.ts";
import type { GeneralContextLike } from "./store.ts";
import { EN, ZH } from "./dictionaries.ts";
import { vi } from "./locales-vi.ts";

/** Namespace từ điển của row (bản gốc bind cùng namespace). */
const NS = "settings.general";

/** Tám dịch vụ mà bản gốc khai trong `static inject`. */
export const INJECT = ["slots", "locale", "connection", "remote", "remote.settings", "configForms", "shortcuts", "modules"];

/** require do bảng module cấp cho factory. */
export type RequireFn = ((id: string) => unknown) & { async?: (id: string) => Promise<unknown> };

/** Một dòng mục trong cột điều hướng của panel (đọc từ sổ đăng ký `settings.section`). */
export interface SectionRow {
  /** Id mục. */
  id: string;
  /** Thứ tự sắp. */
  order: number;
  /** Nhãn hiển thị. */
  label: string;
  /** Tên icon tuỳ chọn (trường MỞ RỘNG của ta, 18/10/2026). */
  icon?: unknown;
}

/** Nguồn hook mà ghế `sidebar.settings` phơi cho renderer — đúng bộ bản gốc khai trong `shellInjected`. */
export interface ShellHooks {
  /** Danh mục phím tắt. */
  shortcuts: unknown;
  /** Nguồn trạng thái cập nhật Desktop. */
  desktopUpdate: unknown;
  /** Nguồn trạng thái kết nối. */
  connectionState: unknown;
  /** Danh sách mục settings (điều hướng của panel). */
  sections: { getSnapshot(): SectionRow[]; subscribe(listener: () => void): () => void };
}

/** Phần mà `inject` của ghế `sidebar.settings` trả về (hook + hai động tử của vỏ). */
export interface ShellInjected {
  /** Mở tiến trình cập nhật Desktop. */
  openDesktopUpdate(): void;
  /** Kết nối lại realtime. */
  reconnect(): void;
  /** Bốn nguồn hook của vỏ. */
  hooks: ShellHooks;
}

/** Context phía browser (chỉ khai phần row này dùng). */
export type ClientContextLike = GeneralContextLike & {
  /** Seam remote của trang — chỉ hai mục bản gốc đọc (`$host.isLoopback` + `settings.openSettingsDocument`). */
  remote?: RemoteSeam;
  /** Seam slot. */
  slots: {
    /** Đăng ký khi ghế cha đã có trên sổ. */
    inject(name: string, register: () => unknown): unknown;
    /** Đăng ký một ghế. */
    register(spec: {
      name: string;
      id?: string;
      order?: number;
      locale?: string;
      store?: unknown;
      children?: unknown;
      inject?: unknown;
      label?: unknown;
    }, component: unknown): unknown;
    /** Phơi hook cấp gốc. */
    provideRoot(spec: { hooks: Record<string, unknown> }): unknown;
  };
  /** Seam từ điển. */
  locale: {
    bind(namespace: string): (key: string) => string;
    /** Đăng ký từ điển của namespace (tùy chọn ở môi trường rút gọn). */
    register?(namespace: string, dictionaries: unknown): unknown;
  };
  /** Trạng thái kết nối + động tử kết nối lại. */
  connection: { state: unknown; reconnect?(): void };
  /** Vòng đời cordis. */
  effect(callback: () => unknown, label?: string): unknown;
};

/** Plugin phía browser do factory dựng ra. */
export interface GeneralPlugin {
  /** Cài wiring của row. */
  apply(ctx: ClientContextLike): void;
  /** Dịch vụ bắt buộc (cordis fiber inject). */
  inject: string[];
}

/**
 * Cờ chặn cài hai lần ở PHẠM VI MODULE — LUẬT CHUNG chốt 17/10/2026 (HAI ENTRY ⇒ HAI CTX nên khoá theo
 * ctx KHÔNG chặn được). Giá phải trả: mỗi ca test phải nạp MODULE TƯƠI.
 */
let installed = false;

/**
 * Nạp một module tùy chọn, thiếu cũng KHÔNG ném (khuôn #5: tính năng phụ tắt, cây vẫn sống).
 * @param requireFn - require của bảng module.
 * @param id - id module.
 * @returns module hoặc undefined.
 */
function requireOptional(requireFn: RequireFn, id: string): Record<string, unknown> | undefined {
  try {
    const mod = requireFn(id) as Record<string, unknown> | undefined;
    return typeof mod === "object" && mod !== null ? mod : undefined;
  } catch (error) {
    console.warn("gbh-client-ui-settings-general: khong nap duoc module tuy chon " + id, error);
    return undefined;
  }
}

/**
 * Dựng nguồn hook `sections`: đọc sổ đăng ký `settings.section`, đúng bản gốc (SettingsRoot.js 1138-1161).
 * @param ctx - context phía browser.
 * @param resolveLabel - hàm dịch nhãn của seam slots (có thể vắng).
 * @returns nguồn hook có getSnapshot/subscribe.
 */
function createSectionsSource(ctx: ClientContextLike, resolveLabel?: (label: unknown) => string | undefined): ShellHooks["sections"] {
  const seam = ctx.slots as unknown as {
    getVersion?: (name: string) => number;
    entries?: (name: string) => { options?: { id?: string; order?: number; label?: unknown; icon?: unknown } }[];
    subscribe?: (name: string, listener: () => void) => () => void;
  };
  let version = -1;
  let rows: SectionRow[] = [];
  return {
    getSnapshot: (): SectionRow[] => {
      if (typeof seam.entries !== "function" || typeof seam.getVersion !== "function") return rows;
      const current = seam.getVersion("settings.section");
      if (current === version) return rows;
      version = current;
      rows = seam.entries("settings.section")
        .map((entry) => ({
          id: entry?.options?.id ?? "",
          order: entry?.options?.order ?? 0,
          label: (typeof resolveLabel === "function" ? resolveLabel(entry?.options?.label) : undefined) ?? "",
          // ⚠️ 18/10/2026 — SUA: truoc day chi nhan icon kieu STRING nen package doc lap truyen
          //   COMPONENT SVG (nhu settings-about) thi bi bo => muc moi luon ra icon Settings mac dinh.
          icon: entry?.options?.icon,
        }))
        .sort((a, b) => a.order - b.order);
      return rows;
    },
    subscribe: (listener: () => void): (() => void) =>
      typeof seam.subscribe === "function" ? seam.subscribe("settings.section", listener) : () => undefined,
  };
}

/**
 * Dựng nửa client của row từ require do bảng module cấp.
 * Nhận: require của bảng module (react/jsx-runtime và ui-primitives).
 * Trả: plugin { apply, inject }.
 */
export function createPlugin(requireFn: RequireFn): GeneralPlugin {
  const apply = (ctx: ClientContextLike): void => {
    if (installed) return;
    try {
      applyInner(ctx);
      // ⚠️ 18/10/2026: BẬT CỜ SAU KHI applyInner chạy xong. Bật sớm ⇒ nếu applyInner ném giữa đường
      // (ví dụ `slots` chưa sẵn sàng) thì cờ đã = true ⇒ lần cài thứ hai (entry id alias) thoát sớm
      // ⇒ các slot đăng ký SAU CÙNG không bao giờ được đăng ký lại ⇒ renderer gặp undefined ⇒ React #130.
      installed = true;
    } catch (error) {
      console.error("gbh-client-ui-settings-general: apply ném lỗi", error);
      throw error;
    }
  };

  const applyInner = (ctx: ClientContextLike): void => {
    const runtime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
    const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives");
    const reactDom = requireOptional(requireFn, "react-dom");
    // ⚠️ 11/11/2026 — `react` cho trạng thái busy/failed của hàng "Công cụ lập trình" (bản gốc: useState ×2).
    //   Tuỳ chọn + shim KHÔNG trạng thái: thiếu module react thì hàng vẫn GHI được (đường ghi là prop
    //   setEnabled, không phải state) — khuôn #5: tính năng phụ tắt, cây vẫn sống.
    const reactHooks = requireOptional(requireFn, "react");
    const slotsSeam = requireOptional(requireFn, "@galaxy-blackhole/gbh-client-ui-slots");
    const store = createStore(ctx);
    // ⚠️ LUẬT 8: CHÍNH thể hiện này được cấp cho ghế qua `store:` VÀ cho deps ⇒ hai đường đọc cùng một
    // trạng thái. Tách rời hai thể hiện thì panel mở mà hàng trigger không biết (hoặc ngược lại).
    const settingsStore = createSettingsShellStore();
    const deps: GeneralDeps = {
      runtime,
      react: {
        useState: <T,>(initial: T): [T, (next: T) => void] => {
          const hooks = reactHooks as { useState?: (value: T) => [T, (next: T) => void] } | undefined;
          return typeof hooks?.useState === "function" ? hooks.useState(initial) : [initial, () => undefined];
        },
      },
      primitives,
      store,
      locale: ctx.locale.bind(NS),
      configForms: ctx.configForms,
      shortcuts: ctx.shortcuts.catalog,
      settingsStore,
      portal: typeof reactDom?.createPortal === "function"
        ? (reactDom.createPortal as (node: unknown, container: unknown) => unknown)
        : undefined,
    };
    // ⚠️ NÚT "MỞ TỆP CẤU HÌNH" (18/10/2026) — bản gốc lib/client.js:1114-1121:
    //   const documentController = ctx.remote.$host.isLoopback ? new SettingsDocumentStore(ctx, ctx.configForms.describe()) : void 0;
    //   const documentInjected = () => ({ controller, hooks: { snapshot: controller.store } });
    //   Bản port trước đây đăng ký settings.action mà inject trả `openDocument: undefined` ⇒ component
    //   trả null ⇒ header modal KHÔNG có nút (đo được: slot settings.action rỗng trong DOM thật).
    const remote = ctx.remote;
    const documentController = remote?.$host?.isLoopback === true
      ? new SettingsDocumentStore(remote, ctx.configForms.describe())
      : undefined;
    /**
     * `inject` của ghế settings.action — ĐÚNG hình dạng renderer cần để cấp hook `useSnapshot`.
     * ⚠️ 18/10/2026 — PHẢI chịu được ca `documentController === undefined` (không phải loopback):
     *   bản trước ép kiểu rồi đọc `.store` ⇒ NÉM ngay trong inject ⇒ renderer bỏ ghế ⇒ header modal
     *   KHÔNG có nút. Nay vắng controller thì trả object rỗng để component tự trả null êm.
     * @returns props cho component, hoặc object rỗng khi không có controller.
     */
    const documentInjected = (): Record<string, unknown> => {
      if (documentController === undefined) return {};
      return { controller: documentController, hooks: { snapshot: documentController.store } };
    };
    // Từ điển của namespace: bản gốc gọi `ctx.locale.register(NS, { zh, en })`. Thiếu hàm ⇒ bỏ qua (khuôn #5).
    if (typeof ctx.locale.register === "function") {
      ctx.effect(
        () => ctx.locale.register?.(NS, { en: EN, vi, zh: ZH }),
        "ui-settings-general.dictionaries",
      );
    }
    const resolveLabel = typeof slotsSeam?.resolveSlotLabel === "function"
      ? (slotsSeam.resolveSlotLabel as (label: unknown) => string | undefined)
      : undefined;
    const sections = createSectionsSource(ctx, resolveLabel);
    /** `inject` của ghế vỏ: hook + hai động tử (đúng `shellInjected` của bản gốc). */
    const shellInjected = (): ShellInjected => ({
      openDesktopUpdate: () => undefined,
      reconnect: () => {
        ctx.connection.reconnect?.();
      },
      hooks: {
        shortcuts: ctx.shortcuts.catalog,
        desktopUpdate: store.desktopUpdate,
        connectionState: ctx.connection.state,
        sections,
      },
    });
    // 08/11/2026 (Lead — đối chiếu UI thật với DSH): THIẾU ĐĂNG KÝ PHÍM TẮT `settings.open`.
    //   Bản gốc đăng ký nó ngay trước ghế `sidebar.settings` (SettingsRoot.js ~1189-1233) nên hộp
    //   "Phím tắt bàn phím" có dòng "Mở cài đặt ⌥⌘,"; bản ta KHÔNG có ⇒ danh sách phím tắt thiếu,
    //   và ⌥⌘, không mở được Cài đặt. Nay chép ĐÚNG khai báo của bản gốc: cùng id, nhãn, alias, mặc định
    //   theo nền tảng, vùng bấm, và cách xử lý khi đang mở modal.
    // Chỉ đăng ký khi seam CÓ `register`: composition thật luôn có (dịch vụ `shortcuts` của DSH), còn context
    // rút gọn (test, môi trường chỉ có `catalog`) thì bỏ qua — tránh biến một seam TUỲ CHỌN thành điều kiện sống còn.
    const dangKyPhimTat = ctx.shortcuts as { register?: (d: unknown) => () => void };
    if (typeof dangKyPhimTat.register === "function") ctx.effect(
      () => dangKyPhimTat.register!({
        id: "settings.open",
        label: () => ctx.locale.bind(NS)("shortcut.open"),
        aliases: ["settings", "preferences"],
        defaults: {
          "desktop:macos": { code: "Comma", modifiers: ["primary"] },
          "desktop:windows": { code: "Comma", modifiers: ["primary"] },
          "desktop:linux": { code: "Comma", modifiers: ["primary"] },
          "web:macos": { code: "Comma", modifiers: ["primary", "alt"] },
          "web:windows": { code: "Comma", modifiers: ["primary", "alt"] },
        },
        regions: ["page", "editable", "terminal"],
        modals: ["settings"],
        resolve: ({ modal }: { modal: string | null }) => {
          if (modal !== null && modal !== "settings") return { status: "blocked", reason: "modal" };
          return {
            status: "handled",
            run: () => {
              if (modal === "settings") (primitives as { closeTopModal?: (d: Document) => void }).closeTopModal?.(document);
              else (settingsStore as unknown as { actions?: { open?: () => void } }).actions?.open?.();
            },
          };
        },
      }),
      "ui-settings-general.shortcut.settings-open",
    );
    // Bốn hook root — đúng bề mặt bản gốc (desktopUpdate · connectionState · shortcuts · developerTools).
    ctx.effect(() => ctx.slots.provideRoot({ hooks: { ...store } }), "ui-settings-general.root-hooks");
    // ⚠️ GHẾ VỎ (18/10/2026): trước đây chỗ này đăng ký thẳng `createTrigger` ⇒ bấm Settings KHÔNG mở gì.
    // Bản gốc đăng ký `SettingsRoot` kèm `store` + 7 ghế con + `inject` (SettingsRoot.js 1233-1268).
    ctx.effect(
      () => ctx.slots.inject("sidebar.settings", () => ctx.slots.register(
        {
          name: "sidebar.settings",
          locale: NS,
          store: settingsStore,
          children: {
            "settings.launcher": { kind: "single", scope: "root" },
            "settings.trigger": { kind: "single", scope: "root" },
            "settings.header": { kind: "single", scope: "root" },
            "settings.action": { kind: "list", scope: "root" },
            "settings.close": { kind: "single", scope: "root" },
            "settings.section": { kind: "list", scope: "root" },
            "settings.onboarding": { kind: "list", scope: "root" },
          },
          inject: shellInjected,
        },
        createSettingsRoot(deps),
      )),
      "ui-settings-general.sidebar.settings",
    );
    ctx.effect(() => ctx.slots.inject("settings.trigger", () => ctx.slots.register({ name: "settings.trigger", locale: NS }, createTrigger(deps))), "ui-settings-general.settings.trigger");
    ctx.effect(() => ctx.slots.inject("settings.header", () => ctx.slots.register({ name: "settings.header", locale: NS }, createHeaderContent(deps))), "ui-settings-general.settings.header");
    ctx.effect(() => ctx.slots.inject("settings.close", () => ctx.slots.register({ name: "settings.close", locale: NS }, createCloseLabel(deps))), "ui-settings-general.settings.close");
    // ⚠️ ĐÚNG BẢN GỐC (dòng 1119-1121 + 1282-1288): đăng ký ghế hành động CHỈ khi có controller, và
    //   vòng đời của nó gắn với hiệu ứng (load một lần + dispose khi plugin gỡ).
    if (documentController !== undefined) {
      ctx.effect(() => {
        void documentController.load();
        return () => documentController.dispose();
      }, "ui-settings-general.settings.action.document");
      ctx.effect(() => ctx.slots.inject("settings.action", () => ctx.slots.register({ name: "settings.action", id: "open-document", order: 0, locale: NS, inject: documentInjected }, createDocumentAction(deps))), "ui-settings-general.settings.action");
    }
    ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "general", order: 0, locale: NS, label: () => deps.locale("general.nav"), children: { "settings.general.item": { kind: "list", scope: "root" } } }, createSections(deps))), "ui-settings-general.settings.section");
    // ⚠️ 11/11/2026 — SỬA GỐC "CÔNG TẮC VÔ HIỆU" (đo bằng RPC thật trên app 5439: bấm ⇒ aria-checked giữ
    //   "true", 0 request /api/settings/** ghi, namespace ui-settings vẫn {enabled:true, revision:0}).
    //   Đăng ký này TRƯỚC ĐÂY không khai `inject` ⇒ renderer không cấp được prop `setEnabled` ⇒ onChange
    //   của công tắc gọi vào undefined và IM LẶNG không làm gì. Bản gốc khai đúng hai prop dưới đây
    //   (lib/client.js gốc 1079-1088): `hooks: { developerTools }` + `setEnabled` gọi
    //   ctx.configForms.developerTools.setEnabled ⇒ ghi vào namespace `ui-settings`, key `enabled`.
    //   Trạng thái hiển thị vẫn lấy từ hook đó (subscribe theo mirror) nên công tắc tự lật sau khi Host nhận.
    //   ⚠️ Hàm ghi phải VIẾT NGAY TRONG khối đăng ký (không đặt sau một biến trung gian): cổng
    //   `tools/check/toggle-matrix.ts` PHẦN B đọc văn bản đăng ký để chứng minh công tắc có đường ghi —
    //   và đúng hình dạng bản gốc thì về sau đối chiếu không phải suy luận.
    ctx.effect(() => ctx.slots.inject("settings.general.item", () => ctx.slots.register({
      name: "settings.general.item",
      id: "developer-tools",
      order: 15,
      locale: NS,
      inject: () => ({
        hooks: { developerTools: ctx.configForms.developerTools.enabled },
        setEnabled: (enabled: boolean) => ctx.configForms.developerTools.setEnabled(enabled),
      }),
    }, createItems(deps))), "ui-settings-general.settings.general.item");
    ctx.effect(() => ctx.slots.inject("sidebar.toggle.badge", () => ctx.slots.register({ name: "sidebar.toggle.badge", locale: NS }, createBadge(deps))), "ui-settings-general.sidebar.toggle.badge");
    ctx.effect(() => ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "host-release-change", locale: NS }, createOverlay(deps))), "ui-settings-general.shell.overlay");
  };

  return { apply, inject: [...INJECT] };
}