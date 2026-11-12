/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nhãn vị trí sự kiện Session (SessionSeq) — hàm đồng nhất, khai tại chỗ thay vì nhận peer `dsh-session` ngoài bảng §3b.
 */

/** Nhãn danh tính kiểu SỐ của vị trí sự kiện — cùng vai trò với `Branded<B>` của `dsh-brand`, khai tại chỗ. */
declare const seqBrand: unique symbol;

/** Vị trí một sự kiện đã ghi trong log Session. */
export type SessionSeq = number & { readonly [seqBrand]: "SessionSeq" };

/**
 * Nhận một số là vị trí sự kiện Session ĐÃ CÓ.
 * Nhận: `value` — số nguyên an toàn không âm đã được thao tác log sở hữu kiểm.
 * Trả: chính số đó, mang nhãn Session-seq; KHÔNG kiểm tra gì (đúng như bản gốc).
 */
export function SessionSeq(value: number): SessionSeq {
  return value as SessionSeq;
}
