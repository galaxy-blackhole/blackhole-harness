/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khung nhin Platform cua Desktop (loi native so huu noi dung tu xa) va host cua no trong lop phu shell
 */

import { platformOverlayStyles } from "./class-names.ts";
import { acquireOverlayInert } from "./overlay-inert.ts";
import type { PlatformBridge, PlatformPageClaim } from "./contracts.ts";
import type { RenderDeps, Translator } from "./types.ts";

/** Du lieu ma khung nhin Platform nhan. */
export interface PlatformOverlayProps {
  /** Cau noi native. */
  readonly bridge: PlatformBridge;
  /** Ten trang dang mo. */
  readonly page: string;
  /** Chu cua nut quay lai. */
  readonly backLabel: string;
  /** Chu dang tai. */
  readonly loadingLabel: string;
  /** Chu khi that bai. */
  readonly failureLabel: string;
  /** Chu cua nut thu lai. */
  readonly retryLabel: string;
  /** Dong khung nhin. */
  readonly onClose: () => void;
}

/** Du lieu ma host trang Platform nhan. */
export interface AccountPlatformHostProps {
  /** Cau noi native. */
  readonly platform: PlatformBridge;
  /** Hook kenh trang Platform do renderer dung tu kho cua ta. */
  readonly usePage: <T>(select: (claim: PlatformPageClaim | null) => T) => T;
  /** Dong trang dang mo. */
  readonly closePage: () => void;
  /** Ham dich cua namespace settings.account. */
  readonly t: Translator;
}

/** Khung do cua khung nhin native. */
interface Bounds {
  /** Toa do x. */
  x: number;
  /** Toa do y. */
  y: number;
  /** Chieu rong. */
  width: number;
  /** Chieu cao. */
  height: number;
}

/**
 * Dung khung nhin Platform cua Desktop va host cua no.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @returns hai component cua duong trang Platform.
 */
export function createPlatformOverlay(deps: RenderDeps): { PlatformOverlay: (props: PlatformOverlayProps) => unknown; AccountPlatformHost: (props: AccountPlatformHostProps) => unknown } {
  const { jsx, jsxs, Fragment } = deps.jsxRuntime;
  const { useState, useRef, useEffect, useLayoutEffect } = deps.react;
  const { Button, IconChevronLeftOutlineRegular } = deps.primitives;

  /**
   * Khung nhin Platform cua Desktop; con native so huu noi dung tu xa va credential.
   * @param props - lenh native, ban dich va hanh dong quay lai.
   * @returns khung chua Platform chiem tron cua so.
   */
  function PlatformOverlay({ bridge, page, backLabel, loadingLabel, failureLabel, retryLabel, onClose }: PlatformOverlayProps): unknown {
    const layer = useRef<HTMLElement | null>(null);
    const back = useRef<HTMLElement | null>(null);
    const viewport = useRef<HTMLElement | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] = useState("loading");
    useLayoutEffect(() => {
      const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const background = Array.from(document.body.children)
        .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== layer.current)
        .map((element) => acquireOverlayInert(element));
      back.current?.focus();
      return () => {
        for (const release of background) release();
        if (previousFocus?.isConnected) previousFocus.focus();
      };
    }, []);
    useLayoutEffect(() => {
      back.current?.focus();
    }, [page, attempt]);
    useEffect(() => {
      const element = viewport.current;
      if (element === null) return;
      let closed = false;
      /** Khung do hien tai cua khung nhin. */
      const bounds = (): Bounds => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      /** Bao that bai neu khung nhin con mo. */
      const fail = (): void => {
        if (!closed) setStatus("failed");
      };
      setStatus("loading");
      bridge.open(page, bounds()).then(
        () => {
          if (!closed) setStatus("loaded");
        },
        fail,
      );
      const observer = new ResizeObserver(() => {
        bridge.setBounds(bounds()).catch(fail);
      });
      observer.observe(element);
      return () => {
        closed = true;
        observer.disconnect();
        bridge.close().catch(() => undefined);
      };
    }, [bridge, page, attempt]);
    return deps.createPortal(
      jsxs("div", {
        ref: layer,
        className: platformOverlayStyles.overlay,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": backLabel,
        children: [
          jsx("header", {
            className: platformOverlayStyles.header,
            "data-window-drag": true,
            children: jsxs("div", {
              className: platformOverlayStyles.controls,
              children: [
                jsx("span", { className: platformOverlayStyles.trafficLights, "aria-hidden": "true" }),
                jsxs("button", {
                  ref: back,
                  className: platformOverlayStyles.back,
                  onClick: onClose,
                  children: [jsx(IconChevronLeftOutlineRegular, { size: 16 }), backLabel],
                }),
              ],
            }),
          }),
          jsx("div", {
            ref: viewport,
            className: platformOverlayStyles.viewport,
            children:
              status !== "loaded" &&
              jsx("div", {
                className: platformOverlayStyles.status,
                role: "status",
                "aria-label": status === "loading" ? loadingLabel : undefined,
                children:
                  status === "failed"
                    ? jsxs(Fragment, {
                        children: [
                          jsx("span", { className: platformOverlayStyles.failure, children: failureLabel }),
                          jsx(Button, {
                            variant: "outline",
                            className: platformOverlayStyles.retry,
                            onClick: () => {
                              setAttempt((value) => value + 1);
                            },
                            children: retryLabel,
                          }),
                        ],
                      })
                    : jsx("span", { className: platformOverlayStyles.spinner, "aria-hidden": "true" }),
              }),
          }),
        ],
      }),
      document.body,
    );
  }

  /**
   * Khung chua Platform native, hoac null khi khong co trang nao duoc yeu cau.
   * @param props - lenh native, yeu cau trang dang song va cach dong no.
   * @returns khung chua Platform native, hoac null khi khong co trang nao duoc yeu cau.
   */
  function AccountPlatformHost({ platform, usePage, closePage, t }: AccountPlatformHostProps): unknown {
    const claim = usePage((current) => current);
    if (claim === null) return null;
    return jsx(PlatformOverlay, {
      bridge: platform,
      page: claim.page,
      backLabel: t("backToHarness"),
      loadingLabel: t("loading"),
      failureLabel: t("platformFailed"),
      retryLabel: t("platformRetry"),
      onClose: closePage,
    });
  }

  return { PlatformOverlay, AccountPlatformHost };
}
