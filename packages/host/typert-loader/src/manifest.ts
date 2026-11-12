/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ranh giới module/tệp của bộ nạp: thu hẹp export `TYPERT` của một gói thành đóng góp do CHÍNH
 *      gói đó sở hữu. Mọi thông điệp lỗi giữ NGUYÊN VĂN bản gốc (chúng đi vào log của kernel), và
 *      thứ tự kiểm cũng giữ nguyên: sự kiện nào hỏng trước thì lỗi của nó được ném trước.
 */

import type { TypertContribution } from "./types.ts";

/** Khoá `exports` trong package.json đặt tên cho tệp typert của mặt host. */
export const TYPERT_HOST_EXPORT = "./typert";

/** Các loại thành viên hợp lệ trong phản chiếu của bộ sinh. */
const MEMBER_KINDS = new Set(["property", "method", "getter", "setter", "call", "construct", "index"]);

/** Một giá trị bất kỳ đã được xác nhận là object (không phải mảng, không phải null). */
type Bag = Record<string, unknown>;

/**
 * Giải export `./typert` thành đường dẫn tương đối, nhận dạng chuỗi và dạng điều kiện một tầng.
 * @param pkgName - tên gói đang xét (chỉ dùng cho thông điệp lỗi).
 * @param exportsField - giá trị `exports` trong package.json của gói đó.
 * @returns đường dẫn tương đối, hoặc `undefined` khi gói không export `./typert`.
 * @throws khi `./typert` có mặt nhưng không phải chuỗi và cũng không có `default` kiểu chuỗi.
 */
export function typertExportOf(pkgName: string, exportsField: unknown): string | undefined {
  if (typeof exportsField !== "object" || exportsField === null) return undefined;
  const target = (exportsField as Bag)[TYPERT_HOST_EXPORT];
  if (target === undefined) return undefined;
  if (typeof target === "string") return target;
  if (typeof target === "object" && target !== null) {
    const fallback = (target as Bag)["default"];
    if (typeof fallback === "string") return fallback;
  }
  throw new Error(`typert-loader: ${pkgName} exports["${TYPERT_HOST_EXPORT}"] must be a string or an object with a string default`);
}

/**
 * Thu hẹp export `TYPERT` của một module vừa import động thành đóng góp do `pkgName` sở hữu.
 *
 * Đây là ranh giới module/tệp: vật thể đi từ artefact build vào sổ đăng ký có kiểu. Sự thật điều
 * phối và trường chiếu háo hức được kiểm; phép chiếu công cụ tính toán vẫn LAZY cho tới khi có
 * người dùng hỏi. Lỗi nêu tên gói và khuyết điểm, không nêu giá trị bí mật nào.
 * @param pkgName - gói mà mặt typert vừa được import.
 * @param exported - export `TYPERT` của module đó.
 * @returns đóng góp đã kiểm.
 * @throws khi vật thể không thuộc gói này, sai mặt, hoặc thiếu trường bắt buộc.
 */
export function validateTypertManifest(pkgName: string, exported: unknown): TypertContribution {
  if (typeof exported !== "object" || exported === null) {
    throw new Error(`typert-loader: ${pkgName} exports "${TYPERT_HOST_EXPORT}" but its module has no TYPERT manifest object`);
  }
  const manifest = exported as Bag;
  if (manifest["package"] !== pkgName) {
    throw new Error(
      `typert-loader: ${pkgName} TYPERT manifest names package ${JSON.stringify(manifest["package"])} — the manifest must be owned by the package that exports it`,
    );
  }
  if (manifest["face"] !== "host") {
    throw new Error(`typert-loader: ${pkgName} exports "${TYPERT_HOST_EXPORT}" but TYPERT.face is not "host"`);
  }
  const schemas = manifest["schemas"];
  if (!Array.isArray(schemas)) throw new Error(`typert-loader: ${pkgName} TYPERT.schemas must be an array`);
  for (const value of schemas) {
    if (typeof value !== "object" || value === null) {
      throw new Error(`typert-loader: ${pkgName} TYPERT.schemas contains a non-object schema`);
    }
    const schema = value as Bag;
    requireString(pkgName, schema, "name", "schema");
    if (typeof schema["create"] !== "function") {
      throw new Error(`typert-loader: ${pkgName} TYPERT schema "${String(schema["name"])}" has no create() factory`);
    }
  }
  const model = requireObject(pkgName, manifest["model"], "TYPERT.model");
  const services = requireArray(pkgName, model["services"], "TYPERT.model.services");
  const events = requireArray(pkgName, model["events"], "TYPERT.model.events");
  const objects = requireArray(pkgName, model["objects"], "TYPERT.model.objects");
  for (const value of services) {
    const service = requireObject(pkgName, value, "service");
    requireDocumentation(pkgName, service, "service");
    requireString(pkgName, service, "key", "service");
    requireString(pkgName, service, "exportName", "service");
    requireMembers(pkgName, service["members"], `service "${String(service["key"])}"`);
    requireTypes(pkgName, service["types"], `service "${String(service["key"])}"`);
  }
  for (const value of events) {
    const event = requireObject(pkgName, value, "event");
    requireDocumentation(pkgName, event, "event");
    requireString(pkgName, event, "name", "event");
    requireString(pkgName, event, "signature", `event "${String(event["name"])}"`);
    if (event["mode"] !== undefined && typeof event["mode"] !== "string") {
      throw new Error(`typert-loader: ${pkgName} event "${String(event["name"])}" mode must be a string`);
    }
  }
  for (const value of objects) {
    const object = requireObject(pkgName, value, "object");
    requireDocumentation(pkgName, object, "object");
    requireString(pkgName, object, "name", "object");
    requireString(pkgName, object, "exportName", "object");
    requireMembers(pkgName, object["members"], `object "${String(object["name"])}"`);
    requireTypes(pkgName, object["types"], `object "${String(object["name"])}"`);
  }
  for (const value of requireArray(pkgName, manifest["invocations"], "TYPERT.invocations")) {
    requireInvocation(pkgName, value);
  }
  return manifest as unknown as TypertContribution;
}

/**
 * Bắt buộc một giá trị là object (không phải mảng).
 * @param pkgName - gói đang kiểm (cho thông điệp lỗi).
 * @param value - giá trị cần kiểm.
 * @param subject - tên chủ thể trong thông điệp lỗi.
 * @returns chính giá trị đó, đã hẹp kiểu.
 * @throws khi giá trị không phải object hoặc là mảng.
 */
function requireObject(pkgName: string, value: unknown, subject: string): Bag {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`typert-loader: ${pkgName} ${subject} must be an object`);
  }
  return value as Bag;
}

/**
 * Bắt buộc một giá trị là mảng.
 * @param pkgName - gói đang kiểm (cho thông điệp lỗi).
 * @param value - giá trị cần kiểm.
 * @param subject - tên chủ thể trong thông điệp lỗi.
 * @returns chính mảng đó.
 * @throws khi giá trị không phải mảng.
 */
function requireArray(pkgName: string, value: unknown, subject: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`typert-loader: ${pkgName} ${subject} must be an array`);
  return value;
}

/**
 * Bắt buộc một trường là chuỗi KHÁC RỖNG.
 * @param pkgName - gói đang kiểm (cho thông điệp lỗi).
 * @param value - object chứa trường.
 * @param key - tên trường.
 * @param subject - tên chủ thể trong thông điệp lỗi.
 * @returns không trả gì; ném khi trường thiếu, không phải chuỗi, hoặc rỗng.
 */
function requireString(pkgName: string, value: Bag, key: string, subject: string): void {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new Error(`typert-loader: ${pkgName} ${subject} has a missing or empty ${key}`);
  }
}

/**
 * Kiểm một trường TUỲ CHỌN: vắng thì bỏ qua, có thì phải là chuỗi.
 * @param pkgName - gói đang kiểm (cho thông điệp lỗi).
 * @param value - object chứa trường.
 * @param key - tên trường.
 * @param subject - tên chủ thể trong thông điệp lỗi.
 * @returns không trả gì; ném khi trường có mặt mà không phải chuỗi.
 */
function requireOptionalString(pkgName: string, value: Bag, key: string, subject: string): void {
  if (value[key] !== undefined && typeof value[key] !== "string") {
    throw new Error(`typert-loader: ${pkgName} ${subject}.${key} must be a string`);
  }
}

/**
 * Kiểm phần tài liệu của một phần tử phản chiếu: `tags` là mảng, ba trường chữ là chuỗi khi có.
 * @param pkgName - gói đang kiểm (cho thông điệp lỗi).
 * @param value - phần tử phản chiếu.
 * @param subject - tên chủ thể trong thông điệp lỗi.
 * @returns không trả gì; ném ở trường sai kiểu đầu tiên theo thứ tự bản gốc.
 */
function requireDocumentation(pkgName: string, value: Bag, subject: string): void {
  requireArray(pkgName, value["tags"], `${subject}.tags`);
  for (const key of ["description", "summary", "jsDoc"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      throw new Error(`typert-loader: ${pkgName} ${subject}.${key} must be a string`);
    }
  }
}

/**
 * Kiểm danh sách thành viên: mỗi thành viên có `name`, `signature` và `kind` hợp lệ.
 * @param pkgName - gói đang kiểm (cho thông điệp lỗi).
 * @param value - giá trị `members` cần kiểm.
 * @param subject - tên chủ thể trong thông điệp lỗi.
 * @returns không trả gì; ném ở thành viên sai đầu tiên.
 */
function requireMembers(pkgName: string, value: unknown, subject: string): void {
  for (const item of requireArray(pkgName, value, `${subject}.members`)) {
    const member = requireObject(pkgName, item, `${subject} member`);
    requireString(pkgName, member, "name", `${subject} member`);
    requireString(pkgName, member, "signature", `${subject} member`);
    if (typeof member["kind"] !== "string" || !MEMBER_KINDS.has(member["kind"])) {
      throw new Error(`typert-loader: ${pkgName} ${subject} member "${String(member["name"])}" has invalid kind`);
    }
  }
}

/**
 * Kiểm danh sách khai báo kiểu: mỗi kiểu có `name` và `declaration`.
 * @param pkgName - gói đang kiểm (cho thông điệp lỗi).
 * @param value - giá trị `types` cần kiểm.
 * @param subject - tên chủ thể trong thông điệp lỗi.
 * @returns không trả gì; ném ở kiểu sai đầu tiên.
 */
function requireTypes(pkgName: string, value: unknown, subject: string): void {
  for (const item of requireArray(pkgName, value, `${subject}.types`)) {
    const type = requireObject(pkgName, item, `${subject} type`);
    requireString(pkgName, type, "name", `${subject} type`);
    requireString(pkgName, type, "declaration", `${subject} type`);
  }
}

/**
 * Kiểm một định nghĩa lời gọi Remote: khoá định danh, bộ nhận, tham số, codec, phạm vi, huỷ.
 * @param pkgName - gói đang kiểm (cho thông điệp lỗi).
 * @param value - định nghĩa lời gọi cần kiểm.
 * @returns không trả gì; ném ở khuyết điểm đầu tiên theo đúng thứ tự bản gốc.
 */
function requireInvocation(pkgName: string, value: unknown): void {
  const invocation = requireObject(pkgName, value, "invocation");
  for (const key of ["id", "service", "namespace", "method"]) requireString(pkgName, invocation, key, "invocation");
  const id = String(invocation["id"]);
  requireOptionalString(pkgName, invocation, "description", `invocation "${id}"`);
  if (invocation["mode"] !== undefined && invocation["mode"] !== "stream") {
    throw new Error(`typert-loader: ${pkgName} invocation "${id}" mode must be "stream" when present`);
  }
  const receiver = requireObject(pkgName, invocation["invocation"], `invocation "${id}" receiver`);
  if (receiver["kind"] === "context") {
    requireString(pkgName, receiver, "context", `invocation "${id}" Context receiver`);
    requireString(pkgName, receiver, "wire", `invocation "${id}" Context receiver`);
    requireStrictCodec(pkgName, receiver["codec"], `invocation "${id}" Context codec`);
  } else if (receiver["kind"] !== "direct") {
    throw new Error(`typert-loader: ${pkgName} invocation "${id}" receiver kind must be "direct" or "context"`);
  }
  const wires = new Set<string>();
  const parameters = new Map<string, Bag>();
  let lookupCount = 0;
  for (const valueParameter of requireArray(pkgName, invocation["parameters"], `invocation "${id}" parameters`)) {
    const parameter = requireObject(pkgName, valueParameter, `invocation "${id}" parameter`);
    requireString(pkgName, parameter, "name", `invocation "${id}" parameter`);
    requireString(pkgName, parameter, "wire", `invocation "${id}" parameter`);
    requireOptionalString(pkgName, parameter, "description", `invocation "${id}" parameter`);
    const wire = String(parameter["wire"]);
    if (wires.has(wire)) throw new Error(`typert-loader: ${pkgName} invocation "${id}" repeats wire field "${wire}"`);
    wires.add(wire);
    if (parameter["source"] === "lookup") {
      lookupCount += 1;
      requireString(pkgName, parameter, "lookup", `invocation "${id}" lookup parameter`);
    } else if (parameter["source"] === "json") {
      if (parameter["lookup"] !== undefined) {
        throw new Error(`typert-loader: ${pkgName} invocation "${id}" JSON parameter declares a lookup`);
      }
    } else {
      throw new Error(`typert-loader: ${pkgName} invocation "${id}" parameter source must be "json" or "lookup"`);
    }
    parameters.set(wire, parameter);
    requireStrictCodec(pkgName, parameter["codec"], `invocation "${id}" parameter codec`);
    if (parameter["strictCodec"] !== undefined) {
      requireStrictCodec(pkgName, parameter["strictCodec"], `invocation "${id}" strict input codec`);
    }
  }
  if (invocation["cancellation"] !== undefined) {
    if (requireObject(pkgName, invocation["cancellation"], `invocation "${id}" cancellation`)["parameter"] !== "signal") {
      throw new Error(`typert-loader: ${pkgName} invocation "${id}" cancellation parameter must be "signal"`);
    }
  }
  if (invocation["scope"] !== undefined) {
    if (receiver["kind"] !== "direct") {
      throw new Error(`typert-loader: ${pkgName} invocation "${id}" Context receiver cannot declare a direct scope projection`);
    }
    const scope = requireObject(pkgName, invocation["scope"], `invocation "${id}" scope`);
    requireString(pkgName, scope, "context", `invocation "${id}" scope`);
    requireString(pkgName, scope, "wire", `invocation "${id}" scope`);
    const parameter = parameters.get(String(scope["wire"]));
    if (lookupCount !== 1 || parameter === undefined || parameter["source"] !== "lookup" || parameter["lookup"] !== scope["context"]) {
      throw new Error(
        `typert-loader: ${pkgName} invocation "${id}" scope wire "${String(scope["wire"])}" must select its only lookup parameter`,
      );
    }
  }
  if (receiver["kind"] === "context" && wires.has(String(receiver["wire"]))) {
    throw new Error(`typert-loader: ${pkgName} invocation "${id}" repeats Context wire field "${String(receiver["wire"])}"`);
  }
  requireStrictCodec(pkgName, invocation["result"], `invocation "${id}" result codec`);
  if (invocation["input"] !== undefined || invocation["invoke"] !== undefined) {
    if (receiver["kind"] !== "direct") {
      throw new Error(`typert-loader: ${pkgName} invocation "${id}" input/invoke require a direct receiver`);
    }
    if (typeof invocation["input"] !== "function") {
      throw new Error(`typert-loader: ${pkgName} invocation "${id}" has no input() selector`);
    }
    if (typeof invocation["invoke"] !== "function") {
      throw new Error(`typert-loader: ${pkgName} invocation "${id}" has no invoke() function`);
    }
  }
  if (invocation["sourceLocation"] !== undefined) {
    const location = requireObject(pkgName, invocation["sourceLocation"], `invocation "${id}" sourceLocation`);
    requireString(pkgName, location, "file", `invocation "${id}" sourceLocation`);
    for (const key of ["line", "column"]) {
      const number = location[key];
      if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
        throw new Error(`typert-loader: ${pkgName} invocation "${id}" sourceLocation.${key} must be a positive integer`);
      }
    }
  }
}

/**
 * Kiểm trường chiếu của một schema: có nhà máy `create()`, và các trường chiếu háo hức đúng kiểu.
 *
 * Đọc qua `getOwnPropertyDescriptors` đúng như bản gốc: getter của schema KHÔNG bị gọi trong lượt
 * kiểm này, nên vật thể tính toán vẫn LAZY.
 * @param pkgName - gói đang kiểm (cho thông điệp lỗi).
 * @param value - vật thể mang schema (codec hoặc nhà máy).
 * @param subject - tên chủ thể trong thông điệp lỗi.
 * @returns không trả gì; ném khi thiếu `create()` hoặc trường chiếu sai kiểu.
 */
function requireSchemaProjection(pkgName: string, value: Bag, subject: string): void {
  if (typeof value["create"] !== "function") {
    throw new Error(`typert-loader: ${pkgName} ${subject} has no create() factory`);
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ["description", "jsonSchemaError"]) {
    const field = fields[key]?.value;
    if (field !== undefined && typeof field !== "string") {
      throw new Error(`typert-loader: ${pkgName} ${subject}.${key} must be a string`);
    }
  }
  const schema = fields["jsonSchema"]?.value;
  if (schema !== undefined) requireObject(pkgName, schema, `${subject}.jsonSchema`);
}

/**
 * Kiểm một codec: chế độ phải là `strict`, có `typeSymbol`, `decode`/`encode` là hàm khi có,
 * và trường chiếu schema hợp lệ.
 * @param pkgName - gói đang kiểm (cho thông điệp lỗi).
 * @param value - giá trị codec cần kiểm.
 * @param subject - tên chủ thể trong thông điệp lỗi.
 * @returns không trả gì; ném ở khuyết điểm đầu tiên theo đúng thứ tự bản gốc.
 */
function requireStrictCodec(pkgName: string, value: unknown, subject: string): void {
  const codec = requireObject(pkgName, value, subject);
  if (codec["mode"] !== "strict") throw new Error(`typert-loader: ${pkgName} ${subject} must use a strict codec`);
  requireString(pkgName, codec, "typeSymbol", subject);
  for (const method of ["decode", "encode"]) {
    if (codec[method] !== undefined && typeof codec[method] !== "function") {
      throw new Error(`typert-loader: ${pkgName} ${subject} ${method} must be a function`);
    }
  }
  requireSchemaProjection(pkgName, codec, subject);
}
