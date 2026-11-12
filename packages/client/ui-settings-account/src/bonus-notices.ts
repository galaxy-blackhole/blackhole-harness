/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Vong doi doc, hien thi va xac nhan cua thong bao thuong
 */

import type { BonusNotice } from "./contracts.ts";

/** Pham vi cua mot vong doi da dang nhap. */
interface NoticeScope {
  /** Ma tai khoan ma lan doc gan nhat bao ve; doi khi doi tai khoan. */
  accountId?: string;
  /** Cac ma don da hien nhung chua xac nhan xong. */
  readonly pending: string[];
}

/** Nguon du lieu cua thong bao thuong. */
export interface BonusNoticeBatch {
  /** Ma tai khoan cua lo thuong nay. */
  readonly accountId: string;
  /** Thuong dang cho hien (phan tu dau la thuong moi nhat). */
  readonly bonuses: ReadonlyArray<{ readonly orderId: string; readonly message: string; readonly expiresAt: string }>;
}

/** Nguoi cong tac va thoi gian cua bo dieu khien. */
export interface BonusNoticeOptions {
  /** Do tre thu lai xac nhan (ms). */
  readonly ackRetryDelayMs: number;
  /** Tran do tre thu lai xac nhan (ms). */
  readonly ackRetryMaxDelayMs: number;
  /** Doc lo thuong moi. */
  readonly read: () => Promise<BonusNoticeBatch>;
  /** Xac nhan mot don da hien. */
  readonly acknowledge: (accountId: string, orderId: string) => Promise<boolean>;
  /** Phat thong bao ra thanh ben (null khi khong con). */
  readonly publish: (notice: BonusNotice | null) => void;
}

/** Bo dieu khien ma plugin tai khoan dieu khien tu trang thai tai khoan va Settings. */
export interface BonusNoticeController {
  /** Bat dau mot vong doi da dang nhap. */
  begin(): void;
  /** Ket thuc vong doi hien tai. */
  end(): void;
  /** Doc lai va chay not cac xac nhan dang cho. */
  refresh(): Promise<void>;
  /** Bao mot don da duoc hien. */
  shown(orderId: string): void;
  /** Bao mot don bi nguoi dung dong. */
  dismissed(orderId: string): void;
}

/**
 * Thuong con hien duoc khong.
 * @param expiresAt - moc het han cua may chu.
 * @param at - mili giay tu epoch.
 * @returns true khi thuong khong con hien duoc nua.
 */
export function expired(expiresAt: string, at: number): boolean {
  const expires = Date.parse(expiresAt);
  return !Number.isNaN(expires) && expires <= at;
}

/**
 * So huu vong doi doc, hien thi va xac nhan cua thong bao thuong.
 * @param options - nguoi cong tac va thoi gian.
 * @returns bo dieu khien ma plugin tai khoan dieu khien tu trang thai tai khoan va Settings.
 */
export function createBonusNoticeController(options: BonusNoticeOptions): BonusNoticeController {
  let scope: NoticeScope | undefined;
  let current: BonusNotice | undefined;
  let readGeneration = 0;
  let ackTimer: ReturnType<typeof setTimeout> | undefined;
  let ackInFlight = false;
  let ackDelay = options.ackRetryDelayMs;
  const reported = new Set<string>();

  /** Xoa hen gio xac nhan dang cho. */
  const clearAckTimer = (): void => {
    if (ackTimer !== undefined) {
      clearTimeout(ackTimer);
      ackTimer = undefined;
    }
  };
  /**
   * Dat thong bao dang hien, bo qua khi khong doi.
   * @param notice - thong bao moi, undefined khi khong con.
   */
  const setCurrent = (notice: BonusNotice | undefined): void => {
    if (notice === undefined && current === undefined) return;
    if (notice?.orderId === current?.orderId && notice?.message === current?.message && notice?.expiresAt === current?.expiresAt) return;
    if (notice?.orderId !== current?.orderId) reported.clear();
    current = notice;
    options.publish(notice ?? null);
  };
  /**
   * Hen chay xac nhan sau delay.
   * @param delay - so mili giay.
   */
  const scheduleAck = (delay: number): void => {
    clearAckTimer();
    ackTimer = setTimeout(() => {
      void runAcks();
    }, delay);
  };
  /** Bo cong viec xac nhan cua tai khoan hay vong doi truoc, de no khong chay sang cai sau. */
  const resetAcks = (): void => {
    clearAckTimer();
    ackInFlight = false;
    ackDelay = options.ackRetryDelayMs;
  };
  /** Chay not cac xac nhan dang cho neu co. */
  const startAcks = (): void => {
    if (scope !== undefined && scope.pending.length > 0) scheduleAck(0);
  };
  /**
   * Ap mot ket qua doc: don moi thay the the dang hien, don trung lam moi loi nhan,
   * lo rong thi de yen the nguoi dung da thay.
   * @param scopeAtRead - vong doi ma lan doc nay thuoc ve.
   * @param batch - lo thuong vua doc.
   */
  const apply = (scopeAtRead: NoticeScope, batch: BonusNoticeBatch): void => {
    if (scopeAtRead.accountId !== batch.accountId) {
      scopeAtRead.accountId = batch.accountId;
      scopeAtRead.pending.length = 0;
      resetAcks();
      setCurrent(undefined);
    }
    const candidate = batch.bonuses[0];
    if (candidate === undefined) {
      if (current !== undefined && !reported.has(current.orderId)) setCurrent(undefined);
      return;
    }
    if (candidate.orderId === current?.orderId) {
      setCurrent({ orderId: candidate.orderId, message: candidate.message, expiresAt: candidate.expiresAt });
      return;
    }
    if (expired(candidate.expiresAt, Date.now())) return;
    setCurrent({ orderId: candidate.orderId, message: candidate.message, expiresAt: candidate.expiresAt });
  };
  /**
   * Doc mot lan cho mot vong doi con song. Lan doc moi hon thay the lan dang chay:
   * ket qua cu bi bo thay vi ap dung, nen chi lan doc moi nhat bao duoc doi tai khoan.
   * @param scopeAtRead - vong doi ma lan doc nay thuoc ve.
   * @returns khi lan doc nay ket thuc.
   */
  function runRead(scopeAtRead: NoticeScope): Promise<void> {
    const generation = ++readGeneration;
    return (async () => {
      let batch: BonusNoticeBatch | null;
      try {
        batch = await options.read();
      } catch {
        batch = null;
      }
      if (scope !== scopeAtRead || generation !== readGeneration) return;
      if (batch !== null) apply(scopeAtRead, batch);
    })();
  }
  /**
   * Xac nhan tung don da hien mot. Loi giao thuc thi lui dan toi tran va thu lai trong phan con lai
   * cua vong doi da dang nhap. Cau tra loi false ket thuc don khong thu lai: phien nay khong the
   * lam may chu chap nhan no.
   */
  async function runAcks(): Promise<void> {
    const scopeAtCall = scope;
    if (scopeAtCall === undefined || ackInFlight) return;
    const accountId = scopeAtCall.accountId;
    const orderId = scopeAtCall.pending[0];
    if (accountId === undefined || orderId === undefined) return;
    ackInFlight = true;
    /** Con so huu vong doi va tai khoan ma no bat dau khong. */
    const owns = (): boolean => scope === scopeAtCall && scopeAtCall.accountId === accountId;
    let acknowledged: boolean;
    try {
      acknowledged = await options.acknowledge(accountId, orderId);
    } catch {
      if (!owns()) return;
      ackInFlight = false;
      scheduleAck(ackDelay);
      ackDelay = Math.min(ackDelay * 2, options.ackRetryMaxDelayMs);
      return;
    }
    if (!owns()) return;
    ackInFlight = false;
    if (scopeAtCall.pending[0] === orderId) scopeAtCall.pending.shift();
    ackDelay = options.ackRetryDelayMs;
    if (acknowledged && scopeAtCall.pending.length > 0) scheduleAck(0);
    else clearAckTimer();
  }
  /**
   * Xep hang mot don da hien, de mot lan xac nhan bi ngat vi loi se thu lai trong phien dang nhap nay.
   * @param orderId - ma don.
   */
  const report = (orderId: string): void => {
    const scopeAtReport = scope;
    if (scopeAtReport === undefined || current?.orderId !== orderId || reported.has(orderId)) return;
    reported.add(orderId);
    if (!scopeAtReport.pending.includes(orderId)) scopeAtReport.pending.push(orderId);
    ackDelay = options.ackRetryDelayMs;
    scheduleAck(0);
  };
  /** Ket thuc vong doi hien tai va don sach trang thai. */
  const endLifecycle = (): void => {
    if (scope === undefined) return;
    resetAcks();
    scope = undefined;
    reported.clear();
    setCurrent(undefined);
  };
  return {
    begin(): void {
      scope ??= { pending: [] };
      void runRead(scope);
    },
    end: endLifecycle,
    refresh(): Promise<void> {
      if (scope === undefined) return Promise.resolve();
      startAcks();
      return runRead(scope);
    },
    shown(orderId: string): void {
      if (current?.orderId !== orderId) return;
      if (expired(current.expiresAt, Date.now())) return;
      report(orderId);
    },
    dismissed(orderId: string): void {
      if (current?.orderId !== orderId) return;
      report(orderId);
      setCurrent(undefined);
    },
  };
}
