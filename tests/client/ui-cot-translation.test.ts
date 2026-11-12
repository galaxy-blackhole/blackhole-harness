/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test row cot-translation (HAI NỬA): bề mặt Remote + Config nửa host đối chứng CHÍNH bundle gốc, A/B
 *      limits/translate + đường lỗi + nhánh kích hoạt lại phiên; nửa client: BỘ BA · MỘT-ID · A/B thuần
 */

import { describe, expect, test } from "bun:test";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import CotTranslationController from "../../packages/client/ui-cot-translation/src/controller.ts";
import { remoteMethods } from "../../packages/client/ui-cot-translation/src/remote-surface.ts";
import { LANGUAGE_PREFERENCE_PATTERN, PROVIDER_PREFERENCES } from "../../packages/client/ui-cot-translation/src/preferences.ts";
import { formLabels, en, NS, zh } from "../../packages/client/ui-cot-translation/src/client/locales.ts";
import { providerLabel } from "../../packages/client/ui-cot-translation/src/client/provider-label.ts";
import { ReasoningTranslation, reasoningFragments } from "../../packages/client/ui-cot-translation/src/client/translation.ts";
import {
  TRANSLATION_CSS,
  TRANSLATION_CSS_TAG_ID,
  TranslationStyles,
} from "../../packages/client/ui-cot-translation/src/client/translation-css.ts";
/** Nua host cua seam translator trong KERNEL (CHI DOC) — cung file ma hai ban dang nap. */
const TRANSLATOR_ENTRY = "../../apps/host/node_modules/@deepseek-ai/dsh-experimental-translator/lib/index.js";

/** Loi dich cua kernel: lop ma ca hai ban dung de phan loai TRANSLATION_SESSION_INACTIVE. */
const { TranslationError } = (await import(TRANSLATOR_ENTRY)) as { TranslationError: new (code: string, message: string) => Error };

/** Request dich (kieu cau truc, khong keo kieu cua goi kernel vao chuong trinh tsc). */
interface TranslationRequest {
  /** Van ban goc. */
  text: string;
  /** Ngon ngu dich. */
  targetLanguage: string;
  /** Ngon ngu nguon (tuy chon). */
  sourceLanguage?: string;
  /** Provider (tuy chon). */
  provider?: "bing" | "google" | "deepseek-account" | "deepseek-official";
  /** Phien duy tri ket qua (tuy chon). */
  sessionId?: string;
}

/** Spec da chuan hoa (kieu cau truc). */
interface TranslationSpec {
  /** Van ban goc. */
  text: string;
  /** Ngon ngu dich da chuan hoa. */
  targetLanguage: string;
  /** Ngon ngu nguon. */
  sourceLanguage: string;
  /** Provider da chon. */
  provider: string;
  /** Phien duy tri (neu co). */
  sessionId?: string;
}

/** Thu muc goc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Goi cua ta. */
const OURS = join(REPO, "packages", "client", "ui-cot-translation");
/** Ban goc trong kernel (CHI DOC) — oracle cua moi phep so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-client-ui-cot-translation");
/** Nua host da build cua ban goc. */
const STOCK = join(STOCK_DIR, "lib", "index.js");

/** Một lời gọi đã ghi lại của seam giả. */
interface Call {
  /** Tên phương thức. */
  method: string;
  /** Tham số. */
  args: unknown[];
}

/** Seam giả ghi lại lời gọi; hành vi điều khiển được từng ca. */
interface Harness {
  /** Context giả truyền cho cả hai bản. */
  ctx: never;
  /** Lời gọi đã ghi. */
  calls: Call[];
  /** Hàng đợi kết quả/lỗi cho translate (rỗng ⇒ trả "dịch"). */
  translatorQueue: unknown[];
  /** Kết quả resolveAgent. */
  activation: { error?: Error };
  /** Effect đã đăng ký qua ctx.inject (settings). */
  effects: (() => void)[];
}

/**
 * Dựng giàn giả: translator + sessionController + settings + logger, đủ cho constructor và hai phương thức.
 * Nhận: config đã chuẩn hoá của row (mặc định provider bing · targetLanguage auto).
 * Trả: bộ giàn dùng chung cho CẢ HAI bản (ta và gốc) để phép so là so trực tiếp.
 */
function harness(): Harness {
  const calls: Call[] = [];
  const effects: (() => void)[] = [];
  const state: Harness = { ctx: undefined as never, calls, translatorQueue: [], activation: {}, effects };
  const translator = {
    maxTextChars: 4096,
    async availableProviders(signal?: AbortSignal) {
      calls.push({ method: "availableProviders", args: [signal] });
      return ["bing", "google"] as const;
    },
    resolve(request: TranslationRequest) {
      calls.push({ method: "resolve", args: [request] });
      const spec = {
        text: request.text,
        targetLanguage: request.targetLanguage === "auto" ? "vi-VN" : request.targetLanguage,
        sourceLanguage: request.sourceLanguage ?? "auto",
        provider: request.provider ?? "bing",
        ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
      } as unknown as TranslationSpec;
      return spec;
    },
    async translate(spec: TranslationSpec, signal?: AbortSignal) {
      calls.push({ method: "translate", args: [spec, signal] });
      if (state.translatorQueue.length > 0) {
        const next = state.translatorQueue.shift();
        if (next instanceof Error) throw next;
        return next as string;
      }
      return "dịch:" + spec.text;
    },
  };
  const sessionController = {
    async resolveAgent(sessionId: string) {
      calls.push({ method: "resolveAgent", args: [sessionId] });
      return state.activation;
    },
  };
  const settings = {
    configure(value: { auto: boolean }, fiber?: unknown) {
      calls.push({ method: "configure", args: [value, fiber] });
      return () => undefined;
    },
  };
  const logger = {
    warn(message: string) {
      calls.push({ method: "warn", args: [message] });
    },
  };
  const ctx = {
    reflect: { provide: () => () => undefined },
    get: (name: string) => (name === "settings" ? settings : undefined),
    on: () => () => undefined,
    fiber: { name: "test-fiber" },
    translator,
    sessionController,
    logger,
    inject: (names: string[], apply: (child: unknown) => void) => {
      calls.push({ method: "inject", args: [names] });
      if (names.includes("settings")) {
        apply({
          settings,
          effect: (run: () => () => void) => {
            effects.push(run);
          },
        });
      }
    },
  };
  state.ctx = ctx as never;
  return state;
}

/** Hình dạng constructor của hai bản. */
type ControllerCtor = new (ctx: never, config: { provider: { get: () => string }; targetLanguage: { get: () => string } }) => {
  name: string;
  limits: (signal: AbortSignal) => Promise<SnapshotLike>;
  translate: (request: TranslationRequest, signal: AbortSignal) => Promise<string>;
};

/** Snapshot mà `limits` trả về (kiểu cấu trúc, đủ để so sánh). */
interface SnapshotLike {
  /** Độ dài UTF-16 tối đa mỗi request. */
  maxTextChars: number;
  /** Tuỳ chọn đã chấp nhận. */
  preferences: { provider: string; targetLanguage: string };
  /** Provider đủ điều kiện. */
  availableProviders: readonly string[];
}

/**
 * Tạo config tĩnh (không cần schemastery) để hai bản nhận cùng giá trị.
 * Nhận: provider — provider đã chấp nhận; targetLanguage — ngôn ngữ đích đã chấp nhận.
 * Trả: object config có hai getter.
 */
function configOf(provider: string, targetLanguage: string): { provider: { get: () => string }; targetLanguage: { get: () => string } } {
  return { provider: { get: () => provider }, targetLanguage: { get: () => targetLanguage } };
}

/** Nạp bản gốc đã build. */
async function stockController(): Promise<ControllerCtor> {
  const mod = (await import(STOCK)) as { default: ControllerCtor };
  return mod.default;
}

/** Một signal chưa huỷ. */
function liveSignal(): AbortSignal {
  return new AbortController().signal;
}

/** Một signal đã huỷ. */
function abortedSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort(new DOMException("aborted", "AbortError"));
  return controller.signal;
}

describe("cot-translation — bề mặt export + Config", () => {
  test("artifact CHI export default, giống bản gốc", () => {
    const names = (text: string): string[] => {
      const out = new Set<string>();
      for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
        for (const part of (match[1] ?? "").split(",")) {
          const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
          if (name !== undefined && name !== "") out.add(name);
        }
      }
      return [...out].sort();
    };
    expect(names(readFileSync(join(OURS, "lib", "index.js"), "utf8"))).toEqual(names(readFileSync(STOCK, "utf8")));
    expect(names(readFileSync(join(OURS, "lib", "index.js"), "utf8"))).toEqual(["default"]);
  });

  test("static inject + schema Config TRÙNG TỪNG KÝ TỰ với bản gốc", async () => {
    const Stock = await stockController();
    const ours = CotTranslationController as unknown as { inject: string[]; Config: unknown };
    const stock = Stock as unknown as { inject: string[]; Config: unknown };
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["translator", "typert", "sessionController"]);
    expect(String(ours.Config)).toBe(String(stock.Config));
  });

  test("schema Config: mặc định bing/auto; provider lạ và ngôn ngữ sai mẫu đều bị từ chối (hai bản như nhau)", async () => {
    const Stock = await stockController();
    /** Schema da chuan hoa: gia tri la o nho 'volatile' co get() (dung nhu ban goc). */
    type ResolvedConfig = { provider: { get: () => string }; targetLanguage: { get: () => string } };
    const oursConfig = (CotTranslationController as unknown as { Config: (value: unknown) => ResolvedConfig }).Config;
    const stockConfig = (Stock as unknown as { Config: (value: unknown) => ResolvedConfig }).Config;
    for (const resolve of [oursConfig, stockConfig]) {
      const resolved = resolve({});
      expect(resolved.provider.get()).toBe("bing");
      expect(resolved.targetLanguage.get()).toBe("auto");
      expect(Object.keys(resolved).sort()).toEqual(["provider", "targetLanguage"]);
    }
    for (const call of [oursConfig, stockConfig]) {
      expect(() => call({ provider: "baidu" })).toThrow();
      expect(() => call({ targetLanguage: "khong hop le!" })).toThrow();
    }
    // Hằng số tuỳ chọn giữ NGUYÊN VĂN bản gốc.
    expect([...PROVIDER_PREFERENCES]).toEqual(["bing", "google", "deepseek-account", "deepseek-official"]);
    expect(LANGUAGE_PREFERENCE_PATTERN.test("vi")).toBe(true);
    expect(LANGUAGE_PREFERENCE_PATTERN.test("vi-VN")).toBe(true);
    expect(LANGUAGE_PREFERENCE_PATTERN.test("auto")).toBe(true);
    expect(LANGUAGE_PREFERENCE_PATTERN.test("")).toBe(false);
  });

  test("constructor: tên service + namespace + inject(['settings']) + configure auto=false (hai bản như nhau)", async () => {
    const Stock = await stockController();
    for (const [label, Ctor] of [["ta", CotTranslationController], ["gốc", Stock]] as const) {
      const bench = harness();
      const controller = new Ctor(bench.ctx, configOf("bing", "auto") as never);
      expect(controller.name).toBe("cotTranslation");
      expect((Reflect.get(controller, "typertRemote") as { namespace: string }).namespace).toBe("cotTranslation");
      expect(bench.calls.filter((call) => call.method === "inject").length).toBe(1);
      for (const run of bench.effects) run();
      const configured = bench.calls.filter((call) => call.method === "configure");
      expect(configured.length).toBe(label === "ta" ? 1 : 1);
      expect(configured[0]?.args[0]).toEqual({ auto: false });
    }
  });

  test("bề mặt Remote trùng nhau: đúng hai phương thức limits + translate", async () => {
    const Stock = await stockController();
    const ours = remoteMethods(new CotTranslationController(harness().ctx, configOf("bing", "auto") as never)).map((marker) => marker.method);
    const stock = remoteMethods(new Stock(harness().ctx, configOf("bing", "auto") as never)).map((marker) => marker.method);
    expect(ours).toEqual(stock);
    expect(ours.sort()).toEqual(["limits", "translate"]);
  });
});

describe("cot-translation — A/B hành vi (cùng giàn giả, cùng input → cùng output)", () => {
  test("limits: cùng snapshot; nhận signal; đọc đúng config", async () => {
    const Stock = await stockController();
    const signal = liveSignal();
    const oursBench = harness();
    const stockBench = harness();
    const ours = await new CotTranslationController(oursBench.ctx, configOf("bing", "auto") as never).limits(signal);
    const stock = await new Stock(stockBench.ctx, configOf("bing", "auto") as never).limits(signal);
    expect(ours as unknown).toEqual(stock as unknown);
    expect(ours as unknown).toEqual({ maxTextChars: 4096, preferences: { provider: "bing", targetLanguage: "auto" }, availableProviders: ["bing", "google"] });
    expect(oursBench.calls.map((call) => call.method)).toEqual(["inject", "availableProviders"]);
    expect(stockBench.calls.map((call) => call.method)).toEqual(["inject", "availableProviders"]);
  });

  test("translate: resolve → translate, trả nguyên văn kết quả; cùng spec đưa xuống translator", async () => {
    const Stock = await stockController();
    const request: TranslationRequest = { text: "suy luận", targetLanguage: "auto", sessionId: "s-1" as never };
    const oursBench = harness();
    const stockBench = harness();
    const ours = await new CotTranslationController(oursBench.ctx, configOf("bing", "auto") as never).translate(request as never, liveSignal());
    const stock = await new Stock(stockBench.ctx, configOf("bing", "auto") as never).translate(request, liveSignal());
    expect(ours).toBe(stock);
    expect(ours).toBe("dịch:suy luận");
    const oursSpec = oursBench.calls.find((call) => call.method === "translate")?.args[0] as TranslationSpec;
    const stockSpec = stockBench.calls.find((call) => call.method === "translate")?.args[0] as TranslationSpec;
    expect(oursSpec).toEqual(stockSpec);
    expect(oursSpec).toEqual({ text: "suy luận", targetLanguage: "vi-VN", sourceLanguage: "auto", provider: "bing", sessionId: "s-1" });
  });

  test("provider/ngôn ngữ KHÔNG khớp tuỳ chọn ⇒ cùng RemoteError cotTranslation/failed (hai bản như nhau)", async () => {
    const Stock = await stockController();
    const cases: { label: string; request: TranslationRequest; provider?: string; targetLanguage?: string }[] = [
      { label: "provider lạ", request: { text: "x", targetLanguage: "auto", provider: "google" } },
      { label: "ngôn ngữ sai", request: { text: "x", targetLanguage: "en" }, targetLanguage: "vi" },
    ];
    for (const item of cases) {
      const oursBench = harness();
      const stockBench = harness();
      const oursError = await new CotTranslationController(oursBench.ctx, configOf(item.provider ?? "bing", item.targetLanguage ?? "auto") as never)
        .translate(item.request as never, liveSignal())
        .then(() => undefined, (error: unknown) => error as { code?: string; message?: string });
      const stockError = await new Stock(stockBench.ctx, configOf(item.provider ?? "bing", item.targetLanguage ?? "auto") as never)
        .translate(item.request as never, liveSignal())
        .then(() => undefined, (error: unknown) => error as { code?: string; message?: string });
      expect(oursError?.code).toBe("cotTranslation/failed");
      expect(stockError?.code).toBe(oursError?.code);
      expect(oursError?.message).toBe("Translation failed");
      expect(stockError?.message).toBe(oursError?.message);
      // Đã chuẩn hoá spec trước khi lỗi ⇒ KHÔNG lời gọi translate nào xuống translator.
      expect(oursBench.calls.some((call) => call.method === "translate")).toBe(false);
    }
  });

  test("nhánh TRANSLATION_SESSION_INACTIVE: kích hoạt phiên rồi thử lại, hai bản cùng chuỗi lời gọi", async () => {
    // 19/10/2026: đoạn kích hoạt phiên là 1:1 THẬT — bundle stock gọi resolveAgent trong lib/index.js
    // (nửa host), KHÔNG ở lib/client.js. Test so trực tiếp với bản stock nên giữ nguyên ca này.
    const Stock = await stockController();
    const run = async (Ctor: ControllerCtor) => {
      const bench = harness();
      bench.translatorQueue.push(new TranslationError("TRANSLATION_SESSION_INACTIVE", "inactive"));
      const request: TranslationRequest = { text: "x", targetLanguage: "auto", sessionId: "s-2" as never };
      const result = await new Ctor(bench.ctx, configOf("bing", "auto") as never).translate(request as never, liveSignal());
      return { result, methods: bench.calls.map((call) => call.method).filter((method) => method !== "inject" && method !== "resolve") };
    };
    const ours = await run(CotTranslationController as unknown as ControllerCtor);
    const stock = await run(Stock);
    expect(ours.result).toBe(stock.result);
    expect(ours.result).toBe("dịch:x");
    expect(ours.methods).toEqual(["translate", "resolveAgent", "translate"]);
    expect(stock.methods).toEqual(ours.methods);
  });

  test("kích hoạt phiên LỖI ⇒ cùng RemoteError cotTranslation/failed", async () => {
    const Stock = await stockController();
    const run = async (Ctor: ControllerCtor) => {
      const bench = harness();
      bench.translatorQueue.push(new TranslationError("TRANSLATION_SESSION_INACTIVE", "inactive"));
      bench.activation = { error: new Error("activate-failed") };
      return new Ctor(bench.ctx, configOf("bing", "auto") as never)
        .translate({ text: "x", targetLanguage: "auto", sessionId: "s-3" as never } as never, liveSignal())
        .then(() => undefined, (error: unknown) => (error as { code?: string }).code);
    };
    expect(await run(CotTranslationController as unknown as ControllerCtor)).toBe("cotTranslation/failed");
    expect(await run(Stock)).toBe("cotTranslation/failed");
    // ĐỐI CHỨNG ÂM: CÙNG mã nhưng KHÁC tên lớp ⇒ wrap cotTranslation/failed, KHÔNG kích hoạt phiên.
    for (const Ctor of [CotTranslationController as unknown as ControllerCtor, Stock]) {
      const bench = harness();
      bench.translatorQueue.push(Object.assign(new Error("inactive"), { code: "TRANSLATION_SESSION_INACTIVE" }) as never);
      const outcome = await new Ctor(bench.ctx, configOf("bing", "auto") as never)
        .translate({ text: "x", targetLanguage: "auto", sessionId: "s-4" as never } as never, liveSignal())
        .then(() => "ok", (error: unknown) => (error as { code?: string }).code);
      expect([outcome, bench.calls.some((call) => call.method === "resolveAgent")]).toEqual(["cotTranslation/failed", false]);
    }
  });

  test("signal đã huỷ ⇒ ném AbortError TRƯỚC mọi lời gọi seam (hai bản như nhau)", async () => {
    const Stock = await stockController();
    for (const [label, Ctor] of [["ta", CotTranslationController], ["gốc", Stock]] as const) {
      const bench = harness();
      const error = await new Ctor(bench.ctx, configOf("bing", "auto") as never)
        .translate({ text: "x", targetLanguage: "auto" } as never, abortedSignal())
        .then(() => undefined, (failure: unknown) => failure as { name?: string });
      expect(label + ":" + String(error?.name)).toBe(label + ":AbortError");
      expect(bench.calls.some((call) => call.method === "translate")).toBe(false);
      expect(bench.calls.some((call) => call.method === "resolve")).toBe(false);
    }
  });
});

// NỬA CLIENT — BỘ BA · MỘT-ID · A/B với CHÍNH bundle gốc

/** Id của gói gốc — luật MỘT-ID đòi artefact của ta có 0 lần chuỗi này. */
const STOCK_ID = "@deepseek-ai/dsh-experimental-client-ui-cot-translation";
/** Id bundle của ta (id DUY NHẤT được đăng ký). */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-cot-translation";
/** Artefact nửa client của ta. */
const OURS_CLIENT = join(OURS, "lib", "client.js");
/** Artefact nửa client của bản gốc (oracle). */
const STOCK_CLIENT = join(STOCK_DIR, "lib", "client.js");

/** package.json của ta (phần BỘ BA + khai park). */
const OURS_PACKAGE = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
  exports: Record<string, string>;
  dsh: { client: { inject: string[]; platform: string } };
  gbh: { row_unmounted_ly_do: { ly_do: string; row: Record<string, unknown> } };
};
/** package.json của bản gốc (oracle cho dsh.client). */
const STOCK_PACKAGE = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as {
  dsh: { client: { inject: string[]; platform: string } };
};

/** Một lần đăng ký bundle do script classic gọi. */
interface ClientRegistration {
  /** Id bundle đăng ký. */
  id: string;
  /** Hàm dựng export, nhận require của bảng module. */
  factory: (requireFn: (specifier: string) => unknown) => unknown;
}

/** Bảng module giả: đủ để factory chạy tới lúc trả export (không render, không gọi zod). */
const RUNTIME_STUBS: Record<string, unknown> = {
  zod: { z: {} },
  react: {
    useState: (value: unknown) => [value, () => undefined],
    useRef: () => ({ current: undefined }),
    useEffect: () => undefined,
    useMemo: (factory: () => unknown) => factory(),
    useId: () => "id",
  },
  "react/jsx-runtime": { jsx: () => null, jsxs: () => null, Fragment: null },
  "@deepseek-ai/dsh-client-store": {
    createSnapshotStore: (value: unknown) => ({ getSnapshot: () => value, set: () => undefined }),
  },
  "@deepseek-ai/dsh-client-ui-primitives": {
    SettingsFormModel: class {
      /** Nhận scope + khai ô; giữ lại để ca mount dựng được form. */
      constructor(scope: unknown, fields: unknown[]) {
        void scope;
        void fields;
      }
      /** Ảnh chụp chung giả. */
      shell(): Record<string, unknown> {
        return { writable: true, saving: false, dirty: false };
      }
      /** Ảnh chụp một ô giả. */
      field(name: string): Record<string, unknown> {
        return { text: name, invalid: false, overridden: false };
      }
      /** Hành động giả. */
      actions(): Record<string, unknown> {
        return { save: () => undefined, discard: () => undefined };
      }
      /** Bind store giả. */
      bind(project: () => unknown): unknown {
        return { getSnapshot: project };
      }
      /** Nhả giả. */
      dispose(): void {}
    },
    settingsTextField: (name: string) => ({ name }),
  },
};

/** Occupation đã đăng ký trong ca mount (chỉ đặc trưng cấu trúc). */
interface RegisteredOccupant {
  /** Tên slot. */
  name: string;
  /** Namespace từ điển. */
  locale: string;
  /** Khoá occupant (nếu có). */
  key?: string;
  /** Kiểu của inject. */
  inject: string;
  /** Kiểu của component. */
  component: string;
}

/** Giàn mount giả: đủ cho apply/mountTranslation của CẢ HAI bản. */
interface MountBench {
  /** Context truyền cho apply. */
  ctx: unknown;
  /** Contribution đã mount qua $mount. */
  mounted: unknown[];
  /** Occupant đã đăng ký theo slot. */
  registered: RegisteredOccupant[];
}

/**
 * Dựng context giả có đủ seam remote/slots/locale/configForms cho registerUi.
 * Nhận: không.
 * Trả: giàn ghi lại contribution + occupant.
 */
function makeMountBench(): MountBench {
  const mounted: unknown[] = [];
  const registered: RegisteredOccupant[] = [];
  const ctx = {
    fiber: { uid: 1 },
    effect: () => () => undefined,
    on: () => () => undefined,
    inject: (_names: string[], callback: (child: unknown) => unknown) => {
      const run = Promise.resolve(callback(ctx)) as Promise<unknown> & { dispose?: () => Promise<void> };
      run.dispose = async () => undefined;
      return run;
    },
    logger: { warn: () => undefined },
    remote: {
      cotTranslation: {
        limits: async () => ({
          ok: true,
          value: { maxTextChars: 4096, preferences: { provider: "bing", targetLanguage: "auto" }, availableProviders: ["bing"] },
        }),
        translate: async () => ({ ok: true, value: "x" }),
      },
      $on: () => () => undefined,
      $mount: async (contribution: unknown) => {
        mounted.push(contribution);
        return async () => undefined;
      },
    },
    slots: {
      inject: (_name: string, callback: () => unknown) => callback(),
      register: (spec: Record<string, unknown>, component: unknown) => {
        registered.push({
          name: String(spec.name),
          locale: String(spec.locale),
          ...(spec.key === undefined ? {} : { key: String(spec.key) }),
          inject: typeof spec.inject,
          component: typeof component,
        });
        return () => undefined;
      },
    },
    locale: { active: "vi", register: () => () => undefined },
    configForms: { get: () => ({ getSnapshot: () => ({}), subscribe: () => () => undefined }) },
  };
  return { ctx, mounted, registered };
}

/**
 * Chuẩn hoá contribution để so cấu trúc: hàm → nhãn, id của TA → id gốc.
 * Nhận: value — giá trị bất kỳ trong contribution.
 * Trả: bản chuẩn hoá (khoá đã sắp xếp).
 */
function normalizeContribution(value: unknown): unknown {
  if (typeof value === "function") return "<fn>";
  if (Array.isArray(value)) return value.map(normalizeContribution);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = normalizeContribution(source[key]);
    return out;
  }
  if (typeof value === "string") {
    if (value === PACKAGE_NAME) return STOCK_ID;
    if (value.startsWith(PACKAGE_NAME + "/") || value.startsWith(PACKAGE_NAME + "#")) return STOCK_ID + value.slice(PACKAGE_NAME.length);
  }
  return value;
}

/**
 * Nạp một artefact rồi chạy apply trên giàn mount giả.
 * Nhận: file — đường dẫn artefact client.
 * Trả: contribution đã chuẩn hoá + occupant + kiểu disposer.
 */
async function mountArtifact(file: string): Promise<MountBench & { disposed: string }> {
  const bench = makeMountBench();
  const loaded = loadClientArtifact(file);
  const apply = loaded.exports.apply as unknown as (ctx: unknown) => Promise<() => Promise<void>>;
  const dispose = await apply(bench.ctx);
  return { ...bench, mounted: bench.mounted.map((entry) => normalizeContribution(entry)), disposed: typeof dispose };
}

/**
 * Đếm số lần một chuỗi con xuất hiện.
 * Nhận: source — văn bản cần đếm; needle — chuỗi con.
 * Trả: số lần xuất hiện.
 */
function countOf(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

/**
 * Nạp một artefact script classic bằng bảng module giả, không cần trình duyệt.
 * Nhận: file — đường dẫn artefact.
 * Trả: id đã đăng ký + export mà factory trả.
 */
function loadClientArtifact(file: string): { id: string; exports: Record<string, unknown> } {
  const registrations: ClientRegistration[] = [];
  const run = new Function("window", readFileSync(file, "utf8")) as unknown as (window: unknown) => void;
  run({ __ModuleLoader__: { load: (registration: ClientRegistration) => registrations.push(registration) } });
  expect(registrations.length).toBe(1);
  const registration = registrations[0];
  if (registration === undefined) throw new Error("khong co dang ky bundle trong " + file);
  // 19/10/2026 (task-151): artefact đã rewrite specifier sang id GBH ⇒ resolver phải hiểu CẢ HAI:
  // thử id GBH trước, rồi suy ngược về id stock cho bảng stub.
  const resolveStub = (specifier: string): unknown => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    const trucTiep = RUNTIME_STUBS[specifier];
    if (trucTiep !== undefined) return trucTiep;
    const nguoc = specifier.replace("@galaxy-blackhole/gbh-", "@deepseek-ai/dsh-");
    return RUNTIME_STUBS[nguoc];
  };
  const exports = registration.factory(resolveStub);
  return { id: registration.id, exports: exports as Record<string, unknown> };
}

/**
 * Cắt một vùng NGUYÊN VĂN của bundle gốc theo dấu `//#region`.
 * Nhận: name — tên vùng (vd "lib/types/client/translation.js").
 * Trả: thân vùng (không kèm dấu).
 */
function stockRegion(name: string): string {
  const source = readFileSync(STOCK_CLIENT, "utf8");
  const marker = "//#region " + name;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("khong thay vung " + name + " trong bundle goc");
  const end = source.indexOf("//#endregion", start);
  if (end < 0) throw new Error("vung " + name + " khong co #endregion");
  return source.slice(start + marker.length, end);
}

/**
 * Chạy một vùng NGUYÊN VĂN của bundle gốc và lấy các tên nội bộ của nó.
 * Nhận: region — thân vùng; names — tên cần lấy.
 * Trả: object các tên đó (oracle A/B của phép đo này).
 */
function evalRegion(region: string, names: readonly string[]): Record<string, unknown> {
  const run = new Function(region + "\nreturn {" + names.join(",") + "};") as unknown as () => Record<string, unknown>;
  return run();
}

/** Toàn văn bundle gốc (đọc một lần). */
const STOCK_CLIENT_SOURCE = readFileSync(STOCK_CLIENT, "utf8");

/**
 * Lấy chuỗi CSS của bản gốc từ artefact (vùng CSS có tên chứa ký tự NUL nên cắt bằng regex).
 * Nhận: không.
 * Trả: chuỗi CSS nguyên văn.
 */
function stockCss(): string {
  const match = /const css = ("(?:[^"\\]|\\.)*");/.exec(STOCK_CLIENT_SOURCE);
  if (match?.[1] === undefined) throw new Error("khong thay chuoi css trong bundle goc");
  return JSON.parse(match[1]) as string;
}

/**
 * Lấy bảng lớp CSS của bản gốc từ artefact.
 * Nhận: không.
 * Trả: object khoá lớp → tên đã hash.
 */
function stockStyleMap(): Record<string, string> {
  const match = /var Translation_module_css_default = (\{[\s\S]*?\});/.exec(STOCK_CLIENT_SOURCE);
  if (match?.[1] === undefined) throw new Error("khong thay bang lop CSS trong bundle goc");
  return new Function("return " + match[1])() as Record<string, string>;
}

/** Hình dạng tối thiểu của một bộ điều khiển dịch suy luận (dùng chung cho hai bản). */
type ReasoningLike = {
  /** Nhận văn bản + cờ đang chảy. */
  update(text: string, running: boolean): void;
  /** Thử lại sau lỗi. */
  retry(): void;
  /** Huỷ và chặn công bố. */
  dispose(): void;
};

/** Constructor của bộ điều khiển (hai bản cùng hình dạng). */
type ReasoningCtor = new (
  selection: { provider: string; targetLanguage: string },
  maxTextChars: number,
  translate: (request: { text: string }, signal: AbortSignal) => Promise<string>,
  publish: (state: { text: string; pending: boolean; failed: boolean }) => void,
) => ReasoningLike;

/** Một kịch bản chạy bộ điều khiển. */
interface ReasoningScenario {
  /** Văn bản nguồn. */
  text: string;
  /** Đuôi còn chảy. */
  running: boolean;
  /** Request đầu lỗi (để đo nhánh failed/retry). */
  failFirst: boolean;
  /** Có gọi retry sau khi lỗi. */
  retry: boolean;
  /** Huỷ ngay sau update. */
  disposeEarly: boolean;
}

/**
 * Chạy một kịch bản trên MỘT bản, ghi lại publish + lời gọi translate.
 * Nhận: Ctor — constructor bộ điều khiển; script — kịch bản.
 * Trả: { publishes, calls } để so A/B.
 */
async function runReasoningScenario(Ctor: ReasoningCtor, script: ReasoningScenario): Promise<{ publishes: unknown[]; calls: string[] }> {
  const publishes: unknown[] = [];
  const calls: string[] = [];
  let failed = false;
  const translate = async (request: { text: string }) => {
    calls.push(request.text);
    if (script.failFirst && !failed) {
      failed = true;
      throw new Error("boom");
    }
    return "dịch:" + request.text;
  };
  const controller = new Ctor({ provider: "bing", targetLanguage: "vi" }, 4096, translate, (state) => publishes.push(state));
  controller.update(script.text, script.running);
  if (script.disposeEarly) controller.dispose();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  if (script.retry) {
    controller.retry();
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }
  return { publishes, calls };
}

describe("cot-translation — nửa client: BỘ BA + MỘT-ID", () => {
  test("artifact client: ĐÚNG MỘT __ModuleLoader__.load với id của ta, 0 chuỗi id gói gốc (kể cả CSS tagId/dataset.plugin)", () => {
    const artifact = readFileSync(OURS_CLIENT, "utf8");
    const stockArtifact = readFileSync(STOCK_CLIENT, "utf8");
    expect(countOf(artifact, "window.__ModuleLoader__.load(")).toBe(1);
    expect(artifact).toContain('id: "' + PACKAGE_NAME + '"');
    expect(artifact.includes(STOCK_ID)).toBe(false);
    // Phép kiểm có răng: bundle gốc CÓ chuỗi đó (nếu không, ca này vô nghĩa).
    expect(stockArtifact.includes(STOCK_ID)).toBe(true);
    // CSS: tagId + dataset.plugin dùng id CỦA TA, tên tệp gốc giữ nguyên.
    expect(artifact).toContain('var PACKAGE_NAME = "' + PACKAGE_NAME + '"');
    expect(artifact).toContain('var CSS_FILE_NAME = "Translation.module.css"');
    expect(artifact).toContain("tag.dataset.plugin = PACKAGE_NAME");
    expect(artifact).toContain("tag.dataset.pluginCss = TRANSLATION_CSS_TAG_ID");
    // Tên package gốc không lọt vào thân factory dưới bất kỳ dạng nào.
    expect(artifact.includes("dsh-experimental-client-ui-cot-translation")).toBe(false);
  });

  test("bề mặt export TRÙNG bản gốc: đúng apply + inject (nạp CẢ HAI artefact bằng cùng bảng module giả)", () => {
    const ours = loadClientArtifact(OURS_CLIENT);
    const stock = loadClientArtifact(STOCK_CLIENT);
    expect(ours.id).toBe(PACKAGE_NAME);
    expect(stock.id).toBe(STOCK_ID);
    expect(Object.keys(ours.exports).sort()).toEqual(Object.keys(stock.exports).sort());
    expect(Object.keys(ours.exports).sort()).toEqual(["apply", "inject"]);
    expect(typeof ours.exports.apply).toBe("function");
    expect(typeof stock.exports.apply).toBe("function");
    expect(ours.exports.inject).toEqual(stock.exports.inject);
    expect(ours.exports.inject).toEqual(["remote", "slots", "locale", "configForms"]);
  });

  test("dsh.client deep-equal bản gốc: 5 seam inject + platform web", () => {
    expect(sameAfterIdMap(OURS_PACKAGE.dsh.client, STOCK_PACKAGE.dsh.client)).toBe(true);
    // 20/10/2026 — hướng "đổi thương hiệu + rewrite id": inject của ta mang id GBH CÓ CHỦ ĐÍCH.
    expect(sameAfterIdMap(OURS_PACKAGE.dsh.client.inject, [
      "@deepseek-ai/dsh-api-remotes",
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-ui-chat",
      "@deepseek-ai/dsh-client-ui-plugin-manager",
      "@deepseek-ai/dsh-client-ui-settings",
    ])).toBe(true);
    expect(OURS_PACKAGE.dsh.client.platform).toBe("web");
  });

  test("exports khai './client' + './locale/*.json' và artefact/locale có thật, trùng bản gốc", () => {
    expect(OURS_PACKAGE.exports["./client"]).toBe("./lib/client.js");
    expect(OURS_PACKAGE.exports["./locale/*.json"]).toBe("./locale/*.json");
    expect(existsSync(join(OURS, "lib", "client.js"))).toBe(true);
    for (const language of ["en", "zh"]) {
      expect(JSON.parse(readFileSync(join(OURS, "locale", language + ".json"), "utf8"))).toEqual(
        JSON.parse(readFileSync(join(STOCK_DIR, "locale", language + ".json"), "utf8")),
      );
    }
  });

  test("build.ts: ≥2 lời gọi Bun.build TÁCH RỜI (host ESM · client CJS) + outDir qua process.argv[2]", () => {
    const build = readFileSync(join(OURS, "build.ts"), "utf8");
    expect(countOf(build, "Bun.build(")).toBeGreaterThanOrEqual(2);
    expect(build).toContain('join(import.meta.dir, "src", "index.ts")');
    expect(build).toContain('join(import.meta.dir, "src", "client.ts")');
    expect(build).toContain('format: "esm"');
    expect(build).toContain('format: "cjs"');
    expect(build).toContain('naming: "index.js"');
    expect(build).toContain("window.__ModuleLoader__.load({ id: ");
    expect(build).toContain("process.argv[2]");
  });

  test("rebuild qua argv[2]: hai artefact, client đúng 1 load id ta, host ESM dùng được", () => {
    const out = mkdtempSync(join(tmpdir(), "gbh-cot-client-"));
    const run = Bun.spawnSync({ cmd: [process.execPath, join(OURS, "build.ts"), out], cwd: OURS, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(0);
    expect(existsSync(join(out, "index.js"))).toBe(true);
    expect(existsSync(join(out, "client.js"))).toBe(true);
    const rebuilt = readFileSync(join(out, "client.js"), "utf8");
    expect(countOf(rebuilt, "window.__ModuleLoader__.load(")).toBe(1);
    expect(rebuilt).toContain('id: "' + PACKAGE_NAME + '"');
    expect(rebuilt.includes(STOCK_ID)).toBe(false);
    const host = readFileSync(join(out, "index.js"), "utf8");
    expect(host).toContain("export");
    expect(host).not.toContain("__ModuleLoader__");
  });

  test("thông điệp lỗi Remote trùng bản gốc: cotTranslation/failed · Translation failed", () => {
    const oursHost = readFileSync(join(OURS, "lib", "index.js"), "utf8");
    const stockHost = readFileSync(STOCK, "utf8");
    for (const marker of ["cotTranslation/failed", "Translation failed"]) {
      expect(oursHost).toContain(marker);
      expect(stockHost).toContain(marker);
    }
    expect(countOf(oursHost, "cotTranslation/failed")).toBe(countOf(stockHost, "cotTranslation/failed"));
  });

  test("row: đúng hình dạng (FLIP 19/10/2026 hoặc còn PARK), config parity với dump cot-translation, KHÔNG bịa inject/disabled", () => {
    // 19/10/2026: Lead đã boot-smoke ĐẠT và FLIP ⇒ `gbh.row` là trạng thái hiện tại; nếu còn park thì
    // `gbh.row_unmounted_ly_do.row` cũng hợp lệ. Test đọc TRẠNG THÁI TỪ MANIFEST (manifest = nguồn sự thật).
    const meta = OURS_PACKAGE.gbh as {
      row?: { id?: string; config?: unknown; moduleIds?: string[]; aliases?: string[]; tests?: string[] };
      row_unmounted_ly_do?: { ly_do?: string; row?: { id?: string; config?: unknown; moduleIds?: string[]; aliases?: string[]; tests?: string[] } };
    };
    const park = meta.row_unmounted_ly_do;
    const row = (meta.row ?? park?.row) as { id: string; config: unknown; moduleIds: string[]; aliases: string[]; tests: string[] };
    expect(row).toBeDefined();
    expect(row.id).toBe("cot-translation");
    expect(row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(row.aliases).toEqual([STOCK_ID]);
    expect(row.tests).toEqual(["tests/client/ui-cot-translation.test.ts"]);
    expect(row.config).toEqual({ provider: "bing", targetLanguage: "auto" });
    expect("inject" in row).toBe(false);
    expect("disabled" in row).toBe(false);
    // Parity với dump row cot-translation của giàn A/B (oracle mới nhất có mặt trong repo).
    const dumps = join(REPO, ".parity", "dumps");
    const latest = readdirSync(dumps).sort().at(-1);
    expect(latest).toBeDefined();
    if (latest === undefined) throw new Error("khong co dump nao");
    const dump = JSON.parse(readFileSync(join(dumps, latest, "oracleA.normalised.json"), "utf8")) as {
      rows: { id: string; json: string }[];
    };
    const dumped = dump.rows.find((entry) => entry.id === "cot-translation");
    expect(dumped).toBeDefined();
    if (dumped === undefined) throw new Error("dump khong co row cot-translation");
    const parsed = JSON.parse(dumped.json) as { config: unknown; name: string };
    expect(parsed.name).toBe(STOCK_ID);
    expect(row.config).toEqual(parsed.config);
  });

  test("mount: slot + key bundle + chuỗi cảnh báo/label TRÙNG bản gốc (đối chứng văn bản artefact)", () => {
    const artifact = readFileSync(OURS_CLIENT, "utf8");
    const markers = [
      "conversation.chat.reasoning.body",
      "plugins.bundle.config",
      "cot-translation: could not refresh Host preferences and request limits",
      "cot-translation: metadata queries",
      "cot-translation: query cancellation",
      "Translation preferences or limits changed",
      "settings/document-updated",
      "llm/adapters-updated",
      "deepseek-account/session-expired",
      "deepseek-account/model-sign-in-required",
      "credentials/record-updated",
      "credentials/reference-updated",
      "connection/reset",
    ];
    // 22/10/2026: tools/brand-ids-client.ts doi id du lieu stock -> id ta, nen marker bundle la id CUA TA.
    for (const marker of markers) {
      expect(artifact).toContain(marker);
      expect(STOCK_CLIENT_SOURCE).toContain(marker);
    }
    // 22/10/2026: id bundle DA DOI ten o moi ben (stock: dsh-experimental-cot-translation-bundle,
    //   ta: gbh-cot-translation-bundle) nen KHONG so cung mot chuoi duoc nua: khang dinh rieng tung ben.
    expect(artifact).toContain("@galaxy-blackhole/gbh-cot-translation-bundle");
    expect(STOCK_CLIENT_SOURCE).toContain("@deepseek-ai/dsh-experimental-cot-translation-bundle");
  });

  test("mount thật: contribution Remote + hai occupant slot TRÙNG bản gốc sau khi quy id về id gốc", async () => {
    const ours = await mountArtifact(OURS_CLIENT);
    const stock = await mountArtifact(STOCK_CLIENT);
    expect(ours.mounted.length).toBe(1);
    expect(stock.mounted.length).toBe(1);
    // Toàn bộ spec đã sinh (schema · mô tả · cancellation · JSON Schema · typeSymbol sau khi quy id) trùng khít.
    // 19/10/2026 (PILOT type-brand): typeSymbol của ta dùng id GBH ⇒ quy ngược brand TRƯỚC khi so với stock.
    const quyBrandNguoc = (value: unknown): unknown =>
      JSON.parse(JSON.stringify(value).split("@galaxy-blackhole/gbh-experimental-translator").join("@deepseek-ai/dsh-experimental-translator"));
    expect(quyBrandNguoc(ours.mounted)).toEqual(stock.mounted);
    // PILOT: typeSymbol MỚI xuất hiện trong artefact của ta, và KHÔNG còn type-brand stock nào.
    const artifact = readFileSync(OURS_CLIENT, "utf8");
    expect(artifact).toContain("@galaxy-blackhole/gbh-experimental-translator/types#TranslationRequest");
    expect(artifact).not.toContain("@deepseek-ai/dsh-experimental-translator/types#TranslationRequest");
    expect(artifact.match(/@deepseek-ai\/[A-Za-z0-9._/-]*#/g) ?? []).toEqual([]);
    // 22/10/2026: tools/brand-ids-client.ts doi id du lieu stock -> id ta, nen slot KEY cua ta la
    //   gbh-cot-translation-bundle con ban goc la dsh-experimental-cot-translation-bundle, do do quy id
    //   hai ben ve cung mot ten TRUOC khi so tung phan con lai.
    const quyId = (rows: unknown): unknown => JSON.parse(JSON.stringify(rows).split("@galaxy-blackhole/gbh-cot-translation-bundle").join("@deepseek-ai/dsh-experimental-cot-translation-bundle"));
    expect(quyId(ours.registered)).toEqual(stock.registered);
    expect(ours.registered.map((entry) => entry.name)).toEqual(["conversation.chat.reasoning.body", "plugins.bundle.config"]);
    // 22/10/2026: id du lieu da doi sang id ta (tools/brand-ids-client.ts) ⇒ slot key la id CUA TA.
    expect(ours.registered[1]?.key).toBe("@galaxy-blackhole/gbh-cot-translation-bundle");
    expect(ours.disposed).toBe("function");
    expect(stock.disposed).toBe("function");
  });
});

describe("cot-translation — nửa client A/B hành vi (oracle = vùng NGUYÊN VĂN của bundle gốc)", () => {
  /** Các tên nội bộ của vùng translation lấy từ CHÍNH bundle gốc. */
  const stockTranslation = evalRegion(stockRegion("lib/types/client/translation.js"), ["reasoningFragments", "ReasoningTranslation"]);

  test("reasoningFragments: đoạn · chạy tiếp · cắt theo hạn mức · surrogate pair — hai bản cùng kết quả", () => {
    const stockFragments = stockTranslation.reasoningFragments as unknown as (text: string, running: boolean, max: number) => unknown;
    const cases: { text: string; running: boolean; max: number }[] = [
      { text: "một đoạn", running: true, max: 4096 },
      { text: "một đoạn", running: false, max: 4096 },
      { text: "đoạn một\n\nđoạn hai", running: false, max: 4096 },
      { text: "đoạn một\n \nđoạn hai\n\n", running: true, max: 4096 },
      { text: "a".repeat(10), running: false, max: 4 },
      { text: "😀".repeat(4), running: false, max: 2 },
      { text: "x  y\tz\n\nq", running: true, max: 2 },
      { text: "", running: true, max: 8 },
    ];
    for (const item of cases) {
      expect(reasoningFragments(item.text, item.running, item.max)).toEqual(
        stockFragments(item.text, item.running, item.max) as ReturnType<typeof reasoningFragments>,
      );
    }
    expect(reasoningFragments("một", true, 4096)).toEqual([{ text: "một", suffix: "", complete: false }]);
  });

  test("ReasoningTranslation: update → dịch lần lượt từng mảnh → publish (hai bản cùng chuỗi lời gọi)", async () => {
    const stockCtor = stockTranslation.ReasoningTranslation as unknown as ReasoningCtor;
    const oursCtor = ReasoningTranslation as unknown as ReasoningCtor;
    const script: ReasoningScenario = { text: "mảnh một\n\nmảnh hai\n\nmảnh ba", running: false, failFirst: false, retry: false, disposeEarly: false };
    const ours = await runReasoningScenario(oursCtor, script);
    const stock = await runReasoningScenario(stockCtor, script);
    expect(ours.calls).toEqual(stock.calls);
    expect(ours.calls).toEqual(["mảnh một", "mảnh hai", "mảnh ba"]);
    expect(ours.publishes).toEqual(stock.publishes);
    expect(ours.publishes.at(-1)).toEqual({ text: "dịch:mảnh một\n\ndịch:mảnh hai\n\ndịch:mảnh ba", pending: false, failed: false });
  });

  test("ReasoningTranslation: lỗi ⇒ failed · retry dịch lại · dispose sớm chặn công bố — hai bản như nhau", async () => {
    const stockCtor = stockTranslation.ReasoningTranslation as unknown as ReasoningCtor;
    const oursCtor = ReasoningTranslation as unknown as ReasoningCtor;
    const failure: ReasoningScenario = { text: "một\n\nhai", running: false, failFirst: true, retry: true, disposeEarly: false };
    const oursFailed = await runReasoningScenario(oursCtor, failure);
    const stockFailed = await runReasoningScenario(stockCtor, failure);
    expect(oursFailed.calls).toEqual(stockFailed.calls);
    expect(oursFailed.calls).toEqual(["một", "một", "hai"]);
    expect(oursFailed.publishes).toEqual(stockFailed.publishes);
    expect(oursFailed.publishes.some((state) => (state as { failed: boolean }).failed)).toBe(true);

    const disposed: ReasoningScenario = { text: "một\n\nhai", running: false, failFirst: false, retry: false, disposeEarly: true };
    const oursDisposed = await runReasoningScenario(oursCtor, disposed);
    const stockDisposed = await runReasoningScenario(stockCtor, disposed);
    expect(oursDisposed.publishes).toEqual(stockDisposed.publishes);
    expect(oursDisposed.publishes.length).toBe(2);
    expect((oursDisposed.publishes.at(-1) as { pending: boolean }).pending).toBe(true);
  });

  test("locales: NS · en · zh · formLabels trùng TỪNG KÝ TỰ với vùng gốc", () => {
    const stockLocales = evalRegion(stockRegion("lib/types/client/locales.js"), ["NS", "en", "zh", "formLabels"]);
    expect(NS).toBe(stockLocales.NS as string);
    expect(NS).toBe("cotTranslation");
    expect(en).toEqual(stockLocales.en as typeof en);
    expect(zh).toEqual(stockLocales.zh as typeof zh);
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    const reader = (key: string) => "[" + key + "]";
    const stockFormLabels = stockLocales.formLabels as unknown as (t: (key: string) => string) => unknown;
    expect(formLabels(reader as never)).toEqual(stockFormLabels(reader) as ReturnType<typeof formLabels>);
  });

  test("providerLabel: bốn provider + provider lạ trùng bản gốc", () => {
    const stockSettings = evalRegion(stockRegion("lib/types/client/TranslationSettings.js"), ["providerLabel"]);
    const stockProviderLabel = stockSettings.providerLabel as unknown as (provider: string, t: (key: string) => string) => string;
    const reader = (key: string) => "<" + key + ">";
    for (const provider of ["bing", "google", "deepseek-account", "deepseek-official", "baidu"]) {
      expect(providerLabel(provider, reader as never)).toBe(stockProviderLabel(provider, reader));
    }
    expect(providerLabel("deepseek-account", reader as never)).toBe("<deepseekAccount>");
  });

  test("CSS: chuỗi nguyên văn + bảng lớp + hậu tố tagId trùng bản gốc", () => {
    expect(TRANSLATION_CSS).toBe(stockCss());
    expect(TranslationStyles).toEqual(stockStyleMap() as typeof TranslationStyles);
    expect(Object.keys(TranslationStyles).sort()).toEqual([
      "cot-translation-spin",
      "failure",
      "field",
      "notice",
      "spinner",
      "toolbar",
      "viewToggle",
    ]);
    const stockTagId = /const tagId = ("(?:[^"\\]|\\.)*");/.exec(STOCK_CLIENT_SOURCE)?.[1];
    expect(stockTagId).toBeDefined();
    if (stockTagId === undefined) throw new Error("khong thay tagId trong bundle goc");
    const decoded = JSON.parse(stockTagId) as string;
    expect(decoded).toBe(STOCK_ID + "/Translation.module.css");
    expect(TRANSLATION_CSS_TAG_ID).toBe(PACKAGE_NAME + "/Translation.module.css");
    expect(TRANSLATION_CSS_TAG_ID.slice(PACKAGE_NAME.length)).toBe(decoded.slice(STOCK_ID.length));
  });
});
