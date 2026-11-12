/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test 1:1 cho @galaxy-blackhole/gbh-web-search: bề mặt export · locale byte-equal ·
 *      mapAnthropicResponse (dedupe/snippet/page_age/lỗi) · available() · xác thực api-key & account ·
 *      abort · search() với FETCH STUB (không gọi mạng thật). KHÔNG mount.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as mod from "../../packages/host/web-search/src/index.ts";
import {
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_PROVIDER_ID,
  DeepSeekSearchProvider,
  mapAnthropicResponse,
  type SearchOptions,
  WebError,
} from "../../packages/host/web-search/src/index.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói gốc (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web-search-deepseek");

/** Options tối thiểu cho test. */
const options = (patch: Partial<SearchOptions> = {}): SearchOptions => ({
  apiKey: "sk-test",
  apiKeyEnv: "DEEPSEEK_API_KEY",
  baseURL: "https://example.test/anthropic/v1",
  model: DEEPSEEK_DEFAULT_MODEL,
  apiVersion: "2023-06-01",
  maxTokens: 4096,
  maxUses: 5,
  ...patch,
});

describe("bề mặt export + locale byte-equal", () => {
  test("12 export BẰNG bản gốc + hằng số đúng", () => {
    expect(Object.keys(mod).sort()).toEqual([
      "Config", "DEEPSEEK_DEFAULT_API_VERSION", "DEEPSEEK_DEFAULT_BASE_URL", "DEEPSEEK_DEFAULT_MAX_TOKENS",
      "DEEPSEEK_DEFAULT_MAX_USES", "DEEPSEEK_DEFAULT_MODEL", "DEEPSEEK_PROVIDER_ID", "DeepSeekSearchProvider",
      "WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE", "WebError", "apply", "inject", "mapAnthropicResponse",
      "name", "resolveOptions",
    ].sort());
    expect(DEEPSEEK_PROVIDER_ID).toBe("deepseek-official");
    expect(mod.DEEPSEEK_DEFAULT_BASE_URL).toBe("https://api.deepseek.com/anthropic/v1");
    expect(mod.DEEPSEEK_DEFAULT_MODEL).toBe("deepseek-v4-flash");
    expect(mod.DEEPSEEK_DEFAULT_API_VERSION).toBe("2023-06-01");
    expect(mod.DEEPSEEK_DEFAULT_MAX_TOKENS).toBe(4096);
    expect(mod.DEEPSEEK_DEFAULT_MAX_USES).toBe(5);
    // 09/11/2026 - chu du an doi ten row/namespace sang "web-search-gbh" (quyet dinh da duyet, khuon
    // session-log). Giu NGUYEN DO MANH: van khang dinh GIA TRI CHINH XAC, chi la gia tri MOI.
    expect(mod.WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE).toBe("web-search-gbh");
    expect(mod.name).toBe("web-search-gbh");
    expect(mod.inject).toEqual(["web"]);
  });

  test("locale en/zh BYTE-EQUAL gốc (55 + 123 B)", async () => {
    for (const file of ["en.json", "zh.json"]) {
      const ours = await readFile(join(REPO, "packages", "host", "web-search", "locale", file));
      const stock = await readFile(join(STOCK, "locale", file));
      expect(ours.equals(stock)).toBe(true);
    }
    expect((await readFile(join(STOCK, "locale", "en.json"))).byteLength).toBe(55);
    expect((await readFile(join(STOCK, "locale", "zh.json"))).byteLength).toBe(123);
  });
});

describe("mapAnthropicResponse — map 1:1", () => {
  test("dedupe theo url, snippet từ citations (first-wins), page_age ⇒ publishedAt", () => {
    const result = mapAnthropicResponse({ content: [
      { type: "text", citations: [{ url: "https://a.test", cited_text: "trich-a" }, { url: "https://a.test", cited_text: "trich-sau" }] },
      { type: "web_search_tool_result", content: [
        { type: "web_search_result", url: "https://a.test", title: "A", page_age: "2025-01-01" },
        { type: "web_search_result", url: "https://a.test", title: "A lan 2" },
        { type: "web_search_result", url: "https://b.test" },
      ] },
    ] });
    expect(result.truncated).toBe(false);
    expect(result.sources).toEqual([
      { url: "https://a.test", title: "A", snippet: "trich-a", publishedAt: "2025-01-01" },
      { url: "https://b.test" },
    ]);
  });

  test("không có block web_search_tool_result ⇒ WebError WEB_PROVIDER_ERROR", () => {
    try { mapAnthropicResponse({ content: [{ type: "text", text: "mo ta" }] }); expect(false).toBe(true); }
    catch (error) { expect((error as WebError).code).toBe("WEB_PROVIDER_ERROR"); }
  });
});

describe("DeepSeekSearchProvider — available/auth/search với fetch stub", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  test("available(): cần credential + baseURL hợp lệ + limits nguyên dương", () => {
    expect(new DeepSeekSearchProvider(() => options()).available()).toBe(true);
    expect(new DeepSeekSearchProvider(() => options({ apiKey: undefined, resolveApiKey: undefined })).available()).toBe(false);
    expect(new DeepSeekSearchProvider(() => options({ baseURL: "khong-phai-url" })).available()).toBe(false);
    expect(new DeepSeekSearchProvider(() => options({ maxUses: 0 })).available()).toBe(false);
    expect(new DeepSeekSearchProvider(() => options({ maxTokens: 1.5 })).available()).toBe(false);
  });

  test("search(): gửi ĐÚNG body + header, trả nguồn đã map (không gọi mạng thật)", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ content: [{ type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://x.test", title: "X" }] }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new DeepSeekSearchProvider(() => options());
    const result = await provider.search({ query: "gbh la gi" });
    expect(result.sources).toEqual([{ url: "https://x.test", title: "X" }]);
    expect(seen?.url).toBe("https://example.test/anthropic/v1/messages");
    const headers = seen?.init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test");
    expect(headers.authorization).toBe("Bearer sk-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["user-agent"]).toBe("deepseek-harness/0.0.1");
    const body = JSON.parse(String(seen?.init.body)) as { model: string; tools: { type: string; name: string; max_uses: number }[]; messages: { content: { text: string }[] }[] };
    expect(body.model).toBe(DEEPSEEK_DEFAULT_MODEL);
    expect(body.tools[0]).toEqual({ type: "web_search_20250305", name: "web_search", max_uses: 5 });
    expect(body.messages[0]?.content[0]?.text).toBe("Perform a web search for the query: gbh la gi");
  });

  test("token tài khoản ⇒ header x-dsh-auth-token (không gửi api key)", async () => {
    let headers: Record<string, string> = {};
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      headers = init.headers as Record<string, string>;
      return new Response(JSON.stringify({ content: [{ type: "web_search_tool_result", content: [] }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new DeepSeekSearchProvider(() => options({ apiKey: undefined, resolveAccountToken: async () => "tok-acc" }));
    await provider.search({ query: "q" });
    expect(headers["x-dsh-auth-token"]).toBe("tok-acc");
    expect(headers["x-api-key"]).toBeUndefined();
  });

  test("thiếu key ⇒ WEB_PROVIDER_CREDENTIAL_MISSING với câu hướng dẫn gốc", async () => {
    const provider = new DeepSeekSearchProvider(() => options({ apiKey: undefined, resolveApiKey: async () => undefined }));
    try { await provider.search({ query: "q" }); expect(false).toBe(true); }
    catch (error) {
      expect((error as WebError).code).toBe("WEB_PROVIDER_CREDENTIAL_MISSING");
      expect((error as Error).message).toContain("DeepSeek search has no API key for \"DEEPSEEK_API_KEY\"");
    }
  });

  test("abort trước khi dispatch ⇒ WEB_ABORTED (không gọi fetch)", async () => {
    let called = false;
    globalThis.fetch = (async () => { called = true; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    const controller = new AbortController();
    controller.abort(new Error("huy"));
    const provider = new DeepSeekSearchProvider(() => options());
    try { await provider.search({ query: "q" }, controller.signal); expect(false).toBe(true); }
    catch (error) { expect((error as WebError).code).toBe("WEB_ABORTED"); }
    expect(called).toBe(false);
  });

  test("HTTP 401 với tài khoản ⇒ câu 'rejected the account sign-in' + WEB_PROVIDER_ERROR", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "het han" } }), { status: 401 })) as unknown as typeof fetch;
    const provider = new DeepSeekSearchProvider(() => options({ apiKey: undefined, resolveAccountToken: async () => "tok-acc" }));
    try { await provider.search({ query: "q" }); expect(false).toBe(true); }
    catch (error) {
      expect((error as WebError).code).toBe("WEB_PROVIDER_ERROR");
      expect((error as Error).message).toContain("DeepSeek rejected the account sign-in used for this web search");
      expect((error as Error).message).toContain("het han");
    }
  });
});
