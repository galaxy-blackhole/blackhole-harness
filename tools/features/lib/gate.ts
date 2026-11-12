/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cổng trạng thái trước khi chụp: HTTP 200 + instance đã lên đủ lâu, tránh ghi cửa sổ restart thành lỗi giao diện
 */

import { spawnSync } from "node:child_process";

import { credentialsPath } from "../../parity/lib/paths.ts";
import { resolveSessionCookieFrom } from "../../parity/lib/browser.ts";
import { readyUrlForPort } from "../../parity/lib/session-entry.ts";

import type { SideSpec } from "./capture.ts";

/** Sức khoẻ một bên trước khi chụp. */
export interface SideHealth {
  /** Khoá bên: ours hoặc ref. */
  key: string;
  /** Cổng server. */
  port: number;
  /** Mã HTTP khi gọi trang chủ kèm cookie phiên (401 là cookie sai, 0 là không kết nối được). */
  httpStatus: number;
  /** PID đang listen cổng này (null nếu không thấy). */
  pid: number | null;
  /** Số giây tiến trình đã chạy (null nếu không đọc được). */
  uptimeSeconds: number | null;
  /** true khi HTTP 200 và instance đã lên đủ ngưỡng. */
  ok: boolean;
  /** Ghi chú vì sao chưa đạt. */
  notes: string[];
}

/**
 * Tìm PID đang listen một cổng TCP.
 * Nhận: số cổng.
 * Trả: PID, hoặc null nếu không có tiến trình nào listen.
 */
export function listeningPid(port: number): number | null {
  const probe = spawnSync("lsof", ["-nP", "-tiTCP:" + String(port), "-sTCP:LISTEN"], { encoding: "utf8" });
  if (probe.status !== 0 || probe.stdout.trim() === "") return null;
  const pid = Number(probe.stdout.trim().split("\n")[0]);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

/**
 * Đọc số giây một tiến trình đã chạy.
 * Nhận: PID cần đọc.
 * Trả: số giây (làm tròn), hoặc null nếu không đọc được.
 */
export function processUptimeSeconds(pid: number): number | null {
  // Linux có etimes (giây); macOS chỉ có etime (định dạng 01:23:45 hoặc 1-01:23:45).
  const seconds = spawnSync("ps", ["-o", "etimes=", "-p", String(pid)], { encoding: "utf8" });
  if (seconds.status === 0) {
    const value = Number(seconds.stdout.trim());
    if (Number.isFinite(value)) return value;
  }
  const elapsed = spawnSync("ps", ["-o", "etime=", "-p", String(pid)], { encoding: "utf8" });
  if (elapsed.status !== 0) return null;
  return parseElapsed(elapsed.stdout.trim());
}

/**
 * Đổi chuỗi etime của ps thành số giây.
 * Nhận: chuỗi kiểu "45", "02:13", "01:02:13" hoặc "3-01:02:13".
 * Trả: số giây, hoặc null nếu chuỗi không đúng dạng.
 */
export function parseElapsed(text: string): number | null {
  if (text === "") return null;
  const days = text.includes("-") ? Number(text.slice(0, text.indexOf("-"))) : 0;
  const rest = text.includes("-") ? text.slice(text.indexOf("-") + 1) : text;
  const parts = rest.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  const [first = 0, second = 0, third = 0] = parts.length === 3 ? parts : [0, parts[0] ?? 0, parts[1] ?? 0];
  if (!Number.isFinite(days)) return null;
  return days * 86_400 + first * 3600 + second * 60 + third;
}

/**
 * Gọi trang chủ kèm cookie phiên mint trong bộ nhớ để biết server có phục vụ thật không.
 * Giá trị cookie KHÔNG bao giờ được in ra log hay ghi vào artifact.
 * Nhận: cổng server.
 * Trả: mã HTTP, hoặc 0 khi không kết nối được.
 */
export async function probeHttpStatus(port: number): Promise<number> {
  const home = "http://127.0.0.1:" + String(port) + "/";
  // 1) ĐƯỜNG TOKEN trước — đây là đường chính: ready-url chỉ đổi được thành phiên qua MỘT lượt điều hướng,
  // nên gọi trần trang chủ LUÔN trả 401 dù app lành (bẫy đã ghi trong AGENTS.md).
  const token = await cookieFromToken(port);
  if (token !== null) {
    try {
      const response = await fetch(home, { headers: { cookie: token }, redirect: "manual" });
      if (response.status === 200) return 200;
    } catch {
      // rơi xuống đường secret
    }
  }
  // 2) ĐƯỜNG SECRET — đường lùi, giữ nguyên hành vi cũ.
  const auth = resolveSessionCookieFrom(port, [credentialsPath()]);
  const headers: Record<string, string> = auth.cookie === null ? {} : { cookie: auth.cookie.name + "=" + auth.cookie.value };
  try {
    const response = await fetch(home, { headers, redirect: "manual" });
    return response.status;
  } catch {
    return 0;
  }
}

/**
 * Lấy cookie phiên bằng ĐƯỜNG TOKEN: mở ready-url một lượt rồi đọc `Set-Cookie`.
 *
 * Giá trị cookie KHÔNG bao giờ được in ra log hay ghi vào artifact — hàm chỉ trả chuỗi `name=value`.
 * Nhận: cổng server.
 * Trả: chuỗi `name=value` của cookie `dsh-auth*`, hoặc null nếu không lấy được.
 */
async function cookieFromToken(port: number): Promise<string | null> {
  const ready = readyUrlForPort(port);
  if (ready === null) return null;
  try {
    const response = await fetch(ready, { redirect: "manual" });
    const lines = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    for (const line of lines) {
      const pair = line.split(";")[0] ?? "";
      if (pair.startsWith("dsh-auth")) return pair;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Chờ một bên đạt trạng thái chụp được: HTTP 200 và instance đã lên ít nhất minUptimeSeconds giây.
 * Nhận: bên cần kiểm, ngưỡng tuổi instance (giây) và tổng thời gian chờ tối đa (ms).
 * Trả: báo cáo sức khoẻ kèm ghi chú; ok=false nghĩa là phải SKIP kịch bản, KHÔNG được coi là khác biệt giao diện.
 */
export async function probeSideHealth(
  side: SideSpec,
  minUptimeSeconds = 10,
  timeoutMs = 30_000,
): Promise<SideHealth> {
  const deadline = Date.now() + timeoutMs;
  let report: SideHealth = { key: side.key, port: side.port, httpStatus: 0, pid: null, uptimeSeconds: null, ok: false, notes: [] };
  for (;;) {
    const httpStatus = await probeHttpStatus(side.port);
    const pid = listeningPid(side.port);
    const uptimeSeconds = pid === null ? null : processUptimeSeconds(pid);
    const young = uptimeSeconds !== null && uptimeSeconds < minUptimeSeconds;
    report = {
      key: side.key,
      port: side.port,
      httpStatus,
      pid,
      uptimeSeconds,
      ok: httpStatus === 200 && !young,
      notes: [],
    };
    if (report.ok) return report;
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (report.httpStatus !== 200) report.notes.push("cổng " + String(side.port) + " trả HTTP " + String(report.httpStatus) + " (cần 200)");
  if (report.uptimeSeconds !== null && report.uptimeSeconds < minUptimeSeconds) {
    report.notes.push("instance mới lên " + String(report.uptimeSeconds) + "s (< " + String(minUptimeSeconds) + "s) — có thể còn trong cửa sổ restart");
  }
  if (report.pid === null) report.notes.push("không thấy tiến trình listen cổng " + String(side.port));
  return report;
}
