/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bon component cua panel workflow run: RunHeader · MemberRow · PhaseSection · WorkflowRunPanel
 */

import {
  abnormal,
  advanceDisclosureState,
  collapsePending,
  dotState,
  existingPhaseState,
  focusIsWithin,
  initialDisclosureState,
  memberCount,
  navigableMembers,
  phaseDisclosureFacts,
  phaseStatusSummary,
  preventPendingHeaderFocus,
  readableMember,
  readablePhase,
  runDisclosureFacts,
  STATUS_KEYS,
  type DisclosureFacts,
  type DisclosureState,
  type HeaderMouseEvent,
  type SessionsSnapshot,
  type Translator,
} from "./panel-facts.ts";
import { CLASS } from "./styles.ts";
import type { ProjectedMember, ProjectedPhase, ProjectedRun } from "./workflow-definition.ts";

/** Bảng hook React mà panel dùng. */
export interface ReactHooks {
  /** Trả về cặp [giá trị, hàm đặt giá trị]. */
  useState<S>(initial: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void];
  /** Trả về hộp giữ giá trị bền qua các lần render. */
  useRef<T>(initial: T): { current: T };
  /** Ghi nhớ giá trị theo danh sách phụ thuộc. */
  useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  /** Chạy hiệu ứng NGAY sau khi commit (trước khi trình duyệt vẽ). */
  useLayoutEffect(effect: () => void | (() => void), deps: readonly unknown[]): void;
}

/** Bảng `react/jsx-runtime` (chỉ phần dùng). */
export interface JsxRuntime {
  /** Fragment của React. */
  Fragment: unknown;
  /** Dựng phần tử có một con. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Dựng phần tử có nhiều con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
}

/** Bảng `ui-primitives` (chỉ phần panel dùng). */
export interface PrimitivesModule {
  /** Dòng disclosure có header mở/đóng. */
  DisclosureRow: unknown;
  /** Icon mũi tên phải. */
  IconChevronRightOutlineRegular: unknown;
  /** Chấm trạng thái. */
  StateDot: unknown;
}

/** Giá trị chạy mà view cần, do `require` của bảng module cấp. */
export interface ViewRuntime {
  /** Hook React. */
  hooks: ReactHooks;
  /** jsx runtime. */
  jsx: JsxRuntime;
  /** Bảng ui-primitives. */
  primitives: PrimitivesModule;
  /** So sánh nông của client-store, dùng cho selector của `useSessions`. */
  shallowEqual: (left: unknown, right: unknown) => boolean;
}

/** Một node Chat mang dữ liệu lượt chạy. */
export interface WorkflowRunNode {
  /** Dữ liệu đã chiếu. */
  data: ProjectedRun;
}

/** Một phần tử DOM mà việc kiểm focus cần. */
export interface FocusRoot {
  /** Phần tử này có chứa node kia không. */
  contains(node: unknown): boolean;
  /** Document sở hữu phần tử. */
  ownerDocument: { activeElement: unknown };
}

/** Sự kiện blur tối thiểu mà việc dọn trạng thái cần. */
export interface BlurLikeEvent {
  /** Phần tử đang nhận sự kiện. */
  currentTarget: { contains(node: unknown): boolean };
  /** Phần tử sẽ nhận focus. */
  relatedTarget: unknown;
}

/** Props của panel. */
export interface WorkflowRunPanelProps {
  /** Node Chat. */
  node: WorkflowRunNode;
  /** Phiên đang xem (phiên cha của các thành viên). */
  sessionId: string;
  /**
   * Theo dõi bản chụp phiên.
   * Nhận: hàm chọn và (tuỳ chọn) hàm so sánh nông.
   * Trả: giá trị đã chọn.
   */
  useSessions<T>(selector: (sessions: SessionsSnapshot) => T, isEqual?: (left: T, right: T) => boolean): T;
  /**
   * Theo dõi trạng thái chạy của các phiên.
   * Nhận: hàm chọn.
   * Trả: giá trị đã chọn.
   */
  useSessionStatus<T>(selector: (statuses: ReadonlyMap<string, { running?: boolean } | undefined>) => T): T;
  /**
   * Mở phiên con ở chế độ đã biết.
   * Nhận: `{ parentSessionId, childSessionId, mode }`.
   * Trả: không.
   */
  openSession(target: { parentSessionId: string; childSessionId: string; mode: string }): void;
  /** Hàm dịch của namespace `workflowRun`. */
  t: Translator;
}

/** Props của dòng header lượt chạy. */
interface RunHeaderProps {
  /** Nội dung khi mở. */
  children: unknown;
  /** Số thành viên. */
  count: number;
  /** Tên lượt chạy. */
  name: string;
  /** Đảo trạng thái mở/đóng. */
  onToggle(): void;
  /** Đang mở. */
  open: boolean;
  /** Trạng thái lượt chạy. */
  status: ProjectedRun["status"];
  /** Hàm dịch. */
  t: Translator;
}

/** Props của một dòng thành viên. */
interface MemberRowProps {
  /** Thành viên. */
  member: ProjectedMember;
  /** Chế độ mở được (undefined khi không điều hướng được). */
  mode: string | undefined;
  /** Mở phiên con. */
  openSession(target: { parentSessionId: string; childSessionId: string; mode: string }): void;
  /** Phiên cha. */
  parentSessionId: string;
  /** Hàm dịch. */
  t: Translator;
}

/** Props của một pha. */
interface PhaseSectionProps {
  /** Gắn phần tử nội dung để kiểm focus. */
  contentRef(element: unknown): void;
  /** Dọn trạng thái chờ đóng khi rời vùng. */
  onContentBlur(event: BlurLikeEvent): void;
  /** Đảo trạng thái mở/đóng. */
  onToggle(): void;
  /** Đang mở. */
  open: boolean;
  /** Đang chờ đóng lại. */
  pendingCleanCollapse: boolean;
  /** Pha. */
  phase: ProjectedPhase;
  /** Bảng thành viên mở được. */
  navigable: Map<string, string>;
  /** Mở phiên con. */
  openSession(target: { parentSessionId: string; childSessionId: string; mode: string }): void;
  /** Phiên cha. */
  parentSessionId: string;
  /** Hàm dịch. */
  t: Translator;
}

/** Trạng thái disclosure của cả panel. */
interface PanelDisclosures {
  /** Của lượt chạy. */
  run: DisclosureState;
  /** Của từng pha, theo khoá pha. */
  phases: Map<string, DisclosureState>;
}

/** Bộ component mà row đăng ký vào slot `conversation.chat.node`. */
export interface WorkflowRunViews {
  /** Panel một lượt chạy. */
  WorkflowRunPanel: (props: WorkflowRunPanelProps) => unknown;
}

/**
 * Dựng panel với bộ giá trị chạy cho trước.
 * Nhận: `runtime` — hook React, jsx runtime, ui-primitives và `shallowEqual`.
 * Trả: component panel.
 */
export function createViews(runtime: ViewRuntime): WorkflowRunViews {
  const { hooks, primitives, shallowEqual } = runtime;
  const { Fragment, jsx, jsxs } = runtime.jsx;

  /**
   * Dòng disclosure có trạng thái mở/đóng do panel quyết định.
   * Nhận: `props` — props của `DisclosureRow`.
   * Trả: cây element React.
   */
  function StatusDisclosure(props: Record<string, unknown>): unknown {
    return jsx(primitives.DisclosureRow, { ...props, expandable: true });
  }

  /**
   * Header của lượt chạy: tên, số thành viên, chấm trạng thái; bấm cả dòng để mở/đóng.
   * Nhận: `props` — dữ liệu lượt chạy, trạng thái mở và hàm đảo.
   * Trả: cây element React.
   */
  function RunHeader(props: RunHeaderProps): unknown {
    return jsx(StatusDisclosure, {
      icon: jsx(primitives.IconChevronRightOutlineRegular, {}),
      title: props.t("run.title", { name: props.name }),
      open: props.open,
      onToggle: props.onToggle,
      expandOnRowClick: true,
      previewChevron: false,
      keepContentWhenOpen: true,
      rowClassName: CLASS.runHeader,
      contentClassName: CLASS.headerContent,
      contentLayoutClassName: CLASS.headerContentLayout,
      leadingClassName: CLASS.runLeading,
      titleClassName: CLASS.runTitle,
      collapsedContent: jsxs(Fragment, {
        children: [
          jsx("span", { className: CLASS.separator, "aria-hidden": true }),
          jsx("span", { className: CLASS.runSummary, children: memberCount(props.count, props.t) }),
          jsxs("span", {
            className: CLASS.statusTail,
            "data-status": props.status,
            children: [
              jsx(primitives.StateDot, { state: dotState(props.status) }),
              jsx("span", { children: props.t(STATUS_KEYS[props.status]) }),
            ],
          }),
        ],
      }),
      children: props.children,
    });
  }

  /**
   * Một dòng thành viên: chấm trạng thái + nhãn + chữ trạng thái. Chỉ là nút khi mở được; khi không
   * mở được nhưng đang có focus thì vẫn là nút (để đọc được bằng bàn phím) với `aria-disabled`.
   * Nhận: `props` — thành viên, chế độ mở, hàm mở phiên và hàm dịch.
   * Trả: cây element React.
   */
  function MemberRow(props: MemberRowProps): unknown {
    const navigable = props.mode !== undefined;
    const name = readableMember(props.member.label, props.t);
    const [focused, setFocused] = hooks.useState(false);
    const renderButton = navigable || focused;
    const content = jsxs(Fragment, {
      children: [
        jsx("span", {
          className: CLASS.dotSlot,
          children: jsx(primitives.StateDot, { state: dotState(props.member.status) }),
        }),
        jsx("span", {
          className: CLASS.memberLabelWrap,
          "data-member-label-wrap": true,
          children: jsx("span", { className: CLASS.memberLabel, "data-member-label": true, children: name }),
        }),
        jsx("span", {
          className: CLASS.memberStatus,
          "data-member-status-text": true,
          children: props.t(STATUS_KEYS[props.member.status]),
        }),
      ],
    });
    if (!renderButton) {
      return jsx("div", { className: CLASS.memberRow, "data-member-status": props.member.status, children: content });
    }
    const mode = props.mode;
    return jsx("button", {
      type: "button",
      className: navigable ? CLASS.memberButton : CLASS.memberRow,
      "data-member-status": props.member.status,
      "aria-disabled": navigable ? undefined : true,
      "aria-label": navigable ? props.t("member.open", { name }) : name,
      tabIndex: navigable ? undefined : -1,
      onFocus: () => {
        setFocused(true);
      },
      onBlur: () => {
        setFocused(false);
      },
      onClick:
        mode !== undefined
          ? () => {
              props.openSession({
                parentSessionId: props.parentSessionId,
                childSessionId: props.member.childId,
                mode,
              });
            }
          : undefined,
      children: content,
    });
  }

  /**
   * Một pha: header + danh sách thành viên; khi đang chờ đóng thì cú click vào chính dòng header
   * không được kéo focus vào trong (nếu không nó sẽ không bao giờ đóng).
   * Nhận: `props` — pha, trạng thái mở, bảng điều hướng và hàm mở phiên.
   * Trả: cây element React.
   */
  function PhaseSection(props: PhaseSectionProps): unknown {
    return jsx("div", {
      className: CLASS.phase,
      onMouseDownCapture: props.pendingCleanCollapse ? preventPendingHeaderFocus : undefined,
      children: jsx(StatusDisclosure, {
        icon: jsx(primitives.IconChevronRightOutlineRegular, {}),
        title: readablePhase(props.phase.phase, props.t),
        open: props.open,
        onToggle: props.onToggle,
        expandOnRowClick: true,
        previewChevron: false,
        keepContentWhenOpen: true,
        rowClassName: CLASS.phaseHeader,
        contentClassName: CLASS.headerContent,
        contentLayoutClassName: CLASS.headerContentLayout,
        leadingClassName: CLASS.phaseLeading,
        titleClassName: CLASS.phaseTitle,
        collapsedContent: jsxs(Fragment, {
          children: [
            jsx("span", { className: CLASS.separator, "aria-hidden": true }),
            jsx("span", {
              className: CLASS.phaseCount,
              "data-phase-count": true,
              children: memberCount(props.phase.members.length, props.t),
            }),
            jsx("span", {
              className: CLASS.phaseStatus,
              "data-phase-status-text": true,
              children: phaseStatusSummary(props.phase.members, props.t),
            }),
          ],
        }),
        children: jsx("div", {
          ref: props.contentRef,
          className: CLASS.members,
          onBlur: props.onContentBlur,
          children: props.phase.members.map((member) =>
            jsx(
              MemberRow,
              {
                member,
                mode: props.navigable.get(member.childId),
                openSession: props.openSession,
                parentSessionId: props.parentSessionId,
                t: props.t,
              },
              member.seq,
            ),
          ),
        }),
      }),
    });
  }

  /**
   * Panel một lượt chạy bền: header lượt chạy + các pha. Trạng thái mở/đóng theo dữ liệu nhưng tôn
   * trọng người đang đọc: giữ mở khi con trỏ còn trong vùng và chỉ đóng sau khi rời đi.
   * Nhận: `props` — node, phiên, hook phiên/trạng thái, hàm mở phiên và hàm dịch.
   * Trả: cây element React.
   */
  function WorkflowRunPanel(props: WorkflowRunPanelProps): unknown {
    const phaseFacts = hooks.useMemo(
      (): (readonly [string, DisclosureFacts])[] =>
        props.node.data.phases.map((phase) => [phase.key, phaseDisclosureFacts(phase)] as const),
      [props.node.data.phases],
    );
    const runFacts = hooks.useMemo(
      () => runDisclosureFacts(props.node.data.status, phaseFacts),
      [props.node.data.status, phaseFacts],
    );
    const totalMembers = runFacts.activityCount;
    const [disclosures, setDisclosures] = hooks.useState<PanelDisclosures>(() => ({
      run: initialDisclosureState(runFacts),
      phases: new Map(phaseFacts.map(([key, facts]) => [key, initialDisclosureState(facts)])),
    }));
    const runContentRef = hooks.useRef<FocusRoot | null>(null);
    const phaseContentRefs = hooks.useRef(new Map<string, FocusRoot>());
    const statuses = props.useSessionStatus((value) => value);
    const navigable = props.useSessions(
      (sessions) => navigableMembers(sessions, props.node.data.phases, props.sessionId, statuses),
      shallowEqual,
    );
    hooks.useLayoutEffect(() => {
      setDisclosures((current) => {
        const phases = new Map<string, DisclosureState>();
        let phasesChanged = current.phases.size !== phaseFacts.length;
        let phaseStartedCycle = false;
        for (const [key, facts] of phaseFacts) {
          const previous = current.phases.get(key);
          const next =
            previous === undefined
              ? initialDisclosureState(facts)
              : advanceDisclosureState(previous, facts, focusIsWithin(phaseContentRefs.current.get(key) ?? null));
          phases.set(key, next);
          if (next !== previous) phasesChanged = true;
          if (previous?.mode === "clean" && (facts.mode !== "clean" || facts.activityCount !== previous.activityCount)) {
            phaseStartedCycle = true;
          }
        }
        const advancedRun = advanceDisclosureState(current.run, runFacts, focusIsWithin(runContentRef.current));
        const run =
          phaseStartedCycle && runFacts.mode !== "clean" && !advancedRun.open
            ? { ...advancedRun, open: true, pendingCleanCollapse: false }
            : advancedRun;
        return run !== current.run || phasesChanged ? { run, phases } : current;
      });
    }, [disclosures.run.open, phaseFacts, runFacts]);
    const toggleRun = (): void => {
      setDisclosures((current) => ({
        ...current,
        run: { ...current.run, open: !current.run.open, pendingCleanCollapse: false },
      }));
    };
    const togglePhase = (key: string): void => {
      setDisclosures((current) => {
        const phases = new Map(current.phases);
        const phase = existingPhaseState(phases, key);
        phases.set(key, { ...phase, open: !phase.open, pendingCleanCollapse: false });
        return { ...current, phases };
      });
    };
    const settleRunBlur = (event: BlurLikeEvent): void => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      setDisclosures((current) => {
        const run = collapsePending(current.run);
        return run === current.run ? current : { ...current, run };
      });
    };
    const settlePhaseBlur = (key: string, event: BlurLikeEvent): void => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      setDisclosures((current) => {
        const phase = existingPhaseState(current.phases, key);
        const next = collapsePending(phase);
        if (next === phase) return current;
        const phases = new Map(current.phases);
        phases.set(key, next);
        return { ...current, phases };
      });
    };
    return jsx("section", {
      className: CLASS.root,
      "data-workflow-run": true,
      "data-run-status": props.node.data.status,
      onMouseDownCapture: disclosures.run.pendingCleanCollapse ? preventPendingHeaderFocus : undefined,
      children: jsx(RunHeader, {
        count: totalMembers,
        name: props.node.data.name,
        open: disclosures.run.open,
        onToggle: toggleRun,
        status: props.node.data.status,
        t: props.t,
        children: jsx("div", {
          ref: runContentRef,
          className: CLASS.phaseList,
          onBlur: settleRunBlur,
          children:
            props.node.data.phases.length === 0
              ? jsx("span", { className: CLASS.empty, children: props.t("run.empty") })
              : props.node.data.phases.map((phase) => {
                  const facts = phaseDisclosureFacts(phase);
                  const disclosure = disclosures.phases.get(phase.key) ?? initialDisclosureState(facts);
                  return jsx(
                    PhaseSection,
                    {
                      contentRef: (element: unknown) => {
                        if (element === null) phaseContentRefs.current.delete(phase.key);
                        else phaseContentRefs.current.set(phase.key, element as FocusRoot);
                      },
                      onContentBlur: (event: BlurLikeEvent) => {
                        settlePhaseBlur(phase.key, event);
                      },
                      onToggle: () => {
                        togglePhase(phase.key);
                      },
                      open: disclosure.open,
                      pendingCleanCollapse: disclosure.pendingCleanCollapse,
                      phase,
                      navigable,
                      openSession: props.openSession,
                      parentSessionId: props.sessionId,
                      t: props.t,
                    },
                    phase.key,
                  );
                }),
        }),
      }),
    });
  }

  return { WorkflowRunPanel };
}
