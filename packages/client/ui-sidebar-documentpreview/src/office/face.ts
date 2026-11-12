/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Noi viec doc Office vao action cua store, khong lo cong viec Remote ra component
 */

import type { RemoteFailureLike } from "../failure-line.ts";
import type { OfficeTabView } from "./store.ts";

/** Mot ket qua chuyen doi Office da settled. */
export type OfficeReadResult = { ok: true; value: NonNullable<OfficeTabView["file"]> } | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

/** Ham doc da duoc uy quyen, ke ca tai dung cache phia Client. */
export type OfficeRead = (file: { sessionId: string; path: string }, signal: AbortSignal) => Promise<OfficeReadResult>;

/** Hanh dong store ma mat Office goi. */
export interface OfficeActionsLike {
  /** Danh dau mot diep khuc dang nap. */
  loading(tabId: string, revision: number): void;
  /** Ghi ket qua chuyen doi da xong. */
  complete(tabId: string, revision: number, file: NonNullable<OfficeTabView["file"]>): void;
  /** Ghi mot lan chuyen doi that bai. */
  failed(tabId: string, revision: number, failure: RemoteFailureLike): void;
  /** Bo trang thai cua mot tab da dong. */
  forget(tabId: string): void;
}

/**
 * Noi viec doc Office vao action cua store.
 * Nhan: read — bo doc chuyen doi da uy quyen; describeFailure — chu mo ta loi da dich.
 * Tra: factory inject cua slot; dia chi tep cung cap quyen doc cho Phien.
 */
export function officeFace(read: OfficeRead, describeFailure: (failure: { code?: string; message: string }) => string): (sessionId: string, actions: OfficeActionsLike) => { load: (tabId: string, revision: number, file: { sessionId: string; path: string }, signal: AbortSignal, loaded: (version: number) => void, failed: () => void) => void } {
  return (_sessionId, actions) => ({
    load: (tabId, revision, file, signal, loaded, failed) => {
      if (signal.aborted) return;
      actions.loading(tabId, revision);
      void read(file, signal).then((result) => {
        if (signal.aborted) return;
        if (result.ok) {
          actions.complete(tabId, revision, result.value);
          loaded(result.value.version);
        } else {
          actions.failed(tabId, revision, { code: result.error.code, message: describeFailure(result.error) });
          failed();
        }
      }, (error: unknown) => {
        if (signal.aborted) return;
        actions.failed(tabId, revision, { code: "gateway/internal", message: describeFailure({ message: error instanceof Error ? error.message : String(error) }) });
        failed();
      });
    },
  });
}
