/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Duyệt các script phụ thuộc mà pnpm đang chờ trong cấu hình workspace của profile hiện tại: đọc
 *      `pnpm-workspace.yaml` giữ nguyên định dạng, ghi lại tên gói mà lượt chạy THẤT BẠI báo là đã bỏ
 *      qua (`Ignored build scripts`), liệt kê mọi tên còn chờ quyết định, và lưu phê duyệt mà KHÔNG
 *      chạy script — người gọi đang giữ khoá manifest của profile.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isAlias, isMap, isNode, isScalar, parseDocument, visit } from "yaml";
import type { Document } from "yaml";
import { writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { ManagementFailure } from "./failure.ts";

/** Giá trị pnpm để lại cho một build script VẪN CẦN quyết định. */
const UNDECIDED_BUILD = "set this to true or false";

/** Nơi một lượt chạy KHÔNG tương tác nêu tên các build script nó đã bỏ qua. */
const IGNORED_BUILDS = /\bIgnored build scripts: (.+)/;

/**
 * Đọc `pnpm-workspace.yaml` của profile và rút ra các khoá `allowBuilds` cùng tên đang chờ.
 * Nhận: `dir` — thư mục profile hiện tại.
 * Trả: tài liệu YAML đã đọc, tên các gói đang chờ quyết định, và mọi khoá `allowBuilds` hiện có.
 * @throws Lỗi đọc tệp khác `ENOENT`, lỗi phân tích YAML ĐẦU TIÊN, khi gốc không phải YAML mapping,
 *      khi `allowBuilds` không phải YAML mapping, hoặc khi `allowBuilds` chứa anchor/alias YAML.
 */
async function readPolicy(
  dir: string,
): Promise<{ document: Document.Parsed; pending: string[]; keys: string[] }> {
  let text: string;
  try {
    text = await readFile(join(dir, "pnpm-workspace.yaml"), "utf8");
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
    text = "{}\n";
  }
  const document = parseDocument(text);
  if (document.errors[0] !== undefined) throw document.errors[0];
  if (!isMap(document.contents)) throw new Error("pnpm-workspace.yaml must be a YAML mapping");
  const builds = document.get("allowBuilds");
  if (builds !== undefined && !isMap(builds)) throw new Error("allowBuilds must be a YAML mapping");
  visit(builds ?? null, (_key, node) => {
    if (isAlias(node) || (isNode(node) && "anchor" in node && node.anchor)) {
      throw new Error("allowBuilds must not contain YAML anchors or aliases");
    }
  });
  const keys = isMap(builds)
    ? builds.items.flatMap(({ key }) => (isScalar(key) && typeof key.value === "string" ? [key.value] : []))
    : [];
  const pending = isMap(builds)
    ? builds.items.flatMap(({ key, value }) =>
        isScalar(key) && typeof key.value === "string" && !/[*?]/.test(key.value)
          && isScalar(value) && value.value === UNDECIDED_BUILD
          ? [key.value]
          : [],
      )
    : [];
  return { document, pending, keys };
}

/**
 * Ghi lại các build script mà một lượt chạy thất bại báo là bị bỏ qua, rồi liệt kê mọi tên còn chờ
 * quyết định.
 *
 * pnpm chỉ tự ghi các mục policy đó khi nó hỏi được người dùng, mà trình quản lý luôn chạy nó ở chế
 * độ KHÔNG tương tác, nên báo cáo của chính lượt chạy là bản ghi còn lại.
 * Nhận: `dir` — thư mục profile hiện tại; `output` — đầu ra đã bắt của lượt chạy thất bại.
 * Trả: tên gói CHÍNH XÁC còn chờ quyết định build (quy tắc wildcard bị loại); các tên đã ghi được
 *      nối sau danh sách đang chờ có sẵn.
 * @throws Lỗi của `readPolicy` (tệp hỏng hoặc chứa anchor/alias), hoặc lỗi của `writeFileAtomic`
 *      khi ghi `pnpm-workspace.yaml` thất bại.
 */
export async function recordPendingBuilds(dir: string, output: string): Promise<string[]> {
  const { document, pending, keys } = await readPolicy(dir);
  const known = new Set(keys);
  const added = ignoredBuildNames(output).filter((name) => !known.has(name));
  if (added.length === 0) return pending;
  for (const name of added) document.setIn(["allowBuilds", name], UNDECIDED_BUILD);
  await writeFileAtomic(join(dir, "pnpm-workspace.yaml"), String(document), { mode: 0o600 });
  return [...pending, ...added];
}

/**
 * Đọc tên các gói mà một lượt chạy pnpm báo là build script bị bỏ qua.
 * Nhận: `output` — đầu ra đã bắt của lượt chạy.
 * Trả: các tên CHÍNH XÁC theo đúng thứ tự báo cáo; mẫu wildcard bị loại, tên rỗng bị bỏ.
 */
export function ignoredBuildNames(output: string): string[] {
  const reported = IGNORED_BUILDS.exec(output)?.[1];
  if (reported === undefined) return [];
  return reported.split(",").map((name) => name.trim()).filter((name) => name !== "" && !/[*?]/.test(name));
}

/**
 * Lưu phê duyệt mà KHÔNG chạy script; người gọi đang giữ khoá manifest của profile.
 * Nhận: `dir` — thư mục profile hiện tại; `names` — tên gói tường minh lấy từ danh sách build đang chờ.
 * Trả: không; `pnpm-workspace.yaml` được ghi với từng tên đặt `true` (không ghi gì khi `names` rỗng).
 * @throws `ManagementFailure("stale-approval")` khi một tên không còn chờ quyết định, hoặc lỗi của
 *      `readPolicy` khi `allowBuilds` chứa anchor/alias — KHI ĐÓ không phê duyệt nào được ghi.
 */
export async function approveBuilds(dir: string, names: readonly string[]): Promise<void> {
  const { document, pending } = await readPolicy(dir);
  if (names.some((name) => !pending.includes(name))) throw new ManagementFailure("stale-approval");
  if (names.length === 0) return;
  for (const name of names) document.setIn(["allowBuilds", name], true);
  await writeFileAtomic(join(dir, "pnpm-workspace.yaml"), String(document), { mode: 0o600 });
}
