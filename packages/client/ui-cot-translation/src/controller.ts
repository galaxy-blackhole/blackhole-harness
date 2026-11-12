/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Translation (nửa host): service Remote cotTranslation — đọc
 *      tuỳ chọn dịch + hạn mức, và dịch một đoạn suy luận đã mở rộng qua translator của kernel
 */

import { addAbortListener } from "node:events";
import type { Context, Fiber, Volatile } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import type { TranslationError } from "@galaxy-blackhole/gbh-host-experimental-translator";
import type { TranslationProvider, TranslationRequest, TranslationSpec } from "@galaxy-blackhole/gbh-host-experimental-translator";
import { LANGUAGE_PREFERENCE_PATTERN, PROVIDER_PREFERENCES } from "./preferences.ts";
import type { CotTranslationPreferences, CotTranslationSnapshot } from "./types.ts";

/**
 * Nhận diện lớp lỗi theo TÊN, bền với MỌI bản sao mô-đun của cùng một lớp.
 * Vì sao (01/11/2026): `TranslationError` được import qua peer `@galaxy-blackhole/gbh-host-experimental-translator`; trong
 * giàn đo specifier đó phân giải về MỘT BẢN SAO khác kernel nên `instanceof` trượt, nhánh
 * `TRANSLATION_SESSION_INACTIVE` (kích hoạt phiên rồi thử lại) không chạy, người dùng nhận `cotTranslation/failed`
 * (đo được: 1 ca đỏ). Lớp gốc đặt `name` theo tên lớp CON nên phải dò tên lớp trên chuỗi prototype — đúng ngữ
 * nghĩa `instanceof` xuyên bản sao (cùng công thức ở packages/host/tools/src/error-identity.ts).
 * Nhận: error — giá trị bắt được; name — tên lớp cần khớp.
 * Trả: true khi chuỗi prototype của lỗi chứa một lớp mang đúng tên đó.
 */
function isNamedError(error: unknown, name: string): boolean {
  try {
    if (!(error instanceof Error)) return false;
    for (let proto: object | null = Object.getPrototypeOf(error); proto !== null; proto = Object.getPrototypeOf(proto)) {
      const ctor = (proto as { constructor?: { name?: string } }).constructor;
      if (typeof ctor === "function" && ctor.name === name) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Cấu hình của row: provider tường minh và ngôn ngữ đích (cả hai đều volatile như bản gốc). */
export interface Config {
  /** Provider dịch tường minh, mặc định Bing. */
  provider: Volatile<CotTranslationPreferences["provider"]>;
  /** Mã ngôn ngữ đích; auto theo ngôn ngữ UI của trình duyệt. */
  targetLanguage: Volatile<string>;
}

/** Kết quả kích hoạt phiên mà session controller trả về (chỉ trường plugin này đọc). */
interface ActivationResult {
  /** Lỗi kích hoạt, nếu có. */
  error?: Error;
}

/** Seam translator của kernel (chỉ phần plugin này dùng). */
interface TranslatorLike {
  /** Độ dài UTF-16 tối đa mỗi request. */
  readonly maxTextChars: number;
  /** Provider đang đủ điều kiện. */
  availableProviders: (signal?: AbortSignal) => Promise<readonly TranslationProvider[]>;
  /** Chuẩn hoá request thành spec đầy đủ. */
  resolve: (request: TranslationRequest) => TranslationSpec;
  /** Dịch một spec đã chuẩn hoá. */
  translate: (spec: TranslationSpec, signal?: AbortSignal) => Promise<string>;
}

/** Seam session controller của kernel (chỉ phần plugin này dùng). */
interface SessionControllerLike {
  /** Kích hoạt/khoanh vùng agent của phiên. */
  resolveAgent: (sessionId: string) => Promise<ActivationResult>;
}

/** Cấu hình settings của kernel (chỉ phần plugin này dùng). */
interface SettingsLike {
  /** Ghi một mẩu cấu hình vào phạm vi fiber. */
  configure: (value: { auto: boolean }, fiber?: unknown) => () => void;
}

/** Context con mà ctx.inject cấp. */
interface ChildContext {
  /** Service đã khai trong inject của context con. */
  settings: SettingsLike;
  /** Đăng ký hiệu ứng vòng đời của context con. */
  effect: (run: () => () => void) => void;
}

/** Context Host đã hẹp hoá — khai theo CẤU TRÚC như các gói khác của repo (không import gói seam). */
type HostContext = Context & {
  /** Service dịch của kernel. */
  translator: TranslatorLike;
  /** Service điều khiển phiên. */
  sessionController: SessionControllerLike;
  /** Logger của cordis. */
  logger: { warn: (message: string) => void };
  /** Fiber của plugin (settings.configure cần). */
  fiber: Fiber;
};

/**
 * Service Remote cotTranslation: tuỳ chọn dịch + hạn mức, và dịch đoạn suy luận đã mở rộng.
 *
 * Peer @deepseek-ai/dsh-typert-protocol + @galaxy-blackhole/gbh-host-experimental-translator thuộc seam của kernel:
 * lớp PHẢI kế thừa đúng base class đó để Gateway discovery được (giống row account-controller của ta).
 */
export default class CotTranslationController extends TypertRemoteService {
  /** Seam cần có trước khi mount: translator, typert gateway, session controller — nguyên văn bản gốc. */
  static inject = ["translator", "typert", "sessionController"];

  /** Schema cấu hình: provider mặc định bing, ngôn ngữ đích mặc định auto — nguyên văn bản gốc. */
  static Config = z.object({
    provider: z.union(PROVIDER_PREFERENCES).default("bing").volatile(),
    targetLanguage: z.string().pattern(LANGUAGE_PREFERENCE_PATTERN).default("auto").volatile(),
  });

  /** Cấu hình đã chuẩn hoá của row. */
  private readonly config: Config;

  /**
   * Đăng ký service cotTranslation và tắt chế độ settings tự động của translator (bản gốc: configure auto=false).
   * @param ctx - context của plugin.
   * @param config - cấu hình đã chuẩn hoá.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "cotTranslation", { namespace: "cotTranslation" });
    this.config = config;
    ctx.inject(["settings"], (child: unknown) => {
      const scope = child as ChildContext;
      scope.effect(() => scope.settings.configure({ auto: false }, ctx.fiber));
    });
  }

  /**
   * Đọc tuỳ chọn dịch đã chấp nhận và hạn mức hiện tại mà KHÔNG gửi văn bản đi.
   * @param signal - huỷ từ trình duyệt hoặc do Remote contribution bị gỡ.
   * @returns tuỳ chọn, route đủ điều kiện và độ dài UTF-16 tối đa mỗi request.
   */
  @Remote
  async limits(signal: AbortSignal): Promise<CotTranslationSnapshot> {
    const host = this.ctx as unknown as HostContext;
    signal.throwIfAborted();
    const availableProviders = await host.translator.availableProviders(signal);
    signal.throwIfAborted();
    return {
      maxTextChars: host.translator.maxTextChars,
      preferences: {
        provider: this.config.provider.get(),
        targetLanguage: this.config.targetLanguage.get(),
      },
      availableProviders,
    };
  }

  /**
   * Dịch một đoạn đang hiển thị qua provider mà người đọc đã chọn.
   * @param request - văn bản gốc + danh tính phiên do Client cấp; provider/ngôn ngữ đích phải khớp tuỳ chọn đã chấp nhận, auto dùng ngôn ngữ trình duyệt.
   * @param signal - huỷ từ trình duyệt hoặc do Remote contribution bị gỡ.
   * @returns văn bản đã dịch; phiên chưa kích hoạt sẽ được kích hoạt như GUI thường rồi thử lại.
   * @throws RemoteError mã cotTranslation/failed khi lỗi (KHÔNG kèm văn bản gốc lẫn phản hồi provider).
   */
  @Remote
  async translate(request: TranslationRequest, signal: AbortSignal): Promise<string> {
    const host = this.ctx as unknown as HostContext;
    signal.throwIfAborted();
    try {
      const spec = this.resolveSelected(request);
      try {
        return await host.translator.translate(spec, signal);
      } catch (error) {
        // Lỗi có thể đến từ MỘT BẢN SAO khác của peer ⇒ nhận diện theo tên lớp, KHÔNG theo `instanceof`.
        if (!isNamedError(error, "TranslationError") || (error as TranslationError).code !== "TRANSLATION_SESSION_INACTIVE" || spec.sessionId === undefined) throw error;
      }
      signal.throwIfAborted();
      // 19/10/2026 — KHÔI PHỤC đoạn kích hoạt phiên: bundle stock CÓ gọi resolveAgent (grep
      // apps/host/node_modules/@deepseek-ai/dsh-experimental-client-ui-cot-translation/lib/index.js = 1;
      // lib/client.js = 0 — lần đầu tôi grep nhầm client.js nên báo sai là "port thêm").
      // `ApiSessionAgentResult` là UNION `{ agent } | { error }` (kernel api-session-controller/lib/types/
      // agent.d.ts:60) ⇒ NARROW bằng `in` (không `as never`/`@ts-ignore`).
      const activation = host.sessionController
        .resolveAgent(spec.sessionId)
        .then((result) => {
          if ("error" in result) throw result.error;
        })
        .catch((error: unknown) => {
          if (signal.aborted) host.logger.warn("Reasoning translation Session activation failed after cancellation");
          throw error;
        });
      const cancelled = Promise.withResolvers<void>();
      const handle = addAbortListener(signal, () => {
        cancelled.reject(signal.reason as Error);
      });
      try {
        await Promise.race([activation, cancelled.promise]);
      } finally {
        handle[Symbol.dispose]();
      }
      signal.throwIfAborted();
      return await host.translator.translate(this.resolveSelected(spec), signal);
    } catch (_error) {
      signal.throwIfAborted();
      throw new RemoteError("cotTranslation/failed", "Translation failed", {});
    }
  }

  /**
   * Kiểm provider/ngôn ngữ đích của request có KHỚP tuỳ chọn đã chấp nhận, rồi chuẩn hoá thành spec.
   * @param request - request gốc hoặc spec đã chuẩn hoá (lượt thử lại).
   * @returns spec đầy đủ do translator của kernel chuẩn hoá.
   * @throws Error khi provider hoặc ngôn ngữ đích không phải tuỳ chọn đã chấp nhận (nguyên văn bản gốc).
   */
  private resolveSelected(request: TranslationRequest | TranslationSpec): TranslationSpec {
    const host = this.ctx as unknown as HostContext;
    const accepted = this.config.provider.get();
    const provider = request.provider ?? accepted;
    if (provider !== accepted) throw new Error("Translation provider is not selected");
    const targetLanguage = this.config.targetLanguage.get();
    if (targetLanguage !== "auto" && request.targetLanguage !== targetLanguage) throw new Error("Translation language is not selected");
    return host.translator.resolve({
      ...request,
      provider,
    });
  }
}