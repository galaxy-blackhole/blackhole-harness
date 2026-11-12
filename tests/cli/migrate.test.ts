/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Test cho lệnh bh migrate: chỉ chép tệp còn thiếu, không ghi đè, dry-run không ghi,
 *      bỏ qua tệp khoá phiên, và không bao giờ chạm home cũ.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { lietKeTep, migrateHome } from "../../apps/cli/src/migrate.ts";

/** Dựng một home giả có sẵn vài tệp phiên. */
function dungHome(goc: string, tep: Record<string, string>): string {
  for (const [duong, noiDung] of Object.entries(tep)) {
    const dich = join(goc, duong);
    mkdirSync(join(dich, ".."), { recursive: true });
    writeFileSync(dich, noiDung);
  }
  return goc;
}

describe("bh migrate", () => {
  test("chép tệp còn thiếu, bỏ qua tệp đã có, không ghi đè", () => {
    const goc = mkdtempSync(join(tmpdir(), "gbh-migrate-"));
    const cu = dungHome(join(goc, "cu"), {
      "sessions/ws/a/session.v4.jsonl.zstd": "A",
      "sessions/ws/b/session.v4.jsonl.zstd": "B",
      "sessions/ws/b/session.lock": "LOCK",
    });
    const moi = dungHome(join(goc, "moi"), { "sessions/ws/a/session.v4.jsonl.zstd": "A-CU" });

    const bao = migrateHome({ from: cu, to: moi });

    expect(bao.copied).toBe(1);
    expect(bao.skipped).toBe(1);
    expect(bao.bytes).toBe(1);
    expect(readFileSync(join(moi, "sessions/ws/a/session.v4.jsonl.zstd"), "utf8")).toBe("A-CU");
    expect(readFileSync(join(moi, "sessions/ws/b/session.v4.jsonl.zstd"), "utf8")).toBe("B");
    expect(existsSync(join(moi, "sessions/ws/b/session.lock"))).toBe(false);
  });

  test("dry-run không ghi gì nhưng báo đúng kế hoạch", () => {
    const goc = mkdtempSync(join(tmpdir(), "gbh-migrate-dry-"));
    const cu = dungHome(join(goc, "cu"), { "attachments/x/y.bin": "XY" });
    const moi = join(goc, "moi");
    mkdirSync(moi, { recursive: true });

    const bao = migrateHome({ from: cu, to: moi, dryRun: true });

    expect(bao.dryRun).toBe(true);
    expect(bao.copied).toBe(1);
    expect(bao.bytes).toBe(2);
    expect(existsSync(join(moi, "attachments/x/y.bin"))).toBe(false);
  });

  test("home cũ thiếu vùng nào thì báo vùng đó, không ném lỗi", () => {
    const goc = mkdtempSync(join(tmpdir(), "gbh-migrate-thieu-"));
    const cu = dungHome(join(goc, "cu"), { "sessions/a/s.v4.jsonl.zstd": "A" });
    const moi = join(goc, "moi");
    mkdirSync(moi, { recursive: true });

    const bao = migrateHome({ from: cu, to: moi });

    expect(bao.missing).toEqual(["storages", "attachments"]);
    expect(bao.copied).toBe(1);
  });

  test("lietKeTep bỏ tệp khoá và trả đường dẫn tương đối đã sắp xếp", () => {
    const goc = mkdtempSync(join(tmpdir(), "gbh-migrate-list-"));
    dungHome(goc, { "b/x": "1", "a/y": "2", "a/session.lock": "3" });
    expect(lietKeTep(goc)).toEqual(["a/y", "b/x"]);
  });
});
