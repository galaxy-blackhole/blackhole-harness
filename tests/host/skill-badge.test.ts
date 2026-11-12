/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-skill-badge: artefact NGUYÊN VĂN @deepseek-ai/dsh-skill-badge
 *      (byte-identical + sha) + export surface + 0 tệp lib/types/*.js + locale + metadata provenance.
 */
import { describe, expect, test } from "bun:test";

/**
 * Chuẩn hoá THƯƠNG HIỆU về bản gốc để so locale en/zh với stock.
 * Lý do (21/10/2026): huy hiệu là sản phẩm của TA nên tiêu đề/mô tả phải mang thương hiệu GBH;
 * mọi byte khác vẫn phải trùng bản gốc — chỉ hai chỗ thương hiệu được phép khác.
 * Nhận: chuỗi gốc. Trả: chuỗi đã đổi về thương hiệu cũ để so.
 */
function chuanHoaThuongHieu(text: string): string {
  return text.replaceAll("powered-by-GBH", "powered-by-DSH").replaceAll("powered by gbh", "powered by dsh").replaceAll("gbh-badge", "dsh-badge").replaceAll("GBH", "DSH");
}
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";


/** Gốc repo (tệp nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục nguồn stock (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai", "dsh-skill-badge");
/** Thư mục gói ta. */
const OURS = join(REPO, "packages/host", "skill-badge");

/** Tính sha256 của buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

/**
 * Chuẩn hoá CÂU MÔ TẢ kỹ năng (một sai lệch CÓ CHỦ Ý — xem ADR 0022).
 * Lý do (25/10/2026): kỹ năng đổi từ "huy hiệu SVG powered by dsh" sang quy ước văn bản
 * ("Power by Galaxy Blackhole" cho tài liệu + header 5 dòng cho mã nguồn) nên câu mô tả trong artefact
 * phải khác bản gốc; mọi byte khác vẫn phải trùng stock.
 * Nhận: văn bản artefact. Trả: văn bản đã thay mọi giá trị `description: "…"` bằng một chỗ giữ chỗ.
 */
function chuanHoaMoTa(text: string): string {
  return text.replace(/description: "(?:[^"\\]|\\.)*"/gu, 'description: "<mo-ta>"');
}

describe("A · artefact byte-identical", () => {
  test("lib/index.js: mọi byte trùng stock, CHỈ câu mô tả kỹ năng là khác (ADR 0022)", () => {
    const oursBuf = readFileSync(join(OURS, "lib/index.js"));
    const stockBuf = readFileSync(join(STOCK, "lib/index.js"));
    const ours = oursBuf.toString("utf8");
    const stock = stockBuf.toString("utf8");
    expect(chuanHoaMoTa(chuanHoaThuongHieu(ours))).toBe(chuanHoaMoTa(stock));
    // Sai lệch đúng bằng phần câu mô tả: bản ta nêu quy ước văn bản mới, bản gốc nêu huy hiệu SVG.
    expect(ours).toContain("Power by Galaxy Blackhole");
    expect(stock).not.toContain("Power by Galaxy Blackhole");
    expect(sha(oursBuf)).not.toBe(sha(stockBuf));
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
    const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(typeof ours["default"]).toBe(typeof stock["default"]);
  });

  test("gói không có subpath runtime (exports chỉ '.')", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { exports: Record<string, string> };
    expect(Object.keys(manifest.exports)).toEqual([".", "./package.json", "./locale/*.json"]);
  });
});

describe("C · locale + metadata", () => {
  test("locale trùng byte-for-byte stock", () => {
    for (const rel of ["en.json","zh.json"]) {
      const ours = readFileSync(join(OURS, "locale", rel));
      const stock = readFileSync(join(STOCK, "locale", rel));
      expect(chuanHoaThuongHieu(ours.toString("utf8"))).toBe(stock.toString("utf8"));
    }
  });

  test("gbh.provenance { stock, version, sha } khớp stock", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; version?: string; sha?: string } } };
    expect(manifest.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-skill-badge");
    expect(manifest.gbh.provenance?.version).toBe("0.2.1-alpha.4");
    expect(manifest.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("khai báo cơ chế đúng: LÀ row (mount được) và giữ nhãn draft (ADR 0022)", () => {
    // 25/10/2026 — trước đây gói này KHÔNG khai `gbh.row` nên mount không chép vào profile ⇒ bundle
    // đang bật vẫn không có skill (nội dung ghi công mới không bao giờ tới được model). Nay khai row
    // đúng như mọi gói được mount; nhãn `draft` (thư viện nhãn skill) giữ nguyên.
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      gbh: { row?: { id?: string; tests?: string[] }; draft?: string };
    };
    expect(manifest.gbh.row?.id).toBe("skill-badge");
    expect(manifest.gbh.row?.tests).toEqual(["tests/host/skill-badge.test.ts"]);
    expect(typeof manifest.gbh.draft).toBe("string");
  });
});

describe("F · id skill là gbh-badge (10/11/2026)", () => {
  test("artefact đăng ký ĐÚNG id gbh-badge và không còn chuỗi dsh-badge trong tệp ship", () => {
    const lib = readFileSync(join(OURS, "lib", "index.js"), "utf8");
    expect(lib).toContain('const PROVIDER_NAME = "gbh-badge";');
    expect(lib).toContain('name: "gbh-badge",');
    expect(lib).toContain("../assets/gbh-badge.md");
    expect(lib).not.toContain("dsh-badge");
    // Tệp khai kiểu và danh sách asset cũng phải mang tên GBH.
    expect(readFileSync(join(OURS, "lib", "types", "index.d.ts"), "utf8")).not.toContain("dsh-badge");
    const assets = readdirSync(join(OURS, "assets")).sort();
    expect(assets).toEqual(["gbh-badge.md", "gbh-badge.png"]);
  });

  test("provider trả về đúng tên + nội dung đọc được từ asset GBH", async () => {
    interface Provider {
      name: string;
      list: () => Promise<{ name: string }[]>;
      get: (candidate: { name: string }) => Promise<{ name: string; content: string }>;
    }
    const plugin = (await import(join(OURS, "lib", "index.js"))) as {
      apply: (ctx: { skills: { registerProvider: (factory: () => Provider) => void } }) => void;
    };
    const captured: Provider[] = [];
    plugin.apply({ skills: { registerProvider: (factory) => { captured.push(factory()); } } });
    expect(captured[0]?.name).toBe("gbh-badge");
    const listed = await captured[0]!.list();
    expect(listed[0]?.name).toBe("gbh-badge");
    const got = await captured[0]!.get(listed[0]!);
    expect(got.name).toBe("gbh-badge");
    expect(got.content).toContain("Power by Galaxy Blackhole");
  });
});

describe("E · runtime surface + locale + assets (đủ ≥8 ca)", () => {
  test("inject + name + (Config nếu có) A≡B", async () => {
    const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
    expect(ours["inject"]).toEqual(stock["inject"]);
    expect(ours["name"]).toBe(stock["name"]);
    expect(typeof ours["apply"]).toBe("function");
    expect(String(ours["Config"])).toBe(String(stock["Config"]));
  });

  test("locale trùng byte-for-byte stock", () => {
    for (const rel of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(OURS, "locale", rel));
      const stock = readFileSync(join(STOCK, "locale", rel));
      expect(chuanHoaThuongHieu(ours.toString("utf8"))).toBe(stock.toString("utf8"));
    }
  });
  test("assets: PNG trùng byte-for-byte; gbh-badge.md là nội dung MỚI của ta (ADR 0022)", () => {
    // PNG (726×120) giữ nguyên văn — chỉ nội dung hướng dẫn và TÊN tệp là đổi theo id GBH (10/11/2026).
    const pngOurs = readFileSync(join(OURS, "assets", "gbh-badge.png"));
    const pngStock = readFileSync(join(STOCK, "assets", "dsh-badge.png"));
    expect(pngOurs.equals(pngStock)).toBe(true);
    // .md: quy ước văn bản mới — tài liệu thêm dòng ở cuối tệp, mã nguồn sinh header 5 dòng.
    const md = readFileSync(join(OURS, "assets", "gbh-badge.md"), "utf8");
    expect(md).toContain("Power by Galaxy Blackhole");
    expect(md).toContain("* author Galaxy Blackhole");
    expect(md).toContain("* create <YYYY-MM-DD>");
    expect(md).toContain("* modify <YYYY-MM-DD>");
    expect(md).toContain("* desc ");
    // Không còn huy hiệu SVG/shields của bản gốc.
    expect(md).not.toContain("shields.io");
    expect(md).not.toContain(".png");
  });
});
