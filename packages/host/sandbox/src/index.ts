/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Backend sandbox cục bộ (ctx.sandbox) — chọn chuỗi runner theo nền tảng, dò chức năng một lần, bọc argv từng lượt gọi; thiếu confinement thì đóng cửa bằng SANDBOX_UNAVAILABLE
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Context } from "@deepseek-ai/cordis";
import { SandboxProvider, SandboxUnavailableError, canonicalPath } from "@deepseek-ai/dsh-sandbox";
import type { ConfinedArgv, SandboxPolicy } from "@deepseek-ai/dsh-sandbox";
import {
  AclWriteGrant,
  assertTempRootOutsideWorkspace,
  registerAclDiagnosisSkill,
  tempWriteSid,
  workspaceWriteSid,
} from "@deepseek-ai/dsh-sandbox-windows-acl";
import { launcherPath, probe } from "@deepseek-ai/node-addon-system/landlock-run";
import z from "@deepseek-ai/schemastery";
import {
  DENIAL_SIGNATURES,
  PLATFORM_CHAINS,
  RUNNER_FAILURE_RULES,
  STATIC_ENFORCEMENT,
  assertNever,
  assertPositiveFinite,
  defaultProbeBwrap,
  defaultProbeSeatbelt,
  defaultProbeWindowsAcl,
} from "./chain.ts";
import type { ChainVerdict, LocalRunner, RunnerVerdict } from "./chain.ts";
import { bwrapProfileArgs, landlockProfileArgs, seatbeltProfileArgs } from "./profiles.ts";

/** Plugin config. Mọi trường TUỲ CHỌN — `static Config` cấp mặc định. */
export interface Config {
  /**
   * Ghi đè argv của runner; tham số hồ sơ tương thích bwrap được nối sau. Một ghi đè KHÁC RỖNG khẳng định
   * cưỡng chế đầy đủ và bỏ qua cả việc chọn lẫn việc dò của bản dựng sẵn. Runner khởi động được nhưng từ chối
   * hồ sơ phải nhận diện được qua {@link runnerFailureSignatures}.
   */
  runnerCommand?: string[];
  /**
   * Chuỗi con stderr (không phân biệt hoa thường) mà một `runnerCommand` đã cấu hình phát ra khi nó từ chối
   * hồ sơ TRƯỚC khi chạy lệnh được bọc. Bắt buộc và phải khác rỗng khi có `runnerCommand`; bị từ chối khi
   * không có nó. Mỗi phần tử là chuỗi con MỘT DÒNG, khác rỗng.
   */
  runnerFailureSignatures?: string[];
  /** Trần thời gian DƯƠNG cho mỗi phép dò chức năng; số 0 sẽ mang nghĩa vô hạn với Node. */
  probeTimeoutMs?: number;
}

/** Móc kiểm thử: bơm kết luận dò / launcher giả / một nền tảng không có runner thật. */
export interface SandboxInternals {
  /** Thay `process.platform` khi chọn chuỗi (chạy được chuỗi của nền tảng khác từ host bất kỳ). */
  platform?: string;
  /** Thay TOÀN BỘ chuỗi của nền tảng (đo cơ chế đi chuỗi — ví dụ dò một rung mà sản phẩm chỉ chạm khi không dò). */
  chain?: readonly LocalRunner[];
  /** Thay phép dò chức năng của `bwrap` (rung đầu của chuỗi Linux). */
  probeBwrap?: () => boolean;
  /** Thay phép dò launcher Landlock (rung thứ hai của chuỗi Linux). */
  probeLandlock?: (launcher: string) => "full" | "partial" | "unusable";
  /** Thay phép dò Seatbelt (rung duy nhất của chuỗi darwin — chỉ được hỏi nếu chuỗi ấy lớn thêm). */
  probeSeatbelt?: (seatbeltExec: string) => boolean;
  /** Thay đường dẫn launcher `landlock-run` đã phân giải (một script launcher giả). */
  landlockLauncher?: string;
  /** Thay tệp `sandbox-exec` mà phép dò và phép bọc gọi tới (một script giả). */
  seatbeltExec?: string;
  /** Thay tiền tố argv runner windows-acl đã phân giải (một runner giả). */
  windowsAclRunnerArgs?: string[];
  /** Thay đường dẫn entry `lib/runner.js` đã dựng của runner windows-acl (vị trí giả). */
  windowsAclRunnerEntry?: string;
  /** Thay phép dò chức năng windows-acl (rung duy nhất của chuỗi win32 — chỉ hỏi nếu chuỗi ấy lớn thêm). */
  probeWindowsAcl?: () => boolean;
  /** Thay bước xoá thư mục tạm riêng khi provider dispose (một giả NÉM để đo nhánh dọn dẹp hỏng). */
  rmTempDir?: (path: string) => void;
}

/** Một cặp thư mục tạm riêng + năng lực ghi của nó (rung windows-acl). */
interface TempCapability {
  /** Thư mục tạm RIÊNG của cặp phiên/workspace. */
  dir: string;
  /** SID ghi của thư mục tạm ấy. */
  writeSid: string;
  /** Grant đã cấp trên thư mục tạm (thu hồi được). */
  grant: AclWriteGrant;
}

/** Danh tính phiên do lượt gọi mang xuống, lấy đúng kiểu của seam. */
type SessionIdentity = NonNullable<SandboxPolicy["sessionId"]>;

/** `import.meta` nới thêm `resolve` (Node >= 20 cấp lúc chạy; bộ kiểu của bun chưa khai). */
interface ResolvingImportMeta extends ImportMeta {
  /** Phân giải một specifier thành đường dẫn tuyệt đối. */
  resolve(specifier: string): string;
}

/** `import.meta` của chính module này, dùng cho hai lần phân giải của runner windows-acl. */
const META = import.meta as ResolvingImportMeta;

/**
 * Backend sandbox cục bộ. Chọn chuỗi runner theo nền tảng (Linux: bwrap rồi Landlock; macOS: Seatbelt;
 * Windows: runner token hạn chế của ACL), dò chức năng các ứng viên cạnh tranh MỘT lần, rồi báo cáo mức
 * cưỡng chế và các dữ kiện phân loại stderr của từng lần bọc. Thiếu confinement hoặc confinement không dùng
 * được thì ĐÓNG CỦA, không bao giờ trả lại argv nguyên bản.
 *
 * Rung windows-acl còn sở hữu các grant ghi: SID ghi là danh tính theo WORKSPACE (dẫn xuất từ đường dẫn
 * canonical — `workspaceWriteSid`), còn mỗi phiên sống nhận một thư mục tạm NGẪU NHIÊN riêng và năng lực
 * dẫn xuất của nó (`tempWriteSid`). ACE gốc workspace hiện thực MỘT lần cho mỗi workspace trong quãng đời
 * server và ĐỨNG YÊN (bộ nhớ đệm dùng lại giữa các phiên); ACE của thư mục tạm bị thu hồi khi dispose. Runner
 * nhận cả hai SID và tự thôi quản DACL. Rung này báo `partial` vì hard link NTFS làm một tệp hiện ra ở nhiều
 * đường dẫn, đọc vẫn không bị cưỡng chế, và một cây đã bị công cụ AppContainer khác gắn SID gói thì con
 * Low-integrity không đọc được.
 */
export class LocalSandboxProvider extends SandboxProvider {
  /** Schema cấu hình (schemastery) — để Settings/config-editor của kernel render được ba trường. */
  static Config = z.object({
    runnerCommand: z.array(z.string()).default([]),
    runnerFailureSignatures: z.array(z.string()).default([]),
    probeTimeoutMs: z.natural().default(5_000),
  });

  /** Móc kiểm thử (soi gương `internals` của các executor bash). */
  internals: SandboxInternals = {};

  private readonly runnerCommand: readonly string[] | undefined;
  private readonly configuredRunnerFailureSignatures: readonly string[];
  private readonly probeTimeoutMs: number;
  /** Kết luận chuỗi đã nhớ; `undefined` cho tới lần bọc đầu tiên cần nó. */
  private selectedRunner: ChainVerdict | undefined;

  /**
   * Grant ghi sống theo quãng đời server (rung windows-acl): grant gốc workspace ĐỨNG YÊN theo từng workspace
   * (ACE của nó là bộ nhớ đệm dùng lại giữa các phiên và sống lâu hơn provider — KHÔNG bao giờ thu hồi), và
   * grant thư mục tạm THU HỒI ĐƯỢC theo từng cặp phiên/workspace đang sống (thu hồi khi provider dispose).
   */
  private readonly workspaceGrants = new Map<string, AclWriteGrant>();
  private readonly tempCapabilities = new Map<string, TempCapability>();

  /**
   * Dựng provider trên Context cordis và KIỂM cấu hình ngay (ba tổ hợp sai bị từ chối tại đây, trước mọi
   * spawn); trên win32 không có `runnerCommand` thì đăng ký skill chẩn đoán ACL vào seam `skills`, và mọi
   * grant còn sống được thu hồi khi fiber dispose.
   * Nhận: Context của kernel (đã có `skills` thì skill mới đăng ký được) và cấu hình đã giải mặc định.
   * Trả: thực thể service `ctx.sandbox`.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx);
    const runner = config.runnerCommand ?? [];
    const runnerFailureSignatures = config.runnerFailureSignatures ?? [];
    if (runner.length === 0 && runnerFailureSignatures.length > 0) {
      throw new Error("sandbox-local: runnerFailureSignatures requires runnerCommand");
    }
    if (runner.length > 0 && runnerFailureSignatures.length === 0) {
      throw new Error("sandbox-local: runnerCommand requires at least one runnerFailureSignatures entry");
    }
    if (runnerFailureSignatures.some((signature) => signature.trim().length === 0 || /[\r\n]/u.test(signature))) {
      throw new Error("sandbox-local: runnerFailureSignatures entries must be non-empty single-line strings");
    }
    this.runnerCommand = runner.length > 0 ? runner : undefined;
    this.configuredRunnerFailureSignatures = runnerFailureSignatures;
    this.probeTimeoutMs = config.probeTimeoutMs ?? 5_000;
    assertPositiveFinite("probeTimeoutMs", this.probeTimeoutMs);
    /* istanbul ignore next -- chỉ đăng ký trên Windows; làn phủ Linux/macOS không chạm nhánh này */
    if (process.platform === "win32" && this.runnerCommand === undefined) {
      ctx.inject(["skills"], (skillsCtx) => {
        registerAclDiagnosisSkill(skillsCtx);
      });
    }
    ctx.effect(() => () => {
      this.revokeAclGrants();
    });
  }

  /**
   * Bọc `argv` vào lời gọi của runner đã chọn cho `policy` — `runnerCommand` đã cấu hình khi có (khẳng định
   * của người vận hành, KHÔNG dò), ngược lại là runner của chuỗi nền tảng nói phương ngữ hồ sơ của chính nó.
   * Nhận: argv y nguyên mà bên gọi sắp spawn, policy tác động tệp của lượt gọi, và tín hiệu huỷ.
   * Trả: argv đã bọc kèm mức cưỡng chế, các dấu hiệu từ chối và luật lỗi runner có cấu trúc; ném
   *   `SANDBOX_UNAVAILABLE` (đóng cửa) khi nền tảng không có runner dùng được.
   */
  override async confine(argv: readonly string[], policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv> {
    signal?.throwIfAborted();
    const resolved: SandboxPolicy = { ...policy, workspaceRoot: canonicalPath(policy.workspaceRoot) };
    if (this.runnerCommand !== undefined) {
      return Promise.resolve({
        argv: [...this.runnerCommand, ...bwrapProfileArgs(resolved), "--", ...argv],
        enforcement: "full",
        denialSignatures: DENIAL_SIGNATURES.runnerCommand,
        runnerFailureRules: [{ fatalSignatures: this.configuredRunnerFailureSignatures }],
      });
    }
    const selected = this.selectRunner(resolved.mode);
    const runnerArgv = this.runnerArgv(selected.runner, resolved);
    return Promise.resolve({
      argv: [...runnerArgv, "--", ...argv],
      enforcement: selected.enforcement,
      denialSignatures: DENIAL_SIGNATURES[selected.runner],
      runnerFailureRules: RUNNER_FAILURE_RULES[selected.runner],
    });
  }

  /**
   * Lời gọi runner của rung đã chọn (chương trình + tham số hồ sơ) cho một policy.
   * Nhận: rung runner và policy đã canonical hoá.
   * Trả: mảng argv TRƯỚC dấu phân cách `--`.
   */
  private runnerArgv(runner: LocalRunner, policy: SandboxPolicy): string[] {
    switch (runner) {
      case "bwrap":
        return ["bwrap", ...bwrapProfileArgs(policy)];
      case "landlock":
        return [this.landlockLauncher(), ...landlockProfileArgs(policy)];
      case "seatbelt":
        return [this.seatbeltExec(), ...seatbeltProfileArgs(policy)];
      case "windows-acl":
        return this.windowsAclRunnerArgv(policy);
      default:
        return assertNever(runner);
    }
  }

  /**
   * Argv runner windows-acl cho một policy. Có phiên gọi (policy mang `sessionId`) và đang ở
   * `workspace-write` thì các grant được hiện thực MỘT lần trong quãng đời provider — grant gốc workspace
   * đứng yên theo workspace, cộng một năng lực thư mục tạm NGẪU NHIÊN thu hồi được theo cặp phiên/workspace.
   * Runner nhận `--write-sid` cùng `--temp-write-sid` và tự cấp không gì. Lượt `workspace-write` KHÔNG có
   * phiên thì truyền GỐC tạm của môi trường và không cờ SID: runner tự tạo rồi xoá một thư mục con ngẫu nhiên
   * cho đúng lượt ấy.
   * Nhận: policy đã giải của lượt gọi.
   * Trả: lời gọi runner (chương trình + tham số).
   */
  private windowsAclRunnerArgv(policy: SandboxPolicy): string[] {
    const sessionId = policy.sessionId;
    if (sessionId === undefined || policy.mode === "read-only") {
      return [
        ...this.windowsAclRunnerInvocation(),
        "--workspace",
        policy.workspaceRoot,
        "--temp",
        tmpdir(),
        "--mode",
        policy.mode,
      ];
    }
    const temp = this.materializeAclGrant(sessionId, policy.workspaceRoot);
    return [
      ...this.windowsAclRunnerInvocation(),
      "--workspace",
      policy.workspaceRoot,
      "--temp",
      temp.dir,
      "--mode",
      policy.mode,
      "--write-sid",
      workspaceWriteSid(policy.workspaceRoot),
      "--temp-write-sid",
      temp.writeSid,
    ];
  }

  /**
   * Hiện thực ACE của một policy `workspace-write` MỘT lần trong quãng đời provider. SID workspace và grant
   * gốc được chia sẻ theo workspace; thư mục tạm thì ngẫu nhiên và mang SID riêng, nên một phiên khác trên
   * cùng workspace không thể dùng SID workspace chung để vào đó. Provider mới luôn chọn đường dẫn mới, nên
   * tàn dư của lần chết không thể đụng hay uỷ quyền cho một phiên được khôi phục. Đóng cửa: một grant tạm
   * hiện thực dở bị thu hồi và thư mục của nó bị xoá TRƯỚC khi lỗi lan ra.
   * Nhận: danh tính phiên của lượt gọi và gốc workspace đã giải.
   * Trả: thư mục tạm riêng của cặp cùng năng lực ghi của nó.
   */
  private materializeAclGrant(sessionId: SessionIdentity, workspaceRoot: string): TempCapability {
    assertTempRootOutsideWorkspace(workspaceRoot, tmpdir());
    const writeSid = workspaceWriteSid(workspaceRoot);
    if (!this.workspaceGrants.has(workspaceRoot)) {
      const grant = AclWriteGrant.create(writeSid);
      try {
        grant.add(workspaceRoot, true);
      } catch (error) {
        try {
          grant.dispose();
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            "sandbox-local windows-acl workspace grant failed and its cleanup also failed",
          );
        }
        throw error;
      }
      this.workspaceGrants.set(workspaceRoot, grant);
    }
    const key = JSON.stringify([String(sessionId), workspaceRoot]);
    const existing = this.tempCapabilities.get(key);
    if (existing !== undefined) return existing;
    const tempDir = mkdtempSync(join(tmpdir(), "gbh-"));
    const tempSid = tempWriteSid(tempDir);
    let grant: AclWriteGrant | undefined;
    try {
      grant = AclWriteGrant.create(tempSid);
      grant.add(tempDir);
    } catch (error) {
      const cleanupFailures: unknown[] = [];
      if (grant !== undefined) {
        try {
          grant.dispose();
        } catch (cleanupError) {
          cleanupFailures.push(cleanupError);
        }
      }
      try {
        this.removeTempDir(tempDir);
      } catch (cleanupError) {
        cleanupFailures.push(cleanupError);
      }
      if (cleanupFailures.length > 0) {
        throw new AggregateError(
          [error, ...cleanupFailures],
          "sandbox-local windows-acl temp grant materialization failed and its cleanup also failed",
        );
      }
      throw error;
    }
    const capability: TempCapability = { dir: tempDir, writeSid: tempSid, grant };
    this.tempCapabilities.set(key, capability);
    return capability;
  }

  /**
   * Thu hồi MỌI grant ghi (provider dispose): ACE tạm thu hồi được bị gỡ, các thư mục tạm riêng do provider
   * này tạo bị xoá, mọi cấp phát SID được trả; ACE workspace đứng yên thì Ở LẠI (bộ nhớ đệm dùng lại). Lỗi dọn
   * dẹp được BÁO, không ném: teardown cordis không được bị grant làm gãy giữa đường. Sự cố chết đột ngột bỏ
   * qua toàn bộ bước này, nhưng provider mới không bao giờ dùng lại đường dẫn hay SID tàn dư.
   * Nhận: không.
   * Trả: không trả gì.
   */
  private revokeAclGrants(): void {
    if (this.workspaceGrants.size === 0 && this.tempCapabilities.size === 0) return;
    const failures: unknown[] = [];
    for (const grant of [
      ...this.workspaceGrants.values(),
      ...[...this.tempCapabilities.values()].map((capability) => capability.grant),
    ]) {
      try {
        grant.dispose();
      } catch (error) {
        failures.push(error);
      }
    }
    for (const { dir } of this.tempCapabilities.values()) {
      try {
        this.removeTempDir(dir);
      } catch (error) {
        failures.push(error);
      }
    }
    this.workspaceGrants.clear();
    this.tempCapabilities.clear();
    if (failures.length > 0) {
      this.ctx.logger.warn(`sandbox-local: windows-acl grant cleanup completed with ${failures.length} failure(s)`);
      for (const error of failures) this.ctx.logger.warn(error);
    }
  }

  /**
   * Xoá MỘT thư mục tạm riêng do provider sở hữu (bơm được để kiểm nhánh dọn dẹp).
   * Nhận: đường dẫn thư mục cần xoá.
   * Trả: không trả gì.
   */
  private removeTempDir(dir: string): void {
    (this.internals.rmTempDir ??
      ((path: string) => {
        rmSync(path, { recursive: true, force: true });
      }))(dir);
  }

  /**
   * Giải xem runner nào cưỡng chế lệnh — MỘT lần cho quãng đời provider: chuỗi của nền tảng này
   * ({@link PLATFORM_CHAINS}), ứng viên duy nhất được chọn thẳng, nhiều ứng viên được TRỌNG TÀI bằng phép dò
   * chức năng theo đúng thứ tự chuỗi. Đóng cửa khi nền tảng không có chuỗi hoặc không ứng viên nào đạt —
   * lệnh không bao giờ chạy.
   * Nhận: chế độ đang bị cưỡng chế (đi vào thông điệp lỗi đóng cửa).
   * Trả: kết luận chuỗi đã nhớ (đã loại nhánh `unavailable` — nhánh ấy ném).
   */
  private selectRunner(mode: SandboxPolicy["mode"]): RunnerVerdict {
    const verdict = this.selectedRunner ?? this.chainVerdict();
    this.selectedRunner = verdict;
    if (verdict === "unavailable") throw new SandboxUnavailableError(mode);
    return verdict;
  }

  /**
   * Đi hết chuỗi của nền tảng: ứng viên duy nhất không dò, nhiều ứng viên thì dò theo thứ tự, không rung nào
   * dùng được ⇒ `unavailable`.
   * Nhận: không.
   * Trả: một runner kèm mức cưỡng chế, hoặc `unavailable`.
   */
  private chainVerdict(): ChainVerdict {
    const chain = this.internals.chain ?? PLATFORM_CHAINS[this.internals.platform ?? process.platform] ?? [];
    const [first, ...rest] = chain;
    if (first === undefined) return "unavailable";
    if (rest.length === 0) return { runner: first, enforcement: STATIC_ENFORCEMENT[first] };
    for (const runner of chain) {
      const enforcement = this.probeRunner(runner);
      if (enforcement !== "unusable") return { runner, enforcement };
    }
    return "unavailable";
  }

  /**
   * Phép dò chức năng của MỘT rung (mỗi rung nhiều nhất một lần, nhờ lần đi chuỗi).
   * Nhận: rung cần dò.
   * Trả: mức cưỡng chế rung ấy đạt được, hoặc `unusable`.
   */
  private probeRunner(runner: LocalRunner): "full" | "partial" | "unusable" {
    switch (runner) {
      case "bwrap":
        return (this.internals.probeBwrap ?? (() => defaultProbeBwrap(this.probeTimeoutMs)))() ? "full" : "unusable";
      case "landlock":
        return (this.internals.probeLandlock ?? ((launcher: string) => probe(launcher, { timeoutMs: this.probeTimeoutMs })))(
          this.landlockLauncher(),
        );
      case "seatbelt":
        return (this.internals.probeSeatbelt ?? ((exec: string) => defaultProbeSeatbelt(exec, this.probeTimeoutMs)))(
          this.seatbeltExec(),
        )
          ? "full"
          : "unusable";
      case "windows-acl":
        return (this.internals.probeWindowsAcl ??
          (() => defaultProbeWindowsAcl(this.windowsAclRunnerInvocation(), this.probeTimeoutMs)))()
          ? "partial"
          : "unusable";
      default:
        return assertNever(runner);
    }
  }

  /**
   * Launcher Landlock sẽ dò và chạy (móc kiểm thử đè lên đường dẫn đã phân giải).
   * Nhận: không.
   * Trả: đường dẫn tệp launcher.
   */
  private landlockLauncher(): string {
    return this.internals.landlockLauncher ?? launcherPath();
  }

  /**
   * Tệp `sandbox-exec` sẽ dò và chạy (móc kiểm thử đè lên tệp của hệ thống).
   * Nhận: không.
   * Trả: tên tệp thực thi.
   */
  private seatbeltExec(): string {
    return this.internals.seatbeltExec ?? "sandbox-exec";
  }

  /**
   * Tiền tố argv của runner windows-acl: entry `lib/runner.js` đã dựng khi có (sản phẩm), ngược lại là nguồn
   * của gói qua `tsx` (phát triển). Bộ nạp nguồn và đường dẫn TypeScript được ghim vào CHÍNH bản cài này,
   * độc lập với cwd của lệnh và biến môi trường. Tiền tố luôn là `[node, runner, ...]` — một runner exe gốc
   * sau này giữ nguyên hợp đồng argv và chỉ đổi đúng các phần tử này.
   * Nhận: không.
   * Trả: tiền tố argv của runner.
   */
  private windowsAclRunnerInvocation(): string[] {
    const override = this.internals.windowsAclRunnerArgs;
    if (override !== undefined) return override;
    const builtEntry =
      this.internals.windowsAclRunnerEntry ?? fileURLToPath(META.resolve("@deepseek-ai/dsh-sandbox-windows-acl/runner"));
    if (existsSync(builtEntry)) return [process.execPath, builtEntry];
    const sourceEntry = fileURLToPath(META.resolve("@deepseek-ai/dsh-sandbox-windows-acl/src/runner.ts"));
    const sourceConfig = fileURLToPath(new URL("../../../../tsconfig.base.json", import.meta.url));
    const registration = `import { register } from ${JSON.stringify(META.resolve("tsx/esm/api"))}; register({ tsconfig: ${JSON.stringify(sourceConfig)} });`;
    return [process.execPath, "--import", `data:text/javascript,${encodeURIComponent(registration)}`, sourceEntry];
  }
}

export default LocalSandboxProvider;
/**
 * Bảy KIỂU của seam sandbox mà bản gốc xuất trong `lib/types/index.d.ts` nhưng bề mặt giá trị ở đây chưa phơi lại.
 * Nhận: không — chỉ là kiểu, không phát sinh mã lúc chạy (nên cổng so `Object.keys` vẫn khớp bản gốc).
 * Trả: các kiểu dùng chung `SandboxMode`/`ConfinedSandboxMode`/`SandboxExecutionPolicy`/`SandboxEnforcement`/
 *   `SandboxPolicy`/`RunnerFailureRule`/`ConfinedArgv` cho nơi dùng khai theo id của ta (R5: đủ mặt xuất như gốc).
 */
export type {
  ConfinedArgv,
  ConfinedSandboxMode,
  RunnerFailureRule,
  SandboxEnforcement,
  SandboxExecutionPolicy,
  SandboxMode,
  SandboxPolicy,
} from "@deepseek-ai/dsh-sandbox";
export {
  ESCALATION_TARGETS,
  SANDBOX_UNAVAILABLE,
  SandboxProvider,
  SandboxUnavailableError,
  WIDER_MODES,
  approveEscalation,
  canonicalPath,
  classifyRunnerFailure,
  escalationHintMarker,
  isRunnerSpawnFailure,
  matchesSignature,
  sandboxDenialMarker,
  sandboxPermissionsDescription,
  validateEscalationArgs,
  writableRoots,
} from "@deepseek-ai/dsh-sandbox";
