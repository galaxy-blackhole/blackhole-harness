/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Từ điển tiếng Việt của @galaxy-blackhole/gbh-client-ui-sidebar-terminal — SINH TỰ ĐỘNG bởi
 *   tools/locale/gen-vi.ts từ gbh-locale-vi.json + gbh-locale-vi-manual.json. Không sửa tay.
 */
/**
 * Từ điển tiếng Việt của namespace "sidebarTerminal" (nguồn: gbh-locale-vi.json + bản dịch tay gbh-locale-vi-manual.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const vi: Readonly<Record<string, string>> = {
  "attachmentEnded": "Kết nối terminal đã kết thúc. Hãy kết nối lại để tiếp tục.",
  "cleanupFailed": "Không kết thúc được terminal “{title}”: {message}",
  "closed": "Terminal đã đóng.",
  "connecting": "Đang kết nối…",
  "control": "Nhận quyền điều khiển",
  "creating": "Đang khởi động…",
  "description": "Chạy lệnh trong workspace",
  "disconnected": "Đã ngắt kết nối.",
  "exited": "Tiến trình đã thoát ({code})",
  "failed": "Lỗi terminal: {message}",
  "inputFull": "Bộ đệm nhập đã đầy. Hãy kết nối lại rồi thử lại.",
  "invalidOutput": "Không nhận được màn hình terminal. Hãy kết nối lại để khôi phục.",
  "loading": "Đang đọc môi trường terminal…",
  "missingTerminal": "Terminal này không còn tồn tại. Hãy mở terminal mới.",
  "new": "Terminal mới",
  "readonly": "Chế độ xem này chỉ đọc.",
  "reconnect": "Kết nối lại",
  "recoveryFailed": "Khôi phục terminal thất bại: {message}",
  "rename": "Tên terminal",
  "retry": "Thử lại",
  "retryRecovery": "Thử khôi phục terminal lại",
  "shell": "Chọn shell",
  "shellEmpty": "Không có shell nào",
  "shellLoading": "Đang tải danh sách shell…",
  "shortcut.noSession": "Hãy chọn một phiên trước",
  "terminalLimit": "Đã đạt giới hạn terminal. Hãy đóng các terminal không dùng rồi thử lại. Terminal đã thoát cũng được tính vào giới hạn.",
  "title": "Terminal",
  "unavailable": "Không khả dụng",
};
