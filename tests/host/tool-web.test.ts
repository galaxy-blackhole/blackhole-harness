/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-host-tool-web: so TỪNG hành vi với CHÍNH bundle gốc
 *      (@deepseek-ai/dsh-tool-web) — export · Config · thứ tự đăng ký · system prompt · hình dạng
 *      tool · thi hành · render · metadata trình bày · các nhánh lỗi. KHÔNG gọi mạng: seam ctx.web
 *      là stub ghi lại lời gọi.
 */

import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as ours from "../../packages/host/tool-web/src/index.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");

/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-web", "lib", "index.js");

/** Thư mục package của ta (đọc manifest + nguồn cho phép kiểm tự chứa). */
const PKG = join(ROOT, "packages", "host", "tool-web");

/** Bản gốc nạp động (đường dẫn tính từ repo, không phải import tĩnh). */
const stock: any = await import(STOCK);

/** Bí danh any cho module của ta để phép so viết gọn mà vẫn giữ import TĨNH có kiểu. */
const oursAny: any = ours;

/** Một context giả đã ghi lại mọi lời gọi đăng ký. */
interface Captured {
  /** Context truyền vào hàm apply. */
  readonly ctx: any;
  /** Nhật ký lời gọi theo thứ tự. */
  readonly calls: unknown[];
  /** Các section system-prompt đã đăng ký. */
  readonly sections: any[];
  /** Sổ tool đã đăng ký, khoá theo tên. */
  readonly tools: Map<string, any>;
}

/** Thời điểm thi hành giả: chỉ có signal như hợp đồng thật. */
const EXEC = { signal: new AbortController().signal };

/**
 * Dựng seam web GIẢ, không bao giờ gọi mạng.
 * Nhận: mode — "ok" trả kết quả mẫu, "fail" để câu hỏi "boom" ném lỗi.
 * Trả: đối tượng có search/fetch đúng hợp đồng + nhật ký log.
 */
function makeWeb(mode: "ok" | "fail" = "ok"): any {
  const log: unknown[] = [];
  return {
    log,
    async search(request: any, signal?: AbortSignal) {
      log.push(["search", request.query, request.maxResults, signal?.aborted ?? null]);
      if (mode === "fail" && request.query === "boom") throw new Error("provider exploded");
      return {
        ...(request.query === "a" ? { content: "answer a" } : {}),
        sources: [{ url: "https://x/" + request.query, title: "T " + request.query, snippet: "s" }],
        truncated: request.query === "trunc",
      };
    },
    async fetch(request: any, signal?: AbortSignal) {
      log.push(["fetch", request.url, signal?.aborted ?? null]);
      return { url: request.url, statusCode: 200, body: { kind: "text", content: "BODY" }, truncated: false };
    },
  };
}

/**
 * Dựng context giả có đúng phần bề mặt plugin dùng (tools · systemPrompt · web).
 * Nhận: web — seam web giả.
 * Trả: context cùng nhật ký lời gọi, danh sách section, và sổ tool.
 */
function makeContext(web: any): Captured {
  const calls: unknown[] = [];
  const sections: any[] = [];
  const tools = new Map<string, any>();
  const toolsApi = {
    register(definition: any) {
      calls.push(["register", definition.name]);
      tools.set(definition.name, definition);
      return () => {
        calls.push(["dispose", definition.name]);
        tools.delete(definition.name);
      };
    },
    get(name: string) {
      return tools.get(name);
    },
  };
  const systemPrompt = {
    section(section: any) {
      calls.push(["section", section.name]);
      sections.push(section);
      return () => {};
    },
    getSectionOrder(name: string) {
      calls.push(["order", name]);
      return name === "TOOL_WEB_SEARCH" ? 2000 : 2100;
    },
  };
  return { ctx: { web, tools: toolsApi, systemPrompt }, calls, sections, tools };
}

/**
 * Nạp một plugin lên context giả.
 * Nhận: plugin — module plugin; web — seam web giả; config — cấu hình (mặc định Config({})).
 * Trả: context đã ghi lại đăng ký.
 */
async function boot(plugin: any, web: any, config?: any): Promise<Captured> {
  const captured = makeContext(web);
  plugin.apply(captured.ctx, config ?? plugin.Config({}));
  return captured;
}

/**
 * Chạy một phép gọi rồi chuẩn hoá kết quả HOẶC lỗi thành chuỗi so được.
 * Nhận: fn — phép gọi cần đo.
 * Trả: JSON ok hoặc JSON error gồm name + message.
 */
async function trace(fn: () => unknown): Promise<string> {
  try {
    return JSON.stringify({ ok: await fn() });
  } catch (error: any) {
    return JSON.stringify({ error: { name: error?.name, message: error?.message } });
  }
}

/**
 * Trích hình dạng so được của một tool đã đăng ký.
 * Nhận: tool — định nghĩa tool; args — tham số hợp lệ để gọi các callback thuần.
 * Trả: object gồm mọi bề mặt model/UI nhìn thấy.
 */
function shapeOf(tool: any, args: unknown): unknown {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    schema: tool.output.schema,
    timeoutMs: tool.timeoutMs,
    concurrencySafe: tool.isConcurrencySafe(args),
    concurrencyInvalid: tool.isConcurrencySafe({}),
    presentCall: tool.presentCall(args),
  };
}

/** Tham số hợp lệ của từng tool, dùng cho các callback thuần. */
const SEARCH_ARGS = { queries: ["a"] };
const FETCH_ARGS = { url: "https://e/p" };

describe("tool-web — bề mặt gói (A/B với bundle gốc)", () => {
  test("export · name · inject · hằng số trùng bản gốc", () => {
    expect(Object.keys(oursAny).sort()).toEqual(Object.keys(stock).sort());
    expect(oursAny.name).toBe(stock.name);
    expect(oursAny.inject).toEqual(stock.inject);
    expect([
      oursAny.WEB_SEARCH_MAX_RESULTS,
      oursAny.WEB_SEARCH_MAX_QUERIES,
      oursAny.DEFAULT_WEB_TOOL_TIMEOUT_MS,
      oursAny.DEFAULT_FETCH_MAX_OUTPUT_CHARS,
    ]).toEqual([
      stock.WEB_SEARCH_MAX_RESULTS,
      stock.WEB_SEARCH_MAX_QUERIES,
      stock.DEFAULT_WEB_TOOL_TIMEOUT_MS,
      stock.DEFAULT_FETCH_MAX_OUTPUT_CHARS,
    ]);
  });

  test("Config: mặc định, gọi được, và Standard Schema khớp bản gốc", () => {
    const inputs = [
      undefined,
      null,
      {},
      { search: false },
      { fetch: false },
      { unknown: 1 },
      { search: null },
      { searchMaxResults: 1.5 },
      { searchMaxResults: 3, searchMaxQueries: 1, fetchTimeoutMs: 1, searchTimeoutMs: 2, fetchMaxOutputChars: 4 },
    ];
    for (const input of inputs) {
      expect(JSON.stringify(oursAny.Config["~standard"].validate(input))).toBe(JSON.stringify(stock.Config["~standard"].validate(input)));
      expect(JSON.stringify(oursAny.Config(input))).toBe(JSON.stringify(stock.Config(input)));
    }
  });

  test("Config: vi phạm báo CÙNG tên lỗi và CÙNG thông điệp (dừng ở lỗi đầu tiên)", () => {
    const inputs = ["str", [], { search: "no" }, { fetch: 0 }, { searchMaxResults: "8" }, { search: "no", searchMaxResults: "8" }];
    for (const input of inputs) {
      const capture = (module: any): unknown => {
        try {
          module.Config(input);
          return "ok";
        } catch (error: any) {
          return [error?.name, error?.message];
        }
      };
      expect(capture(oursAny)).toEqual(capture(stock));
    }
  });
});

describe("tool-web — đăng ký và system prompt", () => {
  test("thứ tự đăng ký khớp: order → section → register, cho từng tool", async () => {
    const a = await boot(stock, makeWeb());
    const b = await boot(oursAny, makeWeb());
    expect(b.calls).toEqual(a.calls);
    expect(b.calls).toEqual([
      ["order", "TOOL_WEB_SEARCH"],
      ["section", "tool:web_search"],
      ["register", "web_search"],
      ["order", "TOOL_WEB_FETCH"],
      ["section", "tool:web_fetch"],
      ["register", "web_fetch"],
    ]);
  });

  test("siêu dữ liệu section khớp (tên · order · kiểu text)", async () => {
    const a = await boot(stock, makeWeb());
    const b = await boot(oursAny, makeWeb());
    const shape = (sections: any[]): unknown => sections.map((section) => ({ name: section.name, order: section.order, text: typeof section.text }));
    expect(shape(b.sections)).toEqual(shape(a.sections));
  });

  test("chữ system-prompt khớp ở CẢ BỐN tổ hợp hiển thị tool", async () => {
    for (const visible of [["web_search", "web_fetch"], ["web_search"], ["web_fetch"], []]) {
      const a = await boot(stock, makeWeb());
      const b = await boot(oursAny, makeWeb());
      for (const captured of [a, b]) {
        for (const name of ["web_search", "web_fetch"]) if (!visible.includes(name)) captured.tools.delete(name);
      }
      const texts = (captured: Captured): unknown => captured.sections.map((section) => section.text({ scope: undefined }));
      expect(texts(b)).toEqual(texts(a));
    }
  });
});

describe("tool-web — hình dạng tool", () => {
  test("web_search: name · description · parameters · schema · timeout · card khớp", async () => {
    const a = await boot(stock, makeWeb());
    const b = await boot(oursAny, makeWeb());
    expect(shapeOf(b.tools.get("web_search"), SEARCH_ARGS)).toEqual(shapeOf(a.tools.get("web_search"), SEARCH_ARGS));
    expect(b.tools.get("web_search").parameters.properties.queries.description).toBe("1–4 search queries; their results are merged.");
  });

  test("web_fetch: name · description · parameters · schema · timeout · card khớp", async () => {
    const a = await boot(stock, makeWeb());
    const b = await boot(oursAny, makeWeb());
    expect(shapeOf(b.tools.get("web_fetch"), FETCH_ARGS)).toEqual(shapeOf(a.tools.get("web_fetch"), FETCH_ARGS));
    expect(b.tools.get("web_fetch").parameters.properties.url.description).toBe("The HTTP(S) URL to fetch.");
  });
});

describe("tool-web — thi hành web_search", () => {
  test("một câu hỏi: execute · render · meta · presentResult khớp", async () => {
    const a = await boot(stock, makeWeb());
    const b = await boot(oursAny, makeWeb());
    const sa = a.tools.get("web_search");
    const sb = b.tools.get("web_search");
    const ra = await sa.execute(SEARCH_ARGS, EXEC);
    const rb = await sb.execute(SEARCH_ARGS, EXEC);
    expect(rb).toEqual(ra);
    expect(sb.output.render(SEARCH_ARGS, rb)).toEqual(sa.output.render(SEARCH_ARGS, ra));
    const metaA = sa.output.presentationMeta(SEARCH_ARGS, ra);
    const metaB = sb.output.presentationMeta(SEARCH_ARGS, rb);
    expect(metaB).toEqual(metaA);
    expect(sb.presentResult(SEARCH_ARGS, { content: [], isError: false, meta: metaB })).toEqual(
      sa.presentResult(SEARCH_ARGS, { content: [], isError: false, meta: metaA }),
    );
  });

  test("nhiều câu hỏi: gộp khử trùng, xoay vòng, trần kết quả và cờ cắt khớp", async () => {
    const a = await boot(stock, makeWeb());
    const b = await boot(oursAny, makeWeb());
    for (const args of [{ queries: ["a", "b"] }, { queries: ["a", "a", "b"] }, { queries: ["x", "y", "z", "w"] }]) {
      const ra = await a.tools.get("web_search").execute(args, EXEC);
      const rb = await b.tools.get("web_search").execute(args, EXEC);
      expect(rb).toEqual(ra);
      expect(JSON.stringify(b.tools.get("web_search").output.render(args, rb))).toBe(JSON.stringify(a.tools.get("web_search").output.render(args, ra)));
    }
    const capped = await boot(oursAny, makeWeb(), oursAny.Config({ searchMaxResults: 2 }));
    const rc = await capped.tools.get("web_search").execute({ queries: ["x", "y", "z"] }, EXEC);
    expect(rc.sources.length).toBe(2);
    expect(rc.truncated).toBe(true);
  });

  test("nhánh lỗi tham số khớp: rỗng · vượt trần · chuỗi trắng · sai kiểu", async () => {
    const a = await boot(stock, makeWeb());
    const b = await boot(oursAny, makeWeb());
    for (const args of [{ queries: [] }, { queries: ["a", "b", "c", "d", "e"] }, { queries: ["  "] }, { queries: "x" }, {}, { queries: [1] }]) {
      expect(await trace(() => b.tools.get("web_search").execute(args, EXEC))).toBe(await trace(() => a.tools.get("web_search").execute(args, EXEC)));
    }
    const one = await boot(oursAny, makeWeb(), oursAny.Config({ searchMaxQueries: 1 }));
    expect(await trace(() => one.tools.get("web_search").execute({ queries: ["a", "b"] }, EXEC))).toBe(
      JSON.stringify({ error: { name: "Error", message: "queries must contain at most 1 query" } }),
    );
  });

  test("lỗi provider lan truyền và huỷ lượt anh em khớp (gồm cả nhật ký gọi seam)", async () => {
    const webA = makeWeb("fail");
    const webB = makeWeb("fail");
    const a = await boot(stock, webA);
    const b = await boot(oursAny, webB);
    const failureA = await trace(() => a.tools.get("web_search").execute({ queries: ["a", "boom"] }, EXEC));
    const failureB = await trace(() => b.tools.get("web_search").execute({ queries: ["a", "boom"] }, EXEC));
    expect(failureB).toBe(failureA);
    expect(failureB).toBe(JSON.stringify({ error: { name: "Error", message: "provider exploded" } }));
    expect(webB.log).toEqual(webA.log);
    expect(webB.log.length).toBe(2);
  });
});

describe("tool-web — thi hành web_fetch và render", () => {
  test("execute web_fetch khớp (kể cả nhánh lỗi url trắng/sai kiểu/thiếu)", async () => {
    const a = await boot(stock, makeWeb());
    const b = await boot(oursAny, makeWeb());
    expect(await b.tools.get("web_fetch").execute(FETCH_ARGS, EXEC)).toEqual(await a.tools.get("web_fetch").execute(FETCH_ARGS, EXEC));
    for (const args of [{ url: "  " }, { url: 5 }, {}]) {
      expect(await trace(() => b.tools.get("web_fetch").execute(args, EXEC))).toBe(await trace(() => a.tools.get("web_fetch").execute(args, EXEC)));
    }
  });

  test("formatFetchOutput: thân text khớp ở MỌI mức trần (200000 · 1000 · 200 · 100 · 77 · 40)", () => {
    const value = { url: "https://e/p", statusCode: 200, body: { kind: "text", content: "BODY" }, truncated: false };
    const long = { url: "https://e/p", statusCode: 404, body: { kind: "text", content: "x".repeat(5000) }, truncated: false };
    for (const cap of [200000, 1000, 200, 100, 77, 40]) {
      expect(oursAny.formatFetchOutput(value, cap)).toBe(stock.formatFetchOutput(value, cap));
      expect(oursAny.formatFetchOutput(long, cap)).toBe(stock.formatFetchOutput(long, cap));
      expect(oursAny.fetchMetaFromValue(long, cap)).toEqual(stock.fetchMetaFromValue(long, cap));
    }
    expect(oursAny.formatFetchOutput({ ...value, truncated: true }, 200000)).toBe(stock.formatFetchOutput({ ...value, truncated: true }, 200000));
  });

  test("formatFetchOutput: HTML khớp cho heading · danh sách · bảng · nội dung ẩn", () => {
    const bodies = [
      "<h1>T</h1><p>Hello <strong>w</strong> and <em>e</em></p>",
      '<div style="display:none">x</div><ul><li>one</li><li>two</li></ul>',
      "<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>",
      "<table><tr><th>a</th></tr><tr><td><ul><li>x</li></ul></td></tr></table>",
      '<p>see <a href="/x" title="T">link</a></p><pre><code class="language-js">const x = 1;\n</code></pre>',
    ];
    for (const content of bodies) {
      const value = { url: "https://e/p", statusCode: 200, body: { kind: "html", content }, truncated: false };
      expect(oursAny.formatFetchOutput(value, 200000)).toBe(stock.formatFetchOutput(value, 200000));
    }
  });

  test("trần độ sâu 512: HTML lồng quá sâu bị BỎ như bản gốc", () => {
    const deep = "<div>".repeat(513) + "x" + "</div>".repeat(513);
    const value = { url: "https://e/p", statusCode: 200, body: { kind: "html", content: deep }, truncated: false };
    expect(oursAny.formatFetchOutput(value, 200000)).toBe(stock.formatFetchOutput(value, 200000));
    expect(oursAny.formatFetchOutput(value, 200000)).toContain("[HTML content omitted: unable to convert safely.]");
    const shallow = { ...value, body: { kind: "html", content: "<div>".repeat(12) + "x" + "</div>".repeat(12) } };
    expect(oursAny.formatFetchOutput(shallow, 200000)).toBe(stock.formatFetchOutput(shallow, 200000));
  });
});

describe("tool-web — metadata trình bày", () => {
  test("searchMetaFromValue và formatSearchOutput khớp", () => {
    const values = [
      { sources: [], truncated: false },
      { content: "c", sources: [{ url: "u", title: "t" }, { url: "u2", snippet: "s", publishedAt: "2024" }], truncated: true },
      { sources: [{ url: "u", title: undefined }], truncated: false },
    ];
    for (const value of values) {
      expect(oursAny.searchMetaFromValue(value)).toEqual(stock.searchMetaFromValue(value));
      expect(oursAny.formatSearchOutput(value)).toBe(stock.formatSearchOutput(value));
    }
    expect(oursAny.formatSearchOutput({ sources: [], truncated: false })).toContain("No results found.");
  });

  test("searchMetaFromResult: thu hẹp phòng vệ khớp với metadata hợp lệ và metadata hỏng", () => {
    const metas = [
      undefined,
      null,
      {},
      { sources: [] },
      { sources: [], truncated: true },
      { sources: [{ url: 1 }], truncated: true },
      { sources: [], truncated: "x" },
      { sources: [], truncated: true, answer: 5 },
      { sources: [], truncated: true, answer: "a" },
      { sources: [{ url: "u", title: 7 }], truncated: false },
    ];
    for (const meta of metas) expect(oursAny.searchMetaFromResult(meta)).toEqual(stock.searchMetaFromResult(meta));
  });

  test("fetchMetaFromValue (cờ cắt HIỆU LỰC) và fetchMetaFromResult khớp", () => {
    const value = { url: "https://e/p", statusCode: 200, body: { kind: "text", content: "x".repeat(5000) }, truncated: false };
    for (const cap of [200000, 500, 77]) expect(oursAny.fetchMetaFromValue(value, cap)).toEqual(stock.fetchMetaFromValue(value, cap));
    const metas = [undefined, null, {}, { url: 1, statusCode: 200, truncated: false }, { url: "u", statusCode: "200", truncated: false }, { url: "u", statusCode: 200, truncated: 1 }, { url: "u", statusCode: 200, truncated: false }];
    for (const meta of metas) expect(oursAny.fetchMetaFromResult(meta)).toEqual(stock.fetchMetaFromResult(meta));
  });

  test("presentCall và presentResult (cả nhánh lỗi/meta hỏng) khớp", async () => {
    const a = await boot(stock, makeWeb());
    const b = await boot(oursAny, makeWeb());
    expect(b.tools.get("web_search").presentCall({ queries: ["a", "b"] })).toEqual(a.tools.get("web_search").presentCall({ queries: ["a", "b"] }));
    expect(b.tools.get("web_fetch").presentCall(FETCH_ARGS)).toEqual(a.tools.get("web_fetch").presentCall(FETCH_ARGS));
    const errorResult = { content: [], isError: true, meta: {} };
    expect(b.tools.get("web_search").presentResult({ queries: ["a"] }, errorResult)).toBeUndefined();
    expect(b.tools.get("web_fetch").presentResult(FETCH_ARGS, errorResult)).toBeUndefined();
    expect(b.tools.get("web_search").presentResult({ queries: ["a"] }, { content: [], isError: false, meta: { sources: 5 } })).toEqual(
      a.tools.get("web_search").presentResult({ queries: ["a"] }, { content: [], isError: false, meta: { sources: 5 } }),
    );
    expect(b.tools.get("web_fetch").presentResult(FETCH_ARGS, { content: [], isError: false })).toEqual(
      a.tools.get("web_fetch").presentResult(FETCH_ARGS, { content: [], isError: false }),
    );
  });
});

describe("tool-web — apply(config)", () => {
  test("tổ hợp bật/tắt search và fetch khớp bản gốc", async () => {
    for (const config of [{ search: false }, { fetch: false }, { search: false, fetch: false }, { searchMaxResults: 3, searchMaxQueries: 1 }]) {
      const a = await boot(stock, makeWeb(), stock.Config(config));
      const b = await boot(oursAny, makeWeb(), oursAny.Config(config));
      expect(b.calls).toEqual(a.calls);
      expect(b.tools.get("web_search")?.parameters).toEqual(a.tools.get("web_search")?.parameters);
    }
  });

  test("trường số không hợp lệ ném CÙNG thông điệp như bản gốc", async () => {
    for (const config of [{ search: true }, { searchMaxResults: 0 }, { fetchTimeoutMs: 1.5 }, { searchMaxQueries: -1 }, { fetchMaxOutputChars: "x" }]) {
      expect(await trace(() => oursAny.apply(makeContext(makeWeb()).ctx, config))).toBe(await trace(() => stock.apply(makeContext(makeWeb()).ctx, config)));
    }
    expect(await trace(() => oursAny.apply(makeContext(makeWeb()).ctx, { searchMaxResults: 0 }))).toBe(
      JSON.stringify({ error: { name: "Error", message: "tool-web: searchMaxResults must be a positive integer" } }),
    );
  });
});

describe("tool-web — gói tự chứa và manifest", () => {
  test("nguồn chỉ nạp peer đã khai (không turndown/schemastery, không API mạng)", async () => {
    const source = (await readFile(join(PKG, "src", "index.ts"), "utf8")) + (await readFile(join(PKG, "src", "web-support.ts"), "utf8"));
    const specifiers = [...source.matchAll(/^import .* from "([^"]+)";$/gm)]
      .map((match) => match[1])
      .filter((value): value is string => value !== undefined);
    const allowed = ["@deepseek-ai/cordis", "@deepseek-ai/dsh-tools", "@deepseek-ai/dsh-web", "@deepseek-ai/dsh-system-prompt", "./web-support.ts"];
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(allowed).toContain(specifier);
    expect(specifiers).not.toContain("turndown");
    expect(specifiers).not.toContain("@joplin/turndown-plugin-gfm");
    expect(specifiers).not.toContain("@deepseek-ai/schemastery");
    expect(source.includes("globalThis.fetch")).toBe(false);
    expect(source.includes("node:http")).toBe(false);
    expect(source.includes("node:https")).toBe(false);
  });

  test("manifest đúng tên gói, entry ESM và nối test vào metadata gbh", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-host-tool-web");
    expect(manifest.main).toBe("lib/index.js");
    expect(manifest.exports["."].default).toBe("./lib/index.js");
    expect(manifest.gbh.row.tests).toContain("tests/host/tool-web.test.ts");
    // Metadata mount (gbh.nested/gbh.row) do Lead quyết theo ADR 0007; test KHÔNG khoá hình dạng đó.
    expect(typeof manifest.gbh).toBe("object");
  });
});
