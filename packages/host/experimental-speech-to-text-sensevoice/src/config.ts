/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cấu hình provider SenseVoice cục bộ + schema schemastery — port 1:1 vùng config
 *      (stock lib/index.js:883–910 và lib/worker.js:8–35 = region lib/types/config.js);
 *      giữ nguyên thứ tự trường, mặc định và biểu thức ràng buộc của bản gốc.
 */
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import z from "@deepseek-ai/schemastery";

/** Cấu hình triển khai cho recognizer SenseVoice cục bộ có quản lý (stock lib/types/config.d.ts:5–53). */
export interface Config {
  /** Id đăng ký duy nhất; consumer chọn đúng id này. */
  providerId: string;
  /** Thư mục TUYỆT ĐỐI cho các ONNX đã xác minh. */
  dataRoot: string;
  /** Thư mục đã có chứa ONNX đã chọn và tokens.txt; bỏ trống thì tải tệp đã xác minh. */
  modelDirectory?: string | undefined;
  /** Tệp Silero VAD ONNX đã có; bỏ trống thì tải mô hình đã xác minh. */
  vadModelPath?: string | undefined;
  /** Độ chính xác trọng số; INT8 giảm lần tải đầu tiên và dung lượng lưu. */
  precision: "int8" | "fp32";
  /** Origin tương thích Hugging Face chỉ định tường minh; bỏ qua tự chọn nguồn và fallback công khai. */
  modelOrigin?: string | undefined;
  /** Các origin tương thích Hugging Face được so trước khi tải từng asset thiếu. */
  modelOrigins: string[];
  /** Hạn cho các phép dò HEAD song song, kể cả chuyển hướng tới asset thật. */
  modelProbeTimeoutMs: number;
  /** Số luồng CPU intra-operation. */
  threads: number;
  /** Độ dài đoạn thoại tối đa đưa vào recognizer. */
  segmentSeconds: number;
  /** Ngưỡng xác suất có tiếng nói của Silero. */
  vadThreshold: number;
  /** Thời lượng tiếng nói tối thiểu mà VAD giữ lại. */
  minSpeechSeconds: number;
  /** Khoảng lặng ngăn cách hai đoạn thoại. */
  minSilenceSeconds: number;
  /** Audio đầu bản ghi được phục hồi trước đoạn VAD đầu tiên (cold start báo muộn); 0 là tắt. */
  vadOnsetPaddingSeconds: number;
  /** Trần byte WAV đã giải mã mà worker riêng tư chấp nhận. */
  maxAudioBytes: number;
  /** Hạn cho chuẩn bị runtime và nạp mô hình lần đầu. */
  prepareTimeoutMs: number;
  /** Hạn cho MỘT lần suy luận sau khi worker sẵn sàng. */
  inferenceTimeoutMs: number;
  /** Thời gian rảnh trước khi dừng worker; 0 là giữ worker ấm. */
  idleTimeoutMs: number;
  /** Số bản ghi đang chạy và đang chờ tối đa được nhận. */
  maxPending: number;
  /** Thời gian ân hạn chấm dứt tiến trình được quản lý. */
  graceMs: number;
  /** Trần byte chẩn đoán của worker được giữ lại. */
  maxLogBytes: number;
  /** Trần byte phản hồi transcript. */
  maxResponseBytes: number;
  /** Khoảng tối thiểu giữa hai thông báo tiến độ tải trung gian. */
  progressIntervalMs: number;
}

/** Schema cấu hình — giữ nguyên thứ tự, mặc định và ràng buộc của stock (lib/index.js:886–910). */
export const Config: z<Partial<Config>, Config> = z.object({
  providerId: z.string().min(1).default("sensevoice-local"),
  dataRoot: z.string().min(1).required(),
  modelDirectory: z.union([z.string().min(1), z.const(void 0)]),
  vadModelPath: z.union([z.string().min(1), z.const(void 0)]),
  precision: z.union(["int8", "fp32"]).default("int8"),
  modelOrigin: z.union([z.string().pattern(/^https?:\/\/[^/\s?#@]+\/?$/), z.const(void 0)]),
  // 25/10/2026 (yêu cầu chủ dự án: "loại bỏ option HF-mirror"): chỉ tải từ Hugging Face chính thức.
  // Bản stock mặc định ["https://huggingface.co", "https://hf-mirror.com"] — đây là khác biệt CÓ CHỦ ĐÍCH.
  modelOrigins: z.array(z.string().pattern(/^https?:\/\/[^/\s?#@]+\/?$/)).min(1).default(["https://huggingface.co"]),
  modelProbeTimeoutMs: z.natural().min(1).max(MAX_TIMER_DELAY_MS).default(3e3),
  threads: z.natural().min(1).default(2),
  segmentSeconds: z.number().min(1).max(120).default(30),
  vadThreshold: z.number().min(0).max(1).default(.5),
  minSpeechSeconds: z.number().min(0).default(.25),
  minSilenceSeconds: z.number().min(.01).default(.5),
  vadOnsetPaddingSeconds: z.number().min(0).max(1).default(.3),
  maxAudioBytes: z.natural().min(46).default(4 * 1024 * 1024),
  prepareTimeoutMs: z.natural().min(1).max(MAX_TIMER_DELAY_MS).default(36e5),
  inferenceTimeoutMs: z.natural().min(1).max(MAX_TIMER_DELAY_MS).default(12e4),
  idleTimeoutMs: z.natural().max(MAX_TIMER_DELAY_MS).default(3e5),
  maxPending: z.natural().min(1).default(4),
  graceMs: z.natural().min(1).max(MAX_TIMER_DELAY_MS).default(1e3),
  maxLogBytes: z.natural().min(1).default(64 * 1024),
  maxResponseBytes: z.natural().min(1).default(128 * 1024),
  progressIntervalMs: z.natural().min(1).max(MAX_TIMER_DELAY_MS).default(100),
}) as unknown as z<Partial<Config>, Config>;
