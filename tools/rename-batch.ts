/*
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 02/11/2026
 desc Đổi tên lô: thay @deepseek-ai/* trong src của một nhóm gói sang @galaxy-blackhole/gbh-*,
      thêm phụ thuộc workspace, rồi TỰ KIỂM: typecheck phải 0 vi phạm, không thì HOÀN NGUYÊN lô.
*/

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Kết quả một lô đổi tên. */
export interface BatchResult {
  /** Tên gói đã xử lý. */
  packages: string[];
  /** Số tệp đã sửa. */
  files: number;
  /** Số chỗ đã sửa. */
  sites: number;
  /** Số vi phạm typecheck sau khi sửa (0 = đạt). */
  violations: number;
  /** Đã hoàn nguyên vì typecheck đỏ? */
  reverted: boolean;
}

const SPECIFIER = /"(@deepseek-ai\/[a-z0-9./-]+)"/gu;
const SKIP_DIR = /(^|\/)(parts|client-parts)(-[a-z0-9-]+)?(\/|$)/u;
const SKIP_FILE = /(-slice)(-[a-z0-9]+)?\.ts$/u;

/**
 * Dựng bảng tên gốc sang tên của ta từ provenance.stock của mọi manifest.
 * @param repo gốc repo.
 * @returns bảng ánh xạ.
 */
export function stockToOurs(repo: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const tier of ["host", "client", "tools"]) {
    const dir = join(repo, "packages", tier);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const manifest = join(dir, name, "package.json");
      if (!existsSync(manifest)) continue;
      const parsed = JSON.parse(readFileSync(manifest, "utf8")) as {
        name?: string;
        gbh?: { provenance?: { stock?: string } };
      };
      const stock = parsed.gbh?.provenance?.stock;
      if (typeof stock === "string" && typeof parsed.name === "string") map.set(stock, parsed.name);
    }
  }
  return map;
}

/**
 * Thay mọi specifier gốc trong một tệp.
 * @param text nội dung tệp.
 * @param map bảng ánh xạ.
 * @returns nội dung mới, số chỗ đã đổi, các tên của ta đã dùng.
 */
function renameInText(text: string, map: Map<string, string>): { next: string; count: number; used: Set<string> } {
  const used = new Set<string>();
  let count = 0;
  const next = text.replace(SPECIFIER, (whole: string, spec: string) => {
    const parts = spec.split("/");
    for (let cut = parts.length; cut > 1; cut -= 1) {
      const base = parts.slice(0, cut).join("/");
      const ours = map.get(base);
      if (ours === undefined) continue;
      used.add(ours);
      count += 1;
      const suffix = parts.slice(cut).join("/");
      return '"' + ours + (suffix === "" ? "" : "/" + suffix) + '"';
    }
    return whole;
  });
  return { next, count, used };
}

/**
 * Đổi tên một lô gói, tự kiểm bằng typecheck; đỏ thì hoàn nguyên.
 * @param repo gốc repo.
 * @param packages tên thư mục gói trong packages/host.
 * @returns kết quả lô.
 */
export function renameBatch(repo: string, packages: readonly string[]): BatchResult {
  const map = stockToOurs(repo);
  const backup = join(tmpdir(), "gbh-rename-batch-backup");
  rmSync(backup, { recursive: true, force: true });
  mkdirSync(backup, { recursive: true });
  const sites: { file: string; count: number }[] = [];
  for (const name of packages) {
    const base = join(repo, "packages", "host", name);
    if (!existsSync(base)) continue;
    cpSync(base, join(backup, name), { recursive: true });
    const used = new Set<string>();
    const srcDir = join(base, "src");
    if (!existsSync(srcDir)) continue;
    for (const file of walk(srcDir)) {
      if (SKIP_DIR.test(file) || SKIP_FILE.test(file)) continue;
      const before = readFileSync(file, "utf8");
      const renamed = renameInText(before, map);
      if (renamed.next === before) continue;
      writeFileSync(file, renamed.next, "utf8");
      sites.push({ file, count: renamed.count });
      for (const one of renamed.used) used.add(one);
    }
    const manifestPath = join(base, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { dependencies?: Record<string, string> };
    const dependencies = manifest.dependencies ?? {};
    let added = 0;
    for (const ours of used) {
      if (dependencies[ours] !== undefined) continue;
      dependencies[ours] = "workspace:*";
      added += 1;
    }
    if (added > 0) writeFileSync(manifestPath, JSON.stringify({ ...manifest, dependencies }, null, 2) + "\n", "utf8");
  }
  run(repo, ["bun", "install"]);
  const violations = countViolations(repo);
  const total = sites.reduce((sum, one) => sum + one.count, 0);
  if (violations > 0) {
    for (const name of packages) {
      const saved = join(backup, name);
      if (!existsSync(saved)) continue;
      rmSync(join(repo, "packages", "host", name), { recursive: true, force: true });
      cpSync(saved, join(repo, "packages", "host", name), { recursive: true });
    }
    run(repo, ["bun", "install"]);
    return { packages: [...packages], files: sites.length, sites: total, violations, reverted: true };
  }
  return { packages: [...packages], files: sites.length, sites: total, violations, reverted: false };
}

/**
 * Liệt kê mọi tệp .ts dưới một thư mục.
 * @param dir thư mục gốc.
 * @returns danh sách đường dẫn tuyệt đối.
 */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith(".ts")) out.push(path);
  }
  return out;
}

/**
 * Chạy một lệnh trong repo.
 * @param repo gốc repo.
 * @param argv lệnh và tham số.
 */
function run(repo: string, argv: readonly string[]): void {
  const [cmd, ...args] = argv;
  execFileSync(cmd as string, args, { cwd: repo, stdio: "ignore" });
}

/**
 * Đếm vi phạm typecheck bằng chính cổng của repo.
 * @param repo gốc repo.
 * @returns số vi phạm.
 */
function countViolations(repo: string): number {
  try {
    const out = execFileSync("bun", ["run", "tools/lint/gate.ts", "--only", "typecheck"], { cwd: repo, encoding: "utf8" });
    return (out.match(/^FAIL/mu) ?? []).length;
  } catch (error) {
    const out = String((error as { stdout?: string }).stdout ?? "");
    return (out.match(/^FAIL/mu) ?? []).length || 1;
  }
}

if (import.meta.main) {
  const packages = process.argv.slice(2);
  if (packages.length === 0) {
    console.log("dung: bun run tools/rename-batch.ts <goi-1> [goi-2 ...]");
    process.exit(1);
  }
  const result = renameBatch(process.cwd(), packages);
  console.log(JSON.stringify(result));
  process.exit(result.reverted ? 1 : 0);
}
