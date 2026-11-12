/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Store bang tom tat file da doi cua mot luot — nguyen van ban goc cua DSH
 */

import { changesSummaryUrl, isChangesSummary, type ChangesSummary } from "./changes.ts";
import { HostReadStore } from "./host-read-store.ts";

/** Trang thai cua mot bang tom tat: dang doc, khong con, hoac du lieu. */
export type ChangesSummaryState = "loading" | "missing" | ChangesSummary;

/** Store doc bang tom tat file da doi; moi toa do doc mot lan. */
export class ChangesSummaryStore extends HostReadStore<ChangesSummaryState> {
  /** Dung store voi chinh sach: doc mot lan, khong bao gio thu lai. */
  constructor() {
    super({
      loading: "loading",
      failed: "missing",
      retryable: () => false,
      decode: async (response) => {
        if (!response.ok) return "missing";
        const value: unknown = await response.json();
        return isChangesSummary(value) ? value : "missing";
      },
    });
  }

  /**
   * Doc mot bang tom tat mot lan; lan doc sau cung toa do tra ve trang thai da nho.
   * Nhan: sessionId — phien dang xem; seq — so thu tu su kien thong bao.
   * Tra: sau khi trang thai duoc cong bo.
   */
  load(sessionId: string, seq: number): Promise<void> {
    return this.loadUrl(changesSummaryUrl(sessionId, seq));
  }
}
