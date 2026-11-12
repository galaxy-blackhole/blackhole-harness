/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khung quan ly preset trong cai dat — nguyen van cay render ban goc (AgentPresetSection)
 */

import { SECTION_CLASS } from "./class-names.ts";
import { isBuiltInPreset, presetDisplayText, requiresCodingTools, type PresetRow } from "./display.ts";
import { presetGuide, trapPresetReaderTab, type DialogKeyEvent, type PresetGuide, type PresetGuideDialogProps } from "./preset-guide.ts";
import type { SectionSnapshot, ViewedPreset } from "./section-store.ts";
import type { JsxRuntime, Primitives, ReactLike, Translator } from "./runtime.ts";

/** Phan tu do duoc de biet mo ta co bi cat khong. */
export interface MeasurableElement {
  /** Chieu cao day du cua noi dung. */
  readonly scrollHeight: number;
  /** Chieu cao vung nhin thay. */
  readonly clientHeight: number;
}

/** Props ma khung cai dat tiem vao khung quan ly preset. */
export interface AgentPresetSectionProps {
  /** Hook chon tu store cua khung quan ly. */
  readonly useAgentPresetSection: <T>(selector: (state: SectionSnapshot) => T) => T;
  /** Nap so preset. */
  readonly load: () => void;
  /** Mo than khai bao cua mot preset. */
  readonly view: (id: string) => void;
  /** Dong trinh xem than khai bao. */
  readonly closeView: () => void;
  /** Dat mot preset lam mac dinh cho phien tao sau. */
  readonly makeDefault: (id: string) => void;
  /** Mo Creator (khong co khi luong chua san sang). */
  readonly startCreatorDraft?: () => void;
  /** Dong khung cai dat. */
  readonly close: () => void;
  /** Hook chon trang thai Cong cu phat trien. */
  readonly useDeveloperTools: <T>(selector: (enabled: boolean) => T) => T;
  /** Ham dich cua namespace. */
  readonly t: Translator;
}

/** Phu thuoc ma khung quan ly can. */
export interface SectionDeps {
  /** Runtime JSX. */
  readonly runtime: JsxRuntime;
  /** Hook React. */
  readonly react: ReactLike;
  /** Bo primitive. */
  readonly primitives: Primitives;
  /** Hop thoai huong dan (do preset-guide dung) — dung NGUYEN props cua no, khong tu che ban sao. */
  readonly PresetGuideDialog: (props: PresetGuideDialogProps) => unknown;
}

/**
 * Dung component khung quan ly preset.
 * Nhan: deps — runtime JSX, hook React, bo primitive va hop thoai huong dan.
 * Tra: component khung (props theo {@link AgentPresetSectionProps}).
 */
export function createAgentPresetSection(deps: SectionDeps): (props: AgentPresetSectionProps) => unknown {
  const { jsx, jsxs } = deps.runtime;
  const { useState, useRef, useEffect, useLayoutEffect } = deps.react;
  const primitives = deps.primitives;
  const PresetGuideDialog = deps.PresetGuideDialog;

  /**
   * Mo ta cua mot dong, tu bat nhan noi khi bi cat.
   * Nhan: props — van ban mo ta.
   * Tra: nhan co tooltip khi noi dung dai hon khung.
   */
  function CardDescription(props: { readonly text: string }): unknown {
    const { text } = props;
    const ref = useRef<MeasurableElement | null>(null);
    const [truncated, setTruncated] = useState(false);
    useLayoutEffect(() => {
      const el = ref.current;
      if (el === null) return;
      const measure = (): void => {
        setTruncated(el.scrollHeight > el.clientHeight);
      };
      measure();
      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(measure);
      observer.observe(el as unknown as Element);
      return () => {
        observer.disconnect();
      };
    }, [text]);
    return jsx(primitives.Tooltip, {
      label: text,
      side: "bottom",
      delayMs: 400,
      disabled: !truncated,
      maxWidth: 360,
      children: jsx("span", { ref, className: SECTION_CLASS.cardDesc, title: "", children: text }),
    });
  }

  /**
   * Ve so preset kem mac dinh, huong dan tung che do, trinh xem than khai bao va loi dan sang Creator.
   * Nhan: props — hanh dong cua Settings, hook anh chup va van ban da dich.
   * Tra: khung cai dat cua preset agent.
   */
  return function AgentPresetSection(props: AgentPresetSectionProps): unknown {
    const { useAgentPresetSection, load, view, closeView, makeDefault, startCreatorDraft, close: closeSettings, useDeveloperTools, t } = props;
    const state = useAgentPresetSection((value) => value);
    const developerTools = useDeveloperTools((enabled) => enabled);
    // Chi mo khi help !== undefined (xem nut "modeExplanation"), nen huong dan trong state KHONG BAO GIO undefined.
    const [guide, setGuide] = useState<{ content: PresetGuide; page: string } | null>(null);
    const viewTrigger = useRef<{ focus(): void } | null>(null);
    const closeViewOnUnmount = useRef(closeView);
    useEffect(() => {
      load();
    }, [load]);
    useLayoutEffect(() => {
      closeViewOnUnmount.current = closeView;
    }, [closeView]);
    useEffect(
      () => () => {
        closeViewOnUnmount.current();
      },
      [],
    );
    const closeViewer = (): void => {
      closeView();
      viewTrigger.current?.focus();
    };
    const viewed: ViewedPreset | null = state.view;
    const viewedRow = viewed === null ? undefined : state.rows.find((row) => row.id === viewed.id);
    const viewedTitle = viewed === null ? "" : viewedRow === undefined ? viewed.title : presetDisplayText(viewedRow, t).name;
    const creator = startCreatorDraft !== undefined && state.rows.some((row) => row.id === "cordis") ? startCreatorDraft : undefined;
    const creatorButton =
      creator === undefined
        ? null
        : jsxs("button", {
            type: "button",
            className: SECTION_CLASS.creatorButton,
            disabled: state.saving,
            onClick: () => {
              creator();
              closeSettings();
            },
            children: [jsx(primitives.IconPlusOutlineRegular, { size: 14 }), t("creatorDraft")],
          });
    return jsxs("section", {
      className: SECTION_CLASS.section,
      children: [
        jsx("h2", { className: SECTION_CLASS.title, children: t("nav") }),
        jsx("p", { className: SECTION_CLASS.intro, children: t("sectionIntro") }),
        state.error === null ? null : jsx("p", { className: SECTION_CLASS.error, role: "alert", children: state.error }),
        [true, false].map((builtIn) => {
          const rows = state.rows.filter((row) => isBuiltInPreset(row) === builtIn && (developerTools || !requiresCodingTools(row)));
          const entry = builtIn ? null : creatorButton;
          if (rows.length === 0 && entry === null) return null;
          return jsxs(
            "section",
            {
              className: SECTION_CLASS.group,
              children: [
                jsx("h3", { className: SECTION_CLASS.groupHead, children: t(builtIn ? "builtInGroup" : "customGroup") }),
                rows.length === 0
                  ? null
                  : jsx("ul", {
                      className: SECTION_CLASS.cards,
                      children: rows.map((row) => {
                        const display = presetDisplayText(row, t);
                        const help = presetGuide(row.id, builtIn ? "system" : "user");
                        const selectionAction = row.broken !== undefined ? t("brokenBadge") : t(row.isDefault === true ? "inUse" : "setDefault");
                        return jsxs(
                          "li",
                          {
                            "data-agent-preset-id": row.id,
                            className: [SECTION_CLASS.card, row.broken === undefined ? undefined : SECTION_CLASS.cardBroken, row.isDefault === true ? SECTION_CLASS.cardActive : undefined]
                              .filter(Boolean)
                              .join(" "),
                            children: [
                              jsxs("button", {
                                type: "button",
                                className: SECTION_CLASS.cardMain,
                                "aria-pressed": row.isDefault,
                                disabled: (row.isDefault ?? false) || (row.broken === undefined && state.saving),
                                "aria-disabled": row.broken !== undefined,
                                "aria-label": selectionAction + ": " + display.name,
                                title: selectionAction,
                                onClick: () => {
                                  if (row.broken === undefined) makeDefault(row.id);
                                },
                                children: [
                                  jsxs("span", {
                                    className: SECTION_CLASS.cardHead,
                                    children: [
                                      jsxs("span", {
                                        className: SECTION_CLASS.cardIdentity,
                                        children: [
                                          jsx("span", { className: SECTION_CLASS.cardName, title: display.name, children: display.name }),
                                          row.broken === undefined
                                            ? null
                                            : jsxs("span", {
                                                className: SECTION_CLASS.brokenBadge,
                                                children: [
                                                  t("brokenBadge"),
                                                  jsx("span", { className: SECTION_CLASS.brokenTip, "aria-hidden": "true", children: row.broken }),
                                                ],
                                              }),
                                          jsx(primitives.Tag, {
                                            tone: row.isDefault === true ? "solid" : "outline",
                                            children: row.isDefault === true ? t("inUse") : t(builtIn ? "builtInGroup" : "customGroup"),
                                          }),
                                        ],
                                      }),
                                      jsx("code", { className: SECTION_CLASS.cardId, title: row.id, children: row.id }),
                                    ],
                                  }),
                                  jsx(CardDescription, { text: display.description ?? t("noDescription") }),
                                  row.broken === undefined
                                    ? null
                                    : jsx("span", { className: SECTION_CLASS.cardBrokenReason, role: "alert", children: row.broken }),
                                ],
                              }),
                              jsxs("div", {
                                className: SECTION_CLASS.cardFoot,
                                children: [
                                  help === undefined
                                    ? null
                                    : jsxs("div", {
                                        className: SECTION_CLASS.cardHelp,
                                        children: [
                                          jsx(primitives.Button, {
                                            variant: "ghost",
                                            className: SECTION_CLASS.helpButton,
                                            "aria-label": t("modeExplanation") + ": " + display.name,
                                            onClick: () => {
                                              setGuide({ content: help, page: "explanation" });
                                            },
                                            children: t("modeExplanation"),
                                          }),
                                          jsx(primitives.Button, {
                                            variant: "ghost",
                                            className: SECTION_CLASS.helpButton,
                                            "aria-label": t("howToUse") + ": " + display.name,
                                            onClick: () => {
                                              setGuide({ content: help, page: "usage" });
                                            },
                                            children: t("howToUse"),
                                          }),
                                        ],
                                      }),
                                  jsx("button", {
                                    type: "button",
                                    className: SECTION_CLASS.iconButton,
                                    "data-tip": t("view"),
                                    "aria-label": t("view") + ": " + display.name,
                                    onClick: (event: { readonly currentTarget: { focus(): void } }) => {
                                      viewTrigger.current = event.currentTarget;
                                      view(row.id);
                                    },
                                    children: jsx(primitives.IconBrowseOutlineRegular, {}),
                                  }),
                                ],
                              }),
                            ],
                          },
                          row.id,
                        );
                      }),
                    }),
                entry,
              ],
            },
            String(builtIn),
          );
        }),
        guide === null
          ? null
          : jsx(PresetGuideDialog, {
              guide: guide.content,
              initialPage: guide.page,
              t,
              onClose: () => {
                setGuide(null);
              },
            }),
        jsx(primitives.Modal, {
          open: viewed !== null,
          onClose: closeViewer,
          closeLabel: t("close"),
          onKeyDownCapture: (event: DialogKeyEvent) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeViewer();
            } else trapPresetReaderTab(event);
          },
          title: viewed === null ? "" : t("view") + " · " + viewedTitle,
          className: SECTION_CLASS.dialog,
          footer: jsx(primitives.Button, {
            variant: "outline",
            autoFocus: true,
            onClick: closeViewer,
            children: t("close"),
          }),
          children:
            viewed === null
              ? null
              : jsx("pre", { className: SECTION_CLASS.viewerCode, children: viewed.content }),
        }),
      ],
    });
  };
}

/** Kieu dong ma khung ve — xuat lai cho test doc de dang. */
export type { PresetRow };
