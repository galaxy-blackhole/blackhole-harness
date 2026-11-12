/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Từ điển tiếng Việt của @galaxy-blackhole/gbh-client-ui-settings-subagent — SINH TỰ ĐỘNG bởi
 *   tools/locale/gen-vi.ts từ gbh-locale-vi.json + gbh-locale-vi-manual.json. Không sửa tay.
 */
/**
 * Từ điển tiếng Việt của namespace "settings.subagent" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const vi: Readonly<Record<string, string>> = {
  "overridden": "Đã bị ghi đè",
  "readOnly": "Bản triển khai này lưu cài đặt ở chế độ chỉ đọc.",
  "reset": "Khôi phục mặc định",
  "save": "Lưu",
  "saveFailed": "Bản triển khai không nhận các giá trị này; chúng được giữ lại để bạn sửa.",
  "saving": "Đang lưu…",
  "subagentCapacityHelp": "Tổng số Subagent đang sống dưới cùng một Agent chính, trên mọi tầng đệ quy. Agent chính không tính. Yêu cầu khởi chạy mới bị từ chối khi chạm giới hạn.",
  "subagentCapacityHelpLabel": "Về giới hạn song song của Subagent",
  "subagentCapacityInvalid": "Nhập một số nguyên từ 1 trở lên.",
  "subagentDepthHelp": "Giới hạn số tầng Subagent mà một Agent có thể tạo.",
  "subagentDepthHelpLabel": "Về độ sâu đệ quy tối đa",
  "subagentDepthInvalid": "Nhập một số nguyên từ 0 trở lên.",
  "subagentDepthOne": "Chỉ Agent chính được tạo Subagent",
  "subagentDepthOverride": "Nếu một công cụ tự định nghĩa độ sâu đệ quy tối đa thì giá trị của công cụ đó được ưu tiên.",
  "subagentDepthZero": "Tắt Subagent",
  "subagentDescription": "Đặt độ sâu đệ quy, số lượng, và model cho Subagent.",
  "subagentLimitsTitle": "Giới hạn",
  "subagentMaxActive": "Giới hạn số Subagent chạy song song",
  "subagentMaxDepth": "Độ sâu đệ quy tối đa",
  "subagentModelSelectionAllowed": "Model mà agent được chọn",
  "subagentModelSelectionChoose": "Khi bật, agent được chọn provider, model, và mức suy luận cho từng Subagent trong số model được phép dưới đây. Chỉ áp dụng cho phiên mới.",
  "subagentModelSelectionConflict": "Cài đặt đã thay đổi ở nơi khác. Hãy bỏ bản nháp và thử lại.",
  "subagentModelSelectionEmpty": "Hiện không provider nào công bố model.",
  "subagentModelSelectionLoadFailed": "Không tải được model.",
  "subagentModelSelectionLoading": "Đang tải model…",
  "subagentModelSelectionOff": "Subagent dùng mặc định đã cấu hình hoặc theo model của agent cha. Các lựa chọn model đã lưu vẫn được giữ.",
  "subagentModelSelectionPartial": "Một số provider không tải được; các lựa chọn đã lưu vẫn gỡ được.",
  "subagentModelSelectionRequired": "Chọn ít nhất một model trước khi lưu.",
  "subagentModelSelectionRetry": "Thử lại",
  "subagentModelSelectionTitle": "Chọn model",
  "subagentModelSelectionToggle": "Cho phép agent chọn model cho Subagent",
  "subagentModelSelectionUnavailable": "Hiện không dùng được",
  "subagentModelSelectionUnavailableGroup": "Đã lưu nhưng hiện không dùng được",
  "subagentTitle": "Subagent",
  "unavailable": "Plugin này chưa được nạp nên hiện không cấu hình được.",
};
