/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-working-directory — export ĐÚNG tập export của bản gốc
 *      (`WorkingDirectoryService` và `default`, cùng một lớp), cho row working-directory của DSH.
 */

import { WorkingDirectoryService } from "./service.ts";

export { WorkingDirectoryService };
export type { Config } from "./service.ts";

export default WorkingDirectoryService;
