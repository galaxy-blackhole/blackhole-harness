/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc `ctx.sessionProjections`: SỔ ĐƠN VỊ CHIẾU PHIÊN và phép LÁI của nó — đăng ký đơn vị, lái
 *      EAGER mọi sự kiện đã cam kết qua từng đơn vị, giữ ô trạng thái theo mốc seq (watermark) cho
 *      từng phiên, phát kênh thay đổi, và đọc/ghi kho checkpoint (checkpoint · restoreFloor ·
 *      viewCheckpoint · restore · hydrate). Bản viết lại của lib/types/index.js gốc.
 */

import { Service, type Context } from "@deepseek-ai/cordis";

import {
  SessionLogOffset,
  SessionSeq,
  type SessionLogOffset as SessionLogOffsetType,
  type SessionSeq as SessionSeqType,
  type SessionSeqCursor,
} from "./brand.ts";
import type {
  ProjectedSession,
  ProjectionChangeListener,
  ProjectionCheckpoint,
  ProjectionDefinition,
  ProjectionSchema,
  ProjectionSnapshot,
  SessionEventLike,
} from "./types.ts";

/**
 * Đổi một offset log thành con trỏ BAO GỒM ngay trước nó.
 * Nhận: offset (số sự kiện đã cam kết).
 * Trả: seq của sự kiện cuối — `-1` khi offset là 0 (log rỗng).
 */
function cursorBefore(offset: number): SessionSeqCursor {
  return offset === 0 ? -1 : SessionSeq(offset - 1);
}

/** Khung nhìn dây ĐÃ XOÁ KIỂU: seam không biết kiểu trạng thái của miền nào. */
interface ErasedWire {
  /** Schema khung nhìn (giữ NGUYÊN thể hiện của miền). */
  readonly viewSchema: ProjectionSchema<unknown>;
  /** Hàm chiếu trạng thái ⇒ khung nhìn. */
  readonly view: (state: unknown) => unknown;
}

/** Đơn vị chiếu ĐÃ XOÁ KIỂU, chụp lại LÚC ĐĂNG KÝ (sửa vật thể gốc sau đó không ảnh hưởng). */
interface ErasedDefinition {
  /** Khoá chiếu. */
  readonly key: string;
  /** Schema trạng thái. */
  readonly stateSchema: ProjectionSchema<unknown>;
  /** Trạng thái ban đầu của một phiên. */
  readonly init: (header: unknown, inheritedEventCount: SessionLogOffsetType) => unknown;
  /** Phép gộp thuần. */
  readonly apply: (state: unknown, event: SessionEventLike) => unknown;
  /** Khung nhìn dây, hoặc `undefined` với đơn vị chỉ-host. */
  readonly wire: ErasedWire | undefined;
  /** Phiên bản trạng thái lưu. */
  readonly stateVersion: number;
}

/** Ô trạng thái của MỘT đơn vị chiếu trên MỘT phiên. */
interface Cell {
  /** Trạng thái đã gộp tới `observedSeq`. */
  state: unknown;
  /** Seq của sự kiện cuối đã gộp; `-1` khi chưa gộp sự kiện nào. */
  observedSeq: SessionSeqCursor;
  /** Hai khung nhìn THÔ gần nhất: `[trước, hiện tại]` — dùng để so `Object.is` trước khi phát. */
  views: [unknown, unknown];
}

/** Một khoá chiếu đã đăng ký: đơn vị + ô theo phiên + số người đăng ký cùng khoá. */
interface Registration {
  /** Đơn vị đã xoá kiểu. */
  readonly def: ErasedDefinition;
  /** Ô trạng thái theo từng phiên (WeakMap: phiên chết là ô được thu). */
  readonly cells: WeakMap<ProjectedSession, Cell>;
  /** Số lượt đăng ký đang sống cùng khoá này. */
  refs: number;
}

/** Phần context kernel mà sổ này dùng để nghe hai sự kiện vòng đời phiên. */
interface ProjectionEventHost {
  /**
   * Nghe một sự kiện của kernel.
   * Nhận: tên sự kiện và hàm xử lý.
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  on(event: "session/created", listener: (session: ProjectedSession) => void): unknown;
  /**
   * Nghe sự kiện đã cam kết của MỌI phiên.
   * Nhận: tên sự kiện và hàm xử lý nhận (phiên, sự kiện).
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  on(event: "session/event", listener: (session: ProjectedSession, event: SessionEventLike) => void): unknown;
}

/**
 * `ctx.sessionProjections`: bảng đơn vị chiếu và phép lái của nó. Sổ đăng ký nghe `session/event`
 * MỘT lần; mọi sự kiện đã cam kết đi qua `apply` của MỌI đơn vị đã đăng ký (lái eager). Một tham
 * chiếu trạng thái ĐỔI thì tính khung nhìn Client kế tiếp; kênh thay đổi chỉ phát khi kết quả THÔ
 * đổi theo `Object.is`.
 *
 * Ô dựng LƯỜI — đơn vị đăng ký sau khi sự kiện đã chảy, hoặc phiên cũ hơn sổ, sẽ gộp `init` trên
 * log trong bộ nhớ ở lần chạm đầu tiên (sự kiện hoặc lượt đọc). Đăng ký là một HIỆU ỨNG (hàm dọn
 * đi theo fiber của bên gọi): gỡ plugin miền ⇒ khoá của nó biến khỏi ảnh chụp và Client đọc đó là
 * "không có năng lực này". Bên đọc phía Host hoặc khai `sessionProjections` trong `inject` của
 * plugin mình, hoặc báo lỗi rõ ràng khi sổ/khoá vắng mặt. Bên đóng góp có thể giữ đăng ký tuỳ chọn
 * qua `ctx.inject(['sessionProjections'], …)`. Các bên đăng ký CHUNG một khoá thì dùng chung MỘT
 * đơn vị và được ĐẾM: cùng một gói tool mount trong N agent preset đăng ký N lần, và khoá sống tới
 * khi lượt cuối cùng rút.
 */
export class SessionProjectionRegistry extends Service {
  /** Bảng khoá chiếu ⇒ đơn vị đã đăng ký (một khoá, một đơn vị). */
  private readonly registrations = new Map<string, Registration>();

  /** Người nghe kênh thay đổi. */
  private readonly listeners = new Set<ProjectionChangeListener>();

  /**
   * Tạo sổ và cài nó thành `ctx.sessionProjections`.
   * Nhận: context cordis sở hữu dịch vụ.
   * Trả: thực thể đã đăng ký; đồng thời nối hai hook vòng đời phiên
   *   (`session/created` chỉ với phiên mới tinh, `session/event` cho mọi sự kiện đã cam kết).
   */
  constructor(ctx: Context) {
    super(ctx, "sessionProjections");
    const host = ctx as unknown as ProjectionEventHost;
    host.on("session/created", (session) => {
      if (session.seq !== 0) return;
      for (const registration of this.registrations.values()) {
        if (registration.cells.has(session)) continue;
        registration.cells.set(session, {
          state: registration.def.init(session.header, session.inheritedEventCount),
          observedSeq: -1,
          views: [undefined, undefined],
        });
      }
    });
    host.on("session/event", (session, event) => {
      this.drive(session, event);
    });
  }

  /**
   * Đăng ký đơn vị chiếu của MỘT miền. Đăng ký là HIỆU ỨNG trên fiber của context đang gọi: gỡ
   * fiber (hoặc gọi hàm dọn trả về) rút khoá — cùng ô đã nhớ của nó — khỏi mọi lượt lái và ảnh chụp.
   * Nhận: `definition` — khoá, schema trạng thái, hàm gộp thuần, khung nhìn dây tuỳ chọn, stateVersion.
   * Trả: ĐÚNG hàm dọn của lượt đăng ký này.
   * Ném: `Error` khi `stateVersion` không phải số nguyên không âm, hoặc khi khoá đã đăng ký ở
   *   `stateVersion` KHÁC.
   */
  register<State, View>(definition: ProjectionDefinition<State, View>): () => void {
    const wire = definition.wire;
    const erased: ErasedDefinition = {
      key: definition.key,
      stateSchema: definition.stateSchema,
      init: (header, inheritedEventCount) => definition.init(header, inheritedEventCount),
      apply: (state, event) => definition.apply(state as State, event),
      wire:
        wire === undefined
          ? undefined
          : {
              viewSchema: wire.viewSchema,
              view: (state) => wire.view(state as State),
            },
      stateVersion: definition.stateVersion,
    };
    if (!Number.isSafeInteger(definition.stateVersion) || definition.stateVersion < 0) {
      throw new Error(
        `session projection ${JSON.stringify(definition.key)} stateVersion must be a non-negative integer, got ${String(definition.stateVersion)}`,
      );
    }
    const registry = this;
    return this.ctx.effect(
      function* () {
        const key = erased.key;
        const existing = registry.registrations.get(key);
        if (existing === undefined) {
          registry.registrations.set(key, {
            def: erased,
            cells: new WeakMap(),
            refs: 1,
          });
        } else {
          if (existing.def.stateVersion !== erased.stateVersion) {
            throw new Error(
              `session projection key ${JSON.stringify(key)} is already registered at stateVersion ${String(existing.def.stateVersion)}; refusing to share it with stateVersion ${String(erased.stateVersion)}`,
            );
          }
          existing.refs += 1;
        }
        yield () => {
          const live = registry.registrations.get(key);
          if (live === undefined) return;
          live.refs -= 1;
          if (live.refs === 0) registry.registrations.delete(key);
        };
      },
      "sessionProjections.register()",
    );
  }

  /**
   * Theo dõi kênh thay đổi. Lượt đăng ký là hiệu ứng trên fiber của context đang gọi.
   * Nhận: `listener` — được gọi MỘT lần cho mỗi đơn vị hiện cho Client có khung nhìn THÔ đổi theo
   *   `Object.is`, trên mỗi sự kiện đã cam kết.
   * Trả: ĐÚNG hàm dọn để ngừng theo dõi.
   */
  onChanged(listener: ProjectionChangeListener): () => void {
    const dispose = this.ctx.effect(() => {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }, "sessionProjections.onChanged()");
    return () => void dispose();
  }

  /**
   * Đọc trạng thái Host hiện tại của MỘT đơn vị sau khi vật chất hoá MỌI đơn vị đã đăng ký ở con
   * trỏ của phiên. Khung nhìn của đơn vị khác KHÔNG được dựng. Giá trị trả về là SỐNG: bên gọi
   * không được sửa.
   * Nhận: `session` — phiên cần đọc; `key` — khoá đơn vị đã đăng ký.
   * Trả: trạng thái hiện tại, hoặc `undefined` khi khoá chưa đăng ký.
   */
  stateOf(session: ProjectedSession, key: string): unknown {
    const registration = this.registrations.get(key);
    if (registration === undefined) return undefined;
    this.materializeCells(session);
    return this.cellFor(registration, session).state;
  }

  /**
   * MỘT phép cắt nhất quán trên mọi đơn vị hiện cho Client của một phiên, đọc từ ô mốc seq (ô
   * thiếu thì gộp lười trên log trong bộ nhớ). Hoàn toàn ĐỒNG BỘ — mọi giá trị và `asOfSeq` phản
   * ánh CÙNG một vị trí log. Mỗi giá trị đi qua `viewSchema` của đơn vị mình trước khi ra.
   * Nhận: `session` — phiên cần đọc; `keys` — tuỳ chọn, chỉ lấy các khoá hiện cho Client này
   *   (việc vật chất hoá TRẠNG THÁI vẫn đầy đủ).
   * Trả: ảnh chụp; `values` rỗng khi không có đơn vị hiện-cho-Client nào được chọn.
   */
  snapshot(session: ProjectedSession, keys?: readonly string[]): ProjectionSnapshot {
    const values: Record<string, unknown> = {};
    const selected = keys === undefined ? undefined : new Set(keys);
    this.materializeCells(session);
    for (const registration of this.registrations.values()) {
      if (registration.def.wire === undefined) continue;
      if (selected !== undefined && !selected.has(registration.def.key)) continue;
      const cell = this.cellFor(registration, session);
      values[registration.def.key] = this.viewCell(registration, cell);
    }
    return {
      asOfSeq: cursorBefore(session.seq),
      values,
    };
  }

  /**
   * Chỉ đọc các ô hiện-cho-Client ĐÃ vật chất hoá, KHÔNG gộp lịch sử. Giá trị có thể chậm hơn phiên
   * sống nên chỉ là GỢI Ý, không phải đường nền đầy đủ. Ô thiếu thì bị bỏ.
   * Nhận: `session` — phiên đã gắn; `keys` — tuỳ chọn, các khoá dây cần xem.
   * Trả: phép cắt đã nhớ THẤP NHẤT, hoặc `undefined` khi không có ô dây nào.
   */
  cachedSnapshot(session: ProjectedSession, keys?: readonly string[]): ProjectionSnapshot | undefined {
    const values: Record<string, unknown> = {};
    let asOfSeq: SessionSeqCursor | undefined;
    const selected = keys === undefined ? undefined : new Set(keys);
    for (const registration of this.registrations.values()) {
      if (registration.def.wire === undefined) continue;
      if (selected !== undefined && !selected.has(registration.def.key)) continue;
      const cell = registration.cells.get(session);
      if (cell === undefined) continue;
      values[registration.def.key] = this.viewCell(registration, cell);
      if (asOfSeq === undefined || cell.observedSeq < asOfSeq) asOfSeq = cell.observedSeq;
    }
    return asOfSeq === undefined
      ? undefined
      : {
          asOfSeq,
          values,
        };
  }

  /**
   * Checkpoint MỨC TRẠNG THÁI của mọi đơn vị được lưu cho một phiên, đọc từ ô mốc seq (ô thiếu thì
   * gộp lười trên log trong bộ nhớ). Đây là phía GHI của kho chiếu: các dòng trả về là phần
   * `(key → {ver, seq, val})` của dòng bền `(sessionId, key, ver, seq, val)`.
   * Mỗi `val` là bản sao cấu trúc TÁCH RỜI — KHÔNG BAO GIỜ là tham chiếu ô sống: ô mốc seq là
   * trạng thái khả biến có thẩm quyền của sổ này, bên gọi chạm vào tham chiếu sống có thể làm hỏng
   * mọi ảnh chụp và khung sau đó (JSON thuần theo hợp đồng đơn vị nên phép sao là TOÀN PHẦN).
   * Nhận: `session` — phiên cần checkpoint trạng thái các đơn vị.
   * Trả: một dòng cho mỗi khoá đã đăng ký.
   */
  checkpoint(session: ProjectedSession): ProjectionCheckpoint {
    const rows: ProjectionCheckpoint = {};
    for (const registration of this.registrations.values()) {
      const cell = this.cellFor(registration, session);
      rows[registration.def.key] = {
        ver: registration.def.stateVersion,
        seq: cell.observedSeq,
        val: structuredClone(cell.state),
      };
    }
    return rows;
  }

  /**
   * Seq mà lượt đọc ĐUÔI của {@link restore} trên `checkpoint` phải bắt đầu: MỘT sự kiện DƯỚI mốc
   * seq dùng được thấp nhất (dòng dùng được khi `ver` khớp `stateVersion` của đơn vị đang sống;
   * dòng vắng mặt hoặc lệch phiên bản kéo sàn về `0` — khoá đó phải gộp lại TOÀN log). Mốc
   * "một-dưới" là chịu lực: đuôi đọc sau đó CHỨNG MINH log đã lưu còn dài tới đâu, để {@link restore}
   * phát hiện được log bị co lại dưới mốc của một dòng (cắt do sửa sự cố) thay vì phục vụ dòng cũ
   * như thể là hiện tại — đuôi RỖNG đọc từ mốc đó cho ra điểm cuối dưới mọi mốc và lượt restore từ
   * chối để đọc lại toàn bộ.
   * Nhận: `checkpoint` — các dòng đã lưu của một phiên (có thể cũ hoặc rỗng).
   * Trả: offset cho lượt đọc hậu tố log đã lưu (`SessionHandle.read`), hoặc `undefined` khi không
   *   đơn vị nào đăng ký (không cần đọc — {@link restore} dù sao cũng phục vụ giá trị rỗng).
   */
  restoreFloor(checkpoint: ProjectionCheckpoint): SessionLogOffsetType | undefined {
    let floor: number | undefined;
    for (const registration of this.registrations.values()) {
      const row = checkpoint[registration.def.key];
      const need = row !== undefined && row.ver === registration.def.stateVersion ? Math.max(row.seq + 1, 0) : 0;
      floor = floor === undefined ? need : Math.min(floor, need);
    }
    return floor === undefined ? undefined : SessionLogOffset(Math.max(floor - 1, 0));
  }

  /**
   * Xem các dòng của một checkpoint mà KHÔNG đọc log: với mọi đơn vị hiện-cho-Client đã đăng ký có
   * `ver` khớp, phục vụ `view` (đã qua schema) của trạng thái đã lưu (đã qua schema); dòng lệch,
   * hỏng, hoặc vắng để khoá của nó VẮNG (bên đọc lạnh/liệt kê coi đó là chưa sẵn sàng và đường đọc
   * đầy đủ hơn sẽ gộp lại). Bậc KHÔNG-I/O của thang đọc — giá trị cũ đúng bằng dòng của nó, không
   * bao giờ SAI.
   * Nhận: `checkpoint` — các dòng đã lưu của một phiên; `keys` — tuỳ chọn, các khoá dây cần xem.
   * Trả: giá trị toàn phần theo khoá có dòng dùng được; rỗng khi không có.
   */
  viewCheckpoint(checkpoint: ProjectionCheckpoint, keys?: readonly string[]): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    const selected = keys === undefined ? undefined : new Set(keys);
    for (const registration of this.registrations.values()) {
      const def = registration.def;
      const wire = def.wire;
      if (wire === undefined) continue;
      if (selected !== undefined && !selected.has(def.key)) continue;
      const row = checkpoint[def.key];
      if (row === undefined || row.ver !== def.stateVersion) continue;
      let state: unknown;
      try {
        state = def.stateSchema.parse(row.val);
      } catch {
        continue;
      }
      values[def.key] = wire.viewSchema.parse(wire.view(state));
    }
    return values;
  }

  /**
   * Đọc LẠNH: gộp mọi đơn vị được lưu trên một hậu tố log đã lưu, mồi mỗi đơn vị từ dòng checkpoint
   * của nó khi dùng được — MỘT công thức đọc (trạng thái đã nhớ + phát lại đuôi tiến + `view`) áp
   * dụng KHÔNG cần `Session` sống. Gọi với các sự kiện đã lưu tại hoặc sau
   * `restoreFloor(checkpoint)` (một lát `SessionHandle.read`) và ĐÚNG sàn đó làm `baseSeq`; mốc
   * "một-dưới" của sàn làm điểm cuối được cấp thành THẬT, nên log bị co được phát hiện ở đây. Một
   * dòng dùng được khi `ver` khớp `stateVersion` của đơn vị đang sống, nó không cũ hơn `baseSeq`
   * (`seq >= baseSeq - 1`), và nó không nhận sự kiện vượt điểm cuối được cấp (`seq <= endSeq`);
   * dòng không dùng được bị BỎ và khoá của nó gộp lại từ `init` — chỉ đúng trên TOÀN log, nên dòng
   * bị bỏ với `baseSeq > 0` sẽ NÉM (bên gọi đọc lại từ seq 0, ví dụ sau khi cắt do sửa sự cố làm
   * log co xuống dưới mốc của dòng).
   * Nhận: `checkpoint` — các dòng đã lưu; `events` — sự kiện đã lưu với `seq >= baseSeq`, đúng thứ
   *   tự; `baseSeq` — seq `events` bắt đầu (seq của sự kiện đầu khi khác rỗng); `header` — metadata
   *   bất biến của phiên đang khôi phục; `inheritedEventCount` — độ dài tiền tố thừa kế khi fork.
   * Trả: phép cắt tại điểm cuối log được cấp (`asOfSeq` là seq sự kiện cuối được cấp, `baseSeq - 1`
   *   với đuôi rỗng) + các dòng checkpoint ĐÃ LÀM MỚI ở phép cắt đó, sẵn sàng ghi bền trở lại.
   */
  restore(
    checkpoint: ProjectionCheckpoint,
    events: readonly SessionEventLike[],
    baseSeq: SessionLogOffsetType,
    header: unknown,
    inheritedEventCount: SessionLogOffsetType,
  ): { snapshot: ProjectionSnapshot; checkpoint: ProjectionCheckpoint } {
    const endSeq = events.at(-1)?.seq ?? cursorBefore(baseSeq);
    const beforeBase = cursorBefore(baseSeq);
    const values: Record<string, unknown> = {};
    const refreshed: ProjectionCheckpoint = {};
    for (const registration of this.registrations.values()) {
      const def = registration.def;
      const wire = def.wire;
      const row = checkpoint[def.key];
      const usable = row !== undefined && row.ver === def.stateVersion && row.seq >= beforeBase && row.seq <= endSeq;
      if (!usable && baseSeq > 0) {
        throw new Error(
          `session projection ${JSON.stringify(def.key)} cannot restore from seq ${baseSeq}: its checkpoint row is missing, version-mismatched, or beyond the supplied log end; re-read from seq 0`,
        );
      }
      let state = usable ? def.stateSchema.parse(row.val) : def.init(header, inheritedEventCount);
      const startIndex = (usable ? row.seq : beforeBase) - baseSeq + 1;
      for (let index = startIndex; index < events.length; index++) {
        const event = events[index];
        const expectedSeq = SessionSeq(baseSeq + index);
        if (event === undefined || event.seq !== expectedSeq) {
          throw new Error(`session projection ${JSON.stringify(def.key)} cannot restore across missing seq ${String(expectedSeq)}`);
        }
        state = def.apply(state, event);
      }
      if (wire !== undefined) values[def.key] = wire.viewSchema.parse(wire.view(state));
      refreshed[def.key] = {
        ver: def.stateVersion,
        seq: endSeq,
        val: state,
      };
    }
    return {
      snapshot: {
        asOfSeq: endSeq,
        values,
      },
      checkpoint: refreshed,
    };
  }

  /**
   * Khôi phục ĐÚNG một phép cắt và cài trạng thái của nó lên phiên ĐÃ CHUẨN BỊ được cấp. Lượt công
   * bố sau đó dùng lại các ô này; lượt đọc sống thường và phép lái sự kiện tiến hậu tố do hàm dựng
   * sở hữu ĐÚNG MỘT lần.
   * Nhận: `session` — phiên đã chuẩn bị sở hữu tiền tố log đã khôi phục; `checkpoint` — các dòng đã
   *   lưu cho vòng đời phiên này; `events` — ĐÚNG các sự kiện ở phép cắt quan sát; `baseSeq` — seq
   *   của sự kiện đầu tiên được cấp.
   * Trả: mọi giá trị chiếu ở phép cắt được cấp.
   */
  hydrate(
    session: ProjectedSession,
    checkpoint: ProjectionCheckpoint,
    events: readonly SessionEventLike[],
    baseSeq: SessionLogOffsetType,
  ): ProjectionSnapshot {
    const endSeq = events.at(-1)?.seq ?? cursorBefore(baseSeq);
    let complete = true;
    for (const registration of this.registrations.values()) {
      if (registration.cells.get(session)?.observedSeq !== endSeq) {
        complete = false;
        break;
      }
    }
    if (complete) {
      const values: Record<string, unknown> = {};
      for (const registration of this.registrations.values()) {
        if (registration.def.wire === undefined) continue;
        const current = registration.cells.get(session);
        if (current === undefined) continue;
        values[registration.def.key] = this.viewCell(registration, current);
      }
      return {
        asOfSeq: endSeq,
        values,
      };
    }
    const restored = this.restore(checkpoint, events, baseSeq, session.header, session.inheritedEventCount);
    for (const registration of this.registrations.values()) {
      const row = restored.checkpoint[registration.def.key];
      if (row === undefined) continue;
      const current = registration.cells.get(session);
      if (current !== undefined && current.observedSeq > row.seq) continue;
      registration.cells.set(session, {
        state: row.val,
        observedSeq: row.seq,
        views: [undefined, undefined],
      });
    }
    return restored.snapshot;
  }

  /**
   * Vật chất hoá MỌI ô đơn vị đã đăng ký ở con trỏ hiện tại của phiên.
   * Nhận: `session` — phiên cần vật chất hoá.
   * Trả: không.
   */
  private materializeCells(session: ProjectedSession): void {
    for (const registration of this.registrations.values()) this.cellFor(registration, session);
  }

  /**
   * Gộp MỘT đơn vị từ `init` trên `events`, cho ra ô đóng mốc ở sự kiện cuối đã gộp.
   * Nhận: đơn vị, header phiên, độ dài tiền tố thừa kế, và các sự kiện cần gộp.
   * Trả: ô mới với `observedSeq` là seq sự kiện cuối (`-1` khi danh sách rỗng).
   */
  private buildCell(
    def: ErasedDefinition,
    header: unknown,
    inheritedEventCount: SessionLogOffsetType,
    events: readonly SessionEventLike[],
  ): Cell {
    let state = def.init(header, inheritedEventCount);
    for (const event of events) state = def.apply(state, event);
    return {
      state,
      observedSeq: events.at(-1)?.seq ?? -1,
      views: [undefined, undefined],
    };
  }

  /**
   * Đọc (hoặc dựng LƯỜI bằng cách gộp toàn log trong bộ nhớ) ô của MỘT đơn vị.
   * Nhận: khoá đã đăng ký và phiên cần đọc.
   * Trả: ô của đơn vị đó trên phiên đó, đã tiến tới con trỏ hiện tại của phiên.
   */
  private cellFor(registration: Registration, session: ProjectedSession): Cell {
    let cell = registration.cells.get(session);
    if (cell === undefined) {
      cell = this.buildCell(registration.def, session.header, session.inheritedEventCount, session.snapshotEvents());
      registration.cells.set(session, cell);
    } else this.advanceCell(registration.def, cell, session, cursorBefore(session.seq));
    return cell;
  }

  /**
   * Tiến MỘT ô đã có qua một tiền tố LIÊN TỤC của phiên.
   * Nhận: đơn vị, ô cần tiến, phiên, và seq cuối cần tiến tới (bao gồm).
   * Trả: không; ném `Error` khi log thiếu một seq giữa đường.
   */
  private advanceCell(def: ErasedDefinition, cell: Cell, session: ProjectedSession, throughSeq: SessionSeqCursor): void {
    if (cell.observedSeq >= throughSeq) return;
    for (let seq = cell.observedSeq + 1; seq <= throughSeq; seq++) {
      const event = session.eventAt(SessionSeq(seq));
      if (event === undefined || event.seq !== seq) {
        throw new Error(`session projection ${JSON.stringify(def.key)} cannot advance across missing seq ${String(seq)}`);
      }
      const next = def.apply(cell.state, event);
      if (!Object.is(next, cell.state)) {
        cell.views[0] = cell.views[1];
        cell.views[1] = undefined;
      }
      cell.state = next;
      cell.observedSeq = SessionSeq(seq);
    }
  }

  /**
   * Phép lái EAGER: đưa một sự kiện đã cam kết qua MỌI đơn vị; phát kênh khi tham chiếu khung nhìn
   * THÔ đổi.
   * Nhận: `session` — phiên vừa có sự kiện; `event` — sự kiện vừa cam kết.
   * Trả: không.
   */
  private drive(session: ProjectedSession, event: SessionEventLike): void {
    for (const registration of this.registrations.values()) {
      let cell = registration.cells.get(session);
      if (cell !== undefined && cell.observedSeq >= event.seq) continue;
      if (cell === undefined) {
        cell = this.buildCell(
          registration.def,
          session.header,
          session.inheritedEventCount,
          session.snapshotEvents(SessionLogOffset(0), SessionLogOffset(event.seq)),
        );
        registration.cells.set(session, cell);
      } else this.advanceCell(registration.def, cell, session, event.seq === 0 ? -1 : SessionSeq(event.seq - 1));
      const previousState = cell.state;
      const next = registration.def.apply(previousState, event);
      const changed = !Object.is(next, previousState);
      cell.state = next;
      cell.observedSeq = event.seq;
      const wire = registration.def.wire;
      if (changed && wire !== undefined) {
        const views = cell.views;
        views[0] = views[1];
        if (this.listeners.size > 0) {
          views[1] = wire.view(next);
          if (!Object.is(views[0], views[1])) {
            const value = wire.viewSchema.parse(views[1]);
            for (const listener of this.listeners) listener(session, registration.def.key, value, event.seq);
          }
        } else views[1] = undefined;
      }
    }
  }

  /**
   * Trả MỘT giá trị dây đã qua schema.
   * Nhận: khoá đã đăng ký và ô cần xem.
   * Trả: khung nhìn đã kiểm; ném `Error` khi đơn vị không có khung nhìn dây.
   */
  private viewCell(registration: Registration, cell: Cell): unknown {
    const wire = registration.def.wire;
    if (wire === undefined) {
      throw new Error(`session projection ${JSON.stringify(registration.def.key)} has no wire view`);
    }
    return wire.viewSchema.parse(wire.view(cell.state));
  }
}
