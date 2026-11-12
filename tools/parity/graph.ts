/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:graph — so DO THI CLIENT (__GBH_BOOT__ (alias __DSH_BOOT__) + console phia trang) hai ben: entry, inject treo, entry khong activate
 */

import { join } from "node:path";

import { relativeToRepo, writeJsonFile, writeTextFile } from "./lib/artifacts.ts";
import { closeChromeSession, launchChrome } from "./lib/browser.ts";
import { ORACLE_A_PORT, OURS_PORT, appHome, credentialsPath, parityPath, stamp } from "./lib/paths.ts";
import { enterSession } from "./lib/session-entry.ts";

/** Mot entry trong do thi client. */
export interface GraphEntry {
  /** id module. */
  id: string;
  /** danh sach id ma entry nay inject. */
  inject: string[];
  /** trang thai doc duoc tu entry (thuong rong: payload khong co truong nay). */
  state: string;
}

/** Ket qua doc do thi mot ben. */
export interface SideGraph {
  /** khoa ben. */
  side: string;
  /** trang thai HTTP. */
  status: number;
  /** so byte HTML. */
  bytes: number;
  /** entry doc duoc tu payload. */
  entries: GraphEntry[];
  /** inject tro toi id KHONG co trong do thi. */
  danglingInject: { entry: string; target: string }[];
  /** entry khong o trang thai chay doc tu payload (thuong rong). */
  notActivated: string[];
  /** So entry khong activate DOC TU CONSOLE PHIA TRANG. */
  bootNotActivated: number | null;
  /** Entry dang o trang thai loading/pending (doc tu console phia trang). */
  pendingEntries: string[];
  /** TEN SERVICE dang bi cho (doc tu console: "waiting for service: X") — du lieu THAM QUYEN. */
  waitingServices: { service: string; count: number }[];
  /** Dong console/loi trang dau tien (bang chung tho). */
  consoleErrors: string[];
  /** Cac khoa cua payload __DSH_BOOT__. */
  entryKeys: string[];
  /** Entry cua GOI TA (namespace cua ta) kem trang thai kich hoat — phep kiem THEO TUNG GOI. */
  ourEntries: { id: string; activated: boolean }[];
  /** Entry cua goi ta KHONG kich hoat (rong = moi goi cua ta deu chay). */
  ourNotActivated: string[];
}

/**
 * Doc do thi client cua mot cong bang trinh duyet that (token -> cookie -> __GBH_BOOT__ (alias __DSH_BOOT__) + console).
 * @param port - cong app.
 * @param side - khoa ben.
 * @returns do thi da phan tich.
 */
export async function readGraph(port: number, side: string): Promise<SideGraph> {
  const session = await launchChrome(parityPath("tmp"), stamp() + "-graph-" + side);
  try {
    await enterSession(session.context, port, [credentialsPath(), appHome() + "/.credentials.yaml"]);
    const page = await session.context.newPage();
    // Phep dem "N entries did not activate" (chi so (8) cua check:app) CHI co o console phia trang:
    // payload __GBH_BOOT__ (alias __DSH_BOOT__) chi co rev/release/entries/batches, khong co truong state/status.
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push("pageerror: " + String(error.message)));
    const response = await page.goto("http://127.0.0.1:" + String(port) + "/", { waitUntil: "load", timeout: 45_000 });
    const html = await response?.body().catch(() => Buffer.from(""));
    await page.waitForTimeout(3500);
    const boot = await page
      // task-31: ưu tiên __GBH_BOOT__; __GBH_BOOT__ (alias __DSH_BOOT__) là ALIAS tương thích (app/fixture cũ).
      .evaluate(() => {
        const scope = globalThis as unknown as Record<string, unknown>;
        return scope.__GBH_BOOT__ ?? scope.__DSH_BOOT__ ?? null;
      })
      .catch(() => null);
    const raw = JSON.stringify(boot ?? {});
    const entries: GraphEntry[] = [];
    const seen = new Set<string>();
    for (const match of raw.matchAll(/\{"id":"([^"]+)"([^}]*)\}/gu)) {
      const id = match[1] ?? "";
      if (id === "" || seen.has(id)) continue;
      seen.add(id);
      const body = match[2] ?? "";
      const inject = [...body.matchAll(/"inject":\[([^\]]*)\]/gu)]
        .flatMap((m) => (m[1] ?? "").split(",").map((s) => s.replace(/["\s]/gu, "")).filter((s) => s !== ""));
      const state = /"state":"([^"]+)"/u.exec(body)?.[1] ?? /"status":"([^"]+)"/u.exec(body)?.[1] ?? "";
      entries.push({ id, inject, state });
    }
    const ids = new Set(entries.map((entry) => entry.id));
    const danglingInject = entries.flatMap((entry) =>
      entry.inject.filter((target) => !ids.has(target)).map((target) => ({ entry: entry.id, target })),
    );
    const notActivated = entries.filter((entry) => entry.state !== "" && entry.state !== "ready" && entry.state !== "live").map((entry) => entry.id);
    const entryKeys = boot === null ? [] : Object.keys(boot as Record<string, unknown>);
    const joined = consoleErrors.join("\n");
    const bootNotActivated = Number(/web boot: (\d+) entries? did not activate/u.exec(joined)?.[1] ?? Number.NaN);
    // TEN SERVICE dang bi cho — day la du lieu THAM QUYEN (thay cho viec suy tu bang provide, rat de sai):
    // bundle co the cap service bang nhieu khuon khac nhau, con thong diep cho thi noi thang ten service.
    const waitingCounts = new Map<string, number>();
    // Hai khuon co that trong console: "waiting for service: X" va "waiting for services: a, b".
    for (const match of joined.matchAll(/waiting for services?: ([^)\n]+)/gu)) {
      for (const raw of (match[1] ?? "").split(",")) {
        const service = raw.replace(/[\s"']/gu, "");
        if (service === "") continue;
        waitingCounts.set(service, (waitingCounts.get(service) ?? 0) + 1);
      }
    }
    const waitingServices = [...waitingCounts.entries()]
      .map(([service, count]) => ({ service, count }))
      .sort((left, right) => right.count - left.count);
    const pendingEntries = [
      ...new Set([...joined.matchAll(/(@[\w./-]+): (loading|pending)/gu)].map((m) => (m[1] ?? "") + " (" + (m[2] ?? "") + ")")),
    ];
    // Phep kiem THEO TUNG GOI: entry cua ta nao khong nam trong danh sach ket thi coi la da kich hoat.
    const stuckIds = new Set(pendingEntries.map((item) => item.replace(/ \(.*$/u, "")));
    const ourEntries = entries
      .filter((entry) => entry.id.startsWith("@galaxy-blackhole/") || entry.id.startsWith("@galaxy-stack/"))
      .map((entry) => ({ id: entry.id, activated: !stuckIds.has(entry.id) }));
    const ourNotActivated = ourEntries.filter((entry) => !entry.activated).map((entry) => entry.id);

    return {
      side,
      status: response?.status() ?? 0,
      bytes: html?.length ?? 0,
      entries,
      danglingInject,
      notActivated,
      bootNotActivated: Number.isNaN(bootNotActivated) ? null : bootNotActivated,
      pendingEntries,
      waitingServices,
      consoleErrors: consoleErrors.slice(0, 8),
      entryKeys,
      ourEntries,
      ourNotActivated,
    };
  } finally {
    await closeChromeSession(session);
  }
}

/**
 * In bang so sanh do thi hai ben.
 * @param ours - do thi ben ta.
 * @param ref - do thi ben tham chieu.
 * @returns khoi Markdown.
 */
export function formatGraph(ours: SideGraph, ref: SideGraph): string {
  const oursIds = new Set(ours.entries.map((entry) => entry.id));
  const refIds = new Set(ref.entries.map((entry) => entry.id));
  const onlyOurs = [...oursIds].filter((id) => !refIds.has(id));
  const onlyRef = [...refIds].filter((id) => !oursIds.has(id));
  const cell = (side: SideGraph): string =>
    "| " + side.side + " | " + String(side.status) + " | " + String(side.bytes) + " | " + String(side.entries.length) + " | " +
    String(side.danglingInject.length) + " | " + (side.bootNotActivated === null ? "?" : String(side.bootNotActivated)) + " | " +
    String(side.pendingEntries.length) + " |";
  const lines = [
    "### parity:graph — do thi client (__DSH_BOOT__ + console phia trang)",
    "",
    "| ben | HTTP | bytes | entry | inject TREO | entry khong activate (console) | entry loading/pending |",
    "|---|---|---|---|---|---|---|",
    cell(ref),
    cell(ours),
    "",
    "- id chi co o ta: " + String(onlyOurs.length) + (onlyOurs.length > 0 ? " (" + onlyOurs.slice(0, 8).join(", ") + ")" : ""),
    "- id chi co o ref: " + String(onlyRef.length) + (onlyRef.length > 0 ? " (" + onlyRef.slice(0, 8).join(", ") + ")" : ""),
  ];
  if (ours.danglingInject.length > 0) {
    lines.push("- inject treo (ben ta, " + String(ours.danglingInject.length) + "): " + ours.danglingInject.slice(0, 10).map((d) => d.entry + " -> " + d.target).join(" · "));
  }
  if (ours.pendingEntries.length > 0) lines.push("- entry loading/pending (ben ta): " + ours.pendingEntries.slice(0, 10).join(" · "));
  // PHEP KIEM THEO TUNG GOI: khong phai "27 goi" o dang tong, ma tung entry cua ta mot.
  lines.push(
    "- **entry cua GOI TA: " + String(ours.ourEntries.length) + "** · **khong kich hoat: " + String(ours.ourNotActivated.length) + "**" +
      (ours.ourNotActivated.length > 0 ? " (" + ours.ourNotActivated.join(", ") + ")" : " (moi goi cua ta deu chay)"),
  );
  if (ours.waitingServices.length > 0) {
    lines.push(
      "- SERVICE dang bi cho (ben ta, du lieu tham quyen): " +
        ours.waitingServices.slice(0, 8).map((w) => w.service + " ×" + String(w.count)).join(" · "),
    );
  } else {
    lines.push("- SERVICE dang bi cho (ben ta): khong co dong 'waiting for service' nao");
  }
  if (ours.consoleErrors.length > 0) lines.push("- console phia trang (ben ta): " + ours.consoleErrors.slice(0, 3).join(" || ").slice(0, 280));
  if (ours.entryKeys.length > 0) lines.push("- khoa cua payload: " + ours.entryKeys.join(", "));
  return lines.join("\n");
}

/**
 * Diem vao CLI: doc do thi hai ben va ghi artifact (ca hai chi so trong MOT file).
 * @param argv - tham so sau ten script.
 * @returns 0 khi chay xong.
 */
export async function main(argv: string[]): Promise<number> {
  const oursPort = Number(argv[argv.indexOf("--ours-port") + 1]) || OURS_PORT;
  const refPort = Number(argv[argv.indexOf("--ref-port") + 1]) || ORACLE_A_PORT;
  const ref = await readGraph(refPort, "ref");
  const ours = await readGraph(oursPort, "ours");
  const dir = parityPath("graph", stamp());
  writeJsonFile(join(dir, "ours.json"), ours);
  writeJsonFile(join(dir, "ref.json"), ref);
  writeTextFile(join(dir, "diff.md"), formatGraph(ours, ref));
  console.log(formatGraph(ours, ref));
  console.log("");
  console.log("artifact: " + relativeToRepo(dir));
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
