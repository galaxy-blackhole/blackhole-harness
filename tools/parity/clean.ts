/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:clean — dọn tiến trình Chrome và thư mục profile tạm còn sót của giàn parity
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import { CHROME_TMP_PREFIX } from "./lib/browser.ts";
import { STOCK_PORT, fileExists, parityPath, stockHome } from "./lib/paths.ts";

/** Kết quả một lần dọn. */
export interface CleanReport {
  /** Số tiến trình Chrome đã kill. */
  killed: number;
  /** Thư mục profile tạm đã xoá. */
  removedDirs: string[];
  /** Thư mục còn lại sau khi dọn (rỗng là sạch). */
  leftovers: string[];
}

/**
 * Liệt kê PID các tiến trình Chrome có chuỗi nhận diện của parity trong dòng lệnh.
 * @param needles các chuỗi nhận diện (thường là đường dẫn profile tạm).
 * @returns danh sách PID.
 */
export function findChromeProcesses(needles: readonly string[]): number[] {
  const probe = spawnSync("ps", ["-eo", "pid,command"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (probe.status !== 0) return [];
  const pids: number[] = [];
  for (const line of probe.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.includes(CHROME_TMP_PREFIX)) continue;
    if (!needles.some((needle) => trimmed.includes(needle))) continue;
    const pid = Number(trimmed.split(" ")[0]);
    if (Number.isFinite(pid) && pid > 0) pids.push(pid);
  }
  return pids;
}

/**
 * Dọn sạch: kill Chrome còn sót theo profile tạm, xoá các thư mục profile tạm của parity.
 * @param options `dryRun` chỉ báo cáo, không xoá/kill.
 * @returns số tiến trình đã kill, thư mục đã xoá và thư mục còn lại.
 */
export function cleanParityTmp(options: { dryRun?: boolean } = {}): CleanReport {
  const tmp = parityPath("tmp");
  const dirs: string[] = [];
  if (fileExists(tmp)) {
    for (const entry of readdirSync(tmp)) {
      if (!entry.startsWith(CHROME_TMP_PREFIX)) continue;
      const full = join(tmp, entry);
      try {
        if (statSync(full).isDirectory()) dirs.push(full);
      } catch {
        // bỏ qua entry không đọc được
      }
    }
  }
  let killed = 0;
  for (const dir of dirs) {
    const pids = findChromeProcesses([dir]);
    for (const pid of pids) {
      if (options.dryRun === true) {
        killed += 1;
        continue;
      }
      const result = spawnSync("kill", ["-9", String(pid)], { encoding: "utf8" });
      if (result.status === 0) killed += 1;
    }
    if (options.dryRun !== true) rmSync(dir, { recursive: true, force: true });
  }
  const leftovers: string[] = [];
  if (fileExists(tmp)) {
    for (const entry of readdirSync(tmp)) {
      if (entry.startsWith(CHROME_TMP_PREFIX)) leftovers.push(entry);
    }
  }
  return { killed, removedDirs: dirs, leftovers };
}

/**
 * Dọn tiến trình Oracle B còn sót: chỉ kill khi dòng lệnh của nó trỏ ĐÚNG home tạm của parity
 * (không bao giờ đụng tới 4001/5439 của người dùng).
 * @param port cổng của Oracle B.
 * @param stockHomePath home tạm mà parity dùng để boot Oracle B.
 * @returns số tiến trình đã kill.
 */
export function killLeftoverRefServer(port: number, stockHomePath: string): number {
  const pid = leftoverRefPid(port);
  if (pid === null) return 0;
  const probe = spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
  const command = probe.stdout.trim();
  if (!command.includes(stockHomePath)) return 0;
  spawnSync("kill", ["-9", String(pid)], { encoding: "utf8" });
  return 1;
}

/**
 * Kiểm tra cổng của Oracle B còn tiến trình nào sót không (chỉ báo cáo, không kill).
 * @param port cổng cần kiểm tra.
 * @returns PID đang listen, hoặc null.
 */
export function leftoverRefPid(port: number): number | null {
  const probe = spawnSync("lsof", ["-nP", "-tiTCP:" + String(port), "-sTCP:LISTEN"], { encoding: "utf8" });
  if (probe.status !== 0 || probe.stdout.trim() === "") return null;
  const pid = Number(probe.stdout.trim().split("\n")[0]);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

/**
 * Điểm vào CLI `parity:clean`.
 * @param argv tham số sau tên script (`--dry-run`).
 * @returns 0 khi dọn xong, 1 khi còn sót thư mục.
 */
export async function main(argv: string[]): Promise<number> {
  const dryRun = argv.includes("--dry-run");
  const report = cleanParityTmp({ dryRun });
  console.log(
    (dryRun ? "[dry-run] " : "") + "parity:clean — kill " + String(report.killed) + " tiến trình Chrome, xoá " +
      String(report.removedDirs.length) + " thư mục profile tạm",
  );
  for (const dir of report.removedDirs) console.log("  · " + dir);
  if (report.leftovers.length > 0) console.log("còn sót: " + report.leftovers.join(", "));
  const killedRef = dryRun ? 0 : killLeftoverRefServer(STOCK_PORT, stockHome());
  if (killedRef > 0) console.log("đã kill " + String(killedRef) + " tiến trình Oracle B còn sót trên cổng " + String(STOCK_PORT));
  const refPid = leftoverRefPid(STOCK_PORT);
  if (refPid !== null) {
    console.log(
      "lưu ý: cổng " + String(STOCK_PORT) + " vẫn có tiến trình " + String(refPid) +
        " — nếu không phải do parity boot thì đừng kill (kiểm tra: ps -p " + String(refPid) + " -o command=)",
    );
  }
  const chromeLeft = findChromeProcesses([CHROME_TMP_PREFIX]).length;
  console.log("Chrome còn mang dấu parity: " + String(chromeLeft));
  return report.leftovers.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
