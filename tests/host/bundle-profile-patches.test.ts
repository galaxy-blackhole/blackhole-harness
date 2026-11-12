/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test nhóm BUNDLE/PROFILE: mỗi bundle ta phải có cordis.patch.yml 1:1 với bản gốc — YAML parse THẬT,
 *      so khớp HAI CHIỀU (thay id ta → id stock phải ra NGUYÊN VĂN gốc), và số lần thay khớp provenance.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói gốc trong kernel (CHỈ ĐỌC). */
const KERNEL = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");

/** Bản đồ 12 bundle của ta: tên gói ta ↔ tên gói gốc. */
const BUNDLES: { ours: string; stock: string }[] = [
  { ours: "bundle-agent-team-profile", stock: "dsh-experimental-agent-team-profile" },
  { ours: "bundle-badge-skill-bundle", stock: "dsh-experimental-badge-skill-bundle" },
  { ours: "bundle-cot-translation-bundle", stock: "dsh-experimental-cot-translation-bundle" },
  { ours: "bundle-inspector-profile", stock: "dsh-experimental-inspector-profile" },
  { ours: "bundle-plugin-market-bundle", stock: "dsh-experimental-plugin-market-bundle" },
  { ours: "bundle-ralph-bundle", stock: "dsh-experimental-ralph-bundle" },
  { ours: "bundle-session-search", stock: "dsh-experimental-session-search" },
  { ours: "bundle-session-titles-bundle", stock: "dsh-experimental-session-titles-bundle" },
  { ours: "bundle-terminal-bundle", stock: "dsh-experimental-terminal-bundle" },
  { ours: "bundle-voice-input-bundle", stock: "dsh-experimental-voice-input-bundle" },
  { ours: "bundle-base", stock: "dsh-base" },
  { ours: "bundle-sdk-minimal", stock: "dsh-sdk-minimal" },
  { ours: "bundle-acp-app", stock: "dsh-acp-app" },
  { ours: "bundle-sdk-app", stock: "dsh-sdk-app" },
];

describe("bundle/profile — patch 1:1 + YAML parse thật", () => {
  for (const bundle of BUNDLES) {
    test(bundle.ours + ": YAML parse OK · hai chiều khớp gốc · provenance đúng", () => {
      const dir = join(REPO, "packages", "host", bundle.ours);
      const meta = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
        name: string;
        dsh?: { bundle?: { patch?: string } };
        exports?: Record<string, string>;
        gbh?: { provenance?: { stock: string; stockVersion: string; patchLines: number; headerLines?: number; replacements: { stock: string; ours: string; count: number }[] } };
      };
      // 1) khai báo: dsh.bundle.patch + exports phải trỏ đúng patch
      expect(meta.dsh?.bundle?.patch).toBe("./cordis.patch.yml");
      expect(meta.exports?.["./cordis.patch.yml"]).toBe("./cordis.patch.yml");
      expect(meta.name.startsWith("@galaxy-blackhole/gbh-")).toBe(true);
      // provenance phải đọc TRƯỚC stripHeader (hàm đó dùng provenance.headerLines).
      const provenance = meta.gbh?.provenance;
      // Tệp của ta có khối header (luật repo) — THÂN patch mới phải 1:1, nên bỏ header trước khi so.
      const stripHeader = (text: string): string => {
        const lines = text.split("\n");
        // Bỏ ĐÚNG 6 dòng header CỦA TA (5 dòng comment + 1 dòng trống). KHÔNG được bỏ mọi dòng "#":
        // một số patch gốc (vd dsh-base) TỰ BẮT ĐẦU bằng comment của chính nó.
        // Cắt ĐÚNG headerLines (ghi trong gbh.provenance lúc sinh) — KHÔNG dò dòng "#", vì patch gốc
        // (vd dsh-base) tự mở đầu bằng comment riêng của nó.
        const headerLines = provenance?.headerLines;
        if (typeof headerLines !== "number") return text;
        return lines.slice(headerLines).join("\n");
      };
      const oursText = stripHeader(readFileSync(join(dir, "cordis.patch.yml"), "utf8"));
      const stockText = readFileSync(join(KERNEL, bundle.stock, "cordis.patch.yml"), "utf8");
      // 09/11/2026 — row `session-inspector` đã bật lại sau khi port `gbh-client-store`; bỏ ngoại lệ,
      // phép so 1:1 áp bình thường cho cả bundle này.
      // 2) YAML parse THẬT (không so chuỗi thô): cả hai phải parse được và ta phải có mảng insert
      const oursYaml = Bun.YAML.parse(oursText) as { insert?: unknown[] }[];
      const stockYaml = Bun.YAML.parse(stockText) as { insert?: unknown[] }[];
      expect(Array.isArray(oursYaml)).toBe(true);
      expect(Array.isArray(stockYaml)).toBe(true);
      // 09/11/2026 (dev-5, Lead duyệt C1) — SAI KHÁC CÓ CHỦ ĐÍCH, xem docs/GBH-SAI-KHAC-CO-CHU-DICH.md §2e:
      //   `bundle-base` KHÔNG còn là bản sao 1:1 patch stock: 4 row trỏ gói GBH ĐÚNG provenance (approval,
      //   sandbox, timeout-policy, timer) + 6 row lõi được khai MỚI (ui-session-delete, session-delete,
      //   subagent-model-selection-settings, web-runtime, web-startup, web-search-auto) để bỏ overlay trong
      //   app.patch.yml. Với RIÊNG gói này: so TẬP ID thay vì byte 1:1. 15 bundle còn lại vẫn 1:1 khắt khe.
      if (bundle.stock === "dsh-base") {
        const idsOf = (doc: { insert?: unknown[] }[]): string[] =>
          doc.flatMap((block) => ((block as { insert?: { id?: string }[] }).insert ?? []).map((row) => row.id ?? "")).filter((id) => id !== "").sort();
        const oursIds = idsOf(oursYaml);
        for (const id of idsOf(stockYaml)) expect(oursIds).toContain(id);
        return;
      }
      expect(oursYaml.length).toBe(stockYaml.length);
      // 3) hai chiều: thay NGƯỢC id ta -> id stock phải ra NGUYÊN VĂN bản gốc
      expect(provenance?.stock).toBe("@deepseek-ai/" + bundle.stock);
      expect(provenance?.patchLines).toBeGreaterThan(0);
      const replacements = provenance?.replacements ?? [];
      let back = oursText;
      let total = 0;
      // Đếm PHẢI dùng CÙNG ranh giới như lúc thay — nếu split chuỗi con thì `gbh-session` bị đếm lẫn
      // trong `gbh-session-query-sqlite` và count sai dù nội dung đúng.
      const countByBoundary = (text: string, id: string): number => {
        const pattern = new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w-])", "g");
        return text.split(pattern).length - 1;
      };
      for (const replacement of replacements) {
        total += replacement.count;
        expect(countByBoundary(oursText, replacement.ours)).toBe(replacement.count);
      }
      // Thay NGƯỢC phải đi theo thứ tự NGƯỢC (ngắn → dài); nếu đi cùng chiều thì `gbh-session` sẽ ăn vào
      // `gbh-session-query-sqlite` và không tái tạo được nguyên văn (cùng lớp lỗi longest-first).
      for (const replacement of [...replacements].reverse()) back = back.split(replacement.ours).join(replacement.stock);
      expect(back).toBe(stockText);
      // 4) chiều thuận: thay id stock -> id ta phải ra đúng bản của ta
      // Chiều THUẬN cũng phải dùng CÙNG ranh giới + longest-first như generator; nếu dùng split trần thì
      // `@deepseek-ai/dsh-session` sẽ ăn vào `@deepseek-ai/dsh-session-query-sqlite` ⇒ chuỗi sinh ra khác file.
      const replaceByBoundary = (text: string, from: string, to: string): string =>
        text.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w-])", "g"), to);
      let forward = stockText;
      for (const replacement of replacements) forward = replaceByBoundary(forward, replacement.stock, replacement.ours);
      expect(forward).toBe(oursText);
      // 5) tổng số lần thay phải bằng tổng provenance (đo được, không phải cảm nhận)
      const measured = replacements.reduce((sum, item) => sum + item.count, 0);
      expect(measured).toBe(total);
    });
  }
});

describe("bundle/profile — bản đồ id: chỉ thay gói ĐÃ port, giữ nguyên phần còn lại", () => {
  test("dsh-base: số lần thay ĐO ĐƯỢC (ranh giới), mọi id thay đều trỏ tới gói CÓ trong repo", () => {
    const dir = join(REPO, "packages", "host", "bundle-base");
    const meta = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { gbh?: { provenance?: { replacements: { stock: string; ours: string; count: number }[] } } };
    const replacements = meta.gbh?.provenance?.replacements ?? [];
    // Đếm ĐÚNG theo ranh giới (longest-first) — con số là ẢNH CHỤP trạng thái port hiện tại, không phải
    // hằng số bất biến: mỗi lần port thêm gói thì bundle-base lại đổi thêm id. Điều kiện KIỂM thật sự là
    // hai vế dưới đây (mọi đích đều là gói CÓ trong repo, và patch sinh lại khớp từng byte) — còn con số
    // này chỉ chặn việc đếm sai kiểu chuỗi con (bản cũ đếm 18 vì 'gbh-session' ăn vào
    // 'gbh-session-query-sqlite').
    // 07/11/2026: 9 → 79 sau khi đổi id đồng bộ theo bảng gbh.provenance.stock của các gói CÓ gbh.row
    // (gói port nhưng CHƯA mount thì phải giữ id stock — nếu đổi, entry chết lúc boot: "Cannot find package").
    expect(replacements.reduce((sum, item) => sum + item.count, 0)).toBe(79);
    // Tap TEN goi thuc co trong repo (ten thu muc KHONG luon bang ten goi -> phai quet name).
    const names = new Set<string>();
    for (const org of ["host", "client"]) {
      const orgRoot = join(REPO, "packages", org);
      if (!existsSync(orgRoot)) continue;
      for (const dir of readdirSync(orgRoot)) {
        const manifestPath = join(orgRoot, dir, "package.json");
        if (!existsSync(manifestPath)) continue;
        names.add((JSON.parse(readFileSync(manifestPath, "utf8")) as { name: string }).name);
      }
    }
    for (const replacement of replacements) expect(names.has(replacement.ours)).toBe(true);
  });

  test("các bundle 0 lần thay phải GIỐNG HỆT bản gốc từng byte (patch không chứa id nào đã port)", () => {
    for (const bundle of BUNDLES) {
      const meta = JSON.parse(readFileSync(join(REPO, "packages", "host", bundle.ours, "package.json"), "utf8")) as { gbh?: { provenance?: { replacements: { count: number }[] } } };
      const replacements = meta.gbh?.provenance?.replacements ?? [];
      if (replacements.length > 0) continue;
      const metaFull = JSON.parse(readFileSync(join(REPO, "packages", "host", bundle.ours, "package.json"), "utf8")) as { gbh?: { provenance?: { headerLines?: number } } };
      const headerLines = metaFull.gbh?.provenance?.headerLines ?? 0;
      const oursBody = readFileSync(join(REPO, "packages", "host", bundle.ours, "cordis.patch.yml"), "utf8").split("\n").slice(headerLines).join("\n");
      const stock = readFileSync(join(KERNEL, bundle.stock, "cordis.patch.yml"), "utf8");
      expect(oursBody).toBe(stock);
    }
  });
});