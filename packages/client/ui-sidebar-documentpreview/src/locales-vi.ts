/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Từ điển tiếng Việt của @galaxy-blackhole/gbh-client-ui-sidebar-documentpreview — SINH TỰ ĐỘNG bởi
 *   tools/locale/gen-vi.ts từ gbh-locale-vi.json + gbh-locale-vi-manual.json. Không sửa tay.
 *   11/11/2026: đổi thương hiệu DSH → GBH trong chuỗi tiếng Việt hiển thị cho người dùng
 */
/**
 * Từ điển tiếng Việt của namespace "sidebarDocumentPreview" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const vi: Readonly<Record<string, string>> = {
  "autoRefresh": "Tự động làm mới",
  "autoRefresh.disable": "Tắt tự động làm mới",
  "autoRefresh.enable": "Bật tự động làm mới",
  "changed": "Tệp đã thay đổi, đang hiện nội dung trước đó.",
  "error.notFound": "Không tìm thấy tệp. Có thể tệp đã bị di chuyển hoặc xoá.",
  "error.notRegularFile": "Không phải tệp thông thường, không có gì để hiển thị.",
  "error.notText": "Không phải tệp văn bản, tạm thời không xem trước được.",
  "error.tooLarge": "Trang này vượt quá giới hạn {limit} nên không đọc được.",
  "error.unavailable": "Đọc thất bại: {message}",
  "loadMore": "Tải thêm",
  "loading": "Đang đọc…",
  "openWith": "Mở bằng",
  "reload": "Đọc lại tệp",
  "reloadNow": "Tải lại",
  "rendererUnavailable": "Không xem trước được {name}.",
  "resourceUnavailable": "Dịch vụ tài nguyên tệp không khả dụng.",
  "retry": "Thử lại",
  "unsupportedFile": "Chưa xem trước được loại tệp này.",
  "viewer.text": "Văn bản thuần",
  "wrap.aria": "Ngắt dòng",
  "wrap.disable": "Tắt ngắt dòng",
  "wrap.enable": "Bật ngắt dòng",
};

/**
 * Từ điển tiếng Việt của namespace "sidebarOffice" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const viOffice: Readonly<Record<string, string>> = {
  "busy": "Bản xem trước Office đang bận. Hãy thử lại sau.",
  "changed": "Tệp đã thay đổi trong lúc đọc. Hãy mở lại bản xem trước.",
  "closeDetails": "Đóng chi tiết phông",
  "failed": "Chuyển đổi Office không tạo ra PDF dùng được. Kiểm tra tệp rồi thử lại.",
  "invalid": "Không xem trước được tệp Office này. Có thể tệp bị hỏng, có mật khẩu, hoặc sai phần mở rộng.",
  "loading": "Đang hiển thị tài liệu...",
  "missingFontsCount": "Phông: {count}",
  "missingFontsDescription": "Những phông này không có cho bản xem trước. Chữ và bố cục có thể khác tài liệu gốc.",
  "missingFontsTitle": "Phông bị thiếu",
  "retry": "Thử lại",
  "timeout": "Chuyển đổi Office quá thời gian. Hãy thử lại.",
  "title": "Tài liệu Office",
  "tooLarge": "Tệp Office hoặc PDF đã chuyển vượt giới hạn xem trước. Hãy giảm kích thước tệp hoặc chỉnh lại cấu hình xem trước.",
  "unavailable": "Bản xem trước Office không dùng được. Hãy bật dịch vụ xem trước tài liệu trên máy đang chạy GBH.",
  "viewMissingFonts": "Thiếu phông: {count}. Bấm để xem.",
};

/**
 * Từ điển tiếng Việt của namespace "sidebarExcel" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const viExcel: Readonly<Record<string, string>> = {
  "charts": "biểu đồ",
  "conditionalFormatting": "định dạng có điều kiện",
  "encoding": "Không đọc được bảng mã này. Hãy lưu tệp dạng UTF-8 hoặc UTF-16 kèm BOM rồi thử lại.",
  "featureSeparator": ", ",
  "formulaWarning": "Sổ làm việc này có công thức. Kết quả hiện ra có thể thiếu hoặc không chính xác.",
  "images": "hình ảnh",
  "invalid": "Không mở được bảng tính này. Hãy kiểm tra định dạng, nội dung, hoặc mật khẩu bảo vệ.",
  "language": "en",
  "loading": "Đang hiển thị tài liệu...",
  "retry": "Thử lại",
  "shapes": "hình vẽ",
  "timeout": "Mở sổ làm việc này quá thời gian. Hãy thử tệp nhỏ hơn.",
  "title": "Bảng tính",
  "tooLarge": "Sổ làm việc này vượt giới hạn xem trước.",
  "unsupportedNotice": "Bản xem trước không hỗ trợ {features} trong sổ làm việc này. Hãy mở bằng ứng dụng hệ thống để có đầy đủ.",
};

/**
 * Từ điển tiếng Việt của namespace "documentMarkdown" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const viMarkdown: Readonly<Record<string, string>> = {
  "code.copied": "Đã sao chép",
  "code.copy": "Sao chép",
  "footnotes": "Chú thích",
  "viewer.label": "Markdown",
};

/**
 * Từ điển tiếng Việt của namespace "documentHtml" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const viHtml: Readonly<Record<string, string>> = {
  "failed": "Không xem trước được tài liệu HTML này.",
  "frame": "Xem trước tài liệu HTML",
  "loading": "Đang chuẩn bị xem trước HTML…",
  "title": "HTML",
};

/**
 * Từ điển tiếng Việt của namespace "sidebarImage" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const viImage: Readonly<Record<string, string>> = {
  "failed": "Không hiển thị được hình ảnh này.",
  "loading": "Đang mở hình ảnh…",
  "preview": "Xem trước hình ảnh: {name}",
  "title": "Hình ảnh",
  "unsupported": "Xem trước hình ảnh cần nội dung đầy đủ của tệp.",
  "zoomControls": "Điều khiển thu phóng",
  "zoomFitWidth": "Vừa chiều rộng",
  "zoomIn": "Phóng to",
  "zoomMenu": "Chọn mức thu phóng",
  "zoomOut": "Thu nhỏ",
  "zoomValue": "{percent}%",
};

/**
 * Từ điển tiếng Việt của namespace "sidebarPdf" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const viPdf: Readonly<Record<string, string>> = {
  "failed": "Không hiển thị được PDF: {message}",
  "loading": "Đang mở PDF…",
  "pageImage": "Trang {page} của PDF",
  "password": "PDF này cần mật khẩu; chưa hỗ trợ xem trước tệp có mật khẩu.",
  "rendering": "Đang dựng trang…",
  "retry": "Thử lại",
  "title": "PDF",
  "unsupported": "Xem trước PDF cần nội dung đầy đủ của tệp.",
  "workerFailed": "Tiến trình dựng PDF không thể tiếp tục. Vui lòng thử lại.",
  "zoomControls": "Điều khiển thu phóng",
  "zoomFitWidth": "Vừa chiều rộng",
  "zoomIn": "Phóng to",
  "zoomMenu": "Chọn mức thu phóng",
  "zoomOut": "Thu nhỏ",
  "zoomValue": "{percent}%",
};

/**
 * Từ điển tiếng Việt của namespace "sidebarCodePreview" (nguồn: gbh-locale-vi.json).
 * Nhận: không.
 * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.
 */
export const viCode: Readonly<Record<string, string>> = {
  "copied": "Đã sao chép",
  "copy": "Sao chép",
  "title": "Mã",
};
