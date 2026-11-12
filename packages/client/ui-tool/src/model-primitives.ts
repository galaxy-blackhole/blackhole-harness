/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bộ chuyển nhãn bản địa hoá cho các primitive không dùng Cordis mà thẻ Tool dùng: thanh công cụ code, markdown, diff, read, search, web
 */

/** Localized copy adapters for Cordis-free UI primitives used by Tool cards. */

/**
 * Ghế dịch của hội thoại — nhận khoá và tham số nội suy, trả chuỗi đã bản địa hoá.
 * Kiểu riêng tư: bản gốc lấy TranslateNS<"conversation"> từ ui-slots, ta thay bằng chữ ký tương đương.
 */
type LocaleSeat = (key: string, params?: Record<string, string | number>) => string;

/**
* Localize the shared code-card toolbar.
* @param t - Conversation locale seat.
* @returns Language fallback and wrapping actions.
*/
export function codeToolbarLabels(t: LocaleSeat) {
	return {
		codeLabel: t("codeBlock.title"),
		wrapLabel: t("codeBlock.wrap"),
		unwrapLabel: t("codeBlock.unwrap")
	};
}

/**
* Build localized Markdown chrome labels.
* @param t - Conversation locale seat.
* @returns Markdown chrome labels.
*/
export function markdownLabels(t: LocaleSeat) {
	return {
		code: {
			copyLabel: t("copy"),
			copiedLabel: t("copied"),
			toolbarLabels: codeToolbarLabels(t)
		},
		footnotes: t("markdown.footnotes")
	};
}

/**
* Build localized diff-card chrome labels.
* @param t - Conversation locale seat.
* @returns Diff-card chrome labels.
*/
export function diffBlockLabels(t: LocaleSeat) {
	return {
		...codeToolbarLabels(t),
		copy: t("copy"),
		copied: t("copied"),
		collapseAria: t("diff.collapseAria"),
		expandAria: (count: number) => t("diff.expandAria", { count }),
		collapse: t("collapse"),
		expand: (count: number) => t("diff.expandRest", { count })
	};
}

/**
* Build localized read-card chrome labels.
* @param t - Conversation locale seat.
* @returns Read-card chrome labels.
*/
export function readBlockLabels(t: LocaleSeat) {
	return {
		...codeToolbarLabels(t),
		window: (shown: number, total: number) => t("read.window", {
			shown,
			total
		}),
		copy: t("copy"),
		copied: t("copied"),
		collapseAria: t("read.collapseAria"),
		expandAria: (count: number) => t("read.expandAria", { count }),
		collapse: t("collapse"),
		expand: (count: number) => t("read.expandRest", { count })
	};
}

/**
* Build localized search-card chrome labels.
* @param t - Conversation locale seat.
* @returns Search-card chrome labels.
*/
export function searchBlockLabels(t: LocaleSeat) {
	return {
		pathsSummary: (shown: number, total: number, truncated: boolean) => t(truncated ? "search.paths.truncated" : "search.paths", {
			shown,
			total
		}),
		matchesSummary: (shown: number, total: number, files: number, truncated: boolean) => t(truncated ? "search.matches.truncated" : "search.matches", {
			shown,
			total,
			files
		}),
		copy: t("copy"),
		copied: t("copied"),
		noResults: t("search.noResults"),
		collapseAria: t("search.collapseAria"),
		expandAria: (count: number) => t("search.expandAria", { count }),
		collapse: t("collapse"),
		expand: (count: number) => t("search.expandRest", { count })
	};
}

/**
* Build localized web-card chrome labels.
* @param t - Conversation locale seat.
* @returns Web-card chrome labels.
*/
export function webBlockLabels(t: LocaleSeat) {
	return {
		noResults: t("web.noResults"),
		sourcesTruncated: t("web.sourcesTruncated"),
		http: t("web.http"),
		contentTruncated: t("web.contentTruncated"),
		markdown: markdownLabels(t)
	};
}
