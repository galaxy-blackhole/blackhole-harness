/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hop dong kieu dung chung cua row ui-settings-account: trang thai tai khoan, kho observable, seam cua context va bo cong cu render
 */

import type { Translator } from "./types.ts";

export type { Translator };

/** Mot lan doc bat dong bo cua Host: thanh cong kem gia tri, hoac that bai. */
export type ReadResult<T> = { readonly status: "ready"; readonly value: T } | { readonly status: "failed" };

/** Mot vi tien trong so du tai khoan — nguyen van hinh dang cua Host. */
export interface Wallet {
  /** Ma tien te (CNY hoac USD). */
  readonly currency: string;
  /** Chuoi so thap phan da duoc Host kiem. */
  readonly balance: string;
}

/**
 * Ket qua doc so du — nguyen van hinh dang cua Host: value la vi nap tien, bonusWallets la vi thuong.
 * ⚠️ Day KHONG phai ReadResult<Wallet[]>: khi thanh cong thi ca hai truong cung nam ngang hang.
 */
export interface BalanceValue {
  /** Trang thai lan doc. */
  readonly status: string;
  /** Vi nap tien (chi co khi thanh cong). */
  readonly value?: readonly Wallet[];
  /** Vi thuong (chi co khi thanh cong). */
  readonly bonusWallets?: readonly Wallet[];
}

/** Ho so tai khoan da dang nhap — nguyen van hinh dang cua Host. */
export interface ProfileValue {
  /** Ma nguoi dung. */
  readonly id: string;
  /** Ten hien thi, co the vang. */
  readonly name?: string;
  /** Thong tin lien he (email), co the vang. */
  readonly contact?: string;
  /** Dia chi anh dai dien, co the vang. */
  readonly avatarUrl?: string;
}

/** Mot lan dang nhap dang chay — nguyen van hinh dang cua Host. */
export interface AccountAttempt {
  /** Id cua lan dang nhap. */
  readonly id: string;
  /** Pha: initializing · waiting-browser · exchanging · committing · succeeded · failed · expired · cancelled. */
  readonly phase: string;
  /** Dia chi uy quyen khi da co. */
  readonly authorizeUrl?: string;
  /** Ma loi Host tra ve khi that bai. */
  readonly errorCode?: string;
}

/** Trang thai phien tai khoan — nguyen van hinh dang cua Host. */
export interface AccountView {
  /** "credential-stored" khi da dang nhap. */
  readonly status: string;
  /** Lan dang nhap dang chay, neu co. */
  readonly attempt?: AccountAttempt | null;
  /** Hai dia chi Platform cua tai khoan. */
  readonly links: { readonly usageUrl: string; readonly topUpUrl: string };
}

/** Chi tiet tai khoan doc theo yeu cau. */
export interface AccountDetails {
  /** Ho so. */
  readonly profile?: ReadResult<ProfileValue>;
  /** So du. */
  readonly balance?: BalanceValue;
}

/** Anh dai dien dung chung giua thanh ben va Settings. */
export interface AvatarSnapshot {
  /** Dia chi anh. */
  readonly url: string;
  /** loading · ready · failed. */
  readonly status: string;
}

/** Thong bao thuong dang hien. */
export interface BonusNotice {
  /** Ma don. */
  readonly orderId: string;
  /** Loi nhan cua Host. */
  readonly message: string;
  /** Thoi diem het han (ISO). */
  readonly expiresAt: string;
}

/** Anh chup trang thai tai khoan ma moi be mat doc chung. */
export interface AccountSnapshot {
  /** Phien hien tai. */
  readonly view?: AccountView;
  /** Chi tiet doc theo yeu cau. */
  readonly details?: AccountDetails;
  /** Anh dai dien. */
  readonly avatar?: AvatarSnapshot;
  /** Thong bao thuong dang hien. */
  readonly notice?: BonusNotice;
  /** Stream trang thai da dut. */
  readonly failed: boolean;
  /** Hop thoai dang nhap dang mo. */
  readonly loginVisible: boolean;
  /** Lan dang nhap truoc da that bai. */
  readonly loginFailed?: boolean;
  /** Lop phu gioi thieu Desktop dang hien. */
  readonly desktopOnboardingVisible: boolean;
  /** Buoc credential cua Models dang chiem man hinh. */
  readonly onboarding?: boolean;
}

/** Kho observable day du — HOP DONG bat buoc khi cap cho slot cua goi khac. */
export interface ObservableStore<T> {
  /** Doc gia tri hien tai. */
  getSnapshot(): T;
  /** Nghe thay doi; tra ham huy. */
  subscribe(listener: () => void): () => void;
}

/** Hook tai khoan ma renderer dung tu kho cua ta. */
export type AccountHook = <T>(select: (snapshot: AccountSnapshot) => T) => T;

/** Hook giao dien ma renderer dung tu seam theme cua context. */
export type ThemeHook = <T>(select: (snapshot: ThemeSnapshot) => T) => T;

/** Anh chup giao dien — phan row nay dung. */
export interface ThemeSnapshot {
  /** Bang mau dang hoat dong. */
  readonly active: { readonly colorScheme: string };
}

/** Cau noi trang Platform native (WebContentsView) do vo Desktop tiem. */
export interface PlatformBridge {
  /** Mo trang va tra ve khi da mo xong. */
  open(page: string, bounds: { x: number; y: number; width: number; height: number }): Promise<void>;
  /** Doi kich thuoc khung nhin. */
  setBounds(bounds: { x: number; y: number; width: number; height: number }): Promise<void>;
  /** Dong trang. */
  close(): Promise<void>;
}

/** Yeu cau mo mot trang Platform. */
export interface PlatformPageClaim {
  /** Ten trang: usage · top-up. */
  readonly page: string;
}

/** Kenh yeu cau trang Platform dung chung cho ca tai khoan — DAY DU getSnapshot/subscribe/open/close/dispose. */
export interface PlatformPages extends ObservableStore<PlatformPageClaim | null> {
  /** Mo trang va tra ham nha; trang truoc do bi bao "superseded". */
  open(page: string, onClose: (reason: string) => void): () => void;
  /** Dong trang dang mo va bao "returned" cho nguoi mo. */
  close(): void;
  /** Dong trang ma khong bao ai (luc go plugin). */
  dispose(): void;
}

/** Thong bao het han muc ma chu slot dua xuong nguoi ngoi. */
export interface MatchedQuotaNotice {
  /** Dong thong bao. */
  readonly dismiss: () => void;
  /** Giu thong bao lai trong luc mo trang Platform; tra ham nha. */
  readonly keepOpen: () => () => void;
  /** Loi nhan cua thong bao. */
  readonly message: unknown;
}

/** Nghi vu tai khoan ma row nay tiem cho nam slot — nguyen van ten truong cua ban goc. */
export interface AccountOperations {
  /** Bao anh dai dien tai len that bai. */
  avatarFailed(snapshot: AvatarSnapshot): void;
  /** Nghe su kien phien het han; tra ham huy. */
  subscribeSessionExpired(listener: () => void): () => void;
  /** Nghe su kien model doi dang nhap; tra ham huy. */
  subscribeModelSignInRequired(listener: () => void): () => void;
  /** Mo trang Platform (chi co khi vo Desktop tiem dshPlatform). */
  openPlatformPage?(page: string, onClose: (reason: string) => void): () => void;
  /** Doc lai tai khoan va thong bao thuong. */
  refreshAccount(): Promise<void>;
  /** Mo bang hoi khach hang kem thong tin thiet bi. */
  contactUs(): void;
  /** Bat/tat hop thoai dang nhap. */
  showLogin(visible: boolean): void;
  /** Bat/tat co "buoc credential cua Models dang chiem man hinh". */
  setOnboarding(active: boolean): void;
  /** Bao mot thong bao thuong da duoc hien. */
  bonusNoticeShown(orderId: string): void;
  /** Bao mot thong bao thuong bi dong. */
  bonusNoticeDismissed(orderId: string): void;
  /** Kho observable tiem cho slot khac — HOP DONG day du. */
  readonly hooks: {
    /** Kho tai khoan. */
    readonly account: ObservableStore<AccountSnapshot>;
    /** Kho giao dien (chi doc). */
    readonly theme: ObservableStore<ThemeSnapshot>;
  };
  /** Bat dau mot lan dang nhap. */
  start(): Promise<void>;
  /** Huy mot lan dang nhap theo id. */
  cancel(id: string): Promise<void>;
  /** Co tac vu tai khoan nao dang chay khong ("unknown" khi khong doc duoc). */
  hasRunningAccountTasks(): Promise<boolean | "unknown">;
  /** Dang xuat. */
  signOut(): Promise<void>;
}

/** Tuy chon bang hoi khach hang — nguyen van mac dinh cua ban goc. */
export interface ContactConfig {
  /** Dia chi bang hoi. */
  readonly contactFormUrl: string;
  /** Nhan nguon. */
  readonly contactSource: string;
  /** Do tre thu lai xac nhan thuong (ms). */
  readonly bonusAckRetryDelayMs: number;
  /** Tran do tre thu lai xac nhan thuong (ms). */
  readonly bonusAckRetryMaxDelayMs: number;
}
