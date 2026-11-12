/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dịch vụ `ctx.sessionProjectionCache` — cache chiếu phiên bền vững: mở miền `session_projcache`
 *      lúc init, checkpoint các phiên đang sống theo cơ chế ghi-sau có TIẾT LƯU (hai ngưỡng đếm/thời
 *      gian của {@link Config}) cộng BA mốc bắt buộc (tạo phiên · `turn/end` · đóng phiên), và phục vụ
 *      dòng đã cache cho một header phiên. Mọi lượt ghi bền đều FAIL-SOFT.
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { snapshotJsonValue } from "@deepseek-ai/dsh-util-values";
import { SessionLogOffset } from "./brand.ts";
import type { SessionSeqCursor } from "./brand.ts";
import {
  currentLifecycleMatches,
  identityMatches,
  identityOf,
  lifecycleIdentityOf,
  predecessorIdentityMatches,
} from "./identity.ts";
import type { FoldIdentity } from "./identity.ts";
import { projectionCacheDomainSpec } from "./spec.ts";
import type { CheckpointIdentity, CheckpointRecord } from "./spec.ts";
import type {
  CacheContext,
  ProjectionCheckpoint,
  ProjectionSnapshot,
  SessionEvent,
  SessionHeader,
  SessionLike,
  StorageTable,
} from "./types.ts";

/**
 * Khoá chiếu được phơi qua gợi ý tiêu đề của bản ghi TIỀN NHIỆM. Vì sao chỉ một khoá: văn bản tiêu đề
 * BẤT BIẾN qua các cạnh định dạng phiên liền kề, còn cách chuẩn hoá định dạng có thể đổi nghĩa HIỆN
 * HÀNH của mọi khoá khác.
 */
const PREDECESSOR_TITLE_KEY = "title";

/**
 * Cấu hình plugin. CẢ HAI ngưỡng tiết lưu đều là lựa chọn triển khai không có giá trị đúng phổ quát, nên
 * thành phần ráp nêu chúng TƯỜNG MINH (cordis.yml); còn ba mốc ghi bắt buộc (tạo phiên · `turn/end` ·
 * đóng phiên) là CHÍNH SÁCH, không phải tham số, và luôn chạy.
 */
export interface Config {
  /** Số sự kiện đã cam kết trên mỗi phiên buộc một lượt ghi checkpoint bền giữa các mốc bắt buộc. */
  writeEveryEvents: number;
  /** Thời gian dài nhất (ms) một checkpoint bẩn được phép nằm chưa ghi giữa các mốc bắt buộc. */
  writeIntervalMs: number;
}

/** Schema cấu hình lúc chạy cho {@link Config} (nguyên văn bản gốc: số tự nhiên ≥ 1, bắt buộc cả hai). */
export const Config: z<Config> = z.object({
  writeEveryEvents: z.natural().min(1).required(),
  writeIntervalMs: z.natural().min(1).required(),
}) as unknown as z<Config>;

/** Sổ theo dõi "bẩn" của MỘT phiên: số sự kiện chưa ghi + hẹn giờ tiết lưu đang chờ. */
interface DirtyState {
  /** Số sự kiện đã cam kết kể từ lượt ghi gần nhất. */
  pending: number;
  /** Hẹn giờ của ngưỡng thời gian; `undefined` khi không có hẹn nào đang chờ. */
  timer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Dịch vụ cache chiếu phiên bền vững. Mở miền `session_projcache` lúc init, checkpoint các phiên đang
 * sống theo cơ chế ghi-sau có tiết lưu (hai ngưỡng đếm/thời gian của {@link Config}) cộng ba mốc bắt
 * buộc — tạo phiên, `turn/end`, và đóng phiên (mốc "đang sống → lạnh") — rồi phục vụ các dòng đã
 * cache cho một header phiên. Mọi lượt ghi bền đều fail-soft: lỗi chỉ ghi cảnh báo và cache tự lành ở
 * lượt ghi kế tiếp.
 */
export class SessionProjectionCache extends Service {
  /** Cấu hình đã kiểm của lần cài này. */
  config: Config;

  /** Ba seam bắt buộc: miền lưu trữ, sổ chiếu phiên, và sổ phiên. */
  static inject = ["storageDomain", "sessionProjections", "sessions"];

  /** Schema cấu hình của lớp (kernel đọc khi nạp row). */
  static Config = Config;

  /** Bảng `sessions` của miền đã mở; `undefined` cho tới khi {@link SessionProjectionCache.init} chạy xong. */
  private table?: StorageTable<string, CheckpointRecord>;

  /** Sổ "bẩn" theo TỪNG phiên — khoá là CHÍNH thể hiện phiên (một phiên đóng thì mục bị xoá). */
  private readonly dirty = new Map<SessionLike, DirtyState>();

  /**
   * Dựng dịch vụ và đăng ký nó dưới tên `sessionProjectionCache` (kernel cấp thể hiện DUY NHẤT).
   * Nhận: context cordis và cấu hình đã kiểm.
   * Trả: thể hiện dịch vụ (chưa mở miền — việc đó ở {@link SessionProjectionCache.init}).
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "sessionProjectionCache");
    this.config = config;
  }

  /**
   * Context nhìn qua đúng bề mặt mà dịch vụ gọi. Vì sao ép kiểu ở ĐÚNG ranh giới này: augment `Context`
   * của cordis bằng kiểu của TA sẽ đè kiểu thật của `dsh-session`/`dsh-session-projection` trong cùng
   * chương trình `tsc` (TS2717 — lớp lỗi 000d).
   */
  private get host(): CacheContext {
    return this.ctx as unknown as CacheContext;
  }

  /** Mở miền và cài các listener của đường ghi. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.host.storageDomain.open(projectionCacheDomainSpec);
    this.ctx.effect(() => () => domain.close(), "sessionProjectionCache.domainClose");
    this.table = domain.table<string, CheckpointRecord>("sessions");
    this.installWritePath();
  }

  /**
   * Bản ghi đã lưu của MỘT phiên, chỉ nhận khi nhân dạng log mà nó bị ràng buộc khớp `expected`. Một id
   * phiên đặt tên một CHỖ, không đặt tên một vòng đời: id được tạo lại, hoặc một kho lưu bị tráo dưới
   * một cache còn sống, không được phép để bản ghi cũ mồi trạng thái gộp từ một log KHÔNG LIÊN QUAN.
   * Đọc ĐỒNG BỘ từ trạng thái trong bộ nhớ của miền — đúng trạng thái mà mọi lượt ghi đã sửa, nên lượt
   * đọc không bao giờ đi vòng qua chuỗi ghi để tới medium.
   * Nhận: `id` — phiên cần đọc bản ghi; `expected` — nhân dạng log mà bên gọi đang giữ.
   * Trả: bản ghi khớp nhân dạng, hoặc `undefined` (vắng mặt / không liên quan).
   */
  private recordFor(id: string, expected: FoldIdentity): CheckpointRecord | undefined {
    const record = this.requireTable().get(id);
    if (record === undefined) return undefined;
    return identityMatches(record.identity, expected) ? record : undefined;
  }

  /**
   * Phép đọc LIỆT KÊ không I/O: xem nguyên giá trị thẳng từ các dòng đã lưu (chỉ khoá khớp phiên bản)
   * của bản ghi bị ràng buộc với vòng đời của bên gọi. Header là nhân chứng DUY NHẤT mà một phép liệt kê
   * có, nên bề mặt này khớp nhân dạng VÒNG ĐỜI (`formatVersion`, `createdAt`, `cwd`, `isSeeded`) chứ
   * không khớp mốc cắt thừa kế: trong CÙNG một thế hệ định dạng, mốc cắt cố định lúc fork nên nó không
   * phân biệt được vòng đời nào mà các trường kia chưa phân biệt, và một giá trị ĐÃ XEM thì không bao
   * giờ mồi phép gộp. Phép xem CŨ đúng bằng checkpoint bền gần nhất nhưng KHÔNG BAO GIỜ SAI và không bao
   * giờ đến từ log không liên quan. `asOfSeq` của nó là mốc nước THẤP NHẤT trong các dòng được phục vụ:
   * vị trí của chính bản ghi đã lưu, thứ mà header không liên hệ được với log mà bên gọi sẽ mở sau. Vì
   * vậy danh sách Session dán nhãn khối này là `cached`, và client để mọi giá trị mà Session đã kết nối
   * sinh ra THAY THẾ nó bất kể con số này nói gì.
   * Nhận: `meta` — header của phiên đang được liệt kê (nhân chứng vòng đời; KHÔNG đọc log); `keys` —
   * tuỳ chọn, các khoá chiếu mà khán giả của bên gọi yêu cầu.
   * Trả: khối đã xem, hoặc `undefined` khi không có dòng dùng được cho vòng đời này ở định dạng hiện tại.
   */
  cachedSnapshot(meta: SessionHeader, keys?: readonly string[]): ProjectionSnapshot | undefined {
    const expected = lifecycleIdentityOf(meta);
    const record = this.requireTable().get(meta.id);
    if (record === undefined || !currentLifecycleMatches(record.identity, expected)) return undefined;
    return this.viewRecord(record, keys);
  }

  /**
   * Chỉ đọc TIÊU ĐỀ của một checkpoint TIỀN NHIỆM như gợi ý liệt kê không I/O.
   *
   * Header phiên CÓ THẨM QUYỀN cấp nhân dạng vòng đời. Một checkpoint cache có thể CHẬM hơn log đó
   * nhưng không thể NHANH hơn vì mọi lượt ghi đều flush log trước, nên một tiêu đề tiền nhiệm khớp là
   * sự thật THẬT (có thể cũ) của chính Session này. Sổ đăng ký vẫn đòi đúng phiên bản dòng và schema của
   * đơn vị tiêu đề HIỆN HÀNH. Không một đơn vị tiền nhiệm nào khác được phơi ra: việc chuẩn hoá định
   * dạng có thể đổi nghĩa HIỆN HÀNH của chúng, và các đường {@link cachedSnapshot} / nạp (hydrate) vẫn
   * tiếp tục từ chối chúng.
   * Nhận: `meta` — header CÓ THẨM QUYỀN của phiên đang được liệt kê.
   * Trả: khối CHỈ-TIÊU-ĐỀ ở mốc nước của dòng tiêu đề đã lưu, hoặc `undefined` khi bản ghi là hiện
   * hành, mới hơn, không liên quan, vắng mặt, hay không tương thích với đơn vị tiêu đề.
   */
  cachedPredecessorTitle(meta: SessionHeader): ProjectionSnapshot | undefined {
    const expected = lifecycleIdentityOf(meta);
    const record = this.requireTable().get(meta.id);
    if (record === undefined || !predecessorIdentityMatches(record.identity, expected)) return undefined;
    return this.viewRecord(record, [PREDECESSOR_TITLE_KEY]);
  }

  /**
   * Xem các dòng dây được chọn như MỘT khối bị ràng buộc với mốc nước THẤP NHẤT trong các dòng được
   * phục vụ: seq mà mọi giá trị được phục vụ đã gộp QUA ÍT NHẤT. Con số là của chính bản ghi; việc một
   * bên tiêu thụ có được phép so nó với seq của một Session đang sống hay không là do BỀ MẶT phục vụ
   * khối đó quyết, không phải ở đây.
   * Nhận: `record` — bản ghi đã lưu; `keys` — tuỳ chọn, các khoá dây cần xem.
   * Trả: khối `{asOfSeq, values}`, hoặc `undefined` khi không dòng nào được phục vụ.
   */
  private viewRecord(record: CheckpointRecord, keys?: readonly string[]): ProjectionSnapshot | undefined {
    const values = this.host.sessionProjections.viewCheckpoint(record.rows, keys);
    let asOfSeq: number | undefined;
    for (const [key, row] of Object.entries(record.rows)) {
      if (!Object.hasOwn(values, key)) continue;
      if (asOfSeq === undefined || row.seq < asOfSeq) asOfSeq = row.seq;
    }
    return asOfSeq === undefined ? undefined : { asOfSeq: asOfSeq as SessionSeqCursor, values };
  }

  /**
   * Nạp (hydrate) các ô chiếu cho một Session ĐÃ CHUẨN BỊ mà không cần thêm một lượt đọc lưu trữ. Cache
   * mồi các dòng khớp; log CHÍNH XÁC được cấp sẽ đẩy mọi đơn vị tới phép cắt quan sát. KHÔNG ghi
   * checkpoint nào vì phép quan sát LOGIC có thể chứa sự kiện phục hồi chưa bền.
   * Nhận: `session` — Session CHÍNH XÁC chưa công bố mà tầng lưu giữ; `events` — tiền tố sự kiện LOGIC
   * chính xác mà phép quan sát đại diện.
   * Trả: mọi giá trị chiếu ở phép cắt sự kiện (mồi hỏng thì lùi về nạp TỪ ĐẦU, đúng như bản gốc).
   */
  hydratePrepared(session: SessionLike, events: readonly SessionEvent[]): ProjectionSnapshot {
    const record = this.recordFor(session.id, identityOf(session.header, session.inheritedEventCount));
    if (record === undefined) return this.host.sessionProjections.hydrate(session, {}, events, SessionLogOffset(0));
    try {
      return this.host.sessionProjections.hydrate(session, record.rows, events, SessionLogOffset(0));
    } catch {
      return this.host.sessionProjections.hydrate(session, {}, events, SessionLogOffset(0));
    }
  }

  /**
   * Checkpoint BỀN một phiên đang sống NGAY BÂY GIỜ (mọi mốc bắt buộc đều gọi hàm này; test và bên mang
   * cũng có thể). Phép cắt của sổ đăng ký được chụp tại ĐÚNG ranh giới này (trạng thái là tham chiếu
   * sống), rồi bản ghi của phiên bị THAY trên chuỗi ghi của miền. KHÔNG fail-soft — bên gọi trên đường
   * fail-soft tự chứa lỗi.
   * Nhận: `session` — phiên đang sống cần checkpoint.
   * Trả: promise hoàn tất SAU khi bền và phát sự kiện.
   */
  async write(session: SessionLike): Promise<void> {
    const rows = this.host.sessionProjections.checkpoint(session);
    this.markClean(session);
    if (this.host.sessions.get(session.id) === session) await this.host.sessions.flush(session);
    await this.put(session.id, identityOf(session.header, session.inheritedEventCount), rows);
  }

  /**
   * Đọc LẠNH chiếu của MỘT phiên từ log ĐẦY ĐỦ của nó. Mỗi đơn vị được mồi từ dòng cache đã kiểm nhân
   * dạng — sổ đăng ký BỎ QUA `apply` cho tiền tố đã gộp (sự kiện ở hoặc dưới `seq` của dòng) — và
   * checkpoint đã làm mới được GHI LẠI (fail-soft, bắn-rồi-quên), nên lượt đọc lạnh ĐẦU TIÊN tạo dòng
   * cache và các lượt sau mồi từ nó. Bên gọi cấp log ĐẦY ĐỦ theo thứ tự seq: dịch vụ này KHÔNG BAO GIỜ
   * hỏi tầng lưu trữ.
   * Nhận: `meta` — header phiên đã lưu (nhân chứng nhân dạng); `inheritedEventCount` — độ dài tiền tố
   * thừa kế CHÍNH XÁC cho việc khởi tạo đơn vị chiếu và nhân dạng; `events` — log đầy đủ của phiên,
   * đúng thứ tự seq.
   * Trả: phép cắt chiếu ở điểm cuối log.
   */
  coldSnapshot(meta: SessionHeader, inheritedEventCount: number, events: readonly SessionEvent[]): ProjectionSnapshot {
    const identity = identityOf(meta, inheritedEventCount);
    const restored = this.host.sessionProjections.restore(
      this.recordFor(meta.id, identity)?.rows ?? {},
      events,
      SessionLogOffset(0),
      meta,
      inheritedEventCount,
    );
    this.put(meta.id, identity, restored.checkpoint).catch((error: unknown) => {
      this.host.logger.warn(
        `session projection cache: cold-read write-back for "${meta.id}" failed (cache stays stale): ${String(error)}`,
      );
    });
    return restored.snapshot;
  }

  /**
   * Cài đường ghi: ba listener của kernel (sự kiện phiên, tạo phiên, đóng phiên) và một hiệu ứng dọn
   * mọi hẹn giờ còn chờ khi fiber unload.
   * Nhận: không.
   * Trả: không.
   */
  private installWritePath(): void {
    this.host.on("session/event", (session: SessionLike, event: SessionEvent) => {
      if (event.type === "turn/end") {
        void this.flushSoft(session, "turn/end");
        return;
      }
      const state = this.dirty.get(session) ?? { pending: 0, timer: undefined };
      this.dirty.set(session, state);
      state.pending += 1;
      if (state.pending >= this.config.writeEveryEvents) {
        void this.flushSoft(session, "count threshold");
        return;
      }
      state.timer ??= setTimeout(() => {
        void this.flushSoft(session, "interval");
      }, this.config.writeIntervalMs);
    });
    this.host.on("session/created", (session: SessionLike) => {
      void this.flushSoft(session, "create");
    });
    this.host.on("session/disposed", (session: SessionLike) => {
      void this.flushSoft(session, "detach");
      this.markClean(session);
      this.dirty.delete(session);
    });
    this.ctx.effect(() => () => {
      for (const state of this.dirty.values()) if (state.timer !== undefined) clearTimeout(state.timer);
      this.dirty.clear();
    }, "sessionProjectionCache.timers");
  }

  /**
   * MỘT lượt ghi checkpoint bền, fail-soft. Mọi bên gọi đều CHẮC CHẮN có việc: hai ngưỡng tiết lưu chỉ
   * bắn khi dòng đang BẨN (markClean xoá hẹn giờ cùng bộ đếm), còn các mốc bắt buộc ghi VÔ ĐIỀU KIỆN.
   * Nhận: `session` — phiên cần ghi; `trigger` — nhãn mốc/ngưỡng để câu cảnh báo nói đúng đường hỏng.
   * Trả: promise hoàn tất khi xong (KHÔNG BAO GIỜ ném — lỗi thành một dòng cảnh báo).
   */
  private async flushSoft(session: SessionLike, trigger: string): Promise<void> {
    try {
      await this.write(session);
    } catch (error) {
      this.host.logger.warn(
        `session projection cache: ${trigger} write for "${session.id}" failed (cache stays stale): ${String(error)}`,
      );
    }
  }

  /**
   * Đặt lại sổ "bẩn" của MỘT phiên (checkpoint của nó đang được ghi).
   * Nhận: phiên cần đặt lại.
   * Trả: không.
   */
  private markClean(session: SessionLike): void {
    const state = this.dirty.get(session);
    if (state === undefined) return;
    state.pending = 0;
    if (state.timer !== undefined) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
  }

  /**
   * Thay bản ghi đã lưu của MỘT phiên bằng nhân dạng log của nó và một ảnh chụp TÁCH RỜI của `rows`.
   * Nhận: id phiên, nhân dạng log, và các dòng checkpoint.
   * Trả: promise hoàn tất khi bản ghi đã bền; ném `TypeError` khi trạng thái đơn vị không phải JSON
   * thuần (cùng câu với bản gốc).
   */
  private async put(id: string, identity: FoldIdentity, rows: ProjectionCheckpoint): Promise<void> {
    const detached = snapshotJsonValue(rows);
    if (detached === undefined) {
      throw new TypeError(
        "projection checkpoint is not losslessly JSON-serializable (a unit state violates the plain-JSON contract)",
      );
    }
    await this.requireTable().put(id, {
      identity: identity as CheckpointIdentity,
      rows: detached as CheckpointRecord["rows"],
    });
  }

  /**
   * Lấy bảng `sessions` đã mở, hoặc nổ nếu dịch vụ chưa init (bất biến: {@link SessionProjectionCache.init}
   * gán bảng TRƯỚC khi dịch vụ trở nên inject được).
   * Nhận: không.
   * Trả: tay nắm bảng checkpoint theo phiên.
   */
  private requireTable(): StorageTable<string, CheckpointRecord> {
    if (this.table === undefined) throw new Error("session projection cache is not initialized");
    return this.table;
  }
}

/** Export mặc định — CHÍNH lớp dịch vụ (kernel nạp row theo export này). */
export default SessionProjectionCache;
