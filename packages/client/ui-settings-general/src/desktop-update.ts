/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Logic trạng thái cập nhật Desktop (không slot; badge.ts dùng) — ĐÃ ĐIỀN: updateCopy + DesktopUpdateSource
 */

import type { ComponentFactory, GeneralDeps } from "./types.ts";

/** Bốn pha được coi là đang bận (giữ nguyên danh sách của bản gốc). */
export const BUSY_PHASES: readonly string[] = ["checking", "downloading", "verifying", "installing"];

/** Bản trình bày trạng thái cập nhật do cầu Desktop đẩy sang. */
export interface UpdatePresentation {
  /** Pha hiện tại. */
  phase: string;
  /** Phiên bản (nếu biết). */
  version?: string;
  /** Phần trăm tải (nếu có). */
  percent?: number;
  /** Mã lỗi (khi pha là `error`). */
  failure?: string;
}

/** Cặp nhãn + chi tiết để hiển thị. */
export interface UpdateCopy {
  /** Nhãn ngắn. */
  label: string;
  /** Chi tiết đầy đủ. */
  detail: string;
}

/** Cầu Desktop rút gọn (chỉ khai phần row dùng). */
export interface DesktopBridge {
  /** Theo dõi trình bày mới. */
  subscribe(listener: (presentation: UpdatePresentation) => void): () => void;
  /** Trạng thái hiện tại. */
  status(): Promise<UpdatePresentation>;
  /** Mở tiến trình cập nhật. */
  open(): Promise<void>;
}

/** Store tối thiểu thay `createSnapshotStore` của framework (nửa UI không import gói khác). */
export interface SnapshotStore<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot(): T;
  /** Ghi ảnh chụp mới. */
  set(next: T): void;
  /** Theo dõi thay đổi. */
  subscribe(listener: () => void): () => void;
}

/** Trạng thái nguồn cập nhật. */
export interface DesktopUpdateState {
  /** Lần đọc/ghi gần nhất thất bại. */
  failed: boolean;
  /** Đang mở tiến trình. */
  opening: boolean;
  /** Trình bày nhận được. */
  presentation?: UpdatePresentation;
}

/**
 * Dựng một snapshot store tối thiểu.
 * Nhận: giá trị đầu.
 * Trả: store có getSnapshot/set/subscribe.
 */
export function createSnapshotStore<T>(initial: T): SnapshotStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    set: (next: T) => {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/**
 * Dịch trạng thái cập nhật thành nhãn + chi tiết (giữ nguyên bảng chuỗi của bản gốc).
 * Nhận: trình bày trạng thái và hàm dịch.
 * Trả: nhãn ngắn và chi tiết đã bản địa hoá.
 */
export function updateCopy(state: UpdatePresentation, t: (key: string, params?: Record<string, unknown>) => string): UpdateCopy {
  const label = ({
    idle: "",
    checking: t("desktop.update.checking"),
    available: t("desktop.update.available"),
    downloading: t("desktop.update.progress", { percent: state.percent ?? 0 }),
    verifying: t("desktop.update.verifying"),
    installing: t("desktop.update.installing"),
    ready: t("desktop.update.ready"),
    error: t("desktop.update.retry"),
  } as Record<string, string>)[state.phase] ?? "";
  if (state.phase === "checking" || state.phase === "verifying" || state.phase === "installing") {
    return { label, detail: state.version ?? label };
  }
  if (state.phase === "error") {
    return {
      label,
      detail: ({
        check: t("desktop.update.checkFailed"),
        "check-network": t("desktop.update.checkNetworkFailed"),
        download: t("desktop.update.downloadFailed"),
        "download-network": t("desktop.update.downloadNetworkFailed"),
        install: t("desktop.update.installFailed"),
        "install-network": t("desktop.update.installNetworkFailed"),
        "stop-failed": t("desktop.update.stopFailed"),
        "tasks-changed": t("desktop.update.tasksChanged"),
        "tasks-unavailable": t("desktop.update.tasksUnavailable"),
      } as Record<string, string>)[state.failure ?? "install"] ?? "",
    };
  }
  if (state.phase === "downloading" && state.version !== undefined) {
    return {
      label,
      detail: t("desktop.update.downloadDetail", { percent: state.percent ?? 0, version: state.version }),
    };
  }
  return {
    label,
    detail: state.version === undefined ? label : t("desktop.update.versionDetail", { label, version: state.version }),
  };
}

/**
 * Theo dõi một cầu Desktop (chuyển từ bản gốc, giữ nguyên luật `live`/`received`).
 */
export class DesktopUpdateSource {
  /** Trạng thái framework quan sát được. */
  readonly store = createSnapshotStore<DesktopUpdateState>({ failed: false, opening: false });

  private live = true;

  private received = false;

  private readonly unsubscribe?: () => void;

  /**
   * Gắn vào cầu (có thể không có trong trình duyệt thường).
   * Nhận: cầu Desktop tuỳ chọn.
   */
  constructor(private readonly bridge?: DesktopBridge) {
    this.unsubscribe = bridge?.subscribe((presentation) => {
      if (!this.live) return;
      this.received = true;
      this.store.set({ ...this.store.getSnapshot(), presentation, failed: false });
    });
    bridge?.status().then(
      (presentation) => {
        if (this.live && !this.received) this.store.set({ ...this.store.getSnapshot(), presentation });
      },
      () => {
        if (this.live && !this.received) this.store.set({ ...this.store.getSnapshot(), failed: true });
      },
    );
  }

  /** Gọi một hành động của người dùng; các lần bấm sau nhập vào thao tác đang chạy. */
  open(): void {
    if (!this.live || this.bridge === undefined) return;
    const state = this.store.getSnapshot();
    if (state.opening || (state.presentation !== undefined && BUSY_PHASES.includes(state.presentation.phase))) return;
    this.store.set({ ...state, opening: true });
    this.bridge.open().catch(() => {
      if (this.live) this.store.set({ ...this.store.getSnapshot(), failed: true });
    }).finally(() => {
      if (this.live) this.store.set({ ...this.store.getSnapshot(), opening: false });
    });
  }

  /** Tháo cầu và bỏ qua mọi trạng thái/hành động còn treo. */
  dispose(): void {
    this.live = false;
    this.unsubscribe?.();
  }
}

/**
 * Cấp logic cập nhật Desktop cho nửa UI.
 * Nhận: deps do plugin.ts cấp.
 * Trả: bộ hàm/nguồn mà badge.ts dùng (file này KHÔNG có slot).
 */
export const createDesktopUpdate: ComponentFactory = (_deps: GeneralDeps): unknown => ({
  updateCopy,
  BUSY_PHASES,
  createSource: (bridge?: DesktopBridge) => new DesktopUpdateSource(bridge),
});
