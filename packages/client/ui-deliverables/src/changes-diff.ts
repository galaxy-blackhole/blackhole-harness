/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Store so sanh mot file da doi — nguyen van ban goc cua DSH
 */

import { changesDiffUrl, isChangesDiff, type ChangesDiff } from "./changes.ts";
import { HostReadStore } from "./host-read-store.ts";

/** Trang thai cua mot lan so sanh: dang doc, khong con, hong, hoac du lieu. */
export type ChangesDiffState = "loading" | "missing" | "error" | ChangesDiff;

/** Store so sanh mot file da doi; lan doc hong thi lan sau doc lai. */
export class ChangesDiffStore extends HostReadStore<ChangesDiffState> {
  /** Dung store voi chinh sach: giu ket qua da co, chi doc lai khi lan truoc hong. */
  constructor() {
    super({
      loading: "loading",
      failed: "error",
      retryable: (state) => state === "error",
      decode: async (response) => {
        if (response.status === 404) return "missing";
        if (!response.ok) return "error";
        const value: unknown = await response.json();
        return isChangesDiff(value) ? value : "error";
      },
    });
  }

  /**
   * Doc mot lan so sanh; ket qua da co hoac khong con thi giu, lan hong thi doc lai.
   * Nhan: sessionId — phien dang xem; seq — so thu tu su kien thong bao; index — chi so file trong bang tom tat.
   * Tra: sau khi trang thai duoc cong bo.
   */
  load(sessionId: string, seq: number, index: number): Promise<void> {
    return this.loadUrl(changesDiffUrl(sessionId, seq, index));
  }
}
