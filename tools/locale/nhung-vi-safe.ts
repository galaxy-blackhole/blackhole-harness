/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Nhúng từ điển VI vào artefact — CHỈ thay đúng chuỗi `locale.register(NS, { zh, en })`
 *      (không dùng regex lồng), KIỂM CÚ PHÁP ngay sau khi ghi, lỗi thì TỰ HOÀN NGUYÊN.
 *
 *      CÁCH DÙNG: bun run tools/locale/nhung-vi-safe.ts [--write]
 */

import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO_ROOT = join(import.meta.dir, "..", "..");
/** Thư mục gói client. */
const CLIENT = join(REPO_ROOT, "packages", "client");
/** Chuỗi đăng ký từ điển ĐÚNG như bản gốc. */
const MAU = "locale.register(NS, { zh, en })";

/**
 * Đọc từ điển VI của gói (gộp locales-vi.ts và locale/vi-chrome.json).
 * Nhận: pkgDir — thư mục gói.
 * Trả: đối tượng khoá → chuỗi VI.
 */
async function docTuDien(pkgDir: string): Promise<Record<string, string>> {
  const ra: Record<string, string> = {};
  const ts = join(pkgDir, "src", "locales-vi.ts");
  if (existsSync(ts)) {
    try {
      const mod = (await import(ts)) as Record<string, unknown>;
      for (const v of Object.values(mod)) {
        if (v === null || typeof v !== "object") continue;
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
          if (typeof x === "string") ra[k] = x;
        }
      }
    } catch {
      // bỏ qua
    }
  }
  const json = join(pkgDir, "locale", "vi-chrome.json");
  if (existsSync(json)) {
    try {
      const d = JSON.parse(readFileSync(json, "utf8")) as Record<string, string>;
      for (const [k, v] of Object.entries(d)) if (typeof v === "string") ra[k] = v;
    } catch {
      // bỏ qua
    }
  }
  return ra;
}

/**
 * Xử lý một gói.
 * Nhận: ten — tên gói; ghi — có ghi tệp không.
 * Trả: mô tả kết quả.
 */
async function xuLy(ten: string, ghi: boolean): Promise<string> {
  const pkgDir = join(CLIENT, ten);
  const art = join(pkgDir, "lib", "client.js");
  if (!existsSync(art)) return ten + ': khong co artefact';
  const dict = await docTuDien(pkgDir);
  const khoa = Object.keys(dict).length;
  if (khoa === 0) return ten + ': khong co tu dien';
  const than = readFileSync(art, "utf8");
  if (!than.includes(MAU)) return ten + ': khong dung khuon ' + MAU;
  const json = JSON.stringify(JSON.stringify(dict));
  const moi = than.replace(MAU, "locale.register(NS, { zh, en, vi: JSON.parse(" + json + ") })");
  try {
    new Function(moi.replace(/^\s*export /gmu, ""));
  } catch (e) {
    return ten + ': BO QUA (sua se sai cu phap: ' + String(e).slice(0, 60) + ')';
  }
  if (ghi) {
    copyFileSync(art, art + ".truoc-vi");
    writeFileSync(art, moi, "utf8");
  }
  return ten + ': ' + khoa + ' khoa' + (ghi ? ' · DA GHI' : ' · (chua ghi)');
}

/** Điểm vào CLI. */
async function main(): Promise<void> {
  const ghi = process.argv.includes("--write");
  const ds = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const danhSach = ds.length > 0 ? ds : readdirSync(CLIENT).filter((t) => existsSync(join(CLIENT, t, "package.json")));
  for (const ten of danhSach) console.log(await xuLy(ten, ghi));
}

await main();

export {};
