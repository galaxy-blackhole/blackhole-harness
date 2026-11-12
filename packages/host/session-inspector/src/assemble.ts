/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ghép sáu lát nguyên văn + module CSS thành MỘT thân factory, rồi bọc thành script classic MỘT id
 */

import { CSS_REPLACEMENTS, FRAGMENT_MARKER_LINE, PART_FILES } from "./manifest.ts";

/** Id DUY NHẤT mà bundle của ta đăng ký — id bundle TỰ KHAI phải bằng TÊN PACKAGE (xem README §3). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-session-inspector";

/** Id của gói GỐC — chỉ được khai ở gbh.row.aliases; bundle KHÔNG bao giờ load() id này. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-experimental-session-inspector";

/** Tên file entry tạm mà build.ts ghi ra rồi giao cho Bun.build kiểm cú pháp. */
export const ENTRY_FILE_NAME = ".entry.js";

/** Dòng đánh dấu một lát nguyên văn — mọi lát đều phải có, thiếu là không phải lát của ta. */
const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc một module TS mà tools/split-stock-bundle.ts chèn vào cuối mỗi lát. */
const MODULE_TAIL = "export {};";

/** Dòng đóng khối header 5 dòng bắt buộc của repo. */
const HEADER_END = "*/";

/** Ký tự xuống dòng, viết qua String.fromCharCode để không lẫn với ký tự trong văn bản ghép. */
const EOL = String.fromCharCode(10);

/**
 * Bỏ phần GIAO KÈO của một lát: khối header 5 dòng, dòng @ts-nocheck, dòng export {}; và hai dòng đánh
 * dấu vỏ của mảnh bị cắt giữa câu lệnh. Phần còn lại là NGUYÊN VĂN bundle gốc, không sửa một byte nào.
 * Nhận: source — nội dung file lát; fileName — tên file (dùng cho thông báo lỗi).
 * Trả: thân lát đã bỏ phần giao kèo, đúng từng byte như trong bundle gốc.
 */
export function stripPartScaffold(source: string, fileName: string): string {
  const lines = source.split(EOL);
  const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
  if (marker < 0) throw new Error(fileName + ": khong thay dong danh dau lat nguyen van");
  const headerOk = lines.slice(0, marker).some((line) => line.trim() === HEADER_END);
  if (!headerOk) throw new Error(fileName + ": thieu khoi header 5 dong bat buoc");
  const rest = lines.slice(marker + 1);
  // Bỏ ĐÚNG một dòng trống ngay sau @ts-nocheck — đó là phần giao kèo do tools/split-stock-bundle.ts thêm.
  if ((rest[0] ?? "").trim() === "") rest.shift();
  const body = rest.filter((line) => line.trim() !== MODULE_TAIL && !FRAGMENT_MARKER_LINE.test(line));
  // Chỉ cắt dòng trống ở HAI ĐẦU: dòng trống bên trong là nguyên văn (bundle gốc có nhiều dòng trống).
  while (body.length > 0 && (body[0] ?? "").trim() === "") body.shift();
  while (body.length > 0 && (body[body.length - 1] ?? "").trim() === "") body.pop();
  return body.join(EOL);
}

/**
 * Lấy phần CSS NGUYÊN VĂN của một file .module.css: bỏ khối header 5 dòng và đúng một ký tự xuống dòng cuối file.
 * Nhận: source — nội dung file .module.css.
 * Trả: văn bản CSS đúng từng byte như trong bundle gốc.
 */
export function readCssSource(source: string): string {
  const end = source.indexOf(HEADER_END);
  if (end < 0) throw new Error("file .module.css thieu khoi header 5 dong bat buoc");
  let css = source.slice(end + HEADER_END.length);
  if (css.startsWith(EOL)) css = css.slice(1);
  if (css.endsWith(EOL)) css = css.slice(0, -1);
  return css;
}

/**
 * Thay mọi điểm thay thế CSS trong THÂN bundle bằng chuỗi CSS đã mã hoá JSON (đúng như bundle gốc phát ra).
 * Mỗi điểm thay thế phải xuất hiện ĐÚNG MỘT lần: không thấy = lát đã bị sửa tay, thấy nhiều lần = CSS sẽ
 * bị nhân bản ⇒ cả hai đều là lỗi, không phải cảnh báo.
 * Nhận: source — thân bundle (đã ghép sáu lát); cssByPlaceholder — ánh xạ điểm thay thế sang văn bản CSS.
 * Trả: thân bundle đã nhúng CSS nguyên văn.
 */
export function embedCss(source: string, cssByPlaceholder: ReadonlyMap<string, string>): string {
  let out = source;
  for (const item of CSS_REPLACEMENTS) {
    const css = cssByPlaceholder.get(item.placeholder);
    if (css === undefined) throw new Error("thieu CSS cho diem thay the " + item.placeholder);
    const token = JSON.stringify(item.placeholder);
    const hits = out.split(token).length - 1;
    if (hits !== 1) throw new Error("diem thay the " + item.placeholder + " xuat hien " + hits + " lan (phai dung 1)");
    out = out.split(token).join(JSON.stringify(css));
  }
  return out;
}

/**
 * Ghép các lát thành MỘT thân factory — chính là thân factory của bundle gốc, nguyên văn.
 * Thứ tự bắt buộc theo manifest (cùng thứ tự vùng //#region của bundle gốc).
 * Nhận: partSources — nội dung các lát theo đúng thứ tự manifest; cssByPlaceholder — CSS đã đọc từ đĩa.
 * Trả: thân bundle hoàn chỉnh (chưa có vỏ IIFE, chưa có lời gọi load).
 */
export function assembleBundleBody(partSources: readonly string[], cssByPlaceholder: ReadonlyMap<string, string>): string {
  if (partSources.length !== PART_FILES.length) {
    throw new Error("so lat khong khop manifest: " + partSources.length + " ≠ " + PART_FILES.length);
  }
  // Nhúng CSS SAU khi ghép: điểm thay thế nằm ở một lát bất kỳ, và phép đếm "đúng một lần" chỉ có
  // nghĩa trên toàn thân bundle.
  const body = partSources.map((source, index) => stripPartScaffold(source, PART_FILES[index] as string)).join(EOL);
  return embedCss(body, cssByPlaceholder);
}

/**
 * Bọc thân bundle thành script classic đăng ký ĐÚNG MỘT id — id CỦA TA.
 *
 * ⚠️ Thân bundle được chèn NGUYÊN VĂN, KHÔNG thụt lề lại: nhờ vậy thân ấy nằm trong artifact như một
 * chuỗi con liền mạch, và phép so byte với bundle gốc là phép so trực tiếp (không phải "so sau khi bỏ
 * thụt lề" — kiểu so đó che được lệch thụt lề mà không ai thấy).
 * Nhận: code — thân bundle đã ghép (dùng require/module/exports như biến tự do).
 * Trả: văn bản script classic hoàn chỉnh.
 */
export function wrapClientBundle(code: string): string {
  const header = [
    "/*",
    " * author Bùi Trọng Hiếu",
    " * email kevinbui210191@gmail.com",
    " * create date 18/10/2026",
    " * modify date 18/10/2026",
    " * desc ARTIFACT SINH TỰ ĐỘNG bởi build.ts của " + PACKAGE_NAME + " — không sửa tay",
    " */",
  ].join(EOL);
  return [
    header,
    "(function () {",
    "  var factory = function (require) {",
    code,
    "  };",
    "  // id CHÍNH = TÊN PACKAGE của ta: tầng nạp khoá bảng factory theo id bundle TỰ KHAI, còn",
    "  // materialize() tra theo id dòng đồ thị = tên package ⇒ hai id PHẢI bằng nhau (xem README §3).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // KHÔNG đăng ký id của gói GỐC: nó thuộc gbh.row.aliases và tầng nạp TỰ sinh entry alias.",
    "})();",
    "",
  ].join(EOL);
}

/** Kiểu hàm đọc file mà build.ts truyền vào (để test thay bằng bảng giá). */
export type ReadFileFn = (path: string) => string;

/**
 * Đọc các lát và file CSS từ đĩa rồi ghép thành thân bundle.
 * Nhận: srcDir — thư mục src/ của gói; readFile — hàm đọc file.
 * Trả: thân bundle hoàn chỉnh.
 */
export function assembleBundleFromDisk(srcDir: string, readFile: ReadFileFn): string {
  const joinPath = (a: string, b: string): string => a.replace(/\/+$/, "") + "/" + b;
  const cssByPlaceholder = new Map<string, string>();
  for (const item of CSS_REPLACEMENTS) cssByPlaceholder.set(item.placeholder, readCssSource(readFile(joinPath(srcDir, item.file))));
  return assembleBundleBody(PART_FILES.map((file) => readFile(joinPath(srcDir, file))), cssByPlaceholder);
}

/**
 * Đếm số lần một điểm thay thế CSS xuất hiện trong các lát NGUỒN (trước khi nhúng CSS).
 * Dùng cho test đối chứng: mỗi điểm thay thế phải xuất hiện ĐÚNG MỘT lần, nếu không thì một lát
 * nào đó đã bị sửa tay và CSS sẽ không còn là nguyên văn.
 * Nhận: sources — nội dung thô của các lát; placeholder — điểm thay thế cần đếm.
 * Trả: số lần xuất hiện.
 */
export function countPlaceholder(sources: readonly string[], placeholder: string): number {
  const token = JSON.stringify(placeholder);
  return sources.reduce((total, source) => total + source.split(token).length - 1, 0);
}
