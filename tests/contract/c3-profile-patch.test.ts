/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hop dong C3: profile/patch — cay plugin cua ta khop Oracle A, moi goi co that trong runtime
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { basePackageName, rowFingerprint, type ParsedRow } from "../../tools/lint/dump-parse.ts";
import { readFixture, REPO_ROOT } from "./lib.ts";

/** Một cây row trong fixture. */
interface TreeSide {
  /** File nguồn. */
  source: string;
  /** Số row. */
  rowCount: number;
  /** Các row đã đọc từ YAML thô. */
  rows: ParsedRow[];
}

/** Fixture cây plugin đã đóng băng (C3). */
interface ProfileFixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** File index của giàn parity. */
  from: string;
  /** Cây của app ta. */
  ours: TreeSide;
  /** Cây của Oracle A. */
  oracleA: TreeSide | null;
  /** So cấu trúc row giữa ta và oracle. */
  structuralDiff: { added: string[]; removed: string[]; changed: string[] } | null;
  /** So nội dung đầy đủ theo bản chuẩn hoá của giàn parity. */
  contentDiff: { added: string[]; removed: string[]; changed: string[] } | null;
  /** Thống kê về bộ chuẩn hoá của giàn parity. */
  normaliser: { redactedIds: number; note: string };
}

/** Thư mục runtime của harness (cài riêng, không thuộc workspace). */
const RUNTIME_PACKAGES = join(REPO_ROOT, "apps", "host", "node_modules", "@deepseek-ai");

/** Fixture đã đóng băng. */
const fixture = readFixture<ProfileFixture>("c3-profile-tree.json");

/** Chuỗi mô tả một diff cho thông báo lỗi. */
function describeDiff(diff: { added: string[]; removed: string[]; changed: string[] } | null): string {
  if (diff === null) return "(không có dữ liệu)";
  return "+" + diff.added.length + " -" + diff.removed.length + " ~" + diff.changed.length +
    " :: " + [...diff.added, ...diff.removed, ...diff.changed].slice(0, 5).join(", ");
}

describe("C3 — profile/patch", () => {
  test("cây của ta: >=189 row, id duy nhất, index liên tục", () => {
    expect(fixture.ours.rowCount).toBe(fixture.ours.rows.length);
    expect(fixture.ours.rowCount).toBeGreaterThanOrEqual(189);
    const ids = fixture.ours.rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(fixture.ours.rows.map((r) => r.index)).toEqual(ids.map((_, i) => i));
    expect(ids.every((id) => id.trim() !== "")).toBe(true);
  });

  test("mọi row đều có tên package", () => {
    const missing = fixture.ours.rows.filter((r) => r.name.trim() === "").map((r) => r.id);
    expect(missing).toEqual([]);
  });

  test("cấu trúc cây khớp Oracle A (bản rút gọn, độc lập với bộ chuẩn hoá)", () => {
    expect(fixture.oracleA).not.toBeNull();
    if (fixture.oracleA === null) return;
    expect(fixture.ours.rowCount).toBe(fixture.oracleA.rowCount);
    // So lại tại chỗ để chắc chắn fixture không bị sửa tay.
    const a = new Map(fixture.oracleA.rows.map((r) => [r.id, rowFingerprint(r)]));
    const b = new Map(fixture.ours.rows.map((r) => [r.id, rowFingerprint(r)]));
    const changed = [...b].filter(([id, fp]) => a.get(id) !== undefined && a.get(id) !== fp).map(([id]) => id);
    const added = [...b.keys()].filter((id) => !a.has(id));
    const removed = [...a.keys()].filter((id) => !b.has(id));
    expect(describeDiff({ added, removed, changed })).toBe("+0 -0 ~0 :: ");
  });

  test("nội dung cây khớp Oracle A: +0 -0 ~0 (bằng chứng M1a)", () => {
    expect(fixture.contentDiff).not.toBeNull();
    expect(fixture.contentDiff?.added).toEqual([]);
    expect(fixture.contentDiff?.removed).toEqual([]);
    expect(fixture.contentDiff?.changed).toEqual([]);
  });

  test("id dài bị bộ chuẩn hoá của giàn parity che nhầm — đã đo và ghi lại", () => {
    const longIds = fixture.ours.rows.filter((r) => r.id.length >= 32).map((r) => r.id);
    expect(fixture.normaliser.redactedIds).toBe(longIds.length);
    expect(fixture.normaliser.note).toContain("C3-profile-patch.md");
  });

  test("mọi gói @deepseek-ai/* trong cây đều có thật trong runtime đã cài", () => {
    if (!existsSync(RUNTIME_PACKAGES)) {
      console.log("bỏ qua: chưa cài apps/host/node_modules (chạy bun run host:install)");
      return;
    }
    const missing: string[] = [];
    for (const row of fixture.ours.rows) {
      if (!row.name.startsWith("@deepseek-ai/")) continue;
      const dir = join(RUNTIME_PACKAGES, basePackageName(row.name).slice("@deepseek-ai/".length));
      if (!existsSync(dir)) missing.push(row.name);
    }
    expect(missing).toEqual([]);
  });

  test("profile root cordis.yml luôn là [] (cây chỉ được compose từ patch)", () => {
    const path = join(REPO_ROOT, "profiles", "blackhole", "cordis.yml");
    expect(existsSync(path)).toBe(true);
    const body = readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n")
      .trim();
    expect(body).toBe("[]");
  });

  test("lớp patch của app ghim credentials dùng chung", () => {
    const path = join(REPO_ROOT, "profiles", "blackhole", "app.patch.yml");
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("credentials.yaml");
  });
});
