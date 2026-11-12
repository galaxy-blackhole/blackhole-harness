/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row ui-trajectory — luat mot-id · tap slot BANG tap slot goc · hop dong STORE cap cho slot
 *      cua goi khac · cong chan cai hai lan pham vi module · va parity TUNG BYTE voi bundle goc
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { normalizeBrand } from "../lib/brand-parity.ts";
import { readCssSource } from "../../packages/client/ui-trajectory/src/assemble.ts";
import { CSS_REPLACEMENTS, PART_FILES } from "../../packages/client/ui-trajectory/src/manifest.ts";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-trajectory");
/** Ban goc DSH (chi doc) — nguon doi chung. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-trajectory", "lib", "client.js");
/**
 * Thu muc lib cua ban goc — cong check:rows doc MOI file .js trong day (readStockClient), khong chi client.js.
 * Doi chung slot PHAI doc cung pham vi voi cong, neu khong thi mot slot dang ky o file .js khac trong lib
 * se lot qua phep do ⇒ dung lop loi "1=1, 0 thieu" da bao oan cho chinh row nay.
 */
const STOCK_LIB = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-trajectory", "lib");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-trajectory";
/** Ten package goc — CHI duoc khai o aliases, khong bao gio load() trong bundle. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-trajectory";
/** Ten slot ma BAN GOC dang ky — row nay phai dang ky du, dung ten. */
const SLOT_NAMES = ["conversation.view"].sort();
/** Id nguoi ngoi cua tab trajectory trong ViewMap (nguyen van ban goc). */
const VIEW_ID = "trajectory";
/** Doi tuong binding gia — WeakMap doi khoa la doi tuong nen binding phai la doi tuong, khong phai chuoi. */
const BINDING = { sessionId: "session-1" };

/**
 * Noi dung file .module.css bo phan header 5 dong — NGUYEN VAN tung byte.
 * Nhan: rel — duong dan tuong doi so voi src/.
 * Tra: van ban CSS nguyen van.
 */
function cssBody(rel: string): string {
  return readCssSource(readFileSync(join(OURS, "src", rel), "utf8"));
}

/**
 * Doc moi file .ts trong src/ — dung khuon readAllTs cua tools/check/rows.ts.
 * Nhan: khong.
 * Tra: van ban gop cua moi file .ts.
 */
function readAllSrcTs(): string {
  let out = "";
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts")) out += readFileSync(full, "utf8");
    }
  };
  walk(join(OURS, "src"));
  return out;
}

/**
 * Doc moi file .js trong thu muc lib cua ban goc — NGUYEN VAN readStockClient cua tools/check/rows.ts.
 * Nhan: khong.
 * Tra: van ban gop cua moi file .js trong lib.
 */
function readStockLibJs(): string {
  let out = "";
  for (const name of readdirSync(STOCK_LIB)) if (name.endsWith(".js")) out += readFileSync(join(STOCK_LIB, name), "utf8");
  return out;
}

/**
 * Rut ten cac slot ma mot doan ma dang ky — NGUYEN VAN hai regex cua tools/check/rows.ts.
 * Nhan: text — noi dung file nguon hoac ban build.
 * Tra: tap ten slot.
 */
function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  return out;
}

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
  /** Nhan hieu ung vong doi. */
  effects: string[];
  /** Tu dien da dang ky. */
  locales: { ns: string; dictionaries: { zh: Record<string, string>; en: Record<string, string> } }[];
  /** Dinh nghia view cua hoi thoai da dang ky. */
  views: unknown[];
  /** Dinh nghia su kien cua hoi thoai da dang ky. */
  events: unknown[];
  /** Cac lan ctx.uiSession.provide. */
  provided: { hooks?: readonly string[]; resolve?: (binding: unknown) => unknown }[];
}

/**
 * Runtime gia cho nam module ma bundle yeu cau.
 * createSnapshotStore tra ve mot the hien DAY DU (getSnapshot/subscribe/set) va tu danh dau
 * __gbhStore — nho do test khang dinh duoc hooks.duration LA doi tuong cua thu vien, khong phai
 * mot doi tuong tu che thieu getSnapshot (lop loi lam vo ca thanh ben, muc 8 cua recipe).
 * Nhan: storeNames — mang nhan them ten persist moi lan createSnapshotStore duoc goi.
 * Tra: ham require gia.
 */
function makeRequire(storeNames: string[]): (spec: string) => unknown {
  return (spec: string): unknown => {
    if (spec .endsWith("-client-store")) {
      return {
        createSnapshotStore: (initial: unknown, options?: { persist?: { name?: string } }): Record<string, unknown> => {
          storeNames.push(options?.persist?.name ?? "(khong ten)");
          let value = initial;
          const listeners = new Set<() => void>();
          const set = (next: unknown): void => {
            value = next;
            for (const listener of listeners) listener();
          };
          return { __gbhStore: true, getSnapshot: () => value, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, set, actions: { set } };
        },
      };
    }
    if (spec === "react/jsx-runtime") {
      const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key });
      return { jsx, jsxs: jsx, Fragment: "Fragment" };
    }
    if (spec === "react") {
      return {
        useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, () => undefined],
        useRef: (initial: unknown) => ({ current: initial }),
        useEffect: () => undefined,
        useLayoutEffect: () => undefined,
        useMemo: (factory: () => unknown) => factory(),
        useCallback: (fn: unknown) => fn,
        useId: () => "id",
        memo: (component: unknown) => component,
        forwardRef: (component: unknown) => component,
      };
    }
    if (spec === "react-dom") return { createPortal: (children: unknown) => children };
    // Cac goi con lai (primitives, react-virtual): tra ve chuoi cho MOI thuoc tinh — chung chi duoc
    // goi luc RENDER, khong phai luc apply, nen gia nay du de chay tron than dang ky.
    return new Proxy({}, { get: (_target, key) => String(key) });
  };
}

/** Mat plugin ma bang module tra ve. */
interface LoadedPlugin {
  /** Seam can co. */
  inject?: readonly string[];
  /** Than plugin. */
  apply: (ctx: unknown) => void;
}

/** Mot lan dang ky module bat duoc tu window gia. */
interface Registration {
  /** Id bundle tu khai. */
  id: string;
  /** Ham dung module. */
  factory: (requireFn: (spec: string) => unknown) => LoadedPlugin;
}

/**
 * Chay mot bundle trong window gia roi dung factory cua no.
 * Nhan: path — duong dan file bundle (ban cua ta hoac ban goc).
 * Tra: danh sach dang ky, mat plugin, va nhat ky ten persist cua store.
 */
function loadBundle(path: string): { registrations: Registration[]; plugin: LoadedPlugin; storeNames: string[] } {
  const code = readFileSync(path, "utf8");
  const registrations: Registration[] = [];
  const fakeWindow = { __ModuleLoader__: { load: (reg: Registration) => registrations.push(reg) } };
  new Function("window", code)(fakeWindow);
  const first = registrations[0];
  if (first === undefined) throw new Error("bundle khong dang ky module nao: " + path);
  const storeNames: string[] = [];
  return { registrations, plugin: first.factory(makeRequire(storeNames)), storeNames };
}

/**
 * Duong dan artifact de do — CHI nhan ban trong lib/ khi no con moi hon moi file nguon.
 * Nhan: khong.
 * Tra: duong dan file client.js.
 */
function artifactPath(): string {
  const built = join(OURS, "lib", "client.js");
  if (!existsSync(built)) throw new Error("chua co artifact " + built + " — chay bun run build.ts trong packages/client/ui-trajectory");
  const mountTime = statSync(built).mtimeMs;
  const sources = [
    join(OURS, "build.ts"),
    join(OURS, "src", "ids.ts"),
    join(OURS, "src", "manifest.ts"),
    join(OURS, "src", "assemble.ts"),
    ...PART_FILES.map((file) => join(OURS, "src", file)),
    ...CSS_REPLACEMENTS.map((item) => join(OURS, "src", item.file)),
  ];
  if (sources.some((file) => existsSync(file) && statSync(file).mtimeMs > mountTime)) {
    throw new Error("artifact CU hon ma nguon (" + built + ") — chay lai bun run build.ts roi chay lai test");
  }
  return built;
}

/**
 * Context gia: ghi lai moi dang ky va chay ngay callback cua inject (giong vo that).
 * Nhan: options.failRegister — true thi register nem ngay (de kiem cong idempotent);
 *        options.sessionMissing — true thi sessions.binding khong tra ve phien nao.
 * Tra: context gia (ep kieu unknown khi goi apply) va bo ghi.
 */
function stubContext(options: { failRegister?: boolean; sessionMissing?: boolean } = {}): { ctx: unknown; record: Recorder } {
  const record: Recorder = { injected: [], registered: [], effects: [], locales: [], views: [], events: [], provided: [] };
  const target = {
    getSnapshot: (): unknown => undefined,
    subscribe: (_listener: () => void): (() => void) => () => undefined,
  };
  const ctx = {
    effect: (run: () => void, label: string): void => {
      record.effects.push(label);
      run();
    },
    slots: {
      inject: (name: string, body: () => unknown): unknown => {
        record.injected.push(name);
        return body();
      },
      register: (spec: Record<string, unknown>, component: unknown): unknown => {
        if (options.failRegister === true) throw new Error("register hong (ca kiem cong idempotent)");
        record.registered.push({ spec, component });
        return component;
      },
    },
    locale: {
      register: (ns: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }): void => {
        record.locales.push({ ns, dictionaries });
      },
      bind: (): ((key: string) => string) => (key: string) => key,
    },
    sessions: {
      binding: (_id: string): unknown => (options.sessionMissing === true ? undefined : { session: { loadOlder: async (): Promise<void> => undefined } }),
    },
    uiSession: {
      provide: (spec: { hooks?: readonly string[]; resolve?: (binding: unknown) => unknown }): void => {
        record.provided.push(spec);
      },
    },
    uiConversation: {
      binding: (_id: string): { target: (name: string) => unknown } => ({ target: (_name: string) => target }),
      events: {
        register: (definition: unknown): void => {
          record.events.push(definition);
        },
      },
      views: {
        register: (definition: unknown): void => {
          record.views.push(definition);
        },
      },
      imageUrl: (): string => "blob:image",
      peekImageUrl: (): undefined => undefined,
      inspectSystemPrompt: (): undefined => undefined,
      inspectRequestPrompt: (): undefined => undefined,
    },
  };
  return { ctx, record };
}

/** Hinh dang KHONG phu thuoc ham cua mot dang ky slot — de doi chung truc tiep hai bundle. */
function slotShape(record: Recorder): Record<string, unknown>[] {
  return record.registered.map((entry) => ({
    name: entry.spec.name,
    id: entry.spec.id,
    order: entry.spec.order,
    locale: entry.spec.locale,
    children: Object.keys((entry.spec.children ?? {}) as Record<string, unknown>),
    kinds: Object.values((entry.spec.children ?? {}) as Record<string, Record<string, unknown>>).map((child) => String(child.kind) + "/" + String(child.scope)),
    hasLabel: typeof entry.spec.label,
    hasInject: typeof entry.spec.inject,
  }));
}
describe("row ui-trajectory — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_NAME);
    // Luat cua nghiem thu: khong mot chuoi id: "@deepseek-ai nao trong artifact.
    expect(/id: "@deepseek-ai/.test(code)).toBe(false);
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      dsh: { client: { inject: string[] } };
      gbh: { row: { id: string; moduleIds: string[]; aliases: string[]; tests: string[] } };
    };
    expect(meta.gbh.row.id).toBe("ui-trajectory");
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
    expect(meta.gbh.row.tests).toEqual(["tests/client/ui-trajectory.test.ts"]);
    // dsh.client.inject giu NGUYEN VAN danh sach cua ban goc (doc thang tu package.json cua goi goc).
    const stockMeta = JSON.parse(readFileSync(join(STOCK, "..", "..", "package.json"), "utf8")) as { dsh: { client: { inject: string[] } } };
    expect(meta.dsh.client.inject).toEqual(stockMeta.dsh.client.inject);
  });

  test("tap slot cua ta = TAP slot cua bundle goc (dung chinh hai regex cua check:rows)", () => {
    // Doc CUNG PHAM VI voi cong: moi file .js trong lib/ cua ban goc (readStockClient), khong chi client.js.
    const stockText = readStockLibJs();
    const stockSlots = [...slotNames(stockText)].sort();
    const ourSlots = [...slotNames(readAllSrcTs())].sort();
    expect(ourSlots).toEqual(stockSlots);
    expect(ourSlots).toEqual(SLOT_NAMES);
    // Khang dinh ten cu the: row nay chi co MOT slot, va no la conversation.view.
    expect(ourSlots).toEqual(["conversation.view"]);
    expect(stockSlots.length).toBeGreaterThan(0);
    // Cong do tren src/ cua ta nhung doi chieu voi ARTIFACT cua ban goc; artifact cua TA cung phai con
    // loi goi dang ky (buoc ghep lat ma lam mat no thi cong se bao chan o luot mount ke tiep).
    expect([...slotNames(readFileSync(artifactPath(), "utf8"))].sort()).toEqual(stockSlots);
    // Va loi goi phai la inject(TEN_SLOT, …) — khuon ma cong nhan dien, khong phai dang ky kieu khac.
    expect(/slots\s*\.\s*inject\s*\(\s*"conversation\.view"/.test(readAllSrcTs())).toBe(true);
  });

  test("12 lat deu co header 5 dong, duoi 1000 dong, va duoc manifest liet ke dung thu tu", () => {
    expect(PART_FILES.length).toBe(12);
    for (const file of PART_FILES) {
      const text = readFileSync(join(OURS, "src", file), "utf8");
      expect(text.startsWith("/**\n * author Bùi Trọng Hiếu")).toBe(true);
      expect(text.split("\n").length).toBeLessThanOrEqual(1000);
    }
  });
});

describe("row ui-trajectory — mat plugin", () => {
  test("apply cua ta va apply cua ban goc dang ky CUNG tap spec/tu dien/hieu ung", () => {
    const ours = loadBundle(artifactPath());
    const theirs = loadBundle(STOCK);
    expect(ours.plugin.inject).toEqual(theirs.plugin.inject);
    expect([...(ours.plugin.inject ?? [])].sort()).toEqual(["locale", "sessions", "slots", "uiConversation", "uiSession"]);
    const a = stubContext();
    const b = stubContext();
    ours.plugin.apply(a.ctx);
    theirs.plugin.apply(b.ctx);
    // Hieu ung vong doi + tu dien: NGUYEN VAN tung chuoi.
    expect(a.record.effects.filter((effect) => !effect.includes("vi dictionaries"))).toEqual(b.record.effects);
    expect(a.record.effects.filter((effect) => !effect.includes("vi dictionaries"))).toEqual(["ui-trajectory: dictionaries"]);
    expect(a.record.locales.filter((entry) => entry.dictionaries.zh !== undefined)).toEqual(b.record.locales);
    // Slot: ten, id, thu tu, namespace, con — NGUYEN VAN.
    expect(slotShape(a.record)).toEqual(slotShape(b.record));
    // Dang ky khac: so luong dinh nghia view/su kien + ten persist cua store.
    expect(a.record.views.length).toBe(b.record.views.length);
    expect(a.record.events.length).toBe(b.record.events.length);
    expect(a.record.views.length).toBe(1);
    expect(a.record.events.length).toBe(9);
    expect(a.record.provided.length).toBe(1);
    expect(ours.storeNames).toEqual(theirs.storeNames);
    expect(ours.storeNames).toEqual(["dsh.trajectory.duration", "dsh.trajectory.jsonStringWrapping"]);
  });

  test("apply dang ky MOT slot nguyen van: conversation.view / id trajectory / order 10 / con images", () => {
    const { plugin } = loadBundle(artifactPath());
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    expect(record.injected).toEqual(SLOT_NAMES);
    expect(record.registered.length).toBe(1);
    const entry = record.registered[0] as RegisterCall;
    expect(entry.spec.name).toBe("conversation.view");
    expect(entry.spec.id).toBe(VIEW_ID);
    expect(entry.spec.order).toBe(10);
    expect(entry.spec.locale).toBe("trajectory");
    expect(typeof entry.spec.label).toBe("function");
    expect((entry.spec.label as () => string)()).toBe("view.trajectory");
    expect(typeof entry.spec.inject).toBe("function");
    // Component la THAM SO THU HAI cua register(spec, Component).
    expect(typeof entry.component).toBe("function");
    expect(Object.keys(entry.spec.children as Record<string, unknown>)).toEqual(["conversation.trajectory.images"]);
  });

  test("cong chan cai hai lan: PHAM VI MODULE — cung ctx va ctx KHAC deu chi dang ky MOT lan", () => {
    const { plugin } = loadBundle(artifactPath());
    const first = stubContext();
    const second = stubContext();
    plugin.apply(first.ctx);
    plugin.apply(first.ctx);
    plugin.apply(second.ctx);
    expect(first.record.registered.length).toBe(1);
    expect(second.record.registered.length).toBe(0);
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    expect(artifact.includes("lastCtx")).toBe(false);
    expect(artifact.includes("installedContexts")).toBe(false);
    expect(artifact.includes("let uiTrajectoryInstalled = false;")).toBe(true);
  });

  test("co CHI BAT SAU khi dang ky xong: lan dau NEM ⇒ co van false ⇒ lan hai dang ky lai du", () => {
    const { plugin } = loadBundle(artifactPath());
    const broken = stubContext({ failRegister: true });
    expect(() => plugin.apply(broken.ctx)).toThrow();
    const good = stubContext();
    plugin.apply(good.ctx);
    expect(good.record.registered.length).toBe(1);
    expect(good.record.effects.length).toBe(2); // từ điển gốc + lượt đăng ký tiếng Việt
  });

  test("HOP DONG STORE (muc 8): hooks.trajectory va hooks.duration la the hien DAY DU", () => {
    const { plugin } = loadBundle(artifactPath());
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    // (a) Cua de cho slot cua goi khac: uiSession.provide phai tra mot the hien day du.
    const provided = record.provided[0] as { hooks?: readonly string[]; resolve?: (binding: unknown) => unknown };
    expect([...(provided.hooks ?? [])]).toEqual(["trajectory"]);
    const face = provided.resolve?.(BINDING) as { hooks: { trajectory: Record<string, unknown> } };
    const trajectory = face.hooks.trajectory;
    expect(typeof trajectory.getSnapshot).toBe("function");
    expect(typeof trajectory.subscribe).toBe("function");
    // Muc tieu khong co du lieu ⇒ tra ve the rong NGUYEN VAN cua ban goc (khong phai undefined).
    const snapshot = (trajectory.getSnapshot as () => Record<string, unknown>)();
    expect(Object.keys(snapshot).sort()).toEqual(["callSchemas", "eventLocations", "eventNodes", "partial", "requests", "runningCalls"]);
    expect(snapshot.partial).toBeNull();
    const unsubscribe = (trajectory.subscribe as (listener: () => void) => unknown)(() => undefined);
    expect(typeof unsubscribe).toBe("function");
    // (b) Anh inject cua slot: duration PHAI la doi tuong cua thu vien, khong phai doi tuong tu che.
    const entry = record.registered[0] as RegisterCall;
    const inject = entry.spec.inject as (sessionId: string) => Record<string, unknown>;
    const injected = inject("session-1");
    const hooks = injected.hooks as { duration: Record<string, unknown> };
    expect(hooks.duration.__gbhStore).toBe(true);
    expect(typeof hooks.duration.getSnapshot).toBe("function");
    expect(typeof hooks.duration.subscribe).toBe("function");
    expect(typeof hooks.duration.set).toBe("function");
    const readDuration = hooks.duration.getSnapshot as () => unknown;
    expect(readDuration()).toBe(false);
    (hooks.duration.set as (value: unknown) => void)(true);
    expect(readDuration()).toBe(true);
    const wrapping = injected.jsonStringWrapping as { getDefault: () => unknown; setDefault: (value: unknown) => void };
    expect(wrapping.getDefault()).toBe(false);
    wrapping.setDefault(true);
    expect(wrapping.getDefault()).toBe(true);
    expect(typeof injected.loadOlder).toBe("function");
    expect(typeof injected.loadImage).toBe("function");
    expect(typeof (injected.loadImage as { peek?: unknown }).peek).toBe("function");
    expect(typeof injected.setActualDuration).toBe("function");
    // Phien khong ton tai ⇒ NEM (nguyen van hanh vi ban goc), khong tra ve nua voi.
    // Nap bundle TUOI: cong idempotent da bat o lan apply dau, nen can mot the hien module rieng.
    const missing = stubContext({ sessionMissing: true });
    loadBundle(artifactPath()).plugin.apply(missing.ctx);
    const missingInject = (missing.record.registered[0] as RegisterCall).spec.inject as (sessionId: string) => unknown;
    expect(() => missingInject("session-absent")).toThrow();
  });
});

describe("row ui-trajectory — tu dien doi chung tung chuoi", () => {
  test("zh va en cung 192 khoa, va TRUNG TUNG CHUOI voi tu dien cua ban goc", () => {
    const a = stubContext();
    const b = stubContext();
    loadBundle(artifactPath()).plugin.apply(a.ctx);
    loadBundle(STOCK).plugin.apply(b.ctx);
    expect(a.record.locales[0]?.ns).toBe("trajectory");
    const da = a.record.locales[0]?.dictionaries as { zh: Record<string, string>; en: Record<string, string> };
    const db = b.record.locales[0]?.dictionaries as { zh: Record<string, string>; en: Record<string, string> };
    expect(Object.keys(da.zh).length).toBe(192);
    expect(Object.keys(da.en).length).toBe(192);
    expect(Object.keys(da.zh).sort()).toEqual(Object.keys(da.en).sort());
    expect(da).toEqual(db);
    expect(da.zh["view.trajectory"]).toBe("轨迹");
    expect(da.en["view.trajectory"]).toBe("Trajectory");
  });
});

describe("row ui-trajectory — parity voi bundle goc", () => {
  test("than factory TRUNG KHOP TUNG BYTE (chi khac 5 dong require + khoi cong chan cai hai lan)", () => {
    const stockLines = readFileSync(STOCK, "utf8").split("\n");
    const firstRegion = stockLines.findIndex((line) => /^\t\t\/\/#region /.test(line));
    const lastEnd = stockLines.reduce((acc, line, index) => (/^\t\t\/\/#endregion\s*$/.test(line) ? index : acc), -1);
    expect(firstRegion).toBeGreaterThan(0);
    expect(lastEnd).toBeGreaterThan(firstRegion);
    const stockBody = stockLines.slice(firstRegion, lastEnd + 1).filter((line) => line.trim() !== "");
    const artifact = readFileSync(artifactPath(), "utf8").split("\n");
    const start = artifact.findIndex((line) => line === "    var exports = module.exports;");
    let end = -1;
    for (let i = start + 1; i < artifact.length; i++) if (artifact[i] === "  };") end = i;
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const body = artifact
      .slice(start + 1, end)
      .map((line) => (line.startsWith("      ") ? line.slice(6) : line))
      .filter((line) => line.trim() !== "")
      // Nam dong require do build.ts chen vao (ban goc khai chung ngoai vung region).
      .filter((line) => !/^\t\tlet [A-Za-z0-9_$]+ = require\("/.test(line))
      // Ba dong cuoi than bundle do CLIENT_TAIL_LINES chen vao (ban goc co, nhung ngoai vung region).
      .filter((line) => !/^\t\texports\.(apply|inject) = /.test(line))
      .filter((line) => !/^\t\treturn module\.exports;$/.test(line));
    // 20/10/2026 — khối viết tay của row nay là MỘT region trọn vẹn (cổng chống cài hai lần + từ điển VI);
    // bản gốc KHÔNG có region này. Bỏ ĐÚNG region đó rồi so TOÀN BỘ phần còn lại ⇒ vẫn chứng minh
    // thân factory chỉ khác bản gốc ở các dòng require và khối viết tay, không nới phép so.
    const guardStart = body.findIndex((line) => line.startsWith("\t\t//#region gbh-client-ui-trajectory/plugin-surface.js"));
    const guardEnd = body.findIndex((line, index) => index > guardStart && line === "\t\t//#endregion");
    expect(guardStart).toBeGreaterThan(0);
    expect(guardEnd).toBeGreaterThan(guardStart);
    const normalized = [...body.slice(0, guardStart), ...body.slice(guardEnd + 1)];
    // 20/10/2026 — LÔ ĐỔI TÊN BRAND: thân của ta mang `--gbh-*`, bản gốc mang `--dsh-*`
    // ⇒ chuẩn hoá ĐỐI XỨNG từng dòng ở cả hai vế rồi mới so (giữ nguyên phép so toàn văn).
    // 22/10/2026: tools/brand-ids-client.ts doi id du lieu stock -> id ta (ke ca @module trong JSDoc)
    //   ⇒ quy id ve cung mot ten o CA HAI ve roi moi so toan van (cung tinh than voi normalizeBrand).
    const quyId = (text: string): string => text.split("@galaxy-blackhole/gbh-").join("@deepseek-ai/dsh-");
    expect(normalized.map((line) => quyId(normalizeBrand(line)))).toEqual(stockBody.map((line) => quyId(normalizeBrand(line))));
  });

  test("CSS bon module TRUNG KHOP TUNG BYTE voi chuoi CSS trong bundle goc (giu hash lop goc)", () => {
    const stockText = readFileSync(STOCK, "utf8");
    const stockCss = [...stockText.matchAll(/^\t\tconst (css(?:\$\d+)?) = (".*");$/gm)].map((m) => JSON.parse(m[2] as string) as string);
    const ourCss = CSS_REPLACEMENTS.map((item) => cssBody(item.file));
    expect(ourCss.length).toBe(4);
    expect(stockCss.length).toBe(4);
    expect(ourCss).toEqual(stockCss);
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    for (const item of CSS_REPLACEMENTS) expect(artifact.includes(item.placeholder)).toBe(false);
    expect(artifact.includes(".Y0dWHa_table{")).toBe(true);
    expect(artifact.includes(".qBU-ya_root{")).toBe(true);
  });
});
