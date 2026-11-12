/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-client-ui-sidebar (row ui-sidebar): vo cot, panel list, ghe window-chrome
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeBrand } from "../lib/brand-parity.ts";
import { buildPackage } from "../../packages/client/ui-sidebar/build.ts";
import {
  COLLAPSE_SETTLE_MS,
  NS,
  PACKAGE_NAME,
  SCROLLBAR_LINGER_MS,
  STOCK_PACKAGE_NAME,
} from "../../packages/client/ui-sidebar/src/ids.ts";
import { SIDEBAR_CLASS } from "../../packages/client/ui-sidebar/src/class-names.ts";
import {
  createHeaderLeadingControls,
  createSidebarRoot,
  localBuildVersion,
  type ShellPrimitives,
} from "../../packages/client/ui-sidebar/src/components.ts";
import { en } from "../../packages/client/ui-sidebar/src/locales.ts";
import type { ClientPlugin, RequireFn } from "../../packages/client/ui-sidebar/src/plugin.ts";

/** Tên hai slot mà row phải ĐĂNG KÝ — chép từ bản gốc, KHÔNG lấy từ hằng của gói. */
const SIDEBAR_SLOT = "sidebar";
/** Ghế window-chrome khi sidebar thu hẳn. */
const LEADING_SLOT = "shell.leading";
/** Bảy slot con khai trong `children` (không phải lời gọi đăng ký riêng). */
const CHILD_SLOTS = [
  "sidebar.brand.mark",
  "sidebar.brand.name",
  "sidebar.toggle.badge",
  "sidebar.panellist",
  "sidebar.workspaces",
  "sidebar.settings",
  "sidebar.footer.action",
];

/** Một element do jsx giả dựng. */
interface Element {
  /** Loại element: chuỗi thẻ HTML hoặc component. */
  type: unknown;
  /** Props đã truyền. */
  props: Record<string, unknown>;
  /** Khoá React. */
  key?: unknown;
}

/** Một đăng ký `__ModuleLoader__.load` mà script thật phát ra. */
interface Registration {
  /** Id module bundle tự khai. */
  id: string;
  /** Factory lười. */
  factory: (require: RequireFn) => unknown;
}

/** Bản build thật, dùng chung cho cả file. */
let built: Promise<{ host: string; client: string }> | undefined;

/**
 * Build package vào thư mục tạm (một lần cho cả file).
 * Nhận: không.
 * Trả: đường dẫn hai nửa đã build.
 */
function buildOnce(): Promise<{ host: string; client: string }> {
  built ??= mkdtemp(join(tmpdir(), "gbh-ui-sidebar-")).then((out) => buildPackage(out));
  return built;
}

/**
 * Nạp bundle client thật trong `window` giả.
 * Nhận: mã nguồn `lib/client.js`.
 * Trả: các đăng ký theo đúng thứ tự script phát ra.
 */
function loadBundle(code: string): Registration[] {
  const calls: Registration[] = [];
  new Function("window", code)({ __ModuleLoader__: { load: (registration: Registration) => calls.push(registration) } });
  return calls;
}

/** jsx giả: ghi lại cây element. */
function fakeJsx(type: unknown, props: Record<string, unknown>, key?: unknown): Element {
  return { type, props, key };
}

/**
 * React giả: đủ cho MỘT lượt render, có ghi lại setter và hiệu ứng.
 *
 * ⚠️ CỐ Ý KHÔNG có `jsx`/`jsxs`: module `react` thật cũng không có chúng (chúng ở
 * `react/jsx-runtime`). Stub cũ có `jsx` nên che mất lỗi `react.jsx is not a function` đã làm hỏng
 * UI thật ngày 17/10/2026 — đây là TEST CANH cho đúng lớp lỗi đó.
 */
function makeReact(record: { setState: { index: number; value: unknown }[]; cleanups: (() => void)[] }) {
  let stateIndex = 0;
  return {
    useState: <T,>(initial: T): [T, (next: T) => void] => {
      const index = stateIndex++;
      const stored = record.setState.find((entry) => entry.index === index);
      return [
        (stored?.value ?? initial) as T,
        (next: T) => {
          const existing = record.setState.find((entry) => entry.index === index);
          if (existing === undefined) record.setState.push({ index, value: next });
          else existing.value = next;
        },
      ];
    },
    useRef: <T,>(initial: T): { current: T } => ({ current: initial }),
    useEffect: (callback: () => void | (() => void)): void => {
      const cleanup = callback();
      if (typeof cleanup === "function") record.cleanups.push(cleanup);
    },
  };
}

/** ui-primitives giả: các component đánh dấu + cờ nền tảng macOS. */
/**
 * Runtime gộp ĐÚNG như plugin.ts làm: hook của react + jsx/jsxs của react/jsx-runtime.
 * Nhận: bản ghi setter/hiệu ứng.
 * Trả: runtime mà hai component cần.
 */
function shellDeps(record: { setState: { index: number; value: unknown }[]; cleanups: (() => void)[] }) {
  return { jsx: fakeJsx, jsxs: fakeJsx, react: makeReact(record) };
}

/** ui-primitives giả: các component đánh dấu + cờ nền tảng macOS. */
function makePrimitives(darwin = false): ShellPrimitives & { calls: string[] } {
  const calls: string[] = [];
  const marker = (name: string) => (props: Record<string, unknown>) => {
    calls.push(name);
    return { type: name, props };
  };
  return {
    calls,
    Tooltip: marker("Tooltip"),
    IconPanelLeftOutlineRegular: marker("IconPanelLeft"),
    IconNewChatOutlineRegular: marker("IconNewChatRegular"),
    IconNewChatOutlineMedium: marker("IconNewChatMedium"),
    FishLogo: marker("FishLogo"),
    ShortcutKeys: marker("ShortcutKeys"),
    isDarwinDesktop: () => darwin,
  };
}

/** Document + window giả tối thiểu cho vỏ sidebar. */
function makeDom(titlebar = false, timers: (() => void)[] = []) {
  const tags: { dataset: Record<string, string>; textContent: string }[] = [];
  const documentStub = {
    documentElement: { hasAttribute: (name: string) => titlebar && name === "data-windows-titlebar" },
    head: { appendChild: (el: (typeof tags)[number]) => void tags.push(el) },
    createElement: () => ({ dataset: {} as Record<string, string>, textContent: "" }),
    querySelector: (selector: string) => tags.find((el) => selector.includes(el.dataset.pluginCss ?? "\u0000")) ?? null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  const windowStub = {
    setTimeout: (callback: () => void) => {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout: () => undefined,
  };
  return { documentStub, windowStub, tags };
}

/** Bản ghi một lần `apply` trên context giả. */
interface CtxRecord {
  /** Hiệu ứng vòng đời ở context gốc. */
  effects: { label: string | undefined; dispose: unknown }[];
  /** Seam đã tra bằng `ctx.get`. */
  got: string[];
  /** Từ điển đã đăng ký. */
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
  /** Slot đã xin chỗ. */
  injectedSlots: string[];
  /** Occupant đã đăng ký. */
  occupants: { definition: Record<string, unknown>; component: unknown }[];
  /** Slot đã nghe thay đổi. */
  subscribedSlots: { slot: string; listener: () => void }[];
  /** Ngôn ngữ đã nghe thay đổi. */
  localeListeners: (() => void)[];
  /** Lệnh gọi layout. */
  layoutCalls: string[];
  /** Sự kiện analytics. */
  analytics: { event: string; payload: Record<string, unknown> }[];
  /** Lệnh gọi điều hướng workspace. */
  startSession: (string | undefined)[];
}

/**
 * Dấu vết rỗng cho một lần `apply`.
 * Nhận: không.
 * Trả: bản ghi chưa có gì.
 */
function emptyRecord(): CtxRecord {
  return {
    effects: [],
    got: [],
    dictionaries: [],
    injectedSlots: [],
    occupants: [],
    subscribedSlots: [],
    localeListeners: [],
    layoutCalls: [],
    analytics: [],
    startSession: [],
  };
}

/** Store ảnh chụp giả, có đếm số lần `set`. */
function makeStore<T>(initial: T, sets: T[] = []) {
  let current = initial;
  return {
    sets,
    getSnapshot: () => current,
    set: (next: T) => {
      current = next;
      sets.push(next);
    },
  };
}

/**
 * Dựng context phía browser tối thiểu cho row sidebar.
 * Nhận: bản ghi, danh sách entry của slot `sidebar.panellist`, và bản ghi số lần `set` của store.
 * Trả: context giả cùng store, danh mục phím tắt.
 */
function makeContext(
  record: CtxRecord,
  entries: { options: { id: string; order?: number; label?: unknown } }[],
  sets: unknown[] = [],
) {
  const catalog = { catalog: true };
  const store = makeStore<unknown>([], sets);
  return {
    store,
    catalog,
    ctx: {
      effect(callback: () => void | (() => void), label?: string): void {
        record.effects.push({ label, dispose: callback() });
      },
      get(name: string): unknown {
        record.got.push(name);
        if (name === "uiWorkspace") {
          return {
            startSession: (workspaceId?: string) => {
              record.startSession.push(workspaceId);
            },
          };
        }
        if (name === "productAnalytics") {
          return {
            track: (event: string, payload: Record<string, unknown>) => {
              record.analytics.push({ event, payload });
            },
          };
        }
        return undefined;
      },
      locale: {
        register: (namespace: string, copy: Record<string, Record<string, string>>) => {
          record.dictionaries.push({ namespace, copy });
          return () => undefined;
        },
        subscribe: (listener: () => void) => {
          record.localeListeners.push(listener);
          return () => undefined;
        },
      },
      layout: {
        toggleSidebar: () => {
          record.layoutCalls.push("toggleSidebar");
        },
        selectPanel: (id: string) => {
          record.layoutCalls.push("selectPanel:" + id);
        },
      },
      shortcuts: { catalog },
      slots: {
        entriesOfSlot: () => entries,
        subscribe: (slot: string, listener: () => void) => {
          record.subscribedSlots.push({ slot, listener });
          return () => undefined;
        },
        register: (definition: Record<string, unknown>, component: unknown) => {
          record.occupants.push({ definition, component });
          return () => undefined;
        },
        inject: (slot: string, register: () => unknown) => {
          record.injectedSlots.push(slot);
          register();
        },
      },
    },
  };
}

/**
 * Vạt chất hoá bundle thật thành plugin.
 * Nhận: bản ghi số lần `set` của store (để đối chiếu `syncPanels`).
 * Trả: plugin cùng danh sách specifier đã require.
 */
async function materialize(
  sets: unknown[] = [],
): Promise<{ plugin: ClientPlugin; required: string[]; createdStore: () => unknown }> {
  const out = await buildOnce();
  const registration = loadBundle(await readFile(out.client, "utf8"))[0];
  expect(registration).toBeDefined();
  const required: string[] = [];
  let createdStore: unknown;
  const requireFn: RequireFn = (specifier) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    required.push(specifier);
    if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx };
    if (specifier === "react") return makeReact({ setState: [], cleanups: [] });
    if (specifier .endsWith("-client-ui-primitives")) return makePrimitives();
    if (specifier .endsWith("-client-store")) {
      return {
        createSnapshotStore: (initial: unknown) => {
          const store = makeStore(initial, sets);
          createdStore = store;
          return store;
        },
      };
    }
    if (specifier .endsWith("-client-ui-slots")) {
      return {
        resolveSlotLabel: (label: unknown) => {
          if (typeof label === "string") return label.toUpperCase();
          if (typeof label === "function") return String((label as () => unknown)());
          return undefined;
        },
      };
    }
    throw new Error("khong duoc require " + specifier);
  };
  return { plugin: registration?.factory(requireFn) as ClientPlugin, required, createdStore: () => createdStore };
}

describe("khuôn bundle — script classic, MỘT id module, CSS cả hai module", () => {
  test("lib/client.js không có cú pháp ESM và đăng ký ĐÚNG MỘT id (id của ta)", async () => {
    const out = await buildOnce();
    const code = await readFile(out.client, "utf8");
    expect(/^\s*(?:import|export)\s/m.test(code)).toBe(false);
    const calls = loadBundle(code);
    // LUẬT MỘT-ID (17/10/2026): bundle đăng ký ĐÚNG MỘT id — id CỦA TA. Id gốc CHỈ khai ở
    // gbh.row.aliases và tầng nạp tự sinh entry alias trỏ về cùng URL bundle.
    // Vì sao KHÔNG đăng ký thêm id gốc: bundle sẽ chạy HAI lần ⇒ duplicate factory registration
    // ⇒ app trắng (đúng sự cố 12 tầng ngày 17/10/2026).
    expect(calls.map((call) => call.id)).toEqual([PACKAGE_NAME]);
    expect(calls.map((call) => call.id)).not.toContain(STOCK_PACKAGE_NAME);
  });

  test("CSS của CẢ HAI module được nhúng nguyên văn từ file .module.css", async () => {
    const out = await buildOnce();
    const code = await readFile(out.client, "utf8");
    const dir = join(import.meta.dir, "..", "..", "packages", "client", "ui-sidebar", "src");
    const sidebarCss = await readFile(join(dir, "SidebarRoot.module.css"), "utf8");
    const headerCss = await readFile(join(dir, "HeaderLeadingControls.module.css"), "utf8");
    const sidebarRule = ".hHd-Xa_root{--dsh-sidebar-inline-padding:12px;height:100%;";
    expect(sidebarCss).toContain(sidebarRule);
    // 20/10/2026 — brand token trong artefact đã đổi `--dsh-*` → `--gbh-*` (rename CÓ CHỦ ĐÍCH);
    // nguồn CSS vẫn là bản gốc ⇒ chuẩn hoá ĐỐI XỨNG hai vế rồi mới so khớp nguyên văn.
    expect(normalizeBrand(code)).toContain(normalizeBrand(sidebarRule));
    expect(code).toContain(".IW6AQa_iconButton{border-radius:var(--dsw-radius-sm)");
    expect(headerCss).toContain("--dsw-alias-interactive-bg-hover");
  });

  test("script chỉ ĐĂNG KÝ: chưa require module nào cho tới lúc vạt chất hoá", async () => {
    const out = await buildOnce();
    const calls = loadBundle(await readFile(out.client, "utf8"));
    // MỘT lời gọi đăng ký (luật một-id) — và vẫn chưa require module nào cho tới lúc vạt chất hoá.
    expect(calls.length).toBe(1);
    for (const call of calls) expect(typeof call.factory).toBe("function");
  });
});

describe("test canh — CSS phải TRÙNG NGUYÊN VĂN bản gốc", () => {
  /** Bỏ mọi khoảng trắng để so phần CSS, không phụ thuộc cách xuống dòng. */
  const squash = (text: string): string => text.split(/\s+/).join("");

  /**
   * Rút chuỗi CSS mà package gốc nhúng trong bundle client.
   * Nhận: tên module ("SidebarRoot" | "HeaderLeadingControls").
   * Trả: văn bản CSS nguyên gốc.
   */
  async function stockCss(name: string): Promise<string> {
    const path = join(
      import.meta.dir,
      "..",
      "..",
      "apps",
      "host",
      "node_modules",
      "@deepseek-ai",
      "dsh-client-ui-sidebar",
      "lib",
      "client.js",
    );
    const source = await readFile(path, "utf8");
    const pattern = name === "HeaderLeadingControls" ? /const css\$1 = "((?:[^"\\]|\\.)*)";/ : /const css = "((?:[^"\\]|\\.)*)";/;
    const match = pattern.exec(source);
    expect(match).not.toBeNull();
    return JSON.parse('"' + (match?.[1] ?? "") + '"') as string;
  }

  test("CSS của ta TRÙNG bản gốc sau khi bỏ khoảng trắng (bắt lỗi trích làm vỡ block lồng nhau)", async () => {
    // Sự cố 17/10/2026: bộ trích tách rule theo "}" rồi BỎ fragment rỗng ⇒ mất dấu "}" đóng @keyframes
    // ⇒ trình duyệt nuốt mọi rule sau đó (thanh bên dồn nén) mà KHÔNG có lỗi console nào.
    for (const name of ["SidebarRoot", "HeaderLeadingControls"]) {
      const mine = await readFile(join(import.meta.dir, "..", "..", "packages", "client", "ui-sidebar", "src", name + ".module.css"), "utf8");
      const body = mine.split("*/")[1] ?? "";
      const original = await stockCss(name);
      expect(squash(body)).toBe(squash(original));
      // Ngoặc phải cân bằng — bất đối xứng là dấu hiệu block bị vỡ.
      expect((body.match(/\{/g) ?? []).length).toBe((body.match(/\}/g) ?? []).length);
    }
  });
});

describe("mặt plugin — hình dạng mà Loader nhận", () => {
  test("require đúng năm specifier theo đúng thứ tự bản gốc và khai đủ 5 seam", async () => {
    const { plugin, required } = await materialize();
    expect(required).toEqual([
      "@deepseek-ai/dsh-client-store",
      "@deepseek-ai/dsh-client-ui-slots",
      "react/jsx-runtime",
      "@deepseek-ai/dsh-client-ui-primitives",
      "react",
    ]);
    expect(plugin.inject.join(" ")).toBe("slots layout uiWorkspace locale shortcuts");
    expect(typeof plugin.apply).toBe("function");
  });
});

describe("apply — nối dây vào seam", () => {
  test("từ điển, danh sách panel, hai occupant và ba hiệu ứng", async () => {
    const sets: unknown[] = [];
    const { plugin } = await materialize(sets);
    const record = emptyRecord();
    const entries = [
      { options: { id: "chat", order: 20, label: "chat" } },
      { options: { id: "plugins", label: () => "plugins" } },
    ];
    const { ctx } = makeContext(record, entries, sets);
    plugin.apply(ctx);

    // (1) từ điển namespace `sidebar`, đủ 5 khoá ở cả hai thứ tiếng.
    expect(record.dictionaries.length).toBe(1);
    expect(record.dictionaries[0]?.namespace).toBe(NS);
    const copy = record.dictionaries[0]?.copy;
    const keys = ["panels.label", "session.new", "session.new.label", "toggle.collapse", "toggle.open"];
    expect(Object.keys(copy?.zh ?? {}).sort()).toEqual(keys);
    expect(Object.keys(copy?.en ?? {}).sort()).toEqual(keys);
    expect(copy?.en?.["session.new"]).toBe(en["session.new"]);

    // (2) danh sách panel: sắp theo order (0 mặc định), nhãn qua resolveSlotLabel, id giữ nguyên.
    expect(sets.length).toBe(1);
    // Nhãn chuỗi được phân giải (viết hoa trong bản giả), nhãn hàm được GỌI; thiếu order ⇒ 0.
    expect(sets[0]).toEqual([
      { id: "plugins", order: 0, label: "plugins" },
      { id: "chat", order: 20, label: "CHAT" },
    ]);

    // (3) nghe đúng hai nguồn: slot panellist + thay đổi ngôn ngữ.
    expect(record.subscribedSlots.map((entry) => entry.slot)).toEqual(["sidebar.panellist"]);
    expect(record.localeListeners.length).toBe(1);

    // (4) hai occupant: `sidebar` (kèm 7 slot con) và `shell.leading`.
    expect(record.injectedSlots).toEqual([SIDEBAR_SLOT, LEADING_SLOT]);
    const sidebar = record.occupants[0]?.definition ?? {};
    const leading = record.occupants[1]?.definition ?? {};
    expect(sidebar.name).toBe(SIDEBAR_SLOT);
    expect(sidebar.locale).toBe(NS);
    expect(Object.keys(sidebar.children as Record<string, unknown>)).toEqual(CHILD_SLOTS);
    expect((sidebar.children as Record<string, Record<string, unknown>>)["sidebar.panellist"]).toEqual({
      kind: "list",
      scope: "root",
    });
    expect(leading.name).toBe(LEADING_SLOT);
    expect(leading.locale).toBe(NS);
    expect(typeof record.occupants[0]?.component).toBe("function");
    expect(typeof record.occupants[1]?.component).toBe("function");

    // (5) nhãn hiệu ứng giữ nguyên như bản gốc.
    expect(record.effects.map((effect) => effect.label)).toEqual([
      "ui-sidebar: dictionaries",
      "ui-sidebar: panel entries",
      "ui-sidebar: panel labels",
    ]);

    // (6) mặt inject: hành động + hai nguồn quan sát được.
    const face = (sidebar.inject as () => Record<string, unknown>)();
    expect(Object.keys(face.hooks as Record<string, unknown>).sort()).toEqual(["panels", "shortcuts"]);
    expect((face.hooks as Record<string, unknown>).panels).toBe(sets.length > 0 ? (face.hooks as Record<string, unknown>).panels : undefined);
    expect(record.got).toContain("uiWorkspace");
  });

  test("hành động của mặt inject: phiên mới, đóng/mở cột, chọn panel kèm analytics", async () => {
    const { plugin, createdStore } = await materialize();
    const record = emptyRecord();
    const { ctx, catalog } = makeContext(record, []);
    plugin.apply(ctx);
    const sidebar = record.occupants[0]?.definition ?? {};
    const face = (sidebar.inject as () => Record<string, unknown>)();

    // hooks phải chính là store panel mà PLUGIN tạo và danh mục phím tắt của ctx.
    const hooks = face.hooks as Record<string, unknown>;
    expect(hooks.panels).toBe(createdStore());
    expect(hooks.shortcuts).toBe(catalog);

    (face.startSession as (id?: string) => void)("ws-1");
    (face.startSession as (id?: string) => void)();
    (face.toggleSidebar as () => void)();
    (face.selectPanel as (id: string) => void)("plugins");
    (face.selectPanel as (id: string) => void)("schedules");
    (face.selectPanel as (id: string) => void)("chat");

    expect(record.startSession).toEqual(["ws-1", undefined]);
    expect(record.layoutCalls).toEqual([
      "toggleSidebar",
      "selectPanel:plugins",
      "selectPanel:schedules",
      "selectPanel:chat",
    ]);
    // Chỉ hai panel được đếm, đúng tên sự kiện và khoá của bản gốc.
    expect(record.analytics).toEqual([
      { event: "sidebar_menu_click", payload: { menu_name: "plugin" } },
      { event: "sidebar_menu_click", payload: { menu_name: "cron" } },
    ]);
  });

  test("syncPanels KHÔNG công bố khi danh sách không đổi (tránh render thừa)", async () => {
    const sets: unknown[] = [];
    const { plugin } = await materialize(sets);
    const record = emptyRecord();
    const entries = [{ options: { id: "chat", order: 1, label: "chat" } }];
    const { ctx } = makeContext(record, entries, sets);
    plugin.apply(ctx);
    expect(sets.length).toBe(1);
    // Gọi lại qua người nghe của slot và của ngôn ngữ: cùng dữ liệu ⇒ không công bố thêm lần nào.
    record.subscribedSlots[0]?.listener();
    record.localeListeners[0]?.();
    expect(sets.length).toBe(1);
  });
});

describe("HeaderLeadingControls — hai nút ở ghế window-chrome", () => {
  test("hai tooltip bọc hai nút, nhãn từ từ điển và phím tắt từ danh mục", () => {
    const deps = shellDeps({ setState: [], cleanups: [] });
    const primitives = makePrimitives();
    const controls = createHeaderLeadingControls({ ...deps, primitives });
    const shortcutRows = [
      { id: "sidebar.left.toggle", keys: ["Ctrl", "B"], aria: "Control+B" },
      { id: "session.new", keys: ["Ctrl", "N"], aria: "Control+N" },
    ];
    const clicks: string[] = [];
    const node = controls({
      toggleSidebar: () => clicks.push("toggle"),
      startSession: () => clicks.push("new"),
      useShortcuts: (select) => select(shortcutRows) as never,
      t: (key: string) => en[key as keyof typeof en],
    }) as Element;

    expect(node.props.className).toBe("IW6AQa_controls");
    const [toggleTip, newTip] = node.props.children as Element[];
    expect(toggleTip?.props.label).toBe(en["toggle.open"]);
    expect(toggleTip?.props.shortcutKeys).toEqual(["Ctrl", "B"]);
    expect(toggleTip?.props.delayMs).toBe(500);
    const toggleButton = toggleTip?.props.children as Element;
    expect(toggleButton.props["aria-label"]).toBe(en["toggle.open"]);
    expect(toggleButton.props["aria-keyshortcuts"]).toBe("Control+B");
    expect(toggleButton.props.className).toBe("IW6AQa_iconButton");
    (toggleButton.props.onClick as () => void)();
    expect(clicks).toEqual(["toggle"]);

    expect(newTip?.props.label).toBe(en["session.new.label"]);
    const newButton = newTip?.props.children as Element;
    expect(newButton.props["aria-keyshortcuts"]).toBe("Control+N");
    (newButton.props.onClick as () => void)();
    expect(clicks).toEqual(["toggle", "new"]);
    // Biểu tượng: so DANH TÍNH component, jsx giả không render sâu nên không thể đếm lời gọi.
    expect((toggleButton.props.children as Element).type).toBe(primitives.IconPanelLeftOutlineRegular);
    expect(((toggleButton.props.children as Element).props as Record<string, unknown>).size).toBe(16);
    expect((newButton.props.children as Element).type).toBe(primitives.IconNewChatOutlineRegular);
  });
});

describe("SidebarRoot — cây cột sidebar", () => {
  const previousDocument = (globalThis as { document?: unknown }).document;
  const previousWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    const { documentStub, windowStub } = makeDom();
    (globalThis as { document?: unknown }).document = documentStub;
    (globalThis as { window?: unknown }).window = windowStub;
  });
  afterEach(() => {
    (globalThis as { document?: unknown }).document = previousDocument;
    (globalThis as { window?: unknown }).window = previousWindow;
  });

  /** Props renderer bind cho cột, có ghi lại các lời gọi slot. */
  function sidebarProps(overrides: Record<string, unknown> = {}) {
    const renders: { slot: string; owner: Record<string, unknown>; options?: Record<string, unknown> }[] = [];
    const clicks: string[] = [];
    const base = {
      collapsed: false,
      width: 264,
      startSession: () => clicks.push("start"),
      toggleSidebar: () => clicks.push("toggle"),
      selectPanel: (id: string) => clicks.push("panel:" + id),
      usePanels: (select: (panels: readonly unknown[]) => readonly unknown[]) =>
        select([
          { id: "chat", order: 0, label: "Chat" },
          { id: "plugins", order: 10, label: "Plugins" },
        ]),
      useShortcuts: (select: (rows: readonly unknown[]) => unknown) =>
        select([
          { id: "sidebar.left.toggle", keys: ["Ctrl", "B"], aria: "Control+B" },
          { id: "session.new", keys: ["Ctrl", "N"], aria: "Control+N" },
        ]),
      usePanelInfo: (select: (info: { activePanelId?: string }) => unknown) => select({ activePanelId: "chat" }) as boolean,
      t: (key: string) => en[key as keyof typeof en],
      renderSlot: (slot: string, owner: Record<string, unknown>, options?: Record<string, unknown>) => {
        renders.push({ slot, owner, options });
        // Renderer thật chỉ dùng `fallback` khi slot chưa có người chiếm; ở đây trả về đúng thứ đó
        // để test chạm được cả nhánh dự phòng (biểu tượng cá của DSH).
        return options?.fallback ?? { type: "slot:" + slot, props: owner };
      },
      ...overrides,
    };
    return { base: base as never, renders, clicks };
  }

  test("cột rộng: thương hiệu, phiên mới, danh sách panel, vùng workspace và chân cột", () => {
    const deps = shellDeps({ setState: [], cleanups: [] });
    const primitives = makePrimitives(false);
    const root = createSidebarRoot({ ...deps, primitives });
    const { base, renders, clicks } = sidebarProps();
    const node = root(base) as Element;

    expect(node.props.className).toContain(SIDEBAR_CLASS.root);
    expect(node.props.className).not.toContain(SIDEBAR_CLASS.collapsed);
    expect(node.props.className).toContain(SIDEBAR_CLASS.quietBars);
    expect(node.props.style).toEqual({ width: 264 });

    // React bỏ qua các con giả (`false`) — mảng thô vẫn giữ chúng nên phải lọc như React.
    const [logoRow, newSession, nav, region, foot] = (node.props.children as Element[]).filter(Boolean);
    expect(logoRow?.props.className).toBe(SIDEBAR_CLASS.logoRow);
    const brand = (logoRow?.props.children as Element[])[0];
    expect(brand?.type).toBe("button");
    expect(brand?.props["aria-label"]).toBe(en["session.new.label"]);
    (brand?.props.onClick as () => void)();
    expect(clicks).toContain("start");

    // Nút phiên mới được bọc trong Tooltip: kiểm cả tooltip lẫn nút bên trong.
    expect(newSession?.props.label).toBe(en["session.new.label"]);
    expect(newSession?.props.disabled).toBe(true); // cột rộng ⇒ tooltip tắt
    const newSessionButton = newSession?.props.children as Element;
    expect(newSessionButton?.props.className).toBe(SIDEBAR_CLASS.newSession);
    expect(newSessionButton?.props["aria-keyshortcuts"]).toBe("Control+N");
    const [mask, shortcutBadge] = newSessionButton?.props.children as Element[];
    expect(mask?.props.className).toBe(SIDEBAR_CLASS.newSessionLabelMask);
    expect(shortcutBadge?.props.className).toBe(SIDEBAR_CLASS.newSessionShortcut);
    expect((shortcutBadge?.props.children as Element).type).toBe(primitives.ShortcutKeys);

    expect(nav?.props.className).toBe(SIDEBAR_CLASS.panelList);
    expect(nav?.props["aria-label"]).toBe(en["panels.label"]);
    const rows = nav?.props.children as Element[];
    expect(rows.map((row) => row.key)).toEqual(["chat", "plugins"]);

    expect(renders.map((entry) => entry.slot)).toEqual([
      "sidebar.brand.mark",
      "sidebar.brand.name",
      "sidebar.workspaces",
      "sidebar.footer.action",
      "sidebar.settings",
    ]);
    expect(renders[2]?.owner.wide).toBe(true);
    expect(typeof renders[2]?.owner.expandSidebar).toBe("function");
    expect(renders[3]?.owner).toEqual({ wide: true });
    expect(renders[4]?.owner).toEqual({ wide: true });
    expect(region?.props.className).toBe(SIDEBAR_CLASS.regionArea);
    expect(foot?.props.className).toBe(SIDEBAR_CLASS.footArea);
  });

  /**
   * Render một dòng panel: `PanelRow` là component nên phải gọi nó mới ra element Tooltip.
   * Nhận: element của PanelRow trong cây `nav`.
   * Trả: element Tooltip bọc nút.
   */
  function renderRow(row: Element) {
    return (row.type as (props: Record<string, unknown>) => unknown)(row.props) as Element;
  }

  test("dòng panel: trạng thái chọn, tooltip, ô biểu tượng theo đúng id", () => {
    const deps = shellDeps({ setState: [], cleanups: [] });
    const primitives = makePrimitives(false);
    const root = createSidebarRoot({ ...deps, primitives });
    const { base, clicks } = sidebarProps();
    const node = root(base) as Element;
    const nav = (node.props.children as Element[]).filter(Boolean)[2] as Element;
    const tip = renderRow((nav.props.children as Element[])[0] as Element);

    const tipProps = tip.props;
    expect(tipProps.label).toBe("Chat");
    expect(tipProps.delayMs).toBe(500);
    expect(tipProps.disabled).toBe(true);
    const button = tipProps.children as Element;
    expect(button.props.className).toContain(SIDEBAR_CLASS.panelRow);
    expect(button.props.className).toContain(SIDEBAR_CLASS.panelActive);
    expect(button.props["aria-current"]).toBe("page");
    (button.props.onClick as () => void)();
    expect(clicks).toContain("panel:chat");

    const [glyph, title] = button.props.children as Element[];
    expect(glyph?.props.className).toBe(SIDEBAR_CLASS.panelGlyph);
    expect(glyph?.props["aria-hidden"]).toBe("true");
    expect(title?.props.className).toContain(SIDEBAR_CLASS.wide);
    expect(title?.props.children).toBe("Chat");
  });

  test("panel không được chọn: không có aria-current và không có lớp active", () => {
    const deps = shellDeps({ setState: [], cleanups: [] });
    const primitives = makePrimitives(false);
    const root = createSidebarRoot({ ...deps, primitives });
    const { base } = sidebarProps();
    const node = root(base) as Element;
    const nav = (node.props.children as Element[]).filter(Boolean)[2] as Element;
    const second = renderRow((nav.props.children as Element[])[1] as Element);
    const button = second.props.children as Element;
    expect(button.props.className).not.toContain(SIDEBAR_CLASS.panelActive);
    expect(button.props["aria-current"]).toBeUndefined();
  });

  test("cột đang thu (chưa settle): vẫn rộng, có hiệu ứng settle và huy hiệu trên nút mở", () => {
    const timers: (() => void)[] = [];
    const { documentStub, windowStub } = makeDom(false, timers);
    (globalThis as { document?: unknown }).document = documentStub;
    (globalThis as { window?: unknown }).window = windowStub;
    const deps = shellDeps({ setState: [], cleanups: [] });
    const primitives = makePrimitives(false);
    const root = createSidebarRoot({ ...deps, primitives });
    const { base, renders } = sidebarProps({ collapsed: true });
    const node = root(base) as Element;

    // Mount ra ĐÃ THU thì `settled` khởi tạo bằng `collapsed` ⇒ vào rail ngay (không chờ 150ms).
    expect(node.props.className).toContain(SIDEBAR_CLASS.root);
    expect(node.props.className).toContain(SIDEBAR_CLASS.collapsed);
    expect(timers.length).toBe(1);
    expect(COLLAPSE_SETTLE_MS).toBe(150);
    expect(SCROLLBAR_LINGER_MS).toBe(2000);
    expect(renders.some((entry) => entry.slot === "sidebar.toggle.badge")).toBe(true);
  });

  test("macOS: dải kéo cửa sổ và nút thương hiệu là span (không phải nút)", () => {
    const deps = shellDeps({ setState: [], cleanups: [] });
    const primitives = makePrimitives(true);
    const root = createSidebarRoot({ ...deps, primitives });
    const { base, renders } = sidebarProps();
    const node = root(base) as Element;
    const children = node.props.children as Element[];
    expect(children[0]?.props.className).toBe(SIDEBAR_CLASS.topStrip);
    expect(children[0]?.props["data-window-drag"]).toBe(true);
    const logoRow = children[1] as Element;
    const brand = (logoRow.props.children as Element[])[0];
    expect(brand?.type).toBe("span");
    // Nhánh dự phòng của ô thương hiệu phải là biểu tượng cá của DSH.
    const mark = renders.find((entry) => entry.slot === "sidebar.brand.mark");
    expect((mark?.options?.fallback as Element).type).toBe(primitives.FishLogo);
    expect((((mark?.options?.fallback as Element).props as Record<string, unknown>).size)).toBe(24);
  });
});

describe("nhãn bản build và nửa host", () => {
  test("nhãn bản build giữ nguyên chuỗi của bản gốc", () => {
    expect(localBuildVersion()).toBe("0.2.1-alpha.4-cc6a8f5");
    (globalThis as { DSH_CLIENT_GIT_DIRTY?: string }).DSH_CLIENT_GIT_DIRTY = "true";
    expect(localBuildVersion()).toBe("0.2.1-alpha.4-cc6a8f5-dirty");
    delete (globalThis as { DSH_CLIENT_GIT_DIRTY?: string }).DSH_CLIENT_GIT_DIRTY;
  });

  test("lib/index.js là ESM, chỉ xuất apply và không import gói ngoài", async () => {
    const out = await buildOnce();
    const code = await readFile(out.host, "utf8");
    const specifiers = [...code.matchAll(/from\s+"([^"\s]+)"/g)].map((match) => match[1] ?? "");
    for (const specifier of specifiers) {
      expect(specifier.startsWith("node:") || specifier === "@deepseek-ai/cordis" || specifier.startsWith("./")).toBe(true);
    }
    const module = (await import(out.host)) as { apply: () => void };
    expect(module.apply()).toBeUndefined();
  });

  test("ca chống cài hai lần: apply lần thứ hai cho BẤT KỲ ctx nào cũng là NO-OP (không thêm hiệu ứng/ghế)", async () => {
    const { plugin } = await materialize();
    const record = emptyRecord();
    const { ctx } = makeContext(record, []);
    plugin.apply(ctx as never);
    const afterFirst = { effects: record.effects.length, occupants: record.occupants.length };
    expect(afterFirst.effects).toBeGreaterThan(0);
    plugin.apply(ctx as never);
    expect(record.effects.length).toBe(afterFirst.effects);
    expect(record.occupants.length).toBe(afterFirst.occupants);
    // LUẬT NHÓM (17/10/2026): cổng chặn phải là BOOLEAN PHẠM VI MODULE, KHÔNG khoá theo ctx.
    // Căn cứ đo được: ca thật là HAI ENTRY ⇒ HAI ctx (loader.create mỗi entry ⇒ parent.extend({fiber})
    // ⇒ ctx MỚI) ⇒ cổng khoá-theo-ctx KHÔNG BAO GIỜ kích hoạt ⇒ apply chạy hai lần ⇒
    // service "... has been registered" ⇒ entry kẹt loading ⇒ cascade.
    // ⇒ Lần cài thứ hai với ctx KHÁC cũng phải là NO-OP (trước 17/10/2026 ca này khẳng định ngược lại).
    const other = emptyRecord();
    const { ctx: otherCtx } = makeContext(other, []);
    plugin.apply(otherCtx as never);
    expect(other.effects.length).toBe(0);
    expect(other.occupants.length).toBe(0);
  });

  test("ca log lỗi: apply ném lỗi ⇒ ĐÚNG MỘT dòng console.error và lỗi vẫn được ném tiếp", async () => {
    const { plugin } = await materialize();
    const record = emptyRecord();
    const { ctx } = makeContext(record, []);
    const broken = ctx as unknown as Record<string, unknown>;
    delete broken["effect"];
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]): void => {
      calls.push(args);
    };
    try {
      expect(() => plugin.apply(ctx as never)).toThrow();
    } finally {
      console.error = original;
    }
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.[0])).toContain("gbh-client-ui-sidebar: apply nem loi");
  });
});
