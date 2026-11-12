/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Service LÕI `tools`: sổ đăng ký tool theo scope, hai chế độ trình bày (native/ptc) và
 *      pipeline pre/guard/around/post/result — port 1:1 lib/types/index.js (1.349 dòng) của
 *      @deepseek-ai/dsh-tools. Kiểu + helper tách sang src/service-support.ts cho ≤ 1000 dòng/tệp.
 *      KHÔNG đổi tên service: mọi gói tool khác đăng ký qua nó.
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { ContentBlock, ToolSchema } from "@deepseek-ai/dsh-llm";
import type { PtcRuntime } from "@deepseek-ai/dsh-ptc-runtime";
import { ScopedLayers, scopeOf, scopeTarget } from "@deepseek-ai/dsh-scope";
import type { ScopeKey } from "@deepseek-ai/dsh-scope";
import type { UserMessage } from "@deepseek-ai/dsh-session";
import type { ApprovalService } from "@deepseek-ai/dsh-user-approval";
import { assertNever, deepFreeze, snapshotJsonValue } from "@deepseek-ai/dsh-util-values";
import type { JsonValue } from "@deepseek-ai/dsh-util-values";

import { assertSupportedJsonSchema, validateJsonSchemaValue } from "./json-schema.ts";
import { createRunCodeTool, RUN_CODE_NAME } from "./ptc.ts";
import type { PtcSdkLanguage } from "./ptc.ts";
import { renderToolsSdkPy } from "./py-types.ts";
import { renderToolsSdk } from "./ts-types.ts";
import type { ToolSdkSchema } from "./ts-types.ts";
import {
  TOOL_RUNTIME_SCHEDULER, ToolLayer, ToolNotFoundError, ToolOutputError, createExecutionToken,
  errorMessage, failureMessageFromContent, fuseToolSignals, isAborted, materializePresentation,
  projectionError, resolveMaxParallelSubCalls, snapshotProjection, snapshotToolValue,
  toolAbortedBeforeDispatchResult, toolAbortedResult, toolErrorResult,
} from "./service-support.ts";
import type {
  Config, PostToolDecision, PreToolDecision, PtcDispatchLog, ScheduledToolDispatch,
  ScheduledToolPreparation, ToolCancellationState, ToolContentFinalizer, ToolContentProjector,
  ToolDefinition, ToolDispatchExecution, ToolExecution, ToolExecutionFailure, ToolExecutionInput,
  ToolExecutionMode, ToolExecutionResult, ToolExecutionSuccess, ToolExecutionToken, ToolGuard,
  SandboxPolicySeam, ToolPresentationMode, ToolRestriction, ToolRunContext, ToolRuntimeScheduler, ToolsAssembleContext,
  ToolsEventSurface, ToolsPromptSection, ToolsSystemPrompt, ToolsWireSchemas, WorkingDirectorySeam,
} from "./service-support.ts";

/** Mặt export 1:1 của lib/types/index.js (sáu dòng tái xuất của bản gốc) cộng các kiểu lib/types/index.d.ts khai: giữ NGUYÊN VĂN mọi tên. Nhận: không (khai báo tái xuất). Trả: biểu tượng của schema.ts, json-schema.ts, ptc.ts, ts-types.ts, py-types.ts, testing.ts, types.ts và presentation.ts như bản gốc. */
export {
  defineTool,
  parameterSchemaSpecToJsonSchema,
  validateArgs,
  valueSchemaSpecToJsonSchema,
  ToolArgsError,
} from "./schema.ts";
export type {
  ArrayValueSchemaSpec, BooleanValueSchemaSpec, DefineToolOptions, InferArgs, InferValue,
  IntegerValueSchemaSpec, JsonValueSchemaSpec, NullValueSchemaSpec, NumberValueSchemaSpec,
  ObjectValueSchemaSpec, OneOfValueSchemaSpec, ParameterJsonSchema, ParameterPropertySpec,
  ParameterSchemaSpec, StringValueSchemaSpec, ValueSchemaAnnotations, ValueSchemaSpec,
} from "./schema.ts";
export { assertObjectJsonSchema, assertSupportedJsonSchema, JsonSchemaError, validateJsonSchemaValue } from "./json-schema.ts";
export type { JsonSchemaNode, JsonSchemaScalar, JsonSchemaType, ObjectJsonSchema } from "./json-schema.ts";
export type { PtcDispatchEventData, PtcDispatchStartEventData } from "./types.ts";
export { CodeRunFailedError, RUN_CODE_NAME } from "./ptc.ts";
export { jsonSchemaToTs, renderToolsSdk } from "./ts-types.ts";
export { jsonSchemaToPy, renderToolsSdkPy } from "./py-types.ts";
export { defineContentToolFixture } from "./testing.ts";
export type { ContentToolFixtureOptions } from "./testing.ts";
export type {
  DiffCallView, DiffResultView, FileDiff, FileLocation, GenericCallView, GenericResultView,
  ReadFileLine, ReadResultView, SearchFileMatches, SearchLineMatch, SearchMatchesResultView,
  SearchPathsResultView, SearchResultView, TerminalCallView, TerminalResultView, ToolCallKind,
  ToolCallView, ToolResultView, WebFetchResultView, WebResultView, WebSearchResultView, WebSource,
} from "./presentation.ts";

/** Mặt export nội bộ của service: hằng số, hai lớp lỗi và toàn bộ kiểu công khai mà bản gốc khai trong lib/types/index.d.ts; định nghĩa nằm ở service-support.ts. Nhận: không (khai báo tái xuất). Trả: hằng số/lỗi/kiểu của module service. */
export { TOOL_ABORTED, TOOL_ABORTED_BEFORE_DISPATCH, TOOL_RUNTIME_SCHEDULER, ToolNotFoundError, ToolOutputError } from "./service-support.ts";
export type {
  Config, PostToolDecision, PreToolDecision, PtcDispatchLog, ScheduledToolDispatch,
  ScheduledToolPreparation, ToolDefinition, ToolDispatchExecution, ToolErrorInfo, ToolExecution,
  ToolExecutionFailure, ToolExecutionInput, ToolExecutionMode, ToolExecutionResult,
  ToolExecutionSuccess, ToolExecutionToken, ToolFailure, ToolGuard, ToolOutputDefinition,
  ToolPresentationMode, ToolRestriction, ToolResult, ToolRunContext, ToolRuntimeScheduler,
} from "./service-support.ts";

/** Câu phát biểu hướng model về phép thu gọn `ptc`: nêu hệ quả và tuyến đi, vì luật chỉ phát hiện được khi bị từ chối là luật sửa quá muộn. */
const PTC_ONLY_INSTRUCTION = `\`${RUN_CODE_NAME}\` is the only tool you can call directly — a tool call naming any other tool fails. Reach every tool the SDK declares below from inside the program.`;

/** Kiểu một renderer SDK: nhận schema tool đã chiếu, trả chữ của mục tools:sdk. Nhận: danh sách schema tool đã chiếu (đã loại run_code). Trả: chữ mục prompt hoàn chỉnh. */
type SdkRenderer = (schemas: ToolSdkSchema[]) => string;

/** Bảng language → renderer SDK. Registry tra ctx.ptcRuntime.language trong bảng này khi lắp mục tools:sdk dưới chế độ khác native; language lạ làm việc lắp thất bại lớn tiếng. Thêm ngôn ngữ backend là ba sửa đổi song song — PtcSdkLanguage, mục ở đây, và RUN_CODE_FLAVORS trong ptc.ts — và mệnh đề satisfies ghim tập khoá vào hợp đó. Nhận: schema tool đã chiếu. Trả: chữ mục prompt do renderer của language tương ứng sinh. */
const SDK_RENDERERS: Record<string, SdkRenderer> = {
  typescript: renderToolsSdk,
  python: renderToolsSdkPy,
} satisfies Record<PtcSdkLanguage, SdkRenderer>;

/** Lát cắt sổ đăng ký mà MỘT scope nhìn thấy. Nhận: bản đồ hiển thị + hai tập tên. Trả: (kiểu) dữ kiện cho trình bày, tra cứu, validate thứ tự. */
interface ToolsView {
  /** Tool nhìn thấy được sau khi áp bộ lọc và đăng ký của scope. */
  readonly visible: Map<string, ToolDefinition>;
  /** Mọi tên đã biết (trước bộ lọc) ở scope này. */
  readonly knownNames: Set<string>;
  /** Tên toàn cục mà bộ lọc của scope này được phép nêu. */
  readonly restrictableNames: Set<string>;
}

/** Kết quả chặng tạo execution: đã sẵn sàng đi tiếp, hoặc đã có kết quả cuối. Nhận: không. Trả: (kiểu) giá trị chặng chuẩn bị nhận. */
type CreatedToolExecution = ScheduledToolPreparation | { kind: "ready"; exec: ToolRunContext };

/** Quyết định pre-execute SAU khi nhánh ask đã giải. Nhận: không. Trả: (kiểu) allow, deny hoặc cancel. */
type ResolvedPreToolDecision = Exclude<PreToolDecision, { kind: "ask" }>;

/** Kết quả giải MỘT ask: quyết định cuối và cờ approval bị huỷ. Nhận: hai trường đó. Trả: (kiểu) giá trị chặng chuẩn bị đọc. */
interface ToolAskResolution {
  /** Quyết định cuối cùng (không còn nhánh ask). */
  readonly decision: ResolvedPreToolDecision;
  /** `true` khi approval kết thúc ở trạng thái huỷ. */
  readonly approvalCancelled: boolean;
}

/** Đọc bề mặt systemPrompt của context qua seam CẤU TRÚC (ADR 000d). Nhận: ctx — context host. Trả: bề mặt `{ tools, section, getSectionOrder }`. */
function promptSurfaceOf(ctx: Context): ToolsSystemPrompt {
  return eventSurfaceOf(ctx).systemPrompt;
}

/** Đọc bề mặt sự kiện của context qua seam CẤU TRÚC (ADR 000d). Nhận: ctx — context host. Trả: bề mặt `{ emit, waterfall }`. */
function eventSurfaceOf(ctx: Context): ToolsEventSurface {
  return ctx as unknown as ToolsEventSurface;
}

/** Sổ đăng ký tool và pipeline thi hành. Đăng ký theo scope che bản toàn cục; MỘT bộ giải tầm nhìn phục vụ cả trình bày, tra cứu và phát. Nhận: ctx — context host; config — cấu hình đã kiểm. Trả: service `tools` đã đăng ký. */
export class ToolRuntime extends Service {
  static inject: string[] = ["systemPrompt"];

  /** Schema cấu hình để Settings/config-editor của kernel render được từng trường. */
  static Config = z.object({
    mode: z.union(["native", "ptc"]).default("native"),
    maxParallelSubCalls: z.natural().min(1).default(10),
  }) as unknown as z<Config>;

  /** Góc nhìn theo chặng mà bộ lập lịch song song của dsh-agent-loop tiêu thụ. */
  readonly [TOOL_RUNTIME_SCHEDULER]: ToolRuntimeScheduler = {
    prepare: (exec) => this.prepareScheduledExecution(exec),
    dispatch: (exec) => this.dispatchScheduledExecution(exec),
    finalize: (exec, result) => this.finalizeScheduledExecution(exec, result),
    finish: (exec, result) => this.finishScheduledExecution(exec, result),
  };

  /** Ngữ cảnh do thân tool đang chạy hoãn lại, khoá theo lần thi hành của bộ lập lịch. */
  private readonly deferredContexts = new WeakMap<ToolRunContext, UserMessage[]>();

  /** Các lần thi hành mà thân tool đã tuyên bố lượt hiện tại kết thúc. */
  private readonly concludingExecutions = new WeakSet<ToolRunContext>();

  /** Việc huỷ gốc của người gọi, giữ ngoài đối tượng execution mà wrapper có thể biến đổi. */
  private readonly cancellationStates = new WeakMap<ToolRunContext, ToolCancellationState>();

  /** Phép biến đổi nội dung cuối do tool sở hữu, chụp trước khi chính sách bắt đầu. */
  private readonly contentFinalizers = new WeakMap<ToolRunContext, ToolContentFinalizer | undefined>();

  /** Nội dung đã chuẩn bị lúc thi hành, cài trước chính sách post-execute. */
  private readonly contentProjectors = new WeakMap<ToolRunContext, ToolContentProjector | undefined>();

  /** Kết quả đã chuẩn hoá bởi registry, cùng đúng lần phát đã validate mỗi giá trị. */
  private readonly canonicalResults = new WeakMap<ToolExecutionResult, ToolExecutionToken>();

  /** Hai lớp đăng ký: lớp toàn cục dựng sẵn, lớp scope dựng khi có đăng ký đầu tiên. */
  private readonly layers: ScopedLayers<ToolLayer>;

  /** Phần trình bày cho scope không tự khai; presentAs che nó theo scope. */
  private readonly defaultMode: ToolPresentationMode;

  /** Chặn trên đã kiểm cho lời gọi con chồng lấn của một chương trình run_code. */
  private readonly maxParallelSubCalls: number;

  /** Transport trình bày dành riêng, dựng khi cần lần đầu và giữ NGOÀI các lớp đăng ký có thể bị lọc. */
  private ptcTransport: ToolDefinition | undefined;

  /** Context sở hữu registry, độc lập với Agent đang gọi. */
  private readonly ptcContext: Context;

  /** Đăng ký service tools, provider schema tool, và (dưới chế độ khác native) hai mục prompt. Nhận: ctx — context host; config — cấu hình đã qua schema. Trả: thực thể đã đăng ký dưới tên `tools`. @throws {Error} khi maxParallelSubCalls không phải số nguyên dương. */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, "tools");
    this.ptcContext = ctx;
    this.defaultMode = config.mode ?? "native";
    this.maxParallelSubCalls = resolveMaxParallelSubCalls(config.maxParallelSubCalls);
    this.layers = new ScopedLayers<ToolLayer>(
      (scope) => new ToolLayer(scope),
      () => {
        eventSurfaceOf(ctx).emit("tools/change");
      },
    );
    promptSurfaceOf(ctx).tools((context) => this.wireSchemas(context.scope));
    if (this.defaultMode !== "native") {
      promptSurfaceOf(ctx).section(this.collapseSection());
      promptSurfaceOf(ctx).section(this.sdkSection());
    }
  }

  /** Câu phát biểu prompt về phép thu gọn executor ptc, đăng ký ở đâu có sdkSection và render rỗng ngoài một ptc hiệu lực. Thứ tự của mục đặt luật TRƯỚC phần hướng dẫn từng tool (nếu không model phát lời gọi native, nhận UNKNOWN_TOOL cho tool prompt vừa khai, rồi kết luận deployment hỏng). Scope native không render chỉ dẫn nào. Nhận: không. Trả: đăng ký mục prompt cho phạm vi đang gọi. */
  private collapseSection(): ToolsPromptSection {
    return {
      name: "tools:ptc-only",
      order: promptSurfaceOf(this.ctx).getSectionOrder("PTC_ONLY"),
      text: (context) => (this.modeFor(context.scope) === "ptc" ? PTC_ONLY_INSTRUCTION : ""),
    };
  }

  /** Mục prompt SDK được sinh, đăng ký toàn cục bởi deployment PTC và theo scope bởi presentAs. Thân mục tái sinh từ scope ĐANG GỌI và render rỗng cho agent trình bày native. Nhận: không. Trả: đăng ký mục prompt cho phạm vi đang gọi. */
  private sdkSection(): ToolsPromptSection {
    return {
      name: "tools:sdk",
      order: promptSurfaceOf(this.ctx).getSectionOrder("TOOLS_SDK"),
      interpolate: false,
      text: (context) => {
        const mode = this.modeFor(context.scope);
        if (mode === "native") return "";
        const runtime = this.requirePtcRuntime(mode);
        // Đọc thuộc tính riêng: language như toString/constructor nếu không sẽ phân giải thành viên
        // kế thừa của Object.prototype thành renderer.
        const render = SDK_RENDERERS[runtime.language];
        /* v8 ignore next -- requirePtcRuntime từ chối language lạ trước khi tới đây. */
        if (render === undefined) throw new Error(`dsh-tools: no SDK renderer for ${runtime.language}`);
        return render(this.sdkSchemas(context.scope));
      },
    };
  }

  /** Phần trình bày agent của MỘT scope thấy: khai báo của nó, nếu không thì mặc định deployment. Nhận: scope — agent đang gọi, hoặc undefined cho góc nhìn toàn cục. Trả: chế độ trình bày đã giải. */
  private modeFor(scope: ScopeKey | undefined): ToolPresentationMode {
    // Scope gần nhất thắng dọc chuỗi; chế độ quyết định model THẤY gì.
    const layers = this.layers.chainLayers(scope);
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const mode = layers[index]?.mode;
      if (mode !== undefined) return mode;
    }
    return this.defaultMode;
  }

  /** Transport run_code dành riêng, dựng khi cần lần đầu: nó không bao giờ vào lớp toàn cục, nên bộ lọc theo agent không bỏ được nó và đăng ký theo scope không che được nó. Nhận: không. Trả: định nghĩa transport dùng chung. @throws {Error} khi run_code có Agent mà thiếu workingDirectory, hoặc thiếu sandboxPolicy. */
  private requirePtcTransport(): ToolDefinition {
    this.ptcTransport ??= createRunCodeTool(
      this,
      {
        resolveWorkingDirectory: async (exec) => {
          // Chỉ PTC do Agent sở hữu cần trạng thái thư mục.
          if (exec.agent === undefined) return undefined;
          const directories = this.ctx.get("workingDirectory") as WorkingDirectorySeam | undefined;
          if (directories === undefined) {
            throw new Error("dsh-tools: run_code with an Agent requires workingDirectory");
          }
          return directories.ensure(exec.agent, exec.signal);
        },
        requireRuntime: () => this.requirePtcRuntime(this.defaultMode),
        peekApprover: () => this.ctx.get("approval") as ApprovalService | undefined,
        resolveSandboxPolicy: (exec) => {
          const policy = this.ctx.get("sandboxPolicy") as SandboxPolicySeam | undefined;
          if (policy === undefined) {
            throw new Error("dsh-tools: confined PTC runtime requires sandboxPolicy");
          }
          // Seam policy cua kernel nhan `Session`; ban port dung `AgentSession` => ep MOT cho tai bien (ADR 000d).
          return policy.resolve(exec.agent === undefined ? {} : { session: exec.agent.session as unknown as Parameters<typeof policy.resolve>[0] extends infer T ? Extract<T, { session: unknown }>["session"] : never });
        },
        // Getter mô tả/tham số biết ngôn ngữ đọc runtime mà không đòi hỏi nó.
        peekRuntime: () => this.ctx.get("ptcRuntime") as PtcRuntime | undefined,
        maxParallel: this.maxParallelSubCalls,
        shapeDispatchLog: (dispatch) => this.shapeDispatchLog(dispatch),
      },
      this.ptcContext,
    );
    return this.ptcTransport;
  }

  /** Trình bày tool của scope đang gọi theo mode thay vì mặc định deployment; scope gần nhất trên chuỗi thắng. Chỉ theo scope, một khai báo cho mỗi scope — cách một preset agent ghép agent PTC bên cạnh agent native trong cùng tiến trình. Nhận: mode — phần trình bày mà model của các agent bị phủ thấy. Trả: đúng bộ huỷ khôi phục mặc định deployment. @throws {Error} khi context không có scope, hoặc scope đã khai phần trình bày khác. */
  presentAs(mode: ToolPresentationMode): () => void {
    const ctx = this.ctx;
    const prompt = promptSurfaceOf(ctx);
    if (scopeOf(ctx) === undefined) {
      throw new Error("tools.presentAs() requires a scoped context (agent.ctx): a context-global presentation is the `mode` config field on the tools row");
    }
    const layers = this.layers;
    const collapseSection = (): ToolsPromptSection => this.collapseSection();
    const sdkSection = (): ToolsPromptSection => this.sdkSection();
    const dispose = ctx.effect(function* () {
      yield layers.effect(
        ctx,
        (layer) => {
          if (layer.mode !== undefined) {
            throw new Error(`tools.presentAs("${mode}") conflicts with "${layer.mode}" already declared for this scope; one composition selects one presentation`);
          }
          layer.mode = mode;
          return () => {
            layer.mode = undefined;
          };
        },
        { label: "tools.presentAs()" },
      );
      // Mục SDK và mục thu gọn theo scope vì cùng lý do chế độ theo scope.
      if (mode !== "native") {
        yield prompt.section(collapseSection());
        yield prompt.section(sdkSection());
      }
    }, "tools.presentAs()");
    return dispose;
  }

  /** Dựng schema và tên trên dây của MỘT scope để validate thứ tự prompt. Bộ lọc không làm tool đã biết thành không hợp lệ, nhưng một phép thu gọn chế độ thì có. Nhận: scope — scope đang xem, hoặc undefined cho góc nhìn toàn cục. Trả: schema cần phát và tên đã biết ở scope đó. */
  private wireSchemas(scope: ScopeKey | undefined): ToolsWireSchemas {
    const view = this.view(scope);
    const mode = this.modeFor(scope);
    if (mode === "native") {
      const schemas = [...view.visible.values()].map((definition) => this.schemaOf(definition, false));
      return { schemas, knownNames: [...view.knownNames] };
    }
    // Validate language TRƯỚC khi chiếu schema: schemaOf đọc getter biết ngôn ngữ của run_code, mà
    // bảo vệ bảng flavor của nó nếu không sẽ nổi lên trước.
    this.requirePtcRuntime(mode);
    const schemas = [...view.visible.values()].map((definition) => this.schemaOf(definition, false));
    return {
      schemas: schemas.filter((schema) => schema.name === RUN_CODE_NAME),
      knownNames: [RUN_CODE_NAME],
    };
  }

  /** Giải runtime PTC hoặc ném lỗi cấu hình sai có thể hành động được. Đọc lúc dùng (lắp prompt / thi hành run_code), KHÔNG qua static inject: inject sẽ giữ ctx.tools làm con tin cho việc tồn tại runtime PTC ngay cả dưới mode native. Nhận: mode — chế độ trình bày đang cần runtime (chỉ để dựng thông báo lỗi). Trả: runtime PTC đã nạp. @throws {Error} khi chưa nạp ctx.ptcRuntime, hoặc language của nó không có renderer SDK. */
  private requirePtcRuntime(mode: ToolPresentationMode): PtcRuntime {
    const runtime = this.ctx.get("ptcRuntime") as PtcRuntime | undefined;
    if (!runtime) {
      throw new Error(`dsh-tools: mode "${mode}" requires a PTC runtime — load a ctx.ptcRuntime implementation (e.g. @deepseek-ai/dsh-ptc-runtime-node) or set tools mode to "native"`);
    }
    if (!Object.hasOwn(SDK_RENDERERS, runtime.language)) {
      const known = Object.keys(SDK_RENDERERS).map((name) => JSON.stringify(name)).join(", ");
      throw new Error(`dsh-tools: no SDK renderer registered for runtime language ${JSON.stringify(runtime.language)} (known: ${known})`);
    }
    return runtime;
  }

  /** Đăng ký toàn cục hoặc trong scope agent đang gọi. Tool theo scope che tool toàn cục; trùng tên trong MỘT lớp và tên run_code dành riêng đều thất bại. Nhận: definition — schema tool, hàm thi hành, callback hoàn thiện/trình bày tuỳ chọn. Trả: đúng bộ huỷ gỡ đăng ký tool. @throws {TypeError} khi thiếu hợp đồng output hoặc timeoutMs không hợp lệ. @throws {Error} khi tên là run_code dành riêng, hoặc tên đã đăng ký trong lớp này. @throws {JsonSchemaError} khi schema đầu ra nằm ngoài tập JSON Schema được hỗ trợ. */
  register(definition: ToolDefinition): () => void {
    const name = definition.name;
    const output = definition.output;
    if (
      output === undefined ||
      typeof output !== "object" ||
      typeof output.render !== "function" ||
      (output.presentationMeta !== undefined && typeof output.presentationMeta !== "function")
    ) {
      throw new TypeError(`tool "${name}" must declare output { schema, render, presentationMeta? }`);
    }
    assertSupportedJsonSchema(output.schema);
    const timeoutMs = definition.timeoutMs;
    if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
      throw new TypeError(`tool "${name}" timeoutMs must be a positive finite number`);
    }
    // Dành riêng vô điều kiện: agent nào cũng có thể tự chọn chế độ mã.
    if (name === RUN_CODE_NAME) {
      throw new Error(`tool name "${RUN_CODE_NAME}" is reserved for the PTC mode presentation transport and cannot be registered or shadowed`);
    }
    return this.layers.effect(this.ctx, (layer) => layer.tools.insert(name, definition), { label: "tools.register()" });
  }

  /** Hạn chế tool toàn cục cho scope agent đang gọi. Bộ lọc rỗng, tên lạ, tên cục bộ scope và tên transport dành riêng đều thất bại. Các hạn chế giao nhau; đăng ký theo scope vẫn hiển thị. Nhận: filter — mặt nạ tool toàn cục: allow (chỉ giữ) và/hoặc deny (bỏ). Trả: đúng bộ huỷ dỡ hạn chế này. @throws {Error} khi context không có scope, bộ lọc rỗng, nêu run_code, hoặc nêu tên lạ. */
  restrict(filter: ToolRestriction): () => void {
    const scope = scopeOf(this.ctx);
    if (scope === undefined) {
      throw new Error("tools.restrict() requires a scoped context (agent.ctx): a context-global restriction would mask every agent — deny the tool for the intended agent instead");
    }
    const allow = filter.allow;
    const deny = filter.deny;
    if (allow === undefined && deny === undefined) {
      throw new Error("tools.restrict({}) is a no-op: pass `allow` and/or `deny` (an empty filter is almost always a materialized-empty-config bug)");
    }
    const compiled = {
      ...(allow !== undefined ? { allow: new Set(allow) } : {}),
      ...(deny !== undefined ? { deny: new Set(deny) } : {}),
    };
    if ([...(allow ?? []), ...(deny ?? [])].includes(RUN_CODE_NAME)) {
      throw new Error(`tools.restrict() cannot name reserved PTC mode presentation transport "${RUN_CODE_NAME}"; restrict end-capability tools instead`);
    }
    const known = this.view(scope).restrictableNames;
    const unknown = [...(allow ?? []), ...(deny ?? [])].filter((name) => !known.has(name));
    if (unknown.length > 0) {
      const listed = unknown.map((n) => `"${n}"`).join(", ");
      const knownList = [...known].sort().join(", ") || "(none)";
      throw new Error(`tools.restrict() names unknown global tool${unknown.length > 1 ? "s" : ""} ${listed}; known global tools: ${knownList}`);
    }
    return this.layers.effect(this.ctx, (layer) => layer.restrictions.append(compiled), { label: "tools.restrict()" });
  }

  /** Đăng ký guard đơn điệu SAU waterfall tools/pre-execute. Guard trên context trơn áp toàn cục; guard qua agent.ctx chỉ áp cho agent đó. Không guard nào ép cho phép được lời gọi guard khác đã từ chối. Bộ huỷ effect chính xác được trả về cho sở hữu có thứ tự và dọn HMR. Nhận: guard — kiểm tra đồng bộ; chuỗi trả về là từ chối. Trả: đúng bộ huỷ gỡ guard. */
  guard(guard: ToolGuard): () => void {
    return this.layers.effect(this.ctx, (layer) => layer.guards.append(guard), { label: "tools.guard()", notify: false });
  }

  /** Lý do từ chối đơn điệu ĐẦU TIÊN từ lớp toàn cục rồi tới chuỗi guard của scope, xa nhất trước. Nhận: exec — lời gọi đã qua chính sách pre-execute. Trả: chuỗi lý do, hoặc undefined khi không guard nào từ chối. */
  private guardReason(exec: Readonly<ToolExecution>): string | undefined {
    const globalReason = this.layers.global.guardReason(exec);
    if (globalReason !== undefined) return globalReason;
    if (exec.agent === undefined) return undefined;
    for (const layer of this.layers.chainLayers(exec.agent)) {
      const reason = layer.guardReason(exec);
      if (reason !== undefined) return reason;
    }
    return undefined;
  }

  /** Giải mọi dữ kiện sổ đăng ký một scope cần trong MỘT lượt duyệt lớp: bản đồ hiển thị áp bộ lọc lên bề mặt KẾ THỪA rồi tới đăng ký của scope và transport dành riêng; hai tập kia giữ dữ kiện TRƯỚC bộ lọc. Hạn chế lọc những gì scope KẾ THỪA (toàn cục + mọi tổ tiên), không bao giờ lọc lớp CỦA CHÍNH NÓ — miễn trừ đó giữ nguyên bộ máy mà một con trả lời qua. Nhận: scope — scope đang xem (agent), hoặc undefined cho góc nhìn toàn cục. Trả: lát cắt đã dẫn xuất đầy đủ cho scope đó. */
  private view(scope: ScopeKey | undefined): ToolsView {
    const layers = this.layers.chainLayers(scope);
    // Cố ý không nhìn chuỗi: lớp DUY NHẤT mà scope sở hữu đăng ký thay vì kế thừa.
    const own = this.layers.peek(scope);
    // Bề mặt kế thừa, tổ tiên gần nhất cuối; lớp toàn cục là xa nhất.
    const inherited = new Map<string, ToolDefinition>(this.layers.global.tools.entries());
    for (const layer of layers) {
      if (layer === own) continue;
      for (const [name, definition] of layer.tools.entries()) inherited.set(name, definition);
    }
    const visible = new Map<string, ToolDefinition>();
    const knownNames = new Set<string>();
    const restrictableNames = new Set<string>();
    for (const [name, definition] of inherited) {
      knownNames.add(name);
      restrictableNames.add(name);
      // Các hạn chế giao nhau khắp chuỗi: scope nào trên đó cũng che được tên cho mọi thứ lồng bên trong.
      if (layers.every((layer) => layer.admits(name))) visible.set(name, definition);
    }
    // Đăng ký của chính scope cuối cùng, che tên kế thừa và nằm NGOÀI bộ lọc trên.
    if (own !== undefined) {
      for (const [name, definition] of own.tools.entries()) {
        knownNames.add(name);
        visible.set(name, definition);
      }
    }
    // Hạ tầng trình bày giải CUỐI và ngoài việc lọc năng lực. Theo scope: agent native không được
    // thấy run_code trong bảng phát của nó chỉ vì agent khác trình bày nó.
    if (this.modeFor(scope) !== "native") {
      visible.set(RUN_CODE_NAME, this.requirePtcTransport());
    }
    return { visible, knownNames, restrictableNames };
  }

  /** Tra một tool như MỘT scope nhìn thấy (scope che toàn cục; tool bị lọc đọc như vắng mặt). Nhận: name — tên đã đăng ký; scope — agent đang xem (bỏ trống = toàn cục). Trả: định nghĩa, hoặc undefined khi không thấy. */
  get(name: string, scope?: ScopeKey): ToolDefinition | undefined {
    return this.view(scope).visible.get(name);
  }

  /** Giải định nghĩa CÓ THỂ THI HÀNH cho một lời gọi, áp phép thu gọn chế độ tại biên thao tác sở hữu nó: dưới ptc, lời gọi TRỰC TIẾP của model chỉ được nêu run_code, còn lần phát con lồng (token parent đã đặt) được gọi mọi tool hiển thị. Nhận: name — tên đã đăng ký; scope — agent đang xem; nested — lần phát con hay lời gọi trực tiếp. Trả: định nghĩa được phép chạy, hoặc undefined khi lời gọi phải bị từ chối. */
  private resolveExecution(name: string, scope: ScopeKey | undefined, nested: boolean): ToolDefinition | undefined {
    const tool = this.get(name, scope);
    if (tool === undefined) return undefined;
    if (this.collapses(name, scope, nested)) return undefined;
    return tool;
  }

  /** Chiếu định nghĩa hiển thị lên đúng các trường schema hướng model (bỏ callback thi hành/trình bày). Nhận: scope — agent đang xem (bỏ trống = toàn cục). Trả: mỗi tool hiển thị một schema sao sâu. */
  schemas(scope?: ScopeKey): ToolSchema[] {
    return [...this.view(scope).visible.values()].map((definition) => this.schemaOf(definition, true));
  }

  /** Chiếu tool hiển thị gọi được lên hợp đồng SDK chế độ PTC được sinh. Nhận: scope — agent đang xem (bỏ trống = toàn cục). Trả: mỗi tool hiển thị (trừ run_code) một schema kèm schema đầu ra chuẩn tắc. @throws {Error} khi schema đầu ra của một tool không tuần tự hoá JSON không mất mát. */
  private sdkSchemas(scope?: ScopeKey): ToolSdkSchema[] {
    return [...this.view(scope).visible.values()]
      .filter((definition) => definition.name !== RUN_CODE_NAME)
      .map((definition) => {
        const output = snapshotJsonValue(definition.output.schema);
        /* v8 ignore next -- việc đăng ký đã validate và giữ schema này là JSON không mất mát. */
        if (output === undefined) {
          throw new Error(`tool "${definition.name}" output schema must be lossless JSON before SDK projection`);
        }
        return {
          ...this.schemaOf(definition, true),
          output,
        };
      });
  }

  /** Chiếu MỘT định nghĩa lên các trường schema hướng model. Nhận: definition — định nghĩa tool; detachParameters — có sao sâu tham số hay không. Trả: schema đã chiếu. @throws {Error} khi tham số không tuần tự hoá JSON không mất mát. */
  private schemaOf(definition: ToolDefinition, detachParameters: boolean): ToolSchema {
    const { name, description, parameters, deferLoading } = definition;
    const detached = detachParameters ? snapshotJsonValue(parameters) : parameters;
    if (detached === undefined) {
      throw new Error(`tool "${name}" parameters must be lossless JSON before schema projection`);
    }
    return {
      name,
      description,
      parameters: detached,
      ...(deferLoading === true ? { deferLoading } : {}),
    };
  }

  /** Phân loại lời gọi đang chờ qua định nghĩa hiển thị: chỉ true đúng nghĩa là song song, mọi trường hợp khác (lạ/ẩn/chưa khai/ném) là độc quyền. Nhận: exec — tên, tham số, scope agent tuỳ chọn. Trả: chế độ lập lịch đóng an toàn. */
  executionMode(exec: ToolExecutionInput): ToolExecutionMode {
    const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== undefined);
    if (!tool?.isConcurrencySafe) return { kind: "exclusive" };
    try {
      const concurrencySafe = tool.isConcurrencySafe(exec.arguments);
      return concurrencySafe === true ? { kind: "parallel" } : { kind: "exclusive" };
    } catch {
      return { kind: "exclusive" };
    }
  }

  /** Chạy waterfall tools/ptc-dispatch-log trên MỘT lần phát con đã lắng; listener ném lỗi thì ghi log nội dung gốc (có chứa). Nhận: dispatch — lần thi hành cha, định danh lời gọi con, nội dung đã lắng. Trả: nội dung sẽ ghi lên sự kiện bền. */
  private async shapeDispatchLog(dispatch: PtcDispatchLog): Promise<ContentBlock[]> {
    try {
      return await eventSurfaceOf(this.ctx).waterfall(scopeTarget(this, dispatch.agent), "tools/ptc-dispatch-log", dispatch, () => Promise.resolve(dispatch.content));
    } catch (error) {
      this.ctx.logger.warn(
        `tools: ptc-dispatch-log listener failed for ${dispatch.name}: ${errorMessage(error)}; logging the original settled content`,
      );
      return dispatch.content;
    }
  }

  /** Phép thu gọn ptc có từ chối lời gọi trực tiếp của model hay không: chỉ run_code được nêu; lần phát con lồng bỏ qua. Một chỗ duy nhất cho vị từ liên quan an ninh, dùng chung bởi resolveExecution và createExecution. Giải qua modeFor, KHÔNG phải defaultMode, để agent được preset cấp ptc dưới deployment native cũng bị thu gọn. Nhận: name — tên đã đăng ký; scope — scope đang xem; nested — lần phát con hay lời gọi trực tiếp. Trả: true khi lời gọi trực tiếp của model bị thu gọn. */
  private collapses(name: string, scope: ScopeKey | undefined, nested: boolean): boolean {
    return !nested && this.modeFor(scope) === "ptc" && name !== RUN_CODE_NAME;
  }

  /** Thi hành qua pre-policy, guard, around-dispatch, post-policy, phần hoàn thiện nội dung do tool sở hữu, và thông báo cuối. Thất bại của tool/listener lắng thành kết quả lỗi đã materialize; tool vô hình báo UNKNOWN_TOOL. Việc huỷ tới sau khi vào hàm và trước materialize sẽ bỏ qua thân chưa khởi chạy với ABORTED_BEFORE_DISPATCH, hoặc thay kết quả thành công đã khởi chạy bằng ABORTED; công việc đã khởi chạy vẫn được rút cạn. Nhận: exec — đầu vào gọi trong cùng tiến trình; registry gán token tương quan trước chính sách. Trả: kết quả cuối đã materialize. */
  async execute(exec: ToolExecutionInput): Promise<ToolExecutionResult> {
    return this.prepareExecution(exec, (prepared) => this.completeScheduledExecution(prepared));
  }

  /** Chạy trọn pipeline cho MỘT lần chuẩn bị. Nhận: prepared — đầu ra chặng chuẩn bị. Trả: kết quả cuối đã materialize. */
  private async completeScheduledExecution(prepared: ScheduledToolPreparation): Promise<ToolExecutionResult> {
    switch (prepared.kind) {
      case "dispatch": {
        const dispatched = await this.dispatchScheduledExecution(prepared.exec);
        return dispatched.kind === "post-result"
          ? await this.finalizeScheduledExecution(prepared.exec, dispatched.result)
          : this.finishScheduledExecution(prepared.exec, dispatched.result);
      }
      case "post-result":
        return await this.finalizeScheduledExecution(prepared.exec, prepared.result);
      case "final-result":
        return this.finishScheduledExecution(prepared.exec, prepared.result);
      /* v8 ignore next -- bảo vệ vét cạn của hợp đóng */
      default:
        return assertNever(prepared, "scheduled tool preparation");
    }
  }

  /** Materialize đầu vào, chụp callback do tool sở hữu, và quyết định chặng kế. Lời gọi bị thu gọn chế độ bị từ chối TẤT ĐỊNH trước pipeline chính sách (listener, approval, guard không được quan sát hay phê duyệt một lời gọi chỉ có thể thất bại); tool thực sự không tồn tại giữ đường UNKNOWN_TOOL ở chặng phát. Nhận: exec — đầu vào gọi đã có kiểu. Trả: lần thi hành đã sẵn sàng, hoặc kết quả cuối. */
  private createExecution(exec: ToolExecutionInput): CreatedToolExecution {
    const deferredContexts: UserMessage[] = [];
    const token = createExecutionToken();
    const callId = exec.callId;
    const rootCallId = exec.rootCallId ?? callId;
    const name = exec.name;
    const agent = exec.agent;
    const parent = exec.parent;
    const signal = exec.signal;
    const visible = this.get(name, agent);
    const collapsed = visible !== undefined && this.collapses(name, agent, parent !== undefined);
    const concludingExecutions = this.concludingExecutions;
    const base: Omit<ToolRunContext, "arguments"> = {
      token,
      callId,
      rootCallId,
      name,
      signal,
      ...(agent !== undefined ? { agent } : {}),
      ...(parent !== undefined ? { parent } : {}),
      ...(exec.schema !== undefined ? { schema: exec.schema } : {}),
      deferContext(context: UserMessage): void {
        deferredContexts.push(context);
      },
      concludeTurn(this: ToolRunContext): void {
        concludingExecutions.add(this);
      },
    };
    // Chụp finalizer TRƯỚC khi materialize tham số: một getter tham số có thể thay/xoá callback đã
    // đăng ký trong lúc snapshotJsonValue chạy. Phép thu gọn chỉ quyết định callback ĐÃ CHỤP có được
    // giữ: đường huỷ trước phát giữ nó, còn lần từ chối UNKNOWN_TOOL và thất bại tham số của lời gọi
    // bị thu gọn không-huỷ thì bỏ nó (lời gọi không bao giờ thi hành được).
    const capturedFinalizer = visible?.finalizeContent?.bind(visible);
    const capturedProjector = visible?.projectContent?.bind(visible);
    const finalizerFor = (): ToolContentFinalizer | undefined => (collapsed && !signal.aborted ? undefined : capturedFinalizer);
    try {
      const detached = snapshotJsonValue(exec.arguments);
      if (detached === undefined) {
        throw new TypeError("tool execution arguments must be losslessly JSON-serializable");
      }
      const execution: ToolRunContext = { ...base, arguments: deepFreeze(detached) };
      this.deferredContexts.set(execution, deferredContexts);
      this.contentFinalizers.set(execution, finalizerFor());
      if (!collapsed) this.contentProjectors.set(execution, capturedProjector);
      this.cancellationStates.set(execution, {
        callerSignal: signal,
        bodyInvoked: false,
      });
      if (collapsed) {
        // Lời gọi bị từ chối trước pipeline chính sách, nhưng một lần huỷ trước phát vẫn giữ hợp đồng
        // huỷ đã thiết lập (prepare bỏ qua phép kiểm huỷ cho final-result).
        if (signal.aborted) {
          return { kind: "final-result", exec: execution, result: toolAbortedBeforeDispatchResult() };
        }
        // Tên CÓ hiển thị ở đây, nên lần từ chối mang tuyến model phải đi thay thế.
        return {
          kind: "final-result",
          exec: execution,
          result: toolErrorResult(
            new ToolNotFoundError(name, `only \`${RUN_CODE_NAME}\` is callable directly — call \`${name}\` from inside a \`${RUN_CODE_NAME}\` program instead`),
          ),
        };
      }
      return { kind: "ready", exec: execution };
    } catch (error) {
      const execution: ToolRunContext = { ...base, arguments: undefined };
      this.contentFinalizers.set(execution, finalizerFor());
      return { kind: "final-result", exec: execution, result: toolErrorResult(error) };
    }
  }

  /** Chạy pre-execute và guard đơn điệu cho bộ lập lịch. Nhận: input — đầu vào thi hành. Trả: lần thi hành đã chuẩn bị cộng chặng kế. @internal */
  private async prepareScheduledExecution(input: ToolExecutionInput): Promise<ScheduledToolPreparation> {
    return this.prepareExecution(input, (prepared) => prepared);
  }

  /** Chạy cổng pre-execute (và approval cho nhánh ask) rồi guard, quyết định chặng kế. Nhận: input — đầu vào thi hành; next — hàm nối kết quả vào chặng kế của người gọi. Trả: giá trị mà next trả về. */
  private async prepareExecution<T>(input: ToolExecutionInput, next: (prepared: ScheduledToolPreparation) => T): Promise<T> {
    const created = this.createExecution(input);
    if (created.kind !== "ready") return next(created);
    const exec = created.exec;
    if (this.callerCancelled(exec)) {
      return next({ kind: "final-result", exec, result: toolAbortedBeforeDispatchResult() });
    }
    try {
      const carrier = scopeTarget(this, exec.agent);
      const gate = await eventSurfaceOf(this.ctx).waterfall(carrier, "tools/pre-execute", exec, () => Promise.resolve<PreToolDecision>({ kind: "allow" }));
      const askResolution = gate.kind === "ask" ? await this.serviceAsk(exec, gate) : { decision: gate, approvalCancelled: false };
      const { decision } = askResolution;
      if (this.callerCancelled(exec) && askResolution.approvalCancelled) {
        return await next({ kind: "post-result", exec, result: toolAbortedBeforeDispatchResult() });
      }
      if (decision.kind === "cancel") {
        return await next({ kind: "post-result", exec, result: toolAbortedBeforeDispatchResult() });
      }
      const denialReason = decision.kind === "allow" ? this.guardReason(exec) : decision.reason;
      const denialInfo = decision.kind === "deny" ? decision.info : undefined;
      if (denialReason !== undefined) {
        return await next({
          kind: "post-result",
          exec,
          result: this.materializeFinalResult({
            content: [{ type: "text", text: `Error: ${denialReason}` }],
            isError: true,
            error: { message: denialReason, ...(denialInfo === undefined ? {} : { info: denialInfo }) },
          }),
        });
      }
      if (this.callerCancelled(exec)) {
        return await next({ kind: "post-result", exec, result: toolAbortedBeforeDispatchResult() });
      }
      return await next({ kind: "dispatch", exec });
    } catch (error) {
      return next({ kind: "final-result", exec, result: toolErrorResult(error) });
    }
  }

  /** Tín hiệu gốc của người gọi có đang huỷ hay không. Nhận: exec — lần thi hành của registry. Trả: true khi tín hiệu người gọi đã huỷ. @throws {Error} khi thiếu trạng thái huỷ (bất biến bộ lập lịch). */
  private callerCancelled(exec: ToolRunContext): boolean {
    const state = this.cancellationStates.get(exec);
    /* v8 ignore next -- chỉ lần thi hành do registry phát mới tới được các phương thức bộ lập lịch theo chặng */
    if (state === undefined) {
      throw new Error("tool registry scheduler invariant violated: missing cancellation state");
    }
    return state.callerSignal.aborted;
  }

  /** Kết quả huỷ chuẩn tắc, chọn theo việc thân tool đã khởi chạy hay chưa. Nhận: exec — lần thi hành; prior — kết quả trước (nguồn ngữ cảnh), có thể vắng. Trả: kết quả ABORTED hoặc ABORTED_BEFORE_DISPATCH. @throws {Error} khi thiếu trạng thái huỷ. */
  private cancellationResult(exec: ToolRunContext, prior?: ToolExecutionResult): ToolExecutionResult {
    const state = this.cancellationStates.get(exec);
    /* v8 ignore next -- chỉ lần thi hành do registry phát mới tới được các phương thức bộ lập lịch theo chặng */
    if (state === undefined) {
      throw new Error("tool registry scheduler invariant violated: missing cancellation state");
    }
    return state.bodyInvoked ? toolAbortedResult(prior) : toolAbortedBeforeDispatchResult(prior);
  }

  /** Phát thân tool đã đăng ký với tín hiệu gốc của người gọi được gộp lại vào mọi thay thế của around-wrapper. Việc huỷ không bao giờ bỏ rơi thân: promise đã khởi chạy đạt trạng thái tĩnh trước khi kết quả của nó thành ABORTED. Nhận: exec — lần thi hành đã chuẩn bị. Trả: kết quả thành công đã chuẩn hoá, hoặc kết quả lỗi/đã huỷ. @throws {Error} khi thiếu trạng thái huỷ. */
  private async dispatchToolBody(exec: ToolRunContext): Promise<ToolExecutionResult> {
    const state = this.cancellationStates.get(exec);
    /* v8 ignore next -- chỉ lần thi hành do registry phát mới tới được các phương thức bộ lập lịch theo chặng */
    if (state === undefined) {
      throw new Error("tool registry scheduler invariant violated: missing cancellation state");
    }
    const dispatchExec = exec as ToolDispatchExecution;
    const wrapperSignal = dispatchExec.signal;
    const fused = fuseToolSignals(state.callerSignal, wrapperSignal);
    const signal = fused.signal;
    if (isAborted(signal)) {
      fused.dispose();
      return toolAbortedBeforeDispatchResult();
    }
    dispatchExec.signal = signal;
    try {
      const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== undefined);
      if (!tool) throw new ToolNotFoundError(exec.name);
      state.bodyInvoked = true;
      const returned = await tool.execute(exec.arguments, exec);
      const result = this.createSuccessResult(exec, tool, returned);
      return isAborted(signal) ? toolAbortedResult(result) : result;
    } catch (error) {
      return toolErrorResult(error);
    } finally {
      fused.dispose();
      dispatchExec.signal = wrapperSignal;
    }
  }

  /** Chạy around-dispatch và thân tool. Thất bại của tool và của tool không tồn tại vẫn nhận post-execute; thất bại pipeline thì đã là cuối. Nhận: exec — lần thi hành đã chuẩn bị. Trả: kết quả cộng chặng kế (có còn cần post-execute hay không). @internal */
  private async dispatchScheduledExecution(exec: ToolRunContext): Promise<ScheduledToolDispatch> {
    try {
      const mutableExec = exec;
      const carrier = scopeTarget(this, exec.agent);
      const result = await eventSurfaceOf(this.ctx).waterfall(carrier, "tools/execute", mutableExec, () => this.dispatchToolBody(mutableExec));
      const normalized = this.normalizeDispatchResult(exec, result);
      const deferredContexts = this.deferredContexts.get(exec);
      /* v8 ignore next -- chặng phát chỉ nhận lần thi hành do chặng chuẩn bị của registry này phát */
      if (deferredContexts === undefined) {
        throw new Error("tool registry scheduler invariant violated: unprepared execution");
      }
      const withContexts =
        deferredContexts.length === 0
          ? normalized
          : this.markCanonical(exec, {
              ...normalized,
              additionalContexts: [...deferredContexts, ...(normalized.additionalContexts ?? [])],
            });
      return {
        kind: "post-result",
        result: this.callerCancelled(exec) && !withContexts.isError ? this.cancellationResult(exec, withContexts) : withContexts,
      };
    } catch (error) {
      return { kind: "final-result", result: toolErrorResult(error) };
    }
  }

  /** Chạy post-execute có thứ tự, rồi áp phần hoàn thiện nội dung do tool sở hữu, materialize và thông báo kết quả cuối. Nhận: exec — lần thi hành đã chuẩn bị; result — kết quả phát/trước còn cần post-execute. Trả: kết quả cuối đã materialize. @internal */
  private async finalizeScheduledExecution(exec: ToolRunContext, result: ToolExecutionResult): Promise<ToolExecutionResult> {
    try {
      const project = this.contentProjectors.get(exec);
      this.contentProjectors.delete(exec);
      const content = project?.(exec, result);
      const projected = content === undefined ? result : this.markCanonical(exec, this.materializeFinalResult({ ...result, content }));
      const postResult = await this.postExecute(exec, projected);
      return this.finishScheduledExecution(
        exec,
        this.callerCancelled(exec) && !postResult.isError ? this.cancellationResult(exec, postResult) : postResult,
      );
    } catch (error) {
      return this.finishScheduledExecution(exec, toolErrorResult(error));
    }
  }

  /** Materialize ứng viên, áp phần hoàn thiện nội dung do tool sở hữu, rồi materialize và thông báo kết quả có thẩm quyền. Nhận: exec — lần thi hành đã chuẩn bị; result — kết quả cuối. Trả: kết quả cuối đã materialize. @internal */
  private finishScheduledExecution(exec: ToolRunContext, result: ToolExecutionResult): ToolExecutionResult {
    let materializedResult: ToolExecutionResult;
    try {
      materializedResult = this.materializeFinalResult(result);
    } catch (error) {
      materializedResult = this.materializeFinalResult(toolErrorResult(error));
    }
    let finalResult: ToolExecutionResult;
    try {
      finalResult = this.materializeFinalResult(this.applyFinalContent(exec, materializedResult));
    } catch (error) {
      finalResult = this.materializeFinalResult(toolErrorResult(error));
    }
    this.notifyResult(exec, finalResult);
    return finalResult;
  }

  /** Áp phép biến đổi nội dung do tool sở hữu đã chụp mà không lộ trường kết quả nào khác. Nhận: exec — lần thi hành; result — kết quả đã materialize. Trả: kết quả với nội dung thay thế, hoặc chính nó. */
  private applyFinalContent(exec: ToolRunContext, result: ToolExecutionResult): ToolExecutionResult {
    const finalizeContent = this.contentFinalizers.get(exec);
    if (finalizeContent === undefined) return result;
    const content = finalizeContent(exec, result);
    return content === undefined ? result : { ...result, content };
  }

  /** Thông báo observer mà không lộ kênh biến đổi hay kênh lỗi vào kết quả. Nhận: exec — lần thi hành (bị đóng băng tại đây); result — kết quả cuối. Trả: không. */
  private notifyResult(exec: ToolRunContext, result: ToolExecutionResult): void {
    Object.freeze(exec);
    const { name: toolName, callId } = exec;
    const reportFailure = (error: unknown): void => {
      this.ctx.logger.warn(`tool "${toolName}" (${callId}): tools/result observer failed: ${errorMessage(error)}`);
    };
    const callbacks = this.ctx.events.dispatch("emit", [scopeTarget(this, exec.agent), "tools/result", exec, result]);
    for (const callback of callbacks) {
      try {
        const returned = callback(exec, result);
        void Promise.resolve(returned).catch(reportFailure);
      } catch (error) {
        reportFailure(error);
      }
    }
  }

  /** Giải một ask thành allow/deny qua seam approval, tiêu thụ cơ hội bằng ctx.get('approval'): không có ApprovalService thì hạ cấp thành từ chối, và lần thi hành không agent cũng hạ cấp (không session để kiểm toán, không UI để định tuyến). allowed-once đi tiếp; ba trường hợp không cấp đều từ chối với lý do khác nhau. Nhận: exec — lần thi hành cần approval; ask — quyết định ask của waterfall pre-execute. Trả: quyết định cuối và cờ approval bị huỷ. */
  private async serviceAsk(exec: ToolRunContext, ask: Extract<PreToolDecision, { kind: "ask" }>): Promise<ToolAskResolution> {
    const approval = this.ctx.get("approval") as ApprovalService | undefined;
    if (approval === undefined) {
      return {
        decision: { kind: "deny", reason: ask.reason ?? `tool "${exec.name}" requires approval (not yet supported)` },
        approvalCancelled: false,
      };
    }
    const agent = exec.agent;
    if (agent === undefined) {
      return {
        decision: { kind: "deny", reason: `tool "${exec.name}" requires approval, but the call has no agent to route it through` },
        approvalCancelled: false,
      };
    }
    const outcome = await approval.request({
      agent: agent as unknown as Parameters<typeof approval.request>[0]["agent"],
      toolName: exec.name,
      callId: exec.callId,
      ...(ask.reason !== undefined ? { reason: ask.reason } : {}),
      ...(ask.displayReason !== undefined ? { displayReason: ask.displayReason } : {}),
      signal: exec.signal,
    });
    switch (outcome) {
      case "allowed-once":
        return { decision: { kind: "allow" }, approvalCancelled: false };
      case "rejected":
        return { decision: { kind: "deny", reason: `the user rejected tool "${exec.name}"` }, approvalCancelled: false };
      case "cancelled":
        return { decision: { kind: "deny", reason: `approval for tool "${exec.name}" was cancelled` }, approvalCancelled: true };
      case "unavailable":
        return {
          decision: { kind: "deny", reason: `tool "${exec.name}" requires approval, but no approval channel is available` },
          approvalCancelled: false,
        };
      default:
        return assertNever(outcome, "ApprovalOutcome");
    }
  }

  /** Chạy waterfall tools/post-execute và áp quyết định: accept giữ lời gọi thành công (thay content khi được cấp), block biến nó thành isError với nội dung là feedback sửa sai. Mỗi quyết định đều có thể gắn additionalContexts cho FIFO lô đang hoạt động. Ngữ cảnh do thân tool hoãn sống sót qua kết quả được chấp nhận nhưng bị bỏ khi lời gọi ngoài bị chặn. Nhận: exec — lần thi hành; result — kết quả đã chuẩn hoá trước post-execute. Trả: kết quả sau chính sách. @throws {TypeError} khi accept thay CẢ value lẫn content, hoặc thay value của kết quả lỗi. @throws {ToolNotFoundError} khi thay value mà định nghĩa tool không còn giải được. */
  private async postExecute(exec: ToolRunContext, result: Readonly<ToolExecutionResult>): Promise<ToolExecutionResult> {
    const decision = await eventSurfaceOf(this.ctx).waterfall(
      scopeTarget(this, exec.agent),
      "tools/post-execute",
      exec,
      result,
      () => Promise.resolve<PostToolDecision>({ kind: "accept" }),
    );
    const decisionContexts = decision.additionalContexts ?? [];
    if (decision.kind === "block") {
      const message = failureMessageFromContent(decision.feedback);
      return this.markCanonical(exec, {
        content: decision.feedback,
        isError: true,
        error: { message },
        ...(decisionContexts.length > 0 ? { additionalContexts: decisionContexts } : {}),
      });
    }
    if (Object.hasOwn(decision, "content") && Object.hasOwn(decision, "value")) {
      throw new TypeError("tools/post-execute accept decision cannot replace both value and content");
    }
    const additionalContexts = [...(result.additionalContexts ?? []), ...decisionContexts];
    if (Object.hasOwn(decision, "value")) {
      if (result.isError) {
        throw new TypeError("tools/post-execute cannot replace the value of a failed result");
      }
      const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== undefined);
      if (tool === undefined) throw new ToolNotFoundError(exec.name);
      const replaced = this.createSuccessResult(exec, tool, decision.value);
      return this.markCanonical(exec, {
        ...replaced,
        ...(additionalContexts.length > 0 ? { additionalContexts } : {}),
      });
    }
    return this.markCanonical(exec, {
      ...result,
      ...(decision.content !== undefined ? { content: decision.content } : {}),
      ...(additionalContexts.length > 0 ? { additionalContexts } : {}),
    });
  }

  /** Đánh dấu kết quả đã chuẩn hoá là chuẩn tắc chỉ cho lần phát sở hữu nó. Nhận: exec — lần thi hành sở hữu; result — kết quả vừa chuẩn hoá. Trả: chính kết quả đó, đã gắn token. */
  private markCanonical(exec: ToolRunContext, result: ToolExecutionResult): ToolExecutionResult {
    this.canonicalResults.set(result, exec.token);
    return result;
  }

  /** Chụp, validate, render, và (tuỳ chọn) chiếu MỘT giá trị thành công của thân tool. Nhận: exec — lần thi hành; tool — định nghĩa đã thi hành; candidate — giá trị thân tool trả về. Trả: kết quả thành công chuẩn tắc đã materialize. @throws {ToolOutputError} khi giá trị hoặc phép chiếu vi phạm hợp đồng đầu ra. */
  private createSuccessResult(exec: ToolRunContext, tool: ToolDefinition, candidate: unknown): ToolExecutionResult {
    const detached = snapshotToolValue(tool.name, candidate);
    const violations = validateJsonSchemaValue(tool.output.schema, detached, "value");
    if (violations.length > 0) throw new ToolOutputError(tool.name, violations);
    const value = deepFreeze(detached);
    let rendered: ContentBlock[];
    try {
      rendered = tool.output.render(exec.arguments, value);
    } catch (error) {
      throw projectionError(tool.name, "render", error);
    }
    const content = snapshotProjection(tool.name, "render", rendered);
    let meta: JsonValue | undefined;
    if (tool.output.presentationMeta !== undefined) {
      let projected: JsonValue;
      try {
        projected = tool.output.presentationMeta(exec.arguments, value);
      } catch (error) {
        throw projectionError(tool.name, "presentationMeta", error);
      }
      meta = snapshotProjection(tool.name, "presentationMeta", projected);
    }
    const concludesTurn = this.concludingExecutions.has(exec);
    return this.markCanonical(
      exec,
      this.materializeFinalResult({
        isError: false,
        value,
        content,
        ...(meta !== undefined ? { meta } : {}),
        ...(concludesTurn ? { concludesTurn: true } : {}),
      }),
    );
  }

  /** Chuẩn hoá kết quả do wrapper around-dispatch tự soạn qua hợp đồng đầu ra sở hữu nó. Nhận: exec — lần thi hành; result — kết quả wrapper trả về. Trả: kết quả chuẩn tắc của lần thi hành này. @throws {ToolNotFoundError} khi định nghĩa tool không còn giải được. */
  private normalizeDispatchResult(exec: ToolRunContext, result: ToolExecutionResult): ToolExecutionResult {
    if (this.canonicalResults.get(result) === exec.token) return result;
    if (result.isError) {
      return this.markCanonical(exec, {
        isError: true,
        error: result.error,
        content: result.content,
        ...(result.meta !== undefined ? { meta: result.meta } : {}),
        ...(result.additionalContexts !== undefined ? { additionalContexts: result.additionalContexts } : {}),
      });
    }
    const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== undefined);
    if (tool === undefined) throw new ToolNotFoundError(exec.name);
    const normalized = this.createSuccessResult(exec, tool, result.value);
    return this.markCanonical(exec, {
      ...normalized,
      ...(result.additionalContexts !== undefined ? { additionalContexts: result.additionalContexts } : {}),
    });
  }

  /** Materialize kết quả ghi có thẩm quyền đúng một lần, ngay trước tools/result. Nhận: result — kết quả đã chuẩn hoá. Trả: kết quả cuối đã đóng băng, không mất mát. @throws {TypeError} khi phần trình bày không tuần tự hoá JSON không mất mát. */
  private materializeFinalResult(result: ToolExecutionResult): ToolExecutionResult {
    const presentation = {
      content: result.content,
      ...(result.meta !== undefined ? { meta: result.meta } : {}),
      ...(result.additionalContexts !== undefined ? { additionalContexts: result.additionalContexts } : {}),
    };
    if (result.isError) {
      return materializePresentation<ToolExecutionFailure>({ isError: true, error: result.error, ...presentation });
    }
    const detached = materializePresentation<Omit<ToolExecutionSuccess, "value">>({
      isError: false,
      ...presentation,
      ...(result.concludesTurn === true ? { concludesTurn: true } : {}),
    });
    return deepFreeze({ ...detached, value: result.value });
  }
}

export default ToolRuntime;

