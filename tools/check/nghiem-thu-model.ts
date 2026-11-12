/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Nghiệm thu bằng MODEL THẬT qua app: gửi prompt thật trong phiên mới để kiểm (1) tiêu đề phiên
 *      có được TỰ SINH (session-titles), (2) khối suy luận có BẢN DỊCH tiếng Việt (cot-translation);
 *      chụp ảnh sidebar + khối suy luận vào docs/tien-do/ rồi in JSON.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Nhận:
 *   - process.argv[2] (tuỳ chọn) — URL app; mặc định đọc ~/.galaxy/blackhole/ready-url.txt.
 *   - process.argv[3] (tuỳ chọn) — nhãn ngày cho tên ảnh (mặc định "10-11").
 * Trả: in stdout MỘT dòng JSON:
 *   { ok, ngay, url, shots[], tieuDe: { prompt, tieuDeSidebar, laTuSinh, giongPrompt }, suyLuan: { coKhoi,
 *     coBanDich, mauDich, trichDoan }, consoleErrors, pageErrors, loi }
 *   ok = true khi có tiêu đề sidebar KHÁC prompt (tự sinh) và khối suy luận có chữ Việt.
 */
const ngay = process.argv[3] ?? "10-11";
const urlArg = process.argv[2] ?? "";
const readyPath = join(homedir(), ".galaxy", "blackhole", "ready-url.txt");
const url = urlArg.length > 0 ? urlArg : existsSync(readyPath) ? readFileSync(readyPath, "utf8").trim() : "";
if (url.length === 0) {
  console.log(JSON.stringify({ ok: false, loi: ["khong doc duoc ready-url.txt"] }));
  process.exit(1);
}
const pwPath = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = await import(pathToFileURL(pwPath).href);
const chromium = (mod as { chromium?: unknown; default?: { chromium?: unknown } }).chromium ?? (mod as { default?: { chromium?: unknown } }).default?.chromium;
const browser = await (chromium as { launch: (o: unknown) => Promise<any> }).launch({ headless: true, channel: "chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const ngu = async (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const consoleErrors: string[] = [];
const pageErrors: string[] = [];
page.on("console", (m: { type: () => string; text: () => string }) => {
  if (m.type() === "error") {
    const t = m.text().slice(0, 200);
    if (!/127\.0\.0\.1:9230|\/ingest/i.test(t)) consoleErrors.push(t);
  }
});
page.on("pageerror", (e: Error) => pageErrors.push(String(e.message).slice(0, 200)));
const shotDir = join(process.cwd(), "docs", "tien-do");
mkdirSync(shotDir, { recursive: true });
const shots: string[] = [];
const loi: string[] = [];
const viet = /[àáảãạăâđêôơưýỳỷỹỵ]/i;

/** Gõ prompt vào ô soạn tin và bấm nút Gửi (Enter không gửi trong app này). */
const gui = async (prompt: string): Promise<void> => {
  const ed = page.locator("[data-slot='main'] [contenteditable='true'], [data-slot='main'] textarea").first();
  await ed.click({ timeout: 8000 });
  await page.keyboard.type(prompt, { delay: 12 });
  await ngu(400);
  const nut = page.locator("button[aria-label*='Send'], button[aria-label*='Gửi']").first();
  if ((await nut.count()) > 0) {
    await nut.click({ timeout: 6000 });
  } else {
    await page.keyboard.press("Meta+Enter");
  }
  await ngu(1200);
};

/** Chờ lượt chạy xong: chờ tới khi xuất hiện dấu hiệu 'Xong sau' hoặc nút Gửi bật lại. */
const choXong = async (toiDaMs: number): Promise<boolean> => {
  const batDau = Date.now();
  while (Date.now() - batDau < toiDaMs) {
    const xong = await page.evaluate(() => {
      const txt = document.body.innerText ?? "";
      return /Xong sau|Đã làm việc|Đang suy nghĩ/.test(txt) ? (/Xong sau/.test(txt) ? "xong" : "dang") : "chua";
    });
    if (xong === "xong") return true;
    await ngu(2000);
  }
  return false;
};

/** Mở phiên mới bằng nút ở thanh bên. */
const phienMoi = async (): Promise<void> => {
  const mo = page.getByRole("button", { name: /Mở thanh bên/i });
  if ((await mo.count()) > 0) {
    await mo.first().click({ timeout: 3000 }).catch(() => undefined);
    await ngu(900);
  }
  const nut = page.locator("button", { hasText: /^Phiên mới/ }).first();
  if ((await nut.count()) > 0) {
    await nut.click({ timeout: 6000 });
    await ngu(1800);
  }
};

const tieuDe: Record<string, unknown> = { prompt: "", tieuDeSidebar: "", laTuSinh: false, giongPrompt: false };
const suyLuan: Record<string, unknown> = { coKhoi: false, coBanDich: false, mauDich: "", trichDoan: "" };

await page.goto(url, { waitUntil: "load", timeout: 45000 });
await ngu(9000);

/** (1) session-titles: phiên mới + prompt thật ngắn. */
try {
  const prompt = "Chào, bạn là ai?";
  tieuDe.prompt = prompt;
  await phienMoi();
  await gui(prompt);
  const xong = await choXong(120000);
  tieuDe.xong = xong;
  await ngu(3000);
  const doc = await page.evaluate(() => {
    const o = document.querySelector("[data-slot='sidebar']") as HTMLElement | null;
    const dong = (o === null ? "" : (o.innerText ?? "")).split("\n").map((s) => s.trim()).filter(Boolean);
    return { dong: dong.slice(0, 24) };
  });
  const ung = (doc.dong as string[]).filter((x: string) => !/Phiên mới|Plugin|Tác vụ|Không gian|Hiện thêm|Workspace|Chưa nhóm|Thêm|Galaxy Blackhole|⌥|⌘|N$/.test(x));
  tieuDe.dongSidebar = ung.slice(0, 8);
  tieuDe.tieuDeSidebar = ung[0] ?? "";
  tieuDe.laTuSinh = (ung[0] ?? "") !== "" && (ung[0] ?? "").trim() !== tieuDe.prompt;
  tieuDe.giongPrompt = (ung[0] ?? "").includes(tieuDe.prompt as string);
  const p1 = join(shotDir, "anh-tieu-de-phien-" + ngay + ".png");
  await page.screenshot({ path: p1 });
  shots.push(p1);
} catch (e) {
  loi.push("session-titles: " + String(e).slice(0, 160));
}

/** (2) cot-translation: prompt buộc suy luận dài, mở khối suy luận, tìm bản dịch tiếng Việt. */
try {
  const prompt2 = "Hãy suy luận từng bước thật chi tiết: 17 × 23 bằng bao nhiêu? Giải thích vì sao.";
  await phienMoi();
  await gui(prompt2);
  const xong2 = await choXong(150000);
  suyLuan.xong = xong2;
  await ngu(2500);
  /** Bấm mở khối suy luận (nhãn thường là 'Suy luận' / 'Đã suy luận'). */
  const nhan = page.getByText(/Suy luận|Đã suy luận|suy luận/i).first();
  if ((await nhan.count()) > 0) {
    await nhan.click({ timeout: 5000 }).catch(() => undefined);
    await ngu(2500);
  }
  const rep = await page.evaluate(() => {
    const vung = (document.querySelector("[data-slot='main']") ?? document.body) as HTMLElement;
    const txt = vung.innerText ?? "";
    const dong = txt.split("\n").map((s) => s.trim()).filter(Boolean);
    const i = dong.findIndex((x) => /suy luận|reasoning/i.test(x));
    return { coKhoi: i >= 0, doan: i < 0 ? dong.slice(0, 20) : dong.slice(i, i + 30) };
  });
  const doan = (rep.doan as string[]).join(" ");
  suyLuan.coKhoi = rep.coKhoi;
  suyLuan.trichDoan = (rep.doan as string[]).slice(0, 10);
  suyLuan.coBanDich = viet.test(doan);
  suyLuan.mauDich = (rep.doan as string[]).filter((x: string) => viet.test(x)).slice(0, 3);
  const p2 = join(shotDir, "anh-cot-translation-" + ngay + ".png");
  await page.screenshot({ path: p2 });
  shots.push(p2);
} catch (e) {
  loi.push("cot-translation: " + String(e).slice(0, 160));
}

const ok = tieuDe.laTuSinh === true && suyLuan.coBanDich === true && consoleErrors.length === 0 && pageErrors.length === 0;
console.log(JSON.stringify({ ok, ngay, url: url.replace(/token=[^&]+/, "token=<r>"), shots, tieuDe, suyLuan, consoleErrors, pageErrors, loi }, null, 2));
await browser.close();
