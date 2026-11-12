/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Sổ đăng ký định nghĩa của Host như trang NÀY đọc lần cuối — đọc đơn tuyến, reset khi kết nối lại; port 1:1 vùng #region inventory.js
 */

import type {
  CordisActionResult,
  CordisDynamicPluginId,
  DynamicCordisInventoryRow,
  HostObservable,
  SessionId,
} from "./events.ts";

/** Thứ bảng đọc: các dòng, và đã đọc xong lần đầu hay chưa. */
export interface CordisInventorySnapshot {
  /** Các dòng Plugin Host trả về. */
  readonly rows: readonly DynamicCordisInventoryRow[];
  /** Các Plugin đã bị xoá QUA TRANG NÀY, giữ lại cho thẻ lịch sử. */
  readonly removed: ReadonlySet<CordisDynamicPluginId>;
  /** False cho tới khi một lần đọc kết thúc (bảng hiện dòng "đang đọc" thay vì "chưa có gì"). */
  readonly read: boolean;
  /** Lỗi đọc lần cuối, để bảng nói được vì sao trống. */
  readonly error?: string | undefined;
}

/** Nguồn inventory: observable của các dòng kèm còi đọc. */
export interface CordisInventory extends HostObservable<CordisInventorySnapshot> {
  /**
   * Đọc lại sổ đăng ký (bỏ qua khi đã có lần đọc đang bay).
   * Nhận: không.
   * Trả: không.
   */
  refresh(): void;
  /**
   * Ghi nhận một lần xoá tường minh và bỏ dòng đang sống ngay.
   * Nhận: pluginId — Plugin vừa bị xoá.
   * Trả: không.
   */
  retire(pluginId: CordisDynamicPluginId): void;
  /**
   * Bỏ những gì đã đọc; lần đọc sau bắt đầu từ rỗng (kết nối lại có thể là Host khác).
   * Nhận: không.
   * Trả: không.
   */
  reset(): void;
}

/** Seam RPC mà bảng gọi trực tiếp (giữ ngoài bề mặt React). */
export interface CordisDynamicPort {
  /**
   * Dừng một Plugin, giữ nguyên mọi Package bất biến.
   * Nhận: sessionId — phiên sở hữu; pluginId — Plugin cần dừng.
   * Trả: kết quả thao tác.
   */
  stop(sessionId: SessionId, pluginId: CordisDynamicPluginId): Promise<CordisActionResult>;
  /**
   * Dừng và xoá một Plugin cùng mọi Package.
   * Nhận: sessionId — phiên sở hữu; pluginId — Plugin cần xoá.
   * Trả: kết quả thao tác.
   */
  remove(sessionId: SessionId, pluginId: CordisDynamicPluginId): Promise<CordisActionResult>;
  /**
   * Đọc toàn bộ inventory của khung hình.
   * Nhận: không.
   * Trả: các dòng Plugin.
   */
  inventory(): Promise<readonly DynamicCordisInventoryRow[]>;
}

/**
 * Dựng nguồn inventory.
 * Nhận: port — seam RPC mà lần đọc đi qua; onError — nơi báo lần đọc hỏng (console ở production, bắt trong spec).
 * Trả: observable inventory kèm còi đọc.
 */
export function createCordisInventory(
  port: CordisDynamicPort,
  onError: (error: unknown) => void,
): CordisInventory {
  const listeners = new Set<() => void>();
  let snapshot: CordisInventorySnapshot = {
    rows: [],
    removed: new Set<CordisDynamicPluginId>(),
    read: false,
  };
  let inFlight: Promise<void> | undefined;
  let generation = 0;
  const publish = (next: CordisInventorySnapshot): void => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    refresh: () => {
      if (inFlight !== undefined) return;
      const issued = generation;
      inFlight = port
        .inventory()
        .then(
          (rows) => {
            if (issued !== generation) return;
            const removed = new Set(snapshot.removed);
            const live = new Set(rows.map((row) => row.pluginId));
            for (const previous of snapshot.rows) if (!live.has(previous.pluginId)) removed.add(previous.pluginId);
            publish({ rows, removed, read: true });
          },
          (error: unknown) => {
            if (issued !== generation) return;
            onError(error);
            publish({
              rows: snapshot.rows,
              removed: snapshot.removed,
              read: snapshot.read,
              error: error instanceof Error ? error.message : "reading the cordis inventory failed",
            });
          },
        )
        .then(() => {
          if (issued === generation) inFlight = undefined;
        });
    },
    retire: (pluginId) => {
      const removed = new Set(snapshot.removed);
      removed.add(pluginId);
      publish({
        ...snapshot,
        rows: snapshot.rows.filter((row) => row.pluginId !== pluginId),
        removed,
      });
    },
    reset: () => {
      generation += 1;
      inFlight = undefined;
      publish({ rows: [], removed: snapshot.removed, read: false });
    },
  };
}
