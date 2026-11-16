/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 16/11/2026
 * desc Tao lien ket THU MUC chay duoc tren moi he: Windows khong cho symlink thu muc neu thieu quyen
 *      (EPERM) nhung JUNCTION thi khong can quyen. 16/11/2026: loi Windows that — profile thieu
 *      @galaxy-blackhole/gbh-brand, gbh-typert-protocol, gbh-cordis-plugin-timer ⇒ 4 plugin khong
 *      activate ⇒ harness khong in URL.
 */

import { symlinkSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Tao lien ket thư mục từ `source` tới `link`, chọn kiểu phù hợp với hệ điều hành.
 *
 * @param source - thư mục đích (thật) của liên kết.
 * @param link - đường dẫn liên kết cần tạo.
 * @remarks Windows chỉ tạo được **junction** khi không có quyền Administrator/Developer Mode; symlink
 * thư mục sẽ ném EPERM và trước 16/11/2026 lỗi đó bị `catch {}` nuốt ⇒ profile thiếu gói ⇒ harness chết.
 * @throws khi không tạo được liên kết (để nơi gọi báo rõ, không im lặng).
 */
export function linkDirSync(source: string, link: string): void {
  // 16/11/2026 (Lead): junction của Windows LƯU ĐƯỜNG DẪN TUYỆT ĐỐI trong đích, nên nếu `source` là
  //   đường dẫn tương đối thì junction tạo ra trỏ về chính nó ⇒ ESM báo
  //   "Cannot find module '<link>' imported from '<link>'" (đúng lỗi Windows 16/11/2026, 183 plugin
  //   không activate). resolve() cả hai đầu để junction luôn tuyệt đối, trên POSIX thì vô hại.
  symlinkSync(resolve(source), resolve(link), process.platform === "win32" ? "junction" : "dir");
}
