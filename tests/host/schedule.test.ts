/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test đối chứng row schedule: ≥18 ca A/B giữa bundle gốc @deepseek-ai/dsh-schedule và artefact của ta,
 *      chạy trên Context cordis THẬT với đồng hồ giả (setSystemTime) và timer giả (stub setTimeout/setInterval).
 */

import { afterAll, afterEach, beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/schedule/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói schedule của ta. */
const PKG = join(REPO, "packages", "host", "schedule");
/** Bundle GỐC của DSH (chỉ đọc). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-schedule", "lib", "index.js");
/** Cordis THẬT của runtime app. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục artefact tạm của lượt test (dọn ở afterAll). */
const ARTIFACT_DIR = join(PKG, "lib", ".test-build");
/** Tệp artefact dựng bằng buildPackage(). */
const ARTIFACT = join(ARTIFACT_DIR, "index.js");
/** Mốc đồng hồ giả cố định cho mọi phép so. */
const NOW = Date.parse("2026-10-19T01:00:00.000Z");
/** Danh tính bản ghi cố định. */
const ID = "schedule-1";

/** Bề mặt module schedule mà test gọi tới (hai bên cùng hình dạng). */
interface ScheduleSurface {
  readonly default: unknown;
  readonly ScheduleService: ServiceCtor;
  readonly ScheduleId: (value: string) => string;
  readonly ScheduleInputError: new () => unknown;
  readonly ScheduleLogError: new () => unknown;
  readonly MAX_TITLE_LENGTH: number;
  readonly MIN_EVERY_INTERVAL_SECONDS: number;
  readonly REQUIRED_TITLE_MESSAGE: string;
  readonly SCHEDULE_CHANGE_VERSION: number;
  readonly canonicalizeCronExpression: (expression: string) => string;
  readonly createAfterScheduleRecord: (id: string, prompt: string, afterSeconds: number, now: number, title: string) => unknown;
  readonly createAtScheduleRecord: (id: string, prompt: string, at: unknown, now: number, title: string) => unknown;
  readonly createCronScheduleRecord: (id: string, prompt: string, cron: unknown, now: number, title: string) => unknown;
  readonly createDailyScheduleRecord: (id: string, prompt: string, daily: unknown, now: number, title: string) => unknown;
  readonly createEveryScheduleRecord: (id: string, prompt: string, everySeconds: number, now: number, title: string) => unknown;
  readonly createWeeklyScheduleRecord: (id: string, prompt: string, weekly: unknown, now: number, title: string) => unknown;
  readonly decodeScheduleChange: (value: unknown) => unknown;
  readonly decodeScheduleRecord: (value: unknown) => unknown;
  readonly foldScheduleEvents: (events: readonly unknown[], inheritedEventCount?: number) => unknown;
  readonly isRecurringScheduleRecord: (record: unknown) => boolean;
  readonly normalizeWeekdays: (weekdays: unknown) => number[];
  readonly parseCronInput: (cron: unknown) => unknown;
  readonly parseWeeklyInput: (weekly: unknown) => unknown;
  readonly renderRecurringReminderBatchFraming: (reminders: readonly unknown[]) => string;
  readonly renderReminderFraming: (record: unknown) => string;
  readonly resolveCronOccurrence: (record: unknown, acceptedAt: number) => unknown;
  readonly resolveDailyOccurrence: (record: unknown, acceptedAt: number) => unknown;
  readonly resolveEveryOccurrence: (record: unknown, acceptedAt: number) => unknown;
  readonly resolveRecurringOccurrence: (record: unknown, acceptedAt: number) => unknown;
  readonly resolveWeeklyOccurrence: (record: unknown, acceptedAt: number) => unknown;
  readonly scheduleDomain: unknown;
  readonly scheduleTitle: (title: string) => string;
  readonly scheduleView: (record: unknown, now: number) => unknown;
  readonly weeklyTime: (value: string) => unknown;
}

/** Thể hiện dịch vụ schedule mà test gọi tới. */
interface ServiceLike {
  create(sessionId: string, request: Record<string, unknown>): Promise<Record<string, unknown>>;
  list(request: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  catalog(): Promise<Record<string, unknown>[]>;
  history(request: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(request: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(request: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** Lớp dịch vụ kèm static inject/Config. */
interface ServiceCtor {
  new (ctx: unknown, config?: Record<string, unknown>): ServiceLike;
  readonly inject: readonly string[];
  readonly Config: (value: unknown) => unknown;
}

/** Context cordis nhìn qua đúng hai phép test dùng. */
interface ContextLike {
  provide(name: string, value: unknown): void;
  logger: { warn(...args: unknown[]): void };
}

/** Một lỗi đã chuẩn hoá để so nguyên văn. */
interface Failure {
  readonly name: string;
  readonly code: string;
  readonly message: string;
}

/** Kết quả một lần gọi: giá trị, hoặc lỗi đã chuẩn hoá. */
type Attempt = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: Failure };
/** Một dòng tác vụ giả trong bảng tasks. */
type Row = Record<string, unknown>;
/** Cặp kết quả hai bên. */
type Pair = { readonly base: unknown; readonly artifact: unknown };

/** Host giả: bảng tasks + seam agents/sessions/sessionController/logger. */
interface FakeHost {
  readonly rows: Map<string, Row>;
  readonly warns: string[];
  readonly followups: Row[];
  readonly flushes: { count: number };
  readonly storageDomain: { open(spec: unknown): Promise<unknown> };
  readonly agents: { get(id: string): unknown; withoutInitiator<T>(operation: () => T): T };
  readonly sessions: { flush(session: unknown): Promise<boolean> };
  readonly sessionController: { resolveAgent(sessionId: string): Promise<unknown> };
}

/** Bản ghi timer giả: delay đã hẹn và handle đã huỷ. */
interface TimerRecording {
  readonly delays: number[];
  readonly cleared: unknown[];
  restore(): void;
}

/** Bề mặt GỐC, nạp trong beforeAll. */
let stock: ScheduleSurface;
/** Bề mặt artefact của ta, nạp trong beforeAll sau khi build. */
let ours: ScheduleSurface;
/** Lớp Context của cordis thật. */
let ContextCtor: new () => ContextLike;

/** Ép một giá trị về object để đọc trường, báo lỗi rõ khi không phải object. */
function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("cần một object: " + String(value));
  return value as Record<string, unknown>;
}

/** Đọc các khoá riêng của một object, đã sắp tăng dần. */
function keysOf(value: unknown): string[] {
  return Object.keys(asRecord(value)).sort();
}

/** JSON chuẩn tắc: khoá object sắp tăng dần, mảng giữ nguyên thứ tự. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key: string, item: unknown): unknown => {
    if (item instanceof Date) return item.toISOString();
    if (item === null || typeof item !== "object" || Array.isArray(item)) return item;
    const record = item as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = record[key];
    return sorted;
  });
}

/** Chuẩn hoá một lỗi ném ra thành bộ ba name/code/message. */
function failureOf(error: unknown): Failure {
  const record = (error !== null && typeof error === "object" ? error : {}) as { name?: unknown; code?: unknown };
  return { name: String(record.name ?? ""), code: String(record.code ?? ""), message: error instanceof Error ? error.message : String(error) };
}

/** Chạy một phép đồng bộ, bắt lỗi thành Failure. */
function attempt(run: () => unknown): Attempt {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    return { ok: false, error: failureOf(error) };
  }
}

/** So ca HỢP LỆ: cả hai bên chạy được, JSON (chuỗi thì từng ký tự) bằng nhau. */
function bothValues(label: string, run: (surface: ScheduleSurface) => unknown): Pair {
  const base = attempt(() => run(stock));
  const artifact = attempt(() => run(ours));
  if (!base.ok) throw new Error(label + ": bản gốc ném " + base.error.name + "/" + base.error.code + ": " + base.error.message);
  if (!artifact.ok) throw new Error(label + ": bản ta ném " + artifact.error.name + "/" + artifact.error.code + ": " + artifact.error.message);
  expect(canonical(artifact.value), label).toBe(canonical(base.value));
  if (typeof base.value === "string") expect(artifact.value, label + " (chuỗi)").toBe(base.value);
  return { base: base.value, artifact: artifact.value };
}

/** So ca HỎNG: cả hai bên ném và bộ ba lỗi bằng nhau nguyên văn. */
function bothFailures(label: string, run: (surface: ScheduleSurface) => unknown): { readonly base: Failure; readonly artifact: Failure } {
  const base = attempt(() => run(stock));
  const artifact = attempt(() => run(ours));
  if (base.ok) throw new Error(label + ": bản gốc KHÔNG ném");
  if (artifact.ok) throw new Error(label + ": bản ta KHÔNG ném");
  expect(canonical(artifact.error), label).toBe(canonical(base.error));
  return { base: base.error, artifact: artifact.error };
}

/** Mẫu UUID của id do create() sinh, dùng để che khác biệt ngẫu nhiên. */
const UUID = /schedule-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** JSON chuẩn tắc đã che id/messageId ngẫu nhiên. */
function masked(value: unknown): string {
  return canonical(value).replace(UUID, "schedule-<uuid>").replace(/"messageId":"[^"]*"/g, '"messageId":"<message-id>"');
}

/** Dựng host giả với bảng tasks và bốn seam mà dịch vụ/runtime gọi. */
function fakeHost(records: readonly Row[] = [], mode: "ok" | "error" = "ok", status: "active" | "inactive" = "active"): FakeHost {
  const rows = new Map<string, Row>();
  for (const record of records) {
    rows.set(String(record["id"]), { sessionId: "sess-1", record, status, deliveryHistory: { records: [], earlierRecordsUnavailable: false } });
  }
  const warns: string[] = [];
  const followups: Row[] = [];
  const flushes = { count: 0 };
  const table = {
    entries: (): IterableIterator<[string, Row]> => rows.entries(),
    get: (id: string): Row | undefined => rows.get(id),
    put: async (id: string, task: Row): Promise<void> => { rows.set(id, task); },
    delete: async (id: string): Promise<boolean> => rows.delete(id),
  };
  const domain = {
    table(name: string): unknown {
      if (name !== "tasks") throw new Error("bảng lạ: " + name);
      return table;
    },
    close: async (): Promise<void> => {},
  };
  return {
    rows, warns, followups, flushes,
    storageDomain: { open: async (): Promise<unknown> => domain },
    agents: { get: (): undefined => undefined, withoutInitiator: <T>(operation: () => T): T => operation() },
    sessions: { flush: async (): Promise<boolean> => { flushes.count += 1; return true; } },
    sessionController: {
      resolveAgent: async (): Promise<unknown> => {
        if (mode === "error") return { error: new Error("không có agent cho sess-1") };
        return { agent: { session: { id: "sess-1" }, followup: (message: Row): void => { followups.push(message); } } };
      },
    },
  };
}

/** Dựng dịch vụ schedule trên MỘT Context cordis thật với đủ seam giả. */
async function boot(surface: ScheduleSurface, host: FakeHost): Promise<ServiceLike> {
  const ctx = new ContextCtor();
  ctx.provide("storageDomain", host.storageDomain);
  ctx.provide("agents", host.agents);
  ctx.provide("sessions", host.sessions);
  ctx.provide("sessionController", host.sessionController);
  ctx.provide("sessionPersistence", {});
  ctx.logger.warn = (...args: unknown[]): void => { host.warns.push(args.map(String).join(" ")); };
  return new surface.ScheduleService(ctx, {});
}

/** Chờ một điều kiện chỉ bằng microtask — TUYỆT ĐỐI không chờ timer thật. */
async function until(condition: () => boolean, label: string): Promise<number> {
  for (let tick = 0; tick < 800; tick += 1) {
    if (condition()) return tick;
    await Promise.resolve();
  }
  throw new Error("đồng hồ giả không đạt điều kiện: " + label);
}

/** Cho hàng đợi microtask rút cạn thêm một quãng ngắn. */
async function settle(): Promise<void> {
  for (let tick = 0; tick < 30; tick += 1) await Promise.resolve();
}

/** Thay setTimeout/setInterval bằng bản ghi delay, không bao giờ chờ thật. */
function recordTimers(): TimerRecording {
  const delays: number[] = [];
  const cleared: unknown[] = [];
  const original = {
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval,
  };
  let nextId = 1;
  const schedule = ((...args: unknown[]): unknown => {
    delays.push(typeof args[1] === "number" ? args[1] : 0);
    const id = nextId;
    nextId += 1;
    return { id, ref(): unknown { return this; }, unref(): unknown { return this; }, hasRef(): boolean { return false; } };
  }) as unknown as typeof setTimeout;
  const cancel = ((id?: unknown): void => { cleared.push(id); }) as unknown as typeof clearTimeout;
  globalThis.setTimeout = schedule;
  globalThis.setInterval = schedule as unknown as typeof setInterval;
  globalThis.clearTimeout = cancel;
  globalThis.clearInterval = cancel as unknown as typeof clearInterval;
  return {
    delays, cleared,
    restore: (): void => {
      globalThis.setTimeout = original.setTimeout;
      globalThis.setInterval = original.setInterval;
      globalThis.clearTimeout = original.clearTimeout;
      globalThis.clearInterval = original.clearInterval;
    },
  };
}

/** Dựng bộ sáu bản ghi mẫu (after/at/every/daily/weekly/cron) từ một bên. */
function sampleRecords(surface: ScheduleSurface): Record<string, Row> {
  return {
    after: asRecord(surface.createAfterScheduleRecord(ID, "Nhắc", 90, NOW, "Tên")),
    at: asRecord(surface.createAtScheduleRecord(ID, "Nhắc", "2026-10-20T09:30:00+07:00", NOW, "Tên")),
    every: asRecord(surface.createEveryScheduleRecord(ID, "Nhắc", 3600, NOW, "Tên")),
    daily: asRecord(surface.createDailyScheduleRecord(ID, "Nhắc", { time: "07:00:00", time_zone: "Europe/Berlin" }, NOW, "Tên")),
    weekly: asRecord(surface.createWeeklyScheduleRecord(ID, "Nhắc", { time: "07:00:00", time_zone: "Europe/Berlin", weekdays: [5, 1] }, NOW, "Tên")),
    cron: asRecord(surface.createCronScheduleRecord(ID, "Nhắc", { expression: "0 9 * * 1-5", time_zone: "UTC" }, NOW, "Tên")),
  };
}

/** Ca gọi đồng bộ trên một bề mặt. */
type SurfaceCase = readonly [string, (surface: ScheduleSurface) => unknown];

/** Chạy một kịch bản dịch vụ trên cả hai bên rồi so JSON đã che id ngẫu nhiên. */
async function serviceValues(label: string, run: (surface: ScheduleSurface) => Promise<unknown>): Promise<Pair> {
  const base = await run(stock);
  const artifact = await run(ours);
  expect(masked(artifact), label).toBe(masked(base));
  return { base, artifact };
}

/** Đếm số biên nhận giao đã lưu của một dòng. */
function deliveryCount(row: Row | undefined): number {
  if (row === undefined) return 0;
  const history = row["deliveryHistory"];
  if (history === null || typeof history !== "object") return 0;
  const records = asRecord(history)["records"];
  return Array.isArray(records) ? records.length : 0;
}

/** Rút văn bản khung từ một message createUserMessage. */
function messageText(message: Row): string {
  const content = message["content"];
  if (!Array.isArray(content)) throw new Error("message thiếu content");
  return String(asRecord(content[0])["text"]);
}

beforeAll(async () => {
  expect(await buildPackage(ARTIFACT_DIR)).toBe(ARTIFACT);
  ours = (await import(ARTIFACT)) as unknown as ScheduleSurface;
  stock = (await import(STOCK)) as unknown as ScheduleSurface;
  ContextCtor = ((await import(CORDIS)) as { Context: new () => ContextLike }).Context;
});

afterAll(async () => {
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
});

afterEach(() => {
  setSystemTime();
});

describe("① bề mặt xuất + cấu hình", () => {
  test("34 khoá runtime TRÙNG tập (không thiếu/không thừa), default === ScheduleService", () => {
    const stockKeys = keysOf(stock);
    expect(keysOf(ours)).toEqual(stockKeys);
    expect(stockKeys).toHaveLength(34);
    expect(ours.default).toBe(ours.ScheduleService);
    expect(stock.default).toBe(stock.ScheduleService);
    const stockRecord = stock as unknown as Record<string, unknown>;
    const oursRecord = ours as unknown as Record<string, unknown>;
    for (const key of stockKeys) expect(typeof oursRecord[key], "kiểu của " + key).toBe(typeof stockRecord[key]);
    expect(typeof ours.ScheduleService).toBe("function");
    expect(typeof ours.ScheduleInputError).toBe("function");
    expect(typeof ours.ScheduleLogError).toBe("function");
    for (const key of ["MAX_TITLE_LENGTH", "MIN_EVERY_INTERVAL_SECONDS", "SCHEDULE_CHANGE_VERSION", "REQUIRED_TITLE_MESSAGE"] as const) {
      expect(ours[key]).toBe(stock[key]);
    }
  });

  test("static inject + String(Config) BẰNG NHAU từng ký tự", () => {
    const expected = ["agents", "sessions", "storageDomain", "sessionController", "sessionPersistence"];
    expect([...ours.ScheduleService.inject]).toEqual(expected);
    expect([...stock.ScheduleService.inject]).toEqual(expected);
    const stockConfig = String(stock.ScheduleService.Config);
    expect(String(ours.ScheduleService.Config), "String(Config)").toBe(stockConfig);
    expect(stockConfig).toBe("{ deliveryHistoryDays?: number, deliveryHistoryRecords?: number }");
    expect(canonical(ours.ScheduleService.Config({}))).toBe(canonical(stock.ScheduleService.Config({})));
    expect(canonical(ours.ScheduleService.Config({ deliveryHistoryDays: 7 }))).toBe(canonical(stock.ScheduleService.Config({ deliveryHistoryDays: 7 })));
    expect(asRecord(ours.ScheduleService.Config({}))["deliveryHistoryDays"]).toBe(30);
    expect(asRecord(ours.ScheduleService.Config({}))["deliveryHistoryRecords"]).toBe(200);
  });

  test("scheduleDomain: tên, version, bảng tasks A/B", () => {
    for (const surface of [stock, ours]) {
      const domain = asRecord(surface.scheduleDomain);
      expect(domain["name"]).toBe("schedule");
      expect(domain["version"]).toBe(1);
      expect(keysOf(domain["tables"])).toEqual(["tasks"]);
      expect(keysOf(domain)).toEqual(["name", "tables", "version"]);
    }
  });
});

describe("② tạo + giải mã bản ghi", () => {
  /** Sáu phép tạo hợp lệ, mỗi kiểu một ca. */
  const CREATE_CASES: readonly SurfaceCase[] = [
    ["after", (s) => s.createAfterScheduleRecord(ID, "  Nhắc  ", 90, NOW, "  Tên  ")],
    ["at", (s) => s.createAtScheduleRecord(ID, "Nhắc", "2026-10-20T09:30:00+07:00", NOW, "Tên")],
    ["every", (s) => s.createEveryScheduleRecord(ID, "Nhắc", 3600, NOW, "Tên")],
    ["daily", (s) => s.createDailyScheduleRecord(ID, "Nhắc", { time: "07:00:00", time_zone: "Europe/Berlin" }, NOW, "Tên")],
    ["weekly", (s) => s.createWeeklyScheduleRecord(ID, "Nhắc", { time: "07:00:00", time_zone: "Europe/Berlin", weekdays: [5, 1] }, NOW, "Tên")],
    ["cron", (s) => s.createCronScheduleRecord(ID, "Nhắc", { expression: "0 9 * * 1-5", time_zone: "UTC" }, NOW, "Tên")],
  ];

  test("create after/at/every/daily/weekly/cron: A/B JSON + đóng băng", () => {
    for (const [label, run] of CREATE_CASES) {
      const { base, artifact } = bothValues("create " + label, run);
      expect(Object.isFrozen(base), label + " bản gốc đóng băng").toBe(true);
      expect(Object.isFrozen(artifact), label + " bản ta đóng băng").toBe(true);
    }
    expect(asRecord(bothValues("create after", CREATE_CASES[0]![1]).artifact)["title"]).toBe("Tên");
    expect(asRecord(bothValues("create after", CREATE_CASES[0]![1]).artifact)["prompt"]).toBe("Nhắc");
  });

  test("decodeScheduleRecord: 6 bản ghi hợp lệ A/B JSON", () => {
    const records = sampleRecords(ours);
    for (const [label, record] of Object.entries(records)) {
      const { base, artifact } = bothValues("decode " + label, (s) => s.decodeScheduleRecord(record));
      expect(Object.isFrozen(base)).toBe(true);
      expect(Object.isFrozen(artifact)).toBe(true);
    }
    expect(Object.keys(records)).toHaveLength(6);
  });

  test("decodeScheduleRecord: 12 ca hỏng A/B name+code+message NGUYÊN VĂN", () => {
    const BASE_AFTER: Row = { id: ID, kind: "after", title: "T", prompt: "p", afterSeconds: 60, scheduledAt: "2026-10-19T02:00:00.000Z" };
    const cases: readonly (readonly [string, unknown])[] = [
      ["null", null],
      ["thiếu kind", {}],
      ["thiếu title", { ...BASE_AFTER, title: undefined }],
      ["thừa khoá", { ...BASE_AFTER, extra: 1 }],
      ["title chưa trim", { ...BASE_AFTER, title: " T " }],
      ["every nhịp 0", { id: "s2", kind: "every", title: "T", prompt: "p", everySeconds: 0, scheduledAt: "2026-10-19T02:00:00.000Z" }],
      ["daily giờ sai", { id: "s3", kind: "daily", title: "T", prompt: "p", time: "07:00", timeZone: "UTC", scheduledAt: "2026-10-19T02:00:00.000Z" }],
      ["daily vùng sai", { id: "s3", kind: "daily", title: "T", prompt: "p", time: "07:00:00.000", timeZone: "Mars/Base", scheduledAt: "2026-10-19T02:00:00.000Z" }],
      ["weekly thứ chưa sắp", { id: "s4", kind: "weekly", title: "T", prompt: "p", time: "07:00:00.000", timeZone: "UTC", weekdays: [7, 1], scheduledAt: "2026-10-19T02:00:00.000Z" }],
      ["cron chưa chuẩn tắc", { id: "s5", kind: "cron", title: "T", prompt: "p", expression: "0-59/5 * * * *", timeZone: "UTC", scheduledAt: "2026-10-19T02:00:00.000Z" }],
      ["cron instant sai", { id: "s6", kind: "cron", title: "T", prompt: "p", expression: "0 0 * * *", timeZone: "UTC", scheduledAt: "2026-02-30T00:00:00.000Z" }],
      ["kind lạ", { id: "s7", kind: "hourly", title: "T", prompt: "p", scheduledAt: "2026-10-19T02:00:00.000Z" }],
    ];
    for (const [label, value] of cases) {
      const { artifact } = bothFailures("decode hỏng " + label, (s) => s.decodeScheduleRecord(value));
      expect(artifact.name, label).toBe("ScheduleLogError");
      expect(artifact.code, label).toBe("corrupt_schedule_log");
      expect(artifact.message.length, label).toBeGreaterThan(0);
    }
  });

  test("decodeScheduleChange: create/delete/dispatch hợp lệ A/B JSON", () => {
    const records = sampleRecords(ours);
    const changes: readonly unknown[] = [
      { version: 1, operation: "create", schedule: records["after"] },
      { version: 1, operation: "delete", id: ID },
      { version: 1, operation: "dispatch", id: ID },
      { version: 1, operation: "dispatch", id: ID, acceptedAt: "2026-10-19T02:00:00.000Z" },
    ];
    for (const [index, value] of changes.entries()) bothValues("change hợp lệ " + index, (s) => s.decodeScheduleChange(value));
  });

  test("decodeScheduleChange: 9 ca hỏng A/B name+code+message NGUYÊN VĂN", () => {
    const BASE_AFTER: Row = { id: ID, kind: "after", title: "T", prompt: "p", afterSeconds: 60, scheduledAt: "2026-10-19T02:00:00.000Z" };
    const cases: readonly (readonly [string, unknown])[] = [
      ["null", null],
      ["version 2", { version: 2, operation: "create", schedule: BASE_AFTER }],
      ["operation lạ", { version: 1, operation: "update" }],
      ["create thừa khoá", { version: 1, operation: "create", schedule: BASE_AFTER, extra: 1 }],
      ["create schedule hỏng", { version: 1, operation: "create", schedule: { ...BASE_AFTER, extra: 1 } }],
      ["delete thừa khoá", { version: 1, operation: "delete", id: ID, extra: 1 }],
      ["delete id xấu", { version: 1, operation: "delete", id: " x " }],
      ["dispatch thừa khoá", { version: 1, operation: "dispatch", id: ID, extra: 1 }],
      ["dispatch acceptedAt hỏng", { version: 1, operation: "dispatch", id: ID, acceptedAt: "2026-02-30T00:00:00.000Z" }],
    ];
    for (const [label, value] of cases) {
      const { artifact } = bothFailures("change hỏng " + label, (s) => s.decodeScheduleChange(value));
      expect(artifact.name, label).toBe("ScheduleLogError");
      expect(artifact.code, label).toBe("corrupt_schedule_log");
    }
  });
});

describe("③ bộ phân giải đầu vào", () => {
  test("parseWeeklyInput/parseCronInput/canonicalizeCronExpression: 10 ca hợp lệ A/B", () => {
    const valid: readonly SurfaceCase[] = [
      ["weekly sắp lại", (s) => s.parseWeeklyInput({ time: "07:00:00", time_zone: "Europe/Berlin", weekdays: [5, 1, 3] })],
      ["weekly [7,1]", (s) => s.parseWeeklyInput({ time: "07:00:00", time_zone: "Europe/Berlin", weekdays: [7, 1] })],
      ["weekly lẻ", (s) => s.parseWeeklyInput({ time: "00:00:00.001", time_zone: "UTC", weekdays: [3] })],
      ["cron 0 9", (s) => s.parseCronInput({ expression: "0 9 * * 1-5", time_zone: "UTC" })],
      ["cron */5", (s) => s.parseCronInput({ expression: "*/5 * * * *", time_zone: "Asia/Saigon" })],
      ["cron danh sách", (s) => s.parseCronInput({ expression: "15,45 8-18/2 * * *", time_zone: "UTC" })],
      ["expr *", (s) => s.canonicalizeCronExpression("* * * * *")],
      ["expr dải", (s) => s.canonicalizeCronExpression("0-30/10 9,12 * 1-3 1-5")],
      ["expr gập 7", (s) => s.canonicalizeCronExpression("0 0 * * 7")],
      ["expr star-step", (s) => s.canonicalizeCronExpression("*/7 */3 */2 */1 */2")],
    ];
    for (const [label, run] of valid) bothValues(label, run);
  });

  test("parseWeeklyInput/parseCronInput/canonicalizeCronExpression: 12 ca hỏng A/B", () => {
    const invalid: readonly SurfaceCase[] = [
      ["weekly rỗng", (s) => s.parseWeeklyInput({ time: "07:00:00", time_zone: "UTC", weekdays: [] })],
      ["weekly 0", (s) => s.parseWeeklyInput({ time: "07:00:00", time_zone: "UTC", weekdays: [0] })],
      ["weekly 8", (s) => s.parseWeeklyInput({ time: "07:00:00", time_zone: "UTC", weekdays: [8] })],
      ["weekly lặp", (s) => s.parseWeeklyInput({ time: "07:00:00", time_zone: "UTC", weekdays: [1, 1] })],
      ["weekly thừa khoá", (s) => s.parseWeeklyInput({ time: "07:00:00", time_zone: "UTC", weekdays: [1], extra: 1 })],
      ["weekly vùng sai", (s) => s.parseWeeklyInput({ time: "07:00:00", time_zone: "Mars/Base", weekdays: [1] })],
      ["weekly giờ sai", (s) => s.parseWeeklyInput({ time: "07:00", time_zone: "UTC", weekdays: [1] })],
      ["cron thiếu trường", (s) => s.parseCronInput({ expression: "* * * *", time_zone: "UTC" })],
      ["expr rỗng", (s) => s.canonicalizeCronExpression("")],
      ["expr phút 60", (s) => s.canonicalizeCronExpression("60 * * * *")],
      ["expr step 0", (s) => s.canonicalizeCronExpression("*/0 * * * *")],
      ["expr dải ngược", (s) => s.canonicalizeCronExpression("0 0 5-1 * *")],
    ];
    for (const [label, run] of invalid) expect(bothFailures(label, run).artifact.name, label).toBe("ScheduleInputError");
  });

  test("parseAtInput qua createAt: 8 ca hợp lệ + 9 ca hỏng A/B", () => {
    const valid: readonly unknown[] = [
      "2026-10-20T09:30:00+07:00", "2026-10-20T02:30:00Z", "2026-10-20T02:30:00.5Z", "2026-10-20T02:30:00.123-04:00",
      { date: "2026-10-20", time: "09:30:00", time_zone: "Asia/Saigon" },
      { date: "2026-10-20", time: "09:30:15.25", time_zone: "Europe/Berlin" },
      { date: "2026-10-25", time: "02:30:00", time_zone: "Europe/Berlin" },
      { date: "2026-12-01", time: "00:00:00", time_zone: "UTC" },
    ];
    for (const [index, at] of valid.entries()) bothValues("at hợp lệ " + index, (s) => s.createAtScheduleRecord(ID, "p", at, NOW, "T"));
    expect(asRecord(bothValues("at gập lấy sớm", (s) => s.createAtScheduleRecord(ID, "p", {
      date: "2026-10-25", time: "02:30:00", time_zone: "Europe/Berlin",
    }, NOW, "T")).artifact)["scheduledAt"]).toBe("2026-10-25T00:30:00.000Z");
    const invalid: readonly unknown[] = [
      "2026-10-20", "2026-10-20T09:30:00", "2026-02-30T00:00:00Z", "0000-01-01T00:00:00Z", "2020-01-01T00:00:00Z",
      { date: "2026-10-20", time: "09:30:00" },
      { date: "2026-10-20", time: "09:30:00", time_zone: "UTC", extra: 1 },
      { date: "2026-03-29", time: "02:30:00", time_zone: "Europe/Berlin" },
      42,
    ];
    for (const [index, at] of invalid.entries()) bothFailures("at hỏng " + index, (s) => s.createAtScheduleRecord(ID, "p", at, NOW, "T"));
    expect(bothFailures("at quá khứ", (s) => s.createAtScheduleRecord(ID, "p", "2020-01-01T00:00:00Z", NOW, "T")).artifact.code).toBe("not_future");
  });

  test("createDaily/createEvery hợp lệ + ca hỏng đủ sáu kiểu A/B", () => {
    const dailies: readonly unknown[] = [
      { time: "07:00:00", time_zone: "Europe/Berlin" }, { time: "07:00:00.5", time_zone: "Europe/Berlin" },
      { time: "07:00:00.25", time_zone: "UTC" }, { time: "23:59:59.999", time_zone: "UTC" },
      { time: "00:00:00", time_zone: "Asia/Saigon" }, { time: "12:34:56.789", time_zone: "America/New_York" },
      { time: "06:15:30", time_zone: "Australia/Sydney" }, { time: "18:45:00.001", time_zone: "Asia/Tokyo" },
    ];
    for (const [index, daily] of dailies.entries()) bothValues("daily hợp lệ " + index, (s) => s.createDailyScheduleRecord(ID, "p", daily, NOW, "T"));
    for (const every of [60, 61, 3600, 86400]) bothValues("every hợp lệ " + every, (s) => s.createEveryScheduleRecord(ID, "p", every, NOW, "T"));
    const badDailies: readonly unknown[] = [
      { time: "7:00:00", time_zone: "UTC" }, { time: "24:00:00", time_zone: "UTC" }, { time: "07:60:00", time_zone: "UTC" },
      { time: "07:00", time_zone: "UTC" }, { time: "07:00:00.1234", time_zone: "UTC" }, { time: "07:00:00" },
      { time: "07:00:00", time_zone: "UTC", extra: 1 }, { time: "07:00:00", time_zone: "Mars/Base" }, { time: 700, time_zone: "UTC" },
    ];
    for (const [index, daily] of badDailies.entries()) bothFailures("daily hỏng " + index, (s) => s.createDailyScheduleRecord(ID, "p", daily, NOW, "T"));
    for (const every of [59, 0, -60, 1.5, "60", 2 ** 53]) bothFailures("every hỏng " + String(every), (s) => s.createEveryScheduleRecord(ID, "p", every as number, NOW, "T"));
    const badCreates: readonly SurfaceCase[] = [
      ["after prompt rỗng", (s) => s.createAfterScheduleRecord(ID, "   ", 60, NOW, "T")],
      ["after nhịp 0", (s) => s.createAfterScheduleRecord(ID, "p", 0, NOW, "T")],
      ["after title rỗng", (s) => s.createAfterScheduleRecord(ID, "p", 60, NOW, "   ")],
      ["weekly thứ rỗng", (s) => s.createWeeklyScheduleRecord(ID, "p", { time: "07:00:00", time_zone: "UTC", weekdays: [] }, NOW, "T")],
      ["cron biểu thức sai", (s) => s.createCronScheduleRecord(ID, "p", { expression: "60 * * * *", time_zone: "UTC" }, NOW, "T")],
      ["daily vùng sai", (s) => s.createDailyScheduleRecord(ID, "p", { time: "07:00:00", time_zone: "Mars/Base" }, NOW, "T")],
    ];
    for (const [label, run] of badCreates) bothFailures(label, run);
    expect(bothFailures("every quá nhanh", (s) => s.createEveryScheduleRecord(ID, "p", 59, NOW, "T")).artifact.code).toBe("frequency_too_high");
  });
});

describe("④ lần kế + vòng lặp", () => {
  test("resolveEveryOccurrence + resolveDailyOccurrence: A/B với acceptedAt giả", () => {
    const every: Row = { id: ID, kind: "every", title: "T", prompt: "p", everySeconds: 60, scheduledAt: "2026-10-19T00:00:00.000Z" };
    const daily: Row = { id: ID, kind: "daily", title: "T", prompt: "p", time: "02:30:00.000", timeZone: "Europe/Berlin", scheduledAt: "2026-10-18T00:30:00.000Z" };
    const everyTarget = Date.parse(String(every["scheduledAt"]));
    const dailyTarget = Date.parse(String(daily["scheduledAt"]));
    for (const at of [everyTarget, everyTarget + 1, everyTarget + 90_000, everyTarget + 3 * 86_400_000]) {
      bothValues("every @" + at, (s) => s.resolveEveryOccurrence(every, at));
    }
    for (const at of [dailyTarget, dailyTarget + 7_200_000, dailyTarget + 86_400_000, dailyTarget + 3 * 86_400_000]) {
      bothValues("daily @" + at, (s) => s.resolveDailyOccurrence(daily, at));
    }
    const failures: readonly SurfaceCase[] = [
      ["every trước đích", (s) => s.resolveEveryOccurrence(every, everyTarget - 1)],
      ["every acceptedAt lẻ", (s) => s.resolveEveryOccurrence(every, 1.5)],
      ["every acceptedAt ngoài miền", (s) => s.resolveEveryOccurrence(every, 0)],
      ["every nhịp 0", (s) => s.resolveEveryOccurrence({ ...every, everySeconds: 0 }, everyTarget)],
      ["daily trước đích", (s) => s.resolveDailyOccurrence(daily, dailyTarget - 1)],
      ["daily acceptedAt ngoài miền", (s) => s.resolveDailyOccurrence(daily, 10 ** 15)],
    ];
    for (const [label, run] of failures) expect(bothFailures(label, run).artifact.code, label).toBe("corrupt_schedule_log");
  });

  test("resolveWeeklyOccurrence + resolveCronOccurrence: A/B", () => {
    const weekly: Row = { id: ID, kind: "weekly", title: "T", prompt: "p", time: "07:00:00.000", timeZone: "Europe/Berlin", weekdays: [1, 5], scheduledAt: "2026-10-18T05:00:00.000Z" };
    const cron: Row = { id: ID, kind: "cron", title: "T", prompt: "p", expression: "0 9 * * 1-5", timeZone: "UTC", scheduledAt: "2026-10-19T09:00:00.000Z" };
    const weeklyTarget = Date.parse(String(weekly["scheduledAt"]));
    const cronTarget = Date.parse(String(cron["scheduledAt"]));
    for (const at of [weeklyTarget, weeklyTarget + 3_600_000, weeklyTarget + 2 * 86_400_000]) {
      bothValues("weekly @" + at, (s) => s.resolveWeeklyOccurrence(weekly, at));
    }
    for (const at of [cronTarget, cronTarget + 3_600_000, cronTarget + 86_400_000, cronTarget + 3 * 86_400_000]) {
      bothValues("cron @" + at, (s) => s.resolveCronOccurrence(cron, at));
    }
    const failures: readonly SurfaceCase[] = [
      ["weekly trước đích", (s) => s.resolveWeeklyOccurrence(weekly, weeklyTarget - 1)],
      ["weekly thứ 0", (s) => s.resolveWeeklyOccurrence({ ...weekly, weekdays: [0] }, weeklyTarget)],
      ["cron trước đích", (s) => s.resolveCronOccurrence(cron, cronTarget - 1)],
      ["cron biểu thức hỏng", (s) => s.resolveCronOccurrence({ ...cron, expression: "bad" }, cronTarget)],
    ];
    for (const [label, run] of failures) bothFailures(label, run);
  });

  test("DST Europe/Berlin: khoảng trống + chồng lấn qua daily/weekly/cron A/B", () => {
    const gapDaily: Row = { id: ID, kind: "daily", title: "T", prompt: "p", time: "02:30:00.000", timeZone: "Europe/Berlin", scheduledAt: "2026-03-28T01:30:00.000Z" };
    const overlapDaily: Row = { ...gapDaily, scheduledAt: "2026-10-24T00:30:00.000Z" };
    const gapWeekly: Row = { id: ID, kind: "weekly", title: "T", prompt: "p", time: "02:30:00.000", timeZone: "Europe/Berlin", weekdays: [7], scheduledAt: "2026-03-22T01:30:00.000Z" };
    const overlapWeekly: Row = { ...gapWeekly, scheduledAt: "2026-10-18T00:30:00.000Z" };
    const gapCron: Row = { id: ID, kind: "cron", title: "T", prompt: "p", expression: "30 2 * * 0", timeZone: "Europe/Berlin", scheduledAt: "2026-03-22T01:30:00.000Z" };
    const overlapCron: Row = { ...gapCron, scheduledAt: "2026-10-18T00:30:00.000Z" };
    const gapAccepted = Date.parse("2026-03-29T12:00:00.000Z");
    const overlapAccepted = Date.parse("2026-10-25T12:00:00.000Z");
    const gap = bothValues("daily gap", (s) => s.resolveDailyOccurrence(gapDaily, gapAccepted)).artifact;
    expect(asRecord(gap)["occurrenceAt"]).toBe("2026-03-28T01:30:00.000Z");
    expect(asRecord(gap)["nextScheduledAt"]).toBe("2026-03-30T00:30:00.000Z");
    const overlap = bothValues("daily overlap", (s) => s.resolveDailyOccurrence(overlapDaily, overlapAccepted)).artifact;
    expect(asRecord(overlap)["occurrenceAt"]).toBe("2026-10-25T00:30:00.000Z");
    bothValues("weekly gap", (s) => s.resolveWeeklyOccurrence(gapWeekly, gapAccepted));
    bothValues("weekly overlap", (s) => s.resolveWeeklyOccurrence(overlapWeekly, overlapAccepted));
    bothValues("cron gap", (s) => s.resolveCronOccurrence(gapCron, gapAccepted));
    bothValues("cron overlap", (s) => s.resolveCronOccurrence(overlapCron, overlapAccepted));
    bothValues("create daily gap", (s) => s.createDailyScheduleRecord(ID, "p", { time: "02:30:00", time_zone: "Europe/Berlin" }, Date.parse("2026-03-29T00:00:00.000Z"), "T"));
  });

  test("resolveRecurringOccurrence + isRecurringScheduleRecord: A/B đủ 6 kiểu", () => {
    for (const [kind, record] of Object.entries(sampleRecords(ours))) {
      const recurring = bothValues("isRecurring " + kind, (s) => s.isRecurringScheduleRecord(record)).artifact;
      expect(recurring, kind).toBe(kind !== "after" && kind !== "at");
      if (!recurring) continue;
      bothValues("recurring " + kind, (s) => s.resolveRecurringOccurrence(record, Date.parse(String(record["scheduledAt"])) + 3_600_000));
    }
  });

  test("foldScheduleEvents: create/delete/dispatch A/B", () => {
    const records = sampleRecords(ours);
    const events: readonly unknown[] = [
      { type: "schedule/change", data: { version: 1, operation: "create", schedule: records["every"] } },
      { type: "schedule/khác", data: { ignored: true } },
      { type: "schedule/change", data: { version: 1, operation: "dispatch", id: ID, acceptedAt: "2026-10-19T03:00:00.000Z" } },
      { type: "schedule/change", data: { version: 1, operation: "create", schedule: { ...records["after"], id: "schedule-2" } } },
      { type: "schedule/change", data: { version: 1, operation: "delete", id: "schedule-2" } },
    ];
    const folded = asRecord(bothValues("fold", (s) => s.foldScheduleEvents(events, 0)).artifact);
    expect(folded["active"]).toHaveLength(1);
    expect(folded["seenIds"]).toHaveLength(2);
    const parentOwned = { type: "schedule/change", data: { version: 1, operation: "create", schedule: { ...records["after"], id: "schedule-0" } } };
    bothValues("fold bỏ tiền tố", (s) => s.foldScheduleEvents([parentOwned, ...events], 1));
    bothValues("fold rỗng", (s) => s.foldScheduleEvents([], 0));
  });

  test("foldScheduleEvents: 9 ca hỏng A/B name+code+message", () => {
    const records = sampleRecords(ours);
    const createEvery = { type: "schedule/change", data: { version: 1, operation: "create", schedule: records["every"] } };
    const createAfter = { type: "schedule/change", data: { version: 1, operation: "create", schedule: records["after"] } };
    const deleteId = { type: "schedule/change", data: { version: 1, operation: "delete", id: ID } };
    const dispatchId = { type: "schedule/change", data: { version: 1, operation: "dispatch", id: ID } };
    const dispatchAt = { type: "schedule/change", data: { version: 1, operation: "dispatch", id: ID, acceptedAt: "2026-10-19T03:00:00.000Z" } };
    const events = [createEvery, dispatchAt];
    const cases: readonly (readonly [string, readonly unknown[], number])[] = [
      ["create trùng id", [createEvery, createEvery], 0],
      ["delete id không hoạt động", [deleteId], 0],
      ["dispatch id không hoạt động", [dispatchId], 0],
      ["dispatch one-shot kèm acceptedAt", [createAfter, dispatchAt], 0],
      ["dispatch every thiếu acceptedAt", [createEvery, dispatchId], 0],
      ["data sai", [{ type: "schedule/change", data: { version: 9, operation: "create" } }], 0],
      ["inherited quá lớn", events, 99],
      ["inherited âm", events, -1],
      ["inherited lẻ", events, 1.5],
    ];
    for (const [label, log, inherited] of cases) {
      const { artifact } = bothFailures(label, (s) => s.foldScheduleEvents(log, inherited));
      expect(artifact.name, label).toBe("ScheduleLogError");
      expect(artifact.code, label).toBe("corrupt_schedule_log");
    }
  });
});

describe("⑤ khung nhìn + câu khung", () => {
  test("scheduleView: scheduled/overdue A/B JSON", () => {
    const record = asRecord(sampleRecords(ours)["every"]);
    const target = Date.parse(String(record["scheduledAt"]));
    const points: readonly (readonly [number, string])[] = [[target - 1, "scheduled"], [target, "overdue"], [target + 1, "overdue"]];
    for (const [now, state] of points) {
      const { base, artifact } = bothValues("view @" + now, (s) => s.scheduleView(record, now));
      expect(asRecord(base)["state"]).toBe(state);
      expect(asRecord(artifact)["state"]).toBe(state);
      expect(asRecord(artifact)["deliveryMode"]).toBe("host");
      expect(Object.isFrozen(artifact)).toBe(true);
    }
  });

  test("renderReminderFraming + renderRecurringReminderBatchFraming: chuỗi từng ký tự A/B", () => {
    const prompt = "a \"b\"\nü\\";
    const reminder: Row = { id: ID, kind: "at", title: "T", prompt, scheduledAt: "2026-10-19T00:00:00.000Z" };
    const one = bothValues("reminder một lần", (s) => s.renderReminderFraming(reminder));
    expect(one.artifact).toBe(one.base);
    expect(one.artifact).toBe([
      "[SCHEDULE REMINDER]",
      "This is a scheduled message from the user",
      "schedule_id_json: " + JSON.stringify(reminder["id"]),
      "occurrence_at: 2026-10-19T00:00:00.000Z",
      "reminder_prompt_json: " + JSON.stringify(prompt),
    ].join("\n"));
    const records = sampleRecords(ours);
    const reminders: readonly unknown[] = [
      { record: records["every"], occurrenceAt: "2026-10-19T00:00:00.000Z" },
      { record: records["daily"], occurrenceAt: "2026-10-19T00:30:00.000Z" },
      { record: records["cron"], occurrenceAt: "2026-10-19T01:00:00.000Z" },
    ];
    const batch = bothValues("reminder lô", (s) => s.renderRecurringReminderBatchFraming(reminders));
    expect(batch.artifact).toBe(batch.base);
    const payload = reminders.map((item) => {
      const entry = asRecord(item);
      const record = asRecord(entry["record"]);
      return { schedule_id: record["id"], occurrence_at: entry["occurrenceAt"], reminder_prompt: record["prompt"] };
    });
    expect(batch.artifact).toBe([
      "[SCHEDULE REMINDER BATCH]",
      "This is a scheduled message from the user",
      "reminders_json: " + JSON.stringify(payload),
    ].join("\n"));
  });

  test("C6 danh tính: 2 lượt scheduleView/List trả vật thể riêng nhưng sâu bằng", async () => {
    const record = asRecord(sampleRecords(ours)["every"]);
    const viewA = ours.scheduleView(record, NOW);
    const viewB = ours.scheduleView(record, NOW);
    expect(viewA).not.toBe(viewB);
    expect(canonical(viewA)).toBe(canonical(viewB));
    expect(Object.isFrozen(viewA)).toBe(true);
    const stockViewA = stock.scheduleView(record, NOW);
    const stockViewB = stock.scheduleView(record, NOW);
    expect(stockViewA === stockViewB).toBe(viewA === viewB);
    const service = await boot(ours, fakeHost([record]));
    const listA = await service.list({ sessionId: "sess-1" });
    const listB = await service.list({ sessionId: "sess-1" });
    expect(listA).not.toBe(listB);
    expect(canonical(listA)).toBe(canonical(listB));
    expect(listA[0] === listB[0]).toBe(true);
    const stockService = await boot(stock, fakeHost([record]));
    const stockListA = await stockService.list({ sessionId: "sess-1" });
    const stockListB = await stockService.list({ sessionId: "sess-1" });
    expect(stockListA[0] === stockListB[0]).toBe(listA[0] === listB[0]);
  });
});

describe("⑥ ScheduleService + runtime", () => {
  test("create/list/catalog/history/delete A/B JSON", async () => {
    setSystemTime(new Date(NOW));
    const { artifact } = await serviceValues("create/list/catalog/history/delete", async (surface) => {
      const service = await boot(surface, fakeHost());
      const created = await service.create("sess-1", { title: "T", prompt: " hello ", after_seconds: 60 });
      const list = await service.list({ sessionId: "sess-1" });
      const catalog = await service.catalog();
      const history = await service.history({ sessionId: "sess-1", id: created["id"], limit: 10 });
      const deleted = await service.delete({ sessionId: "sess-1", id: created["id"] });
      return { created, list, catalog, history, deleted, after: await service.list({ sessionId: "sess-1" }) };
    });
    expect(asRecord(asRecord(artifact)["created"])["scheduledAt"]).toBe(new Date(NOW + 60_000).toISOString());
    expect(asRecord(asRecord(artifact)["deleted"])["deleted"]).toBe(true);
    expect(asRecord(artifact)["after"]).toHaveLength(0);
  });

  test("resolveScheduleUpdate qua service.update: 11 ca A/B (keep/rename/toEvery/at/daily→cron)", async () => {
    setSystemTime(new Date(NOW));
    const records = sampleRecords(ours);
    const every = asRecord(records["every"]);
    const at = asRecord(records["at"]);
    const daily = asRecord(records["daily"]);
    const weekly = asRecord(records["weekly"]);
    const cron = asRecord(records["cron"]);
    const cases: readonly (readonly [string, Row, Record<string, unknown>, boolean])[] = [
      ["rename only", every, { title: "Tên mới" }, true],
      ["prompt only", every, { prompt: "câu mới" }, true],
      ["no-op", every, {}, false],
      ["every keep", every, { change: { kind: "every", every_seconds: 3600 } }, false],
      ["every → toEvery", every, { change: { kind: "every", every_seconds: 7200 } }, true],
      ["at keep", at, { change: { kind: "at", at: at["scheduledAt"] } }, false],
      ["at → mốc mới", at, { change: { kind: "at", at: "2026-12-01T00:00:00.000Z" } }, true],
      ["daily keep", daily, { change: { kind: "daily", daily: { time: "07:00:00", time_zone: "Europe/Berlin" } } }, false],
      ["daily → cron", daily, { change: { kind: "cron", cron: { expression: "0 8 * * *", time_zone: "UTC" } } }, true],
      ["weekly keep", weekly, { change: { kind: "weekly", weekly: { time: "07:00:00", time_zone: "Europe/Berlin", weekdays: [5, 1] } } }, false],
      ["cron keep", cron, { change: { kind: "cron", cron: { expression: "0 9 * * 1-5", time_zone: "UTC" } } }, false],
    ];
    const seeds = cases.map(([, record], index) => ({ ...record, id: "schedule-u" + index }));
    const runAll = async (surface: ScheduleSurface): Promise<unknown[]> => {
      const service = await boot(surface, fakeHost(seeds, "error"));
      const results: unknown[] = [];
      for (const [index, [, , request]] of cases.entries()) {
        const record = seeds[index]!;
        results.push(await service.update({ sessionId: "sess-1", id: String(record["id"]), expected: record, ...request }));
      }
      return results;
    };
    const base = await runAll(stock);
    const artifact = await runAll(ours);
    for (const [index, [label, , , updated]] of cases.entries()) {
      const result = asRecord(artifact[index]);
      expect(result["updated"], label).toBe(updated);
      expect(result["id"], label).toBe(seeds[index]!["id"]);
      if (updated) expect(result["record"], label + " có record").toBeDefined();
      else expect(canonical(result["record"]), label + " giữ đích").toBe(canonical(seeds[index]));
      expect(canonical(result), label + " A/B").toBe(canonical(base[index]));
    }
  });

  test("resolveScheduleUpdate: 8 ca hỏng/không đột biến A/B", async () => {
    setSystemTime(new Date(NOW));
    const every = asRecord(sampleRecords(ours)["every"]);
    const cases: readonly (readonly [string, Row, Record<string, unknown>, string, "active" | "inactive"])[] = [
      ["conflict", every, { expected: { ...every, prompt: "khác" } }, "schedule_conflict", "active"],
      ["expected hỏng", every, { expected: { ...every, title: " T " } }, "invalid_rule", "active"],
      ["change hai selector", every, { change: { kind: "every", every_seconds: 60, daily: {} } }, "invalid_rule", "active"],
      ["change kind lạ", every, { change: { kind: "hourly" } }, "invalid_rule", "active"],
      ["title rỗng", every, { title: "  " }, "invalid_prompt", "active"],
      ["prompt rỗng", every, { prompt: "   " }, "invalid_prompt", "active"],
      ["không tìm thấy", every, { id: "schedule-404" }, "schedule_not_found", "active"],
      ["đã kết thúc", every, {}, "schedule_ended", "inactive"],
    ];
    const seeds = cases.map(([, record], index) => ({ ...record, id: "schedule-i" + index }));
    const runAll = async (surface: ScheduleSurface): Promise<unknown[]> => {
      const host = fakeHost(seeds, "error");
      const ended = cases.findIndex(([, , , , status]) => status === "inactive");
      asRecord(host.rows.get(String(seeds[ended]!["id"])))["status"] = "inactive";
      const service = await boot(surface, host);
      const results: unknown[] = [];
      for (const [index, [, , request]] of cases.entries()) {
        const record = seeds[index]!;
        results.push(await service.update({ sessionId: "sess-1", id: String(record["id"]), expected: record, ...request }));
      }
      return results;
    };
    const base = await runAll(stock);
    const artifact = await runAll(ours);
    for (const [index, [label, , , code]] of cases.entries()) {
      const result = asRecord(artifact[index]);
      expect(result["code"], label).toBe(code);
      expect(canonical(result), label + " A/B").toBe(canonical(base[index]));
      if (code.startsWith("schedule_")) {
        expect(result["updated"], label).toBe(false);
        expect(result["record"], label + " không có record").toBeUndefined();
      } else {
        expect(typeof result["message"], label + " có message").toBe("string");
      }
    }
  });

  test("ScheduleRuntime giao nhắc một lần: text/source/commit A/B", async () => {
    setSystemTime(new Date(NOW));
    const record: Row = { id: ID, kind: "after", title: "T", prompt: "chào", afterSeconds: 5, scheduledAt: new Date(NOW - 10_000).toISOString() };
    const run = async (surface: ScheduleSurface): Promise<unknown> => {
      const timers = recordTimers();
      try {
        const host = fakeHost([record]);
        await boot(surface, host);
        await until(() => host.followups.length === 1 && asRecord(host.rows.get(ID) ?? {})["status"] === "inactive", "giao một lần");
        return {
          warns: host.warns,
          followups: host.followups.map((message) => ({ text: messageText(message), source: message["source"] })),
          rows: [...host.rows.values()], flushes: host.flushes.count, delays: timers.delays, cleared: timers.cleared,
        };
      } finally {
        timers.restore();
      }
    };
    const base = await run(stock);
    const artifact = await run(ours);
    expect(masked(artifact)).toBe(masked(base));
    const delivered = asRecord(artifact);
    expect(delivered["warns"]).toHaveLength(0);
    expect(asRecord((delivered["followups"] as unknown[])[0])["text"]).toBe(ours.renderReminderFraming(record));
    expect(asRecord((delivered["followups"] as unknown[])[0])["source"]).toEqual({ kind: "schedule" });
    expect(delivered["flushes"]).toBe(1);
    expect(deliveryCount(asRecord((delivered["rows"] as unknown[])[0]))).toBe(1);
  });

  test("ScheduleRuntime lô lặp: batch framing + nextScheduledAt/status A/B", async () => {
    setSystemTime(new Date(NOW));
    const every: Row = { id: "schedule-2", kind: "every", title: "E", prompt: "ev", everySeconds: 60, scheduledAt: new Date(NOW - 130_000).toISOString() };
    const daily: Row = { id: "schedule-3", kind: "daily", title: "D", prompt: "da", time: "07:00:00.000", timeZone: "Europe/Berlin", scheduledAt: new Date(NOW - 3_600_000).toISOString() };
    const run = async (surface: ScheduleSurface): Promise<unknown> => {
      const timers = recordTimers();
      try {
        const host = fakeHost([every, daily]);
        await boot(surface, host);
        await until(
          () => deliveryCount(host.rows.get("schedule-2")) === 1 && deliveryCount(host.rows.get("schedule-3")) === 1 && timers.delays.length === 1,
          "giao lô lặp",
        );
        return {
          warns: host.warns,
          followups: host.followups.map((message) => ({ text: messageText(message), source: message["source"] })),
          rows: [...host.rows.values()], delays: timers.delays,
        };
      } finally {
        timers.restore();
      }
    };
    const base = await run(stock);
    const artifact = await run(ours);
    expect(masked(artifact)).toBe(masked(base));
    const batch = asRecord(artifact);
    const text = String(asRecord((batch["followups"] as unknown[])[0])["text"]);
    expect(text.startsWith("[SCHEDULE REMINDER BATCH]\n")).toBe(true);
    expect(text).toContain("schedule-2");
    expect(text).toContain("schedule-3");
    const rows = batch["rows"] as Row[];
    const recordOf = (row: Row): Row => asRecord(row["record"]);
    const everyRow = rows.find((row) => String(recordOf(row)["id"]) === "schedule-2");
    const dailyRow = rows.find((row) => String(recordOf(row)["id"]) === "schedule-3");
    expect(asRecord(everyRow ?? {})["status"]).toBe("active");
    expect(asRecord(dailyRow ?? {})["status"]).toBe("active");
    expect(recordOf(everyRow ?? {})["scheduledAt"]).toBe("2026-10-19T01:00:50.000Z");
    expect(recordOf(dailyRow ?? {})["scheduledAt"]).toBe("2026-10-20T05:00:00.000Z");
    expect(batch["delays"]).toEqual([50_000]);
  });

  test("ScheduleRuntime: công thức delay Math.max(0, min(next-now, 2_147_483_647)) A/B", async () => {
    setSystemTime(new Date(NOW));
    const near: Row = { id: "schedule-5", kind: "at", title: "N", prompt: "near", scheduledAt: new Date(NOW + 5000).toISOString() };
    const far: Row = { id: "schedule-9", kind: "at", title: "F", prompt: "far", scheduledAt: new Date(NOW + 50 * 365 * 86_400_000).toISOString() };
    const run = async (surface: ScheduleSurface, record: Row): Promise<unknown> => {
      const timers = recordTimers();
      try {
        const host = fakeHost([record]);
        await boot(surface, host);
        await until(() => timers.delays.length === 1, "hẹn timer");
        return { delays: timers.delays, warns: host.warns };
      } finally {
        timers.restore();
      }
    };
    const nearBase = asRecord(await run(stock, near));
    const nearOurs = asRecord(await run(ours, near));
    expect(masked(nearOurs)).toBe(masked(nearBase));
    expect(nearOurs["delays"]).toEqual([5000]);
    const farBase = asRecord(await run(stock, far));
    const farOurs = asRecord(await run(ours, far));
    expect(masked(farOurs)).toBe(masked(farBase));
    expect(farOurs["delays"]).toEqual([2_147_483_647]);
  });

  test("ScheduleRuntime: resolveAgent lỗi — warn nguyên văn A/B, không followup/timer", async () => {
    setSystemTime(new Date(NOW));
    const record: Row = { id: ID, kind: "after", title: "T", prompt: "p", afterSeconds: 5, scheduledAt: new Date(NOW - 10_000).toISOString() };
    const run = async (surface: ScheduleSurface): Promise<unknown> => {
      const timers = recordTimers();
      try {
        const host = fakeHost([record], "error");
        await boot(surface, host);
        await until(() => host.warns.length === 1, "cảnh báo giao lỗi");
        await settle();
        return {
          warns: host.warns, followups: host.followups.length, flushes: host.flushes.count,
          delays: timers.delays, cleared: timers.cleared, rows: [...host.rows.values()],
        };
      } finally {
        timers.restore();
      }
    };
    const base = await run(stock);
    const artifact = await run(ours);
    expect(masked(artifact)).toBe(masked(base));
    const failed = asRecord(artifact);
    expect(failed["followups"]).toBe(0);
    expect(failed["flushes"]).toBe(0);
    expect(failed["delays"]).toEqual([]);
    expect(String((failed["warns"] as string[])[0])).toBe(
      'schedule: reminders ["schedule-1"] were not acknowledged: Error: không có agent cho sess-1',
    );
    expect(asRecord((failed["rows"] as Row[])[0])["status"]).toBe("active");
  });
});
