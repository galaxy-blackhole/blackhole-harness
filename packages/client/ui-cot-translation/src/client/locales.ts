/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Từ điển của row cot-translation — NGUYÊN VĂN vùng lib/types/client/locales.js
 *      trong bundle gốc lib/client.js (vùng 6)
 */

/** Namespace từ điển của plugin (nguyên văn bản gốc). */
export const NS = "cotTranslation";

/** Bản tiếng Anh — nguồn khoá của cả hai từ điển (nguyên văn bản gốc). */
export const en = {
	provider: "Translation service",
	google: "Google",
	bing: "Bing",
	deepseekAccount: "DeepSeek Flash — Account (paid)",
	deepseekOfficial: "DeepSeek Flash — Official API (paid)",
	providerUnavailableOption: "{provider} — unavailable",
	providerUnavailable: "This provider is unavailable. Configure your DeepSeek account or Official API provider, or choose an available service.",
	paidNotice:
		"Each uncached fragment sends a separate paid DeepSeek Flash request through the selected account or Official API credentials. Reopening reasoning reuses saved results; changing the provider, language, source text, or request settings may send a new paid request.",
	anonymousNotice: "Bing and Google need no translation login or API key. Their anonymous endpoints may reject or limit requests.",
	targetLanguage: "Target language",
	targetLanguageHint: "auto follows the UI language; language codes such as zh, en, and ja also work.",
	privacy: "Expanded reasoning is sent to the selected service. It may contain private code or conversation details.",
	translation: "View translation",
	original: "View original",
	retry: "Retry",
	failed: "Translation failed. Showing the original.",
	translating: "Translating reasoning",
	invalidProvider: "Choose a translation service.",
	invalidLanguage: "Enter auto or a language code, such as zh, en, or ja.",
	overridden: "Overridden",
	reset: "Reset to default",
	unavailable: "Translation preferences are unavailable.",
	readOnly: "This deployment stores settings read-only.",
	saveFailed: "The deployment did not accept these values; they were left for you to correct.",
	save: "Save",
	saving: "Saving…",
	copy: "Copy",
	copied: "Copied",
	codeTitle: "Code block",
	wrap: "Wrap lines",
	unwrap: "Unwrap lines",
	footnotes: "Footnotes",
};

/** Khoá của từ điển (lấy từ bản tiếng Anh). */
export type TranslationKey = keyof typeof en;

/** Hàm đọc chuỗi theo namespace của plugin. */
export type TranslationText = (key: TranslationKey, params?: Record<string, string>) => string;

/** Bản tiếng Trung — cùng khoá với bản tiếng Anh (nguyên văn bản gốc). */
export const zh: Record<TranslationKey, string> = {
	provider: "翻译服务",
	google: "Google",
	bing: "Bing",
	deepseekAccount: "DeepSeek Flash · 账号（付费）",
	deepseekOfficial: "DeepSeek Flash · 官方 API（付费）",
	providerUnavailableOption: "{provider} — 不可用",
	providerUnavailable: "此服务暂不可用，请配置 DeepSeek 账号或官方 API 服务，或选择可用的翻译服务",
	paidNotice:
		"每个未缓存片段都会通过所选账号或官方 API 凭据单独发送一次付费的 DeepSeek Flash 请求；重新展开会复用已保存的译文，更改服务、语言、原文或请求设置可能发送新的付费请求",
	anonymousNotice: "Bing 和 Google 翻译无需额外登录或 API key，但匿名接口可能拒绝或限制请求",
	targetLanguage: "目标语言",
	targetLanguageHint: "auto 使用界面语言；也可填写语言代码，例如 zh、en、ja",
	privacy: "展开的思考内容会发送给所选翻译服务，可能包含私有代码或对话细节。",
	translation: "查看译文",
	original: "查看原文",
	retry: "重试",
	failed: "翻译暂不可用，已显示原文",
	translating: "正在翻译思考内容",
	invalidProvider: "请选择翻译服务",
	invalidLanguage: "请填写 auto 或语言代码，例如 zh、en、ja",
	overridden: "已覆盖",
	reset: "恢复默认",
	unavailable: "翻译设置暂不可用",
	readOnly: "本部署的设置为只读",
	saveFailed: "本部署没有接受这些值，已保留供你修改",
	save: "保存",
	saving: "保存中…",
	copy: "复制",
	copied: "已复制",
	codeTitle: "代码块",
	wrap: "自动换行",
	unwrap: "不换行",
	footnotes: "脚注",
};

/**
 * Bản tiếng Việt — cùng khoá với bản tiếng Anh (dịch cho giao diện Galaxy Blackhole).
 */
export const vi: Record<TranslationKey, string> = {
	provider: "Dịch vụ dịch",
	google: "Google",
	bing: "Bing",
	deepseekAccount: "DeepSeek Flash — Tài khoản (trả phí)",
	deepseekOfficial: "DeepSeek Flash — API chính thức (trả phí)",
	providerUnavailableOption: "{provider} — không dùng được",
	providerUnavailable: "Dịch vụ này không dùng được. Hãy cấu hình tài khoản DeepSeek hoặc API chính thức, hoặc chọn dịch vụ khác.",
	paidNotice:
		"Mỗi đoạn chưa lưu sẽ gửi một request DeepSeek Flash tính phí riêng qua tài khoản hoặc API chính thức đã chọn; mở lại phần suy luận sẽ dùng lại bản dịch đã lưu.",
	anonymousNotice: "Bing và Google không cần đăng nhập hay API key, nhưng endpoint ẩn danh có thể từ chối hoặc giới hạn lượt gọi.",
	targetLanguage: "Ngôn ngữ đích",
	targetLanguageHint: "auto theo ngôn ngữ giao diện; cũng nhận mã ngôn ngữ như vi, en.",
	privacy: "Nội dung suy luận đã mở rộng sẽ được gửi tới dịch vụ đã chọn; có thể chứa mã nguồn riêng tư hoặc chi tiết hội thoại.",
	translation: "Xem bản dịch",
	original: "Xem bản gốc",
	retry: "Thử lại",
	failed: "Dịch thất bại. Đang hiển thị bản gốc.",
	translating: "Đang dịch nội dung suy luận",
	invalidProvider: "Hãy chọn dịch vụ dịch.",
	invalidLanguage: "Nhập auto hoặc mã ngôn ngữ, ví dụ zh, en, ja.",
	overridden: "Đã ghi đè",
	reset: "Khôi phục mặc định",
	unavailable: "Tuỳ chọn dịch không dùng được.",
	readOnly: "Bản triển khai này lưu cài đặt ở chế độ chỉ đọc.",
	saveFailed: "Bản triển khai không nhận các giá trị này; giữ lại để bạn sửa.",
	save: "Lưu",
	saving: "Đang lưu…",
	copy: "Sao chép",
	copied: "Đã sao chép",
	codeTitle: "Khối mã",
	wrap: "Ngắt dòng",
	unwrap: "Không ngắt dòng",
	footnotes: "Chú thích cuối",
};

/** Khung chữ dùng chung của form cài đặt. */
export interface FormLabels {
	/** Thông báo không đọc được tuỳ chọn. */
	unavailable: string;
	/** Thông báo deployment ghi cài đặt chỉ-đọc. */
	readOnly: string;
	/** Thông báo deployment không nhận giá trị. */
	saveFailed: string;
	/** Nhãn nút lưu. */
	save: string;
	/** Nhãn nút đang lưu. */
	saving: string;
}

/**
 * Đọc khung chữ dùng chung của form từ từ điển plugin.
 * Nhận: t — hàm đọc chuỗi theo namespace hiện tại.
 * Trả: các nhãn khung form đã bản địa hoá.
 */
export function formLabels(t: TranslationText): FormLabels {
	return {
		unavailable: t("unavailable"),
		readOnly: t("readOnly"),
		saveFailed: t("saveFailed"),
		save: t("save"),
		saving: t("saving"),
	};
}
