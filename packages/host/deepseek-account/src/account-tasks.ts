/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Chính sách việc đang chạy khi tài khoản đăng xuất: nhận diện việc đi tuyến tài khoản, huỷ chúng
 *      khi có `deepseek-account/signed-out`, và phát hướng dẫn đăng nhập khi request bị từ chối.
 */

import type { LlmError } from "@deepseek-ai/dsh-llm";

/** Agent đang sống mà chính sách này đọc: trạng thái, ngữ cảnh request bền, và động từ huỷ. */
export interface AccountTaskAgent {
  /** Trạng thái sống của agent; chỉ `running` mới là việc đang chạy. */
  readonly status: string;
  /** Phiên của agent — nguồn của ngữ cảnh request bền. */
  readonly session: {
    /** Đọc ngữ cảnh request gắn bền với lần gọi gần nhất. */
    requestContext(): { readonly provider?: string } | undefined;
  };
  /**
   * Huỷ việc đang chạy của agent này.
   * Nhận: lý do huỷ kiểu hook và tuỳ chọn giữ hộp thư.
   * Trả: không.
   */
  cancel(reason: { readonly kind: "hook"; readonly reason: string }, options: { readonly keepInbox: boolean }): void;
}

/** Phạm vi do lần inject `agents` cấp: sổ agent, đăng ký listener, và phát sự kiện. */
export interface AccountTaskScope {
  /**
   * Đăng ký listener cho lỗi của agent.
   * Nhận: tên sự kiện `agent/error` và hàm nhận payload lỗi.
   * Trả: hàm gỡ đăng ký.
   */
  on(event: "agent/error", listener: (payload: { readonly error: unknown }) => void): () => void;
  /**
   * Đăng ký listener cho sự kiện đăng xuất.
   * Nhận: tên sự kiện `deepseek-account/signed-out` và hàm không tham số.
   * Trả: hàm gỡ đăng ký.
   */
  on(event: "deepseek-account/signed-out", listener: () => void): () => void;
  /**
   * Phát hướng dẫn đăng nhập cho UI.
   * Nhận: tên sự kiện `deepseek-account/model-sign-in-required`.
   * Trả: không.
   */
  emit(event: "deepseek-account/model-sign-in-required"): void;
  /** Sổ agent đang sống của kernel. */
  readonly agents: {
    /** Liệt kê mọi agent đang sống. */
    list(): Iterable<AccountTaskAgent>;
  };
}

/** Context cordis mà chính sách này cần — khai theo CẤU TRÚC nên không import gói seam nào. */
export interface AccountTaskContext {
  /**
   * Chờ một service rồi chạy phần cài đặt trong phạm vi của nó; agent có thể gắn vào sau.
   * Nhận: danh sách tên service cần chờ và hàm cài đặt.
   * Trả: không.
   */
  inject(names: readonly string[], callback: (scope: AccountTaskScope) => void): void;
}

/**
 * Nhận diện lớp lỗi theo TÊN, bền với MỌI bản sao mô-đun của cùng một lớp.
 * Vì sao (01/11/2026): `LlmError` được import qua peer `@deepseek-ai/dsh-llm`; trong giàn đo specifier đó
 * phân giải về MỘT BẢN SAO khác kernel nên `instanceof` trượt, và listener `agent/error` bỏ qua lỗi
 * `ACCOUNT_SIGN_IN_REQUIRED` của kernel thay vì phát hướng dẫn đăng nhập (đo được: 1 ca đỏ). Lớp gốc đặt
 * `name` theo tên lớp CON, nên phải dò tên lớp trên chuỗi prototype — đúng ngữ nghĩa `instanceof` xuyên
 * bản sao (cùng công thức ở packages/host/tools/src/error-identity.ts).
 * Nhận: error — giá trị bắt được; name — tên lớp cần khớp.
 * Trả: true khi chuỗi prototype của lỗi chứa một lớp mang đúng tên đó.
 */
function isNamedError(error: unknown, name: string): boolean {
  try {
    if (!(error instanceof Error)) return false;
    for (let proto: object | null = Object.getPrototypeOf(error); proto !== null; proto = Object.getPrototypeOf(proto)) {
      const ctor = (proto as { constructor?: { name?: string } }).constructor;
      if (typeof ctor === "function" && ctor.name === name) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Nhận diện việc đang chạy mà request gắn bền GẦN NHẤT đi tuyến tài khoản.
 * Nhận: agent đang sống (chỉ cần `status` và `session`).
 * Trả: true khi việc này phải bị huỷ lúc đăng xuất tài khoản.
 */
export function isRunningAccountTask(agent: Pick<AccountTaskAgent, "status" | "session">): boolean {
  return agent.status === "running" && agent.session.requestContext()?.provider === "deepseek-account";
}

/**
 * Huỷ việc của tài khoản đã đăng xuất và phát hướng dẫn đăng nhập cho request bị từ chối.
 * Nhận: vòng đời của provider tài khoản (agent có thể gắn vào sau).
 * Trả: không; đăng ký hai listener trong phạm vi `agents`.
 */
export function installAccountTaskCancellation(ctx: AccountTaskContext): void {
  ctx.inject(["agents"], (scope) => {
    scope.on("agent/error", ({ error }) => {
      // Lỗi có thể đến từ MỘT BẢN SAO khác của peer ⇒ nhận diện theo tên lớp, KHÔNG theo `instanceof`.
      if (!isNamedError(error, "LlmError")) return;
      if ((error as LlmError).code === "ACCOUNT_SIGN_IN_REQUIRED") scope.emit("deepseek-account/model-sign-in-required");
    });
    scope.on("deepseek-account/signed-out", () => {
      for (const agent of scope.agents.list()) {
        if (isRunningAccountTask(agent)) {
          agent.cancel({ kind: "hook", reason: "deepseek-account/signed-out" }, { keepInbox: true });
        }
      }
    });
  });
}
