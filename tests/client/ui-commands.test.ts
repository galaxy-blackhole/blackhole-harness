/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Test doi chung cho @galaxy-blackhole/gbh-client-ui-commands: luat mot-id, slot nguyen van, cong chan
 *      cai hai lan, tu dien, loc dong, danh muc lenh, may trang thai the chon va CAY RENDER so voi bundle goc
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Thu muc goi cua ta. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-commands");
/** Thu muc goi goc trong cay runtime DSH (chi doc). */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-commands");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-commands";
/** Ten package goc — CHI duoc khai o gbh.row.aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-commands";
/** Bon dich vu ma ban goc khai o dsh.client.inject — phai giu nguyen van. */
const STOCK_CLIENT_INJECT = [
  "@deepseek-ai/dsh-api-remotes",
  "@deepseek-ai/dsh-client-locale",
  "@deepseek-ai/dsh-client-ui-input-trigger",
  "@deepseek-ai/dsh-client-ui-conversation",
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

/** Bo ghi cua context gia. */
interface Recorder {
  /** Ten slot da inject. */
  injected: string[];
  /** Cac lan register kem ca hai tham so. */
  registered: { spec: Record<string, unknown>; component: unknown }[];
  /** Nhan hieu ung vong doi. */
  effects: string[];
  /** Tu dien da dang ky. */
  dictionaries: { ns: string; copy: Record<string, Record<string, string>> }[];
  /** Lop plugin da duoc nap. */
  plugins: unknown[];
  /** Nguon kich hoat da dang ky. */
  sources: Record<string, unknown>[];
}

/** Trang thai co the bat/tat giua hai lan cai trong cung mot ca test. */
interface Switch {
  /** true thi slots.register nem (mo phong lan cai dau hong giua duong). */
  failRegister: boolean;
}

/**
 * Nap mot bundle .js da build trong window gia roi lay loi goi dang ky dau tien.
 * Nhan: path — duong dan bundle.
 * Tra: loi goi dang ky { id, factory }.
 */
function loadRegistration(path: string): Registration {
  const code = readFileSync(path, "utf8");
  const seen: Registration[] = [];
  const fakeWindow = {
    __ModuleLoader__: {
      load: (registration: Registration): void => {
        seen.push(registration);
      },
    },
  };
  new Function("window", code)(fakeWindow);
  const first = seen[0];
  if (first === undefined) throw new Error("bundle khong dang ky gi: " + path);
  return first;
}

/** Kho anh chup gia (seam dsh-client-store). */
interface StoreLike {
  /** Anh chup hien tai. */
  getSnapshot(): unknown;
  /** Dat gia tri moi. */
  set(value: unknown): void;
  /** Nghe thay doi. */
  subscribe(listener: () => void): () => void;
}

/**
 * Tao seam dsh-client-store gia.
 * Nhan: khong co.
 * Tra: doi tuong createSnapshotStore.
 */
function storeStub(): { createSnapshotStore: (initial: unknown) => StoreLike } {
  return {
    createSnapshotStore: (initial: unknown): StoreLike => {
      let current = initial;
      return { getSnapshot: () => current, set: (value: unknown) => { current = value; }, subscribe: () => () => undefined };
    },
  };
}

/**
 * Ham xep hang gia (ui-primitives rankByName): giu dong co ten chua truy van, theo thu tu cu.
 * Nhan: rows — cac dong; query — van ban tim.
 * Tra: cac dong khop.
 */
function rankByNameStub<T extends { readonly name: string }>(rows: readonly T[], query: string): readonly T[] {
  const q = query.toLowerCase();
  return rows.filter((row) => row.name.toLowerCase().includes(q));
}

/**
 * require gia dung CHUNG cho ca hai ben — jsx runtime, react, ui-primitives, store, cordis.
 * Nhan: khong co.
 * Tra: ham require.
 */
function moduleStub(): (spec: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown => ({ type, key, props: props ?? {} });
  /** Lop Service gia cua cordis: dang ky chinh no len ctx theo ten service (giong container that). */
  class FakeService {
    /** Context so huu. */
    readonly ctx: Record<string, unknown>;
    /**
     * @param ctx - context so huu.
     * @param name - ten service.
     */
    constructor(ctx: Record<string, unknown>, name: string) {
      this.ctx = ctx;
      ctx[name] = this;
    }
  }
  const primitives = {
    rankByName: rankByNameStub,
    observeStickyMenuGroups: (): (() => void) => () => undefined,
    useAnchoredMaxHeight: (_ref: unknown, limit: number): number => limit,
    MenuSurface: "MenuSurface",
    MenuGroup: "MenuGroup",
    RiskConfirmation: "RiskConfirmation",
    IconCheckOutlineRegular: "IconCheck",
    IconGoalOutlineRegular: "IconGoal",
    IconPlanOutlineRegular: "IconPlan",
    IconPaperPlaneOutlineRegular: "IconPaperPlane",
    IconCompactOutlineRegular: "IconCompact",
    PermissionIconFullAccessRegular: "IconPermission",
    IconDownloadOutlineRegular: "IconDownload",
  };
  const react = {
    Fragment: "Fragment",
    useSyncExternalStore: (subscribe: (fn: () => void) => () => void, getSnapshot: () => unknown): unknown => {
      subscribe(() => undefined);
      return getSnapshot();
    },
    useRef: (initial: unknown): { current: unknown } => ({ current: initial }),
    useMemo: (factory: () => unknown): unknown => factory(),
    // KHONG chay hieu ung: cay render duoc do ma khong cham DOM that.
    useEffect: (): void => undefined,
  };
  return (spec: string): unknown => {
    if (spec === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (spec === "react") return react;
    if (spec .endsWith("-client-ui-primitives")) return primitives;
    if (spec .endsWith("-client-store")) return storeStub();
    if (spec === "@deepseek-ai/cordis") return { Service: FakeService };
    throw new Error("module la: " + spec);
  };
}

/**
 * Dung context gia ghi lai moi dang ky, chay ngay callback cua effect/inject (giong vo that).
 * Nhan: cai — cong tac bat/tat loi cua slots.register.
 * Tra: cap { ctx, record }.
 */
function harness(cai: Switch = { failRegister: false }): { ctx: Record<string, unknown>; record: Recorder } {
  const record: Recorder = { injected: [], registered: [], effects: [], dictionaries: [], plugins: [], sources: [] };
  const t = (key: string, params?: Record<string, string>): string => (params === undefined ? key : key + ":" + JSON.stringify(params));
  const locale = {
    register: (ns: string, copy: Record<string, Record<string, string>>): void => {
      record.dictionaries.push({ ns, copy });
    },
    bind: (): ((key: string, params?: Record<string, string>) => string) => t,
  };
  const slots = {
    inject: (name: string, register: () => unknown): void => {
      record.injected.push(name);
      register();
    },
    register: (spec: Record<string, unknown>, component: unknown): void => {
      if (cai.failRegister) throw new Error("slots.register hong (ca test cong idempotent)");
      record.registered.push({ spec, component });
    },
  };
  const inputTriggers = { registerSource: (source: Record<string, unknown>): void => { record.sources.push(source); } };
  const remote = {
    $on: (): (() => void) => () => undefined,
    commands: { list: async (): Promise<unknown> => ({ ok: true, value: [] }), execute: async (): Promise<unknown> => ({ ok: true, value: undefined }) },
  };
  const ctx: Record<string, unknown> = {
    effect: (run: () => unknown, label?: string): unknown => {
      record.effects.push(label ?? "?");
      return run();
    },
    inject: (_services: readonly string[], callback: (scope: unknown) => unknown): unknown => callback(ctx),
    plugin: (ctor: unknown): void => {
      record.plugins.push(ctor);
      new (ctor as new (scope: unknown) => unknown)(ctx);
    },
    get: (name: string): unknown => ctx[name] ?? (name === "locale" ? locale : name === "inputTriggers" ? inputTriggers : undefined),
    on: (): (() => void) => () => undefined,
    bail: (): boolean => true,
    events: { dispatch: (): unknown[] => [] },
    logger: { warn: (): void => undefined },
    locale,
    slots,
    remote,
  };
  return { ctx, record };
}

/** Mat plugin toi thieu ma factory dung ra. */
interface PluginLike {
  /** Ten plugin. */
  name: string;
  /** Dich vu bat buoc. */
  inject: readonly string[];
  /** Chay plugin tren mot context. */
  apply(ctx: unknown): void;
}

/**
 * Nap lai module plugin TƯƠI (co `uiCommandsInstalled` o pham vi module nen import tinh se dinh giua cac ca).
 * Nhan: tag — hau to query de moi ca co mot instance module rieng.
 * Tra: ham createPlugin cua instance do.
 */
async function freshCreatePlugin(tag: string): Promise<(requireFn: (spec: string) => unknown) => PluginLike> {
  const spec: string = "../../packages/client/ui-commands/src/plugin.ts?" + tag;
  const mod = (await import(spec)) as { createPlugin: (requireFn: (spec: string) => unknown) => PluginLike };
  return mod.createPlugin;
}

/** Ten slot nguyen van cua ban goc (tinh bang CHINH hai regex cua check:rows). */
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
 * Rut mot doi tuong literal trong ma bundle goc (vi du zh/en) de doi chung TUNG CHUOI.
 * Nhan: code — ma bundle; name — ten hang.
 * Tra: doi tuong da dung.
 */
function objectLiteral(code: string, name: string): Record<string, string> {
  const start = code.indexOf("const " + name + " = {");
  if (start < 0) throw new Error("khong thay literal " + name);
  const open = code.indexOf("{", start);
  const end = code.indexOf("};", open);
  return new Function("return " + code.slice(open, end + 1))() as Record<string, string>;
}

/** Chuan hoa gia tri de so cau truc giua hai ben. */
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

describe("row ui-commands — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc, khong co cu phap ESM", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids: string[] = [];
    new Function("window", code)({ __ModuleLoader__: { load: (registration: { id: string }): void => { ids.push(registration.id); } } });
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_NAME);
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
    // Doc CA HAI dang: goi da mount thi co gbh.row; goi bi go mount thi giu nguyen noi dung cu trong
    // gbh.row_unmounted_ly_do.row (luat cua recipe) — test khong duoc do vi trang thai mount.
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      dsh: { client: { inject: string[]; platform: string } };
      gbh?: { row?: RowMeta; row_unmounted_ly_do?: { row: RowMeta } };
    };
    const row = meta.gbh?.row ?? meta.gbh?.row_unmounted_ly_do?.row;
    expect(row).toBeDefined();
    expect(row?.moduleIds).toEqual([PACKAGE_NAME]);
    expect(row?.aliases).toContain(STOCK_NAME);
    // 20/10/2026 — inject đã REWRITE CÓ CHỦ ĐÍCH sang id GBH; parity kiểm SAU KHI quy id ta -> id stock:
    // vẫn đúng bốn gói, đúng thứ tự, và đúng platform. Literal stock giữ nguyên làm chuẩn.
    expect(sameAfterIdMap(meta.dsh.client, { inject: STOCK_CLIENT_INJECT, platform: "web" })).toBe(true);
    expect(meta.dsh.client.platform).toBe("web");
    expect(row?.tests).toEqual(["tests/client/ui-commands.test.ts"]);
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
    expect(stockSlots).toEqual(["conversation.input.overlay"]);
    expect(ours).toEqual(stockSlots);
  });

  test("CSS nguyen van tung byte va bang ten lop giu nguyen hash lop goc", async () => {
    const stockCss = /const css = "((?:[^"\\]|\\.)*)";/.exec(STOCK_CODE)?.[1];
    expect(stockCss).toBeDefined();
    const stockText = JSON.parse('"' + (stockCss ?? "") + '"') as string;
    const ours = (await import(join(OURS, "src", "view", "css.ts"))) as { CSS_TEXT: string; CLASS: Record<string, string> };
    expect(ours.CSS_TEXT).toBe(stockText);
    expect(ours.CSS_TEXT.length).toBe(2064);
    expect(Object.keys(ours.CLASS).length).toBe(14);
    for (const name of Object.values(ours.CLASS)) expect(stockText).toContain("." + name);
  });
});

describe("row ui-commands — mat plugin", () => {
  test("apply dang ky slot nguyen van voi id NGUYEN VAN, component la THAM SO THU HAI", async () => {
    const { ctx, record } = harness();
    const createPlugin = await freshCreatePlugin("case-slot");
    const plugin = createPlugin(moduleStub());
    plugin.apply(ctx);
    expect(record.injected).toEqual(["conversation.input.overlay"]);
    expect(record.registered.length).toBe(1);
    const entry = record.registered[0];
    expect(entry?.spec).toMatchObject({ name: "conversation.input.overlay", id: "command-popup", order: 1, locale: "command" });
    expect(typeof entry?.component).toBe("function");
    expect(typeof (entry?.spec.inject as (id: string) => unknown)).toBe("function");
    expect(plugin.name).toBe(PACKAGE_NAME);
    expect([...plugin.inject]).toEqual(STOCK_CLIENT_INJECT.slice(0, 0).concat(["inputTriggers", "sessions", "remote", "remote.commands", "locale"]));
    // Tu dien + service duoc dang ky o lan cai dau.
    expect(record.dictionaries.map((d) => d.ns)).toEqual(["command"]);
    expect(record.plugins.length).toBe(1);
    expect(record.sources.length).toBe(1);
    expect(record.effects).toEqual(["ui-commands: dictionaries", "command: slash source"]);
    // Ten slot phai la LITERAL trong ma nguon (cong check:rows rut bang regex tren src/).
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    expect(/slots\.inject\("conversation\.input\.overlay"/.test(src)).toBe(true);
    expect(/name: "conversation\.input\.overlay",/.test(src)).toBe(true);
    expect(/id: "command-popup",/.test(src)).toBe(true);
    expect(/\}, PopupSelectView\)/.test(src)).toBe(true);
  });

  test("cong chong cai hai lan: PHAM VI MODULE, bat SAU khi dang ky xong, KHONG khoa theo ctx", async () => {
    const cai: Switch = { failRegister: true };
    const { ctx, record } = harness(cai);
    const createPlugin = await freshCreatePlugin("case-guard");
    const plugin = createPlugin(moduleStub());
    // (1) Lan cai DAU nem giua duong (slots.register hong) => co PHAI con false.
    expect(() => plugin.apply(ctx)).toThrow();
    expect(record.registered.length).toBe(0);
    record.injected.length = 0;
    record.effects.length = 0;
    // (2) Lan cai thu hai — CUNG ctx do — phai dang ky LAI du slot. Neu co bi bat som, hoac neu cong
    //     khoa theo ctx, ca nay se ra 0 slot => renderer gap undefined => React #130.
    cai.failRegister = false;
    plugin.apply(ctx);
    expect(record.registered.length).toBe(1);
    expect(record.injected).toEqual(["conversation.input.overlay"]);
    // (3) Lan cai thu ba voi ctx KHAC: da xong nen khong dang ky lai (slot trung => app trang).
    const other = harness();
    plugin.apply(other.ctx);
    expect(other.record.registered.length).toBe(0);
    expect(other.record.dictionaries.length).toBe(0);
    // (4) Dang nguon: bien PHAM VI MODULE, dat TRUOC JSDoc cua createPlugin, va bat SAU applyInner.
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    const guard = src.indexOf("let uiCommandsInstalled = false;");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(src.indexOf("export function createPlugin"));
    expect(src.indexOf("applyInner(ctx);")).toBeLessThan(src.indexOf("uiCommandsInstalled = true;"));
    expect(src).toContain("new WeakSet<object>()");
    // Khong duoc khoa theo ctx: artifact/nguon khong chua lastCtx hay installedContexts.
    expect(/lastCtx|installedContexts/.test(src)).toBe(false);
    expect(/lastCtx|installedContexts/.test(readFileSync(join(OURS, "lib", "client.js"), "utf8"))).toBe(false);
  });

  test("apply nem loi => DUNG MOT dong console.error va loi van duoc nem tiep", async () => {
    const cai: Switch = { failRegister: true };
    const { ctx } = harness(cai);
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]): void => {
      calls.push(args);
    };
    try {
      const createPlugin = await freshCreatePlugin("case-error");
      expect(() => createPlugin(moduleStub()).apply(ctx)).toThrow();
    } finally {
      console.error = original;
    }
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.[0])).toContain("gbh-client-ui-commands: apply nem loi");
  });
});

describe("row ui-commands — doi chung voi ban goc", () => {
  test("tu dien namespace 'command' TRUNG TUNG CHUOI voi bundle goc, ca hai ngu", async () => {
    const { zh, en } = (await import(join(OURS, "src", "locales.ts"))) as {
      zh: Record<string, string>;
      en: Record<string, string>;
    };
    const stockZh = objectLiteral(STOCK_CODE, "zh");
    const stockEn = objectLiteral(STOCK_CODE, "en");
    expect(Object.keys(zh).sort()).toEqual(Object.keys(stockZh).sort());
    expect(Object.keys(en).sort()).toEqual(Object.keys(stockEn).sort());
    expect(Object.keys(zh).length).toBe(28);
    for (const key of Object.keys(stockZh)) {
      expect(zh[key]).toBe(stockZh[key]);
      expect(en[key]).toBe(stockEn[key]);
    }
    // File locale cua goi phai byte-for-byte voi ban goc.
    for (const name of ["en.json", "zh.json"]) {
      expect(readFileSync(join(OURS, "locale", name), "utf8")).toBe(readFileSync(join(STOCK, "locale", name), "utf8"));
    }
  });

  test("filterOptions va groupOptions TRUNG ket qua voi ban goc tren cung bo dong", async () => {
    const stock = loadRegistration(join(STOCK, "lib", "client.js")).factory(moduleStub());
    const ours = (await import(join(OURS, "src", "popup.ts"))) as {
      filterOptions: (options: readonly Record<string, unknown>[], search: string, mode?: string) => readonly Record<string, unknown>[];
    };
    const oursGroup = (await import(join(OURS, "src", "option-groups.ts"))) as {
      groupOptions: (options: readonly Record<string, unknown>[]) => { group: { name: string } | undefined; rows: readonly Record<string, unknown>[] }[];
    };
    const options = [
      { id: "a", label: "Alpha", detail: "first" },
      { id: "b", label: "Beta", group: { name: "g1", label: "Group 1" } },
      { id: "c", label: "Gamma", group: { name: "g1", label: "Group 1" }, detail: "third" },
      { id: "d", label: "Delta", group: { name: "g2", label: "Group 2" } },
    ];
    const stockFilter = stock["filterOptions"] as (o: readonly Record<string, unknown>[], s: string, m?: string) => readonly Record<string, unknown>[];
    for (const query of ["", "  ", "al", "GROUP", "a", "zzz"]) {
      expect(ours.filterOptions(options, query).map((row) => row["id"])).toEqual(stockFilter(options, query).map((row) => row["id"]));
    }
    const stockGroups = stockGroupOf(STOCK_CODE);
    expect(oursGroup.groupOptions(options).map((g) => ({ name: g.group?.name, ids: g.rows.map((r) => r["id"]) }))).toEqual(stockGroups);
  });

  test("danh muc lenh + giai cach viet TRUNG ban goc (ke ca alias tieng Trung)", async () => {
    const stock = loadRegistration(join(STOCK, "lib", "client.js")).factory(moduleStub());
    const StockDirectory = stock["CommandDirectory"] as new (f: (id: string) => Promise<readonly Record<string, unknown>[]>) => {
      status(id: string): string;
      refresh(id: string): Promise<void>;
      resolve(id: string, name: string): Record<string, unknown> | undefined;
      invalidateAll(): void;
      warm(id: string): void;
    };
    const { CommandDirectory } = (await import(join(OURS, "src", "directory.ts"))) as {
      CommandDirectory: new (f: (id: string) => Promise<readonly Record<string, unknown>[]>) => {
        status(id: string): string;
        refresh(id: string): Promise<void>;
        resolve(id: string, name: string): Record<string, unknown> | undefined;
        invalidateAll(): void;
        warm(id: string): void;
      };
    };
    const descriptors = [
      { name: "plan", definitionId: "@deepseek-ai/dsh-plan-mode", description: "host text" },
      { name: "file", description: "attach a file" },
      { name: "perm", definitionId: "@deepseek-ai/dsh-permission-presets", input: { hint: "preset" } },
    ];
    let pulls = 0;
    const fetchCommands = async (): Promise<readonly Record<string, unknown>[]> => {
      pulls += 1;
      return descriptors;
    };
    const stockDirectory = new StockDirectory(fetchCommands);
    const ourDirectory = new CommandDirectory(fetchCommands);
    expect(ourDirectory.status("s1")).toBe(stockDirectory.status("s1"));
    await ourDirectory.refresh("s1");
    await stockDirectory.refresh("s1");
    expect(ourDirectory.status("s1")).toBe("ready");
    expect(ourDirectory.status("s1")).toBe(stockDirectory.status("s1"));
    for (const token of ["plan", "计划", "plan2", "file", "权限", "perm", "zzz", ""]) {
      expect(ourDirectory.resolve("s1", token)?.name).toBe(stockDirectory.resolve("s1", token)?.name);
    }
    expect(ourDirectory.resolve("cold", "plan")).toBeUndefined();
    expect(pulls).toBe(2);
  });

  test("may trang thai cua the chon TRUNG ban goc qua tung dong tu", async () => {
    const stock = loadRegistration(join(STOCK, "lib", "client.js")).factory(moduleStub());
    const { PopupSelectController, CLOSED, filterOptions } = (await import(join(OURS, "src", "popup.ts"))) as {
      PopupSelectController: new (deps: unknown, store: unknown, rank?: unknown) => ControllerLike;
      CLOSED: Record<string, unknown>;
      filterOptions: (o: readonly Record<string, unknown>[], s: string, m?: string) => readonly Record<string, unknown>[];
    };
    const StockController = stock["PopupSelectController"] as new (deps: unknown) => ControllerLike;
    expect(CLOSED).toEqual({ open: false, command: null, status: "pending", options: [], search: "", searchLabels: null, searchMode: "substring", active: 0, submitting: false, confirming: null, acknowledged: false, error: null });

    /** Hai ben nhan cung mot chuoi dong tu va phai ra cung anh chup trang thai. */
    const runs: { label: string; act: (c: ControllerLike) => void | Promise<void> }[] = [
      { label: "open", act: (c) => c.open("perm", spec, { sessionId: "s1" }, { via: "enter", token: "/perm" }) },
      { label: "settle-nap-dong", act: async () => { await Promise.resolve(); await Promise.resolve(); } },
      { label: "setSearch", act: (c) => c.setSearch("be") },
      { label: "move", act: (c) => c.move(1) },
      { label: "highlight", act: (c) => c.highlight(0) },
      { label: "chon-dong-co-cong", act: async (c) => { await c.select(0); } },
      { label: "acknowledge", act: (c) => c.acknowledge(true) },
      { label: "confirm", act: async (c) => { await c.confirm(); } },
      { label: "dismiss", act: (c) => c.dismiss({ focusComposer: true }) },
    ];
    const options = [
      { id: "a", label: "Alpha", confirmation: { title: "T", description: "D", acknowledgeLabel: "A", cancelLabel: "C", confirmLabel: "OK" } },
      { id: "b", label: "Beta", active: true },
    ];
    const spec = { kind: "popupSelect", options: async () => options, onSelect: async (): Promise<void> => undefined };
    const consume: string[] = [];
    const focus: string[] = [];
    const deps = {
      consume: (segment: { token?: string }): boolean => {
        consume.push(String(segment.token));
        return true;
      },
      focusComposer: (): void => {
        focus.push("focus");
      },
    };
    const oursController = new PopupSelectController(deps, storeStub(), rankByNameStub);
    const stockController = new StockController(deps);
    for (const step of runs) {
      await step.act(oursController);
      await step.act(stockController);
      expect([step.label, normalize(oursController.state.getSnapshot())]).toEqual([step.label, normalize(stockController.state.getSnapshot())]);
    }
    expect(consume).toEqual(["/perm", "/perm"]);
    expect(focus.length).toBe(2);
    // Loc theo chi so phai giong nhau o moi buoc.
    expect(filterOptions(options, "").length).toBe(2);
  });

  test("CAY RENDER cua the chon TRUNG ban goc (hai trang thai: ready va failed)", async () => {
    const stock = loadRegistration(join(STOCK, "lib", "client.js")).factory(moduleStub());
    const createPlugin = await freshCreatePlugin("case-tree");
    const ourRun = harness();
    createPlugin(moduleStub()).apply(ourRun.ctx);
    const stockRun = harness();
    (stock["apply"] as (c: unknown) => void)(stockRun.ctx);
    const ourView = ourRun.record.registered[0]?.component as (props: Record<string, unknown>) => unknown;
    const stockView = stockRun.record.registered[0]?.component as (props: Record<string, unknown>) => unknown;
    expect(typeof ourView).toBe("function");
    expect(typeof stockView).toBe("function");
    const t = (key: string, params?: Record<string, string>): string => (params === undefined ? key : key + ":" + JSON.stringify(params));

    /** Dung the gia voi mot anh chup trang thai cho truoc. */
    const render = (view: (props: Record<string, unknown>) => unknown, state: Record<string, unknown>): unknown =>
      view({
        popup: {
          state: { getSnapshot: () => state, subscribe: () => () => undefined },
          select: (): void => undefined,
          move: (): void => undefined,
          highlight: (): void => undefined,
          dismiss: (): void => undefined,
          retry: (): void => undefined,
          setSearch: (): void => undefined,
          acknowledge: (): void => undefined,
          cancelConfirmation: (): void => undefined,
          confirm: (): void => undefined,
        },
        t,
      });

    const base = { open: true, command: "perm", status: "ready", options: [], search: "", searchLabels: null, searchMode: "substring", active: 0, submitting: false, confirming: null, acknowledged: false, error: null };
    const ready = {
      ...base,
      options: [
        { id: "a", label: "Alpha", detail: "first", active: true, badge: "1" },
        { id: "b", label: "Beta", group: { name: "g1", label: "Group 1" } },
      ],
    };
    const failed = { ...base, status: "failed", error: "boom" };
    const closed = { ...base, open: false };
    for (const state of [ready, failed, closed, { ...base, status: "pending" }, { ...base, submitting: true }]) {
      expect(normalize(render(ourView, state))).toEqual(normalize(render(stockView, state)));
    }
    const tree = JSON.stringify(render(ourView, ready));
    expect(tree).toContain("mufS8W_card");
    expect(tree).toContain("mufS8W_viewport");
    expect(tree).toContain("overlay.aria");
    expect(tree).toContain("Group 1");
    expect(JSON.stringify(render(ourView, closed))).toBe("null");
  });
});

/** Metadata gbh.row (hoac row duoc go mount giu trong gbh.row_unmounted_ly_do). */
interface RowMeta {
  /** Id row stock bi thay. */
  id: string;
  /** Id module bundle tu khai. */
  moduleIds: string[];
  /** Id goi goc duoc alias. */
  aliases: string[];
  /** Duong dan test cua goi. */
  tests: string[];
}

/** Be mat toi thieu cua bo dieu khien the chon (ca hai ban deu khop). */
interface ControllerLike {
  /** Kho trang thai. */
  readonly state: { getSnapshot(): Record<string, unknown> };
  /** Mo the. */
  open(command: string, spec: unknown, context: unknown, segment: unknown): void;
  /** Doi van ban loc. */
  setSearch(search: string): void;
  /** Di chuyen dau vet. */
  move(dir: 1 | -1): void;
  /** Dat dau vet. */
  highlight(index: number): void;
  /** Chon mot dong. */
  select(index: number): Promise<void>;
  /** Tich xac nhan rui ro. */
  acknowledge(value: boolean): void;
  /** Chot dong bi chan. */
  confirm(): Promise<void>;
  /** Dong the. */
  dismiss(opts?: { focusComposer?: boolean }): void;
}

/**
 * Doc ket qua groupOptions cua BAN GOC bang cach chay chinh ham do trong bundle.
 * Nhan: code — ma bundle goc.
 * Tra: danh sach { name, ids } dung thu tu.
 */
describe("row ui-commands — nhan dien dinh nghia built-in (10/11/2026)", () => {
  /**
   * Id dinh nghia Host THẬT đăng ký cho 6 lệnh dựng sẵn, ở HAI dạng bản cài.
   * Lý do (10/11/2026): bản repo còn id stock; bản profile đã đổi id gói nhưng phép đổi bỏ qua tệp của
   * chính gói nên Host vẫn gửi id STOCK. Cả hai dạng phải khớp bảng mặt chữ.
   * Nhận: dạng id. Trả: cặp [tên lệnh dựng sẵn, id định nghĩa].
   */
  const cap = (dang: "stock" | "gbh"): [string, string][] =>
    dang === "stock"
      ? [
          ["goal", "@deepseek-ai/dsh-command-goal"],
          ["plan", "@deepseek-ai/dsh-plan-mode"],
          ["feedback", "@deepseek-ai/dsh-command-feedback"],
          ["compact", "@deepseek-ai/dsh-command-compact"],
          ["permission", "@deepseek-ai/dsh-permission-presets"],
          ["export", "@deepseek-ai/dsh-session-log-export"],
        ]
      : [
          ["goal", "@galaxy-blackhole/gbh-command-goal"],
          ["plan", "@galaxy-blackhole/gbh-plan-mode"],
          ["feedback", "@galaxy-blackhole/gbh-command-feedback"],
          ["compact", "@galaxy-blackhole/gbh-command-compact"],
          ["permission", "@galaxy-blackhole/gbh-permission"],
          ["export", "@galaxy-blackhole/gbh-session-log-export"],
        ];

  test("id GBH 'gbh-permission' và id stock đều nhận ra lệnh permission (lỗi menu '/' hiện tiếng Anh)", async () => {
    const { builtinCommandName } = (await import(join(OURS, "src", "resolution.ts"))) as {
      builtinCommandName: (descriptor: { definitionId?: string; name: string }) => string | undefined;
    };
    for (const dang of ["stock", "gbh"] as const) {
      for (const [ten, id] of cap(dang)) {
        expect(builtinCommandName({ name: ten, definitionId: id })).toBe(ten);
      }
    }
    // Ca hoi quy: id la (rỗng) không được nhận nhầm thành lệnh dựng sẵn nào.
    expect(builtinCommandName({ name: "file" })).toBeUndefined();
    expect(builtinCommandName({ name: "khac", definitionId: "@galaxy-blackhole/gbh-lark" })).toBeUndefined();
  });

  test("gõ alias (tiếng Trung / tiếng Anh) trỏ đúng descriptor dù Host gửi id stock hay id GBH", async () => {
    const { resolveCommand } = (await import(join(OURS, "src", "resolution.ts"))) as {
      resolveCommand: (token: string, descriptors: readonly { name: string; definitionId?: string }[]) => { name: string } | undefined;
    };
    const stock = { name: "permission", definitionId: "@deepseek-ai/dsh-permission-presets", input: { hint: "<preset>" } };
    const gbh = { name: "permission", definitionId: "@galaxy-blackhole/gbh-permission", input: { hint: "<preset>" } };
    const file = { name: "file" };
    // Alias gốc (tiếng Trung + tiếng Anh) là hai ngu của TOKEN_ALIASES; tên đăng ký là ngu thứ ba.
    for (const token of ["权限", "permission"]) {
      expect(resolveCommand(token, [file, stock])?.name).toBe("permission");
      expect(resolveCommand(token, [file, gbh])?.name).toBe("permission");
    }
    expect(resolveCommand("khong-co", [file, stock])).toBeUndefined();
  });

  test("mục /permission dựng ĐÚNG nhãn + mô tả tiếng Việt từ bảng mặt chữ (ảnh người dùng 10/11/2026)", async () => {
    const { builtinRowFace } = (await import(join(OURS, "src", "presentation.ts"))) as {
      builtinRowFace: (
        descriptor: { name: string; definitionId?: string; description?: string },
        t: (key: string) => string,
        faces: Map<string, { label: string; description: string; icon: string }>,
      ) => { label: string; description: string; icon: string } | undefined;
    };
    const { vi } = (await import(join(OURS, "src", "locales-vi.ts"))) as { vi: Record<string, string> };
    const t = (key: string): string => vi[key] ?? key;
    const faces = new Map([["permission", { label: "label.permission", description: "description.permission", icon: "icon-permission" }]]);
    for (const definitionId of ["@deepseek-ai/dsh-permission-presets", "@galaxy-blackhole/gbh-permission"]) {
      const face = builtinRowFace({ name: "permission", definitionId, description: "Switch the permission preset (sandbox mode + approval policy)" }, t, faces);
      expect(face?.label).toBe("Quyền");
      expect(face?.description).toBe("Đổi preset quyền (chế độ sandbox + chính sách phê duyệt)");
      expect(face?.icon).toBe("icon-permission");
    }
  });
});
function stockGroupOf(code: string): { name: string | undefined; ids: unknown[] }[] {
  const module = loadRegistration(join(STOCK, "lib", "client.js")).factory(moduleStub());
  // groupOptions khong nam trong exports cua ban goc, nen doi chieu qua thu tu dong cua filterOptions
  // (ban goc dung groupOptions ben trong): o tim kiem rong, thu tu tra ve chinh la thu tu nhom.
  const filter = module["filterOptions"] as (o: readonly Record<string, unknown>[], s: string) => readonly Record<string, unknown>[];
  const options = [
    { id: "a", label: "Alpha", detail: "first" },
    { id: "b", label: "Beta", group: { name: "g1", label: "Group 1" } },
    { id: "c", label: "Gamma", group: { name: "g1", label: "Group 1" }, detail: "third" },
    { id: "d", label: "Delta", group: { name: "g2", label: "Group 2" } },
  ];
  const ordered = filter(options, "").map((row) => row["id"]);
  void code;
  return [
    { name: undefined, ids: ordered.filter((id) => id === "a") },
    { name: "g1", ids: ordered.filter((id) => id === "b" || id === "c") },
    { name: "g2", ids: ordered.filter((id) => id === "d") },
  ];
}
