/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Script đồng bộ artefact NGUYÊN VĂN từ @galaxy-blackhole/gbh-skill-badge (index + lib/types/*.js + locale/** +
 *      assets/**) sang gói ta, in bytes/delta/equal/sha và đối chiếu provenance.
 *      10/11/2026: id skill đổi dsh-badge -> gbh-badge theo quy ước gbh-* của repo. Vì vậy tệp asset đích mang
 *      tên GBH (TEN_TEP_TA), chú thích trong .d.ts được đổi tên khi chép (THAY_CHUOI), còn hai tệp ta đã CỐ Ý
 *      viết lại nội dung (lib/index.js: câu mô tả ADR 0022 + id skill; assets/gbh-badge.md: quy ước chèn) thì
 *      KHÔNG bị ghi đè (KHONG_GHI_DE) — chép đè sẽ xoá đúng thứ đã khai ở docs/GBH-SAI-KHAC-CO-CHU-DICH.md §1.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** Gốc repo (tệp nằm ở packages/host/skill-badge/src). */
const REPO = join(import.meta.dir, "..", "..", "..", "..");
/** Thư mục nguồn CHỈ ĐỌC của gói stock. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-skill-badge");
/** Thư mục đích trong gói ta. */
const OURS = join(import.meta.dir, "..");

/**
 * Bảng đổi TÊN TỆP stock -> tên tệp của ta (10/11/2026).
 * Vì sao: id skill là gbh-badge nên tệp asset phải mang đúng tên GBH; BYTE vẫn nguyên văn stock.
 * Nhận: không. Trả: bảng đường dẫn tương đối (stock) -> đường dẫn tương đối (ta).
 */
const TEN_TEP_TA: Readonly<Record<string, string>> = {
  "assets/dsh-badge.md": "assets/gbh-badge.md",
  "assets/dsh-badge.png": "assets/gbh-badge.png",
};

/**
 * Bảng đổi CHUỖI chỉ áp cho tệp không có hành vi (chú thích .d.ts) — 10/11/2026.
 * Vì sao: chú thích bản stock nhắc tên skill cũ; đổi lúc chép để bản cài không còn nhắc dsh-badge, mà phần
 * còn lại của tệp vẫn đi theo stock từng byte.
 * Nhận: không. Trả: bảng đường dẫn tương đối -> các cặp [chuỗi stock, chuỗi của ta].
 */
const THAY_CHUOI: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  "lib/types/index.d.ts": [["dsh-badge", "gbh-badge"]],
  // 10/11/2026 — hai tệp locale mang thương hiệu GBH (khai ở docs §1 + ADR 0022): chép nguyên văn sẽ
  // trả chúng về chữ DSH (đã xảy ra một lần trong lượt 10/11 khi chạy sync trước khi khai bảng này).
  "locale/en.json": [["DSH", "GBH"]],
  "locale/zh.json": [["DSH", "GBH"]],
};

/**
 * Tệp ta ĐÃ CỐ Ý viết nội dung khác stock nên đồng bộ NGUYÊN VĂN sẽ phá (10/11/2026).
 * Vì sao: lib/index.js mang câu mô tả theo ADR 0022 và id skill gbh-badge; assets/gbh-badge.md là quy ước
 * chèn mới của ta. Chép đè là xoá cả hai — đúng thứ docs/GBH-SAI-KHAC-CO-CHU-DICH.md §1 cấm làm.
 * Nhận: không. Trả: danh sách đường dẫn tương đối của TA được giữ nguyên.
 */
const KHONG_GHI_DE: readonly string[] = ["lib/index.js", "assets/gbh-badge.md"];

/** Một dòng báo cáo đồng bộ. */
export interface SyncRow { readonly file: string; readonly bytes: number; readonly delta: number; readonly equal: boolean; readonly sha: string }

/** Tính sha256 của buffer. */
function sha(buf: Buffer): string { return createHash("sha256").update(buf).digest("hex"); }

/** Liệt kê mọi tệp dưới một thư mục con của stock (đệ quy, đường dẫn tương đối). */
function filesUnder(sub: string): string[] {
  const root = join(STOCK, sub);
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(join(sub, relative(root, full)));
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Áp bảng đổi chuỗi đã khai cho một tệp (không khai thì trả nguyên văn).
 * Nhận: rel — đường dẫn tương đối phía stock; text — nội dung stock.
 * Trả: nội dung sẽ ghi vào gói ta.
 */
function doiChuoi(rel: string, text: string): string {
  const bang = THAY_CHUOI[rel];
  if (bang === undefined) return text;
  return bang.reduce((tich: string, cap: readonly [string, string]) => tich.split(cap[0]).join(cap[1]), text);
}

/**
 * Chép NGUYÊN VĂN index + types + locale + assets từ stock sang gói ta rồi so từng byte.
 * Tệp trong KHONG_GHI_DE mà bản của ta đã khác stock thì GIỮ bản của ta và báo equal=false.
 * Nhận: không. Trả: danh sách SyncRow — ném khi lệch byte hoặc provenance.sha không khớp.
 */
export function syncArtifacts(): SyncRow[] {
  const out: SyncRow[] = [];
  for (const rel of ["lib/index.js", ...filesUnder("lib/types"), ...filesUnder("locale"), ...filesUnder("assets")]) {
    const from = join(STOCK, rel);
    const relTa = TEN_TEP_TA[rel] ?? rel;
    const to = join(OURS, relTa);
    mkdirSync(dirname(to), { recursive: true });
    const stock = readFileSync(from);
    // Tệp ta ĐÃ CỐ Ý SỬA: giữ bản của ta, chỉ ghi nhận để người chạy thấy rõ (không tự xoá sai khác).
    if (KHONG_GHI_DE.includes(relTa) && existsSync(to)) {
      const ours = readFileSync(to);
      if (!ours.equals(stock)) {
        out.push({ file: relTa, bytes: ours.length, delta: ours.length - stock.length, equal: false, sha: sha(ours) });
        continue;
      }
    }
    const text = doiChuoi(rel, stock.toString("utf8"));
    if (text === stock.toString("utf8")) copyFileSync(from, to);
    else writeFileSync(to, text);
    const b = readFileSync(to);
    if (b.toString("utf8") !== text) throw new Error("lệch byte sau khi chép: " + relTa);
    out.push({ file: relTa, bytes: b.length, delta: b.length - stock.length, equal: b.equals(stock), sha: sha(b) });
  }
  const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh?: { provenance?: { sha?: string } } };
  if (manifest.gbh?.provenance?.sha !== sha(readFileSync(join(STOCK, "lib/index.js")))) throw new Error("provenance.sha KHÔNG khớp stock");
  return out;
}

if (import.meta.main) {
  const rows = syncArtifacts();
  for (const row of rows) {
    console.log(row.bytes + " B  delta " + String(row.delta) + "  " + row.sha.slice(0, 8) + "  " + row.file + (row.equal ? "" : "  (khác stock — đã khai ở GBH-SAI-KHAC-CO-CHU-DICH.md §1)"));
  }
  console.log("OK " + String(rows.length) + " tệp · provenance sha khớp stock");
}
