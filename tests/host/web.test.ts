/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-web: đo trên ARTIFACT đã build, và so TỪNG hành vi
 *      với CHÍNH bundle gốc của DSH (chọn provider · biên maxResults · kết quả fetch · đăng ký · env)
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import Ours from "../../packages/host/web/src/index.ts";
import { buildPackage } from "../../packages/host/web/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "web");
/** cordis mà package ta nạp (symlink sang bản của apps/host — cùng MỘT thể hiện kernel). */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web", "lib", "index.js");
/** cordis mà chính bundle gốc nạp. */
const STOCK_CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** HarnessError của KERNEL cấp (peer dsh-llm) — để kiểm `instanceof` ở ranh giới gói. */
const LLM = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-llm", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Một provider tìm kiếm giả: đủ `id` + `available()` + `search()` như hợp đồng thật. */
interface FakeSearch {
  /** Khoá sổ đăng ký. */
  readonly id: string;
  /** Cờ dùng được trả về nguyên giá trị. */
  readonly usable: boolean;
  /** URL của các nguồn provider trả về. */
  readonly urls: readonly string[];
  /** Chữ trả lời/tóm tắt tuỳ chọn. */
  readonly content?: string;
}

/**
 * Dựng provider tìm kiếm từ mô tả.
 * Nhận: mô tả provider (id · cờ dùng được · danh sách URL · chữ tuỳ chọn).
 * Trả: object có ĐÚNG hình dạng `WebSearchProvider` và ghi lại yêu cầu nhận được.
 */
function makeSearch(spec: FakeSearch): any {
  const seen: any[] = [];
  return {
    id: spec.id,
    available: () => spec.usable,
    seen,
    search: async (request: any, signal?: AbortSignal) => {
      seen.push({ query: request.query, maxResults: request.maxResults, cancelled: signal?.aborted ?? null });
      return {
        ...(spec.content === undefined ? {} : { content: spec.content }),
        sources: spec.urls.map((url) => ({ url })),
        truncated: false,
      };
    },
  };
}

/**
 * Dựng provider tải về từ mô tả.
 * Nhận: mô tả provider (id · cờ dùng được · mã trạng thái · thân trả về).
 * Trả: object có ĐÚNG hình dạng `WebFetchProvider` và ghi lại yêu cầu nhận được.
 */
function makeFetch(spec: { id: string; usable: boolean; statusCode: number; content: string; kind: "html" | "text" }): any {
  const seen: any[] = [];
  return {
    id: spec.id,
    available: () => spec.usable,
    seen,
    fetch: async (request: any, signal?: AbortSignal) => {
      seen.push({ url: request.url, cancelled: signal?.aborted ?? null });
      return { url: request.url, statusCode: spec.statusCode, body: { kind: spec.kind, content: spec.content }, truncated: false };
    },
  };
}

/**
 * Dựng plugin trên một Context cordis THẬT rồi lấy service `web`.
 * Nhận: lớp plugin, lớp Context của đúng bản cordis mà plugin nạp, và cấu hình.
 * Trả: context và thể hiện service (có thể `undefined` khi fiber hỏng).
 */
async function boot(plugin: any, ContextCtor: any, config: Record<string, unknown> = {}): Promise<{ ctx: any; svc: any }> {
  const ctx = new ContextCtor();
  ctx.plugin(plugin, config);
  await new Promise((resolve) => setTimeout(resolve, 5));
  return { ctx, svc: ctx.get("web") };
}

/**
 * Nạp ba thứ cần cho một phép so: plugin của ta, plugin gốc, và hai lớp Context.
 * Nhận: không.
 * Trả: bộ bốn giá trị (ta · gốc · Context ta · Context gốc) — cả hai Context là CÙNG một lớp kernel.
 */
async function loadBoth(): Promise<{ ours: any; theirs: any; ourCtx: any; theirCtx: any }> {
  const ourCordis: any = await import(OUR_CORDIS);
  const stockCordis: any = await import(STOCK_CORDIS);
  const stockMod: any = await import(STOCK);
  return { ours: Ours, theirs: stockMod.default, ourCtx: ourCordis.Context, theirCtx: stockCordis.Context };
}

/**
 * Chạy MỘT kịch bản trên một thể hiện service rồi ghi lại kết quả hoặc lỗi dưới dạng chuỗi so được.
 * Nhận: plugin, lớp Context, cấu hình, hàm dựng provider, và phép gọi cần đo.
 * Trả: JSON `{ ok }` hoặc `{ error: { name, code, message } }` — dùng để so hai bên TỪNG CHỮ.
 */
async function trace(
  plugin: any,
  ContextCtor: any,
  config: Record<string, unknown>,
  setup: (svc: any) => void,
  op: (svc: any) => Promise<unknown>,
): Promise<string> {
  const { svc } = await boot(plugin, ContextCtor, config);
  setup(svc);
  try {
    return JSON.stringify({ ok: await op(svc) });
  } catch (error: any) {
    return JSON.stringify({ error: { name: error?.name, code: error?.code, message: error?.message } });
  }
}

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row web — artifact và bề mặt", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, 0 id @deepseek-ai, chung lớp nền kernel", async () => {
    const file = await buildPackage(OUT);
    // LƯỢT ĐO 01/11/2026: peer của artifact phải phân giải về KERNEL — `PKG/node_modules` là bản SAO
    // workspace (mô-đun khác) nên `WebError` không kế thừa đúng `HarnessError` của kernel.
    mkdirSync(join(OUT, "node_modules"), { recursive: true });
    symlinkSync(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), join(OUT, "node_modules", "@deepseek-ai"), "dir");
    // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
    // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
    symlinkSync(join(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");
    const code = await readFile(file, "utf8");
    // Nửa host KHÔNG đăng ký id module nào (row MỘT MẶT — `lib/client.js` không tồn tại).
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact: any = await import(file);
    const stock: any = await import(STOCK);
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual(["WebError", "WebRuntime", "default"]);
    // Hai bản cài khác nhau nên lớp khác đối tượng; điều phải khớp là HÌNH DẠNG và quan hệ default.
    expect(artifact.default).toBe(artifact.WebRuntime);
    expect(stock.default).toBe(stock.WebRuntime);
    expect(stock.default.name).toBe(artifact.WebRuntime.name);
    expect(Object.getOwnPropertyNames(artifact.WebRuntime.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.WebRuntime.prototype).sort(),
    );
    expect(String(artifact.WebRuntime.Config)).toBe(String(stock.WebRuntime.Config));
    // WebError của CẢ HAI kế thừa CÙNG một lớp HarnessError của kernel ⇒ consumer bắt bằng HarnessError được.
    const llm: any = await import(LLM);
    expect(Object.getPrototypeOf(artifact.WebError)).toBe(llm.HarnessError);
    expect(Object.getPrototypeOf(stock.WebError)).toBe(llm.HarnessError);
    const error = new artifact.WebError("x", "WEB_X");
    expect(error instanceof llm.HarnessError).toBe(true);
    expect(error.code).toBe("WEB_X");
    expect(error.name).toBe("WebError");
    expect(new stock.WebError("x", "WEB_X").name).toBe("WebError");
  });
});

describe("row web — hành vi đối chứng với chính bundle gốc", () => {
  test("chọn provider: 6 ca (cấu hình/thiếu/không dùng được/một/nhoè/không có) khớp mã lỗi + thông điệp", async () => {
    const { ours, theirs, ourCtx, theirCtx } = await loadBoth();
    /** Sáu kịch bản: [nhãn, cấu hình, cách dựng provider] — cùng một phép gọi `search`. */
    const cases: [string, Record<string, unknown>, (svc: any) => void][] = [
      ["configured-registered", { searchProvider: "alpha" }, (svc) => { svc.registerSearchProvider(makeSearch({ id: "alpha", usable: true, urls: ["https://a/1"], content: "A" })); svc.registerSearchProvider(makeSearch({ id: "beta", usable: true, urls: ["https://b/1"] })); }],
      ["configured-missing", { searchProvider: "ghost" }, (svc) => { svc.registerSearchProvider(makeSearch({ id: "alpha", usable: true, urls: ["https://a/1"] })); }],
      ["configured-unavailable", { searchProvider: "alpha" }, (svc) => { svc.registerSearchProvider(makeSearch({ id: "alpha", usable: false, urls: [] })); }],
      ["auto-single", {}, (svc) => { svc.registerSearchProvider(makeSearch({ id: "alpha", usable: false, urls: [] })); svc.registerSearchProvider(makeSearch({ id: "beta", usable: true, urls: ["https://b/1", "https://b/2"] })); }],
      ["auto-ambiguous", {}, (svc) => { svc.registerSearchProvider(makeSearch({ id: "alpha", usable: true, urls: [] })); svc.registerSearchProvider(makeSearch({ id: "beta", usable: true, urls: [] })); }],
      ["auto-unavailable", {}, (svc) => { svc.registerSearchProvider(makeSearch({ id: "alpha", usable: false, urls: [] })); }],
    ];
    for (const [label, config, setup] of cases) {
      const mine = await trace(ours, ourCtx, config, setup, (svc) => svc.search({ query: "q", maxResults: 5 }));
      const stock = await trace(theirs, theirCtx, config, setup, (svc) => svc.search({ query: "q", maxResults: 5 }));
      expect([label, mine]).toEqual([label, stock]);
    }
    // Ba mã lỗi phải ĐÚNG chữ của bản gốc, không chỉ khớp nhau.
    const missing = JSON.parse(await trace(ours, ourCtx, { searchProvider: "ghost" }, () => {}, (svc) => svc.search({ query: "q" })));
    expect(missing.error.code).toBe("WEB_PROVIDER_CONFIGURED_MISSING");
    expect(missing.error.message).toBe('configured web provider "ghost" is not registered');
    const ambiguous = JSON.parse(await trace(ours, ourCtx, {}, (svc) => {
      svc.registerSearchProvider(makeSearch({ id: "alpha", usable: true, urls: [] }));
      svc.registerSearchProvider(makeSearch({ id: "beta", usable: true, urls: [] }));
    }, (svc) => svc.search({ query: "q" })));
    expect(ambiguous.error.code).toBe("WEB_PROVIDER_AMBIGUOUS");
    expect(ambiguous.error.message).toBe('multiple usable web providers are registered (alpha, beta); configure one explicitly');
  });

  test("biên maxResults: 4 ca (vắng · bằng · nhỏ hơn · lớn hơn) khớp gốc và KHÔNG sửa kết quả gốc", async () => {
    const { ours, theirs, ourCtx, theirCtx } = await loadBoth();
    const urls = ["https://a/1", "https://a/2", "https://a/3"];
    const setup = (svc: any): void => {
      svc.registerSearchProvider(makeSearch({ id: "alpha", usable: true, urls, content: "tom tat" }));
    };
    for (const maxResults of [undefined, 3, 1, 0, 9]) {
      const mine = await trace(ours, ourCtx, {}, setup, (svc) => svc.search(maxResults === undefined ? { query: "q" } : { query: "q", maxResults }));
      const stock = await trace(theirs, theirCtx, {}, setup, (svc) => svc.search(maxResults === undefined ? { query: "q" } : { query: "q", maxResults }));
      expect([maxResults, mine]).toEqual([maxResults, stock]);
    }
    // Hợp đồng: cắt ⇒ object MỚI + `truncated: true`; không cắt ⇒ CHÍNH object provider trả về.
    const { svc } = await boot(ours, ourCtx);
    const provider = makeSearch({ id: "alpha", usable: true, urls, content: "tom tat" });
    svc.registerSearchProvider(provider);
    const wide = await svc.search({ query: "q" });
    expect(wide.sources.length).toBe(3);
    expect(wide.truncated).toBe(false);
    const cut = await svc.search({ query: "q", maxResults: 2 });
    expect(cut.sources.map((source: any) => source.url)).toEqual(["https://a/1", "https://a/2"]);
    expect(cut.truncated).toBe(true);
    expect(cut).not.toBe(wide);
    expect(wide.sources.length).toBe(3);
    // Thứ tự đăng ký KHÔNG được đổi kết quả: đăng ký ngược lại vẫn chọn đúng provider đã cấu hình.
    const reversed = await boot(theirs, theirCtx, { searchProvider: "beta" });
    reversed.svc.registerSearchProvider(makeSearch({ id: "beta", usable: true, urls: ["https://b/1"] }));
    reversed.svc.registerSearchProvider(makeSearch({ id: "alpha", usable: true, urls: ["https://a/1"] }));
    const oursReversed = await boot(ours, ourCtx, { searchProvider: "beta" });
    oursReversed.svc.registerSearchProvider(makeSearch({ id: "beta", usable: true, urls: ["https://b/1"] }));
    oursReversed.svc.registerSearchProvider(makeSearch({ id: "alpha", usable: true, urls: ["https://a/1"] }));
    expect(JSON.stringify(await oursReversed.svc.search({ query: "q" }))).toBe(JSON.stringify(await reversed.svc.search({ query: "q" })));
  });

  test("fetch: ngoài 2xx là KẾT QUẢ (không ném) và thân đi qua nguyên vẹn từng ký tự", async () => {
    const { ours, theirs, ourCtx, theirCtx } = await loadBoth();
    const body = '{"tiếng Việt": "ữ ế ỡ", "html": "<p>x</p>"}';
    const setup = (svc: any): void => {
      svc.registerFetchProvider(makeFetch({ id: "http", usable: true, statusCode: 404, content: body, kind: "text" }));
    };
    const mine = await trace(ours, ourCtx, {}, setup, (svc) => svc.fetch({ url: "https://example.test/x" }));
    const stock = await trace(theirs, theirCtx, {}, setup, (svc) => svc.fetch({ url: "https://example.test/x" }));
    expect(mine).toBe(stock);
    expect(JSON.parse(mine).ok).toEqual({
      url: "https://example.test/x",
      statusCode: 404,
      body: { kind: "text", content: body },
      truncated: false,
    });
    // Cùng mã lỗi cho provider tải về đã cấu hình nhưng chưa đăng ký.
    const missing = await trace(ours, ourCtx, { fetchProvider: "ghost" }, () => {}, (svc) => svc.fetch({ url: "https://example.test/x" }));
    const stockMissing = await trace(theirs, theirCtx, { fetchProvider: "ghost" }, () => {}, (svc) => svc.fetch({ url: "https://example.test/x" }));
    expect(missing).toBe(stockMissing);
    expect(JSON.parse(missing).error.message).toBe('configured web provider "ghost" is not registered');
  });

  test("đăng ký: id trùng · gỡ theo disposer · hai sổ độc lập — khớp gốc từng thông điệp", async () => {
    const { ours, theirs, ourCtx, theirCtx } = await loadBoth();
    /** Một kịch bản đăng ký đầy đủ, ghi lại vết dưới dạng chuỗi. */
    const scenario = async (plugin: any, ContextCtor: any): Promise<string> => {
      const { svc } = await boot(plugin, ContextCtor);
      const log: unknown[] = [];
      const alpha = makeSearch({ id: "alpha", usable: true, urls: ["https://a/1"] });
      const dispose = svc.registerSearchProvider(alpha);
      try {
        svc.registerSearchProvider(makeSearch({ id: "alpha", usable: true, urls: [] }));
        log.push("khong nem");
      } catch (error: any) {
        log.push({ name: error?.name, code: error?.code, message: error?.message });
      }
      // `fetch` là sổ RIÊNG: cùng id `alpha` phải đăng ký được.
      svc.registerFetchProvider(makeFetch({ id: "alpha", usable: true, statusCode: 200, content: "ok", kind: "text" }));
      log.push(await svc.fetch({ url: "https://example.test/a" }));
      // Gỡ provider tìm kiếm ⇒ lượt gọi sau rơi về "không có provider dùng được".
      dispose();
      try {
        log.push(await svc.search({ query: "q" }));
      } catch (error: any) {
        log.push({ name: error?.name, code: error?.code, message: error?.message });
      }
      log.push(await svc.fetch({ url: "https://example.test/b" }));
      return JSON.stringify(log);
    };
    expect(await scenario(ours, ourCtx)).toBe(await scenario(theirs, theirCtx));
    const parsed = JSON.parse(await scenario(ours, ourCtx));
    expect(parsed[0]).toEqual({
      name: "WebError",
      code: "WEB_DUPLICATE_PROVIDER",
      message: 'a web provider with id "alpha" is already registered',
    });
    expect(parsed[2].code).toBe("WEB_PROVIDER_UNAVAILABLE");
    expect(parsed[2].message).toBe("no usable web provider is registered");
  });

  test("biến môi trường là nguồn DỰ PHÒNG (Config thắng env) — cùng luật với gốc", async () => {
    const { ours, theirs, ourCtx, theirCtx } = await loadBoth();
    const setup = (svc: any): void => {
      svc.registerSearchProvider(makeSearch({ id: "alpha", usable: true, urls: ["https://a/1"] }));
      svc.registerSearchProvider(makeSearch({ id: "beta", usable: true, urls: ["https://b/1"] }));
    };
    const previous = process.env.DSH_WEB_SEARCH_PROVIDER;
    try {
      process.env.DSH_WEB_SEARCH_PROVIDER = "beta";
      const fromEnvOurs = await trace(ours, ourCtx, {}, setup, (svc) => svc.search({ query: "q" }));
      const fromEnvStock = await trace(theirs, theirCtx, {}, setup, (svc) => svc.search({ query: "q" }));
      expect(fromEnvOurs).toBe(fromEnvStock);
      expect(JSON.parse(fromEnvOurs).ok.sources.map((source: any) => source.url)).toEqual(["https://b/1"]);
      const configWinsOurs = await trace(ours, ourCtx, { searchProvider: "alpha" }, setup, (svc) => svc.search({ query: "q" }));
      const configWinsStock = await trace(theirs, theirCtx, { searchProvider: "alpha" }, setup, (svc) => svc.search({ query: "q" }));
      expect(configWinsOurs).toBe(configWinsStock);
      expect(JSON.parse(configWinsOurs).ok.sources.map((source: any) => source.url)).toEqual(["https://a/1"]);
    } finally {
      if (previous === undefined) delete process.env.DSH_WEB_SEARCH_PROVIDER;
      else process.env.DSH_WEB_SEARCH_PROVIDER = previous;
    }
  });
});

describe("row web — hợp đồng metadata của gói", () => {
  test("gbh.peers ⊆ peerDependencies (so PHẦN TỬ) + ĐỐI CHỨNG ÂM", async () => {
    const json = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    const peers: string[] = json.gbh.peers;
    const declared: string[] = Object.keys(json.peerDependencies);
    const missing = (peerList: string[], depList: string[]): string[] =>
      [...new Set(peerList)].filter((name) => !new Set(depList).has(name)).sort();
    // PHÉP CHÍNH: so PHẦN TỬ, không so số lượng.
    expect(missing(peers, declared)).toEqual([]);
    // ĐỐI CHỨNG ÂM 1: bỏ MỘT tên khỏi peerDependencies ⇒ phép kiểm phải THẤY.
    expect(missing(peers, declared.filter((name) => name !== peers[0]))).toEqual([peers[0]!]);
    // ĐỐI CHỨNG ÂM 2: peerDependencies rỗng ⇒ MỌI tên đều thiếu (phép kiểm không im lặng bỏ qua).
    expect(missing(peers, [])).toEqual([...peers].sort());
    // ĐỐI CHỨNG ÂM 3: THỪA tên trong peerDependencies KHÔNG làm phép kiểm đỏ (đây là quan hệ ⊆, không phải =).
    expect(missing(peers, [...declared, "@deepseek-ai/dsh-thua"])).toEqual([]);
    // Và peer phải là peerDependencies, KHÔNG nằm ở dependencies (sẽ tạo thể hiện thứ hai).
    expect(Object.keys(json.dependencies ?? {})).toEqual([]);
  });

  });

describe("row web — C6: vật thể của hai thực thể phải ĐỘC LẬP (kiểm bằng DANH TÍNH)", () => {
  test("hai thể hiện service có sổ RIÊNG; đăng ký bên này không lan sang bên kia", async () => {
    const { ours, ourCtx } = await loadBoth();
    const a = await boot(ours, ourCtx, { searchProvider: "alpha" });
    const b = await boot(ours, ourCtx, { searchProvider: "alpha" });
    expect(a.svc).not.toBe(b.svc);
    // DANH TÍNH, không phải giá trị: hai Map rỗng trông GIỐNG nhau nhưng phải là HAI vật khác nhau.
    expect(a.svc.searchProviders).not.toBe(b.svc.searchProviders);
    expect(a.svc.fetchProviders).not.toBe(b.svc.fetchProviders);
    expect(a.svc.searchProviders).not.toBe(b.svc.fetchProviders);
    a.svc.registerSearchProvider(makeSearch({ id: "alpha", usable: true, urls: ["https://a/1"] }));
    expect(a.svc.searchProviders.has("alpha")).toBe(true);
    expect(b.svc.searchProviders.has("alpha")).toBe(false);
    let failed: any;
    try {
      await b.svc.search({ query: "q" });
    } catch (error: any) {
      failed = error;
    }
    expect(failed.code).toBe("WEB_PROVIDER_CONFIGURED_MISSING");
    // Id đã ghim cũng là trạng thái RIÊNG của từng thể hiện.
    expect(a.svc.searchProviderId).toBe("alpha");
    const c = await boot(ours, ourCtx, { fetchProvider: "http" });
    expect(c.svc.fetchProviderId).toBe("http");
    expect(a.svc.fetchProviderId).toBeUndefined();
  });
});
