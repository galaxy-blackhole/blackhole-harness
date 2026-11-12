/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Đường dẫn, cổng và hằng số môi trường chung của giàn parity
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Một viewport chụp ảnh (tên hiển thị + kích thước CSS pixel). */
export interface Viewport {
  /** Nhãn dùng trong tên file, ví dụ `1440x900`. */
  name: string;
  /** Chiều rộng khung nhìn. */
  width: number;
  /** Chiều cao khung nhìn. */
  height: number;
}

/** Gốc repo blackhole-tauri, suy ra từ chính file này (tools/parity/lib → repo). */
export const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");

/** Thư mục chứa mọi artifact sinh ra của parity; đã gitignore, không bao giờ commit. */
export const PARITY_DIR = join(REPO_ROOT, ".parity");

/** Cổng web của app ta (`scripts/restart-host.sh`), cố định theo docs/ARCHITECTURE §8. */
export const OURS_PORT = readNumber("GBH_PARITY_OURS_PORT", 5439);

/** Cổng của Oracle B — profile `web` nguyên bản mà parity tự boot. */
export const STOCK_PORT = readNumber("GBH_PARITY_STOCK_PORT", 4543);

/** Cổng của Oracle A — blackhole web đang chạy của người dùng. */
export const ORACLE_A_PORT = readNumber("GBH_PARITY_ORACLE_PORT", 4001);

/** Ngân sách pixel mỗi khung: 0.1% (docs/ARCHITECTURE §5.2, quyết định D9). */
export const PIXEL_THRESHOLD_RATIO = readNumber("GBH_PARITY_PIXEL_THRESHOLD", 0.001);

/** Thời gian chờ thêm sau `networkidle` để CSS/font ổn định trước khi chụp. */
export const SETTLE_MS = readNumber("GBH_PARITY_SETTLE_MS", 1500);

/** Timeout mặc định cho một lần điều hướng trang. */
export const NAV_TIMEOUT_MS = readNumber("GBH_PARITY_NAV_TIMEOUT_MS", 30000);

/** Hai viewport bắt buộc theo task-2. */
export const VIEWPORTS: readonly Viewport[] = Object.freeze([
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1024x768", width: 1024, height: 768 },
]);

/**
 * Đọc một biến môi trường dạng số.
 * @param name tên biến môi trường.
 * @param fallback giá trị dùng khi biến trống hoặc không phải số.
 * @returns số đã đọc hoặc giá trị mặc định.
 */
export function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Đọc một biến môi trường dạng chuỗi.
 * @param name tên biến môi trường.
 * @param fallback giá trị dùng khi biến trống.
 * @returns chuỗi đã đọc hoặc giá trị mặc định.
 */
export function readString(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === "" ? fallback : raw.trim();
}

/**
 * Thư mục home của người dùng.
 * @returns đường dẫn tuyệt đối tới home.
 */
export function homeDir(): string {
  return homedir();
}

/**
 * Home harness của app ta (KHÔNG bao giờ là ~/.galaxy/gbh).
 * @returns đường dẫn tuyệt đối tới home của app.
 */
export function appHome(): string {
  return readString("GBH_HOME", join(homeDir(), ".galaxy", "blackhole"));
}

/**
 * Tài liệu credentials dùng chung của hệ Galaxy.
 * @returns đường dẫn tuyệt đối tới credentials.yaml.
 */
export function credentialsPath(): string {
  return readString("GBH_CREDENTIALS", join(homeDir(), ".galaxy", "credentials.yaml"));
}

/**
 * Home tạm của Oracle B — tái lập được, không đụng tới dữ liệu của người dùng.
 * @returns đường dẫn tuyệt đối tới home tạm của oracle B.
 */
export function stockHome(): string {
  return readString("GBH_PARITY_STOCK_HOME", "/tmp/gbh-ref-home");
}

/**
 * Bóc danh sách viewport từ tham số `--sizes 1440x900,1024x768`.
 * @param raw chuỗi tham số (có thể null).
 * @returns danh sách viewport đã parse (rỗng nếu tham số trống hoặc sai định dạng).
 */
export function parseViewports(raw: string | null): Viewport[] {
  if (raw === null || raw.trim() === "") return [];
  const viewports: Viewport[] = [];
  for (const token of raw.split(",")) {
    const parts = token.trim().split("x");
    const width = Number(parts[0]);
    const height = Number(parts[1]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 320 || height < 240) continue;
    viewports.push({ name: String(width) + "x" + String(height), width, height });
  }
  return viewports;
}

/**
 * Ghép đường dẫn trong repo.
 * @param parts các thành phần đường dẫn tương đối.
 * @returns đường dẫn tuyệt đối trong repo.
 */
export function repoPath(...parts: string[]): string {
  return join(REPO_ROOT, ...parts);
}

/**
 * Ghép đường dẫn trong thư mục artifact `.parity`.
 * @param parts các thành phần đường dẫn tương đối.
 * @returns đường dẫn tuyệt đối trong `.parity`.
 */
export function parityPath(...parts: string[]): string {
  return join(PARITY_DIR, ...parts);
}

/**
 * Tạo thư mục (đệ quy) nếu chưa có.
 * @param dir đường dẫn thư mục cần tạo.
 * @returns chính đường dẫn đó, để dùng dạng `const x = ensureDir(...)`.
 */
export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Dấu thời gian dùng cho tên thư mục artifact: `2026-10-17T11-45-00`.
 * @param date thời điểm cần đóng dấu, mặc định là hiện tại.
 * @returns chuỗi thời gian an toàn cho tên file (không có dấu hai chấm).
 */
export function stamp(date: Date = new Date()): string {
  const iso = date.toISOString().slice(0, 19);
  return iso.replaceAll(":", "-");
}

/**
 * Tìm binary Node >= 26 (node v24 hỏng im lặng, xem docs/ARCHITECTURE §R2).
 * @returns đường dẫn node thoả `engines.node >= 26`.
 * @throws Error khi không tìm thấy node nào >= 26.
 */
export function resolveNodeBin(): string {
  const candidates = [
    process.env.GBH_NODE,
    process.env.NODE_BIN,
    join(homeDir(), ".nvm/versions/node/v26.9.0/bin/node"),
    "/opt/homebrew/bin/node",
    "/usr/local/bin/node",
    "node",
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["-v"], { encoding: "utf8" });
    if (probe.status !== 0) continue;
    const major = Number(probe.stdout.trim().replace("v", "").split(".")[0]);
    if (Number.isFinite(major) && major >= 26) return candidate;
  }
  throw new Error("parity: cần Node >= 26 (thử GBH_NODE); node v24 thoát im lặng");
}

/**
 * In một dòng log có tiền tố để dễ lọc trong CI.
 * @param parts các phần sẽ được nối bằng khoảng trắng.
 * @returns không trả gì.
 */
export function log(...parts: unknown[]): void {
  console.log("[parity]", ...parts);
}

/**
 * Thời điểm hiện tại dạng ISO, dùng cho report.
 * @returns chuỗi ISO 8601.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Kiểm tra tệp có tồn tại hay không.
 * @param file đường dẫn tuyệt đối.
 * @returns true nếu là file/thư mục tồn tại.
 */
export function fileExists(file: string): boolean {
  return existsSync(file);
}