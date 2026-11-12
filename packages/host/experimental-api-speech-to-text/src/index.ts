/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ai/dsh-experimental-api-speech-to-text
 *      (host-only, stock lib/index.js 219 dòng): Remote service `speechController` (namespace `speech`)
 *      phơi catalog/follow/configure/prepare/cancelPreparation/transcribe, uỷ quyền cho seam
 *      `speechToText` của Host và không bao giờ tạo event Session.
 */

import type { Context } from "@deepseek-ai/cordis";
// 08/11/2026 (dev-1, chỉ định của Lead): bản port GBH của gói speech-to-text KHÔNG tái khai augmentation
// `declare module "@deepseek-ai/cordis"` của bản gốc ⇒ `ctx.speechToText` không còn trên kiểu `Context`. Thay bằng
// SEAM CẤU TRÚC (ADR 000d): lấy kiểu dịch vụ từ CHÍNH lớp mặc định của gói GBH rồi đọc seam qua `ctx.get()`.
import type SpeechToText from "@galaxy-blackhole/gbh-experimental-speech-to-text";
import type {
  SpeechPreparationOptions,
  SpeechProviderId,
  SpeechSelectionPatch,
  Transcript,
} from "@galaxy-blackhole/gbh-experimental-speech-to-text/types";
import { validateWave } from "@galaxy-blackhole/gbh-experimental-speech-to-text/wave";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";

import type { SpeechCatalog, TranscriptionRequest } from "./types.ts";

export type * from "./types.ts";

/**
 * Mặt cấu trúc của seam `speechToText` mà plugin tiêu thụ — LẤY NGUYÊN từ lớp dịch vụ mặc định của gói GBH
 * (không tự đoán chữ ký), nên nếu gói kia đổi API thì typecheck của ta đỏ ngay.
 */
type SpeechToTextSeamLike = SpeechToText;

/**
 * Lấy seam `speechToText`, thiếu là lỗi cấu hình nên ném NGAY.
 * Nhận: `ctx` — context Host. Trả: mặt cấu trúc của dịch vụ speech-to-text.
 */
function speechToTextOf(ctx: Context): SpeechToTextSeamLike {
  // Kernel công bố service theo HAI đường cùng nghĩa: `ctx.get(name)` và thuộc tính `ctx.<name>`.
  const viaGet = typeof ctx.get === "function" ? (ctx.get("speechToText") as SpeechToTextSeamLike | undefined) : undefined;
  const viaProperty = (ctx as unknown as { readonly speechToText?: SpeechToTextSeamLike }).speechToText;
  const seam = viaGet ?? viaProperty;
  if (seam === undefined) {
    throw new TypeError('experimental-api-speech-to-text requires the speechToText seam (ctx.get("speechToText"))');
  }
  return seam;
}

/** Giới hạn áp trước khi giải mã base64 hoặc gọi provider. */
export interface Config {
  /** Số byte WAV đã giải mã tối đa cho mỗi request. */
  maxAudioBytes: number;
  /** Thời lượng PCM tối đa của bản ghi, tính bằng giây. */
  maxDurationSeconds: number;
}

/**
 * Speech calls never activate or submit to an Agent.
 *
 * Remote controller của khả năng speech (thử nghiệm): `transcribe` trả transcript trần và không
 * thêm event Session. Peer @deepseek-ai/dsh-typert-protocol là seam RPC của kernel nên lớp này PHẢI
 * kế thừa đúng base class để Gateway discovery được.
 *
 * @module @galaxy-blackhole/gbh-experimental-api-speech-to-text
 */
export default class SpeechController extends TypertRemoteService {
  /** Seam cần có: registry nhận dạng và Typert Gateway. */
  static inject = ["speechToText", "typert"];

  /** Cấu hình Schemastery: giới hạn byte và số giây của một bản ghi (mặc định như bản gốc). */
  static Config = z.object({
    maxAudioBytes: z.natural().min(46).default(4 * 1024 * 1024),
    maxDurationSeconds: z.number().min(1).default(120),
  });

  /** Giới hạn đã resolve từ config của plugin. */
  private readonly config: Config;

  /**
   * Đăng ký service `speechController` và bind cùng key vào Typert Gateway với namespace `speech`.
   * @param ctx - context của plugin.
   * @param config - giới hạn byte/thời lượng đã validate.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "speechController", { namespace: "speech" });
    this.config = config;
  }

  /**
   * Read provider choices without preparing a recognizer.
   * @returns available providers, resolved default, and recording limits.
   */
  @Remote
  catalog(): SpeechCatalog {
    return {
      ...speechToTextOf(this.ctx).snapshot(),
      ...this.config,
    };
  }

  /**
   * Follow provider readiness independently of Session and preparation lifetimes.
   * @param signal - Client observation lifetime.
   * @returns initial and subsequent complete readiness snapshots.
   */
  @Remote({ mode: "stream" })
  async *follow(signal: AbortSignal): AsyncIterable<SpeechCatalog> {
    for await (const snapshot of speechToTextOf(this.ctx).follow(signal)) {
      yield {
        ...snapshot,
        ...this.config,
      };
    }
  }

  /**
   * Persist the user's recognition preferences.
   * @param patch - changed preference fields.
   * @returns after preferences are saved.
   */
  @Remote
  configure(patch: SpeechSelectionPatch): Promise<void> {
    return speechToTextOf(this.ctx).configure(patch);
  }

  /**
   * Start or join one Host-owned preparation task.
   * @param providerId - selected recognizer.
   * @param options - task-local source selection validated by the provider.
   */
  @Remote
  prepare(providerId: SpeechProviderId, options?: SpeechPreparationOptions): void {
    speechToTextOf(this.ctx).prepare(providerId, options);
  }

  /**
   * Explicitly cancel resource preparation.
   * @param providerId - selected recognizer.
   * @returns after the preparation task settles.
   */
  @Remote
  cancelPreparation(providerId: SpeechProviderId): Promise<void> {
    return speechToTextOf(this.ctx).cancelPreparation(providerId);
  }

  /**
   * Validate and transcribe one recording through the explicit provider selection.
   * @param request - canonical WAV encoded as base64, provider id and language hint.
   * @param signal - Client cancellation or Remote contribution disposal.
   * @returns final transcript without adding a Session event.
   */
  @Remote
  async transcribe(request: TranscriptionRequest, signal: AbortSignal): Promise<Transcript> {
    signal.throwIfAborted();
    const encoded = request.audioBase64;
    if (encoded.length > Math.ceil(this.config.maxAudioBytes / 3) * 4) {
      throw new RemoteError("speech/invalid-audio", "Audio is invalid or exceeds the configured byte limit", {
        reason: "encoding-or-size",
      });
    }
    const audio = Buffer.from(encoded, "base64");
    try {
      if (audio.toString("base64") !== encoded) throw new Error("Audio must use canonical base64 encoding");
      if (audio.length > this.config.maxAudioBytes) throw new Error("Audio exceeds the configured byte limit");
      validateWave(audio, this.config.maxDurationSeconds);
      const spec = speechToTextOf(this.ctx).resolve({
        audio,
        ...(request.providerId === undefined ? {} : { providerId: request.providerId }),
        ...(request.language === undefined ? {} : { language: request.language }),
      });
      return await speechToTextOf(this.ctx).transcribe(spec, signal);
    } catch (error) {
      signal.throwIfAborted();
      const reason = error instanceof Error ? error.message : String(error);
      throw new RemoteError("speech/transcription-failed", reason, { reason });
    }
  }
}

/** Bổ sung `ctx.speechController` cho consumer TypeScript (như `lib/types/index.d.ts` của bản gốc). */
declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Experimental speech Remote controller. */
    speechController: SpeechController;
  }
}
