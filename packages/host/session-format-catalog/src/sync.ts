/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Script đồng bộ artefact NGUYÊN VĂN từ gói STOCK @deepseek-ai/dsh-session-format-catalog (index + toàn bộ
 *      lib/types/*.js + locale/**) sang lib/ và xác minh từng byte, delta, sha + provenance.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** Gốc repo (tệp nằm ở packages/host/session-format-catalog/src). */
const REPO = join(import.meta.dir, "..", "..", "..", "..");
/** Thư mục nguồn CHỈ ĐỌC của gói stock. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-format-catalog");
/** Thư mục đích trong gói ta. */
const OURS = join(import.meta.dir, "..");

/** Một dòng báo cáo của script đồng bộ. */
export interface SyncRow { readonly file: string; readonly bytes: number; readonly delta: number; readonly equal: boolean; readonly sha: string }

/** Tính sha256 của buffer. */
function sha(buf: Buffer): string { return createHash("sha256").update(buf).digest("hex"); }

/** Liệt kê mọi tệp .js dưới lib/types của stock (đệ quy). */
function typeFiles(): string[] {
  const dir = join(STOCK, "lib", "types");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? [] : entry.name.endsWith(".js") ? ["lib/types/" + entry.name] : [];
  }).sort();
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
 * Nhận: không. Trả: danh sách SyncRow (bytes/delta/equal/sha) — ném nếu lệch byte.
 */
export function syncArtifacts(): SyncRow[] {
  const files = ["lib/index.js", ...typeFiles(), ...localeFiles()];
  const out: SyncRow[] = [];
  for (const rel of files) {
    const from = join(STOCK, rel);
    const to = join(OURS, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    const a = readFileSync(from);
    const b = readFileSync(to);
    const equal = a.equals(b);
    if (!equal) throw new Error("lệch byte sau khi chép: " + rel);
    out.push({ file: rel, bytes: b.length, delta: b.length - a.length, equal, sha: sha(b) });
  }
  const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh?: { provenance?: { sha?: string } } };
  const provenanceSha = manifest.gbh?.provenance?.sha;
  const indexSha = sha(readFileSync(join(STOCK, "lib", "index.js")));
  if (provenanceSha !== indexSha) throw new Error("provenance.sha KHÔNG khớp sha stock: " + String(provenanceSha));
  return out;
}

if (import.meta.main) {
  const rows = syncArtifacts();
  for (const row of rows) console.log(row.bytes + " B  delta " + String(row.delta) + "  " + row.sha.slice(0, 8) + "  " + row.file);
  console.log("OK " + String(rows.length) + " tệp · provenance sha khớp stock");
}
