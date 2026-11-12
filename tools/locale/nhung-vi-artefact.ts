/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Nhúng từ điển VI vào ARTEFACT CHUẨN (lib/client.js) của gói de-bundle (build chỉ CHÉP lib, không
 *      dựng lại từ src/parts). Thêm `const <TEN>_VI = JSON.parse(...)` ngay sau khối `const en = {` và nối
 *      `vi` vào lời gọi `locale.register(NS, {...})`.
 *
 *      CÁCH DÙNG:
 *        bun run tools/locale/nhung-vi-artefact.ts            # chỉ BÁO CÁO
 *        bun run tools/locale/nhung-vi-artefact.ts --write    # ghi
 */

import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO_ROOT = join(import.meta.dir, "..", "..");
/** Thư mục gói client. */
const CLIENT = join(REPO_ROOT, "packages", "client");

/**
 * Lấy từ điển VI của gói từ src/locales-vi.ts.
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
 * Nhúng từ điển vào artefact của một gói.
 * Nhận: ten — tên gói; ghi — có ghi tệp không.
 * Trả: mô tả kết quả.
 */
async function xuLy(ten: string, ghi: boolean): Promise<string> {
  const pkgDir = join(CLIENT, ten);
  const art = join(pkgDir, "lib", "client.js");
  if (!existsSync(art)) return ten + ': khong co artefact';
  const dict = await docTuDien(pkgDir);
  const khoa = Object.keys(dict).length;
  if (khoa === 0) return ten + ': khong co locales-vi.ts';
  const than = readFileSync(art, "utf8");
  const tenBien = ten.replace(/-/gu, "_").toUpperCase() + "_VI";
  if (than.includes(tenBien)) return ten + ': da co roi';
  const moc = than.indexOf("const en = {");
  if (moc < 0) return ten + ': khong thay khoi en';
  const ket = than.indexOf("\n\t\t};", moc);
  if (ket < 0) return ten + ': khong thay cuoi khoi en';
  const json = JSON.stringify(dict);
  const chen = "\n\t\t// >>> gbh-vi-locale (SINH TU DONG boi tools/locale/nhung-vi-artefact.ts)\n" +
    "\t\tconst " + tenBien + " = JSON.parse(" + JSON.stringify(json) + ");\n" +
    "\t\t// <<< gbh-vi-locale";
  let moi = than.slice(0, ket + 5) + chen + than.slice(ket + 5);
  const regCu = /locale\.register\(NS,\s*\{([^}]*)\}/u.exec(moi);
  if (regCu === null) return ten + ': khong thay locale.register';
  const ruot = regCu[1] ?? "";
  if (ruot.includes("vi:")) return ten + ': register da co vi';
  moi = moi.replace(regCu[0], "locale.register(NS, {" + ruot.replace(/\s*$/u, "") + ", vi: " + tenBien + " }");
  if (ghi) {
    copyFileSync(art, art + ".truoc-vi");
    writeFileSync(art, moi, "utf8");
  }
  return ten + ': ' + khoa + ' khoa' + (ghi ? ' · DA GHI' : ' · (chua ghi)');
}

/** Điểm vào CLI. */
async function main(): Promise<void> {
  const ghi = process.argv.includes("--write");
  const chi = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const ds = chi.length > 0 ? chi : readdirSync(CLIENT).filter((t) => existsSync(join(CLIENT, t, "src", "locales-vi.ts")));
  for (const ten of ds) console.log(await xuLy(ten, ghi));
}

await main();
