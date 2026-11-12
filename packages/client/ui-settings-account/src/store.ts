/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kho observable dung chung: boc seed @galaxy-blackhole/gbh-client-store cua vo (mot tu khoa seed, khong phai goi tren dia)
 */

import type { ObservableStore } from "./contracts.ts";

/** Kho ghi duoc — them set() so voi ObservableStore (dung noi bo cua row). */
export interface SnapshotStore<T> extends ObservableStore<T> {
  /** Thay gia tri va bao moi nguoi nghe. */
  set(value: T): void;
}

/** Hai ham cua seed @galaxy-blackhole/gbh-client-store ma row nay dung. */
export interface StoreModule {
  /** Tao mot kho anh chup. */
  createSnapshotStore: <T>(initial: T) => SnapshotStore<T>;
  /** So sanh nong hai gia tri. */
  shallowEqual: (a: unknown, b: unknown) => boolean;
}

/**
 * Nap seed kho cua vo qua bang module cua loader.
 * @param requireFn - ham nap module cua bang module trang.
 * @returns hai ham cua seed.
 */
export function loadStoreModule(requireFn: (specifier: string) => unknown): StoreModule {
  return requireFn("@galaxy-blackhole/gbh-client-store") as StoreModule;
}
