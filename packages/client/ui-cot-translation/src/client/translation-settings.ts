/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Thẻ tuỳ chọn dịch trong trang Plugins — NGUYÊN VĂN vùng lib/types/client/TranslationSettings.js
 *      trong bundle gốc lib/client.js (vùng 7), giữ nguyên chuỗi/nhãn/thứ tự con
 */

import type { TranslationProvider } from "@galaxy-blackhole/gbh-host-experimental-translator";
import type { TranslationText } from "./locales.ts";
import { formLabels } from "./locales.ts";
import type { JsxRuntimeLike, PrimitivesLike, ReactLike, RequireFn } from "./runtime-types.ts";
import { TranslationStyles } from "./translation-css.ts";

/** `require` của factory do vỏ cấp — nguồn của các seed nền tảng. */
declare const require: RequireFn;

/** Seed React do bảng module của vỏ cấp. */
const react = require("react") as ReactLike;
/** Seed jsx runtime do bảng module của vỏ cấp. */
const jsxRuntime = require("react/jsx-runtime") as JsxRuntimeLike;
/** Bộ primitive do bảng module của vỏ cấp. */
const primitives = require("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesLike;

/** Một ô đang chờ lưu của form tuỳ chọn dịch. */
export interface StagedFieldLike {
	/** Văn bản hiện tại của ô. */
	text: string;
	/** Ô sai định dạng. */
	invalid: boolean;
	/** Ô đã bị ghi đè so với mặc định. */
	overridden: boolean;
}

/** Ảnh chụp form tuỳ chọn dịch mà thẻ này đọc. */
export interface TranslationFormStateLike {
	/** Deployment cho ghi cài đặt. */
	writable: boolean;
	/** Form đang lưu. */
	saving: boolean;
	/** Ô provider. */
	provider: StagedFieldLike;
	/** Ô ngôn ngữ đích (mang thêm trường của khung SettingsValueField). */
	targetLanguage: StagedFieldLike & Record<string, unknown>;
}

/** Props mà tầng slots truyền cho thẻ tuỳ chọn dịch. */
export interface TranslationSettingsProps {
	/** Hàm đọc chuỗi theo namespace của plugin. */
	t: TranslationText;
	/** Hook đọc form đang chờ. */
	useTranslationForm: <T>(select: (value: TranslationFormStateLike) => T) => T;
	/** Hook đọc danh sách provider đang đủ điều kiện. */
	useAvailableProviders: <T>(select: (value: readonly TranslationProvider[]) => T) => T;
	/** Hỏi lại Host danh sách provider đủ điều kiện. */
	refreshProviders: () => void;
	/** Lưu form. */
	save: () => void;
	/** Bỏ thay đổi. */
	discard: () => void;
	/** Sửa một ô đang chờ. */
	edit: (field: string, text: string) => void;
	/** Khôi phục một ô về mặc định. */
	resetField: (field: string) => void;
}

import { providerLabel } from "./provider-label.ts";

/**
 * Dựng tuỳ chọn dịch đang chờ và nói rõ văn bản nào rời Host.
 * Nhận: props — các ô đang chờ, metadata giá trị đã chấp nhận, và hành động lưu.
 * Trả: tuỳ chọn dịch của bundle (khung SettingsForm + hai ô provider/ngôn ngữ).
 */
export function TranslationSettings(props: TranslationSettingsProps): unknown {
	const { t } = props;
	const providerId = react.useId(),
		languageId = react.useId();
	const state = props.useTranslationForm((value) => value);
	const availableProviders = props.useAvailableProviders((value) => value);
	react.useEffect(() => {
		props.refreshProviders();
	}, [props.refreshProviders]);
	const missingProvider = state.provider.text !== "" && !availableProviders.some((provider) => provider === state.provider.text);
	const paid = state.provider.text === "deepseek-account" || state.provider.text === "deepseek-official";
	const disabled = !state.writable || state.saving;
	return jsxRuntime.jsxs(primitives.SettingsForm, {
		labels: formLabels(t),
		state,
		onSave: props.save,
		onDiscard: props.discard,
		children: [
			jsxRuntime.jsx("p", {
				className: TranslationStyles.notice,
				children: t("privacy"),
			}),
			jsxRuntime.jsx("p", {
				className: TranslationStyles.notice,
				children: t(paid ? "paidNotice" : "anonymousNotice"),
			}),
			jsxRuntime.jsxs("div", {
				className: TranslationStyles.field,
				children: [
					jsxRuntime.jsxs("div", {
						className: TranslationStyles.toolbar,
						children: [
							jsxRuntime.jsx("label", {
								htmlFor: providerId,
								children: t("provider"),
							}),
							state.provider.overridden &&
								jsxRuntime.jsxs(jsxRuntime.Fragment, {
									children: [
										jsxRuntime.jsx(primitives.Tag, {
											tone: "neutral",
											children: t("overridden"),
										}),
										jsxRuntime.jsx(primitives.Button, {
											size: "sm",
											disabled,
											onClick: () => {
												props.resetField("provider");
											},
											children: t("reset"),
										}),
									],
								}),
						],
					}),
					jsxRuntime.jsxs("select", {
						id: providerId,
						value: state.provider.text,
						disabled,
						"aria-invalid": state.provider.invalid || void 0,
						onChange: (event: { target: { value: string } }) => {
							props.edit("provider", event.target.value);
						},
						children: [
							missingProvider &&
								jsxRuntime.jsx("option", {
									value: state.provider.text,
									disabled: true,
									children: t("providerUnavailableOption", { provider: providerLabel(state.provider.text, t) }),
								}),
							availableProviders.map((provider) =>
								jsxRuntime.jsx(
									"option",
									{
										value: provider,
										children: providerLabel(provider, t),
									},
									provider,
								),
							),
						],
					}),
					state.provider.invalid &&
						jsxRuntime.jsx("p", {
							role: "status",
							children: t("invalidProvider"),
						}),
					missingProvider &&
						!state.provider.invalid &&
						jsxRuntime.jsx("p", {
							role: "status",
							className: TranslationStyles.notice,
							children: t("providerUnavailable"),
						}),
				],
			}),
			jsxRuntime.jsx(primitives.SettingsValueField, {
				id: languageId,
				label: t("targetLanguage"),
				hint: t("targetLanguageHint"),
				...state.targetLanguage,
				overriddenLabel: t("overridden"),
				resetLabel: t("reset"),
				invalidLabel: t("invalidLanguage"),
				disabled,
				onEdit: (value: string) => {
					props.edit("targetLanguage", value);
				},
				onReset: () => {
					props.resetField("targetLanguage");
				},
			}),
		],
	});
}