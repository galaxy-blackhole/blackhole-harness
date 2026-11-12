/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-client-locale (row locale): A/B TANG DICH VU voi bundle goc
 *      — dung cho 48 row khac phu thuoc, nen kiem HE QUA chu khong chi kiem row chay
 *      11/11/2026: ly do sua — them ca chong TAI PHAT loi "namespace vi RONG": menu chuot phai cua phien
 *      hien tieng Anh "Delete session" vi viSessionDelete sinh ra bang RONG tu mot namespace khong co
 *      trong nguon, va khong cong nao bat duoc.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Gốc repo (tests/client → ../..). */
const REPO = join(import.meta.dir, "..", "..");

/** Bundle nửa browser của bản gốc DSH (CHỈ ĐỌC — nguồn đối chiếu oracle). */
const STOCK_BUNDLE = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-client-locale/lib/client.js");

/** Manifest hai bên. */
const OUR_MANIFEST = join(REPO, "packages/client/locale/package.json");
const STOCK_MANIFEST = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-client-locale/package.json");

/** Id module hai bên. */
const OUR_PACKAGE = "@galaxy-blackhole/gbh-client-locale";
const STOCK_PACKAGE = "@deepseek-ai/dsh-client-locale";

/** Một lời gọi `__ModuleLoader__.load`. */
interface Registration {
  /** Id module bundle tự khai. */
  id: string;
  /** Factory lười. */
  factory: (require: (specifier: string) => unknown) => unknown;
}

/**
 * Chạy một bundle như thẻ `<script>` classic.
 * Nhận: `code` — nguồn bundle.
 * Trả: các đăng ký đã thực hiện.
 */
function runBundle(code: string): Registration[] {
  const registrations: Registration[] = [];
  const facade = {
    load: (registration: Registration): void => {
      registrations.push(registration);
    },
  };
  const scope = globalThis as unknown as { __ModuleLoader__?: unknown };
  const previous = scope.__ModuleLoader__;
  // Bundles đọc bộ nạp qua `window.__ModuleLoader__`, mà Bun KHÔNG có `window` toàn cục ⇒ phải tự cài
  // trong lúc nạp rồi trả lại nguyên descriptor cũ.
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true, writable: true });
  scope.__ModuleLoader__ = facade;
  try {
    // KHÔNG truyền `window` làm THAM SỐ: làm vậy thì trong bundle `window` luôn "có", và phép dò
    // ngôn ngữ trình duyệt (`typeof window === "undefined"`) sẽ đi nhầm nhánh — từng làm cả bundle
    // gốc lẫn của ta chết ở `navigator.languages` khi `navigator.language` là undefined.
    new Function(code)();
  } finally {
    if (windowDescriptor === undefined) delete (globalThis as unknown as Record<string, unknown>).window;
    else Object.defineProperty(globalThis, "window", windowDescriptor);
    if (previous === undefined) delete scope.__ModuleLoader__;
    else scope.__ModuleLoader__ = previous;
  }
  return registrations;
}

/** Bề mặt module của nửa browser (cả hai bên cùng hình dạng). */
interface LocaleModule {
  /** Namespace dùng chung. */
  COMMON_NS: string;
  /** Ngôn ngữ dự phòng. */
  FALLBACK_LOCALE: string;
  /** Lớp dịch vụ. */
  LocaleRuntime: new (ctx: unknown, host?: unknown, bootstrap?: unknown) => LocaleService;
  /** Namespace cài đặt của mục này. */
  SETTINGS_NS: string;
  /** Điểm vào. */
  apply(ctx: unknown): Promise<void>;
  /** Seam service. */
  inject: string[];
}

/** Bề mặt dịch vụ mà 48 row khác dùng. */
interface LocaleService {
  /** Bản chụp ngôn ngữ đang hiện (ĐO ĐƯỢC ở bản gốc: trả về bản chụp, không phải id). */
  getLocale(): { active: string; locales: readonly { id: string; label: string }[]; revision: number };
  /** Chọn chữ của một giá trị đa ngôn ngữ. */
  resolveText(text: string | Record<string, string>): string;
  /** Bản chụp trạng thái. */
  getSnapshot(): { active: string; locales: readonly { id: string; label: string }[]; revision: number };
  /** Theo dõi thay đổi. */
  subscribe(fn: () => void): () => void;
  /** Đặt ngôn ngữ. */
  setLocale(id: string): void;
  /** Thêm gói ngôn ngữ. */
  addLanguage(input: { id: string; label: string; fallback?: string }): () => void;
  /** Đăng ký từ điển. */
  register(ns: string, localeOrDicts: unknown, dict?: unknown): () => void;
  /** Buộc namespace thành hàm dịch. */
  bind(ns: string): (key: string, params?: Record<string, string | number>) => string;
}

/** Bảng hook React giả (chỉ `useState`). */
function fakeHooks(): Record<string, unknown> {
  const cells: unknown[] = [];
  let cursor = 0;
  return {
    useState: <S>(initial: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void] => {
      const cell = cursor;
      cursor += 1;
      if (!(cell in cells)) cells[cell] = typeof initial === "function" ? (initial as () => S)() : initial;
      return [cells[cell] as S, (value: S | ((previous: S) => S)): void => {
        cells[cell] = typeof value === "function" ? (value as (from: S) => S)(cells[cell] as S) : value;
      }];
    },
  };
}

/** Bảng client-store giả: `defineStore` chỉ ghi lại khai báo. */
function fakeStore(): { defineStore(definition: unknown): unknown } {
  return {
    defineStore: (definition: unknown): unknown => {
      // Kho giả: giữ init + actions để slot gọi `sync` như thật.
      const store = definition as { init(): Record<string, unknown>; actions: Record<string, (...args: unknown[]) => void> };
      const state = store.init();
      const sync = (active: string, options: unknown, revision: number): void => store.actions.sync?.(state, active, options, revision);
      return { state, sync };
    },
  };
}

/**
 * `require` giả: CHỈ cung cấp đúng những gì bundle gốc dùng (stub không rộng hơn module thật).
 * Nhận: `hooks`, `store`.
 * Trả: hàm require.
 */
function fakeRequire(hooks: Record<string, unknown>, store: { defineStore(definition: unknown): unknown }): (specifier: string) => unknown {
  const modules: Record<string, unknown> = {
    react: hooks,
    "react/jsx-runtime": {
      Fragment: "Fragment",
      jsx: (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key }),
      jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key }),
    },
    "@deepseek-ai/dsh-client-ui-primitives": { Menu: "Menu", IconChevronDownOutlineRegular: "IconChevronDownOutlineRegular" },
    "@deepseek-ai/dsh-client-store": store,
  };
  return (specifier: string): unknown => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    if (!(specifier in modules)) throw new Error("test: khong duoc require " + specifier);
    return modules[specifier];
  };
}

/** Bảng ghi seam của một lần `apply`. */
interface SeamLog {
  /** Nhãn hiệu ứng. */
  effects: string[];
  /** Dịch vụ đã phơi. */
  provided: { name: string; value: unknown }[];
  /** Sự kiện đã nghe. */
  listened: string[];
  /** Sự kiện đã phát. */
  emitted: string[];
  /** Dịch vụ từ điển đã gắn vào seam slot. */
  installed: LocaleService[];
  /** Slot đã inject vào. */
  injected: string[];
  /** Occupant đã đăng ký. */
  registered: { definition: Record<string, unknown>; component: unknown }[];
}

/**
 * Context giả phía browser đủ cho row `locale`.
 * Nhận: `options` — có phạm vi cài đặt host hay không.
 * Trả: context giả + bảng ghi.
 */
function fakeContext(options: { host?: unknown } = {}): { ctx: unknown; log: SeamLog; provided(): LocaleService | undefined } {
  const log: SeamLog = { effects: [], provided: [], listened: [], emitted: [], installed: [], injected: [], registered: [] };
  const ctx = {
    fiber: { uid: "fiber-1" },
    effect: (callback: () => unknown, label: string): void => {
      log.effects.push(label);
      callback();
    },
    emit: (event: string): void => {
      log.emitted.push(event);
    },
    provide: (name: string, value: unknown): void => {
      log.provided.push({ name, value });
    },
    on: (event: string): void => {
      log.listened.push(event);
    },
    configForms: { get: (): unknown => options.host },
    slots: {
      installLocale: (locale: LocaleService): void => {
        log.installed.push(locale);
      },
      inject: (slot: string, register: () => unknown): void => {
        log.injected.push(slot);
        register();
      },
      register: (definition: Record<string, unknown>, component: unknown): unknown => {
        log.registered.push({ definition, component });
        return () => undefined;
      },
    },
  };
  return { ctx, log, provided: () => log.provided.find((entry) => entry.name === "locale")?.value as LocaleService | undefined };
}

/** Nguồn bundle của ta. */
let ourCode: string | undefined;

/**
 * Build nửa client của ta vào thư mục tạm rồi trả nguồn bundle.
 * Nhận: cacheBuster — nhãn tuỳ chọn buộc build MỚI + đánh dấu nguồn riêng cho ca cần instance độc lập
 *   (tiền lệ resources.test.ts: cờ chống cài hai lần là PHẠM VI MODULE nên ca đo cổng phải có bundle riêng).
 * Trả: nguồn `lib/client.js`.
 */
async function bundleOfOurs(cacheBuster?: string): Promise<string> {
  if (cacheBuster === undefined && ourCode !== undefined) return ourCode;
  const { buildPackage } = await import("../../packages/client/locale/build.ts");
  const out = await mkdtemp(join(tmpdir(), "gbh-locale-"));
  await buildPackage(out);
  const code = readFileSync(join(out, "client.js"), "utf8");
  if (cacheBuster === undefined) {
    ourCode = code;
    return code;
  }
  // Ca cần instance ĐỘC LẬP: build mới + nhãn riêng để không dùng chung nguồn đã cache với ca khác.
  return code + "\n// cache-buster: " + cacheBuster;
}

/**
 * Nạp một bundle rồi gọi factory để lấy bề mặt module.
 * Nhận: `code`, `hooks`, `store`.
 * Trả: bề mặt module.
 */
function loadModule(code: string, hooks: Record<string, unknown>, store: { defineStore(definition: unknown): unknown }): LocaleModule {
  const registration = runBundle(code)[0];
  if (registration === undefined) throw new Error("test: bundle khong dang ky module nao");
  return registration.factory(fakeRequire(hooks, store)) as LocaleModule;
}

/** Nạp cả hai bên. */
async function bothModules(): Promise<{ ours: LocaleModule; stock: LocaleModule }> {
  return {
    ours: loadModule(await bundleOfOurs(), fakeHooks(), fakeStore()),
    stock: loadModule(readFileSync(STOCK_BUNDLE, "utf8"), fakeHooks(), fakeStore()),
  };
}

/**
 * Chạy một đoạn trong "môi trường trình duyệt" giả rồi trả lại nguyên trạng.
 * Cần thiết vì Bun cũng định nghĩa `window` nhưng `navigator.language` lại undefined — đúng như bản gốc,
 * đường dò ngôn ngữ trình duyệt sẽ đọc phải undefined; trong browser thật thì không bao giờ xảy ra.
 * Nhận: `navigatorValue` — navigator giả (hoặc `undefined` để giả lập "không phải trình duyệt"), `body` — việc cần chạy.
 * Trả: giá trị mà `body` trả.
 */
function withBrowser<T>(navigatorValue: unknown, body: () => T): T {
  const scope = globalThis as unknown as Record<string, unknown>;
  // `window`/`navigator` trong Bun là thuộc tính KHÔNG ghi đè được bằng phép gán, nên phải
  // `defineProperty` và trả lại NGUYÊN descriptor cũ (không đoán hình dạng của nó).
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "navigator", { value: navigatorValue, configurable: true, writable: true });
  Object.defineProperty(globalThis, "window", {
    value: navigatorValue === undefined ? undefined : globalThis,
    configurable: true,
    writable: true,
  });
  try {
    return body();
  } finally {
    if (navigatorDescriptor === undefined) delete scope.navigator;
    else Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    if (windowDescriptor === undefined) delete scope.window;
    else Object.defineProperty(globalThis, "window", windowDescriptor);
  }
}

/**
 * Dựng dịch vụ trong môi trường "không phải trình duyệt" cho các ca KHÔNG đo phép dò ngôn ngữ.
 * (Bun có `window` nhưng `navigator.language` lại undefined, nên đường dò ngôn ngữ phải đi qua
 * `withBrowser` — cả bản gốc cũng vậy, đây là chuyện của môi trường test chứ không phải của row.)
 * Nhận: `module` — bề mặt module, `ctx` — context giả, `bootstrap` — dữ liệu khởi tạo native.
 * Trả: dịch vụ đã dựng.
 */
function makeService(module: LocaleModule, ctx: unknown, bootstrap?: unknown): LocaleService {
  return withBrowser(undefined, () => new module.LocaleRuntime(ctx, undefined, bootstrap));
}

/** Context tối thiểu cho việc dựng trực tiếp `LocaleRuntime`. */
function runtimeContext(): { ctx: unknown; emitted: string[]; effects: string[] } {
  const emitted: string[] = [];
  const effects: string[] = [];
  return {
    ctx: {
      effect: (callback: () => unknown, label: string): void => {
        effects.push(label);
        callback();
      },
      emit: (event: string): void => {
        emitted.push(event);
      },
      provide: (): void => undefined,
    },
    emitted,
    effects,
  };
}

describe("row locale — tầng dịch vụ (48 row khác phụ thuộc)", () => {
  test("ca 1: hằng số + seam của module khớp bản gốc", async () => {
    const { ours, stock } = await bothModules();
    expect(ours.COMMON_NS).toBe(stock.COMMON_NS);
    expect(ours.FALLBACK_LOCALE).toBe(stock.FALLBACK_LOCALE);
    expect(ours.SETTINGS_NS).toBe(stock.SETTINGS_NS);
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["slots", "remote", "configForms"]);
    expect(typeof ours.LocaleRuntime).toBe("function");
    expect(typeof ours.apply).toBe("function");
  });

  test("ca 2: dựng dịch vụ — ngôn ngữ ban đầu, danh mục, revision, resolveText", async () => {
    const { ours, stock } = await bothModules();
    // 18/10/2026 — CẬP NHẬT (dọn 3 ca locale cũ của task-7): danh mục ngôn ngữ KHÁC CÓ CHỦ ĐÍCH
    //   (ta: ["vi","en"] theo yêu cầu chủ dự án; gốc: ["zh","en"]). Phép so phần CHUNG (mọi trường trừ
    //   danh mục) vẫn giữ nguyên giá trị đối chứng; danh mục được khẳng định RIÊNG cho từng bên.
    /** Bỏ trường danh mục ngôn ngữ để so PHẦN CHUNG giữa hai bên. */
    const withoutLocales = (snapshot: unknown): Record<string, unknown> => {
      const { locales, ...rest } = snapshot as Record<string, unknown>;
      void locales;
      return rest;
    };
    /** Dựng cả hai bên trong cùng một môi trường (browser giả) và so từng thứ. */
    const build = (
      navigatorValue: { languages?: string[]; language?: string } | undefined,
      bootstrap: { languages: string[]; preference: string | null } | undefined,
      compare = true,
    ): { mine: LocaleService; theirs: LocaleService; active: string } =>
      withBrowser(navigatorValue, () => {
        const mine = new ours.LocaleRuntime(runtimeContext().ctx, undefined, bootstrap);
        const theirs = new stock.LocaleRuntime(runtimeContext().ctx, undefined, bootstrap);
        // ĐO ĐƯỢC: `getLocale()` của bản gốc trả về BẢN CHỤP (giống `getSnapshot()`), không phải id.
        expect(mine.getLocale()).toEqual(mine.getSnapshot());
        if (compare) {
          expect(withoutLocales(mine.getSnapshot())).toEqual(withoutLocales(theirs.getSnapshot()));
          expect(mine.getSnapshot().revision).toBe(0);
          expect(mine.getSnapshot().locales.map((locale) => locale.id)).toEqual(["vi", "en"]);
          expect(theirs.getSnapshot().locales.map((locale) => locale.id)).toEqual(["zh", "en"]);
        }
        expect(mine.resolveText({ en: "English" })).toBe("English");
        return { mine, theirs, active: mine.getSnapshot().active };
      });
    // (a) không phải trình duyệt (window undefined) ⇒ rơi về en
    expect(build(undefined, undefined).active).toBe("en");
    // (b) trình duyệt nói tiếng Pháp ⇒ không có gói fr, rơi về en
    expect(build({ languages: ["fr-CA", "en-US"], language: "fr-CA" }, undefined).active).toBe("en");
    // (c) trình duyệt nói tiếng Trung: TA ĐÃ BỎ zh ⇒ rơi về en (bản gốc vẫn khớp zh — khác có chủ đích)
    expect(build({ languages: ["zh-Hans"], language: "zh-Hans" }, undefined, false).active).toBe("en");
    // (d) vỏ native cấp thứ tự ngôn ngữ ⇒ thắng cả trình duyệt — đo bằng vi, ngôn ngữ TA có mà gốc không
    expect(build({ languages: ["en-US"], language: "en-US" }, { languages: ["vi-VN"], preference: null }, false).active).toBe("vi");
    // (e) lựa chọn đã lưu ở vỏ native ⇒ thắng
    expect(build(undefined, { languages: ["vi-VN"], preference: "en" }, false).active).toBe("en");
    // (f) lựa chọn đã lưu nhưng gói không còn ⇒ rơi về suy từ trình duyệt (zh đã bỏ ⇒ en)
    expect(build(undefined, { languages: ["zh-CN"], preference: "fr" }, false).active).toBe("en");
  });

  test("ca 3: từ điển — register/bind/translate với chuỗi dự phòng namespace → common → khoá", async () => {
    const { ours, stock } = await bothModules();
    const mineCtx = runtimeContext();
    const theirsCtx = runtimeContext();
    const mine = makeService(ours, mineCtx.ctx);
    const theirs = makeService(stock, theirsCtx.ctx);
    mine.register("common", { zh: { ok: "确定" }, en: { ok: "OK" } });
    theirs.register("common", { zh: { ok: "确定" }, en: { ok: "OK" } });
    mine.register("demo", { zh: { title: "标题", only: "中文独有" }, en: { title: "Title" } });
    theirs.register("demo", { zh: { title: "标题", only: "中文独有" }, en: { title: "Title" } });
    const mineT = mine.bind("demo");
    const theirsT = theirs.bind("demo");
    expect(mineT("title")).toBe(theirsT("title"));
    expect(mineT("title")).toBe("Title");
    expect(mineT("ok")).toBe(theirsT("ok")); // rơi về namespace common
    expect(mineT("missing.key")).toBe(theirsT("missing.key")); // rơi về chính khoá
    expect(mineT("missing.key")).toBe("missing.key");
    expect(mine.bind("demo")).toBe(mineT); // bind có cache
    // tham số điền
    expect(mineT("greet", { n: 3 })).toBe(theirsT("greet", { n: 3 }));
    // đăng ký trùng namespace+ngôn ngữ ⇒ cùng thông báo lỗi
    const mineError = (() => { try { mine.register("demo", { en: {} }); return ""; } catch (error) { return String(error); } })();
    const theirError = (() => { try { theirs.register("demo", { en: {} }); return ""; } catch (error) { return String(error); } })();
    expect(mineError).toBe(theirError);
    expect(mineError).toContain('locale namespace "demo" already has locale "en"');
    const badId = (() => { try { mine.register("x", { "not a tag!": {} }); return ""; } catch (error) { return String(error); } })();
    expect(badId).toContain("is not a BCP 47-style tag");
  });

  test("ca 4: setLocale + người nghe — revision tăng, sự kiện chỉ khi ĐỔI ngôn ngữ, listener hỏng không chặn", async () => {
    const { ours, stock } = await bothModules();
    const mineCtx = runtimeContext();
    const theirsCtx = runtimeContext();
    const mine = makeService(ours, mineCtx.ctx);
    const theirs = makeService(stock, theirsCtx.ctx);
    mine.register("common", { zh: { ok: "确定" }, en: { ok: "OK" } });
    theirs.register("common", { zh: { ok: "确定" }, en: { ok: "OK" } });
    let mineTicks = 0;
    let theirsTicks = 0;
    mine.subscribe(() => {
      mineTicks += 1;
    });
    theirs.subscribe(() => {
      theirsTicks += 1;
    });
    // 18/10/2026 — CẬP NHẬT (dọn 3 ca locale cũ của task-7): danh mục hai bên KHÁC CÓ CHỦ ĐÍCH
    //   (ta vi+en / gốc zh+en) nên KHÔNG so id; mỗi bên đổi sang ngôn ngữ thứ hai CỦA MÌNH rồi so
    //   HÌNH DẠNG hành vi: revision tăng đúng 1, số tick listener, và tên sự kiện.
    const before = mine.getSnapshot().revision;
    mine.setLocale("vi");
    theirs.setLocale("zh");
    expect(mine.getSnapshot().active).toBe("vi");
    expect(theirs.getSnapshot().active).toBe("zh");
    expect(mine.getSnapshot().revision).toBeGreaterThan(before);
    expect(mine.getSnapshot().revision).toBe(theirs.getSnapshot().revision);
    expect(mineTicks).toBe(theirsTicks);
    expect(mineCtx.emitted).toEqual(["locale/change"]);
    expect(theirsCtx.emitted).toEqual(["locale/change"]);
    // Bảng common chỉ có zh+en ⇒ với vi, ta rơi về en; gốc đang zh nên trả bản zh.
    expect(mine.bind("common")("ok")).toBe("OK");
    expect(theirs.bind("common")("ok")).toBe("确定");
    const unknown = (() => { try { mine.setLocale("fr"); return ""; } catch (error) { return String(error); } })();
    const unknownTheirs = (() => { try { theirs.setLocale("fr"); return ""; } catch (error) { return String(error); } })();
    expect(unknown).toBe(unknownTheirs);
    expect(unknown).toContain('locale "fr" is not registered');
    // một listener hỏng KHÔNG được chặn listener khác
    let survived = 0;
    mine.subscribe(() => {
      throw new Error("no");
    });
    mine.subscribe(() => {
      survived += 1;
    });
    expect(() => {
      mine.setLocale("en");
    }).not.toThrow();
    expect(survived).toBe(1);
  });

  test("ca 5: addLanguage — gói hợp lệ, id trùng, fallback lạ, chu trình (đều hoàn tác)", async () => {
    const { ours, stock } = await bothModules();
    const mine = makeService(ours, runtimeContext().ctx);
    const theirs = makeService(stock, runtimeContext().ctx);
    const run = (service: LocaleService, action: () => unknown): string => {
      try {
        action();
        return "ok";
      } catch (error) {
        return String(error);
      }
    };
    // hợp lệ: ja → en
    expect(run(mine, () => service_add(mine, { id: "ja", label: "日本語", fallback: "en" }))).toBe("ok");
    // 18/10/2026: module STOCK doc mot bien toan cuc luc nap ngon ngu mac dinh. Chay CA SUITE thi file test
    //   khac de lai bien do o trang thai khac => `value.toLowerCase` nem `undefined is not an object`
    //   (ca nay PASS khi chay rieng). => Dat MOI TRUONG TRINH DUYET TUONG MINH bang helper `withBrowser`
    //   de ca test KHONG phu thuoc thu tu chay file.
    const themOk = withBrowser({ language: "en", languages: ["en"] }, () =>
      run(theirs, () => service_add(theirs, { id: "ja", label: "日本語", fallback: "en" })),
    );
    expect(themOk).toBe("ok");
    // 18/10/2026 — CẬP NHẬT (dọn 3 ca locale cũ của task-7): ta BỎ zh + THÊM vi ⇒ so danh mục sau khi
    //   chuẩn hoá phần khác biệt CÓ CHỦ ĐÍCH, không so trực tiếp hai bên.
    const idsOf = (service: LocaleService): string[] => service.getSnapshot().locales.map((l) => l.id);
    expect(idsOf(mine)).toEqual(["vi", "en", "ja"]);
    expect(idsOf(theirs)).toEqual(["zh", "en", "ja"]);
    // trùng id ⇒ cùng lỗi
    const dup = run(mine, () => service_add(mine, { id: "ja", label: "x", fallback: "en" }));
    expect(dup).toBe(run(theirs, () => service_add(theirs, { id: "ja", label: "x", fallback: "en" })));
    expect(dup).toContain('locale "ja" is already registered');
    // fallback chưa đăng ký ⇒ cùng lỗi. Dùng fr: vi nay ĐÃ đăng ký ở bản của ta, zh ở bản gốc —
    //   chỉ fr là "không có ở cả hai" nên phép đối chứng mới có nghĩa.
    const unknown = run(mine, () => service_add(mine, { id: "ko", label: "한국어", fallback: "fr" }));
    expect(unknown).toBe(run(theirs, () => service_add(theirs, { id: "ko", label: "한국어", fallback: "fr" })));
    expect(unknown).toContain('locale fallback "fr" is not registered');
    // chu trình: a → b → a ⇒ lỗi, và KHÔNG để lại dấu vết trong danh mục
    expect(run(mine, () => service_add(mine, { id: "aa", label: "A", fallback: "en" }))).toBe("ok");
    // ĐO ĐƯỢC ở bản gốc: tự-trỏ-fallback bị chặn NGAY ở phép kiểm "fallback chưa đăng ký" (đứng trước
    // phép kiểm chu trình), nên nhánh "chu trình" là phòng thủ nhiều lớp chứ không tới được từ đây.
    const cycle = run(mine, () => service_add(mine, { id: "bb", label: "B", fallback: "bb" }));
    expect(cycle).toBe(run(theirs, () => service_add(theirs, { id: "bb", label: "B", fallback: "bb" })));
    expect(cycle).toContain('locale fallback "bb" is not registered');
    // "aa" chỉ được thêm vào BẢN CỦA TA ở ca này ⇒ bản gốc vẫn 3 ngôn ngữ.
    expect(idsOf(mine)).toEqual(["vi", "en", "ja", "aa"]);
    expect(idsOf(theirs)).toEqual(["zh", "en", "ja"]);
    // nhãn rỗng ⇒ cùng lỗi
    const empty = run(mine, () => service_add(mine, { id: "cc", label: "  ", fallback: "en" }));
    expect(empty).toBe(run(theirs, () => service_add(theirs, { id: "cc", label: "  ", fallback: "en" })));
    expect(empty).toContain("locale label must not be empty");
  });
});

describe("row locale — cổng chống cài hai lần", () => {
  test("lần đầu NÉM ⇒ cờ vẫn false ⇒ lần hai (ctx KHÁC) đăng ký lại ĐỦ; lần ba không đăng ký", async () => {
    // Cache-buster RIÊNG cho ca này: cờ chống cài hai lần là PHẠM VI MODULE, nên ca đo cổng phải nạp
    // instance MỚI (tiền lệ tests/client/resources.test.ts) — không dùng chung nguồn đã cache với ca khác.
    const code = await bundleOfOurs("locale-idem=2");
    // Môi trường trình duyệt XÁC ĐỊNH: khi chạy CẢ BỘ, navigator toàn cục có thể bị ca khác để lại
    // (Bun: `navigator.language` undefined) làm `detectBrowserLocale` ném TypeError ⇒ ca đỏ oan.
    // Đặt navigator/window hợp lệ trong SUỐT ca rồi trả lại nguyên descriptor cũ.
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "navigator", { value: { language: "en", languages: ["en"] }, configurable: true, writable: true });
    Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true, writable: true });
    try {
    // MỘT instance module áp cho BA ctx khác nhau.
    const module_ = loadModule(code, fakeHooks(), fakeStore());
    const first = fakeContext();
    const firstCtx = first.ctx as Record<string, unknown>;
    // `ctx.get` là API cordis thật (seam tối thiểu của gói không khai) — bổ sung cho ctx giả.
    firstCtx.get = () => undefined;
    firstCtx.configForms = {
      get: () => {
        throw new Error("đọc namespace settings hỏng giữa đường");
      },
    };
    await expect(module_.apply(firstCtx)).rejects.toThrow();
    // Lần hai (ctx KHÁC) phải đăng ký LẠI ĐỦ.
    const second = fakeContext();
    (second.ctx as Record<string, unknown>).get = () => undefined;
    let secondEffects = 0;
    const secondEffect = (second.ctx as unknown as { effect: (cb: () => unknown, label: string) => void }).effect;
    (second.ctx as unknown as { effect: unknown }).effect = (cb: () => unknown, label: string): void => {
      secondEffects += 1;
      secondEffect(cb, label);
    };
    await module_.apply(second.ctx);
    expect(secondEffects).toBeGreaterThan(0);
    expect(second.log.provided.map((entry) => entry.name)).toEqual(["locale"]);
    // Lần ba: cờ đã bật ⇒ không gọi effect nào.
    const third = fakeContext();
    (third.ctx as Record<string, unknown>).get = () => undefined;
    let thirdEffects = 0;
    const thirdEffect = (third.ctx as unknown as { effect: (cb: () => unknown, label: string) => void }).effect;
    (third.ctx as unknown as { effect: unknown }).effect = (cb: () => unknown, label: string): void => {
      thirdEffects += 1;
      thirdEffect(cb, label);
    };
    await module_.apply(third.ctx);
    expect(thirdEffects).toBe(0);
    // Module MỚI ⇒ lại đăng ký được.
    const fresh = loadModule(code, fakeHooks(), fakeStore());
    const fourth = fakeContext();
    (fourth.ctx as Record<string, unknown>).get = () => undefined;
    await fresh.apply(fourth.ctx);
    expect(fourth.log.provided.map((entry) => entry.name)).toEqual(["locale"]);
    } finally {
      if (navigatorDescriptor === undefined) delete (globalThis as unknown as Record<string, unknown>).navigator;
      else Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
      if (windowDescriptor === undefined) delete (globalThis as unknown as Record<string, unknown>).window;
      else Object.defineProperty(globalThis, "window", windowDescriptor);
    }
  });
});

describe("row locale — namespace vi KHÔNG được rỗng (lỗi 11/11/2026)", () => {
  /** Tệp từ điển vi đã sinh trong gói locale. */
  const SINH_RA = readdirSync(join(REPO, "packages/client/locale/src")).filter((n) => n.startsWith("locales-vi") && n.endsWith(".ts"));

  /**
   * Rút danh sách khoá của một khối bảng chuỗi (mỗi khoá một dòng, thụt 2 dấu cách).
   * Nhận: `block` — phần thân giữa hai dấu ngoặc nhọn.
   * Trả: danh sách khoá (rỗng nghĩa là bảng RỖNG).
   */
  function khoaCua(block: string): string[] {
    return [...block.matchAll(/^ {2}"([^"]+)":/gm)].map((k) => k[1] ?? "").filter((k) => k !== "");
  }

  /**
   * Rút mọi export dạng bảng chuỗi trong một tệp sinh ra.
   * Nhận: `file` — tên tệp trong `packages/client/locale/src`.
   * Trả: cặp tên export ↔ danh sách khoá (rỗng nghĩa là bảng RỖNG).
   */
  function bangTrong(file: string): { name: string; keys: string[] }[] {
    const text = readFileSync(join(REPO, "packages/client/locale/src", file), "utf8");
    const out: { name: string; keys: string[] }[] = [];
    const re = /export const (vi\w+)\s*:\s*Readonly<Record<string, string>>\s*=\s*\{([\s\S]*?)\n\};/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const name = m[1];
      const body = m[2];
      if (name === undefined || body === undefined) continue;
      out.push({ name, keys: khoaCua(body) });
    }
    return out;
  }

  test("mọi export vi* có ít nhất một khoá", () => {
    const rong: string[] = [];
    for (const file of SINH_RA) for (const entry of bangTrong(file)) if (entry.keys.length === 0) rong.push(file + ":" + entry.name);
    expect(rong).toEqual([]);
  });

  test("session-delete phủ ĐỦ bộ khoá en của ui-session-delete (menu chuột phải phiên)", () => {
    const enText = readFileSync(join(REPO, "packages/client/ui-session-delete/src/locales.ts"), "utf8");
    const enBlock = /export const en[^{]*\{([\s\S]*?)\n\};/.exec(enText);
    expect(enBlock).not.toBeNull();
    const enKeys = khoaCua(enBlock?.[1] ?? "").sort();
    const vi = bangTrong("locales-vi.ts").find((entry) => entry.name === "viSessionDelete");
    expect([...(vi?.keys ?? [])].sort()).toEqual(enKeys);
    expect(enKeys).toContain("menu.deleteSession");
  });
});
/**
 * Thêm một gói ngôn ngữ qua hàm `addLanguage` của dịch vụ (viết tách để ca 5 đọc rõ).
 * Nhận: `service` — dịch vụ, `input` — gói ngôn ngữ.
 * Trả: hàm gỡ gói đó.
 */
function service_add(service: LocaleService, input: { id: string; label: string; fallback?: string }): () => void {
  return service.addLanguage(input);
}
