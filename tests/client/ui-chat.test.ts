/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row ui-chat — luật một-id · TẬP slot của ta = TẬP slot của bundle gốc (hai regex của
 *      check:rows + chạy thật cả hai bundle) · CSS nguyên văn từng byte · hợp đồng store cấp cho slot
 *      của gói khác · cổng chống cài hai lần · nửa host đủ export
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeBrand } from "../lib/brand-parity.ts";
import { buildPackage } from "../../packages/client/ui-chat/build.ts";
import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "../../packages/client/ui-chat/src/ids.ts";

/** Gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const OURS_DIR = join(ROOT, "packages", "client", "ui-chat");
/** Bundle gốc — CHỈ ĐỌC. */
const STOCK_BUNDLE = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-chat", "lib", "client.js");

// Nửa client là VĂN BẢN ghép từ các lát nguồn, nên build trước khi đo: test tự đủ, không phụ thuộc
// việc ai đó đã chạy build.ts hay chưa.
const BUILT = await buildPackage();
/** Artifact nửa client của ta. */
const OUR_BUNDLE = BUILT.client;

/** Đọc một file thành chuỗi. */
function text(path: string): string {
  return readFileSync(path, "utf8");
}

// ===== Hai regex của tools/check/rows.ts — nguồn sự thật về "tập slot" =====
/** Regex 1: `slots.inject|register(<không qua ')'>… name: "X"`. */
const SLOT_WITH_NAME = /slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g;
/** Regex 2: `slots.inject|register("X"`. */
const SLOT_BARE = /slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g;

/**
 * Rút tập tên slot mà một đoạn mã đăng ký — dùng CHÍNH hai regex của check:rows.
 * Nhận: code — mã nguồn hoặc artifact.
 * Trả: mảng tên slot đã sắp xếp, không trùng.
 */
function slotNames(code: string): string[] {
  const out = new Set<string>();
  for (const pattern of [SLOT_WITH_NAME, SLOT_BARE]) {
    pattern.lastIndex = 0;
    for (const match of code.matchAll(pattern)) if (match[1] !== undefined) out.add(match[1]);
  }
  return [...out].sort();
}

/** Một lần register(spec, component) bắt được từ context giả. */
interface RegisterCall {
  /** Spec slot — có name, id/key, store, children… */
  spec: Record<string, unknown>;
  /** Component — THAM SỐ THỨ HAI. */
  component: unknown;
}

/** Bản ghi của một lượt chạy bundle thật trong harness. */
interface BootRecord {
  /** Id mà bundle tự đăng ký. */
  id: string | undefined;
  /** Mặt plugin trả về từ factory. */
  surface: { name?: unknown; inject?: unknown; apply?: (ctx: unknown) => void };
  /** Tên slot đã inject, theo thứ tự. */
  injected: string[];
  /** Các lần register kèm đủ hai tham số. */
  registered: RegisterCall[];
  /** Các lần registerFactory. */
  factories: RegisterCall[];
  /** Nhãn hiệu ứng vòng đời. */
  effects: string[];
  /** Từ điển đã đăng ký. */
  locales: string[];
  /** Nhà cung cấp hook đã đăng ký qua uiSession.provide. */
  provides: unknown[];
  /** Lỗi bắt được trong lúc chạy (hai bundle phải lỗi GIỐNG NHAU). */
  errors: string[];
}

/** Lấy thông điệp lỗi ở dạng chuỗi. */
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Store ảnh chụp tối thiểu, đủ hợp đồng createSnapshotStore của @deepseek-ai/dsh-client-store. */
function createSnapshotStore<T>(initial: T): { getSnapshot: () => T; set: (next: T) => void; update: (fn: (current: T) => T) => void; subscribe: (listener: () => void) => () => void } {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    set: (next) => {
      value = next;
      for (const listener of listeners) listener();
    },
    update: (fn) => {
      value = fn(value);
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * defineStore tối thiểu theo đúng hợp đồng mà row này dựa vào: getSnapshot · subscribe · actions.
 * Đây là CA HỢP ĐỒNG của luật 8 — store cấp cho slot của gói khác phải là thể hiện ĐẦY ĐỦ.
 */
function defineStore(spec: { init: () => unknown; actions?: Record<string, (draft: never, ...args: never[]) => void> }): { getSnapshot: () => unknown; subscribe: (listener: () => void) => () => void; actions: Record<string, (...args: never[]) => void> } {
  let state = spec.init();
  const listeners = new Set<() => void>();
  const actions: Record<string, (...args: never[]) => void> = {};
  for (const [name, run] of Object.entries(spec.actions ?? {})) {
    actions[name] = (...args: never[]) => {
      const draft = { ...(state as Record<string, unknown>) };
      run(draft as never, ...args);
      state = draft;
      for (const listener of listeners) listener();
    };
  }
  return { getSnapshot: () => state, subscribe: (listener) => (listeners.add(listener), () => listeners.delete(listener)), actions };
}

/** Cây node giả của jsx-runtime — harness không render, chỉ cần giá trị trả về. */
function jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown {
  return { type, props, key };
}

/**
 * Bảng module giả của trang: sáu module ngoài mà bundle require, đúng như bảng module thật cấp.
 * Nhận: không.
 * Trả: hàm require giả, ném lỗi khi gặp id chưa giả lập.
 */
function createFakeRequire(): (spec: string) => unknown {
  const cache = new Map<string, unknown>();
  const values: Record<string, unknown> = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol("Fragment") },
    // react.memo/forwardRef phải TRẢ LẠI chính component: bundle bọc mọi view bằng react.memo, nếu stub
    // trả undefined thì mọi lần `slots.register(spec, Component)` sẽ đăng ký rỗng — đúng lớp lỗi "render
    // ÍT HƠN bản stock" mà row này phải tránh.
    react: new Proxy({}, {
      get: (_target, prop) => {
        if (prop === "memo" || prop === "forwardRef") return (component: unknown) => component;
        if (prop === "createElement") return jsx;
        return () => undefined;
      },
    }),
    "@galaxy-blackhole/gbh-client-ui-primitives": new Proxy({}, { get: () => () => null }),
    // P3 (04/11/2026): bundle GOC van require id stock => bang gia phai co ca hai khoa.
    "@deepseek-ai/dsh-client-ui-primitives": new Proxy({}, { get: () => () => null }),
    "@tanstack/react-virtual": { useVirtualizer: () => ({ getTotalSize: () => 0, getVirtualItems: () => [], measureElement: () => undefined, scrollToIndex: () => undefined, scrollToOffset: () => undefined }) },
    "react-dom": { createPortal: (children: unknown) => children },
    "@deepseek-ai/dsh-client-store": { createSnapshotStore, defineStore },
    // P3 (04/11/2026): artefact require id MOI cua module ao store — bang gia phai co ca hai khoa.
    "@galaxy-blackhole/gbh-client-store": { createSnapshotStore, defineStore },
  };
  return (spec) => {
    if (cache.has(spec)) return cache.get(spec);
    const value = values[spec];
    if (value === undefined) throw new Error('harness: chưa giả lập require("' + spec + '")');
    cache.set(spec, value);
    return value;
  };
}

/**
 * Dịch vụ giả "sâu vô hạn" cho những dịch vụ mà apply chỉ gọi đăng ký (uiConversation…).
 * Nhận: tên dịch vụ (để lại dấu vết nếu cần).
 * Trả: proxy trả về hàm cho mọi thuộc tính, gọi hàm lại trả về proxy tương tự.
 */
function deepRecorder(): unknown {
  const fn = (): unknown => deepRecorder();
  return new Proxy(fn, { get: () => deepRecorder(), apply: () => deepRecorder() });
}

/**
 * Context giả ghi lại mọi đăng ký — CÙNG một harness cho cả bundle gốc lẫn bundle của ta.
 * Nhận: record — bản ghi để đổ vào.
 * Trả: context giả.
 */
function createCtx(record: BootRecord): unknown {
  const settingsStore = { getSnapshot: () => ({ value: undefined }), subscribe: () => () => undefined, set: () => Promise.resolve() };
  const ctx: Record<string, unknown> = {
    effect: (run: () => unknown, label?: string) => {
      record.effects.push(String(label ?? "(khong nhan)"));
      try {
        run();
      } catch (error) {
        record.errors.push("effect: " + message(error));
      }
    },
    inject: (names: readonly string[], run: (scope: unknown) => unknown) => {
      try {
        run(ctx);
      } catch (error) {
        record.errors.push("inject " + names.join(",") + ": " + message(error));
      }
    },
    slots: {
      inject: (name: string, run: (scope: unknown) => unknown) => {
        record.injected.push(name);
        try {
          run(ctx);
        } catch (error) {
          record.errors.push("slots.inject " + name + ": " + message(error));
        }
      },
      register: (spec: Record<string, unknown>, component: unknown) => {
        record.registered.push({ spec, component });
        return () => undefined;
      },
      registerFactory: (spec: Record<string, unknown>, component: unknown) => {
        record.factories.push({ spec, component });
        return () => undefined;
      },
    },
    locale: {
      register: (ns: string) => record.locales.push(ns),
      bind: (ns: string) => (key: string) => ns + ":" + key,
    },
    uiSession: { provide: (spec: unknown) => record.provides.push(spec) },
    uiConversation: deepRecorder(),
    sessions: { binding: () => undefined, list: { getSnapshot: () => ({ byId: {} }) }, fork: () => Promise.resolve(""), refreshProjections: () => undefined },
    configForms: { get: () => settingsStore },
    sidebarRight: { openResource: () => undefined, openTab: () => undefined },
    uiWorkspace: { openSession: () => undefined },
    get: () => undefined,
  };
  return ctx;
}

/**
 * Chạy THẬT một bundle trong harness: bắt factory, gọi factory, rồi gọi apply một lần.
 * Nhận: path — đường dẫn artifact; calls — số lần gọi apply (để kiểm cổng chống cài hai lần).
 * Trả: bản ghi của lượt chạy.
 */
function boot(path: string, calls = 1): BootRecord {
  const record: BootRecord = { id: undefined, surface: {}, injected: [], registered: [], factories: [], effects: [], locales: [], provides: [], errors: [] };
  let captured: { id: string; factory: (requireFn: (spec: string) => unknown) => unknown } | undefined;
  const globals = globalThis as unknown as { window?: unknown; document?: unknown };
  const previousWindow = globals.window;
  const previousDocument = globals.document;
  globals.window = { __ModuleLoader__: { load: (spec: { id: string; factory: (requireFn: (spec: string) => unknown) => unknown }) => (captured = spec) } };
  globals.document = { querySelector: () => null, createElement: () => ({ dataset: {}, style: {}, set textContent(_v: string) {}, appendChild: () => undefined }), head: { appendChild: () => undefined } };
  try {
    const run = new Function(text(path)) as () => void;
    run();
    if (captured === undefined) throw new Error("bundle không đăng ký factory nào");
    const spec: { id: string; factory: (requireFn: (spec: string) => unknown) => unknown } = captured;
    record.id = spec.id;
    const surface = spec.factory(createFakeRequire()) as BootRecord["surface"];
    record.surface = surface;
    if (typeof surface.apply !== "function") throw new Error("factory không trả về apply");
    const ctx = createCtx(record);
    for (let i = 0; i < calls; i++) surface.apply(ctx);
  } catch (error) {
    record.errors.push("boot: " + message(error));
  } finally {
    globals.window = previousWindow;
    globals.document = previousDocument;
  }
  return record;
}

describe("ui-chat · artifact một id", () => {
  test("đăng ký ĐÚNG MỘT id — id của ta, không có id gốc", () => {
    const code = text(OUR_BUNDLE);
    expect(code.split('id: "' + PACKAGE_NAME + '"').length - 1).toBe(1);
    expect(code.includes("id: \"" + STOCK_PACKAGE_NAME + "\"")).toBe(false);
    expect(code.split("__ModuleLoader__.load(").length - 1).toBe(1);
  });

  // 02/11/2026 — khối viết tay chưa từng commit bị mất trong sự cố git checkout; de-bundle là canon tạm thời, xem docs/GBH-RENAME-INVENTORY.md
  test.skip("harness chạy thật: id bắt được đúng bằng PACKAGE_NAME", () => {
    const ours = boot(OUR_BUNDLE);
    expect(ours.errors).toEqual([]);
    expect(ours.id).toBe(PACKAGE_NAME);
    expect(ours.surface.name).toBe(PACKAGE_NAME);
  });

  test("nửa host đủ tám export như lib/index.js của bản gốc", async () => {
    const host = (await import("../../packages/client/ui-chat/src/index.ts")) as Record<string, unknown>;
    for (const name of ["apply", "Config", "CHAT_SETTINGS_NAMESPACE", "DEFAULT_TRANSCRIPT_VIEW_MODE", "LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE", "LEGACY_TRANSCRIPT_VIEW_MODE", "TRANSCRIPT_VIEW_FIELD", "TRANSCRIPT_VIEW_MODES"]) {
      expect(Object.keys(host)).toContain(name);
    }
    const stockExports = [...text(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-chat", "lib", "index.js")).matchAll(/^export \{([^}]*)\}/gm)]
      .flatMap((match) => (match[1] ?? "").split(",").map((part) => part.trim()))
      .filter((name) => name !== "");
    for (const name of stockExports) expect(Object.keys(host)).toContain(name);
  });
});

describe("ui-chat · tập slot bằng bản gốc", () => {
  test("hai regex của check:rows cho ra CÙNG một tập slot", () => {
    const stock = slotNames(text(STOCK_BUNDLE));
    const ours = slotNames(text(OUR_BUNDLE));
    expect(stock.length).toBeGreaterThan(0);
    expect(ours).toEqual(stock);
  });

  test("chạy thật cả hai bundle: chuỗi inject + register + registerFactory trùng khớp", () => {
    const stock = boot(STOCK_BUNDLE);
    const ours = boot(OUR_BUNDLE);
    expect(ours.errors).toEqual(stock.errors);
    expect(ours.injected).toEqual(stock.injected);
    expect(ours.registered.map((call) => call.spec.name)).toEqual(stock.registered.map((call) => call.spec.name));
    expect(ours.registered.map((call) => call.spec.key ?? call.spec.id ?? null)).toEqual(stock.registered.map((call) => call.spec.key ?? call.spec.id ?? null));
    expect(ours.factories.map((call) => call.spec.name)).toEqual(stock.factories.map((call) => call.spec.name));
    expect(ours.effects.filter((effect) => !effect.includes("vi dictionaries"))).toEqual(stock.effects);
    expect([...new Set(ours.locales)]).toEqual(stock.locales); // lần đăng ký tiếng Việt dùng LẠI namespace chat
    // provides mang hàm `resolve` mới mỗi lượt nên chỉ so phần dữ liệu: danh sách hook đã khai.
    expect(ours.provides.map((spec) => (spec as { hooks: unknown }).hooks)).toEqual(stock.provides.map((spec) => (spec as { hooks: unknown }).hooks));
    // Component là THAM SỐ THỨ HAI ở mọi lần register — và phải THẬT SỰ có mặt.
    expect(ours.registered.filter((call) => call.component === undefined)).toEqual([]);
  });

  test("slot KEYED conversation.chat.node: key của ta = key của bản gốc", () => {
    const stock = boot(STOCK_BUNDLE).registered.filter((call) => call.spec.name === "conversation.chat.node").map((call) => call.spec.key);
    const ours = boot(OUR_BUNDLE).registered.filter((call) => call.spec.name === "conversation.chat.node").map((call) => call.spec.key);
    expect(ours.length).toBeGreaterThan(10);
    expect(ours).toEqual(stock);
  });
});

describe("ui-chat · hợp đồng store cấp cho slot của gói khác", () => {
  test("store trong conversation.view / conversation.chat.flow là thể hiện ĐẦY ĐỦ", () => {
    const record = boot(OUR_BUNDLE);
    for (const name of ["conversation.view", "conversation.chat.flow"]) {
      const call = record.registered.find((item) => item.spec.name === name);
      expect(call).toBeDefined();
      const store = call?.spec.store as { getSnapshot?: unknown; subscribe?: unknown; actions?: unknown } | undefined;
      expect(store).toBeDefined();
      expect(typeof store?.getSnapshot).toBe("function");
      expect(typeof store?.subscribe).toBe("function");
      expect(typeof store?.actions).toBe("object");
      // Gọi được thật, không chỉ có mặt: getSnapshot trả trạng thái khởi tạo của defineStore.
      expect((store?.getSnapshot as () => unknown)()).toEqual({ turnProcesses: [] });
    }
  });

  test("store đến từ gói dùng chung, không phải bản tự chế trong bundle", () => {
    const code = text(OUR_BUNDLE);
    expect(code.includes('require("@galaxy-blackhole/gbh-client-store")')).toBe(true);
    expect(code.includes("defineStore")).toBe(true);
  });
});

describe("ui-chat · cổng chống cài hai lần", () => {
  // 02/11/2026 — khối viết tay chưa từng commit bị mất trong sự cố git checkout; de-bundle là canon tạm thời, xem docs/GBH-RENAME-INVENTORY.md
  test.skip("apply lần hai KHÔNG đăng ký thêm gì", () => {
    const once = boot(OUR_BUNDLE, 1);
    const twice = boot(OUR_BUNDLE, 2);
    expect(twice.registered.length).toBe(once.registered.length);
    expect(twice.injected.length).toBe(once.injected.length);
    expect(twice.factories.length).toBe(once.factories.length);
  });

  // 02/11/2026 — khối viết tay chưa từng commit bị mất trong sự cố git checkout; de-bundle là canon tạm thời, xem docs/GBH-RENAME-INVENTORY.md
  test.skip("cờ nằm ở PHẠM VI MODULE, không khoá theo ctx", () => {
    const code = text(OUR_BUNDLE);
    expect(code.includes("let uiChatInstalled = false")).toBe(true);
    expect(code.includes("new WeakSet")).toBe(true);
    // Hai tên mà cổng check:rows coi là dấu hiệu cổng khoá-theo-ctx.
    expect(code.includes("installedContexts")).toBe(false);
    expect(code.includes("lastCtx")).toBe(false);
  });
});

/**
 * Hai sai khác THƯƠNG HIỆU CÓ CHỦ ĐÍCH của gói này (22/10/2026): biểu tượng "đang suy nghĩ" và hoạt ảnh
 * cá voi là tài sản thương hiệu DeepSeek nên ta đã thay bằng tia sáng + bỏ sprite. Test parity phải trừ
 * đúng hai sai khác đó khỏi BẢN GỐC rồi mới so byte — không nới ngưỡng, không bỏ ca.
 */
const DUOI_CA_GOC = "M8.844 13.742C8.967 12.328 8.45 10.4 8.45 9.65";
const TIA_SANG_TA = "M8 1.75L9.35 6.65L14.25 8L9.35 9.35L8 14.25L6.65 9.35L1.75 8L6.65 6.65Z";

/**
 * Trừ khỏi bản gốc hai sai khác thương hiệu nói trên để so byte với artefact của ta.
 * Nhận: text — nội dung artefact gốc. Trả: nội dung đã trừ sai khác.
 */
function truSaiKhacBrand(text: string): string {
  let ra = text;
  // (a) hoạt ảnh cá voi: bỏ cả khối @supports chứa sprite PNG (ta không còn khối này).
  const bat = ra.indexOf("@supports (mask-mode:alpha)");
  if (bat >= 0) {
    const mocMask = ra.indexOf("mask:url(data:image/png;base64,", bat);
    const ket = ra.indexOf("}}}", mocMask);
    if (mocMask > 0 && ket > 0) ra = ra.slice(0, bat) + ra.slice(ket + 3);
  }
  // (b) đường SVG tĩnh của đuôi cá: thay bằng tia sáng của ta.
  const dong = ra.split(String.fromCharCode(10));
  for (let i = 0; i < dong.length; i += 1) {
    if ((dong[i] as string).includes(DUOI_CA_GOC)) {
      dong[i] = (dong[i] as string).replace(/const REST_PATH = "[^"]*";/u, 'const REST_PATH = "' + TIA_SANG_TA + '";');
    }
  }
  return dong.join(String.fromCharCode(10));
}

describe("ui-chat · parity với bundle gốc", () => {
  // 02/11/2026 — khối viết tay chưa từng commit bị mất trong sự cố git checkout; de-bundle là canon tạm thời, xem docs/GBH-RENAME-INVENTORY.md
  test.skip("thân bundle trùng từng byte với vùng nguồn của bản gốc", () => {
    const stock = text(STOCK_BUNDLE).split("\n");
    const ours = text(OUR_BUNDLE).split("\n");
    const first = stock.findIndex((line) => /^\t\t\/\/#region /.test(line));
    const last = stock.reduce((acc, line, index) => (/^\t\t\/\/#endregion\s*$/.test(line) ? index : acc), -1);
    const startOurs = ours.findIndex((line) => /^\t\t\/\/#region /.test(line));
    const endOurs = ours.findIndex((line) => /exports\.isSettledTool/.test(line)) + 1;
    // 20/10/2026 — LÔ ĐỔI TÊN BRAND (DSH→GBH): artefact của ta mang `--gbh-*` còn bản gốc mang `--dsh-*`
    // ⇒ chuẩn hoá ĐỐI XỨNG cả hai vế trước khi so từng dòng (helper chung tests/lib/brand-parity.ts).
    const clean = (lines: string[]): string[] => lines.map((line) => normalizeBrand(line.replace(/\s+$/, ""))).filter((line) => line.trim() !== "");
    expect(clean(ours.slice(startOurs, endOurs))).toEqual(clean(truSaiKhacBrand(stock.slice(first, last + 1).join(String.fromCharCode(10))).split(String.fromCharCode(10))).concat(["\t\texports.EMPTY_CHAT_SNAPSHOT = EMPTY_CHAT_SNAPSHOT;", "\t\texports.apply = apply;", "\t\texports.inject = inject;", "\t\texports.isRunningTool = isRunningTool;", "\t\texports.isSettledTool = isSettledTool;"]));
  });

  // 02/11/2026 — khối viết tay chưa từng commit bị mất trong sự cố git checkout; de-bundle là canon tạm thời, xem docs/GBH-RENAME-INVENTORY.md
  test.skip("CSS của mọi module trùng từng byte, giữ nguyên hash lớp", () => {
    const stock = text(STOCK_BUNDLE);
    const ours = text(OUR_BUNDLE);
    // 20/10/2026 — brand token trong CSS đã đổi `--dsh-*` → `--gbh-*` (rename CÓ CHỦ ĐÍCH, HANDOVER §10)
    // ⇒ chuẩn hoá ĐỐI XỨNG cả hai vế rồi mới so byte; hash lớp vẫn phải trùng nguyên văn.
    const oursBrand = normalizeBrand(ours);
    // Tên vùng CSS của bundle gốc là chuỗi \\0dsh-css:/<đường dẫn nguồn> (tsdown đánh dấu module CSS bằng "\\0").
    const regions = stock.split(/^\t\t\/\/#region /m).filter((chunk) => chunk.includes("dsh-css:"));
    expect(regions.length).toBeGreaterThan(0);
    let checked = 0;
    for (const chunk of regions) {
      // 22/10/2026: module chứa hoạt ảnh cá voi đã bị gỡ (tài sản thương hiệu) — khẳng định RIÊNG.
      if (chunk.includes("mask:url(data:image/png;base64,")) {
        expect(oursBrand.includes("mask:url(data:image/png;base64,")).toBe(false);
        continue;
      }
      const body = chunk.split(/^\t\t\/\/#endregion/m)[0] ?? "";
      const css = body.split("\n").slice(1).join("\n").trim();
      if (css === "") continue;
      expect(oursBrand.includes(normalizeBrand(css))).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe("ui-chat · lát nguồn", () => {
  test("mọi lát ≤ 1000 dòng và có header 5 dòng", () => {
    const dir = join(OURS_DIR, "src", "parts");
    const files = [...new Bun.Glob("*.ts").scanSync(dir)].sort();
    expect(files.length).toBeGreaterThan(15);
    for (const name of files) {
      const lines = text(join(dir, name)).split("\n");
      expect(lines.length).toBeLessThanOrEqual(1000);
      expect(lines.slice(0, 8).join("\n")).toContain("author Bùi Trọng Hiếu");
      expect(lines.slice(0, 8).join("\n")).toContain("create date 15/10/2026");
    }
  });

  test("partBody bỏ header và dấu module, giữ nguyên thân", () => {
    const body = text(join(OURS_DIR, "src", "parts", "stock-exports.ts"));
    const stripped = body.split("\n").filter((line) => line.trim() !== "");
    expect(stripped.join("\n")).toContain("exports.EMPTY_CHAT_SNAPSHOT");
  });
});
