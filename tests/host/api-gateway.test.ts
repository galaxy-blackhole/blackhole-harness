/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test goi api-gateway (nua HOST): ban ghep TRUNG TUNG BYTE bundle goc + be mat export + service
 *      typertGateway tren Context cordis THAT, A/B voi chinh bundle goc (seam registerRemoteEvents)
 */
import { describe, expect, test } from "bun:test";
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle, stripSliceScaffold } from "../../packages/host/api-gateway/src/assemble.ts";
import { FRAGMENT_BEGIN_MARKER, FRAGMENT_END_MARKER, MODULE_TAIL, PACKAGE_NAME, PART_FILES, SLICE_MARKER, STOCK_BUNDLE } from "../../packages/host/api-gateway/src/manifest.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "api-gateway");
/** Bundle GỐC (CHỈ ĐỌC). */
const STOCK = join(REPO, STOCK_BUNDLE);
/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK, "utf8");

/** Bề mặt module. */
type Api = Record<string, unknown>;

/** Nạp artefact của ta. */
const ours = (await import(join(PKG, "lib", "index.js"))) as Api;
/** Nạp bundle gốc. */
const stock = (await import(STOCK)) as Api;

/**
 * Nạp cordis THẬT từ runtime của app.
 * @returns lớp Context.
 */
async function loadCordis(): Promise<new () => Record<string, unknown>> {
  const mod = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"))) as { Context: new () => Record<string, unknown> };
  return mod.Context;
}

/**
 * Cài service của một bên lên Context cordis mới rồi chờ nó ACTIVE.
 * @param api - bề mặt module (của ta hoặc gốc).
 * @param config - cấu hình gateway.
 * @returns cap { ctx, service }.
 */
async function mountService(api: Api, config: Record<string, unknown> = {}): Promise<{ ctx: Record<string, unknown>; service: Record<string, unknown> }> {
  const Context = await loadCordis();
  const ctx = new Context();
  const ServiceClass = api["TypertGatewayService"] as new (ctx: unknown, config: Record<string, unknown>) => Record<string, unknown>;
  // Đo được: ctx.plugin(ServiceClass) KHÔNG làm service hiện ra ở Context gốc (cordis coi lớp này là plugin
  // hàm); cách ĐÚNG để dựng service là gọi constructor với ctx thật — super(ctx, "typertGateway") đăng ký luôn.
  const service = new ServiceClass(ctx, config);
  await new Promise((resolve) => setTimeout(resolve, 20));
  // cordis bọc service trong tracker nên so DANH TÍNH với instance là sai — chỉ cần service HIỆN RA trên ctx.
  if (typeof ctx["typertGateway"] !== "object") throw new Error("service khong duoc dang ky tren context");
  return { ctx, service };
}

describe("artefact: nửa host port NGUYÊN VĂN TỪNG BYTE", () => {
  test("lib/index.js TRÙNG TỪNG BYTE bundle gốc", () => {
    const built = readFileSync(join(PKG, "lib", "index.js"), "utf8");
    // 05/11/2026 (P1b): artefact mang id CUA TA ⇒ so tren DANG DA CHUAN HOA id.
    const builtChuan = chuanHoaHost(built);
    expect(builtChuan.length).toBe(STOCK_TEXT.length);
    expect(builtChuan).toBe(STOCK_TEXT);
  });

  test("ghép 7 lát = đúng văn bản gốc", () => {
    expect(assembleBundle()).toBe(STOCK_TEXT);
  });

  test("7 lát, mọi lát ≤ 1000 dòng (luật repo), manifest khớp thư mục", () => {
    const dir = join(PKG, "src", "parts");
    expect(readdirSync(dir).sort()).toEqual([...PART_FILES].sort());
    expect(PART_FILES).toHaveLength(7);
    for (const fileName of PART_FILES) {
      const path = join(dir, fileName);
      const text = readFileSync(path, "utf8");
      expect(text.split("\n").length).toBeLessThanOrEqual(1000);
      expect(text).toContain(SLICE_MARKER);
      expect(text.trimEnd().endsWith(MODULE_TAIL)).toBe(true);
      const body = stripSliceScaffold(text, fileName).join("\n");
      expect(body).not.toContain(SLICE_MARKER);
      expect(body).not.toContain(FRAGMENT_BEGIN_MARKER);
      expect(body).not.toContain(FRAGMENT_END_MARKER);
      // Thân lát phải góp đúng số byte vào bundle (không mất dòng nào).
      expect(body.length).toBeGreaterThan(0);
    }
    // 05/11/2026 (P1b): artefact mang id CUA TA ⇒ kich thuoc THAT doi; so tren dang chuan hoa.
    expect(Buffer.byteLength(chuanHoaHost(readFileSync(join(PKG, "lib", "index.js"), "utf8")), "utf8")).toBe(Buffer.byteLength(STOCK_TEXT, "utf8"));
  });

  test("tên package mới, không khai gbh.row (gói HAI MẶT — thiếu nửa client)", () => {
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-api-gateway");
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { gbh?: { row?: unknown; draft?: string } };
    expect(manifest.gbh?.row).toBeUndefined();
    expect(String(manifest.gbh?.draft ?? "")).toContain("khai gbh.row");
    expect(String(manifest.gbh?.draft ?? "")).toContain("HAI MẶT");
  });
});

describe("bề mặt export A/B", () => {
  test("cùng 3 tên export", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual(["TypertGatewayError", "TypertGatewayService", "default"]);
  });

  test("default === TypertGatewayService ở cả hai bên", () => {
    expect(ours["default"]).toBe(ours["TypertGatewayService"]);
    expect(stock["default"]).toBe(stock["TypertGatewayService"]);
  });

  test("cả hai đều là LỚP (function) có nguyên mẫu service", () => {
    expect(typeof ours["TypertGatewayService"]).toBe("function");
    expect(typeof stock["TypertGatewayService"]).toBe("function");
  });
});

describe("service typertGateway trên Context cordis THẬT", () => {
  test("cài lên Context ⇒ có ctx.typertGateway ở cả hai bên", async () => {
    const our = await mountService(ours);
    const their = await mountService(stock);
    expect(our.service).toBeDefined();
    expect(their.service).toBeDefined();
  });

  test("SEAM MỞ KHOÁ: registerRemoteEvents là HÀM ở cả hai bên (bản một phần trước đây thiếu)", async () => {
    const our = await mountService(ours);
    const their = await mountService(stock);
    expect(typeof our.service["registerRemoteEvents"]).toBe("function");
    expect(typeof their.service["registerRemoteEvents"]).toBe("function");
  });

  test("registerRemoteEvents: hai bên cho CÙNG kết quả (kiểu giá trị trả về hoặc thông điệp lỗi)", async () => {
    const run = async (api: Api): Promise<string> => {
      const { service } = await mountService(api);
      const register = service["registerRemoteEvents"] as (source: unknown, host: unknown) => unknown;
      try {
        const dispose = register(async function* () {}, { home: "/tmp/gbh-home" });
        if (typeof dispose === "function") (dispose as () => unknown)();
        return "tra-ve:" + typeof dispose;
      } catch (error) {
        return "nem:" + String((error as Error).message);
      }
    };
    const our = await run(ours);
    expect(our).toBe(await run(stock));
    // Đo được: API đòi source đúng hợp đồng nên ca này có thể ném — điều quan trọng là HAI BÊN GIỐNG NHAU.
    expect(our.length).toBeGreaterThan(0);
  });

  test("hasLiveClient() = false khi chưa có client (hai bên như nhau)", async () => {
    const our = await mountService(ours);
    const their = await mountService(stock);
    expect((our.service["hasLiveClient"] as () => boolean)()).toBe((their.service["hasLiveClient"] as () => boolean)());
    expect((our.service["hasLiveClient"] as () => boolean)()).toBe(false);
  });

  test("claimsEndpoint + collectSrcClaims trùng kết quả rỗng ban đầu", async () => {
    const our = await mountService(ours);
    const their = await mountService(stock);
    expect(JSON.stringify((our.service["collectSrcClaims"] as () => unknown)())).toBe(JSON.stringify((their.service["collectSrcClaims"] as () => unknown)()));
    expect((our.service["claimsEndpoint"] as (e: string) => boolean)("api")).toBe((their.service["claimsEndpoint"] as (e: string) => boolean)("api"));
  });

  test("broadcastRemoteEvent với frame SAI hợp đồng: hai bên ném CÙNG thông điệp (chống lệch hành vi)", async () => {
    const run = async (api: Api): Promise<string> => {
      const { service } = await mountService(api);
      try {
        (service["broadcastRemoteEvent"] as (frame: unknown) => void)({ kind: "event", seq: 1 });
        return "khong-nem";
      } catch (error) {
        return String((error as Error).message);
      }
    };
    const our = await run(ours);
    expect(our).toBe(await run(stock));
    expect(our).toContain("Remote event name must be a nonempty string");
  });

  test("closeRemoteEvents(reason) không ném ở cả hai bên", async () => {
    const our = await mountService(ours);
    const their = await mountService(stock);
    for (const service of [our.service, their.service]) {
      expect(() => (service["closeRemoteEvents"] as (reason: unknown) => void)(new Error("test"))).not.toThrow();
    }
  });

  test("Config: cùng mặc định websocketHeartbeatIntervalMs/streamInboxBytes", () => {
    const value = (api: Api): unknown => {
      const schema = api["TypertGatewayService"] as unknown as { Config?: { "~standard"?: { validate(v: unknown): { value?: unknown } } } };
      return schema.Config?.["~standard"]?.validate({})?.value;
    };
    expect(JSON.stringify(value(ours))).toBe(JSON.stringify(value(stock)));
    expect(JSON.stringify(value(ours))).toContain("262144");
  });

  test("TypertGatewayError: cùng mã + cùng endpoint + cùng thông điệp", () => {
    const build = (api: Api): string => {
      const Ctor = api["TypertGatewayError"] as new (code: string, endpoint: string, message: string) => Error & { code?: string; endpoint?: string };
      const error = new Ctor("gateway/unknown-endpoint", "api.demo", "khong co endpoint");
      return [error.name, error.code, error.endpoint, error.message].join("|");
    };
    expect(build(ours)).toBe(build(stock));
  });
});

describe("A/B thêm: lỗi endpoint + vòng đời remote events + Config từ chối", () => {
  test("invoke endpoint lạ: hai bên ném CÙNG thông điệp", async () => {
    const run = async (api: Api): Promise<string> => {
      const { service } = await mountService(api);
      try {
        await (service["invoke"] as (request: unknown) => Promise<unknown>)({ endpoint: "khong.co", payload: {} });
        return "khong-nem";
      } catch (error) {
        return String((error as Error).message);
      }
    };
    const our = await run(ours);
    expect(our).toBe(await run(stock));
  });

  test("dispatchRpc endpoint lạ: hai bên ném CÙNG thông điệp", async () => {
    const run = async (api: Api): Promise<string> => {
      const { service } = await mountService(api);
      try {
        await (service["dispatchRpc"] as (...args: unknown[]) => Promise<unknown>)("khong.co", {}, undefined, undefined);
        return "khong-nem";
      } catch (error) {
        return String((error as Error).message);
      }
    };
    expect(await run(ours)).toBe(await run(stock));
  });

  test("resourceReaders(descriptor) trùng kết quả", async () => {
    const run = async (api: Api): Promise<string> => {
      const { service } = await mountService(api);
      try {
        return JSON.stringify((service["resourceReaders"] as (d: unknown) => unknown)({ src: "api", entries: [] }));
      } catch (error) {
        return "nem:" + String((error as Error).message);
      }
    };
    expect(await run(ours)).toBe(await run(stock));
  });

  test("consumeRemoteEvents với nguồn RỖNG: kết thúc êm ở cả hai bên", async () => {
    const run = async (api: Api): Promise<string> => {
      const { service } = await mountService(api);
      try {
        await (service["consumeRemoteEvents"] as (s: unknown, sig: unknown) => Promise<unknown>)(async function* () {}, undefined);
        return "xong";
      } catch (error) {
        return "nem:" + String((error as Error).message);
      }
    };
    expect(await run(ours)).toBe(await run(stock));
  });

  test("registerRemoteEvents rồi hasLiveClient vẫn false (chưa có client WS)", async () => {
    const run = async (api: Api): Promise<boolean> => {
      const { service } = await mountService(api);
      try {
        (service["registerRemoteEvents"] as (s: unknown, h: unknown) => unknown)(async function* () {}, { home: "/tmp/gbh-home" });
      } catch {
        // API đòi hợp đồng chặt — ca này chỉ đo trạng thái client.
      }
      return (service["hasLiveClient"] as () => boolean)();
    };
    expect(await run(ours)).toBe(await run(stock));
    expect(await run(ours)).toBe(false);
  });

  test("Config từ chối giá trị ngoài khoảng: hai bên cùng báo issues", () => {
    const validate = (api: Api, input: unknown): string => {
      const schema = api["TypertGatewayService"] as unknown as { Config?: { "~standard"?: { validate(v: unknown): { value?: unknown; issues?: unknown } } } };
      const result = schema.Config?.["~standard"]?.validate(input);
      return result?.issues === undefined ? "ok:" + JSON.stringify(result?.value) : "issues";
    };
    expect(validate(ours, { websocketHeartbeatIntervalMs: 0 })).toBe(validate(stock, { websocketHeartbeatIntervalMs: 0 }));
    expect(validate(ours, { streamInboxBytes: 0 })).toBe(validate(stock, { streamInboxBytes: 0 }));
  });

  test("TypertGatewayError: ba mã lỗi cho CÙNG chuỗi mô tả ở hai bên", () => {
    const build = (api: Api, code: string): string => {
      const Ctor = api["TypertGatewayError"] as new (code: string, endpoint: string, message: string) => Error & { code?: string; endpoint?: string };
      const error = new Ctor(code, "api.x", "mo ta");
      return [error.name, error.code, error.endpoint, error.message].join("|");
    };
    for (const code of ["gateway/unknown-endpoint", "gateway/uplink-overflow", "gateway/busy"]) {
      expect(build(ours, code)).toBe(build(stock, code));
    }
  });
});
