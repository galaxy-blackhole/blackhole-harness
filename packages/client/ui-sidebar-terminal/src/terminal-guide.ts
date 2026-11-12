/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Thẻ hướng dẫn của terminal ở sidebar phải: mở tab hoặc chọn shell từ menu
 */

import { GUIDE_CLASS } from "./guide-css.ts";
import type { TerminalTranslate } from "./locales.ts";
import type { JsxRuntimeLike, ReactLike } from "./types.ts";

/** Primitive của ui-primitives mà thẻ hướng dẫn dùng. */
export interface GuidePrimitivesLike {
  /** Nút. */
  Button: unknown;
  /** Icon mũi xuống. */
  IconChevronDownOutlineRegular: unknown;
  /** Hình minh hoạ terminal. */
  PluginArtworkTerminal: unknown;
  /** Menu có neo. */
  Menu: unknown;
  /** Dãy phím tắt. */
  ShortcutKeys: unknown;
}

/** Props mà khe cắm bơm cho thẻ hướng dẫn. */
export interface TerminalGuideProps {
  /** Tiêu đề mục. */
  title: string;
  /** Mô tả mục, nếu có. */
  description?: string;
  /** Loại entry hướng dẫn. */
  kind: string;
  /** Thông tin tab đang mở. */
  useTabInfo: () => { tab: { actions: { openTab(kind: string, options: Record<string, unknown>): void } } };
  /** Dò các shell có thể chạy, có thể huỷ. */
  loadShells: (signal: AbortSignal) => Promise<{ shells: { path: string; name: string }[]; selectedShell?: string }>;
  /** Ghi nhớ shell người dùng chọn. */
  selectShell: (path: string) => void;
  /** Hàm đọc từ điển đã bind namespace. */
  t: TerminalTranslate;
  /** Hook đọc bảng phím tắt. */
  useShortcuts: <T>(selector: (entries: { id: string; aria?: string; keys: string[] }[]) => T) => T;
}

/**
 * Dựng thẻ hướng dẫn terminal.
 * Nhận: jsx runtime, module react và các primitive.
 * Trả: component nhận props của khe cắm.
 */
export function createTerminalGuide(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  primitives: GuidePrimitivesLike,
): (props: TerminalGuideProps) => unknown {
  const { jsx, jsxs } = runtime;
  return (props: TerminalGuideProps): unknown => {
    const shortcut = props.useShortcuts((entries) => entries.find((entry) => entry.id === "terminal.new"));
    const { tab } = props.useTabInfo();
    const [open, setOpen] = react.useState(false);
    const [attempt, setAttempt] = react.useState(0);
    const [state, setState] = react.useState<
      | { phase: "loading" }
      | { phase: "ready"; choices: { shells: { path: string; name: string }[]; selectedShell?: string } }
      | { phase: "failed"; message: string }
    >({ phase: "loading" });
    react.useEffect(() => {
      if (!open) return undefined;
      const lifetime = new AbortController();
      props.loadShells(lifetime.signal).then(
        (choices) => {
          if (!lifetime.signal.aborted) setState({ phase: "ready", choices });
        },
        (error: unknown) => {
          if (!lifetime.signal.aborted) {
            setState({ phase: "failed", message: error instanceof Error ? error.message : String(error) });
          }
        },
      );
      return () => {
        lifetime.abort();
      };
    }, [open, attempt, props.loadShells]);
    const items: { id: string; label: string; disabled?: boolean }[] =
      state.phase === "ready"
        ? state.choices.shells.map((shell) => ({ id: shell.path, label: shell.name }))
        : state.phase === "loading"
          ? [{ id: "loading", label: props.t("shellLoading"), disabled: true }]
          : [
              { id: "error", label: props.t("failed", { message: state.message }), disabled: true },
              { id: "retry", label: props.t("retry") },
            ];
    return jsxs("div", {
      className: GUIDE_CLASS.entry,
      "data-sidebar-right-guide-entry": props.kind,
      children: [
        jsx(primitives.Button, {
          variant: "ghost",
          className: GUIDE_CLASS.main,
          "aria-label": props.description === undefined ? props.title : props.title + " " + props.description,
          "aria-keyshortcuts": shortcut?.aria,
          onClick: () => {
            tab.actions.openTab("terminal", { replaceTab: true });
          },
        }),
        jsx("span", {
          className: GUIDE_CLASS.icon,
          "aria-hidden": "true",
          children: jsx(primitives.PluginArtworkTerminal, { size: props.description === undefined ? 22 : 26 }),
        }),
        jsxs("span", {
          className: GUIDE_CLASS.text,
          children: [
            jsxs("span", {
              className: GUIDE_CLASS.titleRow,
              children: [
                jsx("span", { className: GUIDE_CLASS.title, "aria-hidden": "true", children: props.title }),
                jsx(primitives.Menu, {
                  open,
                  portal: true,
                  autoFocus: true,
                  align: "end",
                  className: GUIDE_CLASS.menu,
                  items: items.length === 0 ? [{ id: "empty", label: props.t("shellEmpty"), disabled: true }] : items,
                  selectedId: state.phase === "ready" ? state.choices.selectedShell : undefined,
                  onClose: () => {
                    setOpen(false);
                  },
                  onSelect: (path: string) => {
                    if (state.phase === "failed") {
                      setState({ phase: "loading" });
                      setAttempt((value) => value + 1);
                      return;
                    }
                    props.selectShell(path);
                    setOpen(false);
                    tab.actions.openTab("terminal", { replaceTab: true, params: { shellPath: path } });
                  },
                  anchor: jsx(primitives.Button, {
                    variant: "ghost",
                    className: GUIDE_CLASS.trigger,
                    "aria-label": props.t("shell"),
                    "aria-haspopup": "menu",
                    "aria-expanded": open,
                    onClick: () => {
                      setState({ phase: "loading" });
                      setOpen((value) => !value);
                    },
                    children: jsx(primitives.IconChevronDownOutlineRegular, {}),
                  }),
                }),
              ],
            }),
            props.description !== undefined &&
              jsx("span", { className: GUIDE_CLASS.description, "aria-hidden": "true", children: props.description }),
          ],
        }),
        shortcut !== undefined &&
          shortcut.keys.length > 0 &&
          jsx(primitives.ShortcutKeys, { keys: shortcut.keys, className: GUIDE_CLASS.shortcut }),
      ],
    });
  };
}
