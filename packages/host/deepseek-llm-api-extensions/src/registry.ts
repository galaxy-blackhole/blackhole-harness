/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sổ đăng ký trường yêu cầu MỞ RỘNG cho adapter LLM DeepSeek chính thức: mỗi plugin sở hữu MỘT
 *      trường top-level độc lập, adapter chạy MỘT giao dịch chuẩn bị + chấp nhận chung (bản gốc:
 *      'lib/index.js' + 'lib/types/index.js' của @galaxy-blackhole/gbh-deepseek-llm-api-extensions).
 */

import { Service, type Context } from "@deepseek-ai/cordis";
import type {
  DeepSeekLlmApiExtensionMap,
  DeepSeekLlmApiExtensionProvider,
  DeepSeekLlmApiExtensionRequest,
  DeepSeekLlmApiJson,
  PreparedDeepSeekLlmApiExtension,
  PreparedDeepSeekLlmApiExtensions,
} from "./types.ts";

/** Tên service mà sổ đăng ký tự cấp lên context — nguyên văn của bản gốc. */
const SERVICE_NAME = "deepseekLlmApiExtensions";

/** Tiền tố của MỌI thông điệp lỗi/cảnh báo — nguyên văn của bản gốc. */
const PREFIX = "deepseek-llm-api-extensions";

/** Nhà cung cấp đã XOÁ kiểu: sổ đăng ký giữ mọi trường dưới dạng chuỗi. */
interface ErasedProvider {
  /**
   * Chuẩn bị một trường cho một request đã tuần tự hoá.
   * Nhận: sự thật request nền bất biến.
   * Trả: trường đã chuẩn bị, hoặc `undefined` khi request không có giá trị cho trường đó.
   */
  prepare(
    request: DeepSeekLlmApiExtensionRequest,
  ): PreparedDeepSeekLlmApiExtension<DeepSeekLlmApiJson> | undefined | Promise<PreparedDeepSeekLlmApiExtension<DeepSeekLlmApiJson> | undefined>;
}

/** Một trường đã chuẩn bị xong, còn giữ `result` để ràng buộc `accept` vào ĐÚNG vật mang. */
interface PreparedEntry {
  /** Tên trường top-level đã đăng ký. */
  field: string;
  /** Giá trị đã nhân bản + đóng băng, sẵn sàng gộp vào thân request. */
  value: DeepSeekLlmApiJson;
  /** Kết quả gốc của nhà cung cấp, để gọi `accept` với đúng `this`. */
  result: PreparedDeepSeekLlmApiExtension<DeepSeekLlmApiJson>;
}

/**
 * Đóng băng đệ quy một bản sao có cấu trúc.
 * Nhận: giá trị JSON (đã tách khỏi thân request bằng `structuredClone`).
 * Trả: chính giá trị đó, đã đóng băng ở mọi tầng mảng/object — nhà cung cấp không còn đường sửa.
 */
function freezeJson(value: DeepSeekLlmApiJson): DeepSeekLlmApiJson {
  if (value !== null && typeof value === "object") {
    for (const child of Array.isArray(value) ? value : Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Kết toán MỌI lời chốt rồi mới báo hỏng.
 * Nhận: danh sách lời chốt đã ràng buộc `this`.
 * Trả: không; ném đúng lý do khi chỉ MỘT lời chốt hỏng, hoặc `AggregateError` khi nhiều hơn một.
 */
async function acceptAll(callbacks: readonly (() => void | Promise<void>)[]): Promise<void> {
  const outcomes = await Promise.allSettled(callbacks.map((callback) => Promise.resolve().then(callback)));
  const failures = outcomes
    .filter((outcome) => outcome.status === "rejected")
    .map((outcome) => (outcome as PromiseRejectedResult).reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "DeepSeek LLM API extension acceptance failed");
}

/**
 * Ngừng chờ việc của nhà cung cấp khi request model chứa nó bị huỷ.
 * Nhận: lời hứa đang chạy và tín hiệu huỷ của lượt.
 * Trả: kết quả của lời hứa khi xong TRƯỚC khi bị huỷ; ném lý do huỷ khi tín hiệu kích hoạt.
 */
async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let rejectAborted!: (reason?: unknown) => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = reject;
  });
  const onAbort = (): void => {
    rejectAborted(signal.reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const result = await Promise.race([work, aborted]);
    signal.throwIfAborted();
    return result;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

/** Sổ những trường top-level ĐỘC LẬP của request DeepSeek chính thức. */
export class DeepSeekLlmApiExtensionRegistry extends Service {
  /** Sổ nhà cung cấp theo tên trường; MỖI thực thể sở hữu MỘT `Map` riêng (không chia sẻ giữa các thực thể). */
  private readonly providers = new Map<string, ErasedProvider>();

  /** Trường đã ghi cảnh báo chuẩn bị hỏng; lần hỏng sau im lặng. */
  private readonly warnedFields = new Set<string>();

  /**
   * Cấp service `deepseekLlmApiExtensions` lên context.
   * Nhận: context cordis sở hữu vòng đời đăng ký.
   * Trả: thực thể sổ đăng ký đã tự đăng ký tên service lên context.
   */
  constructor(ctx: Context) {
    super(ctx, SERVICE_NAME);
  }

  /**
   * Đăng ký nhà cung cấp DUY NHẤT của một trường top-level. Đăng ký có phạm vi effect.
   * Nhận: tên trường (đã hợp nhất khai báo, do chính nhà cung cấp sở hữu) và nhà cung cấp.
   * Trả: hàm dọn giải phóng trường đó (do `ctx.effect` cấp).
   */
  register<K extends keyof DeepSeekLlmApiExtensionMap>(
    field: K,
    provider: DeepSeekLlmApiExtensionProvider<DeepSeekLlmApiExtensionMap[K]>,
  ): () => Promise<void> {
    const fieldName: string = field as string;
    if (fieldName.length === 0 || fieldName.trim() !== fieldName) {
      throw new Error(PREFIX + ": field must be a non-blank trimmed string");
    }
    const providers = this.providers;
    const erased = provider as unknown as ErasedProvider;
    return this.ctx.effect(() => {
      if (providers.has(fieldName)) {
        throw new Error(PREFIX + ": field " + JSON.stringify(fieldName) + " is already registered");
      }
      providers.set(fieldName, erased);
      return () => {
        providers.delete(fieldName);
      };
    }, SERVICE_NAME + ".register(" + JSON.stringify(fieldName) + ")");
  }

  /**
   * Chuẩn bị MỌI trường đang đăng ký từ MỘT thân request bất biến.
   * Nhà cung cấp chuẩn bị hỏng, hoặc giá trị không nhân bản được, bị BỎ khỏi request này; lần hỏng đầu
   * tiên của mỗi trường được ghi cảnh báo. Chỉ huỷ mới làm lời hứa hỏng.
   * Nhận: sự thật request đã tuần tự hoá, trước khi gộp trường mở rộng.
   * Trả: các trường đã tách rời (đóng băng) và giao dịch chấp nhận chung, idempotent.
   */
  async prepare(request: DeepSeekLlmApiExtensionRequest): Promise<PreparedDeepSeekLlmApiExtensions> {
    request.signal.throwIfAborted();
    const entries = [...this.providers.entries()];
    const prepared = await abortable(
      Promise.all(
        entries.map(async ([field, provider]): Promise<PreparedEntry | undefined> => {
          try {
            const result = await provider.prepare(request);
            return result === undefined
              ? undefined
              : { field, value: freezeJson(structuredClone(result.value)), result };
          } catch (error) {
            if (!request.signal.aborted && !this.warnedFields.has(field)) {
              this.warnedFields.add(field);
              this.ctx.logger.warn(
                PREFIX + ": omitting field " + JSON.stringify(field) + " from this request because its preparation failed: %o",
                error,
              );
            }
            return undefined;
          }
        }),
      ),
      request.signal,
    );
    const fields: Record<string, DeepSeekLlmApiJson> = Object.create(null);
    const callbacks: (() => void | Promise<void>)[] = [];
    for (const item of prepared) {
      if (item === undefined) continue;
      const { field, value, result } = item;
      fields[field] = value;
      const accept = result.accept;
      if (accept !== undefined) callbacks.push(accept.bind(result));
    }
    Object.freeze(fields);
    let acceptance: Promise<void> | undefined;
    return {
      fields: fields as Readonly<Partial<DeepSeekLlmApiExtensionMap>>,
      accept: () => (acceptance ??= acceptAll(callbacks)),
    };
  }
}
