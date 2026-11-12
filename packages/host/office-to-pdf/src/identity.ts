/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Định danh nguồn và định danh do bộ chuyển đổi sở hữu, dùng để DÙNG CHUNG PDF đã chuyển — bản viết lại
 *      1:1 `OfficeSourceKey`/`OfficeToPdfGeneration`/`OfficeToPdfKey` của gói gốc.
 */

import { brandString } from "@deepseek-ai/dsh-brand";
import type { Branded } from "@deepseek-ai/dsh-brand";

/** Phạm vi thi hành đã cấp quyền + đường dẫn nguồn chuẩn tắc, do bên tiêu thụ mã hoá. */
export type OfficeSourceKey = Branded<"OfficeSourceKey">;

/** MỘT vòng đời provider, gồm engine, thiết lập render và cấu hình font. */
export type OfficeToPdfGeneration = Branded<"OfficeToPdfGeneration">;

/** Thế hệ provider + digest nội dung nguồn; bên tiêu thụ KHÔNG được phân tích nó. */
export type OfficeToPdfKey = Branded<"OfficeToPdfKey">;

/**
 * Gắn nhãn MỘT định vị nguồn đã cấp quyền để khử trùng trước khi đọc.
 * Nhận: mã hoá không nhập nhằng của phạm vi cấp quyền, thế giới thi hành, và đường dẫn chuẩn tắc.
 * Trả: định vị nguồn đã gắn nhãn; việc cấp quyền nguồn vẫn là trách nhiệm của bên gọi.
 */
export function OfficeSourceKey(key: string): OfficeSourceKey {
  return brandString<OfficeSourceKey>(key);
}

/**
 * Gắn nhãn MỘT vòng đời provider.
 * Nhận: giá trị duy nhất do provider tạo.
 * Trả: thế hệ bộ chuyển đổi đã gắn nhãn.
 */
export function OfficeToPdfGeneration(value: string): OfficeToPdfGeneration {
  return brandString<OfficeToPdfGeneration>(value);
}

/**
 * Gắn nhãn MỘT định danh nội dung do bộ chuyển đổi sở hữu.
 * Nhận: thế hệ + định danh nội dung do provider tạo.
 * Trả: định danh chuyển đổi đã gắn nhãn.
 */
export function OfficeToPdfKey(value: string): OfficeToPdfKey {
  return brandString<OfficeToPdfKey>(value);
}
