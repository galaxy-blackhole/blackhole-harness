/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 25/10/2026
 * desc Test provider tìm kiếm web qua Galaxy cloud: map response, dedupe, available(), lỗi HTTP/JSON.
 */
import { describe, expect, test } from "bun:test";

import { apply, Config, mapOllamaResponse, OllamaSearchProvider, OLLAMA_SEARCH_PROVIDER_ID } from "../../packages/host/web-search-ollama/src/index.ts";

/** Options cơ bản cho một provider. */
const BASE = {
  baseURL: "https://ollama.com",
  apiKey: "test-key" as string | undefined,
  resolveApiKey: async () => "test-key" as string | undefined,
};

/**
 * Dựng hàm resolveOptions (provider nhận HÀM, không nhận object).
 * Nhận: over — các trường ghi đè.
 * Trả: () => options.
 */
const factory = (over: Record<string, unknown> = {}) => () => ({ ...BASE, ...over });

describe("web-search-ollama — map response", () => {
  test("mảng trần: giữ url/title/snippet, bỏ item thiếu url, dedupe theo url", () => {
    const result = mapOllamaResponse([
      { url: "https://a", title: "A", content: "nội dung A" },
      { url: "https://a", title: "A lần 2" },
      { link: "https://b", name: "B", description: "mô tả B" },
      { title: "thiếu url" } as never,
    ]);
    expect(result.sources).toEqual([
      { url: "https://a", title: "A", snippet: "nội dung A" },
      { url: "https://b", title: "B", snippet: "mô tả B" },
    ]);
    expect(result.truncated).toBe(false);
  });

  test("object bọc nhiều khoá: results / data / sources / web.results đều đọc được", () => {
    const one = [{ url: "https://x", title: "X" }];
    expect(mapOllamaResponse({ results: one }).sources).toHaveLength(1);
    expect(mapOllamaResponse({ data: one }).sources).toHaveLength(1);
    expect(mapOllamaResponse({ sources: one }).sources).toHaveLength(1);
    expect(mapOllamaResponse({ web: { results: one } }).sources).toHaveLength(1);
    expect(mapOllamaResponse({} as never).sources).toEqual([]);
  });

  test("cắt đúng trần và bật cờ truncated", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ url: "https://" + String(index) }));
    const result = mapOllamaResponse(many, 3);
    expect(result.sources).toHaveLength(3);
    expect(result.truncated).toBe(true);
  });
});

describe("web-search-ollama — provider", () => {
  test("id là 'auto' để khớp web.searchProvider", () => {
    expect(OLLAMA_SEARCH_PROVIDER_ID).toBe("auto");
    expect(new OllamaSearchProvider(factory()).id).toBe("auto");
  });

  test("available(): cần baseURL hợp lệ + có đường lấy khoá", () => {
    expect(new OllamaSearchProvider(factory()).available()).toBe(true);
    expect(new OllamaSearchProvider(factory({ apiKey: undefined, resolveApiKey: async () => undefined })).available()).toBe(true);
    expect(new OllamaSearchProvider(factory({ baseURL: "khong-phai-url" })).available()).toBe(false);
  });

  test("search(): thiếu khoá ⇒ WebError code WEB_PROVIDER_UNAVAILABLE", async () => {
    const provider = new OllamaSearchProvider(factory({ apiKey: undefined, resolveApiKey: async () => undefined }));
    await expect(provider.search({ query: "x" })).rejects.toMatchObject({ code: "WEB_PROVIDER_UNAVAILABLE" });
  });

  test("search(): đọc đúng body + header, trả sources đã chuẩn hoá", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ results: [{ url: "https://a", title: "A", content: "snippet" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const result = await new OllamaSearchProvider(factory()).search({ query: "PhoWhisper" });
      expect(result.sources).toEqual([{ url: "https://a", title: "A", snippet: "snippet" }]);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe("https://ollama.com/api/web_search");
      expect((calls[0]?.init.headers as Record<string, string>)["authorization"]).toBe("Bearer test-key");
      expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ query: "PhoWhisper", max_results: 8 });
    } finally {
      globalThis.fetch = original;
    }
  });

  test("search(): HTTP lỗi ⇒ WebError kèm mã; body không phải JSON ⇒ WEB_PROVIDER_BAD_RESPONSE", async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
      await expect(new OllamaSearchProvider(factory()).search({ query: "x" })).rejects.toMatchObject({ code: "WEB_PROVIDER_HTTP_ERROR" });
      globalThis.fetch = (async () => new Response("khong-phai-json", { status: 200 })) as unknown as typeof fetch;
      await expect(new OllamaSearchProvider(factory()).search({ query: "x" })).rejects.toMatchObject({ code: "WEB_PROVIDER_BAD_RESPONSE" });
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("web-search-ollama — cấu hình cho form Web search", () => {
  test("Config: khai đủ 4 trường cho form (apiKey · apiKeyEnv · baseURL · maxUses)", () => {
    // schemastery bọc object thành proxy "volatile" nên đọc thẳng thuộc tính không ổn định;
    // kiểm hình dạng schema (đúng bộ khoá client stock dùng để dựng form) là đủ.
    const fields = Object.keys((Config as unknown as { dict: Record<string, unknown> }).dict);
    expect(fields.sort()).toEqual(["apiKey", "apiKeyEnv", "baseURL", "maxUses"]);
  });

  test("apply(): nhận CONFIG TĨNH (loader Host) lẫn getter, đăng ký đúng một provider id auto", async () => {
    const registered: unknown[] = [];
    const ctx = { web: { registerSearchProvider: (p: unknown) => { registered.push(p); } }, get: () => undefined };
    apply(ctx as never, { baseURL: "https://vi-du", maxUses: 3 } as never);
    apply(ctx as never, (() => ({ baseURL: "https://vi-du-2" })) as never);
    expect(registered).toHaveLength(2);
    const ids = registered.map((p) => (p as { id: string }).id);
    expect(ids).toEqual(["auto", "auto"]);
    const available = registered.map((p) => (p as { available(): boolean }).available());
    expect(available).toEqual([true, true]);
  });
});

describe("web-search-ollama — Điểm cuối để trống", () => {
  test("baseURL rỗng ⇒ dùng mặc định Galaxy cloud (đúng gợi ý trên form)", async () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ results: [{ url: "https://a" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const rong = new OllamaSearchProvider(factory({ baseURL: "   " }));
      expect(rong.available()).toBe(true);
      await rong.search({ query: "x" });
      expect(calls[0]).toBe("https://ollama.com/api/web_search");
    } finally {
      globalThis.fetch = original;
    }
  });
});
