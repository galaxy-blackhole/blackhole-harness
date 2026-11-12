/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Port 1:1 'lib/types/operations.js' (652 dòng) của @deepseek-ai/dsh-plugin-manager: thao tác gói dùng
 *      chung cho lệnh 'dsh plugin' và manager đang chạy — anchor spec tương đối, đọc metadata bundle, lưu
 *      manifest nguyên tử, chạy pnpm trong hồ sơ (khóa ghi, preflight tương thích, chờ cây tiến trình,
 *      khôi phục package.json/pnpm-lock.yaml), đọc registry và tra 'pnpm view'.
 */

import { once, type NodeEventTarget } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import {
  DEFAULT_PROFILE_BUNDLES,
  PROFILE_TEMPLATES,
  bundlePatchPaths,
  composeEntries,
  evaluatePluginCompatibility,
  initProfile,
  loadOverlayPatches,
  pluginCompatibilityWarning,
  readProfileManifest,
  readProfileVersionExemptions,
  resolveBundleDir,
  resolveProfileDir,
} from "@deepseek-ai/dsh-app-boot";
import type { ProfileManifest } from "@deepseek-ai/dsh-app-boot";
import { scrubbedParentEnv } from "@deepseek-ai/dsh-subprocess";
import { execa } from "execa";

import { incompatiblePlugin } from "./failure.ts";
import { parseInstallSpec } from "./install-spec.ts";
import { awaitTreeGone, leadsOwnGroup, treeAlive } from "./run-tree.ts";
import type { IncompatiblePlugin, PackageResult, Registry } from "./types.ts";

export { setProfileVersionExemption, readProfileVersionExemptions } from "@deepseek-ai/dsh-app-boot";

/** Vị trí hồ sơ và lời gọi do launcher cấp. */
export interface PackageOperationContext {
  /** Tên hồ sơ. */
  profile: string;
  /** Thư mục tường minh cho hồ sơ do ứng dụng sở hữu; hồ sơ CLI có tên thì resolve dưới home. */
  dir?: string;
  /** Manifest cài đặt — mốc thứ hai khi resolve bundle. */
  installAnchor: string;
  /** Thư mục gọi lệnh, không bao giờ là thư mục hồ sơ. */
  cwd: string;
  /** Home của DSH, dùng khi lời gọi không chỉ định 'dir'. */
  home?: string;
}

/** Chính sách xuất ra và huỷ bỏ của MỘT thao tác pnpm. */
export interface PackageOperationOptions {
  /** Tên hoặc đường dẫn pnpm; resolve qua PATH như lệnh 'dsh plugin'. Mặc định 'pnpm'. */
  command?: string;
  /** Tham số đứng trước, cho executable do ứng dụng sở hữu. */
  args?: readonly string[];
  /** Môi trường runtime của ứng dụng, chỉ áp cho thao tác gói này. */
  env?: Readonly<Record<string, string>>;
  /** 'cli' thừa hưởng descriptor và xác thực của terminal; 'service' xoá bí mật và thu lại đầu ra. */
  execution: "cli" | "service";
  /** Tín hiệu huỷ của người gọi, nếu có. */
  signal?: AbortSignal;
  /** Trần byte của phần đầu ra được giữ lại. */
  outputBytes: number;
  /** Nhận từng mẩu đầu ra cùng luồng phát ra nó. */
  onOutput?: (text: string, stream: "stdout" | "stderr") => void;
  /** Có reconcile các bundle mới cài hay không; mặc định bật. */
  activateNewBundles?: boolean;
  /** Trần chờ khoá ghi hồ sơ, tính bằng mili giây. */
  lockWaitMs?: number;
  /**
   * Kết thúc lần chạy khi đầu ra đã thu im lặng quá ngần này mili giây. Lần chạy
   * bị dừng như vậy báo 'timedOut'; không có trần thì tiến trình con ngừng tiến
   * triển mà không thoát sẽ giữ người gọi mãi mãi. Lần chạy thừa hưởng descriptor
   * không thu gì nên không bao giờ bị trần này áp.
   */
  idleTimeoutMs?: number;
  /** Trần cho phép tra registry trước khi cài, tính bằng mili giây; không có thì dùng trần cố định. */
  lookupTimeoutMs?: number;
}

/** Một lần tra registry đã đáp gì. */
export interface PackageViewResult {
  /** Mã thoát của pnpm; null khi nó kết thúc mà không có mã hoặc chưa từng chạy. */
  exitCode: number | null;
  /** Toàn bộ stdout pnpm in ra. */
  stdout: string;
  /** Toàn bộ stderr pnpm in ra. */
  stderr: string;
  /** Lần tra vượt trần và bị giết. */
  timedOut: boolean;
  /** Lỗi khi không khởi động được pnpm, khi đó là điều đã xảy ra. */
  cause?: unknown;
}

/** Trần của MỘT lần tra registry. */
export interface PackageViewOptions {
  /** Tên hoặc đường dẫn pnpm. Mặc định 'pnpm'. */
  command?: string;
  /** Tham số đứng trước, cho executable do ứng dụng sở hữu. */
  args?: readonly string[];
  /** Môi trường runtime của ứng dụng, chỉ áp cho thao tác gói này. */
  env?: Readonly<Record<string, string>>;
  /** Kết thúc lần tra sớm; tín hiệu của người gọi, khi họ có. */
  signal?: AbortSignal;
  /** Trần của lần tra, tính bằng mili giây. */
  timeoutMs: number;
  /** Registry được hỏi; null hỏi registry mà cấu hình của chính pnpm chỉ ra. */
  registry?: Registry;
}

/** Cây tiến trình của MỘT lần chạy — phần dùng của RunTree bên run-tree.ts. */
interface RunTree {
  /** PID của lần chạy, khi spawn đã công bố. */
  pid: number | undefined;
  /** Lần chạy có dẫn nhóm tiến trình riêng của nó không. */
  grouped: boolean;
}

/** Phần MỘT dòng patch mà phép kiểm thành phần bundle đọc (kiểu cấu trúc, không ràng buộc module). */
interface PatchRow {
  /** Tên module của dòng. */
  readonly name?: unknown;
  /** Dòng này là nhóm chứa các dòng con hay không. */
  readonly group?: unknown;
  /** Cấu hình của dòng; mảng nghĩa là các dòng con. */
  readonly config?: unknown;
}

/**
 * Resolve spec gói tương đối theo thư mục của người gọi.
 * Nhận: 'argument' — một tham số pnpm; 'cwd' — thư mục gọi lệnh, không bao giờ là thư mục hồ sơ.
 * Trả: tham số đã neo đường dẫn tuyệt đối, hoặc nguyên văn khi không phải đường dẫn tương đối.
 */
export function anchorPathSpec(argument: string, cwd: string): string {
  const match = /^(?<prefix>(?:file|link):)?(?<path>\.{1,2}(?:[/\\].*)?)$/.exec(argument);
  const groups = match?.groups;
  const path = groups?.["path"];
  if (path === undefined) return argument;
  return String(groups?.["prefix"] ?? "") + resolve(cwd, path);
}

/**
 * Đọc metadata bundle mà không nạp JavaScript của nó.
 * Nhận: 'name' — tên phụ thuộc đã cài hoặc gói do bản cài sở hữu; 'dir' — thư mục hồ sơ;
 * 'anchor' — manifest cài đặt.
 * Trả: manifest đã resolve, hoặc undefined với gói không khai metadata bundle.
 * @throws Khi không resolve được thư mục gói hoặc manifest của nó không đọc được.
 */
export function bundleManifest(name: string, dir: string, anchor: string): ProfileManifest | undefined {
  const packageDir = resolveBundleDir("dsh", name, anchor, dir);
  const manifest = readProfileManifest("dsh", packageDir);
  return manifest.dsh?.bundle?.patch === undefined ? undefined : manifest;
}

/**
 * Lưu manifest hồ sơ một cách nguyên tử, giữ nguyên các trường không liên quan.
 * Nhận: 'dir' — thư mục hồ sơ; 'manifest' — tài liệu đã cập nhật.
 * Trả: Promise hoàn tất sau khi ghi xong package.json.
 * @throws Khi không ghi được tệp (quyền, đĩa đầy, đường dẫn không hợp lệ).
 */
export async function saveManifest(dir: string, manifest: ProfileManifest): Promise<void> {
  await writeFileAtomic(join(dir, "package.json"), JSON.stringify(manifest, undefined, 2) + "\n", { mode: 0o600 });
}

/**
 * Reconcile việc gỡ gói và bundle mới cài mà không bật lại phụ thuộc được giữ.
 * Nhận: 'before' — manifest trước lần chạy; 'dir' — thư mục hồ sơ; 'anchor' — manifest cài đặt;
 * 'options' — chính sách xuất ra.
 * Trả: Promise hoàn tất sau khi danh sách bundle của hồ sơ khớp lại (hoặc không cần ghi).
 * @throws Khi đọc/ghi manifest hồ sơ thất bại.
 */
async function reconcile(before: ProfileManifest, dir: string, anchor: string, options: PackageOperationOptions): Promise<void> {
  const after = readProfileManifest("dsh", dir);
  const dependencies = Object.keys(after.dependencies ?? {});
  const beforeDeps = new Set(Object.keys(before.dependencies ?? {}));
  const previous = after.dsh?.profile?.bundles ?? [];
  const bundles = previous.filter((name) => {
    if (!beforeDeps.has(name) && !dependencies.includes(name)) return true;
    return dependencies.includes(name) && bundleManifest(name, dir, anchor) !== undefined;
  });
  for (const name of dependencies) {
    if (beforeDeps.has(name)) continue;
    const metadata = bundleManifest(name, dir, anchor);
    const bundle = metadata?.dsh?.bundle;
    if (bundle === undefined) {
      options.onOutput?.("gbh: warning: " + name + " declares no dsh.bundle — installed as a plain dependency, not a profile layer\n", "stderr");
      continue;
    }
    for (const file of bundlePatchPaths(resolveBundleDir("dsh", name, anchor, dir), bundle)) loadOverlayPatches("dsh", file);
    if (!bundles.includes(name)) {
      bundles.push(name);
    }
  }
  if (JSON.stringify(previous) === JSON.stringify(bundles)) return;
  after.dsh = { ...after.dsh, profile: { ...after.dsh?.profile, bundles } };
  await saveManifest(dir, after);
}

/**
 * Các ống phải rút nốt bao lâu sau khi tiến trình của chúng đã thoát, như một phần cố định
 * của việc kết thúc lần chạy chứ không phải nút triển khai: một tiến trình con thừa hưởng
 * chúng sẽ giữ chúng mở, và phần đuôi mà phép phân loại thất bại đọc được ghi vào lúc đó.
 */
const DRAIN_AFTER_EXIT_MS = 2_000;

/**
 * Mọi bộ thu đã xong trong 'ms' hay chưa.
 * Nhận: 'collectors' — các trình đọc ống đang đua với trần; 'ms' — thời gian chờ dài nhất, mili giây.
 * Trả: true khi mọi bộ thu kết thúc kịp hạn.
 */
async function drainWithin(collectors: readonly Promise<void>[], ms: number): Promise<boolean> {
  if (collectors.length === 0) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.allSettled(collectors).then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => { resolve(false); }, ms);
      }),
    ]);
  }
  finally {
    clearTimeout(timer);
  }
}

/** Các lệnh cài nhận gói cần cài như tham số vị trí. */
const INSTALL_COMMANDS = new Set(["add", "install", "i"]);

/** Trần của một lần tra registry trước khi cài, khi người gọi không nêu trần nào. */
const LOOKUP_TIMEOUT_MS = 20_000;

/**
 * Các spec gói mà một lệnh cài nêu tường minh, theo thứ tự.
 * Nhận: 'args' — danh sách tham số pnpm của lần chạy.
 * Trả: mảng spec theo thứ tự xuất hiện; rỗng khi lệnh đầu tiên không phải lệnh cài.
 */
function namedSpecs(args: readonly string[]): string[] {
  const index = args.findIndex(argument => !argument.startsWith("-"));
  const command = index < 0 ? undefined : args[index];
  if (command === undefined || !INSTALL_COMMANDS.has(command)) return [];
  return args.slice(index + 1).filter(argument => !argument.startsWith("-"));
}

/**
 * Manifest mà một spec có tên sẽ cài, đọc mà không cài nó.
 * Spec đường dẫn đọc từ đĩa. Spec registry hỏi chính cấu hình của pnpm phiên bản mà range chọn
 * cùng các yêu cầu dsh của nó (engines và peerDependencies). Spec git hay tarball cần chính
 * lần tải về, nên phép kiểm sau khi cài là thứ phán xét nó.
 * Nhận: 'dir' — thư mục hồ sơ nơi lần tra chạy; 'spec' — spec cài đã neo; 'options' — executable
 * pnpm, tham số đứng trước, trần và tín hiệu của người gọi; 'environment' — môi trường của các
 * lời gọi pnpm; 'flags' — cờ của chính lần chạy, để lần tra hỏi đúng registry mà lần chạy sẽ dùng.
 * Trả: manifest của gói, hoặc undefined khi muốn đọc nó phải cài đặt chính nó.
 * @throws Khi pnpm không chạy được, JSON hỏng, hoặc tệp manifest đường dẫn không đọc được.
 */
async function namedSpecManifest(dir: string, spec: string, options: PackageOperationOptions, environment: NodeJS.ProcessEnv, flags: readonly string[]): Promise<object | undefined> {
  const parsed = parseInstallSpec(spec);
  if (parsed.kind === "path") {
    const filename = join(parsed.path, "package.json");
    return existsSync(filename) ? JSON.parse(readFileSync(filename, "utf8")) : undefined;
  }
  if (parsed.kind !== "registry") return undefined;
  const viewed = await execa(options.command ?? "pnpm", [
    ...options.args ?? [], "view", parsed.spec, "name", "version", "engines", "peerDependencies", "--json",
    ...flags, "--config.fetch-retries=0",
  ], {
    cwd: dir, env: environment, extendEnv: false, reject: false, stdin: "ignore",
    ...options.signal === undefined ? {} : { cancelSignal: options.signal },
    timeout: options.lookupTimeoutMs ?? LOOKUP_TIMEOUT_MS,
  });
  if (viewed.exitCode !== 0) return undefined;
  const value = JSON.parse(viewed.stdout) as object;
  return (Array.isArray(value) ? value.at(-1) : value);
}

/**
 * Các gói đã cài bị thiếu thì sửa được; việc chúng vắng mặt là một phần của phép so trước/sau.
 * Nhận: 'path' — đường dẫn tệp cần đọc.
 * Trả: nội dung UTF-8 của tệp, hoặc undefined khi tệp không tồn tại.
 * @throws Khi tệp tồn tại nhưng không đọc được vì lý do khác ENOENT.
 */
function optionalFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * Nơi một thao tác ghi lại lần chạy pnpm nó đã khởi động, cho kẻ kế nhiệm khi tiến trình
 * của chính thao tác kết thúc trước.
 * Nhận: 'dir' — thư mục hồ sơ.
 * Trả: đường dẫn tệp bản ghi lần chạy.
 */
function runRecordPath(dir: string): string {
  return join(dir, ".plugin-manager", "run.json");
}

/**
 * Ghi lại một lần chạy đã khởi động; kẻ kế nhiệm tiếp quản khoá hồ sơ từ tiến trình đã thoát sẽ chờ nó.
 * Nhận: 'dir' — thư mục hồ sơ; 'tree' — PID và việc lần chạy có dẫn nhóm riêng hay không.
 * Trả: Promise hoàn tất sau khi bản ghi được ghi nguyên tử (không ghi khi chưa có PID).
 * @throws Khi không ghi được tệp bản ghi.
 */
async function recordRun(dir: string, tree: RunTree): Promise<void> {
  if (tree.pid === undefined) return;
  await writeFileAtomic(runRecordPath(dir), JSON.stringify(tree) + "\n", { mode: 0o600, dirMode: 0o700 });
}

/**
 * Vì sao thao tác này không được chạy: bản ghi còn lại của một thao tác mà tiến trình đã kết thúc
 * giữa lần chạy nêu một lần chạy vẫn đang ghi vào hồ sơ. Khoá hồ sơ được tiếp quản ngay khi người
 * giữ nó thoát, nhưng cây pnpm của nó có thể sống lâu hơn. Một lần chạy đã ghi mà đã dừng, trong
 * một hạn chờ có trần, thì bản ghi của nó bị xoá.
 * Nhận: 'dir' — thư mục hồ sơ.
 * Trả: câu chẩn đoán, hoặc undefined khi không có lần chạy nào đang hoạt động.
 * @throws Khi không đọc hoặc không xoá được tệp bản ghi.
 */
async function activeRecordedRun(dir: string): Promise<string | undefined> {
  const path = runRecordPath(dir);
  const text = optionalFile(path);
  if (text === undefined) return undefined;
  let tree: RunTree | undefined;
  try {
    const value: unknown = JSON.parse(text);
    const record = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
    const pid = record["pid"];
    const grouped = record["grouped"];
    if (typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0 && typeof grouped === "boolean") tree = { pid: pid, grouped };
  }
  catch (error) {
    // Bản ghi được thay nguyên tử, nên bản không parse được là do thứ khác ghi và được báo ở dưới.
    void error;
  }
  if (tree === undefined) {
    return "gbh: " + path + " does not name a package run; delete it once no earlier package operation is still running in this profile\n";
  }
  await awaitTreeGone(tree);
  if (treeAlive(tree)) {
    return "gbh: process " + String(tree.pid) + ", started by an earlier package operation whose own process ended, is still running in this profile; "
      + "wait for it or stop it, then retry. If process " + String(tree.pid) + " is not that package run, delete " + path + ".\n";
  }
  await rm(path, { force: true });
  return undefined;
}

/**
 * pnpm có thể cài plugin qua bất kỳ trường phụ thuộc trực tiếp nào.
 * Nhận: 'manifest' — manifest hồ sơ (hoặc gói) cần gộp phụ thuộc.
 * Trả: bản đồ tên → spec của devDependencies, dependencies rồi optionalDependencies.
 */
function directDependencies(manifest: ProfileManifest): Record<string, string> {
  const extra = manifest as ProfileManifest & {
    /** Phụ thuộc chỉ dùng khi phát triển; pnpm vẫn cài được plugin qua trường này. */
    devDependencies?: Record<string, string>;
    /** Phụ thuộc tuỳ chọn; pnpm vẫn cài được plugin qua trường này. */
    optionalDependencies?: Record<string, string>;
  };
  return { ...extra.devDependencies, ...manifest.dependencies, ...extra.optionalDependencies };
}

/**
 * Chỉ kiểm các dòng plugin do bundle đã thay đổi đóng góp, không kiểm cả cây phụ thuộc của nó.
 * Nhận: 'manifest' — manifest của bundle; 'dir' — thư mục gói bundle; 'anchor' — manifest cài đặt.
 * Trả: manifest của từng gói mà các dòng chèn của bundle nêu tên (rỗng khi không có metadata bundle).
 * @throws Khi không đọc được patch của bundle hoặc manifest của một gói được nêu.
 */
function bundleComponentManifests(manifest: ProfileManifest, dir: string, anchor: string): ProfileManifest[] {
  const bundle = manifest.dsh?.bundle;
  if (bundle === undefined) return [];
  const patches = bundlePatchPaths(dir, bundle).flatMap(file => loadOverlayPatches("dsh", file));
  const names = new Set<string>();
  const visit = (rows: readonly PatchRow[]): void => {
    for (const row of rows) {
      if (row.group && Array.isArray(row.config)) visit(row.config);
      if (typeof row.name !== "string" || row.name.startsWith(".") || row.name.startsWith("/") || row.name.includes(":")) continue;
      const parts = row.name.split("/");
      names.add(parts.slice(0, row.name.startsWith("@") ? 2 : 1).join("/"));
    }
  };
  visit(composeEntries([patches.filter(patch => patch.insert !== undefined)]));
  return [...names].flatMap((name) => {
    let packageDir: string;
    try {
      packageDir = resolveBundleDir("dsh", name, anchor, dir);
    }
    catch (error) {
      // Lỗi resolve của dòng chưa cài hoặc dòng động vẫn thuộc phép kiểm của bộ nạp lúc khởi động.
      void error;
      return [];
    }
    return [readProfileManifest("dsh", packageDir)];
  });
}

/**
 * Chạy pnpm bên trong một hồ sơ mà người gọi đã giữ khoá ghi hồ sơ.
 * Phụ thuộc trực tiếp mới cài hoặc mới cập nhật vẫn được kiểm kể cả khi tắt kích hoạt;
 * một phụ thuộc không bị đụng tới không bao giờ chặn thao tác khác và vẫn bị từ chối lúc khởi động.
 * Việc từ chối vì tương thích khôi phục manifest và lockfile của hồ sơ, nhưng để nguyên module đã tải về trên đĩa.
 * Nhận: 'context' — vị trí hồ sơ và resolve do launcher sở hữu; 'args' — tham số pnpm, trước khi neo
 * đường dẫn tương đối; 'options' — chính sách xuất ra, kích hoạt và huỷ bỏ.
 * Trả: mã thoát, việc trần im lặng có dừng lần chạy hay không, và đường dẫn tệp chẩn đoán.
 * Việc từ chối vì tương thích trả mã thoát 1. Đầu ra của service có trần; đầu ra CLI dùng descriptor thừa hưởng.
 * Tệp chẩn đoán được đóng khi trả về hoặc khi bị từ chối, kể cả lỗi chuẩn bị và lỗi spawn.
 * @throws Khi không tạo được thư mục/tệp log, không spawn được pnpm, hoặc ghi log thất bại.
 */
export async function runProfilePnpm(context: PackageOperationContext, args: readonly string[], options: PackageOperationOptions): Promise<PackageResult> {
  const dir = context.dir ?? resolveProfileDir(context.profile, context.home);
  // Trước khi đọc bất kỳ tệp hồ sơ nào: một lần chạy đã ghi mà còn hoạt động có thể đang ghi lại chúng.
  const active = await activeRecordedRun(dir);
  const logRoot = join(dir, ".plugin-manager", "logs");
  await mkdir(logRoot, { recursive: true, mode: 0o700 });
  const logDir = await mkdtemp(join(logRoot, "operation-"));
  const logPath = join(logDir, "pnpm.log");
  await using log = await open(logPath, "wx", 0o600);
  if (active !== undefined) {
    await log.write(active);
    await log.close();
    options.onOutput?.(active, "stderr");
    const bytes = Buffer.from(active);
    return { exitCode: 1, output: bytes.subarray(Math.max(0, bytes.length - options.outputBytes)).toString("utf8"), truncated: bytes.length > options.outputBytes, logPath };
  }
  const before = readProfileManifest("dsh", dir);
  const savedFiles = ["package.json", "pnpm-lock.yaml"].map(name => ({ path: join(dir, name), text: optionalFile(join(dir, name)) }));
  const beforeDependencies = directDependencies(before);
  const installedBefore = new Map(Object.keys(beforeDependencies).map(name => [name, optionalFile(join(dir, "node_modules", name, "package.json"))] as const));
  let output = Buffer.alloc(0);
  let truncated = false;
  const append = (bytes: Buffer): void => {
    output = Buffer.concat([output, bytes]);
    if (output.length > options.outputBytes) {
      truncated = true;
      output = output.subarray(output.length - options.outputBytes);
    }
  };
  const environment: NodeJS.ProcessEnv = { ...(options.execution === "cli" ? process.env : scrubbedParentEnv()), ...options.env };
  const restore = async (): Promise<void> => {
    for (const file of savedFiles) {
      if (file.text === undefined) await rm(file.path, { force: true });
      else await writeFileAtomic(file.path, file.text, { mode: 0o600 });
    }
  };
  /** Các gói mà phép kiểm tương thích đã từ chối; người gọi tự dựng chúng cho bề mặt của mình. */
  const incompatible: IncompatiblePlugin[] = [];
  const rejected = async (warnings: string[], restoration: string): Promise<PackageResult> => {
    const diagnostic = "\ngbh: installation rejected: " + warnings.join("\n") + "\ngbh: " + restoration + ".\n";
    await log.write(diagnostic);
    options.onOutput?.(diagnostic, "stderr");
    append(Buffer.from(diagnostic));
    await log.close();
    return { exitCode: 1, output: output.toString("utf8"), truncated, logPath, incompatible };
  };
  // Một lệnh cài nêu tên các gói nó thêm, nên manifest của chúng được đọc và kiểm trước khi
  // pnpm chạy: một phiên bản không tương thích không bao giờ được cài, và bản đang dùng vẫn chạy.
  const preflight: string[] = [];
  const exemptions = readProfileVersionExemptions(dir);
  // Cờ registry của chính lần chạy, để lần tra hỏi đúng registry mà lần cài sẽ dùng.
  const registryFlags = args.filter(argument => argument.startsWith("--registry="));
  for (const raw of namedSpecs(args)) {
    // Spec mà manifest của nó không đọc hoặc không kiểm được thì để chính lần chạy và phép kiểm
    // sau khi cài phán xét, nơi báo lại những gì nó không kiểm được.
    try {
      const manifest = await namedSpecManifest(dir, anchorPathSpec(raw, context.cwd), options, environment, registryFlags);
      if (manifest === undefined) continue;
      const issue = evaluatePluginCompatibility(manifest, exemptions);
      if (issue !== undefined && !issue.exempted) {
        preflight.push(pluginCompatibilityWarning(issue));
        incompatible.push(incompatiblePlugin(issue));
      }
    }
    catch (error) {
      void error;
      continue;
    }
  }
  if (preflight.length > 0) return await rejected(preflight, "nothing was installed");
  const cancellation = new AbortController();
  // Lần chạy của service thu đầu ra, nên execa kết thúc cả cây mà nó dẫn khi lần chạy bị giết:
  // một script vòng đời sống lâu hơn tiến trình pnpm đã khởi động nó.
  // CLI giữ nhóm tiến trình của người gọi, nên một tín hiệu ngắt vẫn tới được nó.
  const grouped = leadsOwnGroup(options.execution);
  const child = execa(options.command ?? "pnpm", [...options.args ?? [], ...args.map(arg => anchorPathSpec(arg, context.cwd))], {
    cwd: dir, env: environment, extendEnv: false, reject: false,
    stdout: options.execution === "cli" ? "inherit" : "pipe",
    stderr: options.execution === "cli" ? "inherit" : "pipe",
    killDescendants: options.execution === "service",
    buffer: false, stdin: options.execution === "cli" ? "inherit" : "ignore", cancelSignal: options.signal === undefined
      ? cancellation.signal : AbortSignal.any([cancellation.signal, options.signal]),
  });
  // Nghe trước khi bản ghi được ghi, để một lần thoát trong lúc ghi không bị bỏ sót.
  // 01/11/2026: execa mà gói này phân giải là v9.6.1 — v9 KHÔNG có `nodeChildProcess` (API đó thuộc execa v10);
  // ở v9 đối tượng trả về CHÍNH LÀ tiến trình con (promise được trộn vào nó) nên nghe "exit" trên chính nó.
  const exited = once(child as unknown as NodeEventTarget, "exit").catch(() => undefined);
  let writes: Promise<void> = Promise.resolve();
  /** 'settled' ghi nhận kết cục của tiến trình đã biết; 'stalled' ghi nhận trần im lặng đã dừng lần chạy. */
  const control = { settled: false, stalled: false };
  /** Bật khi chính lời gọi này cắt ngắn việc đọc, để lần đóng nó gây ra không bị đọc thành lỗi lần chạy. */
  let cut = false;
  /** Lỗi đầu tiên mà việc đọc gặp trước lần cắt đó, và lần chạy vẫn báo nó. */
  let failure: Error | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  /** Trần im lặng: lần chạy đã thu mà ngừng in và không thoát thì bị kết thúc, không bao giờ bị chờ. */
  const armIdle = (): void => {
    if (control.settled || options.idleTimeoutMs === undefined) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      control.stalled = true;
      // Kill của execa tới cả cây của lần chạy service, và tự leo thang.
      child.kill();
    }, options.idleTimeoutMs);
  };
  const collect = async (stream: AsyncIterable<Buffer | string>, kind: "stdout" | "stderr"): Promise<void> => {
    try {
      for await (const chunk of stream) {
        armIdle();
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        writes = writes.then(async () => { await log.write(bytes); });
        await writes;
        options.onOutput?.(bytes.toString("utf8"), kind);
        append(bytes);
      }
    }
    catch (error) {
      // Việc đọc mà lời gọi này cắt ngắn không phải lỗi lần chạy gặp, và lần chạy đã
      // thoát rồi, nên chẳng còn gì để tín hiệu huỷ dừng lại.
      if (!cut) {
        failure ??= error instanceof Error ? error : new Error(String(error));
        cancellation.abort();
      }
      throw error;
    }
  };
  const collectors: Promise<void>[] = [
    ...child.stdout === null ? [] : [collect(child.stdout, "stdout")],
    ...child.stderr === null ? [] : [collect(child.stderr, "stderr")],
  ];
  // Việc rút quyết định lỗi có nổi lên hay không, nên mỗi việc đọc được nhận chủ ngay bây giờ:
  // một từ chối không ai nhận sẽ bị báo là unhandled trong lúc các ống đang rút.
  for (const collector of collectors) void collector.catch(() => { });
  // Descriptor thừa hưởng trao terminal cho pnpm, nên không có đầu ra đã thu để trần im lặng
  // quan sát: nó sẽ kích hoạt trên một lần chạy lành.
  if (collectors.length > 0) armIdle();
  let exitCode: number;
  try {
    await recordRun(dir, { pid: child.pid, grouped });
    // Execa chỉ resolve promise của nó khi stdio đã pipe kết thúc, nên chính việc thoát của
    // tiến trình — dấu hoàn tất của lần chạy — được đọc từ tiến trình con thô. Lỗi spawn
    // kết thúc mà không có nó.
    const settled = Promise.allSettled([child]);
    await Promise.race([exited, settled]);
    control.settled = true;
    clearTimeout(idleTimer);
    // Lần chạy bị treo dừng cả cây trước, nên việc rollback và nhả khoá của người gọi chỉ
    // xảy ra sau khi các script nó khởi động đã ngừng ghi.
    if (control.stalled) await awaitTreeGone({ pid: child.pid, grouped });
    // Một tiến trình con thừa hưởng ống có thể giữ chúng mở quá tiến trình;
    // phần đuôi rút dưới một trần thay vì bị chờ mãi.
    const drained = await drainWithin(collectors, DRAIN_AFTER_EXIT_MS);
    if (drained) {
      for (const stream of await Promise.allSettled(collectors))
        if (stream.status === "rejected") throw stream.reason;
    }
    else {
      // Cắt ngắn phần đuôi là cách chính lời gọi này kết thúc, không phải lỗi lần chạy gặp;
      // một lỗi từ trước lần cắt vẫn nổi lên, và lần cắt để lại một thông báo trong log vì
      // phép phân loại có thể đọc phần đuôi chưa trọn.
      cut = true;
      child.stdout?.destroy();
      child.stderr?.destroy();
      const notice = "gbh: pnpm output was cut short after its process exited\n";
      await log.write(notice);
      // Một lỗi từ trước lần cắt là của chính lần chạy và thay thế thông báo mà người gọi
      // nếu không sẽ đọc; một từ chối do chính lần cắt gây ra là cách nó kết thúc.
      if (failure !== undefined) throw failure;
      options.onOutput?.(notice, "stderr");
      append(Buffer.from(notice));
    }
    const [completion] = await settled;
    if (completion.status === "rejected") throw completion.reason;
    const result = completion.value;
    exitCode = result.exitCode ?? (result.code === "ENOENT" ? 127 : 1);
    if (control.stalled) {
      const notice = "gbh: pnpm printed nothing for " + String(options.idleTimeoutMs) + "ms and was terminated\n";
      await log.write(notice);
      options.onOutput?.(notice, "stderr");
      append(Buffer.from(notice));
    }
    if (result.failed && output.length === 0) {
      const diagnostic = result.shortMessage ?? "pnpm failed";
      await log.write(diagnostic);
      truncated = Buffer.byteLength(diagnostic) > options.outputBytes;
      output = Buffer.from(diagnostic).subarray(0, options.outputBytes);
    }
    // Mã thoát của lần chạy bị kết thúc không nói gì về những gì nó đã ghi, nên nó không bao giờ reconcile lựa chọn.
    if (exitCode === 0 && !control.stalled) {
      const after = readProfileManifest("dsh", dir);
      const warnings: string[] = [];
      for (const [name, spec] of Object.entries(directDependencies(after))) {
        const packageDir = join(dir, "node_modules", name);
        const installed = optionalFile(join(packageDir, "package.json"));
        if (installed === undefined) continue;
        // Một phụ thuộc mà lần chạy này không đụng tới không bao giờ chặn thao tác khác; khởi động hồ sơ từ chối nó.
        const untouched = beforeDependencies[name] === spec && installedBefore.get(name) === installed;
        const found: string[] = [];
        const issues: IncompatiblePlugin[] = [];
        try {
          const manifest = readProfileManifest("dsh", packageDir);
          for (const candidate of [manifest, ...bundleComponentManifests(manifest, packageDir, context.installAnchor)]) {
            const issue = evaluatePluginCompatibility(candidate, readProfileVersionExemptions(dir));
            if (issue !== undefined && !issue.exempted) {
              found.push(pluginCompatibilityWarning(issue));
              issues.push(incompatiblePlugin(issue));
            }
          }
        }
        catch (error) {
          found.push("Cannot validate installed package " + name + ": " + String(error));
        }
        if (found.length === 0) continue;
        if (!untouched) {
          warnings.push(...found);
          incompatible.push(...issues);
        }
        else {
          const notice = "\ngbh: warning: " + found.join("\n") + "\ngbh: it stays installed but profile startup denies it until you grant an exemption for those exact versions.\n";
          await log.write(notice);
          options.onOutput?.(notice, "stderr");
        }
      }
      if (warnings.length > 0) {
        // Yêu cầu của một thành phần bundle cần nội dung đã cài, nên lần từ chối này rơi sau khi pnpm
        // đã thay cây: khôi phục tệp, rồi cài lại lockfile đã khôi phục để phiên bản đã chạy trước
        // lần này vẫn nạp được. Hồ sơ chưa từng có lockfile được cài lại từ manifest đã khôi phục
        // mà không tạo lockfile, điều đó gỡ bỏ những gì lần chạy này thêm vào.
        await restore();
        const hadLockfile = savedFiles.some(file => file.path.endsWith("pnpm-lock.yaml") && file.text !== undefined);
        const repair = ["install", hadLockfile ? "--frozen-lockfile" : "--config.lockfile=false"];
        const repairing = execa(options.command ?? "pnpm", [...options.args ?? [], ...repair], {
          cwd: dir, env: environment, extendEnv: false, reject: false, stdin: "ignore",
          ...options.idleTimeoutMs === undefined ? {} : { timeout: options.idleTimeoutMs },
        });
        await recordRun(dir, { pid: repairing.pid, grouped: false });
        const repaired = await repairing;
        exitCode = 1;
        const restoration = repaired.exitCode === 0
          ? "restored package.json, pnpm-lock.yaml, and node_modules"
          : "restored package.json and pnpm-lock.yaml, but node_modules could not be reinstalled; run 'dsh plugin install'";
        const diagnostic = "\ngbh: installation rejected: " + warnings.join("\n") + "\ngbh: " + restoration + ".\n";
        await log.write(diagnostic);
        options.onOutput?.(diagnostic, "stderr");
        append(Buffer.from(diagnostic));
      }
      else if (options.activateNewBundles !== false) {
        await reconcile(before, dir, context.installAnchor, options);
      }
    }
  }
  finally {
    control.settled = true;
    clearTimeout(idleTimer);
    // Tiến trình này đã thấy lần chạy kết thúc, nên không kẻ kế nhiệm nào phải chờ nó.
    await rm(runRecordPath(dir), { force: true });
    await log.close();
  }
  return {
    exitCode, output: output.toString("utf8"), truncated, logPath,
    ...control.stalled ? { timedOut: true } : {}, ...incompatible.length > 0 ? { incompatible } : {},
  };
}

/**
 * Khởi tạo rồi chạy lệnh 'dsh plugin' với đúng khoá ghi như service.
 * Nhận: 'context' — vị trí do launcher sở hữu; 'args' — tham số pnpm; 'options' — chính sách xuất ra và huỷ bỏ.
 * Trả: kết quả package-manager đã hoàn tất.
 * @throws Khi không tạo được thư mục hồ sơ, không lấy được khoá ghi, khởi tạo hồ sơ thất bại,
 * hoặc lần chạy pnpm bên trong ném lỗi.
 */
export async function runPluginCommand(context: PackageOperationContext, args: readonly string[], options: PackageOperationOptions): Promise<PackageResult> {
  const dir = context.dir ?? resolveProfileDir(context.profile, context.home);
  await mkdir(dir, { recursive: true });
  return withFileLock(join(dir, "package.json"), async () => {
    if (!existsSync(join(dir, "package.json"))) {
      const template = PROFILE_TEMPLATES[context.profile];
      initProfile(dir, template?.bundles ?? DEFAULT_PROFILE_BUNDLES);
      options.onOutput?.("gbh: initialized profile " + context.profile + " at " + dir + "\n", "stderr");
    }
    return runProfilePnpm(context, args, options);
  }, options.lockWaitMs === undefined ? undefined : { waitMs: options.lockWaitMs });
}

/**
 * Đọc registry mà chính cấu hình của pnpm chỉ ra trong hồ sơ: chuỗi .npmrc của nó và thiết lập
 * workspace, đúng như 'pnpm config get registry' resolve.
 * Nhận: 'dir' — thư mục hồ sơ; 'options' — executable pnpm và trần thời gian.
 * Trả: URL registry đúng như pnpm in ra, hoặc null khi pnpm không đáp bằng một URL.
 * @throws Khi không spawn được pnpm (lỗi khởi động tiến trình).
 */
export async function readProfileRegistry(dir: string, options: {
  /** Tên hoặc đường dẫn pnpm. Mặc định 'pnpm'. */
  command?: string;
  /** Tham số đứng trước, cho executable do ứng dụng sở hữu. */
  args?: readonly string[];
  /** Môi trường runtime của ứng dụng, chỉ áp cho lần đọc này. */
  env?: Readonly<Record<string, string>>;
  /** Trần của lần đọc, tính bằng mili giây. */
  timeoutMs: number;
}): Promise<string | null> {
  const result = await execa(options.command ?? "pnpm", [...options.args ?? [], "config", "get", "registry"], {
    cwd: dir, env: { ...scrubbedParentEnv(), ...options.env }, extendEnv: false, reject: false, stdin: "ignore", timeout: options.timeoutMs,
  });
  // Registry là dòng cuối: pnpm có thể in một thông báo trước nó.
  const answer = result.exitCode === 0 ? result.stdout.trim().replace(/^[\s\S]*\n/, "").trim() : "";
  return /^https?:\/\/\S+$/.test(answer) ? answer : null;
}

/**
 * Tham số đưa MỘT lệnh pnpm tới một registry.
 * Nhận: 'registry' — registry, hoặc null cho registry mà chính cấu hình của pnpm chỉ ra.
 * Trả: mảng chứa --registry=<url> với một URL; mảng rỗng với null.
 */
export function registryArguments(registry: Registry): string[] {
  return registry === null ? [] : ["--registry=" + registry];
}

/**
 * Hỏi registry xem một spec nêu gì qua 'pnpm view', chạy trong thư mục hồ sơ để thiết lập
 * registry, proxy và xác thực của một lần cài áp dụng. Lần tra chỉ gửi một yêu cầu, không có
 * retry của chính pnpm: registry không đáp sẽ được báo trong 'timeoutMs', và các registry cấu
 * hình sau nó chính là lần thử lại.
 * Nhận: 'dir' — thư mục hồ sơ; 'spec' — một spec registry: tên gói kèm range tuỳ chọn;
 * 'options' — registry, tín hiệu huỷ và trần thời gian.
 * Trả: mã thoát, đầu ra và cách lần tra kết thúc của pnpm.
 * @throws Khi không spawn được pnpm; lỗi khởi động được trả trong 'cause' khi pnpm không có mã thoát.
 */
export async function viewProfilePackage(dir: string, spec: string, options: PackageViewOptions): Promise<PackageViewResult> {
  const result = await execa(options.command ?? "pnpm", [
    ...options.args ?? [], "view", spec, "name", "version", "description", "dsh", "--json",
    ...registryArguments(options.registry ?? null), "--config.fetch-retries=0",
  ], {
    cwd: dir, env: { ...scrubbedParentEnv(), ...options.env }, extendEnv: false, reject: false, stdin: "ignore",
    timeout: options.timeoutMs, ...options.signal === undefined ? {} : { cancelSignal: options.signal },
  });
  const cause = result.exitCode === undefined && !result.timedOut && !result.isCanceled
    ? Object.assign(new Error(result.shortMessage), { code: result.code })
    : undefined;
  return {
    exitCode: result.exitCode ?? null, stdout: result.stdout, stderr: result.stderr, timedOut: result.timedOut,
    ...cause === undefined ? {} : { cause },
  };
}
