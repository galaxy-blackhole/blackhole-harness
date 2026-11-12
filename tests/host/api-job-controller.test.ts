/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-api-job-controller (NỬA HOST): mỗi ca dựng HAI giàn
 *      giống hệt nhau trên Context cordis THẬT rồi chạy CẢ HAI bản cài (lớp của ta và chính bundle gốc
 *      @deepseek-ai/dsh-api-job-controller) — so marker Remote trên prototype, khoá service + namespace,
 *      ba thao tác list/follow/kill trên sổ job giả, từng khung phát ra, và từng thông điệp lỗi.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/api-job-controller/build.ts";
import * as ours from "../../packages/host/api-job-controller/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "api-job-controller");
/** Phép kiểm CHUẨN cho dải peer của row (parity với manifest stock + phủ bản kernel đang chạy). */
import { peerRangeProblems } from "./peer-range-harness.ts";
/** Bundle GỐC đã build trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-job-controller", "lib", "index.js");
/** cordis của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Context/Service. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** typert-protocol của kernel — dùng CHUNG để đọc marker Remote của cả hai bên. */
const TYPERT = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-typert-protocol", "lib", "index.js");

/** Context cordis THẬT: chỉ hai seam jobs/typert và logger được đắp thêm bằng Proxy. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };
/** remoteMethods của kernel — đọc marker mà decorator @Remote ghi trên prototype. */
const { remoteMethods } = (await import(TYPERT)) as {
  remoteMethods(service: object): readonly { method?: string; name?: string; mode?: string }[];
};

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as {
  JobController: new (ctx: unknown, config: unknown) => Record<string, unknown>;
  default: new (ctx: unknown, config: unknown) => Record<string, unknown>;
};
/** Bản của ta nhìn qua cùng hình dạng để so hai bên. */
const mine = ours as unknown as typeof stock;

/** Một khung đầu ra giả trong vòng đệm của job. */
interface FakeChunk {
  /** Mốc byte tuyệt đối của mẩu. */
  at: number;
  /** Chữ của mẩu. */
  text: string;
}

/** Ảnh chụp job giả — đúng các trường mà hai dòng quan sát đọc. */
interface FakeJob {
  /** Id job. */
  id: string;
  /** Loại producer. */
  kind: string;
  /** Nhãn một dòng. */
  label: string;
  /** Phiên sở hữu (vắng = job không chủ). */
  owner?: string;
  /** Trạng thái vòng đời. */
  status: string;
  /** Mốc bắt đầu (epoch ms). */
  startedAt: number;
  /** Vòng đệm: tổng byte và byte còn giữ sớm nhất. */
  output: { total: number; earliest: number };
}

/** Sự kiện vòng đời giả mà sổ job phát cho listener. */
interface FakeEvent {
  /** Loại sự kiện. */
  type: string;
  /** Job liên quan. */
  job: FakeJob;
  /** Id job (chỉ sự kiện output). */
  id?: string;
}

/** Sổ job giả: đủ năm phương thức mà nửa host gọi, cộng sổ listener điều khiển được. */
interface FakeRegistry {
  /** Mọi listener đã đăng ký, kèm bộ lọc. */
  listeners: { filter: { owners: string }; listener: (event: FakeEvent) => void }[];
  /** Mọi lần huỷ listener (để chứng minh dọn dẹp). */
  unsubscribed: number;
  /** Job theo id. */
  jobs: Map<string, FakeJob>;
  /** Mẩu đầu ra theo id. */
  chunks: Map<string, FakeChunk[]>;
  /** Mọi lời gọi kill đã nhận. */
  kills: { id: string; caller?: string; reason?: string }[];
  /** Đẩy một sự kiện tới mọi listener. */
  emit(event: FakeEvent): void;
  /** Sổ job nhìn từ phía nửa host. */
  registry: unknown;
}

/**
 * Một job mặc định của phiên session-1.
 * Nhận: phần ghi đè.
 * Trả: ảnh chụp job giả.
 */
function defaultJob(overrides: Partial<FakeJob> = {}): FakeJob {
  return {
    id: "bash-1",
    kind: "bash",
    label: "npm test",
    owner: "session-1",
    status: "running",
    startedAt: 1_700_000_000_000,
    output: { total: 0, earliest: 0 },
    ...overrides,
  };
}

/**
 * Dựng sổ job giả (điều khiển được) + Context cordis THẬT bọc Proxy.
 * Nhận: các job ban đầu (mặc định: một job của phiên session-1).
 * Trả: sổ job giả và context đưa cho constructor.
 */
function makeRig(jobs: FakeJob[] = [defaultJob()]): { fake: FakeRegistry; ctx: unknown } {
  const map = new Map(jobs.map((job) => [job.id, job]));
  const chunks = new Map<string, FakeChunk[]>();
  const fake: FakeRegistry = {
    listeners: [],
    unsubscribed: 0,
    jobs: map,
    chunks,
    kills: [],
    emit(event: FakeEvent): void {
      for (const entry of fake.listeners) entry.listener(event);
    },
    registry: undefined,
  };
  fake.registry = {
    events: {
      subscribe(filter: { owners: string }, listener: (event: FakeEvent) => void) {
        fake.listeners.push({ filter, listener });
        return () => {
          fake.unsubscribed += 1;
          fake.listeners = fake.listeners.filter((entry) => entry.listener !== listener);
        };
      },
    },
    list: (caller?: string) => [...map.values()].filter((job) => job.owner === undefined || job.owner === caller),
    get: (id: string) => {
      const job = map.get(id);
      if (job === undefined) throw new Error("job not found: " + id);
      return job;
    },
    readAt: (id: string, from: number) => {
      const all = chunks.get(id) ?? [];
      const kept = all.filter((chunk) => chunk.at + chunk.text.length > from);
      const earliest = kept[0]?.at ?? 0;
      const total = all.reduce((sum, chunk) => sum + chunk.text.length, 0);
      return { chunks: kept, next: total, lossy: from < earliest };
    },
    kill: (id: string, caller?: string, reason?: string) => {
      fake.kills.push({ id, caller, reason });
      return "requested";
    },
  };
  const real = new ContextCtor();
  const ctx = new Proxy(real, {
    get(target, prop) {
      if (prop === "jobs") return fake.registry;
      if (prop === "typert") return {};
      if (prop === "logger") return { warn: () => undefined, info: () => undefined };
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === "function" ? (value as (...params: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { fake, ctx };
}

/**
 * Cấu hình đã qua schema của CHÍNH bên đó (Loader luôn áp mặc định trước constructor).
 * Nhận: lớp gói.
 * Trả: cấu hình đã phân giải.
 */
function resolvedConfig(plugin: typeof stock): unknown {
  const schema = (plugin.JobController as unknown as { Config: (value: unknown) => unknown }).Config;
  return schema({});
}

/**
 * Dựng một thực thể của MỘT bên cài trên giàn của nó.
 * Nhận: lớp gói, giàn (fake + ctx), và phần ghi đè cấu hình THÔ.
 * Trả: thực thể service.
 */
function makeService(
  plugin: typeof stock,
  fake: FakeRegistry,
  ctx: unknown,
  raw: Record<string, unknown> = {},
): Record<string, unknown> {
  const Ctor = plugin.JobController as unknown as new (ctx: unknown, config: unknown) => Record<string, unknown>;
  const schema = (Ctor as unknown as { Config: (value: unknown) => unknown }).Config;
  return new Ctor(ctx, schema(raw));
}

/**
 * Thu TOÀN BỘ khung của một dòng bất đồng bộ (tới limit khung), huỷ sau mỗi khung.
 * Nhận: dòng cần đọc, tín hiệu huỷ, số khung tối đa.
 * Trả: dãy khung đã thu.
 */
async function collect<T>(stream: AsyncIterable<T>, controller: AbortController, limit = 8): Promise<T[]> {
  const out: T[] = [];
  const iterator = stream[Symbol.asyncIterator]();
  while (out.length < limit) {
    const next = await iterator.next();
    if (next.done === true) break;
    out.push(next.value);
    controller.abort();
  }
  await iterator.return?.(undefined);
  return out;
}

/**
 * Tên export của một file ESM đã build (cùng hai regex mà check:rows dùng).
 * Nhận: văn bản artifact.
 * Trả: danh sách tên export đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Hình dạng package.json của gói ta mà test đọc. */
interface PkgJson {
  /** Tên package. */
  name: string;
  /** Metadata gbh (KHÔNG có row — nửa host chưa mount được). */
  gbh?: { row?: unknown; peers?: string[]; tests?: string[]; draft?: string };
  /** Peer khai báo. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thật (phải RỖNG). */
  dependencies?: Record<string, string>;
}

/**
 * Đọc package.json của gói ta.
 * Nhận: không.
 * Trả: nội dung đã parse.
 */
function pkgJson(): PkgJson {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PkgJson;
}


/** Id row thật của gói trong dump oracle (KHÔNG phải tên thư mục). */
const ROW_ID = "job-controller";

describe("bề mặt gói: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (JobController + default)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-ajc-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["JobController", "default"]);
    // Hai module ngoài nạp LÚC CHẠY — đúng bản gốc; cordis/dsh-jobs/dsh-session chỉ mượn KIỂU.
    for (const specifier of ["@deepseek-ai/schemastery", "@deepseek-ai/dsh-typert-protocol"]) {
      expect(oursText).toContain('from "' + specifier + '"');
      expect(stockText).toContain('from "' + specifier + '"');
    }
    for (const specifier of ["@deepseek-ai/cordis", "@deepseek-ai/dsh-jobs"]) {
      expect(oursText).not.toContain('from "' + specifier + '"');
    }
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(pkgJson().name).toBe("@galaxy-blackhole/gbh-api-job-controller");
  });

  test("static inject + String(Config) + mặc định của schema TRÙNG bản gốc", () => {
    const ourClass = mine.JobController as unknown as { inject: string[]; Config: { toString(): string } };
    const stockClass = stock.JobController as unknown as { inject: string[]; Config: { toString(): string } };
    expect(ourClass.inject).toEqual(stockClass.inject);
    expect(ourClass.inject).toEqual(["jobs", "typert"]);
    expect(String(ourClass.Config)).toBe(String(stockClass.Config));
    const ourResolved = resolvedConfig(mine) as { observeFlushMs: number; observeMaxFrameBytes: number };
    const stockResolved = resolvedConfig(stock) as { observeFlushMs: number; observeMaxFrameBytes: number };
    expect(ourResolved).toEqual(stockResolved);
    expect(ourResolved.observeFlushMs).toBe(100);
    expect(ourResolved.observeMaxFrameBytes).toBe(65536);
    const failure = (schema: (value: unknown) => unknown, raw: unknown): string => {
      try {
        schema(raw);
        return "KHONG NEM";
      } catch (error) {
        return (error as Error).message;
      }
    };
    const ourSchema = (mine.JobController as unknown as { Config: (value: unknown) => unknown }).Config;
    const stockSchema = (stock.JobController as unknown as { Config: (value: unknown) => unknown }).Config;
    for (const raw of [{ observeFlushMs: 0 }, { observeMaxFrameBytes: 0 }, { observeFlushMs: 1.5 }]) {
      expect(failure(ourSchema, raw)).toBe(failure(stockSchema, raw));
      expect(failure(ourSchema, raw)).not.toBe("KHONG NEM");
    }
  });

  test("marker @Remote trên prototype TRÙNG bản gốc: cùng số marker, cùng mode stream/đơn", () => {
    const ourRig = makeRig();
    const stockRig = makeRig();
    const ourService = makeService(mine, ourRig.fake, ourRig.ctx);
    const stockService = makeService(stock, stockRig.fake, stockRig.ctx);
    const shape = (markers: readonly { method?: string; name?: string; mode?: string }[]) =>
      markers.map((marker) => ({ name: marker.name, method: marker.method, mode: marker.mode }));
    const ourMarkers = shape(remoteMethods(ourService));
    const stockMarkers = shape(remoteMethods(stockService));
    expect(ourMarkers).toEqual(stockMarkers);
    expect(ourMarkers.map((marker) => marker.name ?? marker.method)).toEqual(["list", "follow", "kill"]);
    expect(ourMarkers.slice(0, 2).map((marker) => marker.mode)).toEqual(["stream", "stream"]);
  });
});

describe("list — dòng danh sách job một phiên NHÌN THẤY", () => {
  test("khung đầu là TOÀN BỘ tập nhìn thấy; sự kiện vòng đời đánh thức, sự kiện output thì KHÔNG", async () => {
    const results: { first: unknown; second: unknown; unsubscribed: number }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig([
        defaultJob({ id: "bash-1" }),
        defaultJob({ id: "bash-2", owner: undefined }),
        defaultJob({ id: "bash-3", owner: "session-2" }),
      ]);
      const service = makeService(plugin, rig.fake, rig.ctx);
      const controller = new AbortController();
      const stream = (
        service["list"] as (r: unknown, s: AbortSignal) => AsyncIterable<{ type: string; jobs: { id: string }[] }>
      )({ sessionId: "session-1" }, controller.signal);
      const iterator = stream[Symbol.asyncIterator]();
      const first = await iterator.next();
      rig.fake.emit({ type: "output", id: "bash-1", job: rig.fake.jobs.get("bash-1") as FakeJob });
      let woke = false;
      const pending = iterator.next().then((value) => {
        woke = true;
        return value;
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(woke).toBe(false);
      rig.fake.jobs.set("bash-4", defaultJob({ id: "bash-4" }));
      rig.fake.emit({ type: "registered", job: rig.fake.jobs.get("bash-4") as FakeJob });
      const second = await pending;
      controller.abort();
      await iterator.return?.(undefined);
      results.push({ first: first.value, second: second.value, unsubscribed: rig.fake.unsubscribed });
    }
    expect(results[0]).toEqual(results[1]);
    const first = results[0]?.first as { type: string; jobs: { id: string }[] };
    expect(first.type).toBe("rows");
    expect(first.jobs.map((job) => job.id)).toEqual(["bash-1", "bash-2"]);
    expect((results[0]?.second as { jobs: { id: string }[] }).jobs.map((job) => job.id)).toEqual([
      "bash-1",
      "bash-2",
      "bash-4",
    ]);
    expect(results[0]?.unsubscribed).toBe(1);
  });

  test("tín hiệu đã huỷ TRƯỚC ⇒ NÉM AbortError, KHÔNG phát khung nào (cả hai bản)", async () => {
    const messages: string[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig();
      const service = makeService(plugin, rig.fake, rig.ctx);
      const controller = new AbortController();
      controller.abort();
      const stream = (
        service["list"] as (r: unknown, s: AbortSignal) => AsyncIterable<unknown>
      )({ sessionId: "session-1" }, controller.signal);
      try {
        await collect(stream, controller, 2);
        messages.push("KHONG NEM");
      } catch (error) {
        messages.push((error as Error).message);
      }
    }
    // ĐO ĐƯỢC: bản gốc gọi throwIfAborted() ở ĐẦU generator ⇒ NÉM, không im lặng trả dòng rỗng.
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toBe("The operation was aborted.");
  });
});

describe("follow — dòng đầu ra của MỘT job", () => {
  test("neo opened + gộp theo trần byte + status kết thúc: TRÙNG TỪNG KHUNG", async () => {
    const results: unknown[][] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig();
      const job = rig.fake.jobs.get("bash-1") as FakeJob;
      rig.fake.chunks.set("bash-1", [
        { at: 0, text: "0123456789" },
        { at: 10, text: "abcdefghij" },
      ]);
      job.output = { total: 20, earliest: 0 };
      const service = makeService(plugin, rig.fake, rig.ctx, { observeFlushMs: 5, observeMaxFrameBytes: 12 });
      const controller = new AbortController();
      const stream = (
        service["follow"] as (r: unknown, s: AbortSignal) => AsyncIterable<Record<string, unknown>>
      )({ sessionId: "session-1", jobId: "bash-1" }, controller.signal);
      const iterator = stream[Symbol.asyncIterator]();
      const frames: unknown[] = [];
      const first = await iterator.next();
      frames.push(first.value);
      job.status = "completed";
      rig.fake.emit({ type: "settled", job });
      const second = await iterator.next();
      const third = await iterator.next();
      frames.push(second.value, third.value);
      await iterator.return?.(undefined);
      results.push(frames);
    }
    expect(results[0]).toEqual(results[1]);
    const frames = results[0] as Record<string, unknown>[];
    expect(frames[0]?.["type"]).toBe("opened");
    expect(frames[0]?.["from"]).toBe(0);
    // ĐO ĐƯỢC: trần byte là MỀM và kiểm SAU KHI nạp mẩu ⇒ mẩu làm vượt trần đi CÙNG lô:
    // trần 12 byte + hai mẩu 10 byte ⇒ MỘT khung "output" mang CẢ HAI mẩu, next = 20.
    expect(frames[1]?.["type"]).toBe("output");
    expect((frames[1]?.["chunks"] as { text: string }[]).map((chunk) => chunk.text)).toEqual([
      "0123456789",
      "abcdefghij",
    ]);
    expect(frames[1]?.["next"]).toBe(20);
    // Sau khi job kết thúc và vòng đệm đã rút hết ⇒ khung CUỐI là "status" (không phải output rỗng).
    expect(frames[2]?.["type"]).toBe("status");
  });

  test("mốc from không hợp lệ ⇒ NÉM đúng thông điệp của bản gốc", async () => {
    const messages: (string | undefined)[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig();
      const service = makeService(plugin, rig.fake, rig.ctx);
      const controller = new AbortController();
      const stream = (
        service["follow"] as (r: unknown, s: AbortSignal) => AsyncIterable<unknown>
      )({ sessionId: "session-1", jobId: "bash-1", from: -1 }, controller.signal);
      try {
        await collect(stream, controller, 1);
        messages.push(undefined);
      } catch (error) {
        messages.push((error as Error).message);
      }
    }
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toBe("invalid observe offset: expected a non-negative safe integer, got -1");
  });

  test("mất byte (lossy) ⇒ khung đầu mang cờ, cờ chỉ dùng MỘT lần", async () => {
    const results: unknown[][] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig();
      const job = rig.fake.jobs.get("bash-1") as FakeJob;
      rig.fake.chunks.set("bash-1", [{ at: 5, text: "abcdefghij" }]);
      job.output = { total: 15, earliest: 5 };
      const service = makeService(plugin, rig.fake, rig.ctx, { observeFlushMs: 5 });
      const controller = new AbortController();
      const stream = (
        service["follow"] as (r: unknown, s: AbortSignal) => AsyncIterable<Record<string, unknown>>
      )({ sessionId: "session-1", jobId: "bash-1", from: 0 }, controller.signal);
      const iterator = stream[Symbol.asyncIterator]();
      const first = await iterator.next();
      const second = await iterator.next();
      job.status = "completed";
      rig.fake.emit({ type: "settled", job });
      const third = await iterator.next();
      await iterator.return?.(undefined);
      results.push([first.value, second.value, third.value]);
    }
    expect(results[0]).toEqual(results[1]);
    const frames = results[0] as Record<string, unknown>[];
    expect(frames[0]?.["type"]).toBe("opened");
    expect(frames[1]?.["lossy"]).toBe(true);
  });

  test("job bị XOÁ giữa thế hệ ⇒ dòng đóng bằng status của job đã xoá (không phải lần đọc hỏng)", async () => {
    const results: { value: unknown; done: boolean | undefined }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig();
      const job = rig.fake.jobs.get("bash-1") as FakeJob;
      job.output = { total: 0, earliest: 0 };
      const service = makeService(plugin, rig.fake, rig.ctx, { observeFlushMs: 5 });
      const controller = new AbortController();
      const stream = (
        service["follow"] as (r: unknown, s: AbortSignal) => AsyncIterable<Record<string, unknown>>
      )({ sessionId: "session-1", jobId: "bash-1" }, controller.signal);
      const iterator = stream[Symbol.asyncIterator]();
      await iterator.next();
      rig.fake.emit({ type: "removed", job });
      const next = await iterator.next();
      await iterator.return?.(undefined);
      results.push({ value: next.value, done: next.done });
    }
    expect(results[0]).toEqual(results[1]);
    expect((results[0]?.value as Record<string, unknown>)["type"]).toBe("status");
  });
});

describe("kill — huỷ job thay mặt NGƯỜI", () => {
  test("job nhìn thấy được ⇒ chuyển đúng id/phiên/lý do và trả requested", () => {
    const results: { value: unknown; kills: unknown }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig();
      const service = makeService(plugin, rig.fake, rig.ctx);
      const value = (service["kill"] as (r: unknown) => unknown)({ sessionId: "session-1", jobId: "bash-1" });
      results.push({ value, kills: rig.fake.kills });
    }
    expect(results[0]).toEqual(results[1]);
    expect(results[0]?.value).toEqual({ outcome: "requested" });
    expect(results[0]?.kills).toEqual([{ id: "bash-1", caller: "session-1", reason: "cancelled by the user" }]);
  });

  test("job KHÔNG tồn tại ⇒ ném RemoteError mã job/not-found kèm chi tiết (cả hai bản)", () => {
    const results: ({ code?: string; message?: string; details?: unknown } | undefined)[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig();
      const service = makeService(plugin, rig.fake, rig.ctx);
      let captured: { code?: string; message?: string; details?: unknown } | undefined;
      try {
        (service["kill"] as (r: unknown) => unknown)({ sessionId: "session-1", jobId: "khong-co" });
      } catch (error) {
        const typed = error as { code?: string; message?: string; details?: unknown };
        captured = { code: typed.code, message: typed.message, details: typed.details };
      }
      results.push(captured);
    }
    expect(results[0]).toEqual(results[1]);
    expect(results[0]?.code).toBe("job/not-found");
    // ĐO ĐƯỢC: RemoteError nhận String(error) của lần tra hỏng ⇒ thông điệp có tiền tố "Error: ".
    expect(results[0]?.message).toBe("Error: job not found: khong-co");
    expect(results[0]?.details).toEqual({ sessionId: "session-1", jobId: "khong-co" });
  });
});

describe("C6 — DANH TÍNH + quy ước repo", () => {
  test("hai thực thể KHÔNG chia sẻ vật thể: mỗi thực thể một bộ nghe riêng, dọn riêng", async () => {
    // Mỗi thực thể cần Context RIÊNG: khoá service 'jobController' là DUY NHẤT trên một context
    // (đây chính là lý do một row chỉ được mount một lần — bài học 'service has been registered').
    const rig = makeRig();
    const other = makeRig();
    const first = makeService(mine, rig.fake, rig.ctx);
    const second = makeService(mine, other.fake, other.ctx);
    expect(first).not.toBe(second);
    const controller = new AbortController();
    const stream = (
      first["list"] as (r: unknown, s: AbortSignal) => AsyncIterable<unknown>
    )({ sessionId: "session-1" }, controller.signal);
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();
    expect(rig.fake.listeners).toHaveLength(1);
    await iterator.return?.(undefined);
    expect(rig.fake.listeners).toHaveLength(0);
    expect(rig.fake.unsubscribed).toBe(1);
  });

  test("HAI MẶT đã đủ 4 artefact: KHÔNG khai gbh.row (chờ boot-smoke + dòng README §4)", () => {
    const json = pkgJson();
    // 19/10/2026 — BẤT BIẾN MỚI (thay 'KHÔNG khai gbh.row' đã stale sau khi row được khai/mount, như agent-loop đã làm):
    // row PHẢI được khai ở ĐÚNG MỘT trong hai khoá (flip ⇒ `gbh.row`; chưa flip ⇒ `gbh.row_unmounted_ly_do`),
    // có `id` + `tests`, và TUYỆT ĐỐI KHÔNG khai đồng thời cả hai (khai cả hai ⇒ patch mâu thuẫn, mount không xác định).
    const gbh = json.gbh as
      | { row?: { id?: string; aliases?: string[]; moduleIds?: string[]; tests?: string[] }; row_unmounted_ly_do?: { row?: { id?: string } } }
      | undefined;
    const daFlip = gbh?.row !== undefined;
    const dangPark = gbh?.row_unmounted_ly_do !== undefined;
    expect(daFlip || dangPark).toBe(true);
    expect(daFlip && dangPark).toBe(false);
    expect(gbh?.row?.id ?? gbh?.row_unmounted_ly_do?.row?.id).toBe(ROW_ID);
    // 19/10/2026 — CẬP NHẬT theo trạng thái mới (de-bundle 4 artefact): draft nay mô tả gói HAI MẶT, không còn "NỬA HOST".
    expect(json.gbh?.draft ?? "").toContain("4 artefact");
    // 19/10/2026 — gói đã de-bundle 4 artefact nên có THÊM bộ test A/B halves; gbh.tests liệt kê cả hai.
    expect(json.gbh?.tests).toEqual(["tests/host/api-job-controller.test.ts", "tests/host/api-job-controller-halves.test.ts"]);
    // Đối chứng DƯƠNG: bản gốc THẬT SỰ là gói hai mặt (có nửa client) ⇒ không mount được là ĐÚNG.
    const stockManifest = JSON.parse(
      readFileSync(
        join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-job-controller", "package.json"),
        "utf8",
      ),
    ) as { dsh?: { client?: unknown }; exports?: Record<string, unknown> };
    expect(stockManifest.dsh?.client).toBeDefined();
    expect(stockManifest.exports?.["./client"]).toBeDefined();
    expect(existsSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-job-controller", "lib", "client.js"))).toBe(true);
  });

  test("gbh.peers là TẬP CON của peerDependencies, không tên nào trong dependencies", () => {
    const json = pkgJson();
    const peers = json.peerDependencies ?? {};
    const declared = json.gbh?.peers ?? [];
    // 01/11/2026 — đồng bộ manifest theo stock: danh sách chọn lọc nay phủ ĐỦ bộ peer của gói (có thêm
    // `@deepseek-ai/cordis`), nên đếm cứng "3" là kỳ vọng CŨ. Giữ phép chống-verdict-rỗng bằng TẬP CON
    // bắt buộc + phép kiểm dải CHUẨN của repo (`peerRangeProblems`), KHÔNG nới lỏng phép ⊆.
    expect(declared).toEqual(expect.arrayContaining(["@deepseek-ai/cordis", "@deepseek-ai/dsh-jobs", "@deepseek-ai/dsh-session"]));
    expect(declared.filter((name) => !(name in peers))).toEqual([]);
    expect(peerRangeProblems(PKG)).toEqual([]);
    expect(Object.keys(json.dependencies ?? {})).toEqual([]);
  });
});