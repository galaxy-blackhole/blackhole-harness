/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tiêu đề tab terminal: đổi tên tại chỗ khi bấm đúp vào chip của dockkit
 */

import { TITLE_CLASS } from "./title-css.ts";
import { createTerminalIcon } from "./terminal-icon.ts";
import type { TerminalTranslate } from "./locales.ts";
import type { JsxRuntimeLike, ReactLike } from "./types.ts";

/** Props mà khe cắm bơm cho tiêu đề tab. */
export interface TerminalTitleProps {
  /** Thông tin tab đang mở. */
  useTabInfo: () => { tab: { id: string; title?: string } };
  /** Hook đọc trạng thái terminal theo tab. */
  useTerminal: (key: string, selector: (state: { info?: { title?: string }; title?: string } | undefined) => string | undefined) => string | undefined;
  /** Lấy view điều khiển terminal của một tab. */
  view: (key: string) => { rename(title: string): void };
  /** Hàm đọc từ điển đã bind namespace. */
  t: TerminalTranslate;
}

/**
 * Dựng tiêu đề tab terminal.
 * Nhận: jsx runtime và module react.
 * Trả: component nhận props của khe cắm.
 */
export function createTerminalTitle(
  runtime: JsxRuntimeLike,
  react: ReactLike,
): (props: TerminalTitleProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;
  const TerminalIcon = createTerminalIcon(runtime);
  return (props: TerminalTitleProps): unknown => {
    const { tab } = props.useTabInfo();
    const title = props.useTerminal(tab.id, (state) => state?.info?.title ?? state?.title) ?? tab.title;
    const [editing, setEditing] = react.useState(false);
    const input = react.useRef<HTMLInputElement | null>(null);
    const label = react.useRef<HTMLElement | null>(null);
    const cancelled = react.useRef(false);
    react.useLayoutEffect(() => {
      if (editing) return undefined;
      const chip = label.current?.closest("[data-dockkit-tab], [data-dockkit-float-grip]");
      const rename = (event: Event): void => {
        event.stopPropagation();
        cancelled.current = false;
        setEditing(true);
      };
      chip?.addEventListener("dblclick", rename);
      return () => {
        chip?.removeEventListener("dblclick", rename);
      };
    }, [editing]);
    react.useLayoutEffect(() => {
      if (!editing) return;
      input.current?.focus();
      input.current?.select();
    }, [editing]);
    return jsxs(Fragment, {
      children: [
        jsx(TerminalIcon, {}),
        editing
          ? jsx("input", {
              ref: input,
              className: TITLE_CLASS.name,
              defaultValue: title,
              maxLength: 120,
              "aria-label": props.t("rename"),
              onPointerDown: (event: Event) => {
                event.stopPropagation();
              },
              onClick: (event: Event) => {
                event.stopPropagation();
              },
              onDoubleClick: (event: Event) => {
                event.stopPropagation();
              },
              onBlur: (event: { currentTarget: HTMLInputElement }) => {
                setEditing(false);
                const next = event.currentTarget.value.trim();
                if (!cancelled.current && next !== "" && next !== title) props.view(tab.id).rename(next);
              },
              onKeyDown: (event: { nativeEvent: { isComposing?: boolean; keyCode?: number }; key: string; currentTarget: HTMLInputElement; stopPropagation(): void }) => {
                event.stopPropagation();
                if (event.nativeEvent.isComposing === true || event.nativeEvent.keyCode === 229) return;
                if (event.key === "Escape") {
                  cancelled.current = true;
                  event.currentTarget.blur();
                } else if (event.key === "Enter") event.currentTarget.blur();
              },
            })
          : jsx("span", { ref: label, className: TITLE_CLASS.title, children: title }),
      ],
    });
  };
}
