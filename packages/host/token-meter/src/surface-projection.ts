/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Phép gộp O(1) token bề mặt cho projection áp lực ngữ cảnh của token-meter — bản viết lại 1:1
 *      `lib/types/surface-projection.js` của `@deepseek-ai/dsh-token-meter`.
 */

/**
 * Phép gộp O(1) tổng token bề mặt của projection áp lực ngữ cảnh.
 *
 * Checkpoint của nó giữ các tổng VÔ HƯỚNG thay vì bề mặt còn giữ mà phép đo dùng. Các lần thay thế đi
 * theo giao thức giá bóng của seam nén: sự kiện meter NGAY TRƯỚC một lần `replace` bề mặt
 * (`compaction/summary` hoặc `compaction/prune`) nêu giá ước lượng của ĐÚNG khoảng bị thay, nên phép
 * gộp giữ một tổng đang chạy cộng nhiều nhất MỘT claim chờ và KHÔNG BAO GIỜ giữ giá từng node. Các số
 * đếm là CHÍNH XÁC theo cấu trúc: producer suy chúng từ đúng bộ ước lượng cố định mà module này định
 * giá các lần nối. Một lần thay thế không có claim đã nạp thì gộp với delta bằng 0 vì trạng thái có
 * giới hạn không dựng lại được khoảng bị thay; điều này giữ được phát lại với cái giá là có thể trôi.
 */

import { SessionSeq, deriveEventMessage, isSurfaceEvent } from "@galaxy-blackhole/gbh-session";
import type { SessionEvent } from "@galaxy-blackhole/gbh-session";
import type {} from "@deepseek-ai/dsh-compaction";

import { estimateMessage } from "./estimate.ts";

/**
 * MỘT giá bóng đã nạp: token ước lượng của khoảng bề mặt mà sự kiện NGAY SAU sẽ thay thế. JSON thuần —
 * nó là một phần của trạng thái đơn vị đã lưu trong lúc còn nạp.
 */
export interface ShadowPriceClaim {
  /** Seq bề mặt ĐẦU (tính cả) đã khai của khoảng được định giá. */
  start: SessionSeq;
  /** Seq bề mặt CUỐI (tính cả) đã khai của khoảng được định giá. */
  end: SessionSeq;
  /** Token ước lượng của khoảng được định giá dưới bộ ước lượng cố định. */
  tokens: number;
}

/** Ảnh hưởng của MỘT sự kiện lên tổng token bề mặt đang chạy. */
export interface SurfaceTokensFold {
  /** Thay đổi CÓ DẤU của tổng bề mặt; 0 với sự kiện nằm ngoài bề mặt. */
  readonly deltaTokens: number;
  /** Claim mang sang sự kiện kế tiếp; `undefined` khi không claim nào sống sót. */
  readonly claim: ShadowPriceClaim | undefined;
}

/**
 * Gộp MỘT sự kiện đã cam kết vào tổng token bề mặt đang chạy.
 *
 * Một sự kiện giá bóng NẠP một claim; mọi sự kiện khác làm nó HẾT HẠN, và một lần `replace` trên bề mặt
 * TIÊU THỤ claim nêu ĐÚNG khoảng của nó — các producer nối sự kiện đo và lần thay thế NGAY LIỀN nhau
 * một cách đồng bộ, nên một claim còn sống LUÔN định giá đúng sự kiện kế tiếp. Một lần replace không có
 * claim gộp với delta 0 vì trạng thái bị chặn không dựng lại được khoảng đã bị thay. Một claim đã nạp
 * cho khoảng KHÁC vẫn phải NỔ vì hai sự kiện liền kề mâu thuẫn nhau.
 * Nhận: `claim` — claim do sự kiện NGAY TRƯỚC nạp (nếu có); `event` — sự kiện phiên đã cam kết kế tiếp.
 * Trả: delta token CÓ DẤU và trạng thái claim sau sự kiện này.
 * Ném: khi một lần thay thế tới với claim đã nạp cho khoảng KHÁC — sự kiện đo đã liền kề, nên đây là vi
 *       phạm hợp đồng giá bóng của một producer ĐANG SỐNG, không phải dữ liệu lịch sử, và phải nổ to
 *       thay vì để tổng trôi.
 */
export function foldSurfaceProjection(claim: ShadowPriceClaim | undefined, event: SessionEvent): SurfaceTokensFold {
  if (event.type === "compaction/summary" || event.type === "compaction/prune") {
    const { shadowedRange, shadowedTokenCount } = event.data;
    return {
      deltaTokens: 0,
      claim: {
        start: SessionSeq(shadowedRange.start),
        end: SessionSeq(shadowedRange.end),
        tokens: shadowedTokenCount,
      },
    };
  }
  if (!isSurfaceEvent(event)) return { deltaTokens: 0, claim: undefined };
  const message = deriveEventMessage(event);
  // Cung ly do voi breakdown-projection.ts: ep MOT cho tai bien.
  const tokens = message === null ? 0 : estimateMessage(message as unknown as Parameters<typeof estimateMessage>[0]);
  const op = event.surfaceOp;
  if (op === "append") return { deltaTokens: tokens, claim: undefined };
  // Phiên ghi TRƯỚC giao thức giá bóng ghi các lần thay thế mà KHÔNG có sự kiện đo liền kề; trạng thái
  // bị chặn không dựng lại được giá của khoảng đã bị thay, nên gộp những lần đó một cách TRUNG TÍNH —
  // phát lại lịch sử chấp nhận TRÔI thay vì NỔ.
  if (claim === undefined) return { deltaTokens: 0, claim: undefined };
  if (claim.start !== op.startSeq || claim.end !== op.endSeq) {
    throw new Error(
      `token surface: replace at seq ${event.seq} over range ${op.startSeq}-${op.endSeq} has no adjacent shadow price` +
        ` (armed claim covers ${claim.start}-${claim.end})`,
    );
  }
  return { deltaTokens: tokens - claim.tokens, claim: undefined };
}
