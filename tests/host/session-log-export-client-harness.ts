/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc HARNESS dùng chung cho test A/B nửa CLIENT của @galaxy-blackhole/gbh-session-log-export: dựng seam
 *      GIẢ (bảng module, document, fetch, context browser), build hai nửa, nạp artifact của ta + bundle
 *      GỐC @deepseek-ai/dsh-session-log-export, và cấp các hàm lái kịch bản cho tệp test. KHÔNG gọi mạng.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildHalves } from "../../packages/host/session-log-export/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session-log-export");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-log-export");
/** Bundle GỐC đã build trong kernel. */
const STOCK_CLIENT = join(STOCK_DIR, "lib", "client.js");
/** Id module của ta (MỘT-ID). */
const OURS_PACKAGE = "@galaxy-blackhole/gbh-session-log-export";
/** Id module của gói gốc — phải BIẾN MẤT khỏi artifact nửa client. */
const STOCK_PACKAGE = "@deepseek-ai/dsh-session-log-export";

/** Một đăng ký module bắt được từ bundle (mỗi lần nạp là một instance factory). */
interface Registration {
  /** Id module bundle tự khai. */
  readonly id: string;
  /** Factory nhận bảng module. */
  readonly factory: (requireFn: RequireFn) => unknown;
}

/** Hàm require của bảng module. */
type RequireFn = (specifier: string) => unknown;

/** Hợp đồng plugin phía browser. */
interface Plugin {
  /** Cài vào context. */
  apply(ctx: Record<string, unknown>): void;
  /** Service cần. */
  readonly inject: string[];
}

/** Store quan sát được của seam client-store. */
interface FakeStore<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot(): T;
  /** Ghi đè. */
  set(next: T): void;
  /** Sửa tại chỗ. */
  update(mutate: (draft: T) => void): void;
  /** Theo dõi thay đổi. */
  subscribe(listener: () => void): () => void;
}

/** Trạng thái hộp thoại của MỘT Session. */
interface Entry {
  /** Hộp thoại đang mở. */
  readonly open: boolean;
  /** Pha. */
  readonly status: "downloading" | "success" | "error";
  /** Lỗi gần nhất. */
  readonly error: string | null;
}

/** Trạng thái tải khoá theo Session. */
interface State {
  /** Bản đồ Session id → trạng thái. */
  bySession: Record<string, Entry | undefined>;
}

/** Bộ điều khiển tải mà plugin cấp qua ctx.provide. */
interface Controller {
  /** Store trạng thái. */
  readonly store: FakeStore<State>;
  /** Tải một Session. */
  download(sessionId: string): Promise<void>;
  /** Đóng hộp thoại. */
  dismiss(sessionId: string): void;
  /** Huỷ mọi lượt tải. */
  dispose(): Promise<void>;
}

/** Mặt tiêm của slot occupant. */
interface Face {
  /** Hook của occupant. */
  hooks: {
    /** Store tải xuống. */
    sessionLogDownload: unknown;
    /** Store khả dụng phản hồi. */
    feedbackAvailable: FakeStore<boolean>;
  };
  /** Yêu cầu tải. */
  request(sessionId: string): Promise<void>;
  /** Đóng hộp thoại. */
  dismiss(sessionId: string): void;
  /** Mở bản nháp phản hồi. */
  openFeedback(sessionId: string): void;
}

/** Phần tử do jsx giả sinh ra. */
interface Element {
  /** Loại phần tử. */
  readonly type: unknown;
  /** Props. */
  readonly props: Record<string, unknown>;
  /** Key. */
  readonly key?: unknown;
}

/** Thẻ style do document giả ghi lại. */
interface StyleTag {
  /** Dataset của thẻ. */
  readonly dataset: Record<string, string>;
  /** Nội dung CSS. */
  textContent: string;
}

/** Thẻ a do document giả ghi lại. */
interface AnchorTag {
  /** href. */
  href: string;
  /** Tên tệp tải. */
  download: string;
  /** Số lần click. */
  clicks: number;
  /** Bấm tải. */
  click(): void;
}

/** Document giả (chỉ phần nửa client dùng). */
interface FakeDocument {
  /** Tìm thẻ style theo selector. */
  querySelector(selector: string): StyleTag | null;
  /** Tạo phần tử. */
  createElement(tag: string): StyleTag | AnchorTag;
  /** Đầu tài liệu. */
  head: { appendChild(node: unknown): void };
}

/** Một lượt gọi fetch bắt được. */
interface FetchCall {
  /** Đầu vào. */
  readonly input: string;
  /** Phương thức. */
  readonly method: string | undefined;
  /** Tín hiệu huỷ. */
  readonly signal: AbortSignal | undefined;
}

/** Mạng giả: các lượt gọi + hàm khôi phục fetch thật. */
interface FetchNetwork {
  /** Các lượt gọi theo thứ tự. */
  readonly calls: FetchCall[];
  /** Khôi phục fetch cũ. */
  restore(): void;
}

/** Kết quả một bên của phép A/B. */
interface SideResult<T> {
  /** Giá trị thu được. */
  value: T;
  /** Thẻ style sinh trong lần dựng factory. */
  styles: StyleTag[];
  /** Thẻ a sinh trong lượt chạy. */
  anchors: AnchorTag[];
}

/** Bản ghi của context giả. */
interface HarnessRecord {
  /** Service đã cấp. */
  readonly provided: Map<string, unknown>;
  /** Hiệu ứng + hàm dọn. */
  readonly effects: { label: string | undefined; cleanup: unknown }[];
  /** Lượt đăng ký từ điển. */
  readonly locales: { namespace: string; copy: { zh: Record<string, string>; en: Record<string, string> } }[];
  /** Tên service đã inject. */
  readonly injectNames: string[][];
  /** Callback inject chờ service. */
  readonly injectCallbacks: ((scope: { effect(run: () => unknown, label?: string): void }) => void)[];
  /** Sự kiện đã nghe. */
  readonly listeners: Map<string, (...args: never[]) => void>;
  /** Slot đã inject. */
  readonly slotInjections: { name: string; result: unknown }[];
  /** Occupant đã đăng ký. */
  readonly registrations: { definition: { name: string; id: string; locale: string; inject(): unknown }; component: unknown }[];
  /** Service đọc được bằng ctx.get. */
  readonly services: Map<string, unknown>;
}

/** Context giả + bản ghi + thao tác điều khiển. */
interface Harness {
  /** Context truyền cho apply. */
  readonly ctx: Record<string, unknown>;
  /** Bản ghi. */
  readonly record: HarnessRecord;
  /** Kích hoạt callback feedbackUi (service vừa xuất hiện). */
  activateFeedback(): void;
}

/** Trạng thái CSS/thẻ a dùng chung cho cả tệp. */
const styles: StyleTag[] = [];
const anchors: AnchorTag[] = [];

/** Document giả. */
const fakeDocument: FakeDocument = {
  querySelector(selector: string): StyleTag | null {
    const match = /^style\[data-plugin-css="(.*)"\]$/u.exec(selector);
    if (match === null) return null;
    const tagId = match[1] ?? "";
    return styles.find((style) => style.dataset["pluginCss"] === tagId) ?? null;
  },
  createElement(tag: string): StyleTag | AnchorTag {
    if (tag === "style") {
      const style: StyleTag = { dataset: {}, textContent: "" };
      styles.push(style);
      return style;
    }
    if (tag === "a") {
      const anchor: AnchorTag = {
        href: "",
        download: "",
        clicks: 0,
        click(): void {
          this.clicks += 1;
        },
      };
      anchors.push(anchor);
      return anchor;
    }
    throw new Error("document giả không tạo được thẻ: " + tag);
  },
  head: {
    appendChild(): void {
      // Thẻ style đã được ghi vào mảng styles lúc createElement.
    },
  },
};

/** Xoá dấu vết trình duyệt giữa hai lần dựng. */
function resetBrowser(): void {
  styles.length = 0;
  anchors.length = 0;
}

/**
 * Nạp artifact client của ta (script classic) trong window giả và bắt lời gọi đăng ký.
 * Nhận: text — văn bản artifact đã build (CJS bọc classic script đăng ký MỘT id).
 * Trả: { registrations, exports } — đăng ký bắt được và namespace export do factory trả về.
 */
function loadClassicModule(text: string): { registrations: Registration[]; exports: Record<string, unknown> } {
  const seen: Registration[] = [];
  const windowStub = {
    __ModuleLoader__: {
      load(registration: Registration): void {
        seen.push(registration);
      },
    },
  };
  new Function("window", text)(windowStub);
  const first = seen[0];
  const exports = first === undefined ? {} : (first.factory(makeRequire()) as Record<string, unknown>);
  return { registrations: seen, exports };
}

/**
 * Nạp bundle GỐC (script classic) trong window giả và bắt lời gọi đăng ký.
 * Nhận: không.
 * Trả: đăng ký DUY NHẤT của bundle gốc.
 */
function loadStockRegistration(): Registration {
  const seen: Registration[] = [];
  const windowStub = {
    __ModuleLoader__: {
      load(registration: Registration): void {
        seen.push(registration);
      },
    },
  };
  new Function("window", readFileSync(STOCK_CLIENT, "utf8"))(windowStub);
  const first = seen[0];
  if (first === undefined) throw new Error("bundle gốc không đăng ký module nào");
  return first;
}

/**
 * Dựng bảng module giả cho một lần materialize factory (seam cấu trúc).
 * Nhận: không.
 * Trả: hàm require trả store/react/jsx-runtime/ui-primitives giả.
 */
function makeRequire(): RequireFn {
  const storeModule = makeStoreModule();
  const react = makeReactModule();
  return (specifier: string): unknown => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    if (specifier .endsWith("-client-store")) return storeModule;
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (specifier === "react") return react;
    if (specifier .endsWith("-client-ui-primitives")) return PRIMITIVES;
    throw new Error("module lạ: " + specifier);
  };
}

/** Bảng store giả của seam client-store. */
function makeStoreModule(): { createSnapshotStore<T>(initial: T): FakeStore<T> } {
  return {
    createSnapshotStore<T>(initial: T): FakeStore<T> {
      let value = initial;
      const listeners = new Set<() => void>();
      const emit = (): void => {
        for (const listener of [...listeners]) listener();
      };
      return {
        getSnapshot: (): T => value,
        set(next: T): void {
          value = next;
          emit();
        },
        update(mutate: (draft: T) => void): void {
          const draft = structuredClone(value) as T;
          mutate(draft);
          value = draft;
          emit();
        },
        subscribe(listener: () => void): () => void {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
    },
  };
}

/** Bảng react giả: useState giữ state của một lần materialize (đủ cho phép đo cây). */
function makeReactModule(): { useState<T>(initial: T): readonly [T, (next: T | ((value: T) => T)) => void] } {
  let current: unknown;
  let initialized = false;
  return {
    useState<T>(initial: T): readonly [T, (next: T | ((value: T) => T)) => void] {
      if (!initialized) {
        current = initial;
        initialized = true;
      }
      const set = (next: T | ((value: T) => T)): void => {
        current = typeof next === "function" ? (next as (value: T) => T)(current as T) : next;
      };
      return [current as T, set] as const;
    },
  };
}

/** jsx giả — cùng một khuôn cho cả hai bên. */
const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown): Element => ({ type, props: props ?? {}, key });

/** Runtime jsx giả. */
const jsxRuntime = { jsx, jsxs: jsx, Fragment: "Fragment" };

/** Primitive giả — sentinel chuỗi để cây hai bên so được. */
const PRIMITIVES = {
  Modal: "[Modal]",
  Button: "[Button]",
  Menu: "[Menu]",
  IconDownloadOutlineRegular: "[IconDownloadOutlineRegular]",
  IconPaperPlaneOutlineRegular: "[IconPaperPlaneOutlineRegular]",
  IconEllipsisOutlineRegular: "[IconEllipsisOutlineRegular]",
} as const;

/**
 * Dựng context giả ghi lại mọi tương tác của apply.
 * Nhận: không.
 * Trả: harness { ctx, record, activateFeedback }.
 */
function createHarness(): Harness {
  const record: HarnessRecord = {
    provided: new Map(),
    effects: [],
    locales: [],
    injectNames: [],
    injectCallbacks: [],
    listeners: new Map(),
    slotInjections: [],
    registrations: [],
    services: new Map(),
  };
  const effect = (run: () => unknown, label?: string): void => {
    record.effects.push({ label, cleanup: run() });
  };
  const scope = { effect };
  const ctx: Record<string, unknown> = {
    provide(name: string, service: unknown): void {
      record.provided.set(name, service);
    },
    effect,
    inject(names: readonly string[], callback: (inner: { effect(run: () => unknown, label?: string): void }) => void): void {
      record.injectNames.push([...names]);
      record.injectCallbacks.push(callback);
    },
    on(event: string, listener: (...args: never[]) => void): void {
      record.listeners.set(event, listener);
    },
    get(name: string): unknown {
      return record.services.get(name);
    },
    locale: {
      register(namespace: string, copy: { zh: Record<string, string>; en: Record<string, string> }): () => void {
        record.locales.push({ namespace, copy });
        return () => undefined;
      },
    },
    slots: {
      inject(name: string, callback: () => unknown): unknown {
        const result = callback();
        record.slotInjections.push({ name, result });
        return result;
      },
      register(definition: { name: string; id: string; locale: string; inject(): unknown }, component: unknown): () => void {
        record.registrations.push({ definition, component });
        return () => undefined;
      },
    },
  };
  return {
    ctx,
    record,
    activateFeedback(): void {
      const callback = record.injectCallbacks[0];
      if (callback === undefined) throw new Error("không có callback feedbackUi");
      callback(scope);
    },
  };
}

/** Hai bên của phép A/B. */
type SideKind = "stock" | "ours";

/** Đăng ký đã nạp của mỗi bên (gán trong beforeAll). */
let stockRegistration: Registration | undefined;
let oursRegistration: Registration | undefined;

/** Thư mục tạm + artifact (gán trong beforeAll). */
let outDir = "";
let hostArtifact = "";
let clientArtifact = "";
let clientText = "";
/** Số lần artifact tự đăng ký module khi nạp (gán trong beforeAll). */
let oursRegistrationCount = 0;

/** Export của artifact nửa client (gán trong beforeAll). */
let oursExports: Record<string, unknown> = {};

/**
 * Dựng phòng thí nghiệm A/B: build hai nửa, nạp artifact của ta + bundle gốc, cài document giả.
 * Nhận: không.
 * Trả: sau khi cả hai bên sẵn sàng.
 */
async function setupLab(): Promise<void> {
  outDir = mkdtempSync(join(tmpdir(), "gbh-session-log-export-client-"));
  const halves = await buildHalves(outDir);
  hostArtifact = halves.index;
  clientArtifact = halves.client;
  clientText = readFileSync(clientArtifact, "utf8");
  const loaded = loadClassicModule(clientText);
  oursExports = loaded.exports;
  oursRegistrationCount = loaded.registrations.length;
  oursRegistration = loaded.registrations[0];
  stockRegistration = loadStockRegistration();
  const globals = globalThis as unknown as { document?: unknown };
  globals.document = fakeDocument;
}

/**
 * Dọn phòng thí nghiệm: gỡ document giả và xoá thư mục tạm.
 * Nhận: không.
 * Trả: sau khi dọn xong.
 */
export async function teardown(): Promise<void> {
  const globals = globalThis as unknown as { document?: unknown };
  delete globals.document;
  if (outDir !== "") await rm(outDir, { recursive: true, force: true });
}

await setupLab();

/**
 * Lấy đăng ký đã nạp của một bên.
 * Nhận: kind — "stock" hoặc "ours".
 * Trả: đăng ký module.
 */
function registrationFor(kind: SideKind): Registration {
  const registration = kind === "stock" ? stockRegistration : oursRegistration;
  if (registration === undefined) throw new Error("chưa nạp bundle " + kind);
  return registration;
}

/**
 * Materialize một bên với bảng module giả MỚI.
 * Nhận: kind — bên cần dựng.
 * Trả: plugin { apply, inject }.
 */
function pluginFor(kind: SideKind): Plugin {
  const materialized = registrationFor(kind).factory(makeRequire()) as Record<string, unknown>;
  // 19/10/2026: nửa client của ta giờ trả THẲNG plugin object ({ apply, inject }) từ factory — đúng hợp đồng
  // loader ("lấy module.exports làm plugin") và khớp surface của bundle gốc.
  return materialized as unknown as Plugin;
}

/**
 * Chạy một kịch bản trên MỘT bên, sau khi xoá dấu vết trình duyệt và materialize factory.
 * Nhận: kind — bên chạy; action — kịch bản nhận harness.
 * Trả: giá trị kịch bản + thẻ style/anchor sinh ra.
 */
async function side<T>(kind: SideKind, action: (harness: Harness) => Promise<T> | T): Promise<SideResult<T>> {
  resetBrowser();
  const plugin = pluginFor(kind);
  const harness = createHarness();
  plugin.apply(harness.ctx);
  const value = await action(harness);
  return { value, styles: [...styles], anchors: [...anchors] };
}

/**
 * Lấy controller đã cấp.
 * Nhận: harness — context giả.
 * Trả: bộ điều khiển tải.
 */
function controllerOf(harness: Harness): Controller {
  const controller = harness.record.provided.get("sessionLogDownload");
  if (controller === undefined) throw new Error("apply không cấp sessionLogDownload");
  return controller as Controller;
}

/**
 * Lấy mặt tiêm của occupant Header.
 * Nhận: harness — context giả.
 * Trả: face { hooks, request, dismiss, openFeedback }.
 */
function faceOf(harness: Harness): Face {
  const registration = harness.record.registrations[0];
  if (registration === undefined) throw new Error("apply không đăng ký slot occupant");
  return registration.definition.inject() as Face;
}

/**
 * Dựng cây Header action với hook giả đọc store thật của controller/feedback.
 * Nhận: harness — context giả.
 * Trả: phần tử gốc.
 */
function renderHeader(harness: Harness): Element {
  const registration = harness.record.registrations[0];
  if (registration === undefined) throw new Error("không có occupant Header");
  const component = registration.component;
  if (typeof component !== "function") throw new Error("occupant Header không phải component");
  const controller = controllerOf(harness);
  const face = faceOf(harness);
  const tree = (component as (props: Record<string, unknown>) => unknown)({
    sessionId: "s1",
    useSessionLogDownload: (select: (state: State) => Entry | undefined): Entry | undefined => select(controller.store.getSnapshot()),
    useFeedbackAvailable: (select: (value: boolean) => boolean): boolean => select(face.hooks.feedbackAvailable.getSnapshot()),
    request: face.request,
    dismiss: face.dismiss,
    openFeedback: face.openFeedback,
    t: (key: string): string => "t:" + key,
  });
  return tree as Element;
}

/**
 * Lấy phần tử Menu trong cây Header.
 * Nhận: tree — cây Header.
 * Trả: phần tử Menu.
 */
function menuOf(tree: Element): Element {
  const children = tree.props["children"] as Element[];
  const menu = children[0];
  if (menu === undefined) throw new Error("cây Header thiếu Menu");
  return menu;
}

/**
 * Dựng hộp thoại từ phần tử con của cây Header.
 * Nhận: tree — cây Header; harness — context giả.
 * Trả: phần tử Modal.
 */
function renderDialog(tree: Element, harness: Harness): Element {
  const children = tree.props["children"] as Element[];
  const dialog = children[1];
  if (dialog === undefined) throw new Error("cây Header thiếu Dialog");
  const component = dialog.type;
  if (typeof component !== "function") throw new Error("Dialog không phải component");
  const controller = controllerOf(harness);
  const face = faceOf(harness);
  const modal = (component as (props: Record<string, unknown>) => unknown)({
    sessionId: "s1",
    useSessionLogDownload: (select: (state: State) => Entry | undefined): Entry | undefined => select(controller.store.getSnapshot()),
    dismiss: face.dismiss,
    t: (key: string): string => "t:" + key,
  });
  return modal as Element;
}

/** Thay hàm bằng nhãn để so cây giữa hai bên. */
function canonical(value: unknown): unknown {
  if (typeof value === "function") return "[function]";
  if (Array.isArray(value)) return value.map((item) => canonical(item));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = canonical(item);
    return out;
  }
  return value;
}

/** Mạng giả: thay fetch toàn cục, ghi lượt gọi, trả phản hồi do handler quyết. */
function installFetch(handler: (call: FetchCall) => Promise<unknown>): FetchNetwork {
  const globals = globalThis as unknown as { fetch: typeof fetch };
  const before = globals.fetch;
  const calls: FetchCall[] = [];
  globals.fetch = ((input: string | URL | Request, init?: RequestInit): Promise<unknown> => {
    const call: FetchCall = { input: String(input), method: init?.method, signal: init?.signal ?? undefined };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return {
    calls,
    restore(): void {
      globals.fetch = before;
    },
  };
}

/** Phản hồi thành công giả. */
function successResponse(): unknown {
  return { ok: true, status: 200, text: async (): Promise<string> => "" };
}

/** Phản hồi lỗi giả. */
function failureResponse(status: number, detail: string): unknown {
  return { ok: false, status, text: async (): Promise<string> => detail };
}

/** Một lời hứa có thể giải quyết từ ngoài. */
interface Deferred<T> {
  /** Lời hứa. */
  readonly promise: Promise<T>;
  /** Giải quyết. */
  resolve(value: T): void;
  /** Từ chối. */
  reject(reason: unknown): void;
}

/** Tạo deferred. */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Chờ vài microtask để lượt tải không await kịp công bố trạng thái. */
async function settle(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

/** Đếm số lần xuất hiện bằng grep thật. */
function grepCount(path: string, needle: string): number {
  const run = Bun.spawnSync({ cmd: ["grep", "-c", "-F", needle, path], stdout: "pipe", stderr: "pipe" });
  const text = run.stdout.toString().trim();
  return text === "" ? 0 : Number(text);
}

/** Liệt kê tên export của một file ESM (cùng bốn khuôn với tools/check/rows.ts). */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/gu)) out.add(match[1] as string);
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/gu)) {
    for (const part of (match[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  // CJS bọc classic script: Bun sinh __export(exports_x, { ten: () => ten, ... }) — đọc bảng đó.
  for (const match of text.matchAll(/__export\(\s*[A-Za-z0-9_$]+\s*,\s*\{([^}]*)\}\s*\)/gu)) {
    for (const part of (match[1] as string).split(",")) {
      const name = part.split(":")[0]?.trim();
      if (name !== undefined && /^[A-Za-z0-9_$]+$/u.test(name)) out.add(name);
    }
  }
  if (/export\s+default/u.test(text)) out.add("default");
  return [...out].sort();
}

/** package.json của hai bên. */
interface PackageMeta {
  /** Tên package. */
  readonly name: string;
  /** Entry host. */
  readonly main: string;
  /** Bảng export. */
  readonly exports?: Record<string, unknown>;
  /** Khai báo nửa browser. */
  readonly dsh?: { client?: { inject?: string[]; platform?: string } };
}

/** Metadata hai bên (đọc một lần). */
const oursMeta = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PackageMeta;
const stockMeta = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as PackageMeta;


export {
  OURS_PACKAGE,
  STOCK_PACKAGE,
  STOCK_DIR,
  clientArtifact,
  clientText,
  hostArtifact,
  oursExports,
  oursMeta,
  stockMeta,
  oursRegistration,
  oursRegistrationCount,
  outDir,
  anchors,
  styles,
  pluginFor,
  side,
  controllerOf,
  faceOf,
  renderHeader,
  menuOf,
  renderDialog,
  canonical,
  installFetch,
  successResponse,
  failureResponse,
  deferred,
  settle,
  grepCount,
  exportNames,
};
export type {
  AnchorTag,
  Controller,
  Element,
  Entry,
  Face,
  FakeStore,
  FetchCall,
  Harness,
  Plugin,
  SideKind,
  SideResult,
  State,
  StyleTag,
};
