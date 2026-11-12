/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row ui-deliverables — luat mot-id O DONG LOADER (du lieu giu id goc) · TAP slot bang dung ban goc · tu dien va CSS nguyen van tung byte ·
 *      doi chieu truc tiep mat dang ky voi bundle goc trong window gia · cong idempotent pham vi module
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-deliverables");
/** Thu muc goi goc DSH (chi doc). */
const STOCK_DIR = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-deliverables");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-deliverables";
/** Ten package goc — chi duoc khai o gbh.row.aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-deliverables";
/** Nguon bundle goc cua nua client. */
const STOCK_CLIENT = readFileSync(join(STOCK_DIR, "lib", "client.js"), "utf8");

/** Ba slot ma ban goc dang ky — row nay phai dang ky du, dung ten. */
const SLOT_NAMES = ["conversation.chat.turnTail", "tool.call.toolview", "sidebar.right.pane.tab"].sort();

/** Mot dang ky bat duoc tu bundle. */
type Entry = { id: string; factory: (require: (spec: string) => unknown) => unknown };
/** Mat plugin (hai nua giong nhau o hai truong nay). */
type Plugin = { apply: (ctx: unknown) => void; inject: readonly string[] };
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
  effects: (string | undefined)[];
  /** Tu dien da dang ky. */
  locales: { ns: string; dictionaries: { zh: unknown; en: unknown } }[];
  /** Loai tab thanh ben phai da dang ky. */
  tabs: Record<string, unknown>[];
  /** Dinh nghia su kien hoi thoai da dang ky. */
  events: unknown[];
  /** Dich vu da cung cap. */
  provided: { name: string; value: unknown }[];
  /** The style da chen. */
  styles: { tagId: string; plugin: string; css: string }[];
}

/**
 * Document gia: ghi lai the style duoc chen thay vi cham vao DOM that.
 * Nhan: record — bo ghi.
 * Tra: doi tuong document gia.
 */
function fakeDocument(record: Recorder): unknown {
  return {
    querySelector: () => null,
    createElement: () => ({ dataset: {} as Record<string, string>, textContent: "" }),
    head: {
      appendChild: (tag: { dataset: Record<string, string>; textContent: string }) => {
        record.styles.push({ tagId: tag.dataset["pluginCss"] ?? "", plugin: tag.dataset["plugin"] ?? "", css: tag.textContent });
      },
    },
  };
}

/**
 * Store chup anh gia (createSnapshotStore): du de store that cua row chay.
 * Nhan: initial — trang thai dau.
 * Tra: doi tuong store gia.
 */
function snapshotStore(initial: Record<string, unknown>): unknown {
  let state = { ...initial };
  return {
    getSnapshot: () => state,
    update: (fn: (draft: Record<string, unknown>) => void) => {
      const draft = { ...state };
      fn(draft);
      state = draft;
    },
    set: (next: Record<string, unknown>) => {
      state = { ...next };
    },
  };
}

/** Runtime gia: jsx/jsxs tra ve cay node, react hook la ham thuan, store la store chup anh gia. */
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
      useId: () => "id",
      useMemo: (factory: () => unknown) => factory(),
    };
  }
  if (spec .endsWith("-client-store")) return { createSnapshotStore: snapshotStore, defineStore: (value: unknown) => value };
  return fakePrimitives;
}

/** Primitive gia: moi primitive la mot ham tra ve marker, rieng ba ham tien ich tra gia tri that. */
const fakePrimitives: Record<string, unknown> = new Proxy(
  {
    fileExtension: () => "TXT",
    languageForPath: () => "plaintext",
    useCodeHighlighter: () => () => [],
  } as Record<string, unknown>,
  {
    get: (target, name: string) => target[name] ?? ((props: unknown) => ({ type: "Primitive", name, props })),
  },
);

/**
 * Nap bundle goc trong mot window gia va lay factory cua no.
 * Nhan: record — bo ghi the style.
 * Tra: factory da dang ky trong window gia.
 */
function stockFactory(record: Recorder): (require: (spec: string) => unknown) => Plugin {
  const entries: Entry[] = [];
  const win = { __ModuleLoader__: { load: (entry: Entry) => entries.push(entry) } };
  new Function("window", "document", STOCK_CLIENT)(win, fakeDocument(record));
  const entry = entries.find((item) => item.id === STOCK_NAME);
  if (entry === undefined) throw new Error("bundle goc khong dang ky id " + STOCK_NAME);
  return entry.factory as (require: (spec: string) => unknown) => Plugin;
}

/**
 * Context gia: ghi lai moi dang ky va chay ngay callback cua inject/effect (giong vo that).
 * Nhan: record — bo ghi; options.failRegister — true thi register nem ngay (de kiem cong idempotent).
 * Tra: context gia.
 */
function stubContext(record: Recorder, options: { failRegister?: boolean } = {}): unknown {
  const scope = {
    effect: (run: () => unknown, label?: string) => {
      record.effects.push(label);
      run();
    },
    slots: {
      inject: (name: string, body: () => unknown) => {
        record.injected.push(name);
        body();
      },
      register: (spec: Record<string, unknown>, component: unknown) => {
        if (options.failRegister === true) throw new Error("register hong (ca kiem cong idempotent)");
        record.registered.push({ spec, component });
      },
    },
  };
  return {
    effect: scope.effect,
    on: () => undefined,
    inject: (names: readonly string[], run: (value: typeof scope) => void) => {
      expect(names).toContain("slots");
      run(scope);
    },
    slots: scope.slots,
    locale: {
      register: (ns: string, dictionaries: { zh: unknown; en: unknown }) => record.locales.push({ ns, dictionaries }),
      bind: () => (key: string) => key,
    },
    uiConversation: { events: { register: (definition: unknown) => record.events.push(definition) } },
    sidebarRightTabs: { register: (definition: Record<string, unknown>) => record.tabs.push(definition) },
    sidebarRight: { openResource: () => undefined },
    configForms: { developerTools: { enabled: true } },
    provide: (name: string, value: unknown) => record.provided.push({ name, value }),
  };
}

/** Bo ghi rong. */
function emptyRecord(): Recorder {
  return { injected: [], registered: [], effects: [], locales: [], tabs: [], events: [], provided: [], styles: [] };
}

/**
 * Chay apply cua mot mat plugin tren context gia va tra ve bo ghi.
 * Nhan: plugin — mat plugin; options.failRegister — ep register nem.
 * Tra: bo ghi sau khi apply.
 */
function recordApply(plugin: Plugin, options: { failRegister?: boolean } = {}): Recorder {
  const record = emptyRecord();
  plugin.apply(stubContext(record, options));
  return record;
}

/**
 * Nap lai module client TUOI (co uiDeliverablesInstalled o pham vi module nen import tinh se dinh giua cac ca).
 * Nhan: tag — hau to query de moi ca co mot instance module rieng.
 * Tra: ham createPlugin cua instance do.
 */
async function freshCreatePlugin(tag: string): Promise<(requireFn: (spec: string) => unknown) => Plugin & { name: string }> {
  const mod = (await import("../../packages/client/ui-deliverables/src/plugin.ts?" + tag)) as {
    createPlugin: (requireFn: (spec: string) => unknown) => Plugin & { name: string };
  };
  return mod.createPlugin;
}

/**
 * Doc mot tu dien (zh/en) NGUYEN VAN tu bundle goc.
 * Nhan: name — ten tu dien can doc.
 * Tra: doi tuong tu dien cua ban goc.
 */
function stockDictionary(name: "zh" | "en"): Record<string, string> {
  const at = STOCK_CLIENT.indexOf("const " + name + " = {");
  if (at < 0) throw new Error("khong thay tu dien " + name + " trong bundle goc");
  const open = STOCK_CLIENT.indexOf("{", at);
  let depth = 0;
  let inString = false;
  let quote = "";
  let end = open;
  for (let i = open; i < STOCK_CLIENT.length; i += 1) {
    const ch = STOCK_CLIENT[i] as string;
    if (inString) {
      if (ch === "\\") i += 1;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === "\"" || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return new Function("return " + STOCK_CLIENT.slice(open, end + 1))() as Record<string, string>;
}

/** Rut cac chuoi CSS ma bundle goc nhung (css$1..css$4 va css cua ReviewTab). */
function stockCss(): string[] {
  const found: string[] = [];
  for (const m of STOCK_CLIENT.matchAll(/const css\$?\d* = ("(?:[^"\\]|\\.)*");/g)) found.push(JSON.parse(m[1] as string) as string);
  return found;
}

/**
 * Than CSS cua mot file .module.css cua ta (bo header 5 dong cua repo).
 * Nhan: file — ten file trong src/.
 * Tra: van ban CSS nguyen van.
 */
function ourCss(file: string): string {
  const text = readFileSync(join(OURS, "src", file), "utf8");
  return text.slice(text.indexOf("*/") + 2).replace(/^\s*\n/, "").replace(/\n$/, "");
}

/** Noi dung moi file .ts trong src/ (de chay dung hai regex cua check:rows). */
function allOurSource(): string {
  return readdirSync(join(OURS, "src"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(OURS, "src", name), "utf8"))
    .join("\n");
}

/**
 * Rut ten cac slot ma mot doan ma dang ky — CHINH HAI REGEX cua tools/check/rows.ts.
 * Nhan: text — noi dung ma nguon hoac ban build.
 * Tra: tap ten slot.
 */
function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["\']([^"\']+)["\']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["\']([^"\']+)["\']/g)) out.add(m[1] as string);
  return out;
}
describe("row ui-deliverables — khuon bundle", () => {
  test("artifact dang ky DUNG MOT id (id cua ta) o DONG LOADER; id goc con lai la DU LIEU giu nguyen", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    // 20/10/2026 — DE-BUNDLE CO CHU DICH (tools/debundle-client.ts): artifact gio la LAT NGUYEN VAN cua bundle
    //   goc nen khuon loader la ba dong lien nhau (id o DONG RIENG, thut TAB) thay cho mot dong
    //   `load({ id: ..., factory: factory })` cua build.ts viet tay cu. Phep so van NGUYEN VAN tren dung khuon
    //   moi — KHONG noi sang contains, KHONG bo luat MOT-ID.
    const LOADER = /window\.__ModuleLoader__\.load\(\{\n\tid: ("[^"]+"),\n\tfactory: \(require\) => \{/g;
    const ids = [...code.matchAll(LOADER)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Dung MOT loi goi loader trong toan artifact (ke ca loi goi lech khuon).
    expect(code.split("__ModuleLoader__.load(").length - 1).toBe(1);
    // 20/10/2026 — CANON (tools/debundle-client.ts): quy id CHỈ Ở DÒNG LOADER. Mọi lần xuất hiện khác của id
    //   gói là DỮ LIỆU (khoá slot, owner id, nhãn, dataset.plugin…) nên GIỮ id stock y bản gốc. Bản gốc có
    //   đúng hai dòng id package: dòng 2 (loader) + dòng 2275 (id NGƯỜI NGỒI của slots.register).
    //   ⇒ So DANH SÁCH DÒNG NGUYÊN VĂN với bản gốc sau khi CHỈ thay dòng loader (không đòi tuyệt đối 0).
    const idLines = (text: string): string[] =>
      text.split("\n").filter((line) => line.trimStart().startsWith('id: "')).map((line) => line.trim());
    const stockIdLines = idLines(STOCK_CLIENT);
    // 22/10/2026: bản gốc có đúng 2 dòng id package (loader + id người ngồi) — đếm để tự kiểm phép đo.
    expect(stockIdLines.length).toBe(2);
    // 22/10/2026: MỌI dòng id trong artefact đều là id CỦA TA (loader + id người ngồi của slots.register).
    const ourIdLine = 'id: "' + PACKAGE_NAME + '",';
    expect(idLines(code).every((line) => line === ourIdLine)).toBe(true);
    // Loader nap bang the script classic ⇒ cu phap ESM la SyntaxError (lat nguyen van cua ban goc: 0 dong).
    expect(/^\s*(export|import)\s/m.test(code)).toBe(false);
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      dsh: { client: { inject: string[] } };
      gbh: { row: { moduleIds: string[]; aliases: string[] } };
    };
    const stockMeta = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as { dsh: { client: { inject: string[] } } };
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
    // 20/10/2026 — id inject da REWRITE CO CHU DICH sang id GBH; so SAU KHI quy id ve id stock, giu
    // nguyen manifest goc lam chuan (DUNG TUNG ID, DUNG THU TU), khong noi ngung.
    expect(sameAfterIdMap(meta.dsh.client, stockMeta.dsh.client)).toBe(true);
  });

  test("TAP slot cua ta = TAP slot cua bundle goc (dung hai regex cua check:rows)", () => {
    const stock = slotNames(STOCK_CLIENT);
    const ours = slotNames(allOurSource());
    expect([...ours].sort()).toEqual([...stock].sort());
    expect([...ours].sort()).toEqual(SLOT_NAMES);
  });
});

describe("row ui-deliverables — doi chieu truc tiep voi bundle goc trong window gia", () => {
  test("cung mot context gia: mat dang ky cua ta khop tung muc voi ban goc", async () => {
    const createPlugin = await freshCreatePlugin("parity");
    const stockRecord = emptyRecord();
    const stock = stockFactory(stockRecord)(fakeRequire);
    const ours = createPlugin(fakeRequire);
    const ourRecord = recordApply(ours);
    stock.apply(stubContext(stockRecord));

    // (1) Cung tap slot inject va cung tap spec (ten, thu tu).
    expect(ourRecord.injected).toEqual(stockRecord.injected);
    expect([...ourRecord.injected].sort()).toEqual(SLOT_NAMES);
    expect(ourRecord.registered.map((entry) => entry.spec["name"])).toEqual(stockRecord.registered.map((entry) => entry.spec["name"]));
    // (2) Cung tap khoa trong spec — khong thua, khong thieu mot khoa nao.
    for (let i = 0; i < stockRecord.registered.length; i += 1) {
      const mine = ourRecord.registered[i] as RegisterCall;
      const theirs = stockRecord.registered[i] as RegisterCall;
      expect(Object.keys(mine.spec).sort()).toEqual(Object.keys(theirs.spec).sort());
      for (const key of ["name", "id", "key", "locale", "order", "priority"]) {
        expect(mine.spec[key]).toEqual(theirs.spec[key]);
      }
      expect(mine.spec["children"]).toEqual(theirs.spec["children"]);
      // (3) Component la THAM SO THU HAI va la ham.
      expect(typeof mine.component).toBe("function");
      // (4) Nghiep vu tiem vao slot: cung tap khoa, cung tap hook.
      if (typeof theirs.spec["inject"] !== "function") {
        // Slot khong tiem nghiep vu (tool.call.toolview) thi ta cung khong duoc tiem.
        expect("inject" in mine.spec).toBe(false);
        continue;
      }
      const mineInject = (mine.spec["inject"] as () => Record<string, unknown>)();
      const theirInject = (theirs.spec["inject"] as () => Record<string, unknown>)();
      expect(Object.keys(mineInject).sort()).toEqual(Object.keys(theirInject).sort());
      expect(Object.keys(mineInject["hooks"] as Record<string, unknown>).sort()).toEqual(
        Object.keys(theirInject["hooks"] as Record<string, unknown>).sort(),
      );
    }
    // (5) Seam nguyen van.
    expect([...ours.inject]).toEqual([...stock.inject]);
    // (6) Loai tab thanh ben phai: cung hinh dang dang ky.
    expect(ourRecord.tabs.length).toBe(stockRecord.tabs.length);
    const ourTab = ourRecord.tabs[0] as Record<string, unknown>;
    const stockTab = stockRecord.tabs[0] as Record<string, unknown>;
    expect(Object.keys(ourTab).sort()).toEqual(Object.keys(stockTab).sort());
    expect(ourTab["id"]).toBe(stockTab["id"]);
    expect(ourTab["kind"]).toBe(stockTab["kind"]);
    // 18/10/2026 (task-29): ta PHÁT scheme mới nên pattern có THÊM bản gbh-resource:// song song bản gốc
    //   (dsh-resource://) — chuẩn hoá bằng cách khẳng định bản ta chứa ĐỦ cả hai khuôn của bản gốc.
    const stockPatterns = stockTab["patterns"] as string[];
    const ourPatterns = ourTab["patterns"] as string[];
    expect(ourPatterns.length).toBe(stockPatterns.length * 2);
    for (const pattern of stockPatterns) {
      expect(ourPatterns).toContain(pattern);
      expect(ourPatterns).toContain(pattern.replace("dsh-resource://", "gbh-resource://"));
    }
    expect(ourTab["priority"]).toBe(stockTab["priority"]);
    // (7) Dinh nghia su kien va dich vu neo file.
    expect(ourRecord.events.length).toBe(stockRecord.events.length);
    expect((ourRecord.events[0] as { kind: string }).kind).toBe((stockRecord.events[0] as { kind: string }).kind);
    expect(ourRecord.provided.map((item) => item.name)).toEqual(stockRecord.provided.map((item) => item.name));
    expect(typeof (ourRecord.provided[0]?.value as { forClosing: unknown }).forClosing).toBe("function");
  });

  test("tu dien hai thu tieng NGUYEN VAN tung khoa, dung bang ban goc", async () => {
    const { zh, en } = (await import("../../packages/client/ui-deliverables/src/locales.ts")) as {
      zh: Record<string, string>;
      en: Record<string, string>;
    };
    expect(zh).toEqual(stockDictionary("zh"));
    expect(en).toEqual(stockDictionary("en"));
    expect(Object.keys(en)).toEqual(Object.keys(zh));
    const createPlugin = await freshCreatePlugin("dict");
    const record = emptyRecord();
    createPlugin(fakeRequire).apply(stubContext(record));
    expect(record.locales.length).toBe(1);
    expect(record.locales[0]?.ns).toBe("deliverables");
    expect(record.locales[0]?.dictionaries.zh).toBe(zh);
    expect(record.locales[0]?.dictionaries.en).toBe(en);
  });

  test("CSS nguyen van TUNG BYTE va the style giong ban goc tung the mot", async () => {
    const stock = stockCss();
    const ours = ["PresentRow.module.css", "FileDiff.module.css", "ChangedFiles.module.css", "Deliverables.module.css", "ReviewTab.module.css"].map(ourCss);
    expect(ours.slice().sort()).toEqual(stock.slice().sort());
    // Chen style that (document gia) roi doi chieu tung the theo thu tu.
    const record = emptyRecord();
    const saved = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = fakeDocument(record);
    // Ban chay tu NGUON khong co define cua build.ts; nap dung nam bien do de kiem CHINH duong nhung CSS.
    const defines = (globalThis as unknown as Record<string, string>);
    const cssNames = ["PRESENT_ROW", "FILE_DIFF", "CHANGED_FILES", "DELIVERABLES", "REVIEW_TAB"];
    const bodies = ["PresentRow.module.css", "FileDiff.module.css", "ChangedFiles.module.css", "Deliverables.module.css", "ReviewTab.module.css"].map(ourCss);
    cssNames.forEach((name, index) => {
      defines["__GBH_UI_DELIVERABLES_" + name + "_CSS__"] = bodies[index] as string;
    });
    try {
      const createPlugin = await freshCreatePlugin("css");
      createPlugin(fakeRequire);
      const stockRecord = emptyRecord();
      stockFactory(stockRecord)(fakeRequire);
      expect(record.styles.map((item) => item.tagId)).toEqual(stockRecord.styles.map((item) => item.tagId));
      expect(record.styles.map((item) => item.css)).toEqual(stockRecord.styles.map((item) => item.css));
      // Ta tu khai chu so huu the (ban goc khai ten no); CSS thi y nguyen.
      expect(record.styles.every((item) => item.plugin === PACKAGE_NAME)).toBe(true);
    } finally {
      (globalThis as { document?: unknown }).document = saved;
    }
  });
});

describe("row ui-deliverables — cong chong cai hai lan", () => {
  test("lan cai DAU nem ⇒ co van false ⇒ lan hai dang ky lai DU ba slot", async () => {
    const createPlugin = await freshCreatePlugin("guard");
    const plugin = createPlugin(fakeRequire);
    const failing = emptyRecord();
    expect(() => plugin.apply(stubContext(failing, { failRegister: true }))).toThrow();
    const good = emptyRecord();
    plugin.apply(stubContext(good));
    expect(good.registered.length).toBe(SLOT_NAMES.length);
    expect([...good.injected].sort()).toEqual(SLOT_NAMES);
    // Lan thu ba: da xong nen khong dang ky lai (slot trung ⇒ app trang).
    plugin.apply(stubContext(good));
    expect(good.registered.length).toBe(SLOT_NAMES.length);
    // Dang nguon: co la bien PHAM VI MODULE, dat TRUOC createPlugin, va bat SAU applyInner.
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    const guard = src.indexOf("let uiDeliverablesInstalled = false;");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(src.indexOf("export function createPlugin"));
    expect(src.indexOf("applyInner(ctx);")).toBeLessThan(src.indexOf("uiDeliverablesInstalled = true;"));
    expect(/lastCtx|installedContexts/.test(src)).toBe(false);
  });
});
describe("row ui-deliverables — ham thuan va cay render", () => {
  test("dia chi tab so sanh va cac bo kiem du lieu tron vong", async () => {
    const changes = (await import("../../packages/client/ui-deliverables/src/changes.ts")) as {
      changesReviewAddress: (c: { sessionId: string; seq: number; turn: number }) => string;
      parseChangesReviewAddress: (a: string) => { sessionId: string; seq: number; turn: number } | undefined;
      isChangesSummary: (v: unknown) => boolean;
      isChangesDiff: (v: unknown) => boolean;
    };
    const address = changes.changesReviewAddress({ sessionId: "s 1", seq: 7, turn: 3 });
    expect(address).toBe("gbh-resource://changes-review/session/s%201/7/3");
    expect(changes.parseChangesReviewAddress(address)).toEqual({ sessionId: "s 1", seq: 7, turn: 3 });
    for (const bad of ["gbh-resource://other/session/s1/7/3", "gbh-resource://changes-review/session/s1/7", "gbh-resource://changes-review/session/s1/x/3", "khong-phai-url"]) {
      expect(changes.parseChangesReviewAddress(bad)).toBeUndefined();
    }
    expect(changes.isChangesSummary({ turn: 1, files: [{ path: "a", display: "a", added: 1, deleted: 0 }], total: 1, added: 1, deleted: 0 })).toBe(true);
    expect(changes.isChangesSummary({ turn: 0, files: [], total: 0, added: 0, deleted: 0 })).toBe(false);
    expect(changes.isChangesDiff({ kind: "binary", path: "a", display: "a" })).toBe(true);
    expect(changes.isChangesDiff({ kind: "text", path: "a", display: "a", before: true, after: false, coarse: false, hunks: [{ oldStart: 0, oldLines: 1, newStart: 0, newLines: 1, lines: ["+x"] }] })).toBe(true);
    expect(changes.isChangesDiff({ kind: "text", path: "a", display: "a", before: true, after: false, coarse: false, hunks: [{ oldStart: 0, oldLines: 1, newStart: 0, newLines: 1, lines: ["x"] }] })).toBe(false);
  });

  test("cay render cua the file ban giao va hang tool present dung nhu ban goc", async () => {
    const runtimeModule = (await import("../../packages/client/ui-deliverables/src/runtime.ts")) as {
      setRuntime: (value: unknown) => void;
    };
    // React that goi component ham; jsx gia o day cung vay — nho the cay duoc dung THAT SU, khong chi
    // tra ve { type: PreparingPresentRow }: do la khac biet giua "dang ky duoc" va "render duoc".
    const render = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown =>
      typeof type === "function" ? (type as (value: Record<string, unknown>) => unknown)(props) : { type, props, key };
    const jsxRuntime = { jsx: render, jsxs: render };
    runtimeModule.setRuntime({
      jsx: jsxRuntime.jsx,
      jsxs: jsxRuntime.jsxs,
      Fragment: "Fragment",
      react: fakeRequire("react"),
      store: fakeRequire("@deepseek-ai/dsh-client-store"),
      primitives: fakePrimitives,
    });
    const { PresentedFileCard } = (await import("../../packages/client/ui-deliverables/src/presented-file-card.ts")) as {
      PresentedFileCard: (props: Record<string, unknown>) => { props: Record<string, unknown> };
    };
    const card = PresentedFileCard({
      file: { path: "/w/docs/bao-cao.pdf", description: "Ban bao cao (PDF)" },
      cwd: "/w",
      host: { name: "macOS", available: true, fileManager: "finder" },
      onPreview: () => undefined,
      actions: "ACTIONS",
      t: (key: string) => key,
    });
    expect(card.props["data-presented-file"]).toBe(true);
    expect(card.props["className"]).toBe("nyYjTG_file");
    const body = (card.props["children"] as unknown[])[2] as { props: Record<string, unknown> };
    expect(body.props["className"]).toBe("nyYjTG_fileBody");
    const details = (body.props["children"] as unknown[])[0] as { props: Record<string, unknown> };
    const name = (details.props["children"] as unknown[])[0] as { props: Record<string, unknown> };
    expect(name.props["children"]).toBe("bao-cao.pdf");
    const description = (details.props["children"] as unknown[])[1] as { props: Record<string, unknown> };
    expect(description.props["className"]).toBe("nyYjTG_description");
    const secondary = (description.props["children"] as unknown[])[0] as { props: Record<string, unknown> };
    expect(secondary.props["children"]).toBe("Ban bao cao");

    const { PresentRow } = (await import("../../packages/client/ui-deliverables/src/present-row.ts")) as {
      PresentRow: (props: Record<string, unknown>) => { props: Record<string, unknown> };
    };
    const preparing = PresentRow({ phase: "preparing", t: (key: string) => key });
    expect(preparing.props["data-tool"]).toBe("present");
    expect(preparing.props["data-state"]).toBe("preparing");
    const settled = PresentRow({
      phase: "settled",
      block: { kind: "text", content: [{ type: "text", text: "da ban giao" }], isError: false, call: { argsRaw: '{"files":[{"path":"a.txt"}]}' } },
      inspect: () => undefined,
      t: (key: string) => key,
    });
    expect(settled.props["data-state"]).toBe("ok");
  });

  test("bo chon cho cau tra loi cuoi: chi nhan khi luot co san pham hoac file ban giao", async () => {
    const turn = (data: Map<string, unknown>, seq: number): Record<string, unknown> => ({ turn: { data }, seq });
    const selector = (await import("../../packages/client/ui-deliverables/src/turn-deliverables.ts")) as {
      selectProducedFiles: (owner: Record<string, unknown>) => string[] | null;
      presentedForClosing: (owner: Record<string, unknown>) => { path: string }[];
    };
    const { selectDeliverables } = (await import("../../packages/client/ui-deliverables/src/deliverables.ts")) as {
      selectDeliverables: (owner: Record<string, unknown>) => unknown;
    };
    const empty = turn(new Map(), 3);
    expect(selectDeliverables(empty)).toBeNull();
    expect(selector.selectProducedFiles(empty)).toBeNull();
    const produced = turn(new Map([["deliverables", { produced: [{ seq: 1, path: "a/x.ts" }, { seq: 2, path: "a/y.ts" }, { seq: 9, path: "a/z.ts" }] }]]), 3);
    expect(selector.selectProducedFiles(produced)).toEqual(["a/x.ts", "a/y.ts"]);
    // selectDeliverables chi nhan khi luot co bang tom tat thay doi hoac co file ban giao.
    expect(selectDeliverables(produced)).toBeNull();
    const changed = turn(new Map([["deliverables", { produced: [], presented: [], changes: { seq: 4, turn: 2 } }]]), 5);
    expect(selectDeliverables(changed)).not.toBeNull();
    const presented = turn(new Map([["deliverables", { produced: [], presented: [{ path: "a", seq: 1 }, { path: "a", seq: 2 }, { path: "b", seq: 9 }] }]]), 5);
    expect(selector.presentedForClosing(presented).map((file) => file.path)).toEqual(["a"]);
  });
});