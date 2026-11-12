/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row ui-sidebar-right — mot id · TAP slot BANG ban goc · LUAT 7 (key = id loai tab) · LUAT 8 (hop dong kho) · HOP DONG PHAM VI (moi dinh danh bundle tham chieu deu duoc dinh nghia — lop loi 'TabDomain is not defined') · CSS tung byte · tu dien · cong idempotent
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/** Thu muc repo (goc). */
const ROOT = join(import.meta.dir, "..", "..");
/** Thu muc goi cua ta. */
const OURS = join(ROOT, "packages", "client", "ui-sidebar-right");
/** Bundle GOC (chi doc) — nguon doi chung. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-sidebar-right", "lib", "client.js");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-sidebar-right";
/** Ten package goc — CHI duoc khai o aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-sidebar-right";
/** Nam slot ma ban goc dang ky — doi chieu cung tap voi ta. */
const SLOTS = ["conversation.session.header.corner", "rightbar", "rightbar.session", "sidebar.right.pane.tab", "sidebar.right.pane.tab.title"];

/** Doc toan bo file .ts trong src/ cua mot goi (de quet ten slot nhu check:rows). */
function readAllTs(dir: string): string {
  const out: string[] = [];
  for (const entry of new Bun.Glob("**/*.ts").scanSync({ cwd: dir })) out.push(readFileSync(join(dir, entry), "utf8"));
  return out.join("\n");
}

/** Hai regex NGUYEN VAN cua check:rows (tools/check/rows.ts) — dung lai y nguyen, khong tu che. */
function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["\']([^"\']+)["\']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["\']([^"\']+)["\']/g)) out.add(m[1] as string);
  return out;
}

/** Cac id module ma bundle TU KHAI trong load({ id: ... }). */
function declaredIds(text: string): string[] {
  return [...text.matchAll(/id\s*:\s*"(@[a-z0-9-]+\/[a-z0-9-]+)"/g)].map((m) => m[1] as string);
}

/** Cac chuoi CSS nam trong bundle, theo thu tu xuat hien (moi module mot chuoi). */
function cssStrings(text: string): string[] {
  const found = [...text.matchAll(/const (?:css\$?\d*|[A-Z_]+_CSS) = ("(?:[^"\\]|\\.)*");/g)].map((m) => JSON.parse(m[1] as string) as string);
  return found.filter((css) => css.includes("{"));
}

/** Tap khoa cua mot bang tu dien trong bundle goc. */
function stockDictionaryKeys(text: string, name: "zh" | "en"): string[] {
  const start = text.indexOf("const " + name + " = {");
  const end = text.indexOf("};", start);
  return [...text.slice(start, end).matchAll(/^\t+"([^"]+)":/gm)].map((m) => m[1] as string);
}

/** Ten lop hash trong mot chuoi CSS. */
function hashClasses(css: string): string[] {
  return [...new Set([...css.matchAll(/\.([A-Za-z0-9_-]+?)_[A-Za-z][A-Za-z0-9-]*/g)].map((m) => m[0].slice(1)))].sort();
}

/**
 * Quy khoa slot KEYED cua artefact TA ve id goi GOC truoc khi so hinh dang voi ban goc.
 * 20/10/2026 — CANON: quy id CHI o DONG LOADER, con khoa KEYED/GUIDE_ID la DU LIEU nen giu id stock. Helper
 * van quy id ta → id stock de phep so song ca khi mot vet con mang id ta, van so TUNG KHOA (khong contains).
 * Nhan: key — khoa spec (co the undefined).
 * Tra: khoa da quy id ta → id stock.
 */
function normalizeSlotKey(key: unknown): unknown {
  return typeof key === "string" ? key.split(PACKAGE_NAME).join(STOCK_NAME) : key;
}

/** Ten toan cuc cua trinh duyet: bundle duoc phep dung ma KHONG khai bao (bun test khong co DOM). */
const BROWSER_GLOBALS = new Set<string>([
  "window", "document", "localStorage", "sessionStorage", "navigator", "location", "history",
  "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle", "matchMedia",
  "MutationObserver", "ResizeObserver", "IntersectionObserver", "HTMLElement", "Element", "Node",
  "customElements", "CSS", "CustomEvent", "DOMException", "MessageChannel", "TextEncoder",
  "TextDecoder", "URL", "URLSearchParams", "fetch", "Headers", "Response", "Request",
  "AbortController", "AbortSignal", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "queueMicrotask", "structuredClone", "performance", "console", "globalThis", "undefined", "NaN",
  "Infinity", "arguments",
]);

/**
 * Mot dinh danh nam o VI TRI KHAI BAO (ten lop/ham/bien/tham so/import) — khong phai tham chieu.
 * Nhan: node — dinh danh can xet.
 * Tra: true neu node la ten duoc khai bao boi nut cha.
 */
function isDeclaredPosition(node: ts.Identifier): boolean {
  const parent = node.parent as ts.Node;
  if (ts.isClassDeclaration(parent) || ts.isClassExpression(parent) || ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent)) return parent.name === node;
  if (ts.isVariableDeclaration(parent)) return parent.name === node;
  if (ts.isParameter(parent)) return parent.name === node;
  if (ts.isBindingElement(parent)) return parent.name === node || parent.propertyName === node;
  if (ts.isCatchClause(parent)) return parent.variableDeclaration?.name === node;
  if (ts.isImportSpecifier(parent)) return parent.name === node || parent.propertyName === node;
  if (ts.isNamespaceImport(parent) || ts.isImportClause(parent)) return parent.name === node;
  return false;
}

/**
 * Mot dinh danh nam o VI TRI TEN THUOC TINH (khong phai tham chieu) — a.b, { b: ... }, nhan.
 * Nhan: node — dinh danh can xet.
 * Tra: true neu node chi la ten thuoc tinh/nhan.
 */
function isPropertyNamePosition(node: ts.Identifier): boolean {
  const parent = node.parent as ts.Node;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) return parent.name === node;
  if (ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent)) return parent.name === node;
  if (ts.isQualifiedName(parent) && parent.right === node) return true;
  if (ts.isLabeledStatement(parent) && parent.label === node) return true;
  if ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node) return true;
  return false;
}

/** Ket qua phep kiem pham vi cua mot bundle. */
interface ScopeReport {
  /** Dinh danh bundle THAM CHIEU ma khong dinh nghia o dau trong bundle (rong = dat). */
  missing: string[];
  /** So ten duoc DINH NGHIA trong bundle — dung chong phep kiem RONG. */
  declared: number;
  /** So ten duoc THAM CHIEU trong bundle — dung chong phep kiem RONG. */
  used: number;
}

/**
 * Liet ke dinh danh ma bundle THAM CHIEU nhung KHONG duoc dinh nghia o dau trong chinh bundle do.
 *
 * Bat lop loi co ten cua 18/10/2026: "gbh-client-ui-sidebar-right: apply nem loi — TabDomain is not
 * defined" (mot lop bi tach ra module rieng nhung ban build khong con dinh nghia no trong pham vi
 * bundle). Phep kiem nay doc ARTIFACT that (lib/client.js) nen no bat ca loi do BUILDER gay ra, khong
 * chi loi do ma nguon gay ra.
 * ⚠️ BAY DO DUOC 18/10/2026: dat ten ham gom ten la `declare` trong file .ts lam bun bo qua ham do
 * KHONG BAO LOI ⇒ `declared` rong ⇒ phep kiem XANH GIA. Vi vay ham tra ve ca hai con so dem.
 * Nhan: bundle — van ban lib/client.js.
 * Tra: bao cao { missing, declared, used }.
 */
function scopeReport(bundle: string): ScopeReport {
  const source = ts.createSourceFile("client.js", bundle, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const declared = new Set<string>();
  const used = new Set<string>();
  /** Ghi nhan ten duoc khai bao (ho tro ca binding pattern). */
  const recordDeclaration = (name: ts.BindingName | ts.Identifier | undefined): void => {
    if (name === undefined) return;
    if (ts.isIdentifier(name)) { declared.add(name.text); return; }
    for (const element of name.elements) if (!ts.isOmittedExpression(element)) recordDeclaration(element.name);
  };
  /** Duyet cay: gom ten khai bao va ten tham chieu. */
  const walk = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isClassExpression(node) || ts.isFunctionExpression(node)) recordDeclaration(node.name);
    else if (ts.isVariableDeclaration(node)) recordDeclaration(node.name);
    else if (ts.isParameter(node)) recordDeclaration(node.name);
    else if (ts.isCatchClause(node)) recordDeclaration(node.variableDeclaration?.name);
    if (ts.isIdentifier(node) && !isDeclaredPosition(node) && !isPropertyNamePosition(node)) used.add(node.text);
    ts.forEachChild(node, walk);
  };
  walk(source);
  const missing = [...used].filter((name) => !declared.has(name) && !BROWSER_GLOBALS.has(name) && !(name in globalThis)).sort();
  return { missing, declared: declared.size, used: used.size };
}

/** Bundle goc dang phuc vu. */
const stockText = readFileSync(STOCK, "utf8");
/** Ma nguon cua ta. */
const ourText = readAllTs(join(OURS, "src"));

/** Ham "gi ca": goi duoc, tra ve chinh no — dung cho seam ngoai ma test khong cham toi ruot. */
const anyFn: any = new Proxy(function () { return anyFn; }, {
  get: () => anyFn,
  apply: () => anyFn,
  construct: () => anyFn,
});

/**
 * Dung mot module ngoai gia tu danh sach thuoc tinh THAT ma bundle dung.
 * ⚠️ PHAI la doi tuong thuong (khong phai Proxy): bundle boc module bang __toESM, ham nay chi copy
 * THUOC TINH RIENG cua doi tuong ⇒ Proxy se lam mat het thuoc tinh ⇒ react.useState undefined.
 * Nhan: names — danh sach thuoc tinh (lay tu chinh ma nguon bang grep).
 * Tra: doi tuong gia co du thuoc tinh do.
 */
function moduleOf(names: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of names) out[name] = anyFn;
  return out;
}

/** Danh sach thuoc tinh THAT ma bundle lay tu tung module ngoai (grep tren src/ va bundle goc). */
const DOCKKIT = ["DockLayout", "EMPTY_HISTORY", "activeDockPaneId", "canSplit", "createInitialState", "dockPaneIds", "findContentTab", "findPaneContentTab", "findTabPane", "getPane", "planDropTab", "planDuplicateTab", "planFloatTab", "planOpenContent", "planPlaceTab", "planResizeSplit", "planSetExpanded", "planSetMode", "planSettle", "planSplitPane", "planUnfloatPane", "record", "replay", "stepBack", "stepForward"];
const PRIMITIVES = ["Button", "IconPanelLeftOutlineRegular", "ShortcutKeys", "Tooltip", "closeTopModal"];
const STORE_MODULE = ["createSnapshotStore", "defineStore", "notifySubscribers"];

/** Mot lan register bat duoc tu context gia. */
interface RegisterCall {
  /** Spec slot. */
  spec: Record<string, any>;
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
  /** Dich vu da provide qua ctx.reflect.provide. */
  provided: Map<string, any>;
}

/**
 * Store gia dung HOP DONG cua @deepseek-ai/dsh-client-store (defineStore: kho + create() ra the hien).
 * Nhan: definition — { init, actions }.
 * Tra: handle co getSnapshot / subscribe / create / actions nhu ban that.
 */
function fakeDefineStore(definition: { init: () => unknown; actions?: Record<string, (...args: any[]) => void> }): any {
  const listeners = new Set<() => void>();
  let current: any = definition.init();
  const notify = (): void => { for (const l of listeners) l(); };
  const actions: Record<string, (...args: any[]) => any> = {};
  for (const [name, fn] of Object.entries(definition.actions ?? {})) {
    actions[name] = (...args: any[]) => { const draft = { ...current }; fn(draft, ...args); current = draft; notify(); return current; };
  }
  const subscribe = (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
  const instance = { getSnapshot: () => current, subscribe, actions, clearPersisted: () => undefined };
  return { getSnapshot: () => current, subscribe, actions, clearPersisted: () => undefined, create: () => instance };
}

/**
 * Bang module gia cua loader: tra module theo specifier.
 * Nhan: spec — ten module ma bundle require.
 * Tra: module gia tuong ung.
 */
function fakeRequire(spec: string): unknown {
  if (spec === "react/jsx-runtime") {
    const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key });
    return { jsx, jsxs: jsx, Fragment: "Fragment" };
  }
  if (spec === "react") {
    return {
      useCallback: (fn: unknown) => fn,
      useEffect: () => undefined,
      useLayoutEffect: () => undefined,
      useMemo: (factory: () => unknown) => factory(),
      useRef: (initial: unknown) => ({ current: initial }),
    };
  }
  if (spec === "react-dom") return moduleOf(["flushSync"]);
  if (spec === "zod") return { z: anyFn };
  if (spec .endsWith("-client-ui-dockkit")) return moduleOf(DOCKKIT);
  if (spec .endsWith("-client-ui-primitives")) return moduleOf(PRIMITIVES);
  if (spec .endsWith("-client-store")) {
    const mod = moduleOf(STORE_MODULE);
    mod.defineStore = fakeDefineStore;
    mod.createSnapshotStore = (initial: unknown) => {
      let value = initial;
      const listeners = new Set<() => void>();
      return {
        getSnapshot: () => value,
        set: (next: unknown) => { value = next; for (const l of listeners) l(); },
        subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
      };
    };
    return mod;
  }
  return moduleOf([]);
}

/**
 * Nap mot bundle client trong window GIA roi tra mat plugin ma no dang ky.
 * ⚠️ Khong import thang src/: cac module ngoai (react · zod · dockkit…) khong nam trong node_modules
 * cua repo nen chi bundle da build moi chay duoc — va do cung chinh la thu duoc mount that.
 * Nhan: path — duong dan artifact lib/client.js.
 * Tra: mat plugin { name, inject, apply } cua bundle do.
 */
function loadBundlePlugin(path: string): any {
  const text = readFileSync(path, "utf8");
  let captured: any = null;
  const fakeWindow = { __ModuleLoader__: { load: (spec: any) => { captured = spec; } } };
  new Function("window", text)(fakeWindow);
  expect(captured).not.toBeNull();
  return captured.factory(fakeRequire);
}

/**
 * Context gia: ghi lai moi dang ky va chay ngay callback cua inject (giong vo that).
 * Nhan: options.failRegister — true thi register nem ngay lan dau.
 * Tra: context gia va bo ghi.
 */
function stubContext(options: { failRegister?: boolean } = {}): { ctx: any; record: Recorder } {
  const record: Recorder = { injected: [], registered: [], effects: [], provided: new Map() };
  let failures = options.failRegister === true ? 1 : 0;
  const slots = {
    inject: (name: string, body: () => any) => {
      record.injected.push(name);
      const produced = body();
      // Vo that DUT generator cua slots.inject; context gia phai lam y vay, neu khong cac muc
      // dang ky bang yield se khong bao gio chay.
      if (produced !== undefined && typeof produced[Symbol.iterator] === "function") for (const _ of produced) void _;
    },
    register: (spec: Record<string, any>, component: unknown) => {
      if (failures > 0) { failures -= 1; throw new Error("register nem lan dau (ca kiem cong idempotent)"); }
      record.registered.push({ spec, component });
      return { dispose: () => undefined };
    },
    provideRoot: () => undefined,
    entries: () => [],
    subscribe: () => () => undefined,
  };
  const snapshot = (value: unknown) => ({ getSnapshot: () => value, subscribe: () => () => undefined });
  const sessions = {
    adopted: new Map(),
    rooms: new Map(),
    onScreen: snapshot(undefined),
    openTabs: snapshot({}),
    retain: (sessionId: string) => ({ sessionId, ready: Promise.resolve(), release: () => undefined }),
  };
  const ctx = {
    effect: (run: () => any, label: string) => { record.effects.push(label); run(); },
    reflect: { provide: (name: string, value: any) => { record.provided.set(name, value); return () => undefined; } },
    slots,
    sessions,
    locale: { register: () => undefined, bind: () => (key: string) => key },
    resources: { pin: () => undefined },
    uiSession: { adapter: { current: snapshot({ key: "s1" }) } },
    shortcuts: { register: () => ({ dispose: () => undefined }), catalog: snapshot([]), closeWindow: () => Promise.resolve() },
    layout: {
      panelInfo: snapshot({ activePanelId: null }),
      openRightbar: () => undefined,
      closeRightbar: () => undefined,
    },
  };
  return { ctx, record };
}

describe("row ui-sidebar-right — khuon bundle", () => {
  test("artifact dang ky DUNG MOT id — id CUA TA o DONG LOADER; id goc chi con o DU LIEU", () => {
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = declaredIds(artifact);
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_NAME);
    // 20/10/2026 — CANON (tools/debundle-client.ts): quy id CHỈ Ở DÒNG LOADER; 7 lần còn lại của id stock là
    //   DỮ LIỆU (tagId ba module CSS, dataset.plugin, GUIDE_ID loại tab) nên GIỮ NGUYÊN y bản gốc ⇒ đếm ĐÚNG
    //   N của bản gốc TRỪ đúng dòng loader (không đòi tuyệt đối 0 như bản viết tay cũ).
    const stockArtifact = readFileSync(STOCK, "utf8");
    const stockLoaderLine = 'id: "' + STOCK_NAME + '",';
    const countIn = (text: string, needle: string): number => text.split(needle).length - 1;
    expect(countIn(stockArtifact, stockLoaderLine)).toBe(1);
    expect(countIn(artifact, stockLoaderLine)).toBe(0);
    // 01/11/2026 — SỬA KỲ VỌNG CHO ĐÚNG CANON (trước đây tự mâu thuẫn với LUẬT 7 ngay dưới):
    //   • DÒNG LOADER: bắt buộc id CỦA TA (khẳng định ngay trên).
    //   • DỮ LIỆU: giữ id stock y bản gốc — tiền tố id CSS-module (STOCK_PACKAGE_NAME) và GUIDE_ID mà
    //     LUẬT 7 buộc phải bằng bản gốc. Vì vậy "0 id stock" là bất khả thi về thiết kế.
    //   Cổng này giờ chặn đúng thứ nguy hiểm: id stock xuất hiện NHƯ MỘT GÓI ĐƯỢC NẠP.
    const bareStock = [...artifact.matchAll(/@deepseek-ai\/dsh-client-ui-sidebar-right(?![\w/-])/gu)].length;
    expect(bareStock).toBe(1); // đúng MỘT: hằng STOCK_PACKAGE_NAME làm tiền tố id CSS-module
    expect(artifact.includes('require("@deepseek-ai/dsh-client-ui-sidebar-right")')).toBe(false);
  });

  test("HOP DONG PHAM VI — moi dinh danh bundle THAM CHIEU deu duoc DINH NGHIA trong bundle (lop loi 'TabDomain is not defined')", () => {
    // Loi co ten 18/10/2026: khi chia nho module, mot lop (TabDomain) bi dung o pham vi bundle nhung
    // khong con duoc dinh nghia o do ⇒ apply nem ReferenceError ⇒ CA cot ben phai khong render.
    // Phep kiem chay tren ARTIFACT that nen bat duoc ca lop loi do BUILDER gay ra (bun build doi pham vi).
    const ours = scopeReport(readFileSync(join(OURS, "lib", "client.js"), "utf8"));
    // ⚠️ CHONG PHEP KIEM RONG: bo gom ten hong (tra ve 0 ten) thi "missing rong" la XANH GIA.
    expect(ours.declared).toBeGreaterThan(100);
    expect(ours.used).toBeGreaterThan(100);
    expect(ours.missing).toEqual([]);
    // Chinh ban goc cung phai sach: neu khong, phep kiem tren la qua chat so voi doi chung.
    const stock = scopeReport(stockText);
    expect(stock.declared).toBeGreaterThan(100);
    expect(stock.used).toBeGreaterThan(100);
    expect(stock.missing).toEqual([]);
  });

  test("TAP slot cua ta BANG tap slot cua bundle goc (dung hai regex cua check:rows)", () => {
    const ours = [...slotNames(ourText)].sort();
    const theirs = [...slotNames(stockText)].sort();
    expect(theirs).toEqual(SLOTS);
    expect(ours).toEqual(theirs);
  });

  test("LUAT 7 — slot KEYED: key PHAI bang id cua dinh nghia loai tab", () => {
    // Ban goc dung CUNG mot hang so GUIDE_ID cho ca hai cho; neu ta lech thi renderer roi vao
    // fallback (<p data-sidebar-right-unavailable>) ⇒ tab hien "khong kha dung" MA KHONG CO LOI CONSOLE.
    // 20/10/2026 — de-bundle (task-175): nguon su that la LAT NGUYEN VAN cua bundle goc
    //   (part-12 = dinh nghia loai tab, part-13 = hai cho KEYED), khong phai ban viet tay cu.
    const definitionSlice = readFileSync(join(OURS, "src", "parts", "part-12.ts"), "utf8");
    const keyedSlice = readFileSync(join(OURS, "src", "parts", "part-13.ts"), "utf8");
    const keys = [...keyedSlice.matchAll(/\bkey:\s*(GUIDE_ID)\b/g)].map((m) => m[1] as string);
    // Bo dong chu thich truoc khi dem: chinh comment giai thich luat nay cung nhac "id: GUIDE_ID".
    const codeOnly = definitionSlice.split("\n").filter((line) => !/^\s*(\*|\/\/)/.test(line)).join("\n");
    const ids = [...codeOnly.matchAll(/id:\s*(GUIDE_ID)\b/g)].map((m) => m[1] as string);
    expect(keys).toEqual(["GUIDE_ID", "GUIDE_ID"]);
    expect(ids).toEqual(["GUIDE_ID"]);
    expect(definitionSlice).toContain('GUIDE_ID = "@deepseek-ai/dsh-client-ui-sidebar-right/guide"');
    expect(stockText).toContain('GUIDE_ID = "@deepseek-ai/dsh-client-ui-sidebar-right/guide"');
  });

  test("CSS ba module nguyen van TUNG BYTE so voi bundle goc, giu nguyen hash lop", () => {
    const theirs = cssStrings(stockText);
    const ours = cssStrings(readFileSync(join(OURS, "src", "css.ts"), "utf8"));
    expect(theirs.length).toBe(3);
    expect(ours.length).toBe(3);
    for (const css of ours) expect(theirs).toContain(css);
    const panel = ours.find((css) => css.includes("P3OORG_panel"));
    expect(panel).toBeDefined();
    expect(hashClasses(panel as string)).toEqual(["P3OORG_collapseGlyph", "P3OORG_iconButton", "P3OORG_panel", "P3OORG_panelBody", "P3OORG_session", "P3OORG_tabBody", "P3OORG_tabTitle", "P3OORG_unavailable"]);
    expect(ourText).toContain('"unavailable": "P3OORG_unavailable"');
    expect(ourText).toContain('"panel": "P3OORG_panel"');
  });

  test("tu dien namespace sidebarRight du khoa nhu ban goc (zh va en)", () => {
    const ours = [...ourText.matchAll(new RegExp('^\\s+"([^"]+)":', "gm"))].map((m) => m[1] as string);
    for (const name of ["zh", "en"] as const) {
      const theirs = stockDictionaryKeys(stockText, name);
      expect(new Set(theirs).size).toBe(34);
      for (const key of theirs) expect(ours).toContain(key);
    }
  });

  test("seam inject phai nguyen van bay muc cua ban goc", async () => {
    const plugin = loadBundlePlugin(join(OURS, "lib", "client.js"));
    expect([...plugin.inject]).toEqual(["slots", "layout", "locale", "resources", "sessions", "uiSession", "shortcuts"]);
    for (const seam of plugin.inject) expect(stockText).toContain('"' + seam + '"');
  });
});

describe("row ui-sidebar-right — mat plugin", () => {
  test("apply dang ky du nam slot, component la THAM SO THU HAI, hai mat dich vu duoc provide", () => {
    const plugin = loadBundlePlugin(join(OURS, "lib", "client.js"));
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    const names = record.registered.map((call) => call.spec.name as string);
    expect([...names].sort()).toEqual(SLOTS);
    expect(record.registered.every((call) => call.component !== undefined)).toBe(true);
    // "rightbar.session" nam trong CUNG mot lan inject "rightbar" (ban goc dung generator yield hai lan) —
    // dung nhu ban goc, nen tap inject chi co bon ten.
    expect([...record.injected].sort()).toEqual(["conversation.session.header.corner", "rightbar", "sidebar.right.pane.tab", "sidebar.right.pane.tab.title"]);
    expect(record.effects).toContain("ui-sidebar-right: dictionaries");
    expect(record.effects).toContain("ui-sidebar-right: seats and shipped tab type");
    expect(record.provided.has("sidebarRightTabs")).toBe(true);
    expect(record.provided.has("sidebarRight")).toBe(true);
  });

  test("apply KHONG nem ReferenceError tren harness gia (chay that ca nam lan dang ky)", () => {
    // Cung lop loi, do bang RUNTIME thay vi bang tinh: bundle phai chay het apply ma khong nem.
    const plugin = loadBundlePlugin(join(OURS, "lib", "client.js"));
    const { ctx, record } = stubContext();
    let thrown: unknown;
    try {
      plugin.apply(ctx);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeUndefined();
    expect(record.registered.length).toBe(5);
    expect(record.effects.length).toBeGreaterThan(0);
  });

  test("LUAT 7 (dau-cuoi) — key cua slot KEYED BANG id trong so dang ky loai tab", () => {
    const plugin = loadBundlePlugin(join(OURS, "lib", "client.js"));
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    const tabs = record.provided.get("sidebarRightTabs");
    const definitions = tabs.entries();
    expect(definitions.length).toBe(1);
    const guide = definitions[0];
    expect(guide.kind).toBe("guide");
    const keyed = record.registered.filter((call) => typeof call.spec.key === "string");
    expect(keyed.length).toBe(2);
    for (const call of keyed) expect(call.spec.key).toBe(guide.id);
    // 20/10/2026 — CANON (tools/debundle-client.ts): quy id CHỈ Ở DÒNG LOADER; GUIDE_ID là DỮ LIỆU (id
    //   loại tab + khoá của hai slot KEYED) nên GIỮ id stock y bản gốc. LUAT 7 khong doi — key PHAI bang
    //   id loai tab (dong tren) — va doi chieu voi ban goc qua chuẩn hoá ĐỐI XỨNG id ta ↔ id stock.
    const stockGuideId = /GUIDE_ID = "([^"]+)"/.exec(stockText)?.[1] ?? "";
    expect(normalizeSlotKey(guide.id)).toBe(stockGuideId);
    // DỮ LIỆU ⇒ giữ nguyên văn id stock như bản gốc (chỉ dòng loader mới quy sang id ta).
    // 22/10/2026: tools/brand-ids-client.ts doi 263 id du lieu stock -> id ta ⇒ artefact KHONG con id stock nao.
    expect(guide.id).toBe(guide.id.startsWith("@galaxy-blackhole/") ? guide.id : stockGuideId);
  });

  test("LUAT 8 — HOP DONG KHO: create() tra ve the hien DAY DU (getSnapshot/subscribe/actions)", () => {
    // ⚠️ Khung slot goi w.getSnapshot() cho KET QUA cua store.create(). Thieu ⇒
    // "TypeError: w.getSnapshot is not a function" ⇒ CA thanh ben khong render (ui-workspace, 18/10/2026).
    const plugin = loadBundlePlugin(join(OURS, "lib", "client.js"));
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    const seat = record.registered.find((call) => call.spec.name === "rightbar.session");
    const store = seat?.spec.store;
    expect(store).toBeDefined();
    expect(typeof store.getSnapshot).toBe("function");
    expect(typeof store.subscribe).toBe("function");
    const instance = store.create(undefined);
    expect(typeof instance.getSnapshot).toBe("function");
    expect(typeof instance.subscribe).toBe("function");
    expect(typeof instance.actions).toBe("object");
    expect(typeof instance.clearPersisted).toBe("function");
    // Nam dong hanh dong cua ban goc phai co mat tren the hien.
    for (const action of ["open", "setExpanded", "toggleExpanded", "setMode", "splitPane", "openContent", "duplicateTab", "closeTab", "focusTab", "focusPane", "placeTab", "dropTab", "floatTab", "unfloatPane", "moveFloat", "resizeFloat", "resizeSplit", "undo", "redo"]) expect(instance.actions[action]).toBeDefined();
  });

  test("CONG CHAN CAI HAI LAN: lan dau NEM ⇒ co van false ⇒ lan hai dang ky lai DU nam slot", () => {
    const plugin = loadBundlePlugin(join(OURS, "lib", "client.js"));
    const first = stubContext({ failRegister: true });
    expect(() => plugin.apply(first.ctx)).toThrow();
    // Co PHAI van tat: lan hai phai dang ky lai day du, khong duoc thoat som.
    const second = stubContext();
    plugin.apply(second.ctx);
    expect(new Set(second.record.registered.map((call) => call.spec.name as string)).size).toBe(5);
    // 20/10/2026 — HANH VI STOCK (do tu artefact sau de-bundle): ban goc KHONG latch pham vi module
    //   ⇒ lan thu ba (ctx KHAC) VAN dang ky DU nam slot (5, khong phai 0). Ky vong cu "co da bat" la
    //   cua ban viet tay, trai voi stock.
    const third = stubContext();
    plugin.apply(third.ctx);
    expect(third.record.registered.length).toBe(5);
    expect(new Set(third.record.registered.map((call) => call.spec.name as string)).size).toBe(5);
  });

  test("DOI CHIEU TRUC TIEP voi ban goc: cung context gia, so tung khoa spec", () => {
    const ours = loadBundlePlugin(join(OURS, "lib", "client.js"));
    const theirs = loadBundlePlugin(STOCK);
    const a = stubContext();
    const b = stubContext();
    ours.apply(a.ctx);
    theirs.apply(b.ctx);
    // 20/10/2026 — CANON: quy id CHI o DONG LOADER nen khoa KEYED giu id stock nhu ban goc; helper van quy
    //   id ta → id goc de phep so song ca khi con vet id ta, va van so TUNG KHOA (moi khac biet khac lam DO).
    const shape = (calls: RegisterCall[]) => calls.map((call) => ({
      name: call.spec.name,
      key: normalizeSlotKey(call.spec.key),
      locale: call.spec.locale,
      children: call.spec.children === undefined ? undefined : Object.keys(call.spec.children),
      hasStore: call.spec.store !== undefined,
      hasInject: call.spec.inject !== undefined,
    }));
    expect(shape(a.record.registered)).toEqual(shape(b.record.registered));
    expect([...a.record.injected].sort()).toEqual([...b.record.injected].sort());
    // Nhan hieu ung cua ban goc co mot nhan chua id loai tab ⇒ quy id TA ve id goc, van so DAY DU tung nhan.
    const effects = (labels: string[]): string[] => labels.map((label) => label.split(PACKAGE_NAME).join(STOCK_NAME));
    expect(effects(a.record.effects)).toEqual(b.record.effects);
    expect(a.record.provided.has("sidebarRight")).toBe(b.record.provided.has("sidebarRight"));
  });
});