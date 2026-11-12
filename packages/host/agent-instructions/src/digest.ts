/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nhận diện nội dung để chống trùng chỉ dẫn workspace — port 1:1 vùng digest
 *      (stock lib/index.js 90–115 = region lib/types/digest.js) của @deepseek-ai/dsh-agent-instructions.
 */
import { createHash } from "node:crypto";

/**
 * Tính định danh nội dung dùng xuyên suốt việc nạp chỉ dẫn và trạng thái phiên.
 * Nhận: content — văn bản chỉ dẫn UTF-8 CHÍNH XÁC.
 * Trả: digest SHA-1 dạng thập lục phân, chữ thường (stock lib/index.js:101–103).
 */
export function instructionContentSha1(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

/**
 * Tính định danh KHÔNG phân biệt khoảng trắng, dùng để gộp trùng trong một thư mục.
 * Khoảng trắng đầu/cuối được trim trước khi băm, nhờ vậy một tệp anh em được symlink hoặc sao chép
 * byte chỉ khác khoảng trắng bao ngoài vẫn gộp về MỘT tệp được kết xuất.
 * Nhận: content — văn bản chỉ dẫn UTF-8 CHÍNH XÁC.
 * Trả: digest SHA-1 của nội dung đã trim (stock lib/index.js:112–114).
 */
export function trimmedInstructionDigest(content: string): string {
  return instructionContentSha1(content.trim());
}
