/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Plugin hàm đăng ký đơn vị chiếu `sessionStats`: số đếm lượt/bước toàn log và bốn loại thời
 *      gian tường (mô hình, công cụ, token đầu, giải mã) phục vụ qua seam `sessionProjections` — ảnh
 *      chụp sổ đăng ký, kênh thay đổi và mọi vật mang chiếu — để client bày số liệu TOÀN PHIÊN mà việc
 *      nạp lùi lịch sử và nén ngữ cảnh không làm đổi. Plugin chỉ sở hữu phép gộp; việc phát là của
 *      seam. Bản viết lại của Galaxy Blackhole cho row session-stats — nguồn đối chiếu: xem README.md
 *      của package (G4).
 */

import { sessionStatsProjectionDefinition } from "./projection.ts";
import type { SessionStatsContext } from "./types.ts";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "session-stats";

/** Sổ chiếu phiên là TOÀN BỘ mục đích của plugin; thiếu nó thì fiber đứng ở trạng thái chờ. */
export const inject: string[] = ["sessionProjections"];

/**
 * Đăng ký đơn vị `sessionStats`; đăng ký là một hiệu ứng trên fiber của plugin này nên gỡ nạp là
 * rút khoá đi.
 * Nhận: context cordis mang sổ chiếu phiên.
 * Trả: không; seam thật trả hàm dọn cho lần đăng ký.
 */
export function apply(ctx: SessionStatsContext): void {
  ctx.sessionProjections.register(sessionStatsProjectionDefinition);
}
