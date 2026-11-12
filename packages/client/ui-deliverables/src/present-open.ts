/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bo dieu khien mo file ban giao va file da doi tren desktop cua Host — nguyen van ban goc cua DSH
 */

import { changedFileUrl } from "./changes.ts";
import { PRESENT_HOST_ROUTE, isPresentedHost, presentedFileUrl, type PresentedHost } from "./presented.ts";
import { runtime, type Any } from "./runtime.ts";

/** Phan hoi thanh cong duoc giu hien hoan toan trong nam giay truoc khi mo dan. */
export const PRESENTED_SUCCESS_HOLD_MS = 5_000;

/** Trang thai cua mot lan mo: dang mo, dang hien, hoac loi. */
export type PresentPhase =
  | "opening" | "revealing" | "opened" | "revealed"
  | "error" | "revealError" | "nativeUnavailable" | "directoryError";

/** Ket qua tra ve cho nguoi goi sau khi cong bo trang thai len the. */
export type PresentFailure = "openError" | "revealError";

/** Mot browser plugin: cac yeu cau mo file, bi huy khi plugin do bi thao. */
export class PresentedOpenController {
  /** URL hanh dong file la khoa trang thai xuyen phien, xuyen luot va ca hai be mat bam duoc. */
  readonly state: Any;
  /** Thong tin desktop dich den, hoac mot lan doc hong co the thu lai. */
  readonly host: Any;
  /** Hen gio xoa trang thai thanh cong sau khi mo dan. */
  private readonly expiry = new Map<string, ReturnType<typeof setTimeout>>();
  /** Lan doc thong tin desktop dang chay, neu co. */
  private loading: Promise<void> | undefined;
  /** Huy lan doc thong tin desktop khi ket noi bi thay. */
  private metadata = new AbortController();
  /** Vong doi cua ca bo dieu khien. */
  private readonly lifetime = new AbortController();
  /** Cac yeu cau dang chay. */
  private readonly pending = new Set<Promise<unknown>>();

  /** Dung bo dieu khien voi hai store rong (trang thai mo va thong tin desktop). */
  constructor() {
    const store = runtime().store;
    this.state = store.createSnapshotStore({}) as Any;
    this.host = store.createSnapshotStore(null) as Any;
  }

  /**
   * Mo mot file da khai bao mot lan trong khi mot yeu cau cung toa do con treo.
   * Lan hong van hien tren the va cu chi sau se thu lai.
   * Nhan: sessionId — phien dang xem (ke ca ban fork); seq — so thu tu su kien ban giao; index — chi so goc trong su kien;
   *        action — mo bang ung dung mac dinh hay hien trong trinh quan ly tep; application — ma trinh xu ly nguoi dung chon.
   * Tra: null sau khi ban giao thanh cong, hoac loi can thong bao sau khi cong bo trang thai len the.
   */
  open(sessionId: string, seq: number, index: number, action: "open" | "reveal" = "open", application?: string): Promise<PresentFailure | null> {
    return this.openUrl(presentedFileUrl(sessionId, seq, index), action, application);
  }

  /**
   * Mo mot file da doi da ghi nhan bang ung dung mac dinh cua Host.
   * Nhan: sessionId — phien dang xem; seq — so thu tu su kien workspace/changes; index — chi so goc trong su kien;
   *        action — mo bang ung dung hay hien trong trinh quan ly tep; application — ma trinh xu ly nguoi dung chon.
   * Tra: null sau khi ban giao thanh cong, hoac loi can thong bao.
   */
  openChanged(sessionId: string, seq: number, index: number, action: "open" | "reveal" = "open", application?: string): Promise<PresentFailure | null> {
    return this.openUrl(changedFileUrl(sessionId, seq, index), action, application);
  }

  /**
   * Gui mot yeu cau mo toi URL da dung san.
   * Nhan: url — URL hanh dong; action — mo hay hien; application — ma trinh xu ly tuy chon.
   * Tra: null khi thanh cong, hoac loi can thong bao.
   */
  private async openUrl(url: string, action: "open" | "reveal", application?: string): Promise<PresentFailure | null> {
    const phase = (this.state.getSnapshot() as Record<string, PresentPhase | undefined>)[url];
    if (this.lifetime.signal.aborted || phase === "opening" || phase === "revealing") return null;
    this.clearExpiry(url);
    this.state.update((state: Record<string, PresentPhase>) => {
      state[url] = action === "open" ? "opening" : "revealing";
    });
    const task = this.request(url, action, application);
    this.pending.add(task);
    try {
      return await task;
    } finally {
      this.pending.delete(task);
    }
  }

  /**
   * Doc thong tin desktop cua Host, gop cac lan doc trung nhau; lan goi sau thu lai khi truoc do hong.
   * Nhan: khong co.
   * Tra: sau khi thong tin hoac mot loi co the thu lai duoc cong bo.
   */
  async loadHost(): Promise<void> {
    if (this.lifetime.signal.aborted) return;
    if (this.loading !== undefined) return this.loading;
    this.host.set(null);
    const task = this.readHost(AbortSignal.any([this.lifetime.signal, this.metadata.signal]));
    this.loading = task;
    this.pending.add(task);
    try {
      await task;
    } finally {
      if (this.loading === task) this.loading = undefined;
      this.pending.delete(task);
    }
  }

  /** Vo hieu thong tin desktop khi ket noi bi thay; cac the dang dung se yeu cau Host moi. */
  resetHost(): void {
    const wasLoading = this.loading !== undefined;
    this.metadata.abort();
    this.metadata = new AbortController();
    this.loading = undefined;
    this.host.set(null);
    if (wasLoading) void this.loadHost();
  }

  /**
   * Doc thong tin desktop tu Host.
   * Nhan: signal — tin hieu huy.
   * Tra: sau khi cong bo thong tin hoac loi.
   */
  private async readHost(signal: AbortSignal): Promise<void> {
    let host: PresentedHost | "error" = "error";
    try {
      const response = await fetch(PRESENT_HOST_ROUTE, { signal });
      if (response.ok) {
        const value: unknown = await response.json();
        if (isPresentedHost(value)) host = value;
      }
    } catch {
      host = "error";
    }
    if (!signal.aborted) this.host.set(host);
  }

  /**
   * Huy cac yeu cau con treo va cho toi khi khong yeu cau nao cong bo duoc trang thai.
   * Nhan: khong co.
   * Tra: sau khi moi yeu cau ket thuc.
   */
  async dispose(): Promise<void> {
    this.lifetime.abort();
    for (const url of this.expiry.keys()) this.clearExpiry(url);
    await Promise.all(this.pending);
  }

  /**
   * Xoa hen gio cua mot URL.
   * Nhan: url — URL hanh dong.
   * Tra: khong co.
   */
  private clearExpiry(url: string): void {
    clearTimeout(this.expiry.get(url));
    this.expiry.delete(url);
  }

  /**
   * Gui yeu cau POST that su va cong bo trang thai ket qua.
   * Nhan: url — URL hanh dong; action — mo hay hien; application — ma trinh xu ly tuy chon.
   * Tra: null khi thanh cong, hoac loi can thong bao.
   */
  private async request(url: string, action: "open" | "reveal", application?: string): Promise<PresentFailure | null> {
    const failure: PresentPhase = action === "open" ? "error" : "revealError";
    let phase: PresentPhase = action === "open" ? "opened" : "revealed";
    try {
      const target = action === "reveal"
        ? url + "&action=reveal"
        : application === undefined ? url : url + "&application=" + encodeURIComponent(application);
      const response = await fetch(target, { method: "POST", signal: this.lifetime.signal });
      if (!response.ok) phase = response.status === 422 ? "nativeUnavailable" : failure;
    } catch {
      phase = failure;
    }
    if (!this.lifetime.signal.aborted) {
      if (phase === "opened" || phase === "revealed") {
        this.expiry.set(url, setTimeout(() => {
          this.expiry.delete(url);
          this.state.update((state: Record<string, PresentPhase>) => {
            Reflect.deleteProperty(state, url);
          });
        }, PRESENTED_SUCCESS_HOLD_MS + 200));
      }
      this.state.update((state: Record<string, PresentPhase>) => {
        state[url] = phase;
      });
    }
    return phase === "opened" || phase === "revealed" ? null : action === "reveal" ? "revealError" : "openError";
  }
}
