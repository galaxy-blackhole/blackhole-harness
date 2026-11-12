/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Adapter Session Controller cho React: nguồn gốc sessions/sessionStatus, phạm vi session,
 *      tương tác đang chờ và nhắc hoàn tất; cài qua apply() của row ui-session
 */

import { renderSessionArea, type SessionAreaProps, type SessionBinding } from "./session-provider.ts";
import type { ClientStoreLike, JsxRuntimeLike, ServiceCtorLike, ServiceLike, SlotsSeamLike } from "./types.ts";
import { WeakMapWithValues } from "./values.ts";

/** Một tương tác đang chờ mà một miền công bố. */
export interface PendingInteraction {
  /** Khoá duy nhất của tương tác. */
  key: string;
  /** Phiên mà tương tác thuộc về. */
  sessionId: string;
}

/** Một mục trong bảng trạng thái phiên. */
export interface SessionStatus {
  /** Phiên có đang chạy không. */
  running: boolean | undefined;
  /** Tương tác đang chờ của phiên, nếu có. */
  pendingInteraction: PendingInteraction | undefined;
  /** Phiên có kết quả chưa đọc không. */
  completionUnread: boolean;
}

/** Nguồn ảnh chụp có thể theo dõi được. */
export interface SourceLike<T> {
  /** Giá trị hiện tại. */
  value: T;
  /** Người nghe của nguồn. */
  listeners: Set<() => void>;
  /** Ảnh chụp hiện tại. */
  getSnapshot(): T;
  /** Theo dõi thay đổi; trả hàm huỷ. */
  subscribe(listener: () => void): () => void;
}

/** Đóng góp nguồn chuẩn theo phạm vi phiên. */
export interface SessionSourceDescriptor {
  /** Tên hook theo phiên mà đóng góp này khai. */
  hooks?: string[];
  /** Tên hook theo khoá mà đóng góp này khai. */
  keyedHooks?: string[];
  /** Tên prop mà đóng góp này khai. */
  props?: string[];
  /** Phân giải giá trị cho một liên kết. */
  resolve(binding: SessionBindingInput): {
    hooks?: Record<string, unknown>;
    keyedHooks?: Record<string, (key: string) => unknown>;
    props?: Record<string, unknown>;
  };
}

/** Đối tượng phiên mà Controller sở hữu (chỉ phần row này dùng). */
export interface SessionObject {
  /** Các phép chiếu của phiên. */
  projections: { faceOf(key: string): (key: string) => unknown };
  /** Giữ chỗ phiên ở khung nhìn chính. */
  retainedBy: { mainView?: number };
}

/** Liên kết mà seam sessions trả về cho một phiên: đối tượng đã được Controller bọc sẵn. */
export interface SessionBindingInput {
  /** Khoá phiên. */
  sessionId: string;
  /** Đối tượng phiên. */
  session: SessionObject;
  /** Context của phiên (để gắn vòng đời liên kết). */
  ctx: { effect(callback: () => unknown, label?: string): () => void };
}

/** Một hàng trong danh sách phiên. */
export interface SessionListRow {
  /** Id phiên (bản gốc đọc chính trường này khi chọn phiên chính). */
  id: string;
  /** Phiên có đang chạy không. */
  running: boolean;
  /** Ai đang giữ chỗ phiên. */
  retainedBy: { mainView?: number };
}

/** Service sessions của kernel (chỉ phần row này dùng). */
export interface SessionsSeam {
  /** Danh sách phiên. */
  list: SourceLike<{ ids: string[]; byId: Record<string, SessionListRow>; phase: string }>;
  /** Liên kết của một phiên. */
  binding(sessionId: string): SessionBindingInput | undefined;
  /** Thông tin giữ chỗ của một phiên. */
  retainInfo(sessionId: string): SourceLike<{ retainedBy: { mainView?: number } }>;
}

/** Adapter mà seam slots dùng để render vùng session. */
export interface SessionScopeAdapter {
  /** Nguồn của phiên chính. */
  current: SourceLike<SessionBinding>;
  /** Nguồn cho một tham chiếu phiên. */
  bindingSource(reference: { binding: SessionBindingInput; sessionId: string } | undefined): SourceLike<SessionBinding>;
  /** Render vùng session. */
  renderArea(binding: SessionBinding, props: SessionAreaProps): unknown;
}

/** Context phía client mà row này cần. */
export interface ClientContextLike {
  /** Đăng ký hiệu ứng. */
  effect(callback: () => unknown, label?: string): () => void;
  /** Service sessions. */
  sessions: SessionsSeam;
  /** Seam slots. */
  slots: SlotsSeamLike;
  /** Seam Remote (chỉ cần sự kiện trạng thái phiên). */
  remote: { $on(event: string, listener: (sessionId: string, running: boolean) => void): () => void };
  /** Nguồn quyền truy cập của phiên. */
  remoteAccess: { source(kind: string, sessionId: string, action: string): unknown };
}

/** Bốn dịch vụ mà adapter này cần. */
export const INJECT = ["sessions", "slots", "remote", "remoteAccess"];

/** Miền tương tác đang chờ: giữ giá trị đã công bố và thứ tự ưu tiên giữa các miền. */
export class PendingInteractionDomain {
  /** Giá trị đang chờ, theo khoá tương tác. */
  private readonly values = new Map<string, { interaction: PendingInteraction; delegate: () => unknown }>();

  /**
   * @param precedence - thứ tự ưu tiên giữa các miền; giá trị lớn hơn thắng.
   * @param changed - gọi lại khi tập giá trị đổi.
   */
  constructor(
    /** Thứ tự ưu tiên của miền này. */
    readonly precedence: (interaction: PendingInteraction) => number,
    /** Hàm báo thay đổi. */
    private readonly changed: () => void,
  ) {}

  /**
   * Ảnh chụp các tương tác đang chờ của miền này.
   * Nhận: không.
   * Trả: mảng tương tác theo thứ tự chèn.
   */
  valuesSnapshot(): PendingInteraction[] {
    return [...this.values.values()].map((entry) => entry.interaction);
  }

  /**
   * Công bố một tương tác và hàm dọn dẹp chủ sở hữu của nó.
   * Nhận: tương tác và hàm dọn.
   * Trả: hàm bỏ công bố (gọi nhiều lần vô hại).
   */
  publish(interaction: PendingInteraction, delegate: () => unknown): () => void {
    if (this.values.has(interaction.key)) {
      throw new Error("ui-session: duplicate pending interaction key '" + interaction.key + "'");
    }
    this.values.set(interaction.key, { interaction, delegate });
    this.changed();
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (!this.values.delete(interaction.key)) return;
      this.changed();
    };
  }

  /**
   * Bỏ mọi giá trị đang chờ và trả về các thao tác dọn của chủ sở hữu chúng.
   * Nhận: không.
   * Trả: mảng hàm dọn.
   */
  release(): (() => unknown)[] {
    const delegates = [...this.values.values()].map((entry) => entry.delegate);
    this.values.clear();
    return delegates;
  }
}

/** Nguồn dựng sẵn của phạm vi phiên. */
export const BUILTIN_SOURCE: SessionSourceDescriptor = {
  hooks: ["session"],
  keyedHooks: ["projection"],
  props: ["sessionId"],
  resolve: (binding) => ({
    hooks: { session: binding.session },
    keyedHooks: { projection: (key: string) => binding.session.projections.faceOf(key) },
    props: { sessionId: binding.sessionId },
  }),
};

/**
 * Dựng adapter Session Controller cho React.
 * Nhận: jsx runtime, store phía client, seam slots và lớp Service của cordis.
 * Trả: { UiSession, install } để row cài vào context.
 */
export function createSessionAdapter(
  runtime: JsxRuntimeLike,
  store: ClientStoreLike,
  slots: SlotsSeamLike,
  Service: ServiceCtorLike,
): {
  UiSession: new (ctx: ClientContextLike, sessions: SessionsSeam) => UiSessionLike;
  install: (ctx: ClientContextLike) => void;
} {
  /** Lớp adapter thật, kế thừa Service của cordis. */
  class UiSession extends (Service as unknown as new (ctx: unknown, name: string) => ServiceLike) {
    /** Context client đã nhận (để gọi service slots của KERNEL, không phải module). */
    private readonly client: ClientContextLike;
    /** Service sessions của kernel. */
    private readonly sessions: SessionsSeam;
    /** Roster nguồn theo phạm vi phiên. */
    private readonly descriptors: SessionSourceDescriptor[] = [BUILTIN_SOURCE];
    /** Liên kết đã vật chất hoá theo chủ sở hữu. */
    private readonly bindings = new WeakMapWithValues<SessionBindingInput, BindingRecord>();
    /** Nguồn của nhánh "không có phiên". */
    private readonly absent: SourceLike<SessionBinding>;
    /** Nguồn của phiên chính. */
    private readonly current: SourceLike<SessionBinding>;
    /** Các miền tương tác đang chờ. */
    private readonly pendingDomains: PendingInteractionDomain[] = [];
    /** Ảnh chụp tương tác đang chờ theo phiên. */
    private pendingSnapshot = new Map<string, PendingInteraction>();
    /** Phiên nào đang chạy. */
    private readonly running = new Map<string, boolean | undefined>();
    /** Phiên có kết quả chưa đọc. */
    private readonly completionUnread = new Set<string>();
    /** Ảnh chụp trạng thái phiên. */
    private statusSnapshot = new Map<string, SessionStatus>();
    /** Người nghe trạng thái phiên. */
    private readonly statusListeners = new Set<() => void>();
    /** Phiên đang được theo dõi giữ chỗ. */
    private mainRetainId: string | undefined;
    /** Huỷ theo dõi giữ chỗ hiện tại. */
    private disposeMainRetain: () => void = () => {};
    /** Adapter còn sống hay không. */
    private active = true;
    /** Nguồn gốc gộp ba sự thật: đang chạy, tương tác đang chờ, nhắc hoàn tất. */
    readonly sessionStatus: SourceLike<Map<string, SessionStatus>>;
    /** Adapter mà renderer dùng cho hai phạm vi session và session-maybe. */
    readonly adapter: SessionScopeAdapter;

    /**
     * @param ctx - context gốc phía client.
     * @param sessions - lớp đối tượng Session do Controller sở hữu.
     */
    constructor(ctx: ClientContextLike, sessions: SessionsSeam) {
      super(ctx, "uiSession");
      this.ctx = ctx as unknown as ServiceLike["ctx"];
      this.client = ctx;
      this.sessions = sessions;
      this.absent = createBindingSource(this.materializeAbsent());
      this.current = createBindingSource(this.absent.value);
      this.sessionStatus = {
        value: this.statusSnapshot,
        listeners: this.statusListeners,
        getSnapshot: () => this.statusSnapshot,
        subscribe: (listener: () => void) => {
          this.statusListeners.add(listener);
          return () => {
            this.statusListeners.delete(listener);
          };
        },
      };
      this.adapter = {
        current: this.current,
        bindingSource: (target) => this.bindingSource(target),
        renderArea: (binding, props) => renderSessionArea(runtime, binding, props),
      };
      ctx.effect(() => {
        const disposeList = sessions.list.subscribe(() => {
          this.publishMain();
        });
        const disposeStatus = sessions.list.subscribe(() => {
          this.reconcileStatus();
        });
        const disposeRemoteStatus = ctx.remote.$on("api-session/status", (sessionId, running) => {
          this.observeRunning(sessionId, running);
        });
        this.publishMain();
        this.reconcileStatus();
        return () => {
          this.active = false;
          disposeList();
          disposeStatus();
          disposeRemoteStatus();
          this.disposeMainRetain();
          const records = [...this.bindings.values];
          this.bindings.clear();
          for (const record of records) record.release();
        };
      }, "ui-session: Session binding projection");
    }

    /**
     * Phân giải nguồn render ổn định cho một tham chiếu phiên, hoặc cho sự vắng mặt tường minh.
     * Nhận: tham chiếu do chủ Provider cấp, hoặc undefined.
     * Trả: nguồn liên kết; rơi về phép chiếu vắng mặt khi thế hệ của nó kết thúc.
     */
    bindingSource(reference: { binding: SessionBindingInput; sessionId: string } | undefined): SourceLike<SessionBinding> {
      if (!this.active) return this.absent;
      if (reference === undefined) return this.absent;
      const owner = reference.binding;
      if (this.sessions.binding(reference.sessionId) !== owner) {
        throw new Error("ui-session: Session reference is not active in this Controller");
      }
      return this.sourceFor(owner);
    }

    /**
     * Đăng ký một đóng góp nguồn chuẩn theo phạm vi phiên.
     * Nhận: descriptor roster tĩnh và hàm phân giải theo liên kết.
     * Trả: hàm huỷ thuộc fiber cordis của người gọi.
     */
    provide(descriptor: SessionSourceDescriptor): () => void {
      const runtimeDescriptor = descriptor;
      const dispose = this.ctx.effect(() => {
        this.descriptors.push(runtimeDescriptor);
        try {
          this.rebuildBindings();
        } catch (error) {
          this.descriptors.pop();
          throw error;
        }
        return () => {
          const index = this.descriptors.indexOf(runtimeDescriptor);
          this.descriptors.splice(index, 1);
          this.rebuildBindings();
        };
      }, "uiSession.provide()");
      return () => {
        dispose();
      };
    }

    /**
     * Đăng ký một miền tương tác đang chờ và trả hàm công bố của nó.
     * Nhận: thứ tự ưu tiên giữa các miền; giá trị lớn hơn thắng.
     * Trả: hàm công bố một tương tác kèm uỷ nhiệm dọn dẹp.
     */
    registerPendingInteraction(
      precedence: (interaction: PendingInteraction) => number,
    ): (interaction: PendingInteraction, delegate: () => unknown) => () => void {
      const domain = new PendingInteractionDomain(precedence, () => {
        this.publishPendingInteractions();
      });
      const runtimeDomain = domain;
      this.ctx.effect(() => {
        this.pendingDomains.push(runtimeDomain);
        this.publishPendingInteractions();
        return async () => {
          const delegates = domain.release();
          const index = this.pendingDomains.indexOf(runtimeDomain);
          this.pendingDomains.splice(index, 1);
          this.publishPendingInteractions();
          await Promise.allSettled(delegates.map((delegate) => Promise.resolve().then(delegate)));
        };
      }, "uiSession.registerPendingInteraction()");
      return (interaction, delegate) => domain.publish(interaction, delegate);
    }

    /** Dựng lại mọi liên kết đã vật chất hoá và nguồn vắng mặt. */
    private rebuildBindings(): void {
      const absent = this.materializeAbsent();
      const updates = [...this.bindings.values].map((record) => ({
        source: record.source,
        value: this.materialize(record.owner),
      }));
      this.absent.value = absent;
      for (const update of updates) update.source.value = update.value;
      store.notifySubscribers(this.absent.listeners, "[ui-session] absent binding");
      for (const update of updates) store.notifySubscribers(update.source.listeners, "[ui-session] Session binding");
      this.publishMain();
    }

    /** Lấy hoặc tạo nguồn đã vật chất hoá cho một chủ sở hữu. */
    private sourceFor(owner: SessionBindingInput): SourceLike<SessionBinding> {
      const cached = this.bindings.get(owner);
      if (cached !== undefined) return cached.source;
      const record = this.createMaterializedBinding(owner);
      this.bindings.set(owner, record);
      return record.source;
    }

    /** Chọn phiên chính rồi công bố nguồn của nó. */
    private publishMain(): void {
      if (!this.active) return;
      const byId = this.sessions.list.getSnapshot().byId;
      const currentId = this.current.value.key;
      const nextId =
        currentId !== undefined && (this.sessions.retainInfo(currentId).getSnapshot().retainedBy.mainView ?? 0) > 0
          ? currentId
          : Object.values(byId).find((candidate) => (candidate.retainedBy.mainView ?? 0) > 0)?.id;
      this.watchMainRetention(nextId);
      const owner = nextId === undefined ? undefined : this.sessions.binding(nextId);
      const value = owner === undefined ? this.absent.value : this.sourceFor(owner).value;
      if (this.current.value === value) return;
      this.current.value = value;
      store.notifySubscribers(this.current.listeners, "[ui-session] main binding");
    }

    /** Theo dõi thông tin giữ chỗ của phiên chính. */
    private watchMainRetention(sessionId: string | undefined): void {
      if (sessionId === this.mainRetainId) return;
      this.disposeMainRetain();
      this.mainRetainId = sessionId;
      this.disposeMainRetain =
        sessionId === undefined
          ? () => {}
          : this.sessions.retainInfo(sessionId).subscribe(() => {
              this.publishMain();
            });
    }

    /** Gộp tương tác đang chờ của mọi miền theo thứ tự ưu tiên rồi công bố trạng thái. */
    private publishPendingInteractions(): void {
      const next = new Map<string, { interaction: PendingInteraction; precedence: number }>();
      for (const domain of this.pendingDomains) {
        for (const interaction of domain.valuesSnapshot()) {
          const precedence = domain.precedence(interaction);
          const previous = next.get(interaction.sessionId);
          if (previous === undefined || precedence >= previous.precedence) {
            next.set(interaction.sessionId, { interaction, precedence });
          }
        }
      }
      const projected = new Map([...next].map(([sessionId, value]) => [sessionId, value.interaction]));
      if (samePendingInteractions(this.pendingSnapshot, projected)) return;
      this.pendingSnapshot = projected;
      this.publishStatus();
    }

    /** Ghi nhận một lần đổi trạng thái chạy của phiên. */
    private observeRunning(sessionId: string, running: boolean): void {
      const previous = this.running.get(sessionId);
      const beforeBaseline = this.sessions.list.getSnapshot().phase === "pending";
      this.running.set(sessionId, running);
      if (running) this.completionUnread.delete(sessionId);
      else if ((previous === true || (previous === undefined && beforeBaseline)) && !this.isMain(sessionId)) {
        this.completionUnread.add(sessionId);
      }
      this.publishStatus();
    }

    /** Đồng bộ trạng thái chạy với danh sách phiên hiện tại. */
    private reconcileStatus(): void {
      const list = this.sessions.list.getSnapshot();
      const present = new Set(Object.keys(list.byId));
      for (const id of list.ids) {
        const row = list.byId[id];
        const previous = this.running.get(id);
        if (previous === undefined) this.running.set(id, row?.running);
        else if (previous !== row?.running) this.observeRunning(id, row?.running === true);
      }
      for (const id of present) if (this.isMain(id)) this.completionUnread.delete(id);
      if (list.phase === "ready") {
        for (const id of this.running.keys()) {
          if (present.has(id)) continue;
          this.running.delete(id);
          this.completionUnread.delete(id);
        }
      }
      this.publishStatus();
    }

    /** Phiên này có đang được khung nhìn chính giữ chỗ không. */
    private isMain(sessionId: string): boolean {
      return (this.sessions.list.getSnapshot().byId[sessionId]?.retainedBy.mainView ?? 0) > 0;
    }

    /** Công bố ảnh chụp trạng thái phiên nếu nó đổi. */
    private publishStatus(): void {
      const ids = new Set([
        ...Object.keys(this.sessions.list.getSnapshot().byId),
        ...this.running.keys(),
        ...this.pendingSnapshot.keys(),
        ...this.completionUnread,
      ]);
      const next = new Map<string, SessionStatus>();
      for (const id of ids) {
        next.set(id, {
          running: this.running.get(id),
          pendingInteraction: this.pendingSnapshot.get(id),
          completionUnread: this.completionUnread.has(id),
        });
      }
      if (sameSessionStatus(this.statusSnapshot, next)) return;
      this.statusSnapshot = next;
      store.notifySubscribers(this.statusListeners, "[ui-session] Session status");
    }

    /** Vật chất hoá một liên kết và gắn nó vào vòng đời của chủ sở hữu. */
    private createMaterializedBinding(owner: SessionBindingInput): BindingRecord {
      const value = this.materialize(owner);
      this.client.slots.bindStoreScope(value);
      const source = createBindingSource(value);
      const record: BindingRecord = {
        owner,
        source,
        release: () => {},
      };
      const releaseEffect = owner.ctx.effect(
        () => () => {
          if (this.bindings.get(owner) === record) this.bindings.delete(owner);
          source.value = this.absent.value;
          store.notifySubscribers(source.listeners, "[ui-session] Session binding");
          this.publishMain();
        },
        "ui-session: binding " + owner.sessionId,
      );
      record.release = () => {
        releaseEffect();
      };
      return record;
    }

    /** Gộp mọi đóng góp đã khai thành một liên kết cho chủ sở hữu. */
    private materialize(binding: SessionBindingInput): SessionBinding {
      const hooks: Record<string, unknown> = {};
      const keyedHooks: Record<string, (key: string) => unknown> = {};
      const props: Record<string, unknown> = {};
      const finalProps = new Set<string>();
      for (const descriptor of this.descriptors) {
        const contribution = descriptor.resolve(binding);
        validateContribution(descriptor, contribution);
        copyDeclared("hook", hooks, descriptor.hooks, contribution.hooks, finalProps, slots);
        copyDeclared("keyed hook", keyedHooks, descriptor.keyedHooks, contribution.keyedHooks, finalProps, slots);
        copyDeclared("prop", props, descriptor.props, contribution.props, finalProps, slots);
      }
      return { key: binding.sessionId, ctx: binding.ctx, hooks, keyedHooks, props };
    }

    /** Liên kết vắng mặt: mọi tên đã khai đều có mặt với giá trị undefined. */
    private materializeAbsent(): SessionBinding {
      const hooks: Record<string, unknown> = {};
      const keyedHooks: Record<string, (key: string) => unknown> = {};
      const props: Record<string, unknown> = {};
      const finalProps = new Set<string>();
      for (const descriptor of this.descriptors) {
        declareAbsent("hook", hooks, descriptor.hooks, finalProps, slots);
        declareAbsent("keyed hook", keyedHooks, descriptor.keyedHooks, finalProps, slots);
        declareAbsent("prop", props, descriptor.props, finalProps, slots);
      }
      return { key: undefined, hooks, keyedHooks, props };
    }
  }

  /**
   * Cài nguồn gốc Session và adapter theo phạm vi.
   * Nhận: context client của cordis.
   * Trả: không.
   */
  const install = (ctx: ClientContextLike): void => {
    const service = new UiSession(ctx, ctx.sessions);
    ctx.slots.provideRoot({
      hooks: {
        sessions: ctx.sessions.list,
        sessionStatus: service.sessionStatus,
      },
      keyedHooks: {
        sessionRetainInfo: (key: string) => ctx.sessions.retainInfo(key),
        sessionAccess: (sessionId: string, action?: string) =>
          action === undefined ? undefined : ctx.remoteAccess.source("session", sessionId, action),
      },
    });
    ctx.slots.installScope("session", service.adapter);
    service.provide({
      keyedHooks: ["access"],
      resolve: (binding) => ({
        keyedHooks: { access: (action: string) => ctx.remoteAccess.source("session", binding.sessionId, action) },
      }),
    });
  };

  return { UiSession: UiSession as unknown as new (ctx: ClientContextLike, sessions: SessionsSeam) => UiSessionLike, install };
}

/** Bề mặt công khai của lớp adapter (đủ cho row và cho test). */
export interface UiSessionLike {
  /** Nguồn gốc trạng thái phiên. */
  sessionStatus: SourceLike<Map<string, SessionStatus>>;
  /** Adapter theo phạm vi. */
  adapter: SessionScopeAdapter;
  /** Đăng ký một đóng góp nguồn. */
  provide(descriptor: SessionSourceDescriptor): () => void;
  /** Đăng ký một miền tương tác đang chờ. */
  registerPendingInteraction(
    precedence: (interaction: PendingInteraction) => number,
  ): (interaction: PendingInteraction, delegate: () => unknown) => () => void;
}

/** Bản ghi một liên kết đã vật chất hoá. */
interface BindingRecord {
  /** Chủ sở hữu liên kết. */
  owner: SessionBindingInput;
  /** Nguồn của liên kết. */
  source: SourceLike<SessionBinding>;
  /** Giải phóng liên kết. */
  release: () => void;
}

/**
 * Dựng một nguồn ảnh chụp có thể theo dõi được.
 * Nhận: giá trị ban đầu.
 * Trả: nguồn.
 */
function createBindingSource(value: SessionBinding): SourceLike<SessionBinding> {
  const source: SourceLike<SessionBinding> = {
    value,
    listeners: new Set<() => void>(),
    getSnapshot: () => source.value,
    subscribe: (listener: () => void) => {
      source.listeners.add(listener);
      return () => {
        source.listeners.delete(listener);
      };
    },
  };
  return source;
}

/**
 * Từ chối mọi giá trị chưa được descriptor khai.
 * Nhận: descriptor và đóng góp của nó.
 * Trả: không.
 */
function validateContribution(
  descriptor: SessionSourceDescriptor,
  contribution: { hooks?: Record<string, unknown>; keyedHooks?: Record<string, (key: string) => unknown>; props?: Record<string, unknown> },
): void {
  rejectUndeclared("hook", descriptor.hooks, contribution.hooks);
  rejectUndeclared("keyed hook", descriptor.keyedHooks, contribution.keyedHooks);
  rejectUndeclared("prop", descriptor.props, contribution.props);
}

/**
 * Ném lỗi khi đóng góp chứa tên chưa khai.
 * Nhận: loại, danh sách đã khai và giá trị.
 * Trả: không.
 */
function rejectUndeclared(kind: string, declared: string[] | undefined, values: Record<string, unknown> | undefined): void {
  for (const name of Object.keys(values ?? {})) {
    if (!(declared ?? []).includes(name)) {
      throw new Error("uiSession.provide: undeclared " + kind + " '" + name + "'");
    }
  }
}

/**
 * Sao chép các tên đã khai từ đóng góp vào đích, kiểm trùng prop cuối.
 * Nhận: loại, đích, danh sách đã khai, giá trị, tập prop cuối và seam slots.
 * Trả: không.
 */
function copyDeclared(
  kind: string,
  target: Record<string, unknown>,
  declared: string[] | undefined,
  values: Record<string, unknown> | undefined,
  finalProps: Set<string>,
  slots: SlotsSeamLike,
): void {
  for (const name of declared ?? []) {
    claimStandardProp(kind, name, finalProps, slots);
    const value = values?.[name];
    if (value === undefined) throw new Error("uiSession.provide: missing " + kind + " '" + name + "'");
    target[name] = value;
  }
}

/**
 * Khai một tên vắng mặt với giá trị undefined.
 * Nhận: loại, đích, danh sách đã khai, tập prop cuối và seam slots.
 * Trả: không.
 */
function declareAbsent(
  kind: string,
  target: Record<string, unknown>,
  declared: string[] | undefined,
  finalProps: Set<string>,
  slots: SlotsSeamLike,
): void {
  for (const name of declared ?? []) {
    claimStandardProp(kind, name, finalProps, slots);
    target[name] = undefined;
  }
}

/**
 * Giữ chỗ một prop chuẩn và từ chối tên trùng.
 * Nhận: loại, tên, tập prop cuối và seam slots.
 * Trả: không.
 */
function claimStandardProp(kind: string, name: string, finalProps: Set<string>, slots: SlotsSeamLike): void {
  const propName = kind === "prop" ? name : slots.standardHookPropName(name);
  if (finalProps.has(propName)) {
    throw new Error("uiSession.provide: duplicate " + kind + " '" + name + "' at prop '" + propName + "'");
  }
  finalProps.add(propName);
}

/**
 * So hai ảnh chụp trạng thái phiên.
 * Nhận: ảnh chụp trái và phải.
 * Trả: bằng nhau hay không.
 */
function sameSessionStatus(left: Map<string, SessionStatus>, right: Map<string, SessionStatus>): boolean {
  if (left.size !== right.size) return false;
  for (const [id, status] of left) {
    const candidate = right.get(id);
    if (
      candidate === undefined ||
      candidate.running !== status.running ||
      candidate.pendingInteraction !== status.pendingInteraction ||
      candidate.completionUnread !== status.completionUnread
    ) {
      return false;
    }
  }
  return true;
}

/**
 * So hai ảnh chụp tương tác đang chờ.
 * Nhận: ảnh chụp trái và phải.
 * Trả: bằng nhau hay không.
 */
function samePendingInteractions(left: Map<string, PendingInteraction>, right: Map<string, PendingInteraction>): boolean {
  if (left.size !== right.size) return false;
  for (const [sessionId, interaction] of left) if (right.get(sessionId) !== interaction) return false;
  return true;
}
