/*
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 12/11/2026
 desc Sinh .d.ts cho mot goi tu TAT CA tep trong src (khong chi src/index.ts).
      Vi sao sua 12/11/2026: khi thay the lib/types, phai GIU cac tep RUNTIME (.js do build.ts cua goi day vao
      cho subpath exports) — truoc day rmSync xoa luon chung nen cong exports-targets do 5 vi pham / 2 goi.
*/

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Kết quả sinh kiểu cho một gói. */
export interface TypeGenResult {
  /** Thư mục gói (tương đối từ gốc repo). */
  dir: string;
  /** Sinh được? */
  ok: boolean;
  /** Thông điệp lỗi đầu tiên nếu hỏng. */
  error?: string;
}

/**
 * Đường dẫn của một MẢNH DE-BUNDLE (lát nguyên văn, không phải module) — dùng CHUNG quy ước với cổng
 * `typecheck` (`tools/lint/gate.ts` → `FRAGMENT_PATH`, ADR 0008).
 * Vì sao cần ở đây (08/11/2026, dev-1 phát hiện): mảnh bị cắt NGANG ranh giới cú pháp nên `tsc` báo
 * TS1005/TS1128, mà `// @ts-nocheck` KHÔNG tắt được lỗi cú pháp ⇒ `gen-types` hỏng cho cả gói
 * (`host/subagent`: `typert-host-slice-a/b.ts` ⇒ ok:0/failed:1 ⇒ gói mất `lib/types` ⇒ consumer TS7016).
 */
const FRAGMENT_PATH = /\/(?:src\/parts\/[^/]+|src\/parts-[a-z0-9-]+\/[^/]+|src\/client-parts\/[^/]+|src\/[^/]+-slice(?:-[a-z0-9]+)?)\.tsx?$/;

/**
 * Có phải TỆP MẢNH DE-BUNDLE hay không (chỉ miễn khi gói có `build.ts` — bằng chứng pipeline artefact tồn tại).
 * @param abs đường dẫn của tệp nguồn.
 * @returns true khi tệp là mảnh de-bundle của gói có `build.ts`.
 */
function isFragmentPath(abs: string): boolean {
  if (!FRAGMENT_PATH.test(abs)) return false;
  let dir = abs;
  for (let i = 0; i < 6; i += 1) {
    dir = dirname(dir);
    if (existsSync(join(dir, "build.ts"))) return true;
  }
  return false;
}

/**
 * Liệt kê mọi tệp `.ts` dưới một thư mục, dạng đường dẫn TƯƠNG ĐỐI so với thư mục gói.
 * @param root thư mục gốc cần quét.
 * @param dir thư mục hiện tại (đệ quy).
 * @returns danh sách đường dẫn tương đối.
 */
function listSources(root: string, dir = root): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSources(root, path));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") && !isFragmentPath(path)) out.push(path.slice(root.length + 1));
  }
  return out;
}

/**
 * Sinh thư mục kiểu `lib/types` cho một gói bằng cách biên dịch TOÀN BỘ tệp `.ts` trong `src`.
 *
 * Vì sao phải là TOÀN BỘ: các khối `declare module "…"` (augmentation dịch vụ) thường nằm ở tệp
 * KHÔNG được `src/index.ts` nhập tới. Nếu chỉ biên dịch `src/index.ts`, `.d.ts` sinh ra thiếu
 * augmentation ⇒ gói tiêu thụ báo `Property 'webServer' does not exist on type 'Context'` (đo 03/11/2026).
 * @param repo gốc repo.
 * @param dir thư mục gói (tương đối từ gốc repo).
 * @returns kết quả sinh kiểu.
 */
export function genTypes(repo: string, dir: string): TypeGenResult {
  const pkg = join(repo, dir);
  const src = join(pkg, "src");
  if (!existsSync(src)) return { dir, ok: false, error: "khong co src" };
  const files = listSources(src).map((one) => join("src", one));
  if (files.length === 0) return { dir, ok: false, error: "src rong" };
  // 08/11/2026 — KHÔNG xoá bản cũ trước khi emit: nếu tsc lỗi (đo được TS2742 ở account-platform/agent-loop)
  //   thì bản cũ phải còn nguyên, nếu không gói mất khai kiểu ⇒ consumer gập kiểu. Emit vào thư mục tạm rồi
  //   chỉ thay thế khi thành công.
  const tam = join(pkg, "lib", ".types-tmp");
  rmSync(tam, { recursive: true, force: true });
  // 12/11/2026 (cong exports-targets do 5 vi pham / 2 goi): `lib/types` KHONG chi chua `.d.ts` — `build.ts` cua
  //   goi con day RUNTIME `.js` cua cac subpath exports vao do (session: types/fork/surface;
  //   agent-preset-registry: types/display). `rmSync(dich)` doi cu xoa luon cac `.js` ay ⇒ exports["./fork"]
  //   tro tep KHONG ton tai ⇒ ban mount (chi copy lib/) no ERR_MODULE_NOT_FOUND. Nay: chup lai MOI tep khong
  //   phai `.d.ts` truoc khi thay thu muc, roi khoi phuc ngay sau `renameSync` ⇒ hai loai artefact cung song.
  const giu = join(pkg, "lib", ".types-keep");
  rmSync(giu, { recursive: true, force: true });
  const tsc = join(repo, "node_modules", "typescript", "lib", "tsc.js");
  try {
    execFileSync(process.execPath, [tsc, "--emitDeclarationOnly", "--declaration", "--outDir", "lib/.types-tmp",
      "--rootDir", "src", "--module", "esnext", "--moduleResolution", "bundler", "--target", "es2023",
      "--skipLibCheck", "--strict", "--allowImportingTsExtensions", ...files], { cwd: pkg, stdio: "pipe" });
    // 08/11/2026 — SỰ CỐ THẬT: hàm này từng chỉ emit vào `lib/.types-tmp` rồi trả ok, KHÔNG chuyển sang
    //   `lib/types` ⇒ người chạy tưởng đã sinh xong nhưng consumer vẫn đọc bản CŨ (hoặc không có gì).
    //   Nay: thay thế `lib/types` bằng bản mới RỒI mới sinh barrel tái xuất mọi module (giữ augmentation
    //   `declare module` và tên kiểu ở entry), sau đó mới báo ok.
    const dich = join(pkg, "lib", "types");
    const coRuntime = existsSync(dich);
    if (coRuntime) {
      mkdirSync(giu, { recursive: true });
      for (const ten of readdirSync(dich)) {
        if (ten.endsWith(".d.ts")) continue;
        cpSync(join(dich, ten), join(giu, ten), { recursive: true });
      }
    }
    rmSync(dich, { recursive: true, force: true });
    renameSync(tam, dich);
    if (coRuntime) {
      for (const ten of readdirSync(giu)) cpSync(join(giu, ten), join(dich, ten), { recursive: true });
    }
    const daSinh = readdirSync(dich).filter((x) => x.endsWith(".d.ts") && x !== "index.d.ts");
    // 08/11/2026 — SỰ CỐ THẬT (dev-1 đo được): nếu GHI ĐÈ index.d.ts bằng barrel thì mất khai báo của entry
    //   (ví dụ `declare class SubagentRuntime`) ⇒ consumer gãy TS2724. Nay GIỮ nguyên nội dung index.d.ts mà
    //   tsc vừa emit, chỉ NỐI thêm các dòng tái xuất module khác (barrel) — nhờ vậy augmentation và tên kiểu
    //   ở entry đều sống, đồng thời mọi module vẫn được nạp.
    if (daSinh.length > 0) {
      const tepIndex = join(dich, "index.d.ts");
      const goc = existsSync(tepIndex) ? readFileSync(tepIndex, "utf8").trimEnd() : "";
      const dong = daSinh
        .map((x) => x.replace(/\.d\.ts$/u, ".js"))
        .sort()
        .flatMap((x) => ['import "./' + x + '";', 'export * from "./' + x + '";']);
      writeFileSync(tepIndex, (goc.length > 0 ? goc + "\n\n" : "") + dong.join("\n") + "\n");
    }
    return { dir, ok: true };
  } catch (error) {
    const err = error as { stderr?: Buffer; stdout?: Buffer };
    const raw = String(err.stderr ?? "") + String(err.stdout ?? "");
    return { dir, ok: false, error: raw.split("\n").slice(0, 2).join(" ").slice(0, 200) };
  } finally {
    // 12/11/2026: thư mục chụp runtime chỉ là trung chuyển — luôn dọn, kể cả khi tsc hỏng.
    rmSync(giu, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const repo = process.cwd();
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.log("dung: bun run tools/gen-types.ts <thu-muc-goi> …");
    process.exit(1);
  }
  let ok = 0;
  let failed = 0;
  for (const dir of targets) {
    const result = genTypes(repo, dir);
    if (result.ok) ok += 1;
    else {
      failed += 1;
      console.log("FAIL " + dir + ": " + String(result.error));
    }
  }
  console.log(JSON.stringify({ ok, failed }));
  process.exit(failed === 0 ? 0 : 1);
}