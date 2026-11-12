/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Class Session — log sự kiện append-only, surface tăng dần, header bền vững, độ dài tiền tố kế
 *      thừa fork, cùng các phép append/commit/derive — và SessionForkError. Viết lại 1:1 đoạn
 *      lib/index.js dòng 1324–1713 của @deepseek-ai/dsh-session; các helper ngoài khoảng được import
 *      từ module anh em cùng gói.
 */

import type { Message, ToolHistory } from "@galaxy-blackhole/gbh-llm";
import { deepFreeze, snapshotJsonValue } from "@galaxy-blackhole/gbh-util-values";
import {
  assertPluginRecordEvent,
  assertSessionEventEnvelope,
  attachments,
  collectSessionCallbacks,
  invokeContainedSessionObservers,
  snapshotSessionHeader,
  validateRestoredSessionHeader,
} from "./events.ts";
import type { SessionAttachment } from "./events.ts";
import { foldRequestHeader } from "./request-header.ts";
import { SurfaceManager, validateSessionEventData } from "./surface.ts";
import type { SessionMessageProjection, SessionSurface } from "./surface.ts";
import { ToolHistoryProjection } from "./tool-history.ts";
import { SessionLogOffset, SessionSeq } from "./types.ts";
import type {
  EpochHeader,
  PluginRecordType,
  RequestContext,
  SessionEvent,
  SessionEventMap,
  SessionEventType,
  SessionHeader,
  SessionId,
  SessionSeedEventState,
  SurfaceEventType,
  SurfaceIntent,
} from "./types.ts";

/**
 * Khe commit bản ghi plugin của {@link Session}, được static block của chính class gán MỘT lần.
 *
 * Vì sao export: bản gốc khai `let commitPluginRecord` cùng module với `appendPluginRecord`; bản
 * viết lại tách Session sang module này nên `appendPluginRecord` (ở ./events.ts) phải đọc CÙNG một
 * binding sống. ES module cho phép đọc binding `let` đã export ở module khác, nhưng KHÔNG cho gán
 * vào nó từ ngoài — nên chỗ khai báo phải nằm ở đây, cạnh static block thực hiện phép gán.
 */
export let commitPluginRecord:
  | ((session: Session, type: PluginRecordType, data: unknown) => SessionSeq)
  | undefined;

/**
 * Một session nguồn sự kiện: log append-only gồm các {@link SessionEvent}.
 *
 * Class THUẦN (không phải Service) — tạo thể hiện sống qua `ctx.sessions.create()`, thể hiện tách rời
 * qua {@link Session.create}. Seed bằng log có sẵn là replay/fork một session.
 * @typert object
 */
export class Session {
  /** Log append-only RIÊNG TƯ, chỉ lớn thêm qua {@link Session.commit}. */
  private readonly log: SessionEvent[] = [];
  /** Chủ sở hữu TĂNG DẦN duy nhất của việc nhận surface và trạng thái chiếu. */
  private readonly surfaceManager: SurfaceManager;
  /** Surface CÓ THỨ TỰ trên log sự kiện của session này. */
  get surface(): SessionSurface {
    return this.surfaceManager;
  }
  /**
   * Metadata khởi tạo ĐÃ TÁCH RỜI và ĐÓNG BĂNG SÂU (phiên bản định dạng, cwd, dòng dõi, và việc có
   * lịch sử fork hay không). Store cấp nó qua `ctx.sessions.create()`. Khi một `Session` được tạo
   * không có header do store sở hữu, một header tối thiểu được TỔNG HỢP (đóng dấu bằng
   * {@link SESSION_FORMAT_VERSION} hiện hành) để `session.header` luôn tồn tại. Header nằm NGOÀI log
   * sự kiện — đó là chuyện lưu trữ, không phải trạng thái hội thoại replay được.
   */
  readonly header: SessionHeader;
  /** Số sự kiện ĐẦU tiên kế thừa từ session cha của fork này. */
  readonly inheritedEventCount: SessionLogOffset;
  /** Danh tính session, dẫn từ bản sao DUY NHẤT trong header bền vững của nó. */
  get id(): SessionId {
    return this.header.id;
  }
  /**
   * Độ dài seed của constructor (0 khi không có seed), TRƯỚC mọi marker được append trong lúc dựng.
   * Sự kiện seed KHÔNG BAO GIỜ phát trên `session/event`. Một marker được append trước khi store gắn
   * vào sẽ chiếm seq này mà cũng không phát; nếu không, seq này còn trống cho lần append kế tiếp.
   *
   * Độ lệch trong tiến trình này KHÔNG được lưu bền. Seed của fork có thể đã chứa marker kế thừa của
   * con và các closer tổng hợp, nên lịch sử do con sở hữu bắt đầu tại {@link inheritedEventCount},
   * TRƯỚC độ lệch này. Seed của một Session resume chứa toàn bộ log đã lưu, còn số đếm kế thừa giữ
   * đúng vết cắt fork bền vững. Bên tiêu thụ cần lịch sử chuẩn đầy đủ thì bắt đầu từ seq 0.
   */
  readonly firstLiveSeq: SessionLogOffset;
  /**
   * Sự kiện ĐẦU TIÊN sinh ra cho vòng đời của đối tượng này. Một fork mới bao gồm marker seed của con
   * và các closer; một Session restore bắt đầu SAU tiền tố đã lưu đầy đủ của nó. Độ lệch thu thập
   * trong tiến trình này KHÔNG được lưu bền.
   */
  readonly firstLifecycleSeq: SessionLogOffset;
  /**
   * Tạo một session tách rời bằng cách kiểm và chụp nhanh các sự kiện seed MƯỢN cùng metadata lưu trữ.
   * Nhận: `id` — danh tính session; `seed` — sự kiện replay hoặc fork mượn (tuỳ chọn); `header` —
   * metadata lưu trữ mượn (tuỳ chọn); `inheritedEventCount` — độ dài tiền tố kế thừa fork CHÍNH XÁC
   * cho một header đã seed; `projections` — bộ diễn giải THUẦN cho các thay đổi message do plugin sở hữu.
   * Trả: một session tách rời.
   * Ném: khi một sự kiện seed cần bộ diễn giải message bị thiếu hoặc không qua kiểm.
   */
  static create(
    id: SessionId,
    seed?: readonly SessionEvent[],
    header?: SessionHeader,
    inheritedEventCount?: SessionLogOffset,
    projections?: readonly SessionMessageProjection[],
  ): Session {
    return new Session(id, seed, header, "snapshot", inheritedEventCount, projections);
  }
  /**
   * Khôi phục một session tách rời bằng cách NHẬN một seed thuộc sở hữu độc lập hoặc đã đóng băng sâu.
   * Các trường sự kiện bắt buộc lúc chạy, phong bì sự kiện, tính liên tục của seq, chuyển tiếp surface
   * và các trường header được kiểm mà KHÔNG sao chép hay đóng băng sự kiện. Stream Assistant nhúng
   * vẫn ĐỤC cho tới khi một bên tiêu thụ stream hoặc bộ kiểm lưu trữ đọc chúng.
   * Nhận: `id` — danh tính session được khôi phục; `seed` — sự kiện thuộc sở hữu độc lập hoặc đã
   * đóng băng sâu; `header` — metadata lưu trữ thuộc sở hữu độc lập; `inheritedEventCount` — độ dài
   * tiền tố kế thừa fork CHÍNH XÁC đã giải mã từ lưu trữ; `eventState` — trạng thái aliasing mang từ
   * thao tác đã sinh seed; `projections` — bộ diễn giải THUẦN cho thay đổi message do plugin sở hữu.
   * Trả: một session tách rời đã khôi phục.
   * Ném: khi một sự kiện seed cần bộ diễn giải message bị thiếu hoặc không qua kiểm.
   */
  static fromRestore(
    id: SessionId,
    seed: readonly SessionEvent[],
    header: SessionHeader,
    inheritedEventCount: SessionLogOffset,
    eventState: SessionSeedEventState,
    projections?: readonly SessionMessageProjection[],
  ): Session {
    return new Session(id, seed, header, eventState, inheritedEventCount, projections);
  }
  /**
   * Dựng session từ seed/mode đã chọn; mọi kiểm và phép append marker diễn ra tại đây.
   * Nhận: `id` — danh tính; `seed` — sự kiện mượn hoặc độc lập (tuỳ chọn); `header` — metadata lưu
   * trữ (tuỳ chọn); `mode` — `snapshot` (chụp bản sao) hoặc trạng thái aliasing của restore;
   * `suppliedInheritedEventCount` — độ dài tiền tố kế thừa do store cấp; `projections` — bộ diễn giải
   * message của plugin.
   * Trả: không (constructor).
   * Ném: khi seed/header/kế thừa không hợp lệ, hoặc marker kế thừa không nằm đúng vết cắt.
   */
  private constructor(
    id: SessionId,
    seed: readonly SessionEvent[] | undefined,
    header: SessionHeader | undefined,
    mode: SessionSeedEventState | "snapshot" = "snapshot",
    suppliedInheritedEventCount?: SessionLogOffset,
    projections: readonly SessionMessageProjection[] = [],
  ) {
    this.surfaceManager = new SurfaceManager(this.log, SessionLogOffset(0), projections);
    const restoredHeader = mode === "snapshot" ? undefined : validateRestoredSessionHeader(id, header);
    if (seed !== undefined) {
      for (const [index, source] of seed.entries()) {
        const snapshot = mode === "snapshot" ? snapshotJsonValue(source) : source;
        if (snapshot === undefined) {
          throw new Error(`seed event at index ${index} is not losslessly JSON-serializable`);
        }
        assertSessionEventEnvelope(snapshot, index);
        if (snapshot.seq !== index) {
          throw new Error(
            `seed event at index ${index} has seq ${snapshot.seq} (expected ${index}); seed must be contiguous from 0`,
          );
        }
        try {
          this.surfaceManager.validateNext(snapshot);
        } catch (error) {
          throw new Error(
            `invalid seed event at index ${index}: ${error instanceof Error ? error.message : "invalid surface metadata"}`,
          );
        }
        this.log.push(mode === "snapshot" ? deepFreeze(snapshot) : snapshot);
      }
    }
    this.firstLiveSeq = SessionLogOffset(this.log.length);
    this.header = restoredHeader ?? snapshotSessionHeader(id, header);
    if (this.header.isSeeded && seed === undefined) {
      throw new Error("seeded session requires an explicit constructor seed");
    }
    if (this.header.isSeeded && suppliedInheritedEventCount === undefined) {
      throw new Error("seeded session requires an inherited event count");
    }
    const inheritedEventCount = SessionLogOffset(suppliedInheritedEventCount ?? 0);
    if (!this.header.isSeeded && inheritedEventCount !== 0) {
      throw new Error("unseeded session inherited event count must be 0");
    }
    if (inheritedEventCount > this.log.length) {
      throw new Error("session inherited event count exceeds its event log");
    }
    const seedMarker = this.log[inheritedEventCount];
    const markedSeed = seedMarker?.type === "session/end-seed" && seedMarker.data.inherited === true;
    if (mode === "snapshot" && this.header.isSeeded && inheritedEventCount !== this.log.length && !markedSeed) {
      throw new Error("seeded session constructor seed must equal its inherited prefix or mark its inherited cut");
    }
    if (
      markedSeed &&
      this.log
        .slice(inheritedEventCount + 1)
        .some((event) => event.type === "session/end-seed" && event.data.inherited === true)
    ) {
      throw new Error("session inherited event count must identify the final inherited marker");
    }
    this.inheritedEventCount = inheritedEventCount;
    this.firstLifecycleSeq = mode === "snapshot" && this.header.isSeeded ? inheritedEventCount : this.firstLiveSeq;
    if (seed !== undefined && mode === "snapshot" && this.header.isSeeded && !markedSeed) {
      this.append("session/end-seed", { inherited: true });
    } else if (
      seed !== undefined &&
      !(mode === "snapshot" && this.header.isSeeded) &&
      this.log.at(-1)?.type !== "session/end-seed"
    ) {
      this.append("session/end-seed", {});
    }
  }
  /** Bản chụp ĐÓNG BĂNG, bất biến, được cache, của log append-only riêng tư. */
  private eventsSnapshot: readonly SessionEvent[] | undefined;
  /**
   * Trả sự kiện bất biến đã lưu tại ĐÚNG một số thứ tự.
   * @deprecated Logic cũ có thể còn chưa được chuyển; lời gọi MỚI bị CẤM.
   * Xem [Agent Note](../../../../.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md).
   * Nhận: `seq` — số thứ tự sự kiện.
   * Trả: sự kiện đã nhận, hoặc undefined khi log không chứa nó.
   */
  eventAt(seq: SessionSeq): SessionEvent | undefined {
    return this.log[seq];
  }
  /**
   * Hiện thực hoá một bản chụp bất biến của khoảng seq sự kiện NỬA MỞ.
   * Bản chụp hiện tại đầy đủ được dùng lại tới lần append kế tiếp; mọi bản chụp đã trả trước đó vẫn ổn
   * định sau các lần append sau.
   * @deprecated Logic cũ có thể còn chưa được chuyển; lời gọi MỚI bị CẤM.
   * Xem [Agent Note](../../../../.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md).
   * Nhận: `fromSeq` — số thứ tự bao gồm, không âm; mặc định là đầu log; `toSeqExclusive` — số thứ tự
   * loại trừ, không âm; mặc định là cuối hiện tại.
   * Trả: mảng ĐÓNG BĂNG của các sự kiện đã chọn (đều đã đóng băng sâu).
   */
  snapshotEvents(
    fromSeq: SessionLogOffset = SessionLogOffset(0),
    toSeqExclusive: SessionLogOffset = this.seq,
  ): readonly SessionEvent[] {
    if (fromSeq === 0 && toSeqExclusive === this.log.length) {
      this.eventsSnapshot ??= Object.freeze([...this.log]);
      return this.eventsSnapshot;
    }
    return Object.freeze(this.log.slice(fromSeq, toSeqExclusive));
  }
  /**
   * Trả các sự kiện của Session này SAU tiền tố kế thừa fork.
   * @deprecated Logic cũ có thể còn chưa được chuyển; lời gọi MỚI bị CẤM.
   * Xem [Agent Note](../../../../.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md).
   * Nhận: không.
   * Trả: mảng MỚI chứa các sự kiện do con sở hữu, theo thứ tự log.
   */
  ownEvents(): readonly SessionEvent[] {
    return this.snapshotEvents(this.inheritedEventCount);
  }
  /**
   * Một vị trí sự kiện đã có nằm NGOÀI tiền tố kế thừa fork hay không.
   * Nhận: `seq` — vị trí sự kiện trong Session này.
   * Trả: true khi sự kiện thuộc Session này chứ không thuộc cha của nó.
   */
  isOwnSeq(seq: SessionSeq): boolean {
    return seq >= this.inheritedEventCount && seq < this.seq;
  }
  /** Số thứ tự của sự kiện KẾ TIẾP — luôn là độ dài log (hợp đồng liên tục `seq = log.length`). */
  get seq(): SessionLogOffset {
    return SessionLogOffset(this.log.length);
  }
  /**
   * Append MỘT sự kiện có kiểu vào log và đồng bộ thông báo cho observer qua các hook phát hành
   * RIÊNG TƯ do store sở hữu. Đường nóng KHÔNG BAO GIỜ chặn trên I/O — plugin lưu trữ đệm bất đồng
   * bộ. Khi sự kiện đã vào log, lần append đã CAM KẾT: lỗi của observer được ghi log và cô lập theo
   * từng listener, nên chúng không đổi giá trị trả về hay ngăn listener sau quan sát cùng sự kiện.
   *
   * Nhận: `type` — loại sự kiện (khoá của {@link SessionEventMap}); `data` — payload sự kiện, phải
   * JSON-serializable; `opts` — metadata surface: `surfaceOp` quyết cách sự kiện vào surface có thứ
   * tự; `sourceEventSeqs` liệt kê seq của các sự kiện sớm hơn mà sự kiện này dẫn ra. BẮT BUỘC với các
   * sự kiện {@link SurfaceEventType} (mọi sự kiện sinh message phải khai cách nó gia nhập surface,
   * nguồn DUY NHẤT của lịch sử mô hình dẫn ra) và bị compiler TỪ CHỐI với các loại không thuộc surface
   * như `turn/start` hay `assistant/attempt`. Message assistant nhúng đúng stream của provider và
   * không thể dẫn các sự kiện nguồn cấp cao nhất.
   * Trả: sự kiện đã ghi log — `seq`/`time` được gán cộng BẢN CHỤP của `data` đã vào log, nên đọc lại
   * `event.data` thấy giá trị đã ghi, không bao giờ thấy đầu vào còn đổi được của bên gọi.
   * Ném: khi `data` hoặc metadata surface không JSON-serializable MẤT MÁT (BigInt, function, symbol,
   * undefined, âm không, số không hữu hạn, tham chiếu vòng, mảng thưa, hay đối tượng lạ như
   * Map/Set/Date/thể hiện class), hoặc khi ứng viên vi phạm luật trường rỗng của request-header / tính
   * nhất quán tool-error, hoặc hợp đồng surface chuẩn (hình dạng và điều kiện của marker, tham chiếu
   * sự kiện nguồn sớm hơn DUY NHẤT, tính hợp lệ của phép thay thế theo vị trí, và độ phủ ĐẦY ĐỦ của
   * node bị che). Một lượt lặp đọc, kiểm và sao mỗi giá trị lồng đúng một lần, nên getter có trạng
   * thái không thể đưa một giá trị cho kiểm và một giá trị khác cho lưu trữ. Log sự kiện là nguồn
   * chân lý bền vững, nên một sự kiện hỏng thất bại tại chỗ append chứ không phải sau đó trong lúc
   * backend flush. Một lỗi kiểm phát nội bộ đồng bộ, hoặc một lần append tái vào trong khi biên
   * nhận/phát hành này đang mở, cũng bị từ chối trước khi log đổi.
   */
  append<T extends SessionEventType>(
    type: T,
    data: SessionEventMap[T],
    ...opts: T extends SurfaceEventType ? [opts: SurfaceIntent<T>] : []
  ): SessionEvent<T> {
    const surfaceOpts = (opts as readonly unknown[])[0] as SurfaceIntent | undefined;
    const surfaceMetadata = {
      ...(surfaceOpts?.sourceEventSeqs === undefined ? {} : { sourceEventSeqs: surfaceOpts.sourceEventSeqs }),
      ...(surfaceOpts?.surfaceOp === undefined ? {} : { surfaceOp: surfaceOpts.surfaceOp }),
    };
    const dataSnapshot = snapshotJsonValue(data);
    if (dataSnapshot === undefined) {
      throw new Error(`session event "${type}" carries non-JSON-serializable data`);
    }
    const surfaceMetadataSnapshot = snapshotJsonValue(surfaceMetadata);
    if (surfaceMetadataSnapshot === undefined) {
      throw new Error(`session event "${type}" carries non-JSON-serializable surface metadata`);
    }
    const entry = this.publicationEntry();
    const event = deepFreeze({
      type,
      seq: SessionSeq(this.log.length),
      time: Date.now(),
      data: dataSnapshot,
      ...surfaceMetadataSnapshot,
    }) as unknown as SessionEvent;
    validateSessionEventData(event, `session event "${type}" at seq ${event.seq}`);
    this.commit(event, entry);
    return event as SessionEvent<T>;
  }
  static {
    commitPluginRecord = (session, type, data) => session.#appendRecord(type, data);
  }
  /**
   * Cam kết MỘT bản ghi plugin; {@link appendPluginRecord} là bên gọi DUY NHẤT.
   * Nhận: `type` — loại bản ghi, được kiểm theo ngữ pháp bản ghi plugin; `data` — payload JSON, được
   * chụp nhanh trước khi vào log.
   * Trả: số thứ tự của bản ghi.
   */
  #appendRecord(type: PluginRecordType, data: unknown): SessionSeq {
    const dataSnapshot = snapshotJsonValue(data);
    if (dataSnapshot === undefined) {
      throw new Error(`plugin record "${type}" carries non-JSON-serializable data`);
    }
    const entry = this.publicationEntry();
    const record = deepFreeze({
      type,
      seq: SessionSeq(this.log.length),
      time: Date.now(),
      data: dataSnapshot,
      ignorable: true,
    }) as unknown as SessionEvent;
    assertPluginRecordEvent(record);
    this.commit(record, entry);
    return record.seq;
  }
  /**
   * Đọc phần gắn của store cho MỘT lần append, từ chối lần append TÁI VÀO trong khi một lần append
   * khác đang được phát hành.
   * Nhận: không.
   * Trả: phần gắn, hoặc undefined với một Session tách rời.
   */
  private publicationEntry(): SessionAttachment | undefined {
    const entry = attachments.get(this);
    if (entry?.appending) throw new Error("session append cannot reenter while another append is being published");
    return entry;
  }
  /**
   * Nhận MỘT ứng viên đã đóng băng tại số thứ tự kế tiếp, đưa nó vào log, và thông báo cho observer
   * `session/event` với cô lập theo từng listener.
   * Nhận: `event` — ứng viên được dựng tại độ dài log hiện tại; `entry` — phần gắn được đọc TRƯỚC khi
   * ứng viên được dựng.
   * Trả: không.
   */
  private commit(event: SessionEvent, entry: SessionAttachment | undefined): void {
    this.surfaceManager.validateNext(event);
    if (entry !== undefined) entry.appending = true;
    try {
      let callbacks;
      const callbackArgs: [Session, SessionEvent] = [this, event];
      if (entry !== undefined) {
        callbacks = collectSessionCallbacks(entry.emitCtx, [entry.carrier, "session/event", ...callbackArgs]);
      }
      this.log.push(event);
      this.eventsSnapshot = undefined;
      if (callbacks !== undefined && entry !== undefined) {
        invokeContainedSessionObservers(entry.emitCtx, "session/event", entry.id, callbackArgs, callbacks);
      }
    } finally {
      if (entry !== undefined) {
        entry.appending = false;
        if (entry.detachRequested && !entry.announcing) entry.detach();
      }
    }
  }
  /** Phép gộp ĐÃ CACHE của các sự kiện request-header — xem {@link requestHeader}. */
  private headerFold: EpochHeader | undefined;
  /** Vị trí log (số sự kiện đã tiêu thụ) mà phép gộp header đã chạm tới. */
  private headerFoldSeq = 0;
  /**
   * {@link EpochHeader} ĐANG HIỆU LỰC sau sự kiện header cuối của log — header mà request KẾ TIẾP sẽ
   * được so với nó — hoặc undefined trước bản chụp `request/header` đầu tiên. Dạng SỐNG, được bảo trì
   * tăng dần, của `foldRequestHeader(session.snapshotEvents())`: mỗi sự kiện header được gộp đúng một
   * lần, khi lần đầu thấy, nên một lần đọc mỗi bước chỉ tốn O(sự kiện mới).
   * Nhận: không.
   * Trả: header đã gộp, hoặc undefined khi chưa có sự kiện header nào.
   */
  requestHeader(): EpochHeader | undefined {
    if (this.headerFoldSeq < this.log.length) {
      this.headerFold = deepFreeze(foldRequestHeader(this.log.slice(this.headerFoldSeq), this.headerFold));
      this.headerFoldSeq = this.log.length;
    }
    return this.headerFold;
  }
  /** Phép gộp ĐÃ CACHE của các sự kiện `request/context`. */
  private contextFold: RequestContext | undefined;
  /** Vị trí log mà phép gộp context đã chạm tới. */
  private contextFoldSeq = 0;
  /**
   * Trả metadata tuyến ĐÃ GIẢI gần nhất, hoặc `undefined` trước sự kiện `request/context` đầu tiên.
   * Mỗi sự kiện được gộp đúng một lần.
   * Nhận: không.
   * Trả: metadata tuyến bất biến mới nhất.
   */
  requestContext(): RequestContext | undefined {
    if (this.contextFoldSeq < this.log.length) {
      for (const event of this.log.slice(this.contextFoldSeq)) {
        if (event.type === "request/context") this.contextFold = deepFreeze({ ...event.data });
      }
      this.contextFoldSeq = this.log.length;
    }
    return this.contextFold;
  }
  /** Định nghĩa tool lịch sử ĐÃ CACHE và các cập nhật cho phép chiếu request. */
  private readonly toolHistoryProjection = new ToolHistoryProjection();
  /** Chỉ số sự kiện đã cam kết kế tiếp chưa được phép gộp tool-history tiêu thụ. */
  private toolHistorySeq = 0;
  /**
   * Gộp các sự kiện đã cam kết CHƯA THẤY vào lịch sử tool KHÔNG PHỤ THUỘC năng lực.
   * Lần truy cập đầu dựng lại lịch sử kế thừa; các lần đọc sau chỉ tiêu thụ sự kiện mới.
   * Nhận: không.
   * Trả: bản chụp bất biến cho phép chiếu request LLM, bao gồm định nghĩa các lần thêm lịch sử.
   */
  toolHistory(): ToolHistory {
    for (const event of this.log.slice(this.toolHistorySeq)) this.toolHistoryProjection.apply(event);
    this.toolHistorySeq = this.log.length;
    return this.toolHistoryProjection.snapshot();
  }
  /** Cache message dẫn ra: các phép chiếu đã đóng băng, được nối dài theo từng node chưa thấy. */
  private derived: Message[] = [];
  /** Vị trí surface (số node đã chiếu) mà cache đã chạm tới. */
  private derivedNodes = 0;
  /** {@link SurfaceManager.contentGeneration} mà cache được dựng dưới nó. */
  private derivedGeneration = 0;
  /**
   * Dẫn lịch sử message LLM bằng cách đi qua các chuỗi CÓ THỨ TỰ của sự kiện sinh message do marker
   * `surfaceOp` bảo trì. Surface là nguồn DUY NHẤT của lịch sử dẫn ra: mọi lần append sinh message
   * đều ghi `surfaceOp` của nó, nên một sự kiện thô không có marker (một chunk, một biên turn) VẮNG
   * MẶT đúng như phải thế, và một `replace` của compaction XOÁ các node bị che khỏi phép dẫn. Luật
   * chiếu là {@link deriveEventMessage}, với các phép chiếu message đã ghi log được áp mà không đổi
   * tư cách thành viên node hay danh tính message.
   *
   * ĐÃ CACHE: tăng thuần ở đuôi chỉ tốn O(node mới); một phép thay thế hoặc phép chiếu message
   * ({@link SessionSurface.contentGeneration}) thì dựng lại. Mảng trả về là bản chụp MỚI mỗi lần gọi
   * (các lần append sau không bao giờ làm lớn mảng mà bên gọi đã giữ); các đối tượng `Message` trong
   * đó được CHIA SẺ và **đóng băng sâu**. Nội dung không đổi dùng lại data sự kiện đã đóng băng; các
   * block được chiếu là bản sao dẫn ra đã đóng băng. Bên tiêu thụ không thể sửa log qua cả hai dạng.
   * Nhận: không.
   * Trả: mảng MỚI của lịch sử dẫn ra đã chia sẻ, đã đóng băng.
   */
  deriveMessages(): Message[] {
    const surface = this.surface;
    const nodes = surface.nodes;
    const generation = surface.contentGeneration;
    if (generation !== this.derivedGeneration) {
      this.derived = [];
      this.derivedNodes = 0;
      this.derivedGeneration = generation;
    }
    for (const seq of nodes.slice(this.derivedNodes)) {
      // oxlint-disable-next-line typescript/no-non-null-assertion -- seq lấy từ nodes của surface nên luôn có trong log
      const msg = this.deriveEventMessage(this.log[seq]!);
      if (msg) this.derived.push(msg);
    }
    this.derivedNodes = nodes.length;
    return [...this.derived];
  }
  /**
   * Chiếu MỘT sự kiện với MỌI phép chiếu message đã cam kết được áp lên.
   * Sự kiện bền vững gốc vẫn KHÔNG đổi.
   * Nhận: `event` — sự kiện cần chiếu.
   * Trả: message dẫn ra, hoặc null khi sự kiện không sinh message nào.
   */
  deriveEventMessage(event: SessionEvent): Message | null {
    return this.surfaceManager.deriveEventMessage(event);
  }
}
/**
 * Mã từ chối của việc fork session: id nguồn không có trong store sống (`SESSION_NOT_FOUND`) hoặc
 * đặt tên một đối tượng session không phải thể hiện sống của store (`SESSION_NOT_LIVE`); id con được
 * yêu cầu đã bị chiếm (`SESSION_ALREADY_EXISTS`); hoặc biên không phải seq liên tục đang tồn tại
 * (`INVALID_BOUNDARY`).
 */
export type SessionForkErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_NOT_LIVE"
  | "SESSION_ALREADY_EXISTS"
  | "INVALID_BOUNDARY";
/** Lỗi CÓ KIỂU cho các lần từ chối fork session. */
export class SessionForkError extends Error {
  /** Mã từ chối giải thích vì sao fork bị chặn. */
  readonly code: SessionForkErrorCode;
  /**
   * Dựng lỗi fork với thông điệp và mã từ chối.
   * Nhận: `message` — thông điệp người đọc được; `code` — mã từ chối.
   * Trả: không (constructor).
   */
  constructor(message: string, code: SessionForkErrorCode) {
    super(message);
    this.code = code;
    this.name = "SessionForkError";
  }
}
