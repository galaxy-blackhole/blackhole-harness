/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Máy dịch đoạn suy luận đang mở rộng — NGUYÊN VĂN vùng lib/types/client/translation.js
 *      trong bundle gốc lib/client.js (vùng 3)
 */

import type { TranslationRequest } from "@galaxy-blackhole/gbh-host-experimental-translator";
import type { CotTranslationPreferences } from "../types.ts";

/** Một mảnh suy luận đã tách: văn bản, khoảng trắng nối sau nó, và cờ hoàn tất. */
export interface ReasoningFragment {
	/** Văn bản gốc của mảnh (giữ nguyên khoảng trắng bên trong). */
	text: string;
	/** Khoảng trắng phân cách theo sau mảnh (thuộc mảnh trước, không gửi đi). */
	suffix: string;
	/** Mảnh đã trọn vẹn nên đủ điều kiện dịch. */
	complete: boolean;
}

/** Trạng thái hiển thị mà bộ điều khiển công bố cho component. */
export interface ReasoningTranslationState {
	/** Văn bản đang hiển thị (đã ghép bản dịch của các mảnh đã dịch). */
	text: string;
	/** Còn request đang chạy. */
	pending: boolean;
	/** Request gần nhất đã lỗi (chờ người đọc bấm thử lại). */
	failed: boolean;
}

/** Một request dịch của row (tuỳ chọn + văn bản của mảnh). */
export type ReasoningTranslationRequest = TranslationRequest;

/** Hàm dịch một mảnh qua Remote, có thể huỷ. */
export type ReasoningTranslate = (request: ReasoningTranslationRequest, signal: AbortSignal) => Promise<string>;

/** Hàm công bố trạng thái hiển thị cục bộ của component. */
export type ReasoningPublish = (state: ReasoningTranslationState) => void;

/**
 * Tách suy luận thành các đoạn đã xong và các mảnh vừa một request.
 * Nhận: text — suy luận gốc, kể cả khoảng trắng chính xác; running — đoạn cuối còn có thể dài thêm;
 *        maxTextChars — hạn mức UTF-16 mỗi request của translator.
 * Trả: các mảnh giữ nguyên khoảng trắng, kèm cờ hoàn tất để biết mảnh nào đủ điều kiện dịch.
 */
export function reasoningFragments(text: string, running: boolean, maxTextChars: number): ReasoningFragment[] {
	const result: ReasoningFragment[] = [];
	const separator = /\r?\n(?:[\t ]*\r?\n)+/g;
	let start = 0;
	while (true) {
		const match = separator.exec(text);
		let remaining = text.slice(start, match?.index ?? text.length);
		while (remaining.length > maxTextChars) {
			let cut = maxTextChars;
			if (/[\uD800-\uDBFF]/.test(remaining.charAt(cut - 1))) cut -= 1;
			const whitespace = remaining.slice(0, cut).search(/\s+\S*$/);
			if (whitespace > 0) cut = whitespace;
			const source = remaining.slice(0, cut);
			remaining = remaining.slice(cut);
			const suffix = remaining.match(/^\s+/)?.[0] ?? "";
			remaining = remaining.slice(suffix.length);
			result.push({
				text: source,
				suffix,
				complete: true,
			});
		}
		result.push({
			text: remaining,
			suffix: match?.[0] ?? "",
			complete: match !== null || !running,
		});
		if (match === null) return result;
		start = match.index + match[0].length;
	}
}

/** Một bộ điều khiển vòng đời sở hữu huỷ, thứ tự request, và loại trừ kết quả cũ. */
export class ReasoningTranslation {
	/** Tuỳ chọn dịch đã chốt (provider tường minh + ngôn ngữ đích đã giải). */
	private readonly selection: CotTranslationPreferences;
	/** Hạn mức UTF-16 mỗi request. */
	private readonly maxTextChars: number;
	/** Hàm dịch một mảnh qua Remote. */
	private readonly translate: ReasoningTranslate;
	/** Hàm công bố trạng thái hiển thị. */
	private readonly publish: ReasoningPublish;
	/** Huỷ mọi request của khối suy luận này. */
	private readonly controller = new AbortController();
	/** Bản dịch đã có theo văn bản gốc của mảnh. */
	private readonly cache = new Map<string, string>();
	/** Các mảnh hiện tại. */
	private fragments: ReasoningFragment[] = [];
	/** Còn request đang chạy. */
	private pending = false;
	/** Request gần nhất đã lỗi. */
	private failed = false;

	/**
	 * Nhận: selection — provider tường minh + ngôn ngữ đích đã giải; maxTextChars — hạn mức request;
	 *        translate — một request Remote có thể huỷ; publish — cập nhật trạng thái hiển thị cục bộ.
	 * Trả: bộ điều khiển chưa nhận văn bản nào.
	 */
	constructor(selection: CotTranslationPreferences, maxTextChars: number, translate: ReasoningTranslate, publish: ReasoningPublish) {
		this.selection = selection;
		this.maxTextChars = maxTextChars;
		this.translate = translate;
		this.publish = publish;
	}

	/**
	 * Nhận văn bản nguồn hiện tại và đưa các mảnh vừa xong vào hàng đợi dịch.
	 * Nhận: text — suy luận gốc hiện tại; running — đuôi của nó còn đang chảy.
	 * Trả: không — công bố trạng thái rồi chạy hàng đợi.
	 */
	update(text: string, running: boolean): void {
		this.fragments = reasoningFragments(text, running, this.maxTextChars);
		this.emit();
		this.run();
	}

	/**
	 * Thử lại các mảnh chưa dịch sau một request lỗi.
	 * Nhận: không.
	 * Trả: không — xoá cờ lỗi rồi chạy hàng đợi.
	 */
	retry(): void {
		this.failed = false;
		this.run();
	}

	/**
	 * Huỷ request của khối suy luận và chặn mọi lần công bố sau đó.
	 * Nhận: không.
	 * Trả: không.
	 */
	dispose(): void {
		this.controller.abort();
	}

	/**
	 * Cho biết bộ điều khiển đã bị huỷ chưa.
	 * Nhận: không.
	 * Trả: true khi signal của bộ điều khiển đã abort.
	 */
	isDisposed(): boolean {
		return this.controller.signal.aborted;
	}

	/**
	 * Công bố văn bản đã ghép (bản dịch của mảnh đã xong, nguyên văn của phần còn lại) + trạng thái.
	 * Nhận: không.
	 * Trả: không — bỏ qua khi đã huỷ.
	 */
	private emit(): void {
		if (this.isDisposed()) return;
		const text = this.fragments
			.map((fragment) => {
				return (fragment.complete ? this.cache.get(fragment.text) ?? fragment.text : fragment.text) + fragment.suffix;
			})
			.join("");
		this.publish({
			text,
			pending: this.pending,
			failed: this.failed,
		});
	}

	/**
	 * Dịch lần lượt mọi mảnh đã xong còn thiếu bản dịch, dừng ngay khi bị huỷ.
	 * Nhận: không.
	 * Trả: không — công bố trạng thái sau mỗi mảnh và ở cuối.
	 */
	private async run(): Promise<void> {
		if (this.pending || this.failed || this.isDisposed()) return;
		let next = this.fragments.find((fragment) => fragment.complete && fragment.text.trim() !== "" && !this.cache.has(fragment.text));
		if (next === void 0) return;
		this.pending = true;
		this.emit();
		try {
			while (next !== void 0) {
				const translated = await this.translate(
					{
						...this.selection,
						text: next.text,
					},
					this.controller.signal,
				);
				if (this.isDisposed()) return;
				this.cache.set(next.text, translated);
				this.emit();
				next = this.fragments.find((fragment) => fragment.complete && fragment.text.trim() !== "" && !this.cache.has(fragment.text));
			}
		} catch (_error) {
			if (!this.isDisposed()) this.failed = true;
		} finally {
			this.pending = false;
			this.emit();
		}
	}
}
