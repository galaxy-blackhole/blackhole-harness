/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 23/11/2026
 * desc Cổng hồi quy "boot-probe": mở THẬT trang web của harness bằng trình duyệt headless, đọc console
 *      và DOM, rồi FAIL nếu có entry không kích hoạt. Không thể thay bằng curl: sự cố 23/11/2026 phục vụ
 *      HTTP 200 cho mọi tệp mà client vẫn báo "1 entry did not activate" (sổ typert rỗng), nên chỉ trình
 *      duyệt mới bắt được. Dùng Playwright nếu có, không thì Electron trên máy dev.
 */

import { createRequire } from "node:module";

/** Hai dấu hiệu boot hỏng mà curl KHÔNG thấy được. */
const DAU_HIEU_HONG = [/did not activate/iu, /Failed to load plugins/iu];

/**
 * Mở URL bằng Playwright Chromium, đợi kernel boot xong, đọc console + chữ trên trang.
 * @param url - URL đã có token của lượt boot cần kiểm.
 * @param choMs - thời gian chờ kernel chạy xong (mặc định 25 giây).
 * @returns `{ ok, vanDe, console }` — danh sách dòng khớp dấu hiệu hỏng, và toàn bộ console lỗi.
 */
export async function probeBoot(url, choMs = 25000) {
  const chromium = (await import("playwright")).chromium;
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const console_lines = [];
  page.on("console", (message) => {
    if (message.type() === "error") console_lines.push(message.text());
  });
  page.on("pageerror", (error) => console_lines.push(String(error)));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(choMs);
  const body = await page.innerText("body").catch(() => "");
  await browser.close();
  const vanDe = [];
  for (const mau of DAU_HIEU_HONG) {
    if (mau.test(body)) vanDe.push("DOM: " + body.split("\n").filter((l) => mau.test(l)).join(" | ").slice(0, 300));
  }
  for (const line of console_lines) {
    for (const mau of DAU_HIEU_HONG) if (mau.test(line)) vanDe.push("console: " + line.slice(0, 300));
  }
  return { ok: vanDe.length === 0, vanDe, console: console_lines, body };
}

/** Chạy như CLI: `node tools/boot-probe.mjs <url>` — in kết quả và thoát 1 khi boot hỏng. */
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  if (url === undefined) {
    console.error("dùng: node tools/boot-probe.mjs <url có token>");
    process.exit(2);
  }
  const ketQua = await probeBoot(url);
  console.log("=== chữ trên trang ===");
  console.log(ketQua.body.slice(0, 400));
  console.log("=== console lỗi (" + String(ketQua.console.length) + ") ===");
  for (const line of ketQua.console.slice(-10)) console.log(" -", line.slice(0, 200));
  if (ketQua.ok) {
    console.log("[boot-probe] XANH — mọi entry đã kích hoạt");
  } else {
    console.error("[boot-probe] ĐỎ — " + String(ketQua.vanDe.length) + " dấu hiệu hỏng:");
    for (const dong of ketQua.vanDe.slice(0, 8)) console.error(" -", dong);
    process.exit(1);
  }
}
