/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Công cụ đầu ra CÓ CẤU TRÚC theo phạm vi TỪNG con, chỉ dẫn prompt, chốt chặn cuối, và thu hoạch
 *      kết quả có thẩm quyền cho subagent chạy trong tiến trình: mỗi con đăng ký schema THẬT trên
 *      scope của chính nó nên các lượt chạy song song không đụng nhau và việc dọn không để lại cặn
 *      toàn cục; phần góp prompt chỉ là trạng thái yêu cầu thường được dựng lại. Cam kết chỉ xảy ra
 *      SAU khi `tools/result` có thẩm quyền thành công (chế độ PTC còn chờ kết quả `run_code` bao
 *      ngoài). Port 1:1 lib/types/structured.js của @deepseek-ai/dsh-subagent; seam khai theo CẤU TRÚC.
 */

import type { Context } from "@deepseek-ai/cordis";
import { ToolArgsError, validateJsonSchemaValue } from "@galaxy-blackhole/gbh-host-tools";
import type { ObjectJsonSchema, ToolExecution, ToolExecutionToken } from "@galaxy-blackhole/gbh-host-tools";

/**
 * Mat cau truc cua seam `tools` ma khoi thu cau truc dung (ADR 000d, 08/11/2026 dev-1).
 * Ban port `gbh-agent` khong tai khai augmentation `Context.tools` cua kernel => doc qua `ctx.get("tools")`.
 */
interface ToolsSeamLike {
  /** Dang ky mot dinh nghia tool. */
  register(definition: unknown): unknown;
  /** Chen guard chay sau moi waterfall pre-execute. */
  guard(hook: (exec: { readonly name: string }) => string | undefined): unknown;
}

/**
 * Lay seam `tools`, thieu la loi cau hinh nen nem NGAY.
 * Nhan: `ctx` - context cua agent con. Tra: mat cau truc cua so tool.
 */
function toolsOf(ctx: { get(name: string): unknown }): ToolsSeamLike {
  const seam = ctx.get('tools') as ToolsSeamLike | undefined;
  if (seam === undefined) {
    throw new TypeError('subagent structured output requires the tools seam (ctx.get("tools"))');
  }
  return seam;
}

/** Mat cau truc cua kenh su kien `tools/result` (ban goc khai bang augmentation `Events`). */
interface ToolsEventsSeamLike {
  /** Nghe ket qua mot luot goi tool. */
  on(event: 'tools/result', listener: (exec: any, result: any) => void): () => void;
}


/** Tên công cụ phía mô hình mà một con có cấu trúc PHẢI gọi để kết thúc. */
export const STRUCTURED_OUTPUT_TOOL = 'structured_output';

/**
 * Chỉ dẫn được đăng ký thành mục prompt có phạm vi CUỐI của con: đòi hỏi đi kèm công cụ,
 * như trạng thái prompt thường của ĐÚNG một agent.
 */
export const STRUCTURED_OUTPUT_INSTRUCTION = 'When you have your final answer, you MUST report it by calling the '
    + `\`${STRUCTURED_OUTPUT_TOOL}\` tool with arguments matching its parameter schema exactly. `
    + 'Do not finish with a plain text answer: only the tool call counts as your result.';

/** Handle sống của MỘT lượt chạy có cấu trúc: đọc giá trị đã thu khi con kết toán. */
export interface StructuredAttachment {
    /**
     * Đầu vào ĐÓNG từ lúc xếp giá trị chờ tới kết quả cuối của nó, kể cả lượt PTC bao ngoài.
     * Kết quả hỏng thì bỏ giá trị chờ và mở lại đầu vào.
     * Nhận: không.
     * Trả: lượt thực thi còn nhận thêm giao phẩm hay không.
     */
    acceptsInput(): boolean;
    /**
     * Giá trị đã thu, sau khi con gọi công cụ với tham số hợp lệ VÀ kết quả công cụ cuối có thẩm quyền chấp nhận.
     * Nhận: không.
     * Trả: `{ value }` đã cam kết, hoặc `undefined` khi chưa có lần nào được chấp nhận.
     */
    captured(): {
        value: unknown;
    } | undefined;
}

/**
 * Gắn công cụ thu giá trị có phạm vi, chỉ dẫn, và chốt chặn vào MỘT con trong cửa sổ tạo của nó.
 * Việc dọn con gỡ mọi đăng ký.
 * Nhận: `childCtx` — context scope của agent con (tham số của `setup`);
 *   `schema` — tập con schema ĐÃ được kiểm và tin (xem `assertObjectJsonSchema` trong dsh-tools);
 *   `canComplete` — đầu vào đã nhận và việc của con đang sở hữu đã xong chưa.
 * Trả: handle của phần gắn (đọc `captured()` sau khi con kết toán).
 */
export function attachStructuredRuntime(childCtx: Context, schema: ObjectJsonSchema, canComplete: () => boolean): StructuredAttachment {
    /**
     * Giá trị đã kiểm do thân công cụ thu xếp, CHỜ chính `tools/result` có thẩm quyền CỦA NÓ.
     * Danh tính đối tượng thực thi nhận diện duy nhất một lượt qua pipeline: id lời gọi của
     * adapter có thể lặp giữa các bước, nhưng một lượt thực thi KHÁC không bao giờ chạm được mục
     * Map này. Khác với `ToolExecutionToken` mờ dùng để tương quan các transport lồng nhau. Thông
     * báo cuối luôn xoá mục của chính nó, dù kết quả thành công hay hỏng.
     */
    const staged = new Map<ToolExecution, { readonly value: unknown }>();
    /** Lần thu LỒNG nhau thành công đang chờ transport bao ngoài cam kết. */
    let pending: { readonly parent: ToolExecutionToken; readonly value: unknown } | undefined;
    let captured: { readonly value: unknown } | undefined;
    const schemaEntry = {
        name: STRUCTURED_OUTPUT_TOOL,
        description: 'Report your final structured result. Call this exactly once, when your answer is complete; '
            + 'the arguments must match this tool\'s parameter schema exactly.',
        parameters: { ...schema },
    };
    toolsOf(childCtx).register({
        ...schemaEntry,
        output: {
            schema: {
                type: 'object',
                properties: { recorded: { type: 'boolean', const: true } },
                required: ['recorded'],
                additionalProperties: false,
            },
            render: () => [{ type: 'text', text: 'Structured output recorded.' }],
        },
        execute(args: unknown, exec: { concludeTurn(): void }) {
            const violations = validateJsonSchemaValue(schema, args);
            // ToolArgsError → kết quả isError với INVALID_ARGS: mô hình thử lại NGAY trong cùng lượt,
            // đúng như một lời gọi defineTool có kiểm schema.
            if (violations.length > 0)
                throw new ToolArgsError(violations);
            if (!canComplete())
                throw new Error('Wait for all delegated child tasks to finish and process pending messages before submitting structured output.');
            // Cam kết HAI PHA, khoá theo CHÍNH lượt thực thi này: các waterfall biến đổi sau đó vẫn có
            // thể biến thành công thành lỗi. ToolRuntime đã đóng băng tham số hướng mô hình tại biên
            // đầu vào thật.
            staged.set(exec as unknown as ToolExecution, { value: args });
            exec.concludeTurn();
            return Promise.resolve({ recorded: true });
        },
    });
    childCtx.systemPrompt.section({
        name: `tool:${STRUCTURED_OUTPUT_TOOL}`,
        order: childCtx.systemPrompt.getSectionOrder('STRUCTURED_OUTPUT'),
        text: STRUCTURED_OUTPUT_INSTRUCTION,
    });
    // CHỐT CHẶN TRONG bước. Guard chạy sau TOÀN BỘ waterfall pre-execute và hợp thành ĐƠN ĐIỆU
    // (từ chối hoặc không ý kiến, không bao giờ cho phép), nên listener gắn sau không làm sống lại
    // việc phát lệnh. Lời gọi đứng TRƯỚC lần thu trong cùng một phản hồi vẫn được giữ nguyên.
    toolsOf(childCtx).guard(exec => captured === undefined && pending === undefined
        ? undefined
        : `structured output already recorded: the run is complete, so \`${exec.name}\` is not executed`);
    // Cam kết THU chỉ quan sát kết quả bất biến, có thẩm quyền SAU toàn bộ pipeline và chuẩn hoá lỗi
    // ngoài cùng. Thông báo này không biến đổi được kết cục, nên không có wrapper ngoài phán quyết.
    // Su kien `tools/result` do goi tools cua kernel khai; ban port khong tai khai augmentation `Events` => doc qua mat cau truc.
    (childCtx as unknown as ToolsEventsSeamLike).on('tools/result', function (exec, result) {
        if (exec.name === STRUCTURED_OUTPUT_TOOL) {
            const entry = staged.get(exec as unknown as ToolExecution);
            if (entry === undefined)
                return;
            staged.delete(exec as unknown as ToolExecution);
            if (result.isError)
                return;
            if (exec.parent === undefined) {
                /* v8 ignore else -- sequential agent-loop dispatch lets the guard block every later supported call */
                if (captured === undefined)
                    captured = { value: entry.value };
            }
            else {
                /* v8 ignore else -- PTC mode serializes sub-dispatches, so the guard blocks every later supported call */
                if (captured === undefined && pending === undefined) {
                    pending = { parent: exec.parent, value: entry.value };
                }
            }
            return;
        }
        if (pending?.parent !== exec.token)
            return;
        // `pending` co the la `undefined` khi transport ngoai cung khong cho; giu nguyen hanh vi ban goc:
        // chi chay tiep khi co muc cho (truoc day kieu `pending` da bao dam, ban port noi rong nen phai kiem).
        const entry = pending;
        if (entry === undefined)
            return;
        pending = undefined;
        if (result.isError)
            return;
        /* v8 ignore else -- PTC mode serializes outer executions, so the guard blocks every later supported call */
        if (captured === undefined)
            captured = { value: entry.value };
    });
    return {
        captured: () => captured,
        acceptsInput: () => staged.size === 0 && pending === undefined && captured === undefined,
    };
}
