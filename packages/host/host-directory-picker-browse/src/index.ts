/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Backend `browse` của seam directory-picker: liệt kê MỘT cấp thư mục + tạo thư mục con trên filesystem host,
 *      đăng ký `ctx.directoryPicker` với capability `browse`. Port 1:1 lib/index.js của
 *      @galaxy-blackhole/gbh-host-directory-picker-browse (234 dòng); seam khai bằng interface HẸP cục bộ (luật repo:
 *      không import tĩnh @deepseek-ai/*), xem README mục 'Quan hệ với seam host-directory-picker'.
 */
import { mkdir, opendir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, posix, resolve, win32 } from "node:path";

/** Một dòng breadcrumb (mỗi dòng là một điểm nhảy). */
export interface Crumb { name: string; path: string; hidden: boolean; }
/** Một dòng thư mục con trong listing. */
export interface DirectoryRow { name: string; path: string; hidden: boolean; }
/** Kết quả một lần liệt kê cấp. */
export interface DirectoryListing { path: string; home: string; crumbs: Crumb[]; entries: DirectoryRow[]; truncated: boolean; }
/** Ứng viên nội bộ của cửa sổ chặn (trước khi stat symlink). */
interface Candidate { name: string; isDirectory: boolean; isSymbolicLink: boolean; }
/** Mã lỗi của seam (giữ nguyên chuỗi của bản gốc). */
export type DirectoryPickerErrorCode = "directory-unreadable" | "directory-create-failed" | "directory-exists";

/** Lỗi của seam directory-picker — giữ NGUYÊN tên + mã + đường dẫn như bản gốc. */
export class DirectoryPickerError extends Error {
  /** Mã lỗi (chuỗi gốc). */
  readonly code: DirectoryPickerErrorCode;
  /** Đường dẫn liên quan. */
  readonly path: string;
  /**
   * Dựng lỗi.
   * Nhận: mã lỗi · đường dẫn · câu thông báo.
   * Trả: instance Error mang thêm code/path.
   */
  constructor(code: DirectoryPickerErrorCode, path: string, message: string) {
    super(message);
    this.name = "DirectoryPickerError";
    this.code = code;
    this.path = path;
  }
}

/** Hình dạng HẸP của lớp cơ sở seam (không import tĩnh DSH). */
abstract class DirectoryPickerBase {
  /**
   * Giữ context của plugin để lớp con dùng khi cần.
   * Nhận: ctx của cordis.
   * Trả: không.
   */
  constructor(protected readonly ctx: unknown) {}
  /**
   * Capability ổn định của service.
   * Nhận: không.
   * Trả: object capability.
   */
  abstract capability(): unknown;
}

/**
 * Chuỗi tổ tiên từ gốc filesystem tới `target` (bao gồm target) — các dòng breadcrumb.
 * Nhận: đường dẫn target.
 * Trả: mảng Crumb xếp từ gốc xuống.
 */
function ancestryCrumbs(target: string): Crumb[] {
  const crumbs: Crumb[] = [];
  let current = target;
  for (;;) {
    const parent = dirname(current);
    crumbs.unshift({ name: parent === current ? current : basename(current), path: current, hidden: false });
    if (parent === current) return crumbs;
    current = parent;
  }
}

/**
 * Đường dẫn có phải một vị trí CỐ ĐỊNH bất kể trạng thái tiến trình: tuyệt đối POSIX trên POSIX; trên Windows
 * chỉ dạng có ổ đĩa (`C:\\…`) hoặc UNC đầy đủ (`\\\\server\\share…`).
 * Nhận: đường dẫn · nền tảng (mặc định process.platform).
 * Trả: true nếu đường dẫn tuyệt đối đầy đủ trên nền tảng đó.
 */
export function fullyQualified(path: string, platform: string = process.platform): boolean {
  return platform === "win32"
    ? win32.isAbsolute(path) && /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/]+[^\\/]+)/.test(path)
    : posix.isAbsolute(path);
}

/**
 * Chèn một ứng viên vào cửa sổ sắp theo tên (giới hạn `keep`), đẩy ra tên LỚN NHẤT khi vượt cửa sổ.
 * Nhận: cửa sổ (sửa tại chỗ) · ứng viên · giới hạn.
 * Trả: true nếu ĐÃ có eviction (cấp này còn ứng viên ngoài cửa sổ).
 */
export function boundedInsert(window: Candidate[], candidate: Candidate, keep: number): boolean {
  const last = window[window.length - 1];
  if (window.length === keep && last !== undefined && candidate.name.localeCompare(last.name) >= 0) return true;
  let lo = 0;
  let hi = window.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const middle = window[mid];
    if (middle !== undefined && candidate.name.localeCompare(middle.name) < 0) hi = mid;
    else lo = mid + 1;
  }
  window.splice(lo, 0, candidate);
  if (window.length <= keep) return false;
  window.pop();
  return true;
}

/**
 * Thứ bị ném về dạng Error (lý do abort/wire có thể là bất kỳ giá trị).
 * Nhận: giá trị bị ném.
 * Trả: Error tương ứng.
 */
function asError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

/**
 * Nuốt lỗi close của handle mà bên gọi đã bỏ (không có consumer).
 * Nhận: không.
 * Trả: không.
 */
function swallowCloseFailure(): void {}

/**
 * Câu thông báo của một giá trị bị ném chưa biết.
 * Nhận: giá trị bị ném.
 * Trả: chuỗi thông báo.
 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Await `operation` nhưng reject ngay khi signal abort; operation vẫn chạy tiếp trên handle mà bên gọi đã đóng,
 * phần kết muộn bị nuốt để không thành unhandled rejection.
 * Nhận: promise đang chạy · signal (vắng = chỉ await thường).
 * Trả: giá trị của operation.
 */
export function raceAbort<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return operation;
  return new Promise<T>((resolveValue, reject) => {
    const onAbort = (): void => {
      operation.catch(() => undefined);
      reject(asError(signal.reason));
    };
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolveValue(value); },
      (reason: unknown) => { signal.removeEventListener("abort", onAbort); reject(asError(reason)); },
    );
  });
}

/**
 * Một dòng listing cho dirent, theo symlink tới thư mục; null cho không-phải-thư-mục và link hỏng/vòng.
 * Nhận: thư mục cha · tên · có phải thư mục · có phải symlink · signal.
 * Trả: DirectoryRow hoặc null.
 */
async function directoryRow(parent: string, name: string, isDirectory: boolean, isSymbolicLink: boolean, signal?: AbortSignal): Promise<DirectoryRow | null> {
  const path = join(parent, name);
  let enterable = isDirectory;
  if (!enterable && isSymbolicLink) {
    try {
      enterable = (await raceAbort(stat(path), signal)).isDirectory();
    } catch {
      if (signal?.aborted === true) throw asError(signal.reason);
      return null;
    }
  }
  if (!enterable) return null;
  return { name, path, hidden: name.startsWith(".") };
}

/** Cấu hình của backend browse (bản gốc: schemastery `z.object({ maxEntries: z.natural().min(1).default(1000) })`). */
export interface BrowseConfig { maxEntries: number; }
/** Giá trị mặc định của cấu hình (giữ đúng 1.000 như bản gốc). */
export const DEFAULT_MAX_ENTRIES = 1000;

/** Backend `browse` của `ctx.directoryPicker` (capability ổn định theo vòng đời service). */
export class BrowseDirectoryPicker extends DirectoryPickerBase {
  /** Cấu hình đã chuẩn hoá. */
  private readonly config: BrowseConfig;
  /** Capability ổn định. */
  private readonly browseCapability: { kind: "browse"; list: (path?: string, signal?: AbortSignal) => Promise<DirectoryListing>; createDirectory: (path: string, name: string) => Promise<string> };
  /**
   * Dựng backend.
   * Nhận: ctx cordis · cấu hình (maxEntries mặc định 1.000).
   * Trả: instance.
   */
  constructor(ctx: unknown, config: BrowseConfig = { maxEntries: DEFAULT_MAX_ENTRIES }) {
    super(ctx);
    this.config = config;
    this.browseCapability = {
      kind: "browse",
      list: (path, signal) => this.list(path, signal),
      createDirectory: (path, name) => this.createDirectory(path, name),
    };
  }
  /**
   * Capability browse.
   * Nhận: không.
   * Trả: object capability ổn định.
   */
  capability(): unknown { return this.browseCapability; }
  /**
   * Liệt kê MỘT cấp thư mục, có chặn bộ nhớ O(maxEntries) và cờ truncated.
   * Nhận: đường dẫn (vắng = home) · signal.
   * Trả: DirectoryListing.
   */
  async list(path?: string, signal?: AbortSignal): Promise<DirectoryListing> {
    const home = homedir();
    if (path !== undefined && !fullyQualified(path)) throw new DirectoryPickerError("directory-unreadable", path, `cannot list "${path}": not a fully qualified path`);
    const target = resolve(path ?? home);
    const keep = this.config.maxEntries + 1;
    const window: Candidate[] = [];
    let evicted = false;
    try {
      const opening = opendir(target);
      const level = await raceAbort(opening, signal).catch((error: unknown) => {
        opening.then((dir) => dir.close().catch(swallowCloseFailure), () => undefined);
        throw error;
      });
      try {
        for (;;) {
          const dirent = await raceAbort(level.read(), signal);
          if (dirent === null) break;
          if (!dirent.isDirectory() && !dirent.isSymbolicLink()) continue;
          if (boundedInsert(window, { name: dirent.name, isDirectory: dirent.isDirectory(), isSymbolicLink: dirent.isSymbolicLink() }, keep)) evicted = true;
        }
      } finally {
        const closing = level.close();
        if (signal?.aborted === true) closing.catch(swallowCloseFailure);
        else await closing;
      }
    } catch (error) {
      signal?.throwIfAborted();
      throw new DirectoryPickerError("directory-unreadable", target, `cannot list ${target}: ${messageOf(error)}`);
    }
    const entries: DirectoryRow[] = [];
    let truncated = evicted;
    for (const candidate of window) {
      signal?.throwIfAborted();
      const row = await directoryRow(target, candidate.name, candidate.isDirectory, candidate.isSymbolicLink, signal);
      if (row === null) continue;
      if (entries.length === this.config.maxEntries) { truncated = true; break; }
      entries.push(row);
    }
    return { path: target, home, crumbs: ancestryCrumbs(target), entries, truncated };
  }
  /**
   * Tạo MỘT thư mục con dưới thư mục cha đã cho.
   * Nhận: đường dẫn cha · tên một segment.
   * Trả: đường dẫn đã tạo.
   */
  async createDirectory(path: string, name: string): Promise<string> {
    if (!fullyQualified(path)) throw new DirectoryPickerError("directory-create-failed", path, `cannot create under "${path}": not a fully qualified parent path`);
    const parent = resolve(path);
    if (name.trim() === "" || name === "." || name === ".." || /[/\\]/.test(name)) throw new DirectoryPickerError("directory-create-failed", join(parent, name), `"${name}" is not a single path segment`);
    const target = join(parent, name);
    try {
      await mkdir(target);
      return target;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "EEXIST") throw new DirectoryPickerError("directory-exists", target, `${target} already exists`);
      throw new DirectoryPickerError("directory-create-failed", target, `cannot create ${target}: ${messageOf(error)}`);
    }
  }
}

export default BrowseDirectoryPicker;
