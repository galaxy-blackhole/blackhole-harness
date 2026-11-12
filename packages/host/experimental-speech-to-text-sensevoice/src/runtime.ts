/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Tài nguyên runtime đã xác minh + chuẩn bị mô hình ONNX theo yêu cầu (khoá size/SHA-256, tải nguyên tử,
 *      phát tiến độ) — port 1:1 region lib/types/runtime.js (stock lib/index.js:184–381).
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, readFileSync } from "node:fs";
import { access, mkdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";
import type { Context } from "@deepseek-ai/cordis";
import type { SpeechPreparationState, SpeechPreparationStepKind } from "@galaxy-blackhole/gbh-experimental-speech-to-text";
import { timeoutOf } from "@deepseek-ai/dsh-timeout";
import type { Config } from "./config.ts";
import { classifyDownloadFailure, SpeechDownloadError } from "./download-error.ts";
import { orderModelSources } from "./model-sources.ts";

/** Một tệp runtime đã ghim: tên cục bộ, URL thượng nguồn, số byte và SHA-256 (stock runtime/assets.json). */
export interface SpeechAsset {
  /** Tên tệp trong thư mục cache. */
  readonly name: string;
  /** URL thượng nguồn đã ghim revision. */
  readonly url: string;
  /** Số byte chính xác. */
  readonly bytes: number;
  /** SHA-256 hex của toàn tệp. */
  readonly sha256: string;
}

/** Khoá tài nguyên của runtime: hai mức trọng số, tokens và Silero VAD (stock runtime/assets.json). */
export interface SpeechAssetLock {
  /** Trọng số theo độ chính xác. */
  readonly models: Readonly<Record<"int8" | "fp32", SpeechAsset>>;
  /** Từ điển token của SenseVoice. */
  readonly tokens: SpeechAsset;
  /** Mô hình Silero VAD. */
  readonly vad: SpeechAsset;
}

/** Đường dẫn cục bộ của mô hình, tokens, VAD và worker đã build. */
export interface RuntimePaths {
  /** Tệp ONNX của mức chính xác đã chọn. */
  readonly model: string;
  /** Tệp tokens.txt. */
  readonly tokens: string;
  /** Tệp Silero VAD ONNX. */
  readonly vad: string;
  /** Entry worker (lib/worker.js khi chạy bản build, src/worker.ts khi chạy nguồn). */
  readonly worker: string;
}

/** Runtime đã giải: khoá tài nguyên, gốc mô hình và đường dẫn từng tệp. */
export interface ResolvedRuntime {
  /** Khoá tài nguyên đọc từ runtime/assets.json. */
  readonly lock: SpeechAssetLock;
  /** Thư mục chứa mô hình + tokens. */
  readonly modelRoot: string;
  /** Đường dẫn cụ thể của từng tệp. */
  readonly paths: RuntimePaths;
}

/** Tiến độ tải MỘT asset (đơn vị byte, không phải phần trăm ước lượng). */
export interface DownloadProgress {
  /** Luôn là `downloading`. */
  readonly phase: "downloading";
  /** Tên asset đang tải. */
  readonly resource: string;
  /** Số byte đã nhận. */
  readonly completedBytes: number;
  /** Tổng byte đã ghim. */
  readonly totalBytes?: number;
}

/** Bộ phát tiến độ tải do Host sở hữu. */
export type DownloadReport = (state: DownloadProgress) => void;

/** Bộ phát trạng thái chuẩn bị do Host sở hữu. */
export type PreparationReport = (state: SpeechPreparationState) => void;

/**
 * So khớp một tệp với asset đã ghim: là tệp thường, đúng số byte và đúng SHA-256 (stock lib/index.js:186–199).
 * Nhận: `path` — tệp cần kiểm; `asset` — danh tính đã ghim; `signal` — huỷ chuẩn bị.
 * Trả: true khi tệp khớp hoàn toàn; false khi thiếu tệp/sai kích thước/sai hash.
 */
async function matchesAsset(path: string, asset: SpeechAsset, signal: AbortSignal): Promise<boolean> {
  signal.throwIfAborted();
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error(`Speech asset is not a regular file: ${path}`);
    if (info.size !== asset.bytes) return false;
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(path, { signal })) digest.update(chunk);
    return digest.digest("hex") === asset.sha256;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return false;
  }
}

/**
 * Giải runtime đóng gói sẵn + đường dẫn mô hình theo cấu hình (stock lib/index.js:200–221).
 * Nhận: `config` — độ chính xác, dataRoot và các đường dẫn tường minh.
 * Trả: khoá tài nguyên, gốc mô hình và đường dẫn từng tệp; ném lỗi khi nền tảng không được hỗ trợ.
 */
export function resolveRuntime(config: Config): ResolvedRuntime {
  if (![
    "darwin-arm64",
    "darwin-x64",
    "linux-arm64",
    "linux-x64",
    "win32-x64",
  ].includes(`${process.platform}-${process.arch}`)) throw new Error(`Local speech is unavailable for ${process.platform}-${process.arch}`);
  const lock = JSON.parse(readFileSync(new URL("../runtime/assets.json", import.meta.url), "utf8")) as SpeechAssetLock;
  const modelRoot = config.modelDirectory ?? join(config.dataRoot, "models", "sensevoice-onnx");
  return {
    lock,
    modelRoot,
    paths: {
      model: join(modelRoot, lock.models[config.precision].name),
      tokens: join(modelRoot, lock.tokens.name),
      vad: config.vadModelPath ?? join(config.dataRoot, "models", "silero", lock.vad.name),
      /* v8 ignore next -- worker resolution is exercised by real Node and Electron process smokes */
      worker: fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "./worker.ts" : "./worker.js", import.meta.url)),
    },
  };
}

/**
 * Kiểm mọi tệp runtime đã tồn tại và các tài nguyên do Host quản lý khớp size/SHA-256 đã ghim
 * (stock lib/index.js:222–238). Tệp do deployer chỉ định chỉ được kiểm truy cập.
 * Nhận: `config` — lựa chọn đường dẫn; `paths` — đường dẫn cụ thể; `lock` — khoá tài nguyên; `signal` — huỷ/deadline.
 * Trả: true khi mọi thứ dùng được; false khi thiếu tệp hoặc lệch khoá.
 */
async function verifyRuntime(config: Config, paths: RuntimePaths, lock: SpeechAssetLock, signal: AbortSignal): Promise<boolean> {
  signal.throwIfAborted();
  try {
    await Promise.all([
      paths.model,
      paths.tokens,
      paths.vad,
    ].map((path) => access(path)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return false;
  }
  const verified: [string, SpeechAsset][] = [
    ...config.modelDirectory === void 0 ? [[paths.model, lock.models[config.precision]] as [string, SpeechAsset], [paths.tokens, lock.tokens] as [string, SpeechAsset]] : [],
    ...config.vadModelPath === void 0 ? [[paths.vad, lock.vad] as [string, SpeechAsset]] : [],
  ];
  for (const [path, asset] of verified) if (!await matchesAsset(path, asset, signal)) return false;
  signal.throwIfAborted();
  return true;
}

/**
 * Soi mô hình đã có mà KHÔNG tải, không ghi tệp và không khởi động worker (stock lib/index.js:245–248).
 * Nhận: `config` — đường dẫn mô hình và độ chính xác đã chọn; `signal` — huỷ của provider hoặc deadline soi.
 * Trả: đường dẫn cache khi mọi tệp tồn tại và khớp size/hash đã ghim; ngược lại undefined.
 */
export async function inspectRuntime(config: Config, signal: AbortSignal): Promise<RuntimePaths | undefined> {
  const { lock, paths } = resolveRuntime(config);
  return await verifyRuntime(config, paths, lock, signal) ? paths : void 0;
}

/**
 * Tải vào một tệp tạm duy nhất, xác minh, rồi công bố nguyên tử (stock lib/index.js:257–326).
 * Nhận: `asset` — danh tính bản phát hành đã ghim; `root` — thư mục cache của provider; `signal` — huỷ chuẩn bị;
 *       `report` — bộ phát tiến độ do Host sở hữu.
 * Trả: đường dẫn tệp cục bộ đã xác minh; lỗi mang chẩn đoán UI đa ngữ qua SpeechDownloadError.
 */
export async function downloadAsset(asset: SpeechAsset, root: string, signal: AbortSignal, report: DownloadReport = () => {}): Promise<string> {
  signal.throwIfAborted();
  const destination = join(root, asset.name);
  const partial = `${destination}.${randomUUID()}.part`;
  let source = new URL(asset.url).origin;
  try {
    await mkdir(root, { recursive: true });
    if (await matchesAsset(destination, asset, signal)) return destination;
    try {
      const response = await fetch(asset.url, { signal });
      source = new URL(response.url || asset.url).origin;
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new SpeechDownloadError({
          resource: asset.name,
          source,
          reason: "http",
          status: response.status,
        });
      }
      const digest = createHash("sha256");
      let completedBytes = 0;
      const publish = (): void => {
        report({
          phase: "downloading",
          resource: asset.name,
          completedBytes,
          totalBytes: asset.bytes,
        });
      };
      publish();
      const hashing = new Transform({ transform(chunk, _encoding, callback) {
        completedBytes += chunk.length;
        if (completedBytes > asset.bytes) {
          callback(new SpeechDownloadError({
            resource: asset.name,
            source,
            reason: "integrity",
          }));
          return;
        }
        digest.update(chunk);
        publish();
        callback(null, chunk);
      } });
      // Thân fetch là ReadableStream của DOM; runtime Node nhận trực tiếp qua pipeline — chỉ cast KIỂU
      // sang ReadableStream của node:stream/web (hành vi runtime không đổi).
      await pipeline(response.body as unknown as NodeReadableStream<Uint8Array>, hashing, createWriteStream(partial, {
        flags: "wx",
        mode: 384,
      }), { signal });
      if (completedBytes !== asset.bytes || digest.digest("hex") !== asset.sha256) throw new SpeechDownloadError({
        resource: asset.name,
        source,
        reason: "integrity",
      });
      signal.throwIfAborted();
      await rename(partial, destination);
      return destination;
    } finally {
      await rm(partial, { force: true });
    }
  } catch (error) {
    const timedOut = timeoutOf(signal);
    if (signal.aborted && !timedOut || error instanceof SpeechDownloadError) throw error;
    throw new SpeechDownloadError({
      resource: asset.name,
      source,
      ...timedOut ? { reason: "timeout" } : classifyDownloadFailure(error),
    }, { cause: error });
  }
}

/**
 * Giải runtime native đóng gói sẵn và chuẩn bị mô hình ONNX đã xác minh theo yêu cầu (stock lib/index.js:335–380).
 * Nhận: `_ctx` — context Host sở hữu tác vụ chuẩn bị (giữ đúng chữ ký gốc); `config` — đường dẫn mô hình,
 *       độ chính xác và chính sách nguồn tải; `signal` — huỷ chuẩn bị hoặc deadline; `report` — bộ phát tiến độ.
 * Trả: đường dẫn mô hình/tokens/VAD/worker đã xác minh; ném lỗi khi xác minh hỏng.
 */
export async function prepareRuntime(_ctx: Context, config: Config, signal: AbortSignal, report: PreparationReport = () => {}): Promise<RuntimePaths> {
  const { lock, modelRoot, paths } = resolveRuntime(config);
  const download = async (asset: SpeechAsset, root: string, step: SpeechPreparationStepKind): Promise<void> => {
    if (await matchesAsset(join(root, asset.name), asset, signal)) return;
    const origins = config.modelOrigin === void 0 ? config.modelOrigins : [config.modelOrigin];
    const urls = await orderModelSources(asset.url, origins, config.modelProbeTimeoutMs, signal);
    for (const [index, url] of urls.entries()) try {
      await downloadAsset({
        ...asset,
        url,
      }, root, signal, (state) => {
        report({
          ...state,
          step,
        });
      });
      return;
    } catch (error) {
      if (signal.aborted || !(error instanceof SpeechDownloadError) || error.download.reason === "storage" || error.download.reason === "unknown" || index === urls.length - 1) throw error;
    }
  };
  if (config.modelDirectory === void 0) {
    report({
      phase: "checking",
      step: "model",
      startedAt: Date.now(),
    });
    await download(lock.models[config.precision], modelRoot, "model");
    await download(lock.tokens, modelRoot, "model");
  }
  if (config.vadModelPath === void 0) {
    report({
      phase: "checking",
      step: "vad",
      startedAt: Date.now(),
    });
    await download(lock.vad, join(config.dataRoot, "models", "silero"), "vad");
  }
  report({
    phase: "checking",
    step: "verify",
    startedAt: Date.now(),
  });
  if (!await verifyRuntime(config, paths, lock, signal)) throw new Error("Speech model verification failed: missing or corrupted model files");
  return paths;
}
