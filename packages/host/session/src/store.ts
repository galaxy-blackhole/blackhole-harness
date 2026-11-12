/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Sổ phiên TRONG BỘ NHỚ (`ctx.sessions`) — port 1:1 `lib/index.js` dòng 1714–2050 của
 *      `@deepseek-ai/dsh-session`: class `SessionStore extends Service` với TOÀN BỘ field/method
 *      (create · prepare · enter · announce · emitDisposed · flush · get · list · fork …), dùng registry
 *      đính kèm của `./events.ts` và carrier phạm vi của `dsh-scope` (`scopeTarget` + `scopeOf`).
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import { brandString } from "@galaxy-blackhole/gbh-brand";
// 08/11/2026 (P0): phải dùng ĐÚNG module mà 17 gói khác dùng (agent-loop TẠO scope, agent-preset-registry ĐỌC).
//   `gbh-scope` là bản copy 1:1 nhưng là MODULE INSTANCE khác ⇒ `Symbol("dsh.scope")` khác ⇒ `scopeOf(ctx)` = undefined
//   ⇒ "Agent preset binding requires a scoped context" ⇒ session/create 200 nhưng ok:false ⇒ không có phiên/agent.
//   §2b: seam kernel giữ id stock.
import { scopeOf, scopeTarget } from "@deepseek-ai/dsh-scope";
import { assertNever } from "@galaxy-blackhole/gbh-util-values";
import {
  attachments,
  collectSessionCallbacks,
  invokeContainedSessionObservers,
} from "./events.ts";
import type { SessionAttachment } from "./events.ts";
import { buildForkSeed } from "./fork.ts";
import { Session, SessionForkError } from "./session.ts";
import type { SessionMessageProjection } from "./surface.ts";
import { SessionLogOffset } from "./types.ts";
import type {
  CreateSessionOptions,
  PrepareSessionOptions,
  SessionEvent,
  SessionHeader,
  SessionId,
  SessionSeq,
} from "./types.ts";

/** Nguồn fork: đối tượng session ĐANG SỐNG, hoặc id của nó trong sổ phiên. */
export type SessionForkSource = Session | SessionId;

/**
 * Một mục ĐANG SỐNG trong sổ phiên — CHÍNH hình dạng mà `./events.ts` khai cho registry đính kèm, nên
 * `Session` và sổ đọc/ghi CÙNG một kiểu (một `WeakMap` cho cả tiến trình, không khai lại hình dạng).
 */
export type SessionEntry = SessionAttachment;

/** Phần bề mặt typert mà constructor của sổ đăng ký (khai theo CẤU TRÚC: KHÔNG augment module nào). */
interface TypertSurface {
  /** Dịch vụ typert của kernel. */
  readonly typert: {
    /** Sổ tra cứu: biến một danh tính dây thành vật thể host. */
    readonly lookups: {
      /**
       * Đăng ký một sổ tra cứu theo tên.
       * Nhận: `name` — tên tra cứu; `lookup` — mô tả tra cứu (tham số, dây, tài nguyên, dấu kiểu).
       * Trả: không dùng (dịch vụ tự quản việc gỡ).
       */
      register(name: string, lookup: TypertLookupRegistration): unknown;
    };
  };
}

/** Một mục đăng ký trong sổ tra cứu typert cho `session`. */
interface TypertLookupRegistration {
  /** Tên tham số trên dây. */
  readonly parameter: string;
  /** Trường mang danh tính trên dây. */
  readonly wire: string;
  /** Loại tài nguyên mà danh tính trỏ tới. */
  readonly resource: string;
  /** Dấu kiểu phía host (chuỗi, vì typert đọc lúc chạy). */
  readonly hostTypeSymbol: string;
  /** Dấu kiểu phía dây. */
  readonly wireTypeSymbol: string;
  /** Giải một danh tính dây thành phiên đang sống. */
  readonly resolve: (sessionId: SessionId) => Session | undefined;
}

/**
 * Sổ phiên trong bộ nhớ (`ctx.sessions`).
 *
 * Việc GHI BỀN cố ý KHÔNG nằm ở đây — vòng đời agent gắn một writer session-log vào write handle của
 * từng phiên đã công bố; một phiên công bố ngoài vòng đời đó thì không ghi bền gì.
 *
 * Nhận: `ctx` — context host mà plugin được nạp vào.
 * Trả: không (thực thể service đã đăng ký dưới tên `sessions`).
 */
export class SessionStore extends Service {
  /** Phiên ĐANG SỐNG theo id, theo thứ tự tạo (Map giữ thứ tự chèn). */
  private readonly store = new Map<SessionId, SessionEntry>();

  /** Bộ đếm cấp id tự động `session-<n>`. */
  private counter = 0;

  /** Định nghĩa VAY MƯỢN cho replay tách rời; đóng góp sống tới khi fiber đăng ký nó unload. */
  private readonly projections: SessionMessageProjection[] = [];

  /** Định nghĩa vay mượn cho replay tách rời; đóng góp sống tới khi fiber đăng ký nó unload. */
  get messageProjections(): readonly SessionMessageProjection[] {
    return this.projections;
  }

  /**
   * Đăng ký MỘT bộ diễn giải sự kiện cho lúc tạo, khôi phục và fork.
   * Gỡ đóng góp làm các phiên đã dùng nó từ chối mọi phép suy dẫn tiếp theo.
   * Nhận: `projection` — định nghĩa THUẦN do plugin của sự kiện sở hữu.
   * Trả: disposer thuộc sở hữu fiber.
   * Ném: khi một định nghĩa khác đã chiếm loại sự kiện này.
   */
  registerMessageProjection(projection: SessionMessageProjection): () => Promise<void> {
    if (this.projections.some((item) => item.type === projection.type))
      throw new Error(`session message projection "${projection.type}" is already registered`);
    return this.ctx.effect(() => {
      this.projections.push(projection);
      return () => {
        this.projections.splice(this.projections.indexOf(projection), 1);
      };
    }, "sessions.registerMessageProjection()");
  }

  /**
   * Đăng ký dịch vụ `sessions` vào context của plugin, kèm sổ tra cứu typert `session` (một danh tính
   * dây `sessionId` → phiên đang sống).
   * Nhận: `ctx` — context host mà plugin được nạp vào.
   * Trả: không (thực thể service đã đăng ký tên `sessions`).
   */
  constructor(ctx: Context) {
    super(ctx, "sessions");
    ctx.inject(["typert"], (typeCtx) => {
      const { typert } = typeCtx as unknown as TypertSurface;
      typert.lookups.register("session", {
        parameter: "session",
        wire: "sessionId",
        resource: "session",
        // review-4 (08/11): identity typert của TA — khớp typeSymbol GBH mà session-reference/src/typert-host.ts khai.
        hostTypeSymbol: "@galaxy-blackhole/gbh-session#Session",
        wireTypeSymbol: "@galaxy-blackhole/gbh-session/types#SessionId",
        resolve: (sessionId) => this.get(sessionId),
      });
    });
  }

  /**
   * Tạo một phiên THUỘC SỞ HỮU của fiber đang gọi: gỡ fiber đó sẽ dừng phát sự kiện và bỏ phiên khỏi
   * sổ. `options.seed` nạp phiên bằng BẢN SAO của các sự kiện đó (replay/fork); `options.meta` gắn
   * metadata tạo (cwd tuyệt đối đã kiểm, dòng dõi seed + cha, và độ sâu uỷ thác) làm {@link SessionHeader}
   * BẤT BIẾN (sổ điền `version`/`id`/`createdAt`).
   *
   * Với agent mà phiên của nó phải được dỡ ĐÚNG THỨ TỰ với vòng chạy (để sự kiện cuối của vòng được
   * công bố TRƯỚC khi đính kèm sổ kết thúc), ĐỪNG dùng hàm này — hãy gộp vòng đời phiên vào chính
   * effect của agent qua {@link prepare} + {@link enter} + {@link announce}.
   *
   * Nhận: `id` — id phiên; vắng thì sổ cấp `session-<n>`; `options` — sự kiện seed và/hoặc metadata.
   * Trả: phiên đang sống, ĐÃ enter và announce.
   * Ném: nếu phiên cùng `id` đã tồn tại, metadata không phải bản ghi JSON không mất mát với các trường
   * vô hướng hợp lệ, hoặc `meta.cwd` không phải đường dẫn tuyệt đối.
   */
  create(id?: SessionId, options?: CreateSessionOptions): Session {
    const session = this.prepare(id, options);
    this.ctx.effect(
      function* (this: SessionStore) {
        yield this.enter(session);
        this.announce(session);
      }.bind(this),
      "sessions.create()",
    );
    return session;
  }

  /**
   * Dựng một phiên MÀ KHÔNG enter vào sổ — kiểm id/cwd rồi dựng {@link Session} (kèm {@link SessionHeader}
   * BẤT BIẾN). Cặp với {@link enter} + {@link announce}: bên gọi sở hữu một `ctx.effect` phức hợp (nhà
   * máy agent) gộp vòng đời phiên vào MỘT effect đó, để một lần unload fiber dỡ phiên + agent thành MỘT
   * chuỗi ĐÚNG THỨ TỰ thay vì hai effect anh em tranh nhau — thứ sẽ gỡ hook công bố trước khi sự kiện
   * đóng của driver cam kết, làm rơi chúng.
   *
   * Nhận: `id` — id phiên; vắng thì sổ cấp `session-<n>`; `options` — sự kiện seed và/hoặc metadata.
   * Với `eventState`, mỗi sự kiện seed hoặc thuộc sở hữu riêng, hoặc mọi giá trị chia sẻ đã đông cứng
   * sâu; {@link Session.fromRestore} kiểm rồi nhận nuôi các giá trị đó mà không sao chép hay đông cứng.
   * Trả: phiên đã dựng, CHƯA nằm trong sổ.
   * Ném: nếu phiên cùng `id` đã tồn tại, metadata không phải bản ghi JSON không mất mát, hoặc
   * `meta.cwd` không phải đường dẫn tuyệt đối.
   */
  prepare(id?: SessionId, options?: PrepareSessionOptions): Session {
    let sessionId: SessionId;
    if (id === undefined) {
      do {
        sessionId = brandString<SessionId>(`session-${++this.counter}`);
      } while (this.store.has(sessionId));
    } else {
      sessionId = brandString(id);
    }
    if (this.store.has(sessionId)) throw new Error(`session "${sessionId}" already exists`);
    if (options !== undefined) {
      const { eventState } = options;
      switch (eventState) {
        case "detached":
        case "shared-frozen":
          return Session.fromRestore(
            sessionId,
            options.seed,
            options.meta,
            options.inheritedEventCount,
            eventState,
            this.projections,
          );
        case undefined:
          break;
        /* v8 ignore next -- closed-union exhaustiveness guard */
        default:
          assertNever(eventState, "SessionStore.prepare event state");
      }
    }
    const seed = options?.seed;
    const meta = options?.meta;
    const header: SessionHeader = {
      version: 4,
      id: sessionId,
      createdAt: meta?.createdAt ?? Date.now(),
      ...(meta?.cwd === undefined ? {} : { cwd: meta.cwd }),
      ...(meta?.parentSession === undefined ? {} : { parentSession: meta.parentSession }),
      isSeeded: meta?.isSeeded ?? false,
      ...(meta?.origin === undefined ? {} : { origin: meta.origin }),
      ...(meta?.delegationDepth === undefined ? {} : { delegationDepth: meta.delegationDepth }),
      ...(meta?.agentPreset === undefined ? {} : { agentPreset: meta.agentPreset }),
    };
    return Session.create(sessionId, seed, header, options?.inheritedEventCount, this.projections);
  }

  /**
   * Enter một phiên ĐÃ {@link prepare} vào sổ: cài hook công bố append (module-private, nằm trong registry
   * đính kèm của `./events.ts`) và thêm nó vào sổ. Trả DETACH disposer (hook + bỏ khỏi sổ). KHÔNG phát
   * `session/created` — bên gọi yield disposer này trong effect của mình RỒI mới gọi {@link announce},
   * để một listener `session/created` ném lỗi cuộn ngược phần đính kèm thay vì làm rò nó.
   *
   * Kiểm LẠI id trùng: `prepare` và `enter` là primitive công khai liên gói, bên gọi có thể xen việc
   * tuỳ ý (hoặc một lần create khác) giữa chúng, nên một phiên đã prepare TỪ LÂU KHÔNG được ghi đè mục
   * đang sống cùng id — disposer detach của nó sau đó sẽ xoá NHẦM phiên thật.
   *
   * Nhận: `session` — phiên ĐÃ {@link prepare}, chưa nằm trong sổ.
   * Trả: detach disposer (hook công bố + bỏ khỏi sổ). Khi gọi từ một listener `session/created` đồng bộ,
   * việc bỏ + dỡ chờ tới lúc lần phát tạo đó khép lại.
   * Ném: nếu sổ đã có phiên cùng id.
   */
  enter(session: Session): () => void {
    const id = session.id;
    const carrier = scopeTarget(session, scopeOf(this.ctx));
    if (this.store.has(id)) throw new Error(`session "${id}" already exists`);
    if (attachments.has(session)) throw new Error(`session "${id}" is already attached to a store`);
    const entry: SessionEntry = {
      id,
      session,
      carrier,
      emitCtx: this.ctx,
      announced: false,
      announcing: false,
      appending: false,
      detachRequested: false,
      detach: () => {
        this.detachEntered(entry);
      },
    };
    this.store.set(id, entry);
    attachments.set(session, entry);
    let entered = true;
    const detach = (): void => {
      if (!entered) return;
      entered = false;
      if (entry.announcing || entry.appending) {
        entry.detachRequested = true;
        return;
      }
      entry.detach();
    };
    return detach;
  }

  /**
   * Bỏ ĐÚNG một mục đã enter khỏi sổ và phát thông báo dỡ đi kèm khi nó đã được announce.
   * Nhận: `entry` — mục cần bỏ.
   * Trả: không.
   */
  private detachEntered(entry: SessionEntry): void {
    entry.detachRequested = false;
    /* v8 ignore next -- enter() rejects replacement while this single-shot detach capability is live. */
    if (this.store.get(entry.id) !== entry) return;
    this.store.delete(entry.id);
    attachments.delete(entry.session);
    if (entry.announced) this.emitDisposed(entry);
  }

  /**
   * Phát `session/created` ĐÚNG MỘT lần cho một phiên ĐÃ {@link enter} (với carrier mà {@link enter} đã
   * chụp). Tách khỏi {@link enter} để bên gọi yield disposer detach trước (an toàn cuộn ngược — xem
   * {@link enter}).
   * Nhận: `session` — phiên đã enter cần announce cho listener.
   * Trả: không.
   * Ném: nếu phiên không sống hoặc việc announce đã bắt đầu, kể cả lời gọi tái nhập từ listener tạo.
   */
  announce(session: Session): void {
    const entry = this.liveEntryFor(session);
    if (entry.announced || entry.announcing) throw new Error(`session "${entry.id}" was already announced`);
    entry.announced = true;
    const callbackArgs = [session];
    entry.announcing = true;
    try {
      const callbacks = collectSessionCallbacks(this.ctx, [entry.carrier, "session/created", session]);
      for (const callback of callbacks) {
        const returned = callback(...callbackArgs);
        Promise.resolve(returned).catch((error: unknown) => {
          this.ctx.logger.warn(`session "${entry.id}": session/created listener rejected: ${String(error)}`);
        });
      }
    } finally {
      entry.announcing = false;
      if (entry.detachRequested && !entry.appending) entry.detach();
    }
  }

  /**
   * Phát thông báo dỡ đi kèm với cách ly theo TỪNG listener.
   * Nhận: `entry` — mục vừa rời sổ.
   * Trả: không.
   */
  private emitDisposed(entry: SessionEntry): void {
    const callbackArgs = [entry.session];
    try {
      const callbacks = collectSessionCallbacks(this.ctx, [entry.carrier, "session/disposed", entry.session]);
      invokeContainedSessionObservers(this.ctx, "session/disposed", entry.id, callbackArgs, callbacks);
    } catch (error) {
      this.ctx.logger.warn(`session "${entry.id}": session/disposed dispatch threw: ${String(error)}`);
    }
  }

  /**
   * Phát điểm kiểm tra bền vững `session/flush` DẠNG CHỜ ĐƯỢC cho `session`, với carrier đã chụp lúc
   * {@link enter}. ĐÂY là cửa ngõ flush DUY NHẤT: sổ sở hữu carrier, nên bên gọi (rào mỗi request của
   * chính sách checkpoint, checkpoint idle của goal-round-driver, các lần rút cạn lúc dỡ, và consumer
   * tự flush trước khi đọc lưu trữ) phải đi qua đây thay vì tự dispatch `ctx.parallel('session/flush', …)`.
   *
   * Nhận: `session` — phiên có sự kiện đệm phải tới được lưu trữ bền.
   * Trả: có ít nhất một listener ghi bền tham gia hay không, SAU KHI mọi listener đã lắng thành công.
   * Ném: lỗi của listener ĐẦU TIÊN đăng ký, sau khi mọi listener đã lắng.
   */
  async flush(session: Session): Promise<boolean> {
    const { carrier } = this.liveEntryFor(session);
    const callbackArgs = [session];
    const callbacks = collectSessionCallbacks(this.ctx, [carrier, "session/flush", session]);
    const settlement = await Promise.allSettled(
      callbacks.map((callback) => {
        try {
          return callback(...callbackArgs);
        } catch (error) {
          return Promise.reject(error);
        }
      }),
    );
    const failure = settlement.find((result) => result.status === "rejected");
    if (failure !== undefined && failure.status === "rejected") throw failure.reason;
    return callbacks.length > 0;
  }

  /**
   * Trả ĐÚNG mục đang sống; đối tượng đã detach/đã prepare bị từ chối.
   * Nhận: `session` — phiên cần tra.
   * Trả: mục đang sống của phiên đó trong sổ này.
   * Ném: khi phiên không sống trong sổ này.
   */
  private liveEntryFor(session: Session): SessionEntry {
    const entry = attachments.get(session);
    if (entry === undefined || this.store.get(entry.id) !== entry)
      throw new Error(`session "${session.id}" is not live in this store`);
    return entry;
  }

  /**
   * Tra một phiên ĐANG SỐNG.
   * Nhận: `id` — id phiên cần tra.
   * Trả: phiên đó, hoặc `undefined` khi không có phiên sống nào mang id đó.
   */
  get(id: SessionId): Session | undefined {
    return this.store.get(id)?.session;
  }

  /**
   * MỌI phiên đang sống, theo thứ tự tạo.
   * Nhận: không.
   * Trả: mảng MỚI; sửa nó không ảnh hưởng sổ.
   */
  list(): Session[] {
    return [...this.store.values()].map((entry) => entry.session);
  }

  /**
   * Tạo một phiên con ĐANG SỐNG từ ĐÚNG một tiền tố của một nguồn đang sống. `boundary` là seq sự kiện
   * nguồn BAO GỒM hai đầu; vắng nghĩa là sự kiện cuối hiện tại của nguồn. Phần đuôi còn mở nhận kết quả
   * tool tổng hợp và closer bước/lượt mang nguyên nhân `forked`. Bước và lượt ĐÃ ĐÓNG giữ nguyên, kể cả
   * các lời gọi tool hỏng đã thiếu kết quả. `inheritedEventCount` chỉ đếm sự kiện nguồn ĐÃ SAO, không
   * tính các closer này.
   *
   * Nhận: `source` — đối tượng phiên nguồn ĐANG SỐNG hoặc id của nó; `boundary` — seq sự kiện nguồn
   * (bao gồm) để fork xuyên qua, vắng thì lấy sự kiện cuối, và trên nguồn RỖNG thì fork ra con rỗng;
   * `childSessionId` — id phiên con tuỳ chọn, vắng thì giao cho chính sách cấp id của {@link SessionStore}.
   * Trả: phiên con ĐANG SỐNG đã tạo.
   * Ném: {@link SessionForkError} khi nguồn/biên/id con không hợp lệ.
   */
  fork(source: SessionForkSource, boundary?: SessionSeq, childSessionId?: SessionId): Session {
    if (childSessionId !== undefined && this.get(childSessionId) !== undefined)
      throw new SessionForkError(`session "${childSessionId}" already exists`, "SESSION_ALREADY_EXISTS");
    const liveSource = this._resolveForkSource(source);
    const events = liveSource.snapshotEvents();
    const resolved = this._forkBoundary(liveSource.id, events, boundary);
    const seed = resolved === undefined ? [] : buildForkSeed(events, resolved);
    return this.create(childSessionId, {
      seed,
      inheritedEventCount: SessionLogOffset(resolved === undefined ? 0 : resolved + 1),
      meta: {
        ...(liveSource.header.cwd !== undefined ? { cwd: liveSource.header.cwd } : {}),
        parentSession: liveSource.id,
        isSeeded: true,
      },
    });
  }

  /**
   * Giải và kiểm biên fork trên log nguồn.
   * Nhận: `sessionId` — id nguồn để log; `events` — log nguồn; `requestedBoundary` — biên do bên gọi
   * yêu cầu, vắng thì lấy seq của sự kiện cuối.
   * Trả: seq biên đã kiểm, hoặc `undefined` khi nguồn rỗng và không có biên yêu cầu.
   * Ném: {@link SessionForkError} mã `INVALID_BOUNDARY` khi biên không phải số nguyên an toàn không âm,
   * không tồn tại, hoặc không khớp một seq liền mạch.
   */
  private _forkBoundary(
    sessionId: SessionId,
    events: readonly SessionEvent[],
    requestedBoundary: SessionSeq | undefined,
  ): SessionSeq | undefined {
    const lastEvent = events.at(-1);
    let boundary: SessionSeq;
    if (requestedBoundary !== undefined) boundary = requestedBoundary;
    else {
      if (lastEvent === undefined) return undefined;
      boundary = lastEvent.seq;
    }
    if (!Number.isSafeInteger(boundary) || boundary < 0)
      throw new SessionForkError(
        `fork boundary for session "${sessionId}" must be a non-negative safe integer, got ${String(boundary)}`,
        "INVALID_BOUNDARY",
      );
    if (boundary >= events.length) {
      const lastSeq = lastEvent?.seq;
      throw new SessionForkError(
        `fork boundary ${boundary} does not exist in session "${sessionId}" (last seq: ${lastSeq ?? "none"})`,
        "INVALID_BOUNDARY",
      );
    }
    const boundaryEvent = events[boundary];
    if (boundaryEvent === undefined || boundaryEvent.seq !== boundary)
      throw new SessionForkError(
        `fork boundary ${boundary} does not match a contiguous event seq in session "${sessionId}"`,
        "INVALID_BOUNDARY",
      );
    return boundary;
  }

  /**
   * Giải nguồn fork thành ĐÚNG thực thể sống của sổ này.
   * Nhận: `source` — đối tượng phiên hoặc id.
   * Trả: chính đối tượng phiên đang sống.
   * Ném: {@link SessionForkError} mã `SESSION_NOT_FOUND` khi không có phiên sống mang id đó, hoặc
   * `SESSION_NOT_LIVE` khi đối tượng đưa vào không phải thực thể sống của sổ.
   */
  private _resolveForkSource(source: SessionForkSource): Session {
    if (typeof source === "string") {
      const session = this.get(source);
      if (session === undefined) throw new SessionForkError(`session "${source}" not found`, "SESSION_NOT_FOUND");
      return session;
    }
    const live = this.get(source.id);
    if (live === undefined) throw new SessionForkError(`session "${source.id}" not found`, "SESSION_NOT_FOUND");
    if (live !== source)
      throw new SessionForkError(`session "${source.id}" is not the live store instance`, "SESSION_NOT_LIVE");
    return source;
  }
}