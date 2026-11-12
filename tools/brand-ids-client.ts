/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Đổi ID DỮ LIỆU trong artefact client: mọi chuỗi `@deepseek-ai/dsh-…` có gói tương ứng của ta
 *      được thay bằng `@galaxy-blackhole/gbh-…`. Nhờ vậy trang Plugins (và mọi nơi đọc id module)
 *      hiển thị tên gói CỦA TA thay vì tên stock, đúng yêu cầu "1:1 nhưng mang thương hiệu GBH".
 *      Bản đồ sinh ra được ghi vào tests/helpers/brand-ids-map.json để test A/B quy ngược lại khi so byte.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..");
/** Thư mục artefact client. */
const CLIENT = join(REPO, "packages", "client");
/** Nơi ghi bản đồ để test A/B quy ngược. */
const BAN_DO = join(REPO, "tests", "helpers", "brand-ids-map.json");

/**
 * Dựng bản đồ tên stock → tên gói của ta từ manifest trong repo.
 * Nhận: không. Trả: bản đồ (chỉ gồm cặp có thật).
 */
export function docBanDo(): Record<string, string> {
  const ra: Record<string, string> = {};
  for (const tier of ["host", "client"]) {
    for (const ten of readdirSync(join(REPO, "packages", tier))) {
      let j: { name?: string; gbh?: { provenance?: { stock?: unknown }; row?: { aliases?: unknown } } };
      try {
        j = JSON.parse(readFileSync(join(REPO, "packages", tier, ten, "package.json"), "utf8")) as typeof j;
      } catch {
        continue;
      }
      const ta = j.name;
      if (typeof ta !== "string" || !ta.startsWith("@galaxy-blackhole/")) continue;
      const ds: string[] = [];
      const stock = j.gbh?.provenance?.stock;
      if (typeof stock === "string") ds.push(stock);
      const aliases = j.gbh?.row?.aliases;
      if (Array.isArray(aliases)) for (const a of aliases) if (typeof a === "string") ds.push(a);
      // 02/11/2026 — HẠ TẦNG KHÔNG THAM GIA BẢN ĐỒ ID: bảng module phía client chỉ biết các id NỀN
      // (@deepseek-ai/cordis, @deepseek-ai/schemastery…). Đổi chúng sang gbh-* làm bundle client
      // require id không có trong bảng ⇒ "missed the module table" ⇒ UI trắng (đo được: 0 slot).
      if (!/^@galaxy-blackhole\/gbh-(cordis|schemastery|cosmokit)/u.test(ta)) {
        for (const s of ds) if (s.startsWith("@deepseek-ai/")) ra[s] = ta;
      }
    }
  }
  return ra;
}

/**
 * Đổi id dữ liệu trong một artefact client.
 * Nhận: artifactPath — tệp lib/client.js; banDo — bản đồ stock → ta.
 * Trả: số lần thay.
 */
export function doiId(artifactPath: string, banDo: Record<string, string>): number {
  const truoc = readFileSync(artifactPath, "utf8");
  let sau = truoc;
  let n = 0;
  // Dài trước để không thay nhầm tiền tố của tên dài hơn.
  for (const stock of Object.keys(banDo).sort((a, b) => b.length - a.length)) {
    const ta = banDo[stock] as string;
    if (!sau.includes(stock)) continue;
    const soLan = sau.split(stock).length - 1;
    sau = sau.split(stock).join(ta);
    n += soLan;
  }
  if (n > 0) writeFileSync(artifactPath, sau);
  return n;
}

if (import.meta.main) {
  const banDo = docBanDo();
  writeFileSync(BAN_DO, JSON.stringify(banDo, null, 1) + "\n");
  let tong = 0;
  let goi = 0;
  for (const ten of readdirSync(CLIENT)) {
    const f = join(CLIENT, ten, "lib", "client.js");
    let soLan = 0;
    try {
      soLan = doiId(f, banDo);
    } catch {
      continue;
    }
    if (soLan > 0) {
      goi += 1;
      tong += soLan;
    }
  }
  console.log("da doi " + String(tong) + " id trong " + String(goi) + " artefact · ban do " + String(Object.keys(banDo).length) + " cap");
}
