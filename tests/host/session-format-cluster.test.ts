/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho CỤM 11 gói THƯ VIỆN session/format (task-141) — mỗi gói 9 ca: sha artifact = provenance =
 *      bản gốc · TOÀN BỘ lib/** khớp byte · tập export trùng · kiểu export trùng · exports phủ đúng subpath ·
 *      provenance + draft + KHÔNG row/nested · đối chứng ÂM (0 row trong dump) · artifact NẠP ĐƯỢC thật · peer
 *      khai đủ. Tổng: 11 gói × 9 ca.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tệp này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Dump parity dùng để đo quyết định manifest. */
const DUMP = join(REPO, ".parity", "dumps", "2026-10-18T01-31-57", "ours.yml");

/** 11 gói của cụm, dạng [tên ngắn trong repo, tên gói stock]. */
const CLUSTER: readonly (readonly [string, string])[] = [
  ["scope", "@deepseek-ai/dsh-scope"],
  ["compaction", "@deepseek-ai/dsh-compaction"],
  ["session-format", "@deepseek-ai/dsh-session-format"],
  ["session-format-v0-to-v1", "@deepseek-ai/dsh-session-format-v0-to-v1"],
  ["session-format-v1-to-v2", "@deepseek-ai/dsh-session-format-v1-to-v2"],
  ["session-format-v2-to-v3", "@deepseek-ai/dsh-session-format-v2-to-v3"],
  ["session-format-v3-to-v4", "@deepseek-ai/dsh-session-format-v3-to-v4"],
  ["session-persistence", "@deepseek-ai/dsh-session-persistence"],
  ["session-query", "@deepseek-ai/dsh-session-query"],
  ["session-telemetry", "@deepseek-ai/dsh-session-telemetry"],
  ["output-retention", "@deepseek-ai/dsh-output-retention"],
];

/** sha256 của một tệp. Nhận: đường dẫn. Trả: hex digest. */
function shaOf(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Liệt kê mọi tệp dưới một thư mục (đệ quy). Nhận: thư mục, tiền tố. Trả: đường dẫn tương đối đã sắp xếp. */
function listFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix === "" ? entry.name : prefix + "/" + entry.name;
    if (entry.isDirectory()) out.push(...listFiles(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}

describe("cụm session/format — 11 gói THƯ VIỆN vendor 1:1 (mỗi gói 9 ca A/B)", () => {
  for (const [short, stock] of CLUSTER) {
    const PKG = join(REPO, "packages", "host", short);
    const STOCK = join(REPO, "apps", "host", "node_modules", stock);

    test(short + " · 1. sha256(lib/index.js) = provenance = bản gốc", () => {
      const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { gbh: { provenance: { sha: string } } };
      const sha = shaOf(join(PKG, "lib", "index.js"));
      expect(sha).toBe(manifest.gbh.provenance.sha);
      expect(sha).toBe(shaOf(join(STOCK, "lib", "index.js")));
    });

    test(short + " · 2. TOÀN BỘ lib/** khớp byte với bản gốc (kể cả .d.ts)", () => {
      const oursFiles = listFiles(join(PKG, "lib"));
      const stockFiles = listFiles(join(STOCK, "lib"));
      expect(oursFiles).toEqual(stockFiles);
      for (const rel of stockFiles) {
        expect(shaOf(join(PKG, "lib", rel))).toBe(shaOf(join(STOCK, "lib", rel)));
      }
    });

    test(short + " · 3. tập export TRÙNG bản gốc", async () => {
      const ours = (await import(join(PKG, "lib", "index.js"))) as Record<string, unknown>;
      const theirs = (await import(join(STOCK, "lib", "index.js"))) as Record<string, unknown>;
      expect(Object.keys(ours).sort()).toEqual(Object.keys(theirs).sort());
    });

    test(short + " · 4. kiểu từng export TRÙNG bản gốc", async () => {
      const ours = (await import(join(PKG, "lib", "index.js"))) as Record<string, unknown>;
      const theirs = (await import(join(STOCK, "lib", "index.js"))) as Record<string, unknown>;
      for (const key of Object.keys(theirs)) expect(typeof ours[key]).toBe(typeof theirs[key]);
    });

    test(short + " · 5. exports phủ ĐÚNG subpath bản gốc (bỏ ./src/*)", () => {
      const ours = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { exports: Record<string, unknown> };
      const theirs = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { exports?: Record<string, unknown> };
      const keys = Object.keys(theirs.exports ?? {}).filter((key) => key !== "./src/*").sort();
      expect(Object.keys(ours.exports).sort()).toEqual(keys);
    });

    test(short + " · 6. manifest: provenance + draft thư viện + KHÔNG row/nested", () => {
      const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
        gbh: { provenance: { stock: string; version: string }; draft?: string; row?: unknown; nested?: unknown };
      };
      const stockJson = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { name: string; version: string };
      expect(manifest.gbh.provenance.stock).toBe(stockJson.name);
      expect(manifest.gbh.provenance.version).toBe(stockJson.version);
      expect(manifest.gbh.draft ?? "").toContain("GÓI THƯ VIỆN");
      expect(manifest.gbh.row).toBeUndefined();
      expect(manifest.gbh.nested).toBeUndefined();
    });

    test(short + " · 7. ĐỐI CHỨNG ÂM: dump thật KHÔNG có row cho gói này", () => {
      const dump = readFileSync(DUMP, "utf8");
      expect(dump.includes("name: '" + stock + "'")).toBe(false);
    });

    test(short + " · 8. artifact NẠP ĐƯỢC thật (không chỉ là tệp)", async () => {
      const ours = (await import(join(PKG, "lib", "index.js"))) as Record<string, unknown>;
      expect(Object.keys(ours).length).toBeGreaterThan(0);
    });

    test(short + " · 9. peer khai ĐỦ cho mọi import @deepseek-ai/* của artifact", () => {
      const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
        gbh: { peers: string[] };
        peerDependencies: Record<string, string>;
      };
      const text = readFileSync(join(PKG, "lib", "index.js"), "utf8");
      // Chuẩn hoá SUBPATH (vd `@deepseek-ai/dsh-session/types` ⇒ `@deepseek-ai/dsh-session`): subpath đi qua
      // exports của CÙNG một gói, không phải một peer riêng.
      const imported = [
        ...new Set(
          [...text.matchAll(/from\s+"(@deepseek-ai\/[^"\/]+)(?:\/[^"]*)?/gu)].map((match) => match[1] as string),
        ),
      ].sort();
      for (const name of imported) {
        expect(manifest.gbh.peers).toContain(name);
        expect(manifest.peerDependencies[name]).toBeDefined();
      }
    });
  }
});
