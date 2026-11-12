/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Thu hồi grant CHỈ TRONG BỘ NHỚ, có chặn số lần và hạn chờ, cho token đã bị gỡ khỏi credentials cục bộ.
 *      Export: revokeAccount.
 */

import { setTimeout } from "node:timers/promises";
import { logoutAccount } from "./protocol.ts";
import type { AccountToken, LogoutRetryPolicy, PlatformHeaders } from "./types.ts";

/**
 * Thu hồi MỘT grant đã bắt mà không đổi trạng thái tài khoản cục bộ.
 * Nhận: `origin` là issuer đã kiểm trước khi gỡ grant cục bộ; `token` là grant đã gỡ (không bao giờ thay bằng
 * token của lần đăng nhập sau); `policy` là hạn request và các giới hạn thử lại luỹ thừa; `signal` là đời
 * sống provider — tắt máy sẽ huỷ request và cả hạn chờ; `headers` là header deployment chỉ của issuer.
 * Trả: xong sau khi thành công, cạn lượt, hoặc bị huỷ; hỏng phía xa ở lại trong nền.
 */
export async function revokeAccount(
  origin: string,
  token: AccountToken,
  policy: LogoutRetryPolicy,
  signal: AbortSignal,
  headers: PlatformHeaders,
): Promise<void> {
  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    if (signal.aborted) return;
    if (attempt > 0) {
      try {
        await setTimeout(policy.delayMs * 2 ** (attempt - 1), undefined, { signal, ref: false });
      } catch {
        return;
      } // Hạn chờ đã kiểm chỉ bị từ chối khi đời sống provider kết thúc.
    }
    try {
      await logoutAccount(origin, token, AbortSignal.any([signal, AbortSignal.timeout(policy.requestTimeoutMs)]), headers);
      return;
    } catch {
      // Hỏng HTTP, hỏng nghiệp vụ và hỏng vận chuyển tiêu một lượt mà không khôi phục credential.
    }
  }
}
