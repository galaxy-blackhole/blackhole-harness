/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Tập con JSON Schema được DSH thi hành: dùng chung cho đầu ra tool, kiểu PTC sinh tự động, subagent
 *      và workflow — nhận mọi gốc JSON, schema chỉ-annotation, một `type` vô hướng, `properties`/`required`/
 *      `additionalProperties` kiểu boolean của object, `items` của array, `enum`/`const` đúng kiểu vô hướng
 *      và `oneOf` đúng-một; từ khoá lạ hoặc đặt sai chỗ đều bị TỪ CHỐI thay vì được nhận mà không thi hành.
 */

/**
 * Enforced JSON Schema subset shared by tool outputs, generated PTC mode
 * types, subagents, and workflows. The subset accepts any JSON root, an
 * annotation-only schema for unconstrained JSON, one scalar `type`, object
 * `properties`/`required`/boolean `additionalProperties`, array `items`,
 * type-correct scalar `enum`/`const`, and exact-one `oneOf`.
 *
 * Unsupported or misplaced keywords reject rather than being accepted without
 * enforcement. Consumers that require an object root apply
 * {@link assertObjectJsonSchema} before accepting input.
 * @module dsh-tools/json-schema
 */
import { HarnessError } from "@deepseek-ai/dsh-llm";
import { assertNever, isJsonValue, type JsonValue } from "@deepseek-ai/dsh-util-values";

/**
 * Giá trị vô hướng JSON mà `enum` và `const` chấp nhận.
 * Nhận: không. Trả: kiểu hợp của bốn giá trị vô hướng JSON.
 */
export type JsonSchemaScalar = string | number | boolean | null;

/**
 * Từ khoá `type` đơn mà tập con được thi hành chấp nhận.
 * Nhận: không. Trả: kiểu hợp của bảy tên kiểu.
 */
export type JsonSchemaType = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";

/**
 * Một nút JSON Schema thô thuộc tập con được thi hành. Các trường tuỳ chọn diễn tả đúng schema trên dây;
 * {@link assertSupportedJsonSchema} từ chối mọi tổ hợp sai trước khi người gọi coi nút là tin cậy.
 * Nhận: hình dạng schema thô do người gọi cấp. Trả: kiểu nút dùng chung cho consumer và bộ kiểm.
 */
export interface JsonSchemaNode {
  /** Bỏ trống để không ràng buộc (mọi giá trị JSON), hoặc dùng `oneOf`. */
  type?: JsonSchemaType;
  /** Đúng một nhánh phải hợp lệ; cần ít nhất hai nhánh. */
  oneOf?: JsonSchemaNode[];
  /** Schema của từng thuộc tính (chỉ với `type: 'object'`). */
  properties?: Record<string, JsonSchemaNode>;
  /** Tên các thuộc tính bắt buộc; mỗi tên phải có mặt trong `properties`. */
  required?: string[];
  /** `false` từ chối khoá không khai báo; vắng mặt hoặc `true` theo mặc định mở của JSON Schema. */
  additionalProperties?: boolean;
  /** Schema của phần tử (chỉ với `type: 'array'`); vắng mặt thì nhận mọi phần tử JSON. */
  items?: JsonSchemaNode;
  /** Các giá trị được phép của nút vô hướng. */
  enum?: JsonSchemaScalar[];
  /** Giá trị duy nhất được phép của nút vô hướng. */
  const?: JsonSchemaScalar;
  /** Annotation, bỏ qua khi kiểm. */
  description?: string;
  /** Annotation, bỏ qua khi kiểm. */
  title?: string;
  /** Annotation, bỏ qua khi kiểm nhưng phải là JSON không mất mát. */
  default?: JsonValue;
  /** Annotation, bỏ qua khi kiểm nhưng phải là JSON không mất mát. */
  examples?: JsonValue;
}

/**
 * Schema có gốc là object do consumer ràng buộc (structured output của subagent và workflow).
 * Nhận: một nút schema. Trả: kiểu đã hẹp `type: 'object'` cho consumer cần gốc object.
 */
export type ObjectJsonSchema = JsonSchemaNode & {
  type: "object";
};

/**
 * Lỗi ném ra khi schema thô nằm ngoài tập con được thi hành. `violations` liệt kê MỌI đường dẫn sai
 * thay vì dừng ở lỗi tác giả đầu tiên.
 * Nhận: mảng vi phạm theo thứ tự duyệt. Trả: lớp lỗi mang mã `UNSUPPORTED_SCHEMA` để route theo `code`.
 */
export class JsonSchemaError extends HarnessError {
  /** Từng vi phạm schema theo thứ tự duyệt. */
  readonly violations: string[];

  /**
   * Dựng lỗi từ danh sách vi phạm.
   * Nhận: violations — các vi phạm đã gom theo thứ tự duyệt.
   * Trả: thực thể Error với thông điệp `unsupported JSON schema: …`, mã `UNSUPPORTED_SCHEMA` và name `JsonSchemaError`.
   */
  constructor(violations: string[]) {
    super(`unsupported JSON schema: ${violations.join("; ")}`, "UNSUPPORTED_SCHEMA");
    this.name = "JsonSchemaError";
    this.violations = violations;
  }
}

const CONSTRAINT_KEYWORDS = new Set([
  "type",
  "oneOf",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const",
]);
const ANNOTATION_KEYWORDS = new Set(["description", "title", "default", "examples"]);
const SCHEMA_TYPES: readonly string[] = ["object", "array", "string", "number", "integer", "boolean", "null"];
/* jscpd:ignore-start -- this realm boundary mirrors the session-owned lossless-JSON intrinsic test */
/**
 * Kiểm một prototype gốc của realm có đúng constructor gốc hay không.
 * Nhận: prototype — prototype cần kiểm; name — tên constructor mong đợi.
 * Trả: true khi descriptor `constructor` là hàm gốc cùng tên, cùng prototype và thân native.
 */
function hasIntrinsicConstructor(prototype: object, name: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "constructor");
  const constructor = descriptor?.value;
  if (typeof constructor !== "function") return false;
  try {
    return (
      constructor.name === name &&
      constructor.prototype === prototype &&
      Function.prototype.toString.call(constructor) === `function ${name}() { [native code] }`
    );
  } catch {
    return false;
  }
}
/**
 * Kiểm một giá trị có là `Object.prototype` gốc của một realm.
 * Nhận: value — giá trị cần kiểm.
 * Trả: true khi giá trị có prototype `null` và constructor gốc `Object`.
 */
function isIntrinsicObjectPrototype(value: object): boolean {
  return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}
/**
 * Kiểm một giá trị có phải bản ghi JSON thuần, không phụ thuộc realm, không nhận array hay object lạ.
 * Nhận: value — giá trị ứng viên từ bất kỳ realm JavaScript nào.
 * Trả: true khi giá trị có chuỗi prototype của object thuần.
 */
export function isPlainJsonRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype(prototype);
  } catch {
    return false;
  }
}
/**
 * Kiểm một array có dùng đúng `Array.prototype` gốc của một realm.
 * Nhận: value — array cần kiểm.
 * Trả: true khi prototype của array là intrinsic và prototype của nó là `Object.prototype` gốc.
 */
function hasPlainArrayPrototype(value: unknown[]): boolean {
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(prototype) || !hasIntrinsicConstructor(prototype, "Array")) return false;
  const objectPrototype = Object.getPrototypeOf(prototype);
  return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype(objectPrototype);
}
/* jscpd:ignore-end */
/**
 * Kiểm một bản ghi chỉ chứa khoá chuỗi thuộc chính nó và đếm được.
 * Nhận: value — bản ghi cần kiểm.
 * Trả: true khi mọi khoá đều là chuỗi và propertyIsEnumerable.
 */
function hasOnlyEnumerableStringKeys(value: Record<string, unknown>): boolean {
  try {
    return Reflect.ownKeys(value).every(
      (key) => typeof key === "string" && Object.prototype.propertyIsEnumerable.call(value, key),
    );
  } catch {
    return false;
  }
}
/**
 * Kiểm một bản ghi schema thường, khoá của nó sống sót qua phép chiếu JSON.
 * Nhận: value — giá trị ứng viên từ bất kỳ realm JavaScript nào.
 * Trả: true khi bản ghi có prototype intrinsic và chỉ chứa khoá chuỗi thuộc chính nó, đếm được.
 */
export function isJsonSchemaRecord(value: unknown): value is Record<string, unknown> {
  return isPlainJsonRecord(value) && hasOnlyEnumerableStringKeys(value);
}
/**
 * Kiểm một array thường, dày, không có trang trí vô hình với JSON.
 * Nhận: value — array ứng viên từ bất kỳ realm JavaScript nào.
 * Trả: true khi array là intrinsic, dày và không bị gắn thêm khoá.
 */
export function isPlainJsonArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  try {
    if (!hasPlainArrayPrototype(value) || Reflect.ownKeys(value).length !== value.length + 1) return false;
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
/**
 * Số JSON hữu hạn không mất mát, loại trừ âm không.
 * Nhận: value — giá trị cần kiểm.
 * Trả: true khi value là number hữu hạn và không phải `-0`.
 */
function isJsonNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0);
}
/** Tập kiểu vô hướng mà `enum`/`const` và phép so khớp vô hướng dùng (bản JS mất kiểu này khi biên dịch). */
type JsonSchemaScalarType = Exclude<JsonSchemaType, "object" | "array">;
/**
 * Kiểm một giá trị vô hướng có đúng kiểu đã khai của schema hay không.
 * Nhận: type — kiểu vô hướng đã khai; value — giá trị cần kiểm.
 * Trả: true khi giá trị khớp kiểu đó.
 */
function scalarMatches(type: JsonSchemaScalarType, value: unknown): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return isJsonNumber(value);
    case "integer":
      return isJsonNumber(value) && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    /* v8 ignore next -- JsonSchemaScalarType is closed; this retains compile-time exhaustiveness. */
    default:
      return assertNever(type, "JsonSchemaType");
  }
}
/** Keywords that are invalid beside `oneOf`. */
const ONE_OF_SIBLING_KEYWORDS = ["properties", "required", "additionalProperties", "items", "enum", "const"];
/**
 * Kiểm các trường chỉ dành cho object sau khi schema của từng thuộc tính đã được duyệt.
 * Nhận: node — nút schema; path — đường dẫn chẩn đoán; properties — giá trị `properties` thô;
 *       violations — mảng gom vi phạm.
 * Trả: không; vi phạm được đẩy vào `violations`.
 */
function checkObjectSchemaTail(node: Record<string, unknown>, path: string, properties: unknown, violations: string[]): void {
  const hasRequired = Object.hasOwn(node, "required");
  const required = hasRequired ? node.required : undefined;
  if (hasRequired) {
    if (!isPlainJsonArray(required) || required.some((entry) => typeof entry !== "string")) {
      violations.push(`${path}.required must be an array of strings`);
    } else {
      const declared: Record<string, unknown> = isJsonSchemaRecord(properties) ? properties : {};
      // Mọi phần tử của `required` đã được kiểm là string ngay trên; đây chỉ là hẹp kiểu cho Object.hasOwn.
      for (const key of required as string[]) {
        if (!Object.hasOwn(declared, key)) violations.push(`${path}.required names "${key}" which is not in properties`);
      }
    }
  }
  if (Object.hasOwn(node, "additionalProperties") && typeof node.additionalProperties !== "boolean") {
    violations.push(`${path}.additionalProperties must be a boolean`);
  }
}
/** Một việc trong ngăn xếp duyệt schema thô (không dùng call stack của JavaScript). */
type SchemaCheckTask =
  | { kind: "enter"; node: unknown; path: string }
  | { kind: "leave"; node: Record<string, unknown> }
  | { kind: "one-of-tail"; node: Record<string, unknown>; path: string }
  | { kind: "object-tail"; node: Record<string, unknown>; path: string; properties: unknown };
/**
 * Gom mọi vi phạm của một cây schema thô mà không dùng call stack của JavaScript.
 * Nhận: root — nút gốc; rootPath — nhãn gốc trong chẩn đoán; violations — mảng gom vi phạm;
 *       seen — tập nút đang duyệt để phát hiện vòng.
 * Trả: không; vi phạm được đẩy vào `violations` theo thứ tự duyệt.
 */
function checkSchemaNode(root: unknown, rootPath: string, violations: string[], seen: Set<Record<string, unknown>>): void {
  const tasks: SchemaCheckTask[] = [{ kind: "enter", node: root, path: rootPath }];
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    if (task.kind === "leave") {
      seen.delete(task.node);
      continue;
    }
    if (task.kind === "one-of-tail") {
      for (const key of ONE_OF_SIBLING_KEYWORDS) {
        if (Object.hasOwn(task.node, key)) violations.push(`${task.path}.${key} is not supported beside oneOf`);
      }
      continue;
    }
    if (task.kind === "object-tail") {
      checkObjectSchemaTail(task.node, task.path, task.properties, violations);
      continue;
    }
    const { node, path } = task;
    if (!isJsonSchemaRecord(node)) {
      violations.push(`${path} must be a schema object`);
      continue;
    }
    if (seen.has(node)) {
      violations.push(`${path} is circular`);
      continue;
    }
    seen.add(node);
    tasks.push({ kind: "leave", node });
    for (const key of Object.keys(node)) {
      if (CONSTRAINT_KEYWORDS.has(key)) continue;
      if (ANNOTATION_KEYWORDS.has(key)) {
        try {
          if (!isJsonValue(node[key])) violations.push(`${path}.${key} annotation must be lossless JSON data`);
        } catch {
          violations.push(`${path}.${key} annotation must be lossless JSON data`);
        }
        continue;
      }
      violations.push(
        `${path}.${key} is not a supported keyword (subset: type/oneOf/properties/required/additionalProperties/items/enum/const + annotations)`,
      );
    }
    if (Object.hasOwn(node, "description") && typeof node.description !== "string") {
      violations.push(`${path}.description must be a string`);
    }
    if (Object.hasOwn(node, "title") && typeof node.title !== "string") {
      violations.push(`${path}.title must be a string`);
    }
    const hasType = Object.hasOwn(node, "type");
    const hasOneOf = Object.hasOwn(node, "oneOf");
    if (hasType && hasOneOf) {
      violations.push(`${path} cannot declare both type and oneOf`);
      continue;
    }
    if (!hasType && !hasOneOf) {
      for (const key of ONE_OF_SIBLING_KEYWORDS) {
        if (Object.hasOwn(node, key)) violations.push(`${path}.${key} requires type or oneOf`);
      }
      continue;
    }
    if (hasOneOf) {
      const oneOf = node.oneOf;
      tasks.push({ kind: "one-of-tail", node, path });
      if (!isPlainJsonArray(oneOf) || oneOf.length < 2) {
        violations.push(`${path}.oneOf must be an array of at least two schemas`);
      } else {
        for (let index = oneOf.length - 1; index >= 0; index--) {
          tasks.push({ kind: "enter", node: oneOf[index], path: `${path}.oneOf[${index}]` });
        }
      }
      continue;
    }
    const type = node.type;
    if (typeof type !== "string" || !SCHEMA_TYPES.includes(type)) {
      violations.push(
        Array.isArray(type)
          ? `${path}.type must be a single type string (type arrays are not supported)`
          : `${path}.type must be one of ${SCHEMA_TYPES.join("/")}`,
      );
      continue;
    }
    // Đã kiểm type thuộc SCHEMA_TYPES ngay trên; đây chỉ là hẹp kiểu cho switch bên dưới.
    const schemaType = type as JsonSchemaType;
    const allowedFor: Record<string, readonly JsonSchemaType[]> = {
      properties: ["object"],
      required: ["object"],
      additionalProperties: ["object"],
      items: ["array"],
      enum: ["string", "number", "integer", "boolean", "null"],
      const: ["string", "number", "integer", "boolean", "null"],
    };
    for (const [key, types] of Object.entries(allowedFor)) {
      if (Object.hasOwn(node, key) && !types.includes(schemaType)) {
        violations.push(`${path}.${key} is not supported on type "${schemaType}"`);
      }
    }
    switch (schemaType) {
      case "object": {
        const properties = Object.hasOwn(node, "properties") ? node.properties : undefined;
        tasks.push({ kind: "object-tail", node, path, properties });
        if (Object.hasOwn(node, "properties")) {
          if (!isJsonSchemaRecord(properties)) {
            violations.push(`${path}.properties must be an object of schemas`);
          } else {
            const entries = Object.entries(properties);
            for (let index = entries.length - 1; index >= 0; index--) {
              const entry = entries[index];
              /* v8 ignore next -- the loop is bounded by the captured entry count. */
              if (entry === undefined) continue;
              tasks.push({ kind: "enter", node: entry[1], path: `${path}.properties.${entry[0]}` });
            }
          }
        }
        break;
      }
      case "array": {
        if (Object.hasOwn(node, "items")) tasks.push({ kind: "enter", node: node.items, path: `${path}.items` });
        break;
      }
      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "null": {
        const hasEnum = Object.hasOwn(node, "enum");
        const allowed = hasEnum ? node.enum : undefined;
        // isPlainJsonArray chỉ hẹp kiểu trong biểu thức, nên tách biến để phần kiểm bên dưới dùng lại được.
        const enumValues: unknown[] = isPlainJsonArray(allowed) ? allowed : [];
        const enumValid = enumValues.length > 0 && enumValues.every((entry) => scalarMatches(schemaType, entry));
        if (hasEnum && !enumValid) {
          violations.push(`${path}.enum must be a non-empty array of ${schemaType} values`);
        }
        const hasConst = Object.hasOwn(node, "const");
        const declaredConst = hasConst ? node.const : undefined;
        const constValid = scalarMatches(schemaType, declaredConst);
        if (hasConst) {
          if (!constValid) {
            violations.push(`${path}.const must be a ${schemaType} value`);
          } else if (enumValid && !enumValues.includes(declaredConst)) {
            violations.push(`${path}.const must be one of ${path}.enum when both are declared`);
          }
        }
        break;
      }
      /* v8 ignore next -- schemaType was narrowed from the closed SCHEMA_TYPES table above. */
      default:
        assertNever(schemaType, "JsonSchemaType");
    }
  }
}
/**
 * Khẳng định một schema thô tuỳ ý chỉ dùng tập con được thi hành. Schema chỉ có annotation được nhận
 * làm dạng chuẩn của JSON không ràng buộc; người gọi cần gốc object thì dùng {@link assertObjectJsonSchema}.
 * Nhận: schema — JSON Schema thô chưa tin cậy.
 * Trả: khẳng định schema thuộc tập con được hỗ trợ (không trả giá trị).
 * @throws {JsonSchemaError} khi schema có ít nhất một vi phạm.
 */
export function assertSupportedJsonSchema(schema: unknown): asserts schema is JsonSchemaNode {
  const violations: string[] = [];
  checkSchemaNode(schema, "schema", violations, new Set());
  if (violations.length > 0) throw new JsonSchemaError(violations);
}
/**
 * Khẳng định tập con được thi hành kèm ràng buộc gốc object mà structured output của subagent và
 * workflow giữ lại.
 * Nhận: schema — schema do người gọi cấp, chưa tin cậy.
 * Trả: khẳng định schema thuộc tập con được hỗ trợ và có gốc object.
 * @throws {JsonSchemaError} khi schema vi phạm tập con hoặc không có `type: 'object'`.
 */
export function assertObjectJsonSchema(schema: unknown): asserts schema is ObjectJsonSchema {
  const violations: string[] = [];
  checkSchemaNode(schema, "schema", violations, new Set());
  if (
    violations.length === 0 &&
    (!isJsonSchemaRecord(schema) || !Object.hasOwn(schema, "type") || schema.type !== "object")
  ) {
    violations.push('schema.type must be "object" (structured output is object-rooted)');
  }
  if (violations.length > 0) throw new JsonSchemaError(violations);
}
/**
 * Kiểm ranh giới JSON không mất mát một cách an toàn khi getter có thể ném lỗi.
 * Nhận: value — giá trị cần kiểm.
 * Trả: true khi value sống sót qua một lượt JSON mà không mất mát; false cả khi getter ném lỗi.
 */
function safelyIsJsonValue(value: unknown): boolean {
  try {
    return isJsonValue(value);
  } catch {
    return false;
  }
}
/**
 * Đường dẫn chẩn đoán biết gốc cho sentinel rỗng của bộ kiểm tham số.
 * Nhận: path — đường dẫn hiện tại (có thể rỗng).
 * Trả: `arguments` khi đường dẫn rỗng, ngược lại chính đường dẫn đó.
 */
function diagnosticPath(path: string): string {
  return path === "" ? "arguments" : path;
}
/**
 * Nối một thuộc tính object không kèm dấu chấm khi ở gốc ngầm định.
 * Nhận: path — đường dẫn hiện tại; key — tên thuộc tính.
 * Trả: đường dẫn mới cho thuộc tính đó.
 */
function propertyPath(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}
/**
 * Chẩn đoán bao ngoại lệ chung do một nút schema hợp lệ sở hữu.
 * Nhận: path — đường dẫn của nút.
 * Trả: mảng một vi phạm về giá trị JSON không mất mát.
 */
function losslessValueViolation(path: string): string[] {
  return [`"${diagnosticPath(path)}" must be a lossless JSON value`];
}
/**
 * Nối chẩn đoán mà không trải kết quả con có thể rất rộng thành tham số gọi.
 * Nhận: target — mảng đích; source — mảng vi phạm cần nối thêm.
 * Trả: không; `target` được nối tại chỗ.
 */
function appendViolations(target: string[], source: string[]): void {
  for (const violation of source) target.push(violation);
}
/** Một cặp schema/giá trị con trong ngăn xếp kiểm giá trị. */
interface SchemaValueChild {
  /** Schema áp cho giá trị con. */
  node: JsonSchemaNode;
  /** Giá trị con cần kiểm. */
  value: unknown;
  /** Đường dẫn chẩn đoán của giá trị con. */
  path: string;
}
/** Một khung kiểm giá trị, giữ trạng thái gộp thay cho lời gọi đệ quy. */
interface ValueFrame {
  /** Schema của khung. */
  node: JsonSchemaNode;
  /** Giá trị đang kiểm. */
  value: unknown;
  /** Đường dẫn chẩn đoán. */
  path: string;
  /** Khung này có nuốt ngoại lệ của con hay không. */
  catches: boolean;
  /** Pha duyệt: `start` mới bắt đầu, `children` đang duyệt con. */
  phase: "start" | "children";
  /** Loại khung khi đang duyệt con. */
  kind?: "object" | "array" | "oneOf";
  /** Các cặp con theo thứ tự. */
  children: SchemaValueChild[];
  /** Chỉ số con kế tiếp. */
  childIndex: number;
  /** Vi phạm của chính khung (ví dụ thuộc tính bắt buộc bị thiếu). */
  violations: string[];
  /** Vi phạm chỉ được gộp sau khi mọi con đã duyệt xong. */
  tailViolations: string[];
  /** Số nhánh `oneOf` khớp. */
  matches: number;
}
/**
 * Khởi tạo một khung kiểm giá trị với trạng thái gộp rỗng.
 * Nhận: node — nút schema; value — giá trị cần kiểm; path — đường dẫn chẩn đoán.
 * Trả: khung ở pha `start`, chưa có con và chưa có vi phạm.
 */
function valueFrame(node: JsonSchemaNode, value: unknown, path: string): ValueFrame {
  return {
    node,
    value,
    path,
    catches: false,
    phase: "start",
    children: [],
    childIndex: 0,
    violations: [],
    tailViolations: [],
    matches: 0,
  };
}
/**
 * Kiểm một nút vô hướng sau khi đã kiểm kiểu nguyên thuỷ.
 * Nhận: node — nút schema; value — giá trị vô hướng đã đúng kiểu; path — đường dẫn chẩn đoán.
 * Trả: danh sách vi phạm; rỗng nghĩa là hợp lệ.
 */
function checkScalarValue(node: JsonSchemaNode, value: JsonSchemaScalar, path: string): string[] {
  const allowed = Object.hasOwn(node, "enum") ? node.enum : undefined;
  if (allowed !== undefined && !allowed.includes(value)) {
    return [`"${diagnosticPath(path)}" must be one of ${JSON.stringify(allowed)}`];
  }
  if (Object.hasOwn(node, "const") && value !== node.const) {
    return [`"${diagnosticPath(path)}" must be ${JSON.stringify(node.const)}`];
  }
  return [];
}
/**
 * Kiểm một cặp schema/giá trị tin cậy bằng khung tường minh thay vì lời gọi đệ quy.
 * Nhận: schema — schema đã thuộc tập con; value — giá trị bất kỳ; path — nhãn gốc chẩn đoán.
 * Trả: mọi vi phạm theo thứ tự duyệt; rỗng nghĩa là hợp lệ.
 */
function checkValue(schema: JsonSchemaNode, value: unknown, path: string): string[] {
  const frames: ValueFrame[] = [valueFrame(schema, value, path)];
  let rootResult: string[] | undefined;
  const receive = (result: string[]): void => {
    const parent = frames.at(-1);
    if (parent === undefined) {
      rootResult = result;
      return;
    }
    if (parent.kind === "oneOf") {
      if (result.length === 0) parent.matches++;
    } else {
      appendViolations(parent.violations, result);
    }
  };
  const finish = (result: string[]): void => {
    frames.pop();
    receive(result);
  };
  while (frames.length > 0) {
    const frame = frames.at(-1);
    /* v8 ignore next -- the loop condition guarantees a current frame. */
    if (frame === undefined) break;
    try {
      if (frame.phase === "children") {
        if (frame.childIndex < frame.children.length) {
          const child = frame.children[frame.childIndex];
          /* v8 ignore next -- childIndex is bounded by children.length. */
          if (child === undefined) throw new Error("missing schema-value child frame");
          frame.childIndex++;
          frames.push(valueFrame(child.node, child.value, child.path));
          continue;
        }
        if (frame.kind === "oneOf") {
          finish(
            frame.matches === 1
              ? []
              : [`"${diagnosticPath(frame.path)}" must match exactly one oneOf branch (matched ${frame.matches})`],
          );
          continue;
        }
        appendViolations(frame.violations, frame.tailViolations);
        if (frame.violations.length > 0) {
          finish(frame.violations);
        } else if (frame.kind === "object") {
          finish(
            safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a lossless JSON object`],
          );
        } else {
          finish(
            safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a dense lossless JSON array`],
          );
        }
        continue;
      }
      const nodeType = Object.hasOwn(frame.node, "type") ? frame.node.type : undefined;
      frame.catches = !(nodeType !== undefined && !SCHEMA_TYPES.includes(nodeType));
      const oneOf = Object.hasOwn(frame.node, "oneOf") ? frame.node.oneOf : undefined;
      if (oneOf !== undefined) {
        frame.kind = "oneOf";
        frame.children = Array.from(oneOf, (branch) => ({ node: branch, value: frame.value, path: frame.path }));
        frame.childIndex = 0;
        frame.matches = 0;
        frame.phase = "children";
        continue;
      }
      if (nodeType === undefined) {
        finish(safelyIsJsonValue(frame.value) ? [] : losslessValueViolation(frame.path));
        continue;
      }
      switch (nodeType) {
        case "object": {
          if (!isPlainJsonRecord(frame.value)) {
            finish([`"${diagnosticPath(frame.path)}" must be an object`]);
            break;
          }
          const properties: Record<string, JsonSchemaNode> =
            Object.hasOwn(frame.node, "properties") ? frame.node.properties ?? {} : {};
          const violations: string[] = [];
          const required: string[] = Object.hasOwn(frame.node, "required") ? frame.node.required ?? [] : [];
          for (const key of required) {
            if (!Object.hasOwn(frame.value, key) || frame.value[key] === undefined) {
              violations.push(`missing required property "${propertyPath(frame.path, key)}"`);
            }
          }
          const children: SchemaValueChild[] = [];
          for (const [key, child] of Object.entries(properties)) {
            if (!Object.hasOwn(frame.value, key) || frame.value[key] === undefined) continue;
            children.push({ node: child, value: frame.value[key], path: propertyPath(frame.path, key) });
          }
          const tailViolations: string[] = [];
          if (Object.hasOwn(frame.node, "additionalProperties") && frame.node.additionalProperties === false) {
            for (const key of Object.keys(frame.value)) {
              if (!Object.hasOwn(properties, key)) {
                tailViolations.push(
                  `"${propertyPath(frame.path, key)}" is not a declared property (additionalProperties: false)`,
                );
              }
            }
          }
          frame.kind = "object";
          frame.children = children;
          frame.childIndex = 0;
          frame.violations = violations;
          frame.tailViolations = tailViolations;
          frame.phase = "children";
          break;
        }
        case "array": {
          if (!Array.isArray(frame.value)) {
            finish([`"${diagnosticPath(frame.path)}" must be an array`]);
            break;
          }
          const items = Object.hasOwn(frame.node, "items") ? frame.node.items : undefined;
          const children: SchemaValueChild[] =
            items === undefined
              ? []
              : frame.value.flatMap((entry, index) => [{ node: items, value: entry, path: `${frame.path}[${index}]` }]);
          frame.kind = "array";
          frame.children = children;
          frame.childIndex = 0;
          frame.violations = [];
          frame.phase = "children";
          break;
        }
        case "string":
          finish(
            typeof frame.value === "string"
              ? checkScalarValue(frame.node, frame.value, frame.path)
              : [`"${diagnosticPath(frame.path)}" must be a string`],
          );
          break;
        case "number":
          finish(
            typeof frame.value !== "number"
              ? [`"${diagnosticPath(frame.path)}" must be a number`]
              : !isJsonNumber(frame.value)
                ? [`"${diagnosticPath(frame.path)}" must be a finite JSON number`]
                : checkScalarValue(frame.node, frame.value, frame.path),
          );
          break;
        case "integer":
          finish(
            !isJsonNumber(frame.value) || !Number.isInteger(frame.value)
              ? [`"${diagnosticPath(frame.path)}" must be an integer`]
              : checkScalarValue(frame.node, frame.value, frame.path),
          );
          break;
        case "boolean":
          finish(
            typeof frame.value === "boolean"
              ? checkScalarValue(frame.node, frame.value, frame.path)
              : [`"${diagnosticPath(frame.path)}" must be a boolean`],
          );
          break;
        case "null":
          finish(
            frame.value === null
              ? checkScalarValue(frame.node, frame.value, frame.path)
              : [`"${diagnosticPath(frame.path)}" must be null`],
          );
          break;
        default:
          finish(assertNever(nodeType, "JsonSchemaType"));
      }
    } catch (error) {
      let failed = frames.pop();
      while (failed !== undefined && !failed.catches) failed = frames.pop();
      if (failed === undefined) throw error;
      receive(losslessValueViolation(failed.path));
    }
  }
  /* v8 ignore next -- every root frame finishes or throws. */
  return rootResult ?? losslessValueViolation(path);
}
/**
 * Kiểm một giá trị ứng viên với schema thô đã được khẳng định. Hàm này toàn phần với mọi giá trị
 * và trả về vi phạm kèm đường dẫn.
 * Nhận: schema — schema đã được {@link assertSupportedJsonSchema} chấp nhận; value — giá trị JSON ứng viên;
 *       path — nhãn gốc dùng trong chẩn đoán (mặc định `value`).
 * Trả: toàn bộ vi phạm theo thứ tự duyệt; rỗng nghĩa là hợp lệ.
 */
export function validateJsonSchemaValue(schema: JsonSchemaNode, value: unknown, path = "value"): string[] {
  return checkValue(schema, value, path);
}
