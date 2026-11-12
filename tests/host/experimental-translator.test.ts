/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho gói experimental-translator: export · Config · lỗi · resolve · recipe tất định ·
 *      availableProviders/translate trên Context cordis THẬT — so TRỰC TIẾP với bundle gốc trong kernel
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import Translator from "../../packages/host/experimental-translator/src/plugin.ts";
import { TranslationError, type TranslationErrorCode } from "../../packages/host/experimental-translator/src/error.ts";
import { anonymousRecipe } from "../../packages/host/experimental-translator/src/provider.ts";
import { deepseekRecipe } from "../../packages/host/experimental-translator/src/deepseek.ts";

/** Thư mục gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const OURS = join(REPO, "packages", "host", "experimental-translator");
/** Bản gốc trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-translator");
const STOCK = join(STOCK_DIR, "lib", "index.js");
const STOCK_TYPES = join(STOCK_DIR, "lib", "types");
/** Cordis THẬT của kernel — Translator kế thừa Service nên cần Context thật. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Hình dạng tối thiểu của cordis mà test dùng. */
interface CordisModule {
  /** Context thật (fiber gốc). */
  Context: new () => Record<string, unknown>;
}

/** Hình dạng một Translator (ta hoặc gốc) mà test dùng. */
interface TranslatorLike {
  /** Trần ký tự mỗi request. */
  readonly maxTextChars: number;
  /** Phân giải request thành spec. */
  resolve: (request: Record<string, unknown>) => unknown;
  /** Provider đang đủ điều kiện (có thể ném khi thiếu seam). */
  availableProviders: (signal?: AbortSignal) => Promise<readonly string[]>;
  /** Dịch một spec (có thể ném trước khi chạm mạng). */
  translate: (spec: Record<string, unknown>, signal?: AbortSignal) => Promise<string>;
}

/** Constructor của Translator hai bản. */
type TranslatorCtor = new (ctx: unknown, config: Record<string, unknown>) => TranslatorLike;

/** Cấu hình mẫu tất định (không chạm mạng) với trần ký tự nhỏ để thử lỗi. */
function config(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    provider: "bing",
    googleEndpoint: "https://translate.googleapis.com/translate_a/single",
    bingEndpoint: "https://edge.microsoft.com/translate/translatetext",
    timeoutMs: 10_000,
    maxTextChars: 10,
    maxResponseBytes: 1_000_000,
    deepseekTimeoutMs: 1_000,
    deepseekMaxOutputTokens: 8192,
    ...overrides,
  };
}

/** Nạp bản gốc (đường dẫn chuỗi động để tsc không kéo kiểu vào chương trình). */
async function stockModule(): Promise<{ default: TranslatorCtor; TranslationError: new (code: string, message: string) => Error }> {
  return (await import(STOCK)) as { default: TranslatorCtor; TranslationError: new (code: string, message: string) => Error };
}

/** Nạp module con của bản gốc. */
async function stockLeaf(name: string): Promise<Record<string, unknown>> {
  return (await import(join(STOCK_TYPES, name + ".js"))) as Record<string, unknown>;
}

/**
 * Thử một hàm trên CẢ HAI bản Translator với Context thật RIÊNG cho từng bên.
 * Nhận: run — hàm nhận (TranslatorLike) và trả giá trị/lỗi đã chuẩn hoá.
 * Trả: { ours, theirs } — kết quả hai bên.
 */
async function both<T>(run: (translator: TranslatorLike) => Promise<T> | T): Promise<{ ours: T; theirs: T }> {
  const cordis = (await import(CORDIS)) as CordisModule;
  const stock = await stockModule();
  const oursTranslator = new (Translator as unknown as TranslatorCtor)(new cordis.Context(), config());
  const stockTranslator = new (stock.default as TranslatorCtor)(new cordis.Context(), config());
  return { ours: await run(oursTranslator), theirs: await run(stockTranslator) };
}

/** Chụp lỗi thành hình dạng so sánh được. */
async function capture(run: () => Promise<unknown> | unknown): Promise<{ name?: string; code?: string; message: string }> {
  try {
    await run();
    return { message: "<khong-nem>" };
  } catch (error) {
    const failure = error as Error & { code?: string };
    return { name: failure.name, code: failure.code, message: failure.message };
  }
}

describe("experimental-translator — export + Config", () => {
  test("artifact export ĐÚNG hai tên như bản gốc; mặt ./types rỗng runtime", () => {
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
    const ours = names(readFileSync(join(OURS, "lib", "index.js"), "utf8"));
    expect(ours).toEqual(names(readFileSync(STOCK, "utf8")));
    expect(ours).toEqual(["TranslationError", "default"]);
    expect(readFileSync(join(OURS, "lib", "types.js"), "utf8").trim().length).toBeLessThan(20);
  });

  test("String(Config) TRÙNG từng ký tự; mặc định provider bing + trần 4.000 code unit", async () => {
    const stock = await stockModule();
    expect(String(Translator.Config)).toBe(String((stock.default as unknown as { Config: unknown }).Config));
    const resolved = (Translator.Config as unknown as (value: unknown) => Record<string, unknown>)({});
    expect(resolved["provider"]).toBe("bing");
    expect(resolved["maxTextChars"]).toBe(4000);
  });

  test("TranslationError: name · code · message · kế thừa Error — hai bản như nhau", async () => {
    const stock = await stockModule();
    const mine = new TranslationError("TRANSLATION_TIMEOUT", "hết giờ");
    // `stock` là module nạp ĐỘNG nên `theirs.code` bị suy ra `string | undefined`, không khớp hợp kiểu
    // `TranslationErrorCode` của `toEqual` (TS2769). Khai ĐÚNG kiểu cho bản gốc ngay tại đây (A/B với lớp ngoại lai).
    const theirs = new stock.TranslationError("TRANSLATION_TIMEOUT", "hết giờ") as Error & { code: TranslationErrorCode };
    expect({ name: mine.name, code: mine.code, message: mine.message, isError: mine instanceof Error }).toEqual({
      name: theirs.name,
      code: theirs.code,
      message: theirs.message,
      isError: theirs instanceof Error,
    });
    // Mã lỗi đóng: mọi mã dùng trong bundle gốc đều phải nằm trong hợp kiểu của ta (đo bằng runtime là no-op).
    expect(String(TranslationError)).toContain("TranslationError");
  });
});

describe("experimental-translator — resolve A/B (tất định, không chạm mạng)", () => {
  test("provider mặc định + ngôn ngữ nguồn auto: cùng spec", async () => {
    const result = await both((translator) => translator.resolve({ text: "hello", targetLanguage: "vi" }));
    expect(result.ours).toEqual(result.theirs);
    expect(result.ours).toEqual({ text: "hello", targetLanguage: "vi", sourceLanguage: "auto", provider: "bing" });
  });

  test("provider tường minh google + sourceLanguage + sessionId: cùng spec", async () => {
    const result = await both((translator) => translator.resolve({ text: "hi", targetLanguage: "vi", sourceLanguage: "en", provider: "google", sessionId: "s1" }));
    expect(result.ours).toEqual(result.theirs);
  });

  test("route trả phí thiếu Session ⇒ cùng lỗi TRANSLATION_SESSION_REQUIRED", async () => {
    for (const provider of ["deepseek-account", "deepseek-official"]) {
      const result = await both((translator) => capture(() => translator.resolve({ text: "hi", targetLanguage: "vi", provider })));
      expect(result.ours).toEqual(result.theirs);
      expect(result.ours.code).toBe("TRANSLATION_SESSION_REQUIRED");
    }
  });

  test("văn bản vượt trần ⇒ cùng lỗi TRANSLATION_TEXT_LIMIT (thông điệp nguyên văn)", async () => {
    const result = await both((translator) => capture(() => translator.resolve({ text: "x".repeat(11), targetLanguage: "vi" })));
    expect(result.ours).toEqual(result.theirs);
    expect(result.ours.code).toBe("TRANSLATION_TEXT_LIMIT");
  });

  test("maxTextChars đọc từ config: cùng giá trị", async () => {
    const result = await both((translator) => translator.maxTextChars);
    expect(result.ours).toBe(result.theirs);
    expect(result.ours).toBe(10);
  });
});

describe("experimental-translator — recipe A/B (hàm thuần)", () => {
  test("anonymousRecipe: identity ổn định theo provider + config", async () => {
    const stock = await stockLeaf("provider");
    const base = config();
    for (const provider of ["google", "bing"]) {
      const mine = (anonymousRecipe as (p: string, c: unknown) => unknown)(provider, base);
      const theirs = (stock.anonymousRecipe as (p: string, c: unknown) => unknown)(provider, base);
      expect(mine).toEqual(theirs);
      expect(JSON.stringify(mine).length).toBeGreaterThan(10);
    }
  });

  test("anonymousRecipe: endpoint đổi ⇒ recipe đổi (cả hai bản)", async () => {
    const stock = await stockLeaf("provider");
    const mineA = (anonymousRecipe as (p: string, c: unknown) => { recipe: string } | string)("google", config());
    const mineB = (anonymousRecipe as (p: string, c: unknown) => { recipe: string } | string)("google", config({ googleEndpoint: "https://example.test/translate" }));
    // Cùng lý do: khai kiểu TRẢ VỀ của bản gốc khớp `anonymousRecipe` (`{ recipe } | string`) thay vì `unknown`,
    // nếu không `toEqual` báo TS2769 ("Argument of type 'unknown'").
    const theirsA = (stock.anonymousRecipe as (p: string, c: unknown) => { recipe: string } | string)("google", config());
    const theirsB = (stock.anonymousRecipe as (p: string, c: unknown) => { recipe: string } | string)("google", config({ googleEndpoint: "https://example.test/translate" }));
    expect(mineA).toEqual(theirsA);
    expect(mineB).toEqual(theirsB);
    expect(JSON.stringify(mineA)).not.toBe(JSON.stringify(mineB));
  });

  test("deepseekRecipe: cùng config ⇒ cùng recipe; cùng model Flash cố định", async () => {
    const stock = await stockLeaf("deepseek");
    const mine = (deepseekRecipe as (c: unknown) => unknown)(config({ provider: "deepseek-official" }));
    const theirs = (stock.deepseekRecipe as (c: unknown) => unknown)(config({ provider: "deepseek-official" }));
    expect(mine).toEqual(theirs);
  });
});

describe("experimental-translator — provider list + translate trên Context THẬT", () => {
  test("availableProviders: thiếu seam ⇒ hai bản cùng kết quả hoặc cùng lỗi", async () => {
    const result = await both(async (translator) => {
      try {
        return { providers: await translator.availableProviders(new AbortController().signal) };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });
    expect("providers" in result.ours ? JSON.stringify(result.ours) : "error" in result.ours ? "error" : "?").toBe(
      "providers" in result.theirs ? JSON.stringify(result.theirs) : "error" in result.theirs ? "error" : "?",
    );
  });

  test("translate: văn bản vượt trần ⇒ cùng lỗi TEXT_LIMIT, KHÔNG chạm mạng", async () => {
    const result = await both((translator) => capture(() => translator.translate({ text: "y".repeat(11), targetLanguage: "vi", sourceLanguage: "auto", provider: "bing" }, new AbortController().signal)));
    expect(result.ours).toEqual(result.theirs);
    expect(result.ours.code).toBe("TRANSLATION_TEXT_LIMIT");
  });

  test("translate: signal đã huỷ ⇒ cùng AbortError (hai bản)", async () => {
    const aborted = new AbortController();
    aborted.abort(new DOMException("aborted", "AbortError"));
    const result = await both((translator) => capture(() => translator.translate({ text: "hi", targetLanguage: "vi", sourceLanguage: "auto", provider: "bing" }, aborted.signal)));
    expect(result.ours).toEqual(result.theirs);
    expect(result.ours.name).toBe("AbortError");
  });

  test("service đăng ký tên 'translator' trên Context thật (hai bản)", async () => {
    const cordis = (await import(CORDIS)) as CordisModule;
    const stock = await stockModule();
    const oursCtx = new cordis.Context();
    const stockCtx = new cordis.Context();
    new (Translator as unknown as TranslatorCtor)(oursCtx, config());
    new (stock.default as TranslatorCtor)(stockCtx, config());
    expect(oursCtx["translator"]).toBeDefined();
    expect(stockCtx["translator"]).toBeDefined();
  });
});
