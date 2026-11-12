/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 ts-types.js (290 dòng): phép chiếu THUẦN từ schema của các tool đã đăng ký sang văn
 *      bản TypeScript SDK mà model lập trình dựa vào (mục prompt `tools:sdk`). Anh em của
 *      `json-schema.ts`: `schemas()` (gọi hàm native) và module này (API `declare const tools` được
 *      sinh) là hai phép chiếu của CÙNG một kho tool.
 */

import type { ToolSchema } from "@deepseek-ai/dsh-llm";
import type { JsonSchemaNode } from "./json-schema.ts";
import { assertSupportedJsonSchema } from "./json-schema.ts";

/** Tên thuộc tính hợp lệ làm định danh TS trần; mọi tên khác đều được đặt trong ngoặc kép. */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Một giá trị vô hướng JSON mà `const`/`enum` của schema được phép mang. */
type JsonSchemaScalarValue = NonNullable<JsonSchemaNode["const"]>;

/** Một phần của tài liệu kiểu đã ráp: chuỗi đã render, hoặc một tài liệu con. */
type TypePart = string | TypePartDocument;

/** Tài liệu kiểu đã ráp: các phần theo thứ tự ráp, kèm cờ cho biết có `|`/`&` để quyết định đóng ngoặc. */
interface TypePartDocument {
  /** Các phần theo đúng thứ tự ráp. */
  parts: TypePart[];
  /** True khi bất kỳ phần nào chứa `|` hoặc `&` (một phần tử mảng như vậy phải được đóng ngoặc). */
  containsUnionOrIntersection: boolean;
}

/**
 * Phép chiếu NỘI BỘ của chế độ PTC: schema phía model cộng schema giá trị chuẩn của đầu ra.
 * Nhận: mọi trường của {@link ToolSchema} — `name`, `description`, `parameters`, và `deferLoading`
 *        tuỳ chọn.
 * Trả: hình dạng dữ liệu mà {@link renderToolsSdk} tiêu thụ; không có giá trị lúc chạy.
 */
export interface ToolSdkSchema extends ToolSchema {
  /** Giá trị chuẩn đã kiểm mà binding của tool trả về. */
  output: JsonSchemaNode;
}

/**
 * Render một khoá object: trần khi nó là định danh hợp lệ, đặt trong ngoặc kép khi không (mọi tên
 * vẫn tới được, không đặt bí danh).
 * Nhận: `name` — tên thuộc tính cần render.
 * Trả: chuỗi khoá đã render.
 */
function renderKey(name: string): string {
  return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

/**
 * Một tiền tố dòng thụt lề sâu `indent` (hai dấu cách mỗi mức).
 * Nhận: `indent` — số mức thụt lề.
 * Trả: chuỗi khoảng trắng đầu dòng.
 */
function pad(indent: number): string {
  return "  ".repeat(indent);
}

/**
 * Một khối JSDoc MỘT DÒNG cho `description` của schema, hoặc không dòng nào khi không có.
 * Nhận: `description` — chú thích của schema (có thể vắng); `indent` — mức thụt lề.
 * Trả: mảng dòng (0 hoặc 1 phần tử) đã thụt lề, sẵn sàng chèn vào tài liệu.
 */
function docLines(description: string | undefined, indent: number): string[] {
  if (typeof description !== "string" || description.length === 0)
    return [];
  // Gộp văn xuôi thành chú thích một dòng ổn định và thoát dấu đóng bình luận để một
  // description của schema không thể kết thúc JSDoc được sinh.
  const collapsed = description.replace(/\s+/g, " ").trim();
  return [`${pad(indent)}/** ${collapsed.replaceAll("*/", String.raw`*\/`)} */`];
}

/**
 * Render một giá trị vô hướng đã được biên schema hợp nhất kiểm.
 * Nhận: `value` — giá trị vô hướng JSON.
 * Trả: biểu diễn JSON của giá trị đó.
 */
function renderScalar(value: JsonSchemaScalarValue): string {
  return JSON.stringify(value);
}

/**
 * Render một `const`/`enum` vô hướng đã kiểm, rơi về kiểu rộng khi không có ràng buộc.
 * Nhận: `node` — node schema vô hướng đã kiểm; `type` — loại vô hướng của node.
 * Trả: văn bản kiểu TS cho node.
 */
function renderConstrainedScalar(node: JsonSchemaNode, type: Exclude<JsonSchemaNode["type"], "object" | "array" | undefined>): string {
  const broad = type === "integer" ? "number" : type;
  // Giữ nguyên `Object.hasOwn` của bản gốc; node đã qua assert nên `const`/`enum` có mặt chắc chắn
  // mang giá trị vô hướng, hai phép ép kiểu dưới đây chỉ để tsc thấy điều đó.
  if (Object.hasOwn(node, "const"))
    return renderScalar(node.const as JsonSchemaScalarValue);
  if (Object.hasOwn(node, "enum")) {
    return (node.enum as JsonSchemaScalarValue[]).map(renderScalar).join(" | ");
  }
  return broad;
}

/**
 * Dựng một tài liệu từ các phần đã gom, đồng thời giữ phép kiểm "đóng ngoặc mảng" của bản gốc.
 * Nhận: `parts` — các phần theo thứ tự ráp.
 * Trả: tài liệu kiểu kèm cờ `containsUnionOrIntersection`.
 */
function typeDocumentFrom(parts: TypePart[]): TypePartDocument {
  return {
    parts,
    containsUnionOrIntersection: parts.some(part => typeof part === "string"
      ? part.includes("|") || part.includes("&")
      : part.containsUnionOrIntersection),
  };
}

/**
 * Dựng một tài liệu nhỏ mà mỗi chỗ gọi không phải tạo mảng trung gian.
 * Nhận: các `parts` theo thứ tự ráp.
 * Trả: tài liệu kiểu đã ráp.
 */
function typeDocument(...parts: TypePart[]): TypePartDocument {
  return typeDocumentFrom(parts);
}

/**
 * Duỗi một tài liệu lồng nhau bằng ngăn xếp công việc tường minh.
 * Nhận: `document` — tài liệu gốc cần duỗi.
 * Trả: toàn bộ văn bản đã nối.
 */
function flattenTypeDocument(document: TypePartDocument): string {
  const chunks: string[] = [];
  const tasks: TypePart[] = [document];
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    if (typeof task === "string") {
      chunks.push(task);
      continue;
    }
    for (let index = task.parts.length - 1; index >= 0; index--) {
      const part = task.parts[index];
      /* v8 ignore next -- the loop is bounded by the captured part count. */
      if (part !== undefined)
        tasks.push(part);
    }
  }
  return chunks.join("");
}

/** Một con của khung render: node schema và mức thụt lề của nó. */
interface SchemaRenderChild {
  /** Node schema của con. */
  node: JsonSchemaNode;
  /** Mức thụt lề của con. */
  indent: number;
}

/** Khung render MỘT node schema trong ngăn xếp lặp (không đệ quy). */
interface SchemaRenderFrameState {
  /** Node schema của khung. */
  node: JsonSchemaNode;
  /** Mức thụt lề của khung. */
  indent: number;
  /** Pha của khung: `start` = chưa xử lý; `children` = đang/đã gom con. */
  phase: "start" | "children";
  /** Loại khung đã chọn ở pha `start`; vắng khi khung chưa chọn. */
  kind?: "oneOf" | "array" | "object";
  /** Các con cần render. */
  children: SchemaRenderChild[];
  /** Chỉ số con kế tiếp. */
  childIndex: number;
  /** Tài liệu của các con đã render xong, đúng thứ tự. */
  childDocuments: TypePartDocument[];
  /** Cặp [tên thuộc tính, node] mà khung object sẽ render. */
  entries: Array<[string, JsonSchemaNode]>;
}

/**
 * Khởi tạo một khung render schema với trạng thái gom rỗng.
 * Nhận: `node` — node schema của khung; `indent` — mức thụt lề của khung.
 * Trả: khung ở pha `start`.
 */
function schemaRenderFrame(node: JsonSchemaNode, indent: number): SchemaRenderFrameState {
  return { node, indent, phase: "start", children: [], childIndex: 0, childDocuments: [], entries: [] };
}

/**
 * Render một schema ĐÃ được assert sang một tài liệu kiểu ráp được.
 * Nhận: `schema` — node đã qua `assertSupportedJsonSchema`; `indent` — mức thụt lề gốc.
 * Trả: tài liệu kiểu của cả cây schema.
 * @throws {Error} khi một khung mất con hoặc mất entry đã được lên lịch (bất biến nội bộ bị phá).
 */
function renderSupportedSchema(schema: JsonSchemaNode, indent: number): TypePartDocument {
  const frames: SchemaRenderFrameState[] = [schemaRenderFrame(schema, indent)];
  let rootDocument: TypePartDocument | undefined;
  const finish = (document: TypePartDocument): void => {
    frames.pop();
    const parent = frames.at(-1);
    if (parent === undefined)
      rootDocument = document;
    else
      parent.childDocuments.push(document);
  };
  while (frames.length > 0) {
    const frame = frames.at(-1);
    /* v8 ignore next -- the loop condition guarantees a current frame. */
    if (frame === undefined)
      break;
    if (frame.phase === "children") {
      if (frame.childIndex < frame.children.length) {
        const child = frame.children[frame.childIndex];
        /* v8 ignore next -- childIndex is bounded by children.length. */
        if (child === undefined)
          throw new Error("missing schema render child");
        frame.childIndex++;
        frames.push(schemaRenderFrame(child.node, child.indent));
        continue;
      }
      if (frame.kind === "oneOf") {
        const parts: TypePart[] = [];
        for (let index = 0; index < frame.childDocuments.length; index++) {
          if (index > 0)
            parts.push(" | ");
          const child = frame.childDocuments[index];
          /* v8 ignore next -- child documents correspond one-to-one with children. */
          if (child !== undefined)
            parts.push(child);
        }
        finish(typeDocumentFrom(parts));
        continue;
      }
      if (frame.kind === "array") {
        const child = frame.childDocuments[0];
        /* v8 ignore next -- array frames always schedule exactly one child. */
        if (child === undefined)
          throw new Error("missing array item type");
        finish(child.containsUnionOrIntersection
          ? typeDocument("(", child, ")[]")
          : typeDocument(child, "[]"));
        continue;
      }
      const required = new Set<string>(frame.node.required);
      const parts: TypePart[] = ["{"];
      for (let index = 0; index < frame.entries.length; index++) {
        const entry = frame.entries[index];
        const child = frame.childDocuments[index];
        /* v8 ignore next -- object entries and child documents have the same length. */
        if (entry === undefined || child === undefined)
          throw new Error("missing object property type");
        const [name, prop] = entry;
        for (const line of docLines(prop.description, frame.indent + 1))
          parts.push("\n", line);
        parts.push("\n", `${pad(frame.indent + 1)}${renderKey(name)}${required.has(name) ? "" : "?"}: `, child, ";");
      }
      parts.push("\n", `${pad(frame.indent)}}`);
      const declared = typeDocumentFrom(parts);
      finish(frame.node.additionalProperties === false
        ? declared
        : typeDocument(declared, " & Record<string, JsonValue>"));
      continue;
    }
    const node = frame.node;
    if (node.oneOf !== undefined) {
      frame.kind = "oneOf";
      frame.children = Array.from(node.oneOf, child => ({ node: child, indent: frame.indent }));
      frame.childIndex = 0;
      frame.childDocuments = [];
      frame.phase = "children";
      continue;
    }
    if (node.type === undefined) {
      finish(typeDocument("JsonValue"));
      continue;
    }
    switch (node.type) {
      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "null":
        finish(typeDocument(renderConstrainedScalar(node, node.type)));
        break;
      case "array":
        if (node.items === undefined) {
          finish(typeDocument("JsonValue[]"));
        } else {
          frame.kind = "array";
          frame.children = [{ node: node.items, indent: frame.indent }];
          frame.childIndex = 0;
          frame.childDocuments = [];
          frame.phase = "children";
        }
        break;
      case "object": {
        const open = node.additionalProperties !== false;
        const entries = Object.entries(node.properties ?? {});
        if (entries.length === 0) {
          finish(typeDocument(open ? "Record<string, JsonValue>" : "Record<string, never>"));
        } else {
          frame.kind = "object";
          frame.entries = entries;
          frame.children = entries.map(([, child]) => ({ node: child, indent: frame.indent + 1 }));
          frame.childIndex = 0;
          frame.childDocuments = [];
          frame.phase = "children";
        }
        break;
      }
      /* v8 ignore next -- assertSupportedJsonSchema narrowed this closed type union. */
      default:
        finish(typeDocument("unknown"));
    }
  }
  /* v8 ignore next -- every root frame produces one document. */
  return rootDocument ?? typeDocument("unknown");
}

/**
 * Ánh xạ MỘT node JSON-Schema đã được thi hành sang một literal kiểu TypeScript. Hỗ trợ mọi cấu
 * trúc của schema hợp nhất và trả `unknown` cho đầu vào sai hình dạng hoặc không hỗ trợ, KHÔNG ném.
 * Nhận: `schema` — node JSON-Schema (hình dạng bất kỳ; đầu vào thù địch tự suy giảm); `indent` —
 *        mức thụt lề cho các thành viên object lồng nhau.
 * Trả: văn bản kiểu TS (nhiều dòng với object có thuộc tính).
 */
export function jsonSchemaToTs(schema: unknown, indent = 0): string {
  try {
    assertSupportedJsonSchema(schema);
    return flattenTypeDocument(renderSupportedSchema(schema, indent));
  }
  catch {
    return "unknown";
  }
}

/**
 * Hợp đồng cách dùng cố định phía model, render phía trên các khai báo (xem Agent Note của chế độ
 * PTC, mục "What the model sees"). Giữ NGUYÊN VĂN từng ký tự của bản gốc.
 */
const SDK_INSTRUCTIONS = `## Writing code for run_code

\`run_code\` takes two required arguments: \`description\`, a short summary of what the program does, and \`code\`, the program to execute. The declarations below are SDK bindings for this program. A declaration does not make its name a directly callable tool; only names supplied as separate tool schemas may be called directly.`;

/**
 * Hợp đồng cách dùng cố định cho phần THÂN chương trình: cách gọi tool, lỗi, song song và đầu ra.
 * Giữ NGUYÊN VĂN từng ký tự của bản gốc.
 */
const SDK_PROGRAM_INSTRUCTIONS = `Inside the program:

- Call tools as \`await tools.name(args)\` — quoted access for exotic names: \`tools["my-tool"](args)\`. Every call resolves to the tool's typed canonical JSON value. Tool arguments must be lossless JSON.
- A FAILED tool call rejects with \`ToolCallError\`, whose \`toolName\` identifies the failed tool and whose \`message\` is human-readable — \`try/catch\` it to handle and continue.
- Independent read-only calls MAY overlap under \`Promise.all\` (safe calls run concurrently; mutating calls run alone, in submission order). Sequence dependent work with \`await\`.
- Only values emitted as program output enter the conversation. A successful tool result containing an image is attached after the run so you can inspect it on the next step; every other intermediate result stays out of the conversation, so extract just what you need.

Program-only SDK bindings:`;

/** Các trường của `parameters` mà phép dựng ví dụ `bash` đọc tới (seam CẤU TRÚC cho `ToolSchema.parameters`). */
interface BashParameterFields {
  /** Loại gốc của schema tham số; ví dụ chỉ được dựng khi đây là `object`. */
  type?: unknown;
  /** Tên các tham số bắt buộc. */
  required?: readonly string[];
  /** Schema của từng tham số, tra theo tên. */
  properties?: Readonly<Record<string, JsonSchemaNode>>;
}

/**
 * Cho biết một schema chuỗi có chấp nhận giá trị literal mà ví dụ `bash` dùng hay không.
 * Nhận: `schema` — node schema của tham số (có thể vắng); `value` — literal cần kiểm.
 * Trả: true khi schema là chuỗi và không loại trừ literal đó.
 */
function acceptsExampleString(schema: JsonSchemaNode | undefined, value: string): boolean {
  return schema?.type === "string"
    && (schema.const === undefined || schema.const === value)
    && (schema.enum === undefined || schema.enum.includes(value));
}

/**
 * Chỉ render ví dụ `bash` khi các tham số literal của nó thoả schema tham số HIỆN TẠI.
 * Nhận: `schemas` — các schema tool, đã sắp xếp theo tên.
 * Trả: chuỗi ví dụ (bắt đầu bằng một dấu cách), hoặc chuỗi rỗng khi không dựng được.
 */
function renderBashExample(schemas: readonly ToolSdkSchema[]): string {
  const bash = schemas.find(schema => schema.name === "bash");
  if (bash === undefined)
    return "";
  const parameters = bash.parameters as BashParameterFields;
  if (parameters.type !== "object")
    return "";
  const required = parameters.required ?? [];
  if (required.some(name => name !== "command" && name !== "description"))
    return "";
  if (!acceptsExampleString(parameters.properties?.command, "pwd"))
    return "";
  const needsDescription = required.includes("description");
  if (needsDescription && !acceptsExampleString(parameters.properties?.description, "Show current directory"))
    return "";
  const description = needsDescription ? "description: 'Show current directory', " : "";
  return ` When no separate \`bash\` schema is supplied, invoke a declared \`bash\` binding inside \`run_code\`:\n\n\`run_code({ description: "Show current directory", code: "console.log(await tools.bash({ ${description}command: 'pwd' }))" })\``;
}

/**
 * Render toàn bộ mục prompt `tools:sdk`: các chỉ dẫn cách dùng cố định cộng MỘT giao diện
 * `declare const tools` phủ mọi tool được đưa. TẤT ĐỊNH — tool được phát theo thứ tự tên từ điển,
 * nên một bộ tool không đổi sinh ra văn bản giống hệt từng byte qua các lần ráp. Phép sắp không
 * phải thứ tự toàn phần trên các tên bằng byte, nên hai schema trùng tên sẽ render theo thứ tự tham
 * số; bảng năng lực hiển thị của nơi gọi được khoá theo tên, nên đầu vào không bao giờ mang bản trùng.
 * Nhận: `schemas` — các schema tool cần khai (nơi gọi đã loại chính `run_code`).
 * Trả: văn bản hoàn chỉnh của mục prompt.
 */
export function renderToolsSdk(schemas: ToolSdkSchema[]): string {
  const sorted = [...schemas].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const argsMembers: string[] = [];
  const outputMembers: string[] = [];
  for (const schema of sorted) {
    argsMembers.push(...docLines(schema.description, 1));
    argsMembers.push(`${pad(1)}${renderKey(schema.name)}: ${jsonSchemaToTs(schema.parameters, 1)};`);
    outputMembers.push(`${pad(1)}${renderKey(schema.name)}: ${jsonSchemaToTs(schema.output, 1)};`);
  }
  const argsMap = `interface ToolArgsMap {${argsMembers.length > 0 ? `\n${argsMembers.join('\n')}\n` : ""}}`;
  const outputMap = `interface ToolOutputMap {${outputMembers.length > 0 ? `\n${outputMembers.join('\n')}\n` : ""}}`;
  const declaration = [
    argsMap,
    outputMap,
    "type ToolName = keyof ToolOutputMap",
    ['declare class ToolCallError extends Error {', '  readonly name: "ToolCallError";', '  readonly toolName: ToolName;', "}"].join("\n"),
    ["declare const tools: {", '  [K in ToolName]: (args: ToolArgsMap[K]) => Promise<ToolOutputMap[K]>;', "}"].join("\n"),
  ].join("\n\n");
  const jsonValue = "type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }";
  return `${SDK_INSTRUCTIONS}${renderBashExample(sorted)}\n\n${SDK_PROGRAM_INSTRUCTIONS}\n\n\`\`\`ts\n${jsonValue}\n\n${declaration}\n\`\`\``;
}
