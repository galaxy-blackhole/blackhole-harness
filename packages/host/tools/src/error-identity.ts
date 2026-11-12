/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Nhận diện lớp lỗi theo TÊN, bền với mọi bản sao module của cùng một lớp — dùng ở biên
 *      runtime nơi một lớp peer (`@deepseek-ai/dsh-llm`) có thể được import qua hai bản sao.
 */

/**
 * Nhận diện một lớp lỗi theo TÊN, bền với MỌI bản sao module của lớp đó.
 * Vì sao (01/11/2026): `HarnessError` được import qua peer `@deepseek-ai/dsh-llm`; trong test specifier
 * đó phân giải về MỘT BẢN SAO khác kernel nên `instanceof` trượt và `error.info` biến mất khỏi kết quả
 * tool. Lớp gốc đặt `name` theo tên lớp CON, nên phép so tên trực tiếp không đủ: phải dò tên lớp trên
 * chuỗi prototype, đúng ngữ nghĩa `instanceof` xuyên bản sao.
 * Nhận: error — giá trị bắt được; name — tên lớp cần khớp.
 * Trả: true khi chuỗi prototype của lỗi chứa một lớp mang đúng tên đó.
 */
export function isNamedError(error: unknown, name: string): boolean {
  try {
    if (!(error instanceof Error)) return false;
    for (let proto: object | null = Object.getPrototypeOf(error); proto !== null; proto = Object.getPrototypeOf(proto)) {
      const ctor = (proto as { constructor?: { name?: string } }).constructor;
      if (typeof ctor === "function" && ctor.name === name) return true;
    }
    return false;
  } catch {
    return false;
  }
}
