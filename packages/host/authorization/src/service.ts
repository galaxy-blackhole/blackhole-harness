/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dịch vụ `ctx.authorization` của row authorization: sổ luồng lấy credential qua hội thoại với
 *      người, MỘT lượt cho mỗi khoá, xác nhận commit của luồng, và phát `authorization/settled` cho
 *      mọi kết cục (kể cả thất bại) để bề mặt không khởi xướng lượt đó vẫn biết nó đã xong.
 */

import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-authorization";
import { Service } from "@deepseek-ai/cordis";
import type { CredentialKey } from "@deepseek-ai/dsh-credentials";

import { AuthorizationDeclinedError, AuthorizationError } from "./errors.ts";
import type {
  AuthorizationEntry,
  AuthorizationFlow,
  AuthorizationInteraction,
  AuthorizationOutcome,
  AuthorizationRequest,
  AuthorizationSettlement,
} from "./types.ts";

/** Một lượt đang chạy cho một khoá: bộ điều khiển huỷ của nó, và cờ đã vào pha commit chưa. */
interface RunningAttempt {
  /** Bộ điều khiển tín hiệu của CHÍNH lượt này (khác tín hiệu bên gọi đưa vào). */
  controller: AbortController;
  /** Đã vào pha commit ⇒ huỷ phải CHỜ, không được cắt ngang một lần ghi dở. */
  committing: boolean;
}

/**
 * `ctx.authorization`: sổ các luồng lấy credential, mỗi khoá MỘT lượt tại một thời điểm.
 *
 * Seam sở hữu cuộc hội thoại và vòng đời; nó KHÔNG sở hữu giao thức. Một plugin biết cách lấy
 * credential của chính nó thì đăng ký một luồng theo `CredentialKey` mà luồng đó ghi, và luồng nói
 * với bề mặt đã khởi xướng nó qua MỘT từ vựng trung tính gồm thông báo và câu hỏi.
 */
export class AuthorizationService extends Service {
  /** Commit mà seam này xác nhận LÀ một lần ghi bản ghi credential, nên kho credential là BẮT BUỘC. */
  static inject: string[] = ["credentials"];

  /** Luồng đã đăng ký, theo khoá credential mà mỗi luồng ghi. */
  private readonly flows = new Map<CredentialKey, AuthorizationFlow>();

  /** Lượt đang chạy, theo khoá credential — có mặt nghĩa là khoá đang bận. */
  private readonly running = new Map<CredentialKey, RunningAttempt>();

  /**
   * Đăng ký dịch vụ `authorization` vào context của plugin.
   * Nhận: `ctx` — context host (cordis cấp thể hiện `credentials` theo `static inject`).
   * Trả: thực thể service đã đăng ký (sổ luồng và sổ lượt rỗng).
   */
  constructor(ctx: Context) {
    super(ctx, "authorization");
  }

  /**
   * Đưa ra một cách lấy MỘT credential. MỘT luồng cho mỗi khoá: hai plugin cùng nhận một khoá thì
   * mỗi bên ghi bản ghi theo định dạng của mình, và bên chạy sau để bên kia đọc một payload không
   * parse được.
   * Nhận: `flow` — khoá nó ghi, nhãn, các cách, và hàm chạy.
   * Trả: hàm huỷ rút lại luồng này (đồng thời huỷ lượt đang chạy của khoá đó).
   * Ném: `AuthorizationError` mã `DUPLICATE_FLOW` khi khoá đã bị nhận.
   */
  registerFlow(flow: AuthorizationFlow): () => void {
    const dispose = this.ctx.effect(
      () => {
        if (this.flows.has(flow.key)) {
          throw new AuthorizationError(`an authorization flow for "${flow.key}" is already registered`, "DUPLICATE_FLOW");
        }
        this.flows.set(flow.key, flow);
        return () => {
          this.flows.delete(flow.key);
          this.cancel(flow.key);
        };
      },
      "authorization.registerFlow()",
    );
    return () => void dispose();
  }

  /**
   * Mọi luồng đã đăng ký, cho bề mặt liệt kê những gì có thể uỷ quyền.
   * Nhận: không.
   * Trả: mỗi luồng MỘT mục, theo thứ tự đăng ký.
   */
  list(): readonly AuthorizationEntry[] {
    return [...this.flows.values()].map((flow) => this.entry(flow));
  }

  /**
   * Một luồng đã đăng ký.
   * Nhận: `key` — bản ghi credential cần hỏi tới.
   * Trả: mục công khai của luồng đó, hoặc `undefined` khi không luồng nào nhận khoá này.
   */
  describe(key: CredentialKey): AuthorizationEntry | undefined {
    const flow = this.flows.get(key);
    return flow === undefined ? undefined : this.entry(flow);
  }

  /**
   * Ảnh nhìn công khai của MỘT luồng đã đăng ký.
   * Nhận: `flow` — luồng đã đăng ký.
   * Trả: vật thể MỚI mỗi lần gọi (bề mặt sửa nó không lan sang sổ của service), kèm cờ `inFlight`.
   */
  private entry(flow: AuthorizationFlow): AuthorizationEntry {
    return {
      key: flow.key,
      label: flow.label,
      methods: flow.methods,
      inFlight: this.running.has(flow.key),
    };
  }

  /**
   * Rút lượt đang chạy cho một khoá, nếu có. Tách khỏi `signal` của chính yêu cầu vì một tầng vận
   * chuyển request/response trả lời nút Cancel bằng MỘT lời gọi thứ hai, không có cầm tín hiệu của
   * lời gọi thứ nhất.
   * Nhận: `key` — bản ghi credential mà lượt của nó phải dừng.
   * Trả: không (đã vào pha commit thì KHÔNG cắt: lần ghi dở phải trọn).
   */
  cancel(key: CredentialKey): void {
    const running = this.running.get(key);
    if (running !== undefined && !running.committing) running.controller.abort();
  }

  /**
   * Chạy MỘT lượt uỷ quyền cho một khoá và báo nó đã kết thúc thế nào.
   *
   * MỘT lượt cho mỗi khoá tại một thời điểm. Bên gọi thứ hai bị TỪ CHỐI chứ không được nhập chung:
   * hai bên sẽ hỏi hai người khác nhau qua cùng một luồng, và bên thứ hai sẽ trả lời những câu hỏi
   * của bên thứ nhất.
   * Nhận: `request` — khoá, cách thức, bề mặt hội thoại, và tín hiệu huỷ.
   * Trả: `authorized` khi bản ghi của luồng đã commit TRONG lượt này và đã được quan sát; hoặc
   * `cancelled` khi người dùng từ chối hoặc bên gọi rút.
   * Ném: `AuthorizationError` mã `NO_FLOW` khi không luồng nào nhận khoá; `UNKNOWN_METHOD` khi
   * cách được nêu không nằm trong các cách luồng đưa ra; `ALREADY_IN_FLIGHT` khi đã có lượt chạy cho
   * khoá; `NOT_COMMITTED` khi luồng phân giải mà không commit bản ghi trong lượt này.
   */
  async begin(request: AuthorizationRequest): Promise<AuthorizationOutcome> {
    const { key } = request;
    const flow = this.flows.get(key);
    if (flow === undefined) {
      throw new AuthorizationError(`no authorization flow is registered for "${key}"`, "NO_FLOW");
    }
    const method = request.method ?? flow.methods[0].id;
    if (!flow.methods.some((candidate) => candidate.id === method)) {
      throw new AuthorizationError(`authorization flow for "${key}" offers no method "${method}"`, "UNKNOWN_METHOD");
    }
    if (this.running.has(key)) {
      throw new AuthorizationError(`an authorization attempt for "${key}" is already running`, "ALREADY_IN_FLIGHT");
    }
    if (request.signal?.aborted === true) return { status: "cancelled" };
    const controller = new AbortController();
    const withdraw = (): void => {
      const running = this.running.get(key);
      if (running !== undefined && !running.committing) controller.abort(request.signal?.reason);
    };
    request.signal?.addEventListener("abort", withdraw, { once: true });
    this.running.set(key, { controller, committing: false });
    let settlement: AuthorizationSettlement = "failed";
    try {
      const outcome = await this.attempt(flow, method, controller.signal, request.interaction);
      settlement = outcome.status;
      return outcome;
    } finally {
      request.signal?.removeEventListener("abort", withdraw);
      this.running.delete(key);
      this.settle(key, settlement);
    }
  }

  /**
   * Phát `authorization/settled` với lỗi của người nghe được BAO LẠI: mọi người nghe đều chạy, còn
   * một lần ném đồng bộ hay một lần từ chối bất đồng bộ thì chỉ được ghi log mà không đổi kết cục của
   * lượt đã xong. Lượt đã kết thúc và khoá đã được nhả TRƯỚC khi phát, nên một người theo dõi hỏng
   * (tab trình duyệt thứ hai) không bao giờ biến kết quả đã chốt của bên gọi thành thất bại.
   * Nhận: `key` — khoá vừa được nhả; `settlement` — cách lượt đã kết thúc (kể cả `failed`).
   * Trả: không.
   */
  private settle(key: CredentialKey, settlement: AuthorizationSettlement): void {
    const args: unknown[] = ["authorization/settled", key, settlement];
    for (const listener of this.ctx.events.dispatch("emit", args)) {
      try {
        const returned: unknown = listener(key, settlement);
        if (returned != null && typeof (returned as { then?: unknown }).then === "function") {
          Promise.resolve(returned).then(undefined, (error: unknown) => {
            this.warnSettledListenerFailure(key, error);
          });
        }
      } catch (error) {
        this.warnSettledListenerFailure(key, error);
      }
    }
  }

  /**
   * Chẩn đoán dùng chung cho cả nhánh lỗi đồng bộ và bất đồng bộ của người nghe `authorization/settled`.
   * Nhận: `key` — khoá mà người nghe đang theo dõi; `error` — lỗi đã bắt được.
   * Trả: không (ghi hai dòng cảnh báo: dòng đầu nêu khoá, dòng sau in chính lỗi).
   */
  private warnSettledListenerFailure(key: CredentialKey, error: unknown): void {
    this.ctx.logger.warn('authorization: an authorization/settled listener for "%s" failed', key);
    this.ctx.logger.warn(error);
  }

  /**
   * Chạy luồng, rồi giữ nó đúng nửa hợp đồng commit của nó.
   * Nhận: `flow` — luồng đang chạy; `method` — cách đã chọn; `signal` — tín hiệu của CHÍNH lượt
   * này; `interaction` — bề mặt hội thoại của bên gọi.
   * Trả: `authorized` khi đã quan sát được commit và bản ghi còn đó; `cancelled` khi bị rút hoặc
   * người dùng từ chối.
   * Ném: `NOT_COMMITTED` khi luồng phân giải mà không commit (hoặc đã xoá bản ghi); `CANCELLED` khi
   * `commit` được gọi ngoài lượt còn hiệu lực; mọi lỗi khác của luồng được ném nguyên.
   */
  private async attempt(
    flow: AuthorizationFlow,
    method: string,
    signal: AbortSignal,
    interaction: AuthorizationInteraction,
  ): Promise<AuthorizationOutcome> {
    const withdrawn = new Promise<"withdrawn">((resolve) => {
      signal.addEventListener(
        "abort",
        () => {
          resolve("withdrawn");
        },
        { once: true },
      );
    });
    const observed = { declined: false, committed: false };
    const unwatch = this.ctx.on("credentials/record-updated", (key) => {
      if (key === flow.key) observed.committed = true;
    });
    try {
      const running = flow.run({
        method,
        signal,
        commit: async (record) => {
          signal.throwIfAborted();
          const attempt = this.running.get(flow.key);
          if (attempt === undefined || attempt.controller.signal !== signal) {
            throw new AuthorizationError("authorization attempt is no longer active", "CANCELLED");
          }
          attempt.committing = true;
          await this.ctx.credentials.modifyRecord(flow.key, () => Promise.resolve(record));
        },
        notify: (notice) => {
          try {
            interaction.notify(notice);
          } catch (error) {
            this.ctx.logger.warn("authorization: the interaction surface failed to render a notice");
            this.ctx.logger.warn(error);
          }
        },
        prompt: (prompt) =>
          interaction.prompt(prompt).catch((error: unknown) => {
            if (error instanceof AuthorizationDeclinedError) observed.declined = true;
            throw error;
          }),
      });
      try {
        if ((await Promise.race([running.then(() => "ran" as const), withdrawn])) === "withdrawn") {
          running.catch(() => {
            this.ctx.logger.debug("authorization: withdrawn flow failed after the fact");
          });
          return { status: "cancelled" };
        }
      } catch (error) {
        if (signal.aborted || observed.declined) return { status: "cancelled" };
        throw error;
      }
    } finally {
      unwatch();
    }
    if (!observed.committed) {
      throw new AuthorizationError(
        `authorization flow for "${flow.key}" resolved without committing a credential record in this attempt`,
        "NOT_COMMITTED",
      );
    }
    if (!(await this.ctx.credentials.describeRecord(flow.key)).configured) {
      throw new AuthorizationError(
        `authorization flow for "${flow.key}" deleted its credential record instead of committing one`,
        "NOT_COMMITTED",
      );
    }
    return { status: "authorized" };
  }
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    // `authorization` do `@deepseek-ai/dsh-authorization` (bản gốc) khai — gói này KHÔNG khai lại để tránh
    // TS2717 (hai lớp `AuthorizationService` khác nhau về cấu trúc). Luật: ADR 0009 (một chủ sở hữu cho seam kiểu).
  }

  interface Events {
    /**
     * Một lượt uỷ quyền đã xong và đã nhả khoá của nó. Bắn cho MỌI kết cục cuối, kể cả thất bại, để
     * một bề mặt theo dõi khoá mà nó không khởi xướng (tab trình duyệt thứ hai) biết lượt đã kết thúc.
     * @mode emit
     * @param key - bản ghi credential mà lượt vừa xong đang uỷ quyền.
     * @param settlement - cách nó kết thúc, gồm cả ca `failed` mà bên gọi thấy dưới dạng lỗi ném.
     */
    "authorization/settled"(key: CredentialKey, settlement: AuthorizationSettlement): void;
  }
}

export default AuthorizationService;
