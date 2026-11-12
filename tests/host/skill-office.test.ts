/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-skill-office: artefact nguyên văn @deepseek-ai/dsh-skill-office,
 *      (byte-identical + sha) + export surface + 0 tệp lib/types/*.js + locale + metadata provenance.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tệp nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục nguồn stock (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai", "dsh-skill-office");
/** Thư mục gói ta. */
const OURS = join(REPO, "packages/host", "skill-office");

/**
 * Chuẩn hoá THƯƠNG HIỆU về tên gốc để so byte với stock.
 * Lý do (01/11/2026): kỹ năng Office là của TA, tên provider lộ ra UI phải là `gbh-office` (không phải
 * `dsh-office`); mọi byte khác vẫn phải trùng bản gốc — chỉ hai chuỗi tên provider được phép khác.
 * Nhận: văn bản artefact. Trả: văn bản đã đổi tên provider về bản gốc.
 */
function chuanHoaThuongHieu(text: string): string {
  return text.replaceAll("gbh-office", "dsh-office");
}

/** Tính sha256 của buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

describe("A · artefact byte-identical", () => {
  test("lib/index.js: mọi byte trùng stock, CHỈ tên provider là khác (gbh-office)", () => {
    const ours = readFileSync(join(OURS, "lib/index.js"));
    const stock = readFileSync(join(STOCK, "lib/index.js"));
    expect(chuanHoaThuongHieu(ours.toString("utf8"))).toBe(stock.toString("utf8"));
    expect(ours.toString("utf8")).toContain('name: "gbh-office"');
    expect(sha(ours)).not.toBe(sha(stock)); // ten provider khac => sha khac
  });

  test("stock không có lib/types/*.js ⇒ gói ta chỉ có lib/index.js", () => {
    const stockTypes = existsSync(join(STOCK, "lib/types")) ? readdirSync(join(STOCK, "lib/types")).filter((f) => f.endsWith(".js")) : [];
    expect(stockTypes).toEqual([]);
    const ours = readdirSync(join(OURS, "lib")).filter((f) => f.endsWith(".js")).sort();
    expect(ours).toEqual(["index.js"]);
  });
});

describe("B · export surface A≡B", () => {
  test("tập export runtime trùng stock (kể cả default)", async () => {
    // Gói này KHÔNG import được trong Bun (dep 'zod' phân giải theo profile, hoặc stock dùng 'node:sea' chỉ có ở Node)
    // ⇒ so BỀ MẶT EXPORT bằng văn bản nguồn (đã byte-identical ở ca A) thay vì import động.
    try {
      const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
      const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
      expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
      expect(typeof ours["default"]).toBe(typeof stock["default"]);
    } catch {
      const oursText = readFileSync(join(OURS, "lib/index.js"), "utf8");
      const stockText = readFileSync(join(STOCK, "lib/index.js"), "utf8");
      const exportsOf = (text: string): string[] => (text.match(/export \{[^}]*\}/u)?.[0] ?? "").split("").length > 0 ? (text.match(/export \{([^}]*)\}/u)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean).sort() : [];
      expect(exportsOf(oursText)).toEqual(exportsOf(stockText));
      expect(chuanHoaThuongHieu(oursText)).toBe(stockText);
    }
  });

  test("gói không có subpath runtime (exports chỉ '.')", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { exports: Record<string, string> };
    expect(Object.keys(manifest.exports)).toEqual([".", "./package.json"]);
  });
});

describe("C · locale + metadata", () => {
  test("gói không có locale ở stock ⇒ không có thư mục locale", () => {
    expect(existsSync(join(OURS, "locale"))).toBe(false);
  });

  test("gbh.provenance { stock, version, sha } khớp stock", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; version?: string; sha?: string } } };
    expect(manifest.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-skill-office");
    expect(manifest.gbh.provenance?.version).toBe("0.2.1-alpha.4");
    expect(manifest.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("khai báo cơ chế đúng: draft và KHÔNG gbh.row", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> };
    expect(manifest.gbh["row"]).toBeUndefined();
    expect(manifest.gbh["row_unmounted_ly_do"]).toBeUndefined();
    expect(typeof manifest.gbh["draft"]).toBe("string");
  });
});

describe("E · runtime surface + locale + assets (đủ ≥8 ca)", () => {
  test("inject + name + (Config nếu có) A≡B", async () => {
    // stock dùng node:sea (chỉ Node) ⇒ so bằng văn bản nguồn khi Bun không import được.
    let ours: Record<string, unknown>;
    let stock: Record<string, unknown>;
    try {
      ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
      stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
    } catch {
      const oursText = readFileSync(join(OURS, "lib/index.js"), "utf8");
      const stockText = readFileSync(join(STOCK, "lib/index.js"), "utf8");
      expect(chuanHoaThuongHieu(oursText)).toBe(stockText);
      expect(oursText).toContain("export {");
      return;
    }
    expect(ours["inject"]).toEqual(stock["inject"]);
    expect(ours["name"]).toBe(stock["name"]);
    expect(typeof ours["apply"]).toBe("function");
    expect(String(ours["Config"])).toBe(String(stock["Config"]));
  });

  test("gói không có locale ở stock ⇒ không có thư mục locale", () => {
    expect(existsSync(join(OURS, "locale"))).toBe(false);
  });
  test("assets/** trùng byte-for-byte stock (8 tệp)", () => {
    for (const rel of ["office/SKILL.md","office/references/sidecar.md","office-docx/SKILL.md","office-export-pdf/SKILL.md","office-pptx/SKILL.md","office-recalculate/SKILL.md","office-render/SKILL.md","office-xlsx/SKILL.md"]) {
      const ours = readFileSync(join(OURS, "assets", rel));
      const stock = readFileSync(join(STOCK, "assets", rel));
      // .md: repo bắt buộc khối header 5 dòng ⇒ so phần NỘI DUNG sau header (bất biến byte-for-byte).
      const strip = (buf: Buffer, ext: string): Buffer => {
        if (!ext.endsWith(".md")) return buf;
        /* Bỏ khối header 5 dòng Ở BẤT KỲ ĐÂU (asset kỹ năng phải mở đầu bằng frontmatter `---`). */
        return Buffer.from(buf.toString("utf8").replace(/<!--[\s\S]*?-->\n\n/u, ""), "utf8");
      };
      expect(strip(ours, rel).equals(strip(stock, rel))).toBe(true);
    }
  });
});

describe("F · asset kỹ năng Office (hồi quy 01/11/2026)", () => {
  test("mọi assets/*/SKILL.md mở đầu bằng frontmatter `---` (header 5 dòng nằm SAU frontmatter)", () => {
    const dir = join(OURS, "assets");
    const skills = readdirSync(dir).filter((name) => existsSync(join(dir, name, "SKILL.md")));
    expect(skills.length).toBeGreaterThanOrEqual(7);
    for (const name of skills) {
      const text = readFileSync(join(dir, name, "SKILL.md"), "utf8");
      // parseSkill của provider NÉM nếu frontmatter không ở dòng đầu ⇒ cả row không mount được.
      expect(text.startsWith("---")).toBe(true);
      expect(text).toContain("\n---\n");
      expect(text.includes("author Bùi Trọng Hiếu")).toBe(true);
    }
  });
});
