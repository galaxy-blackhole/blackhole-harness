/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cau hinh createSnapshotStore mot lan luc tao plugin — de cac lop giu dung chu ky constructor cua ban goc
 */

import type { CreateSnapshotStore, SnapshotStore } from "./types.ts";

/** Ham tao store do module @galaxy-blackhole/gbh-client-store cap (require trong factory cua loader). */
let storeFactory: CreateSnapshotStore | undefined;

/**
 * Ghi lai ham tao store cua bang module.
 * Nhận: next — ham tao store lay tu @galaxy-blackhole/gbh-client-store.
 * Trả: khong co.
 */
export function configureStoreFactory(next: CreateSnapshotStore): void {
  storeFactory = next;
}

/**
 * Tao mot store anh chup bang factory da cau hinh.
 * Nhận: initial — gia tri dau cua store.
 * Trả: store anh chup day du getSnapshot/subscribe/set/update.
 */
export function createStore<T>(initial: T): SnapshotStore<T> {
  if (storeFactory === undefined) {
    throw new Error("gbh-client-ui-model-selection: chua cau hinh createSnapshotStore — phai goi createPlugin truoc");
  }
  return storeFactory(initial);
}
