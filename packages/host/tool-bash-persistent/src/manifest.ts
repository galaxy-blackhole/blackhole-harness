/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguon DUY NHAT cua danh muc lat nguyen van + ten package cua goi THU VIEN tool-bash-persistent
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-tool-bash-persistent";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-tool-bash-persistent";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte), tính từ gốc repo. */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-tool-bash-persistent/lib/index.js";

/** Dòng đánh dấu lát nguyên văn (cũng là dấu mở phần giao kèo của mỗi lát). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS của mỗi lát. */
export const MODULE_TAIL = "export {};";

/**
 * Danh mục lát theo ĐÚNG thứ tự ghép. Bundle gốc là MỘT khối liền mạch (394 dòng, MỘT vùng
 * `//#region` mở ở dòng 6 và đóng ở dòng 393), nên chỉ cần MỘT lát — cắt thêm sẽ không còn nằm
 * trên ranh giới `^//#region` gần nhất (không có vùng thứ hai để cắt) và sẽ phải chèn dòng nối
 * KHÔNG có trong bản gốc, làm cổng BYTE lệch.
 */
export const PART_FILES: readonly string[] = ["part-00.ts"];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";
