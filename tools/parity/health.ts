/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:health — CLI kiểm cổng trạng thái (app LÀNH? cửa sổ đo hợp lệ?) trước mọi phép đo
 */

import { closeChromeSession, launchChrome, resolveSessionCookieFrom } from "./lib/browser.ts";
import { assessUrlHealth, describeHealth, findInvalidWindow, localClock } from "./lib/health.ts";
import { enterSession } from "./lib/session-entry.ts";
import { OURS_PORT, ORACLE_A_PORT, appHome, credentialsPath, log, parityPath, stamp } from "./lib/paths.ts";

/**
 * Kiểm trạng thái một cổng bằng cookie phiên mint trong bộ nhớ.
 * @param port cổng cần kiểm.
 * @param stampRun dấu thời gian của phiên Chrome.
 * @returns báo cáo trạng thái kèm cổng.
 */
async function checkPort(port: number, stampRun: string): Promise<{ port: number; report: Awaited<ReturnType<typeof assessUrlHealth>> }> {
  const session = await launchChrome(parityPath("tmp"), stampRun + "-health-" + String(port));
  try {
    // ĐƯỜNG CHÍNH là token: mở ready-url một lần để app tự đặt cookie phiên; secret chỉ là đường lùi.
    const entry = await enterSession(session.context, port, [credentialsPath(), appHome() + "/.credentials.yaml"]);
    log("[" + String(port) + "] vào app bằng đường " + entry.via + " · " + entry.detail);
    const report = await assessUrlHealth(session.context, "http://127.0.0.1:" + String(port) + "/", {
      cookie: entry.via === "secret" ? entry.cookie : null,
      waitMs: 3000,
    });
    if (!report.ok && entry.detail.startsWith("APP BOOT HỎNG")) {
      report.reasons.push(entry.detail);
    } else if (!report.ok && !entry.appUp) {
      report.reasons.push("APP KHÔNG PHỤC VỤ — không kết nối được cổng " + String(port));
    } else if (!report.ok && entry.via === "none") {
      report.reasons.push("DỤNG CỤ KHÔNG VÀO ĐƯỢC — app có phục vụ nhưng cả token lẫn secret đều không vào được: " + entry.detail);
    }
    return { port, report };
  } finally {
    await closeChromeSession(session);
  }
}

/**
 * Điểm vào CLI: kiểm các cổng truyền vào (mặc định của ta + oracle A).
 * @param argv tham số sau tên script; nhận các cổng dạng số.
 * @returns 0 khi mọi cổng LÀNH, 1 khi có cổng không lành, 2 khi thời điểm đo không hợp lệ.
 */
export async function main(argv: string[]): Promise<number> {
  const clock = localClock();
  const invalid = findInvalidWindow();
  log("thời điểm đo " + clock.date + " " + clock.time, invalid === null ? "→ hợp lệ" : "→ INVALID_WINDOWS: " + invalid.why);
  const ports = argv.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
  const wanted = ports.length > 0 ? ports : [OURS_PORT, ORACLE_A_PORT];
  const stampRun = stamp();
  let bad = 0;
  for (const port of wanted) {
    const { report } = await checkPort(port, stampRun);
    console.log("[" + String(port) + "] " + describeHealth(report));
    if (!report.ok) bad += 1;
  }
  if (invalid !== null) return 2;
  return bad === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
