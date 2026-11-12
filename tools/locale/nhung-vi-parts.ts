/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Nhúng từ điển VI của gói DE-BUNDLE vào `src/parts` (chỗ duy nhất build đọc) rồi nối `vi` vào lời gọi
 *      `ctx.locale.register(NS, { zh, en })`. Nhờ vậy MỌI lần build lại đều tái lập bản dịch.
 *
 *      CÁCH DÙNG: bun run tools/locale/nhung-vi-parts.ts <tên-gói> [--write]
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO_ROOT = join(import.meta.dir, "..", "..");

/**
 * Lấy đối tượng bản dịch VI của gói từ src/locales-vi.ts.
 * Nhận: pkgDir — thư mục gói.
 * Trả: đối tượng khoá → chuỗi VI.
 */
async function docTuDien(pkgDir: string): Promise<Record<string, string>> {
  const f = join(pkgDir, "src", "locales-vi.ts");
  if (!existsSync(f)) return {};
  try {
    const mod = (await import(f)) as Record<string, unknown>;
    const ra: Record<string, string> = {};
    for (const v of Object.values(mod)) {
      if (v === null || typeof v !== "object") continue;
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (typeof x === "string") ra[k] = x;
      }
    }
    return ra;
  } catch {
    return {};
  }
}

/**
 * Nhúng từ điển vào gói và nối `vi` vào register.
 * Nhận: ten — tên gói; ghi — có ghi tệp không.
 * Trả: mô tả kết quả.
 */
async function xuLy(ten: string, ghi: boolean): Promise<string> {
  const pkgDir = join(REPO_ROOT, "packages", "client", ten);
  const dict = await docTuDien(pkgDir);
  const khoa = Object.keys(dict).length;
  if (khoa === 0) return ten + ': khong co locales-vi.ts';
  const partsDir = join(pkgDir, "src", "parts");
  if (!existsSync(partsDir)) return ten + ': khong phai goi de-bundle';
  let noiDict = '';
  let noiReg = '';
  for (const f of readdirSync(partsDir)) {
    if (!f.endsWith(".ts")) continue;
    const duong = join(partsDir, f);
    const than = readFileSync(duong, "utf8");
    if (noiDict === '' && than.includes("const en = {")) noiDict = duong;
    if (noiReg === '' && than.includes("locale.register(NS")) noiReg = duong;
  }
  if (noiDict === '' || noiReg === '') return ten + ': thieu part chua en/register';
  const tenBien = ten.replace(/-/gu, "_").toUpperCase() + "_VI";
  const json = JSON.stringify(dict);
  if (ghi) {
    const d = readFileSync(noiDict, "utf8");
    if (!d.includes(tenBien)) {
      const moc = d.indexOf("const en = {");
      const ket = d.indexOf("\n\t\t};", moc);
      const chen = "\n// >>> gbh-vi-locale (SINH TU DONG boi tools/locale/nhung-vi-parts.ts — khong sua tay)\n" +
        "\t\tconst " + tenBien + " = JSON.parse(" + JSON.stringify(json) + ");\n" +
        "// <<< gbh-vi-locale";
      writeFileSync(noiDict, d.slice(0, ket + 5) + chen + d.slice(ket + 5), "utf8");
    }
    const r = readFileSync(noiReg, "utf8");
    if (!r.includes("vi: " + tenBien)) {
      const moi = r.replace(/locale\.register\(NS,\s*\{[^}]*\}/u, (khop) =>
        khop.includes("vi:") ? khop : khop.replace(/\}\s*$/u, ", vi: " + tenBien + " }"),
      );
      writeFileSync(noiReg, moi, "utf8");
    }
  }
  return ten + ': ' + khoa + ' khoa · dict=' + (noiDict.split("/").pop() ?? "") + ' · reg=' + (noiReg.split("/").pop() ?? "");
}

/** Điểm vào CLI. */
async function main(): Promise<void> {
  const ghi = process.argv.includes("--write");
  const ds = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  for (const ten of ds) console.log(await xuLy(ten, ghi));
}

await main();
