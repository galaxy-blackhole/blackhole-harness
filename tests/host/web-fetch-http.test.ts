/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test row web-fetch-http (1:1 @deepseek-ai/dsh-web-fetch-http): policy URL/content-type, Config/apply,
 *      A/B mặc định cấu hình với CHÍNH bundle gốc, và hành vi trên server HTTP CỤC BỘ (không gọi mạng ngoài):
 *      redirect · trần byte · content-type · timeout · huỷ · lỗi HTTP
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createServer, request as httpRequest, type Server } from "node:http";
import { Readable } from "node:stream";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  CONFIG_DEFAULTS,
  Config,
  HttpFetchProvider,
  LOCAL_FETCH_PROVIDER_ID,
  apply,
  inject,
  name,
  resolveConfig,
} from "../../packages/host/web-fetch-http/src/index.ts";
import { classifyContentType, parseCharset, validateFetchUrl } from "../../packages/host/web-fetch-http/src/policy.ts";
import { isPublicIpAddress } from "../../packages/host/web-fetch-http/src/network.ts";
import type { NetworkOperations, TransportResult } from "../../packages/host/web-fetch-http/src/network.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Bundle GỐC (CHỈ ĐỌC) — oracle A/B cho mặc định cấu hình + bề mặt export. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web-fetch-http", "lib", "index.js");

/** Giới hạn mặc định dùng trong test (trần nhỏ để đo cắt). */
const BASE_LIMITS = { maxResponseBytes: 5_000_000, maxBodyChars: 100_000, timeoutMs: 5_000, maxRedirects: 5, userAgent: "gbh-test/1.0" };

/** Hàm phân giải giả: mọi hostname về 127.0.0.1 (server cục bộ) — KHÔNG gọi DNS/mạng ngoài. */
const loopbackResolver = async (): Promise<{ address: string; family: number }[]> => [{ address: "127.0.0.1", family: 4 }];

/** Header mà transport nhận được ở lượt gần nhất (bằng chứng UA/Accept). */
let lastHeaders: Record<string, string> = {};

/**
 * Transport bằng node:http cho test: ghim 127.0.0.1 qua option lookup, KHÔNG theo redirect (provider tự theo).
 * Vì sao cần seam: Bun tích hợp sẵn module tên "undici" nhưng Agent của nó KHÔNG có close/dispatch, nên
 * transport undici thật không chạy được dưới bun test; seam chỉ thay PRIMITIVE mạng, logic provider giữ nguyên.
 * @returns bộ thao tác mạng dùng server cục bộ.
 */
function nodeTransport(): NetworkOperations {
  const request = (url: URL, headers: Record<string, string>, signal: AbortSignal): Promise<TransportResult> =>
    new Promise<TransportResult>((resolve, reject) => {
      lastHeaders = { ...headers };
      const req = httpRequest(
        url,
        { method: "GET", headers, lookup: ((host: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => (options.all === true ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4))) as never },
        (response) => {
          const web = Readable.toWeb(response) as unknown as ReadableStream<Uint8Array>;
          const wrapped = new Response(web, { status: response.statusCode ?? 500, headers: response.headers as unknown as HeadersInit });
          resolve({ response: wrapped, close: async () => { response.destroy(); } });
        },
      );
      if (signal.aborted) {
        reject(new Error("aborted"));
        req.destroy();
        return;
      }
      signal.addEventListener("abort", () => { req.destroy(); reject(new Error("aborted")); }, { once: true });
      req.on("error", reject);
      req.end();
    });
  return {
    resolve: loopbackResolver,
    request: (url, _addresses, headers, signal) => request(url, headers, signal),
    requestVia: () => Promise.reject(new Error("test: khong dung proxy")),
  };
}

/** Server cục bộ + cổng. */
let server: Server;
let port = 0;

/** URL đầy đủ trên server cục bộ (hostname giả "public.test" để ghim lookup). */
function local(path: string): string {
  return "http://public.test:" + String(port) + path;
}

/** Mã lỗi WebError (không import vendor trong test). */
function codeOf(error: unknown): string {
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "KHONG-CO-MA";
}

/** Provider của TA với transport cục bộ. */
function provider(overrides: Partial<typeof BASE_LIMITS> = {}): HttpFetchProvider {
  return new HttpFetchProvider({ ...BASE_LIMITS, ...overrides }, loopbackResolver, nodeTransport());
}

/** Chạy một lượt fetch, trả kết quả hoặc mã lỗi. */
async function outcome(target: HttpFetchProvider, url: string, signal?: AbortSignal): Promise<unknown> {
  try {
    return await target.fetch({ url }, signal);
  } catch (error) {
    return { error: codeOf(error) };
  }
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = request.url ?? "/";
    if (path === "/text") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("hello world");
      return;
    }
    if (path === "/html") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<h1>hi</h1>");
      return;
    }
    if (path === "/json") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end('{"a":1}');
      return;
    }
    if (path === "/latin1") {
      response.writeHead(200, { "content-type": "text/plain; charset=iso-8859-1" });
      response.end(Buffer.from([0xE9]));
      return;
    }
    if (path === "/binary") {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(Buffer.from([1, 2, 3]));
      return;
    }
    if (path === "/badcharset") {
      response.writeHead(200, { "content-type": "text/plain; charset=x-khong-co" });
      response.end("x");
      return;
    }
    if (path === "/redirect") {
      response.writeHead(302, { location: "/text" });
      response.end();
      return;
    }
    if (path === "/cross") {
      response.writeHead(302, { location: "http://other.test/x" });
      response.end();
      return;
    }
    if (path === "/loop") {
      response.writeHead(302, { location: "/loop" });
      response.end();
      return;
    }
    if (path === "/no-location") {
      response.writeHead(302);
      response.end();
      return;
    }
    if (path === "/big-declared") {
      response.writeHead(200, { "content-type": "text/plain", "content-length": "100" });
      response.end("0123456789");
      return;
    }
    if (path === "/big-stream") {
      // Ghi CHUNK, KHÔNG khai Content-Length ⇒ Node dùng chunked ⇒ provider phải CẮT thay vì TOO_LARGE.
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("abcdefghij");
      response.write("klmnopqrst");
      response.end("uvwxyz");
      return;
    }
    if (path === "/long") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("abcdefghij");
      return;
    }
    if (path === "/slow") {
      setTimeout(() => {
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("late");
      }, 300);
      return;
    }
    if (path === "/missing") {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("nope");
      return;
    }
    response.writeHead(500, { "content-type": "text/plain" });
    response.end("unknown");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  port = typeof address === "object" && address !== null ? address.port : 0;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("web-fetch-http — policy thuần (URL + content-type)", () => {
  test("chỉ HTTP(S), không credentials, trần độ dài URL", () => {
    expect(validateFetchUrl("http://a.test/x").protocol).toBe("http:");
    expect(codeOf((() => { try { validateFetchUrl("ftp://a.test/x"); return null; } catch (error) { return error; } })())).toBe("WEB_INVALID_URL");
    expect(codeOf((() => { try { validateFetchUrl("http://u:p@a.test/x"); return null; } catch (error) { return error; } })())).toBe("WEB_BLOCKED_URL");
    expect(codeOf((() => { try { validateFetchUrl("http://a.test/" + "x".repeat(2100)); return null; } catch (error) { return error; } })())).toBe("WEB_INVALID_URL");
  });

  test("phân loại content-type + charset", () => {
    expect(classifyContentType("text/html; charset=utf-8")).toBe("html");
    expect(classifyContentType("application/xhtml+xml")).toBe("html");
    expect(classifyContentType("text/plain")).toBe("text");
    expect(classifyContentType("application/json")).toBe("text");
    expect(classifyContentType("application/ld+json")).toBe("text");
    expect(classifyContentType("image/png")).toBeUndefined();
    expect(classifyContentType(null)).toBeUndefined();
    expect(parseCharset("text/plain; charset=ISO-8859-1")).toBe("iso-8859-1");
    expect(parseCharset("text/plain")).toBeUndefined();
  });

  test("chỉ unicast công cộng mới qua được (loopback/private bị chặn)", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("10.0.0.1")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("khong-phai-ip")).toBe(false);
  });
});

describe("web-fetch-http — Config + apply + A/B bề mặt với bundle gốc", () => {
  test("mặc định cấu hình A/B với chính bundle gốc (chỉ userAgent là khác có chủ đích)", async () => {
    const stock = (await import(pathToFileURL(STOCK).href)) as { Config: (value: Record<string, unknown>) => Record<string, unknown>; DEFAULT_USER_AGENT: string; LOCAL_FETCH_PROVIDER_ID: string; name: string; inject: string[]; HttpFetchProvider: unknown };
    const theirs = stock.Config({}) as Record<string, unknown>;
    expect(theirs["maxResponseBytes"]).toBe(CONFIG_DEFAULTS.maxResponseBytes);
    expect(theirs["maxBodyChars"]).toBe(CONFIG_DEFAULTS.maxBodyChars);
    expect(theirs["timeoutMs"]).toBe(CONFIG_DEFAULTS.timeoutMs);
    expect(theirs["maxRedirects"]).toBe(CONFIG_DEFAULTS.maxRedirects);
    expect(stock.LOCAL_FETCH_PROVIDER_ID).toBe(LOCAL_FETCH_PROVIDER_ID);
    expect(stock.name).toBe(name);
    expect(stock.inject).toEqual(inject);
    expect(typeof stock.HttpFetchProvider).toBe("function");
    expect(typeof resolveConfig()).toBe("object");
    expect(resolveConfig()).toEqual(CONFIG_DEFAULTS);
    expect(resolveConfig({ maxRedirects: 0 }).maxRedirects).toBe(0);
    // schemastery schema là HÀM (gọi Config({}) để phân giải mặc định) — y bản gốc.
    expect(typeof Config).toBe("function");
    expect((Config as unknown as (value: Record<string, unknown>) => Record<string, unknown>)({})["maxRedirects"]).toBe(CONFIG_DEFAULTS.maxRedirects);
  });

  test("apply đăng ký provider id http; đăng ký hai lần ⇒ lỗi trùng id; config sai ⇒ ném", () => {
    const registered: { id: string; available: () => boolean }[] = [];
    const ctx = { web: { registerFetchProvider: (item: { id: string; available: () => boolean }) => { if (registered.some((entry) => entry.id === item.id)) throw Object.assign(new Error("dup"), { code: "WEB_DUPLICATE_PROVIDER" }); registered.push(item); return () => undefined; } } };
    apply(ctx as never);
    expect(registered.length).toBe(1);
    expect(registered[0]?.id).toBe("http");
    expect(registered[0]?.available()).toBe(true);
    expect(codeOf((() => { try { apply(ctx as never); return null; } catch (error) { return error; } })())).toBe("WEB_DUPLICATE_PROVIDER");
    for (const bad of [{ maxResponseBytes: 0 }, { maxBodyChars: -1 }, { timeoutMs: Number.POSITIVE_INFINITY }, { timeoutMs: 3e9 }, { maxRedirects: 1.5 }, { maxRedirects: -1 }]) {
      let thrown: unknown = null;
      try { apply({ web: { registerFetchProvider: () => () => undefined } } as never, bad); } catch (error) { thrown = error; }
      expect(thrown instanceof Error).toBe(true);
    }
  });
});

describe("web-fetch-http — hành vi trên server cục bộ", () => {
  test("đọc text/html/json, charset khai báo, và gửi đúng UA/Accept", async () => {
    const target = provider();
    const text = (await outcome(target, local("/text"))) as { url: string; statusCode: number; body: { kind: string; content: string }; truncated: boolean };
    expect(text).toEqual({ url: local("/text"), statusCode: 200, body: { kind: "text", content: "hello world" }, truncated: false });
    expect((lastHeaders["user-agent"] ?? "")).toBe(BASE_LIMITS.userAgent);
    expect((lastHeaders["accept"] ?? "")).toContain("text/html");
    const html = (await outcome(target, local("/html"))) as { body: { kind: string } };
    expect(html.body.kind).toBe("html");
    const json = (await outcome(target, local("/json"))) as { body: { kind: string; content: string } };
    expect(json.body).toEqual({ kind: "text", content: '{"a":1}' });
    const latin1 = (await outcome(target, local("/latin1"))) as { body: { content: string } };
    expect(latin1.body.content).toBe("é");
  });

  test("redirect cùng origin được theo (URL cuối + status)", async () => {
    const mine = (await outcome(provider(), local("/redirect"))) as { statusCode: number; url: string };
    expect(mine.statusCode).toBe(200);
    expect(mine.url).toBe(local("/text"));
  });

  test("redirect chéo origin / vượt trần hop / thiếu Location đều bị chặn", async () => {
    const target = provider({ maxRedirects: 2 });
    expect(await outcome(target, local("/cross"))).toEqual({ error: "WEB_REDIRECT_BLOCKED" });
    expect(await outcome(target, local("/loop"))).toEqual({ error: "WEB_REDIRECT_BLOCKED" });
    expect(await outcome(target, local("/no-location"))).toEqual({ error: "WEB_PROVIDER_ERROR" });
  });

  test("trần byte: Content-Length vượt ⇒ TOO_LARGE; luồng vượt ⇒ CẮT + truncated; trần ký tự ⇒ CẮT", async () => {
    expect(await outcome(provider({ maxResponseBytes: 5 }), local("/big-declared"))).toEqual({ error: "WEB_FETCH_TOO_LARGE" });
    const cut = (await outcome(provider({ maxResponseBytes: 10 }), local("/big-stream"))) as { body: { content: string }; truncated: boolean };
    expect(cut.truncated).toBe(true);
    expect(cut.body.content).toBe("abcdefghij");
    const short = (await outcome(provider({ maxBodyChars: 5 }), local("/long"))) as { body: { content: string }; truncated: boolean };
    expect(short.truncated).toBe(true);
    expect(short.body.content).toBe("abcde");
  });

  test("content-type không hỗ trợ / charset lạ ⇒ WEB_UNSUPPORTED_CONTENT_TYPE", async () => {
    expect(await outcome(provider(), local("/binary"))).toEqual({ error: "WEB_UNSUPPORTED_CONTENT_TYPE" });
    expect(await outcome(provider(), local("/badcharset"))).toEqual({ error: "WEB_UNSUPPORTED_CONTENT_TYPE" });
  });

  test("timeout: hạn chót riêng của ta ⇒ WEB_FETCH_TIMEOUT", async () => {
    expect(await outcome(provider({ timeoutMs: 60 }), local("/slow"))).toEqual({ error: "WEB_FETCH_TIMEOUT" });
  });

  test("huỷ của người gọi ⇒ WEB_ABORTED", async () => {
    const controller = new AbortController();
    const pending = outcome(provider(), local("/slow"), controller.signal);
    controller.abort();
    expect(await pending).toEqual({ error: "WEB_ABORTED" });
    const pre = new AbortController();
    pre.abort();
    expect(await outcome(provider(), local("/text"), pre.signal)).toEqual({ error: "WEB_ABORTED" });
  });

  test("lỗi HTTP (404) là KẾT QUẢ có statusCode, không phải ngoại lệ", async () => {
    const mine = (await outcome(provider(), local("/missing"))) as { statusCode: number; body: { content: string } };
    expect(mine.statusCode).toBe(404);
    expect(mine.body.content).toBe("nope");
  });
});
