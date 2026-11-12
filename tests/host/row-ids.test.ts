/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test luat MOT row.id MOT package — phai BAT duoc ca that 18/10/2026 (ui-brand vs ui-brand-official)
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { duplicateRowIdIssues } from "../../tools/check/row-ids.ts";

/**
 * Dung mot thu muc package gia voi `gbh.row.id` cho truoc.
 * Nhan: root — thu muc goc; ten — ten thu muc; pkg — ten package; rowId — id row (hoac undefined).
 * Tra: duong dan thu muc package vua dung.
 */
function fixture(root: string, ten: string, pkg: string, rowId?: string): string {
  const dir = join(root, ten);
  mkdirSync(dir, { recursive: true });
  const meta: Record<string, unknown> = { name: pkg };
  if (rowId !== undefined) meta.gbh = { row: { id: rowId, moduleIds: [pkg], aliases: [] } };
  writeFileSync(join(dir, "package.json"), JSON.stringify(meta));
  return dir;
}

describe("luat MOT row.id MOT package", () => {
  test("BAT khi hai package cung row.id — dung ca that ui-brand vs ui-brand-official", () => {
    const root = mkdtempSync(join(tmpdir(), "gbh-rowids-"));
    try {
      const a = fixture(root, "ui-brand", "@galaxy-stack/gbh-brand", "ui-brand-official");
      const b = fixture(root, "ui-brand-official", "@galaxy-blackhole/gbh-client-ui-brand-official", "ui-brand-official");
      const issues = duplicateRowIdIssues([a, b]);
      expect(issues).toHaveLength(1);
      expect(issues[0]?.level).toBe("chan");
      expect(issues[0]?.detail).toContain("ui-brand-official");
      expect(issues[0]?.detail).toContain("KHONG BAO GIO chay");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("KHONG BAT khi moi row.id chi co mot package", () => {
    const root = mkdtempSync(join(tmpdir(), "gbh-rowids-"));
    try {
      const a = fixture(root, "ui-goal", "@galaxy-blackhole/gbh-client-ui-goal", "ui-goal");
      const b = fixture(root, "ui-plan", "@galaxy-blackhole/gbh-client-ui-plan", "ui-plan");
      expect(duplicateRowIdIssues([a, b])).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("bo qua package khong khai gbh.row", () => {
    const root = mkdtempSync(join(tmpdir(), "gbh-rowids-"));
    try {
      const a = fixture(root, "file-upload", "@galaxy-blackhole/gbh-client-file-upload");
      const b = fixture(root, "ui-goal", "@galaxy-blackhole/gbh-client-ui-goal", "ui-goal");
      expect(duplicateRowIdIssues([a, b])).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
