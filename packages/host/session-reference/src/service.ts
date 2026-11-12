/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng SERVICE của @deepseek-ai/dsh-session-reference — port 1:1 `lib/types/index.js`
 *      (stock `lib/index.js` dòng 349–744): class `SessionReferenceResolver` (khoá cordis
 *      `sessionReferenceResolver`, `static inject = ['sessionQuery']`, một method `@Remote("candidates")`)
 *      chuẩn bị ngữ cảnh tham chiếu chéo phiên — đọc chính xác, chiếu, ngân sách byte, ngữ cảnh bền —
 *      kèm helper normalizeReferences · renderPrompt · titleOf · candidateRank · assertNotCancelled ·
 *      settleWithCancellation · cancelled. BỎ 38 dòng helper emit `__runInitializers`/`__esDecorate`
 *      (stock 356–393) vì decorator TS biên dịch native.
 */

import { LlmError, createUserMessage, freezeMessage } from "@deepseek-ai/dsh-llm";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";

import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@galaxy-blackhole/gbh-agent";
import type { ContentBlock, LlmResolvedModelInfo, UserMessage } from "@deepseek-ai/dsh-llm";
import type { OptionalSessionSeq, Session, SessionHeader, SessionId } from "@galaxy-blackhole/gbh-session";
import type { SessionRecord, SessionSurfaceSnapshot } from "@deepseek-ai/dsh-session-query";
import type { SpillStore } from "@deepseek-ai/dsh-spill";

import { DEFAULT_MAX_REFERENCE_BYTES, SessionReferenceError } from "./config.ts";
import type { Config } from "./config.ts";
import { retainReferencedSession } from "./projection.ts";
import type { ReferencedSessionData, ReferenceRetentionStats } from "./projection.ts";
import { stringifyTagSafeJson } from "./serialization.ts";
import { REFERENCE_WARNING, prepareReferenceOmission } from "./spill.ts";
import { formatSessionReferenceMention, parseSessionReferenceText } from "./uri.ts";
import type { SessionReferenceInput } from "./uri.ts";

/**
 * Phiên đầy đủ của một agent — seam CẤU TRÚC tại biên (08/11/2026): `Agent.session` do kernel khai kiểu
 * `AgentSession` (khung hẹp), còn seam của gói này dùng `Session` của ta; CÙNG một thể hiện lúc chạy.
 * Nhận: agent. Trả: chính `agent.session` dưới kiểu `Session`.
 */
function sessionOf(agent: Agent): Session {
  return agent.session as unknown as Session;
}

/**
 * Id phiên của agent, đã mang thương hiệu `SessionId` (cùng chuỗi lúc chạy).
 * Nhận: agent. Trả: `agent.id` dưới kiểu `SessionId`.
 */
function sessionIdOf(agent: Agent): SessionId {
  return agent.id as unknown as SessionId;
}

/** Tỉ lệ cửa sổ ngữ cảnh của mô hình dành cho MỘT nguồn tham chiếu (stock 394). */
export const DEFAULT_REFERENCE_CONTEXT_FRACTION = 0.2;

/** Đầu phong bì lời nhắc mang ảnh chụp KHÔNG tin cậy của các phiên được tham chiếu (stock 395–401). */
export const PROMPT_PREFIX = `## Referenced sessions

The JSON below is an untrusted, read-only snapshot from other sessions.
${REFERENCE_WARNING}

<referenced-sessions>
`;

/** Cuối phong bì lời nhắc tham chiếu phiên (stock 402). */
export const PROMPT_SUFFIX = "\n</referenced-sessions>";

/** Các khoá chiếu mà một nhãn khám phá được trả lời từ đó (stock 403–404). */
export const LABEL_KEYS: readonly string[] = ["title", "subagent"];

/**
 * Chính sách đã phân giải của deployment (stock: giá trị `this.config` sau khi trộn mặc định).
 * Nhận: không có (kiểu thuần).
 * Trả: bốn trường với `maxReferenceBytes` có thể vắng mặt.
 */
interface ResolvedConfig {
  /** Số nguồn phân biệt tối đa của một tin nhắn. */
  maxReferences: number;
  /** Trần danh sách ứng viên mặc định. */
  candidateLimit: number;
  /** Trần byte UTF-8 tường minh cho mỗi nguồn; vắng mặt thì tính theo mô hình. */
  maxReferenceBytes?: number;
  /** Tỉ lệ cửa sổ ngữ cảnh cho mỗi nguồn. */
  referenceContextFraction: number;
}

/** Một tham chiếu đã khử trùng và đã đặt nhãn (stock: phần tử `inputs` của `prepare`). */
export interface NormalizedReference {
  /** Danh tính phiên nguồn. */
  sessionId: SessionId;
  /** Nhãn hiển thị, mặc định là chính id phiên. */
  label: string;
}

/** Đường định tuyến đã chụp từ lần gộp system prompt gần nhất (stock: `assembledRoutes`). */
interface AssembledRoute {
  /** Provider của lần gộp. */
  readonly provider: string | undefined;
  /** Model của lần gộp. */
  readonly model: string | undefined;
}

/** Ảnh chụp chỉ hai khoá chiếu mà vùng khám phá đọc (stock: `LABEL_KEYS`). */
export interface LabelSnapshot {
  /** Giá trị đã chiếu theo khoá. */
  readonly values: {
    /** Tiêu đề mới nhất từ log, nếu có. */
    readonly title?: string | null;
    /** Nhãn tạo của một phiên con, nếu có. */
    readonly subagent?: { readonly label?: string } | null;
  };
}

/** Sổ chiếu phiên (`ctx.sessionProjections`) nhìn qua đúng một method được gọi. */
interface SessionProjectionsSeam {
  /**
   * Một lát cắt nhất quán các đơn vị chiếu đã chọn của MỘT phiên.
   * Nhận: `session` — phiên cần đọc; `keys` — các khoá hiển thị cho client.
   * Trả: ảnh chụp có `values` (rỗng khi chưa đơn vị nào đăng ký).
   */
  snapshot(session: Session, keys?: readonly string[]): LabelSnapshot;
}

/** Bộ nhớ đệm chiếu bền (`ctx.sessionProjectionCache`) nhìn qua đúng một method được gọi. */
interface SessionProjectionCacheSeam {
  /**
   * Đọc ô chiếu ĐÃ vật chất hoá của một phiên lạnh, không đọc log.
   * Nhận: `meta` — header của phiên đã liệt kê; `keys` — các khoá cần.
   * Trả: ảnh chụp đã xem, hoặc `undefined` khi không có dòng dùng được.
   */
  cachedSnapshot(meta: SessionHeader, keys?: readonly string[]): LabelSnapshot | undefined;
}

/** Sổ phiên đang sống (`ctx.sessions`) nhìn qua đúng một method được gọi. */
interface SessionsSeam {
  /** Liệt kê các phiên đang gắn trong tiến trình này. */
  list(): readonly Session[];
}

/** Runtime LLM (`ctx.llm`) nhìn qua đúng một method được gọi. */
interface LlmSeam {
  /**
   * Tra thông tin CHÍNH XÁC của một đường định tuyến đã đăng ký.
   * Nhận: `provider` — tuyến; `model` — id mô hình; `signal` — huỷ tuỳ chọn.
   * Trả: thông tin mô hình kèm `context` khi adapter biết cửa sổ ngữ cảnh.
   */
  resolveModelInfo(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
}

/** Bộ truy vấn phiên (`ctx.sessionQuery`) nhìn qua đúng hai method được gọi. */
interface SessionQuerySeam {
  /**
   * Liệt kê mọi phiên quan sát được, ưu tiên phiên đang sống.
   * Nhận: `signal` — huỷ tuỳ chọn.
   * Trả: bản ghi phiên kèm header đã sao.
   */
  listSessions(signal?: AbortSignal): Promise<SessionRecord[]>;
  /**
   * Đọc CHÍNH XÁC bề mặt hiện tại của một phiên.
   * Nhận: `sessionId` — phiên nguồn.
   * Trả: ảnh chụp bề mặt kèm header và seq đã chụp tới.
   */
  readSurface(sessionId: SessionId): Promise<SessionSurfaceSnapshot>;
}

/** Phần lời nhắc hệ thống mà service chỉ cần đọc `variables` (stock: tham số `_assembly`). */
interface PromptAssemblySeam {
  /** Biến đã gộp của lần dựng lời nhắc. */
  readonly variables: { readonly provider?: string; readonly model?: string };
}

/** Context của một lần gộp lời nhắc, chỉ cần `agent`. */
interface AssembleContextSeam {
  /** Agent của lần gộp; vắng mặt ở lượt chẩn đoán. */
  readonly agent?: Agent;
}

/** Quyết định của bước kế tiếp (stock: `PreStepDecision` của `dsh-agent`). */
type PreStepDecisionSeam =
  | { readonly kind: "reject" }
  | { readonly kind: "enter"; readonly messages: UserMessage[]; readonly startsRequestSeries?: true };

/**
 * Bề mặt context service gọi tới, khai theo CẤU TRÚC như các row khác của repo: bản gốc gọi thẳng
 * `ctx.sessionQuery`, `ctx.get(...)` và `ctx.on(...)`; ở đây chỉ khai đúng những thành viên đó.
 */
interface SessionReferenceContext {
  /** Bộ truy vấn phiên (seam của `static inject`). */
  readonly sessionQuery: SessionQuerySeam;
  /** Sổ chiếu phiên, khi row đó được ghép. */
  get(name: "sessionProjections"): SessionProjectionsSeam | undefined;
  /** Sổ phiên sống, khi row đó được ghép. */
  get(name: "sessions"): SessionsSeam | undefined;
  /** Bộ nhớ đệm chiếu bền, khi row đó được ghép. */
  get(name: "sessionProjectionCache"): SessionProjectionCacheSeam | undefined;
  /** Kho spill, khi row đó được ghép. */
  get(name: "spillStore"): SpillStore | undefined;
  /** Runtime LLM, khi row đó được ghép. */
  get(name: "llm"): LlmSeam | undefined;
  /**
   * Nghe waterfall `system-prompt/assemble`, chèn TRƯỚC mọi listener khác.
   * Nhận: `assembly` — lời nhắc đang gộp; `context` — ngữ cảnh lượt gộp; `next` — tầng kế tiếp.
   * Trả: lời nhắc sau khi tầng kế tiếp xử lý.
   */
  on(
    event: "system-prompt/assemble",
    listener: (
      assembly: PromptAssemblySeam,
      context: AssembleContextSeam,
      next: () => Promise<PromptAssemblySeam>,
    ) => Promise<PromptAssemblySeam>,
    options: { prepend: true },
  ): () => void;
  /**
   * Nghe waterfall `agent/pre-step`, chèn TRƯỚC mọi listener khác.
   * Nhận: `payload` — agent và tín hiệu huỷ của lượt; `next` — tầng kế tiếp.
   * Trả: quyết định bước sau khi tầng kế tiếp xử lý.
   */
  on(
    event: "agent/pre-step",
    listener: (
      payload: { readonly agent: Agent; readonly signal: AbortSignal },
      next: () => Promise<PreStepDecisionSeam>,
    ) => Promise<PreStepDecisionSeam>,
    options: { prepend: true },
  ): () => void;
}

/**
 * Nguồn ngữ cảnh bền của tham chiếu phiên. KIỂU TẠM — stock: `lib/types/types.d.ts` 10–34.
 * Nhận: không có (kiểu thuần).
 * Trả: hình dạng `source` của tin nhắn `session-reference` hình thức `recall`.
 */
export interface SessionReferenceSource {
  /** Loại nguồn cố định. */
  kind: "session-reference";
  /** Hình thức ngữ cảnh: vật chất lấy từ log phiên khác. */
  form: "recall";
  /** Phiên bản phong bì nguồn. */
  version: 1;
  /** Một mục cho mỗi nguồn đã dựng, theo thứ tự mention. */
  references: {
    /** Danh tính phiên nguồn. */
    sessionId: string;
    /** Nhãn hiển thị của nguồn. */
    label: string;
    /** Thế hệ định dạng của phiên nguồn; vắng mặt nghĩa là phiên bản 0. */
    capturedFormatVersion?: number;
    /** Seq log thô cao nhất đã chụp. */
    capturedThroughSeq: OptionalSessionSeq;
    /** Phiên nguồn đã bị nén trước khi chụp. */
    compacted: boolean;
    /** Số tin nhắn gốc. */
    originalMessages: number;
    /** Số tin nhắn còn giữ. */
    retainedMessages: number;
    /** Số tin nhắn bị bỏ. */
    omittedMessages: number;
    /** Số byte UTF-8 bị bỏ. */
    omittedBytes: number;
    /** Preview đã bị cắt hay chưa. */
    truncated: boolean;
    /** Vị trí tham chiếu trong tin nhắn. */
    inputIndex: number;
  }[];
}

declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    /** Ảnh chụp tham chiếu phiên do service này dựng (stock: khai cùng tên trong `types.d.ts`). */
    "session-reference": SessionReferenceSource;
  }
}

/** Một ứng viên khám phá do host nhìn thấy. KIỂU TẠM — stock: `lib/types/types.d.ts` 44–62. */
export interface SessionReferenceCandidate {
  /** Danh tính phiên nguồn. */
  sessionId: SessionId;
  /** Tiêu đề mới nhất từ log, mặc định là id phiên. */
  label: string;
  /** Nhãn hiển thị và nhãn mention chuẩn, ưu tiên nhãn tạo của phiên con. */
  displayTitle?: string;
  /** Thư mục làm việc của phiên nguồn, khi có ghi nhận. */
  cwd?: string;
  /** `cwd` có ghi nhận và bằng `cwd` của agent đang hỏi hay không. */
  sameWorkspace: boolean;
  /** Thời điểm tạo phiên nguồn, mili giây Unix. */
  createdAt: number;
}

/** Một ứng viên khám phá kèm mention chuẩn. KIỂU TẠM — stock: `lib/types/types.d.ts` 63–68. */
export interface SessionReferenceMentionCandidate extends SessionReferenceCandidate {
  /** Mention `@[label](dsh-session:…)` chèn được vào bản nháp lời nhắc. */
  mention: string;
}

/** Nội dung tin nhắn trực tiếp kèm ngữ cảnh tham chiếu tuỳ chọn. KIỂU TẠM — stock: `lib/types/types.d.ts` 69–75. */
export interface PreparedReferencedMessage {
  /** Nội dung đọc được sau khi đã gỡ token mention của host. */
  content: ContentBlock[];
  /** Ảnh chụp KHÔNG tin cậy đã gộp; vắng khi tin nhắn không tham chiếu phiên nào. */
  additionalContext?: UserMessage;
}

/** Nguồn đã dựng của MỘT tham chiếu, dùng nội bộ cho lời nhắc và ngữ cảnh bền. */
interface RenderedSource {
  /** Dữ liệu đã giữ cho lời nhắc. */
  data: ReferencedSessionData;
  /** Dữ liệu ĐẦY ĐỦ trước khi cắt, dùng khi spill bản thoại. */
  fullData: ReferencedSessionData;
  /** Sự thật giữ/cắt đi kèm ngữ cảnh bền. */
  stats: ReferenceRetentionStats;
  /** Thế hệ định dạng của phiên nguồn lúc chụp. */
  capturedFormatVersion: number;
}

/** Consumer đọc CHÍNH XÁC, dựng ngữ cảnh tin nhắn chéo phiên BẤT BIẾN (stock 406–689). */
export class SessionReferenceResolver extends TypertRemoteService {
  /** Seam phải sẵn sàng trước khi service thức dậy: bộ truy vấn phiên (nguyên văn bản gốc). */
  static inject = ["sessionQuery"];

  /** Schema Loader của deployment: bốn trường cấu hình, giữ nguyên ràng buộc của bản gốc. */
  static Config: z<Config> = z.object({
    maxReferences: z.number().step(1).min(1).max(3).default(3),
    candidateLimit: z.number().step(1).min(1).default(50),
    maxReferenceBytes: z.number().step(1).min(1),
    referenceContextFraction: z.number().min(0).max(1).default(DEFAULT_REFERENCE_CONTEXT_FRACTION),
  }) as unknown as z<Config>;

  /** Chính sách đã phân giải của deployment. */
  private readonly config: ResolvedConfig;

  /** Đường định tuyến của lần gộp gần nhất, theo từng agent. */
  private readonly assembledRoutes = new WeakMap<Agent, AssembledRoute>();

  /**
   * Đăng ký service `sessionReferenceResolver` và hai listener bản gốc.
   * Nhận: `ctx` — Context sở hữu plugin; `config` — cấu hình triển khai (có thể rỗng).
   * Trả: thể hiện service đã cài; ném {@link SessionReferenceError} khi cấu hình không hợp lệ.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, "sessionReferenceResolver");
    this.config = {
      maxReferences: config.maxReferences ?? 3,
      candidateLimit: config.candidateLimit ?? 50,
      maxReferenceBytes: config.maxReferenceBytes,
      referenceContextFraction: config.referenceContextFraction ?? DEFAULT_REFERENCE_CONTEXT_FRACTION,
    };
    for (const name of ["maxReferences", "candidateLimit", "maxReferenceBytes"] as const) {
      const value = this.config[name];
      if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0))
        throw new SessionReferenceError(`session-reference: ${name} must be a positive safe integer`, "SESSION_REFERENCE_INVALID_CONFIG");
    }
    if (this.config.maxReferences > 3)
      throw new SessionReferenceError("session-reference: maxReferences must not exceed 3", "SESSION_REFERENCE_INVALID_CONFIG");
    if (!(this.config.referenceContextFraction >= 0 && this.config.referenceContextFraction <= 1))
      throw new SessionReferenceError("session-reference: referenceContextFraction must be between zero and one", "SESSION_REFERENCE_INVALID_CONFIG");
    const seam = ctx as unknown as SessionReferenceContext;
    seam.on(
      "system-prompt/assemble",
      async (_assembly, context, next) => {
        const assembly = await next();
        if (context.agent !== undefined) {
          const { provider, model } = assembly.variables;
          this.assembledRoutes.set(context.agent, { provider, model });
        }
        return assembly;
      },
      { prepend: true },
    );
    seam.on(
      "agent/pre-step",
      async ({ agent, signal }, next) => {
        const decision = await next();
        if (decision.kind === "reject") return decision;
        return {
          ...decision,
          messages: await this.prepareDirectMessages(agent, decision.messages, signal),
        };
      },
      { prepend: true },
    );
  }

  /**
   * Context nhìn qua ĐÚNG bề mặt mà service gọi.
   * Nhận: không.
   * Trả: context đã ép kiểu tại đúng ranh giới này.
   */
  private get seam(): SessionReferenceContext {
    return this.ctx as unknown as SessionReferenceContext;
  }

  /**
   * Thay mention chuẩn trong tin nhắn NGƯỜI DÙNG trực tiếp và đặt ảnh chụp đã dựng NGAY SAU tin nhắn đã dẫn.
   * Nhận: `agent` — agent đang vào bước mô hình; `messages` — tin nhắn các listener sau đã nhận;
   *        `signal` — tín hiệu huỷ của lượt.
   * Trả: tin nhắn trực tiếp kèm ngữ cảnh tham chiếu phiên theo thứ tự dẫn.
   */
  private async prepareDirectMessages(agent: Agent, messages: readonly UserMessage[], signal: AbortSignal): Promise<UserMessage[]> {
    return (
      await Promise.all(
        messages.map(async (message) => {
          if (message.source.kind !== "user") return [message];
          const references: SessionReferenceInput[] = [];
          const content = message.content.map((block) => {
            if (block.type !== "text") return block;
            const parsed = parseSessionReferenceText(block.text);
            references.push(...parsed.references);
            return {
              type: "text",
              text: parsed.text,
            } satisfies ContentBlock;
          });
          if (references.length === 0) return [message];
          const resolved = await this.prepare(agent, content, references, signal);
          const direct = freezeMessage({
            ...message,
            content: resolved.content,
          });
          /* v8 ignore if -- a parsed canonical mention always leaves one normalized reference */
          if (resolved.additionalContext === undefined) throw new Error("session-reference preparation omitted context for a canonical mention");
          return [direct, resolved.additionalContext];
        }),
      )
    ).flat();
  }

  /**
   * Liệt kê ứng viên tham chiếu, xếp hạng theo độ gần thư mục làm việc.
   *
   * Lượt khám phá chạy ở nhịp phím gõ nên tiêu đề và nhãn phiên con CHỈ đến từ phép đọc chiếu; phiên
   * không có cả hai thì lấy id làm nhãn.
   * Nhận: `agent` — agent đích (tự nó bị loại, `cwd` của nó dẫn hạng); `query` — chuỗi con không
   *        phân biệt hoa thường của id/cwd/tiêu đề; `limit` — trần kết quả DƯƠNG tuỳ chọn;
   *        `signal` — ranh giới huỷ cho lúc host tháo autocomplete.
   * Trả: ứng viên kèm nhãn mention chuẩn và tiêu đề trình bày, theo thứ hạng.
   */
  async listCandidates(agent: Agent, query = "", limit = this.config.candidateLimit, signal?: AbortSignal): Promise<SessionReferenceCandidate[]> {
    if (!Number.isSafeInteger(limit) || limit <= 0)
      throw new SessionReferenceError("candidate limit must be a positive safe integer", "SESSION_REFERENCE_INVALID_REFERENCE");
    const needle = query.toLocaleLowerCase();
    const targetCwd = sessionOf(agent).header.cwd;
    assertNotCancelled(signal);
    const records = (await settleWithCancellation(this.seam.sessionQuery.listSessions(signal), signal))
      .filter((record) => record.header.id !== agent.id)
      .map((record, index) => ({ record, index }));
    return this.projectedLabels(records)
      .filter(({ record, label, displayTitle }) => {
        if (needle === "") return true;
        return (
          record.header.id.toLocaleLowerCase().includes(needle) ||
          record.header.cwd?.toLocaleLowerCase().includes(needle) === true ||
          label.toLocaleLowerCase().includes(needle) ||
          displayTitle.toLocaleLowerCase().includes(needle)
        );
      })
      .sort((a, b) => candidateRank(a.record.header.cwd, targetCwd) - candidateRank(b.record.header.cwd, targetCwd) || a.index - b.index)
      .slice(0, limit)
      .map(({ record, label, displayTitle }) => ({
        sessionId: record.header.id,
        label,
        displayTitle,
        ...(record.header.cwd === undefined ? {} : { cwd: record.header.cwd }),
        sameWorkspace: record.header.cwd !== undefined && record.header.cwd === targetCwd,
        createdAt: record.header.createdAt,
      }));
  }

  /**
   * Nhãn mention và tiêu đề trình bày mà phép chiếu của từng phiên đã liệt kê trả lời được, KHÔNG đọc log.
   *
   * Gắn hay không là do kho quyết định lúc đọc, không do lượt liệt kê: một phiên vừa gắn ở giữa sẽ bị
   * trả lời từ điểm kiểm mà log sống của nó đã vượt qua.
   *
   * Phiên ĐANG GẮN trả lời từ lát cắt registry sống (tiến theo từng event đã chốt) nên đổi tên hay tiêu
   * đề vừa sinh thấy ngay, và event đã nằm trong bộ nhớ nên phép gộp lười không tốn I/O. Phiên LẠNH trả
   * lời từ điểm kiểm bền mà bộ nhớ đệm chiếu ghi lúc nó nguội.
   *
   * Không thử gì khác: gộp tiêu đề từ một log tốn CẢ log, mà lượt gọi này nằm dưới từng phím gõ của
   * `@`. Phiên không phép chiếu nào trả lời được — phiên bền trước khi bộ nhớ đệm được ghép — lấy id
   * làm nhãn và không tìm được bằng tiêu đề cho tới khi mở một lần.
   *
   * Service được tra MỘT lần mỗi lượt và method ảnh chụp của bộ nhớ đệm được bind MỘT lần: tra service
   * theo từng phiên sẽ át cả lượt gọi.
   * Nhận: `items` — các phiên đã liệt kê, sống hay lạnh, kèm chỉ số gốc.
   * Trả: từng mục kèm nhãn mention theo tiêu đề và tiêu đề trình bày ưu tiên nhãn phiên con.
   */
  private projectedLabels(
    items: readonly { readonly record: SessionRecord; readonly index: number }[],
  ): { record: SessionRecord; index: number; label: string; displayTitle: string }[] {
    const projections = this.seam.get("sessionProjections");
    const sessions = this.seam.get("sessions");
    const attached = new Map<SessionId, Session>(
      sessions === undefined || projections === undefined
        ? undefined
        : sessions.list().map((session): [SessionId, Session] => [session.id, session]),
    );
    const cache = this.seam.get("sessionProjectionCache");
    const cachedSnapshot = cache?.cachedSnapshot.bind(cache);
    return items.map((item) => {
      const session = attached.get(item.record.header.id);
      const snapshot = session !== undefined && projections !== undefined ? projections.snapshot(session, LABEL_KEYS) : cachedSnapshot?.(item.record.header, LABEL_KEYS);
      const label = titleOf(snapshot) ?? item.record.header.id;
      const subagent = snapshot?.values.subagent;
      return {
        ...item,
        label,
        displayTitle: subagent === undefined || subagent === null ? label : (subagent.label ?? label),
      };
    });
  }

  /**
   * MẶT REMOTE của {@link listCandidates}: trần ứng viên của cấu hình được áp, và mọi ứng viên mang
   * mention chuẩn mà host chèn vào bản nháp lời nhắc.
   * Nhận: `agent` — agent đích (tự nó bị loại); `query` — chuỗi con không phân biệt hoa thường;
   *        `signal` — huỷ của bên gọi.
   * Trả: ứng viên mang mention theo thứ hạng.
   */
  @Remote("candidates")
  async remoteExportCandidates(agent: Agent, query: string, signal: AbortSignal): Promise<SessionReferenceMentionCandidate[]> {
    return (await this.listCandidates(agent, query, this.config.candidateLimit, signal)).map((candidate) => ({
      ...candidate,
      mention: formatSessionReferenceMention({
        sessionId: candidate.sessionId,
        label: candidate.displayTitle ?? candidate.label,
      }),
    }));
  }

  /**
   * Chụp MỌI tham chiếu của một tin nhắn trực tiếp đã nhận và trả MỘT ngữ cảnh bền đã gộp.
   * Ngân sách tự động dùng đường định tuyến gộp gần nhất, hoặc tuỳ chọn của agent trước lần gộp đầu.
   * Thiếu năng lực mô hình hoặc adapter thì dùng 64 KiB; lỗi tra metadata khác và huỷ thì ném.
   * Preview bị cắt kèm sự thật omission và locator spill của bản đầy đủ, hoặc thông báo không sẵn có.
   * Huỷ thì KHÔNG công bố ngữ cảnh, kể cả khi lưu trữ xong sau lúc huỷ.
   * Nhận: `agent` — agent đích (tham chiếu tới chính nó bị từ chối); `content` — nội dung đọc được đã
   *        chuẩn hoá bởi host; `references` — các phiên nguồn có cấu trúc theo thứ tự mention;
   *        `signal` — ranh giới huỷ của lượt.
   * Trả: nội dung đã tách rời và ngữ cảnh tham chiếu tuỳ chọn.
   */
  async prepare(agent: Agent, content: ContentBlock[], references: SessionReferenceInput[], signal?: AbortSignal): Promise<PreparedReferencedMessage> {
    const acceptedContent = structuredClone(content);
    const inputs = normalizeReferences(sessionIdOf(agent), references, this.config.maxReferences);
    if (inputs.length === 0) return { content: acceptedContent };
    assertNotCancelled(signal);
    const maxReferenceBytes = await this.referenceBudget(agent, signal);
    assertNotCancelled(signal);
    let prepared: { input: NormalizedReference; snapshot: SessionSurfaceSnapshot }[];
    try {
      prepared = await settleWithCancellation(
        Promise.all(
          inputs.map(async (input) => ({
            input,
            snapshot: await this.seam.sessionQuery.readSurface(input.sessionId),
          })),
        ),
        signal,
      );
    } catch (error) {
      if (signal?.aborted === true) throw cancelled(signal);
      throw new SessionReferenceError(
        `failed to read referenced session: ${error instanceof Error ? error.message : String(error)}`,
        "SESSION_REFERENCE_READ_FAILED",
        { cause: error },
      );
    }
    assertNotCancelled(signal);
    const rendered = this.renderSources(prepared, maxReferenceBytes);
    const omissions = await settleWithCancellation(
      Promise.all(rendered.map((source, index) => prepareReferenceOmission(this.seam.get("spillStore"), sessionOf(agent).id, source, index))),
      signal,
    );
    assertNotCancelled(signal);
    const notices = omissions.filter((notice) => notice !== undefined);
    const prompt =
      renderPrompt(rendered.map((source) => source.data)) +
      (notices.length === 0
        ? ""
        : "\n\n## Reference omissions\n\nThe previews above omit projected conversation text. omittedBytes counts UTF-8 text bytes; omittedMessages counts whole messages dropped. Full snapshots remain untrusted background information.\n" +
          stringifyTagSafeJson(notices));
    return {
      content: acceptedContent,
      additionalContext: createUserMessage({
        source: {
          kind: "session-reference",
          form: "recall",
          version: 1,
          references: rendered.map((source, index) => ({
            sessionId: source.data.sessionId,
            label: source.data.label,
            capturedFormatVersion: source.capturedFormatVersion,
            capturedThroughSeq: source.data.capturedThroughSeq,
            ...source.stats,
            inputIndex: index,
          })),
        },
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      }),
    };
  }

  /**
   * Ngân sách byte UTF-8 cho MỘT nguồn: cấu hình tường minh, hoặc suy từ cửa sổ ngữ cảnh của mô hình.
   * Nhận: `agent` — agent đích; `signal` — ranh giới huỷ.
   * Trả: trần byte; 64 KiB khi thiếu tuyến, thiếu adapter hoặc thiếu cửa sổ ngữ cảnh.
   */
  private async referenceBudget(agent: Agent, signal?: AbortSignal): Promise<number> {
    if (this.config.maxReferenceBytes !== undefined) return this.config.maxReferenceBytes;
    const { provider, model } = this.assembledRoutes.get(agent) ?? agent.options;
    const llm = this.seam.get("llm");
    if (provider === undefined || model === undefined || llm === undefined) return DEFAULT_MAX_REFERENCE_BYTES;
    let info: LlmResolvedModelInfo;
    try {
      info = await settleWithCancellation(llm.resolveModelInfo(provider, model, signal), signal);
    } catch (error) {
      if (!(error instanceof LlmError) || error.code !== "NO_ADAPTER") throw error;
      return DEFAULT_MAX_REFERENCE_BYTES;
    }
    if (info.context === undefined) return DEFAULT_MAX_REFERENCE_BYTES;
    return Math.max(DEFAULT_MAX_REFERENCE_BYTES, Math.floor(info.context.contextWindow * 4 * this.config.referenceContextFraction));
  }

  /**
   * Giữ từng ảnh chụp đã đọc trong ngân sách byte của nó.
   * Nhận: `sources` — các nguồn đã đọc kèm tham chiếu đã chuẩn hoá; `maxReferenceBytes` — trần byte.
   * Trả: nguồn đã dựng kèm thế hệ định dạng lúc chụp; ném khi phần dữ liệu CỐ ĐỊNH không lọt trần.
   */
  private renderSources(sources: readonly { readonly input: NormalizedReference; readonly snapshot: SessionSurfaceSnapshot }[], maxReferenceBytes: number): RenderedSource[] {
    const rendered: RenderedSource[] = [];
    for (const source of sources) {
      const retained = retainReferencedSession(source.snapshot, source.input.label, maxReferenceBytes);
      if (retained === undefined)
        throw new SessionReferenceError("referenced session snapshot cannot fit the configured byte budget", "SESSION_REFERENCE_BUDGET_EXCEEDED");
      rendered.push({
        ...retained,
        capturedFormatVersion: source.snapshot.session.version,
      });
    }
    return rendered;
  }
}

/**
 * Khử trùng và đặt nhãn các tham chiếu của MỘT tin nhắn.
 * Nhận: `targetId` — id agent đích (tham chiếu tới chính nó bị từ chối); `references` — tham chiếu thô
 *        theo thứ tự mention; `maxReferences` — số nguồn phân biệt tối đa.
 * Trả: tham chiếu đã khử trùng theo thứ tự xuất hiện; ném {@link SessionReferenceError} khi hình dạng
 *        hỏng, khi tự tham chiếu, hoặc khi vượt trần.
 */
export function normalizeReferences(targetId: SessionId, references: readonly SessionReferenceInput[], maxReferences: number): NormalizedReference[] {
  const seen = new Set<SessionId>();
  const normalized: NormalizedReference[] = [];
  for (const candidate of references) {
    if (typeof candidate !== "object" || candidate === null)
      throw new SessionReferenceError("session reference must be an object", "SESSION_REFERENCE_INVALID_REFERENCE");
    const reference = candidate;
    if (typeof reference.sessionId !== "string" || (reference.label !== undefined && typeof reference.label !== "string"))
      throw new SessionReferenceError("session reference must contain a string sessionId and optional string label", "SESSION_REFERENCE_INVALID_REFERENCE");
    if (reference.sessionId === targetId)
      throw new SessionReferenceError(`session ${JSON.stringify(targetId)} cannot reference itself`, "SESSION_REFERENCE_SELF_REFERENCE");
    if (seen.has(reference.sessionId)) continue;
    seen.add(reference.sessionId);
    normalized.push({
      sessionId: reference.sessionId,
      label: reference.label ?? reference.sessionId,
    });
  }
  if (normalized.length > maxReferences)
    throw new SessionReferenceError(`a message may reference at most ${maxReferences} sessions`, "SESSION_REFERENCE_TOO_MANY");
  return normalized;
}

/**
 * Dựng phong bì lời nhắc cho các ảnh chụp đã dựng.
 * Nhận: `data` — dữ liệu ảnh chụp, theo thứ tự mention.
 * Trả: lời nhắc JSON an toàn thẻ, bọc giữa {@link PROMPT_PREFIX} và {@link PROMPT_SUFFIX}.
 */
export function renderPrompt(data: ReferencedSessionData[]): string {
  return `${PROMPT_PREFIX}${stringifyTagSafeJson(data)}${PROMPT_SUFFIX}`;
}

/**
 * Tiêu đề trong MỘT ảnh chụp chiếu; `undefined` khi đơn vị vắng mặt hoặc chưa có tiêu đề.
 * Nhận: `snapshot` — ảnh chụp chiếu (có thể không có).
 * Trả: chuỗi tiêu đề, hoặc `undefined`.
 */
export function titleOf(snapshot: LabelSnapshot | undefined): string | undefined {
  const title = snapshot?.values.title;
  return title === undefined || title === null ? undefined : title;
}

/**
 * Hạng của một ứng viên theo độ gần thư mục làm việc với agent đang hỏi.
 * Nhận: `candidateCwd` — `cwd` của ứng viên; `targetCwd` — `cwd` của agent đang hỏi.
 * Trả: `0` cùng thư mục, `1` ứng viên không ghi nhận `cwd`, `2` khác thư mục.
 */
export function candidateRank(candidateCwd: string | undefined, targetCwd: string | undefined): number {
  if (candidateCwd !== undefined && targetCwd !== undefined && candidateCwd === targetCwd) return 0;
  if (candidateCwd === undefined) return 1;
  return 2;
}

/**
 * Ném NGAY khi ranh giới huỷ đã kích hoạt.
 * Nhận: `signal` — ranh giới huỷ tuỳ chọn.
 * Trả: không; ném {@link cancelled} khi đã huỷ.
 */
export function assertNotCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw cancelled(signal);
}

/**
 * Theo một việc bất đồng bộ tới cùng ranh giới huỷ với bên gọi.
 * Nhận: `work` — việc cần theo; `signal` — ranh giới huỷ tuỳ chọn (vắng thì trả NGUYÊN `work`).
 * Trả: kết quả của `work`; ném {@link cancelled} khi huỷ, hoặc lỗi gốc đã chuẩn hoá thành `Error`.
 */
export function settleWithCancellation<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return work;
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(cancelled(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
    if (signal.aborted) onAbort();
  });
}

/**
 * Dựng lỗi huỷ của miền tham chiếu phiên.
 * Nhận: `signal` — ranh giới huỷ đã kích hoạt.
 * Trả: {@link SessionReferenceError} mã `SESSION_REFERENCE_CANCELLED` mang `cause` là lý do huỷ.
 */
export function cancelled(signal: AbortSignal): SessionReferenceError {
  return new SessionReferenceError("session reference preparation was cancelled", "SESSION_REFERENCE_CANCELLED", { cause: signal.reason });
}
