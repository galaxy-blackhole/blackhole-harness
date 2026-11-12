/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bộ thao tác trên trang (bấm/gõ/chờ/chụp) + đọc phần tử tương tác, dùng chung cho cả hai bên A/B
 */

import type { Page } from "playwright-core";

import type { ElementRow, ScrollState, Step, StepOutcome } from "./types.ts";

/** Nhãn của các nút thuộc hộp thoại một lần (onboarding) — đóng để hai bên cùng trạng thái. */
const ONE_TIME_LABELS: readonly string[] = Object.freeze([
  "later",
  "got it",
  "continue",
  "skip",
  "dismiss",
  "not now",
  "start exploring",
  "ok",
]);

/**
 * Đọc danh sách phần tử tương tác của trang hiện tại.
 * Nhận: trang Playwright đang mở.
 * Trả: mảng phần tử gọn (thẻ, vai trò, nhãn ARIA, chữ, khung bao) để so cấu trúc và định vị diff.
 */
export async function inventory(page: Page): Promise<ElementRow[]> {
  const rows = await page.evaluate(() => {
    const out: Record<string, unknown>[] = [];
    // Gồm cả tiêu đề (h1..h3, role=heading) để làm "anchor màn hình" cho cổng hợp lệ.
    const nodes = Array.from(
      document.querySelectorAll("h1,h2,h3,h4,[role=heading],button,a,[role],[aria-label],[data-testid],input,textarea,select"),
    );
    for (const node of nodes.slice(0, 600)) {
      const el = node as HTMLElement;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") ?? "",
        aria: el.getAttribute("aria-label") ?? "",
        testid: el.getAttribute("data-testid") ?? "",
        text: (el.textContent ?? "").replace(/\s+/gu, " ").trim().slice(0, 60),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }
    return out;
  });
  return rows as unknown as ElementRow[];
}

/**
 * Chuẩn hoá nhãn của một phần tử tương tác để so cấu trúc giữa hai bên.
 * Nhận: một phần tử đọc từ DOM.
 * Trả: chuỗi nhãn ưu tiên aria-label, rồi tới chữ hiển thị đã gộp khoảng trắng.
 */
export function elementLabel(row: ElementRow): string {
  const raw = row.aria.trim() !== "" ? row.aria : row.text;
  return raw.replace(/\s+/gu, " ").trim().slice(0, 48);
}

/**
 * Đưa mọi vùng cuộn về 0 rồi ghi lại trạng thái cuộn trước/sau của từng vùng.
 * Vì sao: một cú focus trong hộp thoại có thể làm trang tự cuộn vài chục pixel; nếu không chuẩn hoá,
 * hai bên sẽ lệch nhau cả khung (đã xảy ra 28 px ở màn Plugins → menu Add plugin) dù giao diện giống hệt.
 * Nhận: trang Playwright đang mở.
 * Trả: trạng thái cuộn trước/sau của document và tối đa 8 vùng cuộn chính.
 */
export async function resetScroll(page: Page): Promise<ScrollState> {
  const state = await page.evaluate(() => {
    type Region = { index: number; scrollHeight: number; clientHeight: number; before: number; after: number };
    const documentElement = document.scrollingElement as HTMLElement | null;
    const regions: Region[] = [];
    const nodes = Array.from(document.querySelectorAll("div,main,section,ul")).filter(
      (node) => (node as HTMLElement).scrollHeight > (node as HTMLElement).clientHeight + 4,
    );
    nodes.slice(0, 8).forEach((node, index) => {
      const el = node as HTMLElement;
      regions.push({ index, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, before: el.scrollTop, after: 0 });
    });
    const documentBefore = documentElement?.scrollTop ?? 0;
    for (const node of nodes) (node as HTMLElement).scrollTop = 0;
    if (documentElement !== null) documentElement.scrollTop = 0;
    window.scrollTo(0, 0);
    return {
      documentBefore,
      documentAfter: documentElement?.scrollTop ?? 0,
      regions,
    };
  });
  // Một nhịp cho layout ổn định sau khi cuộn về đầu (tiêu đề sticky trở về đúng chỗ).
  await page.waitForTimeout(250);
  return state;
}

/**
 * Đo tiêu đề đầu tiên của trang (thường là h1 của màn đang mở) để so vị trí dọc hai bên.
 * Nhận: trang Playwright đang mở.
 * Trả: { text, y } của tiêu đề đầu tiên, hoặc null nếu trang không có tiêu đề nào.
 */
export async function firstHeading(page: Page): Promise<{ text: string; y: number } | null> {
  const found = await page.evaluate(() => {
    const node = document.querySelector("h1,h2,[role=heading]");
    if (node === null) return null;
    const rect = (node as HTMLElement).getBoundingClientRect();
    return { text: (node.textContent ?? "").trim().slice(0, 40), y: Math.round(rect.y) };
  });
  return found;
}

/**
 * Đếm số hộp thoại còn mở (dấu hiệu có overlay chặn thao tác).
 * Nhận: trang Playwright đang mở.
 * Trả: số phần tử role=dialog hoặc aria-modal=true đang hiển thị.
 */
export async function dialogCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    let count = 0;
    for (const node of Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"]'))) {
      const rect = (node as HTMLElement).getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) count += 1;
    }
    return count;
  });
}

/**
 * Bấm nút của hộp thoại một lần (Preview Notice / Get started / API key...) để hai bên cùng trạng thái.
 * Chỉ bấm nút NẰM TRONG hộp thoại, không đụng vào menu của kịch bản.
 * Nhận: trang Playwright đang mở.
 * Trả: danh sách nhãn nút đã bấm (để ghi vào ma trận là khác biệt trạng thái onboarding).
 */
export async function dismissOneTimeDialogs(page: Page): Promise<string[]> {
  const clicked = await page.evaluate((labels: string[]) => {
    const hits: string[] = [];
    const scopes = Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"]'));
    // Hộp thoại xin API key của bản brand không có role=dialog: quét cả trang cho nút Later/Not now.
    const scopesAll = scopes.length > 0 ? scopes : [document.body];
    for (const scope of scopesAll) {
      for (const node of Array.from(scope.querySelectorAll("button"))) {
        const text = (node.textContent ?? "").replace(/\s+/gu, " ").trim();
        const normalised = text.toLowerCase();
        const primary = normalised.split(" ")[0] ?? "";
        if (!labels.includes(normalised) && !labels.includes(primary)) continue;
        (node as HTMLElement).click();
        hits.push(text.slice(0, 24));
        break;
      }
    }
    return hits;
  }, [...ONE_TIME_LABELS]);
  if (clicked.length > 0) await page.waitForTimeout(600);
  return clicked;
}

/**
 * Chạy một bước thao tác trên trang, không bao giờ ném lỗi ra ngoài.
 * Nhận: trang Playwright, bước cần chạy, thời gian chờ tối đa cho mỗi lần bấm.
 * Trả: kết quả bước (ok + ghi chú lỗi hoặc giá trị eval).
 */
export async function runStep(page: Page, step: Step, timeoutMs: number): Promise<StepOutcome> {
  try {
    if (step.kind === "goto") {
      await page.goto(step.value, { waitUntil: "load", timeout: timeoutMs });
      await page.waitForTimeout(1200);
    } else if (step.kind === "click") {
      await page.click(step.value, { timeout: timeoutMs });
    } else if (step.kind === "clickAt") {
      const parts = step.value.split(",");
      await page.mouse.click(Number(parts[0]), Number(parts[1]));
      await page.waitForTimeout(400);
    } else if (step.kind === "press") {
      await page.keyboard.press(step.value);
    } else if (step.kind === "hover") {
      await page.hover(step.value, { timeout: timeoutMs });
    } else if (step.kind === "fill") {
      await page.fill(step.value, step.text ?? "", { timeout: timeoutMs });
    } else if (step.kind === "eval") {
      const value = await page.evaluate("(" + step.value + ")()");
      return { label: step.label, ok: true, note: JSON.stringify(value ?? null).slice(0, 300) };
    } else {
      await page.waitForTimeout(Number(step.value));
    }
    return { label: step.label, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error);
    return { label: step.label, ok: false, note: message.slice(0, 200) };
  }
}

/**
 * Chạy toàn bộ danh sách bước của một kịch bản.
 * Nhận: trang Playwright, các bước, thời gian chờ mỗi lần bấm.
 * Trả: nhật ký từng bước và tên bước bắt buộc đầu tiên bị hỏng (null nếu mọi bước bắt buộc đều xong).
 */
export async function runSteps(
  page: Page,
  steps: readonly Step[],
  timeoutMs: number,
): Promise<{ outcomes: StepOutcome[]; failedRequired: string | null }> {
  const outcomes: StepOutcome[] = [];
  let failedRequired: string | null = null;
  for (const step of steps) {
    const outcome = await runStep(page, step, timeoutMs);
    outcomes.push(outcome);
    if (!outcome.ok && step.required === true && failedRequired === null) failedRequired = step.label;
    await page.waitForTimeout(step.kind === "wait" ? 0 : 350);
  }
  return { outcomes, failedRequired };
}
