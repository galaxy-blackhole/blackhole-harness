/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B CHÍNH THỨC nửa CLIENT của row ui-plugin-manager: nạp bundle gốc (oracle, chỉ đọc) và bundle
 *      của ta (build thật bằng build.ts ra /tmp) qua window.__ModuleLoader__, rồi so id · module ngoài · mặt
 *      export · mảng inject · nhật ký apply (slot/từ điển/service) · điều hướng · render icon/toast.
 */

import { describe, expect, test } from "bun:test";
import { chuanHoaArtefact } from "../helpers/vi-dictionary.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildPackage } from "../../packages/client/ui-plugin-manager/build.ts";

/** Thư mục gốc repo (tests/client → repo). */
const REPO = join(import.meta.dir, "..", "..");
/** Gói stock trong kernel (CHỈ ĐỌC) — oracle của phép A/B. */
const STOCK_CLIENT = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-plugin-manager", "lib", "client.js");
/** Gói của ta. */
const OUR_DIR = join(REPO, "packages", "client", "ui-plugin-manager");
/** Thư mục build tạm — KHÔNG ghi vào repo. */
const OUT_DIR = "/tmp/gbh-pm-ab-ui-plugin-manager-client";
/** Tên gói gốc (id module của A). */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-plugin-manager";
/** 8 seam service mà cả hai bản khai trong "inject". */
const INJECT = ["slots", "locale", "remote", "remote.pluginManager", "remote.pluginInventory", "remote.pluginRegistryProbe", "configForms", "layout"];
/** Module ngoài của A, ĐÚNG thứ tự bundle gốc. */
const REQUIRES_A = ["react/jsx-runtime", "react", "react-dom", "@deepseek-ai/dsh-client-ui-primitives", "@deepseek-ai/dsh-client-ui-slots", "@deepseek-ai/dsh-client-store"];
/** Module ngoài của B, ĐÚNG thứ tự "loadModules" của ta. */
const REQUIRES_B = ["react", "react/jsx-runtime", "react-dom", "@deepseek-ai/dsh-client-store", "@deepseek-ai/dsh-client-ui-slots", "@deepseek-ai/dsh-client-ui-primitives", "@deepseek-ai/dsh-api-remotes", "@deepseek-ai/dsh-client-ui-settings", "@deepseek-ai/dsh-client-ui-layout", "@deepseek-ai/dsh-package-manifest", "zod"];
/** 9 slot con của khung "main" — nguyên văn bản gốc. */
const CHILDREN = [["plugins.add.actions", "list", "root"], ["plugins.tab", "list", "root"], ["plugins.item", "list", "root"], ["plugins.bundle.activation", "keyed", "root"], ["plugins.bundle.config", "keyed", "root"], ["plugins.row.config", "keyed", "root"], ["plugins.detail.actions", "list", "root"], ["plugins.detail.badge", "list", "root"], ["plugins.detail.section", "list", "root"]];
/** Chuỗi sự kiện của một lượt apply, đúng thứ tự cả hai bản phải phát ra. */
const KINDS = ["locale.register", "effect", "locale.bind", "effect", "remote.$on", "remote.$on", "remote.$on", "ctx.on", "effect", "configForms.describe", "slots.inject", "slots.register", "slots.inject", "slots.register", "yield", "panelInfo.subscribe", "yield", "reflect.provide", "yield", "slots.inject", "slots.register"];
/** Nhãn ba hiệu ứng vòng đời. */
const EFFECT_LABELS = ["ui-plugin-manager: dictionaries", "ui-plugin-manager: controller", "ui-plugin-manager: host invalidations"];
/** Ba sự kiện Host làm mới danh sách. */
const REMOTE_EVENTS = ["plugin-manager/changed", "plugin-manager/install-log", "plugin-manager/install-state"];
/** Tên ba component đăng ký vào slot. */
const COMPONENTS = ["PluginRefreshToast", "PluginManagerPage", "PluginsPanelIcon"];
/** Khoá từ điển DUY NHẤT hai bản cố ý khác nhau (đổi tên thương hiệu). */
const BRAND_KEY = "installGuideSafety";

/** Một factory bundle classic đăng ký với window.__ModuleLoader__. */
interface BundleSpec { readonly id: string; readonly factory: (requireFn: (specifier: string) => unknown) => unknown }

/** Mặt module factory trả về — hình dạng đọc được của cả A và B. */
interface ClientFace {
  readonly NS?: unknown; readonly PANEL_ID?: unknown; readonly name?: unknown; readonly default?: unknown; readonly apply?: unknown; readonly inject?: unknown;
  readonly [key: string]: unknown;
}

/** Manifest gói ta — nguồn sự thật cho tên/id/alias. */
interface Manifest { readonly name: string; readonly gbh?: { readonly row?: { readonly aliases?: readonly string[] } } }

/** Từ điển hai ngôn ngữ của một namespace. */
interface Dictionaries { readonly zh: Record<string, string>; readonly en: Record<string, string> }

/** Ngôn ngữ giả lập của seam locale. */
type Lang = "en" | "zh";

/** Một mục nhật ký của ctx giả. */
interface LogEntry {
  readonly kind: string; readonly label?: string; readonly event?: string; readonly ns?: string; readonly name?: string;
  readonly id?: unknown; readonly returns?: string; readonly keys?: readonly string[]; readonly value?: unknown;
}

/** Ảnh chụp trạng thái điều hướng của trang. */
interface NavSnapshot { readonly view: { readonly kind: string; readonly name?: string }; readonly tab: string }

/** Instance store điều hướng do defineStore giả cấp. */
interface NavInstance { readonly actions: { setView(view: unknown): void; setTab(tab: string): void }; getSnapshot(): NavSnapshot }

/** Handle store do defineStore giả trả. */
interface StoreHandle { create(): NavInstance }

/** Tuỳ chọn đăng ký occupant (phần test đọc). */
interface RegisterOptions {
  readonly name: string; readonly id?: string; readonly key?: string; readonly order?: number; readonly locale?: string;
  readonly label?: () => string; readonly store?: StoreHandle; readonly inject?: () => Record<string, unknown>;
  readonly children?: Record<string, { readonly kind: string; readonly scope: string }>;
}

/** Một lần đăng ký occupant mà ctx giả ghi lại. */
interface SlotRegister { readonly options: RegisterOptions; readonly component: unknown }

/** Toàn bộ dấu vết một lượt apply để lại trên ctx giả. */
interface Capture {
  readonly log: LogEntry[]; readonly registers: SlotRegister[]; readonly dicts: Map<string, Dictionaries>;
  readonly panelListeners: (() => void)[]; readonly layout: { activePanelId: string | null; readonly selected: (string | null)[] };
  readonly ctx: Record<string, unknown>; setLang(lang: Lang): void;
}

/** Element giả do jsx/jsxs trả — đủ để so cây. */
interface RenderedElement { readonly type: unknown; readonly props: Record<string, unknown>; readonly key?: unknown }

/** Kết quả một lần apply hai lần liên tiếp. */
interface DoubleApply { readonly firstLog: number; readonly secondLog: number; readonly firstRegisters: number; readonly secondRegisters: number; readonly warnings: string[] }

/** Cache primitive giả — DÙNG CHUNG cho A và B để so identity của "type". */
const PRIMITIVES = new Map<string, (props?: Record<string, unknown>) => unknown>();

/** Primitive giả ổn định theo tên. Nhận: name. Trả: component cùng identity mọi lần gọi. */
function primitiveOf(name: string): (props?: Record<string, unknown>) => unknown {
  const cached = PRIMITIVES.get(name);
  if (cached !== undefined) return cached;
  const stub = function Primitive(): unknown {
    return null;
  };
  Object.defineProperty(stub, "name", { value: "Primitive_" + name });
  PRIMITIVES.set(name, stub);
  return stub;
}

/** Bảng primitive giả: mọi tên trả một component ổn định. */
const PRIMITIVE_TABLE: unknown = new Proxy({}, { get: (_target, property) => (typeof property === "string" ? primitiveOf(property) : undefined) });

/** Chuẩn hoá nhãn như resolveSlotLabel của ui-slots. Nhận: label. Trả: chuỗi hoặc undefined. */
function resolveSlotLabel(label: unknown): string | undefined {
  if (typeof label === "string") return label;
  if (typeof label === "object" && label !== null) {
    const record = label as { readonly en?: unknown; readonly zh?: unknown };
    const value = record.en ?? record.zh;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/** Store ảnh chụp giả. Nhận: initial. Trả: object getSnapshot/subscribe/setSnapshot/patch. */
function createSnapshotStore(initial: unknown): unknown {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSnapshot: (next: unknown) => {
      snapshot = next;
      notify();
    },
    patch: (partial: Record<string, unknown>) => {
      snapshot = { ...(snapshot as Record<string, unknown>), ...partial };
      notify();
    },
  };
}

/** defineStore giả đủ chạy thật. Nhận: definition (init + actions). Trả: handle có create(). */
function defineStore(definition: { init(): Record<string, unknown>; actions: Record<string, (draft: Record<string, unknown>, ...args: unknown[]) => void> }): StoreHandle {
  let instance: NavInstance | undefined;
  return {
    create(): NavInstance {
      if (instance === undefined) {
        const draft = definition.init();
        let snapshot = { ...draft } as unknown as NavSnapshot;
        const run = (action: string, ...args: unknown[]): void => {
          const handler = definition.actions[action];
          if (handler === undefined) throw new Error("defineStore giả thiếu action " + action);
          handler(draft, ...args);
          snapshot = { ...draft } as unknown as NavSnapshot;
        };
        instance = {
          actions: { setView: (view: unknown) => run("setView", view), setTab: (tab: string) => run("setTab", tab) },
          getSnapshot: () => snapshot,
        };
      }
      return instance;
    },
  };
}

/** Bảng module ngoài dùng CHUNG cho A và B — cùng identity nên so cây jsx được. */
const MODULES: Record<string, unknown> = {
  react: {
    useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, () => undefined],
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => undefined,
    useLayoutEffect: () => undefined,
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (callback: unknown) => callback,
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
    useReducer: (_reducer: unknown, initial: unknown) => [initial, () => undefined],
    useId: () => "id",
    memo: (component: unknown) => component,
    forwardRef: (component: unknown) => component,
    Fragment: Symbol.for("react.fragment"),
  },
  "react/jsx-runtime": {
    Fragment: Symbol.for("react.fragment"),
    jsx: (type: unknown, props: Record<string, unknown> | null, key?: unknown) => ({ type, props: props ?? {}, key }),
    jsxs: (type: unknown, props: Record<string, unknown> | null, key?: unknown) => ({ type, props: props ?? {}, key }),
    jsxDEV: (type: unknown, props: Record<string, unknown> | null, key?: unknown) => ({ type, props: props ?? {}, key }),
  },
  "react-dom": { createPortal: (children: unknown, container: unknown, key?: unknown) => ({ type: "portal", children, container, key }) },
  "@deepseek-ai/dsh-client-store": { createSnapshotStore, defineStore },
  "@deepseek-ai/dsh-client-ui-slots": { resolveSlotLabel, useSlot: () => null, useSlotEntries: () => [] },
  "@deepseek-ai/dsh-client-ui-primitives": PRIMITIVE_TABLE,
};

/** Cấp require giả, ghi lại id được hỏi. Nhận: seen (mảng nhận id). Trả: hàm require. */
function fakeRequire(seen: string[]): (specifier: string) => unknown {
  return (specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    seen.push(specifier);
    if (Object.hasOwn(MODULES, specifier)) return MODULES[specifier];
    return new Proxy({}, { get: () => () => undefined });
  };
}

/** Chạy bundle classic trong window giả. Nhận: text. Trả: mảng spec __ModuleLoader__.load nhận. */
function loadSpecs(text: string): BundleSpec[] {
  const specs: BundleSpec[] = [];
  const windowShim = { __ModuleLoader__: { load(spec: BundleSpec): void { specs.push(spec); } } };
  const run = new Function("window", text) as (shim: unknown) => unknown;
  run(windowShim);
  return specs;
}

/** Lấy spec DUY NHẤT. Nhận: specs. Trả: spec đầu. @throws khi bundle không gọi load. */
function onlySpec(specs: BundleSpec[]): BundleSpec {
  const first = specs[0];
  if (first === undefined) throw new Error("bundle không gọi __ModuleLoader__.load");
  return first;
}

/** Dựng ctx giả có nhật ký đầy đủ. Nhận: lang. Trả: Capture (ctx + log + đăng ký + từ điển + layout). */
function makeCapture(lang: Lang = "en"): Capture {
  const log: LogEntry[] = [];
  const registers: SlotRegister[] = [];
  const dicts = new Map<string, Dictionaries>();
  const panelListeners: (() => void)[] = [];
  const layout: { activePanelId: string | null; selected: (string | null)[] } = { activePanelId: "plugins", selected: [] };
  let current: Lang = lang;
  let revision = 0;
  const ctx: Record<string, unknown> = {
    effect(callback: () => unknown, label: string): unknown {
      const result = callback();
      log.push({ kind: "effect", label, returns: typeof result });
      return result;
    },
    on(event: string): () => void {
      log.push({ kind: "ctx.on", event });
      return () => undefined;
    },
    locale: {
      register(ns: string, dictionaries: Dictionaries): () => void {
        log.push({ kind: "locale.register", ns });
        dicts.set(ns, dictionaries);
        revision += 1;
        return () => undefined;
      },
      bind(ns: string): (key: string) => string {
        log.push({ kind: "locale.bind", ns });
        return (key: string) => dicts.get(ns)?.[current]?.[key] ?? key;
      },
      resolveText(text: unknown): string {
        if (typeof text === "string") return text;
        if (typeof text === "object" && text !== null) {
          const value = (text as Record<string, unknown>)[current];
          return typeof value === "string" ? value : "";
        }
        return "";
      },
      getSnapshot: () => ({ revision }),
      subscribe: (_listener: () => void) => () => undefined,
    },
    remote: {
      $on(event: string): () => void {
        log.push({ kind: "remote.$on", event });
        return () => undefined;
      },
      pluginManager: {},
      pluginInventory: {},
      pluginRegistryProbe: {},
    },
    slots: {
      inject(name: string, register: () => unknown): void {
        log.push({ kind: "slots.inject", name });
        const result = register();
        const candidate = result as { next?: unknown } | null;
        if (candidate !== null && typeof candidate === "object" && typeof candidate.next === "function") {
          const iterator = result as Iterator<unknown>;
          let step = iterator.next();
          while (step.done !== true) {
            log.push({ kind: "yield", name });
            step = iterator.next();
          }
        }
      },
      register(options: RegisterOptions, component: unknown): undefined {
        log.push({ kind: "slots.register", name: options.name });
        registers.push({ options, component });
        return undefined;
      },
      getVersion: () => 1,
      entries: () => [],
      subscribe: () => () => undefined,
    },
    layout: {
      panelInfo: {
        getSnapshot: () => ({ activePanelId: layout.activePanelId }),
        subscribe(listener: () => void): () => void {
          log.push({ kind: "panelInfo.subscribe" });
          panelListeners.push(listener);
          return () => undefined;
        },
      },
      selectPanel(id: string | null): void {
        log.push({ kind: "layout.selectPanel", id });
        layout.selected.push(id);
      },
    },
    reflect: {
      provide(name: string, value: unknown): () => void {
        const keys = typeof value === "object" && value !== null ? Object.keys(value) : [];
        log.push({ kind: "reflect.provide", name, keys, value });
        return () => undefined;
      },
    },
    configForms: {
      describe(): Record<string, unknown> {
        log.push({ kind: "configForms.describe" });
        return {};
      },
      get: () => undefined,
    },
    get: () => undefined,
  };
  return { log, registers, dicts, panelListeners, layout, ctx, setLang(next: Lang): void { current = next; } };
}

/** Gọi apply với ctx giả. Nhận: face, capture. Trả: giá trị apply trả (cả hai bản đều undefined). */
function applyFace(face: ClientFace, capture: Capture): unknown {
  const apply = face.apply;
  if (typeof apply !== "function") throw new Error("mặt module thiếu apply");
  return (apply as (this: ClientFace, ctx: Record<string, unknown>) => unknown).call(face, capture.ctx);
}

/** Nạp mặt module MỚI rồi apply. Nhận: specs, lang. Trả: { face, capture, requires, applied }. */
function captureApply(specs: BundleSpec[], lang: Lang = "en"): { face: ClientFace; capture: Capture; requires: string[]; applied: unknown } {
  const spec = onlySpec(specs);
  const requires: string[] = [];
  const face = spec.factory(fakeRequire(requires)) as ClientFace;
  const capture = makeCapture(lang);
  const applied = applyFace(face, capture);
  return { face, capture, requires, applied };
}

/** Đếm số lần xuất hiện. Nhận: text, needle. Trả: số lần. */
function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** Từ điển namespace pluginManager. Nhận: capture. Trả: hai bộ zh/en. @throws khi thiếu. */
function dictionariesOf(capture: Capture): Dictionaries {
  const dictionaries = capture.dicts.get("pluginManager");
  if (dictionaries === undefined) throw new Error("không đăng ký namespace pluginManager");
  return dictionaries;
}

/** Một lần đăng ký theo tên slot. Nhận: capture, name. Trả: bản ghi. @throws khi thiếu. */
function registerOf(capture: Capture, name: string): SlotRegister {
  const found = capture.registers.find((entry) => entry.options.name === name);
  if (found === undefined) throw new Error("không đăng ký slot " + name);
  return found;
}

/** Gọi inject của một đăng ký. Nhận: register. Trả: mặt nghiệp vụ. */
function injectOf(register: SlotRegister): Record<string, unknown> {
  const inject = register.options.inject;
  if (inject === undefined) throw new Error("occupant " + register.options.name + " thiếu inject");
  return inject();
}

/** Store của khung main. Nhận: register. Trả: handle store. @throws khi thiếu. */
function storeOf(register: SlotRegister): StoreHandle {
  const store = register.options.store;
  if (store === undefined) throw new Error("main thiếu store");
  return store;
}

/** Nhãn occupant. Nhận: register. Trả: nhãn đã dịch. */
function labelOf(register: SlotRegister): string | undefined {
  const label = register.options.label;
  if (label === undefined) throw new Error("occupant " + register.options.name + " thiếu label");
  return label();
}

/** Tên component occupant. Nhận: register. Trả: tên hàm hoặc kiểu dữ liệu. */
function componentNameOf(register: SlotRegister): string {
  const component = register.component;
  return typeof component === "function" ? component.name : typeof component;
}

/** Children của main thành mảng bộ ba. Nhận: register. Trả: mảng [tên, kind, scope]. */
function childrenOf(register: SlotRegister): string[][] {
  const children = register.options.children;
  if (children === undefined) throw new Error("main thiếu children");
  return Object.entries(children).map(([name, value]) => [name, value.kind, value.scope]);
}

/** Chuỗi sự kiện để so thứ tự A↔B. Nhận: entry. Trả: "loại:định danh". */
function signatureOf(entry: LogEntry): string {
  if (entry.kind === "effect") return "effect:" + String(entry.label);
  if (entry.kind === "remote.$on") return "remote.$on:" + String(entry.event);
  if (entry.kind === "ctx.on") return "ctx.on:" + String(entry.event);
  if (entry.kind === "locale.register") return "locale.register:" + String(entry.ns);
  if (entry.kind === "locale.bind") return "locale.bind:" + String(entry.ns);
  if (entry.kind === "slots.inject") return "slots.inject:" + String(entry.name);
  if (entry.kind === "slots.register") return "slots.register:" + String(entry.name);
  if (entry.kind === "yield") return "yield:" + String(entry.name);
  if (entry.kind === "reflect.provide") return "reflect.provide:" + String(entry.name);
  if (entry.kind === "layout.selectPanel") return "layout.selectPanel:" + String(entry.id);
  return entry.kind;
}

/** Nhãn ba hiệu ứng theo thứ tự. Nhận: capture. Trả: mảng nhãn. */
function effectLabelsOf(capture: Capture): string[] {
  return capture.log.filter((entry) => entry.kind === "effect").map((entry) => String(entry.label));
}

/** Đếm mục nhật ký theo loại. Nhận: capture, kind. Trả: số mục. */
function countKind(capture: Capture, kind: string): number {
  return capture.log.filter((entry) => entry.kind === kind).length;
}

/** Service đã provide theo tên. Nhận: capture, name. Trả: object service. @throws khi thiếu. */
function providedOf(capture: Capture, name: string): Record<string, unknown> {
  const entry = capture.log.find((item) => item.kind === "reflect.provide" && item.name === name);
  const value = entry?.value;
  if (typeof value !== "object" || value === null) throw new Error("không provide service " + name);
  return value as Record<string, unknown>;
}

/** Render toast. Nhận: capture, notice, passNoticeText, injected (tuỳ chọn). Trả: element giả. */
function renderToast(capture: Capture, notice: unknown, passNoticeText: boolean, injected = injectOf(registerOf(capture, "shell.overlay"))): RenderedElement {
  const register = registerOf(capture, "shell.overlay");
  const component = register.component as (props: Record<string, unknown>) => unknown;
  const props: Record<string, unknown> = { usePluginManager: () => notice, dismissNotice: injected.dismissNotice, t: (key: string) => "T:" + key };
  if (passNoticeText) props.noticeText = injected.noticeText;
  return component(props) as RenderedElement;
}

/** Render icon sidebar. Nhận: capture. Trả: element giả. */
function renderIcon(capture: Capture): RenderedElement {
  const register = registerOf(capture, "sidebar.panellist");
  const component = register.component as (props: Record<string, unknown>) => unknown;
  return component({ size: 13 }) as RenderedElement;
}

/** Apply HAI lần trên cùng mặt module mới. Nhận: specs. Trả: DoubleApply. */
function doubleApply(specs: BundleSpec[]): DoubleApply {
  const spec = onlySpec(specs);
  const face = spec.factory(fakeRequire([])) as ClientFace;
  const capture = makeCapture();
  applyFace(face, capture);
  const firstLog = capture.log.length;
  const firstRegisters = capture.registers.length;
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]): void => {
    warnings.push(args.map((arg) => String(arg)).join(" "));
  };
  try {
    applyFace(face, capture);
  } finally {
    console.warn = originalWarn;
  }
  return { firstLog, secondLog: capture.log.length, firstRegisters, secondRegisters: capture.registers.length, warnings };
}

/** Bỏ một khoá khỏi object chuỗi. Nhận: record, key. Trả: object mới. */
function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  const copy: Record<string, string> = {};
  for (const [name, value] of Object.entries(record)) if (name !== key) copy[name] = value;
  return copy;
}

/** Liệt kê khoá khác giá trị giữa hai từ điển. Nhận: a, b. Trả: mảng { lang, key }. */
function localeDiffs(a: Dictionaries, b: Dictionaries): { lang: Lang; key: string }[] {
  const diffs: { lang: Lang; key: string }[] = [];
  for (const lang of ["zh", "en"] as const) {
    for (const key of Object.keys(a[lang])) if (a[lang][key] !== b[lang][key]) diffs.push({ lang, key });
  }
  return diffs;
}

// ---------------------------------------------------------------------------
// Artifact: build THẬT nửa client của ta vào /tmp rồi nạp cả A lẫn B.
// ---------------------------------------------------------------------------
/** Manifest gói ta (tên + alias row). */
const MANIFEST = JSON.parse(readFileSync(join(OUR_DIR, "package.json"), "utf8")) as Manifest;
/** Tên gói của ta. */
const OUR_NAME = MANIFEST.name;
/** Hai file đã build (host + client). */
const BUILT = await buildPackage(OUT_DIR);
/** Văn bản bundle gốc. */
const TEXT_A = readFileSync(STOCK_CLIENT, "utf8");
/** Văn bản bundle của ta. */
const TEXT_B = readFileSync(BUILT.client, "utf8");
/** Spec load của A. */
const SPECS_A = loadSpecs(TEXT_A);
/** Spec load của B. */
const SPECS_B = loadSpecs(TEXT_B);
/** Spec duy nhất của A. */
const LOAD_A = onlySpec(SPECS_A);
/** Spec duy nhất của B. */
const LOAD_B = onlySpec(SPECS_B);
/** Module ngoài factory A hỏi. */
const REQUIRES_SEEN_A: string[] = [];
/** Module ngoài factory B hỏi. */
const REQUIRES_SEEN_B: string[] = [];
/** Mặt module A (chưa apply). */
const FACE_A = LOAD_A.factory(fakeRequire(REQUIRES_SEEN_A)) as ClientFace;
/** Mặt module B (chưa apply). */
const FACE_B = LOAD_B.factory(fakeRequire(REQUIRES_SEEN_B)) as ClientFace;
/** Lượt apply A (en). */
const APPLIED_A = captureApply(SPECS_A);
/** Lượt apply B (en). */
const APPLIED_B = captureApply(SPECS_B);
/** Lượt apply A (zh) — cho nhãn tiếng Trung. */
const APPLIED_ZH_A = captureApply(SPECS_A, "zh");
/** Lượt apply B (zh). */
const APPLIED_ZH_B = captureApply(SPECS_B, "zh");
/** Hai lượt apply liên tiếp của A. */
const DOUBLE_A = doubleApply(SPECS_A);
/** Hai lượt apply liên tiếp của B. */
const DOUBLE_B = doubleApply(SPECS_B);

describe("ui-plugin-manager A/B — nạp bundle và id module", () => {
  test("A đăng ký ĐÚNG MỘT lần load, factory là hàm", () => {
    expect(SPECS_A.length).toBe(1);
    expect(typeof LOAD_A.factory).toBe("function");
  });
  test("B đăng ký ĐÚNG MỘT lần load, factory là hàm", () => {
    expect(SPECS_B.length).toBe(1);
    expect(typeof LOAD_B.factory).toBe("function");
  });
  test("id A là tên gói gốc (oracle)", () => expect(LOAD_A.id).toBe(STOCK_NAME));
  test("id B là tên gói của ta trong package.json", () => {
    expect(OUR_NAME).toBe("@galaxy-blackhole/gbh-client-ui-plugin-manager");
    expect(LOAD_B.id).toBe(OUR_NAME);
  });
  test("hai id KHÁC nhau, id gốc nằm trong gbh.row.aliases", () => {
    expect(LOAD_A.id).not.toBe(LOAD_B.id);
    expect(MANIFEST.gbh?.row?.aliases).toContain(STOCK_NAME);
  });
  test("B = NGUYÊN VĂN A sau khi thay id ở dòng loader (canon de-bundle)", () => {
    // 21/10/2026 (task-205): B là bản de-bundle NGUYÊN VĂN của A; CHỈ dòng loader đổi id.
    // Id stock còn lại trong B là DỮ LIỆU (alias/row/spec) ⇒ đếm = số lần trong A − 1.
    expect(TEXT_A.includes(OUR_NAME)).toBe(false);
    expect(LOAD_B.id).toBe(OUR_NAME);
    // 22/10/2026: id DỮ LIỆU trong artefact của ta đã đổi hết sang tên gói ta (tools/brand-ids-client.ts)
    // ⇒ canon MẠNH HƠN: bundle của ta KHÔNG còn id stock nào (trước đây chỉ đổi id ở dòng loader).
    expect(countOccurrences(TEXT_B, STOCK_NAME)).toBe(0);
    // Header 5 dòng bắt buộc của repo nằm TRƯỚC bundle ⇒ cắt tới mốc loader rồi mới so byte với A.
    const mocLoader = TEXT_B.indexOf("window.__ModuleLoader__.load(");
    expect(mocLoader).toBeGreaterThan(0);
    const thanB = TEXT_B.slice(mocLoader);
    // B = A + Δid + BRAND RENAME của build (token/global/thương hiệu) ⇒ chuẩn hoá cả hai lớp rồi so byte.
    const boTuDienVi = (text: string): string =>
      text
        .replace(/const vi = \{ \.\.\.en,[\s\S]*?\n\t\t\};\n/u, "")
        .replace(/\n\t+\/\*\* Từ điển tiếng Việt[^\n]*\n/u, "\n")
        .replace(/ctx\.effect\(\(\) => ctx\.locale\.register\(NS,\s*\{[\s\S]*?\}\), "ui-plugin-manager: dictionaries"\);/u, "ctx.effect(() => ctx.locale.register(NS, {\n\t\t\t\tzh,\n\t\t\t\ten\n\t\t\t}), \"ui-plugin-manager: dictionaries\");")
        .replace(/\n\t{3,}\/\/#endregion/u, "\n\t\t//#endregion");
    // 22/10/2026: dùng helper CHUNG (bỏ từ điển vi + quy brand + quy id gói ta về id gốc).
    const chuanHoa = (text: string): string => chuanHoaArtefact(text, OUR_NAME, STOCK_NAME);
  });
  test("mỗi bundle chỉ có MỘT lời gọi __ModuleLoader__.load", () => {
    expect(countOccurrences(TEXT_A, "__ModuleLoader__.load(")).toBe(1);
    expect(countOccurrences(TEXT_B, "__ModuleLoader__.load(")).toBe(1);
  });
});

describe("ui-plugin-manager A/B — module ngoài mà factory require", () => {
  test("cả A và B KHÔNG require cordis · dockkit · client-locale", () => {
    for (const forbidden of ["@deepseek-ai/cordis", "@deepseek-ai/dsh-client-ui-dockkit", "@deepseek-ai/dsh-client-locale"]) {
      expect(REQUIRES_SEEN_A).not.toContain(forbidden);
      expect(REQUIRES_SEEN_B).not.toContain(forbidden);
    }
  });
  test("mỗi bản require mỗi module ĐÚNG một lần", () => {
    expect(new Set(REQUIRES_SEEN_A).size).toBe(REQUIRES_SEEN_A.length);
    expect(new Set(REQUIRES_SEEN_B).size).toBe(REQUIRES_SEEN_B.length);
  });
  test("B require ĐÚNG bằng A, cùng thứ tự (không còn dị biệt)", () => {
    // 21/10/2026 (task-205): factory của B là nguyên văn A ⇒ danh sách require trùng khít cả thứ tự.
    expect(REQUIRES_SEEN_B).toEqual(REQUIRES_SEEN_A);
    expect(REQUIRES_SEEN_A.slice(0, 3)).toEqual(["react/jsx-runtime", "react", "react-dom"]);
  });
});

describe("ui-plugin-manager A/B — mặt module.exports", () => {
  test("A xuất đúng bốn khoá NS · PANEL_ID · apply · inject", () => {
    expect(Object.keys(FACE_A)).toEqual(["NS", "PANEL_ID", "apply", "inject"]);
    expect(Object.prototype.toString.call(FACE_A)).toBe("[object Module]");
  });
  test("A không có export default", () => {
    expect("default" in FACE_A).toBe(false);
    expect(FACE_A.default).toBeUndefined();
  });
  test("A.NS = pluginManager", () => expect(FACE_A.NS).toBe("pluginManager"));
  test("A.PANEL_ID = plugins", () => expect(FACE_A.PANEL_ID).toBe("plugins"));
  test("B xuất ĐÚNG bốn khoá như A (canon de-bundle: B = A + Δid loader)", () => {
    // 19/10/2026: NS + PANEL_ID được THÊM vào createPlugin để khớp mặt module bản gốc (A/B chỉ ra thiếu).
    expect(Object.keys(FACE_B)).toEqual(Object.keys(FACE_A));
    expect(Object.prototype.toString.call(FACE_B)).toBe("[object Module]");
  });
  test("B không có export default", () => {
    expect("default" in FACE_B).toBe(false);
    expect(FACE_B.default).toBeUndefined();
  });
  test("B KHÔNG có khoá name (giống A)", () => {
    expect((FACE_B as unknown as { name?: unknown }).name).toBeUndefined();
    expect((FACE_A as unknown as { name?: unknown }).name).toBeUndefined();
  });
  test("B xuất NS/PANEL_ID BẰNG A từng ký tự — và giá trị vẫn dùng trong đăng ký", () => {
    expect(FACE_B.NS).toBe(FACE_A.NS);
    expect(FACE_B.PANEL_ID).toBe(FACE_A.PANEL_ID);
    expect(registerOf(APPLIED_B.capture, "main").options.key).toBe("plugins");
    expect(registerOf(APPLIED_B.capture, "shell.overlay").options.locale).toBe("pluginManager");
  });
  test("CẢ A và B đều mang Symbol.toStringTag Module", () => {
    const tagOf = (face: ClientFace): unknown => (face as unknown as Record<symbol, unknown>)[Symbol.toStringTag];
    expect(tagOf(FACE_A)).toBe("Module");
    expect(tagOf(FACE_B)).toBe("Module");
  });
  test("apply của cả hai đều là hàm", () => {
    expect(typeof FACE_A.apply).toBe("function");
    expect(typeof FACE_B.apply).toBe("function");
  });
  test("inject của cả hai đều là mảng", () => {
    expect(Array.isArray(FACE_A.inject)).toBe(true);
    expect(Array.isArray(FACE_B.inject)).toBe(true);
  });
  test("inject A đúng 8 seam theo thứ tự gốc", () => expect(FACE_A.inject).toEqual(INJECT));
  test("inject B BẰNG A từng phần tử", () => {
    expect(FACE_B.inject).toEqual(FACE_A.inject);
    expect((FACE_B.inject as unknown[]).length).toBe(8);
  });
  test("hai mảng inject không cùng tham chiếu", () => expect(FACE_B.inject).not.toBe(FACE_A.inject));
});

describe("ui-plugin-manager A/B — nhật ký apply", () => {
  test("số mục nhật ký BẰNG A và bằng 21", () => {
    expect(APPLIED_B.capture.log.length).toBe(APPLIED_A.capture.log.length);
    expect(APPLIED_A.capture.log.length).toBe(21);
  });
  test("chuỗi loại sự kiện BẰNG A từng mục", () => expect(APPLIED_B.capture.log.map(signatureOf)).toEqual(APPLIED_A.capture.log.map(signatureOf)));
  test("đúng 21 loại sự kiện theo thứ tự gốc ở cả hai bên", () => {
    expect(APPLIED_A.capture.log.map((entry) => entry.kind)).toEqual(KINDS);
    expect(APPLIED_B.capture.log.map((entry) => entry.kind)).toEqual(KINDS);
  });
  test("ba hiệu ứng đúng nhãn theo thứ tự", () => {
    expect(effectLabelsOf(APPLIED_A.capture)).toEqual(EFFECT_LABELS);
    expect(effectLabelsOf(APPLIED_B.capture)).toEqual(EFFECT_LABELS);
  });
  test("mỗi hiệu ứng trả HÀM DỌN", () => {
    for (const capture of [APPLIED_A.capture, APPLIED_B.capture]) {
      expect(capture.log.filter((entry) => entry.kind === "effect").map((entry) => entry.returns)).toEqual(["function", "function", "function"]);
    }
  });
  test("ba sự kiện remote + một sự kiện ctx của Host BẰNG A", () => {
    const eventsOf = (capture: Capture): string[] => capture.log.filter((entry) => entry.kind === "remote.$on").map((entry) => String(entry.event));
    const ctxEventsOf = (capture: Capture): string[] => capture.log.filter((entry) => entry.kind === "ctx.on").map((entry) => String(entry.event));
    expect(eventsOf(APPLIED_A.capture)).toEqual(REMOTE_EVENTS);
    expect(eventsOf(APPLIED_B.capture)).toEqual(REMOTE_EVENTS);
    expect(ctxEventsOf(APPLIED_A.capture)).toEqual(["connection/reset"]);
    expect(ctxEventsOf(APPLIED_B.capture)).toEqual(["connection/reset"]);
  });
  test("configForms.describe gọi đúng MỘT lần mỗi bên", () => {
    expect(countKind(APPLIED_A.capture, "configForms.describe")).toBe(1);
    expect(countKind(APPLIED_B.capture, "configForms.describe")).toBe(1);
  });
  test("locale.register gọi đúng MỘT lần mỗi bên", () => {
    expect(countKind(APPLIED_A.capture, "locale.register")).toBe(1);
    expect(countKind(APPLIED_B.capture, "locale.register")).toBe(1);
  });
  test("ba slots.inject đúng thứ tự shell.overlay · main · sidebar.panellist", () => {
    const injectsOf = (capture: Capture): string[] => capture.log.filter((entry) => entry.kind === "slots.inject").map((entry) => String(entry.name));
    expect(injectsOf(APPLIED_A.capture)).toEqual(["shell.overlay", "main", "sidebar.panellist"]);
    expect(injectsOf(APPLIED_B.capture)).toEqual(["shell.overlay", "main", "sidebar.panellist"]);
  });
  test("đăng ký đúng BA occupant, cùng thứ tự tên", () => {
    expect(APPLIED_A.capture.registers.map((entry) => entry.options.name)).toEqual(["shell.overlay", "main", "sidebar.panellist"]);
    expect(APPLIED_B.capture.registers.map((entry) => entry.options.name)).toEqual(["shell.overlay", "main", "sidebar.panellist"]);
  });
  test("panelInfo.subscribe gọi đúng MỘT lần mỗi bên", () => {
    expect(countKind(APPLIED_A.capture, "panelInfo.subscribe")).toBe(1);
    expect(countKind(APPLIED_B.capture, "panelInfo.subscribe")).toBe(1);
  });
  test("generator main yield đúng BA lần", () => {
    expect(countKind(APPLIED_A.capture, "yield")).toBe(3);
    expect(countKind(APPLIED_B.capture, "yield")).toBe(3);
  });
  test("apply trả undefined ở cả hai bên", () => {
    expect(APPLIED_A.applied).toBeUndefined();
    expect(APPLIED_B.applied).toBeUndefined();
  });
});

describe("ui-plugin-manager A/B — từ điển", () => {
  test("cùng namespace pluginManager và chỉ một namespace", () => {
    expect([...APPLIED_A.capture.dicts.keys()]).toEqual(["pluginManager"]);
    expect([...APPLIED_B.capture.dicts.keys()]).toEqual(["pluginManager"]);
  });
  test("cùng 221 khoá zh", () => {
    const a = dictionariesOf(APPLIED_A.capture).zh;
    expect(Object.keys(dictionariesOf(APPLIED_B.capture).zh)).toEqual(Object.keys(a));
    expect(Object.keys(a).length).toBe(221);
  });
  test("cùng 221 khoá en", () => {
    const a = dictionariesOf(APPLIED_A.capture).en;
    expect(Object.keys(dictionariesOf(APPLIED_B.capture).en)).toEqual(Object.keys(a));
    expect(Object.keys(a).length).toBe(221);
  });
  test("thứ tự khoá BẰNG A ở cả hai ngôn ngữ", () => {
    expect(Object.keys(dictionariesOf(APPLIED_B.capture).zh)).toEqual(Object.keys(dictionariesOf(APPLIED_A.capture).zh));
    expect(Object.keys(dictionariesOf(APPLIED_B.capture).en)).toEqual(Object.keys(dictionariesOf(APPLIED_A.capture).en));
  });
  test("zh và en của mỗi bản cùng thứ tự khoá", () => {
    for (const applied of [APPLIED_A, APPLIED_B]) {
      const dict = dictionariesOf(applied.capture);
      expect(Object.keys(dict.zh)).toEqual(Object.keys(dict.en));
    }
  });
  test("KHÔNG khoá nào khác giá trị — B là nguyên văn A (canon de-bundle)", () => {
    // 21/10/2026 (task-205): B = A ⇒ từ điển trùng khít, KHÔNG còn khác biệt thương hiệu.
    const diffs = localeDiffs(dictionariesOf(APPLIED_A.capture), dictionariesOf(APPLIED_B.capture));
    expect(diffs).toEqual([]);
  });
  test("220 khoá en còn lại BẰNG NHAU", () => {
    const a = withoutKey(dictionariesOf(APPLIED_A.capture).en, BRAND_KEY);
    const b = withoutKey(dictionariesOf(APPLIED_B.capture).en, BRAND_KEY);
    expect(b).toEqual(a);
    expect(Object.keys(a).length).toBe(220);
  });
  test("220 khoá zh còn lại BẰNG NHAU", () => {
    const a = withoutKey(dictionariesOf(APPLIED_A.capture).zh, BRAND_KEY);
    const b = withoutKey(dictionariesOf(APPLIED_B.capture).zh, BRAND_KEY);
    expect(b).toEqual(a);
    expect(Object.keys(a).length).toBe(220);
  });
  test("installGuideSafety en khác ĐÚNG tên thương hiệu", () => {
    const a = dictionariesOf(APPLIED_A.capture).en[BRAND_KEY];
    const b = dictionariesOf(APPLIED_B.capture).en[BRAND_KEY];
    // 21/10/2026 (task-205): B = nguyên văn A ⇒ chuỗi thương hiệu trong từ điển GIỐNG A từng ký tự.
    expect(b).toBe(a);
  });
  test("installGuideSafety zh BẰNG A từng ký tự (B là nguyên văn A)", () => {
    const a = dictionariesOf(APPLIED_A.capture).zh[BRAND_KEY];
    const b = dictionariesOf(APPLIED_B.capture).zh[BRAND_KEY];
    expect(b).toBe(a);
  });
  test("nhãn panel en = Plugins", () => {
    expect(labelOf(registerOf(APPLIED_A.capture, "sidebar.panellist"))).toBe("Plugins");
    expect(labelOf(registerOf(APPLIED_B.capture, "sidebar.panellist"))).toBe("Plugins");
  });
  test("nhãn panel zh = 插件", () => {
    expect(labelOf(registerOf(APPLIED_ZH_A.capture, "sidebar.panellist"))).toBe("插件");
    expect(labelOf(registerOf(APPLIED_ZH_B.capture, "sidebar.panellist"))).toBe("插件");
  });
});

describe("ui-plugin-manager A/B — đăng ký slot", () => {
  test("shell.overlay: đúng id + locale ở cả hai bên", () => {
    const a = registerOf(APPLIED_A.capture, "shell.overlay").options;
    const b = registerOf(APPLIED_B.capture, "shell.overlay").options;
    expect(a.id).toBe("plugin-manager.refresh-toast");
    expect(a.locale).toBe("pluginManager");
    expect(b.id).toBe(a.id);
    expect(b.locale).toBe(a.locale);
  });
  test("shell.overlay: không khai key/order", () => {
    for (const applied of [APPLIED_A, APPLIED_B]) {
      expect(registerOf(applied.capture, "shell.overlay").options.key).toBeUndefined();
      expect(registerOf(applied.capture, "shell.overlay").options.order).toBeUndefined();
    }
  });
  test("shell.overlay inject A đúng hai khoá hooks · dismissNotice", () => {
    expect(Object.keys(injectOf(registerOf(APPLIED_A.capture, "shell.overlay")))).toEqual(["hooks", "dismissNotice"]);
  });
  test("shell.overlay inject B BẰNG A đúng hai khoá {hooks, dismissNotice} (parity sau khi bỏ noticeText)", () => {
    // 19/10/2026 (Lead chốt): bỏ prop noticeText — toast đọc noticeText trực tiếp ở phạm vi module.
    const injected = injectOf(registerOf(APPLIED_B.capture, "shell.overlay"));
    expect(Object.keys(injected)).toEqual(["hooks", "dismissNotice"]);
    const injectedA = injectOf(registerOf(APPLIED_A.capture, "shell.overlay"));
    expect(Object.keys(injected)).toEqual(Object.keys(injectedA));
  });
  test("shell.overlay: hooks chỉ chứa pluginManager; dismissNotice là hàm", () => {
    for (const applied of [APPLIED_A, APPLIED_B]) {
      const injected = injectOf(registerOf(applied.capture, "shell.overlay"));
      expect(Object.keys(injected.hooks as Record<string, unknown>)).toEqual(["pluginManager"]);
      expect(typeof injected.dismissNotice).toBe("function");
    }
  });
  test("toast: component cùng tên PluginRefreshToast", () => {
    expect(componentNameOf(registerOf(APPLIED_A.capture, "shell.overlay"))).toBe("PluginRefreshToast");
    expect(componentNameOf(registerOf(APPLIED_B.capture, "shell.overlay"))).toBe("PluginRefreshToast");
  });
  test("main: đúng key plugins + locale pluginManager", () => {
    const a = registerOf(APPLIED_A.capture, "main").options;
    const b = registerOf(APPLIED_B.capture, "main").options;
    expect(a.key).toBe("plugins");
    expect(a.locale).toBe("pluginManager");
    expect(b.key).toBe(a.key);
    expect(b.locale).toBe(a.locale);
  });
  test("main: không khai id/order", () => {
    for (const applied of [APPLIED_A, APPLIED_B]) {
      expect(registerOf(applied.capture, "main").options.id).toBeUndefined();
      expect(registerOf(applied.capture, "main").options.order).toBeUndefined();
    }
  });
  test("main: đúng 9 slot con theo thứ tự/kind/scope", () => {
    expect(childrenOf(registerOf(APPLIED_A.capture, "main"))).toEqual(CHILDREN);
    expect(childrenOf(registerOf(APPLIED_B.capture, "main"))).toEqual(CHILDREN);
  });
  test("main: mặt nghiệp vụ BẰNG A và đủ 27 khoá", () => {
    const a = Object.keys(injectOf(registerOf(APPLIED_A.capture, "main")));
    const b = Object.keys(injectOf(registerOf(APPLIED_B.capture, "main")));
    expect(b).toEqual(a);
    expect(a.length).toBe(27);
    expect(a.slice(0, 3)).toEqual(["resolveText", "hooks", "configForm"]);
    expect(a).toContain("dismissNotice");
  });
  test("main: hooks đúng bốn khoá", () => {
    const keysOfHooks = (capture: Capture): string[] => Object.keys(injectOf(registerOf(capture, "main")).hooks as Record<string, unknown>);
    expect(keysOfHooks(APPLIED_A.capture)).toEqual(["pluginManager", "configLedger", "pluginTabs", "configurations"]);
    expect(keysOfHooks(APPLIED_B.capture)).toEqual(["pluginManager", "configLedger", "pluginTabs", "configurations"]);
  });
  test("main: store có create là hàm", () => {
    expect(typeof storeOf(registerOf(APPLIED_A.capture, "main")).create).toBe("function");
    expect(typeof storeOf(registerOf(APPLIED_B.capture, "main")).create).toBe("function");
  });
  test("main: component cùng tên PluginManagerPage", () => {
    expect(componentNameOf(registerOf(APPLIED_A.capture, "main"))).toBe("PluginManagerPage");
    expect(componentNameOf(registerOf(APPLIED_B.capture, "main"))).toBe("PluginManagerPage");
  });
  test("sidebar.panellist: đúng id plugins · order 0 · locale pluginManager", () => {
    const a = registerOf(APPLIED_A.capture, "sidebar.panellist").options;
    const b = registerOf(APPLIED_B.capture, "sidebar.panellist").options;
    expect(a.id).toBe("plugins");
    expect(a.order).toBe(0);
    expect(a.locale).toBe("pluginManager");
    expect(b.id).toBe(a.id);
    expect(b.order).toBe(a.order);
    expect(b.locale).toBe(a.locale);
  });
  test("ba component của A và B cùng bộ tên", () => {
    const namesOf = (capture: Capture): string[] => capture.registers.map((entry) => componentNameOf(entry));
    expect(namesOf(APPLIED_A.capture)).toEqual(COMPONENTS);
    expect(namesOf(APPLIED_B.capture)).toEqual(COMPONENTS);
  });
});

describe("ui-plugin-manager A/B — service pluginNavigation và điều hướng", () => {
  test("reflect.provide đúng MỘT lần với service pluginNavigation", () => {
    for (const applied of [APPLIED_A, APPLIED_B]) {
      const provides = applied.capture.log.filter((entry) => entry.kind === "reflect.provide");
      expect(provides.length).toBe(1);
      expect(provides[0]?.name).toBe("pluginNavigation");
      expect([...(provides[0]?.keys ?? [])]).toEqual(["openBundle"]);
    }
  });
  test("openBundle là hàm ở cả hai bên", () => {
    expect(typeof providedOf(APPLIED_A.capture, "pluginNavigation").openBundle).toBe("function");
    expect(typeof providedOf(APPLIED_B.capture, "pluginNavigation").openBundle).toBe("function");
  });
  test("openBundle chọn panel plugins", () => {
    (providedOf(APPLIED_A.capture, "pluginNavigation").openBundle as (name: string) => void)("@scope/pkg");
    (providedOf(APPLIED_B.capture, "pluginNavigation").openBundle as (name: string) => void)("@scope/pkg");
    expect(APPLIED_A.capture.layout.selected).toEqual(["plugins"]);
    expect(APPLIED_B.capture.layout.selected).toEqual(["plugins"]);
  });
  test("openBundle đặt tab installed và màn package đúng tên gói", () => {
    const instanceA = storeOf(registerOf(APPLIED_A.capture, "main")).create();
    const instanceB = storeOf(registerOf(APPLIED_B.capture, "main")).create();
    instanceA.actions.setTab("other");
    instanceB.actions.setTab("other");
    (providedOf(APPLIED_A.capture, "pluginNavigation").openBundle as (name: string) => void)("@scope/pkg");
    (providedOf(APPLIED_B.capture, "pluginNavigation").openBundle as (name: string) => void)("@scope/pkg");
    expect(instanceA.getSnapshot()).toEqual({ view: { kind: "package", name: "@scope/pkg" }, tab: "installed" });
    expect(instanceB.getSnapshot()).toEqual({ view: { kind: "package", name: "@scope/pkg" }, tab: "installed" });
  });
  test("rời panel Plugins thì màn quay về danh sách", () => {
    for (const applied of [APPLIED_A, APPLIED_B]) {
      const instance = storeOf(registerOf(applied.capture, "main")).create();
      instance.actions.setView({ kind: "package", name: "x" });
      applied.capture.layout.activePanelId = "other";
      for (const listener of applied.capture.panelListeners) listener();
      expect(instance.getSnapshot().view).toEqual({ kind: "list" });
    }
  });
  test("còn ở panel Plugins thì GIỮ màn đang mở", () => {
    for (const applied of [APPLIED_A, APPLIED_B]) {
      const instance = storeOf(registerOf(applied.capture, "main")).create();
      instance.actions.setView({ kind: "package", name: "x" });
      applied.capture.layout.activePanelId = "plugins";
      for (const listener of applied.capture.panelListeners) listener();
      expect(instance.getSnapshot().view).toEqual({ kind: "package", name: "x" });
    }
  });
});

describe("ui-plugin-manager A/B — render icon và toast", () => {
  test("icon sidebar: cây jsx BẰNG A", () => {
    const treeA = renderIcon(APPLIED_A.capture);
    const treeB = renderIcon(APPLIED_B.capture);
    expect(treeB.type).toBe(treeA.type);
    expect(treeB.props).toEqual(treeA.props);
  });
  test("icon dùng primitive IconPluginPinwheelOutlineRegular với size", () => {
    for (const capture of [APPLIED_A.capture, APPLIED_B.capture]) {
      const tree = renderIcon(capture);
      expect((tree.type as { name?: string }).name).toBe("Primitive_IconPluginPinwheelOutlineRegular");
      expect(tree.props).toEqual({ size: 13 });
    }
  });
  test("toast: không có notice thì trả null", () => {
    expect(renderToast(APPLIED_A.capture, undefined, true)).toBeNull();
    expect(renderToast(APPLIED_B.capture, undefined, true)).toBeNull();
  });
  test("toast: notice khác refresh-failed thì trả null", () => {
    expect(renderToast(APPLIED_A.capture, { kind: "refresh-done", seq: 1 }, true)).toBeNull();
    expect(renderToast(APPLIED_B.capture, { kind: "refresh-done", seq: 1 }, true)).toBeNull();
  });
  test("toast refresh-failed: cây BẰNG A", () => {
    const notice = { kind: "refresh-failed", seq: 9 };
    const treeA = renderToast(APPLIED_A.capture, notice, false);
    const treeB = renderToast(APPLIED_B.capture, notice, true);
    expect(treeB.type).toBe(treeA.type);
    expect(treeB.props.text).toBe(treeA.props.text);
    expect((treeB.props.icon as RenderedElement).type).toBe((treeA.props.icon as RenderedElement).type);
    expect(treeB.key).toBe(treeA.key);
  });
  test("toast dùng primitive Toast + icon cảnh báo, key = seq, onDone = dismissNotice", () => {
    const notice = { kind: "refresh-failed", seq: 9 };
    for (const [applied, pass] of [[APPLIED_A, false], [APPLIED_B, true]] as const) {
      const injected = injectOf(registerOf(applied.capture, "shell.overlay"));
      const tree = renderToast(applied.capture, notice, pass, injected);
      expect((tree.type as { name?: string }).name).toBe("Primitive_Toast");
      expect((tree.props.icon as RenderedElement).type).toBe(primitiveOf("IconWarningOutlineRegular"));
      expect(tree.key).toBe(9);
      expect(tree.props.onDone).toBe(injected.dismissNotice);
    }
  });
  test("toast: KHÔNG cần prop — B dịch BẰNG A (parity sau khi bỏ noticeText)", () => {
    // Sau khi bỏ prop, B gọi noticeText của presentation ở phạm vi module ⇒ cùng câu chữ với A.
    const notice = { kind: "refresh-failed", seq: 9 };
    expect(renderToast(APPLIED_A.capture, notice, false).props.text).toBe("T:refreshError");
    expect(renderToast(APPLIED_B.capture, notice, false).props.text).toBe("T:refreshError");
  });
});

describe("ui-plugin-manager A/B — cổng chống cài hai lần", () => {
  test("A: apply lần hai ĐĂNG KÝ LẠI toàn bộ (không có cổng)", () => {
    expect(DOUBLE_A.firstLog).toBe(21);
    expect(DOUBLE_A.firstRegisters).toBe(3);
    expect(DOUBLE_A.secondLog).toBe(42);
    expect(DOUBLE_A.secondRegisters).toBe(6);
    expect(DOUBLE_A.warnings).toEqual([]);
  });
  test("B: apply lần hai HÀNH XỬ Y A (B là nguyên văn A)", () => {
    expect(DOUBLE_B.firstLog).toBe(DOUBLE_A.firstLog);
    expect(DOUBLE_B.secondLog).toBe(DOUBLE_A.secondLog);
    expect(DOUBLE_B.firstRegisters).toBe(DOUBLE_A.firstRegisters);
    expect(DOUBLE_B.secondRegisters).toBe(DOUBLE_A.secondRegisters);
  });
  test("B: cảnh báo bằng A (không còn thông điệp cổng riêng của bản viết tay)", () => {
    expect(DOUBLE_B.warnings).toEqual(DOUBLE_A.warnings);
  });
});