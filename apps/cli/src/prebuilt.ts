/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Cài package bằng lib/ ĐÃ BUILD SẴN khi chạy host nhúng trong .app (không có mã nguồn để build)
 *      11/11/2026: bản .app tự chứa không chạy build.ts lúc boot — mount chép lib/ có sẵn, nhờ vậy máy
 *      mới boot trong vài giây thay vì hàng phút và không cần Bun.build trong gói cài
 *      12/11/2026: thêm buildRuntimeAvailable() — launcher Node không chạy được build.ts (xem mount.ts)
 */

import { cpSync, existsSync, mkdirSync, readlinkSync, rmSync, statSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { repoRoot } from "./paths.ts";

/**
 * Bản chạy này có phải host NHÚNG trong .app không (dấu `.gbh-embedded` do scripts/embed.ts ghi).
 * Nhận: không.
 * Trả: true khi repo đang chạy là bản đã đóng gói.
 */
export function embeddedHost(): boolean {
  return existsSync(join(repoRoot(), ".gbh-embedded"));
}

/**
 * Có dùng lib/ dựng sẵn thay cho build.ts không.
 * Nhận: `env` — môi trường (mặc định tiến trình hiện tại); `embedded` — bản chạy đã đóng gói hay chưa.
 * Trả: true khi `GBH_PREBUILT_LIB=1`, hoặc khi chạy từ host nhúng; `GBH_PREBUILT_LIB=0` tắt hẳn.
 */
export function prebuiltLibs(env: NodeJS.ProcessEnv = process.env, embedded: boolean = embeddedHost()): boolean {
  const flag = (env.GBH_PREBUILT_LIB ?? "").trim();
  if (flag === "1") return true;
  if (flag === "0") return false;
  return embedded;
}

/**
 * Runtime hiện tại có chạy được build.ts của gói không.
 *
 * Vì sao cần: đường build gọi `spawnSync(process.execPath, ["run", <build.ts>])` — chỉ đúng khi
 * tiến trình là Bun. Khi app desktop chạy launcher bằng Node (`node --experimental-strip-types
 * apps/cli/src/main.ts host`, xem apps/desktop/src-tauri/src/host_proc.rs) thì lệnh đó KHÔNG có
 * nghĩa (`node run …`), nên mỗi gói lại spawn một tiến trình chắc chắn hỏng rồi mới rơi về artefact
 * có sẵn: đo được 39 gói × ~330 ms ≈ 13 s mỗi lượt boot, kèm 39 cảnh báo "build loi" giả.
 * Nhận: không. Trả: true khi có Bun trong tiến trình này (đường build chạy được).
 * @returns true nếu `process.execPath run <script>` hợp lệ (Bun); false với Node.
 */
export function buildRuntimeAvailable(): boolean {
  // 12/11/2026 — cùng một phép dò với mount-gate.isBunProcess(): global `Bun` HOẶC `process.versions.bun`
  // (sandbox có thể che global nhưng runtime vẫn là bun).
  if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") return true;
  return typeof (process.versions as { bun?: unknown }).bun === "string";
}

/**
 * Bảo đảm một symlink trong profile trỏ đúng đích HIỆN TẠI, chữa cả link đã gãy.
 * Nhận: link — đường dẫn symlink; target — đích tuyệt đối muốn trỏ tới.
 * Trả: true khi vừa tạo lại (hoặc tạo mới), false khi link đã đúng.
 * @remarks Link gãy xảy ra khi profile cũ được tạo bởi bản chạy từ repo rồi app chuyển sang host nhúng
 *          (hoặc ngược lại): `existsSync` trả false nên mã cũ bỏ qua và giữ link chết ⇒ import nổ.
 */
export function ensureLink(link: string, target: string): boolean {
  try {
    const current = readlinkSync(link);
    if (existsSync(resolve(dirname(link), current))) return false;
    rmSync(link, { force: true });
  } catch {
    if (existsSync(link)) return false;
  }
  try {
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(target, link, "dir");
    return true;
  } catch {
    return false;
  }
}

/**
 * Chép `lib/` dựng sẵn của một gói vào bản cài trong profile, bỏ qua khi bản trong profile đã mới hơn.
 * Nhận: `sourceDir` — thư mục gói trong repo; `libDir` — thư mục lib đích trong profile.
 * Trả: true khi vừa chép (hoặc không cần chép vì đã có), false khi gói không có lib/ dựng sẵn.
 */
export function installPrebuiltLib(sourceDir: string, libDir: string): boolean {
  const source = join(sourceDir, "lib");
  const entry = ["index.js", "client.js"].map((name) => join(source, name)).find((file) => existsSync(file));
  if (entry === undefined) return false;
  try {
    const cũ = statSync(entry).mtimeMs;
    const đích = join(libDir, entry.slice(source.length + 1));
    if (existsSync(đích) && statSync(đích).mtimeMs >= cũ) return false;
    mkdirSync(libDir, { recursive: true });
    cpSync(source, libDir, { recursive: true, force: true });
    return true;
  } catch {
    // Chép lỗi thì trả false để mount rơi về đường build cũ (hoặc cảnh báo), không làm sập boot.
    return false;
  }
}
