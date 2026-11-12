/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Từ vựng CHIẾU thuần, an toàn cho trình duyệt, của row subagent: dòng danh mục con trực tiếp,
 *      thời lượng lượt đang mở và danh tính (mode/label) của một phiên con có descriptor. Port 1:1
 *      `lib/types/projection-types.d.ts` (84 dòng mã) của `@deepseek-ai/dsh-subagent`; khối augment
 *      `SessionProjectionMap` của bản gốc được khai lại theo CẤU TRÚC vì repo CẤM augment module
 *      (ADR 000d).
 */

/**
 * Từ vựng chiếu thuần của subagent: dòng danh mục con trực tiếp, thời lượng lượt đang mở, và danh tính
 * (mode/label) của một phiên con có descriptor. Tệp này KHÔNG có runtime — mọi khai báo đều bị xoá khi
 * biên dịch.
 *
 * @module @galaxy-blackhole/gbh-subagent/projection-types
 */

import type { SessionId, SessionSeq } from "@galaxy-blackhole/gbh-session";

/** Một dòng khám phá con trực tiếp hiện hành, được hiện thực hoá từ fact của phiên cha. */
export type SubagentCatalogEntry = {
  readonly id: SessionId;
  readonly createdAt: number;
} & (
  | {
    readonly mode: "one-shot";
    readonly label?: string;
  }
  | {
    readonly mode: "external";
    readonly label?: string;
  }
  | {
    readonly mode: "continuable";
    readonly label: string;
  }
  | {
    readonly mode: "unknown";
    readonly label?: string;
  }
);

/** Thời lượng lượt đang hoạt động, bền vững, cho MỘT phiên con có descriptor chống lưng. */
export interface SubagentTimingProjection {
  /** Số mili giây đã tích sau các lượt HOÀN TẤT nằm sau descriptor CỦA CHÍNH con. */
  settledMs: number;
  /** Cặp mốc cùng một phép cắt của lượt đang mở, khi lượt đó chưa chạm `turn/end`. */
  active?: {
    /** Mốc bắt đầu lượt đang mở. */
    since: number;
    /** Mốc sự kiện muộn nhất đã gộp vào phép cắt chiếu này. */
    through: number;
  };
  /**
   * Lượt đã đóng gần nhất sau descriptor CỦA CHÍNH con có hoàn tất bình thường hay không; vắng khi lượt
   * đang mở hoặc trước khi có lượt đóng đầu tiên.
   */
  lastTurnCompleted?: boolean;
}

/**
 * Danh tính bền vững của MỘT phiên subagent có descriptor chống lưng: chế độ vòng đời cộng nhãn tạo
 * lập, gộp thắng-cuối từ các sự kiện `subagent/descriptor`. Độ mạnh của nhãn theo schema descriptor:
 * con tiếp nối LUÔN mang nhãn, con one-shot có thể bỏ trống.
 */
export type SubagentIdentityProjection =
  | {
    /** Một con one-shot đã kết thúc. */
    mode: "one-shot";
    /** Nhãn tạo lập bền vững tuỳ chọn, lấy từ descriptor của con. */
    label?: string;
    /**
     * Seq của sự kiện `subagent/descriptor` mà danh tính này được gộp từ đó. `session.isOwnSeq(seq)`
     * chứng minh danh tính đến từ ĐUÔI LOG CỦA CHÍNH con — nơi descriptor là bất biến một khi đã được
     * nối — chứ không từ descriptor tổ tiên được phát lại trong hạt giống fork.
     */
    seq: SessionSeq;
  }
  | {
    /** Một cuộc hội thoại có thể tiếp nối. */
    mode: "continuable";
    /** Nhãn tạo lập bền vững, lấy từ descriptor của con. */
    label: string;
    /** Seq của sự kiện descriptor đã gộp; xem nhánh one-shot để có phép chứng minh đuôi-log-của-chính-con. */
    seq: SessionSeq;
  };

/**
 * Ba khoá chiếu mà bản gốc đóng góp vào `SessionProjectionMap` của
 * `@deepseek-ai/dsh-session-projection/types`. Repo CẤM augment module (ADR 000d), nên phần đóng góp
 * được khai tại đây theo CẤU TRÚC với KHOÁ và KIỂU nguyên văn: hình dạng dưới đây ghép được với bảng
 * của kernel ngay khi bảng đó có các khoá này.
 */
export interface SubagentSessionProjectionMap {
  /** Các con trực tiếp theo thứ tự sự kiện của danh mục cha, đã trừ fact thừa kế từ fork. */
  subagentCatalog: SubagentCatalogEntry[];
  /** Thời lượng lượt đang hoạt động và việc hoàn tất lượt đóng gần nhất cho một phiên con có descriptor. */
  subagentTiming: SubagentTimingProjection;
  /**
   * Danh tính của một phiên con có descriptor. `null` ⟺ KHÔNG có descriptor hợp lệ (thiếu, sai hình
   * dạng, hay phiên bản lạ — cố ý không phân biệt). Chốt `null` này cố ý tuần tự hoá được: một giá trị
   * đẩy qua vận chuyển JSON phải sống sót `JSON.stringify` không mất mát, nơi trường `undefined` sẽ bị
   * bỏ đi và một danh tính cũ sẽ sống sót trên bên nhận. Bản thân mục thì luôn có mặt, không tuỳ chọn.
   */
  subagent: SubagentIdentityProjection | null;
}
