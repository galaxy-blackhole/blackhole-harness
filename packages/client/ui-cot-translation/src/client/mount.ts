/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Mount nửa client: Remote tuỳ chọn + hai occupant slot — NGUYÊN VĂN vùng lib/types/client/mount.js
 *      trong bundle gốc lib/client.js (vùng 10), giữ nguyên chuỗi log/nhãn effect/thứ tự lời gọi
 */

import type { TranslationRequest } from "@galaxy-blackhole/gbh-host-experimental-translator";
import type { CotTranslationSnapshot } from "../types.ts";
import { en, NS, vi, zh } from "./locales.ts";
import { TranslationPreferencesForm } from "./preferences-form.ts";
import type { ClientStoreLike, RequireFn, SettingsScopeLike } from "./runtime-types.ts";
import { TranslationBody } from "./translation-body.ts";
import { TranslationSettings } from "./translation-settings.ts";

/** `require` của factory do vỏ cấp — nguồn của store ảnh chụp. */
declare const require: RequireFn;

/** Module store của vỏ do bảng module cấp (nguyên văn `require("@galaxy-blackhole/gbh-client-store")`). */
const store = require("@galaxy-blackhole/gbh-client-store") as ClientStoreLike;

/** Kết quả một lời gọi Remote: thành công kèm giá trị, hoặc lỗi. */
export type RemoteResultLike<T> = { ok: true; value: T } | { ok: false; error: Error };

/** Seam Remote của vỏ: service cotTranslation + hai thao tác vòng đời. */
export interface ClientRemoteLike {
	/** Service Remote do nửa host của row cấp (namespace cotTranslation). */
	readonly cotTranslation: {
		/** Đọc tuỳ chọn + hạn mức mà không gửi văn bản. */
		limits(signal: AbortSignal): Promise<RemoteResultLike<CotTranslationSnapshot>>;
		/** Dịch một đoạn qua provider đã chọn. */
		translate(request: TranslationRequest, signal: AbortSignal): Promise<RemoteResultLike<string>>;
	};
	/** Nghe một sự kiện của vỏ; trả hàm huỷ. */
	$on(event: string, listener: (payload: unknown) => void): unknown;
	/** Mount contribution Remote đã sinh; trả hàm gỡ. */
	$mount(contribution: unknown): Promise<() => Promise<void>>;
}

/** Context con mà vỏ cấp cho nửa client (chỉ phần row này dùng — khai theo CẤU TRÚC). */
export interface ClientContextLike {
	/** Fiber của plugin (dùng để biết plugin còn sống). */
	readonly fiber: { uid: number | null };
	/** Đăng ký hiệu ứng vòng đời của context. */
	effect(register: () => unknown, label?: string): unknown;
	/** Nghe sự kiện của vỏ. */
	on(event: string, listener: (payload: { uid: number | null }) => void): unknown;
	/** Chờ seam con rồi chạy callback; trả bề mặt vừa await vừa dispose được. */
	inject(names: string[], callback: (child: ClientContextLike) => unknown): Promise<unknown> & { dispose(): Promise<void> };
	/** Logger của vỏ. */
	logger: { warn(message: string): void };
	/** Seam Remote. */
	remote: ClientRemoteLike;
	/** Tầng slots: nơi đăng ký occupant. */
	slots: {
		/** Chờ slot xuất hiện rồi đăng ký. */
		inject(name: string, callback: () => unknown): unknown;
		/** Đăng ký một occupant cho slot. */
		register(spec: Record<string, unknown>, component: unknown): unknown;
	};
	/** Tầng locale: bind namespace và đăng ký từ điển. */
	locale: {
		/** Ngôn ngữ UI đang hoạt động. */
		active: string;
		/** Đăng ký từ điển của namespace. */
		register(namespace: string, dictionaries: Record<string, unknown>): unknown;
	};
	/** Tầng config forms: scope cài đặt của namespace. */
	configForms: { get(namespace: string): SettingsScopeLike };
}

/** Services cần có trước khi mount Remote tuỳ chọn và các contribution UI (nguyên văn bản gốc). */
export const inject = ["remote", "slots", "locale", "configForms"];

/**
 * Đăng ký hai occupant slot và các store đọc Host cho một context con.
 * Nhận: ctx — context con đã có remote/slots/locale/configForms; lifetime — cờ huỷ của lần mount.
 * Trả: không — đăng ký xong thì trả quyền cho tầng slots.
 */
async function registerUi(ctx: ClientContextLike, lifetime: AbortController): Promise<void> {
	let readTask: Promise<RemoteResultLike<CotTranslationSnapshot>> | undefined;
	let updating: Promise<void> | undefined;
	let revision = 0,
		lastReadRevision = -1,
		acceptedRevision = -1;
	const isDisposed = () => lifetime.signal.aborted || ctx.fiber.uid === null;
	ctx.effect(
		() => async () => {
			lifetime.abort();
			await Promise.allSettled([readTask, updating]);
		},
		"cot-translation: metadata queries",
	);
	const invalidate = () => {
		revision += 1;
		refresh();
	};
	ctx.effect(() => [
		ctx.remote.$on("settings/document-updated", invalidate),
		ctx.remote.$on("llm/adapters-updated", invalidate),
		ctx.remote.$on("deepseek-account/session-expired", invalidate),
		ctx.remote.$on("deepseek-account/model-sign-in-required", invalidate),
		ctx.remote.$on("credentials/record-updated", invalidate),
		ctx.remote.$on("credentials/reference-updated", invalidate),
	]);
	ctx.on("connection/reset", invalidate);
	const read = async (): Promise<RemoteResultLike<CotTranslationSnapshot> | undefined> => {
		while (true) {
			const observed = revision;
			lastReadRevision = observed;
			readTask = ctx.remote.cotTranslation.limits(lifetime.signal);
			const result = await readTask;
			if (isDisposed()) return void 0;
			if (observed === revision) return result;
		}
	};
	let initial: RemoteResultLike<CotTranslationSnapshot> | undefined;
	try {
		initial = await read();
	} catch (error) {
		if (isDisposed()) return;
		throw error;
	}
	if (initial === void 0) return;
	if (!initial.ok) throw initial.error;
	const preferences = store.createSnapshotStore(initial.value.preferences);
	const translationLimit = store.createSnapshotStore(initial.value.maxTextChars);
	const availableProviders = store.createSnapshotStore(initial.value.availableProviders);
	acceptedRevision = lastReadRevision;
	function refresh(): void {
		if (updating !== void 0 || acceptedRevision < 0 || isDisposed()) return;
		updating = (async () => {
			try {
				const result = await read();
				if (result?.ok) {
					preferences.set(result.value.preferences);
					translationLimit.set(result.value.maxTextChars);
					availableProviders.set(result.value.availableProviders);
					acceptedRevision = lastReadRevision;
				}
			} catch (_error) {
				if (!isDisposed()) ctx.logger.warn("cot-translation: could not refresh Host preferences and request limits");
			}
		})().finally(() => {
			updating = void 0;
			if (revision !== lastReadRevision && !isDisposed()) refresh();
		});
	}
	const scope = ctx.configForms.get("cot-translation");
	ctx.effect(() => scope.subscribe(invalidate));
	// 25/10/2026 — thêm bản tiếng Việt (yêu cầu chủ dự án: dịch cả panel setup của cot-translation).
	ctx.effect(() => ctx.locale.register(NS, { en, zh, vi }));
	const form = new TranslationPreferencesForm(scope);
	ctx.effect(() => () => {
		form.dispose();
	});
	const injected = (sessionId: NonNullable<TranslationRequest["sessionId"]>) => ({
		hooks: {
			preferences,
			translationLocale: ctx.locale,
			translationLimit,
		},
		translate: async (request: TranslationRequest, signal: AbortSignal): Promise<string> => {
			if (acceptedRevision !== revision) refresh();
			while (updating !== void 0) await updating;
			signal.throwIfAborted();
			const accepted = preferences.getSnapshot();
			if (
				isDisposed() ||
				acceptedRevision !== revision ||
				request.provider !== accepted.provider ||
				(accepted.targetLanguage !== "auto" && request.targetLanguage !== accepted.targetLanguage) ||
				request.text.length > translationLimit.getSnapshot()
			)
				throw new Error("Translation preferences or limits changed");
			const result = await ctx.remote.cotTranslation.translate(
				{
					...request,
					sessionId,
				},
				signal,
			);
			if (!result.ok) throw result.error;
			return result.value;
		},
	});
	ctx.slots.inject("conversation.chat.reasoning.body", () =>
		ctx.slots.register(
			{
				name: "conversation.chat.reasoning.body",
				locale: NS,
				inject: injected,
			},
			TranslationBody,
		),
	);
	ctx.slots.inject("plugins.bundle.config", () =>
		ctx.slots.register(
			{
				name: "plugins.bundle.config",
				// 25/10/2026 — key phải là TÊN BUNDLE CỦA TA: plugin-manager tra `plugins.bundle.config` theo
				// `pkg.name` của bundle. Để tên stock thì trang "Dịch máy suy luận" KHÔNG hiện mục setup.
				key: "@galaxy-blackhole/gbh-cot-translation-bundle",
				locale: NS,
				inject: () => {
					const face = form.inject();
					return {
						...face,
						hooks: {
							...face.hooks,
							availableProviders,
						},
						refreshProviders: invalidate,
					};
				},
			},
			TranslationSettings,
		),
	);
}

/**
 * Mount dịch suy luận gắn phiên và rút UI trước Remote đã sinh của nó.
 * Nhận: ctx — vòng đời plugin phía client; contribution — định nghĩa Remote đã sinh của row.
 * Trả: hàm gỡ (gỡ cả hai contribution); ném lỗi và dọn dẹp khi mount UI hỏng.
 */
export async function mountTranslation(ctx: ClientContextLike, contribution: unknown): Promise<() => Promise<void>> {
	const lifetime = new AbortController();
	ctx.on("internal/plugin", (fiber) => {
		if (fiber === ctx.fiber && fiber.uid === null) lifetime.abort();
	});
	ctx.effect(
		() => () => {
			lifetime.abort();
		},
		"cot-translation: query cancellation",
	);
	const unmountRemote = await ctx.remote.$mount(contribution);
	const ui = ctx.inject(["remote.cotTranslation", ...inject.slice(1)], (child) => registerUi(child, lifetime));
	try {
		await ui;
	} catch (error) {
		await ui.dispose();
		await unmountRemote();
		throw error;
	}
	return async () => {
		await ui.dispose();
		await unmountRemote();
	};
}
