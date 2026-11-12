/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 02/11/2026
 * desc Spec Remote của namespace \`sessionDelete\` cho NỬA CLIENT — dựng bằng bộ \`remote-info\` NỘI BỘ
 *      (chép từ ui-cot-translation), zod lấy qua \`require("zod")\` của bảng module. Bảng module của
 *      trình duyệt KHÔNG cho require gói \`@galaxy-blackhole/gbh-typert-protocol/...\` nên spec phải tự chứa.
 */

import { PACKAGE_NAME } from "./ids.ts";
import { createTypertRemoteInfo } from "./remote-info.ts";
import type { RequireFn, ZodModuleLike, ZodSchemaLike } from "./runtime-types.ts";

/** \`require\` của factory do vỏ cấp — nguồn của zod (KHÔNG import tĩnh: bundle phải chạy trong bảng module). */
declare const require: RequireFn;

/**
 * Nạp zod: ở RUNTIME trình duyệt, `require` do vỏ cấp nên `zod` có sẵn trong bảng module.
 * Khi Bun nạp THẲNG `src/` (test/build), gói này không khai `zod` trong package.json ⇒ phải lấy từ cây kernel.
 * 02/11/2026 — thêm nhánh dự phòng này để `tests/client/ui-session-delete.test.ts` không chết ở bước nạp module
 * (trước đó nó ném `Cannot find package 'zod'` và bị tính là 'unhandled error between tests').
 * Đường dẫn dựng ĐỘNG để Bun.build không cố phân giải tĩnh lúc đóng gói artefact client.
 */
function loadZod(): ZodModuleLike {
  try {
    return require("zod") as ZodModuleLike;
  } catch {
    const kernelSpec = ["..", "..", "..", "..", "apps", "host", "node_modules", "zod"].join("/");
    return require(kernelSpec) as ZodModuleLike;
  }
}

/** Module zod do bảng module của vỏ cấp (hoặc cây kernel khi Bun nạp src). */
const zod = loadZod();

/** Mặt `zod.z` bị kiểu rút gọn của bộ dựng không khai `boolean` — runtime THẬT có, nên mở rộng cục bộ. */
const zb = zod.z as unknown as typeof zod.z & { boolean(): ZodSchemaLike };

/** Schema tham số (dựng lười, cache). */
let requestSchemaValue: ZodSchemaLike | undefined;
const requestSchema = (): ZodSchemaLike =>
  (requestSchemaValue ??= zod.z.object({ sessionId: zod.z.string().readonly() }));

/** Schema kết quả (dựng lười, cache). */
let resultSchemaValue: ZodSchemaLike | undefined;
const resultSchema = (): ZodSchemaLike =>
  (resultSchemaValue ??= zod.z.object({ deleted: zb.boolean(), path: zod.z.string() }));

/** Codec của tham số duy nhất. */
const requestCodec = {
  mode: "strict",
  typeSymbol: PACKAGE_NAME + "/types#SessionDeleteRequest",
  create: requestSchema,
  jsonSchema: {
    type: "object",
    properties: { sessionId: { type: "string", description: "Id phiên cần xoá." } },
    required: ["sessionId"],
    additionalProperties: false,
  },
};

/** Spec Remote mà trình duyệt dùng để dựng proxy \`ctx.remote.sessionDelete\`. */
export const TYPERT_REMOTE = createTypertRemoteInfo({
  package: PACKAGE_NAME,
  methods: {
    "sessionDelete/delete": {
      service: "sessionDelete",
      description: "Delete one stored session for good: remove its log directory and reconcile the index.",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "request",
          description: "Phiên cần xoá.",
          source: "json",
          codec: requestCodec,
          strictCodec: requestCodec,
        },
      ],
      result: {
        mode: "strict",
        typeSymbol: PACKAGE_NAME + "/types#SessionDeleteResult",
        create: resultSchema,
        description: "Đã xoá và đường dẫn thư mục nhật ký vừa gỡ.",
        jsonSchema: {
          type: "object",
          properties: {
            deleted: { type: "boolean", const: true },
            path: { type: "string", description: "Đường dẫn tuyệt đối của thư mục nhật ký đã gỡ." },
          },
          required: ["deleted", "path"],
          additionalProperties: false,
        },
      },
    },
  },
}, zod.z);
