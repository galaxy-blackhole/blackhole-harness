/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chỉ nạp chunk xterm sau khi thân terminal thật sự được mount
 */

import type { JsxRuntimeLike, ReactLike } from "./types.ts";

/** Hàm nạp một chunk của bộ nạp. */
export type RequireAsync = (path: string) => Promise<Record<string, unknown>>;

/** Hình dạng chunk terminal sau khi nạp. */
export interface TerminalChunk {
  /** Thân terminal. */
  TerminalBody?: unknown;
}

/**
 * Dựng LazyTerminalBody: chờ chunk terminal rồi hiện thân terminal.
 * Nhận: jsx runtime, module react và hàm nạp chunk của bộ nạp.
 * Trả: component nhận props của khe cắm và chuyển nguyên cho thân terminal.
 */
export function createLazyTerminalBody(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  requireAsync: RequireAsync,
): (props: Record<string, unknown>) => unknown {
  const { jsx } = runtime;
  const Loaded = react.lazy(async (): Promise<{ default: unknown }> => {
    const chunk = (await requireAsync("./" + "client.terminal.js")) as TerminalChunk;
    return { default: chunk.TerminalBody };
  });
  return (props: Record<string, unknown>): unknown =>
    jsx(react.Suspense, { fallback: null, children: jsx(Loaded, { ...props }) });
}
