/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chụp A/B màn Settings (mở modal, mục Chung) giữa app của ta (5439) và oracle A (4001) + so pixel + đọc DOM: nút Mở tệp cấu hình và mức độ dịch tiếng Việt
 */

// VI SAO CO CONG CU NAY
//   Thay doi UI cua phien 18/10/2026 gom hai phan kho do bang mat thuong: (1) them nut "Mo tep cau hinh"
//   trong ghe settings.action; (2) dich toan bo panel sang tieng Viet. Can bang chung PIXEL (anh A/B) va
//   bang chung DOM (nhan nut, so dong tieng Anh con lai) — khong the chi noi "da sua".
//
// PHEP DO
//   - Mo modal Settings bang menu tai khoan, bam muc nav "Chung"/"General", chup 1440x900 moi ben.
//   - So pixel giua hai anh (pixelmatch) — khac biet ngon ngu la CO CHU DICH nen con so nay de GHI LAI,
//     khong phai de "PASS"; phan ket luan nam o DOM: nhan nut + so dong tieng Anh trong panel.
//   - Cookie phien mint trong bo nho tu ~/.galaxy/credentials.yaml (dung chung cho ca 5439 va 4001 —
//     do duoc 18/10/2026: fetch 4001 bang cookie nay tra 200 · 48853 B).
//
// CACH DUNG
//   bun run tools/check/settings-ab.ts            # 5439 (ours) vs 4001 (oracle A)
//   bun run tools/check/settings-ab.ts --ours 5439 --ref 4001
//   Artifact: .parity/settings-ab/{ref,ours}-settings-general.png + evidence.json

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { type ChromeSession, closeChromeSession, resolveSessionCookieFrom } from "../parity/lib/browser.ts";
import { pixelDiff, pngSize, ratioPercent } from "../parity/lib/image.ts";
import { repoRoot } from "../../apps/cli/src/paths.ts";
import { appHome, credentialsPath, ensureDir, parityPath } from "../parity/lib/paths.ts";
import { runLab } from "../lab/row.ts";
import { cleanupLab } from "./lab-evidence.ts";
import { acquireLabLock, releaseLabLock } from "./lab-lock.ts";

/** Cổng app của ta (mặc định là host 5439). */
export const OURS_PORT = 5439;

/** Cổng oracle A (blackhole web đang chạy). */
export const REF_PORT = 4001;

/** Viewport chụp A/B (cùng khung thì pixel mới so được). */
export const VIEWPORT = { width: 1440, height: 900 } as const;

/** Một nút đọc được trong panel Settings. */
export interface PanelButton {
  /** Nhãn hiển thị. */
  text: string;
  /** Lớp CSS (cắt ngắn) để truy ra primitive. */
  cls: string;
}

/** Bằng chứng DOM của một bên. */
export interface SettingsSideEvidence {
  /** Nhãn bên: ref/ours. */
  label: string;
  /** Cổng. */
  port: number;
  /** Mã HTTP khi mở trang. */
  httpStatus: number;
  /** true khi bấm được menu tài khoản. */
  menuClicked: boolean;
  /** true khi bấm được mục Settings/Cài đặt. */
  settingsClicked: boolean;
  /** true khi bấm được mục nav Chung/General. */
  generalClicked: boolean;
  /** Nhãn các mục nav trong panel. */
  navLabels: string[];
  /** Nhãn mọi button trong panel. */
  buttons: PanelButton[];
  /** Chữ của ghế settings.action (rỗng khi ghế trống). */
  actionSlotText: string;
  /** Độ dài innerHTML của ghế settings.action (0 = ghế trống). */
  actionSlotHtmlLength: number;
  /** Số dòng chữ trong panel. */
  panelLineCount: number;
  /** Các dòng trông như TIẾNG ANH (chỉ ASCII + có chữ thường). */
  englishLines: string[];
  /** Các dòng có dấu tiếng Việt. */
  vietnameseLines: string[];
  /** Ảnh chụp (đường dẫn tuyệt đối). */
  pngFile: string;
  /** Tệp toàn bộ chữ panel (để đọc lại khi cần). */
  panelTextFile: string;
}

/** Kết quả một lần đo A/B. */
export interface SettingsAbResult {
  /** Dấu thời gian. */
  measuredAt: string;
  /** Bên tham chiếu. */
  ref: SettingsSideEvidence;
  /** Bên của ta. */
  ours: SettingsSideEvidence;
  /** Số pixel khác nhau. */
  diffPixels: number;
  /** Tổng số pixel. */
  totalPixels: number;
  /** Tỉ lệ khác nhau (0..1). */
  ratio: number;
  /** Kích thước ảnh. */
  width: number;
  /** Chiều cao ảnh. */
  height: number;
  /** Ảnh diff (đường dẫn tuyệt đối). */
  diffFile: string;
  /** Kết luận ngắn. */
  conclusion: string;
}

/** Trang Playwright tối thiểu mà công cụ cần. */
interface AbPage {
  /** Đăng ký/không dùng — chỉ để tương thích. */
  waitForTimeout: (ms: number) => Promise<void>;
  /** Điều hướng. */
  goto: (url: string, options: unknown) => Promise<{ status: () => number } | null>;
  /** Chụp ảnh. */
  screenshot: (options: unknown) => Promise<Buffer>;
  /** Chạy mã trong trang. */
  evaluate: <T>(fn: () => T) => Promise<T>;
  /** Chờ hàm trong trang. */
  waitForFunction: (fn: () => boolean, options: unknown) => Promise<unknown>;
  /** Đặt viewport. */
  setViewportSize: (size: { width: number; height: number }) => Promise<void>;
  /** Đóng trang. */
  close: () => Promise<void>;
}

/**
 * Bấm menu tài khoản (Account menu/More) — cửa vào Settings.
 * @param page trang đang mở.
 * @returns true khi bấm được.
 */
async function clickAccountMenu(page: AbPage): Promise<boolean> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("button,[role='button']")) as HTMLElement[];
    const menu =
      nodes.find((node) => (node.getAttribute("aria-label") ?? "") === "Account menu") ??
      nodes.find((node) => /^(more|account|tài khoản|thêm)$/iu.test((node.textContent ?? "").replace(/\s+/gu, " ").trim())) ??
      nodes.find((node) => /more|account|tài khoản/iu.test((node.textContent ?? "") + " " + (node.getAttribute("aria-label") ?? "")));
    if (menu === undefined) return false;
    menu.click();
    return true;
  });
}

/**
 * Bấm mục Settings/Cài đặt trong menu vừa mở.
 * @param page trang đang mở.
 * @returns true khi bấm được.
 */
async function clickSettingsItem(page: AbPage): Promise<boolean> {
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[role='menuitem'],button,a")) as HTMLElement[];
    const target = items.find((node) => /^(settings|cài đặt|设置)$/iu.test((node.textContent ?? "").replace(/\s+/gu, " ").trim()));
    if (target === undefined) return false;
    target.click();
    return true;
  });
}

/**
 * Bấm mục nav Chung/General trong modal Settings.
 * @param page trang đang mở.
 * @returns true khi bấm được.
 */
async function clickGeneralNav(page: AbPage): Promise<boolean> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("nav a, nav button, [role='tab'], button, a")) as HTMLElement[];
    const target = nodes.find((node) => /^(general|chung)$/iu.test((node.textContent ?? "").replace(/\s+/gu, " ").trim()));
    if (target === undefined) return false;
    target.click();
    return true;
  });
}

/**
 * Đọc panel Settings đang mở: nav, button, ghế settings.action, dòng tiếng Anh/tiếng Việt.
 * @param page trang đang mở.
 * @returns bằng chứng DOM (chưa có đường dẫn file).
 */
async function readPanel(page: AbPage): Promise<{
  navLabels: string[];
  buttons: PanelButton[];
  actionSlotText: string;
  actionSlotHtmlLength: number;
  panelLineCount: number;
  englishLines: string[];
  vietnameseLines: string[];
  panelText: string;
}> {
  return page.evaluate(() => {
    // Tim panel modal: phan tu fixed/absolute lon nhat co chu (panel Settings nam tren lop phu).
    const candidates = (Array.from(document.querySelectorAll("div,section,aside")) as HTMLElement[])
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const cs = getComputedStyle(node);
        const fixed = cs.position === "fixed" || cs.position === "absolute";
        const visible = cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) >= 0.05;
        const z = Number.parseInt(cs.zIndex, 10);
        const text = (node.innerText ?? "").trim();
        return { node, rect, fixed, visible, z: Number.isNaN(z) ? 0 : z, textLength: text.length };
      })
      .filter((row) => row.fixed && row.visible && row.z >= 10 && row.rect.width >= 500 && row.rect.height >= 400 && row.textLength > 40)
      .sort((left, right) => right.textLength - left.textLength);
    const panel = candidates[0]?.node;
    const viPattern = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/iu;
    const asciiLine = /^[A-Za-z][A-Za-z0-9 '&()/,.:!?-]{2,80}$/u;
    const panelText = (panel?.innerText ?? "").split("\n").map((line) => line.trim()).filter((line) => line !== "");
    const navLabels = (Array.from((panel ?? document).querySelectorAll("nav a, nav button, [role='tab']")) as HTMLElement[])
      .map((node) => (node.textContent ?? "").replace(/\s+/gu, " ").trim())
      .filter((text) => text !== "" && text.length <= 28);
    const buttons = (Array.from((panel ?? document).querySelectorAll("button")) as HTMLElement[])
      .map((node) => ({ text: (node.textContent ?? "").replace(/\s+/gu, " ").trim(), cls: String(node.className).slice(0, 80) }))
      .filter((button) => button.text !== "");
    const slot = (panel ?? document).querySelector("[data-slot='settings.action']") as HTMLElement | null;
    return {
      navLabels: [...new Set(navLabels)],
      buttons,
      actionSlotText: slot === null ? "" : (slot.textContent ?? "").replace(/\s+/gu, " ").trim(),
      actionSlotHtmlLength: slot === null ? 0 : slot.innerHTML.length,
      panelLineCount: panelText.length,
      englishLines: panelText.filter((line) => asciiLine.test(line) && /[a-z]/u.test(line) && !viPattern.test(line)),
      vietnameseLines: panelText.filter((line) => viPattern.test(line)),
      panelText: panelText.join("\n"),
    };
  });
}

/**
 * Chụp một bên: mở app, mở Settings, bấm mục Chung/General, chụp ảnh + đọc DOM.
 * @param session phiên Chrome dùng chung.
 * @param port cổng app.
 * @param label nhãn bên (ref/ours).
 * @param outDir thư mục artifact.
 * @returns bằng chứng của bên đó.
 */
export async function captureSide(
  session: ChromeSession,
  port: number,
  label: string,
  outDir: string,
  url?: string,
): Promise<SettingsSideEvidence> {
  // DUONG VAO: URL co token (ready-url cua app / URL cua lab) la duong CHAC CHAN — cookie mint tu file
  //   credentials tra 401 tren 5439 (do 18/10/2026), con navigate bang token thi host tu dat cookie.
  //   Cookie mint chi con la duong LUI khi khong co URL.
  if (url === undefined) {
    const auth = resolveSessionCookieFrom(port, [join(appHome(), ".credentials.yaml"), credentialsPath()]);
    if (auth.cookie !== null) {
      await session.context.addCookies([{ name: auth.cookie.name, value: auth.cookie.value, domain: "127.0.0.1", path: "/" }]);
    }
  }
  const target = url ?? "http://127.0.0.1:" + String(port) + "/";
  const page = (await session.context.newPage()) as unknown as AbPage;
  await page.setViewportSize(VIEWPORT);
  try {
    const response = await page.goto(target, { waitUntil: "load", timeout: 30_000 });
    const httpStatus = response === null ? 0 : response.status();
    await page.waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(3_000);
    const menuClicked = await clickAccountMenu(page);
    await page.waitForTimeout(1_200);
    const settingsClicked = await clickSettingsItem(page);
    await page.waitForTimeout(2_500);
    const generalClicked = await clickGeneralNav(page);
    await page.waitForTimeout(1_500);
    const panel = await readPanel(page);
    const pngFile = join(outDir, label + "-settings-general.png");
    await page.screenshot({ path: pngFile, type: "png" });
    const panelTextFile = join(outDir, label + "-settings-general.txt");
    writeFileSync(panelTextFile, panel.panelText, "utf8");
    return {
      label,
      port,
      httpStatus,
      menuClicked,
      settingsClicked,
      generalClicked,
      navLabels: panel.navLabels,
      buttons: panel.buttons,
      actionSlotText: panel.actionSlotText,
      actionSlotHtmlLength: panel.actionSlotHtmlLength,
      panelLineCount: panel.panelLineCount,
      englishLines: panel.englishLines,
      vietnameseLines: panel.vietnameseLines,
      pngFile,
      panelTextFile,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Chạy phép đo A/B đầy đủ: chụp hai bên cùng viewport, so pixel, ghi artifact + in khối bằng chứng.
 * @param options cổng hai bên.
 * @returns kết quả có cấu trúc.
 */
/**
 * Mở Chrome với LOCALE cụ thể (launchChrome của giàn parity cố định en-US).
 *
 * Vì sao cần: ngôn ngữ của app web lấy từ navigator.languages khi chưa có preference trong settings.
 * Muốn chụp "TRƯỚC khi dịch" (English) và "SAU khi dịch" (Tiếng Việt) trên CÙNG build thì biến duy
 * nhất phải là locale của trình duyệt.
 * @param stamp hậu tố tên profile tạm.
 * @param locale locale BCP 47 của trình duyệt.
 * @returns phiên Chrome (cùng hình dạng ChromeSession để dùng closeChromeSession).
 */
export async function launchChromeWithLocale(stamp: string, locale: string): Promise<ChromeSession> {
  const pw = join(repoRootOfParity(), "node_modules", "playwright-core", "index.js");
  const mod = (await import(pathToFileURL(pw).href)) as {
    chromium?: { launchPersistentContext: (dir: string, options: unknown) => Promise<ChromeSession["context"]> };
    default?: { chromium?: { launchPersistentContext: (dir: string, options: unknown) => Promise<ChromeSession["context"]> } };
  };
  const chromium = mod.chromium ?? mod.default?.chromium;
  if (chromium === undefined) throw new Error("khong nap duoc playwright-core");
  const root = parityPath("tmp");
  ensureDir(root);
  const userDataDir = mkdtempSync(join(root, "gbh-settings-ab-" + stamp + "-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: true,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale,
    timezoneId: "Asia/Saigon",
    args: ["--force-color-profile=srgb", "--hide-scrollbars", "--font-render-hinting=none"],
  });
  return { context, userDataDir };
}

/** Gốc thư mục tools/parity (nơi có node_modules/playwright-core) — CHỈ ĐỌC. */
function repoRootOfParity(): string {
  return join(repoRoot(), "tools", "parity");
}

/**
 * Đọc URL có token của app thật 5439 từ ready-url.txt.
 *
 * Vì sao dùng URL thay cookie: cookie mint từ file credentials trả 401 trên 5439 (đo 18/10/2026 —
 * cả ~/.galaxy/blackhole/.credentials.yaml lẫn ~/.galaxy/credentials.yaml); navigate bằng token thì
 * host tự đặt cookie phiên đúng.
 * @returns URL đầy đủ kèm token, hoặc null khi chưa có tệp.
 */
export function readReadyUrl(): string | null {
  try {
    const raw = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
    return raw === "" ? null : raw;
  } catch {
    return null;
  }
}

/**
 * Chạy phép đo A/B đầy đủ: chụp hai bên cùng viewport (khác locale trình duyệt), so pixel, ghi artifact.
 *
 * Bên ref có thể là lab home mới (`refLabRow` — cùng code, tiếng Anh) hoặc một cổng sẵn có.
 * Toàn bộ boot+chụp+dọn lab nằm trong LOCK toàn cục (tools/check/lab-lock.ts).
 * @param options cổng hai bên, row lab làm ref, URL app thật, locale hai phiên Chrome.
 * @returns kết quả có cấu trúc (bằng chứng DOM hai bên + số pixel).
 */
export async function runSettingsAb(options: {
  oursPort?: number;
  refPort?: number;
  refLabRow?: string;
  oursUrl?: string;
  oursLocale?: string;
  refLocale?: string;
} = {}): Promise<SettingsAbResult> {
  const oursPort = options.oursPort ?? OURS_PORT;
  const refPort = options.refPort ?? REF_PORT;
  const outDir = parityPath("settings-ab");
  ensureDir(outDir);
  const stamp = String(Date.now());
  // HAI phien Chrome vi locale la BIEN DOI: ref en-US ("truoc khi dich"), ours vi-VN ("sau khi dich").
  const refSession = await launchChromeWithLocale(stamp + "-ref", options.refLocale ?? "en-US");
  const oursSession = await launchChromeWithLocale(stamp + "-ours", options.oursLocale ?? "vi-VN");
  // A/B CO NGHIA: hai ben cung CODE nhung khac NGON NGU.
  //   ref = lab home MOI (Chrome locale en-US ⇒ app mac dinh tieng Anh) — thay cho "TRUOC khi dich";
  //   ours = app that 5439 (preference vi da luu) — "SAU khi dich".
  //   Nho vay khac biet pixel quy duoc ve MOT bien: ngon ngu + nut tren cung build.
  let lab: { home: string; port: number; url: string } | null = null;
  acquireLabLock();
  try {
    let refCapturePort = refPort;
    let refUrl: string | undefined;
    if (options.refLabRow !== undefined) {
      lab = await runLab(options.refLabRow);
      if (lab === null) throw new Error("lab:row " + options.refLabRow + " khong boot duoc — xem stdout");
      refCapturePort = lab.port;
      refUrl = lab.url;
    }
    const ref = await captureSide(refSession, refCapturePort, "ref", outDir, refUrl);
    const ours = await captureSide(oursSession, oursPort, "ours", outDir, options.oursUrl ?? readReadyUrl() ?? undefined);
    const refBuffer = Buffer.from(await Bun.file(ref.pngFile).arrayBuffer());
    const oursBuffer = Buffer.from(await Bun.file(ours.pngFile).arrayBuffer());
    const diff = pixelDiff(refBuffer, oursBuffer, 0.001);
    const diffFile = join(outDir, "diff-settings-general.png");
    if (diff.diffPng !== undefined) writeFileSync(diffFile, diff.diffPng);
    const size = pngSize(refBuffer);
    const result: SettingsAbResult = {
      measuredAt: new Date().toISOString(),
      ref,
      ours,
      diffPixels: diff.diffPixels,
      totalPixels: diff.totalPixels,
      ratio: diff.ratio,
      width: size?.width ?? diff.width,
      height: size?.height ?? diff.height,
      diffFile,
      conclusion: "",
    };
    result.conclusion = buildConclusion(result);
    writeFileSync(join(outDir, "evidence.json"), JSON.stringify(result, null, 1), "utf8");
    return result;
  } finally {
    // DoD: don lab (kill listener cua cong lab + xoa home), roi moi nha khoa toan cuc.
    if (lab !== null) cleanupLab(lab.port, lab.home);
    releaseLabLock();
    await closeChromeSession(refSession);
    await closeChromeSession(oursSession);
  }
}

/**
 * Dựng câu kết luận từ hai bên: nút Mở tệp cấu hình, độ phủ tiếng Việt, số dòng tiếng Anh còn lại.
 * @param result kết quả đo.
 * @returns một dòng kết luận.
 */
export function buildConclusion(result: SettingsAbResult): string {
  const find = (side: SettingsSideEvidence, pattern: RegExp): string[] =>
    side.buttons.filter((button) => pattern.test(button.text)).map((button) => button.text);
  const oursButton = find(result.ours, /mở tệp cấu hình|open (settings|configuration) file/iu);
  const refButton = find(result.ref, /mở tệp cấu hình|open (settings|configuration) file/iu);
  return (
    "nut: ours=[" + oursButton.join("|") + "] ref=[" + refButton.join("|") + "]" +
    " · ghe settings.action: ours " + String(result.ours.actionSlotHtmlLength) + " ky tu / ref " + String(result.ref.actionSlotHtmlLength) +
    " · dong tieng Anh trong panel: ours " + String(result.ours.englishLines.length) + " / ref " + String(result.ref.englishLines.length) +
    " · dong co dau tieng Viet: ours " + String(result.ours.vietnameseLines.length) + " / ref " + String(result.ref.vietnameseLines.length) +
    " · pixel khac " + ratioPercent(result.ratio) + " (khac biet CO CHU DICH: ngon ngu + nut)"
  );
}

/**
 * In khối bằng chứng dán được vào báo cáo.
 * @param result kết quả đo.
 * @returns văn bản nhiều dòng.
 */
export function renderBlock(result: SettingsAbResult): string {
  const lines: string[] = [];
  const side = (evidence: SettingsSideEvidence): string =>
    evidence.label + " (" + String(evidence.port) + "): HTTP " + String(evidence.httpStatus) +
    " · mo modal " + String(evidence.settingsClicked) + " · muc Chung " + String(evidence.generalClicked) +
    " · ghe settings.action: [" + evidence.actionSlotText + "] (" + String(evidence.actionSlotHtmlLength) + " ky tu)" +
    " · panel " + String(evidence.panelLineCount) + " dong: " + String(evidence.vietnameseLines.length) + " dong co dau tieng Viet, " +
    String(evidence.englishLines.length) + " dong dang tieng Anh";
  lines.push("SETTINGS A/B — " + result.measuredAt);
  lines.push("1) " + side(result.ref));
  lines.push("2) " + side(result.ours));
  lines.push("3) anh: " + result.ref.pngFile + " vs " + result.ours.pngFile + " · diff " + result.diffFile);
  lines.push("4) pixel: " + String(result.diffPixels) + "/" + String(result.totalPixels) + " = " + ratioPercent(result.ratio) + " (1440x900)");
  lines.push("5) ket luan: " + result.conclusion);
  if (result.ours.englishLines.length > 0) lines.push("   ours con tieng Anh: " + result.ours.englishLines.slice(0, 12).join(" | "));
  if (result.ref.englishLines.length > 0) lines.push("   ref tieng Anh (mau): " + result.ref.englishLines.slice(0, 8).join(" | "));
  lines.push("   nav ours: " + result.ours.navLabels.join(" · "));
  lines.push("   nav ref : " + result.ref.navLabels.join(" · "));
  return lines.join("\n");
}

/**
 * Điểm vào dòng lệnh: đọc --ours/--ref, chạy đo, in khối bằng chứng.
 * @param argv tham số sau tên script.
 * @returns mã thoát 0 khi đo được cả hai bên.
 */
async function main(argv: readonly string[]): Promise<number> {
  const at = (key: string): number | null => {
    const index = argv.indexOf(key);
    if (index < 0) return null;
    const value = Number(argv[index + 1]);
    return Number.isInteger(value) && value > 0 ? value : null;
  };
  const oursPort = at("--ours") ?? OURS_PORT;
  const refPort = at("--ref") ?? REF_PORT;
  const refLabIndex = argv.indexOf("--ref-lab");
  const refLabRow = refLabIndex < 0 ? undefined : argv[refLabIndex + 1];
  const result = await runSettingsAb({ oursPort, refPort, refLabRow });
  console.log(renderBlock(result));
  const ok = result.ref.httpStatus === 200 && result.ours.httpStatus === 200 && result.ours.settingsClicked && result.ours.generalClicked;
  return ok ? 0 : 1;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
