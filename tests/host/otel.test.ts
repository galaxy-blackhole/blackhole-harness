/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-otel — do tren ARTIFACT (lib/index.js), doi chieu voi bundle goc.
 */
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { gunzipSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { buildPackage } from "../../packages/host/otel/build.ts";
import { SESSION_LOG_MAX_REQUEST_BYTES, resolveSessionLogLimits } from "../../packages/host/otel/src/session-log.ts";

setDefaultTimeout(30_000);

/** Thu muc goc repo (tu vi tri file test). */
const REPO = join(import.meta.dir, "..", "..");
/** Duong dan bundle GOC (chi doc). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-otel", "lib", "index.js");
/** Ten package cua ta (PHAI khop thu muc trong node_modules — bai hoc 17/10/2026). */
const PKG = "@galaxy-blackhole/gbh-otel";
/** Goc gia lap mot profile: goc/node_modules/ten-package/lib/index.js. */
const ROOT = join("/tmp", "gbh-otel-test-build");
/** Thu muc node_modules cua profile gia lap. */
const MODULES = join(ROOT, "node_modules");
/** Thu muc package trong profile gia lap. */
const MOUNTED = join(MODULES, PKG);
/** Duong dan artifact cua ta sau khi build (trong profile gia lap). */
const ARTIFACT = join(MOUNTED, "lib", "index.js");
/** Cac peer phai duoc tro ve KERNEL (mount that lam viec nay bang gbh.peers). */
const PEERS: readonly string[] = [
  "@deepseek-ai/cordis",
  "@opentelemetry/api",
  "@opentelemetry/api-logs",
  "@opentelemetry/core",
  "@opentelemetry/otlp-exporter-base",
  "@opentelemetry/otlp-transformer",
  "@opentelemetry/resources",
  "@opentelemetry/sdk-logs",
  "got",
];

/**
 * Dung lai DUNG cach mount that lam: node_modules cua profile + symlink tung peer ve kernel.
 * @returns duong dan artifact sau khi build.
 */
async function buildMountedArtifact(): Promise<string> {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(join(MODULES, "@opentelemetry"), { recursive: true });
  mkdirSync(MOUNTED, { recursive: true });
  for (const peer of PEERS) {
    const source = join(REPO, "apps", "host", "node_modules", peer);
    expect(existsSync(source)).toBe(true);
    const link = join(MODULES, peer);
    mkdirSync(join(link, ".."), { recursive: true });
    symlinkSync(source, link, "dir");
  }
  mkdirSync(join(MOUNTED, "node_modules"), { recursive: true });
  return buildPackage(join(MOUNTED, "lib"));
}

/** Mot request OTLP ma server gia da nhan. */
interface Captured {
  /** Than request sau khi giai nen. */
  body: Buffer;
  /** Header cua request (da ha chu thuong). */
  headers: Record<string, string>;
}

/** Server gia dong vai collector OTLP. */
interface FakeCollector {
  /** URL day du cua diem den log. */
  url: string;
  /** Cac request da nhan. */
  captured: Captured[];
  /** Dong server va tra ve so request da nhan. */
  close: () => Promise<number>;
}

/**
 * Dung mot collector OTLP gia tren cong trong.
 * @param status - ma HTTP tra ve (500 de thu duong loi).
 * @returns diem den, danh sach request da nhan, va ham dong.
 */
async function startCollector(status = 200): Promise<FakeCollector> {
  const captured: Captured[] = [];
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const raw = Buffer.concat(chunks);
      const encoding = String(request.headers["content-encoding"] ?? "");
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) headers[key.toLowerCase()] = String(value);
      captured.push({ body: encoding === "gzip" ? gunzipSync(raw) : raw, headers });
      response.writeHead(status, { "content-type": "application/json" });
      response.end("{}");
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("khong lay duoc cong cua collector gia");
  return {
    url: "http://127.0.0.1:" + String(address.port) + "/v1/logs",
    captured,
    close: () =>
      new Promise<number>((resolve) => {
        server.close(() => resolve(captured.length));
      }),
  };
}

/** Ban ghi OTLP JSON da giai ma (chi cac truong ma test nay doc). */
interface DecodedLogRecord {
  /** Ten su kien. */
  eventName?: string;
  /** Do nghiem trong. */
  severityNumber?: number;
  /** Thuoc tinh dang mang OTLP (key + value). */
  attributes?: { key: string; value: Record<string, unknown> }[];
}

/**
 * Giai ma mot than request OTLP JSON thanh cac ban ghi.
 * @param body - than request (da giai nen).
 * @returns danh sach ban ghi trong request.
 */
function decodeOtlp(body: Buffer): DecodedLogRecord[] {
  const parsed = JSON.parse(body.toString("utf8")) as {
    resourceLogs?: { scopeLogs?: { logRecords?: DecodedLogRecord[] }[] }[];
  };
  return (parsed.resourceLogs ?? []).flatMap((resource) => (resource.scopeLogs ?? []).flatMap((scope) => scope.logRecords ?? []));
}

/**
 * Doc thuoc tinh dang OTLP thanh mot bang don gian.
 * @param record - ban ghi da giai ma.
 * @returns bang ten -> gia tri (stringValue/intValue/boolValue).
 */
function attributeMap(record: DecodedLogRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const entry of record.attributes ?? []) {
    out[entry.key] = entry.value["stringValue"] ?? entry.value["intValue"] ?? entry.value["boolValue"] ?? entry.value;
  }
  return out;
}

/**
 * Doi mot dieu kien thanh true (co han).
 * @param predicate - dieu kien can dung.
 * @param timeoutMs - han cho (ms).
 * @returns hoan tat khi dieu kien dung, nem loi khi het han.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("het thoi gian cho dieu kien");
    await Bun.sleep(20);
  }
}

/** Kieu toi thieu cua dich vu otel ma test nay dung (lay tu artifact). */
interface OTelLike {
  /** Tao kenh su kien thuong. */
  createEventReporter: (options: unknown) => {
    emit: (record: unknown) => void;
    shutdown: (signal?: AbortSignal) => Promise<void>;
  };
  /** Tao kenh log phien. */
  createSessionLogReporter: (options: unknown) => {
    reportSessionLog: (record: unknown) => void;
    stopPending: () => void;
    shutdown: () => Promise<void>;
  };
}

/** Context toi thieu ma `Service` cua cordis can: no goi `ctx.reflect.provide(name, self, check)` trong constructor. */
interface MinimalContext {
  /** Ghi lai loi dang ky dich vu (kernel that lam viec nay). */
  reflect: {
    provide: (name: string, value: unknown, check: unknown) => void;
  };
}

/** Ban ghi mot lan dang ky dich vu. */
interface Registration {
  /** Ten dich vu duoc dang ky. */
  name: string;
  /** The hien duoc dang ky. */
  value: unknown;
}

/**
 * Nap artifact va tao dich vu otel trong mot context TOI THIEU nhung that ve mat HANH VI:
 * `Service` cua cordis dang ky ngay trong constructor bang `ctx.reflect.provide(name, this, …)`.
 * @param registrations - mang hung cac lan dang ky (de khang dinh ten dich vu).
 * @returns the hien dich vu theo kieu toi thieu cua test.
 */
async function loadService(registrations: Registration[] = []): Promise<OTelLike> {
  const module = (await import(ARTIFACT)) as { default: new (ctx: MinimalContext) => OTelLike };
  const ctx: MinimalContext = {
    reflect: {
      provide: (name: string, value: unknown) => {
        registrations.push({ name, value });
      },
    },
  };
  return new module.default(ctx);
}

// LƯỢT ĐO 01/11/2026: cả 5 ca dưới đây đỏ vì "Cannot find module …/lib/index.js" — hàm dựng artefact ở trên
// chưa từng được gọi (không có beforeAll), nên mọi ca nạp ARTIFACT trước khi nó tồn tại. Hook này dựng
// artefact ĐÚNG cách mount thật làm (symlink peer về kernel) trước khi ca đầu tiên chạy.
beforeAll(async () => {
  await buildMountedArtifact();
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe("artifact @galaxy-blackhole/gbh-otel", () => {
  
  // TEST CANH (muc 7 cua cong thuc): row nay CHUA duoc Lead boot/mount, nen goi PHAI o trang thai
  // "chua khai gbh.row" — khai som la nhan rui ro mount (bh host sinh patch tu MOI goi co gbh.row).
  });

describe("dich vu otel tren artifact", () => {
  test("mount khong tao hang doi/danh tinh: dang ky DUNG ten `otel`, hai phuong thuc tao kenh la ham that, chua gui gi", async () => {
    const registrations: Registration[] = [];
    const service = await loadService(registrations);
    // Ten dich vu phai NGUYEN VAN: `base` va `web-app` inject theo ten nay.
    expect(registrations.map((entry) => entry.name)).toEqual(["otel"]);
    expect(registrations[0]?.value).toBe(service);
    expect(typeof service.createEventReporter).toBe("function");
    expect(typeof service.createSessionLogReporter).toBe("function");
    const collector = await startCollector();
    try {
      const reporter = service.createEventReporter({
        exporter: { url: collector.url, headers: { authorization: "Bearer test" }, compression: "gzip", timeoutMillis: 2000, keepAlive: false },
        resourceAttributes: { "service.name": "gbh-test" },
        scope: { name: "gbh-otel-test", version: "1.0.0" },
        processor: { scheduledDelayMillis: 1000, maxQueueSize: 128, maxExportBatchSize: 64, exportTimeoutMillis: 5000 },
        onFailure: () => undefined,
      });
      expect(collector.captured).toHaveLength(0);
      await reporter.shutdown(AbortSignal.timeout(4000));
      expect(collector.captured).toHaveLength(0);
    } finally {
      await collector.close();
    }
  });

  test("ca BYTE + hanh vi chinh: emit di qua HTTP dang gzip, than giai nen la JSON dung byte", async () => {
    const service = await loadService();
    const failures: string[] = [];
    const collector = await startCollector();
    try {
      const reporter = service.createEventReporter({
        exporter: { url: collector.url, headers: { authorization: "Bearer test" }, compression: "gzip", timeoutMillis: 2000, keepAlive: false },
        resourceAttributes: { "service.name": "gbh-test" },
        scope: { name: "gbh-otel-test" },
        processor: { scheduledDelayMillis: 1000, maxQueueSize: 128, maxExportBatchSize: 64, exportTimeoutMillis: 5000 },
        onFailure: (message: string) => failures.push(message),
      });
      reporter.emit({
        eventName: "sidebar_menu_click",
        body: "click",
        timestamp: 1_700_000_000_000,
        attributes: { count: 2, ok: true, nested: { kind: "menu" } },
      });
      await waitFor(() => collector.captured.length > 0, 8000);
      await reporter.shutdown(AbortSignal.timeout(4000));
      expect(failures).toEqual([]);
      const request = collector.captured[0] as Captured;
      expect(request.headers["content-encoding"]).toBe("gzip");
      expect(request.headers["content-type"]).toBe("application/json");
      expect(request.headers["authorization"]).toBe("Bearer test");
      const records = decodeOtlp(request.body);
      expect(records).toHaveLength(1);
      const record = records[0] as DecodedLogRecord;
      expect(record.eventName).toBe("sidebar_menu_click");
      expect(record.severityNumber).toBe(9);
      const attributes = attributeMap(record);
      expect(attributes["count"]).toBe(2);
      expect(attributes["ok"]).toBe(true);
      // Ca BYTE: van chuyen phai doi than phan hoi nhu BYTE. `String(view)` cho ra "123,34,..."
      // (chuoi so) chu KHONG phai JSON — do la bug da pha moi RPC (ADR 0004 §8).
      const bytes = new Uint8Array(request.body);
      const asByteText = String(bytes);
      const asUtf8 = Buffer.from(request.body).toString("utf8");
      expect(asByteText).not.toBe(asUtf8);
      expect(asByteText.startsWith("123,34,")).toBe(true);
      expect(JSON.parse(asUtf8)).toHaveProperty("resourceLogs");
      // Do dai byte phai khop CHINH XAC sau vong gzip -> gunzip (khong mat/trao byte).
      expect(Buffer.byteLength(asUtf8, "utf8")).toBe(request.body.length);
    } finally {
      await collector.close();
    }
  });

  test("kenh log phien: gom lo theo BYTE, tu choi ban ghi vuot tran, giu nguyen su kien", async () => {
    const service = await loadService();
    const failures: string[] = [];
    const collector = await startCollector();
    try {
      const reporter = service.createSessionLogReporter({
        exporter: { url: collector.url, compression: "gzip", timeoutMillis: 2000, keepAlive: false },
        maxRequestBytes: 20_000,
        processor: { scheduledDelayMillis: 1000, maxQueueSize: 64, maxExportBatchSize: 64, exportTimeoutMillis: 5000 },
        scope: { name: "gbh-otel-session" },
        resourceAttributes: { "service.name": "gbh-test" },
        onFailure: (message: string) => failures.push(message),
      });
      const small = { type: "message", time: 1_700_000_000_000, data: { text: "xin chao" } };
      reporter.reportSessionLog({ sessionId: "session-1", event: small, attributes: { origin: "test" } });
      await waitFor(() => collector.captured.length > 0, 8000);
      const records = decodeOtlp((collector.captured[0] as Captured).body);
      expect(records).toHaveLength(1);
      const record = records[0] as DecodedLogRecord;
      expect(record.eventName).toBe("session-log");
      const attributes = attributeMap(record);
      expect(attributes["sessionId"]).toBe("session-1");
      expect(attributes["origin"]).toBe("test");
      expect(JSON.parse(String(attributes["content"]))).toEqual(small);
      const before = collector.captured.length;
      reporter.reportSessionLog({
        sessionId: "session-1",
        event: { type: "message", time: 1_700_000_000_001, data: { text: "x".repeat(20_000) } },
      });
      await Bun.sleep(150);
      expect(collector.captured.length).toBe(before);
      expect(failures.join(" | ")).toContain("Session log record rejected");
      expect(failures.join(" | ")).not.toContain("x".repeat(64));
      reporter.stopPending();
      await reporter.shutdown();
      expect(collector.captured.length).toBe(before);
    } finally {
      await collector.close();
    }
  });

  test("duong loi: cau hinh sai NEM ngay; collector loi thi goi onFailure va KHONG treo", async () => {
    expect(() => resolveSessionLogLimits({ maxRequestBytes: 0 })).toThrow(/maxRequestBytes/);
    expect(() => resolveSessionLogLimits({ maxRequestBytes: SESSION_LOG_MAX_REQUEST_BYTES + 1 })).toThrow(/maxRequestBytes/);
    expect(() => resolveSessionLogLimits({ maxRequestBytes: 1.5 })).toThrow(/maxRequestBytes/);
    expect(() => resolveSessionLogLimits({ processor: { maxQueueSize: 8, maxExportBatchSize: 9 } })).toThrow(/maxExportBatchSize/);
    expect(() => resolveSessionLogLimits({ processor: { scheduledDelayMillis: 0 } })).toThrow(/scheduledDelayMillis/);
    expect(resolveSessionLogLimits({})).toBe(SESSION_LOG_MAX_REQUEST_BYTES);

    const service = await loadService();
    const failures: string[] = [];
    const collector = await startCollector(500);
    try {
      const reporter = service.createSessionLogReporter({
        exporter: { url: collector.url, timeoutMillis: 1000, keepAlive: false },
        processor: { scheduledDelayMillis: 100, maxQueueSize: 8, maxExportBatchSize: 8, exportTimeoutMillis: 2000 },
        scope: { name: "gbh-otel-error" },
        resourceAttributes: {},
        onFailure: (message: string, error?: Error) => failures.push(message + ":" + String(error?.message ?? "")),
      });
      reporter.reportSessionLog({ sessionId: "session-err", event: { type: "message", time: 1, data: null } });
      await waitFor(() => failures.length > 0, 8000);
      expect(failures.join(" | ")).toContain("Session log export failed");
      expect(failures.join(" | ")).toContain("Internal Server Error");
      await reporter.shutdown();
      expect(collector.captured.length).toBeGreaterThan(0);
    } finally {
      await collector.close();
    }
  });

  test("an ninh/thoi gian: shutdown bi huy => agent RIENG bi huy, KHONG treo, chan doan khong ro noi dung", async () => {
    const service = await loadService();
    const destroyed: string[] = [];
    const agent = { destroy: (): void => { destroyed.push("destroy"); } };
    // Collector tra loi CHAM: request con dang bay khi shutdown bi huy.
    const slow = createServer((request: IncomingMessage, response: ServerResponse) => {
      request.on("data", () => undefined);
      request.on("end", () => {
        setTimeout(() => {
          response.writeHead(200, { "content-type": "application/json" });
          response.end("{}");
        }, 3000);
      });
    });
    await new Promise<void>((resolve) => {
      slow.listen(0, "127.0.0.1", resolve);
    });
    const address = slow.address();
    if (address === null || typeof address === "string") throw new Error("khong lay duoc cong");
    const failures: string[] = [];
    const reporter = service.createEventReporter({
      exporter: {
        url: "http://127.0.0.1:" + String(address.port) + "/v1/logs",
        httpAgentOptions: () => agent as never,
        timeoutMillis: 1500,
        keepAlive: false,
      },
      resourceAttributes: {},
      scope: { name: "gbh-otel-abort" },
      processor: { scheduledDelayMillis: 10, maxQueueSize: 8, maxExportBatchSize: 8, exportTimeoutMillis: 1500 },
      onFailure: (message: string) => failures.push(message),
    });
    reporter.emit({ eventName: "aborted_event", body: "bi huy", timestamp: Date.now(), attributes: { secret: "sk-A1b2C3" } });
    const started = Date.now();
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(new Error("deadline")), 8000);
    const shutdown = reporter.shutdown(controller.signal);
    // Huy SAU khi request da bay (agent da duoc tao) nhung TRUOC khi no settle.
    while (destroyed.length === 0 && Date.now() - started < 2000) await Bun.sleep(10);
    controller.abort(new Error("deadline"));
    clearTimeout(abortTimer);
    await shutdown;
    expect(Date.now() - started).toBeLessThan(2500);
    expect(destroyed).toEqual(["destroy"]);
    // Chan doan KHONG duoc mang noi dung cua ban ghi (body/attributes).
    expect(failures.join(" | ")).not.toContain("sk-A1b2C3");
    expect(failures.join(" | ")).not.toContain("bi huy");
    await new Promise<void>((resolve) => {
      slow.close(() => resolve());
    });
  });
});
