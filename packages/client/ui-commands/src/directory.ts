/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cache danh muc lenh theo PHIEN: mot muc cho moi danh muc duoc phuc vu, co single-flight va chan theo epoch
 */

import { resolveCommand } from "./resolution.ts";
import type { CommandDescriptorLike } from "./types.ts";

/** Ham nap danh muc do service tiem vao (bang command.list cua ket noi goc). */
export type FetchCommands = (sessionId: string) => Promise<readonly CommandDescriptorLike[]>;

/**
 * Trang thai cua mot muc cache:
 * cold = chua keo lan nao; pending = dang keo va chua co gi phuc vu duoc;
 * ready = dang phuc vu anh chup (lan keo mem van giu trang thai nay); failed = lan keo thang cuoi bi tu choi.
 */
export type DirectoryStatus = "cold" | "pending" | "ready" | "failed";

/** Mot o cache cua mot khoa phien. */
class Entry {
  /** Trang thai hien tai. */
  state: DirectoryStatus = "cold";
  /** Anh chup danh muc dang phuc vu. */
  commands: readonly CommandDescriptorLike[] = [];
  /** Tang len moi lan bat dau keo; chi lan keo moi nhat duoc phep cong bo ket qua. */
  epoch = 0;
  /** Loi cua lan keo thang cuoi. */
  lastError: unknown;
  /** Nhung nguoi dang cho mot lan cong bo. */
  waiters: (() => void)[] = [];
}

/**
 * Cache danh muc lenh theo phien. Lop thuong — service so huu moi noi day su kien va RPC.
 */
export class CommandDirectory {
  /** Ham nap danh muc. */
  private readonly fetchCommands: FetchCommands;

  /** Bang o cache theo khoa phien. */
  private readonly entries = new Map<string, Entry>();

  /**
   * @param fetchCommands - ham nap danh muc cua mot phien.
   */
  constructor(fetchCommands: FetchCommands) {
    this.fetchCommands = fetchCommands;
  }

  /**
   * Trang thai cache hien tai cua mot phien.
   * Nhan: sessionId — khoa phien.
   * Tra: trang thai cua o (cold khi chua dung toi).
   */
  status(sessionId: string): DirectoryStatus {
    return this.entries.get(sessionId)?.state ?? "cold";
  }

  /**
   * Tra cuu dong bo tren danh muc DA SAN SANG cua mot phien; ten chinh xac truoc alias da ban dia hoa.
   * Nhan: sessionId — khoa phien; name — cach viet da go, khong co dau '/'.
   * Tra: descriptor, hoac undefined khi vang mat hay o chua san sang.
   */
  resolve(sessionId: string, name: string): CommandDescriptorLike | undefined {
    const entry = this.entries.get(sessionId);
    if (entry === undefined || entry.state !== "ready") return undefined;
    return resolveCommand(name, entry.commands);
  }

  /**
   * Lam mem moi khoa da dung (commands-changed): keo lai o hau truong; anh chup ready van phuc vu.
   * Nhan: khong co.
   * Tra: khong co.
   */
  invalidateAll(): void {
    for (const key of this.entries.keys()) void this.refresh(key);
  }

  /**
   * Bo anh chup cu (dac thu cho mot thanh phan lenh) cua mot phien va don truoc ban thay the.
   * Nhan: sessionId — phien co thanh phan lenh hieu luc doi.
   * Tra: khong co.
   */
  resetSession(sessionId: string): void {
    const entry = this.entry(sessionId);
    entry.state = "cold";
    entry.commands = [];
    entry.lastError = undefined;
    void this.refresh(sessionId);
  }

  /**
   * Dat lai cung khi ket noi lai: moi o bo anh chup (the gioi agent co the doi hinh dang) va don truoc.
   * Nhan: khong co.
   * Tra: khong co.
   */
  resetConnected(): void {
    for (const [key, entry] of this.entries) {
      entry.state = "cold";
      entry.commands = [];
      void this.refresh(key);
    }
  }

  /**
   * Don truoc kieu ban-di (hook warm cua nguon lenh khi pham vi phien sinh ra).
   * Nhan: sessionId — khoa phien.
   * Tra: khong co.
   */
  warm(sessionId: string): void {
    const entry = this.entry(sessionId);
    if (entry.state === "cold" || entry.state === "failed") void this.refresh(sessionId);
  }

  /**
   * Bat dau mot lan keo cho mot phien. Chi cong bo ready/failed khi van la lan keo moi nhat cua khoa
   * (chan theo epoch); anh chup ready khong bi ha cap trong luc lan keo dang bay.
   * Nhan: sessionId — khoa phien.
   * Tra: hoan tat khi ket qua cua lan keo nay duoc cong bo hoac bi bo.
   */
  async refresh(sessionId: string): Promise<void> {
    const entry = this.entry(sessionId);
    const epoch = (entry.epoch += 1);
    if (entry.state !== "ready") entry.state = "pending";
    try {
      const commands = await this.fetchCommands(sessionId);
      if (epoch !== entry.epoch) return;
      entry.commands = commands;
      entry.state = "ready";
      entry.lastError = undefined;
    } catch (error) {
      if (epoch !== entry.epoch) return;
      entry.commands = [];
      entry.state = "failed";
      entry.lastError = error;
    } finally {
      if (epoch === entry.epoch) notifyWaiters(entry);
    }
  }

  /**
   * Cho MANH toi khi danh muc cua mot phien phuc vu duoc (luat "phai cham toi danh muc" cua nut enter):
   * ready tra ngay; cold/failed mo mot lan keo moi; pending nhap vao lan dang bay.
   * Nhan: sessionId — khoa phien; signal — huy theo tung lan thu (SubmitAttempt).
   * Tra: anh chup lenh dang nong; nem khi lan keo duoc cho that bai hoac tin hieu bi huy.
   */
  async ensureReady(sessionId: string, signal: AbortSignal): Promise<readonly CommandDescriptorLike[]> {
    const entry = this.entry(sessionId);
    for (;;) {
      if (entry.state === "ready") return entry.commands;
      if (entry.state !== "pending") void this.refresh(sessionId);
      await settled(entry, signal);
      if (entry.state === "failed") {
        const reason = entry.lastError instanceof Error ? entry.lastError.message : String(entry.lastError);
        throw new Error("command directory warmup failed: " + reason);
      }
    }
  }

  /**
   * Lay hoac tao o cache cua mot phien.
   * Nhan: sessionId — khoa phien.
   * Tra: o cache (tao moi khi chua co).
   */
  private entry(sessionId: string): Entry {
    let entry = this.entries.get(sessionId);
    if (entry === undefined) {
      entry = new Entry();
      this.entries.set(sessionId, entry);
    }
    return entry;
  }
}

/**
 * Mot nhip chot cho mot o: xong o lan cong bo thang ke tiep, tu choi khi bi huy.
 * Nhan: entry — o dang cho; signal — tin hieu huy cua lan thu.
 * Tra: Promise xong khi co cong bo, hoac bi tu choi khi huy.
 */
function settled(entry: Entry, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise<void>((resolve, reject) => {
    const waiter = (): void => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = (): void => {
      entry.waiters = entry.waiters.filter((candidate) => candidate !== waiter);
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    entry.waiters.push(waiter);
  });
}

/**
 * Danh thuc moi nguoi dang cho mot o.
 * Nhan: entry — o vua co ket qua.
 * Tra: khong co.
 */
function notifyWaiters(entry: Entry): void {
  const woken = entry.waiters;
  entry.waiters = [];
  for (const wake of woken) wake();
}

/**
 * Chuan hoa mot lan huy thanh loi.
 * Nhan: signal — tin hieu da bi huy.
 * Tra: loi de tu choi Promise.
 */
function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("command directory wait aborted");
}
