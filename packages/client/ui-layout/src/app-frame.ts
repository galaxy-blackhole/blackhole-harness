/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khung vo ba cot: luoi track, tay keo (pointer capture + rAF), giai cot, va quyet dinh render o con
 */
import { FRAME_CLASS } from "./class-names.ts";
import { clampWidth, computeColumns, RIGHTBAR_MAX_RATIO, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT } from "./columns.ts";
import type { LayoutInfo } from "./stores.ts";

/** Hàm dựng element của React runtime. */
type JsxFn = (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;

/** React runtime tối thiểu mà khung dùng (jsx/jsxs/Fragment ở `react/jsx-runtime`, hook ở `react`). */
export interface FrameReact {
  /** Dựng element một con. */
  jsx: JsxFn;
  /** Dựng element nhiều con. */
  jsxs: JsxFn;
  /** Bao nhiều con không cần node bọc. */
  Fragment: unknown;
  /** Trạng thái cục bộ. */
  useState: <T>(initial: T) => [T, (next: T | ((previous: T) => T)) => void];
  /** Ô nhớ. */
  useRef: <T>(initial: T) => { current: T };
  /** Hiệu ứng sau khi vẽ. */
  useEffect: (callback: () => void | (() => void), deps: unknown[]) => void;
  /** Hiệu ứng TRƯỚC khi trình duyệt vẽ (đo khung). */
  useLayoutEffect: (callback: () => void | (() => void), deps: unknown[]) => void;
  /** Gói hàm nhớ theo phụ thuộc. */
  useCallback: <T>(callback: T, deps: unknown[]) => T;
  /** Nhớ giá trị theo phụ thuộc. */
  useMemo: <T>(factory: () => T, deps: unknown[]) => T;
}

/** Action hình học mà khung gọi. */
export interface FrameActions {
  /** Ghi bề rộng khung đo được. */
  setViewportWidth: (width: number) => void;
  /** Ghi bề rộng thanh bên khi kéo. */
  setSidebar: (px: number) => void;
  /** Ghi bề rộng cột phải khi kéo. */
  setRightbar: (px: number) => void;
}

/** Ảnh chụp phiên mà `DocumentTitle` đọc (khai lại để không phụ thuộc kiểu ngoài). */
export interface FrameSessionsSnapshot {
  /** Phiên theo id. */
  readonly byId: Readonly<Record<string, { readonly id?: string; readonly title?: string; readonly retainedBy?: { readonly mainView?: number } }>>;
}

/** Props mà ô `root` truyền xuống khung. */
export interface AppFrameProps {
  /** Hook chọn từ store gốc. */
  useStore: (select: (state: { readonly layoutInfo: LayoutInfo }) => LayoutInfo) => LayoutInfo;
  /** Hook chọn từ ảnh chụp phiên. */
  useSessions: (select: (state: FrameSessionsSnapshot) => string | undefined) => string | undefined;
  /** Hook chọn từ thông tin panel giữa. */
  usePanelInfo: {
    (select: (info: { readonly activePanelId: string | null }) => string | null): string | null;
    (select: (info: { readonly activePanelId: string | null }) => boolean): boolean;
  };
  /** Action hình học. */
  actions: FrameActions;
  /** Renderer slot của framework. */
  renderSlot: (name: string, owner: Record<string, unknown>, options?: Record<string, unknown>) => unknown;
  /** Đọc từ điển (khung nhận nhưng không dùng — giữ đúng chữ ký bản gốc). */
  t: (key: string) => string;
}

/** Props của một tay kéo. */
export interface DragHandleProps {
  /** Cột sở hữu tay kéo (`sidebar` | `rightbar`) — khoá CSS hiện khi rê chuột. */
  side: string;
  /** Toạ độ trái (px) của tay kéo trong khung. */
  left: number;
  /** Bắt đầu kéo. */
  onStart: () => void;
  /** Đang kéo: dx so với gốc. */
  onDrag: (dx: number) => void;
  /** Kết thúc kéo. */
  onEnd: () => void;
}

/** Phụ thuộc để dựng khung. */
export interface AppFrameDeps {
  /** React runtime. */
  react: FrameReact;
  /** Component tiêu đề trình duyệt do `document-title.ts` dựng. */
  DocumentTitle: (props: { productTitle: string; useSessions: unknown; usePanelInfo: unknown }) => unknown;
}

/**
 * Dựng khung vỏ ba cột.
 *
 * Khung chiếm ô `root` của vỏ web, sở hữu các track lưới (sidebar | center | rightbar), hai tay kéo (pointer
 * capture + throttle bằng rAF), phép giải cột, và quyết định render cho các ô con: ô `sidebar` nhận tham số
 * sống từ phép giải đó. Cột phải là một TRACK chứ không phải một hộp — người chiếm nó tự vẽ panel neo vào
 * mép phải khung ở bề rộng đã giải, còn track chỉ quyết định cột giữa có nhường chỗ hay không. Người chiếm
 * báo `shown`/`track`/`fullscreen` qua `ctx.layout`; toàn màn hình vẫn giữ track đã báo nhưng ẩn tay kéo ngoài.
 * Nhận: React runtime và component tiêu đề.
 * Trả: component `AppFrame`.
 */
export function createAppFrame(deps: AppFrameDeps): (props: AppFrameProps) => unknown {
  const { jsx, jsxs, Fragment, useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } = deps.react;

  /**
   * Ô lưới của cột giữa (khối dựng nên thân phiên).
   * Nhận: `children` — nội dung cột giữa.
   * Trả: element của cột giữa.
   */
  function CenterColumn(props: { children?: unknown }): unknown {
    return jsx("div", { className: FRAME_CLASS.centerCol, children: props.children });
  }

  /**
   * Ô `main`: chọn panel theo khoá mà KHÔNG đăng ký cả khung vào từng lần đổi panel id.
   * Nhận: hook chọn panel và renderer slot.
   * Trả: element của panel đang chọn.
   */
  function MainPanel(props: {
    usePanelInfo: (select: (info: { readonly activePanelId: string | null }) => string | null) => string | null;
    renderSlot: (name: string, owner: Record<string, unknown>, options?: Record<string, unknown>) => unknown;
  }): unknown {
    return props.renderSlot("main", {}, { entryKey: props.usePanelInfo((info) => info.activePanelId) ?? "conversation" });
  }

  /**
   * Ô lưới của cột phải: bề rộng 0 trừ khi người chiếm xin một track.
   * Nhận: `children` — panel của người chiếm.
   * Trả: element của cột phải.
   */
  function RightbarColumn(props: { children?: unknown }): unknown {
    return jsx("div", { className: FRAME_CLASS.rightbarCol, "data-rightbar-col": true, children: props.children });
  }

  /**
   * Một tay kéo: pointer capture, báo dx đã throttle bằng rAF so với gốc lúc bắt đầu kéo.
   * Nhận: `side` (khoá CSS hiện khi rê chuột), `left`, và ba callback `onStart`/`onDrag`/`onEnd`.
   * Trả: element tay kéo.
   */
  function DragHandle(props: DragHandleProps): unknown {
    const [dragging, setDragging] = useState(false);
    const origin = useRef(0);
    const latest = useRef(0);
    const frame = useRef<number | null>(null);
    const capture = useRef<{ element: HTMLElement; id: number } | null>(null);
    const callbacks = useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd });
    callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd };

    /** Kết thúc lượt kéo hiện tại: nhả capture, huỷ rAF đang chờ, tắt cờ kéo và báo `onEnd`. */
    const endDrag = useCallback(() => {
      const active = capture.current;
      if (active === null) return;
      capture.current = null;
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      if (active.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id);
      setDragging(false);
      callbacks.current.onEnd();
    }, []);
    useEffect(() => endDrag, [endDrag]);

    /** Bắt đầu kéo: chỉ nhận chuột trái, rồi ghi gốc và bật cờ kéo. */
    const onPointerDown = useCallback((event: PointerEvent) => {
      if (event.button !== 0 || capture.current !== null) return;
      event.preventDefault();
      const element = event.currentTarget as HTMLElement;
      element.setPointerCapture(event.pointerId);
      capture.current = { element, id: event.pointerId };
      origin.current = event.clientX;
      latest.current = event.clientX;
      callbacks.current.onStart();
      setDragging(true);
    }, []);

    /** Đang kéo: ghi vị trí mới nhất và báo dx MỘT lần mỗi khung hình. */
    const onPointerMove = useCallback((event: PointerEvent) => {
      if (capture.current?.id !== event.pointerId) return;
      latest.current = event.clientX;
      frame.current ??= requestAnimationFrame(() => {
        frame.current = null;
        callbacks.current.onDrag(latest.current - origin.current);
      });
    }, []);

    /** Nhả chuột: báo dx lần cuối rồi kết thúc. */
    const onPointerUp = useCallback(
      (event: PointerEvent) => {
        if (capture.current?.id !== event.pointerId) return;
        callbacks.current.onDrag(event.clientX - origin.current);
        endDrag();
      },
      [endDrag],
    );

    /** Chuột bị huỷ hoặc mất capture cũng là kết thúc. */
    const onPointerCancel = useCallback(
      (event: PointerEvent) => {
        if (capture.current?.id === event.pointerId) endDrag();
      },
      [endDrag],
    );

    return jsx("div", {
      className: FRAME_CLASS.handle,
      style: { left: props.left },
      "data-side": props.side,
      "data-dragging": dragging || undefined,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
    });
  }

  /**
   * Khung ba cột (xem mô tả ở `createAppFrame`).
   * Nhận: hook store/phiên/panel, action hình học, renderer slot và hàm đọc từ điển.
   * Trả: element khung lưới.
   */
  function AppFrame(props: AppFrameProps): unknown {
    const { useStore, useSessions, usePanelInfo, actions, renderSlot } = props;
    const layoutInfo = useStore((state) => state.layoutInfo);
    const frameRef = useRef<HTMLElement | null>(null);
    const viewport = layoutInfo.viewportWidth;
    useLayoutEffect(() => {
      const el = frameRef.current;
      if (el === null) return;
      let raf: number | null = null;
      let disposed = false;
      const measure = () => {
        const width = el.getBoundingClientRect().width;
        if (width > 0) actions.setViewportWidth(width);
      };
      measure();
      const observer = new ResizeObserver(() => {
        if (disposed) return;
        raf ??= requestAnimationFrame(() => {
          raf = null;
          measure();
        });
      });
      observer.observe(el);
      return () => {
        disposed = true;
        observer.disconnect();
        if (raf !== null) cancelAnimationFrame(raf);
      };
    }, [actions]);

    const narrow = viewport < SIDEBAR_AUTO_COLLAPSE;
    const sidebarCollapsed = narrow ? !layoutInfo.narrowExpanded : layoutInfo.sidebar === 0;
    const sidebarPreference = sidebarCollapsed ? 0 : layoutInfo.sidebar === 0 ? SIDEBAR_DEFAULT : layoutInfo.sidebar;
    const rightbarPreference = layoutInfo.rightbar ?? viewport * 0.45;
    const darwin = document.documentElement.dataset.platform === "darwin";
    const collapsedWidth = darwin || document.documentElement.hasAttribute("data-windows-titlebar") ? 0 : 56;
    const normal = computeColumns(
      viewport,
      !layoutInfo.rightbarShown && narrow ? 0 : sidebarPreference,
      rightbarPreference,
      collapsedWidth,
    );
    const cols = computeColumns(viewport, sidebarPreference, layoutInfo.rightbarTrack ? rightbarPreference : 0, collapsedWidth);
    const colsRef = useRef(cols);
    colsRef.current = cols;
    const rightbarWidth = useRef(normal.rightbar);
    rightbarWidth.current = normal.rightbar;
    const sidebarBase = useRef(0);
    const rightbarBase = useRef(0);
    const [dragging, setDragging] = useState(false);
    const [animating, setAnimating] = useState(0);
    const trackToggle = String(sidebarCollapsed) + ":" + String(layoutInfo.rightbarTrack);
    const previousToggle = useRef(trackToggle);
    const previousViewport = useRef(viewport);
    useLayoutEffect(() => {
      const viewportChanged = previousViewport.current !== viewport;
      previousViewport.current = viewport;
      if (previousToggle.current === trackToggle) return;
      previousToggle.current = trackToggle;
      if (viewportChanged) return;
      setAnimating((token) => token + 1);
    }, [trackToggle, viewport]);
    useEffect(() => {
      if (animating === 0) return;
      const frame = frameRef.current;
      if (frame === null) return;
      const settle = () => {
        setAnimating(0);
      };
      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.target === frame && event.propertyName === "grid-template-columns") settle();
      };
      frame.addEventListener("transitionend", onTransitionEnd);
      const timer = setTimeout(settle, 600);
      return () => {
        frame.removeEventListener("transitionend", onTransitionEnd);
        clearTimeout(timer);
      };
    }, [animating]);
    const onDragEnd = useCallback(() => {
      setDragging(false);
    }, []);
    const onSidebarStart = useCallback(() => {
      sidebarBase.current = colsRef.current.sidebar;
      setDragging(true);
    }, []);
    const onSidebarDrag = useCallback(
      (dx: number) => {
        actions.setSidebar(sidebarBase.current + dx);
      },
      [actions],
    );
    const onRightbarStart = useCallback(() => {
      rightbarBase.current = rightbarWidth.current;
      setDragging(true);
    }, []);
    const onRightbarDrag = useCallback(
      (dx: number) => {
        actions.setRightbar(rightbarBase.current - dx);
      },
      [actions],
    );

    const productTitle = "Galaxy Blackhole";
    const rightbarMax = cols.rightbar === 0 ? 0 : clampWidth(rightbarPreference, 300, viewport * RIGHTBAR_MAX_RATIO);
    const sidebar = useMemo(() => renderSlot("sidebar", { collapsed: sidebarCollapsed, width: cols.sidebar }), [
      renderSlot,
      sidebarCollapsed,
      cols.sidebar,
    ]);
    const main = useMemo(() => jsx(MainPanel, { usePanelInfo, renderSlot }), [usePanelInfo, renderSlot]);
    const overlays = useMemo(() => renderSlot("shell.overlay", {}), [renderSlot]);
    const leading = useMemo(() => renderSlot("shell.leading", {}), [renderSlot]);
    const leadingMounted = darwin && sidebarCollapsed;

    return jsxs("div", {
      ref: frameRef,
      className: FRAME_CLASS.frame,
      style: {
        ...(document.documentElement.hasAttribute("data-windows-titlebar")
          ? { "--dsh-windows-sidebar-width": String(cols.sidebar) + "px" }
          : {}),
        gridTemplateColumns:
          String(cols.sidebar) + "px minmax(" + String(cols.rightbar === 0 ? 0 : 400) + "px, 1fr) minmax(0px, " + String(rightbarMax) + "px)",
      },
      "data-sidebar-collapsed": sidebarCollapsed || undefined,
      "data-rightbar-collapsed": cols.rightbar === 0 || undefined,
      "data-rightbar-fullscreen": layoutInfo.rightbarFullscreen || undefined,
      "data-rightbar-instant": layoutInfo.rightbarInstant || undefined,
      "data-dragging": dragging || undefined,
      "data-animating": animating > 0 || undefined,
      children: [
        jsx(deps.DocumentTitle, { productTitle, useSessions, usePanelInfo }),
        jsx("div", { className: FRAME_CLASS.sidebarCol, children: sidebar }),
        jsxs(Fragment, {
          children: [
            jsx(CenterColumn, { children: main }),
            jsx(RightbarColumn, {
              children: renderSlot("rightbar", { width: normal.rightbar, viewportWidth: viewport, canShow: normal.rightbar > 0 }),
            }),
          ],
        }),
        jsx("div", { className: FRAME_CLASS.bottomRow, "data-shell-bottom": true, children: renderSlot("shell.bottom", {}) }),
        jsx("div", { className: FRAME_CLASS.overlayLayer, "data-shell-overlay": true, children: overlays }),
        leadingMounted && jsx("div", { className: FRAME_CLASS.leadingSeat, "data-shell-leading": true, children: leading }),
        !sidebarCollapsed &&
          jsx(DragHandle, { side: "sidebar", left: cols.sidebar, onStart: onSidebarStart, onDrag: onSidebarDrag, onEnd: onDragEnd }),
        layoutInfo.rightbarShown &&
          !layoutInfo.rightbarFullscreen &&
          normal.rightbar > 0 &&
          jsx(DragHandle, {
            side: "rightbar",
            left: viewport - normal.rightbar,
            onStart: onRightbarStart,
            onDrag: onRightbarDrag,
            onEnd: onDragEnd,
          }),
      ],
    });
  }

  return AppFrame;
}
