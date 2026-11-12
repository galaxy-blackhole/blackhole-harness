/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 vùng assistant-stream.js của @deepseek-ai/dsh-llm (lib/index.js dòng 1125–1564):
 *      biểu diễn compact lossless của một lần stream, accumulator, expander và các reader
 *      record-level; giữ nguyên thuật toán, thứ tự gộp và chuỗi lỗi của bản gốc.
 */

/**
 * Lossless compact representation of one model-stream attempt, plus record-level
 * readers that answer common consumer questions without materializing members.
 * Readers trust the static record type; expandAssistantStream is the validating
 * path for records read at a durable boundary.
 */

import { assertNever, deepFreeze, snapshotJsonValue } from "@deepseek-ai/dsh-util-values";
import { BlockAssembler } from "./assembler.ts";
import type { ToolCallId } from "./brand.ts";
import type { ContentBlock, StreamChunk } from "./types.ts";

/** One model chunk paired with its original Session timestamp. */
export interface TimedStreamChunk {
  readonly time: number;
  readonly chunk: StreamChunk;
}

/** Lossless compact records embedded in durable Assistant attempt events. */
export type AssistantStreamRecord =
  | {
      readonly type: "text-chunks";
      readonly time0: number;
      readonly index: number;
      readonly dt: readonly number[];
      readonly texts: readonly string[];
    }
  | {
      readonly type: "reasoning-chunks";
      readonly time0: number;
      readonly index: number;
      readonly dt: readonly number[];
      readonly texts: readonly string[];
    }
  | {
      readonly type: "tool-call-chunks";
      readonly time0: number;
      readonly index: number;
      readonly dt: readonly number[];
      readonly id: ToolCallId;
      readonly name?: string;
      readonly args: readonly string[];
    }
  | {
      readonly type: "chunk";
      readonly time: number;
      readonly chunk: StreamChunk;
    };

/** One packed delta run: every compact record except a raw `chunk`. */
export type AssistantStreamRun = Exclude<AssistantStreamRecord, { type: "chunk" }>;

/**
 * Chunk types the accumulator never packs into runs, so every occurrence is a raw
 * `chunk` record. Delta types are excluded because their packed members are not raw chunks.
 */
export type RawStreamChunkType = Exclude<StreamChunk["type"], "text-delta" | "reasoning-delta" | "tool-call-delta">;

/** Raw chunk record retained verbatim while streaming. */
interface MutableRawRecord {
  type: "chunk";
  time: number;
  chunk: StreamChunk;
}

/** Packed text or reasoning delta run while streaming. */
interface MutableTextRun {
  type: "text-chunks" | "reasoning-chunks";
  time0: number;
  index: number;
  dt: number[];
  texts: string[];
  lastTime: number;
}

/** Packed tool-call delta run while streaming. */
interface MutableToolCallRun {
  type: "tool-call-chunks";
  time0: number;
  index: number;
  dt: number[];
  id: ToolCallId;
  name?: string;
  args: string[];
  lastTime: number;
}

/** Any record retained by the accumulator before it is detached. */
type MutableRecord = MutableRawRecord | MutableTextRun | MutableToolCallRun;

/**
 * Kiểm một mốc thời gian của stream là số nguyên an toàn.
 * @param value - mốc thời gian cần kiểm.
 * @returns chính mốc thời gian đó khi hợp lệ.
 * @throws {TypeError} khi giá trị không phải số nguyên an toàn.
 */
function safeTime(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Assistant stream time must be a safe integer, got ${String(value)}`);
  }
  return value;
}

/**
 * Kiểm một index block là số nguyên an toàn không âm.
 * @param value - index cần kiểm.
 * @param label - nhãn loại record dùng trong thông báo lỗi.
 * @returns chính index đó khi hợp lệ.
 * @throws {TypeError} khi giá trị âm, -0, hoặc không phải số nguyên an toàn.
 */
function safeIndex(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`${label} index must be a non-negative safe integer`);
  }
  return value;
}

/**
 * Chụp một bản JSON lossless của chunk để accumulator không giữ tham chiếu của người gọi.
 * @param chunk - chunk cần chụp.
 * @returns bản snapshot đã tách rời.
 * @throws {TypeError} khi chunk không serialize JSON lossless được.
 */
function snapshotChunk(chunk: StreamChunk): StreamChunk {
  const snapshot = snapshotJsonValue(chunk);
  if (snapshot === undefined) throw new TypeError("Assistant stream chunk must be losslessly JSON-serializable");
  return snapshot;
}

/**
 * Khoảng thời gian giữa hai mốc liên tiếp, chỉ nhận khi phép cộng tái tạo đúng mốc sau.
 * @param previous - mốc trước.
 * @param next - mốc sau.
 * @returns khoảng an toàn, hoặc undefined khi không biểu diễn được chính xác.
 */
function safeGap(previous: number, next: number): number | undefined {
  const gap = next - previous;
  return Number.isSafeInteger(gap) && previous + gap === next ? gap : undefined;
}

/** Incrementally compacts one attempt without retaining a second raw-chunk list. */
export class AssistantStreamAccumulator {
  private readonly records: MutableRecord[] = [];

  /**
   * Add one timed chunk to the compact attempt stream.
   * @param value - model chunk and its original Session timestamp.
   * @returns a detached immutable copy for assembly and live publication.
   */
  push(value: TimedStreamChunk): TimedStreamChunk {
    const time = safeTime(value.time);
    const chunk = snapshotChunk(value.chunk);
    const timed = deepFreeze({ time, chunk });
    const previous = this.records.at(-1);
    switch (chunk.type) {
      case "text-delta":
      case "reasoning-delta": {
        safeIndex(chunk.index, chunk.type);
        if (typeof chunk.text !== "string") throw new TypeError(`${chunk.type} text must be a string`);
        const type = chunk.type === "text-delta" ? "text-chunks" : "reasoning-chunks";
        const gap = previous !== undefined && previous.type === type ? safeGap(previous.lastTime, time) : undefined;
        if (previous !== undefined && previous.type === type && previous.index === chunk.index && gap !== undefined) {
          previous.dt.push(gap);
          previous.texts.push(chunk.text);
          previous.lastTime = time;
        } else {
          this.records.push({ type, time0: time, index: chunk.index, dt: [], texts: [chunk.text], lastTime: time });
        }
        return timed;
      }
      case "tool-call-delta": {
        safeIndex(chunk.index, chunk.type);
        if (typeof chunk.id !== "string") throw new TypeError("tool-call-delta id must be a string");
        if (Object.hasOwn(chunk, "name") && typeof chunk.name !== "string") {
          throw new TypeError("tool-call-delta name must be a string");
        }
        if (typeof chunk.argumentsDelta !== "string") {
          throw new TypeError("tool-call-delta argumentsDelta must be a string");
        }
        if (chunk.id.length === 0 || chunk.name === "") {
          this.records.push({ type: "chunk", time, chunk });
          return timed;
        }
        const gap = previous?.type === "tool-call-chunks" ? safeGap(previous.lastTime, time) : undefined;
        const sameName =
          previous?.type === "tool-call-chunks" &&
          Object.hasOwn(previous, "name") === Object.hasOwn(chunk, "name") &&
          previous.name === chunk.name;
        if (
          previous?.type === "tool-call-chunks" &&
          previous.index === chunk.index &&
          previous.id === chunk.id &&
          sameName &&
          gap !== undefined
        ) {
          previous.dt.push(gap);
          previous.args.push(chunk.argumentsDelta);
          previous.lastTime = time;
        } else {
          this.records.push({
            type: "tool-call-chunks",
            time0: time,
            index: chunk.index,
            dt: [],
            id: chunk.id,
            ...(Object.hasOwn(chunk, "name") ? { name: chunk.name } : {}),
            args: [chunk.argumentsDelta],
            lastTime: time,
          });
        }
        return timed;
      }
      case "block-start":
      case "block-end":
      case "usage":
      case "finish":
        this.records.push({ type: "chunk", time, chunk });
        return timed;
      default:
        return assertNever(chunk, "AssistantStreamAccumulator.push");
    }
  }

  /**
   * Return the current compact attempt stream.
   * @returns a detached immutable record list suitable for a durable event.
   */
  snapshot(): readonly AssistantStreamRecord[] {
    const records = this.records.map((record): AssistantStreamRecord => {
      if (record.type === "chunk") return { ...record };
      const { lastTime: _lastTime, ...durable } = record;
      if (durable.type === "tool-call-chunks") {
        return { ...durable, dt: [...durable.dt], args: [...durable.args] };
      }
      return { ...durable, dt: [...durable.dt], texts: [...durable.texts] };
    });
    return deepFreeze(records);
  }
}

/**
 * Expand compact records into the exact timed chunk sequence.
 * @param stream - compact records from one durable Assistant settlement.
 * @returns detached timed chunks with every original delta boundary preserved.
 * @throws {TypeError} when a record or reconstructed timestamp is invalid.
 */
export function expandAssistantStream(stream: readonly AssistantStreamRecord[]): readonly TimedStreamChunk[] {
  const chunks: TimedStreamChunk[] = [];
  for (const candidate of stream) {
    const record = validateRecord(candidate);
    if (record.type === "chunk") {
      chunks.push({ time: record.time, chunk: record.chunk });
      continue;
    }
    const members = record.type === "tool-call-chunks" ? record.args : record.texts;
    let time = record.time0;
    for (let index = 0; index < members.length; index += 1) {
      if (index > 0) time += record.dt[index - 1]!;
      let chunk: StreamChunk;
      if (record.type === "text-chunks") {
        chunk = { type: "text-delta", index: record.index, text: members[index]! };
      } else if (record.type === "reasoning-chunks") {
        chunk = { type: "reasoning-delta", index: record.index, text: members[index]! };
      } else {
        chunk = {
          type: "tool-call-delta",
          index: record.index,
          id: record.id,
          ...(Object.hasOwn(record, "name") ? { name: record.name } : {}),
          argumentsDelta: members[index]!,
        };
      }
      chunks.push({ time, chunk });
    }
  }
  return chunks;
}

/**
 * Kiểm một văn bản có ít nhất một ký tự không phải khoảng trắng.
 * @param text - văn bản cần kiểm.
 * @returns true khi có nội dung nhìn thấy được.
 */
function hasNonWhitespace(text: string): boolean {
  return /\S/.test(text);
}

/**
 * Kiểm một block đã đóng có phải nội dung người đọc thấy được.
 * @param block - block đã đóng.
 * @returns false cho Tool call; text/reasoning chỉ tính khi có ký tự không khoảng trắng; kiểu khác luôn tính.
 */
function blockIsVisible(block: ContentBlock): boolean {
  if (block.type === "tool-call") return false;
  if (block.type === "text" || block.type === "reasoning") return hasNonWhitespace(block.text);
  return true;
}

/**
 * Whether one chunk carries the model's first output token for latency measurement.
 * @param chunk - any stream chunk.
 * @returns true for a non-empty text, reasoning, or Tool-call arguments fragment and for
 *   every name-bearing Tool-call delta; false for block, usage, and finish chunks.
 */
export function isTokenDelta(chunk: StreamChunk): boolean {
  switch (chunk.type) {
    case "text-delta":
    case "reasoning-delta":
      return chunk.text !== "";
    case "tool-call-delta":
      return chunk.argumentsDelta !== "" || chunk.name !== undefined;
    default:
      return false;
  }
}

/**
 * Whether one chunk by itself contributes reader-visible transcript content.
 * Text and reasoning count only with non-whitespace content, streamed as a delta or
 * completed as a block; a block of any other kind counts at its start and its end,
 * except a Tool call, which is protocol rather than content. Usage and finish never count.
 * @param chunk - any stream chunk.
 * @returns whether a transcript reader would see this chunk.
 */
export function isVisibleChunk(chunk: StreamChunk): boolean {
  switch (chunk.type) {
    case "text-delta":
    case "reasoning-delta":
      return hasNonWhitespace(chunk.text);
    case "block-start":
      return chunk.blockType !== "text" && chunk.blockType !== "reasoning" && chunk.blockType !== "tool-call";
    case "block-end":
      return blockIsVisible(chunk.block);
    default:
      return false;
  }
}

/**
 * Whether one chunk carries non-whitespace text, as a text delta or a completed text block.
 * Reasoning, Tool calls, and other block kinds never count.
 * @param chunk - any stream chunk.
 * @returns whether the chunk contributes visible text.
 */
export function chunkHasVisibleText(chunk: StreamChunk): boolean {
  if (chunk.type === "text-delta") return hasNonWhitespace(chunk.text);
  return chunk.type === "block-end" && chunk.block.type === "text" && hasNonWhitespace(chunk.block.text);
}

/**
 * Mốc thời gian của thành viên đầu tiên trong một run đã gộp mà predicate chấp nhận.
 * @param run - một run delta đã gộp.
 * @param predicate - điều kiện chọn thành viên.
 * @returns mốc thời gian tái dựng của thành viên đầu tiên khớp, hoặc undefined.
 */
function firstRunMemberTime(run: AssistantStreamRun, predicate: (fragment: string) => boolean): number | undefined {
  const fragments = run.type === "tool-call-chunks" ? run.args : run.texts;
  let time = run.time0;
  for (let index = 0; index < fragments.length; index += 1) {
    if (index > 0) time += run.dt[index - 1]!;
    if (predicate(fragments[index]!)) return time;
  }
  return undefined;
}

/**
 * Time of the first member of one packed run that {@link isTokenDelta} accepts: a
 * name-bearing Tool-call run starts at its first member, otherwise the first non-empty fragment.
 * Stops scanning at that member.
 * @param run - one packed delta run.
 * @returns the member's reconstructed time, or undefined when no member qualifies.
 */
export function runFirstTokenTime(run: AssistantStreamRun): number | undefined {
  if (run.type === "tool-call-chunks" && run.name !== undefined) return run.time0;
  return firstRunMemberTime(run, (fragment) => fragment !== "");
}

/**
 * Time of the first member of one packed run that {@link isVisibleChunk} accepts: the first
 * non-whitespace text or reasoning fragment. A Tool-call run has none. Stops scanning at that member.
 * @param run - one packed delta run.
 * @returns the member's reconstructed time, or undefined when no member qualifies.
 */
export function runFirstVisibleTime(run: AssistantStreamRun): number | undefined {
  return run.type === "tool-call-chunks" ? undefined : firstRunMemberTime(run, hasNonWhitespace);
}

/**
 * Time of the first token in one compact stream per {@link isTokenDelta}, read from the
 * records themselves and stopping at the first qualifying member.
 * @param stream - compact records from one durable Assistant settlement.
 * @returns the first token's time, or undefined when the stream carries no token.
 */
export function assistantStreamFirstTokenTime(stream: readonly AssistantStreamRecord[]): number | undefined {
  for (const record of stream) {
    const time =
      record.type === "chunk"
        ? isTokenDelta(record.chunk)
          ? record.time
          : undefined
        : runFirstTokenTime(record);
    if (time !== undefined) return time;
  }
  return undefined;
}

/**
 * Whether one compact stream carries any reader-visible content per {@link isVisibleChunk},
 * stopping at the first qualifying member.
 * @param stream - compact records from one durable Assistant settlement.
 * @returns whether a transcript reader would see anything from this stream.
 */
export function assistantStreamHasVisibleContent(stream: readonly AssistantStreamRecord[]): boolean {
  return stream.some((record) =>
    record.type === "chunk" ? isVisibleChunk(record.chunk) : runFirstVisibleTime(record) !== undefined,
  );
}

/**
 * Whether one compact stream carries non-whitespace text per {@link chunkHasVisibleText},
 * stopping at the first qualifying member.
 * @param stream - compact records from one durable Assistant settlement.
 * @returns whether the stream contributes visible text.
 */
export function assistantStreamHasVisibleText(stream: readonly AssistantStreamRecord[]): boolean {
  return stream.some((record) =>
    record.type === "text-chunks"
      ? record.texts.some(hasNonWhitespace)
      : record.type === "chunk" && chunkHasVisibleText(record.chunk),
  );
}

/**
 * The last raw chunk of one never-packed type, scanning backwards and stopping at the first hit.
 * @param stream - compact records from one durable Assistant settlement.
 * @param type - chunk type that only appears as a raw record.
 * @returns the stream's final chunk of that type, or undefined when it has none.
 */
export function lastAssistantStreamChunk<T extends RawStreamChunkType>(
  stream: readonly AssistantStreamRecord[],
  type: T,
): Extract<StreamChunk, { type: T }> | undefined {
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index];
    if (record?.type === "chunk" && record.chunk.type === type) {
      return record.chunk as Extract<StreamChunk, { type: T }>;
    }
  }
  return undefined;
}

/**
 * Every raw chunk of one never-packed type, in stream order.
 * @param stream - compact records from one durable Assistant settlement.
 * @param type - chunk type that only appears as a raw record.
 * @returns the matching chunks; empty when the stream has none.
 */
export function assistantStreamChunks<T extends RawStreamChunkType>(
  stream: readonly AssistantStreamRecord[],
  type: T,
): readonly Extract<StreamChunk, { type: T }>[] {
  const chunks: Extract<StreamChunk, { type: T }>[] = [];
  for (const record of stream) {
    if (record.type === "chunk" && record.chunk.type === type) {
      chunks.push(record.chunk as Extract<StreamChunk, { type: T }>);
    }
  }
  return chunks;
}

/**
 * Every streamed text-delta fragment joined in stream order; reasoning and Tool-call fragments are excluded.
 * @param stream - compact records from one durable Assistant settlement.
 * @returns the joined text, empty when the stream carries no text delta.
 */
export function joinAssistantStreamText(stream: readonly AssistantStreamRecord[]): string {
  const parts: string[] = [];
  for (const record of stream) {
    if (record.type === "text-chunks") parts.push(record.texts.join(""));
    else if (record.type === "chunk" && record.chunk.type === "text-delta") parts.push(record.chunk.text);
  }
  return parts.join("");
}

/**
 * Feed one compact stream into a {@link BlockAssembler} without materializing members.
 * Each run contributes one delta carrying its joined fragments, which assembles the same
 * blocks as the original per-member deltas because assembly only concatenates them;
 * raw chunks are pushed as recorded. The records are trusted, not validated: validate a
 * stream read at a durable boundary with {@link expandAssistantStream} first.
 * @param stream - compact records from one durable Assistant settlement.
 * @param assembler - assembler to feed; a fresh one by default.
 * @returns the same assembler after every record was pushed.
 */
export function assembleAssistantStream(
  stream: readonly AssistantStreamRecord[],
  assembler: BlockAssembler = new BlockAssembler(),
): BlockAssembler {
  for (const record of stream) {
    switch (record.type) {
      case "chunk":
        assembler.push(record.chunk);
        break;
      case "text-chunks":
        assembler.push({ type: "text-delta", index: record.index, text: record.texts.join("") });
        break;
      case "reasoning-chunks":
        assembler.push({ type: "reasoning-delta", index: record.index, text: record.texts.join("") });
        break;
      case "tool-call-chunks":
        assembler.push({
          type: "tool-call-delta",
          index: record.index,
          id: record.id,
          ...(record.name === undefined ? {} : { name: record.name }),
          argumentsDelta: record.args.join(""),
        });
        break;
      default:
        assertNever(record, "assembleAssistantStream");
    }
  }
  return assembler;
}

/**
 * Kiểm và trả một record compact đọc từ biên bền vững.
 * @param value - ứng viên record chưa được tin.
 * @returns record đã kiểm, giữ nguyên danh tính và thứ tự của giá trị đầu vào.
 * @throws {TypeError} khi record sai hình dạng, sai khoá, sai kiểu hoặc mốc thời gian không an toàn.
 */
function validateRecord(value: unknown): AssistantStreamRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Assistant stream record must be an object");
  }
  const record = value as AssistantStreamRecord;
  const unvalidated = value as { readonly type?: unknown };
  switch (record.type) {
    case "text-chunks":
    case "reasoning-chunks": {
      exactKeys(record, ["type", "time0", "index", "dt", "texts"], record.type);
      const texts = stringArray(record.texts, `${record.type} texts`);
      if (texts.length === 0) throw new TypeError(`${record.type} texts must be non-empty`);
      validateRun(record, texts.length, record.type);
      return record;
    }
    case "tool-call-chunks": {
      const keys = Object.hasOwn(record, "name")
        ? ["type", "time0", "index", "dt", "id", "name", "args"]
        : ["type", "time0", "index", "dt", "id", "args"];
      exactKeys(record, keys, record.type);
      const args = stringArray(record.args, "tool-call-chunks args");
      if (args.length === 0) throw new TypeError("tool-call-chunks args must be non-empty");
      if (typeof record.id !== "string" || record.id.length === 0) {
        throw new TypeError("tool-call-chunks id must be a non-empty string");
      }
      if (record.name !== undefined && (typeof record.name !== "string" || record.name.length === 0)) {
        throw new TypeError("tool-call-chunks name must be a non-empty string");
      }
      validateRun(record, args.length, record.type);
      return record;
    }
    case "chunk": {
      exactKeys(record, ["type", "time", "chunk"], "chunk");
      const time = safeTime(record.time);
      if (typeof record.chunk !== "object" || record.chunk === null || Array.isArray(record.chunk)) {
        throw new TypeError("Assistant stream raw chunk must be a lossless JSON object");
      }
      let chunk: StreamChunk;
      try {
        chunk = snapshotChunk(record.chunk);
      } catch (error) {
        throw new TypeError("Assistant stream raw chunk must be a lossless JSON object", { cause: error });
      }
      return deepFreeze({ type: "chunk", time, chunk });
    }
    default:
      throw new TypeError(`Unsupported Assistant stream record ${JSON.stringify(unvalidated.type)}`);
  }
}

/**
 * Kiểm các trường chung của một packed run và tính lại mọi mốc thành viên.
 * @param record - record run đã qua kiểm khoá và mảng thành viên.
 * @param members - số thành viên của run.
 * @param label - nhãn loại record dùng trong thông báo lỗi.
 * @returns không trả gì; ném TypeError khi thời gian hoặc độ dài dt không hợp lệ.
 */
function validateRun(record: AssistantStreamRun, members: number, label: string): void {
  safeTime(record.time0);
  safeIndex(record.index, label);
  if (!Array.isArray(record.dt) || record.dt.some((value) => !Number.isSafeInteger(value))) {
    throw new TypeError(`${label} dt must contain safe integers`);
  }
  if (record.dt.length !== members - 1) {
    throw new TypeError(`${label} dt length must be one less than its members`);
  }
  let time = record.time0;
  for (const gap of record.dt) {
    time += gap;
    if (!Number.isSafeInteger(time)) throw new TypeError(`${label} member times must stay safe integers`);
  }
}

/**
 * Kiểm một giá trị là mảng chuỗi.
 * @param value - ứng viên chưa được tin.
 * @param label - nhãn trường dùng trong thông báo lỗi.
 * @returns chính mảng đó khi mọi thành viên là string.
 * @throws {TypeError} khi giá trị không phải mảng chuỗi.
 */
function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((member) => typeof member !== "string")) {
    throw new TypeError(`${label} must be a string array`);
  }
  return value as string[];
}

/**
 * Kiểm một record chỉ chứa đúng tập khoá quy định.
 * @param record - record cần kiểm.
 * @param keys - tập khoá bắt buộc.
 * @param label - nhãn loại record dùng trong thông báo lỗi.
 * @returns không trả gì; ném TypeError khi thừa hoặc thiếu khoá.
 */
function exactKeys(record: object, keys: readonly string[], label: string): void {
  if (Object.keys(record).length !== keys.length || !keys.every((key) => Object.hasOwn(record, key))) {
    throw new TypeError(`${label} Assistant stream record must contain exactly ${keys.join(", ")}`);
  }
}
