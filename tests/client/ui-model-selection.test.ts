/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test row ui-model-selection (HAI NUA): nua host giu nguyen 1:1 · exports["./client"] + lib/client.js
 *      MOT id cua ta · build.ts >=2 Bun.build · dsh.client deep-equal ban goc · slot conversation.input.model
 *      · tu dien + CSS + vung partial-json nguyen van · bundle THAT chay trong loader gia (dang ky du tu dien/lenh/slot)
 */

import { describe, expect, test } from "bun:test";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { NS, PACKAGE_NAME, SLOT_MODEL } from "../../packages/client/ui-model-selection/src/ids.ts";
import { en, zh } from "../../packages/client/ui-model-selection/src/locales.ts";

/** Thu muc goc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Goi cua ta. */
const OURS = join(REPO, "packages", "client", "ui-model-selection");
/** Goi goc trong kernel (CHI DOC) — oracle cua moi phep so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-model-selection");
/** Ban build nua host cua ban goc. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Ban build nua client cua ban goc (oracle cua chuoi tu dien + CSS). */
const STOCK_CLIENT = join(STOCK_DIR, "lib", "client.js");
/** Cordis THAT cua kernel — can Context that de phep A/B co nghia. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Ten package GOC — chi duoc xuat hien o test/README, KHONG duoc co trong artifact. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-model-selection";

/**
 * Rut tap ten export tu mot artifact ESM (dang `export { a, b as c };`).
 * Nhận: text — noi dung file build.
 * Trả: tap ten export (da bo alias, giu ten cong khai).
 */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const alias = part.trim().split(/\s+as\s+/);
      const name = (alias[1] ?? alias[0] ?? "").trim();
      if (name !== "") out.add(name);
    }
  }
  return [...out].sort();
}

/** Hinh dang toi thieu cua cordis ma phep A/B can. */
interface CordisModule {
  /** Context that (fiber goc). */
  Context: new () => Record<string, unknown>;
}

describe("ui-model-selection — nua host 1:1 (KHONG doi)", () => {
  test("artifact nua host CHI export apply, giong het ban goc; than ham RONG y ban goc", () => {
    const oursText = readFileSync(join(OURS, "lib", "index.js"), "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["apply"]);
    expect(oursText).toContain("function apply() {}");
    expect(stockText).toContain("function apply() {}");
    // Nua host KHONG duoc cham bootstrap/module-loader.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText).not.toContain("__DSH_BOOT__");
  });

  test("A/B tren Context THAT: hai ban deu khong nem, tra undefined, khong doi be mat context (ke ca khi goi hai lan)", async () => {
    const cordis = (await import(CORDIS)) as CordisModule;
    const ours = (await import(join(OURS, "lib", "index.js"))) as { apply: () => unknown };
    const stock = (await import(STOCK)) as { apply: () => unknown };
    for (const candidate of [ours, stock]) {
      const ctx = new cordis.Context();
      const before = Object.keys(ctx).sort();
      expect(candidate.apply()).toBeUndefined();
      expect(Object.keys(ctx).sort()).toEqual(before);
      // Idempotent: goi lan hai van khong nem, khong doi be mat.
      expect(candidate.apply()).toBeUndefined();
      expect(Object.keys(ctx).sort()).toEqual(before);
    }
  });
});

describe("ui-model-selection — BỘ BA + LUẬT MỘT-ID (manifest hai nửa)", () => {
  /** Metadata package.json cua ta. */
  interface Meta {
    name: string;
    exports: Record<string, string>;
    dsh?: { client?: { inject?: string[]; platform?: string } };
    gbh?: { draft?: string; tests?: string[]; row?: unknown };
  }
  const oursMeta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as Meta;
  const stockMeta = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as Meta;

  test("exports['./client'] = './lib/client.js' va dsh.client DEEP-EQUAL ban goc (platform + inject nguyen thu tu)", () => {
    expect(oursMeta.name).toBe(PACKAGE_NAME);
    expect(oursMeta.exports["./client"]).toBe("./lib/client.js");
    expect(existsSync(join(OURS, "src", "client.ts"))).toBe(true);
    // Deep-equal CA HAI truong: inject (thu tu) + platform.
    expect(sameAfterIdMap(oursMeta.dsh?.client, stockMeta.dsh?.client)).toBe(true);
    // 20/10/2026 — hướng "đổi thương hiệu + rewrite id": inject của ta mang id GBH CÓ CHỦ ĐÍCH.
    expect(sameAfterIdMap(oursMeta.dsh?.client?.inject, [
      "@deepseek-ai/dsh-api-session-controller",
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-ui-commands",
      "@deepseek-ai/dsh-api-remotes",
    ])).toBe(true);
    expect(oursMeta.dsh?.client?.platform).toBe("web");
    // 19/10/2026 (Lead FLIP sau boot-smoke): đọc TRẠNG THÁI TỪ MANIFEST — row có mặt với id đúng, hoặc còn park
    // qua `row_unmounted_ly_do.row`. Không kỳ vọng cứng trạng thái park.
    const declared = (oursMeta.gbh as { row?: { id?: string }; row_unmounted_ly_do?: { row?: { id?: string } } });
    const row = declared?.row ?? declared?.row_unmounted_ly_do?.row;
    expect(row?.id).toBe("ui-model-selection");
    expect(typeof oursMeta.gbh?.draft).toBe("string");
    expect(oursMeta.gbh?.tests).toEqual(["tests/client/ui-model-selection.test.ts"]);
  });

  test("lib/client.js TON TAI, dang ky DUNG MOT id CUA TA qua __ModuleLoader__.load, va grep id stock = 0", () => {
    const artifact = join(OURS, "lib", "client.js");
    expect(existsSync(artifact)).toBe(true);
    const text = readFileSync(artifact, "utf8");
    const loads = [...text.matchAll(/__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(loads).toEqual([PACKAGE_NAME]);
    // LUAT MOT-ID: khong con id stock trong artifact (ke ca chunk / tag CSS / dataset.plugin).
    expect(text.split(STOCK_NAME).length - 1).toBe(0);
    // Artifact la script classic (IIFE), khong phai ESM.
    expect(text.trimEnd().endsWith("})();")).toBe(true);
    expect(text).not.toContain("export {");
  });

  test("build.ts co >=2 loi goi Bun.build (host + client) va build ca hai nua ra lib/", () => {
    const buildText = readFileSync(join(OURS, "build.ts"), "utf8");
    const calls = [...buildText.matchAll(/Bun\.build\s*\(/g)].length;
    expect(calls).toBeGreaterThanOrEqual(2);
    // Hai entrypoint khac nhau: src/index.ts (host) va src/client.ts (client).
    expect(buildText).toContain('"index.ts"');
    expect(buildText).toContain('"client.ts"');
    expect(existsSync(join(OURS, "lib", "index.js"))).toBe(true);
    expect(existsSync(join(OURS, "lib", "client.js"))).toBe(true);
  });
});

describe("ui-model-selection — hop dong noi dung nua client", () => {
  const stockClientText = readFileSync(STOCK_CLIENT, "utf8");

  test("slot: ban goc va ta cung dang ky DUY NHAT conversation.input.model (khong co slot thu hai)", () => {
    expect(SLOT_MODEL).toBe("conversation.input.model");
    expect(stockClientText).toContain(SLOT_MODEL);
    const stockSlots = [...stockClientText.matchAll(/slots\.register\(\{\s*name:\s*"([^"]+)"/g)].map((m) => m[1]);
    const ourPlugin = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    const ourSlots = [...ourPlugin.matchAll(/slots\.register\(/g)].length;
    expect(stockSlots).toEqual(["conversation.input.model"]);
    // Dung MOT loi goi register trong nua client cua ta. 19/10/2026: đăng ký dùng CHUỖI LITERAL
    // "conversation.input.model" (không dùng hằng SLOT_MODEL) để "check:rows" quét văn bản src thấy slot.
    expect(ourSlots).toBe(1);
    expect(ourPlugin).toContain('scope.slots.inject("conversation.input.model"');
  });

  test("tu dien zh/en NGUYEN VAN tung khoa tung chuoi so voi bundle goc; CSS module nguyen van tung byte", () => {
    expect(zh["provider.account"]).toBe("DeepSeek 账号");
    expect(en["provider.account"]).toBe("DeepSeek Account");
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const dictionary of [en, zh]) {
      for (const [key, value] of Object.entries(dictionary)) {
        const needle = JSON.stringify(key) + ": " + JSON.stringify(value);
        expect(stockClientText).toContain(needle);
      }
    }
    const cssFile = readFileSync(join(OURS, "src", "ModelSelect.module.css"), "utf8");
    const cssBody = cssFile.slice(cssFile.indexOf("*/") + 2).trim();
    expect(cssBody.startsWith("._7KE1Ra_root{")).toBe(true);
    expect(stockClientText).toContain(cssBody);
  });

  test("vùng partial-json port NGUYÊN VĂN: tệp ≤1000 dòng, 12 phương thức đọc, không id stock, artifact phủ lớp", () => {
    const region = join(OURS, "src", "partial-json.ts");
    expect(existsSync(region)).toBe(true);
    const text = readFileSync(region, "utf8");
    expect(text.split("\n").length).toBeLessThanOrEqual(1000);
    expect(text.split(STOCK_NAME).length - 1).toBe(0);
    // Region ke tiep (values/index.ts) nam cung factory o ban goc — import tuong minh de dung pham vi ten.
    expect(text).toContain("assertNever");
    for (const method of [
      "append(",
      "settle(",
      "refresh(",
      "closed(",
      "keys(",
      "has(",
      "complete(",
      "stringLength(",
      "stringExceeds(",
      "text(",
      "textPrefix(",
      "value(",
    ]) {
      expect(text).toContain(method);
    }
    // Mã chết trong bundle gốc nhưng vẫn nằm trong artifact: import tác dụng phụ ở src/client.ts.
    expect(readFileSync(join(OURS, "lib", "client.js"), "utf8")).toContain("PartialArguments");
  });

  test("bundle THAT chay trong loader gia: tu dien + plugin + /model + MOT slot, va tag CSS mang id CUA TA", async () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const loadedIds: string[] = [];
    let factory: ((requireFn: (id: string) => unknown) => unknown) | undefined;
    const styleTags: { dataset: Record<string, string>; textContent: string }[] = [];
    const windowStub = {
      __ModuleLoader__: {
        load: (entry: { id: string; factory: typeof factory }) => {
          loadedIds.push(entry.id);
          factory = entry.factory;
        },
      },
    };
    const documentStub = {
      querySelector: () => null,
      createElement: () => {
        const tag = { dataset: {} as Record<string, string>, textContent: "" };
        styleTags.push(tag);
        return tag;
      },
      head: { appendChild: () => undefined },
    };
    new Function("window", "document", code)(windowStub, documentStub);
    expect(loadedIds).toEqual([PACKAGE_NAME]);
    if (factory === undefined) throw new Error("bundle khong goi __ModuleLoader__.load");
    const exports = factory(moduleStub()) as {
      ModelDirectory: new (...args: unknown[]) => unknown;
      ModelDirectoryResolver: new (ctx: unknown) => { directoryFor(id: string): DirectoryStub };
      apply: (ctx: unknown) => void;
      inject: readonly string[];
    };
    // Ten export NGUYEN VAN cua ban goc.
    expect(Object.keys(exports).sort()).toEqual(["ModelDirectory", "ModelDirectoryResolver", "apply", "inject"]);
    expect(exports.inject).toEqual(["commandUi", "locale", "sessions", "slots", "remote", "remote.session"]);
    // Tag CSS: tagId + dataset.plugin deu la id CUA TA.
    expect(styleTags.length).toBe(1);
    expect(styleTags[0]?.dataset.plugin).toBe(PACKAGE_NAME);
    expect(styleTags[0]?.dataset.pluginCss).toBe(PACKAGE_NAME + "/ModelSelect.module.css");
    expect(styleTags[0]?.textContent).toContain("._7KE1Ra_root{");

    const harness = makeContext();
    exports.apply(harness.ctx);
    expect(harness.dictionaries.map((entry) => entry.namespace)).toEqual([NS]);
    expect(harness.plugins).toEqual([exports.ModelDirectoryResolver]);
    expect(harness.commands.length).toBe(1);
    expect(harness.commands[0]?.name).toBe("model");
    expect(harness.slotRegistrations.length).toBe(1);
    expect(harness.slotRegistrations[0]?.spec.name).toBe(SLOT_MODEL);
    expect(harness.slotRegistrations[0]?.spec.locale).toBe(NS);
    // Nghiep vu tiem vao slot: available + store + load + select.
    const injected = (harness.slotRegistrations[0]?.spec.inject as (id: string) => Record<string, unknown>)("s1");
    expect(injected.available).toBe(true);
    expect(typeof injected.load).toBe("function");
    expect(typeof injected.select).toBe("function");
    // Dich vu that: directoryFor("s1") tra thu muc; load() dua danh muc Host vao store dung chung.
    const resolver = new exports.ModelDirectoryResolver(harness.ctx);
    const directory = resolver.directoryFor("s1");
    await directory.load();
    const snapshot = directory.store.getSnapshot();
    expect(snapshot.status).toBe("ready");
    expect(snapshot.current).toEqual({ provider: "deepseek-account", model: "m1", reasoningEffort: "low" });
    expect(snapshot.routable).toBe(true);
  });
});

/** Store anh chup gia nhung DAY DU bon phuong thuc (giong @deepseek-ai/dsh-client-store). */
interface StoreStub<T> {
  /** Anh chup hien tai. */
  getSnapshot(): T;
  /** Thay anh chup va bao cho nguoi nghe. */
  set(next: T): void;
  /** Sua ban nhap. */
  update(recipe: (draft: T) => void): void;
  /** Nghe thay doi. */
  subscribe(listener: () => void): () => void;
}

/** Thu muc gia ma slot tiem vao (chi phan hop dong). */
interface DirectoryStub {
  /** Store dung chung. */
  store: StoreStub<Record<string, unknown>>;
  /** Nap danh muc. */
  load(): Promise<unknown>;
  /** Gui lua chon. */
  select(selection: unknown): Promise<unknown>;
  /** Vo hieu phan hoi cu. */
  resetConnected(): void;
  /** Don dep. */
  dispose(): void;
}

/**
 * Store anh chup gia.
 * Nhận: initial — gia tri dau.
 * Trả: store gia co du getSnapshot/set/update/subscribe.
 */
function makeStore<T>(initial: T): StoreStub<T> {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const publish = (): void => {
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    set: (next: T) => {
      snapshot = next;
      publish();
    },
    update: (recipe: (draft: T) => void) => {
      recipe(snapshot);
      publish();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Bang module gia: JSX runtime, react, react-dom, primitive, store va cordis.
 * Nhận: khong co.
 * Trả: ham require gia.
 */
function moduleStub(): (id: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown => ({ type, props, key });
  const primitives: Record<string, unknown> = {
    rankByName: <T,>(models: readonly T[]): T[] => [...models],
    observeStickyMenuGroups: () => () => undefined,
  };
  for (const name of [
    "IconCheckOutlineRegular",
    "IconChevronDownOutlineRegular",
    "IconChevronRightOutlineRegular",
    "IconCloseFillRegular",
    "IconDataOutlineRegular",
    "IconWarningOutlineRegular",
    "Input",
    "MenuGroup",
    "MenuSurface",
    "StateDot",
    "Toast",
  ]) {
    primitives[name] = name;
  }
  /** Lop Service gia cua cordis: ghi lai ten dich vu. */
  class ServiceStub {
    /** Context cua fiber. */
    readonly ctx: unknown;
    /** Ten dich vu. */
    readonly name: string;
    /**
     * @param ctx - context cua fiber.
     * @param name - ten dich vu.
     */
    constructor(ctx: unknown, name: string) {
      this.ctx = ctx;
      this.name = name;
    }
  }
  return (id: string): unknown => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (id === "react") {
      return {
        useSyncExternalStore: <T,>(_subscribe: unknown, getSnapshot: () => T): T => getSnapshot(),
        useState: <T,>(initial: T | (() => T)): [T, (next: T) => void] => [
          typeof initial === "function" ? (initial as () => T)() : initial,
          () => undefined,
        ],
        useRef: <T,>(initial: T) => ({ current: initial }),
        useEffect: () => undefined,
        useLayoutEffect: () => undefined,
        useMemo: <T,>(factory: () => T) => factory(),
        useId: () => "r0",
      };
    }
    if (id === "react-dom") return { createPortal: (node: unknown) => node };
    if (id .endsWith("-client-ui-primitives")) return primitives;
    if (id .endsWith("-client-store")) return { createSnapshotStore: <T,>(initial: T) => makeStore(initial) };
    if (id === "@deepseek-ai/cordis") return { Service: ServiceStub };
    throw new Error("module la: " + id);
  };
}

/** Ban ghi cua context gia. */
interface ContextHarness {
  /** Context goc gia. */
  ctx: Record<string, unknown>;
  /** Tu dien da dang ky. */
  dictionaries: { namespace: string; copy: unknown }[];
  /** Plugin da nap. */
  plugins: unknown[];
  /** Lenh da dang ky. */
  commands: Record<string, unknown>[];
  /** Slot da dang ky (kem spec + component). */
  slotRegistrations: { spec: Record<string, unknown>; component: unknown }[];
}

/**
 * Context client gia: chay ngay callback cua effect/inject, ghi lai moi dang ky.
 * Nhận: khong co.
 * Trả: context gia va bo ghi.
 */
function makeContext(): ContextHarness {
  const log: ContextHarness = { ctx: {}, dictionaries: [], plugins: [], commands: [], slotRegistrations: [] };
  const catalog = {
    groups: [
      {
        id: "deepseek-account",
        name: "DeepSeek Account",
        models: [
          {
            id: "m1",
            name: "Model 1",
            reasoning: {
              defaultEffort: "low",
              efforts: [
                { id: "low", name: "Low" },
                { id: "high", name: "High" },
              ],
            },
          },
        ],
      },
    ],
    failures: [],
    default: { provider: "deepseek-account", model: "m1", reasoningEffort: "low" },
  };
  // Projection ben vung cua phien: Host chieu ra lua chon ke tiep (giong faceOf("modelSelection") that).
  const projection = {
    getSnapshot: () => ({ next: { provider: "deepseek-account", model: "m1", reasoningEffort: "low" } }),
    subscribe: () => () => undefined,
  };
  const directory: DirectoryStub = {
    store: makeStore<Record<string, unknown>>({ current: null, status: "idle" }),
    load: async () => undefined,
    select: async () => ({ ok: true, value: undefined }),
    resetConnected: () => undefined,
    dispose: () => undefined,
  };
  const commandFace = {
    register: (contribution: Record<string, unknown>) => {
      log.commands.push(contribution);
      return () => undefined;
    },
  };
  const slotsFace = {
    inject: (_slot: string, run: () => unknown) => {
      run();
    },
    register: (spec: Record<string, unknown>, component: unknown) => {
      log.slotRegistrations.push({ spec, component });
      return () => undefined;
    },
  };
  const scope: Record<string, unknown> = {
    slots: slotsFace,
    modelDirectories: { directoryFor: () => directory },
    sessions: {
      subagentAddress: () => undefined,
      scope: () => ({ effect: () => undefined }),
      binding: () => ({
        session: { projections: { faceOf: () => projection }, getSnapshot: () => ({ blank: true }) },
      }),
      selectModel: async () => ({ ok: true, value: undefined }),
    },
    get: (name: string) => (name === "commandUi" ? commandFace : undefined),
    effect: (run: () => unknown) => {
      run();
      return () => undefined;
    },
    inject: (_deps: readonly string[], run: (inner: unknown) => void) => {
      run(scope);
    },
  };
  log.ctx = {
    ...scope,
    locale: {
      register: (namespace: string, copy: unknown) => {
        log.dictionaries.push({ namespace, copy });
        return () => undefined;
      },
      bind: () => (key: string, params?: Record<string, string | number>) =>
        params === undefined ? key : key + ":" + JSON.stringify(params),
    },
    remote: {
      $on: () => () => undefined,
      session: {
        modelCatalog: async () => ({ ok: true, value: catalog }),
        selectModel: async () => ({ ok: true, value: undefined }),
      },
    },
    on: () => () => undefined,
    plugin: (plugin: unknown) => {
      log.plugins.push(plugin);
    },
    slots: slotsFace,
    modelDirectories: { directoryFor: () => directory },
    sessions: scope.sessions,
    get: scope.get,
    effect: scope.effect,
    inject: scope.inject,
  };
  return log;
}