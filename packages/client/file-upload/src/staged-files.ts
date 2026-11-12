/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sổ biên nhận staged của row file-upload: stage · resolve · bindPrompt · retire · forget,
 *      khoá theo DANH TÍNH phiên (WeakMap) đúng như bản gốc, kèm guard khôi phục khi prompt không gửi được.
 */

import type { RemoteError } from "@deepseek-ai/dsh-typert-protocol";

import { remoteFailure } from "./remote-failure.ts";
import type { FileAttachmentRef, FileUploadReceiptId, PromptFileBinding, StagedUpload } from "./types.ts";

/**
 * Lỗi nghiệp vụ khi một biên nhận được tham chiếu nhưng CHƯA staged cho phiên đó.
 * Nguyên văn bản gốc: mã 'session/attachment-invalid', lý do 'FILE_NOT_STAGED'.
 * @returns thực thể RemoteError dùng được xuyên realm (nhận diện bằng isDSHRemoteError).
 */
export function fileNotStaged(): RemoteError {
  return remoteFailure("session/attachment-invalid", "File was not uploaded for this session.", { reason: "FILE_NOT_STAGED" });
}

/**
 * Guard gắn biên nhận: CHỈ khôi phục khi prompt KHÔNG được gửi thành công.
 * Bản gốc có commit() để đánh dấu đã gửi; dispose chỉ rollback khi CHƯA commit — thiếu commit() là port sai.
 */
export class PromptFileBindingGuard implements PromptFileBinding {
  /** Đã chốt (commit hoặc đã rollback) hay chưa. */
  private settled = false;

  /**
   * Giữ hàm khôi phục để gọi khi huỷ mà chưa commit.
   * @param rollback - hàm khôi phục trạng thái gắn biên nhận cũ.
   */
  constructor(private readonly rollback: () => void) {}

  /** Đánh dấu prompt ĐÃ gửi thành công (biên nhận ở lại). Nhận: không. Trả: không. */
  commit(): void {
    this.settled = true;
  }

  /** Khôi phục nếu CHƯA commit; gọi nhiều lần chỉ chạy một lần. Nhận: không. Trả: không. */
  [Symbol.dispose](): void {
    if (this.settled) return;
    this.settled = true;
    this.rollback();
  }
}

/**
 * Sổ biên nhận staged, khoá theo DANH TÍNH phiên (WeakMap) — đúng như bản gốc.
 * Vì khoá là đối tượng phiên, hai phiên cùng id nhưng khác đối tượng KHÔNG dùng chung sổ.
 */
export class StagedFiles {
  /** Biên nhận theo từng phiên; khoá biến mất cùng đối tượng phiên (WeakMap). */
  private readonly bySession = new WeakMap<object, Map<string, StagedUpload>>();

  /**
   * Ghi một biên nhận vừa staged.
   * @param session - đối tượng phiên sở hữu.
   * @param receiptId - id biên nhận do Host cấp.
   * @param file - tham chiếu tệp bền vững.
   * @returns không.
   */
  stage(session: object, receiptId: string, file: FileAttachmentRef): void {
    const receipts = this.bySession.get(session) ?? new Map<string, StagedUpload>();
    receipts.set(receiptId, { file });
    this.bySession.set(session, receipts);
  }

  /**
   * Tra tham chiếu tệp của một biên nhận đã staged.
   * @param session - đối tượng phiên sở hữu.
   * @param receiptId - id biên nhận.
   * @returns tham chiếu tệp, hoặc undefined khi biên nhận lạ/không thuộc phiên.
   */
  resolve(session: object, receiptId: string): FileAttachmentRef | undefined {
    return this.bySession.get(session)?.get(receiptId)?.file;
  }

  /**
   * Gắn biên nhận vào một prompt đang vào hộp thư Agent.
   * @param session - đối tượng phiên sở hữu.
   * @param receiptIds - các id biên nhận (phân biệt) mà prompt tham chiếu.
   * @param requestId - id prompt sẽ quan sát thấy trong hàng đợi/lịch sử.
   * @returns guard khôi phục trạng thái cũ khi prompt không gửi được.
   * @throws RemoteError 'session/attachment-invalid' (FILE_NOT_STAGED) khi có biên nhận chưa staged.
   */
  bindPrompt(session: object, receiptIds: readonly FileUploadReceiptId[], requestId: string): PromptFileBindingGuard {
    const receipts = this.bySession.get(session);
    const bound = receiptIds.map((receiptId) => {
      const upload = receipts?.get(receiptId);
      if (upload === undefined) throw fileNotStaged();
      return { upload, previous: upload.requestId };
    });
    for (const { upload } of bound) upload.requestId = requestId;
    return new PromptFileBindingGuard(() => {
      for (const { upload, previous } of bound) {
        if (previous === undefined) delete upload.requestId;
        else upload.requestId = previous;
      }
    });
  }

  /**
   * Gỡ mọi biên nhận đã được một prompt nhận (prompt rời hàng đợi hoặc đã vào lịch sử).
   * @param session - đối tượng phiên sở hữu.
   * @param requestId - id prompt.
   * @returns số biên nhận đã gỡ (chỉ để test đo; service bỏ qua giá trị này).
   */
  retire(session: object, requestId: string): number {
    const receipts = this.bySession.get(session);
    if (receipts === undefined) return 0;
    let removed = 0;
    for (const [receiptId, upload] of receipts) {
      if (upload.requestId !== requestId) continue;
      receipts.delete(receiptId);
      removed += 1;
    }
    if (receipts.size === 0) this.bySession.delete(session);
    return removed;
  }

  /**
   * Xoá toàn bộ biên nhận của một phiên (phiên bị dọn).
   * @param session - đối tượng phiên sở hữu.
   * @returns không.
   */
  forget(session: object): void {
    this.bySession.delete(session);
  }
}
