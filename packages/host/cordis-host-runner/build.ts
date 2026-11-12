/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-host-cordis-host-runner: 2 artifact TS (index + types) + 2 artefact typert
 *      SINH TỰ ĐỘNG đọc nguyên văn từ kernel, so BYTE, rồi CỔNG OWNERSHIP đổi package id stock → id CỦA TA
 *      (typert-loader từ chối manifest không do gói export nó — lỗi boot-smoke 19/10/2026 "definition withdrawn")
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Điểm vào TS → tên artifact trong lib/. */
const ENTRYPOINTS: ReadonlyArray<readonly [string, string]> = [
  ["index.ts", "index.js"],
  ["types.ts", "types.js"],
];

/** Artefact typert SINH TỰ ĐỘNG của gói gốc (đọc từ kernel, không lưu bản sao trong repo). */
const GENERATED: ReadonlyArray<string> = ["typert.host.js", "typert.remote-client.js"];

/** Id package GỐC (nguồn ownership) — mọi lần xuất hiện phải thành id của ta. */
const STOCK_PACKAGE_ID = "@deepseek-ai/dsh-cordis-host-runner";

/**
 * Id package CỦA TA — đọc từ package.json để không bao giờ lệch tên gói thật được mount.
 * Nhận: không.
 * Trả: tên package trong package.json của gói này.
 */
function ourPackageId(): string {
  const manifest = JSON.parse(readFileSync(join(import.meta.dir, "package.json"), "utf8")) as { name: string };
  return manifest.name;
}

/**
 * Băm sha256 một chuỗi UTF-8 để ghi bằng chứng byte.
 * Nhận: text — chuỗi cần băm.
 * Trả: chuỗi hex sha256.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Tìm thư mục lib/ của gói gốc trong kernel.
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối tới lib/ của @deepseek-ai/dsh-cordis-host-runner, hoặc null nếu không có.
 */
function stockLibDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates: string[] = [
    process.env.GBH_STOCK_CORDIS_HOST_RUNNER_LIB ?? "",
    join(here, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-cordis-host-runner", "lib"),
    join(here, "..", "..", "node_modules", "@deepseek-ai", "dsh-cordis-host-runner", "lib"),
  ];
  for (const candidate of candidates) {
    if (candidate !== "" && existsSync(join(candidate, "typert.host.js"))) return candidate;
  }
  return null;
}

/**
 * Quy đổi ownership một artefact typert: giữ NGUYÊN BYTE phần còn lại, chỉ đổi package id stock → id của ta.
 * Nhận: text — nội dung artefact sinh (nguyên văn từ kernel); expected — số lần id stock xuất hiện trong bản gốc.
 * Trả: nội dung đã quy đổi.
 * @throws {Error} khi còn id stock hoặc số lần id của ta khác số kỳ vọng đo từ bundle gốc (DỪNG build).
 */
function rewriteOwnership(text: string, expected: number): string {
  const ours = ourPackageId();
  const owned = text.replace(/@deepseek-ai\/dsh-cordis-host-runner(?![A-Za-z0-9_-])/gu, ours);
  const stockLeft = owned.split(STOCK_PACKAGE_ID).length - 1;
  const oursCount = owned.split(ours).length - 1;
  if (stockLeft !== 0 || oursCount !== expected) {
    throw new Error(
      "cổng ownership " + STOCK_PACKAGE_ID + ": còn id stock " + String(stockLeft) + " lần, id ta " + String(oursCount) +
        " lần (kỳ vọng 0/" + String(expected) + ") — DỪNG build",
    );
  }
  return owned;
}

/**
 * Build gói thành các artifact ESM trong lib/.
 * Nhận: outDir — thư mục đích (mặc định lib/ cạnh package; mount.ts truyền <profile>/lib).
 * Trả: danh sách đường dẫn đã build (artifact TS + typert đã quy đổi ownership).
 * @throws {Error} khi Bun.build thất bại hoặc khi cổng byte/ownership không đạt.
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const result = await Bun.build({
    entrypoints: ENTRYPOINTS.map(([source]) => join(import.meta.dir, "src", source)),
    outdir: out,
    target: "node",
    format: "esm",
    naming: "[name].js",
    packages: "external",
  });
  if (!result.success) throw new Error("gbh-host-cordis-host-runner: build that bai: " + result.logs.map(String).join(" | "));
  const built: string[] = ENTRYPOINTS.map(([, artifact]) => join(out, artifact));
  const source = stockLibDir();
  if (source !== null) {
    for (const artifact of GENERATED) {
      const stock = readFileSync(join(source, artifact), "utf8");
      // CỔNG BYTE: artefact phải là bản NGUYÊN VĂN của kernel trước khi quy đổi (bằng chứng de-bundle).
      const expected = stock.split(STOCK_PACKAGE_ID).length - 1;
      if (expected === 0) throw new Error("cổng byte " + artifact + ": bản gốc không chứa " + STOCK_PACKAGE_ID + " — DỪNG build");
      // CỔNG OWNERSHIP: chạy SAU cổng byte nên bằng chứng byte không mất.
      const owned = rewriteOwnership(stock, expected);
      const target = join(out, artifact);
      writeFileSync(target, owned, "utf8");
      built.push(target);
      console.log(
        artifact + ": gốc " + String(stock.length) + " B / sha " + sha256(stock).slice(0, 16) + " · sau quy đổi " +
          String(owned.length) + " B / sha " + sha256(owned).slice(0, 16) + " · id stock còn lại 0 lần (đổi " + String(expected) + " lần)",
      );
    }
  } else {
    console.warn("[gbh-host-cordis-host-runner] khong tim thay artefact typert cua goi goc — bo qua 2 artefact sinh tu dong");
  }
  return built;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])).join("\n      "));
}
