/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nhãn provider của row cot-translation — NGUYÊN VĂN hàm providerLabel của vùng
 *      lib/types/client/TranslationSettings.js trong bundle gốc lib/client.js (vùng 7)
 */

import type { TranslationText } from "./locales.ts";

/**
 * Đọc nhãn hiển thị của một provider dịch.
 * Nhận: provider — mã provider; t — hàm đọc chuỗi theo namespace.
 * Trả: nhãn đã bản địa hoá, hoặc chính mã provider khi lạ (nguyên văn bản gốc).
 */
export function providerLabel(provider: string, t: TranslationText): string {
	switch (provider) {
		case "bing":
			return t("bing");
		case "google":
			return t("google");
		case "deepseek-account":
			return t("deepseekAccount");
		case "deepseek-official":
			return t("deepseekOfficial");
		default:
			return provider;
	}
}
