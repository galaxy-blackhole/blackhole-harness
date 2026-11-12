/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Kiểm tra lúc chạy cho phong bì RPC của Connection — bản viết lại không dùng thư viện schema ngoài
 */

/**
 * Bộ kiểm tối thiểu có ĐÚNG ngữ nghĩa mà phong bì RPC cần: object bỏ khoá lạ nhưng đòi khoá bắt buộc,
 * literal so khớp chính xác, union lấy nhánh khớp đầu tiên. Cố ý KHÔNG phải một thư viện schema đầy đủ —
 * chỉ đủ để giữ nguyên hợp đồng dây của bản gốc mà không kéo thêm phụ thuộc.
 */
export interface SchemaLike<T> {
  /** Phân tích, trả về giá trị đã làm sạch. */
  parse(value: unknown): T;
  /** Phân tích không ném: trả về thành công kèm dữ liệu, hoặc thất bại kèm thông điệp. */
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { message: string } };
  /** Cho phép vắng (undefined) — dùng cho trường tuỳ chọn. */
  optional(): SchemaLike<T | undefined>;
}

/** Lỗi phân tích, mang thông điệp mô tả đường đi của trường sai. */
function fail(path: string, expected: string): never {
  throw new TypeError("client-connection schema: " + (path === "" ? "value" : path) + " must be " + expected);
}

/** Bọc một hàm kiểm thành SchemaLike. */
function make<T>(check: (value: unknown, path: string) => T): SchemaLike<T> {
  const schema: SchemaLike<T> = {
    parse: (value) => check(value, ""),
    safeParse: (value) => {
      try {
        return { success: true, data: check(value, "") };
      } catch (error) {
        return { success: false, error: { message: error instanceof Error ? error.message : String(error) } };
      }
    },
    optional: () => optionalOf(schema),
  };
  return schema;
}

/** Schema chấp nhận mọi giá trị, kể cả undefined. */
function optionalOf<T>(inner: SchemaLike<T>): SchemaLike<T | undefined> {
  return make<T | undefined>((value, path) => (value === undefined ? undefined : inner.parse(value)));
}

/**
 * Schema chuỗi.
 * Nhận: không.
 * Trả: SchemaLike<string> — ném TypeError khi giá trị không phải chuỗi.
 */
export function stringSchema(): SchemaLike<string> {
  return make((value, path) => {
    if (typeof value !== "string") fail(path, "a string");
    return value;
  });
}

/**
 * Schema literal đúng một giá trị.
 * Nhận: expected — giá trị duy nhất được chấp nhận.
 * Trả: SchemaLike<T> — ném TypeError khi giá trị khác expected.
 */
export function literalSchema<T extends string | number | boolean>(expected: T): SchemaLike<T> {
  return make((value, path) => {
    if (value !== expected) fail(path, JSON.stringify(expected));
    return expected;
  });
}

/** Schema chấp nhận mọi giá trị (không kiểm gì). */
export function unknownSchema(): SchemaLike<unknown> {
  return make((value) => value);
}

/** Schema bản ghi chuỗi → giá trị chưa biết. */
export function recordSchema(): SchemaLike<Record<string, unknown>> {
  return make((value, path) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "a record");
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = entry;
    return out;
  });
}

/** Schema object: bỏ khoá lạ, đòi mọi khoá đã khai (trừ khoá optional). */
export function objectSchema<Shape extends Record<string, SchemaLike<unknown>>>(shape: Shape): SchemaLike<{ [K in keyof Shape]: unknown }> {
  return make((value, path) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "an object");
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      const field = shape[key];
      if (field === undefined) continue;
      out[key] = field.parse(source[key]);
    }
    return out as { [K in keyof Shape]: unknown };
  });
}

/**
 * Schema union: nhánh khớp đầu tiên thắng.
 * Nhận: options — danh sách nhánh, xét theo thứ tự.
 * Trả: SchemaLike<T> — ném TypeError kèm lý do của nhánh CUỐI khi không nhánh nào khớp.
 */
export function unionSchema<T>(options: readonly SchemaLike<T>[]): SchemaLike<T> {
  return make((value, path) => {
    let last = "a known variant";
    for (const option of options) {
      const result = option.safeParse(value);
      if (result.success) return result.data;
      last = result.error.message;
    }
    throw new TypeError("client-connection schema: " + (path === "" ? "value" : path) + " must match " + last);
  });
}

/**
 * Schema union phân biệt theo một khoá literal.
 * Nhận: key — tên khoá phân biệt; options — danh sách nhánh.
 * Trả: SchemaLike<T> — nhánh đầu tiên vừa parse được vừa khớp giá trị khoá; ném TypeError khi không nhánh nào.
 */
export function discriminatedUnionSchema<T extends Record<string, unknown>>(key: string, options: readonly SchemaLike<T>[]): SchemaLike<T> {
  return make((value, path) => {
    if (typeof value !== "object" || value === null) fail(path, "an object");
    const tag = (value as Record<string, unknown>)[key];
    for (const option of options) {
      const parsed = option.safeParse(value);
      if (parsed.success && (parsed.data as Record<string, unknown>)[key] === tag) return parsed.data;
    }
    fail(path, "a known " + key + " variant");
  });
}

/** Id tương quan sau khi đã qua kiểm tra dây. */
export const rpcIdSchema: SchemaLike<string> = stringSchema();

/** Thất bại chung của một endpoint, mang trong phong bì phản hồi. */
export const rpcErrorSchema: SchemaLike<{ code: string; message: string; details: Record<string, unknown> }> = objectSchema({
  code: stringSchema(),
  message: stringSchema(),
  details: recordSchema(),
}) as SchemaLike<{ code: string; message: string; details: Record<string, unknown> }>;

/**
 * Dựng bộ phân tích kết quả cho một bộ phân tích giá trị thành công của endpoint.
 * @param value - bộ phân tích giá trị thành công do endpoint sở hữu.
 * @returns bộ phân tích cho hoặc giá trị thành công, hoặc thất bại chung.
 */
export function rpcResultSchema(value: SchemaLike<unknown>): SchemaLike<unknown> {
  return unionSchema<unknown>([
    objectSchema({ ok: literalSchema(true), value }) as SchemaLike<unknown>,
    objectSchema({ ok: literalSchema(false), error: rpcErrorSchema }) as SchemaLike<unknown>,
  ]);
}

/** Phong bì yêu cầu của client; việc kiểm payload thuộc về endpoint sở hữu nó. */
export const clientRequestSchema: SchemaLike<{ type: "client-request"; rpcId: string; method: string; payload: unknown }> = objectSchema({
  type: literalSchema("client-request"),
  rpcId: rpcIdSchema,
  method: stringSchema(),
  payload: unknownSchema(),
}) as SchemaLike<{ type: "client-request"; rpcId: string; method: string; payload: unknown }>;

/** Phong bì phản hồi của server; việc kiểm giá trị endpoint thuộc về bên gọi nó. */
export const serverResponseSchema: SchemaLike<{ type: "server-response"; rpcId: string; result: unknown }> = objectSchema({
  type: literalSchema("server-response"),
  rpcId: rpcIdSchema,
  result: rpcResultSchema(unknownSchema().optional()),
}) as SchemaLike<{ type: "server-response"; rpcId: string; result: unknown }>;

/** Một trong hai chiều của phong bì RPC Connection. */
export const rpcMessageSchema: SchemaLike<unknown> = discriminatedUnionSchema("type", [clientRequestSchema as SchemaLike<Record<string, unknown>>, serverResponseSchema as SchemaLike<Record<string, unknown>>]) as SchemaLike<unknown>;
