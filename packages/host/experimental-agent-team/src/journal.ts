/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Giao dịch Team tuần tự trên ĐÚNG log Session gốc của Lead: TeamJournal (state/transact/appendAndFlush) — port 1:1 lib/types/journal.js.
 */
import type { Context } from "@deepseek-ai/cordis";

import type { TeamEventType, TeamState } from "./projection.ts";
import type { RootTeam } from "./team-seams.ts";

/** Sở hữu thứ tự giao dịch theo từng Lead + phát sự kiện Team đã commit. */
export class TeamJournal {
  /** Context có service sessions/sessionProjections. */
  private readonly ctx: Context;
  /** Thông báo đồng bộ sau khi flush sự kiện Team thành công. */
  private readonly onCommit: (root: RootTeam) => void;
  /** Đuôi tuần tự theo danh tính Lead. */
  private readonly tails = new Map<string, Promise<void>>();

  /**
   * Dựng journal.
   * Nhận: ctx — context có sessions/sessionProjections; onCommit — thông báo sau khi flush. Trả: không.
   */
  constructor(ctx: Context, onCommit: (root: RootTeam) => void) {
    this.ctx = ctx;
    this.onCommit = onCommit;
  }

  /**
   * Đọc trạng thái Team chuẩn tắc cho một Lead đang sống.
   * Nhận: root — Lead của Team. Trả: trạng thái đã chiếu.
   */
  state(root: RootTeam): TeamState {
    const projections = (this.ctx as unknown as { sessionProjections: { stateOf(session: unknown, key: string): unknown } }).sessionProjections;
    const projection = projections.stateOf(root.session, "agentTeam") as (TeamState & { readonly failure?: string }) | undefined;
    if (projection === undefined) throw new Error("Agent Teams projection is not registered");
    if (projection.failure !== undefined) throw new Error(projection.failure);
    return projection;
  }

  /**
   * Tuần tự hoá một thao tác biến đổi của Lead.
   * Nhận: rootId — Lead chọn hàng đợi; operation — thao tác đọc-kiểm-ghi đầy đủ. Trả: kết quả thao tác.
   */
  async transact<T>(rootId: string, operation: () => Promise<T>): Promise<T> {
    const prior = this.tails.get(rootId) ?? Promise.resolve();
    const run = prior.then(operation, operation);
    const tail = run.then(() => undefined, () => undefined);
    this.tails.set(rootId, tail);
    try {
      return await run;
    } finally {
      if (this.tails.get(rootId) === tail) this.tails.delete(rootId);
    }
  }

  /**
   * Ghi + checkpoint MỘT sự kiện Team của Lead trước khi phát.
   * Nhận: root — Lead; type — phân biệt sự kiện; data — payload tương ứng. Trả: không.
   */
  async appendAndFlush(root: RootTeam, type: TeamEventType, data: unknown): Promise<void> {
    const session = root.session as unknown as { append(type: string, data: unknown): void };
    const append = session.append.bind(session);
    append(type, data);
    await (this.ctx as unknown as { sessions: { flush(session: unknown): Promise<void> } }).sessions.flush(root.session);
    this.onCommit(root);
  }
}