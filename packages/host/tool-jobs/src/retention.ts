/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 phần TextRetainer mà tool-jobs dùng (head/tail theo BYTE UTF-8) từ @deepseek-ai/dsh-output-retention — gói không symlink peer đó, nên logic được viết lại theo CẤU TRÚC, giữ nguyên cách cắt ở biên codepoint và ngân sách byte.
 */

/** Bộ mã hoá UTF-8 dùng chung — NGUYÊN VĂN bản gốc. */
const encoder = new TextEncoder();

/** Bộ giải mã UTF-8 dùng chung — NGUYÊN VĂN bản gốc. */
const decoder = new TextDecoder();

/**
 * Bỏ chuỗi UTF-8 đuôi KHÔNG hoàn chỉnh để lát cắt tiền tố không sinh ký tự thay thế ở biên.
 * Nhận: bytes — tiền tố đã cắt theo ngân sách byte.
 * Trả: tiền tố đã lùi qua các byte nối (10xxxxxx) nếu chuỗi dở dang.
 */
function trimTrailingPartialUtf8(bytes: Uint8Array): Uint8Array {
  let i = bytes.length - 1;
  while (i >= 0 && ((bytes[i] as number) & 192) === 128 && bytes.length - i <= 3) i--;
  if (i < 0) return bytes;
  const lead = bytes[i] as number;
  const expected = lead < 128 ? 1 : lead < 224 ? 2 : lead < 240 ? 3 : lead < 248 ? 4 : 0;
  if (expected === 0) return bytes;
  return bytes.length - i < expected ? bytes.subarray(0, i) : bytes;
}

/**
 * Bỏ các byte nối (10xxxxxx) ở ĐẦU để lát cắt hậu tố bắt đầu tại byte dẫn/ASCII.
 * Nhận: bytes — hậu tố đã cắt theo ngân sách byte.
 * Trả: hậu tố bắt đầu ở biên codepoint.
 */
function trimLeadingContinuationUtf8(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length && ((bytes[i] as number) & 192) === 128) i++;
  return bytes.subarray(i);
}

/**
 * Giữ phần ĐẦU của chuỗi theo ngân sách BYTE, cắt an toàn ở biên UTF-8 — tương đương TextRetainer({ kind: "head", maxBytes }).
 * Nhận: text — chuỗi cần giới hạn; maxBytes — số byte tối đa giữ lại.
 * Trả: tiền tố đã giải mã, không mang ký tự thay thế do lát cắt.
 * @throws {Error} khi maxBytes không phải số nguyên không âm (NGUYÊN VĂN assertBudget của bản gốc).
 */
export function retainHead(text: string, maxBytes: number): string {
  if (!Number.isInteger(maxBytes) || maxBytes < 0) throw new Error("maxBytes must be a non-negative integer");
  const bytes = encoder.encode(text);
  const omitted = bytes.length > maxBytes;
  const prefix = bytes.subarray(0, Math.min(bytes.length, maxBytes));
  return decoder.decode(omitted ? trimTrailingPartialUtf8(prefix) : prefix);
}

/**
 * Giữ phần ĐUÔI của chuỗi theo ngân sách BYTE, cắt an toàn ở biên UTF-8 — tương đương TextRetainer({ kind: "tail", maxBytes }).
 * Nhận: text — chuỗi cần giới hạn; maxBytes — số byte tối đa giữ lại.
 * Trả: hậu tố đã giải mã, không mang ký tự thay thế do lát cắt.
 * @throws {Error} khi maxBytes không phải số nguyên không âm (NGUYÊN VĂN assertBudget của bản gốc).
 */
export function retainTail(text: string, maxBytes: number): string {
  if (!Number.isInteger(maxBytes) || maxBytes < 0) throw new Error("maxBytes must be a non-negative integer");
  const bytes = encoder.encode(text);
  const omitted = bytes.length > maxBytes;
  const suffix = bytes.subarray(Math.max(0, bytes.length - maxBytes));
  return decoder.decode(omitted ? trimLeadingContinuationUtf8(suffix) : suffix);
}

/**
 * Nối nội dung với hậu tố rồi cắt cho vừa maxBytes — NGUYÊN VĂN fitWithSuffix của bản gốc.
 * Hậu tố (và dấu báo cắt khi cần) được giữ TRỌN VẸN; phần nội dung bị cắt từ ĐẦU.
 * Nhận: content — nội dung chính; suffix — hậu tố cố định; maxBytes — ngân sách byte (undefined = không cắt); omitted — dấu báo cắt.
 * Trả: chuỗi đã vừa ngân sách.
 * @throws {Error} khi maxBytes không phải số nguyên không âm và buộc phải cắt.
 */
export function fitWithSuffix(content: string, suffix: string, maxBytes: number | undefined, omitted: string): string {
  const complete = content + suffix;
  if (maxBytes === undefined || encoder.encode(complete).byteLength <= maxBytes) return complete;
  const fixed = (content.endsWith(omitted.trimStart()) ? "" : omitted) + suffix;
  const fixedBytes = encoder.encode(fixed).byteLength;
  if (fixedBytes >= maxBytes) return retainTail(fixed, maxBytes);
  return retainTail(content, maxBytes - fixedBytes) + fixed;
}
