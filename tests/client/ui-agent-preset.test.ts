/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test row ui-agent-preset — luat mot-id O DONG LOADER (du lieu giu id goc) · BON slot nguyen van cua ban goc · tu dien 47 khoa doi chung
 *      TUNG CHUOI voi bundle goc · cay render bon component so truc tiep voi ban goc · hop dong store
 *      trao cho slot cua goi khac · CSS nguyen van tung byte
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { normalizeBrand, sameAfterIdMap } from "../lib/brand-parity.ts";
import { en, zh } from "../../packages/client/ui-agent-preset/src/locales.ts";
import {
  CREATE_PLUGIN_ITEM_CLASS,
  GUIDE_DIALOG_CLASS,
  LABEL_CLASS,
  SEAT_CLASS,
  SECTION_CLASS,
} from "../../packages/client/ui-agent-preset/src/class-names.ts";
import { createPlugin as createPluginType } from "../../packages/client/ui-agent-preset/src/plugin.ts";
import { introStaggerMs } from "../../packages/client/ui-agent-preset/src/seat.ts";
import { GUIDES, presetGuide } from "../../packages/client/ui-agent-preset/src/preset-guide.ts";
import { isBuiltInPreset, presetDisplayText, requiresCodingTools } from "../../packages/client/ui-agent-preset/src/display.ts";
import { presetOptions } from "../../packages/client/ui-agent-preset/src/roster.ts";
import { AgentPresetSeatController } from "../../packages/client/ui-agent-preset/src/seat-store.ts";
import { AgentPresetSectionController } from "../../packages/client/ui-agent-preset/src/section-store.ts";
import { withoutVi, viDictionary } from "../lib/vi-locale.ts";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-agent-preset");
/** Thu muc goi GOC cua DSH (chi doc). */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-agent-preset");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-agent-preset";
/** Ten package goc — CHI duoc khai o aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-agent-preset";
/** Bon slot ma BAN GOC dang ky — row nay phai dang ky du, dung ten, dung thu tu. */
const SLOT_NAMES = ["conversation.hero.agentPreset", "conversation.session.header.actions", "plugins.add.actions", "settings.section"];

/** Ham dich gia: giu nguyen khoa + tham so de khang dinh duoc noi suy. */
const t = (key: string, params?: Record<string, string | number>): string => (params === undefined ? key : key + ":" + JSON.stringify(params));

/** Mot lan register(spec, component) bat duoc tu context gia. */
interface SlotCall {
  /** Spec slot. */
  spec: Record<string, unknown>;
  /** Component — THAM SO THU HAI. */
  component: unknown;
}

/** Bo ghi cua context gia. */
interface Registration {
  /** Tu dien da dang ky. */
  dictionaries: { namespace: string; copy: unknown }[];
  /** Bon lan dang ky slot kem ca hai tham so. */
  slots: SlotCall[];
  /** Ten slot da inject, theo thu tu. */
  injected: string[];
  /** Nhan hieu ung vong doi. */
  effects: string[];
  /** Seam cua tung lan inject. */
  scopeInject: string[][];
  /** Store do createSnapshotStore sinh ra, theo thu tu tao. */
  stores: unknown[];
}

/** Store anh chup gia nhung DAY DU ba thanh phan (giong @deepseek-ai/dsh-client-store). */
interface StoreStub<T> {
  /** Anh chup hien tai. */
  getSnapshot(): T;
  /** Thay anh chup va bao cho nguoi nghe. */
  set(next: T): void;
  /** Nghe thay doi. */
  subscribe(listener: () => void): () => void;
}

/**
 * Store anh chup gia co day du getSnapshot/set/subscribe.
 * @param initial - gia tri dau.
 * @param log - noi ghi lai the hien de test hop dong doi chieu danh tinh.
 * @returns store gia.
 */
function makeStore<T>(initial: T, log: unknown[]): StoreStub<T> {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const store: StoreStub<T> = {
    getSnapshot: () => snapshot,
    set: (next: T) => {
      snapshot = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  log.push(store);
  return store;
}

/**
 * require gia cho CA HAI ben: jsx runtime, react, ui-primitives, store.
 * @param log - noi ghi lai store da sinh (de kiem hop dong trao store).
 * @returns ham require gia.
 */
function moduleStub(log: unknown[] = []): (id: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key });
  const primitives: Record<string, unknown> = {};
  for (const name of [
    "Button",
    "IconAgentPresetOutlineRegular",
    "IconBrowseOutlineRegular",
    "IconChevronDownOutlineRegular",
    "IconCloseOutlineRegular",
    "IconListPenOutlineRegular",
    "IconPlusOutlineRegular",
    "IconWarningOutlineRegular",
    "MarkdownText",
    "Menu",
    "MenuItemButton",
    "Modal",
    "SegmentedTabs",
    "Tag",
    "Toast",
    "Tooltip",
  ]) primitives[name] = name;
  return (id: string): unknown => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (id === "react") {
      return {
        useState: <V,>(initial: V | (() => V)): [V, (next: V) => void] => [typeof initial === "function" ? (initial as () => V)() : initial, () => undefined],
        useRef: <V,>(initial: V) => ({ current: initial }),
        useEffect: () => undefined,
        useLayoutEffect: () => undefined,
        useMemo: <V,>(factory: () => V) => factory(),
        useId: () => "r0",
      };
    }
    if (id .endsWith("-client-ui-primitives")) return primitives;
    if (id .endsWith("-client-store")) return { createSnapshotStore: <V,>(initial: V) => makeStore(initial, log) };
    throw new Error("module la: " + id);
  };
}

/**
 * Dung context gia ghi lai moi dang ky; chay ngay callback cua inject va cua effect (giong vo that).
 * @param log - noi ghi lai store da sinh.
 * @returns context gia va bo ghi.
 */
function harness(log: unknown[] = [], options: { failRegister?: boolean } = {}): { ctx: unknown; registration: Registration } {
  const registration: Registration = { dictionaries: [], slots: [], injected: [], effects: [], scopeInject: [], stores: log };
  const form = { getSnapshot: () => ({ status: "ready", value: { enabled: true }, writable: true, revision: 1 }), subscribe: () => () => undefined };
  const developerTools = { getSnapshot: () => true, subscribe: () => () => undefined };
  const ctx: Record<string, unknown> = {
    effect: (run: () => unknown, label: string) => {
      registration.effects.push(label);
      const dispose = run();
      return typeof dispose === "function" ? dispose : () => undefined;
    },
    inject: (names: readonly string[], run: (scope: unknown) => void) => {
      registration.scopeInject.push([...names]);
      run(ctx);
    },
    on: () => () => undefined,
    locale: {
      register: (namespace: string, copy: unknown) => registration.dictionaries.push({ namespace, copy }),
      bind: () => t,
    },
    slots: {
      inject: (name: string, body: () => unknown) => {
        registration.injected.push(name);
        return body();
      },
      register: (spec: Record<string, unknown>, component: unknown) => {
        if (options.failRegister === true) throw new Error("register hong (ca kiem cong idempotent)");
        registration.slots.push({ spec, component });
        return () => undefined;
      },
    },
    sessions: {
      binding: () => undefined,
      list: { getSnapshot: () => ({ byId: {} }), subscribe: () => () => undefined },
      retainInfo: () => ({ getSnapshot: () => ({ retainedBy: { mainView: 0 } }) }),
    },
    remote: {
      $on: () => () => undefined,
      agentPresets: {
        list: async () => ({ ok: true, value: { presets: [] } }),
        select: async () => ({ ok: true, value: "standard" }),
        read: async () => ({ ok: true, value: { name: "x", content: "y" } }),
      },
      settings: { update: async () => ({ ok: true, value: undefined }) },
    },
    configForms: { get: () => form, developerTools: { enabled: developerTools } },
    uiWorkspace: { startSession: () => undefined },
  };
  return { ctx, registration };
}

/**
 * Nap lai module plugin TƯƠI (co co pham vi module nen import tinh se dinh giua cac ca).
 * @param label - hau to query de moi ca co mot instance module rieng.
 * @returns ham createPlugin cua instance do.
 */
async function freshCreatePlugin(label: string): Promise<typeof createPluginType> {
  const spec: string = "../../packages/client/ui-agent-preset/src/plugin.ts?" + label;
  const fresh = (await import(spec)) as { createPlugin: typeof createPluginType };
  return fresh.createPlugin;
}

/** Loi goi dang ky module bat duoc tu mot bundle. */
interface LoadedBundle {
  /** Id bundle tu khai. */
  id: string;
  /** Factory cua bundle. */
  factory: (require: (id: string) => unknown) => unknown;
}

/**
 * Nap mot bundle .js da build trong window gia roi lay MOI loi goi dang ky.
 * @param path - duong dan bundle.
 * @returns danh sach id + factory theo thu tu dang ky.
 */
function loadBundleRegistrations(path: string): LoadedBundle[] {
  const code = readFileSync(path, "utf8");
  const seen: LoadedBundle[] = [];
  const fakeWindow = {
    __ModuleLoader__: {
      load: (registration: LoadedBundle): void => {
        seen.push(registration);
      },
    },
  };
  new Function("window", code)(fakeWindow);
  return seen;
}

/**
 * Nap mot bundle .js da build trong window gia roi lay loi goi dang ky dau tien.
 * @param path - duong dan bundle.
 * @returns id + factory.
 */
function loadBundle(path: string): LoadedBundle {
  const first = loadBundleRegistrations(path)[0];
  if (first === undefined) throw new Error("bundle khong dang ky gi: " + path);
  return first;
}

/**
 * Chay apply cua bundle GOC tren context gia roi tra ve bo ghi.
 * @returns bo ghi cua ban goc.
 */
function stockRegistration(): Registration {
  const log: unknown[] = [];
  const { ctx, registration } = harness(log);
  const bundle = loadBundle(join(STOCK, "lib", "client.js"));
  const exportsOf = bundle.factory(moduleStub(log)) as { apply: (ctx: unknown) => void };
  exportsOf.apply(ctx);
  return registration;
}

/**
 * Chay apply cua TA tren context gia roi tra ve bo ghi.
 * @param label - nhan ca (module tuoi).
 * @returns bo ghi cua ta.
 */
async function ourRegistration(label: string): Promise<Registration> {
  const log: unknown[] = [];
  const { ctx, registration } = harness(log);
  const createPlugin = await freshCreatePlugin(label);
  createPlugin(moduleStub(log)).apply(ctx as never);
  return registration;
}

/**
 * Chuẩn hoá ten package va lop cua hai ben de so cau truc (khong so danh tinh ham).
 * @param value - gia tri bat ky.
 * @returns gia tri da chuan hoa.
 */
function normalize(value: unknown): unknown {
  if (typeof value === "function") return "Fn";
  if (typeof value === "string") {
    return value.replaceAll(PACKAGE_NAME, "PKG").replaceAll(STOCK_NAME, "PKG");
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = normalize((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

/** Hinh dang cua mot spec slot de doi chieu hai ben. */
interface SlotShape {
  /** Ten slot. */
  name: unknown;
  /** Id nguoi ngoi. */
  id: unknown;
  /** Thu tu. */
  order: unknown;
  /** Uu tien. */
  priority: unknown;
  /** Namespace tu dien. */
  locale: unknown;
  /** Co ham label khong (muc trong khung cai dat). */
  hasLabel: boolean;
  /** Ten cac khoa cua nghiep vu tiem vao. */
  injectKeys: string[];
}

/**
 * Rut hinh dang cua bon spec slot tu bo ghi.
 * @param registration - bo ghi cua mot ben.
 * @returns mang hinh dang theo thu tu dang ky.
 */
function slotShapes(registration: Registration): SlotShape[] {
  return registration.slots.map((entry) => {
    const inject = entry.spec["inject"];
    const injected = typeof inject === "function" ? (inject as (id?: string) => unknown)(sessionIdForShape(entry.spec)) : undefined;
    return {
      name: entry.spec["name"],
      id: entry.spec["id"],
      order: entry.spec["order"],
      priority: entry.spec["priority"],
      locale: entry.spec["locale"],
      hasLabel: typeof entry.spec["label"] === "function",
      injectKeys: injected === null || typeof injected !== "object" ? [] : Object.keys(injected as object).sort(),
    };
  });
}

/**
 * Id phien de goi inject cho dung chu ky ban goc (chip nhan sessionId, ba slot kia khong).
 * @param spec - spec slot.
 * @returns id phien hoac undefined.
 */
function sessionIdForShape(spec: Record<string, unknown>): string | undefined {
  return spec["name"] === "conversation.hero.agentPreset" ? "s1" : undefined;
}

/**
 * Rut ten slot bang CHINH hai regex cua cong check:rows.
 * @param text - noi dung nguon hoac ban build.
 * @returns tap ten slot.
 */
function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  return out;
}

/**
 * Doc moi file .js trong mot thu muc lib (giong readStockClient cua cong).
 * @param dir - thu muc lib.
 * @returns noi dung gop.
 */
function readLib(dir: string): string {
  let out = "";
  for (const name of readdirSync(dir)) if (name.endsWith(".js")) out += readFileSync(join(dir, name), "utf8");
  return out;
}

/**
 * Doc moi file .ts trong src/ cua ta (giong readAllTs cua cong).
 * @param dir - thu muc src.
 * @returns noi dung gop.
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

describe("row ui-agent-preset — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc", () => {
    // 20/10/2026 — ARTEFACT DE-BUNDLE: id nam o DONG RIENG (thut le tab) trong khuon
    //   window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-...", factory: (require) => {
    //   ⇒ nap THAT trong window gia roi dem id, KHONG grep theo mot dong nhu ban viet tay cu.
    const path = join(OURS, "lib", "client.js");
    const ids = loadBundleRegistrations(path).map((entry) => entry.id);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Khoa lai: id goc di qua gbh.row.aliases; dang ky no => bundle chay hai lan => app trang.
    expect(ids).not.toContain(STOCK_NAME);
    const code = readFileSync(path, "utf8");
    expect(code.includes("id: \"" + STOCK_NAME + "\"")).toBe(false);
    // KHONG ESM: artifact la script classic, khong mot dong `export`.
    expect(/^export\s/m.test(code)).toBe(false);
    // 08/11/2026 (dev-5, Lead chốt (A)): artefact nay do build.ts cua GOI VIET LAI sinh ra — khuon la
    //   header 5 dong + IIFE "use strict" + "var factory = function (require) {…}" + MOT loi goi loader.
    //   Pin theo BAT BIEN (dung MOT id · id cua ta · classic script · factory nhan require), KHONG pin
    //   khoang trang/thut le cua khuon de-bundle cu (da doi khi goi chuyen sang viet lai).
    expect(code).toContain('window.__ModuleLoader__.load({ id: "' + PACKAGE_NAME + '", factory: factory });');
    expect((code.match(/__ModuleLoader__\.load\(/g) ?? []).length).toBe(1);
    expect(code).toContain("var factory = function (require) {");
  });

  test("manifest khop: moduleIds/aliases/tests + dsh.client 8 goi cua ban goc SAU KHI QUY ID", () => {
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      name: string;
      exports: Record<string, string>;
      dsh: { client: { inject: string[]; platform: string } };
      gbh: { row: { id: string; moduleIds: string[]; aliases: string[]; tests: string[] } };
    };
    expect(meta.name).toBe(PACKAGE_NAME);
    expect(meta.gbh.row.id).toBe("ui-agent-preset");
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toEqual([STOCK_NAME]);
    expect(meta.gbh.row.tests).toEqual(["tests/client/ui-agent-preset.test.ts"]);
    expect(meta.exports["./client"]).toBe("./lib/client.js");
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { dsh: { client: { inject: string[]; platform: string } } };
    // 20/10/2026 — id inject đã REWRITE CÓ CHỦ ĐÍCH sang id GBH; quy id ta -> id stock rồi so TỪNG MỤC,
    // ĐÚNG THỨ TỰ (thứ tự fiber inject của cordis), giữ manifest gốc làm chuẩn.
    expect(sameAfterIdMap(meta.dsh.client, stock.dsh.client)).toBe(true);
    expect(meta.dsh.client.platform).toBe(stock.dsh.client.platform);
  });

  test("bon slot cua ban goc deu duoc dang ky bang TEN LITERAL — chay lai CHINH hai regex cua check:rows", () => {
    const stockSlots = slotNames(readLib(join(STOCK, "lib")));
    const ourSlots = slotNames(readAllTs(join(OURS, "src")));
    expect([...stockSlots].sort()).toEqual([...SLOT_NAMES].sort());
    // TAP cua ta = TAP cua ban goc: khong thieu mot slot nao (thieu => render IT HON ban stock, am tham).
    expect([...ourSlots].sort()).toEqual([...stockSlots].sort());
  });
});

describe("row ui-agent-preset — doi chung truc tiep voi bundle goc", () => {
  test("BON slot: ten · id · order · priority · locale · khoa nghiep vu tiem vao — TRUNG TUNG DONG", async () => {
    const stock = stockRegistration();
    const mine = await ourRegistration("case-slots");
    expect(mine.slots.length).toBe(4);
    expect(stock.slots.length).toBe(4);
    expect(normalize(slotShapes(mine))).toEqual(normalize(slotShapes(stock)));
    // Khang dinh bang gia tri that (khong chi "giong nhau"): nguoi ngoi la id NGUYEN VAN cua ban goc.
    expect(slotShapes(mine)).toEqual([
      { name: "conversation.hero.agentPreset", id: undefined, order: undefined, priority: undefined, locale: "settings.agentPreset", hasLabel: false, injectKeys: ["dismissRefusal", "hooks", "introduced", "load", "select"] },
      { name: "conversation.session.header.actions", id: "agent-preset", order: -10, priority: undefined, locale: "settings.agentPreset", hasLabel: false, injectKeys: ["hooks", "load"] },
      { name: "plugins.add.actions", id: "create-plugin", order: undefined, priority: undefined, locale: "settings.agentPreset", hasLabel: false, injectKeys: ["hooks", "load", "startCreatorDraft"] },
      { name: "settings.section", id: "agent-presets", order: 20, priority: undefined, locale: "settings.agentPreset", hasLabel: true, injectKeys: ["closeView", "hooks", "load", "makeDefault", "startCreatorDraft", "view"] },
    ]);
    // Component la THAM SO THU HAI va la ham that.
    for (const entry of mine.slots) expect(typeof entry.component).toBe("function");
    // Duong TIEM vao: hai slot keyed cua goi khac (ban goc tiêm, ta tiêm y nguyen); hai slot con lai
    // nam trong effect dang ky nen di bang register — dung nhu ban goc.
    expect(mine.injected).toEqual(["plugins.add.actions", "settings.section"]);
    expect(mine.injected).toEqual(stock.injected);
    expect(mine.slots.map((entry) => entry.spec["name"]).sort()).toEqual([...SLOT_NAMES].sort());
  });

  test("tu dien TRUNG KHOP TUNG CHUOI voi ban goc: 47 khoa x 2 ngu", async () => {
    const stock = stockRegistration();
    const mine = await ourRegistration("case-dicts");
    expect(stock.dictionaries.length).toBe(1);
    expect(mine.dictionaries.length).toBe(1);
    expect(mine.dictionaries[0]?.namespace).toBe("settings.agentPreset");
    // Doi chung TUNG CHUOI (khong chi dem so khoa) — day la bang chung manh nhat cho tu dien.
    expect(normalize(withoutVi(mine.dictionaries))).toEqual(normalize(withoutVi(stock.dictionaries)));
    expect(Object.keys(viDictionary(mine.dictionaries) ?? {}).length).toBe(76);
    const copy = mine.dictionaries[0]?.copy as { en: Record<string, string>; zh: Record<string, string> };
    expect(Object.keys(copy.en).length).toBe(47);
    expect(Object.keys(copy.zh).length).toBe(47);
    expect(Object.keys(copy.en)).toEqual(Object.keys(copy.zh));
    expect(copy.en).toBe(en as unknown as Record<string, string>);
    expect(copy.zh).toBe(zh as unknown as Record<string, string>);
  });

  test("nhan hieu ung vong doi va seam inject TRUNG KHOP voi ban goc", async () => {
    const stock = stockRegistration();
    const mine = await ourRegistration("case-effects");
    expect(mine.effects).toEqual(stock.effects);
    expect(mine.effects).toEqual([
      "ui-agent-preset: bound selections",
      "ui-agent-preset: Developer tools gate",
      "ui-agent-preset: settings row dictionaries",
      "ui-agent-preset: settings refresh",
      "ui-agent-preset: new-session chip and header label",
    ]);
    expect(mine.scopeInject).toEqual(stock.scopeInject);
    expect(mine.scopeInject).toEqual([["slots", "conversation", "sessions", "uiWorkspace"]]);
    // Seam cap plugin: nguyen van bay muc cua ban goc, dung thu tu.
    const bundle = loadBundle(join(OURS, "lib", "client.js"));
    const ours = bundle.factory(moduleStub()) as Record<string, unknown> & { inject: readonly string[] };
    expect([...ours.inject]).toEqual(["slots", "sessions", "locale", "remote", "remote.agentPresets", "remote.settings", "configForms"]);
    // 08/11/2026 (dev-5, Lead chốt (A)): gói này là VIẾT LẠI (src/ + build.ts), KHÔNG phải de-bundle ⇒ pin
    //   theo HỢP ĐỒNG THẬT của bundle client thay vì so key-set với stock:
    //   · stock còn xuất AGENT_PRESET_SETTINGS_NS + writeDefaultPreset — ta KHÔNG port (grep trong src/ = 0)
    //     và bundle client của ta không cần: id đi qua dòng loader, store đi qua seam của slot.
    //   · ta xuất thêm `name` = PACKAGE_NAME (định danh cho loader/log) — assert CHẶT hơn "không có name".
    expect(typeof ours.apply).toBe("function");
    expect(Array.isArray(ours.inject)).toBe(true);
    expect(ours.name).toBe(PACKAGE_NAME);
    expect("AGENT_PRESET_SETTINGS_NS" in ours).toBe(false);
    expect("writeDefaultPreset" in ours).toBe(false);
  });
});

/** Props dung chung cho ca bon component — CA HAI BEN nhan dung mot bo props. */
interface RenderProps {
  /** Props cua nhan hang dau phien. */
  label: Record<string, unknown>;
  /** Props cua chip phien moi. */
  seat: Record<string, unknown>;
  /** Props cua muc tao plugin. */
  item: Record<string, unknown>;
  /** Props cua khung quan ly. */
  section: Record<string, unknown>;
  /** Props cua hop thoai huong dan. */
  guide: Record<string, unknown>;
}

/**
 * Dung bo props giau du cho ca bon component: du nhanh (preset ship san, preset nguoi dung, dong hong).
 * @returns props cho tung component.
 */
function renderProps(): RenderProps {
  const roster = { status: "ready", error: null, options: [{ id: "standard" }, { id: "ptc" }, { id: "minimal" }, { id: "cordis" }] };
  const seatSnapshot = { options: roster.options, current: "ptc", error: null, busy: false, introduce: false };
  return {
    label: {
      sessionId: "s1",
      useSessions: (selector: (state: unknown) => unknown) => selector({ byId: { s1: { projectionValues: { agentPreset: "ptc" } } } }),
      useAgentPresets: (selector: (state: unknown) => unknown) => selector(roster),
      load: () => undefined,
      t,
    },
    seat: {
      sessionId: "s1",
      useSessionRetainInfo: (selector: (info: unknown) => unknown) => selector({ retainedBy: { mainView: 1 } }),
      load: () => undefined,
      select: () => undefined,
      dismissRefusal: () => undefined,
      introduced: () => undefined,
      useAgentPresetSeat: (selector: (state: unknown) => unknown) => selector(seatSnapshot),
      useDeveloperTools: (selector: (value: unknown) => unknown) => selector(true),
      t,
    },
    item: {
      t,
      useAgentPresets: (selector: (state: unknown) => unknown) => selector(roster),
      load: () => undefined,
      onDismiss: () => undefined,
      startCreatorDraft: () => undefined,
    },
    section: {
      useAgentPresetSection: (selector: (state: unknown) => unknown) =>
        selector({
          status: "ready",
          error: null,
          saving: false,
          rows: [
            { id: "standard", isDefault: true },
            { id: "ptc", description: "Batch tool calls" },
            { id: "minimal" },
            { id: "cordis" },
            { id: "mine", name: "Mine", description: "Custom preset", broken: "tool missing" },
          ],
          view: null,
        }),
      load: () => undefined,
      view: () => undefined,
      closeView: () => undefined,
      makeDefault: () => undefined,
      startCreatorDraft: () => undefined,
      close: () => undefined,
      useDeveloperTools: (selector: (value: unknown) => unknown) => selector(true),
      t,
    },
    guide: { guide: GUIDES.get("standard"), initialPage: "explanation", t, onClose: () => undefined },
  };
}

/** Thu tu component trong bon slot cua ca hai ben. */
const SLOT_ORDER = ["conversation.hero.agentPreset", "conversation.session.header.actions", "plugins.add.actions", "settings.section"];

/**
 * Ve mot component cua mot ben theo ten slot.
 * @param registration - bo ghi cua ben do.
 * @param slotName - ten slot.
 * @param props - bo props dung chung.
 * @returns cay node (hoac gia tri component tra ve).
 */
function renderSlot(registration: Registration, slotName: string, props: RenderProps): unknown {
  const entry = registration.slots.find((slot) => slot.spec["name"] === slotName);
  if (entry === undefined) throw new Error("khong thay slot " + slotName);
  const key = slotName === "conversation.hero.agentPreset" ? "seat" : slotName === "conversation.session.header.actions" ? "label" : slotName === "plugins.add.actions" ? "item" : "section";
  return (entry.component as (p: Record<string, unknown>) => unknown)(props[key as keyof RenderProps]);
}

/**
 * Rut bang CSS nguyen van (kem id the style) cua ban goc tu bundle.
 * @returns mang { file, tag, css } theo thu tu xuat hien.
 */
function stockCss(): { file: string; tag: string; css: string }[] {
  const lines = readFileSync(join(STOCK, "lib", "client.js"), "utf8").split("\n");
  const out: { file: string; tag: string; css: string }[] = [];
  let current: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const region = /#region \\0dsh-css:.*\/([A-Za-z0-9_.]+\.module\.css)\.mjs$/.exec(lines[i] as string);
    if (region) {
      current = region[1] as string;
      continue;
    }
    const declared = /^\s*const css(?:\$\d+)? = (".*");$/.exec(lines[i] as string);
    if (declared && current !== null) {
      const tag = /const tagId(?:\$\d+)? = (".*");/.exec(lines[i + 1] as string);
      out.push({ file: current, tag: tag === null ? "" : (JSON.parse(tag[1] as string) as string), css: JSON.parse(declared[1] as string) as string });
      current = null;
    }
  }
  return out;
}

/** Mot the style bat duoc luc chay. */
interface InjectedTag {
  /** Id gan vao data-plugin-css. */
  id: string;
  /** Ten package gan vao data-plugin. */
  plugin: string;
  /** Van ban CSS. */
  css: string;
}

/**
 * Chay createPlugin voi mot document gia de bat nam the style ma no chen luc chay.
 * @returns nam the style theo thu tu chen.
 */
function injectStylesAtRuntime(): InjectedTag[] {
  const tags: InjectedTag[] = [];
  const documentStub = {
    querySelector: () => null,
    createElement: () => {
      const tag = { dataset: {} as Record<string, string>, textContent: "" };
      return tag;
    },
    head: { appendChild: (tag: { dataset: Record<string, string>; textContent: string }) => tags.push({ id: tag.dataset["pluginCss"] ?? "", plugin: tag.dataset["plugin"] ?? "", css: tag.textContent }) },
  };
  const globals = globalThis as unknown as { document?: unknown };
  const previous = globals.document;
  globals.document = documentStub;
  try {
    loadBundle(join(OURS, "lib", "client.js")).factory(moduleStub());
  } finally {
    globals.document = previous;
  }
  return tags;
}

/**
 * Rut bang ten lop da bam cua ban goc tu bundle.
 * @returns mang bang lop theo thu tu xuat hien.
 */
function stockClassMaps(): Record<string, string>[] {
  const lines = readFileSync(join(STOCK, "lib", "client.js"), "utf8").split("\n");
  const out: Record<string, string>[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*var \w+_module_css_default = \{$/.test(lines[i] as string)) continue;
    let acc = "";
    for (let k = i; k < i + 40; k++) {
      acc += (lines[k] as string) + "\n";
      if ((lines[k] as string).includes("};")) break;
    }
    out.push(JSON.parse(acc.replace(/^\s*var \w+_module_css_default = /, "").replace(/;\s*$/, "")) as Record<string, string>);
  }
  return out;
}

describe("row ui-agent-preset — cay render so TRUC TIEP voi ban goc", () => {
  test("bon component: cay node trung khop tung dong voi ban goc", async () => {
    const stock = stockRegistration();
    const mine = await ourRegistration("case-render");
    const props = renderProps();
    for (const slotName of SLOT_ORDER) {
      expect(normalize(renderSlot(mine, slotName, props))).toEqual(normalize(renderSlot(stock, slotName, props)));
    }
    // Khong chi "giong nhau": cay THAT SU co noi dung (khong rong, khong null) — day la khac biet giua
    // "dang ky duoc" va "render duoc".
    const label = renderSlot(mine, "conversation.session.header.actions", props) as { type?: unknown; props: Record<string, unknown> };
    expect(label.type).toBe("span");
    expect(String(label.props["className"])).toContain("SVAs4q_label");
    expect(label.props["title"]).toBe("presetPtcDescription");
    expect((label.props["children"] as unknown[])[1]).toBe("presetPtcName");
    const seat = renderSlot(mine, "conversation.hero.agentPreset", props) as { props: Record<string, unknown> };
    const seatChildren = seat.props["children"] as unknown[];
    const menu = seatChildren[0] as { type: unknown; props: Record<string, unknown> };
    expect(menu.type).toBe("Menu");
    const anchor = menu.props["anchor"] as { props: Record<string, unknown> };
    expect(String(anchor.props["className"])).toContain("cubgiG_seat");
    expect(anchor.props["disabled"]).toBe(false);
    expect((anchor.props["children"] as unknown[]).length).toBe(3);
    // Toast chi hien khi co loi tu choi: khong loi thi nhanh "&&" tra false (nguyen van ban goc).
    expect(seatChildren[1]).toBe(false);
    const item = renderSlot(mine, "plugins.add.actions", props) as { type: unknown; props: Record<string, unknown> };
    expect(item.type).toBe("MenuItemButton");
    expect(item.props["disabled"]).toBe(false);
    const section = renderSlot(mine, "settings.section", props) as { props: Record<string, unknown> };
    const groups = section.props["children"] as unknown[];
    // Bon nhanh "&&" cua ban goc: [h2, p, loi=null, hai nhom (mang long), huong dan=null, Modal].
    expect(groups.length).toBe(6);
    expect(groups[2]).toBeNull();
    const groupList = groups[3] as { props: Record<string, unknown> }[];
    expect(groupList.length).toBe(2);
    const builtInGroup = groupList[0] as { props: Record<string, unknown> };
    expect((builtInGroup.props["children"] as unknown[])[0]).toMatchObject({ props: { children: "builtInGroup" } });
    const cards = ((builtInGroup.props["children"] as unknown[])[1] as { props: Record<string, unknown> }).props["children"] as unknown[];
    expect(cards.length).toBe(4);
    expect((cards[0] as { props: Record<string, unknown> }).props["data-agent-preset-id"]).toBe("standard");
    const customGroup = groupList[1] as { props: Record<string, unknown> };
    // Nhom nguoi dung: [h3, ul (mot the), nut Creator] — the hong van duoc ve.
    expect((customGroup.props["children"] as unknown[]).length).toBe(3);
  });

  test("hop thoai huong dan: cay trung khop va co du hai tab", async () => {
    const mineRender = await import("../../packages/client/ui-agent-preset/src/preset-guide.ts");
    const dialog = mineRender.createPresetGuideDialog({
      runtime: moduleStub()("react/jsx-runtime") as never,
      react: moduleStub()("react") as never,
      primitives: moduleStub()("@deepseek-ai/dsh-client-ui-primitives") as never,
    });
    const props = renderProps();
    const tree = dialog.PresetGuideDialog(props["guide"] as never) as { type?: unknown; props: Record<string, unknown> };
    expect(tree.type).toBe("Modal");
    const layout = tree.props["children"] as { props: Record<string, unknown> };
    const parts = layout.props["children"] as unknown[];
    expect(parts.length).toBe(3);
    expect((parts[1] as { props: Record<string, unknown> }).props["label"]).toBe("guideSections");
    const usage = dialog.GuideUsage({ text: "### Fix a bug\n\nExpected output.", t }) as unknown[];
    expect(usage.length).toBe(1);
    const example = usage[0] as { props: Record<string, unknown> };
    expect(String(example.props["className"])).toContain("LSQftG_guideExample");
    // Ban goc khong xuat component nay ra ngoai bundle, nen doi chieu bang chinh bang huong dan cua ban goc.
    expect([...GUIDES.keys()]).toEqual(["standard", "ptc", "minimal", "cordis"]);
  });
});

describe("row ui-agent-preset — cong idempotent", () => {
  test("co cai dat CHAN pham vi module: co chi bat SAU khi dang ky xong, lan hai tren CUNG ctx la NO-OP", () => {
    // 08/11/2026 (dev-5, Lead chốt (A)): KHÁC stock — stock KHÔNG latch nên apply hai lần đăng ký 4 -> 8.
    //   Gói viết lại này CỐ Ý có cờ cài đặt, vì sự cố THẬT 18/10/2026 (ui-settings-general, React #130):
    //   bật cờ TRƯỚC khi applyInner xong ⇒ lần đăng ký ném giữa đường ⇒ lần cài sau thoát sớm ⇒ slot
    //   không bao giờ được đăng ký lại ⇒ renderer gặp undefined. Vì vậy pin theo THIẾT KẾ (a)+(b) dưới đây.
    const plugin = loadBundle(join(OURS, "lib", "client.js")).factory(moduleStub()) as { apply: (ctx: unknown) => void };
    // (1) Lan cai DAU nem giua duong (register hong) => KHONG duoc de lai co chan.
    const failing = harness([], { failRegister: true });
    expect(() => plugin.apply(failing.ctx)).toThrow();
    // (2) Lan cai thu hai (ctx KHAC) phai dang ky LAI du bon slot — cờ chưa được bật vì lần đầu ném.
    const second = harness([]);
    plugin.apply(second.ctx);
    expect(second.registration.slots.length).toBe(4);
    // (3) Lan ba tren CUNG ctx: cờ đã bật ⇒ NO-OP, KHÔNG đăng ký thêm (giữ 4, không phải 8 như stock).
    plugin.apply(second.ctx);
    expect(second.registration.slots.length).toBe(4);
    // (4) Cờ là PHẠM VI MODULE (một lần cho MỖI LẦN NẠP bundle): ctx MỚI sau khi cờ bật ⇒ 0 slot, KHÔNG phải 4.
    //     Đây là chủ ý: mỗi trang chỉ nạp bundle một lần rồi apply một lần; đăng ký lần hai trên ctx khác
    //     trong CÙNG lần nạp là dấu hiệu gọi trùng, phải im lặng bỏ qua thay vì nhân đôi slot.
    const third = harness([]);
    plugin.apply(third.ctx);
    expect(third.registration.slots.length).toBe(0);
    // (5) Nạp bundle LẦN NỮA (module mới ⇒ cờ mới) thì ctx mới VẪN đăng ký đủ 4 — chứng minh cờ không rò
    //     sang lần nạp khác (đúng kịch bản reload trang).
    const reloaded = loadBundle(join(OURS, "lib", "client.js")).factory(moduleStub()) as { apply: (ctx: unknown) => void };
    const afterReload = harness([]);
    reloaded.apply(afterReload.ctx);
    expect(afterReload.registration.slots.length).toBe(4);
  });
});

describe("row ui-agent-preset — HOP DONG STORE trao cho slot cua goi khac", () => {
  test("moi hooks.* la THE HIEN DAY DU do createSnapshotStore sinh ra, khong phai vo boc thieu ham", async () => {
    const log: unknown[] = [];
    const { ctx, registration } = harness(log);
    const createPlugin = await freshCreatePlugin("case-store");
    createPlugin(moduleStub(log)).apply(ctx as never);
    const specOf = (name: string): Record<string, unknown> => registration.slots.find((slot) => slot.spec["name"] === name)?.spec as Record<string, unknown>;
    const hooksOf = (name: string, sessionId?: string): Record<string, unknown> => {
      const inject = specOf(name)["inject"] as (id?: string) => { hooks: Record<string, unknown> };
      return inject(sessionId).hooks;
    };
    // Danh tinh: dung the hien ma createSnapshotStore sinh ra (khong boc lai, khong tu viet).
    expect(hooksOf("conversation.session.header.actions")["agentPresets"]).toBe(log[0]);
    expect(hooksOf("conversation.hero.agentPreset", "s1")["agentPresetSeat"]).toBe(log[1]);
    expect(hooksOf("settings.section")["agentPresetSection"]).toBe(log[2]);
    // Day du ba thanh phan ma ban goc dua cho slot cua goi khac.
    for (const key of ["agentPresets", "agentPresetSeat", "agentPresetSection"] as const) {
      const store = (key === "agentPresets"
        ? hooksOf("conversation.session.header.actions")[key]
        : key === "agentPresetSeat"
          ? hooksOf("conversation.hero.agentPreset", "s1")[key]
          : hooksOf("settings.section")[key]) as { getSnapshot?: unknown; set?: unknown; subscribe?: unknown };
      expect(typeof store.getSnapshot).toBe("function");
      expect(typeof store.set).toBe("function");
      expect(typeof store.subscribe).toBe("function");
    }
    // Doi chieu voi BAN GOC: cung mot hop dong (tap phuong thuc) tren cung mot store gia.
    const stockLog: unknown[] = [];
    const stockHarness = harness(stockLog);
    const bundle = loadBundle(join(STOCK, "lib", "client.js"));
    (bundle.factory(moduleStub(stockLog)) as { apply: (ctx: unknown) => void }).apply(stockHarness.ctx);
    const stockStore = (stockHarness.registration.slots[1]?.spec["inject"] as () => { hooks: Record<string, unknown> })?.().hooks["agentPresets"] as object;
    expect(Object.keys(hooksOf("conversation.session.header.actions")["agentPresets"] as object).sort()).toEqual(Object.keys(stockStore).sort());
  });

  test("store trao di THAT SU phat thong bao khi set() — nguoi nghe thay anh chup moi", async () => {
    const log: unknown[] = [];
    const { ctx, registration } = harness(log);
    const createPlugin = await freshCreatePlugin("case-store-live");
    createPlugin(moduleStub(log)).apply(ctx as never);
    const sectionInject = registration.slots[3]?.spec["inject"] as () => { hooks: { agentPresetSection: StoreStub<Record<string, unknown>> } };
    const store = sectionInject().hooks.agentPresetSection;
    let seen = 0;
    const stop = store.subscribe(() => {
      seen += 1;
    });
    const before = store.getSnapshot();
    store.set({ ...before, error: "boom" });
    expect(seen).toBe(1);
    expect(store.getSnapshot()["error"]).toBe("boom");
    stop();
    store.set({ ...before, error: null });
    expect(seen).toBe(1);
  });
});

describe("row ui-agent-preset — CSS nguyen van tung byte", () => {
  test("nam file .module.css giu NGUYEN VAN phan CSS cua ban goc (hash lop giu nguyen)", () => {
    const stock = stockCss();
    expect(stock.map((entry) => entry.file)).toEqual([
      "AgentPresetLabel.module.css",
      "CreatePluginMenuItem.module.css",
      "AgentPresetSeat.module.css",
      "PresetGuideDialog.module.css",
      "AgentPresetSection.module.css",
    ]);
    for (const entry of stock) {
      const raw = readFileSync(join(OURS, "src", entry.file), "utf8");
      // Header 5 dong bat buoc cua repo, roi mot dong trong, roi CSS nguyen van.
      const css = raw.slice(raw.indexOf("*/") + 3).trim();
      expect(css).toBe(entry.css);
      expect(css.length).toBe(entry.css.length);
    }
  });

  test("bang ten lop da bam trung khop voi ban goc, va artifact nhung nguyen van CSS", () => {
    const maps = stockClassMaps();
    expect(maps.length).toBe(5);
    expect(normalize([LABEL_CLASS, CREATE_PLUGIN_ITEM_CLASS, SEAT_CLASS, GUIDE_DIALOG_CLASS, SECTION_CLASS])).toEqual(normalize(maps));
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    // 20/10/2026 — brand token trong artefact đã đổi `--dsh-*` → `--gbh-*` (rename CÓ CHỦ ĐÍCH);
    // bản gốc vẫn mang `--dsh-*` ⇒ chuẩn hoá ĐỐI XỨNG hai vế rồi mới so khớp nguyên văn.
    const artifactBrand = normalizeBrand(artifact);
    for (const entry of stockCss()) expect(artifactBrand.includes(normalizeBrand(entry.css))).toBe(true);
    // 20/10/2026 — CANON (tools/debundle-client.ts): quy id CHỈ Ở DÒNG LOADER; tagId của năm thẻ style và
    //   dataset.plugin là DỮ LIỆU nên GIỮ id stock y bản gốc (không quy sang id ta). Bản gốc cũng đặt đúng
    //   năm tagId + năm dataset.plugin đó, nên so NGUYÊN VĂN danh sách với bản gốc (không nới ngưỡng).
    const tags = injectStylesAtRuntime();
    // 22/10/2026: id module CSS trong artefact của ta mang tên gói ta (tools/brand-ids-client.ts)
    // ⇒ quy về tên gốc rồi mới so danh sách thẻ với bản gốc.
    const quyId = (ten: string): string => ten.split(PACKAGE_NAME).join(STOCK_NAME);
    expect(tags.map((tag) => quyId(tag.id))).toEqual(stockCss().map((entry) => entry.tag));
    expect(tags.map((tag) => normalizeBrand(tag.css))).toEqual(stockCss().map((entry) => normalizeBrand(entry.css)));
    const stockPlugins = [...readFileSync(join(STOCK, "lib", "client.js"), "utf8").matchAll(/tag\.dataset\.plugin = "([^"]+)"/g)].map((m) => m[1] as string);
    expect(stockPlugins).toEqual([STOCK_NAME, STOCK_NAME, STOCK_NAME, STOCK_NAME, STOCK_NAME]);
    // 22/10/2026: dataset.plugin trong artefact của ta mang tên gói ta ⇒ quy về tên gốc khi so.
    expect(tags.map((tag) => quyId(tag.plugin))).toEqual(stockPlugins);
  });
});

describe("row ui-agent-preset — logic thuan", () => {
  test("presetOptions loc dong hong; display va requiresCodingTools dung bang goc", () => {
    expect(presetOptions([{ id: "a" }, { id: "b", broken: "x" }, { id: "c", name: "C", description: "D" }])).toEqual([
      { id: "a" },
      { id: "c", name: "C", description: "D" },
    ]);
    expect(isBuiltInPreset({ id: "standard" })).toBe(true);
    expect(isBuiltInPreset({ id: "standard", name: "Mine" })).toBe(false);
    expect(presetDisplayText({ id: "standard" }, t)).toEqual({ name: "presetStandardName", description: "presetStandardDescription" });
    expect(presetDisplayText({ id: "x" }, t)).toEqual({ name: "x" });
    expect(presetDisplayText({ id: "x", name: "X" }, t)).toEqual({ name: "X" });
    expect(requiresCodingTools({ id: "ptc" })).toBe(true);
    expect(requiresCodingTools({ id: "minimal" })).toBe(true);
    expect(requiresCodingTools({ id: "standard" })).toBe(false);
    expect(requiresCodingTools({ id: "ptc", name: "Mine" })).toBe(false);
    expect(requiresCodingTools(undefined)).toBe(false);
  });

  test("introStaggerMs va presetGuide dung cong thuc ban goc", () => {
    expect(introStaggerMs(0)).toBe(0);
    expect(introStaggerMs(1)).toBe(0);
    expect(introStaggerMs(2)).toBe(40);
    expect(introStaggerMs(100)).toBe(200 / 99);
    expect(presetGuide("standard", "system")).toBe(GUIDES.get("standard"));
    expect(presetGuide("standard", "user")).toBeUndefined();
    expect(presetGuide("mine", "system")).toBeUndefined();
  });

  test("AgentPresetSeatController: mac dinh Host, ghi qua remote, tu choi luu loi, dong bo phien trong", async () => {
    const selectCalls: [string, string][] = [];
    const log: unknown[] = [];
    let session: { id: string; blank?: boolean; projectionValues?: Record<string, unknown> } | undefined = {
      id: "s1",
      blank: true,
      projectionValues: { agentPreset: "standard" },
    };
    const remote = {
      agentPresets: {
        list: async () => ({ ok: true, value: { presets: [{ id: "standard" }, { id: "ptc", isDefault: true }, { id: "broken", broken: "no tool" }] } }),
        select: async (sessionId: string, id: string) => {
          selectCalls.push([sessionId, id]);
          return { ok: false, error: { message: "refused", details: { reason: "tools-disabled" } } };
        },
      },
    };
    const createStore = <V,>(initial: V) => makeStore(initial, log);
    const controller = new AgentPresetSeatController({ remote } as never, () => session, { id: undefined, introduce: false }, createStore);
    await controller.load();
    // Phien da ghi preset => chip mo tren chinh preset cua phien (khong phai mac dinh Host).
    expect(controller.store.getSnapshot().current).toBe("standard");
    expect(controller.store.getSnapshot().options.map((option) => option.id)).toEqual(["standard", "ptc"]);
    expect(controller.blankSessionId()).toBe("s1");
    const refusal = await controller.select("ptc");
    expect(refusal).toBe("tools-disabled");
    expect(selectCalls).toEqual([["s1", "ptc"]]);
    const error = controller.store.getSnapshot().error as { reason: string; preset: { id: string } };
    expect(error.reason).toBe("tools-disabled");
    expect(error.preset.id).toBe("ptc");
    controller.dismissRefusal(error as never);
    expect(controller.store.getSnapshot().error).toBe("tools-disabled");
    // Phien khong con trong => stage bi bo, khong goi remote.
    session = { id: "s1", blank: false, projectionValues: { agentPreset: "standard" } };
    expect(await controller.select("minimal")).toBeUndefined();
    expect(selectCalls.length).toBe(1);
    // Phien trong nhung da dung preset do => cung khong goi remote.
    session = { id: "s1", blank: true, projectionValues: { agentPreset: "ptc" } };
    expect(await controller.select("ptc")).toBeUndefined();
    expect(selectCalls.length).toBe(1);
    // syncBlankSession: chi ap khi phien ghi lai van con dung.
    expect(await controller.syncBlankSession("khac", "standard")).toBeUndefined();
    expect(await controller.syncBlankSession("s1", "standard")).toBe("tools-disabled");
    expect(selectCalls.length).toBe(2);
  });

  test("AgentPresetSeatController: so rong => trang thai unavailable va khong nem", async () => {
    const log: unknown[] = [];
    const remote = { agentPresets: { list: async () => ({ ok: true, value: { presets: [] } }), select: async () => ({ ok: true, value: "x" }) } };
    const controller = new AgentPresetSeatController({ remote } as never, () => undefined, { id: undefined, introduce: false }, <V,>(initial: V) => makeStore(initial, log));
    await controller.load();
    expect(controller.store.getSnapshot().current).toBe("");
    expect(controller.store.getSnapshot().options).toEqual([]);
  });

  test("AgentPresetSectionController: ghi mac dinh + doc lai + trinh xem + loi deu vao anh chup", async () => {
    const log: unknown[] = [];
    const updates: { ns: string; fields: Record<string, string>; revision: number | undefined }[] = [];
    let presets: { id: string; isDefault?: boolean }[] = [{ id: "standard", isDefault: true }, { id: "ptc" }];
    const remote = {
      agentPresets: {
        list: async () => ({ ok: true, value: { presets } }),
        read: async (id: string) => ({ ok: true, value: { name: "Preset " + id, content: "tools: []" } }),
      },
      settings: {
        update: async (
          ns: string,
          fields: Record<string, string>,
          revision?: number,
        ): Promise<{ ok: true; value: undefined } | { ok: false; error: { message: string } }> => {
          updates.push({ ns, fields, revision });
          presets = presets.map((preset) => ({ ...preset, isDefault: preset.id === fields["selectedDefault"] }));
          return { ok: true, value: undefined };
        },
      },
    };
    const controller = new AgentPresetSectionController({ remote } as never, <V,>(initial: V) => makeStore(initial, log));
    await controller.load();
    expect(controller.store.getSnapshot().rows.length).toBe(2);
    await controller.makeDefault("ptc");
    expect(updates).toEqual([{ ns: "agent-preset-registry", fields: { selectedDefault: "ptc" }, revision: undefined }]);
    expect(controller.store.getSnapshot().rows.find((row) => row.isDefault)?.id).toBe("ptc");
    expect(controller.store.getSnapshot().saving).toBe(false);
    await controller.view("ptc");
    expect(controller.store.getSnapshot().view).toEqual({ id: "ptc", title: "Preset ptc", content: "tools: []" });
    controller.closeView();
    expect(controller.store.getSnapshot().view).toBeNull();
    // Loi ghi => thong diep vao "error", khong nem ra ngoai.
    remote.settings.update = async () => ({ ok: false, error: { message: "bi tu choi" } });
    await controller.makeDefault("standard");
    expect(controller.store.getSnapshot().error).toBe("bi tu choi");
  });
});
