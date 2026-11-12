/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểm tra yêu cầu prompt và interrupt của subagent do trình duyệt gửi, cùng các mã lỗi prompt ổn
 *      định mà bề mặt Remote trả về. Port 1:1 `lib/types/control.js` (79 dòng) + `control.d.ts`
 *      (45 dòng) của `@deepseek-ai/dsh-subagent`.
 */

/**
 * Kiểm tra yêu cầu prompt và interrupt của subagent do trình duyệt gửi, cùng các mã lỗi prompt ổn định
 * mà bề mặt Remote trả về.
 *
 * @module @galaxy-blackhole/gbh-subagent/control
 */

import { AttachmentError } from "@deepseek-ai/dsh-attachment";
import type { SessionId } from "@galaxy-blackhole/gbh-session";
import {
  RemoteError as ProtocolRemoteError,
  type RemoteErrorDetailsMap,
} from "@deepseek-ai/dsh-typert-protocol";
import { z } from "zod/v4";

import { SubagentError } from "./error.ts";

/** Schema id phiên: chuỗi khác rỗng. */
const SESSION_ID_SCHEMA = z.string().min(1);

/**
 * Schema payload của hai phương thức điều khiển, theo đúng tên phương thức. Hình dạng chặt hơn codec
 * chuỗi-đóng-dấu do typert sinh ra, nên được kiểm riêng trước khi dịch vụ nhận yêu cầu.
 */
const CONTROL_ID_SCHEMAS = {
  'subagent.prompt': z.object({
    parentSessionId: SESSION_ID_SCHEMA,
    childSessionId: SESSION_ID_SCHEMA,
    mode: z.literal('continuable'),
    delivery: z.enum(['queue', 'steer']),
  }),
  'subagent.interrupt': z.object({
    parentSessionId: SESSION_ID_SCHEMA,
    childSessionId: SESSION_ID_SCHEMA,
    mode: z.literal('continuable'),
  }),
};

/**
 * Mục lỗi Remote do namespace subagent sở hữu, khai theo CẤU TRÚC — thay cho khối augment
 * `RemoteErrorDetailsMap` của bản gốc (`lib/types/control-types.d.ts`) mà repo CẤM (ADR 000d). Khoá
 * và hình dạng payload giữ NGUYÊN VĂN.
 *
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
interface SubagentRemoteErrorDetailsMap {
  /** Việc nhận ảnh hoặc việc model từ chối năng lực ảnh. */
  readonly 'subagent/attachment-invalid': { readonly reason: string };
  /** Con được nêu tên không thể nhận tiếp nối. */
  readonly 'subagent/not-resumable': { readonly childSessionId: SessionId };
  /** Cha được trình không sở hữu con được nêu tên. */
  readonly 'subagent/unauthorized': { readonly childSessionId: SessionId };
  /** Con tồn tại nhưng hộp thư của nó hiện không nhận được tin nhắn. */
  readonly 'subagent/delivery-unavailable': { readonly childSessionId: SessionId };
}

/**
 * Toàn bộ mã lỗi Remote mà module này dựng: bốn mã riêng của namespace subagent cộng các mã mang phổ
 * quát đã có chủ sở hữu kiểu ở gói protocol (ADR 0009).
 */
type ControlRemoteDetails = SubagentRemoteErrorDetailsMap & RemoteErrorDetailsMap;

/** Mọi mã lỗi Remote mà module này dựng được. */
type ControlRemoteCode = keyof ControlRemoteDetails;

/** Kiểu hàm dựng `RemoteError` đã buộc mã lỗi với đúng hình dạng chi tiết của nó. */
type ControlRemoteErrorConstructor = new <Code extends ControlRemoteCode>(
  code: Code,
  message: string,
  details: ControlRemoteDetails[Code],
  options?: ErrorOptions,
) => Error;

/**
 * Lớp `RemoteError` của kernel nhìn qua seam CẤU TRÚC: ép kiểu tại ĐÚNG MỘT chỗ này để mọi chỗ ném giữ
 * nguyên văn `new RemoteError(mã, thông điệp, chi tiết, { cause })` như bản gốc, mà vẫn được tsc kiểm
 * cặp mã/chi tiết. Runtime không đổi — vẫn là lớp Error thật của `@deepseek-ai/dsh-typert-protocol`.
 */
const RemoteError = ProtocolRemoteError as unknown as ControlRemoteErrorConstructor;

/**
 * Áp các phép kiểm payload subagent chặt hơn codec chuỗi-đóng-dấu do typert sinh ra.
 * Nhận: method — tên phương thức mang trong thông điệp lỗi; payload — các trường điều khiển đã giải mã
 *        cần kiểm.
 * Trả: không khi payload hợp lệ; ném lỗi khi không hợp lệ.
 * @throws {RemoteError} `gateway/bad-request` kèm nguyên văn các issue của Zod.
 */
export function validateControlRequest(method: keyof typeof CONTROL_ID_SCHEMAS, payload: unknown): void {
  const parsed = CONTROL_ID_SCHEMAS[method].safeParse(payload);
  if (!parsed.success) {
    throw new RemoteError('gateway/bad-request', `invalid payload for ${method}`, { issues: parsed.error.issues });
  }
}

/**
 * Từ chối MỘT prompt tiếp nối mà không lộ chi tiết provider: lỗi nhận vào mà bên gọi xử lý được thì giữ
 * mã riêng, mọi thứ khác là lỗi nội bộ.
 * Nhận: error — giá trị đã ném; childSessionId — con được nhắm tới; signal — tín hiệu huỷ của bên gọi.
 * Trả: không bao giờ — việc từ chối được ném ra.
 * @throws {RemoteError} luôn luôn.
 */
export function rejectPrompt(error: unknown, childSessionId: SessionId, signal: AbortSignal): never {
  if (isCancellation(error, signal)) {
    throw new RemoteError('gateway/cancelled', 'subagent prompt was cancelled', {}, { cause: error });
  }
  if (error instanceof AttachmentError) {
    throw new RemoteError('subagent/attachment-invalid', error.message, { reason: error.code }, { cause: error });
  }
  if (error instanceof SubagentError) {
    switch (error.code) {
      case 'MODEL_DOES_NOT_SUPPORT_IMAGES':
        throw new RemoteError('subagent/attachment-invalid', error.message, { reason: error.code }, { cause: error });
      case 'NOT_RESUMABLE':
        throw new RemoteError('subagent/not-resumable', 'subagent cannot be resumed', { childSessionId }, { cause: error });
      case 'UNAUTHORIZED':
        throw new RemoteError('subagent/unauthorized', 'subagent does not belong to this parent', { childSessionId }, { cause: error });
      case 'DRAINING':
      case 'ACTIVATION_CLOSING':
      case 'ACTIVATION_LIMIT_REACHED':
      case 'CONTINUATION_UNAVAILABLE':
      case 'PERSISTENCE_UNAVAILABLE':
        throw new RemoteError('subagent/delivery-unavailable', 'subagent follow-up is temporarily unavailable', { childSessionId }, { cause: error });
      // Mã nằm ngoài từ vựng nhận vào thì không phải việc bên gọi tự quyết.
      default:
        break;
    }
  }
  throw new RemoteError('gateway/internal', 'subagent prompt failed', {}, { cause: error });
}

/**
 * Cho biết lần hỏng có phải do huỷ hay không.
 * Nhận: error — giá trị đã ném; signal — tín hiệu huỷ của bên gọi.
 * Trả: `true` khi tín hiệu đã huỷ hoặc lỗi mang mã `CANCELLED`.
 */
function isCancellation(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof SubagentError && error.code === 'CANCELLED');
}
