/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Dò tệp chỉ dẫn workspace và đọc có biên, biết huỷ, qua provider tuỳ chọn — port 1:1 vùng files
 *      (stock lib/index.js 466–871 = region lib/types/files.js) của @deepseek-ai/dsh-agent-instructions.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { FileSystem, FsInfo, FsTarget, FsVersion } from "@deepseek-ai/dsh-fs";
import { agentsHomeDisplay, dshHomeDisplay } from "@deepseek-ai/dsh-home-paths";
import { assertNever } from "@deepseek-ai/dsh-util-values";
import { type ResolvedConfig, type ResolvedDiscoveryConfig, resolveConfig, resolveDiscoveryConfig } from "./config.ts";
import { trimmedInstructionDigest } from "./digest.ts";
import {
  AGENTS_GLOBAL_DIRECTORY,
  USER_GLOBAL_DIRECTORIES,
  USER_GLOBAL_DIRECTORY,
  USER_GLOBAL_FILE,
  decodeScopeKey,
  escapeProjectDisplayPath,
  instructionCandidateGroup,
  renderAgentInstructionSet,
  scopeForDisplayPath,
  type RenderedAgentInstructions,
} from "./render.ts";

/** Một ứng viên tệp chỉ dẫn, nhận diện bằng đường dẫn tuyệt đối và đường dẫn hiển thị cho model (stock files.d.ts:9–13). */
export interface InstructionFile {
  /** Đường dẫn tuyệt đối trên đĩa. */
  absolutePath: string;
  /** Đường dẫn hiển thị cho model (tương đối gốc dự án, hoặc dạng hiển thị của gốc người dùng). */
  displayPath: string;
}

/** Tệp chỉ dẫn đã đọc thành công nội dung UTF-8 (stock files.d.ts:14–19). */
export interface LoadedInstructionFile extends InstructionFile {
  /** Nội dung UTF-8 chính xác của tệp. */
  content: string;
  /** Dấu tươi của provider khi tệp được nạp qua `ctx.fs`. */
  version?: FsVersion;
}

/** Siêu dữ liệu provider của một ứng viên phạm vi TRƯỚC khi đọc nội dung (stock files.d.ts:20–25). */
export interface ProbedInstructionFile extends InstructionFile {
  /** Đích đã giải của provider. */
  target: FsTarget;
  /** Dấu tươi của provider tại thời điểm dò. */
  version: FsVersion;
  /** Số byte của tệp khi provider báo được. */
  size?: number;
}

/** Tham số dò dùng chung cho khám phá baseline và đối soát động (stock files.d.ts:26–43). */
interface DiscoverOptions {
  /** Thư mục làm việc tuyệt đối của phiên, nơi phép đi ngược lên bắt đầu. */
  cwd: string;
  /**
   * Gốc harness ĐÃ giải. Plugin giải một lần lúc mount rồi truyền xuống, nhờ vậy đối soát và nạp
   * baseline không thể lệch nhau.
   */
  dshHome?: string;
  /**
   * Gốc agent dùng chung ĐÃ giải. Plugin giải một lần lúc mount rồi truyền xuống, nhờ vậy đối soát và
   * nạp baseline không thể lệch nhau.
   */
  agentsHome?: string;
  /** Marker nhận ra gốc dự án. */
  projectRootMarkers?: string[];
  /** Ứng viên tệp chỉ dẫn dự án trong cùng thư mục. */
  instructionFileCandidates?: string[];
  /** Ứng viên tệp ghi đè cục bộ trong cùng thư mục. */
  localInstructionFileCandidates?: string[];
  /** Gốc dự án đã biết, bỏ qua phép đi ngược lên. */
  projectRoot?: string;
  /** Huỷ phép dò và đọc. */
  signal?: AbortSignal;
}

/** Tham số nạp baseline: dò + trần nguồn + ngân sách byte + huỷ (stock files.d.ts:44–48). */
interface LoadOptions extends DiscoverOptions {
  /** Trần byte UTF-8 của một lần kết xuất. */
  maxBytes: number;
  /** Trần byte UTF-8 đọc từ một tệp nguồn. */
  maxSourceBytes?: number;
  /** Baseline này thay thế một baseline đã hiển thị hay không. */
  replacePreviousBaseline?: boolean;
}

/** Bản kết xuất baseline kèm các tệp đã đọc thành công và được giữ sau ngân sách byte (stock files.d.ts:49–62). */
export interface RenderedInstructionSet {
  /** Văn bản baseline đã nằm trong ngân sách. */
  rendered: RenderedAgentInstructions;
  /** Ứng viên đọc thành công TRƯỚC khi gộp trùng nội dung và tính ngân sách byte. */
  observed: LoadedInstructionFile[];
  /**
   * Ứng viên bị bỏ vì trùng nội dung với một ứng viên sớm hơn trong CÙNG nhóm. Bản trùng của nội dung
   * được giữ ngân sách vẫn đủ tư cách để dò, vì xoá/đổi bản được giữ có thể làm chúng hiện ra.
   */
  deduped: LoadedInstructionFile[];
  /** Ứng viên được giữ sau khi gộp trùng nội dung và tính ngân sách byte. */
  included: LoadedInstructionFile[];
}

/** Phép dò ba trạng thái của một phạm vi: phân biệt VẮNG CHẮC CHẮN với provider lỗi (stock files.d.ts:63–71). */
export type ScopeInstructionProbe =
  | { kind: "present"; file: ProbedInstructionFile }
  | { kind: "absent" }
  | { kind: "unavailable" };

/** Tệp ứng viên kèm siêu dữ liệu provider tuỳ chọn trong lúc dò (nội bộ, stock files.js:625–676). */
interface DiscoveredInstructionFile extends InstructionFile {
  /** Đích đã giải, chỉ có khi dò qua provider. */
  target?: FsTarget;
  /** Dấu tươi của provider, chỉ có khi dò qua provider. */
  version?: FsVersion;
  /** Số byte tệp, khi nguồn dò báo được. */
  size?: number;
}

/** Kết quả dò một đường dẫn: có (kèm siêu dữ liệu), vắng, hoặc không dò được (nội bộ, stock files.js:507–541). */
type StatFileProbe =
  | { kind: "absent" }
  | { kind: "unavailable" }
  | { kind: "present"; info: { target?: FsTarget; version?: FsVersion; size?: number } };

/** Một gốc chỉ dẫn người-dùng-toàn-cục: tên phạm vi, gốc đã giải và dạng hiển thị (stock files.js:472–497). */
interface UserGlobalRoot {
  /** Thư mục phạm vi: `user-global` hoặc `agents-global`. */
  directory: (typeof USER_GLOBAL_DIRECTORIES)[number];
  /** Gốc tuyệt đối chứa tệp chỉ dẫn người dùng. */
  home: string;
  /** Dạng hiển thị của gốc (ví dụ `~/.dsh`). */
  display: string;
}

/**
 * Liệt kê các gốc chỉ dẫn người-dùng-toàn-cục theo thứ tự ưu tiên cho model: gốc harness trước, rồi
 * gốc agent dùng chung. Cả hai cùng đóng góp ứng viên cố định USER_GLOBAL_FILE và hợp thành MỘT nhóm
 * ứng viên, nên tệp trùng nội dung với gốc harness chỉ được kết xuất một lần.
 * Nhận: config — cấu hình dò đã chuẩn hoá.
 * Trả: các gốc theo đúng thứ tự ưu tiên của model (stock files.js:480–497).
 */
function userGlobalRoots(config: ResolvedDiscoveryConfig): UserGlobalRoot[] {
  return USER_GLOBAL_DIRECTORIES.map((directory): UserGlobalRoot => {
    switch (directory) {
      case USER_GLOBAL_DIRECTORY:
        return { directory, home: config.dshHome, display: dshHomeDisplay(config.dshHome) };
      case AGENTS_GLOBAL_DIRECTORY:
        return { directory, home: config.agentsHome, display: agentsHomeDisplay(config.agentsHome) };
      /* v8 ignore next -- USER_GLOBAL_DIRECTORIES là đóng; nhánh này chỉ khiến việc thêm nhãn thành lỗi biên dịch. */
      default:
        return assertNever(directory, "user-global directory");
    }
  });
}

/**
 * Đóng gói tuỳ chọn huỷ cho lời gọi provider.
 * Nhận: signal — tín hiệu huỷ (có thể vắng).
 * Trả: `undefined` khi không có tín hiệu, ngược lại object `{ signal }` (stock files.js:498–500).
 */
function signalOptions(signal: AbortSignal | undefined): { signal: AbortSignal } | undefined {
  return signal === undefined ? undefined : { signal };
}

/**
 * Có phải lỗi "đường dẫn không tồn tại" của host hay không.
 * Nhận: error — giá trị bất kỳ bắt được từ `fs`.
 * Trả: true khi mã lỗi là ENOENT hoặc ENOTDIR (stock files.js:501–503).
 */
function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

/**
 * Có phải lỗi "đường dẫn không tồn tại" của provider `ctx.fs` hay không.
 * Nhận: error — giá trị bất kỳ bắt được từ provider.
 * Trả: true khi mã lỗi là FS_NOT_FOUND (stock files.js:504–506).
 */
function isMissingProviderPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "FS_NOT_FOUND";
}

/**
 * Dò MỘT đường dẫn trên filesystem của host.
 * Nhận: path — đường dẫn tuyệt đối; signal — tín hiệu huỷ.
 * Trả: có (kèm cỡ tệp), vắng, hoặc không dò được (stock files.js:507–521).
 */
async function nodeStatFile(path: string, signal: AbortSignal | undefined): Promise<StatFileProbe> {
  try {
    signal?.throwIfAborted();
    const info = await stat(path);
    signal?.throwIfAborted();
    if (!info.isFile()) return { kind: "absent" };
    return { kind: "present", info: { size: info.size } };
  } catch (error) {
    signal?.throwIfAborted();
    return isMissingPathError(error) ? { kind: "absent" } : { kind: "unavailable" };
  }
}

/**
 * Dò MỘT đường dẫn qua provider `ctx.fs`.
 * Nhận: path — đường dẫn cần dò; fileSystem — provider; signal — tín hiệu huỷ.
 * Trả: có (kèm đích, dấu tươi, cỡ tệp), vắng, hoặc không dò được (stock files.js:522–541).
 */
async function fsStatFile(
  path: string,
  fileSystem: FileSystem,
  signal: AbortSignal | undefined,
): Promise<StatFileProbe> {
  try {
    const target = await fileSystem.resolve(path, signalOptions(signal));
    signal?.throwIfAborted();
    const info = await fileSystem.stat(target, signal);
    signal?.throwIfAborted();
    if (info?.type !== "file") return { kind: "absent" };
    return {
      kind: "present",
      info: { target, version: info.version, ...(info.size === undefined ? {} : { size: info.size }) },
    };
  } catch {
    signal?.throwIfAborted();
    return { kind: "unavailable" };
  }
}

/**
 * Dò một đường dẫn bằng provider khi có, ngược lại bằng host.
 * Nhận: path — đường dẫn cần dò; fileSystem — provider tuỳ chọn; signal — tín hiệu huỷ.
 * Trả: kết quả dò của nguồn tương ứng (stock files.js:542–544).
 */
async function statFile(
  path: string,
  fileSystem: FileSystem | undefined,
  signal: AbortSignal | undefined,
): Promise<StatFileProbe> {
  return fileSystem === undefined ? nodeStatFile(path, signal) : fsStatFile(path, fileSystem, signal);
}

/**
 * Kiểm tra một mục có tồn tại như marker gốc dự án hay không.
 * Nhận: path — đường dẫn ứng viên; fileSystem — provider tuỳ chọn; signal — tín hiệu huỷ.
 * Trả: true khi tồn tại; false khi vắng; ném lại lỗi khác hoặc lý do huỷ khi phép dò không dùng được
 * (stock files.js:545–564).
 */
async function existsAsMarker(
  path: string,
  fileSystem: FileSystem | undefined,
  signal: AbortSignal | undefined,
): Promise<boolean> {
  if (fileSystem !== undefined) {
    try {
      const target = await fileSystem.resolve(path, signalOptions(signal));
      return (await fileSystem.stat(target, signal)) !== undefined;
    } catch (error) {
      signal?.throwIfAborted();
      if (isMissingProviderPathError(error)) return false;
      throw error;
    }
  }
  try {
    signal?.throwIfAborted();
    await stat(path);
    signal?.throwIfAborted();
    return true;
  } catch (error) {
    signal?.throwIfAborted();
    if (isMissingPathError(error)) return false;
    throw error;
  }
}

/**
 * Đi ngược lên tới thư mục ĐẦU TIÊN chứa marker gốc dự án đã cấu hình.
 * Nhận: cwd — thư mục làm việc tuyệt đối nơi phép đi bắt đầu; markers — tên con nhận ra gốc dự án;
 *      fileSystem — provider tuỳ chọn thay cho phép dò host; signal — huỷ phép dò provider và host.
 * Trả: gốc dự án tìm được, hoặc `cwd` khi không marker nào tồn tại.
 * @throws lỗi siêu dữ liệu marker gốc hoặc lý do huỷ khi phép dò không dùng được (stock files.js:574–582).
 */
export async function findProjectRoot(
  cwd: string,
  markers: readonly string[],
  fileSystem?: FileSystem,
  signal?: AbortSignal,
): Promise<string> {
  let current = resolve(cwd);
  for (;;) {
    for (const marker of markers) if (await existsAsMarker(join(current, marker), fileSystem, signal)) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(cwd);
    current = parent;
  }
}

/**
 * Dựng chuỗi thư mục TỪ gốc XUỐNG cwd, bao gồm cả hai đầu.
 * Nhận: root — thư mục gốc, kỳ vọng chứa hoặc bằng `cwd`; cwd — thư mục cụ thể nhất của chuỗi.
 * Trả: các thư mục xếp từ rộng nhất tới cụ thể nhất (stock files.js:589–602).
 */
export function ancestorChain(root: string, cwd: string): string[] {
  const chain: string[] = [];
  let current = resolve(cwd);
  const resolvedRoot = resolve(root);
  while (current !== resolvedRoot) {
    chain.push(current);
    const parent = dirname(current);
    /* v8 ignore next -- phép dò luôn cấp cwd hoặc một gốc tổ tiên. */
    if (parent === current) break;
    current = parent;
  }
  chain.push(resolvedRoot);
  return chain.reverse();
}

/**
 * Tìm các thư mục con đã đi qua giữa cwd và một tệp bị chạm.
 * Nhận: root — thư mục làm việc hiện tại, biên của phép dò lồng nhau; touchedPath — đường dẫn tuyệt
 *      đối hoặc tương đối với `root`.
 * Trả: các thư mục con từ nông nhất tới thư mục cha của tệp bị chạm (stock files.js:609–615).
 */
export function descendantDirsBetween(root: string, touchedPath: string): string[] {
  const resolvedRoot = resolve(root);
  const targetDir = dirname(isAbsolute(touchedPath) ? resolve(touchedPath) : resolve(resolvedRoot, touchedPath));
  const rel = relative(resolvedRoot, targetDir);
  if (rel.length === 0 || rel.startsWith("..") || isAbsolute(rel)) return [];
  return ancestorChain(resolvedRoot, targetDir).slice(1);
}

/**
 * Đổi một đường dẫn chỉ dẫn tuyệt đối thành đường dẫn hiển thị theo dự án.
 * Nhận: root — gốc dự án làm nền hiển thị; path — đường dẫn tuyệt đối cần hiển thị.
 * Trả: đường dẫn tương đối gốc dự án, không thể đụng phạm vi người-dùng-toàn-cục (stock files.js:622–624).
 */
export function relativeDisplay(root: string, path: string): string {
  return escapeProjectDisplayPath(relative(root, path));
}

/**
 * Liệt kê mọi ứng viên tệp chỉ dẫn đang tồn tại trong MỘT thư mục.
 * Nhận: dir — thư mục cần dò; root — gốc dự án dùng cho đường hiển thị; instructionFileCandidates —
 *      danh sách tên ứng viên theo thứ tự; fileSystem — provider tuỳ chọn; signal — tín hiệu huỷ.
 * Trả: các ứng viên tồn tại kèm siêu dữ liệu provider (stock files.js:625–645).
 */
async function allExistingInstructionFiles(
  dir: string,
  root: string,
  instructionFileCandidates: readonly string[],
  fileSystem: FileSystem | undefined,
  signal: AbortSignal | undefined,
): Promise<DiscoveredInstructionFile[]> {
  const found: DiscoveredInstructionFile[] = [];
  for (const candidate of instructionFileCandidates) {
    const path = join(dir, candidate);
    const probe = await statFile(path, fileSystem, signal);
    switch (probe.kind) {
      case "present":
        found.push({ absolutePath: path, displayPath: relativeDisplay(root, path), ...probe.info });
        continue;
      case "absent":
      case "unavailable":
        continue;
      /* v8 ignore next 2 -- StatFileProbe là đóng; nhánh này chỉ khiến việc thêm một kind thành lỗi biên dịch. */
      default:
        assertNever(probe, "StatFileProbe");
    }
  }
  return found;
}

/**
 * Dò toàn bộ ứng viên chỉ dẫn: hai gốc người dùng, rồi chuỗi gốc-dự-án → cwd cho cả tệp gốc lẫn tệp
 * ghi đè cục bộ, khử trùng theo đường dẫn tuyệt đối.
 * Nhận: options — tham số dò; fileSystem — provider tuỳ chọn thay cho host.
 * Trả: ứng viên theo đúng thứ tự ưu tiên của model (stock files.js:646–676).
 */
async function discoverInstructionFiles(
  options: DiscoverOptions,
  fileSystem?: FileSystem,
): Promise<DiscoveredInstructionFile[]> {
  const config = resolveDiscoveryConfig(options);
  const files: DiscoveredInstructionFile[] = [];
  const seen = new Set<string>();
  const addFile = (file: DiscoveredInstructionFile): void => {
    if (seen.has(file.absolutePath)) return;
    seen.add(file.absolutePath);
    files.push(file);
  };
  for (const root of userGlobalRoots(config)) {
    const absolutePath = join(root.home, USER_GLOBAL_FILE);
    const probe = await statFile(absolutePath, fileSystem, options.signal);
    switch (probe.kind) {
      case "present":
        addFile({ absolutePath, displayPath: `${root.display}/${USER_GLOBAL_FILE}`, ...probe.info });
        continue;
      case "absent":
      case "unavailable":
        continue;
      /* v8 ignore next 2 -- StatFileProbe là đóng; nhánh này chỉ khiến việc thêm một kind thành lỗi biên dịch. */
      default:
        assertNever(probe, "StatFileProbe");
    }
  }
  const cwd = resolve(options.cwd);
  const projectRoot =
    options.projectRoot ?? (await findProjectRoot(cwd, config.projectRootMarkers, fileSystem, options.signal));
  for (const dir of ancestorChain(projectRoot, cwd))
    for (const candidates of [config.instructionFileCandidates, config.localInstructionFileCandidates])
      for (const file of await allExistingInstructionFiles(dir, projectRoot, candidates, fileSystem, options.signal))
        addFile(file);
  return files;
}

/**
 * Dò các ứng viên chỉ dẫn người-dùng-toàn-cục và từ gốc-dự-án → cwd mà host nhìn thấy.
 * Mọi ứng viên đang tồn tại trong mỗi thư mục đều được trả; bản trùng nội dung (sau trim) chỉ bị gộp
 * SAU khi đọc nội dung.
 * Nhận: options — cwd, gốc harness đã giải, marker gốc và cấu hình ứng viên.
 * Trả: các ứng viên đã khử trùng theo đường dẫn, theo đúng thứ tự ưu tiên của model.
 * @throws lỗi siêu dữ liệu marker gốc hoặc lý do huỷ khi phép dò không nhận ra được gốc dự án
 * (stock files.js:686–691).
 */
export async function discoverBaselineInstructionFiles(options: DiscoverOptions): Promise<InstructionFile[]> {
  return (await discoverInstructionFiles(options)).map(({ absolutePath, displayPath }) => ({
    absolutePath,
    displayPath,
  }));
}

/**
 * Mở một tệp host thành luồng đoạn văn bản UTF-8.
 * Nhận: path — đường dẫn tuyệt đối; signal — tín hiệu huỷ luồng.
 * Trả: generator bất đồng bộ phát từng đoạn văn bản (stock files.js:692–698).
 */
async function* nodeTextChunks(path: string, signal: AbortSignal | undefined): AsyncGenerator<string> {
  const stream = createReadStream(path, { encoding: "utf8", signal });
  for await (const chunk of stream) yield String(chunk);
}

/**
 * Đọc nội dung một ứng viên dưới trần byte nguồn, có thể huỷ.
 * Nhận: file — ứng viên kèm siêu dữ liệu; maxSourceBytes — trần byte UTF-8; fileSystem — provider tuỳ
 *      chọn; signal — tín hiệu huỷ.
 * Trả: nội dung đã ghép, hoặc `undefined` khi tệp quá lớn hoặc không đọc được (stock files.js:699–718).
 */
async function readBounded(
  file: DiscoveredInstructionFile,
  maxSourceBytes: number,
  fileSystem: FileSystem | undefined,
  signal: AbortSignal | undefined,
): Promise<string | undefined> {
  signal?.throwIfAborted();
  if (file.size !== undefined && file.size > maxSourceBytes) return undefined;
  try {
    const chunks =
      fileSystem === undefined || file.target === undefined
        ? nodeTextChunks(file.absolutePath, signal)
        : await fileSystem.streamText(file.target, signal);
    const parts: string[] = [];
    let bytes = 0;
    for await (const chunk of chunks) {
      signal?.throwIfAborted();
      bytes += Buffer.byteLength(chunk, "utf8");
      if (bytes > maxSourceBytes) return undefined;
      parts.push(chunk);
    }
    signal?.throwIfAborted();
    return parts.join("");
  } catch {
    signal?.throwIfAborted();
    return undefined;
  }
}

/**
 * Bỏ các ứng viên MUỘN hơn có nội dung (sau trim) trùng một ứng viên sớm hơn trong CÙNG nhóm ứng viên.
 * Hai nhóm khác nhau không bao giờ gộp dù nội dung y hệt; trong một nhóm, ứng viên sớm nhất theo thứ tự
 * dò được giữ và byte GỐC của nó được kết xuất. Hai gốc người-dùng-toàn-cục hợp thành một nhóm, nên tệp
 * dùng chung trùng nội dung với gốc harness sẽ gộp về sau gốc harness. Một ứng viên symlink tới tệp anh
 * em cũng giải ra cùng nội dung và gộp tại đây như mọi tệp thật trùng byte.
 * Nhận: files — các tệp đã nạp theo thứ tự dò.
 * Trả: các tệp được giữ, nguyên thứ tự (stock files.js:730–746).
 */
export function dedupInstructionFilesByCandidateGroup(files: LoadedInstructionFile[]): LoadedInstructionFile[] {
  const keptDigestsByGroup = new Map<string, Set<string>>();
  const kept: LoadedInstructionFile[] = [];
  for (const file of files) {
    const group = instructionCandidateGroup(scopeForDisplayPath(file.displayPath));
    let digests = keptDigestsByGroup.get(group);
    if (digests === undefined) {
      digests = new Set<string>();
      keptDigestsByGroup.set(group, digests);
    }
    const digest = trimmedInstructionDigest(file.content);
    if (digests.has(digest)) continue;
    digests.add(digest);
    kept.push(file);
  }
  return kept;
}

/**
 * Dò, đọc và kết xuất chuỗi chỉ dẫn baseline.
 * Nhận: options — cấu hình dò, trần cỡ nguồn, ngân sách byte và huỷ; fileSystem — provider tuỳ chọn
 *      thay cho phép đọc host.
 * Trả: ngữ cảnh baseline đã kết xuất, hoặc `undefined` khi không nạp được gì.
 * @throws lỗi siêu dữ liệu marker gốc hoặc lý do huỷ khi phép dò không nhận ra được gốc dự án
 * (stock files.js:755–757).
 */
export async function loadBaselineInstructions(
  options: LoadOptions,
  fileSystem?: FileSystem,
): Promise<RenderedAgentInstructions | undefined> {
  return (await loadBaselineInstructionSet(options, fileSystem))?.rendered;
}

/**
 * Nạp một baseline CÙNG với các tệp còn được giữ sau khi kết xuất.
 * Nhận: options — cấu hình dò, trần cỡ nguồn, ngân sách byte và huỷ; fileSystem — provider tuỳ chọn
 *      thay cho phép đọc host.
 * Trả: ngữ cảnh đã kết xuất kèm tệp được giữ, một bộ thay thế RỖNG tường minh, hoặc `undefined` khi
 * rỗng hay bị tắt (stock files.js:764–804).
 */
export async function loadBaselineInstructionSet(
  options: LoadOptions,
  fileSystem?: FileSystem,
): Promise<RenderedInstructionSet | undefined> {
  const config = resolveConfig(options);
  if (config.maxBytes <= 0 || !Number.isFinite(config.maxBytes)) return undefined;
  if (config.maxSourceBytes <= 0 || !Number.isFinite(config.maxSourceBytes)) return undefined;
  const discovered = await discoverInstructionFiles(options, fileSystem);
  const loaded: LoadedInstructionFile[] = [];
  for (const file of discovered) {
    const content = await readBounded(file, config.maxSourceBytes, fileSystem, options.signal);
    if (content !== undefined)
      loaded.push({
        absolutePath: file.absolutePath,
        displayPath: file.displayPath,
        content,
        ...(file.version === undefined ? {} : { version: file.version }),
      });
  }
  const kept = dedupInstructionFilesByCandidateGroup(loaded);
  if (kept.length === 0) {
    if (options.replacePreviousBaseline !== true) return undefined;
    const { rendered, included } = renderAgentInstructionSet([], {
      maxBytes: config.maxBytes,
      replacePreviousBaseline: true,
    });
    return { rendered, observed: [], deduped: [], included };
  }
  const keptPaths = new Set(kept.map((file) => file.absolutePath));
  const { rendered, included } = renderAgentInstructionSet(kept, {
    maxBytes: config.maxBytes,
    ...(options.replacePreviousBaseline === undefined
      ? {}
      : { replacePreviousBaseline: options.replacePreviousBaseline }),
  });
  return {
    rendered,
    observed: loaded,
    deduped: loaded.filter((file) => !keptPaths.has(file.absolutePath)),
    included,
  };
}

/**
 * Giải đường dẫn tệp và đường dẫn hiển thị cho MỘT ứng viên chỉ dẫn lô-gic.
 * Nhận: scope — khoá phạm vi ứng viên chứa thư mục và tên tệp; projectRoot — gốc dùng cho ứng viên
 *      tương đối dự án; resolved — gốc đã chuẩn hoá cho ứng viên người-dùng-toàn-cục.
 * Trả: đường dẫn tuyệt đối và đường dẫn hiển thị cho model của ứng viên.
 * @internal (stock files.js:813–821)
 */
export function scopeInstructionFile(
  scope: string,
  projectRoot: string,
  resolved: ResolvedConfig,
): InstructionFile {
  const { directory, candidateName } = decodeScopeKey(scope);
  const globalRoot = userGlobalRoots(resolved).find((root) => root.directory === directory);
  const absolutePath = join(
    globalRoot?.home ?? (directory === "." ? projectRoot : join(projectRoot, directory)),
    candidateName,
  );
  return {
    absolutePath,
    displayPath: globalRoot === undefined ? relativeDisplay(projectRoot, absolutePath) : `${globalRoot.display}/${candidateName}`,
  };
}

/**
 * Dò siêu dữ liệu provider HIỆN TẠI cho một phạm vi chỉ dẫn theo từng ứng viên.
 * Nhận: scope — khoá phạm vi ứng viên (xem candidateScopeKey); projectRoot — gốc dự án dùng để giải và
 *      hiển thị phạm vi dự án; resolved — cấu hình plugin đã chuẩn hoá; fileSystem — provider dùng để
 *      giải và stat ứng viên phạm vi; signal — huỷ phép dò provider.
 * Trả: siêu dữ liệu "có", "vắng chắc chắn", hoặc "tạm thời không dò được" (stock files.js:831–852).
 */
export async function probeScopeInstruction(
  scope: string,
  projectRoot: string,
  resolved: ResolvedConfig,
  fileSystem: FileSystem,
  signal?: AbortSignal,
): Promise<ScopeInstructionProbe> {
  const candidate = scopeInstructionFile(scope, projectRoot, resolved);
  let target: FsTarget;
  let info: FsInfo | undefined;
  try {
    target = await fileSystem.resolve(candidate.absolutePath, signalOptions(signal));
    info = await fileSystem.stat(target, signal);
  } catch {
    signal?.throwIfAborted();
    return { kind: "unavailable" };
  }
  if (info?.type !== "file") return { kind: "absent" };
  return {
    kind: "present",
    file: {
      ...candidate,
      target,
      version: info.version,
      ...(info.size === undefined ? {} : { size: info.size }),
    },
  };
}

/**
 * Đọc MỘT ứng viên phạm vi đã dò, dưới trần nguồn đã cấu hình.
 * Nhận: file — ứng viên thắng của provider cùng ảnh chụp siêu dữ liệu; maxSourceBytes — số byte UTF-8
 *      tối đa nhận từ nguồn; fileSystem — provider dùng cho phép đọc theo luồng; signal — huỷ phép đọc.
 * Trả: nội dung đã nạp kèm dấu tươi đã dò, hoặc `undefined` khi không đọc được (stock files.js:861–870).
 */
export async function readScopeInstruction(
  file: ProbedInstructionFile,
  maxSourceBytes: number,
  fileSystem: FileSystem,
  signal?: AbortSignal,
): Promise<LoadedInstructionFile | undefined> {
  const content = await readBounded(file, maxSourceBytes, fileSystem, signal);
  if (content === undefined) return undefined;
  return {
    absolutePath: file.absolutePath,
    displayPath: file.displayPath,
    content,
    version: file.version,
  };
}
