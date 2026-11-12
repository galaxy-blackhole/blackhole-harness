/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Service Definition của seam subagent (`ctx.subagents`): sổ provider có tên, kiểm năng lực lúc
 *      khởi chạy, kích hoạt có quản lý, khám phá bền vững và nhắn tin giữa Agent cạnh nhau. Port 1:1
 *      `lib/types/index.js` (458 dòng) + `index.d.ts` (319 dòng) của `@deepseek-ai/dsh-subagent`,
 *      giữ 3 event `subagent/start` · `subagent/end` · `subagent/provider-added`.
 */

/**
 * Service Definition cho seam năng lực subagent (`ctx.subagents`): một sổ provider có tên cộng API khởi
 * chạy bất đồng bộ có kiểm năng lực. Provider dựng xong con TRƯỚC khi trả lần chạy, nên việc hoàn tất
 * chính là ranh giới công bố và chuyển giao quyền sở hữu duy nhất.
 *
 * Nhiều provider cùng tồn tại: mỗi provider đăng ký dưới một tên duy nhất và bên gọi chọn theo tên.
 *
 * Gói này giữ vai Service Definition của seam; các Service Provider
 * (`@deepseek-ai/dsh-subagent-spawn-in-process`, `-fork`, `-acp`) và bên tiêu thụ hướng model
 * (`@deepseek-ai/dsh-tool-subagent`) là gói riêng.
 *
 * `startActivation` dựng mọi con dưới quản lý kích hoạt — bên sở hữu thi hành, giao kết quả và nhả tài
 * nguyên. Provider cục bộ gieo Agent chạy lại được; provider bên ngoài trả một tay nắm thi hành duy nhất.
 * `sendMessage` lái giữa các Agent cục bộ cạnh nhau mà không lộ việc con có đang cư trú hay không.
 *
 * @module @galaxy-blackhole/gbh-subagent
 */

import type { Context, Volatile } from "@deepseek-ai/cordis";
import type { Agent } from "@galaxy-blackhole/gbh-agent";
import type { ContentBlock, MessageId, MessageSource } from "@deepseek-ai/dsh-llm";
import { scopeTarget } from "@deepseek-ai/dsh-scope";
import type { SessionId } from "@galaxy-blackhole/gbh-session";
import { assertObjectJsonSchema } from "@galaxy-blackhole/gbh-host-tools";
import type { RemoteErrorDetailsMap } from "@deepseek-ai/dsh-typert-protocol";
import { Remote, RemoteError as ProtocolRemoteError, TypertRemoteService, principalOf } from "@deepseek-ai/dsh-typert-protocol";
import { canonicalClientTimeZone } from "@deepseek-ai/dsh-util-time";
import z from "@deepseek-ai/schemastery";

import { installSubagentArchiveAdmission } from "./archive-admission.ts";
import { subagentCatalogProjectionDefinition } from "./catalog.ts";
import { rejectPrompt, validateControlRequest } from "./control.ts";
import type { SubagentDelivery, SubagentInterruptReceipt, SubagentPromptReceipt, SubagentPromptRequest } from "./control-types.ts";
import { assertSubagentMaxDepth } from "./depth.ts";
import { SubagentError } from "./error.ts";
import { deliverSubagentPrompt } from "./internal.ts";
import { createActivationObserver, createLifecycleEmitter } from "./lifecycle.ts";
import type { ActivationObserver, LifecycleEmitter } from "./lifecycle.ts";
import { listChildren as listSubagentChildren, listDescendants as listSubagentDescendants } from "./list-children.ts";
import type { SubagentDescendantListEntry } from "./list-children.ts";
import SubagentManager from "./manager.ts";
import { subagentIdentityProjectionDefinition, subagentTimingProjectionDefinition } from "./projection.ts";
import type { SubagentCatalogEntry } from "./projection-types.ts";
import type {
  ContinuableCreateRequest,
  ContinuableCreateSpec,
  ResolvedSubagentStartRequest,
  SubagentActivation,
  SubagentActivationSpec,
  SubagentInterruptAuthority,
  SubagentProvider,
  SubagentSendMessageOptions,
  SubagentStartRequest,
} from "./types.ts";

// ── Bề mặt RUNTIME của bản gốc (index.js dòng 50–57): từng tên giữ NGUYÊN VĂN, lấy từ module sở hữu nó.
export * from "./out-of-process.ts";
export { AssistantOutputFold, finalAssistantOutput } from "./assistant-output.ts";
export { SubagentRunId } from "./types.ts";
export { foldSubagentDescriptor, snapshotSubagentDescriptor, SUBAGENT_DESCRIPTOR_VERSION } from "./descriptor.ts";
export { STRUCTURED_OUTPUT_TOOL } from "./structured.ts";
export { SubagentError } from "./error.ts";
export { assertSubagentMaxDepth, delegationDepthOf } from "./depth.ts";
export {
  appendDelegatedPolicyOverrides,
  applyChildComposition,
  captureDelegatedPolicyOverrides,
  childSessionMeta,
  parentAgentOptionsForDelegation,
  resolveChildAgentOptions,
  resolveChildDepth,
  SubagentDepthError,
} from "./child-agent.ts";

// ── Bề mặt CHỈ-KIỂU của bản gốc (index.d.ts dòng 43–59), mỗi tên lấy từ đúng module đã port nó.
// Dấu vết nạp kiểu của bản gốc: catalog.ts khai định nghĩa chiếu mà index.d.ts trỏ tới.
export type {} from "./catalog.ts";
export type {
  ContinuableCreateRequest,
  ContinuableCreateSpec,
  SubagentActivation,
  SubagentActivationSpec,
  SubagentCapabilities,
  SubagentInterruptAuthority,
  SubagentProvider,
  SubagentResult,
  SubagentRun,
  SubagentSendMessageOptions,
  SubagentStartRequest,
  ResolvedSubagentStartRequest,
  SubagentStopReason,
  SubagentStopReasonMap,
} from "./types.ts";
export type {
  ContinuableSubagentDescriptorData,
  ContinuableSubagentDescriptorInput,
  OneShotSubagentDescriptorData,
  SubagentDescriptorData,
} from "./descriptor.ts";
export type { ChildComposition, DelegatedPolicyOverrides } from "./child-agent.ts";
export type { AgentMessageSource, SubagentSettledMessageSource } from "./continuation-messages.ts";
// Bản gốc viết `export type * from './control-types.ts'`. Bản port của control-types.ts còn xuất thêm hai
// bản đồ seam (`SubagentSessionActivityKindMap` · `SubagentRemoteErrorDetailsMap`) để THAY khối augment
// của gốc — chúng không thuộc bề mặt stock, nên liệt kê ĐÚNG tám tên stock thay vì star-export.
export type {
  SubagentAddress,
  SubagentCatalogRow,
  SubagentDelivery,
  SubagentInterruptReceipt,
  SubagentListEntry,
  SubagentPromptReceipt,
  SubagentPromptRequest,
  SubagentPromptRequestId,
} from "./control-types.ts";
export type { SubagentDescendantListEntry } from "./list-children.ts";
export type { SubagentRunEndInfo, SubagentRunInfo } from "./types.ts";
export type { SubagentCatalogEntry, SubagentIdentityProjection, SubagentTimingProjection } from "./projection-types.ts";

/**
 * Mục lỗi Remote do chính module này dựng, khai theo CẤU TRÚC — thay cho khối augment
 * `RemoteErrorDetailsMap` của bản gốc (`control-types.d.ts`) mà repo CẤM. Khoá lỗi và hình dạng payload
 * giữ NGUYÊN VĂN; đây là chỗ DUY NHẤT nới kiểu cho `RemoteError`.
 */
interface RuntimeRemoteErrorDetailsMap {
  /** Vùng thời gian do trình duyệt gửi không phải UTC hay tên IANA Area/Location hợp lệ. */
  readonly "subagent/invalid-time-zone": { readonly value: string };
  /** Không có Agent sống nào mang id phiên cha được nêu. */
  readonly "subagent/parent-unavailable": { readonly parentSessionId: SessionId };
  /** Cha được trình không sở hữu con được nêu. */
  readonly "subagent/unauthorized": { readonly childSessionId: SessionId };
}

/** Toàn bộ mã lỗi Remote mà module này dựng: mã riêng của namespace cộng mã phổ quát của gói protocol. */
type RuntimeRemoteDetails = RuntimeRemoteErrorDetailsMap & RemoteErrorDetailsMap;

/** Mọi mã lỗi Remote mà module này dựng được. */
type RuntimeRemoteCode = keyof RuntimeRemoteDetails;

/** Kiểu hàm dựng `RemoteError` đã buộc mã lỗi với ĐÚNG hình dạng chi tiết của nó. */
type RuntimeRemoteErrorConstructor = new <Code extends RuntimeRemoteCode>(
  code: Code,
  message: string,
  details: RuntimeRemoteDetails[Code],
  options?: ErrorOptions,
) => Error;

/**
 * Lớp `RemoteError` của kernel nhìn qua seam CẤU TRÚC: ép kiểu tại ĐÚNG MỘT chỗ này để mọi chỗ ném giữ
 * nguyên văn `new RemoteError(mã, thông điệp, chi tiết, { cause })` như bản gốc mà vẫn được tsc kiểm
 * cặp mã/chi tiết. Runtime không đổi — vẫn là lớp Error thật của `@deepseek-ai/dsh-typert-protocol`.
 */
const RemoteError = ProtocolRemoteError as unknown as RuntimeRemoteErrorConstructor;

/** Sổ Agent của kernel nhìn theo CẤU TRÚC (repo không augment `Context`). */
interface AgentsSeam {
  /**
   * Tra Agent đang sống theo id phiên.
   * Nhận: `sessionId` — id phiên bền vững.
   * Trả: Agent đang sống, hoặc undefined khi không có.
   */
  get(sessionId: SessionId): Agent | undefined;
}

/** Sổ chiếu phiên của kernel nhìn theo CẤU TRÚC. */
interface SessionProjectionsSeam {
  /**
   * Đăng ký một định nghĩa chiếu; đăng ký là hiệu ứng thuộc vòng đời plugin gọi nó.
   * Nhận: `definition` — định nghĩa chiếu đã port.
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  register(definition: unknown): unknown;
}

/** Context con đã áp inject `sessionProjections`. */
interface SessionProjectionsContext {
  /** Sổ chiếu phiên của kernel. */
  readonly sessionProjections: SessionProjectionsSeam;
}

/** Kho đính kèm của kernel nhìn theo CẤU TRÚC: chỉ phần mà prompt ảnh gọi tới. */
interface AttachmentStoreSeam {
  /**
   * Nhận và ghi bền các phần nội dung prompt trước khi giao.
   * Nhận: `content` — các phần prompt do trình duyệt gửi.
   * Trả: các phần đã được Host nhận, mọi đính kèm là tham chiếu bền vững.
   */
  admitPromptContent(content: readonly PromptContentPart[]): Promise<ContentBlock[]>;
}

/** Bus event của cordis nhìn theo CẤU TRÚC — chỉ đúng event mà module này phát TRỰC TIẾP. */
interface SubagentEventBus {
  /**
   * Phát một event đồng bộ tới các listener.
   * Nhận: `name` — tên event; `provider` — provider vừa vào sổ.
   * Trả: không.
   */
  emit(name: "subagent/provider-added", provider: SubagentProvider): void;
}

/** Một phần nội dung prompt do trình duyệt gửi (rút từ hình dạng yêu cầu control). */
type PromptContentPart = SubagentPromptRequest["content"][number];

/** Phần prompt VĂN BẢN thuần. */
type TextPromptContentPart = Extract<PromptContentPart, { type: "text" }>;

/** Cấu hình Host cho sức chứa subagent tiếp nối được. */
export interface Config {
  /** Số con sống tối đa chia sẻ liên kết cha tiếp nối không gián đoạn; mặc định 8. */
  maxActiveSubagents: Volatile<number>;
  /** Độ sâu uỷ nhiệm mặc định cho công cụ không khai giới hạn; mặc định 1. */
  maxDepth: Volatile<number>;
}

/**
 * Sổ provider có tên với kích hoạt được quản lý, khám phá bền vững và nhắn tin con cục bộ.
 *
 * Đây là plugin cordis dạng LỚP đúng như bản gốc (bản gốc KHÔNG xuất `apply`/`name` ở mức module):
 * `static Config` + `static inject` là bề mặt plugin, `constructor` là thân plugin; service đăng ký
 * dưới khoá `subagents`.
 *
 * Event giữ NGUYÊN VĂN tên và payload:
 *   · `subagent/start` — provider dựng xong một con đã công bố (qua emitter vòng đời);
 *   · `subagent/end` — con đã công bố đó kết thúc, ghép cặp theo `runId` (qua emitter vòng đời);
 *   · `subagent/provider-added` — ngay khi provider vào sổ (phát trực tiếp tại đây);
 *   · `subagent/provider-removed` — khi provider rời sổ (bản gốc cũng phát, giữ 1:1).
 */
export class SubagentRuntime extends TypertRemoteService {
  /**
   * Schema cấu hình: hai trường dạng tham chiếu SỐNG để Settings sửa được mà không dựng lại plugin.
   * Nhận: không (schema chỉ mô tả hình dạng). Trả: schema đã áp mặc định của bản gốc (1 · 8).
   */
  static Config = z.object({
    maxDepth: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(1).volatile(),
    maxActiveSubagents: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(8).volatile(),
  });

  /** Seam bắt buộc: thư mục làm việc mà quản lý tiếp nối đọc khi dựng con. */
  static inject: string[] = ["workingDirectory"];

  /** Cấu hình sống do tầng nạp cấp — KHÔNG sao chép giá trị lúc dựng. */
  private config: Config;

  /** Sổ provider theo tên, giữ thứ tự chèn. */
  private readonly providers = new Map<string, SubagentProvider>();

  /** Quản lý tiếp nối; chỉ tồn tại khi seam `agents` sẵn sàng. */
  private manager: SubagentManager | undefined;

  /**
   * Bộ phát cạnh vòng đời có chứa lỗi. Dựng ở đây vì dispatch theo phạm vi khoá vật mang của nó bằng
   * ĐÚNG instance dịch vụ này, mà bộ lọc context của chính nó lại hợp thành vào vật mang.
   */
  private readonly emitLifecycle: LifecycleEmitter;

  /**
   * Đăng ký service `subagents`, quản lý tiếp nối, ba đơn vị chiếu phiên và tiếp nhận lưu trữ.
   * Nhận: `ctx` — context của plugin; `config` — hai tham chiếu cấu hình sống đã qua schema.
   * Trả: không (đây là constructor); hiệu ứng là service đã cấp dưới khoá `subagents`.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "subagents");
    this.config = config;
    this.emitLifecycle = createLifecycleEmitter(this.ctx, (parent: Agent) => scopeTarget(this, parent));
    ctx.inject(["agents"], (childCtx) => {
      const manager = new SubagentManager(childCtx, {
        startExternal: (name: string, request: ResolvedSubagentStartRequest) => {
          const provider = this.expectProvider(name);
          // Bản gốc gọi thẳng `provider.start(request)`: tiền kiện đã được `registerProvider` bảo đảm và
          // `startExternal` chỉ tới được với provider KHÔNG có `prepareContinuable`.
          return provider.start!(request);
        },
        prepareContinuable: (name: string, request: ContinuableCreateRequest) => this.prepareContinuable(name, request),
        observeActivation: (provider: string, childId: SessionId, parent: Agent) => this.observeActivation(provider, childId, parent),
      }, () => this.config.maxActiveSubagents.get());
      this.manager = manager;
      childCtx.effect(() => () => {
        // Một ràng buộc được tiêm giữ ô này tới khi fiber của nó dispose.
        if (this.manager === manager) this.manager = undefined;
      }, "subagents.managerBinding()");
    });
    ctx.inject(["sessionProjections"], (projectionCtx) => {
      const projections = (projectionCtx as unknown as SessionProjectionsContext).sessionProjections;
      projections.register(subagentCatalogProjectionDefinition);
      projections.register(subagentTimingProjectionDefinition);
      projections.register(subagentIdentityProjectionDefinition);
    });
    // Tiếp nhận lưu trữ: runtime này là chủ sở hữu biết con sống nào hậu duệ của một Session và cha dừng
    // chúng thế nào.
    ctx.inject(["agents"], (agentsCtx) => { installSubagentArchiveAdmission(agentsCtx); });
  }

  /**
   * Phân giải chính sách độ sâu của một công cụ uỷ nhiệm theo cài đặt người dùng hiện tại.
   * Nhận: `configured` — giới hạn công cụ khai rõ, hoặc `provider-managed` với uỷ nhiệm bên ngoài.
   * Trả: giới hạn dạng số, hoặc undefined khi provider tự giữ việc ép độ sâu.
   */
  resolveMaxDepth(configured?: number | "provider-managed"): number | undefined {
    if (configured === "provider-managed") return undefined;
    if (configured !== undefined) return configured;
    const depth = this.config.maxDepth.get();
    assertSubagentMaxDepth(depth);
    return depth;
  }

  /**
   * Dựng con cục bộ dưới danh tính đã dành sẵn.
   * Nhận: `spec` — tác vụ cục bộ, id con đã dành, và bên nhận kết quả.
   * Trả: lần kích hoạt kèm id tin nhắn ban đầu đã được nhận.
   */
  startActivation(spec: SubagentActivationSpec & { readonly childId: SessionId }): Promise<SubagentActivation & { readonly messageId: MessageId }>;
  /**
   * Dựng con cục bộ hoặc bên ngoài.
   * Nhận: `spec` — tác vụ, backend, và bên nhận kết quả.
   * Trả: lần kích hoạt, chỉ có id tin nhắn với con cục bộ.
   */
  startActivation(spec: SubagentActivationSpec): Promise<SubagentActivation>;
  async startActivation(spec: SubagentActivationSpec): Promise<SubagentActivation> {
    const provider = this.expectProvider(spec.provider);
    if (spec.childId !== undefined && provider.prepareContinuable === undefined) {
      throw new SubagentError("reserved child ids require a local backend", "UNSUPPORTED_CAPABILITY");
    }
    assertSubagentMaxDepth(spec.request.maxDepth);
    this.assertCapabilities(provider, { ...spec.request, signal: spec.signal });
    const manager = this.requireManager();
    // spec.request.parent.id là chuỗi id của gói GBH; seam agents của kernel nhận SessionId (brand) ⇒ ép tại biên.
    const liveParent = (this.ctx.get("agents") as AgentsSeam | undefined)?.get(spec.request.parent.id as unknown as SessionId);
    if (liveParent !== spec.request.parent) {
      throw new SubagentError("subagent creation requires the exact live parent agent", "UNAUTHORIZED");
    }
    if (spec.request.outputSchema !== undefined) assertObjectJsonSchema(spec.request.outputSchema);
    return provider.prepareContinuable === undefined
      ? manager.startExternal(spec)
      : manager.startLocal(spec);
  }

  /**
   * Ghép công việc hậu duệ đang tiến triển mà KHÔNG huỷ chúng. Hậu duệ rảnh có hộp thư cần đánh thức
   * về sau vẫn cư trú và không làm chậm việc hoàn tất của Host.
   * Nhận: `parent` — đúng Agent cha mà công việc hậu duệ được quan sát.
   * Trả: đã ghép được công việc hay chưa; Host kiểm lại trạng thái rảnh của cha sau khi `true`.
   */
  async waitForChildren(parent: Agent): Promise<boolean> {
    return this.manager?.waitForChildren(parent) ?? false;
  }

  /**
   * Lái MỘT tin nhắn do model soạn tới cha trực tiếp của bên gửi hoặc tới con trực tiếp tiếp nối được.
   * Đích đang chạy nhận nó ở ranh giới bước gần nhất; đích rảnh mở một lượt; con trực tiếp vắng mặt thì
   * chạy lại nguội từ bản lưu. Service suy ra nguồn gốc bền vững của bên gửi từ ĐÚNG Agent đang sống.
   * Việc huỷ của bên gọi chỉ dừng công việc TRƯỚC khi hộp thư nhận.
   * Nhận: `sender` — đúng Agent đang sống, bên cho phép và là gốc tin nhắn; `targetId` — id phiên cha
   *        trực tiếp hoặc con trực tiếp bền vững; `content` — nội dung do model soạn; `options` — tín
   *        hiệu huỷ của bên gọi trước khi hộp thư nhận.
   * Trả: id hộp thư của tin nhắn đã được nhận.
   * @throws khi dịch vụ tiếp nối không sẵn sàng, khi quan hệ cạnh nhau bị từ chối, hoặc khi tin nhắn
   *         không được nhận.
   */
  async sendMessage(
    sender: Agent,
    targetId: SessionId,
    content: ContentBlock[],
    options: SubagentSendMessageOptions,
  ): Promise<MessageId> {
    return this.requireManager().sendMessage(sender, targetId, content, options);
  }

  /**
   * Giao MỘT tin nhắn giao thức Host tới con trực tiếp tiếp nối được. Khoá bằng ký hiệu để adapter Host
   * giữ được mô tả nguồn của chính nó mà không mở rộng Service Definition công khai hay giả làm Agent gửi.
   * Nhận: `parent` — đúng Agent cha trực tiếp đang sống, bên cho phép giao; `childId` — id phiên con
   *        trực tiếp bền vững; `content` — nội dung do Host soạn; `source` — mô tả nguồn giao thức Host
   *        bền vững; `signal` — tín hiệu huỷ của bên gọi trước khi hộp thư nhận; `delivery` — xếp hàng
   *        thành một lượt riêng hoặc lái ở bước gần nhất.
   * Trả: id hộp thư của tin nhắn đã được nhận.
   */
  private [deliverSubagentPrompt](
    parent: Agent,
    childId: SessionId,
    content: ContentBlock[],
    source: MessageSource,
    signal: AbortSignal,
    delivery: SubagentDelivery,
  ): Promise<MessageId> {
    return delivery === "steer"
      ? this.requireManager().steerPrompt(parent, childId, content, source, signal)
      : this.requireManager().queuePrompt(parent, childId, content, source, signal);
  }

  /**
   * Ngắt việc thi hành hiện tại của MỘT con đang sống dưới địa chỉ cha người dùng hoặc một Agent tổ tiên
   * đang sống chính xác. Phát-rồi-trả: tín hiệu huỷ được phát trước khi hàm trả, nhưng đích có thể còn
   * chạy tới khi nó quan sát tín hiệu. Công việc trong hộp thư chưa bị nhận, lần Kích hoạt và các hậu
   * duệ đã công bố được giữ nguyên; công việc đã nhận thì không xếp lại. Đích vắng mặt là no-op được
   * nhận, và thành phần không có quản lý (không sở hữu Kích hoạt sống) cũng vậy.
   * Nhận: `targetSessionId` — id phiên con bền vững cần ngắt; `authority` — địa chỉ cha người dùng hoặc
   *        đúng Agent tổ tiên đang sống.
   * Trả: không.
   * @throws {SubagentError} `UNAUTHORIZED` khi bên có thẩm quyền không sở hữu đích đang sống.
   */
  interrupt(targetSessionId: SessionId, authority: SubagentInterruptAuthority): void {
    this.manager?.interrupt(targetSessionId, authority);
  }

  /**
   * Đóng việc nhận subagent dưới các Agent cha đang sống chính xác, dừng ĐỒNG BỘ chỉ những Kích hoạt hậu
   * duệ thấy được của chúng, rồi chờ các lần hiện thực hoá đã nhận và nhả những rừng đó con-trước. Ranh
   * giới theo phạm vi kéo dài tới khi từng cha rời sổ đăng ký; cây cha không liên quan vẫn sống.
   * Nhận: `parents` — các Agent cha do Host sở hữu, đang bước vào teardown.
   * Trả: promise hoàn tất khi mọi kích hoạt hậu duệ được giữ đã nhả tay nắm thi hành.
   * @throws lỗi tổng hợp sau khi mọi nhánh lắng, nếu có nhánh hỏng.
   */
  async drainDescendants(parents: readonly Agent[]): Promise<void> {
    const manager = this.manager;
    // Quản lý vắng mặt thì không thể sở hữu con đã hiện thực hoá.
    if (manager === undefined) return;
    await manager.drainDescendants(parents);
  }

  /**
   * Nhả các con trực tiếp cư trú ĐƯỢC CHỌN của một cha đang sống chính xác. Con khác của cùng cha vẫn
   * được nhận và cư trú. Đích vắng mặt và thành phần không có quản lý là no-op được nhận.
   * Nhận: `parent` — đúng Agent cha trực tiếp đang sống, bên cho phép nhả; `childIds` — các id con trực
   *        tiếp bền vững cần nhả khi đang cư trú.
   * Trả: promise hoàn tất khi mọi kích hoạt được chọn đã nhả tay nắm thi hành.
   * @throws {SubagentError} `UNAUTHORIZED` khi đích cư trú thuộc cha khác hoặc danh tính cha đã cũ.
   */
  async drainChildren(parent: Agent, childIds: readonly SessionId[]): Promise<void> {
    const manager = this.manager;
    if (manager === undefined) return;
    await manager.drainChildren(parent, childIds);
  }

  /**
   * Đọc danh mục con trực tiếp bền vững của cha mà KHÔNG nạp hay chạy lại Agent. Service sở hữu và nhả
   * quan sát Session ưu tiên bản sống.
   * Nhận: `parentSessionId` — cha cần đọc danh mục; `signal` — tín hiệu huỷ chuyển tiếp cho truy vấn Session.
   * Trả: các con trong danh mục theo thứ tự event của cha.
   * @throws {@link SubagentError} khi truy vấn hoặc đơn vị chiếu danh mục không sẵn sàng.
   * @throws SessionQueryError khi không đọc được cha hoặc truy vấn bị huỷ.
   */
  listChildren(parentSessionId: SessionId, signal?: AbortSignal): Promise<SubagentCatalogEntry[]> {
    return listSubagentChildren(this.ctx, parentSessionId, signal);
  }

  /**
   * Liệt kê đệ quy các danh mục cha với tới được theo thứ tự trước-ổn định, giữ nguyên thứ tự event
   * của từng danh mục. Mỗi dòng mang cha danh mục và độ sâu; con bên ngoài là lá; con one-shot và con
   * chế độ không rõ vẫn là nút duyệt. Chế độ không rõ sinh chẩn đoán `unsupported`; danh mục con không
   * đọc được sinh chẩn đoán `corrupt`/`unavailable` và chỉ dừng nhánh đó. Hỏng khi đọc gốc, thiếu dịch
   * vụ/chiếu, hoặc bị huỷ thì từ chối TOÀN BỘ danh sách. Không Agent nào bị nạp hay chạy lại.
   * Nhận: `rootSessionId` — phiên bắt đầu khám phá hậu duệ; `signal` — tín hiệu huỷ được kiểm quanh
   *        từng lần đọc danh mục.
   * Trả: các con và chẩn đoán nhánh theo thứ tự trước của danh mục cha.
   * @throws {@link SubagentError} khi thiếu phụ thuộc liệt kê hoặc bên gọi huỷ.
   * @throws SessionQueryError khi không đọc được danh mục gốc.
   */
  listDescendants(rootSessionId: SessionId, signal?: AbortSignal): Promise<SubagentDescendantListEntry[]> {
    return listSubagentDescendants(this.ctx, rootSessionId, signal);
  }

  /**
   * Giao MỘT tin nhắn do trình duyệt soạn tới con tiếp nối được QUA đúng cha trực tiếp đang sống, giữ
   * danh tính yêu cầu do bên gọi đúc và vùng thời gian trình duyệt đã kiểm trên tin nhắn được nhận.
   * Thành công chỉ định tin nhắn mà hộp thư của con đã nhận; việc thi hành về sau độc lập với lời gọi này.
   * Phần ảnh được nhận và ghi bền qua kho đính kèm TRƯỚC khi giao, và model của con phải nhận đầu vào ảnh.
   * Chạy lại nguội khi hết sức chứa bị từ chối với `subagent/delivery-unavailable`.
   * Nhận: `request` — địa chỉ bền vững, cách giao, danh tính đã đúc, nội dung, và vùng trình duyệt tuỳ
   *        chọn; `signal` — tín hiệu huỷ của vật mang, sở hữu lời gọi tới khi hộp thư nhận.
   * Trả: danh tính hộp thư của tin nhắn đã được nhận.
   * @throws {RemoteError} `gateway/bad-request`, `subagent/attachment-invalid`,
   *   `subagent/invalid-time-zone`, `subagent/parent-unavailable`, `subagent/not-resumable`,
   *   `subagent/unauthorized`, `subagent/delivery-unavailable`, `gateway/cancelled`, hoặc
   *   `gateway/internal`.
   */
  @Remote("prompt")
  async prompt(request: SubagentPromptRequest, signal: AbortSignal): Promise<SubagentPromptReceipt> {
    const { parentSessionId, childSessionId, clientTimeZone, delivery } = request;
    validateControlRequest("subagent.prompt", request);
    const canonicalTimeZone = clientTimeZone === undefined
      ? undefined
      : canonicalClientTimeZone(clientTimeZone);
    if (clientTimeZone !== undefined && canonicalTimeZone === undefined) {
      throw new RemoteError("subagent/invalid-time-zone", "clientTimeZone must be UTC or a valid IANA Area/Location name", { value: clientTimeZone });
    }
    const parent = (this.ctx.get("agents") as AgentsSeam | undefined)?.get(parentSessionId);
    if (parent === undefined) {
      throw new RemoteError("subagent/parent-unavailable", `parent session "${parentSessionId}" is not live`, { parentSessionId });
    }
    const principal = principalOf(this.ctx.invocation);
    const source = {
      kind: "user" as const,
      rpcId: request.requestId,
      ...(canonicalTimeZone === undefined ? {} : { clientTimeZone: canonicalTimeZone }),
      ...(principal === undefined ? {} : { principal }),
    };
    try {
      // Nhận trước khi giao: phần ảnh trở thành tham chiếu bền vững ở đây, nên hộp thư của con chỉ bao
      // giờ nhận đính kèm do Host đã ghi bền.
      let content: ContentBlock[];
      if (request.content.every((part: PromptContentPart): part is TextPromptContentPart => part.type === "text")) {
        content = request.content.map((part: TextPromptContentPart) => ({ type: "text", text: part.text }));
      }
      else {
        const attachments = this.ctx.get("attachments") as AttachmentStoreSeam | undefined;
        if (attachments === undefined) throw new Error("subagent image prompt requires an attachment store");
        content = await attachments.admitPromptContent(request.content);
      }
      return {
        messageId: await this[deliverSubagentPrompt](parent, childSessionId, content, source, signal, delivery),
      };
    }
    catch (error) {
      return rejectPrompt(error, childSessionId, signal);
    }
  }

  /**
   * Bề mặt Remote của {@link interrupt} dưới MỘT địa chỉ cha bền vững. Không chạy danh mục, lịch sử,
   * bản lưu hay tra Agent cha: chỉ nguyên hàm lõi có thẩm quyền với Kích hoạt sống, nhờ đó con đang sống
   * vẫn ngắt được khi Agent cha của nó ngoại tuyến. Đích vắng mặt, rảnh, hay đã xong là no-op được nhận.
   * Nhận: `childSessionId` — id phiên con bền vững cần ngắt; `parentSessionId` — cha trực tiếp bền vững
   *        mà thẩm quyền được nhận; `mode` — bộ phân biệt địa chỉ tiếp nối được (bắt buộc).
   * Trả: xác nhận rằng tín hiệu huỷ ĐÃ được nhận, không phải rằng đích đã lặng.
   * @throws {RemoteError} `gateway/bad-request` khi id rỗng, `subagent/unauthorized` khi địa chỉ không
   *   sở hữu đích đang sống, ngược lại `gateway/internal`.
   */
  @Remote("interruptByParent")
  interruptByParent(childSessionId: SessionId, parentSessionId: SessionId, mode: "continuable"): SubagentInterruptReceipt {
    validateControlRequest("subagent.interrupt", { childSessionId, parentSessionId, mode });
    try {
      this.interrupt(childSessionId, { kind: "user", parentSessionId });
    }
    catch (error) {
      if (error instanceof SubagentError && error.code === "UNAUTHORIZED") {
        throw new RemoteError("subagent/unauthorized", "subagent does not belong to this parent", { childSessionId }, { cause: error });
      }
      throw new RemoteError("gateway/internal", "subagent interrupt failed", {}, { cause: error });
    }
    return { accepted: true };
  }

  /**
   * Đăng ký một provider dưới tên của nó. Đăng ký thuộc phạm vi hiệu ứng và an toàn với HMR; gỡ provider
   * chặn các lần khởi chạy MỚI nhưng không thu hồi những lần chạy đã trả cho bên giữ. Provider thiếu cả
   * hai phương thức thi hành bị từ chối với `UNSUPPORTED_CAPABILITY` TRƯỚC khi đăng ký.
   * Nhận: `provider` — hiện thực provider đáng tin.
   * Trả: đúng disposer hiệu ứng của Cordis.
   */
  registerProvider(provider: SubagentProvider): () => void {
    const name = provider.name;
    if (provider.start === undefined && provider.prepareContinuable === undefined) {
      throw new SubagentError(`subagent provider "${name}" must implement start or prepareContinuable`, "UNSUPPORTED_CAPABILITY");
    }
    return this.ctx.effect(function* (this: SubagentRuntime) {
      if (this.providers.has(name)) {
        throw new SubagentError(`a subagent provider named "${name}" is already registered`, "DUPLICATE_PROVIDER");
      }
      this.providers.set(name, provider);
      yield () => {
        this.providers.delete(name);
        this.emitLifecycle("subagent/provider-removed", name);
      };
      // Một listener `added` ném lỗi sẽ tháo cuộn phần rollback đã yield, đúng ngữ nghĩa đăng ký
      // fail-loud của kho mã.
      (this.ctx as unknown as SubagentEventBus).emit("subagent/provider-added", provider);
    }.bind(this), "subagents.registerProvider()");
  }

  /**
   * Tra một provider theo tên.
   * Nhận: `name` — tên provider.
   * Trả: provider, hoặc undefined khi vắng mặt.
   */
  getProvider(name: string): SubagentProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Liệt kê tên các provider đã đăng ký theo thứ tự chèn.
   * Nhận: không.
   * Trả: mảng tên đã đăng ký.
   */
  list(): string[] {
    return [...this.providers.keys()];
  }

  /**
   * Phân giải đóng góp tạo-dựng tiếp nối TÁCH RỜI của một provider. Sự CÓ MẶT của phương thức trên
   * provider CHÍNH LÀ năng lực, nên provider không có nó bị từ chối trước khi quản lý dành tài nguyên con.
   * Nhận: `name` — tên provider; `request` — yêu cầu tạo dựng đã dành sẵn danh tính con.
   * Trả: đặc tả tạo dựng tách rời của provider đó.
   */
  private async prepareContinuable(name: string, request: ContinuableCreateRequest): Promise<ContinuableCreateSpec> {
    const provider = this.expectProvider(name);
    // Tiền kiện: quản lý chỉ gọi đường này khi provider CÓ `prepareContinuable` (năng lực = sự có mặt).
    return provider.prepareContinuable!(request);
  }

  /**
   * Tra một provider để điều phối, hoặc fail loud.
   * Nhận: `name` — tên provider.
   * Trả: provider đã đăng ký.
   * @throws {SubagentError} `NO_PROVIDER` khi tên chưa đăng ký.
   */
  private expectProvider(name: string): SubagentProvider {
    const provider = this.providers.get(name);
    if (provider === undefined) {
      throw new SubagentError(`no subagent provider registered for "${name}"`, "NO_PROVIDER");
    }
    return provider;
  }

  /**
   * Phân giải quản lý subagent, hoặc fail loud.
   * Nhận: không.
   * Trả: quản lý tiếp nối đang sống.
   * @throws {SubagentError} `CONTINUATION_UNAVAILABLE` khi seam `agents` chưa từng sẵn sàng.
   */
  private requireManager(): SubagentManager {
    if (this.manager === undefined) {
      throw new SubagentError("continuable subagents require the agents service", "CONTINUATION_UNAVAILABLE");
    }
    return this.manager;
  }

  /**
   * Dựng observer vòng đời cho epoch cư trú của MỘT lần kích hoạt tiếp nối được, để quản lý công bố các
   * cạnh của nó mà không sở hữu việc phát event.
   * Nhận: `provider` — tên provider ghi trong descriptor bền vững; `childId` — id phiên con bền vững;
   *        `parent` — đúng Agent cha trực tiếp khoá dispatch theo phạm vi.
   * Trả: observer vòng đời của epoch này.
   */
  private observeActivation(provider: string, childId: SessionId, parent: Agent): ActivationObserver {
    return createActivationObserver(this.emitLifecycle, provider, childId, parent);
  }

  /**
   * Từ chối năng lực ĐẦU TIÊN mà provider còn thiếu.
   * Nhận: `provider` — provider đã đăng ký; `request` — yêu cầu khởi chạy có kèm tín hiệu huỷ.
   * Trả: không khi mọi năng lực được yêu cầu đều có; ném lỗi ở năng lực thiếu đầu tiên.
   * @throws {SubagentError} `UNSUPPORTED_CAPABILITY` kèm nguyên văn tên năng lực thiếu.
   */
  private assertCapabilities(provider: SubagentProvider, request: SubagentStartRequest): void {
    if (request.agentPreset !== undefined && (!provider.capabilities.agentPreset || provider.inheritsParentContext)) {
      throw new SubagentError(`subagent provider "${provider.name}" does not support independent agent preset selection`, "UNSUPPORTED_CAPABILITY");
    }
    const needs = [
      { when: request.agentOptions !== undefined, cap: "agentOptions" },
      { when: request.outputSchema !== undefined, cap: "outputSchema" },
      { when: request.maxDepth !== undefined, cap: "depthLimit" },
    ] as const;
    for (const { when, cap } of needs) {
      if (when && !provider.capabilities[cap]) {
        throw new SubagentError(`subagent provider "${provider.name}" does not support the "${cap}" capability`, "UNSUPPORTED_CAPABILITY");
      }
    }
  }
}

export default SubagentRuntime;

