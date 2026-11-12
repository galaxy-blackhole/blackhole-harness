/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test row ui-workspace — luat mot-id · TAP slot BANG tap slot bundle goc · CSS nguyen van tung byte (Qg_5Eq_exits) · tu dien · cong idempotent pham vi module
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Thu muc repo (goc). */
const ROOT = join(import.meta.dir, "..", "..");
/** Thu muc goi cua ta. */
const OURS = join(ROOT, "packages", "client", "ui-workspace");
/** Bundle GOC (chi doc) — nguon doi chung. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-workspace", "lib", "client.js");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-workspace";
/** Ten package goc — CHI duoc khai o aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-workspace";

/** Doc toan bo file .ts trong src/ cua mot goi (de quet ten slot nhu check:rows). */
function readAllTs(dir: string): string {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of new Bun.Glob("**/*.ts").scanSync({ cwd: current })) out.push(readFileSync(join(current, entry), "utf8"));
  };
  walk(dir);
  return out.join("\n");
}

/** Hai regex NGUYEN VAN cua check:rows (tools/check/rows.ts) — dung lai y nguyen, khong tu che. */
function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g)) out.add(m[1] as string);
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

/** Bundle goc dang phuc vu. */
const stockText = readFileSync(STOCK, "utf8");
/** Ma nguon cua ta. */
const ourText = readAllTs(join(OURS, "src"));

/** Runtime gia: jsx/jsxs tra ve node, react co hook, primitives la ten, cordis co Service. */
function fakeRequire(spec: string): unknown {
  if (spec === "react/jsx-runtime") {
    const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key });
    return { jsx, jsxs: jsx, Fragment: "Fragment" };
  }
  if (spec === "react") {
    /** Lop Component gia co du method vong doi ma AnimatedRows dung. */
    class Component {
      /** Props cua component. */
      props: Record<string, unknown> = {};
    }
    return {
      Component,
      createRef: () => ({ current: null }),
      createElement: (type: unknown) => type,
      useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, () => undefined],
      useRef: (initial: unknown) => ({ current: initial }),
      useEffect: () => undefined,
      useMemo: (factory: () => unknown) => factory(),
      useCallback: (fn: unknown) => fn,
    };
  }
  if (spec === "@deepseek-ai/cordis") {
    /** Lop Service gia cua cordis. */
    class Service {
      /** Context goc. */
      ctx: unknown;
      /** Ten service. */
      name: string;
      /**
       * Dung service gia.
       * Nhan: ctx — context goc; name — ten service.
       * Tra: doi tuong service.
       */
      constructor(ctx: unknown, name: string) {
        this.ctx = ctx;
        this.name = name;
      }
    }
    return { Service };
  }
  if (spec .endsWith("-client-store")) {
    return {
      createSnapshotStore: (initial: unknown) => {
        let value = initial;
        return {
          getSnapshot: () => value,
          set: (next: unknown) => {
            value = next;
          },
          subscribe: () => () => undefined,
        };
      },
    };
  }
  return new Proxy({}, { get: (_target, prop) => String(prop) });
}

/** Mot lan register bat duoc tu context gia. */
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
  /** So lan host duoc yeu cau tao workspace mac dinh. */
  initializedDefault: number;
  /** Cac yeu cau tao phien da gui cho host. */
  createdSessions: unknown[];
}

/**
 * Context gia: ghi lai moi dang ky va chay ngay callback cua inject (giong vo that).
 * Nhan: options.failRegister — true thi register nem ngay lan dau.
 * Tra: context gia va bo ghi.
 */
function stubContext(options: { failRegister?: boolean; initializeDefault?: boolean } = {}): { ctx: unknown; record: Recorder } {
  const record: Recorder = { injected: [], registered: [], effects: [], initializedDefault: 0, createdSessions: [] };
  let failures = options.failRegister === true ? 1 : 0;
  // Danh sach workspace cua host: RONG luc boot may sach, day len sau khi tao workspace mac dinh.
  let workspaceItems: Record<string, unknown>[] = [];
  const slots = {
    inject: (name: string, body: () => unknown) => {
      record.injected.push(name);
      const produced = body() as { [Symbol.iterator]?: () => Iterator<unknown> } | undefined;
      // Vo that DUT generator cua slots.inject; context gia phai lam y vay, neu khong cac muc menu
      // dang ky bang `yield` se khong bao gio chay.
      if (produced !== undefined && typeof produced[Symbol.iterator] === "function") for (const _ of produced as Iterable<unknown>) void _;
    },
    register: (spec: Record<string, unknown>, component: unknown) => {
      if (failures > 0) {
        failures -= 1;
        throw new Error("register nem lan dau (ca kiem cong idempotent)");
      }
      record.registered.push({ spec, component });
      return { dispose: () => undefined };
    },
    registerFactory: (spec: Record<string, unknown>, component: unknown) => {
      record.registered.push({ spec, component });
      return { dispose: () => undefined };
    },
    provideRoot: () => undefined,
    entries: () => [],
    subscribe: () => () => undefined,
  };
  const sessions = {
    list: { getSnapshot: () => ({ ids: [], byId: {}, phase: "ready" }), subscribe: () => () => undefined },
    create: async (request: unknown) => {
      record.createdSessions.push(request);
      return "s1";
    },
    binding: () => undefined,
    searchResultLimit: 20,
    refreshProjections: () => undefined,
    retain: () => ({ sessionId: "s1", release: () => undefined }),
    subagentAddress: () => undefined,
  };
  const workspaces: Record<string, unknown> = {
    list: { getSnapshot: () => ({ items: workspaceItems, phase: "ready", state: "ready", archivedSessionIds: [], pinnedSessionIds: [] }), subscribe: () => () => undefined },
  };
  if (options.initializeDefault === true) {
    workspaces.initializeDefault = async () => {
      record.initializedDefault += 1;
      workspaceItems = [{ workspaceId: "w-default", path: "/home/u", sessionIds: [], createdAt: "2026-10-18T00:00:00.000Z" }];
      return workspaceItems[0];
    };
  }
  const ctx = {
    effect: (run: () => void, label: string) => {
      record.effects.push(label);
      run();
    },
    get: (name: string) => (name === "sessions" ? sessions : name === "workspaces" ? workspaces : undefined),
    on: () => () => undefined,
    slots,
    locale: { register: () => undefined, bind: () => (key: string) => key },
    sessions,
    workspaces,
    shortcuts: { register: () => ({ dispose: () => undefined }), catalog: { getSnapshot: () => [] } },
    layout: { beginNavigation: () => new AbortController().signal, selectPanel: () => undefined, panelInfo: { getSnapshot: () => ({ activePanelId: null }) } },
    remote: { $host: { home: "/home/u" }, directoryPicker: {} },
    remoteAccess: { source: () => ({}) },
    productAnalytics: { track: () => undefined },
  };
  return { ctx, record };
}

describe("row ui-workspace — khuon bundle", () => {
  test("artifact dang ky DUNG MOT id — id CUA TA, khong co id goc", () => {
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = declaredIds(artifact);
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_NAME);
  });

  test("TAP slot cua ta BANG tap slot cua bundle goc (dung hai regex cua check:rows)", () => {
    const ours = [...slotNames(ourText)].sort();
    const theirs = [...slotNames(stockText)].sort();
    expect(theirs.length).toBeGreaterThan(0);
    expect(ours).toEqual(theirs);
    expect(ours).toEqual([
      "conversation.hero.workspace",
      "shell.overlay",
      "sidebar.workspaces",
      "sidebar.workspaces.session.menu.item",
      "sidebar.workspaces.session.row.action",
      "workspace.toast",
    ]);
  });

  test("id nguoi ngoi cua slot LIST la nguyen van ban goc", () => {
    for (const id of ["pin", "rename", "fork", "archive", "session-id", "workspace.session-rename", "workspace.session-archive", "workspace.row-toast"]) {
      expect(ourText).toContain('id: "' + id + '"');
      expect(stockText).toContain('id: "' + id + '"');
    }
  });

  test("CSS bon module nguyen van TUNG BYTE so voi bundle goc, giu nguyen hash lop", () => {
    const theirs = cssStrings(stockText);
    const ours = cssStrings(readFileSync(join(OURS, "src", "css.ts"), "utf8"));
    expect(ours.length).toBe(4);
    for (const css of ours) expect(theirs).toContain(css);
    // Lop gay lech bo cuc +21px: phai co nguyen van ca chuoi lan ten lop.
    const animated = ours.find((css) => css.includes("Qg_5Eq_exits"));
    expect(animated).toBe(".Qg_5Eq_exits{contain:strict;pointer-events:none;position:absolute;inset:0;overflow:clip}");
    expect(hashClasses(animated as string)).toEqual(["Qg_5Eq_exits"]);
    expect(ourText).toContain('"exits": "Qg_5Eq_exits"');
  });

  test("tu dien namespace workspace du khoa nhu ban goc (zh va en)", () => {
    for (const name of ["zh", "en"] as const) {
      const theirs = stockDictionaryKeys(stockText, name);
      const ours = [...ourText.matchAll(new RegExp('^\\s+"([^"]+)":', "gm"))].map((m) => m[1] as string);
      expect(theirs.length).toBe(119);
      for (const key of theirs) expect(ours).toContain(key);
    }
  });

  test("seam inject phai nguyen van chin muc cua ban goc", () => {
    for (const seam of ["slots", "sessions", "workspaces", "locale", "remote", "remote.directoryPicker", "layout", "shortcuts", "remoteAccess"]) {
      expect(ourText).toContain('"' + seam + '"');
    }
  });
});

describe("row ui-workspace — mat plugin", () => {
  test("apply dang ky du sau slot va component la THAM SO THU HAI", async () => {
    // Specifier dung BIEN (khong phai literal): vua cho moi ca mot instance module TUOI (co `uiWorkspaceInstalled`
    // o pham vi module), vua khong buoc tsc phai phan giai mot duong dan co query.
    const freshSpec: string = "../../packages/client/ui-workspace/src/plugin.ts?fresh";
    const mod = (await import(freshSpec)) as { createPlugin: (requireFn: (spec: string) => unknown) => { apply: (ctx: unknown) => void; inject: readonly string[] } };
    const plugin = mod.createPlugin(fakeRequire);
    expect(plugin.inject).toEqual(["slots", "sessions", "workspaces", "locale", "remote", "remote.directoryPicker", "layout", "shortcuts", "remoteAccess"]);
    const { ctx, record } = stubContext();
    plugin.apply(ctx);
    const names = record.registered.map((call) => call.spec.name as string).filter((name) => name !== "workspace.toast.content");
    expect(new Set(names)).toEqual(new Set(["sidebar.workspaces", "sidebar.workspaces.session.menu.item", "sidebar.workspaces.session.row.action", "shell.overlay", "conversation.hero.workspace", "workspace.toast"]));
    expect(record.registered.every((call) => call.component !== undefined)).toBe(true);
    expect(record.effects).toContain("ui-workspace: dictionaries");
  });

  test("HOP DONG KHO XEM: ca kho LAN ket qua create() deu phai la NGUON ANH CHUP (getSnapshot/subscribe)", async () => {
    // ⚠️ 18/10/2026 — CA THAT trong lab 5461: khung slot goi `bindSnapshotSelector(w)` ⇒ `w.getSnapshot()`
    //   cho KET QUA cua `store.create()`. Ban dau `create()` chi tra `{ actions }` ⇒
    //   `TypeError: w.getSnapshot is not a function` ⇒ `slot entry crashed in 'sidebar.workspaces'` ⇒ ca
    //   thanh ben khong render (#root 68.760 -> 37.727) — va 8 test cu KHONG bat duoc vi chung chi kiem
    //   `record.registered`. Test nay kiem dung hop dong do.
    const contractSpec: string = "../../packages/client/ui-workspace/src/stores.ts?contract";
    const mod = (await import(contractSpec)) as {
      createWorkspaceViewStore: () => { getSnapshot: () => unknown; subscribe: (fn: () => void) => () => void; create: () => { getSnapshot: () => unknown; subscribe: (fn: () => void) => () => void; actions: Record<string, unknown> } };
    };
    const handle = mod.createWorkspaceViewStore();
    expect(typeof handle.getSnapshot).toBe("function");
    expect(typeof handle.subscribe).toBe("function");
    const instance = handle.create();
    expect(typeof instance.getSnapshot).toBe("function");
    expect(typeof instance.subscribe).toBe("function");
    // Nam dong hanh dong cua ban goc phai co mat tren the hien.
    for (const action of ["setGroupBy", "setOrderBy", "setArchivedFilter", "setGroupExpanded", "setSessionOrder", "retainAccountKeys", "syncSessionOrders", "pinSessionOrder"]) {
      expect(typeof instance.actions[action]).toBe("function");
    }
    expect(instance.getSnapshot()).toEqual({ groupBy: "workspace", orderBy: "manual", archivedFilter: "default", groupExpansion: {}, sessionOrderByAccount: {} });
  });

  test("CONG CHAN CAI HAI LAN: lan dau NEM ⇒ co van false ⇒ lan hai dang ky lai DU sau slot", async () => {
    const idempotentSpec: string = "../../packages/client/ui-workspace/src/plugin.ts?idempotent";
    const mod = (await import(idempotentSpec)) as { createPlugin: (requireFn: (spec: string) => unknown) => { apply: (ctx: unknown) => void } };
    const plugin = mod.createPlugin(fakeRequire);
    const first = stubContext({ failRegister: true });
    expect(() => plugin.apply(first.ctx)).toThrow();
    // Co PHAI van tat: lan hai phai dang ky lai day du, khong duoc thoat som.
    const second = stubContext();
    plugin.apply(second.ctx);
    const names = second.record.registered.map((call) => call.spec.name as string).filter((name) => name !== "workspace.toast.content");
    expect(new Set(names).size).toBe(6);
    // Lan thu ba: co da bat ⇒ khong dang ky them gi.
    const third = stubContext();
    plugin.apply(third.ctx);
    expect(third.record.registered.length).toBe(0);
  });
});

describe("row ui-workspace — hop dong port lai (a)(b)(c)", () => {
  /** Tap ten primitive ma mot doan ma dung qua `_deepseek_ai_dsh_client_ui_primitives.X` / `ext.primitives.X`. */
  function primitivesOf(text: string): Set<string> {
    const out = new Set<string>();
    for (const m of text.matchAll(/_deepseek_ai_dsh_client_ui_primitives\.([A-Za-z0-9_]+)/g)) out.add(m[1] as string);
    for (const m of text.matchAll(/ext\.primitives\.([A-Za-z0-9_]+)/g)) out.add(m[1] as string);
    return out;
  }

  /** Ham dich gia: tra ve CHINH khoa (bo qua tham so) — du de doi chieu cau truc. */
  const tKey = (key: string): string => key;
  /** Ham dich gia ghi lai ca tham so — dung cho activityLine. */
  const tParam = (key: string, params?: Record<string, unknown>): string =>
    key === "archive.confirm.listSeparator" ? ", " : params === undefined ? key : key + "|" + JSON.stringify(params);
  /** Callback rong dung lam tham so hanh dong. */
  const noop = (): void => undefined;

  /**
   * Nap runtime THAT (ban khong query, da bind) roi nap mot module src qua spec CO QUERY.
   * Nhan: name — ten file trong src/; query — nhan duy nhat cho instance module.
   * Tra: module da nap.
   */
  async function loadModule<T>(name: string, query: string): Promise<T> {
    const pluginSpec: string = "../../packages/client/ui-workspace/src/plugin.ts?" + query;
    const plugin = (await import(pluginSpec)) as { createPlugin: (requireFn: (spec: string) => unknown) => unknown };
    plugin.createPlugin(fakeRequire);
    const spec: string = "../../packages/client/ui-workspace/src/" + name + ".ts?" + query;
    return (await import(spec)) as T;
  }

  test("(c) MOI primitive ta dung deu CO THAT trong ban goc — het MenuItem (khong ton tai)", () => {
    // ⚠️ 18/10/2026 — CA THAT: `ext.primitives.MenuItem` KHONG ton tai trong module primitive cua vo
    // (chi co Menu / MenuGroup / MenuItemButton / MenuSurface). Node React voi type undefined NEM ngay
    // khi render ⇒ KHUNG SLOT bat loi va render RONG ma KHONG co dong console nao. Nam muc menu "..." lai
    // duoc render EAGER cho MOI dong phien (renderSlot nam trong children cua Menu) ⇒ mat hang nghin ky tu
    // HTML tren moi lan boot: dung lop loi "mat noi dung am tham" (8) #root 68.760 -> 43.883.
    const theirs = primitivesOf(stockText);
    const ours = primitivesOf(ourText);
    expect([...ours].filter((name) => !theirs.has(name))).toEqual([]);
    expect(ours.has("MenuItemButton")).toBe(true);
    expect(ours.has("IconWarningOutlineRegular")).toBe(true);
    expect(ours.has("IconPinFillRegular")).toBe(true);
    expect(theirs.has("MenuItem")).toBe(false);
  });

  /**
   * Tap export THAT cua module `@deepseek-ai/dsh-client-ui-primitives` trong VO dang phuc vu.
   * Doc tu bang module cua bundle frontend (nguon su that), KHONG suy tu bundle goc cua row.
   */
  function shellPrimitives(): Set<string> {
    const dist = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist", "assets");
    const files = [...new Bun.Glob("index-*.js").scanSync({ cwd: dist })];
    expect(files.length).toBeGreaterThan(0);
    const text = readFileSync(join(dist, files[0] as string), "utf8");
    const at = text.indexOf('"@deepseek-ai/dsh-client-ui-primitives":');
    expect(at).toBeGreaterThan(-1);
    const ident = /^"@deepseek-ai\/dsh-client-ui-primitives":([A-Za-z0-9_$]+)/.exec(text.slice(at))?.[1] as string;
    const marker = ident + "=Object.freeze(Object.defineProperty({__proto__:null,";
    const start = text.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const from = start + marker.length;
    const end = text.indexOf("},Symbol.toStringTag", from);
    const body = text.slice(from, end);
    // Cat theo dau phay o MUC 0 (bo qua phay trong ngoac/goi ham).
    const keys: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of body) {
      if (ch === "{" || ch === "[" || ch === "(") depth += 1;
      else if (ch === "}" || ch === "]" || ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        keys.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim() !== "") keys.push(current);
    return new Set(keys.map((entry) => entry.split(":")[0]?.trim() ?? "").filter((name) => name !== ""));
  }

  test("(c2) TAP primitive ta dung ⊆ TAP primitive THAT cua vo (khong suy tu bundle goc)", () => {
    // ⚠️ 18/10/2026 — LUAT do C4.1: mot ten primitive KHONG TON TAI thi React nem khi render ⇒ khung slot
    //   render RONG va KHONG co dong console nao. Phep kiem phai doi chieu voi CHINH module cua vo
    //   (bundle frontend dang phuc vu), vi bundle goc chi la mot nguoi dung khac cua cung module do.
    const shell = shellPrimitives();
    expect(shell.size).toBeGreaterThan(200);
    expect(shell.has("MenuItem")).toBe(false);
    expect(shell.has("MenuItemButton")).toBe(true);
    const missingSource = [...primitivesOf(ourText)].filter((name) => !shell.has(name));
    expect(missingSource).toEqual([]);
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const missingArtifact = [...primitivesOf(artifact)].filter((name) => !shell.has(name));
    expect(missingArtifact).toEqual([]);
  });

  test("(a) partial-json: PartialArguments co DU phuong thuc nhu ban goc", async () => {
    /** Ten phuong thuc cua lop trong bundle goc (vung partial-json). */
    function stockMethods(): string[] {
      const start = stockText.indexOf("(class PartialArguments {");
      const end = stockText.indexOf("//#endregion", start);
      const names = new Set<string>();
      for (const m of stockText.slice(start, end).matchAll(/^\t{3}(?:get )?([A-Za-z][A-Za-z0-9]*)\(/gm)) names.add(m[1] as string);
      return [...names].sort();
    }
    const mod = (await import("../../packages/client/ui-workspace/src/partial-json.ts?partial")) as { PartialArguments: { prototype: object; fromText: (t: string) => unknown; fromObject: (v: unknown) => unknown } };
    const Klass = mod.PartialArguments as unknown as { prototype: object; EMPTY: unknown };
    const ours = Object.getOwnPropertyNames(Klass.prototype).filter((name) => name !== "constructor").sort();
    expect(ours).toEqual(stockMethods());
    for (const statics of ["EMPTY", "fromText", "fromObject"]) expect(statics in Klass).toBe(true);
  });

  test("(a) partial-json: doc truong dang stream, settle, refresh, va van ban khong hop le", async () => {
    const { PartialArguments } = (await import("../../packages/client/ui-workspace/src/partial-json.ts?partial-stream")) as { PartialArguments: any };
    const view = new PartialArguments();
    expect(view.isSealed).toBe(false);
    expect(view.keys()).toEqual([]);
    view.append('{"path": "src/ma');
    expect(view.keys()).toEqual(["path"]);
    expect(view.has("path")).toBe(true);
    expect(view.hasNow("nope")).toBe(false);
    expect(view.complete("path")).toBe(false);
    expect(view.text("path")).toBe("src/ma");
    expect(view.stringLength("path")).toBe(6);
    expect(view.textPrefix("path", 3)).toBe("src");
    expect(view.stringExceeds("path", 3)).toBe(true);
    expect(view.stringExceeds("path", 99)).toBe(false);
    view.append('in.ts", "lines": 12, "nested": {"a": [1, 2]}}');
    expect(view.complete("path")).toBe(true);
    expect(view.text("path")).toBe("src/main.ts");
    expect(view.value("lines")).toBe(12);
    expect(view.value("nested")).toEqual({ a: [1, 2] });
    expect(view.closed()).toBe(true);
    // `value` tra undefined cho truong chuoi; `text` tra undefined cho truong khong phai chuoi.
    expect(view.value("path")).toBeUndefined();
    expect(view.text("lines")).toBeUndefined();
    // refresh: sau khi ghi nho mot cau tra loi, lan doc THAT SU doi moi bao true.
    const stream = new PartialArguments();
    const live = new PartialArguments();
    live.append('{"q": "a');
    expect(live.refresh()).toBe(false);
    expect(live.text("q")).toBe("a");
    expect(live.refresh()).toBe(false);
    live.append("b");
    expect(live.refresh()).toBe(true);
    expect(live.text("q")).toBe("ab");
    // settle: noi dung khop ⇒ giu nguyen khung nhin (da niem phong); lech ⇒ khung nhin moi.
    stream.append('{"q": "ab"}');
    expect(stream.settle('{"q": "ab"}')).toBe(stream);
    expect(stream.isSealed).toBe(true);
    expect(() => stream.append("x")).toThrow();
    expect(stream.settle('{"q": "zz"}')).not.toBe(stream);
    // JSON hong: index bao invalid, va van ban thoat khong hop le cung bao invalid.
    const broken = new PartialArguments();
    broken.append('{"q": oops}');
    // Nguyen y ban goc: noi dung gia tri CHUA doc thi KHONG kiem — chi khi doc moi bao.
    expect(broken.invalid).toBe(false);
    expect(broken.value("q")).toBeUndefined();
    expect(broken.invalid).toBe(true);
    const badEscape = new PartialArguments();
    badEscape.append('{"q": "a\\x"}');
    // Cung nguyen y: thoat sai chi lo ra khi DOC noi dung, va doc thi DUNG ngay tai cho hong.
    expect(badEscape.invalid).toBe(false);
    expect(badEscape.text("q")).toBe("a");
    expect(badEscape.invalid).toBe(true);
    // fromObject: khung nhin da niem phong tren payload da phan tich.
    const fromObject = PartialArguments.fromObject({ a: "x", b: 2 });
    expect(fromObject.isSealed).toBe(true);
    expect(fromObject.keys()).toEqual(["a", "b"]);
    expect(fromObject.has("a")).toBe(true);
    expect(fromObject.text("a")).toBe("x");
    expect(fromObject.value("b")).toBe(2);
    expect(fromObject.value("a")).toBeUndefined();
    expect(PartialArguments.fromObject(null).keys()).toEqual([]);
    // Giai ma escape trong chuoi dang stream (\n va \uXXXX).
    const escaped = new PartialArguments();
    escaped.append('{"s": "a\\n\\u0041 b');
    expect(escaped.text("s")).toBe("a\nA b");
    // "a" + \\n + "A" + " " + "b" = 5 don vi UTF-16 da giai ma (khac do dai THO cua van ban JSON).
    expect(escaped.stringLength("s")).toBe(5);
    // slice: doc xuyen nhieu doan ma khong noi ca nguon.
    const sliced = new PartialArguments();
    sliced.append('{"k": "abc');
    sliced.append('def"}');
    expect(sliced.text("k")).toBe("abcdef");
  });

  test("(b) toast: RowActionToast uy quyen cho slot KEYED workspace.toast theo entryKey", async () => {
    const toast = await loadModule<{ RowActionToast: (props: unknown) => any }>("toast", "toast-row");
    const dismissToast = (): void => undefined;
    const notice = { kind: "pinFailed", seq: 4 };
    const node = toast.RowActionToast({
      useToast: (select: (value: unknown) => unknown) => select(notice),
      dismissToast,
      renderSlot: (name: string, props: Record<string, unknown>, options: Record<string, unknown>) => ({ name, props, options }),
    });
    expect(node.name).toBe("workspace.toast");
    expect(node.options.entryKey).toBe("pinFailed");
    expect(node.props.dismissToast).toBe(dismissToast);
    expect(node.props.kind).toBe("pinFailed");
    expect(toast.RowActionToast({ useToast: (select: (value: unknown) => unknown) => select(null), dismissToast, renderSlot: () => ({}) })).toBeNull();
  });

  test("(b) toast: hai muc entry di qua Factory 'workspace.toast.content' va Archive tu them hanh dong loc", async () => {
    const toast = await loadModule<{
      ToastEntry: (props: unknown) => any;
      ArchiveToastEntry: (props: unknown) => any;
      WorkspaceToast: (props: unknown) => any;
      registerToasts: (ctx: unknown, viewStore: unknown, actions: unknown) => void;
      toastDefinitions: (actions: unknown) => { key: string }[];
    }>("toast", "toast-entry");
    const dismissToast = (): void => undefined;
    const entry = toast.ToastEntry({ dismissToast, display: () => ({ text: "T", tone: "success" }), t: tKey, renderFactorySlot: (name: string, props: Record<string, unknown>) => ({ name, props }), seq: 7 });
    expect(entry.name).toBe("workspace.toast.content");
    expect(entry.props.text).toBe("T");
    expect(entry.props.seq).toBe(7);
    expect(entry.props.onDone).toBe(dismissToast);
    expect("onDismiss" in entry.props).toBe(false);
    /** Phan trinh bay gia co san mot hanh dong cua chu so huu. */
    const display = (): Record<string, unknown> => ({ text: "A", tone: "success", actions: [{ label: "undo" }] });
    const filterAction = (): Record<string, unknown> => ({ prefix: "or", label: "filter" });
    const base = { dismissToast, display, filterAction, t: tKey, renderFactorySlot: (_name: string, props: Record<string, unknown>) => props, seq: 1 };
    const hidden = (toast.ArchiveToastEntry({ ...base, useStore: (select: (state: unknown) => unknown) => select({ archivedFilter: "default" }) }) as any).actions;
    expect(hidden.length).toBe(2);
    expect(hidden[1]).toEqual({ prefix: "or", label: "filter" });
    const shown = (toast.ArchiveToastEntry({ ...base, useStore: (select: (state: unknown) => unknown) => select({ archivedFilter: "show" }) }) as any).actions;
    expect(shown.length).toBe(1);
    // WorkspaceToast: sac thai quyet dinh tone/icon; holdMs va actions chi truyen khi co.
    const warning = toast.WorkspaceToast({ seq: 3, text: "W", tone: "warning", holdMs: 6000, actions: [{ label: "a" }], onDone: dismissToast });
    expect(warning.type).toBe("Toast");
    expect(warning.props.icon.type).toBe("IconWarningOutlineRegular");
    expect(warning.props.holdMs).toBe(6000);
    expect(warning.props.actions.length).toBe(1);
    expect(warning.props.onDone).toBe(dismissToast);
    expect(warning.key).toBe(3);
    const success = toast.WorkspaceToast({ seq: 1, text: "S", tone: "success", onDone: dismissToast });
    expect(success.props.tone).toBe("success");
    expect("icon" in success.props).toBe(false);
    expect("holdMs" in success.props).toBe(false);
    expect("actions" in success.props).toBe(false);
    const plain = toast.WorkspaceToast({ seq: 2, text: "P", tone: "plain", onDone: dismissToast });
    expect("tone" in plain.props).toBe(false);
    expect("icon" in plain.props).toBe(false);
    // registerToasts: Factory la CHINH WorkspaceToast, va muoi mot khoa duoc dang ky dung thu tu.
    const calls: { factory: unknown; keys: string[]; stores: Record<string, unknown> } = { factory: undefined, keys: [], stores: {} };
    const fakeCtx = {
      slots: {
        registerFactory: (_spec: unknown, component: unknown) => {
          calls.factory = component;
        },
        inject: (_name: string, body: () => Iterable<{ spec: Record<string, unknown> }>) => {
          for (const registered of body()) {
            calls.keys.push(registered.spec.key as string);
            if (registered.spec.store !== undefined) calls.stores[registered.spec.key as string] = registered.spec.store;
          }
        },
        register: (spec: Record<string, unknown>) => ({ spec }),
      },
    };
    const viewStore = { getSnapshot: () => ({}), subscribe: () => noop };
    toast.registerToasts(fakeCtx, viewStore, { undoArchive: noop, showArchived: noop, openForkSource: noop });
    expect(calls.factory).toBe(toast.WorkspaceToast);
    expect(calls.keys.length).toBe(11);
    expect(calls.keys[0]).toBe("sessionIdCopied");
    expect(calls.keys[10]).toBe("stoppedAndArchived");
    expect(Object.keys(calls.stores).sort()).toEqual(["archived", "stoppedAndArchived"]);
    expect(toast.toastDefinitions({ undoArchive: noop, showArchived: noop, openForkSource: noop }).length).toBe(11);
  });

  test("(c) muc menu: MenuItemButton voi children/shortcut; ghim va luu tru loai tru nhau", async () => {
    const sa = await loadModule<Record<string, (props: unknown) => any>>("session-actions", "actions-menu");
    const opened: unknown[] = [];
    const pinned = { sessionId: "s1", useMenuOpenState: () => [false, (value: unknown) => opened.push(value)], usePinned: (select: (value: unknown) => unknown) => select(new Set(["s1"])), useArchived: (select: (value: unknown) => unknown) => select(new Set()) };
    const archived = { sessionId: "s9", useMenuOpenState: () => [false, (value: unknown) => opened.push(value)], usePinned: (select: (value: unknown) => unknown) => select(new Set()), useArchived: (select: (value: unknown) => unknown) => select(new Set(["s9"])) };
    const unpinned: string[] = [];
    const pin = sa.PinSessionMenuItem!({ ...pinned, unpinSession: (id: string) => unpinned.push(id), pinSession: noop, t: tKey });
    expect(pin.type).toBe("MenuItemButton");
    expect(pin.props.children).toBe("menu.unpinSession");
    expect(pin.props.icon.type).toBe("IconPinFillRegular");
    pin.props.onSelect();
    expect(opened).toEqual([false]);
    expect(unpinned).toEqual(["s1"]);
    const notPinned = sa.PinSessionMenuItem!({ ...pinned, usePinned: (select: (value: unknown) => unknown) => select(new Set()), unpinSession: noop, pinSession: noop, t: tKey });
    expect(notPinned.props.children).toBe("menu.pinSession");
    expect(notPinned.props.icon.type).toBe("IconPinOutlineRegular");
    // Dong DA LUU TRU: ca muc menu lan nut tren dong deu KHONG duoc hien.
    expect(sa.PinSessionMenuItem!({ ...archived, unpinSession: noop, pinSession: noop, t: tKey })).toBeNull();
    expect(sa.PinSessionRowButton!({ ...archived, unpinSession: noop, pinSession: noop, t: tKey })).toBeNull();
    // Muc luu tru: nhan/bieu tuong doi theo trang thai; shortcut chi truyen khi CHUA luu tru.
    const catalog = (select: (rows: unknown) => unknown) => select([{ id: "session.archive" }, { id: "session.fork" }, { id: "session.rename" }]);
    const archiveItem = sa.ArchiveSessionMenuItem!({ ...archived, useShortcuts: catalog, archiveSession: noop, unarchiveSession: noop, t: tKey });
    expect(archiveItem.type).toBe("MenuItemButton");
    expect(archiveItem.props.children).toBe("menu.unarchiveSession");
    expect(archiveItem.props.shortcut).toBeUndefined();
    expect(archiveItem.props.icon.type).toBe("IconUnarchiveOutlineRegular");
    const liveItem = sa.ArchiveSessionMenuItem!({ ...pinned, useShortcuts: catalog, archiveSession: noop, unarchiveSession: noop, t: tKey });
    expect(liveItem.props.children).toBe("menu.archiveSession");
    expect(liveItem.props.icon.type).toBe("IconArchiveOutlineRegular");
    expect(liveItem.props.shortcut).toEqual({ id: "session.archive" });
    // Fork: phai hoi quyen theo phien; khong co quyen thi KHONG render.
    expect(sa.ForkSessionMenuItem!({ ...pinned, useShortcuts: catalog, useSessionAccess: () => false, forkSession: noop, t: tKey })).toBeNull();
    const forked: string[] = [];
    const fork = sa.ForkSessionMenuItem!({ ...pinned, useShortcuts: catalog, useSessionAccess: () => true, forkSession: (id: string) => forked.push(id), t: tKey });
    expect(fork.type).toBe("MenuItemButton");
    expect(fork.props.children).toBe("menu.fork");
    expect(fork.props.shortcut).toEqual({ id: "session.fork" });
    fork.props.onSelect();
    expect(forked).toEqual(["s1"]);
    // Doi ten: tra ve yeu cau doi ten voi tieu de hien tai.
    const renames: unknown[] = [];
    const rename = sa.RenameSessionMenuItem!({ sessionId: "s1", displayTitle: "T", useMenuOpenState: () => [false, noop], useShortcuts: catalog, requestSessionRename: (id: string, title: string) => renames.push([id, title]), t: tKey });
    expect(rename.type).toBe("MenuItemButton");
    expect(rename.props.children).toBe("rename");
    expect(rename.props.shortcut).toEqual({ id: "session.rename" });
    rename.props.onSelect();
    expect(renames).toEqual([["s1", "T"]]);
    // Session ID: muc cuoi cung.
    const copied: string[] = [];
    const idItem = sa.SessionIdMenuItem!({ sessionId: "s1", useMenuOpenState: () => [false, noop], copySessionId: (id: string) => copied.push(id), t: tKey });
    expect(idItem.type).toBe("MenuItemButton");
    expect(idItem.props.children).toBe("menu.sessionId");
    expect(idItem.props.icon.type).toBe("IconCopyOutlineRegular");
    idItem.props.onSelect();
    expect(copied).toEqual(["s1"]);
  });

  test("(c) nut tren dong: Tooltip align end + portal; bam la goi dung hanh dong", async () => {
    const sa = await loadModule<Record<string, (props: unknown) => any>>("session-actions", "actions-buttons");
    const archived: string[] = [];
    const button = sa.ArchiveSessionRowButton!({ sessionId: "s1", useArchived: (select: (value: unknown) => unknown) => select(new Set()), archiveSession: (id: string) => archived.push(id), unarchiveSession: noop, t: tKey });
    expect(button.type).toBe("Tooltip");
    expect(button.props.align).toBe("end");
    expect(button.props.portal).toBe(true);
    expect(button.props.side).toBe("bottom");
    expect(button.props.label).toBe("actions.archive");
    expect(button.props.children.type).toBe("button");
    expect(button.props.children.props["aria-label"]).toBe("menu.archiveSession");
    expect(String(button.props.children.props.className).endsWith("_iconButton")).toBe(true);
    button.props.children.props.onClick();
    expect(archived).toEqual(["s1"]);
    const restore = sa.ArchiveSessionRowButton!({ sessionId: "s9", useArchived: (select: (value: unknown) => unknown) => select(new Set(["s9"])), archiveSession: noop, unarchiveSession: (id: string) => archived.push("undo:" + id), t: tKey });
    expect(restore.props.label).toBe("actions.unarchive");
    restore.props.children.props.onClick();
    expect(archived).toEqual(["s1", "undo:s9"]);
    const pinned: string[] = [];
    const pinButton = sa.PinSessionRowButton!({ sessionId: "s1", usePinned: (select: (value: unknown) => unknown) => select(new Set(["s1"])), useArchived: (select: (value: unknown) => unknown) => select(new Set()), pinSession: noop, unpinSession: (id: string) => pinned.push(id), t: tKey });
    expect(pinButton.type).toBe("Tooltip");
    expect(pinButton.props.label).toBe("actions.unpin");
    expect(pinButton.props.portal).toBe(true);
    expect(pinButton.props.children.props.children.type).toBe("IconPinFillRegular");
    pinButton.props.children.props.onClick();
    expect(pinned).toEqual(["s1"]);
  });

  test("(c) hop thoai: khong mount Modal rong; co yeu cau thi Modal day du va key = sessionId", async () => {
    const sa = await loadModule<Record<string, (props: unknown) => any>>("session-actions", "actions-dialog");
    const settle = (): void => undefined;
    expect(sa.SessionArchiveConfirmDialog!({ useArchiveRequest: (select: (value: unknown) => unknown) => select(null), settleSessionArchive: settle, stopAndArchiveSession: noop, t: tKey })).toBeNull();
    const request = { sessionId: "s1", displayTitle: "T", activity: [{ kind: "turn", items: [] }, { kind: "job", items: [{ id: "j1" }] }] };
    const dialog = sa.SessionArchiveConfirmDialog!({ useArchiveRequest: (select: (value: unknown) => unknown) => select(request), settleSessionArchive: settle, stopAndArchiveSession: noop, t: tKey });
    expect(dialog.type).toBe(sa.ArchiveConfirmForm);
    expect(dialog.key).toBe("s1");
    const form = sa.ArchiveConfirmForm!({ request, stopAndArchiveSession: () => Promise.resolve(), onSettle: settle, t: tKey });
    expect(form.type).toBe("Modal");
    expect(form.props.open).toBe(true);
    expect(form.props.title).toBe("archive.confirm.title");
    expect(form.props.description).toBe("archive.confirm.desc");
    expect(form.props.closeLabel).toBe("close");
    expect(form.props.footer.type).toBe("Fragment");
    expect(form.props.footer.props.children.length).toBe(2);
    expect(String(form.props.footer.props.children[1].props.className).endsWith("_deleteAction")).toBe(true);
    expect(form.props.footer.props.children[1].props.children).toBe("archive.confirm.action");
    expect(form.props.children[0].type).toBe("ul");
    expect(form.props.children[0].props["aria-label"]).toBe("archive.confirm.activity");
    expect(form.props.children[0].props.children.length).toBe(2);
    expect(form.props.children[0].props.children[0].key).toBe("turn-0");
    // Nguyen y ban goc: children la mang BA phan tu (hai nhanh co dieu kien false khi khong co gi).
    expect(form.props.children.length).toBe(3);
    expect(form.props.children[1]).toBe(false);
    expect(form.props.children[2]).toBe(false);
    expect(sa.SessionRenameDialog!({ useRenameRequest: (select: (value: unknown) => unknown) => select(null), settleSessionRename: settle, renameSession: () => Promise.resolve(), t: tKey })).toBeNull();
    const renameDialog = sa.SessionRenameDialog!({ useRenameRequest: (select: (value: unknown) => unknown) => select({ sessionId: "s2", currentTitle: "Old" }), settleSessionRename: settle, renameSession: () => Promise.resolve(), t: tKey });
    expect(renameDialog.type).toBe(sa.RenameForm);
    expect(renameDialog.key).toBe("s2");
    const renameForm = sa.RenameForm!({ request: { sessionId: "s2", currentTitle: "Old" }, renameSession: () => Promise.resolve(), onSettle: settle, t: tKey });
    expect(renameForm.type).toBe("Modal");
    expect(renameForm.props.open).toBe(true);
    expect(renameForm.props.title).toBe("rename.session.title");
    expect(renameForm.props.children[0].props.value).toBe("Old");
    expect(renameForm.props.children[0].props["aria-label"]).toBe("field.sessionName");
    expect(renameForm.props.footer.props.children[1].props.disabled).toBe(false);
    expect(renameForm.props.footer.props.children[1].props.variant).toBe("primary");
  });

  test("(c) activityLine: du nam ho + so nhieu, va MOI khoa sinh ra deu CO trong tu dien", async () => {
    const sa = await loadModule<{ activityLine: (entry: unknown, t: (key: string, params?: Record<string, unknown>) => string) => string }>("session-actions", "actions-activity");
    const locales = (await import("../../packages/client/ui-workspace/src/locales.ts?actions-activity")) as { zh: Record<string, string>; en: Record<string, string> };
    expect(sa.activityLine({ kind: "turn", items: [] }, tParam)).toBe("archive.confirm.turn");
    expect(sa.activityLine({ kind: "subagent", items: [{ label: "A" }] }, tParam)).toBe('archive.confirm.subagents.one|{"n":1,"names":"A"}');
    expect(sa.activityLine({ kind: "job", items: [{ id: "j1" }, { label: "J2" }] }, tParam)).toBe('archive.confirm.jobs.other|{"n":2,"names":"j1, J2"}');
    expect(sa.activityLine({ kind: "schedule", items: [{ id: "s1" }] }, tParam)).toBe('archive.confirm.schedules.one|{"n":1,"names":"s1"}');
    expect(sa.activityLine({ kind: "provider", items: [{ id: "p1" }] }, tParam)).toBe('archive.confirm.other.one|{"kind":"provider","n":1}');
    expect(sa.activityLine({ kind: "provider", items: [] }, tParam)).toBe('archive.confirm.other.other|{"kind":"provider","n":0}');
    const seen = new Set<string>();
    for (const kind of ["turn", "subagent", "job", "schedule", "provider"]) {
      for (const items of [[], [{ id: "a" }], [{ id: "a" }, { label: "b" }]]) sa.activityLine({ kind, items }, (key: string) => (seen.add(key), key));
    }
    for (const key of ["archive.confirm.listSeparator"]) seen.add(key);
    expect(seen.size).toBeGreaterThanOrEqual(8);
    for (const key of seen) {
      expect(Object.hasOwn(locales.zh, key)).toBe(true);
      expect(Object.hasOwn(locales.en, key)).toBe(true);
    }
  });
});

describe("row ui-workspace — chinh sach dieu huong (C4.1 18/10/2026)", () => {
  test("nguon phai co DU ba manh chinh sach cua ban goc: watchNavigation · restoreSelection · initializeDefaultWorkspace", () => {
    // ⚠️ 18/10/2026 — PHEP DO C4.1 (doi bundle goc vao CUNG home lab) tim ra NOI THIEU THAT:
    //   ban goc mo mot effect vong doi ⇒ `watchNavigation` ⇒ `restoreSelection` ⇒ khi may sach thi
    //   `initializeDefaultWorkspace` (goi `workspaces.initializeDefault`). Ban port truoc BO MAT ca ba
    //   ⇒ host khong co workspace nao ⇒ khung sidebar.workspaces ve trang thai RONG + khung giua chi con
    //   man trong ⇒ #root 41.266 thay vi 58.588 (lab) va 43.883 thay vi 68.760 (app), 0 loi console.
    expect(stockText).toContain("initializeDefaultWorkspace");
    expect(stockText).toContain("watchNavigation");
    expect(stockText).toContain("restoreSelection");
    for (const name of ["watchNavigation", "restoreSelection", "initializeDefaultWorkspace", "clearArchivedCurrent"]) {
      expect(ourText).toContain(name);
    }
    // Va phai duoc NGOI vao vong doi: effect trong ham dung service.
    expect(ourText).toContain("ui-workspace: Workspace navigation policy");
    const artifact = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    for (const name of ["watchNavigation", "restoreSelection", "initializeDefaultWorkspace"]) {
      expect(artifact).toContain(name);
    }
  });

  test("MAY SACH: apply TU TAO workspace mac dinh roi mo mot phien — dung nhu ban goc", async () => {
    const navSpec: string = "../../packages/client/ui-workspace/src/plugin.ts?navigation";
    const mod = (await import(navSpec)) as { createPlugin: (requireFn: (spec: string) => unknown) => { apply: (ctx: unknown) => void } };
    const plugin = mod.createPlugin(fakeRequire);
    const { ctx, record } = stubContext({ initializeDefault: true });
    plugin.apply(ctx);
    // restoreSelection la bat dong bo; cho vai vong microtask/timer cho no chay het.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(record.initializedDefault).toBe(1);
    expect(record.createdSessions).toEqual([{ workspaceId: "w-default" }]);
  });

  test("MAY DA CO WORKSPACE: KHONG tao them workspace mac dinh, chi mo phien cua workspace gan nhat", async () => {
    const navSpec: string = "../../packages/client/ui-workspace/src/plugin.ts?navigation-existing";
    const mod = (await import(navSpec)) as { createPlugin: (requireFn: (spec: string) => unknown) => { apply: (ctx: unknown) => void } };
    const plugin = mod.createPlugin(fakeRequire);
    const { ctx, record } = stubContext({ initializeDefault: true });
    // Co san mot workspace ⇒ restoreSelection phai chon no, KHONG goi initializeDefault.
    (ctx as { workspaces: { list: { getSnapshot: () => { items: unknown[] } } } }).workspaces.list.getSnapshot().items.push({ workspaceId: "w-existing", path: "/home/u", sessionIds: [], createdAt: "2026-10-18T00:00:00.000Z" });
    plugin.apply(ctx);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(record.initializedDefault).toBe(0);
    expect(record.createdSessions).toEqual([{ workspaceId: "w-existing" }]);
  });
});

describe("row ui-workspace — ten workspace mac dinh (C4.1 18/10/2026)", () => {
  test("workspaceDisplayTitle doi chieu DUNG chuoi ma host tu dat \"default-workspace\"", async () => {
    // ⚠️ 18/10/2026 — ban goc: `return title === "default-workspace" ? localizedDefault : title;`
    //   Ban port truoc doi chieu `title === ""` ⇒ cay DOM khac MOT truong so voi bundle goc
    //   ("default-workspace" thay vi "Default workspace") du #root dai bang nhau.
    expect(stockText).toContain('title === "default-workspace"');
    const mod = (await import("../../packages/client/ui-workspace/src/views.ts?display-title")) as { workspaceDisplayTitle: (title: string, fallback: string) => string };
    expect(mod.workspaceDisplayTitle("default-workspace", "Default workspace")).toBe("Default workspace");
    expect(mod.workspaceDisplayTitle("galaxy", "Default workspace")).toBe("galaxy");
    expect(mod.workspaceDisplayTitle("", "Default workspace")).toBe("");
  });
});
