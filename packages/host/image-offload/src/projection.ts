/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khai báo chọn ảnh BỀN an toàn cho cả browser + định nghĩa replay THUẦN TÚY — bản viết lại trung
 *      thành của `imageOffloadProjection` trong gói gốc (subpath `./projection`).
 */

import { offloadMessageImages } from "./project-message.ts";
import type { MessageLike, MessageProjectionLike, ProjectionContextLike, SessionEventLike, SessionSeq } from "./types.ts";

/**
 * Một giá trị bền có phải vật thể JSON (không mảng, không null) không.
 * Nhận: giá trị bất kỳ đọc từ thân sự kiện.
 * Trả: `true` khi là vật thể JSON.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Một chỉ số lần xuất hiện / số thứ tự có phải dạng CHUẨN không.
 * Nhận: giá trị bất kỳ đọc từ thân sự kiện.
 * Trả: `true` khi là số nguyên an toàn, không âm, và không phải `-0` (JSON không phân biệt được `-0`).
 */
function isIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

/**
 * Thông điệp gốc của một sự kiện ĐẦU VÀO: `user/message` mang thông điệp ngay ở `data`,
 * còn `tool/result` mang nó ở `data.message`.
 * Nhận: sự kiện đã xác nhận là `user/message` hoặc `tool/result`.
 * Trả: thông điệp trước quyết định này.
 */
function sourceMessage(source: SessionEventLike): MessageLike {
  if (source.type === "user/message") return source.data as MessageLike;
  return (source.data as { readonly message: MessageLike }).message;
}

/** Kiểm và dựng lại các thông điệp mà một quyết định `image/offload` thay đổi. */
export const imageOffloadProjection: MessageProjectionLike<"image/offload"> = {
  type: "image/offload",

  /**
   * Áp TRỌN một quyết định bền lên lịch sử đã cho: kiểm hết rồi mới dựng, nên quyết định hỏng KHÔNG đổi gì.
   * Nhận: sự kiện `image/offload` ứng viên và ngữ cảnh lịch sử trước nó.
   * Trả: các thông điệp đã đổi, khoá theo số thứ tự gốc của chúng.
   * @throws khi thân sự kiện sai hình dạng, khi một đích không phải nút mặt hiện tại, khi trùng `seq`,
   *         khi chỉ số không tăng nghiêm ngặt, hoặc khi một ảnh đã chọn đã được đẩy từ trước.
   */
  project(event, context: ProjectionContextLike) {
    const data = event.data;
    if (!isRecord(data) || Object.keys(data).length !== 1 || !Array.isArray(data["targets"]) || data["targets"].length === 0) {
      throw new Error("image/offload: data must contain a nonempty targets array");
    }
    const messages = new Map<SessionSeq, MessageLike>();
    const nodes = new Set(context.nodes);
    for (const target of data["targets"] as unknown[]) {
      if (!isRecord(target)) throw new Error("image/offload: each target must contain a seq and nonempty imageIndexes");
      const rawSeq = target["seq"];
      const rawIndexes = target["imageIndexes"];
      if (Object.keys(target).length !== 2 || !isIndex(rawSeq) || !Array.isArray(rawIndexes) || rawIndexes.length === 0) {
        throw new Error("image/offload: each target must contain a seq and nonempty imageIndexes");
      }
      const seq = rawSeq;
      if (messages.has(seq)) throw new Error(`image/offload: duplicate target seq ${seq}`);
      if (!nodes.has(seq)) throw new Error(`image/offload: target seq ${seq} is not a current surface node`);
      const source = context.events[seq - context.baseSeq];
      if (source === undefined || (source.type !== "user/message" && source.type !== "tool/result")) {
        throw new Error(`image/offload: target seq ${seq} must be user/message or tool/result`);
      }
      let previous = -1;
      for (const index of rawIndexes as unknown[]) {
        if (!isIndex(index) || index <= previous) {
          throw new Error("image/offload: imageIndexes must be strictly increasing non-negative safe integers");
        }
        previous = index;
      }
      const message = context.messages.get(seq) ?? sourceMessage(source);
      messages.set(seq, offloadMessageImages(message, rawIndexes as number[]));
    }
    return messages;
  },
};
