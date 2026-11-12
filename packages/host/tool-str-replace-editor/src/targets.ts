/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ba bước chuẩn bị NGUYÊN VĂN của @deepseek-ai/dsh-tool-str-replace-editor: chuẩn hoá đích tuyệt đối, thống kê đích đang tồn tại, và đòi tham số bắt buộc theo lệnh.
 */

import { isAbsolute } from "node:path";
import { FsError } from "@deepseek-ai/dsh-fs";

import type { EditorContext, EditorExec, EditorInfo, EditorTarget } from "./seams.ts";

/**
 * Chuẩn hoá đường dẫn mô hình thành đích fs, từ chối đường dẫn rỗng/tương đối — NGUYÊN VĂN bản gốc.
 * Nhận: ctx — context plugin; path — đường dẫn mô hình; signal — tín hiệu huỷ.
 * Trả: đích fs đã chuẩn hoá.
 * @throws {Error} khi `path` rỗng hoặc không tuyệt đối — nguyên văn hai thông điệp của bản gốc.
 */
export async function resolveTarget(ctx: EditorContext, path: string, signal: AbortSignal): Promise<EditorTarget> {
  if (path.trim().length === 0) throw new Error("path must be a non-empty string");
  if (!isAbsolute(path)) throw new Error(`The path ${path} is not an absolute path, it should start with \`/\`. Maybe you meant /${path}?`);
  return ctx.fs.resolve(path, { signal });
}

/**
 * Thống kê đích và từ chối sớm khi vắng/thư mục sai lệnh — NGUYÊN VĂN bản gốc (phát `fs/observed` kind absent).
 * Nhận: ctx — context plugin; target — đích fs; command — lệnh đang chạy; exec — ngữ cảnh thực thi.
 * Trả: thông tin mục đang tồn tại.
 * @throws {FsError} `FS_NOT_FOUND` khi vắng, `FS_NOT_REGULAR_FILE` khi là thư mục mà lệnh khác `view`.
 */
export async function statExisting(ctx: EditorContext, target: EditorTarget, command: string, exec: EditorExec): Promise<EditorInfo> {
  const info = await ctx.fs.stat(target, exec.signal);
  if (info === void 0) {
    ctx.emit("fs/observed", target, { kind: "absent" }, exec);
    throw new FsError(`The path ${target.displayPath} does not exist. Please provide a valid path.`, "FS_NOT_FOUND");
  }
  if (info.type === "directory" && command !== "view") throw new FsError(`The path ${target.displayPath} is a directory and only the \`view\` command can be used on directories`, "FS_NOT_REGULAR_FILE");
  return info;
}

/**
 * Đòi một tham số có mặt (và khác rỗng khi `allowEmpty` false) — NGUYÊN VĂN bản gốc.
 * Nhận: value — giá trị tham số; parameter — tên tham số; command — lệnh đang chạy; allowEmpty — có cho phép chuỗi rỗng.
 * Trả: chính giá trị đã kiểm.
 * @throws {Error} khi thiếu, hoặc rỗng mà `allowEmpty` false — nguyên văn hai thông điệp của bản gốc.
 */
export function requiredForCommand(value: string | undefined, parameter: string, command: string, allowEmpty = true): string {
  if (value === void 0) throw new Error(`Parameter \`${parameter}\` is required for command: ${command}`);
  if (!allowEmpty && value.length === 0) throw new Error(`Parameter \`${parameter}\` is empty for command: ${command}`);
  return value;
}
