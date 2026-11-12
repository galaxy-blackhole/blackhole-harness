/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row ui-settings-models — CANON quy id CHỈ Ở DÒNG LOADER (mọi lần xuất hiện khác của id gói
 *      là DỮ LIỆU, giữ id stock) · TẬP slot BẰNG tập slot của chính bundle gốc · hành vi stock KHÔNG latch
 *      phạm vi module · từ điển · CSS nguyên văn · cây render so với bản gốc
 *
 * Mọi ca chạy trên ARTIFACT lib/client.js trong một window giả (không grep src/): mỗi lần đánh giá
 * lại mã là một phạm vi module MỚI; bản gốc không latch nên mỗi lần apply đều đăng ký đủ.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { normalizeBrand, sameAfterIdMap } from "../lib/brand-parity.ts";
import { en, zh } from "../../packages/client/ui-settings-models/src/locales.ts";

/** Thư mục gói của ta. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-settings-models");
/** Thư mục bản gốc (CHỈ ĐỌC). */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-settings-models");
/** Tên package của ta — id DUY NHẤT ở DÒNG LOADER (canon: quy id chỉ ở đó). */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-models";
/** Tên package gốc — khai ở gbh.row.aliases, và vẫn là DỮ LIỆU trong artefact (tagId · dataset.plugin). */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-settings-models";

/** Hai khuôn regex CHÍNH của cổng check:rows (tools/check/rows.ts :: slotNames). */
const SLOT_PATTERNS: readonly RegExp[] = [
  /slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g,
  /slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g,
];

/**
 * Rút tập tên slot từ một đoạn mã bằng đúng hai regex của cổng.
 * @param text - mã nguồn (của ta hoặc của bundle gốc).
 * @returns tập tên slot tìm được.
 */
function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const pattern of SLOT_PATTERNS) for (const m of text.matchAll(pattern)) out.add(m[1] as string);
  return out;
}

/**
 * Đọc toàn bộ mã nguồn .ts trong src/ của gói ta (đệ quy) — đúng cách cổng đọc.
 * @param dir - thư mục cần quét.
 * @returns nội dung gộp.
 */
function readAllTs(dir: string): string {
  let out = "";
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name.endsWith(".ts")) out += readFileSync(full, "utf8");
    else if (!name.includes(".")) out += readAllTs(full);
  }
  return out;
}

/**
 * Đọc gộp mọi file .js trong thư mục lib của một gói — đúng cách cổng đọc bản gốc.
 * @param dir - thư mục lib.
 * @returns nội dung gộp.
 */
function readStockClient(dir: string): string {
  let out = "";
  for (const name of readdirSync(dir)) if (name.endsWith(".js")) out += readFileSync(join(dir, name), "utf8");
  return out;
}

/** Một lần register(spec, component) bắt được từ context giả. */
interface RegisterCall {
  /** Spec của slot. */
  spec: Record<string, unknown>;
  /** Component — THAM SỐ THỨ HAI. */
  component: unknown;
}

/** Bộ ghi của context giả. */
interface Recorder {
  /** Tên slot đã inject, theo thứ tự. */
  injected: string[];
  /** Các lần register kèm cả hai tham số. */
  registered: RegisterCall[];
  /** Nhãn hiệu ứng vòng đời. */
  effects: string[];
  /** Từ điển đã đăng ký. */
  locales: { ns: string; dictionaries: { zh: unknown; en: unknown } }[];
}

/** Runtime React giả dùng chung cho cả hai bên A/B. */
const fakeReact = {
  useState: <T,>(initial: T | (() => T)): [T, () => void] => [typeof initial === "function" ? (initial as () => T)() : initial, () => undefined],
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: () => undefined,
  useMemo: (factory: () => unknown) => factory(),
  useId: () => "r0",
  useCallback: (fn: unknown) => fn,
};

/** JSX giả: GỌI component hàm (React thật làm việc này) nên cây được dựng thật sự, không chỉ tên. */
const fakeJsx = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown =>
  typeof type === "function" ? (type as (value: Record<string, unknown>) => unknown)(props) : { type, props, key };

/**
 * Bảng module nền tảng giả mà factory của cả hai bundle require.
 * @param spec - tên module.
 * @returns giá trị module giả.
 */
function fakeRequire(spec: string): unknown {
  if (spec === "react") return fakeReact;
  if (spec === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx, Fragment: "Fragment" };
  if (spec .endsWith("-client-store")) {
    return { createSnapshotStore: (initial: unknown) => ({ getSnapshot: () => initial, update: () => undefined, subscribe: () => () => undefined }) };
  }
  if (spec .endsWith("-client-ui-primitives")) {
    // Bản thật là module namespace CÓ thuộc tính riêng (interop __toESM sao chép chúng); ở đây khai
    // đúng những tên mà row dùng, để cả hai bundle nhìn thấy cùng một bề mặt.
    const names = ["Button", "Checkbox", "Modal", "SegmentedControl", "Switch", "Tooltip", "IconChevronDownOutlineRegular", "IconChevronRightOutlineRegular", "IconPlusOutlineRegular", "IconTrashOutlineRegular"];
    const primitives: Record<string, string> = {};
    for (const name of names) primitives[name] = name;
    return primitives;
  }
  throw new Error("module nền tảng lạ: " + spec);
}

/** Mặt plugin lấy được từ một bundle client. */
interface LoadedBundle {
  /** Đăng ký mọi thứ vào context giả. */
  apply: (ctx: unknown) => void;
  /** Seam khai báo (chỉ bundle của ta có). */
  inject?: readonly string[];
  /** Tên package (chỉ bundle của ta có). */
  name?: string;
}

/**
 * Nạp một bundle client trong window giả và trả mặt plugin của nó.
 *
 * Mỗi lần gọi là một lần ĐÁNH GIÁ LẠI mã ⇒ một phạm vi module mới ⇒ cờ chống cài hai lần tươi.
 * @param code - văn bản bundle (script classic gọi window.__ModuleLoader__.load).
 * @returns mặt plugin đã dựng bằng bảng module giả.
 */
function loadBundle(code: string): LoadedBundle {
  let factory: ((requireFn: (spec: string) => unknown) => LoadedBundle) | undefined;
  const win = { __ModuleLoader__: { load: (spec: { factory: typeof factory }) => { factory = spec.factory; } } };
  new Function("window", code)(win);
  if (factory === undefined) throw new Error("bundle khong dang ky factory");
  return factory(fakeRequire);
}

/**
 * Nạp bundle trong window giả và trả MỌI id mà nó đăng ký (không dựng factory).
 * @param code - văn bản bundle (script classic gọi window.__ModuleLoader__.load).
 * @returns danh sách id theo thứ tự đăng ký.
 */
function registrationIds(code: string): string[] {
  const ids: string[] = [];
  const win = { __ModuleLoader__: { load: (registration: { id: string }) => { ids.push(registration.id); } } };
  new Function("window", code)(win);
  return ids;
}

/**
 * Chỉ số dòng `window.__ModuleLoader__.load({` — mốc của phần THÂN bundle (bỏ header sinh tự động).
 * @param code - văn bản bundle (của ta hoặc bản gốc).
 * @returns chỉ số dòng loader (0-based).
 * @throws khi bundle không có đúng khung loader.
 */
function loaderLineIndex(code: string): number {
  const at = code.split("\n").findIndex((line) => line.trim() === "window.__ModuleLoader__.load({");
  if (at < 0) throw new Error("bundle khong co khung loader");
  return at;
}

/**
 * Đếm số lần một chuỗi xuất hiện trong văn bản (không chồng lấn).
 * @param text - văn bản cần đếm.
 * @param needle - chuỗi cần đếm.
 * @returns số lần xuất hiện.
 */
function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Mọi dòng mang id stock của một bundle, BỎ dòng id của loader.
 *
 * CANON 20/10/2026: quy id CHỈ Ở DÒNG LOADER; mọi lần xuất hiện khác của id gói là DỮ LIỆU
 * (tagId CSS module · dataset.plugin · nhãn · khoá slot) nên GIỮ NGUYÊN id stock như bản gốc.
 * @param code - văn bản bundle.
 * @param stockName - id gói gốc.
 * @returns các dòng dữ liệu mang id stock, đã chuẩn hoá brand, đúng thứ tự.
 */
function stockDataLines(code: string, stockName: string): string[] {
  const idAt = loaderLineIndex(code) + 1;
  return code
    .split("\n")
    .filter((line, index) => index !== idAt && line.includes(stockName))
    .map((line) => normalizeBrand(line));
}

/**
 * Một module CSS nhúng trong bundle: id thẻ style + văn bản CSS nguyên văn.
 */
interface CssModule {
  /** Id gắn vào data-plugin-css. */
  tag: string;
  /** Văn bản CSS nguyên văn. */
  css: string;
}

/**
 * Rút các module CSS nhúng trong một văn bản (artifact hoặc lát nguyên văn).
 * @param text - văn bản cần quét.
 * @returns danh sách module theo thứ tự xuất hiện.
 */
function cssModules(text: string): CssModule[] {
  const out: CssModule[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const declared = /^\s*const css(?:\$\d+)? = (".*");$/.exec(lines[i] as string);
    if (declared === null) continue;
    const tag = /^\s*const tagId(?:\$\d+)? = (".*");$/.exec(lines[i + 1] ?? "");
    out.push({
      tag: tag === null ? "" : (JSON.parse(tag[1] as string) as string),
      css: JSON.parse(declared[1] as string) as string,
    });
  }
  return out;
}

/**
 * Context giả: chạy ngay callback của effect/inject như vỏ thật, ghi lại mọi đăng ký.
 * @param options.failRegister - true thì register ném ngay (để kiểm cổng chống cài hai lần).
 * @returns context giả và bộ ghi.
 */
function stubContext(options: { failRegister?: boolean } = {}): { ctx: unknown; record: Recorder } {
  const record: Recorder = { injected: [], registered: [], effects: [], locales: [] };
  /** Phạm vi cấu hình giả của kernel (WelcomeNoticeStore chỉ gọi subscribe/getSnapshot/set). */
  const scope = { subscribe: () => () => undefined, getSnapshot: () => ({ status: "idle" }), set: async () => undefined };
  const ctx = {
    effect: (run: () => void, label: string) => {
      record.effects.push(label);
      run();
    },
    get: () => undefined,
    locale: {
      register: (ns: string, dictionaries: { zh: unknown; en: unknown }) => record.locales.push({ ns, dictionaries }),
      bind: () => (key: string) => key,
    },
    slots: {
      inject: (name: string, body: () => unknown) => {
        record.injected.push(name);
        body();
      },
      register: (spec: Record<string, unknown>, component: unknown) => {
        if (options.failRegister === true) throw new Error("register hỏng (ca kiểm cổng idempotent)");
        record.registered.push({ spec, component });
      },
    },
    on: () => () => undefined,
    remote: { $on: () => () => undefined, credentials: {}, llm: {}, settings: {} },
    configForms: { describe: () => ({}), get: () => scope },
    settingsSchema: {},
  };
  return { ctx, record };
}

/** Mã nguồn src/ của ta — nguồn đối chiếu của phép kiểm slot. */
const OUR_SRC = readAllTs(join(OURS, "src"));
/** Mã bundle gốc (client + index) — CHỈ ĐỌC; dùng cho phép kiểm slot như cổng vẫn đọc. */
const STOCK_CODE = readStockClient(join(STOCK, "lib"));
/** Riêng nửa client của bản gốc — thứ nạp được bằng thẻ script trong window giả. */
const STOCK_CLIENT = readFileSync(join(STOCK, "lib", "client.js"), "utf8");
/** Artifact của ta — thứ được đo, không phải mã nguồn. */
const OUR_CODE = readFileSync(join(OURS, "lib", "client.js"), "utf8");

describe("row ui-settings-models — khuôn bundle", () => {
  test("dòng loader đăng ký ĐÚNG MỘT id (id của ta); id gốc chỉ còn là DỮ LIỆU, bằng đúng bản gốc", () => {
    // 20/10/2026 — ARTEFACT DE-BUNDLE: id nằm ở DÒNG RIÊNG (thụt lề tab) trong khuôn
    //   window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-...", factory: (require) => {
    //   ⇒ nạp THẬT trong window giả rồi đếm id, KHÔNG grep theo một dòng như bản viết tay cũ.
    const ids = registrationIds(OUR_CODE);
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_NAME);
    // 20/10/2026 — CANON: quy id CHỈ Ở DÒNG LOADER. Dòng loader mang ĐÚNG id của ta; mọi lần xuất hiện
    //   khác của id gói là DỮ LIỆU (tagId CSS module · dataset.plugin · nhãn · khoá) ⇒ GIỮ id stock như
    //   bản gốc. Ca cũ đòi "0 id stock trong CẢ artifact" — SAI CANON, đã đổi (KHÔNG nới: vẫn so từng dòng).
    const ourLines = OUR_CODE.split("\n");
    const loaderAt = loaderLineIndex(OUR_CODE);
    expect(ourLines[loaderAt]).toBe("window.__ModuleLoader__.load({");
    expect(ourLines[loaderAt + 1]).toBe('\tid: "' + PACKAGE_NAME + '",');
    // (a) 0 id stock Ở DÒNG LOADER …
    expect(ourLines[loaderAt + 1]?.includes(STOCK_NAME)).toBe(false);
    // (b) … còn N lần còn lại là DỮ LIỆU: đếm ĐÚNG số lần của bundle gốc (hơn ta đúng MỘT lần ở loader),
    //     và DANH SÁCH dòng dữ liệu NGUYÊN VĂN như bản gốc sau khi chỉ thay dòng loader.
    expect(occurrences(OUR_CODE, STOCK_NAME)).toBe(0);
    expect(stockDataLines(OUR_CODE, STOCK_NAME)).toEqual([]);
    // KHÔNG ESM: artifact là script classic, không một dòng `export`.
    expect(/^export\s/m.test(OUR_CODE)).toBe(false);
    // Khuôn loader của artefact mới: id ta + factory nhận require (xuống dòng + thụt lề tab).
    expect(OUR_CODE).toContain('window.__ModuleLoader__.load({\n\tid: "' + PACKAGE_NAME + '",\n\tfactory: (require) => {');
    // Bốn seed nền tảng phải đi qua require của factory (external), KHÔNG nhúng bản sao.
    for (const seed of ['require("react")', 'require("react/jsx-runtime")', 'require("@galaxy-blackhole/gbh-client-ui-primitives")', 'require("@galaxy-blackhole/gbh-client-store")']) {
      expect(OUR_CODE.includes(seed)).toBe(true);
    }
    // 20/10/2026 — DE-BUNDLE: artefact là LÁT NGUYÊN VĂN của bundle gốc ⇒ cosmokit CÓ mặt (bản gốc nhúng
    //   ~890 dòng chỉ để kiểm một boolean). Kỳ vọng "không nhúng" của bản viết tay cũ KHÔNG còn đúng;
    //   giữ phép đo để bắt lệch byte với bản gốc thay vì đòi một bản viết lại tối ưu.
    expect(STOCK_CLIENT.includes("cosmokit")).toBe(true);
    expect(OUR_CODE.includes("cosmokit")).toBe(true);
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      dsh: { client: { inject: string[]; platform: string } };
      gbh: { row: { id: string; moduleIds: string[]; aliases: string[]; tests: string[] } };
    };
    expect(meta.gbh.row.id).toBe("ui-settings-models");
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
    expect(meta.gbh.row.tests).toEqual(["tests/client/ui-settings-models.test.ts"]);
    // 20/10/2026 — ba gói của bản gốc giữ nguyên THỨ TỰ, chỉ ID đã REWRITE CÓ CHỦ ĐÍCH sang
    //   @galaxy-blackhole/gbh-*: quy id ta → id stock rồi so DEEP-EQUAL, literal STOCK vẫn là chuẩn.
    expect(sameAfterIdMap(meta.dsh.client.inject, [
      "@deepseek-ai/dsh-client-ui-settings",
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-api-remotes",
    ])).toBe(true);
  });

  test("TẬP slot của ta = TẬP slot của bundle gốc (chạy chính hai regex của check:rows)", () => {
    const stockSlots = [...slotNames(STOCK_CODE)].sort();
    const ourSlots = [...slotNames(OUR_SRC)].sort();
    expect(ourSlots).toEqual(stockSlots);
    expect(ourSlots).toEqual(["settings.onboarding", "settings.section"]);
  });
});

describe("row ui-settings-models — mặt plugin (đo trên artifact)", () => {
  test("apply đăng ký ĐỦ ba người ngồi, component là THAM SỐ THỨ HAI, spec nguyên văn", () => {
    const { ctx, record } = stubContext();
    const plugin = loadBundle(OUR_CODE);
    // 20/10/2026 — ARTEFACT DE-BUNDLE giữ NGUYÊN VĂN bản gốc: bản gốc KHÔNG export `name` (định danh
    //   nằm ở id dòng loader, đã khoá ở ca khuôn bundle). So BỀ MẶT EXPORT với chính bundle gốc.
    const stock = loadBundle(STOCK_CLIENT);
    expect("name" in plugin).toBe(false);
    expect(Object.keys(plugin).sort()).toEqual(Object.keys(stock).sort());
    plugin.apply(ctx);
    expect([...plugin.inject ?? []]).toEqual([
      "slots",
      "locale",
      "remote",
      "remote.credentials",
      "remote.llm",
      "remote.settings",
      "remote.session",
      "configForms",
      "settingsSchema",
    ]);
    expect([...record.injected]).toEqual(["settings.section", "settings.onboarding", "settings.onboarding"]);
    expect(record.registered.length).toBe(3);
    for (const entry of record.registered) expect(typeof entry.component).toBe("function");
    const byId = new Map(record.registered.map((entry) => [entry.spec.id as string, entry.spec]));
    expect(byId.get("models")).toMatchObject({
      name: "settings.section",
      order: 10,
      children: {
        "settings.models.provider-card": { kind: "keyed", scope: "root" },
        "settings.models.footer": { kind: "list", scope: "root" },
      },
    });
    expect(byId.get("welcome-notice")).toMatchObject({ name: "settings.onboarding", order: -100 });
    expect(byId.get("deepseek-official")).toMatchObject({
      name: "settings.onboarding",
      order: 0,
      children: { "settings.models.sign-in": { kind: "single", scope: "root" } },
    });
    // Nhãn mục Models lấy từ từ điển của ta, không phải chuỗi cứng.
    expect((byId.get("models")?.label as () => string)()).toBe("nav");
    // Nghiệp vụ tiêm: có kho + hook ảnh chụp + lệnh Host + schema + hàm dịch.
    const injected = (byId.get("models")?.inject as () => Record<string, unknown>)();
    for (const key of ["controller", "hooks", "operations", "schema", "t"]) expect(key in injected).toBe(true);
    expect(record.effects).toEqual(["ui-settings-models: copy dictionaries", "ui-settings-models: pushed invalidations"]);
    expect(record.locales.map((entry) => entry.ns)).toEqual(["settings.models"]);
  });

  test("cổng chống cài hai lần: bản gốc KHÔNG latch phạm vi module — mỗi lần apply đăng ký đủ", () => {
    const plugin = loadBundle(OUR_CODE);
    // (1) Lần cài ĐẦU ném giữa đường (register hỏng) ⇒ không được để lại cờ chặn.
    const failing = stubContext({ failRegister: true });
    expect(() => plugin.apply(failing.ctx)).toThrow();
    // (2) Lần thứ hai (ctx KHÁC) phải đăng ký LẠI đủ ba người ngồi.
    const good = stubContext();
    plugin.apply(good.ctx);
    expect(good.record.registered.length).toBe(3);
    expect([...good.record.injected].sort()).toEqual(["settings.onboarding", "settings.onboarding", "settings.section"]);
    // (3) 20/10/2026 — ĐO TỪ ARTEFACT: bản gốc KHÔNG latch phạm vi module ⇒ apply lần thứ ba trên
    //     CÙNG ctx VẪN đăng ký đủ 3 (3→6), KHÔNG phải 0 như kỳ vọng cổng cũ (giống ui-jobs/ui-settings-account).
    plugin.apply(good.ctx);
    expect(good.record.registered.length).toBe(6);
    // (4) Lần thứ tư trên ctx MỚI: vẫn đủ 3, không phải 0.
    const third = stubContext();
    plugin.apply(third.ctx);
    expect(third.record.registered.length).toBe(3);
    // Artefact KHÔNG được chứa dấu hiệu latch theo phạm vi module/ctx (hành vi stock).
    expect(/uiSettingsModelsInstalled|lastCtx|installedContexts/.test(OUR_CODE)).toBe(false);
  });

  test("vỏ desktop: bỏ welcome-notice và tắt onboarding tự động", () => {
    const globals = globalThis as Record<string, unknown>;
    globals["dshDesktop"] = {};
    try {
      const { ctx, record } = stubContext();
      loadBundle(OUR_CODE).apply(ctx);
      expect(record.registered.map((entry) => entry.spec.id)).toEqual(["models", "deepseek-official"]);
      const injected = (record.registered[1]?.spec.inject as () => Record<string, unknown>)();
      expect(injected.automatic).toBe(false);
    } finally {
      delete globals["dshDesktop"];
    }
  });
});

describe("row ui-settings-models — từ điển, CSS, cây render", () => {
  test("từ điển hai ngữ: cùng tập khoá, và khớp tập khoá với bản gốc", () => {
    const enKeys = Object.keys(en).sort();
    const zhKeys = Object.keys(zh).sort();
    expect(zhKeys).toEqual(enKeys);
    expect(enKeys.length).toBe(134);
    // Đối chứng với chính bundle gốc: rút khoá của hai khối const en / const zh trong vùng locales.
    const region = /\/\/#region lib\/types\/client\/locales\.js([\s\S]*?)\/\/#endregion/.exec(STOCK_CODE)?.[1] ?? "";
    expect(region.length).toBeGreaterThan(10_000);
    /**
     * Rút khoá của một khối từ điển trong bản gốc.
     * @param name - tên biến (en hoặc zh).
     * @returns danh sách khoá đã sắp xếp.
     */
    const stockKeys = (name: string): string[] => {
      const rest = region.slice(region.indexOf("const " + name + " = {"));
      // Khối kết thúc bằng dòng chỉ có tabs + "};" (bundle thụt lề hai tab).
      const block = rest.slice(0, rest.search(/\n\t*\};/));
      return [...block.matchAll(/^\t+"?([A-Za-z_$][\w$]*)"?:/gm)].map((m) => m[1] as string).sort();
    };
    expect(stockKeys("en")).toEqual(enKeys);
    expect(stockKeys("zh")).toEqual(zhKeys);
  });

  test("CSS bốn module: nguyên văn từng byte trong artifact", () => {
    // 20/10/2026 — DE-BUNDLE: CSS nay là LÁT NGUYÊN VĂN trong src/parts/part-*.ts (nguồn của artefact mới),
    //   không còn ở src/*.module.css của bản viết tay cũ. Đọc lát rồi so NGUYÊN VĂN với CSS nhúng trong artefact.
    const parts = cssModules(readAllTs(join(OURS, "src", "parts")));
    expect(parts.map((entry) => entry.tag.slice(entry.tag.lastIndexOf("/") + 1))).toEqual([
      "ModelsSection.module.css",
      "OnboardingModal.module.css",
      "DeepSeekOnboardingDialog.module.css",
      "WelcomeNotice.module.css",
    ]);
    const artifact = cssModules(OUR_CODE);
    expect(artifact.length).toBe(parts.length);
    for (const [index, entry] of parts.entries()) {
      // CSS của bản gốc là MỘT dòng: không có xuống dòng nào để tầng build chuẩn hoá.
      expect(entry.css.includes("\n")).toBe(false);
      expect(entry.css.length).toBeGreaterThan(100);
      // 20/10/2026 — brand token đã đổi `--dsh-*` → `--gbh-*` (rename CÓ CHỦ ĐÍCH) ⇒ chuẩn hoá
      //   ĐỐI XỨNG hai vế rồi so NGUYÊN VĂN; mọi ký tự khác phải trùng từng byte.
      expect(normalizeBrand(artifact[index]?.css ?? "")).toBe(normalizeBrand(entry.css));
      // 20/10/2026 — CANON: tagId thẻ style là DỮ LIỆU ⇒ GIỮ NGUYÊN id stock của lát nguồn (chỉ dòng
      //   loader mới mang id ta). So NGUYÊN VĂN với lát src/parts/part-*.ts, không quy id.
      // 22/10/2026: tools/brand-ids-client.ts doi 263 id du lieu stock -> id ta, nen tagId trong artifact
      //   la id CUA TA con entry.tag (lat nguon) van la id stock, do do quy id ve cung mot ten truoc khi so.
      expect((artifact[index]?.tag ?? "").split(PACKAGE_NAME).join(STOCK_NAME)).toBe(entry.tag);
    }
    // Hash lớp gốc phải còn nguyên.
    for (const hash of ["zGbnIq_", "jLrgrW_", "GL8Viq_", "t1T8VW_"]) expect(OUR_CODE.includes(hash)).toBe(true);
  });

  test("cây render ModelsSection: so TRỰC TIẾP với bản gốc trong window giả", () => {
    /** Snapshot giả dùng chung cho cả hai bên. */
    const snapshot = { status: "ready", error: null, credentialError: null, writable: true, rows: [], namespaces: new Map() };
    /** Props giả dùng chung cho cả hai bên. */
    const props = {
      controller: { store: { getSnapshot: () => snapshot }, load: () => Promise.resolve() },
      useSnapshot: (selector: (value: typeof snapshot) => unknown) => selector(snapshot),
      operations: {},
      schema: { getPath: () => undefined, hasPath: () => false, rehydrate: () => undefined, nodeAtPath: () => undefined, setPath: () => undefined, deletePath: () => undefined },
      t: (key: string) => key,
      renderSlot: () => null,
    };
    /**
     * Dựng cây của một component, trả về chuỗi JSON ổn định (hàm ⇒ tên hàm) hoặc thông báo lỗi.
     * @param component - component cần render.
     * @returns chuỗi mô tả cây.
     */
    const treeOf = (component: (value: Record<string, unknown>) => unknown): string => {
      /** Thay hàm bằng tên để JSON ổn định. */
      const plain = (value: unknown): unknown => {
        if (typeof value === "function") return "[fn " + value.name + "]";
        if (Array.isArray(value)) return value.map(plain);
        if (value !== null && typeof value === "object") {
          const out: Record<string, unknown> = {};
          for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = plain(entry);
          return out;
        }
        return value;
      };
      try {
        return JSON.stringify(plain(component(props)));
      } catch (error) {
        return "NÉM: " + (error instanceof Error ? error.message : String(error));
      }
    };
    /** Lấy component đã đăng ký cho một người ngồi từ một bundle. */
    const sectionOf = (code: string): ((value: Record<string, unknown>) => unknown) => {
      const { ctx, record } = stubContext();
      loadBundle(code).apply(ctx);
      return record.registered.find((entry) => entry.spec.id === "models")?.component as (value: Record<string, unknown>) => unknown;
    };
    const ours = sectionOf(OUR_CODE);
    const theirs = sectionOf(STOCK_CLIENT);
    expect(typeof ours).toBe("function");
    expect(typeof theirs).toBe("function");
    const ourTree = treeOf(ours);
    expect(ourTree).toBe(treeOf(theirs));
    // Cây phải THẬT SỰ được dựng (không phải chuỗi lỗi), và có dấu vết của mục Models.
    expect(ourTree.startsWith("NÉM:")).toBe(false);
    expect(ourTree).toContain("zGbnIq_section");
    // Khoá dịch đi qua hàm t giả ⇒ thấy được đúng chuỗi mà bản gốc hỏi.
    expect(ourTree).toContain('"title"');
    expect(ourTree).toContain('"intro"');
  });
});

describe("row ui-settings-models — nửa host", () => {
  test("nửa host phơi đủ hai export của bản gốc (apply + Config) và phát đúng khoá toàn cục", async () => {
    const mod = (await import("../../packages/client/ui-settings-models/src/index.ts")) as { apply: (ctx: unknown, config: { credentialOnboarding: boolean }) => void; Config: unknown };
    expect(typeof mod.apply).toBe("function");
    expect(mod.Config).toBeDefined();
    const pushed: Record<string, unknown>[] = [];
    mod.apply({ on: (_event: string, run: (table: Record<string, unknown>[]) => void) => run(pushed) }, { credentialOnboarding: false });
    // 20/10/2026 — LÔ ĐỔI TÊN BRAND: khoá toàn cục nay là `__GBH_MODELS_ONBOARDING__` (rename CÓ CHỦ ĐÍCH).
    // Chuẩn hoá ĐỐI XỨNG tên khoá rồi so NGUYÊN cấu trúc row còn lại ⇒ vẫn bắt sai kind/value.
    const normalized = pushed.map((row) => ({ ...row, name: typeof row["name"] === "string" ? normalizeBrand(row["name"]) : row["name"] }));
    expect(normalized as unknown).toEqual([{ kind: "global", name: "__DSH_MODELS_ONBOARDING__", value: { credentialOnboarding: false } }]);
  });
});
