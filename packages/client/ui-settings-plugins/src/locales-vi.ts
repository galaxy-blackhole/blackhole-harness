/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Từ điển tiếng Việt của @galaxy-blackhole/gbh-client-ui-settings-plugins — SINH TỰ ĐỘNG bởi
 *   tools/locale/gen-vi.ts từ gbh-locale-vi.json + gbh-locale-vi-manual.json. Không sửa tay.
 */
/**
 * Từ điển tiếng Việt của namespace "settings.plugins" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const vi: Readonly<Record<string, string>> = {
  "agentLoopDescription": "Cách agent điều phối các lệnh gọi công cụ.",
  "agentLoopMaxParallel": "Lệnh gọi công cụ song song",
  "agentLoopMaxParallelHint": "Giới hạn trên số lệnh gọi an toàn song song chạy cùng lúc trong một bước.",
  "agentLoopTitle": "Vòng lặp agent",
  "bashDescription": "Giới hạn mọi lệnh agent chạy.",
  "bashMaxOutputBytes": "Giới hạn đầu ra mỗi luồng (byte)",
  "bashMaxOutputBytesHint": "Phần đầu ra vượt ngưỡng được ghi ra tệp tạm thay vì bị mất.",
  "bashTimeoutMs": "Thời gian chờ lệnh (ms)",
  "bashTimeoutMsHint": "Thời gian tối đa một lệnh được chạy trước khi bị kết thúc.",
  "bashTitle": "Shell",
  "collapse": "Ẩn cài đặt",
  "configurableTab": "Cấu hình plugin",
  "discard": "Huỷ bỏ",
  "empty": "Triển khai này không cung cấp cài đặt plugin nào.",
  "expand": "Hiện cài đặt",
  "intro": "Cấu hình và kiểm tra các plugin đã cài trong triển khai này.",
  "invalidNumber": "Nhập một số, hoặc để trống để dùng mặc định.",
  "nav": "Plugin",
  "overridden": "Đã ghi đè",
  "readOnly": "Triển khai này lưu cài đặt ở chế độ chỉ đọc.",
  "reset": "Khôi phục mặc định",
  "save": "Lưu",
  "saveFailed": "Triển khai không chấp nhận các giá trị này; chúng được giữ nguyên để chỉnh lại.",
  "saving": "Đang lưu…",
  "subagentModelSelectionAllowed": "Model agent được chọn",
  "subagentModelSelectionChoose": "Khi bật, agent có thể chọn nhà cung cấp, model và mức suy luận cho từng subagent từ các model được phép bên dưới. Chỉ áp dụng cho phiên mới.",
  "subagentModelSelectionConflict": "Cài đặt đã thay đổi ở nơi khác. Huỷ bản nháp và thử lại.",
  "subagentModelSelectionDescription": "Kiểm soát những model agent được chọn cho subagent.",
  "subagentModelSelectionEmpty": "Hiện không nhà cung cấp nào công bố model.",
  "subagentModelSelectionLoadFailed": "Không tải được model.",
  "subagentModelSelectionLoading": "Đang tải model…",
  "subagentModelSelectionOff": "Subagent dùng mặc định đã cấu hình hoặc kế thừa model của agent cha. Các lựa chọn model đã lưu vẫn được giữ.",
  "subagentModelSelectionPartial": "Một số nhà cung cấp model không tải được; các lựa chọn đã lưu vẫn xoá được.",
  "subagentModelSelectionRequired": "Chọn ít nhất một model trước khi lưu.",
  "subagentModelSelectionRetry": "Thử lại",
  "subagentModelSelectionTitle": "Subagent",
  "subagentModelSelectionToggle": "Cho phép agent chọn model cho subagent",
  "subagentModelSelectionUnavailable": "Tạm thời không khả dụng",
  "subagentModelSelectionUnavailableGroup": "Đã lưu nhưng tạm thời không khả dụng",
  "tabs": "Chế độ xem plugin",
  "title": "Plugin",
  "unsaved": "Chưa lưu",
  "webSearchApiKey": "API key",
  "webSearchApiKeyHint": "Được lưu ngoài tệp cài đặt. Để trống để giữ API key hiện tại.",
  "webSearchApiKeySet": "Đã cấu hình API key.",
  "webSearchApiKeyUnset": "Chưa cấu hình API key; tìm kiếm không khả dụng cho đến khi có key.",
  "webSearchBaseUrl": "Endpoint",
  "webSearchBaseUrlHint": "Để trống để dùng mặc định của nhà cung cấp.",
  "webSearchDescription": "Nhà cung cấp tìm kiếm DeepSeek.",
  "webSearchMaxUses": "Số lần tìm kiếm tối đa mỗi yêu cầu",
  "webSearchMaxUsesHint": "Số lần một yêu cầu được tìm kiếm trước khi phải trả lời.",
  "webSearchTitle": "Tìm kiếm web",
};
