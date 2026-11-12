/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng của row commands: định nghĩa/descriptor/kết quả/lượt thực thi và hình dạng tối thiểu của agent + block tệp đính kèm (mượn KIỂU, không nhận peer).
 */

import type { FileAttachmentRef, ImageAttachmentRef, ImageMediaType } from "@deepseek-ai/dsh-attachment";
import type { CommandDefinitionId, CommandId } from "./brand.ts";
import type { SessionSeq } from "./seq.ts";

/** Một tệp đính kèm lệnh do trình duyệt gửi: ảnh đã mã hoá, hoặc biên nhận tệp đã đóng gói. */
export type CommandSubmitAttachment =
  | ({ readonly type: "image" } & EncodedImageAttachmentLike)
  | { readonly type: "file"; readonly receiptId: string };

/** Hình dạng của `EncodedImageAttachment` bên `dsh-attachment` (chỉ mượn KIỂU). */
export interface EncodedImageAttachmentLike {
  /** Loại media khai báo, được kiểm lại với byte đã giải mã khi nhận. */
  readonly mediaType: ImageMediaType;
  /** Base64 chuẩn tắc của byte ảnh. */
  readonly data: string;
  /** Tên hiển thị tuỳ chọn; KHÔNG bao giờ được hiểu là đường dẫn. */
  readonly name?: string;
}

/** Hình dạng của `ImageBlock` bên `dsh-llm` (chỉ mượn KIỂU). */
export interface ImageBlockLike {
  /** Loại block. */
  readonly type: "image";
  /** Tham chiếu ảnh bền vững do service attachment sở hữu. */
  readonly attachment: ImageAttachmentRef;
  /** Do quyết định offload hoặc một lượt viết lại tin nhắn sinh ra. */
  readonly offloaded?: true;
}

/** Hình dạng của `FileBlock` bên `dsh-llm` (chỉ mượn KIỂU). */
export interface FileBlockLike {
  /** Loại block. */
  readonly type: "file";
  /** Tham chiếu tệp nguyên văn bền vững do service attachment sở hữu. */
  readonly attachment: FileAttachmentRef;
}

/** Block nội dung mô hình nhìn thấy đi kèm một lượt gọi lệnh. */
export type CommandAttachmentBlock = ImageBlockLike | FileBlockLike;

/** Một tệp đính kèm nguyên văn bền vững (dùng lại kiểu của service attachment). */
export type CommandFileAttachmentRef = FileAttachmentRef;

/** Metadata bất biến cho phần nhập tự do tuỳ chọn của một lệnh. */
export interface CommandInputDescriptor {
  /** Chỗ trống hiện ra trước khi người dùng nhập nội dung tự do. */
  readonly hint: string;
  /**
   * Có cho phép tệp đính kèm của composer đi kèm một lượt gọi hay không. Vắng hoặc
   * `false` = bộ thực thi từ chối lượt gọi mang đính kèm, và composer có khả năng cũng
   * từ chối trước khi gửi. Lệnh khai báo thì handler nhận các block bền vững đã nhận
   * và tự quyết mọi luật ngữ pháp tiếp theo, kể cả từ chối lệnh con không dùng được chúng.
   */
  readonly attachments?: boolean;
}

/** Kết quả lệnh mong đợi, được UI đang gửi vẽ trực tiếp. */
export type CommandResult =
  | {
      readonly kind: "success";
      readonly text?: string;
      /** Sự kiện nghiệp vụ có thẩm quyền sớm hơn, sở hữu phần trình bày giàu hơn. */
      readonly sourceEventSeq?: SessionSeq;
    }
  | { readonly kind: "error"; readonly text: string };

/** Một lượt thực thi đã an bài: kết quả đã chuẩn hoá + id ghép cặp của hai bản ghi vòng đời. */
export interface CommandExecution {
  /** Id ghép cặp mang bởi các sự kiện vòng đời của lượt này. */
  readonly commandId: CommandId;
  /** Kết quả đã chuẩn hoá của handler. */
  readonly result: CommandResult;
}

/** Góc nhìn bất biến, KHÔNG có handler, trả cho các adapter UI. */
export interface CommandDescriptor {
  /** Danh tính do plugin sở hữu; vắng khi định nghĩa không cần hành vi client theo danh tính. */
  readonly definitionId?: CommandDefinitionId;
  /** Tên lệnh chữ thường, không có dấu gạch chéo đầu. */
  readonly name: string;
  /** Tóm tắt người đọc được, dùng cho UI khám phá. */
  readonly description: string;
  /** Gợi ý nhập tự do tuỳ chọn, quảng bá cho client có khả năng. */
  readonly input?: CommandInputDescriptor;
}

/** Nguồn phát một lượt gọi lệnh (khe `source` của sự kiện `command/run`). */
export interface CommandSourceMap {
  /** Mọi caller hiện tại là bề mặt UI cho người, nên chỉ có một biến thể. */
  user: { kind: "user" };
}

/** Hợp của {@link CommandSourceMap} — ai đã gửi dòng lệnh. */
export type CommandSource = CommandSourceMap[keyof CommandSourceMap];

/** Định nghĩa lệnh do plugin sở hữu. */
export interface CommandDefinition {
  /** Danh tính ổn định do plugin sở hữu; vắng khi không cần hành vi client theo danh tính. */
  readonly definitionId?: CommandDefinitionId;
  /** Tên lệnh chữ thường, không có dấu gạch chéo đầu. */
  readonly name: string;
  /** Tóm tắt người đọc được, dùng cho UI khám phá. */
  readonly description: string;
  /** Gợi ý nhập tự do tuỳ chọn, quảng bá cho client có khả năng. */
  readonly input?: CommandInputDescriptor;
  /**
   * `command/run` có ghi `rawInput` hay không. Mặc định `true`. Lệnh mà sự kiện nghiệp vụ
   * của nó đã sở hữu payload thì đặt `false` để khỏi nhân đôi payload trong log Session.
   */
  readonly recordInput?: boolean;
  /** Thực thi trên đúng agent nhận lệnh, KHÔNG gửi lệnh cho mô hình. */
  readonly handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>;
}

/** Dòng lệnh gạch chéo hợp cú pháp, trước khi sổ đăng ký phân giải. */
export interface ParsedCommand {
  /** Tên lệnh chữ thường, không có dấu gạch chéo đầu. */
  readonly name: string;
  /** Đúng phần chữ sau tên lệnh. */
  readonly rawInput: string;
}

/** Lượt gọi được truyền cho handler của một lệnh đã đăng ký. */
export interface CommandInvocation {
  /** Id ghép cặp ĐÃ ghi vào sự kiện `command/run` của lượt này. */
  readonly commandId: CommandId;
  /** Đúng agent mà UI nhận lệnh. */
  readonly agent: CommandAgent;
  /** Đúng phần chữ sau tên lệnh đã đăng ký, kể cả khoảng trắng phân cách. */
  readonly rawInput: string;
  /**
   * Các block ảnh/tệp bền vững đi kèm lượt gọi này, theo đúng thứ tự gửi; rỗng trừ khi
   * định nghĩa khai `input.attachments`. Handler sở hữu việc dùng chúng ở phía mô hình —
   * sổ đăng ký không bao giờ tự lên lịch cho chúng.
   */
  readonly attachments: readonly CommandAttachmentBlock[];
  /** Tín hiệu huỷ do yêu cầu UI đang gửi sở hữu. */
  readonly signal: AbortSignal;
}

/**
 * Hình dạng TỐI THIỂU của một agent mà sổ đăng ký dùng: nó chỉ đọc `session.append`
 * (ghi vòng đời) và dùng chính agent làm khoá phạm vi. Khai theo CẤU TRÚC để gói không
 * phải nhận peer `dsh-agent` (bản gốc chỉ mượn KIỂU `Agent`).
 */
export interface CommandAgent {
  /** Session nhận các bản ghi vòng đời chỉ-trong-log. */
  readonly session: CommandSessionLike;
}

/** Hình dạng cấu trúc của phần Session mà sổ đăng ký gọi. */
export interface CommandSessionLike {
  /**
   * Ghi một sự kiện chỉ-trong-log.
   * Nhận: `type` — tên sự kiện; `data` — payload của nó.
   * Trả: giá trị do Session trả về (không dùng tới).
   */
  append(type: string, data: unknown): unknown;
}

/**
 * Bộ giải biên nhận tệp đã đóng gói, do chủ sở hữu upload của Session cài.
 * Nhận: `agent` — agent nhận; `receiptId` — biên nhận do trình duyệt gửi.
 * Trả: tham chiếu tệp bền vững, hoặc `undefined` khi biên nhận không thuộc Session này.
 */
export type CommandFileReceiptResolver = (agent: CommandAgent, receiptId: string) => CommandFileAttachmentRef | undefined;
