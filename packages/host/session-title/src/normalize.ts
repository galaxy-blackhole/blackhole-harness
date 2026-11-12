/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chuẩn hoá văn bản tiêu đề và cắt theo NGÂN SÁCH BYTE UTF-8 — ba hàm công khai của miền tiêu
 *      đề phiên: `truncateTitleUtf8` · `normalizeSessionTitle` · `fallbackSessionTitle`. Bản viết
 *      lại của Galaxy Blackhole cho row session-title (@deepseek-ai/dsh-session-title) — nguồn đối
 *      chiếu: xem README.md của package (G4). Nguồn gốc: lib/types/normalize.js (70 dòng).
 */

/** Chuỗi thoát lệnh hệ điều hành (OSC), kể cả đuôi chưa đóng. */
const OSC_SEQUENCE = /(?:\u001B\]|\u009D)(?:(?!\u0007|\u001B\\)[\s\S])*(?:\u0007|\u001B\\|$)/gu;

/** Chuỗi thoát mở đầu điều khiển (CSI) như mã màu SGR. */
const CSI_SEQUENCE = /(?:\u001B\[|\u009B)[0-?]*[ -/]*[@-~]/gu;

/** Các chuỗi thoát điều khiển ESC hai byte còn lại. */
const ESC_SEQUENCE = /\u001B[@-_]/gu;

/** Ký tự điều khiển C0/C1 không phải khoảng trắng. */
const CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu;

/** Ký tự điều khiển hướng và vô hình có thể làm tiêu đề hiển thị bị đánh lừa. */
const DIRECTIONAL_CONTROL = /[\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/gu;

/**
 * Từ chối một giới hạn văn bản công khai không hợp lệ (nguyên văn câu lỗi của bản gốc).
 * Nhận: tên trường và giá trị cần kiểm.
 * Trả: không; ném `Error` khi giá trị không phải số nguyên dương.
 */
function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

/**
 * Bỏ ký tự điều khiển và cho ra MỘT dòng đã cắt khoảng trắng, đã gộp khoảng trắng.
 * Nhận: văn bản thô (có thể chứa mã màu, ký tự hướng, xuống dòng).
 * Trả: văn bản sạch — thứ tự bỏ khớp bản gốc: OSC → CSI → ESC → C0/C1 → hướng/vô hình → gộp `\s+`.
 */
function cleanTitleText(input: string): string {
  return input
    .replace(OSC_SEQUENCE, "")
    .replace(CSI_SEQUENCE, "")
    .replace(ESC_SEQUENCE, "")
    .replace(CONTROL_CHARACTER, "")
    .replace(DIRECTIONAL_CONTROL, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Cắt một chuỗi theo ngân sách byte UTF-8 mà KHÔNG chẻ đôi một điểm mã Unicode.
 * Nhận: văn bản tiêu đề đã chuẩn hoá và ngân sách byte dương.
 * Trả: tiền tố điểm mã dài nhất nằm trong ngân sách.
 */
export function truncateTitleUtf8(input: string, maxBytes: number): string {
  assertPositiveInteger("maxBytes", maxBytes);
  if (Buffer.byteLength(input, "utf8") <= maxBytes) return input;
  let used = 0;
  let output = "";
  for (const character of input) {
    const bytes = Buffer.byteLength(character, "utf8");
    if (used + bytes > maxBytes) break;
    output += character;
    used += bytes;
  }
  return output;
}

/**
 * Chuẩn hoá MỘT tiêu đề phiên được nhận và ép ngân sách byte UTF-8 của nó.
 * Nhận: văn bản tiêu đề KHÔNG tin được và ngân sách mã hoá dương.
 * Trả: tiêu đề một dòng an toàn cho terminal — có thể RỖNG sau khi làm sạch.
 */
export function normalizeSessionTitle(input: string, maxBytes: number): string {
  return truncateTitleUtf8(cleanTitleText(input), maxBytes).trimEnd();
}

/**
 * Suy ra tiêu đề dự phòng TẤT ĐỊNH từ prompt đầu tiên.
 * Nhận: văn bản của tin người dùng hợp lệ đầu tiên, trần số từ, trần byte UTF-8.
 * Trả: các từ đầu đã chuẩn hoá nằm trong CẢ HAI giới hạn.
 */
export function fallbackSessionTitle(input: string, maxWords: number, maxBytes: number): string {
  assertPositiveInteger("maxWords", maxWords);
  return truncateTitleUtf8(
    cleanTitleText(input).split(" ").filter(Boolean).slice(0, maxWords).join(" "),
    maxBytes,
  ).trimEnd();
}
