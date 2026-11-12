/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Seam `ctx.worktrees`: tạo một nhánh Git MỚI + checkout mới tại một revision CỤC BỘ rồi đưa
 *      phiên gọi vào đó, dưới hạn tài nguyên và chính sách tệp hiện có của chính phiên
 *      (bản viết lại của @deepseek-ai/dsh-experimental-worktree — đối chiếu từng phần với bundle gốc).
 */

import { randomUUID } from "node:crypto";

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import z from "@deepseek-ai/schemastery";

import { PREPARE_DIRECTORY } from "./directory.ts";
import { runCommand } from "./process.ts";
import { seamsOf } from "./seams.ts";
import type { AgentLike, WorktreeSeams } from "./seams.ts";
import type { Config, CreateWorktreeRequest, CreatedWorktree, Environment } from "./types.ts";

/** Hai tệp thi hành phải KHÔNG rỗng (sau khi cắt khoảng trắng) — kiểm y bản gốc. */
const COMMAND_KEYS = ["gitCommand", "nodeCommand"] as const;

/** Ba hạn tài nguyên phải là số nguyên dương không lớn hơn MAX_TIMER_DELAY_MS — kiểm y bản gốc. */
const LIMIT_KEYS = ["timeoutMs", "graceMs", "maxOutputBytes"] as const;

/** Bốn thuộc tính của một bộ lọc Git mà checkout phải vô hiệu hoá. */
const FILTER_ATTRIBUTES = ["clean", "smudge", "process", "required"] as const;

/**
 * Từ chối đi ngược thư mục một cách ĐỘC LẬP với ngữ pháp tên nhánh của Git.
 * Nhận: giá trị cần kiểm (thường là tên nhánh hoặc đường dẫn tương đối).
 * Trả: true khi giá trị là đường dẫn tương đối, không rỗng, không chứa "\\" hay ":", và mọi đoạn đều
 *       không rỗng và không phải "." hay "..".
 */
function relativePath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.includes("\\") &&
    !value.includes(":") &&
    value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..")
  );
}

/**
 * Service tạo worktree Git có giữ lại, chạy trên các nhà cung cấp hệ tệp + sandbox đã mount.
 * Nó sở hữu tên dịch vụ `worktrees` (hợp đồng với row `tool-worktree`, nơi gọi `ctx.worktrees.create`),
 * vòng đời của chính nó, và sổ các lượt tạo đang chạy để hàm dọn chờ chúng lặng hẳn.
 */
export class WorktreeService extends Service {
  /** Năm seam phải có trước khi service hoạt động — nguyên văn bản gốc. */
  static inject = ["workingDirectory", "fs", "subprocess", "sandbox", "sandboxPolicy"];

  /** Schema cấu hình (schemastery) — bảy núm, mặc định y bản gốc. */
  static Config = z.object({
    directory: z.string().default(".agents/worktrees"),
    namePrefix: z.string().default("worktree-"),
    gitCommand: z.string().default("git"),
    nodeCommand: z.string().default("node"),
    timeoutMs: z.number().default(6e4),
    graceMs: z.number().default(3e3),
    maxOutputBytes: z.number().default(65536),
  }) as unknown as z<Config>;

  /** Cấu hình ĐÃ phân giải (schema đã điền mặc định trước khi constructor chạy). */
  private readonly config: Required<Config>;

  /** Năm seam của context, nhìn theo CẤU TRÚC — giữ nguyên tính động của phép tra service. */
  private readonly seams: WorktreeSeams;

  /** Vòng đời của service: huỷ khi plugin bị gỡ, để mọi lượt đang chạy thoát ra. */
  private readonly lifetime = new AbortController();

  /** Các lượt tạo đang chạy, để hàm dọn chờ chúng lặng hẳn. */
  private readonly pending = new Set<Promise<CreatedWorktree>>();

  /**
   * Đăng ký service `worktrees`, kiểm cấu hình, và đăng ký hàm dọn vòng đời.
   * Nhận: context host (đã có năm seam trong `inject`) và cấu hình đã qua schema.
   * Trả: thực thể đã đăng ký.
   * @throws khi `directory` hoặc `namePrefix` không tạo ra đường dẫn tương đối hợp lệ, khi một tệp thi
   *         hành rỗng, hoặc khi một hạn tài nguyên không phải số nguyên dương trong trần đồng hồ.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "worktrees");
    this.config = config as Required<Config>;
    this.seams = seamsOf(ctx);
    if (!relativePath(this.config.directory)) {
      throw new Error("worktree: directory must be a relative directory without dot segments");
    }
    if (!relativePath(`${this.config.namePrefix}name`) || this.config.namePrefix.startsWith("-")) {
      throw new Error("worktree: namePrefix must produce a relative branch name");
    }
    for (const key of COMMAND_KEYS) {
      if (this.config[key].trim().length === 0) throw new Error(`worktree: ${key} must not be empty`);
    }
    for (const key of LIMIT_KEYS) {
      const value = this.config[key];
      if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_TIMER_DELAY_MS) {
        throw new Error(`worktree: ${key} must be a positive integer no greater than ${MAX_TIMER_DELAY_MS}`);
      }
    }
    ctx.effect(() => async () => {
      this.lifetime.abort(new Error("worktree service disposed"));
      await Promise.allSettled(this.pending);
    });
  }

  /**
   * Tạo một nhánh + checkout mới tại một revision cục bộ đã ghim, rồi đưa phiên vào đó.
   * Nhánh hoặc đường dẫn checkout đã tồn tại thì HỎNG. Tệp chưa commit ở lại checkout nguồn.
   * Lượt checkout vô hiệu hoá bộ lọc clean/smudge/process đã cấu hình mà KHÔNG sửa cấu hình Git.
   * Replacement ref cục bộ của repo vẫn áp dụng; `baseCommit` báo tên đối tượng đã phân giải.
   * Checkout mới chỉ trở thành thư mục hiện tại SAU khi phần thiết lập Git thành công; lượt hỏng có thể
   * để lại nhánh/checkout vừa tạo (không có bước dọn tự động nào).
   * Nhận: agent — bên gọi, thư mục hiện tại của nó chọn repo nguồn và chính sách tệp;
   *       request — tên mới và revision cục bộ tuỳ chọn (mặc định: tên sinh tự động và HEAD);
   *       signal — huỷ lượt tra, lượt tạo, và lượt công bố thư mục.
   * Trả: đường dẫn checkout đã chuẩn hoá, tên nhánh, commit đã ghim, và gốc repo nguồn.
   */
  async create(agent: AgentLike, request: CreateWorktreeRequest = {}, signal?: AbortSignal): Promise<CreatedWorktree> {
    const operationSignal = signal === undefined ? this.lifetime.signal : AbortSignal.any([this.lifetime.signal, signal]);
    operationSignal.throwIfAborted();
    const operation = this.createCheckout(agent, this.resolve(request), operationSignal);
    this.pending.add(operation);
    try {
      return await operation;
    } finally {
      this.pending.delete(operation);
    }
  }

  /**
   * Chốt cặp (nhánh, revision) của MỘT lượt tạo — thuần, không chạm đĩa.
   * Nhận: yêu cầu của bên gọi (có thể rỗng).
   * Trả: tên nhánh (sinh tự động nếu thiếu) và revision (HEAD nếu thiếu).
   * @throws khi tên không phải tên nhánh Git tương đối hợp lệ, hoặc khi revision rỗng.
   */
  private resolve(request: CreateWorktreeRequest): { branch: string; revision: string } {
    const branch = request.name ?? `${this.config.namePrefix}${randomUUID()}`;
    if (!relativePath(branch) || branch.startsWith("-")) throw new Error("worktree name must be a relative Git branch name");
    const revision = request.from ?? "HEAD";
    if (revision.length === 0) throw new Error("worktree from must name a local commit, branch, or tag");
    return { branch, revision };
  }

  /**
   * Dựng nhánh + checkout + thư mục làm việc cho MỘT lượt tạo đã chốt cặp (nhánh, revision).
   * Nhận: agent — bên gọi (nguồn repo + chính sách tệp + đích công bố thư mục);
   *       cặp (nhánh, revision) đã chốt; signal — huỷ của lượt đã hợp nhất với vòng đời service.
   * Trả: kết quả công khai của lượt tạo (đường dẫn checkout, nhánh, commit mốc, gốc repo).
   * @throws khi Git từ chối một bước, khi nhánh/đường dẫn đã tồn tại, khi hết hạn, hoặc khi bị huỷ —
   *         mọi lỗi sau bước cấp phát thư mục được bọc kèm tên nhánh + đường dẫn và "đã giữ lại".
   */
  private async createCheckout(
    agent: AgentLike,
    { branch, revision }: { branch: string; revision: string },
    signal: AbortSignal,
  ): Promise<CreatedWorktree> {
    const cwd = await this.seams.workingDirectory.ensure(agent, signal);
    const policy = this.seams.sandboxPolicy.resolve({ session: agent.session });
    const run = (directory: string, args: string[], allowedExitCodes?: readonly number[], env?: Environment) => {
      const argv: [string, ...string[]] = [
        this.config.gitCommand,
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "core.fsmonitor=false",
        ...args,
      ];
      return runCommand(this.seams, this.config, policy, directory, argv, signal, allowedExitCodes, env);
    };
    await run(cwd, ["check-ref-format", `refs/heads/${branch}`]);
    const rootOutput = await run(cwd, ["rev-parse", "--show-toplevel"]);
    const rootTarget = await this.seams.fs.resolve(rootOutput.stdout.replace(/\r?\n$/, ""), { cwd, signal });
    const repositoryRoot = this.seams.fs.processPath(rootTarget);
    const baseCommit = (
      await run(repositoryRoot, ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`])
    ).stdout.trim();
    // Mã thoát 1 của show-ref là "không thấy nhánh" — mới là trạng thái mong muốn ở đây.
    if ((await run(repositoryRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], [0, 1])).exitCode === 0) {
      throw new Error(`worktree branch already exists: ${branch}`);
    }
    const pool = await this.seams.fs.resolve(this.config.directory, { cwd: repositoryRoot, signal });
    const poolPath = this.seams.fs.processPath(pool);
    const destination = await this.seams.fs.resolve(branch, { cwd: poolPath, signal });
    const checkoutPath = this.seams.fs.processPath(destination);
    if ((await this.seams.fs.lstat(checkoutPath, undefined, signal)) !== undefined) {
      throw new Error(`worktree path already exists: ${checkoutPath}`);
    }
    try {
      // Cấp phát thư mục đi qua TIẾN TRÌNH CON (không phải fs của ta) để nằm trong cùng sandbox với Git,
      // và để phép mkdir không đệ quy ở bước cuối là phép cấp phát ĐỘC QUYỀN.
      await runCommand(
        this.seams,
        this.config,
        policy,
        repositoryRoot,
        [this.config.nodeCommand, "--input-type=module", "-e", PREPARE_DIRECTORY, poolPath, checkoutPath],
        signal,
      );
      await run(repositoryRoot, [
        "--work-tree",
        repositoryRoot,
        "worktree",
        "add",
        "--no-checkout",
        "-b",
        branch,
        "--",
        checkoutPath,
        baseCommit,
      ]);
      const configured = await run(checkoutPath, ["config", "--null", "--name-only", "--get-regexp", "^filter\\."], [0, 1]);
      const drivers = new Set<string>();
      for (const key of configured.stdout.split("\0")) {
        const separator = key.lastIndexOf(".");
        if (separator > 7 && (FILTER_ATTRIBUTES as readonly string[]).includes(key.slice(separator + 1))) {
          drivers.add(key.slice(7, separator));
        }
      }
      // Vô hiệu hoá bộ lọc qua BIẾN MÔI TRƯỜNG của riêng lượt reset — không sửa .git/config của ai.
      const overrides: Environment = { GIT_CONFIG_COUNT: String(drivers.size * 4) };
      let index = 0;
      for (const driver of drivers) {
        for (const attribute of FILTER_ATTRIBUTES) {
          overrides[`GIT_CONFIG_KEY_${index}`] = `filter.${driver}.${attribute}`;
          overrides[`GIT_CONFIG_VALUE_${index}`] = attribute === "required" ? "false" : "";
          index++;
        }
      }
      await run(checkoutPath, ["--work-tree", checkoutPath, "reset", "--hard", "--no-recurse-submodules", baseCommit], undefined, overrides);
      return {
        path: await this.seams.workingDirectory.set(agent, checkoutPath, signal),
        branch,
        baseCommit,
        repositoryRoot,
      };
    } catch (error) {
      throw new Error(
        `Could not finish worktree ${branch} at ${checkoutPath}. Any created checkout and branch are retained. ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
}

export default WorktreeService;
