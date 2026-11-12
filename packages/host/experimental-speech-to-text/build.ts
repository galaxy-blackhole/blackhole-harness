/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-experimental-speech-to-text thành BA artifact ESM riêng
 *      (lib/index.js · lib/types.js · lib/wave.js, target node, dependency giữ external),
 *      nhận thư mục đích qua process.argv[2].
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/** Kết quả buildPackage: đường dẫn tuyệt đối của từng entry đã build. */
export interface BuiltEntries {
  /** File dịch vụ đã build — lib/index.js. */
  index: string;
  /** File kiểu dùng chung đã build (rỗng lúc chạy) — lib/types.js. */
  types: string;
  /** File kiểm WAV đã build — lib/wave.js. */
  wave: string;
}

/**
 * Build TỪNG entrypoint trong một lượt Bun.build RIÊNG.
 *
 * Vì sao không gộp: khi nhiều entrypoint nằm chung một `Bun.build`, Bun sinh thêm prelude
 * chia sẻ giữa các entry và byte của từng artifact lệch khỏi bản build đơn (bài học task-130).
 * Mỗi entry ở đây vì vậy có prelude riêng, đúng như ba artifact gốc của stock.
 *
 * @param outDir Thư mục đích, mặc định `lib` cạnh package.
 * @param source Tên tệp nguồn trong `src/`.
 * @param naming Tên artifact ghi ra (cũng là tên tệp nguồn tương ứng của stock).
 * @returns Đường dẫn tuyệt đối của artifact vừa ghi.
 */
async function buildEntry(outDir: string, source: string, naming: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", source)],
    outdir: outDir,
    target: "node",
    format: "esm",
    naming,
    packages: "external",
  });
  if (!result.success) {
    throw new Error(
      "gbh-experimental-speech-to-text: build " + source + " thất bại: " + result.logs.map((log) => String(log)).join(" | "),
    );
  }
  return join(outDir, naming);
}

/**
 * Build ba entry của gói thành ba artifact ESM độc lập trong outDir.
 *
 * Nhận: `outDir` — thư mục đích (mặc định: `lib` cạnh package; tầng mount truyền qua
 * `process.argv[2]`); thư mục được DỌN một lần trước khi build.
 * Trả: object `{ index, types, wave }` — đường dẫn tuyệt đối của từng artifact đã build.
 *
 * @param outDir Thư mục đích, mặc định `lib` cạnh package.
 * @returns Đường dẫn từng entry đã build.
 */
export async function buildPackage(outDir?: string): Promise<BuiltEntries> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const index = await buildEntry(out, "index.ts", "index.js");
  const types = await buildEntry(out, "types.ts", "types.js");
  const wave = await buildEntry(out, "wave.ts", "wave.js");
  return { index, types, wave };
}

if (import.meta.main) {
  const out = await buildPackage(process.argv[2]);
  console.log("built " + out.index + " + " + out.types + " + " + out.wave);
}
