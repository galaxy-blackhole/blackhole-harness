/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hop dong C5: dinh dang phien tren dia (session.v4.jsonl.zstd) — khung do, round-trip do o M4
 */

import { describe, expect, test } from "bun:test";
import { readFixture, readSessionSchema } from "./lib.ts";

/** Fixture định dạng phiên (C5). */
interface SessionFixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** Thư mục đã khảo sát. */
  root: string;
  /** Schema tổng hợp. */
  schema: {
    fileCount: number;
    versions: string[];
    namingPatterns: string[];
    records: { type: string; count: number; keys: string[] }[];
  };
  /** Khoá bắt buộc của bản ghi header. */
  headerKeys: string[];
}

/** Fixture đã đóng băng. */
const fixture = readFixture<SessionFixture>("c5-session-format.json");

/** Khảo sát lại ngay lúc chạy test (chỉ khi máy có phiên). */
const live = readSessionSchema();
const hasSessions = live.schema.fileCount > 0;

describe("C5 — định dạng phiên (khung đo; round-trip đo ở M4)", () => {
  test("tên file và phiên bản định dạng đã đóng băng", () => {
    expect(fixture.schema.namingPatterns).toEqual(["session.v4.jsonl.zstd"]);
    expect(fixture.schema.versions).toEqual(["v4"]);
    expect(fixture.root).toContain(".galaxy/blackhole/sessions");
    expect(fixture.root).not.toContain("gbh");
  });

  test("bản ghi header có đủ khoá bắt buộc", () => {
    const header = fixture.schema.records.find((r) => r.type === "session");
    expect(header).toBeDefined();
    expect(fixture.headerKeys).toEqual([
      "agentPreset",
      "createdAt",
      "cwd",
      "delegationDepth",
      "id",
      "isSeeded",
      "type",
      "version",
    ]);
    expect(header?.keys).toEqual(fixture.headerKeys);
  });

  test.skipIf(!hasSessions)("đọc lại phiên thật: giải nén zstd + JSONL, header đúng hợp đồng", () => {
    expect(live.samples.length).toBeGreaterThan(0);
    for (const sample of live.samples) {
      const first = sample.records[0];
      expect(first?.type).toBe("session");
      for (const key of fixture.headerKeys) expect(first?.keys).toContain(key);
    }
  });

  test("khảo sát không sao chép nội dung hội thoại (chỉ type + khoá)", () => {
    const text = JSON.stringify(fixture);
    expect(text).not.toContain('"cwd":"/');
    for (const record of fixture.schema.records) {
      for (const key of record.keys) expect(key).not.toContain(" ");
    }
  });

  test.todo("M4: mở lại một phiên do DSH tạo bằng code của ta + diff từng record (round-trip)");
  test.todo("M4: ghi bảng migration v0 → v4 (thực tế trên đĩa là v4, ARCHITECTURE đang giả định v3)");
});
