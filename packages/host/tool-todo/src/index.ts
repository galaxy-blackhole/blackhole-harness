/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Tool `todo_write` hướng mô hình (mỗi lời gọi THAY TOÀN BỘ danh sách) + đơn vị chiếu `todos` — port 1:1 lib/index.js (196 dòng) + lib/types/{index,types,client}.js của @deepseek-ai/dsh-tool-todo: giữ nguyên chuỗi tiếng Anh, thứ tự kiểm, nhánh lỗi, hằng số; seam công cụ/chiếu phiên khai theo CẤU TRÚC (ADR 000d) và schema cấu hình theo Standard Schema.
 */

import { defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { Context } from "@deepseek-ai/cordis";

/** Tên plugin cordis — NGUYÊN VĂN bản gốc. */
export const name = "tool-todo";

/** Service bắt buộc — NGUYÊN VĂN bản gốc (sổ công cụ + sổ đơn vị chiếu phiên). */
export const inject: string[] = ["tools", "sessionProjections"];

/** Trạng thái hợp lệ của {@link TodoItem}, dạng mảng chạy để thu hẹp đầu vào — NGUYÊN VĂN bản gốc. */
const STATUSES = ["pending", "in_progress", "completed"] as const;

/** Ba trạng thái hợp lệ của một {@link TodoItem}. */
export type TodoStatus = "pending" | "in_progress" | "completed";

/**
 * Một mục trong danh sách todo của agent — đơn vị của ảnh chụp `todo/write`.
 * Tối giản có chủ đích: một dòng `content` cho người đọc + `status` ba trạng thái; không id, không
 * priority, không `activeForm` vì mỗi lần ghi THAY TOÀN BỘ danh sách (last-write-wins).
 */
export interface TodoItem {
  /** Việc này là gì — một dòng mệnh lệnh ngắn hiện trên UI. */
  content: string;
  /** Trạng thái vòng đời; `in_progress` đánh dấu việc đang làm, làm song song có thể đánh nhiều mục. */
  status: TodoStatus;
}

/** Cấu hình của tool todo phía mô hình — NGUYÊN VĂN hợp đồng bản gốc. */
export interface Config {
  /**
   * Lựa chọn BẮT BUỘC của bản triển khai: có cho phép nhiều mục `in_progress` cùng lúc hay không.
   * True hợp với agent chạy song song (subagent, lệnh nền, fan-out workflow) — khi đó mô tả dặn mô hình
   * đánh dấu MỌI việc đang làm. False trả lại kỷ luật một-việc: mô tả chỉ yêu cầu đúng một, và lời gọi
   * đánh dấu nhiều hơn một bị từ chối.
   */
  allowParallelInProgress: boolean;
}

/** Một vấn đề của lần kiểm cấu hình — hình dạng `issues` mà Standard Schema/cordis đọc. */
interface StandardIssue {
  /** Thông điệp lỗi, NGUYÊN VĂN chuỗi của schemastery. */
  readonly message: string;
  /** Đường dẫn tới trường sai (rỗng khi lỗi ở gốc). */
  readonly path?: readonly (string | number)[];
}

/** Kết quả `validate` của Standard Schema: hoặc giá trị đã chuẩn hoá, hoặc danh sách vấn đề. */
type StandardResult<T> = { readonly value: T } | { readonly issues: readonly StandardIssue[] };

/** Bề mặt schema cấu hình mà kernel gọi tới: `~standard.validate` (cordis) + `type`/`meta`/`dict`/`toString` (Loader). */
export interface ConfigSchema {
  /**
   * Gọi trực tiếp như schemastery: chuẩn hoá cấu hình, ném khi sai.
   * Nhận: value — cấu hình thô của Loader (có thể thiếu trường).
   * Trả: cấu hình đã kiểm (giữ nguyên khoá lạ như bản gốc).
   * @throws {Error} khi thiếu trường bắt buộc hoặc sai kiểu — thông điệp NGUYÊN VĂN schemastery.
   */
  (value?: unknown): Config;
  /** Loại nút gốc — `"object"` như `z.object(...)` của bản gốc (Loader đọc khi so khác biệt config). */
  readonly type: "object";
  /** Metadata của nút gốc — bản gốc là `{ default: {} }`. */
  readonly meta: { readonly default: Record<string, never> };
  /** Từ điển trường của nút gốc — bản gốc là `{ allowParallelInProgress: boolean }`. */
  readonly dict: { readonly allowParallelInProgress: { readonly type: "boolean"; toString(): string } };
  /** Giao diện chuẩn (Standard Schema) mà cordis gọi để chuẩn hoá config. */
  readonly "~standard": {
    /** Phiên bản giao diện (schemastery đặt 1). */
    readonly version: 1;
    /** Tên nhà cung cấp giao diện — Loader nhận diện schemastery bằng đúng chuỗi này. */
    readonly vendor: "schemastery";
    /**
     * Chuẩn hoá + kiểm cấu hình.
     * Nhận: value — cấu hình thô.
     * Trả: `{ value }` khi hợp lệ, `{ issues }` khi sai (cordis tự ném ValidationError của nó).
     */
    validate(value: unknown): StandardResult<Config>;
  };
  /** Chuỗi mô tả schema — NGUYÊN VĂN `String(schema)` của bản gốc. */
  toString(): string;
}

/** Mô tả chuỗi của nút gốc, NGUYÊN VĂN `String(Config)` của schemastery. */
const CONFIG_TEXT = "{ allowParallelInProgress: boolean }";

/** Mô tả chuỗi của nút con boolean, NGUYÊN VĂN `String(Config.dict.allowParallelInProgress)`. */
const BOOLEAN_TEXT = "boolean";

/**
 * Dựng schema cấu hình TƯƠNG ĐƯƠNG `z.object({ allowParallelInProgress: z.boolean().required() })`.
 * Gói KHÔNG khai peer `@deepseek-ai/schemastery` (manifest không sửa được) nên bề mặt Standard Schema
 * được dựng theo CẤU TRÚC, đúng ba thứ kernel đọc: `~standard.validate` (cordis), `type`/`meta`/`dict`
 * (Loader so khác biệt config) và phép gọi trực tiếp. Thông điệp lỗi giữ NGUYÊN VĂN schemastery.
 * Nhận: không.
 * Trả: schema cấu hình callable.
 */
function createConfigSchema(): ConfigSchema {
  /** Từ điển trường — phần Loader đọc khi so khác biệt config. */
  const dict = { allowParallelInProgress: { type: "boolean" as const, toString: (): string => BOOLEAN_TEXT } };
  /**
   * Kiểm một giá trị cấu hình thô.
   * Nhận: value — cấu hình chưa biết.
   * Trả: cấu hình đã kiểm hoặc danh sách vấn đề (đường dẫn bắt đầu bằng `$` như bản gốc).
   */
  const check = (value: unknown): StandardResult<Config> => {
    // Bản gốc coi `undefined`/`null` là object RỖNG (rồi báo thiếu trường), còn mảng và vô hướng bị chặn
    // ngay ở gốc bằng thông điệp `expected object but got …` — giữ đúng hai nhánh ấy.
    if (value !== undefined && value !== null && (typeof value !== "object" || Array.isArray(value))) {
      return { issues: [{ message: "expected object but got " + String(value) }] };
    }
    const record = (value ?? {}) as Record<string, unknown>;
    const field = record.allowParallelInProgress;
    if (field === undefined || field === null) {
      return { issues: [{ message: "$.allowParallelInProgress missing required value", path: ["allowParallelInProgress"] }] };
    }
    if (typeof field !== "boolean") {
      return { issues: [{ message: "$.allowParallelInProgress expected boolean but got " + String(field), path: ["allowParallelInProgress"] }] };
    }
    // Bản gốc TRẢ VỀ object đã trải (giữ khoá lạ) sau khi kiểm trường bắt buộc.
    return { value: { ...record, allowParallelInProgress: field } as Config };
  };
  const schema = ((value?: unknown): Config => {
    const result = check(value);
    if ("issues" in result) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
    return result.value;
  }) as ConfigSchema;
  Object.assign(schema, {
    type: "object" as const,
    meta: { default: {} },
    dict,
    toString: (): string => CONFIG_TEXT,
  });
  // `~standard` KHÔNG được liệt kê (bản gốc khai bằng `defineProperty`), nên khai cùng cách.
  Object.defineProperty(schema, "~standard", {
    value: { version: 1, vendor: "schemastery", validate: (value: unknown): StandardResult<Config> => check(value) },
    enumerable: false,
  });
  return schema;
}

/** Schema cấu hình cho consumer tool todo — NGUYÊN VĂN bản gốc `z.object({ allowParallelInProgress: z.boolean().required() })`. */
export const Config: ConfigSchema = createConfigSchema();

/**
 * Chuỗi mở đầu mô tả — NGUYÊN VĂN bản gốc.
 * Giữ nguyên dấu cách cuối: nó là dấu phân cách với mệnh đề chính sách ở giữa.
 */
const DESCRIPTION_HEAD = "Record and update a task list to plan multi-step work and show progress; skip it for trivial single-step tasks. Add one todo per concrete step before you start. ";

/** Mệnh đề khi cho phép nhiều việc song song — NGUYÊN VĂN bản gốc. */
const DESCRIPTION_PARALLEL = "While work remains, keep the todos being worked on `in_progress`, several only when work runs in parallel. ";

/** Mệnh đề khi chỉ cho phép MỘT việc đang làm — NGUYÊN VĂN bản gốc. */
const DESCRIPTION_SINGLE = "While work remains, keep exactly one todo `in_progress`. ";

/** Chuỗi kết mô tả — NGUYÊN VĂN bản gốc. */
const DESCRIPTION_TAIL = "Mark each todo `completed` as soon as it is done.";

/**
 * Mô tả hướng mô hình cho MỘT lần kích hoạt. Chỉ mệnh đề trạng thái-hoạt-động thay đổi, vì đó là
 * hướng dẫn DUY NHẤT mà chính sách song song tác động.
 * Nhận: allowParallel — có cho phép nhiều todo `in_progress` cùng lúc hay không.
 * Trả: mô tả công cụ đã ghép.
 */
function describe(allowParallel: boolean): string {
  return DESCRIPTION_HEAD + (allowParallel ? DESCRIPTION_PARALLEL : DESCRIPTION_SINGLE) + DESCRIPTION_TAIL;
}

/**
 * Đầu vào một mục todo do MÔ HÌNH cấp (đã qua schema của sổ công cụ, chưa trim/khử trùng).
 * Khai riêng để `toTodoList` không phụ thuộc kiểu suy ra của `defineTool`.
 */
interface TodoInput {
  /** Nội dung thô mô hình gửi. */
  readonly content: string;
  /** Trạng thái mô hình gửi. */
  readonly status: TodoStatus;
}

/**
 * Kiểm các ràng buộc GIÁ TRỊ mà ParameterSchemaSpec không diễn đạt được rồi dựng {@link TodoItem}[] canonical:
 * `content` đã trim, khác rỗng, không trùng; và tối đa MỘT mục `in_progress` trừ khi bản triển khai cho phép
 * chạy song song. Sổ công cụ đã ép enum trạng thái và từ chối khoá lạ của mục (`additionalProperties: false`
 * — ảnh chụp ghi log phải BẰNG thứ mô hình tin là nó đã ghi, nên hình dạng mục lồng/mở rộng phải nổ ngay ở
 * ranh giới schema thay vì bị làm phẳng lặng lẽ); ép kiểu bên dưới ghi lại bảo đảm đó.
 * Nhận: raw — danh sách mô hình cấp, đã qua kiểm schema; allowParallel — có cho phép nhiều `in_progress` không.
 * Trả: danh sách canonical.
 * @throws {Error} khi một `content` rỗng, khi `content` trùng, hoặc khi quá một `in_progress` mà không cho song song.
 */
function toTodoList(raw: readonly TodoInput[], allowParallel: boolean): TodoItem[] {
  const todos: TodoItem[] = [];
  const seen = new Set<string>();
  let active = 0;
  for (const item of raw) {
    const content = item.content.trim();
    if (content.length === 0) throw new Error("invalid todo: `content` must be a non-empty string");
    if (seen.has(content)) throw new Error(`invalid todos: duplicate content ${JSON.stringify(content)}`);
    seen.add(content);
    if (item.status === "in_progress") active++;
    todos.push({ content, status: item.status });
  }
  if (!allowParallel && active > 1) throw new Error(`invalid todos: at most one task may be in_progress (got ${active})`);
  return todos;
}

/** Schema của một đơn vị chiếu: seam CHỈ gọi `parse` (zod/schemastery/cấu trúc đều khớp hình dạng này). */
interface ProjectionSchema<T> {
  /**
   * Kiểm và chuẩn hoá một giá trị.
   * Nhận: value — trạng thái đã lưu hoặc khung nhìn vừa dựng.
   * Trả: giá trị đúng kiểu (object MỚI, khoá lạ bị bỏ — đúng ngữ nghĩa `z.object`).
   * @throws {Error} khi hình dạng sai.
   */
  parse(value: unknown): T;
}

/** Thông điệp từ chối payload chiếu hỏng — chuỗi tiếng Anh của bản viết lại (zod chỉ ném ZodError). */
const INVALID_PROJECTION = "invalid todos projection: expected a list of todo items or null";

/**
 * Schema payload dây của đơn vị chiếu `todos` (TOÀN BỘ danh sách, hoặc null trước lần ghi đầu).
 * Bản gốc là `z.union([z.array(z.object({ content: z.string(), status: z.union([...3 literal]) })), z.null()])`;
 * ở đây dựng theo CẤU TRÚC với đúng ngữ nghĩa đó: null giữ nguyên, mảng được dựng lại thành object chỉ có
 * `content`/`status` (zod bỏ khoá lạ), mọi hình dạng khác bị từ chối.
 * Nhận: không.
 * Trả: schema có `parse`.
 */
const todosProjectionSchema: ProjectionSchema<TodoItem[] | null> = {
  parse(value: unknown): TodoItem[] | null {
    if (value === null) return null;
    if (!Array.isArray(value)) throw new Error(INVALID_PROJECTION);
    const todos: TodoItem[] = [];
    for (const item of value) {
      if (typeof item !== "object" || item === null) throw new Error(INVALID_PROJECTION);
      const { content, status } = item as { content?: unknown; status?: unknown };
      if (typeof content !== "string") throw new Error(INVALID_PROJECTION);
      if (status !== "pending" && status !== "in_progress" && status !== "completed") throw new Error(INVALID_PROJECTION);
      todos.push({ content, status });
    }
    return todos;
  },
};

/** Một sự kiện log phiên mà phép gộp `todos` đọc — khai theo CẤU TRÚC (KHÔNG augment `SessionEventMap`). */
interface SessionEventLike {
  /** Loại sự kiện (`todo/write` · `turn/start` · …). */
  readonly type: string;
  /** Dữ liệu sự kiện; `todo/write` mang `{ todos }`, sự kiện khác không được đọc. */
  readonly data: unknown;
}

/** Đơn vị chiếu `todos` — đúng hình dạng `ctx.sessionProjections.register` nhận. */
interface TodoProjection {
  /** Khoá của đơn vị chiếu. */
  readonly key: string;
  /** Schema trạng thái phép gộp. */
  readonly stateSchema: ProjectionSchema<TodoItem[] | null>;
  /** Trạng thái trước lần ghi đầu tiên (bản gốc: `() => null`). */
  readonly init: (header: unknown, inheritedEventCount: unknown) => TodoItem[] | null;
  /** Phép gộp MỘT sự kiện vào trạng thái. */
  readonly apply: (state: TodoItem[] | null, event: SessionEventLike) => TodoItem[] | null;
  /** Khung nhìn dây phía Client (cùng schema với trạng thái, hàm chiếu là đồng nhất). */
  readonly wire: {
    /** Schema của khung nhìn trên dây. */
    readonly viewSchema: ProjectionSchema<TodoItem[] | null>;
    /** Chiếu trạng thái sang khung nhìn (đồng nhất). */
    readonly view: (state: TodoItem[] | null) => TodoItem[] | null;
  };
  /** Phiên bản trạng thái của đơn vị chiếu. */
  readonly stateVersion: number;
}

/** Seam `ctx.sessionProjections` — chỉ phần plugin này gọi. */
interface SessionProjectionsSeam {
  /**
   * Đăng ký một đơn vị chiếu.
   * Nhận: definition — đơn vị chiếu `todos`.
   * Trả: hàm gỡ đăng ký (bản gốc bỏ qua giá trị này).
   */
  register(definition: TodoProjection): unknown;
}

/** Seam `ctx.tools` — chỉ phần plugin này gọi. */
interface ToolsSeam {
  /**
   * Đăng ký một định nghĩa công cụ.
   * Nhận: definition — định nghĩa đã qua `defineTool`.
   * Trả: hàm gỡ đăng ký (bản gốc bỏ qua giá trị này).
   */
  register(definition: unknown): unknown;
}

/** Phiên của agent gọi — chỉ `append` mà `todo_write` dùng. */
interface TodoSession {
  /**
   * Ghi một sự kiện `todo/write` (TOÀN BỘ danh sách) vào log của phiên.
   * Nhận: type — luôn `"todo/write"`; data — ảnh chụp danh sách.
   * Trả: không.
   */
  append(type: "todo/write", data: { todos: TodoItem[] }): void;
}

/** Agent gọi công cụ — chỉ `session`. */
interface TodoAgent {
  /** Phiên sở hữu danh sách todo. */
  readonly session: TodoSession;
}

/** Ngữ cảnh thực thi công cụ — chỉ phần `execute` đọc. */
interface TodoExec {
  /** Agent gọi; vắng khi lời gọi không thuộc agent nào. */
  readonly agent?: TodoAgent;
}

/**
 * Đăng ký công cụ `todo_write` trên `ctx.tools` và đơn vị `todos` trên `ctx.sessionProjections`.
 * Nhận: ctx — context host mang hai sổ đăng ký; config — chính sách todo tường minh của bản triển khai.
 * Trả: không.
 * @throws {TypeError} khi `config` là undefined — bản gốc đọc thẳng `config.allowParallelInProgress` nên
 *   cũng nổ đúng như vậy; ở đây giữ NGUYÊN cách đọc ấy (Loader luôn chuẩn hoá trước khi gọi apply).
 */
export function apply(ctx: Context, config: Config): void {
  const allowParallel = config.allowParallelInProgress;
  // Phép gộp "kế hoạch thường trực": danh sách todo của lần `todo/write` MỚI NHẤT, bị xoá bởi
  // `turn/start` kế tiếp (turn/end giữ danh sách đã xong để người dùng còn thấy); null trước lần ghi
  // đầu tiên hoặc sau khi lượt sau bắt đầu; mọi sự kiện khác trả lại ĐÚNG tham chiếu trạng thái cũ.
  (ctx as unknown as { sessionProjections: SessionProjectionsSeam }).sessionProjections.register({
    key: "todos",
    stateSchema: todosProjectionSchema,
    init: () => null,
    apply: (state, event) => {
      if (event.type === "todo/write") return (event.data as { todos: TodoItem[] }).todos;
      if (event.type === "turn/start") return null;
      return state;
    },
    wire: { viewSchema: todosProjectionSchema, view: (state) => state },
    stateVersion: 2,
  });
  (ctx as unknown as { tools: ToolsSeam }).tools.register(defineTool({
    name: "todo_write",
    description: describe(allowParallel),
    parameters: {
      todos: {
        type: "array",
        required: true,
        description: "The COMPLETE task list, replacing any previous list.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            content: { type: "string", required: true, description: "What the task is — a short imperative line." },
            status: {
              type: "string",
              required: true,
              enum: [...STATUSES],
              description: "pending (not started) | in_progress (now) | completed (done).",
            },
          },
        },
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          todos: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                content: { type: "string", required: true },
                status: { type: "string", required: true, enum: [...STATUSES] },
              },
            },
          },
          counts: {
            type: "object",
            additionalProperties: false,
            required: true,
            properties: {
              pending: { type: "integer", required: true },
              inProgress: { type: "integer", required: true },
              completed: { type: "integer", required: true },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: "text",
        text: `Updated todo list: ${value.counts.pending} pending, ${value.counts.inProgress} in progress, ${value.counts.completed} completed.`,
      }],
    },
    execute(args, exec) {
      const todos = toTodoList(args.todos, allowParallel);
      const agent = (exec as unknown as TodoExec).agent;
      if (!agent) {
        // Danh sách là trạng thái của MỘT phiên agent; bên gọi không có phiên sở hữu thì không có chỗ ghi.
        // Từ chối thay vì lặng lẽ không làm gì.
        throw new Error("todo_write requires an owning agent session");
      }
      agent.session.append("todo/write", { todos });
      const count = (status: TodoStatus): number => todos.filter((todo) => todo.status === status).length;
      return Promise.resolve({
        todos: todos.map((todo) => ({ content: todo.content, status: todo.status })),
        counts: {
          pending: count("pending"),
          inProgress: count("in_progress"),
          completed: count("completed"),
        },
      });
    },
    presentCall: (args) => ({ card: "generic", title: "Update todo list", kind: "other", rawInput: args.todos }),
  }));
}
