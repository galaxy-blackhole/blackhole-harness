/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc SettingsDocumentStore — chủ trạng thái của nút "Mở tệp cấu hình" ở header modal Settings,
 *   port trung thành bản gốc dsh-client-ui-settings-general/lib/client.js:775-855
 */

// ⚠️ VÌ SAO TỆP NÀY TỒN TẠI (đo được 18/10/2026): ghế `settings.action` của bản gốc KHÔNG BAO GIỜ trống
//   — nó đăng ký nút mở tệp cấu hình khi `ctx.remote.$host.isLoopback` (bản gốc dòng 1114). Bản port
//   trước đây đăng ký `createDocumentAction` với `inject: () => ({ openDocument: undefined })` nên
//   component trả null ⇒ header modal Settings KHÔNG có nút. Phép đo TRƯỚC: probe DOM thật cho
//   `<div data-slot="settings.action" style="display: contents;"></div>` — rỗng, 0 button.
//   Sau khi có lớp này: `inject` trả `{ controller, hooks: { snapshot } }` đúng hợp đồng, renderer cấp
//   `useSnapshot` cho component và nút hiện ra.

import type { DescribeFace, DocumentOpenReply, DocumentMirrorSnapshot, RemoteSeam } from "./types.ts";

/** Trạng thái của nút mở tệp cấu hình — ĐÚNG bốn mức bản gốc dùng. */
export interface DocumentSnapshot {
  /** idle (chưa dò) · loading (đang dò) · ready (mở được) · unavailable (Host không có tệp cục bộ). */
  status: "idle" | "loading" | "ready" | "unavailable";
  /** Đang chờ lệnh mở tệp chạy xong. */
  opening: boolean;
  /** Thông báo lỗi gần nhất (null = không có lỗi). */
  error: string | null;
}

/** Nguồn trạng thái mà renderer biến thành hook `useSnapshot` (hợp đồng của ghế có `hooks.snapshot`). */
export interface DocumentSnapshotStore {
  /** Ảnh chụp hiện tại — THAM CHIẾU ỔN ĐỊNH khi chưa có thay đổi (hợp đồng useSyncExternalStore). */
  getSnapshot(): DocumentSnapshot;
  /** Theo dõi mỗi lần ảnh chụp đổi; trả hàm huỷ đăng ký. */
  subscribe(listener: () => void): () => void;
  /** Sửa một bản nháp của ảnh chụp rồi công bố (chỉ công bố khi có trường thật sự đổi). */
  update(mutate: (draft: DocumentSnapshot) => void): void;
}

/**
 * Dựng nguồn trạng thái nhỏ cho nút mở tệp.
 * Nhận: trạng thái ban đầu (bản gốc: idle/opening=false/error=null).
 * Trả: nguồn có getSnapshot/subscribe/update theo hợp đồng `hooks.snapshot`.
 */
export function createDocumentSnapshotStore(initial: DocumentSnapshot): DocumentSnapshotStore {
  let snapshot: DocumentSnapshot = Object.freeze({ ...initial });
  const listeners = new Set<() => void>();
  return {
    getSnapshot: (): DocumentSnapshot => snapshot,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update: (mutate: (draft: DocumentSnapshot) => void): void => {
      const draft: DocumentSnapshot = { ...snapshot };
      mutate(draft);
      if (draft.status === snapshot.status && draft.opening === snapshot.opening && draft.error === snapshot.error) return;
      snapshot = Object.freeze(draft);
      for (const listener of Array.from(listeners)) {
        try {
          listener();
        } catch (error) {
          // Một người nghe hỏng KHÔNG được làm mất nút (khuôn #5).
          console.warn("gbh-client-ui-settings-general: listener cua document store nem loi, bo qua", error);
        }
      }
    },
  };
}

/** Trạng thái ban đầu — nguyên văn bản gốc (dòng 779-783). */
const INITIAL: DocumentSnapshot = { status: "idle", opening: false, error: null };

/**
 * Chủ trạng thái của hành động mở tài liệu settings cục bộ.
 *
 * Bản gốc `SettingsDocumentStore` (lib/client.js:775): suy khả năng mở từ mirror dùng chung
 * (`hasDocument`) rồi gọi thao tác `settings/openSettingsDocument` do Host sở hữu.
 */
export class SettingsDocumentStore {
  /** Nguồn trạng thái dùng chung với component nút (cùng một thể hiện — LUẬT 8). */
  readonly store: DocumentSnapshotStore;
  /** Seam remote (chỉ đọc hai mục bản gốc đọc). */
  private readonly remote: RemoteSeam;
  /** Mirror dùng chung của gói ui-settings (`describe()`). */
  private readonly describeFace: DescribeFace;
  /** Hàm huỷ theo dõi mirror (một lần duy nhất — `load` idempotent). */
  private following: (() => void) | undefined;

  /**
   * @param remote - seam remote của trang (isLoopback + settings.openSettingsDocument).
   * @param describeFace - mirror dùng chung mà gói ui-settings cấp qua `configForms.describe()`.
   */
  constructor(remote: RemoteSeam, describeFace: DescribeFace) {
    this.remote = remote;
    this.describeFace = describeFace;
    this.store = createDocumentSnapshotStore(INITIAL);
  }

  /**
   * Bắt đầu theo dõi mirror (idempotent) và phản ánh việc Host có tệp cấu hình cục bộ hay không.
   * @returns kết thúc khi ảnh chụp đã phản ánh mirror.
   */
  async load(): Promise<void> {
    this.following ??= this.describeFace.subscribe(() => {
      this.derive();
    });
    this.store.update((state) => {
      state.status = "loading";
      state.error = null;
    });
    await this.describeFace.ensure();
    this.derive();
  }

  /**
   * Mở tài liệu đã nạp MỘT lần; thao tác trùng trong lúc đang mở bị gộp vào lần đang chạy.
   * @returns kết thúc khi lệnh mở của Host xong, hoặc ngay khi chưa sẵn sàng/đang mở.
   */
  async open(): Promise<void> {
    const current = this.store.getSnapshot();
    if (current.status !== "ready" || current.opening) return;
    this.store.update((state) => {
      state.opening = true;
      state.error = null;
    });
    try {
      const settings = this.remote.settings;
      const openDocument = settings?.openSettingsDocument;
      // Seam vắng (môi trường rút gọn): báo lỗi TRONG NÚT, không ném ra ngoài (khuôn #5).
      if (typeof openDocument !== "function") {
        this.store.update((state) => {
          state.error = "settings.openSettingsDocument is unavailable";
        });
        return;
      }
      const reply: DocumentOpenReply = await openDocument.call(settings);
      if (!reply.ok) {
        const message = reply.error?.message;
        this.store.update((state) => {
          state.error = message ?? "could not open the settings document";
        });
      }
    } catch (error) {
      // Bản gốc chỉ có `finally`; ở đây BẮT THÊM để một lần mở hỏng không thành lỗi console (check:app (8)).
      this.store.update((state) => {
        state.error = error instanceof Error ? error.message : String(error);
      });
    } finally {
      this.store.update((state) => {
        state.opening = false;
      });
    }
  }

  /** Ngừng theo dõi mirror. */
  dispose(): void {
    this.following?.();
    this.following = undefined;
  }

  /** Suy trạng thái từ ảnh chụp mirror — nguyên văn `derive()` của bản gốc (dòng 840-854). */
  private derive(): void {
    const mirrored: DocumentMirrorSnapshot = this.describeFace.getSnapshot();
    if (mirrored.view === undefined) {
      if (mirrored.error !== null && mirrored.error !== undefined) {
        const failure = mirrored.error;
        this.store.update((state) => {
          state.status = "unavailable";
          state.error = failure;
        });
      }
      return;
    }
    const hasDocument = mirrored.view.hasDocument === true;
    this.store.update((state) => {
      state.status = hasDocument ? "ready" : "unavailable";
      state.error = null;
    });
  }
}
