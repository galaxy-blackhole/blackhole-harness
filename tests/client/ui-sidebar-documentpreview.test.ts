/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test nửa browser của row ui-sidebar-documentpreview: một-id · MƯỜI HAI slot đúng tên bản gốc ·
 *      key = id kiểu tab (KEYED) · hợp đồng store đầy đủ cho slot của gói khác · ba chunk nội bộ · cổng idempotent.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/client/ui-sidebar-documentpreview/build.ts";

/** Id mà bundle ĐƯỢC PHÉP đăng ký (đúng một) — luật MỘT-ID của docs/recipes/HOST-ROW-REWRITE.md. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-sidebar-documentpreview";

/** Id gói GỐC — chỉ được khai ở gbh.row.aliases, KHÔNG bao giờ đăng ký trong bundle. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";

/** Thư mục gói của ta trong repo. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-sidebar-documentpreview");

/** Thư mục gói GỐC trong runtime của app (chỉ đọc — nguồn đối chứng). */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-sidebar-documentpreview");

/** Id người ngồi của tám bản xem dựng sẵn. */
const OCCUPANT_IDS = [
  PACKAGE_NAME + "/text",
  PACKAGE_NAME + "/markdown",
  PACKAGE_NAME + "/html",
  PACKAGE_NAME + "/image",
  PACKAGE_NAME + "/pdf",
  PACKAGE_NAME + "/code",
  PACKAGE_NAME + "/office",
  PACKAGE_NAME + "/excel",
];

/** Ba chunk nội bộ mà build.ts chép nguyên văn từ gói gốc (đổi mỗi dòng id). */
const STOCK_CHUNKS = ["client.pdf.js", "client.excel.js", "client.frontmatter-fields.js"];

/* Build MỘT lần vào thư mục tạm: ca test đo ARTIFACT THẬT, và đo luôn hợp đồng buildPackage(outDir). */
const OUT = mkdtempSync(join(tmpdir(), "gbh-ui-sidebar-documentpreview-"));
await buildPackage(OUT);

/** Một đăng ký bắt được từ bundle. */
interface Registration {
  /** Id module mà bundle tự khai. */
  id: string;
  /** Factory của bundle. */
  factory: (require: (spec: string) => unknown) => unknown;
}

/** Một bản cài đặt bản xem đã đăng ký. */
interface PreviewDefinition {
  /** Id bản cài đặt. */
  id: string;
  /** Hậu tố nhận. */
  extensions: readonly string[];
  /** Chế độ nạp. */
  loading: string;
  /** Có tự lo ngắt dòng không. */
  wrap: boolean;
}

/** Sổ bản xem mà plugin công bố qua reflect.provide. */
interface RegistryLike {
  /** Ảnh chụp các bản cài đặt. */
  getSnapshot(): readonly PreviewDefinition[];
  /** Quan sát thay đổi. */
  subscribe(listener: () => void): () => void;
}

/** Những gì plugin đăng ký với context giả. */
interface Recorded {
  /** Từ điển theo namespace. */
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
  /** Kiểu tab của sidebar phải. */
  tabTypes: Record<string, unknown>[];
  /** Chỗ ngồi: slot · spec · component. */
  slots: { slot: string; definition: Record<string, unknown>; component: unknown }[];
  /** Những gì reflect.provide đã công bố. */
  provided: { name: string; value: unknown }[];
}

/** Một bảng ghi rỗng. */
function emptyRecorded(): Recorded {
  return { dictionaries: [], tabTypes: [], slots: [], provided: [] };
}

/**
 * Nạp một bundle .js đã build trong window giả.
 * Nhận: code — nội dung artifact (script classic).
 * Trả: các đăng ký mà bundle đã gọi.
 */
function loadBundle(code: string): Registration[] {
  const seen: Registration[] = [];
  const fakeWindow = { __ModuleLoader__: { load: (registration: Registration): void => { seen.push(registration); } } };
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = fakeWindow;
  try {
    new Function(code)();
  } finally {
    (globalThis as { window?: unknown }).window = previous;
  }
  return seen;
}

/**
 * Rút tên slot bằng ĐÚNG hai regex của tools/check/rows.ts.
 * Nhận: text — mã nguồn hoặc bản build.
 * Trả: tập tên slot.
 */
function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  return out;
}

/**
 * Đọc mọi file .ts trong một thư mục.
 * Nhận: dir — thư mục cần quét.
 * Trả: nội dung gộp.
 */
function readAllTs(dir: string): string {
  let out = "";
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out += readAllTs(full);
    else if (name.endsWith(".ts")) out += readFileSync(full, "utf8");
  }
  return out;
}

/**
 * Dựng bảng module giả: react · jsx-runtime · primitives · store.
 * Nhận: không.
 * Trả: hàm require giả.
 */
function fakeRequire(): (spec: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown>): unknown => ({ type, props });
  const react = {
    useState: <T,>(initial: T): [T, (next: T) => void] => [initial, () => {}],
    useRef: <T,>(initial: T): { current: T } => ({ current: initial }),
    useEffect: (): void => {},
    useLayoutEffect: (): void => {},
    useMemo: <T,>(factory: () => T): T => factory(),
    useCallback: <T,>(callback: T): T => callback,
    useImperativeHandle: (): void => {},
    useId: (): string => "test",
    Suspense: "Suspense",
    lazy: (): unknown => "Lazy",
    forwardRef: (render: unknown): unknown => render,
    createElement: jsx,
  };
  const primitives = new Proxy({}, {
    get: (_target, key) => {
      const name = String(key);
      if (name === "classifyFileType" || name === "languageForPath") return () => "text";
      if (name === "CODE_HIGHLIGHT_EXTENSIONS") return ["ts", "js"];
      if (name === "useAnchoredPosition") return () => null;
      if (name === "useDismissOnOutsidePointer") return () => {};
      return name;
    },
  });
  const storeModule = {
    defineStore: (spec: { init: () => unknown; actions: Record<string, unknown> }) => ({
      getSnapshot: (): unknown => spec.init(),
      subscribe: (): (() => void) => () => {},
      actions: Object.fromEntries(Object.keys(spec.actions).map((name) => [name, (): void => {}])),
    }),
    notifySubscribers: (): void => {},
  };
  return (spec: string): unknown => {
    if (spec === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (spec === "react") return react;
    if (spec === "react-dom") return { createPortal: (children: unknown) => children };
    if (spec .endsWith("-client-ui-primitives")) return primitives;
    if (spec .endsWith("-client-store")) return storeModule;
    throw new Error("bang module gia: khong biet " + spec);
  };
}

/**
 * Dựng context giả đầy đủ seam mà plugin cần.
 * Nhận: recorded — bảng ghi.
 * Trả: context giả.
 */
function buildCtx(recorded: Recorded): unknown {
  const ctx: Record<string, unknown> = {
    effect: (callback: () => unknown): unknown => callback(),
    inject: (_deps: readonly string[], callback: (scope: unknown) => void): void => callback(ctx),
    reflect: { provide: (name: string, value: unknown): (() => void) => { recorded.provided.push({ name, value }); return () => {}; } },
    slots: {
      inject: (_slot: string, register: () => unknown): unknown => register(),
      register: (definition: Record<string, unknown>, component: unknown): unknown => {
        recorded.slots.push({ slot: definition.name as string, definition, component });
        return undefined;
      },
    },
    locale: {
      register: (namespace: string, copy: Record<string, Record<string, string>>): void => { recorded.dictionaries.push({ namespace, copy }); },
      bind: (namespace: string) => (key: string, params?: Record<string, string | number>) => namespace + ":" + key + (params === undefined ? "" : JSON.stringify(params)),
    },
    sidebarRightTabs: { register: (definition: Record<string, unknown>): void => { recorded.tabTypes.push(definition); } },
    resources: { source: () => ({ getSnapshot: () => ({ status: "none" }), subscribe: () => () => {} }) },
    remote: {
      workspaceFiles: {
        read: async () => ({ ok: false, error: { code: "workspace-file/not-found", message: "x" } }),
        readBytes: async () => ({ ok: false, error: { code: "workspace-file/not-found", message: "x" } }),
        stat: async () => ({ ok: false, error: { code: "workspace-file/not-found", message: "x" } }),
      },
      officeToPdf: { render: async () => ({ ok: false, error: { code: "x", message: "x" } }), generation: async () => ({ ok: false, error: { code: "x", message: "x" } }) },
    },
    configForms: { developerTools: { enabled: false } },
    on: (): void => {},
  };
  return ctx;
}

/**
 * Dựng plugin từ factory (ĐÚNG như bảng module memo hoá factory: một lần gọi = một phạm vi module).
 * Nhận: factory — factory của bundle.
 * Trả: plugin và hai lần cài trên hai ctx khác nhau.
 */
function installTwice(factory: Registration["factory"]): { plugin: { apply(ctx: unknown): void }; first: Recorded; second: Recorded } {
  const plugin = factory(fakeRequire()) as { apply(ctx: unknown): void };
  const first = emptyRecorded();
  plugin.apply(buildCtx(first));
  const second = emptyRecorded();
  plugin.apply(buildCtx(second));
  return { plugin, first, second };
}

/**
 * Cài plugin một lần và trả bảng ghi.
 * Nhận: factory — factory của bundle.
 * Trả: bảng ghi của lần cài đầu.
 */
function install(factory: Registration["factory"]): Recorded {
  return installTwice(factory).first;
}

/**
 * Lấy sổ bản xem mà plugin đã công bố.
 * Nhận: recorded — bảng ghi.
 * Trả: sổ bản xem.
 */
function registryOf(recorded: Recorded): RegistryLike {
  const entry = recorded.provided.find((item) => item.name === "documentPreviews");
  return entry?.value as RegistryLike;
}

/** Artifact nửa client đã build trong thư mục tạm. */
const CLIENT = readFileSync(join(OUT, "client.js"), "utf8");

describe("ui-sidebar-documentpreview: artifact", () => {
  test("bundle đăng ký ĐÚNG MỘT id — id của ta; id gói gốc = 0", () => {
    const registrations = loadBundle(CLIENT);
    expect(registrations.length).toBe(1);
    expect(registrations[0]?.id).toBe(PACKAGE_NAME);
    expect(CLIENT.includes('id: "' + STOCK_NAME + '"')).toBe(false);
    expect((CLIENT.match(/id:\s*"@deepseek-ai/g) ?? []).length).toBe(0);
  });

  test("artifact đăng ký ĐỦ MƯỜI HAI slot (register) và MƯỜI HAI inject, đúng như bản gốc", () => {
    expect((CLIENT.match(/slots\s*\.\s*register\s*\(/g) ?? []).length).toBe(12);
    expect((CLIENT.match(/slots\s*\.\s*inject\s*\(/g) ?? []).length).toBe(12);
    expect((CLIENT.match(/sidebarRightTabs\s*\.\s*register\s*\(/g) ?? []).length).toBe(1);
  });

  test("TẬP slot của ta BẰNG ĐÚNG tập slot của bundle gốc (chính hai regex của check:rows)", () => {
    const theirs = slotNames(readFileSync(join(STOCK, "lib", "client.js"), "utf8"));
    const ours = slotNames(readAllTs(join(OURS, "src")));
    expect(ours.size).toBeGreaterThan(0);
    expect([...ours].sort()).toEqual([...theirs].sort());
  });

  test("ba chunk nội bộ (PDF · bảng tính · trường frontmatter) có mặt và mang id CỦA TA", () => {
    for (const name of STOCK_CHUNKS) {
      const text = readFileSync(join(OUT, name), "utf8");
      expect(text.includes('id: "' + PACKAGE_NAME + '"')).toBe(true);
      expect(text.includes('id: "' + STOCK_NAME + '"')).toBe(false);
    }
  });

  test("CSS: mười module được nhúng NGUYÊN VĂN, giữ nguyên hash lớp gốc", () => {
    const hashes = ["tKrPPq_", "dhJKeW_", "_0RKuNG_", "HyIruq_", "lyqg2a_", "rIfSMq_", "JFRUHG_", "Java6a_", "Ku8BfW_", "JqwYuG_"];
    for (const hash of hashes) expect(CLIENT.includes(hash)).toBe(true);
    const stockCss = readFileSync(join(STOCK, "lib", "client.js"), "utf8");
    for (const hash of hashes) expect(stockCss.includes(hash)).toBe(true);
  });
});

describe("ui-sidebar-documentpreview: hợp đồng chỗ ngồi", () => {
  test("KEYED: key của sidebar.right.pane.tab BẰNG id của định nghĩa loại tab", () => {
    const registrations = loadBundle(CLIENT);
    const recorded = install(registrations[0]?.factory as Registration["factory"]);
    const typeIds = recorded.tabTypes.map((definition) => definition.id as string);
    expect(typeIds).toEqual([PACKAGE_NAME]);
    const paneTab = recorded.slots.filter((entry) => entry.slot === "sidebar.right.pane.tab");
    expect(paneTab.length).toBe(1);
    // Bản gốc dùng MỘT giá trị cho cả hai; lệch ⇒ renderer rơi vào fallback ⇒ tab hiện 'không khả dụng' mà KHÔNG có lỗi console.
    expect(paneTab[0]?.definition.key).toBe(typeIds[0]);
    const title = recorded.slots.filter((entry) => entry.slot === "sidebar.right.pane.tab.title");
    expect(title.length).toBe(1);
    expect(title[0]?.definition.key).toBe(typeIds[0]);
  });

  test("hợp đồng STORE: store cấp cho slot của gói khác có ĐỦ getSnapshot · subscribe · actions", () => {
    const registrations = loadBundle(CLIENT);
    const recorded = install(registrations[0]?.factory as Registration["factory"]);
    const paneTab = recorded.slots.find((entry) => entry.slot === "sidebar.right.pane.tab");
    const store = paneTab?.definition.store as { getSnapshot?: () => unknown; subscribe?: unknown; actions?: Record<string, unknown> } | undefined;
    expect(store).toBeDefined();
    // Thiếu một trong ba ⇒ renderer của gói khác ném TypeError ⇒ CẢ thanh bên không vẽ.
    expect(typeof store?.getSnapshot).toBe("function");
    expect(typeof store?.subscribe).toBe("function");
    const actions = store?.actions ?? {};
    for (const name of ["toggledAutoRefresh", "resourceChanged", "selected", "loading", "rendered", "rendererFailed", "complete", "page", "failed", "reset", "scrolled", "toggledWrap", "navigated", "forget"]) {
      expect(typeof actions[name]).toBe("function");
    }
    const snapshot = store?.getSnapshot?.() as { byTab?: unknown };
    expect(typeof snapshot?.byTab).toBe("object");
  });

  test("component là THAM SỐ THỨ HAI của register(spec, Component)", () => {
    const registrations = loadBundle(CLIENT);
    const recorded = install(registrations[0]?.factory as Registration["factory"]);
    expect(recorded.slots.length).toBe(12);
    for (const entry of recorded.slots) expect(entry.component).toBeDefined();
  });

  test("slot CON khai đúng bốn slot con mà bản gốc khai trên sidebar.right.pane.tab", () => {
    const registrations = loadBundle(CLIENT);
    const recorded = install(registrations[0]?.factory as Registration["factory"]);
    const paneTab = recorded.slots.find((entry) => entry.slot === "sidebar.right.pane.tab");
    const children = paneTab?.definition.children as Record<string, { kind: string; scope: string }>;
    expect(Object.keys(children).sort()).toEqual([
      "sidebar.right.tab.document",
      "sidebar.right.tab.document.action",
      "sidebar.right.tab.document.actions",
      "sidebar.right.tab.document.unpreviewable",
    ]);
    expect(children["sidebar.right.tab.document"]!.kind).toBe("keyed");
    expect(children["sidebar.right.tab.document.actions"]!.kind).toBe("list");
    expect(children["sidebar.right.tab.document.action"]!.kind).toBe("keyed");
  });

  test("tám bản xem dựng sẵn đăng ký đủ id, và kiểu tab 'text' giữ nguyên pattern của bản gốc", () => {
    const registrations = loadBundle(CLIENT);
    const recorded = install(registrations[0]?.factory as Registration["factory"]);
    const registry = registryOf(recorded);
    const ids = registry.getSnapshot().map((definition) => definition.id).sort();
    expect(ids).toEqual([...OCCUPANT_IDS].sort());
    for (const definition of registry.getSnapshot()) {
      expect(definition.wrap === true || definition.wrap === false).toBe(true);
      expect(["text-pages", "bytes-complete", "renderer"]).toContain(definition.loading);
    }
    const type = recorded.tabTypes[0] as { id: string; kind: string; priority: string; patterns: string[] };
    expect(type.id).toBe(PACKAGE_NAME);
    expect(type.kind).toBe("text");
    expect(type.priority).toBe("fallback");
    // 19/10/2026: goi nhan CA HAI scheme (gbh- truoc, dsh- sau) - dung nhu src/definition.ts.
    expect(type.patterns).toEqual(["gbh-resource://file/[\\s\\S]+", "dsh-resource://file/[\\s\\S]+"]);
  });

  test("cổng chặn cài hai lần nằm ở PHẠM VI MODULE: apply lần hai không đăng ký lại chỗ ngồi nào", () => {
    const registrations = loadBundle(CLIENT);
    const { first, second } = installTwice(registrations[0]?.factory as Registration["factory"]);
    expect(first.slots.length).toBe(12);
    expect(first.tabTypes.length).toBe(1);
    expect(second.slots.length).toBe(0);
    expect(second.tabTypes.length).toBe(0);
  });

  test("id người ngồi của loại tab = tên package (một giá trị cho cả key lẫn kind)", () => {
    const registrations = loadBundle(CLIENT);
    const recorded = install(registrations[0]?.factory as Registration["factory"]);
    const type = recorded.tabTypes[0] as { id: string };
    expect(type.id).toBe(PACKAGE_NAME);
  });

  test("từ điển: tám namespace, mỗi namespace đủ hai ngữ và đủ khoá hai bên", () => {
    const registrations = loadBundle(CLIENT);
    const recorded = install(registrations[0]?.factory as Registration["factory"]);
    const names = recorded.dictionaries.map((entry) => entry.namespace).sort();
    expect(names).toEqual(["documentHtml", "documentMarkdown", "sidebarCodePreview", "sidebarDocumentPreview", "sidebarExcel", "sidebarImage", "sidebarOffice", "sidebarPdf"]);
    for (const entry of recorded.dictionaries) {
      expect(Object.keys(entry.copy.zh ?? {}).sort()).toEqual(Object.keys(entry.copy.en ?? {}).sort());
    }
    const main = recorded.dictionaries.find((entry) => entry.namespace === "sidebarDocumentPreview");
    expect(Object.keys(main?.copy.zh ?? {}).length).toBe(22);
  });
});
