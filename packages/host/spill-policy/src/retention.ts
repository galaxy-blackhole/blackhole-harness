/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Giữ hai ĐẦU của nội dung có thứ tự: chữ thì cắt được, ảnh thì phải nguyên chiếc — mỗi đầu nhận
 *      nửa ngân sách, và trả về đúng số byte UTF-8 cùng số ảnh đã bị bỏ.
 */

import type { ContentBlock } from "@galaxy-blackhole/gbh-llm";

/** Khối nội dung mà chính sách giữ được: chữ cắt được, ảnh phải nguyên chiếc. */
export type RetainableBlock = Extract<ContentBlock, { type: "text" | "image" }>;

/** Hai đầu đã giữ và số lượng CHÍNH XÁC bị loại khỏi chuỗi ban đầu. */
export interface RetainedContent {
  /** Các khối giữ được ở đầu, đúng thứ tự gốc. */
  head: RetainableBlock[];
  /** Các khối giữ được ở cuối, đúng thứ tự gốc. */
  tail: RetainableBlock[];
  /** Số byte UTF-8 của chữ đã bỏ. */
  omittedBytes: number;
  /** Số ảnh nguyên chiếc đã bỏ. */
  omittedImages: number;
}

/**
 * Cắt một đoạn chữ theo số đơn vị UTF-16 mà KHÔNG tách đôi cặp surrogate.
 * Nhận: chữ gốc, độ dài muốn giữ, và cờ lấy từ CUỐI thay vì từ đầu.
 * Trả: đoạn chữ đã cắt (dài hơn/ngắn hơn `length` đúng một đơn vị khi điểm cắt rơi vào giữa cặp surrogate).
 */
function textSlice(text: string, length: number, tail: boolean): string {
  let cut = tail ? text.length - length : length;
  const previous = text.charCodeAt(cut - 1);
  const current = text.charCodeAt(cut);
  if (previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff) cut += tail ? 1 : -1;
  return tail ? text.slice(cut) : text.slice(0, cut);
}

/**
 * Tìm đoạn chữ LIỀN MẠCH dài nhất ở một đầu mà vẫn nằm trong ngân sách (giá phải đơn điệu theo độ dài).
 * Nhận: chữ gốc, ngân sách token còn lại, cờ lấy từ cuối, và hàm định giá một khối.
 * Trả: đoạn chữ dài nhất vừa ngân sách ở đầu tương ứng.
 */
function fitText(text: string, budget: number, tail: boolean, price: (block: RetainableBlock) => number): string {
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = textSlice(text, middle, tail);
    if (candidate.length === 0 || price({ type: "text", text: candidate }) <= budget) low = middle;
    else high = middle - 1;
  }
  return textSlice(text, low, tail);
}

/**
 * Giữ hai đầu liền mạch mà KHÔNG dịch chỗ và KHÔNG giữ một phần ảnh.
 * Mỗi đầu nhận một nửa ngân sách; chỗ trống ở một ảnh không chia được thì để trống.
 * Giá của chữ phải đơn điệu theo độ dài được giữ.
 * Nhận: các khối chữ/ảnh có thứ tự với tổng giá vượt ngân sách, ngân sách token sau khi chừa thông báo,
 * và hàm định giá một khối đã giữ (kể cả phần khung của nó).
 * Trả: hai đầu đã giữ, cùng số byte UTF-8 của chữ và số ảnh nguyên chiếc đã bỏ.
 */
export function retainContent(
  content: readonly RetainableBlock[],
  budget: number,
  price: (block: RetainableBlock) => number,
): RetainedContent {
  const head: RetainableBlock[] = [];
  const tail: RetainableBlock[] = [];
  let first = 0;
  let last = content.length - 1;
  let headCharacters = 0;
  let remaining = Math.ceil(budget / 2);
  while (first <= last) {
    const block = content[first];
    if (block === undefined) break;
    const cost = price(block);
    if (cost <= remaining) {
      head.push(block);
      remaining -= cost;
      first++;
      continue;
    }
    if (block.type === "text") {
      const text = fitText(block.text, remaining, false, price);
      headCharacters = text.length;
      if (text.length > 0) head.push({ type: "text", text });
    }
    break;
  }
  remaining = Math.floor(budget / 2);
  while (last >= first) {
    const original = content[last];
    if (original === undefined) break;
    const block: RetainableBlock =
      last === first && original.type === "text" ? { type: "text", text: original.text.slice(headCharacters) } : original;
    const cost = price(block);
    if (cost <= remaining) {
      tail.push(block);
      remaining -= cost;
      last--;
      continue;
    }
    if (block.type === "text") {
      const text = fitText(block.text, remaining, true, price);
      if (text.length > 0) tail.push({ type: "text", text });
    }
    break;
  }
  tail.reverse();
  const bytesOf = (blocks: readonly RetainableBlock[]): number =>
    blocks.reduce((total, block) => total + (block.type === "text" ? Buffer.byteLength(block.text, "utf8") : 0), 0);
  const imagesOf = (blocks: readonly RetainableBlock[]): number => blocks.filter((block) => block.type === "image").length;
  return {
    head,
    tail,
    omittedBytes: bytesOf(content) - bytesOf(head) - bytesOf(tail),
    omittedImages: imagesOf(content) - imagesOf(head) - imagesOf(tail),
  };
}
