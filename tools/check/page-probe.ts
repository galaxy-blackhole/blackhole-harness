/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Do phia TRANG sau khi nap: bat loi console/pageerror + do #root + so [data-slot] — HTTP 200 khong bao gio la bang chung
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Nạp trang bằng Chrome headless và đo phía trang.
 * @param url - URL đầy đủ có token.
 * @param repoRoot - gốc repo (để tìm playwright-core).
 * @returns số ký tự trong #root, số phần tử data-slot, lỗi console, lỗi trang, và lý do nếu không đo được.
 *
 * Vì sao trả thêm slotCount/pageErrors (18/10/2026): brand swap GBH bỏ wordmark SVG chữ của DSH nên #root
 * giảm 67.167 → 49.593 ký tự (chênh 17.574 = byte của path chữ bị bỏ) trong khi UI KHÔNG mất nội dung.
 * Ngưỡng (8) phải là ngưỡng CẤU TRÚC (đủ slot + 0 lỗi), không phải số ký tự tuyệt đối.
 */
export async function probePage(
  url: string,
  repoRoot: string,
): Promise<{ rootChars: number; slotCount: number; slotNames: string[]; phienRong?: boolean; errors: string[]; pageErrors: string[]; skipped?: string }> {
  const pw = join(repoRoot, "tools", "parity", "node_modules", "playwright-core", "index.js");
  if (!existsSync(pw)) return { rootChars: 0, slotCount: 0, slotNames: [], errors: [], pageErrors: [], skipped: "khong co playwright-core" };
  const mod = await import(pathToFileURL(pw).href);
  const chromium = (mod as { chromium?: unknown }).chromium ?? (mod as { default?: { chromium?: unknown } }).default?.chromium;
  if (chromium === undefined) return { rootChars: 0, slotCount: 0, slotNames: [], errors: [], pageErrors: [], skipped: "playwright-core khong co chromium" };
  const launcher = chromium as { launch: (o: unknown) => Promise<{ newPage: () => Promise<Page>; close: () => Promise<void> }> };
  // Bat MOI loi o day: khi app khong chay (hoac Chrome khong mo duoc) thi cong cu phai BAO GON,
  // khong duoc nem ra stack trace (da xay ra 17/10/2026 khi host dang khoi dong lai).
  let browser: { newPage: () => Promise<Page>; close: () => Promise<void> };
  try {
    // 09/11/2026 (Lead): baseline `.parity/layout-baseline.json` do tools/check/probe-once.ts chụp với
    // `locale: "vi-VN"`; trình duyệt headless mặc định en-US ⇒ chữ tiếng Anh rộng hơn ⇒ (9) báo lệch
    // 14/80 dù UI đúng. Đặt cùng locale để phép so là cùng ngôn ngữ.
    browser = await launcher.launch({ headless: true, channel: "chrome", locale: "vi-VN", args: ["--no-sandbox"] });
  } catch (e) {
    return { rootChars: 0, slotCount: 0, slotNames: [], errors: [], pageErrors: [], skipped: "khong mo duoc Chrome: " + String(e).slice(0, 80) };
  }
  try {
    const page = await browser.newPage();
    // 08/11/2026 (Lead + tester đo độc lập): cửa sổ headless mặc định 756×469 ⇒ 5 row phiên + slot action của
    //   chúng KHÔNG mount ⇒ đếm ra 25 slot thay vì 35. Đo ở 1280×800 (kích thước làm việc tối thiểu) để phép đo
    //   phản ánh UI thật, không phải độ rộng cửa sổ ngẫu nhiên.
    await (page as unknown as { setViewportSize: (s: { width: number; height: number }) => Promise<void> })
      .setViewportSize({ width: 1280, height: 800 });
    const errors: string[] = [];
    const pageErrors: string[] = [];
    const onConsole = (m: unknown): void => {
      const msg = m as { type?: () => string; text?: () => string };
      if (msg.type?.() === "error") errors.push((msg.text?.() ?? "").slice(0, 200));
    };
    const onPageError = (e: unknown): void => { pageErrors.push(String(e).slice(0, 200)); };
    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 10000));
    // 08/11/2026 (Lead) — SỰ CỐ THẬT: app nay mở ở màn HERO ("chọn workspace", chưa có phiên) nên chỉ ~25 slot
    //   trong khi đường nền (9) và ngưỡng (8) đo trên trang CÓ PHIÊN (46 slot / 420k ký tự). Đo ở màn hero mà so
    //   với đường nền của trang phiên là so hai trang khác nhau ⇒ đỏ oan. Nay MỞ một phiên trước khi đo (đúng
    //   trạng thái mà đường nền mô tả); nếu không có phiên nào để mở thì đo màn hero và ghi rõ trạng thái.
    // Bước 1: chọn WORKSPACE (app mở ở màn "choose workspace"; chưa chọn thì danh sách phiên không mount).
    await page.evaluate(() => {
      const nut = [...document.querySelectorAll("[data-slot='sidebar.workspaces'] *")]
        .filter((e) => (e.textContent ?? "").trim().length > 0)
        .pop() as HTMLElement | undefined;
      nut?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      nut?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      nut?.click();
    });
    await new Promise((r) => setTimeout(r, 5000));
    // Bước 2: mở PHIÊN đầu tiên trong sidebar để đo đúng trang mà đường nền (9) mô tả.
    await page.evaluate(() => {
      const neo = document.querySelector("[data-slot='sidebar.session.row.leading']");
      const hang = (neo?.closest("[role='button']") ?? neo?.closest("button") ?? neo?.parentElement?.parentElement ?? neo) as HTMLElement | null;
      if (hang !== null) {
        hang.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        hang.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        hang.click();
      }
    });
    await new Promise((r) => setTimeout(r, 6000));
    const measured = await page.evaluate(() => ({
      rootChars: document.querySelector("#root")?.innerHTML.length ?? 0,
      slotCount: document.querySelectorAll("[data-slot]").length,
      slotNames: [...new Set([...document.querySelectorAll("[data-slot]")].map((e) => e.getAttribute("data-slot") ?? ""))],
      // 22/10/2026: app mở "Phiên mới" (rỗng) chỉ có ~40 slot, còn phiên có nội dung có >= 46 slot.
      //   Đo được cả hai con số nên chỉ số (8) phải dùng ngưỡng theo LOẠI TRANG, không hạ ngưỡng chung.
      // 08/11/2026 — TÊN SLOT THẬT trong bản này là `conversation.composer` (không phải `composer`), nên selector cũ
      //   luôn trả 0 ⇒ MỌI trang bị xếp là "phiên rỗng". Nay nhận đúng cả hai tên.
      phienRong: document.querySelectorAll("[data-slot='message'], [data-slot='composer'], [data-slot='conversation.composer'], [data-slot='conversation.message']").length === 0,
    }));
    return {
      rootChars: measured.rootChars,
      slotCount: measured.slotCount,
      slotNames: measured.slotNames,
      phienRong: measured.phienRong,
      errors,
      pageErrors,
    };
  } catch (e) {
    return { rootChars: 0, slotCount: 0, slotNames: [], errors: [], pageErrors: [], skipped: "khong nap duoc trang: " + String(e).slice(0, 80) };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Trang tối thiểu để Playwright gõ kiểu cho evaluate/on. */
interface Page {
  on: (e: string, f: (a: unknown) => void) => void;
  goto: (u: string, o: unknown) => Promise<unknown>;
  evaluate: <T>(f: () => T) => Promise<T>;
}

/** Mot phan tu trong chu ky hinh hoc. */
export interface GeoBox {
  /** The tag + lop dau tien, de doc cho de. */
  k: string;
  /** Toa do va kich thuoc, lam tron ve so nguyen. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Chup chu ky HINH HOC cua trang: vi tri + kich thuoc cac phan tu hien thi dau tien.
 * Muc dich: bat loi BO CUC — lop loi ma `#root` va loi console KHONG thay duoc
 * (bai hoc 17/10/2026: thanh ben bi don nen, #root van 99.183 va 0 loi console).
 * @param url - URL day du co token.
 * @param repoRoot - goc repo (de tim playwright-core).
 * @returns danh sach hop hinh hoc, hoac mang rong neu khong do duoc.
 */
export async function probeGeometry(url: string, repoRoot: string): Promise<GeoBox[]> {
  const pw = join(repoRoot, "tools", "parity", "node_modules", "playwright-core", "index.js");
  if (!existsSync(pw)) return [];
  const mod = await import(pathToFileURL(pw).href);
  const m = mod as { chromium?: unknown; default?: { chromium?: unknown } };
  const chromium = m.chromium ?? m.default?.chromium;
  if (chromium === undefined) return [];
  const launcher = chromium as { launch: (o: unknown) => Promise<{ newPage: () => Promise<GeoPage>; close: () => Promise<void> }> };
  // Cung ly do nhu probePage: khi app KHONG chay thi phai tra ve RONG, khong nem stack trace.
  // (Da xay ra 17/10/2026: app chet => check:app crash thay vi bao gon.)
  let browser: { newPage: () => Promise<GeoPage>; close: () => Promise<void> };
  try {
    // 09/11/2026 (Lead): baseline `.parity/layout-baseline.json` do tools/check/probe-once.ts chụp với
    // `locale: "vi-VN"`; trình duyệt headless mặc định en-US ⇒ chữ tiếng Anh rộng hơn ⇒ (9) báo lệch
    // 14/80 dù UI đúng. Đặt cùng locale để phép so là cùng ngôn ngữ.
    browser = await launcher.launch({ headless: true, channel: "chrome", locale: "vi-VN", args: ["--no-sandbox"] });
  } catch {
    return [];
  }
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 10000));
    return await page.evaluate(() => {
      const out: { k: string; x: number; y: number; w: number; h: number }[] = [];
      const all = document.querySelectorAll("#root *");
      for (let i = 0; i < all.length && out.length < 80; i += 1) {
        const e = all[i] as HTMLElement;
        const r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const cls = typeof e.className === "string" ? e.className.split(" ")[0] ?? "" : "";
        out.push({ k: e.tagName.toLowerCase() + (cls === "" ? "" : "." + cls.slice(0, 18)), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
      }
      return out;
    });
  } catch {
    return [];
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Trang toi thieu cho viec chup hinh hoc. */
interface GeoPage {
  goto: (u: string, o: unknown) => Promise<unknown>;
  evaluate: <T>(f: () => T) => Promise<T>;
}