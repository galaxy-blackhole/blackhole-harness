/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng SỰ KIỆN ĐỔI của dạng dữ liệu miền: mỗi lượt ghi bền phát ĐÚNG MỘT `domain/changed` SAU khi
 *      backend xác nhận bền, mang ảnh chụp MỚI và dấu phép toán — KHÔNG BAO GIỜ mang giá trị cũ (bản gốc:
 *      lib/types/events.d.ts).
 */

/** Các trường vị trí DÙNG CHUNG của một lượt đổi bền. */
export interface DomainChangedBase {
  /** Tên miền sở hữu. */
  readonly domain: string;
  /** Tên bảng; `''` cho lượt ghi ô singleton toàn cục. */
  readonly table: string;
  /** Khoá bản ghi; `''` cho lượt ghi ô singleton toàn cục. */
  readonly key: string;
}

/** Một bản ghi (hoặc ô singleton toàn cục) đã được chèn/ghi đè. */
export interface DomainChangedPut extends DomainChangedBase {
  /** Dấu phép toán: ghi. */
  readonly operation: "put";
  /** Ảnh chụp MỚI. */
  readonly value: unknown;
}

/** Một bản ghi đã bị xoá; bia mộ KHÔNG mang giá trị. */
export interface DomainChangedDeleted extends DomainChangedBase {
  /** Dấu phép toán: xoá. */
  readonly operation: "deleted";
  /** Luôn vắng: bia mộ không mang giá trị. */
  readonly value?: never;
}

/** Một lượt đổi của miền; hợp nhất ĐÓNG — switch trên `operation`. */
export type DomainChanged = DomainChangedPut | DomainChangedDeleted;

declare module "@deepseek-ai/cordis" {
  interface Events {
    /**
     * Một bản ghi hoặc ô singleton toàn cục của miền đã đổi, phát ĐÚNG MỘT lần cho mỗi lượt ghi và
     * CHẮC CHẮN sau khi backend xác nhận bền. Sự kiện của một miền tới theo đúng thứ tự chuỗi ghi.
     * @param change - miền, bảng (`''` cho global), khoá (`''` cho global), dấu phép toán, và với
     * `put` là ảnh chụp mới.
     * @mode emit
     */
    "domain/changed"(change: DomainChanged): void;
  }
}
