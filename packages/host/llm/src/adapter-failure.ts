/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 vùng adapter-failure.js của @deepseek-ai/dsh-llm (lib/index.js dòng 390–474):
 *      gỡ dữ kiện provider serializable khỏi giá trị bị ném ở biên adapter, không để accessor
 *      hay SDK bên thứ ba làm hỏng lỗi chính; giữ nguyên câu chữ và luật kiểm của bản gốc.
 */

import type { ProviderRequestId } from "./brand.ts";
import { HarnessError } from "./error.ts";
import type { LlmFailure } from "./types.ts";

/**
 * Normalization for values thrown by a final LLM adapter boundary.
 *
 * @module @deepseek-ai/dsh-llm/adapter-failure
 */

/**
 * Detach serializable provider facts from a value thrown by an adapter.
 * Nhận: value — giá trị tuỳ ý bị ném trong lúc dispatch hoặc duyệt stream của adapter.
 * Trả: dữ kiện provider trung lập, bất biến, dùng được cho chunk kết thúc cuối.
 * @internal
 */
export function normalizeLlmFailure(value: unknown): LlmFailure {
  const error =
    value instanceof Error ? value : new HarnessError(thrownMessage(value), "UNKNOWN", { cause: value });
  const carried = ownFailureSnapshot(error);
  if (carried !== undefined && carried.code === ownErrorCode(error)) return carried;
  return Object.freeze({
    message: errorMessage(error),
    code: harnessErrorCode(error),
  });
}

/**
 * Render a non-Error throw without letting hostile coercion escape normalization.
 * Nhận: value — giá trị bị ném không phải Error.
 * Trả: chuỗi mô tả, hoặc câu mặc định khi rỗng/không ép chuỗi được.
 */
function thrownMessage(value: unknown): string {
  try {
    const message = String(value);
    return message.length > 0 ? message : "LLM adapter failed";
  } catch {
    return "LLM adapter failed";
  }
}

/**
 * Read a foreign error's own data-backed `code` without invoking accessors.
 * Nhận: error — lỗi cần đọc.
 * Trả: giá trị `code` nếu là thuộc tính dữ liệu riêng, ngược lại `undefined`.
 */
function ownErrorCode(error: Error): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Snapshot an own data property without invoking an SDK-defined accessor.
 * Nhận: error — lỗi cần đọc thuộc tính `failure`.
 * Trả: dữ kiện đã kiểm nếu `failure` là thuộc tính dữ liệu riêng hợp lệ, ngược lại `undefined`.
 */
function ownFailureSnapshot(error: Error): LlmFailure | undefined {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "failure");
    return descriptor !== undefined && "value" in descriptor
      ? failureSnapshot(descriptor.value)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validate and detach an arbitrary serializable failure payload.
 * Nhận: value — payload bất kỳ đọc từ thuộc tính `failure`.
 * Trả: `LlmFailure` đã đóng băng nếu payload hợp lệ, ngược lại `undefined`.
 */
function failureSnapshot(value: unknown): LlmFailure | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  try {
    const candidate = value as Record<string, unknown>;
    const message = candidate["message"];
    const code = candidate["code"];
    const status = candidate["status"];
    const providerRetryAfterMs = candidate["providerRetryAfterMs"];
    const requestId = candidate["requestId"];
    const offloadImages = candidate["offloadImages"];
    if (
      typeof message !== "string" ||
      message.length === 0 ||
      typeof code !== "string" ||
      code.length === 0 ||
      (status !== undefined &&
        (typeof status !== "number" ||
          !Number.isInteger(status) ||
          status < 100 ||
          status > 599)) ||
      (providerRetryAfterMs !== undefined &&
        (typeof providerRetryAfterMs !== "number" ||
          !Number.isFinite(providerRetryAfterMs) ||
          providerRetryAfterMs <= 0)) ||
      (requestId !== undefined && (typeof requestId !== "string" || requestId.length === 0)) ||
      (offloadImages !== undefined &&
        (typeof offloadImages !== "number" ||
          !Number.isSafeInteger(offloadImages) ||
          offloadImages <= 0))
    ) {
      return undefined;
    }
    return Object.freeze({
      message,
      code,
      ...(status === undefined ? {} : { status }),
      ...(providerRetryAfterMs === undefined ? {} : { providerRetryAfterMs }),
      ...(requestId === undefined ? {} : { requestId: requestId as ProviderRequestId }),
      ...(offloadImages === undefined ? {} : { offloadImages }),
    });
  } catch {
    return undefined;
  }
}

/**
 * Read an SDK error message without letting an accessor replace the primary failure.
 * Nhận: error — lỗi cần đọc mô tả.
 * Trả: `message` khác rỗng, hoặc câu mặc định khi accessor ném/rỗng.
 */
function errorMessage(error: Error): string {
  try {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  } catch {
    // accessor hỏng: rơi xuống câu mặc định bên dưới
  }
  return "LLM adapter failed";
}

/**
 * Trust only Harness-owned codes; third-party SDK codes are not our taxonomy.
 * Nhận: error — lỗi đã chuẩn hoá về `Error`.
 * Trả: mã của HarnessError, hoặc `"UNKNOWN"` cho mọi lỗi không thuộc harness.
 */
function harnessErrorCode(error: Error): string {
  return error instanceof HarnessError ? error.code : "UNKNOWN";
}
