/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Policy: nhà CHÍNH SÁCH sandbox
 *      (`ctx.sandboxPolicy`) — chế độ mặc định của deployment, gốc workspace dự phòng, và lượt
 *      giải chính sách cho từng lời gọi capability
 */

import type { Context } from "@deepseek-ai/cordis";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import {
  renderPolicyContext,
  resolveWorkspaceRoot,
  sandboxModeStateSchema,
  type SandboxExecutionPolicy,
  type SandboxModeState,
  type SandboxPolicyRequest,
  type SessionProjectionsSeam,
  type SystemPromptSeam,
} from "./policy.ts";
import { SANDBOX_MODES, setSandboxMode, type SandboxMode, type SandboxSession } from "./session-mode.ts";

export { SANDBOX_MODES, setSandboxMode };

/**
 * Cấu hình plugin: chế độ sandbox mặc định của deployment. Mọi trường tuỳ chọn — `Config` cấp giá trị
 * mặc định (`mode: read-only` là mặc định an toàn; deployment muốn agent ghi được thì chọn rõ ràng).
 */
export interface Config {
  /** Chế độ mà một phiên bắt đầu từ đó (mặc định: `read-only`). */
  mode?: SandboxMode;
  /** Gốc dự phòng tuyệt đối cho lời gọi không phiên và phiên không có cwd (mặc định: `process.cwd()`). */
  workspaceRoot?: string;
}

/**
 * Dịch vụ chính sách sandbox (`ctx.sandboxPolicy`). Sở hữu chế độ mặc định của deployment, gốc workspace
 * dự phòng, và mục chính sách tại thời điểm yêu cầu. Tầng tool gọi {@link SandboxPolicyService.resolve}
 * cho mỗi lượt thi hành để chế độ trong nhật ký phiên và cwd bất biến đi cùng nhau tới mọi capability.
 */
export class SandboxPolicyService extends Service {
  /** Schema cấu hình (schemastery) — để Settings/config-editor của kernel render được từng trường. */
  static Config = z.object({
    mode: z.union(["read-only", "workspace-write", "danger-full-access"]).default("read-only"),
    workspaceRoot: z.string(),
  }) as unknown as z<Config>;

  /** Seam cần có: sổ đăng ký đơn vị chiếu của phiên. */
  static inject = ["sessionProjections"];

  /** Chế độ mặc định của deployment — lớp nền dưới ghi đè của phiên. */
  readonly defaultMode: SandboxMode;

  /** Gốc `workspace-write` dự phòng, tuyệt đối, cho lời gọi không có cwd phiên. */
  readonly workspaceRoot: string;

  /**
   * Đăng ký service `sandboxPolicy`, đơn vị chiếu `sandboxMode`, và mục ngữ cảnh `sandbox:policy`.
   * Nhận: context host và cấu hình đã qua schema.
   * Trả: thực thể đã đăng ký (chế độ mặc định + gốc workspace đã chốt).
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "sandboxPolicy");
    this.defaultMode = config.mode ?? "read-only";
    this.workspaceRoot = resolveWorkspaceRoot(config.workspaceRoot ?? process.cwd());
    const projections = (ctx as unknown as { sessionProjections: SessionProjectionsSeam }).sessionProjections;
    projections.register({
      key: "sandboxMode",
      stateVersion: 1,
      stateSchema: sandboxModeStateSchema,
      init: () => null,
      apply: (state, event) => (event.type === "sandbox/mode" ? (event.data.mode as SandboxModeState) : state),
    });
    ctx.inject(["systemPrompt"], (scope) => {
      const prompt = (scope as unknown as { systemPrompt: SystemPromptSeam }).systemPrompt;
      prompt.context({
        name: "sandbox:policy",
        order: prompt.getContextOrder("SANDBOX_POLICY"),
        text: (context) => {
          const session = context.agent?.session;
          return session === undefined ? "" : renderPolicyContext(this.resolve({ session }));
        },
      });
    });
  }

  /**
   * Giải chính sách đầy đủ cho MỘT lời gọi capability. Chế độ đã được duyệt rõ ràng xếp TRÊN sự kiện
   * `sandbox/mode` cuối của phiên, và sự kiện đó xếp trên chế độ mặc định của deployment. cwd của phiên
   * là biên `workspace-write`; gốc đã cấu hình là dự phòng cho lời gọi không phiên và phiên không có cwd.
   * Nhận: yêu cầu tuỳ chọn (phiên gọi + chế độ đã được duyệt).
   * Trả: chế độ và gốc workspace tuyệt đối đã giải cho lời gọi.
   */
  resolve(request: SandboxPolicyRequest = {}): SandboxExecutionPolicy {
    const { session } = request;
    return {
      mode: request.mode ?? (session === undefined ? undefined : this.overrideOf(session)) ?? this.defaultMode,
      workspaceRoot: resolveWorkspaceRoot(session?.header.cwd ?? this.workspaceRoot),
      ...(session === undefined ? {} : { sessionId: session.id }),
    };
  }

  /**
   * Đọc ghi đè của phiên mà KHÔNG áp chế độ mặc định của deployment.
   * Nhận: phiên có nhật ký cấp ghi đè.
   * Trả: chế độ ghi nhật ký cuối cùng, hoặc `undefined` khi chưa có lần đổi nào.
   */
  overrideOf(session: SandboxSession): SandboxMode | undefined {
    const projections = (this.ctx as unknown as { sessionProjections: SessionProjectionsSeam }).sessionProjections;
    return projections.stateOf(session, "sandboxMode") ?? undefined;
  }
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Nhà chính sách sandbox của deployment (khai báo theo KIỂU của module stock để
     *  không xung đột với khai báo của chính gói stock đang cài — lỗi TS2717 ngày 02/11/2026). */
    sandboxPolicy: import("@deepseek-ai/dsh-sandbox-policy").default;
  }
}

export default SandboxPolicyService;
