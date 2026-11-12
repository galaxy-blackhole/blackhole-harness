/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Kieu dung chung cua nua client row ui-settings (store, remote, context)
 */

/** Store quan sat duoc ma seam client-store cap. */
export interface SnapshotStore<T> {
  /** @returns gia tri hien tai (tham chieu on dinh). */
  getSnapshot(): T;
  /**
   * Theo doi moi lan doi gia tri.
   * @param listener - ham duoc goi sau moi lan doi.
   * @returns ham huy dang ky.
   */
  subscribe(listener: () => void): () => void;
  /**
   * Cap nhat gia tri tai cho (mutate).
   * @param mutate - ham sua ban nhap.
   */
  update(mutate: (draft: T) => void): void;
  /**
   * Thay gia tri bang mot gia tri moi.
   * @param next - gia tri moi.
   */
  set(next: T): void;
}

/** Ham tao store tu seam client-store. */
export type CreateStore = <T>(initial: T) => SnapshotStore<T>;

/** Ket qua mot lan ghi settings len Host. */
export interface WriteResult {
  /** Host co chap nhan khong. */
  ok: boolean;
  /** View namespace sau khi ghi (khi ok). */
  value?: unknown;
  /** Loi tra ve (khi khong ok). */
  error?: { message?: string };
}

/** Seam remote.settings: moi thao tac ghi settings di qua day. */
export interface SettingsWriteRemote {
  /**
   * Ghi mot loat thao tac len mot namespace.
   * @param ns - ten namespace.
   * @param ops - danh sach thao tac (set/unset).
   * @param revision - revision ma lan ghi nay dua vao (fence chong ghi de).
   * @returns ket qua ghi.
   */
  mutate(ns: string, ops: readonly unknown[], revision: number | undefined): Promise<WriteResult>;
}
