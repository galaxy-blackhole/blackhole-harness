/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 05/11/2026
 * desc Tạo farm symlink `node_modules/@galaxy-blackhole/<tên-gói>` → thư mục gói workspace, để artefact
 *      sau P1b (require `@galaxy-blackhole/gbh-*`) phân giải được khi chạy test. Idempotent.
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/** Thư mục gốc repo (tools/lib → lên hai cấp). */
const REPO_ROOT = join(import.meta.dir, "..", "..");

/** Tiền tố scope của ta. */
const SCOPE = "@galaxy-blackhole/";

/**
 * Liệt kê mọi thư mục gói workspace có `package.json`.
 * Nhận: không.
 * Trả: danh sách `[tên-gói-ngắn, đường-dẫn-tương-đối-từ-scope-dir]`.
 */
function lietKeGoi(): Array<[string, string]> {
  const ket: Array<[string, string]> = [];
  for (const nhom of readdirSync(join(REPO_ROOT, "packages"))) {
    const thuMucNhom = join(REPO_ROOT, "packages", nhom);
    if (!existsSync(thuMucNhom) || !statSync(thuMucNhom).isDirectory()) continue;
    for (const ten of readdirSync(thuMucNhom)) {
      const manifest = join(thuMucNhom, ten, "package.json");
      if (!existsSync(manifest)) continue;
      const duLieu = JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown };
      const dayDu = typeof duLieu.name === "string" ? duLieu.name : "";
      if (!dayDu.startsWith(SCOPE)) continue;
      ket.push([dayDu.slice(SCOPE.length), join("..", "..", "packages", nhom, ten)]);
    }
  }
  return ket;
}

/**
 * Bảo đảm farm symlink khớp đúng danh sách gói; xoá link lạ.
 * Nhận: không.
 * Trả: số link đã tạo mới.
 */
function main(): number {
  const scopeDir = join(REPO_ROOT, "node_modules", "@galaxy-blackhole");
  mkdirSync(scopeDir, { recursive: true });
  const goi = lietKeGoi();
  const hopLe = new Set(goi.map(([ten]) => ten));
  let taoMoi = 0;
  for (const ten of readdirSync(scopeDir)) {
    if (hopLe.has(ten)) continue;
    const duong = join(scopeDir, ten);
    if (!lstatSync(duong).isSymbolicLink()) continue;
    unlinkSync(duong);
  }
  for (const [ten, dich] of goi) {
    const lienKet = join(scopeDir, ten);
    let daCo = false;
    try {
      daCo = lstatSync(lienKet).isSymbolicLink() && readlinkSync(lienKet) === dich;
    } catch {
      daCo = false;
    }
    if (daCo) continue;
    try {
      unlinkSync(lienKet);
    } catch {
      /* chưa có — bỏ qua */
    }
    symlinkSync(dich, lienKet, "dir");
    taoMoi += 1;
  }
  // 05/11/2026 (P1b): farm thu hai trong `apps/host/node_modules` — moi the gioi test symlink
  // thang vao APP_MODULES deu thay `@galaxy-blackhole`, khong phai sua tung test.
  const appModules = join(REPO_ROOT, "apps", "host", "node_modules");
  if (existsSync(appModules)) {
    const farm2 = join(appModules, "@galaxy-blackhole");
    let daCo = false;
    try {
      daCo = lstatSync(farm2).isSymbolicLink();
    } catch {
      daCo = false;
    }
    if (!daCo) {
      symlinkSync(join("..", "..", "..", "node_modules", "@galaxy-blackhole"), farm2, "dir");
      taoMoi += 1;
    }
  }
  return taoMoi;
}

if (import.meta.main) {
  const taoMoi = main();
  console.log("[link-scope] symlink @galaxy-blackhole: " + String(taoMoi) + " mới");
}

