/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Chuẩn hoá id gói trong VĂN BẢN: quy MỌI id của ta (`@galaxy-blackhole/gbh-*`) về id gốc
 *      (`@deepseek-ai/dsh-*`) để so byte với bản gốc sau khi đã đổi tên trong lát ghép.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Thư mục gốc repo (tools/lib → lên hai cấp). */
const REPO_ROOT = join(import.meta.dir, "..", "..");

/**
 * Dựng bảng `id của ta → id gốc` cho mọi gói workspace.
 * Nhận: không.
 * Trả: các cặp [id ta, id gốc], xếp dài trước để thay thế không bị cắt ngắn.
 */
export function bangId(): Array<[string, string]> {
  const cap: Array<[string, string]> = [];
  for (const nhom of readdirSync(join(REPO_ROOT, "packages"))) {
    const thuMuc = join(REPO_ROOT, "packages", nhom);
    if (!statSync(thuMuc).isDirectory()) continue;
    for (const ten of readdirSync(thuMuc)) {
      const manifest = join(thuMuc, ten, "package.json");
      if (!existsSync(manifest)) continue;
      const duLieu = JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown };
      const tenTa = typeof duLieu.name === "string" ? duLieu.name : "";
      if (!tenTa.startsWith("@galaxy-blackhole/gbh-")) continue;
      cap.push([tenTa, "@deepseek-ai/dsh-" + tenTa.slice("@galaxy-blackhole/gbh-".length)]);
    }
  }
  return cap.sort((a, b) => b[0].length - a[0].length);
}

/**
 * Quy mọi id của ta trong văn bản về id gốc.
 * Nhận: text — văn bản cần chuẩn hoá.
 * Trả: văn bản đã quy id.
 */
export function chuanHoaId(text: string): string {
  let ket = text;
  for (const [ta, goc] of bangId()) ket = ket.split(ta).join(goc);
  // 05/11/2026: lát ghép có thể nhắc gói ta KHÔNG có trong workspace (bản gốc có, ta chưa port)
  // ⇒ quy theo quy ước tên để vẫn so được byte với bản gốc.
  return ket.split("@galaxy-blackhole/gbh-").join("@deepseek-ai/dsh-");
}


/**
 * Dựng bảng `id gốc → id của ta` theo `gbh.provenance.stock` (chính xác hơn quy ước tên).
 * Nhận: không.
 * Trả: các cặp [id gốc, id ta], dài trước để thay không bị cắt ngắn.
 */
export function bangGocDenTa(): Array<[string, string]> {
  const cap: Array<[string, string]> = [];
  for (const nhom of readdirSync(join(REPO_ROOT, "packages"))) {
    const thuMuc = join(REPO_ROOT, "packages", nhom);
    if (!statSync(thuMuc).isDirectory()) continue;
    for (const ten of readdirSync(thuMuc)) {
      const manifest = join(thuMuc, ten, "package.json");
      if (!existsSync(manifest)) continue;
      const duLieu = JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown; gbh?: { provenance?: { stock?: unknown } } };
      const tenTa = typeof duLieu.name === "string" ? duLieu.name : "";
      const goc = duLieu.gbh?.provenance?.stock;
      if (tenTa.startsWith("@galaxy-blackhole/gbh-") && typeof goc === "string" && goc.length > 0) {
        cap.push([goc, tenTa]);
      }
    }
  }
  return cap.sort((a, b) => b[0].length - a[0].length);
}

/**
 * Đổi mọi id gốc trong văn bản sang id CỦA TA (theo `provenance`, dự phòng theo quy ước tên).
 * Nhận: text — văn bản cần đổi.
 * Trả: văn bản đã đổi id.
 */
/** Ba gói kernel GIỮ id stock (ADR-0030: một thể hiện kernel) — KHÔNG được đổi sang id ta. */
const KERNEL_GIU_STOCK: readonly string[] = [
  "@deepseek-ai/cordis",
  "@deepseek-ai/schemastery",
  "@deepseek-ai/cosmokit",
];

export function denTa(text: string): string {
  let ket = text;
  for (const [goc, ta] of bangGocDenTa()) ket = ket.split(goc).join(ta);
  let xong = ket.split("@deepseek-ai/dsh-").join("@galaxy-blackhole/gbh-");
  // 06/11/2026: trả 3 id kernel về nguyên dạng (ADR-0030 — một thể hiện kernel duy nhất).
  for (const goc of KERNEL_GIU_STOCK) {
    xong = xong.split("@galaxy-blackhole/gbh-" + goc.slice("@deepseek-ai/".length)).join(goc);
  }
  return xong;
}


/**
 * Bốn module NỀN (seed) do vỏ SPA cấp dưới id GBH — đúng danh sách seed của client-modules.
 * Bối cảnh 08/11/2026: bundle client build ra vẫn require id STOCK của các seed này ⇒ tầng nạp báo
 * "not a platform seed word" và entry chết (màn Cài đặt → Mô hình). Bảng dưới là nguồn sự thật DUY NHẤT.
 */
export const SEED_MODULES: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ["@deepseek-ai/dsh-client-store", "@galaxy-blackhole/gbh-client-store"],
  ["@deepseek-ai/dsh-client-ui-slots", "@galaxy-blackhole/gbh-client-ui-slots"],
  ["@deepseek-ai/dsh-client-ui-primitives", "@galaxy-blackhole/gbh-client-ui-primitives"],
  ["@deepseek-ai/dsh-client-ui-dockkit", "@galaxy-blackhole/gbh-client-ui-dockkit"],
]);

/** Bản đồ id STOCK của seed → id GBH (chỉ 4 seed; KHÔNG đụng kernel seam cordis/schemastery/cosmokit). */
const STOCK_SEED_SANG_GBH: ReadonlyMap<string, string> = new Map(SEED_MODULES.map(([tu, den]) => [tu, den] as [string, string]));

/** Mẫu một specifier trong vị trí NẠP thật (require/import/import( ), không khớp câu văn trong comment. */
const SPECIFIER_NAP = /(\brequire\s*\(\s*|\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])((?:@deepseek-ai|@galaxy-blackhole)\/[^"']+)\2/gu;

/**
 * Đổi id STOCK của seed sang id GBH trong MỌI vị trí nạp của một artefact văn bản.
 * Nhận: text — nội dung artefact (bundle client vừa build).
 * Trả: { text, doi, giu } — văn bản đã đổi; danh sách id seed đã đổi; id stock KHÔNG có seed tương ứng
 *      (giữ nguyên, để Lead xử lý — ví dụ kernel seam).
 */
export function chuanHoaIdSeed(text: string): { text: string; doi: Array<{ id: string; thanh: string; soLan: number }>; giu: Array<{ id: string; soLan: number }> } {
  const dem = new Map<string, number>();
  const ket = text.replace(SPECIFIER_NAP, (khop: string, tienTo: string, quote: string, spec: string) => {
    const den = STOCK_SEED_SANG_GBH.get(spec);
    if (den !== undefined) {
      dem.set(spec, (dem.get(spec) ?? 0) + 1);
      return tienTo + quote + den + quote;
    }
    if (spec.startsWith("@deepseek-ai/")) dem.set(spec, (dem.get(spec) ?? 0) + 1);
    return khop;
  });
  const doi: Array<{ id: string; thanh: string; soLan: number }> = [];
  const giu: Array<{ id: string; soLan: number }> = [];
  for (const [id, soLan] of dem) {
    const den = STOCK_SEED_SANG_GBH.get(id);
    if (den !== undefined) doi.push({ id, thanh: den, soLan });
    else giu.push({ id, soLan });
  }
  return { text: ket, doi, giu };
}

/**
 * Áp bước hậu-build lên MỘT tệp artefact client: đổi id stock của seed → id GBH, tại chỗ.
 * Nhận: file — đường dẫn artefact; ghi — true thì ghi lại tệp (mặc định true).
 * Trả: { doi, giu } như chuanHoaIdSeed (rỗng khi tệp không có id stock).
 */
export async function chuanHoaIdSeedTrongTep(file: string, ghi = true): Promise<{ doi: Array<{ id: string; thanh: string; soLan: number }>; giu: Array<{ id: string; soLan: number }> }> {
  const goc = await Bun.file(file).text();
  const { text, doi, giu } = chuanHoaIdSeed(goc);
  if (ghi && text !== goc) await Bun.write(file, text);
  return { doi, giu };
}
