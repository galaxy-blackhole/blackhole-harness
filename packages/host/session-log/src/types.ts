/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu WIRE cho việc tải session-log tăng dần lên API DeepSeek — hình dạng JSON đúng như nó đi
 *      trên thân request (số đã bỏ thương hiệu, thời gian là epoch ms, thao tác mặt đã duỗi).
 */

import type { JsonValue } from "@deepseek-ai/dsh-util-values";

/** Các trường đầu phiên phiên, serialize thành JSON nguyên thuỷ trên wire của request. */
export interface DeepSeekSessionLogWireHeader {
  /** Thế hệ định dạng phiên. */
  readonly version: number;
  /** Danh tính phiên dạng chuỗi. */
  readonly id: string;
  /** Thời điểm tạo phiên (mili giây Unix). */
  readonly createdAt: number;
  /** Thư mục làm việc tuyệt đối lúc tạo phiên, khi có. */
  readonly cwd?: string;
  /** Phiên cha (dòng dõi fork) dạng chuỗi, khi có. */
  readonly parentSession?: string;
  /** ĐÚNG độ dài tiền tố kế thừa; vắng với phiên không seed. */
  readonly seedLength?: number;
  /** Phân loại thô: phiên con của subagent. */
  readonly origin?: "subagent";
  /** Độ sâu uỷ nhiệm, khi có. */
  readonly delegationDepth?: number;
  /** Preset agent của phiên, khi có. */
  readonly agentPreset?: string;
}

/** Thao tác mặt đã duỗi về số nguyên thuỷ để serialize lên wire của request. */
export type DeepSeekSessionLogWireSurfaceOp =
  | "append"
  | {
      /** Thay các nút mặt từ `startSeq` tới `endSeq` (bao gồm hai đầu). */
      readonly op: "replace";
      /** Số thứ tự nút mặt đầu tiên bị thay. */
      readonly startSeq: number;
      /** Số thứ tự nút mặt cuối cùng bị thay. */
      readonly endSeq: number;
    };

/**
 * Một sự kiện canonical đã dịch sang JSON nguyên thuỷ để tải lên. Sự kiện sinh-mặt BẮT BUỘC có thao
 * tác mặt; sự kiện system/user/tool có thể trích nguồn; bản ghi lạ-còn-ignorable giữ metadata mờ;
 * mọi sự kiện còn lại chỉ có loại + thân.
 */
export type DeepSeekSessionLogWireEvent =
  | {
      /** Sự kiện sinh-thông-điệp trên mặt (trừ assistant). */
      readonly type: "developer/message" | "system/message" | "user/message" | "tool/result";
      /** Số thứ tự trong log. */
      readonly seq: number;
      /** Thời điểm ghi sự kiện (mili giây Unix). */
      readonly time: number;
      /** Thân sự kiện — đúng như nó nằm trong log. */
      readonly data: JsonValue;
      /** Dấu "được phép bỏ qua khi không nhận ra". */
      readonly ignorable?: true;
      /** Cách sự kiện vào mặt có thứ tự. */
      readonly surfaceOp: DeepSeekSessionLogWireSurfaceOp;
      /** Tập nguồn đã trích, nếu có. */
      readonly sourceEventSeqs?: readonly number[];
    }
  | {
      /** Tin nhắn assistant: có thao tác mặt, KHÔNG bao giờ trích nguồn. */
      readonly type: "assistant/message";
      /** Số thứ tự trong log. */
      readonly seq: number;
      /** Thời điểm ghi sự kiện (mili giây Unix). */
      readonly time: number;
      /** Thân sự kiện — đúng như nó nằm trong log. */
      readonly data: JsonValue;
      /** Dấu "được phép bỏ qua khi không nhận ra". */
      readonly ignorable?: true;
      /** Cách sự kiện vào mặt có thứ tự. */
      readonly surfaceOp: DeepSeekSessionLogWireSurfaceOp;
    }
  | {
      /** Bản ghi LẠ còn ignorable: giữ metadata mờ, không có ngữ nghĩa mặt. */
      readonly type: string;
      /** Số thứ tự trong log. */
      readonly seq: number;
      /** Thời điểm ghi sự kiện (mili giây Unix). */
      readonly time: number;
      /** Thân sự kiện — đúng như nó nằm trong log. */
      readonly data: JsonValue;
      /** Bản ghi lạ chỉ được tải lên khi nó khai ignorable. */
      readonly ignorable: true;
      /** Thao tác mặt mờ mà bản ghi lạ mang theo, nếu có. */
      readonly surfaceOp?: JsonValue;
      /** Tập nguồn mờ mà bản ghi lạ mang theo, nếu có. */
      readonly sourceEventSeqs?: JsonValue;
    }
  | {
      /** Mọi sự kiện còn lại (log-only): chỉ loại + thân. */
      readonly type: string;
      /** Số thứ tự trong log. */
      readonly seq: number;
      /** Thời điểm ghi sự kiện (mili giây Unix). */
      readonly time: number;
      /** Thân sự kiện — đúng như nó nằm trong log. */
      readonly data: JsonValue;
      /** Dấu "được phép bỏ qua khi không nhận ra". */
      readonly ignorable?: true;
    };

/** Trường session-log tăng dần, có phiên bản, mang trên mỗi request DeepSeek chính thức. */
export interface DeepSeekSessionLogExtension {
  /** Phiên bản định dạng của trường này. */
  readonly version: 1;
  /** Thế hệ định dạng phiên mà hậu tố này đại diện. */
  readonly sessionFormatVersion: number;
  /** Đầu phiên đã duỗi về JSON nguyên thuỷ. */
  readonly session: DeepSeekSessionLogWireHeader;
  /** Số thứ tự cao nhất ĐÃ GHI BỀN là đã nhận trước request này, hoặc `-1`. */
  readonly afterSeq: number;
  /** Số thứ tự cao nhất mà `events` đại diện. */
  readonly throughSeq: number;
  /** Phong bì canonical ĐẦY ĐỦ cho mọi số thứ tự từ `afterSeq + 1` tới `throughSeq`. */
  readonly events: readonly DeepSeekSessionLogWireEvent[];
}

/** Thân sự kiện `session-log-deepseek/delivery-accepted` ghi vào log canonical. */
export interface DeliveryAcceptedData {
  /** Danh tính phiên mà lượt tải đã nhận mang; mốc fork kế thừa giữ id của phiên CHA. */
  readonly sessionId: string;
  /** Thế hệ định dạng đã nhận; vắng nghĩa là phiên bản 0. */
  readonly sessionFormatVersion?: number;
  /** Sự kiện canonical CUỐI CÙNG nằm trong request đã nhận. */
  readonly throughSeq: number;
}

/** Phiên đang sống, thu hẹp còn đúng phần bộ đóng góp GHI vào (một sự kiện mốc). */
export interface DeliverySink {
  /**
   * Ghi một sự kiện vào log canonical của phiên.
   * Nhận: loại sự kiện `session-log-deepseek/delivery-accepted` và thân sự kiện.
   * Trả: sự kiện vừa ghi (kernel tự cấp số thứ tự và tự áp projection).
   */
  // 08/11/2026 — chủ dự án đổi tên row/namespace sang `session-log-gbh`; loại sự kiện MỚI dài hơn loại cũ
  // nên tham số được nới thành `string` (interface CỤC BỘ của gói, không đụng kernel). Log cũ vẫn đọc được
  // nhờ acceptance.ts đọc CẢ HAI loại.
  append(type: string, data: DeliveryAcceptedData): unknown;
}
