/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ai/dsh-tools/schema: DSL schema JSON-value hợp nhất, suy luận kiểu, biên dịch schema và helper defineTool có kiểm kiểu.
 */
import { HarnessError } from "@deepseek-ai/dsh-llm";
import type { ContentBlock } from "@deepseek-ai/dsh-llm";
import type { JsonValue } from "@deepseek-ai/dsh-util-values";
import type { ToolDefinition, ToolExecution, ToolExecutionResult, ToolRunContext, ToolResult } from "./index.ts";
import {
  assertSupportedJsonSchema,
  isJsonSchemaRecord,
  isPlainJsonArray,
  JsonSchemaError,
  validateJsonSchemaValue,
} from "./json-schema.ts";
import type { JsonSchemaNode, JsonSchemaScalar, ObjectJsonSchema } from "./json-schema.ts";
import type { ToolCallView, ToolResultView } from "./presentation.ts";

/** Các khoá annotation mà từ vựng DSL cho phép trên mọi node schema phía tác giả. */
const ANNOTATION_KEYS = ["description", "title", "default", "examples"];

/**
 * Ghi chú không kiểm trị dùng chung cho mọi node schema phía tác giả.
 * Nhận: bốn trường annotation tuỳ chọn (description · title · default · examples).
 * Trả: hình dạng annotation để các spec bên dưới kế thừa.
 */
export interface ValueSchemaAnnotations {
  /** Mô tả người đọc được, chiếu vào JSON Schema và kiểu sinh ra. */
  description?: string;
  /** Tiêu đề người đọc được, chiếu vào JSON Schema. */
  title?: string;
  /** Annotation mặc định không kiểm trị; phải là dữ liệu JSON lossless. */
  default?: JsonValue;
  /** Annotation ví dụ không kiểm trị; phải là dữ liệu JSON lossless. */
  examples?: JsonValue;
}

/**
 * Node schema giá trị chuỗi với ràng buộc literal đúng kiểu.
 * Nhận: type "string" cùng enum/const tuỳ chọn.
 * Trả: hình dạng spec để DSL biên dịch thành JSON Schema.
 */
export interface StringValueSchemaSpec extends ValueSchemaAnnotations {
  type: "string";
  enum?: readonly string[];
  const?: string;
}

/**
 * Node schema số JSON hữu hạn với ràng buộc literal đúng kiểu.
 * Nhận: type "number" cùng enum/const tuỳ chọn.
 * Trả: hình dạng spec để DSL biên dịch thành JSON Schema.
 */
export interface NumberValueSchemaSpec extends ValueSchemaAnnotations {
  type: "number";
  enum?: readonly number[];
  const?: number;
}

/**
 * Node schema số nguyên với ràng buộc literal đúng kiểu.
 * Nhận: type "integer" cùng enum/const tuỳ chọn.
 * Trả: hình dạng spec để DSL biên dịch thành JSON Schema.
 */
export interface IntegerValueSchemaSpec extends ValueSchemaAnnotations {
  type: "integer";
  enum?: readonly number[];
  const?: number;
}

/**
 * Node schema boolean với ràng buộc literal đúng kiểu.
 * Nhận: type "boolean" cùng enum/const tuỳ chọn.
 * Trả: hình dạng spec để DSL biên dịch thành JSON Schema.
 */
export interface BooleanValueSchemaSpec extends ValueSchemaAnnotations {
  type: "boolean";
  enum?: readonly boolean[];
  const?: boolean;
}

/**
 * Node schema null với ràng buộc literal đúng kiểu.
 * Nhận: type "null" cùng enum/const tuỳ chọn.
 * Trả: hình dạng spec để DSL biên dịch thành JSON Schema.
 */
export interface NullValueSchemaSpec extends ValueSchemaAnnotations {
  type: "null";
  enum?: readonly null[];
  const?: null;
}

/**
 * Node schema mảng; bỏ trống items nghĩa là nhận mọi item JSON lossless.
 * Nhận: type "array" cùng items tuỳ chọn.
 * Trả: hình dạng spec để DSL biên dịch thành JSON Schema.
 */
export interface ArrayValueSchemaSpec extends ValueSchemaAnnotations {
  type: "array";
  items?: ValueSchemaSpec;
}

/**
 * Node schema object tường minh. Độ mở là bắt buộc để object lồng nhau hoặc object
 * đầu ra không bao giờ nhận mặc định ngầm của JSON Schema.
 * Nhận: type "object", properties tuỳ chọn và additionalProperties bắt buộc.
 * Trả: hình dạng spec để DSL biên dịch thành JSON Schema.
 */
export interface ObjectValueSchemaSpec extends ValueSchemaAnnotations {
  type: "object";
  properties?: ParameterSchemaSpec;
  additionalProperties: boolean;
}

/**
 * Node JSON lossless không ràng buộc, chỉ tồn tại phía tác giả.
 * Nhận: type "json" cùng annotation tuỳ chọn.
 * Trả: hình dạng spec mà DSL chiếu thành schema chỉ có annotation.
 */
export interface JsonValueSchemaSpec extends ValueSchemaAnnotations {
  type: "json";
}

/**
 * Schema hợp đúng-một; cần ít nhất hai nhánh.
 * Nhận: oneOf là tuple từ hai spec giá trị trở lên.
 * Trả: hình dạng spec để DSL biên dịch thành oneOf của JSON Schema.
 */
export interface OneOfValueSchemaSpec extends ValueSchemaAnnotations {
  oneOf: readonly [ValueSchemaSpec, ValueSchemaSpec, ...ValueSchemaSpec[]];
}

/**
 * Một schema phía tác giả cho mọi gốc giá trị JSON lossless.
 * Nhận: một trong các spec chuỗi/số/số nguyên/boolean/null/mảng/object/json/oneOf.
 * Trả: hợp kiểu mà các hàm biên dịch và defineTool chấp nhận.
 */
export type ValueSchemaSpec =
  | StringValueSchemaSpec
  | NumberValueSchemaSpec
  | IntegerValueSchemaSpec
  | BooleanValueSchemaSpec
  | NullValueSchemaSpec
  | ArrayValueSchemaSpec
  | ObjectValueSchemaSpec
  | JsonValueSchemaSpec
  | OneOfValueSchemaSpec;

/**
 * Một thuộc tính của gốc tham số ngầm, có thể đánh dấu bắt buộc.
 * Nhận: một spec giá trị cùng required tuỳ chọn (chỉ true).
 * Trả: kiểu thuộc tính dùng trong ParameterSchemaSpec.
 */
export type ParameterPropertySpec = ValueSchemaSpec & {
  required?: true;
};

/**
 * Schema tham số của tool. Bản thân map là gốc object mở ngầm; tính bắt buộc
 * vẫn là annotation required: true trên từng thuộc tính.
 * Nhận: map khoá chuỗi tới ParameterPropertySpec.
 * Trả: kiểu tham số mà defineTool suy luận thành đối số có kiểu.
 */
export type ParameterSchemaSpec = {
  [key: string]: ParameterPropertySpec;
  [key: symbol]: never;
};

/**
 * Hình chiếu JSON Schema thô của object tham số ngầm.
 * Nhận: kế thừa ObjectJsonSchema cùng properties bắt buộc.
 * Trả: kiểu schema tham số đã biên dịch.
 */
export interface ParameterJsonSchema extends ObjectJsonSchema {
  properties: Record<string, JsonSchemaNode>;
}

/** Làm phẳng một giao kiểu thành một kiểu object để hover dễ đọc. */
type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

/** Khoá chuỗi của một map thuộc tính; biên dịch runtime từ chối khoá symbol. */
type StringKeyOf<S> = Extract<keyof S, string>;

/** Các khoá của map thuộc tính được đánh dấu required: true. */
type RequiredKeys<S> = {
  [K in StringKeyOf<S>]: S[K] extends {
    required: true;
  }
    ? K
    : never;
}[StringKeyOf<S>];

/** Suy luận giá trị khai báo của một thuộc tính tham số, không kèm tính tuỳ chọn của khoá. */
type InferProperty<P, Depth extends unknown[]> = InferValueAt<P, Depth>;

/** Suy luận một map thuộc tính ngầm thành object có khoá bắt buộc và khoá tuỳ chọn. */
type InferProperties<S, Depth extends unknown[]> = Simplify<
  {
    [K in RequiredKeys<S>]: InferProperty<S[K], Depth>;
  } & {
    [K in Exclude<StringKeyOf<S>, RequiredKeys<S>>]?: InferProperty<S[K], Depth>;
  }
>;

/** Suy luận một node object tường minh, kể cả độ mở đã khai. */
type InferObject<
  S extends {
    additionalProperties: boolean;
  },
  Depth extends unknown[],
> = S extends {
  properties: infer P;
}
  ? S["additionalProperties"] extends true
    ? InferProperties<P, Depth> & Record<string, JsonValue>
    : InferProperties<P, Depth>
  : S["additionalProperties"] extends true
    ? Record<string, JsonValue>
    : Record<string, never>;

/** Suy luận ràng buộc literal của một node vô hướng trước kiểu nguyên thuỷ rộng. */
type InferScalar<S, Fallback> = S extends {
  const: infer C;
}
  ? C
  : S extends {
        enum: readonly (infer E)[];
      }
    ? E
    : Fallback;

/** Thêm một tầng container schema vào suy luận có giới hạn lúc biên dịch. */
type NextInferenceDepth<Depth extends unknown[]> = [unknown, ...Depth];

/** Suy luận một node mà không kiểm đệ quy nó với toàn bộ hợp kiểu tác giả. */
type InferValueAt<S, Depth extends unknown[]> = Depth["length"] extends 16
  ? JsonValue
  : S extends {
        type: "string";
      }
    ? InferScalar<S, string>
    : S extends {
          type: "number" | "integer";
        }
      ? InferScalar<S, number>
      : S extends {
            type: "boolean";
          }
        ? InferScalar<S, boolean>
        : S extends {
              type: "null";
            }
          ? null
          : S extends {
                type: "array";
              }
            ? S extends {
                items: infer I;
              }
              ? InferValueAt<I, NextInferenceDepth<Depth>>[]
              : JsonValue[]
            : S extends {
                  type: "object";
                  additionalProperties: boolean;
                }
              ? InferObject<S, NextInferenceDepth<Depth>>
              : S extends {
                    type: "json";
                  }
                ? JsonValue
                : S extends {
                      oneOf: readonly unknown[];
                    }
                  ? InferValueAt<S["oneOf"][number], NextInferenceDepth<Depth>>
                  : never;

/**
 * Suy luận giá trị TypeScript mà một schema giá trị phía tác giả chấp nhận. Suy luận
 * chính xác bị giới hạn trong 16 tầng container, sau đó quay về JsonValue.
 * Nhận: S là spec giá trị phía tác giả.
 * Trả: kiểu giá trị tương ứng của spec.
 */
export type InferValue<S> = InferValueAt<S, []>;

/**
 * Suy luận object đối số TypeScript cho một schema tham số ngầm.
 * Nhận: S là ParameterSchemaSpec.
 * Trả: object có khoá bắt buộc/tuỳ chọn đúng như khai.
 */
export type InferArgs<S> = InferProperties<S, []>;

/** Nơi gắn một node đã biên dịch trong cây schema đang dựng. */
type NodeDestination =
  | { kind: "root"; holder: SchemaHolder }
  | { kind: "property"; target: Record<string, JsonSchemaNode>; key: string }
  | { kind: "item"; target: JsonSchemaNode }
  | { kind: "one-of"; target: JsonSchemaNode[]; index: number };

/** Nơi gắn một map thuộc tính đã biên dịch: gốc hoặc node object chứa nó. */
type PropertyMapDestination =
  | { kind: "root"; holder: SchemaHolder }
  | { kind: "object"; target: JsonSchemaNode };

/** Hộp giữ node gốc mà tác vụ biên dịch gốc gán vào. */
interface SchemaHolder {
  /** Node đã biên dịch, chỉ có sau khi tác vụ gốc chạy. */
  value?: JsonSchemaNode;
}

/** Map thuộc tính đã biên dịch cùng danh sách khoá bắt buộc thu thập được. */
interface CompiledPropertyMap {
  /** Các node thuộc tính theo thứ tự khai. */
  properties: Record<string, JsonSchemaNode>;
  /** Tên các thuộc tính required: true; vắng khi không có thuộc tính bắt buộc. */
  required?: string[];
}

/** Tác vụ rời khỏi một node: gỡ nó khỏi tập đang duyệt để phát hiện vòng lặp. */
interface LeaveTask {
  kind: "leave";
  input: Record<string, unknown>;
}

/** Tác vụ chốt một map thuộc tính: gắn danh sách required sau khi mọi thuộc tính đã chạy. */
interface PropertyMapTailTask {
  kind: "property-map-tail";
  compiled: CompiledPropertyMap;
  required: string[];
  destination: PropertyMapDestination;
}

/** Tác vụ biên dịch một thuộc tính của map tham số/object. */
interface PropertyTask {
  kind: "property";
  property: unknown;
  path: string;
  key: string;
  properties: Record<string, JsonSchemaNode>;
  required: string[];
}

/** Tác vụ biên dịch một map thuộc tính (gốc tham số hoặc properties của object). */
interface PropertyMapTask {
  kind: "property-map";
  input: unknown;
  path: string;
  destination: PropertyMapDestination;
}

/** Tác vụ biên dịch một node giá trị phía tác giả. */
interface ValueTask {
  kind: "value";
  input: unknown;
  path: string;
  allowRequired: boolean;
  destination: NodeDestination;
}

/** Một tác vụ trong đồ thị biên dịch schema, chạy bằng ngăn xếp thay vì đệ quy. */
type SchemaCompileTask = LeaveTask | PropertyMapTailTask | PropertyTask | PropertyMapTask | ValueTask;

/**
 * Ném một vi phạm schema tác giả qua kiểu lỗi schema dùng chung.
 * Nhận: message — câu chẩn đoán đã định dạng đường dẫn.
 * Trả: không trả về; luôn ném JsonSchemaError.
 * @throws {JsonSchemaError} luôn ném, với đúng một vi phạm.
 */
function authorError(message: string): never {
  throw new JsonSchemaError([message]);
}

/**
 * Sao chép các trường annotation riêng của node để biên ranh giới schema thô kiểm chúng.
 * Nhận: source — record tác giả; target — node JSON Schema đang dựng.
 * Trả: không; target nhận đúng các annotation có mặt trên source.
 */
function copyAnnotations(source: Record<string, unknown>, target: JsonSchemaNode): void {
  if (Object.hasOwn(source, "description")) target.description = source.description as string | undefined;
  if (Object.hasOwn(source, "title")) target.title = source.title as string | undefined;
  if (Object.hasOwn(source, "default")) target.default = source.default as JsonValue;
  if (Object.hasOwn(source, "examples")) target.examples = source.examples as JsonValue;
}

/**
 * Từ chối các khoá chỉ dành cho tác giả nằm ngoài từ vựng đã khai của một node.
 * Nhận: source — record tác giả; path — đường dẫn chẩn đoán; allowed — các khoá được phép.
 * Trả: không; ném khi gặp khoá lạ.
 * @throws {JsonSchemaError} khi source có khoá không thuộc allowed.
 */
function assertAuthorKeys(source: Record<string, unknown>, path: string, allowed: readonly string[]): void {
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) authorError(`${path}.${key} is not supported by the value schema DSL`);
  }
}

/**
 * Gắn một node đã biên dịch mà không trao ngữ nghĩa gán cho __proto__.
 * Nhận: destination — nơi gắn; node — node đã biên dịch.
 * Trả: không; node được gắn vào holder/target tương ứng.
 */
function assignCompiledNode(destination: NodeDestination, node: JsonSchemaNode): void {
  switch (destination.kind) {
    case "root":
      destination.holder.value = node;
      break;
    case "property":
      Object.defineProperty(destination.target, destination.key, {
        value: node,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      break;
    case "item":
      destination.target.items = node;
      break;
    case "one-of":
      destination.target[destination.index] = node;
      break;
  }
}

/**
 * Gắn một map thuộc tính đã biên dịch vào gốc hoặc node object chứa nó.
 * Nhận: destination — gốc hoặc node object; compiled — map đã biên dịch.
 * Trả: không; map được gắn đúng chỗ.
 */
function assignCompiledPropertyMap(destination: PropertyMapDestination, compiled: CompiledPropertyMap): void {
  if (destination.kind === "root") {
    destination.holder.value = compiled;
  } else {
    destination.target.properties = compiled.properties;
  }
}

/**
 * Chạy đồ thị tác vụ biên dịch schema tác giả mà không đệ quy.
 * Nhận: initial — tác vụ gốc (node giá trị hoặc map thuộc tính).
 * Trả: không; mọi node đích đã được gắn hoặc JsonSchemaError đã ném.
 * @throws {JsonSchemaError} khi spec vi phạm từ vựng DSL.
 */
function runSchemaCompiler(initial: SchemaCompileTask): void {
  const seen = new Set<Record<string, unknown>>();
  const tasks: SchemaCompileTask[] = [initial];
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    if (task.kind === "leave") {
      seen.delete(task.input);
      continue;
    }
    if (task.kind === "property-map-tail") {
      if (task.required.length > 0) {
        task.compiled.required = task.required;
        if (task.destination.kind === "object") task.destination.target.required = task.required;
      }
      continue;
    }
    if (task.kind === "property") {
      if (!isJsonSchemaRecord(task.property)) authorError(`${task.path} must be a value schema object`);
      if (Object.hasOwn(task.property, "required") && task.property.required !== true) {
        authorError(`${task.path}.required must be true when present`);
      }
      if (Object.hasOwn(task.property, "required") && task.property.required === true) task.required.push(task.key);
      tasks.push({
        kind: "value",
        input: task.property,
        path: task.path,
        allowRequired: true,
        destination: { kind: "property", target: task.properties, key: task.key },
      });
      continue;
    }
    if (task.kind === "property-map") {
      if (!isJsonSchemaRecord(task.input)) authorError(`${task.path} must be an object of value schemas`);
      if (seen.has(task.input)) authorError(`${task.path} is circular`);
      seen.add(task.input);
      const compiled: CompiledPropertyMap = { properties: {} };
      const required: string[] = [];
      assignCompiledPropertyMap(task.destination, compiled);
      tasks.push({ kind: "leave", input: task.input });
      tasks.push({ kind: "property-map-tail", compiled, required, destination: task.destination });
      const entries = Object.entries(task.input);
      for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index];
        /* v8 ignore next -- vòng lặp bị chặn bởi số entry đã chụp. */
        if (entry === undefined) continue;
        tasks.push({
          kind: "property",
          property: entry[1],
          path: `${task.path}.${entry[0]}`,
          key: entry[0],
          properties: compiled.properties,
          required,
        });
      }
      continue;
    }
    const { input, path } = task;
    if (!isJsonSchemaRecord(input)) authorError(`${path} must be a value schema object`);
    if (seen.has(input)) authorError(`${path} is circular`);
    seen.add(input);
    const authorKeys = [...ANNOTATION_KEYS, ...(task.allowRequired ? ["required"] : [])];
    const node: JsonSchemaNode = {};
    assignCompiledNode(task.destination, node);
    tasks.push({ kind: "leave", input });
    if (Object.hasOwn(input, "oneOf")) {
      assertAuthorKeys(input, path, [...authorKeys, "oneOf", "type"]);
      if (Object.hasOwn(input, "type")) authorError(`${path} cannot declare both type and oneOf`);
      if (!isPlainJsonArray(input.oneOf)) {
        authorError(`${path}.oneOf must be an array of at least two value schemas`);
      }
      const branches: JsonSchemaNode[] = [];
      node.oneOf = branches;
      copyAnnotations(input, node);
      for (let index = input.oneOf.length - 1; index >= 0; index--) {
        tasks.push({
          kind: "value",
          input: input.oneOf[index],
          path: `${path}.oneOf[${index}]`,
          allowRequired: false,
          destination: { kind: "one-of", target: branches, index },
        });
      }
      continue;
    }
    const inputType = Object.hasOwn(input, "type") ? input.type : undefined;
    switch (inputType) {
      case "json":
        assertAuthorKeys(input, path, [...authorKeys, "type"]);
        copyAnnotations(input, node);
        break;
      case "object":
        assertAuthorKeys(input, path, [...authorKeys, "type", "properties", "additionalProperties"]);
        if (!Object.hasOwn(input, "additionalProperties") || typeof input.additionalProperties !== "boolean") {
          authorError(`${path}.additionalProperties must be explicitly true or false`);
        }
        node.type = "object";
        copyAnnotations(input, node);
        node.additionalProperties = input.additionalProperties;
        if (Object.hasOwn(input, "properties")) {
          tasks.push({
            kind: "property-map",
            input: input.properties,
            path: `${path}.properties`,
            destination: { kind: "object", target: node },
          });
        }
        break;
      case "array":
        assertAuthorKeys(input, path, [...authorKeys, "type", "items"]);
        node.type = "array";
        copyAnnotations(input, node);
        if (Object.hasOwn(input, "items")) {
          tasks.push({
            kind: "value",
            input: input.items,
            path: `${path}.items`,
            allowRequired: false,
            destination: { kind: "item", target: node },
          });
        }
        break;
      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "null":
        assertAuthorKeys(input, path, [...authorKeys, "type", "enum", "const"]);
        node.type = inputType;
        copyAnnotations(input, node);
        if (Object.hasOwn(input, "enum")) {
          if (!isPlainJsonArray(input.enum)) {
            authorError(`${path}.enum must be a non-empty array of scalar values`);
          }
          node.enum = Array.from(input.enum, (entry) => entry) as JsonSchemaScalar[];
        }
        if (Object.hasOwn(input, "const")) node.const = input.const as JsonSchemaScalar;
        break;
      default:
        authorError(`${path}.type must be string/number/integer/boolean/null/array/object/json, or use oneOf`);
    }
  }
}

/**
 * Biên dịch một map thuộc tính ngầm, thu thập tính bắt buộc của từng thuộc tính.
 * Nhận: input — map thuộc tính tác giả; path — đường dẫn chẩn đoán.
 * Trả: map đã biên dịch cùng danh sách khoá bắt buộc.
 * @throws {JsonSchemaError} khi map hoặc một thuộc tính vi phạm DSL.
 */
function compilePropertyMap(input: unknown, path: string): CompiledPropertyMap {
  const holder: SchemaHolder = {};
  runSchemaCompiler({ kind: "property-map", input, path, destination: { kind: "root", holder } });
  /* v8 ignore next -- tác vụ gốc gán trước khi xếp bất kỳ tác vụ con nào. */
  return (holder.value ?? authorError(`${path} did not compile`)) as CompiledPropertyMap;
}

/**
 * Biên dịch một node tác giả mà không áp bất kỳ hạn chế gốc nào của bên tiêu thụ.
 * Nhận: input — node schema tác giả; path — đường dẫn chẩn đoán.
 * Trả: node JSON Schema đã biên dịch.
 * @throws {JsonSchemaError} khi node vi phạm DSL.
 */
function compileValueSchema(input: unknown, path: string): JsonSchemaNode {
  const holder: SchemaHolder = {};
  runSchemaCompiler({ kind: "value", input, path, allowRequired: false, destination: { kind: "root", holder } });
  /* v8 ignore next -- tác vụ gốc gán trước khi xếp bất kỳ tác vụ con nào. */
  return holder.value ?? authorError(`${path} did not compile`);
}

/**
 * Biên dịch một schema giá trị phía tác giả sang tập con JSON Schema được cưỡng chế.
 * Node json chỉ dành cho tác giả trở thành schema chỉ có annotation.
 * Nhận: spec — schema cho mọi gốc giá trị JSON.
 * Trả: hình chiếu JSON Schema thô đã được khẳng định hợp lệ.
 * @throws {JsonSchemaError} khi spec vi phạm từ vựng DSL hoặc tập con JSON Schema.
 */
export function valueSchemaSpecToJsonSchema(spec: ValueSchemaSpec): JsonSchemaNode {
  const schema = compileValueSchema(spec, "schema");
  assertSupportedJsonSchema(schema);
  return schema;
}

/**
 * Biên dịch object tham số mở ngầm thành JSON Schema thô.
 * Nhận: spec — định nghĩa tham số theo từng thuộc tính.
 * Trả: schema thô gốc object, không có ghi đè độ mở ngầm của gốc.
 * @throws {JsonSchemaError} khi spec vi phạm từ vựng DSL hoặc tập con JSON Schema.
 */
export function parameterSchemaSpecToJsonSchema(spec: ParameterSchemaSpec): ParameterJsonSchema {
  const compiled = compilePropertyMap(spec, "parameters");
  const schema: ParameterJsonSchema = {
    type: "object",
    properties: compiled.properties,
    ...(compiled.required === undefined ? {} : { required: compiled.required }),
  };
  assertSupportedJsonSchema(schema);
  return schema;
}

/**
 * Đối số do model sinh không hợp lệ cho một tool có kiểu.
 * Nhận: violations — từng vi phạm theo thứ tự duyệt schema.
 * Trả: lỗi HarnessError mã INVALID_ARGS mang đủ danh sách vi phạm.
 */
export class ToolArgsError extends HarnessError {
  /** Từng vi phạm, theo thứ tự duyệt schema. */
  readonly violations: string[];

  constructor(violations: string[]) {
    super(`invalid arguments: ${violations.join("; ")}`, "INVALID_ARGS");
    this.name = "ToolArgsError";
    this.violations = violations;
  }
}

/**
 * Kiểm đối số do model sinh với một schema tham số ngầm.
 * Nhận: spec — schema tham số đã khai; args — đối số ứng viên, dù méo mó tới đâu.
 * Trả: các vi phạm kèm đường dẫn; mảng rỗng nghĩa là hợp lệ.
 * @throws {JsonSchemaError} khi chính spec tham số vi phạm DSL.
 */
export function validateArgs(spec: ParameterSchemaSpec, args: unknown): string[] {
  return validateJsonSchemaValue(parameterSchemaSpecToJsonSchema(spec), args, "");
}

/**
 * Tuỳ chọn cho defineTool.
 * Nhận: S là schema tham số; O là schema đầu ra.
 * Trả: hợp đồng định nghĩa tool có suy luận đối số/giá trị và các callback tuỳ chọn.
 */
export interface DefineToolOptions<S extends ParameterSchemaSpec, O extends ValueSchemaSpec> {
  /** Tên tool (phải duy nhất). */
  readonly name: string;
  /** Mô tả người đọc được, gửi cho model. */
  readonly description: string;
  /** Schema tham số theo từng thuộc tính, biên dịch thành gốc object mở ngầm. */
  readonly parameters: S;
  /** Schema đầu ra chuẩn cùng các phép chiếu Native và trình bày thuần. */
  readonly output: {
    /** Schema được cưỡng chế trên mọi giá trị thân thành công hoặc giá trị bị chính sách thay. */
    readonly schema: O;
    /** Phép chiếu thuần Native/model của một giá trị chuẩn đã kiểm. */
    render(args: InferArgs<S>, value: InferValue<NoInfer<O>>): ContentBlock[];
    /** Siêu dữ liệu trình bày thuần, phát lại được, cho lời gọi native và lồng nhau. */
    presentationMeta?(args: InferArgs<S>, value: InferValue<NoInfer<O>>): JsonValue;
  };
  /** Yêu cầu nạp trễ định nghĩa tool; xem ToolSchema.deferLoading của @deepseek-ai/dsh-llm. */
  readonly deferLoading?: true;
  /** Ngân sách thời gian hợp tác tuỳ chọn, tính bằng mili giây, phải dương. */
  readonly timeoutMs?: number;
  /**
   * Bộ phân loại thuần cho việc chồng lấn với lời gọi anh em.
   * Nhận: args — đối số đã kiểm có kiểu.
   * Trả: lời gọi có được vào một nhóm song song hay không.
   */
  isConcurrencySafe?(args: InferArgs<S>): boolean;
  /**
   * Chạy tool sau khi kiểm đối số.
   * Nhận: args — đối số đã kiểm có kiểu; exec — danh tính thực thi, bên gọi, huỷ và dữ liệu lồng nhau.
   * Trả: giá trị chuẩn do output.schema khai.
   */
  execute(args: InferArgs<S>, exec: ToolRunContext): Promise<InferValue<NoInfer<O>>>;
  /**
   * Cài nội dung đã chuẩn bị lúc thực thi trước các chính sách kết quả.
   * Nhận: exec — danh tính thực thi bất biến cùng đối số; result — kết quả chuẩn hoá đi vào post-execute.
   * Trả: nội dung thay thế, hoặc undefined để giữ nguyên.
   */
  projectContent?(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): ContentBlock[] | undefined;
  /**
   * Phép biến đổi nội dung chặng cuối tuỳ chọn cho mọi kết quả đã chuẩn hoá. Khác execute,
   * đối số vẫn là unknown vì cả lỗi đầu vào không hợp lệ cũng tới callback này.
   * Nhận: exec — danh tính thực thi bất biến cùng đối số; result — kết quả chuẩn hoá đầy đủ trước khi hiện thực hoá.
   * Trả: nội dung thay thế, hoặc undefined để giữ nguyên.
   */
  finalizeContent?(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): ContentBlock[] | undefined;
  /**
   * Trình bày trạng thái chờ, thuần.
   * Nhận: args — đối số đã kiểm có kiểu.
   * Trả: ý định hiển thị do tool sở hữu, hoặc undefined cho card chung.
   */
  presentCall?(args: InferArgs<S>): ToolCallView | undefined;
  /**
   * Trình bày trạng thái hoàn tất, thuần.
   * Nhận: args — đối số đã kiểm có kiểu; result — kết quả cuối cùng hướng model.
   * Trả: ý định hiển thị do tool sở hữu, hoặc undefined cho card chung.
   */
  presentResult?(args: InferArgs<S>, result: ToolResult): ToolResultView | undefined;
}

/**
 * Định nghĩa một tool first-party với đối số được suy luận và kiểm chặt lúc chạy.
 * Các presenter chỉ dùng khi phát lại sẽ kiểm mềm và quay về hiển thị chung cho đối số
 * đã ghi theo schema cũ.
 * Nhận: options — định nghĩa có kiểu cùng finalizer và presenter tuỳ chọn.
 * Trả: định nghĩa sẵn sàng đăng ký vào sổ tool.
 * @throws {Error} khi timeoutMs không phải số hữu hạn dương.
 * @throws {JsonSchemaError} khi schema tham số hoặc schema đầu ra vi phạm DSL.
 */
export function defineTool<const S extends ParameterSchemaSpec, const O extends ValueSchemaSpec>(
  options: DefineToolOptions<S, O>,
): ToolDefinition {
  // Phương thức trong object literal không dùng this; giữ tham chiếu là an toàn.
  // oxlint-disable-next-line typescript/unbound-method
  const userExecute = options.execute;
  // oxlint-disable-next-line typescript/unbound-method
  const userFinalizeContent = options.finalizeContent;
  // oxlint-disable-next-line typescript/unbound-method
  const userProjectContent = options.projectContent;
  // oxlint-disable-next-line typescript/unbound-method
  const userRender = options.output.render;
  // oxlint-disable-next-line typescript/unbound-method
  const userPresentationMeta = options.output.presentationMeta;
  // oxlint-disable-next-line typescript/unbound-method
  const userPresentCall = options.presentCall;
  // oxlint-disable-next-line typescript/unbound-method
  const userPresentResult = options.presentResult;
  // oxlint-disable-next-line typescript/unbound-method
  const userIsConcurrencySafe = options.isConcurrencySafe;
  if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) {
    throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`);
  }
  const parameters = parameterSchemaSpecToJsonSchema(options.parameters);
  const outputSchema = valueSchemaSpecToJsonSchema(options.output.schema);
  const validate = (args: unknown): string[] => validateJsonSchemaValue(parameters, args, "");
  // ToolDefinition khai parameters là Record<string, unknown>; schema tham số đã biên dịch vẫn là
  // một JSON Schema hợp lệ, nên chỉ nới kiểu tại đúng ranh giới này (không đổi giá trị runtime).
  const tool: ToolDefinition = {
    name: options.name,
    description: options.description,
    parameters: parameters as unknown as Record<string, unknown>,
    output: {
      schema: outputSchema,
      render(args: unknown, value: JsonValue): ContentBlock[] {
        return userRender(args as InferArgs<S>, value as unknown as InferValue<NoInfer<O>>);
      },
      ...(userPresentationMeta !== undefined
        ? {
            presentationMeta(args: unknown, value: JsonValue): JsonValue {
              return userPresentationMeta(args as InferArgs<S>, value as unknown as InferValue<NoInfer<O>>);
            },
          }
        : {}),
    },
    ...(options.deferLoading === true ? { deferLoading: options.deferLoading } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    async execute(args: unknown, exec: ToolRunContext): Promise<unknown> {
      const violations = validate(args);
      if (violations.length > 0) throw new ToolArgsError(violations);
      return userExecute(args as InferArgs<S>, exec);
    },
  };
  if (userProjectContent) {
    tool.projectContent = (exec, result) => userProjectContent(exec, result);
  }
  if (userFinalizeContent) {
    tool.finalizeContent = (exec, result) => userFinalizeContent(exec, result);
  }
  // Phần trình bày chỉ để hiển thị và có thể chạy khi PHÁT LẠI đối số đã ghi tuỳ ý
  // (có thể từ schema cũ), nên không bao giờ được ném: kiểm mềm rồi quay về undefined
  // (trình bày UI chung) khi lệch, thay vì ToolArgsError cứng như đường execute.
  if (userPresentCall) {
    tool.presentCall = (args: unknown): ToolCallView | undefined => {
      if (validate(args).length > 0) return undefined;
      return userPresentCall(args as InferArgs<S>);
    };
  }
  if (userPresentResult) {
    tool.presentResult = (args: unknown, result: ToolResult): ToolResultView | undefined => {
      if (validate(args).length > 0) return undefined;
      return userPresentResult(args as InferArgs<S>, result);
    };
  }
  if (userIsConcurrencySafe) {
    tool.isConcurrencySafe = (args: unknown): boolean => {
      if (validate(args).length > 0) return false;
      return userIsConcurrencySafe(args as InferArgs<S>);
    };
  }
  return tool;
}
