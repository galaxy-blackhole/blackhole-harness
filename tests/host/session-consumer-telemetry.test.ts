/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test consumer cho `Session` VALUE IMPORT: session-telemetry-otel dùng Session.fromRestore + lọc
 *      isFeedback — chứng minh hành vi của consumer KHÔNG đổi khi Session là class của artefact của ta.
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
const OUT = join(PKG, "lib", ".test-build-consumer");
/** Thư mục phiên thật (CHỈ ĐỌC). */
const SESSIONS = join(process.env.HOME ?? "", ".galaxy", "blackhole", "sessions");

/** Bề mặt class Session dùng bởi consumer. */
interface SessionClass {
  create(id: string, seed?: readonly unknown[], header?: Record<string, unknown>): {
    readonly id: string;
    readonly log: readonly unknown[];
    readonly surface: unknown;
    readonly inheritedEventCount: number;
  };
  fromRestore(
    id: string,
    seed: readonly unknown[],
    header: Record<string, unknown>,
    inheritedEventCount: number,
    eventState: Record<string, unknown>,
  ): { readonly id: string; readonly log: readonly unknown[]; readonly surface: unknown; readonly inheritedEventCount: number };
}
/** Module session dùng trong test. */
interface SessionModule {
  readonly Session: SessionClass;
  readonly SessionLogOffset: (value: number) => number;
}
/** Một event đọc từ phiên thật. */
interface RealEvent {
  readonly seq: number;
  readonly type: string;
  readonly data?: Record<string, unknown>;
}

/** Bundle stock. */
const stock = (await import(STOCK)) as unknown as SessionModule;
/** Module của TA. */
let ours: SessionModule;
/** Phiên thật đầu tiên (header + events). */
let realSession: { readonly header: Record<string, unknown>; readonly events: readonly RealEvent[] };

/**
 * Đọc phiên .jsonl.zstd lớn nhất trong thư mục sessions (CHỈ ĐỌC).
 * Nhận: root — thư mục gốc. Trả: header (bỏ type) + events.
 */
function readBiggestSession(root: string): { header: Record<string, unknown>; events: RealEvent[] } {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".jsonl.zstd")) files.push(path);
    }
  };
  walk(root);
  const biggest = files.sort((a, b) => statSync(b).size - statSync(a).size)[0];
  if (biggest === undefined) throw new Error("không có phiên nào để replay");
  const text = new TextDecoder().decode(Bun.zstdDecompressSync(readFileSync(biggest)));
  const lines = text.split(String.fromCharCode(10)).filter((line) => line.trim() !== "");
  const rawHeader = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
  const { type: _type, ...header } = rawHeader;
  return { header, events: lines.slice(1).map((line) => JSON.parse(line) as RealEvent) };
}

beforeAll(async () => {
  await buildPackage(OUT);
  ours = (await import(join(OUT, "index.js"))) as unknown as SessionModule;
  realSession = readBiggestSession(SESSIONS);
});

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/**
 * Chuỗi JSON đã TRUNG TÍNH HOÁ trường `time` — chỉ dùng để so hai lần dựng phiên.
 * Nhận: giá trị bất kỳ (log/surface). Trả: chuỗi JSON với mọi "time":<số> thành "time":0.
 *
 * Vì sao (đo 23/10/2026): event tổng hợp `session/end-seed` do `append()` đóng dấu `Date.now()`;
 * hai lời gọi liên tiếp trong CÙNG tiến trình lệch nhau 32 ms (gốc 1792724488658 · ta 1792724488690)
 * nên phép so byte-đối-byte đỏ ngẫu nhiên dù hành vi giống hệt. Mọi trường khác vẫn so nguyên văn.
 */
function chuanHoaThoiGian(value: unknown): string {
  return JSON.stringify(value).replace(/"time":\d+/g, '"time":0');
}

/**
 * Bản sao ĐÚNG logic isFeedback của session-telemetry-otel (index.ts:59-70).
 * Nhận: session — phiên đã dựng; event — event cần lọc. Trả: event có phải feedback không.
 */
function isFeedback(session: { readonly inheritedEventCount: number; readonly id: string }, event: RealEvent): boolean {
  if (event.seq < session.inheritedEventCount) return false;
  switch (event.type) {
    case "feedback/record":
      return true;
    case "feedback/message-put":
    case "feedback/message-delete":
      return event.data?.["sessionId"] === session.id;
    default:
      return false;
  }
}

describe("session — consumer VALUE IMPORT (session-telemetry-otel)", () => {
  test("bề mặt static của Session khớp gốc: create + fromRestore", () => {
    const namesOf = (cls: SessionClass): string[] => Object.getOwnPropertyNames(cls).filter((name) => !["length", "name", "prototype"].includes(name)).sort();
    expect(namesOf(ours.Session)).toEqual(namesOf(stock.Session));
    expect(namesOf(ours.Session)).toEqual(["create", "fromRestore"]);
  });

  test("Session.fromRestore (đường telemetry dùng) A/B cho cùng log/surface", () => {
    const id = realSession.header["id"] as string;
    const baseSession = stock.Session.fromRestore(id, realSession.events, realSession.header, stock.SessionLogOffset(0), {});
    const ourSession = ours.Session.fromRestore(id, realSession.events, realSession.header, ours.SessionLogOffset(0), {});
    expect(ourSession.id).toBe(baseSession.id);
    expect(ourSession.inheritedEventCount).toBe(baseSession.inheritedEventCount);
    expect(chuanHoaThoiGian(ourSession.log)).toBe(chuanHoaThoiGian(baseSession.log));
    expect(chuanHoaThoiGian(ourSession.surface)).toBe(chuanHoaThoiGian(baseSession.surface));
  });

  test("lọc isFeedback của telemetry trên phiên A/B cho CÙNG tập event", () => {
    const id = realSession.header["id"] as string;
    const baseSession = stock.Session.fromRestore(id, realSession.events, realSession.header, stock.SessionLogOffset(0), {});
    const ourSession = ours.Session.fromRestore(id, realSession.events, realSession.header, ours.SessionLogOffset(0), {});
    const baseFeedback = realSession.events.filter((event) => isFeedback(baseSession, event));
    const ourFeedback = realSession.events.filter((event) => isFeedback(ourSession, event));
    expect(JSON.stringify(ourFeedback)).toBe(JSON.stringify(baseFeedback));
    expect(ourFeedback.length).toBe(baseFeedback.length);
  });

  test("Session.create A/B trên phiên thật cho cùng log/surface", () => {
    const id = realSession.header["id"] as string;
    const baseSession = stock.Session.create(id, realSession.events, realSession.header);
    const ourSession = ours.Session.create(id, realSession.events, realSession.header);
    expect(chuanHoaThoiGian(ourSession.log)).toBe(chuanHoaThoiGian(baseSession.log));
    expect(chuanHoaThoiGian(ourSession.surface)).toBe(chuanHoaThoiGian(baseSession.surface));
  });
});
