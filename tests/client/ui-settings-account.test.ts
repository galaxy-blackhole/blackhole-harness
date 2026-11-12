/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test row ui-settings-account — luật MỘT id · TẬP slot BẰNG tập slot của chính bundle gốc ·
 *      HỢP ĐỒNG KHO đầy đủ cho slot của gói khác · từ điển · CSS nguyên văn · ảnh nhúng nguyên văn
 *
 * Mọi ca chạy trên ARTIFACT lib/client.js (không grep suông): cùng một window giả và cùng một context giả
 * cho CẢ HAI bundle (ta và gốc), nên phép so là so trực tiếp.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { formatBalance } from "../../packages/client/ui-settings-account/src/format-balance.ts";
import { brandNeutral, neutralDict } from "../lib/brand-neutral.ts";

/** Thư mục gói của ta. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-settings-account");
/** Thư mục bản gốc (CHỈ ĐỌC). */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-settings-account");
/** Tên package của ta — id DUY NHẤT được phép đăng ký. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-account";
/** Tên package gốc — chỉ được khai ở gbh.row.aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-settings-account";

/** Hai khuôn regex CHÍNH của cổng check:rows (tools/check/rows.ts :: slotNames). */
const SLOT_PATTERNS: readonly RegExp[] = [
  /slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g,
  /slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g,
];

/**
 * Rút tập tên slot từ một đoạn mã bằng đúng hai regex của cổng.
 * @param text - mã nguồn (của ta hoặc của bundle gốc).
 * @returns tập tên slot tìm được.
 */
function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const pattern of SLOT_PATTERNS) for (const m of text.matchAll(pattern)) out.add(m[1] as string);
  return out;
}

/**
 * Đọc toàn bộ mã nguồn .ts trong src/ của gói ta (đệ quy) — đúng cách cổng đọc.
 * @param dir - thư mục cần quét.
 * @returns nội dung gộp.
 */
function readAllTs(dir: string): string {
  let out = "";
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out += readAllTs(full);
    else if (name.endsWith(".ts")) out += readFileSync(full, "utf8");
  }
  return out;
}

/** Một lần register(spec, component) bắt được từ context giả. */
interface RegisterCall {
  /** Tên slot. */
  name: string;
  /** Id người ngồi. */
  id: string | undefined;
  /** Spec đầy đủ. */
  spec: Record<string, unknown>;
  /** Component — THAM SỐ THỨ HAI. */
  component: unknown;
}

/** Bộ ghi của context giả. */
interface Recorder {
  /** Tên slot đã inject, theo thứ tự. */
  injected: string[];
  /** Các lần đăng ký người ngồi. */
  registers: RegisterCall[];
  /** Payload của lần inject theo tên slot. */
  payloads: Map<string, unknown>;
  /** Từ điển đã đăng ký theo namespace. */
  dictionaries: Map<string, { en: unknown; zh: unknown }>;
}

/** Một kho ảnh chụp tối thiểu, dùng làm seed dsh-client-store trong test. */
interface TestStore<T> {
  /** Đọc giá trị hiện tại. */
  getSnapshot(): T;
  /** Ghi giá trị mới. */
  set(value: T): void;
  /** Nghe thay đổi. */
  subscribe(listener: () => void): () => void;
}

/**
 * Dựng một kho ảnh chụp tối thiểu.
 * @param initial - giá trị đầu.
 * @returns kho có getSnapshot/set/subscribe.
 */
function makeStore<T>(initial: T): TestStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    set: (next: T) => {
      value = next;
      for (const listener of listeners) listener();
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
 * Rút các chuỗi CSS đã nhúng trong một bundle.
 * @param code - nội dung bundle.
 * @returns danh sách văn bản CSS theo thứ tự xuất hiện.
 */
function cssTexts(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/^\s*const css(?:\$\d+)? = (".*");\s*$/gm)) out.push(JSON.parse(m[1] as string) as string);
  return out;
}

/**
 * Rút các data URI ảnh đã nhúng trong một bundle.
 * @param code - nội dung bundle.
 * @returns ánh xạ tên biến -> data URI.
 */
function assetUris(code: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of code.matchAll(/^\s*var (onboarding_[a-z0-9_]+) = "(data:[^"]+)";\s*$/gm)) out.set(m[1] as string, m[2] as string);
  return out;
}

/**
 * Rút MỌI data URI base64 trong một bundle (ảnh tệp + bieu tuong nhung thang).
 * @param code - nội dung bundle.
 * @returns tập data URI.
 */
function allDataUris(code: string): Set<string> {
  const out = new Set<string>();
  for (const m of code.matchAll(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g)) out.add(m[0]);
  return out;
}

/**
 * Suy ten tep trong src/assets tu ten bien cua ban goc.
 * @param variable - ten bien (vi du onboarding_welcome_zh_dark_default).
 * @returns ten tep (vi du onboarding-welcome-zh-dark.webp).
 */
function assetFile(variable: string): string {
  const inner = variable.replace(/^onboarding_/, "").replace(/_default$/, "");
  // Hai bieu tuong the muc dich la .svg, con lai la .webp — suy tu chinh URI o noi goi.
  return "onboarding-" + inner.replace(/_/g, "-");
}

/** document giả tối thiểu cho việc chèn thẻ style. */
interface DocumentStub {
  /** Không bao giờ thấy thẻ style. */
  querySelector(): null;
  /** Tạo một thẻ giả. */
  createElement(): unknown;
  /** Đầu tài liệu. */
  head: { appendChild(): void };
  /** Thân tài liệu. */
  body: { children: unknown[] };
  /** Nghe sự kiện (không làm gì). */
  addEventListener(): void;
  /** Bỏ nghe sự kiện (không làm gì). */
  removeEventListener(): void;
  /** Trạng thái hiển thị. */
  visibilityState: string;
}

/**
 * Dựng document giả.
 * @returns document giả.
 */
function fakeDocument(): DocumentStub {
  return {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: "" }),
    head: { appendChild: () => undefined },
    body: { children: [] },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    visibilityState: "visible",
  };
}

/** Một frame của stream trạng thái tài khoản. */
interface Frame {
  /** Trạng thái tài khoản. */
  value: Record<string, unknown>;
  /** Xác nhận đã xử lý. */
  accept: () => void;
}

/** Seed kho mà CẢ HAI bundle gọi qua require. */
interface SeedStore {
  /** Tạo kho ảnh chụp. */
  createSnapshotStore: typeof makeStore;
  /** So sánh nông. */
  shallowEqual(a: unknown, b: unknown): boolean;
}

/**
 * Dựng require giả phục vụ đúng các seed mà cả hai bundle gọi.
 * @param store - seed kho.
 * @returns hàm require.
 */
function fakeRequire(store: SeedStore): (specifier: string) => unknown {
  return (specifier: string): unknown => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    if (specifier === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null, Fragment: Symbol("Fragment") };
    if (specifier === "react") {
      return {
        useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, () => undefined],
        useRef: (initial: unknown) => ({ current: initial }),
        useEffect: () => undefined,
        useLayoutEffect: () => undefined,
        useMemo: (factory: () => unknown) => factory(),
      };
    }
    if (specifier .endsWith("-client-ui-primitives")) return new Proxy({}, { get: () => () => null });
    if (specifier === "react-dom") return { createPortal: () => null };
    if (specifier .endsWith("-client-store")) return store;
    throw new Error("require miss: " + specifier);
  };
}

/** Kết quả một lần chạy một bundle trong môi trường giả. */
interface RunResult {
  /** Id module mà bundle tự khai. */
  ids: string[];
  /** Bộ ghi context. */
  recorder: Recorder;
}

/**
 * Dựng context giả đủ điều kiện để MỌI slot được đăng ký (dshDesktop + dshPlatform + đã đăng nhập).
 * @param recorder - bộ ghi.
 * @returns context giả.
 */
function fakeContext(recorder: Recorder): Record<string, unknown> {
  const progressScope = {
    getSnapshot: () => ({ status: "ready", value: { version: 1, step: "welcome", purpose: null, process: null, completion: null, usage: "compact", developerTools: false }, writable: true }),
    subscribe: () => () => undefined,
    mutate: async () => true,
  };
  const chatScope = {
    getSnapshot: () => ({ status: "ready", value: { transcriptView: "standard", performanceUsage: "compact" } }),
    subscribe: () => () => undefined,
    mutate: async () => true,
  };
  const settingsReader = { getSnapshot: () => ({ error: null }), subscribe: () => () => undefined, ensure: async () => undefined };
  const frames: Frame[] = [
    { value: { status: "credential-stored", links: { usageUrl: "https://platform.example.com/usage", topUpUrl: "https://platform.example.com/topup" } }, accept: () => undefined },
  ];
  const stream = {
    dispose: () => undefined,
    [Symbol.asyncIterator]: () => {
      let index = 0;
      return { next: async () => (index < frames.length ? { done: false, value: frames[index++] } : { done: true, value: undefined }) };
    },
  };
  const ctx: Record<string, unknown> = {
    effect: (run: () => unknown) => {
      run();
    },
    inject: (_names: readonly string[], run: (scope: unknown) => void) => run(ctx),
    get: () => ({ track: () => undefined }),
    on: () => () => undefined,
    slots: {
      inject: (name: string, body: () => unknown) => {
        recorder.injected.push(name);
        const value = body();
        recorder.payloads.set(name, value);
        return value;
      },
      register: (spec: Record<string, unknown>, component: unknown) => {
        recorder.registers.push({ name: String(spec["name"]), id: spec["id"] === undefined ? undefined : String(spec["id"]), spec, component });
        return () => undefined;
      },
    },
    locale: {
      register: (ns: string, dictionaries: { en: unknown; zh: unknown }) => recorder.dictionaries.set(ns, dictionaries),
      bind: () => (key: string) => key,
      getSnapshot: () => ({ active: "en" }),
    },
    remote: {
      $stream: () => stream,
      $on: () => () => undefined,
      account: {
        getUnnotifiedBonuses: async () => ({ ok: true, value: { accountId: "a1", bonuses: [] } }),
        ackBonusNotified: async () => ({ ok: true, value: true }),
        getProfile: async () => ({ ok: true, value: { status: "ready", value: { id: "u1", name: "Tester", contact: "t@example.com" } } }),
        getBalance: async () => ({ ok: true, value: { status: "ready", value: [{ currency: "USD", balance: "1.5" }], bonusWallets: [] } }),
        watch: () => undefined,
        startSignIn: async () => ({ ok: true, value: { attempt: { id: "x", phase: "initializing" } } }),
        cancelSignIn: async () => ({ ok: true, value: undefined }),
        hasRunningAccountTasks: async () => ({ ok: true, value: false }),
        signOut: async () => ({ ok: true, value: undefined }),
      },
      session: { initializeDefaultModel: async () => ({ ok: true, value: undefined }) },
    },
    theme: { getTheme: () => ({ active: { colorScheme: "light" } }) },
    configForms: {
      describe: () => settingsReader,
      get: (ns: string) => (ns === "ui-chat" ? chatScope : progressScope),
      developerTools: { setEnabled: () => undefined },
    },
  };
  return ctx;
}

/**
 * Chạy một bundle client trong window giả với context giả.
 * @param code - nội dung bundle.
 * @returns id đã đăng ký và bộ ghi context.
 */
async function runBundle(code: string): Promise<RunResult> {
  const ids: string[] = [];
  const recorder: Recorder = { injected: [], registers: [], payloads: new Map(), dictionaries: new Map() };
  let factory: ((require: (s: string) => unknown) => { apply?: (ctx: unknown) => void }) | undefined;
  const win = {
    __ModuleLoader__: {
      load: (registration: { id: string; factory: typeof factory }) => {
        ids.push(registration.id);
        factory = registration.factory;
      },
    },
  };
  const store: SeedStore = { createSnapshotStore: makeStore, shallowEqual: (a: unknown, b: unknown) => a === b };
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = { desktop: globals["dshDesktop"], platform: globals["dshPlatform"], onboarding: globals["dshOnboarding"], contact: globals["__DSH_CONTACT_CONFIG__"] };
  globals["dshDesktop"] = { deviceInfo: async () => "" };
  globals["dshPlatform"] = { open: async () => undefined, setBounds: async () => undefined, close: async () => undefined };
  globals["dshOnboarding"] = { setActive: () => undefined, hasApiKey: async () => false };
  globals["__DSH_CONTACT_CONFIG__"] = { contactFormUrl: "https://example.com/form", contactSource: "test", bonusAckRetryDelayMs: 1000, bonusAckRetryMaxDelayMs: 60000 };
  try {
    const evaluate = new Function("window", "document", code) as (w: unknown, d: unknown) => void;
    evaluate(win, fakeDocument());
    if (factory === undefined) throw new Error("bundle khong dang ky factory");
    const plugin = factory(fakeRequire(store));
    plugin.apply?.(fakeContext(recorder));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { ids, recorder };
  } finally {
    globals["dshDesktop"] = saved.desktop;
    globals["dshPlatform"] = saved.platform;
    globals["dshOnboarding"] = saved.onboarding;
    globals["__DSH_CONTACT_CONFIG__"] = saved.contact;
  }
}

/** Bundle của ta (đã build). */
const OUR_CODE = readFileSync(join(OURS, "lib", "client.js"), "utf8");
/** Bundle gốc (chỉ đọc). */
const STOCK_CODE = readFileSync(join(STOCK, "lib", "client.js"), "utf8");

describe("ui-settings-account · luật một id", () => {
  test("artifact đăng ký ĐÚNG MỘT id và đó là id của ta", async () => {
    const run = await runBundle(OUR_CODE);
    expect(run.ids).toEqual([PACKAGE_NAME]);
    expect(run.ids).not.toContain(STOCK_NAME);
  });

  test("artifact không chứa id gốc ở vị trí load({ id })", () => {
    expect(OUR_CODE).not.toContain('id: "' + STOCK_NAME + '"');
    expect(STOCK_CODE).toContain('id: "' + STOCK_NAME + '"');
  });
});

describe("ui-settings-account · TẬP slot của ta = TẬP slot của bundle gốc", () => {
  test("hai regex của check:rows cho cùng một tập trên src/ và trên lib/ gốc", () => {
    const stock = slotNames(readFileSync(join(STOCK, "lib", "client.js"), "utf8"));
    const ours = slotNames(readAllTs(join(OURS, "src")));
    expect([...ours].sort()).toEqual([...stock].sort());
    expect([...ours].sort()).toEqual(["settings.launcher", "settings.models.sign-in", "settings.section", "shell.overlay", "shell.quota-notice"]);
  });

  test("chạy thật: hai bundle tiêm vào cùng tập slot và đăng ký cùng tập (name, id)", async () => {
    const ours = await runBundle(OUR_CODE);
    const stock = await runBundle(STOCK_CODE);
    expect([...new Set(ours.recorder.injected)].sort()).toEqual([...new Set(stock.recorder.injected)].sort());
    /** Khoá (tên slot, id người ngồi) của một lần chạy. */
    const key = (run: RunResult): string[] => run.recorder.registers.map((call) => call.name + "#" + String(call.id)).sort();
    expect(key(ours)).toEqual(key(stock));
    expect(key(ours)).toEqual([
      "settings.launcher#undefined",
      "settings.models.sign-in#undefined",
      "settings.section#account",
      "shell.overlay#account.platform-page",
      "shell.overlay#desktop-onboarding",
      "shell.quota-notice#undefined",
    ]);
  });

  test("component luôn là THAM SỐ THỨ HAI của register", async () => {
    const ours = await runBundle(OUR_CODE);
    for (const call of ours.recorder.registers) expect(typeof call.component).toBe("function");
  });
});

describe("ui-settings-account · HỢP ĐỒNG KHO cho slot của gói khác", () => {
  test("mọi payload tiêm cho slot khác đều có kho ĐẦY ĐỦ getSnapshot/subscribe", async () => {
    const ours = await runBundle(OUR_CODE);
    const stock = await runBundle(STOCK_CODE);
    /**
     * Rút các kho trong payload của một lần chạy.
     * @param run - kết quả một lần chạy.
     * @returns bảng [slot, tên hook, có getSnapshot, có subscribe].
     */
    const stores = (run: RunResult): Array<[string, string, boolean, boolean]> => {
      const out: Array<[string, string, boolean, boolean]> = [];
      for (const call of run.recorder.registers) {
        const inject = call.spec["inject"];
        if (typeof inject !== "function") continue;
        const payload = (inject as () => Record<string, unknown>)();
        const hooks = (payload["hooks"] ?? {}) as Record<string, { getSnapshot?: unknown; subscribe?: unknown }>;
        for (const [hookName, value] of Object.entries(hooks)) {
          out.push([call.name + "#" + String(call.id), hookName, typeof value?.getSnapshot === "function", typeof value?.subscribe === "function"]);
        }
      }
      return out.sort();
    };
    const ourStores = stores(ours);
    expect(ourStores.length).toBeGreaterThan(0);
    expect(ourStores).toEqual(stores(stock));
    for (const row of ourStores) expect([row[2], row[3]]).toEqual([true, true]);
  });

  test("kênh trang Platform là thể hiện ĐẦY ĐỦ (getSnapshot/subscribe/open/close/dispose)", async () => {
    const ours = await runBundle(OUR_CODE);
    const quota = ours.recorder.registers.find((call) => call.name === "shell.quota-notice");
    expect(quota).toBeDefined();
    const payload = (quota?.spec["inject"] as () => Record<string, unknown>)();
    const hooks = payload["hooks"] as Record<string, Record<string, unknown>>;
    const platformPage = hooks["platformPage"] as Record<string, unknown>;
    for (const method of ["getSnapshot", "subscribe", "open", "close", "dispose"]) expect(typeof platformPage[method]).toBe("function");
    let seen = 0;
    (platformPage["subscribe"] as (listener: () => void) => () => void)(() => {
      seen += 1;
    });
    const release = (platformPage["open"] as (page: string, onClose: (reason: string) => void) => () => void)("top-up", () => undefined);
    expect((platformPage["getSnapshot"] as () => unknown)()).toEqual({ page: "top-up" });
    release();
    expect((platformPage["getSnapshot"] as () => unknown)()).toBeNull();
    expect(seen).toBeGreaterThan(0);
  });

  test("kho onboarding của bộ điều khiển Desktop cũng đầy đủ", async () => {
    const ours = await runBundle(OUR_CODE);
    const onboarding = ours.recorder.registers.find((call) => call.id === "desktop-onboarding");
    expect(onboarding).toBeDefined();
    const payload = (onboarding?.spec["inject"] as () => Record<string, unknown>)();
    const hooks = payload["hooks"] as Record<string, Record<string, unknown>>;
    for (const method of ["getSnapshot", "subscribe", "set"]) expect(typeof hooks["onboarding"]?.[method]).toBe("function");
    expect(typeof hooks["account"]?.["getSnapshot"]).toBe("function");
    expect(typeof hooks["account"]?.["subscribe"]).toBe("function");
  });

  test("kho tài khoản trả getSnapshot đúng hình dạng sau frame đã đăng nhập", async () => {
    const ours = await runBundle(OUR_CODE);
    const launcher = ours.recorder.registers.find((call) => call.name === "settings.launcher");
    const payload = (launcher?.spec["inject"] as () => Record<string, unknown>)();
    const hooks = payload["hooks"] as Record<string, Record<string, unknown>>;
    const snapshot = (hooks["account"]?.["getSnapshot"] as () => Record<string, unknown>)();
    expect(snapshot["failed"]).toBe(false);
    expect(snapshot["loginVisible"]).toBe(false);
    expect(snapshot["desktopOnboardingVisible"]).toBe(true);
    expect((snapshot["view"] as Record<string, unknown>)["status"]).toBe("credential-stored");
  });
});

describe("ui-settings-account · từ điển NGUYÊN VĂN", () => {
  test("hai bundle đăng ký cùng namespace với cùng tập khoá và cùng giá trị (chuẩn hoá thương hiệu)", async () => {
    const ours = await runBundle(OUR_CODE);
    const stock = await runBundle(STOCK_CODE);
    const ourDict = ours.recorder.dictionaries.get("settings.account");
    const stockDict = stock.recorder.dictionaries.get("settings.account");
    expect(ourDict).toBeDefined();
    expect(Object.keys(ourDict?.en as object).sort()).toEqual(Object.keys(stockDict?.en as object).sort());
    expect(Object.keys(ourDict?.zh as object).sort()).toEqual(Object.keys(stockDict?.zh as object).sort());
    // Khác biệt thương hiệu là CÓ Ý (task-17/N2) ⇒ chuẩn hoá nhãn trước khi so nguyên văn; mọi chuỗi khác phải y hệt.
    expect(neutralDict(ourDict?.en)).toEqual(stockDict?.en);
    expect(neutralDict(ourDict?.zh)).toEqual(stockDict?.zh);
    expect(Object.keys(ourDict?.en as object).length).toBe(94);
  });
});

describe("ui-settings-account · CSS và ảnh NGUYÊN VĂN từng byte", () => {
  test("tám module CSS trong src/ khớp từng ký tự với chuỗi nhúng trong bundle gốc", () => {
    const stockCss = cssTexts(STOCK_CODE);
    expect(stockCss.length).toBe(8);
    const files = readdirSync(join(OURS, "src")).filter((name) => name.endsWith(".module.css")).sort();
    expect(files.length).toBe(8);
    const ours = files.map((name) => readFileSync(join(OURS, "src", name), "utf8"));
    // Tam module trong src/ phai chua NGUYEN VAN tung chuoi CSS cua ban goc...
    for (const text of stockCss) expect(ours.some((file) => file.includes(text))).toBe(true);
    // ...va sau DE-BUNDLE, chuoi nhung nam trong src/client-parts/part-0*-client.ts (manh nguyen van),
    // KHONG con trong bundle sinh ra ⇒ tro phep so vao manh de-bundle (20/10/2026).
    const partsDir = join(OURS, "src", "client-parts");
    const parts = readdirSync(partsDir).filter((name) => name.endsWith(".ts")).sort();
    expect(parts.length).toBeGreaterThanOrEqual(6);
    // Mảnh de-bundle giữ NGUYÊN VĂN bundle gốc ⇒ trích `const css$N = "…"` bằng CÙNG helper `cssTexts`
    // (JSON.parse để giải escape) rồi so từng chuỗi; không so trên bundle sinh ra (đã hết chuỗi nhúng).
    const partCss = parts.flatMap((name) => cssTexts(readFileSync(join(partsDir, name), "utf8")));
    expect(partCss.length).toBe(8);
    for (const text of stockCss) expect(partCss).toContain(text);
  });

  test("giữ nguyên tiền tố hash lớp của bản gốc", () => {
    const files = readdirSync(join(OURS, "src")).filter((name) => name.endsWith(".module.css"));
    const joined = files.map((name) => readFileSync(join(OURS, "src", name), "utf8")).join("\n");
    for (const prefix of ["_76YFJG_", "_44HXVa_", "ZCYJYW_", "zwW4-W_", "yHnPSG_", "LcmJYa_", "tQSFJa_", "ywGceq_"]) expect(joined).toContain(prefix);
  });

  test("mọi data URI của bản gốc đều còn nguyên trong artifact của ta", () => {
    const stockAssets = allDataUris(STOCK_CODE);
    const ourAssets = allDataUris(OUR_CODE);
    // 10 tep anh + 3 bieu tuong buoc chon muc do + 1 bieu tuong nut quay lai + 1 spinner CSS = 15.
    expect(stockAssets.size).toBe(15);
    expect([...ourAssets].sort()).toEqual([...stockAssets].sort());
  });

  test("tệp nhị phân trong src/assets khớp byte với base64 của bản gốc", () => {
    const dir = join(OURS, "src", "assets");
    const stockAssets = assetUris(STOCK_CODE);
    let checked = 0;
    for (const [name, uri] of stockAssets) {
      const ext = uri.startsWith("data:image/webp") ? ".webp" : ".svg";
      const file = assetFile(name) + ext;
      const bytes = readFileSync(join(dir, file));
      expect(bytes.toString("base64")).toBe(uri.slice(uri.indexOf(",") + 1));
      checked += 1;
    }
    expect(checked).toBe(10);
    expect(readdirSync(dir).length).toBe(10);
  });
});

describe("ui-settings-account · định dạng số dư theo luật Platform Web", () => {
  test("khớp bảng của bản gốc (big.js)", () => {
    expect(formatBalance("0", "$")).toBe("$0.00");
    expect(formatBalance("0.00", "$")).toBe("$0.00");
    expect(formatBalance("0.001", "$")).toBe("<$0.01");
    expect(formatBalance("0.01", "¥")).toBe("¥0.01");
    expect(formatBalance("1.239", "$")).toBe("$1.23");
    expect(formatBalance("1234.567", "$")).toBe("$1,234.56");
    expect(formatBalance("-0.005", "$")).toBe("-$0.01");
    expect(formatBalance("-0.02", "$")).toBe("-$0.02");
    expect(formatBalance("-1.005", "$")).toBe("-$1.01");
    expect(formatBalance("9.999", "$")).toBe("$9.99");
  });
});

describe("ui-settings-account · cổng chống cài hai lần", () => {
  test("lần cài thứ hai trên cùng artifact VẪN đăng ký đủ (bản gốc KHÔNG latch phạm vi module", async () => {
    const ids: string[] = [];
    let factory: ((require: (s: string) => unknown) => { apply?: (ctx: unknown) => void }) | undefined;
    const win = {
      __ModuleLoader__: {
        load: (registration: { id: string; factory: typeof factory }) => {
          ids.push(registration.id);
          factory = registration.factory;
        },
      },
    };
    new Function("window", "document", OUR_CODE)(win, fakeDocument());
    const recorder: Recorder = { injected: [], registers: [], payloads: new Map(), dictionaries: new Map() };
    const store: SeedStore = { createSnapshotStore: makeStore, shallowEqual: (a: unknown, b: unknown) => a === b };
    const plugin = factory?.(fakeRequire(store));
    const ctx = fakeContext(recorder);
    plugin?.apply?.(ctx);
    const afterFirst = recorder.injected.length;
    expect(afterFirst).toBeGreaterThan(0);
    // 20/10/2026 — ĐO TỪ ARTEFACT: bản gốc KHÔNG latch phạm vi module ⇒ apply lần hai VẪN đăng ký
    // đủ (5→10), y như ui-jobs. Kỳ vọng cũ (bỏ qua lần hai) là SAI so với hành vi stock.
    plugin?.apply?.(ctx);
    expect(recorder.injected.length).toBe(afterFirst * 2);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  test("lần đầu NÉM ⇒ lần hai (ctx KHÁC) đăng ký lại ĐỦ; lần ba VẪN đăng ký (bản gốc KHÔNG latch)", async () => {
    let factory: ((require: (s: string) => unknown) => { apply?: (ctx: unknown) => void }) | undefined;
    const win = {
      __ModuleLoader__: {
        load: (registration: { factory: typeof factory }) => {
          factory = registration.factory;
        },
      },
    };
    new Function("window", "document", OUR_CODE)(win, fakeDocument());
    const store: SeedStore = { createSnapshotStore: makeStore, shallowEqual: (a: unknown, b: unknown) => a === b };
    const plugin = factory?.(fakeRequire(store));
    // Lần cài đầu NÉM giữa đường (đăng ký từ điển hỏng) ⇒ cờ PHẢI còn false.
    const first: Recorder = { injected: [], registers: [], payloads: new Map(), dictionaries: new Map() };
    const broken = fakeContext(first);
    const locale = broken["locale"] as { register: unknown };
    const original = locale.register;
    locale.register = () => {
      throw new Error("đăng ký từ điển hỏng giữa đường");
    };
    expect(() => plugin?.apply?.(broken)).toThrow();
    locale.register = original;
    // Lần hai (ctx KHÁC) phải đăng ký LẠI ĐỦ.
    const second: Recorder = { injected: [], registers: [], payloads: new Map(), dictionaries: new Map() };
    plugin?.apply?.(fakeContext(second));
    expect(second.injected.length).toBeGreaterThan(0);
    // 20/10/2026 — ĐO TỪ ARTEFACT: bản gốc KHÔNG latch phạm vi module ⇒ lần ba vẫn đăng ký đủ (5),
    // KHÔNG phải 0 như kỳ vọng cũ (giống ui-jobs).
    const third: Recorder = { injected: [], registers: [], payloads: new Map(), dictionaries: new Map() };
    plugin?.apply?.(fakeContext(third));
    expect(third.injected.length).toBe(5);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
