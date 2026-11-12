/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Provider nhận dạng giọng nói TIẾNG VIỆT bằng PhoWhisper (VinAI) qua runtime Python
 *      (transformers + torch), đăng ký vào seam speechToText với languages auto/vi/en.
 */
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import z from "@deepseek-ai/schemastery";

/** Id provider (chọn trong "Dịch vụ nhận dạng"). */
export const PROVIDER_ID = "phowhisper";
/** Model mặc định: PhoWhisper-large của VinAI (tiếng Việt). */
export const DEFAULT_MODEL = "vinai/PhoWhisper-large";
/** Ngôn ngữ provider nhận: tự phát hiện, tiếng Việt, tiếng Anh. */
export const languages: readonly string[] = ["auto", "vi", "en"];
/** Trần thời gian cho một lần chuẩn bị (chạy lần đầu, tải model). */
const PREPARE_TIMEOUT_MS = 60 * 60 * 1000;
/** Trần thời gian cho một lần suy luận. */
const INFERENCE_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Python mặc định cho runtime: ưu tiên biến môi trường, rồi venv RIÊNG của Galaxy Blackhole
 * (`<home>/voice-venv/bin/python`), cuối cùng mới tới `python3` của hệ thống.
 * 10/11/2026 (Lead): python hệ thống (macOS/Xcode) KHÔNG có torch ⇒ bước "Chuẩn bị" báo
 * "Thiếu Python package: No module named 'torch'" dù người dùng đã cài venv. Tự dò venv để
 * voice chạy được mà không phải sửa cấu hình tay.
 */
export const DEFAULT_PYTHON = (() => {
  const tu_bien = process.env["GBH_VOICE_PYTHON"];
  if (tu_bien !== undefined && tu_bien.trim() !== "") return tu_bien;
  const venv = join(process.env["GBH_HOME"] ?? process.env["DSH_HOME"] ?? join(homedir(), ".galaxy", "blackhole"), "voice-venv", "bin", "python");
  return existsSync(venv) ? venv : "python3";
})();

/** Thư mục dữ liệu mặc định: <GBH_HOME|DSH_HOME|~/.galaxy/blackhole>/speech-to-text/phowhisper. */
export const DEFAULT_DATA_ROOT = join(process.env["GBH_HOME"] ?? process.env["DSH_HOME"] ?? join(homedir(), ".galaxy", "blackhole"), "speech-to-text", "phowhisper");

/** Cấu hình provider (mọi trường đều có mặc định hợp lý). */
export interface Config {
  providerId: string;
  dataRoot: string;
  pythonPath: string;
  model: string;
  device: "cpu" | "cuda";
  inferenceTimeoutMs: number;
}

/** Schema cấu hình. */
export const Config: z<Partial<Config>, Config> = z.object({
  providerId: z.string().min(1).default(PROVIDER_ID),
  dataRoot: z.string().min(1).default(DEFAULT_DATA_ROOT),
  pythonPath: z.string().min(1).default(DEFAULT_PYTHON),
  model: z.string().min(1).default(DEFAULT_MODEL),
  device: z.union(["cpu", "cuda"]).default("cpu"),
  inferenceTimeoutMs: z.natural().min(1).default(INFERENCE_TIMEOUT_MS),
});

/** Một kết quả nhận dạng. */
export interface TranscribeResult { text: string; }

/** Trạng thái chuẩn bị (khớp hình dạng seam speechToText). */
export interface PreparationState {
  phase: "unprepared" | "checking" | "preparing" | "standby" | "ready" | "failed" | "cancelled";
  steps: { kind: "check" | "download"; status: "pending" | "running" | "complete" | "failed" | "cancelled"; startedAt?: number; detail?: string }[];
  detail?: string;
}

/**
 * Chạy một tiến trình Python và trả JSON cuối cùng của nó.
 * Nhận: python · argv (đường dẫn script + tham số) · timeout · signal.
 * Trả: object JSON đã parse (dòng cuối là JSON).
 * @throws Error khi thoát khác 0, quá hạn, hoặc dòng cuối không phải JSON.
 */
export function runPythonJson(python: string, argv: readonly string[], timeoutMs: number, signal?: AbortSignal): Promise<Record<string, unknown>> {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const child = spawn(python, [...argv], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("python quá hạn " + String(timeoutMs) + "ms")); }, timeoutMs);
    const stop = (): void => { clearTimeout(timer); child.kill("SIGKILL"); reject(new Error("đã huỷ")); };
    signal?.addEventListener("abort", stop, { once: true });
    child.stdout.on("data", (chunk: Buffer) => { out += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { err += chunk.toString(); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      if (code !== 0) { reject(new Error("python thoát mã " + String(code) + ": " + err.trim().slice(-400))); return; }
      const last = out.trim().split("\n").filter((line) => line.trim() !== "").at(-1) ?? "";
      try { resolve(JSON.parse(last) as Record<string, unknown>); }
      catch { reject(new Error("python không in JSON ở dòng cuối: " + last.slice(0, 200))); }
    });
  });
}

/**
 * Worker chuẩn bị + nhận dạng qua Python.
 * Nhận: thư mục runtime (chứa prepare.py/transcribe.py) · cấu hình · hàm chạy (tiêm được để test).
 * Trả: instance có prepare/snapshot/subscribe/transcribe/dispose.
 */
export class PhoWhisperWorker {
  private state: PreparationState = { phase: "unprepared", steps: [{ kind: "check", status: "pending" }, { kind: "download", status: "pending" }] };
  private readonly listeners = new Set<() => void>();
  private readonly markerPath: string;

  constructor(
    private readonly runtimeDir: string,
    private readonly config: Config,
    private readonly run: (python: string, argv: readonly string[], timeoutMs: number, signal?: AbortSignal) => Promise<Record<string, unknown>> = runPythonJson,
  ) {
    this.markerPath = join(config.dataRoot, "phowhisper.json");
  }

  /** Báo trạng thái mới cho người nghe. */
  private publish(next: PreparationState): void {
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  /**
   * Đăng ký nghe thay đổi trạng thái.
   * Nhận: listener. Trả: hàm huỷ đăng ký.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Trạng thái hiện tại (bản sao). */
  snapshot(): PreparationState {
    return { ...this.state, steps: this.state.steps.map((step) => ({ ...step })) };
  }

  /** Có model đã tải sẵn trong dataRoot chưa. */
  private modelReady(): boolean {
    try {
      const marker = JSON.parse(readFileSync(this.markerPath, "utf8")) as { model?: string };
      return marker.model === this.config.model;
    } catch { return false; }
  }

  /** Soi đĩa mà KHÔNG tải gì: chỉ đổi phase (giống sensevoice.inspect). */
  inspect(): void {
    if (this.state.phase === "preparing") return;
    if (this.modelReady()) {
      this.publish({ phase: "standby", steps: this.state.steps.map((step) => ({ ...step, status: "complete" })) });
      return;
    }
    this.publish({ phase: "unprepared", steps: [{ kind: "check", status: "pending" }, { kind: "download", status: "pending" }] });
  }

  /**
   * Chuẩn bị runtime + tải model PhoWhisper (idempotent, chạy nền).
   * Nhận: options (không dùng). Trả: promise hoàn tất.
   */
  async prepare(_options?: unknown): Promise<void> {
    if (this.state.phase === "preparing" || this.state.phase === "ready") return;
    mkdirSync(this.config.dataRoot, { recursive: true });
    this.publish({ phase: "checking", steps: [{ kind: "check", status: "running", startedAt: Date.now() }, { kind: "download", status: "pending" }] });
    try {
      const checked = await this.run(this.config.pythonPath, [join(this.runtimeDir, "prepare.py"), "--check-only"], PREPARE_TIMEOUT_MS);
      if (checked["ok"] !== true) throw new Error(String(checked["error"] ?? "runtime Python không dùng được"));
      this.publish({ phase: "preparing", steps: [{ kind: "check", status: "complete" }, { kind: "download", status: "running", startedAt: Date.now() }] });
      const prepared = await this.run(this.config.pythonPath, [
        join(this.runtimeDir, "prepare.py"),
        "--model", this.config.model,
        "--data-root", this.config.dataRoot,
      ], PREPARE_TIMEOUT_MS);
      if (prepared["ok"] !== true) throw new Error(String(prepared["error"] ?? "tải model thất bại"));
      writeFileSync(this.markerPath, JSON.stringify({ model: this.config.model, at: new Date().toISOString() }));
      this.publish({ phase: "ready", steps: [{ kind: "check", status: "complete" }, { kind: "download", status: "complete" }] });
    } catch (error) {
      this.publish({ phase: "failed", steps: this.state.steps.map((step) => step.status === "complete" ? step : { ...step, status: "failed" }), detail: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /** Huỷ lần chuẩn bị đang chạy (không có tác vụ nền dài hạn ⇒ chỉ đổi trạng thái). */
  async cancel(): Promise<void> {
    if (this.state.phase === "preparing" || this.state.phase === "checking") this.publish({ phase: "cancelled", steps: this.state.steps.map((step) => step.status === "complete" ? step : { ...step, status: "cancelled" }) });
  }

  /**
   * Nhận dạng một đoạn âm thanh.
   * Nhận: audio (bytes) · language (auto|vi|en) · signal.
   * Trả: { text }.
   * @throws Error khi model chưa tải hoặc Python lỗi.
   */
  async transcribe(input: { audio: Uint8Array; language: string }, signal?: AbortSignal): Promise<TranscribeResult> {
    if (!this.modelReady()) throw new Error("PhoWhisper: model chưa được chuẩn bị — hãy bấm 'Tải về và chuẩn bị'");
    const wav = join(this.config.dataRoot, "input-" + String(Date.now()) + ".wav");
    writeFileSync(wav, input.audio);
    const result = await this.run(this.config.pythonPath, [
      join(this.runtimeDir, "transcribe.py"),
      "--model", this.config.model,
      "--data-root", this.config.dataRoot,
      "--audio", wav,
      "--language", input.language,
      "--device", this.config.device,
    ], this.config.inferenceTimeoutMs, signal);
    if (result["ok"] !== true) throw new Error(String(result["error"] ?? "nhận dạng thất bại"));
    return { text: String(result["text"] ?? "") };
  }

  /** Giải phóng: xoá người nghe. */
  dispose(): void {
    this.listeners.clear();
  }
}

/** Hình dạng HẸP của ctx (chỉ phần provider đọc). */
export interface PhoWhisperCtx {
  speechToText: { register(provider: unknown): () => Promise<void> };
  effect(fn: () => () => void): void;
}

/** Tên plugin cho chẩn đoán của loader. */
export const name = "speech-to-text-phowhisper";
/** Seam provider đăng ký vào. */
export const inject = ["speechToText"];

/**
 * Đăng ký provider PhoWhisper với seam speechToText.
 * Nhận: ctx · cấu hình đã kiểm.
 * Trả: không.
 */
export function apply(ctx: PhoWhisperCtx, raw: Partial<Config> | undefined): void {
  // 25/10/2026 — LO HONG THAT: loader truyền CONFIG THÔ của row (row của ta không có config) ⇒ mọi mặc định
  // trong schema KHÔNG được áp ⇒ `config.dataRoot` undefined ⇒ TypeError khi mkdir. Chuẩn hoá tại đây.
  const resolved = Config(raw ?? {}) as Partial<Config>;
  // Phòng thủ 2 lớp: nếu schema không áp default (đo được trên host: dataRoot về undefined) thì dùng hằng số.
  const config: Config = {
    providerId: resolved.providerId ?? PROVIDER_ID,
    dataRoot: resolved.dataRoot ?? DEFAULT_DATA_ROOT,
    pythonPath: resolved.pythonPath ?? "python3",
    model: resolved.model ?? DEFAULT_MODEL,
    device: resolved.device ?? "cpu",
    inferenceTimeoutMs: resolved.inferenceTimeoutMs ?? INFERENCE_TIMEOUT_MS,
  };
  mkdirSync(config.dataRoot, { recursive: true });
  // 25/10/2026 — LO HONG THAT: bundle ESM nạp qua loader của cordis KHÔNG có `import.meta.dir` (undefined)
  // ⇒ join() ném TypeError. Tính thư mục gói từ `import.meta.url` (luôn có trong ESM).
  const packageDir = dirname(fileURLToPath(import.meta.url));
  const worker = new PhoWhisperWorker(join(packageDir, "..", "runtime"), config);
  ctx.effect(() => {
    const unregister = ctx.speechToText.register({
      info: {
        id: config.providerId,
        name: "PhoWhisper (tiếng Việt)",
        location: "host-local",
        languages,
        downloadSources: ["https://huggingface.co"],
        setupEstimate: { recommendedDiskBytes: 1_600_000_000, expectedMemoryBytes: 2_500_000_000, minimumMinutes: 2, maximumMinutes: 15 },
      },
      preparation: {
        prepare: async (options?: unknown) => { await worker.prepare(options); },
        cancel: async () => { await worker.cancel(); },
        snapshot: () => worker.snapshot(),
        subscribe: (listener: () => void) => worker.subscribe(listener),
      },
      transcribe: async (input: { audio: Uint8Array; language: string }, signal?: AbortSignal) => await worker.transcribe(input, signal),
    });
    worker.inspect();
    return () => {
      worker.dispose();
      void unregister();
    };
  });
}

/** Đường dẫn tệp marker model đã tải (dùng cho chẩn đoán/tests). */
export function markerPathOf(dataRoot: string): string {
  return join(dataRoot, "phowhisper.json");
}

/**
 * Cho biết runtime Python có sẵn hay không — dò NHANH, không chạy pip.
 * Nhận: `pythonPath` — đường dẫn/danh nghĩa trình thông dịch do cấu hình cấp.
 * Trả: `true` khi máy có `/usr/bin/env` và `pythonPath` khác rỗng; ngược lại `false`.
 */
export function pythonAvailable(pythonPath: string): boolean {
  return existsSync("/usr/bin/env") && pythonPath.trim() !== "";
}
