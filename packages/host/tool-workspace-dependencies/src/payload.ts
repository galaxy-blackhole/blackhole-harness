/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Đường dẫn + sao chép payload của tool-workspace-dependencies, chép nguyên văn bundle gốc:
 *      primaryRuntimePythonAliases · copyPrimaryRuntime · workspaceDependencyPaths · validatePayloadEntries · exists.
 */

import { cp, lstat, readlink, stat, symlink } from "node:fs/promises";
import { join } from "node:path";

import type { PrimaryRuntimeManifest, WorkspaceDependencies } from "./types.ts";

/**
 * Đọc mã errno của một giá trị bị ném, không làm thay đổi hành vi gốc (gốc đọc `error.code` trần).
 * Nhận: error — giá trị bắt được trong `catch`.
 * Trả: mã lỗi dạng chuỗi, hoặc undefined khi giá trị không mang `code` chuỗi.
 */
function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Nhận diện alias trình thông dịch POSIX có thể sống sót qua lần di chuyển payload.
 * NGUYÊN VĂN thân hàm của bundle gốc.
 * Nhận: root — thư mục payload; manifest — metadata payload đã kiểm.
 * Trả: Promise của Map đường dẫn alias TƯƠNG ĐỐI → tên tệp trình thông dịch cùng thư mục; tệp lệnh thường bị bỏ qua.
 * @throws {Error} khi alias trình thông dịch không trỏ TRỰC TIẾP tới tệp thường có phiên bản.
 */
export async function primaryRuntimePythonAliases(root: string, manifest: PrimaryRuntimeManifest): Promise<ReadonlyMap<string, string>> {
  const aliases = new Map<string, string>();
  if (manifest.platform === "win32") return aliases;
  const interpreter = `python${manifest.python.split(".").slice(0, 2).join(".")}`;
  for (const name of ["python", "python3"]) {
    const path = `dependencies/python/bin/${name}`;
    let entry;
    try {
      entry = await lstat(join(root, path));
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      throw error;
    }
    if (!entry.isSymbolicLink()) continue;
    if (await readlink(join(root, path)) !== interpreter || !(await lstat(join(root, "dependencies/python/bin", interpreter))).isFile()) throw new Error(`primary runtime: invalid Python alias ${path}`);
    aliases.set(path, interpreter);
  }
  return aliases;
}

/**
 * Sao chép payload, CHỈ giữ lại các alias trình thông dịch Python đã kiểm dưới dạng liên kết tương đối.
 * NGUYÊN VĂN thân hàm của bundle gốc.
 * Nhận: source — thư mục payload (mọi liên kết khác bị vật chất hoá); destination — đích rỗng do bên gọi sở hữu; manifest — metadata nguồn đã kiểm.
 * Trả: Promise hoàn tất khi mọi tệp đã chép và mọi alias đã có, độc lập với nguồn.
 */
export async function copyPrimaryRuntime(source: string, destination: string, manifest: PrimaryRuntimeManifest): Promise<void> {
  const aliases = await primaryRuntimePythonAliases(source, manifest);
  const excluded = new Set([...aliases.keys()].map((path) => join(source, path)));
  await cp(source, destination, {
    recursive: true,
    dereference: true,
    filter: (path) => !excluded.has(path),
  });
  for (const [path, target] of aliases) await symlink(target, join(destination, path));
}

/**
 * Giải vị trí trình thông dịch + thư viện theo nền tảng mà KHÔNG đổi môi trường.
 * NGUYÊN VĂN thân hàm của bundle gốc — cùng thứ tự khoá và cùng quy tắc win32.
 * Nhận: root — thư mục payload hoặc thư mục cài tuyệt đối; manifest — metadata runtime đã kiểm.
 * Trả: đường dẫn tuyệt đối để chạy script tường minh + phiên bản distribution Python đã ghi.
 */
export function workspaceDependencyPaths(root: string, manifest: PrimaryRuntimeManifest): WorkspaceDependencies {
  const dependencies = join(root, "dependencies");
  const windows = manifest.platform === "win32";
  const node = manifest.node === void 0 ? {} : {
    node: join(dependencies, "node", "bin", windows ? "node.exe" : "node"),
    nodePackages: join(dependencies, "node", "node_modules"),
  };
  const pnpm = manifest.pnpm === void 0 ? {} : { pnpm: join(dependencies, "pnpm", "bin", "pnpm.mjs") };
  return {
    python: join(dependencies, "python", ...(windows ? ["python.exe"] : ["bin", "python3"])),
    ...node,
    ...pnpm,
    pythonPackages: join(dependencies, "python", ...(windows ? ["Lib"] : ["lib", `python${manifest.python.split(".").slice(0, 2).join(".")}`]), "site-packages"),
    pythonDistributions: manifest.pythonPackages,
  };
}

/**
 * Kiểm từng điểm vào đã giải có đúng loại tệp/thư mục như metadata khai.
 * NGUYÊN VĂN thân hàm của bundle gốc (bỏ qua trường vắng).
 * Nhận: paths — kết quả của `workspaceDependencyPaths`.
 * Trả: Promise hoàn tất khi mọi điểm vào có mặt và đúng loại.
 * @throws {Error} khi một điểm vào không đúng loại: "primary runtime: expected <kind> at <path>".
 */
export async function validatePayloadEntries(paths: WorkspaceDependencies): Promise<void> {
  for (const [path, kind] of [
    [paths.python, "file"],
    [paths.node, "file"],
    [paths.pnpm, "file"],
    [paths.pythonPackages, "directory"],
    [paths.nodePackages, "directory"],
  ] as [string | undefined, "file" | "directory"][]) {
    if (path === void 0) continue;
    const entry = await stat(path);
    if (!(kind === "file" ? entry.isFile() : entry.isDirectory())) throw new Error(`primary runtime: expected ${kind} at ${path}`);
  }
}

/**
 * Kiểm một đường dẫn có tồn tại và KHÔNG phải liên kết hệ thống tệp.
 * NGUYÊN VĂN thân hàm của bundle gốc.
 * Nhận: path — đường dẫn cần kiểm.
 * Trả: Promise true khi tồn tại; false khi ENOENT.
 * @throws {Error} khi đường dẫn là liên kết: "primary runtime: installation path is a filesystem link: <path>".
 */
export async function exists(path: string): Promise<boolean> {
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error(`primary runtime: installation path is a filesystem link: ${path}`);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw error;
  }
}
