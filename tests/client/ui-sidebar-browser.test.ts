/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test doi chung cho @galaxy-blackhole/gbh-client-ui-sidebar-browser: luat mot-id, hai slot nguyen van,
 *      tu dien/phim tat/kieu tab/cay render so voi chinh bundle goc, cong chan cai hai lan va logic thuan
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BrowserNavigation, MAX_BROWSER_HISTORY } from "../../packages/client/ui-sidebar-browser/src/navigation.ts";
import { parseBrowserAddress } from "../../packages/client/ui-sidebar-browser/src/url.ts";
import { createBrowserControllers } from "../../packages/client/ui-sidebar-browser/src/controllers.ts";
import { CLASS } from "../../packages/client/ui-sidebar-browser/src/view/css.ts";
import type { createPlugin as CreatePluginType } from "../../packages/client/ui-sidebar-browser/src/plugin.ts";
import { withoutVi, viDictionary } from "../lib/vi-locale.ts";

/** Thu muc goi cua ta. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-sidebar-browser");
/** Thu muc goi goc trong cay runtime DSH. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-sidebar-browser");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-sidebar-browser";
/** Ten package goc — CHI duoc khai o aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-sidebar-browser";

/**
 * Nap module plugin TƯƠI cho moi ca.
 * Nhan: nhan — nhan ca (tao spec khac nhau de khong dung chung co pham vi module).
 * Tra: ham createPlugin cua module vua nap.
 */
async function freshCreatePlugin(label: string): Promise<typeof CreatePluginType> {
  const spec = "../../packages/client/ui-sidebar-browser/src/plugin.ts?" + label;
  const fresh = (await import(spec)) as { createPlugin: typeof CreatePluginType };
  return fresh.createPlugin;
}

/** Ban ghi nhung gi plugin dang ky voi context gia. */
interface Registration {
  /** Tu dien da dang ky. */
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
  /** Phim tat da dang ky. */
  shortcuts: Record<string, unknown>[];
  /** Kieu tab da dang ky. */
  tabTypes: Record<string, unknown>[];
  /** Occupant slot da dang ky. */
  slots: { slot: string; definition: Record<string, unknown>; component: unknown }[];
}

/** require gia: jsx runtime, react, ui-primitives va dsh-client-store. */
function moduleStub(counter: { id: number }): (id: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props: { ...props, key } });
  const primitives = {
    SHIELD_OUTLINE_PATH: "SHIELD",
    ICON_REGULAR_STROKE: 1.25,
    IconChevronLeftOutlineRegular: "IconChevronLeft",
    IconChevronRightOutlineRegular: "IconChevronRight",
    IconRefreshOutlineRegular: "IconRefresh",
    IconLinkOutlineRegular: "IconLink",
    IconRightUpOutlineRegular: "IconRightUp",
    IconGlobeOutlineRegular: "IconGlobe",
    GuideArtworkBrowser: "GuideArtworkBrowser",
    Tooltip: "Tooltip",
    Button: "Button",
  };
  const storeModule = {
    createSnapshotStore: <T,>(initial: T): unknown => ({ getSnapshot: () => initial, set: () => undefined, subscribe: () => () => undefined }),
    defineStore: (spec: unknown): unknown => spec,
  };
  return (id: string): unknown => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (id === "react") {
      return {
        useId: (): string => "id" + String(counter.id++),
        useState: <T,>(initial: T): [T, () => void] => [initial, () => undefined],
        useRef: <T,>(initial: T): { current: T } => ({ current: initial }),
        useEffect: (): void => undefined,
        useLayoutEffect: (): void => undefined,
      };
    }
    if (id .endsWith("-client-ui-primitives")) return primitives;
    if (id .endsWith("-client-store")) return storeModule;
    throw new Error("module la: " + id);
  };
}

/**
 * Dung context gia ghi lai moi dang ky.
 * Nhan: khong co.
 * Tra: cap { ctx, registration }.
 */
function harness(): { ctx: unknown; registration: Registration } {
  const registration: Registration = { dictionaries: [], shortcuts: [], tabTypes: [], slots: [] };
  const ctx: Record<string, unknown> = {
    effect: (callback: () => unknown): unknown => callback(),
    inject: (_services: readonly string[], callback: (scope: unknown) => unknown): unknown => callback(ctx),
    locale: {
      bind: () => (key: string, params?: Record<string, string>) => (params === undefined ? key : key + ":" + JSON.stringify(params)),
      register: (namespace: string, copy: Record<string, Record<string, string>>): void => {
        registration.dictionaries.push({ namespace, copy });
      },
    },
    slots: {
      inject: (slot: string, register: () => unknown): void => {
        register();
        const last = registration.slots[registration.slots.length - 1];
        if (last !== undefined) last.slot = slot;
      },
      register: (definition: Record<string, unknown>, component: unknown): void => {
        registration.slots.push({ slot: "", definition, component });
      },
    },
    sidebarRight: {
      openTabs: { getSnapshot: () => [{ sessionId: "s1", tabId: "t1" }], subscribe: () => () => undefined },
      commandTarget: () => ({ sessionId: "s1" }),
      openTabFromTarget: () => undefined,
    },
    sidebarRightTabs: {
      register: (definition: Record<string, unknown>): void => {
        registration.tabTypes.push(definition);
      },
    },
    shortcuts: {
      register: (definition: Record<string, unknown>): void => {
        registration.shortcuts.push(definition);
      },
    },
  };
  return { ctx, registration };
}

/**
 * Nap mot bundle .js da build trong window gia roi lay loi goi dang ky dau tien.
 * Nhan: path — duong dan bundle.
 * Tra: loi goi dang ky { id, factory }.
 */
async function loadRegistration(path: string): Promise<{ id: string; factory: (require: (id: string) => unknown) => Record<string, unknown> }> {
  const code = await Bun.file(path).text();
  const seen: { id: string; factory: (require: (id: string) => unknown) => Record<string, unknown> }[] = [];
  const fakeWindow = {
    __ModuleLoader__: {
      load: (registration: { id: string; factory: (require: (id: string) => unknown) => Record<string, unknown> }): void => {
        seen.push(registration);
      },
    },
  };
  new Function("window", code)(fakeWindow);
  const first = seen[0];
  if (first === undefined) throw new Error("bundle khong dang ky gi: " + path);
  return first;
}

/** Chuan hoa ten package, lop CSS va ham de so cau truc giua hai ben. */
function normalize(value: unknown): unknown {
  if (typeof value === "function") return "Fn";
  if (typeof value === "string") {
    // 08/11/2026 (R4 + task-17/N2): hai thông điệp lỗi hiển thị đã đổi nhãn "DSH" → "Galaxy Blackhole";
    // chuẩn hoá ĐÚNG nhãn thương hiệu để phép so A/B với stock vẫn NGUYÊN VĂN với mọi ký tự khác.
    return value
      .replaceAll(PACKAGE_NAME, "PKG")
      .replaceAll(STOCK_NAME, "PKG")
      .replaceAll("Galaxy Blackhole", "DSH");
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = normalize((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

/** Props dung chung cho ca hai ben khi so cay render. */
function bodyProps(counter: { id: number }): Record<string, unknown> {
  const tab = {
    id: "t1",
    title: "Tab title",
    signal: new AbortController().signal,
    navigation: { params: { url: "https://example.com" } },
    refreshShortcut: { keys: ["Control", "R"], aria: "Control+R" },
    actions: { bindCommands: () => undefined, openTab: () => undefined },
  };
  const saved = {
    entries: [{ kind: "https", url: "https://example.com/", title: "example.com" }],
    index: 0,
    request: undefined,
    navigation: { status: "known", revision: 1 },
    failure: undefined,
  };
  return {
    mount: () => () => undefined,
    loadUrl: () => undefined,
    restore: () => undefined,
    goBack: () => undefined,
    goForward: () => undefined,
    reload: () => undefined,
    setSandbox: () => undefined,
    useBrowserState: () => undefined,
    useStore: (selector: (state: { byTab: Record<string, unknown> }) => unknown) => selector({ byTab: { t1: saved } }),
    useTabInfo: () => ({ tab }),
    actions: {},
    t: (key: string, params?: Record<string, string>) => (params === undefined ? key : key + ":" + JSON.stringify(params)),
    useId: () => "id" + String(counter.id++),
  };
}

/** Rut mot chuoi literal CSS trong file nguon cua ta theo nhan. */
function sourceStrings(file: string, from: string, to: string): string[] {
  const text = readFileSync(file, "utf8");
  const start = text.indexOf(from);
  const end = text.indexOf(to, start);
  const block = text.slice(start, end);
  return [...block.matchAll(/^  ("(?:[^"\\]|\\.)*"),$/gm)].map((m) => JSON.parse(m[1] as string) as string);
}

describe("row ui-sidebar-browser — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc, khong co cu phap ESM", async () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids: string[] = [];
    new Function("window", code)({ __ModuleLoader__: { load: (registration: { id: string }): void => { ids.push(registration.id); } } });
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_NAME);
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { row: { moduleIds: string[]; aliases: string[] } } };
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
  });

  test("nua host export DUNG tap export cua ban goc (apply)", async () => {
    const stock = (await import(join(STOCK, "lib", "index.js"))) as Record<string, unknown>;
    expect(Object.keys(stock).filter((key) => key !== "default").sort()).toEqual(["apply"]);
    const ours = (await import(join(OURS, "lib", "index.js"))) as Record<string, unknown>;
    expect(Object.keys(ours).filter((key) => key !== "default").sort()).toEqual(["apply"]);
  });

  test("CSS nguyen van tung byte va bang ten lop khop ban goc", () => {
    const stockCode = readFileSync(join(STOCK, "lib", "client.js"), "utf8");
    const match = /const css = "((?:[^"\\]|\\.)*)";/.exec(stockCode);
    expect(match).not.toBeNull();
    const stockCss = JSON.parse('"' + (match?.[1] ?? "") + '"') as string;
    const ours = sourceStrings(join(OURS, "src", "view", "css.ts"), "const CSS = [", '].join("")').join("");
    expect(ours).toBe(stockCss);
    expect(Object.keys(CLASS).length).toBe(23);
    for (const name of Object.values(CLASS)) expect(stockCss).toContain("." + name);
  });
});

describe("row ui-sidebar-browser — doi chung voi ban goc", () => {
  test("tu dien, phim tat, kieu tab va HAI slot TRUNG CAU TRUC voi ban goc", async () => {
    const stockReg = await loadRegistration(join(STOCK, "lib", "client.js"));
    const stock = harness();
    stockReg.factory(moduleStub({ id: 1 }))["apply"] instanceof Function;
    (stockReg.factory(moduleStub({ id: 1 }))["apply"] as (ctx: unknown) => void)(stock.ctx);
    const mine = harness();
    const createPlugin = await freshCreatePlugin("case-shape");
    createPlugin(moduleStub({ id: 1 })).apply(mine.ctx as never);
    expect(normalize(withoutVi(mine.registration.dictionaries))).toEqual(normalize(withoutVi(stock.registration.dictionaries)));
    expect(Object.keys(viDictionary(mine.registration.dictionaries) ?? {}).length).toBe(26);
    expect(Object.keys(mine.registration.dictionaries[0]?.copy["en"] ?? {}).length).toBe(26);
    const shape = (registration: Registration): unknown => normalize({
      dictionaries: registration.dictionaries.map((entry) => entry.namespace),
      shortcutIds: registration.shortcuts.map((entry) => entry.id),
      shortcutRegions: registration.shortcuts.map((entry) => entry.regions),
      shortcutDefaults: registration.shortcuts.map((entry) => Object.keys((entry.defaults ?? {}) as object).sort()),
      tabTypeIds: registration.tabTypes.map((entry) => entry.id),
      tabTypeKind: registration.tabTypes.map((entry) => entry.kind),
      tabTypeKeepMounted: registration.tabTypes.map((entry) => entry.keepMounted),
      tabTypeGuide: registration.tabTypes.map((entry) => ((entry.guide ?? []) as { id: string; commandId: string; order: number }[]).map((guide) => ({ id: guide.id, commandId: guide.commandId, order: guide.order }))),
      slots: registration.slots.map((entry) => entry.slot),
      slotKeys: registration.slots.map((entry) => entry.definition.key),
      slotLocales: registration.slots.map((entry) => entry.definition.locale),
    });
    expect(shape(mine.registration)).toEqual(shape(stock.registration));
    expect(shape(mine.registration)).toEqual({
      dictionaries: ["sidebarBrowser"],
      shortcutIds: ["browser.new"],
      shortcutRegions: [["page", "editable", "terminal"]],
      shortcutDefaults: [["desktop:linux", "desktop:macos", "desktop:windows", "web:macos", "web:windows"]],
      tabTypeIds: ["PKG"],
      tabTypeKind: ["browser"],
      tabTypeKeepMounted: [false],
      tabTypeGuide: [[{ id: "new", commandId: "browser.new", order: 30 }]],
      slots: ["sidebar.right.pane.tab", "sidebar.right.pane.tab.title"],
      slotKeys: ["PKG", "PKG"],
      slotLocales: ["sidebarBrowser", undefined],
    });
  });

  test("cay render cua BrowserBody va BrowserTitle TRUNG voi ban goc", async () => {
    const stockReg = await loadRegistration(join(STOCK, "lib", "client.js"));
    const stock = harness();
    (stockReg.factory(moduleStub({ id: 1 }))["apply"] as (ctx: unknown) => void)(stock.ctx);
    const mine = harness();
    const createPlugin = await freshCreatePlugin("case-tree");
    createPlugin(moduleStub({ id: 1 })).apply(mine.ctx as never);
    const render = (registration: Registration, index: number, counter: { id: number }): unknown =>
      (registration.slots[index]?.component as (p: Record<string, unknown>) => unknown)(bodyProps(counter));
    expect(normalize(render(mine.registration, 0, { id: 1 }))).toEqual(normalize(render(stock.registration, 0, { id: 1 })));
    expect(normalize(render(mine.registration, 1, { id: 1 }))).toEqual(normalize(render(stock.registration, 1, { id: 1 })));
    const tree = JSON.stringify(render(mine.registration, 0, { id: 1 }));
    expect(tree).toContain("SB_kFW_toolbar");
    expect(tree).toContain("SB_kFW_viewport");
    expect(tree).toContain("address.placeholder");
    expect(tree).toContain("restore.action");
  });

  test("dang ky slot dung khuon HAI THAM SO voi ten slot LITERAL trong src", () => {
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    expect(/slots\.register\(\{\s*\n\s*name: "sidebar\.right\.pane\.tab",/.test(src)).toBe(true);
    expect(/slots\.register\(\{\s*\n\s*name: "sidebar\.right\.pane\.tab\.title",/.test(src)).toBe(true);
    expect(/\}, BrowserBody\)\)/.test(src)).toBe(true);
    expect(/\}, BrowserTitle\)\)/.test(src)).toBe(true);
    const icons = readFileSync(join(OURS, "src", "view", "icons.ts"), "utf8");
    const stockCode = readFileSync(join(STOCK, "lib", "client.js"), "utf8");
    for (const path of [...stockCode.matchAll(/"(M12\.1654[^"]+|M10\.6074[^"]+)"/g)].map((m) => m[1] as string)) {
      expect(icons).toContain(path);
    }
  });
});

describe("row ui-sidebar-browser — cong chan cai hai lan", () => {
  test("apply lan thu hai (ctx KHAC) la NO-OP — co o PHAM VI MODULE, khong khoa theo ctx", async () => {
    const first = harness();
    const createPlugin = await freshCreatePlugin("case-guard");
    createPlugin(moduleStub({ id: 1 })).apply(first.ctx as never);
    const counts = {
      slots: first.registration.slots.length,
      shortcuts: first.registration.shortcuts.length,
      tabTypes: first.registration.tabTypes.length,
      dictionaries: first.registration.dictionaries.length,
    };
    expect(counts.slots).toBe(2);
    expect(counts.shortcuts).toBe(1);
    expect(counts.tabTypes).toBe(1);
    expect(counts.dictionaries).toBe(1);
    const second = harness();
    createPlugin(moduleStub({ id: 2 })).apply(second.ctx as never);
    expect(second.registration.slots.length).toBe(0);
    expect(second.registration.shortcuts.length).toBe(0);
    expect(second.registration.tabTypes.length).toBe(0);
  });

  test("apply nem loi ⇒ DUNG MOT dong console.error va loi van duoc nem tiep", async () => {
    const broken = harness();
    const ctx = broken.ctx as Record<string, unknown>;
    delete ctx["effect"];
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]): void => {
      calls.push(args);
    };
    try {
      const createPlugin = await freshCreatePlugin("case-error");
      expect(() => createPlugin(moduleStub({ id: 1 })).apply(ctx as never)).toThrow();
    } finally {
      console.error = original;
    }
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.[0])).toContain("gbh-client-ui-sidebar-browser: apply nem loi");
  });
});

describe("row ui-sidebar-browser — logic thuan", () => {
  test("parseBrowserAddress: bang chan tri dung nhu ban goc", () => {
    expect(parseBrowserAddress("  ")).toEqual({ ok: false, reason: "empty" });
    expect(parseBrowserAddress("example.com")).toEqual({ ok: true, target: { kind: "https", url: "https://example.com/", title: "example.com" } });
    expect(parseBrowserAddress("http://example.com/a?b=1")).toEqual({ ok: true, target: { kind: "http", url: "http://example.com/a?b=1", title: "example.com" } });
    expect(parseBrowserAddress("file:///etc/passwd")).toEqual({ ok: false, reason: "protocol" });
    expect(parseBrowserAddress("https://u:p@example.com")).toEqual({ ok: false, reason: "credentials" });
    expect(parseBrowserAddress("x".repeat(20000))).toEqual({ ok: false, reason: "invalid" });
    expect(parseBrowserAddress("https://app.local/", "https://app.local")).toEqual({ ok: false, reason: "application-origin" });
  });

  test("BrowserNavigation: gioi han lich su va may trang thai loading→known→unknown", () => {
    const navigation = new BrowserNavigation();
    expect(navigation.snapshot.navigation).toEqual({ status: "empty" });
    for (let index = 0; index < MAX_BROWSER_HISTORY + 20; index += 1) {
      navigation.navigate({ kind: "https", url: "https://example.com/" + String(index), title: "example.com" });
    }
    expect(navigation.snapshot.entries.length).toBe(MAX_BROWSER_HISTORY);
    expect(navigation.snapshot.entries[0]?.url).toBe("https://example.com/20");
    const revision = navigation.snapshot.request?.revision ?? 0;
    navigation.frameLoaded(revision);
    expect(navigation.snapshot.navigation).toEqual({ status: "known", revision });
    navigation.frameLoaded(revision);
    expect(navigation.snapshot.navigation).toEqual({ status: "unknown", revision });
    expect(navigation.canGoBack).toBe(false);
    expect(navigation.canGoForward).toBe(false);
    expect(navigation.frameLoaded.bind(navigation, revision + 5)).not.toThrow();
  });

  test("createBrowserControllers: vong doi theo tin hieu, rebind va dispose", async () => {
    const calls: string[] = [];
    const page = {
      frame: {
        getSnapshot: () => ({ target: undefined, address: "empty" as const, loading: false, canGoBack: false, canGoForward: false, error: undefined, sandboxEnabled: true }),
        subscribe: () => () => undefined,
        loadUrl: () => undefined,
        goBack: () => undefined,
        goForward: () => undefined,
        reload: () => undefined,
        dispose: async (): Promise<void> => {
          calls.push("frame.dispose");
        },
      },
      presentation: { mount: (viewportId: string) => { calls.push("mount:" + viewportId); return () => { calls.push("unmount"); }; } },
    };
    const store = { getSnapshot: () => ({}), set: () => undefined, subscribe: () => () => undefined };
    const forgotten: string[] = [];
    const controllers = createBrowserControllers(
      { replace: () => undefined, forget: (tabId: string) => { forgotten.push(tabId); } },
      () => page,
      () => false,
      <T,>(initial: T) => ({ ...store, getSnapshot: () => initial }),
    );
    const first = new AbortController();
    const request = { tabId: "t1", signal: first.signal, viewportId: "vp1", applicationOrigin: "https://app.local", initial: undefined, initialUrl: undefined, openTab: () => undefined };
    const hide = controllers.mount(request);
    expect(calls).toEqual(["mount:vp1"]);
    expect(controllers.keyedHooks.browserState("t1")).toBeDefined();
    expect(controllers.keyedHooks.browserState("other")).toBeUndefined();
    controllers.mount(request);
    expect(calls.filter((entry) => entry === "mount:vp1")).toHaveLength(2);
    const second = new AbortController();
    controllers.mount({ ...request, signal: second.signal });
    // Vong doi doi ⇒ controller cu bi dispose va listener cua tin hieu CU duoc go (nguyen van ban goc).
    expect(calls).toContain("frame.dispose");
    hide();
    first.abort();
    expect(forgotten).toEqual([]);
    second.abort();
    expect(forgotten).toContain("t1");
    expect(controllers.keyedHooks.browserState("t1")).toBeUndefined();
    await controllers.dispose();
  });
});
