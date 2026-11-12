/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chia trang da doc thanh cac dong nguon, sap thu tu va cuon toi mot dong
 */

/** Mot trang van ban da doc tu Host. */
export interface LoadedPage {
  /** Dong nguon bat dau (1-based). */
  offset: number;
  /** Van ban cua trang. */
  text: string;
  /** So dong cua trang. */
  lines: number;
}

/**
 * Chia mot trang da doc thanh cac dong nguon cua no.
 * Nhan: page — trang nguon.
 * Tra: cac dong, giu mot dong trong nhung bo qua trang khong co dong nao.
 */
export function linesOf(page: { lines: number; text: string }): string[] {
  return page.lines === 0 ? [] : page.text.split("\n");
}

/**
 * Sap cac trang da doc theo vi tri trong nguon.
 * Nhan: pages — bang trang da luu, khoa theo offset.
 * Tra: cac trang theo thu tu nguon.
 */
export function loadedPages(pages: Record<string, { text: string; lines: number }>): LoadedPage[] {
  return Object.entries(pages).map(([offset, page]) => ({ offset: Number(offset), ...page })).sort((left, right) => left.offset - right.offset);
}

/**
 * Tim cuoi cua doan nguon da doc.
 * Nhan: pages — cac trang da sap thu tu.
 * Tra: dong nguon cuoi cung da doc, hoac 0.
 */
export function lastLineLoaded(pages: readonly LoadedPage[]): number {
  const last = pages.at(-1);
  return last === undefined ? 0 : last.offset + last.lines - 1;
}

/**
 * Dua mot dong nguon van ban thuong hoac da to mau vao tam nhin.
 * Nhan: body — than dang cuon hoac khung noi dung ma; line — dong nguon 1-based can hien.
 * Tra: renderer hien tai co lo dong do khong.
 */
export function scrollToLine(body: HTMLElement, line: number): boolean {
  const innerCode = body.hasAttribute("data-code-block-content");
  const plain = body.querySelector('[data-textpreview-line="' + line + '"]');
  const code = innerCode ? body.querySelectorAll("pre .line").item(line - 1) : null;
  const row = plain ?? code;
  if (!(row instanceof HTMLElement)) return false;
  body.scrollTop = Math.max(0, row.offsetTop);
  return true;
}
