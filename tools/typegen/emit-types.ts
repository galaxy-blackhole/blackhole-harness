/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 05/11/2026
 * desc Sinh khai báo kiểu (.d.ts) cho một gói bằng API TypeScript (không cần binary `tsc`, chạy được trong Bun).
 *      Chỉ dùng cho gói KHÔNG de-bundle — gói de-bundle phải port `.d.ts` từ bản gốc (luật #17).
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

/** Cờ compiler phải KHỚP cổng typecheck để khai báo sinh ra không lệch. */
const COMPILER_OPTIONS: ts.CompilerOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  noEmit: false,
  allowImportingTsExtensions: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2023,
  strict: true,
  skipLibCheck: true,
  noUncheckedIndexedAccess: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  jsx: ts.JsxEmit.ReactJSX,
  types: ["bun"],
};

/**
 * Sinh `lib/types/*.d.ts` cho gói từ `src/index.ts`.
 * Nhận: pkgDir — thư mục gói (chứa `src/` và `lib/`).
 * Trả: đường dẫn `index.d.ts` khi sinh được, `null` khi gói chưa có `src/index.ts`.
 */
export function emitDeclarations(pkgDir: string): string | null {
  const entry = join(pkgDir, "src", "index.ts");
  if (!existsSync(entry)) return null;
  const outDir = resolve(pkgDir, "lib", "types");
  const program = ts.createProgram([resolve(entry)], {
    ...COMPILER_OPTIONS,
    rootDir: resolve(pkgDir, "src"),
    outDir,
  });
  program.emit(undefined, undefined, undefined, true);
  const dts = join(outDir, "index.d.ts");
  return existsSync(dts) ? dts : null;
}

