/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test doi chung cho @galaxy-blackhole/gbh-client-ui-shortcuts: luat mot-id, tap slot nguyen van,
 *      cong chan cai hai lan, tu dien zh/en, CSS NGUYEN VAN tung byte, va CAY RENDER so voi chinh bundle goc
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { CSS_TEXT, injectStyles } from "../../packages/client/ui-shortcuts/src/css.ts";
import { CLASS } from "../../packages/client/ui-shortcuts/src/class-names.ts";
import { STYLE_TAG } from "../../packages/client/ui-shortcuts/src/ids.ts";

/** Thu muc goi cua ta. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-shortcuts");
/** Thu muc goi goc trong cay runtime DSH (chi doc). */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-shortcuts");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-shortcuts";
/** Ten package goc — CHI duoc khai o gbh.row.aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-shortcuts";
/** Bon goi ma ban goc khai o dsh.client.inject — phai giu nguyen van. */
const STOCK_CLIENT_INJECT = [
  "@deepseek-ai/dsh-client-shortcuts",
  "@deepseek-ai/dsh-client-locale",
  "@deepseek-ai/dsh-client-ui-layout",
  "@deepseek-ai/dsh-client-ui-settings",
];

/** Ma nguon bundle goc. */
const STOCK_CODE = readFileSync(join(STOCK, "lib", "client.js"), "utf8");

/** Mot dang ky bat duoc tu bundle. */
interface Registration {
  /** Id bundle tu khai. */
  id: string;
  /** Factory cua bundle. */
  factory: (require: (spec: string) => unknown) => Record<string, unknown>;
}

/** Ban ghi cua context gia (dung cho CA HAI ben: ta va goc). */
interface Recorder {
  /** Nhan hieu ung, theo thu tu goi. */
  effects: string[];
  /** Ten slot da inject. */
  injected: string[];
  /** Cac lan register kem ca hai tham so. */
  registered: { spec: Record<string, unknown>; component: unknown }[];
  /** Tu dien da dang ky. */
  dictionaries: { ns: string; copy: Record<string, Record<string, string>> }[];
  /** Lenh menu co dinh da dang ky. */
  fixed: Record<string, unknown>[];
  /** Lenh thuong da dang ky. */
  commands: Record<string, unknown>[];
  /** Spec ma defineStore nhan (init + actions). */
  storeSpecs: { init: () => unknown; actions: Record<string, unknown> }[];
}

/** Cong tac bat/tat loi cua slots.register (ca test cong idempotent). */
interface Switch {
  /** true thi slots.register nem (mo phong lan cai dau hong giua duong). */
  failRegister: boolean;
}

/** Lenh da dang ky (chi phan test doc). */
interface CommandLike extends Record<string, unknown> {
  /** Id lenh. */
  id: string;
  /** Nhan hien thi. */
  label: () => string;
  /** Ten goi khac. */
  aliases: readonly string[];
  /** To hop mac dinh. */
  defaults: Record<string, { code: string; modifiers: readonly string[] }>;
  /** Vung nhan phim. */
  regions: readonly string[];
  /** Modal con chay duoc. */
  modals: readonly string[];
  /** Quyet dinh chay theo modal. */
  resolve: (context: { modal: string | null }) => { status: string; reason?: string; run?: () => void };
}

/**
 * Nap mot bundle .js trong window gia roi lay loi goi dang ky (moi lan nap = module TƯƠI).
 * Nhan: path — duong dan bundle.
 * Tra: loi goi dang ky { id, factory }.
 */
function loadRegistration(path: string): Registration {
  const code = readFileSync(path, "utf8");
  const seen: Registration[] = [];
  const fakeWindow = { __ModuleLoader__: { load: (registration: Registration): void => { seen.push(registration); } } };
  new Function("window", code)(fakeWindow);
  const first = seen[0];
  if (first === undefined) throw new Error("bundle khong dang ky gi: " + path);
  if (seen.length !== 1) throw new Error("bundle dang ky " + seen.length + " id: " + path);
  return first;
}

/** Anh chup de so cau truc giua hai ben. */
interface RowFixtures {
  /** Danh muc lenh (catalog). */
  catalog: Record<string, unknown>[];
  /** Danh muc co dinh. */
  fixedCatalog: Record<string, unknown>[];
  /** Anh chup cau hinh. */
  config: Record<string, unknown>;
  /** Trang thai store cua hop thoai. */
  state: { open: boolean; query: string; focusRequest: number };
}

/** Du lieu mau dung CHUNG cho ca hai ben (khong phai fixture rieng cua ben nao). */
const FIXTURES: RowFixtures = {
  catalog: [
    { id: "shortcuts.open", label: "Open keyboard shortcuts", aliases: ["shortcuts"], keys: ["Mod", "/"], aria: "Meta+/", binding: { code: "Slash", modifiers: ["primary"] }, modified: false, conflicts: [], issue: null },
    { id: "session.new", label: "New session", aliases: ["new"], keys: ["Mod", "N"], aria: "Meta+N", binding: { code: "KeyN", modifiers: ["primary"] }, modified: true, conflicts: [], issue: null },
    { id: "response.stop", label: "Stop response", aliases: ["stop"], keys: ["Esc"], aria: "Escape", binding: { code: "Escape", modifiers: [] }, modified: false, conflicts: [], issue: null },
  ],
  fixedCatalog: [
    { id: "fixed.move", label: "Move menu selection", keys: ["↑", "↓"], group: "menus", bindings: [{ code: "ArrowUp", modifiers: [] }] },
    { id: "fixed.dismiss", label: "Close menu or top dialog", keys: ["Esc"], group: "menus", bindings: [{ code: "Escape", modifiers: [] }] },
  ],
  config: { revision: 3, sequence: 1, status: "ready", error: null, usingDefaults: false, document: { profiles: { "web:macos": { "session.new": { code: "KeyN", modifiers: ["primary"] } } } } },
  state: { open: true, query: "", focusRequest: 1 },
};

/**
 * Tao require gia dung CHUNG cho ca hai ben: jsx runtime, react (hook gia), ui-primitives, dsh-client-store.
 * Nhan: record — noi ghi lai spec ma defineStore nhan.
 * Tra: ham require.
 */
function moduleStub(record: Recorder): (spec: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown => ({ type, key, props: props ?? {} });
  const react = {
    Fragment: "Fragment",
    useState: (initial: unknown): [unknown, () => void] => [initial, () => undefined],
    useRef: (initial: unknown): { current: unknown } => ({ current: initial }),
    useCallback: (fn: unknown): unknown => fn,
    useId: (): string => "id",
    // KHONG chay hieu ung: cay render duoc do ma khong cham DOM that.
    useEffect: (): void => undefined,
    useLayoutEffect: (): void => undefined,
  };
  const primitives = {
    Button: "Button",
    Modal: "Modal",
    Toast: "Toast",
    Tooltip: "Tooltip",
    ShortcutKeys: "ShortcutKeys",
    IconCloseOutlineRegular: "IconClose",
    IconRefreshOutlineRegular: "IconRefresh",
    closeTopModal: (): void => undefined,
    focusWithoutRing: (): void => undefined,
    isBehindModal: (): boolean => false,
    observeComposition: (): { guards: () => boolean; dispose: () => void } => ({ guards: () => false, dispose: () => undefined }),
    // Nguyen van chu ky THAT cua primitive: (rows, query) — ten nam trong truong name cua dong.
    rankByName: <T extends { readonly name: string }>(rows: readonly T[], query: string): readonly T[] => {
      const needle = query.toLowerCase();
      return needle === "" ? rows : rows.filter((row) => row.name.toLowerCase().includes(needle));
    },
  };
  const store = {
    defineStore: (spec: { init: () => unknown; actions: Record<string, unknown> }): Record<string, unknown> => {
      record.storeSpecs.push(spec);
      const draft = spec.init();
      const actions: Record<string, unknown> = {};
      for (const [name, fn] of Object.entries(spec.actions)) {
        actions[name] = (...args: unknown[]): void => (fn as (d: unknown, ...rest: unknown[]) => void)(draft, ...args);
      }
      const instance = { actions };
      return { create: () => instance, actions };
    },
  };
  return (spec: string): unknown => {
    if (spec === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (spec === "react") return react;
    if (spec .endsWith("-client-ui-primitives")) return primitives;
    if (spec .endsWith("-client-store")) return store;
    throw new Error("module la: " + spec);
  };
}

/**
 * Nap bundle roi lay mat plugin (apply + inject) — dung CHUNG cho ca hai ben.
 * Nhan: path — duong dan bundle da build; record — noi ghi (PHAI la recorder cua harness dang dung).
 * Tra: mat plugin { apply, inject }.
 */
function loadPlugin(path: string, record: Recorder): { apply(ctx: unknown): void; inject: readonly string[] } {
  const registration = loadRegistration(path);
  // Cờ idempotent là PHẠM VI MODULE của bundle: mỗi lần loadRegistration là một instance MỚI.
  return registration.factory(moduleStub(record)) as unknown as { apply(ctx: unknown): void; inject: readonly string[] };
}

/**
 * Tao context gia ghi lai moi dang ky; chay ngay callback cua effect/inject (giong vo that).
 * Nhan: cai — cong tac bat/tat loi cua slots.register.
 * Tra: cap { ctx, record }.
 */
function harness(cai: Switch = { failRegister: false }): { ctx: Record<string, unknown>; record: Recorder } {
  const record: Recorder = { effects: [], injected: [], registered: [], dictionaries: [], fixed: [], commands: [], storeSpecs: [] };
  const t = (key: string, params?: Record<string, unknown>): string => (params === undefined ? key : key + ":" + JSON.stringify(params));
  const locale = {
    register: (ns: string, copy: Record<string, Record<string, string>>): (() => void) => {
      record.dictionaries.push({ ns, copy });
      return () => undefined;
    },
    bind: (): ((key: string, params?: Record<string, unknown>) => string) => t,
  };
  const slots = {
    inject: (name: string, register: () => unknown): unknown => {
      record.injected.push(name);
      return register();
    },
    register: (spec: Record<string, unknown>, component: unknown): (() => void) => {
      if (cai.failRegister) throw new Error("slots.register hong (ca test cong idempotent)");
      record.registered.push({ spec, component });
      return () => undefined;
    },
  };
  const shortcuts = {
    platform: "macos",
    runtime: "web",
    catalog: { getSnapshot: () => FIXTURES.catalog },
    config: { getSnapshot: () => FIXTURES.config },
    fixedCatalog: { getSnapshot: () => FIXTURES.fixedCatalog },
    edit: async (): Promise<unknown> => ({ status: "saved", snapshot: FIXTURES.config }),
    recording: async (): Promise<void> => undefined,
    describeBinding: (): unknown => ({ binding: null, keys: [], issue: null, conflicts: [] }),
    register: (definition: Record<string, unknown>): (() => void) => {
      record.commands.push(definition);
      return () => undefined;
    },
    registerFixed: (command: Record<string, unknown>): (() => void) => {
      record.fixed.push(command);
      return () => undefined;
    },
  };
  const ctx: Record<string, unknown> = {
    effect: (run: () => unknown, label?: string): unknown => {
      record.effects.push(label ?? "?");
      return run();
    },
    locale,
    slots,
    shortcuts,
  };
  return { ctx, record };
}

/**
 * Chuan hoa gia tri de so cau truc giua hai ben (ham ⇒ "Fn", bo undefined, sap khoa).
 * Nhan: gia tri bat ky.
 * Tra: gia tri da chuan hoa.
 */
function normalize(value: unknown): unknown {
  if (typeof value === "function") return "Fn";
  if (typeof value === "string") return value.replaceAll(PACKAGE_NAME, "PKG").replaceAll(STOCK_NAME, "PKG");
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if ((value as Record<string, unknown>)[key] === undefined) continue;
      out[key] = normalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Ten slot nguyen van cua mot doan ma (tinh bang CHINH hai regex cua check:rows). */
function slotsOf(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  return [...out].sort();
}

/**
 * Doc toan bo file .ts trong src/ cua goi (giong readAllTs cua check:rows).
 * Nhan: dir — thu muc can quet.
 * Tra: noi dung gop.
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
 * Rut mot doi tuong literal trong ma bundle goc (vi du zh/en hoac bang lop CSS).
 * Nhan: code — ma bundle; marker — doan mo dau truoc dau {.
 * Tra: doi tuong da dung.
 */
function objectLiteral(code: string, marker: string): Record<string, string> {
  const start = code.indexOf(marker);
  if (start < 0) throw new Error("khong thay literal " + marker);
  const open = code.indexOf("{", start);
  const end = code.indexOf("};", open);
  return new Function("return " + code.slice(open, end + 1))() as Record<string, string>;
}

describe("row ui-shortcuts — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc, khong co cu phap ESM", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids: string[] = [];
    new Function("window", code)({ __ModuleLoader__: { load: (registration: { id: string }): void => { ids.push(registration.id); } } });
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_NAME);
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
  });

  test("package.json: mot id module · aliases giu id goc · dsh.client khop ban goc SAU KHI QUY ID bon goi · gbh.row.tests", () => {
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      exports: Record<string, string>;
      dsh: { client: { inject: string[]; platform: string } };
      gbh: { row: { id: string; moduleIds: string[]; aliases: string[]; tests: string[] } };
    };
    expect(meta.gbh.row.id).toBe("ui-shortcuts");
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
    expect(meta.gbh.row.tests).toEqual(["tests/client/ui-shortcuts.test.ts"]);
    // 20/10/2026 — id inject da REWRITE CO CHU DICH sang id GBH (55 goi); parity van phai DUNG TUNG ID va
    // DUNG THU TU SAU KHI quy id ta -> id stock. Giu literal stock lam chuan, KHONG doi literal thanh id ta.
    expect(sameAfterIdMap(meta.dsh.client, { inject: STOCK_CLIENT_INJECT, platform: "web" })).toBe(true);
    expect(meta.dsh.client.platform).toBe("web");
    // Loader chi tim thay nua browser qua export nay (thieu ⇒ ENOENT luc boot ⇒ host khong ready).
    expect(meta.exports["./client"]).toBe("./lib/client.js");
  });

  test("nua host export DUNG tap export cua ban goc (apply)", async () => {
    const stock = (await import(join(STOCK, "lib", "index.js"))) as Record<string, unknown>;
    expect(Object.keys(stock).filter((key) => key !== "default").sort()).toEqual(["apply"]);
    const ours = (await import(join(OURS, "lib", "index.js"))) as Record<string, unknown>;
    expect(Object.keys(ours).filter((key) => key !== "default").sort()).toEqual(["apply"]);
  });

  test("tap slot cua ta BANG tap slot cua chinh bundle goc (dung hai regex cua check:rows)", () => {
    const stockSlots = slotsOf(STOCK_CODE);
    const ours = slotsOf(readAllTs(join(OURS, "src")));
    expect(stockSlots).toEqual(["settings.general.item", "shell.overlay"]);
    expect(ours).toEqual(stockSlots);
  });

  test("CSS NGUYEN VAN tung byte so voi bundle goc + bang lop giu nguyen hash", () => {
    const stockCss = /const css = "((?:[^"\\]|\\.)*)";/.exec(STOCK_CODE)?.[1];
    expect(stockCss).toBeDefined();
    const stockText = JSON.parse('"' + (stockCss ?? "") + '"') as string;
    expect(CSS_TEXT).toBe(stockText);
    expect(CSS_TEXT.length).toBe(7771);
    const stockClass = objectLiteral(STOCK_CODE, "var Reference_module_css_default = ");
    expect(Object.keys(CLASS).sort()).toEqual(Object.keys(stockClass).sort());
    expect(Object.keys(CLASS).length).toBe(40);
    for (const [name, value] of Object.entries(CLASS)) {
      const className = String(value);
      expect(className).toBe(stockClass[name] as string);
      expect(stockText).toContain("." + className);
    }
  });
});

describe("row ui-shortcuts — mat plugin (A/B voi chinh bundle goc)", () => {
  test("apply cua ta va apply cua goc dang ky CUNG thu tu effect/slot/tu dien/lenh", () => {
    const stockHarness = harness();
    const stockSide = loadPlugin(join(STOCK, "lib", "client.js"), stockHarness.record);
    stockSide.apply(stockHarness.ctx);
    const ourHarness = harness();
    const ourSide = loadPlugin(join(OURS, "lib", "client.js"), ourHarness.record);
    ourSide.apply(ourHarness.ctx);

    // Nhan hieu ung: tu dien + BA lenh menu co dinh (dung chuoi cua ban goc).
    expect(ourHarness.record.effects).toEqual(stockHarness.record.effects);
    expect(ourHarness.record.effects).toEqual(["shortcuts: dictionaries", "shortcuts: fixed.move", "shortcuts: fixed.select", "shortcuts: fixed.dismiss"]);
    // Hai slot, dung ten va dung thu tu.
    expect(ourHarness.record.injected).toEqual(stockHarness.record.injected);
    expect(ourHarness.record.injected).toEqual(["settings.general.item", "shell.overlay"]);
    // Tu dien: namespace shortcuts, CHI zh + en (phase 1 — vi do goi locale dang ky tap trung).
    expect(ourHarness.record.dictionaries.map((entry) => entry.ns)).toEqual(["shortcuts"]);
    expect(Object.keys(ourHarness.record.dictionaries[0]?.copy ?? {}).sort()).toEqual(["en", "zh"]);
    // Ba lenh co dinh: id + phim + nhom trung tung ky tu.
    expect(normalize(ourHarness.record.fixed)).toEqual(normalize(stockHarness.record.fixed));
    // Mot lenh thuong: shortcuts.open.
    expect(ourHarness.record.commands.length).toBe(1);
    expect(normalize(ourHarness.record.commands)).toEqual(normalize(stockHarness.record.commands));
    // Mat plugin: apply + inject dung ba ten nhu ban goc.
    expect([...ourSide.inject]).toEqual(["shortcuts", "locale", "slots"]);
    expect([...ourSide.inject]).toEqual([...stockSide.inject]);
    // Spec cua defineStore (init + tap action) trung nhau.
    expect(ourHarness.record.storeSpecs.length).toBe(1);
    const ourSpec = ourHarness.record.storeSpecs[0] as { init: () => unknown; actions: Record<string, unknown> };
    const stockSpec = stockHarness.record.storeSpecs[0] as { init: () => unknown; actions: Record<string, unknown> };
    expect(normalize(ourSpec.init())).toEqual(normalize(stockSpec.init()));
    expect(Object.keys(ourSpec.actions).sort()).toEqual(Object.keys(stockSpec.actions).sort());
    expect(ourHarness.record.registered.length).toBe(stockHarness.record.registered.length);
  });

  test("hai cho ngoi: spec nguyen van (id/order/locale) + component la THAM SO THU HAI + MOT store dung chung", () => {
    const { ctx, record } = harness();
    const plugin = loadPlugin(join(OURS, "lib", "client.js"), record);
    plugin.apply(ctx);
    expect(record.registered.length).toBe(2);
    const [row, overlay] = record.registered;
    expect(row?.spec).toMatchObject({ name: "settings.general.item", id: "shortcuts", order: 16, locale: "shortcuts" });
    expect(overlay?.spec).toMatchObject({ name: "shell.overlay", id: "shortcuts", locale: "shortcuts" });
    expect(typeof row?.component).toBe("function");
    expect(typeof overlay?.component).toBe("function");
    // inject phai la HAM (renderer goi lai khi can) va tra dung hook + ba seam.
    expect(typeof (row?.spec.inject as unknown)).toBe("function");
    const injected = (row?.spec.inject as () => Record<string, unknown>)();
    expect(injected).toMatchObject({ platform: "macos", runtime: "web" });
    expect(Object.keys(injected.hooks as Record<string, unknown>).sort()).toEqual(["catalog", "config", "fixedCatalog"]);
    // MOT the hien store cho CA HAI cho ngoi (ban goc: create: () => instance).
    const store = row?.spec.store as { create(): unknown };
    expect(store.create()).toBe(store.create());
    expect((overlay?.spec.store as { create(): unknown }).create()).toBe(store.create());
    // Ten slot phai la LITERAL trong ma nguon (cong check:rows rut bang regex tren src/).
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    expect(/slots\.inject\("settings\.general\.item"/.test(src)).toBe(true);
    expect(/slots\.inject\("shell\.overlay"/.test(src)).toBe(true);
    expect(/name: "settings\.general\.item",/.test(src)).toBe(true);
    expect(/name: "shell\.overlay",/.test(src)).toBe(true);
  });

  test("lenh shortcuts.open: resolve theo modal — null/settings mo hop thoai, shortcuts dong modal tren cung, modal khac bi CHAN", () => {
    const { ctx, record } = harness();
    const plugin = loadPlugin(join(OURS, "lib", "client.js"), record);
    plugin.apply(ctx);
    const command = record.commands[0] as unknown as CommandLike;
    expect(command.id).toBe("shortcuts.open");
    expect(command.label()).toBe("open");
    expect([...command.aliases]).toEqual(["shortcuts", "keyboard shortcuts"]);
    expect(Object.keys(command.defaults).sort()).toEqual([
      "desktop:linux",
      "desktop:macos",
      "desktop:windows",
      "web:linux",
      "web:macos",
      "web:windows",
    ]);
    for (const value of Object.values(command.defaults)) expect(value).toEqual({ code: "Slash", modifiers: ["primary"] });
    expect([...command.regions]).toEqual(["page", "editable", "terminal"]);
    expect([...command.modals]).toEqual(["settings", "shortcuts"]);
    expect(normalize(command.resolve({ modal: "history" }))).toEqual({ status: "blocked", reason: "modal" });
    const closed = command.resolve({ modal: "shortcuts" });
    expect(closed.status).toBe("handled");
    // run() khi modal = shortcuts goi closeTopModal(document) — nhu ban goc, nen phai co document gia.
    const globals = globalThis as unknown as { document?: unknown };
    const before = globals.document;
    globals.document = { nodeType: 9 };
    try {
      expect(() => closed.run?.()).not.toThrow();
    } finally {
      globals.document = before;
    }
    const opened = command.resolve({ modal: null });
    expect(opened.status).toBe("handled");
    // modal null ⇒ mo hop thoai qua store (khong cham document).
    expect(() => opened.run?.()).not.toThrow();
  });

  test("cong chong cai hai lan: PHAM VI MODULE, bat SAU khi dang ky xong, KHONG khoa theo ctx", () => {
    const cai: Switch = { failRegister: true };
    // MOT module instance (mot lan nap bundle) ap cho BA ctx khac nhau — dung ca that HAI ENTRY ⇒ HAI ctx.
    const first = harness(cai);
    const plugin = loadPlugin(join(OURS, "lib", "client.js"), first.record);
    expect(() => plugin.apply(first.ctx)).toThrow();
    // Lan cai that bai: co PHAI con false ⇒ lan hai (ctx KHAC) phai dang ky LAI DU hai slot.
    const second = harness();
    plugin.apply(second.ctx);
    expect(second.record.injected).toEqual(["settings.general.item", "shell.overlay"]);
    expect(second.record.registered.length).toBe(2);
    // Lan thu ba: co da bat ⇒ KHONG dang ky them (neu khoa theo ctx thi se dang ky lai ⇒ bay HAI ENTRY).
    const third = harness();
    plugin.apply(third.ctx);
    expect(third.record.registered.length).toBe(0);
    expect(third.record.injected.length).toBe(0);
    // Va mot lan nap bundle MOI thi lai duoc phep dang ky (co la pham vi module, khong phai toan cuc).
    const other = harness();
    const otherPlugin = loadPlugin(join(OURS, "lib", "client.js"), other.record);
    otherPlugin.apply(other.ctx);
    expect(other.record.registered.length).toBe(2);
  });
});

describe("row ui-shortcuts — tu dien doi chung bundle goc", () => {
  test("zh + en cua ta trung TUNG CHUOI voi bundle goc", async () => {
    const ours = (await import(join(OURS, "src", "locales.ts"))) as { zh: Record<string, string>; en: Record<string, string> };
    const stockZh = objectLiteral(STOCK_CODE, "const zh = {");
    const stockEn = objectLiteral(STOCK_CODE, "const en = {");
    expect(ours.zh).toEqual(stockZh);
    expect(ours.en).toEqual(stockEn);
    expect(Object.keys(ours.zh).length).toBe(56);
    expect(Object.keys(ours.en).length).toBe(56);
    expect(Object.keys(ours.zh).sort()).toEqual(Object.keys(ours.en).sort());
  });
});

describe("row ui-shortcuts — CAY RENDER so voi bundle goc", () => {
  /** Props ma renderer cap cho hang Settings (dung chung hai ben). */
  const rowProps = (): Record<string, unknown> => ({
    actions: { open: () => undefined, search: () => undefined, close: () => undefined },
    t: (key: string, params?: Record<string, unknown>) => (params === undefined ? key : key + ":" + JSON.stringify(params)),
    useCatalog: (select: (rows: readonly unknown[]) => unknown) => select(FIXTURES.catalog),
  });
  /** Props ma renderer cap cho hop thoai. */
  const dialogProps = (): Record<string, unknown> => ({
    useStore: (select: (state: unknown) => unknown) => select(FIXTURES.state),
    actions: { open: () => undefined, search: () => undefined, close: () => undefined },
    useCatalog: (select: (rows: readonly unknown[]) => unknown) => select(FIXTURES.catalog),
    useConfig: (select: (value: unknown) => unknown) => select(FIXTURES.config),
    useFixedCatalog: (select: (rows: readonly unknown[]) => unknown) => select(FIXTURES.fixedCatalog),
    platform: "macos",
    runtime: "web",
    edit: async () => ({ status: "saved", snapshot: FIXTURES.config }),
    recording: async () => undefined,
    describeBinding: () => ({ binding: null, keys: [], issue: null, conflicts: [] }),
    t: (key: string, params?: Record<string, unknown>) => (params === undefined ? key : key + ":" + JSON.stringify(params)),
  });

  /**
   * Dung cay render cua MOT ben tu ban ghi cua chinh ben do.
   * Nhan: path — bundle; slotIndex — 0 la hang Settings, 1 la hop thoai.
   * Tra: cay element da chuan hoa.
   */
  function renderSide(path: string, slotIndex: number): unknown {
    const { ctx, record } = harness();
    const plugin = loadPlugin(path, record);
    plugin.apply(ctx);
    const component = record.registered[slotIndex]?.component as (props: Record<string, unknown>) => unknown;
    return normalize(component(slotIndex === 0 ? rowProps() : dialogProps()));
  }

  test("hang Settings: cay element cua ta TRUNG cay cua ban goc", () => {
    expect(renderSide(join(OURS, "lib", "client.js"), 0)).toEqual(renderSide(join(STOCK, "lib", "client.js"), 0));
  });

  test("hop thoai tra cuu: cay element cua ta TRUNG cay cua ban goc (48 dong element)", () => {
    const ours = renderSide(join(OURS, "lib", "client.js"), 1);
    const stock = renderSide(join(STOCK, "lib", "client.js"), 1);
    expect(ours).toEqual(stock);
    // Cay phai co noi dung that: search + 2 nhom + nut khoi phuc.
    const text = JSON.stringify(ours);
    expect(text).toContain('"search"');
    expect(text).toContain("fixedKeyBadge");
    expect(text).toContain("nhfO0a_resetAll");
  });
});

describe("row ui-shortcuts — the style", () => {
  test("injectStyles chen DUNG MOT the voi CSS nguyen van va idempotent theo data-plugin-css", () => {
    const created: { dataset: Record<string, string>; textContent: string }[] = [];
    type StyleTag = { dataset: Record<string, string>; textContent: string };
    const head = { appendChild: (tag: unknown): void => { created.push(tag as StyleTag); } };
    // querySelector GIA phai tim duoc the da chen, neu khong phep kiem idempotent khong co y nghia.
    const fakeDocument = {
      querySelector: (selector: string): unknown =>
        created.find((tag) => selector === "style[data-plugin-css=" + JSON.stringify(tag.dataset.pluginCss) + "]") ?? null,
      createElement: (): unknown => ({ dataset: {} as Record<string, string>, textContent: "" }),
      head,
    };
    const globals = globalThis as unknown as { document?: unknown };
    const before = globals.document;
    globals.document = fakeDocument;
    try {
      injectStyles();
      injectStyles();
    } finally {
      globals.document = before;
    }
    expect(created.length).toBe(1);
    expect(created[0]?.dataset.plugin).toBe(PACKAGE_NAME);
    expect(created[0]?.dataset.pluginCss).toBe(STYLE_TAG);
    expect(created[0]?.textContent).toBe(CSS_TEXT);
  });
});
