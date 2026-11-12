/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bo dem doc-mot-lan cho cac ban ghi do Host phuc vu — nguyen van ban goc cua DSH
 */

import { runtime, type Any } from "./runtime.ts";

/** Chinh sach doc cua mot loai ban ghi: trang thai cho, trang thai hong, cach thu lai va cach giai ma. */
export interface HostReadPolicy<S> {
  /** Trang thai trong luc dang doc. */
  loading: S;
  /** Trang thai khi lan doc that bai. */
  failed: S;
  /** Mot trang thai da co co nen doc lai khong. */
  retryable: (state: S) => boolean;
  /** Giai ma phan hoi thanh trang thai. */
  decode: (response: Response) => Promise<S>;
}

/**
 * Bo dem doc-mot-lan cho cac ban ghi do Host phuc vu, khoa theo URL co xac thuc:
 * mot lan doc cho moi URL khi trang thai con dung, xoa khi ket noi bi thay,
 * huy khi bi thao. Moi store tu quyet dinh phan hoi nghia la gi va trang thai nao
 * thi lan yeu cau sau doc lai.
 */
export class HostReadStore<S> {
  /** Chinh sach doc cua loai ban ghi nay. */
  private readonly policy: HostReadPolicy<S>;
  /** URL ban ghi la khoa trang thai xuyen phien va xuyen luot. */
  readonly state: Any;
  /** Vong doi cua ca store: bi huy khi plugin bi thao. */
  private lifetime = new AbortController();
  /** The he ket noi ma cac trang thai hien tai thuoc ve; reset huy no de khong lan doc cu nao cong bo. */
  private generation = new AbortController();
  /** Cac lan doc dang chay. */
  private readonly pending = new Set<Promise<void>>();

  /**
   * Dung store voi chinh sach doc cho truoc.
   * Nhan: policy — chinh sach doc cua loai ban ghi.
   * Tra: doi tuong store.
   */
  constructor(policy: HostReadPolicy<S>) {
    this.policy = policy;
    this.state = runtime().store.createSnapshotStore({}) as Any;
  }

  /**
   * Doc mot URL tru khi mot trang thai ma chinh sach giu da co san cho no.
   * Nhan: url — URL co xac thuc cua ban ghi.
   * Tra: sau khi trang thai duoc cong bo.
   */
  async loadUrl(url: string): Promise<void> {
    const current = (this.state.getSnapshot() as Record<string, S | undefined>)[url];
    if (this.lifetime.signal.aborted || (current !== undefined && !this.policy.retryable(current))) return;
    this.state.update((state: Record<string, S>) => {
      state[url] = this.policy.loading;
    });
    const task = this.read(url, AbortSignal.any([this.lifetime.signal, this.generation.signal]));
    this.pending.add(task);
    try {
      await task;
    } finally {
      this.pending.delete(task);
    }
  }

  /** Quen moi trang thai va bo cac lan doc dang chay; mot ket noi bi thay co the cham toi Host khong con phuc vu chung. */
  reset(): void {
    this.generation.abort();
    this.generation = new AbortController();
    this.state.set({});
  }

  /**
   * Huy cac lan doc con treo va cho toi khi khong lan nao con cong bo duoc trang thai.
   * Nhan: khong co.
   * Tra: sau khi moi lan doc ket thuc.
   */
  async dispose(): Promise<void> {
    this.lifetime.abort();
    await Promise.all(this.pending);
  }

  /**
   * Doc mot URL roi cong bo trang thai (hoac trang thai hong).
   * Nhan: url — URL ban ghi; signal — tin hieu huy gop cua vong doi va the he.
   * Tra: sau khi cong bo.
   */
  private async read(url: string, signal: AbortSignal): Promise<void> {
    let next: S;
    try {
      next = await this.policy.decode(await fetch(url, { signal }));
    } catch {
      next = this.policy.failed;
    }
    if (!signal.aborted) {
      this.state.update((state: Record<string, S>) => {
        state[url] = next;
      });
    }
  }
}
