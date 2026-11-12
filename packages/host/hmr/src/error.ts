/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chan doan loi build cua HMR: in code frame khi co vi tri nguon (tu viet, KHONG dung @babel/code-frame).
 */
import { readFileSync } from "node:fs";

/** Mot muc loi cua build failure (dung hinh dang ma loader/compiler nem). */
interface BuildError {
  /** Thong diep cua muc loi. */
  readonly text: string;
  /** Vi tri nguon, khi co. */
  readonly location?: { readonly file: string; readonly line: number; readonly column: number };
}

/**
 * Nhan dien hinh dang build failure ma ban goc xu ly rieng: object co `errors` la mang cac muc `{ text }`.
 * @param e - gia tri bat duoc tu loader/compiler.
 * @returns `true` khi dung hinh dang do.
 */
export function isBuildFailure(e: unknown): e is { errors: BuildError[] } {
  return (
    e !== null &&
    typeof e === "object" &&
    "errors" in e &&
    Array.isArray((e as { errors: unknown }).errors) &&
    (e as { errors: unknown[] }).errors.every(
      (error) => error !== null && typeof error === "object" && "text" in error && typeof (error as { text: unknown }).text === "string",
    )
  );
}

/**
 * Dung mot code frame toi gian quanh vi tri loi: dong truoc · dong loi (co cot) · dong sau.
 * Thay cho `codeFrameColumns` cua ban goc — cung thong tin (so dong + cot + thong diep), khong to mau.
 * @param source - noi dung tep nguon.
 * @param location - vi tri 1-based cua loi.
 * @param message - thong diep cua muc loi.
 * @returns Van ban nhieu dong de ghi log.
 */
export function renderCodeFrame(source: string, location: { line: number; column: number }, message: string): string {
  const lines = source.split(/\r?\n/);
  const first = Math.max(1, location.line - 1);
  const last = Math.min(lines.length, location.line + 1);
  const width = String(last).length;
  const body: string[] = [];
  for (let number = first; number <= last; number++) {
    const marker = number === location.line ? ">" : " ";
    body.push(`${marker} ${String(number).padStart(width)} | ${lines[number - 1] ?? ""}`);
    if (number === location.line) body.push(`  ${" ".repeat(width)} | ${" ".repeat(Math.max(0, location.column - 1))}^`);
  }
  return `${message}\n${body.join("\n")}`;
}

/**
 * Ghi chan doan cho mot lan reload that bai: build failure co vi tri thi in code frame, con lai in nguyen loi.
 * @param ctx - context so huu chan doan (chi dung `logger.warn`).
 * @param e - loi tu loader hoac compiler.
 */
export function handleError(ctx: { readonly logger: { warn(...args: unknown[]): void } }, e: unknown): void {
  if (!isBuildFailure(e)) {
    ctx.logger.warn(e);
    return;
  }
  for (const error of e.errors) {
    if (!error.location) {
      ctx.logger.warn(error.text);
      continue;
    }
    try {
      const { file, line, column } = error.location;
      const formatted = renderCodeFrame(readFileSync(file, "utf8"), { line, column }, error.text);
      ctx.logger.warn(`File: ${file}:${line}:${column}\n` + formatted);
    } catch (reason) {
      ctx.logger.warn(reason);
    }
  }
}
