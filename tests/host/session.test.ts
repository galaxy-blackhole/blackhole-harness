/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho row session (gói LÕI event-sourced): bề mặt 30 export, surface/fork/seq/repair/tool-history/
 *      request-header/append/adopt — chạy CẢ bundle stock lẫn artefact build từ src của ta, so từng giá trị.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/session/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session");
/** Bundle stock (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session", "lib", "index.js");
/** Build tạm dưới lib/. */
const OUT = join(PKG, "lib", ".test-build-main");

/** Bề mặt module session dùng trong test. */
interface SessionModule {
  readonly KNOWN_SESSION_EVENT_TYPES: ReadonlySet<string>;
  readonly SESSION_FORMAT_VERSION: number;
  readonly Session: { readonly prototype: object; readonly create: (...args: unknown[]) => unknown; readonly fromRestore: (...args: unknown[]) => unknown };
  readonly SessionStore: { readonly prototype: object };
  readonly default: unknown;
  readonly TOOL_NOT_STARTED: unknown;
  readonly TOOL_OUTCOME_UNKNOWN: unknown;
  readonly SessionId: (value: string) => string;
  readonly SessionSeq: (value: number) => number;
  readonly SessionLogOffset: (value: number) => number;
  readonly ToolCallRecovery: new (...args: unknown[]) => { observe: (...args: unknown[]) => unknown; results: () => unknown };
  readonly interruptedTurnClosers: (...args: unknown[]) => unknown;
  readonly buildForkSeed: (...args: unknown[]) => unknown;
  readonly canonicalHeader: (header: Record<string, unknown>) => unknown;
  readonly headerEquals: (...args: unknown[]) => unknown;
  readonly foldRequestHeader: (...args: unknown[]) => unknown;
  readonly decodeSeqRanges: (...args: unknown[]) => unknown;
  readonly encodeSeqRanges: (...args: unknown[]) => unknown;
  readonly deriveEventMessage: (...args: unknown[]) => unknown;
  readonly foldSurface: (...args: unknown[]) => unknown;
  readonly isAppendSurfaceEvent: (event: unknown) => boolean;
  readonly isReplacementSurfaceEvent: (event: unknown) => boolean;
  readonly isSurfaceEligibleType: (type: string) => boolean;
  readonly isSurfaceEvent: (event: unknown) => boolean;
  readonly adoptSessionEvent: (...args: unknown[]) => unknown;
  readonly snapshotSessionEvent: (event: unknown) => unknown;
  readonly appendPluginRecord: (...args: unknown[]) => unknown;
  readonly pluginRecordOf: (...args: unknown[]) => unknown;
}

/** Bundle stock nạp động. */
const stock = (await import(STOCK)) as unknown as SessionModule;
/** Module của TA. */
let ours: SessionModule;

/**
 * Nhãn kết quả: chạy hàm và trả JSON hoặc nhãn lỗi.
 * Nhận: run — hàm cần chạy. Trả: chuỗi nhãn (giá trị JSON hoặc "TênLỗi|message").
 */
function outcomeOf(run: () => unknown): string {
  try {
    return JSON.stringify(run());
  } catch (thrown: unknown) {
    const error = thrown as { readonly constructor?: { readonly name?: string }; readonly message?: string };
    return String(error.constructor?.name) + "|" + String(error.message);
  }
}

/**
 * Tên method trên prototype của một class.
 * Nhận: cls — class cần đọc. Trả: mảng tên method đã sắp.
 */
function methodNamesOf(cls: { readonly prototype: object }): string[] {
  return Object.getOwnPropertyNames(cls.prototype).filter((name) => name !== "constructor").sort();
}

/** Thư mục phiên thật (CHỈ ĐỌC). */
const SESSIONS = join(process.env.HOME ?? "", ".galaxy", "blackhole", "sessions");

/**
 * Đọc event THẬT từ phiên .jsonl.zstd lớn nhất (CHỈ ĐỌC).
 * Nhận: không. Trả: header (đã bỏ type) + events.
 */
function readRealSession(): { header: Record<string, unknown>; events: readonly Record<string, unknown>[] } {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".jsonl.zstd")) files.push(path);
    }
  };
  walk(SESSIONS);
  const biggest = files.sort((a, b) => statSync(b).size - statSync(a).size)[0];
  if (biggest === undefined) throw new Error("không có phiên thật để replay");
  const text = new TextDecoder().decode(Bun.zstdDecompressSync(readFileSync(biggest)));
  const lines = text.split(String.fromCharCode(10)).filter((line) => line.trim() !== "");
  const rawHeader = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
  const { type: _type, ...header } = rawHeader;
  return { header, events: lines.slice(1).map((line) => JSON.parse(line) as Record<string, unknown>) };
}

/** Header tổng hợp hợp lệ cho các phép fold. */
const HEADER = { version: 4, id: "session-ab", createdAt: 1, isSeeded: false, cwd: "/tmp", delegationDepth: 0 };

/** Log tổng hợp có đủ loại event để fold/repair/fork. */
const LOG = [
  { type: "turn/start", seq: 0, time: 10, data: { turnId: "t1" } },
  { type: "step/start", seq: 1, time: 11, data: { turnId: "t1", stepId: "s1" } },
  { type: "user/message", seq: 2, time: 12, data: { messageId: "m1", content: [{ kind: "text", text: "hi" }] } },
  { type: "assistant/message", seq: 3, time: 13, data: { messageId: "m2", content: [{ kind: "text", text: "hello" }] } },
  { type: "tool/call", seq: 4, time: 14, data: { callId: "c1", toolName: "read", args: {} } },
  { type: "tool/result", seq: 5, time: 15, data: { callId: "c1", result: { ok: true } } },
  { type: "step/end", seq: 6, time: 16, data: { turnId: "t1", stepId: "s1" } },
  { type: "turn/end", seq: 7, time: 17, data: { turnId: "t1", reason: "completed" } },
];

beforeAll(async () => {
  await buildPackage(OUT);
  ours = (await import(join(OUT, "index.js"))) as unknown as SessionModule;
});

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

describe("session — bề mặt 30 export A/B", () => {
  test("tập export runtime khớp gốc từng tên + default === SessionStore", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).length).toBe(30);
    expect(ours.default).toBe(ours.SessionStore);
    expect(stock.default).toBe(stock.SessionStore);
  });

  test("SESSION_FORMAT_VERSION + tập KNOWN event khớp gốc", () => {
    expect(ours.SESSION_FORMAT_VERSION).toBe(stock.SESSION_FORMAT_VERSION);
    expect([...ours.KNOWN_SESSION_EVENT_TYPES]).toEqual([...stock.KNOWN_SESSION_EVENT_TYPES]);
  });

  test("hằng TOOL_NOT_STARTED/TOOL_OUTCOME_UNKNOWN khớp gốc", () => {
    expect(ours.TOOL_NOT_STARTED).toEqual(stock.TOOL_NOT_STARTED);
    expect(ours.TOOL_OUTCOME_UNKNOWN).toEqual(stock.TOOL_OUTCOME_UNKNOWN);
  });

  test("tên method prototype của Session + SessionStore khớp gốc", () => {
    expect(methodNamesOf(ours.Session)).toEqual(methodNamesOf(stock.Session));
    expect(methodNamesOf(ours.SessionStore)).toEqual(methodNamesOf(stock.SessionStore));
  });
});

describe("session — surface A/B", () => {
  test("phân loại event surface khớp gốc trên log thật", () => {
    for (const event of LOG) {
      expect(ours.isSurfaceEvent(event)).toBe(stock.isSurfaceEvent(event));
      expect(ours.isAppendSurfaceEvent(event)).toBe(stock.isAppendSurfaceEvent(event));
      expect(ours.isReplacementSurfaceEvent(event)).toBe(stock.isReplacementSurfaceEvent(event));
      expect(ours.isSurfaceEligibleType(event.type)).toBe(stock.isSurfaceEligibleType(event.type));
    }
  });

  test("foldSurface A/B bằng nhau trên log THẬT của một phiên đã lưu", () => {
    const real = readRealSession();
    expect(JSON.stringify(ours.foldSurface(real.events))).toBe(JSON.stringify(stock.foldSurface(real.events)));
    expect(JSON.stringify(ours.foldSurface([], []))).toBe(JSON.stringify(stock.foldSurface([], [])));
  });
});

describe("session — seq-ranges + fork + repair + tool-history A/B", () => {
  test("encodeSeqRanges/decodeSeqRanges A/B cho cả giá trị và lỗi", () => {
    const cases: readonly unknown[] = [[], [0], [0, 1], [0, 1, 2], [0, 2, 3, 9], [[0, 2], 5], [[3, 1]], "x", [0, -1]];
    for (const value of cases) {
      expect(outcomeOf(() => ours.encodeSeqRanges(value))).toBe(outcomeOf(() => stock.encodeSeqRanges(value)));
      expect(outcomeOf(() => ours.decodeSeqRanges(value))).toBe(outcomeOf(() => stock.decodeSeqRanges(value)));
    }
    expect(outcomeOf(() => ours.decodeSeqRanges([0, 1], 1))).toBe(outcomeOf(() => stock.decodeSeqRanges([0, 1], 1)));
  });

  test("buildForkSeed A/B cho mọi biên hợp lệ và không hợp lệ", () => {
    for (const boundary of [0, 1, 4, 7, 8, -1, 1.5]) {
      expect(outcomeOf(() => ours.buildForkSeed(LOG, boundary))).toBe(outcomeOf(() => stock.buildForkSeed(LOG, boundary)));
    }
  });

  test("interruptedTurnClosers + ToolCallRecovery A/B trên log có tool treo", () => {
    expect(outcomeOf(() => ours.interruptedTurnClosers(LOG))).toBe(outcomeOf(() => stock.interruptedTurnClosers(LOG)));
    const pending = LOG.slice(0, 7);
    expect(outcomeOf(() => ours.interruptedTurnClosers(pending))).toBe(outcomeOf(() => stock.interruptedTurnClosers(pending)));
    const make = (mod: SessionModule): unknown => {
      const recovery = new mod.ToolCallRecovery();
      for (const event of pending) recovery.observe(event);
      return recovery.results();
    };
    expect(outcomeOf(() => make(ours))).toBe(outcomeOf(() => make(stock)));
  });
});

describe("session — request-header + append/adopt A/B", () => {
  test("canonicalHeader/headerEquals/foldRequestHeader A/B trên log thật", () => {
    expect(outcomeOf(() => ours.canonicalHeader(HEADER))).toBe(outcomeOf(() => stock.canonicalHeader(HEADER)));
    const canonical = stock.canonicalHeader(HEADER) as Record<string, unknown>;
    expect(outcomeOf(() => ours.headerEquals(canonical, canonical))).toBe(outcomeOf(() => stock.headerEquals(canonical, canonical)));
    expect(outcomeOf(() => ours.headerEquals(canonical, HEADER))).toBe(outcomeOf(() => stock.headerEquals(canonical, HEADER)));
    expect(outcomeOf(() => ours.foldRequestHeader(LOG))).toBe(outcomeOf(() => stock.foldRequestHeader(LOG)));
  });

  test("snapshotSessionEvent A/B trên mọi event + event lạ", () => {
    for (const event of LOG) {
      expect(outcomeOf(() => ours.snapshotSessionEvent(event))).toBe(outcomeOf(() => stock.snapshotSessionEvent(event)));
    }
    expect(outcomeOf(() => ours.snapshotSessionEvent({ type: "unknown/type", seq: 0, time: 0 }))).toBe(
      outcomeOf(() => stock.snapshotSessionEvent({ type: "unknown/type", seq: 0, time: 0 })),
    );
  });

  test("adoptSessionEvent A/B cho event hợp lệ và sai hình dạng", () => {
    const good = { type: "user/message", seq: 0, time: 1, data: { messageId: "m1", content: [{ kind: "text", text: "x" }] } };
    expect(outcomeOf(() => ours.adoptSessionEvent(good))).toBe(outcomeOf(() => stock.adoptSessionEvent(good)));
    expect(outcomeOf(() => ours.adoptSessionEvent({ seq: -1 }))).toBe(outcomeOf(() => stock.adoptSessionEvent({ seq: -1 })));
  });

  test("appendPluginRecord/pluginRecordOf A/B cho record hợp lệ và sai", () => {
    const record = { type: "plugin/record" as const, seq: 9, time: 20, data: { plugin: "x", payload: 1 } };
    expect(outcomeOf(() => ours.pluginRecordOf(record))).toBe(outcomeOf(() => stock.pluginRecordOf(record)));
    expect(outcomeOf(() => ours.pluginRecordOf({ type: "user/message" }))).toBe(outcomeOf(() => stock.pluginRecordOf({ type: "user/message" })));
  });

  test("deriveEventMessage A/B trên event message", () => {
    for (const event of LOG) {
      expect(outcomeOf(() => ours.deriveEventMessage(event))).toBe(outcomeOf(() => stock.deriveEventMessage(event)));
    }
  });
});