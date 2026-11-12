/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nút thư mục đang mở của cây tệp: một mức được đọc và giám sát, con mở theo nhu cầu.
 */

import { childPath } from "./paths.ts";
import type { FileLevelLike } from "./types.ts";

/** Đọc một mức thư mục; trả undefined khi bị huỷ giữa đường. */
export type DirectoryLoad = (path: string, signal: AbortSignal) => Promise<FileLevelLike | undefined>;

/** Theo dõi một thư mục; mỗi vòng lặp là một lần thư mục đổi. */
export type DirectoryWatch = (path: string, signal: AbortSignal) => AsyncIterable<string>;

/** Báo một thư mục không đọc được. */
export type DirectoryFailed = (path: string, error: unknown) => void;

/**
 * Gộp nhiều tín hiệu huỷ thành một.
 * Nhận: signals — các tín hiệu cần gộp (vòng đời tab và vòng đời nút).
 * Trả: tín hiệu huỷ ngay khi BẤT KỲ tín hiệu nào huỷ.
 */
function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

/**
 * Một thư mục đang mở và các nút con đang hoạt động; tuỳ chọn xem được giữ ở store.
 *
 * Nút tự giữ vòng đời của mình: một luồng giám sát, một lần đọc đang chạy, và tập mức đã đọc. Nhờ vậy
 * việc mở một thư mục chỉ là mở đúng một nút, không phải dựng lại cả cây.
 */
export class DirectoryNode {
  /** Đường dẫn tuyệt đối của thư mục này. */
  readonly path: string;

  /** Đọc một mức của chính thư mục này. */
  private readonly load: DirectoryLoad;

  /** Mở luồng giám sát thư mục này. */
  private readonly watch: DirectoryWatch;

  /** Báo lỗi đọc/giám sát lên trên. */
  private readonly failed: DirectoryFailed;

  /** Tập mức đang mở cần khôi phục sau lần đọc kế tiếp. */
  private restore: string[];

  /** Các nút con đang mở, khoá theo đường dẫn tuyệt đối. */
  private readonly children = new Map<string, DirectoryNode>();

  /** Huỷ riêng cây con này. */
  private readonly controller = new AbortController();

  /** Tín hiệu của nút: hợp của vòng đời cha và bộ huỷ riêng. */
  private readonly signal: AbortSignal;

  /** Vòng lặp giám sát (chạy một lần). */
  private task: Promise<void> | undefined;

  /** Lần đọc đang chạy (gộp mọi yêu cầu đọc lại). */
  private reading: Promise<void> | undefined;

  /** Có yêu cầu đọc lại đang chờ không. */
  private dirty = false;

  /** Đã đọc xong lần đầu chưa. */
  private initialized = false;

  /** Có tự đọc lại khi thư mục đổi không. */
  private automatic = true;

  /**
   * Dựng một nút thư mục.
   * Nhận: path — đường dẫn tuyệt đối; load — hàm đọc một mức; watch — hàm giám sát; failed — báo lỗi;
   *        lifetime — tín hiệu vòng đời của cha; restore — các mức con cần mở lại sau khi đọc.
   * Trả: nút đã sẵn sàng (chưa gọi open).
   */
  constructor(
    path: string,
    load: DirectoryLoad,
    watch: DirectoryWatch,
    failed: DirectoryFailed,
    lifetime: AbortSignal,
    restore: string[] = [],
  ) {
    this.path = path;
    this.load = load;
    this.watch = watch;
    this.failed = failed;
    this.restore = restore;
    this.signal = anySignal([lifetime, this.controller.signal]);
  }

  /**
   * Bắt đầu giám sát một lần; lần giám sát đầu kéo theo lần đọc đầu tiên.
   * Nhận: không.
   * Trả: chính nút này, để gọi nối tiếp.
   */
  open(): DirectoryNode {
    this.task ??= this.follow();
    return this;
  }

  /**
   * Tìm một nút đang hoạt động trong cây con này.
   * Nhận: path — đường dẫn tuyệt đối của thư mục cần tìm.
   * Trả: nút khớp, hoặc undefined khi thư mục đó đang đóng.
   */
  find(path: string): DirectoryNode | undefined {
    if (path === this.path) return this;
    for (const child of this.children.values()) {
      const found = child.find(path);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  /**
   * Cập nhật tuỳ chọn mở rộng cho các lần đọc còn đang chờ.
   * Nhận: expanded — tuỳ chọn mở rộng mới nhất từ store.
   * Trả: không.
   */
  setExpanded(expanded: string[]): void {
    this.restore = expanded;
    for (const child of this.children.values()) child.setExpanded(expanded);
  }

  /**
   * Mở một thư mục con trực tiếp theo vòng đời và chế độ tự làm mới của nút này.
   * Nhận: path — đường dẫn tuyệt đối của thư mục con; restore — tuỳ chọn mở rộng của cháu cần khôi phục.
   * Trả: nút con đang hoạt động, hoặc undefined khi đã bị huỷ.
   */
  expand(path: string, restore: string[] = []): DirectoryNode | undefined {
    if (this.signal.aborted) return undefined;
    let child = this.children.get(path);
    if (child === undefined) {
      child = new DirectoryNode(path, this.load, this.watch, this.failed, this.signal, restore);
      child.automatic = this.automatic;
      this.children.set(path, child);
    }
    return child.open();
  }

  /**
   * Bỏ một nút con cùng tuỳ chọn khôi phục của nó.
   * Nhận: path — đường dẫn tuyệt đối của thư mục con.
   * Trả: không (hoàn tất khi mọi lượt đọc và giám sát của cây con đã kết thúc).
   */
  async collapse(path: string): Promise<void> {
    this.restore = this.restore.filter((value) => value !== path && !value.startsWith(path + "/"));
    const child = this.children.get(path);
    this.children.delete(path);
    await child?.close();
  }

  /**
   * Điều khiển việc đọc lại của cả cây con mà không kết thúc giám sát.
   * Nhận: enabled — có tự đọc lại các nút đang bẩn không.
   * Trả: không.
   */
  setAutomatic(enabled: boolean): void {
    this.automatic = enabled;
    if (enabled && this.dirty) void this.refresh();
    for (const child of this.children.values()) child.setAutomatic(enabled);
  }

  /**
   * Xếp một lần đọc lại, gộp vào việc đang chạy.
   * Nhận: không.
   * Trả: hoàn tất khi lần đọc đang chạy và các lần đọc lại đã gộp xong.
   */
  refresh(): Promise<void> {
    this.dirty = true;
    this.reading ??= this.read();
    return this.reading;
  }

  /**
   * Đọc lại nút này và mọi con đang mở.
   * Nhận: không.
   * Trả: hoàn tất khi các mức đã settled.
   */
  async refreshTree(): Promise<void> {
    await this.refresh();
    await Promise.all([...this.children.values()].map((child) => child.refreshTree()));
  }

  /**
   * Huỷ cây con đang hoạt động.
   * Nhận: không.
   * Trả: hoàn tất khi mọi lượt đọc và giám sát thuộc nút này đã kết thúc.
   */
  async close(): Promise<void> {
    this.controller.abort();
    await Promise.all([this.task, this.reading, ...[...this.children.values()].map((child) => child.close())]);
    this.children.clear();
  }

  /**
   * Vòng lặp giám sát: mỗi sự kiện đánh dấu bẩn rồi (tuỳ chế độ) đọc lại.
   * Nhận: không.
   * Trả: không — chỉ kết thúc khi tín hiệu của nút bị huỷ.
   */
  private async follow(): Promise<void> {
    try {
      for await (const _event of this.watch(this.path, this.signal)) {
        this.dirty = true;
        if (!this.initialized || this.automatic) void this.refresh();
      }
    } catch (error) {
      if (this.signal.aborted) return;
      if (!this.initialized) await this.refresh();
      const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
      if (code !== "workspace-file/watch-unsupported") this.failed(this.path, error);
    }
  }

  /**
   * Đọc một mức, gộp các yêu cầu đọc lại phát sinh trong lúc đọc.
   * Nhận: không.
   * Trả: không; mức đọc xong quyết định nút con nào còn mở và nút nào cần khôi phục.
   */
  private async read(): Promise<void> {
    const readAgain = (): boolean => this.dirty && this.automatic && !this.signal.aborted;
    try {
      do {
        this.dirty = false;
        const level = await this.load(this.path, this.signal);
        if (this.signal.aborted || level === undefined) return;
        this.initialized = true;
        const directories = new Set(
          level.entries.filter((entry) => entry.type === "directory").map((entry) => childPath(this.path, entry.name)),
        );
        for (const path of [...this.children.keys()]) if (!directories.has(path)) await this.collapse(path);
        for (const path of directories) if (this.restore.includes(path)) this.expand(path, this.restore);
        this.restore = [];
      } while (readAgain());
    } finally {
      this.reading = undefined;
    }
  }
}
