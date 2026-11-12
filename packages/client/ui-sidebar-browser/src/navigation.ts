/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Lich su dieu huong CO GIOI HAN ma ung dung biet, chi nha cung cap iframe dung
 */

import type { BrowserHistoryEntry, BrowserTabState } from "./persistence.ts";
import type { BrowserTarget } from "./url.ts";

/** So muc dieu huong toi da ung dung biet moi tab duoc giu. */
export const MAX_BROWSER_HISTORY = 100;

/**
 * Giu lich su URL ma ung dung biet va may trang thai quan sat cua iframe.
 * Lan tai dau tien cua mot yeu cau giu URL cua no la chuan; lan tai khac danh dau la khong biet.
 */
export class BrowserNavigation {
  /** Ban ghi dang song. */
  private value: BrowserTabState;

  /**
   * Dung doi tuong dieu huong cho mot tab.
   * Nhan: initial — trang thai da luu cua tab nay, hoac trang thai rong moi.
   */
  constructor(initial: BrowserTabState = BrowserNavigation.empty()) {
    this.value = initial;
  }

  /**
   * Tao trang thai truoc khi tab co dich dieu huong co kiem soat.
   * Nhan: khong co.
   * Tra: trang thai rong tuan tu hoa duoc.
   */
  static empty(): BrowserTabState {
    return { entries: [], index: -1, request: undefined, navigation: { status: "empty" }, failure: undefined };
  }

  /**
   * Doc muc lich su ung dung dang chon.
   * Nhan: state — trang thai tuan tu hoa cua tab.
   * Tra: dich hien tai, neu co.
   */
  static current(state: BrowserTabState | undefined): BrowserHistoryEntry | undefined {
    return state === undefined || state.index < 0 ? undefined : state.entries[state.index];
  }

  /**
   * Kiem tra carrier Web co dung duoc muc lich su ung dung lien truoc khong.
   * Nhan: state — trang thai tuan tu hoa cua tab.
   * Tra: true khi dung duoc nut lui.
   */
  static canGoBack(state: BrowserTabState): boolean {
    return state.navigation.status !== "unknown" && state.index > 0;
  }

  /**
   * Kiem tra carrier Web co dung duoc muc lich su ung dung lien sau khong.
   * Nhan: state — trang thai tuan tu hoa cua tab.
   * Tra: true khi dung duoc nut tien.
   */
  static canGoForward(state: BrowserTabState): boolean {
    return state.navigation.status !== "unknown" && state.index >= 0 && state.index < state.entries.length - 1;
  }

  /** Anh chup tuan tu hoa bat bien hien tai. */
  get snapshot(): BrowserTabState {
    return this.value;
  }

  /** Carrier Web co dung an toan duoc muc lui do ung dung so huu khong. */
  get canGoBack(): boolean {
    return BrowserNavigation.canGoBack(this.value);
  }

  /** Carrier Web co dung an toan duoc muc tien do ung dung so huu khong. */
  get canGoForward(): boolean {
    return BrowserNavigation.canGoForward(this.value);
  }

  /**
  * Them mot dich co kiem soat va bo nhanh tien cu.
  * Nhan: target — dich da chuan hoa.
  * Tra: yeu cau tai moi.
  */
  navigate(target: BrowserTarget): NonNullable<BrowserTabState["request"]> {
    const entries = [...this.value.entries.slice(0, this.value.index + 1), target];
    if (entries.length > MAX_BROWSER_HISTORY) entries.splice(0, entries.length - MAX_BROWSER_HISTORY);
    return this.request(target, { ...this.value, entries, index: entries.length - 1 });
  }

  /**
  * Chon dich ung dung biet lien truoc.
  * Nhan: khong co.
  * Tra: yeu cau tai moi, hoac undefined khi khong dung duoc.
  */
  back(): BrowserTabState["request"] {
    if (!this.canGoBack) return undefined;
    const index = this.value.index - 1;
    const target = this.value.entries[index];
    if (target === undefined) return undefined;
    return this.request(target, { ...this.value, index });
  }

  /**
  * Chon dich ung dung biet lien sau.
  * Nhan: khong co.
  * Tra: yeu cau tai moi, hoac undefined khi khong dung duoc.
  */
  forward(): BrowserTabState["request"] {
    if (!this.canGoForward) return undefined;
    const index = this.value.index + 1;
    const target = this.value.entries[index];
    if (target === undefined) return undefined;
    return this.request(target, { ...this.value, index });
  }

  /**
  * Bat dau mot lan tai nua cua dich ung dung biet sau cung.
  * Nhan: khong co.
  * Tra: yeu cau tai moi, hoac undefined truoc dich dau tien.
  */
  reload(): BrowserTabState["request"] {
    const target = BrowserNavigation.current(this.value);
    return target === undefined ? undefined : this.request(target, this.value);
  }

  /**
  * Ghi nhan mot lan tai khung cho the he da chup.
  * Nhan: revision — the he gan voi khung da ve.
  * Tra: khong co.
  */
  frameLoaded(revision: number): void {
    const navigation = this.value.navigation;
    if (navigation.status === "empty" || navigation.revision !== revision) return;
    if (navigation.status === "loading") {
      this.value = { ...this.value, navigation: { status: "known", revision } };
    } else if (navigation.status === "known") {
      this.value = { ...this.value, navigation: { status: "unknown", revision } };
    }
  }

  /**
  * Phat mot yeu cau tai moi tren mot nen trang thai.
  * Nhan: target — dich can tai; basis — trang thai lam nen.
  * Tra: yeu cau vua phat.
  */
  private request(target: BrowserTarget, basis: BrowserTabState): NonNullable<BrowserTabState["request"]> {
    const request = { revision: (this.value.request?.revision ?? 0) + 1, target };
    this.value = {
      ...basis,
      request,
      navigation: { status: "loading", revision: request.revision },
      failure: undefined,
    };
    return request;
  }
}
