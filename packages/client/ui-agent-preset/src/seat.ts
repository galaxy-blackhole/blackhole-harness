/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chip chon preset o man hinh phien moi — nguyen van cay render va hieu ung ban goc (AgentPresetSeat)
 */

import { SEAT_CLASS } from "./class-names.ts";
import { presetDisplayText, requiresCodingTools } from "./display.ts";
import { INTRO_CHAR_FADE_MS, INTRO_CHAR_STAGGER_MS, INTRO_TEXT_DELAY_MS, INTRO_TEXT_REVEAL_MS, REFUSAL_HOLD_MS } from "./ids.ts";
import type { SeatRefusal, SeatSnapshot } from "./seat-store.ts";
import type { JsxRuntime, Primitives, ReactLike, Translator } from "./runtime.ts";

/** Thong tin giu phien ma chip doc de biet phien con o khung chinh khong. */
export interface SeatRetainInfo {
  /** So nguoi dang giu phien, theo tung khung. */
  readonly retainedBy: { readonly mainView?: number };
}

/** Mot ban ghi loi da duoc danh so de lam khoa cho bang bao. */
export interface SeatToastRecord {
  /** So thu tu tang dan cua lan hien. */
  readonly seq: number;
  /** Loi tu choi di kem. */
  readonly error: SeatRefusal;
}

/** Props ma slot conversation.hero.agentPreset tiem vao chip. */
export interface AgentPresetSeatProps {
  /** Id phien (undefined o man hinh phien moi). */
  readonly sessionId?: string;
  /** Hook chon thong tin giu phien. */
  readonly useSessionRetainInfo: <T>(selector: (info: SeatRetainInfo | undefined) => T) => T;
  /** Nap so preset. */
  readonly load: () => void;
  /** Stage mot preset cho phien ke tiep. */
  readonly select: (id: string) => void;
  /** Ghi nhan mot loi tu choi da hien xong. */
  readonly dismissRefusal: (refusal: SeatRefusal) => void;
  /** Ghi nhan hieu tu gioi thieu da chay xong. */
  readonly introduced: () => void;
  /** Hook chon tu store chip. */
  readonly useAgentPresetSeat: <T>(selector: (state: SeatSnapshot) => T) => T;
  /** Hook chon trang thai Cong cu phat trien. */
  readonly useDeveloperTools: <T>(selector: (enabled: boolean) => T) => T;
  /** Ham dich cua namespace. */
  readonly t: Translator;
}

/** Phu thuoc ma chip can. */
export interface SeatDeps {
  /** Runtime JSX. */
  readonly runtime: JsxRuntime;
  /** Hook React. */
  readonly react: ReactLike;
  /** Bo primitive. */
  readonly primitives: Primitives;
}

/**
 * Do tre bat dau cua tung ky tu trong hieu ung tu gioi thieu.
 * Nhan: count — so ky tu cua ten preset dang hien.
 * Tra: so mili giay giua hai lan bat dau lien tiep.
 */
export function introStaggerMs(count: number): number {
  if (count <= 1) return 0;
  return Math.min(INTRO_CHAR_STAGGER_MS, INTRO_TEXT_REVEAL_MS / (count - 1));
}

/**
 * Dung component chip chon preset cua phien moi.
 * Nhan: deps — runtime JSX, hook React va bo primitive.
 * Tra: component chip (props theo {@link AgentPresetSeatProps}).
 */
export function createAgentPresetSeat(deps: SeatDeps): (props: AgentPresetSeatProps) => unknown {
  const { jsx, jsxs, Fragment } = deps.runtime;
  const { useState, useRef, useEffect, useMemo } = deps.react;
  const primitives = deps.primitives;

  /**
   * Ve chip chon preset agent cua phien moi.
   *
   * Chip nam o day chu khong o o soan tin vi lua chon chi co truoc khi hoi thoai bat dau: khi mot luot
   * da chay, lich su cua phien duoc san sinh duoi bo cong cu cua preset do va Host tu choi doi chung.
   * Mot dieu khien ma gan nhu ca vong doi bi vo hieu nam o man hinh noi no con dung duoc.
   * Nhan: props — props do slot soan ra.
   * Tra: chip va bang bao tu choi neu co, hoac null khi khong o khung chinh.
   */
  return function AgentPresetSeat(props: AgentPresetSeatProps): unknown {
    const { sessionId, useSessionRetainInfo, load, select, dismissRefusal, introduced, useAgentPresetSeat, useDeveloperTools, t } = props;
    const developerTools = useDeveloperTools((value) => value);
    const state = useAgentPresetSeat((snapshot) => snapshot);
    const main = useSessionRetainInfo((info) => sessionId === undefined || (info?.retainedBy.mainView ?? 0) > 0);
    const [open, setOpen] = useState(false);
    const toastSeq = useRef(0);
    const [toast, setToast] = useState<SeatToastRecord | null>(null);
    useEffect(() => {
      if (state.error !== null && typeof state.error === "object") {
        toastSeq.current += 1;
        setToast({ seq: toastSeq.current, error: state.error });
      } else setToast(null);
    }, [state.error]);
    useEffect(() => {
      load();
    }, [load]);
    const options = useMemo(
      () => state.options.filter((option) => developerTools || !requiresCodingTools(option)),
      [state.options, developerTools],
    );
    useEffect(() => {
      setOpen(false);
    }, [developerTools, options.length]);
    const chosen = state.options.find((option) => option.id === state.current);
    const label = (chosen === undefined ? undefined : presetDisplayText(chosen, t))?.name ?? state.current;
    const ready = state.options.length > 0 && state.current !== "";
    const [introducing, setIntroducing] = useState(false);
    useEffect(() => {
      if (!state.introduce || !ready) return;
      const characters = Array.from(label);
      if (characters.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        introduced();
        return;
      }
      setIntroducing(true);
      const done = window.setTimeout(() => {
        setIntroducing(false);
        introduced();
      }, INTRO_TEXT_DELAY_MS + (characters.length - 1) * introStaggerMs(characters.length) + INTRO_CHAR_FADE_MS);
      return () => {
        window.clearTimeout(done);
      };
    }, [state.introduce, ready, label, introduced]);
    if (!main) return null;
    const characters = Array.from(label);
    const stagger = introStaggerMs(characters.length);
    const shownLabel = introducing
      ? jsx("span", {
          className: SEAT_CLASS.introText,
          children: characters.map((character, index) =>
            jsx(
              "span",
              {
                className: SEAT_CLASS.introChar,
                style: { animationDelay: INTRO_TEXT_DELAY_MS + index * stagger + "ms" },
                children: character,
              },
              index,
            ),
          ),
        })
      : label;
    return jsxs(Fragment, {
      children: [
        ready &&
          jsx(primitives.Menu, {
            open: open && options.length > 0,
            onClose: () => {
              setOpen(false);
            },
            items: options.map((option) => {
              const text = presetDisplayText(option, t);
              return {
                id: option.id,
                label: jsxs("span", {
                  className: SEAT_CLASS.item,
                  children: [
                    jsx("span", { className: SEAT_CLASS.itemName, children: text.name }),
                    jsx("span", { className: SEAT_CLASS.itemDesc, children: text.description ?? t("noDescription") }),
                  ],
                }),
              };
            }),
            selectedId: state.current,
            onSelect: (id: string) => {
              setOpen(false);
              select(id);
            },
            align: "start",
            portal: true,
            className: SEAT_CLASS.menuAnchor,
            anchor: jsxs("button", {
              type: "button",
              className: SEAT_CLASS.seat,
              "aria-haspopup": "menu",
              "aria-expanded": open && options.length > 0,
              title: (typeof state.error === "object" ? state.error?.reason : state.error) ?? t("seatHint"),
              disabled: state.busy || options.length === 0,
              onClick: () => {
                setOpen((value) => !value);
              },
              children: [
                jsx(primitives.IconAgentPresetOutlineRegular, {
                  className: introducing ? SEAT_CLASS.seatIcon + " " + SEAT_CLASS.introIcon : SEAT_CLASS.seatIcon,
                }),
                jsx("span", { className: SEAT_CLASS.seatLabel, children: shownLabel }),
                jsx(primitives.IconChevronDownOutlineRegular, { className: SEAT_CLASS.chevron }),
              ],
            }),
          }),
        toast !== null &&
          jsx(
            primitives.Toast,
            {
              text: t("switchRefused", {
                name: presetDisplayText(toast.error.preset, t).name,
                reason: toast.error.reason,
              }),
              icon: jsx(primitives.IconWarningOutlineRegular, {}),
              holdMs: REFUSAL_HOLD_MS,
              anchor: document.querySelector("[data-composer-card]"),
              onDone: () => {
                dismissRefusal(toast.error);
              },
            },
            toast.seq,
          ),
      ],
    });
  };
}
