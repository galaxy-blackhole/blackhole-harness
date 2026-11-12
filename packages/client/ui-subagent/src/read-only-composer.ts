/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cho soan tin CHI DOC khi phien con khong nhan tiep duoc — ban viet lai theo bundle goc
 */

import { readOnlyComposerStyles as styles } from "./class-names.ts";
import type { Translator } from "./duration.ts";

/** Runtime JSX do bang module cap (react/jsx-runtime). */
export interface ComposerJsx {
  /** Dung element mot con. */
  jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Dung element nhieu con. */
  jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
}

/** Ly do mot hoi thoai duoc danh dia chi khong nhan duoc dau vao cua nguoi. */
export interface SubagentReadOnlyMatch {
  /** "one-shot" · "parent-unavailable" · "unknown". */
  readonly reason: string;
}

/** Chu so huu ma bo chon chi doc doc de quyet dinh. */
export interface ReadOnlyOwner {
  /** Mat phien cua chu so huu. */
  readonly session?: {
    /** Thong tin subagent cua phien. */
    readonly subagent?:
      | {
          /** Dia chi phien con. */
          readonly address: { readonly mode: string };
          /** Phien cha con truy cap duoc hay khong. */
          readonly parentAvailable?: boolean;
        }
      | null
      | undefined;
    /** Phien dang chay hay khong. */
    readonly running?: boolean;
  };
}

/** Props ma component chi doc nhan tu slot. */
export interface SubagentReadOnlyComposerProps {
  /** Ly do do bo chon tra ve. */
  readonly matched: SubagentReadOnlyMatch;
  /** Ham dich namespace subagent. */
  readonly t: Translator;
}

/** Component ma plugin dang ky vao slot conversation.composer. */
export interface ReadOnlyComposerComponent {
  /** Cho soan tin thay the khi phien con chi doc. */
  SubagentReadOnlyComposer: (props: SubagentReadOnlyComposerProps) => unknown;
}

/**
 * Chiem cho soan tin khi phien con la lich su one-shot hoac chu tiep noi khong con.
 * Nhan: owner — chu so huu hoi thoai dang duoc danh dia chi.
 * Tra: ly do chi doc, hoac null khi cho soan tin binh thuong van dung duoc.
 */
export function selectReadOnlySubagent(owner: ReadOnlyOwner): SubagentReadOnlyMatch | null {
  const subagent = owner.session?.subagent;
  if (subagent === undefined || subagent === null) return null;
  if (subagent.address.mode === "unknown") return { reason: "unknown" };
  if (subagent.address.mode === "one-shot") return { reason: "one-shot" };
  if (subagent.parentAvailable !== false) return null;
  return owner.session?.running === true ? null : { reason: "parent-unavailable" };
}

/**
 * Dung component cho soan tin chi doc quanh runtime JSX.
 * Nhan: runtime — jsx/jsxs cua bang module.
 * Tra: component de plugin dang ky vao slot conversation.composer.
 */
export function createReadOnlyComposer(runtime: ComposerJsx): ReadOnlyComposerComponent {
  /**
   * Giai thich vi sao cho soan tin thuong khong dung duoc voi mot phien con da danh dia chi.
   * Nhan: props — ly do do bo chon so huu kem props chuan cua slot.
   * Tra: cho soan tin thay the o che do chi doc.
   */
  function SubagentReadOnlyComposer(props: SubagentReadOnlyComposerProps): unknown {
    const oneShot = props.matched.reason === "one-shot";
    return runtime.jsxs("div", {
      className: styles.frame,
      role: "status",
      children: [
        runtime.jsx("strong", { children: props.t(oneShot ? "readonly.oneShot.title" : "readonly.title") }),
        runtime.jsx("span", {
          children: props.t(
            props.matched.reason === "unknown" ? "readonly.unknown.body" : oneShot ? "readonly.oneShot.body" : "readonly.body",
          ),
        }),
      ],
    });
  }
  return { SubagentReadOnlyComposer };
}
