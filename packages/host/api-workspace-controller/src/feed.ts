/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Dòng Workspace an toàn khi kết nối lại — port 1:1 `lib/types/feed.js` của stock
 *      @deepseek-ai/dsh-api-workspace-controller (lib/index.js dòng 10–195): chiếu một Workspace thành
 *      WorkspaceView, feed quan sát miền và phát baseline + increment, thế hệ follow có hàng đợi riêng.
 */

import type { Context } from "@deepseek-ai/cordis";
import { Deque } from "@deepseek-ai/dsh-deque";
import type { DomainChanged } from "@galaxy-blackhole/gbh-storage-domain";
import {
  WorkspaceId,
  workspaceDomainState,
  workspaceRecord,
  type Workspace,
} from "@galaxy-blackhole/gbh-workspace";

import type { WorkspaceBaseline, WorkspaceFollowFrame, WorkspaceView } from "./types.ts";
import { workspaceRegistryOf, type WorkspaceRegistryLike } from "./workspace-seam.ts";

/** Các frame feed phát ra: mọi frame follow trừ `replace` (chỉ đường lọc quyền mới gửi). */
type WorkspaceFeedFrame = Exclude<WorkspaceFollowFrame, { readonly type: "replace" }>;

/**
 * Chiếu MỘT thực thể Workspace có thẩm quyền thành giá trị Remote.
 * @param workspace - thực thể do sổ đăng ký cấp.
 * @returns bản chiếu Workspace tách rời cho bên tiêu thụ Remote.
 */
export function workspaceView(workspace: Workspace): WorkspaceView {
  return {
    workspaceId: workspace.id,
    path: workspace.path,
    title: workspace.title,
    sessionIds: [...workspace.sessionIds],
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

/**
 * Chiếu một bản ghi Workspace ĐÃ LƯU (giá trị của `domain/changed`) thành giá trị Remote.
 * Bản gốc là helper nội bộ; gói này xuất để test đối chiếu dùng lại, hành vi y nguyên.
 * @param workspaceId - khoá của bản ghi vừa đổi.
 * @param value - giá trị thô của thay đổi miền.
 * @returns bản chiếu Workspace sau khi `workspaceRecord` kiểm giá trị.
 */
export function changedWorkspaceView(workspaceId: string, value: unknown): WorkspaceView {
  const record = workspaceRecord.parse(value);
  return {
    workspaceId: WorkspaceId(workspaceId),
    path: record.path,
    title: record.title,
    sessionIds: [...record.sessionIds],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Sở hữu quan sát miền Workspace và MỌI thế hệ follow đang mở.
 * Nhận: context Host mang `this.registry` (seam workspaceRegistry) và sổ đăng ký Workspace.
 * Trả: không — lớp giữ context, bản chụp mới nhất và các thế hệ follow.
 */
export class WorkspaceFeed {

  /**
   * Sổ workspace đọc qua SEAM CẤU TRÚC (ADR 000d — PHASE B 08/11/2026); thiếu seam là lỗi cấu hình nên nổ NGAY.
   * Nhận: không. Trả: seam sổ workspace của kernel.
   */
  private get registry(): WorkspaceRegistryLike {
    return workspaceRegistryOf(this.ctx);
  }
  /** Các thế hệ follow đang mở. */
  private readonly followers = new Set<WorkspaceFollower>();

  /** Tập id Workspace đã biết (dạng chuỗi). */
  private knownIds: Set<string>;

  /** Thứ tự Workspace đã biết (dạng chuỗi), để phát `order` khi đổi. */
  private order: string[];

  /** Tập phiên đã lưu trữ đã biết (dạng chuỗi). */
  private archived: string[];

  /** Tập phiên đã ghim đã biết (dạng chuỗi). */
  private pinned: string[];

  /** @param ctx - Context Host chứa sổ đăng ký Workspace có thẩm quyền. */
  constructor(private readonly ctx: Context) {
    const baseline = this.registry.list();
    this.knownIds = new Set(baseline.map((workspace) => String(workspace.id)));
    this.order = baseline.map((workspace) => String(workspace.id));
    this.archived = this.registry.archivedSessionIds.map(String);
    this.pinned = this.registry.pinnedSessionIds.map(String);
    ctx.on("domain/changed", (change) => {
      this.changed(change);
    });
    ctx.effect(
      () => () => {
        for (const follower of this.followers) follower.close();
        this.followers.clear();
      },
      "workspace-controller.feed",
    );
  }

  /**
   * Đọc đồng bộ toàn bộ bản chiếu hiện tại.
   * @returns mọi Workspace đang hoạt động kèm định danh phiên đã lưu trữ và đã ghim.
   */
  baseline(): WorkspaceBaseline {
    return {
      items: this.registry.list().map(workspaceView),
      archivedSessionIds: [...this.registry.archivedSessionIds],
      pinnedSessionIds: [...this.registry.pinnedSessionIds],
    };
  }

  /**
   * Mở MỘT thế hệ, bắt đầu bằng baseline đầy đủ.
   * @param signal - huỷ thế hệ.
   * @returns baseline rồi tới các increment Workspace có thứ tự.
   */
  async *follow(signal: AbortSignal): AsyncIterable<WorkspaceFeedFrame> {
    signal.throwIfAborted();
    const follower = new WorkspaceFollower();
    this.followers.add(follower);
    try {
      yield {
        type: "baseline",
        value: this.baseline(),
      };
      yield* follower.read(signal);
    } finally {
      this.followers.delete(follower);
      follower.close();
    }
  }

  /** Dịch MỘT thay đổi miền thành frame và phát cho mọi thế hệ đang mở. */
  private changed(change: DomainChanged): void {
    if (change.domain !== "workspace") return;
    if (change.table === "") {
      if (change.operation !== "put") return;
      const state = workspaceDomainState.parse(change.value);
      const nextOrder = state.workspaceIds.map(String);
      const orderChanged = !sameStrings(this.order, nextOrder);
      for (const id of state.workspaceIds) {
        if (this.knownIds.has(id)) continue;
        const workspace = this.registry.get(id);
        if (workspace === undefined) {
          throw new Error(`committed Workspace registry references missing Workspace "${id}"`);
        }
        this.knownIds.add(id);
        this.publish({
          type: "upsert",
          workspace: workspaceView(workspace),
        });
      }
      this.order = nextOrder;
      if (orderChanged) {
        this.publish({
          type: "order",
          workspaceIds: [...state.workspaceIds],
        });
      }
      const nextArchived = state.archivedSessionIds.map(String);
      if (!sameStrings(this.archived, nextArchived)) {
        this.archived = nextArchived;
        this.publish({
          type: "archived",
          archivedSessionIds: [...state.archivedSessionIds],
        });
      }
      const nextPinned = state.pinnedSessionIds.map(String);
      if (!sameStrings(this.pinned, nextPinned)) {
        this.pinned = nextPinned;
        this.publish({
          type: "pinned",
          pinnedSessionIds: [...state.pinnedSessionIds],
        });
      }
      return;
    }
    if (change.table !== "workspaces") return;
    if (change.operation === "deleted") {
      if (!this.knownIds.delete(change.key)) return;
      this.publish({
        type: "remove",
        workspaceId: WorkspaceId(change.key),
      });
      return;
    }
    if (!this.knownIds.has(change.key)) return;
    this.publish({
      type: "upsert",
      workspace: changedWorkspaceView(change.key, change.value),
    });
  }

  /** Đẩy MỘT frame vào hàng đợi của mọi thế hệ đang mở. */
  private publish(frame: WorkspaceFeedFrame): void {
    for (const follower of this.followers) follower.push(frame);
  }
}

/**
 * So sánh hai mảng chuỗi theo đúng thứ tự (độ dài bằng nhau và từng phần tử bằng nhau).
 * @param left - mảng bên trái.
 * @param right - mảng bên phải.
 * @returns `true` khi hai mảng bằng nhau từng vị trí.
 */
export function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** Một thế hệ `follow` đang mở: các frame chờ trong hàng đợi riêng tới khi bên tiêu thụ kéo. */
export class WorkspaceFollower {
  /** Hàng đợi frame của thế hệ này. */
  private readonly frames = new Deque<WorkspaceFeedFrame>();

  /** Hàm đánh thức vòng đọc đang chờ (mỗi lúc chỉ một vòng đọc sở hữu). */
  private waiting?: () => void;

  /** Thế hệ đã đóng chưa. */
  private closed = false;

  /**
   * Đẩy MỘT frame vào hàng đợi (bỏ qua nếu thế hệ đã đóng).
   * @param frame - frame cần phát cho thế hệ.
   */
  push(frame: WorkspaceFeedFrame): void {
    /* v8 ignore next -- closed followers are removed before later publication can reach them. */
    if (this.closed) return;
    this.frames.pushBack(frame);
    this.waiting?.();
  }

  /** Đóng thế hệ và đánh thức vòng đọc đang chờ (gọi nhiều lần vô hại). */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.waiting?.();
  }

  /**
   * Đọc các frame của thế hệ tới khi đóng hoặc bị huỷ.
   * @param signal - huỷ thế hệ.
   * @returns từng frame theo đúng thứ tự đã phát.
   */
  async *read(signal: AbortSignal): AsyncIterable<WorkspaceFeedFrame> {
    while (!this.closed && !signal.aborted) {
      const frame = this.frames.popFront();
      if (frame !== undefined) {
        yield frame;
        continue;
      }
      await this.wait(signal);
    }
  }

  /** Chờ MỘT frame kế tiếp, một lần huỷ, hoặc một lần đóng. */
  private wait(signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        signal.removeEventListener("abort", finish);
        /* v8 ignore next -- one read owns the sole installed wait callback. */
        if (this.waiting === finish) this.waiting = undefined;
        resolve();
      };
      this.waiting = finish;
      signal.addEventListener("abort", finish, { once: true });
      /* v8 ignore next -- native signals and the private queue cannot change during this synchronous setup. */
      if (signal.aborted || this.closed || this.frames.size > 0) finish();
    });
  }
}
