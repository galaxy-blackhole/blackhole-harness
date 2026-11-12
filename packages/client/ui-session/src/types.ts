/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hình dạng module ngoài mà row ui-session dùng (jsx runtime, store, slots, cordis)
 */

/** Hàm dựng phần tử của jsx runtime. */
export interface JsxRuntimeLike {
  /** Một phần tử con. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Nhiều phần tử con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Mảnh rời. */
  Fragment: unknown;
}

/** Store phía client: chỉ phần row này dùng. */
export interface ClientStoreLike {
  /** Báo cho người nghe của một nguồn ảnh chụp (có nhãn để chẩn đoán). */
  notifySubscribers(listeners: Set<() => void>, label: string): void;
}

/** Seam slots: chỉ phần row này dùng. */
export interface SlotsSeamLike {
  /** Tên prop của một hook chuẩn. */
  standardHookPropName(name: string): string;
  /** Gắn kho store của một phạm vi. */
  bindStoreScope(value: unknown): void;
  /** Đăng ký nguồn gốc của cây slot. */
  provideRoot(root: Record<string, unknown>): void;
  /** Cài một phạm vi theo tên. */
  installScope(name: string, adapter: unknown): void;
}

/** Service cordis ở mức row này cần. */
export interface ServiceLike {
  /** Context mà service được cài vào. */
  ctx: {
    /** Đăng ký hiệu ứng có thể huỷ. */
    effect(callback: () => unknown, label?: string): () => void;
  };
}

/** Lớp Service của cordis (đủ để kế thừa). */
export interface ServiceCtorLike {
  /** Tạo service với tên và tuỳ chọn. */
  new (ctx: unknown, name: string, options?: Record<string, unknown>): ServiceLike;
}
