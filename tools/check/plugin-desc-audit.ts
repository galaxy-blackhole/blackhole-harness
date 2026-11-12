/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Kiểm toán mô tả plugin: gói nào đã có bản tiếng Việt (locale/vi.json hoặc bảng PLUGIN_DESCRIPTIONS),
 *      còn gói nào thiếu, và gói nào còn chuỗi thương hiệu cũ (DeepSeek/DSH).
 */
/**
 * Tập tên gói ĐÃ CÓ bản dịch tiếng Việt trong bảng PLUGIN_DESCRIPTIONS (nguồn thứ hai, hợp luật 000e).
 * Nhận: không. Trả: tập tên gói (rỗng khi chưa có bảng).
 */
function docBangMoTa(): Set<string> {
  const ra = new Set<string>();
  const goc = join(REPO, "packages", "client", "ui-plugin-manager", "src");
  for (const ten of ["plugin-descriptions.ts", "plugin-descriptions-a.ts", "plugin-descriptions-b.ts"]) {
    let text: string;
    try {
      text = readFileSync(join(goc, ten), "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(/^  "(@galaxy-blackhole\/[^"]+)": \{/gmu)) ra.add(m[1] as string);
  }
  return ra;
}

/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Kiểm toán mô tả plugin (task-197): in bảng gói · có bản dịch tiếng Việt chưa · còn chuỗi DeepSeek/DSH không.
 *      Chạy: bun run tools/check/plugin-desc-audit.ts [--json]
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/** Tập gói ĐÃ CÓ bản dịch tiếng Việt trong bảng PLUGIN_DESCRIPTIONS (nguồn thứ hai, hợp luật 000e). */
const BANG_VI = docBangMoTa();

/** Một dòng kiểm toán cho một gói. */
interface DongKiemToan {
  /** Tên package đầy đủ. */
  readonly goi: string;
  /** Có `gbh.row` (đã flip) hay không. */
  readonly coRow: boolean;
  /** Có mô tả tiếng Việt trong `locale/vi.json` hay không. */
  readonly coVi: boolean;
  /** Mô tả tiếng Anh hiện tại (rỗng nếu không có). */
  readonly en: string;
  /** Mô tả tiếng Việt hiện tại (rỗng nếu không có). */
  readonly vi: string;
}

/**
 * Đọc `meta.description` từ một tệp locale.
 * Nhận: đường dẫn tệp JSON (có thể không tồn tại). Trả: mô tả hoặc chuỗi rỗng.
 */
function docMetaDescription(duongDan: string): string {
  if (!existsSync(duongDan)) return "";
  try {
    const parsed = JSON.parse(readFileSync(duongDan, "utf8")) as { meta?: { description?: unknown } };
    return typeof parsed.meta?.description === "string" ? parsed.meta.description : "";
  } catch {
    return "";
  }
}

/**
 * Liệt kê mọi gói trong `packages/{host,client}` có `gbh.row` hoặc có `description`.
 * Trả: danh sách dòng kiểm toán, sắp theo tên gói.
 */
function kiemToan(): DongKiemToan[] {
  const ra: DongKiemToan[] = [];
  for (const nhom of ["host", "client"]) {
    const goc = join(REPO, "packages", nhom);
    if (!existsSync(goc)) continue;
    for (const ten of readdirSync(goc)) {
      const thuMuc = join(goc, ten);
      const manifest = join(thuMuc, "package.json");
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string; description?: string; gbh?: { row?: unknown } };
      const coRow = pkg.gbh?.row !== undefined;
      const en = docMetaDescription(join(thuMuc, "locale", "en.json"));
      const vi = docMetaDescription(join(thuMuc, "locale", "vi.json"));
      // 21/10/2026 (Lead + tm-client-ui-a): luat 000e cam ship locale/ khi stock KHONG co locale, nen ban dich
      // tieng Viet cua nhieu goi chi con trong bang PLUGIN_DESCRIPTIONS. Dem them nguon thu hai nay de chi so
      // "da co ban vi" phan anh DUNG cong dich, khong bao thieu gia.
      const trongBang = BANG_VI.has(pkg.name ?? "");
      ra.push({ goi: pkg.name ?? nhom + "/" + ten, coRow, coVi: vi !== "" || trongBang, en, vi });
    }
  }
  return ra.sort((a, b) => a.goi.localeCompare(b.goi));
}

/**
 * Điểm vào: in bảng kiểm toán + tổng kết.
 * Trả: không.
 */
function main(): void {
  const dong = kiemToan();
  const coVi = dong.filter((d) => d.coVi).length;
  const thieu = dong.filter((d) => !d.coVi).map((d) => d.goi);
  // 21/10/2026 (Lead): tach hai loai chuoi —
  //   'DeepSeek' một mình là NHÀ CUNG CẤP AI (hợp lệ: app ta gọi API DeepSeek), còn
  //   'DeepSeek Harness' / 'DSH' viết hoa đứng riêng mới là THƯƠNG HIỆU HARNESS cũ (phải bằng 0 trong UI của ta).
  const chuoiHarness = /DeepSeek Harness|(^|[^A-Za-z0-9_])DSH([^A-Za-z0-9_]|$)/mu;
  const conDeepSeek = dong.filter((d) => chuoiHarness.test(d.en) || chuoiHarness.test(d.vi)).length;
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ tong: dong.length, coVi, thieu, conDeepSeek }, null, 2));
    return;
  }
  console.log("=== KIỂM TOÁN MÔ TẢ PLUGIN (task-197) ===");
  console.log("Tổng số gói      : " + String(dong.length));
  console.log("Đã có bản vi     : " + String(coVi));
  console.log("Còn thiếu vi     : " + String(thieu.length));
  console.log("Chuỗi thương hiệu harness cũ (DeepSeek Harness/DSH): " + String(conDeepSeek));
  if (thieu.length > 0) {
    console.log("--- 40 gói thiếu đầu tiên ---");
    for (const ten of thieu.slice(0, 40)) console.log("  " + ten);
  }
}

main();
