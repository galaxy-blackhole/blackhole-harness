/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Lop phu gioi thieu render qua body kem quyen so huu inert cua nen, va cap anh doi theo giao dien sang/toi
 */

import { desktopOnboardingStyles, onboardingSurfaceStyles } from "./class-names.ts";
import { acquireOverlayInert } from "./overlay-inert.ts";
import type { RenderDeps } from "./types.ts";

/** Du lieu ma lop phu gioi thieu nhan. */
export interface OnboardingSurfaceProps {
  /** Noi dung cua buoc, canh giua tren san khau. */
  readonly children?: unknown;
  /** Mo lai ung dung trong khi chu so huu giu san khau them 180ms. */
  readonly exiting?: boolean;
}

/** Du lieu ma cap anh gioi thieu nhan. */
export interface OnboardingIllustrationProps {
  /** Ten lop bo sung cua rieng tinh nang. */
  readonly className?: string;
  /** Anh che do sang. */
  readonly src: string;
  /** Anh che do toi. */
  readonly darkSrc: string;
}

/**
 * Dung lop phu gioi thieu va cap anh cua no.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @returns hai component cua san khau gioi thieu.
 */
export function createOnboardingSurface(deps: RenderDeps): {
  OnboardingSurface: (props: OnboardingSurfaceProps) => unknown;
  OnboardingIllustration: (props: OnboardingIllustrationProps) => unknown;
} {
  const { jsx, jsxs } = deps.jsxRuntime;
  const { useRef, useLayoutEffect } = deps.react;

  /**
   * Cap anh di theo bo chon sang/toi cua trang.
   * @param props - dia chi hai anh va hinh hoc cua tinh nang.
   * @returns hai anh trang tri theo giao dien.
   */
  function OnboardingIllustration({ className = "", src, darkSrc }: OnboardingIllustrationProps): unknown {
    return jsxs("div", {
      className: desktopOnboardingStyles.illustration + " " + className,
      "aria-hidden": "true",
      children: [
        jsx("img", { className: desktopOnboardingStyles.lightIllustration, src, alt: "" }),
        jsx("img", { className: desktopOnboardingStyles.darkIllustration, src: darkSrc, alt: "" }),
      ],
    });
  }

  /**
   * Ve san khau gioi thieu qua body va giu nut goc cua ung dung inert trong luc mounted;
   * viec hoan thanh mo lai nut goc ben duoi mot san khau dang mo dan.
   * @param props - noi dung cua buoc va co "dang mo dan" cua chu so huu.
   * @returns cay lop phu duoc render ra body.
   */
  function OnboardingSurface({ children, exiting = false }: OnboardingSurfaceProps): unknown {
    const rootState = useRef<{ element: HTMLElement; opacity: string } | null>(null);
    useLayoutEffect(() => {
      const appRoot = document.getElementById("root");
      if (appRoot === null) return;
      const releaseInert = acquireOverlayInert(appRoot);
      const previousOpacity = appRoot.style.opacity;
      rootState.current = { element: appRoot, opacity: previousOpacity };
      appRoot.style.opacity = "0";
      return () => {
        releaseInert();
        appRoot.style.opacity = previousOpacity;
        rootState.current = null;
      };
    }, []);
    useLayoutEffect(() => {
      const root = rootState.current;
      if (root !== null) root.element.style.opacity = exiting ? root.opacity : "0";
    }, [exiting]);
    return deps.createPortal(
      jsxs("div", {
        className: onboardingSurfaceStyles.onboardingOverlay,
        "data-exiting": exiting || undefined,
        role: "presentation",
        children: [
          jsx("div", { className: onboardingSurfaceStyles.dragBand, "data-window-drag": true, "aria-hidden": "true" }),
          jsx("div", { className: onboardingSurfaceStyles.onboardingStage, children }),
        ],
      }),
      document.body,
    );
  }

  return { OnboardingSurface, OnboardingIllustration };
}
