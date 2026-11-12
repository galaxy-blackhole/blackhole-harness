/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test goi THU VIEN llm-deepseek-adapter: ban ghep TRUNG TUNG BYTE bundle goc, be mat export trung,
 *      hang so + ham thuan + schema A/B voi chinh bundle goc (khong chep code mu — do bang so)
 */
import { describe, expect, test } from "bun:test";
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle, stripSliceScaffold } from "../../packages/host/llm-deepseek-adapter/src/assemble.ts";
import { MODULE_TAIL, PART_FILES, PACKAGE_NAME, SLICE_MARKER, STOCK_BUNDLE } from "../../packages/host/llm-deepseek-adapter/src/manifest.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "llm-deepseek-adapter");
/** Bundle GỐC trong kernel (CHỈ ĐỌC — nguồn đối chiếu). */
const STOCK = join(REPO, STOCK_BUNDLE);
/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK, "utf8");

/** Bề mặt module (chỉ cần gọi động). */
type Api = Record<string, unknown>;

/** Nạp module của ta (artefact đã build). */
const ours = (await import(join(PKG, "lib", "index.js"))) as Api;
/** Nạp bundle GỐC để A/B. */
const stock = (await import(STOCK)) as Api;

describe("artefact: bản port NGUYÊN VĂN TỪNG BYTE", () => {
  test("lib/index.js TRÙNG TỪNG BYTE bundle gốc (cùng độ dài, cùng chuỗi)", () => {
    const built = readFileSync(join(PKG, "lib", "index.js"), "utf8");
    // 05/11/2026 (P1b): artefact mang id CUA TA ⇒ so tren DANG DA CHUAN HOA id.
    const builtChuan = chuanHoaHost(built);
    expect(builtChuan.length).toBe(STOCK_TEXT.length);
    expect(builtChuan).toBe(STOCK_TEXT);
  });

  test("ghép lại 23 lát cho ĐÚNG văn bản gốc (assembleBundle)", () => {
    expect(assembleBundle()).toBe(STOCK_TEXT);
  });

  test("23 lát đủ header + dấu lát + dòng kết thúc, và manifest khớp thư mục thật", () => {
    const files = readdirSync(join(PKG, "src", "parts")).sort();
    expect(files).toEqual([...PART_FILES].sort());
    expect(PART_FILES).toHaveLength(23);
    for (const fileName of PART_FILES) {
      const text = readFileSync(join(PKG, "src", "parts", fileName), "utf8");
      expect(text).toContain("author Bùi Trọng Hiếu");
      expect(text).toContain(SLICE_MARKER);
      expect(text.trimEnd().endsWith(MODULE_TAIL)).toBe(true);
      // Bỏ giao kèo xong phải KHÔNG còn dấu vết của header/marker trong phần thân.
      const body = stripSliceScaffold(text, fileName).join("\n");
      expect(body).not.toContain(SLICE_MARKER);
      expect(body).not.toContain("author Bùi Trọng Hiếu");
    }
  });

  test("id PACKAGE_NAME là tên MỚI (không trùng gói gbh-llm-deepseek đã có)", () => {
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-llm-deepseek-adapter");
    expect(PACKAGE_NAME).not.toBe("@galaxy-blackhole/gbh-llm-deepseek");
  });
});

describe("bề mặt export: TRÙNG bản gốc", () => {
  test("cùng 41 tên export", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours)).toHaveLength(41);
  });

  test("mỗi tên cùng LOẠI giá trị (function/object/...) như bản gốc", () => {
    for (const key of Object.keys(stock)) {
      expect(typeof ours[key]).toBe(typeof stock[key]);
    }
  });
});

describe("hằng số A/B", () => {
  /** Mọi hằng số DEFAULTS của bản gốc. */
  const DEFAULT_KEYS = [
    "DEFAULT_CONTEXT_WINDOW",
    "DEFAULT_FILE_EXPIRY_SECONDS",
    "DEFAULT_FILE_QUOTA_CLEANUP_BATCH",
    "DEFAULT_FILE_REFRESH_MARGIN_SECONDS",
    "DEFAULT_FILES_API_TIMEOUT_MS",
    "DEFAULT_IMAGE_OFFLOAD_BYTE_QUANTUM",
    "DEFAULT_IMAGE_OFFLOAD_COUNT_QUANTUM",
    "DEFAULT_INLINE_IMAGE_OFFLOAD_BYTE_QUANTUM",
    "DEFAULT_MAX_INLINE_REQUEST_IMAGE_BYTES",
    "DEFAULT_MAX_TOKENS",
    "DEFAULT_STREAM_IDLE_TIMEOUT_MS",
  ];
  /** Mọi hằng số giới hạn tệp/ảnh của bản gốc. */
  const LIMIT_KEYS = [
    "MAX_FILE_EXPIRY_SECONDS",
    "MAX_FILE_UPLOAD_BYTES",
    "MAX_IMAGE_BYTES",
    "MAX_STORED_FILE_BYTES",
    "MAX_STORED_FILE_COUNT",
    "MIN_FILE_EXPIRY_SECONDS",
    "REQUEST_IMAGE_MAX_DIMENSION",
    "DEFAULT_LOW_DETAIL_IMAGE_PIXEL_BUDGET",
    "DEFAULT_MAX_IMAGES_PER_REQUEST",
    "DEFAULT_MAX_REQUEST_FILES_BYTES",
    "DEFAULT_REQUEST_IMAGE_MAX_BYTES",
  ];

  test("11 hằng số DEFAULTS trùng giá trị", () => {
    for (const key of DEFAULT_KEYS) expect(ours[key]).toBe(stock[key]);
  });

  test("11 hằng số GIỚI HẠN trùng giá trị", () => {
    for (const key of LIMIT_KEYS) expect(ours[key]).toBe(stock[key]);
  });

  test("PUBLIC_BASE_URL trùng (endpoint công khai của DeepSeek Messages)", () => {
    expect(ours["PUBLIC_BASE_URL"]).toBe(stock["PUBLIC_BASE_URL"]);
    expect(ours["PUBLIC_BASE_URL"]).toBe("https://api.deepseek.com/anthropic");
  });
});

describe("hàm thuần A/B (cùng đầu vào ⇒ cùng đầu ra)", () => {
  test("deepSeekFileScope: băm namespace KHÔNG lộ credential", () => {
    const base = "https://api.deepseek.com";
    const credentials = JSON.stringify({ authorization: "Bearer sk-test" });
    expect(ours["deepSeekFileScope"]).toBeFunction();
    const call = (api: Api): unknown => (api["deepSeekFileScope"] as (a: string, b: string) => unknown)(base, credentials);
    expect(call(ours)).toBe(call(stock));
    expect(String(call(ours))).toMatch(/^[0-9a-f]{64}$/u);
    // Khác credential ⇒ khác scope (đối chứng âm).
    const other = (api: Api): unknown => (api["deepSeekFileScope"] as (a: string, b: string) => unknown)(base, "x");
    expect(other(ours)).not.toBe(call(ours));
  });

  test("DeepSeekFileId: brand id trùng giá trị", () => {
    expect((ours["DeepSeekFileId"] as (v: string) => unknown)("file-abc")).toBe((stock["DeepSeekFileId"] as (v: string) => unknown)("file-abc"));
  });

  test("deepSeekImageTokens: cùng bộ chiều ⇒ cùng số token (3 hình)", () => {
    const dims: [number, number][] = [[1024, 768], [300, 200], [2048, 2048]];
    for (const [w, h] of dims) {
      expect((ours["deepSeekImageTokens"] as (w: number, h: number) => unknown)(w, h)).toBe((stock["deepSeekImageTokens"] as (w: number, h: number) => unknown)(w, h));
    }
  });

  test("deepSeekRequestImageDimensions: cùng đầu vào ⇒ cùng hình chuẩn hoá", () => {
    const call = (api: Api): unknown => (api["deepSeekRequestImageDimensions"] as (w: number, h: number) => unknown)(4000, 3000);
    expect(call(ours)).toEqual(call(stock));
  });

  test("resolveRequestImageMaxBytes + resolveRequestImageTarget trùng", () => {
    const maxBytes = (api: Api): unknown => (api["resolveRequestImageMaxBytes"] as (v: unknown) => unknown)("low");
    expect(maxBytes(ours)).toBe(maxBytes(stock));
    const target = (api: Api): unknown => (api["resolveRequestImageTarget"] as (v: unknown, s: unknown) => unknown)({ imagePixelBudget: "low", imageMaxBytes: 1024 }, { width: 4000, height: 3000 });
    expect(target(ours)).toEqual(target(stock));
  });

  test("catalogModelInfo: thông tin model suy ra từ connection trùng", () => {
    const connection = { baseURL: "https://api.deepseek.com", models: [] };
    const call = (api: Api): unknown => (api["catalogModelInfo"] as (c: unknown, p: string, m: string) => unknown)(connection, "deepseek", "deepseek-chat");
    expect(call(ours)).toEqual(call(stock));
  });

  test("plainOptions: bóc tham chiếu volatile trùng", () => {
    const config = { baseURL: "https://x", maxTokens: 8192 };
    const call = (api: Api): unknown => (api["plainOptions"] as (c: unknown) => unknown)(config);
    expect(call(ours)).toEqual(call(stock));
  });

  test("schema: deepSeekConfigFields + catalogModelFields cùng bộ khoá", () => {
    const keys = (api: Api, name: string): string[] => Object.keys(api[name] as Record<string, unknown>).sort();
    expect(keys(ours, "deepSeekConfigFields")).toEqual(keys(stock, "deepSeekConfigFields"));
    expect(keys(ours, "catalogModelFields")).toEqual(keys(stock, "catalogModelFields"));
    // Đo được: 18 trường (không phải 13) — giữ số THẬT để lần sau ai thêm/bớt là đỏ ngay.
    expect(keys(ours, "deepSeekConfigFields").length).toBe(18);
    expect(keys(ours, "catalogModelFields").length).toBe(8);
  });

  test("Config schema: cùng mặc định khi validate rỗng", () => {
    const config = (api: Api): unknown => (api["Config"] as { "~standard"?: { validate(v: unknown): { value?: unknown } } })["~standard"]?.validate({})?.value;
    expect(JSON.stringify(config(ours))).toBe(JSON.stringify(config(stock)));
  });
});


describe("DeepSeekFilesClient A/B với fetch giả (không ra mạng)", () => {
  /** Một file object ĐÚNG hợp đồng wire của Files API. */
  const FILE_WIRE = { id: "file-abc", type: "file", mime_type: "image/png", size_bytes: 3, created_at: "2026-10-18T00:00:00Z", filename: "a.png" };

  /**
   * Dựng client của một bên với fetch giả ghi lại request.
   * @param api - bề mặt module (của ta hoặc gốc).
   * @param respond - hàm trả Response.
   * @returns cặp { client, calls }.
   */
  function makeClient(api: Api, respond: (url: string) => Response): { client: Record<string, unknown>; calls: { url: string; method: string }[] } {
    const calls: { url: string; method: string }[] = [];
    const fetchImpl = async (url: unknown, init?: { method?: string }): Promise<Response> => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      return respond(String(url));
    };
    const Ctor = api["DeepSeekFilesClient"] as new (options: Record<string, unknown>) => Record<string, unknown>;
    return { client: new Ctor({ baseURL: "https://api.deepseek.com", headers: { authorization: "Bearer sk-x" }, fetch: fetchImpl }), calls };
  }

  /**
   * Chạy upload trên một bên, trả request đã phát + kết quả.
   * @param api - bề mặt module.
   * @returns cặp { calls, result } hoặc { code, message } khi lỗi.
   */
  async function uploadOnce(api: Api, respond: (url: string) => Response): Promise<Record<string, unknown>> {
    const { client, calls } = makeClient(api, respond);
    try {
      const result = await (client["upload"] as (input: Record<string, unknown>) => Promise<unknown>)({ data: new Uint8Array([1, 2, 3]), mediaType: "image/png", filename: "a.png", expiresAfterSeconds: 3600 });
      return { calls, result };
    } catch (error) {
      const failure = error as { code?: string; message?: string };
      return { calls, code: failure.code, message: failure.message };
    }
  }

  test("upload: cùng URL/method và cùng file object trả về", async () => {
    const respond = (): Response => new Response(JSON.stringify(FILE_WIRE), { status: 200, headers: { "content-type": "application/json" } });
    const our = await uploadOnce(ours, respond);
    const their = await uploadOnce(stock, respond);
    expect(our["calls"]).toEqual(their["calls"]);
    expect(JSON.stringify(our["result"])).toBe(JSON.stringify(their["result"]));
    expect(JSON.stringify(our["result"])).toContain("file-abc");
  });

  test("lỗi HTTP 401: cùng mã AUTH + cùng thông điệp", async () => {
    const respond = (): Response => new Response(JSON.stringify({ error: { message: "bad key", type: "authentication_error" } }), { status: 401, headers: { "content-type": "application/json" } });
    const our = await uploadOnce(ours, respond);
    const their = await uploadOnce(stock, respond);
    expect(our["code"]).toBe(their["code"]);
    expect(our["message"]).toBe(their["message"]);
    expect(our["code"]).toBe("AUTH");
  });

  test("lỗi HTTP 500 ⇒ SERVER; 429 ⇒ RATE_LIMIT (hai bên như nhau)", async () => {
    const makeRespond = (status: number) => (): Response => new Response(JSON.stringify({ error: { message: "boom" } }), { status, headers: { "content-type": "application/json" } });
    for (const [status, expected] of [[500, "SERVER"], [429, "RATE_LIMIT"]] as const) {
      const our = await uploadOnce(ours, makeRespond(status));
      const their = await uploadOnce(stock, makeRespond(status));
      expect(our["code"]).toBe(their["code"]);
      expect(our["code"]).toBe(expected);
    }
  });

  test("expiry ngoài khoảng: cùng INVALID_REQUEST + cùng thông điệp (không ra mạng)", async () => {
    const respond = (): Response => new Response(JSON.stringify(FILE_WIRE), { status: 200, headers: { "content-type": "application/json" } });
    const run = async (api: Api): Promise<Record<string, unknown>> => {
      const { client, calls } = makeClient(api, respond);
      try {
        await (client["upload"] as (input: Record<string, unknown>) => Promise<unknown>)({ data: new Uint8Array([1]), mediaType: "image/png", filename: "a.png", expiresAfterSeconds: 60 });
        return { calls, code: "KHONG-NEM" };
      } catch (error) {
        const failure = error as { code?: string; message?: string };
        return { calls, code: failure.code, message: failure.message };
      }
    };
    const our = await run(ours);
    const their = await run(stock);
    expect(our["code"]).toBe(their["code"]);
    expect(our["message"]).toBe(their["message"]);
    expect(our["code"]).toBe("INVALID_REQUEST");
    // Đối chứng: lỗi tham số xảy ra TRƯỚC khi gọi mạng.
    expect(our["calls"]).toEqual([]);
  });

  test("huỷ trước khi gửi: hai bên cùng ném (không có request nào được phát)", async () => {
    const respond = (): Response => new Response(JSON.stringify(FILE_WIRE), { status: 200, headers: { "content-type": "application/json" } });
    const run = async (api: Api): Promise<string> => {
      const { client, calls } = makeClient(api, respond);
      const controller = new AbortController();
      controller.abort();
      try {
        await (client["upload"] as (input: Record<string, unknown>) => Promise<unknown>)({ data: new Uint8Array([1]), mediaType: "image/png", filename: "a.png", expiresAfterSeconds: 3600, signal: controller.signal });
        return "KHONG-NEM";
      } catch (error) {
        return String((error as { code?: string }).code ?? (error as Error).name) + "|" + String(calls.length);
      }
    };
    expect(await run(ours)).toBe(await run(stock));
  });
});

describe("DeepSeekFileStore A/B: gộp lời gọi đồng thời + chặn ảnh quá lớn", () => {
  /** Index giả trong bộ nhớ, cùng hợp đồng với DeepSeekUploadIndex. */
  function makeIndex(): Record<string, unknown> {
    const store = new Map<string, unknown>();
    return {
      get: async (scope: string, variantId: string): Promise<unknown> => store.get(scope + "|" + variantId),
      commit: async (candidate: { scope: string; variantId: string }): Promise<{ record: unknown; accepted: boolean }> => {
        const key = candidate.scope + "|" + candidate.variantId;
        const existing = store.get(key);
        if (existing !== undefined) return { record: existing, accepted: false };
        store.set(key, candidate);
        return { record: candidate, accepted: true };
      },
    };
  }

  test("hai lời gọi ĐỒNG THỜI ⇒ chỉ MỘT upload ra mạng, kết quả giống nhau (hai bên như nhau)", async () => {
    const run = async (api: Api): Promise<{ uploads: number; same: boolean }> => {
      let uploads = 0;
      const fetchImpl = async (): Promise<Response> => {
        uploads += 1;
        return new Response(JSON.stringify({ id: "file-1", type: "file", mime_type: "image/png", size_bytes: 3, created_at: "2026-10-18T00:00:00Z", filename: "a.png" }), { status: 200, headers: { "content-type": "application/json" } });
      };
      const Ctor = api["DeepSeekFileStore"] as new (options: Record<string, unknown>) => Record<string, unknown>;
      const store = new Ctor({ index: makeIndex(), now: () => 1_000_000, fetch: fetchImpl });
      const version = { variantId: "sha256:" + "a".repeat(64), data: new Uint8Array([1, 2, 3]), mediaType: "image/png", bytes: 3, attachment: { attachmentId: "sha256:" + "b".repeat(64) } };
      const connection = { baseURL: "https://api.deepseek.com", headers: { authorization: "Bearer sk-x" } };
      const policy = { expiresAfterSeconds: 3600, refreshMarginSeconds: 600 };
      // Phải BIND: lớp dùng class-field (inflight) nên gọi tách rời sẽ mất this.
      const ensure = (store["ensureUploaded"] as (...args: unknown[]) => Promise<unknown>).bind(store);
      const results = await Promise.all([ensure(version, connection, policy, undefined), ensure(version, connection, policy, undefined)]);
      return { uploads, same: JSON.stringify(results[0]) === JSON.stringify(results[1]) };
    };
    const our = await run(ours);
    expect(our).toEqual(await run(stock));
    expect(our.uploads).toBe(1);
    expect(our.same).toBe(true);
  });

  test("ảnh quá 32 MiB: hai bên cùng ném INVALID_REQUEST, cùng thông điệp", async () => {
    const run = async (api: Api): Promise<string> => {
      const Ctor = api["DeepSeekFileStore"] as new (options: Record<string, unknown>) => Record<string, unknown>;
      const store = new Ctor({ index: makeIndex(), now: () => 0 });
      try {
        await (store["ensureUploaded"] as (...args: unknown[]) => Promise<unknown>)({ variantId: "sha256:" + "a".repeat(64), bytes: 64 * 1024 * 1024, data: new Uint8Array(1), mediaType: "image/png", attachment: { attachmentId: "x" } }, { baseURL: "https://x", headers: {} }, { expiresAfterSeconds: 3600, refreshMarginSeconds: 60 }, undefined);
        return "KHONG-NEM";
      } catch (error) {
        return String((error as { code?: string }).code) + "|" + String((error as Error).message);
      }
    };
    const our = await run(ours);
    expect(our).toBe(await run(stock));
    expect(our.startsWith("INVALID_REQUEST|")).toBe(true);
  });
});

describe("DeepSeekAdapter A/B: metadata provider", () => {
  /** Connection tối thiểu mà adapter cần. */
  const CONNECTION = { baseURL: "https://api.deepseek.com", headers: { authorization: "Bearer sk-x" }, models: [], maxTokens: 8192, streamIdleTimeoutMs: 60_000, defaultContextWindow: 128_000 };

  /**
   * Dựng adapter của một bên.
   * @param api - bề mặt module.
   * @returns thực thể adapter.
   */
  function makeAdapter(api: Api): Record<string, unknown> {
    const Ctor = api["DeepSeekAdapter"] as new (deps: Record<string, unknown>) => Record<string, unknown>;
    return new Ctor({ options: () => CONNECTION, resolveUserId: () => "user-1" });
  }

  test("providerInfo + providerRetryPolicy + listModels trùng bản gốc", async () => {
    const ourAdapter = makeAdapter(ours);
    const stockAdapter = makeAdapter(stock);
    expect(JSON.stringify((ourAdapter["providerInfo"] as (p: string) => unknown)("deepseek"))).toBe(JSON.stringify((stockAdapter["providerInfo"] as (p: string) => unknown)("deepseek")));
    expect(JSON.stringify((ourAdapter["providerRetryPolicy"] as (p: string) => unknown)("deepseek"))).toBe(JSON.stringify((stockAdapter["providerRetryPolicy"] as (p: string) => unknown)("deepseek")));
    expect(await (ourAdapter["listModels"] as (p: string) => Promise<unknown>)("deepseek")).toEqual(await (stockAdapter["listModels"] as (p: string) => Promise<unknown>)("deepseek"));
  });
});

describe("registerDeepSeekProvider A/B trên Context cordis THẬT", () => {
  test("mỗi bên đăng ký ĐÚNG MỘT adapter cho provider đã cho, và cùng cờ retry policy", async () => {
    /** Nạp cordis THẬT từ runtime của app. */
    const loadCordis = async (): Promise<new () => Record<string, unknown>> => {
      const path = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
      const mod = (await import(path)) as { Context: new () => Record<string, unknown> };
      return mod.Context;
    };
    /**
     * Chạy registerDeepSeekProvider trên một Context thật có dịch vụ giả.
     * @param api - bề mặt module.
     * @returns các lần gọi registerAdapter đã ghi.
     */
    const run = async (api: Api): Promise<string[]> => {
      const Context = await loadCordis();
      const ctx = new Context();
      const registered: string[] = [];
      const services = {
        name: "test-services",
        apply(child: Record<string, unknown>): void {
          const provide = child["provide"] as (name: string, value: unknown) => void;
          provide("settings", { configure: () => () => undefined });
          provide("llm", {
            registerAdapter: (providers: string[]): Record<string, unknown> => {
              registered.push(providers.join(","));
              return { replace: (next: string[]): void => void registered.push("replace:" + next.join(",")) };
            },
          });
        },
      };
      (ctx["plugin"] as (plugin: unknown) => unknown)(services);
      await new Promise((resolve) => setTimeout(resolve, 30));
      const register = api["registerDeepSeekProvider"] as (c: unknown, p: string, d: Record<string, unknown>) => void;
      register(ctx, "deepseek", {
        providerName: "DeepSeek",
        options: () => ({ baseURL: "https://api.deepseek.com", headers: {}, models: [], retryPolicy: { retries: 1 } }),
        resolveUserId: () => "user-1",
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      return registered;
    };
    const our = await run(ours);
    const their = await run(stock);
    expect(our).toEqual(their);
    expect(our).toEqual(["deepseek"]);
  });
});
