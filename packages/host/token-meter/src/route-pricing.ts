/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Định giá bề mặt theo PHÓNG CHIẾU YÊU CẦU: thay ước lượng block đính kèm bằng biểu diễn ảnh và tệp
 *      thực sự gửi tới model của tuyến — bản viết lại 1:1 vùng `lib/types/route-pricing.js` (dòng 598–666)
 *      của `@deepseek-ai/dsh-token-meter`, kèm ba hàm phụ trợ `usageTokens`, `optionalHeaderEquals`,
 *      `validateConfigKeys` (vùng `lib/types/index.js`, dòng 673–685).
 */

import type { ContentBlock, ImageBlock, LlmImageRequestPricing, TokenUsage } from "@deepseek-ai/dsh-llm";
import { headerEquals, type EpochHeader, type SessionSeq } from "@galaxy-blackhole/gbh-session";

import { estimateContent } from "./estimate.ts";
import type { TokenMeterConfig, TokenSurfaceNode } from "./types.ts";

/** Tham chiếu đính kèm TỆP, trích từ block nội dung loại `file`. */
type FileAttachmentRef = Extract<ContentBlock, { type: "file" }>["attachment"];

/**
 * MỘT node bề mặt đã định giá, kèm các lần xuất hiện ẢNH mà giá tuyến sẽ thay thế.
 * Nhận: không (đây là kiểu dữ liệu).
 * Trả: không (đây là kiểu dữ liệu).
 * Ghi chú nguồn: gói gốc import kiểu này từ `./surface-fold.ts`; ở bản port, `surface-fold.ts` do một tệp
 * khác cung cấp nên tệp này khai quan hệ CẤU TRÚC y hệt để tsc xanh độc lập — khi `surface-fold.ts` có mặt,
 * thay khối này bằng `import type { MeterSurfaceNode } from "./surface-fold.ts"`.
 */
export interface MeterSurfaceNode {
  /** Số thứ tự bền của sự kiện bề mặt. */
  readonly seq: SessionSeq;
  /** Giá theo ước lượng CỐ ĐỊNH của đúng tin nhắn ở node này. */
  readonly heuristicTokens: number;
  /** Giá cấu trúc JSON bị thay khi yêu cầu của tuyến phóng chiếu ảnh. */
  readonly imageStructuralTokens: number;
  /** Giá cấu trúc JSON bị thay khi lắp ráp yêu cầu phóng chiếu tệp thành văn bản. */
  readonly fileStructuralTokens: number;
  /** Các block ảnh bền theo thứ tự tin nhắn, GỒM dấu `offloaded`; rỗng với node không có ảnh. */
  readonly images: readonly ImageBlock[];
  /** Các lần xuất hiện TỆP bền theo thứ tự tin nhắn; rỗng với node không có tệp. */
  readonly files: readonly FileAttachmentRef[];
}

/** MỘT bề mặt đã định giá cho một tuyến yêu cầu: các node công khai + tổng của chúng. */
export interface PricedSurface {
  /** Các node theo vị trí, mang CẢ giá tuyến lẫn giá ước lượng cố định. */
  readonly nodes: TokenSurfaceNode[];
  /** Tổng các giá tuyến trên bề mặt. */
  readonly surfaceTokens: number;
}

/**
 * Định giá MỘT bề mặt có thứ tự dưới phóng chiếu đính kèm của yêu cầu model.
 * Nhận: các node bề mặt hiện tại hoặc đã chụp theo thứ tự model nhìn thấy; giá ảnh của tuyến (hoặc
 *        `undefined` để giữ ước lượng cố định); hàm phóng chiếu handle tệp thành văn bản mà dịch vụ LLM đã
 *        mount dùng.
 * Trả: các node công khai ĐÃ TÁCH RỜI và tổng đã định giá theo tuyến.
 * Ném: khi giá tuyến trả số giá KHÁC số lần xuất hiện đã hỏi — lệch hàng sẽ định giá sai im lặng nên phải nổ.
 */
export function priceSurface(
  nodes: readonly MeterSurfaceNode[],
  pricing: LlmImageRequestPricing | undefined,
  fileText?: (ref: FileAttachmentRef) => string,
): PricedSurface {
  const images = pricing === undefined ? [] : nodes.flatMap((node) => node.images);
  const hasFiles = fileText !== undefined && nodes.some((node) => node.files.length > 0);
  if ((pricing === undefined || images.length === 0) && !hasFiles) {
    let surfaceTokens = 0;
    return {
      nodes: nodes.map((node) => {
        surfaceTokens += node.heuristicTokens;
        return { seq: node.seq, tokens: node.heuristicTokens, heuristicTokens: node.heuristicTokens };
      }),
      surfaceTokens,
    };
  }
  const prices = pricing === undefined ? [] : pricing.priceImages(images);
  if (pricing !== undefined && prices.length !== images.length) {
    throw new Error(
      `token meter: route image pricing answered ${prices.length} prices for ${images.length} occurrences`,
    );
  }
  let cursor = 0;
  let surfaceTokens = 0;
  return {
    nodes: nodes.map((node) => {
      let tokens = node.heuristicTokens;
      if (fileText !== undefined && node.files.length > 0) {
        tokens -= node.fileStructuralTokens;
        for (const file of node.files) tokens += estimateContent([{ type: "text", text: fileText(file) }]);
      }
      if (pricing !== undefined && node.images.length > 0) {
        tokens -= node.imageStructuralTokens;
        for (let occurrence = 0; occurrence < node.images.length; occurrence += 1) {
          // Bằng số lần xuất hiện đã kiểm ở trên, nên chỉ số này luôn có giá — giữ đúng `!` của nguồn gốc.
          const price = prices[cursor]!;
          cursor += 1;
          tokens += price.visualTokens + estimateContent([{ type: "text", text: price.text }]);
        }
      }
      surfaceTokens += tokens;
      return { seq: node.seq, tokens, heuristicTokens: node.heuristicTokens };
    }),
    surfaceTokens,
  };
}

/**
 * Cộng các rổ usage RỜI NHAU của provider mà KHÔNG đếm đôi đầu ra reasoning.
 * Nhận: usage của provider (đầu vào, đầu ra, và các bộ nhớ đệm có thể vắng).
 * Trả: tổng token đã dùng = inputTokens + cacheReadTokens + cacheWriteTokens + outputTokens.
 */
export function usageTokens(usage: TokenUsage): number {
  return usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + usage.outputTokens;
}

/**
 * So hai phong bì CÓ THỂ VẮNG để ước lượng không-header vẫn theo được delta bề mặt về sau.
 * Nhận: phong bì cần so (trái, phải); mỗi bên có thể `undefined`.
 * Trả: `true` khi hai bên cùng vắng, hoặc cùng có và bằng nhau theo `headerEquals`; ngược lại `false`.
 */
export function optionalHeaderEquals(left: EpochHeader | undefined, right: EpochHeader | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return headerEquals(left, right);
}

/**
 * Từ chối khoá CŨ hoặc gõ sai TRƯỚC khi giá trị mặc định che mất chúng.
 * Nhận: cấu hình token-meter (bộ ước lượng cố định không hỗ trợ thiết lập nào).
 * Trả: không trả gì khi cấu hình rỗng; ném lỗi ở khoá ĐẦU TIÊN gặp được.
 */
export function validateConfigKeys(config: TokenMeterConfig): void {
  for (const key of Object.keys(config)) {
    throw new Error(`TokenMeterConfig: unknown key "${key}" (no settings are supported)`);
  }
}
