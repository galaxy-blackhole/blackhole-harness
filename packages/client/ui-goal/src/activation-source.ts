/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nguon quan sat trang thai kich hoat goal: xep thu tu doc Remote muon va su kien kich hoat song
 */

/** Một mục tiêu đã bền theo góc nhìn của client (`useProjection('goal')`). */
export interface GoalView {
  /** Id bền của mục tiêu. */
  readonly id: string;
  /** Revision dùng cho CAS. */
  readonly revision: number;
  /** Pha sống: `active` | `paused` | `blocked` | `complete`. */
  readonly phase: string;
  /** Nội dung mục tiêu. */
  readonly objective: string;
  /** Trạng thái kích hoạt cục bộ đi kèm goal sống. */
  readonly activation?: string;
  /** Lý do bị chặn, khi pha là `blocked`. */
  readonly blockedReason?: { readonly message?: string };
}

/** Giá trị mà projection `goal` phơi ra: `undefined` đang nạp · `null` không có goal · ngược lại là goal. */
export type GoalProjection = { readonly goal: GoalView } | null | undefined;

/** Trạng thái kích hoạt cục bộ trong tiến trình, khớp với MỘT revision chính xác. */
export interface GoalActivationSnapshot {
  /** Id mục tiêu hiện tại; vắng trước khi tạo hoặc sau khi xoá. */
  readonly id?: string;
  /** Revision chính xác cho cạnh kích hoạt. */
  readonly revision?: number;
  /** Trạng thái kích hoạt cục bộ; vắng khi chưa biết cạnh khớp. */
  readonly activation?: string;
}

/** Nguồn quan sát được do `ui-slots` cấp (chỉ dùng hai hàm này). */
export interface HostObservable<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot: () => T;
  /** Đăng ký người nghe; trả hàm gỡ. */
  subscribe: (listener: () => void) => () => void;
}

/** Nguồn chỉ đọc một giá trị. */
export interface Readable<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot: () => T;
  /** Đăng ký người nghe; trả hàm gỡ. */
  subscribe: (listener: () => void) => () => void;
}

/** Phụ thuộc để dựng nguồn kích hoạt. */
export interface GoalActivationDeps {
  /** Projection `goal` của phiên. */
  projection: Readable<GoalProjection>;
  /** Phiên đang giữ (đọc cờ `running`). */
  session: Readable<{ readonly running: boolean }>;
  /** Đọc goal sống từ Host. */
  getGoal: () => Promise<{ readonly ok: boolean; readonly value?: GoalView }>;
  /** Nghe sự kiện kích hoạt của chính phiên này. */
  subscribeActivation: (listener: (goal: GoalView | undefined) => void) => () => void;
  /** Nghe sự kiện đặt lại kết nối. */
  subscribeReset: (listener: () => void) => () => void;
}

/**
 * So hai ảnh chụp rỗng-hoặc-có-giá-trị theo giá trị.
 * Nhận: hai ảnh chụp.
 * Trả: true khi id, revision và activation đều bằng nhau.
 */
export function sameSnapshot(left: GoalActivationSnapshot, right: GoalActivationSnapshot): boolean {
  return left.id === right.id && left.revision === right.revision && left.activation === right.activation;
}

/**
 * Lấy tham chiếu CAS của mục tiêu đang hoạt động.
 * Nhận: projection `goal`.
 * Trả: goal khi pha là `active`, ngược lại undefined.
 */
export function activeRef(projection: GoalProjection): GoalView | undefined {
  return projection?.goal.phase === "active" ? projection.goal : undefined;
}

/**
 * Dựng một nguồn kích hoạt riêng cho nơi đăng ký.
 *
 * Nguồn chỉ đăng ký khi có hook của framework quan sát nó, nên khi tháo gỡ là nhả luôn cả bốn nguồn nghe:
 * sự kiện Remote, projection, ảnh chụp phiên đang chạy, và sự kiện đặt lại. Ba bộ đếm epoch
 * (sự kiện · projection · lần đọc) bảo đảm một lần đọc Remote về muộn không ghi đè trạng thái mới hơn.
 * Nhận: projection, phiên, hàm đọc Remote và hai nguồn sự kiện.
 * Trả: nguồn ảnh chụp ổn định cho `useGoalActivation`.
 */
export function createGoalActivationSource(deps: GoalActivationDeps): HostObservable<GoalActivationSnapshot> {
  let snapshot: GoalActivationSnapshot = {};
  let subscriptions = 0;
  let disposers: (() => void)[] = [];
  let running = deps.session.getSnapshot().running;
  let eventEpoch = 0;
  let projectionEpoch = 0;
  let readEpoch = 0;
  const listeners = new Set<() => void>();

  /** Công bố ảnh chụp mới nếu nó khác ảnh chụp cũ. */
  const publish = (next: GoalActivationSnapshot): void => {
    if (sameSnapshot(snapshot, next)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };

  /** Bắt đầu một lần đọc Remote; kết quả về muộn bị bỏ nếu epoch đã đổi. */
  const startRead = (ref: GoalView | undefined): void => {
    if (ref === undefined) return;
    const read = ++readEpoch;
    const startedAtEvent = eventEpoch;
    const startedAtProjection = projectionEpoch;
    deps.getGoal().then(
      (result) => {
        if (read !== readEpoch || startedAtEvent !== eventEpoch || startedAtProjection !== projectionEpoch) return;
        if (!result.ok) return;
        const goal = result.value;
        if (goal === undefined) {
          if (activeRef(deps.projection.getSnapshot()) === undefined) publish({});
          return;
        }
        publish({ id: goal.id, revision: goal.revision, activation: goal.activation });
      },
      (error: unknown) => {
        console.warn("[ui-goal] goal activation read failed:", error);
      },
    );
  };

  /** Đọc lại cạnh kích hoạt từ projection rồi, nếu goal đang hoạt động, đọc tiếp từ Host. */
  const refreshProjection = (): void => {
    projectionEpoch += 1;
    const ref = activeRef(deps.projection.getSnapshot());
    if (ref === undefined) {
      if (snapshot.id !== undefined) publish({});
      return;
    }
    if (snapshot.id !== ref.id || snapshot.revision !== ref.revision) publish({ id: ref.id, revision: ref.revision });
    startRead(ref);
  };

  /** Sự kiện kích hoạt sống: thắng mọi lần đọc đang bay. */
  const onActivation = (goal: GoalView | undefined): void => {
    eventEpoch += 1;
    readEpoch += 1;
    publish(goal === undefined ? {} : { id: goal.id, revision: goal.revision, activation: goal.activation });
  };

  /** Phiên đổi trạng thái chạy ⇒ đọc lại. */
  const onRunning = (): void => {
    const next = deps.session.getSnapshot().running;
    if (next === running) return;
    running = next;
    startRead(activeRef(deps.projection.getSnapshot()));
  };

  /** Kết nối được đặt lại ⇒ mọi epoch tăng và đọc lại. */
  const onReset = (): void => {
    eventEpoch += 1;
    projectionEpoch += 1;
    startRead(activeRef(deps.projection.getSnapshot()));
  };

  /** Đăng ký bốn nguồn nghe và đọc trạng thái lần đầu. */
  const start = (): void => {
    disposers = [
      deps.projection.subscribe(refreshProjection),
      deps.session.subscribe(onRunning),
      deps.subscribeActivation(onActivation),
      deps.subscribeReset(onReset),
    ];
    running = deps.session.getSnapshot().running;
    refreshProjection();
  };

  /** Gỡ mọi nguồn nghe và vô hiệu hoá các lần đọc đang bay. */
  const stop = (): void => {
    for (const dispose of disposers) dispose();
    disposers = [];
    readEpoch += 1;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (subscriptions === 0) start();
      subscriptions += 1;
      return () => {
        listeners.delete(listener);
        subscriptions -= 1;
        if (subscriptions === 0) stop();
      };
    },
  };
}
