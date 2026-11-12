/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cổng TÁCH MODULE-INSTANCE: đếm gói nào import id STOCK và gói nào import id GBH của cùng một seam
 *      kernel mang Symbol (mặc định @deepseek-ai/dsh-scope ↔ @galaxy-blackhole/gbh-scope). Hai bản copy 1:1 vẫn là
 *      hai MODULE INSTANCE ⇒ Symbol("dsh.scope") khác nhau ⇒ scopeOf(ctx) = undefined. P0 08/11/2026:
 *      "Agent preset binding requires a scoped context" ⇒ session/create ok:false ⇒ không có agent/lượt.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo, suy từ vị trí tệp (tools/check → ../..). */
const REPO_ROOT = join(import.meta.dir, "..", "..");
/** Cặp id STOCK ↔ GBH của seam mặc định (đổi được bằng tham số dòng lệnh). */
const CAP_MAC_DINH: readonly [string, string] = ["@deepseek-ai/dsh-scope", "@galaxy-blackhole/gbh-scope"];

/** Kết quả đếm cho một gói. */
interface DemGoi {
  /** Tên gói hoặc đường dẫn tương đối. */
  goi: string;
  /** Số lần IMPORT id STOCK. */
  stock: number;
  /** Số lần IMPORT id GBH. */
  gbh: number;
}

/**
 * Đếm số IMPORT thật của một cặp id trong một tệp artefact.
 * Nhận: đường dẫn tệp + cặp id. Trả: hai con số đếm (0/0 khi tệp không import id nào).
 * @param tep - tệp artefact cần đếm.
 * @param cap - cặp [id stock, id gbh].
 * @returns bộ đếm của tệp.
 */
function demTep(tep: string, cap: readonly [string, string]): { stock: number; gbh: number } {
  const t = readFileSync(tep, "utf8");
  // CHỈ đếm IMPORT THẬT: bảng đổi tên của plugin-manager chứa cả hai id dưới dạng CHUỖI nên đếm mọi lần
  // xuất hiện sẽ báo TRỘN oan. So khớp nguyên văn ba dạng specifier, không dùng regex để khỏi lỗi thoát ký tự.
  const dem = (id: string): number =>
    t.split('from "' + id + '"').length - 1 +
    t.split("from '" + id + "'").length - 1 +
    t.split('import("' + id + '")').length - 1;
  return { stock: dem(cap[0]), gbh: dem(cap[1]) };
}

/**
 * Quét mọi gói trong một thư mục node_modules kiểu @scope/<tên>/lib/index.js.
 * Nhận: gốc node_modules + tên scope + cặp id. Trả: các gói có import id.
 * @param goc - thư mục node_modules.
 * @param scope - tên scope, ví dụ "@galaxy-blackhole".
 * @param cap - cặp id cần đếm.
 * @returns danh sách gói có ít nhất một import.
 */
export function quetNodeModules(goc: string, scope: string, cap: readonly [string, string] = CAP_MAC_DINH): DemGoi[] {
  const out: DemGoi[] = [];
  const dirScope = join(goc, scope);
  if (!existsSync(dirScope)) return out;
  for (const ten of readdirSync(dirScope).sort()) {
    const tep = join(dirScope, ten, "lib", "index.js");
    if (!existsSync(tep)) continue;
    const { stock, gbh } = demTep(tep, cap);
    if (stock > 0 || gbh > 0) out.push({ goi: ten, stock, gbh });
  }
  return out;
}

/**
 * Quét artefact trong repo (packages/<tầng>/<gói>/lib/index.js).
 * Nhận: cặp id. Trả: các gói có import id.
 * @param cap - cặp id cần đếm.
 * @returns danh sách gói trong repo có ít nhất một import.
 */
export function quetRepo(cap: readonly [string, string] = CAP_MAC_DINH): DemGoi[] {
  const out: DemGoi[] = [];
  for (const tang of ["host", "client"]) {
    const dirTang = join(REPO_ROOT, "packages", tang);
    if (!existsSync(dirTang)) continue;
    for (const ten of readdirSync(dirTang).sort()) {
      const tep = join(dirTang, ten, "lib", "index.js");
      if (!existsSync(tep)) continue;
      const { stock, gbh } = demTep(tep, cap);
      if (stock > 0 || gbh > 0) out.push({ goi: tang + "/" + ten, stock, gbh });
    }
  }
  return out;
}

/**
 * In bảng đếm của một nguồn và trả số gói TRỘN (vừa stock vừa GBH = dấu hiệu chắc chắn của tách instance).
 * Nhận: nhãn nguồn + danh sách gói đã đếm. Trả: số gói trộn.
 * @param nhan - nhãn nguồn (REPO / PROFILE / APPS-HOST).
 * @param ds - danh sách gói đã đếm.
 * @returns số gói trộn trong nguồn này.
 */
function inNguon(nhan: string, ds: DemGoi[]): number {
  const stock = ds.filter((d) => d.gbh === 0).length;
  const gbh = ds.filter((d) => d.stock === 0).length;
  const tron = ds.filter((d) => d.stock > 0 && d.gbh > 0);
  console.log(nhan + ": STOCK " + stock + " | GBH " + gbh + " | TRỘN " + tron.length + " (tổng " + ds.length + " gói có import id)");
  for (const t of tron) console.log("  FAIL TRỘN " + t.goi + " stock=" + t.stock + " gbh=" + t.gbh);
  if (ds.length > 0 && ds.length <= 30) for (const d of ds) console.log("  " + d.goi.padEnd(34) + " stock=" + d.stock + " gbh=" + d.gbh);
  return tron.length;
}

/**
 * Chạy cổng: đếm cả ba nguồn (repo · profile · apps/host) rồi kết luận.
 * Nhận: tham số dòng lệnh — [cặp id dạng "stock|gbh"] tuỳ chọn. Trả: mã thoát (0 đạt, 1 có gói trộn).
 * @param argv - tham số dòng lệnh.
 * @returns 0 khi không nguồn nào có gói trộn.
 */
export function runCli(argv: readonly string[] = []): number {
  const cap: readonly [string, string] = argv[0]?.includes("|") ? (argv[0].split("|") as [string, string]) : CAP_MAC_DINH;
  console.log("Cặp id: " + cap[0] + "  ↔  " + cap[1]);
  let tron = 0;
  tron += inNguon("REPO (packages/*/*/lib)", quetRepo(cap));
  const profile = join(process.env.HOME ?? "", ".galaxy", "blackhole", "profiles", "node_modules");
  if (existsSync(profile)) tron += inNguon("PROFILE", quetNodeModules(profile, "@galaxy-blackhole", cap));
  const appsHost = join(REPO_ROOT, "apps", "host", "node_modules");
  if (existsSync(appsHost)) tron += inNguon("APPS/HOST", quetNodeModules(appsHost, "@deepseek-ai", cap));
  if (tron === 0) {
    console.log("OK   mount-scope · không gói nào TRỘN");
    return 0;
  }
  console.log("[FAIL mount-scope · " + tron + " gói TRỘN ⇒ hai module instance ⇒ seam dùng Symbol sẽ trả undefined]");
  return 1;
}

if (import.meta.main) process.exit(runCli(process.argv.slice(2)));
