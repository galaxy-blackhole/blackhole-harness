/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Danh tinh yeu cau cho mot lan goi tai khoan: phien ban ban dung, ngon ngu dang dung va lech mui gio
 */

/** Danh tinh ma moi phuong thuc tai khoan cua Remote mang theo. */
export interface AccountClientMetadata {
  /** Phien ban ban dung. */
  readonly version: string;
  /** Ngon ngu giao dien dang dung. */
  readonly locale: string;
  /** Lech mui gio tinh bang giay. */
  readonly timezoneOffsetSeconds: number;
}

/**
 * Dung danh tinh yeu cau cho mot lan goi tai khoan.
 * @param locale - ngon ngu giao dien dang dung; Host se rut gon thanh locale tren duong truyen.
 * @param version - phien ban ban dung do bundle nhung san.
 * @returns danh tinh ma cac phuong thuc tai khoan cua Remote mang theo.
 * @throws Error khi ban dung khong mang phien ban, thay vi bao mot phien ban rong.
 */
export function accountClientMetadata(locale: string, version: string | undefined): AccountClientMetadata {
  if (version === undefined || version === "") throw new Error("account: this client build carries no DSH_CLIENT_VERSION");
  return { version, locale, timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 };
}
