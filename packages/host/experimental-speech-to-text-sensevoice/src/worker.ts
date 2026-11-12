/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Entry tiến trình con RIÊNG TƯ: nạp recognizer native, nghe loopback, in `{"port":N}` rồi phục vụ
 *      transcript có xác thực — port 1:1 region lib/types/{inference,process-server,worker}.js
 *      (stock lib/worker.js:37–249). `sherpa-onnx-node` là dependency NATIVE, CHỈ cần ở runtime.
 */
import { timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import { validateWave } from "@galaxy-blackhole/gbh-experimental-speech-to-text/wave";
import { z } from "zod";
import { Config } from "./config.ts";
import { languages, SpeechInputError } from "./input.ts";

/** Cấu hình worker: cấu hình triển khai cộng ba đường dẫn ONNX do Host truyền (stock lib/worker.js:232–237). */
interface TranscriberConfig extends Config {
  /** Tệp ONNX SenseVoice đã xác minh. */
  readonly model: string;
  /** Tệp tokens.txt đã xác minh. */
  readonly tokens: string;
  /** Tệp Silero VAD ONNX đã xác minh. */
  readonly vad: string;
}

/** Kết quả MỘT lần nhận dạng của worker (khớp Transcript của seam). */
interface TranscriptionResult {
  /** Văn bản đã nhận, rỗng khi không có tiếng nói. */
  readonly text: string;
  /** Thời lượng audio đã kiểm (giây). */
  readonly audioSeconds: number;
  /** Thời gian suy luận (giây). */
  readonly inferenceSeconds: number;
}

/** Hàm nhận dạng đồng bộ bị giới hạn trong tiến trình chuyên dụng này. */
type Transcriber = (audio: Uint8Array, language: string) => TranscriptionResult;

/** Cấu hình feature của sherpa-onnx (16 kHz · 80 chiều). */
interface NativeFeatureConfig {
  /** Tần số lấy mẫu. */
  sampleRate: number;
  /** Số chiều feature. */
  featureDim: number;
}

/** Cấu hình SenseVoice trong modelConfig. */
interface NativeSenseVoiceConfig {
  /** Tệp ONNX. */
  model: string;
  /** Gợi ý ngôn ngữ, đổi theo từng bản ghi. */
  language: string;
  /** Bật chuẩn hoá văn bản nghịch đảo (1 = bật). */
  useInverseTextNormalization: number;
}

/** Cấu hình mô hình của recognizer. */
interface NativeModelConfig {
  /** Khối SenseVoice. */
  senseVoice: NativeSenseVoiceConfig;
  /** Tệp tokens. */
  tokens: string;
  /** Số luồng CPU. */
  numThreads: number;
  /** Provider suy luận (luôn "cpu"). */
  provider: string;
  /** Mức debug (0 = tắt). */
  debug: number;
}

/** Cấu hình recognizer native. */
interface NativeRecognizerConfig {
  /** Feature đầu vào. */
  featConfig: NativeFeatureConfig;
  /** Mô hình + tokens + luồng. */
  modelConfig: NativeModelConfig;
}

/** Cấu hình Silero VAD. */
interface NativeSileroVadConfig {
  /** Tệp ONNX của VAD. */
  model: string;
  /** Ngưỡng xác suất có tiếng nói. */
  threshold: number;
  /** Khoảng lặng tối thiểu. */
  minSilenceDuration: number;
  /** Tiếng nói tối thiểu. */
  minSpeechDuration: number;
  /** Đoạn thoại tối đa. */
  maxSpeechDuration: number;
  /** Cửa sổ mẫu. */
  windowSize: number;
}

/** Cấu hình detector VAD native. */
interface NativeVadConfig {
  /** Khối Silero. */
  sileroVad: NativeSileroVadConfig;
  /** Tần số lấy mẫu. */
  sampleRate: number;
  /** Số luồng CPU. */
  numThreads: number;
  /** Provider suy luận (luôn "cpu"). */
  provider: string;
  /** Mức debug (0 = tắt). */
  debug: number;
}

/** Một đoạn thoại do VAD cắt ra. */
interface NativeSegment {
  /** Mẫu PCM float32 của đoạn. */
  readonly samples: Float32Array;
  /** Chỉ số mẫu bắt đầu trong toàn bộ bản ghi. */
  readonly start: number;
}

/** Stream nhận dạng của một đoạn. */
interface NativeStream {
  /**
   * Nạp waveform vào stream.
   * Nhận: `input` — tần số lấy mẫu + mẫu PCM.
   * Trả: không.
   */
  acceptWaveform(input: { sampleRate: number; samples: Float32Array }): void;
}

/** Recognizer offline của sherpa-onnx. */
interface NativeRecognizer {
  /**
   * Đổi cấu hình (dùng để cập nhật gợi ý ngôn ngữ).
   * Nhận: `config` — cấu hình native đã dựng.
   * Trả: không.
   */
  setConfig(config: NativeRecognizerConfig): void;
  /** @returns stream mới cho MỘT đoạn. */
  createStream(): NativeStream;
  /**
   * Giải mã một stream.
   * Nhận: `stream` — stream đã nạp waveform.
   * Trả: không.
   */
  decode(stream: NativeStream): void;
  /** @returns kết quả của stream (có `text`). */
  getResult(stream: NativeStream): { text: string };
}

/** Detector Silero VAD của sherpa-onnx. */
interface NativeVad {
  /** Xoá trạng thái giữa hai bản ghi. */
  reset(): void;
  /** @returns true khi không còn đoạn nào chờ lấy. */
  isEmpty(): boolean;
  /**
   * Lấy đoạn đầu hàng đợi.
   * Nhận: `enableExternalBuffer` — cờ buffer ngoài của sherpa.
   * Trả: đoạn thoại kèm chỉ số mẫu bắt đầu.
   */
  front(enableExternalBuffer: boolean): NativeSegment;
  /** Bỏ đoạn đầu hàng đợi. */
  pop(): void;
  /**
   * Nạp mẫu vào detector.
   * Nhận: `samples` — cửa sổ mẫu PCM.
   * Trả: không.
   */
  acceptWaveform(samples: Float32Array): void;
  /** Đẩy nốt phần còn lại thành đoạn cuối. */
  flush(): void;
}

/**
 * Bề mặt TỐI THIỂU của `sherpa-onnx-node` mà worker dùng.
 * Ghi chú: dependency NATIVE (ONNX Runtime đóng gói sẵn) chỉ cần ở runtime — gói KHÔNG symlink nó và
 * build/test KHÔNG nạp nó; khai kiểu cục bộ ở đây thay cho @types (không có trên npm).
 */
interface SherpaModule {
  /** Recognizer offline. */
  OfflineRecognizer: new (config: NativeRecognizerConfig) => NativeRecognizer;
  /** Detector Silero VAD. */
  Vad: new (config: NativeVadConfig, bufferSize: number) => NativeVad;
}

/**
 * Kiểm một bản ghi trước khi chạm recognizer native (stock lib/worker.js:57–65).
 * Nhận: `audio` — byte WAV chưa tin cậy; `language` — gợi ý ngôn ngữ SenseVoice; `maxAudioBytes` — trần byte của worker.
 * Trả: thời lượng audio đã kiểm (giây); đầu vào không hợp lệ ném SpeechInputError.
 */
function validateInput(audio: Uint8Array, language: string, maxAudioBytes: number): number {
  if (!languages.includes(language)) throw new SpeechInputError("Unsupported SenseVoice language");
  if (audio.byteLength > maxAudioBytes) throw new SpeechInputError("Speech audio exceeds the worker byte limit");
  try {
    return validateWave(audio, maxAudioBytes / 32e3);
  } catch (error) {
    throw new SpeechInputError("Invalid speech WAV", { cause: error });
  }
}

/**
 * Nạp MỘT cặp mô hình native; mỗi bản ghi reset VAD và cập nhật gợi ý ngôn ngữ (stock lib/worker.js:74–154).
 * Nhận: `config` — đường dẫn ONNX đã xác minh + giới hạn CPU/VAD tường minh.
 * Trả: hàm suy luận đồng bộ bị giới hạn trong tiến trình chuyên dụng.
 */
function createTranscriber(config: TranscriberConfig): Transcriber {
  const sherpa = createRequire(import.meta.url)("sherpa-onnx-node") as SherpaModule;
  const nativeConfig: NativeRecognizerConfig = {
    featConfig: {
      sampleRate: 16e3,
      featureDim: 80,
    },
    modelConfig: {
      senseVoice: {
        model: config.model,
        language: "auto",
        useInverseTextNormalization: 1,
      },
      tokens: config.tokens,
      numThreads: config.threads,
      provider: "cpu",
      debug: 0,
    },
  };
  const recognizer = new sherpa.OfflineRecognizer(nativeConfig);
  const detector = new sherpa.Vad({
    sileroVad: {
      model: config.vad,
      threshold: config.vadThreshold,
      minSilenceDuration: config.minSilenceSeconds,
      minSpeechDuration: config.minSpeechSeconds,
      maxSpeechDuration: config.segmentSeconds,
      windowSize: 512,
    },
    sampleRate: 16e3,
    numThreads: config.threads,
    provider: "cpu",
    debug: 0,
  }, config.segmentSeconds + config.minSilenceSeconds + 1);
  return (audio, language) => {
    const audioSeconds = validateInput(audio, language, config.maxAudioBytes);
    const pcm = new DataView(audio.buffer, audio.byteOffset + 44, audio.byteLength - 44);
    const samples = Float32Array.from({ length: pcm.byteLength / 2 }, (_, i) => pcm.getInt16(i * 2, true) / 32768);
    nativeConfig.modelConfig.senseVoice.language = language;
    recognizer.setConfig(nativeConfig);
    detector.reset();
    const started = performance.now(), texts: string[] = [];
    const onsetPadding = Math.round(config.vadOnsetPaddingSeconds * 16e3);
    let isFirstSegment = true;
    const drain = (): void => {
      while (!detector.isEmpty()) {
        const segment = detector.front(false);
        let speech = segment.samples;
        if (isFirstSegment) {
          isFirstSegment = false;
          const from = Math.max(0, segment.start - onsetPadding);
          if (from < segment.start) {
            const restored = new Float32Array(segment.start - from + speech.length);
            restored.set(samples.subarray(from, segment.start));
            restored.set(speech, segment.start - from);
            speech = restored;
          }
        }
        const stream = recognizer.createStream();
        stream.acceptWaveform({
          sampleRate: 16e3,
          samples: speech,
        });
        recognizer.decode(stream);
        texts.push(recognizer.getResult(stream).text.trim());
        detector.pop();
      }
    };
    for (let offset = 0; offset < samples.length; offset += 512) {
      detector.acceptWaveform(samples.subarray(offset, offset + 512));
      drain();
    }
    detector.flush();
    drain();
    return {
      text: texts.filter(Boolean).join(" ").trim(),
      audioSeconds,
      inferenceSeconds: (performance.now() - started) / 1e3,
    };
  };
}

/**
 * Mở listener loopback cổng động; nạp mô hình xong mới công bố readiness (stock lib/worker.js:165–219).
 * Nhận: `token` — bí mật xác thực riêng từng tiến trình; `maxAudioBytes` — trần byte yêu cầu được giữ;
 *       `transcribe` — suy luận đồng bộ thuộc tiến trình này.
 * Trả: server đang nghe và cổng được cấp động.
 */
async function startRecognitionServer(token: string, maxAudioBytes: number, transcribe: Transcriber): Promise<{ server: Server; port: number }> {
  const expected = Buffer.from(`Bearer ${token}`);
  const server = createServer((request, response) => {
    const reply = (status: number, value: unknown): void => {
      response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(value));
    };
    const authorization = Buffer.from(request.headers.authorization ?? "");
    if (authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) {
      request.resume();
      reply(401, { error: "Unauthorized" });
      return;
    }
    const url = new URL(request.url as string, "http://localhost");
    if (request.method !== "POST" || url.pathname !== "/transcribe") {
      request.resume();
      reply(404, { error: "Unknown endpoint" });
      return;
    }
    const length = Number(request.headers["content-length"]);
    if (!Number.isSafeInteger(length) || length < 46 || length > maxAudioBytes) {
      request.resume();
      reply(413, {
        error: "Invalid speech audio size",
        code: "invalid-input",
      });
      return;
    }
    (async () => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
          const bytes = chunk;
          chunks.push(bytes);
        }
        reply(200, transcribe(Buffer.concat(chunks), url.searchParams.get("language") ?? "auto"));
      } catch (error) {
        reply(error instanceof SpeechInputError ? 400 : 500, {
          error: error instanceof Error ? error.message : String(error),
          ...error instanceof SpeechInputError ? { code: "invalid-input" } : {},
        });
      }
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return {
    server,
    port: (server.address() as AddressInfo).port,
  };
}

/**
 * Entry tiến trình con riêng tư: nạp recognizer native, nghe loopback, rồi in `{"port":N}` và newline
 * là đầu ra stdout DUY NHẤT (stock lib/worker.js:230–242). Host truyền cấu hình + đường dẫn mô hình dạng JSON
 * trong `argv[2]` và bearer secret trong `DSH_SPEECH_TOKEN` (xoá khỏi môi trường ngay sau khi đọc). Lỗi trước
 * readiness chỉ ghi thông điệp ra stderr và thoát mã 1; sau readiness listener loopback giữ tiến trình sống.
 * Nhận: không.
 * Trả: không (in cổng ra stdout khi sẵn sàng).
 */
async function main(): Promise<void> {
  const raw = JSON.parse(z.string().parse(process.argv[2] as string));
  const paths = z.object({
    model: z.string().min(1),
    tokens: z.string().min(1),
    vad: z.string().min(1),
  }).parse(raw);
  const config = Object.assign(Config(z.record(z.string(), z.unknown()).parse(raw) as Partial<Config>), paths);
  const token = z.string().regex(/^[a-f0-9]{64}$/).parse(process.env.DSH_SPEECH_TOKEN);
  delete process.env.DSH_SPEECH_TOKEN;
  const { port } = await startRecognitionServer(token, config.maxAudioBytes, createTranscriber(config));
  process.stdout.write(`${JSON.stringify({ port })}\n`);
}
main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`, () => {
    process.exit(1);
  });
});
