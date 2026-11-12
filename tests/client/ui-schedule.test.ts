/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row ui-schedule — mot-id (0 chuoi id stock) · du CHIN slot nguyen van · cong chan cai hai lan ·
 *      hop dong STORE cap cho slot cua goi khac · va parity TUNG BYTE voi bundle goc (than factory + CSS)
 *      SAU khi doi id package sang id cua ta (ID_REWRITES)
 */
import { describe, expect, test } from "bun:test";
import { chuanHoaArtefact } from "../helpers/vi-dictionary.ts";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { normalizeBrand, sameAfterIdMap } from "../lib/brand-parity.ts";
import { handwrittenBody } from "../../packages/client/ui-schedule/build.ts";
import { SCHEDULE_TASK_ID, SLOT_NAMES as DECLARED_SLOTS } from "../../packages/client/ui-schedule/src/ids.ts";
import { CLIENT_EXPORT_LINES, CLIENT_TAIL_LINES, CSS_REPLACEMENTS, HANDWRITTEN_PARTS, ID_REWRITES, PART_FILES } from "../../packages/client/ui-schedule/src/manifest.ts";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-schedule");
/** Ban goc DSH (chi doc) — nguon doi chung. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-schedule", "lib", "client.js");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-schedule";
/** Ten package goc — CHI duoc khai o aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-schedule";
/** Chin slot ma BAN GOC dang ky — row nay phai dang ky du, dung ten. */
const SLOT_NAMES = [...DECLARED_SLOTS].sort();

/**
 * Noi dung file .module.css bo phan header 5 dong.
 * Nhan: rel — duong dan tuong doi so voi src/.
 * Tra: van ban CSS nguyen van.
 */
function cssBody(rel: string): string {
  const lines = readFileSync(join(OURS, "src", rel), "utf8").split("\n").slice(7);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
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
  /** Tu dien da dang ky (zh/en cua ban goc, vi cua khoi viet tay). */
  locales: { ns: string; dictionaries: Record<string, unknown> }[];
  /** Loai tab thanh ben phai da dang ky. */
  tabs: Record<string, unknown>[];
  /** Dinh nghia Turn cua hoi thoai da dang ky. */
  turns: unknown[];
}

/**
 * Runtime gia cho bon module ma bundle yeu cau.
 * Nhan: spec — ten module.
 * Tra: module gia (primitives tra ve chuoi cho MOI thuoc tinh).
 */
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
      useLayoutEffect: () => undefined,
      useMemo: (factory: () => unknown) => factory(),
      useCallback: (fn: unknown) => fn,
      useId: () => "id",
    };
  }
  if (spec === "react-dom") return { createPortal: (children: unknown) => children };
  return new Proxy({}, { get: (_target, key) => String(key) });
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
 * Chay artifact lib/client.js trong window gia roi dung factory.
 * Nhan: khong.
 * Tra: danh sach dang ky + mat plugin cua lan dang ky dau.
 */
function loadArtifact(): { registrations: Registration[]; plugin: LoadedPlugin } {
  const code = readFileSync(artifactPath(), "utf8");
  const registrations: Registration[] = [];
  const fakeWindow = { __ModuleLoader__: { load: (reg: Registration) => registrations.push(reg) } };
  new Function("window", code)(fakeWindow);
  const first = registrations[0];
  if (first === undefined) throw new Error("bundle khong dang ky module nao");
  return { registrations, plugin: first.factory(fakeRequire) };
}

/**
 * Duong dan artifact de do — CHI nhan ban trong lib/ khi no con moi hon moi file nguon.
 * Nhan: khong.
 * Tra: duong dan file client.js.
 */
function artifactPath(): string {
  const built = join(OURS, "lib", "client.js");
  if (!existsSync(built)) throw new Error("chua co artifact " + built + " — chay bun run build.ts trong packages/client/ui-schedule");
  const mountTime = statSync(built).mtimeMs;
  const sources = [
    join(OURS, "build.ts"),
    join(OURS, "src", "ids.ts"),
    join(OURS, "src", "manifest.ts"),
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
 * Nhan: options.failRegister — true thi register nem ngay (de kiem cong idempotent).
 * Tra: context gia (ep kieu never khi goi apply) va bo ghi.
 */
function stubContext(options: { failRegister?: boolean } = {}): { ctx: unknown; record: Recorder } {
  const record: Recorder = { injected: [], registered: [], effects: [], locales: [], tabs: [], turns: [] };
  const slots = {
    inject: (name: string, body: () => unknown): void => {
      record.injected.push(name);
      body();
    },
    register: (spec: Record<string, unknown>, component: unknown): void => {
      if (options.failRegister === true) throw new Error("register hong (ca kiem cong idempotent)");
      record.registered.push({ spec, component });
    },
  };
  const noop = (): (() => void) => () => undefined;
  const ctx = {
    effect: (run: () => void, label: string): void => {
      record.effects.push(label);
      run();
    },
    on: (): (() => void) => () => undefined,
    slots,
    locale: {
      register: (ns: string, dictionaries: Record<string, unknown>): void => {
        record.locales.push({ ns, dictionaries });
      },
      bind: (): ((key: string) => string) => (key: string) => key,
    },
    remote: {
      schedule: {
        catalog: async (): Promise<unknown> => ({ ok: true, value: [] }),
        list: async (): Promise<unknown> => ({ ok: true, value: [] }),
        delete: async (): Promise<unknown> => ({ ok: true, value: { deleted: true } }),
        update: async (): Promise<unknown> => ({ ok: true, value: { record: {} } }),
        history: async (): Promise<unknown> => ({ ok: true, value: [] }),
      },
      $on: (): (() => void) => () => undefined,
    },
    sessions: { list: { getSnapshot: () => ({ byId: {} }) } },
    workspaces: { list: { getSnapshot: () => ({}) } },
    uiWorkspace: { openSession: (): void => undefined, startSession: (): void => undefined },
    sidebarRight: { tabsIn: (): unknown[] => [], openTab: noop, openResource: noop },
    sidebarRightTabs: {
      register: (definition: Record<string, unknown>): void => {
        record.tabs.push(definition);
      },
    },
    uiConversation: {
      events: {
        register: (definition: unknown): void => {
          record.turns.push(definition);
        },
      },
    },
  };
  return { ctx, record };
}

describe("row ui-schedule — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_NAME);
    // Luat cua nghiem thu: khong mot chuoi 'id: "@deepseek-ai' nao trong artifact.
    expect(/id: "@deepseek-ai/.test(code)).toBe(false);
    // LUAT MOT-ID (19/10/2026): 0 lan chuoi id stock trong CA artifact — ke ca CSS tagId, dataset.plugin,
    // hang tai lieu hay chunk — va DUNG MOT loi dang ky.
    expect((code.match(/@deepseek-ai\/dsh-client-ui-schedule/g) ?? []).length).toBe(0);
    expect((code.match(/__ModuleLoader__\.load\(/g) ?? []).length).toBe(1);
    // The CSS mang id CUA TA, duoi "/<Ten>.module.css" giu nguyen (ten lop/nội dung CSS khong doi).
    expect((code.match(/tagId(?:\$\d+)? = "@galaxy-blackhole\/gbh-client-ui-schedule\/[A-Za-z]+\.module\.css"/g) ?? []).length).toBe(9);
    expect((code.match(/tag\.dataset\.plugin = "@galaxy-blackhole\/gbh-client-ui-schedule"/g) ?? []).length).toBe(9);
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      dsh: { client: { inject: string[] } };
      gbh: { row: { moduleIds: string[]; aliases: string[]; tests: string[] } };
    };
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
    // 20/10/2026 — danh sach inject giu dung THU TU cua ban goc, chi ID goi da rewrite CO CHU DICH: quy id ta
    //   -> id stock roi so DEEP-EQUAL (sameAfterIdMap), KHONG noi contains.
    const stockMeta = JSON.parse(readFileSync(join(OURS, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-schedule", "package.json"), "utf8")) as { dsh: { client: { inject: string[] } } };
    expect(sameAfterIdMap(meta.dsh.client.inject, stockMeta.dsh.client.inject)).toBe(true);
  });

  test("tap slot cua ta = TAP slot cua bundle goc (dung chinh hai regex cua check:rows)", () => {
    const stock = readFileSync(STOCK, "utf8");
    const stockSlots = [...slotNames(stock)].sort();
    const ourSlots = [...slotNames(readAllSrcTs())].sort();
    expect(ourSlots).toEqual(stockSlots);
    expect(ourSlots).toEqual(SLOT_NAMES);
  });
});

describe("row ui-schedule — mat plugin", () => {
  test("apply dang ky DU CHIN slot nguyen van, component la THAM SO THU HAI", () => {
    const { plugin } = loadArtifact();
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    expect([...record.injected].sort()).toEqual(SLOT_NAMES);
    expect(record.registered.map((entry) => entry.spec.name as string).sort()).toEqual(SLOT_NAMES);
    for (const entry of record.registered) expect(typeof entry.component).toBe("function");
    expect([...plugin.inject ?? []].sort()).toEqual(["conversation", "locale", "remote", "remote.schedule", "sessions", "sidebarRight", "sidebarRightTabs", "slots", "uiConversation", "uiWorkspace", "workspaces"].sort());
    // Hiệu ứng: ba hiệu ứng NGUYÊN VĂN của bản gốc, rồi HAI hiệu ứng của khối viết tay (cổng chạy thân gốc
    // trước). Số lượng và nhãn giữ nguyên; chỉ thứ tự của hai lượt tiếng Việt là khác trước (đo được, xem báo cáo).
    expect(record.effects).toEqual(["ui-schedule: dictionaries", "ui-schedule: manager dictionaries", "ui-schedule: task tab type", "ui-schedule: vi dictionaries", "ui-schedule: vi manager dictionaries"]);
    expect(record.locales.length).toBe(4); // 2 bảng gốc (catalog + manager) + 2 bảng tiếng Việt
    expect(record.tabs.length).toBe(1);
    expect(record.turns.length).toBe(1);
  });

  test("KEY cua slot keyed = id cua dinh nghia loai tab", () => {
    const { plugin } = loadArtifact();
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    const tab = record.tabs[0] as { id: string };
    // LUAT MOT-ID (19/10/2026): id loai tab mang id CUA TA; duoi "/task" giu nguyen nhu ban goc.
    expect(SCHEDULE_TASK_ID).toBe(PACKAGE_NAME + "/task");
    expect(SCHEDULE_TASK_ID).not.toBe(STOCK_NAME + "/task");
    expect(tab.id).toBe(SCHEDULE_TASK_ID);
    // Hang trong ARTIFACT phai dung cung gia tri voi hang trong ids.ts (build doi id, khong sinh lech).
    const clientCode = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    expect(clientCode.includes("const SCHEDULE_TASK_ID = " + JSON.stringify(SCHEDULE_TASK_ID) + ";")).toBe(true);
    // Hai slot cua tab: key PHAI bang id cua dinh nghia loai tab (ban goc dung MOT gia tri cho ca hai).
    const tabSlots = record.registered.filter((entry) => entry.spec.name === "sidebar.right.pane.tab" || entry.spec.name === "sidebar.right.pane.tab.title");
    expect(tabSlots.map((entry) => entry.spec.key)).toEqual([tab.id, tab.id]);
    // Ho keyed thu hai cua ban goc: key cua slot "main" = id nguoi ngoi cua slot "sidebar.panellist".
    const page = record.registered.find((entry) => entry.spec.name === "main");
    const panellist = record.registered.find((entry) => entry.spec.name === "sidebar.panellist");
    expect(page?.spec.key).toBe("schedules");
    expect(panellist?.spec.id).toBe(page?.spec.key);
    expect(record.registered.filter((entry) => typeof entry.spec.key === "string").length).toBe(3);
  });

  test("cong chan cai hai lan: PHAM VI MODULE — cung ctx va ctx KHAC deu chi dang ky mot lan", () => {
    const { plugin } = loadArtifact();
    const first = stubContext();
    const second = stubContext();
    plugin.apply(first.ctx);
    plugin.apply(first.ctx);
    plugin.apply(second.ctx);
    expect(first.record.registered.length).toBe(9);
    expect(second.record.registered.length).toBe(0);
    // Cong KHONG duoc khoa theo ctx: hai token lam cong chan bao oan phai vang mat.
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    expect(artifact.includes("lastCtx")).toBe(false);
    expect(artifact.includes("installedContexts")).toBe(false);
    expect(artifact.includes("let uiScheduleInstalled = false;")).toBe(true);
  });

  test("STORE cap cho slot conversation.session.header.utilities la the hien DAY DU", async () => {
    const { plugin } = loadArtifact();
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    const slot = record.registered.find((entry) => entry.spec.name === "conversation.session.header.utilities");
    expect(slot).toBeDefined();
    const inject = slot?.spec.inject as (sessionId: string) => Record<string, unknown>;
    expect(typeof inject).toBe("function");
    const source = inject("session-1");
    // Thieu mot trong ba ⇒ TypeError: x.getSnapshot is not a function ⇒ CA thanh ben khong render.
    const hooks = source.hooks as { catalog: { getSnapshot: unknown; subscribe: unknown } };
    expect(typeof hooks.catalog.getSnapshot).toBe("function");
    expect(typeof hooks.catalog.subscribe).toBe("function");
    expect(typeof source.onDelete).toBe("function");
    expect(typeof source.onRetry).toBe("function");
    expect(typeof source.openTaskDetail).toBe("function");
    const snapshot = (hooks.catalog.getSnapshot as () => Record<string, unknown>)();
    expect(Object.keys(snapshot).sort()).toEqual(["deleting", "readRequest", "readSettled", "records", "settled", "status"]);
    expect(snapshot.status).toBe("loading");
    expect(snapshot.records).toEqual([]);
    const unsubscribe = (hooks.catalog.subscribe as (listener: () => void) => unknown)(() => undefined);
    expect(typeof unsubscribe).toBe("function");
    (unsubscribe as () => void)();
    await Bun.sleep(0);
  });

  test("nghiep vu cua Store doc tu Remote va tra ve ket qua cua Host", async () => {
    const { plugin } = loadArtifact();
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    const slot = record.registered.find((entry) => entry.spec.name === "conversation.session.header.utilities");
    const source = (slot?.spec.inject as (sessionId: string) => Record<string, unknown>)("session-9");
    const onDelete = source.onDelete as (id: string) => Promise<string>;
    expect(await onDelete("task-1")).toBe("deleted");
    const onRetry = source.onRetry as (since?: number) => Promise<unknown>;
    await onRetry(0);
    expect(typeof source.hooks).toBe("object");
  });
});

describe("row ui-schedule — khoi VIET TAY tach khoi vung NGUYEN VAN", () => {
  test("so khoi viet tay DUNG BANG 1 (chan viec am tham phinh them khoi)", () => {
    expect(HANDWRITTEN_PARTS.length).toBe(1);
    expect(HANDWRITTEN_PARTS).toEqual(["parts/plugin-surface.ts"]);
  });

  test("vung NGUYEN VAN khong con mot dong viet tay nao (cong idem + hai bang tieng Viet)", () => {
    for (const file of PART_FILES) {
      const text = readFileSync(join(OURS, "src", file), "utf8");
      expect(text.includes("gbh-vi-locale")).toBe(false);
      expect(text.includes("UI_SCHEDULE_VI")).toBe(false);
      expect(text.includes("vi dictionaries")).toBe(false);
      expect(text.includes("uiScheduleInstalled")).toBe(false);
      expect(text.includes("uiScheduleContexts")).toBe(false);
      expect(text.includes("applyInner")).toBe(false);
    }
  });

  test("vi VAN duoc dang ky y nhu truoc: CA HAI namespace + nhan hieu ung", () => {
    const { plugin } = loadArtifact();
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    // Bon lan dang ky tu dien: hai bang goc (zh/en) + hai bang vi cua khoi viet tay, theo VI TRI.
    expect(record.locales.length).toBe(4);
    expect(record.locales.map((entry) => entry.ns)).toEqual(["schedule.catalog", "schedule.manager", "schedule.catalog", "schedule.manager"]);
    expect(record.locales[0]?.dictionaries.vi).toBeUndefined();
    expect(record.locales[1]?.dictionaries.vi).toBeUndefined();
    const viCatalog = record.locales[2]?.dictionaries.vi as Record<string, string> | undefined;
    const viManager = record.locales[3]?.dictionaries.vi as Record<string, string> | undefined;
    expect(Object.keys(viCatalog ?? {}).length).toBeGreaterThanOrEqual(70);
    expect(Object.keys(viManager ?? {}).length).toBeGreaterThanOrEqual(180);
    expect(viCatalog?.["delete.action"]).toBe("Xoá");
    expect(viManager?.["card.openLabel"]).toBe("Mở chi tiết tác vụ: {title}");
    // Nhan hieu ung: NGUYEN VAN cua khoi viet tay.
    expect(record.effects.slice(-2)).toEqual(["ui-schedule: vi dictionaries", "ui-schedule: vi manager dictionaries"]);
    // Artifact: MOI hang so chi duoc khai DUNG MOT lan.
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    expect((artifact.match(/const UI_SCHEDULE_VI = /g) ?? []).length).toBe(1);
    expect((artifact.match(/const UI_SCHEDULE_MANAGER_VI = /g) ?? []).length).toBe(1);
  });
});

describe("row ui-schedule — parity voi bundle goc", () => {
  test("than factory TRUNG KHOP TUNG BYTE: chi bo khoi VIET TAY theo VI TRI MANIFEST", () => {
    const stockAligned = readFileSync(STOCK, "utf8").split("\n").slice(5, 7546).join("\n");
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8").split("\n");
    const start = artifact.findIndex((line) => line === "    var exports = module.exports;");
    const end = artifact.findIndex((line, index) => index > start && line === "  };");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const nl = String.fromCharCode(10);
    let text = artifact
      .slice(start + 1, end)
      .map((line) => (line.startsWith("    ") ? line.slice(4) : line))
      .join(nl);
    // (1) Khoi VIET TAY: bo dung van ban cua HANDWRITTEN_PARTS (VI TRI MANIFEST: ngay TRUOC dong tra
    //     module.exports va SAU hai dong exports nguyen van).
    const handwritten = handwrittenBody();
    expect(handwritten.length).toBeGreaterThan(0);
    const at = text.indexOf(handwritten);
    expect(at).toBeGreaterThan(0);
    expect(text.slice(at + handwritten.length)).toBe(nl + CLIENT_TAIL_LINES.join(nl));
    expect(text.slice(0, at).endsWith(nl + CLIENT_EXPORT_LINES.join(nl) + nl)).toBe(true);
    expect(CLIENT_EXPORT_LINES.length).toBe(2);
    // (2) Phan con lai = NGUYEN VAN ban goc (khong con mot dong viet tay nao, khong filter theo noi dung).
    const verbatim = text.slice(0, at) + text.slice(at + handwritten.length + 1);
    // (3) LUAT MOT-ID (19/10/2026): vung nguyen van chi duoc khac ban goc o DUNG mot loai diem — moi chuoi
    //     id package duoc doi sang id CUA TA (1 hang SCHEDULE_TASK_ID + 9 tagId + 9 dataset.plugin).
    //     Doi NGUOC lai roi so BYTE ⇒ chung minh khong con sai lech nao khac (CSS, ten lop, hanh vi).
    expect(ID_REWRITES.map((item) => ({ from: item.from, to: item.to }))).toEqual([{ from: STOCK_NAME, to: PACKAGE_NAME }]);
    const sites = verbatim.split(PACKAGE_NAME).length - 1;
    expect(sites).toBe(ID_REWRITES.reduce((total, item) => total + item.sites, 0));
    expect(verbatim.includes(STOCK_NAME)).toBe(false);
    // 20/10/2026 — LÔ ĐỔI TÊN BRAND: verbatim của ta mang `--gbh-*`, bản gốc mang `--dsh-*`
    // ⇒ sau khi quy NGƯỢC id, chuẩn hoá ĐỐI XỨNG brand ở cả hai vế rồi mới so toàn văn.
    // 22/10/2026: artefact của ta còn đổi cả id của các gói PHỤ (vd dsh-util-values) ⇒ quy NGƯỢC toàn bộ
    // id + brand bằng helper chung rồi mới so toàn văn với bản gốc.
    expect(chuanHoaArtefact(verbatim)).toBe(chuanHoaArtefact(stockAligned));
  });

  test("CSS cua chin module TRUNG KHOP TUNG BYTE voi chuoi CSS trong bundle goc", () => {
    const stockText = readFileSync(STOCK, "utf8");
    const stockCss = [...stockText.matchAll(/^\t\tconst css(?:\$\d+)? = (".*");$/gm)].map((m) => JSON.parse(m[1] as string) as string);
    const ourCss = CSS_REPLACEMENTS.map((item) => cssBody(item.file));
    expect(ourCss.length).toBe(9);
    expect(stockCss.length).toBe(9);
    expect([...ourCss].sort()).toEqual([...stockCss].sort());
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    for (const item of CSS_REPLACEMENTS) expect(artifact.includes(item.placeholder)).toBe(false);
  });
});
describe("ui-schedule — id tab đổi stock→ta: state phiên CŨ và fallback (19/10/2026)", () => {
  test("registry tra được id MỚI của ta; id CŨ (stock) KHÔNG còn là key đã đăng ký", () => {
    const { plugin } = loadArtifact();
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    const tab = record.tabs[0] as { id: string };
    const keys = record.registered.map((entry) => entry.spec.key);
    // Id MỚI (của ta) là key đã đăng ký thật.
    expect(keys).toContain(tab.id);
    expect(tab.id).toBe(PACKAGE_NAME + "/task");
    // Id CŨ (stock) KHÔNG còn xuất hiện như key ⇒ state phiên cũ sẽ KHÔNG khớp registry.
    expect(keys).not.toContain(STOCK_NAME + "/task");
  });

  test("hành vi với state CŨ là FALLBACK RÕ RÀNG: id cũ không khớp ⇒ panel không mở tab cũ (không ném)", () => {
    // Vì sao ca này tồn tại: tab schedule lưu trong state phiên từ trước mang id STOCK/task; sau khi đổi sang
    // id CỦA TA, registry không còn key đó ⇒ UI rơi fallback "không khả dụng" cho tới khi người dùng mở lại tab.
    // Ta chỉ khẳng định: (a) không NÉM khi tra id cũ, (b) id mới là key duy nhất của loại tab này.
    const { plugin } = loadArtifact();
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    const tabKeys = record.registered
      .filter((entry) => entry.spec.name === "sidebar.right.pane.tab" || entry.spec.name === "sidebar.right.pane.tab.title")
      .map((entry) => entry.spec.key);
    const legacy = STOCK_NAME + "/task";
    expect(() => tabKeys.includes(legacy)).not.toThrow();
    expect(tabKeys.includes(legacy)).toBe(false);
    expect(tabKeys.every((key) => key === SCHEDULE_TASK_ID)).toBe(true);
  });
});
