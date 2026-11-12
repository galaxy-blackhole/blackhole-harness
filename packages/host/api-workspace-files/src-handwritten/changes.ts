/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Theo dõi MỘT đích của filesystem và phát dòng thay đổi cho `changes`: mỗi thế hệ gửi `ready` sau khi
 *      watcher khởi tạo, rồi đọc siêu dữ liệu HIỆN TẠI của đích cho mọi lần mất hiệu lực (đã xếp hàng và
 *      đang sống) — bản viết lại 1:1 `WorkspaceChangeFeed` + `ChangeFollower` của gói gốc.
 */

import { Deque } from "@deepseek-ai/dsh-deque";


import { remoteFailure } from "./page.ts";
import type { FsInfo, FsTarget, WorkspaceFilesContext } from "./seams.ts";
import type { WorkspaceFileWatchFrame } from "./types.ts";

/** Một quan sát đã xếp hàng: đích đã đổi, kèm quan sát của kernel (nếu có). */
type Observation = readonly [FsTarget, unknown?];

/** Một thế hệ `changes` đang mở: các quan sát chờ ở đây tới khi bên tiêu thụ kéo. */
export class ChangeFollower {
  /** Giải phóng thế hệ khỏi sổ của feed (do feed cấp). */
  private readonly release: () => void;

  /** Huỷ thế hệ (cả watcher lẫn vòng đọc). */
  readonly controller = new AbortController();

  /** Chờ watcher được khởi tạo để có hàm bỏ theo dõi. */
  readonly initialized = Promise.withResolvers<(() => Promise<void>) | undefined>();

  /** Lỗi làm hỏng thế hệ (nếu có). */
  error?: Error;

  /** Hàng đợi quan sát. */
  private readonly queue = new Deque<Observation>();

  /** Hàm đánh thức vòng đọc đang chờ. */
  private wake?: () => void;

  /** Thế hệ đã đóng chưa. */
  private closed = false;

  /** Promise đóng (giữ để `close()` gọi nhiều lần vẫn cùng một kết quả). */
  private closing?: Promise<void>;

  /**
   * @param release - hàm giải phóng thế hệ khỏi sổ của feed.
   */
  constructor(release: () => void) {
    this.release = release;
  }

  /** Thế hệ đã ngừng nhận mất hiệu lực hay chưa. */
  get isClosed(): boolean {
    return this.closed;
  }

  /**
   * Xếp MỘT quan sát (bỏ qua khi đã đóng).
   * Nhận: quan sát.
   * Trả: không.
   */
  push(observed: Observation): void {
    if (this.closed) return;
    this.queue.pushBack(observed);
    this.wake?.();
  }

  /**
   * Đóng thế hệ: bỏ theo dõi, giải phóng khỏi sổ, huỷ controller. Gọi nhiều lần trả CÙNG một promise.
   * Nhận: không.
   * Trả: promise hoàn tất khi đã đóng.
   */
  close(): Promise<void> {
    if (this.closing !== undefined) return this.closing;
    this.closed = true;
    this.closing = this.initialized.promise
      .then((unwatch) => unwatch?.())
      .finally(this.release);
    this.controller.abort();
    this.wake?.();
    return this.closing;
  }

  /**
   * Đánh dấu thế hệ hỏng và huỷ nó.
   * Nhận: lỗi.
   * Trả: không.
   */
  fail(error: Error): void {
    this.error = error;
    this.controller.abort();
  }

  /** Đọc tới khi đóng hoặc huỷ; phần còn xếp hàng lúc đó bị BỎ cùng thế hệ. */
  async *read(): AsyncGenerator<Observation> {
    while (!this.closed) {
      const observed = this.queue.popFront();
      if (observed !== undefined) {
        yield observed;
        continue;
      }
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
      this.wake = undefined;
    }
    if (this.error !== undefined) throw this.error;
  }
}

/** Sở hữu watcher theo đích, quan sát có gắn nhãn, và MỌI thế hệ `changes` đang mở. */
export class WorkspaceChangeFeed {
  /** Context của plugin (filesystem + logger + on/effect). */
  private readonly ctx: WorkspaceFilesContext;

  /** Các thế hệ đang mở. */
  private readonly followers = new Set<ChangeFollower>();

  /**
   * @param ctx - context Host mang filesystem mà các quan sát đến từ đó.
   */
  constructor(ctx: WorkspaceFilesContext) {
    this.ctx = ctx;
    ctx.on("fs/observed", (target, observation) => {
      for (const follower of this.followers) follower.push([target, observation]);
    });
    ctx.effect(
      () => async () => {
        const followers = [...this.followers];
        await Promise.all(followers.map((follower) => follower.close()));
        this.followers.clear();
      },
      "workspace-files.changes",
    );
  }

  /**
   * Mở MỘT watcher theo đích; đích là THƯ MỤC phải nằm trong `workspaceRoot`.
   * Nhận: gốc workspace, đường dẫn đích (giải tương đối theo gốc), và tín hiệu huỷ của thế hệ.
   * Trả: `ready` sau khi bắt đầu theo dõi, rồi siêu dữ liệu hiện tại cho mọi lần mất hiệu lực của đích.
   */
  async *follow(workspaceRoot: string, path: string, signal: AbortSignal): AsyncGenerator<WorkspaceFileWatchFrame> {
    signal.throwIfAborted();
    const follower = new ChangeFollower(() => {
      signal.removeEventListener("abort", cancel);
      this.followers.delete(follower);
    });
    signal = AbortSignal.any([signal, follower.controller.signal]);
    const aborted = (): boolean => signal.aborted;
    const cancel = (): void => {
      follower.close().catch((error: unknown) => {
        this.ctx.logger.error(error);
      });
    };
    signal.addEventListener("abort", cancel, { once: true });
    this.followers.add(follower);
    let unwatch: (() => Promise<void>) | undefined;
    try {
      const root = await this.ctx.fs.resolve(workspaceRoot, { signal }).catch((error: unknown) => {
        if (aborted()) return undefined;
        throw error;
      });
      if (root === undefined || aborted() || follower.isClosed) return;
      const target = await this.ctx.fs
        .resolve(path, { cwd: workspaceRoot, signal })
        .catch((error: unknown) => {
          if (aborted()) return undefined;
          throw error;
        });
      if (target === undefined || aborted()) return;
      const stat = async (): Promise<FsInfo | undefined> => {
        const info = await this.ctx.fs.stat(target, signal).catch((error: unknown) => {
          if (aborted()) return undefined;
          throw error;
        });
        if (info?.type === "directory" && !this.ctx.fs.contains(root, target)) {
          throw remoteFailure("workspace-file/outside-workspace", "Directory is outside the workspace", { path });
        }
        return info;
      };
      await stat();
      if (aborted()) return;
      try {
        unwatch = await this.ctx.fs.watch(
          target,
          (error) => {
            if (error !== undefined) follower.fail(error);
            else if (!follower.isClosed) follower.push([target]);
          },
          signal,
        );
        if (follower.error !== undefined) throw follower.error;
      } catch (error) {
        if (aborted() && follower.error === undefined) return;
        const failure = follower.error ?? error;
        throw remoteFailure(
          "workspace-file/watch-unsupported",
          failure instanceof Error ? failure.message : String(failure),
          { path },
        );
      }
      follower.initialized.resolve(unwatch);
      if (aborted()) return;
      yield { kind: "ready" };
      for await (const [observed] of follower.read()) {
        if (observed.targetKey !== target.targetKey) continue;
        const info = await stat();
        if (aborted()) return;
        const absolutePath = this.ctx.fs.processPath(target);
        yield {
          kind: "change",
          change:
            info !== undefined
              ? { absolutePath, version: info.version }
              : { absolutePath, absent: true as const },
        };
      }
    } finally {
      follower.initialized.resolve(unwatch);
      await follower.close();
    }
  }
}
