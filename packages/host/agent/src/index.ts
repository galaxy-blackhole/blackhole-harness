/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dịch vụ Agent (`ctx.agents`): sổ agent ĐANG SỐNG, uỷ quyền tạo/resume cho factory do bộ điều
 *      khiển vòng chạy cấp, và phạm vi initiator theo TIẾN TRÌNH. Việc TẠO và ĐIỀU KHIỂN cụ thể
 *      thuộc row agent-loop. Viết lại theo hành vi của @deepseek-ai/dsh-agent (702 dòng build gốc).
 */

import { Service, getTraceable, symbols } from "@deepseek-ai/cordis";
import type { Context, Fiber } from "@deepseek-ai/cordis";
import { AsyncLocalStorage } from "node:async_hooks";
import { isPromise } from "node:util/types";
import { scopeTarget } from "@deepseek-ai/dsh-scope";
import { installTurnArchiveAdmission } from "./archive-admission.ts";
import { foldConsumedWork } from "./consumed-work.ts";
import { agentCarrier, agentEvents, assembleContextFor, emitAgentEvent } from "./dispatch.ts";
import { installModelSelection } from "./model-selection.ts";
import type {
  Agent,
  AgentCarrier,
  AgentFactory,
  AgentHandle,
  ArchiveAdmissionContext,
  CreateAgentOptions,
  ResumeAgentOptions,
  SessionId,
  SessionStartSource,
} from "./types.ts";

export { foldConsumedWork, installModelSelection, agentCarrier, agentEvents, assembleContextFor, emitAgentEvent };
export type {
  Agent,
  AgentCancelCause,
  AgentCarrier,
  AgentEventDispatch,
  AgentFactory,
  AgentHandle,
  AgentOptions,
  AgentSession,
  AgentSetup,
  AgentSetupCommit,
  AgentStatus,
  AgentUserMessage,
  ArchiveAdmissionContext,
  AssembleContext,
  CancelOptions,
  ConsumedWork,
  CreateAgentOptions,
  DispatchContext,
  EpochHeader,
  Inbox,
  InboxState,
  InboxTarget,
  LlmCallConfig,
  ModelSelection,
  ModelSelectionContext,
  ModelSelectionRef,
  PreStepDecision,
  RequestErrorAction,
  ResumeAgentOptions,
  SessionActivityKind,
  SessionEvent,
  SessionId,
  SessionStartSource,
  TurnEndReason,
} from "./types.ts";

/** Ném khi create/resume được gọi TRƯỚC khi một factory agent được đăng ký. */
const NO_FACTORY_MESSAGE = "no agent factory registered (load an agent-loop plugin)";

/** Ném khi không có agent khởi xướng nào đang hoạt động. */
const NO_INITIATOR_MESSAGE = "no initiating agent is active";

/** Ném khi phạm vi initiator của agent đã bị bỏ. */
const DISPOSED_INITIATOR_MESSAGE = "agent initiator scope is disposed";

/** Một mục ĐANG SỐNG trong sổ đăng ký. */
interface AgentEntry {
  /** Danh tính chia sẻ agent/phiên. */
  readonly id: SessionId;
  /** Agent đã dựng. */
  readonly agent: Agent;
  /** Chủ sở hữu lúc chạy, hoặc `undefined` khi là gốc. */
  readonly owner: Agent | undefined;
  /** Carrier phạm vi BẤT BIẾN của mục này (dựng một lần trong `enter`). */
  readonly carrier: AgentCarrier;
  /** Đã phát `agent/created` chưa. */
  announced: boolean;
  /** Đang phát `agent/created` (cờ chống tái nhập). */
  announcing: boolean;
  /** Yêu cầu gỡ ĐÃ tới trong lúc đang phát; gỡ sau khi chuỗi serial lắng. */
  detachRequested: boolean;
}

/** Một ranh giới initiator đang mở, kèm ranh giới CHA để gỡ đúng chuỗi khi bị bỏ. */
interface InitiatorRun {
  /** Ranh giới còn sống (đã gỡ thì không gỡ lại). */
  active: boolean;
  /** Ranh giới cha đang bao nó, nếu có. */
  readonly parent: InitiatorRun | undefined;
}

/** Phần bề mặt typert mà constructor của sổ đăng ký đăng ký (khai theo CẤU TRÚC). */
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
    /** Sổ context: biến một danh tính dây thành context host. */
    readonly contexts: {
      /**
       * Đăng ký một context host theo tên.
       * Nhận: `name` — tên context; `registration` — mô tả context (dây, dấu kiểu, tài nguyên).
       * Trả: không dùng (dịch vụ tự quản việc gỡ).
       */
      registerHost(name: string, registration: TypertContextRegistration): unknown;
    };
  };
}

/** Một mục đăng ký trong sổ tra cứu typert. */
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
  /** Giải một danh tính dây thành agent đang sống. */
  readonly resolve: (sessionId: SessionId) => Agent | undefined;
}

/** Một mục đăng ký trong sổ context của typert. */
interface TypertContextRegistration {
  /** Trường mang danh tính trên dây. */
  readonly wire: string;
  /** Dấu kiểu phía dây. */
  readonly wireTypeSymbol: string;
  /** Loại tài nguyên mà danh tính trỏ tới. */
  readonly resource: string;
  /** Giải một danh tính dây thành context theo scope của agent. */
  readonly resolve: (sessionId: SessionId) => Context | undefined;
}

/** `Promise.prototype.then` dưới chữ ký mà phép theo dõi ranh giới cần. */
type ThenCall = (this: Promise<unknown>, onFulfilled: () => void, onRejected: () => void) => Promise<unknown>;

/**
 * Agent service (`ctx.agents`): theo dõi agent đang sống và mang Agent KHỞI XƯỚNG qua MỘT chuỗi
 * driver bất đồng bộ trong cùng tiến trình. Việc TẠO agent do plugin nào cài đặt {@link AgentFactory}
 * cấp (`@deepseek-ai/dsh-agent-loop`), đăng ký qua {@link setFactory}.
 *
 * Các phương thức initiator chỉ cấp quy công NHÂN QUẢ trong cùng tiến trình. Có mặt trong phạm vi
 * KHÔNG phải bằng chứng sống còn, cũng không phải uỷ quyền; chủ thể và chủ sở hữu vẫn tường minh,
 * như danh tính ở biên worker, tiến trình, lưu trữ và dây. Các biên Promise được trả về sẽ được
 * rút cạn lúc dọn, TRỪ một dòng dõi lồng nhau tự khởi động việc gỡ fiber sở hữu — nó được miễn
 * khỏi chính phép rút cạn của mình.
 */
export class AgentRegistry extends Service {
  /** Agent đang sống, theo danh tính chia sẻ agent/phiên. */
  private readonly store = new Map<SessionId, AgentEntry>();

  /** Factory tạo agent đã đăng ký (đích ĐÃ bóc lớp traceable), nếu có. */
  private factory: { target: AgentFactory } | undefined;

  /** Agent khởi xướng kế thừa của chuỗi driver hiện tại. */
  private readonly initiators = new AsyncLocalStorage<Agent | undefined>();

  /** Ranh giới initiator đang mở (kể cả ranh giới XOÁ kế thừa), để đếm và rút cạn. */
  private readonly initiatorRuns = new AsyncLocalStorage<InitiatorRun | undefined>();

  /** Trạng thái phạm vi initiator: nhận ranh giới mới, đang đóng, hay đã bỏ. */
  private initiatorState: "active" | "closing" | "disposed" = "active";

  /** Số ranh giới đã mở mà chưa gỡ. */
  private activeInitiatorRuns = 0;

  /** Bộ giải mà lần rút cạn đang chờ, nếu có ranh giới còn mở. */
  private initiatorDrain: ReturnType<typeof Promise.withResolvers<void>> | undefined;

  /** Promise dọn phạm vi initiator (chạy MỘT lần, chia sẻ cho mọi bên chờ). */
  private initiatorDisposal: Promise<void> | undefined;

  /**
   * Đăng ký dịch vụ `agents` vào context của plugin, kèm hai sổ typert và hai mối nối sự kiện
   * lưu trữ (workspace/session-activity · workspace/session-stop).
   * Nhận: `ctx` — context host mà plugin được nạp vào.
   * Trả: không (thực thể service đã đăng ký tên `agents`).
   */
  constructor(ctx: Context) {
    super(ctx, "agents");
    ctx.inject(["typert"], (typeCtx) => {
      const { typert } = typeCtx as unknown as TypertSurface;
      typert.lookups.register("agent", {
        parameter: "agent",
        wire: "agentId",
        resource: "session",
        hostTypeSymbol: "@deepseek-ai/dsh-agent#Agent",
        wireTypeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
        resolve: (sessionId) => this.get(sessionId),
      });
      typert.contexts.registerHost("agent", {
        wire: "agentId",
        wireTypeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
        resource: "session",
        resolve: (sessionId) => this.get(sessionId)?.ctx,
      });
    });
    ctx.on("internal/status", (fiber) => {
      // 5 = UNLOADING (FiberState của cordis): fiber SỞ HỮU service này ĐANG gỡ ⇒ đóng phạm vi ngay,
      // để ranh giới initiator MỚI bị từ chối trong khi các phần tiếp nối kế thừa còn rút cạn.
      if (fiber.state === 5 && this.hasLifecycleAncestor(fiber)) this.closeInitiators();
    });
    ctx.effect(
      function* (this: AgentRegistry) {
        yield () => this.disposeInitiators();
        yield () => {
          this.closeInitiators();
        };
      }.bind(this),
      "agents.initiatorLifecycle()",
    );
    installTurnArchiveAdmission(ctx as unknown as ArchiveAdmissionContext, (sessionId) => this.get(sessionId));
  }

  /**
   * Đọc Agent đã khởi xướng chuỗi driver bất đồng bộ KẾ THỪA. Dùng dạng tuỳ chọn này cho log, trace,
   * metric hoặc quy công host mà vẫn phải chịu được lời gọi KHÔNG có agent. Khi cha tạo con, setup
   * báo cha NHÂN QUẢ trong khi tham số Agent của callback setup chỉ ra CON.
   * Nhận: không.
   * Trả: Agent kế thừa, hoặc `undefined` ngoài mọi ranh giới initiator và trong ranh giới xoá tường minh.
   * Ném: khi thực thể service này đã bị bỏ.
   */
  currentInitiator(): Agent | undefined {
    this.assertInitiatorsReadable();
    return this.initiators.getStore();
  }

  /**
   * Đọc Agent khởi xướng và NÉM khi không có ranh giới initiator nào đang mở. Dùng cho helper riêng
   * theo hợp đồng nằm DƯỚI driver, hoặc cho request ra ngoài do deployment sở hữu mà hợp đồng CẤM
   * lời gọi không agent. Đường gọi chung/direct dùng tra cứu tuỳ chọn hoặc trường request tường minh.
   * Nhận: không.
   * Trả: Agent kế thừa.
   * Ném: khi không initiator nào đang hoạt động, hoặc khi thực thể này đã bị bỏ.
   */
  requireInitiator(): Agent {
    const agent = this.currentInitiator();
    if (agent === undefined) throw new Error(NO_INITIATOR_MESSAGE);
    return agent;
  }

  /**
   * Chạy một thao tác với MỘT Agent chính xác làm initiator trong cùng tiến trình. Giá trị đồng bộ
   * hoặc Promise mà thao tác trả về được GIỮ NGUYÊN. Driver tự viết và giàn test bao trọn vòng đời
   * foreground mà chúng trả về. Một bộ nhận hàng đợi hay dây chỉ được dựng ranh giới này SAU khi đã
   * kiểm danh tính tường minh và giải đúng Agent đang sống; phương thức này không làm hộ việc đó.
   * Việc tách rời vẫn thuộc hệ thống đã khởi động nó.
   * Nhận: `agent` — Agent khởi xướng để kế thừa (có mặt không phải bằng chứng sống còn); `operation` —
   * thao tác đồng bộ hoặc bất đồng bộ cần gọi.
   * Trả: ĐÚNG giá trị mà `operation` trả về.
   * Ném: khi phạm vi initiator đang đóng/đã bỏ, hoặc khi `operation` ném.
   */
  withInitiator<T>(agent: Agent, operation: () => T): T {
    return this.runWithInitiator(agent, operation);
  }

  /**
   * Chạy một thao tác trong ranh giới GIẤU mọi Agent khởi xướng kế thừa. Giá trị đồng bộ hoặc
   * Promise được giữ nguyên. Dùng khi dựng timer dùng chung lười, bơm hàng đợi, bảo trì pool,
   * watcher hay exporter để chúng không kế thừa Agent ĐẦU TIÊN tình cờ khởi tạo chúng. Nó chỉ xoá
   * quy công initiator, không xoá trường tường minh, và không sở hữu hay rút cạn tài nguyên tách rời.
   * Nhận: `operation` — thao tác cần gọi mà không có initiator.
   * Trả: ĐÚNG giá trị mà `operation` trả về.
   * Ném: khi phạm vi initiator đang đóng/đã bỏ, hoặc khi `operation` ném.
   */
  withoutInitiator<T>(operation: () => T): T {
    return this.runWithInitiator(undefined, operation);
  }

  /**
   * Đăng ký factory TẠO agent (bộ điều khiển vòng chạy gọi hàm này khi khởi dựng, theo effect). Một
   * dịch vụ cordis ĐÃ traceable được chuẩn hoá về đích cụ thể; mỗi lời gọi create/resume sau đó được
   * trace qua context của CHÍNH bên gọi, nên quyền sở hữu đi theo bên gọi mà không xếp lớp proxy.
   * Ném nếu đã có factory được đăng ký. Trả hàm dọn; khi dọn thì ô factory được xoá.
   * Nhận: `factory` — factory do vòng chạy sở hữu, mà {@link create}/{@link resume} uỷ quyền cho.
   * Trả: hàm dọn xoá ô factory — ĐÚNG hàm dọn effect của Cordis (một lần): effect hợp (generator)
   * có thể `yield` thẳng nó để việc dọn lồng đúng thứ tự.
   */
  setFactory(factory: AgentFactory): () => void {
    return this.ctx.effect(() => {
      if (this.factory !== undefined) throw new Error("an agent factory is already registered");
      // Bóc `symbols.original` để receiver của mỗi lần create/resume là bên gọi, không phải service.
      const target = (factory as unknown as Record<symbol, AgentFactory | undefined>)[symbols.original] ?? factory;
      this.factory = { target };
      return () => {
        this.factory = undefined;
      };
    }, "agents.setFactory()");
  }

  /**
   * Trả factory tạo agent đang hoạt động.
   * Nhận: không.
   * Trả: mục factory (đích đã bóc lớp traceable).
   * Ném: khi chưa factory nào được đăng ký.
   */
  private requireFactory(): { target: AgentFactory } {
    if (this.factory === undefined) throw new Error(NO_FACTORY_MESSAGE);
    return this.factory;
  }

  /**
   * Tạo và công bố một agent MỚI qua factory đã đăng ký. Khác {@link register} (ghi một agent ĐÃ
   * dựng): phương thức này dựng agent và phiên của nó. Từ chối nếu chưa có factory hoặc tạo/setup
   * hỏng. {@link AgentHandle} đã giải cho chủ sở hữu gỡ ĐÚNG agent này.
   * Nhận: `options` — danh tính chia sẻ, agent cha đang sống tuỳ chọn, mồi/metadata phiên, tuỳ chọn agent.
   * Trả: handle sau khi setup, công bố có che cuộn ngược, và vòng chạy bắt đầu xong.
   */
  async create(options: CreateAgentOptions): Promise<AgentHandle> {
    const ownerCtx = this.ctx;
    const { target } = this.requireFactory();
    const receiver = getTraceable(ownerCtx, target);
    return Reflect.apply(target.createAgent, receiver, [ownerCtx, options]) as Promise<AgentHandle>;
  }

  /**
   * Nạp một phiên đã lưu và resume một agent trên đó qua factory đã đăng ký. Từ chối nếu chưa có
   * factory; factory từ chối nếu lưu trữ phiên chưa được cấu hình hoặc nạp/setup hỏng.
   * Nhận: `options` — danh tính đã lưu, agent cha đang sống tuỳ chọn, cấu hình, và setup.
   * Trả: handle sau khi setup, công bố có che cuộn ngược, và vòng chạy bắt đầu xong.
   */
  async resume(options: ResumeAgentOptions): Promise<AgentHandle> {
    const ownerCtx = this.ctx;
    const { target } = this.requireFactory();
    const receiver = getTraceable(ownerCtx, target);
    return Reflect.apply(target.resume, receiver, [ownerCtx, options]) as Promise<AgentHandle>;
  }

  /**
   * Ghi một agent đang sống với nguồn `startup`. Từ chối nếu id đã đăng ký hoặc một người nghe serial
   * `agent/created` hỏng. Phát `agent/disposed` khi fiber ĐANG GỌI bị bỏ — cả hai lần đều qua carrier
   * phạm vi của agent (`scopeTarget(agent, agent)`): chủ thể là agent đang cầm, nên phép phát được lọc
   * theo phạm vi bất kể context nào gọi `register` (gọi qua `agent.ctx` lọc EFFECT; phép phát theo
   * phạm vi LUÔN phải truyền carrier). Mục này là gốc lúc chạy; việc tạo qua factory dùng
   * `options.parentAgent` cho quyền sở hữu con. Hãy chờ đăng ký xong trước khi dùng agent.
   * Nhận: `agent` — agent ĐÃ dựng cần ghi vào sổ.
   * Trả: hàm dọn effect của Cordis có chờ được (một lần; gọi lặp lại trả `undefined` mà không chờ lần
   * dọn đang chạy). DANH TÍNH là thứ chịu lực: một effect hợp (generator) sở hữu THỨ TỰ dọn — chuỗi
   * vòng đời của factory agent — phải `yield` ĐÚNG hàm này để Cordis lồng việc gỡ đăng ký đúng vị trí
   * `yield`; `yield` một wrapper sẽ để nó dọn như anh em đồng thời khi chủ sở hữu bị gỡ.
   */
  register(agent: Agent): ReturnType<Context["effect"]> {
    return this.ctx.effect(
      async function* (this: AgentRegistry) {
        yield this.enter(agent, undefined);
        await this.announce(agent, "startup");
      }.bind(this),
      "agents.register()",
    );
  }

  /**
   * Chèn một agent ĐÃ dựng mà KHÔNG công bố. Đây là primitive vòng đời có thứ tự cho factory agent
   * bất đồng bộ: nó hoàn tất setup khi agent chưa công bố, gán closure detach trả về vào hàm dọn hợp
   * đã cài trước, rồi gọi {@link announce}. Người gọi thường dùng {@link register}.
   * Nhận: `agent` — agent đã dựng, chưa công bố; `owner` — chủ sở hữu runtime đang sống do bên gọi
   * nêu tường minh, hoặc `undefined` cho gốc runtime cấp cao. Đây là quyền sở hữu LÚC CHẠY, không
   * phải dòng dõi bền của phiên được resume.
   * Trả: closure luỹ đẳng bỏ ĐÚNG mục này và phát `agent/disposed` với lỗi người nghe đã bao; khi
   * được gọi từ một người nghe `agent/created`, việc bỏ và phát chờ chuỗi serial tạo lắng xong.
   */
  enter(agent: Agent, owner: Agent | undefined): () => void {
    const id = agent.id;
    if (id !== agent.session.id) throw new Error(`agent id "${id}" does not match session id "${agent.session.id}"`);
    const carrier = scopeTarget(agent, agent);
    if (this.store.has(id)) throw new Error(`agent "${id}" is already registered`);
    const entry: AgentEntry = {
      id,
      agent,
      owner,
      carrier,
      announced: false,
      announcing: false,
      detachRequested: false,
    };
    this.store.set(id, entry);
    let entered = true;
    const detach = (): void => {
      if (!entered) return;
      entered = false;
      if (entry.announcing) {
        entry.detachRequested = true;
        return;
      }
      this.detachEntered(entry);
    };
    return detach;
  }

  /**
   * Bỏ MỘT agent đã chèn và phát cặp sự kiện bỏ nếu nó đã công bố.
   * Nhận: `entry` — mục cần bỏ.
   * Trả: không.
   */
  private detachEntered(entry: AgentEntry): void {
    entry.detachRequested = false;
    // `enter()` từ chối thay thế khi khả năng detach một lần này còn sống, nên nhánh dưới chỉ là chốt.
    if (this.store.get(entry.id) !== entry) return;
    this.store.delete(entry.id);
    if (!entry.announced) return;
    this.emitDisposed(entry);
  }

  /**
   * Phát cặp sự kiện bỏ qua carrier ỔN ĐỊNH của mục.
   * Nhận: `entry` — mục đã công bố cần phát `agent/disposed`.
   * Trả: không; lỗi từng người nghe được ghi log và bao lại.
   */
  private emitDisposed(entry: AgentEntry): void {
    const args: unknown[] = [
      entry.carrier,
      "agent/disposed",
      { agent: entry.agent },
    ];
    for (const callback of this.ctx.events.dispatch("emit", args)) {
      try {
        const returned = callback(...args);
        Promise.resolve(returned).catch((error: unknown) => {
          this.ctx.logger.warn(`agent "${entry.id}": agent/disposed listener rejected: ${String(error)}`);
        });
      } catch (error) {
        this.ctx.logger.warn(`agent "${entry.id}": agent/disposed listener threw: ${String(error)}`);
      }
    }
  }

  /**
   * Công bố một agent đã chèn trước đó bằng {@link enter}.
   * Nhận: `agent` — agent đang sống đã chèn cần công bố; `source` — nguồn tạo mới, resume, clear, hay
   * compact; `signal` — tín hiệu huỷ khởi tạo của factory tuỳ chọn, truyền cho người nghe.
   * Trả: promise hoàn tất các người nghe serial `agent/created`; lỗi người nghe thì từ chối.
   * Ném: khi `agent` KHÔNG phải đúng mục đang sống của id nó, hoặc việc công bố tạo của nó đã bắt đầu
   * (kể cả lời gọi tái nhập từ một người nghe tạo).
   */
  async announce(agent: Agent, source: SessionStartSource, signal?: AbortSignal): Promise<void> {
    const entry = this.store.get(agent.id);
    if (entry === undefined || entry.agent !== agent) throw new Error(`agent "${agent.id}" is not live in this registry`);
    if (entry.announced || entry.announcing) throw new Error(`agent "${entry.id}" was already announced`);
    entry.announcing = true;
    entry.announced = true;
    try {
      // Bản gốc giữ đúng thứ tự: bật CẢ HAI cờ TRƯỚC khi chờ chuỗi serial.
      const serial = this.ctx.serial as unknown as (thisArg: unknown, name: string, payload: unknown) => Promise<unknown>;
      await serial(entry.carrier, "agent/created", {
        agent: entry.agent,
        source,
        ...(signal === undefined ? {} : { signal }),
      });
    } finally {
      entry.announcing = false;
      if (entry.detachRequested) this.detachEntered(entry);
    }
  }

  /**
   * Tra một agent đang sống.
   * Nhận: `id` — danh tính chia sẻ agent/phiên cần tra.
   * Trả: agent, hoặc `undefined` khi không agent sống nào mang id đó.
   */
  get(id: SessionId): Agent | undefined {
    return this.store.get(id)?.agent;
  }

  /**
   * Xét xem một agent đang sống có được TẠO qua context theo scope của ĐÚNG một agent cha hay không.
   * Quyền sở hữu lúc chạy độc lập với dòng dõi phiên bền, và vẫn rõ ràng khi các provider không liên
   * quan dùng lại một id.
   * Nhận: `id` — danh tính chia sẻ agent/phiên của con; `owner` — agent tạo lúc chạy được mong đợi.
   * Trả: `true` CHỈ khi mục con chính xác đang sống dưới chủ sở hữu đó.
   */
  isOwnedBy(id: SessionId, owner: Agent): boolean {
    return this.store.get(id)?.owner === owner;
  }

  /**
   * MỌI agent đang sống, theo thứ tự đăng ký.
   * Nhận: không.
   * Trả: mảng MỚI; sửa nó không ảnh hưởng sổ đăng ký.
   */
  list(): Agent[] {
    return [...this.store.values()].map((entry) => entry.agent);
  }

  /**
   * MỌI agent cấp cao đang sống, theo thứ tự đăng ký. Agent cấp cao được tạo KHÔNG có context chủ sở
   * hữu; dòng dõi phiên bền không ảnh hưởng quan hệ lúc chạy này, nên một fork được resume vẫn có thể
   * là gốc.
   * Nhận: không.
   * Trả: mảng MỚI; sửa nó không ảnh hưởng sổ đăng ký.
   */
  roots(): Agent[] {
    return [...this.store.values()].filter((entry) => entry.owner === undefined).map((entry) => entry.agent);
  }

  /**
   * Từ chối mọi ranh giới initiator MỚI trong khi các phần tiếp nối kế thừa đang rút cạn.
   * Nhận: không.
   * Trả: không.
   */
  private closeInitiators(): void {
    if (this.initiatorState === "active") this.initiatorState = "closing";
  }

  /**
   * Chờ các biên Promise ĐÃ TRẢ VỀ, rồi vô hiệu hoá mọi tham chiếu còn giữ.
   * Nhận: không.
   * Trả: promise dọn — chạy MỘT lần, chia sẻ cho mọi bên chờ.
   */
  private disposeInitiators(): Promise<void> {
    return this.initiatorDisposal ??= (async () => {
      this.closeInitiators();
      this.releaseReentrantInitiatorRuns();
      if (this.activeInitiatorRuns !== 0) {
        this.initiatorDrain ??= Promise.withResolvers<void>();
        await this.initiatorDrain.promise;
      }
      this.initiatorState = "disposed";
      this.initiators.disable();
      this.initiatorRuns.disable();
    })();
  }

  /**
   * Dựng MỘT ranh giới initiator (hoặc ranh giới XOÁ kế thừa) có theo dõi.
   * Nhận: `agent` — Agent để kế thừa, hoặc `undefined` để xoá quy công; `operation` — thao tác cần gọi.
   * Trả: ĐÚNG giá trị mà `operation` trả về (Promise được theo dõi tới khi lắng).
   * Ném: khi phạm vi đã đóng/đã bỏ, hoặc khi `operation` ném đồng bộ.
   */
  private runWithInitiator<T>(agent: Agent | undefined, operation: () => T): T {
    if (this.initiatorState !== "active") throw new Error(DISPOSED_INITIATOR_MESSAGE);
    const run: InitiatorRun = {
      active: true,
      parent: this.initiatorRuns.getStore(),
    };
    this.activeInitiatorRuns += 1;
    let result: T;
    try {
      result = this.initiatorRuns.run(run, () => this.initiators.run(agent, operation));
    } catch (error) {
      this.releaseInitiatorRun(run);
      throw error;
    }
    if (isPromise(result)) {
      const then = Promise.prototype.then as ThenCall;
      try {
        void then.call(result as Promise<unknown>, () => {
          this.releaseInitiatorRun(run);
        }, () => {
          this.releaseInitiatorRun(run);
        });
      } catch {
        this.releaseInitiatorRun(run);
      }
    } else {
      this.releaseInitiatorRun(run);
    }
    return result;
  }

  /**
   * Xét xem một fiber đang gỡ có SỞ HỮU vòng đời của service này không.
   * Nhận: `candidate` — fiber đang chuyển sang trạng thái bỏ.
   * Trả: `true` khi `candidate` nằm trên chuỗi fiber cha của service này.
   */
  private hasLifecycleAncestor(candidate: Fiber): boolean {
    let fiber = this.ctx.fiber;
    while (true) {
      if (fiber === candidate) return true;
      const parent = fiber.parent.fiber;
      if (parent === fiber) return false;
      fiber = parent;
    }
  }

  /**
   * Ném khi phạm vi initiator đã bị bỏ (mọi tham chiếu cũ phải thành lỗi rõ ràng).
   * Nhận: không.
   * Trả: không; ném `DISPOSED_INITIATOR_MESSAGE` khi đã bỏ.
   */
  private assertInitiatorsReadable(): void {
    if (this.initiatorState === "disposed") throw new Error(DISPOSED_INITIATOR_MESSAGE);
  }

  /**
   * Miễn trừ CHÍNH chuỗi ranh giới đã khởi động việc dọn này khỏi phép rút cạn của nó.
   * Nhận: không.
   * Trả: không.
   */
  private releaseReentrantInitiatorRuns(): void {
    let run = this.initiatorRuns.getStore();
    while (run !== undefined) {
      this.releaseInitiatorRun(run);
      run = run.parent;
    }
  }

  /**
   * Gỡ MỘT ranh giới initiator (luỹ đẳng) và giải lần rút cạn khi ranh giới cuối cùng đóng.
   * Nhận: `run` — ranh giới cần gỡ.
   * Trả: không.
   */
  private releaseInitiatorRun(run: InitiatorRun): void {
    if (!run.active) return;
    run.active = false;
    this.activeInitiatorRuns -= 1;
    if (this.activeInitiatorRuns !== 0) return;
    this.initiatorDrain?.resolve();
    this.initiatorDrain = undefined;
  }
}

export default AgentRegistry;
