/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nua client cua row ui-user-questions (1:1 lib/types/client/index.js): so the cau hoi, waterfall user-questions, composer takeover va bong bong tra loi muon
 */

import { brandString } from "./brand.ts";
import { createQuestionComposer } from "./question-composer.ts";
import { PendingQuestion, createWaterfallRequest, type QuestionRpcChannel } from "./contract.ts";
import { deferred } from "./deferred.ts";
import { createQuestionDraftStore, type QuestionDraftStoreHandle } from "./draft-store.ts";
import { EFFECT, INJECT, NS, PANELS_SERVICE, PRIORITY, REQUEST_EVENT } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { questionReplyDefinition } from "./question-reply.ts";
import { createQuestionReplyView } from "./question-reply-view.ts";
import type { PanelRuntime } from "./plan-review-panel.ts";
import type {
  ClientContext,
  InboxProjection,
  JsxRuntime,
  PrimitivesSeam,
  QuestionProjectionRow,
  QuestionRequest,
  QuestionWaitClaim,
  QuestionWaitClaimChunk,
  ReactRuntime,
  RemoteResult,
  RequireFn,
  SessionBinding,
  SessionId,
  ToolCallId,
  UserQuestionAnswerItem,
  UserQuestionItem,
  UserQuestionsProjection,
} from "./types.ts";

/** Bề mặt plugin mà Loader nhận từ bundle. */
export interface ClientPlugin {
  /** Seam mà fiber của row cần trước khi `apply` chạy. */
  inject: string[];
  /** Cài copy, sổ thẻ, service panel, composer takeover, node trả lời muộn và consumer waterfall. */
  apply: (ctx: ClientContext) => void;
}

/** Hồ sơ câu hỏi mà service `userQuestionPanels` nhận để dựng thẻ đọc-lại. */
export interface QuestionRecord {
  /** Câu hỏi của lời gọi đã xong. */
  readonly questions: readonly UserQuestionItem[];
  /** Câu trả lời đã ghi của lời gọi đó. */
  readonly answers: readonly UserQuestionAnswerItem[];
}

/** Một thẻ đã công bố vào ghế composer, do sổ thẻ sở hữu. */
interface QuestionCard {
  /** Carrier của thẻ. */
  readonly pending: PendingQuestion;
  /** Rút panel khỏi ghế composer. */
  hide: () => void;
  /** Công bố lại panel vào ghế. */
  reveal: () => void;
  /** Gỡ thẻ khỏi sổ và đóng carrier. */
  remove: () => void;
  /** Theo dõi một yêu cầu đang chạy; trả hàm bỏ theo dõi. */
  trackRequest: (completion: Promise<void>) => () => void;
  /** Còn yêu cầu nào đang chạy trên thẻ này không. */
  hasRequest: () => boolean;
}

/** Hàm công bố một carrier vào ghế composer; trả hàm rút nó ra. */
type PublishCard = (pending: PendingQuestion, onDelegate: () => Promise<void>) => () => void;

/**
 * Các thẻ đã công bố vào sổ "pending interaction" của phiên, khoá theo `PendingQuestion.key`. Thẻ khoá theo
 * lời gọi công cụ được chia sẻ bởi waterfall được chuyển tiếp và mặt chiếu của phiên.
 *
 * Một thẻ sống lâu hơn ghế của nó. Đóng panel chỉ rút nó khỏi ghế, nên yêu cầu vẫn trả lời được từ dòng lời
 * gọi công cụ; vì vậy sổ này — không phải sổ pending-interaction — quyết định khi nào một yêu cầu kết thúc.
 */
export class QuestionCards {
  /** Hàm công bố của sổ pending-interaction. */
  readonly publish: PublishCard;
  /** Thẻ theo khoá. */
  #cards = new Map<string, QuestionCard>();

  /**
   * Nhận: publish — hàm công bố của sổ pending-interaction.
   * Trả: không (khởi tạo sổ thẻ rỗng).
   */
  constructor(publish: PublishCard) {
    this.publish = publish;
  }

  /**
   * Thẻ của một lời gọi công cụ, nếu có.
   * Nhận: sessionId — phiên sở hữu; callId — lời gọi công cụ.
   * Trả: thẻ tương ứng, hoặc undefined.
   */
  byCallId(sessionId: SessionId, callId: string): QuestionCard | undefined {
    return this.#cards.get(PendingQuestion.keyOf(sessionId, callId));
  }

  /**
   * Trạng thái quan sát được của một thẻ trong khi sổ còn giữ nó.
   * Nhận: key — khoá thẻ.
   * Trả: carrier của thẻ, hoặc undefined khi thẻ đã rời sổ.
   */
  source(key: string): PendingQuestion | undefined {
    return this.#cards.get(key)?.pending;
  }

  /**
   * Mọi thẻ đang có, theo thứ tự chèn.
   * Nhận: không.
   * Trả: danh sách thẻ.
   */
  values(): QuestionCard[] {
    return [...this.#cards.values()];
  }

  /**
   * Khoá của mọi thẻ đang đăng ký cho một phiên.
   * Nhận: sessionId — phiên cần đọc.
   * Trả: các khoá thẻ của phiên đó.
   */
  keysFor(sessionId: SessionId): string[] {
    return this.values()
      .filter((card) => card.pending.sessionId === sessionId)
      .map((card) => card.pending.key);
  }

  /**
   * Trả thẻ của một lời gọi công cụ, tạo và công bố khi chưa có. Yêu cầu không có lời gọi luôn nhận thẻ mới.
   * Nhận: sessionId — phiên sở hữu; questions — cả lô câu hỏi; callId — lời gọi công cụ khi Host đặt tên.
   * Trả: thẻ đã có hoặc vừa tạo.
   */
  ensure(sessionId: SessionId, questions: readonly UserQuestionItem[], callId: string | undefined): QuestionCard {
    if (callId !== undefined) {
      const existing = this.byCallId(sessionId, callId);
      if (existing !== undefined) return existing;
    }
    return this.#create(new PendingQuestion(sessionId, questions, callId as ToolCallId | undefined, () => this.keysFor(sessionId)));
  }

  /**
   * Công bố một carrier vào ghế composer và đăng ký thẻ sở hữu nó.
   * Nhận: pending — carrier cần công bố.
   * Trả: thẻ vừa đăng ký.
   */
  #create(pending: PendingQuestion): QuestionCard {
    const requests = new Set<Promise<void>>();
    const delegate = async (): Promise<void> => {
      pending.delegate();
      await Promise.all(requests);
    };
    let unpublish: (() => void) | undefined = this.publish(pending, delegate);
    const card: QuestionCard = {
      pending,
      hide: () => {
        unpublish?.();
        unpublish = void 0;
      },
      reveal: () => {
        unpublish?.();
        unpublish = this.publish(pending, delegate);
      },
      remove: () => {
        if (this.#cards.get(pending.key) !== card) return;
        this.#cards.delete(pending.key);
        pending.close();
        unpublish?.();
        unpublish = void 0;
      },
      trackRequest: (completion) => {
        requests.add(completion);
        return () => {
          requests.delete(completion);
        };
      },
      hasRequest: () => requests.size > 0,
    };
    pending.attachSeat({ hide: pending.review === void 0 ? card.hide : card.remove });
    this.#cards.set(pending.key, card);
    return card;
  }

  /**
   * Hiện panel của một lời gọi công cụ còn trả lời được.
   * Nhận: sessionId — phiên của lời gọi; callId — lời gọi `ask_user_question` cần hiện panel, như dòng
   * transcript của nó viết.
   * Trả: thẻ của lời gọi đó còn trả lời được không.
   */
  reveal(sessionId: SessionId, callId: string): boolean {
    const card = this.byCallId(sessionId, callId);
    if (card === undefined) return false;
    card.reveal();
    return true;
  }

  /**
   * Hiện câu trả lời đã ghi của một lời gọi đã xong dưới dạng thẻ đọc-lại. Lời gọi mà bằng cách nào đó vẫn
   * còn thẻ thì hiện đúng như nó đang là, nên một yêu cầu sống không bao giờ bị thay bằng bản sao cũ của nó.
   * Nhận: sessionId — phiên của lời gọi; callId — lời gọi `ask_user_question` cần hiện bản ghi, như dòng
   * transcript của nó viết; record — câu hỏi và câu trả lời đã ghi của lời gọi.
   * Trả: true; một bản ghi luôn cho ra thẻ.
   */
  review(sessionId: SessionId, callId: string, record: QuestionRecord): boolean {
    (this.byCallId(sessionId, callId) ??
      this.#create(new PendingQuestion(sessionId, record.questions, brandString<ToolCallId>(callId), () => this.keysFor(sessionId), record.answers))).reveal();
    return true;
  }

  /**
   * Trao mọi waterfall đang sống lại khi plugin gỡ. Sổ pending-interaction chỉ rút những gì nó đang giữ, mà
   * một thẻ bị ẩn thì không ở trong đó, nên yêu cầu của Host sẽ chờ chính lần abort của nó.
   * Nhận: không.
   * Trả: không.
   */
  dispose(): void {
    for (const card of this.values()) {
      card.pending.delegate();
      card.remove();
    }
  }
}

/**
 * Trình bày một yêu cầu được chuyển tiếp qua thẻ của nó cho tới khi waterfall kết thúc.
 * Nhận: ctx — context gốc của client; owner — chủ sở hữu phạm vi của listener; request — yêu cầu hỏi;
 * next — hàm chuyển tiếp waterfall; cards — sổ thẻ.
 * Trả: câu trả lời, hoặc kết quả của listener kế tiếp khi bị chuyển tiếp.
 */
async function answerQuestion(
  ctx: ClientContext,
  owner: unknown,
  request: QuestionRequest,
  next: () => unknown,
  cards: QuestionCards,
): Promise<unknown> {
  const sessionId = ctx.sessions.scopeOf(owner);
  if (sessionId === void 0) return next();
  const callId = request.wait?.callId;
  const card = cards.ensure(sessionId, request.questions, callId);
  const claimLifetime = new AbortController();
  const claimSignal = request.signal === void 0 ? claimLifetime.signal : AbortSignal.any([claimLifetime.signal, request.signal]);
  let claim: QuestionWaitClaim | undefined;
  let claimEnded: Promise<void> | undefined;
  let delegateRequest: (() => void) | undefined;
  const releaseClaim =
    request.wait?.timed === true && callId !== undefined
      ? ctx.effect(() => {
          claim = ctx.remote.userQuestions.attachWait(sessionId, callId, claimSignal);
          return async () => {
            delegateRequest?.();
            claimLifetime.abort();
            claim?.dispose();
            if (claimEnded !== void 0) await Promise.allSettled([claimEnded]);
          };
        }, EFFECT.claim)
      : void 0;
  const completed = deferred<void>();
  const finishRequest = card.trackRequest(completed.promise);
  try {
    const iterator = claim?.[Symbol.asyncIterator]();
    const opening = iterator === void 0 ? void 0 : await iterator.next();
    if (opening?.done === true) return await next();
    const remainingMs = opening === void 0 ? void 0 : (opening.value as QuestionWaitClaimChunk).remainingMs;
    const waterfall = createWaterfallRequest(remainingMs === void 0 ? void 0 : Date.now() + remainingMs, claimSignal, (channel) => {
      card.pending.detachWaterfall(channel);
    });
    if (claimSignal.aborted) return await waterfall.result;
    delegateRequest = () => {
      waterfall.channel.delegate();
    };
    card.pending.attachWaterfall(waterfall.channel);
    if (iterator !== void 0)
      claimEnded = (async () => {
        await iterator.next();
        throw new Error("the foreground question wait ended");
      })();
    try {
      return await (claimEnded === void 0 ? waterfall.result : Promise.race([waterfall.result, claimEnded]));
    } catch (error) {
      if (waterfall.isDelegation(error)) {
        await releaseClaim?.();
        return await next();
      }
      throw error;
    }
  } finally {
    if (releaseClaim === void 0) claimLifetime.abort();
    else if (claimEnded === void 0) await releaseClaim();
    else
      Promise.allSettled([claimEnded]).then(() => {
        releaseClaim();
      });
    if (callId === void 0) card.remove();
    completed.resolve();
    finishRequest();
  }
}

/**
 * Soi các lời gọi còn trả lời được lên thẻ. Một câu trả lời đã gửi trong Inbox bền sẽ gỡ thẻ sửa được cho tới
 * khi câu trả lời được nhận hoặc bị bỏ.
 * Nhận: ctx — context gốc của client; cards — sổ thẻ.
 * Trả: hàm gỡ theo dõi.
 */
function publishContinuedQuestions(ctx: ClientContext, cards: QuestionCards): () => void {
  const sessions = ctx.sessions;
  const stopProjections = new Map<SessionId, () => void>();
  const unwrap = <T>(result: RemoteResult<T>): T => {
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const rpcFor = (sessionId: SessionId, callId: string): QuestionRpcChannel => ({
    answer: async (answer) => unwrap(await ctx.remote.userQuestions.answer(sessionId, callId, answer)) as boolean,
  });
  const reconcile = (): void => {
    const snapshot = sessions.list.getSnapshot();
    const bound = new Map<SessionId, SessionBinding>(
      Object.values(snapshot.byId).flatMap((summary) => {
        const binding = sessions.binding(summary.id);
        return binding === void 0 ? [] : [[summary.id, binding] as const];
      }),
    );
    for (const [sessionId, stop] of stopProjections) {
      if (bound.has(sessionId)) continue;
      stop();
      stopProjections.delete(sessionId);
    }
    for (const [sessionId, binding] of bound) {
      if (stopProjections.has(sessionId)) continue;
      const stopQuestions = binding.session.projections.faceOf<UserQuestionsProjection>("userQuestions").subscribe(reconcile);
      const stopInbox = binding.session.projections.faceOf<InboxProjection>("inbox").subscribe(reconcile);
      stopProjections.set(sessionId, () => {
        stopQuestions();
        stopInbox();
      });
    }
    const rows = new Map<string, { readonly sessionId: SessionId; readonly row: QuestionProjectionRow }>();
    for (const [sessionId, binding] of bound) {
      const projected = binding.session.projections.faceOf<UserQuestionsProjection>("userQuestions").getSnapshot();
      const inbox = binding.session.projections.faceOf<InboxProjection>("inbox").getSnapshot();
      const queued = new Set<string>();
      for (const message of [...(inbox?.["next-step"] ?? []), ...(inbox?.["next-turn"] ?? [])]) {
        if (typeof message !== "object" || message === null || Array.isArray(message)) continue;
        const source = (message as { readonly source?: unknown }).source;
        if (typeof source !== "object" || source === null || Array.isArray(source)) continue;
        const sourceRecord = source as { readonly kind?: unknown; readonly callId?: unknown };
        if (sourceRecord.kind === "user-question-reply" && typeof sourceRecord.callId === "string") queued.add(sourceRecord.callId);
      }
      for (const row of projected?.active ?? []) {
        if (row.state === "continued" && queued.has(row.callId)) continue;
        rows.set(PendingQuestion.keyOf(sessionId, row.callId), { sessionId, row });
      }
    }
    for (const { sessionId, row } of rows.values()) {
      if (row.state === "continued") {
        const card = cards.ensure(sessionId, row.questions, row.callId);
        card.pending.attachRpc(rpcFor(sessionId, row.callId));
        card.pending.setState("continued");
        continue;
      }
      cards.byCallId(sessionId, row.callId)?.pending.setState("open");
    }
    for (const card of cards.values()) {
      if (card.pending.callId === void 0 || card.pending.review !== void 0 || rows.has(card.pending.key) || card.hasRequest() || card.pending.hasWaterfall()) continue;
      card.remove();
    }
  };
  reconcile();
  const stopList = sessions.list.subscribe(reconcile);
  return () => {
    stopList();
    for (const stop of stopProjections.values()) stop();
    stopProjections.clear();
  };
}

/**
 * Dựng mặt plugin của nửa browser.
 *
 * Chỉ `require` bốn specifier, đúng như bản gốc: `react/jsx-runtime`, `react`,
 * `@galaxy-blackhole/gbh-client-ui-primitives`, `@galaxy-blackhole/gbh-client-store`. Cả bốn được gọi LÚC VẬT CHẤT HOÁ
 * factory nên script chỉ đăng ký mà không kéo module nào (hợp đồng C2).
 * Nhận: requireFn — hàm require của bảng module.
 * Trả: plugin `{ inject, apply }` — hình dạng mà Loader của vỏ nhận.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntime;
  const reactRuntime = requireFn("react") as ReactRuntime;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesSeam;
  const storeModule = requireFn("@galaxy-blackhole/gbh-client-store") as { readonly defineStore: (spec: Record<string, unknown>) => QuestionDraftStoreHandle };
  const runtime: PanelRuntime = { ...jsxRuntime, ...reactRuntime };
  const QuestionComposer = createQuestionComposer(runtime, primitives);
  const QuestionReplyView = createQuestionReplyView(runtime, primitives);

  /**
   * Cài copy, sổ thẻ, service panel, composer takeover, node trả lời muộn và consumer waterfall.
   * Nhận: ctx — context gốc của client.
   * Trả: không.
   */
  function apply(ctx: ClientContext): void {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), EFFECT.dictionaries);
    const questionDraftStore = createQuestionDraftStore(storeModule.defineStore);
    const cards = new QuestionCards(
      ctx.uiSession.registerPendingInteraction((pending) => (pending.kind === "plan-review" ? PRIORITY.planReview : PRIORITY.question)),
    );
    ctx.effect(
      () => () => {
        cards.dispose();
      },
      EFFECT.cards,
    );
    const disposePanels = ctx.reflect.provide(PANELS_SERVICE, {
      reveal: (sessionId: SessionId, callId: string) => cards.reveal(sessionId, callId),
      review: (sessionId: SessionId, callId: string, record: QuestionRecord) => cards.review(sessionId, callId, record),
    });
    ctx.effect(() => disposePanels, EFFECT.panels);
    ctx.effect(() => publishContinuedQuestions(ctx, cards), EFFECT.continued);
    // Tên slot ghi thẳng bằng CHUỖI (không qua hằng) để `check:rows` đối chiếu được với bản gốc theo văn bản.
    ctx.slots.inject("conversation.composer", () =>
      ctx.slots.register(
        {
          name: "conversation.composer",
          select: ({ pendingInteraction }: { readonly pendingInteraction: unknown }) =>
            pendingInteraction instanceof PendingQuestion ? pendingInteraction : null,
          locale: NS,
          store: questionDraftStore,
          inject: () => ({ keyedHooks: { questionCard: (key: string) => cards.source(key) } }),
          children: {
            "conversation.plan-review.actions": {
              kind: "list",
              scope: "session",
            },
          },
        },
        QuestionComposer,
      ),
    );
    ctx.uiConversation.events.register(questionReplyDefinition);
    ctx.slots.inject("conversation.chat.node", () =>
      ctx.slots.register(
        {
          name: "conversation.chat.node",
          key: "question-reply",
          locale: NS,
        },
        QuestionReplyView,
      ),
    );
    ctx.remote.$on(REQUEST_EVENT, function (request, next) {
      return answerQuestion(ctx, this, request, next, cards);
    });
  }

  return { inject: [...INJECT], apply };
}
