/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dinh nghia chieu node `submitted-plan` cua Conversation — mot the cho moi lan goi tool, vi tri the giu nguyen khi PTC quyet toan sau
 */
import { PLAN_NODE_KIND } from "./ids.ts";
import { submittedPlan, type PlanEvent, type SubmittedPlan } from "./plan.ts";

/** Su kien lich su ma bo chieu doc (them `seq` de danh dau vi tri neo). */
export interface PlanMatchEvent extends PlanEvent {
  /** So thu tu su kien trong lich su phien. */
  readonly seq: number;
}

/** Mot lan khop cua su kien voi dinh nghia nay. */
export interface PlanDefinitionMatch {
  /** Su kien da khop. */
  readonly event: PlanMatchEvent;
  /** Vi tri cua su kien trong cay hien thi. */
  readonly location: unknown;
}

/** Ket qua khop: dinh danh node va vai tro cua lan khop. */
export interface PlanMatchResult {
  /** Id loi goi tool — khoa cua the plan. */
  readonly id: string;
  /** `start` cho lan goi dau, `update` khi PTC quyet toan sau. */
  readonly role: "start" | "update";
}

/** Ngu canh chieu node do tang hoi thoai cap. */
export interface PlanProjectionContext {
  /** Khoa cua node trong phien. */
  readonly key: unknown;
  /** Id cua node. */
  readonly id: string;
  /** Trang thai da chieu ra (neu co). */
  readonly state?: SubmittedPlan;
  /** Lan khop da mo node (neu co). */
  readonly start?: PlanDefinitionMatch;
  /** Moi lan khop cua node. */
  readonly matches: readonly PlanDefinitionMatch[];
}

/** Node hien thi ma dinh nghia nay dung ra — the plan an trong cay, du lieu di kem. */
export interface PlanViewNode {
  /** Khoa cua node. */
  readonly key: unknown;
  /** Loai node. */
  readonly kind: string;
  /** Id cua node. */
  readonly id: string;
  /** Dich cua node. */
  readonly target: string;
  /** Vi tri neo trong lich su. */
  readonly anchorSeq: number;
  /** Vi tri hien thi. */
  readonly location: unknown;
  /** Do hien: the plan chi hien qua slot `turnTail`, khong hien trong cay node. */
  readonly visibility: string;
  /** Du lieu cua plan da nop. */
  readonly data: SubmittedPlan;
}

/**
 * Doc mot su kien lich su thanh ket qua khop cua dinh nghia `submitted-plan`.
 * Nhan: `event` — su kien lich su phien (khong tin duoc).
 * Tra: ket qua khop, hoac null khi su kien khong phai mot lan nop plan.
 */
function matchSubmittedPlan(event: PlanEvent): PlanMatchResult | null {
  const plan = submittedPlan(event);
  if (plan === undefined) return null;
  return { id: plan.callId, role: event.type === "tool/ptc-dispatch" ? "update" : "start" };
}

/**
 * Ghi lai plan cua lan khop mo node.
 * Nhan: `_context` — ngu canh chieu (khong dung); `match` — lan khop mo node.
 * Tra: plan da nop, hoac undefined khi du lieu hong.
 */
function startSubmittedPlan(_context: PlanProjectionContext, match: PlanDefinitionMatch): SubmittedPlan | undefined {
  return submittedPlan(match.event);
}

/**
 * Giu nguyen trang thai da chieu khi PTC quyet toan sau (the khong doi vi tri).
 * Nhan: `context` — ngu canh chieu.
 * Tra: trang thai hien tai cua node.
 */
function updateSubmittedPlan(context: PlanProjectionContext): SubmittedPlan | undefined {
  return context.state;
}

/**
 * Dung node hien thi an cho the plan — vi tri neo lay tu lan khop MO node.
 * Nhan: `context` — ngu canh chieu (khoa, id, trang thai, cac lan khop).
 * Tra: node hien thi, hoac null khi khong doc duoc plan.
 */
function buildSubmittedPlanNode(context: PlanProjectionContext): PlanViewNode | null {
  const start = context.start ?? context.matches[0];
  const data = context.state ?? (start === undefined ? undefined : submittedPlan(start.event));
  if (data === undefined || start === undefined) return null;
  return {
    key: context.key,
    kind: PLAN_NODE_KIND,
    id: context.id,
    target: "chat",
    anchorSeq: start.event.seq,
    location: start.location,
    visibility: "hidden",
    data,
  };
}

/**
 * Dinh nghia chieu node `submitted-plan` cho Conversation: mot the cho moi lan goi `exit_plan_mode`.
 * Node `hidden` vi the plan duoc chieu qua slot `conversation.chat.turnTail`, khong qua cay node.
 * Nhan: khong co.
 * Tra: dinh nghia ma `ctx.uiConversation.events.register` nhan.
 */
export const planDefinition = {
  kind: PLAN_NODE_KIND,
  target: "chat",
  match: matchSubmittedPlan,
  start: startSubmittedPlan,
  update: updateSubmittedPlan,
  buildViewNode: buildSubmittedPlanNode,
};
