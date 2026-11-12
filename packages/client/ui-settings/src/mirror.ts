/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc SettingsDescribeMirror: ban sao phia browser cua tai lieu settings do Host so huu
 */

import type { SnapshotStore } from "./types.ts";

/** Mot namespace trong tai lieu settings cua Host. */
export interface NamespaceView {
  /** Ten namespace (trung voi entryId cua plugin so huu). */
  readonly ns: string;
  /** Revision cua namespace tai thoi diem Host tra loi. */
  readonly revision?: number;
  /** Gia tri goc (base) truoc khi nguoi dung sua. */
  readonly base?: unknown;
  /** Gia tri nguoi dung da sua (neu co). */
  readonly user?: unknown;
  /** Gia tri dang duoc ap dung: user ?? base. */
  readonly value?: unknown;
  /** Envelope schema da serialize cua namespace. */
  readonly schema?: unknown;
}

/** Toan bo tai lieu settings ma Host tra ve cho mot lan describe. */
export interface DocumentView {
  /** Host co cho phep ghi khong. */
  readonly writable: boolean;
  /** Danh sach namespace Host dang phuc vu. */
  readonly namespaces: readonly NamespaceView[];
}

/** Trang thai mirror. */
export interface MirrorSnapshot {
  /** idle (chua doc) · loading · ready. */
  status: "idle" | "loading" | "ready";
  /** Tai lieu dang giu (neu da co lan tra loi thanh cong). */
  view?: DocumentView;
  /** Thong bao loi cua lan doc gan nhat (neu co). */
  error: string | null;
}

/** Seam remote.settings ma mirror doc qua. */
export interface SettingsRemote {
  /** Doc tai lieu settings tu Host. */
  describe(): Promise<{ ok: boolean; value?: DocumentView; error?: { message?: string } }>;
}

/** Ham tao snapshot store tu seam client-store. */
export type CreateStore = <T>(initial: T) => SnapshotStore<T>;

/** Gop cau tra loi cua mot lan ghi vao tai lieu dang giu, va danh dau lan doc dang chay phai chay lai. */
export class SettingsDescribeMirror {
  private readonly store: SnapshotStore<MirrorSnapshot>;
  /** Lan doc dang chay (neu co) — moi lan goi load() trong luc nay chi bat co rerun. */
  private inFlight: Promise<void> | undefined;
  /** Co bao con phai doc lai sau khi lan doc hien tai xong. */
  private rerun = false;
  /** The he doc: cau tra loi cu (generation khac) bi bo qua. */
  private generation = 0;

  /**
   * @param remote - seam remote.settings (doc tai lieu).
   * @param createStore - ham tao snapshot store tu seam client-store.
   */
  constructor(private readonly remote: SettingsRemote, createStore: CreateStore) {
    this.store = createStore<MirrorSnapshot>({ status: "idle", view: undefined, error: null });
  }

  /** @returns snapshot dong bo hien tai (tham chieu on dinh cho toi lan doi ke tiep). */
  getSnapshot(): MirrorSnapshot {
    return this.store.getSnapshot();
  }

  /**
   * Theo doi moi lan snapshot doi.
   * @param listener - ham duoc goi sau moi lan doi snapshot.
   * @returns ham huy dang ky.
   */
  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener);
  }

  /**
   * Doc lai tu Host; goi trong luc dang doc thi chi bat co rerun (khong doc chong).
   * @returns promise ket thuc khi lan doc nay (hoac lan dang chay) xong.
   */
  load(): Promise<void> {
    if (this.inFlight !== undefined) {
      this.rerun = true;
      return this.inFlight;
    }
    const run = Promise.resolve().then(() => this.run());
    this.inFlight = run;
    return run;
  }

  /**
   * Bao dam co cau tra loi: doc neu dang idle, cho neu dang doc.
   * @returns promise ket thuc khi co cau tra loi hoac lan doc xong.
   */
  ensure(): Promise<void> {
    if (this.inFlight !== undefined) return this.inFlight;
    if (this.getSnapshot().status === "idle") return this.load();
    return Promise.resolve();
  }

  /**
   * Gop cau tra loi cua mot lan ghi vao tai lieu dang giu (khong doc lai qua mang).
   * @param view - view cua namespace vua duoc Host tra loi.
   */
  acceptView(view: NamespaceView): void {
    const before = this.store.getSnapshot();
    this.generation += 1;
    if (this.inFlight !== undefined) this.rerun = true;
    if (before.view === undefined) return;
    const namespaces = before.view.namespaces.some((row) => row.ns === view.ns)
      ? before.view.namespaces.map((row) => (row.ns === view.ns ? view : row))
      : [...before.view.namespaces, view];
    this.store.set({ ...before, view: { ...before.view, namespaces } });
  }

  /**
   * Tra cuu nhanh mot namespace trong tai lieu dang giu.
   * @param ns - ten namespace.
   * @returns view cua namespace, hoac undefined khi chua co.
   */
  namespace(ns: string): NamespaceView | undefined {
    return this.store.getSnapshot().view?.namespaces.find((row) => row.ns === ns);
  }

  /** Vong doc: chay lai neu co yeu cau den giua luc doc. */
  private async run(): Promise<void> {
    try {
      do {
        const before = this.store.getSnapshot();
        if (before.status === "idle") this.store.set({ ...before, status: "loading" });
        this.rerun = false;
        const generation = ++this.generation;
        let outcome: { view: DocumentView } | { failure: string };
        try {
          const response = await this.remote.describe();
          outcome = response.ok && response.value !== undefined
            ? { view: response.value }
            : { failure: response.error?.message ?? "settings describe failed" };
        } catch (error) {
          outcome = { failure: error instanceof Error ? error.message : String(error) };
        }
        if (generation !== this.generation) continue;
        if ("view" in outcome) {
          this.store.set({ status: "ready", view: outcome.view, error: null });
        } else {
          const held = this.store.getSnapshot();
          this.store.set({
            status: held.view === undefined ? "idle" : "ready",
            view: held.view,
            error: outcome.failure,
          });
        }
      } while (this.shouldRerun());
    } finally {
      this.inFlight = undefined;
    }
  }

  /** @returns true khi co yeu cau doc lai dang cho. */
  private shouldRerun(): boolean {
    return this.rerun;
  }
}
