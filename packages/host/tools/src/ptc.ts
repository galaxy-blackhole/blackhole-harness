/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Transport `run_code` của chế độ PTC: chương trình của model gọi các tool mà agent NHÌN THẤY qua
 *      những lượt thực thi LỒNG NHAU, xếp lịch theo đúng hợp đồng chạy song song của kernel; mỗi lượt
 *      điều phối con đều được ghi log để dựng lại, còn chỉ kết quả ngoài cùng đã tuyển chọn mới vào lịch
 *      sử model — port 1:1 ptc.js (672 dòng) của @deepseek-ai/dsh-tools.
 */

/*
 * Ghi chú SEAM (ADR 000d — cấm cộng gộp module):
 * · Bản gốc cộng gộp `MessageSourceMap` của @deepseek-ai/dsh-llm để khai nguồn `ptc-mode`; gói này
 *   KHÔNG cộng gộp, nên nguồn đó đi qua MỘT phép ép kiểu tại đúng chỗ tạo thông điệp.
 * · Bản gốc cộng gộp `SessionEventMap` của @deepseek-ai/dsh-session để khai hai event log
 *   `tool/ptc-dispatch-start` / `tool/ptc-dispatch`; gói này khai chúng bằng mặt cắt CẤU TRÚC
 *   (`PtcLogSession`) và dùng nguyên thân dữ liệu từ `./types.ts`.
 */

import { symbols } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import { brandString } from "@deepseek-ai/dsh-brand";
import { createUserMessage, HarnessError } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, ToolSchema } from "@deepseek-ai/dsh-llm";
import type { ToolCallId } from "@deepseek-ai/dsh-llm/brand";
import { approveEscalation, ESCALATION_TARGETS, validateEscalationArgs } from "@deepseek-ai/dsh-sandbox";
import type { SandboxExecutionPolicy } from "@deepseek-ai/dsh-sandbox";
import type { PtcBindingFunction, PtcJsonValue, PtcRunResult, PtcRuntime } from "@deepseek-ai/dsh-ptc-runtime";
import type { ApprovalService } from "@deepseek-ai/dsh-user-approval";
import { deepFreeze, snapshotJsonValue } from "@deepseek-ai/dsh-util-values";
import type { JsonValue } from "@deepseek-ai/dsh-util-values";
import { defineTool, parameterSchemaSpecToJsonSchema } from "./schema.ts";
import type { ParameterSchemaSpec } from "./schema.ts";
import { PtcCalls } from "./ptc-calls.ts";
// Vì sao lấy hằng số từ nơi ĐỊNH NGHĨA thay vì từ barrel `./index.ts` như bản gốc: `index.ts` chỉ tái xuất
// `service.ts`, mà `service.ts` lại import ngược `./ptc.ts` (đúng vòng lặp của bản gốc khi còn ở dạng
// bundle). Ở dạng MỘT-TỆP của gói này, vòng lặp đó khiến `service.ts` đọc `RUN_CODE_NAME` ngay lúc khởi
// tạo module, trước khi `ptc.ts` kịp khởi tạo ⇒ TDZ cho bất kỳ ai import thẳng `ptc.ts`. Hằng số được
// ĐỊNH NGHĨA ở `./service-support.ts` và tái xuất NGUYÊN VẸN qua `service.ts`/`index.ts`, nên lấy từ
// nơi định nghĩa là CÙNG một biểu tượng (cùng identity) — không đổi hành vi, chỉ cắt một cạnh vòng lặp.
import { TOOL_RUNTIME_SCHEDULER } from "./service-support.ts";
import type { PtcDispatchLog, ToolDefinition, ToolExecutionResult, ToolRunContext, ToolRuntime } from "./index.ts";
import type { PtcDispatchEventData, PtcDispatchStartEventData } from "./types.ts";

/** Tên tool chế độ PTC mà model nhìn thấy. */
export const RUN_CODE_NAME = "run_code";

/**
 * Các ngôn ngữ mà chế độ PTC có phần trình bày. Hai bảng theo ngôn ngữ — `RUN_CODE_FLAVORS` ở đây và
 * `SDK_RENDERERS` trong `./index.ts` — đều được kiểm với `satisfies` trên hợp này, nên thêm một ngôn
 * ngữ vào bảng này mà quên bảng kia sẽ đỏ `typecheck` ngay, thay vì chờ runtime báo.
 * Nhận: không (kiểu chỉ mô tả hình dạng).
 * Trả: hợp hai giá trị chuỗi `"typescript"` và `"python"`.
 */
export type PtcSdkLanguage = "typescript" | "python";

/** Mô tả `run_code` theo MỘT ngôn ngữ của runtime. */
interface RunCodeFlavor {
  /** Mô tả tool mà model đọc. */
  readonly description: string;
  /** Mô tả tham số `code` mà model đọc. */
  readonly codeDescription: string;
}

/**
 * Giữ luật gọi tool tại đây; runtime sở hữu cú pháp đánh giá và việc giữ trạng thái.
 * Nhận: `language` — tên ngôn ngữ HIỂN THỊ ("TypeScript" hoặc "Python").
 * Trả: cặp mô tả tool và mô tả tham số `code` của ngôn ngữ đó.
 */
function runCodeFlavor(language: string): RunCodeFlavor {
  return {
    description: `Execute a ${language} program against the available tools. Takes two required arguments: `
      + "`description`, a short summary of what the program does, and `code`, the program to execute. "
      + "Call tools as `await tools.name(args)` per the declarations in the system prompt. "
      + "Curate the program output. Image-bearing subtool results are attached after the run.",
    codeDescription: `The ${language} program to execute, following this tool's execution instructions.`,
  };
}
const TYPESCRIPT_FLAVOR = runCodeFlavor("TypeScript");
const PYTHON_FLAVOR = runCodeFlavor("Python");

/** Bảng hương vị `run_code` theo từng ngôn ngữ (xem {@link RunCodeFlavor}); một mục cho mỗi {@link PtcSdkLanguage}. */
const RUN_CODE_FLAVORS: Record<string, RunCodeFlavor> = {
  typescript: TYPESCRIPT_FLAVOR,
  python: PYTHON_FLAVOR,
} satisfies Record<PtcSdkLanguage, RunCodeFlavor>;

/**
 * Mô tả tham số `description` mà model đọc: độc lập ngôn ngữ (hợp đồng nhãn UI giống nhau cho mọi
 * runtime), dùng chung giữa spec tĩnh và getter `parameters` biết ngôn ngữ, để hai lần phát không thể lệch.
 */
const RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION = "Clear, concise description of what this program does in active voice, "
  + "5-10 words (shown in the UI). Provide `description` before `code` in the arguments. "
  + "Examples: \"Count TODO markers across packages\"; "
  + "\"Read failing test and its fixture\"; \"Rename config key in every cordis.yml\".";

/** Ba tham số điều khiển dùng chung của `run_code`. */
const RUN_CODE_CONTROLS = {
  timeoutMs: { type: "number", description: "Positive elapsed-time budget in milliseconds, capped by the deployment maximum." },
  sandbox_permissions: { type: "string", enum: [...ESCALATION_TARGETS], description: "Wider sandbox mode for this complete program execution; requires justification and approval." },
  justification: { type: "string", description: "Reason this complete program needs wider access, shown to the user for approval. Use the language of the user’s current request." },
} as const satisfies ParameterSchemaSpec;

/**
 * Tham số điều khiển của runtime đang gắn, hoặc bộ tĩnh khi chưa có runtime.
 * Nhận: `runtime` — runtime PTC đang gắn, hoặc `undefined` khi chưa gắn.
 * Trả: spec tham số; mô tả `timeoutMs` chỉ xuất hiện khi runtime khai ngân sách thời gian, và cặp
 *   `sandbox_permissions`/`justification` chỉ xuất hiện khi runtime khai chế độ sandbox.
 */
function controlParameters(runtime: PtcRuntime | undefined): ParameterSchemaSpec {
  // Người đọc danh mục không có runtime đang gắn; việc lắp model thật thì bắt buộc phải có.
  if (runtime === undefined) return RUN_CODE_CONTROLS;
  return {
    ...runtime.timeout === undefined ? {} : {
      timeoutMs: { ...RUN_CODE_CONTROLS.timeoutMs,
        description: `Positive elapsed-time budget in milliseconds, including nested tool and approval waits. Default ${runtime.timeout.defaultMs}; capped at ${runtime.timeout.maxMs}. Zero does not disable the deadline.` },
    },
    ...runtime.sandboxMode === undefined ? {} : {
      sandbox_permissions: RUN_CODE_CONTROLS.sandbox_permissions,
      justification: RUN_CODE_CONTROLS.justification,
    },
  };
}

/**
 * Câu hướng dẫn leo thang sandbox, chỉ khi runtime có khai chế độ sandbox.
 * Nhận: `runtime` — runtime PTC đang gắn, hoặc `undefined`.
 * Trả: chuỗi rỗng khi không có chế độ sandbox; ngược lại là câu tiếng Anh cố định của bản gốc.
 */
function escalationGuidance(runtime: PtcRuntime | undefined): string {
  return runtime?.sandboxMode === undefined ? ""
    : " A sandbox escalation approves this complete program for one execution only. Nested tools retain their own policies and approvals. Request wider access only after evidence of a denial. Earlier effects may already have completed: inspect them before explicitly retrying. Programs are never replayed automatically.";
}

/**
 * Chọn {@link RunCodeFlavor} cho ngôn ngữ của runtime đang nạp, đọc TẠI THỜI ĐIỂM phát schema để schema
 * `run_code` mà model thấy luôn khớp ngôn ngữ của mục SDK. `peekRuntime` trả `undefined` chỉ khi không
 * có runtime nào gắn — đường đó đi qua trình đọc định nghĩa và `schemas()`, mà bản duy nhất đang ship là
 * bản gom doc-catalog (không nuôi model nào, vì `wireSchemas` gọi `requirePtcRuntime` trước khi chiếu),
 * nên đường đó lùi về {@link TYPESCRIPT_FLAVOR}. Runtime đã gắn mà ngôn ngữ không có mục trong bảng thì
 * NÉM LỖI ỒN ÀO, đúng như `requirePtcRuntime` từ chối lúc lắp.
 * Nhận: `peekRuntime` — hàm đọc `ctx.ptcRuntime` không ném.
 * Trả: hương vị của ngôn ngữ runtime báo, hoặc hương vị TypeScript khi chưa có runtime.
 * @throws {Error} khi ngôn ngữ của runtime không có hương vị `run_code` đã đăng ký.
 */
function resolveFlavor(peekRuntime: () => PtcRuntime | undefined): RunCodeFlavor {
  const runtime = peekRuntime();
  if (runtime === undefined) {
    // Chưa gắn runtime: chỉ trình đọc định nghĩa và `schemas()` tới được đây, mà bản duy nhất đang ship
    // là bản gom doc-catalog; không bản nào nuôi model. Lùi về mặc định TS.
    return TYPESCRIPT_FLAVOR;
  }
  // Đọc thuộc tính OWN: một ngôn ngữ như `toString`/`constructor` sẽ không thể lấy thành viên thừa kế
  // của Object.prototype làm hương vị.
  const flavor = RUN_CODE_FLAVORS[runtime.language];
  if (!Object.hasOwn(RUN_CODE_FLAVORS, runtime.language) || flavor === undefined) {
    const known = Object.keys(RUN_CODE_FLAVORS).map((name) => JSON.stringify(name)).join(", ");
    throw new Error(`dsh-tools: no run_code schema flavor registered for runtime language ${JSON.stringify(runtime.language)} (known: ${known})`);
  }
  return flavor;
}

/**
 * Được `run_code` ném khi CHÍNH chương trình chạy thất bại — chương trình ném lỗi, hết ngân sách thời
 * gian, bị huỷ, hoặc substrate chết. Kế thừa {@link HarnessError} (`code: 'CODE_RUN_FAILED'`); đường ống
 * thực thi của sổ tool biến nó thành kết quả `isError` có cấu trúc, chữ mang loại thất bại cộng log đã
 * bắt, để model tự sửa.
 * Nhận: `message` — mô tả thất bại.
 * Trả: không (lớp).
 */
export class CodeRunFailedError extends HarnessError {
  /**
   * Dựng lỗi thất bại chương trình với mã máy cố định `CODE_RUN_FAILED`.
   * Nhận: `message` — mô tả thất bại.
   * Trả: không.
   */
  constructor(message: string) {
    super(message, "CODE_RUN_FAILED");
    this.name = "CodeRunFailedError";
  }
}

/**
 * Chụp tham số của MỘT lời gọi binding thành JSON không mất mát, rồi chụp lại giá trị đã tách đó một lần
 * nữa để phần điều phối và phần ghi log độc lập nhau mà không kéo lại giới hạn lồng nhau đặc thù nền
 * tảng của structured-clone.
 * Nhận: `value` — tham số thô do chương trình truyền, chưa tin cậy.
 * Trả: `{ dispatched, logged }` — hai bản JSON không mất mát ĐỘC LẬP (bản gửi tool, bản ghi log).
 * @throws {Error} khi tham số không phải JSON không mất mát, hoặc không tách được cho log bền.
 */
function jsonNormalizeArgs(value: unknown): { dispatched: JsonValue; logged: JsonValue } {
  let snapshot: JsonValue | undefined;
  try {
    // `snapshotJsonValue<T>` giữ nguyên `T`; với đầu vào `unknown` nó trả `unknown`, nên ép về
    // `JsonValue` đúng hợp đồng đã kiểm (hàm đã xác thực JSON không mất mát trước khi trả).
    snapshot = snapshotJsonValue(value) as JsonValue | undefined;
  } catch (error) {
    throw new Error(`tool arguments must be lossless JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (snapshot === undefined) {
    throw new Error("tool arguments must be lossless JSON (call the tool with an arguments object, e.g. `{}`)");
  }
  const logged = snapshotJsonValue(snapshot);
  /* v8 ignore next -- snapshot is already a detached lossless JSON value. */
  if (logged === undefined) {
    throw new Error("tool arguments could not be detached for durable logging");
  }
  return { dispatched: snapshot, logged };
}

/** Trình bày JSON hai dấu cách, khớp hợp đồng chữ `run_code` nông hiện có. */
const JSON_INDENT = "  ";

/**
 * ECMAScript chặn chuỗi `space` của `JSON.stringify` ở mười ký tự. Bộ dựng này cũng chặn TỔNG mức thụt
 * lề ở đó, nén các cây con sâu hơn, nên đầu ra đã định dạng vẫn tuyến tính theo kích thước JSON chuẩn.
 */
const MAX_JSON_INDENT_CHARS = 10;

/** Một việc còn treo trên ngăn xếp của {@link renderJsonValue}: hoặc một giá trị cần dựng, hoặc chữ đã sẵn. */
type RenderTask =
  | { readonly kind: "value"; readonly value: JsonValue; readonly depth: number; readonly compact: boolean }
  | { readonly kind: "text"; readonly text: string };

/**
 * Dựng MỘT gốc JSON không phải chuỗi mà không duyệt đệ quy và không để thụt lề phình vô hạn.
 * Nhận: `value` — giá trị JSON không mất mát cần dựng.
 * Trả: chuỗi JSON đã định dạng (hai dấu cách, nén dần khi vượt trần thụt lề).
 * @throws {Error} khi gặp mảng thưa, thiếu khoá, hoặc thuộc tính `undefined` (ngoài hợp đồng JsonValue).
 */
function renderJsonValue(value: JsonValue): string {
  const chunks: string[] = [];
  const tasks: RenderTask[] = [{ kind: "value", value, depth: 0, compact: false }];
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    if (task.kind === "text") {
      chunks.push(task.text);
      continue;
    }
    const current = task.value;
    if (current === null || typeof current === "boolean" || typeof current === "number") {
      chunks.push(String(current));
      continue;
    }
    if (typeof current === "string") {
      chunks.push(JSON.stringify(current));
      continue;
    }
    const compact = task.compact || (task.depth + 1) * JSON_INDENT.length > MAX_JSON_INDENT_CHARS;
    const childDepth = task.depth + 1;
    if (Array.isArray(current)) {
      chunks.push("[");
      if (current.length === 0) {
        chunks.push("]");
        continue;
      }
      tasks.push({ kind: "text", text: compact ? "]" : `\n${JSON_INDENT.repeat(task.depth)}]` });
      for (let index = current.length - 1; index >= 0; index--) {
        const item = current[index];
        /* v8 ignore next -- canonical JsonValue arrays are dense. */
        if (item === undefined) throw new Error("cannot render a sparse JSON array");
        tasks.push({ kind: "value", value: item, depth: childDepth, compact });
        tasks.push({
          kind: "text",
          text: compact
            ? index === 0 ? "" : ","
            : `${index === 0 ? "\n" : ",\n"}${JSON_INDENT.repeat(childDepth)}`,
        });
      }
      continue;
    }
    const keys = Object.keys(current);
    chunks.push("{");
    if (keys.length === 0) {
      chunks.push("}");
      continue;
    }
    tasks.push({ kind: "text", text: compact ? "}" : `\n${JSON_INDENT.repeat(task.depth)}}` });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      /* v8 ignore next -- the loop is bounded by the captured key count. */
      if (key === undefined) throw new Error("cannot render a missing JSON object key");
      const item = current[key];
      /* v8 ignore next -- canonical JsonValue records contain no undefined properties. */
      if (item === undefined) throw new Error("cannot render an undefined JSON object property");
      tasks.push({ kind: "value", value: item, depth: childDepth, compact });
      tasks.push({
        kind: "text",
        text: compact
          ? `${index === 0 ? "" : ","}${JSON.stringify(key)}:`
          : `${index === 0 ? "\n" : ",\n"}${JSON_INDENT.repeat(childDepth)}${JSON.stringify(key)}: `,
      });
    }
  }
  return chunks.join("");
}

/**
 * Dựng MỘT giá trị hoàn tất đang có của chương trình thành chữ kết quả hướng model.
 * Nhận: `value` — giá trị JSON không mất mát.
 * Trả: chính chuỗi đó nếu là chuỗi; ngược lại là JSON đã định dạng.
 */
function renderValue(value: JsonValue): string {
  return typeof value === "string" ? value : renderJsonValue(value);
}

/** Chế độ xếp lịch của một lời gọi đang chờ: `parallel` được chồng lấn, `exclusive` chạy một mình. */
type DispatchMode = "parallel" | "exclusive";

/** Kết quả một lượt điều phối con, dưới dạng mà chương trình nhận: giá trị, hoặc thông điệp lỗi. */
type BindingOutcome =
  | { readonly isError: false; readonly value: JsonValue }
  | { readonly isError: true; readonly message: string };

/** Kết quả đã đỗ của một lượt điều phối, chờ được chốt theo đúng thứ tự nộp. */
interface ParkedDispatch {
  /** Chặng còn lại: `post-result` vẫn qua post-execute; `final-result` bỏ qua nó. */
  readonly kind: "post-result" | "final-result";
  /** Ngữ cảnh thực thi của lượt điều phối. */
  readonly exec: ToolRunContext;
  /** Kết quả chuẩn hoá của lượt điều phối. */
  readonly result: ToolExecutionResult;
}

/** Một lượt điều phối con đã xếp hàng trong làn duy nhất của một chương trình `run_code`. */
interface PendingDispatch {
  /** Công việc thân đang chạy; đổi từ `Promise.resolve()` sang lượt chạy thật khi bắt đầu. */
  flight: Promise<void>;
  /** Đã đỗ kết quả hay chưa (kết quả nằm trong biến `parked` của lần nộp). */
  settled: boolean;
  /** Chế độ đã phân loại LÚC BẮT ĐẦU; chưa có trước khi lượt điều phối được cấp chỗ. */
  mode?: DispatchMode;
  /** Đọc lại chế độ theo góc nhìn agent của lần chạy (đóng cửa khi không khai). */
  classify(): DispatchMode;
  /** Bỏ lượt điều phối còn xếp hàng mà không chạy (từ chối lời gọi binding). */
  abandon(): void;
  /** Ghi event bắt đầu, chạy pre-execute có thứ tự, rồi phóng thân. */
  start(): Promise<void>;
  /** Chốt kết quả đã đỗ theo thứ tự nộp, rồi phát nó cho chương trình. */
  commit(): Promise<void>;
}

/**
 * Mặt cắt CẤU TRÚC của `Session` mà cầu PTC cần: đúng một khả năng, ghi event log.
 * Nhận: `type` — tên event; `data` — thân event.
 * Trả: hình dạng chỉ-kiểu; không có giá trị lúc chạy.
 */
interface PtcLogSession {
  /** Ghi một event vào log của phiên. */
  append(type: string, data: unknown): unknown;
}

/**
 * Đọc service GỐC mà một lớp bọc cordis đang giữ, qua `symbols.original`.
 * Nhận: `service` — service đã có thể bị cordis bọc nhiều lớp.
 * Trả: service gốc, hoặc `undefined` khi chính nó là gốc.
 */
function originalServiceOf(service: PtcRuntime): PtcRuntime | undefined {
  return (service as unknown as { readonly [key: symbol]: PtcRuntime | undefined })[symbols.original];
}

/**
 * Năng lực RIÊNG của sổ đăng ký mà cầu nối nhận lúc dựng — đúng lối `requireRuntime`: thao tác chỉ sổ
 * sở hữu mới tạo được thì nằm ngoài API service công khai và chảy vào đây dưới dạng closure.
 */
export interface RunCodeBridgeOptions {
  /** Chốp thư mục hiện tại của Phiên đang gọi TRƯỚC khi tạo chương trình. */
  readonly resolveWorkingDirectory: (exec: ToolRunContext) => Promise<string | undefined>;
  /** Đọc kênh phê duyệt khi chương trình xin chế độ sandbox rộng hơn. */
  readonly peekApprover: () => ApprovalService | undefined;
  /** Chốt quyền đang đứng của Phiên, chỉ với runtime có cưỡng chế chính sách tệp. */
  readonly resolveSandboxPolicy: (exec: ToolRunContext) => SandboxExecutionPolicy;
  /** Đọc `ctx.ptcRuntime` hoặc ném lỗi cấu hình ồn ào (dùng chung với phép kiểm lúc lắp của sổ). */
  readonly requireRuntime: () => PtcRuntime;
  /**
   * Đọc `ctx.ptcRuntime` KHÔNG ném: `undefined` khi chưa gắn runtime. Để việc phát schema phân biệt
   * "không có runtime" (lùi về TS; đường tới đây là của {@link resolveFlavor}) với "ngôn ngữ lạ" (ném ồn).
   */
  readonly peekRuntime: () => PtcRuntime | undefined;
  /** Trần chồng lấn của lần chạy cho các lời gọi con xếp loại song song (sổ truyền `maxParallelSubCalls` đã kiểm). */
  readonly maxParallel: number;
  /** Chạy waterfall `tools/ptc-dispatch-log` có bao bọc trên MỘT lượt điều phối đã kết thúc (bộ gọi riêng của sổ). */
  readonly shapeDispatchLog: (dispatch: PtcDispatchLog) => Promise<ContentBlock[]>;
}

/**
 * Dựng {@link ToolDefinition} của `run_code`: hai tham số bắt buộc `description` và `code`, chạy qua
 * cầu nối điều phối mô tả ở trên. Sổ đăng ký giữ nó như hạ tầng trình bày dưới các chế độ không-native,
 * nằm ngoài hai lớp năng lực toàn cục/theo scope có thể lọc.
 * Nhận: `registry` — sổ đang sở hữu (lời gọi con đi qua `execute` của nó, binding phủ các tool đã đăng
 *   ký của nó); `options` — các năng lực riêng của sổ mô tả ở trên; `ctx` — ngữ cảnh của sổ sở hữu,
 *   độc lập với Agent đang gọi.
 * Trả: định nghĩa sẵn sàng đăng ký vào sổ.
 * @throws {Error} khi mô tả rỗng, hoặc khi chương trình chạy thất bại ({@link CodeRunFailedError}), hoặc
 *   khi tham số leo thang sandbox không hợp lệ.
 */
export function createRunCodeTool(registry: ToolRuntime, options: RunCodeBridgeOptions, ctx: Context): ToolDefinition {
  const { requireRuntime, peekRuntime, maxParallel, shapeDispatchLog } = options;
  const stateOwners = new WeakMap<object, WeakSet<object>>();
  const calls = new PtcCalls(ctx);
  const definition = defineTool({
    name: RUN_CODE_NAME,
    // Mô tả và mô tả tham số `code` ở đây chỉ là CHỖ GIỮ CHỖ: hai getter biết ngôn ngữ cài bên dưới thay
    // cả hai, chọn hương vị của runtime đang nạp lúc phát schema, để schema MODEL thấy khớp ngôn ngữ của
    // mục SDK. VIỆC KIỂM đối số vẫn bám spec tĩnh này (defineTool đóng kín trên nó) — spec này độc lập
    // ngôn ngữ (một `code` chuỗi bắt buộc).
    description: TYPESCRIPT_FLAVOR.description,
    parameters: {
      description: {
        type: "string",
        required: true,
        description: RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION,
      },
      code: { type: "string", required: true, description: TYPESCRIPT_FLAVOR.codeDescription },
      ...RUN_CODE_CONTROLS,
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          logs: { type: "array", required: true, items: { type: "string" } },
          result: { type: "json" },
          sandbox: {
            type: "object",
            additionalProperties: false,
            properties: {
              mode: { type: "string", required: true, enum: ["read-only", "workspace-write", "danger-full-access"] },
              denied: { type: "boolean", required: true },
              enforcement: { type: "string", enum: ["full", "partial"] },
            },
          },
        },
      },
      render: (_args, value) => {
        const rendered = value.result === undefined ? "" : renderValue(value.result);
        const parts = [value.logs.join("\n"), rendered].filter((part) => part.length > 0);
        if (value.sandbox?.enforcement === "partial") parts.push("File sandbox enforcement is partial on this host.");
        if (value.sandbox?.denied) {
          parts.push(`The ${value.sandbox.mode} file sandbox denied an operation.${escalationGuidance(peekRuntime())}`);
        }
        return [{ type: "text", text: parts.length > 0 ? parts.join("\n") : "(run_code completed with no output)" }];
      },
    },
    async execute(args, exec) {
      if (args.description.trim().length === 0) {
        throw new Error("invalid description: expected a non-empty string");
      }
      const runtime = requireRuntime();
      const run = async (callSignal: AbortSignal) => {
        validateEscalationArgs(args.sandbox_permissions, args.justification);
        if (args.timeoutMs !== undefined && runtime.timeout === undefined) {
          throw new Error("timeoutMs is not available for this PTC runtime");
        }
        if (args.timeoutMs !== undefined && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) {
          throw new Error("invalid timeoutMs: expected a positive finite number");
        }
        const standingPolicy = runtime.sandboxMode === undefined ? undefined : options.resolveSandboxPolicy(exec);
        let policy = standingPolicy;
        if (args.sandbox_permissions !== undefined && args.justification !== undefined) {
          if (standingPolicy === undefined) {
            throw new Error("sandbox_permissions is not available for this PTC runtime");
          }
          const approvedMode = await approveEscalation({
            requestedMode: args.sandbox_permissions,
            justification: args.justification,
            effectiveMode: standingPolicy.mode,
            subject: "program",
          }, {
            // Seam approval cua kernel nhan `Agent` cua no; `exec.agent` la `Agent` cua goi GBH (cung hinh dang runtime) => ep tai bien.
            approver: options.peekApprover(), agent: exec.agent as unknown as never, callId: exec.callId,
            toolName: RUN_CODE_NAME, signal: callSignal,
          });
          policy = { ...standingPolicy, mode: approvedMode };
        }
        const cwd = await options.resolveWorkingDirectory({ ...exec, signal: callSignal });
        callSignal.throwIfAborted();
        // Phạm vi huỷ của LẦN CHẠY: đi theo tín hiệu ngoài vào, và bắn khi lần chạy kết thúc vì BẤT KỲ lý do
        // gì, để một lượt điều phối con đang bay bị huỷ (executor của nó giết theo tín hiệu này) thay vì bị
        // bỏ mồ côi, và các lượt còn xếp hàng chưa chạy thì bị bỏ.
        const runController = new AbortController();
        const onOuterAbort = (): void => { runController.abort(callSignal.reason); };
        callSignal.addEventListener("abort", onOuterAbort, { once: true });
        let dispatches = 0;
        const pendingQueue: PendingDispatch[] = [];
        const inFlight = new Set<Promise<void>>();
        /** Việc phụ của sự kiện kết thúc có được theo dõi (listener nội dung log + append), rút cạn lúc chạy xong. */
        const logWork = new Set<Promise<void>>();
        const commitQueue: PendingDispatch[] = [];
        let exclusiveActive = false;
        let driving = false;
        let driverRun: Promise<void> = Promise.resolve();
        let wake: ((value?: void) => void) | undefined;
        const wakeup = (): void => {
          const release = wake;
          wake = undefined;
          release?.();
        };
        /**
         * Làn DUY NHẤT có thứ tự. Mỗi vòng chốt lượt điều phối đã đỗ ở đầu hàng (post-execute có thứ tự),
         * rồi khởi động mục kế tiếp trong hàng nếu còn chỗ (pre-execute có thứ tự), ngược lại ngủ tới khi
         * một thân kết thúc hoặc có lần nộp mới. Một lần chạy tới trạng thái hàng đợi rỗng/bể rỗng là tĩnh lặng.
         */
        const drive = (): Promise<void> => {
          if (driving) return driverRun;
          driving = true;
          driverRun = (async () => {
            try {
              for (;;) {
                // Tạo lời hứa đánh thức TRƯỚC khi xét trạng thái, để một lần kết thúc hay lần nộp tới giữa
                // các phép kiểm và phép await bên dưới không bị mất.
                const signal = new Promise<void>((resolve) => { wake = resolve; });
                const commitHead = commitQueue[0];
                if (commitHead !== undefined && commitHead.settled) {
                  commitQueue.shift();
                  await commitHead.commit();
                  // Rào chắn phủ cả post-execute: các lần khởi động sau chờ trọn đường ống của lời gọi
                  // độc quyền, đúng như vòng lặp native.
                  if (commitHead.mode === "exclusive") exclusiveActive = false;
                  continue;
                }
                const head = pendingQueue[0];
                if (head !== undefined) {
                  if (runController.signal.aborted) {
                    pendingQueue.shift();
                    head.abandon();
                    continue;
                  }
                  // Phân loại lại LÚC KHỞI ĐỘNG (đóng cửa khi sổ đổi).
                  const mode = head.classify();
                  const capacity = !exclusiveActive
                    && (mode === "exclusive" ? inFlight.size === 0 : inFlight.size < maxParallel);
                  if (capacity) {
                    if (mode === "exclusive") exclusiveActive = true;
                    head.mode = mode;
                    pendingQueue.shift();
                    // Nối vào trước khi start() để con trỏ chốt thấy thứ tự nộp; không gì chốt nó cho tới
                    // khi `settled` lật.
                    commitQueue.push(head);
                    await head.start();
                    const flight = head.flight.finally(() => {
                      inFlight.delete(flight);
                      wakeup();
                    });
                    inFlight.add(flight);
                    continue;
                  }
                }
                if (pendingQueue.length === 0 && commitQueue.length === 0 && inFlight.size === 0) return;
                await signal;
              }
            } finally {
              driving = false;
              wake = undefined;
            }
          })();
          return driverRun;
        };
        /** MỌI lượt điều phối đã kết thúc VÀ đã chốt; không gì có thể khởi động (lần chạy đã bị huỷ lúc gọi). */
        const drainDispatches = async (): Promise<void> => {
          // Cú huỷ đã bắn: bộ lái bỏ các mục còn xếp hàng chưa chạy, chờ bể đang sống, và rút cạn làn chốt
          // có thứ tự — kể cả một lần chốt đang chạy dở khi chương trình vừa trả về.
          await drive();
          // Mọi sự kiện kết thúc đều được append BÊN TRONG lượt `run_code` còn mở (task tự gỡ khi xong).
          while (logWork.size > 0) await Promise.allSettled([...logWork]);
        };
        // Đọc qua một lời gọi, không đọc thuộc tính trần: trạng thái huỷ THẬT SỰ đổi qua các await, và một
        // phép kiểm `.aborted` trực tiếp sau đó sẽ bị phân tích luồng điều khiển thu hẹp mất.
        const runOver = (): boolean => runController.signal.aborted;
        const binding = (schema: ToolSchema) => async (rawArgs: unknown): Promise<PtcJsonValue> => {
          const { name } = schema;
          if (runOver()) {
            throw new Error(`run_code run is over (${String(runController.signal.reason)}); ${name} not dispatched`);
          }
          const normalized = jsonNormalizeArgs(rawArgs);
          const n = ++dispatches;
          const subCallId = brandString<ToolCallId>(`${String(exec.callId)}:ptc:${n}`);
          const input = {
            callId: subCallId,
            rootCallId: exec.rootCallId,
            name,
            schema,
            arguments: normalized.dispatched,
            ...exec.agent ? { agent: exec.agent } : {},
            parent: exec.token,
            signal: runController.signal,
          };
          const scheduler = registry[TOOL_RUNTIME_SCHEDULER];
          const outcome = await new Promise<BindingOutcome>((resolve, reject) => {
            // Do chặng điều phối đặt (hoặc start() với kết quả đã đỗ sẵn): thứ commit() hoàn tất theo thứ tự nộp.
            let parked: ParkedDispatch | undefined;
            const settle = (result: ToolExecutionResult): void => {
              // Chương trình nhận giá trị NGAY: listener nội dung log (ví dụ backend tràn tệp) không bao giờ
              // được làm chậm binding hay chiếm chỗ điều phối. Việc append event là side work có theo dõi;
              // lúc chạy xong, logWork được rút cạn nên mọi sự kiện kết thúc vẫn được append trong lượt còn
              // mở (shapeDispatchLog có bao bọc, nên chuỗi này không thể reject).
              resolve(result.isError
                ? { isError: true, message: result.error.message }
                : { isError: false, value: result.value });
              const agent = exec.agent;
              if (agent === undefined) return;
              const task = (async () => {
                // Listener có thể thay bản bền bằng bản xem trước + con trỏ; giá trị chương trình và kết
                // quả model thấy không bị đụng.
                const logged = await shapeDispatchLog({
                  exec, agent, subCallId, name, isError: result.isError,
                  // Sổ đã đóng băng sâu phép chiếu này lúc chốt kết quả; append chụp lại bản cuối một lần
                  // nữa, nên log vẫn tách rời.
                  content: result.content,
                });
                (agent.session as unknown as PtcLogSession).append("tool/ptc-dispatch", {
                  rootCallId: exec.rootCallId,
                  parentCallId: exec.callId,
                  subCallId,
                  name,
                  // Bản phân tích ANH EM của giá trị đã điều phối: JSON giống từng byte, nhưng là object
                  // riêng — một tool có sửa tham số của nó cũng không làm lệch bản ghi này với thứ nó
                  // thật sự nhận.
                  arguments: normalized.logged,
                  isError: result.isError,
                  ...result.error?.info === undefined ? {} : { error: result.error.info },
                  content: logged,
                  ...result.meta === undefined ? {} : { meta: result.meta },
                } satisfies PtcDispatchEventData);
              })().finally(() => { logWork.delete(task); });
              logWork.add(task);
            };
            pendingQueue.push({
              flight: Promise.resolve(),
              settled: false,
              // Đọc lại mỗi vòng lái theo đúng góc nhìn agent mà SDK đã khai; đóng cửa độc quyền khi
              // không khai/không hợp lệ.
              classify: () => registry.executionMode(input).kind,
              abandon: () => {
                reject(new Error(`run_code run is over (${String(runController.signal.reason)}); ${name} tool call abandoned`));
              },
              async start() {
                const session = exec.agent?.session as unknown as PtcLogSession | undefined;
                session?.append("tool/ptc-dispatch-start", {
                  rootCallId: exec.rootCallId,
                  parentCallId: exec.callId,
                  subCallId,
                  name,
                  arguments: normalized.logged,
                } satisfies PtcDispatchStartEventData);
                // Prepare có thứ tự chạy BÊN TRONG làn lái: pre-execute của mục kế tiếp chờ lần giải này,
                // đúng như bộ xếp lịch native. Chỉ thân được phóng bên dưới mới chồng lấn.
                const prepared = await scheduler.prepare(input);
                if (prepared.kind === "dispatch") {
                  this.flight = scheduler.dispatch(prepared.exec).then((dispatchOutcome) => {
                    parked = { kind: dispatchOutcome.kind, exec: prepared.exec, result: dispatchOutcome.result };
                    this.settled = true;
                  });
                  return;
                }
                parked = { kind: prepared.kind, exec: prepared.exec, result: prepared.result };
                this.settled = true;
              },
              async commit() {
                /* v8 ignore next -- commit() runs only after `settled` flipped, which set parked. */
                if (parked === undefined) return;
                const result = parked.kind === "post-result"
                  ? await scheduler.finalize(parked.exec, parked.result)
                  : scheduler.finish(parked.exec, parked.result);
                if (!result.isError && result.content.some((block) => block.type === "image")) {
                  exec.deferContext(createUserMessage({
                    content: result.content,
                    source: { kind: "ptc-mode" },
                  } as unknown as Parameters<typeof createUserMessage>[0]));
                }
                for (const context of result.additionalContexts ?? []) {
                  exec.deferContext(context);
                }
                // Bản tổng hợp chuyển tiếp `additionalContexts` ở trên và `concludesTurn` ở đây từ kết quả
                // lồng nhau. Chỉ kết quả lồng THÀNH CÔNG mới mang dấu kết thúc lượt (ToolExecutionFailure
                // không bao giờ mang), nên một thất bại bị chính sách đổi không thể dừng lượt qua chương
                // trình đang hồi phục.
                if (result.concludesTurn) exec.concludeTurn();
                settle(result);
                // Chặn ngược trên các task append event đang chờ: mỗi task giữ trọn một kết quả trong khi
                // backend chậm lưu nó, nên trần bể giới hạn số task. Vượt trần thì làn có thứ tự phải chờ,
                // nên các lời gọi con sau không khởi động được và I/O/bộ nhớ chờ không phình vô hạn.
                while (logWork.size > maxParallel) await Promise.race(logWork);
              },
            });
            wakeup();
            void drive();
          });
          // Một lần hết ngân sách hay một cú huỷ ngoài xảy ra khi lời gọi này đang bay đã huỷ lượt điều phối
          // rồi; dừng chương trình NGAY thay vì trao cho nó kết quả của một lần chạy đã hết.
          if (runOver()) {
            throw new Error(`run_code run is over (${String(runController.signal.reason)}); ${name} result discarded`);
          }
          // Worker biến một lời từ chối của binding thành ToolCallError và chỉ thêm tên binding. Nội dung
          // native và siêu dữ liệu lỗi nội bộ nằm ngoài hợp đồng thất bại mà chương trình thấy.
          if (outcome.isError) throw new Error(outcome.message);
          return outcome.value;
        };
        // Null-prototype + defineProperty, phản chiếu cách worker dựng namespace: một tool đã đăng ký tên
        // `__proto__` phải thành khoá own bình thường (gán lên object thường sẽ trúng setter của prototype
        // và âm thầm làm rơi binding), và host runtime chỉ phân giải tên binding qua thuộc tính own.
        const functions: Record<string, PtcBindingFunction> = Object.create(null);
        // Liệt kê tập NHÌN THẤY của AGENT ĐANG GỌI (tool theo scope xen vào, global bị hạn chế thì biến mất)
        // — đúng góc nhìn mà mục SDK đã khai, để chương trình chỉ bind được thứ prompt của nó hứa; chặng
        // điều phối con phân giải lại mỗi lời gọi qua cùng góc nhìn đó (exec.agent chảy xuống).
        for (const schema of registry.schemas(exec.agent)) {
          if (schema.name === RUN_CODE_NAME) continue;
          Object.defineProperty(functions, schema.name, { enumerable: true, value: binding(deepFreeze(schema)) });
        }
        try {
          let result: PtcRunResult;
          try {
            if (exec.agent !== undefined) {
              const agent = exec.agent;
              let runtimes = stateOwners.get(agent);
              if (runtimes === undefined) stateOwners.set(agent, runtimes = new WeakSet());
              // Cordis có thể bọc service trả về nhiều lần; việc dọn thuộc về nhà cung cấp GỐC.
              let provider = runtime;
              for (;;) {
                const original = originalServiceOf(provider);
                if (original === undefined) break;
                provider = original;
              }
              if (!runtimes.has(provider)) {
                agent.ctx.effect(() => () => runtime.release(agent), "PTC retained environment");
                runtimes.add(provider);
              }
            }
            result = await runtime.run(runtime.resolve({
              program: args.code,
              ...exec.agent === undefined || policy?.mode !== standingPolicy?.mode ? {} : { stateOwner: exec.agent },
              bindings: [{
                global: "tools",
                functions,
                errorClass: { name: "ToolCallError", memberNameProperty: "toolName" },
              }],
              signal: runController.signal,
              ...cwd !== undefined ? { cwd } : {},
              ...policy !== undefined ? { sandboxPolicy: policy } : {},
              ...args.timeoutMs !== undefined ? { timeoutMs: args.timeoutMs } : {},
            }));
          } finally {
            // Huỷ các lượt điều phối con và rút cạn mọi lượt đang bay TRƯỚC khi đóng lượt (các lượt còn xếp
            // hàng chưa chạy bị bỏ mà không ghi log). Thất bại binding vẫn quan sát được qua từng promise.
            runController.abort("run_code settled");
            await drainDispatches();
          }
          if (result.error) {
            const logsText = result.logs.length > 0 ? `\nCaptured output:\n${result.logs.join("\n")}` : "";
            const sandboxText = result.sandbox === undefined ? ""
              : `\nFile sandbox: ${result.sandbox.mode}${result.sandbox.enforcement === undefined ? "" : `; enforcement: ${result.sandbox.enforcement}`}${result.sandbox.denied ? "; operation denied" : ""}.`;
            throw new CodeRunFailedError(`code run failed (${result.error.kind}): ${result.error.message}${logsText}${sandboxText}${result.sandbox?.denied ? escalationGuidance(runtime) : ""}`);
          }
          return {
            logs: result.logs,
            ...result.sandbox === undefined ? {} : { sandbox: result.sandbox },
            ...result.value !== undefined ? { result: result.value } : {},
          };
        } finally {
          callSignal.removeEventListener("abort", onOuterAbort);
        }
      };
      return runtime.sandboxMode === undefined || exec.agent === undefined ? run(exec.signal)
        : calls.run(exec.agent.session.id, exec.signal, () => options.resolveSandboxPolicy(exec).mode, run);
    },
    // Mô tả do model viết là nhãn UI LUÔN HIỆN của lời gọi (theo tiền lệ `description` của bash); chương
    // trình thì đi qua rawInput.
    presentCall: (args) => ({
      card: "generic",
      title: args.description,
      kind: "execute",
      rawInput: args.code,
    }),
    // Cố ý KHÔNG có presentResult: nhánh card chung giữ nguyên tiêu đề này và đọc nội dung kết quả bền,
    // không nhân đôi một kết quả thô lớn vào payload của host.
  });
  // Phân giải hương vị ngôn ngữ LƯỜI, đúng lúc sổ chiếu schema (`schemaOf` lấy `description`/`parameters`).
  // Định nghĩa được đúc một lần lúc đăng ký, trước khi biết runtime; hoãn tới đây là điểm ít xâm lấn nhất
  // mà vẫn phát đúng ngôn ngữ của runtime đang nạp.
  Object.defineProperty(definition, "description", {
    enumerable: true,
    get: () => {
      const runtime = peekRuntime();
      const instructions = runtime?.executionInstructions;
      return resolveFlavor(peekRuntime).description
        + (instructions ? ` ${instructions}` : "")
        + (runtime === undefined ? "" : " Each program starts in the Session's current directory. Running programs keep their initial directory.")
        + escalationGuidance(runtime);
    },
  });
  Object.defineProperty(definition, "parameters", {
    enumerable: true,
    // Biên dịch lại qua đúng phép chiếu spec→schema mà defineTool đã dùng, để schema phát ra luôn khớp
    // đặc tả đã kiểm.
    get: () => parameterSchemaSpecToJsonSchema({
      description: { type: "string", required: true, description: RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION },
      code: { type: "string", required: true, description: resolveFlavor(peekRuntime).codeDescription },
      ...controlParameters(peekRuntime()),
    }),
  });
  return definition;
}
