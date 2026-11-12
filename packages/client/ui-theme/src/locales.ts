/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tu dien cua row ui-theme — TRICH NGUYEN VAN tu bundle goc (dong 1463-1512)
 */

/** Tu dien tieng Trung — nguyen van ban goc. */
export const zh = {
			"appearance.title": "外观",
			"appearance.light": "浅色",
			"appearance.dark": "深色",
			"appearance.system": "跟随系统",
			"fontSize.text.title": "字号大小",
			"fontSize.text.description": "仅影响会话内容的字号",
			"fontSize.text.increase": "增大字号",
			"fontSize.text.decrease": "减小字号",
			"fontSize.code.title": "代码字号",
			"fontSize.code.description": "用于代码块、行内代码与工具输出",
			"fontSize.code.increase": "增大代码字号",
			"fontSize.code.decrease": "减小代码字号",
			"fontSize.terminal.title": "终端字号",
			"fontSize.terminal.description": "用于侧栏终端",
			"fontSize.terminal.increase": "增大终端字号",
			"fontSize.terminal.decrease": "减小终端字号",
			"fontSize.unit": "px",
			"fontFamily.text.title": "正文字体",
			"fontFamily.text.description": "用于界面与会话正文。多个字体用逗号分隔，留空使用默认字体",
			"fontFamily.code.title": "代码字体",
			"fontFamily.code.description": "用于代码块、行内代码与工具输出。多个字体用逗号分隔，留空使用默认字体",
			"fontFamily.terminal.title": "终端字体",
			"fontFamily.terminal.description": "用于侧栏终端。多个字体用逗号分隔，留空使用默认字体",
			"fontFamily.placeholder": "默认",
			"fontSize.more": "更多字体设置"
} as const;

/** Tu dien tieng Anh — nguyen van ban goc. */
export const en = {
			"appearance.title": "Appearance",
			"appearance.light": "Light",
			"appearance.dark": "Dark",
			"appearance.system": "System",
			"fontSize.text.title": "Font size",
			"fontSize.text.description": "Only affects conversation content",
			"fontSize.text.increase": "Increase font size",
			"fontSize.text.decrease": "Decrease font size",
			"fontSize.code.title": "Code font size",
			"fontSize.code.description": "Used for code blocks, inline code, and tool output",
			"fontSize.code.increase": "Increase code font size",
			"fontSize.code.decrease": "Decrease code font size",
			"fontSize.terminal.title": "Terminal font size",
			"fontSize.terminal.description": "Used for the sidebar terminal",
			"fontSize.terminal.increase": "Increase terminal font size",
			"fontSize.terminal.decrease": "Decrease terminal font size",
			"fontSize.unit": "px",
			"fontFamily.text.title": "Text font",
			"fontFamily.text.description": "Used for the interface and conversation text. Separate fonts with commas; leave empty for the default",
			"fontFamily.code.title": "Code font",
			"fontFamily.code.description": "Used for code blocks, inline code, and tool output. Separate fonts with commas; leave empty for the default",
			"fontFamily.terminal.title": "Terminal font",
			"fontFamily.terminal.description": "Used for the sidebar terminal. Separate fonts with commas; leave empty for the default",
			"fontFamily.placeholder": "Default",
			"fontSize.more": "More font settings"
} as const;

/**
 * Từ điển tiếng Việt — NGUYÊN VĂN 29 khoá đang chạy (chép từ bảng tập trung của
 * packages/client/locale/src/locales-vi.ts TRƯỚC khi gỡ, phase 2 task-2).
 * Gồm cả 4 khoá mà zh/en không có (fontSize.title/description/increase/decrease) — giữ nguyên để
 * chuỗi hiển thị không đổi một ký tự nào so với bản đăng ký tập trung.
 */
export const vi = {
			"appearance.dark": "Tối",
			"appearance.light": "Sáng",
			"appearance.system": "Theo hệ thống",
			"appearance.title": "Giao diện",
			"fontFamily.code.description": "Dùng cho khối mã, mã trong dòng và kết quả công cụ. Ngăn cách nhiều phông bằng dấu phẩy; để trống để dùng mặc định",
			"fontFamily.code.title": "Phông chữ mã",
			"fontFamily.placeholder": "Mặc định",
			"fontFamily.terminal.description": "Dùng cho terminal ở thanh bên. Ngăn cách nhiều phông bằng dấu phẩy; để trống để dùng mặc định",
			"fontFamily.terminal.title": "Phông chữ terminal",
			"fontFamily.text.description": "Dùng cho giao diện và nội dung hội thoại. Ngăn cách nhiều phông bằng dấu phẩy; để trống để dùng mặc định",
			"fontFamily.text.title": "Phông chữ văn bản",
			"fontSize.code.decrease": "Giảm cỡ chữ mã",
			"fontSize.code.description": "Dùng cho khối mã, mã trong dòng và kết quả công cụ",
			"fontSize.code.increase": "Tăng cỡ chữ mã",
			"fontSize.code.title": "Cỡ chữ mã",
			"fontSize.decrease": "Giảm cỡ chữ",
			"fontSize.description": "Chỉ ảnh hưởng nội dung hội thoại",
			"fontSize.increase": "Tăng cỡ chữ",
			"fontSize.more": "Thêm cài đặt cỡ chữ",
			"fontSize.terminal.decrease": "Giảm cỡ chữ terminal",
			"fontSize.terminal.description": "Dùng cho terminal ở thanh bên",
			"fontSize.terminal.increase": "Tăng cỡ chữ terminal",
			"fontSize.terminal.title": "Cỡ chữ terminal",
			"fontSize.text.decrease": "Giảm cỡ chữ",
			"fontSize.text.description": "Chỉ ảnh hưởng nội dung hội thoại",
			"fontSize.text.increase": "Tăng cỡ chữ",
			"fontSize.text.title": "Cỡ chữ",
			"fontSize.title": "Cỡ chữ",
			"fontSize.unit": "px",
} as const;
