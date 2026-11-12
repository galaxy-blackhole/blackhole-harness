/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test doi chung cho @galaxy-blackhole/gbh-client-ui-theme: CANON quy id CHI O DONG LOADER (moi lan
 *      xuat hien khac cua id goi la DU LIEU, giu id stock), tap export nua host, hai dong bom bang mau
 *      (so BYTE voi bundle goc), bo token CSS --dsw-* (so BYTE), 2 cho ngoi Settings, va ThemeRuntime A/B
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { normalizeBrand, sameAfterIdMap } from "../lib/brand-parity.ts";
import { ROW_CSS, THEME_SHEETS } from "../../packages/client/ui-theme/src/styles.ts";
import { normalizeFontFamily } from "../../packages/client/ui-theme/src/theme-settings.ts";

/** Thu muc goi cua ta. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-theme");
/** Thu muc goi goc trong cay runtime DSH (chi doc). */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-theme");
/** Ten package cua ta — id DUY NHAT o DONG LOADER (canon: quy id chi o do). */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-theme";
/** Ten package goc — khai o gbh.row.aliases, va van la DU LIEU trong artefact (tagId · dataset.plugin). */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-theme";
/** Sau goi ma ban goc khai o dsh.client.inject. */
const STOCK_CLIENT_INJECT = [
  "@deepseek-ai/dsh-client-connection",
  "@deepseek-ai/dsh-client-locale",
  "@deepseek-ai/dsh-client-shortcuts",
  "@deepseek-ai/dsh-client-ui-renderer",
  "@deepseek-ai/dsh-client-ui-settings",
  "@deepseek-ai/dsh-api-remotes",
];
/** Ma nguon bundle client goc. */
const STOCK_CLIENT = readFileSync(join(STOCK, "lib", "client.js"), "utf8");

/** Mot dang ky bat duoc tu bundle client. */
interface Registration {
  /** Id bundle tu khai. */
  id: string;
  /** Factory cua bundle. */
  factory: (require: (spec: string) => unknown) => Record<string, unknown>;
}

/**
 * Nap mot bundle .js trong window gia roi lay loi goi dang ky (moi lan nap = module TUOI).
 * @param path - duong dan bundle.
 * @returns loi goi dang ky { id, factory }.
 */
function loadRegistration(path: string): Registration {
  const seen: Registration[] = [];
  new Function("window", readFileSync(path, "utf8"))({
    __ModuleLoader__: {
      load: (registration: Registration): void => {
        seen.push(registration);
      },
    },
  });
  const first = seen[0];
  if (first === undefined) throw new Error("bundle khong dang ky gi: " + path);
  return first;
}

/** Ban ghi cua context gia dung cho CA HAI ben. */
interface ClientRecorder {
  /** Nhan hieu ung theo thu tu. */
  effects: string[];
  /** Ten slot da inject. */
  injected: string[];
  /** Cac lan register (kem tham so thu hai). */
  registered: { spec: Record<string, unknown>; component: unknown }[];
  /** Tu dien da dang ky. */
  dictionaries: { ns: string; copy: Record<string, Record<string, string>> }[];
  /** Service da cap. */
  provided: string[];
  /** Su kien da nghe. */
  listeners: string[];
}

/**
 * Chen mot document gia (du cho installThemeStyles + bootstrap doc body.style).
 * @returns ham don dep tra lai trang thai cu.
 */
function withFakeDocument(): () => void {
  const globals = globalThis as unknown as { document?: unknown };
  const before = globals.document;
  globals.document = {
    createElement: () => ({ dataset: {} as Record<string, string>, textContent: "", remove: (): void => undefined }),
    head: { appendChild: (): void => undefined },
    querySelector: (): unknown => null,
    body: { style: { getPropertyValue: (): string => "" } },
  };
  return () => {
    globals.document = before;
  };
}

/**
 * Dung context gia phia browser ghi lai moi dang ky (dung cho ca hai ben).
 * @returns cap { ctx, record }.
 */
function harness(): { ctx: Record<string, unknown>; record: ClientRecorder } {
  const record: ClientRecorder = { effects: [], injected: [], registered: [], dictionaries: [], provided: [], listeners: [] };
  const ctx: Record<string, unknown> = {
    effect: (run: () => unknown, label?: string): unknown => {
      record.effects.push(label ?? "?");
      return run();
    },
    emit: (): void => undefined,
    on: (event: string): (() => void) => {
      record.listeners.push(event);
      return () => undefined;
    },
    provide: (name: string): void => {
      record.provided.push(name);
    },
    inject: (_services: readonly string[], callback: (scope: unknown) => void): void => {
      callback({ shortcuts: { runtime: "web" }, locale: { bind: () => (key: string): string => key }, effect: (): void => undefined });
    },
    locale: {
      register: (ns: string, copy: Record<string, Record<string, string>>): (() => void) => {
        record.dictionaries.push({ ns, copy });
        return () => undefined;
      },
      bind: (): ((key: string) => string) => (key: string) => key,
    },
    slots: {
      inject: (name: string, register: () => unknown): unknown => {
        record.injected.push(name);
        return register();
      },
      register: (spec: Record<string, unknown>, component: unknown): (() => void) => {
        record.registered.push({ spec, component });
        return () => undefined;
      },
    },
    configForms: {
      get: (): Record<string, unknown> => ({
        getSnapshot: (): { value: undefined } => ({ value: undefined }),
        set: (): Promise<void> => Promise.resolve(),
        mutate: (): Promise<void> => Promise.resolve(),
        subscribe: (): (() => void) => () => undefined,
      }),
    },
  };
  return { ctx, record };
}

/**
 * Require gia dung CHUNG cho hai ben.
 * @returns ham require.
 */
function moduleStub(): (spec: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown => ({ type, key, props: props ?? {} });
  const react = {
    Fragment: "Fragment",
    useState: (initial: unknown): [unknown, () => void] => [initial, () => undefined],
    useId: (): string => "id",
    useEffect: (): void => undefined,
  };
  const primitives = {
    IconLightOutlineMedium: "IconLight",
    IconDarkOutlineMedium: "IconDark",
    IconFollowsystemOutlineMedium: "IconFollowSystem",
    IconChevronUpOutlineRegular: "IconChevronUp",
    IconChevronDownOutlineRegular: "IconChevronDown",
    Input: "Input",
  };
  const store = {
    defineStore: (spec: { init: () => unknown; actions: Record<string, unknown> }): Record<string, unknown> => {
      const draft = spec.init();
      const actions: Record<string, unknown> = {};
      for (const [name, fn] of Object.entries(spec.actions)) {
        actions[name] = (...args: unknown[]): void => (fn as (d: unknown, ...rest: unknown[]) => void)(draft, ...args);
      }
      return { create: () => ({ actions }) };
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
 * Chuan hoa gia tri de so cau truc giua hai ben.
 * @param value - gia tri bat ky.
 * @returns gia tri da chuan hoa.
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

/**
 * Chi so dong `window.__ModuleLoader__.load({` — moc cua phan THAN bundle (bo header sinh tu dong).
 * @param code - van ban bundle (cua ta hoac ban goc).
 * @returns chi so dong loader (0-based).
 * @throws khi bundle khong co dung khung loader.
 */
function loaderLineIndex(code: string): number {
  const at = code.split("\n").findIndex((line) => line.trim() === "window.__ModuleLoader__.load({");
  if (at < 0) throw new Error("bundle khong co khung loader");
  return at;
}

/**
 * Dem so lan mot chuoi xuat hien trong van ban (khong chong lan).
 * @param text - van ban can dem.
 * @param needle - chuoi can dem.
 * @returns so lan xuat hien.
 */
function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Moi dong mang id stock cua mot bundle, BO dong id cua loader.
 *
 * CANON 20/10/2026: quy id CHI O DONG LOADER; moi lan xuat hien khac cua id goi la DU LIEU
 * (tagId CSS module · dataset.plugin · PLUGIN_ID · nhan) nen GIU NGUYEN id stock nhu ban goc.
 * @param code - van ban bundle.
 * @param stockName - id goi goc.
 * @returns cac dong du lieu mang id stock, da chuan hoa brand, dung thu tu.
 */
function stockDataLines(code: string, stockName: string): string[] {
  const idAt = loaderLineIndex(code) + 1;
  return code
    .split("\n")
    .filter((line, index) => index !== idAt && line.includes(stockName))
    .map((line) => normalizeBrand(line));
}

/**
 * Ten slot nguyen van cua mot doan ma (dung CHINH hai regex cua check:rows).
 * @param text - ma nguon.
 * @returns ten slot da sap xep.
 */
function slotsOf(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  return [...out].sort();
}

/**
 * Doc toan bo file .ts trong src/ cua goi (giong readAllTs cua check:rows).
 * @param dir - thu muc can quet.
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

/**
 * Rut mot chuoi CSS gan cho mot bien trong bundle goc.
 * @param varName - ten bien (vi du base_css_default).
 * @returns van ban CSS da giai ma.
 */
function cssOf(varName: string): string {
  // Tim theo CHUOI (ten bien co the chua ${} nen khong dung regex: ${} la neo cuoi chuoi).
  const marker = varName + " = \"";
  let start = STOCK_CLIENT.indexOf("const " + marker);
  let prefix = 6;
  if (start < 0) {
    start = STOCK_CLIENT.indexOf("var " + marker);
    prefix = 4;
  }
  if (start < 0) throw new Error("khong thay " + varName);
  // start tro vao TIEN TO khai bao nen phai cong ca do (const = 6 ky tu, var = 4).
  const from = start + prefix + marker.length;
  let end = from;
  while (end < STOCK_CLIENT.length) {
    if (STOCK_CLIENT[end] === "\\") {
      end += 2;
      continue;
    }
    if (STOCK_CLIENT[end] === '"') break;
    end += 1;
  }
  return JSON.parse('"' + STOCK_CLIENT.slice(from, end) + '"') as string;
}

/**
 * Rut doi tuong literal (bang lop CSS) tu bundle goc.
 * @param marker - doan mo dau truoc dau {.
 * @returns doi tuong da dung.
 */
function objectLiteral(marker: string): Record<string, string> {
  const start = STOCK_CLIENT.indexOf(marker);
  if (start < 0) throw new Error("khong thay " + marker);
  const open = STOCK_CLIENT.indexOf("{", start);
  const end = STOCK_CLIENT.indexOf("};", open);
  return new Function("return " + STOCK_CLIENT.slice(open, end + 1))() as Record<string, string>;
}

describe("row ui-theme — khuon bundle", () => {
  test("dong loader dang ky DUNG MOT id (id cua ta); id goc chi con la DU LIEU, bang dung ban goc; khong ESM", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids: string[] = [];
    new Function("window", code)({ __ModuleLoader__: { load: (registration: { id: string }): void => { ids.push(registration.id); } } });
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_NAME);
    // 20/10/2026 — CANON: quy id CHI O DONG LOADER. Dong loader mang DUNG id cua ta; moi lan xuat hien khac
    //   cua id goi la DU LIEU (tagId CSS module · dataset.plugin · PLUGIN_ID) nen GIU id stock nhu ban goc.
    const lines = code.split("\n");
    const loaderAt = loaderLineIndex(code);
    expect(lines[loaderAt]).toBe("window.__ModuleLoader__.load({");
    expect(lines[loaderAt + 1]).toBe('\tid: "' + PACKAGE_NAME + '",');
    // (a) 0 id stock O DONG LOADER …
    expect(lines[loaderAt + 1]?.includes(STOCK_NAME)).toBe(false);
    // (b) … con N lan con lai la DU LIEU: dem DUNG so lan cua bundle goc (hon ta dung MOT lan o loader),
    //     va DANH SACH dong du lieu NGUYEN VAN nhu ban goc sau khi chi thay dong loader.
    // 08/11/2026 (Lead duyệt): id stock chỉ được ĐẾM trong NGỮ CẢNH ĐĂNG KÝ (loader/define/register/require);
    //   các lần xuất hiện còn lại là DỮ LIỆU (tagId CSS module · dataset.plugin · PLUGIN_ID) và phải GIỮ
    //   đúng như bản gốc — assertion cũ `occurrences(code, STOCK_NAME)).toBe(0)` tự mâu thuẫn với comment
    //   canon ngay trên nó (dòng 325-326) nên đã sửa theo quyết định của Lead, KHÔNG đổi dữ liệu parts.
    const registrationContext = code
      .split("\n")
      .filter((line) => /load\(|define\(|register\(|require\(/.test(line))
      .join("\n");
    expect(occurrences(registrationContext, STOCK_NAME)).toBe(0);
    // Số dòng DỮ LIỆU mang id stock phải BẰNG ĐÚNG bản gốc (không nhiều hơn, không ít hơn).
    expect(stockDataLines(code, STOCK_NAME)).toEqual(stockDataLines(STOCK_CLIENT, STOCK_NAME));
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
  });

  test("package.json: mot id module · aliases giu id goc · inject khop ban goc SAU KHI QUY ID (sau goi) + immediately", () => {
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      exports: Record<string, string>;
      dsh: { client: { inject: string[]; platform: string; immediately: boolean } };
      gbh: { row: { id: string; moduleIds: string[]; aliases: string[]; tests: string[] } };
    };
    expect(meta.gbh.row.id).toBe("ui-theme");
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
    expect(meta.gbh.row.tests).toEqual(["tests/client/ui-theme.test.ts"]);
    // 20/10/2026 — id inject đã REWRITE CÓ CHỦ ĐÍCH sang id GBH; quy id ta -> id stock rồi so SÂU cả client
    // (đúng sau gói, đúng thứ tự, platform + immediately), giữ literal stock làm chuẩn.
    expect(sameAfterIdMap(meta.dsh.client, { inject: STOCK_CLIENT_INJECT, platform: "web", immediately: true })).toBe(true);
    expect(meta.dsh.client.platform).toBe("web");
    expect(meta.dsh.client.immediately).toBe(true);
    expect(meta.exports["./client"]).toBe("./lib/client.js");
  });

  test("nua host export DUNG tap export cua ban goc (10 ten)", async () => {
    const stock = (await import(join(STOCK, "lib", "index.js"))) as Record<string, unknown>;
    const ours = (await import(join(OURS, "lib", "index.js"))) as Record<string, unknown>;
    const names = (mod: Record<string, unknown>): string[] => Object.keys(mod).filter((key) => key !== "default").sort();
    const expected = [
      "Config",
      "DEFAULT_FONT_SIZE",
      "DEFAULT_PREFERENCE",
      "FONT_SIZE_FIELD",
      "FONT_SIZE_MAX",
      "FONT_SIZE_MIN",
      "THEME_PREFERENCES",
      "THEME_PREFERENCE_FIELD",
      "THEME_SETTINGS_NAMESPACE",
      "apply",
    ];
    expect(names(stock)).toEqual(expected);
    expect(names(ours)).toEqual(expected);
    expect(ours.DEFAULT_FONT_SIZE as number).toBe(stock.DEFAULT_FONT_SIZE as number);
    expect(ours.DEFAULT_PREFERENCE as string).toBe(stock.DEFAULT_PREFERENCE as string);
    expect(ours.FONT_SIZE_FIELD as string).toBe(stock.FONT_SIZE_FIELD as string);
    expect(ours.THEME_PREFERENCE_FIELD as string).toBe(stock.THEME_PREFERENCE_FIELD as string);
    expect(ours.THEME_SETTINGS_NAMESPACE as string).toBe(stock.THEME_SETTINGS_NAMESPACE as string);
    expect(ours.THEME_PREFERENCES as string[]).toEqual(stock.THEME_PREFERENCES as string[]);
    expect(ours.FONT_SIZE_MIN as number).toBe(stock.FONT_SIZE_MIN as number);
    expect(ours.FONT_SIZE_MAX as number).toBe(stock.FONT_SIZE_MAX as number);
    expect(ours.Config).toBeDefined();
  });

  test("tap slot cua ta BANG tap slot cua chinh bundle goc", () => {
    const stockSlots = slotsOf(STOCK_CLIENT);
    const ours = slotsOf(readAllTs(join(OURS, "src")));
    expect(stockSlots).toEqual(["settings.general.item"]);
    expect(ours).toEqual(stockSlots);
  });
});

describe("row ui-theme — bo token CSS --dsw-* (so BYTE voi bundle goc)", () => {
  test("tam sheet global trung NGUYEN VAN tung byte + dung thu tu cua ban goc", () => {
    const expected: [string, string][] = [
      ["base.css", cssOf("base_css_default")],
      ["corner-shape.css", cssOf("corner_shape_css_default")],
      ["design-platform.css", cssOf("design_platform_css_default")],
      ["focus.css", cssOf("focus_css_default")],
      ["onboarding.css", cssOf("onboarding_css_default")],
      ["scrollbar.css", cssOf("scrollbar_css_default")],
      ["gradient-shadow-text.css", cssOf("gradient_shadow_text_css_default")],
      ["shiki.css", cssOf("shiki_css_default")],
    ];
    expect(THEME_SHEETS.map((sheet) => sheet.name)).toEqual(expected.map(([name]) => name));
    for (const [index, [name, css]] of expected.entries()) {
      expect(THEME_SHEETS[index]?.css).toBe(css);
      expect(name.length).toBeGreaterThan(3);
    }
  });

  test("bon module CSS cua row trung NGUYEN VAN + bang lop giu hash goc", async () => {
    // String(...) hai ve: bun gan kieu literal cho gia tri tra ve nen toBe tu choi chuoi thuong.
    expect(String(ROW_CSS.appearance)).toBe(String(cssOf("css$3")));
    expect(String(ROW_CSS.fontSize)).toBe(String(cssOf("css$2")));
    expect(String(ROW_CSS.fontFamily)).toBe(String(cssOf("css$1")));
    expect(String(ROW_CSS.fontSettingsGroup)).toBe(String(cssOf("css")));
    const classes = (await import(join(OURS, "src", "class-names.ts"))) as Record<string, Record<string, string>>;
    expect(classes.APPEARANCE_CLASS).toEqual(objectLiteral("var AppearanceRow_module_css_default = "));
    expect(classes.FONT_SIZE_CLASS).toEqual(objectLiteral("var FontSizeRow_module_css_default = "));
    expect(classes.FONT_FAMILY_CLASS).toEqual(objectLiteral("var FontFamilyRow_module_css_default = "));
    expect(classes.FONT_SETTINGS_GROUP_CLASS).toEqual(objectLiteral("var FontSettingsGroup_module_css_default = "));
  });

  test("toan bo token --dsw-* cua ban goc co mat trong bo sheet cua ta", () => {
    const stockTokens = new Set(STOCK_CLIENT.match(/--dsw-[a-z0-9-]+/gu) ?? []);
    const ourCss = [...THEME_SHEETS.map((sheet) => sheet.css), ...Object.values(ROW_CSS)].join("");
    expect([...stockTokens].filter((token) => !ourCss.includes(token))).toEqual([]);
    expect(stockTokens.size).toBeGreaterThan(300);
  });
});

describe("row ui-theme — hai dong bom bang mau (A/B voi CHINH bundle host goc)", () => {
  /** Cau hinh gia cua mot lan do. */
  interface BootConfig {
    preference: string;
    fontSize: number;
    codeFontSize: number;
    terminalFontSize: number;
    textFontFamily: string;
    codeFontFamily: string;
    terminalFontFamily: string;
  }
  /**
   * Chay apply cua mot ben voi cau hinh gia roi tra bang dong bom index.
   * @param modPath - duong dan lib/index.js cua ben can chay.
   * @param config - cau hinh gia.
   * @returns bang dong bom.
   */
  async function bootRows(modPath: string, config: BootConfig): Promise<unknown[]> {
    const mod = (await import(modPath)) as { apply: (ctx: unknown, config: unknown) => void };
    const table: unknown[] = [];
    const ctx = {
      inject: (_services: readonly string[], callback: (scope: unknown) => void): void => {
        callback({
          effect: (effect: () => void | (() => void)): void => {
            effect();
          },
          settings: { configure: (): void => undefined },
        });
      },
      on: (_event: string, listener: (rows: unknown[]) => void): void => {
        listener(table);
      },
      fiber: undefined,
    };
    const volatile = (value: unknown): { get: () => unknown } => ({ get: () => value });
    mod.apply(ctx, {
      preference: volatile(config.preference),
      fontSize: volatile(config.fontSize),
      codeFontSize: volatile(config.codeFontSize),
      terminalFontSize: volatile(config.terminalFontSize),
      textFontFamily: volatile(config.textFontFamily),
      codeFontFamily: volatile(config.codeFontFamily),
      terminalFontFamily: volatile(config.terminalFontFamily),
    });
    return table;
  }

  test("ba cau hinh + font bat thuong: dong bom cua ta TRUNG TUNG BYTE voi goc", async () => {
    const cases: BootConfig[] = [
      { preference: "system", fontSize: 14, codeFontSize: 11, terminalFontSize: 13, textFontFamily: "", codeFontFamily: "", terminalFontFamily: "" },
      { preference: "light", fontSize: 18, codeFontSize: 16, terminalFontSize: 20, textFontFamily: "Inter, sans-serif", codeFontFamily: "JetBrains Mono", terminalFontFamily: "monospace" },
      { preference: "dark", fontSize: 10, codeFontSize: 10, terminalFontSize: 10, textFontFamily: 'Bad "quoted" <script>,  system-ui , ,', codeFontFamily: "a\\b", terminalFontFamily: "  " },
    ];
    for (const config of cases) {
      const stockRows = await bootRows(join(STOCK, "lib", "index.js"), config);
      const ourRows = await bootRows(join(OURS, "lib", "index.js"), config);
      expect(JSON.stringify(ourRows)).toBe(JSON.stringify(stockRows));
      expect(stockRows.length).toBe(2);
    }
  });

  test("chuan hoa danh sach font: ten thuong duoc boc ngoac kep, tu khoa chung thi khong", () => {
    expect(normalizeFontFamily("Inter")).toBe('"Inter"');
    expect(normalizeFontFamily("Inter, monospace")).toBe('"Inter", monospace');
    expect(normalizeFontFamily('bad "quoted" <x>')).toBe('"bad quoted x"');
    expect(normalizeFontFamily("  a   b  ")).toBe('"a b"');
    expect(normalizeFontFamily(" , , ")).toBe("");
    expect(normalizeFontFamily(normalizeFontFamily("Inter, sans-serif"))).toBe(normalizeFontFamily("Inter, sans-serif"));
  });
});

describe("row ui-theme — mat plugin (A/B voi chinh bundle client goc)", () => {
  test("apply cua ta va goc: cung hieu ung · cung 2 cho ngoi · cung tu dien · cung service theme", () => {
    const teardown = withFakeDocument();
    try {
      const stockHarness = harness();
      const stockPlugin = loadRegistration(join(STOCK, "lib", "client.js")).factory(moduleStub()) as unknown as { apply(ctx: unknown): void };
      stockPlugin.apply(stockHarness.ctx);
      const ourHarness = harness();
      const ourRegistration = loadRegistration(join(OURS, "lib", "client.js"));
      const ourPlugin = ourRegistration.factory(moduleStub()) as unknown as { apply(ctx: unknown): void; inject: string[] };
      ourPlugin.apply(ourHarness.ctx);

      expect(ourHarness.record.effects.length).toBeGreaterThanOrEqual(9);
      expect(ourHarness.record.effects.slice(0, 8)).toEqual(stockHarness.record.effects.slice(0, 8));
      expect(ourHarness.record.injected).toEqual(stockHarness.record.injected);
      expect(ourHarness.record.injected).toEqual(["settings.general.item", "settings.general.item"]);
      const specs = ourHarness.record.registered.map((entry) => entry.spec);
      expect(specs[0]).toMatchObject({ name: "settings.general.item", id: "appearance", order: 10, locale: "settings.theme" });
      expect(specs[1]).toMatchObject({ name: "settings.general.item", id: "font-size", order: 11, locale: "settings.theme" });
      expect(normalize(specs)).toEqual(normalize(stockHarness.record.registered.map((entry) => entry.spec)));
      expect(typeof ourHarness.record.registered[0]?.component).toBe("function");
      expect(typeof ourHarness.record.registered[1]?.component).toBe("function");
      // 22/10/2026: đã dọn khối từ điển viết tay cũ ⇒ còn MỘT lượt đăng ký đủ en/vi/zh cho settings.theme.
    expect(ourHarness.record.dictionaries.map((entry) => entry.ns)).toEqual(["settings.theme"]);
      // Phase 2 (task-2): gói này sở hữu CẢ BA ngữ — đăng ký hai lượt (zh+en rồi vi) để lần đăng ký vi
      // có thể ném trong lúc chuyển tiếp mà KHÔNG kéo theo zh/en.
      // 22/10/2026 (task-231): tu dien tieng Viet duoc CHEN vao artifact (tools/inject-vi-dictionary.ts)
      // nen luot dang ky dau mang ca ba ngu; luot thu hai la khoi viet tay vi (task-175) van con.
      expect(Object.keys(ourHarness.record.dictionaries[0]?.copy ?? {}).sort()).toEqual(["en", "vi", "zh"]);
      // 22/10/2026: khối từ điển viết tay cũ đã dọn ⇒ KHÔNG còn lượt đăng ký riêng chỉ có "vi";
      //   từ điển vi nằm trong CHÍNH lượt đăng ký en/vi/zh ở trên (đã kiểm ở dòng trước).
      expect(ourHarness.record.dictionaries.length).toBe(1);
      expect(ourHarness.record.provided).toEqual(["theme"]);
      expect(ourHarness.record.listeners).toEqual(["theme/change"]);
      expect([...ourPlugin.inject]).toEqual(["slots", "locale", "remote", "configForms"]);
      const face = ourRegistration.factory(moduleStub());
      expect(Object.keys(face).sort()).toEqual(["SETTINGS_NS", "ThemeRuntime", "apply", "inject"]);
      expect(face.SETTINGS_NS).toBe("settings.theme");
    } finally {
      teardown();
    }
  });
});

describe("row ui-theme — ThemeRuntime A/B voi CHINH lop cua bundle goc", () => {
  /**
   * Tao runtime cua mot ben tren cung mot gian gia.
   * @param path - bundle client can nap.
   * @returns runtime + danh sach su kien da phat.
   */
  function makeRuntime(path: string): { runtime: Record<string, unknown>; events: unknown[] } {
    const exportsObject = loadRegistration(path).factory(moduleStub());
    const Runtime = exportsObject.ThemeRuntime as new (ctx: unknown, host: unknown) => Record<string, unknown>;
    const events: unknown[] = [];
    // Host THAT luon tra section ĐẦY ĐỦ (schema đã áp mặc định) — fixture phải giống vậy,
    // nếu không thì adopt() của CẢ HAI bên đều ném như nhau (lỗi của phép đo, không phải của gói).
    const defaults = {
      preference: "system",
      fontSize: 14,
      codeFontSize: 11,
      terminalFontSize: 13,
      textFontFamily: "",
      codeFontFamily: "",
      terminalFontFamily: "",
    };
    let section: { value?: Record<string, unknown> } = { value: { ...defaults } };
    const host = {
      getSnapshot: (): { value?: Record<string, unknown> } => section,
      set: (field: string, value: unknown): Promise<void> => {
        section = { value: { ...defaults, ...section.value, [field]: value } };
        return Promise.resolve();
      },
      mutate: (): Promise<void> => Promise.resolve(),
      subscribe: (): (() => void) => () => undefined,
    };
    const ctx = {
      effect: (run: () => void | (() => void)): unknown => run(),
      emit: (_event: string, payload: unknown): void => {
        events.push(payload);
      },
      inject: (_services: readonly string[], callback: (scope: unknown) => void): void => {
        callback({ shortcuts: { runtime: "web" }, locale: { bind: () => (key: string): string => key }, effect: (): void => undefined });
      },
    };
    return { runtime: new Runtime(ctx, host), events };
  }

  /** Doc snapshot hien tai. */
  const snapshot = (runtime: Record<string, unknown>): unknown => (runtime.getTheme as () => unknown)();

  test("setTheme / setFontSize / setFontFamily / adjustFontSizes: snapshot TRUNG voi ban goc", () => {
    const stock = makeRuntime(join(STOCK, "lib", "client.js"));
    const ours = makeRuntime(join(OURS, "lib", "client.js"));
    expect(snapshot(ours.runtime)).toEqual(snapshot(stock.runtime));
    for (const runtime of [stock.runtime, ours.runtime]) {
      (runtime.setTheme as (id: string) => void)("dark");
      (runtime.setFontSize as (role: string, px: number) => void)("text", 18);
      (runtime.setFontFamily as (role: string, value: string) => void)("code", "JetBrains Mono, monospace");
      (runtime.adjustFontSizes as (delta: number) => void)(1);
    }
    expect(snapshot(ours.runtime)).toEqual(snapshot(stock.runtime));
    expect(stock.events.length).toBe(ours.events.length);
  });

  test("duong loi: id theme la · co chu ngoai khoang · override kieu chuoi tran — cung thong diep loi", () => {
    const stock = makeRuntime(join(STOCK, "lib", "client.js"));
    const ours = makeRuntime(join(OURS, "lib", "client.js"));
    /** Chay mot thao tac va tra thong diep loi (hoac undefined). */
    const message = (runtime: Record<string, unknown>, run: (r: Record<string, unknown>) => void): string | undefined => {
      try {
        run(runtime);
        return undefined;
      } catch (error) {
        return String((error as Error).message);
      }
    };
    const cases: ((r: Record<string, unknown>) => void)[] = [
      (r) => (r.setTheme as (id: string) => void)("nope"),
      (r) => (r.setFontSize as (role: string, px: number) => void)("text", 99),
      (r) => (r.overrideTokens as (s: string, t: unknown) => void)("pkg", { "--x": "#fff" }),
    ];
    for (const run of cases) {
      const ourMessage = message(ours.runtime, run);
      expect(ourMessage).toBe(message(stock.runtime, run));
      expect(ourMessage).toBeDefined();
    }
  });

  test("exportInspectTokens: cung danh muc 14 token dung san va cung thu tu sap xep", () => {
    const stock = makeRuntime(join(STOCK, "lib", "client.js"));
    const ours = makeRuntime(join(OURS, "lib", "client.js"));
    const tokens = (runtime: Record<string, unknown>): unknown => (runtime.exportInspectTokens as () => unknown)();
    expect(tokens(ours.runtime)).toEqual(tokens(stock.runtime));
    expect((tokens(ours.runtime) as unknown[]).length).toBe(14);
  });
});


describe("phase 2 (task-2): gói này sở hữu từ điển vi của namespace settings.theme", () => {
  /** Bảng vi ĐANG CHẠY trước phase 2 — chép từ packages/client/locale/src/locales-vi.ts (viTheme). */
  const VI_TRUOC_PHASE_2: Record<string, string> = {
    "appearance.dark": "Tối",
    "appearance.light": "Sáng",
    "appearance.system": "Theo hệ thống",
    "appearance.title": "Giao diện",
    "fontFamily.code.description": "Dùng cho khối mã, mã trong dòng và kết quả công cụ. Ngăn cách nhiều phông bằng dấu phẩy; để trống để dùng mặc định",
    "fontFamily.code.title": "Phông chữ mã",
    "fontFamily.placeholder": "Mặc định",
    "fontFamily.terminal.description": "Dùng cho terminal ở thanh bên. Ngăn cách nhiều phông bằng dấu phẩy; để trống để dùng mặc định",
    "fontFamily.terminal.title": "Phông chữ terminal",
    "fontFamily.text.description": "Dùng cho giao diện và nội dung hội thoại. Ngăn cách nhiều phông bằng dấu phẩy; để trống để dùng mặc định",
    "fontFamily.text.title": "Phông chữ văn bản",
    "fontSize.code.decrease": "Giảm cỡ chữ mã",
    "fontSize.code.description": "Dùng cho khối mã, mã trong dòng và kết quả công cụ",
    "fontSize.code.increase": "Tăng cỡ chữ mã",
    "fontSize.code.title": "Cỡ chữ mã",
    "fontSize.decrease": "Giảm cỡ chữ",
    "fontSize.description": "Chỉ ảnh hưởng nội dung hội thoại",
    "fontSize.increase": "Tăng cỡ chữ",
    "fontSize.more": "Thêm cài đặt cỡ chữ",
    "fontSize.terminal.decrease": "Giảm cỡ chữ terminal",
    "fontSize.terminal.description": "Dùng cho terminal ở thanh bên",
    "fontSize.terminal.increase": "Tăng cỡ chữ terminal",
    "fontSize.terminal.title": "Cỡ chữ terminal",
    "fontSize.text.decrease": "Giảm cỡ chữ",
    "fontSize.text.description": "Chỉ ảnh hưởng nội dung hội thoại",
    "fontSize.text.increase": "Tăng cỡ chữ",
    "fontSize.text.title": "Cỡ chữ",
    "fontSize.title": "Cỡ chữ",
    "fontSize.unit": "px",
  };

  test("vi của gói = NGUYÊN VĂN bảng đang chạy trước phase 2 (29 khoá, 0 chuỗi lệch)", async () => {
    const locales = (await import("../../packages/client/ui-theme/src/locales.ts")) as { vi: Record<string, string> };
    expect(Object.keys(locales.vi).sort()).toEqual(Object.keys(VI_TRUOC_PHASE_2).sort());
    for (const [key, value] of Object.entries(VI_TRUOC_PHASE_2)) {
      expect(locales.vi[key]).toBe(value);
    }
    // 29 khoá = 25 khoá gốc + 4 khoá chỉ có ở bản vi tập trung (giữ nguyên để hiển thị không đổi).
    expect(Object.keys(locales.vi)).toHaveLength(29);
  });
});

describe("phase 2 (task-2): chuyển tiếp an toàn khi bản tập trung CÒN đăng ký vi", () => {
  test("vi nam TRONG luot dang ky tu dien dau tien (task-231) nen khong con ca va cham locale", () => {
    // 22/10/2026 (task-231): tools/inject-vi-dictionary.ts gop vi vao CUNG loi goi register voi zh/en,
    // nen tinh huong "ban tap trung da giu vi ⇒ dang ky vi nem" khong con xay ra nua.
    const harnessed = harness();
    const plugin = loadRegistration(join(OURS, "lib", "client.js")).factory(moduleStub()) as unknown as { apply(ctx: unknown): void };
    expect(() => plugin.apply(harnessed.ctx)).not.toThrow();
    const first = harnessed.record.dictionaries[0]?.copy ?? {};
    expect(Object.keys(first).sort()).toEqual(["en", "vi", "zh"]);
    // Row van dang ky DU hai cho ngoi + van cap service theme.
    expect(harnessed.record.registered.map((entry) => entry.spec["id"])).toEqual(["appearance", "font-size"]);
    expect(harnessed.record.provided).toEqual(["theme"]);
  });
});


