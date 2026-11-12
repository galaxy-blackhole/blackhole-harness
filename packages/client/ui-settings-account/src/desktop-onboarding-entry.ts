/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chieu hook cua kernel vao phan nhin thuan cua phan gioi thieu Desktop; phien khong dieu khien viec kich hoat
 */

import { desktopOnboardingStyles } from "./class-names.ts";
import type { AccountSnapshot } from "./contracts.ts";
import type { OnboardingState } from "./onboarding-state.ts";
import type { DesktopOnboardingProps } from "./desktop-onboarding.ts";
import type { OnboardingSurfaceProps } from "./onboarding-surface.ts";
import type { RenderDeps } from "./types.ts";

/** Du lieu ma diem vao gioi thieu Desktop nhan: rang buoc lop phu shell va nghiep vu cua tai khoan. */
export type DesktopOnboardingEntryProps = Omit<DesktopOnboardingProps, "state" | "account" | "locale" | "exiting"> & {
  /** Hook trang thai gioi thieu do renderer dung tu kho cua ta. */
  readonly useOnboarding: <T>(select: (state: OnboardingState) => T) => T;
  /** Hook tai khoan do renderer dung tu kho cua ta. */
  readonly useAccount: <T>(select: (snapshot: AccountSnapshot) => T) => T;
  /** Bao lop phu shell co dang hien khong. */
  readonly setVisible: (visible: boolean) => void;
};

/** Cau noi dang nhap Desktop (chi de bat/tat co "dang chiem man hinh"). */
interface OnboardingBridgeLike {
  /** Bat/tat co "dang chiem man hinh". */
  setActive(active: boolean): void;
}

/** Thoi gian giu lai san khau sau khi hoan thanh (ms) — ban goc dung 180. */
const EXIT_MS = 180;

/**
 * Dung diem vao cua phan gioi thieu Desktop.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @param DesktopOnboarding - trang gioi thieu thuan.
 * @param OnboardingSurface - san khau render qua body.
 * @returns component diem vao.
 */
export function createDesktopOnboardingEntry(
  deps: RenderDeps,
  DesktopOnboarding: (props: DesktopOnboardingProps) => unknown,
  OnboardingSurface: (props: OnboardingSurfaceProps) => unknown,
): (props: DesktopOnboardingEntryProps) => unknown {
  const { jsx } = deps.jsxRuntime;
  const { useState, useEffect, useLayoutEffect } = deps.react;

  return function DesktopOnboardingEntry({ useOnboarding, useAccount, setVisible, ...props }: DesktopOnboardingEntryProps): unknown {
    const locale = props.t("onboardingArtworkLocale");
    const state = useOnboarding((value) => value);
    const account = useAccount((value) => value);
    useLayoutEffect(() => {
      if (!state.visible) return;
      const bridge = (globalThis as Record<string, unknown>)["dshOnboarding"] as OnboardingBridgeLike | undefined;
      bridge?.setActive(true);
      return () => {
        bridge?.setActive(false);
      };
    }, [state.visible]);
    const [lastVisible, setLastVisible] = useState<OnboardingState | null>(state.visible ? state : null);
    const done = !state.visible && state.progress.step === "done" && account.view?.status === "credential-stored";
    const pendingCompletion = done && state.status === "saving";
    const completed = done && state.status === "ready";
    const exiting = completed && lastVisible !== null && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    useLayoutEffect(() => {
      if (state.visible) setLastVisible(state);
      else if (!completed && !pendingCompletion) setLastVisible(null);
    }, [state, completed, pendingCompletion]);
    useEffect(() => {
      if (!exiting) return;
      const timer = window.setTimeout(() => {
        setLastVisible(null);
      }, EXIT_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }, [exiting]);
    const displayed = state.visible ? state : exiting || pendingCompletion ? lastVisible : null;
    const visible = displayed !== null || state.status === "loading";
    useLayoutEffect(() => {
      setVisible(visible);
    }, [setVisible, visible]);
    if (displayed === null) {
      return state.status === "loading"
        ? jsx(OnboardingSurface, { children: jsx("div", { className: desktopOnboardingStyles.loading, role: "status", children: props.t("onboardingLoading") }) })
        : null;
    }
    return jsx(DesktopOnboarding, {
      ...props,
      locale,
      state: pendingCompletion ? { ...displayed, status: "saving" } : displayed,
      account,
      exiting,
    });
  };
}
