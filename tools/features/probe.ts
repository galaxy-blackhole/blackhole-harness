/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Thám hiểm DOM hai bên (5439/4001): liệt kê phần tử tương tác, chụp ảnh theo bước, phục vụ dựng kịch bản A/B
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { closeChromeSession, launchChrome, resolveSessionCookieFrom } from "../parity/lib/browser.ts";
import type { ChromeSession } from "../parity/lib/browser.ts";
import { credentialsPath, ensureDir, parityPath } from "../parity/lib/paths.ts";

/** Một bước của phiên thám hiểm: bấm theo selector, bấm phím, chờ, chụp ảnh hoặc đổ inventory DOM. */
export interface ProbeStep {
  /** Nhãn bước để in log và đặt tên file. */
  label: string;
  /** Chuỗi selector Playwright (text=, css=, aria=...) cần bấm; bỏ trống nếu chỉ chờ. */
  click?: string;
  /** Chuỗi phím cần bấm, ví dụ "Escape". */
  press?: string;
  /** Chờ thêm mili giây sau bước. */
  waitMs?: number;
  /** Tên file ảnh cần chụp sau bước (tương đối thư mục đích); bỏ trống nếu không chụp. */
  shot?: string;
  /** true để đổ inventory DOM ra JSON cạnh ảnh. */
  dump?: boolean;
  /** true để nạp lại trang từ đầu trước khi làm bước này (cô lập trạng thái giữa các màn hình). */
  reload?: boolean;
  /** Đoạn mã chạy trong trang (thân hàm) để gỡ/thao tác thô khi cần thám hiểm. */
  script?: string;
}

/** Một phần tử tương tác đọc được từ DOM, đủ để dựng selector cho kịch bản. */
interface InventoryRow {
  /** Tên thẻ, ví dụ "button". */
  tag: string;
  /** Vai trò ARIA nếu có. */
  role: string;
  /** Nhãn ARIA nếu có. */
  aria: string;
  /** Thuộc tính data-testid nếu có. */
  testid: string;
  /** Lớp CSS (cắt ngắn) để nhận diện thành phần DSH. */
  cls: string;
  /** Chữ hiển thị (cắt 60 ký tự). */
  text: string;
  /** Toạ độ và kích thước khung bao. */
  x: number;
  /** Toạ độ trên. */
  y: number;
  /** Chiều rộng. */
  w: number;
  /** Chiều cao. */
  h: number;
}

/** Trang tối thiểu mà probe cần: chỉ hàm evaluate để chạy mã trong trang. */
interface EvaluablePage {
  /** Chạy một hàm trong ngữ cảnh trang và trả kết quả. */
  evaluate: (fn: () => unknown) => Promise<unknown>;
}

/**
 * Đổ danh sách phần tử tương tác của trang hiện tại.
 * Nhận: đối tượng trang Playwright (chỉ cần evaluate).
 * Trả: mảng bản ghi gọn (thẻ, vai trò, nhãn, toạ độ) để dựng selector.
 */
export async function inventory(page: EvaluablePage): Promise<InventoryRow[]> {
  const rows = await page.evaluate(() => {
    const out: Record<string, unknown>[] = [];
    const nodes = Array.from(document.querySelectorAll("button,a,[role],[aria-label],[data-testid],input,textarea,select"));
    for (const node of nodes.slice(0, 400)) {
      const el = node as HTMLElement;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") ?? "",
        aria: el.getAttribute("aria-label") ?? "",
        testid: el.getAttribute("data-testid") ?? "",
        cls: String(el.className ?? "").slice(0, 90),
        text: (el.textContent ?? "").replace(/\s+/gu, " ").trim().slice(0, 60),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }
    return out;
  });
  return rows as InventoryRow[];
}

/**
 * Chạy một phiên thám hiểm trên một cổng: mở trang bằng cookie phiên mint trong bộ nhớ, làm từng bước.
 * Nhận: cổng server, danh sách bước, thư mục đích cho ảnh/inventory.
 * Trả: nhật ký từng bước (OK/FAIL/DUMP/SHOT) để đọc trên console.
 */
export async function probePort(port: number, steps: ProbeStep[], outDir: string): Promise<string[]> {
  ensureDir(outDir);
  const log: string[] = [];
  const auth = resolveSessionCookieFrom(port, [credentialsPath()]);
  const session: ChromeSession = await launchChrome(parityPath("tmp"), "probe-" + String(port) + "-" + String(Date.now()));
  try {
    const page = await session.context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    if (auth.cookie !== null) {
      await session.context.addCookies([
        { name: auth.cookie.name, value: auth.cookie.value, domain: "127.0.0.1", path: "/" },
      ]);
    }
    const url = "http://127.0.0.1:" + String(port) + "/";
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(2000);
    for (const step of steps) {
      try {
        if (step.reload === true) {
          await page.goto(url, { waitUntil: "load", timeout: 30_000 });
          await page.waitForTimeout(2000);
        }
        if (step.script !== undefined) {
          const result = await page.evaluate("(" + step.script + ")()");
          const shown = result === undefined ? "(undefined)" : JSON.stringify(result);
          log.push("EVAL " + step.label + " -> " + String(shown).slice(0, 900));
        }
        if (step.click !== undefined) {
          await page.click(step.click, { timeout: 8000 });
          log.push("OK   click " + step.label + " :: " + step.click);
        }
        if (step.press !== undefined) {
          await page.keyboard.press(step.press);
          log.push("OK   press " + step.label + " :: " + step.press);
        }
        await page.waitForTimeout(step.waitMs ?? 900);
        if (step.dump === true) {
          const data = await inventory(page as unknown as EvaluablePage);
          const file = join(outDir, "inv-" + step.label.replace(/[^a-zA-Z0-9-]/gu, "_") + ".json");
          writeFileSync(file, JSON.stringify(data, null, 1));
          log.push("DUMP " + step.label + " -> " + file + " (" + String(data.length) + " phan tu)");
        }
        if (step.shot !== undefined) {
          const file = join(outDir, step.shot);
          await page.screenshot({ path: file, type: "png" });
          log.push("SHOT " + step.label + " -> " + file);
        }
      } catch (error) {
        log.push("FAIL " + step.label + " :: " + (error instanceof Error ? error.message.split("\n")[0] : String(error)));
      }
    }
    log.push("title: " + (await page.title()));
  } finally {
    await closeChromeSession(session);
  }
  return log;
}

/**
 * Điểm vào dòng lệnh của probe: --port <n> --steps <file.json> --out <dir>.
 * Nhận: tham số dòng lệnh (sau tên script).
 * Trả: mã thoát 0 khi chạy xong.
 */
export async function main(argv: string[]): Promise<number> {
  const at = (key: string): string | null => {
    const i = argv.indexOf(key);
    return i >= 0 ? argv[i + 1] ?? null : null;
  };
  const port = Number(at("--port") ?? "5439");
  const stepsFile = at("--steps");
  const outDir = at("--out") ?? parityPath("features", "probe");
  const steps: ProbeStep[] = stepsFile === null ? [] : (JSON.parse(await Bun.file(stepsFile).text()) as ProbeStep[]);
  const log = await probePort(port, steps, outDir);
  for (const line of log) console.log("[probe] " + line);
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
