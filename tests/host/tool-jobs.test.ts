/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B cho gói tool-jobs: mỗi ca cài CẢ HAI bản (ta + bundle gốc @deepseek-ai/dsh-tool-jobs) lên CÙNG một giàn Context cordis THẬT rồi so tập export artifact, name/inject, Config (cùng là instance của lớp Schema THẬT của schemastery — String/defaults/lỗi), dây đăng ký, ba công cụ (name/description/parameters/output/render/presentCall), các nhánh execute và phân phối hoàn tất.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/tool-jobs/build.ts";
import * as oursModule from "../../packages/host/tool-jobs/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Bundle gốc đã build — bản đối chứng. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-jobs", "lib", "index.js");
/** Thư mục @deepseek-ai của KERNEL — nguồn DUY NHẤT cấp cordis/schemastery/… cho artefact của ta.
 * Vì sao (01/11/2026): gói workspace phân giải peer qua root node_modules/.bun còn kernel nằm ở
 * apps/host/node_modules; hai bản sao vật lý ⇒ `instanceof` và `getPrototypeOf` TRƯỢT. Dựng artefact
 * rồi symlink ĐÚNG thư mục kernel vào node_modules của nó (pattern tests/host/shell.test.ts) thì hai
 * bên dùng CHUNG một lớp. */
const KERNEL_AI = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** cordis của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** schemastery của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Schema. */
const SCHEMASTER = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "schemastery", "lib", "index.mjs");

/** Context cordis THẬT. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };
/** Lớp `Schema` THẬT của schemastery (default export của gói): dùng cho phép thử `instanceof`. */
const { default: SchemaClass } = (await import(SCHEMASTER)) as { default: abstract new (...args: never[]) => object };
/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as unknown as PluginLike;
/** Bản của ta (ARTEFACT đã build trong beforeAll) nhìn qua CÙNG hình dạng để so hai bên. */
let mine: PluginLike;

/** Hình dạng plugin tối thiểu mà test dùng (cả hai bản đều khớp). */
interface PluginLike {
  /** Tên plugin. */
  readonly name: string;
  /** Service bắt buộc. */
  readonly inject: readonly string[];
  /** Schema cấu hình (callable + Standard Schema). */
  readonly Config: ConfigSchemaLike;
  /**
   * Cài plugin lên context.
   * Nhận: ctx — Context cordis thật; config — cấu hình đã chuẩn hoá.
   * Trả: không.
   */
  readonly apply: (ctx: object, config: unknown) => void;
}

/** Schema cấu hình nhìn theo CẤU TRÚC. */
interface ConfigSchemaLike {
  /** Chuẩn hoá cấu hình; ném khi sai. */
  (value?: unknown): Record<string, unknown>;
  /** Loại nút gốc. */
  readonly type: unknown;
  /** Metadata nút gốc. */
  readonly meta: unknown;
  /** Từ điển trường. */
  readonly dict: Record<string, { toString(): string }>;
  /** Giao diện chuẩn. */
  readonly "~standard": { readonly version: unknown; readonly vendor: unknown; validate(value: unknown): unknown };
  /** Mô tả chuỗi. */
  toString(): string;
}

/** Ảnh chiếu job dùng trong giàn giả. */
interface JobViewLike {
  /** Id job. */
  id: string;
  /** Loại nhà sản xuất. */
  kind: string;
  /** Nhãn. */
  label: string;
  /** Trạng thái. */
  status: "running" | "stopping" | "completed" | "killed" | "failed";
  /** Chủ sở hữu. */
  owner?: string;
  /** Trần byte đầu ra. */
  outputLimitBytes?: number;
  /** Tiến trình. */
  progress?: string;
  /** Lý do kết thúc. */
  detail?: string;
  /** Mốc bắt đầu. */
  startedAt: number;
  /** Mốc kết thúc. */
  finishedAt?: number;
  /** Toạ độ ring + tệp spill. */
  output: { total: number; earliest: number; spillPaths?: string[] };
}

/** Một chunk đầu ra giả. */
interface ChunkLike {
  /** Offset tuyệt đối. */
  at: number;
  /** Văn bản. */
  text: string;
  /** Nhãn luồng. */
  channel?: "stdout" | "stderr" | "log";
  /** Dấu mất byte. */
  gapBefore?: true;
}

/** Kết quả đọc giả. */
interface JobReadLike {
  /** Chunk kể từ con trỏ. */
  chunks: ChunkLike[];
  /** Cờ mất byte. */
  lossy: boolean;
  /** Kết quả một lần. */
  result?: string;
  /** Ảnh chiếu sau đọc. */
  job: JobViewLike;
}

/** Sự kiện job giả (chỉ các trường plugin đọc). */
interface EventLike {
  /** Loại sự kiện. */
  type: string;
  /** Ảnh chiếu job. */
  job: JobViewLike;
  /** Nguyên nhân dừng. */
  cause?: "producer" | "kill" | "teardown";
  /** Có đánh thức người chờ. */
  awaited?: boolean;
}

/** Thông điệp người dùng đã bắt. */
interface MessageLike {
  /** Danh tính. */
  id: string;
  /** Vai trò. */
  role: string;
  /** Khối nội dung. */
  content: { type: string; text?: string }[];
  /** Nguồn. */
  source: { kind: string; form?: string; summary?: string };
}

/** Agent giả. */
interface FakeOwner {
  /** Id phiên. */
  readonly id: string;
  /** Trạng thái. */
  readonly status: "idle" | "running";
  /** Nhận thông điệp mở lượt. */
  followup(message: MessageLike): void;
  /** Nhận thông điệp chèn. */
  inject(message: MessageLike): void;
}

/** Vết gọi của giàn giả. */
interface Calls {
  /** Tên controller đã gắn. */
  controllers: string[];
  /** Bộ lọc đã đăng ký. */
  filters: unknown[];
  /** Listener sự kiện job. */
  listener?: (event: EventLike) => void;
  /** Lời gọi list. */
  lists: (string | undefined)[];
  /** Lời gọi read. */
  reads: { id: string; caller?: string }[];
  /** Lời gọi get. */
  gets: { id: string; caller?: string }[];
  /** Lời gọi kill. */
  kills: { id: string; caller?: string; reason?: string }[];
  /** Lời gọi wait. */
  waits: { id: string; timeoutMs: number; caller?: string; hasSignal: boolean }[];
  /** Lời gọi ctx.on. */
  ons: { event: string; options?: unknown }[];
}

/** Mục system prompt đã bắt. */
interface SectionLike {
  /** Tên mục. */
  name: string;
  /** Thứ tự. */
  order: number;
  /** Văn bản. */
  text: string;
}

/** Định nghĩa công cụ đã đăng ký. */
interface ToolLike {
  /** Tên. */
  readonly name: string;
  /** Mô tả. */
  readonly description: string;
  /** JSON Schema tham số. */
  readonly parameters: unknown;
  /** Schema đầu ra + render. */
  readonly output: { readonly schema: unknown; render(args: unknown, value: unknown): unknown };
  /** Thực thi. */
  execute(args: unknown, exec: unknown): Promise<unknown>;
  /** Cắt nội dung cuối. */
  finalizeContent?(exec: unknown, result: unknown): unknown;
  /** Trình bày lời gọi. */
  presentCall?(args: unknown): unknown;
}

/** Context cordis nhìn theo CẤU TRÚC. */
interface CtxLike {
  /** Cấp service. */
  provide(name: string, value: unknown): unknown;
  /** Tra service. */
  get(name: string): unknown;
  /** Nghe sự kiện. */
  on(event: string, listener: (...args: any[]) => unknown, options?: unknown): unknown;
  /** Phát sự kiện. */
  emit(event: string, ...args: unknown[]): unknown;
}

/** Giàn đo của MỘT bên cài. */
interface Harness {
  /** Context cordis thật. */
  readonly ctx: CtxLike;
  /** Công cụ đã đăng ký. */
  readonly tools: ToolLike[];
  /** Section đã đăng ký. */
  readonly sections: SectionLike[];
  /** Vết gọi. */
  readonly calls: Calls;
  /** Agent giả. */
  readonly owner: FakeOwner;
  /** Thông điệp đã giao: [kiểu, thông điệp]. */
  readonly deliveries: [string, MessageLike][];
}

/** Tuỳ chọn dựng giàn. */
interface MountOptions {
  /** Cấu hình thô đưa qua Config. */
  config?: Record<string, unknown>;
  /** Job trong sổ giả. */
  jobs?: JobViewLike[];
  /** Kết quả read giả. */
  read?: JobReadLike;
  /** Lỗi read giả. */
  readError?: string;
  /** Lỗi wait giả. */
  waitError?: string;
  /** Kết quả kill giả. */
  killResult?: "requested" | "already-finished";
  /** Trạng thái chủ sở hữu. */
  status?: "idle" | "running";
  /** Service cố ý thiếu. */
  missing?: "jobs" | "systemPrompt" | "tools";
}

/** Đường dẫn ARTIFACT của ta (gán trong beforeAll). */
let artifact = "";
/** Thư mục tạm chứa artifact (gán trong beforeAll). */
let outDir = "";

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-tool-jobs-"));
  artifact = await buildPackage(outDir);
  mkdirSync(join(outDir, "node_modules"), { recursive: true });
  symlinkSync(KERNEL_AI, join(outDir, "node_modules", "@deepseek-ai"), "dir"); symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(outDir, "node_modules", "@galaxy-blackhole"), "dir");
  mine = (await import(artifact)) as unknown as PluginLike;
}, 60_000);

afterAll(async () => {
  if (outDir !== "") await rm(outDir, { recursive: true, force: true });
});

/**
 * Liệt kê tên export của một file ESM đã build — ĐÚNG bốn khuôn mà tools/check/rows.ts dùng.
 * Nhận: nội dung artifact.
 * Trả: mảng tên export đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  return [...out].sort();
}

/**
 * Dựng job mẫu.
 * Nhận: overrides — trường ghi đè.
 * Trả: ảnh chiếu job.
 */
function baseJob(overrides: Partial<JobViewLike> = {}): JobViewLike {
  return {
    id: "bash-1",
    kind: "bash",
    label: "echo hi",
    status: "completed",
    detail: "exit code: 0",
    startedAt: 1000,
    finishedAt: 2000,
    owner: "s1",
    output: { total: 10, earliest: 0 },
    ...overrides,
  };
}

/**
 * Dựng kết quả đọc mẫu (stdout + stderr + log + spill + result).
 * Nhận: overrides — trường ghi đè.
 * Trả: kết quả đọc.
 */
function baseRead(overrides: Partial<JobReadLike> = {}): JobReadLike {
  return {
    chunks: [
      { at: 0, channel: "stdout", text: "hello" },
      { at: 5, channel: "stderr", text: "warn\n" },
      { at: 10, channel: "log", text: "noise" },
    ],
    lossy: false,
    result: "done",
    job: baseJob({ output: { total: 10, earliest: 0, spillPaths: ["/tmp/spill"] } }),
    ...overrides,
  };
}

/**
 * Sổ jobs giả: đủ bảy thành viên plugin gọi, không chạm tiến trình thật.
 * Nhận: options — kịch bản; calls — vết; fixture — job trong sổ.
 * Trả: service jobs.
 */
function makeJobs(options: MountOptions, calls: Calls, fixture: JobViewLike[]): object {
  return {
    attachController(name: string): () => void {
      calls.controllers.push(name);
      return () => undefined;
    },
    events: {
      subscribe(filter: unknown, listener: (event: EventLike) => void): () => void {
        calls.filters.push(filter);
        calls.listener = listener;
        return () => undefined;
      },
    },
    list(caller?: string): JobViewLike[] {
      calls.lists.push(caller);
      return fixture.filter((job) => job.owner === undefined || job.owner === caller);
    },
    get(id: string, caller?: string): JobViewLike {
      calls.gets.push({ id, caller });
      const found = fixture.find((job) => job.id === id);
      if (found === undefined) throw new Error("unknown job " + id);
      return found;
    },
    read(id: string, caller?: string): JobReadLike {
      calls.reads.push({ id, caller });
      if (options.readError !== undefined) throw new Error(options.readError);
      return options.read ?? baseRead();
    },
    kill(id: string, caller?: string, reason?: string): "requested" | "already-finished" {
      calls.kills.push({ id, caller, reason });
      return options.killResult ?? "requested";
    },
    wait(id: string, timeoutMs: number, caller?: string, signal?: AbortSignal): Promise<JobViewLike> {
      calls.waits.push({ id, timeoutMs, caller, hasSignal: signal !== undefined });
      if (options.waitError !== undefined) return Promise.reject(new Error(options.waitError));
      return Promise.resolve(fixture.find((job) => job.id === id) ?? baseJob());
    },
  };
}

/**
 * Dựng Context cordis THẬT + các service GIẢ rồi gọi apply của MỘT bên.
 * Nhận: plugin — bề mặt module; options — bật/tắt service + kịch bản giả.
 * Trả: giàn đo đã cài.
 */
function mount(plugin: PluginLike, options: MountOptions = {}): Harness {
  const deliveries: [string, MessageLike][] = [];
  const owner: FakeOwner = {
    id: "s1",
    status: options.status ?? "idle",
    followup(message: MessageLike): void {
      deliveries.push(["followup", message]);
    },
    inject(message: MessageLike): void {
      deliveries.push(["inject", message]);
    },
  };
  const owners = new Map<string, FakeOwner>([["s1", owner]]);
  const tools: ToolLike[] = [];
  const sections: SectionLike[] = [];
  const calls: Calls = { controllers: [], filters: [], lists: [], reads: [], gets: [], kills: [], waits: [], ons: [] };
  const fixture = options.jobs ?? [baseJob()];
  const ctx = new ContextCtor() as unknown as CtxLike;
  const originalOn = ctx.on.bind(ctx);
  ctx.on = (event: string, listener: (...args: any[]) => unknown, opts?: unknown): unknown => {
    calls.ons.push({ event, options: opts });
    return originalOn(event, listener, opts);
  };
  if (options.missing !== "jobs") ctx.provide("jobs", makeJobs(options, calls, fixture));
  if (options.missing !== "tools") {
    ctx.provide("tools", {
      register(definition: ToolLike): () => void {
        tools.push(definition);
        return () => undefined;
      },
    });
  }
  if (options.missing !== "systemPrompt") {
    ctx.provide("systemPrompt", {
      getSectionOrder(name: string): number {
        return name === "TOOL_JOBS" ? 1600 : 0;
      },
      section(section: SectionLike): () => void {
        sections.push(section);
        return () => undefined;
      },
    });
  }
  ctx.provide("agents", { get: (id: string): FakeOwner | undefined => owners.get(id) });
  plugin.apply(ctx, plugin.Config(options.config ?? {}));
  return { ctx, tools, sections, calls, owner, deliveries };
}

/**
 * Cài MỘT bên và trả lỗi ném ra (nếu có).
 * Nhận: plugin — bề mặt module; missing — service cố ý thiếu.
 * Trả: thông điệp lỗi, hoặc "no throw".
 */
function applyError(plugin: PluginLike, missing: MountOptions["missing"]): string {
  try {
    mount(plugin, { missing });
    return "no throw";
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * Lấy định nghĩa công cụ theo tên.
 * Nhận: harness — giàn đã cài; name — tên công cụ.
 * Trả: định nghĩa công cụ.
 * @throws {Error} khi không có công cụ tên đó.
 */
function toolNamed(harness: Harness, name: string): ToolLike {
  const tool = harness.tools.find((entry) => entry.name === name);
  if (tool === undefined) throw new Error("missing tool " + name);
  return tool;
}

/**
 * Dựng exec giả.
 * Nhận: name — tên công cụ; args — tham số; agentId — id phiên.
 * Trả: exec mà execute đọc.
 */
function execution(name: string, args: unknown, agentId = "s1"): object {
  return { name, arguments: args, agent: { id: agentId }, signal: new AbortController().signal };
}

/**
 * Chạy một promise và bắt lỗi.
 * Nhận: fn — thunk trả promise.
 * Trả: value khi thành công, message/name khi ném.
 */
async function capture(fn: () => Promise<unknown>): Promise<{ value?: unknown; error?: string; errorName?: string }> {
  try {
    return { value: await fn() };
  } catch (error) {
    return { error: (error as Error).message, errorName: (error as Error).name };
  }
}

/**
 * Chạy một phép đồng bộ và bắt lỗi.
 * Nhận: fn — thunk.
 * Trả: value khi thành công, message/name khi ném.
 */
function captureSync(fn: () => unknown): { value?: unknown; error?: string; errorName?: string } {
  try {
    return { value: fn() };
  } catch (error) {
    return { error: (error as Error).message, errorName: (error as Error).name };
  }
}

/**
 * Bóc thông điệp đã giao thành hình dạng so được (bỏ id UUID).
 * Nhận: deliveries — các cặp [kiểu, thông điệp].
 * Trả: mảng hình dạng so được.
 */
function deliveryShapes(deliveries: [string, MessageLike][]): unknown[] {
  return deliveries.map(([kind, message]) => ({
    kind,
    role: message.role,
    content: message.content,
    source: message.source,
  }));
}

describe("A. TẬP EXPORT + name/inject — ta phải BẰNG bản gốc", () => {
  test("4 export BẰNG TỪNG TÊN trên artifact: Config · apply · inject · name", () => {
    const oursNames = exportNames(readFileSync(artifact, "utf8"));
    const stockNames = exportNames(readFileSync(STOCK, "utf8"));
    expect(oursNames).toEqual(stockNames);
    expect(oursNames).toEqual(["Config", "apply", "inject", "name"]);
    expect(Object.keys(oursModule).sort()).toEqual(Object.keys(stock).sort());
    expect((oursModule as unknown as { default?: unknown }).default).toBeUndefined();
    expect(mine.apply.length).toBe(stock.apply.length);
  });

  test("artifact là ESM host, không có __ModuleLoader__, nạp schemastery y NHƯ bản gốc", () => {
    const code = readFileSync(artifact, "utf8");
    const stockCode = readFileSync(STOCK, "utf8");
    expect(/^import\s/m.test(code)).toBe(true);
    expect(code.includes("__ModuleLoader__")).toBe(false);
    // Config giờ là z.object THẬT ⇒ artifact nạp schemastery đúng như bundle gốc (shim cũ thì không).
    expect(code.includes('from "@deepseek-ai/schemastery"')).toBe(true);
    expect(stockCode.includes('from "@deepseek-ai/schemastery"')).toBe(true);
  });

  test("name 'tool-jobs' + inject ['tools','jobs','systemPrompt'] — hai bản trùng khít", () => {
    expect(mine.name).toBe(stock.name);
    expect(mine.name).toBe("tool-jobs");
    expect([...mine.inject]).toEqual([...stock.inject]);
    expect([...mine.inject]).toEqual(["tools", "jobs", "systemPrompt"]);
  });
});

describe("B. Config — String + defaults + mọi nhánh lỗi", () => {
  test("String(Config) TRÙNG từng ký tự; keys/type/meta/dict/~standard khớp", () => {
    const ours = mine.Config;
    const theirs = stock.Config;
    expect(String(ours)).toBe(String(theirs));
    expect(String(ours)).toBe('{ waitTimeoutMs?: number, maxWaitTimeoutMs?: number, completionDelivery?: "quiet" | "wakeup", maxConsecutiveWakes?: number }');
    expect(Object.keys(ours)).toEqual(Object.keys(theirs));
    expect(ours.type).toEqual(theirs.type);
    expect(ours.meta).toEqual(theirs.meta);
    expect(Object.keys(ours.dict)).toEqual(Object.keys(theirs.dict));
    for (const key of Object.keys(theirs.dict)) expect(String(ours.dict[key])).toBe(String(theirs.dict[key]));
    expect(ours["~standard"].version).toBe(theirs["~standard"].version);
    expect(ours["~standard"].vendor).toBe(theirs["~standard"].vendor);
    expect(Object.keys(ours)).not.toContain("~standard");
  });

  test("Config mặc định/khoá lạ/giá trị đủ: CÙNG object + CÙNG thứ tự khoá", () => {
    const inputs: unknown[] = [undefined, {}, null, { waitTimeoutMs: 1, maxWaitTimeoutMs: 2, completionDelivery: "quiet", maxConsecutiveWakes: 3 }, { extra: 1, waitTimeoutMs: 5 }, { foo: undefined }];
    for (const input of inputs) {
      const ours = mine.Config(input);
      const theirs = stock.Config(input);
      expect(ours).toEqual(theirs);
      expect(Object.keys(ours)).toEqual(Object.keys(theirs));
    }
    expect(mine.Config({})).toEqual({ waitTimeoutMs: 30000, maxWaitTimeoutMs: 600000, completionDelivery: "wakeup" });
  });

  test("Config nhánh null/NaN/Infinity và union — giữ NGUYÊN hành vi schemastery", () => {
    const cases: unknown[] = [{ waitTimeoutMs: null }, { waitTimeoutMs: NaN }, { waitTimeoutMs: Infinity }, { maxConsecutiveWakes: null }, { completionDelivery: null }, { maxConsecutiveWakes: 1.5 }];
    for (const input of cases) {
      const ours = mine.Config(input) as Record<string, unknown>;
      const theirs = stock.Config(input) as Record<string, unknown>;
      expect(Object.keys(ours)).toEqual(Object.keys(theirs));
      for (const key of Object.keys(theirs)) expect(Object.is(ours[key], theirs[key])).toBe(true);
    }
  });

  test("Config nhánh lỗi: kiểu/giới hạn/gốc — CÙNG thông điệp + CÙNG name", () => {
    const inputs: unknown[] = [{ waitTimeoutMs: 0 }, { waitTimeoutMs: "x" }, { maxWaitTimeoutMs: 0 }, { completionDelivery: "x" }, { completionDelivery: 5 }, { maxConsecutiveWakes: "a" }, { maxConsecutiveWakes: 0 }, [], 5, "x"];
    for (const input of inputs) {
      const ours = captureSync(() => mine.Config(input));
      const theirs = captureSync(() => stock.Config(input));
      expect(ours.error).toBe(theirs.error);
      expect(ours.errorName).toBe(theirs.errorName);
      expect(ours.errorName).toBe("ValidationError");
    }
    expect(captureSync(() => mine.Config({ waitTimeoutMs: 0 })).error).toBe("$.waitTimeoutMs expected number >= 1 but got 0");
  });

  test("~standard.validate trả value/issues giống hệt (cordis đọc ĐÚNG đường này)", () => {
    const inputs: unknown[] = [undefined, null, {}, { waitTimeoutMs: 0 }, { completionDelivery: "x" }, { extra: 1 }, [], 5];
    for (const input of inputs) {
      expect(mine.Config["~standard"].validate(input)).toEqual(stock.Config["~standard"].validate(input));
    }
    expect(mine.Config["~standard"].validate({ waitTimeoutMs: 0 })).toEqual({
      issues: [{ message: "$.waitTimeoutMs expected number >= 1 but got 0", path: ["waitTimeoutMs"] }],
    });
  });

  test("Config của TA và của bản GỐC cùng instanceof lớp Schema THẬT của schemastery; String(Config) vẫn TRÙNG từng ký tự", () => {
    expect(SchemaClass.name).toBe("Schema");
    expect(mine.Config instanceof SchemaClass).toBe(true);
    expect(stock.Config instanceof SchemaClass).toBe(true);
    // Cùng MỘT lớp (không phải hai bản schemastery): prototype của hai schema TRÙNG NHAU và TRÙNG lớp.
    expect(Object.getPrototypeOf(mine.Config)).toBe(Object.getPrototypeOf(stock.Config));
    expect(Object.getPrototypeOf(mine.Config)).toBe(SchemaClass.prototype);
    expect(mine.Config.constructor).toBe(stock.Config.constructor);
    // Bốn nút con cũng là schema THẬT của schemastery, không phải object mô phỏng cấu trúc.
    for (const key of ["waitTimeoutMs", "maxWaitTimeoutMs", "completionDelivery", "maxConsecutiveWakes"]) {
      expect(mine.Config.dict[key] instanceof SchemaClass).toBe(true);
      expect(mine.Config.dict[key]?.toString()).toBe(stock.Config.dict[key]?.toString());
    }
    // Đổi sang z.object thật KHÔNG được đổi một ký tự nào của String(Config).
    expect(String(mine.Config)).toBe('{ waitTimeoutMs?: number, maxWaitTimeoutMs?: number, completionDelivery?: "quiet" | "wakeup", maxConsecutiveWakes?: number }');
    expect(String(mine.Config)).toBe(String(stock.Config));
  });
});

describe("C. Dây đăng ký — controller · filter · prompt · pre-execute", () => {
  test("attachController 'tool-jobs' + subscribe {owners:'scope'} + section tool:jobs/1600 TRÙNG", () => {
    const ours = mount(mine);
    const theirs = mount(stock);
    expect(ours.calls.controllers).toEqual(theirs.calls.controllers);
    expect(ours.calls.controllers).toEqual(["tool-jobs"]);
    expect(ours.calls.filters).toEqual(theirs.calls.filters);
    expect(ours.calls.filters).toEqual([{ owners: "scope" }]);
    expect(ours.sections).toEqual(theirs.sections);
    expect(ours.sections).toEqual([
      {
        name: "tool:jobs",
        order: 1600,
        text: "Track every background job id you start. You are notified in-session when a job finishes — do not busy-poll or sleep on one; keep working on independent steps and do not duplicate a running job's work. Before giving a final answer, collect every still-relevant job with job_output (set wait: true only when you are genuinely blocked on it), and job_kill jobs that stopped mattering.",
      },
    ]);
    expect(ours.calls.ons).toEqual(theirs.calls.ons);
    expect(ours.calls.ons).toEqual([{ event: "tools/pre-execute", options: { prepend: true } }]);
  });

  test("maxConsecutiveWakes thêm listener agent/inbox/claimed — đúng thứ tự đăng ký", () => {
    const ours = mount(mine, { config: { maxConsecutiveWakes: 2 } });
    const theirs = mount(stock, { config: { maxConsecutiveWakes: 2 } });
    expect(ours.calls.ons).toEqual(theirs.calls.ons);
    expect(ours.calls.ons.map((entry) => entry.event)).toEqual(["agent/inbox/claimed", "tools/pre-execute"]);
  });
});

describe("D. Ba công cụ — name/description/parameters/output/render/presentCall", () => {
  test("ba định nghĩa ĐÚNG thứ tự: job_output · job_list · job_kill", () => {
    const ours = mount(mine);
    const theirs = mount(stock);
    expect(ours.tools.map((tool) => tool.name)).toEqual(theirs.tools.map((tool) => tool.name));
    expect(ours.tools.map((tool) => tool.name)).toEqual(["job_output", "job_list", "job_kill"]);
  });

  test("description TRÙNG từng ký tự", () => {
    const ours = mount(mine);
    const theirs = mount(stock);
    expect(ours.tools.map((tool) => tool.description)).toEqual(theirs.tools.map((tool) => tool.description));
    expect(toolNamed(ours, "job_output").description).toBe(
      "Read a background job: output since the previous read for stream jobs, or the result of a finished final-output job.",
    );
    expect(toolNamed(ours, "job_list").description).toBe("List your background jobs (running and finished) with their ids, kinds, and statuses.");
    expect(toolNamed(ours, "job_kill").description).toBe("Request cancellation of a running background job.");
  });

  test("parameters + output.schema TRÙNG sâu (defineTool biên dịch cùng một DSL)", () => {
    const ours = mount(mine);
    const theirs = mount(stock);
    for (const name of ["job_output", "job_list", "job_kill"]) {
      expect(toolNamed(ours, name).parameters).toEqual(toolNamed(theirs, name).parameters);
      expect(toolNamed(ours, name).output.schema).toEqual(toolNamed(theirs, name).output.schema);
    }
  });

  test("render: output rỗng/xuống dòng · list rỗng/đầy · kill hai nhánh — TRÙNG", () => {
    const ours = mount(mine);
    const theirs = mount(stock);
    const outputValues = [
      { text: "hello\n", job: baseJob({ progress: "1/2" }) },
      { text: "", job: baseJob({ detail: undefined }) },
      { text: "raw", job: baseJob() },
    ];
    for (const value of outputValues) {
      expect(toolNamed(ours, "job_output").output.render({}, value)).toEqual(toolNamed(theirs, "job_output").output.render({}, value));
    }
    expect(toolNamed(ours, "job_output").output.render({}, outputValues[0])).toEqual([{ type: "text", text: "hello\n[status: completed, exit code: 0]" }]);
    expect(toolNamed(ours, "job_list").output.render({}, [])).toEqual([{ type: "text", text: "(no background jobs)" }]);
    const list = [baseJob(), baseJob({ id: "bash-2", kind: "workflow", status: "running", label: "wf", detail: undefined })];
    expect(toolNamed(ours, "job_list").output.render({}, list)).toEqual(toolNamed(theirs, "job_list").output.render({}, list));
    expect(toolNamed(ours, "job_list").output.render({}, list)).toEqual([{ type: "text", text: "bash-1 [bash] completed — echo hi\nbash-2 [workflow] running — wf" }]);
    for (const value of [
      { outcome: "cancellation-requested", job: baseJob() },
      { outcome: "already-finished", job: baseJob({ detail: undefined }) },
    ]) {
      expect(toolNamed(ours, "job_kill").output.render({}, value)).toEqual(toolNamed(theirs, "job_kill").output.render({}, value));
    }
    expect(toolNamed(ours, "job_kill").output.render({}, { outcome: "already-finished", job: baseJob({ detail: undefined }) })).toEqual([
      { type: "text", text: "job bash-1 had already finished [status: completed]" },
    ]);
  });

  test("presentCall TRÙNG: title · kind · rawInput (list KHÔNG có rawInput)", () => {
    const ours = mount(mine);
    const theirs = mount(stock);
    const calls: [string, unknown][] = [
      ["job_output", { job_id: "bash-1" }],
      ["job_list", {}],
      ["job_kill", { job_id: "bash-1", reason: "x" }],
    ];
    for (const [name, args] of calls) {
      expect(toolNamed(ours, name).presentCall?.(args)).toEqual(toolNamed(theirs, name).presentCall?.(args));
    }
    expect(toolNamed(ours, "job_output").presentCall?.({ job_id: "bash-1" })).toEqual({
      card: "generic",
      title: "Read output from background job bash-1",
      kind: "read",
      rawInput: "bash-1",
    });
    expect(toolNamed(ours, "job_list").presentCall?.({})).toEqual({ card: "generic", title: "List background jobs", kind: "read" });
    expect(toolNamed(ours, "job_kill").presentCall?.({ job_id: "bash-1" })).toEqual({
      card: "generic",
      title: "Kill background job bash-1",
      kind: "execute",
      rawInput: "bash-1",
    });
  });
});

describe("E. execute — happy path + mọi nhánh lỗi", () => {
  test("job_output đọc: value {text,job} + caller/signal đúng — TRÙNG", async () => {
    const options: MountOptions = { read: baseRead() };
    const ours = mount(mine, options);
    const theirs = mount(stock, options);
    const args = { job_id: "bash-1" };
    const left = await capture(() => toolNamed(ours, "job_output").execute(args, execution("job_output", args)));
    const right = await capture(() => toolNamed(theirs, "job_output").execute(args, execution("job_output", args)));
    expect(left).toEqual(right);
    expect(left.value).toEqual({ text: "hello\n[stderr]\nwarn\ndone", job: { id: "bash-1", kind: "bash", label: "echo hi", status: "completed", detail: "exit code: 0", startedAt: 1000, finishedAt: 2000 } });
    expect(ours.calls.reads).toEqual(theirs.calls.reads);
    expect(ours.calls.reads).toEqual([{ id: "bash-1", caller: "s1" }]);
    expect(ours.calls.waits).toEqual([]);
  });

  test("job_output wait: trần mặc định 30000 · timeout bị kẹp 600000 · cờ false không chờ — TRÙNG", async () => {
    for (const args of [
      { job_id: "bash-1", wait: true },
      { job_id: "bash-1", wait: true, timeout_ms: 999999 },
      { job_id: "bash-1", wait: false, timeout_ms: 5 },
    ]) {
      const ours = mount(mine);
      const theirs = mount(stock);
      const left = await capture(() => toolNamed(ours, "job_output").execute(args, execution("job_output", args)));
      const right = await capture(() => toolNamed(theirs, "job_output").execute(args, execution("job_output", args)));
      expect(left).toEqual(right);
      expect(ours.calls.waits).toEqual(theirs.calls.waits);
    }
    const harness = mount(mine, { config: { waitTimeoutMs: 500, maxWaitTimeoutMs: 1000 } });
    const args = { job_id: "bash-1", wait: true, timeout_ms: 5000 };
    await capture(() => toolNamed(harness, "job_output").execute(args, execution("job_output", args)));
    expect(harness.calls.waits[0]?.timeoutMs).toBe(1000);
  });

  test("job_output lỗi: job_id rỗng · read ném · wait ném — CÙNG thông điệp", async () => {
    const cases: { options: MountOptions; args: unknown }[] = [
      { options: {}, args: { job_id: "" } },
      { options: { readError: "unknown job" }, args: { job_id: "bash-404" } },
      { options: { waitError: "waiter aborted" }, args: { job_id: "bash-1", wait: true } },
    ];
    for (const item of cases) {
      const ours = mount(mine, item.options);
      const theirs = mount(stock, item.options);
      const left = await capture(() => toolNamed(ours, "job_output").execute(item.args, execution("job_output", item.args)));
      const right = await capture(() => toolNamed(theirs, "job_output").execute(item.args, execution("job_output", item.args)));
      expect(left).toEqual(right);
      expect(left.error).toBeDefined();
    }
    expect((await capture(() => toolNamed(mount(mine), "job_output").execute({ job_id: "" }, execution("job_output", { job_id: "" })))).error).toBe(
      'invalid job_id: expected a non-empty string, got ""',
    );
  });

  test("job_list: caller s1 · mảng ảnh chiếu công khai · rỗng — TRÙNG", async () => {
    for (const jobs of [[baseJob(), baseJob({ id: "bash-2", kind: "workflow", status: "running", label: "wf", detail: undefined })], []]) {
      const ours = mount(mine, { jobs });
      const theirs = mount(stock, { jobs });
      const left = await capture(() => toolNamed(ours, "job_list").execute({}, execution("job_list", {})));
      const right = await capture(() => toolNamed(theirs, "job_list").execute({}, execution("job_list", {})));
      expect(left).toEqual(right);
      expect(ours.calls.lists).toEqual(theirs.calls.lists);
    }
  });

  test("job_kill: requested/already-finished · reason · get sau kill — TRÙNG", async () => {
    for (const killResult of ["requested", "already-finished"] as const) {
      const ours = mount(mine, { killResult });
      const theirs = mount(stock, { killResult });
      const args = { job_id: "bash-1", reason: "stop" };
      const left = await capture(() => toolNamed(ours, "job_kill").execute(args, execution("job_kill", args)));
      const right = await capture(() => toolNamed(theirs, "job_kill").execute(args, execution("job_kill", args)));
      expect(left).toEqual(right);
      expect(ours.calls.kills).toEqual(theirs.calls.kills);
      expect(ours.calls.gets).toEqual(theirs.calls.gets);
      expect((left.value as { outcome: string }).outcome).toBe(killResult === "requested" ? "cancellation-requested" : "already-finished");
    }
    const empty = await capture(() => toolNamed(mount(mine), "job_kill").execute({ job_id: "" }, execution("job_kill", { job_id: "" })));
    expect(empty.error).toBe('invalid job_id: expected a non-empty string, got ""');
  });

  test("finalizeContent: trần undefined · khớp status · lệch nội dung · kill · isError · trần 0 — TRÙNG", () => {
    const result = {
      isError: false,
      value: { text: "hello\n", job: baseJob({ progress: "1/2" }) },
      content: [{ type: "text", text: "hello\n[status: completed, 1/2]" }],
    };
    for (const limit of [undefined, 5, 10, 25, 100, 0]) {
      const ours = mount(mine, { jobs: [baseJob({ outputLimitBytes: limit })] });
      const theirs = mount(stock, { jobs: [baseJob({ outputLimitBytes: limit })] });
      const left = toolNamed(ours, "job_output").finalizeContent?.(execution("job_output", { job_id: "bash-1" }), result);
      const right = toolNamed(theirs, "job_output").finalizeContent?.(execution("job_output", { job_id: "bash-1" }), result);
      expect(left).toEqual(right);
      if (limit === undefined) expect(left).toBeUndefined();
    }
    for (const limit of [1.5, -1]) {
      const odd = mount(mine, { jobs: [baseJob({ outputLimitBytes: limit })] });
      const oddStock = mount(stock, { jobs: [baseJob({ outputLimitBytes: limit })] });
      const left = captureSync(() => toolNamed(odd, "job_output").finalizeContent?.(execution("job_output", { job_id: "bash-1" }), result));
      const right = captureSync(() => toolNamed(oddStock, "job_output").finalizeContent?.(execution("job_output", { job_id: "bash-1" }), result));
      expect(left).toEqual(right);
      expect(left.error).toBe("maxBytes must be a non-negative integer");
    }
    const mismatched = { isError: false, value: { text: "hello", job: baseJob() }, content: [{ type: "text", text: "DIFFERENT" }] };
    const ours = mount(mine, { jobs: [baseJob({ outputLimitBytes: 12 })] });
    const theirs = mount(stock, { jobs: [baseJob({ outputLimitBytes: 12 })] });
    expect(toolNamed(ours, "job_output").finalizeContent?.(execution("job_output", { job_id: "bash-1" }), mismatched)).toEqual(
      toolNamed(theirs, "job_output").finalizeContent?.(execution("job_output", { job_id: "bash-1" }), mismatched),
    );
    const failed = { isError: true, error: { message: "x" }, content: [{ type: "text", text: "failure text long enough" }] };
    expect(toolNamed(ours, "job_output").finalizeContent?.(execution("job_output", { job_id: "bash-1" }), failed)).toEqual(
      toolNamed(theirs, "job_output").finalizeContent?.(execution("job_output", { job_id: "bash-1" }), failed),
    );
    const killed = { isError: false, value: { outcome: "cancellation-requested", job: baseJob() }, content: [{ type: "text", text: "requested cancellation of job bash-1" }] };
    expect(toolNamed(ours, "job_kill").finalizeContent?.(execution("job_kill", { job_id: "bash-1" }), killed)).toEqual(
      toolNamed(theirs, "job_kill").finalizeContent?.(execution("job_kill", { job_id: "bash-1" }), killed),
    );
    const limited = mount(mine, { jobs: [baseJob({ outputLimitBytes: 0 })] });
    const limitedStock = mount(stock, { jobs: [baseJob({ outputLimitBytes: 0 })] });
    expect(toolNamed(limited, "job_output").finalizeContent?.(execution("job_output", { job_id: "bash-1" }), result)).toEqual(
      toolNamed(limitedStock, "job_output").finalizeContent?.(execution("job_output", { job_id: "bash-1" }), result),
    );
  });

  test("pre-execute ghi trần vào WeakMap; non-job_output/job_id hỏng không ghi — TRÙNG", () => {
    const ours = mount(mine, { jobs: [baseJob({ outputLimitBytes: 10 })] });
    const theirs = mount(stock, { jobs: [baseJob({ outputLimitBytes: 10 })] });
    const exec = execution("job_output", { job_id: "bash-1" });
    ours.ctx.emit("tools/pre-execute", exec, () => Promise.resolve({ kind: "allow" }));
    theirs.ctx.emit("tools/pre-execute", exec, () => Promise.resolve({ kind: "allow" }));
    const fixture = ours.calls.lists.length;
    const fixtureStock = theirs.calls.lists.length;
    expect(fixture).toBe(fixtureStock);
    expect(fixture).toBe(1);
    expect(ours.calls.lists).toEqual(theirs.calls.lists);
    for (const bad of [{ name: "job_list", arguments: { job_id: "bash-1" } }, { name: "job_output", arguments: { job_id: "" } }, { name: "job_output", arguments: { job_id: 7 } }]) {
      ours.ctx.emit("tools/pre-execute", bad, () => Promise.resolve({ kind: "allow" }));
      theirs.ctx.emit("tools/pre-execute", bad, () => Promise.resolve({ kind: "allow" }));
    }
    expect(ours.calls.lists).toEqual(theirs.calls.lists);
  });
});

describe("F. Phân phối hoàn tất — followup/inject + trần byte + wake budget + killed", () => {
  test("idle ⇒ followup · running ⇒ inject · quiet ⇒ inject — nội dung/source TRÙNG", () => {
    const scenarios: { options: MountOptions; expectKind: string }[] = [
      { options: {}, expectKind: "followup" },
      { options: { status: "running" }, expectKind: "inject" },
      { options: { config: { completionDelivery: "quiet" } }, expectKind: "inject" },
    ];
    for (const scenario of scenarios) {
      const ours = mount(mine, scenario.options);
      const theirs = mount(stock, scenario.options);
      const event: EventLike = { type: "settled", job: baseJob(), cause: "producer", awaited: false };
      ours.calls.listener?.(event);
      theirs.calls.listener?.(event);
      expect(deliveryShapes(ours.deliveries)).toEqual(deliveryShapes(theirs.deliveries));
      expect(ours.deliveries[0]?.[0]).toBe(scenario.expectKind);
      expect(ours.deliveries).toHaveLength(1);
    }
    const ours = mount(mine);
    ours.calls.listener?.({ type: "settled", job: baseJob(), cause: "producer", awaited: false });
    const message = ours.deliveries[0]?.[1];
    expect(message?.content).toEqual([{ type: "text", text: "background job bash-1 (bash: echo hi) finished [status: completed, exit code: 0]. Read its output with job_output." }]);
    expect(message?.source).toEqual({ kind: "tool-jobs", form: "notice", summary: "bash echo hi [status: completed, exit code: 0]" });
    expect(message?.role).toBe("user");
    expect(message?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(Object.isFrozen(message)).toBe(true);
    expect(Object.isFrozen(message?.content)).toBe(true);
  });

  test("awaited · teardown · không chủ · removed · progress đều KHÔNG giao — TRÙNG", () => {
    const events: EventLike[] = [
      { type: "settled", job: baseJob(), cause: "producer", awaited: true },
      { type: "settled", job: baseJob(), cause: "teardown", awaited: false },
      { type: "settled", job: baseJob({ owner: undefined }), cause: "producer", awaited: false },
      { type: "removed", job: baseJob() },
      { type: "progress", job: baseJob() },
    ];
    for (const event of events) {
      const ours = mount(mine);
      const theirs = mount(stock);
      ours.calls.listener?.(event);
      theirs.calls.listener?.(event);
      expect(deliveryShapes(ours.deliveries)).toEqual(deliveryShapes(theirs.deliveries));
      expect(ours.deliveries).toHaveLength(0);
    }
  });

  test("trần outputLimitBytes: thông báo co đúng thứ tự ưu tiên, TRÙNG từng ký tự", () => {
    for (const limit of [200, 120, 90, 60, 40, 20, 0]) {
      const ours = mount(mine, { jobs: [baseJob({ outputLimitBytes: limit })] });
      const theirs = mount(stock, { jobs: [baseJob({ outputLimitBytes: limit })] });
      const event: EventLike = { type: "settled", job: baseJob({ outputLimitBytes: limit }), cause: "producer", awaited: false };
      ours.calls.listener?.(event);
      theirs.calls.listener?.(event);
      expect(deliveryShapes(ours.deliveries)).toEqual(deliveryShapes(theirs.deliveries));
    }
  });

  test("wake budget: 1 lượt followup rồi inject; nguồn user đặt lại; nguồn khác KHÔNG", () => {
    const ours = mount(mine, { config: { maxConsecutiveWakes: 1 } });
    const theirs = mount(stock, { config: { maxConsecutiveWakes: 1 } });
    const settle = (): void => {
      const event: EventLike = { type: "settled", job: baseJob(), cause: "producer", awaited: false };
      ours.calls.listener?.(event);
      theirs.calls.listener?.(event);
    };
    settle();
    settle();
    expect(deliveryShapes(ours.deliveries)).toEqual(deliveryShapes(theirs.deliveries));
    expect(ours.deliveries.map(([kind]) => kind)).toEqual(["followup", "inject"]);
    ours.ctx.emit("agent/inbox/claimed", { agent: ours.owner, message: { source: { kind: "tool" } } });
    theirs.ctx.emit("agent/inbox/claimed", { agent: theirs.owner, message: { source: { kind: "tool" } } });
    settle();
    expect(ours.deliveries.map(([kind]) => kind)).toEqual(["followup", "inject", "inject"]);
    ours.ctx.emit("agent/inbox/claimed", { agent: ours.owner, message: { source: { kind: "user" } } });
    theirs.ctx.emit("agent/inbox/claimed", { agent: theirs.owner, message: { source: { kind: "user" } } });
    settle();
    expect(deliveryShapes(ours.deliveries)).toEqual(deliveryShapes(theirs.deliveries));
    expect(ours.deliveries.map(([kind]) => kind)).toEqual(["followup", "inject", "inject", "followup"]);
  });

  test("job_kill do mô hình gọi ⇒ settled bị chặn; removed xoá dấu ⇒ giao lại — TRÙNG", async () => {
    const ours = mount(mine);
    const theirs = mount(stock);
    for (const harness of [ours, theirs]) {
      await capture(() => toolNamed(harness, "job_kill").execute({ job_id: "bash-1" }, execution("job_kill", { job_id: "bash-1" })));
      harness.calls.listener?.({ type: "settled", job: baseJob(), cause: "kill", awaited: false });
    }
    expect(deliveryShapes(ours.deliveries)).toEqual(deliveryShapes(theirs.deliveries));
    expect(ours.deliveries).toHaveLength(0);
    const oursTwo = mount(mine);
    const theirsTwo = mount(stock);
    for (const harness of [oursTwo, theirsTwo]) {
      await capture(() => toolNamed(harness, "job_kill").execute({ job_id: "bash-1" }, execution("job_kill", { job_id: "bash-1" })));
      harness.calls.listener?.({ type: "removed", job: baseJob() });
      harness.calls.listener?.({ type: "settled", job: baseJob(), cause: "kill", awaited: false });
    }
    expect(deliveryShapes(oursTwo.deliveries)).toEqual(deliveryShapes(theirsTwo.deliveries));
    expect(oursTwo.deliveries).toHaveLength(1);
  });
});

describe("G. Thiếu service + cấu hình sai trong apply — cùng hành vi", () => {
  test("thiếu jobs/systemPrompt/tools: CÙNG lỗi TypeError ở CÙNG bước", () => {
    for (const missing of ["jobs", "systemPrompt", "tools"] as const) {
      const ours = applyError(mine, missing);
      const theirs = applyError(stock, missing);
      expect(ours).toBe(theirs);
      expect(ours).toContain("undefined");
    }
    expect(applyError(mine, "jobs")).toContain("attachController");
    expect(applyError(mine, "systemPrompt")).toContain("section");
    expect(applyError(mine, "tools")).toContain("register");
  });

  test("cấu hình sai: wait > cap · wake không nguyên (1.5/null) — TRÙNG + ném TRƯỚC mọi đăng ký", () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ waitTimeoutMs: 10, maxWaitTimeoutMs: 5 }, "tool-jobs: waitTimeoutMs (10) exceeds maxWaitTimeoutMs (5)"],
      [{ maxConsecutiveWakes: 1.5 }, "tool-jobs: maxConsecutiveWakes (1.5) must be a whole number of turns"],
      [{ maxConsecutiveWakes: null }, "tool-jobs: maxConsecutiveWakes (null) must be a whole number of turns"],
    ];
    for (const [config, message] of cases) {
      let ours = "no throw";
      let theirs = "no throw";
      try {
        mount(mine, { config });
      } catch (error) {
        ours = (error as Error).message;
      }
      try {
        mount(stock, { config });
      } catch (error) {
        theirs = (error as Error).message;
      }
      expect(ours).toBe(theirs);
      expect(ours).toBe(message);
    }
  });
});
