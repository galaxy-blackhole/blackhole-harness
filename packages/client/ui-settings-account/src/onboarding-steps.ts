/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bon buoc cua gioi thieu Desktop (chao · nap tien · muc dich · muc do chi tiet) va hop thoai xac nhan cua chung
 */

import { PURPOSE_ARTWORK, PROCESS_ICONS, RECHARGE_ARTWORK, WELCOME_ARTWORK } from "./assets.ts";
import { desktopOnboardingStyles } from "./class-names.ts";
import type { OnboardingIllustrationProps } from "./onboarding-surface.ts";
import type { RenderDeps, Translator } from "./types.ts";

/** Phan chung cua bon buoc: ban dich, tieu de duoc focus va co "dang ban". */
export interface StepCommonProps {
  /** Ham dich cua namespace settings.account. */
  readonly t: Translator;
  /** O nho cua the h1 de focus sau moi lan doi buoc. */
  readonly heading: { current: HTMLElement | null };
  /** Co "dang ban" cua trang. */
  readonly busy: boolean;
}

/** Du lieu ma buoc chao nhan. */
export interface WelcomeStepProps extends StepCommonProps {
  /** Ngon ngu dang dung (en hoac zh) — chon bo anh. */
  readonly locale: string;
  /** Bat dau thiet lap. */
  readonly onStart: () => void;
}

/** Du lieu ma buoc nap tien nhan. */
export interface CreditStepProps extends StepCommonProps {
  /** Ngon ngu dang dung — chon bo anh. */
  readonly locale: string;
  /** Vi nap tien da co tin dung chua. */
  readonly funded: boolean;
  /** Vo Desktop co mo duoc trang Platform khong. */
  readonly canRecharge: boolean;
  /** Di tiep khi da co tin dung. */
  readonly onContinue: () => void;
  /** Mo trang nap tien. */
  readonly onRecharge: () => void;
  /** Di tiep ma khong nap. */
  readonly onLater: () => void;
}

/** Du lieu ma buoc chon muc dich nhan. */
export interface PurposeStepProps extends StepCommonProps {
  /** Muc dich dang chon. */
  readonly purpose: string | null;
  /** Ghi muc dich moi. */
  readonly onSelect: (purpose: string | null) => void;
  /** Di tiep. */
  readonly onContinue: () => void;
}

/** Du lieu ma buoc chon muc do chi tiet nhan. */
export interface ProcessStepProps extends StepCommonProps {
  /** Muc do dang chon. */
  readonly process: string | null;
  /** Ghi muc do moi. */
  readonly onSelect: (process: string) => void;
  /** Vao ung dung. */
  readonly onComplete: () => void;
}

/** Du lieu ma hop thoai xac nhan nhan. */
export interface ConfirmationProps {
  /** Loai xac nhan: skip · credit · credit-skip. */
  readonly kind: string;
  /** Ham dich cua namespace settings.account. */
  readonly t: Translator;
  /** Co "dang ban". */
  readonly busy: boolean;
  /** Vo Desktop co mo duoc trang Platform khong. */
  readonly canRecharge: boolean;
  /** Dong hop thoai. */
  readonly onClose: () => void;
  /** Tiep tuc thiet lap. */
  readonly onContinueSetup: () => void;
  /** Di tiep trong luong (khong nap tien). */
  readonly onContinue: () => void;
  /** Mo trang nap tien. */
  readonly onRecharge: () => void;
  /** Bo qua / vao ung dung. */
  readonly onSkip: () => void;
}

/** Ba lua chon muc do chi tiet — nguyen van thu tu va chu cua ban goc. */
const PROCESS_OPTIONS: ReadonlyArray<{ value: string; titleKey: string; descriptionKey: string; icon: string; size: number }> = [
  { value: "compact", titleKey: "onboardingCompact", descriptionKey: "onboardingCompactDescription", icon: PROCESS_ICONS.compact, size: 40 },
  { value: "standard", titleKey: "onboardingStandard", descriptionKey: "onboardingStandardDescription", icon: PROCESS_ICONS.standard, size: 36 },
  { value: "detailed", titleKey: "onboardingDetailed", descriptionKey: "onboardingDetailedDescription", icon: PROCESS_ICONS.detailed, size: 36 },
];

/** Nam bieu tuong tep cua the "van phong" — nguyen van ban goc. */
const OFFICE_FILE_KINDS: readonly string[] = ["word", "ppt", "excel", "pdf", "image"];

/** Nam bieu tuong tep cua the "lap trinh" — nguyen van ban goc. */
const CODE_FILE_KINDS: readonly string[] = ["typescript", "javascript", "sql", "python", "cpp"];

/** Cac component ma cac buoc dung lai. */
export interface OnboardingStepsDeps {
  /** Cap anh doi theo giao dien. */
  readonly OnboardingIllustration: (props: OnboardingIllustrationProps) => unknown;
}

/**
 * Dung bon buoc gioi thieu va hop thoai xac nhan.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @param parts - cac component dung lai.
 * @returns nam component cua luong gioi thieu.
 */
export function createOnboardingSteps(
  deps: RenderDeps,
  parts: OnboardingStepsDeps,
): {
  OnboardingWelcomeStep: (props: WelcomeStepProps) => unknown;
  OnboardingCreditStep: (props: CreditStepProps) => unknown;
  OnboardingPurposeStep: (props: PurposeStepProps) => unknown;
  OnboardingProcessStep: (props: ProcessStepProps) => unknown;
  OnboardingConfirmation: (props: ConfirmationProps) => unknown;
} {
  const { jsx, jsxs } = deps.jsxRuntime;
  const { useState, useRef, useLayoutEffect } = deps.react;
  const { Button, Modal, FileTypeIcon, IconCheckOutlineRegular, IconCloseOutlineRegular } = deps.primitives;
  const { OnboardingIllustration } = parts;

  /**
   * Buoc chao.
   * @param props - noi dung da ban dich, dich focus va dieu huong.
   * @returns buoc chao.
   */
  function OnboardingWelcomeStep({ t, locale, heading, busy, onStart }: WelcomeStepProps): unknown {
    return jsxs("div", {
      className: desktopOnboardingStyles.content + " " + desktopOnboardingStyles.welcome,
      children: [
        jsxs("div", {
          className: desktopOnboardingStyles.copy,
          children: [
            jsxs("h1", {
              id: "desktop-onboarding-title",
              ref: heading,
              tabIndex: -1,
              children: [t("onboardingWelcome"), " ", jsx("em", { className: desktopOnboardingStyles.brand, children: t("onboardingBrand") })],
            }),
            jsx("p", { className: desktopOnboardingStyles.heroDescription, children: t("onboardingIntroduction") }),
            jsx(Button, {
              variant: "primary",
              className: desktopOnboardingStyles.action + " " + desktopOnboardingStyles.start,
              disabled: busy,
              onClick: onStart,
              children: t("onboardingStart"),
            }),
          ],
        }),
        jsx("div", {
          className: desktopOnboardingStyles.welcomeIllustration,
          "aria-hidden": "true",
          children: jsx(OnboardingIllustration, {
            className: desktopOnboardingStyles.welcomeArtwork,
            src: locale === "zh" ? WELCOME_ARTWORK.lightZh : WELCOME_ARTWORK.light,
            darkSrc: locale === "zh" ? WELCOME_ARTWORK.darkZh : WELCOME_ARTWORK.dark,
          }),
        }),
      ],
    });
  }

  /**
   * Buoc nap tien.
   * @param props - su that ve tin dung, noi dung da ban dich va hanh dong nap/di tiep.
   * @returns buoc nap tien.
   */
  function OnboardingCreditStep({ t, locale, heading, busy, funded, canRecharge, onContinue, onRecharge, onLater }: CreditStepProps): unknown {
    return jsxs("div", {
      className: desktopOnboardingStyles.content + " " + desktopOnboardingStyles.credit,
      children: [
        jsx(OnboardingIllustration, {
          className: desktopOnboardingStyles.creditIllustration,
          src: locale === "zh" ? RECHARGE_ARTWORK.lightZh : RECHARGE_ARTWORK.light,
          darkSrc: locale === "zh" ? RECHARGE_ARTWORK.darkZh : RECHARGE_ARTWORK.dark,
        }),
        jsxs("div", {
          className: desktopOnboardingStyles.copy,
          children: [
            jsx("h1", { id: "desktop-onboarding-title", ref: heading, tabIndex: -1, children: t("onboardingCredit") }),
            jsx("p", { className: desktopOnboardingStyles.heroDescription, children: t("onboardingCreditDescription") }),
            jsxs("div", {
              className: desktopOnboardingStyles.creditActions,
              children: [
                jsx(Button, {
                  className: desktopOnboardingStyles.action,
                  variant: "primary",
                  disabled: busy || (!funded && !canRecharge),
                  onClick: funded ? onContinue : onRecharge,
                  children: t(funded ? "onboardingContinue" : "onboardingTopUp"),
                }),
                jsx(Button, {
                  variant: "outline",
                  className: desktopOnboardingStyles.action + " " + desktopOnboardingStyles.laterAction,
                  disabled: busy || (funded && !canRecharge),
                  onClick: funded ? onRecharge : onLater,
                  children: t(funded ? "onboardingFundedTopUp" : "onboardingLater"),
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  /**
   * The chon muc dich, co hieu ung bieu tuong khi vua duoc chon.
   * @param props - muc dich cua the, trang thai chon, ban dich va ham doi trang thai.
   * @returns mot the chon muc dich.
   */
  function PurposeCard({ purpose, checked, t, onToggle }: { purpose: string; checked: boolean; t: Translator; onToggle: () => void }): unknown {
    const previous = useRef(checked);
    const [entering, setEntering] = useState(false);
    useLayoutEffect(() => {
      setEntering(checked && !previous.current);
      previous.current = checked;
    }, [checked]);
    const titleKey = purpose === "office" ? "onboardingOffice" : "onboardingDevelopment";
    return jsxs("div", {
      className: desktopOnboardingStyles.card + " " + (checked ? desktopOnboardingStyles.selected : "") + " " + (purpose === "office" ? desktopOnboardingStyles.officeCard : ""),
      children: [
        jsxs("div", {
          className: desktopOnboardingStyles.cardTop,
          children: [
            checked
              ? jsx("span", {
                  className: desktopOnboardingStyles.fileIcons + " " + (entering ? desktopOnboardingStyles.iconsEntering : ""),
                  "aria-hidden": "true",
                  children: (purpose === "office" ? OFFICE_FILE_KINDS : CODE_FILE_KINDS).map((kind) => jsx(FileTypeIcon, { kind, size: 28 }, kind)),
                })
              : jsx("img", { src: purpose === "office" ? PURPOSE_ARTWORK.office : PURPOSE_ARTWORK.code, width: 40, height: 40, alt: "" }),
            jsxs("label", {
              className: desktopOnboardingStyles.cardCheckbox,
              children: [
                jsx("input", { type: "checkbox", "aria-label": t(titleKey), checked, onChange: onToggle }),
                jsx("span", { className: desktopOnboardingStyles.indicator, "aria-hidden": "true", children: jsx(IconCheckOutlineRegular, {}) }),
              ],
            }),
          ],
        }),
        jsx("span", { className: desktopOnboardingStyles.cardTitle, children: t(titleKey) }),
        jsx("span", { className: desktopOnboardingStyles.cardDescription, children: t(purpose === "office" ? "onboardingOfficeDescription" : "onboardingDevelopmentDescription") }),
      ],
    });
  }

  /**
   * Buoc chon muc dich lam viec voi hai the chon doc lap.
   * @param props - muc dich dang chon, noi dung da ban dich va ham ghi.
   * @returns buoc chon muc dich.
   */
  function OnboardingPurposeStep({ t, heading, busy, purpose, onSelect, onContinue }: PurposeStepProps): unknown {
    /**
     * Da chon muc dich nay chua.
     * @param value - office hoac development.
     * @returns true khi duoc chon.
     */
    const selected = (value: string): boolean => purpose === value || purpose === "both";
    /**
     * Dao trang thai mot the va gop lai thanh gia tri cua Host.
     * @param value - office hoac development.
     */
    const toggle = (value: string): void => {
      if (busy) return;
      const office = value === "office" ? !selected("office") : selected("office");
      const development = value === "development" ? !selected("development") : selected("development");
      onSelect(office && development ? "both" : office ? "office" : development ? "development" : null);
    };
    return jsxs("div", {
      className: desktopOnboardingStyles.content + " " + desktopOnboardingStyles.purpose,
      children: [
        jsxs("div", {
          className: desktopOnboardingStyles.copy,
          children: [
            jsxs("h1", {
              id: "desktop-onboarding-title",
              ref: heading,
              tabIndex: -1,
              children: [t("onboardingPurposePrefix"), " ", jsx("em", { className: desktopOnboardingStyles.brand, children: t("onboardingBrand") }), " ", t("onboardingPurposeSuffix")],
            }),
            jsx("p", { className: desktopOnboardingStyles.subtitle, children: t("onboardingPurposeDescription") }),
          ],
        }),
        jsx("div", {
          className: desktopOnboardingStyles.purposeCards,
          children: ["office", "development"].map((value) =>
            jsx(
              PurposeCard,
              {
                purpose: value,
                checked: selected(value),
                t,
                onToggle: () => {
                  toggle(value);
                },
              },
              value,
            ),
          ),
        }),
        jsx("div", {
          className: desktopOnboardingStyles.primaryAction,
          children:
            purpose !== null &&
            jsx(Button, {
              className: desktopOnboardingStyles.action,
              variant: "primary",
              "aria-disabled": busy,
              onClick: () => {
                if (!busy) onContinue();
              },
              children: t("onboardingContinue"),
            }),
        }),
      ],
    });
  }

  /**
   * Buoc chon muc do chi tiet voi nhom radio dieu huong bang ban phim.
   * @param props - muc do dang chon, noi dung da ban dich va ham ghi.
   * @returns buoc chon muc do chi tiet.
   */
  function OnboardingProcessStep({ t, heading, busy, process, onSelect, onComplete }: ProcessStepProps): unknown {
    /**
     * Di chuyen lua chon bang phim mui ten.
     * @param event - su kien ban phim.
     * @param value - muc do cua the dang focus.
     */
    const onKeyDown = (event: { key: string; preventDefault: () => void; currentTarget: { parentElement: { querySelector: (selector: string) => { focus: () => void } | null } | null } }, value: string): void => {
      if (busy) return;
      const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
      if (direction === 0) return;
      event.preventDefault();
      const index = PROCESS_OPTIONS.findIndex((option) => option.value === value);
      const next = PROCESS_OPTIONS[(index + direction + PROCESS_OPTIONS.length) % PROCESS_OPTIONS.length];
      if (next === undefined) return;
      onSelect(next.value);
      event.currentTarget.parentElement?.querySelector('[data-process="' + next.value + '"]')?.focus();
    };
    return jsxs("div", {
      className: desktopOnboardingStyles.content + " " + desktopOnboardingStyles.process,
      children: [
        jsxs("div", {
          className: desktopOnboardingStyles.copy,
          children: [
            jsx("h1", { id: "desktop-onboarding-title", ref: heading, tabIndex: -1, children: t("onboardingProcess") }),
            jsx("p", { className: desktopOnboardingStyles.subtitle, children: t("onboardingProcessDescription") }),
          ],
        }),
        jsx("div", {
          className: desktopOnboardingStyles.processCards,
          role: "radiogroup",
          "aria-labelledby": "desktop-onboarding-title",
          children: PROCESS_OPTIONS.map((option) =>
            jsxs(
              "button",
              {
                type: "button",
                role: "radio",
                "data-process": option.value,
                "aria-checked": process === option.value,
                tabIndex: process === option.value || (process === null && option.value === "compact") ? 0 : -1,
                className: desktopOnboardingStyles.card + " " + (process === option.value ? desktopOnboardingStyles.selected : ""),
                "aria-disabled": busy,
                onClick: () => {
                  if (!busy) onSelect(option.value);
                },
                onKeyDown: (event: unknown) => {
                  onKeyDown(event as Parameters<typeof onKeyDown>[0], option.value);
                },
                children: [
                  jsx("span", { className: desktopOnboardingStyles.processIcon, children: jsx("img", { src: option.icon, width: option.size, height: option.size, alt: "" }) }),
                  jsx("span", { className: desktopOnboardingStyles.cardTitle, children: t(option.titleKey) }),
                  jsx("span", { className: desktopOnboardingStyles.cardDescription, children: t(option.descriptionKey) }),
                ],
              },
              option.value,
            ),
          ),
        }),
        jsx("div", {
          className: desktopOnboardingStyles.primaryAction,
          children:
            process !== null &&
            jsx(Button, {
              className: desktopOnboardingStyles.action,
              variant: "primary",
              "aria-disabled": busy,
              onClick: () => {
                if (!busy) onComplete();
              },
              children: t("onboardingEnter"),
            }),
        }),
      ],
    });
  }

  /**
   * Hop thoai xac nhan khi nap tien hoac bo qua thiet lap.
   * @param props - hanh dong xac nhan, noi dung da ban dich va cac ham dieu huong.
   * @returns hop thoai xac nhan duoc giu focus.
   */
  function OnboardingConfirmation({ kind, t, busy, canRecharge, onClose, onContinueSetup, onContinue, onRecharge, onSkip }: ConfirmationProps): unknown {
    const credit = kind !== "skip";
    const title = t(credit ? "onboardingNoCreditTitle" : "onboardingSkipTitle");
    return jsx(Modal, {
      open: true,
      headless: true,
      backdropBlur: false,
      title,
      onClose,
      children: jsxs("div", {
        className: desktopOnboardingStyles.confirmation,
        children: [
          jsxs("div", {
            className: desktopOnboardingStyles.confirmationHeading,
            children: [
              jsx("h2", { children: title }),
              jsx("button", {
                type: "button",
                className: desktopOnboardingStyles.confirmationClose,
                "aria-label": t("close"),
                onClick: onClose,
                children: jsx(IconCloseOutlineRegular, { size: 14 }),
              }),
            ],
          }),
          jsx("p", { children: t(credit ? "onboardingNoCreditDescription" : "onboardingSkipDescription") }),
          jsxs("div", {
            className: desktopOnboardingStyles.confirmationActions,
            children: [
              jsx(Button, {
                className: desktopOnboardingStyles.dialogButton,
                variant: "outline",
                disabled: busy,
                onClick: kind === "credit-skip" ? onSkip : kind === "credit" ? onContinue : onContinueSetup,
                children: t(credit ? "onboardingUnderstood" : "onboardingKeepSetting"),
              }),
              jsx(Button, {
                className: desktopOnboardingStyles.dialogButton,
                variant: "primary",
                disabled: busy || (credit && !canRecharge),
                onClick: credit ? onRecharge : onSkip,
                children: t(credit ? "onboardingGoTopUp" : "onboardingEnter"),
              }),
            ],
          }),
        ],
      }),
    });
  }

  return { OnboardingWelcomeStep, OnboardingCreditStep, OnboardingPurposeStep, OnboardingProcessStep, OnboardingConfirmation };
}
