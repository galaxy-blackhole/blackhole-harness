/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lệnh `view` NGUYÊN VĂN của @deepseek-ai/dsh-tool-str-replace-editor: định dạng tệp có số dòng, liệt kê thư mục 2 mức, và mọi nhánh lỗi `view_range`.
 */

import type { EditorContext, EditorExec, EditorTarget } from "./seams.ts";
import { maybeTruncate, codepointCompare } from "./text.ts";
import { resolveTarget, statExisting } from "./targets.ts";
import { FsError } from "@deepseek-ai/dsh-fs";

/**
 * Định dạng nội dung tệp kèm số dòng (đệm 6 ký tự) và áp `view_range` — NGUYÊN VĂN bản gốc.
 * Nhận: path — đường dẫn hiển thị; content — toàn văn tệp; maxOutputChars — ngưỡng cắt; viewRange — khoảng dòng tuỳ chọn.
 * Trả: khối văn bản "Here's the content of …" đã cắt theo ngưỡng.
 * @throws {Error} khi `view_range` sai hình dạng/khoảng — bốn thông điệp NGUYÊN VĂN của bản gốc.
 */
export function formatFileView(path: string, content: string, maxOutputChars: number, viewRange?: readonly number[]): string {
  const allLines = content.split("\n");
  let lines = allLines;
  let initialLine = 1;
  let finalLine: number | undefined;
  let prompt = `Here's the content of ${path} with line numbers (which has a total of ${allLines.length} lines)`;
  if (viewRange !== void 0) {
    const [requestedInitialLine, requestedFinalLine] = viewRange;
    if (viewRange.length !== 2 || requestedInitialLine === void 0 || requestedFinalLine === void 0 || !viewRange.every(Number.isInteger)) throw new Error("Invalid \`view_range\`. It should be a list of two integers.");
    initialLine = requestedInitialLine;
    finalLine = requestedFinalLine;
    if (initialLine < 1 || initialLine > allLines.length) throw new Error(`Invalid \`view_range\`: [${viewRange.join(", ")}]. Its first element \`${initialLine}\` should be within the range of lines of the file: [1, ${allLines.length}]`);
    if (finalLine > allLines.length) throw new Error(`Invalid \`view_range\`: [${viewRange.join(", ")}]. Its second element \`${finalLine}\` should be smaller than the number of lines in the file: \`${allLines.length}\``);
    if (finalLine !== -1 && finalLine < initialLine) throw new Error(`Invalid \`view_range\`: [${viewRange.join(", ")}]. Its second element \`${finalLine}\` should be larger or equal than its first \`${initialLine}\``);
    lines = finalLine === -1 ? allLines.slice(initialLine - 1) : allLines.slice(initialLine - 1, finalLine);
    prompt += ` with view_range=[${initialLine}, ${finalLine}]`;
  }
  const numbered = lines.map((line, index) => `${String(initialLine + index).padStart(6, " ")}  ${line}`).join("\n");
  return maybeTruncate(`${prompt}:\n${numbered}\n`, maxOutputChars);
}

/**
 * Liệt kê thư mục tới 2 mức, bỏ mục ẩn/node_modules/__pycache__, sắp theo codepoint đường dẫn — NGUYÊN VĂN bản gốc.
 * Nhận: ctx — context plugin; target — đích thư mục; maxOutputChars — ngưỡng cắt; exec — ngữ cảnh thực thi.
 * Trả: khối văn bản "Here're the files and directories …" đã cắt theo ngưỡng.
 */
export async function listDirectory(ctx: EditorContext, target: EditorTarget, maxOutputChars: number, exec: EditorExec): Promise<string> {
  async function visit(dir: EditorTarget, depth: number): Promise<string[]> {
    const entries = await ctx.fs.listDir(dir, exec.signal);
    const rows: string[] = [];
    for (const entry of entries.filter((candidate) => !candidate.name.startsWith(".") && candidate.name !== "node_modules" && candidate.name !== "__pycache__")) {
      const type = entry.type === "directory" ? "d" : entry.type === "file" ? "f" : "?";
      rows.push(`${type}\t${entry.target.displayPath}`);
      if (entry.type === "directory" && depth < 2) rows.push(...await visit(entry.target, depth + 1));
    }
    return rows;
  }
  const rows = [`d\t${target.displayPath}`, ...await visit(target, 1)];
  rows.sort((left, right) => {
    return codepointCompare(left.slice(left.indexOf("\t") + 1), right.slice(right.indexOf("\t") + 1));
  });
  const listing = maybeTruncate(rows.join("\n") + "\n", maxOutputChars);
  return `Here're the files and directories up to 2 levels deep in ${target.displayPath}, excluding hidden items, node_modules, and Python cache directories:\n${listing}\n`;
}

/**
 * Thực thi lệnh `view` trên tệp hoặc thư mục — NGUYÊN VĂN bản gốc (phát `fs/observed` kind present khi đọc tệp).
 * Nhận: ctx — context plugin; path — đường dẫn mô hình; viewRange — khoảng dòng tuỳ chọn; maxOutputChars — ngưỡng cắt; exec — ngữ cảnh thực thi.
 * Trả: khối văn bản của tệp hoặc của danh sách thư mục.
 * @throws {Error} khi `view_range` đi cùng thư mục — NGUYÊN VĂN thông điệp bản gốc.
 * @throws {FsError} `FS_NOT_REGULAR_FILE` khi đích không phải tệp thường.
 */
export async function viewPath(ctx: EditorContext, path: string, viewRange: readonly number[] | undefined, maxOutputChars: number, exec: EditorExec): Promise<string> {
  const target = await resolveTarget(ctx, path, exec.signal);
  const info = await statExisting(ctx, target, "view", exec);
  if (info.type === "directory") {
    if (viewRange !== void 0) throw new Error("The \`view_range\` parameter is not allowed when \`path\` points to a directory.");
    return listDirectory(ctx, target, maxOutputChars, exec);
  }
  if (info.type !== "file") throw new FsError(`cannot view "${target.displayPath}": not a regular file or directory`, "FS_NOT_REGULAR_FILE");
  const content = await ctx.fs.readText(target, exec.signal);
  ctx.emit("fs/observed", target, {
    kind: "present",
    version: info.version
  }, exec);
  return formatFileView(target.displayPath, content, maxOutputChars, viewRange);
}
