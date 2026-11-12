/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tach khoi YAML frontmatter o dau tai lieu Markdown truoc khi phan tich Markdown
 */

/** Bieu thuc nhan dang khoi frontmatter o dau tai lieu — nguyen van ban goc. */
export const FRONTMATTER = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)??(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/u;

/** Ket qua tach frontmatter. */
export interface SplitFrontmatter {
  /** Nguon YAML nam giua hai vach ngan. */
  source: string;
  /** Phan than con lai cua tai lieu. */
  body: string;
}

/**
 * Tach khoi YAML frontmatter o dau tai lieu ma khong phan tich YAML cua no.
 * Nhan: text — nguon Markdown; khoi khong dong lai thi khong tinh la frontmatter.
 * Tra: nguon frontmatter va phan than con lai, hoac undefined khi khong co.
 */
export function splitFrontmatter(text: string): SplitFrontmatter | undefined {
  const match = FRONTMATTER.exec(text);
  if (match === null) return undefined;
  return { source: match[1] ?? "", body: text.slice(match[0].length) };
}
