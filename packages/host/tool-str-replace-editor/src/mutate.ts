/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ba lệnh ghi NGUYÊN VĂN của @deepseek-ai/dsh-tool-str-replace-editor: `create`, `str_replace`, `insert` — giữ nguyên thứ tự kiểm, intent ghi và mọi chuỗi lỗi.
 */

import { FsError } from "@deepseek-ai/dsh-fs";

import type { MutationPolicy } from "./mutation-policy.ts";
import type { EditorContext, EditorExec, EditorInfo } from "./seams.ts";
import { requiredForCommand, resolveTarget, statExisting } from "./targets.ts";
import { lineNumbersAt, matchOffsets } from "./text.ts";

/**
 * Tạo tệp mới, từ chối ghi đè — NGUYÊN VĂN bản gốc (waterfall `fs/write-intent` mặc định `createIfAbsent`).
 * Nhận: ctx — context plugin; policy — chính sách đột biến; path — đường dẫn mô hình; fileText — nội dung tệp; exec — ngữ cảnh thực thi.
 * Trả: chuỗi "New file created successfully at: …".
 * @throws {Error} khi thiếu `file_text` hoặc tệp đã tồn tại — NGUYÊN VĂN thông điệp bản gốc.
 */
export async function createFile(ctx: EditorContext, policy: MutationPolicy, path: string, fileText: string | undefined, exec: EditorExec): Promise<string> {
  const content = requiredForCommand(fileText, "file_text", "create");
  const sandboxPolicy = policy.resolve(exec);
  const target = await resolveTarget(ctx, path, exec.signal);
  if (await ctx.fs.stat(target, exec.signal) !== void 0) throw new Error(`File already exists at: ${target.displayPath}. Cannot overwrite files using command \`create\`.`);
  const intent = await ctx.waterfall("fs/write-intent", target, exec, () => ({ kind: "createIfAbsent" }));
  let outcome: EditorInfo;
  try {
    outcome = await ctx.fs.writeText(target, content, intent, exec.signal, sandboxPolicy);
  } catch (error) {
    throw policy.mapError(error, sandboxPolicy);
  }
  ctx.emit("fs/observed", target, {
    kind: "present",
    version: outcome.version
  }, exec);
  return `New file created successfully at: ${target.displayPath}`;
}

/**
 * Thay MỘT lần xuất hiện duy nhất của `old_str` — NGUYÊN VĂN bản gốc (waterfall `fs/edit-intent`, ghi `replaceIfVersion`).
 * Nhận: ctx — context plugin; policy — chính sách đột biến; path — đường dẫn mô hình; oldStr — chuỗi cần thay; newStr — chuỗi thay thế; exec — ngữ cảnh thực thi.
 * Trả: chuỗi "The file … has been edited successfully.".
 * @throws {Error} khi `new_str` là null hoặc `old_str` thiếu/rỗng — NGUYÊN VĂN thông điệp bản gốc.
 * @throws {FsError} `FS_EDIT_NOT_FOUND`/`FS_AMBIGUOUS_EDIT`/`FS_NOT_REGULAR_FILE` — NGUYÊN VĂN bản gốc.
 */
export async function replaceInFile(ctx: EditorContext, policy: MutationPolicy, path: string, oldStr: string | undefined, newStr: string | null | undefined, exec: EditorExec): Promise<string> {
  if (newStr === null) throw new Error("Parameter \`new_str\` must be omitted or contain a string for command: str_replace");
  const sandboxPolicy = policy.resolve(exec);
  const target = await resolveTarget(ctx, path, exec.signal);
  const intent = await ctx.waterfall("fs/edit-intent", target, exec, () => void 0);
  const oldValue = requiredForCommand(oldStr, "old_str", "str_replace", false);
  const newValue = newStr ?? "";
  const info = await statExisting(ctx, target, "str_replace", exec);
  if (info.type !== "file") throw new FsError(`cannot edit "${target.displayPath}": not a regular file`, "FS_NOT_REGULAR_FILE");
  const before = await ctx.fs.readText(target, exec.signal);
  const offsets = matchOffsets(before, oldValue);
  const offset = offsets[0];
  if (offset === void 0) throw new FsError(`No replacement was performed, old_str \`${oldValue}\` did not appear verbatim in ${target.displayPath}.`, "FS_EDIT_NOT_FOUND");
  if (offsets.length > 1) throw new FsError(`No replacement was performed. Multiple occurrences of old_str \`${oldValue}\` in lines [${lineNumbersAt(before, offsets).join(", ")}]. Please ensure it is unique`, "FS_AMBIGUOUS_EDIT");
  let outcome: EditorInfo;
  try {
    outcome = await ctx.fs.writeText(target, before.slice(0, offset) + newValue + before.slice(offset + oldValue.length), intent === void 0 ? {
      kind: "replaceIfVersion",
      version: info.version
    } : {
      kind: "replaceIfVersion",
      version: intent.version
    }, exec.signal, sandboxPolicy);
  } catch (error) {
    throw policy.mapError(error, sandboxPolicy);
  }
  ctx.emit("fs/observed", target, {
    kind: "present",
    version: outcome.version
  }, exec);
  return `The file ${target.displayPath} has been edited successfully.`;
}

/**
 * Chèn `new_str` SAU dòng `insert_line` — NGUYÊN VĂN bản gốc (waterfall `fs/edit-intent`, ghi `replaceIfVersion`).
 * Nhận: ctx — context plugin; policy — chính sách đột biến; path — đường dẫn mô hình; insertLine — dòng chèn (0-based, sau dòng này); newStr — chuỗi chèn; exec — ngữ cảnh thực thi.
 * Trả: chuỗi "The file … has been edited successfully.".
 * @throws {Error} khi thiếu `insert_line`/`new_str` hoặc `insert_line` ngoài khoảng — NGUYÊN VĂN thông điệp bản gốc.
 * @throws {FsError} `FS_NOT_FOUND`/`FS_NOT_REGULAR_FILE` — NGUYÊN VĂN bản gốc.
 */
export async function insertInFile(ctx: EditorContext, policy: MutationPolicy, path: string, insertLine: number | undefined, newStr: string | undefined, exec: EditorExec): Promise<string> {
  if (insertLine === void 0) throw new Error("Parameter \`insert_line\` is required for command: insert");
  const value = requiredForCommand(newStr, "new_str", "insert");
  const sandboxPolicy = policy.resolve(exec);
  const target = await resolveTarget(ctx, path, exec.signal);
  const intent = await ctx.waterfall("fs/edit-intent", target, exec, () => void 0);
  const info = await statExisting(ctx, target, "insert", exec);
  if (info.type !== "file") throw new FsError(`cannot insert into "${target.displayPath}": not a regular file`, "FS_NOT_REGULAR_FILE");
  const lines = (await ctx.fs.readText(target, exec.signal)).split("\n");
  if (!Number.isInteger(insertLine) || insertLine < 0 || insertLine > lines.length) throw new Error(`Invalid \`insert_line\` parameter: ${insertLine}. It should be within the range of lines of the file: [0, ${lines.length}]`);
  const after = [
    ...lines.slice(0, insertLine),
    ...value.split("\n"),
    ...lines.slice(insertLine)
  ].join("\n");
  const expected = intent === void 0 ? {
    kind: "replaceIfVersion",
    version: info.version
  } : {
    kind: "replaceIfVersion",
    version: intent.version
  };
  let outcome: EditorInfo;
  try {
    outcome = await ctx.fs.writeText(target, after, expected, exec.signal, sandboxPolicy);
  } catch (error) {
    throw policy.mapError(error, sandboxPolicy);
  }
  ctx.emit("fs/observed", target, {
    kind: "present",
    version: outcome.version
  }, exec);
  return `The file ${target.displayPath} has been edited successfully.`;
}
