/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Từ điển tiếng Việt của @galaxy-blackhole/gbh-client-ui-sidebar-browser — SINH TỰ ĐỘNG bởi
 *   tools/locale/gen-vi.ts từ gbh-locale-vi.json + gbh-locale-vi-manual.json. Không sửa tay.
 *   11/11/2026: đổi thương hiệu DSH → GBH trong chuỗi tiếng Việt hiển thị cho người dùng
 */
/**
 * Từ điển tiếng Việt của namespace "sidebarBrowser" (nguồn: gbh-locale-vi.json + bản dịch tay gbh-locale-vi-manual.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const vi: Readonly<Record<string, string>> = {
  "address.changed": "URL đã thay đổi",
  "address.placeholder": "Nhập địa chỉ HTTP(S)",
  "address.unknown": "Trang đã điều hướng; carrier này không đọc được URL mới.",
  "back": "Quay lại",
  "error.application-origin": "Trình duyệt nhúng không mở được chính ứng dụng GBH.",
  "error.credentials": "Địa chỉ không được chứa tên người dùng hay mật khẩu.",
  "error.empty": "Hãy nhập địa chỉ.",
  "error.invalid": "Địa chỉ đó không hợp lệ hoặc quá dài.",
  "error.protocol": "Chỉ hỗ trợ địa chỉ HTTP và HTTPS; dùng Xem trước tài liệu cho tệp cục bộ.",
  "external": "Mở bằng trình duyệt hệ thống",
  "forward": "Tiến tới",
  "go": "Đi",
  "guide.description": "Duyệt trang web",
  "guide.title": "Trình duyệt",
  "load.failed": "Không tải được trang; hãy tải lại hoặc mở bằng trình duyệt hệ thống.",
  "load.failed.detail": "Tải trang thất bại ({code}): {description}",
  "loading": "Đang mở…",
  "reload": "Tải lại",
  "restore.action": "Khôi phục trang",
  "restore.previous": "Đã mở trước đó",
  "sandbox.disable": "Tắt giới hạn sandbox",
  "sandbox.enable": "Khôi phục giới hạn sandbox",
  "sandbox.warning": "Giới hạn sandbox đang tắt; trang có thể điều hướng cả ứng dụng và dùng tải xuống, hộp thoại và khoá nhập liệu.",
  "shortcut.noSession": "Hãy mở một phiên trước",
  "start": "Nhập địa chỉ HTTP(S) để bắt đầu duyệt",
  "type.label": "Trình duyệt",
};
