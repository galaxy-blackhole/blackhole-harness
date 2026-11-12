/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-experimental-api-speech-to-text: BA entrypoint RIÊNG (index →
 *      lib/index.js · typert-host → lib/typert.host.js · typert-remote-client → lib/typert.remote-client.js),
 *      mỗi entrypoint một lần Bun.build — gộp nhiều entry trong một lần làm Bun sinh prelude chia sẻ ⇒ byte
 *      lệch (bài học task-130). Cổng ownership chặn id gói GỐC lọt vào artifact; thư mục đích qua process.argv[2].
 */
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

/** Id gói GỐC — không bao giờ được xuất hiện trong artifact của ta. */
const STOCK_ID = "@deepseek-ai/dsh-experimental-api-speech-to-text";

/** Id gói của ta — phải có trong cả hai manifest typert. */
const PACKAGE_ID = "@galaxy-blackhole/gbh-experimental-api-speech-to-text";

/**
 * Kết quả buildPackage: đường dẫn tuyệt đối của từng entry đã build.
 */
export interface BuiltEntries {
  /** Remote service đã build — lib/index.js. */
  service: string;
  /** Manifest typert face HOST đã build — lib/typert.host.js. */
  typertHost: string;
  /** Manifest typert face REMOTE-CLIENT đã build — lib/typert.remote-client.js. */
  typertRemoteClient: string;
}

/**
 * Build MỘT entrypoint thành một file ESM duy nhất trong outDir rồi kiểm ownership của artifact.
 * Nhận: `entry` — đường dẫn tuyệt đối của file nguồn; `outDir` — thư mục đích; `naming` — tên artifact.
 * Trả: đường dẫn artifact vừa build.
 * @throws {Error} khi Bun.build thất bại hoặc artifact còn id gói gốc.
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
  if (!result.success) {
    throw new Error("gbh-experimental-api-speech-to-text: build " + naming + " thất bại: " + result.logs.map((log) => String(log)).join(" | "));
  }
  const artifact = join(outDir, naming);
  if (readFileSync(artifact, "utf8").includes(STOCK_ID)) {
    throw new Error("ownership: " + naming + " còn id gói gốc " + STOCK_ID);
  }
  return artifact;
}

/**
 * Build CẢ BA entrypoint của gói, MỖI entrypoint build RIÊNG vào cùng một thư mục đích.
 *
 * Nhận: `outDir` — thư mục đích (mặc định: `lib` cạnh package); thư mục được DỌN một lần trước khi build.
 * Trả: object đường dẫn từng entry — service (lib/index.js), typertHost (lib/typert.host.js),
 *      typertRemoteClient (lib/typert.remote-client.js).
 * @throws {Error} khi một lần build thất bại hoặc manifest thiếu id của ta.
 */
export async function buildPackage(outDir?: string): Promise<BuiltEntries> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const service = await buildEntry(join(import.meta.dir, "src", "index.ts"), out, "index.js");
  const typertHost = await buildEntry(join(import.meta.dir, "src", "typert-host.ts"), out, "typert.host.js");
  const typertRemoteClient = await buildEntry(join(import.meta.dir, "src", "typert-remote-client.ts"), out, "typert.remote-client.js");
  for (const manifest of [typertHost, typertRemoteClient]) {
    if (!readFileSync(manifest, "utf8").includes(PACKAGE_ID)) {
      throw new Error("ownership: " + manifest + " thiếu id " + PACKAGE_ID);
    }
  }
  return { service, typertHost, typertRemoteClient };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.service);
  console.log("built " + built.typertHost);
  console.log("built " + built.typertRemoteClient);
}
