/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phép đo CỦA ROW NÀY trong lab cách ly: cổng đóng/mở, BA đường đóng, #root, lỗi console
 */

// ⚠️ Vì sao có tệp này: tools/check/overlay-probe.ts chỉ NẠP trang rồi liệt kê overlay ĐANG mở — nó KHÔNG
//   bấm được nút Settings, nên một mình nó không đo được "sau khi bấm thì panel có mở không". Tệp này dùng
//   CÙNG phép dò overlay (fixed/absolute ≥400x300, bỏ phần tử đã ẩn) nhưng thêm ba việc: (1) bấm nút mở
//   Settings rồi đo LẠI; (2) đo từng đường đóng trước/sau; (3) gom lỗi console + số ký tự #root.
//   ⚠️ Playwright PHẢI chạy channel: "chrome" — thiếu là "Executable doesn't exist … chromium_headless_shell".
//
// CÁCH DÙNG: cd <repo> && bun run packages/client/ui-settings-general/lab/probe.ts <url-lab>

import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Kết quả một lần đo của một đường đóng. */
interface CloseResult {
  /** Tên đường đóng. */
  path: string;
  /** Số phần tử VOzbGW_overlay TRƯỚC khi bấm. */
  before: number;
  /** Số phần tử VOzbGW_overlay SAU khi bấm. */
  after: number;
  /** Cách bấm đã dùng: "thuong" (click thật) hay "force" (bỏ qua kiểm tra che khuất). */
  mode: string;
}

/** Toàn bộ số đo của một bundle. */
interface Report {
  /** Đường vào đã dùng để mở Settings. */
  trigger: string;
  /** Số overlay phủ màn hình khi CHƯA mở. */
  overlaysClosed: number;
  /** Số phần tử VOzbGW_overlay khi CHƯA mở. */
  panelClosed: number;
  /** Số overlay phủ màn hình SAU khi bấm Settings. */
  overlaysOpen: number;
  /** Số phần tử VOzbGW_overlay SAU khi bấm Settings. */
  panelOpen: number;
  /** Kết quả từng đường đóng. */
  closes: CloseResult[];
  /** Số ký tự innerHTML của #root. */
  rootChars: number;
  /** Lỗi console (cắt 200 ký tự). */
  errors: string[];
  /** Số dòng "did not activate" đọc được từ console của trang. */
  notActivated: number;
}

/** Trang tối thiểu mà phép đo cần. */
interface ProbePage {
  /** Nghe sự kiện. */
  on(event: string, handler: (arg: never) => void): void;
  /** Nạp URL. */
  goto(url: string, options: unknown): Promise<unknown>;
  /** Chờ theo mili giây. */
  waitForTimeout(ms: number): Promise<void>;
  /** Chạy hàm trong trang. */
  evaluate<T>(fn: () => T): Promise<T>;
  /** Bấm theo selector. */
  click(selector: string, options?: unknown): Promise<void>;
  /** Gõ phím. */
  keyboard: { press(key: string): Promise<void> };
}

/**
 * Đếm phần tử phủ màn hình đang mở + số phần tử VOzbGW_overlay + số ký tự #root.
 * @returns ba số đo tại thời điểm gọi.
 */
function measure(): { overlays: number; panel: number; rootChars: number } {
  const all = Array.from(document.querySelectorAll("body *")) as HTMLElement[];
  let overlays = 0;
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 400 || rect.height < 300) continue;
    const style = getComputedStyle(el);
    if (style.position !== "fixed" && style.position !== "absolute") continue;
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.05) continue;
    overlays += 1;
  }
  return {
    overlays,
    panel: document.querySelectorAll(".VOzbGW_overlay").length,
    rootChars: (document.querySelector("#root")?.innerHTML ?? "").length,
  };
}

/**
 * Chạy trọn phép đo trên một URL lab.
 * @param url - URL lab đầy đủ (kèm token).
 * @returns báo cáo số đo.
 */
async function run(url: string): Promise<Report> {
  const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
  const mod = (await import(pathToFileURL(pw).href)) as { chromium?: { launch(o: unknown): Promise<unknown> } };
  const chromium = mod.chromium;
  if (chromium === undefined) throw new Error("khong co playwright-core trong tools/parity/node_modules");
  const browser = (await chromium.launch({ headless: true, channel: "chrome", args: ["--no-sandbox"] })) as {
    newPage(): Promise<ProbePage>;
    close(): Promise<void>;
  };
  const errors: string[] = [];
  try {
    const page = await browser.newPage();
    page.on("console", (message: never) => {
      const m = message as unknown as { type(): string; text(): string };
      if (m.type() === "error") errors.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (error: never) => { errors.push(String(error).slice(0, 200)); });
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(10_000);
    const closed = await page.evaluate(measure);
    // BA đường vào, theo thứ tự ưu tiên của bản gốc:
    //   (1) fallback của ghế settings.launcher — button.VOzbGW_trigger;
    //   (2) bất kỳ nút nào mở hộp thoại;
    //   (3) gói chiếm ghế settings.launcher (ở app thật là AccountMenu yHnPSG_trigger) ⇒ bấm nút đó rồi bấm
    //       mục "Settings" trong menu của nó — chính mục ấy gọi openSettings() của vỏ.
    const openers: { selector: string; follows: string[] }[] = [
      { selector: "button.VOzbGW_trigger", follows: [] },
      {
        selector: "button.yHnPSG_trigger",
        follows: ['[role="menuitem"]:has-text("Setting")', '[role="menuitem"]:has-text("Cài đặt")', '[role="menuitem"]'],
      },
      { selector: 'button[aria-haspopup="dialog"]', follows: [] },
    ];
    let trigger = "";
    /** Mở Settings bằng đường vào đã chọn (gọi lại được cho từng đường đóng). */
    const openSettings = async (): Promise<boolean> => {
      const opener = openers.find((candidate) => candidate.selector === trigger.split(" -> ")[0]);
      if (opener === undefined) return false;
      try {
        await page.click(opener.selector, { timeout: 4_000 });
      } catch {
        return false;
      }
      for (const follow of opener.follows) {
        try {
          await page.click(follow, { timeout: 4_000 });
          await page.waitForTimeout(900);
          return true;
        } catch {
          continue;
        }
      }
      await page.waitForTimeout(900);
      return opener.follows.length === 0;
    };
    for (const opener of openers) {
      try {
        await page.click(opener.selector, { timeout: 3_000 });
      } catch {
        continue;
      }
      if (opener.follows.length === 0) {
        trigger = opener.selector;
        break;
      }
      let hit = "";
      for (const follow of opener.follows) {
        try {
          await page.click(follow, { timeout: 3_000 });
          hit = follow;
          break;
        } catch {
          continue;
        }
      }
      if (hit !== "") {
        trigger = opener.selector + " -> " + hit;
        break;
      }
    }
    await page.waitForTimeout(1_500);
    let open = trigger === "" ? { overlays: 0, panel: 0, rootChars: closed.rootChars } : await page.evaluate(measure);
    if (open.panel === 0) {
      // Đường dự phòng bằng JS: app có thể đang có MỘT MODAL KHÁC phủ màn (mask chặn con trỏ ⇒ click thật
      // không tới được nút). Ở đây gọi thẳng .click() của DOM — vẫn là hành vi của chính nút đó.
      await page.evaluate(() => {
        (document.querySelector("button.yHnPSG_trigger") as HTMLElement | null)?.click();
      });
      await page.waitForTimeout(900);
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
        const hit = items.find((item) => /setting|cài đặt|设置/iu.test(item.textContent ?? "")) ?? items[0];
        hit?.click();
      });
      await page.waitForTimeout(1_500);
      const viaDom = await page.evaluate(measure);
      if (viaDom.panel > 0) {
        open = viaDom;
        trigger = "js:button.yHnPSG_trigger -> menuitem";
      }
    }
    const closes: CloseResult[] = [];
    const paths: { name: string; act: (p: ProbePage) => Promise<void> }[] = [
      { name: "nut-close", act: async (p) => p.click(".VOzbGW_close", { timeout: 4_000 }) },
      { name: "mask", act: async (p) => p.click(".VOzbGW_mask", { timeout: 4_000, position: { x: 5, y: 5 } }) },
      { name: "escape", act: async (p) => p.keyboard.press("Escape") },
    ];
    for (const path of paths) {
      // Mở lại trước mỗi đường để đo đúng "trước ⇒ sau" của CHÍNH đường đó.
      let before = await page.evaluate(measure);
      if (before.panel === 0 && trigger !== "") {
        await openSettings();
        before = await page.evaluate(measure);
      }
      let mode = "thuong";
      try {
        await path.act(page);
      } catch (error) {
        errors.push(path.name + ": " + String(error).replace(/\n/gu, " ").slice(0, 160));
        mode = "force";
        try {
          if (path.name === "escape") await page.keyboard.press("Escape");
          else if (path.name === "mask") await page.click(".VOzbGW_mask", { force: true, position: { x: 5, y: 5 }, timeout: 4_000 });
          else await page.click(".VOzbGW_close", { force: true, timeout: 4_000 });
        } catch (retry) {
          errors.push(path.name + " (force): " + String(retry).replace(/\n/gu, " ").slice(0, 160));
        }
      }
      await page.waitForTimeout(900);
      const after = await page.evaluate(measure);
      closes.push({ path: path.name, before: before.panel, after: after.panel, mode });
    }
    const notActivated = errors.filter((text) => text.includes("did not activate")).length;
    return {
      trigger,
      overlaysClosed: closed.overlays,
      panelClosed: closed.panel,
      overlaysOpen: open.overlays,
      panelOpen: open.panel,
      closes,
      rootChars: closed.rootChars,
      errors,
      notActivated,
    };
  } finally {
    await browser.close();
  }
}

if (import.meta.main) {
  const url = process.argv[2];
  if (url === undefined) {
    console.log("Dung: bun run packages/client/ui-settings-general/lab/probe.ts <url-lab>");
    process.exit(2);
  }
  const report = await run(url);
  console.log(JSON.stringify(report, null, 1));
}
