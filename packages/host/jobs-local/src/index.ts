/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào plugin của row jobs: đăng ký nhà cung cấp `ctx.jobs` cục bộ trong tiến trình
 *      (bản viết lại của @deepseek-ai/dsh-jobs-local). MỘT bundle — MỘT id, và ở đây là row HOST
 *      thuần nên bundle KHÔNG đăng ký id module nào.
 */

/**
 * Nhà cung cấp cục bộ trong tiến trình cho seam năng lực job nền (`ctx.jobs`): nó giữ mọi job —
 * trạng thái vòng đời, vòng đệm đầu ra có chặn, và con trỏ của model — trong bộ nhớ, và chỉ trao ra
 * bản chiếu mới cùng bản sao chunk, không bao giờ trao trạng thái sống.
 *
 * Đăng ký sống lâu hơn fiber của producer và controller. Việc huỷ agent hoặc service sẽ huỷ công
 * việc đang chạy và chờ producer tuân thủ; một cancel ném lỗi lúc dọn dẹp chỉ ép hỏng ĐÚNG bản ghi
 * đó và báo khả năng còn tiến trình mồ côi.
 * @module @galaxy-blackhole/gbh-jobs-local
 */
export { LocalJobRegistry, TASK_WAIT_TIMEOUT } from "./registry.ts";
export type { Config } from "./registry.ts";
export { LocalJobRegistry as default } from "./registry.ts";
