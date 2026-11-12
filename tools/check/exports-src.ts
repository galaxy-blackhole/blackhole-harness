/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cổng đích RUNTIME của exports: mọi đích thực thi (default/chuỗi) KHÔNG được trỏ vào ./src/*.ts —
 *      bản mount chỉ ship lib/ + locale/ + package.json nên đích src gây ERR_MODULE_NOT_FOUND (lớp lỗi 404
 *      08/11/2026: gbh-session/fork ⇒ sessionController không activate). Tầng KIỂU (types) được phép trỏ src.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo, suy từ vị trí tệp (tools/check → ../..). */
const REPO_ROOT = join(import.meta.dir, "..", "..");
/** Tầng chứa gói GBH (mỗi tầng là thư mục con của packages/). */
const CAC_TANG = ["host", "client", "tools"];
/** Tầng CÓ THỂ bị mount vào profile ⇒ chỉ tầng này mới làm cổng đỏ; `tools` chỉ chạy bằng bun từ repo. */
const TANG_MOUNT_DUOC = new Set(["host", "client"]);

/** Một đích runtime trỏ vào mã nguồn TypeScript. */
interface DichSrc {
  /** Tầng/gói, dạng "host/session". */
  goi: string;
  /** Khoá exports, ví dụ "./fork". */
  khoa: string;
  /** Đích đang trỏ vào src, ví dụ "./src/fork.ts". */
  dich: string;
}

/**
 * Liệt kê đích RUNTIME của một giá trị exports (bỏ qua khoá pattern chứa "*").
 * Nhận: giá trị exports (chuỗi, mảng hoặc object điều kiện). Trả: các đích thực thi.
 * @param giaTri - giá trị exports của một khoá.
 * @returns danh sách đích runtime (chuỗi bắt đầu bằng "./").
 */
function dichRuntime(giaTri: unknown): string[] {
  if (typeof giaTri === "string") return giaTri.includes("*") ? [] : [giaTri];
  if (Array.isArray(giaTri)) return giaTri.flatMap((v) => dichRuntime(v));
  if (giaTri && typeof giaTri === "object") {
    const o = giaTri as Record<string, unknown>;
    const out: string[] = [];
    if (typeof o.default === "string" && !o.default.includes("*")) out.push(o.default);
    if (o.import !== undefined) out.push(...dichRuntime(o.import));
    if (o.require !== undefined) out.push(...dichRuntime(o.require));
    return out;
  }
  return [];
}

/**
 * Quét mọi gói trong packages/ tìm đích RUNTIME trỏ vào ./src/*.ts.
 * Nhận: không. Trả: danh sách vi phạm (rỗng nghĩa là đạt).
 * @returns các đích runtime cần sửa.
 */
export function timDichRuntimeSrc(): DichSrc[] {
  const hong: DichSrc[] = [];
  for (const tang of CAC_TANG) {
    const dirTang = join(REPO_ROOT, "packages", tang);
    if (!existsSync(dirTang)) continue;
    for (const ten of readdirSync(dirTang).sort()) {
      const p = join(dirTang, ten, "package.json");
      if (!existsSync(p) || !statSync(p).isFile()) continue;
      const j = JSON.parse(readFileSync(p, "utf8")) as { exports?: Record<string, unknown> };
      for (const [khoa, giaTri] of Object.entries(j.exports ?? {})) {
        if (khoa.includes("*")) continue;
        for (const dich of dichRuntime(giaTri)) if (dich.includes("/src/")) hong.push({ goi: tang + "/" + ten, khoa, dich });
      }
    }
  }
  return hong;
}

/**
 * Chạy cổng và in kết quả; trả mã thoát (0 đạt, 1 hỏng).
 * Nhận: không. Trả: mã thoát của tiến trình.
 * @returns 0 khi không còn đích runtime trỏ src.
 */
export function runCli(): number {
  const hong = timDichRuntimeSrc();
  const nang = hong.filter((h) => TANG_MOUNT_DUOC.has(h.goi.split("/")[0] ?? ""));
  const nhe = hong.filter((h) => !TANG_MOUNT_DUOC.has(h.goi.split("/")[0] ?? ""));
  for (const h of nhe) console.log("INFO " + h.goi + "  " + h.khoa + " -> " + h.dich + "  (tầng tools: không mount ⇒ không chặn)");
  if (nang.length === 0) {
    console.log("OK   exports-runtime · 0 đích runtime trỏ ./src/*.ts ở tầng có thể mount" + (nhe.length > 0 ? " · " + nhe.length + " INFO ở tầng tools" : ""));
    return 0;
  }
  for (const h of nang) console.log("FAIL " + h.goi + "  " + h.khoa + " -> " + h.dich);
  console.log("[FAIL exports-runtime · " + nang.length + " đích runtime trỏ ./src/*.ts]");
  return 1;
}

if (import.meta.main) process.exit(runCli());
