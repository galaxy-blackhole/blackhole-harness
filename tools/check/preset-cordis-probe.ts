/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc So cấu trúc block preset-cordis của ta (bundle + preset-redirect) với bản stock ⇒ chỉ ra dòng khác NGOÀI `name:`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tools/check ⇒ hai cấp lên). */
const REPO = join(import.meta.dir, "..", "..");
/** Tệp preset cordis của stock (nguồn chân lý về CẤU TRÚC). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web-app", "presets", "cordis.patch.yml");
/** Tệp patch bundle của ta (sinh từ stock). */
const OURS_BUNDLE = join(REPO, "packages", "host", "bundle", "presets", "cordis.patch.yml");
/** Tệp override sinh bởi generator preset-redirect. */
const OURS_REDIRECT = join(REPO, "profiles", "blackhole", "preset-redirect.patch.yml");

/**
 * Chuẩn hoá một dòng để so CẤU TRÚC: bỏ chú thích, gộp mọi `name:` về cùng một dạng.
 * Nhận: dòng gốc. Trả: dòng đã chuẩn hoá (hoặc chuỗi rỗng nếu là chú thích/dòng trắng).
 */
function normalize(line: string): string {
  const trimmed = line.replace(/\s+$/, "");
  if (trimmed.trim() === "" || trimmed.trim().startsWith("#")) return "";
  return trimmed.replace(/name: '[^']+'/, "name: <NAME>");
}

/**
 * Lấy các dòng đã chuẩn hoá, kèm SỐ DÒNG GỐC để báo cáo.
 * Nhận: nội dung tệp. Trả: mảng { line, text }.
 */
function rows(text: string): { line: number; text: string }[] {
  return text
    .split("\n")
    .map((raw, index) => ({ line: index + 1, text: normalize(raw) }))
    .filter((row) => row.text !== "");
}

/**
 * So hai dãy dòng đã chuẩn hoá (thuật toán LCS rút gọn) và in phần khác nhau.
 * Nhận: nhãn hai bên + dãy dòng. Trả: số dòng khác biệt.
 */
function diff(labelA: string, a: { line: number; text: string }[], labelB: string, b: { line: number; text: string }[]): number {
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i]![j] = a[i]!.text === b[j]!.text ? (lcs[i + 1]![j + 1] ?? 0) + 1 : Math.max(lcs[i + 1]![j] ?? 0, lcs[i]![j + 1] ?? 0);
    }
  }
  const onlyA: { line: number; text: string }[] = [];
  const onlyB: { line: number; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i]!.text === b[j]!.text) {
      i += 1;
      j += 1;
    } else if ((lcs[i + 1]![j] ?? 0) >= (lcs[i]![j + 1] ?? 0)) {
      onlyA.push(a[i]!);
      i += 1;
    } else {
      onlyB.push(b[j]!);
      j += 1;
    }
  }
  while (i < n) onlyA.push(a[i++]!);
  while (j < m) onlyB.push(b[j++]!);
  console.log(labelA + " có mà " + labelB + " KHÔNG có: " + String(onlyA.length) + " dòng");
  for (const row of onlyA.slice(0, 40)) console.log("  " + labelA + ":" + String(row.line) + "  " + row.text);
  console.log(labelB + " có mà " + labelA + " KHÔNG có: " + String(onlyB.length) + " dòng");
  for (const row of onlyB.slice(0, 40)) console.log("  " + labelB + ":" + String(row.line) + "  " + row.text);
  return onlyA.length + onlyB.length;
}

/**
 * Điểm vào: so cấu trúc và in kết luận.
 * Nhận: không. Trả: mã thoát (0 = chỉ đo; 1 = thiếu tệp).
 */
async function main(): Promise<number> {
  for (const file of [STOCK, OURS_BUNDLE, OURS_REDIRECT]) {
    if (!existsSync(file)) {
      console.log("THIEU TEP: " + file);
      return 1;
    }
  }
  const stock = rows(readFileSync(STOCK, "utf8"));
  const oursBundle = rows(readFileSync(OURS_BUNDLE, "utf8"));
  console.log("=== A) STOCK vs BUNDLE CỦA TA (" + String(stock.length) + " vs " + String(oursBundle.length) + " dòng có nghĩa) ===");
  const diffStockBundle = diff("stock", stock, "bundle", oursBundle);
  console.log("");

  const redirectText = readFileSync(OURS_REDIRECT, "utf8");
  const start = redirectText.indexOf("- id: preset-cordis");
  const redirectBlock = start === -1 ? [] : rows(redirectText.slice(start));
  console.log("=== B) STOCK vs BLOCK preset-cordis trong preset-redirect (" + String(redirectBlock.length) + " dòng) ===");
  const diffStockRedirect = diff("stock", stock, "redirect", redirectBlock);
  console.log("");
  console.log("KET LUAN: khác cấu trúc A=" + String(diffStockBundle) + " dòng · B=" + String(diffStockRedirect) + " dòng (đã bỏ qua MỌI khác biệt ở `name:`, chú thích, dòng trắng)");
  console.log("");
  return 0;
}

if (import.meta.main) process.exit(await main());
