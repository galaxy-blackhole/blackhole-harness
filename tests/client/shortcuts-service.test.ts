/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc A/B TANG DICH VU cua row shortcuts voi chinh bundle goc: dang ky lenh · phan xử phim ·
 *      mo ta to hop · luu tuy chon · cau Desktop — tuc la chung minh HE QUA tren 10 row phu thuoc
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/** Bundle gốc (CHỈ ĐỌC) và id hai bên. */
const STOCK_BUNDLE = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-client-shortcuts/lib/client.js");
const OUR_PACKAGE = "@galaxy-blackhole/gbh-client-shortcuts";

/** Một đăng ký module. */
interface Registration {
  /** Id bundle tự khai. */
  id: string;
  /** Factory lười. */
  factory: (require: (specifier: string) => unknown) => unknown;
}

/**
 * Chạy bundle như thẻ `<script>` classic, cài `window` trong lúc nạp (Bun không có `window` toàn cục).
 * Nhận: `code` — nguồn bundle.
 * Trả: các đăng ký.
 */
function runBundle(code: string): Registration[] {
  const registrations: Registration[] = [];
  const scope = globalThis as unknown as Record<string, unknown>;
  const previousLoader = scope["__ModuleLoader__"];
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  scope["__ModuleLoader__"] = { load: (registration: Registration) => registrations.push(registration) };
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true, writable: true });
  try {
    new Function(code)();
  } finally {
    if (previousLoader === undefined) delete scope["__ModuleLoader__"];
    else scope["__ModuleLoader__"] = previousLoader;
    if (windowDescriptor === undefined) delete scope["window"];
    else Object.defineProperty(globalThis, "window", windowDescriptor);
  }
  return registrations;
}

/** Nguồn bundle của ta (build một lần). */
let ourCode: string | undefined;

/**
 * Build nửa client của ta vào thư mục tạm rồi trả nguồn bundle.
 * Nhận: không.
 * Trả: nguồn `lib/client.js`.
 */
async function bundleOfOurs(): Promise<string> {
  if (ourCode !== undefined) return ourCode;
  const { buildPackage } = await import("../../packages/client/shortcuts/build.ts");
  const out = await mkdtemp(join(tmpdir(), "gbh-shortcuts-"));
  await buildPackage(out);
  ourCode = readFileSync(join(out, "client.js"), "utf8");
  return ourCode;
}

/** Sự kiện DOM giả. */
type Listener = (event: unknown) => void;

/** Môi trường DOM/window tối thiểu — CHỈ những gì bundle gốc thật sự đụng tới. */
interface FakeEnvironment {
  /** Cửa sổ. */
  window: Record<string, unknown>;
  /** Tài liệu. */
  document: Record<string, unknown>;
  /** Nội dung localStorage. */
  store: Map<string, string>;
  /** Nhãn hiệu ứng đã gắn. */
  effectLabels: string[];
  /** Listener đã đăng ký trên window, theo loại sự kiện. */
  windowListeners: Map<string, ((event: unknown) => void)[]>;
  /** Listener của cầu bàn phím native (chỉ Desktop). */
  nativeListeners: ((input: unknown) => void)[];
  /** Cầu Desktop (nếu có). */
  desktop?: { shortcuts?: Record<string, unknown>; keyboard?: Record<string, unknown> };
}

/** Sự kiện bàn phím giả — chỉ những trường mà adapter gốc đọc. */
interface FakeKeyEvent {
  /** Mã phím vật lý. */
  code: string;
  /** Phím chữ (dùng cho `event.key`). */
  key: string;
  /** Trạng thái các phím bổ trợ. */
  ctrlKey: boolean;
  /** Alt. */
  altKey: boolean;
  /** Shift. */
  shiftKey: boolean;
  /** Meta. */
  metaKey: boolean;
  /** Phím tự động lặp. */
  repeat: boolean;
  /** Đã bị chặn trước đó. */
  defaultPrevented: boolean;
}

/**
 * Bấm một phím vào môi trường giả: gọi mọi listener `keydown` đã đăng ký trên window.
 * Nhận: `environment` — môi trường, `event` — sự kiện giả.
 * Trả: sự kiện sau khi chạy (đọc `defaultPrevented` để biết đã bị tiêu thụ).
 */
function pressKey(environment: FakeEnvironment, event: FakeKeyEvent): FakeKeyEvent {
  const synthetic = {
    ...event,
    composedPath: () => [] as unknown[],
    getModifierState: () => false,
    preventDefault: () => {
      synthetic.defaultPrevented = true;
    },
  };
  for (const listener of environment.windowListeners.get("keydown") ?? []) listener(synthetic);
  return synthetic;
}

/** Phần tử giả để giả lập vùng nhập liệu. */
function fakeTarget(kind: "page" | "editable" | "terminal"): Record<string, unknown> {
  return {
    closest: (selector: string) => (kind === "terminal" && selector === ".xterm" ? {} : kind === "editable" && selector.startsWith("input") ? {} : null),
    matches: () => false,
    isConnected: true,
    name: "",
  };
}

/**
 * Dựng môi trường giả cho một bên.
 * Nhận: `desktop` — có giả lập vỏ Desktop hay không.
 * Trả: môi trường.
 */
function makeEnvironment(desktop: boolean): FakeEnvironment {
  const store = new Map<string, string>();
  const effectLabels: string[] = [];
  const windowListeners = new Map<string, ((event: unknown) => void)[]>();
  const noop = (): void => undefined;
  const document: Record<string, unknown> = {
    documentElement: { dataset: desktop ? { platform: "darwin" } : {}, lang: "" },
    activeElement: null,
    addEventListener: noop,
    removeEventListener: noop,
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  const window: Record<string, unknown> = {
    document,
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      const list = windowListeners.get(type) ?? [];
      list.push(listener);
      windowListeners.set(type, list);
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => {
      const list = windowListeners.get(type) ?? [];
      windowListeners.set(
        type,
        list.filter((entry) => entry !== listener),
      );
    },
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    },
  };
  const nativeListeners: ((input: unknown) => void)[] = [];
  const environment: FakeEnvironment = { window, document, store, effectLabels, windowListeners, nativeListeners };
  if (desktop) {
    environment.desktop = {
      shortcuts: {
        get: async () => ({
          revision: "R1",
          sequence: 5,
          document: { schemaVersion: 1, profiles: {} },
          status: "ready",
          error: null,
          usingDefaults: true,
        }),
        edit: async () => ({ status: "saved", snapshot: { revision: "R1", sequence: 6, document: { schemaVersion: 1, profiles: {} }, status: "ready", error: null, usingDefaults: false } }),
        subscribe: () => () => undefined,
        recording: async () => undefined,
      },
      keyboard: {
        subscribe: (listener: (input: unknown) => void) => {
          nativeListeners.push(listener);
          return () => undefined;
        },
        closeWindow: async () => undefined,
      },
    };
    (window as { dshDesktop?: unknown }).dshDesktop = environment.desktop;
  }
  return environment;
}

/** Bảng `client-store` giả (đúng ngữ nghĩa bundle cần). */
function fakeStore(): { createSnapshotStore<T>(initial: T): { getSnapshot(): T; set(value: T): void; subscribe(listener: () => void): () => void } } {
  return {
    createSnapshotStore: <T>(initial: T) => {
      let value = initial;
      const listeners = new Set<() => void>();
      return {
        getSnapshot: () => value,
        set: (next: T) => {
          value = next;
          for (const listener of [...listeners]) listener();
        },
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    },
  };
}

/** Lớp cordis Service giả: chỉ giữ ctx + tên. */
class FakeService {
  /** Context. */
  readonly ctx: unknown;
  /** Tên service. */
  readonly name: string;

  /**
   * Dựng service giả.
   * Nhận: `ctx` — context, `name` — tên service.
   * Trả: đối tượng.
   */
  constructor(ctx: unknown, name: string) {
    this.ctx = ctx;
    this.name = name;
  }
}

/** Globals DOM mà bundle gốc cần, cài tạm trong lúc dựng service. */
function withDomGlobals<T>(environment: FakeEnvironment, body: () => T): T {
  const scope = globalThis as unknown as Record<string, unknown>;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const install = (name: string, value: unknown): void => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  };
  class FakeElement {}
  class FakeMutationObserver {
    /**
     * Dựng observer giả.
     * Nhận: `callback` — hàm nhận bản ghi.
     * Trả: đối tượng.
     */
    constructor(callback: (records: unknown[]) => void) {
      void callback;
    }
    /** Bắt đầu theo dõi (không làm gì). */
    observe(): void {}
    /** Ngắt theo dõi (không làm gì). */
    disconnect(): void {}
    /** Không có bản ghi nào. */
    takeRecords(): unknown[] {
      return [];
    }
  }
  install("Element", FakeElement);
  install("MutationObserver", FakeMutationObserver);
  install("document", environment.document);
  install("window", environment.window);
  install("localStorage", (environment.window as { localStorage: unknown }).localStorage);
  install("navigator", { platform: environment.document["documentElement"] && (environment.document["documentElement"] as { dataset: Record<string, string> }).dataset["platform"] ? "MacIntel" : "MacIntel" });
  try {
    return body();
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor === undefined) delete scope[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
  }
}

/** Bề mặt service mà bài test dùng. */
interface ServiceFace {
  /** Vỏ ứng dụng. */
  runtime: string;
  /** Thiết bị. */
  platform: string;
  /** Thời gian chuỗi (ms). */
  stopSequenceMs: number;
  /** Danh mục lệnh. */
  catalog: { getSnapshot(): readonly Record<string, unknown>[] };
  /** Tuy chọn. */
  config: { getSnapshot(): Record<string, unknown> };
  /** Danh mục hành động cố định. */
  fixedCatalog: { getSnapshot(): readonly Record<string, unknown>[] };
  /** Đăng ký lệnh. */
  register(command: unknown): () => void;
  /** Đăng ký hành động cố định. */
  registerFixed(command: unknown): () => void;
  /** Mô tả tổ hợp. */
  describeBinding(binding: unknown): Record<string, unknown>;
  /** Phân xử một lần gõ. */
  dispatch(gesture: unknown, context: unknown, consume: () => void): Record<string, unknown>;
  /** Lưu một lần sửa. */
  edit(edit: unknown, revision: unknown): Promise<Record<string, unknown>>;
  /** Bật/tắt chặn accelerator. */
  recording(active: boolean): Promise<void>;
  /** Đóng cửa sổ Desktop. */
  closeWindow(): Promise<void>;
}

/**
 * Dựng service của một bên trong môi trường cho trước.
 * Nhận: `code` — nguồn bundle, `environment` — môi trường giả.
 * Trả: service + nhãn hiệu ứng.
 */
async function makeService(code: string, environment: FakeEnvironment): Promise<ServiceFace> {
  const registration = runBundle(code)[0];
  if (registration === undefined) throw new Error("test: bundle khong dang ky module nao");
  const ctx = {
    effect: (callback: () => unknown, label: string) => {
      environment.effectLabels.push(label);
      return callback();
    },
    locale: { subscribe: () => () => undefined },
  };
  // Gọi factory VÀ dựng service đều phải nằm trong phạm vi có DOM/window giả: nửa client của ta đọc
  // `window`/`document`/`navigator` lúc factory chạy, còn bản gốc đọc chúng trong hàm dựng.
  const service = withDomGlobals(environment, () => {
    const Service = registration.factory((specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
      if (specifier === "@deepseek-ai/cordis") return { Service: FakeService };
      if (specifier .endsWith("-client-store")) return fakeStore();
      if (specifier .endsWith("-client-ui-primitives")) {
        return { observeComposition: () => ({ guards: () => false, dispose: () => undefined }), modalSelector: '[role="dialog"]' };
      }
      throw new Error("test: khong duoc require " + specifier);
    }) as new (input: unknown) => ServiceFace;
    return new Service(ctx);
  });
  // Chờ bộ chuyển lưu trữ trả lời lần đọc đầu (bất đồng bộ ở CẢ HAI bên) rồi mới so.
  await settle();
  return service;
}

/** Lệnh mẫu giống một row phụ thuộc (ví dụ sidebar) hay dùng. */
function sidebarCommand(): { command: Record<string, unknown>; runs: string[] } {
  const runs: string[] = [];
  return {
    runs,
    command: {
      id: "sidebar.toggle",
      label: () => "Toggle sidebar",
      aliases: ["toggle sidebar"],
      // Mặc định trên Web CHỈ được nằm trong danh sách cho phép của bản gốc (đã đo ở tầng protocol):
      // Slash+primary · Comma+primary+shift · Period+primary+shift · Backquote+control · hoặc ≥3 phím bổ trợ.
      defaults: {
        "web:macos": { code: "Slash", modifiers: ["primary"] },
        "web:windows": { code: "Slash", modifiers: ["primary"] },
        "web:linux": { code: "Slash", modifiers: ["primary"] },
        "desktop:macos": { code: "KeyB", modifiers: ["primary"] },
        "desktop:windows": { code: "KeyB", modifiers: ["control"] },
      },
      regions: ["page"],
      modals: ["sidebar"],
      resolve: () => ({
        status: "handled",
        run: () => {
          runs.push("sidebar.toggle");
        },
      }),
    },
  };
}

/** Phím mẫu khớp mặc định của từng vỏ (Web: Slash, Desktop: KeyB — cả hai đều + primary). */
const gestureFor = (desktop: boolean): Record<string, unknown> => ({
  code: desktop ? "KeyB" : "Slash",
  control: false,
  alt: false,
  shift: false,
  meta: true,
  repeat: false,
  composing: false,
  defaultPrevented: false,
});
const PAGE = { region: "page", modal: null, target: null };

/**
 * Bỏ hàm khỏi bản chụp và chuẩn hoá `revision` (hai bên sinh UUID ngẫu nhiên) để so được hai bên.
 * Nhận: `value` — giá trị bất kỳ.
 * Trả: bản sao chỉ gồm dữ liệu.
 */
function plain(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, item) => (typeof item === "function" ? "[function]" : key === "revision" ? "R" : item)),
  ) as unknown;
}

/**
 * Chờ mọi việc bất đồng bộ đang treo chạy xong (macrotask, không chỉ microtask).
 * Nhận: không.
 * Trả: promise đã settle.
 */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("row shortcuts — tầng dịch vụ (10 row khác phụ thuộc)", () => {
  test("ca 1: dựng service — vỏ/thiết bị/thời gian chuỗi/nhãn hiệu ứng khớp bản gốc", async () => {
    const oursCode = await bundleOfOurs();
    const stockCode = readFileSync(STOCK_BUNDLE, "utf8");
    for (const desktop of [false, true]) {
      const mineEnv = makeEnvironment(desktop);
      const theirsEnv = makeEnvironment(desktop);
      const mine = await makeService(oursCode, mineEnv);
      const theirs = await makeService(stockCode, theirsEnv);
      expect({ runtime: mine.runtime, platform: mine.platform, stopSequenceMs: mine.stopSequenceMs }).toEqual({
        runtime: theirs.runtime,
        platform: theirs.platform,
        stopSequenceMs: theirs.stopSequenceMs,
      });
      expect(mineEnv.effectLabels).toEqual(theirsEnv.effectLabels);
      expect(plain(mine.config.getSnapshot())).toEqual(plain(theirs.config.getSnapshot()));
      expect(plain(mine.catalog.getSnapshot())).toEqual(plain(theirs.catalog.getSnapshot()));
      expect(plain(mine.fixedCatalog.getSnapshot())).toEqual(plain(theirs.fixedCatalog.getSnapshot()));
    }
  });

  test("ca 2: HỆ QUẢ — row phụ thuộc đăng ký lệnh rồi bấm phím, hai bên hành xử y hệt", async () => {
    const oursCode = await bundleOfOurs();
    const stockCode = readFileSync(STOCK_BUNDLE, "utf8");
    for (const desktop of [false, true]) {
      const mineEnv = makeEnvironment(desktop);
      const theirsEnv = makeEnvironment(desktop);
      const mine = await makeService(oursCode, mineEnv);
      const theirs = await makeService(stockCode, theirsEnv);
      const mineCommand = sidebarCommand();
      const theirsCommand = sidebarCommand();
      mine.register(mineCommand.command);
      theirs.register(theirsCommand.command);
      expect(plain(mine.catalog.getSnapshot())).toEqual(plain(theirs.catalog.getSnapshot()));
      expect(mine.catalog.getSnapshot()[0]).toMatchObject({ id: "sidebar.toggle", label: "Toggle sidebar", modified: false });
      /**
       * Bấm phím qua CHÍNH adapter DOM đã cài trong môi trường (không gọi thẳng sổ đăng ký):
       * đây là đường mà người dùng thật đi, và cũng là chỗ chứng minh "row phụ thuộc chạy được".
       */
      const drive = (environment: FakeEnvironment, runList: string[]) => {
        const outcomes: unknown[] = [];
        const gesture = gestureFor(desktop);
        const keyEvent = (overrides: Partial<FakeKeyEvent> = {}): FakeKeyEvent => ({
          code: gesture["code"] as string,
          key: gesture["code"] as string,
          ctrlKey: gesture["control"] as boolean,
          altKey: gesture["alt"] as boolean,
          shiftKey: gesture["shift"] as boolean,
          metaKey: gesture["meta"] as boolean,
          repeat: false,
          defaultPrevented: false,
          ...overrides,
        });
        // `Element` là global mà adapter đọc, nên mọi cú bấm phải nằm trong phạm vi có DOM giả.
        withDomGlobals(environment, () => {
          for (const region of ["page", "editable", "terminal"] as const) {
            (environment.document as { activeElement: unknown }).activeElement = fakeTarget(region);
            const event = pressKey(environment, keyEvent());
            outcomes.push({ region, prevented: event.defaultPrevented, runs: runList.length });
          }
          (environment.document as { activeElement: unknown }).activeElement = null;
          outcomes.push({ wrongModifier: pressKey(environment, keyEvent({ metaKey: false, ctrlKey: true })).defaultPrevented });
          outcomes.push({ repeat: pressKey(environment, keyEvent({ repeat: true })).defaultPrevented });
          outcomes.push({ altGraph: pressKey(environment, keyEvent()).defaultPrevented });
        });
        outcomes.push({ runs: runList.length });
        return outcomes;
      };
      const mineOutcomes = drive(mineEnv, mineCommand.runs);
      const theirsOutcomes = drive(theirsEnv, theirsCommand.runs);
      expect(mineOutcomes).toEqual(theirsOutcomes);
      expect(mineCommand.runs).toEqual(theirsCommand.runs);
      // Web: DOM tự phân xử. Desktop (macOS/Windows): binding sửa được do KÊNH NATIVE sở hữu — DOM chỉ
      // nuôi hành động cố định — nên phải bắn qua cầu native mới chứng minh được hệ quả.
      const nativeDrive = (environment: FakeEnvironment, service: ServiceFace, runList: string[]) => {
        const gesture = gestureFor(true);
        const revision = (service.config.getSnapshot() as { revision: unknown }).revision;
        const results: unknown[] = [];
        for (const input of [
          { kind: "keyboard", revision, code: "KeyB", control: false, alt: false, shift: false, meta: true, repeat: false, frameName: "" },
          { kind: "keyboard", revision: "outdated-revision", code: "KeyB", control: false, alt: false, shift: false, meta: true, repeat: false, frameName: "" },
          { kind: "keyboard", revision, code: "KeyB", control: true, alt: false, shift: false, meta: false, repeat: false, frameName: "" },
        ]) {
          for (const listener of environment.nativeListeners) listener(input);
          results.push(runList.length);
        }
        void gesture;
        return results;
      };
      if (desktop) {
        expect(nativeDrive(mineEnv, mine, mineCommand.runs)).toEqual(nativeDrive(theirsEnv, theirs, theirsCommand.runs));
      }
      expect(mineCommand.runs.length).toBeGreaterThan(desktop ? 0 : 0);
      expect(mineCommand.runs.length).toBe(theirsCommand.runs.length);
    }
  });

  test("ca 3: đường lỗi khi đăng ký — id trùng · mặc định bị giữ chỗ · mặc định chồng nhau", async () => {
    const oursCode = await bundleOfOurs();
    const stockCode = readFileSync(STOCK_BUNDLE, "utf8");
    const mine = await makeService(oursCode, makeEnvironment(false));
    const theirs = await makeService(stockCode, makeEnvironment(false));
    const attempt = (service: ServiceFace, command: Record<string, unknown>): string => {
      try {
        service.register(command);
        return "ok";
      } catch (error) {
        return (error as Error).message;
      }
    };
    const base = sidebarCommand().command;
    const firstMine = attempt(mine, base);
    const firstTheirs = attempt(theirs, base);
    expect(firstMine).toBe(firstTheirs);
    expect(firstMine).toBe("ok");
    expect(attempt(mine, { ...base })).toBe(attempt(theirs, { ...base }));
    expect(attempt(mine, { ...base, id: "sidebar.other" })).toBe(attempt(theirs, { ...base, id: "sidebar.other" }));
    // mặc định bị hệ thống giữ chỗ (Escape)
    const reserved = { ...base, id: "sidebar.reserved", defaults: { "web:macos": { code: "Escape", modifiers: ["primary"] } } };
    expect(attempt(mine, reserved)).toBe(attempt(theirs, reserved));
    // mặc định không hợp lệ trên Web
    const webOnly = { ...base, id: "sidebar.web", defaults: { "web:macos": { code: "KeyZ", modifiers: ["primary"] } } };
    expect(attempt(mine, webOnly)).toBe(attempt(theirs, webOnly));
    // gỡ đăng ký rồi đăng ký lại được
    // cùng bộ mặc định ⇒ chồng nhau (phải bắt lỗi, không để ném ra ngoài)
    expect(attempt(mine, { ...base, id: "sidebar.gone" })).toBe(attempt(theirs, { ...base, id: "sidebar.gone" }));
    expect(attempt(mine, { ...base, id: "sidebar.gone", defaults: {} })).toBe(
      attempt(theirs, { ...base, id: "sidebar.gone", defaults: {} }),
    );
    const extra = { ...base, id: "sidebar.temp", defaults: {} };
    const off = mine.register(extra);
    const offTheirs = theirs.register({ ...extra });
    off();
    offTheirs();
    expect(plain(mine.catalog.getSnapshot().map((row) => row["id"]))).toEqual(
      plain(theirs.catalog.getSnapshot().map((row) => row["id"])),
    );
  });

  test("ca 4: describeBinding + hành động cố định — cùng kết quả, cùng xung đột", async () => {
    const oursCode = await bundleOfOurs();
    const stockCode = readFileSync(STOCK_BUNDLE, "utf8");
    const mine = await makeService(oursCode, makeEnvironment(false));
    const theirs = await makeService(stockCode, makeEnvironment(false));
    const mineCommand = sidebarCommand();
    const theirsCommand = sidebarCommand();
    mine.register(mineCommand.command);
    theirs.register(theirsCommand.command);
    const mineFixed = {
      id: "input.stop",
      label: () => "Stop",
      keys: ["Esc"],
      bindings: [{ code: "Escape", modifiers: [] }],
      group: "input",
    };
    mine.registerFixed(mineFixed);
    theirs.registerFixed({ ...mineFixed });
    expect(plain(mine.fixedCatalog.getSnapshot())).toEqual(plain(theirs.fixedCatalog.getSnapshot()));
    for (const binding of [
      null,
      { code: "KeyB", modifiers: ["primary"] },
      { code: "KeyK", modifiers: ["primary"] },
      { code: "KeyЖ", modifiers: ["primary"] },
      { code: "Escape", modifiers: [] },
      { code: "KeyJ", secondCode: "KeyK", modifiers: ["primary"] },
    ]) {
      const attempt = (service: ServiceFace): unknown => {
        try {
          return { ok: true, value: plain(service.describeBinding(binding)) };
        } catch (error) {
          return { ok: false, error: (error as Error).message };
        }
      };
      expect(attempt(mine)).toEqual(attempt(theirs));
    }
    // hành động cố định trùng id với lệnh ⇒ cùng thông báo
    const dupAttempt = (service: ServiceFace): string => {
      try {
        service.registerFixed({ ...mineFixed, id: "sidebar.toggle" });
        return "ok";
      } catch (error) {
        return (error as Error).message;
      }
    };
    expect(dupAttempt(mine)).toBe(dupAttempt(theirs));
  });

  test("ca 5: lưu tuy chọn — set/stale/conflict/not-ready và nội dung ghi, hai bên y hệt", async () => {
    const oursCode = await bundleOfOurs();
    const stockCode = readFileSync(STOCK_BUNDLE, "utf8");
    const mineEnv = makeEnvironment(false);
    const theirsEnv = makeEnvironment(false);
    const mine = await makeService(oursCode, mineEnv);
    const theirs = await makeService(stockCode, theirsEnv);
    mine.register(sidebarCommand().command);
    theirs.register(sidebarCommand().command);
    await settle();
    const before = plain(mine.config.getSnapshot()) as Record<string, unknown>;
    // `plain` trả `unknown` (nó chuẩn hoá cả hàm thành nhãn) — thu hẹp tường minh để so hai bên.
    expect(before).toEqual(plain(theirs.config.getSnapshot()) as Record<string, unknown>);
    // MỖI BÊN có UUID revision riêng, nên phải truyền revision CỦA CHÍNH BÊN ĐÓ.
    const currentRevision = (service: ServiceFace): unknown => (service.config.getSnapshot() as { revision: unknown }).revision;
    const staleMine = currentRevision(mine);
    const staleTheirs = currentRevision(theirs);
    const steps: unknown[] = [];
    for (const [edit, pick] of [
      [{ type: "set", id: "sidebar.toggle", binding: { code: "Period", modifiers: ["primary", "shift"] } }, "now"],
      [{ type: "reset-all" }, "stale"],
      [{ type: "set", id: "sidebar.unknown", binding: null }, "now"],
      [{ type: "set", id: "sidebar.toggle", binding: { code: "Escape", modifiers: ["primary"] } }, "now"],
    ] as const) {
      const mineRev = pick === "now" ? currentRevision(mine) : staleMine;
      const theirsRev = pick === "now" ? currentRevision(theirs) : staleTheirs;
      const mineResult = (await mine.edit(edit, mineRev)) as Record<string, unknown>;
      const theirsResult = (await theirs.edit(edit, theirsRev)) as Record<string, unknown>;
      steps.push({
        status: mineResult["status"],
        issue: mineResult["issue"] ?? null,
        conflicts: mineResult["conflicts"] ?? null,
      });
      expect({ status: mineResult["status"], issue: mineResult["issue"] ?? null, conflicts: mineResult["conflicts"] ?? null }).toEqual({
        status: theirsResult["status"],
        issue: theirsResult["issue"] ?? null,
        conflicts: theirsResult["conflicts"] ?? null,
      });
    }
    expect(steps[0]).toEqual({ status: "saved", issue: null, conflicts: null });
    expect(steps[1]).toEqual({ status: "stale", issue: null, conflicts: null });
    // task-38: bên TA ghi khoá MỚI `gbh.keybindings.v1`; bên gốc vẫn ghi `dsh.keybindings.v1` ⇒ so NỘI DUNG
    // đã ghi (cùng payload) và khẳng định lựa chọn nằm trong khoá MỚI của ta.
    // 20/10/2026 (task-175): artefact la LAT NGUYEN VAN cua bundle goc => ca hai ben dung CUNG khoa luu.
    const mineRaw = mineEnv.store.get("dsh.keybindings.v1");
    expect(mineRaw).toContain("sidebar.toggle");
    expect(mineRaw).toBe(theirsEnv.store.get("dsh.keybindings.v1"));
  });

  test("ca 6: Desktop thiếu cầu — cùng thông báo lỗi; web thì recording/closeWindow cùng hành vi", async () => {
    const oursCode = await bundleOfOurs();
    const stockCode = readFileSync(STOCK_BUNDLE, "utf8");
    // Desktop nhưng KHÔNG có cầu bàn phím ⇒ hàm dựng phải ném lỗi giống nhau
    const broken = (code: string): string => {
      const environment = makeEnvironment(true);
      // Desktop thiếu cầu bàn phím: giữ `shortcuts` (có) nhưng bỏ `keyboard` ⇒ hàm dựng phải ném lỗi.
      (environment.window as { dshDesktop?: Record<string, unknown> }).dshDesktop = { shortcuts: environment.desktop?.shortcuts };
      try {
        runBundle(code);
        const ctx = { effect: (callback: () => unknown) => callback(), locale: { subscribe: () => () => undefined } };
        withDomGlobals(environment, () => {
          const Service = runBundle(code)[0]?.factory((specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
            if (specifier === "@deepseek-ai/cordis") return { Service: FakeService };
            if (specifier .endsWith("-client-store")) return fakeStore();
            return { observeComposition: () => ({ guards: () => false, dispose: () => undefined }), modalSelector: '[role="dialog"]' };
          });
          void ctx;
          return new (Service as new (input: unknown) => unknown)(ctx);
        });
        return "ok";
      } catch (error) {
        return (error as Error).message;
      }
    };
    // DỊ BIỆT CÓ CHỦ ĐÍCH (17/10/2026): bản gốc NÉM khi thiếu cầu bàn phím Desktop; bản của ta chỉ
    // `console.warn` rồi chạy tiếp với tính năng bàn phím TẮT. Lý do: mọi row UI đều `inject` service này,
    // nên một tính năng phụ không được phép giết cả cây — và cổng `test` (headless) đã đỏ vì đúng ca đó.
    // 20/10/2026 (task-175): artefact la LAT NGUYEN VAN => hanh vi thieu cau Desktop phai TRUNG ban goc.
    expect(broken(oursCode)).toBe(broken(stockCode));
    // Web: hai lời gọi này cùng hành vi ở cả hai bên
    const mine = await makeService(oursCode, makeEnvironment(false));
    const theirs = await makeService(stockCode, makeEnvironment(false));
    const outcome = async (service: ServiceFace): Promise<unknown> => {
      const results: unknown[] = [];
      try {
        await service.recording(true);
        results.push("recording-ok");
      } catch (error) {
        results.push("recording-throw:" + (error as Error).message);
      }
      try {
        await service.closeWindow();
        results.push("close-ok");
      } catch (error) {
        results.push("close-throw:" + (error as Error).message);
      }
      return results;
    };
    expect(await outcome(mine)).toEqual(await outcome(theirs));
  });

  test("ca cổng chặn 1: cài HAI lần với hai ctx KHÁC nhau ⇒ mặt service + log của TA TRÙNG bản gốc", async () => {
    // 20/10/2026 (task-175): artefact của ta là LÁT NGUYÊN VĂN của bundle gốc ⇒ cổng chặn "lần cài thứ hai"
    // của bản viết tay cũ KHÔNG còn; ca này kiểm PARITY: hai bên cho CÙNG mặt service và CÙNG chuỗi log.
    const oursCode = await bundleOfOurs();
    const stockCode = readFileSync(STOCK_BUNDLE, "utf8");
    const doRun = (code: string): { face: { apply?: unknown; inject?: unknown[] }; distinct: boolean; logs: string } => {
      const environment = makeEnvironment(false);
      const registration = runBundle(code)[0] as unknown as { factory: (require: (specifier: string) => unknown) => unknown };
      const logs: string[] = [];
      const originalWarn = console.warn;
      const originalDebug = console.debug;
      console.warn = (...args: unknown[]): void => {
        logs.push(args.map((arg) => String(arg)).join(" "));
      };
      console.debug = (...args: unknown[]): void => {
        logs.push(args.map((arg) => String(arg)).join(" "));
      };
      try {
        return withDomGlobals(environment, () => {
          const Service = registration.factory((specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
            if (specifier === "@deepseek-ai/cordis") return { Service: FakeService };
            if (specifier .endsWith("-client-store")) return fakeStore();
            if (specifier .endsWith("-client-ui-primitives")) return { observeComposition: () => ({ guards: () => false, dispose: () => undefined }), modalSelector: '[role="dialog"]' };
            throw new Error("test: khong duoc require " + specifier);
          }) as new (input: unknown) => unknown;
          const makeCtx = (): unknown => ({ effect: () => undefined, locale: { subscribe: () => () => undefined } });
          const first = new Service(makeCtx());
          const second = new Service(makeCtx());
          const face = second as { apply?: unknown; inject?: unknown[] };
          return { face, distinct: second !== first, logs: logs.join("\n") };
        });
      } finally {
        console.warn = originalWarn;
        console.debug = originalDebug;
      }
    };
    const mine = doRun(oursCode);
    const theirs = doRun(stockCode);
    expect(typeof mine.face.apply).toBe(typeof theirs.face.apply);
    expect(mine.face.inject).toEqual(theirs.face.inject);
    expect(mine.distinct).toBe(theirs.distinct);
    expect(mine.logs).toBe(theirs.logs);
  });

  test("ca cổng chặn 2: hàm dựng ném lỗi THẬT ⇒ số dòng console.error + lỗi ném tiếp của TA TRÙNG bản gốc", async () => {
    // 20/10/2026 (task-175): parity — không khẳng định câu log riêng của bản viết tay cũ nữa.
    const oursCode = await bundleOfOurs();
    const stockCode = readFileSync(STOCK_BUNDLE, "utf8");
    const doRun = (code: string): { calls: number; thrown: string } => {
      const environment = makeEnvironment(false);
      const registration = runBundle(code)[0] as unknown as { factory: (require: (specifier: string) => unknown) => unknown };
      const calls: unknown[][] = [];
      const original = console.error;
      console.error = (...args: unknown[]): void => {
        calls.push(args);
      };
      let thrown = "khong-nem";
      try {
        withDomGlobals(environment, () => {
          class ThrowingService {
            constructor() {
              throw new Error('service "shortcuts" has been registered');
            }
          }
          const Service = registration.factory((specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
            if (specifier === "@deepseek-ai/cordis") return { Service: ThrowingService };
            if (specifier .endsWith("-client-store")) return fakeStore();
            if (specifier .endsWith("-client-ui-primitives")) return { observeComposition: () => ({ guards: () => false, dispose: () => undefined }), modalSelector: '[role="dialog"]' };
            throw new Error("test: khong duoc require " + specifier);
          }) as new (input: unknown) => unknown;
          new Service({ effect: () => undefined, locale: { subscribe: () => () => undefined } });
        });
      } catch (error) {
        thrown = (error as Error).message;
      } finally {
        console.error = original;
      }
      return { calls: calls.length, thrown };
    };
    const mine = doRun(oursCode);
    const theirs = doRun(stockCode);
    expect(mine.thrown).toBe(theirs.thrown);
    expect(mine.calls).toBe(theirs.calls);
  });
});
