/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chiếu schema Config của plugin thành biểu mẫu chỉ gồm trường SỐNG (volatile) và chiếu giá trị
 *      theo đúng biểu mẫu ấy — phần còn lại của cấu hình đi qua đường vòng đời bình thường.
 */
import z from "@deepseek-ai/schemastery";

import { redactSecrets } from "./redact.ts";
import type { SchemaLike } from "./types.ts";

/**
 * Khoá của cơ chế tham chiếu volatile trong cosmokit.
 * cosmokit khai Symbol.for("cosmokit.volatile.write") ⇒ cùng một khoá ở mọi bản, nên gói này nhận ra
 * tham chiếu volatile mà KHÔNG cần nạp cosmokit (xem README gói §3).
 */
const VOLATILE_KEY = Symbol.for("cosmokit.volatile.write");

/** Hàm dựng schema của schemastery nhìn qua góc hẹp của gói này. */
const SchemaOf = z as unknown as new (options: unknown) => SchemaLike;

/** Hàm dựng schema object của schemastery nhìn qua góc hẹp của gói này. */
const objectOf = z.object as unknown as (dict: Record<string, SchemaLike>) => SchemaLike;

/** Một tham chiếu volatile của cosmokit — đọc ảnh chụp qua get(). */
interface VolatileRef {
  /** Ảnh chụp hiện tại của tham chiếu. */
  get(): unknown;
}

/**
 * Kiểm một giá trị có phải tham chiếu volatile của cosmokit.
 * Nhận: giá trị bất kỳ.
 * Trả: true khi giá trị mang khoá cosmokit.volatile.write (khoá toàn cục, dùng chung mọi bản cosmokit).
 */
function isVolatile(value: unknown): value is VolatileRef {
  return typeof value === "object" && value !== null && VOLATILE_KEY in value;
}

/**
 * Bỏ mọi tham chiếu runtime khỏi một ảnh chụp cấu hình (tham chiếu volatile được thay bằng ảnh chụp).
 * Nhận: giá trị đã phân giải của Config.
 * Trả: bản sao chỉ còn vật dữ liệu thường, dùng được cho phép che secret và biểu mẫu.
 */
export function plainConfig(value: unknown): unknown {
  if (isVolatile(value)) return plainConfig(value.get());
  if (Array.isArray(value)) return value.map(plainConfig);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plainConfig(child)]));
  }
  return value;
}

/**
 * Dựng bản JSON SẠCH của schema: bỏ dấu volatile, bỏ default/required của trường secret và che default của trường thường.
 * Nhận: schema Config đang sống của plugin.
 * Trả: schema mới (cùng hình dạng JSON) dùng được làm biểu mẫu.
 */
function plainSchema(schema: SchemaLike): SchemaLike {
  const result = new SchemaOf(schema.toJSON());
  const walk = (node: SchemaLike): void => {
    delete node.meta.volatile;
    if (node.meta.role === "secret") {
      delete node.meta.default;
      delete node.meta.required;
    } else if (node.meta.default !== undefined) node.meta.default = redactSecrets(node, node.meta.default).value;
    for (const child of Object.values(node.dict ?? {})) walk(child);
    if (node.inner) walk(node.inner);
    for (const child of node.list ?? []) walk(child);
  };
  walk(result);
  return result;
}

/**
 * Chọn những trường mà tổ tiên volatile gần nhất làm chúng sửa được mà không cần nạp lại plugin.
 * Nhận: schema Config của plugin.
 * Trả: schema biểu mẫu phẳng, hoặc undefined khi không trường nào sống.
 */
export function volatileForm(schema: SchemaLike): SchemaLike | undefined {
  if (schema.meta.volatile) return plainSchema(schema);
  if (schema.type === "object") {
    const dict = Object.fromEntries(
      Object.entries(schema.dict ?? {}).flatMap<[string, SchemaLike]>(([key, child]) => {
        const field = volatileForm(child);
        return field === undefined ? [] : [[key, field]];
      }),
    );
    return Object.keys(dict).length === 0 ? undefined : objectOf(dict);
  }
  return undefined;
}

/**
 * Kiểm một nút cấu hình thô có phải biểu thức js chưa phân giải hay không.
 * Nhận: giá trị bất kỳ (thường là object).
 * Trả: true khi object chỉ có đúng một khoá __jsExpr mang chuỗi.
 */
function isExpression(value: object): boolean {
  return Object.keys(value).length === 1 && typeof Reflect.get(value, "__jsExpr") === "string";
}

/**
 * Chiếu CHỈ những trường mà schema khai, bỏ qua cấu hình thường.
 * Nhận: schema biểu mẫu đã lọc + giá trị thô hoặc đã phân giải.
 * Trả: vật chỉ gồm các trường mà biểu mẫu này nhìn thấy.
 */
export function projectForm(schema: SchemaLike, value: unknown): unknown {
  if (schema.type === "object" && value !== null && typeof value === "object" && !isExpression(value)) {
    return Object.fromEntries(
      Object.entries(schema.dict ?? {}).flatMap<[string, unknown]>(([key, child]) => {
        const field = Reflect.get(value, key);
        return field === undefined ? [] : [[key, projectForm(child, field)]];
      }),
    );
  }
  return value;
}

/**
 * Kiểm một đường dẫn trường có nằm dưới một nút volatile đã khai hay không.
 * Nhận: schema Config đầy đủ của plugin + đường dẫn mà biểu mẫu sửa.
 * Trả: true khi đường dẫn sửa được ngay (sống).
 */
export function isVolatilePath(schema: SchemaLike, path: readonly string[]): boolean {
  if (schema.meta.volatile) return true;
  const [key, ...rest] = path;
  const child = key === undefined ? undefined : schema.dict?.[key];
  return child !== undefined && isVolatilePath(child, rest);
}
