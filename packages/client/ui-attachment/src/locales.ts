/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ điển nhãn của row ui-attachment (en/zh), nội dung TRÙNG với locale/en.json + locale/zh.json mà gói ship
 *      theo (luật §000e của docs/recipes/HOST-ROW-REWRITE.md). Parity chữ phải do LOCALE quyết, không phải do
 *      fallback trong mã — nên nửa browser đăng ký hai bảng này vào service locale dưới khoá NS.
 */

/** Khoá từ điển — trùng tên gói để nhãn nằm cùng chỗ với bản gốc. */
export const NS = "ui-attachment";

/** Nhãn tiếng Anh (nguồn: locale/en.json). */
export const en: Record<string, unknown> = {
  "meta": {
    "title": "ui-attachment"
  },
  "dropTitle": "Drop files to attach",
  "dropDesc": "Images, documents, any file",
  "railGroup": "Attachments",
  "railScrollLeft": "Scroll left",
  "railScrollRight": "Scroll right",
  "cardRemove": "Remove",
  "cardRetry": "Retry",
  "imageAlt": "Attached image"
};

/** Nhãn tiếng Trung (nguồn: locale/zh.json). */
export const zh: Record<string, unknown> = {
  "meta": {
    "title": "ui-attachment"
  },
  "dropTitle": "拖放文件以添加附件",
  "dropDesc": "图片、文档、任意文件",
  "railGroup": "附件",
  "railScrollLeft": "向左滚动",
  "railScrollRight": "向右滚动",
  "cardRemove": "移除",
  "cardRetry": "重试",
  "imageAlt": "附件图片"
};
