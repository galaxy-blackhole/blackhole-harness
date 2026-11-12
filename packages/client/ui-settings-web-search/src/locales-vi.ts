/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Từ điển tiếng Việt của @galaxy-blackhole/gbh-client-ui-settings-web-search — SINH TỰ ĐỘNG bởi
 *   tools/locale/gen-vi.ts từ gbh-locale-vi.json + gbh-locale-vi-manual.json. Không sửa tay.
 */
/**
 * Từ điển tiếng Việt của namespace "settings.webSearch" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const vi: Readonly<Record<string, string>> = {
  "apiKey": "Khoá API",
  "apiKeyHint": "Được lưu ngoài tệp cài đặt. Để trống nếu muốn giữ khoá hiện tại.",
  "apiKeySet": "Đã cấu hình khoá.",
  "apiKeyUnset": "Chưa cấu hình khoá; chỉ những hội thoại dùng model có tài khoản mới tìm kiếm được, qua điểm cuối mặc định.",
  "baseUrl": "Điểm cuối",
  "baseUrlHint": "Để trống để dùng mặc định của nhà cung cấp.",
  "description": "Thiết lập nhà cung cấp tìm kiếm.",
  "invalidNumber": "Nhập một số, hoặc để trống để dùng mặc định.",
  "maxUses": "Số lần tìm tối đa mỗi yêu cầu",
  "maxUsesHint": "Một yêu cầu được tìm bao nhiêu lần trước khi phải trả lời.",
  "overridden": "Đã bị ghi đè",
  "readOnly": "Bản triển khai này lưu cài đặt ở chế độ chỉ đọc.",
  "reset": "Khôi phục mặc định",
  "save": "Lưu",
  "saveFailed": "Bản triển khai không nhận các giá trị này; chúng được giữ lại để bạn sửa.",
  "saving": "Đang lưu…",
  "title": "Tìm kiếm web",
  "unavailable": "Plugin này chưa được nạp nên hiện không cấu hình được.",
};
