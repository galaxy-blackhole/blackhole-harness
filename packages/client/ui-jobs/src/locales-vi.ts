/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Từ điển tiếng Việt của @galaxy-blackhole/gbh-client-ui-jobs — SINH TỰ ĐỘNG bởi
 *   tools/locale/gen-vi.ts từ gbh-locale-vi.json + gbh-locale-vi-manual.json. Không sửa tay.
 */
/**
 * Từ điển tiếng Việt của namespace "job" (nguồn: gbh-locale-vi.json + bản dịch tay gbh-locale-vi-manual.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const vi: Readonly<Record<string, string>> = {
  "count.idle.one": "{count} tác vụ nền",
  "count.idle.other": "{count} tác vụ nền",
  "count.live.one": "{count} tác vụ nền đang chạy",
  "count.live.other": "{count} tác vụ nền đang chạy",
  "duration.hours": "{hours} giờ {minutes} phút",
  "duration.minutes": "{minutes} phút {seconds} giây",
  "duration.seconds": "{seconds} giây",
  "duration.title.done": "Mất {duration}",
  "duration.title.live": "Đã chạy {duration}",
  "kill.confirm": "Bấm lần nữa để xác nhận",
  "kill.confirmAction": "Xác nhận dừng",
  "kill.failed": "Dừng không thành công",
  "kill.stop": "Dừng tác vụ {label}",
  "list.aria": "Tác vụ nền",
  "output.error": "luồng kết quả trực tiếp bị ngắt: {error}",
  "output.gap": "… đã bỏ phần kết quả trước đó …",
  "row.collapseAria": "Ẩn kết quả trực tiếp của {label}",
  "row.expandAria": "Hiện kết quả trực tiếp của {label}",
  "section.clear": "Xoá",
  "section.live": "Đang chạy",
  "section.settledCount": "Đã xong {count}",
  "status.completed": "hoàn thành",
  "status.failed": "thất bại",
  "status.killed": "đã huỷ",
  "status.running": "đang chạy",
  "status.stopping": "đang dừng",
  "terminal.collapse": "Thu gọn",
  "terminal.collapseAria": "Thu gọn kết quả",
  "terminal.commandLine": "Dòng lệnh {n}",
  "terminal.copied": "Đã sao chép",
  "terminal.copy": "Sao chép",
  "terminal.done": "xong",
  "terminal.exitCode": "mã thoát {code}",
  "terminal.expand": "Hiện thêm {n} dòng",
  "terminal.expandAria": "Mở rộng {n} dòng kết quả đang thu gọn",
  "terminal.failed": "thất bại",
  "terminal.noExitCode": "không có mã thoát",
  "terminal.noOutput": "(không có kết quả)",
  "terminal.running": "đang chạy",
  "terminal.signal": "tín hiệu {signal}",
};
