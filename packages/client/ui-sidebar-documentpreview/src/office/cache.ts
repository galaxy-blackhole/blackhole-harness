/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ket qua thanh cong co gioi han; moi nguoi goi tu xac thuc lai va kiem do moi cua nguon truoc khi dung lai
 */

/** Mot ket qua PDF da chuyen doi. */
export interface OfficeRenderFile {
  /** Byte PDF. */
  data: Uint8Array;
  /** Phien ban nguon. */
  version: number;
  /** Duong dan tuyet doi cua nguon. */
  absolutePath: string;
  /** The he renderer da tao ra no. */
  generation: number;
}

/** Ket qua mot lan goi Remote. */
export type OfficeResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

/** Pham vi uy quyen doc cua mot Phien. */
export interface OfficeFileRef {
  /** Phien so huu. */
  sessionId: string;
  /** Duong dan nguon. */
  path: string;
}

/** Mot muc dang cho trong bang pending. */
interface PendingEntry {
  /** Bo huy cua lan chuyen doi dung chung. */
  controller: AbortController;
  /** Loi hua cua lan chuyen doi. */
  promise: Promise<OfficeResult<OfficeRenderFile>>;
  /** So nguoi goi dang dung muc nay. */
  users: number;
}

/** Ket qua thanh cong co gioi han; moi nguoi goi tu xac thuc lai va kiem do moi cua nguon truoc khi dung lai. */
export class OfficePreviewCache {
  /** Tra metadata nguon da uy quyen. */
  private readonly stat: (file: OfficeFileRef, signal: AbortSignal) => Promise<OfficeResult<{ absolutePath: string; version: number }>>;
  /** Chuyen doi cua Host, tra byte PDF ma nguoi goi muon chi doc. */
  private readonly convert: (file: OfficeFileRef, signal: AbortSignal, priority: string) => Promise<OfficeResult<OfficeRenderFile>>;
  /** So ket qua hoan tat duoc giu lai. */
  private readonly maxEntries: number;
  /** Tong byte PDF duoc giu lai. */
  private readonly maxBytes: number;
  /** So yeu cau chuyen doi chua settled. */
  private readonly maxPending: number;
  /** So nguoi doc, ke ca lan tra metadata. */
  private readonly maxReaders: number;
  /** The he renderer hien tai cua Host. */
  private readonly currentGeneration: (signal: AbortSignal) => Promise<OfficeResult<number>>;
  /** Loi dung luong da dich. */
  private readonly busy: () => Error;
  /** Ket qua da hoan tat, theo khoa. */
  private readonly ready = new Map<string, OfficeResult<OfficeRenderFile>>();
  /** Cac lan chuyen doi dang chay, theo khoa. */
  private readonly pending = new Map<string, PendingEntry>();
  /** Tong byte dang giu. */
  private bytes = 0;
  /** So nguoi doc dang chay. */
  private readers = 0;
  /** The he da chap nhan. */
  private generation: number | undefined;
  /** So lan hoi the he. */
  private generationQuery = 0;
  /** So lan hoi the he da chap nhan. */
  private acceptedQuery = 0;
  /** Loi bao ket qua da bi thay the. */
  private readonly superseded = new Error("superseded");
  /** Vong doi cua cache. */
  private readonly lifetime = new AbortController();
  /** Cac tac vu dang chay. */
  private readonly tasks = new Set<Promise<unknown>>();
  /** Cac lan doc dang chay. */
  private readonly reads = new Set<Promise<unknown>>();

  /**
   * Dung mot cache.
   * Nhan: stat — tra metadata nguon da uy quyen; convert — chuyen doi cua Host; maxEntries · maxBytes ·
   *       maxPending · maxReaders — cac gioi han; currentGeneration — the he renderer hien tai;
   *       busy — loi dung luong da dich.
   * Tra: instance.
   */
  constructor(
    stat: OfficePreviewCache["stat"],
    convert: OfficePreviewCache["convert"],
    maxEntries: number,
    maxBytes: number,
    maxPending: number,
    maxReaders: number,
    currentGeneration: OfficePreviewCache["currentGeneration"],
    busy: () => Error,
  ) {
    this.stat = stat;
    this.convert = convert;
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.maxPending = maxPending;
    this.maxReaders = maxReaders;
    this.currentGeneration = currentGeneration;
    this.busy = busy;
  }

  /**
   * Chia se mot lan chuyen doi ma khong de mot nguoi goi huy cong viec cua nguoi khac.
   * Nhan: file — pham vi uy quyen va duong dan nguon; signal — vong doi cua nguoi goi nay; priority — 'foreground' hoac 'background'.
   * Tra: byte PDF hien tai muon chi doc, hoac loi doc nguon da khai; huy thi nem.
   */
  async read(file: OfficeFileRef, signal: AbortSignal, priority = "foreground"): Promise<OfficeResult<OfficeRenderFile>> {
    signal.throwIfAborted();
    this.lifetime.signal.throwIfAborted();
    const readerLimit = priority === "background" ? this.maxReaders - 1 : this.maxReaders;
    if (this.readers >= readerLimit || (priority === "background" && this.maxPending === 1)) throw this.busy();
    this.readers++;
    const operation = this.lookup(file, signal, priority);
    this.reads.add(operation);
    try {
      return await operation;
    } finally {
      this.readers--;
      this.reads.delete(operation);
    }
  }

  /**
   * Thu lai mot lan khi the he renderer bi thay the giua duong.
   * Nhan: file — nguon; signal — vong doi; priority — uu tien.
   * Tra: ket qua.
   */
  private async lookup(file: OfficeFileRef, signal: AbortSignal, priority: string): Promise<OfficeResult<OfficeRenderFile>> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.lookupGeneration(file, signal, priority);
      } catch (error) {
        if (error !== this.superseded) throw error;
      }
    }
    throw this.busy();
  }

  /**
   * Tra ket qua trong MOT the he cu the, tai dung ket qua da giu khi con dung.
   * Nhan: file — nguon; signal — vong doi; priority — uu tien.
   * Tra: ket qua.
   */
  private async lookupGeneration(file: OfficeFileRef, signal: AbortSignal, priority: string): Promise<OfficeResult<OfficeRenderFile>> {
    const combined = AbortSignal.any([signal, this.lifetime.signal]);
    combined.throwIfAborted();
    const query = ++this.generationQuery;
    const generation = await this.currentGeneration(combined);
    combined.throwIfAborted();
    if (!generation.ok) return generation;
    if (query < this.acceptedQuery && generation.value !== this.generation) throw this.superseded;
    this.acceptedQuery = Math.max(query, this.acceptedQuery);
    if (generation.value !== this.generation) {
      this.generation = generation.value;
      this.ready.clear();
      this.bytes = 0;
      for (const pending of this.pending.values()) pending.controller.abort(this.superseded);
      this.pending.clear();
    }
    const metadata = await this.stat(file, combined);
    combined.throwIfAborted();
    if (!metadata.ok) return metadata;
    if (generation.value !== this.generation) throw this.superseded;
    const key = JSON.stringify([generation.value, file.sessionId, metadata.value.absolutePath, metadata.value.version]);
    const cached = this.ready.get(key);
    if (cached !== undefined) {
      this.ready.delete(key);
      this.ready.set(key, cached);
      return cached;
    }
    const pendingKey = JSON.stringify([key, priority]);
    let entry = this.pending.get(pendingKey);
    if (entry === undefined) {
      const pendingLimit = priority === "background" ? this.maxPending - 1 : this.maxPending;
      if (this.tasks.size >= pendingLimit) throw this.busy();
      const controller = new AbortController();
      const promise: Promise<OfficeResult<OfficeRenderFile>> = Promise.resolve()
        .then(() => {
          controller.signal.throwIfAborted();
          return this.convert(file, controller.signal, priority);
        })
        .then((result) => {
          controller.signal.throwIfAborted();
          if (generation.value === this.generation && result.ok && result.value.generation === generation.value && result.value.version === metadata.value.version && result.value.absolutePath === metadata.value.absolutePath) this.retain(key, result);
          return result;
        })
        .finally(() => {
          this.tasks.delete(promise);
          if (this.pending.get(pendingKey)?.controller === controller) this.pending.delete(pendingKey);
        });
      this.tasks.add(promise);
      entry = { controller, promise, users: 0 };
      this.pending.set(pendingKey, entry);
    }
    const shared = entry;
    shared.users += 1;
    return new Promise<OfficeResult<OfficeRenderFile>>((resolve, reject) => {
      let settled = false;
      const finish = (): boolean => {
        if (settled) return false;
        settled = true;
        combined.removeEventListener("abort", abort);
        shared.users -= 1;
        if (shared.users === 0 && this.pending.get(pendingKey) === shared) {
          this.pending.delete(pendingKey);
          shared.controller.abort();
        }
        return true;
      };
      const abort = (): void => {
        const reason = combined.reason;
        finish();
        reject(reason instanceof Error ? reason : new Error("Office preview cancelled", { cause: reason }));
      };
      combined.addEventListener("abort", abort, { once: true });
      void shared.promise.then((result) => { if (finish()) resolve(result); }, (error: unknown) => {
        if (finish()) reject(error instanceof Error ? error : new Error("Office preview failed", { cause: error }));
      });
    });
  }

  /**
   * Xoa byte da giu, huy cac lan chuyen doi dang chay va cho chung ket thuc.
   * Nhan: khong.
   * Tra: khong.
   */
  async dispose(): Promise<void> {
    this.lifetime.abort();
    this.pending.clear();
    this.ready.clear();
    this.bytes = 0;
    await Promise.allSettled([...this.reads, ...this.tasks]);
  }

  /**
   * Giu lai mot ket qua thanh cong trong gioi han.
   * Nhan: key — khoa cua muc; result — ket qua.
   * Tra: khong.
   */
  private retain(key: string, result: OfficeResult<OfficeRenderFile>): void {
    const previous = this.ready.get(key);
    if (previous !== undefined && previous.ok) {
      this.ready.delete(key);
      this.bytes -= previous.value.data.byteLength;
    }
    if (!result.ok) return;
    const size = result.value.data.byteLength;
    if (size > this.maxBytes) return;
    while (this.ready.size >= this.maxEntries || this.bytes + size > this.maxBytes) {
      const oldest = this.ready.entries().next().value;
      if (oldest === undefined) break;
      this.ready.delete(oldest[0]);
      if (oldest[1].ok) this.bytes -= oldest[1].value.data.byteLength;
    }
    this.ready.set(key, result);
    this.bytes += size;
  }
}
