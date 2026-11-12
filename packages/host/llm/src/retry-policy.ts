/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 vùng retry-policy.js của @deepseek-ai/dsh-llm (lib/index.js dòng 238–348):
 *      schema Cordis của chính sách thử lại do provider sở hữu, phần chốt mặc định, kiểm khoá
 *      và backoff của resolveRetryPolicy; giữ nguyên mặc định, tập mã mặc định và câu lỗi.
 */

import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import z from "@deepseek-ai/schemastery";

import { EMPTY_RESPONSE_CODE } from "./error.ts";

/**
 * Provider-owned request-retry policy configuration and resolution.
 *
 * Adapters expose one resolved policy per registered provider route; the
 * optional dsh-llm-retry plugin executes it on the agent's failed-step extension point.
 *
 * @module @deepseek-ai/dsh-llm/retry-policy
 */

/** Cấu hình backoff mũ có trần, dao động đối xứng quanh mỗi độ trễ cục bộ. */
export interface BackoffConfig {
  /** Độ trễ cục bộ đầu tiên của backoff mũ, mili giây (mặc định 500). */
  initialDelayMs?: number;
  /** Độ trễ lớn nhất được lên lịch cục bộ hoặc chấp nhận từ provider, mili giây (mặc định 10000). */
  maxDelayMs?: number;
  /** Biên độ dao động ngẫu nhiên đối xứng quanh 1 (mặc định 0.1). */
  jitterRatio?: number;
}

/** Hành vi thử lại hữu hạn hiện hành cho một tuyến provider. */
export interface NormalRetryPolicyConfig {
  /** Chỉ thử lại các mã lỗi tạm thời đã cấu hình. */
  mode: "normal";
  /** Số lần thử lại tối đa sau request đầu tiên (mặc định 5). */
  maxRetries?: number;
  /** Các mã lỗi ổn định đủ điều kiện theo chính sách này. */
  retryableCodes?: string[];
  /** Cấu hình backoff mũ cục bộ và dao động. */
  backoff?: BackoffConfig;
}

/** Hành vi thử lại vô hạn cho mọi lỗi request model trên một tuyến provider. */
export interface AlwaysRetryPolicyConfig {
  /** Thử lại mọi lỗi request model cho tới khi thành công, bị huỷ hoặc bị dọn. */
  mode: "always";
  /** Cấu hình backoff mũ cục bộ và dao động. */
  backoff?: BackoffConfig;
}

/** Cấu hình chính sách thử lại request model do provider sở hữu. */
export type RetryPolicyConfig = NormalRetryPolicyConfig | AlwaysRetryPolicyConfig;

/** Backoff đã chốt, dùng chung cho cả hai chế độ thử lại. */
export interface ResolvedRetryBackoff {
  /** Độ trễ cục bộ đầu tiên, mili giây. */
  readonly initialDelayMs: number;
  /** Độ trễ lớn nhất được lên lịch hoặc chấp nhận, mili giây. */
  readonly maxDelayMs: number;
  /** Biên độ dao động ngẫu nhiên đối xứng quanh 1. */
  readonly jitterRatio: number;
}

/** Chính sách thử lại hữu hạn đã chốt đầy đủ. */
export interface ResolvedNormalRetryPolicy extends ResolvedRetryBackoff {
  /** Chế độ hữu hạn: chỉ thử lại các mã trong `retryableCodes`. */
  readonly mode: "normal";
  /** Số lần thử lại tối đa sau request đầu tiên. */
  readonly maxRetries: number;
  /** Các mã lỗi ổn định đủ điều kiện thử lại. */
  readonly retryableCodes: readonly string[];
}

/** Chính sách thử lại vô hạn đã chốt đầy đủ. */
export interface ResolvedAlwaysRetryPolicy extends ResolvedRetryBackoff {
  /** Chế độ vô hạn: thử lại mọi lỗi request model. */
  readonly mode: "always";
}

/** Chính sách bất biến của provider, chốt lúc đăng ký tuyến adapter. */
export type ResolvedRetryPolicy = ResolvedNormalRetryPolicy | ResolvedAlwaysRetryPolicy;

/** Số lần thử lại mặc định sau request đầu tiên. */
const DEFAULT_MAX_RETRIES = 5;

/** Độ trễ cục bộ mặc định của lần thử lại đầu tiên, mili giây. */
const DEFAULT_INITIAL_DELAY_MS = 500;

/** Trần độ trễ mặc định, mili giây. */
const DEFAULT_MAX_DELAY_MS = 1e4;

/** Biên độ dao động mặc định quanh mỗi độ trễ cục bộ. */
const DEFAULT_JITTER_RATIO = 0.1;

/** Tập mã lỗi tạm thời mặc định đủ điều kiện thử lại. */
const DEFAULT_RETRYABLE_CODES = Object.freeze([
  EMPTY_RESPONSE_CODE,
  "RATE_LIMIT",
  "SERVER",
  "TIMEOUT",
  "TRANSPORT",
]);

/** Schema backoff: ba trường số có trần theo hẹn giờ Node và mặc định của thư viện. */
const backoffSchema = z.object({
  initialDelayMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
  maxDelayMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
  jitterRatio: z.number().min(0).max(1).default(DEFAULT_JITTER_RATIO),
});

/** Schema chế độ `normal`: ngân sách thử lại, tập mã đủ điều kiện và backoff. */
const normalPolicySchema = z.object({
  mode: z.const("normal").required(),
  maxRetries: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
  retryableCodes: z.array(z.string()).default([...DEFAULT_RETRYABLE_CODES]),
  backoff: backoffSchema,
});

/** Schema chế độ `always`: chỉ backoff, không ngân sách và không tập mã. */
const alwaysPolicySchema = z.object({
  mode: z.const("always").required(),
  backoff: backoffSchema,
});

/** Schema Cordis mà mỗi cấu hình provider cụ thể nhúng vào. */
export const RetryPolicySchema: z<RetryPolicyConfig> = z.union([
  normalPolicySchema,
  alwaysPolicySchema,
]) as unknown as z<RetryPolicyConfig>;

/** Khoá hợp lệ của chế độ `normal`. */
const NORMAL_POLICY_KEYS = new Set(["mode", "maxRetries", "retryableCodes", "backoff"]);

/** Khoá hợp lệ của chế độ `always` — giữ NGUYÊN bộ khoá của bản gốc. */
const ALWAYS_POLICY_KEYS = new Set(["mode", "maxRetries", "retryableCodes", "backoff"]);

/** Khoá hợp lệ của một khối backoff. */
const BACKOFF_KEYS = new Set(["initialDelayMs", "maxDelayMs", "jitterRatio"]);

/**
 * Từ chối mọi khoá lạ trong một khối cấu hình.
 * Nhận: value — khối cần kiểm; allowed — tập khoá hợp lệ; path — đường dẫn chẩn đoán.
 * Trả: không; ném lỗi nêu đúng khoá lạ đầu tiên gặp được.
 */
function validateKeys(value: object, allowed: ReadonlySet<string>, path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${path}: unknown key "${key}"`);
  }
}

/**
 * Chốt một khối backoff: áp mặc định rồi kiểm từng biên.
 * Nhận: config — khối backoff tuỳ chọn; path — đường dẫn chẩn đoán của khối.
 * Trả: backoff đã đóng băng, đủ ba trường số.
 */
function resolveBackoff(config: BackoffConfig | undefined, path: string): ResolvedRetryBackoff {
  if (config !== undefined) validateKeys(config, BACKOFF_KEYS, path);
  const initialDelayMs = config?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const jitterRatio = config?.jitterRatio ?? DEFAULT_JITTER_RATIO;
  if (!Number.isFinite(initialDelayMs) || initialDelayMs <= 0 || initialDelayMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `${path}.initialDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
    );
  }
  if (!Number.isFinite(maxDelayMs) || maxDelayMs <= 0 || maxDelayMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `${path}.maxDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
    );
  }
  if (initialDelayMs > maxDelayMs) {
    throw new Error(`${path}.initialDelayMs must be less than or equal to maxDelayMs`);
  }
  if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) {
    throw new Error(`${path}.jitterRatio must be between 0 and 1`);
  }
  return Object.freeze({ initialDelayMs, maxDelayMs, jitterRatio });
}

/**
 * Validate, default, and detach one provider-owned retry policy.
 * Nhận: config — cấu hình provider tuỳ chọn; bỏ trống chọn mặc định chế độ `normal`;
 *       path — đường dẫn chẩn đoán của cấu hình provider sở hữu giá trị.
 * Trả: chính sách bất biến, an toàn để chốt trong trạng thái đăng ký provider.
 */
export function resolveRetryPolicy(
  config: RetryPolicyConfig | undefined,
  path: string,
): ResolvedRetryPolicy {
  if (config === undefined) {
    return Object.freeze({
      mode: "normal",
      maxRetries: DEFAULT_MAX_RETRIES,
      retryableCodes: DEFAULT_RETRYABLE_CODES,
      ...resolveBackoff(undefined, `${path}.backoff`),
    });
  }
  switch (config.mode) {
    case "normal": {
      validateKeys(config, NORMAL_POLICY_KEYS, path);
      const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
      const retryableCodes = config.retryableCodes ?? [...DEFAULT_RETRYABLE_CODES];
      if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) {
        throw new Error(`${path}.maxRetries must be a non-negative safe integer`);
      }
      if (retryableCodes.length === 0) {
        throw new Error(`${path}.retryableCodes must not be empty`);
      }
      if (retryableCodes.some((code) => typeof code !== "string" || code.length === 0)) {
        throw new Error(`${path}.retryableCodes must contain only non-empty strings`);
      }
      if (new Set(retryableCodes).size !== retryableCodes.length) {
        throw new Error(`${path}.retryableCodes must not contain duplicates`);
      }
      return Object.freeze({
        mode: "normal",
        maxRetries,
        retryableCodes: Object.freeze([...retryableCodes]),
        ...resolveBackoff(config.backoff, `${path}.backoff`),
      });
    }
    case "always":
      validateKeys(config, ALWAYS_POLICY_KEYS, path);
      return Object.freeze({
        mode: "always",
        ...resolveBackoff(config.backoff, `${path}.backoff`),
      });
    default:
      throw new Error(`${path}.mode must be "normal" or "always"`);
  }
}
