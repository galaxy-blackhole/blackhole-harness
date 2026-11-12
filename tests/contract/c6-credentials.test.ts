/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hop dong C6: mot tai lieu credentials duy nhat, thu tu lop env > file, khong ro secret
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { APP_HOME, readFixture, REPO_ROOT } from "./lib.ts";

/** Fixture ghim credentials (C6). */
interface CredentialsFixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** Đường dẫn chia sẻ bắt buộc, dạng ~. */
  pinnedPathTilde: string;
  /** Các row credentials trong cây. */
  credentialRows: { id: string; name: string; path: string | null }[];
  /** Các file ghim đường dẫn. */
  pinning: { file: string; pinsSharedPath: boolean }[];
  /** Kết quả quét secret. */
  secretScan: { files: number; hits: string[] };
}

/** Fixture đã đóng băng. */
const fixture = readFixture<CredentialsFixture>("c6-credentials.json");

describe("C6 — credentials (một gốc duy nhất, env thắng file)", () => {
  test("đúng một row credentials và trỏ tới harness seam", () => {
    expect(fixture.credentialRows.length).toBe(1);
    expect(fixture.credentialRows[0]?.name).toBe("@deepseek-ai/dsh-credentials-local");
    expect(fixture.credentialRows[0]?.id).toBe("credentials");
  });

  test("đường dẫn ghim là tài liệu dùng chung của hệ Galaxy", () => {
    expect(fixture.pinnedPathTilde).toBe("~/.galaxy/credentials.yaml");
  });

  test("có ít nhất một file patch ghim đường dẫn đó", () => {
    const pinning = fixture.pinning.filter((p) => p.pinsSharedPath);
    expect(pinning.length).toBeGreaterThan(0);
  });

  test("tài liệu credentials KHÔNG nằm trong home app và KHÔNG nằm trong ~/.galaxy/gbh", () => {
    const pinned = fixture.pinnedPathTilde;
    expect(pinned).not.toContain("/blackhole/");
    expect(pinned).not.toContain("~/.galaxy/blackhole");
    expect(pinned).not.toContain("gbh/");
  });

  test("file khai báo không chứa secret nào", () => {
    expect(fixture.secretScan.hits).toEqual([]);
    expect(fixture.secretScan.files).toBeGreaterThan(0);
  });

  test("thứ tự lớp: env tiến trình thắng file (CLI có GBH_CREDENTIALS)", () => {
    const paths = join(REPO_ROOT, "apps", "cli", "src", "paths.ts");
    expect(existsSync(paths)).toBe(true);
    const source = readFileSync(paths, "utf8");
    expect(source).toContain("GBH_CREDENTIALS");
    expect(source).toContain("credentials.yaml");
  });

  test("home app là ~/.galaxy/blackhole, không phải ~/.galaxy/gbh", () => {
    expect(APP_HOME.endsWith("/.galaxy/blackhole")).toBe(true);
    expect(APP_HOME.endsWith("gbh")).toBe(false);
  });
});
