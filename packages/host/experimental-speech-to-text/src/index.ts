/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cổng 1:1 của @deepseek-ai/dsh-experimental-speech-to-text (stock lib/index.js 201 dòng +
 *      lib/types/*.d.ts, host-only): registry provider phiên âm có đăng ký huỷ được và định tuyến
 *      tường minh — service ctx.speechToText, Config hai tham chiếu sống, không đổi hành vi.
 */

/**
 * Phiên âm giọng nói thử nghiệm với các provider chọn độc lập. Một Host composition chia sẻ
 * đúng một registry: provider đăng ký kèm vòng đời riêng, người gọi đọc được danh sách, trạng
 * thái chuẩn bị và lựa chọn mặc định, rồi ghim đúng một provider cho mỗi lượt phiên âm.
 *
 * Đăng ký là huỷ được: bộ huỷ từ chối nhận thêm, huỷ việc đang chạy của provider đó và chờ nó
 * ổn định. Không có dự phòng — audio đã giải chỉ tới đúng provider đã ghim, và một đăng ký đã
 * bị rút hay bị thay thế sẽ bị từ chối thay vì lặng lẽ đi tiếp.
 *
 * @module @galaxy-blackhole/gbh-experimental-speech-to-text
 */

import { Service, type Context, type Volatile } from "@deepseek-ai/cordis";
// Chỉ nạp KIỂU: augmentation `Fiber.entry` của Loader cho phép đọc id mục profile như bản gốc.
// Import type bị xoá khi build nên artifact không có specifier này.
import type {} from "@deepseek-ai/cordis-plugin-loader";
// Chỉ nạp KIỂU: augmentation `Context.settings` (SettingsForms.update) như bản gốc.
import type {} from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
import type {
  SpeechPreparationOptions,
  SpeechProvider,
  SpeechProviderId,
  SpeechProviderInfo,
  SpeechSelectionPatch,
  SpeechRequest,
  SpeechSnapshot,
  SpeechSpec,
  Transcript,
} from "./types.ts";

export type * from "./types.ts";

// 19/10/2026 — BỎ augmentation `Context.speechToText` tại đây: d.ts của gói stock cũng khai cùng
// thuộc tính với LỚP của nó ⇒ TypeScript báo TS2717 (hai SpeechToText khác bản). Gói api-speech-to-text
// import d.ts stock nên augmentation vẫn có mặt trong chương trình; bản ta không cần khai lại.

/** Lựa chọn sống được đọc trước khi một lượt phiên âm bắt đầu; `configure()` ghi nó qua profile. */
export interface Config {
  /** Provider đã đăng ký được chọn khi người gọi bỏ qua id. */
  defaultProvider: Volatile<string>;
  /** Gợi ý ngôn ngữ của provider được chọn khi người gọi bỏ qua. */
  language: Volatile<string>;
}

/** Một đăng ký provider do service sở hữu: vòng đời riêng, việc đang chạy, và hàm huỷ nghe trạng thái. */
interface SpeechProviderRegistration {
  /** Bộ nhận dạng do fiber đóng góp sở hữu. */
  provider: SpeechProvider;
  /** Vòng đời của riêng đăng ký này; huỷ khi provider bị rút. */
  lifetime: AbortController;
  /** Các lượt `transcribe()` đã được nhận và chưa ổn định. */
  pending: Set<Promise<Transcript>>;
  /** Huỷ đăng ký nghe trạng thái chuẩn bị của provider. */
  unsubscribe: () => void;
}

/** Registry dùng chung cho mọi consumer phiên âm trong một Host composition. */
export default class SpeechToText extends Service {
  /** Cấu hình sống do tầng nạp cấp — KHÔNG sao chép giá trị lúc dựng. */
  private readonly config: Config;

  /**
   * Schema cấu hình — hai trường dạng tham chiếu sống (`volatile()`) để Settings sửa được mà
   * không dựng lại plugin. `defaultProvider` bắt buộc và không rỗng; `language` mặc định
   * `"auto"` như bản gốc.
   */
  static Config = z.object({
    defaultProvider: z.string().min(1).required().volatile(),
    language: z.string().min(1).default("auto").volatile(),
  });

  /** Provider đang có mặt, theo thứ tự đăng ký. */
  private readonly providers = new Map<SpeechProviderId, SpeechProviderRegistration>();

  /** Người nghe thay đổi danh sách/trạng thái; `follow()` đăng ký một listener mỗi lượt đọc. */
  private readonly listeners = new Set<() => void>();

  /** Vòng đời của cả service; huỷ khi plugin xuống, làm mọi lượt đọc/ghi đang chờ tỉnh dậy. */
  private readonly lifetime = new AbortController();

  /** Id mục profile cục bộ dùng cho Settings; vắng khi plugin được mount không qua Loader. */
  private readonly entryId: string | undefined;

  /**
   * Đăng ký service dưới tên `speechToText` và hai lượt nghe của bản gốc.
   * Nhận: `ctx` — Context sở hữu plugin (đọc id mục profile qua `fiber.entry`); `config` — cấu
   * hình đã kiểm bởi `static Config` (hai tham chiếu sống).
   * Trả: không; hiệu ứng là service đã cấp trên Context và một effect dọn dẹp khi plugin xuống.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "speechToText");
    this.config = config;
    this.entryId = ctx.fiber.entry?.options.id;
    ctx.on("loader/volatile-update", () => {
      this.changed();
    });
    ctx.effect(() => async () => {
      this.lifetime.abort(new Error("Speech service disposed"));
      await Promise.all([...this.providers.values()].map((registration) => this.remove(registration)));
      this.listeners.clear();
    });
  }

  /**
   * Đăng ký một bộ nhận dạng; id trùng thì hỏng ngay, không thay bản gốc.
   * Nhận: `provider` — bộ nhận dạng do fiber đóng góp sở hữu.
   * Trả: hàm huỷ idempotent — từ chối nhận thêm, huỷ, rồi chờ mọi việc đã nhận ổn định.
   *
   * @param provider Bộ nhận dạng do fiber đóng góp sở hữu.
   * @returns Hàm huỷ idempotent của đăng ký này.
   */
  register(provider: SpeechProvider): () => Promise<void> {
    this.lifetime.signal.throwIfAborted();
    if (this.providers.has(provider.info.id)) {
      throw new Error(`Speech provider already registered: ${provider.info.id}`);
    }
    const registration: SpeechProviderRegistration = {
      provider,
      lifetime: new AbortController(),
      pending: new Set(),
      unsubscribe:
        provider.preparation?.subscribe(() => {
          this.changed();
        }) ?? (() => {}),
    };
    this.providers.set(provider.info.id, registration);
    this.changed();
    return async () => {
      await this.remove(registration);
    };
  }

  /**
   * Rút một đăng ký khỏi danh sách rồi chờ việc của nó ổn định; đăng ký đã bị thay thế thì bỏ qua.
   *
   * @param registration Đăng ký cần rút.
   * @returns Sau khi mọi lượt `transcribe()` đang chạy của đăng ký đã ổn định.
   */
  private async remove(registration: SpeechProviderRegistration): Promise<void> {
    if (this.providers.get(registration.provider.info.id) !== registration) return;
    this.providers.delete(registration.provider.info.id);
    registration.unsubscribe();
    this.changed();
    registration.lifetime.abort(new Error("Speech provider unloaded"));
    await Promise.allSettled(registration.pending);
  }

  /**
   * Đọc danh sách bộ nhận dạng hiện tại.
   * Nhận: không.
   * Trả: sự thật của provider đang có mặt, theo thứ tự đăng ký.
   *
   * @returns Sự thật provider theo thứ tự đăng ký.
   */
  listProviders(): readonly SpeechProviderInfo[] {
    return [...this.providers.values()].map(({ provider }) => provider.info);
  }

  /**
   * Báo cho mọi người nghe rằng danh sách hoặc trạng thái chuẩn bị vừa đổi.
   * Nhận: không. Trả: không.
   */
  private changed(): void {
    for (const listener of this.listeners) listener();
  }

  /**
   * Quan sát ảnh chụp sẵn sàng hoàn chỉnh; người đọc chậm sẽ gộp tiến độ trung gian lại.
   * Nhận: `caller` — vòng đời người quan sát, độc lập với mọi việc chuẩn bị.
   * Trả: một ảnh chụp đầu tiên, rồi các trạng thái provider mới nhất.
   *
   * @param caller Vòng đời của người quan sát.
   * @returns Chuỗi ảnh chụp `SpeechSnapshot`.
   */
  async *follow(caller: AbortSignal): AsyncIterable<SpeechSnapshot> {
    const signal = AbortSignal.any([caller, this.lifetime.signal]);
    signal.throwIfAborted();
    let wake = Promise.withResolvers<void>();
    let changed = true;
    const aborted = () => signal.aborted;
    const notify = () => {
      changed = true;
      wake.resolve(void 0);
    };
    this.listeners.add(notify);
    signal.addEventListener("abort", notify, { once: true });
    try {
      while (!aborted()) {
        if (!changed) await wake.promise;
        if (aborted()) break;
        wake = Promise.withResolvers();
        changed = false;
        yield this.snapshot();
      }
    } finally {
      this.listeners.delete(notify);
      signal.removeEventListener("abort", notify);
    }
  }

  /**
   * Đọc mức sẵn sàng của provider và lựa chọn hiện tại của người dùng cùng lúc.
   * Nhận: không.
   * Trả: một quan sát hoàn chỉnh, tách rời khỏi trạng thái nội bộ.
   *
   * @returns Ảnh chụp `SpeechSnapshot` tách rời.
   */
  snapshot(): SpeechSnapshot {
    return {
      providers: [...this.providers.values()].map(({ provider }) => ({
        ...provider.info,
        preparation: provider.preparation?.snapshot() ?? { phase: "ready" },
      })),
      selection: {
        // Config khai `Volatile<string>` y stock; danh tính lựa chọn là kiểu brand ⇒ ghim kiểu ở biên.
        providerId: this.config.defaultProvider.get() as SpeechProviderId,
        language: this.config.language.get(),
      },
    };
  }

  /**
   * Lưu các trường lựa chọn đã đổi vào mục profile của plugin này; ngôn ngữ kết quả phải được
   * provider đã chọn chấp nhận.
   * Nhận: `patch` — thay đổi provider hoặc ngôn ngữ tường minh.
   * Trả: sau khi đã ghi profile và áp cập nhật sống.
   *
   * @param patch Các trường lựa chọn cần đổi.
   * @returns Sau khi profile được ghi và lựa chọn sống được áp.
   */
  async configure(patch: SpeechSelectionPatch): Promise<void> {
    const settings = this.ctx.get("settings");
    const entry = this.entryId;
    if (settings === undefined || entry === undefined) {
      throw new Error("Speech selection requires the settings service and a profile entry");
    }
    const id = patch.providerId ?? (this.config.defaultProvider.get() as SpeechProviderId);
    this.selectedProvider(id, patch.language ?? this.config.language.get());
    await settings.update(entry, {
      ...(patch.providerId === void 0 ? {} : { defaultProvider: patch.providerId }),
      ...(patch.language === void 0 ? {} : { language: patch.language }),
    });
  }

  /**
   * Tra provider đã đăng ký và kiểm nó nhận ngôn ngữ yêu cầu.
   *
   * @param id Danh tính provider đã đăng ký.
   * @param language Gợi ý ngôn ngữ phải nằm trong danh sách provider chấp nhận.
   * @returns Bộ nhận dạng đã đăng ký.
   */
  private selectedProvider(id: SpeechProviderId, language: string): SpeechProvider {
    const registration = this.providers.get(id);
    if (!registration) throw new Error(`Speech provider is unavailable: ${id}`);
    if (!registration.provider.info.languages.includes(language)) {
      throw new Error(`Speech provider ${id} does not support language: ${language}`);
    }
    return registration.provider;
  }

  /**
   * Bắt đầu hoặc tham gia việc chuẩn bị do provider sở hữu.
   * Nhận: `id` — danh tính provider đã đăng ký; `options` — lựa chọn nguồn cục bộ của lượt do
   * provider kiểm.
   * Trả: không; việc chuẩn bị chạy dưới vòng đời của provider.
   *
   * @param id Danh tính chính xác của provider đã đăng ký.
   * @param options Lựa chọn nguồn của lượt (tuỳ chọn).
   */
  prepare(id: SpeechProviderId, options?: SpeechPreparationOptions): void {
    const registration = this.providers.get(id);
    if (!registration) throw new Error(`Speech provider is unavailable: ${id}`);
    registration.provider.preparation?.prepare(options);
  }

  /**
   * Huỷ việc chuẩn bị của provider một cách tường minh, không buộc vào kết nối trình duyệt.
   * Nhận: `id` — danh tính provider đã đăng ký.
   * Trả: sau khi việc chuẩn bị ổn định.
   *
   * @param id Danh tính chính xác của provider đã đăng ký.
   * @returns Sau khi việc chuẩn bị ổn định.
   */
  async cancelPreparation(id: SpeechProviderId): Promise<void> {
    const registration = this.providers.get(id);
    if (!registration) throw new Error(`Speech provider is unavailable: ${id}`);
    await registration.provider.preparation?.cancel();
  }

  /**
   * Áp mặc định của composition và ghim provider đã chọn. Provider thiếu hoặc ngôn ngữ không
   * được hỗ trợ đều hỏng tường minh.
   * Nhận: `request` — bản ghi âm hoàn chỉnh và lựa chọn tuỳ chọn.
   * Trả: đầu vào đã ghim provider cho `transcribe()`.
   *
   * @param request Bản ghi âm và lựa chọn tuỳ chọn.
   * @returns Đặc tả đã ghim đúng provider.
   */
  resolve(request: SpeechRequest): SpeechSpec {
    const id = request.providerId ?? (this.config.defaultProvider.get() as SpeechProviderId);
    const language = request.language ?? this.config.language.get();
    return {
      provider: this.selectedProvider(id, language),
      audio: request.audio,
      language,
    };
  }

  /**
   * Thực thi đúng provider đã giải; không có dự phòng nào gửi audio đi nơi khác.
   * Nhận: `spec` — đầu vào đã giải (đăng ký đã rút hoặc đã bị thay thế thì bị từ chối);
   * `signal` — huỷ từ người gọi.
   * Trả: bản phiên âm cuối sau khi provider ổn định.
   *
   * @param spec Đầu vào đã ghim provider.
   * @param signal Tín hiệu huỷ của người gọi.
   * @returns Bản phiên âm cuối.
   */
  async transcribe(spec: SpeechSpec, signal: AbortSignal): Promise<Transcript> {
    signal.throwIfAborted();
    const registration = this.providers.get(spec.provider.info.id);
    if (registration?.provider !== spec.provider) {
      throw new Error("Resolved speech provider is no longer registered");
    }
    const combined = AbortSignal.any([signal, registration.lifetime.signal]);
    const pending = Promise.resolve().then(() => {
      combined.throwIfAborted();
      return spec.provider.transcribe(
        {
          audio: spec.audio,
          language: spec.language,
        },
        combined,
      );
    });
    registration.pending.add(pending);
    try {
      const result = await pending;
      combined.throwIfAborted();
      return result;
    } finally {
      registration.pending.delete(pending);
    }
  }
}
