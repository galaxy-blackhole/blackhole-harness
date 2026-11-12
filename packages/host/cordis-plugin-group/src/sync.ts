/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Script đồng bộ artefact NGUYÊN VĂN từ @deepseek-ai/cordis-plugin-group sang lib/ và xác minh từng byte.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Gốc repo (tệp nằm ở packages/host/cordis-plugin-group/src). */
const REPO = join(import.meta.dir, "..", "..", "..", "..");
/** Thư mục nguồn CHỈ ĐỌC của gói stock. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis-plugin-group");
/** Thư mục đích trong gói ta. */
const OURS = join(import.meta.dir, "..");

/** Danh sách tệp runtime phải chép nguyên văn. */
const FILES: readonly string[] = ["lib/index.js"];

/**
 * Tính sha256 của một tệp.
 * Nhận: path — đường dẫn tệp. Trả: chuỗi hex sha256.
 */
function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Chép NGUYÊN VĂN mọi tệp runtime từ stock sang lib/ rồi so lại từng byte.
 * Nhận: không. Trả: báo cáo { file, bytes, sha } cho từng tệp.
 */
export function syncArtifacts(): { readonly file: string; readonly bytes: number; readonly sha: string }[] {
  const out: { file: string; bytes: number; sha: string }[] = [];
  for (const rel of FILES) {
    const from = join(STOCK, rel);
    const to = join(OURS, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    const a = readFileSync(from);
    const b = readFileSync(to);
    if (!a.equals(b)) throw new Error("lệch byte sau khi chép: " + rel);
    out.push({ file: rel, bytes: b.length, sha: sha(to) });
  }
  return out;
}

if (import.meta.main) {
  for (const item of syncArtifacts()) console.log(item.bytes + " B  " + item.sha.slice(0, 8) + "  " + item.file);
}
