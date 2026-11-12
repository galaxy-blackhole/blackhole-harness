/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Trang gioi thieu Desktop: chon buoc theo tien do ben vung, chuyen trang co hieu ung va do luong tung trang
 */

import { BACK_ICON_MASK } from "./assets.ts";
import { desktopOnboardingStyles } from "./class-names.ts";
import { hasOnboardingCredit } from "./onboarding-balance.ts";
import type { OnboardingState } from "./onboarding-state.ts";
import type { AccountSnapshot } from "./contracts.ts";
import type { OnboardingSurfaceProps } from "./onboarding-surface.ts";
import type { ConfirmationProps, CreditStepProps, ProcessStepProps, PurposeStepProps, WelcomeStepProps } from "./onboarding-steps.ts";
import type { RenderDeps, Translator } from "./types.ts";

/** Ten trang do luong ma ban goc gui len — nguyen van ban goc. */
export const ONBOARDING_PAGES: Readonly<Record<string, string | undefined>> = {
  welcome: "onboarding_welcome",
  credit: "onboarding_recharge",
  purpose: "onboarding_use_case",
  process: "onboarding_process",
  done: undefined,
};

/** Du lieu ma trang gioi thieu Desktop nhan. */
export interface DesktopOnboardingProps {
  /** Trang thai lop phu do bo dieu khien phat. */
  readonly state: OnboardingState;
  /** Anh chup tai khoan. */
  readonly account: AccountSnapshot;
  /** Mo mot trang Platform (chi co khi vo Desktop tiem dshPlatform). */
  readonly openPlatformPage?: (page: string, onClose: (reason: string) => void) => () => void;
  /** Ghi mot phan tien do. */
  readonly update: (change: Record<string, unknown>) => Promise<boolean>;
  /** Ket thuc phan gioi thieu. */
  readonly complete: (reason: string) => Promise<boolean>;
  /** Thu lai lan ghi that bai. */
  readonly retry: () => Promise<boolean>;
  /** Ham dich cua namespace settings.account. */
  readonly t: Translator;
  /** Ngon ngu dang dung — de the <section lang>. */
  readonly locale: string;
  /** Ham do luong cua product analytics. */
  readonly track?: (name: string, attributes: Record<string, unknown>) => void;
  /** Chu so huu dang giu san khau them 180ms sau khi hoan thanh. */
  readonly exiting?: boolean;
}

/** Cac component ma trang gioi thieu dung lai. */
export interface DesktopOnboardingParts {
  /** San khau render qua body. */
  readonly OnboardingSurface: (props: OnboardingSurfaceProps) => unknown;
  /** Buoc chao. */
  readonly OnboardingWelcomeStep: (props: WelcomeStepProps) => unknown;
  /** Buoc nap tien. */
  readonly OnboardingCreditStep: (props: CreditStepProps) => unknown;
  /** Buoc chon muc dich. */
  readonly OnboardingPurposeStep: (props: PurposeStepProps) => unknown;
  /** Buoc chon muc do chi tiet. */
  readonly OnboardingProcessStep: (props: ProcessStepProps) => unknown;
  /** Hop thoai xac nhan. */
  readonly OnboardingConfirmation: (props: ConfirmationProps) => unknown;
}

/** Do tre hieu ung chuyen trang (ms) — ban goc dung 40. */
const TRANSITION_MS = 40;

/**
 * Dung trang gioi thieu Desktop.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @param parts - cac component dung lai.
 * @returns component trang gioi thieu Desktop.
 */
export function createDesktopOnboarding(deps: RenderDeps, parts: DesktopOnboardingParts): (props: DesktopOnboardingProps) => unknown {
  const { jsx, jsxs, Fragment } = deps.jsxRuntime;
  const { useState, useRef, useEffect } = deps.react;
  const { Button } = deps.primitives;
  const { OnboardingSurface, OnboardingWelcomeStep, OnboardingCreditStep, OnboardingPurposeStep, OnboardingProcessStep, OnboardingConfirmation } = parts;

  return function DesktopOnboarding({ state, account, openPlatformPage, update, complete, retry, t, locale, track, exiting = false }: DesktopOnboardingProps): unknown {
    const [dialog, setDialog] = useState<string | null>(null);
    const heading = useRef<HTMLElement | null>(null);
    const page = useRef<HTMLElement | null>(null);
    const releaseRecharge = useRef<(() => void) | undefined>(undefined);
    useEffect(() => () => {
      releaseRecharge.current?.();
      releaseRecharge.current = undefined;
    }, []);
    const progress = state.progress;
    const targetStep = progress.step;
    const [step, setStep] = useState(targetStep);
    const busy = state.status === "loading" || state.status === "saving" || exiting || step !== targetStep;
    useEffect(() => {
      if (step === targetStep) return;
      const element = page.current;
      if (!state.visible || element?.animate === undefined || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setStep(targetStep);
        return;
      }
      const animation = element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: TRANSITION_MS, fill: "forwards", easing: "ease-out" });
      animation.finished.then(
        () => {
          setStep(targetStep);
        },
        () => undefined,
      );
      return () => {
        animation.cancel();
      };
    }, [targetStep, step, state.visible]);
    useEffect(() => {
      heading.current?.focus();
    }, [step]);
    const pageName = ONBOARDING_PAGES[step];
    const shownPage = useRef<string | null>(null);
    useEffect(() => {
      if (!state.visible || pageName === undefined || exiting) {
        shownPage.current = null;
        return;
      }
      if (state.status === "loading") return;
      if (shownPage.current === pageName) return;
      shownPage.current = pageName;
      track?.("onboarding_page_view", { page_name: pageName });
    }, [state.visible, state.status, step, pageName, exiting, track]);
    const shownPopup = useRef<string | null>(null);
    useEffect(() => {
      if (dialog === null || !state.visible || state.status === "loading" || step === "done") {
        shownPopup.current = null;
        return;
      }
      if (shownPopup.current === dialog) return;
      shownPopup.current = dialog;
      track?.("onboarding_popup_view", { popup_name: dialog === "skip" ? "skip_setting" : "skip_charge" });
    }, [dialog, track, state.visible, state.status, step]);
    /**
     * Do luong mot cu click trong hop thoai.
     * @param button_name - ten nut da bam.
     */
    const popupClick = (button_name: string): void => {
      track?.("onboarding_popup_click", { popup_name: dialog === "skip" ? "skip_setting" : "skip_charge", button_name });
    };
    if (state.visible && state.status === "loading") {
      return jsx(OnboardingSurface, {
        children: jsx("div", { className: desktopOnboardingStyles.loading, role: "status", children: t("onboardingLoading") }),
      });
    }
    if (!state.visible || pageName === undefined) return null;
    /**
     * Do luong mot cu click tren trang.
     * @param button_name - ten nut da bam.
     */
    const click = (button_name: string): void => {
      const selected_content =
        step === "purpose" && progress.purpose !== null
          ? { office: "office", development: "code", both: "code_office" }[progress.purpose]
          : step === "process" && progress.process !== null
            ? { compact: "focus_result", standard: "key_detail", detailed: "full_process" }[progress.process]
            : undefined;
      track?.("onboarding_page_click", { page_name: pageName, button_name, ...(selected_content === undefined ? {} : { selected_content }) });
    };
    /**
     * Di sang buoc ke tiep.
     * @param next - ten buoc.
     */
    const go = (next: string): void => {
      void update({ step: next });
    };
    const canRecharge = openPlatformPage !== undefined;
    /** Mo trang nap tien cua Platform. */
    const recharge = (): void => {
      setDialog(null);
      releaseRecharge.current?.();
      releaseRecharge.current = openPlatformPage?.("top-up", () => {
        releaseRecharge.current = undefined;
      });
    };
    /** Di tiep tu buoc nap tien, hoi them neu chua co tin dung. */
    const later = (): void => {
      const balance = account.details?.balance;
      if (balance?.status === "ready" && !hasOnboardingCredit(balance)) setDialog("credit");
      else go("purpose");
    };
    /** Di tiep tu buoc chon muc dich. */
    const purposeNext = (): void => {
      if (progress.purpose === "office") void complete("completed");
      else go("process");
    };
    return jsxs(Fragment, {
      children: [
        jsx(OnboardingSurface, {
          exiting,
          children: jsxs(
            "section",
            {
              ref: page,
              className: desktopOnboardingStyles.page + " " + (dialog !== null ? desktopOnboardingStyles.blurred : ""),
              "data-desktop-onboarding": step,
              lang: locale,
              "aria-labelledby": "desktop-onboarding-title",
              "aria-busy": busy,
              children: [
                step === "welcome" &&
                  jsx(OnboardingWelcomeStep, {
                    t,
                    locale,
                    heading,
                    busy,
                    onStart: () => {
                      click("next");
                      go("credit");
                    },
                  }),
                step === "credit" &&
                  jsx(OnboardingCreditStep, {
                    t,
                    locale,
                    heading,
                    busy,
                    funded: state.creditFunded,
                    canRecharge,
                    onContinue: () => {
                      click("continue");
                      go("purpose");
                    },
                    onRecharge: () => {
                      click("charge");
                      recharge();
                    },
                    onLater: () => {
                      click("later");
                      later();
                    },
                  }),
                step === "purpose" &&
                  jsx(OnboardingPurposeStep, {
                    t,
                    heading,
                    busy,
                    purpose: progress.purpose,
                    onSelect: (purpose: string | null) => {
                      void update({ purpose });
                    },
                    onContinue: () => {
                      click("next");
                      purposeNext();
                    },
                  }),
                step === "process" &&
                  jsx(OnboardingProcessStep, {
                    t,
                    heading,
                    busy,
                    process: progress.process,
                    onSelect: (process: string) => {
                      void update({ process });
                    },
                    onComplete: () => {
                      click("next");
                      void complete("completed");
                    },
                  }),
                state.error !== null &&
                  jsxs("div", {
                    className: desktopOnboardingStyles.status,
                    role: "alert",
                    children: [
                      t("onboardingSaveFailed"),
                      jsx(Button, {
                        disabled: busy,
                        onClick: () => {
                          void retry();
                        },
                        children: t("onboardingRetry"),
                      }),
                    ],
                  }),
                step !== "welcome" &&
                  jsxs("footer", {
                    className: desktopOnboardingStyles.navigation,
                    children: [
                      jsxs("button", {
                        type: "button",
                        disabled: busy,
                        onClick: () => {
                          click("back");
                          go(step === "credit" ? "welcome" : step === "purpose" ? "credit" : "purpose");
                        },
                        children: [
                          jsx("span", {
                            className: desktopOnboardingStyles.backIcon,
                            style: { maskImage: "url(" + BACK_ICON_MASK + ")" },
                            "aria-hidden": "true",
                          }),
                          t("onboardingBack"),
                        ],
                      }),
                      jsx("button", {
                        type: "button",
                        disabled: busy,
                        onClick: () => {
                          click("skip");
                          setDialog(step === "credit" ? "credit-skip" : "skip");
                        },
                        children: t("onboardingSkip"),
                      }),
                    ],
                  }),
              ],
            },
            step,
          ),
        }),
        dialog !== null &&
          jsx(OnboardingConfirmation, {
            kind: dialog,
            t,
            busy,
            canRecharge,
            onClose: () => {
              popupClick("close");
              setDialog(null);
            },
            onContinueSetup: () => {
              popupClick("setting");
              setDialog(null);
            },
            onContinue: () => {
              popupClick("know");
              setDialog(null);
              go("purpose");
            },
            onRecharge: () => {
              popupClick("charge");
              recharge();
            },
            onSkip: () => {
              popupClick(dialog === "skip" ? "enter" : "know");
              void complete("skipped").then(() => {
                setDialog(null);
              });
            },
          }),
      ],
    });
  };
}
