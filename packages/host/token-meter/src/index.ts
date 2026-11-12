/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Dịch vụ token-meter 1:1 vùng `lib/types/index.js` dòng 667–876 của `@deepseek-ai/dsh-token-meter`:
 *      một dịch vụ DUY NHẤT vừa nhận biết replay vừa đo áp lực yêu cầu và bề mặt phiên; đăng ký 3 chiếu
 *      (`tokenUsage` · `contextPressure` · `contextBreakdown`) trên seam `sessionProjections` và giữ
 *      trạng thái replay RIÊNG cho từng phiên trong WeakMap.
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import { assembleAssistantStream } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, ImageBlock, LlmImageRequestPricing, Message, TokenUsage } from "@deepseek-ai/dsh-llm";
import { SessionLogOffset, SessionSeq, canonicalHeader, isSurfaceEvent } from "@galaxy-blackhole/gbh-session";
import type { EpochHeader, Session, SessionEvent } from "@galaxy-blackhole/gbh-session";
// Nap augmentation cua plugin image-offload de SessionEventMap co "image/offload" (chi kieu).
// 08/11/2026 — augmentation của bản gốc khai trên module KERNEL ("@deepseek-ai/dsh-session/types") nên KHÔNG
//   áp cho kiểu GBH. Ta khai tương đương trên module của ta trong tệp dưới đây (cùng hình dạng sự kiện).
import "./session-event-augmentation.ts";
import z from "@deepseek-ai/schemastery";

import { contextBreakdownProjectionDefinition } from "./breakdown-projection.ts";
import { estimateContent, estimateMessage, estimateToolsTokens } from "./estimate.ts";
import { optionalHeaderEquals, priceSurface, usageTokens, validateConfigKeys } from "./route-pricing.ts";
import { analyzeNode, commitSurfaceTokens, planSurfaceTokens } from "./surface-fold.ts";
import type { MeterSurfaceNode } from "./surface-fold.ts";
import { contextPressureProjectionDefinition, tokenUsageProjectionDefinition } from "./usage-projection.ts";
import type { TokenMeterConfig, TokenSurfaceNode } from "./types.ts";

/** Seam `sessionProjections` khai theo CẤU TRÚC (bài học session-stats: không dùng thẳng kiểu của gói kia). */
interface SessionProjectionsSeam {
  /** Đăng ký một định nghĩa chiếu; trả hàm huỷ. */
  register(definition: unknown): () => void;
}

/** Phần API của dịch vụ LLM mà token-meter dùng (khai cấu trúc để không phụ thuộc kiểu nội bộ). */
interface LlmPricingSeam {
  /** Giá ảnh theo tuyến provider/model, nếu tuyến khai. */
  imageRequestPricing(provider: string, model: string): LlmImageRequestPricing | undefined;
  /** Văn bản yêu cầu cho một tham chiếu tệp. */
  fileRequestText(ref: Extract<ContentBlock, { type: "file" }>["attachment"]): string;
}

/** Trạng thái replay của MỘT phiên. */
interface MeterState {
  /** Số sự kiện đã gộp. */
  consumedEvents: SessionLogOffset;
  /** Header yêu cầu hiệu lực gần nhất. */
  header: EpochHeader | undefined;
  /** Bề mặt hiện tại theo thứ tự model nhìn thấy. */
  surface: MeterSurfaceNode[];
  /** Bước đang mở, nếu có. */
  stepStart: { turn: number; step: number } | undefined;
  /** Mốc neo của lần gọi thành công gần nhất. */
  anchor:
    | {
        header: EpochHeader | undefined;
        nodes: MeterSurfaceNode[];
        assistantTokens: number;
        usage: TokenUsage | undefined;
      }
    | undefined;
}

/**
 * Dịch vụ DUY NHẤT của token-meter: một bộ ước lượng toàn dịch vụ + các fold RIÊNG cho từng phiên.
 */
export class TokenMeter extends Service {
  /** Không có cài đặt nào được hỗ trợ — đúng bản gốc. */
  static Config = z.object({});

  /** Chỉ phụ thuộc seam chiếu phiên. */
  static inject = ["sessionProjections"];

  /** Trạng thái replay theo phiên (không giữ tham chiếu mạnh tới phiên đã chết). */
  private readonly states = new WeakMap<Session, MeterState>();

  /**
   * Đăng ký dịch vụ `tokenMeter`, 3 chiếu phiên và móc gộp sự kiện.
   * Nhận: context cordis và cấu hình (phải RỖNG, khác ⇒ ném).
   * Trả: không (đây là constructor).
   */
  constructor(ctx: Context, config: TokenMeterConfig = {}) {
    super(ctx, "tokenMeter");
    validateConfigKeys(config);
    const projections = (ctx as unknown as { sessionProjections: SessionProjectionsSeam }).sessionProjections;
    projections.register(tokenUsageProjectionDefinition);
    projections.register(contextPressureProjectionDefinition);
    projections.register(contextBreakdownProjectionDefinition);
    // 08/11/2026 — `ctx.on("session/event", …)` của kernel khai handler với `this: Scoped<Session>` và 2 tham số;
    //   ta chỉ cần 1 tham số ⇒ ép KIỂU HÀM ĐĂNG KÝ tại đúng một chỗ (biên), hành vi không đổi.
    const dangKy = ctx.on as unknown as (khoa: string, handler: (session: Session) => void) => void;
    dangKy("session/event", (session: Session): void => {
      if (this.states.has(session)) this.sync(session);
    });
  }

  /**
   * Đo áp lực yêu cầu hiện tại và bề mặt qua đuôi bền của phiên.
   * Nhận: phiên cần replay; header yêu cầu hiệu lực TUỲ CHỌN thay header đã ghi gần nhất.
   * Trả: một bản đo TÁCH RỜI, bất biến sâu (áp lực + bề mặt).
   */
  measure(session: Session, requestHeader?: EpochHeader): {
    logRevision: SessionLogOffset;
    surfaceDeltaTokens: number;
    baseline: { kind: "usage" | "estimated" | "none"; tokens: number; usage?: TokenUsage };
    totalTokens: number;
    surfaceTokens: number;
    nodes: readonly TokenSurfaceNode[];
  } {
    const state = this.sync(session);
    const header = requestHeader === undefined ? state.header : canonicalHeader(requestHeader);
    const pricing = this.routeImagePricing(header);
    const fileText = this.fileRequestProjection();
    const surface = priceSurface(state.surface, pricing, fileText);
    const anchor = state.anchor;
    let baseline: { kind: "usage" | "estimated" | "none"; tokens: number; usage?: TokenUsage };
    let surfaceDeltaTokens: number;
    if (anchor !== undefined && optionalHeaderEquals(anchor.header, header)) {
      const anchorSurfaceTokens = priceSurface(anchor.nodes, pricing, fileText).surfaceTokens + anchor.assistantTokens;
      const estimatedAnchorTokens = estimateToolsTokens(header) + anchorSurfaceTokens;
      const usage = anchor.usage;
      baseline =
        usage !== undefined && usageTokens(usage) >= estimatedAnchorTokens
          ? { kind: "usage", tokens: usageTokens(usage), usage }
          : { kind: "estimated", tokens: estimatedAnchorTokens };
      surfaceDeltaTokens = surface.surfaceTokens - anchorSurfaceTokens;
    } else if (header === undefined && surface.surfaceTokens === 0) {
      baseline = { kind: "none", tokens: 0 };
      surfaceDeltaTokens = 0;
    } else {
      baseline = { kind: "estimated", tokens: estimateToolsTokens(header) + surface.surfaceTokens };
      surfaceDeltaTokens = 0;
    }
    return {
      logRevision: state.consumedEvents,
      baseline,
      surfaceDeltaTokens,
      totalTokens: Math.max(0, baseline.tokens + surfaceDeltaTokens),
      surfaceTokens: surface.surfaceTokens,
      nodes: surface.nodes,
    };
  }

  /**
   * Ước lượng MỘT tin nhắn model nhìn thấy theo heuristic cố định của dịch vụ.
   * Nhận: tin nhắn cần định giá (không sửa).
   * Trả: số token nội dung + đóng khung vai.
   */
  estimateMessage(message: Message): number {
    return estimateMessage(message);
  }

  /**
   * Phân giải giá ảnh của tuyến model, khi dịch vụ LLM và tuyến khai.
   * Nhận: header yêu cầu hiệu lực (hoặc undefined).
   * Trả: bộ giá ảnh của tuyến, hoặc undefined.
   */
  private routeImagePricing(header: EpochHeader | undefined): LlmImageRequestPricing | undefined {
    const config = header?.config;
    if (config === undefined) return undefined;
    const llm = (this.ctx as unknown as { get(name: string): unknown }).get("llm") as LlmPricingSeam | undefined;
    return llm?.imageRequestPricing(config.provider, config.model);
  }

  /**
   * Hàm phóng chiếu yêu cầu cho tệp, khi có dịch vụ LLM được mount.
   * Nhận: không.
   * Trả: hàm chuyển tham chiếu tệp thành văn bản, hoặc undefined.
   */
  private fileRequestProjection(): ((ref: Extract<ContentBlock, { type: "file" }>["attachment"]) => string) | undefined {
    const llm = (this.ctx as unknown as { get(name: string): unknown }).get("llm") as LlmPricingSeam | undefined;
    if (llm === undefined) return undefined;
    return (ref) => llm.fileRequestText(ref);
  }

  /**
   * Gộp fold của một phiên tới đuôi bền hiện tại.
   * Nhận: phiên cần gộp.
   * Trả: trạng thái replay của phiên (mới tạo nếu chưa có).
   */
  private sync(session: Session): MeterState {
    let state = this.states.get(session);
    if (state === undefined) {
      state = { consumedEvents: SessionLogOffset(0), header: undefined, surface: [], stepStart: undefined, anchor: undefined };
      this.states.set(session, state);
    }
    while (state.consumedEvents < session.seq) {
      const event = session.eventAt(SessionSeq(state.consumedEvents));
      if (event === undefined) break;
      this.foldEvent(state, event);
      state.consumedEvents = SessionLogOffset(state.consumedEvents + 1);
    }
    return state;
  }

  /**
   * Chạy MỌI bước có thể ném (kế hoạch bề mặt + kiểm mốc neo) TRƯỚC khi sửa trạng thái replay, để một
   * sự kiện hỏng vẫn còn nguyên chưa đọc ở mọi lần thử thay vì được áp một nửa.
   * Nhận: trạng thái replay của phiên và sự kiện kế tiếp.
   * Trả: không (sửa trạng thái tại chỗ).
   */
  private foldEvent(state: MeterState, event: SessionEvent): void {
    let nextHeader = state.header;
    let nextStepStart = state.stepStart;
    let nextAnchor = state.anchor;
    switch (event.type) {
      case "image/offload": {
        const offloaded = new Map(event.data.targets.map((target) => [target.seq, new Set(target.imageIndexes)]));
        state.surface = state.surface.map((node) => {
          const indexes = offloaded.get(node.seq);
          if (indexes === undefined) return node;
          return {
            ...node,
            images: node.images.map((image, index) => (indexes.has(index) ? { ...image, offloaded: true } : image)),
          };
        });
        break;
      }
      case "request/header":
        nextHeader = canonicalHeader(event.data.header);
        break;
      case "step/start":
        if (state.stepStart !== undefined) {
          throw new Error(
            `token meter: step/start at seq ${event.seq} arrived before turn ${state.stepStart.turn}/step ${state.stepStart.step} ended`,
          );
        }
        nextStepStart = { turn: event.data.turn, step: event.data.step };
        break;
      case "step/end":
        if (state.stepStart === undefined || state.stepStart.turn !== event.data.turn || state.stepStart.step !== event.data.step) {
          throw new Error(`token meter: step/end at seq ${event.seq} has no matching step/start event`);
        }
        nextStepStart = undefined;
        break;
      default:
        break;
    }
    const plan = isSurfaceEvent(event) ? planSurfaceTokens(state.surface, event) : undefined;
    if (event.type === "assistant/message") {
      const stepStart = state.stepStart;
      if (stepStart === undefined || stepStart.turn !== event.data.turn || stepStart.step !== event.data.step) {
        throw new Error(`token meter: assistant/message at seq ${event.seq} has no matching step/start event`);
      }
      const eventTokens = plan?.tokens ?? 0;
      if (event.data.usage !== undefined && nextHeader !== undefined) {
        nextAnchor = {
          header: nextHeader,
          nodes: [...state.surface],
          assistantTokens: this.estimateProviderAssistant(event),
          usage: event.data.usage,
        };
      } else {
        nextAnchor = { header: nextHeader, nodes: [...state.surface], assistantTokens: eventTokens, usage: undefined };
      }
    }
    state.header = nextHeader;
    state.stepStart = nextStepStart;
    if (plan !== undefined) commitSurfaceTokens(state.surface, plan);
    state.anchor = nextAnchor;
  }

  /**
   * Lắp lại đầu ra nhà cung cấp từ đúng luồng nhúng trong tin nhắn.
   * Nhận: sự kiện `assistant/message`.
   * Trả: số token nội dung nhà cung cấp đã ước lượng.
   */
  private estimateProviderAssistant(event: Extract<SessionEvent, { type: "assistant/message" }>): number {
    const providerContent = assembleAssistantStream(event.data.stream).blocks() as readonly ContentBlock[];
    return providerContent.length === 0 ? 0 : estimateContent(providerContent) + 4;
  }
}

export default TokenMeter;