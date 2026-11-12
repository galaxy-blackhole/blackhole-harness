/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cơ chế dọn dẹp lúc khởi động cho các gốc tràn cục bộ: xoá tệp quá hạn, tỉa thư mục phiên rỗng,
 *      và chỉ gỡ những gốc mà CHÍNH backend đã tạo. Mọi lỗi hệ tệp đều được chứa (không bao giờ ném).
 *      Bản viết lại của Galaxy Blackhole cho row spill-local (@deepseek-ai/dsh-spill-local) —
 *      nguồn đối chiếu: apps/host/node_modules/@deepseek-ai/dsh-spill-local/lib/types/cleanup.d.ts
 */
import { lstat, readdir, realpath, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_ROOT_PREFIX, isErrno } from "./store.ts";

/** Sink cảnh báo MỘT tham số — tác dụng phụ duy nhất của lượt dọn khi gặp lỗi (không bao giờ ném). */
export type WarnFn = (message: string) => void;

/** Một gốc cần dọn, kèm cờ cho biết gốc đó có được gỡ khi đã rỗng hay không. */
export interface SweepRoot {
  /** Gốc tràn tuyệt đối cần quét. */
  path: string;
  /**
   * Khi `true`, gỡ chính gốc sau khi mọi thư mục `session-*` rỗng của nó đã được tỉa. Đặt cho các gốc
   * `dsh-spill-*` mặc định DÒ ĐƯỢC (mỗi tiến trình quá khứ để lại một cái — không tỉa thì chúng tích
   * tụ mãi), KHÔNG BAO GIỜ đặt cho gốc đang hoạt động mà tiến trình sống còn đang ghi vào. Mọi gốc
   * đều tỉa thư mục phiên rỗng; lượt ghi sẽ thử lại nếu việc tỉa đó đua với nó.
   */
  pruneWhenEmpty: boolean;
}

/** Tham số của {@link sweepSpillRoots} — các gốc cần quét, mốc tuổi, và sink lỗi. */
export interface SweepOptions {
  /** Các gốc cần dọn (gốc cấu hình/đang hoạt động và/hoặc gốc mặc định dò được). */
  roots: SweepRoot[];
  /**
   * Mốc tuổi tính bằng epoch-millis: một tệp THƯỜNG bị xoá khi `mtime` của nó CŨ HƠN HẲN mốc này.
   * Bên gọi suy ra `now - cleanupPeriodDays`, nên tệp ghi đúng tại mốc được GIỮ (chỉ cũ hơn hẳn mới hết hạn).
   */
  cutoffMs: number;
  /** Nơi báo lỗi hệ tệp đã được chứa; bản thân lượt dọn không bao giờ ném. */
  warn: WarnFn;
}

/**
 * Một tên gốc mặc định do backend sinh: `dsh-spill-` cộng hậu tố 6 ký tự mà `mkdtemp` thêm vào.
 * Lượt dò khớp ĐÚNG hình dạng này (không phải tiền tố trần), nên một fixture `dsh-spill-test-*` không
 * liên quan hay một thư mục `dsh-spill-…` khác hình dạng của công cụ lạ không bao giờ bị nhận nhầm là
 * gốc của backend để quét.
 */
const DEFAULT_ROOT_RE = new RegExp("^" + DEFAULT_ROOT_PREFIX + "[A-Za-z0-9]{6}$");

/**
 * Một tên thư mục phiên do backend sinh: `session-` cộng 12 ký tự hex THƯỜNG mà `sessionDir` suy từ
 * `sha256(id phiên)`. Lượt tỉa chỉ đi xuống những mục ĐÚNG hình dạng này, nên một thư mục
 * `session-backup` không liên quan dưới một gốc cấu hình dùng chung không bao giờ bị quét.
 */
const SESSION_DIR_RE = /^session-[0-9a-f]{12}$/;

/** Bit quyền "nhóm/người khác ghi được" (0022). */
const MODE_GROUP_OTHER_WRITE = 0o022;
/** Bit quyền "gốc dính" (01000) — chặn người khác thay thế con của thư mục. */
const MODE_STICKY = 0o1000;

/**
 * Uid hiện tại của tiến trình, hoặc `undefined` khi nền tảng không có `geteuid` (Windows).
 * Nhận: không.
 * Trả: uid hiện tại, hoặc `undefined`.
 */
function currentUid(): number | undefined {
  return typeof process.geteuid === "function" ? process.geteuid() : undefined;
}

/**
 * Báo một lỗi dọn dẹp best-effort mà không cho sink cảnh báo làm hỏng lượt dọn.
 * Nhận: sink cảnh báo và thông điệp.
 * Trả: không (nuốt mọi lỗi của sink).
 */
function warnSafely(warn: WarnFn, message: string): void {
  try {
    warn(message);
  } catch {
    // Sink cảnh báo là của bên gọi: lỗi của nó không được biến thành lỗi của lượt dọn.
  }
}

/**
 * Cho biết một người dùng hệ điều hành KHÁC có thể thay thế các mục con của thư mục này hay không.
 * Nhận: thông tin `lstat` của thư mục.
 * Trả: `true` khi thư mục thuộc user hiện tại và không cho nhóm/người khác ghi.
 */
function isTrustedDirectory(stats: import("node:fs").Stats): boolean {
  if (!stats.isDirectory()) return false;
  const uid = currentUid();
  // POSIX ownership và mode bit không có tương đương trên Windows.
  if (process.platform === "win32" || uid === undefined) return true;
  return stats.uid === uid && (stats.mode & MODE_GROUP_OTHER_WRITE) === 0;
}

/**
 * Danh tính ổn định để khử trùng các đường dẫn alias của CÙNG một gốc.
 * Nhận: đường dẫn đã chuẩn hoá và thông tin `lstat` của nó.
 * Trả: khoá danh tính (chỉ số tệp trên Windows không phải danh tính inode khả chuyển).
 */
function rootIdentity(path: string, stats: import("node:fs").Stats): string {
  if (process.platform === "win32") return path.toLowerCase();
  return `${String(stats.dev)}:${String(stats.ino)}`;
}

/**
 * Kiểm rằng không tổ tiên nào cho phép một người dùng hệ điều hành khác thay thế mục con đã chọn.
 * Một tổ tiên dính (sticky) mà ghi được vẫn AN TOÀN vì mục con thuộc user hiện tại; nhờ đó các gốc
 * bình thường dưới `/tmp` được chấp nhận.
 * Nhận: đường dẫn tuyệt đối của gốc đã chuẩn hoá.
 * Trả: `true` khi mọi tổ tiên đều an toàn (hoặc nền tảng không có khái niệm quyền POSIX).
 */
async function hasProtectedAncestors(path: string): Promise<boolean> {
  const uid = currentUid();
  // Lượt kiểm tổ tiên POSIX không có tương đương ACL trên Windows.
  if (process.platform === "win32" || uid === undefined) return true;
  let child = path;
  let childStats = await lstat(child);
  for (;;) {
    const parent = dirname(child);
    if (parent === child) return true;
    const stats = await lstat(parent);
    if (!stats.isDirectory()) return false;
    const writableByOthers = (stats.mode & MODE_GROUP_OTHER_WRITE) !== 0;
    const sticky = (stats.mode & MODE_STICKY) !== 0;
    if (writableByOthers && !sticky) return false;
    if (writableByOthers && childStats.uid !== uid) return false;
    child = parent;
    childStats = stats;
  }
}

/**
 * Giải MỘT gốc đã tồn tại mà không chấp nhận thư mục có thể bị người dùng cục bộ khác thay thế trong
 * lượt quét theo đường dẫn. Gốc cấu hình có thể là symlink; lượt dò truyền `false` để một symlink
 * không thể mạo danh gốc mặc định.
 *
 * @param path Đường dẫn gốc ứng viên.
 * @param allowSymlink Ứng viên có được phép là symlink cấu hình hay không.
 * @param warn Sink cho lượt bỏ qua hoặc lượt kiểm hỏng.
 * @returns Gốc chuẩn hoá đáng tin, hoặc `undefined` khi nó vắng mặt hoặc không an toàn.
 */
async function resolveRoot(path: string, allowSymlink: boolean, warn: WarnFn): Promise<{ path: string; identity: string } | undefined> {
  let initial: import("node:fs").Stats;
  try {
    initial = await lstat(path);
  } catch (error) {
    if (!isErrno(error, "ENOENT")) warnSafely(warn, `spill-local: failed to inspect root ${path}: ${String(error)}`);
    return undefined;
  }
  if (initial.isSymbolicLink()) {
    if (!allowSymlink) return undefined;
  } else if (!isTrustedDirectory(initial)) {
    warnSafely(warn, `spill-local: skipped unsafe root ${path}: expected a directory owned by the current user and not writable by group or others`);
    return undefined;
  }
  let canonical: string;
  let stats: import("node:fs").Stats;
  try {
    canonical = await realpath(path);
    stats = await lstat(canonical);
  } catch (error) {
    if (!isErrno(error, "ENOENT")) warnSafely(warn, `spill-local: failed to resolve root ${path}: ${String(error)}`);
    return undefined;
  }
  let protectedAncestors = false;
  try {
    protectedAncestors = await hasProtectedAncestors(canonical);
  } catch (error) {
    if (!isErrno(error, "ENOENT")) warnSafely(warn, `spill-local: failed to inspect ancestors of root ${canonical}: ${String(error)}`);
    return undefined;
  }
  if (!isTrustedDirectory(stats) || !protectedAncestors) {
    warnSafely(warn, `spill-local: skipped unsafe root ${canonical}: expected a current-user-owned directory with protected write and ancestor permissions`);
    return undefined;
  }
  return {
    path: canonical,
    identity: rootIdentity(canonical, stats),
  };
}

/**
 * Xoá MỘT đường dẫn, coi việc biến mất do đua là thành công.
 * Một tiến trình song song (hoặc một lượt dọn khác) có thể `unlink` đúng tệp đó giữa lượt quét của ta
 * và lượt `unlink` của ta — khi đó ENOENT nghĩa là mục tiêu (tệp đã mất) ĐÃ ĐẠT, nên không phải lỗi.
 * Mọi lỗi khác được báo rồi nuốt.
 *
 * @param path Đường dẫn tệp tuyệt đối cần xoá.
 * @param warn Sink cho thông điệp lỗi khác ENOENT.
 * @returns Hoàn tất khi lượt xoá đã được thử (không bao giờ ném).
 */
async function unlinkIdempotent(path: string, warn: WarnFn): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return;
    warnSafely(warn, `spill-local: failed to delete ${path}: ${String(error)}`);
  }
}

/**
 * Quét MỘT thư mục phiên tràn: xoá tệp thường đã hết hạn, bỏ qua mọi thứ khác, và báo thư mục có rỗng
 * sau đó hay không để bên gọi tỉa nó. Mục `dir` BẮT BUỘC là thư mục thật — bên gọi `lstat` nó trước và
 * bỏ qua symlink, nên hàm này không bao giờ đi theo symlink `session-*` sang cây lạ. Bên trong, một
 * symlink hay mục không-thường (socket, fifo, thư mục lồng) được để nguyên — `lstat` không đi theo
 * link, nên một symlink bị cài sẵn không thể bị xoá cũng không thể chuyển hướng phép kiểm tuổi. Mọi
 * lỗi theo từng mục đều được chứa: một tệp không đọc được không làm hỏng cả thư mục.
 *
 * @param dir Thư mục phiên tuyệt đối cần quét (đã xác nhận là thư mục thật).
 * @param cutoffMs Tệp có `mtime` CŨ HƠN HẲN mốc này bị xoá.
 * @param warn Sink cho lỗi hệ tệp đã chứa.
 * @returns `true` khi thư mục không còn mục nào sau lượt quét (ứng viên tỉa).
 */
async function sweepSessionDir(dir: string, cutoffMs: number, warn: WarnFn): Promise<boolean> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    warnSafely(warn, `spill-local: failed to read ${dir}: ${String(error)}`);
    return false;
  }
  let remaining = names.length;
  for (const name of names) {
    const path = join(dir, name);
    let stats: import("node:fs").Stats;
    try {
      stats = await lstat(path);
    } catch (error) {
      if (isErrno(error, "ENOENT")) {
        remaining--;
        continue;
      }
      warnSafely(warn, `spill-local: failed to stat ${path}: ${String(error)}`);
      continue;
    }
    if (!stats.isFile()) continue;
    if (stats.mtimeMs >= cutoffMs) continue;
    await unlinkIdempotent(path, warn);
    remaining--;
  }
  return remaining === 0;
}

/**
 * Lượt dọn best-effort MỘT LẦN: trên mỗi gốc, xoá tệp thường đã hết hạn dưới các thư mục `session-*`
 * của nó và tỉa mọi thư mục phiên rỗng. Chỉ gốc mặc định đã dò được mới bị gỡ chính nó. Lượt ghi sẽ
 * tạo lại thư mục phiên nếu việc tỉa đua với nó. Mọi lỗi hệ tệp và lỗi sink cảnh báo đều được chứa,
 * nên bên gọi có thể `await` hàm này trong lúc kích hoạt/gỡ mà nó không bao giờ reject.
 *
 * @param options Các gốc cần quét, mốc tuổi, và sink lỗi.
 * @returns Hoàn tất khi lượt dọn xong (không bao giờ ném).
 */
export async function sweepSpillRoots(options: SweepOptions): Promise<void> {
  const { cutoffMs, warn } = options;
  const roots = new Map<string, SweepRoot>();
  for (const candidate of options.roots) {
    const resolved = await resolveRoot(candidate.path, false, warn);
    if (resolved === undefined) continue;
    const existing = roots.get(resolved.identity);
    roots.set(resolved.identity, {
      path: resolved.path,
      pruneWhenEmpty: (existing?.pruneWhenEmpty ?? true) && candidate.pruneWhenEmpty,
    });
  }
  for (const root of roots.values()) {
    let entries: string[];
    try {
      entries = await readdir(root.path);
    } catch (error) {
      if (!isErrno(error, "ENOENT")) warnSafely(warn, `spill-local: failed to read root ${root.path}: ${String(error)}`);
      continue;
    }
    let rootEmptiable = true;
    for (const name of entries) {
      if (!SESSION_DIR_RE.test(name)) {
        rootEmptiable = false;
        continue;
      }
      const dir = join(root.path, name);
      let stats: import("node:fs").Stats;
      try {
        stats = await lstat(dir);
      } catch (error) {
        if (!isErrno(error, "ENOENT")) warnSafely(warn, `spill-local: failed to stat ${dir}: ${String(error)}`);
        continue;
      }
      if (!isTrustedDirectory(stats)) {
        warnSafely(warn, `spill-local: skipped unsafe session directory ${dir}`);
        rootEmptiable = false;
        continue;
      }
      if (!(await sweepSessionDir(dir, cutoffMs, warn))) {
        rootEmptiable = false;
        continue;
      }
      try {
        await rmdir(dir);
      } catch (error) {
        rootEmptiable = false;
        if (!isErrno(error, "ENOENT") && !isErrno(error, "ENOTEMPTY")) warnSafely(warn, `spill-local: failed to prune ${dir}: ${String(error)}`);
      }
    }
    if (!root.pruneWhenEmpty || !rootEmptiable) continue;
    try {
      await rmdir(root.path);
    } catch (error) {
      if (!isErrno(error, "ENOENT") && !isErrno(error, "ENOTEMPTY")) warnSafely(warn, `spill-local: failed to prune root ${root.path}: ${String(error)}`);
    }
  }
}

/**
 * Dò các gốc tràn mặc định của những lượt chạy TRƯỚC: những thư mục `dsh-spill-<6 ký tự>` nằm ngay
 * dưới `base` (thư mục tạm của hệ điều hành) mà các lượt chạy gốc-mặc-định trước đã tạo. Một triển
 * khai sống lâu có gốc cấu hình sẽ không thấy cái nào; một chuỗi lượt chạy gốc-mặc-định tích tụ một
 * cái mỗi tiến trình, nên lượt dọn lúc khởi động thu hồi hết. Phép khớp là ĐÚNG hình dạng `mkdtemp`
 * (xem {@link DEFAULT_ROOT_RE}), không phải tiền tố trần, nên một fixture `dsh-spill-test-*` không liên
 * quan hay một thư mục khác hình dạng của công cụ lạ không bao giờ bị quét; symlink và mục không phải
 * thư mục cũng bị loại — chỉ thư mục thật mà backend có thể đã tạo.
 *
 * @param warn Sink cho lỗi đọc `base` (trả `[]` khi đọc hỏng).
 * @param base Thư mục cần quét; mặc định là thư mục tạm của hệ điều hành (một đường may cho test).
 * @returns Đường dẫn tuyệt đối của các gốc mặc định đã dò được (có thể rỗng).
 */
async function discoverDefaultRootRecords(warn: WarnFn, base: string): Promise<{ path: string; identity: string }[]> {
  let entries: string[];
  try {
    entries = await readdir(base);
  } catch (error) {
    warnSafely(warn, `spill-local: failed to scan ${base} for default roots: ${String(error)}`);
    return [];
  }
  const roots: { path: string; identity: string }[] = [];
  for (const name of entries) {
    if (!DEFAULT_ROOT_RE.test(name)) continue;
    const resolved = await resolveRoot(join(base, name), false, warn);
    if (resolved !== undefined) roots.push(resolved);
  }
  return roots;
}

/**
 * Dò các gốc mặc định của những lượt chạy trước dưới thư mục tạm của hệ điều hành.
 * Nhận: sink cho lỗi dò đã chứa; thư mục gốc cần quét (mặc định là thư mục tạm của hệ điều hành).
 * Trả: đường dẫn chuẩn hoá của các gốc mặc định đáng tin.
 */
export async function discoverDefaultRoots(warn: WarnFn, base: string = tmpdir()): Promise<string[]> {
  return (await discoverDefaultRootRecords(warn, base)).map((root) => root.path);
}

/**
 * Gom và khử trùng các gốc đáng tin cho MỘT lượt dọn lúc khởi động. Đường dẫn cấu hình đang hoạt động
 * có thể là symlink; danh tính đã giải của nó ĐÈ LÊN một gốc dò được trùng, nên đích đang sống không
 * bao giờ bị đánh dấu là tỉa-được.
 *
 * @param activeRoot Gốc cấu hình đang hoạt động.
 * @param warn Sink cho lỗi kiểm tra đã chứa.
 * @param defaultRootsBase Thư mục chứa các gốc mặc định của lượt chạy trước.
 * @returns Các gốc đáng tin, với danh tính của gốc đang hoạt động được đánh dấu không-tỉa.
 */
export async function gatherSweepRoots(activeRoot: string, warn: WarnFn, defaultRootsBase: string = tmpdir()): Promise<SweepRoot[]> {
  const [discovered, active] = await Promise.all([discoverDefaultRootRecords(warn, defaultRootsBase), resolveRoot(activeRoot, true, warn)]);
  const roots = new Map<string, SweepRoot>();
  for (const root of discovered) roots.set(root.identity, { path: root.path, pruneWhenEmpty: true });
  if (active !== undefined) roots.set(active.identity, { path: active.path, pruneWhenEmpty: false });
  return [...roots.values()];
}
