/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-shell thành artifact ESM (lib/index.js, target node, dependency giữ
 *      external); build TỪNG entrypoint bằng một lượt Bun.build RIÊNG, nhận thư mục đích qua argv[2].
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Kết quả buildPackage: đường dẫn tuyệt đối của từng entry đã build.
 */
export interface BuiltEntries {
  /** File dịch vụ đã build — lib/index.js (entry runtime DUY NHẤT, đúng như stock). */
  index: string;
}

/**
 * Các entrypoint RUNTIME của gói. Stock chỉ ship một artifact `lib/index.js` (hai region
 * `render.js` + `index.js` được gộp sẵn), nên gói này cũng chỉ có một entry runtime; danh sách vẫn
 * tách từng entry để mỗi entrypoint có một lượt Bun.build RIÊNG.
 */
const ENTRIES = [{ source: "index.ts", naming: "index.js" }] as const;

/**
 * Build MỘT entrypoint thành một artifact ESM riêng trong outDir.
 *
 * Vì sao không gộp nhiều entry vào một `Bun.build`: khi nhiều entrypoint nằm chung một lượt, Bun sinh
 * thêm prelude chia sẻ giữa các entry và byte của từng artifact lệch khỏi bản build đơn (bài học
 * task-130). Mỗi entry ở đây vì vậy có prelude riêng.
 *
 * @param outDir Thư mục đích đã được dọn.
 * @param source Tên tệp nguồn trong `src/`.
 * @param naming Tên artifact ghi ra.
 * @returns Đường dẫn tuyệt đối của artifact vừa ghi.
 * @throws Khi Bun.build báo lỗi, kèm log của lần build.
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
      "gbh-shell: build " + source + " thất bại: " + result.logs.map((log) => String(log)).join(" | "),
    );
  }
  return join(outDir, naming);
}

/**
 * Build mọi entry runtime của gói, MỖI entry bằng một lượt Bun.build riêng, trong outDir.
 *
 * Nhận: `outDir` — thư mục đích (mặc định: `lib` cạnh package; tầng mount truyền qua
 * `process.argv[2]`); thư mục được DỌN một lần trước khi build.
 * Trả: object `{ index }` — đường dẫn tuyệt đối của artifact `lib/index.js` đã build.
 *
 * @param outDir Thư mục đích, mặc định `lib` cạnh package.
 * @returns Đường dẫn entry đã build.
 */
export async function buildPackage(outDir?: string): Promise<BuiltEntries> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const built = new Map<string, string>();
  for (const entry of ENTRIES) {
    built.set(entry.naming, await buildEntry(out, entry.source, entry.naming));
  }
  const index = built.get("index.js");
  if (index === undefined) {
    throw new Error("gbh-shell: thiếu entry runtime index.js");
  }
  return { index };
}

if (import.meta.main) {
  const out = await buildPackage(process.argv[2]);
  console.log("built " + out.index);
}
