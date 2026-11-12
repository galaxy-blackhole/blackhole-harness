/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Đăng ký công cụ `str_replace_editor` NGUYÊN VĂN của @deepseek-ai/dsh-tool-str-replace-editor: schema tham số, schema đầu ra, bốn nhánh execute và presentCall.
 */

import { defineTool } from "@galaxy-blackhole/gbh-host-tools";

import { MutationPolicy } from "./mutation-policy.ts";
import { createFile, insertInFile, replaceInFile } from "./mutate.ts";
import { presentEditorCall } from "./present.ts";
import type { EditorContext, EditorExec } from "./seams.ts";
import { viewPath } from "./view.ts";

/** Cấu hình ĐÃ chuẩn hoá mà `registerStrReplaceEditor` nhận (mặc định đã điền). */
export interface ResolvedEditorConfig {
  /** Ngưỡng ký tự trước khi cắt kết quả. */
  readonly maxOutputChars: number;
  /** Mô tả hướng mô hình. */
  readonly description: string;
}

/**
 * Đăng ký công cụ `str_replace_editor` trên `ctx.tools` với schema tham số NGUYÊN VĂN bản gốc.
 * Nhận: ctx — context plugin mang `tools`/`fs`; config — cấu hình đã chuẩn hoá.
 * Trả: không.
 */
export function registerStrReplaceEditor(ctx: EditorContext, config: ResolvedEditorConfig): void {
  const policy = new MutationPolicy(ctx);
  ctx.tools.register(defineTool({
    name: "str_replace_editor",
    description: config.description,
    parameters: {
      command: {
        type: "string",
        required: true,
        enum: [
          "view",
          "create",
          "str_replace",
          "insert"
        ],
        description: "The commands to run. Allowed options are: \`view\`, \`create\`, \`str_replace\`, \`insert\`."
      },
      path: {
        type: "string",
        required: true,
        description: "Absolute path to file or directory, e.g. \`/repo/file.py\` or \`/repo\`."
      },
      file_text: {
        oneOf: [{ type: "string" }, { type: "null" }],
        description: "Required string parameter of \`create\` command, with the content of the file to be created. A null placeholder is treated as omitted by commands that do not use this parameter."
      },
      insert_line: {
        oneOf: [{ type: "integer" }, { type: "null" }],
        description: "Required integer parameter of \`insert\` command. The \`new_str\` will be inserted AFTER the line \`insert_line\` of \`path\`. A null placeholder is treated as omitted by commands that do not use this parameter."
      },
      new_str: {
        oneOf: [{ type: "string" }, { type: "null" }],
        description: "Optional string parameter of \`str_replace\` command containing the new string (if omitted, no string will be added). Required string parameter of \`insert\` command containing the string to insert. A null placeholder is accepted only by commands that do not use this parameter."
      },
      old_str: {
        oneOf: [{ type: "string" }, { type: "null" }],
        description: "Required string parameter of \`str_replace\` command containing the string in \`path\` to replace. A null placeholder is treated as omitted by commands that do not use this parameter."
      },
      view_range: {
        oneOf: [{
          type: "array",
          items: { type: "integer" }
        }, { type: "null" }],
        description: "Optional parameter of \`view\` command when \`path\` points to a file. If omitted or null, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting \`[start_line, -1]\` shows all lines from \`start_line\` to the end of the file."
      }
    },
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{
        type: "text",
        text: value
      }]
    },
    async execute(args, exec) {
      const editorExec = exec as unknown as EditorExec;
      switch (args.command) {
        case "view": return viewPath(ctx, args.path, args.view_range ?? void 0, config.maxOutputChars, editorExec);
        case "create": return createFile(ctx, policy, args.path, args.file_text ?? void 0, editorExec);
        case "str_replace": return replaceInFile(ctx, policy, args.path, args.old_str ?? void 0, args.new_str, editorExec);
        case "insert": return insertInFile(ctx, policy, args.path, args.insert_line ?? void 0, args.new_str ?? void 0, editorExec);
      }
    },
    presentCall: presentEditorCall
  }));
}
