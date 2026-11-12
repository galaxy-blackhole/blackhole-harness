/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dịch vụ duyệt `ctx.approval` của row approval: áp chính sách phiên TRƯỚC người trả lời, ghi
 *      cặp kiểm toán `approval/asked` + `approval/decided` quanh mỗi lượt hỏi, và đóng (fail closed)
 *      khi không có người trả lời hoặc khi tín hiệu bị huỷ
 */

import { randomUUID } from "node:crypto";

import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-user-approval";
import { Service } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { scopeTarget } from "@deepseek-ai/dsh-scope";
import type { Session } from "@deepseek-ai/dsh-session";
import z from "@deepseek-ai/schemastery";

import { hasOpenTurn, policyOverrideOf, setApprovalPolicy } from "./policy.ts";
import { policySentence, type SystemPromptSeam } from "./prompt.ts";
import {
  ApprovalRequestId,
  OUTCOMES,
  type ApprovalOutcome,
  type ApprovalPolicy,
  type ApprovalRequest,
  type Config,
} from "./types.ts";

/**
 * Dịch vụ duyệt: áp chính sách phiên TRƯỚC người trả lời và ghi mọi cặp hỏi/kết quả vào phiên đã
 * hỏi. Nó phơi thay đổi chính sách tất định cho model qua ảnh chụp ngữ cảnh lúc chạy và thông báo
 * chuyển chính sách.
 */
export class ApprovalService extends Service {
  /** Cấu hình đã qua schema — chính sách mặc định của deployment (mặc định `'ask'`). */
  config: Config;

  /** Schema cấu hình (schemastery) — để Settings/config-editor của kernel render được `policy`. */
  static Config = z.object({ policy: z.union(["ask", "never"]).default("ask") }) as unknown as z<Config>;

  /**
   * Đăng ký dịch vụ `approval` và mục ngữ cảnh `approval:policy` của system prompt.
   * Nhận: `ctx` — context host; `config` — cấu hình đã qua schema.
   * Trả: thực thể đã đăng ký (chính sách mặc định đã chốt).
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "approval");
    this.config = config;
    // Hàm neo phiên → chính sách hiệu lực; mục ngữ cảnh chạy lại ở mỗi lượt lắp nên phải đọc SỐNG.
    const effective = (agent: Agent): ApprovalPolicy => this.effectivePolicy(agent.session);
    ctx.inject(["systemPrompt"], (scope) => {
      const prompt = (scope as unknown as { systemPrompt: SystemPromptSeam }).systemPrompt;
      prompt.context({
        name: "approval:policy",
        order: prompt.getContextOrder("APPROVAL_POLICY"),
        text: (context) => {
          const agent = context.agent;
          if (agent === undefined) return "";
          return policySentence(effective(agent));
        },
      });
    });
  }

  /**
   * Chuyển chính sách của MỘT agent đang sống và xếp lượt chuyển cho bước model kế tiếp. Khởi tạo
   * phiên dùng thẳng `setApprovalPolicy` vì chưa có chính sách hiển thị trước đó để đổi.
   * Nhận: `agent` — agent đang sống có chính sách đổi; `policy` — chính sách hiệu lực mới.
   * Trả: không (ghi một sự kiện `approval/policy` + đẩy một tin nhắn vào agent khi chính sách ĐỔI).
   */
  setPolicy(agent: Agent, policy: ApprovalPolicy): void {
    const previous = this.effectivePolicy(agent.session);
    if (previous === policy) return;
    setApprovalPolicy(agent.session, policy);
    agent.inject(
      createUserMessage({
        content: [
          {
            type: "text",
            text: `The approval policy changed from "${previous}" to "${policy}" (changed by the user).`,
          },
        ],
        source: { kind: "user-approval" },
      }),
    );
  }

  /**
   * Hỏi chuỗi người trả lời đã lắp để quyết MỘT yêu cầu chỉ-đọc trong cùng tiến trình; service
   * mượn thẳng yêu cầu, agent, phiên và tín hiệu sống. Yêu cầu ĐÒI một lượt đang mở vì cặp kiểm
   * toán phải được bao bởi ranh giới commit/replay của nhật ký bền; lượt hỏi lúc rảnh bị từ chối
   * TRƯỚC khi ghi bất cứ thứ gì. Pha người trả lời LUÔN sinh một kết quả: tín hiệu đã huỷ ⇒
   * `'cancelled'`, người trả lời vắng hoặc ném ⇒ `'unavailable'` (đóng), giá trị trả về ngoài từ
   * vựng ⇒ chuẩn hoá thành `'unavailable'`. Lỗi khiến một trong hai lần ghi kiểm toán không commit
   * vẫn NÉM, vì trả một quyết định không được ghi log là vi phạm cặp kiểm toán.
   * Nhận: `req` — quyết định đang chờ (agent, danh tính tool, lý do, tín hiệu).
   * Trả: kết quả ĐÓNG; `'allowed-once'` là cấp duy nhất.
   */
  async request(req: ApprovalRequest): Promise<ApprovalOutcome> {
    const session = req.agent.session;
    if (!hasOpenTurn(session)) {
      throw new Error(
        "approval.request() outside an open turn: the approval/asked + approval/decided audit pair must be turn-enclosed (a bare event between turns is crash-tail garbage on reload). Ask from inside the turn that needs the decision.",
      );
    }
    const id = ApprovalRequestId(randomUUID());
    session.append("approval/asked", {
      id,
      toolName: req.toolName,
      ...(req.callId !== undefined ? { callId: req.callId } : {}),
      ...(req.reason !== undefined ? { reason: req.reason } : {}),
    });
    const outcome = await this.decide(req, session);
    session.append("approval/decided", { id, outcome });
    return outcome;
  }

  /**
   * Chính sách hiệu lực của phiên: ghi đè `approval/policy` của chính nó, ngược lại là chính sách
   * mặc định đã cấu hình (schema đã mặc định `'ask'`; phép `??` chỉ để HẸP KIỂU đầu vào tuỳ chọn).
   * Nhận: `session` — đúng phiên được chấp nhận mà chính sách của nó áp dụng.
   * Trả: chính sách mà MỌI lượt hỏi của phiên này giải theo ngay lúc này.
   */
  private effectivePolicy(session: Session): ApprovalPolicy {
    return this.overrideOf(session) ?? this.config.policy ?? "ask";
  }

  /**
   * Đọc ghi đè của phiên mà KHÔNG áp chính sách mặc định đã cấu hình.
   * Nhận: `session` — phiên có nhật ký cấp ghi đè.
   * Trả: chính sách ghi log cuối cùng, hoặc `undefined` khi chưa có lần chuyển nào.
   */
  overrideOf(session: Session): ApprovalPolicy | undefined {
    return policyOverrideOf(session);
  }

  /**
   * Phân phát waterfall, có bao lỗi và ĐUA với tín hiệu của yêu cầu.
   * Nhận: `req` — yêu cầu công khai đã mượn; `session` — phiên của agent hỏi, dùng để tra chính sách.
   * Trả: kết quả ĐÓNG đã chuẩn hoá (`'cancelled'` khi bị huỷ, `'rejected'` khi chính sách `'never'`).
   */
  private async decide(req: ApprovalRequest, session: Session): Promise<ApprovalOutcome> {
    const signal = req.signal;
    if (signal?.aborted) return "cancelled";
    if (this.effectivePolicy(session) === "never") return "rejected";
    const answer = Promise.resolve()
      .then(() =>
        this.ctx.waterfall(scopeTarget(req.agent, req.agent), "approval/request", req, () =>
          Promise.resolve<ApprovalOutcome>("unavailable"),
        ),
      )
      .then(
        (outcome) => (OUTCOMES.includes(outcome) ? outcome : "unavailable"),
        () => "unavailable" as const,
      );
    if (signal === undefined) return answer;
    return await new Promise<ApprovalOutcome>((resolve) => {
      const onAbort = (): void => {
        signal.removeEventListener("abort", onAbort);
        resolve("cancelled");
      };
      signal.addEventListener("abort", onAbort, { once: true });
      void answer.then((outcome) => {
        signal.removeEventListener("abort", onAbort);
        resolve(outcome);
      });
    });
  }
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    // KHÔNG khai lại `approval`: `@deepseek-ai/dsh-user-approval` ĐÃ khai property này với lớp của nó; khai lại
    // bằng `ApprovalService` của ta sinh TS2717. Luật: ADR 0009 — một chủ sở hữu cho seam kiểu.
  }
}

export default ApprovalService;
