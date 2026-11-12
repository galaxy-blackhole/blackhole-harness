/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Thân khối suy luận có điều khiển dịch — NGUYÊN VĂN vùng lib/types/client/TranslationBody.js
 *      trong bundle gốc lib/client.js (vùng 5), giữ nguyên chuỗi/data-attr/thứ tự con
 */

import type { TranslationRequest } from "@galaxy-blackhole/gbh-host-experimental-translator";
import type { CotTranslationPreferences } from "../types.ts";
import type { TranslationText } from "./locales.ts";
import type { JsxRuntimeLike, PrimitivesLike, ReactLike, RequireFn } from "./runtime-types.ts";
import { ReasoningTranslation } from "./translation.ts";
import type { ReasoningTranslationState } from "./translation.ts";
import { TranslationStyles } from "./translation-css.ts";

/** `require` của factory do vỏ cấp — nguồn của các seed nền tảng. */
declare const require: RequireFn;

/** Seed React do bảng module của vỏ cấp. */
const react = require("react") as ReactLike;
/** Seed jsx runtime do bảng module của vỏ cấp. */
const jsxRuntime = require("react/jsx-runtime") as JsxRuntimeLike;
/** Bộ primitive do bảng module của vỏ cấp. */
const primitives = require("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesLike;

/** Props mà tầng slots truyền cho thân khối suy luận. */
export interface TranslationBodyProps {
	/** Suy luận gốc hiện tại (nguyên văn, kể cả khoảng trắng). */
	text: string;
	/** Đuôi suy luận còn đang chảy. */
	running: boolean;
	/** Một request dịch qua Remote, có thể huỷ. */
	translate: (request: TranslationRequest, signal: AbortSignal) => Promise<string>;
	/** Hàm đọc chuỗi theo namespace của plugin. */
	t: TranslationText;
	/** Dựng occupant của slot nội dung suy luận (Markdown + nhãn). */
	renderFactorySlot: (name: string, props: Record<string, unknown>) => unknown;
	/** Hook đọc tuỳ chọn dịch đã chấp nhận. */
	usePreferences: <T>(select: (value: CotTranslationPreferences) => T) => T;
	/** Hook đọc ngôn ngữ UI đang hoạt động. */
	useTranslationLocale: <T>(select: (value: { active: string }) => T) => T;
	/** Hook đọc hạn mức UTF-16 mỗi request. */
	useTranslationLimit: <T>(select: (value: number) => T) => T;
}

/**
 * Dựng suy luận đã dịch, giữ nguyên văn bản gốc cho tới khi request lỗi được thử lại.
 * Nhận: props — suy luận gốc, tuỳ chọn dịch, và callback dịch có thể huỷ.
 * Trả: Markdown gọn + trạng thái dịch, kèm nút thử lại khi lỗi.
 */
export function TranslationBody(props: TranslationBodyProps): unknown {
	const { text, running, translate, t, renderFactorySlot } = props;
	const preferences = props.usePreferences((value) => value);
	const locale = props.useTranslationLocale((value) => value.active);
	const maxTextChars = props.useTranslationLimit((value) => value);
	const targetLanguage = preferences.targetLanguage === "auto" ? locale : preferences.targetLanguage;
	const [state, setState] = react.useState<ReasoningTranslationState>({
		text,
		pending: false,
		failed: false,
	});
	const [original, setOriginal] = react.useState(false);
	const translation = react.useRef<ReasoningTranslation>();
	react.useEffect(() => {
		const controller = new ReasoningTranslation(
			{
				provider: preferences.provider,
				targetLanguage,
			},
			maxTextChars,
			translate,
			setState,
		);
		translation.current = controller;
		return () => {
			controller.dispose();
			translation.current = undefined;
		};
	}, [preferences.provider, targetLanguage, maxTextChars, translate]);
	react.useEffect(() => {
		translation.current?.update(text, running);
	}, [text, running, preferences.provider, targetLanguage, maxTextChars, translate]);
	const labels = react.useMemo(
		() => ({
			code: {
				copyLabel: t("copy"),
				copiedLabel: t("copied"),
				toolbarLabels: {
					codeLabel: t("codeTitle"),
					wrapLabel: t("wrap"),
					unwrapLabel: t("unwrap"),
				},
			},
			footnotes: t("footnotes"),
		}),
		[t],
	);
	const showOriginal = original || state.failed;
	const actionLabel = t(showOriginal ? "translation" : "original");
	return jsxRuntime.jsxs("div", {
		"data-cot-translation": "true",
		"data-translation-state": state.failed ? "failed" : state.pending ? "pending" : "ready",
		"data-translation-view": showOriginal ? "original" : "translated",
		children: [
			jsxRuntime.jsxs("div", {
				className: TranslationStyles.toolbar,
				children: [
					jsxRuntime.jsx(primitives.Button, {
						className: TranslationStyles.viewToggle,
						size: "sm",
						variant: "ghost",
						disabled: state.failed,
						onClick: () => {
							setOriginal(!showOriginal);
						},
						children: actionLabel,
					}),
					state.pending &&
						jsxRuntime.jsx("span", {
							role: "status",
							"aria-label": t("translating"),
							children: jsxRuntime.jsx(primitives.IconLoadingOutlineRegular, {
								size: 14,
								className: TranslationStyles.spinner,
							}),
						}),
					state.failed &&
						jsxRuntime.jsxs(jsxRuntime.Fragment, {
							children: [
								jsxRuntime.jsx("span", {
									className: TranslationStyles.failure,
									role: "status",
									children: t("failed"),
								}),
								jsxRuntime.jsx(primitives.Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => {
										translation.current?.retry();
									},
									children: t("retry"),
								}),
							],
						}),
				],
			}),
			renderFactorySlot("conversation.chat.reasoning.content", {
				text: showOriginal ? text : state.text,
				running,
				labels,
			}),
		],
	});
}
