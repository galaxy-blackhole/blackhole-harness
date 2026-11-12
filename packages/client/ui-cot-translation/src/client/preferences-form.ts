/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Form tuỳ chọn dịch đang chờ — NGUYÊN VĂN vùng lib/types/client/preferences-form.js
 *      trong bundle gốc lib/client.js (vùng 9), dùng chung mô hình form của khung Plugins
 */

import { LANGUAGE_PREFERENCE_PATTERN, PROVIDER_PREFERENCES } from "../preferences.ts";
import type { PrimitivesLike, RequireFn, SettingsFormModelLike, SettingsScopeLike } from "./runtime-types.ts";

/** `require` của factory do vỏ cấp — nguồn của bộ primitive. */
declare const require: RequireFn;

/** Bộ primitive do bảng module của vỏ cấp. */
const primitives = require("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesLike;

/** Kết quả phân tích một ô của form (nguyên văn hình dạng của bộ form). */
type ParsedField = { kind: "clear" } | { kind: "set"; value: string } | undefined;

/** Mặt đăng ký của form tuỳ chọn dịch. */
export interface TranslationPreferencesFormFace extends Record<string, unknown> {
	/** Hook của occupant: store form đang chờ. */
	hooks: { translationForm: unknown };
}

/** Tuỳ chọn dịch đang chờ, dùng chung mô hình form của khung Plugins. */
export class TranslationPreferencesForm {
	/** Mô hình form đã gắn vào scope cài đặt của row. */
	private readonly form: SettingsFormModelLike;
	/** Store form đang chờ (bind từ mô hình). */
	private readonly state: unknown;

	/**
	 * Nhận: scope — form cấu hình do Host cấp cho plugin này.
	 * Trả: form đang chờ, đã khai hai ô provider + targetLanguage.
	 */
	constructor(scope: SettingsScopeLike) {
		this.form = new primitives.SettingsFormModel(scope, [
			{
				...primitives.settingsTextField("provider"),
				parse: (text: string): ParsedField => {
					const provider = text.trim();
					return provider === ""
						? { kind: "clear" }
						: PROVIDER_PREFERENCES.some((choice) => choice === provider)
							? {
									kind: "set",
									value: provider,
								}
							: void 0;
				},
			},
			{
				...primitives.settingsTextField("targetLanguage"),
				parse: (text: string): ParsedField =>
					LANGUAGE_PREFERENCE_PATTERN.test(text.trim())
						? {
								kind: "set",
								value: text.trim(),
							}
						: void 0,
			},
		]);
		this.state = this.form.bind(() => ({
			...this.form.shell(),
			provider: this.form.field("provider"),
			targetLanguage: this.form.field("targetLanguage"),
		}));
	}

	/**
	 * Dựng mặt đăng ký cho form tuỳ chọn dịch.
	 * Nhận: không.
	 * Trả: store đang chờ + các hành động sửa/lưu dùng chung của form.
	 */
	inject(): TranslationPreferencesFormFace {
		return {
			hooks: { translationForm: this.state },
			...this.form.actions(),
		} as TranslationPreferencesFormFace;
	}

	/**
	 * Nhả đăng ký tuỳ chọn dịch đã chấp nhận.
	 * Nhận: không.
	 * Trả: không.
	 */
	dispose(): void {
		this.form.dispose();
	}
}
