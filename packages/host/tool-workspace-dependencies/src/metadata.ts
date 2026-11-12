/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Đọc + chuẩn hoá metadata payload (runtime.json) của tool-workspace-dependencies, chép nguyên văn
 *      parsePrimaryRuntime/readPrimaryRuntime của bundle gốc: mọi chuỗi lỗi, thứ tự kiểm và quy tắc legacy giữ nguyên.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isDistributionMap, isRecord, isVersion, PLATFORMS } from "./config.ts";
import type { PrimaryRuntimeManifest } from "./types.ts";

/**
 * Kiểm JSON payload rồi chuẩn hoá trường `components` legacy thành phiên bản cấp cao nhất.
 * NGUYÊN VĂN thân hàm của bundle gốc — cùng thứ tự kiểm, cùng hằng số, cùng chuỗi lỗi.
 * Nhận: value — nội dung runtime.json đã giải mã (chưa tin).
 * Trả: metadata chuẩn với MỘT bản đồ distribution Python và không còn trường `components`.
 * @throws {Error} khi metadata hỏng, trộn hai định dạng, trùng tên distribution hoặc legacy không nhất quán.
 */
export function parsePrimaryRuntime(value: unknown): PrimaryRuntimeManifest {
  if (!isRecord(value)) throw new Error("primary runtime: invalid metadata");
  const legacy = value.components !== void 0;
  const versions = legacy ? value.components : value;
  if (!isRecord(versions) || legacy && [
    "python",
    "node",
    "pnpm",
  ].some((key) => value[key] !== void 0)) throw new Error("primary runtime: invalid metadata");
  const { desktopVersion, platform, arch, payloadDigest } = value;
  const { python, node, pnpm } = versions;
  const pythonPackages = value.pythonPackages === void 0 && legacy ? {} : value.pythonPackages;
  if (typeof desktopVersion !== "string" || desktopVersion.length === 0 || typeof platform !== "string" || !PLATFORMS.includes(platform) || typeof arch !== "string" || !["x64", "arm64"].includes(arch) || !isVersion(python) || node !== void 0 && !isVersion(node) || pnpm !== void 0 && (!isVersion(pnpm) || node === void 0) || payloadDigest !== void 0 && (typeof payloadDigest !== "string" || !/^[a-f0-9]{64}$/u.test(payloadDigest)) || !isDistributionMap(pythonPackages)) throw new Error("primary runtime: invalid metadata");
  const entries = Object.entries(pythonPackages);
  const distributions = new Map(entries.map(([name, version]) => [name.toLowerCase().replace(/[-_.]+/gu, "-"), version]));
  if (distributions.size !== entries.length) throw new Error("primary runtime: invalid metadata");
  if (legacy) for (const name of ["numpy", "pandas"]) {
    if (!isVersion(versions[name])) throw new Error("primary runtime: invalid metadata");
    const version = distributions.get(name);
    if (version !== void 0 && version !== versions[name]) throw new Error(`primary runtime: conflicting ${name} distribution version`);
  }
  return {
    desktopVersion,
    platform,
    arch,
    ...(payloadDigest === void 0 ? {} : { payloadDigest }),
    python,
    ...(node === void 0 ? {} : { node }),
    ...(pnpm === void 0 ? {} : { pnpm }),
    pythonPackages,
  };
}

/**
 * Đọc và chuẩn hoá metadata build mà KHÔNG ghi lại tệp nguồn.
 * Nhận: root — thư mục primary runtime đã cài hoặc đi kèm.
 * Trả: Promise của metadata đã kiểm (phiên bản cấp cao nhất + định danh đích), kể cả manifest legacy `components`.
 * @throws {Error} khi runtime.json không đọc được/không phải JSON hoặc metadata không hợp lệ.
 */
export async function readPrimaryRuntime(root: string): Promise<PrimaryRuntimeManifest> {
  return parsePrimaryRuntime(JSON.parse(await readFile(join(root, "runtime.json"), "utf8")));
}
