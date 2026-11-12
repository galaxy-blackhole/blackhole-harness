/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 testing.js (24 dòng): fixture CHUẨN về định nghĩa tool cho test của repo —
 *      `defineContentToolFixture` dựng một tool mà giá trị chuẩn CHÍNH LÀ các content block của nó.
 *      Tool sản phẩm phải khai DTO do miền của nó sở hữu, không dùng fixture này.
 */

import type { ContentBlock } from "@deepseek-ai/dsh-llm";
import type { JsonValue } from "@deepseek-ai/dsh-util-values";
import type { ToolDefinition, ToolRunContext } from "./index.ts";
import type { DefineToolOptions, InferArgs, ParameterSchemaSpec } from "./schema.ts";
import { defineTool } from "./schema.ts";

/** Schema giá trị chuẩn của fixture: một mảng, mỗi phần tử là JSON bất kỳ (không ràng buộc thêm). */
const CONTENT_VALUE_SCHEMA = { type: "array", items: { type: "json" } } as const;

/**
 * Tham số cho một fixture mà giá trị chuẩn của nó là mảng content đã render.
 * Nhận: các trường fixture thông thường (`name`, `description`, `parameters`, …) trừ `output` và
 *        `execute`, cộng một thân `execute` sinh ra content block.
 * Trả: kiểu options dùng cho {@link defineContentToolFixture}; không có giá trị lúc chạy.
 */
export type ContentToolFixtureOptions<S extends ParameterSchemaSpec> = Omit<
  DefineToolOptions<S, typeof CONTENT_VALUE_SCHEMA>,
  "output" | "execute"
> & {
  /** Sinh các content block của fixture làm giá trị chuẩn cho test. */
  execute(args: InferArgs<S>, exec: ToolRunContext): Promise<ContentBlock[]>;
};

/**
 * Định nghĩa một fixture test CỐ Ý dùng các content block của nó làm giá trị JSON chuẩn. Tool sản
 * phẩm phải khai DTO do miền của nó sở hữu thay vào đó.
 * Nhận: `options` — các trường fixture thông thường cộng một thân sinh content.
 * Trả: một tool sẵn sàng đăng ký registry, với hợp đồng đầu ra là mảng JSON tường minh.
 * @throws {ToolArgsError} khi tham số do model sinh không khớp schema tham số của fixture (do
 *        `defineTool` ném trong lúc chạy lời gọi).
 * @internal
 */
export function defineContentToolFixture<const S extends ParameterSchemaSpec>(
  options: ContentToolFixtureOptions<S>,
): ToolDefinition {
  // oxlint-disable-next-line typescript/unbound-method
  const execute = options.execute;
  return defineTool({
    ...options,
    output: {
      schema: CONTENT_VALUE_SCHEMA,
      // Fixture CỐ Ý dùng chính content block làm giá trị JSON chuẩn, nên hai phép ép kiểu ở đây chỉ
      // để tsc chấp nhận hợp đồng mảng JSON tường minh của fixture; chúng bị xoá khi build nên hành vi
      // lúc chạy y hệt `lib/types/testing.js` của bản gốc.
      render: (_args, value) => value as unknown as ContentBlock[],
    },
    async execute(args, exec) {
      return (await execute(args, exec)) as unknown as JsonValue[];
    },
  });
}
