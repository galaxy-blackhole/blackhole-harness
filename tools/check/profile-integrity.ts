/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cổng TOÀN VẸN bản mount: mỗi đích literal trong `exports` của gói trong profile PHẢI trỏ tệp CÓ THẬT.
 *      Bắt lớp lỗi "copy mount thiếu tệp" (08/11/2026: 5 gói thiếu lib/index.js ⇒ 10 đích hỏng ⇒ plugin failed to
 *      import ⇒ 'N entries did not activate'), thứ mà cổng tĩnh trên repo KHÔNG thấy vì repo có đủ artefact.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Thư mục profile mặc định của app (có thể ghi đè bằng tham số dòng lệnh). */
const PROFILE_MAC_DINH = join(process.env.HOME ?? "", ".galaxy", "blackhole", "profiles", "node_modules");

/** Một đích exports không tồn tại trong bản mount. */
interface DichHong {
  /** Tên gói trong profile, ví dụ "gbh-command-feedback". */
  goi: string;
  /** Khoá exports, ví dụ "." hoặc "./types". */
  khoa: string;
  /** Đích tương đối đang thiếu. */
  dich: string;
}

/**
 * Liệt kê đích literal (bỏ glob chứa "*") của một giá trị exports.
 * Nhận: giá trị exports. Trả: các đích tương đối bắt đầu bằng "./".
 * @param giaTri - giá trị exports của một khoá hoặc cả trường exports.
 * @returns danh sách đích cần kiểm tồn tại.
 */
function dichLiteral(giaTri: unknown, laDieuKienTypes = false): string[] {
  if (laDieuKienTypes) return []; // điều kiện "types" là tầng KIỂU, runtime không cần
  if (typeof giaTri === "string") {
    if (giaTri.includes("*") || !giaTri.startsWith("./") || /\.d\.ts$/.test(giaTri)) return [];
    return [giaTri];
  }
  if (Array.isArray(giaTri)) return giaTri.flatMap((v) => dichLiteral(v));
  if (giaTri && typeof giaTri === "object") {
    const out: string[] = [];
    for (const [khoa, v] of Object.entries(giaTri as Record<string, unknown>)) out.push(...dichLiteral(v, khoa === "types"));
    return out;
  }
  return [];
}

/**
 * Kiểm toàn vẹn một gốc node_modules kiểu profile.
 * Nhận: gốc chứa các gói @galaxy-blackhole. Trả: số gói, số đích đã kiểm, danh sách đích hỏng và danh sách gói có lib/ rỗng.
 * @param goc - thư mục node_modules của profile.
 * @returns bộ ba (soGoi, soDich, danhSachHong).
 */
export function kiemToanVen(goc: string): { soGoi: number; soDich: number; hong: DichHong[]; libRong: string[] } {
  const hong: DichHong[] = [];
  const libRong: string[] = [];
  let soGoi = 0;
  let soDich = 0;
  const gocGbh = join(goc, "@galaxy-blackhole");
  if (!existsSync(gocGbh)) return { soGoi, soDich, hong, libRong };
  for (const ten of readdirSync(gocGbh).sort()) {
    const dir = join(gocGbh, ten);
    const p = join(dir, "package.json");
    if (!existsSync(p)) continue;
    soGoi++;
    const j = JSON.parse(readFileSync(p, "utf8")) as { exports?: Record<string, unknown> };
    const cacDich: string[] = [];
    for (const [khoa, giaTri] of Object.entries(j.exports ?? {})) {
      if (khoa.includes("*")) continue;
      for (const dich of dichLiteral(giaTri)) {
        soDich++;
        cacDich.push(dich);
        if (!existsSync(join(dir, dich))) hong.push({ goi: ten, khoa, dich });
      }
    }
    // Bước copy mount từng mang package.json + locale + .gbh-build-stamp mà BỎ phần artefact lib/ ⇒ lib chỉ còn
    // stamp (dev-denta đo 08/11/2026). Kiểm riêng để báo ĐÚNG nguyên nhân thay vì chỉ báo "thiếu đích".
    const coArtefactLib = cacDich.some((d) => d.startsWith("./lib/"));
    if (coArtefactLib) {
      const dirLib = join(dir, "lib");
      const conLai = existsSync(dirLib) ? readdirSync(dirLib).filter((f) => f !== ".gbh-build-stamp") : [];
      if (conLai.length === 0) libRong.push(ten);
    }
  }
  return { soGoi, soDich, hong, libRong };
}

/**
 * Chạy cổng và in kết quả; trả mã thoát (0 đạt, 1 có đích hỏng).
 * Nhận: tham số dòng lệnh tuỳ chọn — đường dẫn node_modules của profile. Trả: mã thoát.
 * @param argv - tham số dòng lệnh (phần tử đầu là gốc profile, nếu có).
 * @returns 0 khi mọi đích exports trong profile đều tồn tại.
 */
export function runCli(argv: readonly string[] = []): number {
  const goc = argv[0] ?? PROFILE_MAC_DINH;
  if (!existsSync(goc)) {
    console.log("INFO profile-integrity · không thấy " + goc + " ⇒ bỏ qua (chưa mount)");
    return 0;
  }
  const { soGoi, soDich, hong, libRong } = kiemToanVen(goc);
  for (const ten of libRong) console.log("FAIL " + ten + "  lib/ RỖNG (chỉ có .gbh-build-stamp ⇒ bước copy bỏ artefact)");
  if (hong.length === 0 && libRong.length === 0) {
    console.log("OK   profile-integrity · " + soGoi + " gói · " + soDich + " đích literal · 0 hỏng");
    return 0;
  }
  for (const h of hong) console.log("FAIL " + h.goi + "  " + h.khoa + " -> " + h.dich);
  const soGoiHong = new Set([...hong.map((h) => h.goi), ...libRong]).size;
  console.log("[FAIL profile-integrity · " + soGoi + " gói · " + soDich + " đích · HỎNG " + hong.length + " / " + soGoiHong + " gói · lib rỗng " + libRong.length + " — copy mount lại toàn bộ lib/**]");
  return 1;
}

if (import.meta.main) process.exit(runCli(process.argv.slice(2)));
