/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Entry plugin provider SenseVoice cục bộ — đăng ký recognizer + soi cache đĩa mà KHÔNG tải/nạp mô hình
 *      lúc kích hoạt; port 1:1 region lib/types/index.js (stock lib/index.js:912–957).
 */
import { isAbsolute } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import "@galaxy-blackhole/gbh-experimental-speech-to-text/wave";
import type { SpeechProvider, SpeechProviderId } from "@galaxy-blackhole/gbh-experimental-speech-to-text";
import type { Config } from "./config.ts";
import { languages } from "./input.ts";
import { SenseVoiceWorker } from "./recognizer.ts";

export { Config } from "./config.ts";

/**
 * Hình dạng seam `speechToText` mà plugin tiêu thụ — CHỈ phần dùng (ADR 000d, 08/11/2026 dev-1).
 * Lý do: bản port của gói GBH không tái khai augmentation `declare module "@deepseek-ai/cordis"` của bản gốc, nên
 * `ctx.speechToText` không còn tồn tại trên kiểu `Context`; dùng `ctx.get()` + mặt cấu trúc, thiếu seam là nổ NGAY.
 */
interface SpeechToTextSeamLike {
  /** Đăng ký một provider; trả hàm gỡ (bất đồng bộ) đúng như sổ đăng ký của kernel. */
  register(provider: SpeechProvider): () => Promise<void>;
}

/**
 * Lấy seam `speechToText` từ context, thiếu là lỗi cấu hình nên ném NGAY thay vì chạy tiếp với `undefined`.
 * Nhận: `ctx` — context Host. Trả: mặt cấu trúc của sổ đăng ký provider.
 */
function speechToTextOf(ctx: Context): SpeechToTextSeamLike {
  // Kernel công bố service theo HAI đường cùng nghĩa: `ctx.get(name)` và thuộc tính `ctx.<name>`. Đọc cả hai để
  // seam chạy được với cả context thật lẫn context giả của test (chỉ dựng thuộc tính), vẫn nổ NGAY khi thiếu.
  const viaGet = typeof ctx.get === "function" ? (ctx.get("speechToText") as SpeechToTextSeamLike | undefined) : undefined;
  const viaProperty = (ctx as unknown as { readonly speechToText?: SpeechToTextSeamLike }).speechToText;
  const seam = viaGet ?? viaProperty;
  if (seam === undefined) {
    throw new TypeError('experimental-speech-to-text-sensevoice requires the speechToText seam (ctx.get("speechToText"))');
  }
  return seam;
}

/** Id plugin dùng trong cây DSH (stock lib/index.js:914). */
export const name = "experimental-speech-to-text-sensevoice";

/** Seam bắt buộc: sổ đăng ký provider + chủ sở hữu tiến trình con (stock lib/index.js:915). */
export const inject = ["speechToText", "subprocess"];

/**
 * Đăng ký recognizer cục bộ và soi cache đĩa mà không tải hay nạp mô hình (stock lib/index.js:921–955).
 * Nhận: `ctx` — sổ đăng ký Host và chủ sở hữu subprocess; `config` — cấu hình runtime đã kiểm.
 * Trả: không; đăng ký sống theo effect của fiber và gỡ khi plugin unload.
 */
export function apply(ctx: Context, config: Config): void {
  for (const path of [
    config.dataRoot,
    config.modelDirectory,
    config.vadModelPath,
  ]) if (path !== void 0 && !isAbsolute(path)) throw new Error(`SenseVoice paths must be absolute: ${path}`);
  for (const origin of config.modelOrigin === void 0 ? config.modelOrigins : [config.modelOrigin]) new URL(origin);
  const worker = new SenseVoiceWorker(ctx, config);
  const estimatedBytes = config.precision === "int8" ? 1e9 : 2e9;
  ctx.effect(() => {
    const unregister = speechToTextOf(ctx).register({
      info: {
        id: config.providerId as SpeechProviderId,
        name: `SenseVoiceSmall (${config.precision.toUpperCase()})`,
        location: "host-local",
        languages,
        downloadSources: worker.downloadSources,
        setupEstimate: {
          recommendedDiskBytes: estimatedBytes,
          expectedMemoryBytes: estimatedBytes,
          minimumMinutes: 1,
          maximumMinutes: 10,
        },
      },
      preparation: worker,
      transcribe: async (input, signal) => await worker.transcribe(input, signal),
    });
    worker.inspect();
    return async () => {
      const removing = unregister();
      await worker.dispose();
      await removing;
    };
  });
}
