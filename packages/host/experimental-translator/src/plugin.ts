/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Service `translator`: dịch văn bản ẩn danh qua endpoint Google/Bing hoặc route DeepSeek trả phí, có Session bền cho kết quả đã lưu, huỷ được và gỡ nạp tĩnh lặng — port 1:1 'lib/types/index.js' của @deepseek-ai/dsh-experimental-translator; khối 'declare module @deepseek-ai/cordis' của index.d.ts KHÔNG port (repo CẤM declare module — ADR 000d).
 */

import { Service, type Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { addAbortListener } from "node:events";
import { assertNever } from "@deepseek-ai/dsh-util-values";
import { TranslationError } from "./error.ts";
import { anonymousRecipe, translateText } from "./provider.ts";
import { TranslationStorage } from "./storage.ts";
import { availablePaidProviders, deepseekRecipe, translateWithDeepSeek } from "./deepseek.ts";
import type {
  PaidTranslationSpec,
  TranslationIdentity,
  TranslationProvider,
  TranslationRequest,
  TranslationSpec,
} from "./types.ts";

/**
 * Tái xuất lớp lỗi dịch an toàn để người dùng module không phải import sâu (NGUYÊN VĂN bản gốc).
 * Nhận: không.
 * Trả: lớp `TranslationError` của `./error.ts`.
 */
export { TranslationError } from "./error.ts";

/**
 * Tái xuất toàn bộ mặt kiểu của `./types.ts` (NGUYÊN VĂN `export type *` của bản gốc).
 * Nhận: không.
 * Trả: không (chỉ tái xuất kiểu).
 */
export type * from "./types.ts";

/**
 * Định tuyến và các trần cho yêu cầu ẩn danh và bản dịch mô hình native độc lập.
 * Nhận: không (kiểu chỉ mô tả hình dạng giá trị cấu hình đã được schema xác thực).
 * Trả: không (kiểu chỉ mô tả hình dạng giá trị cấu hình đã được schema xác thực).
 */
export interface Config {
  /** Provider được chọn khi bên gọi bỏ qua. */
  provider: TranslationProvider;
  /** Endpoint dịch ẩn danh tương thích Google. */
  googleEndpoint: string;
  /** Endpoint dịch trình duyệt Microsoft Edge tương thích Bing. */
  bingEndpoint: string;
  /** Hạn chót bao trùm yêu cầu và toàn bộ thân phản hồi, tính bằng mili giây. */
  timeoutMs: number;
  /** Số code unit UTF-16 tối đa mỗi yêu cầu; ít nhất hai để nhận một ký tự ngoài mặt phẳng cơ bản. */
  maxTextChars: number;
  /** Số byte thân JSON ẩn danh tối đa, hoặc số byte UTF-8 của bản dịch trả phí đã lắp ghép. */
  maxResponseBytes: number;
  /** Hạn chót cho việc nhận native và toàn bộ đầu ra dịch, tính bằng mili giây. */
  deepseekTimeoutMs: number;
  /** Trần số token đầu ra được yêu cầu cho bản dịch Flash native độc lập. */
  deepseekMaxOutputTokens: number;
}

/**
 * Chuẩn hoá endpoint dịch thành URL HTTP(S) tuyệt đối, không credential, không fragment.
 * Nhận: `value` — chuỗi URL thô từ cấu hình.
 * Trả: `url.href` đã chuẩn hoá.
 * @throws {TypeError} khi `value` không phải URL hợp lệ (do `new URL`).
 * @throws {Error} khi URL không phải HTTP(S) hoặc có username/password/fragment — thông điệp NGUYÊN VĂN
 *   `Translation endpoint must be an HTTP(S) URL without credentials or a fragment`.
 */
function endpoint(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username !== "" || url.password !== "" || url.hash !== "") {
    throw new Error("Translation endpoint must be an HTTP(S) URL without credentials or a fragment");
  }
  return url.href;
}

/**
 * Một Host service với định tuyến tường minh, huỷ được và gỡ nạp tĩnh lặng.
 * Nhận: `ctx` — context Cordis nơi service được đăng ký; `config` — cấu hình đã được schema `Config` xác thực.
 * Trả: thực thể service đã đăng ký dưới tên `translator`.
 */
export default class Translator extends Service {
  /**
   * Schema Schemastery của cấu hình — NGUYÊN VĂN tám trường, giá trị mặc định và phép biến đổi endpoint của bản gốc.
   * Nhận: không (schema dựng một lần lúc nạp module).
   * Trả: schema xác thực `Config`; mặc định provider `bing`, hai endpoint công khai, timeout 10 giây,
   *   tối đa 4.000 code unit, 1 MiB phản hồi, 60 giây và 8192 token cho route DeepSeek.
   */
  static Config: z<Config> = z.object({
    provider: z.union(["google", "bing", "deepseek-account", "deepseek-official"]).default("bing"),
    googleEndpoint: z.transform(z.string(), endpoint).default("https://translate.googleapis.com/translate_a/single"),
    bingEndpoint: z.transform(z.string(), endpoint).default("https://edge.microsoft.com/translate/translatetext"),
    timeoutMs: z.natural().min(1).max(2_147_483_647).default(10_000),
    maxTextChars: z.natural().min(2).default(4_000),
    maxResponseBytes: z.natural().min(1).default(1024 * 1024),
    deepseekTimeoutMs: z.natural().min(1).max(2_147_483_647).default(60_000),
    deepseekMaxOutputTokens: z.natural().min(1).default(8192),
  }) as unknown as z<Config>;

  /** Cấu hình đã xác thực của service. */
  private readonly config: Config;

  /** Vòng đời service: huỷ ở đây là huỷ mọi việc đang chạy và chặn mọi lần gọi mới. */
  private readonly lifetime: AbortController = new AbortController();

  /** Mọi việc đã nhận, giữ tới khi tất toán để việc gỡ nạp đợi được. */
  private readonly pending: Set<Promise<void>> = new Set();

  /** Kho bản dịch bền qua writer của Session hiện có. */
  private readonly storage: TranslationStorage;

  /**
   * Đăng ký service `translator`, dựng kho bản dịch bền và đăng ký effect gỡ nạp.
   * Nhận: `ctx` — context Cordis nơi service được đăng ký; `config` — cấu hình đã được schema `Config` xác thực.
   * Trả: thực thể `Translator` đã đăng ký dưới tên `translator`.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "translator");
    this.config = config;
    this.storage = new TranslationStorage(ctx);
    ctx.effect(() => async () => {
      this.lifetime.abort(new Error("Translator service disposed"));
      await Promise.allSettled(this.pending);
    });
  }

  /**
   * Số code unit UTF-16 tối đa mà một yêu cầu provider chấp nhận.
   * Nhận: không.
   * Trả: `config.maxTextChars`.
   */
  get maxTextChars(): number { return this.config.maxTextChars; }

  /**
   * Kiểm tra các route native đủ tư cách mà không suy luận; kết quả đã lưu vẫn đọc được với route không dùng được.
   * Nhận: `signal` — huỷ tuỳ chọn của bên gọi, được gộp với việc gỡ service.
   * Trả: các lựa chọn ẩn danh, rồi tới các route trả phí được chọn tường minh và đủ tư cách.
   * @throws {unknown} lý do huỷ của bên gọi hoặc của service, ném nguyên trạng.
   */
  async availableProviders(signal?: AbortSignal): Promise<readonly TranslationProvider[]> {
    const combined = this.signal(signal);
    const task: Promise<readonly TranslationProvider[]> = Promise.resolve().then(() => availablePaidProviders(this.ctx, this.config, combined, (work) => { this.track(work); }));
    this.track(task);
    return task;
  }

  /**
   * Phân giải provider và mặc định ngôn ngữ nguồn mà không gửi văn bản.
   * Nhận: `request` — văn bản, ngôn ngữ đích và lựa chọn định tuyến tuỳ chọn của bên gọi.
   * Trả: một đặc tả đầy đủ; vượt `maxTextChars` thì ném `TRANSLATION_TEXT_LIMIT`.
   * @throws {TranslationError} `TRANSLATION_TEXT_LIMIT` khi văn bản vượt trần; `TRANSLATION_SESSION_REQUIRED`
   *   khi route trả phí thiếu Session bền.
   * @throws {unknown} lý do huỷ khi service đã bị gỡ, ném nguyên trạng.
   */
  resolve(request: TranslationRequest): TranslationSpec {
    this.lifetime.signal.throwIfAborted();
    this.assertTextLimit(request.text);
    const provider: TranslationProvider = request.provider ?? this.config.provider;
    const base: { text: string; targetLanguage: string; sourceLanguage: string } = { text: request.text, targetLanguage: request.targetLanguage, sourceLanguage: request.sourceLanguage ?? "auto" };
    switch (provider) {
      case "google":
      case "bing": return { ...base, provider, ...request.sessionId === undefined ? {} : { sessionId: request.sessionId } };
      case "deepseek-account":
      case "deepseek-official": {
        if (request.sessionId === undefined)
          throw new TranslationError("TRANSLATION_SESSION_REQUIRED", "Paid translation requires a durable Session");
        return { ...base, provider, sessionId: request.sessionId };
      }
      /* v8 ignore next -- TranslationProvider là hợp kiểu đóng, đã được Config hoặc tiếp nhận request Remote xác thực. */
      default: return assertNever(provider);
    }
  }

  /**
   * Dịch một đặc tả đã phân giải; provider được chọn nhận văn bản của nó.
   * Nhận: `spec` — định tuyến và lựa chọn ngôn ngữ đầy đủ từ `resolve()`; `signal` — huỷ tuỳ chọn
   *   của bên gọi, được gộp với việc gỡ service.
   * Trả: văn bản thuần đã dịch, được giữ bền trước khi trả về khi có Session.
   *   Session được cung cấp mà cache trượt phải đang sống; nếu không thì từ chối với
   *   `TRANSLATION_SESSION_INACTIVE` TRƯỚC khi gửi đi.
   * @throws {TranslationError} lỗi provider/kho/giới hạn (ví dụ `TRANSLATION_TEXT_LIMIT`,
   *   `TRANSLATION_SESSION_INACTIVE`, `TRANSLATION_TIMEOUT`, `TRANSLATION_UNAVAILABLE`).
   * @throws {unknown} lý do huỷ của bên gọi hoặc của service, ném nguyên trạng.
   */
  async translate(spec: TranslationSpec, signal?: AbortSignal): Promise<string> {
    this.assertTextLimit(spec.text);
    const combined = this.signal(signal);
    const identity: TranslationIdentity = { provider: spec.provider, text: spec.text, sourceLanguage: spec.sourceLanguage,
      targetLanguage: spec.targetLanguage, recipe: spec.provider === "google" || spec.provider === "bing"
        ? anonymousRecipe(spec.provider, this.config) : deepseekRecipe(this.config) };
    const inSession = (id: PaidTranslationSpec["sessionId"]): Promise<string> => this.storage.run(id, identity, combined, async (log): Promise<string> => {
      switch (spec.provider) {
        case "deepseek-account":
        case "deepseek-official":
          return translateWithDeepSeek(this.ctx, spec, this.config, combined, (work) => { this.track(work); }, log, identity);
        case "google":
        case "bing": {
          const requestSeq = await log.request(identity);
          combined.throwIfAborted();
          const text: string = await translateText(spec, this.config, combined);
          combined.throwIfAborted();
          await log.result(requestSeq, text);
          return text;
        }
        /* v8 ignore next -- TranslationSpec có hợp provider đóng, đã phân giải trước khi gửi trong cùng tiến trình. */
        default: return assertNever(spec);
      }
    });
    const task: Promise<string> = Promise.resolve().then(() => {
      switch (spec.provider) {
        case "google":
        case "bing": return spec.sessionId === undefined ? translateText(spec, this.config, combined) : inSession(spec.sessionId);
        case "deepseek-account":
        case "deepseek-official": return inSession(spec.sessionId);
        /* v8 ignore next -- TranslationSpec có hợp provider đóng, đã phân giải trước khi gửi trong cùng tiến trình. */
        default: return assertNever(spec);
      }
    });
    this.track(task);
    return await new Promise<string>((resolve, reject) => {
      const listener: Disposable = addAbortListener(combined, () => {
        // Giữ nguyên lý do huỷ tuỳ ý của bên gọi; việc đã nhận vẫn thuộc service tới khi tất toán.
        reject(combined.reason);
      });
      void task.then(resolve, reject).finally(() => { listener[Symbol.dispose](); });
    });
  }

  /**
   * Gộp tín hiệu của bên gọi với vòng đời service và từ chối ngay nếu đã huỷ.
   * Nhận: `caller` — tín hiệu tuỳ chọn của bên gọi.
   * Trả: tín hiệu của service khi không có `caller`, ngược lại là tín hiệu gộp của cả hai.
   * @throws {unknown} lý do huỷ của service hoặc của bên gọi, ném nguyên trạng.
   */
  private signal(caller?: AbortSignal): AbortSignal {
    this.lifetime.signal.throwIfAborted();
    const signal: AbortSignal = caller === undefined ? this.lifetime.signal : AbortSignal.any([caller, this.lifetime.signal]);
    signal.throwIfAborted();
    return signal;
  }

  /**
   * Theo dõi một việc đã nhận tới khi tất toán, để việc gỡ nạp đợi được.
   * Nhận: `work` — việc cần theo dõi (thành công hay thất bại đều được).
   * Trả: không.
   */
  private track(work: Promise<unknown>): void {
    const settled: Promise<void> = work.then(() => { }, () => { });
    this.pending.add(settled);
    void settled.then(() => { this.pending.delete(settled); });
  }

  /**
   * Từ chối văn bản vượt trần code unit UTF-16 của cấu hình.
   * Nhận: `text` — văn bản cần kiểm.
   * Trả: không.
   * @throws {TranslationError} `TRANSLATION_TEXT_LIMIT` với thông điệp NGUYÊN VĂN
   *   `Translation text exceeds <maxTextChars> UTF-16 code units`.
   */
  private assertTextLimit(text: string): void {
    if (text.length > this.config.maxTextChars) {
      throw new TranslationError("TRANSLATION_TEXT_LIMIT", `Translation text exceeds ${this.config.maxTextChars} UTF-16 code units`);
    }
  }
}
