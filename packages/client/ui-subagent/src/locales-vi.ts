/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Từ điển tiếng Việt của @galaxy-blackhole/gbh-client-ui-subagent — SINH TỰ ĐỘNG bởi
 *   tools/locale/gen-vi.ts từ gbh-locale-vi.json + gbh-locale-vi-manual.json. Không sửa tay.
 */
/**
 * Từ điển tiếng Việt của namespace "subagent" (nguồn: gbh-locale-vi.json + bản dịch tay gbh-locale-vi-manual.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const vi: Readonly<Record<string, string>> = {
  "activity.completed": "đã xong",
  "activity.inactive": "không chạy",
  "activity.running": "đang chạy",
  "branch.collapse": "Thu gọn các subagent cấp dưới của {label}",
  "branch.expand": "Mở rộng các subagent cấp dưới của {label}",
  "catalog.migrationRequired": "Cần chuyển đổi",
  "count.running.one": "{count} subagent đang chạy",
  "count.running.other": "{count} subagent đang chạy",
  "count.total.one": "{count} subagent",
  "count.total.other": "{count} subagent",
  "diagnostic.corrupt": "bản ghi phiên bị hỏng",
  "diagnostic.unavailable": "bản ghi phiên tạm thời không khả dụng",
  "diagnostic.unsupported": "phiên bản bản ghi subagent không được hỗ trợ",
  "duration.days": "{days}d",
  "duration.daysHours": "{days}d {hours}h",
  "duration.exactDays": "{days}d {hours}h {minutes}m {seconds}s",
  "duration.exactTitle": "Tổng thời gian hoạt động: {duration}",
  "duration.hours": "{hours}h {minutes}m {seconds}s",
  "duration.minutes": "{minutes}m {seconds}s",
  "duration.months": "~{months}mo",
  "duration.monthsDays": "~{months}mo {days}d",
  "duration.seconds": "{seconds}s",
  "duration.years": "~{years}y",
  "duration.yearsMonths": "~{years}y {months}mo",
  "load.error": "Không tải được subagent",
  "loading.aria": "Đang tải subagent",
  "loading.label": "Đang tải subagent…",
  "mode.continuable": "có thể tiếp tục",
  "mode.external": "Tác vụ ngoài",
  "mode.oneShot": "một lần",
  "mode.unknown": "chế độ không rõ",
  "open.sidebar": "Mở ở thanh bên",
  "open.sidebar.aria": "Mở {label} ở thanh bên",
  "readonly.body": "Phiên cha đã ngoại tuyến; hãy mở lại để tiếp tục gửi tin nhắn.",
  "readonly.oneShot.body": "Tác vụ một lần không nhận tin nhắn tiếp theo; xem toàn bộ bản ghi thực thi tại đây.",
  "readonly.oneShot.title": "Bản ghi subagent một lần",
  "readonly.title": "Subagent này hiện chỉ đọc",
  "readonly.unknown.body": "Đọc phiên con để biết có nối tiếp được hay không.",
  "retry": "Thử lại",
  "sidebar.chat": "Hội thoại",
  "switcher.aria": "Chuyển subagent: {title}",
  "tokens.million": "{value}M",
  "tokens.thousand": "{value}K",
  "tokens.total": "{value} tok",
  "tree.aria": "Phiên subagent",
};
