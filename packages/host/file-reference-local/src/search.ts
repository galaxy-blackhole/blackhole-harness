/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chỉ mục MỜ có giới hạn cho `@file` trên workspace của host — chỉ chứa ĐƯỜNG DẪN: giá trị đã
 *      chọn vẫn là chữ prompt thường và nội dung tệp vẫn nằm sau tool `read`. Ba phần: duyệt cây
 *      (bỏ thư mục sinh), liệt kê THEO THƯ MỤC cho truy vấn có `/`, và xếp hạng theo điểm.
 */

import { lstat, readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Dirent } from "node:fs";
import type { FileSearchCandidate, FileSearchConfig } from "./types.ts";

/** Số ứng viên tệp và thư mục tối đa dựng cho một truy vấn. */
export const DEFAULT_FILE_SEARCH_MAX_RESULTS = 20;

/** Số mục tối đa giữ trong một chỉ mục tìm kiếm workspace. */
export const DEFAULT_FILE_SEARCH_MAX_ENTRIES = 5e4;

/**
 * Tên thư mục bị bỏ qua khi duyệt, trừ khi deployment ghi đè: kho version-control và thư viện phụ
 * thuộc, cộng tên thư mục đầu ra mà không hệ sinh thái nào dùng cho mã nguồn. Tệp sinh mang đúng
 * tên tệp nguồn đã sinh ra nó, nên một cây không lọc vừa tiêu ngân sách mục hai lần vừa xếp
 * `dist/x.js` ngang `src/x.ts` ở mọi truy vấn.
 *
 * `lib` CỐ Ý không có trong danh sách: gem Ruby và nhiều gói npm giữ mã nguồn ở đó, loại nó đi thì
 * `@` bỏ sót những nguồn ấy một cách IM LẶNG. Workspace nào build ra `lib` thì tự thêm qua
 * `excludedDirectories`.
 */
export const DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES: string[] = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "target",
  ".next",
  ".nuxt",
  ".turbo",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".gradle",
];

/** Một mục của chỉ mục: đường dẫn tương đối so với gốc và loại. */
interface IndexedEntry {
  /** Đường dẫn tương đối, dấu `/` làm ngăn cách. */
  path: string;
  /** `directory` hoặc `file`. */
  kind: "file" | "directory";
}

/** Một thư mục còn chờ duyệt trong hàng đợi quét. */
interface PendingDirectory {
  /** Đường dẫn tuyệt đối. */
  absolute: string;
  /** Đường dẫn tương đối so với gốc (rỗng cho chính gốc). */
  relative: string;
}

/** Chỉ mục đã chốt: các mục + mốc `invalidations` tại lúc bắt đầu quét. */
interface SettledIndex {
  /** Các mục đã duyệt xong. */
  entries: IndexedEntry[];
  /** Giá trị `invalidations` lúc bắt đầu quét; thấp hơn hiện tại nghĩa là chỉ mục đã cũ. */
  startedAt: number;
}

/** Một lượt quét đang chạy. */
interface IndexGeneration {
  /** Bộ điều khiển huỷ của lượt quét. */
  controller: AbortController;
  /** Promise của lượt quét. */
  promise: Promise<IndexedEntry[]>;
}

/**
 * Chỉ mục mờ huỷ được và dùng lại được, gốc tại một thư mục làm việc của agent.
 * Truy vấn theo thư mục liệt kê trạng thái SỐNG; truy vấn mờ trần dùng chung MỘT lượt duyệt có
 * giới hạn. Chỉ truy vấn ĐẦU của một workspace chờ lượt duyệt đó — chỉ mục đã bị đánh dấu cũ vẫn
 * trả lời trong khi bản thay thế dựng ở phía sau con trỏ.
 */
export class WorkspaceFileSearch {
  /** Gốc tuyệt đối của workspace. */
  root: string;

  /** Cấu hình đã chốt (ba trường). */
  config: FileSearchConfig;

  /** Tập tên thư mục bị bỏ qua — `Set` RIÊNG cho từng thực thể. */
  excludedDirectories: Set<string>;

  /** Chỉ mục đã chốt gần nhất, hoặc `undefined` khi chưa quét xong lần nào. */
  settled: SettledIndex | undefined;

  /** Lượt quét đang chạy, hoặc `undefined` khi không có. */
  generation: IndexGeneration | undefined;

  /** Bộ đếm đánh dấu cũ đơn điệu tăng; chỉ mục đã chốt thấp hơn nó là đã cũ. */
  invalidations = 0;

  /** Đã gỡ nạp: mọi truy vấn sau đó trả rỗng. */
  disposed = false;

  /**
   * Dựng chỉ mục cho một workspace và kiểm cấu hình ngay tại biên.
   * Nhận: gốc tuyệt đối + cấu hình đã chốt.
   * Trả: thực thể sẵn sàng nhận truy vấn; ném khi cấu hình không hợp lệ.
   */
  constructor(root: string, config: FileSearchConfig) {
    this.root = root;
    this.config = config;
    if (!Number.isSafeInteger(config.maxResults) || config.maxResults <= 0) throw new Error("file search maxResults must be a positive safe integer");
    if (!Number.isSafeInteger(config.maxEntries) || config.maxEntries <= 0) throw new Error("file search maxEntries must be a positive safe integer");
    if (config.excludedDirectories.some((name) => name.length === 0 || name.includes("/") || name.includes("\\"))) throw new Error("file search excludedDirectories entries must be non-empty directory basenames");
    this.excludedDirectories = new Set(config.excludedDirectories);
  }

  /**
   * Trả các ứng viên đường dẫn đã xếp hạng cho token hiện tại.
   * Nhận: chữ đường dẫn sau `@` hoặc `@"` + tín hiệu huỷ của người gọi.
   * Trả: tối đa `maxResults` ứng viên, thứ tự tất định.
   */
  async list(rawQuery: string, signal: AbortSignal): Promise<FileSearchCandidate[]> {
    signal.throwIfAborted();
    if (this.disposed) return [];
    const query = rawQuery.replaceAll("\\", "/");
    const slash = query.lastIndexOf("/");
    if (query === "" || slash >= 0) {
      const directory = slash < 0 ? "" : query.slice(0, slash + 1);
      const fragment = slash < 0 ? "" : query.slice(slash + 1);
      return this.listDirectory(directory, fragment, signal);
    }
    return rankCandidates(
      (await this.indexFor(signal)).filter((candidate) => visibleForGlobalQuery(candidate.path, query)),
      query,
      this.config.maxResults,
    );
  }

  /**
   * Đánh dấu chỉ mục đã cũ để truy vấn mờ trần sau đó thấy cây MỚI.
   *
   * Các mục cũ được GIỮ LẠI và vẫn trả lời: dựng lại tốn một lượt duyệt cả workspace, và đặt lượt
   * đó ngay trước con trỏ là thứ người gọi đánh dấu cũ sau mỗi kết quả tool sẽ phải trả.
   * Nhận: không.
   * Trả: không.
   */
  invalidate(): void {
    this.invalidations += 1;
  }

  /**
   * Huỷ lượt duyệt và làm mọi truy vấn sau đó trả về không có ứng viên.
   * Nhận: không.
   * Trả: không.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation?.controller.abort(new Error("file search index disposed"));
    this.generation = undefined;
    this.settled = undefined;
  }

  /**
   * Các mục mà một truy vấn mờ trần xếp hạng. Chỉ truy vấn ĐẦU của workspace chờ một lượt duyệt;
   * sau đó chỉ mục cũ trả lời ngay còn bản thay thế dựng ở phía sau.
   * Nhận: tín hiệu huỷ của người gọi.
   * Trả: đường dẫn đã chỉ mục, chậm nhất là một lần đánh dấu cũ so với cây.
   */
  async indexFor(signal: AbortSignal): Promise<IndexedEntry[]> {
    const settled = this.settled;
    if (settled === undefined) return waitForPromise(this.ensureIndex(), signal);
    if (settled.startedAt < this.invalidations) this.ensureIndex().catch(() => {});
    return settled.entries;
  }

  /**
   * Bảo đảm có đúng MỘT lượt quét cho thế hệ hiện tại.
   * Nhận: không.
   * Trả: promise của lượt quét (dùng lại nếu đang chạy).
   */
  ensureIndex(): Promise<IndexedEntry[]> {
    if (this.generation !== undefined) return this.generation.promise;
    const controller = new AbortController();
    const startedAt = this.invalidations;
    const generation: IndexGeneration = {
      controller,
      promise: Promise.resolve([]),
    };
    generation.promise = this.scanWorkspace(controller.signal).then(
      (entries) => {
        /* Gỡ nạp huỷ lượt duyệt này nên nó rơi vào nhánh từ chối; phép canh chỉ phủ lượt quét vừa
         * duyệt xong thư mục CUỐI trong đúng tích tắc trước khi lệnh huỷ tới, và KHÔNG được trả mục
         * lại cho một chỉ mục đã gỡ nạp. */
        if (this.disposed) return entries;
        this.generation = undefined;
        this.settled = { entries, startedAt };
        return entries;
      },
      (error: unknown) => {
        /* `dispose` xoá `generation` đồng bộ; nhánh này chỉ bảo vệ một lượt quét hỏng bất ngờ. */
        if (this.generation === generation) this.generation = undefined;
        throw error;
      },
    );
    this.generation = generation;
    return generation.promise;
  }

  /**
   * Duyệt cây theo chiều rộng, dừng ngay khi chạm trần số mục.
   * Nhận: tín hiệu huỷ của lượt quét.
   * Trả: các mục đã chỉ mục, theo thứ tự duyệt.
   */
  async scanWorkspace(signal: AbortSignal): Promise<IndexedEntry[]> {
    const indexed: IndexedEntry[] = [];
    const directories: PendingDirectory[] = [{ absolute: this.root, relative: "" }];
    for (let cursor = 0; cursor < directories.length && indexed.length < this.config.maxEntries; cursor += 1) {
      signal.throwIfAborted();
      const directory = directories[cursor];
      if (directory === undefined) throw new Error("file search selected a missing directory");
      const entries = cursor === 0 ? await readWorkspaceRoot(directory.absolute, signal) : await readDirectory(directory.absolute, signal);
      for (const entry of entries) {
        signal.throwIfAborted();
        const path = directory.relative === "" ? entry.name : `${directory.relative}/${entry.name}`;
        if (entry.isDirectory()) {
          if (this.excludedDirectories.has(entry.name)) continue;
          indexed.push({ path, kind: "directory" });
          directories.push({ absolute: join(directory.absolute, entry.name), relative: path });
        } else if (entry.isFile()) indexed.push({ path, kind: "file" });
        if (indexed.length >= this.config.maxEntries) break;
      }
    }
    return indexed;
  }

  /**
   * Liệt kê MỘT thư mục cho truy vấn có `/` (hoặc truy vấn rỗng ở gốc).
   * Nhận: thư mục hiển thị (kết thúc bằng `/` hoặc rỗng) + mẩu cần khớp + tín hiệu huỷ.
   * Trả: ứng viên đã xếp hạng trong thư mục đó.
   */
  async listDirectory(displayDirectory: string, fragment: string, signal: AbortSignal): Promise<FileSearchCandidate[]> {
    if (displayDirectory.split("/").some((segment) => this.excludedDirectories.has(segment))) return [];
    const absolute = await resolveDisplayDirectory(this.root, displayDirectory, signal);
    if (absolute === undefined) return [];
    const entries = await readDirectory(absolute, signal);
    const candidates: FileSearchCandidate[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") && !fragment.startsWith(".")) continue;
      if (entry.isDirectory()) {
        if (this.excludedDirectories.has(entry.name)) continue;
        candidates.push({ path: `${displayDirectory}${entry.name}`, kind: "directory" });
      } else if (entry.isFile()) candidates.push({ path: `${displayDirectory}${entry.name}`, kind: "file" });
    }
    return rankCandidates(candidates, fragment, this.config.maxResults);
  }
}

/**
 * Đổi thư mục HIỂN THỊ thành đường dẫn tuyệt đối, từ chối mọi đường dẫn thoát khỏi gốc.
 * Nhận: gốc workspace + thư mục hiển thị + tín hiệu huỷ.
 * Trả: đường dẫn tuyệt đối nằm trong gốc, hoặc `undefined` khi thoát gốc / gặp liên kết tượng trưng /
 * không phải thư mục / không đọc được.
 */
async function resolveDisplayDirectory(root: string, displayDirectory: string, signal: AbortSignal): Promise<string | undefined> {
  const resolvedRoot = resolve(root);
  const absolute = resolve(resolvedRoot, displayDirectory === "" ? "." : displayDirectory);
  const fromRoot = relative(resolvedRoot, absolute);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) return undefined;
  if (isAbsolute(fromRoot)) return undefined;
  let current = resolvedRoot;
  for (const segment of fromRoot.split(sep).filter(Boolean)) {
    signal.throwIfAborted();
    current = join(current, segment);
    try {
      const status = await lstat(current);
      signal.throwIfAborted();
      if (status.isSymbolicLink() || !status.isDirectory()) return undefined;
    } catch (_error) {
      signal.throwIfAborted();
      return undefined;
    }
  }
  return absolute;
}

/**
 * Đọc thư mục GỐC — lỗi đọc được NÉM RA (khác `readDirectory`) vì gốc workspace hỏng là lỗi thật.
 * Nhận: đường dẫn tuyệt đối + tín hiệu huỷ.
 * Trả: các mục đã sắp theo tên.
 */
async function readWorkspaceRoot(absolute: string, signal: AbortSignal): Promise<Dirent[]> {
  signal.throwIfAborted();
  const entries = await readdir(absolute, { withFileTypes: true });
  signal.throwIfAborted();
  return entries.sort((left, right) => compareText(left.name, right.name));
}

/**
 * Đọc một thư mục con, coi lỗi đọc là "không có mục nào" để một thư mục hỏng quyền không phá cả lượt.
 * Nhận: đường dẫn tuyệt đối + tín hiệu huỷ.
 * Trả: các mục đã sắp theo tên, hoặc mảng rỗng.
 */
async function readDirectory(absolute: string, signal: AbortSignal): Promise<Dirent[]> {
  signal.throwIfAborted();
  try {
    const entries = await readdir(absolute, { withFileTypes: true });
    signal.throwIfAborted();
    return entries.sort((left, right) => compareText(left.name, right.name));
  } catch (_error) {
    signal.throwIfAborted();
    return [];
  }
}

/**
 * Một đường dẫn có hiện ra cho truy vấn MỜ TRẦN hay không.
 * Nhận: đường dẫn + chữ truy vấn.
 * Trả: `true` khi người dùng đã gõ dấu chấm (muốn thấy mục ẩn) hoặc đường dẫn không có đoạn ẩn nào.
 */
function visibleForGlobalQuery(path: string, query: string): boolean {
  if (query.startsWith(".") || query.includes("/.")) return true;
  return !path.split("/").some((segment) => segment.startsWith("."));
}

/**
 * Xếp hạng ứng viên: điểm giảm dần, rồi thư mục trước tệp, rồi đường dẫn NGẮN hơn, rồi thứ tự chữ.
 * Nhận: danh sách ứng viên + chữ truy vấn + trần kết quả.
 * Trả: tối đa `limit` ứng viên đã xếp hạng.
 */
function rankCandidates(candidates: readonly FileSearchCandidate[], query: string, limit: number): FileSearchCandidate[] {
  const ranked: { candidate: FileSearchCandidate; score: number }[] = [];
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, query);
    if (score !== undefined) ranked.push({ candidate, score });
  }
  ranked.sort(
    (left, right) =>
      right.score - left.score ||
      kindRank(left.candidate.kind) - kindRank(right.candidate.kind) ||
      (query === "" ? 0 : left.candidate.path.length - right.candidate.path.length) ||
      compareText(left.candidate.path, right.candidate.path),
  );
  return ranked.slice(0, limit).map((entry) => entry.candidate);
}

/**
 * Điểm của một ứng viên theo năm bậc khớp: tên bằng, tên bắt đầu bằng, tên chứa, đường dẫn chứa,
 * rồi dãy con. Thư mục được cộng 25 điểm ở MỌI bậc.
 * Nhận: ứng viên + chữ truy vấn.
 * Trả: điểm, hoặc `undefined` khi không khớp bậc nào.
 */
function scoreCandidate(candidate: FileSearchCandidate, query: string): number | undefined {
  if (query === "") return 0;
  const path = candidate.path.toLowerCase();
  const name = path.slice(path.lastIndexOf("/") + 1);
  const needle = query.toLowerCase();
  const directoryBonus = candidate.kind === "directory" ? 25 : 0;
  if (name === needle) return 1e3 + directoryBonus;
  if (name.startsWith(needle)) return 900 + directoryBonus;
  if (name.includes(needle)) return 700 + directoryBonus;
  if (path.includes(needle)) return 500 + directoryBonus;
  const subsequence = subsequenceScore(path, needle);
  return subsequence === undefined ? undefined : 300 + subsequence + directoryBonus;
}

/**
 * Điểm dãy con: 100 trừ tổng số ký tự bị bỏ qua khi quét ngược, sàn 0.
 * Nhận: chuỗi đích (đã hạ chữ) + chữ cần khớp (đã hạ chữ).
 * Trả: điểm trong khoảng 0…100, hoặc `undefined` khi chữ cần khớp không phải dãy con.
 */
function subsequenceScore(target: string, query: string): number | undefined {
  let targetIndex = 0;
  let gap = 0;
  for (const character of query) {
    const found = target.indexOf(character, targetIndex);
    if (found < 0) return undefined;
    gap += found - targetIndex;
    targetIndex = found + 1;
  }
  return Math.max(0, 100 - gap);
}

/**
 * Hạng ưu tiên theo loại: thư mục đứng trước tệp khi điểm bằng nhau.
 * Nhận: loại ứng viên.
 * Trả: 0 cho thư mục, 1 cho tệp.
 */
function kindRank(kind: "file" | "directory"): number {
  return kind === "directory" ? 0 : 1;
}

/**
 * So hai chuỗi theo thứ tự từ điển, KHÔNG phụ thuộc locale.
 * Nhận: hai chuỗi.
 * Trả: -1, 0 hoặc 1.
 */
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Chờ một promise nhưng cho phép người gọi HUỶ lượt chờ của mình mà không giết lượt duyệt dùng chung.
 * Nhận: promise cần chờ + tín hiệu huỷ của người gọi.
 * Trả: promise đã bọc, từ chối bằng lý do huỷ khi tín hiệu bật.
 */
function waitForPromise<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(errorReason(signal.reason, "file search aborted"));
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const onAbort = (): void => {
      rejectPromise(errorReason(signal.reason, "file search aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolvePromise(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        rejectPromise(errorReason(error, "file search index failed"));
      },
    );
  });
}

/**
 * Chuẩn hoá một lý do bất kỳ thành `Error`, giữ nguyên lý do gốc ở `cause`.
 * Nhận: lý do (có thể không phải Error) + chữ dự phòng.
 * Trả: thể hiện `Error`.
 */
function errorReason(reason: unknown, fallback: string): Error {
  return reason instanceof Error ? reason : new Error(fallback, { cause: reason });
}
