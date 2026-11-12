/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chính sách timeout cho lượt gọi tool: vũ trang hạn chót mà CHÍNH TOOL khai (`timeoutMs`) lên
 *      `exec.signal` trong lúc dispatch, hoàn tín hiệu của caller sau đó, và chỉ thay kết quả khi hạn
 *      chót CỦA CHÍNH PLUGIN NÀY thắng. Bản viết lại của Galaxy Blackhole cho row timeout-policy
 *      (@galaxy-blackhole/gbh-tool-call-timeout-policy) — nguồn đối chiếu ở README.md của package (G4).
 */

import { deadline, timeoutOf } from "@deepseek-ai/dsh-timeout";
import type { Deadline } from "@deepseek-ai/dsh-timeout";

import { TOOL_TIMEOUT } from "./codes.ts";
import { toolTimeoutResult } from "./result.ts";
import type { TimeoutContext } from "./types.ts";

export { TOOL_TIMEOUT };

/** Tên plugin cordis dùng cho chẩn đoán của bộ nạp — nguyên văn của bản gốc. */
export const name = "timeout-policy";

/** Service mà chính sách bọc (`tools/execute`) và đọc (`get`) — nguyên văn của bản gốc. */
export const inject: string[] = ["tools"];

/**
 * Đăng ký bộ bọc timeout.
 * Nhận: context cordis sở hữu sổ tool và waterfall `tools/execute`.
 * Trả: không; đăng ký MỘT listener — tra `timeoutMs` của định nghĩa tool, tạm thay `exec.signal` bằng
 *       tín hiệu hợp nhất (caller + đồng hồ của ta), gọi tiếp tầng dưới, hoàn lại tín hiệu caller, và
 *       chỉ thay kết quả bằng `TOOL_TIMEOUT` khi hạn chót CỦA TA cháy. Tool không khai `timeoutMs` thì
 *       lời gọi đi qua nguyên vẹn (không đồng hồ, không đổi tín hiệu).
 */
export function apply(ctx: TimeoutContext): void {
  ctx.on("tools/execute", async (exec, next) => {
    // Ngân sách đến từ CHÍNH định nghĩa tool trong sổ, nên tên tool gõ sai là không thể — và tool
    // không khai ngân sách thì không bao giờ bị cắt.
    const timeoutMs = ctx.tools.get(exec.name, exec.agent)?.timeoutMs;
    if (timeoutMs === undefined) return next();
    // Hợp nhất tín hiệu caller với đồng hồ mang mã CỦA TA; `<= 0` là sentinel "không đồng hồ" của
    // kernel (khi đó tín hiệu trả về chính là tín hiệu caller và không có gì để dọn).
    const armed: Deadline = deadline(exec.signal, timeoutMs, TOOL_TIMEOUT);
    const upstream = exec.signal;
    exec.signal = armed.signal;
    try {
      const result = await next();
      // Chỉ hạn chót CỦA TA mới thay kết quả: `timeoutOf` lọc theo mã, nên hạn chót LỒNG NHAU của bộ
      // bọc khác (cháy trước) đọc như một lần huỷ thượng nguồn bình thường, không bị nhận nhầm.
      if (timeoutOf(armed.signal, TOOL_TIMEOUT) !== undefined) return toolTimeoutResult(timeoutMs);
      return result;
    } finally {
      // Hoàn tín hiệu caller TRƯỚC, rồi dọn đồng hồ — nhờ vậy listener `tools/post-execute` không bao
      // giờ thấy tín hiệu đã-cháy của plugin này, và đồng hồ của lượt gọi xong nhanh được xoá.
      exec.signal = upstream;
      armed[Symbol.dispose]();
    }
  });
}
