/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Script đồng bộ artefact NGUYÊN VĂN từ gói STOCK @deepseek-ai/dsh-sdk-jsonrpc-server (index + lib/types/*.js + locale/**)
 *      sang lib/, in bytes/delta/equal/sha và đối chiếu provenance.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..", "..");
/** Nguồn stock CHỈ ĐỌC. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-sdk-jsonrpc-server");
/** Đích trong gói ta. */
const OURS = join(import.meta.dir, "..");

/** Một dòng báo cáo. */
export interface SyncRow { readonly file: string; readonly bytes: number; readonly delta: number; readonly equal: boolean; readonly sha: string }

/** sha256 của buffer. */
function sha(buf: Buffer): string { return createHash("sha256").update(buf).digest("hex"); }

/** Liệt kê tệp dưới thư mục con của stock. */
function filesUnder(sub: string): string[] {
  const root = join(STOCK, sub);
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(join(sub, relative(root, full)));
    }
  };
  walk(root);
  return out.sort();
}

/** Bản đồ id stock → gói GBH (R6a — PHASE B "denTa SAU cổng byte", Lead duyệt 08/11/2026). */
const ID_MAP: readonly (readonly [string, string])[] = [
  ["@deepseek-ai/dsh-llm-deepseek-api-key", "@galaxy-blackhole/gbh-llm-deepseek-api-key"],
];

/**
 * Áp bản đồ id lên văn bản artefact (denTa). Nhận: text. Trả: văn bản đã đổi id.
 */
function denTa(text: string): string {
  let out = text;
  for (const [stock, ours] of ID_MAP) out = out.split(stock).join(ours);
  return out;
}

/**
 * Quy id của artefact về dạng stock để CỔNG BYTE vẫn so được (mọi khác biệt khác id vẫn lộ).
 * Nhận: text. Trả: văn bản đã quy id về stock.
 */
function nguocDenTa(text: string): string {
  let out = text;
  for (const [stock, ours] of ID_MAP) out = out.split(ours).join(stock);
  return out;
}

/**
 * Chép NGUYÊN VĂN index + types + locale từ stock sang gói ta rồi so từng byte.
 * Nhận: không. Trả: SyncRow[] — ném khi lệch byte hoặc provenance.sha không khớp.
 */
export function syncArtifacts(): SyncRow[] {
  const out: SyncRow[] = [];
  for (const rel of ["lib/index.js", ...filesUnder("lib/types"), ...filesUnder("locale")]) {
    const from = join(STOCK, rel);
    const to = join(OURS, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    const a = readFileSync(from);
    const b = readFileSync(to);
    // CỔNG BYTE: bản chép từ stock phải NGUYÊN VĂN trước khi denTa.
    if (!a.equals(b)) throw new Error("lệch byte sau khi chép: " + rel);
    // denTa SAU cổng byte (Lead duyệt): chỉ artefact runtime lib/index.js mang id GBH.
    let emitted = b;
    if (rel === "lib/index.js") {
      const text = denTa(b.toString("utf8"));
      writeFileSync(to, text, "utf8");
      emitted = readFileSync(to);
      if (nguocDenTa(emitted.toString("utf8")) !== b.toString("utf8")) throw new Error("lệch byte sau denTa: " + rel);
    }
    out.push({ file: rel, bytes: emitted.length, delta: emitted.length - a.length, equal: true, sha: sha(emitted) });
  }
  const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh?: { provenance?: { sha?: string } } };
  if (m.gbh?.provenance?.sha !== sha(readFileSync(join(STOCK, "lib/index.js")))) throw new Error("provenance.sha KHÔNG khớp stock");
  return out;
}

if (import.meta.main) {
  const rows = syncArtifacts();
  for (const row of rows) console.log(row.bytes + " B  delta " + String(row.delta) + "  " + row.sha.slice(0, 8) + "  " + row.file);
  console.log("OK " + String(rows.length) + " tệp · provenance sha khớp stock");
}