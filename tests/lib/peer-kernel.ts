/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 02/11/2026
 * desc Quy đổi tên peer GBH về tên gói gốc DSH để tra kernel — dùng chung cho các cổng quy ước peer.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/**
 * Dựng bản đồ tên gói GBH sang tên gói gốc DSH từ `gbh.provenance.stock` của mọi package.
 * Nhận: không. Trả: bản đồ (chỉ gồm cặp có thật).
 */
export function gbhToStockMap(): Record<string, string> {
  const ra: Record<string, string> = {};
  for (const tier of ["host", "client", "tools"]) {
    const dir = join(REPO, "packages", tier);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name, "package.json");
      if (!existsSync(p)) continue;
      const j = JSON.parse(readFileSync(p, "utf8")) as { name?: string; gbh?: { provenance?: { stock?: unknown } } };
      const stock = j.gbh?.provenance?.stock;
      if (typeof j.name === "string" && typeof stock === "string") ra[j.name] = stock;
    }
  }
  return ra;
}

/**
 * Đổi MỘT tên peer của ta về tên gói gốc tương ứng để tra trong kernel.
 * Nhận: peer — tên peer (có thể đã là tên GBH hoặc tên stock). Trả: tên stock, hoặc nguyên bản nếu không có cặp.
 */
export function stockNameOf(peer: string): string {
  return gbhToStockMap()[peer] ?? peer;
}
