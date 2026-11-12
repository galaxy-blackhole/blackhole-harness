/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mot ban ve Markdown tren van ban chu so huu da tich luy, kem khoi frontmatter
 */

import { markdownBodyStyles as S } from "../class-names.ts";
import type { JsxRuntimeLike, ReactLike } from "../types.ts";
import { markdownImageUrl } from "./path-images.ts";
import { splitFrontmatter } from "./frontmatter.ts";

/** Primitive ma ban ve Markdown dung. */
export interface MarkdownPrimitivesLike {
  /** Khoi van ban Markdown cua DSH. */
  MarkdownText: unknown;
}

/** Props ma than Markdown nhan tu slot. */
export interface MarkdownBodyProps {
  /** Noi dung da doc. */
  content: { kind: string; text?: string; eof?: boolean };
  /** Dia chi tai nguyen cua tai lieu. */
  resourceAddress: string;
  /** Bo doc metadata cua tai nguyen. */
  useResource: (address: string) => { value?: { absolutePath?: string } };
  /** Ham dich cua namespace Markdown. */
  t: (key: string) => string;
}

/** Ham nap chunk danh sach truong frontmatter — build.ts noi vao require.async cua goi. */
export type LoadFrontmatterFields = () => Promise<{ FrontmatterFields: unknown }>;

/**
 * Dung than Markdown.
 * Nhan: runtime — jsx runtime; react — hook cua react; primitives — primitive cua DSH;
 *        loadFields — ham nap chunk danh sach truong frontmatter cua chinh goi nay.
 * Tra: component nhan props cua slot.
 */
export function createMarkdownBody(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  primitives: MarkdownPrimitivesLike,
  loadFields: LoadFrontmatterFields,
): (props: MarkdownBodyProps) => unknown {
  const { jsx, jsxs } = runtime;
  const { useMemo, lazy, Suspense } = react;

  /** Hien nguyen van frontmatter khi chunk danh sach truong khong nap duoc. */
  function FrontmatterFallback({ fallback }: { fallback: unknown }): unknown {
    return fallback;
  }
  const FrontmatterFields = lazy(() => loadFields().then((module) => ({ default: module.FrontmatterFields }), () => ({ default: FrontmatterFallback })));

  /**
   * Boc mot khoi frontmatter va chon danh sach truong hoac nguon nguyen van.
   * Nhan: props — YAML nam giua hai vach ngan.
   * Tra: hop metadata; no tu thu lai khi tai lieu khong co noi dung.
   */
  function FrontmatterBox({ source }: { source: string }): unknown {
    const verbatim = jsx("pre", { className: S.frontmatterSource, children: source });
    return jsx("div", {
      className: S.frontmatter,
      "data-document-frontmatter": true,
      children: jsx(Suspense, { fallback: verbatim, children: jsx(FrontmatterFields, { source, fallback: verbatim }) }),
    });
  }

  return function MarkdownBody({ content, resourceAddress, useResource, t }: MarkdownBodyProps): unknown {
    const absolutePath = useResource(resourceAddress).value?.absolutePath;
    const pathImages = useMemo(() => ({ resolve: (value: string) => markdownImageUrl(document.baseURI, absolutePath, value) }), [absolutePath]);
    const labels = useMemo(() => ({
      code: {
        copyLabel: t("code.copy"),
        copiedLabel: t("code.copied"),
        toolbarLabels: { codeLabel: t("codeBlock.title"), wrapLabel: t("codeBlock.wrap"), unwrapLabel: t("codeBlock.unwrap") },
      },
      footnotes: t("footnotes"),
    }), [t]);
    const text = content.kind === "text" ? (content.text ?? "") : "";
    const split = useMemo(() => splitFrontmatter(text), [text]);
    if (content.kind !== "text") return null;
    return jsxs("div", {
      className: S.document,
      "data-document-markdown": true,
      children: [
        split === undefined ? null : jsx(FrontmatterBox, { source: split.source }),
        jsx(primitives.MarkdownText, { text: split?.body ?? text, streaming: !content.eof, labels, pathImages }),
      ],
    });
  };
}
