/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Dựng hạt giống fork trên một tiền tố sự kiện nguồn chính xác: sao tiền tố bao gồm hai đầu,
 *      đánh dấu mốc thừa kế, rồi đóng phần đuôi còn mở bằng kết quả và kết thúc bước/lượt mang
 *      nguyên nhân `forked`. Port 1:1 vùng `lib/types/fork.js` (27 dòng) của
 *      `@deepseek-ai/dsh-session`.
 */

/**
 * Dựng hạt giống fork trên một tiền tố sự kiện nguồn chính xác.
 *
 * @module @galaxy-blackhole/gbh-session/fork
 */

import { openTurnClosers } from './repair.ts';
import { SessionSeq } from './types.ts';
import type { SessionEvent, SessionSeq as SessionSeqType } from './types.ts';

/**
 * Sao chép một tiền tố sự kiện bao gồm hai đầu, đánh dấu mốc thừa kế của nó, rồi đóng phần đuôi
 * còn mở bằng kết quả và kết thúc bước/lượt mang nguyên nhân `forked`. Bước và lượt đã đóng được
 * giữ nguyên không đổi. Người gọi kiểm tra rằng biên là một seq sự kiện liền mạch có thật; hàm dựng
 * Session chụp lại các sự kiện vay mượn trước khi công bố.
 *
 * Nhận: events — log nguồn có các seq liền mạch từ 0; boundary — seq sự kiện nguồn cuối cùng mà con
 * thừa kế (bao gồm chính nó).
 * Trả: mảng mới giữ nguyên các đối tượng sự kiện nguồn, nối sau là các sự kiện đóng tổng hợp nằm
 * ngoài tiền tố thừa kế — phần mà `inheritedEventCount` đếm.
 *
 * @param events - log nguồn có các seq liền mạch từ 0.
 * @param boundary - seq sự kiện nguồn cuối cùng mà con thừa kế (bao gồm chính nó).
 * @returns mảng mới giữ nguyên các đối tượng sự kiện nguồn, nối sau là các sự kiện đóng tổng hợp nằm ngoài tiền tố thừa kế.
 */
export function buildForkSeed(events: readonly SessionEvent[], boundary: SessionSeqType): SessionEvent[] {
  const prefix = events.slice(0, boundary + 1);
  prefix.push({
    type: 'session/end-seed', seq: SessionSeq(boundary + 1),
    // Người gọi đã kiểm tra chính sự kiện nguồn này tồn tại (bất biến của biên fork).
    time: events[boundary]!.time,
    data: { inherited: true },
  });
  return prefix.concat(openTurnClosers(prefix, { kind: 'forked' }));
}
