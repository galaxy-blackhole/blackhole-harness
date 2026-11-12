/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-host-plugin-manager: 5 artifact TS (index + 4 subpath) + 2 artifact typert
 *      SINH TỰ ĐỘNG — typert KHÔNG chép vào repo (mọi tệp trong packages/** phải có header + ≤1000 dòng);
 *      build đọc nguyên văn artefact sinh của gói gốc trong kernel rồi phát ra lib/.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Điểm vào TS → tên artifact trong lib/. */
const ENTRYPOINTS: ReadonlyArray<readonly [string, string]> = [
  ["index.ts", "index.js"],
  ["types.ts", "types.js"],
  ["registry.ts", "registry.js"],
  ["operations.ts", "operations.js"],
  ["tools.ts", "tools.js"],
];

/** Artefact typert SINH TỰ ĐỘNG của gói gốc (đọc từ kernel, không lưu bản sao trong repo). */
const GENERATED: ReadonlyArray<string> = ["typert.host.js", "typert.remote-client.js"];

/** Id package GỐC (nguồn ownership) — mọi lần xuất hiện phải thành id của ta. */
const STOCK_PACKAGE_ID = "@deepseek-ai/dsh-plugin-manager";

/**
 * Tìm thư mục lib/ của gói gốc trong kernel.
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối tới lib/ của @deepseek-ai/dsh-plugin-manager, hoặc null nếu không có.
 */
function stockLibDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates: string[] = [
    process.env.GBH_STOCK_PLUGIN_MANAGER_LIB ?? "",
    join(here, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-plugin-manager", "lib"),
    join(here, "..", "..", "node_modules", "@deepseek-ai", "dsh-plugin-manager", "lib"),
  ];
  for (const candidate of candidates) {
    if (candidate !== "" && existsSync(join(candidate, "typert.host.js"))) return candidate;
  }
  return null;
}

/**
 * Build gói thành các artifact ESM trong lib/.
 * Nhận: outDir — thư mục đích (mặc định lib/ cạnh package; mount.ts truyền <profile>/lib).
 * Trả: danh sách đường dẫn đã build (5 artifact TS + typert nếu tìm được nguồn sinh).
 * @throws {Error} khi Bun.build thất bại.
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  // Build TỪNG entrypoint RIÊNG (bài học task-130): gộp nhiều entry trong MỘT Bun.build khiến Bun sinh
  // prelude/chunk chia sẻ ⇒ byte artifact lệch (đã đo 1.103 B → 5.188 B), phá cổng byte so với bản gốc.
  const built: string[] = [];
  for (const [source, artifact] of ENTRYPOINTS) {
    const result = await Bun.build({
      entrypoints: [join(import.meta.dir, "src", source)],
      outdir: out,
      target: "node",
      format: "esm",
      naming: artifact,
      packages: "external",
    });
    if (!result.success) throw new Error("gbh-host-plugin-manager: build that bai (" + artifact + "): " + result.logs.map(String).join(" | "));
    built.push(join(out, artifact));
  }
  const source = stockLibDir();
  if (source !== null) {
    for (const artifact of GENERATED) {
      // CỔNG BYTE + CỔNG OWNERSHIP: artefact sinh phải là bản nguyên văn của kernel, rồi đổi package id
      // stock → id CỦA TA (typert-loader từ chối manifest không do gói export nó — lỗi boot-smoke 19/10/2026).
      const stock = readFileSync(join(source, artifact), "utf8");
      const expected = stock.split(STOCK_PACKAGE_ID).length - 1;
      if (expected === 0) throw new Error("cổng byte " + artifact + ": bản gốc không chứa " + STOCK_PACKAGE_ID + " — DỪNG build");
      const ours = (JSON.parse(readFileSync(join(import.meta.dir, "package.json"), "utf8")) as { name: string }).name;
      const owned = stock.replace(/@deepseek-ai\/dsh-plugin-manager(?![A-Za-z0-9_-])/gu, ours);
      const stockLeft = owned.split(STOCK_PACKAGE_ID).length - 1;
      const oursCount = owned.split(ours).length - 1;
      if (stockLeft !== 0 || oursCount !== expected) {
        throw new Error(
          "cổng ownership " + STOCK_PACKAGE_ID + ": còn id stock " + String(stockLeft) + " lần, id ta " + String(oursCount) +
            " lần (kỳ vọng 0/" + String(expected) + ") — DỪNG build",
        );
      }
      writeFileSync(join(out, artifact), owned, "utf8");
      console.log(artifact + ": quy đổi ownership " + String(expected) + " lần · sha " + createHash("sha256").update(owned, "utf8").digest("hex").slice(0, 16));
      built.push(join(out, artifact));
    }
  } else {
    console.warn("[gbh-host-plugin-manager] khong tim thay artefact typert cua goi goc — bo qua 2 artefact sinh tu dong");
  }
  return built;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])).join("\n      "));
}
