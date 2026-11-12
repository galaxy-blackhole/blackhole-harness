/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Giao dich tuy chon co revision: chi cong bo ban đã ghi được, giu ban cu khi loi
 */

import {
  editShortcutDocument,
  effectiveShortcuts,
  parseShortcutDocument,
  type BindingIssue,
  type ShortcutDefinition,
  type ShortcutDocument,
  type ShortcutEdit,
} from "./configuration.ts";
import type { ShortcutCommandId, ShortcutPlatform, ShortcutRuntime } from "./binding.ts";

/** Danh tính trạng thái đã nhận (mờ đục), mất hiệu lực khi cấu hình hoặc danh mục đổi. */
export type ShortcutRevision = string & { readonly __brand?: "ShortcutRevision" };

/** Trạng thái đọc vẫn giữ tài liệu đã nhận khi lỗi; đang tải thì lệnh chưa bật. */
export interface ShortcutConfigSnapshot {
  /** Revision của trạng thái đã nhận. */
  readonly revision: ShortcutRevision;
  /** Số thứ tự tăng dần trong một đời chủ kho; client bỏ qua phản hồi IPC tới muộn. */
  readonly sequence: number;
  /** Tài liệu tuy chọn đã nhận. */
  readonly document: ShortcutDocument;
  /** Trạng thái đọc. */
  readonly status: "loading" | "ready" | "unreadable";
  /** Lỗi đọc đã phân loại. */
  readonly error: "read" | "invalid" | "future" | null;
  /** Có đang dùng mặc định (chưa có tài liệu) hay không. */
  readonly usingDefaults: boolean;
}

/** Lần ghi hỏng KHÔNG bao giờ thay tuy chọn đang hiệu lực. */
export interface ShortcutSaveResult {
  /** Kết quả đã phân loại. */
  readonly status: "saved" | "stale" | "unreadable" | "write-failed" | "not-ready" | "conflict";
  /** Bản chụp hiện tại. */
  readonly snapshot: ShortcutConfigSnapshot;
  /** Lý do từ chối nếu có. */
  readonly issue?: BindingIssue;
  /** Các lệnh xung đột nếu có. */
  readonly conflicts?: readonly ShortcutCommandId[];
}

/** Bộ chuyển lưu trữ sở hữu đường dẫn/origin và ghi thay thế toàn bộ khi thành công. */
export interface ShortcutStorage {
  /**
   * Đọc nội dung đã lưu.
   * Nhận: không.
   * Trả: chuỗi thô, hoặc null khi chưa có.
   */
  read(): string | null | Promise<string | null>;
  /**
   * Ghi thay thế toàn bộ.
   * Nhận: `raw` — nội dung mới.
   * Trả: xong khi ghi hoàn tất.
   */
  write(raw: string): void | Promise<void>;
}

/** API preload hạn chế của Desktop; đường dẫn và accelerator không bao giờ đi từ renderer sang. */
export interface DesktopShortcutsApi {
  /**
   * Đọc cấu hình đã nhận cho danh mục lệnh hiện tại.
   * Nhận: `definitions` — danh mục đang hoạt động.
   * Trả: bản chụp cấu hình.
   */
  get(definitions: readonly ShortcutDefinition[]): Promise<ShortcutConfigSnapshot>;
  /**
   * Ghi một lần sửa có kiểm revision.
   * Nhận: `edit`, `revision`.
   * Trả: kết quả đã phân loại.
   */
  edit(edit: ShortcutEdit, revision: ShortcutRevision): Promise<ShortcutSaveResult>;
  /**
   * Theo dõi thay đổi cấu hình.
   * Nhận: `listener` — người nhận bản chụp.
   * Trả: hàm gỡ.
   */
  subscribe(listener: (snapshot: ShortcutConfigSnapshot) => void): () => void;
  /**
   * Bật/tắt việc chặn accelerator của menu native.
   * Nhận: `active` — lớp ghi phím có đang bật.
   * Trả: xong khi IPC hoàn tất.
   */
  recording(active: boolean): Promise<void>;
}

/** Sinh danh tính mới cho revision (mờ đục với người dùng). */
function newRevision(): ShortcutRevision {
  return globalThis.crypto.randomUUID() as ShortcutRevision;
}

/**
 * Tạo bản chụp ban đầu ở trạng thái TẮT, cho lúc bộ chuyển lưu trữ còn đang khởi động.
 * Nhận: không.
 * Trả: cấu hình mới, chưa có trạng thái bền nào được nhận.
 */
export function initialShortcutConfig(): ShortcutConfigSnapshot {
  return {
    revision: newRevision(),
    sequence: 0,
    document: { schemaVersion: 1, profiles: {} },
    status: "loading",
    error: null,
    usingDefaults: true,
  };
}

/** Điều phối MỘT người ghi, dùng chung cho localStorage và bộ chuyển file nguyên tử của Electron. */
export class ShortcutPersistence {
  /** Bộ chuyển lưu trữ. */
  private readonly storage: ShortcutStorage;
  /** Vỏ ứng dụng. */
  private readonly runtime: ShortcutRuntime;
  /** Thiết bị. */
  private readonly platform: ShortcutPlatform;
  /** Có đọc lại trước khi ghi hay không (Desktop ghi file nguyên tử). */
  private readonly rereadBeforeWrite: boolean;
  /** Công bố bản chụp đã nhận. */
  private readonly publish: (snapshot: ShortcutConfigSnapshot) => void;
  /** Bản chụp hiện tại. */
  private snapshot: ShortcutConfigSnapshot = initialShortcutConfig();
  /** Nội dung thô gần nhất đã đọc/ghi. */
  private raw: string | null | undefined;
  /** Hàng đợi tuần tự hoá các giao dịch. */
  private queue: Promise<unknown> = Promise.resolve();
  /** Danh mục lệnh đã tin (null khi sản phẩm chưa sẵn sàng). */
  private definitions: readonly ShortcutDefinition[] | null = null;
  /** Còn nhận sửa và công bố hay không. */
  private active = true;

  /**
   * Dựng bộ điều phối quanh một bộ chuyển lưu trữ.
   * Nhận: `storage`, `runtime`, `platform`, `rereadBeforeWrite`, `publish`.
   * Trả: đối tượng điều phối.
   */
  constructor(
    storage: ShortcutStorage,
    runtime: ShortcutRuntime,
    platform: ShortcutPlatform,
    rereadBeforeWrite: boolean,
    publish: (snapshot: ShortcutConfigSnapshot) => void,
  ) {
    this.storage = storage;
    this.runtime = runtime;
    this.platform = platform;
    this.rereadBeforeWrite = rereadBeforeWrite;
    this.publish = publish;
  }

  /**
   * Cài hoặc thu hồi danh mục sản phẩm và vô hiệu bản nháp của đời trước.
   * Nhận: `definitions` — định nghĩa đang tin, hoặc null khi sản phẩm chưa sẵn sàng.
   * Trả: không.
   */
  setDefinitions(definitions: readonly ShortcutDefinition[] | null): void {
    this.definitions = definitions;
    this.accept({ ...this.snapshot });
  }

  /**
   * Ngừng nhận sửa và ngừng công bố kết quả tới muộn.
   * Nhận: không.
   * Trả: không.
   */
  dispose(): void {
    this.active = false;
  }

  /**
   * Đọc file hiện tại; lỗi thì giữ tài liệu đã nhận và tắt đường ghi thường.
   * Nhận: không.
   * Trả: bản chụp đã nhận hoặc bản chụp chẩn đoán.
   */
  readCurrent(): Promise<ShortcutConfigSnapshot> {
    return this.serialize(() => this.read());
  }

  /**
   * So revision bản nháp, kiểm TOÀN BỘ ứng viên, ghi bền rồi mới công bố.
   * Nhận: `edit` — thao tác đã ràng buộc, `revision` — trạng thái người dùng đã xem.
   * Trả: kết quả đã phân loại kèm bản chụp hiện tại.
   */
  edit(edit: ShortcutEdit, revision: ShortcutRevision): Promise<ShortcutSaveResult> {
    return this.serialize(async (): Promise<ShortcutSaveResult> => {
      if (this.rereadBeforeWrite) await this.read();
      const result = (status: ShortcutSaveResult["status"]): ShortcutSaveResult => ({ status, snapshot: this.snapshot });
      if (!this.active || this.definitions === null || this.snapshot.status === "loading") return result("not-ready");
      if (revision !== this.snapshot.revision) return result("stale");
      if (this.snapshot.status === "unreadable") return result("unreadable");
      if (
        (edit.type === "set" || edit.type === "reset") &&
        !this.definitions.some((row) => row.id === edit.id && row.fixed === undefined)
      ) {
        return result("not-ready");
      }
      const document = editShortcutDocument(this.snapshot.document, edit, this.runtime, this.platform);
      const rows = effectiveShortcuts(this.definitions, document, this.runtime, this.platform);
      const invalid = rows.find(
        (row) => (edit.type === "reset-all" || row.id === edit.id) && (row.issue !== null || row.conflicts.length > 0),
      );
      const displaced = edit.type === "set" ? rows.find((row) => row.conflicts.includes(edit.id)) : undefined;
      if (invalid !== undefined || displaced !== undefined) {
        return {
          ...result("conflict"),
          ...(invalid?.issue ? { issue: invalid.issue } : {}),
          conflicts: invalid?.conflicts.length ? invalid.conflicts : displaced === undefined ? [] : [displaced.id],
        };
      }
      try {
        const raw = `${JSON.stringify(document, null, 2)}\n`;
        await this.storage.write(raw);
        this.raw = raw;
        this.accept({ ...this.snapshot, document, status: "ready", error: null, usingDefaults: false });
        return result("saved");
      } catch (_error) {
        return result("write-failed");
      }
    });
  }

  /** Xếp thao tác vào hàng đợi tuần tự (hàng đợi không bao giờ vỡ vì một lần hỏng). */
  private serialize<T>(operation: () => T | Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Tăng sequence, cấp revision mới, rồi công bố (lỗi người nghe không làm vỡ giao dịch). */
  private accept(snapshot: ShortcutConfigSnapshot): void {
    this.snapshot = { ...snapshot, sequence: this.snapshot.sequence + 1, revision: newRevision() };
    if (!this.active) return;
    try {
      this.publish(this.snapshot);
    } catch (error) {
      console.error("Shortcut configuration subscriber failed:", error);
    }
  }

  /** Đọc lại kho; lỗi đọc chỉ công bố MỘT lần cho tới khi trạng thái đổi. */
  private async read(): Promise<ShortcutConfigSnapshot> {
    let raw: string | null;
    try {
      raw = await this.storage.read();
    } catch (_error) {
      if (this.snapshot.error !== "read") this.accept({ ...this.snapshot, status: "unreadable", error: "read" });
      return this.snapshot;
    }
    if (raw === this.raw && this.snapshot.error !== "read") return this.snapshot;
    this.raw = raw;
    const document = parseShortcutDocument(raw);
    if (typeof document === "string") {
      this.accept({ ...this.snapshot, status: "unreadable", error: document });
    } else {
      this.accept({ ...this.snapshot, document, status: "ready", error: null, usingDefaults: raw === null });
    }
    return this.snapshot;
  }
}
