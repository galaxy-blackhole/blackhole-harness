/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bốn helper thuần của gói repeat-tool-reminder: sắp xếp khoá sâu rồi canonical hoá arguments
 *      thành chuỗi, biên dịch mẫu wildcard `*` thành RegExp neo hai đầu, và cắt đầu chuỗi canonical
 *      để trích trong lời nhắc chi tiết (port 1:1 từ lib/types/index.js, dòng 2143–2178)
 */

/**
 * Miền giá trị của JSON — đúng miền đầu vào của guard: arguments tới đây dưới dạng output của
 * `JSON.parse` (hoặc chuỗi thô khi JSON arguments hỏng), nên không có bigint, vòng tham chiếu
 * hay `undefined`.
 */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * Sắp xếp khoá SÂU của một giá trị JSON đã parse, để hai object arguments chỉ khác thứ tự thuộc
 * tính canonical hoá ra cùng một chuỗi.
 * Nhận: `value` — giá trị trong miền JSON (object/mảng lồng nhau tuỳ ý).
 * Trả: bản sao mới trong đó mọi object được dựng lại theo thứ tự khoá tăng dần; mảng giữ nguyên
 *      thứ tự phần tử; giá trị nguyên thuỷ trả lại chính nó.
 */
export function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value !== null && typeof value === "object") {
    const record: { [key: string]: JsonValue } = value;
    const sorted: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(record).sort()) {
      // `Object.keys` chỉ trả khoá có thật nên `record[key]` luôn tồn tại; `noUncheckedIndexedAccess`
      // không suy ra được điều đó ⇒ ép kiểu thuần kiểu, không đổi hành vi.
      // Gán bằng `=` (không phải defineProperty) giữ NGUYÊN ca lạ của bản gốc: khoá `__proto__`
      // đổi prototype của object kết quả thay vì thành thuộc tính riêng.
      sorted[key] = sortJsonValue(record[key] as JsonValue);
    }
    return sorted;
  }
  return value;
}

/**
 * Dạng chuỗi chuẩn tắc của arguments một lời gọi: sắp xếp khoá sâu rồi `JSON.stringify`.
 * Chuỗi này là khoá so sánh lặp (đi cùng tên tool) nên hai lời gọi chỉ khác thứ tự thuộc tính
 * phải ra đúng một chuỗi.
 * Nhận: `argumentsValue` — arguments đã parse của lời gọi (`exec.arguments` bên harness khai báo
 *        `unknown`, miền thật là output của `JSON.parse`).
 * Trả: chuỗi JSON một dòng, không khoảng trắng thừa, khoá đã sắp xếp tăng dần.
 * @throws {TypeError} khi giá trị nằm ngoài miền JSON (BigInt hoặc vòng tham chiếu) — thực tế
 *         không xảy ra vì mọi đường vào đều đã qua `JSON.parse`.
 */
export function canonicalize(argumentsValue: unknown): string {
  const canonical: string | undefined = JSON.stringify(sortJsonValue(argumentsValue as JsonValue));
  // `JSON.stringify` khai báo `string | undefined` (chỉ undefined với giá trị ngoài miền JSON);
  // đầu vào đã nằm trong miền JSON nên kết quả luôn là chuỗi — ép kiểu không đổi hành vi.
  return canonical as string;
}

/**
 * Biên dịch MỘT mẫu wildcard `*` thành RegExp neo hai đầu `^…$`.
 * Mọi ký tự meta regex (`| \ { } ( ) [ ] ^ $ + ? .`) được escape để khớp nguyên văn; chỉ `*`
 * được đổi thành `.*` (khớp mọi chuỗi con, kể cả rỗng). Nhờ escape hết meta nên mẫu nào cũng
 * biên dịch được — không có nhánh ném.
 * Nhận: `pattern` — mẫu tên tool, ví dụ `mcp_*`.
 * Trả: RegExp neo hai đầu, dùng lại được cho `pattern.test(toolName)`.
 */
export function wildcardToRegExp(pattern: string): RegExp {
  const escaped: string = pattern.replace(/[|\\{}()[\]^$+?.]/g, String.raw`\$&`);
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`);
}

/**
 * Cắt ĐẦU chuỗi canonical arguments để trích trong lời nhắc chi tiết, kèm ghi chú phần bị bỏ.
 * Chỉ giới hạn phần chữ hiện ra cho model — khoá chuỗi lặp luôn dùng chuỗi canonical ĐẦY ĐỦ.
 * Nhận: `canonical` — chuỗi canonical đầy đủ; `cap` — số ký tự tối đa được giữ (số nguyên >= 1).
 * Trả: nguyên `canonical` khi độ dài <= `cap`; ngược lại là `cap` ký tự đầu + hậu tố
 *      `… (+N more chars)` với N = số ký tự bị bỏ.
 */
export function previewArguments(canonical: string, cap: number): string {
  if (canonical.length <= cap) return canonical;
  return `${canonical.slice(0, cap)}… (+${canonical.length - cap} more chars)`;
}
