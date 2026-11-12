/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Test cho di trú TỰ ĐỘNG (Cách 1): đọc/ghi cờ migrate trong credentials.yaml, chỉ chạy một lần,
 *      không chạy khi home cũ không có sessions, dry-run không ghi gì.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { autoMigrate, daDiTru, ghiCoDiTru } from "../../apps/cli/src/auto-migrate.ts";

/** Dựng home cũ có một phiên. */
function dungHomeCu(goc: string): string {
  const cu = join(goc, "cu");
  mkdirSync(join(cu, "sessions", "ws", "id-1"), { recursive: true });
  writeFileSync(join(cu, "sessions", "ws", "id-1", "session.v4.jsonl.zstd"), "PHIEN");
  return cu;
}

describe("di trú tự động", () => {
  test("credentials.yaml: nhận cờ migrate và ghi cờ mà không phá nội dung cũ", () => {
    expect(daDiTru("migrate: true\n")).toBe(true);
    expect(daDiTru("baseUrl: x\n")).toBe(false);
    expect(ghiCoDiTru("baseUrl: x\n")).toBe("baseUrl: x\nmigrate: true\n");
    expect(ghiCoDiTru("migrate: false\n")).toBe("migrate: true\n");
    expect(ghiCoDiTru("migrate: true\n")).toBe("migrate: true\n");
  });

  test("lần đầu chép phiên + ghi cờ; lần hai chép 0 tệp (không nhân đôi)", () => {
    const goc = mkdtempSync(join(tmpdir(), "gbh-auto-"));
    const galaxyRoot = join(goc, ".galaxy");
    mkdirSync(galaxyRoot, { recursive: true });
    writeFileSync(join(galaxyRoot, "credentials.yaml"), "token: abc\n");
    const from = dungHomeCu(goc);
    const to = join(goc, "moi");
    mkdirSync(to, { recursive: true });

    const lan1 = autoMigrate({ galaxyRoot, from, to });
    expect(lan1.ran).toBe(true);
    expect(lan1.report?.copied).toBe(1);
    expect(existsSync(join(to, "sessions", "ws", "id-1", "session.v4.jsonl.zstd"))).toBe(true);
    expect(readFileSync(join(galaxyRoot, "credentials.yaml"), "utf8")).toContain("migrate: true");
    expect(readFileSync(join(galaxyRoot, "credentials.yaml"), "utf8")).toContain("token: abc");

    // 10/11/2026 (Lead): thiết kế ĐỔI — di trú chạy MỖI LẦN BOOT (phép THÊM, idempotent) để hai home
    // không lệch nhau khi người dùng còn mở app cũ (host cũ dùng DSH_HOME=~/.galaxy/gbh).
    const lan2 = autoMigrate({ galaxyRoot, from, to });
    expect(lan2.ran).toBe(true);
    expect(lan2.report?.copied).toBe(0);
    expect(lan2.report?.skipped).toBe(1);
  });

  test("phiên tạo MỚI ở home cũ sau lần đầu vẫn được mang sang (đúng ca drift thật)", () => {
    const goc = mkdtempSync(join(tmpdir(), "gbh-auto-drift-"));
    const galaxyRoot = join(goc, ".galaxy");
    mkdirSync(galaxyRoot, { recursive: true });
    writeFileSync(join(galaxyRoot, "credentials.yaml"), "token: abc\nmigrate: true\n");
    const from = dungHomeCu(goc);
    const to = join(goc, "moi");
    mkdirSync(to, { recursive: true });

    expect(autoMigrate({ galaxyRoot, from, to }).report?.copied).toBe(1);

    mkdirSync(join(from, "sessions", "ws", "id-2"), { recursive: true });
    writeFileSync(join(from, "sessions", "ws", "id-2", "session.v4.jsonl.zstd"), "PHIEN-2");

    const lan2 = autoMigrate({ galaxyRoot, from, to });
    expect(lan2.report?.copied).toBe(1);
    expect(existsSync(join(to, "sessions", "ws", "id-2", "session.v4.jsonl.zstd"))).toBe(true);
  });

  test("home cũ không có sessions ⇒ không chạy, không ghi cờ", () => {
    const goc = mkdtempSync(join(tmpdir(), "gbh-auto-trong-"));
    const galaxyRoot = join(goc, ".galaxy");
    mkdirSync(galaxyRoot, { recursive: true });
    writeFileSync(join(galaxyRoot, "credentials.yaml"), "token: abc\n");
    const from = join(goc, "cu-trong");
    const to = join(goc, "moi");
    mkdirSync(to, { recursive: true });

    const ketQua = autoMigrate({ galaxyRoot, from, to });
    expect(ketQua.ran).toBe(false);
    expect(readFileSync(join(galaxyRoot, "credentials.yaml"), "utf8")).toBe("token: abc\n");
  });

  test("dry-run: báo kế hoạch nhưng không chép và không ghi cờ", () => {
    const goc = mkdtempSync(join(tmpdir(), "gbh-auto-dry-"));
    const galaxyRoot = join(goc, ".galaxy");
    mkdirSync(galaxyRoot, { recursive: true });
    writeFileSync(join(galaxyRoot, "credentials.yaml"), "token: abc\n");
    const from = dungHomeCu(goc);
    const to = join(goc, "moi");
    mkdirSync(to, { recursive: true });

    const ketQua = autoMigrate({ galaxyRoot, from, to, dryRun: true });
    expect(ketQua.ran).toBe(true);
    expect(existsSync(join(to, "sessions"))).toBe(false);
    expect(readFileSync(join(galaxyRoot, "credentials.yaml"), "utf8")).not.toContain("migrate: true");
  });
});
