/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 09/11/2026
 * desc Nghiệm thu UI tự động cho GBH: mở app bằng ready-url, thu console (MỌI type) + pageerror,
 *      kiểm trang Plugin (mục 'Plugin thử nghiệm'), Cài đặt → tab Chung (hàng consent 'Tải nhật ký
 *      phiên lên' + bật/tắt thử), và ô soạn tin; chụp ảnh vào docs/tien-do/ rồi in JSON kết quả.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Nhận:
 *   - process.argv[2] (tuỳ chọn) — URL app; mặc định đọc ~/.galaxy/blackhole/ready-url.txt.
 *   - process.argv[3] (tuỳ chọn) — nhãn ngày cho tên ảnh (mặc định "08-11").
 * Trả: in stdout MỘT dòng JSON:
 *   { ok, ngay, url, shots[], plugin, settings, nhatKy, composer, consoleErrors, appConsoleErrors,
 *     ingestErrors, consoleWarnings, pageErrors, loi, soConsole }
 *   plugin   = { moDuoc, coMucThuNghiem, doanMuc, soBundle, soStock, soExperimental, tenGbhThuNghiem[] }
 *   settings = { moDuoc, dong[] (TOÀN BỘ text tab Chung) }
 *   nhatKy   = { coHang, nhan, truoc, sau, daBatTat, coDieuKhien }
 *   composer = { soUngVien, placeholder, laTiengViet, candidates[] }
 *   ok = true chỉ khi Plugin mở được, Cài đặt mở được, hàng consent TỒN TẠI, appConsoleErrors rỗng, pageErrors rỗng.
 */
const ngay = process.argv[3] ?? "08-11";
const urlArg = process.argv[2] ?? "";
const readyPath = join(homedir(), ".galaxy", "blackhole", "ready-url.txt");
const url = urlArg.length > 0 ? urlArg : existsSync(readyPath) ? readFileSync(readyPath, "utf8").trim() : "";
if (url.length === 0) {
  console.log(JSON.stringify({ ok: false, loi: ["khong doc duoc ready-url.txt"] }));
  process.exit(1);
}
const goc = "http://127.0.0.1:5439/";
const pwPath = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = await import(pathToFileURL(pwPath).href);
const chromium = (mod as { chromium?: unknown; default?: { chromium?: unknown } }).chromium ?? (mod as { default?: { chromium?: unknown } }).default?.chromium;
const browser = await (chromium as { launch: (o: unknown) => Promise<any> }).launch({ headless: true, channel: "chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleAll: { type: string; text: string }[] = [];
const pageErrors: string[] = [];
const loi: string[] = [];
const goiSettings: { url: string; status: number }[] = [];
let bundleBody = "";
page.on("console", (msg: { type: () => string; text: () => string }) => {
  consoleAll.push({ type: msg.type(), text: msg.text().slice(0, 300) });
});
page.on("pageerror", (err: Error) => pageErrors.push(String(err.message).slice(0, 300)));
page.on("response", async (res: { url: () => string; status: () => number; text: () => Promise<string> }) => {
  const u = res.url();
  if (/listBundles/.test(u)) {
    try {
      bundleBody = await res.text();
    } catch {
      /* bo qua */
    }
  }
  if (/\/api\/settings\//.test(u)) goiSettings.push({ url: u.replace(goc, "/"), status: res.status() });
});

const shotDir = join(process.cwd(), "docs", "tien-do");
mkdirSync(shotDir, { recursive: true });
const shots: string[] = [];
const ngu = async (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const chup = async (ten: string): Promise<void> => {
  const p = join(shotDir, "anh-" + ten + "-" + ngay + ".png");
  await page.screenshot({ path: p });
  shots.push(p);
};
const moSidebar = async (): Promise<void> => {
  const mo = page.getByRole("button", { name: /Mở thanh bên/i });
  if ((await mo.count()) > 0) {
    try {
      await mo.first().click({ timeout: 4000 });
      await ngu(1200);
    } catch {
      /* bo qua */
    }
  }
};

const plugin: Record<string, unknown> = { moDuoc: false, coMucThuNghiem: false, doanMuc: [], soBundle: -1, soStock: -1, soExperimental: -1, tenGbhThuNghiem: [] };
const settings: Record<string, unknown> = { moDuoc: false, dong: [] };
const nhatKy: Record<string, unknown> = { coHang: false, nhan: "", truoc: "", sau: "", daBatTat: false, coDieuKhien: false };
const composer: Record<string, unknown> = { soUngVien: 0, placeholder: "", laTiengViet: false, candidates: [], overlay: [] };

await page.goto(url, { waitUntil: "load", timeout: 45000 });
await ngu(9000);
await moSidebar();

/** (a) Trang Plugin — mục "Plugin thử nghiệm" phải có ĐỦ bundle GBH thử nghiệm. */
try {
  const nav = page.locator("button", { hasText: /^Plugin$/ });
  if ((await nav.count()) > 0) {
    await nav.first().click({ timeout: 8000 });
    await ngu(4500);
  }
  await chup("plugin-thu-nghiem");
  const info = await page.evaluate(() => {
    const txt = document.body.innerText ?? "";
    const dong = txt.split("\n").map((s) => s.trim()).filter(Boolean);
    const i = dong.findIndex((x) => /Plugin thử nghiệm/i.test(x));
    const sau = i < 0 ? [] : dong.slice(i);
    const soThe = sau.filter((x) => x === "Thêm" || x === "Bật" || x === "Đã bật").length;
    return { coMuc: i >= 0, doan: sau.slice(0, 80), soThe };
  });
  plugin.moDuoc = true;
  plugin.coMucThuNghiem = info.coMuc;
  plugin.doanMuc = info.doan;
  plugin.soTheTrongMuc = (info as { soThe?: number }).soThe ?? -1;
  if (bundleBody.length > 0) {
    try {
      const j = JSON.parse(bundleBody);
      const arr = (j?.result?.value ?? j?.result ?? []) as { name?: string; meta?: { title?: string } }[];
      const ten = Array.isArray(arr) ? arr.map((x) => String(x.name ?? "")) : [];
      plugin.soBundle = ten.length;
      plugin.soStock = ten.filter((n) => n.startsWith("@deepseek-ai/")).length;
      plugin.soExperimental = ten.filter((n) => n.includes("experimental")).length;
      plugin.tenGbhThuNghiem = ten.filter((n) => n.includes("experimental") || n.includes("gbh-")).slice(0, 20);
    } catch {
      /* bo qua */
    }
  }
} catch (e) {
  loi.push("plugin: " + String(e).slice(0, 160));
}

/** (b) Cài đặt → tab Chung: dump TOÀN BỘ text + kiểm hàng consent 'Tải nhật ký phiên lên' + bật/tắt thử. */
try {
  await moSidebar();
  const launcher = page.locator("[data-slot='settings.launcher'] button");
  if ((await launcher.count()) > 0) {
    await launcher.first().click({ timeout: 6000 });
    await ngu(1300);
  }
  const item = page.getByRole("menuitem", { name: "Cài đặt" });
  if ((await item.count()) > 0) {
    await item.first().click({ timeout: 6000 });
    await ngu(2300);
  }
  const tab = page.getByRole("tab", { name: "Chung" });
  if ((await tab.count()) > 0) {
    await tab.first().click({ timeout: 6000 });
    await ngu(1600);
  }
  await chup("nhat-ky-phien");
  const rep = await page.evaluate(() => {
    const d = document.querySelector("[role=dialog]");
    const lines = d === null ? [] : ((d as HTMLElement).innerText ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    return { coDialog: d !== null, dong: lines };
  });
  settings.moDuoc = rep.coDialog;
  settings.dong = rep.dong;
  nhatKy.coHang = rep.dong.some((x: string) => x.includes("Tải nhật ký phiên lên"));

  /** Tìm hàng consent, chụp riêng, đọc điều khiển, bật/tắt thử, đọc lại. */
  const hang = page.locator("[role=dialog] *", { hasText: /Tải nhật ký phiên lên/ }).last();
  if ((await hang.count()) > 0) {
    try {
      await hang.scrollIntoViewIfNeeded({ timeout: 4000 });
      const p = join(shotDir, "anh-nhat-ky-phien-hang-" + ngay + ".png");
      await hang.screenshot({ path: p });
      shots.push(p);
    } catch (e) {
      loi.push("chup-hang: " + String(e).slice(0, 120));
    }
    const doc = async (): Promise<{ co: boolean; truoc: string }> => {
      const r = await page.evaluate(() => {
        const d = document.querySelector("[role=dialog]");
        if (d === null) return { co: false, truoc: "" };
        const ung = Array.from(d.querySelectorAll("[role=switch], input[type=checkbox]"));
        const sw = ung[0] as HTMLElement | undefined;
        if (sw === undefined) return { co: false, truoc: "" };
        const aria = sw.getAttribute("aria-checked");
        const checked = (sw as HTMLInputElement).checked;
        return { co: true, truoc: String(aria !== null ? aria : checked) };
      });
      return r;
    };
    const d1 = await doc();
    nhatKy.coDieuKhien = d1.co;
    nhatKy.truoc = d1.truoc;
    if (d1.co) {
      const sw = page.locator("[role=dialog] [role=switch], [role=dialog] input[type=checkbox]").first();
      await sw.click({ timeout: 5000 });
      await ngu(1800);
      const d2 = await doc();
      nhatKy.sau = d2.truoc;
      nhatKy.daBatTat = d1.truoc !== d2.truoc;
      await chup("nhat-ky-phien-sau-khi-bat");
      /** trả lại trạng thái ban đầu để không để lại rác cấu hình. */
      await sw.click({ timeout: 5000 });
      await ngu(1200);
      const d3 = await doc();
      nhatKy.hoanTac = d3.truoc;
    }
  }
  await page.keyboard.press("Escape");
  await ngu(900);
} catch (e) {
  loi.push("settings: " + String(e).slice(0, 160));
}

/** (c) Ô soạn tin — mở lại app (cookie đã có) rồi đọc placeholder. */
try {
  await page.goto(goc, { waitUntil: "load", timeout: 30000 });
  await ngu(6000);
  type UngVien = { chon: string; aria: string; ph: string; text: string };
  const rep = (await page.evaluate(() => {
    const vung = document.querySelector("[data-slot='main']") ?? document.body;
    const sel = "[contenteditable='true'], textarea, [role='textbox'], [aria-label*='Message or run'], [aria-label*='tin nhắn'], [aria-label*='Nhập']";
    const ung: { chon: string; aria: string; ph: string; text: string }[] = [];
    for (const el of Array.from(vung.querySelectorAll(sel))) {
      const h = el as HTMLElement;
      ung.push({
        chon: h.tagName.toLowerCase(),
        aria: h.getAttribute("aria-label") ?? "",
        ph: h.getAttribute("data-placeholder") ?? h.getAttribute("aria-placeholder") ?? ((h as HTMLTextAreaElement).placeholder ?? ""),
        text: (h.innerText ?? "").trim().slice(0, 90),
      });
    }
    const holder = document.querySelector("[data-slot='conversation.input.overlay']") as HTMLElement | null;
    const overlay = holder === null ? [] : (holder.innerText ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
    return { ung: ung.slice(0, 8), overlay: overlay.slice(0, 6) };
  })) as { ung: UngVien[]; overlay: string[] };
  const dau = rep.ung[0];
  composer.soUngVien = rep.ung.length;
  composer.candidates = rep.ung.map((x) => x.chon + "|aria=" + x.aria + "|ph=" + x.ph).slice(0, 6);
  composer.placeholder = dau === undefined ? "" : (dau.ph.length > 0 ? dau.ph : dau.aria).slice(0, 160);
  composer.overlay = rep.overlay;
  const gop = rep.ung.map((x) => x.aria + " " + x.ph + " " + x.text).join(" ") + " " + rep.overlay.join(" ");
  composer.laTiengViet = /[àáảãạăâđêôơưýỳỷỹỵ]/i.test(gop);
  await chup("o-soan-tin");
} catch (e) {
  loi.push("composer: " + String(e).slice(0, 160));
}

const consoleErrors = consoleAll.filter((c) => c.type === "error");
const consoleWarnings = consoleAll.filter((c) => c.type === "warning");
/** Tách nhiễu của giàn parity (ws://127.0.0.1:9230/ingest) ra khỏi lỗi của APP. */
const laIngest = (t: string): boolean => /127\.0\.0\.1:9230|\/ingest/i.test(t);
const appConsoleErrors = consoleErrors.filter((c) => !laIngest(c.text));
const ingestErrors = consoleErrors.filter((c) => laIngest(c.text));
const ok = plugin.moDuoc === true && settings.moDuoc === true && nhatKy.coHang === true && appConsoleErrors.length === 0 && pageErrors.length === 0;
console.log(
  JSON.stringify(
    { ok, ngay, url: url.replace(/token=[^&]+/, "token=<r>"), shots, plugin, settings, nhatKy, composer, goiSettings, consoleErrors, appConsoleErrors, ingestErrors, consoleWarnings, pageErrors, loi, soConsole: consoleAll.length },
    null,
    2,
  ),
);
await browser.close();
