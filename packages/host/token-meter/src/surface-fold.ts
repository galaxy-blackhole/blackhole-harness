/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Định giá THEO VỊ TRÍ cho phép đo: mỗi node còn giữ danh tính, giá ước lượng cố định và chi tiết đính
 *      kèm mà giá tuyến sẽ thay thế — bản viết lại 1:1 `lib/types/surface-fold.js` (dòng 497–597) của
 *      `@deepseek-ai/dsh-token-meter`. Phép gộp là cặp plan/commit: `planSurfaceTokens` chạy MỌI bước có
 *      thể ném ở chế độ CHỈ ĐỌC, `commitSurfaceTokens` mới sửa tại chỗ, nên một lần ném để trạng thái của
 *      nơi gọi nguyên vẹn và cùng một sự kiện hỏng vẫn hỏng y hệt ở mọi lần phát lại.
 */

import type { ContentBlock, ImageBlock, Message } from "@deepseek-ai/dsh-llm";
import { deriveEventMessage } from "@galaxy-blackhole/gbh-session";
import type { SessionSeq, SurfaceEvent } from "@galaxy-blackhole/gbh-session";

import { estimateMessage, estimateStructuralBlock } from "./estimate.ts";

/** Tham chiếu đính kèm TỆP, trích từ block nội dung loại `file`. */
type FileAttachmentRef = Extract<ContentBlock, { type: "file" }>["attachment"];

/** MỘT node bề mặt đã định giá, kèm các lần xuất hiện ẢNH mà giá tuyến sẽ thay thế. */
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

/** MỘT chuyển tiếp bề mặt đã kiểm nhưng CHƯA sửa bề mặt đã định giá. */
export interface SurfaceTokenPlan<Node = MeterSurfaceNode> {
  /** Giá ước lượng của đúng tin nhắn của sự kiện; 0 khi sự kiện không dựng tin nhắn nào. */
  readonly tokens: number;
  /** Thay đổi CÓ DẤU của tổng bề mặt: `tokens` trừ đi phần bị che. */
  readonly deltaTokens: number;
  /** Node đã định giá mà lần commit sẽ chèn cho sự kiện này. */
  readonly node: Node;
  /** Vị trí commit: `append`, hoặc khoảng chỉ số (tính cả hai đầu) bị thay thế. */
  readonly target:
    | "append"
    | {
        readonly startIdx: number;
        readonly endIdx: number;
      };
}

/**
 * Gom các lần xuất hiện đính kèm ĐÃ PHÓNG CHIẾU và giá cấu trúc của chúng.
 * Nhận: các block nội dung của tin nhắn (không sửa); mảng ảnh và mảng tệp ĐÍCH để ghi vào (sửa tại chỗ).
 * Trả: token cấu trúc của ảnh và của tệp, cộng dồn theo thứ tự block.
 */
export function collectProjectedAttachments(
  blocks: readonly ContentBlock[],
  images: ImageBlock[],
  files: FileAttachmentRef[],
): { imageTokens: number; fileTokens: number } {
  let imageTokens = 0;
  let fileTokens = 0;
  for (const block of blocks) {
    if (block.type === "image") {
      images.push(block);
      imageTokens += estimateStructuralBlock(block);
    } else if (block.type === "file") {
      files.push(block.attachment);
      fileTokens += estimateStructuralBlock(block);
    }
  }
  return { imageTokens, fileTokens };
}

/**
 * Dựng MỘT node đã định giá từ tin nhắn suy ra của một sự kiện bề mặt.
 * Nhận: seq bền của sự kiện bề mặt, và tin nhắn suy ra (`null` khi sự kiện không dựng tin nhắn nào).
 * Trả: node với giá ước lượng, hai giá cấu trúc đính kèm và các lần xuất hiện ảnh/tệp.
 */
export function analyzeNode(seq: SessionSeq, message: Message | null): MeterSurfaceNode {
  if (message === null) {
    return {
      seq,
      heuristicTokens: 0,
      imageStructuralTokens: 0,
      fileStructuralTokens: 0,
      images: [],
      files: [],
    };
  }
  const heuristicTokens = estimateMessage(message);
  const images: ImageBlock[] = [];
  const files: FileAttachmentRef[] = [];
  const structural = collectProjectedAttachments(message.content, images, files);
  return {
    seq,
    heuristicTokens,
    imageStructuralTokens: structural.imageTokens,
    fileStructuralTokens: structural.fileTokens,
    images,
    files,
  };
}

/**
 * Kiểm và định giá MỘT sự kiện bề mặt mà KHÔNG sửa bề mặt.
 * Nhận: `nodes` — bề mặt đã định giá đứng trước sự kiện này, theo thứ tự model nhìn thấy; `event` — sự
 *        kiện bề mặt cần đặt vào.
 * Trả: kế hoạch dành cho {@link commitSurfaceTokens}.
 * Ném: khi một lần thay thế nêu khoảng KHÔNG có trong `nodes` — log đã cam kết được kiểm bề mặt lúc nối,
 *       nên một khoảng không giải được là log hỏng và phải nổ to thay vì bỏ qua sự kiện.
 */
export function planSurfaceTokens(
  nodes: readonly Pick<MeterSurfaceNode, "seq" | "heuristicTokens">[],
  event: SurfaceEvent,
): SurfaceTokenPlan {
  // `analyzeNode` nhan `Message` cua @deepseek-ai/dsh-llm; ban port dung kieu cua gbh-llm => ep MOT cho tai bien.
  const node = analyzeNode(event.seq, deriveEventMessage(event) as unknown as Parameters<typeof analyzeNode>[1]);
  const tokens = node.heuristicTokens;
  const op = event.surfaceOp;
  if (op === "append") {
    return { tokens, deltaTokens: tokens, node, target: "append" };
  }
  const startIdx = nodes.findIndex((candidate) => candidate.seq === op.startSeq);
  const endIdx = nodes.findIndex((candidate) => candidate.seq === op.endSeq);
  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
    throw new Error(
      `token surface: replace at seq ${event.seq} has invalid current range ${op.startSeq}-${op.endSeq}`,
    );
  }
  const removed = nodes.slice(startIdx, endIdx + 1).reduce((total, candidate) => total + candidate.heuristicTokens, 0);
  return { tokens, deltaTokens: tokens - removed, node, target: { startIdx, endIdx } };
}

/**
 * Áp MỘT kế hoạch đã kiểm lên bề mặt đã định giá, TẠI CHỖ; không bao giờ ném, nên không thể để lại bề mặt
 * đã áp dở dang.
 * Nhận: `nodes` — đúng bề mặt đã định giá mà kế hoạch được dựng trên đó; `plan` — chuyển tiếp do
 *        {@link planSurfaceTokens} trả về.
 * Trả: không (sửa `nodes` tại chỗ).
 */
export function commitSurfaceTokens<Node>(nodes: Node[], plan: SurfaceTokenPlan<Node>): void {
  if (plan.target === "append") {
    nodes.push(plan.node);
    return;
  }
  nodes.splice(plan.target.startIdx, plan.target.endIdx - plan.target.startIdx + 1, plan.node);
}
