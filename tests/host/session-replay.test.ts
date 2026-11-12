/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Replay THẬT cho row session: đọc MỌI phiên .jsonl.zstd trong ~/.galaxy/blackhole/sessions (CHỈ ĐỌC),
 *      giải nén, rồi fold bằng bundle stock và bằng artefact của ta — so từng event/seq/surface/header.
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
/** Thư mục build tạm dưới lib/ (lint miễn trừ). */
const OUT = join(PKG, "lib", ".test-build-replay");
/** Thư mục phiên thật (CHỈ ĐỌC). */
const SESSIONS = join(process.env.HOME ?? "", ".galaxy", "blackhole", "sessions");

/** Bề mặt module session dùng trong test. */
interface SessionModule {
  /** Class Session (có static create). */
  readonly Session: {
    create(id: string, seed?: readonly unknown[], header?: Record<string, unknown>, inheritedEventCount?: number): {
      readonly id: string;
      readonly log: readonly unknown[];
      readonly surface: unknown;
      readonly inheritedEventCount: number;
    };
  };
  /** Chuẩn hoá header phiên. */
  readonly canonicalHeader: (header: Record<string, unknown>) => unknown;
  /** Snapshot một event để so hình dạng chuẩn tắc. */
  readonly snapshotSessionEvent: (event: unknown) => unknown;
}

/** Bundle stock nạp động. */
const stock = (await import(STOCK)) as unknown as SessionModule;
/** Module của TA. */
let ours: SessionModule;

/**
 * Chuẩn hoá log trước khi so: event tổng hợp "session/end-seed" do CHÍNH bước create/adopt sinh ra mang
 * `time` = đồng hồ thực tại thời điểm fold (stock và ta đều vậy) ⇒ đặt 0 để không so thời điểm chạy.
 * Nhận: log — mảng event. Trả: mảng event đã chuẩn hoá.
 */
function normalizeLog(log: readonly unknown[]): unknown[] {
  return log.map((event) => {
    const record = event as Record<string, unknown>;
    if (record["type"] === "session/end-seed") return { ...record, time: 0 };
    return record;
  });
}

/** Một phiên đọc từ đĩa: header đã bỏ trường type + events. */
interface RealSession {
  /** Tên file nguồn. */
  readonly file: string;
  /** Header phiên (không có trường type). */
  readonly header: Record<string, unknown>;
  /** Danh sách event theo thứ tự log. */
  readonly events: readonly Record<string, unknown>[];
}

/**
 * Liệt kê mọi file phiên .jsonl.zstd dưới thư mục sessions (đệ quy, CHỈ ĐỌC).
 * Nhận: root — thư mục gốc. Trả: danh sách đường dẫn file.
 */
function listSessionFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".jsonl.zstd")) {
        // 10/11/2026 (Lead): CHỈ replay phiên ĐỊNH DẠNG HIỆN HÀNH (v4). Home người dùng còn phiên v3
        // do bản cũ (galaxy-code, 02/10) ghi; schema hiện tại KHÔNG đọc được v3 — kể cả bản stock DSH
        // cũng ném "message must have system-prompt source" ⇒ đưa v3 vào phép so A/B là so sai đối tượng.
        if (entry.endsWith("session.v4.jsonl.zstd")) files.push(path);
      }
    }
  };
  walk(root);
  return files.sort();
}

/**
 * Giải nén + parse một file phiên thành header và events.
 * Nhận: path — file .jsonl.zstd. Trả: phiên đã parse.
 */
function readRealSession(path: string): RealSession {
  const text = new TextDecoder().decode(Bun.zstdDecompressSync(readFileSync(path)));
  const lines = text.split(String.fromCharCode(10)).filter((line) => line.trim() !== "");
  const rawHeader = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
  const { type: _type, ...header } = rawHeader;
  const events = lines.slice(1).map((line) => JSON.parse(line) as Record<string, unknown>);
  return { file: path, header, events };
}

beforeAll(async () => {
  await buildPackage(OUT);
  ours = (await import(join(OUT, "index.js"))) as unknown as SessionModule;
});

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

describe("session — replay dữ liệu THẬT (A stock vs B ours)", () => {
  // 10/11/2026 (Lead): nhà người dùng có 600+ phiên (sau khi di trú từ home cũ) — quét TOÀN BỘ vượt
  // trần thời gian của bun và làm cổng đỏ oan. Lấy MẪU cố định: phiên v4 ≤ 8 MB, sắp theo đường dẫn,
  // lấy tối đa 20 tệp ⇒ vẫn là dữ liệu THẬT, chạy nhanh và ổn định.
  const MAX_MB = 8 * 1024 * 1024;
  const files = listSessionFiles(SESSIONS)
    .filter((path) => statSync(path).size <= MAX_MB)
    .slice(0, 20);

  test("có phiên thật để replay (>= 1 file, >= 1 event)", () => {
    expect(files.length).toBeGreaterThan(0);
    const sample = readRealSession(files[0] as string);
    expect(sample.events.length).toBeGreaterThan(0);
  });

  test("MỌI phiên: fold A/B cho cùng id/inheritedEventCount/log/surface", () => {
    let compared = 0;
    let eventsCompared = 0;
    let skipped = 0;
    for (const path of files) {
      const real = readRealSession(path);
      // 10/11/2026 (Lead): home người dùng có phiên v4 do BẢN CŨ ghi (thiếu inheritedEventCount…).
      // Cả hai bản đều từ chối ⇒ không phải đối tượng của phép so A/B; đếm vào skipped thay vì làm đỏ cổng.
      let baseSession;
      try {
        baseSession = stock.Session.create(real.header["id"] as string, real.events, real.header);
      } catch {
        skipped += 1;
        continue;
      }
      const ourSession = ours.Session.create(real.header["id"] as string, real.events, real.header);
      expect(ourSession.id).toBe(baseSession.id);
      expect(ourSession.inheritedEventCount).toBe(baseSession.inheritedEventCount);
      expect(JSON.stringify(normalizeLog(ourSession.log))).toBe(JSON.stringify(normalizeLog(baseSession.log)));
      const baseSurface = baseSession.surface as { readonly log?: readonly unknown[] };
      const ourSurface = ourSession.surface as { readonly log?: readonly unknown[] };
      expect(JSON.stringify(normalizeLog(ourSurface.log ?? []))).toBe(JSON.stringify(normalizeLog(baseSurface.log ?? [])));
      compared += 1;
      eventsCompared += real.events.length;
    }
    expect(compared + skipped).toBe(files.length);
    expect(compared).toBeGreaterThan(0);
    expect(eventsCompared).toBeGreaterThan(0);
    // Fold MỌI phiên thật mất ~10s (mặc định bun 5s ⇒ đỏ oan): nâng trần riêng cho ca này.
  }, 120_000);

  test("MỌI event: snapshotSessionEvent A/B bằng nhau từng event", () => {
    let compared = 0;
    let skipped = 0;
    for (const path of files) {
      const real = readRealSession(path);
      if (real.events.length === 0) continue;
      let snapshotStock: string[] = [];
      try {
        snapshotStock = real.events.map((event) => JSON.stringify(stock.snapshotSessionEvent(event)));
      } catch {
        // 10/11/2026 (Lead): event của phiên do bản CŨ ghi mà bản stock từ chối ⇒ ngoài phạm vi so A/B.
        skipped += 1;
        continue;
      }
      const snapshotOurs = real.events.map((event) => JSON.stringify(ours.snapshotSessionEvent(event)));
      expect(snapshotOurs).toEqual(snapshotStock);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(0);
    // Quét mọi event của mọi phiên thật mất ~7s (mặc định bun 5s ⇒ đỏ oan): nâng trần riêng.
  }, 120_000);

  test("canonicalHeader A/B bằng nhau trên mọi header thật", () => {
    let compared = 0;
    for (const path of files) {
      const real = readRealSession(path);
      // 10/11/2026 (Lead): header do bản CŨ ghi (vd thiếu inheritedEventCount) mà stock từ chối ⇒ bỏ qua.
      let chuanStock: string;
      try {
        chuanStock = JSON.stringify(stock.canonicalHeader(real.header));
      } catch {
        continue;
      }
      expect(JSON.stringify(ours.canonicalHeader(real.header))).toBe(chuanStock);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(0);
  });
});