/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Nhúng từ điển VI vào THẲNG lời gọi `locale.register(NS, {...})` của artefact chuẩn:
 *      `locale.register(NS, { zh, en, vi: JSON.parse("...") })`. Không cần tìm khối `const en`, nên chạy
 *      được cho mọi gói de-bundle (build chỉ chép lib/).
 *
 *      CÁCH DÙNG: bun run tools/locale/nhung-vi-inline.ts [--write] [tên-gói ...]
 */

import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO_ROOT = join(import.meta.dir, "..", "..");
/** Thư mục gói client. */
const CLIENT = join(REPO_ROOT, "packages", "client");

/**
 * Lấy từ điển VI của gói.
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
    // Gộp thêm locale/vi-chrome.json (bản dịch bổ sung ngoài gen-vi.ts); tệp này THẮNG nếu trùng khoá.
    const boSung = join(pkgDir, "locale", "vi-chrome.json");
    if (existsSync(boSung)) {
      try {
        const extra = JSON.parse(readFileSync(boSung, "utf8")) as Record<string, string>;
        for (const [k, v] of Object.entries(extra)) if (typeof v === "string") ra[k] = v;
      } catch {
        // bỏ qua: tệp hỏng thì dùng bản từ locales-vi.ts
      }
    }
    return ra;
  } catch {
    return {};
  }
}

/**
 * Nhúng từ điển vào artefact của một gói (inline trong lời gọi register).
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
  let than = readFileSync(art, "utf8");
  const jsonMoi = JSON.stringify(JSON.stringify(dict));
  if (than.includes("vi: JSON.parse")) {
    // Đã nhúng trước đó ⇒ THAY bằng từ điển hiện tại (để bổ sung khoá mới mà không cần gỡ tay).
    const moi = than.replace(/vi: JSON\.parse\("((?:[^"\\]|\\.)*)"\)/u, () => "vi: JSON.parse(" + jsonMoi + ")");
    if (moi === than) return ten + ": da nhung (khong doi)";
    if (ghi) {
      copyFileSync(art, art + ".truoc-vi");
      writeFileSync(art, moi, "utf8");
    }
    return ten + ": " + khoa + " khoa · CAP NHAT" + (ghi ? " · DA GHI" : "");
  }
  const re = /locale\.register\(NS,\s*\{([^{}]*)\}/u;
  const khop = re.exec(than);
  if (khop === null) return ten + ': khong thay locale.register(NS, {...})';
  const ruot = (khop[1] ?? "").replace(/\s+/gu, " ").trim();
  const json = JSON.stringify(dict).replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
  than = than.replace(khop[0], "locale.register(NS, { " + ruot + ', vi: JSON.parse("' + json + '") }');
  if (ghi) {
    copyFileSync(art, art + ".truoc-vi");
    writeFileSync(art, than, "utf8");
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
