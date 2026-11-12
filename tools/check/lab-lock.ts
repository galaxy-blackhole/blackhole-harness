/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khoá toàn cục cho MỌI lượt dựng lab (một home + một cổng): chống EEXIST symlink khi hai lượt cùng row chạy song song
 */

// VI SAO CO KHOA NAY (su co that 18/10/2026)
//   Lead chay tools/check/accept-row.ts ui-shortcuts SONG SONG voi luot sweep cua tm-evidence.
//   Ca hai cung dung home /tmp/gbh-lab-ui-shortcuts => luot sau rm/mkdir trong khi luot truoc dang
//   symlink peer => "EEXIST: file already exists, symlink .../@deepseek-ai/cordis" => lab khong boot
//   duoc (ENOENT ready-url.txt). Loi cua PHEP DO, khong phai cua goi.
//
//   => Moi thao tac "chiem lab" (tu luc xoa home toi luc URL san sang) PHAI nam trong MOT khoa.
//   Khoa la FILE /tmp/gbh-lab.lock chua pid; luot khac CHO (khong nem ngay) toi khi khoa nha hoac
//   chu pid da chet (khoa mo coi). Trong CUNG mot tien trinh thi khoa la RE-ENTRANT: tool goi runLab()
//   truc tiep (tools/check/lab-evidence.ts) khong bi tu khoa minh.
//
//   Tool nao SPAWN lab:row nhu tien trinh con ma da giu khoa thi dat GBH_LAB_LOCK_BYPASS=1 cho con
//   (con tin khoa cua cha; khong tu cho de tranh deadlock).

import { spawnSync } from "node:child_process";
import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";

/** Đường dẫn file khoá toàn cục. */
export const LAB_LOCK_PATH = "/tmp/gbh-lab.lock";

/** Thời gian chờ tối đa mặc định khi khoá đang bận (ms). */
export const LAB_LOCK_TIMEOUT_MS = 240_000;

/** Độ sâu giữ khoá trong tiến trình này (re-entrant: acquire/release lồng nhau phải cân bằng). */
let heldDepth = 0;

/** Lượt này chỉ MƯỢN khoá của tiến trình cha (spawn với GBH_LAB_LOCK_BYPASS=1). */
let bypassed = false;

/**
 * Kiểm tra pid còn sống (kill 0 không ném lỗi ESRCH).
 * @param pid pid cần kiểm.
 * @returns true khi tiến trình còn tồn tại.
 */
function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Đọc pid trong file khoá.
 * @param path đường dẫn file khoá.
 * @returns pid, hoặc 0 khi file không đọc được / rỗng.
 */
function readLockPid(path: string): number {
  try {
    return Number.parseInt(readFileSync(path, "utf8").trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/** Ngủ đồng bộ ngắn (dùng spawnSync sleep để không cần Bun API riêng). */
function sleepSync(ms: number): void {
  spawnSync("sleep", [(ms / 1000).toFixed(1)], { encoding: "utf8" });
}

/**
 * Giành khoá lab toàn cục, CHỜ tới khi khoá nhả (không ném ngay). Re-entrant trong cùng tiến trình.
 * @param timeoutMs thời gian chờ tối đa (ms).
 * @throws khi quá hạn mà khoá vẫn bận.
 */
export function acquireLabLock(timeoutMs = LAB_LOCK_TIMEOUT_MS): void {
  if (heldDepth > 0) {
    heldDepth += 1;
    return;
  }
  if (process.env.GBH_LAB_LOCK_BYPASS === "1") {
    bypassed = true;
    heldDepth = 1;
    return;
  }
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const fd = openSync(LAB_LOCK_PATH, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      heldDepth = 1;
      return;
    } catch {
      // Khoá đã có: chu pid chết => khoá mồ côi, xoá rồi thử lại ngay.
      const owner = readLockPid(LAB_LOCK_PATH);
      if (owner !== 0 && !pidAlive(owner)) {
        try {
          unlinkSync(LAB_LOCK_PATH);
        } catch {
          // luot khac vua xoa — thu lai vong sau
        }
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          "het " + String(Math.round(timeoutMs / 1000)) + "s cho khoa lab " + LAB_LOCK_PATH +
            " (dang bi pid " + String(owner) + " giu) — co luot lab khac dang chay; thu lai sau",
        );
      }
      sleepSync(500);
    }
  }
}

/** Nhả khoá lab nếu chính tiến trình này đã giành được (không đụng khoá của cha). */
export function releaseLabLock(): void {
  if (heldDepth === 0) return;
  heldDepth -= 1;
  if (heldDepth > 0) return;
  if (bypassed) {
    bypassed = false;
    return;
  }
  try {
    unlinkSync(LAB_LOCK_PATH);
  } catch {
    // khong con file — khong sao
  }
}
