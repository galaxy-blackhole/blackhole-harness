/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-llm về lib/: entry service (src/index.ts) -> lib/index.js và HAI
 *      manifest typert generated (src/typert-host.ts -> lib/typert.host.js, src/typert-remote-client.ts ->
 *      lib/typert.remote-client.js), giữ entry worker nếu có — ESM, target node, dependency giữ external;
 *      bản build CHỈ nằm trong profile của app, nhận thư mục đích qua process.argv[2].
 */
import { existsSync } from "node:fs";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build MỘT entry thành một file ESM duy nhất trong outDir.
 * Nhận: entry — đường dẫn tuyệt đối của file nguồn; outDir — thư mục đích; naming — tên file đầu ra.
 * Trả: đường dẫn file đã build.
 */
async function buildEntry(entry: string, outDir: string, naming: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    target: "node",
    format: "esm",
    naming,
    packages: "external",
  });
  if (!result.success) throw new Error("build thất bại (" + naming + "): " + result.logs.map((log) => String(log)).join(" | "));
  return join(outDir, naming);
}

/**
 * Kết quả buildPackage: đường dẫn tuyệt đối của từng entry đã build.
 * Trường worker chỉ có khi gói có src/worker.ts (gói này không có, giống stock).
 */
export interface BuiltEntries {
  service: string;
  typertHost: string;
  typertRemoteClient: string;
  worker?: string;
}

/**
 * Build CA các entry của gói (service + hai manifest typert + worker nếu có) vào cùng một thư mục đích.
 * Nhận: outDir — thư mục đích (mặc định: \`lib\` cạnh package); thư mục được DỌN một lần trước khi build.
 * Trả: object đường dẫn từng entry — service (lib/index.js), typertHost (lib/typert.host.js),
 *      typertRemoteClient (lib/typert.remote-client.js), worker (lib/worker.js) khi có.
 */
export async function buildPackage(outDir?: string): Promise<BuiltEntries> {
  // 20/10/2026 (task-186): gói đã de-bundle nửa host ⇒ CHÉP nguyên cây lib/ (1:1 bản gốc), KHÔNG build lại.
  {
    const out0 = outDir ?? join(import.meta.dir, "lib");
    const daDebundle = copyIfDebundled(import.meta.dir, out0);
    if (daDebundle !== null) {
      // Trả ĐÚNG hình dạng BuiltEntries (test đọc .service/.typertHost/…), không phải string.
      return {
        service: join(out0, "index.js"),
        typertHost: join(out0, "typert.host.js"),
        typertRemoteClient: join(out0, "typert.remote-client.js"),
        ...(existsSync(join(out0, "worker.js")) ? { worker: join(out0, "worker.js") } : {}),
      };
    }
  }
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const service = await buildEntry(join(import.meta.dir, "src", "index.ts"), out, "index.js");
  const typertHost = await buildEntry(join(import.meta.dir, "src", "typert-host.ts"), out, "typert.host.js");
  const typertRemoteClient = await buildEntry(join(import.meta.dir, "src", "typert-remote-client.ts"), out, "typert.remote-client.js");
  const built: BuiltEntries = { service, typertHost, typertRemoteClient };
  const workerEntry = join(import.meta.dir, "src", "worker.ts");
  if (existsSync(workerEntry)) built.worker = await buildEntry(workerEntry, out, "worker.js");
  return built;
}

if (import.meta.main) {
  const target = process.argv[2];
  const built = await buildPackage(target);
  console.log("built " + built.service);
  console.log("built " + built.typertHost);
  console.log("built " + built.typertRemoteClient);
  if (built.worker !== undefined) console.log("built " + built.worker);
}
