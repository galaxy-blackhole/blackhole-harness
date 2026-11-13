/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 13/11/2026
 * desc Đóng gói rồi publish @galaxy-blackhole/blackhole-harness: luôn dùng ĐƯỜNG DẪN TUYỆT ĐỐI
 *   (npm hiểu "dist-harness/foo.tgz" là shorthand github "dist-harness/foo.tgz" ⇒ đòi ssh
 *    git@github.com:dist-harness/... ⇒ lỗi 128 "Repository not found" — đúng lỗi 13/11/2026).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Gốc repo harness (tệp này nằm trong tools/). */
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Thư mục staging do prepare.mjs sinh. */
const STAGING = join(REPO, "npm-package");
/** Nơi chứa tarball đã đóng. */
const OUT = join(REPO, "dist-harness");

/**
 * Cách chạy npm trên máy này: dò npm-cli.js cạnh node (đúng cả Windows), rồi mới tới `npm` trên PATH.
 * @returns {{command: string, prefix: string[]}} chương trình và tham số đứng trước lệnh npm.
 */
function npmCommand() {
  const nodeDir = dirname(process.execPath);
  const entries = [
    join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    join(nodeDir, "..", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  for (const entry of entries) {
    if (existsSync(entry)) return { command: process.execPath, prefix: [entry] };
  }
  return { command: process.platform === "win32" ? "npm.cmd" : "npm", prefix: [] };
}

/**
 * Chạy một lệnh, dừng ngay khi lỗi.
 * @param {string} command - chương trình.
 * @param {string[]} args - tham số.
 * @param {string} cwd - thư mục làm việc.
 * @param {boolean} quiet - ẩn stdout khi chỉ cần kiểm exit code.
 */
function run(command, args, cwd, quiet = false) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: quiet ? "pipe" : "inherit" });
  if ((result.status ?? 1) !== 0) {
    console.error("[publish-harness] lệnh hỏng: " + command + " " + args.join(" "));
    if (quiet && result.stdout) console.error(result.stdout.slice(-2000));
    if (quiet && result.stderr) console.error(result.stderr.slice(-2000));
    process.exit(result.status ?? 1);
  }
  return result;
}

mkdirSync(OUT, { recursive: true });
run(process.execPath, [join(STAGING, "prepare.mjs")], STAGING);
const npm = npmCommand();
run(npm.command, [...npm.prefix, "pack", "--pack-destination", OUT], STAGING, true);

/** Version vừa đóng, để chọn đúng tệp và báo lại cho người chạy. */
const { version } = JSON.parse(readFileSync(join(STAGING, "package.json"), "utf8"));
/** Tarball tuyệt đối — npm chỉ hiểu đúng khi đường dẫn tuyệt đối hoặc bắt đầu bằng ./ */
const tarball = join(OUT, "galaxy-blackhole-blackhole-harness-" + version + ".tgz");
console.log("[publish-harness] tarball: " + tarball + " (version " + version + ")");
const extra = process.argv.slice(2);
run(npm.command, [...npm.prefix, "publish", tarball, "--access", "public", ...extra], REPO);
