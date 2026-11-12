/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Sinh docs/UI-PARITY.md: ma trận ảnh A/B theo từng màn hình kèm số đo pixel, vùng mask và kết luận
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { repoPath } from "../parity/lib/paths.ts";

import type { FeatureArtifact, ScenarioRecord, StrayElement } from "./run.ts";
import type { MaskRegion } from "./lib/types.ts";

/** Đường dẫn tài liệu ma trận ảnh (do tm-ui-features sở hữu). */
export const DOC_PATH = "docs/UI-PARITY.md";

/** Dấu nháy ngược dùng để bọc tên file/biến trong Markdown (không viết trực tiếp cho khỏi vướng chuỗi). */
export const TICK = String.fromCharCode(96);

/**
 * Đổi tỉ lệ thành phần trăm dễ đọc.
 * Nhận: tỉ lệ 0..1 và số chữ số thập phân.
 * Trả: chuỗi phần trăm, ví dụ 0.061%.
 */
export function percent(ratio: number, digits = 3): string {
  return (ratio * 100).toFixed(digits) + "%";
}

/**
 * Bọc một chuỗi trong dấu nháy ngược kiểu Markdown.
 * Nhận: chuỗi cần bọc.
 * Trả: chuỗi đã bọc bằng hai dấu nháy ngược.
 */
export function code(value: string): string {
  return TICK + value + TICK;
}

/**
 * Mô tả ngắn các vùng mask của một màn hình để nhét vào ô bảng.
 * Nhận: danh sách vùng mask theo tỉ lệ.
 * Trả: chuỗi tên vùng kèm nhóm (brand/state), hoặc ghi chú khi không mask vùng nào.
 */
export function maskCell(masks: readonly MaskRegion[]): string {
  if (masks.length === 0) return "không mask";
  return masks.map((mask) => code(mask.name) + " (" + mask.kind + ")").join(", ");
}

/**
 * Đường dẫn tương đối từ docs/ tới một file artifact trong .parity.
 * Nhận: đường dẫn tương đối repo của file ảnh.
 * Trả: đường dẫn tương đối dùng được trong Markdown, ví dụ ../.parity/features/<stamp>/thumb-x.png.
 */
export function relFromDocs(repoRelative: string): string {
  return "../" + repoRelative;
}

/**
 * Sự cố đã bắt được và đã sửa trong quá trình đo — bằng chứng giàn đo hoạt động đúng.
 * Mỗi mục: hiện tượng, số đo lúc phát hiện, gốc rễ, cách sửa, số đo sau khi sửa.
 */
export const INCIDENTS: readonly { title: string; found: string; cause: string; fix: string; after: string }[] = Object.freeze([
  {
    title: "Cửa sổ restart host lúc 12:58 (chạy dev:web sai thư mục)",
    found: "Ảnh/cặp chụp rơi đúng lúc host đang tắt–bật: một bên trắng hoặc lỗi kết nối.",
    cause: "tm-host-api gọi lệnh khởi động từ sai thư mục nên host thoát; app có khoảng trống giữa hai lượt boot.",
    fix: "Cổng trạng thái trước mỗi cặp ảnh: HTTP 200 + instance đã lên >= 10 giây, chờ tối đa ~30s.",
    after: "Mọi lượt đo sau đó đều có số liệu sức khoẻ hai bên (pid + tuổi instance) ghi trong summary.json.",
  },
  {
    title: "App chết UI vì thân phản hồi RPC bị String(Buffer) hoá (13:07–13:40)",
    found:
      "Mọi endpoint /api/* trả 200 nhưng thân phản hồi là DÃY SỐ THẬP PHÂN của từng byte (8 byte đầu = 3132332c33342c31 = '123,34,1'); " +
      "console có ERR_INVALID_HTTP_RESPONSE và 'Unexpected non-whitespace character after JSON'; UI hiện banner 'Failed to load plugins · 1 entry did not activate' " +
      "và hộp thoại 'Enter your Galaxy API key', không có sidebar/ô soạn tin.",
    cause: "Wrapper nén mới của tầng HTTP ép chunk không phải Buffer qua String(), mà tầng trên ghi bằng Uint8Array.",
    fix: "tm-host-api thêm toBuffer() (ArrayBuffer view -> Buffer) ở cả res.write và res.end, kèm 3 test hồi quy.",
    after: "15/15 endpoint trả JSON hợp lệ, byte đầu 7b2274797065223a = '{\"type\":'; 4/4 chỉ dấu hợp lệ đạt. MỌI số liệu trong khoảng 13:07–13:40 bị loại bỏ.",
  },
  {
    title: "Màn Settings → Agent presets lệch 3.180 px vì rác trong HOME của app (13:43–13:56)",
    found:
      "Cụm lệch x=532..1096 y=656..832 (thẻ preset CUSTOM), x=552..624 y=675..688 ('Set as new task default: 自定义模式') và x=685..695 y=805..815 " +
      "(nút 'Let the agent help me create a preset' bị dịch) — app có thêm preset 'custom' mà oracle không có.",
    cause:
      "Phép thử plugin ngoài dsh-custom-mode để lại dòng 'agent-presets: default: custom' trong ~/.galaxy/blackhole/settings.yaml; DSH đổi tên thành " +
      "settings.yaml.imported (dấu vết trơ) nhưng trạng thái đã nạp vào profile nên thẻ preset rỗng vẫn hiện.",
    fix: "Lead xoá settings.yaml.imported; RPC pluginInventory/list còn 216 entry · 4 preset, không còn 'custom'.",
    after: "Đo lại riêng màn này: 0 px ngoài mask, không cần mask trạng thái cho mục CUSTOM.",
  },
]);

/**
 * Rút con số phần trăm đầu tiên trong một câu ghi chú, để ô bảng không bị dài.
 * Nhận: chuỗi ghi chú (có thể chứa phần trăm).
 * Trả: chuỗi phần trăm đầu tiên, hoặc chuỗi gốc nếu không có số nào.
 */
export function firstPercent(text: string): string {
  const match = text.match(/[0-9]+(?:\.[0-9]+)?%/u);
  return match === null ? text.slice(0, 40) : match[0];
}

/**
 * Dựng một dòng bảng cho một màn hình, kèm ảnh thu nhỏ và liên kết ảnh gốc.
 * Nhận: số thứ tự và bản ghi của màn hình.
 * Trả: chuỗi Markdown một dòng bảng (không có ký tự xuống dòng).
 */
function rowFor(index: number, record: ScenarioRecord, dominantHash: string): string {
  const shots =
    record.thumbFile === undefined
      ? "(không có ảnh)"
      : '<a href="' + relFromDocs(record.pairFile ?? record.refFile ?? "") + '"><img src="' +
        relFromDocs(record.thumbFile) + '" width="330" alt="' + record.title + '"></a><br>' +
        "[ref](" + relFromDocs(record.refFile ?? "") + ") · [ours](" + relFromDocs(record.oursFile ?? "") +
        ") · [diff](" + relFromDocs(record.diffFile ?? "") + ")";
  const diff =
    record.status === "SKIP"
      ? "—"
      : String(record.diffPixels) + " / " + String(record.totalPixels) + " px (" + percent(record.ratio) + ")<br>thô " +
        String(record.rawDiffPixels) + " px (" + percent(record.rawRatio) + ")";
  const note: string[] = [];
  if (record.status === "SKIP") note.push(record.skipReason ?? "không rõ lý do");
  if (record.note !== undefined) note.push(record.note);
  if (record.clusters.length > 0) {
    note.push("lệch ở: " + record.clusters.slice(0, 3).map((cluster) => cluster.label || "vùng không khớp phần tử nào").join(", "));
  }
  if (record.ours.fingerprint.hash !== "" && dominantHash !== "" && record.ours.fingerprint.hash !== dominantHash) {
    note.push("cây plugin lúc chụp KHÁC trạng thái chính của lượt (hash " + record.ours.fingerprint.hash + ")");
  }
  if (record.ref.dismissed > 0 || record.ours.dismissed > 0) {
    note.push("hộp thoại một lần: ref " + String(record.ref.dismissed) + " · ours " + String(record.ours.dismissed));
  }
  if (record.ref.symptoms.length > 0 || record.ours.symptoms.length > 0) {
    note.push("dấu hiệu bất thường: " + [...record.ref.symptoms, ...record.ours.symptoms].join(", "));
  }
  // Ghi số liệu màu trội trên vùng không mask (chỉ dấu phụ của cổng hợp lệ) cho gọn một dòng.
  const shares = [
    ...(record.validity.ours.notes ?? []).map((text) => "ours " + firstPercent(text)),
    ...(record.validity.ref.notes ?? []).map((text) => "ref " + firstPercent(text)),
  ];
  if (shares.length > 0) note.push("màu trội vùng không mask: " + shares.join(" · "));
  const validityCell =
    record.validity.ours.ok && record.validity.ref.ok
      ? "✅ cả hai bên"
      : "❌ " +
        [
          record.validity.ours.ok ? "" : "ours: " + record.validity.ours.reasons.join("; "),
          record.validity.ref.ok ? "" : "ref: " + record.validity.ref.reasons.join("; "),
        ]
          .filter((part) => part !== "")
          .join(" · ")
          .slice(0, 160);
  const readyCell = record.readySpec === "" || record.readySpec.startsWith("trang tĩnh")
    ? "trang tĩnh — chỉ cần tải xong"
    : record.readySpec + (record.ours.ready ? " ✅" : " ❌");
  return "| " + String(index) + " | **" + record.title + "**<br>" + code(record.feature) + " | " + shots + " | " + diff +
    " | " + maskCell(record.masks) + " | " + readyCell + " | " + validityCell + " | " + record.status + " | " +
    (note.join(" · ") || "—") + " |";
}

/**
 * Liệt kê các cụm pixel lệch còn lại ngoài mask như khác biệt thật, kèm toạ độ.
 * Nhận: danh sách bản ghi của lần chạy.
 * Trả: mảng chuỗi Markdown, mỗi phần tử mô tả một màn hình có lệch.
 */
export function describeRealDifferences(records: readonly ScenarioRecord[]): string[] {
  const blocks: string[] = [];
  for (const record of records) {
    const clusters = record.clusters.filter((cluster) => cluster.pixels >= 8);
    if (clusters.length === 0) continue;
    const lines = clusters.map(
      (cluster) =>
        "  - " + code("x=" + String(cluster.x) + ".." + String(cluster.x + cluster.w) + " y=" + String(cluster.y) +
          ".." + String(cluster.y + cluster.h)) + " · " + String(cluster.pixels) + " px · thành phần: " +
        (cluster.label === "" ? "(không khớp phần tử DOM nào — có thể là nền hoặc chữ nhỏ)" : cluster.label),
    );
    blocks.push(
      "**" + record.title + "** — " + String(record.diffPixels) + " px lệch ngoài mask (" + percent(record.ratio) +
        "), ảnh diff: [" + (record.diffFile ?? "") + "](" + relFromDocs(record.diffFile ?? "") + ")\n" + lines.join("\n"),
    );
  }
  return blocks;
}

/**
 * So nhật ký mạng hai bên cho các màn hình KHÔNG đạt, nêu rõ request nào chỉ một bên gọi,
 * request nào treo, và chênh lệch mã trạng thái — đúng thứ cần để chẩn đoán RPC.
 * Nhận: danh sách bản ghi của lần chạy.
 * Trả: mảng chuỗi Markdown mô tả từng màn hình có khác biệt mạng.
 */
export function describeNetwork(records: readonly ScenarioRecord[]): string[] {
  const blocks: string[] = [];
  for (const record of records) {
    if (record.status === "PASS" || record.ours.net.length === 0) continue;
    const key = (entry: { method: string; url: string }): string => entry.method + " " + entry.url;
    const refMap = new Map(record.ref.net.map((entry) => [key(entry), entry]));
    const oursMap = new Map(record.ours.net.map((entry) => [key(entry), entry]));
    const lines: string[] = [];
    for (const [entryKey, entry] of oursMap) {
      const other = refMap.get(entryKey);
      if (other === undefined) {
        lines.push("  - chỉ **ours** gọi: " + code(entryKey) + " → " + String(entry.status) + " trong " + String(entry.ms) + "ms");
      } else if (other.status !== entry.status) {
        lines.push(
          "  - lệch mã trạng thái: " + code(entryKey) + " → ref " + String(other.status) + " / ours " + String(entry.status),
        );
      }
    }
    for (const [entryKey] of refMap) {
      if (!oursMap.has(entryKey)) {
        lines.push("  - chỉ **ref** gọi: " + code(entryKey) + " → " + String(refMap.get(entryKey)?.status));
      }
    }
    for (const entry of [...record.ours.pending, ...record.ref.pending]) {
      lines.push("  - TREO (không có phản hồi khi chụp): " + code(entry.method + " " + entry.url));
    }
    if (lines.length === 0) continue;
    blocks.push(
      "**" + record.title + "** (verdict " + record.status + ") — " + String(record.ours.net.length) + " request phía ours, " +
        String(record.ref.net.length) + " phía ref:\n" + lines.join("\n"),
    );
  }
  return blocks;
}

/**
 * Sinh nội dung Markdown của ma trận ảnh A/B.
 * Nhận: artifact của lần chạy.
 * Trả: chuỗi Markdown đầy đủ để ghi ra docs/UI-PARITY.md (kèm mục "Phần tử lạ so với ref" khi có).
 */
export function renderUiParityMarkdown(artifact: FeatureArtifact): string {
  const measured = artifact.scenarios.filter((record) => record.status !== "SKIP");
  const skipped = artifact.scenarios.filter((record) => record.status === "SKIP");
  const realDiffs = describeRealDifferences(measured);
  const structure: string[] = [];
  for (const record of measured) {
    if (record.onlyInRef.length === 0 && record.onlyInOurs.length === 0) continue;
    structure.push(
      "- **" + record.title + "** — chỉ có ở ref: " + (record.onlyInRef.join(", ") || "—") + " · chỉ có ở ours: " +
        (record.onlyInOurs.join(", ") || "—"),
    );
  }
  // Phần tử LẠ: so theo khoá tag|role|aria|testid (bỏ chữ nội dung). Đây là lớp bắt lỗi
  // "component render ra phần tử sai chỗ" mà cổng phía server không thấy — ca thật đã xảy ra:
  // toast placeholder luôn hiện (aria-label "Could not save preference") ⇒ 388 px lệch.
  const strayRows: string[] = [];
  for (const record of measured) {
    if (record.stray.ours.length === 0 && record.stray.ref.length === 0) continue;
    const describe = (item: StrayElement): string =>
      item.key + " @ " + String(item.x) + "," + String(item.y) + " " + String(item.w) + "x" + String(item.h);
    strayRows.push(
      "- **" + record.title + "** — chỉ có ở ours: " + (record.stray.ours.map(describe).join(" · ") || "—") +
        " · chỉ có ở ref: " + (record.stray.ref.map(describe).join(" · ") || "—"),
    );
  }
  const maskCatalog = new Map<string, MaskRegion>();
  for (const record of artifact.scenarios) for (const mask of record.masks) maskCatalog.set(mask.name, mask);
  const lines: string[] = [];
  lines.push("<!--");
  lines.push(" author Bùi Trọng Hiếu");
  lines.push(" email kevinbui210191@gmail.com");
  lines.push(" create date 15/10/2026");
  lines.push(" modify date 17/10/2026");
  lines.push(" desc Ma trận ảnh A/B theo từng màn hình UI: app 5439 so với blackhole web 4001, kèm số đo pixel");
  lines.push("-->");
  lines.push("");
  lines.push("# UI-PARITY — ma trận ảnh A/B theo từng màn hình");
  lines.push("");
  lines.push(
    "Lần chạy: **" + artifact.stamp + "** · " + String(artifact.totals.pass) + " PASS · " + String(artifact.totals.fail) +
      " FAIL · " + String(artifact.totals.skip) + " SKIP · tổng " + String(artifact.totals.diffPixels) +
      " pixel lệch ngoài mask trên " + String(artifact.totals.frames) + " khung.",
  );
  lines.push("");
  lines.push("**Cổng trạng thái (parity:health) đầu/cuối lượt:** " + (artifact.health?.verdict ?? "(không có dữ liệu)") + ".");
  lines.push("");
  lines.push("**Dấu vân tay cây plugin của lượt đo:** " + (artifact.fingerprint?.verdict ?? "(không có dữ liệu)") + ".");
  lines.push("");
  lines.push("| Bên | Là gì | Ở đâu |");
  lines.push("|---|---|---|");
  lines.push("| " + code("ours") + " | " + artifact.sides.ours + " | http://127.0.0.1:" + String(artifact.sides.oursPort) + "/ |");
  lines.push("| " + code("ref") + " | " + artifact.sides.ref + " | http://127.0.0.1:" + String(artifact.sides.refPort) + "/ |");
  lines.push("");
  lines.push(
    "Ảnh gốc và số liệu máy đọc nằm ở " + code(artifact.shotsDir + "/") + " (" +
      [code("summary.json"), code("ref-*.png"), code("ours-*.png"), code("diff-*.png"), code("pair-*.png"), code("inventory-*.json")].join(", ") +
      ").",
  );
  lines.push("");
  lines.push("## 0. Cách đo (đọc trước khi tin số)");
  lines.push("");
  lines.push("- Công cụ: " + code("tools/features/run.ts") + " — Playwright + **Google Chrome có sẵn** (channel " + code("chrome") + "), khung nhìn **" + artifact.viewport.name + "**, cùng thao tác cho cả hai bên.");
  lines.push("- **Mỗi kịch bản chạy bằng một profile Chrome MỚI** dưới thư mục tạm (" + code(".parity/tmp/gbh-features-*") + ") và **luôn đóng trong " + code("finally") + "** → không rò localStorage giữa các lần đo, không để lại tiến trình Chrome.");
  lines.push("- Xác thực: cookie phiên **mint trong bộ nhớ** từ " + code("~/.galaxy/credentials.yaml") + " (như " + code("tools/parity/lib/browser.ts") + "). Giá trị cookie/secret **không** được in ra log hay ghi vào artifact.");
  lines.push("- Cổng trạng thái trước mỗi cặp ảnh: HTTP 200 **và** instance đã lên ≥ 10 giây; chờ tối đa ~30s rồi mới bỏ. Cửa sổ restart **không bao giờ** bị ghi thành khác biệt giao diện.");
  lines.push("- Hộp thoại một lần (Preview Notice / Get started / API key) được đóng ở **cả hai bên** trước khi chụp để so giao diện; số lần đóng ghi trong cột ghi chú.");
  lines.push("- Ngưỡng đạt: **≤ " + (artifact.threshold * 100).toFixed(1) + "%** số pixel lệch **ngoài vùng mask** (docs/ARCHITECTURE §5.2, quyết định D9). Cột px lệch ghi cả số **thô** (không mask) để đối chiếu.");
  lines.push(
    "- **Cổng hợp lệ** (bắt buộc trước khi tính điểm, điều kiện QUYẾT ĐỊNH là DOM): (1) có sidebar với New Session + Plugins; " +
      "(2) có ô soạn tin — và ô tìm kiếm của màn đang đo; (3) DOM KHÔNG chứa 'Failed to load plugins' / 'did not activate' / " +
      "'Enter your Galaxy API key'. Tỉ lệ một màu trên **vùng không mask** chỉ là chỉ dấu PHỤ: nếu DOM thiếu anchor VÀ vùng đó " +
      "quá " + (0.95 * 100).toFixed(0) + "% một màu thì mới kết luận màn trắng/màn lỗi; nếu DOM đủ anchor thì khung nhiều màu trắng " +
      "vẫn hợp lệ (màn chào DSH vốn gần như trắng). Không hợp lệ thì ghi **KHÔNG HỢP LỆ (SKIP)** kèm lý do — không bao giờ tính thành PASS/FAIL.",
  );
  lines.push(
    "- Ghi chú hợp lệ của từng màn (ví dụ khung phần lớn một màu) nằm trong ô ghi chú của bảng và trong " +
      code("summary.json") + " (trường " + code("validity") + ").",
  );
  lines.push("- **Dấu vân tay trạng thái cây plugin**: mỗi màn ghi lại " + code("rev") + " + số " + code("entries") +
    " + " + code("batches") + " + hash danh sách entry đọc từ " + code("__DSH_BOOT__") + " ngay lúc chụp. Lượt nào đổi cây" +
    " giữa chừng bị đánh dấu **NGHI NHIỄM**; không trích số liệu của lượt không có dấu vân tay.");
  lines.push("- **Chống 'FAIL giả'**: mỗi màn ghi lại dấu vân tay cây plugin (" + code("rev") + " + số " + code("entries") + " + hash), toạ độ y của tiêu đề đầu tiên, và " + code("scrollTop") + " của mọi vùng cuộn — trước khi chụp, rig **đưa mọi vùng cuộn về 0** để một cú focus không làm lệch cả khung (đã từng gây lệch 28 px). Đầu và cuối lượt rig gọi " + code("parity:health") + " và lưu vào " + code("health.json") + ".");
  lines.push("- **Bài học bắt buộc**: mọi phép thử có ghi vào HOME của app (settings.yaml, .agent-presets, storages, sessions) phải **snapshot + khôi phục CẢ state trong HOME**, không chỉ profile — nếu không, lượt đo sau sẽ bắt được rác thành 'khác biệt thật' (đã xảy ra 1 lần, xem §3.1).");
  lines.push("- Ảnh trong bảng: bấm vào ảnh để mở cặp A/B (trái = ref 4001, phải = app 5439).");
  lines.push("");
  lines.push("## 1. Ma trận");
  lines.push("");
  const sheet = artifact.shotsDir + "/contact-sheet.png";
  if (existsSync(resolve(repoPath(sheet)))) {
    lines.push("**Bảng tiếp xúc một ảnh — mở là thấy ngay toàn bộ mức giống nhau** (bấm để mở ảnh lớn):");
    lines.push("");
    lines.push("[" + relFromDocs(sheet) + "](" + relFromDocs(sheet) + ")");
    lines.push("");
    lines.push("![Bảng tiếp xúc toàn bộ màn hình](" + relFromDocs(sheet) + ")");
    lines.push("");
  }
  lines.push(
    "| # | Màn hình · tính năng | Ảnh A/B (trái = ref · phải = ours) | px lệch ngoài mask | mask đã bỏ | điều kiện sẵn sàng | cổng hợp lệ | verdict | ghi chú |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|");
  const dominantHash = artifact.fingerprint?.states[0]?.hash ?? "";
  artifact.scenarios.forEach((record, index) => lines.push(rowFor(index + 1, record, dominantHash)));
  lines.push("");
  lines.push("## 2. Vùng mask đã áp và lý do");
  lines.push("");
  lines.push("Ở cặp **ours vs ref** này **không mask vùng brand**: cả hai bên đều là bản brand Galaxy Blackhole nên phần brand phải trùng nhau; mask brand chỉ cần cho cặp ours-vs-stock của " + code("tools/parity") + ". Nhờ vậy mọi lệch brand (nếu có) đều hiện ra thành cụm lệch thật.");
  lines.push("");
  lines.push("| Vùng | Nhóm | Vì sao bỏ qua |");
  lines.push("|---|---|---|");
  for (const mask of maskCatalog.values()) lines.push("| " + code(mask.name) + " | " + mask.kind + " | " + mask.reason + " |");
  lines.push("");
  lines.push("## 3. Khác biệt THẬT phát hiện được (ngoài mask)");
  lines.push("");
  lines.push("### 3.1 Sự cố đã bắt được và ĐÃ SỬA (bằng chứng giàn đo hoạt động đúng)");
  lines.push("");
  INCIDENTS.forEach((incident, index) => {
    lines.push(String(index + 1) + ". **" + incident.title + "**");
    lines.push("   - Hiện tượng: " + incident.found);
    lines.push("   - Gốc rễ: " + incident.cause);
    lines.push("   - Cách sửa: " + incident.fix);
    lines.push("   - Sau khi sửa: " + incident.after);
  });
  lines.push("");
  lines.push("### 3.2 Cụm pixel lệch còn lại của lượt này");
  lines.push("");
  if (realDiffs.length === 0) {
    lines.push("Không có màn hình nào còn cụm pixel lệch ≥ 8 px ngoài vùng mask trạng thái.");
  } else {
    for (const block of realDiffs) {
      lines.push(block);
      lines.push("");
    }
  }
  lines.push("");
  lines.push("## 4. Màn hình KHÔNG chụp được và lý do");
  lines.push("");
  if (skipped.length === 0) {
    lines.push("Không có màn hình nào bị bỏ.");
  } else {
    for (const record of skipped) lines.push("- **" + record.title + "** — " + (record.skipReason ?? "không rõ lý do"));
  }
  lines.push("");
  lines.push("## 5. Khác biệt cấu trúc DOM (nhãn phần tử chỉ có một bên)");
  lines.push("");
  lines.push("So tập nhãn aria-label/chữ của mọi phần tử tương tác đọc được ở hai bên. Khác biệt ở đây thường là **trạng thái** (tên workspace, session cũ) chứ không phải thiếu thành phần giao diện.");
  lines.push("");
  if (structure.length === 0) lines.push("- Không có khác biệt nhãn nào giữa hai bên.");
  else lines.push(...structure);
  lines.push("");
  lines.push("### 5.1 Phần tử LẠ (có aria-label/role/data-testid ở một bên mà bên kia KHÔNG có)");
  lines.push("");
  lines.push(
    "Chỉ số này KHÔNG phụ thuộc pixel và KHÔNG phụ thuộc chữ nội dung: nó bắt lớp lỗi 'component render ra " +
      "phần tử sai chỗ' mà cổng phía server không thấy. Đã kiểm chứng trên dữ liệu cũ: luật này bắt đúng toast " +
      "placeholder `button|switch|Could not save preference @ 0,0 36x20` (ca 388 px ngày 17/10/2026).",
  );
  lines.push("");
  if (strayRows.length === 0) lines.push("- Không có phần tử lạ nào ở cả hai bên (0/0).");
  else lines.push(...strayRows);
  lines.push("");
  lines.push("## 6. Nhật ký mạng hai bên (bằng chứng chẩn đoán)");
  lines.push("");
  lines.push(
    "Mỗi màn hình đều có file " + code("net-<id>.json") + " trong thư mục ảnh, ghi mọi request **không phải asset tĩnh** " +
      "(document/xhr/fetch/websocket) kèm method, URL, mã trạng thái, thời gian và số byte. Giá trị token/khoá bí mật " +
      "trong URL đã bị thay bằng ba dấu sao.",
  );
  lines.push("");
  const netBlocks = describeNetwork(artifact.scenarios);
  if (netBlocks.length === 0) lines.push("Không có màn hình nào cần đối chiếu mạng (mọi màn hình đều PASS).");
  else lines.push(...netBlocks);
  lines.push("");
  lines.push("## 7. Lịch sử đo: cửa sổ KHÔNG HỢP LỆ 13:07–13:40 ngày 17/10/2026");
  lines.push("");
  lines.push("- **Triệu chứng**: app 5439 hiện banner " + code("Failed to load plugins · web boot: 1 entry did not activate") + " và hộp thoại " + code("Enter your Galaxy API key") + "; không có sidebar, không có ô soạn tin.");
  lines.push("- **Nguyên nhân (đã chứng minh)**: tầng HTTP mới của app trả thân phản hồi là **dãy số thập phân của từng byte** khi client xin " + code("Accept-Encoding: gzip") + " (Buffer bị đưa qua " + code("String()") + "). Bằng chứng: 8 byte đầu của mọi phản hồi /api/* là " + code("3132332c33342c31") + " = chuỗi " + code("123,34,1") + ", và khi giải mã dãy số đó rồi gunzip thì JSON hợp lệ.");
  lines.push("- **Bằng chứng lưu tại**: " + code(".parity/features/2026-10-17T06-27-23/key-dialog-compare/") + " (ảnh modal che kín màn hình), " + code(".parity/features/2026-10-17T06-22-10/boot-graph-compare.json") + " (ref 0 lỗi console · ours 6 lỗi), " + code("net-<màn>.json") + " của các màn trong cửa sổ đó.");
  lines.push("- **Hệ quả**: MỌI số liệu ảnh đo trong khoảng 13:07–13:40 đều **KHÔNG HỢP LỆ**, kể cả những lượt ra 0 px — khi hai bên cùng trắng/cùng lỗi thì 0 px là vô nghĩa. Các lượt đó chỉ được giữ làm bằng chứng.");
  lines.push("- **Khắc phục**: bản vá " + code("toBuffer()") + " (giữ đúng byte cho Uint8Array) nạp lúc 13:28; bảng ở mục 1 là bộ số liệu hợp lệ đầu tiên sau khi app lành.");
  lines.push("- Rà lại một lượt đã lưu bằng cổng hợp lệ: " + code("bun run tools/features/audit.ts <thư-mục-lần-chạy>") + " → ghi " + code("validity-audit.json") + ".");
  lines.push("");
  lines.push("## 8. Tổng hợp");
  lines.push("");
  lines.push("| Hạng mục | Số |");
  lines.push("|---|---|");
  lines.push("| Màn hình đã đo | " + String(measured.length) + " |");
  lines.push("| Đạt ngưỡng (PASS) | " + String(artifact.totals.pass) + " |");
  lines.push("| Vượt ngưỡng (FAIL) | " + String(artifact.totals.fail) + " |");
  lines.push("| Không chụp được (SKIP) | " + String(artifact.totals.skip) + " |");
  lines.push("| Tổng pixel lệch ngoài mask | " + String(artifact.totals.diffPixels) + " |");
  lines.push("");
  lines.push("Ghi chú vận hành:");
  for (const note of artifact.notes) lines.push("- " + note);
  lines.push("");
  lines.push("Chạy lại: " + code("bun run tools/features/run.ts") + " (thêm " + code("--ids <id,id>") + " để chạy một vài màn hình, " + code("--strict") + " để đỏ khi có FAIL).");
  lines.push("");
  return lines.join("\n");
}

/**
 * Ghi tài liệu ma trận ảnh ra docs/UI-PARITY.md.
 * Nhận: artifact của lần chạy và đường dẫn đích (mặc định docs/UI-PARITY.md).
 * Trả: nội dung Markdown đã ghi.
 */
export function renderUiParityDoc(artifact: FeatureArtifact, docPath = repoPath(DOC_PATH)): string {
  const markdown = renderUiParityMarkdown(artifact);
  writeFileSync(resolve(docPath), markdown);
  return markdown;
}

/**
 * Điểm vào dòng lệnh: dựng lại docs/UI-PARITY.md từ một summary.json đã có (không chụp lại ảnh).
 * Nhận: tham số dòng lệnh — đường dẫn summary.json, kèm các cặp --note "<ghi chú>" để thêm vào mục ghi chú vận hành.
 * Trả: mã thoát 0 khi ghi xong.
 */
export function main(argv: string[]): number {
  const file = argv.find((arg) => !arg.startsWith("--")) ?? repoPath(".parity/features/latest.json");
  const artifact = JSON.parse(readFileSync(file, "utf8")) as FeatureArtifact;
  const notes = argv.reduce<string[]>((acc, arg, index) => {
    if (arg === "--note") {
      const value = argv[index + 1];
      if (value !== undefined) acc.push(value);
    }
    return acc;
  }, []);
  artifact.notes = [...artifact.notes, ...notes];
  renderUiParityDoc(artifact);
  console.log("[features] đã ghi " + DOC_PATH + " từ " + file + " (" + String(artifact.scenarios.length) + " màn)");
  return 0;
}

if (import.meta.main) {
  // Chỉ chạy khi gọi trực tiếp file này; run.ts import hàm và tự gọi renderUiParityDoc.
  process.exit(main(process.argv.slice(2)));
}
