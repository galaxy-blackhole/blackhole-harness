/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Mục M2b của báo cáo parity: plugin ngoài (G1) · DOM/a11y · session round-trip.
 *      Tách khỏi report.ts để file đó không chạm trần 1000 dòng
 */

import { type ReportItem, readJsonFile, relativeToRepo } from "./artifacts.ts";
import { parityPath } from "./paths.ts";
import { type DomArtifact } from "../dom.ts";
import { type ExternalPluginArtifact } from "../plugin-external.ts";
import { type SessionRoundTripArtifact } from "../session.ts";

/** Phần cần đọc từ artifact parity:trace (chỉ các trường dùng cho báo cáo). */
interface TraceArtifactLite {
  /** Kết luận. */
  verdict: string;
  /** Dấu thời gian. */
  stamp: string;
  /** Bên tham chiếu. */
  refKey: string;
  /** Câu lệnh đã chạy ở cả hai bên. */
  prompt: string;
  /** Kết quả tầng HTTP/WS. */
  diff: { httpAdded: string[]; httpMissing: string[]; httpChanged: string[]; httpSame: number; wsAdded: unknown[]; wsMissing: unknown[]; wsChanged: unknown[]; wsSame: number };
  /** Khác biệt mã hoá thân phản hồi (bài học ADR 0004 §8). */
  document: { encodingMismatches: unknown[] };
}

/** Phần cần đọc từ artifact parity:hmr. */
interface HmrArtifactLite {
  /** Kết luận. */
  verdict: string;
  /** Dấu thời gian. */
  stamp: string;
  /** Độ trễ tới khi thấy thay đổi (ms). */
  latencyMs: number;
  /** Độ trễ hoàn nguyên (ms). */
  revertLatencyMs: number;
  /** true khi patch được trả về nguyên văn. */
  patchRestored: boolean;
  /** true khi ảnh sau khi hoàn nguyên giống ảnh gốc. */
  restoreVerified: boolean;
}

/** Kết quả dựng mục M2b: các dòng Markdown và các dòng bảng hạng mục. */
export interface M2bSection {
  /** Các dòng Markdown của mục. */
  lines: string[];
  /** Các dòng bảng hạng mục tương ứng. */
  items: ReportItem[];
}

/**
 * Dựng mục M2b từ ba artifact mới nhất trong .parity.
 * @returns khối Markdown + các dòng bảng hạng mục (hạng mục thiếu artifact ghi rõ CHƯA CÓ).
 */
export function buildM2bSection(): M2bSection {
  const lines: string[] = [];
  const items: ReportItem[] = [];
  const plugin = readJsonFile<ExternalPluginArtifact>(parityPath("latest-plugin-external.json"));
  const dom = readJsonFile<DomArtifact>(parityPath("latest-dom.json"));
  const session = readJsonFile<SessionRoundTripArtifact>(parityPath("latest-session-roundtrip.json"));
  lines.push("## 5. M2b — plugin ngoài (G1) · DOM/a11y · session round-trip");
  lines.push("");

  if (plugin !== null) {
    const peer = plugin.peer;
    lines.push(
      "**plugin-compat** (\`parity:plugin-external\`) → **" + plugin.verdict + "** · plugin NGOÀI " + plugin.plugin.name + "@" + plugin.plugin.version + " của tác giả " +
        plugin.plugin.author + " trên npm, cài bằng đúng đường DSH: \`dsh plugin --profile blackhole add -w " + plugin.plugin.name + "\` với pnpm " + plugin.pnpm.version +
        " (" + plugin.pnpm.source + ").",
    );
    lines.push("");
    lines.push("| bằng chứng | số liệu |");
    lines.push("|---|---|");
    lines.push(
      "| đối chiếu BYTE tarball registry | " + (plugin.tarball === null ? "—" : String(plugin.tarball.bytes) + " B · sha512 khớp=" + String(plugin.tarball.integrityOk) + " · magic gzip=" + String(plugin.tarball.gzipMagicOk)) + " |",
    );
    lines.push(
      "| row vào cây dump-config | " + String(plugin.dumpRow.rowsDuring) + " row · có row plugin=" + String(plugin.dumpRow.during) + " · gỡ xong còn row=" + String(!plugin.dumpRow.afterUninstall) + " |",
    );
    lines.push(
      "| route RIÊNG của plugin " + plugin.plugin.route + " | app **" + String(plugin.route.app?.status ?? -1) + "** (" + String(plugin.route.app?.bytes ?? 0) + " B) · đối chứng oracle A **" +
        String(plugin.route.oracleControl?.status ?? -1) + "** · sau khi gỡ " + String(plugin.route.afterUninstall?.status ?? -1) + " |",
    );
    lines.push(
      "| nửa client ở trình duyệt | entry trong boot graph=" + String(plugin.client.pluginBootEntries.length) + " · bundle tải về=" +
        (plugin.client.bundleHits.map((hit) => hit.bytes).join("/") || "0") + " B · marker trong bundle=" + String(plugin.client.bundleMarkerFound) + " |",
    );
    lines.push("| trang Settings do plugin thêm | " + JSON.stringify(plugin.client.addedNavItems) + " (hiện sau " + String(plugin.client.pageVisibleAfterMs ?? -1) + " ms) |");
    lines.push(
      "| dấu vân tay trạng thái cây | entry boot trước/trong/sau = " + String(plugin.fingerprint.bootEntriesBefore) + "/" + String(plugin.fingerprint.bootEntriesDuring) + "/" +
        String(plugin.fingerprint.bootEntriesAfter) + " · byte trang = " + String(plugin.pageBytes.oursBefore ?? -1) + "/" + String(plugin.pageBytes.oursDuring ?? -1) + "/" +
        String(plugin.pageBytes.oursAfter ?? -1) + " |",
    );
    lines.push(
      "| plugin chạy thật ở nửa host | dòng log riêng=" + String(plugin.hostEvidence.logLines.length) + " · tệp gieo vào home=" + String(plugin.hostEvidence.seededFiles.length) + " |",
    );
    lines.push("| khôi phục | tệp profile byte-nguyên=" + String(plugin.restore.filesIdentical) + " · dọn " + String(plugin.restore.removedPaths.length) + " đường dẫn |");
    if (peer !== null) {
      lines.push(
        "| so hai phía (oracle B, home tạm) | cài exit=" + String(peer.commands.install?.exitCode ?? -1) + " · row plugin=" + String(peer.dumpRow.has) + " · route " +
          String(peer.routeBefore?.status ?? -1) + " → " + String(peer.routeDuring?.status ?? -1) + " · mục Settings thêm=" + JSON.stringify(peer.client?.addedNavItems ?? []) + " |",
      );
    }
    if (typeof plugin.peerConclusion === "string" && plugin.peerConclusion !== "") {
      lines.push("- **kết luận hai phía:** " + plugin.peerConclusion);
    }
    lines.push("");
    lines.push("Ảnh: \`" + (plugin.client.screenshot ?? "—") + "\`" + (peer?.client?.screenshot == null ? "" : " · đối chứng oracle B: \`" + peer.client.screenshot + "\`"));
    lines.push("");
    items.push({
      name: "plugin-compat: cài plugin NGOÀI (npm) rồi chứng minh nạp + chạy",
      status: plugin.verdict,
      detail:
        "route riêng " + plugin.plugin.route + ": app " + String(plugin.route.app?.status ?? -1) + " vs oracle A " + String(plugin.route.oracleControl?.status ?? -1) + " · row trong cây=" +
        String(plugin.dumpRow.during) + " · khôi phục byte-nguyên=" + String(plugin.restore.filesIdentical),
      evidence: relativeToRepo(parityPath("latest-plugin-external.json")),
    });
  } else {
    lines.push("- plugin-compat: CHƯA CÓ artifact (\`bun run tools/parity/plugin-external.ts\`).");
    lines.push("");
    items.push({ name: "plugin-compat: cài plugin NGOÀI (npm) rồi chứng minh nạp + chạy", status: "CHƯA CÓ", detail: "chưa chạy", evidence: "" });
  }

  if (dom !== null) {
    lines.push(
      "**parity:dom** (\`tools/parity/dom.ts --against\`) → **" + dom.verdict + "** · bên tham chiếu " + dom.refKey + " · DOM: giống " + String(dom.diff.same) + " · THÊM " +
        String(dom.diff.added.length) + " · THIẾU " + String(dom.diff.missing.length) + " · ĐỔI " + String(dom.diff.changed.length) + " node · a11y: giống " + String(dom.diff.ariaSame) +
        " · THÊM " + String(dom.diff.ariaAdded.length) + " · THIẾU " + String(dom.diff.ariaMissing.length) + ".",
    );
    lines.push("");
    lines.push("| bên | node DOM | dòng a11y | ảnh |");
    lines.push("|---|---|---|---|");
    lines.push("| " + dom.ref.side + " | " + String(dom.ref.nodes.length) + " | " + String(dom.ref.aria.length) + " | " + (dom.ref.shot ?? "—") + " |");
    lines.push("| " + dom.ours.side + " | " + String(dom.ours.nodes.length) + " | " + String(dom.ours.aria.length) + " | " + (dom.ours.shot ?? "—") + " |");
    lines.push("");
    if (dom.diff.missing.length > 0) lines.push("- selector chỉ có ở ref: " + dom.diff.missing.slice(0, 10).join(" · "));
    if (dom.diff.added.length > 0) lines.push("- selector chỉ có ở ta: " + dom.diff.added.slice(0, 10).join(" · "));
    if (dom.diff.changed.length > 0) lines.push("- selector cùng đường dẫn nhưng khác nội dung: " + dom.diff.changed.slice(0, 10).join(" · "));
    for (const skip of dom.skips) lines.push(skip.startsWith("GHI CHÚ") ? "- " + skip : "- SKIP: " + skip);
    lines.push("");
    items.push({
      name: "parity:dom — cây DOM + a11y của app vs oracle A",
      status: dom.verdict,
      detail: "node: giống " + String(dom.diff.same) + " · thêm " + String(dom.diff.added.length) + " · thiếu " + String(dom.diff.missing.length) + " · đổi " + String(dom.diff.changed.length),
      evidence: relativeToRepo(parityPath("dom", dom.stamp, "diff.md")),
    });
  } else {
    lines.push("- parity:dom: CHƯA CÓ artifact (\`bun run tools/parity/dom.ts --against\`).");
    lines.push("");
    items.push({ name: "parity:dom — cây DOM + a11y của app vs oracle A", status: "CHƯA CÓ", detail: "chưa chạy", evidence: "" });
  }

  if (session !== null) {
    lines.push(
      "**session round-trip** (\`tools/parity/session.ts\`) → **" + session.verdict + "** · hợp đồng lưu trữ: " +
        session.contracts
          .map((entry) => entry.side + " " + String(entry.sessions) + " phiên (magic zstd ok=" + String(entry.magicAllOk) + ", header lõi ok=" + String(entry.headerCoreAllOk) + ")")
          .join(" · ") + ".",
    );
    lines.push("");
    for (const direction of [session.appToPeer, session.peerToApp]) {
      if (direction === null) continue;
      lines.push(
        "- " + direction.from + " → " + direction.to + ": phiên \`" + direction.id + "\` · copy byte-nguyên=" + String(direction.byteIdentical) + " · hiện ra khớp nội dung=" +
          String(direction.renderedMatch) + " · danh sách " + String(direction.listedBefore) + " → " + String(direction.listedAfter) + " → dọn còn " + String(direction.listedAfterCleanup) +
          " · ảnh " + (direction.screenshot ?? "—"),
      );
    }
    lines.push("- ghi chú: chỉ ĐỌC home oracle A để đối chiếu hợp đồng; lượt mở thật dùng oracle B (cùng runtime, cùng slug workspace).");
    lines.push("");
    items.push({
      name: "session round-trip — phiên tạo ở bên này mở được ở bên kia",
      status: session.verdict,
      detail:
        "app→oracle B khớp nội dung=" + String(session.appToPeer?.renderedMatch ?? false) + " · oracle B→app khớp nội dung=" + String(session.peerToApp?.renderedMatch ?? false) +
        " · cùng hợp đồng lưu trữ=" + String(session.contracts.every((entry) => entry.magicAllOk && entry.headerCoreAllOk)),
      evidence: relativeToRepo(parityPath("latest-session-roundtrip.json")),
    });
  } else {
    lines.push("- session round-trip: CHƯA CÓ artifact (\`bun run tools/parity/session.ts\`).");
    lines.push("");
    items.push({ name: "session round-trip — phiên tạo bên này mở được bên kia", status: "CHƯA CÓ", detail: "chưa chạy", evidence: "" });
  }

  // ---- trace + HMR (hai hạng mục đã xong trước đó của M2b) ----
  const trace = readJsonFile<TraceArtifactLite>(parityPath("latest-trace.json"));
  const hmr = readJsonFile<HmrArtifactLite>(parityPath("latest-hmr.json"));
  if (trace !== null) {
    lines.push(
      "**parity:trace** (\`tools/parity/trace.ts\`) → **" + trace.verdict + "** · " + trace.stamp + " · bên tham chiếu " + trace.refKey + " · kịch bản " +
        JSON.stringify(trace.prompt) + " · HTTP: giống " + String(trace.diff.httpSame) + " · THÊM " + String(trace.diff.httpAdded.length) + " · THIẾU " +
        String(trace.diff.httpMissing.length) + " · ĐỔI " + String(trace.diff.httpChanged.length) + " · WS: giống " + String(trace.diff.wsSame) + " · THÊM " +
        String(trace.diff.wsAdded.length) + " · THIẾU " + String(trace.diff.wsMissing.length) + " · ĐỔI " + String(trace.diff.wsChanged.length) + " · lệch mã hoá thân phản hồi: " +
        String(trace.document.encodingMismatches.length) + ".",
    );
    if (trace.diff.httpMissing.length > 0) {
      lines.push("- " + String(trace.diff.httpMissing.length) + " dòng HTTP chỉ có ở ref, đều là \`/open-in-app/*\`: **khác do đường đi kịch bản** (không tính FAIL).");
    }
    lines.push("");
    items.push({
      name: "parity:trace — HTTP + WS + từng bước kịch bản",
      status: trace.verdict,
      detail:
        "lệch mã hoá=0 · HTTP giống " + String(trace.diff.httpSame) + ", thiếu " + String(trace.diff.httpMissing.length) + " (nhãn: khác đường đi kịch bản) · WS đổi " +
        String(trace.diff.wsChanged.length),
      evidence: relativeToRepo(parityPath("latest-trace.json")),
    });
  } else {
    items.push({ name: "parity:trace — HTTP + WS + từng bước kịch bản", status: "CHƯA CÓ", detail: "chưa chạy", evidence: "" });
  }
  if (hmr !== null) {
    lines.push(
      "**HMR sau khi thay webserver (M4a)** (\`tools/parity/hmr.ts\`) → **" + hmr.verdict + "** · " + hmr.stamp + " · độ trễ thấy thay đổi " + String(hmr.latencyMs) +
        " ms · hoàn nguyên " + String(hmr.revertLatencyMs) + " ms · patch trả nguyên văn=" + String(hmr.patchRestored) + " · ảnh sau hoàn nguyên giống gốc=" + String(hmr.restoreVerified) + ".",
    );
    lines.push("");
    items.push({
      name: "HMR hai chiều sau khi thay webserver",
      status: hmr.verdict,
      detail: "thấy thay đổi " + String(hmr.latencyMs) + " ms · hoàn nguyên " + String(hmr.revertLatencyMs) + " ms · patch nguyên văn=" + String(hmr.patchRestored),
      evidence: relativeToRepo(parityPath("latest-hmr.json")),
    });
  } else {
    items.push({ name: "HMR hai chiều sau khi thay webserver", status: "CHƯA CÓ", detail: "chưa chạy", evidence: "" });
  }

  // ---- lượt bị nhiễm đo: ghi rõ để đời sau không trích nhầm số ----
  lines.push("");
  lines.push("### Lượt bị NHIỄM ĐO (không dùng để kết luận)");
  lines.push("");
  lines.push("- **13:43–13:50** — cửa sổ cài/gỡ plugin ngoài của \`parity:plugin-external\`: manifest boot SỐNG của app có thêm 1 entry và trang chủ dài 49.059 B thay vì 48.882 B ở đúng khoảng đó; mọi so sánh pixel/byte trong khoảng này phải bỏ.");
  lines.push("- **lượt ma trận UI trúng lúc cuộn trang** — dòng \`settings-presets\` lệch 3.180 px là nhiễm đo (trạng thái cuộn + thẻ preset của plugin đang cài), KHÔNG phải lỗi app; dấu vân tay trạng thái cây (số \`entries\` + hash \`rev\`) giúp nhận ra loại nhiễm này.");
  lines.push("- Quy tắc: đo xong phải kiểm app LÀNH (sidebar + ô soạn tin, không băng lỗi plugin, không modal API key) **và** state ở home đã sạch, rồi mới ghi số.");
  return { lines, items };
}
