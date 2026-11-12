/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ba hàm THUẦN của row working-directory — chốt thư mục dự phòng tuyệt đối, chữ ngữ cảnh model,
 *      và câu thông báo đổi/khôi phục thư mục — cộng schema trạng thái của chiếu `workingDirectory`.
 */

import { isAbsolute } from "node:path";
import { z as zod } from "zod/v4";
import type { DirectoryStateSchema } from "./seams.ts";

/**
 * Schema trạng thái của chiếu `workingDirectory`, ĐÚNG biểu thức của bản gốc: chuỗi khác rỗng,
 * tuyệt đối, hoặc `null` (chưa ghi nhận). Sổ chiếu chỉ gọi `.parse` trước khi mồi phép gộp.
 */
export const directoryStateSchema: DirectoryStateSchema = zod.string().min(1).refine(isAbsolute).nullable();

/**
 * Chốt thư mục dự phòng của deployment: thế giới thi hành chỉ nhận đường dẫn tuyệt đối.
 * Nhận: đường dẫn ứng viên (`config.defaultDirectory`, hoặc thư mục khởi động khi vắng).
 * Trả: chính đường dẫn đó khi tuyệt đối; ném lỗi khi là tương đối.
 */
export function assertAbsoluteDefault(directory: string): string {
  if (!isAbsolute(directory)) throw new Error("working-directory: defaultDirectory must be absolute");
  return directory;
}

/**
 * Chữ ngữ cảnh model cho MỘT thư mục — nguyên văn của bản gốc.
 * Nhận: thư mục tuyệt đối.
 * Trả: `Current working directory: "<path>".` với đường dẫn được JSON-quote.
 */
export function renderContextText(directory: string): string {
  return `Current working directory: ${JSON.stringify(directory)}.`;
}

/**
 * Câu thông báo ngữ cảnh khi thư mục vừa đổi, hoặc vừa được khôi phục — nguyên văn của bản gốc.
 * Nhận: thư mục trước, thư mục sau, và cờ "khôi phục vì thư mục cũ biến mất".
 * Trả: một câu chữ Anh; hai vế khác nhau theo cờ khôi phục, cả hai đường dẫn đều JSON-quote.
 */
export function renderNoticeText(previous: string, directory: string, recovered: boolean): string {
  return recovered
    ? `The working directory ${JSON.stringify(previous)} is unavailable. The working directory is now ${JSON.stringify(directory)}.`
    : `The working directory changed from ${JSON.stringify(previous)} to ${JSON.stringify(directory)}.`;
}
