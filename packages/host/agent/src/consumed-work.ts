/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phép gấp "công việc đã tiêu thụ" của một nhật ký agent: lượt nào tính công việc nó đã
 *      nhận, và việc nào bị huỷ khỏi thư chờ mà KHÔNG chạy. Viết lại theo hành vi của
 *      @deepseek-ai/dsh-agent/consumed-work (phần nội bộ của gói gốc).
 */

import type { ConsumedWork, SessionEvent, TurnEndReason } from "./types.ts";

/** Dữ liệu `turn/start` mà phép gấp đọc. */
interface TurnStartData {
  /** Số lượt vừa mở. */
  readonly turn?: number;
}

/** Dữ liệu `step/start` mà phép gấp đọc. */
interface StepStartData {
  /** Số lượt của bước vừa mở. */
  readonly turn?: number;
}

/** Dữ liệu `agent/inbox/spliced` mà phép gấp đọc. */
interface InboxSplicedData {
  /** Số thông điệp đã bỏ; VẮNG nghĩa là lần ghi này không phải một lần cắt (bị bỏ qua). */
  readonly removedCount?: number;
  /** Kết cục của lần cắt; `canceled` là huỷ chứ không phải tiêu thụ. */
  readonly outcome?: "canceled";
  /** Thông điệp đã chèn tại vị trí cắt. */
  readonly inserted: readonly unknown[];
}

/** Dữ liệu `turn/end` mà phép gấp đọc. */
interface TurnEndData {
  /** Số lượt vừa đóng. */
  readonly turn?: number;
  /** Lý do đóng lượt. */
  readonly reason: TurnEndReason;
}

/**
 * Đọc `data` của một sự kiện theo hình dạng mà một nhánh `switch` cần.
 * Nhận: `event` — sự kiện phiên đã cam kết.
 * Trả: chính `data` của nó, dưới hình dạng T (KHÔNG kiểm lúc chạy — giống bản gốc).
 */
function dataOf<T>(event: SessionEvent): T {
  return event.data as T;
}

/**
 * Một lượt đã tiêu thụ đầu vào mà không tới được bước nào có tính công việc đó không. Chỉ kết
 * thúc `completed` là KHÔNG tính: nó không còn gì để chạy sau khi phần đã nhận bị viết lại.
 * `blocked` cũng là kết thúc CỦA đầu vào đó — lần từ chối trước bước đã bỏ các thông điệp đã nhận.
 * Nhận: `reason` — kết thúc đã ghi của lượt.
 * Trả: `true` khi kết thúc đó tính công việc mà lượt đã nhận.
 */
function accountsForClaim(reason: TurnEndReason): boolean {
  switch (reason.kind) {
    case "completed":
      return false;
    case "blocked":
    case "aborted":
    case "interrupted":
    case "error":
      return true;
    /* Nhánh dự phòng: `max-tokens` cần một bước nên bị chặn trước lời gọi này; `forked` chỉ có
     * trong lịch sử mồi của constructor. `TurnEndReasonMap` hợp nhất được nên một biến thể do
     * backend thêm vào không thể liệt kê — một kết thúc KHÔNG GỌI TÊN ĐƯỢC trên đầu vào đã tiêu
     * thụ KHÔNG được đọc thành công. */
    default:
      return true;
  }
}

/**
 * Gấp MỘT nhật ký agent, hoặc một hậu tố thuộc sở hữu của nó, thành bản tính công việc đã tiêu
 * thụ. Một lượt quét, và mọi đầu vào chính là nhật ký: không bên gọi nào phải lấy mẫu trạng thái
 * sống trước khi huỷ, nên một lần huỷ do BẤT KỲ ai phát — hàm dọn của chủ sở hữu, cú ngắt của
 * tổ tiên, plugin đang gỡ — đều đọc ra như nhau.
 * Nhận: `events` — nhật ký, hoặc hậu tố thuộc sở hữu, cần gấp.
 * Trả: lượt tính công việc khi có một lượt đã đóng, và cờ việc bị bỏ KHÔNG chạy sau lượt đó.
 */
export function foldConsumedWork(events: readonly SessionEvent[]): ConsumedWork {
  const stepped = new Set<number | undefined>();
  const claimed = new Set<number | undefined>();
  let open: number | undefined;
  let end: SessionEvent | undefined;
  let droppedUnrun = false;
  for (const event of events) {
    switch (event.type) {
      case "turn/start": {
        open = dataOf<TurnStartData>(event).turn;
        break;
      }
      case "step/start": {
        // KHÔNG lọc `undefined`: bản gốc thêm thẳng giá trị vào tập, và một `turn/end` có
        // `turn` vắng phải xoá được đúng mục đó (lọc đi sẽ đổi kết cục của ca dị dạng).
        stepped.add(dataOf<StepStartData>(event).turn);
        break;
      }
      case "agent/inbox/spliced": {
        const { removedCount, outcome, inserted } = dataOf<InboxSplicedData>(event);
        if (removedCount === undefined) break;
        if (outcome === "canceled") droppedUnrun ||= inserted.length === 0;
        else if (open !== undefined) claimed.add(open);
        break;
      }
      case "turn/end": {
        const { turn, reason } = dataOf<TurnEndData>(event);
        open = undefined;
        // Thứ tự và đoản mạch là HÀNH VI: `claimed.delete` chỉ chạy khi `stepped.delete` trả false,
        // nên sao chép đúng thứ tự thay vì "lọc tập cho gọn".
        if (stepped.delete(turn) || (claimed.delete(turn) && accountsForClaim(reason))) {
          end = event;
          droppedUnrun = false;
        }
        break;
      }
      default:
        break;
    }
  }
  return end === undefined ? { droppedUnrun } : { end, droppedUnrun };
}
