/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:dom — chụp DOM + a11y tree đã chuẩn hoá của hai bên, diff theo cây và liệt kê selector khác nhau
 */

import { join } from "node:path";

import { ARTIFACT_FORMAT, parityRelative, relativeToRepo, writeJsonFile, writeTextFile } from "./lib/artifacts.ts";
import {
  type ChromeSession,
  capturePage,
  closeChromeSession,
  dismissOverlays,
  launchChrome,
  resolveSessionCookieFrom,
} from "./lib/browser.ts";
import { maskString } from "./lib/dump-core.ts";
import {
  OURS_PORT,
  ORACLE_A_PORT,
  STOCK_PORT,
  credentialsPath,
  ensureDir,
  log,
  nowIso,
  parityPath,
  stamp,
  stockHome,
} from "./lib/paths.ts";
import { startStockServer, stopChild } from "./lib/runner.ts";
import { stockTarget } from "./lib/targets.ts";
import { assessUrlHealth, describeHealth, findInvalidWindow } from "./lib/health.ts";
import { maskDynamicIds } from "./lib/trace.ts";

/** Một node DOM đã chuẩn hoá. */
export interface DomNode {
  /** Đường dẫn vị trí trong cây (`body(0)>aside(1)>button(0)`). */
  path: string;
  /** Tên thẻ. */
  tag: string;
  /** `role` nếu có. */
  role: string;
  /** Chữ hiển thị đã rút gọn (đã che id động). */
  text: string;
  /** `aria-label` nếu có (đã che id động). */
  label: string;
  /** Số con trực tiếp. */
  children: number;
  /** true khi node là GỐC của một vùng trạng thái sống (đã chuẩn hoá thành nhãn <state>). */
  state: boolean;
}

/** Cây DOM của một bên. */
export interface DomTree {
  /** Khoá bên. */
  side: string;
  /** URL đã chụp. */
  url: string;
  /** Danh sách node theo thứ tự duyệt. */
  nodes: DomNode[];
  /** Cây a11y (aria snapshot) đã chuẩn hoá thành từng dòng. */
  aria: string[];
  /** Ảnh màn hình kèm theo (tương đối repo). */
  shot: string | null;
  /** Số node bị loại vì nằm trong vùng trạng thái (mask). */
  maskedNodes: number;
}

/** Kết quả diff DOM. */
export interface DomDiff {
  /** Node chỉ có ở ta. */
  added: string[];
  /** Node chỉ có ở ref. */
  missing: string[];
  /** Node cùng đường dẫn nhưng khác nội dung. */
  changed: string[];
  /** Số node giống hệt. */
  same: number;
  /** Dòng a11y chỉ có ở ta. */
  ariaAdded: string[];
  /** Dòng a11y chỉ có ở ref. */
  ariaMissing: string[];
  /** Số dòng a11y giống nhau. */
  ariaSame: number;
  /** Lệch CẤU TRÚC (sau chuẩn hoá) — con số dùng để kết luận. */
  structural: { added: number; missing: number; changed: number; same: number };
  /** Lệch DO STATE (đã loại khỏi kết luận) — số node vùng trạng thái khác nhau. */
  state: { added: number; missing: number; changed: number; same: number };
}

/** Artifact của một lần `parity:dom`. */
export interface DomArtifact {
  /** Phiên bản định dạng. */
  format: number;
  /** Dấu thời gian. */
  stamp: string;
  /** Bắt đầu/kết thúc. */
  startedAt: string;
  /** Kết thúc. */
  finishedAt: string;
  /** Bên tham chiếu. */
  refKey: string;
  /** Cây DOM bên ta. */
  ours: DomTree;
  /** Cây DOM bên tham chiếu. */
  ref: DomTree;
  /** Diff. */
  diff: DomDiff;
  /** Kết luận. */
  verdict: "PASS" | "FAIL" | "SKIP";
  /** Việc bị bỏ kèm lý do. */
  skips: string[];
}

/** Số node tối đa thu thập mỗi bên. */
export const MAX_DOM_NODES = 2000;

/**
 * Vùng TRẠNG THÁI SỐNG bị loại khỏi phép so DOM (cùng nhóm với mask ảnh `state-sidebar-list`).
 * Mỗi instance có danh sách workspace/phiên riêng nên số dòng, tiêu đề và thời gian tương đối
 * khác nhau một cách vô nghĩa với UI structure. Cây con khớp selector bị BỎ khỏi cả node lẫn văn bản
 * của tổ tiên, và số node bị mask được ghi vào artifact để không ai tưởng là "giống hệt".
 */
export const DOM_STATE_MASKS: readonly { selector: string; group: string; why: string }[] = Object.freeze([
  {
    selector: "[role='treeitem'], [role='tree']",
    group: "state-sidebar-list",
    why: "danh sách workspace/phiên là trạng thái sống của từng instance (số phiên, tiêu đề, thời gian tương đối khác nhau)",
  },
  {
    selector: "[aria-label='Choose workspace']",
    group: "state-workspace-picker",
    why:
      "tên workspace đang chọn là CẤU HÌNH của từng instance: oracle mở thư mục dự án (galaxy) còn app để " +
      "default-workspace của DSH. Khác biệt cấu hình/UX đã biết, thuộc M5 (bộ chọn workspace do client shell sở hữu)",
  },
]);

/** Mẫu dòng a11y thuộc vùng trạng thái (có thời gian tương đối hoặc là mục điều hướng workspace/phiên). */
export const A11Y_STATE_PATTERNS: readonly RegExp[] = Object.freeze([
  /\b\d+\s*(min|phút)\b/iu,
  /more sessions/iu,
  /^[-\s]*(treeitem|button)\s+"(Default workspace|Choose workspace|New Session)/iu,
  // Nút workspace đang chọn (treeitem mở rộng) mang TÊN workspace — state của từng instance.
  /treeitem\s+"[^"]*"\s*\[expanded\]/iu,
]);

/**
 * Lọc các dòng a11y thuộc vùng trạng thái đã mask, trả về phần còn lại.
 * @param lines dòng a11y đã chuẩn hoá.
 * @returns dòng giữ lại và số dòng đã bỏ.
 */
export function stripA11yState(lines: readonly string[]): { kept: string[]; dropped: number } {
  const kept = lines.filter((line) => !A11Y_STATE_PATTERNS.some((pattern) => pattern.test(line)));
  return { kept, dropped: lines.length - kept.length };
}

/**
 * Thu thập cây DOM + a11y của một bên.
 * @param session phiên Chrome.
 * @param side khoá bên.
 * @param url URL trang.
 * @param cookie cookie phiên.
 * @param shotFile đường dẫn ảnh sẽ ghi.
 * @returns cây DOM đã chuẩn hoá.
 */
export async function captureDom(
  session: ChromeSession,
  side: string,
  url: string,
  cookie: { name: string; value: string } | null,
  shotFile: string,
): Promise<DomTree> {
  const probe = await capturePage(session, { url, width: 1440, height: 900, cookie, settleMs: 1500 });
  if (!probe.ok) return { side, url, nodes: [], aria: [], shot: null, maskedNodes: 0 };
  const page = await session.context.newPage();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page
      .waitForFunction(() => document.querySelectorAll("button").length >= 1, { timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(2000);
    await dismissOverlays(page);
    await page.waitForTimeout(800);
    const raw = await page.evaluate(
      (input: { max: number; masks: string[] }) => {
        const skip = new Set(["SCRIPT", "STYLE", "META", "LINK", "HEAD", "TEMPLATE", "NOSCRIPT"]);
        const out: { path: string; tag: string; role: string; text: string; label: string; children: number; state: boolean }[] = [];
        let maskedNodes = 0;
        const isMasked = (element: Element): boolean =>
          input.masks.some((selector) => {
            try {
              return element.matches(selector);
            } catch {
              return false;
            }
          });
        // Văn bản của một node KHÔNG tính phần nằm trong vùng đã mask, nếu không tổ tiên của vùng
        // trạng thái sẽ bị báo ĐỔI chỉ vì danh sách phiên khác nhau.
        const textOf = (element: Element): string => {
          if (isMasked(element)) return "";
          let text = "";
          for (const child of Array.from(element.childNodes)) {
            if (child.nodeType === 3) text += child.nodeValue ?? "";
            else if (child.nodeType === 1 && !isMasked(child as Element)) text += textOf(child as Element);
          }
          return text;
        };
        const walk = (element: Element, path: string): void => {
          if (out.length >= input.max) return;
          if (skip.has(element.tagName)) return;
          const children = Array.from(element.children);
          const maskedRoot = isMasked(element);
          out.push({
            path,
            tag: element.tagName.toLowerCase(),
            role: element.getAttribute("role") ?? "",
            // Vùng trạng thái được CHUẨN HOÁ thành một nhãn duy nhất, không đi sâu vào bên trong:
            // số phiên, tiêu đề và thời gian tương đối là state của từng instance, không phải UI.
            text: maskedRoot ? "<state>" : textOf(element).replace(/\s+/gu, " ").trim().slice(0, 60),
            label: maskedRoot ? "" : (element.getAttribute("aria-label") ?? ""),
            children: children.length,
            state: maskedRoot,
          });
          if (maskedRoot) {
            maskedNodes += 1;
            return;
          }
          children.forEach((child, index) => walk(child, path + ">" + child.tagName.toLowerCase() + "(" + String(index) + ")"));
        };
        if (document.body !== null) walk(document.body, "body");
        return { nodes: out, maskedNodes };
      },
      { max: MAX_DOM_NODES, masks: DOM_STATE_MASKS.map((mask) => mask.selector) },
    );
    const nodes: DomNode[] = raw.nodes.map((node) => ({
      ...node,
      path: maskDynamicIds(node.path, []),
      text: node.state ? "<state>" : maskDynamicIds(maskString(node.text, []), []),
      label: node.state ? "" : maskDynamicIds(node.label, []),
    }));
    const ariaRaw = await page.locator("body").ariaSnapshot().catch(() => "");
    const ariaAll = ariaRaw
      .split("\n")
      .map((line) => maskDynamicIds(line.trim(), []))
      .filter((line) => line.length > 0);
    // Cùng lý do như mask cây DOM: dòng a11y thuộc vùng trạng thái bị loại khỏi phép so.
    const aria = stripA11yState(ariaAll).kept;
    await page.screenshot({ path: shotFile, type: "png" }).catch(() => undefined);
    return { side, url, nodes, aria, shot: relativeToRepo(shotFile), maskedNodes: raw.maskedNodes };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Diff hai cây DOM theo đường dẫn node + a11y theo dòng.
 * @param ref cây bên ref.
 * @param ours cây bên ta.
 * @returns số node/dòng thêm, thiếu, đổi và danh sách selector khác nhau.
 */
export function diffDom(ref: DomTree, ours: DomTree): DomDiff {
  // Hai phép so TÁCH BIỆT: cấu trúc (kết luận) và vùng trạng thái (đã loại, chỉ đếm).
  const structural = diffNodesByPath(
    ref.nodes.filter((node) => !node.state),
    ours.nodes.filter((node) => !node.state),
  );
  const state = diffNodesByPath(
    ref.nodes.filter((node) => node.state),
    ours.nodes.filter((node) => node.state),
  );
  const ariaDiff = diffLines(ref.aria, ours.aria);
  return {
    added: structural.added,
    missing: structural.missing,
    changed: structural.changed,
    same: structural.same,
    ariaAdded: ariaDiff.added,
    ariaMissing: ariaDiff.missing,
    ariaSame: ariaDiff.same,
    structural: { added: structural.added.length, missing: structural.missing.length, changed: structural.changed.length, same: structural.same },
    state: { added: state.added.length, missing: state.missing.length, changed: state.changed.length, same: state.same },
  };
}

/**
 * So hai danh sách node theo đường dẫn (dùng chung cho cả cây và vùng trạng thái).
 * @param refNodes node bên ref.
 * @param oursNodes node bên ta.
 * @returns danh sách mô tả thêm/thiếu/đổi và số node giống.
 */
function diffNodesByPath(
  refNodes: readonly DomNode[],
  oursNodes: readonly DomNode[],
): { added: string[]; missing: string[]; changed: string[]; same: number } {
  const refByPath = new Map(refNodes.map((node) => [node.path, signature(node)]));
  const oursByPath = new Map(oursNodes.map((node) => [node.path, signature(node)]));
  const added: string[] = [];
  const missing: string[] = [];
  const changed: string[] = [];
  let same = 0;
  for (const [path, signatureValue] of oursByPath) {
    const other = refByPath.get(path);
    if (other === undefined) {
      added.push(describeNode(oursNodes.find((node) => node.path === path)));
      continue;
    }
    if (other === signatureValue) {
      same += 1;
      continue;
    }
    changed.push(describeNode(oursNodes.find((node) => node.path === path)));
  }
  for (const path of refByPath.keys()) {
    if (!oursByPath.has(path)) missing.push(describeNode(refNodes.find((node) => node.path === path)));
  }
  return { added: added.slice(0, 60), missing: missing.slice(0, 60), changed: changed.slice(0, 60), same };
}

/**
 * Chữ ký so sánh của một node.
 * @param node node cần lấy chữ ký.
 * @returns chuỗi chữ ký.
 */
export function signature(node: DomNode): string {
  return node.tag + "|" + node.role + "|" + node.text + "|" + node.label + "|" + String(node.children) + (node.state ? "|state" : "");
}

/**
 * Mô tả một node thành selector dễ đọc.
 * @param node node cần mô tả.
 * @returns chuỗi `path <tag> "text"`.
 */
export function describeNode(node: DomNode | undefined): string {
  if (node === undefined) return "(không rõ)";
  return node.path + " <" + node.tag + "> " + (node.text === "" ? "" : '"' + node.text.slice(0, 30) + '"');
}

/**
 * Diff hai danh sách dòng theo số lần xuất hiện.
 * @param refLines dòng bên ref.
 * @param oursLines dòng bên ta.
 * @returns dòng thêm/thiếu và số dòng giống.
 */
export function diffLines(refLines: readonly string[], oursLines: readonly string[]): { added: string[]; missing: string[]; same: number } {
  const count = (lines: readonly string[]): Map<string, number> => {
    const map = new Map<string, number>();
    for (const line of lines) map.set(line, (map.get(line) ?? 0) + 1);
    return map;
  };
  const ref = count(refLines);
  const ours = count(oursLines);
  const added: string[] = [];
  const missing: string[] = [];
  let same = 0;
  for (const [line, value] of ours) {
    const other = ref.get(line);
    if (other === undefined) added.push(line);
    else if (other === value) same += 1;
    else added.push(line + " (ref ×" + String(other) + " → ours ×" + String(value) + ")");
  }
  for (const [line, value] of ref) if (!ours.has(line)) missing.push(line + " (×" + String(value) + ")");
  return { added: added.slice(0, 60), missing: missing.slice(0, 60), same };
}

/**
 * Chạy `parity:dom`.
 * @param options `oursPort`, `ref`, `quiet`.
 * @returns artifact đã ghi xuống `.parity/dom/<stamp>/`.
 */
export async function runDom(options: { oursPort?: number; ref?: "oracleA" | "stock"; quiet?: boolean } = {}): Promise<DomArtifact> {
  const startedAt = nowIso();
  const runStamp = stamp();
  const dir = ensureDir(parityPath("dom", runStamp));
  const oursPort = options.oursPort ?? OURS_PORT;
  const refKey = options.ref ?? "oracleA";
  const refPort = refKey === "oracleA" ? ORACLE_A_PORT : STOCK_PORT;
  const skips: string[] = [];
  // Cổng trạng thái + cửa sổ không hợp lệ: không đạt thì SKIP kèm lý do, KHÔNG kết luận và KHÔNG crash.
  const invalid = findInvalidWindow();
  if (invalid !== null) skips.push("thời điểm đo nằm trong INVALID_WINDOWS " + invalid.from + "–" + invalid.to + " (" + invalid.why + ")");
  let session: ChromeSession | null = null;
  let child = null as ReturnType<typeof startStockServer> extends Promise<infer T> ? (T extends { child: infer C } ? C : null) : null;
  try {
    session = await launchChrome(parityPath("tmp"), runStamp + "-dom");
    const oursAuth = resolveSessionCookieFrom(oursPort, [credentialsPath()]);
    const refAuth = resolveSessionCookieFrom(refPort, [credentialsPath(), join(stockHome(), ".credentials.yaml")]);
    if (refKey === "stock") {
      const probe = await capturePage(session, { url: "http://127.0.0.1:" + String(refPort) + "/", width: 800, height: 600, cookie: refAuth.cookie, settleMs: 100 });
      if (!probe.ok && !probe.unauthorized) {
        const server = await startStockServer(stockTarget(), refPort);
        child = server.child;
        if (!server.ok) skips.push("ref: không boot được oracle B — " + server.note);
      }
    }
    const oursHealth = await assessUrlHealth(session.context, "http://127.0.0.1:" + String(oursPort) + "/", {
      cookie: oursAuth.cookie,
      waitMs: 2500,
    });
    if (!oursHealth.ok) skips.push("cổng trạng thái app (cổng " + String(oursPort) + "): " + describeHealth(oursHealth) + " → SKIP, không kết luận");
    let refTree: DomTree = { side: refKey, url: "http://127.0.0.1:" + String(refPort) + "/", nodes: [], aria: [], shot: null, maskedNodes: 0 };
    let oursTree: DomTree = { side: "ours", url: "http://127.0.0.1:" + String(oursPort) + "/", nodes: [], aria: [], shot: null, maskedNodes: 0 };
    if (oursHealth.ok) {
      try {
        refTree = await captureDom(session, refKey, "http://127.0.0.1:" + String(refPort) + "/", refAuth.cookie, join(dir, refKey + "-dom.png"));
        oursTree = await captureDom(session, "ours", "http://127.0.0.1:" + String(oursPort) + "/", oursAuth.cookie, join(dir, "ours-dom.png"));
      } catch (error) {
        skips.push("không chụp được DOM: " + (error instanceof Error ? error.message : String(error)));
      }
    }
    const empty = refTree.nodes.length === 0 || oursTree.nodes.length === 0;
    if (empty && skips.length === 0) skips.push("một bên không thu được node DOM nào");
    skips.push(
      "GHI CHÚ (khác biệt đã biết, xử lý ở M5): app mặc định mở workspace default-workspace của DSH, oracle mở workspace trỏ thư mục dự án — " +
        "vùng chọn workspace đã được chuẩn hoá thành state (state-workspace-picker)",
    );
    const diff = empty
      ? {
          added: [] as string[],
          missing: [] as string[],
          changed: [] as string[],
          same: 0,
          ariaAdded: [] as string[],
          ariaMissing: [] as string[],
          ariaSame: 0,
          structural: { added: 0, missing: 0, changed: 0, same: 0 },
          state: { added: 0, missing: 0, changed: 0, same: 0 },
        }
      : diffDom(refTree, oursTree);
    const artifact: DomArtifact = {
      format: ARTIFACT_FORMAT,
      stamp: runStamp,
      startedAt,
      finishedAt: nowIso(),
      refKey,
      ours: oursTree,
      ref: refTree,
      diff,
      // Kết luận CHỈ dựa trên lệch CẤU TRÚC; lệch do state đã bị chuẩn hoá và chỉ được đếm.
      verdict: empty ? "SKIP" : diff.structural.added + diff.structural.missing + diff.structural.changed === 0 ? "PASS" : "FAIL",
      skips,
    };
    writeJsonFile(join(dir, "ours.json"), oursTree);
    writeJsonFile(join(dir, refKey + ".json"), refTree);
    writeTextFile(join(dir, "diff.md"), formatDomDiff(artifact));
    writeJsonFile(parityPath("latest-dom.json"), artifact);
    if (!options.quiet) printDomSummary(artifact);
    return artifact;
  } finally {
    stopChild(child);
    await closeChromeSession(session);
  }
}

/**
 * In kết quả diff DOM thành Markdown.
 * @param artifact artifact của lần chạy.
 * @returns khối Markdown.
 */
export function formatDomDiff(artifact: DomArtifact): string {
  const { diff } = artifact;
  const lines: string[] = [];
  lines.push("### DOM + a11y: ours vs " + artifact.refKey + " → " + artifact.verdict);
  lines.push("");
  lines.push(
    "| bên | node DOM | node bị mask | dòng a11y | ảnh |\n|---|---|---|---|---|\n| " + artifact.ref.side + " | " + String(artifact.ref.nodes.length) +
      " | " + String(artifact.ref.maskedNodes) + " | " + String(artifact.ref.aria.length) + " | " + (artifact.ref.shot ?? "—") + " |\n| " + artifact.ours.side + " | " +
      String(artifact.ours.nodes.length) + " | " + String(artifact.ours.maskedNodes) + " | " + String(artifact.ours.aria.length) + " | " + (artifact.ours.shot ?? "—") + " |",
  );
  lines.push("");
  for (const mask of DOM_STATE_MASKS) lines.push("- vùng mask (trạng thái sống, có lý do): " + mask.group + " · selector " + mask.selector + " · " + mask.why);
  lines.push("");
  lines.push(
    "- **lệch CẤU TRÚC** (con số để kết luận): giống **" + String(diff.structural.same) + "** · THÊM **" + String(diff.structural.added) + "** · THIẾU **" +
      String(diff.structural.missing) + "** · ĐỔI **" + String(diff.structural.changed) + "**",
  );
  lines.push(
    "- **lệch do STATE** (đã loại khỏi kết luận; danh sách phiên/workspace/thời gian tương đối): giống " + String(diff.state.same) + " · THÊM " +
      String(diff.state.added) + " · THIẾU " + String(diff.state.missing) + " · ĐỔI " + String(diff.state.changed),
  );
  lines.push("- a11y: giống **" + String(diff.ariaSame) + "** · THÊM **" + String(diff.ariaAdded.length) + "** · THIẾU **" + String(diff.ariaMissing.length) + "**");
  if (diff.missing.length > 0) lines.push("- node chỉ có ở ref: " + diff.missing.slice(0, 8).join(" · "));
  if (diff.added.length > 0) lines.push("- node chỉ có ở ta: " + diff.added.slice(0, 8).join(" · "));
  if (diff.ariaMissing.length > 0) lines.push("- a11y chỉ có ở ref: " + diff.ariaMissing.slice(0, 8).join(" · "));
  for (const skip of artifact.skips) lines.push(skip.startsWith("GHI CHÚ") ? "- " + skip : "- SKIP: " + skip);
  return lines.join("\n");
}

/**
 * In tóm tắt DOM ra console.
 * @param artifact artifact của lần chạy.
 * @returns không trả gì.
 */
export function printDomSummary(artifact: DomArtifact): void {
  console.log("");
  console.log("=== parity:dom — " + artifact.stamp + " → " + artifact.verdict + " ===");
  console.log(formatDomDiff(artifact));
  console.log("");
  console.log("artifact: " + parityRelative("dom", artifact.stamp));
}

/**
 * Điểm vào CLI `parity:dom`.
 * @param argv tham số sau tên script.
 * @returns 0 khi chạy xong; 1 khi FAIL và bật `--strict`.
 */
export async function main(argv: string[]): Promise<number> {
  const portIndex = argv.indexOf("--ours-port");
  const artifact = await runDom({
    oursPort: portIndex === -1 ? undefined : Number(argv[portIndex + 1]),
    ref: argv.includes("--against") ? "oracleA" : "stock",
    quiet: argv.includes("--json"),
  });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(artifact, null, 2));
    return artifact.verdict === "PASS" ? 0 : 1;
  }
  return argv.includes("--strict") && artifact.verdict === "FAIL" ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
