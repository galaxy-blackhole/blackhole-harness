/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Dùng-tại-chỗ và cài payload của tool-workspace-dependencies, chép nguyên văn bundle gốc:
 *      compatibleManifest · resolvePrimaryRuntime · installPrimaryRuntime (giữ cây previous khi chép lỗi).
 */

import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import { readPrimaryRuntime } from "./metadata.ts";
import {
  copyPrimaryRuntime,
  exists,
  primaryRuntimePythonAliases,
  validatePayloadEntries,
  workspaceDependencyPaths,
} from "./payload.ts";
import type { PrimaryRuntimeManifest, WorkspaceDependencies } from "./types.ts";

/**
 * Đọc metadata nguồn rồi đòi nền tảng + kiến trúc phải khớp tiến trình hiện tại.
 * NGUYÊN VĂN thân hàm của bundle gốc.
 * Nhận: source — thư mục payload.
 * Trả: Promise của metadata đã kiểm, phù hợp máy đang chạy.
 * @throws {Error} khi nền tảng/kiến trúc khác: "primary runtime: incompatible platform or architecture".
 */
async function compatibleManifest(source: string): Promise<PrimaryRuntimeManifest> {
  const manifest = await readPrimaryRuntime(source);
  if (manifest.platform !== process.platform || manifest.arch !== process.arch) throw new Error("primary runtime: incompatible platform or architecture");
  return manifest;
}

/**
 * Dùng payload NGAY TẠI CHỖ: kiểm metadata và điểm vào, không chép gì.
 * NGUYÊN VĂN thân hàm của bundle gốc.
 * Nhận: source — thư mục payload, thường là carrier chỉ đọc.
 * Trả: Promise của đường dẫn trỏ vào chính payload.
 */
export async function resolvePrimaryRuntime(source: string): Promise<WorkspaceDependencies> {
  const manifest = await compatibleManifest(source);
  await primaryRuntimePythonAliases(source, manifest);
  const paths = workspaceDependencyPaths(source, manifest);
  await validatePayloadEntries(paths);
  return paths;
}

/**
 * Cài payload do ứng dụng sở hữu xuống máy, giữ TRỌN cây trước đó khi chép lỗi.
 * NGUYÊN VĂN thân hàm của bundle gốc — cùng thứ tự previous/staging/replace.
 * Nhận: source — payload đi kèm bản cài hiện tại; root — thư mục primary runtime cố định dưới Harness home.
 * Trả: Promise của đường dẫn trỏ vào payload đã cài; KHÔNG đổi PATH hay cấu hình package-manager.
 * @throws {Error} khi metadata không tương thích, payload chép lỗi hoặc đích là liên kết hệ thống tệp.
 */
export async function installPrimaryRuntime(source: string, root: string): Promise<WorkspaceDependencies> {
  const manifest = await compatibleManifest(source);
  await mkdir(dirname(root), { recursive: true });
  const previous = `${root}.previous`;
  const previousExists = await exists(previous);
  if (!await exists(root) && previousExists) await rename(previous, root);
  if (await exists(join(root, "runtime.json")) && JSON.stringify(await readPrimaryRuntime(root)) === JSON.stringify(manifest)) {
    await primaryRuntimePythonAliases(root, manifest);
    const paths = workspaceDependencyPaths(root, manifest);
    await validatePayloadEntries(paths);
    return paths;
  }
  const staging = await mkdtemp(join(dirname(root), ".primary-runtime-"));
  try {
    await copyPrimaryRuntime(source, staging, manifest);
    await validatePayloadEntries(workspaceDependencyPaths(staging, manifest));
    await rm(previous, {
      recursive: true,
      force: true,
    });
    const replacing = await exists(root);
    if (replacing) await rename(root, previous);
    try {
      await rename(staging, root);
    } catch (error) {
      if (replacing) await rename(previous, root);
      throw error;
    }
    await rm(previous, {
      recursive: true,
      force: true,
    });
  } finally {
    await rm(staging, {
      recursive: true,
      force: true,
    });
  }
  return workspaceDependencyPaths(root, manifest);
}
