/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Sổ chỉ mục theo phiên cho các thẻ cordis_run cùng tranh một chỗ UI do Package sở hữu — port 1:1 vùng #region run-card-index.js
 */

import type { CordisDynamicPackageId, CordisDynamicPluginId, CordisDynamicPluginRunId, HostObservable, SessionId } from "./events.ts";

/** Danh tính slot-keyed ổn định của một khung UI do Package sở hữu. */
export type CordisToolViewKey = `${CordisDynamicPluginId}.${CordisDynamicPackageId}`;

/** Một kết quả tool thành công đang tranh chỗ đặt khung UI của Package. */
export interface CordisRunCardPointer {
  /** Khoá khung UI dùng chung. */
  readonly key: CordisToolViewKey;
  /** Id lời gọi sở hữu khung. */
  readonly callId: string;
  /** Số thứ tự log của kết quả. */
  readonly seq: number;
  /** Id lần chạy. */
  readonly pluginRunId: CordisDynamicPluginRunId;
}

/** Sổ đọc theo phiên mà mọi thẻ Run đã mount cùng dùng. */
export interface CordisRunCardStore extends HostObservable<ReadonlyMap<CordisToolViewKey, CordisRunCardPointer>> {
  /**
   * Công bố một kết quả Run thành công; chỉ số thứ tự log LỚN HƠN mới thay được mục đang giữ.
   * Nhận: pointer — mục cần công bố.
   * Trả: không.
   */
  observe(pointer: CordisRunCardPointer): void;
}

/**
 * Dựng sổ trống cho một phiên.
 * Nhận: không.
 * Trả: sổ quan sát được, giữ nguyên tham chiếu bản chụp cho tới lần công bố kế tiếp.
 */
function createStore(): CordisRunCardStore {
  const pointers = new Map<CordisToolViewKey, CordisRunCardPointer>();
  const listeners = new Set<() => void>();
  let cache: ReadonlyMap<CordisToolViewKey, CordisRunCardPointer> | undefined;
  return {
    getSnapshot: () => (cache ??= new Map(pointers)),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    observe: (pointer) => {
      const current = pointers.get(pointer.key);
      if (current !== undefined && current.seq >= pointer.seq) return;
      pointers.set(pointer.key, pointer);
      cache = undefined;
      for (const listener of [...listeners]) listener();
    },
  };
}

/** Sổ đăng ký sống theo TRANG: mọi thẻ của cùng một phiên dùng chung một Store. */
export class CordisRunCardRegistry {
  /** Sổ theo id phiên. */
  private readonly sessions = new Map<SessionId, CordisRunCardStore>();

  /**
   * Trả sổ sống theo trang của một phiên (tạo khi chưa có).
   * Nhận: sessionId — phiên mà các thẻ chia sẻ trạng thái thay thế.
   * Trả: sổ giữ cho phiên đó.
   */
  forSession(sessionId: SessionId): CordisRunCardStore {
    let store = this.sessions.get(sessionId);
    if (store === undefined) {
      store = createStore();
      this.sessions.set(sessionId, store);
    }
    return store;
  }
}

/**
 * Dựng khoá khung UI của Package dùng chung cho cả đăng ký lẫn thẻ Run.
 * Nhận: pluginId — id Plugin ổn định; packageId — id Package bất biến.
 * Trả: khoá khung UI dùng chung.
 */
export function cordisToolViewKey(
  pluginId: CordisDynamicPluginId,
  packageId: CordisDynamicPackageId,
): CordisToolViewKey {
  return `${pluginId}.${packageId}` as CordisToolViewKey;
}
