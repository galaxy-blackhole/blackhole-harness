/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc NỬA HOST của row typert: sổ đăng ký lúc chạy cho reflection Typert đã sinh, lời gọi Remote, và các nhà
 *      cung cấp tra cứu/Context/kiểu tài nguyên mà Gateway cùng các gói nghiệp vụ gọi vào. Nguồn đối
 *      chiếu: README.md của package (G4).
 */

export { TypertRegistry } from "./service.ts";
export { TypertRegistry as default } from "./service.ts";
export { typertEndpoint, typertKey, typertPackageKey } from "./stores.ts";
export type * from "./types.ts";
