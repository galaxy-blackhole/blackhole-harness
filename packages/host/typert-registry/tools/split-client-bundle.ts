/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cắt NỬA CLIENT (client.browser.js / client.node.js) của dsh-api-gateway thành lát NGUYÊN VĂN:
 *      phần vỏ (head/tail) lưu dạng JSON để KHÔNG thành file .ts gãy cú pháp, phần thân theo vùng region
 */

/**
 * Vì sao tách vỏ ra JSON: hai nửa client là SCRIPT CLASSIC, mở đầu bằng
 *      window.__ModuleLoader__.load({ id: "...", factory: (require) => {
 * và kết thúc bằng hai dòng đóng ngoặc. Hai đầu đó KHÔNG cân ngoặc nên không thể là file .ts hợp lệ
 * (cổng typecheck sẽ đỏ dù có @ts-nocheck — lỗi CÚ PHÁP không bị @ts-nocheck che). Vì vậy:
 *   • thân = các vùng region (mỗi vùng là đơn vị cú pháp trọn vẹn) ⇒ file .ts có header + @ts-nocheck;
 *   • vỏ  = mảng dòng lưu trong src/client-wrapper.json (JSON được miễn header theo tools/lint/header.ts),
 *     trong đó DÒNG ID đã được đổi sang id của ta (luật MỘT-ID: bundle tự khai đúng tên package).
 * Ghép lại: vỏ + thân ⇒ TRÙNG NGUYÊN VĂN bản gốc sau khi quy đổi id (assemble kiểm từng byte).
 *
 * Cách dùng: bun run tools/split-client-bundle.ts <bundle-client-gốc> <browser|node>
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Id GỐC trong bundle stock — dòng này bị thay bằng id của ta. */
export const STOCK_ID = "@deepseek-ai/dsh-api-gateway";

/** Id của ta (tên package) — dùng cho cả hai nửa client. */
export const OUR_ID = "@galaxy-blackhole/gbh-host-typert-gateway";

/** Khối header 5 dòng cho mỗi lát thân. */
const HEADER = [
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc LAT NGUYEN VAN THAN nua client @deepseek-ai/dsh-api-gateway — sinh boi tools/split-client-bundle.ts",
  " */",
].join(EOL);

/** Dòng đánh dấu lát nguyên văn. */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS. */
export const MODULE_TAIL = "export {};";

/** Dòng vỏ hàm dùng khi một mảnh không đứng riêng được. */
const FRAGMENT_OPEN = "function __gbh_fragment__() {";

/** Dòng đóng vỏ hàm. */
const FRAGMENT_CLOSE = "}";

/** Dấu mở/đóng vỏ hàm để assemble gỡ. */
const FRAGMENT_BEGIN_MARKER = "// __GBH_FRAGMENT_BEGIN__";
const FRAGMENT_END_MARKER = "// __GBH_FRAGMENT_END__";

/** Kết quả cắt một nửa client. */
export interface ClientSplit {
  /** Dòng vỏ đầu (đã đổi id sang id của ta). */
  head: string[];
  /** Các lát thân. */
  parts: { file: string; lines: string[]; fragment: boolean }[];
  /** Dòng vỏ cuối. */
  tail: string[];
}

/**
 * Dựng văn bản một file lát thân.
 * Nhận: part — lát cần dựng.
 * Trả: nội dung file .ts.
 */
export function renderPart(part: { lines: string[]; fragment: boolean }): string {
  const body = part.fragment ? [FRAGMENT_BEGIN_MARKER, FRAGMENT_OPEN, ...part.lines, FRAGMENT_CLOSE, FRAGMENT_END_MARKER] : part.lines;
  return HEADER + EOL + SLICE_MARKER + EOL + EOL + body.join(EOL) + EOL + EOL + MODULE_TAIL + EOL;
}

/**
 * Cắt một nửa client thành vỏ + các lát thân (chia HẾT mọi dòng, không bỏ dòng nào).
 * Nhận: source — nội dung bundle client gốc; side — "browser" hoặc "node".
 * Trả: ClientSplit.
 */
export function splitClient(source: string, side: string): ClientSplit {
  const lines = source.split(EOL);
  const open = lines.findIndex((line) => line.includes("factory: (require) => {"));
  // HAI HÌNH DẠNG: (1) SCRIPT CLASSIC cho browser — có vỏ loader (head kết thúc ở dòng mở factory, tail là
  // hai dòng đóng ngoặc); (2) ESM thuần cho node — head là các câu import, tail là câu export ở cuối.
  const esm = open < 0;
  const firstRegion = lines.findIndex((line) => /^[ 	]*\/\/#region /u.test(line));
  const lastEndregion = lines.map((line, index) => (/^[ 	]*\/\/#endregion/u.test(line) ? index : -1)).filter((index) => index >= 0).pop();
  if (esm && (firstRegion < 0 || lastEndregion === undefined)) throw new Error("bundle client ESM khong co vung region");
  const headEnd = esm ? firstRegion : open + 1;
  // TS không tự suy ra `lastEndregion` đã xác định sau câu throw phía trên (điều kiện phụ thuộc `esm`),
  // nên đặt biến có kiểu chắc chắn; giá trị dự phòng chỉ để thoả kiểu, nhánh ESM luôn có `lastEndregion`.
  const lastEnd: number = lastEndregion ?? lines.length - 1;
  let tailStart = esm ? lastEnd + 1 : lines.length - 2;
  while (tailStart < lines.length && (lines[tailStart] ?? "").trim() === "" && !esm) tailStart += 1;
  if (!esm) {
    tailStart = lines.length - 2;
    while (tailStart > 0 && (lines[tailStart] ?? "").startsWith("//# sourceMappingURL")) tailStart -= 1;
  }
  const closeIndex = lines.length - 1;
  const head = lines.slice(0, headEnd);
  const tail = lines.slice(tailStart);
  const bodyLines = lines.slice(headEnd, tailStart);
  // Chia thân theo vùng region (cho phép thụt lề); dòng trước vùng đầu tiên và sau vùng cuối thuộc về lát "glue".
  const parts: ClientSplit["parts"] = [];
  let current: string[] = [];
  let counter = 0;
  /** Đóng lát đang gom. */
  const flush = (): void => {
    if (current.length === 0) return;
    parts.push({ file: "part-" + String(counter).padStart(2, "0") + ".ts", lines: current, fragment: false });
    counter += 1;
    current = [];
  };
  for (const line of bodyLines) {
    if (/^[ \t]*\/\/#region /u.test(line)) {
      flush();
      current.push(line);
      continue;
    }
    current.push(line);
    if (/^[ \t]*\/\/#endregion/u.test(line)) flush();
  }
  flush();
  // Kiểm cú pháp từng lát: không đứng riêng được thì bọc vỏ hàm; nếu BỌC VẪN GÃY (mảnh "keo" không cân
  // ngoặc ở hai đầu thân) thì đẩy các dòng đó về VỎ (head nếu là lát đầu, tail nếu là lát cuối, còn lại thì
  // gộp vào lát trước) — nhờ vậy không bao giờ có file .ts gãy cú pháp mà vẫn giữ NGUYÊN VĂN từng byte.
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const tailLines: string[] = [];
  let guard = 0;
  /** Lát này có dựng được thành file .ts không (trơn hoặc có vỏ hàm). */
  const valid = (part: { lines: string[]; fragment: boolean }): boolean => {
    try {
      transpiler.transformSync(renderPart({ ...part, fragment: false }));
      return true;
    } catch {
      try {
        transpiler.transformSync(renderPart({ ...part, fragment: true }));
        part.fragment = true;
        return true;
      } catch {
        return false;
      }
    }
  };
  while (guard < 240) {
    guard += 1;
    const broken = parts.findIndex((part) => !valid(part));
    if (broken < 0) break;
    const part = parts[broken];
    if (part === undefined) break;
    if (broken === parts.length - 1) {
      // Mảnh keo cuối: đẩy về trước vỏ cuối.
      tailLines.unshift(...part.lines);
      parts.pop();
      continue;
    }
    const previous = parts[broken - 1];
    if (previous === undefined) throw new Error(part.file + ": lat that bai ma khong co lat truoc de gop");
    previous.lines.push(...part.lines);
    parts.splice(broken, 1);
  }
  if (parts.some((part) => !valid(part))) throw new Error("con lat than khong dung rieng duoc sau khi gop");
  if (closeIndex < tailStart) throw new Error("bundle client qua ngan");
  return { head, parts, tail: [...tailLines, ...tail] };
}

if (import.meta.main) {
  const source = process.argv[2];
  const side = process.argv[3] ?? "browser";
  if (source === undefined) throw new Error("thiếu đường dẫn bundle client gốc");
  const base = join(import.meta.dir, "..");
  const split = splitClient(readFileSync(source, "utf8"), side);
  const partsDir = join(base, "src", "client-parts", side);
  rmSync(partsDir, { recursive: true, force: true });
  mkdirSync(partsDir, { recursive: true });
  for (const part of split.parts) writeFileSync(join(partsDir, part.file), renderPart(part));
  // Chỉ nửa BROWSER có dòng id cần quy đổi; nửa node là ESM thuần nên không có id nào để đổi.
  const wrapper = { head: split.head.map((line) => line.split(STOCK_ID).join(OUR_ID)), tail: split.tail, parts: split.parts.map((part) => part.file) };
  writeFileSync(join(base, "src", "client-wrapper." + side + ".json"), JSON.stringify(wrapper, null, 2) + "\n");
  console.log("cắt nửa " + side + ": " + split.parts.length + " lát thân ⇒ " + partsDir);
  for (const part of split.parts) console.log("  " + part.file + " · " + String(part.lines.length) + " dòng" + (part.fragment ? " (bọc vỏ hàm)" : ""));
}
