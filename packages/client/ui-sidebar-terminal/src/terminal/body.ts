/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Thân terminal trong chunk lazy: màn xterm, đo kích thước, trạng thái và phục hồi kết nối
 */

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

import { TERMINAL_CLASS, TERMINAL_CSS } from "./terminal-css.ts";
import { observeTerminalCursor, type RenderingTerminalLike } from "./cursor.ts";
import { TerminalTheme, type TerminalLike } from "./theme.ts";
import type { JsxRuntimeLike, ReactLike } from "../types.ts";

/** Chuỗi font dựng sẵn của terminal, đặt sau danh sách font của người dùng. */
const TERMINAL_FONT_STACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Một khung hình terminal đã sẵn sàng để ghi vào xterm. */
export interface RenderFrame {
  /** Số hiệu khung hình; chỉ ghi khi lớn hơn lần trước. */
  revision: number;
  /** Khung: ảnh chụp toàn màn hoặc một mẩu dữ liệu. */
  frame:
    | { type: "snapshot"; screen: string; info: { cols: number; rows: number } }
    | { type: "data"; data: string };
}

/** Trạng thái màn terminal mà renderer đọc. */
export interface TerminalState {
  /** Pha kết nối. */
  phase: string;
  /** Có ghi được vào terminal không. */
  writable?: boolean;
  /** Lỗi kết nối, nếu có. */
  error?: string;
  /** Vấn đề cần người dùng xử lý. */
  issue?: string;
  /** Thông tin phiên terminal. */
  info?: {
    /** Tên hiển thị. */
    title?: string;
    /** Trạng thái tiến trình. */
    state?: string;
    /** Mã thoát. */
    exitCode?: number;
    /** Lỗi của tiến trình. */
    error?: string;
    /** Số cột. */
    cols: number;
    /** Số hàng. */
    rows: number;
  };
  /** Kích thước tối đa của môi trường. */
  environment?: { scrollback?: number; maxCols: number; maxRows: number };
  /** Khung hình mới nhất. */
  render?: RenderFrame;
}

/** View điều khiển một terminal. */
export interface TerminalViewLike {
  /** Trạng thái để renderer theo dõi. */
  readonly state: unknown;
  /** Gắn màn vào phiên. */
  mount(): void;
  /** Gửi dữ liệu người dùng gõ. */
  write(data: string): void;
  /** Đổi kích thước. */
  resize(cols: number, rows: number): void;
  /** Xác nhận đã vẽ xong một khung hình. */
  acknowledge(revision: number): void;
  /** Nối lại sau khi mất kết nối. */
  connect(): void;
  /** Đọc lại trạng thái phiên. */
  refresh(): void;
  /** Đổi tên terminal. */
  rename(title: string): void;
}

/** Primitive của ui-primitives mà thân terminal dùng. */
export interface TerminalPrimitivesLike {
  /** Nút. */
  Button: unknown;
  /** Icon dấu cộng. */
  IconPlusOutlineRegular: unknown;
}

/** Props mà khe cắm bơm cho thân terminal. */
export interface TerminalBodyProps {
  /** Thông tin tab đang mở. */
  useTabInfo: () => { tab: { id: string; visible: boolean; title?: string; actions: { openTab(kind: string, options: Record<string, unknown>): void } } };
  /** Hook đọc trạng thái terminal theo tab. */
  useTerminal: (key: string) => TerminalState | undefined;
  /** Hook đọc theme đang dùng. */
  useTheme: <T>(selector: (theme: { fontFamilies: { terminal: string }; fontSizes: { terminal: number } }) => T) => T;
  /** Lấy view điều khiển terminal của một tab. */
  view: (key: string) => TerminalViewLike;
  /** Hàm đọc từ điển đã bind namespace. */
  t: (key: string, params?: Record<string, string>) => string;
}

/**
 * Chèn CSS của thân terminal một lần vào document.
 * Nhận: không.
 * Trả: không.
 */
export function ensureTerminalCss(): void {
  if (typeof document === "undefined") return;
  const tagId = "@galaxy-blackhole/gbh-client-ui-sidebar-terminal/terminal.module.css";
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-sidebar-terminal";
  tag.dataset.pluginCss = tagId;
  tag.textContent = TERMINAL_CSS;
  document.head.appendChild(tag);
}

/**
 * Dựng thân terminal từ các module do bảng module cấp.
 * Nhận: jsx runtime và module react.
 * Trả: component TerminalBody nhận props của khe cắm.
 */
export function createTerminalBody(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  primitives: TerminalPrimitivesLike,
): (props: TerminalBodyProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;

  /**
   * Font dùng cho terminal: danh sách của người dùng rồi tới chuỗi dựng sẵn.
   * Nhận: danh sách font của người dùng (có thể rỗng).
   * Trả: chuỗi font đầy đủ.
   */
  const terminalFontFamily = (list: string): string =>
    list === "" ? TERMINAL_FONT_STACK : list + ", " + TERMINAL_FONT_STACK;

  /**
   * Đo lại số cột/hàng và báo cho phiên.
   * Nhận: emulator, fit addon, trạng thái và view.
   * Trả: không.
   */
  const fitScreen = (xterm: Terminal, fit: FitAddon, state: TerminalState, model: TerminalViewLike): void => {
    const dimensions = fit.proposeDimensions();
    const environment = state.environment;
    if (dimensions === undefined || environment === undefined) return;
    const cols = Math.min(dimensions.cols, environment.maxCols);
    const rows = Math.min(dimensions.rows, environment.maxRows);
    if (cols < 2 || rows < 1) return;
    xterm.resize(cols, rows);
    model.resize(cols, rows);
  };

  /**
   * Màn xterm của một terminal còn sống: mở emulator, gắn fit addon, ghi khung hình mới.
   * Nhận: trạng thái, view, cờ hiển thị, nhãn và theme.
   * Trả: phần tử div chứa màn.
   */
  const TerminalScreen = (props: {
    state: TerminalState;
    model: TerminalViewLike;
    visible: boolean;
    label: string;
    theme: { fontFamilies: { terminal: string }; fontSizes: { terminal: number } };
  }): unknown => {
    const element = react.useRef<HTMLElement | null>(null);
    const terminal = react.useRef<Terminal | undefined>(undefined);
    const fit = react.useRef<FitAddon | undefined>(undefined);
    const colors = react.useRef<TerminalTheme | undefined>(undefined);
    const lastRevision = react.useRef(0);
    const fontFamily = terminalFontFamily(props.theme.fontFamilies.terminal);
    const fontSize = props.theme.fontSizes.terminal;
    const current = react.useRef({ state: props.state, visible: props.visible, fontFamily, fontSize });
    current.current = { state: props.state, visible: props.visible, fontFamily, fontSize };
    react.useLayoutEffect(() => {
      const node = element.current;
      if (node === null) return undefined;
      const xterm = new Terminal({
        minimumContrastRatio: 4.5,
        cursorBlink: true,
        fontSize: current.current.fontSize,
        fontFamily: current.current.fontFamily,
        scrollback: current.current.state.environment?.scrollback ?? 0,
      });
      const addon = new FitAddon();
      xterm.loadAddon(addon);
      xterm.open(node);
      const palette = new TerminalTheme(xterm as unknown as TerminalLike);
      colors.current = palette;
      const cursor = observeTerminalCursor(xterm as unknown as RenderingTerminalLike, node, () => palette.cursor);
      xterm.textarea?.setAttribute("aria-label", props.label);
      terminal.current = xterm;
      fit.current = addon;
      lastRevision.current = 0;
      const input = xterm.onData((data) => {
        props.model.write(data);
      });
      const measure = (): void => {
        if (!current.current.visible || !current.current.state.writable) return;
        if (node.clientWidth === 0 || node.clientHeight === 0) return;
        fitScreen(xterm, addon, current.current.state, props.model);
      };
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => {
        observer.disconnect();
        input.dispose();
        cursor.dispose();
        palette.dispose();
        xterm.dispose();
        terminal.current = undefined;
        fit.current = undefined;
      };
    }, [props.model]);
    react.useLayoutEffect(() => {
      const node = element.current;
      if (node === null) return;
      const style = getComputedStyle(node);
      colors.current?.update(style.backgroundColor, style.color);
    }, [props.theme, props.model]);
    react.useLayoutEffect(() => {
      const xterm = terminal.current;
      if (xterm === undefined) return;
      if (xterm.options.fontFamily === fontFamily && xterm.options.fontSize === fontSize) return;
      xterm.options.fontFamily = fontFamily;
      xterm.options.fontSize = fontSize;
      const { state: live, visible: shown } = current.current;
      const node = element.current;
      if (shown && live.writable === true && node !== null && node.clientWidth > 0 && node.clientHeight > 0) {
        if (fit.current !== undefined) fitScreen(xterm, fit.current, live, props.model);
      }
    }, [fontFamily, fontSize, props.model]);
    react.useLayoutEffect(() => {
      const xterm = terminal.current;
      if (xterm === undefined) return;
      const render = props.state.render;
      if (render === undefined || render.revision <= lastRevision.current) return;
      lastRevision.current = render.revision;
      if (render.frame.type === "snapshot") {
        xterm.reset();
        xterm.resize(render.frame.info.cols, render.frame.info.rows);
      }
      xterm.write(render.frame.type === "snapshot" ? render.frame.screen : render.frame.data, () => {
        props.model.acknowledge(render.revision);
      });
    }, [props.state.render, props.model]);
    react.useLayoutEffect(() => {
      const xterm = terminal.current;
      if (xterm === undefined) return;
      const node = element.current;
      xterm.options.disableStdin = props.state.writable !== true;
      if (props.visible && props.state.writable === true && node !== null && node.clientWidth > 0 && node.clientHeight > 0) {
        if (fit.current !== undefined) fitScreen(xterm, fit.current, props.state, props.model);
      } else if (props.state.info !== undefined && props.state.writable !== true) {
        xterm.resize(props.state.info.cols, props.state.info.rows);
      }
    }, [props.visible, props.state.writable, props.state.info?.cols, props.state.info?.rows, props.model]);
    react.useEffect(() => {
      terminal.current?.textarea?.setAttribute("aria-label", props.label);
    }, [props.label]);
    react.useEffect(() => {
      if (props.visible && props.state.writable === true) terminal.current?.focus();
    }, [props.visible, props.state.writable]);
    return jsx("div", { className: TERMINAL_CLASS.screen, ref: element });
  };

  /**
   * Nút của ui-primitives dùng trong thân terminal.
   * Nhận: icon (nếu có), chữ, cờ nút lớn, tab và hàm bấm.
   * Trả: phần tử Button; mặc định mở một terminal mới.
   */
  const button = (options: {
    icon?: unknown;
    label: unknown;
    large?: boolean;
    onClick?: () => void;
  }): unknown =>
    jsx(primitives.Button, {
      variant: options.icon === undefined ? "outline" : "primary",
      size: options.large === true ? "md" : "sm",
      icon: options.icon,
      onClick:
        options.onClick ??
        ((): void => {
          tab.current?.actions.openTab("terminal", { replaceTab: true });
        }),
      children: options.label,
    });

  /** Tab đang mở, dùng cho các nút trong thân terminal. */
  const tab: { current?: { actions: { openTab(kind: string, options: Record<string, unknown>): void } } } = {};

  /**
   * Thân terminal của một tab ở sidebar phải, kèm các trạng thái chờ, lỗi và phục hồi.
   * Nhận: props của khe cắm.
   * Trả: phần tử section, hoặc null khi chưa có trạng thái.
   */
  return (props: TerminalBodyProps): unknown => {
    const { tab: currentTab } = props.useTabInfo();
    tab.current = currentTab;
    const theme = props.useTheme((value) => value);
    const model = props.view(currentTab.id);
    const state = props.useTerminal(currentTab.id);
    react.useEffect(() => model.mount(), [model]);
    if (state === undefined) return null;
    /** Nút mở một terminal mới, kèm icon dấu cộng. */
    const newTerminal = button({
      icon: jsx("span", {
        className: TERMINAL_CLASS.actionIcon,
        "aria-hidden": "true",
        children: jsx(primitives.IconPlusOutlineRegular, {}),
      }),
      label: props.t("new"),
      large: state.issue === "missingTerminal",
    });
    if (state.issue === "missingTerminal") {
      return jsx("section", {
        className: TERMINAL_CLASS.root,
        "data-sidebar-terminal": true,
        children: jsxs("div", {
          className: TERMINAL_CLASS.empty,
          children: [
            jsxs("svg", {
              width: "36",
              height: "36",
              viewBox: "0 0 28 28",
              fill: "none",
              "aria-hidden": "true",
              children: [
                jsx("rect", { x: "3", y: "5", width: "22", height: "19", rx: "3", fill: "#17191d" }),
                jsx("path", {
                  d: "m8 10 4 4-4 4M15 18h5",
                  stroke: "#fff",
                  strokeWidth: "1.7",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }),
              ],
            }),
            jsx("p", { className: TERMINAL_CLASS.emptyMessage, role: "alert", children: props.t("missingTerminal") }),
            newTerminal,
          ],
        }),
      });
    }
    const error =
      state.phase === "disconnected"
        ? undefined
        : state.issue === undefined
          ? (state.error ?? state.info?.error)
          : props.t(state.issue);
    let status: string | undefined;
    if (state.phase === "idle" || state.phase === "loading") status = props.t("loading");
    else if (state.phase === "creating" || state.phase === "connecting" || state.phase === "disconnected") status = props.t(state.phase);
    else if (state.info?.state === "exited") status = props.t("exited", { code: String(state.info.exitCode ?? "—") });
    else if (state.info?.state === "failed") status = props.t("unavailable");
    else if (state.phase === "closed") status = props.t("closed");
    const ended = state.info?.state === "exited" || state.phase === "closed";
    const retry = !ended && (state.phase === "failed" || state.phase === "disconnected");
    const readOnly = state.phase === "connected" && state.info?.state === "running" && state.writable !== true;
    return jsxs("section", {
      className: TERMINAL_CLASS.root,
      "data-sidebar-terminal": true,
      children: [
        (status !== undefined || retry || readOnly) &&
          jsxs("div", {
            className: TERMINAL_CLASS.status,
            role: "status",
            children: [
              status,
              readOnly &&
                jsxs(Fragment, {
                  children: [
                    props.t("readonly"),
                    " ",
                    button({ label: props.t("control"), onClick: () => model.connect() }),
                  ],
                }),
              retry &&
                (state.info === undefined
                  ? button({
                      label: props.t(state.phase === "disconnected" ? "reconnect" : "retry"),
                      onClick: () => model.refresh(),
                    })
                  : button({ label: props.t("reconnect"), onClick: () => model.connect() })),
              ended && newTerminal,
            ],
          }),
        state.info !== undefined &&
          jsx(TerminalScreen, {
            state,
            model,
            visible: currentTab.visible,
            label: props.t("title"),
            theme,
          }),
        error !== undefined &&
          jsx("p", { className: TERMINAL_CLASS.error, role: "alert", children: props.t("failed", { message: error }) }),
      ],
    });
  };
}
