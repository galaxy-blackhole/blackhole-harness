/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/11/2026
 * desc Tao lien ket THU MUC chay duoc tren moi he: Windows khong cho symlink thu muc neu thieu quyen
 *      (EPERM) nhung JUNCTION thi khong can quyen. 16/11/2026: loi Windows that — profile thieu
 *      @galaxy-blackhole/gbh-brand, gbh-typert-protocol, gbh-cordis-plugin-timer ⇒ 4 plugin khong
 *      activate ⇒ harness khong in URL.
 *      22/11/2026: them ensureDirLink() — TU CHUA lien ket GAY/tro sai (xem chu thich trong ham).
 */

import { lstatSync, mkdirSync, realpathSync, rmSync, symlinkSync, type Stats } from "node:fs";
import { dirname, resolve } from "node:path";

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

/** Kết quả một lượt {@link ensureDirLink}. */
export type DirLinkState = "created" | "repaired" | "unchanged" | "blocked";

/**
 * Đường dẫn chuẩn của một đích: realpath khi tồn tại, ngược lại đường dẫn tuyệt đối đã resolve.
 * Nhận: `path` — đường dẫn cần chuẩn hoá. Trả: chuỗi dùng để SO SÁNH hai đích.
 */
function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/**
 * Bảo đảm `link` là liên kết thư mục trỏ tới `source`, và TỰ CHỮA liên kết đã chết.
 *
 * Nhận: `source` — thư mục đích thật; `link` — đường dẫn liên kết cần có.
 * Trả: `created` (chưa có, vừa tạo) · `repaired` (có nhưng gãy/trỏ sai, đã trỏ lại) ·
 *      `unchanged` (đã trỏ đúng, không đụng vào) · `blocked` (đó là thư mục/tệp THẬT, không phải link của ta).
 *
 * @remarks ⚠️ 22/11/2026 — LỖI THẬT đo trên bản prod "Galaxy Blackhole":
 * `gbh-node-addon-system/lib/flock.js` gọi `require.resolve("@deepseek-ai/node-addon-system-<platform>-<arch>/package.json")`.
 * Profile giữ symlink TUYỆT ĐỐI vào đích của app đang cài. Khi app đổi tên/đổi đường dẫn (đo được:
 * `Galaxy Blackhole (Preview).app` → `Galaxy Blackhole.app`) thì đích cũ biến mất, symlink thành GÃY.
 * Mã cũ kiểm `existsSync(link)` — hàm này đi THEO symlink nên trả `false` cho link gãy — rồi gọi
 * `symlinkSync` và nhận `EEXIST`, `catch {}` nuốt mất ⇒ link chết NẰM LẠI VĨNH VIỄN ⇒ mọi lượt resume
 * ném `Cannot find module …` (`gateway/internal: resume failed for session …`).
 * Vì vậy: `lstatSync` (không đi theo link) để nhận diện link, `realpathSync` để biết nó còn sống hay
 * không, rồi GỠ trước khi tạo lại. Thư mục/tệp THẬT thì không đụng (có thể là bản mount hợp lệ).
 *
 * @throws khi không tạo được liên kết mới (quyền, ổ đĩa) — nơi gọi tự quyết định nuốt hay báo.
 */
export function ensureDirLink(source: string, link: string): DirLinkState {
  const target = resolve(source);
  let hienTai: Stats | undefined;
  try {
    hienTai = lstatSync(link);
  } catch {
    // Chưa có gì ở đường dẫn này (ENOENT) — sẽ tạo mới bên dưới.
    hienTai = undefined;
  }
  if (hienTai === undefined) {
    mkdirSync(dirname(link), { recursive: true });
    linkDirSync(target, link);
    return "created";
  }
  // Bản SAO THẬT (mount đã chép thư mục vào profile) không phải link của hàm này ⇒ để nguyên.
  if (!hienTai.isSymbolicLink()) return "blocked";
  let dichHienTai: string | undefined;
  try {
    dichHienTai = realpathSync(link);
  } catch {
    // Symlink GÃY: đích đã bị đổi tên/gỡ — realpathSync ném ENOENT.
    dichHienTai = undefined;
  }
  if (dichHienTai !== undefined && dichHienTai === canonical(target)) return "unchanged";
  // rmSync KHÔNG đi theo symlink: nó gỡ chính liên kết, không đụng thư mục đích.
  rmSync(link, { recursive: true, force: true });
  mkdirSync(dirname(link), { recursive: true });
  linkDirSync(target, link);
  return "repaired";
}
