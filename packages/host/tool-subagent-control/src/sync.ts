/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Script đồng bộ artefact NGUYÊN VĂN từ @galaxy-blackhole/gbh-tool-subagent-control (index + lib/types/*.js
 *      + locale/**) sang lib/ và xác minh từng byte, delta, sha + provenance.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** Gốc repo (tệp nằm ở packages/host/tool-subagent-control/src). */
const REPO = join(import.meta.dir, "..", "..", "..", "..");
/** Thư mục nguồn CHỈ ĐỌC của gói stock. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-subagent-control");
/** Thư mục đích trong gói ta. */
const OURS = join(import.meta.dir, "..");

/** Một dòng báo cáo. */
export interface SyncRow { readonly file: string; readonly bytes: number; readonly delta: number; readonly equal: boolean; readonly sha: string }

/** Tính sha256 của buffer. */
function sha(buf: Buffer): string { return createHash("sha256").update(buf).digest("hex"); }

/** Liệt kê tệp .js dưới lib/types (đệ quy) của stock. */
function typeFiles(): string[] {
  const root = join(STOCK, "lib", "types");
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((name) => name.endsWith(".js")).sort().map((name) => "lib/types/" + name);
}

/** Liệt kê mọi tệp dưới locale của stock (đệ quy). */
function localeFiles(): string[] {
  const root = join(STOCK, "locale");
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(join("locale", relative(root, full)));
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Chép NGUYÊN VĂN index + types + locale từ stock sang gói ta rồi so từng byte.
 * Nhận: không. Trả: danh sách SyncRow — ném khi lệch byte hoặc provenance sha không khớp.
 */
export function syncArtifacts(): SyncRow[] {
  const out: SyncRow[] = [];
  for (const rel of ["lib/index.js", ...typeFiles(), ...localeFiles()]) {
    const from = join(STOCK, rel);
    const to = join(OURS, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    const a = readFileSync(from);
    const b = readFileSync(to);
    if (!a.equals(b)) throw new Error("lệch byte sau khi chép: " + rel);
    out.push({ file: rel, bytes: b.length, delta: b.length - a.length, equal: true, sha: sha(b) });
  }
  const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh?: { provenance?: { sha?: string } } };
  if (manifest.gbh?.provenance?.sha !== sha(readFileSync(join(STOCK, "lib", "index.js")))) throw new Error("provenance.sha KHÔNG khớp stock");
  return out;
}

if (import.meta.main) {
  const rows = syncArtifacts();
  for (const row of rows) console.log(row.bytes + " B  delta " + String(row.delta) + "  " + row.sha.slice(0, 8) + "  " + row.file);
  console.log("OK " + String(rows.length) + " tệp · provenance sha khớp stock");
}
