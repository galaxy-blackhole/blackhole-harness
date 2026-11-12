/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Thay thế tệp NGUYÊN TỬ ZERO-DEPENDENCY và điều phối người ghi — bản viết lại 1:1
 *      `@galaxy-blackhole/gbh-atomic-write`: `writeFileAtomic` ghi tệp tạm CÙNG THƯ MỤC bằng cờ `wx` với đúng bit
 *      quyền của bên gọi rồi `rename` đè lên đích (người đọc chỉ thấy nội dung CŨ hoặc MỚI trọn vẹn);
 *      `withFileLock` tuần tự hoá người ghi KHÁC TIẾN TRÌNH qua tệp `<file>.lock` tạo bằng `wx`.
 */

import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delayFor } from "node:timers/promises";

/** Lỗi rename TẠM THỜI trên Windows (bị tiến trình khác giữ tay). */
const WINDOWS_TRANSIENT_RENAME_ERRORS: ReadonlySet<string> = new Set(["EACCES", "EBUSY", "EPERM"]);

/** Chờ lần đầu giữa hai lần thử rename trên Windows, mili giây. */
const WINDOWS_RENAME_RETRY_INITIAL_MS = 20;

/** Trần chờ giữa hai lần thử rename trên Windows, mili giây. */
const WINDOWS_RENAME_RETRY_MAX_MS = 200;

/** Số lần thử lại rename trên Windows. */
const WINDOWS_RENAME_RETRY_LIMIT = 8;

/** Bit quyền mặc định cho tệp lock và tệp nhận bàn giao (`0o600`). */
const LOCK_FILE_MODE = 384;

/** Chờ lần đầu giữa hai lần thử lấy lock, mili giây. */
const LOCK_RETRY_INITIAL_MS = 20;

/** Trần chờ giữa hai lần thử lấy lock, mili giây. */
const LOCK_RETRY_MAX_MS = 200;

/** Thời gian chờ mặc định khi bên gọi không nêu giới hạn, mili giây. */
const DEFAULT_LOCK_WAIT_MS = 2000;

/** Bit quyền cho inode thay thế và (tuỳ chọn) cho thư mục cha được tạo. */
export interface AtomicWriteOptions {
  /** Bit quyền của inode THAY THẾ (đi qua rename nên không có cuộc đua `chmod`). */
  readonly mode: number;
  /** Bit quyền cho thư mục cha được tạo (bỏ trống thì theo umask). */
  readonly dirMode?: number;
}

/** Tuỳ chọn lấy khoá người ghi. */
export interface FileLockOptions {
  /** Hạn chờ khoá, mili giây (bỏ trống = `DEFAULT_LOCK_WAIT_MS`). */
  readonly waitMs?: number;
  /** Huỷ việc chờ khoá và/hoặc thao tác bên trong. */
  readonly signal?: AbortSignal;
}

/** Lỗi có mã của Node (`code`) — chỉ đọc trường cần cho quyết định. */
interface CodedError {
  /** Mã lỗi của Node. */
  readonly code?: string;
}

/**
 * Windows có báo va chạm TẠM THỜI khi thay thế nguyên tử hay không.
 * Nhận: lỗi bất kỳ.
 * Trả: true khi đang chạy Windows và mã lỗi thuộc tập tạm thời.
 */
function isTransientWindowsRenameError(error: unknown): boolean {
  if (process.platform !== "win32") return false;
  return WINDOWS_TRANSIENT_RENAME_ERRORS.has((error as CodedError | undefined)?.code ?? "");
}

/**
 * Đổi tên tệp tạm lên đích, với số lần thử CÓ HẠN khi Windows báo va chạm tạm thời.
 * Nhận: đường dẫn tệp tạm và đường dẫn đích.
 * Trả: promise hoàn tất khi đã đổi tên xong; ném lỗi cuối cùng nếu hết lượt thử.
 */
async function renameAtomicTemp(temp: string, filename: string): Promise<void> {
  let delay = WINDOWS_RENAME_RETRY_INITIAL_MS;
  for (let retries = 0; ; retries += 1) {
    try {
      await rename(temp, filename);
      return;
    } catch (error) {
      if (!isTransientWindowsRenameError(error)) throw error;
      if (retries >= WINDOWS_RENAME_RETRY_LIMIT) throw error;
    }
    await delayFor(delay);
    delay = Math.min(delay * 2, WINDOWS_RENAME_RETRY_MAX_MS);
  }
}

/**
 * Thay `filename` bằng `content` trong MỘT bước nguyên tử, có tạo thư mục cha. Nội dung được ghi trước vào
 * tệp anh-em cùng thư mục với hậu tố NGẪU NHIÊN, mở bằng cờ `wx` (từ chối đi theo symlink bị cắm ở đường
 * tạm; inode mới mang đúng `options.mode` nên thay tệp quyền RỘNG hơn sẽ THU HẸP mà không có cuộc đua
 * `chmod`). Rename thay chính ĐÍCH nếu đích là symlink, và anh-em cùng thư mục giữ rename trong MỘT
 * filesystem. Mọi lỗi còn lại ⇒ tệp tạm bị xoá và lỗi được ném lại. `fsync` (bền sau crash) NGOÀI phạm vi.
 * Nhận: đường dẫn đích, nội dung đầy đủ kế tiếp, và bit quyền cho inode thay thế.
 * Trả: promise hoàn tất khi đích đã mang nội dung MỚI.
 */
export async function writeFileAtomic(
  filename: string,
  content: string | Uint8Array,
  options: AtomicWriteOptions,
): Promise<void> {
  await mkdir(dirname(filename), {
    recursive: true,
    ...(options.dirMode === undefined ? {} : { mode: options.dirMode }),
  });
  const temp = filename + "." + randomBytes(6).toString("hex") + ".tmp";
  try {
    await writeFile(temp, content, { mode: options.mode, flag: "wx" });
    await renameAtomicTemp(temp, filename);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

/**
 * Lần tạo `wx` có gặp KHOÁ đang tồn tại hay không.
 * Nhận: lỗi và đường dẫn khoá.
 * Trả: true khi `EEXIST`, hoặc khi `EPERM` và `lstat` xác nhận khoá CÓ THẬT (hành vi Windows).
 */
async function isLockContention(error: unknown, lockPath: string): Promise<boolean> {
  const code = (error as CodedError | undefined)?.code;
  if (code === "EEXIST") return true;
  if (code !== "EPERM") return false;
  try {
    await lstat(lockPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chủ sở hữu mà bản ghi `<pid>\n` nêu đã CHẮC CHẮN không còn hay chưa (thăm dò bằng tín hiệu 0).
 * Nhận: nội dung bản ghi khoá.
 * Trả: true khi bản ghi hợp lệ và tiến trình đó không tồn tại.
 */
function holderExited(record: string): boolean {
  if (!/^\d+\n$/.test(record)) return false;
  const pid = Number(record.trim());
  if (pid === 0 || pid > 2147483647) return false;
  if (pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as CodedError).code === "ESRCH";
  }
}

/**
 * Nội dung tệp khoá, hoặc `undefined` khi không đọc được.
 * Nhận: đường dẫn khoá.
 * Trả: bản ghi, hoặc `undefined`.
 */
async function readLockRecord(lockPath: string): Promise<string | undefined> {
  try {
    return await readFile(lockPath, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Xoá khoá khi chủ sở hữu đã ghi trong đó KHÔNG CÒN tồn tại. Các bên tranh nhau đọc cùng bản ghi sẽ tuần tự
 * hoá trên tệp NHẬN BÀN GIAO đặt tên theo chính bản ghi đó; dưới quyền nhận, bên nhận đọc LẠI khoá và thăm
 * dò PID lần nữa, chỉ xoá khi khoá vẫn mang đúng bản ghi đó và PID đó vẫn mất ⇒ không bao giờ xoá khoá mà
 * bên khác vừa lấy được sau chủ cũ (kể cả trường hợp PID bị tái dùng).
 * Nhận: đường dẫn khoá.
 * Trả: true khi lần gọi này đã xoá khoá của chủ đã chết.
 */
async function takeOverExitedLock(lockPath: string): Promise<boolean> {
  const record = await readLockRecord(lockPath);
  if (record === undefined || !holderExited(record)) return false;
  const claim = lockPath + ".takeover-" + createHash("sha256").update(record).digest("hex").slice(0, 16);
  try {
    await writeFile(claim, process.pid + "\n", { mode: LOCK_FILE_MODE, flag: "wx" });
  } catch (error) {
    const code = (error as CodedError).code;
    if (code === "EEXIST" || code === "EPERM") return false;
    throw error;
  }
  try {
    if ((await readLockRecord(lockPath)) !== record || !holderExited(record)) return false;
    try {
      await rm(lockPath, { force: true });
    } catch {
      return false;
    }
    return true;
  } finally {
    await rm(claim, { force: true }).catch(() => undefined);
  }
}

/**
 * Giữ khoá NGƯỜI GHI liên tiến trình cho `filename` quanh MỘT thao tác. Khoá là tệp anh-em tạo bằng `wx`
 * (`<filename>.lock`); ghép với commit-rename của {@link writeFileAtomic}, người ĐỌC không cần khoá và chỉ
 * người GHI tranh nhau. `EEXIST` là tranh chấp; `EPERM` chỉ là tranh chấp khi `lstat` tươi xác nhận khoá tồn
 * tại. Khoá ghi PID của chủ; bên tranh chấp XOÁ và thử lại ngay khi không có tiến trình mang PID đó
 * (`ESRCH`); khoá khác (chủ còn sống, hoặc bản ghi dở) thì CHỜ. Tranh chấp lùi theo hàm mũ và hết hạn theo
 * hạn chờ. PID được so trên máy của bên tranh chấp ⇒ người ghi ở máy/namespace PID khác dùng chung tệp là
 * KHÔNG được hỗ trợ. Thư mục cha phải tồn tại.
 * Nhận: tệp mà khoá này tuần tự hoá, thao tác đọc-render-commit chạy trong lúc giữ khoá, và tuỳ chọn lấy khoá.
 * Trả: kết quả của thao tác; khoá được nhả trong CẢ hai kết cục.
 */
export async function withFileLock<T>(
  filename: string,
  operation: () => Promise<T>,
  options?: FileLockOptions,
): Promise<T> {
  const lockPath = filename + ".lock";
  const deadline = Date.now() + (options?.waitMs ?? DEFAULT_LOCK_WAIT_MS);
  let delay = LOCK_RETRY_INITIAL_MS;
  let retriedUnconfirmedPermissionError = false;
  for (;;) {
    options?.signal?.throwIfAborted();
    try {
      await writeFile(lockPath, process.pid + "\n", { mode: LOCK_FILE_MODE, flag: "wx" });
      break;
    } catch (error) {
      if (!(await isLockContention(error, lockPath))) {
        if (process.platform !== "win32" || (error as CodedError).code !== "EPERM" || retriedUnconfirmedPermissionError) {
          throw error;
        }
        retriedUnconfirmedPermissionError = true;
      } else if (await takeOverExitedLock(lockPath)) {
        continue;
      }
    }
    if (Date.now() >= deadline) {
      throw new Error("atomic-write: timed out waiting for the writer lock at " + lockPath);
    }
    await delayFor(delay, undefined, { signal: options?.signal });
    delay = Math.min(delay * 2, LOCK_RETRY_MAX_MS);
  }
  try {
    options?.signal?.throwIfAborted();
    return await operation();
  } finally {
    await rm(lockPath, { force: true });
  }
}

/**
 * Alias TEN CONG KHAI cua stock: ban goc xuat WriteFileAtomicOptions, ta dat AtomicWriteOptions.
 * Nhan: khong (chi la alias kieu). Tra: khong - giu cho consumer viet theo ten stock van bien dich duoc.
 */
// 08/11/2026 (dev-1): `AtomicWriteOptions` khai NGAY TRONG tệp này (dòng 42) — trước đây alias trỏ `./types.ts`
// (tệp không tồn tại sau khi gói chỉ còn một module) nên typecheck báo TS2307. Khai alias tại chỗ.
export type WriteFileAtomicOptions = AtomicWriteOptions;
