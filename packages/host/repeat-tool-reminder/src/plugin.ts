/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lõi plugin repeat-tool-reminder (bản viết lại 1:1): tên plugin, hàm `apply` đăng ký hai hook — đếm chuỗi lặp y hệt args theo từng agent ở `tools/post-execute` rồi chèn nhắc nhở vào `additionalContexts`, và xoá chuỗi khi có tin nhắn người dùng mới ở `agent/pre-step` — cùng helper `prependContext`.
 */

import type { ContentBlock, UserMessage } from "@deepseek-ai/dsh-llm";
import { canonicalize, previewArguments, wildcardToRegExp } from "./arguments.ts";
import type { Config } from "./config.ts";
import { validateArgumentsPreviewChars, validateThresholds } from "./config.ts";
import { createReminder } from "./reminder.ts";

/**
 * Tên plugin cordis — NGUYÊN VĂN bản gốc (`repeat-tool-reminder`).
 * Nhận: không có — hằng số định danh, không tham số.
 * Trả: chuỗi literal `'repeat-tool-reminder'`, dùng làm khoá đăng ký plugin.
 */
export const name: "repeat-tool-reminder" = "repeat-tool-reminder";

/**
 * Phần tin nhắn mà `agent/pre-step` cần đọc: mỗi tin có nguồn với `kind` do bên sản xuất khai.
 * Nhận: (kiểu) một tin nhắn bước vào của agent.
 * Trả: (kiểu) trường `source.kind` — đủ để nhận ra tin nhắn NGƯỜI DÙNG.
 */
interface PreStepMessageView {
  /** Nguồn tin nhắn; giá trị `'user'` là tin nhắn người dùng thật. */
  readonly source: { readonly kind: string };
}

/**
 * Thân sự kiện waterfall `agent/pre-step` mà guard đọc.
 * Nhận: (kiểu) agent đề xuất bước và các tin nhắn được rút khỏi hộp thư cho bước đó.
 * Trả: (kiểu) hai trường `agent` và `messages`; các trường còn lại của kernel không dùng.
 */
interface PreStepPayloadView {
  /** Agent đang đề xuất bước — khoá của chuỗi lặp trong `WeakMap`. */
  readonly agent: object;
  /** Các tin nhắn bước vào; có một tin nguồn `'user'` nghĩa là lượt chỉ dẫn mới. */
  readonly messages: readonly PreStepMessageView[];
}

/** Hàm gọi tiếp của `agent/pre-step`: chạy tầng dưới và trả quyết định của nó (guard không đọc). */
type PreStepNext = () => Promise<unknown>;

/** Listener waterfall `agent/pre-step`: xoá chuỗi lặp khi có tin nhắn người dùng, rồi gọi tiếp. */
type PreStepListener = (payload: PreStepPayloadView, next: PreStepNext) => Promise<unknown>;

/**
 * Lượt gọi tool mà `tools/post-execute` đưa vào — khai theo CẤU TRÚC (luật 000d: không augment
 * `@deepseek-ai/cordis`, không dựa vào ambient `declare module`).
 * Nhận: (kiểu) một lượt gọi đã chạy xong.
 * Trả: (kiểu) tên tool, arguments đã parse, và agent chịu trách nhiệm (vắng ở lời gọi không thuộc agent).
 */
interface PostExecuteExecView {
  /** Tên tool — nửa đầu của khoá chuỗi lặp, đồng thời là đầu vào của include/exclude. */
  readonly name: string;
  /** Arguments đã parse (miền thật là output của `JSON.parse` hoặc chuỗi thô khi JSON hỏng). */
  readonly arguments: unknown;
  /** Agent gọi tool; `WeakMap` khoá theo đúng đối tượng này nên mỗi agent có chuỗi riêng. */
  readonly agent?: object;
}

/**
 * Quyết định của waterfall `tools/post-execute` — guard chỉ đọc/rẽ theo `kind`, giữ `feedback`
 * khi tầng dưới chặn, và chèn thêm `additionalContexts` ở cả hai nhánh.
 * Nhận: (kiểu) quyết định do tầng dưới trả về.
 * Trả: (kiểu) nhánh `accept` (giữ nguyên mọi trường khác) hoặc nhánh `block` (kèm feedback).
 */
type PostToolDecisionView =
  | {
      readonly kind: "accept";
      /** Ngữ cảnh gửi kèm cho model ở lượt sau; guard chèn nhắc nhở lên ĐẦU mảng này. */
      readonly additionalContexts?: readonly UserMessage[];
    }
  | {
      readonly kind: "block";
      /** Phản hồi sửa sai của tầng dưới — guard giữ nguyên tham chiếu, không viết lại. */
      readonly feedback: ContentBlock[];
      /** Ngữ cảnh gửi kèm; nhắc nhở của guard vẫn được chèn lên đầu. */
      readonly additionalContexts?: readonly UserMessage[];
    };

/** Hàm gọi tiếp của `tools/post-execute`: chạy tầng dưới rồi trả quyết định của nó. */
type PostExecuteNext = () => Promise<PostToolDecisionView>;

/** Listener waterfall `tools/post-execute`: đếm lượt gọi rồi bọc quyết định của tầng dưới. */
type PostExecuteListener = (
  exec: PostExecuteExecView,
  result: unknown,
  next: PostExecuteNext,
) => Promise<PostToolDecisionView>;

/**
 * Context cordis mà plugin dùng, khai theo CẤU TRÚC: đúng hai điểm mở rộng `on`.
 * Không augment `@deepseek-ai/cordis` (luật 000d) — hình dạng thật của kernel được bám bằng
 * đối chiếu `dsh-tools`/`dsh-agent`, không bằng ambient `declare module`.
 * Nhận: (kiểu) context do tầng nạp plugin truyền vào.
 * Trả: (kiểu) hai overload `on` cho `tools/post-execute` và `agent/pre-step`.
 */
interface RepeatToolReminderContext {
  /**
   * Đăng ký listener waterfall `tools/post-execute`.
   * Nhận: tên sự kiện và listener ba tham số.
   * Trả: hàm gỡ đăng ký (vòng đời listener bám context).
   */
  on(event: "tools/post-execute", listener: PostExecuteListener): () => void;
  /**
   * Đăng ký listener waterfall `agent/pre-step`.
   * Nhận: tên sự kiện và listener hai tham số.
   * Trả: hàm gỡ đăng ký (vòng đời listener bám context).
   */
  on(event: "agent/pre-step", listener: PreStepListener): () => void;
}

/**
 * Một mắt chuỗi lặp của MỘT agent: khoá `(tên tool, arguments canonical)` và độ dài liên tiếp.
 * Nhận: (kiểu) trạng thái lưu trong `WeakMap`.
 * Trả: (kiểu) `key` để so khớp và `count` để đối chiếu ngưỡng.
 */
interface RepeatChain {
  /** Khoá `JSON.stringify([tên tool, chuỗi canonical])` của lần gọi gần nhất. */
  readonly key: string;
  /** Số lần liên tiếp cùng khoá tính đến lần gọi này. */
  readonly count: number;
}

/**
 * Chèn nhắc nhở của guard lên ĐẦU danh sách ngữ cảnh của tầng dưới, giữ nguyên nguồn và metadata
 * của mọi ngữ cảnh còn lại (không sao chép, không viết lại phần tử nào).
 * Nhận: `ours` — tin nhắc do guard dựng; `theirs` — ngữ cảnh của tầng dưới (có thể vắng).
 * Trả: mảng MỚI gồm `ours` rồi đến toàn bộ `theirs` theo đúng thứ tự cũ.
 */
export function prependContext<T>(ours: T, theirs: readonly T[] | undefined): T[] {
  return [ours, ...(theirs ?? [])];
}

/**
 * Lắp guard: kiểm cấu hình fail-loud rồi đăng ký hai listener waterfall.
 *
 * Thứ tự kiểm giữ NGUYÊN VĂN bản gốc: `thresholds` trước (rỗng → không nguyên >= 2 → trùng nhau),
 * rồi mới dựng Set/mẫu wildcard, rồi mới kiểm `argumentsPreviewChars` — nhờ vậy khi cấu hình sai cả
 * hai chỗ thì thông điệp lỗi đầu tiên vẫn trùng bản gốc.
 *
 * Nhận: `ctx` — context cordis (chỉ hai hook `on`, khai theo cấu trúc); `config` — cấu hình đã qua
 * schema Schemastery, bốn trường đều có mặc định.
 * Trả: không; listener được scope theo `ctx` và tự gỡ khi context bị dispose.
 * @throws Error khi `thresholds` rỗng, có phần tử không phải số nguyên >= 2, có phần tử trùng nhau,
 *         hoặc `argumentsPreviewChars` không phải số nguyên >= 1 (thông điệp nguyên văn tiếng Anh).
 */
export function apply(ctx: RepeatToolReminderContext, config: Config): void {
  const thresholds: number[] = validateThresholds(config.thresholds);
  const thresholdSet: ReadonlySet<number> = new Set<number>(thresholds);
  const includePatterns: RegExp[] = config.include.map((pattern: string): RegExp => wildcardToRegExp(pattern));
  const excludePatterns: RegExp[] = config.exclude.map((pattern: string): RegExp => wildcardToRegExp(pattern));
  // Bản gốc đọc biến này TRƯỚC khi kiểm (dòng 2207–2208); `validateArgumentsPreviewChars` trả lại
  // đúng giá trị đã kiểm nên biến cục bộ giữ nguyên ngữ nghĩa.
  const argumentsPreviewChars: number = validateArgumentsPreviewChars(config.argumentsPreviewChars);

  /** Chuỗi lặp riêng cho TỪNG agent — khoá là chính đối tượng agent nên agent biến mất là chuỗi biến mất. */
  const chains: WeakMap<object, RepeatChain> = new WeakMap<object, RepeatChain>();

  /**
   * Tool có tham gia chuỗi lặp không. Lời gọi KHÔNG được theo dõi là TRONG SUỐT: nó không tăng và
   * cũng không đặt lại bộ đếm (nhờ vậy `grep X → todo_write → grep X` vẫn là hai lần liên tiếp).
   * Nhận: `toolName` — tên tool của lượt gọi.
   * Trả: `false` khi có `include` mà không mẫu nào khớp, hoặc khi một mẫu `exclude` khớp; ngược lại `true`.
   */
  function tracked(toolName: string): boolean {
    if (includePatterns.length > 0 && !includePatterns.some((pattern: RegExp): boolean => pattern.test(toolName))) {
      return false;
    }
    return !excludePatterns.some((pattern: RegExp): boolean => pattern.test(toolName));
  }

  /**
   * Tiến chuỗi lặp của agent gọi tool thêm MỘT lần và trả tin nhắc cần chèn, nếu độ dài chuỗi vừa
   * chạm một ngưỡng đã cấu hình.
   *
   * Việc đếm đặt ở `tools/post-execute` (không phải pre-execute) vì lời gọi BỊ CHẶN cũng đi qua
   * waterfall này — model đập mãi vào một lời gọi bị từ chối chính là vòng lặp đáng phá.
   *
   * Nhận: `exec` — lượt gọi vừa chạy xong (tên, arguments, agent).
   * Trả: tin nhắn user chở nhắc nhở khi `count` nằm trong tập ngưỡng; `undefined` khi không có agent,
   *        khi tool không được theo dõi, hoặc khi `count` không phải ngưỡng.
   */
  function observe(exec: PostExecuteExecView): UserMessage | undefined {
    if (!exec.agent) return undefined;
    if (!tracked(exec.name)) return undefined;
    // Khoá luôn dùng chuỗi canonical ĐẦY ĐỦ; phần cắt ngắn chỉ dành cho chữ hiện ra ở lời nhắc.
    const canonical: string = canonicalize(exec.arguments);
    const key: string = JSON.stringify([exec.name, canonical]);
    const chain: RepeatChain | undefined = chains.get(exec.agent);
    const count: number = chain !== undefined && chain.key === key ? chain.count + 1 : 1;
    chains.set(exec.agent, { key, count });
    if (!thresholdSet.has(count)) return undefined;
    return createReminder(exec.name, count, thresholds, previewArguments(canonical, argumentsPreviewChars));
  }

  ctx.on(
    "tools/post-execute",
    async (
      exec: PostExecuteExecView,
      _result: unknown,
      next: PostExecuteNext,
    ): Promise<PostToolDecisionView> => {
      // Đếm TRƯỚC khi gọi tầng dưới, đúng thứ tự bản gốc: quyết định của listener phía sau không
      // làm thay đổi việc lượt gọi này đã được tính.
      const reminder: UserMessage | undefined = observe(exec);
      const downstream: PostToolDecisionView = await next();
      if (!reminder) return downstream;
      if (downstream.kind === "block") {
        // Tầng dưới chặn: GIỮ `kind: 'block'` và nguyên feedback, chỉ chèn nhắc nhở lên đầu ngữ cảnh.
        return {
          kind: "block",
          feedback: downstream.feedback,
          additionalContexts: prependContext(reminder, downstream.additionalContexts),
        };
      }
      return {
        ...downstream,
        additionalContexts: prependContext(reminder, downstream.additionalContexts),
      };
    },
  );

  ctx.on("agent/pre-step", (payload: PreStepPayloadView, next: PreStepNext): Promise<unknown> => {
    // Chỉ một tin nhắn nguồn `'user'` là đủ: chỉ dẫn mới thì chuỗi lặp cũ không còn nghĩa.
    if (payload.messages.some((message: PreStepMessageView): boolean => message.source.kind === "user")) {
      chains.delete(payload.agent);
    }
    return next();
  });
}
