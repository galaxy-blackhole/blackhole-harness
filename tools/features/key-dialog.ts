/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc So hộp thoại xin API key và banner lỗi plugin hai bên (5439 vs 4001) + kiểm tra JSON của phản hồi RPC
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Page, Response } from "playwright-core";

import { closeChromeSession, resolveSessionCookieFrom } from "../parity/lib/browser.ts";
import { credentialsPath, nowIso, parityPath, stamp } from "../parity/lib/paths.ts";

import { type SideSpec, defaultSides, launchChromeBounded } from "./lib/capture.ts";
import { composePair, scalePng } from "./lib/measure.ts";

/** Kết quả một bước của một bên. */
interface StepShot {
  /** Ảnh PNG. */
  png: Buffer;
  /** Chữ hiển thị của trang (đã cắt ngắn) để dò dấu hiệu. */
  text: string;
  /** Số hộp thoại đang mở. */
  dialogs: number;
}

/** Kết quả chẩn đoán phản hồi RPC của một bên. */
interface RpcCheck {
  /** URL endpoint. */
  url: string;
  /** Mã trạng thái. */
  status: number;
  /** Giá trị header content-encoding. */
  encoding: string;
  /** Giá trị header content-type. */
  contentType: string;
  /** Số byte thân phản hồi. */
  bytes: number;
  /** 8 byte đầu của thân phản hồi, dạng hex (1f8b = gzip; 7b = JSON thô) — bằng chứng chẩn đoán. */
  headHex: string;
  /** true khi thân phản hồi parse được thành JSON. */
  jsonOk: boolean;
  /** Lỗi parse nếu có (không kèm nội dung phản hồi). */
  jsonError?: string;
  /** true khi thân phản hồi là danh sách số ngăn cách dấu phẩy (dấu hiệu Buffer bị String() hoá). */
  byteList?: boolean;
  /** true khi giải mã danh sách byte rồi parse JSON thành công — bằng chứng nguyên nhân. */
  byteListDecodes?: boolean;
}

/** Kết quả một bên. */
interface SideReport {
  /** Khoá bên. */
  key: string;
  /** Cổng. */
  port: number;
  /** Dấu hiệu tìm thấy ở trạng thái tĩnh sau khi chờ. */
  idleSymptoms: string[];
  /** Dấu hiệu tìm thấy sau khi bấm New Session và gõ một chữ. */
  typedSymptoms: string[];
  /** Số hộp thoại ở trạng thái tĩnh. */
  idleDialogs: number;
  /** Số hộp thoại sau khi gõ. */
  typedDialogs: number;
  /** Lỗi console. */
  consoleErrors: string[];
  /** Kiểm tra JSON của các phản hồi RPC. */
  rpc: RpcCheck[];
}

/** Dấu hiệu cần dò trong chữ hiển thị. */
const MARKERS: readonly string[] = Object.freeze([
  "enter your galaxy api key",
  "failed to load plugins",
  "did not activate",
]);

/**
 * Dò các dấu hiệu trong chữ hiển thị của trang.
 * Nhận: chữ hiển thị (chưa hạ chữ thường).
 * Trả: danh sách dấu hiệu khớp.
 */
export function findMarkers(text: string): string[] {
  const lower = text.toLowerCase();
  return MARKERS.filter((marker) => lower.includes(marker));
}

/**
 * Kiểm tra thân phản hồi RPC có phải JSON hợp lệ (không lưu nội dung phản hồi).
 * Nhận: đối tượng Response của Playwright.
 * Trả: bản ghi kiểm tra gồm mã trạng thái, header nén, số byte và kết quả parse.
 */
export async function checkResponse(response: Response): Promise<RpcCheck> {
  const headers = response.headers();
  const url = response.url().replace(/\?.*$/u, "");
  try {
    const body = await response.body();
    const text = body.toString("utf8");
    const headHex = Buffer.from(body.subarray(0, 8)).toString("hex");
    const meta = {
      url,
      status: response.status(),
      encoding: headers["content-encoding"] ?? "(không)",
      contentType: headers["content-type"] ?? "(không)",
      bytes: body.byteLength,
      headHex,
    };
    try {
      JSON.parse(text);
      return { ...meta, jsonOk: true };
    } catch (error) {
      // Chẩn đoán: thân phản hồi có phải danh sách số thập phân của từng byte (Buffer bị String() hoá)?
      let byteList = false;
      let byteListDecodes = false;
      if (/^[0-9]+(,[0-9]+)+$/u.test(text.slice(0, 20000))) {
        byteList = true;
        try {
          const bytes = Buffer.from(text.split(",").map((part) => Number(part)));
          let decoded = Buffer.alloc(0);
          try {
            const { gunzipSync } = await import("node:zlib");
            decoded = gunzipSync(bytes);
          } catch {
            decoded = bytes;
          }
          JSON.parse(decoded.toString("utf8"));
          byteListDecodes = true;
        } catch {
          byteListDecodes = false;
        }
      }
      return {
        ...meta,
        jsonOk: false,
        jsonError: error instanceof Error ? error.message.slice(0, 120) : String(error),
        byteList,
        byteListDecodes,
      };
    }
  } catch (error) {
    return {
      url,
      status: response.status(),
      encoding: headers["content-encoding"] ?? "(không)",
      contentType: headers["content-type"] ?? "(không)",
      bytes: -1,
      headHex: "",
      jsonOk: false,
      jsonError: "không đọc được thân phản hồi: " + (error instanceof Error ? error.message.slice(0, 80) : String(error)),
    };
  }
}

/**
 * Chụp hai trạng thái của một bên: tĩnh (không thao tác) và sau khi mở session mới + gõ một chữ.
 * Nhận: trang Playwright đã mở, bên cần đo.
 * Trả: báo cáo của bên đó, gồm ảnh hai trạng thái và kiểm tra JSON các phản hồi RPC.
 */
export async function captureKeyDialogSide(page: Page, side: SideSpec): Promise<{ report: SideReport; idle: StepShot; typed: StepShot }> {
  const consoleErrors: string[] = [];
  const rpc: RpcCheck[] = [];
  const pending: Promise<void>[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && consoleErrors.length < 30) consoleErrors.push(message.text().slice(0, 200));
  });
  page.on("response", (response) => {
    if (!response.url().includes("/api/")) return;
    if (response.url().includes("credentials")) return;
    pending.push(
      checkResponse(response).then((check) => {
        if (rpc.length < 60) rpc.push(check);
      }),
    );
  });
  const snapshot = async (): Promise<StepShot> => {
    const text = await page.evaluate(() => document.body.innerText);
    const dialogs = await page.evaluate(
      () => document.querySelectorAll('[role="dialog"],[aria-modal="true"]').length,
    );
    return { png: await page.screenshot({ type: "png" }), text, dialogs };
  };
  await page.goto("http://127.0.0.1:" + String(side.port) + "/", { waitUntil: "load", timeout: 20_000 });
  await page.waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(9000);
  const idle = await snapshot();
  await page.click('button[aria-label="New session"]', { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  await page.click('[role="textbox"]', { timeout: 8000 }).catch(() => undefined);
  await page.keyboard.type("x");
  await page.waitForTimeout(1500);
  const typed = await snapshot();
  await Promise.all(pending);
  return {
    report: {
      key: side.key,
      port: side.port,
      idleSymptoms: findMarkers(idle.text),
      typedSymptoms: findMarkers(typed.text),
      idleDialogs: idle.dialogs,
      typedDialogs: typed.dialogs,
      consoleErrors,
      rpc,
    },
    idle,
    typed,
  };
}

/**
 * Chạy phép so hộp thoại API key: hai bên, profile Chrome MỚI riêng, chụp tĩnh + sau khi gõ.
 * Nhận: không.
 * Trả: mã thoát 0 khi chạy xong; ghi ảnh và verdict.json vào .parity/features/<stamp>/key-dialog-compare.
 */
export async function main(): Promise<number> {
  const dir = join(parityPath("features", stamp()), "key-dialog-compare");
  mkdirSync(dir, { recursive: true });
  const sides = defaultSides();
  const session = await launchChromeBounded(parityPath("tmp"), "keydialog-" + String(Date.now()));
  const reports: Record<string, SideReport> = {};
  const shots: Record<string, { idle: StepShot; typed: StepShot }> = {};
  try {
    for (const side of [sides.ref, sides.ours]) {
      const auth = resolveSessionCookieFrom(side.port, [credentialsPath()]);
      const page = await session.context.newPage();
      try {
        await page.setViewportSize({ width: 1440, height: 900 });
        if (auth.cookie !== null) {
          await session.context.addCookies([
            { name: auth.cookie.name, value: auth.cookie.value, domain: "127.0.0.1", path: "/" },
          ]);
        }
        const result = await captureKeyDialogSide(page, side);
        reports[side.key] = result.report;
        shots[side.key] = { idle: result.idle, typed: result.typed };
        writeFileSync(join(dir, "idle-" + side.key + ".png"), result.idle.png);
        writeFileSync(join(dir, "typed-" + side.key + ".png"), result.typed.png);
        console.log(
          "[features] " + side.key + " idle: dialogs=" + String(result.idle.dialogs) + " symptoms=" + JSON.stringify(result.report.idleSymptoms),
        );
        console.log(
          "[features] " + side.key + " typed: dialogs=" + String(result.typed.dialogs) + " symptoms=" + JSON.stringify(result.report.typedSymptoms),
        );
      } finally {
        await page.close().catch(() => undefined);
      }
    }
    const refShots = shots.ref;
    const oursShots = shots.ours;
    if (refShots !== undefined && oursShots !== undefined) {
      // Trái = ref (4001), phải = ours (5439) — đúng quy ước của ma trận.
      const pairIdle = composePair(refShots.idle.png, oursShots.idle.png);
      const pairTyped = composePair(refShots.typed.png, oursShots.typed.png);
      writeFileSync(join(dir, "pair-idle.png"), pairIdle);
      writeFileSync(join(dir, "pair-typed.png"), pairTyped);
      writeFileSync(join(dir, "thumb-pair-idle.png"), scalePng(pairIdle, 1000));
      writeFileSync(join(dir, "thumb-pair-typed.png"), scalePng(pairTyped, 1000));
    }
    const verdict = {
      at: nowIso(),
      question:
        "Hộp thoại 'Enter your Galaxy API key' và banner 'Failed to load plugins' có xuất hiện ở 4001 không, hay chỉ ở 5439?",
      ref: reports.ref,
      ours: reports.ours,
      answer: {
        keyDialogOnlyOurs:
          (reports.ours?.idleSymptoms.includes("enter your galaxy api key") === true ||
            reports.ours?.typedSymptoms.includes("enter your galaxy api key") === true) &&
          reports.ref?.idleSymptoms.includes("enter your galaxy api key") !== true &&
          reports.ref?.typedSymptoms.includes("enter your galaxy api key") !== true,
        keyDialogOnBoth:
          reports.ref?.idleSymptoms.includes("enter your galaxy api key") === true ||
          reports.ref?.typedSymptoms.includes("enter your galaxy api key") === true,
        bannerOnlyOurs:
          (reports.ours?.idleSymptoms.includes("did not activate") === true ||
            reports.ours?.typedSymptoms.includes("did not activate") === true) &&
          reports.ref?.idleSymptoms.includes("did not activate") !== true,
        refConsoleErrors: reports.ref?.consoleErrors.length ?? -1,
        oursConsoleErrors: reports.ours?.consoleErrors.length ?? -1,
        rpcJsonFailuresOurs: (reports.ours?.rpc ?? []).filter((check) => !check.jsonOk).map((check) => check.url + " :: " + (check.jsonError ?? "")),
        rpcJsonFailuresRef: (reports.ref?.rpc ?? []).filter((check) => !check.jsonOk).map((check) => check.url + " :: " + (check.jsonError ?? "")),
      },
    };
    writeFileSync(join(dir, "verdict.json"), JSON.stringify(verdict, null, 1));
    const table = (label: string, checks: RpcCheck[]): string[] => {
      const seen = new Set<string>();
      const lines: string[] = [];
      for (const check of checks) {
        if (seen.has(check.url)) continue;
        seen.add(check.url);
        lines.push(
          "[features] " + label + " " + String(check.status) + " enc=" + check.encoding + " hex=" + check.headHex +
            " " + String(check.bytes) + "B jsonOk=" + String(check.jsonOk) +
            (check.byteList === true ? " byteList=" + String(check.byteList) + " giaiMaRaJSON=" + String(check.byteListDecodes) : "") +
            " " + check.url.split("/api/").slice(-1)[0],
        );
      }
      return lines;
    };
    for (const line of table("ref", reports.ref?.rpc ?? [])) console.log(line);
    for (const line of table("ours", reports.ours?.rpc ?? [])) console.log(line);
    console.log("[features] verdict: " + JSON.stringify(verdict.answer, null, 1));
    console.log("[features] ảnh: " + dir);
  } finally {
    await closeChromeSession(session);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
