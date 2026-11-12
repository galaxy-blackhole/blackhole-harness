/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bố cục con TRONG TIẾN TRÌNH dùng chung: ngân sách độ sâu uỷ nhiệm, metadata phiên bền, AgentOptions của con, seed chính sách uỷ nhiệm, và phần setup theo scope — port 1:1 child-agent.js (207 dòng) của @deepseek-ai/dsh-subagent, seam CẤU TRÚC thay augment module.
 */

import type { Context } from "@deepseek-ai/cordis";
import type { Agent, AgentOptions, CreateAgentOptions } from "@galaxy-blackhole/gbh-agent";
import type { SandboxMode } from "@galaxy-blackhole/gbh-sandbox";
import type { Session, SessionId } from "@galaxy-blackhole/gbh-session";
import type { ToolRestriction } from "@galaxy-blackhole/gbh-host-tools";

import { delegationDepthOf } from "./depth.ts";
import { SubagentError } from "./error.ts";

/**
 * Seam `agentPresets` mà tệp này gọi, khai theo CẤU TRÚC: sổ preset của kernel do row
 * `agent-preset-registry` cấp, không cộng gộp module (ADR 000d).
 */
interface AgentPresetsSeam {
  /**
   * Mount một preset độc lập vào scope của context con.
   * Nhận: `ctx` — context con; `id` — tên preset, bỏ trống là preset đang đứng.
   * Trả: promise hoàn tất khi preset đã bind xong.
   */
  mount(ctx: Context, id?: string): Promise<unknown>;
  /**
   * Cho context con join ĐÚNG revision mà context cha đang giữ.
   * Nhận: `ctx` — context con; `parent` — context cha.
   * Trả: preset thừa kế, hoặc `undefined` trong bố cục không có preset.
   */
  composeFrom(ctx: Context, parent: Context): string | undefined;
  /**
   * Đọc preset mà một Agent ĐANG SỐNG dùng.
   * Nhận: `ctx` — context Agent.
   * Trả: danh tính preset nếu đã bind, ngược lại `undefined`.
   */
  composedPreset(ctx: Context): string | undefined;
}

/** Seam `permissionPresets`: preset quyền hiệu lực của một phiên. */
interface PermissionPresetsSeam {
  /**
   * Đọc preset quyền hiện tại của một phiên.
   * Nhận: `session` — phiên cần đọc.
   * Trả: danh tính preset đã cấu hình (bản gốc luôn trả chuỗi).
   */
  current(session: Session): string;
}

/** Seam `sandboxPolicy`: override chế độ sandbox GHI BỀN theo phiên. */
interface SandboxPolicySeam {
  /**
   * Đọc override chế độ sandbox gần nhất của một phiên.
   * Nhận: `session` — phiên cần đọc.
   * Trả: chế độ đã override, hoặc `undefined` khi phiên chưa override.
   */
  overrideOf(session: Session): SandboxMode | undefined;
}

/** Mục ngữ cảnh động mà seam `systemPrompt.context` nhận. */
interface PromptContextContribution {
  /** Tên duy nhất của mục ngữ cảnh. */
  readonly name: string;
  /** Thứ tự ghép tăng dần. */
  readonly order: number;
  /** Chữ tĩnh của mục. */
  readonly text: string;
}

/** Mục section tĩnh mà seam `systemPrompt.section` nhận. */
interface PromptSectionContribution {
  /** Tên duy nhất của section. */
  readonly name: string;
  /** Thứ tự ghép tăng dần. */
  readonly order: number;
  /** Chữ tĩnh của section. */
  readonly text: string;
}

/** Tên vị trí ngữ cảnh runtime mà tệp này dùng — đúng nguyên văn bản gốc. */
type SubagentContextOrderName = "SUBAGENT_DELEGATION";

/** Tên vị trí section mà tệp này dùng — đúng nguyên văn bản gốc. */
type SubagentSectionOrderName = "DEPLOYMENT_PERSONA_PREFIX";

/** Seam `systemPrompt` mà cửa sổ tạo agent con đăng ký ngữ cảnh/section. */
interface SystemPromptSeam {
  /**
   * Đăng ký một mục ngữ cảnh động trong scope đang gọi.
   * Nhận: `contribution` — mục ngữ cảnh.
   * Trả: hàm dọn của hiệu ứng vừa đăng ký (bỏ qua như bản gốc).
   */
  context(contribution: PromptContextContribution): unknown;
  /**
   * Đăng ký một section tĩnh trong scope đang gọi.
   * Nhận: `contribution` — section.
   * Trả: hàm dọn của hiệu ứng vừa đăng ký (bỏ qua như bản gốc).
   */
  section(contribution: PromptSectionContribution): unknown;
  /**
   * Phân giải vị trí do trung tâm sở hữu của một mục ngữ cảnh.
   * Nhận: `name` — tên vị trí ổn định.
   * Trả: thứ tự sắp xếp dạng số.
   */
  getContextOrder(name: SubagentContextOrderName): number;
  /**
   * Phân giải vị trí do trung tâm sở hữu của một section prompt.
   * Nhận: `name` — tên vị trí ổn định.
   * Trả: thứ tự sắp xếp dạng số.
   */
  getSectionOrder(name: SubagentSectionOrderName): number;
}

/** Seam `tools` mà cửa sổ tạo agent con áp giới hạn tool. */
interface ToolsSeam {
  /**
   * Gắn một giới hạn tool vào scope đang gọi.
   * Nhận: `filter` — danh sách `allow`/`deny` đã kiểm.
   * Trả: hàm dọn của hiệu ứng vừa đăng ký (bỏ qua như bản gốc).
   */
  restrict(filter: ToolRestriction): unknown;
}

/** Context con trong cửa sổ bố cục, khai theo CẤU TRÚC: đúng hai seam mà phần setup gọi. */
interface ChildCompositionContextSeam {
  /** Sổ prompt của scope con. */
  readonly systemPrompt: SystemPromptSeam;
  /** Sổ tool của scope con. */
  readonly tools: ToolsSeam;
}

/** Seam ghi log của Session, khai theo CẤU TRÚC cho ba sự kiện chính sách. */
interface DelegatedPolicyLogSeam {
  /**
   * Ghi chế độ sandbox nguồn `delegation` vào log con.
   * Nhận: `type` — loại sự kiện; `data` — chế độ + nguồn.
   * Trả: sự kiện vừa ghi (bỏ qua như bản gốc).
   */
  append(type: "sandbox/mode", data: { readonly mode: SandboxMode; readonly source: "delegation" }): unknown;
  /**
   * Ghim chính sách duyệt nguồn `delegation` vào log con.
   * Nhận: `type` — loại sự kiện; `data` — chính sách + nguồn.
   * Trả: sự kiện vừa ghi (bỏ qua như bản gốc).
   */
  append(type: "approval/policy", data: { readonly policy: "never"; readonly source: "delegation" }): unknown;
  /**
   * Ghi preset quyền đã thừa kế vào log con.
   * Nhận: `type` — loại sự kiện; `data` — preset.
   * Trả: sự kiện vừa ghi (bỏ qua như bản gốc).
   */
  append(type: "permission/preset", data: { readonly preset: "auto" | "danger-full-access" }): unknown;
}

/** Ném khi bắt đầu một con sẽ vượt trần độ sâu được yêu cầu. */
export class SubagentDepthError extends Error {
  /** Độ sâu đã cố gắng đạt tới. */
  readonly attemptedDepth: number;

  /** Trần độ sâu được yêu cầu. */
  readonly maxDepth: number;

  /**
   * Dựng lỗi với thông điệp nguyên văn của bản gốc.
   * Nhận: `attemptedDepth` — độ sâu sẽ dùng; `maxDepth` — trần được yêu cầu.
   * Trả: không (lỗi đã dựng).
   */
  constructor(attemptedDepth: number, maxDepth: number) {
    super(`subagent depth ${attemptedDepth} exceeds maxDepth ${maxDepth}`);
    this.attemptedDepth = attemptedDepth;
    this.maxDepth = maxDepth;
    this.name = "SubagentDepthError";
  }
}

/**
 * Phân giải độ sâu uỷ nhiệm của con từ cha và cưỡng chế trần tuỳ chọn. Header cha đã lưu là sàn
 * ĐƠN ĐIỆU, nên một cha được resume không thể uỷ nhiệm như thể nó là cấp gốc.
 * Nhận: `parent` — Agent cha đang uỷ nhiệm; `maxDepth` — trần tuyệt đối tuỳ chọn mà độ sâu phân
 *   giải không được vượt.
 * Trả: độ sâu của con, số nguyên an toàn không âm.
 * @throws {SubagentDepthError} khi độ sâu phân giải vượt `maxDepth`.
 * @throws {RangeError} khi độ sâu phân giải ra khỏi miền số nguyên an toàn.
 */
export function resolveChildDepth(parent: Agent, maxDepth: number | undefined): number {
  const childDepth = delegationDepthOf(parent) + 1;
  if (!Number.isSafeInteger(childDepth)) {
    throw new RangeError("subagent child depth exceeds the safe-integer range");
  }
  if (maxDepth !== undefined && childDepth > maxDepth) {
    throw new SubagentDepthError(childDepth, maxDepth);
  }
  return childDepth;
}

/**
 * Phân giải các giá trị của cha mà con thừa kế. Header yêu cầu GẦN NHẤT sở hữu provider, model và
 * reasoning effort sau phép chọn tại thời điểm request; options lúc tạo vẫn là dự phòng trước yêu
 * cầu đầu tiên và giữ trần token đầu ra đã cấu hình.
 * Nhận: `parent` — Agent cha đang uỷ nhiệm.
 * Trả: AgentOptions đã tách rời để gộp vào options của con.
 */
export function parentAgentOptionsForDelegation(parent: Agent): AgentOptions {
  const requestConfig = parent.session.requestHeader()?.config;
  if (requestConfig === undefined) return { ...parent.options };
  const { provider: _createdProvider, model: _createdModel, reasoningEffort: _createdReasoningEffort, ...createdOptions } = parent.options;
  return {
    ...createdOptions,
    provider: requestConfig.provider,
    model: requestConfig.model,
    ...(requestConfig.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: requestConfig.reasoningEffort }),
  };
}

/**
 * Phân giải `AgentOptions` của con: provider/model, reasoning effort và maxTokens của cha trừ khi
 * yêu cầu đè lên, rồi đóng dấu độ sâu uỷ nhiệm riêng của con. Đổi tuyến mà không nêu effort sẽ xoá
 * effort do tuyến cũ sở hữu để model được chọn tự phân giải mặc định của nó.
 * Nhận: `parent` — cha mà con thừa kế tuyến; `requested` — các giá trị đè riêng của con, nếu có;
 *   `childDepth` — độ sâu uỷ nhiệm đã phân giải để đóng dấu.
 * Trả: options đã phân giải cho `ctx.agents.create()`.
 */
export function resolveChildAgentOptions(parent: Agent, requested: AgentOptions | undefined, childDepth: number): AgentOptions {
  const parentOptions = parentAgentOptionsForDelegation(parent);
  const parentProvider = parentOptions.provider;
  const parentModel = parentOptions.model;
  const parentReasoningEffort = parentOptions.reasoningEffort;
  const parentMaxTokens = parentOptions.maxTokens;
  const resolved = {
    ...(parentProvider !== undefined ? { provider: parentProvider } : {}),
    ...(parentModel !== undefined ? { model: parentModel } : {}),
    ...(parentReasoningEffort !== undefined ? { reasoningEffort: parentReasoningEffort } : {}),
    ...(parentMaxTokens !== undefined ? { maxTokens: parentMaxTokens } : {}),
    ...requested,
    subagentDepth: childDepth,
  };
  const routeChanged = resolved.provider !== parentProvider || resolved.model !== parentModel;
  if (routeChanged && requested?.reasoningEffort === undefined) delete resolved.reasoningEffort;
  return resolved;
}

/**
 * Dựng metadata tạo bền của phiên con: thư mục làm việc của cha, dòng dõi trực tiếp, nguồn gốc sản
 * phẩm thô, ngân sách đệ quy phải sống sót qua lưu bền, ranh giới seed phân tách lịch sử cha được
 * thừa kế khỏi việc của con, và bố cục mà con chạy dưới đó.
 *
 * Lựa chọn bỏ trống dùng bố cục ĐANG SỐNG của cha, kể cả lần đổi đã thực hiện khi cha còn trống.
 * Nhận: `parent` — Agent cha đang uỷ nhiệm; `childDepth` — độ sâu uỷ nhiệm đã phân giải để lưu;
 *   `isSeeded` — con có thừa kế tiền tố log của cha hay không, kể cả tiền tố rỗng được nêu rõ;
 *   `selectedPreset` — lựa chọn độc lập, hoặc bỏ trống để thừa kế cha.
 * Trả: `meta` cho `ctx.agents.create()`.
 */
export function childSessionMeta(parent: Agent, childDepth: number, isSeeded: boolean, selectedPreset?: string): NonNullable<CreateAgentOptions["meta"]> {
  // ADR 000d (08/11/2026 dev-1): bản port gbh-agent không khai header trên AgentSession (kernel thì CÓ)
  // ⇒ đọc qua mặt CẤU TRÚC tại biên, không nới kiểu toàn cục.
  const parentHeader = (parent.session as unknown as {
    readonly header: { readonly id: SessionId; readonly cwd?: string };
  }).header;
  const agentPreset = selectedPreset ?? (parent.ctx.get("agentPresets") as AgentPresetsSeam | undefined)?.composedPreset(parent.ctx);
  return {
    ...(parentHeader.cwd !== undefined ? { cwd: parentHeader.cwd } : {}),
    ...(agentPreset === undefined ? {} : { agentPreset }),
    parentSession: parentHeader.id,
    isSeeded,
    // Chỉ để phân loại điều hướng; descriptor vẫn là nguồn có thẩm quyền về mode và khả năng tiếp nối.
    origin: "subagent",
    // Bền: ngân sách đệ quy phải sống sót qua lưu bền và resume.
    delegationDepth: childDepth,
  };
}

/** Bố cục theo scope mà cửa sổ tạo agent con áp dụng. */
export interface ChildComposition {
  /** Preset mount độc lập; bỏ trống là dùng chung thế hệ đang đứng của cha. */
  readonly agentPreset?: string | undefined;
  /** Persona của descriptor lịch sử, chỉ áp lại khi cold resume. */
  readonly persona?: string | undefined;
  /** Giới hạn tool của descriptor lịch sử, chỉ áp lại khi cold resume. */
  readonly toolFilter?: ToolRestriction | undefined;
}

/**
 * Câu nêu phạm vi uỷ nhiệm hướng tới model cho MỌI con trong tiến trình. Đây là một đóng góp ngữ
 * cảnh runtime chứ không phải section system prompt, để system prompt của deployment giữ nguyên
 * giữa cha và con.
 */
export const SUBAGENT_DELEGATION_CONTEXT = "You are a delegated subagent: your permission scope was fixed when you were started and cannot be "
  + "widened from inside this session — operations that require approval are rejected automatically. "
  + "When the task needs access beyond that scope, do not retry the denied operation; state the "
  + "limitation in your reply so the delegating agent can handle it.";

/**
 * Soạn bố cục cho con TRƯỚC khi công bố và phục hồi các đè của descriptor lịch sử. Lựa chọn nêu rõ
 * thì mount preset được nêu; bỏ trống thì join ĐỒNG BỘ thế hệ hiện tại của cha. Các đăng ký thuộc
 * scope của con.
 * Nhận: `childCtx` — context tạo theo scope của agent con; `parent` — cha dùng khi không chọn
 *   preset; `composition` — preset độc lập và các đè đọc từ descriptor lịch sử.
 * Trả: promise khi phải mount preset độc lập; ngược lại hoàn tất đồng bộ.
 * @throws {SubagentError} với mã `PRESET_UNAVAILABLE` khi chọn preset mà thiếu service agent-presets.
 */
export function applyChildComposition(childCtx: Context, parent: Agent, composition: ChildComposition): void | Promise<void> {
  if (composition.agentPreset !== undefined) {
    const presets = childCtx.get("agentPresets") as AgentPresetsSeam | undefined;
    if (presets === undefined) {
      throw new SubagentError("selecting a child agent preset requires the agent-presets service", "PRESET_UNAVAILABLE");
    }
    return presets.mount(childCtx, composition.agentPreset).then(() => {
      applyChildOverrides(childCtx, composition);
    });
  }
  (childCtx.get("agentPresets") as AgentPresetsSeam | undefined)?.composeFrom(childCtx, parent.ctx);
  applyChildOverrides(childCtx, composition);
}

/**
 * Đăng ký câu phạm vi uỷ nhiệm cùng các đè persona/tool của một descriptor lịch sử vào scope con.
 * Nhận: `childCtx` — context con; `composition` — persona và/hoặc giới hạn tool cần áp lại.
 * Trả: không.
 */
function applyChildOverrides(childCtx: Context, composition: ChildComposition): void {
  const scoped = childCtx as unknown as ChildCompositionContextSeam;
  scoped.systemPrompt.context({
    name: "subagent:delegation",
    order: scoped.systemPrompt.getContextOrder("SUBAGENT_DELEGATION"),
    text: SUBAGENT_DELEGATION_CONTEXT,
  });
  if (composition.persona !== undefined) {
    scoped.systemPrompt.section({
      name: "deployment:persona-prefix",
      order: scoped.systemPrompt.getSectionOrder("DEPLOYMENT_PERSONA_PREFIX"),
      text: composition.persona,
    });
  }
  if (composition.toolFilter !== undefined) scoped.tools.restrict(composition.toolFilter);
}

/** Chính sách được seed vào log của phiên con tại ranh giới uỷ nhiệm. */
export interface DelegatedPolicyOverrides {
  /**
   * Danh tính preset hiện tại của cha khi cha chạy ở Auto hoặc Full access; con giữ nó dưới chính
   * sách duyệt đã ghim `never`.
   */
  readonly permissionPreset: "auto" | "danger-full-access" | undefined;
  /** Override chế độ sandbox rõ ràng của phiên cha, hoặc `undefined` khi không có. */
  readonly sandboxMode: SandboxMode | undefined;
  /**
   * `never` mỗi khi năng lực duyệt đã được soạn, `undefined` nếu không: con uỷ nhiệm chỉ hành động
   * trong phạm vi sandbox đã cố định lúc uỷ nhiệm, nên mọi câu hỏi duyệt của nó bị từ chối tất định.
   */
  readonly approvalPolicy: "never" | undefined;
}

/**
 * Chụp trạng thái quyền để seed vào MỘT lần uỷ nhiệm. Gọi ĐỒNG BỘ trước điểm await đầu tiên của
 * lần khởi động con: lần đổi sau đó của cha thuộc về tương lai của cha, không thuộc con này. Danh
 * tính Auto và Full access chỉ được thừa kế qua đường DSH trong tiến trình để một trong hai có thể
 * thay giá trị fork cùng bundle đã cũ. Chỉ override sandbox RÕ RÀNG của phiên cha được chụp — không
 * bao giờ là mặc định deployment hay quyền một lần — và chính sách duyệt bị ghim `never` bất kể
 * chính sách của chính cha.
 * Nhận: `parent` — Agent cha đang uỷ nhiệm.
 * Trả: override sandbox (hoặc `undefined` khi không có) và chính sách duyệt đã ghim.
 */
export function captureDelegatedPolicyOverrides(parent: Agent): DelegatedPolicyOverrides {
  const permissionPresets = parent.ctx.get("permissionPresets") as PermissionPresetsSeam | undefined;
  // Seam kernel nhận Session; parent.session là AgentSession của gói GBH (khác danh tính) ⇒ ép tại biên.
  const preset = permissionPresets?.current(parent.session as unknown as Session);
  const sandboxPolicy = parent.ctx.get("sandboxPolicy") as SandboxPolicySeam | undefined;
  return {
    permissionPreset: preset === "auto" || preset === "danger-full-access" ? preset : undefined,
    sandboxMode: sandboxPolicy?.overrideOf(parent.session as unknown as Session),
    approvalPolicy: parent.ctx.get("approval") === undefined ? undefined : "never",
  };
}

/**
 * Ghi chính sách uỷ nhiệm đã chụp vào log CỦA CON dưới dạng sự kiện `source: 'delegation'` bên
 * trong cửa sổ tạo chưa công bố, để chính sách hiệu lực của con dựng lại được chỉ từ log của nó.
 * Các lần ghi rơi SAU mọi seed fork, nên chính sách mới thắng trạng thái seed cũ; các lần đổi sau
 * đó của con vẫn thắng các sự kiện này.
 * Nhận: `childSession` — phiên CHƯA công bố của con; `overrides` — chính sách đã chụp lúc uỷ nhiệm.
 * Trả: không.
 */
export function appendDelegatedPolicyOverrides(childSession: Session, overrides: DelegatedPolicyOverrides): void {
  const log = childSession as unknown as DelegatedPolicyLogSeam;
  if (overrides.sandboxMode !== undefined) {
    log.append("sandbox/mode", { mode: overrides.sandboxMode, source: "delegation" });
  }
  if (overrides.approvalPolicy !== undefined) {
    log.append("approval/policy", { policy: overrides.approvalPolicy, source: "delegation" });
  }
  if (overrides.permissionPreset !== undefined) {
    log.append("permission/preset", { preset: overrides.permissionPreset });
  }
}

/** Đầu vào danh tính và dòng dõi dùng chung cho mọi lần tạo con trong tiến trình. */
export interface ChildCreateInputs {
  /** Id phiên đã giữ trước của con. */
  readonly sessionId: SessionId;
  /** Agent cha đang uỷ nhiệm. */
  readonly parent: Agent;
  /** Độ sâu uỷ nhiệm đã phân giải. */
  readonly childDepth: number;
  /** Số sự kiện seed đầu tiên đến từ log của cha. */
  readonly lineageSeedLength: number;
}
