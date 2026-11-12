/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chuẩn hoá ở ranh giới sổ đăng ký: từ chối metadata lệnh sai TRƯỚC khi vào giao thức UI, và tách kết quả handler khỏi vật thể không tin cậy.
 */

import { SessionSeq } from "./seq.ts";
import type { CommandDefinition, CommandDescriptor, CommandInputDescriptor, CommandResult } from "./types.ts";

/** Một lệnh đã đăng ký: định nghĩa đóng băng + descriptor không có handler. */
export interface RegisteredCommand {
  /** Định nghĩa đã chuẩn hoá và đóng băng. */
  readonly definition: CommandDefinition;
  /** Góc nhìn không có handler trả cho UI. */
  readonly descriptor: CommandDescriptor;
}

/** Tên lệnh hợp lệ: chữ thường mở đầu, rồi chữ thường/số/gạch dưới/gạch nối. */
const COMMAND_NAME = /^[a-z][a-z0-9_-]*$/u;

/**
 * Từ chối metadata lệnh sai TRƯỚC khi nó có thể chạm tới một giao thức UI.
 * Nhận: `definition` — định nghĩa do plugin đăng ký.
 * Trả: cặp `{ definition, descriptor }` đã chuẩn hoá và ĐÓNG BĂNG (mỗi lớp một vật mới).
 * @throws {TypeError} khi tên/description/handler/hint/attachments sai hình dạng.
 */
export function normalizeDefinition(definition: CommandDefinition): RegisteredCommand {
  if (!COMMAND_NAME.test(definition.name)) throw new TypeError(`command name "${definition.name}" must match ${String(COMMAND_NAME)}`);
  if (typeof definition.description !== "string") throw new TypeError(`command "${definition.name}" description must be a string`);
  if (definition.description.trim().length === 0) throw new TypeError(`command "${definition.name}" description must not be empty`);
  if (typeof definition.handler !== "function") throw new TypeError(`command "${definition.name}" handler must be a function`);
  const rawInput = definition.input;
  let input: CommandInputDescriptor | undefined;
  if (rawInput !== undefined) {
    if (typeof rawInput !== "object" || rawInput === null || !("hint" in rawInput) || typeof rawInput.hint !== "string")
      throw new TypeError(`command "${definition.name}" input hint must be a string`);
    if (rawInput.hint.trim().length === 0) throw new TypeError(`command "${definition.name}" input hint must not be empty`);
    if ("attachments" in rawInput && rawInput.attachments !== undefined && typeof rawInput.attachments !== "boolean")
      throw new TypeError(`command "${definition.name}" input attachments flag must be a boolean`);
    input = Object.freeze({
      hint: rawInput.hint,
      ...("attachments" in rawInput && rawInput.attachments === true ? { attachments: true } : {}),
    });
  }
  const normalized = Object.freeze({
    ...(definition.definitionId === undefined ? {} : { definitionId: definition.definitionId }),
    name: definition.name,
    description: definition.description,
    ...(input === undefined ? {} : { input }),
    ...(definition.recordInput === undefined ? {} : { recordInput: definition.recordInput }),
    handler: definition.handler,
  });
  return {
    definition: normalized,
    descriptor: Object.freeze({
      ...(normalized.definitionId === undefined ? {} : { definitionId: normalized.definitionId }),
      name: normalized.name,
      description: normalized.description,
      ...(normalized.input === undefined ? {} : { input: normalized.input }),
    }),
  };
}

/**
 * Kiểm một giá trị là vị trí sự kiện Session hợp lệ rồi gắn nhãn cho nó.
 * Nhận: `command` — tên lệnh (để dựng thông điệp); `value` — giá trị handler khai.
 * Trả: số nguyên an toàn không âm đã gắn nhãn Session-seq.
 * @throws {TypeError} khi giá trị không phải số nguyên an toàn không âm (kể cả `-0`).
 */
function sessionSeqOf(command: string, value: unknown): ReturnType<typeof SessionSeq> {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0))
    throw new TypeError(`command "${command}" success sourceEventSeq must be a non-negative safe integer when supplied`);
  return SessionSeq(value);
}

/**
 * Kiểm và TÁCH kết quả handler không tin cậy ngay tại ranh giới sổ đăng ký.
 * Nhận: `command` — tên lệnh; `value` — giá trị handler trả về.
 * Trả: object ĐÓNG BĂNG đúng một trong hai dạng `success`/`error`.
 * @throws {TypeError} khi giá trị không phải CommandResult, hoặc trường tuỳ chọn sai kiểu.
 */
export function normalizeResult(command: string, value: unknown): CommandResult {
  if (typeof value !== "object" || value === null || !("kind" in value))
    throw new TypeError(`command "${command}" handler must return a CommandResult`);
  const result = value as { kind: unknown; text?: unknown; sourceEventSeq?: unknown };
  if (result.kind === "success") {
    if (result.text !== undefined && typeof result.text !== "string")
      throw new TypeError(`command "${command}" success text must be a string when supplied`);
    const sequence = result.sourceEventSeq === undefined ? undefined : sessionSeqOf(command, result.sourceEventSeq);
    return Object.freeze({
      kind: "success",
      ...(result.text === undefined ? {} : { text: result.text }),
      ...(sequence === undefined ? {} : { sourceEventSeq: sequence }),
    });
  }
  if (result.kind === "error") {
    if (typeof result.text !== "string" || result.text.trim().length === 0)
      throw new TypeError(`command "${command}" error text must be a non-empty string`);
    return Object.freeze({
      kind: "error",
      text: result.text,
    });
  }
  throw new TypeError(`command "${command}" returned unknown result kind "${String(result.kind)}"`);
}
