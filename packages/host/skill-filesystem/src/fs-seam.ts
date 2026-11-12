/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Seam CẤU TRÚC giữa provider và dịch vụ filesystem — port NGUYÊN VĂN bundle gốc
 *      @galaxy-blackhole/gbh-skill-filesystem: đọc text/list root qua ctx.fs khi CÓ service, fallback
 *      Node khi THIẾU service; findProjectRoot dò .git; mọi nhánh lỗi ENOENT/ENOTDIR/
 *      FS_NOT_FOUND/FS_NOT_DIRECTORY/FS_NOT_TEXT giữ nguyên thứ tự kiểm và chuỗi cảnh báo.
 *      Không augment module: chỉ dùng kiểu FileSystem/FsTarget/FsDirEntry của gói stock.
 */

import { access, readFile, readdir, realpath, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { dirname, join } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import type { FileSystem, FsDirEntry, FsInfo, FsTarget } from "@galaxy-blackhole/gbh-fs";
import type { SkillRoot } from "./config.ts";
import { errorMessage, hasErrorCode, isAbsentSkillPathError } from "./errors.ts";

/**
 * Một mục trực tiếp trong root kỹ năng sau khi chuẩn hoá từ Node hoặc ctx.fs.
 * Nhận: không (chỉ là kiểu).
 * Trả: hình dạng `{ name, type, path }` cho `discoverRoot`.
 */
export interface SkillRootEntry {
  /** Tên tệp/thư mục con. */
  name: string;
  /** Loại mục: thư mục, tệp thường, hoặc khác. */
  type: "file" | "directory" | "other";
  /** Đường dẫn đầy đủ của mục. */
  path: string;
}

/**
 * Nội dung một tệp kỹ năng đã đọc được.
 * Nhận: không (chỉ là kiểu).
 * Trả: hình dạng `{ path, content }` do `readSkillText` sinh ra.
 */
export interface SkillText {
  /** Đường dẫn đã phân giải (realpath khi đọc bằng Node, processPath khi đọc qua ctx.fs). */
  path: string;
  /** Toàn bộ nội dung UTF-8. */
  content: string;
}

/**
 * Lấy dịch vụ filesystem nếu context có cung cấp — đây là điểm "THIẾU SERVICE" của bản gốc:
 * `ctx.get("fs")` trả undefined thì mọi đường đọc chuyển sang Node.
 * Nhận: ctx — context cordis.
 * Trả: FileSystem khi có, ngược lại undefined.
 */
export function optionalFileSystem(ctx: Context): FileSystem | undefined {
  return ctx.get("fs");
}

/**
 * Liệt kê các mục trực tiếp của một root kỹ năng — ưu tiên ctx.fs, trừ root do host tin cậy.
 * Nhận: root — root kỹ năng; ctx — context cordis.
 * Trả: mảng {@link SkillRootEntry} (rỗng khi root vắng mặt).
 * @throws {unknown} lỗi không phải "vắng mặt" từ ctx.fs/Node.
 */
export async function listSkillRootEntries(root: SkillRoot, ctx: Context): Promise<SkillRootEntry[]> {
  const fs = optionalFileSystem(ctx);
  if (fs !== undefined && root.trustedHost !== true) return await listSkillRootEntriesFromFileSystem(root, fs);
  return await listSkillRootEntriesFromNode(root, ctx);
}

/**
 * Đọc một tệp kỹ năng thành text — bản gốc chọn ctx.fs khi có service và không phải root tin cậy,
 * ngược lại dùng realpath + readFile của Node.
 * Nhận: ctx — context cordis; path — đường dẫn tệp; signal — tín hiệu huỷ; trustedHost — bỏ qua ctx.fs.
 * Trả: {@link SkillText} khi đọc được, undefined khi tệp vắng mặt/không phải tệp text.
 * @throws {unknown} lỗi không phải "vắng mặt"/FS_NOT_TEXT; AbortError khi signal đã huỷ.
 */
export async function readSkillText(
  ctx: Context,
  path: string,
  signal?: AbortSignal,
  trustedHost = false,
): Promise<SkillText | undefined> {
  signal?.throwIfAborted();
  const fs = optionalFileSystem(ctx);
  if (fs !== undefined && !trustedHost) return await readSkillTextFromFileSystem(ctx, fs, path, signal);
  try {
    const resolvedPath = await realpath(path);
    return {
      path: resolvedPath,
      content: await readFile(resolvedPath, { encoding: "utf8", signal }),
    };
  } catch (error) {
    signal?.throwIfAborted();
    if (isAbsentSkillPathError(error)) return undefined;
    throw error;
  }
}

/**
 * Dò ngược từ cwd lên trên để tìm thư mục gốc dự án (nơi có `.git`), dùng ctx.fs nếu có.
 * Nhận: cwd — thư mục bắt đầu; fs — dịch vụ filesystem hoặc undefined.
 * Trả: đường dẫn thư mục dự án, hoặc chính cwd khi lên tới gốc filesystem mà không thấy.
 */
export async function findProjectRoot(cwd: string, fs: FileSystem | undefined): Promise<string> {
  let current = cwd;
  while (true) {
    if (await pathExists(join(current, ".git"), fs)) return current;
    const parent = dirname(current);
    if (parent === current) return cwd;
    current = parent;
  }
}

/**
 * Liệt kê root qua ctx.fs; root vắng mặt trả mảng rỗng.
 * Nhận: root — root kỹ năng; fs — dịch vụ filesystem.
 * Trả: mảng {@link SkillRootEntry}.
 * @throws {unknown} lỗi không phải "vắng mặt".
 */
async function listSkillRootEntriesFromFileSystem(root: SkillRoot, fs: FileSystem): Promise<SkillRootEntry[]> {
  try {
    return (await fsListDir(fs, root.path)).map(entryFromFs);
  } catch (error) {
    if (isAbsentSkillPathError(error)) return [];
    throw error;
  }
}

/**
 * Resolve rồi list một thư mục qua ctx.fs (giữ đúng hai bước của bản gốc).
 * Nhận: fs — dịch vụ filesystem; path — đường dẫn cần list.
 * Trả: mảng FsDirEntry của thư mục.
 */
async function fsListDir(fs: FileSystem, path: string): Promise<FsDirEntry[]> {
  const target = await fs.resolve(path);
  return await fs.listDir(target);
}

/**
 * Đổi một FsDirEntry thành {@link SkillRootEntry} (đường dẫn hiển thị của target).
 * Nhận: entry — mục do ctx.fs trả.
 * Trả: mục chuẩn hoá cho provider.
 */
function entryFromFs(entry: FsDirEntry): SkillRootEntry {
  return {
    name: entry.name,
    type: entry.type,
    path: entry.target.displayPath,
  };
}

/**
 * Liệt kê root bằng Node khi thiếu ctx.fs (hoặc root tin cậy), giữ nguyên thứ tự và xử lý symlink.
 * Nhận: root — root kỹ năng; ctx — context cordis (để cảnh báo).
 * Trả: mảng {@link SkillRootEntry} (rỗng khi root vắng mặt).
 * @throws {unknown} lỗi readdir không phải "vắng mặt".
 */
async function listSkillRootEntriesFromNode(root: SkillRoot, ctx: Context): Promise<SkillRootEntry[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(root.path, {
      withFileTypes: true,
      encoding: "utf8",
    });
  } catch (error) {
    if (isAbsentSkillPathError(error)) return [];
    throw error;
  }
  const result: SkillRootEntry[] = [];
  for (const entry of entries) {
    const path = join(root.path, entry.name);
    const type = await nodeEntryKind(path, entry, ctx);
    result.push({
      name: entry.name,
      type: type ?? "other",
      path,
    });
  }
  return result;
}

/**
 * Đọc tệp qua ctx.fs theo đúng chuỗi resolve → stat → processPath/readText của bản gốc.
 * Nhận: ctx — context cordis; fs — dịch vụ filesystem; path — đường dẫn; signal — tín hiệu huỷ.
 * Trả: {@link SkillText} khi là tệp text, undefined khi vắng mặt/không phải tệp/FS_NOT_TEXT.
 * @throws {unknown} lỗi không phải các mã đã xử lý; AbortError khi signal đã huỷ.
 */
async function readSkillTextFromFileSystem(
  ctx: Context,
  fs: FileSystem,
  path: string,
  signal?: AbortSignal,
): Promise<SkillText | undefined> {
  signal?.throwIfAborted();
  let target: FsTarget;
  try {
    target = await fs.resolve(path);
  } catch (error) {
    if (isAbsentSkillPathError(error)) return undefined;
    throw error;
  }
  signal?.throwIfAborted();
  let info: FsInfo | undefined;
  try {
    info = await fs.stat(target, signal);
  } catch (error) {
    signal?.throwIfAborted();
    if (isAbsentSkillPathError(error)) return undefined;
    throw error;
  }
  if (info === undefined || info.type !== "file") return undefined;
  try {
    return {
      path: fs.processPath(target),
      content: await fs.readText(target, signal),
    };
  } catch (error) {
    signal?.throwIfAborted();
    if (isAbsentSkillPathError(error)) return undefined;
    if (!hasErrorCode(error, "FS_NOT_TEXT")) throw error;
    ctx.logger.warn(`skill file ${path} ignored: ${fsReadErrorMessage(target, error)}`);
    return undefined;
  }
}

/**
 * Dựng thông điệp lỗi đọc text y nguyên bản gốc.
 * Nhận: target — target đã resolve; error — lỗi gốc.
 * Trả: chuỗi "failed to read text file at <displayPath>: <error>".
 */
function fsReadErrorMessage(target: FsTarget, error: unknown): string {
  return `failed to read text file at ${target.displayPath}: ${errorMessage(error)}`;
}

/**
 * Phân loại một mục readdir của Node, đi theo symlink đúng một lần như bản gốc.
 * Nhận: fullPath — đường dẫn đầy đủ; entry — Dirent; ctx — context để cảnh báo.
 * Trả: "directory" | "file", hoặc undefined khi là mục đặc biệt/không theo được.
 */
async function nodeEntryKind(
  fullPath: string,
  entry: Dirent,
  ctx: Context,
): Promise<SkillRootEntry["type"] | undefined> {
  if (entry.isDirectory()) return "directory";
  if (entry.isFile()) return "file";
  if (!entry.isSymbolicLink()) return undefined;
  try {
    const info = await stat(fullPath);
    if (info.isDirectory()) return "directory";
    if (info.isFile()) return "file";
    return undefined;
  } catch (error) {
    ctx.logger.warn(`skill entry ${fullPath} ignored: failed to follow symbolic link: ${errorMessage(error)}`);
    return undefined;
  }
}

/**
 * Kiểm một đường dẫn có tồn tại hay không, qua ctx.fs nếu có.
 * Nhận: path — đường dẫn cần kiểm; fs — dịch vụ filesystem hoặc undefined.
 * Trả: true khi tồn tại.
 */
async function pathExists(path: string, fs: FileSystem | undefined): Promise<boolean> {
  if (fs !== undefined) return await pathExistsInFileSystem(path, fs);
  return await pathExistsInNode(path);
}

/**
 * Kiểm tồn tại qua ctx.fs (resolve + stat), nuốt mọi lỗi thành false như bản gốc.
 * Nhận: path — đường dẫn; fs — dịch vụ filesystem.
 * Trả: true khi resolve và stat đều thành công.
 */
async function pathExistsInFileSystem(path: string, fs: FileSystem): Promise<boolean> {
  let target: FsTarget;
  try {
    target = await fs.resolve(path);
  } catch {
    return false;
  }
  try {
    return (await fs.stat(target)) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Kiểm tồn tại bằng `access` của Node.
 * Nhận: path — đường dẫn.
 * Trả: true khi access thành công, ngược lại false.
 */
async function pathExistsInNode(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
