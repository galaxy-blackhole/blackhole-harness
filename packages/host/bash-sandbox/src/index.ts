/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Executor bash TIÊU THỤ sandbox: bọc đúng argv bash cục bộ qua ctx.sandbox, thừa hưởng cơ chế
 *      tiến trình cục bộ, báo lại chế độ + mức cưỡng chế + sự thật "bị từ chối" (bản viết lại của
 *      @deepseek-ai/dsh-bash-sandbox — hành vi đối chiếu từng phần với lib/index.js gốc)
 */

import type { Context } from "@deepseek-ai/cordis";
import { LocalBashExecutor } from "@deepseek-ai/dsh-bash-local";
import type { Config as LocalConfig } from "@deepseek-ai/dsh-bash-local";
import {
  SandboxUnavailableError,
  classifyRunnerFailure,
  isRunnerSpawnFailure,
  matchesSignature,
} from "@deepseek-ai/dsh-sandbox";
import type {
  ConfinedArgv,
  RunnerFailureRule,
  SandboxEnforcement,
  SandboxExecutionPolicy,
  SandboxMode,
  SandboxPolicy,
} from "@deepseek-ai/dsh-sandbox";
import type { SandboxPolicyService } from "@galaxy-blackhole/gbh-sandbox-policy";
import type {
  ShellExecRequest,
  ShellExecSpec,
  ShellExecution,
  ShellProcess,
  ShellRunResult,
} from "@deepseek-ai/dsh-shell";
import { classifyDenial } from "./helpers.ts";

/**
 * Cấu hình plugin: đúng các núm của executor cục bộ, nguyên văn. Chính sách sandbox — chế độ mặc định
 * và gốc `workspace-write` dự phòng — KHÔNG nằm ở đây: nó sống trên `ctx.sandboxPolicy`
 * (`@deepseek-ai/dsh-sandbox-policy`), nơi giải chế độ + cwd của TỪNG phiên gọi cho mọi năng lực
 * cưỡng chế. Việc chọn runner cũng là cấu hình của nhà cung cấp `ctx.sandbox`, không phải của executor này.
 */
export type Config = LocalConfig;

/** Seam `sandboxPolicy` mà row này đọc để lấy chế độ mặc định và chính sách dự phòng. */
type SandboxPolicySeam = SandboxPolicyService;

/**
 * Sự thật cưỡng chế giữ theo TỪNG tiến trình cho tới lúc nó kết thúc: nhà cung cấp có thể đổi mức
 * cưỡng chế và phương ngữ chẩn đoán giữa các lời gọi chồng lấn, nên một giá trị "wrap mới nhất" dùng
 * chung sẽ phân loại một tiến trình bằng sự thật của tiến trình khác. Tiến trình không bị cưỡng chế
 * không có mục nào trong sổ.
 */
interface ProcessFacts {
  /** Chế độ đã yêu cầu cho tiến trình này. */
  mode: SandboxMode;
  /** Mức cưỡng chế backend đạt được cho lần bọc này. */
  enforcement: SandboxEnforcement;
  /** Phương ngữ từ chối của backend đang chọn. */
  denialSignatures: readonly string[];
  /** Luật nhận ra runner hỏng trước khi lệnh chạy. */
  runnerFailureRules: readonly RunnerFailureRule[];
  /** Chương trình runner (argv[0] của lần bọc) — dấu hiệu nhận ra lỗi spawn của chính runner. */
  runnerProgram: string | undefined;
  /** Thư mục làm việc do bên gọi sở hữu, kiểm độc lập khi quy lỗi cho runner. */
  workdir: string;
}

/**
 * Executor bash tiêu thụ sandbox. Nó bọc ĐÚNG argv bash cục bộ qua `ctx.sandbox`, thừa hưởng cơ chế
 * tiến trình cục bộ, và báo lại chế độ đã chọn, mức cưỡng chế cùng sự thật "bị từ chối". Bằng chứng
 * DƯƠNG về tệp thi hành của runner nhận ra một runner cưỡng chế hỏng: lời gọi foreground ném
 * `SANDBOX_UNAVAILABLE`, còn tiến trình nền mang cờ `runnerFailed`; mọi từ chối khác của nhà cung
 * cấp giữ nguyên ngữ nghĩa trung lập-theo-tầng của executor cục bộ. Tầng tool sở hữu việc duyệt và
 * truyền vào một chính sách đầy đủ cho TỪNG lời gọi.
 */
export class SandboxBashExecutor extends LocalBashExecutor {
  static override inject = ["subprocess", "sandbox", "sandboxPolicy"];

  /** Chế độ mặc định đã cấu hình — sự thật năng lực mà tầng tool đọc. */
  private readonly mode: SandboxMode;

  /** Sổ sự thật cưỡng chế theo từng tiến trình, xoá khi tiến trình kết thúc. */
  private readonly processFacts = new Map<ShellProcess, ProcessFacts>();

  /**
   * Đăng ký làm `ctx.shell` thay cho executor cục bộ; đòi một nhà cung cấp `ctx.sandbox` và
   * `ctx.sandboxPolicy`; tầng tool không đổi.
   * Nhận: context host (đã có `subprocess`, `sandbox`, `sandboxPolicy`) và cấu hình cục bộ.
   * Trả: thực thể executor đã đăng ký, với chế độ mặc định đọc từ chính sách triển khai.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, config);
    this.mode = ctx.sandboxPolicy.defaultMode;
  }

  /**
   * Chế độ sandbox mặc định đã cấu hình.
   * Nhận: không.
   * Trả: chế độ mặc định của triển khai (`read-only` | `workspace-write` | `danger-full-access`).
   */
  override get sandboxMode(): SandboxMode {
    return this.mode;
  }

  /**
   * Đóng dấu một chính sách đầy đủ cho TỪNG lời gọi lên spec. Lời gọi từ tầng tool cấp chế độ và gốc
   * đã giải của chính phiên gọi; lời gọi tầng thấp hơn rơi về chính sách triển khai.
   * Nhận: yêu cầu chạy của bên gọi (đã có thể mang `sandboxPolicy`).
   * Trả: spec đầy đủ, trong đó `sandboxPolicy` KHÔNG bao giờ thiếu.
   */
  override resolve(request: ShellExecRequest): ShellExecSpec {
    return {
      ...super.resolve(request),
      sandboxPolicy: request.sandboxPolicy ?? this.ctx.sandboxPolicy.resolve(),
    };
  }

  /**
   * Chuẩn bị và spawn lệnh dưới hạn đã giải: chế độ `danger-full-access` chạy thẳng như executor cục
   * bộ (không gọi nhà cung cấp); mọi chế độ khác bọc argv qua `ctx.sandbox` rồi spawn argv do nhà
   * cung cấp trả về, và kết quả mang thêm sự thật `sandbox`.
   * Nhận: spec đã giải từ {@link resolve}.
   * Trả: tay nắm tiến trình, với `result()` được trang trí thêm `sandbox` (và ném
   *        `SANDBOX_UNAVAILABLE` khi có bằng chứng runner hỏng).
   */
  override async execute(spec: ShellExecSpec): Promise<ShellExecution> {
    // `resolve()` luôn đóng dấu một chính sách đầy đủ nên `sandboxPolicy` không thể thiếu ở đây. Ép kiểu
    // (không kiểm lúc chạy) giữ nguyên hành vi của bản gốc, nơi `policy` được destructure thẳng.
    const policy = spec.sandboxPolicy as SandboxExecutionPolicy;
    const { mode } = policy;
    if (mode === "danger-full-access") {
      return SandboxBashExecutor.decorateResult(await super.execute(spec), (result) => ({
        ...result,
        sandbox: { mode, denied: false },
      }));
    }
    let confined: ConfinedArgv | undefined;
    const ex = await this.executeArgv(
      spec,
      async (signal) => {
        const prepared = await this.confine(spec.command, { ...policy, mode }, signal);
        signal.throwIfAborted();
        confined = prepared;
        return prepared.argv;
      },
      (process) => {
        // Callback này chỉ chạy SAU khi phần chuẩn bị ở trên đã gán `confined` (bản gốc cũng đọc thẳng
        // giá trị ấy); ép kiểu để không thêm một phép kiểm lúc chạy mà bản gốc không có.
        const facts = confined as ConfinedArgv;
        this.processFacts.set(process, {
          mode,
          enforcement: facts.enforcement,
          denialSignatures: facts.denialSignatures,
          runnerFailureRules: facts.runnerFailureRules,
          runnerProgram: facts.argv[0],
          workdir: spec.workdir,
        });
      },
    );
    return SandboxBashExecutor.decorateResult(
      ex,
      (result) => {
        const facts = confined;
        if (facts === undefined) {
          return { ...result, sandbox: { mode, denied: false } };
        }
        const { enforcement, denialSignatures, runnerFailureRules } = facts;
        const runnerFailure = classifyRunnerFailure(result.exitCode, result.stderr.text, runnerFailureRules);
        if (runnerFailure !== undefined) throw new SandboxUnavailableError(mode, runnerFailure.detail);
        return {
          ...result,
          sandbox: {
            mode,
            denied: classifyDenial(result, denialSignatures),
            enforcement,
          },
        };
      },
      (error) => {
        if (spec.signal?.aborted === true) spec.signal.throwIfAborted();
        if (confined !== undefined && isRunnerSpawnFailure(error, confined.argv[0], spec.workdir)) {
          throw new SandboxUnavailableError(mode, String(error));
        }
        throw error;
      },
    );
  }

  /**
   * Trang trí phép chiếu foreground của tay nắm TẠI CHỖ, ghi nhớ đúng một lần. Tay nắm giữ nguyên
   * danh tính (không bao giờ bị bọc trong một object thứ hai) vì sổ sự thật theo tiến trình và
   * `onProcessDone` khoá theo ĐÚNG thực thể ấy.
   * Nhận: tay nắm đã settle phần chuẩn bị, hàm ánh xạ kết quả, và hàm ánh xạ lỗi (luôn ném).
   * Trả: chính tay nắm đó, với `result()` đã được trang trí và memoize.
   */
  private static decorateResult(
    ex: ShellExecution,
    map: (result: ShellRunResult) => ShellRunResult,
    mapError?: (error: unknown) => never,
  ): ShellExecution {
    const base = ex.result.bind(ex);
    let decorated: Promise<ShellRunResult> | undefined;
    ex.result = (): Promise<ShellRunResult> => {
      decorated ??= base().then(map, mapError);
      return decorated;
    };
    return ex;
  }

  /**
   * Đóng dấu sự thật sandbox theo từng tiến trình TRƯỚC khi `done` settle. Tiến trình toàn-quyền không
   * có sự thật nào; chết vì tín hiệu không phải là bị từ chối.
   * Nhận: tay nắm tiến trình, phần đuôi stderr giữ lại, cờ "nhà cung cấp từ chối", và lỗi của nhà cung cấp.
   * Trả: không (ghi vào `proc.sandbox` rồi gọi hook của lớp cha).
   */
  protected override onProcessDone(proc: ShellProcess, stderr: string, providerRejected: boolean, providerError?: unknown): void {
    const facts = this.processFacts.get(proc);
    if (facts !== undefined) {
      this.processFacts.delete(proc);
      const runnerFailed = providerRejected
        ? isRunnerSpawnFailure(providerError, facts.runnerProgram, facts.workdir)
        : classifyRunnerFailure(proc.exitCode, stderr, facts.runnerFailureRules) !== undefined;
      proc.sandbox = {
        mode: facts.mode,
        denied: !runnerFailed && matchesSignature(proc.exitCode, stderr, facts.denialSignatures),
        enforcement: facts.enforcement,
        ...(runnerFailed ? { runnerFailed } : {}),
      };
    }
    super.onProcessDone(proc, stderr, providerRejected, providerError);
  }

  /**
   * Bọc MỘT lệnh shell qua nhà cung cấp `ctx.sandbox`. Lỗi của nhà cung cấp đi thẳng ra ngoài; argv
   * trả về được giao thẳng cho đường subprocess của executor cục bộ.
   * Nhận: mã shell cho `bash -c` bên trong, chính sách cưỡng chế đã giải, và tín hiệu huỷ phần chuẩn bị.
   * Trả: lời hứa về argv chính xác của nhà cung cấp kèm sự thật phân loại lúc kết thúc.
   */
  private confine(command: string, policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv> {
    return this.ctx.sandbox.confine(["bash", "-c", command], policy, signal);
  }
}

export default SandboxBashExecutor;
