/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bảng định danh nửa client của row cot-translation — MỘT id: package của ta (id stock chỉ còn trong gbh.row.aliases)
 */

/** Tên package/id bundle DUY NHẤT được đăng ký (khớp manifest + rev HMR tra theo ownerId). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-cot-translation";

/** Tệp CSS của row — nguyên văn tên tệp của bản gốc (hash lớp giữ nguyên). */
export const CSS_FILE_NAME = "Translation.module.css";

/** Định danh thẻ <style> do bundle gắn: id CỦA TA + tên tệp gốc. */
export const CSS_TAG_ID = PACKAGE_NAME + "/" + CSS_FILE_NAME;
