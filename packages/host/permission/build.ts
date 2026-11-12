import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build package về lib/index.js (ESM, target node) — bản build chỉ nằm trong profile của app
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { emitDeclarations } from "../../../tools/typegen/emit-types.ts";


/** Id gói stock (bundle gốc) — mọi artefact typert sinh từ FaceModel của gói này. */
const STOCK_FACE_ID = "@deepseek-ai/dsh-permission-presets";

/** Id gói của ta — thay ĐÚNG chuỗi trên, không đổi byte nào khác. */
const OUR_FACE_ID = "@galaxy-blackhole/gbh-permission";

/** Thư mục chứa lát NGUYÊN VĂN của artefact stock. */
const FACES_DIR = join(import.meta.dir, "src", "faces");

/**
 * Build các artefact FaceModel (typert + types) từ lát NGUYÊN VĂN của stock.
 * Cổng HAI CHIỀU: (a) thay id ⇒ artefact ta; (b) thay ngược ⇒ phải TRÙNG TỪNG BYTE bản stock ban đầu.
 * Sai byte nào ⇒ ném, KHÔNG nới cổng.
 * @param out - thư mục lib đích.
 * @returns báo cáo từng artefact: tên file, số byte, số lần đổi id.
 */
async function buildFaceArtifacts(out: string): Promise<{ name: string; bytes: number; occurrences: number }[]> {
  const report: { name: string; bytes: number; occurrences: number }[] = [];
  const manifest = JSON.parse(readFileSync(join(FACES_DIR, "manifest.json"), "utf8")) as Record<string, { lib: string; occurrences: number }>;
  for (const [flat, item] of Object.entries(manifest)) {
    const stockText = readFileSync(join(FACES_DIR, flat), "utf8");
    const occurrences = stockText.split(STOCK_FACE_ID).length - 1;
    if (occurrences !== item.occurrences) {
      throw new Error("permission: " + item.lib + " so lan id stock la " + String(occurrences) + " (manifest ghi " + String(item.occurrences) + ")");
    }
    const ours = stockText.split(STOCK_FACE_ID).join(OUR_FACE_ID);
    // Cổng (b): đảo ngược phải trùng từng byte bản stock ⇒ chứng minh chỉ đổi id.
    if (ours.split(OUR_FACE_ID).join(STOCK_FACE_ID) !== stockText) {
      throw new Error("permission: " + item.lib + " — dao nguoc KHONG trung stock ⇒ co thay doi ngoai id");
    }
    const target = join(out, item.lib);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, ours, "utf8");
    report.push({ name: item.lib, bytes: Buffer.byteLength(ours), occurrences });
  }
  return report;
}
/**
 * Build package thành MỘT file ESM duy nhất.
 * Nhận: thư mục đích (mặc định: `lib` cạnh package) — profile của app truyền đường dẫn qua `process.argv[2]`.
 * Trả: đường dẫn file đã build.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!result.success) throw new Error("build that bai: " + result.logs.map((log) => String(log)).join(" | "));
  const faces = await buildFaceArtifacts(out);
  for (const face of faces) console.log("[permission] " + face.name + " " + String(face.bytes) + " B, doi id " + String(face.occurrences) + " lan");
  // 05/11/2026 (P1b): sinh .d.ts ngay trong build de khong bi xoa khi build lai.
  emitDeclarations(import.meta.dir);
  return join(out, "index.js");
}

if (import.meta.main) {
  const target = process.argv[2];
  console.log("built " + (await buildPackage(target)));
}
