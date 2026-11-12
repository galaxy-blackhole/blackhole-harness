/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Plugin hàm đăng ký đơn vị chiếu `turnOutline`: dàn bài toàn log các lượt của phiên (số lượt,
 *      seq của `turn/start`, bản xem trước prompt có biên) phục vụ qua seam `sessionProjections` —
 *      ảnh chụp sổ đăng ký, kênh thay đổi và mọi vật mang chiếu — để client có thể bày MỌI lượt của
 *      một phiên và nhắm việc nạp lùi lịch sử vào đúng seq mà không cần giữ các sự kiện. Plugin chỉ
 *      sở hữu phép gộp; việc phát là của seam. Bản viết lại của Galaxy Blackhole cho row
 *      session-turn-outline — nguồn đối chiếu: xem README.md của package (G4).
 */

import { turnOutlineProjectionDefinition } from "./projection.ts";
import type { TurnOutlineContext } from "./types.ts";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "session-turn-outline";

/** Sổ chiếu phiên là TOÀN BỘ mục đích của plugin; thiếu nó thì fiber đứng ở trạng thái chờ. */
export const inject: string[] = ["sessionProjections"];

/**
 * Đăng ký đơn vị `turnOutline`; đăng ký là một hiệu ứng trên fiber của plugin này nên gỡ nạp là
 * rút khoá đi.
 * Nhận: context cordis mang sổ chiếu phiên.
 * Trả: không; seam thật trả hàm dọn cho lần đăng ký.
 */
export function apply(ctx: TurnOutlineContext): void {
  ctx.sessionProjections.register(turnOutlineProjectionDefinition);
}
