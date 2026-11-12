/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Nghiệm thu 12 bundle GBH thử nghiệm trên trang Plugin: mở chi tiết TỪNG bundle, đếm số id
 *      @galaxy-blackhole/gbh-* và @deepseek-ai/dsh-* xuất hiện trong trang chi tiết, chụp ảnh vào
 *      docs/tien-do/anh-<slug>-10-11.png rồi in JSON tổng hợp.
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
 *   { ok, ngay, url, tongSo, soAnh, ketQua: [{ ten, slug, moDuoc, soGbh, soDsh, anh }], consoleErrors, pageErrors, loi }
 *   ok = true khi mở được trang Plugin và mở được chi tiết của TẤT CẢ bundle trong danh sách.
 */
const ngay = process.argv[3] ?? "10-11";
const urlArg = process.argv[2] ?? "";
const readyPath = join(homedir(), ".galaxy", "blackhole", "ready-url.txt");
const url = urlArg.length > 0 ? urlArg : existsSync(readyPath) ? readFileSync(readyPath, "utf8").trim() : "";
if (url.length === 0) {
  console.log(JSON.stringify({ ok: false, loi: ["khong doc duoc ready-url.txt"] }));
  process.exit(1);
}
/** 12 bundle GBH thử nghiệm: 5 nhóm tính năng + 7 bundle GBH (tên hiển thị trên trang Plugin). */
const DANH_SACH: string[] = [
  "Nhóm agent",
  "Nhập bằng giọng nói",
  "Tự động duyệt uỷ quyền",
  "Công cụ cho nhà phát triển",
  "Worktree Git",
  "Dịch máy suy luận",
  "Terminal",
  "Tìm kiếm phiên",
  "Tiêu đề phiên",
  "Ghi công Galaxy Blackhole",
  "Vòng lặp Ralph",
  "Kho plugin tuỳ chỉnh",
];

/** Bỏ dấu tiếng Việt và đổi khoảng trắng thành '-' để đặt tên ảnh. */
const slugHoa = (ten: string): string =>
  ten
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const pwPath = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = await import(pathToFileURL(pwPath).href);
const chromium = (mod as { chromium?: unknown; default?: { chromium?: unknown } }).chromium ?? (mod as { default?: { chromium?: unknown } }).default?.chromium;
const browser = await (chromium as { launch: (o: unknown) => Promise<any> }).launch({ headless: true, channel: "chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors: string[] = [];
const pageErrors: string[] = [];
page.on("console", (m: { type: () => string; text: () => string }) => {
  if (m.type() === "error") {
    const t = m.text().slice(0, 200);
    /** Lọc nhiễu endpoint ingest của giàn parity (ws://127.0.0.1:9230/ingest) — không phải app. */
    if (!/127\.0\.0\.1:9230|\/ingest/i.test(t)) consoleErrors.push(t);
  }
});
page.on("pageerror", (e: Error) => pageErrors.push(String(e.message).slice(0, 200)));
const goc = "http://127.0.0.1:5439/";
const shotDir = join(process.cwd(), "docs", "tien-do");
mkdirSync(shotDir, { recursive: true });
const ngu = async (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

await page.goto(url, { waitUntil: "load", timeout: 45000 });
await ngu(9000);
const mo = page.getByRole("button", { name: /Mở thanh bên/i });
if ((await mo.count()) > 0) {
  await mo.first().click({ timeout: 4000 });
  await ngu(1000);
}
const nav = page.locator("button", { hasText: /^Plugin$/ });
if ((await nav.count()) > 0) {
  await nav.first().click({ timeout: 8000 });
  await ngu(4500);
}
for (let i = 0; i < 8; i += 1) {
  await page.mouse.wheel(0, 800);
  await ngu(500);
}
await ngu(1500);

const ketQua: Record<string, unknown>[] = [];
const loi: string[] = [];
for (const [i, ten] of DANH_SACH.entries()) {
  const slug = slugHoa(ten);
  const item: Record<string, unknown> = { ten, slug, moDuoc: false, soGbh: -1, soDsh: -1, anh: "" };
  try {
    /** Mỗi bundle một lượt mở app riêng: chi tiết bundle là route inline, không có nút quay lại ổn định. */
    await page.goto(goc, { waitUntil: "load", timeout: 30000 });
    await ngu(6000);
    const moLan = page.getByRole("button", { name: /Mở thanh bên/i });
    if ((await moLan.count()) > 0) {
      await moLan.first().click({ timeout: 3000 }).catch(() => undefined);
      await ngu(900);
    }
    const navLan = page.locator("button", { hasText: /^Plugin$/ });
    if ((await navLan.count()) > 0) {
      await navLan.first().click({ timeout: 6000 }).catch(() => undefined);
      await ngu(4000);
    }
    for (let k = 0; k < 10; k += 1) {
      await page.mouse.wheel(0, 800);
      await ngu(350);
    }
    await ngu(900);
    const the = page.getByText(ten, { exact: true });
    const n = await the.count();
    if (n === 0) {
      item.lyDo = "khong thay the";
      ketQua.push(item);
      continue;
    }
    await the.first().scrollIntoViewIfNeeded({ timeout: 5000 });
    await the.first().click({ timeout: 6000 });
    await ngu(2200);
    const dem = await page.evaluate(() => {
      const vung = (document.querySelector("[data-slot='main']") ?? document.body) as HTMLElement;
      const txt = vung.innerText ?? "";
      const ids = Array.from(txt.matchAll(/@(?:galaxy-blackhole\/gbh-[a-z0-9-]+|deepseek-ai\/dsh-[a-z0-9-]+)/g)).map((m) => m[0]);
      const dong = txt.split("\n").map((s) => s.trim()).filter(Boolean);
      return { gbh: ids.filter((x) => x.startsWith("@galaxy-blackhole/")).length, dsh: ids.filter((x) => x.startsWith("@deepseek-ai/")).length, ids: Array.from(new Set(ids)), dong: dong.slice(0, 12) };
    });
    item.soGbh = dem.gbh;
    item.soDsh = dem.dsh;
    item.ids = (dem as { ids?: string[] }).ids ?? [];
    item.dong = dem.dong;
    const p = join(shotDir, "anh-" + slug + "-" + ngay + ".png");
    await page.screenshot({ path: p });
    item.anh = p;
    item.moDuoc = true;
    /** Quay lại danh sách: bấm nav Plugin rồi cuộn cho mục 'Plugin thử nghiệm' render lại. */
    const navLai = page.locator("button", { hasText: /^Plugin$/ });
    if ((await navLai.count()) > 0) {
      await navLai.first().click({ timeout: 6000 }).catch(() => undefined);
      await ngu(2500);
      for (let k = 0; k < 10; k += 1) {
        await page.mouse.wheel(0, 800);
        await ngu(350);
      }
      await ngu(800);
    }
  } catch (e) {
    item.lyDo = String(e).slice(0, 140);
    loi.push(ten + ": " + String(e).slice(0, 120));
    try {
      await page.keyboard.press("Escape");
      await ngu(800);
    } catch {
      /* bo qua */
    }
  }
  ketQua.push(item);
}
const ok = ketQua.filter((x) => x.moDuoc === true).length === DANH_SACH.length;
const soAnh = ketQua.filter((x) => String(x.anh).length > 0).length;
console.log(JSON.stringify({ ok, ngay, url: url.replace(/token=[^&]+/, "token=<r>"), tongSo: DANH_SACH.length, soAnh, ketQua, consoleErrors, pageErrors, loi }, null, 2));
await browser.close();
