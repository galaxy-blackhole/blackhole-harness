/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nhom loi trinh phan tich bang tinh, khong phu thuoc ngon ngu
 */

/** Nhom loi trinh phan tich bang tinh. */
export class ExcelPreviewError extends Error {
  /** Ma loi on dinh ma nguoi doc co the hanh dong theo. */
  readonly code: string;

  /**
   * Dung mot loi trinh phan tich.
   * Nhan: code — ma loi; options — tuy chon cua Error.
   * Tra: instance mang code.
   */
  constructor(code: string, options?: ErrorOptions) {
    super(code, options);
    this.code = code;
    this.name = "ExcelPreviewError";
  }
}
