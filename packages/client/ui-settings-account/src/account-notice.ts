/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc The thong bao thuong o thanh ben: bao mot lan hien khi the da co vi tri, trang dang hien va da ve xong mot khung
 */

import { accountNoticeStyles } from "./class-names.ts";
import type { BonusNotice } from "./contracts.ts";
import type { RenderDeps } from "./types.ts";

/** Du lieu ma the thong bao nhan. */
export interface AccountNoticeCardProps {
  /** Thong bao dang hien. */
  readonly notice: BonusNotice;
  /** Neo do vi tri (nut tai khoan o thanh ben). */
  readonly anchor: { current: HTMLElement | null };
  /** Tieu de cua the. */
  readonly title: string;
  /** Nhan cua nut dong. */
  readonly closeLabel: string;
  /** Bao the da duoc hien. */
  readonly onShown: (orderId: string) => void;
  /** Bao nguoi dung da dong the. */
  readonly onDismiss: (orderId: string) => void;
}

/**
 * Thuong con tieu duoc khong.
 * @param expiresAt - moc het han cua may chu.
 * @returns true khi thuong van con tieu duoc.
 */
function live(expiresAt: string): boolean {
  const expires = Date.parse(expiresAt);
  return Number.isNaN(expires) || expires > Date.now();
}

/**
 * Goi run sau khi da qua mot khung ve.
 * @param run - ham can goi.
 * @returns ham huy cho the bi go hoac bi an truoc do.
 */
function afterPaint(run: () => void): () => void {
  if (typeof requestAnimationFrame !== "function") {
    const timer = setTimeout(run, 0);
    return () => {
      clearTimeout(timer);
    };
  }
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    timer = setTimeout(() => {
      if (!cancelled) run();
    }, 0);
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    if (timer !== undefined) clearTimeout(timer);
  };
}

/**
 * Dung the thong bao thuong.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @returns component the thong bao thuong.
 */
export function createAccountNoticeCard(deps: RenderDeps): (props: AccountNoticeCardProps) => unknown {
  const { jsx, jsxs } = deps.jsxRuntime;
  const { useState, useRef, useEffect, useLayoutEffect } = deps.react;
  const { IconCloseOutlineRegular } = deps.primitives;

  /**
   * The thong bao thuong khong chan tuong tac phia tren nut khoi dong tai khoan cho toi khi bi dong.
   * @param props - loi nhan va dinh danh thong bao, neo thanh ben va cac ham bao hien thi.
   * @returns the thong bao phia tren nut tai khoan cho toi khi bi dong.
   */
  return function AccountNoticeCard({ notice, anchor, title, closeLabel, onShown, onDismiss }: AccountNoticeCardProps): unknown {
    const [position, setPosition] = useState<{ left: number; bottom: number } | undefined>(undefined);
    const reported = useRef(false);
    useLayoutEffect(() => {
      if (!anchor.current || !live(notice.expiresAt)) return;
      const element = anchor.current;
      /** Do lai vi tri the theo neo. */
      const update = (): void => {
        const rect = element.getBoundingClientRect();
        setPosition({
          left: Math.max(8, Math.min(rect.left, window.innerWidth - 268)),
          bottom: Math.max(8, window.innerHeight - rect.top + 4),
        });
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(element);
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
      };
    }, [anchor, notice.orderId, notice.expiresAt]);
    useEffect(() => {
      if (position === undefined || reported.current || !live(notice.expiresAt)) return;
      let cancel: (() => void) | undefined;
      /** Thu bao hien thi neu the dang that su hien. */
      const attempt = (): void => {
        if (reported.current || cancel !== undefined || !live(notice.expiresAt)) return;
        if (document.visibilityState === "hidden") return;
        cancel = afterPaint(() => {
          cancel = undefined;
          if (reported.current || document.visibilityState === "hidden" || !live(notice.expiresAt)) return;
          reported.current = true;
          onShown(notice.orderId);
        });
      };
      attempt();
      document.addEventListener("visibilitychange", attempt);
      return () => {
        document.removeEventListener("visibilitychange", attempt);
        cancel?.();
      };
    }, [position, notice.orderId, notice.expiresAt, onShown]);
    if (!live(notice.expiresAt)) return null;
    return deps.createPortal(
      jsxs("aside", {
        className: accountNoticeStyles.card,
        style: position ?? { visibility: "hidden" },
        children: [
          jsxs("div", {
            role: "status",
            className: accountNoticeStyles.copy,
            children: [
              jsxs("div", {
                className: accountNoticeStyles.title,
                children: [
                  jsx("span", {
                    className: accountNoticeStyles.icon,
                    "aria-hidden": "true",
                    children: jsxs("svg", {
                      width: "14",
                      height: "14",
                      viewBox: "0 0 14 14",
                      fill: "none",
                      children: [
                        jsx("path", {
                          d: "M3.6355 6.93969C3.6355 4.8398 5.33779 3.1375 7.43768 3.1375C9.53757 3.1375 11.23987 4.8398 11.23987 6.93968V11.363H3.6355V6.93969Z",
                          fill: "currentColor",
                          fillOpacity: "0.2",
                          stroke: "currentColor",
                          strokeWidth: "0.875",
                        }),
                        jsx("path", {
                          d: "M1.641 11.3645H12.36M5.053 13.3095H8.9479M7.4375 4.27422V2.70137912",
                          stroke: "currentColor",
                          strokeWidth: "0.875",
                        }),
                      ],
                    }),
                  }),
                  jsx("span", { children: title }),
                ],
              }),
              jsx("p", { children: notice.message }),
            ],
          }),
          jsx("button", {
            type: "button",
            className: accountNoticeStyles.close,
            "aria-label": closeLabel,
            onClick: () => {
              onDismiss(notice.orderId);
            },
            children: jsx(IconCloseOutlineRegular, { size: 10 }),
          }),
        ],
      }),
      document.body,
    );
  };
}
