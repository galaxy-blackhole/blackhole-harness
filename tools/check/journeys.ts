/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Kich ban A/B va oracle DSH stock de doi chieu hanh vi
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Thư mục ghi bằng chứng JSON/PNG. */
export const EVIDENCE_DIR = join(import.meta.dir, "..", "..", "docs", "evidence", "stock-baseline");

/** Gốc cài Playwright dùng cho kịch bản (mặc định bản cài tạm ở /tmp/pw). */
const PW_ROOT = process.env.GBH_PLAYWRIGHT_ROOT ?? "/tmp/pw/node_modules";

/** URL app ta, đọc từ ready-url của host 5439 khi không truyền tham số. */
export function gbhUrl(): string {
  const override = process.env.GBH_URL?.trim();
  if (override !== undefined && override !== "") return override;
  return readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
}

/** URL oracle stock, đọc từ tệp ready-url do stock-baseline ghi. */
export function stockUrl(): string {
  const override = process.env.STOCK_URL?.trim();
  if (override !== undefined && override !== "") return override;
  return readFileSync("/tmp/stock-home/ready-url.txt", "utf8").trim();
}

/** Một dòng so sánh giữa stock và ta. */
export interface CompareRow {
  /** Mục đo. */
  metric: string;
  /** Giá trị bên stock (chuỗi hoá để in bảng). */
  stock: string;
  /** Giá trị bên ta. */
  ours: string;
  /** KHỚP khi hai chuỗi bằng nhau. */
  verdict: "KHỚP" | "LỆCH";
}

/** Bề mặt một hành động đo được ở một app. */
export interface JourneyStep {
  /** Ghi chú/hành vi quan sát được (vd modal chặn, lỗi lưu). */
  observations: string[];
  /** Dữ liệu đo. */
  data: Record<string, unknown>;
}

/** Toàn bộ kết quả một app. */
export interface AppRun {
  /** Nhãn app: "stock" hoặc "gbh". */
  app: string;
  /** URL đã dùng (đã che token). */
  url: string;
  /** Thời điểm chạy (ISO). */
  capturedAt: string;
  /** Các bước a–e. */
  steps: Record<string, JourneyStep>;
  /** Ảnh chụp đã lưu (đường dẫn tương đối repo). */
  screenshots: string[];
  /** Lỗi trang (pageerror) ghi được. */
  pageErrors: string[];
  /** Lệnh chạy lại kịch bản (ghi vào JSON để tái lập). */
  reproduce: string;
  /** Ghi chú tự do phát hiện trong lúc chạy (vd modal không lưu được acknowledgement). */
  notes: string[];
}

type Pw = any;

/**
 * Bỏ overlay chặn (Preview Notice, Get started…): bấm Continue/đóng; nếu kẹt thì GỠ DOM và ghi nhận.
 * @param page - trang Playwright.
 * @param observations - mảng ghi chú của bước.
 * @returns true khi đã phải gỡ DOM cưỡng bức.
 */
async function dismissOverlays(page: Pw, observations: string[]): Promise<boolean> {
  let forced = false;
  for (let i = 0; i < 5; i += 1) {
    const masks = await page.locator('div[aria-hidden="true"][class*="mask"]').count();
    if (masks === 0) break;
    const continueButton = page.locator('button:has-text("Continue")').first();
    if ((await continueButton.count()) > 0 && (await continueButton.isVisible().catch(() => false))) {
      await continueButton.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
    }
    const closeButton = page.locator('[role="dialog"] button[aria-label*="Close" i], [role="dialog"] button[aria-label*="close" i]').first();
    if ((await closeButton.count()) > 0 && (await closeButton.isVisible().catch(() => false))) {
      await closeButton.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
    const stillMasked = await page.locator('div[aria-hidden="true"][class*="mask"]').count();
    if (stillMasked > 0 && i === 4) {
      const text = ((await page.locator("body").innerText()) || "").slice(0, 600);
      if (/could not be saved/i.test(text)) observations.push("modal báo 'could not be saved' — ack KHÔNG lưu được (settings/mutate bị từ chối)");
      // ẨN overlay bằng CSS thay vì gỡ DOM: giữ nguyên cây React, chỉ bỏ chặn con trỏ.
      await page.addStyleTag({ content: 'div[aria-hidden="true"][class*="mask"]{display:none !important} div[role="dialog"]{display:none !important} div[class*="mask"]{pointer-events:none !important}' });
      forced = true;
      observations.push("phải ẨN overlay bằng CSS để đi tiếp (ghi nhận trung thực: người dùng thật bị chặn)");
      break;
    }
  }
  return forced;
}

/**
 * Chụp ảnh full page vào thư mục bằng chứng.
 * @param page - trang Playwright.
 * @param name - tên tệp không đuôi.
 * @param screenshots - mảng đường dẫn tích luỹ.
 * @returns đường dẫn tương đối repo.
 */
async function shot(page: Pw, name: string, screenshots: string[]): Promise<string> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const abs = join(EVIDENCE_DIR, name + ".png");
  await page.screenshot({ path: abs, fullPage: true });
  const rel = "docs/evidence/stock-baseline/" + name + ".png";
  screenshots.push(rel);
  return rel;
}

/**
 * Mở Settings: ưu tiên phím tắt ⌥⌘, (data-shortcut-modal="settings"), fallback menu tài khoản.
 * @param page - trang Playwright.
 * @param observations - ghi chú.
 * @returns danh sách mục menu tài khoản (rỗng khi dùng phím tắt).
 */
async function openSettings(page: Pw, observations: string[]): Promise<string[]> {
  await page.keyboard.press("Meta+Alt+Comma").catch(() => {});
  await page.waitForTimeout(1200);
  if ((await page.locator('[role="dialog"][data-shortcut-modal="settings"], [data-shortcut-modal="settings"]').count()) === 0) {
    const account = page.locator('[aria-label="Account menu"]').first();
    if ((await account.count()) > 0) {
      await account.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
      const settings = page.locator('[role=menuitem]:has-text("Settings")').first();
      if ((await settings.count()) > 0) {
        await settings.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1200);
      } else observations.push("phím tắt + menu đều không mở được Settings");
    }
  }
  const items: string[] = await page.locator("[role=menuitem]").evaluateAll((els: Element[]) => els.map((e) => (e.textContent || "").trim().slice(0, 60)));
  return items;
}

/**
 * Đọc danh sách mục điều hướng trong Settings.
 * @param page - trang Playwright.
 * @returns nhãn các mục.
 */
async function settingsNav(page: Pw): Promise<string[]> {
  const dialog = page.locator('[role="dialog"][data-shortcut-modal="settings"], [data-shortcut-modal="settings"]').first();
  const root = (await dialog.count()) > 0 ? dialog : page.locator("body");
  return root.locator("nav button, [role=tab]").evaluateAll((els: Element[]) =>
    els.map((e) => (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)).filter((text: string) => text !== ""),
  );
}

/**
 * Chạy kịch bản a–e trên MỘT app.
 * @param browser - trình duyệt Playwright đã mở.
 * @param label - "stock" hoặc "gbh".
 * @param url - URL có token.
 * @returns kết quả đo.
 */
export async function runApp(browser: Pw, label: string, url: string): Promise<AppRun> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error: Error) => pageErrors.push(String(error).slice(0, 300)));
  const run: AppRun = {
    app: label,
    url: url.replace(/token=[^&]+/u, "token=***"),
    capturedAt: new Date().toISOString(),
    steps: {},
    screenshots: [],
    pageErrors,
    notes: [],
    reproduce: "bun run tools/check/stock-baseline.ts   # boot stock ở 5466 (hoặc --reuse)" + "\n" + "GBH_URL=$(cat ~/.galaxy/blackhole/ready-url.txt) STOCK_URL=$(cat /tmp/stock-home/ready-url.txt) bun run tools/check/journeys.ts",
  };
  const mk = (observations: string[], data: Record<string, unknown> = {}): JourneyStep => ({ observations, data });
  const aObs: string[] = [];
  const bObs: string[] = [];
  const cObs: string[] = [];
  const dObs: string[] = [];
  const eObs: string[] = [];
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    const bodyAtBoot = ((await page.locator("body").innerText()) || "").slice(0, 4000);
    if (/could not be saved/i.test(bodyAtBoot)) run.notes.push("modal Preview Notice báo 'could not be saved' ngay khi boot (settings/mutate bị từ chối)");
    await dismissOverlays(page, aObs);
    await shot(page, label + "-a-home", run.screenshots);

    // (a) mở phiên → [role=tab]
    const newSession = page.locator('button[aria-label="New session"], button:has-text("New Session")').first();
    if ((await newSession.count()) > 0) await newSession.click({ force: true }).catch((e: Error) => aObs.push("click New Session lỗi: " + String(e).slice(0, 120)));
    await page.waitForTimeout(1500);
    const tabs = await page.locator('[role="tab"]').evaluateAll((els: Element[]) => els.map((e) => (e.textContent || "").trim().slice(0, 60)));
    run.steps.aSession = mk(aObs, { tabCount: tabs.length, tabs });
    await shot(page, label + "-a-session", run.screenshots);

    // (b) Settings → General
    const menu = await openSettings(page, bObs);
    const nav = await settingsNav(page);
    const generalItem = page.locator('[role="tab"]:has-text("General"), button:has-text("General"), a:has-text("General")').first();
    if ((await generalItem.count()) > 0) {
      await generalItem.click({ force: true }).catch(() => {});
      await page.waitForTimeout(900);
    }
    const dialog = page.locator('[role="dialog"][data-shortcut-modal="settings"], [data-shortcut-modal="settings"]').first();
    const scoped = (await dialog.count()) > 0 ? dialog : page.locator("body");
    const generalText = ((await scoped.innerText()) || "").slice(0, 8000);
    // Tiêu đề dòng = chữ NGẮN trong các phần tử tiêu đề/nhãn của pane General (không phải nav).
    const rowTitles = await scoped
      .locator('h2, h3, h4, [class*="title"], [class*="Title"], [class*="label"], [class*="Label"], [class*="field"], [class*="Field"]')
      .evaluateAll((els: Element[]) => els.map((e) => (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80)).filter((text: string) => text !== "" && text !== "Settings"));
    const hasPermission = /Permission/i.test(generalText);
    run.steps.bGeneral = mk(bObs, { menu, nav, rowTitles, hasPermissionRow: hasPermission, textSample: generalText.slice(0, 2500) });
    await shot(page, label + "-b-general", run.screenshots);

    // (c) công tắc "Show coding view"
    const codingSwitch = page.locator('[role="switch"][aria-label*="coding" i], [role="switch"][aria-label*="Coding" i], label:has-text("Show coding view") [role="switch"], label:has-text("Show coding view")').first();
    const before = (await codingSwitch.count()) > 0 ? await codingSwitch.getAttribute("aria-checked").catch(() => null) : null;
    if ((await codingSwitch.count()) === 0) cObs.push("không thấy công tắc 'Show coding view'");
    else await codingSwitch.click({ force: true }).catch((e: Error) => cObs.push("click công tắc lỗi: " + String(e).slice(0, 120)));
    await page.waitForTimeout(700);
    const shortlyAfter = (await codingSwitch.count()) > 0 ? await codingSwitch.getAttribute("aria-checked").catch(() => null) : null;
    await page.waitForTimeout(2300);
    const bodyAfter = ((await page.locator("body").innerText()) || "").slice(0, 4000);
    const saveError = /Could not save|could not be saved|Không lưu được/i.test(bodyAfter);
    const after = (await codingSwitch.count()) > 0 ? await codingSwitch.getAttribute("aria-checked").catch(() => null) : null;
    await shot(page, label + "-c-toggle", run.screenshots);
    // persist sau reload
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    await dismissOverlays(page, cObs);
    await openSettings(page, cObs);
    const general2 = page.locator('[role="tab"]:has-text("General"), button:has-text("General"), a:has-text("General")').first();
    if ((await general2.count()) > 0) { await general2.click({ force: true }).catch(() => {}); await page.waitForTimeout(800); }
    const codingSwitch2 = page.locator('[role="switch"][aria-label*="coding" i], [role="switch"][aria-label*="Coding" i], label:has-text("Show coding view") [role="switch"], label:has-text("Show coding view")').first();
    const afterReload = (await codingSwitch2.count()) > 0 ? await codingSwitch2.getAttribute("aria-checked").catch(() => null) : null;
    run.steps.cCodingView = mk(cObs, { found: (await codingSwitch.count()) > 0, before, shortlyAfter, after, afterReload, saveError });
    await shot(page, label + "-c-reload", run.screenshots);

    // (d) Settings → Preset agent
    const presetItem = page.locator('[data-shortcut-modal="settings"] nav button:has-text("Agent presets"), [role="dialog"] button:has-text("Agent presets")').first();
    if ((await presetItem.count()) > 0) {
      await presetItem.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
    } else dObs.push("không thấy mục Agent presets");
    const presetDialog = page.locator('[role="dialog"][data-shortcut-modal="settings"], [data-shortcut-modal="settings"]').first();
    const presetScope = (await presetDialog.count()) > 0 ? presetDialog : page.locator("body");
    const presetText = ((await presetScope.innerText()) || "").slice(0, 12000);
    const lines = presetText.split("\n").map((line: string) => line.trim()).filter((line: string) => line.length > 0);
    const statusRe = /^(BUILT-IN|Built-in|New task default|CUSTOM|Custom|Failed to load|Active|Đang dùng|Tích hợp sẵn|Tải thất bại)$/u;
    const badges = lines.filter((line: string) => statusRe.test(line));
    // Cặp [badge, tên preset] = badge rồi tới dòng kế tiếp (đúng thứ tự hiển thị).
    const pairs = badges.map((status: string) => {
      const index = lines.indexOf(status);
      return { status, name: lines[index + 1] ?? "" };
    });
    const presetErrors = lines.filter((line: string) => /Failed to load|has been registered|already has locale|could not be saved/i.test(line)).slice(0, 20);
    run.steps.dPreset = mk(dObs, { badges, pairs, presetErrors, presetNames: lines.slice(0, 120), textSample: presetText.slice(0, 4000) });
    await shot(page, label + "-d-preset", run.screenshots);

    // (e) trong phiên chat: rect [data-testid] hoặc khối lớn + screenshot
    const sessionRow = page.locator('[aria-label^="Session actions for"]').first();
    if ((await sessionRow.count()) > 0) {
      await sessionRow.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape").catch(() => {});
    }
    const newSession2 = page.locator('button[aria-label="New session"], button:has-text("New Session")').first();
    if ((await newSession2.count()) > 0) await newSession2.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1800);
    const testids = await page.locator("[data-testid]").evaluateAll((els: Element[]) => [...new Set(els.map((e) => e.getAttribute("data-testid")))].filter((v): v is string => v !== null));
    const rects = await page.locator("header, main, [data-testid], textarea, [contenteditable=true], [class*=composer]").evaluateAll((els: Element[]) => {
      const pageWidth = window.innerWidth;
      return els.slice(0, 40).map((e) => {
        const r = e.getBoundingClientRect();
        return { tag: e.tagName.toLowerCase(), testid: e.getAttribute("data-testid"), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), pageWidth };
      });
    });
    run.steps.eChat = mk(eObs, { testids, rects, textSample: ((await page.locator("body").innerText()) || "").slice(0, 1500) });
    await shot(page, label + "-e-chat", run.screenshots);
  } catch (error) {
    run.steps.fatal = { observations: ["kịch bản dừng: " + String(error).slice(0, 500)], data: {} };
  } finally {
    await context.close().catch(() => {});
  }
  return run;
}

/**
 * Dựng bảng so sánh từ hai kết quả.
 * @param stock - kết quả stock.
 * @param ours - kết quả app ta.
 * @returns các dòng so sánh.
 */
export function compareRuns(stock: AppRun, ours: AppRun): CompareRow[] {
  const rows: CompareRow[] = [];
  const add = (metric: string, left: unknown, right: unknown): void => {
    const s = JSON.stringify(left) ?? "undefined";
    const o = JSON.stringify(right) ?? "undefined";
    rows.push({ metric, stock: s.length > 220 ? s.slice(0, 217) + "..." : s, ours: o.length > 220 ? o.slice(0, 217) + "..." : o, verdict: s === o ? "KHỚP" : "LỆCH" });
  };
  add("(a) số [role=tab]", stock.steps.aSession?.data["tabCount"], ours.steps.aSession?.data["tabCount"]);
  add("(a) nhãn tab", stock.steps.aSession?.data["tabs"], ours.steps.aSession?.data["tabs"]);
  add("(b) mục nav Settings", stock.steps.bGeneral?.data["nav"], ours.steps.bGeneral?.data["nav"]);
  add("(b) tiêu đề dòng", stock.steps.bGeneral?.data["rowTitles"], ours.steps.bGeneral?.data["rowTitles"]);
  add("(b) có dòng Permission", stock.steps.bGeneral?.data["hasPermissionRow"], ours.steps.bGeneral?.data["hasPermissionRow"]);
  add("(c) aria-checked trước", stock.steps.cCodingView?.data["before"], ours.steps.cCodingView?.data["before"]);
  add("(c) aria-checked sau 3s", stock.steps.cCodingView?.data["after"], ours.steps.cCodingView?.data["after"]);
  add("(c) lỗi 'Could not save'", stock.steps.cCodingView?.data["saveError"], ours.steps.cCodingView?.data["saveError"]);
  add("(c) persist sau reload", stock.steps.cCodingView?.data["afterReload"], ours.steps.cCodingView?.data["afterReload"]);
  add("(d) badge preset", stock.steps.dPreset?.data["badges"], ours.steps.dPreset?.data["badges"]);
  add("(d) cặp badge + tên preset", stock.steps.dPreset?.data["pairs"], ours.steps.dPreset?.data["pairs"]);
  add("(d) lỗi hiển thị trong pane preset", stock.steps.dPreset?.data["presetErrors"], ours.steps.dPreset?.data["presetErrors"]);
  add("(e) data-testid", stock.steps.eChat?.data["testids"], ours.steps.eChat?.data["testids"]);
  const blocks = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []).filter((r) => Number(r["w"]) > 0 && Number(r["h"]) > 0);
  const left = blocks(stock.steps.eChat?.data["rects"]);
  const right = blocks(ours.steps.eChat?.data["rects"]);
  const close = left.length === right.length && left.every((r, index) => {
    const o = right[index];
    return o !== undefined && r["tag"] === o["tag"] && ["x", "y", "w", "h"].every((key) => Math.abs(Number(r[key]) - Number(o[key])) <= 4);
  });
  rows.push({ metric: "(e) block lớn (±4px, bỏ khối 0×0)", stock: JSON.stringify(left), ours: JSON.stringify(right), verdict: close ? "KHỚP" : "LỆCH" });
  add("pageerror", stock.pageErrors, ours.pageErrors);
  return rows;
}

/**
 * In bảng so sánh ra stdout.
 * @param rows - các dòng so sánh.
 */
export function printTable(rows: CompareRow[]): void {
  const width = Math.max(...rows.map((row) => row.metric.length), 5);
  console.log("\n" + "MỤC".padEnd(width) + " | STOCK | TA | KẾT LUẬN");
  for (const row of rows) console.log(row.metric.padEnd(width) + " | " + row.stock + " | " + row.ours + " | " + row.verdict);
  const diff = rows.filter((row) => row.verdict === "LỆCH").length;
  console.log("\nTỔNG: " + String(rows.length) + " mục · KHỚP " + String(rows.length - diff) + " · LỆCH " + String(diff));
}

if (import.meta.main) {
  const { chromium } = await import(join(PW_ROOT, "playwright", "index.mjs"));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const stockRun = await runApp(browser, "stock", stockUrl());
  const oursRun = await runApp(browser, "gbh", gbhUrl());
  await browser.close();
  writeFileSync(join(EVIDENCE_DIR, "stock.json"), JSON.stringify(stockRun, null, 2) + "\n", "utf8");
  writeFileSync(join(EVIDENCE_DIR, "gbh.json"), JSON.stringify(oursRun, null, 2) + "\n", "utf8");
  const rows = compareRuns(stockRun, oursRun);
  writeFileSync(
    join(EVIDENCE_DIR, "compare.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), reproduce: "bun run tools/check/journeys.ts", rows }, null, 2) + "\n",
    "utf8",
  );
  printTable(rows);
}
