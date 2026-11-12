/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dịch vụ tiêu đề phiên (`ctx.sessionTitle`), gắn với LOG: phép gộp bất biến là nguồn sự thật,
 *      phép dự phòng tất định là mặc định, và MỘT provider tuỳ chọn được đăng ký để sinh tiêu đề bất
 *      đồng bộ. Mọi lần nhận tiêu đề đều đi qua đúng MỘT đường: `session.append("session/title", …)`.
 *      Bản viết lại của Galaxy Blackhole cho row session-title (@deepseek-ai/dsh-session-title
 *      0.2.1-alpha.4) — nguồn đối chiếu: xem README.md của package (G4).
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import { isAgentLoopRequest } from "@deepseek-ai/dsh-llm";
import z from "@deepseek-ai/schemastery";
import { SessionSeq } from "./brand.ts";
import { collectSessionTitleMessages, sessionTitleUserMessageOf } from "./messages.ts";
import { fallbackSessionTitle, normalizeSessionTitle } from "./normalize.ts";
import { titleInputProjectionDefinition, titleProjectionDefinition } from "./projection.ts";
import { SessionTitleInvalidError, deepFreeze, foldSessionTitle, modelIdentityOf } from "./snapshot.ts";
import type {
  Config,
  LlmStreamOptions,
  Session,
  SessionEvent,
  SessionTitleHost,
  SessionTitleModelIdentity,
  SessionTitleProvider,
  SessionTitleProviderResult,
  SessionTitleSnapshot,
  SessionTitleUserMessage,
  TitleInputState,
  UserMessageData,
} from "./types.ts";
import type { SessionTitleProviderId } from "./brand.ts";

/** Dữ liệu của `request/header`: cấu hình lời gọi chính vừa được ghi. */
interface RequestHeaderData {
  /** Phong bì đầu yêu cầu. */
  readonly header: {
    /** Cấu hình lời gọi đã ghi — tuyến mà provider sẽ thấy. */
    readonly config: SessionTitleModelIdentity;
  };
}

/** Một lần đăng ký provider đang sống. */
interface Registration {
  /** Provider đã đăng ký. */
  readonly provider: SessionTitleProvider;
  /** Các lời gọi đang chạy của provider này (drain lúc gỡ). */
  readonly active: Set<Promise<unknown>>;
  /** Đã bắt đầu gỡ: provider THAY THẾ được đăng ký, kết quả muộn của nó không bao giờ cam kết. */
  closing: boolean;
}

/** Một phiên bản sinh đang CHỜ mốc tuyến của nó trong log. */
interface Pending {
  /** Lần đăng ký đã lên lịch phiên bản này. */
  readonly registration: Registration;
  /** Số phiên bản phiên-cục bộ đã cấp. */
  readonly revision: number;
  /** Trần seq bao gồm của tin nhắn mà phiên bản này được phép dùng. */
  readonly throughSeq: SessionSeq;
}

/** Một lời gọi provider ĐANG chạy. */
interface ActiveWork extends Pending {
  /** Bộ điều khiển huỷ của riêng lời gọi này. */
  readonly controller: AbortController;
  /** Huỷ khi: bị thay thế, dịch vụ gỡ, hoặc người gọi huỷ. */
  readonly signal: AbortSignal;
}

/** Trạng thái KHẢ BIẾN của việc sinh tiêu đề cho MỘT phiên. */
interface WorkState {
  /** Số phiên bản phiên-cục bộ; mỗi lần thay thế tăng một. */
  revision: number;
  /** Phiên bản đang chờ (chưa có tuyến trong log). */
  pending?: Pending;
  /** Lời gọi đang chạy. */
  active?: ActiveWork;
  /** Phép dự phòng đang chạy — gộp nhiều lần gọi vào MỘT lời hứa. */
  fallback?: Promise<SessionTitleSnapshot | undefined>;
}

/**
 * Từ chối một trường cấu hình không phải số nguyên dương (nguyên văn tiền tố câu lỗi bản gốc).
 * Nhận: tên trường và giá trị cần kiểm.
 * Trả: không; ném `Error` khi giá trị không hợp lệ.
 */
function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`session-title: ${name} must be a positive integer`);
}

/** Phép gộp tiêu đề gắn log cộng phép sinh dự phòng bất đồng bộ. */
export class SessionTitleService extends Service {
  /** Seam bắt buộc: sổ phiên sống và sổ chiếu phiên. */
  static inject: string[] = ["sessions", "sessionProjections"];

  /** Schema loader của cấu hình bắt buộc (nguyên văn bản gốc: ba trường bước 1, tối thiểu 1). */
  static Config: z<Config> = z.object({
    fallbackMaxWords: z.number().step(1).min(1).required(),
    fallbackMaxBytes: z.number().step(1).min(1).required(),
    maxTitleBytes: z.number().step(1).min(1).required(),
  }) as unknown as z<Config>;

  /** Cấu hình đã kiểm và đã đóng băng. */
  private readonly config: Config;

  /** Fiber sở hữu plugin này — nguồn của phép kiểm "còn sống". */
  private readonly ownerFiber: SessionTitleHost["fiber"];

  /** Context kernel, khai theo CẤU TRÚC (xem types.ts). */
  private readonly host: SessionTitleHost;

  /** Lần đăng ký provider đang sống, nếu có. */
  private registration: Registration | undefined;

  /** Trạng thái khả biến theo từng phiên. */
  private readonly work = new Map<Session, WorkState>();

  /** Vòng đời dịch vụ: huỷ ở đây là huỷ MỌI lời gọi provider. */
  private readonly lifetime = new AbortController();

  /** Mọi lời hứa đang chạy, giữ tới khi tất toán để gỡ nạp đợi được. */
  private readonly inFlight = new Set<Promise<unknown>>();

  /**
   * Đăng ký dịch vụ `sessionTitle` trên context hiện tại, đăng ký HAI đơn vị chiếu, và nối ba hook.
   * Nhận: context kernel và cấu hình bắt buộc (ba giới hạn; `fallbackMaxBytes ≤ maxTitleBytes`).
   * Trả: thực thể đã đăng ký; ném `Error` khi cấu hình hỏng TRƯỚC khi đăng ký đơn vị chiếu nào.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "sessionTitle");
    const host = ctx as unknown as SessionTitleHost;
    this.host = host;
    this.ownerFiber = host.fiber;
    const candidate: unknown = config;
    if (candidate === null || typeof candidate !== "object") {
      throw new Error("session-title: configuration is required");
    }
    const value = candidate as Config;
    assertPositiveInteger("fallbackMaxWords", value.fallbackMaxWords);
    assertPositiveInteger("fallbackMaxBytes", value.fallbackMaxBytes);
    assertPositiveInteger("maxTitleBytes", value.maxTitleBytes);
    if (value.fallbackMaxBytes > value.maxTitleBytes) {
      throw new Error("session-title: fallbackMaxBytes must not exceed maxTitleBytes");
    }
    this.config = deepFreeze({ ...value });

    host.effect(
      () => async () => {
        this.lifetime.abort(new Error("session-title service disposed"));
        if (this.registration !== undefined) this.registration.closing = true;
        this.registration = undefined;
        for (const state of this.work.values()) {
          delete state.pending;
          state.active?.controller.abort(new Error("session-title service disposed"));
        }
        await this.drain(this.inFlight);
        this.work.clear();
      },
      "sessionTitle lifecycle",
    );

    host.sessionProjections.register(titleProjectionDefinition);
    host.sessionProjections.register(titleInputProjectionDefinition);

    host.on("session/event", (session, event) => {
      switch (event.type) {
        case "user/message":
          this.onUserMessage(session, event);
          break;
        case "request/header":
          this.onRequestHeader(session, event);
          break;
        default:
          break;
      }
    });

    host.on(
      "llm/stream",
      (options, next) => {
        this.onMainRequest(options);
        return next();
      },
      { global: true, prepend: true },
    );

    host.on("session/disposed", (session) => {
      const state = this.work.get(session);
      if (state === undefined) return;
      state.active?.controller.abort(new Error("session disposed during title generation"));
      this.work.delete(session);
    });
  }

  /**
   * Đọc tiêu đề đã gộp mới nhất của một phiên đang sống hoặc đã nạp lại.
   * Nhận: phiên mà LOG của nó là nguồn sự thật của tiêu đề.
   * Trả: ảnh chụp tiêu đề mới nhất, hoặc `undefined` trước khi có đầu vào hợp lệ.
   */
  get(session: Session): SessionTitleSnapshot | undefined {
    return foldSessionTitle(session.snapshotEvents());
  }

  /**
   * Nhận MỘT tiêu đề người dùng tường minh. Ghi sự kiện `session/title` nguồn `user`, tức là GHIM
   * tiêu đề: việc sinh tự động đang chạy bị thay thế và các tin người dùng về sau không lên lịch gì
   * (một `refresh` tường minh là cách bỏ ghim có chủ đích).
   * Nhận: đúng phiên sống cần đổi tên và văn bản thô của người dùng (chuẩn hoá trước khi nhận).
   * Trả: ảnh chụp tiêu đề đã nhận.
   * Ném: `SessionTitleInvalidError` khi tiêu đề chuẩn hoá thành rỗng; `Error` khi phiên không sống
   * hoặc dịch vụ đã bị gỡ.
   */
  rename(session: Session, title: string): SessionTitleSnapshot {
    this.assertServiceActive();
    if (this.host.sessions.get(session.id) !== session) {
      throw new Error(`session "${session.id}" is not live in this store`);
    }
    const normalized = normalizeSessionTitle(title, this.config.maxTitleBytes);
    if (normalized.length === 0) {
      throw new SessionTitleInvalidError("session title must contain visible characters");
    }
    const state = this.stateFor(session);
    this.supersede(state, "user rename superseded automatic title generation");
    session.append("session/title", {
      title: normalized,
      messageSeqs: [],
      source: { kind: "user" },
    });
    const snapshot = this.get(session);
    if (snapshot === undefined) throw new Error("renamed title failed to fold");
    return snapshot;
  }

  /**
   * Thử lại provider đã đăng ký một cách tường minh, hoặc vật chất hoá phép dự phòng có sẵn khi
   * KHÔNG có provider nào đăng ký.
   * Nhận: đúng phiên sống cần làm mới, và tín hiệu huỷ của người gọi (tuỳ chọn).
   * Trả: tiêu đề đã nhận mới nhất, hoặc `undefined` khi không có văn bản hợp lệ nào.
   */
  async refresh(session: Session, signal?: AbortSignal): Promise<SessionTitleSnapshot | undefined> {
    signal?.throwIfAborted();
    this.assertServiceActive();
    if (this.host.sessions.get(session.id) !== session) {
      throw new Error(`session "${session.id}" is not live in this store`);
    }
    const registration = this.registration;
    const input = this.titleInputOf(session);
    if (registration === undefined || registration.closing || input.lastSeq === null) {
      const current = this.get(session);
      const first = input.first;
      if (current?.source.kind === "user" && first !== null) {
        this.appendFallback(session, first);
        signal?.throwIfAborted();
        return this.get(session);
      }
      const fallback = await this.ensureFallback(session);
      signal?.throwIfAborted();
      return fallback;
    }
    const state = this.stateFor(session);
    const revision = this.supersede(state, "explicit title refresh superseded older generation");
    const work = this.activate({ registration, revision, throughSeq: input.lastSeq }, state, signal);
    const config = session.requestHeader()?.config;
    const route = config === undefined ? undefined : modelIdentityOf(config);
    return this.startProvider(session, work, route);
  }

  /**
   * Đăng ký provider tiêu đề TUỲ CHỌN duy nhất. Gỡ nạp huỷ việc đang chờ và đang chạy của nó; một
   * provider THAY THẾ được đăng ký ngay khi việc gỡ đã bắt đầu, và kết quả muộn của provider đang
   * đóng không bao giờ cam kết.
   * Nhận: định danh, nhịp sinh và hàm sinh của provider.
   * Trả: ĐÚNG hàm dọn hiệu ứng cordis — tất toán sau khi các lời gọi đang chạy lắng xuống.
   */
  register(provider: SessionTitleProvider): () => Promise<void> {
    this.validateProvider(provider);
    if (this.registration !== undefined && !this.registration.closing) {
      throw new Error(`session-title provider "${this.registration.provider.id}" is already registered`);
    }
    const registration: Registration = {
      provider,
      active: new Set<Promise<unknown>>(),
      closing: false,
    };
    const dispose = async (): Promise<void> => {
      registration.closing = true;
      for (const state of this.work.values()) {
        if (state.pending?.registration === registration) delete state.pending;
        if (state.active?.registration === registration) {
          state.active.controller.abort(
            new Error(`session-title provider "${provider.id}" was disposed`),
          );
        }
      }
      await this.drain(registration.active);
      if (this.registration === registration) this.registration = undefined;
    };
    // Trả ĐÚNG hàm dọn của hiệu ứng cordis (nguyên văn bản gốc): gọi nó vừa chạy phần dọn của ta
    // vừa rút hiệu ứng khỏi fiber, nên gỡ nạp sau đó KHÔNG chạy dọn lần hai.
    return this.host.effect(() => {
      this.registration = registration;
      return dispose;
    }, "sessionTitle.register()") as () => Promise<void>;
  }

  /**
   * Lên lịch phép dự phòng và nhịp provider (nếu có) cho MỘT sự kiện hợp lệ.
   * Nhận: phiên và sự kiện vừa cam kết.
   * Trả: không — việc nặng được đẩy sang `defer` nên đường sự kiện không bị chặn.
   */
  private onUserMessage(session: Session, event: SessionEvent): void {
    if (!this.serviceActive()) return;
    const data = event.data as UserMessageData;
    if (data.source.kind !== "user" || sessionTitleUserMessageOf(event) === undefined) return;
    if (this.get(session)?.source.kind === "user") return;
    const registration = this.registration;
    if (registration !== undefined && !registration.closing) {
      const count = this.titleInputOf(session).count;
      if (
        registration.provider.automatic === "all-prompts" ||
        (session.header.parentSession === undefined && count === 1 && this.get(session) === undefined)
      ) {
        const state = this.stateFor(session);
        state.pending = {
          registration,
          revision: this.supersede(state, "newer user message superseded title generation"),
          throughSeq: event.seq,
        };
      }
    }
    this.defer(async () => {
      try {
        await this.ensureFallback(session);
      } catch (error) {
        if (!this.serviceActive()) return;
        this.host.logger.warn(
          `session "${session.id}": fallback title update failed: ${String(error)}`,
        );
      }
    });
  }

  /**
   * Chỉ khởi động việc tự động ĐANG CHỜ sau khi ĐÚNG tuyến yêu cầu chính của nó đã vào log.
   * Nhận: phiên và sự kiện `request/header` vừa cam kết.
   * Trả: không.
   */
  private onRequestHeader(session: Session, event: SessionEvent): void {
    if (!this.serviceActive()) return;
    const state = this.work.get(session);
    const pending = state?.pending;
    if (state === undefined || pending === undefined || pending.throughSeq >= event.seq) return;
    const data = event.data as RequestHeaderData;
    const route: SessionTitleModelIdentity = {
      provider: data.header.config.provider,
      model: data.header.config.model,
    };
    this.startPending(session, state, pending, route);
  }

  /**
   * Khởi động việc của tuyến KHÔNG ĐỔI từ yêu cầu vòng agent đã đánh dấu, sau khi phép gộp đầu yêu
   * cầu đã hiện hành.
   * Nhận: tuỳ chọn của lời gọi `llm/stream`.
   * Trả: không.
   */
  private onMainRequest(options: LlmStreamOptions): void {
    if (
      !this.serviceActive() ||
      options.sessionId === undefined ||
      !isAgentLoopRequest(options as unknown as Parameters<typeof isAgentLoopRequest>[0])
    ) {
      return;
    }
    const session = this.host.sessions.get(options.sessionId);
    const state = session === undefined ? undefined : this.work.get(session);
    const pending = state?.pending;
    if (session === undefined || state === undefined || pending === undefined) return;
    const boundary = (
      this.host.sessionProjections.stateOf(session, "turnBoundary") as
        | {
            /** Ranh giới bước cuối của lượt đang mở. */
            readonly lastStepBoundary?: {
              /** Loại ranh giới; chỉ `start` mới mở lượt. */
              readonly kind: string;
              /** Seq của ranh giới. */
              readonly seq: SessionSeq;
            };
          }
        | undefined
    )?.lastStepBoundary;
    const route = session.requestHeader()?.config;
    if (boundary?.kind !== "start" || route === undefined) return;
    if (route.provider !== options.provider || route.model !== options.model) return;
    this.startPending(session, state, pending, {
      provider: options.provider,
      model: options.model,
    });
  }

  /**
   * Tiêu thụ MỘT phiên bản đang chờ và lên lịch lời gọi provider KHÔNG chặn.
   * Nhận: phiên, trạng thái phiên đó, phiên bản đang chờ, và tuyến vừa xác định.
   * Trả: không.
   */
  private startPending(
    session: Session,
    state: WorkState,
    pending: Pending,
    route: SessionTitleModelIdentity,
  ): void {
    delete state.pending;
    this.defer(async () => {
      if (
        this.registration !== pending.registration ||
        pending.registration.closing ||
        this.work.get(session) !== state ||
        state.revision !== pending.revision
      ) {
        return;
      }
      const work = this.activate(pending, state);
      try {
        await this.startProvider(session, work, route);
      } catch (error) {
        if (work.signal.aborted || !this.serviceActive()) return;
        this.host.logger.warn(
          `session "${session.id}": automatic title generation failed: ${String(error)}`,
        );
      }
    });
  }

  /**
   * Xuất bản phiên bản đang hoạt động rồi khởi động MỘT lời gọi provider đã theo dõi.
   * Nhận: phiên, lời gọi đã kích hoạt, và tuyến (nếu có).
   * Trả: lời hứa của lời gọi — giữ trong hai sổ vòng đời tới khi tất toán.
   */
  private startProvider(
    session: Session,
    work: ActiveWork,
    route?: SessionTitleModelIdentity,
  ): Promise<SessionTitleSnapshot | undefined> {
    const run = Promise.resolve().then(() => this.runProvider(session, work, route));
    return this.track(run, work.registration);
  }

  /**
   * Thi hành và nhận MỘT phiên bản provider đang hiện hành.
   * Nhận: phiên, lời gọi đã kích hoạt, và tuyến (nếu có).
   * Trả: ảnh chụp tiêu đề sau khi cam kết, hoặc `undefined`.
   */
  private async runProvider(
    session: Session,
    work: ActiveWork,
    route?: SessionTitleModelIdentity,
  ): Promise<SessionTitleSnapshot | undefined> {
    try {
      this.assertCurrent(session, work);
      await this.ensureFallback(session);
      this.assertCurrent(session, work);
      const events = session.snapshotEvents();
      const messages = collectSessionTitleMessages(events, work.throughSeq);
      const currentTitle = foldSessionTitle(events);
      const result = await work.registration.provider.generate({
        session,
        messages,
        ...(route === undefined ? {} : { route }),
        ...(currentTitle === undefined ? {} : { currentTitle }),
        signal: work.signal,
      });
      this.assertCurrent(session, work);
      const accepted = this.validateResult(result, messages);
      session.append("session/title", {
        title: accepted.title,
        messageSeqs: [...accepted.messageSeqs],
        source: {
          kind: "provider",
          provider: work.registration.provider.id,
          ...(accepted.model === undefined ? {} : { model: accepted.model }),
        },
      });
      return this.get(session);
    } finally {
      const state = this.work.get(session);
      if (state?.active === work) delete state.active;
    }
  }

  /**
   * Kiểm và chuẩn hoá đầu ra provider dựa trên ảnh chụp tin nhắn đã cấp.
   * Nhận: kết quả provider trả và các tin hợp lệ của lần sinh đó.
   * Trả: kết quả đã chuẩn hoá (tiêu đề đã cắt biên, seq đã đóng dấu, tuyến đã sao).
   * Ném: `Error` với đúng câu của bản gốc cho từng dạng hỏng.
   */
  private validateResult(
    result: SessionTitleProviderResult,
    messages: readonly SessionTitleUserMessage[],
  ): SessionTitleProviderResult {
    if (result === null || typeof result !== "object") {
      throw new Error("session-title provider returned an invalid result");
    }
    const candidate = result;
    if (typeof candidate.title !== "string") {
      throw new Error("session-title provider title must be a string");
    }
    const title = normalizeSessionTitle(candidate.title, this.config.maxTitleBytes);
    if (title.length === 0) throw new Error("session-title provider returned an empty title");
    if (!Array.isArray(candidate.messageSeqs) || candidate.messageSeqs.length === 0) {
      throw new Error("session-title provider must identify at least one source message seq");
    }
    const messageSeqs: SessionSeq[] = [];
    const order = new Map<SessionSeq, number>(
      messages.map((message, index) => [message.seq, index] as const),
    );
    let previous = -1;
    for (const seq of candidate.messageSeqs) {
      if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) {
        throw new Error("session-title provider messageSeqs must be unique, ordered seqs from the request");
      }
      const sessionSeq = SessionSeq(seq);
      const index = order.get(sessionSeq);
      if (index === undefined || index <= previous) {
        throw new Error("session-title provider messageSeqs must be unique, ordered seqs from the request");
      }
      messageSeqs.push(sessionSeq);
      previous = index;
    }
    const modelCandidate: unknown = candidate.model;
    let model: SessionTitleModelIdentity | undefined;
    if (modelCandidate !== undefined) {
      if (modelCandidate === null || typeof modelCandidate !== "object") {
        throw new Error("session-title provider result model must contain non-empty provider and model strings");
      }
      const record = modelCandidate as SessionTitleModelIdentity;
      if (
        typeof record.provider !== "string" ||
        record.provider.length === 0 ||
        typeof record.model !== "string" ||
        record.model.length === 0
      ) {
        throw new Error("session-title provider result model must contain non-empty provider and model strings");
      }
      model = { provider: record.provider, model: record.model };
    }
    return {
      title,
      messageSeqs,
      ...(model === undefined ? {} : { model }),
    };
  }

  /**
   * Làm hỏng một lần hoàn tất có provider, phiên bản, phiên hoặc tín hiệu đã cũ.
   * Nhận: phiên và lời gọi cần kiểm.
   * Trả: không; ném `Error` khi trạng thái đã đổi mà tín hiệu KHÔNG bị huỷ.
   */
  private assertCurrent(session: Session, work: ActiveWork): void {
    this.assertServiceActive();
    work.signal.throwIfAborted();
    const state = this.work.get(session);
    if (
      this.registration !== work.registration ||
      state?.active !== work ||
      state.revision !== work.revision ||
      this.host.sessions.get(session.id) !== session
    ) {
      throw new Error("session title generation state changed without cancellation");
    }
  }

  /**
   * Tạo và xuất bản MỘT lời gọi đang hoạt động từ một phiên bản cố định.
   * Nhận: phiên bản đang chờ, trạng thái phiên, và tín hiệu thượng nguồn (tuỳ chọn).
   * Trả: lời gọi đã kích hoạt — tín hiệu của nó là HỢP của huỷ riêng, vòng đời dịch vụ và thượng nguồn.
   */
  private activate(pending: Pending, state: WorkState, upstream?: AbortSignal): ActiveWork {
    const controller = new AbortController();
    const signal =
      upstream === undefined
        ? AbortSignal.any([controller.signal, this.lifetime.signal])
        : AbortSignal.any([controller.signal, this.lifetime.signal, upstream]);
    const work: ActiveWork = { ...pending, controller, signal };
    state.active = work;
    return work;
  }

  /**
   * Huỷ việc đang hoạt động CŨ và cấp số phiên bản kế tiếp của phiên.
   * Nhận: trạng thái phiên và lý do huỷ (nguyên văn đi vào `Error` của tín hiệu).
   * Trả: số phiên bản MỚI.
   */
  private supersede(state: WorkState, reason: string): number {
    state.active?.controller.abort(new Error(reason));
    delete state.pending;
    state.revision += 1;
    return state.revision;
  }

  /**
   * Trả trạng thái khả biến của MỘT phiên, tạo khi chưa có.
   * Nhận: phiên.
   * Trả: trạng thái khả biến (số phiên bản bắt đầu từ 0).
   */
  private stateFor(session: Session): WorkState {
    let state = this.work.get(session);
    if (state === undefined) {
      state = { revision: 0 };
      this.work.set(session, state);
    }
    return state;
  }

  /**
   * Đọc trạng thái ĐÃ GỘP của đơn vị chiếu `titleInput` trên một phiên.
   * Nhận: phiên.
   * Trả: đầu vào tiêu đề hợp lệ (tin đầu, số tin, seq tin cuối).
   */
  private titleInputOf(session: Session): TitleInputState {
    return this.host.sessionProjections.stateOf(session, "titleInput") as TitleInputState;
  }

  /**
   * Xếp MỘT việc tách rời vào hàng đợi của dịch vụ và giữ nó tới khi dịch vụ gỡ.
   * Nhận: hàm thi hành việc đó.
   * Trả: không.
   */
  private defer(task: () => Promise<void>): void {
    const run = Promise.resolve().then(async () => {
      if (!this.serviceActive()) return;
      await task();
    });
    this.track(run);
  }

  /**
   * Giữ MỘT lời hứa trong sổ vòng đời (và sổ của provider) cho tới khi tất toán.
   * Nhận: lời hứa và lần đăng ký sở hữu nó (tuỳ chọn).
   * Trả: CHÍNH lời hứa đó.
   */
  private track<T>(run: Promise<T>, registration?: Registration): Promise<T> {
    this.inFlight.add(run);
    registration?.active.add(run);
    const settled = (): void => {
      this.inFlight.delete(run);
      registration?.active.delete(run);
    };
    run.then(settled, settled);
    return run;
  }

  /**
   * Đợi MỌI lời hứa đang có và đang tất toán trong một sổ vòng đời.
   * Nhận: sổ cần rút cạn.
   * Trả: không — vòng lặp dừng khi sổ rỗng (lời hứa mới sinh trong lúc đợi cũng được đợi).
   */
  private async drain(active: Set<Promise<unknown>>): Promise<void> {
    while (active.size > 0) await Promise.allSettled([...active]);
  }

  /**
   * Cho biết fiber sở hữu còn được phép BẮT ĐẦU hoặc CAM KẾT việc tiêu đề hay không.
   * Nhận: không.
   * Trả: `true` khi vòng đời chưa huỷ, fiber còn uid và đang ở trạng thái chạy (`2`).
   */
  private serviceActive(): boolean {
    return !this.lifetime.signal.aborted && this.ownerFiber.uid !== null && this.ownerFiber.state === 2;
  }

  /**
   * Từ chối việc mới khi fiber sở hữu đã bắt đầu gỡ nạp.
   * Nhận: không.
   * Trả: không; ném `Error` khi dịch vụ đã bị gỡ.
   */
  private assertServiceActive(): void {
    if (!this.serviceActive()) throw new Error("session-title service disposed");
  }

  /**
   * Từ chối MỘT lần đăng ký provider hỏng TRƯỚC khi xuất bản hiệu ứng.
   * Nhận: provider cần kiểm.
   * Trả: không; ném `Error` với đúng câu của bản gốc cho từng dạng hỏng.
   */
  private validateProvider(provider: SessionTitleProvider): void {
    if (provider === null || typeof provider !== "object") {
      throw new Error("session-title provider must be an object");
    }
    const candidate = provider;
    if (typeof candidate.id !== "string" || candidate.id.length === 0) {
      throw new Error("session-title provider id must be a non-empty string");
    }
    if (candidate.automatic !== "first-prompt" && candidate.automatic !== "all-prompts") {
      throw new Error("session-title provider automatic mode is invalid");
    }
    if (typeof candidate.generate !== "function") {
      throw new Error(`session-title provider "${candidate.id}" requires generate()`);
    }
  }

  /**
   * Suy và ghi tiêu đề dự phòng tất định ĐÈ LÊN bất cứ thứ gì đang có (đường bỏ ghim của
   * `refresh`: ghi đè tiêu đề người dùng đã ghim CHÍNH LÀ mục đích). Đồng bộ có chủ đích — không
   * `await` nào được xen giữa suy và ghi, nên nó không cần gộp trùng của `ensureFallback` và cũng
   * không cần kiểm lại "còn sống". Phép dự phòng không suy được (rỗng sau các trần) thì KHÔNG ghi gì.
   * Nhận: phiên và tin hợp lệ ĐẦU.
   * Trả: không.
   */
  private appendFallback(session: Session, first: SessionTitleUserMessage): void {
    const title = fallbackSessionTitle(first.text, this.config.fallbackMaxWords, this.config.fallbackMaxBytes);
    if (title.length === 0) return;
    session.append("session/title", {
      title,
      messageSeqs: [first.seq],
      source: { kind: "fallback" },
    });
  }

  /**
   * Tạo tiêu đề dự phòng tất định ĐẦU TIÊN nếu phiên vẫn chưa có tiêu đề — gộp nhiều lời gọi đồng
   * thời vào MỘT lời hứa để chỉ MỘT sự kiện được ghi.
   * Nhận: phiên.
   * Trả: tiêu đề đã nhận (hoặc đã có sẵn), hay `undefined` khi không có tin hợp lệ / dự phòng rỗng.
   */
  private async ensureFallback(session: Session): Promise<SessionTitleSnapshot | undefined> {
    this.assertServiceActive();
    const current = this.get(session);
    if (current !== undefined) return current;
    const first = this.titleInputOf(session).first;
    if (first === null) return undefined;
    const title = fallbackSessionTitle(first.text, this.config.fallbackMaxWords, this.config.fallbackMaxBytes);
    if (title.length === 0) return undefined;
    const state = this.stateFor(session);
    if (state.fallback !== undefined) return state.fallback;
    const fallback: Promise<SessionTitleSnapshot | undefined> = Promise.resolve().then(() => {
      this.assertServiceActive();
      if (this.host.sessions.get(session.id) !== session) {
        throw new Error(`session "${session.id}" is not live in this store`);
      }
      const accepted = this.get(session);
      if (accepted !== undefined) return accepted;
      session.append("session/title", {
        title,
        messageSeqs: [first.seq],
        source: { kind: "fallback" },
      });
      return this.get(session);
    });
    state.fallback = fallback;
    try {
      return await fallback;
    } finally {
      delete state.fallback;
    }
  }
}

/** Định danh provider đã đóng dấu — tái xuất cho nơi chỉ cần kiểu. */
export type { SessionTitleProviderId };
