/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc BRAND RENAME dùng chung (task-146): đổi tên định danh DSH → GBH Ở BUILD TIME cho CẢ producer + consumer.
 *      Có hàm NGƯỢC để chứng minh chỉ đổi tên, không đổi logic (cổng replaceAll ngược).
 */

/**
 * Một cặp đổi tên. `from` phải là chuỗi DUY NHẤT xuất hiện trong artefact; `to` là tên mới.
 * Vì sao dùng cặp tường minh thay vì regex: cổng ngược phải khôi phục được CHÍNH XÁC byte gốc.
 */
export interface BrandRename {
  /** Chuỗi gốc (DSH). */
  readonly from: string;
  /** Chuỗi đích (GBH). */
  readonly to: string;
}

/**
 * Bản đồ đổi tên chuẩn của dự án: mọi định danh toàn cục + token CSS mang tên DSH.
 * Thứ tự QUAN TRỌNG: `__GBH_` đứng trước để phủ hết `__GBH_*__`, sau đó token CSS.
 */
export const BRAND_RENAMES: readonly BrandRename[] = Object.freeze([
  // 20/10/2026 — SỬA HỒI QUY: lô đổi tên brand toàn cục đã đổi NHẦM `from` của cặp này thành `__GBH_`
  // (map thành identity ⇒ mọi cổng byte parity đỏ). `from` PHẢI là token GỐC của DSH.
  { from: "__DSH_", to: "__GBH_" },
  // 19/10/2026 (nhánh B, task-157): TOKEN CSS `--dsh-*` → `--gbh-*` (533 lần trong 81 gói + khai trong dist).
  // VÁCH NGĂN: chỉ đổi TIỀN TỐ TOKEN `--dsh-`; KHÔNG đụng route/field/key/scheme `dsh-resource://` (không có `--`).
  { from: "--dsh-", to: "--gbh-" },
]);

/**
 * Đổi tên xuôi (DSH → GBH) trên một văn bản.
 * Nhận: text — văn bản gốc; renames — bản đồ (mặc định BRAND_RENAMES).
 * Trả: văn bản đã đổi tên.
 */
export function applyBrandRename(text: string, renames: readonly BrandRename[] = BRAND_RENAMES): string {
  let out = text;
  for (const rename of renames) out = out.split(rename.from).join(rename.to);
  return out;
}

/**
 * Đổi tên NGƯỢC (GBH → DSH) — cổng chứng minh 'chỉ đổi tên': reverse(apply(x)) phải === x.
 * Nhận: text — văn bản đã đổi tên; renames — bản đồ (mặc định BRAND_RENAMES).
 * Trả: văn bản khôi phục.
 */
export function reverseBrandRename(text: string, renames: readonly BrandRename[] = BRAND_RENAMES): string {
  let out = text;
  // Đảo thứ tự để cặp dài/ngắn không giẫm chân nhau.
  for (const rename of [...renames].reverse()) out = out.split(rename.to).join(rename.from);
  return out;
}

/**
 * Đếm số lần mỗi cặp đổi tên xuất hiện (dùng cho log + test khẳng định có đổi thật).
 * Nhận: text — văn bản gốc; renames — bản đồ. Trả: mảng { from, count }.
 */
export function countBrandRenames(text: string, renames: readonly BrandRename[] = BRAND_RENAMES): { from: string; count: number }[] {
  return renames.map((rename) => ({ from: rename.from, count: text.split(rename.from).length - 1 }));
}

/**
 * Cổng: khẳng định artefact sau đổi tên chỉ KHÁC bản gốc ở phần tên.
 * Nhận: goc — văn bản trước đổi tên (thường là bundle stock byte-identical); daDoiTen — văn bản sau đổi tên.
 * Trả: không (ném khi vi phạm).
 */
export function assertRenameOnly(goc: string, daDoiTen: string, skip: readonly string[] = []): void {
  const khoiPhuc = reverseBrandRename(daDoiTen);
  if (khoiPhuc !== goc) throw new Error("brand-rename: dao nguoc KHONG khop ban goc ⇒ da doi CA logic, khong chi doi ten");
  if (daDoiTen === goc) return;
  // 20/10/2026 — SAU lô đổi tên toàn cục, artefact của ta PHẢI sạch token DSH: cái còn sót cần chặn là
  // `__DSH_` (trước đây kiểm ngược `__GBH_`, đúng ở giai đoạn đang rename dở). 4 tên vỏ dist trong `skip`
  // được phép giữ nguyên nên trừ chúng ra trước khi kiểm.
  let conLai = daDoiTen;
  for (const ten of skip) conLai = conLai.split(ten).join("");
  if (conLai.includes("__DSH_")) throw new Error("brand-rename: con sot __DSH_ trong artefact da doi ten");
}

/**
 * 4 định danh đang được VỎ SPA DIST (gói stock dist-only) đọc — TUYỆT ĐỐI chưa rename ở bước (a)/(b).
 * Đo 19/10/2026 trên `dsh-web-frontend/dist/assets/index-CN7NIWNw.js`: `__GBH_BOOT__` ×1 · `__GBH_BOOT_READY__` ×2 ·
 * `__GBH_TRANSPORT__` ×2 · `__GBH_CODE_ICON_INSTANCE__` ×31. Rename sớm một phía ⇒ mất HMR/transport ⇒ trắng trang.
 * Bước (c) sẽ rename ĐỒNG THỜI dist + READY_MARKUP + 3 gói transport rồi xoá danh sách này.
 */
export const DIST_READ_NAMES: readonly string[] = Object.freeze([
  "__GBH_BOOT__",
  "__GBH_BOOT_READY__",
  "__GBH_TRANSPORT__",
  "__GBH_CODE_ICON_INSTANCE__",
]);

/**
 * Đổi tên AN TOÀN cho bước (a)/(b): giữ nguyên 4 tên `DIST_READ_NAMES` bằng cách che tạm trước khi thay.
 * Nhận: text — văn bản gốc; renames — bản đồ; skip — danh sách tên phải giữ (mặc định DIST_READ_NAMES).
 * Trả: văn bản đã đổi tên, 4 tên trong `skip` còn nguyên.
 */
export function applyBrandRenameSafe(
  text: string,
  renames: readonly BrandRename[] = BRAND_RENAMES,
  skip: readonly string[] = DIST_READ_NAMES,
): string {
  // Che bằng placeholder không thể trùng nội dung artefact, thay tên, rồi khôi phục.
  const daChe: string[] = [];
  let tam = text;
  skip.forEach((ten, chiSo) => {
    const mau = "\u0000BRAND_SKIP_" + String(chiSo) + "\u0000";
    daChe.push(ten);
    tam = tam.split(ten).join(mau);
  });
  const daDoi = applyBrandRename(tam, renames);
  return daDoi.replace(/\u0000BRAND_SKIP_(\d+)\u0000/gu, (_khop, chiSo: string) => daChe[Number(chiSo)] ?? "");
}

/** Bước hậu-build dùng chung: đổi id seed của vỏ SPA (stock → GBH) trong artefact (P2 08/11/2026). */
import { chuanHoaIdSeed } from "../../../../tools/lib/id-normalize.ts";

/**
 * Đổi tên TẠI CHỖ một artefact client vừa build xong (bước b của task-146).
 * Cổng bắt buộc: đảo ngược phải khớp CHÍNH XÁC bản trước khi đổi ⇒ chứng minh chỉ đổi tên.
 * Nhận: file — đường dẫn artefact; skip — danh sách tên phải giữ (mặc định DIST_READ_NAMES).
 * Trả: số lần đã đổi (0 khi artefact vốn không có tên DSH nào).
 */
export async function renameClientArtifact(
  file: string,
  skip: readonly string[] = DIST_READ_NAMES,
): Promise<number> {
  const goc = await Bun.file(file).text();
  const daDoiTen = applyBrandRenameSafe(goc, BRAND_RENAMES, skip);
  if (daDoiTen !== goc) assertRenameOnly(goc, daDoiTen, skip);
  // 08/11/2026 (P2): hậu-build đổi id STOCK của MODULE NỀN (seed) sang id GBH — vỏ SPA chỉ seed id GBH,
  // bundle require id stock sẽ chết với "not a platform seed word". Không đụng kernel seam (cordis…).
  const { text: daChuanHoa } = chuanHoaIdSeed(daDoiTen);
  if (daChuanHoa === goc) return 0;
  await Bun.write(file, daChuanHoa);
  return countBrandRenames(goc).reduce((tong, muc) => tong + muc.count, 0);
}