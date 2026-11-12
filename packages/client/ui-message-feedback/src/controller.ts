/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tang doi tuong phan hoi tung tin nhan cua row ui-message-feedback — mot lan doc cho ca phien
 */

/** Phan loai phan hoi ma Host chap nhan (nguyen van tu ban goc). */
export type FeedbackCategory =
  | "task-result"
  | "instruction-following"
  | "product-interaction"
  | "service-stability"
  | "resource-cost"
  | "security-privacy-permission"
  | "other";

/** Danh gia tong the cua nguoi dung ve mot tin nhan assistant. */
export type MessageFeedbackRating = "positive" | "negative";

/** Mot gia tri phan hoi hien tai kem token phien ban chi de so sanh. */
export interface MessageFeedbackItem {
  /** Dinh danh on dinh cua tin nhan assistant trong phien. */
  readonly messageId: string;
  /** Danh gia tong the. */
  readonly rating: MessageFeedbackRating;
  /** Giai thich tuy chon, giu nguyen van sau khi Host kiem. */
  readonly note?: string;
  /** Phan loai nguoi dung chon. */
  readonly category?: FeedbackCategory;
  /** Token chi de so sanh, bi thay boi moi lan tao/sua that su. */
  readonly version: unknown;
  /** Thoi diem Host tao (epoch ms). */
  readonly createdAt: number;
  /** Thoi diem Host sua gan nhat (epoch ms). */
  readonly updatedAt: number;
}

/** Anh chup ma moi nut phan hoi doc chung. */
export interface MessageFeedbackView {
  /** Trang thai cua lan doc. */
  readonly status: "cold" | "loading" | "ready" | "error";
  /** Phan hoi da biet cua tung tin nhan. */
  readonly items: ReadonlyMap<string, MessageFeedbackItem>;
  /** Thong bao loi cua lan doc gan nhat, hoac null. */
  readonly error: string | null;
}

/** Ket qua nghiep vu cua mot dong tu (thuan loi hay that bai co ma). */
export type MessageFeedbackActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** Ket qua mang cua mot loi goi Remote: lop van chuyen (carrier) co the hong truoc lop nghiep vu. */
export type Carried<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** Ket qua nghiep vu cua mot loi goi Remote (Host tra ve trong `value` cua lop mang). */
export type Settled<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly current?: MessageFeedbackItem | null } };

/** Yeu cau ghi de phan hoi cua mot tin nhan. */
export interface MessageFeedbackPutRequest {
  /** Phien so huu tin nhan. */
  readonly sessionId: string;
  /** Tin nhan assistant dich. */
  readonly messageId: string;
  /** Danh gia mong muon. */
  readonly rating: MessageFeedbackRating;
  /** Giai thich tuy chon (chi gui khi co). */
  readonly note?: string;
  /** Phan loai tuy chon (chi gui khi co). */
  readonly category?: FeedbackCategory;
  /** Phien ban da quan sat, hoac null de doi rang chua co muc nao. */
  readonly ifVersion: unknown;
}

/** Mat Remote `messageFeedback` ma tang nay can. */
export interface MessageFeedbackRemote {
  /**
   * Doc toan bo phan hoi cua mot phien.
   * Nhan: request — id phien.
   * Tra: ket qua mang boc ket qua nghiep vu.
   */
  list(request: { readonly sessionId: string }): Promise<Carried<Settled<{ readonly items: readonly MessageFeedbackItem[] }>>>;
  /**
   * Tao hoac thay phan hoi cua mot tin nhan.
   * Nhan: request — yeu cau ghi.
   * Tra: ket qua mang boc ket qua nghiep vu.
   */
  put(request: MessageFeedbackPutRequest): Promise<Carried<Settled<MessageFeedbackItem>>>;
  /**
   * Xoa phan hoi cua mot tin nhan sau khi da quan sat phien ban.
   * Nhan: request — id phien, id tin nhan, phien ban da quan sat.
   * Tra: ket qua mang boc ket qua nghiep vu.
   */
  delete(request: {
    readonly sessionId: string;
    readonly messageId: string;
    readonly ifVersion: unknown;
  }): Promise<Carried<Settled<{ readonly absent: true }>>>;
}

/** Anh chup dau tien: chua doc gi. */
const INITIAL_VIEW: MessageFeedbackView = Object.freeze({
  status: "cold",
  items: new Map<string, MessageFeedbackItem>(),
  error: null,
});

/** Ket qua thanh cong dung chung (mot doi tuong cho moi lan). */
const OK = Object.freeze({ ok: true }) as MessageFeedbackActionResult;

/** Ket qua khi tang da bi huy. */
const DISPOSED: MessageFeedbackActionResult = Object.freeze({
  ok: false,
  error: Object.freeze({ code: "disposed", message: "feedback controller is disposed" }),
});

/**
 * Doc duoc mot ma that bai nghiep vu.
 * Nhan: code — ma Host tra ve.
 * Tra: mo ta cho nguoi phat trien.
 */
function describe(code: string): string {
  switch (code) {
    case "session-not-found":
      return "this session is no longer persisted";
    case "target-not-found":
      return "this message is not a persisted assistant message";
    case "version-conflict":
      return "feedback changed elsewhere";
    case "note-blank":
      return "a note must contain a non-whitespace character";
    case "note-too-large":
      return "the note is too long";
    default:
      return code;
  }
}

/**
 * Dung nhanh that bai cho mot ma nghiep vu.
 * Nhan: code — ma that bai.
 * Tra: ket qua that bai.
 */
function fail(code: string): MessageFeedbackActionResult {
  return { ok: false, error: { code, message: describe(code) } };
}

/**
 * Dung nhanh that bai tu loi lop mang (carrier) — giu nguyen ma va thong bao cua Host.
 * Nhan: error — loi lop mang.
 * Tra: ket qua that bai.
 */
function carrierFailure(error: { readonly code: string; readonly message: string }): MessageFeedbackActionResult {
  return { ok: false, error: { code: error.code, message: error.message } };
}

/**
 * Tang doi tuong phan hoi cua MOT phien: mot lan doc nuoi moi nut phan hoi cua phien do.
 * Ban viet lai trung thanh cua `MessageFeedbackController` trong ban goc.
 */
export class MessageFeedbackController {
  /** Mat Remote `messageFeedback`. */
  private readonly remote: MessageFeedbackRemote;
  /** Phien so huu moi tin nhan duoc danh dia chi. */
  private readonly sessionId: string;
  /** Anh chup hien tai. */
  private view: MessageFeedbackView = INITIAL_VIEW;
  /** Nhung nguoi nghe dang cho anh chup doi. */
  private readonly listeners = new Set<() => void>();
  /** Lan doc dang bay, de nhieu noi goi cung cho chung mot ket qua. */
  private loadPromise: Promise<MessageFeedbackActionResult> | null = null;
  /** Duoi tuan tu hoa cac dong tu. */
  private operationTail: Promise<unknown> = Promise.resolve();
  /** Tang da bi huy chua. */
  private disposed = false;

  /**
   * Nhan: remote — mat Remote `messageFeedback`; sessionId — phien so huu.
   * Tra: doi tuong tang.
   */
  constructor(remote: MessageFeedbackRemote, sessionId: string) {
    this.remote = remote;
    this.sessionId = sessionId;
  }

  /**
   * Tra anh chup da cache (bat bien).
   * Nhan: khong co.
   * Tra: anh chup hien tai.
   */
  getSnapshot = (): MessageFeedbackView => this.view;

  /**
   * Dang ky nhan thong bao khi anh chup doi.
   * Nhan: listener — ham duoc goi.
   * Tra: ham huy dang ky.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Doc mot lan; lan doc that bai van thu lai duoc.
   * Nhan: khong co.
   * Tra: ket qua da chot, dung chung cho moi noi goi dong thoi.
   */
  ensure(): Promise<MessageFeedbackActionResult> {
    if (this.view.status === "ready") return Promise.resolve(OK);
    return this.refresh();
  }

  /**
   * Doc lai danh sach quyen uy, gop moi noi goi dong thoi vao mot lan doc dang bay.
   * Nhan: khong co.
   * Tra: ket qua doc da chot.
   */
  refresh(): Promise<MessageFeedbackActionResult> {
    if (this.loadPromise !== null) return this.loadPromise;
    this.publish({ status: "loading", items: this.view.items, error: null });
    const pending = this.load();
    this.loadPromise = pending;
    return pending.finally(() => {
      this.loadPromise = null;
    });
  }

  /**
   * Doc lai danh sach NAM SAU cac dong tu dang xep hang (dung khi ket noi lai).
   * Nhan: khong co.
   * Tra: ket qua doc da chot.
   */
  resync(): Promise<MessageFeedbackActionResult> {
    return this.mutate(() => this.refresh(), { seed: false });
  }

  /**
   * Tao hoac thay phan hoi cua mot tin nhan theo phien ban da quan sat.
   * Nhan: messageId — tin nhan dich; rating — danh gia; entry — giai thich va phan loai tuy chon.
   * Tra: ket qua dong tu da chot.
   */
  rate(
    messageId: string,
    rating: MessageFeedbackRating,
    entry: { readonly text?: string; readonly category?: FeedbackCategory } = {},
  ): Promise<MessageFeedbackActionResult> {
    return this.mutate(async () => {
      const observed = this.view.items.get(messageId);
      return await this.putCommitted(messageId, rating, entry, observed);
    });
  }

  /**
   * Rut lai danh gia dang khop cua mot tin nhan; dong tu da cu tro thanh khong lam gi.
   * Nhan: messageId — tin nhan dich; rating — danh gia nguoi dung muon rut.
   * Tra: ket qua dong tu da chot.
   */
  retract(messageId: string, rating: MessageFeedbackRating): Promise<MessageFeedbackActionResult> {
    return this.mutate(async () => {
      const observed = this.view.items.get(messageId);
      return observed?.rating === rating ? await this.deleteCommitted(messageId, observed) : OK;
    });
  }

  /**
   * Ghi mot lenh put theo phien ban da quan sat va hoa giai xung dot.
   * Nhan: messageId — tin nhan; rating — danh gia; entry — giai thich/phan loai; observed — muc da thay.
   * Tra: ket qua dong tu.
   */
  private async putCommitted(
    messageId: string,
    rating: MessageFeedbackRating,
    entry: { readonly text?: string; readonly category?: FeedbackCategory },
    observed: MessageFeedbackItem | undefined,
  ): Promise<MessageFeedbackActionResult> {
    const carried = await this.remote.put({
      sessionId: this.sessionId,
      messageId,
      rating,
      ...(entry.text === undefined ? {} : { note: entry.text }),
      ...(entry.category === undefined ? {} : { category: entry.category }),
      ifVersion: observed?.version ?? null,
    });
    if (!carried.ok) return carrierFailure(carried.error);
    const result = carried.value;
    if (result.ok) {
      this.commit(messageId, result.value);
      return OK;
    }
    if (result.error.code === "version-conflict") this.commit(messageId, result.error.current ?? null);
    return fail(result.error.code);
  }

  /**
   * Ghi mot lenh delete theo phien ban da quan sat va hoa giai xung dot.
   * Nhan: messageId — tin nhan; observed — muc da thay.
   * Tra: ket qua dong tu.
   */
  private async deleteCommitted(messageId: string, observed: MessageFeedbackItem): Promise<MessageFeedbackActionResult> {
    const carried = await this.remote.delete({ sessionId: this.sessionId, messageId, ifVersion: observed.version });
    if (!carried.ok) return carrierFailure(carried.error);
    const result = carried.value;
    if (result.ok) {
      this.commit(messageId, null);
      return OK;
    }
    if (result.error.code === "version-conflict") this.commit(messageId, result.error.current ?? null);
    return fail(result.error.code);
  }

  /**
   * Bo nguoi nghe va tu choi moi dong tu khi fiber so huu go xuong.
   * Nhan: khong co.
   * Tra: khong co.
   */
  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  /**
   * Doc toan bo sidecar va phat no thanh anh chup da nuoi.
   * Nhan: khong co.
   * Tra: ket qua doc.
   */
  private async load(): Promise<MessageFeedbackActionResult> {
    const carried = await this.remote.list({ sessionId: this.sessionId });
    if (this.disposed) return OK;
    if (!carried.ok) {
      this.publish({ status: "error", items: this.view.items, error: carried.error.message });
      return carrierFailure(carried.error);
    }
    const result = carried.value;
    if (!result.ok) {
      this.publish({ status: "error", items: this.view.items, error: describe(result.error.code) });
      return fail(result.error.code);
    }
    const items = new Map<string, MessageFeedbackItem>();
    for (const item of result.value.items) items.set(item.messageId, item);
    this.publish({ status: "ready", items, error: null });
    return OK;
  }

  /**
   * Xep mot dong tu sau cac dong tu truoc do cua cung phien.
   * Nhan: operation — ham dong tu; options — `seed: false` de bo qua buoc doc truoc.
   * Tra: ket qua dong tu.
   */
  private mutate(
    operation: () => Promise<MessageFeedbackActionResult>,
    options: { readonly seed?: boolean } = {},
  ): Promise<MessageFeedbackActionResult> {
    const guarded = async (): Promise<MessageFeedbackActionResult> => {
      if (this.disposed) return DISPOSED;
      if (options.seed !== false) {
        const loaded = await this.ensure();
        if (!loaded.ok) return loaded;
        if (this.disposed) return DISPOSED;
      }
      return await operation();
    };
    const result = this.operationTail.then(guarded, guarded);
    this.operationTail = result.then(() => undefined);
    return result;
  }

  /**
   * Thay muc cua mot tin nhan, giu nguyen danh tinh cua moi muc khac.
   * Nhan: messageId — tin nhan; item — muc moi, hoac null de xoa.
   * Tra: khong co.
   */
  private commit(messageId: string, item: MessageFeedbackItem | null): void {
    const items = new Map(this.view.items);
    if (item === null) items.delete(messageId);
    else items.set(messageId, item);
    this.publish({ status: "ready", items, error: null });
  }

  /**
   * Thay anh chup va chan loi cua nguoi nghe ngay tai bien cua observable.
   * Nhan: view — anh chup moi.
   * Tra: khong co.
   */
  private publish(view: MessageFeedbackView): void {
    this.view = Object.freeze(view);
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error("[ui-message-feedback] nguoi nghe nem loi:", error);
      }
    }
  }
}
