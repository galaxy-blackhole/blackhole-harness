/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ban ghi dieu huong luu trong trinh duyet — doc lap voi trang thai khung dang song
 */

import type { BrowserAddressFailure, BrowserTarget } from "./url.ts";

/** Mot dia chi duoc giu lai. */
export type BrowserHistoryEntry = BrowserTarget;

/** Kha nang quan sat duoc ghi cho mot lan dieu huong co kiem soat. */
export type BrowserNavigationStatus =
  | { readonly status: "empty" }
  | { readonly status: "loading"; readonly revision: number }
  | { readonly status: "known"; readonly revision: number }
  | { readonly status: "unknown"; readonly revision: number };

/** Dia chi bi tu choi, mang theo ban ghi cuc bo cua trinh duyet. */
export type BrowserFailure = { readonly kind: "address"; readonly reason: BrowserAddressFailure };

/** Ban ghi tuan tu hoa; moi nha cung cap giu lich su ma no khoi phuc duoc. */
export interface BrowserTabState {
  /** Cac dia chi da biet. */
  readonly entries: readonly BrowserHistoryEntry[];
  /** Chi so dia chi dang chon; -1 nghia la chua co. */
  readonly index: number;
  /** Yeu cau tai dang chay. */
  readonly request: { readonly revision: number; readonly target: BrowserTarget } | undefined;
  /** Trang thai quan sat cua lan tai. */
  readonly navigation: BrowserNavigationStatus;
  /** Tu choi dia chi gan nhat. */
  readonly failure: BrowserFailure | undefined;
}

/**
 * Doc dia chi dang chon tu mot ban ghi dieu huong da luu.
 * Nhan: state — ban ghi dieu huong da luu (co the vang mat).
 * Tra: dia chi duoc chon sau cung, hoac undefined.
 */
export function currentBrowserTarget(state: BrowserTabState | undefined): BrowserTarget | undefined {
  return state === undefined || state.index < 0 ? undefined : state.entries[state.index];
}

/**
 * Ghi checkpoint mot dia chi da quan sat ma khong tuan tu hoa lich su native.
 * Nhan: target — dia chi hien tai; revision — the he dieu huong.
 * Tra: checkpoint chi chua dia chi.
 */
export function browserAddressCheckpoint(target: BrowserTarget, revision: number): BrowserTabState {
  return {
    entries: [target],
    index: 0,
    request: { target, revision },
    navigation: { status: "known", revision },
    failure: undefined,
  };
}
