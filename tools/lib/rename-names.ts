/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 03/11/2026
 * desc Chuẩn hoá tên gói CỦA TA về tên GỐC để so byte sau khi đổi tên (P1b). Dùng cho build.ts và test.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Bản đồ tên gói CỦA TA → tên gốc (dựng một lần, có cache). */
let cache: Map<string, string> | undefined;

/**
 * Dựng bảng tên của ta → tên gốc từ `gbh.provenance.stock` của mọi manifest.
 * @param repo gốc repo (mặc định: hai cấp trên thư mục chứa tệp này).
 * @returns bảng ánh xạ.
 */
/** Nam ID AO do vo SPA cap (khong phai goi npm): ten cua ta -> ten goc. */
export const VIRTUAL_IDS: ReadonlyArray<readonly [string, string]> = [
  ['@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-store'],
  ['@galaxy-blackhole/gbh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-primitives'],
  ['@galaxy-blackhole/gbh-client-ui-slots', '@deepseek-ai/dsh-client-ui-slots'],
  ['@galaxy-blackhole/gbh-client-ui-dockkit', '@deepseek-ai/dsh-client-ui-dockkit'],
  ['@deepseek-ai/dsh-typert-generator', '@deepseek-ai/dsh-typert-generator'],
];

export function ourToStockNames(repo?: string): Map<string, string> {
  if (cache !== undefined) return cache;
  const root = repo ?? join(import.meta.dir, "..", "..");
  const out = new Map<string, string>(VIRTUAL_IDS);
  for (const tier of ["host", "client", "tools"]) {
    const dir = join(root, "packages", tier);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const manifest = join(dir, name, "package.json");
      if (!existsSync(manifest)) continue;
      const parsed = JSON.parse(readFileSync(manifest, "utf8")) as {
        name?: string;
        gbh?: { provenance?: { stock?: string } };
      };
      const stock = parsed.gbh?.provenance?.stock;
      if (typeof stock === "string" && typeof parsed.name === "string") out.set(parsed.name, stock);
    }
  }
  cache = out;
  return out;
}

/**
 * Quy NGƯỢC mọi tên gói của ta trong một chuỗi về tên gốc.
 * Vì sao: artefact của ta chứa `@galaxy-blackhole/gbh-*`, bản gốc chứa `@deepseek-ai/*`; so byte trần
 * sẽ lệch ở đúng những chỗ bản đồ đổi tên chỉ ra. Chuẩn hoá cả hai vế giữ được bất biến mạnh.
 * @param text nội dung cần chuẩn hoá.
 * @param repo gốc repo (tuỳ chọn).
 * @returns nội dung đã quy ngược tên gói.
 */
export function normalizePackageNames(text: string, repo?: string): string {
  const map = ourToStockNames(repo);
  const names = [...map.keys()].sort((a, b) => b.length - a.length);
  let out = text;
  for (const ours of names) {
    const stock = map.get(ours);
    if (stock === undefined) continue;
    out = out.split(ours).join(stock);
  }
  return out;
}