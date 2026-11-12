/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bộ ước lượng token theo MẬT ĐỘ CỐ ĐỊNH dùng chung cho service và projection breakdown — bản
 *      viết lại 1:1 entry `./estimate` của `@deepseek-ai/dsh-token-meter`.
 */

import type { ContentBlock, Message } from "@deepseek-ai/dsh-llm";
import type { EpochHeader } from "@galaxy-blackhole/gbh-session";

/** Ước lượng mật độ văn bản cố định, dùng tới khi cần token hoá chính xác. */
export const CHARS_PER_TOKEN = 4;

/** Phần thừa cấu trúc cho mỗi block (khung JSON + nhãn loại). */
export const BLOCK_OVERHEAD = 4;

/** Phần thừa khung trường `role` cộng cho MỌI tin nhắn đã định giá. */
export const ROLE_OVERHEAD = 4;

/**
 * Giá cấu trúc JSON của MỘT block nằm ngoài các nhánh định giá có kiểu: ước lượng cố định cho block được
 * merge mở rộng và cho tham chiếu ảnh (giá yêu cầu của ảnh thuộc tuyến, không cố định). Dấu offload ảnh
 * KHÔNG đổi ước lượng chỉ-tham-chiếu này; giá tuyến sở hữu placeholders của chúng.
 * Nhận: block cần định giá (không sửa).
 * Trả: token ước lượng cho cấu trúc JSON của block.
 */
export function estimateStructuralBlock(block: ContentBlock): number {
  if (block.type === "image") {
    const { offloaded: _offloaded, ...reference } = block;
    return BLOCK_OVERHEAD + Math.ceil(JSON.stringify(reference).length / CHARS_PER_TOKEN);
  }
  return BLOCK_OVERHEAD + Math.ceil(JSON.stringify(block).length / CHARS_PER_TOKEN);
}

/**
 * Định giá các block nội dung ĐỆ QUY dưới ước lượng mật độ cố định.
 * Nhận: các block nội dung cần định giá (không sửa).
 * Trả: token ước lượng, đã gồm phần thừa cấu trúc mỗi block.
 */
export function estimateContent(blocks: readonly ContentBlock[]): number {
  let tokens = 0;
  for (const block of blocks) {
    switch (block.type) {
      case "text":
      case "reasoning":
        tokens += Math.ceil(block.text.length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD;
        break;
      case "tool-call":
        tokens +=
          Math.ceil(block.name.length / CHARS_PER_TOKEN) +
          Math.ceil(block.arguments.length / CHARS_PER_TOKEN) +
          BLOCK_OVERHEAD;
        break;
      default:
        tokens += estimateStructuralBlock(block);
    }
  }
  return tokens;
}

/**
 * Định giá câu lệnh hệ thống đã render: văn bản của node bề mặt `system/message`. Adapter serialize câu lệnh
 * thành CHUỖI thuần — tin nhắn vai system hoặc trường `system` của yêu cầu — chứ không phải block nội dung có
 * kiểu, nên giá là mật độ văn bản + khung vai, KHÔNG có phần thừa mỗi block.
 * Nhận: tin nhắn vai system cần định giá (không sửa).
 * Trả: token ước lượng cho câu lệnh hệ thống; 0 khi nội dung rỗng ("không có câu lệnh hệ thống").
 */
export function estimateSystemMessage(message: Message): number {
  if (message.content.length === 0) return 0;
  let characters = 0;
  for (const block of message.content) {
    characters += block.type === "text" ? block.text.length : JSON.stringify(block).length;
  }
  return Math.ceil(characters / CHARS_PER_TOKEN) + ROLE_OVERHEAD;
}

/**
 * Ước lượng token cho MỘT tin nhắn mà model nhìn thấy.
 * Nhận: tin nhắn cần định giá (không sửa).
 * Trả: token nội dung + khung vai; tin nhắn vai system định giá như {@link estimateSystemMessage}.
 */
export function estimateMessage(message: Message): number {
  if (message.role === "system") return estimateSystemMessage(message);
  return estimateContent(message.content) + ROLE_OVERHEAD;
}

/**
 * Định giá phần LƯỢC ĐỒ CÔNG CỤ của phong bì yêu cầu chuẩn tắc — trường DUY NHẤT của phong bì được định giá,
 * vì câu lệnh hệ thống là một node bề mặt.
 * Nhận: phong bì chuẩn tắc, hoặc `undefined` trước yêu cầu đầu tiên.
 * Trả: token ước lượng cho lược đồ công cụ; 0 khi vắng hoặc rỗng.
 */
export function estimateToolsTokens(header: EpochHeader | undefined): number {
  if (header?.tools === undefined || header.tools.length === 0) return 0;
  return Math.ceil(JSON.stringify(header.tools).length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD;
}
