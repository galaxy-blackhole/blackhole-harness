/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-worktree — xuất ĐÚNG bề mặt bản gốc trên ARTIFACT
 *      (lớp WorktreeService + default, cùng một lớp); ba kiểu công khai của bản gốc được xuất kiểu.
 */

import { WorktreeService } from "./service.ts";

export { WorktreeService };
export type { Config, CreateWorktreeRequest, CreatedWorktree } from "./types.ts";

export default WorktreeService;
