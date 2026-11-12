/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build subprocess-local: lib/index.js · lib/output.js · lib/runner-launch-B2zsQ1Dz.js · lib/runner.js = các lát NGUYÊN VĂN ghép lại (cổng byte với bản gốc) + chép cây .d.ts
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle, stripSliceScaffold } from "./src/assemble.ts";
import { ARTEFACTS, OUT_FILE_BIN, OUT_FILE_NAME, PARTS_DIR_NAME, RUNNER_FILE_NAME, STOCK_LIB_DIR, type Artefact } from "./src/manifest.ts";

/** Gốc repo (gói nằm ở packages/host/subprocess-local). */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Dòng khai báo kiểu cho artefact ghép — trỏ thẳng vào cây .d.ts của bản gốc. */
const TYPES_REEXPORT =
  'export * from "./types/index.js";' + EOL + 'export { LocalSubprocessRuntime as default } from "./types/index.js";' + EOL;

/**
 * Băm SHA-256 một buffer byte.
 * Nhận: data — buffer cần băm.
 * Trả: chuỗi hex đầy đủ.
 */
function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Tìm vị trí BYTE lệch đầu tiên giữa hai buffer.
 * Nhận: left — bản ghép; right — bản gốc.
 * Trả: chỉ số byte lệch đầu tiên, hoặc -1 khi hai buffer giống hệt từng byte.
 */
function firstByteDiff(left: Buffer, right: Buffer): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return left.length === right.length ? -1 : limit;
}

/**
 * Ghép các lát của MỘT artefact theo danh mục riêng của nó.
 * Vì sao không gọi thẳng assembleBundle: src/assemble.ts là bản COPY NGUYÊN VĂN, bind cứng danh mục
 * index (PART_FILES) — nên ở đây dùng đúng phép gỡ vỏ stripSliceScaffold của nó với danh mục của artefact.
 * Nhận: artefact — mô tả artefact (thư mục lát + danh mục lát).
 * Trả: văn bản module đã ghép.
 */
export function assembleArtefact(artefact: Artefact): string {
  const dir = join(import.meta.dir, "src", artefact.partsDir);
  const lines: string[] = [];
  for (const fileName of artefact.partFiles) {
    lines.push(...stripSliceScaffold(readFileSync(join(dir, fileName), "utf8"), fileName));
  }
  return lines.join(EOL);
}

/**
 * Build MỘT artefact: ghép các lát ⇒ so TỪNG BYTE với bundle gốc ⇒ ghi lib/<outFile>.
 * Nhận: artefact — mô tả artefact (bộ lát · tệp đích · bundle gốc); outDir — thư mục đích.
 * Trả: đường dẫn tệp đã ghi.
 */
export function buildArtefact(artefact: Artefact, outDir: string): string {
  const assembled = assembleArtefact(artefact);
  // Đường CHUẨN của artefact index là assembleBundle (bản copy nguyên văn) — đối chiếu để chắc hai đường khớp nhau.
  if (artefact.partsDir === PARTS_DIR_NAME && assembleBundle(join(import.meta.dir, "src", PARTS_DIR_NAME)) !== assembled) {
    throw new Error("assembleArtefact va assembleBundle lech nhau o artefact index");
  }
  const assembledBuf = Buffer.from(assembled, "utf8");
  const stockBuf = readFileSync(join(REPO, artefact.stockBundle));
  const at = firstByteDiff(assembledBuf, stockBuf);
  if (at >= 0) {
    throw new Error(
      artefact.outFile + ": ban ghep KHONG trung bundle goc: assembled " + String(assembledBuf.length) + " B / sha " + sha256(assembledBuf).slice(0, 12) +
        " · stock " + String(stockBuf.length) + " B / sha " + sha256(stockBuf).slice(0, 12) + " · lech dau tien o byte " + String(at),
    );
  }
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, artefact.outFile);
  writeFileSync(file, assembledBuf);
  console.log(
    "  " + artefact.outFile + " · byte-identical · " + String(assembledBuf.length) + " B · sha256 " + sha256(assembledBuf) +
      " · " + String(artefact.partFiles.length) + " lát",
  );
  return file;
}

/**
 * Chép cây khai báo kiểu của bản gốc vào lib/types và sinh lib/index.d.ts.
 * Bản gốc CÓ lib/types/output.d.ts nên lib/output.d.ts KHÔNG cần sinh (package.json trỏ ./lib/types/output.d.ts).
 * Nhận: outDir — thư mục đích (lib của gói).
 * Trả: danh sách tệp khai báo kiểu đã ghi thêm (ngoài cây chép).
 */
export function writeTypes(outDir: string): string[] {
  const stockTypes = join(REPO, STOCK_LIB_DIR, "types");
  if (!existsSync(join(stockTypes, "index.d.ts"))) throw new Error("ban goc thieu lib/types/index.d.ts");
  cpSync(stockTypes, join(outDir, "types"), { recursive: true });
  const indexDts = join(outDir, "index.d.ts");
  writeFileSync(indexDts, TYPES_REEXPORT);
  const written = [indexDts];
  if (existsSync(join(stockTypes, "output.d.ts"))) {
    console.log("  lib/output.d.ts · BO QUA (ban goc da co lib/types/output.d.ts — chep nguyen cay la du)");
  } else {
    const outputDts = join(outDir, "output.d.ts");
    writeFileSync(outputDts, TYPES_REEXPORT);
    written.push(outputDts);
    console.log("  lib/output.d.ts · DA SINH (ban goc khong co lib/types/output.d.ts)");
  }
  return written;
}

/**
 * Build cả gói: 4 artefact byte-identical + cây .d.ts.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: danh sách tệp artefact đã ghi (index · output · runner-launch · runner).
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  const files: string[] = [];
  for (const artefact of ARTEFACTS) files.push(buildArtefact(artefact, out));
  // Artefact thứ tư (runner.js) là entry bin provider-private: phải CÓ MẶT sau vòng ghép, thiếu là build hỏng.
  if (!existsSync(join(out, OUT_FILE_BIN))) throw new Error("thieu " + OUT_FILE_BIN + " — artefact thu tu chua duoc ghep");
  // Cổng tên chunk: index.js PHẢI import ĐÚNG tên runner-launch có hash — đổi tên là vỡ import lúc chạy.
  const indexText = readFileSync(join(out, OUT_FILE_NAME), "utf8");
  if (!indexText.includes('"./' + RUNNER_FILE_NAME + '"')) {
    throw new Error("index.js khong import " + RUNNER_FILE_NAME + " — ten chunk da bi doi");
  }
  writeTypes(out);
  return files;
}

if (import.meta.main) {
  const files = await buildPackage(process.argv[2]);
  console.log("built " + String(files.length) + " artefact (byte-identical với bản gốc): " + files.join(" · "));
}
