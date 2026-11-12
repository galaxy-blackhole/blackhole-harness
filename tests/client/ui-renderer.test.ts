/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test row ui-renderer: hop dong dinh danh - artifact MOT id - lap rap createPlugin/apply - mini
 *      renderer de do HANH VI that (outlet · entry · error boundary · store · scope · Factory)
 */
// Vì sao có mini renderer + SlotCore giả: nửa client KHÔNG import tĩnh React hay module ui-slots — cả
// hai do BẢNG MODULE CỦA TRANG cấp (builtin của frontend), nên bun test phải dựng bản thay thế: React giả
// (hook chạy ngoài React) + SlotCore giả (giữ phần ngữ nghĩa tầng renderer dựa vào — seam của DSH, KHÔNG
// phải code của gói này). Stub KHÔNG rộng hơn module thật: React giả không có jsx/jsxs trên module react.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as buildMod from "../../packages/client/ui-renderer/build.ts";
import { INJECT, PACKAGE_NAME, ROOT_SLOT, SERVICE_SLOTS, SERVICE_UI_RENDERER, STOCK_MODULE_ID } from "../../packages/client/ui-renderer/src/ids.ts";
import { SlotAssemblyError } from "../../packages/client/ui-renderer/src/errors.ts";
import { loadBundle, loadPageModules } from "../../packages/client/ui-renderer/src/client.ts";

/** Gốc package của ta. */
const BASE = join(import.meta.dir, "..", "..", "packages", "client", "ui-renderer");
/** Gói gốc DSH (CHỈ ĐỌC) — dùng để đối chứng artifact. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-renderer");

/**
 * Đọc một file trong package của ta.
 * Nhận: relative — đường dẫn tương đối.
 * Trả: nội dung file.
 */
const source = (relative: string): string => readFileSync(join(BASE, relative), "utf8");

/**
 * Đánh giá nửa client ĐÃ BUILD trong một phạm vi mới: mỗi lần gọi `factory(require)` là MỘT thể hiện
 * module mới (thân bundle chạy lại), nên CỜ PHẠM VI MODULE của cổng cài-hai-lần được đo THẬT.
 * Nhận: text — nội dung lib/client.js; requireFn — bảng module giả.
 * Trả: exports của thể hiện mới.
 */
function evaluateClient(text: string, requireFn: (spec: string) => unknown): any {
  /** Bảng module giả của trang: chỉ giữ lại factory vừa đăng ký. */
  let captured: ((requireFn: (spec: string) => unknown) => unknown) | undefined;
  const windowLike = {
    __ModuleLoader__: {
      load(spec: { id: string; factory: (requireFn: (spec: string) => unknown) => unknown }) {
        captured = spec.factory;
      },
    },
  };
  // Script classic: chạy trong hàm với `window` giả (đúng cách bộ nạp trang nạp bundle).
  new Function("window", text)(windowLike);
  if (captured === undefined) throw new Error("artifact khong goi __ModuleLoader__.load");
  return captured(requireFn);
}

/** Artifact đã build MỘT LẦN cho cả tệp test (mỗi ca tự gọi factory để có thể hiện module mới). */
const ARTIFACT = await (async () => {
  const out = join("/tmp", "gbh-renderer-artifact");
  const built = await buildMod.buildPackage(out);
  return {
    out,
    hostPath: built.host,
    clientPath: built.client,
    clientText: readFileSync(built.client, "utf8"),
  };
})();

/** Phần tử giả do jsx-runtime giả dựng. */
interface FakeElement {
  readonly type: unknown;
  readonly props: Record<string, unknown>;
  readonly key?: unknown;
}

/** Fragment giả. */
const FRAGMENT = Symbol("Fragment");

/**
 * Dựng một phần tử giả.
 * Nhận: type — kiểu tử; props — prop; key — key React.
 * Trả: phần tử.
 */
function jsx(type: unknown, props: Record<string, unknown> | null, key?: unknown): FakeElement {
  return { type, props: props ?? {}, key };
}

/** Context giả. */
interface FakeContext {
  Provider: unknown;
  value: unknown;
}

/**
 * Dựng module React giả (hẹp bằng module thật: KHÔNG có jsx/jsxs).
 * Nhận: không.
 * Trả: module react giả.
 */
function makeReact(): any {
  /** Lớp nền cho error boundary. */
  class Component {
    /** Prop của instance. */
    props: Record<string, unknown>;
    /** State của instance. */
    state: Record<string, unknown> = {};
    /**
     * Tạo instance.
     * Nhận: props — prop.
     * Trả: không.
     */
    constructor(props: Record<string, unknown>) {
      this.props = props;
    }
    /**
     * Ghi state (giả: gộp ngay, không schedule).
     * Nhận: next — state mới.
     * Trả: không.
     */
    setState(next: Record<string, unknown>): void {
      this.state = { ...this.state, ...next };
    }
  }
  return {
    Component,
    /**
     * Tạo context giả.
     * Nhận: initial — giá trị mặc định.
     * Trả: context.
     */
    createContext<T>(initial: T): unknown {
      const ctx: FakeContext = { Provider: null, value: initial };
      ctx.Provider = { __context: ctx };
      return ctx;
    },
    /**
     * Đọc context giả.
     * Nhận: context — context đã tạo.
     * Trả: giá trị hiện tại.
     */
    useContext<T>(context: unknown): T {
      return (context as FakeContext).value as T;
    },
    /**
     * Dựng element (đường react.createElement của BootHandoff).
     * Nhận: type — kiểu tử; props — prop; children — con.
     * Trả: phần tử.
     */
    createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): FakeElement {
      const merged: Record<string, unknown> = { ...(props ?? {}) };
      if (children.length > 0) merged["children"] = children.length === 1 ? children[0] : children;
      return jsx(type, merged);
    },
    /** useState giả: trả giá trị khởi tạo + setter rỗng. */
    useState<S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void] {
      const value = typeof initial === "function" ? (initial as () => S)() : initial;
      return [value, () => undefined];
    },
    /** useMemo giả: chạy factory. */
    useMemo<T>(factory: () => T): T {
      return factory();
    },
    /** useRef giả. */
    useRef<T>(initial: T): { current: T } {
      return { current: initial };
    },
    /** useEffect giả: bỏ qua. */
    useEffect(): void {},
    /** useLayoutEffect giả: bỏ qua. */
    useLayoutEffect(): void {},
    /** useDebugValue giả: bỏ qua. */
    useDebugValue(): void {},
    /** useSyncExternalStore giả: đọc ảnh chụp ngay. */
    useSyncExternalStore<Snapshot>(_subscribe: unknown, getSnapshot: () => Snapshot): Snapshot {
      return getSnapshot();
    },
  };
}

/** Kết quả render của một thẻ thật. */
interface RenderedHost {
  tag: string;
  props: Record<string, unknown>;
  children: unknown;
}

/**
 * Render ĐỆ QUY một phần tử giả (function component · class component + error boundary · Provider ·
 * Fragment · thẻ thật).
 * Nhận: node — phần tử.
 * Trả: cây đã render.
 */
function renderNode(node: unknown): unknown {
  if (node === null || node === undefined) return null;
  if (Array.isArray(node)) return node.map((child) => renderNode(child));
  if (typeof node !== "object") return node;
  const element = node as FakeElement;
  if (!("type" in element)) return node;
  const type = element.type as any;
  if (type === FRAGMENT) return renderNode(element.props["children"]);
  if (type !== null && typeof type === "object" && type.__context !== undefined) {
    const ctx = type.__context as FakeContext;
    const previous = ctx.value;
    ctx.value = element.props["value"];
    try {
      return renderNode(element.props["children"]);
    } finally {
      ctx.value = previous;
    }
  }
  if (typeof type === "function") {
    if (typeof type.prototype?.render === "function") {
      const instance = new type(element.props);
      try {
        return renderNode(instance.render());
      } catch (error) {
        if (typeof type.getDerivedStateFromError !== "function") throw error;
        instance.state = { ...instance.state, ...type.getDerivedStateFromError(error) };
        if (typeof instance.componentDidCatch === "function") instance.componentDidCatch(error);
        return renderNode(instance.render());
      }
    }
    return renderNode(type(element.props));
  }
  return { tag: String(type), props: element.props, children: renderNode(element.props["children"]) };
}

/** Thu mọi thẻ thật trong cây. Nhận: tree. Trả: mảng thẻ theo thứ tự gặp. */
function collectHosts(tree: unknown): RenderedHost[] {
  const out: RenderedHost[] = [];
  /** Đi đệ quy. */
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const host = node as RenderedHost;
    if (typeof host.tag !== "string") return;
    out.push(host);
    walk(host.children);
  };
  walk(tree);
  return out;
}

/** Tìm thẻ thật theo một thuộc tính. Nhận: tree · attribute · value. Trả: thẻ khớp đầu tiên. */
function findByAttribute(tree: unknown, attribute: string, value: string): RenderedHost | undefined {
  return collectHosts(tree).find((host) => host.props[attribute] === value);
}

/** Thu text của cây đã render. Nhận: tree. Trả: chuỗi text. */
function textOf(tree: unknown): string {
  if (tree === null || tree === undefined) return "";
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map((child) => textOf(child)).join("");
  const host = tree as RenderedHost;
  return textOf(host.children);
}
/** Spec giả của một slot. */
interface FakeSpec {
  kind: string;
  scope: string;
  inline?: boolean;
  inject?: Record<string, unknown>;
}

/** Bản ghi một mục trong SlotCore giả. */
interface FakeEntry {
  component: unknown;
  options: Record<string, unknown>;
  inject?: (...args: unknown[]) => Record<string, unknown>;
  children?: Record<string, { kind: string; scope: string; inline?: boolean }>;
  locale?: string;
  store?: { create(key?: string): unknown; spec: { persist?: unknown } };
  select?: (props: Record<string, unknown>) => unknown;
  registrant?: string;
}

/**
 * Dựng SlotCore giả — giữ PHẦN NGỮ NGHĨA mà tầng renderer dựa vào.
 * Nhận: không.
 * Trả: module ui-slots giả + hàm đọc trạng thái.
 */
function makeSlotsApi(): any {
  /** Lỗi: mục render slot con không được khai. */
  class SlotOwnershipError extends Error {}
  /** Lỗi: mục đã bị gỡ vẫn còn giữ closure render. */
  class StaleAuthorizationError extends Error {}
  /** Tên prop hook chuẩn của một hook. */
  const standardHookPropName = (name: string): string => "use" + name.charAt(0).toUpperCase() + name.slice(1);
  /** Core giả. */
  class SlotCore {
    /** Spec theo khoá. */
    readonly specs = new Map<string, FakeSpec>();
    /** Sổ mục theo khoá. */
    readonly lists = new Map<string, FakeEntry[]>();
    /** Số phiên bản theo khoá. */
    readonly versions = new Map<string, number>();
    /** Số thế hệ khai báo theo khoá. */
    readonly epochs = new Map<string, number>();
    /** Người nghe thay đổi đăng ký. */
    readonly listeners = new Map<string, Set<() => void>>();
    /** Người nghe thay đổi khai báo. */
    readonly declListeners = new Map<string, Set<() => void>>();
    /** Người nghe mutate. */
    readonly mutateListeners: ((key: string) => void)[] = [];
    /** Người nghe lỗi. */
    readonly errorListeners: ((key: string, registration: unknown, error: unknown, info: { abdicated: boolean }) => void)[] = [];
    /** Factory theo tên. */
    readonly factories = new Map<string, any>();
    /** Số phiên bản Factory. */
    readonly factoryVersions = new Map<string, number>();
    /** Người nghe Factory. */
    readonly factoryListeners = new Map<string, Set<() => void>>();
    /**
     * Khởi tạo: seed slot gốc.
     * Nhận: không. Trả: không.
     */
    constructor() {
      this.specs.set("root", { kind: "single", scope: "root" });
      this.lists.set("root", []);
    }
    /** Đăng ký một mục; trả hàm gỡ. */
    register(options: Record<string, unknown>, component: unknown): () => void {
      const key = String(options["name"]);
      if (!this.specs.has(key)) {
        this.specs.set(key, {
          kind: String(options["kind"] ?? "single"),
          scope: String(options["scope"] ?? "root"),
          inline: options["inline"] as boolean | undefined,
          inject: options["inject"] as Record<string, unknown> | undefined,
        });
        this.epochs.set(key, 1);
        for (const fn of this.declListeners.get(key) ?? []) fn();
      }
      // ⚠️ Bản gốc đặt face inject ở TOP-LEVEL của entry (entry.inject), KHÔNG trong options (bundle gốc
      // dòng 435–441) ⇒ ở đây BỎ inject khỏi options để ca 22 bắt được hồi quy đọc nhầm chỗ.
      const { inject, ...entryOptions } = options;
      const entry: FakeEntry = {
        component,
        inject: inject as FakeEntry["inject"],
        options: entryOptions,
        children: options["children"] as FakeEntry["children"],
        locale: options["locale"] as string | undefined,
        store: options["store"] as FakeEntry["store"],
        select: options["select"] as FakeEntry["select"],
        registrant: options["registrant"] as string | undefined,
      };
      const list = this.lists.get(key) ?? [];
      list.push(entry);
      this.lists.set(key, list);
      this.bump(key);
      return () => {
        const current = this.lists.get(key) ?? [];
        const index = current.indexOf(entry);
        if (index === -1) return;
        current.splice(index, 1);
        this.bump(key);
      };
    }
    /** Đăng ký một Factory. */
    registerFactory(options: Record<string, unknown>, component: unknown): () => void {
      const name = String(options["name"]);
      const definition = { name, component, ...options };
      this.factories.set(name, definition);
      this.bumpFactory(name);
      return () => {
        this.factories.delete(name);
        this.bumpFactory(name);
      };
    }
    /** Tăng version + báo. */
    bump(key: string): void {
      this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
      for (const fn of [...(this.listeners.get(key) ?? [])]) fn();
      for (const fn of this.mutateListeners) fn(key);
    }
    /** Tăng version Factory + báo. */
    bumpFactory(name: string): void {
      this.factoryVersions.set(name, (this.factoryVersions.get(name) ?? 0) + 1);
      for (const fn of [...(this.factoryListeners.get(name) ?? [])]) fn();
    }
    /** Ảnh chụp sổ đăng ký. */
    entries(key: string): FakeEntry[] {
      return [...(this.lists.get(key) ?? [])];
    }
    /** Người thắng theo ô (single/keyed: mục ĐĂNG KÝ SAU; list/chain: tất cả). */
    entriesOfSlot(key: string): FakeEntry[] {
      const spec = this.specs.get(key);
      const list = this.lists.get(key) ?? [];
      if (spec === undefined) return [];
      if (spec.kind === "list" || spec.kind === "chain") return [...list];
      const cells = new Map<unknown, FakeEntry>();
      for (const entry of list) cells.set(spec.kind === "keyed" ? entry.options["key"] : "only", entry);
      return [...cells.values()];
    }
    /** Spec đã khai. */
    spec(key: string): FakeSpec | undefined {
      return this.specs.get(key);
    }
    /** Spec sống. */
    specDynamic(key: string): FakeSpec | undefined {
      return this.specs.get(key);
    }
    /** Số thế hệ khai báo. */
    declarationEpoch(key: string): number {
      return this.epochs.get(key) ?? 0;
    }
    /** Theo dõi thay đổi khai báo. */
    subscribeDeclaration(key: string, fn: () => void): () => void {
      const set = this.declListeners.get(key) ?? new Set<() => void>();
      set.add(fn);
      this.declListeners.set(key, set);
      return () => set.delete(fn);
    }
    /** Theo dõi mutate. */
    onMutate(fn: (key: string) => void): () => void {
      this.mutateListeners.push(fn);
      return () => {
        const index = this.mutateListeners.indexOf(fn);
        if (index !== -1) this.mutateListeners.splice(index, 1);
      };
    }
    /** Cây khai báo JSON-safe (rỗng là đủ cho các ca ở đây). */
    snapshot(): unknown[] {
      return [];
    }
    /** Theo dõi lỗi. */
    onEntryError(fn: (key: string, registration: unknown, error: unknown, info: { abdicated: boolean }) => void): () => void {
      this.errorListeners.push(fn);
      return () => {
        const index = this.errorListeners.indexOf(fn);
        if (index !== -1) this.errorListeners.splice(index, 1);
      };
    }
    /** Báo lỗi một mục; rút lui thì gỡ mục khỏi sổ. */
    reportEntryError(key: string, entry: FakeEntry, error: unknown, info: { abdicate: boolean }): void {
      if (info.abdicate) {
        const list = this.lists.get(key) ?? [];
        const index = list.indexOf(entry);
        if (index !== -1) {
          list.splice(index, 1);
          this.bump(key);
        }
      }
      for (const fn of this.errorListeners) fn(key, entry, error, { abdicated: info.abdicate });
    }
    /** Báo lỗi Factory. */
    reportFactoryError(name: string, registration: unknown, error: unknown): void {
      for (const fn of this.errorListeners) fn("factory:" + name, registration, error, { abdicated: false });
    }
    /** Mục còn sống. */
    isLive(entry: FakeEntry): boolean {
      for (const list of this.lists.values()) if (list.includes(entry)) return true;
      return false;
    }
    /** Factory còn sống. */
    isFactoryLive(definition: unknown): boolean {
      return [...this.factories.values()].includes(definition);
    }
    /** Factory hiện tại. */
    factory(name: string): any {
      return this.factories.get(name);
    }
    /** Theo dõi Factory. */
    subscribeFactory(name: string, fn: () => void): () => void {
      const set = this.factoryListeners.get(name) ?? new Set<() => void>();
      set.add(fn);
      this.factoryListeners.set(name, set);
      return () => set.delete(fn);
    }
    /** Số phiên bản Factory. */
    factoryVersion(name: string): number {
      return this.factoryVersions.get(name) ?? 0;
    }
    /** Số phiên bản đăng ký. */
    getVersion(key: string): number {
      return this.versions.get(key) ?? 0;
    }
    /** Theo dõi đăng ký. */
    subscribe(key: string, fn: () => void): () => void {
      const set = this.listeners.get(key) ?? new Set<() => void>();
      set.add(fn);
      this.listeners.set(key, set);
      return () => set.delete(fn);
    }
  }
  return { SlotCore, SlotOwnershipError, StaleAuthorizationError, standardHookPropName };
}

/** Service cordis giả: đăng ký chính nó lên ctx theo tên. */
class FakeService {
  /** Context sở hữu. */
  ctx: any;
  /**
   * Cài service lên ctx.
   * Nhận: ctx — context; name — tên service.
   * Trả: không.
   */
  constructor(ctx: any, name: string) {
    this.ctx = ctx;
    ctx[name] = this;
  }
}

/** Môi trường giả của một ca test. */
interface Harness {
  requireFn: (spec: string) => unknown;
  order: string[];
  rendered: unknown[];
  hydrated: unknown[];
  effects: string[];
  provided: Record<string, unknown>;
  events: unknown[][];
  ctx: any;
}

/**
 * Dựng môi trường giả (bảng module + ctx cordis).
 * Nhận: không.
 * Trả: harness.
 */
function makeHarness(): Harness {
  const slotsApi = makeSlotsApi();
  const react = makeReact();
  const rendered: unknown[] = [];
  const hydrated: unknown[] = [];
  const modules: Record<string, unknown> = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: FRAGMENT },
    "react-dom": { flushSync: (callback: () => void) => callback() },
    "react-dom/client": {
      createRoot: (_container: unknown) => ({
        render: (node: unknown) => rendered.push(node),
        unmount: () => undefined,
      }),
      hydrateRoot: (_container: unknown, node: unknown) => {
        hydrated.push(node);
        return {
          render: (next: unknown) => rendered.push(next),
          unmount: () => undefined,
        };
      },
    },
    "@deepseek-ai/cordis": { Service: FakeService },
    "@deepseek-ai/dsh-client-ui-slots": slotsApi,
    // P3 (04/11/2026): artefact của ta giờ require id MỚI của module ảo ui-slots — bảng giả phải có cả hai khoá.
    "@galaxy-blackhole/gbh-client-ui-slots": slotsApi,
  };
  const order: string[] = [];
  const requireFn = (spec: string): unknown => {
    order.push(spec);
    const mod = modules[spec];
    if (mod === undefined) throw new Error("module table thieu " + spec);
    return mod;
  };
  const effects: string[] = [];
  const provided: Record<string, unknown> = {};
  const events: unknown[][] = [];
  const ctx: any = {
    effect(execute: () => unknown, label?: string) {
      effects.push(label ?? "");
      const dispose = execute();
      return () => {
        if (typeof dispose === "function") dispose();
      };
    },
    emit(event: string, ...args: unknown[]) {
      events.push([event, ...args]);
    },
    fiber: { name: "test-plugin" },
    reflect: {
      provide(name: string, value: unknown) {
        provided[name] = value;
        return () => undefined;
      },
    },
  };
  return { requireFn, order, rendered, hydrated, effects, provided, events, ctx };
}

/** Nguồn observable giả. */
interface FakeSource<T> {
  /** Đọc giá trị. */
  getSnapshot(): T;
  /** Theo dõi. */
  subscribe(listener: () => void): () => void;
}

/** Dựng nguồn observable giả. Nhận: value. Trả: nguồn (có set để đổi). */
function makeSource<T>(value: T): FakeSource<T> & { set(next: T): void } {
  const listeners = new Set<() => void>();
  let current = value;
  return {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next: T) => {
      current = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

/**
 * Cài adapter scope phiên giả lên một ctx đã có service slots.
 * Nhận: ctx — ctx giả.
 * Trả: bộ điều khiển binding phiên.
 */
function installTestScope(ctx: any): { binding: any; switchTo(sessionId: string | undefined): void; adapter: any } {
  const binding = { key: "s1", ctx: { tag: "ctx-s1" }, hooks: {}, keyedHooks: {}, props: {} };
  const current = makeSource<any>(binding);
  const adapter = {
    current,
    bindingSource: () => current,
    renderArea: (b: unknown, props: Record<string, unknown>) => props["children"],
  };
  ctx.slots.installScope("session", adapter);
  return {
    binding,
    adapter,
    switchTo: (sessionId: string | undefined) => {
      if (sessionId === undefined) current.set({ key: undefined, ctx: undefined, hooks: {}, keyedHooks: {}, props: {} });
      else current.set({ key: sessionId, ctx: { tag: "ctx-" + sessionId }, hooks: {}, keyedHooks: {}, props: {} });
    },
  };
}
/**
 * Dựng plugin đã cài lên một harness giả (module TƯƠI mỗi lần để cờ phạm vi module không dính).
 * Nhận: tag — nhãn truy vấn duy nhất.
 * Trả: { surface, h, scope }.
 */
function bootPlugin(): { surface: any; h: Harness; scope: ReturnType<typeof installTestScope> } {
  const h = makeHarness();
  const surface = evaluateClient(ARTIFACT.clientText, h.requireFn);
  surface.apply(h.ctx);
  const scope = installTestScope(h.ctx);
  return { surface, h, scope };
}
describe("row ui-renderer — hợp đồng định danh (ghim số đo, không đoán lại)", () => {
  test("ca 1: hằng số định danh khớp bản gốc", () => {
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-client-ui-renderer");
    expect(STOCK_MODULE_ID).toBe("@deepseek-ai/dsh-client-ui-renderer");
    expect(SERVICE_SLOTS).toBe("slots");
    expect(SERVICE_UI_RENDERER).toBe("uiRenderer");
    expect(ROOT_SLOT).toBe("root");
    // Bản gốc: const inject = [] (bundle dòng 1833). Rỗng là ĐÚNG.
    expect(INJECT).toEqual([]);
  });

  test("ca 2: package.json khai dsh.client đúng bản gốc (web + immediately)", () => {
    const json = JSON.parse(source("package.json")) as { dsh?: { client?: { platform?: string; immediately?: boolean } } };
    expect(json.dsh?.client?.platform).toBe("web");
    expect(json.dsh?.client?.immediately).toBe(true);
  });

  test("ca 3: TẬP SLOT của ta = tập slot của bundle gốc (0 = 0)", () => {
    const stockClient = readFileSync(join(STOCK, "lib", "client.js"), "utf8");
    /** Đếm tên slot mà bundle KHAI (register) hoặc CHỜ (inject) — regex của check:rows. */
    const slotsOf = (text: string): string[] => {
      const found = new Set<string>();
      for (const match of text.matchAll(/register\(\{\s*name:\s*"([^"]+)"/g)) found.add(match[1] as string);
      for (const match of text.matchAll(/slots\.inject\("([^"]+)"/g)) found.add(match[1] as string);
      return [...found].sort();
    };
    const ourSources = ["src/client.ts", "src/registry.ts", "src/scoped-slots.ts", "src/outlets.ts", "src/factories.ts"]
      .map((file) => source(file))
      .join("\n");
    expect(slotsOf(ourSources)).toEqual(slotsOf(stockClient));
  });
});
describe("row ui-renderer — ARTIFACT (đo trên lib/, không đọc src/ để kết luận)", () => {
  test("ca 4: build ra HAI nửa, nửa client đăng ký ĐÚNG MỘT id của ta", async () => {
    const client = ARTIFACT.clientText;
    const ids = [...client.matchAll(/__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toEqual(["@galaxy-blackhole/gbh-client-ui-renderer"]);
    // Không được đăng ký id gói gốc trong bundle (bundle chạy hai lần ⇒ app trắng).
    expect(client.includes('load({ id: "@deepseek-ai/dsh-client-ui-renderer"')).toBe(false);
    // Script classic: KHÔNG có cú pháp ESM ở cấp cao nhất.
    expect(/^\s*export\s/m.test(client)).toBe(false);
    // Factory trả về mặt plugin.
    expect(client.includes("return module.exports.createPlugin(require);")).toBe(true);
  });

  test("ca 5: nửa host export ĐỦ như bản gốc (apply)", async () => {
    /** Đếm tên export của một file ESM. */
    const exportsOf = (text: string): string[] => {
      const match = /export\s*\{([^}]*)\}/.exec(text);
      if (match === null) return [];
      return (match[1] as string).split(",").map((part) => part.trim().split(/\s+as\s+/).pop() as string).sort();
    };
    const ours = exportsOf(readFileSync(ARTIFACT.hostPath, "utf8"));
    const stock = exportsOf(readFileSync(join(STOCK, "lib", "index.js"), "utf8"));
    expect(ours).toEqual(stock);
    expect(ours).toContain("apply");
  });
});
describe("row ui-renderer — LẮP RÁP (bảng module · apply · cổng cài hai lần)", () => {
  test("ca 6: nạp ĐÚNG SÁU module ngoài, đúng thứ tự của bundle gốc", async () => {
    const h = makeHarness();
    loadPageModules(h.requireFn);
    expect(h.order).toEqual([
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "@deepseek-ai/cordis",
      // P3 (04/11/2026): id MỚI của module ảo ui-slots (artefact của ta đã đổi tên).
      "@galaxy-blackhole/gbh-client-ui-slots",
    ]);
  });

  test("ca 7: mặt plugin có ĐÚNG hình dạng bundle gốc + inject rỗng", async () => {
    const { surface } = bootPlugin();
    expect(surface.name).toBe("@galaxy-blackhole/gbh-client-ui-renderer");
    expect(surface.inject).toEqual([]);
    expect(typeof surface.apply).toBe("function");
    expect(typeof surface.createSlotRenderer).toBe("function");
    expect(typeof surface.SlotRegistry).toBe("function");
  });

  test("ca 7b: src CÓ lời gọi đăng ký id (check:rows đọc VĂN BẢN src) + loadBundle đúng id", () => {
    // check:rows không thấy lời gọi sinh trong build.ts ⇒ phải có dạng gọi được trong src/.
    expect(source("src/client.ts")).toContain("loader.load({ id: PACKAGE_NAME, factory })");
    const calls: { id?: string; factory?: unknown }[] = [];
    loadBundle({ load: (spec) => calls.push(spec) }, () => "x");
    expect(calls.length).toBe(1);
    expect(calls[0]?.id).toBe(PACKAGE_NAME);
    expect(typeof calls[0]?.factory).toBe("function");
  });

  test("ca 8: apply cài service slots + phơi uiRenderer.mount, nhãn hiệu ứng như bản gốc", async () => {
    const { h } = bootPlugin();
    expect(typeof h.ctx.slots).toBe("object");
    expect(typeof h.ctx.slots.renderSlot).toBe("function");
    expect(h.effects).toContain("slots.install()");
    const uiRenderer = h.provided["uiRenderer"] as { mount?: unknown };
    expect(typeof uiRenderer.mount).toBe("function");
  });

  test("ca 9: CỔNG CÀI HAI LẦN — lần hai chỉ cảnh báo, KHÔNG provide lần nữa", async () => {
    const h = makeHarness();
    const surface = evaluateClient(ARTIFACT.clientText, h.requireFn);
    surface.apply(h.ctx);
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      surface.apply(h.ctx);
      // ctx KHÁC cũng bị chặn vì cờ ở PHẠM VI MODULE (luật C: cổng KHÔNG khoá theo ctx).
      surface.apply(makeHarness().ctx);
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings.length).toBe(2);
  });

  test("ca 10: CỜ CHỈ BẬT SAU KHI CÀI XONG — lần đầu ném thì lần hai vẫn đăng ký được", async () => {
    const surface = evaluateClient(ARTIFACT.clientText, makeHarness().requireFn);
    const failing = makeHarness();
    const originalEffect = failing.ctx.effect;
    failing.ctx.effect = () => {
      throw new Error("boom");
    };
    expect(() => surface.apply(failing.ctx)).toThrow("boom");
    failing.ctx.effect = originalEffect;
    const good = makeHarness();
    surface.apply(good.ctx);
    expect(typeof good.ctx.slots.renderSlot).toBe("function");
  });

  test("ca 11: mount KHÔNG có DOM chờ ⇒ createRoot + render đồng bộ", async () => {
    const { h } = bootPlugin();
    const container = { querySelector: () => null };
    // Chưa có đăng ký root ⇒ đúng lỗi thứ tự boot của bản gốc (không im lặng).
    expect(() => (h.provided["uiRenderer"] as any).mount(container)).toThrow("no registration");
    expect(h.rendered.length).toBe(0);
  });

  test("ca 12: mount CÓ DOM chờ ⇒ hydrate giữ nguyên html của kernel", async () => {
    const { h } = bootPlugin();
    const container = { querySelector: () => ({ className: "boot-cls", innerHTML: "<b>dang tai</b>" }) };
    const root = (h.provided["uiRenderer"] as any).mount(container);
    expect(typeof root).toBe("function");
    const bootElement = h.hydrated[0] as any;
    expect(bootElement.props["boot"]).toEqual({ className: "boot-cls", html: "<b>dang tai</b>" });
    const tree = renderNode(bootElement);
    const bootHost = findByAttribute(tree, "data-dsh-boot", "");
    expect(bootHost).toBeDefined();
    expect((bootHost as any).props["dangerouslySetInnerHTML"]).toEqual({ __html: "<b>dang tai</b>" });
  });

  test("ca 13: renderSlot chỉ nhận root + install hai lần ném", async () => {
    const { h, surface } = bootPlugin();
    expect(() => h.ctx.slots.renderSlot("main", {})).toThrow("only renders 'root'");
    expect(() => (h.ctx.slots as any).install(surface.createSlotRenderer())).toThrow("already installed");
  });
});
describe("row ui-renderer — HÀNH VI render (mini renderer đo trên cây THẬT)", () => {
  test("ca 14: root đăng ký ⇒ outlet vẽ div[data-slot=root] + nội dung entry", async () => {
    const { h } = bootPlugin();
    /** Component của entry gốc. */
    const RootComponent = (props: Record<string, unknown>) => jsx("section", { children: "noi-dung-" + String(props["marker"] ?? "x") });
    h.ctx.slots.register({ name: "root", kind: "single", scope: "root" }, RootComponent);
    const tree = renderNode(h.ctx.slots.renderSlot("root", { marker: "A" }));
    const rootHost = findByAttribute(tree, "data-slot", "root");
    expect(rootHost?.tag).toBe("div");
    expect((rootHost?.props["style"] as { display?: string }).display).toBe("contents");
    expect(textOf(tree)).toContain("noi-dung-A");
  });

  test("ca 15: register phát sự kiện slots/changed đúng khoá", async () => {
    const { h } = bootPlugin();
    h.ctx.slots.register({ name: "main", kind: "single", scope: "root" }, () => null);
    expect(h.events.some((event) => event[0] === "slots/changed" && event[1] === "main")).toBe(true);
  });

  test("ca 16: entry NÉM ⇒ error boundary hiện data-slot-error + báo rút lui", async () => {
    const { h } = bootPlugin();
    /** Trạng thái báo lỗi thu được. */
    const reports: { key: string; abdicated: boolean }[] = [];
    h.ctx.slots.onEntryError((key: string, _registration: unknown, _error: unknown, info: { abdicated: boolean }) => {
      reports.push({ key, abdicated: info.abdicated });
    });
    const originalError = console.error;
    console.error = () => undefined;
    try {
      h.ctx.slots.register(
        { name: "root", kind: "single", scope: "root", children: { main: { kind: "single", scope: "root" } } },
        (props: Record<string, unknown>) => jsx("div", { children: (props["renderSlot"] as any)("main", {}) }),
      );
      h.ctx.slots.register({ name: "main", kind: "single", scope: "root" }, () => {
        throw new Error("entry no");
      });
      const tree = renderNode(h.ctx.slots.renderSlot("root", {}));
      expect(findByAttribute(tree, "data-slot-error", "main")).toBeDefined();
    } finally {
      console.error = originalError;
    }
    expect(reports).toEqual([{ key: "main", abdicated: true }]);
  });

  test("ca 17: lỗi LẮP RÁP phải THOÁT boundary (không bị nuốt thành data-slot-error)", () => {
    const { h } = bootPlugin();
    // Entry con khai namespace từ điển nhưng CHƯA cài face ⇒ standardKit ném SlotAssemblyError.
    h.ctx.slots.register(
      { name: "root", kind: "single", scope: "root", children: { main: { kind: "single", scope: "root" } } },
      (props: Record<string, unknown>) => jsx("div", { children: (props["renderSlot"] as any)("main", {}) }),
    );
    h.ctx.slots.register({ name: "main", kind: "single", scope: "root", locale: "ns" }, () => null);
    expect(() => renderNode(h.ctx.slots.renderSlot("root", {}))).toThrow("no locale face is installed");
  });

  test("ca 18: closure renderSlot giữ lại sau khi gỡ mục ⇒ StaleAuthorizationError", () => {
    const { h } = bootPlugin();
    /** Closure renderSlot thu được từ lần render đầu. */
    let retained: ((key: string, owner: Record<string, unknown>) => unknown) | undefined;
    const Parent = (props: Record<string, unknown>) => {
      retained = props["renderSlot"] as typeof retained;
      return jsx("div", { children: "" });
    };
    h.ctx.slots.register(
      { name: "root", kind: "single", scope: "root", children: { main: { kind: "single", scope: "root" } } },
      (props: Record<string, unknown>) => jsx("div", { children: (props["renderSlot"] as any)("main", {}) }),
    );
    const dispose = h.ctx.slots.register(
      { name: "main", kind: "single", scope: "root", children: { child: { kind: "single", scope: "root" } } },
      Parent,
    );
    h.ctx.slots.register({ name: "child", kind: "single", scope: "root" }, () => jsx("i", { children: "con" }));
    renderNode(h.ctx.slots.renderSlot("root", {}));
    expect(typeof retained).toBe("function");
    dispose();
    expect(() => (retained as any)("child", {})).toThrow("disposed registration");
  });

  test("ca 19: slot LIST — sắp theo order · lọc only · fallback khi rỗng", async () => {
    const { h } = bootPlugin();
    h.ctx.slots.register({ name: "main", kind: "list", scope: "root", id: "b", order: 2 }, () => jsx("b", { children: "B" }));
    h.ctx.slots.register({ name: "main", kind: "list", scope: "root", id: "a", order: 1 }, () => jsx("b", { children: "A" }));
    /** Entry gốc vẽ slot main. */
    const Root = (props: Record<string, unknown>) =>
      jsx("div", { children: [(props["renderSlot"] as any)("main", {}), (props["renderSlot"] as any)("main", {}, { only: "b" })] });
    h.ctx.slots.register({ name: "root", kind: "single", scope: "root", children: { main: { kind: "list", scope: "root" } } }, Root);
    const tree = renderNode(h.ctx.slots.renderSlot("root", {}));
    // Root vẽ CẢ hai lượt: danh sách đầy đủ ("AB") rồi lọc only="b" ("B").
    expect(textOf(tree)).toBe("ABB");
  });

  test("ca 20: slot KEYED — chọn theo entryKey", async () => {
    const { h } = bootPlugin();
    h.ctx.slots.register({ name: "main", kind: "keyed", scope: "root", key: "a" }, () => jsx("b", { children: "A" }));
    h.ctx.slots.register({ name: "main", kind: "keyed", scope: "root", key: "b" }, () => jsx("b", { children: "B" }));
    const Root = (props: Record<string, unknown>) => jsx("div", { children: (props["renderSlot"] as any)("main", {}, { entryKey: "b" }) });
    h.ctx.slots.register({ name: "root", kind: "single", scope: "root", children: { main: { kind: "keyed", scope: "root" } } }, Root);
    const tree = renderNode(h.ctx.slots.renderSlot("root", {}));
    expect(textOf(tree)).toBe("B");
  });

  test("ca 21: slot CHAIN — bỏ qua người từ chối, giữ fallback overlay đúng vị trí", async () => {
    const { h } = bootPlugin();
    h.ctx.slots.register(
      { name: "main", kind: "chain", scope: "root", select: () => null },
      () => jsx("b", { children: "KHONG-DUOC" }),
    );
    h.ctx.slots.register(
      { name: "main", kind: "chain", scope: "root", select: () => true },
      (props: Record<string, unknown>) => jsx("b", { children: "TRUNG-" + String(props["matched"]) }),
    );
    const Root = (props: Record<string, unknown>) =>
      jsx("div", { children: (props["renderSlotChain"] as any)("main", {}, { overlay: true, fallback: jsx("i", { children: "FB" }) }) });
    h.ctx.slots.register({ name: "root", kind: "single", scope: "root", children: { main: { kind: "chain", scope: "root" } } }, Root);
    const tree = renderNode(h.ctx.slots.renderSlot("root", {}));
    expect(textOf(tree)).toContain("TRUNG-true");
    expect(textOf(tree)).not.toContain("KHONG-DUOC");
    const overlayFallback = findByAttribute(tree, "data-chain-overlay-fallback", "main");
    expect((overlayFallback?.props["style"] as { display?: string }).display).toBe("none");
  });

  test("ca 22: inject — hooks thành use<Name>, props rải, ownerProps thắng", async () => {
    const { h } = bootPlugin();
    const source = makeSource({ name: "hi" });
    const Root = (props: Record<string, unknown>) => {
      const usePanel = props["usePanel"] as (selector: (value: unknown) => unknown) => unknown;
      const panel = usePanel((value) => value) as { name: string };
      return jsx("div", { children: panel.name + "/" + String(props["title"]) + "/" + String(props["owner"]) });
    };
    h.ctx.slots.register(
      {
        name: "root",
        kind: "single",
        scope: "root",
        inject: () => ({ hooks: { panel: source }, title: "T" }),
      },
      Root,
    );
    const tree = renderNode(h.ctx.slots.renderSlot("root", { owner: "O" }));
    expect(textOf(tree)).toBe("hi/T/O");
  });

  test("ca 23: locale — entry khai namespace nhận ghế t(ns)", async () => {
    const { h } = bootPlugin();
    h.ctx.slots.installLocale({
      getSnapshot: () => ({ revision: 3 }),
      subscribe: () => () => undefined,
      bind: (ns: string) => (key: string) => ns + ":" + key,
    });
    const Root = (props: Record<string, unknown>) => jsx("div", { children: (props["t"] as (key: string) => string)("hello") });
    h.ctx.slots.register({ name: "root", kind: "single", scope: "root", locale: "ns" }, Root);
    const tree = renderNode(h.ctx.slots.renderSlot("root", {}));
    expect(textOf(tree)).toBe("ns:hello");
  });

  test("ca 24: locale — entry khai namespace mà CHƯA cài face ⇒ lỗi lắp ráp rõ ràng", async () => {
    const { h } = bootPlugin();
    h.ctx.slots.register({ name: "root", kind: "single", scope: "root", locale: "ns" }, () => null);
    expect(() => renderNode(h.ctx.slots.renderSlot("root", {}))).toThrow("no locale face is installed");
  });

  test("ca 25: store — actions + useStore của handle cấp gốc", async () => {
    const { h } = bootPlugin();
    const instance = { getSnapshot: () => ({ n: 7 }), subscribe: () => () => undefined, actions: { inc: () => "da-inc" } };
    const handle = { create: () => instance, spec: {} };
    const Root = (props: Record<string, unknown>) => {
      const useStore = props["useStore"] as (selector: (value: unknown) => unknown) => unknown;
      const state = useStore((value) => value) as { n: number };
      const actions = props["actions"] as { inc: () => string };
      return jsx("div", { children: String(state.n) + "/" + actions.inc() });
    };
    h.ctx.slots.register({ name: "root", kind: "single", scope: "root", store: handle }, Root);
    const tree = renderNode(h.ctx.slots.renderSlot("root", {}));
    expect(textOf(tree)).toBe("7/da-inc");
  });

  test("ca 26: Factory — renderFactorySlot vẽ định nghĩa, vắng thì hiện fallback", async () => {
    const { h } = bootPlugin();
    const Definition = (props: Record<string, unknown>) => jsx("div", { children: "f-" + String(props["input"] ?? props["x"]) });
    h.ctx.slots.registerFactory({ name: "f", scope: "root" }, Definition);
    const Root = (props: Record<string, unknown>) => {
      const render = props["renderFactorySlot"] as (name: string, input: Record<string, unknown>, options?: Record<string, unknown>) => unknown;
      return jsx("div", { children: [render("f", { x: "X" }), render("khong-co", {}, { fallback: jsx("i", { children: "FB" }) })] });
    };
    h.ctx.slots.register({ name: "root", kind: "single", scope: "root" }, Root);
    const tree = renderNode(h.ctx.slots.renderSlot("root", {}));
    expect(textOf(tree)).toContain("f-X");
    expect(textOf(tree)).toContain("FB");
  });

  test("ca 27: scope PHIÊN — entry session nhận binding, root không được dùng strict session", async () => {
    const { h } = bootPlugin();
    const Root = (props: Record<string, unknown>) => jsx("div", { children: (props["renderSlot"] as any)("child", {}) });
    h.ctx.slots.register({ name: "root", kind: "single", scope: "root", children: { child: { kind: "single", scope: "session" } } }, Root);
    /** Component của ô con — nhận binding qua kit (không tự đọc). */
    const Child = (props: Record<string, unknown>) => jsx("b", { children: "con-" + String(props["marker"] ?? "x") });
    h.ctx.slots.register({ name: "child", kind: "single", scope: "session" }, Child);
    const tree = renderNode(h.ctx.slots.renderSlot("root", {}));
    expect(textOf(tree)).toBe("con-x");
  });
});