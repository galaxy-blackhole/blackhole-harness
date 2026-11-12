/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nửa HOST của row office-to-pdf: chuyển tài liệu Office sang PDF qua kit LibreOffice, có hàng đợi theo thế
 *      hệ, hạn mức đọc/ghi, kiểm PDF đầu ra và dọn thư mục tạm. Nguồn đối chiếu: README.md (G4).
 */

export { OfficeToPdfError } from "./errors.ts";
export { OfficeSourceKey, OfficeToPdfGeneration, OfficeToPdfKey } from "./identity.ts";
export { Config, OfficeToPdf } from "./service.ts";
export { OfficeToPdf as default } from "./service.ts";
export type * from "./types.ts";
