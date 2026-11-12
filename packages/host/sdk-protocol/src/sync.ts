/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Script đồng bộ artefact NGUYÊN VĂN từ gói STOCK @deepseek-ai/dsh-sdk-protocol (index + lib/types/*.js + locale/**)
 *      sang lib/, in bytes/delta/equal/sha và đối chiếu provenance.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..", "..");
/** Nguồn stock CHỈ ĐỌC. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-sdk-protocol");
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

/** Bản đồ id stock → gói GBH (R6a — PHASE B, 08/11/2026). CHỈ áp cho tệp khai kiểu .d.ts (lib/index.js giữ byte); phần còn lại giữ BYTE. */
const ID_MAP: readonly (readonly [string, string])[] = [
  ["@deepseek-ai/dsh-subagent", "@galaxy-blackhole/gbh-subagent"],
];

/** Áp bản đồ id lên văn bản (denTa) — đảo ngược được để vẫn so được với stock.
 *  Nhận: text — nội dung tệp. Trả: văn bản đã đổi id theo ID_MAP. */
function denTa(text: string): string {
  let out = text;
  for (const [stock, ours] of ID_MAP) out = out.split(stock).join(ours);
  return out;
}

/** Đảo bản đồ id: văn bản của TA → dạng stock (để phép so byte vẫn bắt mọi khác biệt KHÁC id).
 *  Nhận: text — nội dung đã denTa. Trả: văn bản quy về id stock. */
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
    // R6a (PHASE B): chỉ tệp khai kiểu được denTa; so BYTE sau khi quy id về stock ⇒ khác biệt KHÁC id vẫn lộ.
    const stockBytes = readFileSync(from);
    const stockText = stockBytes.toString("utf8");
    const target = rel.endsWith(".d.ts") ? denTa(stockText) : stockText;
    if (target !== stockText) writeFileSync(to, target, "utf8");
    const b = readFileSync(to);
    if (target !== stockText) {
      if (nguocDenTa(b.toString("utf8")) !== stockText) throw new Error("lệch byte sau denTa: " + rel);
    } else if (!stockBytes.equals(b)) throw new Error("lệch byte sau khi chép: " + rel);
    out.push({ file: rel, bytes: b.length, delta: b.length - stockBytes.length, equal: true, sha: sha(b) });
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
