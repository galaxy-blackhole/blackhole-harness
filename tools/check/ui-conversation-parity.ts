/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Cổng CSS của nửa client ui-conversation: đếm khối CSS · đếm rule · liệt kê tagId · so TỪNG KHỐI
 *      với bundle gốc sau khi quy id ta→stock và đảo brand rename. Dùng để chứng minh artefact KHÔNG tự chế CSS.
 */
import { readFileSync } from "node:fs";
import { applyBrandRename, reverseBrandRename } from "../../packages/tools/brand-rename/src/index.ts";
import { join } from "node:path";

/** Gốc repo (tools/check ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Đường dẫn artefact của ta. */
const OURS_PATH = join(REPO, "packages", "client", "ui-conversation", "lib", "client.js");
/** Đường dẫn bundle gốc (CHỈ ĐỌC). */
const STOCK_PATH = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-conversation", "lib", "client.js");
/** Id gói ta và gói gốc (chỉ dòng loader đổi id). */
const OUR_ID = "@galaxy-blackhole/gbh-client-ui-conversation";
const STOCK_ID = "@deepseek-ai/dsh-client-ui-conversation";
/** Ghi chú: hằng 2 id giữ lại để in báo cáo, không dùng để biến đổi văn bản. */
void OUR_ID; void STOCK_ID;
/** Dấu mở vùng CSS trong bundle: backslash + 0 + dsh-css: (xuất hiện trong comment //#region). */
const MARK = "\\0dsh-css:";

/** Một khối CSS đọc được từ bundle. */
interface CssBlock { path: string; text: string; }

/**
 * Cắt mọi khối CSS khỏi một bundle.
 * Nhận: văn bản bundle.
 * Trả: danh sách khối (thứ tự xuất hiện) + danh sách tagId.
 */
function parseCss(text: string): { blocks: CssBlock[]; tagIds: string[] } {
  const blocks: CssBlock[] = [];
  const pieces = text.split(MARK);
  for (let index = 1; index < pieces.length; index += 1) {
    const piece = pieces[index] ?? "";
    const newlineAt = piece.indexOf("\n");
    const path = newlineAt < 0 ? piece : piece.slice(0, newlineAt);
    const assign = piece.indexOf("const css");
    if (assign < 0) continue;
    const quoteStart = piece.indexOf("\"", assign);
    if (quoteStart < 0) continue;
    let cursor = quoteStart + 1;
    let value = "";
    while (cursor < piece.length) {
      const ch = piece[cursor];
      if (ch === "\\") { value += ch + (piece[cursor + 1] ?? ""); cursor += 2; continue; }
      if (ch === "\"") break;
      value += ch; cursor += 1;
    }
    blocks.push({ path: path.split("/src/").pop() ?? path, text: value });
  }
  const tagIds = [...text.matchAll(/tagId\$?[0-9]* = "([^"]+)"/g)].map((match) => match[1] as string);
  return { blocks, tagIds };
}

/**
 * Đếm rule của một chuỗi CSS (số dấu `}` = số khối khai báo đóng).
 * Nhận: chuỗi CSS. Trả: số rule.
 */
function ruleCount(css: string): number { return (css.match(/\}/g) ?? []).length; }

/** Chạy cổng, in báo cáo, trả mã thoát (0 = ĐẠT). */
function main(): number {
  const oursText = readFileSync(OURS_PATH, "utf8");
  const stockText = readFileSync(STOCK_PATH, "utf8");
  // Hai chiều: (1) bỏ brand rename của ta ⇒ phải ra ĐÚNG khối gốc; (2) áp brand rename lên khối gốc ⇒ phải ra ĐÚNG khối ta.
  const unbranded = parseCss(reverseBrandRename(oursText));
  const ours = parseCss(oursText);
  const stock = parseCss(stockText);
  console.log("khối CSS: ta " + String(ours.blocks.length) + " · gốc " + String(stock.blocks.length));
  console.log("tagId: ta " + String(ours.tagIds.length) + " · gốc " + String(stock.tagIds.length));
  let same = 0;
  const diffs: string[] = [];
  for (const block of stock.blocks) {
    const mine = unbranded.blocks.find((item) => item.path === block.path);
    if (mine === undefined) { diffs.push("THIEU  " + block.path); continue; }
    const forward = applyBrandRename(block.text);
    const oursBlock = ours.blocks.find((item) => item.path === block.path);
    if (mine.text === block.text && oursBlock?.text === forward) { same += 1; continue; }
    diffs.push("KHAC   " + block.path + " (goc " + String(block.text.length) + " B · ta " + String(mine.text.length) + " B · chieu-thuan " + (oursBlock?.text === forward ? "DAT" : "HONG") + ")");
  }
  const totalRules = stock.blocks.reduce((sum, block) => sum + ruleCount(block.text), 0);
  console.log("rule trong bản gốc: " + String(totalRules));
  console.log("khối GIỐNG: " + String(same) + " / " + String(stock.blocks.length));
  for (const line of diffs) console.log("  " + line);
  const tagMismatch = stock.tagIds.filter((id) => !ours.tagIds.includes(id));
  if (tagMismatch.length > 0) { console.log("tagId thieu:"); for (const id of tagMismatch) console.log("  " + id); }
  const pass = diffs.length === 0 && tagMismatch.length === 0;
  console.log(pass ? "CỔNG CSS: ĐẠT" : "CỔNG CSS: HỎNG");
  return pass ? 0 : 1;
}

process.exit(main());
