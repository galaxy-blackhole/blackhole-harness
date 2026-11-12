/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chạy git qua seam tiến trình con: chụp cây làm việc thành tree object, đọc blob, so hai tree,
 *      tra gitlink và đường dẫn bị bỏ qua — port 1:1 lib/types/git.js của bản gốc.
 */

import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { type NumstatEntry, parseNumstat } from "./numstat.ts";
import { canonicalPath, isInside, toPosix } from "./paths.ts";

/** Số mili giây tiến trình git con được phép thoát sau khi bắt đầu kết thúc; một hằng vòng đời cố định. */
const TERMINATE_GRACE_MS = 2_000;

/** Đuôi stderr được giữ lại để chẩn đoán. */
const STDERR_TAIL_BYTES = 16 * 1024;

/**
 * Một lần đọc tăng dần của một luồng đã thu; chỉ khai đúng phần module này dùng.
 * Bộ đọc neo theo offset toàn luồng do bên gọi sở hữu, nên nhiều bộ đọc không ăn mất đầu ra của nhau.
 */
export interface SubprocessOutputReadLike {
  /** Chữ của luồng tính từ offset đã yêu cầu (là cả đuôi giữ lại khi lossy). */
  readonly text: string;
  /** true khi offset yêu cầu đã trượt khỏi cửa sổ đuôi trong bộ nhớ. */
  readonly lossy: boolean;
}

/** Bộ đọc theo offset cho một luồng ở chế độ thu. */
export interface SubprocessOutputReaderLike {
  /**
   * Đọc mọi thứ đã thu tính từ một offset.
   * Nhận: fromByte — offset toàn luồng (0 cho lần đọc đầu).
   * Trả: chữ của phần tăng thêm và cờ lossy.
   */
  readFrom(fromByte: number): SubprocessOutputReadLike;
}

/** Sự thật kết thúc của một tiến trình đã đóng — từ vựng sự kiện close của Node. */
export interface SubprocessOutcomeLike {
  /** Mã thoát; null khi tiến trình chết vì tín hiệu. */
  readonly exitCode: number | null;
}

/** Tay nắm một tiến trình sống và dải tiến trình do nhà cung cấp quản lý. */
export interface SubprocessHandleLike {
  /** Bộ đọc theo offset cho các luồng ở chế độ thu (vẫn đọc được sau khi thoát). */
  readonly collected: {
    /** Có mặt khi stdout ở chế độ thu. */
    readonly stdout?: SubprocessOutputReaderLike;
    /** Có mặt khi stderr ở chế độ thu. */
    readonly stderr?: SubprocessOutputReaderLike;
  };
  /** Kết thúc bằng sự thật thoát của lệnh đã spawn; ném khi spawn hoặc nhà cung cấp hỏng. */
  readonly done: Promise<SubprocessOutcomeLike>;
}

/** Một yêu cầu spawn đã đặc tả đầy đủ — seam này KHÔNG áp mặc định nào. */
export interface SubprocessSpawnSpecLike {
  /** Tệp thi hành và tham số; argv[0] là chương trình, không bao giờ qua shell. */
  readonly argv: readonly string[];
  /** Thư mục làm việc của tiến trình con. */
  readonly cwd: string;
  /** Cách xử lý từng luồng stdio. */
  readonly stdio: {
    /** Cách xử lý stdin ("ignore" để fd 0 trỏ /dev/null). */
    readonly stdin: "ignore" | "pipe" | { readonly data: string };
    /** Cách xử lý stdout (đối tượng thu có giới hạn số byte). */
    readonly stdout: "pipe" | "inherit" | { readonly maxBytes: number };
    /** Cách xử lý stderr (đối tượng thu có giới hạn số byte). */
    readonly stderr: "pipe" | "inherit" | { readonly maxBytes: number };
  };
  /** Thời gian ân hạn kết thúc (ms). */
  readonly graceMs: number;
  /** Tín hiệu huỷ — bắt đầu quy trình kết thúc dải đã quản lý khi phát. */
  readonly signal?: AbortSignal | undefined;
  /** Biến môi trường ghi đè, trộn lên nền đã khử credential của nhà cung cấp. */
  readonly env?: Readonly<Record<string, string | undefined>> | undefined;
}

/** Seam tiến trình con ("ctx.subprocess") — đúng một lời gọi mà module này dùng. */
export interface SubprocessRuntimeLike {
  /**
   * Khởi động một tiến trình con được quản lý từ spec đã đặc tả đầy đủ.
   * Nhận: spec — argv, thư mục, stdio, ân hạn, huỷ, môi trường.
   * Trả: tay nắm sống của tiến trình.
   */
  spawn(spec: SubprocessSpawnSpecLike): SubprocessHandleLike;
}

/** Sự thật một lệnh git đã chốt; mã thoát khác 0 là KẾT QUẢ, không phải ngoại lệ. */
export interface GitRunResult {
  /** Mã thoát; null khi tiến trình chết vì tín hiệu. */
  exitCode: number | null;
  /** Toàn bộ stdout đã thu (đuôi khi bị cắt đầu). */
  stdout: string;
  /** Đuôi stderr đã thu, dùng cho chẩn đoán. */
  stderr: string;
  /** true khi stdout vượt hạn và mất phần đầu. */
  truncated: boolean;
}

/** Sự thật spawn theo từng lệnh. */
export interface GitRunOptions {
  /** Thư mục làm việc của lệnh git. */
  cwd: string;
  /** Biến môi trường thêm, trộn SAU các biến gốc của runner. */
  env?: Readonly<Record<string, string>> | undefined;
  /** Dữ liệu ghi vào stdin rồi đóng; vắng thì stdin là /dev/null. */
  stdin?: string | undefined;
  /** Hạn stdout trong bộ nhớ cho riêng lệnh này, thay cho outputMaxBytes của runner. */
  maxBytes?: number | undefined;
  /** Huỷ lệnh. */
  signal: AbortSignal;
}

/** Các hạn mà MỌI lệnh git chạy dưới. */
export interface GitLimits {
  /** Số mili giây trước khi lệnh bị kết thúc. */
  timeoutMs: number;
  /** Hạn stdout trong bộ nhớ, tính bằng byte. */
  outputMaxBytes: number;
}

/** Repository bao quanh thư mục làm việc của Session và thư mục riêng mà snapshot ghi vào. */
export interface GitWorkspace {
  /** Thư mục gốc repository — gốc mà mọi đường dẫn diff tương đối so với. */
  root: string;
  /** Thư mục git tuyệt đối giữ index của repository. */
  gitDir: string;
  /** Thư mục riêng giữ object store của snapshot và index nháp của từng snapshot. */
  scratch: string;
  /** Môi trường định tuyến ghi object vào store riêng và đọc object qua store của repository. */
  env: Readonly<Record<string, string>>;
  /** Đường dẫn trong cây làm việc mà snapshot phải bỏ qua: thư mục riêng khi gốc tạm nằm trong cây. */
  excludes: readonly string[];
}

/** Một blob mà một snapshot tree giữ tại một đường dẫn. */
export interface TreeBlob {
  /** Mã đối tượng blob. */
  oid: string;
  /** Kích thước đối tượng, tính bằng byte. */
  size: number;
}

/**
 * Chạy một tệp git đã phân giải với môi trường đã khử, hạn chót và đầu ra có giới hạn.
 * Nhận: subprocess — seam tiến trình con; executable — đường dẫn git đã phân giải;
 *       limits — hạn thời gian và hạn stdout của mọi lệnh.
 * Trả: thể hiện runner dùng lại được cho nhiều lệnh.
 */
export class GitRunner {
  private readonly subprocess: SubprocessRuntimeLike;
  private readonly executable: string;
  private readonly limits: GitLimits;

  /**
   * Ghi nhớ tệp git và các hạn của nó.
   * Nhận: subprocess — seam tiến trình con; executable — đường dẫn git đã phân giải;
   *       limits — hạn thời gian và hạn stdout.
   * Trả: không.
   */
  constructor(subprocess: SubprocessRuntimeLike, executable: string, limits: GitLimits) {
    this.subprocess = subprocess;
    this.executable = executable;
    this.limits = limits;
  }

  /**
   * Chạy `git <args>` tới khi kết thúc.
   * Nhận: args — tham số git, KHÔNG bao giờ qua shell; options — thư mục làm việc, môi trường thêm,
   *       dữ liệu stdin, hạn stdout riêng, và huỷ.
   * Trả: sự thật thoát và đầu ra đã thu (stdout có thể mất đầu, stderr là đuôi chẩn đoán).
   * @throws khi lệnh hết hạn, bị huỷ, hoặc không spawn được.
   */
  async run(args: readonly string[], options: GitRunOptions): Promise<GitRunResult> {
    const timeout = AbortSignal.timeout(this.limits.timeoutMs);
    const signal = AbortSignal.any([options.signal, timeout]);
    const handle = this.subprocess.spawn({
      argv: [this.executable, ...args],
      cwd: options.cwd,
      stdio: {
        stdin: options.stdin === undefined ? "ignore" : { data: options.stdin },
        stdout: { maxBytes: options.maxBytes ?? this.limits.outputMaxBytes },
        stderr: { maxBytes: STDERR_TAIL_BYTES },
      },
      graceMs: TERMINATE_GRACE_MS,
      signal,
      // Phép khử credential của seam tiến trình con xoá các mục GIT_CONFIG_KEY_n từ môi trường cha.
      env: { GIT_CONFIG_COUNT: "0", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C", ...options.env },
    });
    const outcome = await handle.done;
    if (signal.aborted) {
      // Phân loại đúng nguyên nhân: hết hạn của runner hay huỷ của bên gọi.
      throw new Error(
        `git ${args.join(" ")} ${timeout.aborted ? `timed out after ${this.limits.timeoutMs}ms` : "was aborted"}`,
      );
    }
    /* v8 ignore start -- stdio chế độ thu luôn cho cả hai bộ đọc. */
    const stdout = handle.collected.stdout?.readFrom(0) ?? { text: "", lossy: false };
    const stderr = handle.collected.stderr?.readFrom(0).text ?? "";
    /* v8 ignore stop */
    return { exitCode: outcome.exitCode, stdout: stdout.text, stderr, truncated: stdout.lossy };
  }
}

/**
 * Ném lỗi kèm stderr khi lệnh thất bại.
 * Nhận: result — sự thật lệnh đã chốt; what — mô tả lệnh cho thông điệp lỗi.
 * Trả: CHÍNH result khi nó thoát mã 0.
 * @throws khi result.exitCode khác 0, với thông điệp `<what> failed: <stderr>`.
 */
function ok(result: GitRunResult, what: string): GitRunResult {
  if (result.exitCode !== 0) throw new Error(`${what} failed: ${result.stderr.trim()}`);
  return result;
}

/**
 * Cho biết một lỗi hệ tệp có nêu đường dẫn không tồn tại hay không.
 * Nhận: error — giá trị bất kỳ bị ném ra.
 * Trả: true khi đó là vật thể có mã ENOENT.
 */
function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT";
}

/**
 * Định vị repository bao quanh một thư mục làm việc và chuẩn bị thư mục riêng mà snapshot ghi vào.
 * Object store của chính repository được gắn làm alternate CHỈ ĐỌC, nên snapshot đọc nội dung đã commit
 * từ đó và không ghi gì vào nó. Thư mục riêng nằm trong cây làm việc (như gốc tạm dưới workspace) bị loại
 * khỏi mọi snapshot. Thư mục ngoài mọi repository trả null; mọi lỗi git khác ném.
 * Nhận: git — runner lệnh; cwd — thư mục làm việc tuyệt đối của Session; scratch — hàm trả thư mục riêng
 *       cho object snapshot và index nháp (CHỈ gọi khi đã định vị được repository); signal — huỷ.
 * Trả: repository đã định vị, hoặc null khi thư mục không nằm trong repository nào.
 * @throws khi `git rev-parse` thất bại vì lý do khác "không phải repository", hoặc khi tạo thư mục objects lỗi.
 */
export async function locateGitWorkspace(
  git: GitRunner,
  cwd: string,
  scratch: () => Promise<string>,
  signal: AbortSignal,
): Promise<GitWorkspace | null> {
  const found = await git.run(["rev-parse", "--show-toplevel", "--absolute-git-dir", "--git-path", "objects"], {
    cwd,
    signal,
  });
  if (found.exitCode === 128 && /not a git repository/i.test(found.stderr)) return null;
  const lines = ok(found, "git rev-parse")
    .stdout.split("\n")
    .map((line) => resolve(cwd, line));
  // git in đúng ba dòng (root, git dir, objects); ép kiểu để giữ nguyên hành vi gốc.
  const [root, gitDir, repositoryObjects] = lines as [string, string, string];
  // git báo gốc theo dạng chuẩn tắc; so thư mục riêng bằng đúng cách viết đó.
  const directory = await canonicalPath(await scratch());
  const objects = join(directory, "objects");
  await mkdir(objects, { recursive: true });
  const excludes = isInside(root, directory) ? [toPosix(relative(root, directory))] : [];
  const env = { GIT_OBJECT_DIRECTORY: objects, GIT_ALTERNATE_OBJECT_DIRECTORIES: repositoryObjects };
  return { root, gitDir, scratch: directory, env, excludes };
}

/**
 * Ghi TOÀN BỘ cây làm việc — kể cả tệp chưa theo dõi và tệp đã sửa, nhưng không gồm tệp bị bỏ qua —
 * thành một tree object qua index riêng khởi tạo từ index của repository. Blob mới và tree nằm trong
 * object store riêng; index, object store, cây làm việc và ref của repository không đổi, và một lượt
 * merge đang dở vẫn giữ các mục chưa hợp nhất.
 * Nhận: git — runner lệnh; workspace — repository đã định vị; signal — huỷ.
 * Trả: mã đối tượng tree.
 * @throws khi `git add` thất bại với mã thoát khác 1, hoặc khi `git write-tree` thất bại.
 */
export async function snapshotTree(git: GitRunner, workspace: GitWorkspace, signal: AbortSignal): Promise<string> {
  const scratch = await mkdtemp(join(workspace.scratch, "index-"));
  try {
    const index = join(scratch, "index");
    // Repository chưa có index (vừa `git init`) thì bắt đầu từ index trống.
    await copyFile(join(workspace.gitDir, "index"), index).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
    });
    const env = { ...workspace.env, GIT_INDEX_FILE: index };
    // `--ignore-errors` bỏ qua tệp không đọc được và báo qua mã thoát 1; index vẫn đầy đủ.
    const pathspec: string[] =
      workspace.excludes.length === 0 ? [] : ["--", ".", ...workspace.excludes.map((path) => `:(exclude)${path}`)];
    const added = await git.run(["add", "--all", "--ignore-errors", ...pathspec], {
      cwd: workspace.root,
      env,
      signal,
    });
    /* v8 ignore next -- git chỉ báo tệp không đọc được trên hệ mà test thu hồi được quyền. */
    if (added.exitCode !== 1) ok(added, `git add in ${workspace.root}`);
    return ok(await git.run(["write-tree"], { cwd: workspace.root, env, signal }), "git write-tree").stdout.trim();
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

/**
 * Blob mà một snapshot tree giữ tại một đường dẫn.
 * Nhận: git — runner lệnh; workspace — repository đã định vị; tree — mã tree snapshot;
 *       path — đường dẫn dạng slash, tương đối so với gốc repository; signal — huỷ.
 * Trả: blob, hoặc null khi tree không giữ gì tại đường dẫn đó, hoặc giữ gitlink hay tree ở đó.
 * @throws khi `git ls-tree` thất bại.
 */
export async function treeBlob(
  git: GitRunner,
  workspace: GitWorkspace,
  tree: string,
  path: string,
  signal: AbortSignal,
): Promise<TreeBlob | null> {
  // Đường dẫn là pathspec; khớp literal giữ cho `*`, `?`, `[` trong tên tệp không chọn nhầm mục khác.
  const result = ok(
    await git.run(["ls-tree", "-z", "-l", tree, "--", path], {
      cwd: workspace.root,
      env: { ...workspace.env, GIT_LITERAL_PATHSPECS: "1" },
      signal,
    }),
    "git ls-tree",
  );
  const entry = result.stdout.split("\0")[0] as string;
  const match = /^\d+ (\S+) ([0-9a-f]+) +(\d+)\t/.exec(entry);
  if (match === null || match[1] !== "blob") return null;
  return { oid: match[2] as string, size: Number(match[3]) };
}

/**
 * Văn bản của một blob mà {@link treeBlob} đã báo kích thước nằm trong hạn.
 * Nhận: git — runner lệnh; workspace — repository đã định vị; oid — mã blob;
 *       maxBytes — hạn byte bao gồm mà bên gọi đã kiểm kích thước blob; signal — huỷ.
 * Trả: blob đã giải mã UTF-8.
 * @throws khi `git cat-file` thất bại, hoặc khi đầu ra vượt hạn (không thể xảy ra nếu đã kiểm trước).
 */
export async function blobText(
  git: GitRunner,
  workspace: GitWorkspace,
  oid: string,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const result = ok(
    await git.run(["cat-file", "blob", oid], { cwd: workspace.root, env: workspace.env, maxBytes, signal }),
    "git cat-file",
  );
  /* v8 ignore next -- bên gọi đã đo blob bằng treeBlob trước; blob bất biến nên hạn không thể bị vượt. */
  if (result.truncated) throw new Error(`blob ${oid} exceeds ${maxBytes} bytes`);
  return result.stdout;
}

/**
 * Số dòng theo từng tệp giữa hai snapshot tree, có nhận diện đổi tên.
 * Nhận: git — runner lệnh; workspace — repository đã định vị; before — mã tree đầu lượt;
 *       after — mã tree cuối lượt; signal — huỷ.
 * Trả: các tệp đã đổi, tương đối so với gốc repository.
 * @throws khi git thất bại hoặc đầu ra vượt hạn.
 */
export async function diffTrees(
  git: GitRunner,
  workspace: GitWorkspace,
  before: string,
  after: string,
  signal: AbortSignal,
): Promise<NumstatEntry[]> {
  if (before === after) return [];
  const result = ok(
    await git.run(["diff-tree", "-r", "-M", "-z", "--numstat", before, after], {
      cwd: workspace.root,
      env: workspace.env,
      signal,
    }),
    "git diff-tree",
  );
  if (result.truncated) throw new Error("git diff-tree output exceeded the configured cap");
  return parseNumstat(result.stdout);
}

/**
 * Các thư mục trong cây làm việc mà index ghi là gitlink: repository lồng nhau và submodule, nơi snapshot
 * không bao giờ đi xuống và `check-ignore` từ chối phân loại.
 * Nhận: git — runner lệnh; workspace — repository đã định vị; signal — huỷ.
 * Trả: các đường dẫn gitlink dạng slash, tương đối so với gốc repository.
 * @throws khi `git ls-files` thất bại.
 */
export async function gitlinkPaths(git: GitRunner, workspace: GitWorkspace, signal: AbortSignal): Promise<Set<string>> {
  const result = ok(
    await git.run(["ls-files", "-z", "--stage"], { cwd: workspace.root, env: workspace.env, signal }),
    "git ls-files",
  );
  const links = new Set<string>();
  for (const entry of result.stdout.split("\0")) {
    if (entry.startsWith("160000 ")) links.add(entry.slice(entry.indexOf("\t") + 1));
  }
  return links;
}

/**
 * Tập con các đường dẫn trong cây làm việc mà repository bỏ qua. Tệp đã theo dõi KHÔNG bao giờ được báo,
 * nên một tệp đã theo dõi dù khớp mẫu ignore vẫn tính là được snapshot phủ.
 * Nhận: git — runner lệnh; workspace — repository đã định vị; paths — các đường dẫn dạng slash, tương đối
 *       so với gốc repository; signal — huỷ.
 * Trả: các phần tử bị bỏ qua trong paths.
 * @throws khi `git check-ignore` thất bại với mã thoát khác 1.
 */
export async function ignoredPaths(
  git: GitRunner,
  workspace: GitWorkspace,
  paths: readonly string[],
  signal: AbortSignal,
): Promise<Set<string>> {
  if (paths.length === 0) return new Set();
  const result = await git.run(["check-ignore", "-z", "--stdin"], {
    cwd: workspace.root,
    env: workspace.env,
    stdin: `${paths.join("\0")}\0`,
    signal,
  });
  // Mã thoát 1 nghĩa là KHÔNG đường dẫn nào bị bỏ qua.
  if (result.exitCode === 1) return new Set();
  return new Set(ok(result, "git check-ignore").stdout.split("\0").filter((path) => path !== ""));
}
