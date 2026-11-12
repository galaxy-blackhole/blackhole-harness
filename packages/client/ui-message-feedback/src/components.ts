/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hai component cua row ui-message-feedback: nut Like/Dislike tung tin nhan va hop thoai phan hoi
 */

import { ACTIONS_CLASS, DIALOG_CLASS } from "./class-names";
import { categoryKeys, type MessageFeedbackKey } from "./locales";
import type {
  FeedbackCategory,
  MessageFeedbackActionResult,
  MessageFeedbackItem,
  MessageFeedbackRating,
  MessageFeedbackView,
} from "./controller";
import type { FeedbackDialogState } from "./dialog";

/** Ham jsx/jsxs cua `react/jsx-runtime`. */
type JsxFn = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => unknown;

/** Mat `react/jsx-runtime` ma row nay dung. */
export interface JsxRuntime {
  /** Tao mot phan tu co mot con. */
  jsx: JsxFn;
  /** Tao mot phan tu co nhieu con tinh. */
  jsxs: JsxFn;
  /** Phan tu bao ngoai khong co the that. */
  Fragment: unknown;
}

/** Mat hook cua `react` ma row nay dung. */
export interface ReactHooks {
  /** Tham chieu khong doi giua cac lan ve. */
  useRef: <T>(initial: T) => { current: T };
  /** Trang thai cua component. */
  useState: <T>(initial: T) => [T, (next: T) => void];
  /** Ham nho theo phu thuoc. */
  useCallback: <T>(callback: T, deps: readonly unknown[]) => T;
  /** Hieu ung sau khi ve. */
  useEffect: (callback: () => void | (() => void), deps: readonly unknown[]) => void;
  /** Hieu ung dong bo sau khi DOM doi. */
  useLayoutEffect: (callback: () => void | (() => void), deps: readonly unknown[]) => void;
}

/**
 * Ham dich cua mien `feedback`.
 * Khoa ngoai mien (`close`, `submit`, `submitting`) roi ve tu dien nen cua client — dung nhu ban goc.
 */
export type FeedbackTranslate = (key: string) => string;

/** Mat primitive cua `@galaxy-blackhole/gbh-client-ui-primitives` ma row nay dung. */
export interface PrimitivesSeam {
  /** Toast noi (portal ra document.body). */
  Toast: (props: Record<string, unknown>) => unknown;
  /** Hop thoai modal. */
  Modal: (props: Record<string, unknown>) => unknown;
  /** Nut. */
  Button: (props: Record<string, unknown>) => unknown;
  /** Nhan hien khi ro chuot. */
  Tooltip: (props: Record<string, unknown>) => unknown;
  /** Bieu tuong Like rong. */
  IconLikeOutlineRegular: (props: Record<string, unknown>) => unknown;
  /** Bieu tuong Like dac. */
  IconLikeFillRegular: (props: Record<string, unknown>) => unknown;
  /** Bieu tuong Dislike rong. */
  IconDislikeOutlineRegular: (props: Record<string, unknown>) => unknown;
  /** Bieu tuong Dislike dac. */
  IconDislikeFillRegular: (props: Record<string, unknown>) => unknown;
  /** Bieu tuong canh bao cho toast that bai. */
  IconWarningOutlineRegular: (props: Record<string, unknown>) => unknown;
}

/** Day du props cua muc `conversation.chat.assistant-actions` (khop ban goc). */
export interface MessageFeedbackActionProps {
  /** Tin nhan assistant ma muc nay phuc vu. */
  readonly messageId: string;
  /** Doc mot lan phan hoi cua phien. */
  readonly ensure: () => Promise<MessageFeedbackActionResult>;
  /** Muc da ghi ma tang nay quan sat duoc. */
  readonly current: (messageId: string) => MessageFeedbackItem | undefined;
  /** Rut lai danh gia dang khop. */
  readonly retract: (messageId: string, rating: MessageFeedbackRating) => Promise<MessageFeedbackActionResult>;
  /** Mo hop thoai cho mot tin nhan va mot danh gia. */
  readonly openDialog: (messageId: string, rating: MessageFeedbackRating) => void;
  /** Hook doc anh chup phan hoi cua phien (do tang khung bind tu `hooks.feedback`). */
  readonly useFeedback: <T>(selector: (view: MessageFeedbackView) => T) => T;
  /** Ham dich cua mien `feedback`. */
  readonly t: FeedbackTranslate;
}

/** Day du props cua muc `conversation.input.overlay` (khop ban goc). */
export interface FeedbackDialogProps {
  /** Hook doc anh chup hop thoai cua phien (do tang khung bind tu `hooks.dialog`). */
  readonly useDialog: <T>(selector: (state: FeedbackDialogState) => T) => T;
  /** Thay mot phan ban nhap. */
  readonly edit: (draft: Partial<Pick<FeedbackDialogState, "category" | "text">>) => void;
  /** Gui ban nhap. */
  readonly submit: () => Promise<void>;
  /** Dong hop thoai va bo ban nhap. */
  readonly dismiss: () => void;
  /** Tat toast that bai. */
  readonly dismissFailure: () => void;
  /** Retire toast xac nhan da hien xong. */
  readonly dismissToast: (seq: number) => void;
  /** Ham dich cua mien `feedback`. */
  readonly t: FeedbackTranslate;
}

/** Ma that bai co cau chu rieng; moi ma khac doc cau chung. */
const FAILURE_COPY: Record<string, MessageFeedbackKey> = {
  "version-conflict": "error.conflict",
  "note-too-large": "error.noteTooLarge",
};

/** Cap component ma row nay dang ky vao hai slot. */
export interface FeedbackComponents {
  /** Muc cua slot `conversation.chat.assistant-actions`. */
  MessageFeedbackActions: (props: MessageFeedbackActionProps) => unknown;
  /** Muc cua slot `conversation.input.overlay`. */
  FeedbackDialog: (props: FeedbackDialogProps) => unknown;
}

/**
 * Dung hai component cua row nay tu cac mat runtime (JSX, hook React, primitive).
 * Nhan: seams — ba mat runtime.
 * Tra: cap component de dang ky vao slot.
 */
export function createFeedbackComponents(seams: {
  readonly jsx: JsxRuntime;
  readonly react: ReactHooks;
  readonly primitives: PrimitivesSeam;
}): FeedbackComponents {
  const { jsx, jsxs, Fragment } = seams.jsx;
  const { useRef, useState, useCallback, useEffect, useLayoutEffect } = seams.react;
  const {
    Toast,
    Modal,
    Button,
    Tooltip,
    IconLikeOutlineRegular,
    IconLikeFillRegular,
    IconDislikeOutlineRegular,
    IconDislikeFillRegular,
    IconWarningOutlineRegular,
  } = seams.primitives;
  /** Bay phan loai, dung thu tu cua ban goc. */
  const categories = categoryKeys();

  /**
   * Nut Like/Dislike cua MOT tin nhan assistant.
   * Nhan: props — dinh danh tin nhan, bon dong tu nghiep vu, hook anh chup va ham dich.
   * Tra: cap nut kem dong bao loi canh chung.
   */
  function MessageFeedbackActions(props: MessageFeedbackActionProps): unknown {
    const { messageId, ensure, current, retract, openDialog, useFeedback, t } = props;
    const item = useFeedback((view) => view.items.get(messageId));
    const loadFailed = useFeedback((view) => view.status === "error");
    const rating = item?.rating;
    const [pending, setPending] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const seeded = useRef(false);
    const seed = useCallback(() => {
      if (seeded.current) return;
      seeded.current = true;
      ensure();
    }, [ensure]);
    const alive = useRef(true);
    useEffect(
      () => () => {
        alive.current = false;
      },
      [],
    );
    const errorCopy = useCallback(
      (result: { readonly ok: false; readonly error: { readonly code: string } }): string =>
        result.error.code === "version-conflict" ? t("error.conflict") : t("error.generic"),
      [t],
    );
    const choose = useCallback(
      (nextRating: MessageFeedbackRating) => {
        setPending(true);
        setFailure(null);
        ensure().then((loaded) => {
          if (!alive.current) return;
          if (!loaded.ok || current(messageId)?.rating !== nextRating) {
            setPending(false);
            openDialog(messageId, nextRating);
            return;
          }
          retract(messageId, nextRating).then((result) => {
            if (!alive.current) return;
            setPending(false);
            if (!result.ok) setFailure(errorCopy(result));
          });
        });
      },
      [current, ensure, errorCopy, messageId, openDialog, retract],
    );
    const onLike = useCallback(() => {
      choose("positive");
    }, [choose]);
    const onDislike = useCallback(() => {
      choose("negative");
    }, [choose]);
    const likeLabel = rating === "positive" ? t("action.likeActive") : t("action.like");
    const dislikeLabel = rating === "negative" ? t("action.dislikeActive") : t("action.dislike");
    return jsxs(Fragment, {
      children: [
        jsx(
          Tooltip,
          {
            label: likeLabel,
            side: "bottom",
            children: jsx("button", {
              type: "button",
              className: ACTIONS_CLASS.action,
              "aria-label": likeLabel,
              "aria-pressed": rating === "positive",
              "data-active": rating === "positive" ? true : undefined,
              disabled: pending,
              onFocus: seed,
              onPointerEnter: seed,
              onClick: onLike,
              children:
                rating === "positive"
                  ? jsx(IconLikeFillRegular, {})
                  : jsx(IconLikeOutlineRegular, {}),
            }),
          },
          "like",
        ),
        jsx(
          Tooltip,
          {
            label: dislikeLabel,
            side: "bottom",
            children: jsx("button", {
              type: "button",
              className: ACTIONS_CLASS.action,
              "aria-label": dislikeLabel,
              "aria-pressed": rating === "negative",
              "data-active": rating === "negative" ? true : undefined,
              disabled: pending,
              onFocus: seed,
              onPointerEnter: seed,
              onClick: onDislike,
              children:
                rating === "negative"
                  ? jsx(IconDislikeFillRegular, {})
                  : jsx(IconDislikeOutlineRegular, {}),
            }),
          },
          "dislike",
        ),
        failure === null && loadFailed
          ? jsx("span", { className: ACTIONS_CLASS.failure, role: "status", children: t("error.load") }, "load-error")
          : null,
        failure !== null
          ? jsx("span", { className: ACTIONS_CLASS.failure, role: "status", children: failure }, "failure")
          : null,
      ],
    });
  }

  /**
   * Hop thoai phan hoi cua MOT phien kem hai toast (xac nhan va that bai).
   * Nhan: props — hook anh chup, nam dong tu ban nhap va ham dich.
   * Tra: modal khi co dich dang mo, va toast khi dang hien.
   */
  function FeedbackDialog(props: FeedbackDialogProps): unknown {
    const { useDialog, edit, submit, dismiss, dismissFailure, dismissToast, t } = props;
    const state = useDialog((s) => s);
    const probeRef = useRef<{ closest: (selector: string) => unknown } | null>(null);
    const [card, setCard] = useState<unknown>(null);
    useLayoutEffect(() => {
      setCard(probeRef.current?.closest("[data-composer-card]") ?? null);
    }, []);
    const toast = state.toast;
    const onToastDone = useCallback(() => {
      dismissToast(toast);
    }, [dismissToast, toast]);
    useEffect(
      () => () => {
        dismissToast(toast);
      },
      [dismissToast, toast],
    );
    const failureCode = state.failure;
    const failure = failureCode === null ? null : t(FAILURE_COPY[failureCode] ?? "error.generic");
    const onFailureDone = useCallback(() => {
      dismissFailure();
    }, [dismissFailure]);
    return jsxs(Fragment, {
      children: [
        jsx("span", { ref: probeRef, hidden: true }, "probe"),
        toast > 0 && failure === null
          ? jsx(
              Toast,
              { text: t("toast.recorded"), tone: "success", anchor: card, onDone: onToastDone },
              toast,
            )
          : null,
        failure !== null
          ? jsx(
              Toast,
              {
                text: failure,
                icon: jsx(IconWarningOutlineRegular, {}),
                anchor: card,
                holdMs: 6000,
                onDone: onFailureDone,
              },
              "failure-" + String(failureCode),
            )
          : null,
        jsxs(
          Modal,
          {
            open: state.target !== null,
            title: t("dialog.title"),
            closeLabel: t("close"),
            onClose: dismiss,
            className: DIALOG_CLASS.dialog,
            footer: jsx(
              Button,
              {
                variant: "primary",
                className: DIALOG_CLASS.submit,
                disabled: state.submitting,
                onClick: () => {
                  void submit();
                },
                children: state.submitting ? t("submitting") : t("submit"),
              },
              "submit",
            ),
            children: [
              jsx(
                "div",
                {
                  className: DIALOG_CLASS.categories,
                  role: "group",
                  "aria-label": t("dialog.categories"),
                  children: categories.map((category) =>
                    jsx(
                      "button",
                      {
                        type: "button",
                        className:
                          state.category === categoryKeyOf(category)
                            ? DIALOG_CLASS.chip + " " + DIALOG_CLASS.chipActive
                            : DIALOG_CLASS.chip,
                        "aria-pressed": state.category === categoryKeyOf(category),
                        disabled: state.submitting,
                        onClick: () => {
                          edit({ category: state.category === categoryKeyOf(category) ? null : categoryKeyOf(category) });
                        },
                        children: t(category),
                      },
                      category,
                    ),
                  ),
                },
                "categories",
              ),
              jsx(
                "textarea",
                {
                  className: DIALOG_CLASS.detail,
                  "aria-label": t("dialog.detail"),
                  placeholder: t("dialog.hint"),
                  value: state.text,
                  readOnly: state.submitting,
                  onChange: (event: { target: { value: string } }) => {
                    edit({ text: event.target.value });
                  },
                },
                "detail",
              ),
            ],
          },
          "dialog",
        ),
      ],
    });
  }

  return { MessageFeedbackActions, FeedbackDialog };
}

/**
 * Doi khoa tu dien cua mot phan loai thanh ten phan loai ma Host chap nhan.
 * Nhan: key — khoa `category.<ten>` trong tu dien.
 * Tra: ten phan loai (bo tien to `category.`).
 */
function categoryKeyOf(key: MessageFeedbackKey): FeedbackCategory {
  return key.slice("category.".length) as FeedbackCategory;
}
