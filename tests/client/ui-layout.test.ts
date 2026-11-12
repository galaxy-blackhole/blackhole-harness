/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test cho row ui-layout — lat cat 1: hinh hoc ba cot, DOI CHUNG tung so voi bundle goc
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { buildPackage } from "../../packages/client/ui-layout/build.ts";
import { createPlugin } from "../../packages/client/ui-layout/src/plugin.ts";
import { join } from "node:path";
import {
  CENTER_MIN,
  clampWidth,
  computeColumns,
  RIGHTBAR_DEFAULT_RATIO,
  RIGHTBAR_MAX_RATIO,
  RIGHTBAR_MIN,
  SIDEBAR_AUTO_COLLAPSE,
  SIDEBAR_COLLAPSED,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
} from "../../packages/client/ui-layout/src/columns.ts";
import { LayoutController } from "../../packages/client/ui-layout/src/service.ts";
import { createLayoutStore } from "../../packages/client/ui-layout/src/stores.ts";
import { createAppFrame } from "../../packages/client/ui-layout/src/app-frame.ts";
import { createDocumentTitle } from "../../packages/client/ui-layout/src/document-title.ts";
import { ThemePresenter } from "../../packages/client/ui-layout/src/theme-presenter.ts";

/** Đường dẫn bundle gốc (CHỈ ĐỌC) — nguồn đối chứng. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-layout", "lib", "client.js");

/**
 * Rút một hàm khai bằng `function tên(...)` khỏi văn bản, cắt theo ngoặc cân bằng.
 * Nhận: văn bản nguồn và tên hàm.
 * Trả: mã nguồn của hàm.
 */
function extractFunction(source: string, name: string): string {
  const start = source.indexOf("function " + name + "(");
  if (start < 0) throw new Error("khong thay ham " + name + " trong bundle goc");
  let depth = 0;
  for (let at = start; at < source.length; at += 1) {
    const ch = source[at];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, at + 1);
    }
  }
  throw new Error("ham " + name + " khong dong ngoac");
}

/**
 * Dựng lại hai hàm số đo của bản gốc trong một phạm vi riêng, kèm hằng số chúng đọc.
 * Nhận: không có.
 * Trả: `{ clampWidth, computeColumns }` của bản gốc.
 */
async function loadStock() {
  const source = await readFile(STOCK, "utf8");
  const parts: string[] = [];
  for (const name of ["SIDEBAR_AUTO_COLLAPSE", "RIGHTBAR_MAX_RATIO", "RIGHTBAR_DEFAULT_RATIO"]) {
    const match = new RegExp("const " + name + " = ([^;]+);").exec(source);
    if (match !== null) parts.push("const " + name + " = " + match[1] + ";");
  }
  parts.push(extractFunction(source, "clampWidth"));
  parts.push(extractFunction(source, "computeColumns"));
  const factory = new Function(parts.join("\n") + "\nreturn { clampWidth: clampWidth, computeColumns: computeColumns };");
  return factory() as {
    clampWidth: (px: number, min: number, max: number) => number;
    computeColumns: (viewport: number, sidebar: number, rightbar: number, collapsedWidth?: number) => { sidebar: number; center: number; rightbar: number };
  };
}

/** Lưới giá trị: mọi vùng biên đều có mặt, gồm cả số lẻ và số âm. */
const VIEWPORTS = [320, 380, 400, 560, 664, 665, 719, 720, 721, 1000, 1023, 1024, 1025, 1280, 1365, 1440, 1680, 1920, 2560, 3840];
const SIDEBARS = [0, 1, 55, 56, 100, 200, 263, 264, 279, 280, 300, 400, 419, 420, 421, 500, 800, 1000, -5, 279.4, 279.6, 300.5];
const RIGHTBARS = [0, 1, 100, 299, 300, 301, 400, 500, 700, 900, 1200, 2000, 5000, -1, 0.4, 299.6, 700.5];
const COLLAPSED: (number | undefined)[] = [undefined, 0, 24, 56, 72, 100];

describe("hình học ba cột — ĐỐI CHỨNG từng số với bundle gốc", () => {
  test("hằng số giao kèo khớp đúng bản gốc", () => {
    // Số lấy từ lib/types/client/columns.d.ts của bản gốc — sai một số là lệch bố cục thật.
    expect(CENTER_MIN).toBe(400);
    expect(SIDEBAR_MIN).toBe(264);
    expect(SIDEBAR_MAX).toBe(420);
    expect(SIDEBAR_DEFAULT).toBe(280);
    expect(SIDEBAR_COLLAPSED).toBe(56);
    expect(SIDEBAR_AUTO_COLLAPSE).toBe(1024);
    expect(RIGHTBAR_MIN).toBe(300);
    expect(RIGHTBAR_MAX_RATIO).toBe(0.7);
    expect(RIGHTBAR_DEFAULT_RATIO).toBe(0.45);
  });

  test("clampWidth: giống bản gốc trên lưới giá trị (kể cả số âm và số lẻ)", async () => {
    const stock = await loadStock();
    const values = [-1000, -1, 0, 0.4, 0.5, 55.5, 56, 263.4, 263.6, 264, 400, 419.5, 420, 420.4, 1000, 65535];
    for (const px of values) {
      for (const min of [300, 264, 0, -10]) {
        for (const max of [420, 300, 0, 1000, -10]) {
          expect(clampWidth(px, min, max)).toBe(stock.clampWidth(px, min, max));
        }
      }
    }
  });

  test("computeColumns: giống bản gốc trên TOÀN BỘ lưới (hơn 13.000 tổ hợp)", async () => {
    const stock = await loadStock();
    let compared = 0;
    for (const viewport of VIEWPORTS) {
      for (const sidebar of SIDEBARS) {
        for (const rightbar of RIGHTBARS) {
          for (const collapsedWidth of COLLAPSED) {
            const mine =
              collapsedWidth === undefined
                ? computeColumns(viewport, sidebar, rightbar)
                : computeColumns(viewport, sidebar, rightbar, collapsedWidth);
            const theirs =
              collapsedWidth === undefined
                ? stock.computeColumns(viewport, sidebar, rightbar)
                : stock.computeColumns(viewport, sidebar, rightbar, collapsedWidth);
            if (JSON.stringify(mine) !== JSON.stringify(theirs)) {
              throw new Error(
                "LỆCH tại viewport=" + viewport + " sidebar=" + sidebar + " rightbar=" + rightbar + " collapsed=" + String(collapsedWidth) +
                  "\n  ta: " + JSON.stringify(mine) + "\n  gốc: " + JSON.stringify(theirs),
              );
            }
            compared += 1;
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(13000);
  });

  test("nút hành vi hợp đồng: thanh bên không nhường, cột phải nhường trước", () => {
    // 1. Thanh bên LUÔN bị kẹp vào [264, 420], không co theo khung hẹp.
    expect(computeColumns(800, 900, 0).sidebar).toBe(SIDEBAR_MAX);
    expect(computeColumns(320, 100, 0).sidebar).toBe(SIDEBAR_MIN);
    // 2. sidebar = 0 ⇒ lấy bề rộng ray (mặc định 56), hoặc 0 khi khung tự ẩn cột.
    expect(computeColumns(1440, 0, 0).sidebar).toBe(SIDEBAR_COLLAPSED);
    expect(computeColumns(1440, 0, 0, 0).sidebar).toBe(0);
    // 3. Cột phải chỉ có track khi còn ít nhất 300px cho nó SAU khi cột giữa giữ đủ 400.
    expect(computeColumns(1440, 280, 0).rightbar).toBe(0);
    expect(computeColumns(1440, 280, 500).rightbar).toBe(500);
    // Ở 1440: chỗ còn lại cho cột phải sau khi giữ 400 cho giữa là 760 ⇒ TRẦN THEO CHỖ TRỐNG thắng trần tỉ lệ.
    expect(computeColumns(1440, 280, 5000).rightbar).toBe(1440 - 280 - CENTER_MIN);
    // Khung rộng thì trần TỈ LỆ mới thắng: 2560 - 280 - 400 = 1880 > 1792 = 0,7 × 2560.
    expect(computeColumns(2560, 280, 5000).rightbar).toBe(Math.round(2560 * RIGHTBAR_MAX_RATIO));
    // 4. Hẹp quá thì cột phải mất track TRƯỚC, cột giữa mới được xuống dưới 400.
    // Ngưỡng thật: cột phải mất track khi chỗ còn lại < 300, tức viewport < sidebar + 700.
    expect(computeColumns(980, 280, 500)).toEqual({ sidebar: 280, center: 400, rightbar: 300 });
    expect(computeColumns(979, 280, 500)).toEqual({ sidebar: 280, center: 699, rightbar: 0 });
    expect(computeColumns(950, 280, 500)).toEqual({ sidebar: 280, center: 670, rightbar: 0 });
    // 5. Cột giữa không bao giờ âm.
    expect(computeColumns(200, 420, 0).center).toBe(0);
  });
});

/** `defineStore` giả: đủ để chạy store gốc và store của ta trên CÙNG một khung. */
function makeDefineStore() {
  return (spec: { init: () => unknown; actions: Record<string, (draft: never, ...args: never[]) => void> }) => ({
    create: () => {
      const draft = spec.init();
      const actions: Record<string, (...args: unknown[]) => void> = {};
      for (const [name, fn] of Object.entries(spec.actions)) {
        actions[name] = (...args: unknown[]) => (fn as (d: unknown, ...rest: unknown[]) => void)(draft, ...args);
      }
      return { getSnapshot: () => draft, subscribe: () => () => undefined, actions };
    },
  });
}

/** Một bước kịch bản: tên action + tham số. */
type Step = [string, ...unknown[]];

/** Kịch bản quét: chạm mọi nhánh của store (kẹp biên, ngưỡng 1024, cột phải, toàn màn hình). */
const STEPS: Step[] = [
  ["selectPanel", "plugins"],
  ["retainMainPanels", ["chat"]],
  ["selectPanel", "chat"],
  ["retainMainPanels", ["chat", "plugins"]],
  ["setSidebar", 500],
  ["setSidebar", 100],
  ["setSidebar", 300.5],
  ["toggleSidebar"],
  ["toggleSidebar"],
  ["setViewportWidth", 1200],
  ["setViewportWidth", 1023],
  ["toggleSidebar"],
  ["setRightbar", 5000],
  ["openRightbar", true, false],
  ["openRightbar", false, true],
  ["closeRightbar"],
  ["openRightbar", true, false],
  ["setViewportWidth", 1024],
  ["setViewportWidth", 1440],
  ["setSidebar", 279.6],
];

describe("store khung — ĐỐI CHỨNG với bản gốc trên cùng kịch bản", () => {
  test("sau MỖI bước, ảnh chụp trạng thái giống hệt bản gốc", async () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = { innerWidth: 1440 };
    try {
      const source = await readFile(STOCK, "utf8");
      const defineStore = makeDefineStore();
      const stockFactory = new Function(
        "_deepseek_ai_dsh_client_store",
        "window",
        "const clampWidth = " + extractFunction(source, "clampWidth") + ";\n" +
          "const SIDEBAR_MIN = 264, SIDEBAR_MAX = 420, SIDEBAR_DEFAULT = 280;\n" +
          "const RIGHTBAR_DEFAULT_RATIO = " + String(RIGHTBAR_DEFAULT_RATIO) + ";\n" +
          "const RIGHTBAR_MAX_RATIO = " + String(RIGHTBAR_MAX_RATIO) + ", SIDEBAR_AUTO_COLLAPSE = " + String(SIDEBAR_AUTO_COLLAPSE) + ";\n" +
          extractFunction(source, "createLayoutStore") +
          "\nreturn createLayoutStore;",
      ) as (mod: unknown, win: unknown) => (defineStore: unknown) => unknown;
      // new Function(...) tra ve ham GOI: goi no de chay than bai va nhan createLayoutStore cua ban goc.
      const stockCreate = stockFactory({ defineStore }, globalThis.window) as () => {
        create: () => { getSnapshot: () => unknown; actions: Record<string, (...a: unknown[]) => void> };
      };
      const stockHandle = stockCreate();
      const mineHandle = createLayoutStore(makeDefineStore() as never) as {
        create: () => { getSnapshot: () => unknown; actions: Record<string, (...a: unknown[]) => void> };
      };
      const stock = stockHandle.create();
      const mine = mineHandle.create();
      for (const [name, ...args] of STEPS) {
        const stockAction = stock.actions[name];
        const mineAction = mine.actions[name];
        expect(typeof stockAction).toBe("function");
        expect(typeof mineAction).toBe("function");
        stockAction?.(...(args as unknown[]));
        mineAction?.(...(args as unknown[]));
        const where = name + "(" + args.map((a) => String(a)).join(", ") + ")";
        expect(JSON.stringify(mine.getSnapshot())).toBe(JSON.stringify(stock.getSnapshot()));
        expect(where.length).toBeGreaterThan(0);
      }
    } finally {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  });
});

describe("LayoutController — hợp đồng mặt ctx.layout", () => {
  /** Dựng controller với sổ `main` cho trước. */
  function makeController(registered: string[]) {
    const calls: string[] = [];
    const controller = new LayoutController(
      {
        selectPanel: (id) => calls.push("select:" + String(id)),
        toggleSidebar: () => calls.push("toggle"),
        openRightbar: (track, fullscreen) => calls.push("open:" + String(track) + ":" + String(fullscreen)),
        closeRightbar: () => calls.push("close"),
      },
      (id) => registered.includes(id),
      { getSnapshot: () => ({ activePanelId: null }), subscribe: () => () => undefined },
    );
    return { controller, calls };
  }

  test("chọn panel chưa đăng ký thì ném lỗi và KHÔNG ghi vào store", () => {
    const { controller, calls } = makeController(["chat"]);
    expect(() => controller.selectPanel("chua-co")).toThrow("is not registered");
    expect(calls).toEqual([]);
    controller.selectPanel("chat");
    controller.selectPanel(null);
    expect(calls).toEqual(["select:chat", "select:null"]);
  });

  test("beginNavigation huỷ tín hiệu cũ rồi mở tín hiệu mới; dispose huỷ tín hiệu đang mở", () => {
    const { controller } = makeController([]);
    const first = controller.beginNavigation();
    expect(first.aborted).toBe(false);
    const second = controller.beginNavigation();
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
    controller.dispose();
    expect(second.aborted).toBe(true);
  });

  test("ba lệnh hình học đi thẳng xuống action của store", () => {
    const { controller, calls } = makeController([]);
    controller.toggleSidebar();
    controller.openRightbar(true, false);
    controller.closeRightbar();
    expect(calls).toEqual(["toggle", "open:true:false", "close"]);
    expect(controller.panelInfo.getSnapshot()).toEqual({ activePanelId: null });
  });
});

/** DOM giả tối thiểu cho bộ chiếu theme: chỉ những gì nó thật sự chạm. */
function makeThemeDom() {
  const removed: string[] = [];
  const set = (bag: Record<string, string>) => ({
    setProperty: (name: string, value: string) => { bag[name] = value; },
    removeProperty: (name: string) => { delete bag[name]; removed.push(name); },
  });
  const rootStyle: Record<string, string> = {};
  const bodyStyle: Record<string, string> = {};
  const rootAttributes: Record<string, string> = {};
  const bodyAttributes: Record<string, string> = {};
  const headAppended: unknown[] = [];
  const meta = { name: "", content: "", isConnected: false, remove: () => { meta.isConnected = false; } };
  const dom = {
    documentElement: {
      style: { ...set(rootStyle), colorScheme: "" },
      setAttribute: (name: string, value: string) => { rootAttributes[name] = value; },
      removeAttribute: (name: string) => { delete rootAttributes[name]; removed.push(name); },
    },
    body: {
      style: set(bodyStyle),
      setAttribute: (name: string, value: string) => { bodyAttributes[name] = value; },
      removeAttribute: (name: string) => { delete bodyAttributes[name]; removed.push(name); },
    },
    head: { append: (node: unknown) => { headAppended.push(node); meta.isConnected = true; } },
    createElement: () => meta,
    title: "",
  };
  return { dom, rootStyle, bodyStyle, rootAttributes, bodyAttributes, headAppended, meta, removed };
}

/** Ảnh chụp theme mẫu. */
const SNAPSHOT = {
  preference: "dark",
  active: { colorScheme: "dark", tokens: { "--dsw-alias-bg-base": "#111", "--dsw-alias-label-primary": "#eee" } },
  fontSizes: { text: 14, code: 13, terminal: 13 },
  fontFamilies: { text: "Inter, sans-serif", code: "", terminal: "" },
};

describe("bộ chiếu theme — ghi lên document", () => {
  test("áp ảnh chụp: scheme, nguồn theme, thuộc tính tối, cỡ chữ px, font, token, metadata", () => {
    const fake = makeThemeDom();
    const previousDocument = (globalThis as { document?: unknown }).document;
    const previousStyle = (globalThis as { getComputedStyle?: unknown }).getComputedStyle;
    (globalThis as { document?: unknown }).document = fake.dom;
    (globalThis as { getComputedStyle?: unknown }).getComputedStyle = () => ({ backgroundColor: "rgb(17, 17, 17)" });
    try {
      const presenter = new ThemePresenter();
      presenter.apply(SNAPSHOT as never);
      expect(fake.dom.documentElement.style.colorScheme).toBe("dark");
      expect(fake.rootAttributes["data-ds-theme-source"]).toBe("dark");
      expect(fake.bodyAttributes["data-ds-dark-theme"]).toBe("");
      expect(fake.bodyStyle["--dsh-content-font-size"]).toBe("14px");
      expect(fake.bodyStyle["--dsh-code-font-size"]).toBe("13px");
      expect(fake.bodyStyle["--dsh-font-family-text"]).toBe("Inter, sans-serif");
      // Danh sách font RỖNG ⇒ BỎ biến để dùng stack dựng sẵn.
      expect(fake.bodyStyle["--dsh-font-family-code"]).toBeUndefined();
      expect(fake.bodyStyle["--dsw-alias-bg-base"]).toBe("#111");
      expect(fake.meta.content).toBe("rgb(17, 17, 17)");
      expect(fake.headAppended.length).toBe(1);
      // Áp lần hai: token cũ phải được RÚT LẠI trước khi ghi tập mới.
      presenter.apply({ ...SNAPSHOT, preference: "system", active: { colorScheme: "light", tokens: { "--dsw-alias-bg-base": "#fff" } } } as never);
      expect(fake.bodyAttributes["data-ds-dark-theme"]).toBeUndefined();
      expect(fake.rootAttributes["data-ds-theme-source"]).toBe("system");
      expect(fake.bodyStyle["--dsw-alias-label-primary"]).toBeUndefined();
      expect(fake.bodyStyle["--dsw-alias-bg-base"]).toBe("#fff");
      expect(fake.headAppended.length).toBe(1);
      presenter.dispose();
      expect(fake.rootAttributes["data-ds-theme-source"]).toBeUndefined();
      expect(fake.bodyStyle["--dsw-alias-bg-base"]).toBeUndefined();
      expect(fake.bodyStyle["--dsh-content-font-size"]).toBeUndefined();
      expect(fake.meta.isConnected).toBe(false);
    } finally {
      (globalThis as { document?: unknown }).document = previousDocument;
      (globalThis as { getComputedStyle?: unknown }).getComputedStyle = previousStyle;
    }
  });
});

describe("tiêu đề trình duyệt", () => {
  test("theo panel giữa: hiện Hội thoại thì ghép tiêu đề phiên, ngược lại giữ tiêu đề sản phẩm; gỡ thì trả lại", () => {
    const fake = makeThemeDom();
    const previousDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = fake.dom;
    const cleanups: (() => void)[] = [];
    let showTitle = true;
    try {
      fake.dom.title = "Galaxy Blackhole";
      const Title = createDocumentTitle({ useEffect: (callback) => { const off = callback(); if (typeof off === "function") cleanups.push(off); } });
      const props = {
        usePanelInfo: () => showTitle,
        useSessions: () =>
          showTitle
            ? Object.values({ a: { title: "Phiên A", retainedBy: { mainView: 1 } } })[0]?.title
            : undefined,
        productTitle: "Galaxy Blackhole",
      };
      expect(Title(props)).toBeNull();
      expect(fake.dom.title).toBe("Phiên A — Galaxy Blackhole");
      for (const off of cleanups) off();
      expect(fake.dom.title).toBe("Galaxy Blackhole");
    } finally {
      (globalThis as { document?: unknown }).document = previousDocument;
    }
  });
});

/** Element giả: chỉ ghi type/props/key để soi cây. */
interface Element {
  /** Loại element. */
  type: unknown;
  /** Props. */
  props: Record<string, unknown>;
  /** Khoá. */
  key?: unknown;
}

/** jsx giả: KHÔNG render sâu — chỉ dựng cây element. */
function fakeJsx(type: unknown, props: Record<string, unknown>, key?: unknown): Element {
  return { type, props, key };
}

/** React giả có trạng thái + hook bố cục, đủ cho AppFrame. */
function makeFrameReact() {
  const states: unknown[] = [];
  const refs: Record<number, { current: unknown }> = {};
  const seen: Record<number, boolean> = {};
  let index = 0;
  return {
    reset: () => { index = 0; },
    react: {
      jsx: fakeJsx,
      jsxs: fakeJsx,
      Fragment: "Fragment",
      useState<T>(initial: T): [T, (next: T | ((previous: T) => T)) => void] {
        const at = index++;
        if (seen[at] !== true) { states[at] = initial; seen[at] = true; }
        return [states[at] as T, (next: T | ((previous: T) => T)) => {
          const previous = states[at] as T;
          states[at] = typeof next === "function" ? (next as (p: T) => T)(previous) : next;
        }];
      },
      useRef<T>(initial: T): { current: T } {
        const at = index++;
        refs[at] ??= { current: initial };
        return refs[at] as { current: T };
      },
      useEffect: (callback: () => void | (() => void)) => { callback(); },
      useLayoutEffect: (callback: () => void | (() => void)) => { callback(); },
      useCallback: <T>(callback: T) => callback,
      useMemo: <T>(factory: () => T) => factory(),
    },
  };
}

/** DOM giả cho AppFrame: đo khung, ResizeObserver, rAF. */
function makeFrameDom() {
  return {
    documentElement: {
      dataset: {} as Record<string, string>,
      hasAttribute: () => false,
      style: { colorScheme: "", setProperty: () => undefined, removeProperty: () => undefined },
      setAttribute: () => undefined,
      removeAttribute: () => undefined,
    },
    body: {
      style: { setProperty: () => undefined, removeProperty: () => undefined },
      setAttribute: () => undefined,
      removeAttribute: () => undefined,
    },
    head: { append: () => undefined, appendChild: () => undefined },
    querySelector: () => null,
    createElement: () => ({ dataset: {} as Record<string, string>, textContent: "", name: "", content: "", isConnected: false, remove: () => undefined }),
    title: "",
  };
}

describe("AppFrame — lưới, ô con và tay kéo", () => {
  /** Render AppFrame một lượt với DOM/global giả. */
  function renderFrame(overrides: Record<string, unknown> = {}) {
    const fake = makeFrameDom();
    const globals = globalThis as { document?: unknown; ResizeObserver?: unknown; requestAnimationFrame?: unknown; cancelAnimationFrame?: unknown };
    const previous = { document: globals.document, ResizeObserver: globals.ResizeObserver, requestAnimationFrame: globals.requestAnimationFrame, cancelAnimationFrame: globals.cancelAnimationFrame };
    globals.document = fake;
    globals.ResizeObserver = class { observe(): void {} disconnect(): void {} };
    globals.requestAnimationFrame = () => 1;
    globals.cancelAnimationFrame = () => undefined;
    const slots: { name: string; owner: Record<string, unknown>; options?: Record<string, unknown> }[] = [];
    const harness = makeFrameReact();
    const Frame = createAppFrame({
      react: harness.react as never,
      DocumentTitle: ((props: Record<string, unknown>) => ({ type: "DocumentTitle", props })) as never,
    });
    const layoutInfo = {
      sidebar: 300, viewportWidth: 1440, narrowExpanded: false, rightbar: 400,
      rightbarShown: true, rightbarTrack: true, rightbarFullscreen: false, rightbarInstant: false,
      ...((overrides.layoutInfo as Record<string, unknown> | undefined) ?? {}),
    };
    const props = {
      useStore: () => layoutInfo,
      useSessions: () => undefined,
      usePanelInfo: (select: (info: { activePanelId: string | null }) => unknown) => select({ activePanelId: null }),
      actions: { setViewportWidth: () => undefined, setSidebar: () => undefined, setRightbar: () => undefined },
      renderSlot: (name: string, owner: Record<string, unknown>, options?: Record<string, unknown>) => {
        slots.push({ name, owner, options });
        return { type: "slot:" + name, props: owner };
      },
      t: (key: string) => key,
    };
    harness.reset();
    const node = (Frame as unknown as (p: Record<string, unknown>) => Element)(props);
    const restore = () => {
      globals.document = previous.document;
      globals.ResizeObserver = previous.ResizeObserver;
      globals.requestAnimationFrame = previous.requestAnimationFrame;
      globals.cancelAnimationFrame = previous.cancelAnimationFrame;
    };
    return { node, slots, restore };
  }

  test("lưới: style cột, cờ dữ liệu và các ô con lấy đúng tham số", () => {
    const { node, slots, restore } = renderFrame();
    try {
      const style = node.props.style as Record<string, string>;
      expect(style.gridTemplateColumns).toBe("300px minmax(400px, 1fr) minmax(0px, 400px)");
      expect(node.props["data-sidebar-collapsed"]).toBeUndefined();
      const names = slots.map((slot) => slot.name);
      for (const name of ["sidebar", "rightbar", "shell.bottom", "shell.overlay"]) expect(names).toContain(name);
      expect(slots.find((slot) => slot.name === "sidebar")?.owner).toEqual({ collapsed: false, width: 300 });
      expect(slots.find((slot) => slot.name === "rightbar")?.owner).toEqual({ width: 400, viewportWidth: 1440, canShow: true });
      expect(node.props["data-rightbar-collapsed"]).toBeUndefined();
    } finally {
      restore();
    }
  });

  test("thanh bên đang thu: bật cờ dữ liệu và KHÔNG vẽ tay kéo thanh bên", () => {
    const { node, slots, restore } = renderFrame({ layoutInfo: { sidebar: 0, rightbarShown: false, rightbarTrack: false } });
    try {
      expect(node.props["data-sidebar-collapsed"]).toBe(true);
      // Đang thu ⇒ bề rộng là RAY (56), không phải 0: 0 chỉ khi darwin hoặc có dải tiêu đề Windows.
      expect(slots.find((slot) => slot.name === "sidebar")?.owner).toEqual({ collapsed: true, width: 56 });
      const kinds = ((node.props.children as unknown[]) ?? []).map((child) =>
        typeof child === "object" && child !== null && "type" in child ? String((child as Element).type) : "",
      );
      expect(kinds.filter((kind) => kind === "DragHandle").length).toBe(0);
      expect(node.props["data-rightbar-collapsed"]).toBe(true);
    } finally {
      restore();
    }
  });
});

describe("hang rao idempotent — boolean PHAM VI MODULE (chuan 17/10/2026)", () => {
  test("cung module: apply lan hai (KE CA ctx KHAC) la NO-OP; module TUOI thi cai lai duoc", async () => {
    // LUAT 17/10/2026: ca that do duoc la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})).
    // Vi vay cong khoa-theo-ctx (lastCtx/WeakSet) KHONG BAO GIO kich hoat ⇒ phai dung BOOLEAN PHAM VI MODULE.
    const fresh = await import("../../packages/client/ui-layout/src/plugin.ts?hangrao=" + String(Date.now()));
    const fake = makeFrameDom();
    const globals = globalThis as { document?: unknown; window?: unknown };
    const previousDocument = globals.document;
    const previousWindow = globals.window;
    globals.document = fake;
    globals.window = { innerWidth: 1440 };
    try {
      const requireFn = (specifier: string): unknown => {
        if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx, Fragment: "Fragment" };
        if (specifier === "react") return makeFrameReact().react;
        return { defineStore: makeDefineStore() };
      };
      const recorded: string[] = [];
      const makeCtx = () => ({
        effect: (callback: () => unknown, label: string) => { recorded.push(label); void callback; },
        on: () => () => undefined,
        locale: { register: () => () => undefined, bind: () => (key: string) => key },
        slots: { entries: () => [], provideRoot: () => () => undefined, register: () => () => undefined, subscribe: () => () => undefined },
        reflect: { provide: () => () => undefined },
        shortcuts: { register: () => () => undefined },
        theme: { getTheme: () => ({ preference: "light", active: { colorScheme: "light", tokens: {} }, fontSizes: {}, fontFamilies: {} }) },
      });
      const plugin = (fresh.createPlugin as (r: (s: string) => unknown) => { apply: (c: unknown) => void })(requireFn);
      const ctx = makeCtx();
      plugin.apply(ctx);
      expect(recorded.length).toBe(3);
      // Lan goi thu hai TRONG CUNG MODULE = dung ca production (bundle hai id goi factory hai lan).
      plugin.apply(ctx);
      expect(recorded.length).toBe(3);
      // CTX KHAC nhung CUNG MODULE ⇒ VAN NO-OP: diem khac can ban so voi chuan lastCtx cu.
      plugin.apply(makeCtx());
      expect(recorded.length).toBe(3);
      // MODULE TUOI (import moi ⇒ pham vi module moi) ⇒ cai lai duoc, khong bi chan toan cuc.
      const fresh2 = await import("../../packages/client/ui-layout/src/plugin.ts?hangrao2=" + String(Date.now()));
      const plugin2 = (fresh2.createPlugin as (r: (s: string) => unknown) => { apply: (c: unknown) => void })(requireFn);
      plugin2.apply(makeCtx());
      expect(recorded.length).toBe(6);
    } finally {
      globals.document = previousDocument;
      globals.window = previousWindow;
    }
  });
});

describe("khuôn bundle — script classic, MOT id (id gốc ở gbh.row.aliases)", () => {
  test("đăng ký ĐÚNG MỘT id, không có cú pháp ESM, có CSS khung", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-layout-"));
    const built = await buildPackage(out);
    const code = await readFile(built.client, "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual(["@galaxy-blackhole/gbh-client-ui-layout"]);   // LUAT 17/10/2026: bundle chi tu khai MOT id
    const meta = (await Bun.file(join(import.meta.dir, "../../packages/client/ui-layout/package.json")).json()) as { gbh: { row: { aliases: string[] } } };
    expect(meta.gbh.row.aliases).toContain("@deepseek-ai/dsh-client-ui-layout");
    const factories = [...code.matchAll(/factory: (\w+)/g)].map((m) => m[1]);
    expect(new Set(factories).size).toBe(1);
    expect(/^\s*(export|import)\s/m.test(code)).toBe(false);
    expect(code).toContain("pI_x6G_frame");
  });

  test("chạy bundle trong window giả: mặt plugin đúng tên, ĐÚNG BỐN seam, ba specifier đúng thứ tự", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-layout-"));
    const built = await buildPackage(out);
    const code = await readFile(built.client, "utf8");
    const registrations: { factory: (require: (s: string) => unknown) => { name: string; inject: readonly string[] } }[] = [];
    new Function("window", code)({ __ModuleLoader__: { load: (registration: never) => registrations.push(registration) } });
    const required: string[] = [];
    const plugin = registrations[0]?.factory((specifier) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
      required.push(specifier);
      if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx, Fragment: "Fragment" };
      if (specifier === "react") return makeFrameReact().react;
      return { defineStore: makeDefineStore() };
    });
    expect(plugin?.name).toBe("@galaxy-blackhole/gbh-client-ui-layout");
    // Bản gốc: inject = ["slots","theme","locale","shortcuts"] — BỐN, khác manifest (5 id).
    expect(plugin?.inject).toEqual(["slots", "theme", "locale", "shortcuts"]);
    expect(required).toEqual(["react/jsx-runtime", "react", "@deepseek-ai/dsh-client-store"]);
  });
});

describe("test canh — CSS khung phải TRÙNG NGUYÊN VĂN bản gốc", () => {
  test("bỏ khoảng trắng thì khớp tuyệt đối, và ngoặc cân bằng", async () => {
    const source = await readFile(STOCK, "utf8");
    const match = /const css = ("(?:[^"\\]|\\.)*");/.exec(source);
    expect(match).not.toBeNull();
    const original = JSON.parse((match?.[1] as string) ?? '""') as string;
    const mine = await readFile(join(import.meta.dir, "..", "..", "packages", "client", "ui-layout", "src", "AppFrame.module.css"), "utf8");
    const body = mine.split("*/")[1] ?? "";
    const squash = (text: string): string => text.split(/\s+/).join("");
    expect(squash(body)).toBe(squash(original));
    expect((body.match(/\{/g) ?? []).length).toBe((body.match(/\}/g) ?? []).length);
  });
});

describe("apply — nối dây đúng thứ tự bản gốc", () => {
  /** Ngữ cảnh giả ghi lại mọi lời gọi. */
  function makeLayoutCtx() {
    const record = {
      effects: [] as { label: string; run: () => unknown }[],
      dictionaries: [] as { ns: string; dicts: unknown }[],
      bound: [] as string[],
      onEvents: [] as string[],
      provides: [] as { name: string; value: unknown }[],
      rootShares: [] as unknown[],
      registrations: [] as { options: Record<string, unknown>; component: unknown }[],
      shortcuts: [] as Record<string, unknown>[],
      subscriptions: [] as string[],
      cleanups: [] as string[],
      effectCleanups: [] as { label: string; cleanup: () => void }[],
    };
    const ctx = {
      effect: (callback: () => unknown, label: string) => {
        record.effects.push({ label, run: callback });
        const cleanup = callback();
        if (typeof cleanup === "function") record.effectCleanups.push({ label, cleanup: cleanup as () => void });
      },
      on: (event: string, _listener: unknown) => { record.onEvents.push(event); return () => record.cleanups.push("off"); },
      locale: {
        register: (ns: string, dicts: unknown) => { record.dictionaries.push({ ns, dicts }); return () => record.cleanups.push("locale"); },
        bind: (ns: string) => { record.bound.push(ns); return (key: string) => "«" + key + "»"; },
      },
      slots: {
        entries: (name: string) => (name === "main" ? [{ options: { key: "plugins" } }, { options: {} }] : []),
        provideRoot: (share: unknown) => { record.rootShares.push(share); return () => record.cleanups.push("rootShare"); },
        register: (options: Record<string, unknown>, component: unknown) => { record.registrations.push({ options, component }); return () => record.cleanups.push("register"); },
        subscribe: (name: string, _listener: unknown) => { record.subscriptions.push(name); return () => record.cleanups.push("subscribe"); },
      },
      reflect: { provide: (name: string, value: unknown) => { record.provides.push({ name, value }); return () => record.cleanups.push("provide"); } },
      shortcuts: { register: (spec: Record<string, unknown>) => { record.shortcuts.push(spec); return () => record.cleanups.push("shortcut"); } },
      theme: { getTheme: () => ({ preference: "light", active: { colorScheme: "light", tokens: {} }, fontSizes: {}, fontFamilies: {} }) },
    };
    return { ctx, record };
  }

  test("ba hiệu ứng đúng nhãn, và hiệu ứng service dựng store + dịch vụ + ô root + phím tắt", () => {
    const fake = makeFrameDom();
    const globals = globalThis as { document?: unknown; window?: unknown; getComputedStyle?: unknown };
    const previousDocument = globals.document;
    const previousWindow = globals.window;
    const previousStyle = globals.getComputedStyle;
    globals.document = fake;
    // Store của khung đọc window.innerWidth lúc init (nguyên hành vi bản gốc).
    globals.window = { innerWidth: 1440 };
    globals.getComputedStyle = () => ({ backgroundColor: "rgb(0, 0, 0)" });
    try {
      const plugin = createPlugin((specifier) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
        if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx, Fragment: "Fragment" };
        if (specifier === "react") return makeFrameReact().react;
        return { defineStore: makeDefineStore() };
      });
      const { ctx, record } = makeLayoutCtx();
      (plugin.apply as unknown as (c: unknown) => void)(ctx);
      expect(record.effects.map((effect) => effect.label)).toEqual([
        "layout: command labels",
        "ui-layout: service + root registration",
        "ui-layout: theme presenter",
      ]);
      expect(record.dictionaries[0]?.ns).toBe("shortcuts.layout");
      expect(record.bound).toEqual(["shortcuts.layout"]);
      // Hiệu ứng service.
      const cleanup = record.effectCleanups.find((entry) => entry.label === "ui-layout: service + root registration")?.cleanup;
      expect(record.rootShares.length).toBe(1);
      expect(record.provides.map((entry) => entry.name)).toEqual(["layout"]);
      const options = record.registrations[0]?.options ?? {};
      expect(options.name).toBe("root");
      expect(options.locale).toBe("common");
      expect(Object.keys((options.children as Record<string, unknown>) ?? {})).toEqual([
        "sidebar",
        "main",
        "rightbar",
        "shell.bottom",
        "shell.overlay",
        "shell.leading",
      ]);
      expect((options.children as Record<string, { kind: string }>)["main"]?.kind).toBe("keyed");
      expect((options.children as Record<string, { kind: string }>)["shell.overlay"]?.kind).toBe("list");
      expect(options.store).toBeDefined();
      expect(record.subscriptions).toEqual(["main"]);
      const shortcut = record.shortcuts[0] ?? {};
      expect(shortcut.id).toBe("sidebar.left.toggle");
      expect((shortcut.label as () => string)()).toBe("«toggle»");
      expect(shortcut.aliases).toEqual(["sidebar", "toggle left sidebar"]);
      expect(shortcut.regions).toEqual(["page", "editable"]);
      expect(Object.keys((shortcut.defaults as Record<string, unknown>) ?? {}).length).toBe(5);
      // Phím tắt chạy ⇒ gọi toggleSidebar của controller (không ném).
      const resolved = (shortcut.resolve as () => { status: string; run: () => void })();
      expect(resolved.status).toBe("handled");
      resolved.run();
      // Dọn dẹp đúng thứ tự và đủ sáu hàm.
      expect(typeof cleanup).toBe("function");
      cleanup?.();
      expect(record.cleanups).toEqual(["shortcut", "subscribe", "register", "rootShare", "provide"]);
      // Hiệu ứng theme: áp ảnh chụp đầu và nghe theme/change.
      const themeCleanup = record.effectCleanups.find((entry) => entry.label === "ui-layout: theme presenter")?.cleanup;
      expect(record.onEvents).toEqual(["theme/change"]);
      themeCleanup?.();
      expect(record.cleanups).toContain("off");
    } finally {
      globals.document = previousDocument;
      globals.window = previousWindow;
      globals.getComputedStyle = previousStyle;
    }
  });
});
