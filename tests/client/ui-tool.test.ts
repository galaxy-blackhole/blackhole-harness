/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row ui-tool — CANON quy id CHI O DONG LOADER (moi lan xuat hien khac cua id goi la DU LIEU,
 *      giu id stock) · du hai slot + 48 key nguyen van cua ban goc · hanh vi stock KHONG latch pham vi
 *      module · CSS nguyen van tung byte · tu dien khong dung khoa la
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { normalizeBrand, sameAfterIdMap } from "../lib/brand-parity.ts";
import { allToolviewKeys, TOOLVIEW_KEYS } from "../../packages/client/ui-tool/src/ids.ts";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-tool");
/** Thu muc goi GOC trong apps/host (chi doc). */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-tool");
/** Ten package cua ta — id DUY NHAT o DONG LOADER (canon: quy id chi o do). */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-tool";
/** Ten package goc — khai o aliases, va van la DU LIEU trong artefact (tagId · dataset.plugin). */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-tool";
/** Hai slot ma BAN GOC dang ky — row nay phai dang ky du, dung ten. */
const SLOT_NAMES = ["conversation.chat.node", "tool.call.toolview"].sort();

/** Noi dung bundle goc (ban build doc duoc, con nguyen comment). */
const STOCK_CODE = readFileSync(join(STOCK, "lib", "client.js"), "utf8");

/** Mot lan register(spec, component) bat duoc tu context gia. */
interface RegisterCall {
  /** Spec slot. */
  spec: Record<string, unknown>;
  /** Component — THAM SO THU HAI. */
  component: unknown;
}

/** Bo ghi cua context gia. */
interface Recorder {
  /** Ten slot da inject, theo thu tu. */
  injected: string[];
  /** Cac lan register kem ca hai tham so. */
  registered: RegisterCall[];
  /** Su kien vong doi da dang ky. */
  events: string[];
}
/** Context gia ghi lai moi dang ky. */
type Stub = { ctx: any; record: Recorder };

/**
 * Doc moi file .ts trong src/ cua mot goi (de chay CHINH hai regex cua check:rows tren nguon).
 * @param dir - thu muc can quet.
 * @returns van ban gop cua moi file .ts.
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
 * Rut ten slot bang DUNG hai regex cua tools/check/rows.ts.
 * @param text - nguon hoac artifact can quet.
 * @returns tap ten slot tim thay.
 */
function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  return out;
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
 * (tagId CSS module · dataset.plugin · nhan · khoa slot) nen GIU NGUYEN id stock nhu ban goc.
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
 * Rut moi key ma mot doan ma dang ky trong slot tool.call.toolview.
 * @param text - nguon hoac artifact can quet.
 * @returns tap key tim thay.
 */
function toolviewKeys(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/key:\s*"([^"]+)"/g)) out.add(m[1] as string);
  return out;
}

/**
 * Rut moi khoa tu dien ma mot doan ma doc qua t("...").
 * @param text - nguon hoac artifact can quet.
 * @returns tap khoa tim thay.
 */
function localeKeys(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\bt\(\s*"([A-Za-z0-9_.]+)"/g)) out.add(m[1] as string);
  return out;
}

/** Runtime gia: jsx/jsxs tra ve cay node, primitives la doi tuong proxy tra ten. */
function fakeRequire(spec: string): unknown {
  if (spec === "react/jsx-runtime") {
    const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key });
    return { jsx, jsxs: jsx, Fragment: "Fragment" };
  }
  if (spec === "react") {
    return {
      useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, () => undefined],
      useRef: (initial: unknown) => ({ current: initial }),
      useEffect: () => undefined,
      useMemo: (factory: () => unknown) => factory(),
      useCallback: (fn: unknown) => fn,
      useContext: () => ({}),
      memo: (component: unknown) => component,
    };
  }
  return new Proxy({}, { get: (_t, key) => String(key) });
}

/**
 * Nap lai module client TƯƠI (co uiToolInstalled o pham vi module nen import tinh se dinh giua cac ca).
 * @param tag - hau to query de moi ca co mot instance module rieng.
 * @returns ham createPlugin cua instance do.
 */
async function freshCreatePlugin(tag: string): Promise<(requireFn: (spec: string) => unknown) => { apply: (ctx: unknown) => void; inject: readonly string[] }> {
  const spec: string = "../../packages/client/ui-tool/src/plugin.ts?" + tag;
  const mod = (await import(spec)) as {
    createPlugin: (requireFn: (spec: string) => unknown) => { apply: (ctx: unknown) => void; inject: readonly string[] };
  };
  return mod.createPlugin;
}

/**
 * Nap artifact lib/client.js trong window gia va lay mat plugin (apply + inject).
 * @returns mat plugin ma Loader goi apply tren do.
 */
function loadArtifactPlugin(): { apply: (ctx: unknown) => void; inject: readonly string[] } {
  let factory: ((requireFn: (spec: string) => unknown) => { apply: (ctx: unknown) => void; inject: readonly string[] }) | undefined;
  const win = { __ModuleLoader__: { load: (registration: { factory: typeof factory }) => { factory = registration.factory; } } };
  new Function("window", readFileSync(join(OURS, "lib", "client.js"), "utf8"))(win);
  if (factory === undefined) throw new Error("bundle khong dang ky factory");
  return factory(fakeRequire);
}

/**
 * Context gia: ghi lai moi dang ky va chay ngay callback cua inject (giong vo that).
 * @param options.failRegister - true thi register nem ngay lan dau (de kiem cong idempotent).
 * @returns context gia (ep kieu never khi goi apply) va bo ghi.
 */
function stubContext(options: { failRegister?: boolean } = {}): Stub {
  const record: Recorder = { injected: [], registered: [], events: [] };
  const slots = {
    inject: (name: string, body: () => unknown) => {
      record.injected.push(name);
      // ⚠️ Ban goc dang ky NHIEU key bang THAN GENERATOR (function* () { yield register(...) }); vo that
      //   cua so slot se duyet generator do. Vo gia phai lam y het, neu khong thi chi 1/2 so key duoc ghi
      //   va ca test bao thieu mot cach gia tao.
      const result = body();
      const iterable = result as { next?: unknown; [Symbol.iterator]?: unknown } | null | undefined;
      if (iterable !== null && iterable !== undefined && typeof iterable.next === "function" && typeof iterable[Symbol.iterator] === "function") {
        for (const _step of iterable as Iterable<unknown>) void _step;
      }
    },
    register: (spec: Record<string, unknown>, component: unknown) => {
      if (options.failRegister === true) throw new Error("register hong (ca kiem cong idempotent)");
      record.registered.push({ spec, component });
    },
  };
  const uiConversation = {
    events: { register: (definition: unknown) => record.events.push(String((definition as { name?: string })?.name ?? definition)) },
    views: { register: () => undefined },
    binding: () => ({ target: () => undefined }),
  };
  const ctx = {
    slots,
    remote: { $host: { home: "/home/runner" } },
    on: (event: string) => event,
    uiConversation,
    // Ban goc dang ky chin nhom toolview qua ctx.plugin(...): vo that goi apply cua tung plugin con.
    plugin: (plugin: { apply?: (value: unknown) => void }) => {
      plugin.apply?.(ctx);
    },
  };
  return { ctx, record };
}

describe("row ui-tool — khuon bundle", () => {
  test("dong loader dang ky DUNG MOT id (id cua ta); id goc chi con la DU LIEU, bang dung ban goc", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    // 20/10/2026 — ARTEFACT DE-BUNDLE: id nam o DONG RIENG (thut le tab) trong khuon
    //   window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-...", factory: (require) => {
    //   ⇒ nap THAT trong window gia roi dem id, KHONG grep theo mot dong nhu ban viet tay cu.
    const ids: string[] = [];
    const win = {
      __ModuleLoader__: {
        load: (registration: { id: string; factory: (require: (spec: string) => unknown) => unknown }) => {
          ids.push(registration.id);
        },
      },
    };
    new Function("window", code)(win);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Khoa lai: id goc di qua gbh.row.aliases; dang ky no => bundle chay hai lan => app trang.
    expect(ids).not.toContain(STOCK_NAME);
    // 20/10/2026 — CANON: quy id CHI O DONG LOADER. Dong loader mang DUNG id cua ta; moi lan xuat hien
    //   khac cua id goi la DU LIEU (tagId CSS module · dataset.plugin · nhan · khoa) nen GIU id stock
    //   nhu ban goc. Ca cu doi "0 id stock trong CA artifact" — SAI CANON, da doi (KHONG noi: so tung dong).
    const ourLines = code.split("\n");
    const loaderAt = loaderLineIndex(code);
    expect(ourLines[loaderAt]).toBe("window.__ModuleLoader__.load({");
    expect(ourLines[loaderAt + 1]).toBe('\tid: "' + PACKAGE_NAME + '",');
    // (a) 0 id stock O DONG LOADER …
    expect(ourLines[loaderAt + 1]?.includes(STOCK_NAME)).toBe(false);
    // (b) … con N lan con lai la DU LIEU: dem DUNG so lan cua bundle goc (hon ta dung MOT lan o loader),
    //     va DANH SACH dong du lieu NGUYEN VAN nhu ban goc sau khi chi thay dong loader.
    expect(occurrences(code, STOCK_NAME)).toBe(0);
    expect(stockDataLines(code, STOCK_NAME)).toEqual([]);
    // KHONG ESM: artifact la script classic, khong mot dong `export`.
    expect(/^export\s/m.test(code)).toBe(false);
    // Khuon loader cua artefact moi: id ta + factory nhan require (xuong dong + thut le tab).
    expect(code).toContain('window.__ModuleLoader__.load({\n\tid: "' + PACKAGE_NAME + '",\n\tfactory: (require) => {');
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      dsh: { client: { inject: string[] } };
      gbh: { row: { id: string; moduleIds: string[]; aliases: string[] } };
    };
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
    // 20/10/2026 — bon goi cua ban goc giu nguyen THU TU, chi ID da rewrite CO CHU DICH: quy id ta -> id stock
    //   roi so DEEP-EQUAL (sameAfterIdMap), KHONG noi contains.
    const stockMeta = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { dsh: { client: { inject: string[] } } };
    expect(sameAfterIdMap(meta.dsh.client.inject, stockMeta.dsh.client.inject)).toBe(true);
  });
});

describe("row ui-tool — mat plugin", () => {
  test("apply dang ky DU hai slot cua ban goc, moi slot kem component la THAM SO THU HAI", async () => {
    const { ctx, record } = stubContext();
    const createPlugin = await freshCreatePlugin("case2");
    const plugin = createPlugin(fakeRequire);
    plugin.apply(ctx);
    // Chin nhom toolview deu tiem qua CUNG ten slot (mot so nhom dang ky nhieu key trong mot lan tiem),
    // nen tap DUY NHAT phai dung bang hai ten slot cua ban goc.
    expect([...new Set(record.injected)].sort()).toEqual(["conversation.chat.node", "tool.call.toolview"]);
    expect([...new Set(record.registered.map((entry) => entry.spec.name as string))].sort()).toEqual(SLOT_NAMES);
    for (const entry of record.registered) expect(typeof entry.component).toBe("function");
    // Hai seam nguyen van cua ban goc.
    expect([...plugin.inject]).toEqual(["slots", "remote"]);
    // Ten slot PHAI la LITERAL dung khuon ma check:rows nhan dang — chay lai CHINH hai regex cua cong
    // tren ma nguon cua ta, de khang dinh cong thay du hai slot.
    expect([...slotNames(readAllTs(join(OURS, "src")))].sort()).toEqual(SLOT_NAMES);
  });

  test("nut node hoi thoai giu nguyen key + slot con KEYED cua ban goc", async () => {
    const { ctx, record } = stubContext();
    const createPlugin = await freshCreatePlugin("case3");
    createPlugin(fakeRequire).apply(ctx);
    const node = record.registered.find((entry) => entry.spec.name === "conversation.chat.node");
    expect(node?.spec).toMatchObject({
      key: "tool-call",
      locale: "conversation",
      children: { "tool.call.toolview": { kind: "keyed", scope: "session" } },
    });
    const hooks = (node?.spec.inject as () => { hooks: { hostInfo: { getSnapshot: () => unknown; subscribe: (l: () => void) => unknown } } })();
    expect(typeof hooks.hooks.hostInfo.getSnapshot).toBe("function");
    expect(typeof hooks.hooks.hostInfo.subscribe).toBe("function");
  });

  test("tap key cua ta BANG tap key cua ban goc, moi key mot lan dang ky", async () => {
    const { ctx, record } = stubContext();
    const createPlugin = await freshCreatePlugin("case4");
    createPlugin(fakeRequire).apply(ctx);
    const ours = record.registered.filter((entry) => entry.spec.name === "tool.call.toolview").map((entry) => entry.spec.key as string);
    const stock = [...toolviewKeys(STOCK_CODE)].filter((key) => key !== "tool-call");
    expect([...ours].sort()).toEqual([...stock].sort());
    expect(ours.length).toBe(48);
    // Bang trong ids.ts phai khop dung tap do (mot nguon su that cho test khac).
    expect([...allToolviewKeys()].sort()).toEqual([...stock].sort());
    // Moi key chi duoc dang ky MOT lan (trung key ⇒ renderer chon nham).
    expect(new Set(ours).size).toBe(ours.length);
    // Ban goc cung dang ky hai key cho file-mutation + hai key cho search + hai key cho web.
    expect(TOOLVIEW_KEYS.fileMutation).toEqual(["edit", "write"]);
    expect(TOOLVIEW_KEYS.search).toEqual(["grep", "glob"]);
    expect(TOOLVIEW_KEYS.web).toEqual(["web_search", "web_fetch"]);
    expect(TOOLVIEW_KEYS.details.length).toBe(37);
  });

  test("cong chong cai hai lan: ban goc KHONG latch pham vi module, moi lan apply dang ky du", () => {
    // 20/10/2026 — DO TU ARTEFACT de-bundle (khong doc src/plugin.ts cua ban viet tay cu).
    const plugin = loadArtifactPlugin();
    // (1) Lan cai DAU nem giua duong (register hong) => khong duoc de lai co chan.
    const failing = stubContext({ failRegister: true });
    expect(() => plugin.apply(failing.ctx)).toThrow();
    // (2) Lan cai thu hai (ctx KHAC) phai dang ky LAI du 49 slot.
    const second = stubContext();
    plugin.apply(second.ctx);
    expect(second.record.registered.length).toBe(49);
    // (3) Ban goc KHONG latch pham vi module => lan ba tren CUNG ctx van dang ky du (49 -> 98).
    plugin.apply(second.ctx);
    expect(second.record.registered.length).toBe(98);
    // (4) Lan bon tren ctx MOI: van du 49, khong phai 0.
    const third = stubContext();
    plugin.apply(third.ctx);
    expect(third.record.registered.length).toBe(49);
    // Artefact khong duoc chua dau hieu latch theo pham vi module/ctx.
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    expect(/uiToolInstalled|lastCtx|installedContexts/.test(code)).toBe(false);
  });
});

describe("row ui-tool — doi chung voi bundle goc", () => {
  test("CSS bay module nguyen van tung byte (giu nguyen hash lop goc)", () => {
    const ours = readFileSync(join(OURS, "src", "styles.ts"), "utf8");
    const stockCss = [...STOCK_CODE.matchAll(/const css(?:\$\d+)? = (".*");/g)].map((m) => JSON.parse(m[1] as string) as string);
    const ourCss = [...ours.matchAll(/const \w+Css = (".*");/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(stockCss.length).toBe(7);
    expect([...ourCss].sort()).toEqual([...stockCss].sort());
    // Hash lop cua ban goc phai con nguyen trong bang ten lop cua ta.
    const stockClasses = [...STOCK_CODE.matchAll(/var \w+_module_css_default = \{([\s\S]*?)\};/g)].map((m) => m[1] as string);
    const joined = stockClasses.join("\n");
    const hashes = [...joined.matchAll(/"([A-Za-z0-9_-]{5,}_[A-Za-z0-9_-]+)"/g)].map((m) => m[1] as string).filter((v) => /_/.test(v));
    expect(hashes.length).toBeGreaterThan(80);
    for (const hash of new Set(hashes)) expect(ours.includes(hash)).toBe(true);
  });

  test("moi khoa tu dien cua ta deu CO trong ban goc (khong bia khoa la)", () => {
    const stockKeys = localeKeys(STOCK_CODE);
    expect(stockKeys.size).toBeGreaterThan(60);
    for (const file of readdirSync(join(OURS, "src"))) {
      if (!file.endsWith(".ts")) continue;
      for (const key of localeKeys(readFileSync(join(OURS, "src", file), "utf8"))) {
        expect(stockKeys.has(key)).toBe(true);
      }
    }
    // Tu dien rieng cua goi (locale/*.json) phai byte-for-byte nhu goc.
    for (const name of ["en.json", "zh.json"]) {
      expect(readFileSync(join(OURS, "locale", name), "utf8")).toBe(readFileSync(join(STOCK, "locale", name), "utf8"));
    }
  });

  test("khong doc primitives/react/jsxRuntime o PHAM VI MODULE (chi trong than ham)", () => {
    for (const file of readdirSync(join(OURS, "src"))) {
      if (!file.endsWith(".ts")) continue;
      const text = readFileSync(join(OURS, "src", file), "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        // Chi tinh dong BAT DAU O COT 0 (pham vi module); trong than ham thi dong da bi thut le.
        if (!/^(export )?const [A-Za-z0-9_$]+\s*=\s*(primitives|react|jsxRuntime)\./.test(line)) continue;
        throw new Error(file + ": doc bang module o pham vi module — " + trimmed);
      }
    }
    expect(true).toBe(true);
  });
});
