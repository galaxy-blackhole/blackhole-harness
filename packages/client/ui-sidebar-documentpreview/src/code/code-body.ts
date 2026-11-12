/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Than xem ma nguon: mot CodeBlock on dinh, hoac khong ve gi voi noi dung byte
 */

import { codeBodyStyles as S } from "../class-names.ts";
import { parseFileAddress } from "../workspace-path.ts";
import type { JsxRuntimeLike } from "../types.ts";

/** Primitive ma than xem ma nguon dung. */
export interface CodePrimitivesLike {
  /** Khoi ma nguon cua DSH. */
  CodeBlock: unknown;
  /** Doan ngon ngu theo duong dan. */
  languageForPath(path: string): string;
  /** Cac hau to ma khoi ma nguon to mau duoc — nguyen van tu primitive cua ban goc. */
  CODE_HIGHLIGHT_EXTENSIONS: readonly string[];
}

/** Props ma than xem ma nguon nhan tu slot. */
export interface CodeBodyProps {
  /** Dia chi tai nguyen cua tai lieu. */
  resourceAddress: string;
  /** Noi dung da doc. */
  content: { kind: string; text?: string; eof?: boolean };
  /** Co ngat dong khong. */
  wrap: boolean;
  /** Tra ve khung cuon cho chu so huu. */
  scrollportRef(node: HTMLElement | null): void;
  /** Ham dich cua namespace ban xem ma nguon. */
  t: (key: string) => string;
}

/**
 * Dung than xem ma nguon.
 * Nhan: runtime — jsx runtime cua trang; primitives — primitive cua DSH.
 * Tra: component nhan props cua slot.
 */
export function createCodeBody(runtime: JsxRuntimeLike, primitives: CodePrimitivesLike): (props: CodeBodyProps) => unknown {
  const { jsx } = runtime;
  return function CodeBody({ resourceAddress, content, wrap, scrollportRef, t }: CodeBodyProps): unknown {
    if (content.kind !== "text") return null;
    const file = parseFileAddress(resourceAddress);
    if (file === undefined) throw new Error('ui-sidebar-documentpreview: not a file address "' + resourceAddress + '"');
    const language = primitives.languageForPath(file.path);
    return jsx("div", {
      className: S.renderer,
      "data-code-preview": true,
      "data-wrap": wrap,
      children: jsx(primitives.CodeBlock, {
        className: S.code,
        contentRef: scrollportRef,
        code: content.text,
        lang: language,
        streaming: !content.eof,
        wrap,
        lineNumbers: true,
        copyLabel: t("copy"),
        copiedLabel: t("copied"),
        toolbarLabels: { codeLabel: t("codeBlock.title"), wrapLabel: t("codeBlock.wrap"), unwrapLabel: t("codeBlock.unwrap") },
      }),
    });
  };
}
