/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nhận một lô tệp đính kèm hỗn hợp cho lệnh (ảnh + biên nhận tệp) rồi KHÔI PHỤC đúng thứ tự gửi ban đầu — chép nguyên thuật toán hai lượt của bản gốc.
 */

import { AttachmentError, admitEncodedImages } from "@deepseek-ai/dsh-attachment";
import type { AttachmentStore } from "@deepseek-ai/dsh-attachment";
import type { ImageAttachmentRef } from "@deepseek-ai/dsh-attachment";
import type {
  CommandAttachmentBlock,
  CommandFileAttachmentRef,
  CommandSubmitAttachment,
  EncodedImageAttachmentLike,
} from "./types.ts";

/**
 * Nhận một lô tệp đính kèm hỗn hợp của lệnh và KHÔI PHỤC thứ tự ảnh/tệp ban đầu.
 *
 * Hai lượt như bản gốc: lượt 1 giải MỌI biên nhận tệp (trùng biên nhận chỉ giải một lần)
 * và ném {@link AttachmentError} khi biên nhận không thuộc Session này; lượt 2 gom ảnh
 * theo thứ tự rồi giao `saveImages` của store; lượt 3 dựng block theo ĐÚNG thứ tự gửi.
 *
 * Nhận: `store` — store attachment của deployment; `attachments` — lô gửi kèm lệnh, theo
 * thứ tự; `resolveFileReceipt` — bộ giải biên nhận tệp do chủ upload của Session cài.
 * Trả: mảng block ĐÓNG BĂNG (ảnh dùng tham chiếu bền vững, tệp dùng tham chiếu đã giải).
 * @throws {AttachmentError} khi một biên nhận tệp không giải được, hoặc store từ chối lô ảnh.
 */
export async function admitCommandAttachments(
  store: AttachmentStore,
  attachments: readonly CommandSubmitAttachment[],
  resolveFileReceipt: (receiptId: string) => CommandFileAttachmentRef | undefined,
): Promise<readonly CommandAttachmentBlock[]> {
  const files = new Map<string, CommandFileAttachmentRef>();
  for (const attachment of attachments) {
    if (attachment.type !== "file" || files.has(attachment.receiptId)) continue;
    const file = resolveFileReceipt(attachment.receiptId);
    if (file === undefined) throw new AttachmentError("File upload receipt is unknown for this session.", "ATTACHMENT_NOT_FOUND");
    files.set(attachment.receiptId, file);
  }
  const images: EncodedImageAttachmentLike[] = [];
  for (const attachment of attachments) {
    if (attachment.type !== "image") continue;
    images.push({
      mediaType: attachment.mediaType,
      data: attachment.data,
      ...(attachment.name === undefined ? {} : { name: attachment.name }),
    });
  }
  const imageRefs = images.length === 0 ? [] : await admitEncodedImages(store, images);
  let imageIndex = 0;
  const blocks: CommandAttachmentBlock[] = [];
  for (const attachment of attachments) {
    if (attachment.type === "image") {
      // Không sinh mã lúc chạy: hợp đồng `saveImages` trả ĐÚNG một tham chiếu cho mỗi ảnh đã nhận.
      const ref = imageRefs[imageIndex] as ImageAttachmentRef;
      imageIndex += 1;
      blocks.push(Object.freeze({ type: "image", attachment: ref }));
      continue;
    }
    // Không sinh mã lúc chạy: lượt 1 đã giải MỌI biên nhận tệp hoặc đã ném.
    blocks.push(Object.freeze({ type: "file", attachment: files.get(attachment.receiptId) as CommandFileAttachmentRef }));
  }
  return Object.freeze(blocks);
}
