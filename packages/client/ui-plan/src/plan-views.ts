/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nam component cua row ui-plan: the plan trong transcript, nut mo review dang cho, the xem truoc Markdown, tieu de tab va chip plan mode
 */
import { CONTROL_CLASS, PREVIEW_CLASS } from "./class-names.ts";
import { planFailureLine, type ResourceFailure, type TranslatePlan } from "./failure-line.ts";
import { isRecord, type PlanDocument, type SubmittedPlan } from "./plan.ts";
import { isReviewPreviewAddress } from "./review-preview.ts";
import type { PlanReviewState } from "./review-store.ts";
import type { PlanPrimitives, PlanShell } from "./types.ts";

/** Mot plan dang cho duyet: ban da ghi trong lich su (co `callId`) hoac van ban tam thoi. */
export interface PendingReview {
  /** Id loi goi tool cua plan da ghi; thieu ⇒ day la van ban tam thoi trong tham so dieu huong. */
  readonly callId?: string;
  /** Markdown cua plan dang cho duyet. */
  readonly plan: string;
}

/** Tham chieu Turn ma the plan duoc chieu ra. */
export interface PlanTurnReference {
  /** So thu tu Turn trong phien. */
  readonly turn: number | string;
}

/** Props cua cot the plan trong transcript (slot `conversation.chat.turnTail`). */
export interface PlanCardsProps {
  /** Turn dang duoc chieu. */
  readonly turn: PlanTurnReference;
  /** Hook theo khoa: doc danh sach plan da nop cua Turn. */
  readonly usePlans: (key: string) => readonly SubmittedPlan[] | undefined;
  /** Mo plan day du trong sidebar phai. */
  readonly openPlan: (callId: string) => void;
  /** Ham dich cua namespace `plan`. */
  readonly t: TranslatePlan;
}

/** Dong tu cua so review do tang renderer gan vao props (da bind ban nhap cua phien). */
export interface PlanReviewActions {
  /**
   * Danh dau mot review da duoc mo.
   * Nhan: `reviewKey` — dinh danh review trong so cua phien.
   * Tra: khong co.
   */
  markOpened: (reviewKey: string) => void;
}

/** Hook chon tren anh chup "phien dang hien" cua sidebar phai. */
export type SidebarMountedHook = <S>(selector: (session: string | undefined) => S) => S;

/** Hook chon tren so review cua phien. */
export type ReviewStoreHook = <S>(selector: (state: PlanReviewState) => S) => S;

/** Props cua nut mo plan dang cho duyet (slot `conversation.plan-review.actions`). */
export interface PlanReviewOpenProps {
  /** Plan dang cho duyet. */
  readonly review: PendingReview;
  /** Dinh danh yeu cau cua trinh duyet (plan tam thoi khong co `callId`). */
  readonly requestKey: string;
  /** Mo plan trong sidebar phai (ban da ghi hoac van ban tam thoi). */
  readonly openReview: (review: PendingReview, requestKey: string) => void;
  /** Hook doc phien dang hien cua sidebar phai. */
  readonly useSidebarMounted: SidebarMountedHook;
  /** Hook doc so review cua phien. */
  readonly useStore: ReviewStoreHook;
  /** Dong tu cua so review. */
  readonly actions: PlanReviewActions;
  /** Ham dich cua namespace `plan`. */
  readonly t: TranslatePlan;
}

/** Duong dieu huong cua tab dang hien. */
export interface PlanTabNavigation {
  /** Dia chi tai nguyen (`gbh-resource://plan/…` hoac `gbh-resource://plan-review/…`; nhan ca scheme cu). */
  readonly address: string;
  /** Tham so dieu huong; plan tam thoi mang van ban o khoa `planReview`. */
  readonly params?: Record<string, unknown>;
}

/** Thong tin tab do tang renderer cap cho occupant. */
export interface PlanTabInfo {
  /** Tab dang hien. */
  readonly tab: {
    /** Tieu de do kieu tab dat. */
    readonly title: string;
    /** Duong dieu huong cua tab. */
    readonly navigation: PlanTabNavigation;
  };
}

/** Anh chup tai nguyen ma the xem truoc doc. */
export interface PlanResourceView {
  /** Trang thai doc: `none` · `loading` · `ready` · `failed`. */
  readonly status: string;
  /** Du lieu khi doc xong. */
  readonly value?: PlanDocument;
  /** Loi khi doc that bai. */
  readonly failure?: ResourceFailure;
}

/** Props cua the xem truoc Markdown (slot `sidebar.right.pane.tab`). */
export interface PlanPreviewProps {
  /** Hook doc tab dang hien. */
  readonly useTabInfo: () => PlanTabInfo;
  /** Hook doc tai nguyen theo dia chi. */
  readonly useResource: (address: string) => PlanResourceView;
  /** Ham dich cua namespace `plan`. */
  readonly t: TranslatePlan;
}

/** Props cua tieu de tab (slot `sidebar.right.pane.tab.title`). */
export interface PlanTitleProps {
  /** Hook doc tab dang hien. */
  readonly useTabInfo: () => PlanTabInfo;
  /** Hook doc tai nguyen theo dia chi. */
  readonly useResource: (address: string) => PlanResourceView;
}

/** Hinh chieu `plan` cua phien ma chip doc (gia tri do Host tinh, khong phai lac quan phia client). */
export interface PlanProjection {
  /** Host dang chuyen doi trang thai plan mode. */
  readonly pending: boolean;
  /** Plan mode dang bat. */
  readonly active: boolean;
}

/** Props cua chip plan mode (slot `conversation.input.plan`). */
export interface PlanChipProps {
  /** Hook doc hinh chieu theo ten (`plan`). */
  readonly useProjection: (key: string) => PlanProjection | undefined;
  /** Tang renderer khoa chip khi phien ban. */
  readonly locked: boolean;
  /**
   * Thoat plan mode bang lenh cua phien.
   * Nhan: khong co.
   * Tra: null khi thanh cong, hoac cau loi hien duoi chip.
   */
  readonly exitPlanMode: () => Promise<string | null>;
  /** Ham dich cua namespace `plan`. */
  readonly t: TranslatePlan;
}

/** Nam component cua row ui-plan, da bind runtime JSX va primitive cua DSH. */
export interface PlanViews {
  /** Cot the plan trong transcript. */
  readonly PlanCards: (props: PlanCardsProps) => unknown;
  /** Nut mo plan dang cho duyet. */
  readonly PlanReviewOpen: (props: PlanReviewOpenProps) => unknown;
  /** The xem truoc Markdown trong sidebar phai. */
  readonly PlanPreview: (props: PlanPreviewProps) => unknown;
  /** Tieu de tab cua the xem truoc. */
  readonly PlanTitle: (props: PlanTitleProps) => unknown;
  /** Chip plan mode o o soan tin. */
  readonly PlanChip: (props: PlanChipProps) => unknown;
}

/**
 * Ham dich dung cho nhan cua bo doc Markdown — ban goc goi thang khoa ngoai namespace `plan`.
 * Nhan: `key` — ten khoa; `params` — tham so noi suy.
 * Tra: chuoi da dich.
 */
type LooseTranslate = (key: string, params?: Record<string, string>) => string;

/**
 * Kiem mot gia tri co phai tai lieu plan day du (tieu de + Markdown) hay khong.
 * Nhan: `value` — gia tri doc tu tham so dieu huong hoac tu provider tai nguyen.
 * Tra: true khi dung hinh dang ma the xem truoc can.
 */
function isPlanDocument(value: unknown): value is PlanDocument {
  return isRecord(value) && typeof value.title === "string" && typeof value.markdown === "string";
}

/**
 * Chon tai lieu ma the xem truoc phai chieu: van ban tam thoi trong tham so, hoac plan da ghi.
 * Nhan: `temporary` — dia chi co phai plan tam thoi; `params` — tham so dieu huong; `resource` — anh chup tai nguyen.
 * Tra: tai lieu plan, hoac undefined khi chua doc duoc.
 */
function planOf(temporary: boolean, params: Record<string, unknown> | undefined, resource: PlanResourceView): PlanDocument | undefined {
  if (!temporary) return resource.value;
  if (params === undefined) return undefined;
  const review = params.planReview;
  return isPlanDocument(review) ? review : undefined;
}

/**
 * Ghep dinh danh review cua mot lan cho duyet (plan da ghi va plan tam thoi khong dung chung khoa).
 * Nhan: `review` — plan dang cho; `requestKey` — dinh danh yeu cau cua trinh duyet.
 * Tra: khoa nho trong so review.
 */
function reviewIdentity(review: PendingReview, requestKey: string): string {
  return review.callId === undefined ? "review:" + requestKey : "call:" + review.callId;
}

/**
 * Dung nam component cua row ui-plan tren mot bo khung JSX/hook va mot bo primitive.
 * Nhan: `shell` — runtime JSX + hook React; `primitives` — primitive cua DSH.
 * Tra: nam component da bind.
 */
export function createPlanViews(shell: PlanShell, primitives: PlanPrimitives): PlanViews {
  /**
   * Chieu cac plan da nop cua mot Turn thanh the bam duoc.
   * Nhan: `props` — Turn, hook doc plan, ham mo plan va ham dich.
   * Tra: cot the plan, hoac null khi Turn khong nop plan nao.
   */
  function PlanCards(props: PlanCardsProps): unknown {
    const plans = props.usePlans(String(props.turn.turn));
    if (plans === undefined || plans.length === 0) return null;
    return shell.jsx("div", {
      className: PREVIEW_CLASS.cards,
      "data-plan-artifacts": true,
      children: plans.map((plan) =>
        shell.jsxs(
          "button",
          {
            type: "button",
            className: PREVIEW_CLASS.card,
            "data-plan-card": plan.callId,
            "aria-label": props.t("preview.openNamed", { title: plan.title }),
            onClick: (): void => {
              props.openPlan(plan.callId);
            },
            children: [
              shell.jsx("span", {
                className: PREVIEW_CLASS.cardIcon,
                children: shell.jsx(primitives.FileTypeIcon, { kind: "markdown", size: 20 }),
              }),
              shell.jsxs("span", {
                className: PREVIEW_CLASS.cardDetails,
                children: [
                  shell.jsx("span", { className: PREVIEW_CLASS.cardTitle, children: plan.title }),
                  shell.jsx("span", { className: PREVIEW_CLASS.cardDescription, children: props.t("preview.document") }),
                ],
              }),
              shell.jsx("span", { className: PREVIEW_CLASS.cardOpen, children: props.t("preview.action") }),
            ],
          },
          plan.callId,
        ),
      ),
    });
  }

  /**
   * Tu mo plan dang cho duyet dung mot lan, va giu nut mo tay ma khong tra loi plan.
   * Nhan: `props` — dinh danh review, so phien, ham dieu huong va ham dich.
   * Tra: nut mo toan van cua plan dang cho.
   */
  function PlanReviewOpen(props: PlanReviewOpenProps): unknown {
    const identity = reviewIdentity(props.review, props.requestKey);
    const opened = props.useStore((state) => state.opened[identity] === true);
    const mounted = props.useSidebarMounted((session) => session !== undefined);
    shell.useEffect(() => {
      if (opened || !mounted) return;
      props.openReview(props.review, props.requestKey);
      props.actions.markOpened(identity);
    }, [identity, opened, mounted, props.openReview, props.review, props.requestKey, props.actions]);
    return shell.jsxs("button", {
      type: "button",
      className: PREVIEW_CLASS.reviewLink,
      title: props.t("preview.open"),
      "aria-label": props.t("preview.open"),
      onClick: (): void => {
        props.openReview(props.review, props.requestKey);
      },
      children: [props.t("preview.full"), shell.jsx(primitives.IconChevronRightOutlineRegular, { size: 14 })],
    });
  }

  /**
   * Chieu plan da nop (hoac van ban tam thoi) bang bo doc Markdown day du cua DSH.
   * Nhan: `props` — tab dang hien, tai nguyen cua tab va ham dich.
   * Tra: tai lieu plan, hoac mot khung trang thai da dich.
   */
  function PlanPreview(props: PlanPreviewProps): unknown {
    const tab = props.useTabInfo();
    const resource = props.useResource(tab.tab.navigation.address);
    const temporary = isReviewPreviewAddress(tab.tab.navigation.address);
    const plan = planOf(temporary, tab.tab.navigation.params, resource);
    const labels = shell.useMemo(() => {
      const loose = props.t as LooseTranslate;
      return {
        code: {
          copyLabel: loose("copy"),
          copiedLabel: loose("copied"),
          toolbarLabels: {
            codeLabel: loose("codeBlock.title"),
            wrapLabel: loose("codeBlock.wrap"),
            unwrapLabel: loose("codeBlock.unwrap"),
          },
        },
        footnotes: loose("markdown.footnotes"),
      };
    }, [props.t]);
    if (plan === undefined) {
      return shell.jsxs("div", {
        className: PREVIEW_CLASS.message,
        role: "status",
        children: [
          temporary
            ? props.t("preview.expired")
            : resource.status === "none"
              ? props.t("preview.unavailable")
              : resource.status === "failed"
                ? props.t("preview.failed")
                : props.t("preview.loading"),
          !temporary && resource.failure !== undefined ? shell.jsx("p", { children: planFailureLine(props.t, resource.failure) }) : null,
        ],
      });
    }
    return shell.jsx("section", {
      className: PREVIEW_CLASS.preview,
      "data-plan-preview": "callId" in plan ? plan.callId : tab.tab.navigation.address,
      "aria-label": plan.title,
      children: shell.jsx("div", {
        className: PREVIEW_CLASS.document,
        children: shell.jsx(primitives.MarkdownText, { text: plan.markdown, labels }),
      }),
    });
  }

  /**
   * Hien bieu tuong tep trung tinh va tieu de trong tab sau khi tai nguyen doc xong.
   * Nhan: `props` — tab dang hien va tai nguyen cua tab.
   * Tra: bieu tuong trang tri di kem tieu de da phuc hoi, hoac tieu de ban dau cua tab.
   */
  function PlanTitle(props: PlanTitleProps): unknown {
    const tab = props.useTabInfo();
    const resource = props.useResource(tab.tab.navigation.address);
    const plan = planOf(isReviewPreviewAddress(tab.tab.navigation.address), tab.tab.navigation.params, resource);
    return shell.jsxs(shell.Fragment, {
      children: [
        shell.jsx(primitives.FileTypeIcon, { kind: "other", size: 16, className: PREVIEW_CLASS.titleIcon }),
        plan?.title ?? tab.tab.title,
      ],
    });
  }

  /**
   * Chip plan mode tren hinh chieu do Host tinh; bam de chay `/plan off`.
   * Nhan: `props` — hinh chieu `plan`, co khoa, ham thoat va ham dich.
   * Tra: chip plan mode, hoac null khi plan mode khong bat.
   */
  function PlanChip(props: PlanChipProps): unknown {
    const plan = props.useProjection("plan");
    const [leaving, setLeaving] = shell.useState(false);
    const [error, setError] = shell.useState<string | null>(null);
    const aliveRef = shell.useRef(true);
    shell.useEffect(() => {
      aliveRef.current = true;
      return (): void => {
        aliveRef.current = false;
      };
    }, []);
    if (plan === undefined) return null;
    if (!(plan.pending ? !plan.active : plan.active)) return null;
    const off = (): void => {
      setLeaving(true);
      setError(null);
      void props.exitPlanMode().then(
        (failure) => {
          if (!aliveRef.current) return;
          setLeaving(false);
          setError(failure);
        },
        (reason: unknown) => {
          if (!aliveRef.current) return;
          setLeaving(false);
          setError(reason instanceof Error ? reason.message : String(reason));
        },
      );
    };
    return shell.jsxs("span", {
      className: CONTROL_CLASS.wrap,
      children: [
        shell.jsxs("button", {
          type: "button",
          className: CONTROL_CLASS.chip,
          "aria-label": props.t("chip.on.aria"),
          title: props.t("chip.on.title"),
          disabled: props.locked || leaving,
          onClick: off,
          children: [
            shell.jsxs("span", {
              className: CONTROL_CLASS.glyph,
              "aria-hidden": true,
              children: [
                shell.jsx(primitives.IconPlanOutlineRegular, { className: CONTROL_CLASS.restGlyph, size: 14 }),
                shell.jsx(primitives.IconCloseCircleFillRegular, { className: CONTROL_CLASS.hoverGlyph, size: 14 }),
              ],
            }),
            props.t("chip.label"),
          ],
        }),
        error !== null
          ? shell.jsx("span", { className: CONTROL_CLASS.error, role: "status", title: error, children: props.t("chip.exitFailed") })
          : null,
      ],
    });
  }

  return { PlanCards, PlanReviewOpen, PlanPreview, PlanTitle, PlanChip };
}
