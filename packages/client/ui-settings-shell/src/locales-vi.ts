/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Từ điển tiếng Việt của @galaxy-blackhole/gbh-client-ui-settings-shell — SINH TỰ ĐỘNG bởi
 *   tools/locale/gen-vi.ts từ gbh-locale-vi.json + gbh-locale-vi-manual.json. Không sửa tay.
 */
/**
 * Từ điển tiếng Việt của namespace "settings.shell" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const vi: Readonly<Record<string, string>> = {
  "description": "Giới hạn thời gian chạy và lượng kết quả của mỗi lệnh.",
  "invalidNumber": "Nhập một số, hoặc để trống để dùng mặc định.",
  "maxOutputBytes": "Giới hạn kết quả mỗi luồng (byte)",
  "maxOutputBytesHint": "Kết quả vượt mức này được ghi ra tệp tạm thay vì bị mất.",
  "overridden": "Đã bị ghi đè",
  "readOnly": "Bản triển khai này lưu cài đặt ở chế độ chỉ đọc.",
  "reset": "Khôi phục mặc định",
  "save": "Lưu",
  "saveFailed": "Bản triển khai không nhận các giá trị này; chúng được giữ lại để bạn sửa.",
  "saving": "Đang lưu…",
  "timeoutMs": "Thời gian chờ mỗi lệnh (ms)",
  "timeoutMsHint": "Một lệnh được chạy bao lâu trước khi bị kết thúc.",
  "title": "Shell",
  "unavailable": "Plugin này chưa được nạp nên hiện không cấu hình được.",
};
