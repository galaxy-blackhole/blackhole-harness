/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Từ vựng CHỈ-KIỂU an toàn cho trình duyệt của bề mặt điều khiển subagent: dòng danh mục đệ quy,
 *      địa chỉ duyệt cha/con, yêu cầu prompt tiếp nối, biên nhận prompt và interrupt. Port 1:1
 *      `lib/types/control-types.d.ts` (141 dòng mã) của `@deepseek-ai/dsh-subagent`; hai khối augment
 *      của bản gốc được khai lại theo CẤU TRÚC vì repo CẤM augment module (ADR 000d).
 */

/**
 * Từ vựng chỉ-kiểu của bề mặt điều khiển subagent: dòng danh mục đệ quy, địa chỉ duyệt cha/con, yêu cầu
 * prompt tiếp nối và biên nhận prompt/interrupt, cộng hai mục mà bản gốc đóng góp qua augment module.
 * Tệp này KHÔNG có runtime — mọi khai báo đều bị xoá khi biên dịch.
 *
 * @module @galaxy-blackhole/gbh-subagent/control-types
 */

import type { PromptContentPart } from "@deepseek-ai/dsh-attachment";
import type { Branded } from "@deepseek-ai/dsh-brand";
import type { MessageId } from "@deepseek-ai/dsh-llm";
import type { SessionId } from "@galaxy-blackhole/gbh-session";

/**
 * Danh tính do trình duyệt đúc cho MỘT prompt, được lưu trên đúng tin nhắn đã được nhận. Nó mang dấu
 * `session-request-id` của Session Controller để prompt subagent và prompt Session thường dùng chung một
 * từ vựng danh tính; gói Session Controller phụ thuộc gói này, nên dấu được viết tại đây thay vì nhập
 * từ đó.
 */
export type SubagentPromptRequestId = Branded<"session-request-id">;

/** Trường con DÙNG CHUNG cho phép liệt kê danh mục đệ quy. */
export type SubagentCatalogRow = {
  /** Id phiên con bền vững, ổn định xuyên các Activation. */
  readonly id: SessionId;
  /**
   * Phép liệt kê danh mục đệ quy có quan sát được một Session cư trú hay không. Trường này KHÔNG mã
   * hoá kết cục bền vững và cũng không bảo đảm việc giao tiếp nối.
   */
  readonly activity: "running" | "inactive";
} & (
  | {
    /** Một con one-shot đã kết thúc. */
    readonly mode: "one-shot";
    /** Nhãn tạo lập bền vững tuỳ chọn, lấy từ danh mục của cha. */
    readonly label?: string;
  }
  | {
    /** Một lượt thi hành bên ngoài, không có Session con cục bộ. */
    readonly mode: "external";
    /** Nhãn tạo lập bền vững tuỳ chọn, lấy từ danh mục của cha. */
    readonly label?: string;
  }
  | {
    /** Một cuộc hội thoại có thể tiếp nối. */
    readonly mode: "continuable";
    /** Nhãn tạo lập bền vững, lấy từ danh mục của cha. */
    readonly label: string;
  }
);

/**
 * Một dòng danh mục đệ quy. Lượt duyệt cũng có thể trả chẩn đoán cho chế độ danh mục lạ hoặc danh mục
 * con không đọc được.
 */
export type SubagentListEntry =
  | (SubagentCatalogRow & {
    readonly kind: "child";
    /** Danh mục của con có chứa một con trực tiếp hay không. */
    readonly hasChildren: boolean;
  })
  | {
    readonly kind: "diagnostic";
    /** Id phiên của ứng viên. */
    readonly id: SessionId;
    /**
     * `corrupt` nghĩa là lượt đọc danh mục con gặp dữ liệu Session không hợp lệ hoặc xung đột;
     * `unavailable` nghĩa là không đọc được. Cả hai lỗi đều DỪNG nhánh đó. `unsupported` nghĩa là danh
     * mục cha ghi một chế độ con lạ; danh mục đọc được của nó vẫn được duyệt tiếp.
     */
    readonly reason: "corrupt" | "unsupported" | "unavailable";
  };

/** Địa chỉ duyệt cha/con bền vững; chế độ lạ được phân giải khi lịch sử của con được đọc. */
export type SubagentAddress = {
  readonly parentSessionId: SessionId;
  readonly childSessionId: SessionId;
} & (
  | {
    readonly mode: "one-shot";
  }
  | {
    readonly mode: "continuable";
  }
  | {
    readonly mode: "unknown";
  }
);

/** MỘT đích hộp thư Agent, đúng như yêu cầu prompt chọn. */
export type SubagentDelivery = SubagentPromptRequest["delivery"];

/** Một tin nhắn con người gửi tới MỘT con trực tiếp có thể tiếp nối. */
export interface SubagentPromptRequest {
  /** Danh tính được lưu trên tin nhắn đã nhận, đúc TRƯỚC lượt gọi. */
  readonly requestId: SubagentPromptRequestId;
  readonly parentSessionId: SessionId;
  readonly childSessionId: SessionId;
  /** Bộ phân biệt bắt buộc, giữ lại từ địa chỉ điều khiển của trình duyệt. */
  readonly mode: "continuable";
  /** Tin nhắn này xếp hàng một lượt sau hay nhắm vào bước gần nhất. */
  readonly delivery: "queue" | "steer";
  /**
   * Các phần prompt của trình duyệt được giao làm tin nhắn người dùng của con. Host nhận và lưu các
   * phần ảnh TRƯỚC khi giao, nên dây không bao giờ mang tham chiếu tệp đính kèm bền vững mà bên gọi có
   * thể bịa ra.
   */
  readonly content: readonly PromptContentPart[];
  /** Vùng thời gian của trình duyệt, tuỳ chọn, được lấy mẫu cho đúng prompt con người này. */
  readonly clientTimeZone?: string;
}

/** Danh tính hộp thư trả về một khi lượt tiếp nối nhận MỘT tin nhắn con người. */
export interface SubagentPromptReceipt {
  readonly messageId: MessageId;
}

/** Biên nhận đồng nhất cho biết MỘT yêu cầu interrupt đã được nhận. */
export interface SubagentInterruptReceipt {
  readonly accepted: true;
}

/**
 * Mục hoạt động `subagent` mà bản gốc đóng góp vào `SessionActivityKindMap` của
 * `@deepseek-ai/dsh-workspace/types`. Repo CẤM augment module (ADR 000d), nên phần đóng góp được khai
 * tại đây theo CẤU TRÚC: hình dạng dưới đây ghép được với bảng của kernel ngay khi bảng đó có khoá này.
 */
export interface SubagentSessionActivityKindMap {
  /** Một phiên subagent được uỷ nhiệm từ phiên này (ở bất kỳ độ sâu nào) đang ở trong một lượt. */
  subagent: true;
}

/**
 * Chi tiết lỗi mà bề mặt điều khiển trả về. Prompt và interrupt dùng chung các lỗi này với kết quả
 * Remote phía Client.
 *
 * Bản gốc khai sáu mục dưới đây trong khối augment `RemoteErrorDetailsMap` của
 * `@deepseek-ai/dsh-typert-protocol`; repo CẤM augment module (ADR 000d), nên chúng được khai lại theo
 * CẤU TRÚC với KHOÁ và HÌNH DẠNG PAYLOAD nguyên văn. Bên dùng ghép bảng này với
 * `RemoteErrorDetailsMap` của gói protocol khi cần toàn bộ từ vựng mã lỗi.
 */
export interface SubagentRemoteErrorDetailsMap {
  /** Vùng thời gian do trình duyệt gửi không phải UTC cũng không phải tên IANA chuẩn tắc. */
  "subagent/invalid-time-zone": {
    readonly value: string;
  };
  /** Không có Agent sống nào mang id phiên cha được nêu. */
  "subagent/parent-unavailable": {
    readonly parentSessionId: SessionId;
  };
  /** Con được nêu không thể nhận một lượt tiếp nối. */
  "subagent/not-resumable": {
    readonly childSessionId: SessionId;
  };
  /** Cha được trình không sở hữu con được nêu. */
  "subagent/unauthorized": {
    readonly childSessionId: SessionId;
  };
  /** Việc nhận ảnh hoặc việc model từ chối năng lực ảnh. */
  "subagent/attachment-invalid": {
    readonly reason: string;
  };
  /** Con tồn tại nhưng hộp thư của nó hiện không nhận được tin nhắn. */
  "subagent/delivery-unavailable": {
    readonly childSessionId: SessionId;
  };
}
