/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chọn các lần xuất hiện ảnh CŨ NHẤT còn giữ trong request model hiện tại rồi ghi MỘT quyết
 *      định `image/offload` bền — bản viết lại trung thành của `offloadOldestImages` trong gói gốc.
 */

import type { ImageOffloadTarget, SessionLike, SessionSeq } from "./types.ts";

/**
 * Ghi một quyết định bỏ qua các lần xuất hiện ảnh ĐẦU-VÀO cũ nhất còn giữ.
 * Nhận: phiên mà request kế tiếp sẽ áp quyết định; sự kiện đầu vào theo đúng thứ tự request đã hỏng;
 *       số lần xuất hiện CÒN GIỮ mà adapter cần bỏ thêm.
 * Trả: `true` khi đã ghi một sự kiện `image/offload`; `false` khi KHÔNG còn lần xuất hiện nào để đẩy
 *       (khi đó KHÔNG ghi gì — tầng trên phải chuyển tiếp lỗi).
 *       Nút assistant KHÔNG được xét (nó mang đầu ra của model, không phải đầu vào).
 *       Chỉ số ảnh đếm MỌI lần xuất hiện trong từng thông điệp, kể cả ảnh đã đẩy từ trước.
 */
export function offloadOldestImages(session: SessionLike, sourceEventSeqs: readonly SessionSeq[], count: number): boolean {
  let remaining = count;
  const targets: ImageOffloadTarget[] = [];
  for (const seq of sourceEventSeqs) {
    if (remaining === 0) break;
    const event = session.eventAt(seq);
    if (event.type !== "user/message" && event.type !== "tool/result") continue;
    const message = session.deriveEventMessage(event);
    const imageIndexes: number[] = [];
    let imageIndex = 0;
    const visit = (blocks: readonly { readonly type: string; readonly offloaded?: boolean }[]): void => {
      for (const block of blocks) {
        if (remaining === 0) break;
        if (block.type === "image") {
          if (block.offloaded !== true) {
            imageIndexes.push(imageIndex);
            remaining -= 1;
          }
          imageIndex += 1;
        }
      }
    };
    visit(message.content);
    if (imageIndexes.length > 0) {
      targets.push({
        seq,
        imageIndexes,
      });
    }
  }
  if (targets.length === 0) return false;
  session.append("image/offload", { targets });
  return true;
}
