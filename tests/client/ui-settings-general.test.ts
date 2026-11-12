/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test row ui-settings-general: khuôn bundle · 9 slot · cổng apply một lần · metadata hai id.
 *   11/11/2026 — thêm nhóm ca "công tắc 'Công cụ lập trình' có ĐƯỜNG GHI": đăng ký phải cấp setEnabled qua
 *   inject, bấm phải gọi hàm ghi với giá trị đảo, Host từ chối / thiếu hàm ghi phải HIỆN LỖI (sự cố thật:
 *   bấm công tắc không đổi gì vì props.setEnabled undefined — im lặng).
 */

import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";

const OURS = join(import.meta.dir, "../../packages/client/ui-settings-general");
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-general";
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-settings-general";

/** Log những gì ctx giả ghi lại được. */
interface Log {
  slots: string[];
  hooks: string[];
  effects: number;
}

/** Mirror giả của tài liệu settings: Host BÁO có tệp cấu hình cục bộ (đúng ca bản cài loopback). */
function describeFaceStub(hasDocument = true): Record<string, unknown> {
  return {
    getSnapshot: () => ({ status: "ready", view: { hasDocument }, error: null }),
    subscribe: () => () => undefined,
    ensure: async () => undefined,
  };
}

/** Seam remote giả: trang loopback + thao tác mở tệp cấu hình của Host. */
function remoteStub(isLoopback = true): Record<string, unknown> {
  return {
    $host: { isLoopback },
    settings: { openSettingsDocument: async () => ({ ok: true, value: { opened: true } }) },
  };
}

/** ctx giả tối thiểu để chạy apply. */
function ctxStub(log: Log): Record<string, unknown> {
  return {
    connection: { state: { kind: "connection" } },
    shortcuts: { catalog: { kind: "catalog" } },
    remote: remoteStub(),
    configForms: {
      describe: () => describeFaceStub(),
      developerTools: {
        enabled: { getSnapshot: () => false, subscribe: () => () => undefined },
        setEnabled: async () => undefined,
      },
    },
    slots: {
      inject: (name: string, register: () => unknown) => {
        log.slots.push(name);
        register();
        return () => undefined;
      },
      register: (spec: { name: string }) => spec,
      provideRoot: (spec: { hooks: Record<string, unknown> }) => {
        log.hooks = Object.keys(spec.hooks);
        return () => undefined;
      },
    },
    locale: { bind: () => (key: string) => key },
    effect: (callback: () => unknown) => {
      log.effects += 1;
      callback();
      return () => undefined;
    },
  };
}

/**
 * Nạp module plugin TƯƠI cho mỗi ca.
 * Nhận: nhãn ca.
 * Trả: hàm createPlugin của module vừa nạp.
 */
async function freshPlugin(label: string): Promise<(requireFn: (id: string) => unknown) => { apply(ctx: unknown): void }> {
  const spec: string = OURS + "/src/plugin.ts?" + label;
  const fresh = (await import(spec)) as { createPlugin: (requireFn: (id: string) => unknown) => { apply(ctx: unknown): void } };
  return fresh.createPlugin;
}

/** require giả: mọi id trả về đối tượng rỗng dùng được. */
const requireStub = (): unknown => ({});

describe("row ui-settings-general — khuôn bundle", () => {
  test("bundle đăng ký ĐÚNG MỘT id (id gốc khai ở aliases), không có cú pháp ESM", async () => {
    const code = await Bun.file(join(OURS, "lib/client.js")).text();
    const ids: string[] = [];
    new Function("window", code)({ __ModuleLoader__: { load: (registration: { id: string }): void => { ids.push(registration.id); } } });
    expect(ids).toEqual([PACKAGE_NAME]);
    // Gói có thể đang ở trạng thái GỠ MOUNT (`gbh.row_unmounted_ly_do`) trong lúc UI chưa xong ⇒ đọc CẢ HAI dạng:
    // gỡ mount KHÔNG được phép phá hợp đồng id/aliases (nếu nó phá thì cổng phải bắt được, không phải test bỏ qua).
    const meta = (await Bun.file(join(OURS, "package.json")).json()) as {
      gbh: { row?: { moduleIds: string[]; aliases: string[] }; row_unmounted_ly_do?: { row: { moduleIds: string[]; aliases: string[] } } };
    };
    const row = meta.gbh.row ?? meta.gbh.row_unmounted_ly_do?.row;
    expect(row, "package.json phai khai gbh.row hoac gbh.row_unmounted_ly_do.row").toBeDefined();
    expect(row?.moduleIds).toEqual([PACKAGE_NAME]);
    expect(row?.aliases).toContain(STOCK_NAME);
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
  });
});

describe("row ui-settings-general — wiring 9 slot + 4 hook", () => {
  test("apply đăng ký ĐỦ 10 slot đúng tên bản gốc và 4 hook root", async () => {
    const createPlugin = await freshPlugin("case-slots");
    const log: Log = { slots: [], hooks: [], effects: 0 };
    createPlugin(requireStub).apply(ctxStub(log));
    expect(log.slots.sort()).toEqual([
      "settings.action", "settings.close", "settings.general.item", "settings.header",
      "settings.section", "settings.trigger", "shell.overlay", "sidebar.settings", "sidebar.toggle.badge",
    ]);
    expect(log.hooks.sort()).toEqual(["connectionState", "desktopUpdate", "developerTools", "shortcuts"]);
  });

  test("ca chống cài hai lần: apply lần hai (kể cả ctx KHÁC) là NO-OP — luật boolean phạm vi module", async () => {
    const createPlugin = await freshPlugin("case-idem");
    const plugin = createPlugin(requireStub);
    const first: Log = { slots: [], hooks: [], effects: 0 };
    plugin.apply(ctxStub(first));
    const afterFirst = first.slots.length;
    const second: Log = { slots: [], hooks: [], effects: 0 };
    plugin.apply(ctxStub(second));
    expect(second.slots.length).toBe(0);
    expect(second.effects).toBe(0);
    expect(afterFirst).toBe(9); // 8 ghế vỏ + settings.action CHỈ đăng ký khi có controller loopback ⇒ 9
    // Cổng nguyên văn bản gốc (dòng 1282): trang KHÔNG loopback ⇒ KHÔNG có ghế settings.action.
    const noLoopback = await freshPlugin("case-no-loopback");
    const log2: Log = { slots: [], hooks: [], effects: 0 };
    const ctx2 = ctxStub(log2);
    (ctx2 as Record<string, unknown>).remote = remoteStub(false);
    noLoopback(requireStub).apply(ctx2);
    expect(log2.slots).not.toContain("settings.action");
  });
});
/** Nửa runtime JSX giả: giữ nguyên cặp (type, props) để soi cây đã vẽ. */
const runtimeStub = {
  jsx: (type: unknown, props: unknown): unknown => ({ type, props }),
  jsxs: (type: unknown, props: unknown): unknown => ({ type, props }),
  Fragment: Symbol("Fragment"),
};

/** Deps giả tối thiểu cho createOverlay (primitives có Modal/Button như bản gốc). */
const overlayDeps = {
  runtime: runtimeStub,
  primitives: { Modal: (props: unknown): unknown => ({ modal: props }), Button: (props: unknown): unknown => ({ button: props }) },
  store: { desktopUpdate: {}, connectionState: {}, shortcuts: {}, developerTools: {} },
  locale: (key: string): string => key,
  configForms: { describe: () => ({}), developerTools: { enabled: { getSnapshot: () => false, subscribe: () => () => undefined } } },
};

type OverlayComponent = (props: Record<string, unknown>) => unknown;

/**
 * Nạp module overlay TƯƠI và dựng component shell.overlay.
 * Nhận: nhãn ca (để có specifier khác nhau).
 * Trả: hàm component đã dựng.
 */
async function freshOverlay(label: string): Promise<OverlayComponent> {
  const spec: string = OURS + "/src/overlay.ts?" + label;
  const fresh = (await import(spec)) as { createOverlay: (deps: unknown) => OverlayComponent };
  return fresh.createOverlay(overlayDeps);
}

describe("row ui-settings-general — CỔNG CHẶN của shell.overlay (C4.1 18/10/2026)", () => {
  // ⚠️ 18/10/2026 — TRIỆU CHỨNG ĐO ĐƯỢC: ghe shell.overlay vẽ thẳng lớp Settings
  //   (DIV.VOzbGW_overlay z-index:1000 + DIV.VOzbGW_mask 1440x900) NGAY LÚC TẢI TRANG ⇒ panel trắng
  //   khổng lồ che 55% màn hình (ảnh A/B vs oracleA: 67,739% px khác). Bản gốc KHÔNG mở: shell.overlay
  //   là HostReleasePrompt và có cổng `if (change === void 0) return null` (dòng 926 lib gốc).
  test("state khởi tạo KHÔNG mở modal: thiếu lần đổi phiên bản ⇒ trả null", async () => {
    const Overlay = await freshOverlay("case-gate-null");
    expect(Overlay({})).toBeNull();
    expect(Overlay({ useReleaseChange: (select: (value: unknown) => unknown) => select(undefined) })).toBeNull();
    expect(Overlay({ useReleaseChange: (select: (value: unknown) => unknown) => select(null) })).toBeNull();
    expect(Overlay({ releaseChange: undefined })).toBeNull();
  });

  test("cổng chặn là THẬT (không phải nhánh chết): có lần đổi phiên bản ⇒ vẽ _64N1GW_dialog, KHÔNG vẽ VOzbGW_overlay", async () => {
    const Overlay = await freshOverlay("case-gate-open");
    const node = Overlay({
      useReleaseChange: (select: (value: unknown) => unknown) => select({ previous: { version: "0.2.1" }, host: { version: "0.2.2" }, page: { version: "0.2.1" } }),
    });
    expect(node).not.toBeNull();
    const tree = JSON.stringify(node);
    expect(tree).toContain("_64N1GW_dialog");
    expect(tree).toContain("_64N1GW_transitions");
    expect(tree).not.toContain("VOzbGW_overlay");
    expect(tree).not.toContain("VOzbGW_mask");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 18/10/2026 — PHẦN CÒN THIẾU CỦA GHẾ `sidebar.settings`: vỏ Settings (hàng trigger + panel).
//   Ba nhóm ca dưới đây khoá đúng ba thứ từng hỏng/mất:
//     (1) LUẬT 8 — store của ghế phải ĐẦY ĐỦ `getSnapshot/subscribe/actions`;
//     (2) CỔNG ĐÓNG/MỞ — chưa mở thì KHÔNG có `VOzbGW_overlay`, bấm nút Settings thì CÓ;
//     (3) BA ĐƯỜNG ĐÓNG — nút close · bấm mask · Escape cấp document.
// ─────────────────────────────────────────────────────────────────────────────

/** Ảnh chụp tối thiểu của một phần tử do runtime JSX giả dựng ra. */
interface FakeEl {
  /** Loại phần tử (tên thẻ hoặc component). */
  type: unknown;
  /** Props của phần tử. */
  props: Record<string, unknown>;
}

/** Document giả: đủ cho ensureStyle + listener Escape cấp document. */
interface FakeDoc {
  /** Số listener `keydown` đang sống. */
  live: number;
  /** Bắn một sự kiện `keydown` tới mọi listener đang sống. */
  press(key: string): void;
}

/** `document` có TRƯỚC lần cài giả gần nhất — để trả đúng nguyên trạng, không phải `undefined` giả định. */
let documentBeforeInstall: unknown;
/** Ca hiện tại đã cài document giả chưa (để afterEach chỉ khôi phục khi thật sự đã cài). */
let fakeDocumentInstalled = false;

// PHẢI khôi phục: `document` là biến TOÀN CỤC của tiến trình `bun test` (mọi file chung một tiến trình).
// Từng rò sang `client-modules.test.ts` ⇒ 12 ca đỏ khi chạy CẢ bộ dù chạy riêng thì xanh.
afterEach(() => {
  if (!fakeDocumentInstalled) return;
  fakeDocumentInstalled = false;
  const scope = globalThis as unknown as { document?: unknown };
  if (documentBeforeInstall === undefined) delete scope.document;
  else scope.document = documentBeforeInstall;
});

/**
 * Cài document giả lên globalThis cho một ca test (afterEach gỡ lại sau ca).
 * Nhận: không.
 * Trả: tay nắm để đếm/bắn sự kiện.
 */
function installFakeDocument(): FakeDoc {
  const listeners = new Set<(event: { key?: string }) => void>();
  const doc = {
    createElement: () => ({ dataset: {}, textContent: "" }),
    head: { appendChild: () => undefined },
    body: { nodeType: 1 },
    querySelector: () => null,
    addEventListener: (type: string, listener: (event: { key?: string }) => void) => {
      if (type === "keydown") listeners.add(listener);
    },
    removeEventListener: (type: string, listener: (event: { key?: string }) => void) => {
      if (type === "keydown") listeners.delete(listener);
    },
  };
  const scope = globalThis as unknown as { document?: unknown };
  if (!fakeDocumentInstalled) {
    documentBeforeInstall = scope.document;
    fakeDocumentInstalled = true;
  }
  scope.document = doc;
  return {
    get live(): number {
      return listeners.size;
    },
    press: (key: string): void => {
      for (const listener of Array.from(listeners)) listener({ key });
    },
  };
}

/** Deps giả cho vỏ Settings: runtime + primitives + portal + store THẬT của row. */
function shellDeps(store: unknown): Record<string, unknown> {
  return {
    runtime: runtimeStub,
    primitives: { Tooltip: undefined },
    store: { desktopUpdate: {}, connectionState: {}, shortcuts: {}, developerTools: {} },
    locale: (key: string): string => key,
    configForms: { describe: () => ({}), developerTools: { enabled: { getSnapshot: () => false, subscribe: () => () => undefined } } },
    settingsStore: store,
    portal: (node: unknown, container: unknown): unknown => ({ portal: node, container }),
  };
}

/** renderSlot giả: tôn trọng hợp đồng `fallback` (không có ai đăng ký thì dùng fallback của vỏ). */
const slotStub = (name: string, _params: unknown, options?: { fallback?: unknown }): unknown => options?.fallback ?? { slot: name };

/** Tay nắm store tối thiểu mà test dùng (đúng hình dạng LUẬT 8). */
interface ShellStoreLike {
  /** Ảnh chụp trạng thái. */
  getSnapshot(): unknown;
  /** Bốn động tử. */
  actions: { open(): void; close(): void; select(id: string): void; openSection(id: string): void };
}

/** Props tối thiểu mà tầng slots cấp cho vỏ (useStore đọc thẳng ảnh chụp của store). */
function shellProps(store: { getSnapshot(): unknown; actions: unknown }): Record<string, unknown> {
  return {
    wide: true,
    t: (key: string): string => key,
    renderSlot: slotStub,
    useStore: (select: (value: unknown) => unknown): unknown => select(store.getSnapshot()),
    actions: store.actions,
    useSections: (select: (value: unknown) => unknown): unknown => select([{ id: "general", label: "general.nav", order: 0 }]),
    useConnectionState: (select: (value: unknown) => unknown): unknown => select("connected"),
    useDesktopUpdate: (select: (value: unknown) => unknown): unknown => select({ failed: false, opening: false }),
    useShortcuts: (select: (value: unknown) => unknown): unknown => select([]),
  };
}

describe("row ui-settings-general — LUẬT 8: store của ghế sidebar.settings", () => {
  test("thể hiện ĐẦY ĐỦ: { open, activeId } + getSnapshot/subscribe/actions/create", async () => {
    const mod = (await import(OURS + "/src/settings-store.ts?case-store-shape")) as {
      createSettingsShellStore: () => Record<string, unknown>;
    };
    const store = mod.createSettingsShellStore();
    // Ba phần mà tầng slots gọi THẲNG — thiếu là "TypeError: w.getSnapshot is not a function" và CẢ thanh bên trắng.
    expect(typeof store.getSnapshot).toBe("function");
    expect(typeof store.subscribe).toBe("function");
    expect(typeof store.actions).toBe("object");
    const actions = store.actions as Record<string, unknown>;
    expect(typeof actions.open).toBe("function");
    expect(typeof actions.close).toBe("function");
    expect(typeof actions.select).toBe("function");
    expect(store.open).toBe(false);
    expect(store.activeId).toBeUndefined();
    expect((store.getSnapshot as () => unknown)()).toEqual({ open: false, activeId: undefined });
    // `create()` trả CHÍNH thể hiện đang dùng (bản gốc ghim một thể hiện cho cả phiên).
    expect(typeof store.create).toBe("function");
    expect((store.create as () => unknown)()).toBe(store);
  });

  test("động từ đúng bản gốc: close XOÁ activeId · getSnapshot ỔN ĐỊNH khi chưa đổi · subscribe gỡ được", async () => {
    const mod = (await import(OURS + "/src/settings-store.ts?case-store-actions")) as {
      createSettingsShellStore: () => {
        getSnapshot(): { open: boolean; activeId: string | undefined };
        subscribe(listener: () => void): () => void;
        actions: { open(): void; close(): void; select(id: string): void; openSection(id: string): void };
      };
    };
    const store = mod.createSettingsShellStore();
    let notified = 0;
    const off = store.subscribe(() => { notified += 1; });
    const before = store.getSnapshot();
    expect(store.getSnapshot()).toBe(before);
    store.actions.open();
    expect(store.getSnapshot()).toEqual({ open: true, activeId: undefined });
    store.actions.select("general");
    expect(store.getSnapshot()).toEqual({ open: true, activeId: "general" });
    store.actions.close();
    expect(store.getSnapshot()).toEqual({ open: false, activeId: undefined });
    store.actions.openSection("general");
    expect(store.getSnapshot()).toEqual({ open: true, activeId: "general" });
    expect(notified).toBe(4);
    off();
    store.actions.close();
    expect(notified).toBe(4);
  });

  test("ghế sidebar.settings ĐƯỢC CẤP chính thể hiện đó, kèm 7 ghế con như bản gốc", async () => {
    const createPlugin = await freshPlugin("case-seat-store");
    const specs = new Map<string, Record<string, unknown>>();
    const ctx = {
      ...(ctxStub({ slots: [], hooks: [], effects: 0 }) as Record<string, unknown>),
      slots: {
        inject: (_name: string, register: () => unknown) => { register(); return () => undefined; },
        register: (spec: Record<string, unknown>) => { specs.set(String(spec.name), spec); return spec; },
        provideRoot: () => () => undefined,
      },
      locale: { bind: () => (key: string) => key, register: () => undefined },
      connection: { state: {}, reconnect: () => undefined },
    };
    createPlugin(requireStub).apply(ctx);
    const seat = specs.get("sidebar.settings");
    expect(seat, "ghế sidebar.settings phải được đăng ký").toBeDefined();
    const store = seat?.store as Record<string, unknown> | undefined;
    expect(typeof store?.getSnapshot).toBe("function");
    expect(typeof store?.subscribe).toBe("function");
    expect(typeof (store?.actions as Record<string, unknown>)?.open).toBe("function");
    expect(Object.keys(seat?.children as Record<string, unknown>).sort()).toEqual([
      "settings.action", "settings.close", "settings.header", "settings.launcher",
      "settings.onboarding", "settings.section", "settings.trigger",
    ]);
    const injected = (seat?.inject as () => { hooks: Record<string, unknown> })();
    expect(Object.keys(injected.hooks).sort()).toEqual(["connectionState", "desktopUpdate", "sections", "shortcuts"]);
    expect(typeof injected.hooks.sections).toBe("object");
  });
});

describe("row ui-settings-general — CỔNG ĐÓNG/MỞ của vỏ Settings", () => {
  test("chưa mở ⇒ KHÔNG có VOzbGW_overlay; bấm nút Settings ⇒ CÓ (nút nằm trong fallback settings.launcher)", async () => {
    installFakeDocument();
    const storeMod = (await import(OURS + "/src/settings-store.ts?case-gate-store")) as {
      createSettingsShellStore: () => ShellStoreLike;
    };
    const rootMod = (await import(OURS + "/src/settings-root.ts?case-gate-root")) as {
      createSettingsRoot: (deps: unknown) => (props: Record<string, unknown>) => FakeEl[];
    };
    const store = storeMod.createSettingsShellStore();
    const Root = rootMod.createSettingsRoot(shellDeps(store));
    const props = shellProps(store);
    const closed = Root(props);
    expect(JSON.stringify(closed)).not.toContain("VOzbGW_overlay");
    expect(JSON.stringify(closed)).toContain("VOzbGW_triggerRow");
    // Nút mở nằm trong FALLBACK của settings.launcher — đúng gốc (SettingsRoot.js 447-462).
    const row = closed[0] as FakeEl;
    const launcher = (row.props.children as unknown[])[0] as FakeEl;
    expect(launcher.type).toBe("button");
    expect(launcher.props["aria-label"]).toBe("trigger");
    expect(launcher.props["aria-haspopup"]).toBe("dialog");
    (launcher.props.onClick as () => void)();
    const opened = Root(props);
    expect(opened[1]).not.toBeNull();
    // Panel là PHẦN TỬ (React tự gọi component) — gọi thẳng component để soi cây DOM mà nó vẽ ra.
    const panelEl = opened[1] as FakeEl;
    const portal = (panelEl.type as (p: Record<string, unknown>) => { portal: FakeEl })(panelEl.props);
    expect(JSON.stringify(portal.portal)).toContain("VOzbGW_overlay");
    expect(JSON.stringify(portal.portal)).toContain("VOzbGW_mask");
    expect(store.getSnapshot()).toEqual({ open: true, activeId: undefined });
  });
});

describe("row ui-settings-general — BA ĐƯỜNG ĐÓNG của panel", () => {
  test("nút close · bấm mask · Escape cấp document — mỗi đường đóng được, listener chỉ sống khi panel MỞ", async () => {
    const fake = installFakeDocument();
    const storeMod = (await import(OURS + "/src/settings-store.ts?case-close-store")) as {
      createSettingsShellStore: () => ShellStoreLike;
    };
    const rootMod = (await import(OURS + "/src/settings-root.ts?case-close-root")) as {
      createSettingsRoot: (deps: unknown) => (props: Record<string, unknown>) => FakeEl[];
    };
    const store = storeMod.createSettingsShellStore();
    const deps = shellDeps(store);
    const Root = rootMod.createSettingsRoot(deps);
    const props = shellProps(store);

    /** Vẽ panel đang mở và trả về cây overlay đã qua createPortal. */
    const openPanel = (): { overlay: FakeEl; dialog: FakeEl; close: FakeEl; mask: FakeEl } => {
      store.actions.open();
      const tree = Root(props);
      const panelEl = tree[1] as FakeEl;
      const portal = (panelEl.type as (p: Record<string, unknown>) => { portal: FakeEl })(panelEl.props);
      const overlay = portal.portal;
      const kids = overlay.props.children as FakeEl[];
      const dialog = kids[1] as FakeEl;
      const content = (dialog.props.children as FakeEl[])[1] as FakeEl;
      const header = (content.props.children as FakeEl[])[0] as FakeEl;
      return { overlay, dialog, close: (header.props.children as FakeEl[])[1] as FakeEl, mask: kids[0] as FakeEl };
    };

    // (1) NÚT CLOSE Ở HEADER — onClick: onClose (SettingsRoot.js 326-334).
    let view = openPanel();
    expect(store.getSnapshot()).toEqual({ open: true, activeId: undefined });
    (view.close.props.onClick as () => void)();
    expect(store.getSnapshot()).toEqual({ open: false, activeId: undefined });
    expect(Root(props)[1]).toBeNull();

    // (2) BẤM MASK — onClick: onClose (SettingsRoot.js 283-286).
    view = openPanel();
    (view.mask.props.onClick as () => void)();
    expect(store.getSnapshot()).toEqual({ open: false, activeId: undefined });
    expect(Root(props)[1]).toBeNull();

    // (3) ESCAPE CẤP DOCUMENT — listener gắn khi panel vào DOM, GỠ khi panel rời DOM (SettingsRoot.js 279).
    view = openPanel();
    expect(fake.live).toBe(0);
    const attach = view.dialog.props.ref as (node: unknown) => void;
    expect(typeof attach).toBe("function");
    attach({ nodeType: 1 });
    expect(fake.live).toBe(1);
    fake.press("a");
    expect(store.getSnapshot()).toEqual({ open: true, activeId: undefined });
    fake.press("Escape");
    expect(store.getSnapshot()).toEqual({ open: false, activeId: undefined });
    attach(null);
    expect(fake.live).toBe(0);
    fake.press("Escape");
    expect(store.getSnapshot()).toEqual({ open: false, activeId: undefined });
    expect(Root(props)[1]).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 18/10/2026 — NÚT "MỞ TỆP CẤU HÌNH" (SettingsDocumentStore + SettingsDocumentAction).
//   Đo TRƯỚC trên DOM thật: <div data-slot="settings.action"> RỖNG (0 button) ⇒ thiếu hẳn tính năng.
//   Ba nhóm ca dưới đây khoá: (1) máy trạng thái suy từ mirror; (2) nút chỉ hiện khi ready;
//   (3) inject của ghế trả ĐÚNG { controller, hooks.snapshot } — hình dạng renderer cần để cấp useSnapshot.
// ─────────────────────────────────────────────────────────────────────────────

type DocumentStoreModule = {
  SettingsDocumentStore: new (remote: unknown, describeFace: unknown) => {
    store: { getSnapshot(): { status: string; opening: boolean; error: string | null }; subscribe(l: () => void): () => void };
    load(): Promise<void>;
    open(): Promise<void>;
    dispose(): void;
  };
};

/** Dựng một mirror giả điều khiển được từ test (view + error + ensure). */
function controllableFace(initial: { hasDocument?: boolean; error?: string | null }): {
  face: Record<string, unknown>;
  set(next: { hasDocument?: boolean; error?: string | null }): void;
} {
  let state = { status: "idle", view: initial.hasDocument === undefined ? undefined : { hasDocument: initial.hasDocument }, error: initial.error ?? null };
  const listeners = new Set<() => void>();
  return {
    face: {
      getSnapshot: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      ensure: async () => undefined,
    },
    set(next: { hasDocument?: boolean; error?: string | null }): void {
      state = { status: "ready", view: next.hasDocument === undefined ? undefined : { hasDocument: next.hasDocument }, error: next.error ?? null };
      for (const listener of Array.from(listeners)) listener();
    },
  };
}

describe("row ui-settings-general — SettingsDocumentStore (nút mở tệp cấu hình)", () => {
  test("load() suy ready từ hasDocument; mirror đổi sang false ⇒ unavailable", async () => {
    const mod = (await import(OURS + "/src/document-store.ts?case-doc-ready")) as DocumentStoreModule;
    const mirror = controllableFace({ hasDocument: true });
    const store = new mod.SettingsDocumentStore(remoteStub(), mirror.face);
    expect(store.store.getSnapshot()).toEqual({ status: "idle", opening: false, error: null });
    await store.load();
    expect(store.store.getSnapshot().status).toBe("ready");
    mirror.set({ hasDocument: false });
    expect(store.store.getSnapshot().status).toBe("unavailable");
    store.dispose();
  });

  test("load() với mirror báo LỖI và chưa có view ⇒ unavailable kèm thông báo lỗi", async () => {
    const mod = (await import(OURS + "/src/document-store.ts?case-doc-error")) as DocumentStoreModule;
    const mirror = controllableFace({ error: "describe failed" });
    const store = new mod.SettingsDocumentStore(remoteStub(), mirror.face);
    await store.load();
    expect(store.store.getSnapshot()).toEqual({ status: "unavailable", opening: false, error: "describe failed" });
    store.dispose();
  });

  test("open() gọi ĐÚNG một lần settings.openSettingsDocument; lỗi của Host hiện trong snapshot", async () => {
    const mod = (await import(OURS + "/src/document-store.ts?case-doc-open")) as DocumentStoreModule;
    let calls = 0;
    const remote = {
      $host: { isLoopback: true },
      settings: {
        openSettingsDocument: async () => {
          calls += 1;
          return { ok: false, error: { message: "opener refused" } };
        },
      },
    };
    const mirror = controllableFace({ hasDocument: true });
    const store = new mod.SettingsDocumentStore(remote, mirror.face);
    await store.load();
    await store.open();
    expect(calls).toBe(1);
    expect(store.store.getSnapshot()).toEqual({ status: "ready", opening: false, error: "opener refused" });
    store.dispose();
  });

  test("chưa ready hoặc đang mở ⇒ open() KHÔNG gọi seam (thao tác trùng bị gộp)", async () => {
    const mod = (await import(OURS + "/src/document-store.ts?case-doc-gate")) as DocumentStoreModule;
    let calls = 0;
    const remote = {
      $host: { isLoopback: true },
      settings: {
        openSettingsDocument: async () => {
          calls += 1;
          return { ok: true, value: { opened: true } };
        },
      },
    };
    const mirror = controllableFace({ hasDocument: true });
    const store = new mod.SettingsDocumentStore(remote, mirror.face);
    await store.open();
    expect(calls).toBe(0);
    await store.load();
    await Promise.all([store.open(), store.open()]);
    expect(calls).toBe(1);
    store.dispose();
  });

  test("thiếu seam mở tệp ⇒ báo lỗi TRONG snapshot, KHÔNG ném (khuôn #5)", async () => {
    const mod = (await import(OURS + "/src/document-store.ts?case-doc-seam")) as DocumentStoreModule;
    const mirror = controllableFace({ hasDocument: true });
    const store = new mod.SettingsDocumentStore({ $host: { isLoopback: true } }, mirror.face);
    await store.load();
    await store.open();
    expect(store.store.getSnapshot().error).toBe("settings.openSettingsDocument is unavailable");
    store.dispose();
  });
});

describe("row ui-settings-general — SettingsDocumentAction (component của ghế)", () => {
  /** deps tối thiểu: runtime giả + primitives có Button (đúng bản gốc dùng Button variant=outline). */
  const actionDeps = {
    runtime: runtimeStub,
    primitives: { Button: (props: unknown): unknown => ({ button: props }) },
    store: { desktopUpdate: {}, connectionState: {}, shortcuts: {}, developerTools: {} },
    locale: (key: string): string => key,
    configForms: { describe: () => describeFaceStub(), developerTools: { enabled: { getSnapshot: () => false, subscribe: () => () => undefined } } },
  };

  test("chưa ready ⇒ null; ready ⇒ div.me01iq_action + Button outline, bấm nút gọi controller.open", async () => {
    installFakeDocument();
    const mod = (await import(OURS + "/src/shell-parts.ts?case-doc-action")) as {
      createDocumentAction: (deps: unknown) => (props: Record<string, unknown>) => unknown;
    };
    const Action = mod.createDocumentAction(actionDeps);
    const opened: string[] = [];
    const controller = {
      store: {},
      open: async () => {
        opened.push("open");
      },
    };
    const ready = { status: "ready", opening: false, error: null };
    // Tầng ngoài: thiếu hook useSnapshot của renderer ⇒ null (KHÔNG gọi hook — React #310 không thể xảy ra).
    expect(Action({ controller, t: (k: string) => k })).toBeNull();
    expect(Action({ useSnapshot: (select: (s: unknown) => unknown) => select(ready), t: (k: string) => k })).toBeNull();
    // Tầng ngoài trả PHẦN TỬ của component trong (React tự gọi nó) — ở test phải gọi tiếp một lần.
    const outer = Action({ controller, useSnapshot: (select: (s: unknown) => unknown) => select(ready), t: (k: string) => k }) as FakeEl;
    const node = (outer.type as (p: Record<string, unknown>) => FakeEl)(outer.props);
    expect(node).not.toBeNull();
    expect(node.props.className).toBe("me01iq_action");
    const kids = node.props.children as FakeEl[];
    expect(kids[0]).toBeNull();
    const button = kids[1] as FakeEl;
    expect((button.props as Record<string, unknown>).variant).toBe("outline");
    expect((button.props as Record<string, unknown>).children).toBe("openDocument");
    ((button.props as { onClick: () => void }).onClick)();
    expect(opened).toEqual(["open"]);
  });

  test("loading/unavailable ⇒ không vẽ nút; có lỗi ⇒ thêm span.me01iq_error role=alert", async () => {
    installFakeDocument();
    const mod = (await import(OURS + "/src/shell-parts.ts?case-doc-action-state")) as {
      createDocumentAction: (deps: unknown) => (props: Record<string, unknown>) => unknown;
    };
    const Action = mod.createDocumentAction(actionDeps);
    const controller = { store: {}, open: async () => undefined };
    const make = (snapshot: unknown) => ({ controller, useSnapshot: (select: (s: unknown) => unknown) => select(snapshot), t: (k: string) => k });
    /** Gọi CẢ HAI tầng như React: tầng ngoài chọn phần tử, tầng trong mới đọc snapshot. */
    const render = (snapshot: unknown): FakeEl | null => {
      const outer = Action(make(snapshot)) as FakeEl | null;
      if (outer === null) return null;
      return (outer.type as (p: Record<string, unknown>) => FakeEl)(outer.props);
    };
    expect(render({ status: "idle", opening: false, error: null })).toBeNull();
    expect(render({ status: "unavailable", opening: false, error: null })).toBeNull();
    const node = render({ status: "ready", opening: false, error: "opener refused" }) as FakeEl;
    const kids = node.props.children as FakeEl[];
    const errorSpan = kids[0] as FakeEl;
    expect(errorSpan.props.className).toBe("me01iq_error");
    expect(errorSpan.props.role).toBe("alert");
    expect(errorSpan.props.children).toBe("openDocument.error");
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// 11/11/2026 — SỰ CỐ "CÔNG TẮC VÔ HIỆU" (Cài đặt → Chung → "Công cụ lập trình").
//   ĐO TRÊN APP 5439 BẰNG RPC THẬT (cookie jar từ ready-url.txt), TRƯỚC khi sửa:
//     · settings/describe → namespace ui-settings = {enabled:true}, revision 0
//     · bấm công tắc trong DOM: aria-checked "true" → "true"; 0 request /api/settings/** ghi
//     · sau khi bấm: ui-settings vẫn {enabled:true}, revision 0  ⇒ công tắc CHẾT, không lỗi nào hiện ra
//   NGUYÊN NHÂN: đăng ký settings.general.item (id developer-tools) KHÔNG khai `inject` ⇒ renderer không
//   cấp được prop setEnabled (bản gốc cấp ở lib/client.js 1084-1087) ⇒ onChange gọi vào undefined, im lặng.
//   Ba ca dưới đây khoá đúng chuỗi đó: (1) đăng ký PHẢI cấp setEnabled + hooks.developerTools;
//   (2) bấm ⇒ gọi hàm ghi với giá trị ĐẢO + khoá công tắc khi đang ghi; (3) Host từ chối / thiếu hàm ghi
//   ⇒ hiện developerTools.error (không bao giờ im lặng nữa).
// ─────────────────────────────────────────────────────────────────────────────

describe("row ui-settings-general — công tắc 'Công cụ lập trình' có ĐƯỜNG GHI", () => {
  test("đăng ký settings.general.item/developer-tools phải khai inject cấp setEnabled + hooks.developerTools", async () => {
    const createPlugin = await freshPlugin("case-dev-inject");
    const seats = new Map<string, Record<string, unknown>>();
    const calls: boolean[] = [];
    const ctx = {
      ...(ctxStub({ slots: [], hooks: [], effects: 0 }) as Record<string, unknown>),
      slots: {
        inject: (_name: string, register: () => unknown) => {
          register();
          return () => undefined;
        },
        register: (spec: Record<string, unknown>) => {
          if (spec.name === "settings.general.item") seats.set(String(spec.id), spec);
          return spec;
        },
        provideRoot: () => () => undefined,
      },
      configForms: {
        describe: () => describeFaceStub(),
        developerTools: {
          enabled: { getSnapshot: () => true, subscribe: () => () => undefined },
          setEnabled: (enabled: boolean): Promise<void> => {
            calls.push(enabled);
            return Promise.resolve();
          },
        },
      },
    };
    createPlugin(requireStub).apply(ctx);
    const seat = seats.get("developer-tools");
    expect(seat, "phải có đăng ký settings.general.item id developer-tools").toBeDefined();
    const inject = seat?.inject as (() => Record<string, unknown>) | undefined;
    // Thiếu inject ⇒ props.setEnabled undefined ⇒ bấm công tắc KHÔNG làm gì (đúng sự cố 11/11/2026).
    expect(typeof inject, "đăng ký thiếu inject ⇒ công tắc chết").toBe("function");
    const face = (inject as () => Record<string, unknown>)();
    expect(Object.keys(face["hooks"] as Record<string, unknown>)).toEqual(["developerTools"]);
    expect(typeof face["setEnabled"]).toBe("function");
    await (face["setEnabled"] as (next: boolean) => Promise<void>)(false);
    expect(calls).toEqual([false]);
  });


  test("bấm ⇒ gọi hàm ghi với giá trị ĐẢO · đang ghi thì khoá · Host từ chối ⇒ hiện developerTools.error", async () => {
    installFakeDocument();
    const mod = (await import(OURS + "/src/items.ts?case-dev-write")) as {
      createItems: (deps: unknown) => (props: Record<string, unknown>) => FakeEl | null;
    };
    let cursor = 0;
    const cells: unknown[] = [];
    const deps = {
      runtime: runtimeStub,
      react: {
        useState<T>(initial: T): [T, (next: T) => void] {
          const at = cursor;
          cursor += 1;
          if (at >= cells.length) cells[at] = initial;
          return [cells[at] as T, (next: T): void => { cells[at] = next; }];
        },
      },
      primitives: { Switch: (props: unknown): unknown => ({ switch: props }) },
      store: { desktopUpdate: {}, connectionState: {}, shortcuts: {}, developerTools: {} },
      locale: (key: string): string => key,
      configForms: { describe: () => describeFaceStub(), developerTools: depsDevTools() },
      settingsStore: {},
    };
    /** deps.configForms.developerTools tối thiểu (hàng này không tự gọi: hàm ghi đi qua props). */
    function depsDevTools(): Record<string, unknown> {
      return { enabled: { getSnapshot: () => true, subscribe: () => () => undefined }, setEnabled: async () => undefined };
    }
    const Item = mod.createItems(deps);
    /** Vẽ lại như React: reset con trỏ ô trạng thái rồi gọi component. */
    const render = (props: Record<string, unknown>): FakeEl => {
      cursor = 0;
      const node = Item(props);
      expect(node, "hàng công cụ phải vẽ ra (safeRender không được nuốt)").not.toBeNull();
      return node as FakeEl;
    };
    /** Công tắc trong cây đã vẽ. */
    const switchOf = (node: FakeEl): FakeEl => (node.props.children as FakeEl[])[1] as FakeEl;
    /** Cột chữ bên trái của hàng (title · description · dòng lỗi). */
    const textColumnOf = (node: FakeEl): FakeEl => (node.props.children as FakeEl[])[0] as FakeEl;
    /** Dòng lỗi role=alert trong cột chữ (phần tử thứ 3 của cột trái). */
    const alertOf = (node: FakeEl): FakeEl | null => (textColumnOf(node).props.children as (FakeEl | null)[])[2] ?? null;

    // Giai đoạn 1: TRẠNG THÁI ĐẦU — công tắc BẬT, không bận, không lỗi.
    const writes: boolean[] = [];
    let settle: (() => void) | undefined;
    let writer: (next: boolean) => Promise<void> = (next) => {
      writes.push(next);
      return new Promise<void>((resolve) => { settle = resolve; });
    };
    const props: Record<string, unknown> = {
      t: (key: string): string => key,
      useDeveloperTools: (select: (value: boolean) => boolean): boolean => select(true),
      setEnabled: (next: boolean): Promise<void> => writer(next),
    };
    const first = render(props);
    expect(switchOf(first).props, "công tắc phải BẬT theo hook").toMatchObject({ checked: true, disabled: false });
    expect(alertOf(first)).toBeNull();

    // Giai đoạn 2: BẤM — hàm ghi phải được gọi với giá trị ĐẢO, công tắc bị KHOÁ khi đang ghi.
    (switchOf(first).props.onChange as (next: boolean) => void)(false);
    expect(writes, "bấm công tắc phải GHI (đây là chỗ từng im lặng)").toEqual([false]);
    expect(switchOf(render(props)).props.disabled, "đang ghi ⇒ khoá để không bấm liên tiếp").toBe(true);
    settle?.();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const settled = render(props);
    expect(switchOf(settled).props.disabled).toBe(false);
    expect(alertOf(settled)).toBeNull();

    // Giai đoạn 3: HOST TỪ CHỐI — dòng role=alert hiện developerTools.error (không im lặng).
    writer = (next) => {
      writes.push(next);
      return Promise.reject(new Error("host refused"));
    };
    (switchOf(settled).props.onChange as (next: boolean) => void)(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const failed = render(props);
    expect(writes).toEqual([false, true]);
    const alert = alertOf(failed);
    expect(alert, "Host từ chối ⇒ phải có dòng báo lỗi").not.toBeNull();
    expect(alert?.props.role).toBe("alert");
    expect(alert?.props.children).toBe("developerTools.error");

    // Giai đoạn 4: THIẾU HÀM GHI (đúng lỗi wiring 11/11/2026) — không được im lặng: phải hiện lỗi.
    const originalError = console.error;
    const logged: unknown[] = [];
    console.error = (...args: unknown[]): void => { logged.push(args[0]); };
    try {
      const noWriter = { ...props };
      delete (noWriter as Record<string, unknown>)["setEnabled"];
      const deadNode = render(noWriter);
      (switchOf(deadNode).props.onChange as (next: boolean) => void)(false);
      const deadAfter = render(noWriter);
      expect(deadAfter.props.children, "thiếu hàm ghi KHÔNG được là no-op im lặng").toBeTruthy();
      expect(alertOf(deadAfter)?.props.role).toBe("alert");
      expect(logged.length).toBeGreaterThan(0);
    } finally {
      console.error = originalError;
    }
  });
});

