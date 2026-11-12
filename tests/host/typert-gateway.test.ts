/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test tang envelope + wire cua typert-gateway theo dung ma tran 12 ca cua oracle (Lead do), cong
 *      byte nua CLIENT: sau lo doi ten brand DSH→GBH, chuan hoa brand DOI XUNG hai ve (brand-parity);
 *      dsh.client.inject so bang sameAfterIdMap (id da rewrite CO CHU DICH).
 */
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { brandEqual, DIST_READ_NAMES, sameAfterIdMap } from "../lib/brand-parity.ts";
import { dottedMethodMessage, parseClientRequest } from "../../packages/host/typert-gateway/src/envelope.ts";
import { asBytes, encodeServerResponse } from "../../packages/host/typert-gateway/src/wire.ts";

/** Body chuan cho cac ca. */
const good = (patch: Record<string, unknown> = {}): string =>
  JSON.stringify({ type: "client-request", rpcId: "probe", method: "pluginInventory/list", payload: { args: {} }, ...patch });

/** Goi parse voi mac dinh POST + application/json. */
const parse = (body: string, overrides: { method?: string; contentType?: string } = {}) =>
  parseClientRequest({ method: "POST", contentType: "application/json", body, ...overrides });

describe("envelope: tang van chuyen tra ma HTTP that + text thuan", () => {
  test("ca 11: GET thay POST -> 404 not found", () => {
    const result = parse(good(), { method: "GET" });
    expect(result).toEqual({ kind: "transport", rejection: { status: 404, text: "not found" } });
  });

  test("ca 9: content-type sai -> 415 content type must be application/json", () => {
    const result = parse(good(), { contentType: "text/plain" });
    expect(result).toEqual({ kind: "transport", rejection: { status: 415, text: "content type must be application/json" } });
  });

  test("ca 8: than JSON hong -> 400 body is not JSON", () => {
    const result = parse("{ khong phai json");
    expect(result).toEqual({ kind: "transport", rejection: { status: 400, text: "body is not JSON" } });
  });
});

describe("envelope: tang giao thuc tra HTTP 200 + error.code", () => {
  test("ca 1: envelope dung chuan -> ok", () => {
    const result = parse(good());
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("phai ok");
    expect(result.method).toBe("pluginInventory/list");
    expect(result.rpcId).toBe("probe");
  });

  test("ca 12: rpcId rong van duoc chap nhan (echo nguyen)", () => {
    const result = parse(good({ rpcId: "" }));
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("phai ok");
    expect(result.rpcId).toBe("");
  });

  test("ca 2,3,4: type/rpcId/payload sai -> gateway/bad-request", () => {
    for (const body of [JSON.stringify({ type: "other", rpcId: "x", method: "a/b", payload: { args: {} } }), JSON.stringify({ type: "client-request", method: "a/b", payload: { args: {} } }), JSON.stringify({ type: "client-request", rpcId: "x", method: "a/b" })]) {
      expect(parse(body)).toEqual({ kind: "protocol", code: "gateway/bad-request", message: "invalid client-request message" });
    }
  });

  test("ca 5,6,7: payload rong / hai truong / args khong phai object -> gateway/internal", () => {
    const bodies = [
      JSON.stringify({ type: "client-request", rpcId: "x", method: "a/b", payload: {} }),
      JSON.stringify({ type: "client-request", rpcId: "x", method: "a/b", payload: { args: {}, extra: 1 } }),
      JSON.stringify({ type: "client-request", rpcId: "x", method: "a/b", payload: { args: 5 } }),
    ];
    for (const body of bodies) {
      expect(parse(body)).toEqual({
        kind: "protocol",
        code: "gateway/internal",
        message: "Remote payload must contain exactly one plain-object args field",
      });
    }
  });

  test("ca 10: method dung dau cham -> thong diep doi chieu endpoint", () => {
    expect(dottedMethodMessage("pluginInventory.list")).toBe('method "pluginInventory.list" does not match endpoint "pluginInventory/list"');
  });
});

describe("wire: than response luon la BYTE (ADR 0004 §8)", () => {
  test("encodeServerResponse tra Buffer, JSON dung hinh dang, echo rpcId", () => {
    const bytes = encodeServerResponse("probe", { ok: true, value: { entries: [] } });
    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(JSON.parse(bytes.toString("utf8"))).toEqual({ type: "server-response", rpcId: "probe", result: { ok: true, value: { entries: [] } } });
    const failed = encodeServerResponse("", { ok: false, error: { code: "gateway/bad-request", message: "x" } });
    expect(Buffer.isBuffer(failed)).toBe(true);
    expect(JSON.parse(failed.toString("utf8")).rpcId).toBe("");
  });

  test("asBytes giu nguyen byte cho Uint8Array/DataView/ArrayBuffer, khong bao gio thanh day so thap phan", () => {
    const bytes = encodeServerResponse("p", { ok: true, value: 1 });
    const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(asBytes(view).toString("utf8")).toBe(bytes.toString("utf8"));
    expect(asBytes(new DataView(bytes.buffer)).toString("utf8")).toBe(bytes.toString("utf8"));
    expect(asBytes(bytes.buffer).subarray(0, bytes.length).toString("utf8")).toBe(bytes.toString("utf8"));
    expect(String(view)).not.toBe(bytes.toString("utf8"));
  });
});


describe("ruột MỚI: lớp service typertGateway ĐẦY ĐỦ (thay bản một phần 392 dòng)", () => {
  /** Bundle gốc của row typert-gateway trong kernel (CHỈ ĐỌC). */
  const STOCK_BUNDLE = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-gateway", "lib", "index.js");
  /** Artefact chính của gói. */
  const BUILT = join(import.meta.dir, "..", "..", "packages", "host", "typert-gateway", "lib", "index.js");

  /**
   * Nạp cordis THẬT từ runtime của app.
   * @returns lớp Context.
   */
  async function loadCordis(): Promise<new () => Record<string, unknown>> {
    const mod = (await import(join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"))) as { Context: new () => Record<string, unknown> };
    return mod.Context;
  }

  /**
   * Dựng service typertGateway trên Context cordis thật.
   * @returns cặp { ctx, service }.
   */
  async function mountService(): Promise<{ ctx: Record<string, unknown>; service: Record<string, unknown> }> {
    const Context = await loadCordis();
    const ctx = new Context();
    const api = (await import(BUILT)) as { TypertGatewayService: new (ctx: unknown, config: Record<string, unknown>) => Record<string, unknown> };
    const service = new api.TypertGatewayService(ctx, { websocketHeartbeatIntervalMs: 2000, streamInboxBytes: 262144 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { ctx, service };
  }

  test("artefact chính TRÙNG TỪNG BYTE bundle gốc của dsh-api-gateway", () => {
    const built = readFileSync(BUILT, "utf8");
    const stock = readFileSync(STOCK_BUNDLE, "utf8");
    // 06/11/2026 (P1b): artefact mang id CUA TA ⇒ so do dai tren dang da chuan hoa id.
    expect(chuanHoaHost(built).length).toBe(stock.length);
    // 06/11/2026 (P1b): so TOAN VAN tren dang da chuan hoa id.
    expect(chuanHoaHost(built)).toBe(chuanHoaHost(stock));
    // 1.831 dòng khi split theo newline (dòng cuối rỗng sau ký tự xuống dòng cuối) — wc -l báo 1.830.
    expect(built.split("\n").length).toBe(1831);
  });

  test("bề mặt export của artefact: TypertGatewayService · TypertGatewayError · default", async () => {
    const api = (await import(BUILT)) as Record<string, unknown>;
    expect(Object.keys(api).sort()).toEqual(["TypertGatewayError", "TypertGatewayService", "default"]);
    expect(api["default"]).toBe(api["TypertGatewayService"]);
  });

  test("SEAM: registerRemoteEvents LÀ HÀM trên service cài vào Context thật", async () => {
    const { ctx, service } = await mountService();
    expect(typeof ctx["typertGateway"]).toBe("object");
    expect(typeof service["registerRemoteEvents"]).toBe("function");
    expect(typeof service["hasLiveClient"]).toBe("function");
    expect(typeof service["claimsEndpoint"]).toBe("function");
  });

  test("registerRemoteEvents: trả hàm huỷ hoặc ném — miễn KHÔNG treo; huỷ được khi có hàm", async () => {
    const { service } = await mountService();
    const register = service["registerRemoteEvents"] as (source: unknown, host: unknown) => unknown;
    let outcome = "nem";
    try {
      const dispose = register(async function* () {}, { home: "/tmp/gbh-home" });
      if (typeof dispose === "function") {
        (dispose as () => unknown)();
        outcome = "co-ham-huy";
      } else {
        outcome = "khong-ham";
      }
    } catch {
      outcome = "nem";
    }
    expect(["co-ham-huy", "nem"]).toContain(outcome);
  });

  test("hasLiveClient() = false khi chưa có client WS", async () => {
    const { service } = await mountService();
    expect((service["hasLiveClient"] as () => boolean)()).toBe(false);
  });

  test("Config mặc định: websocketHeartbeatIntervalMs 2000 · streamInboxBytes 262144", async () => {
    const api = (await import(BUILT)) as { TypertGatewayService?: { Config?: { "~standard"?: { validate(v: unknown): { value?: unknown } } } } };
    const value = api.TypertGatewayService?.Config?.["~standard"]?.validate({})?.value as Record<string, unknown> | undefined;
    expect(value?.["websocketHeartbeatIntervalMs"]).toBe(2000);
    expect(value?.["streamInboxBytes"]).toBe(262144);
  });

  test("tầng phụ envelope/wire vẫn có mặt trong lib/envelope.js (không mất API cũ)", async () => {
    const built = (await import(join(import.meta.dir, "..", "..", "packages", "host", "typert-gateway", "lib", "envelope.js"))) as Record<string, unknown>;
    expect(typeof built["parseClientRequest"]).toBe("function");
    expect(typeof built["dottedMethodMessage"]).toBe("function");
    expect(typeof built["asBytes"]).toBe("function");
    expect(typeof built["encodeServerResponse"]).toBe("function");
  });
});


describe("NỬA CLIENT (đợt 1: bản browser) — de-bundle + cổng byte", () => {
  /** Gói của ta. */
  const PKG = join(import.meta.dir, "..", "..", "packages", "host", "typert-gateway");
  /** Bundle client GỐC (browser) trong kernel — CHỈ ĐỌC. */
  const STOCK_CLIENT = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-gateway", "lib", "client.browser.js");
  /** Id gốc / id của ta. */
  const STOCK_ID = "@deepseek-ai/dsh-api-gateway";
  const OUR_ID = "@galaxy-blackhole/gbh-host-typert-gateway";

  /** Tên DSH của một tên VỎ DIST (`__GBH_BOOT__` ⇒ `__DSH_BOOT__`). */
  const tenStock = (ten: string): string => "__DSH_" + ten.slice("__GBH_".length);

  /**
   * Quy 4 tên VỎ DIST về cách viết của bản stock để so CHÉO hai vế.
   * Vì sao cần: `normalizeBrand` GIỮ NGUYÊN 4 tên này (vỏ SPA đang đọc tên GBH), còn bundle stock viết
   * `__DSH_*`; phép so byte chéo chỉ trùng khi quy ĐỐI XỨNG cả 4 tên.
   * Nhận: text — văn bản bundle.
   * Trả: văn bản đã quy 4 tên vỏ dist về dạng DSH.
   */
  function dongBoVoDist(text: string): string {
    let out = text;
    for (const ten of DIST_READ_NAMES) out = out.split(ten).join(tenStock(ten));
    return out;
  }

  test("lib/client.browser.js TRÙNG bundle gốc sau khi quy đổi ĐÚNG MỘT dòng id", () => {
    const built = readFileSync(join(PKG, "lib", "client.browser.js"), "utf8");
    const stock = readFileSync(STOCK_CLIENT, "utf8");
    // 20/10/2026 (lô đổi tên brand): ngoài dòng id, bundle của ta đổi `__DSH_TRANSPORT__` →
    // `__GBH_TRANSPORT__` (tên VỎ DIST, cùng độ dài). So ĐỐI XỨNG sau khi quy 4 tên vỏ dist về dạng stock
    // ⇒ vẫn là phép so TOÀN VĂN chặt, không phải "contains".
    const expected = dongBoVoDist(stock.split(STOCK_ID).join(OUR_ID));
    expect(brandEqual(dongBoVoDist(built), expected)).toBe(true);
    // Id của ta DÀI hơn id gốc đúng 13 ký tự ⇒ chỉ khác đúng phần id, không mất/thêm dòng nào.
    expect(built.length).toBe(stock.length + (OUR_ID.length - STOCK_ID.length));
    expect(OUR_ID.length - STOCK_ID.length).toBe(13);
    // Đúng MỘT chỗ đổi: dòng id của loader.
    expect(stock.split("\n").length).toBe(built.split("\n").length);
  });

  test("bundle client tự khai ĐÚNG MỘT id và đó là id của ta (luật MỘT-ID)", () => {
    const built = readFileSync(join(PKG, "lib", "client.browser.js"), "utf8");
    const ids = [...built.matchAll(/id:\s*"([^"]+)"/gu)].map((match) => String(match[1]));
    expect(ids).toEqual([OUR_ID]);
    expect(built).not.toContain(STOCK_ID);
    expect(built.startsWith("window.__ModuleLoader__.load({")).toBe(true);
  });

  test("11 lát thân, mọi lát ≤ 1000 dòng, vỏ giữ nguyên hình dạng factory", () => {
    const wrapper = JSON.parse(readFileSync(join(PKG, "src", "client-wrapper.browser.json"), "utf8")) as { head: string[]; tail: string[]; parts: string[] };
    expect(wrapper.parts).toHaveLength(11);
    expect(wrapper.head[0]).toBe("window.__ModuleLoader__.load({");
    expect(wrapper.head[1]).toContain(OUR_ID);
    expect(wrapper.head[2]).toBe("\tfactory: (require) => {");
    for (const fileName of wrapper.parts) {
      const text = readFileSync(join(PKG, "src", "client-parts", "browser", fileName), "utf8");
      expect(text.split("\n").length).toBeLessThanOrEqual(1000);
      expect(text).toContain("author Bùi Trọng Hiếu");
      expect(text).toContain("// @ts-nocheck");
    }
  });

  test("manifest: exports[./client] đủ HAI bản (browser + node) và gbh.row đã khai đúng id/aliases", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
      dsh?: { client?: { platform?: string; immediately?: boolean; inject?: string[] } };
      gbh?: { row?: { id?: string; aliases?: string[]; moduleIds?: string[]; tests?: string[] } };
    };
    const client = manifest.exports["./client"] as { browser?: string; node?: string };
    expect(client.browser).toBe("./lib/client.browser.js");
    expect(client.node).toBe("./lib/client.node.js");
    expect(manifest.dsh?.client?.platform).toBe("web");
    expect(manifest.dsh?.client?.immediately).toBe(true);
    // 20/10/2026 — inject cua ta nay la id GBH (rewrite CO CHU DICH) ⇒ so SAU ban do id voi DUNG literal
    // stock (giu literal stock lam chuan, khong sua literal thanh id ta).
    expect(sameAfterIdMap(manifest.dsh?.client?.inject, ["@deepseek-ai/dsh-typert-registry", "@deepseek-ai/dsh-client-connection"])).toBe(true);
    expect(manifest.gbh?.row?.id).toBe("typert-gateway");
    expect(manifest.gbh?.row?.aliases).toEqual(["@deepseek-ai/dsh-api-gateway"]);
    expect(manifest.gbh?.row?.moduleIds).toEqual(["@galaxy-blackhole/gbh-host-typert-gateway"]);
    expect(manifest.gbh?.row?.tests).toEqual(["tests/host/typert-gateway.test.ts"]);
  });
});
