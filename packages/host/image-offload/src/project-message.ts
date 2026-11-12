/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Áp các lần xuất hiện ảnh đã chọn thành khối "đã đẩy" BẤT BIẾN — bản viết lại trung thành
 *      của `offloadMessageImages` trong gói gốc.
 */

import { deepFreeze } from "./freeze.ts";
import type { ContentBlockLike, MessageLike } from "./types.ts";

/**
 * Chiếu các lần xuất hiện ảnh đã chọn thành khối đã đẩy (bất biến, giữ nguyên danh tính thông điệp).
 * Nhận: thông điệp trước quyết định này, và các chỉ số ảnh 0-based TĂNG NGHIÊM NGẶT (không rỗng).
 * Trả: thông điệp MỚI đã đóng băng sâu, cùng mọi trường khác, với đúng các ảnh đã chọn được đánh dấu.
 *       Thông điệp không có ảnh nào được chọn thì trả NGUYÊN mảng `content` cũ (không cấp phát thừa).
 * @throws khi một lần xuất hiện đã chọn không tồn tại, hoặc đã được đẩy từ trước.
 */
export function offloadMessageImages<M extends MessageLike>(message: M, indexes: readonly number[]): M {
  let imageIndex = 0;
  let selected = 0;
  const visit = (blocks: readonly ContentBlockLike[]): readonly ContentBlockLike[] => {
    let next: ContentBlockLike[] | undefined;
    for (const [index, block] of blocks.entries()) {
      let projected = block;
      if (block.type === "image") {
        if (imageIndex === indexes[selected]) {
          if (block.offloaded === true) throw new Error(`image/offload: image index ${imageIndex} is already offloaded`);
          projected = {
            ...block,
            offloaded: true,
          };
          selected += 1;
        }
        imageIndex += 1;
      }
      if (projected !== block) next ??= blocks.slice(0, index);
      next?.push(projected);
    }
    return next ?? blocks;
  };
  const content = visit(message.content);
  if (selected !== indexes.length) throw new Error(`image/offload: image index ${indexes[selected]} does not exist`);
  return deepFreeze({ ...message, content }) as M;
}
