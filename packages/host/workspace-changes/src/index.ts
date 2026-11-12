/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mặt vào của gói workspace-changes: export ĐÚNG bốn tên như bản gốc (name · inject · Config · apply)
 *      và tái xuất các kiểu của mặt ./types
 */

export { apply, Config, inject, name } from "./plugin.ts";
export type {
  WorkspaceChangedFile,
  WorkspaceChanges,
  WorkspaceChangesSummary,
  WorkspaceDiffHunk,
  WorkspaceFileDiff,
} from "./types.ts";
