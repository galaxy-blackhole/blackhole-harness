/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc So đồ thị boot (__GBH_BOOT__ (alias __DSH_BOOT__)) hai bên: số entry/batch, inject mồ côi, lỗi console — phục vụ hợp đồng C1
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { closeChromeSession, resolveSessionCookieFrom } from "../parity/lib/browser.ts";
import { credentialsPath, nowIso, parityPath, stamp } from "../parity/lib/paths.ts";

import { type SideSpec, defaultSides, launchChromeBounded } from "./lib/capture.ts";
import { type NetEntry, createNetRecorder } from "./lib/net.ts";

/** Thống kê một mảng trong payload boot. */
interface ArrayStat {
  /** Đường dẫn trong object, ví dụ "entries" hoặc "batches.0.entries". */
  path: string;
  /** Số phần tử. */
  length: number;
  /** Kiểu phần tử đầu tiên. */
  itemKind: string;
}

/** Kết quả đọc boot một bên. */
interface BootSide {
  /** Khoá bên. */
  key: string;
  /** Cổng. */
  port: number;
  /** Có đọc được payload không. */
  present: boolean;
  /** Khoá cấp 1 của payload. */
  keys: string[];
  /** Thống kê mọi mảng tìm được (tối đa 40). */
  arrays: ArrayStat[];
  /** Mọi id thu được từ các mảng đối tượng có trường id. */
  ids: string[];
  /** Mọi mục nằm trong mảng có tên chứa inject. */
  injects: string[];
  /** Mục inject trỏ tới id KHÔNG có trong danh sách id. */
  orphanInjects: string[];
  /** Lỗi console của trang. */
  consoleErrors: string[];
  /** Dấu hiệu bất thường trong chữ hiển thị. */
  symptoms: string[];
  /** Số request không phải asset tĩnh đã ghi. */
  net: NetEntry[];
}

/**
 * Quét payload boot để lấy số entry/batch, danh sách id và các mục inject.
 * Nhận: giá trị đã đọc từ trang (bất kỳ kiểu nào).
 * Trả: { keys, arrays, ids, injects } — đã cắt bớt để không phình file.
 */
function scanBoot(boot: unknown): { keys: string[]; arrays: ArrayStat[]; ids: string[]; injects: string[] } {
  const arrays: ArrayStat[] = [];
  const ids = new Set<string>();
  const injects = new Set<string>();
  const walk = (value: unknown, path: string, depth: number): void => {
    if (depth > 4 || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      const first = value[0];
      const itemKind = first === null ? "null" : Array.isArray(first) ? "array" : typeof first;
      if (arrays.length < 40) arrays.push({ path, length: value.length, itemKind });
      const isInject = path.toLowerCase().includes("inject");
      const isEntryList = path.toLowerCase() === "entries" || path.toLowerCase().endsWith(".entries");
      value.slice(0, 400).forEach((item, index) => {
        if (typeof item === "string") {
          if (isInject) injects.add(item.slice(0, 80));
          return;
        }
        if (item !== null && typeof item === "object") {
          const record = item as Record<string, unknown>;
          // Danh sách entry có thể là mảng chuỗi id hoặc mảng đối tượng có id/name/plugin.
          if (typeof record.id === "string") ids.add(record.id);
          if (typeof record.name === "string") ids.add(record.name);
          if (typeof record.plugin === "string") ids.add(record.plugin);
          if (isInject) {
            const target = record.target ?? record.id ?? record.plugin ?? record.name;
            if (typeof target === "string") injects.add(target.slice(0, 80));
          }
          // Đi sâu vào từng phần tử để bắt các mảng con như entries[i].inject.
          walk(item, path + "." + String(index), depth + 1);
        }
      });
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, path === "" ? key : path + "." + key, depth + 1);
    }
  };
  walk(boot, "", 0);
  return { keys: boot !== null && typeof boot === "object" ? Object.keys(boot as object) : [], arrays, ids: [...ids].sort(), injects: [...injects].sort() };
}

/**
 * Đọc đồ thị boot của một bên bằng một trang mới trong phiên Chrome dùng chung.
 * Nhận: phiên Chrome (đã mở), bên cần đọc.
 * Trả: kết quả boot của bên đó, kèm lỗi console và dấu hiệu bất thường.
 */
async function readBoot(session: { context: { newPage: () => Promise<unknown> } }, side: SideSpec): Promise<BootSide> {
  const auth = resolveSessionCookieFrom(side.port, [credentialsPath()]);
  const recorder = createNetRecorder();
  const page = await (session.context as unknown as {
    newPage: () => Promise<import("playwright-core").Page>;
  }).newPage();
  const consoleErrors: string[] = [];
  try {
    page.setDefaultTimeout(15_000);
    recorder.attach(page);
    if (auth.cookie !== null) {
      await (session.context as unknown as { addCookies: (c: unknown[]) => Promise<void> }).addCookies([
        { name: auth.cookie.name, value: auth.cookie.value, domain: "127.0.0.1", path: "/" },
      ]);
    }
    page.on("console", (message) => {
      if (message.type() === "error" && consoleErrors.length < 30) consoleErrors.push(message.text().slice(0, 200));
    });
    await page.goto("http://127.0.0.1:" + String(side.port) + "/", { waitUntil: "load", timeout: 20_000 });
    await page.waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    const raw = await page.evaluate(() => {
      const scope = globalThis as unknown as Record<string, unknown>;
      // task-31: ưu tiên __GBH_BOOT__; __GBH_BOOT__ (alias __DSH_BOOT__) là ALIAS cũ; __BH_BOOT__ là tên cũ hơn nữa.
      const payload = scope.__GBH_BOOT__ ?? scope.__DSH_BOOT__ ?? scope.__BH_BOOT__ ?? null;
      const text = document.body.innerText;
      return { payload, text };
    });
    const scanned = scanBoot(raw.payload);
    const text = (raw.text ?? "").toLowerCase();
    const symptoms: string[] = [];
    for (const marker of ["did not activate", "failed to load plugins", "enter your galaxy api key"]) {
      if (text.includes(marker)) symptoms.push(marker);
    }
    const orphanInjects = scanned.injects.filter((item) => !scanned.ids.includes(item));
    return {
      key: side.key,
      port: side.port,
      present: raw.payload !== null,
      keys: scanned.keys,
      arrays: scanned.arrays,
      ids: scanned.ids,
      injects: scanned.injects,
      orphanInjects,
      consoleErrors,
      symptoms,
      net: recorder.entries(),
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Điểm vào dòng lệnh: đọc __GBH_BOOT__ (alias __DSH_BOOT__) ở cả hai bên, so inject mồ côi, ghi boot-graph-compare.json.
 * Nhận: tham số dòng lệnh (không bắt buộc tham số nào).
 * Trả: mã thoát 0 khi chạy xong.
 */
export async function main(): Promise<number> {
  const dir = parityPath("features", stamp());
  mkdirSync(dir, { recursive: true });
  const sides = defaultSides();
  const session = await launchChromeBounded(parityPath("tmp"), "bootgraph-" + String(Date.now()));
  try {
    const ref = await readBoot(session, sides.ref);
    const ours = await readBoot(session, sides.ours);
    const payload = {
      at: nowIso(),
      viewport: "1440x900",
      note: "Đọc __DSH_BOOT__ trên cả hai bên; inject mồ côi = mục inject trỏ tới id không có trong danh sách id của payload.",
      ref,
      ours,
      verdict: {
        sameOrphanCount: ref.orphanInjects.length === ours.orphanInjects.length,
        onlyOurs: ours.orphanInjects.filter((item) => !ref.orphanInjects.includes(item)),
        onlyRef: ref.orphanInjects.filter((item) => !ours.orphanInjects.includes(item)),
        oursSymptoms: ours.symptoms,
        refSymptoms: ref.symptoms,
      },
    };
    const file = join(dir, "boot-graph-compare.json");
    writeFileSync(file, JSON.stringify(payload, null, 1));
    writeFileSync(parityPath("features", "latest-boot-graph.json"), JSON.stringify(payload, null, 1));
    console.log("[features] boot-graph: " + file);
    console.log("[features] ref  : " + String(ref.arrays.map((a) => a.path + "=" + String(a.length)).join(", ")));
    console.log("[features] ours : " + String(ours.arrays.map((a) => a.path + "=" + String(a.length)).join(", ")));
    console.log("[features] ref  ids: " + String(ref.ids.length) + " · inject: " + String(ref.injects.length));
    console.log("[features] ref  inject: " + String(ref.injects.length) + " · mồ côi: " + JSON.stringify(ref.orphanInjects));
    console.log("[features] ours inject: " + String(ours.injects.length) + " · mồ côi: " + JSON.stringify(ours.orphanInjects));
    console.log("[features] ref  console errors: " + JSON.stringify(ref.consoleErrors.slice(0, 5)));
    console.log("[features] ours console errors: " + JSON.stringify(ours.consoleErrors.slice(0, 5)));
    console.log("[features] ref  symptoms: " + JSON.stringify(ref.symptoms) + " · ours: " + JSON.stringify(ours.symptoms));
    const showNet = (label: string, entries: NetEntry[]): void => {
      for (const entry of entries.slice(0, 25)) {
        console.log("[features] " + label + " net: " + entry.method + " " + entry.url + " → " + String(entry.status) + " " + String(entry.ms) + "ms" + (entry.error === undefined ? "" : " · " + entry.error));
      }
    };
    showNet("ref ", ref.net);
    showNet("ours", ours.net);
  } finally {
    await closeChromeSession(session);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
