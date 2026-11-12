/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test row ui-conversation — mot-id · muoi ba dang ky + nam inject nguyen van · cong chan cai hai lan ·
 *      hop dong STORE cap cho slot cua goi khac · tap PRIMITIVE dung khong vuot ban goc ·
 *      va parity TUNG BYTE voi bundle goc (than factory + muoi module CSS)
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  LOCALE_NAMESPACE,
  MAIN_SLOT_KEY,
  MODULE_IDS,
  PACKAGE_ALIASES,
  PACKAGE_NAME,
  SETTINGS_ENTRY_ID,
  SLOT_INJECTIONS,
  SLOT_NAMES as DECLARED_SLOTS,
  SLOT_REGISTRATIONS,
  STOCK_PACKAGE_NAME,
  STYLE_MODULES,
  USER_TEXT_NODE_KEYS,
} from "../../packages/client/ui-conversation/src/ids.ts";
import { CSS_REPLACEMENTS, PART_FILES } from "../../packages/client/ui-conversation/src/manifest.ts";
import { boTuDienVi, chuanHoaArtefact } from "../helpers/vi-dictionary.ts";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-conversation");
/** Ban goc DSH (chi doc) — nguon doi chung. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-conversation", "lib", "client.js");
/** Dong dau khoi cong chan cai hai lan trong artifact (xem build.ts / tools/extract.ts). */
const GUARD_MARK = "\t\t// \u26a0\ufe0f 18/10/2026: CONG CHONG CAI HAI LAN";

/** Mot lan goi slots.register/registerFactory/inject bat duoc tu artifact. */
interface SlotCall {
  /** Ham duoc goi. */
  method: "register" | "registerFactory" | "inject";
  /** Cac tham so o cap cao nhat, nguyen van. */
  args: string[];
}

/**
 * Noi dung file .module.css bo phan header 7 dong.
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

/**
 * Duong dan artifact de do — CHI nhan ban trong lib/ khi no con moi hon moi file nguon.
 * Nhan: khong.
 * Tra: duong dan file client.js.
 */
function artifactPath(): string {
  const built = join(OURS, "lib", "client.js");
  if (!existsSync(built)) throw new Error("chua co artifact " + built + " — chay bun run build.ts trong packages/client/ui-conversation");
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
 * Doc artifact cua ta.
 * Nhan: khong.
 * Tra: van ban lib/client.js.
 */
function artifact(): string {
  return readFileSync(artifactPath(), "utf8");
}

/**
 * Cat danh sach tham so o cap cao nhat cua mot loi goi, bo qua chuoi va ngoac long nhau.
 * Nhan: text — doan ma; open — chi so dau ngoac mo.
 * Tra: { args, end } — cac tham so nguyen van va chi so sau ngoac dong.
 */
function splitArgs(text: string, open: number): { args: string[]; end: number } {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  let quote = "";
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (quote !== "") {
      current += ch;
      if (ch === "\\") {
        current += text[i + 1] ?? "";
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") {
      depth += 1;
      if (depth === 1) continue;
      current += ch;
      continue;
    }
    if (ch === ")" || ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) {
        args.push(current.trim());
        return { args, end: i };
      }
      current += ch;
      continue;
    }
    if (ch === "," && depth === 1) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  throw new Error("loi goi khong dong ngoac");
}

/**
 * Quet moi loi goi slots.register / slots.registerFactory / slots.inject trong artifact.
 * Nhan: code — van ban artifact.
 * Tra: danh sach loi goi theo thu tu xuat hien.
 */
function slotCalls(code: string): SlotCall[] {
  const out: SlotCall[] = [];
  const pattern = /slots\s*\.\s*(registerFactory|register|inject)\s*\(/g;
  for (const match of code.matchAll(pattern)) {
    const open = (match.index as number) + match[0].length - 1;
    const { args } = splitArgs(code, open);
    out.push({ method: match[1] as SlotCall["method"], args });
  }
  return out;
}

/**
 * Doc mot truong chuoi o cap cao nhat cua mot doi tuong spec.
 * Nhan: spec — van ban doi tuong; field — ten truong.
 * Tra: gia tri chuoi, hoac null khi khong co.
 */
function specField(spec: string, field: string): string | null {
  const found = new RegExp("(?:^|[\\s{,])(?:" + field + ")\\s*:\\s*\"([^\"]*)\"", "m").exec(spec);
  return found === null ? null : (found[1] as string);
}

/**
 * Liet ke cac khoa o CAP CAO NHAT cua mot doi tuong literal.
 * Nhan: obj — van ban doi tuong (bat dau bang "{").
 * Tra: mang ten khoa theo thu tu xuat hien.
 */
function topLevelKeys(obj: string): string[] {
  const open = obj.indexOf("{");
  const { args } = splitArgs(obj, open);
  const out: string[] = [];
  for (const arg of args) {
    const found = /^["']?([A-Za-z_$][\w$]*)["']?\s*:/.exec(arg.trim());
    if (found !== null) out.push(found[1] as string);
  }
  return out;
}

/**
 * Cat mot ham cap cao nhat (theo ten) ra khoi van ban artifact, theo phep dem ngoac.
 * Nhan: code — van ban artifact; signature — dong khai bao nguyen van.
 * Tra: van ban ham (ke ca dong khai bao).
 */
function functionText(code: string, signature: string): string {
  const at = code.indexOf(signature);
  if (at < 0) throw new Error("khong thay ham: " + signature);
  const open = code.indexOf("{", at);
  const { end } = splitArgs(code, open);
  return code.slice(at, end + 1);
}

/** Bo ghi cua context gia. */
interface Recorder {
  /** Ten slot da inject, theo thu tu. */
  injected: string[];
  /** Cac lan register kem ca hai tham so. */
  registered: { spec: Record<string, unknown>; component: unknown }[];
  /** Nhan hieu ung vong doi. */
  effects: string[];
}

/**
 * Store gia dung HOP DONG cua @deepseek-ai/dsh-client-store: kho + create() ra the hien DAY DU.
 * Nhan: definition — { init, actions }.
 * Tra: handle co getSnapshot / subscribe / actions / create nhu ban that.
 */
function fakeDefineStore(definition: { init: () => unknown; actions?: Record<string, (draft: any, ...rest: any[]) => void> }): any {
  const listeners = new Set<() => void>();
  let current: any = definition.init();
  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };
  const actions: Record<string, (...rest: any[]) => any> = {};
  for (const [name, fn] of Object.entries(definition.actions ?? {})) {
    actions[name] = (...rest: any[]) => {
      const draft = { ...current };
      fn(draft, ...rest);
      current = draft;
      notify();
      return current;
    };
  }
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const instance = { getSnapshot: () => current, subscribe, actions };
  return { getSnapshot: () => current, subscribe, actions, create: () => instance };
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
      Fragment: "Fragment",
      createElement: (type: unknown, props: unknown): unknown => ({ type, props }),
      memo: (component: unknown) => component,
      useCallback: (fn: unknown) => fn,
      useId: () => "id",
      useEffect: () => undefined,
      useLayoutEffect: () => undefined,
      useMemo: (factory: () => unknown) => factory(),
      useRef: (initial: unknown) => ({ current: initial }),
      useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, () => undefined],
    };
  }
  if (spec === "react-dom") return { createPortal: (children: unknown) => children };
  if (spec === "zod") return { z: zodChain };
  if (spec === "@deepseek-ai/cordis") return { Service: class Service { constructor(..._args: unknown[]) {} } };
  if (spec .endsWith("-client-store")) {
    return {
      defineStore: fakeDefineStore,
      createSnapshotStore: (initial: unknown) => {
        let value = initial;
        const listeners = new Set<() => void>();
        return {
          getSnapshot: () => value,
          set: (next: unknown) => {
            value = next;
            for (const listener of [...listeners]) listener();
          },
          subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        };
      },
      notifySubscribers: (listeners: Set<() => void>) => {
        for (const listener of [...listeners]) listener();
      },
    };
  }
  return moduleOf([]);
}

/**
 * zod gia: moi thuoc tinh deu tra ve chinh no, goi duoc nhu ham — du cho mat khai bao schema
 * o cap cao nhat (referenceSchema / commandSchema / snapshotSchema cua bundle goc).
 * Nhan: khong.
 * Tra: doi tuong gia tu tai sinh.
 */
const zodChain: any = new Proxy(function zodStub(): unknown {
  return zodChain;
} as any, {
  get: (_target, key) => (key === "then" ? undefined : zodChain),
  apply: () => zodChain,
});

/**
 * Module gia: moi thuoc tinh truy cap ra deu la mot chuoi (du cho mat khai bao).
 * Nhan: names — ten cac thuoc tinh can co.
 * Tra: doi tuong gia.
 */
function moduleOf(names: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of names) out[name] = name;
  return new Proxy(out, { get: (target, key) => (key in target ? target[key as string] : String(key)) });
}

/** Mat plugin ma bang module tra ve. */
interface LoadedPlugin {
  /** Seam can co. */
  inject?: readonly string[];
  /** Than plugin. */
  apply: (ctx: unknown, config?: unknown) => void;
  /** Toan bo mat khai bao cua module. */
  exports: Record<string, unknown>;
}

/**
 * Chay mot bundle client dang ky kieu window.__ModuleLoader__.load trong window gia.
 * Nhan: code — van ban bundle.
 * Tra: danh sach dang ky va mat plugin cua lan dang ky dau.
 */
function loadBundle(code: string): { registrations: { id: string }[]; plugin: LoadedPlugin } {
  const registrations: { id: string }[] = [];
  const captured: { factory?: (requireFn: (spec: string) => unknown) => Record<string, unknown> } = {};
  new Function("window", code)({ __ModuleLoader__: { load: (reg: any) => { registrations.push(reg); captured.factory = reg.factory; } } });
  const factory = captured.factory;
  if (factory === undefined) throw new Error("bundle khong dang ky module nao");
  const exports = factory(fakeRequire);
  return { registrations, plugin: { ...(exports as unknown as LoadedPlugin), exports } };
}

describe("row ui-conversation — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc", () => {
    const code = artifact();
    // 22/10/2026 (task-220): artefact de-bundle dat `id:` xuong dong rieng ⇒ regex phai chiu duoc xuong dong.
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{\s*\n?\s*id:\s*("(?:[^"\\]|\\.)*")/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_PACKAGE_NAME);
    // Luat cua nghiem thu: khong mot chuoi 'id: "@deepseek-ai' nao trong artifact.
    expect(/id: "@deepseek-ai/.test(code)).toBe(false);
    expect((code.match(/id: "@galaxy-blackhole\//g) ?? []).length).toBe(1);
    expect(MODULE_IDS).toEqual([PACKAGE_NAME]);
    expect(PACKAGE_ALIASES).toEqual([STOCK_PACKAGE_NAME]);
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      dsh: { client: { inject: string[] } };
      gbh: { row: { id: string; moduleIds: string[]; aliases: string[]; tests: string[] } };
    };
    expect(meta.gbh.row.id).toBe("ui-conversation");
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toEqual([STOCK_PACKAGE_NAME]);
    expect(meta.gbh.row.tests).toEqual(["tests/client/ui-conversation.test.ts"]);
    // dsh.client.inject giu NGUYEN VAN danh sach cua ban goc.
    const stockMeta = JSON.parse(readFileSync(join(OURS, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-conversation", "package.json"), "utf8")) as { dsh: { client: { inject: string[] } } };
    // 22/10/2026 (task-220): inject cua ta dung id GBH ⇒ so theo VAI (bo tien to) nhu cac test khac.
    const vai = (id: string): string => id.replace("@galaxy-blackhole/gbh-", "").replace("@deepseek-ai/dsh-", "");
    expect(meta.dsh.client.inject.map(vai)).toEqual(stockMeta.dsh.client.inject.map(vai));
  });

  test("tap slot cua ta = TAP slot cua bundle goc (dung chinh hai regex cua check:rows)", () => {
    const stock = readFileSync(STOCK, "utf8");
    const stockSlots = [...slotNames(stock)].sort();
    const ourSlots = [...slotNames(readAllSrcTs())].sort();
    expect(ourSlots).toEqual(stockSlots);
    expect(ourSlots).toEqual([...DECLARED_SLOTS].sort());
    expect(ourSlots.length).toBe(9);
  });

  test("artifact cung co DUNG tap slot do — khong chi file nguon", () => {
    const fromArtifact = [...slotNames(artifact())].sort();
    expect(fromArtifact).toEqual([...slotNames(readFileSync(STOCK, "utf8"))].sort());
  });
});

describe("row ui-conversation — mat plugin va muoi ba dang ky", () => {
  test("dang ky DU MUOI BA lan (11 register + 2 registerFactory) va NAM lan inject, nguyen van", () => {
    const calls = slotCalls(artifact());
    const registers = calls.filter((call) => call.method !== "inject");
    const injects = calls.filter((call) => call.method === "inject");
    expect(registers.length).toBe(13);
    expect(registers.filter((call) => call.method === "register").length).toBe(11);
    expect(registers.filter((call) => call.method === "registerFactory").length).toBe(2);
    expect(injects.length).toBe(5);
    // Ten slot LITERAL trong register({ name: "…" }) va inject("<ten>").
    const registeredNames = registers.map((call) => specField(call.args[0] as string, "name"));
    expect(registeredNames).toEqual(SLOT_REGISTRATIONS.map((entry) => entry.name));
    expect(registeredNames).not.toContain(null);
    expect(injects.map((call) => JSON.parse(call.args[0] as string) as string)).toEqual([...SLOT_INJECTIONS]);
    // Ten slot cua MUOI MOT lan register phai la chuoi LITERAL, khong qua hang so.
    for (const name of registeredNames) expect(SLOT_NAMES_LITERALS.has(name as string)).toBe(true);
  });

  test("component la THAM SO THU HAI cua moi lan register/registerFactory", () => {
    const registers = slotCalls(artifact()).filter((call) => call.method !== "inject");
    const components = registers.map((call) => (call.args[1] ?? "").trim());
    expect(components).toEqual([
      "QueueDock",
      "TodoDock",
      "UserText",
      "PlainUserText",
      "SessionReference",
      "EnterBehaviorRow",
      "ConversationRoot",
      "ConversationContent",
      "ConversationSession",
      "ConversationHeader",
      "ConversationSessionHeader",
      "InputBar",
      "ConversationPanel",
    ]);
    for (const component of components) expect(/^[A-Za-z_$][\w$]*$/.test(component)).toBe(true);
  });

  test("slot list co id NGUYEN VAN, slot keyed co key NGUYEN VAN", () => {
    const registers = slotCalls(artifact()).filter((call) => call.method !== "inject");
    const withId = registers.filter((call) => specField(call.args[0] as string, "id") !== null);
    expect(withId.map((call) => specField(call.args[0] as string, "id"))).toEqual(["queue", "todo", SETTINGS_ENTRY_ID]);
    const withKey = registers.filter((call) => specField(call.args[0] as string, "key") !== null);
    expect(withKey.map((call) => specField(call.args[0] as string, "key"))).toEqual(["text", "session", MAIN_SLOT_KEY]);
    expect(SLOT_REGISTRATIONS.filter((entry) => entry.key !== undefined).map((entry) => entry.key)).toEqual(["text", "session", MAIN_SLOT_KEY]);
    expect(SLOT_REGISTRATIONS.filter((entry) => entry.id !== undefined).map((entry) => entry.id)).toEqual(["queue", "todo", SETTINGS_ENTRY_ID]);
  });

  test("KEYED: key cua slot = id cua dinh nghia nut van ban ma bo danh gia sinh ra", () => {
    const code = artifact();
    // Bo danh gia sinh nut voi id "text" (textNode/replacement) va "session" (sessionReferenceRule).
    const textNode = functionText(code, "function textNode(text, start, end) {");
    const sessionRule = functionText(code, "const sessionReferenceRule = {");
    expect(specField(textNode, "id")).toBe("text");
    expect(specField(sessionRule, "id")).toBe("session");
    const keys = slotCalls(code)
      .filter((call) => call.method !== "inject" && specField(call.args[0] as string, "name") === "conversation.user.text.node")
      .map((call) => specField(call.args[0] as string, "key"));
    // Lech mot trong hai ⇒ renderer roi vao fallback "khong kha dung" ma KHONG co loi console.
    expect(keys).toEqual([...USER_TEXT_NODE_KEYS]);
    expect(keys).toEqual([specField(textNode, "id"), specField(sessionRule, "id")]);
  });

  test("mat plugin: apply la ham, inject liet ke bay service nguyen van cua ban goc", () => {
    const art = artifact();
    const ours = loadBundle(art).plugin;
    const stock = loadBundle(readFileSync(STOCK, "utf8")).plugin;
    expect(typeof ours.apply).toBe("function");
    expect(Object.keys(ours.exports).sort()).toEqual(Object.keys(stock.exports).sort());
    expect([...(ours.inject ?? [])]).toEqual([...(stock.inject ?? [])]);
    expect([...(ours.inject ?? [])]).toEqual([
      "slots",
      "sessions",
      "fileUpload",
      "uiSession",
      "uiWorkspace",
      "locale",
      "configForms",
    ]);
  });

  test("PRIMITIVE: tap primitive ta dung ⊆ tap primitive ban goc dung", () => {
    const pattern = /_deepseek_ai_dsh_client_ui_primitives\.([A-Za-z0-9_$]+)/g;
    const namesOf = (text: string): string[] => [...new Set([...text.matchAll(pattern)].map((m) => m[1] as string))].sort();
    const ours = namesOf(artifact());
    const theirs = namesOf(readFileSync(STOCK, "utf8"));
    expect(ours.length).toBeGreaterThan(0);
    expect(ours.filter((name) => !theirs.includes(name))).toEqual([]);
    expect(ours).toEqual(theirs);
  });

  test("canon de-bundle: KHONG con khoi cong chan rieng (B = A + Δid)", () => {
    // 22/10/2026 (task-220): goi da duoc de-bundle thanh LAT NGUYEN VAN cua bundle goc, nen khoi
    // "CONG CHONG CAI HAI LAN" cua ban viet tay cu KHONG con; artefact phai bang goc sau khi bo tu dien vi.
    const code = boTuDienVi(artifact());
    expect(code.includes("CONG CHONG CAI HAI LAN")).toBe(false);
    expect(code.includes("let uiConversationInstalled = false;")).toBe(false);
    // Van dung MOT loi goi loader mang id cua ta.
    expect((code.match(/__ModuleLoader__\.load\(/g) ?? []).length).toBe(1);
  });

  test("cong chan: lan chay HONG khong bat co ⇒ lan sau van thu lai", () => {
    const plugin = loadBundle(artifact()).plugin;
    const warnings: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      // ctx toi thieu: applyInner nem ngay (khong co sessions/slots) ⇒ co KHONG duoc bat.
      expect(() => plugin.apply({})).toThrow();
      expect(() => plugin.apply({})).toThrow();
      // Neu co bi bat truoc applyInner thi lan thu hai da thoat im lang (chi con console.warn).
      expect(warnings.length).toBe(0);
    } finally {
      console.warn = original;
    }
  });
});

describe("row ui-conversation — hop dong STORE cap cho slot cua goi khac", () => {
  test("store cua hai slot session/session.header la the hien DAY DU (getSnapshot/subscribe/actions)", () => {
    const code = artifact();
    // Store duoc dung chung cho ca hai slot, va la ket qua cua defineStore (khong phai object tho).
    expect((code.match(/store: conversationStore/g) ?? []).length).toBe(2);
    const fn = functionText(code, "function createConversationStore() {");
    expect(code.includes('const CONVERSATION_STORE_KEY = "dsh.conversation";')).toBe(true);
    // Than ham NGUYEN VAN cua ban goc — chay voi module namespace gia cua @deepseek-ai/dsh-client-store.
    const factory = new Function("_deepseek_ai_dsh_client_store", "CONVERSATION_STORE_KEY", "return (" + fn + ");")({ defineStore: fakeDefineStore }, "dsh.conversation") as () => any;
    const handle = factory();
    expect(typeof handle.create).toBe("function");
    const instance = handle.create("session-1");
    // Thieu mot trong ba ⇒ TypeError: w.getSnapshot is not a function ⇒ CA thanh ben khong render.
    expect(typeof instance.getSnapshot).toBe("function");
    expect(typeof instance.subscribe).toBe("function");
    expect(typeof instance.actions).toBe("object");
    const snapshot = instance.getSnapshot();
    expect(Object.keys(snapshot).sort()).toEqual(["draft", "view", "viewRequest"]);
    expect(snapshot.viewRequest).toBeNull();
    const seen: number[] = [];
    const unsubscribe = instance.subscribe(() => seen.push(1));
    expect(typeof unsubscribe).toBe("function");
    instance.actions.setDraft("draft text");
    instance.actions.setView("chat");
    instance.actions.openView("chat", "focus-1");
    expect(seen.length).toBeGreaterThan(0);
    expect(instance.getSnapshot().draft).toBe("draft text");
    expect(instance.getSnapshot().viewRequest).toEqual({ view: "chat", focus: "focus-1" });
    instance.actions.completeViewRequest();
    expect(instance.getSnapshot().viewRequest).toBeNull();
    unsubscribe();
  });

  test("moi mat inject cua muoi ba slot deu la ham, va hook tra ve la the hien day du", () => {
    const code = artifact();
    const specs = slotCalls(code)
      .filter((call) => call.method !== "inject")
      .map((call) => call.args[0] as string);
    const withInject = specs.filter((spec) => topLevelKeys(spec).includes("inject"));
    // BAY spec khai inject o cap cao nhat: queue dock · conversation.user.text · settings.general.item ·
    // conversation.content · conversation.session · conversation.session.header · conversation.composer.bar.
    // (todo dock khong khai inject — ban goc cung vay.)
    expect(withInject.length).toBe(7);
    // Moi mat inject phai la MOT HAM (vo that goi no theo sessionId)…
    for (const spec of withInject) expect(/inject\s*:\s*\(/.test(spec) || /inject\s*:\s*function/.test(spec)).toBe(true);
    // …va sau trong bay mat tra ve doi tuong co khoa hooks — mat ma renderer doc truc tiep.
    expect(withInject.filter((spec) => spec.includes("hooks:")).length).toBe(6);
  });
});

describe("row ui-conversation — parity voi bundle goc", () => {
  test("canon de-bundle: chuanHoaArtefact(ta) ⇒ TRUNG TUNG BYTE bundle goc", () => {
    // 22/10/2026 (task-220): dùng helper CHUNG của repo (bỏ từ điển vi + quy brand + quy id gói),
    // không tự viết bản chuẩn hoá riêng trong test.
    // Header 5 dòng bắt buộc của repo nằm TRƯỚC bundle ⇒ cắt tới mốc loader rồi mới chuẩn hoá/so byte.
    const than = (text: string): string => {
      const moc = text.indexOf("window.__ModuleLoader__.load(");
      return moc <= 0 ? text : text.slice(moc);
    };
    // Sau khi bỏ khối vi, dòng //#endregion bị thụt thêm một cấp ⇒ đưa về đúng thụt lề của bản gốc.
    const noiDangKy = String.fromCharCode(10) + String.fromCharCode(9).repeat(4) + "zh," + String.fromCharCode(10) + String.fromCharCode(9).repeat(4) + "en" + String.fromCharCode(10) + String.fromCharCode(9).repeat(3) + "})";
    const ours = chuanHoaArtefact(than(artifact()), PACKAGE_NAME, STOCK_PACKAGE_NAME)
      .replace(/\n\t{3,}\/\/#endregion/gu, String.fromCharCode(10) + String.fromCharCode(9) + String.fromCharCode(9) + "//#endregion")
      .split("ctx.locale.register(NS, { zh, en })")
      .join("ctx.locale.register(NS, {" + noiDangKy);
    const stock = readFileSync(STOCK, "utf8");
    if (ours !== stock) {
      const limit = Math.min(ours.length, stock.length);
      let at = 0;
      while (at < limit && ours[at] === stock[at]) at += 1;
      console.log("byte: ta", ours.length, "· goc", stock.length, "· lech o", at);
      console.log("ta :", JSON.stringify(ours.slice(Math.max(0, at - 80), at + 80)));
      console.log("goc:", JSON.stringify(stock.slice(Math.max(0, at - 80), at + 80)));
    }
    expect(ours).toBe(stock);
  });

  test("muoi module CSS TRUNG KHOP TUNG BYTE voi chuoi CSS trong bundle goc", () => {
    const stockText = readFileSync(STOCK, "utf8");
    const stockCss = [...stockText.matchAll(/^\t\tconst css(?:\$\d+)? = (".*");$/gm)].map((m) => JSON.parse(m[1] as string) as string);
    const ourCss = CSS_REPLACEMENTS.map((item) => cssBody(item.file));
    expect(STYLE_MODULES.length).toBe(10);
    expect(ourCss.length).toBe(10);
    expect(stockCss.length).toBe(10);
    expect([...ourCss].sort()).toEqual([...stockCss].sort());
    const code = artifact();
    for (const item of CSS_REPLACEMENTS) expect(code.includes(item.placeholder)).toBe(false);
    // Tien to hash lop giu nguyen: khong doi mot ky tu CSS nao.
    expect(cssBody("styles/UserText.module.css")).toContain(".BNl2La_root");
  });

  test("namespace tu dien giu nguyen van ban goc", () => {
    expect(LOCALE_NAMESPACE).toBe("conversation");
    expect(artifact()).toContain('const NS = "conversation";');
  });
});

/** Muoi mot ten slot LITERAL xuat hien trong register({ name: "…" }) cua artifact. */
const SLOT_NAMES_LITERALS = new Set<string>([
  "conversation.input.dock",
  "conversation.user.text",
  "conversation.user.text.node",
  "settings.general.item",
  "main.conversation",
  "conversation.content",
  "conversation.session",
  "conversation.header",
  "conversation.session.header",
  "conversation.composer.bar",
  "main",
]);
