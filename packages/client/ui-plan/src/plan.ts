/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Doc plan da nop tu su kien lich su phien (khong tin du lieu) + ma hoa/giai ma dia chi tai nguyen plan
 */
import { PLAN_ADDRESS_PATTERN, PLAN_ADDRESS_PREFIX, PLAN_TOOL_NAME } from "./ids.ts";

/** Van ban Markdown day du cua plan va tieu de hien tren the xem truoc. */
export interface PlanDocument {
  /** Toan bo Markdown nguoi dung da nop. */
  readonly markdown: string;
  /** Tieu de lay tu dong `# …` dau tien cua Markdown. */
  readonly title: string;
}

/** Mot plan da nop, dinh danh bang dung loi goi tool da sinh ra no. */
export interface SubmittedPlan extends PlanDocument {
  /** Id loi goi tool (hoac loi goi con cua PTC) — khoa cua the plan va cua tai nguyen. */
  readonly callId: string;
}

/** Dia chi phien trong mot dia chi plan — phien thuong hoac phien con. */
export type SessionAddress =
  | { readonly kind: "session"; readonly sessionId: string }
  | {
      readonly kind: "subagent";
      readonly parentSessionId: string;
      readonly childSessionId: string;
      readonly mode: SubagentMode;
    };

/** Ba che do phien con duoc ma hoa trong dia chi — NGUYEN VAN ban goc. */
export type SubagentMode = "one-shot" | "continuable" | "unknown";

/** Mot dia chi tai nguyen plan da luu: mot loi goi trong mot phien. */
export interface PlanAddress {
  /** Phien dang hien plan. */
  readonly session: SessionAddress;
  /** Id loi goi tool da nop plan. */
  readonly callId: string;
}

/** Mot su kien lich su phien (chi hai truong ma bo doc nay dung). */
export interface PlanEvent {
  /** Loai su kien (`tool/call`, `tool/ptc-dispatch-start`, `tool/ptc-dispatch`, …). */
  readonly type: string;
  /** Du lieu su kien — KHONG tin duoc, phai kiem truoc khi doc. */
  readonly data: unknown;
}

/**
 * Kiem mot gia tri co phai ban ghi (object khong phai mang, khac null) hay khong.
 * Nhan: `value` — gia tri bat ky doc tu lich su phien.
 * Tra: true khi doc duoc theo khoa.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Doc mot plan HOAN CHINH tu tham so loi goi tool KHONG tin duoc.
 * Nhan: `event` — su kien `tool/call` hoac `tool/ptc-dispatch*` tu lich su phien.
 * Tra: plan da nop, hoac undefined khi su kien khong lien quan / du lieu hong.
 */
export function submittedPlan(event: PlanEvent): SubmittedPlan | undefined {
  if (event.type !== "tool/call" && event.type !== "tool/ptc-dispatch-start" && event.type !== "tool/ptc-dispatch") return undefined;
  const data = event.data;
  if (!isRecord(data) || data.name !== PLAN_TOOL_NAME) return undefined;
  const callId = event.type === "tool/call" ? data.callId : data.subCallId;
  if (typeof callId !== "string" || callId === "") return undefined;
  let args: unknown = data.arguments;
  if (event.type === "tool/call") {
    if (typeof args !== "string") return undefined;
    try {
      args = JSON.parse(args);
    } catch (error) {
      // Tham so khong phai JSON hop le: day la du lieu cua phien khac/hong, khong phai plan.
      void error;
      return undefined;
    }
  }
  if (!isRecord(args) || typeof args.plan !== "string") return undefined;
  const markdown = args.plan;
  const title = /^#\s+(\S[^\r\n]*)/.exec(markdown.trim())?.[1];
  if (title === undefined) return undefined;
  return { callId, markdown, title };
}

/**
 * Ma hoa danh tinh BEN VUNG cua mot plan ma KHONG giu van ban cua no trong bo nho bo cuc.
 * Nhan: `target` — phien va id loi goi tool.
 * Tra: dia chi tai nguyen cua plan.
 */
export function planAddress(target: PlanAddress): string {
  const { session, callId } = target;
  const parts =
    session.kind === "session"
      ? [session.sessionId, callId]
      : [session.kind, session.parentSessionId, session.childSessionId, session.mode, callId];
  return PLAN_ADDRESS_PREFIX + parts.map(encodeURIComponent).join("/");
}

/**
 * Kiem mot dia chi plan da luu hoac do nguoi goi dua vao.
 * Nhan: `address` — dia chi dua cho sidebar hoac provider tai nguyen.
 * Tra: danh tinh da giai ma, hoac undefined khi dia chi khong duoc ho tro.
 */
export function parsePlanAddress(address: string): PlanAddress | undefined {
  const match = PLAN_ADDRESS_PATTERN.exec(address);
  if (match === null) return undefined;
  const raw = match[1];
  if (raw === undefined) return undefined;
  try {
    const parts = raw.split("/").map((part) => decodeURIComponent(part));
    if (parts.some((part) => part === "")) return undefined;
    if (parts.length === 2) {
      return { session: { kind: "session", sessionId: parts[0] as string }, callId: parts[1] as string };
    }
    if (parts.length === 5 && parts[0] === "subagent" && isSubagentMode(parts[3])) {
      return {
        session: {
          kind: "subagent",
          parentSessionId: parts[1] as string,
          childSessionId: parts[2] as string,
          mode: parts[3],
        },
        callId: parts[4] as string,
      };
    }
    return undefined;
  } catch (error) {
    // `decodeURIComponent` nem khi chuoi phan tram hong: coi nhu dia chi khong hop le.
    void error;
    return undefined;
  }
}

/**
 * Kiem mot phan cua dia chi phien con co phai che do duoc ho tro hay khong.
 * Nhan: `value` — phan thu tu cua dia chi (co the undefined vi chi so mang).
 * Tra: true khi la mot trong ba che do cua ban goc.
 */
export function isSubagentMode(value: string | undefined): value is SubagentMode {
  return value === "one-shot" || value === "continuable" || value === "unknown";
}
