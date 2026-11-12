/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build HAI nửa của @galaxy-blackhole/gbh-session-inspector: lib/index.js (node ESM) + lib/client.js
 *      (script classic, MỘT id) — nhận thư mục đích qua process.argv[2] để tầng mount truyền vào.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emitDeclarations } from "../../../tools/typegen/emit-types.ts";
import { assembleBundleFromDisk, ENTRY_FILE_NAME, wrapClientBundle } from "./src/assemble.ts";

/**
 * Gom log của một lần build hỏng thành một dòng.
 * Nhận: result — kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Đọc một file UTF-8 thành chuỗi (khuôn đọc file mà assemble.ts nhận).
 * Nhận: path — đường dẫn file.
 * Trả: nội dung file.
 */
function readText(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Build nửa host: bundle ESM từ src/index.ts ra lib/index.js.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artifact đã ghi.
 */
async function buildHostHalf(out: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!built.success) throw new Error("gbh-session-inspector: build nua host that bai: " + logsOf(built));
  // 05/11/2026 (P1b): sinh .d.ts ngay trong build de khong bi xoa khi build lai.
  emitDeclarations(import.meta.dir);
  return join(out, "index.js");
}

/**
 * Build nửa client theo ba bước, và vì sao phải như vậy:
 *   1. GHEP VĂN BẢN sáu lát nguyên văn (+ module CSS) thành MỘT thân bundle (bundle gốc là một phạm vi hàm
 *      phẳng, các lát tham chiếu tên của nhau — không thể là sáu module ESM).
 *   2. PHÉP KIỂM CÚ PHÁP: ghi thân bundle ra entry TẠM rồi cho Bun.build đọc (browser, cjs). Một lát bị
 *      cắt sai sẽ làm build thất bại NGAY TẠI ĐÂY thay vì làm app trắng lúc boot. Kết quả bundle KHÔNG
 *      được dùng làm artifact — xem lý do ở bước 3.
 *   3. ARTIFACT là thân bundle NGUYÊN VĂN, chỉ bọc thêm IIFE + lời gọi load. ⚠️ KHÔNG giao thân bundle
 *      cho bộ biến đổi của Bun: nó GỠ BÌNH LUẬN và ĐỔI THỤT LỀ (tab ⇒ space), tức làm mất bằng chứng
 *      đối chứng TỪNG BYTE với bản gốc. Bản gốc cũng chạy nguyên văn trong trình duyệt.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artifact đã ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  const body = assembleBundleFromDisk(join(import.meta.dir, "src"), readText);
  const entryPath = join(out, ENTRY_FILE_NAME);
  writeFileSync(entryPath, body + String.fromCharCode(10));
  const built = await Bun.build({
    entrypoints: [entryPath],
    target: "browser",
    format: "cjs",
    write: false,
    packages: "external",
    // write khong nam trong kieu BuildConfig cua ban Bun nay ⇒ ep kieu nhu cordis-client-runner.
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("gbh-session-inspector: build nua client that bai: " + logsOf(built));
  if (built.outputs[0] === undefined) throw new Error("gbh-session-inspector: build nua client khong sinh output nao");
  rmSync(entryPath, { force: true });
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(body));
  return target;
}

/**
 * Build trọn gói: ghi cả HAI nửa vào outDir (hoặc lib/ của chính gói nếu không truyền).
 *
 * ⚠️ PHẢI nhận outDir qua tham số dòng lệnh — apps/cli/src/mount.ts gọi
 *   buildIfStale(pkg, join(dir, 'lib')) với thư mục đích là BẢN MOUNT trong profile. Hard-code
 *   join(import.meta.dir, 'lib') thì mount build ra lib/ của repo rồi chỉ ghi được package.json vào
 *   profile ⇒ profile THIẾU lib/ ⇒ tầng nạp không sinh entry, mà mọi phép kiểm khác đều xanh.
 * Nhận: outDir — thư mục đích (tuỳ chọn).
 * Trả: { host, client } — đường dẫn hai artifact đã ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}
