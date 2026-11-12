/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hop thoai huong dan chi doc cua mot preset — nguyen van cay render ban goc (PresetGuideDialog)
 */

import { GUIDE_DIALOG_CLASS } from "./class-names.ts";
import type { JsxRuntime, Primitives, ReactLike, Translator } from "./runtime.ts";

/** Bon khoa tu dien cua mot muc huong dan ship san. */
export interface PresetGuide {
  /** Khoa ten preset. */
  readonly name: string;
  /** Khoa cau mo dau. */
  readonly intro: string;
  /** Khoa phan giai thich. */
  readonly explanation: string;
  /** Khoa phan cach dung. */
  readonly usage: string;
}

/** Nguon cua mot dong trong so: preset ship san hay do nguoi dung khai. */
export type PresetTrust = "system" | "user";

/**
 * Phan tu ma bo bay ban phim doc duoc: mot phan tu DOM (nho vay phep so sanh danh tinh voi
 * document.activeElement moi co nghia) cong hai API ma bo bay dung.
 */
export type FocusableLike = Element & {
  /** Kiem phan tu co nam trong mot to tien khop selector khong. */
  closest(selector: string): unknown;
  /** Tra focus cho phan tu. */
  focus(): void;
};

/** Su kien ban phim ma hop thoai doc. */
export interface DialogKeyEvent {
  /** Ten phim. */
  readonly key: string;
  /** Phim Shift co duoc giu khong. */
  readonly shiftKey: boolean;
  /** Phan tu dang giu bo lang nghe. */
  readonly currentTarget: { querySelectorAll(selector: string): ArrayLike<FocusableLike> };
  /** Chan hanh vi mac dinh. */
  preventDefault(): void;
  /** Chan su kien noi tiep. */
  stopPropagation(): void;
}

/** Props cua phan "cach dung" trong hop thoai huong dan. */
export interface GuideUsageProps {
  /** Van ban Markdown cua phan cach dung. */
  readonly text: string;
  /** Ham dich cua namespace. */
  readonly t: Translator;
}

/** Props ma khung quan ly tiem vao hop thoai huong dan. */
export interface PresetGuideDialogProps {
  /** Muc huong dan cua preset. */
  readonly guide: PresetGuide;
  /** Trang mo dau ("explanation" hoac "usage"). */
  readonly initialPage: string;
  /** Ham dich cua namespace. */
  readonly t: Translator;
  /** Dong hop thoai. */
  readonly onClose: () => void;
}

/** Phu thuoc ma hop thoai huong dan can. */
export interface GuideDialogDeps {
  /** Runtime JSX. */
  readonly runtime: JsxRuntime;
  /** Hook React. */
  readonly react: ReactLike;
  /** Bo primitive. */
  readonly primitives: Primitives;
}

/** Huong dan ship san: chi bon preset he thong moi co, va khong bao gio doi lua chon dang chon. */
export const GUIDES: ReadonlyMap<string, PresetGuide> = new Map<string, PresetGuide>([
  ["standard", { name: "presetStandardName", intro: "guideStandardIntro", explanation: "guideStandardExplanation", usage: "guideStandardUsage" }],
  ["ptc", { name: "presetPtcName", intro: "guidePtcIntro", explanation: "guidePtcExplanation", usage: "guidePtcUsage" }],
  ["minimal", { name: "presetMinimalName", intro: "guideMinimalIntro", explanation: "guideMinimalExplanation", usage: "guideMinimalUsage" }],
  ["cordis", { name: "presetCordisName", intro: "guideCordisIntro", explanation: "guideCordisExplanation", usage: "guideCordisUsage" }],
]);

/**
 * Tra huong dan chi cho cac preset ship san da biet.
 * Nhan: id — dinh danh preset tu so; trust — nguon cua so (preset nguoi dung tu so huu tuyen bo nang luc).
 * Tra: huong dan ship san, hoac undefined voi preset la va preset nguoi dung.
 */
export function presetGuide(id: string, trust: PresetTrust): PresetGuide | undefined {
  return trust === "system" ? GUIDES.get(id) : undefined;
}

/**
 * Giu focus ban phim trong trinh doc preset khi Tab di qua cac dieu khien cua no.
 * Nhan: event — su kien ban phim tu trinh doc dang hoat dong.
 * Tra: khong co.
 */
export function trapPresetReaderTab(event: DialogKeyEvent): void {
  if (event.key !== "Tab") return;
  const targets = Array.from(event.currentTarget.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]')).filter(
    (element) => !element.closest("[hidden]"),
  );
  const first = targets[0];
  const last = targets[targets.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

/** Nhan ma khoi Markdown cua hop thoai huong dan can. */
interface MarkdownLabels {
  /** Nhan cua khoi ma. */
  readonly code: {
    /** Nhan nut sao chep. */
    readonly copyLabel: string;
    /** Nhan sau khi da sao chep. */
    readonly copiedLabel: string;
    /** Nhan tren thanh cong cu cua khoi ma. */
    readonly toolbarLabels: { readonly codeLabel: string; readonly wrapLabel: string; readonly unwrapLabel: string };
  };
  /** Nhan cua phan chu thich chan trang. */
  readonly footnotes: string;
}

/**
 * Dung nhan cho khoi Markdown — nguyen van hai noi dung ma ban goc dung.
 * Nhan: t — ham dich cua namespace.
 * Tra: doi tuong nhan ma MarkdownText nhan.
 */
function markdownLabels(t: Translator): MarkdownLabels {
  return {
    code: {
      copyLabel: t("guideCopy"),
      copiedLabel: t("guideCopied"),
      toolbarLabels: {
        codeLabel: t("codeBlock.title"),
        wrapLabel: t("codeBlock.wrap"),
        unwrapLabel: t("codeBlock.unwrap"),
      },
    },
    footnotes: t("guideFootnotes"),
  };
}

/**
 * Dung hai component cua hop thoai huong dan.
 * Nhan: deps — runtime JSX, hook React va bo primitive.
 * Tra: cap { GuideUsage, PresetGuideDialog }.
 */
export function createPresetGuideDialog(deps: GuideDialogDeps): {
  GuideUsage: (props: GuideUsageProps) => unknown;
  PresetGuideDialog: (props: PresetGuideDialogProps) => unknown;
} {
  const { jsx, jsxs } = deps.runtime;
  const { useState, useRef, useId, useLayoutEffect } = deps.react;
  const primitives = deps.primitives;

  /**
   * Cac tu dien cach dung chi chua cac muc vi du cap ba.
   * Nhan: props — van ban Markdown va ham dich.
   * Tra: danh sach muc vi du da cat theo tieu de "###".
   */
  function GuideUsage(props: GuideUsageProps): unknown {
    const { text, t } = props;
    const labels = { ...markdownLabels(t) };
    return text.split(/(?=^### )/m).map((section) => {
      const headingEnd = section.indexOf("\n");
      const title = section.slice(4, headingEnd);
      return jsxs(
        "section",
        {
          className: GUIDE_DIALOG_CLASS.guideExample,
          children: [
            jsxs("div", {
              className: GUIDE_DIALOG_CLASS.guideExampleHeader,
              children: [
                jsx("h3", { children: title }),
                jsxs(primitives.Tag, {
                  tone: "neutral",
                  className: GUIDE_DIALOG_CLASS.guideExampleTag,
                  children: [jsx(primitives.IconListPenOutlineRegular, { size: 12 }), t("guideExampleTask")],
                }),
              ],
            }),
            jsx(primitives.MarkdownText, { text: section.slice(headingEnd + 1), labels }),
          ],
        },
        title,
      );
    });
  }

  /**
   * Mo phan huong dan chi doc ma khong doi preset dang chon.
   * Nhan: props — huong dan da dich, trang mo dau va ham dong.
   * Tra: trinh doc dang modal voi vi tri cuon rieng cho tung trang.
   */
  function PresetGuideDialog(props: PresetGuideDialogProps): unknown {
    const { guide, initialPage, t, onClose } = props;
    const [page, setPage] = useState(initialPage);
    const guideId = useId();
    const content = useRef<{ querySelector(selector: string): FocusableLike | null } | null>(null);
    useLayoutEffect(() => {
      content.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus();
    }, []);
    const onKeyDown = (event: DialogKeyEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else trapPresetReaderTab(event);
    };
    return jsx(primitives.Modal, {
      open: true,
      headless: true,
      onClose,
      title: t(guide.name),
      className: GUIDE_DIALOG_CLASS.guideDialog,
      children: jsxs("div", {
        ref: content,
        className: GUIDE_DIALOG_CLASS.guideLayout,
        role: "presentation",
        onKeyDownCapture: onKeyDown,
        children: [
          jsxs("div", {
            className: GUIDE_DIALOG_CLASS.guideHeader,
            children: [
              jsxs("div", {
                className: GUIDE_DIALOG_CLASS.guideTitleRow,
                children: [
                  jsx("h2", { className: GUIDE_DIALOG_CLASS.guideTitle, children: t(guide.name) }),
                  jsx(primitives.Button, {
                    variant: "ghost",
                    className: GUIDE_DIALOG_CLASS.guideClose,
                    "aria-label": t("close"),
                    onClick: onClose,
                    children: jsx(primitives.IconCloseOutlineRegular, { size: 18 }),
                  }),
                ],
              }),
              jsx("p", { className: GUIDE_DIALOG_CLASS.guideIntro, children: t(guide.intro) }),
            ],
          }),
          jsx(primitives.SegmentedTabs, {
            className: GUIDE_DIALOG_CLASS.guideTabs,
            label: t("guideSections"),
            value: page,
            onChange: setPage,
            items: [
              { value: "explanation", label: t("modeExplanation"), id: guideId + "-explanation-tab", panelId: guideId + "-explanation-panel" },
              { value: "usage", label: t("howToUse"), id: guideId + "-usage-tab", panelId: guideId + "-usage-panel" },
            ],
          }),
          ["explanation", "usage"].map((section) =>
            jsx(
              "div",
              {
                id: guideId + "-" + section + "-panel",
                role: "tabpanel",
                "aria-labelledby": guideId + "-" + section + "-tab",
                className: GUIDE_DIALOG_CLASS.guidePanel,
                "data-guide-page": section,
                hidden: page !== section,
                tabIndex: 0,
                children:
                  section === "usage"
                    ? jsx(GuideUsage, { text: t(guide.usage), t })
                    : jsx(primitives.MarkdownText, { text: t(guide.explanation), labels: markdownLabels(t) }),
              },
              section,
            ),
          ),
        ],
      }),
    });
  }

  return { GuideUsage, PresetGuideDialog };
}
