/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-account-platform: phơi ĐÚNG ba tên như bản gốc —
 *      Config (schema schemastery), PlatformAccount, và PlatformAccount làm default; kèm kiểu Config
 *      của deployment từ ./types.ts.
 *      Export: Config · PlatformAccount (+ default).
 */

export { Config, PlatformAccount } from "./platform.ts";
export { PlatformAccount as default } from "./platform.ts";
