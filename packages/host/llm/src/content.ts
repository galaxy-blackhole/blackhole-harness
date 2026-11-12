/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Trợ giúp cấu trúc content-block: chiếu ảnh/tệp của request sang văn bản model đọc được, tính số
 *      ảnh còn phải offload, và chiếu cập nhật công cụ theo route. Port 1:1 vùng lib/types/content.js
 *      (dòng 517–838) của @deepseek-ai/dsh-llm — mọi chuỗi model nhìn thấy giữ NGUYÊN VĂN.
 */

import type {
  AttachmentStore,
  FileAttachmentRef,
  ImageAttachmentRef,
  ImageMediaType,
  RequestImageAttachment,
} from "@deepseek-ai/dsh-attachment";
import { assertNever } from "@deepseek-ai/dsh-util-values";
import type { Message } from "./message.ts";
import type {
  ContentBlock,
  ImageBlock,
  LlmImageRequestBudget,
  RequestMessage,
  ToolHistory,
  ToolSchema,
  ToolUpdate,
} from "./types.ts";

/** Đường dẫn trong thế giới thực thi mà công cụ của model dùng để đọc một đính kèm đã chuẩn hoá. */
export interface ImageAttachmentAccess {
  /** Đường dẫn tuyệt đối tới byte đã chuẩn hoá, bất biến; bên gọi phải coi nó là chỉ đọc. */
  readonlyPath: string;
}

/**
 * Giải đường dẫn thực thi hiện tại cho một tham chiếu ảnh bền.
 * Nhận: ref — tham chiếu đính kèm đã chuẩn hoá.
 * Trả: đường dẫn chỉ đọc trong thế giới thực thi, hoặc undefined khi không có.
 */
export type ImageAttachmentAccessResolver = (ref: ImageAttachmentRef) => ImageAttachmentAccess | undefined;

/**
 * Bắc vị trí đối tượng host của một provider đính kèm vào thế giới thực thi công cụ đang mount.
 * Bên gọi cấp ánh xạ của provider hệ thống tệp hiện tại, nhờ vậy định nghĩa attachment và LLM không
 * phải phụ thuộc lẫn nhau.
 * Nhận: attachments — provider sở hữu đối tượng đính kèm đã chuẩn hoá; mapHostPath — ánh xạ một
 * đường dẫn host tuyệt đối vào thế giới thực thi công cụ hiện tại; ref — tham chiếu đính kèm bền.
 * Trả: đường dẫn chỉ đọc trong thế giới thực thi, hoặc undefined khi một trong hai provider không
 * cấp ánh xạ.
 * Ném: lỗi attachment khi tham chiếu bền không hợp lệ.
 */
export function resolveImageAttachmentAccess(
  attachments: AttachmentStore,
  mapHostPath: (hostPath: string) => string | undefined,
  ref: ImageAttachmentRef,
): ImageAttachmentAccess | undefined {
  const hostPath = attachments.imageHostPath(ref);
  if (hostPath === undefined) return undefined;
  const readonlyPath = mapHostPath(hostPath);
  return readonlyPath === undefined ? undefined : { readonlyPath };
}

/**
 * Bọc một chuỗi thành literal JSON để nhúng vào văn bản model đọc.
 * Nhận: value — chuỗi cần bọc.
 * Trả: chuỗi đã bọc trong dấu nháy kép, kèm escape JSON.
 */
function quoted(value: string): string {
  return JSON.stringify(value);
}

/**
 * Dựng danh tính hiển thị của một ảnh: tên kèm id, hoặc chỉ id khi không có tên.
 * Nhận: ref — tham chiếu ảnh đã chuẩn hoá.
 * Trả: chuỗi danh tính ổn định.
 */
function imageIdentity(ref: ImageAttachmentRef): string {
  return ref.name === undefined ? String(ref.attachmentId) : `${quoted(ref.name)} (${ref.attachmentId})`;
}

/**
 * Ánh xạ media type của ảnh sang đuôi tệp tương ứng.
 * Nhận: mediaType — media type đã được kiểm từ byte lưu trữ.
 * Trả: đuôi tệp bắt đầu bằng dấu chấm.
 */
function extension(mediaType: ImageMediaType): string {
  switch (mediaType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return assertNever(mediaType, "image extension");
  }
}

/**
 * Dựng đoạn văn bản mô tả bản sao chuẩn hoá chỉ đọc của một ảnh.
 * Nhận: ref — tham chiếu ảnh đã chuẩn hoá; access — đường dẫn thực thi đã giải được.
 * Trả: câu nối tiếp mô tả đường dẫn, kích thước, media type và cách sao chép trước khi sửa.
 */
function normalizedAccessText(ref: ImageAttachmentRef, access: ImageAttachmentAccess): string {
  return ` Normalized copy (read-only; may be resized or re-encoded): ${quoted(access.readonlyPath)} (${ref.width}x${ref.height}px, ${ref.mediaType}). Source dimensions, format, and byte size may differ. Copy to a writable path ending in ${extension(ref.mediaType)} before editing.`;
}

/**
 * Văn bản ổn định hiển thị cho model không nhận nổi một tham chiếu ảnh bền.
 * Nhận: ref — đính kèm chuẩn hoá bền bị bỏ khỏi request.
 * Trả: placeholder chỉ-văn-bản tất định.
 */
export function textOnlyImageText(ref: ImageAttachmentRef): string {
  return `[image omitted because this model accepts text only; attachment sha256:${String(ref.attachmentId).slice(7, 15)}]`;
}

/**
 * Tay nắm ổn định cho model về ĐÚNG một ảnh của request. Danh tính lấy từ tham chiếu bền của chính
 * lần xuất hiện: phiên bản request được chuẩn bị theo attachment id, nên một phiên bản dùng chung có
 * thể phục vụ những lần xuất hiện có tên hiển thị khác nhau.
 * Nhận: ref — đính kèm chuẩn hoá bền của lần xuất hiện; version — kích thước ảnh request thật sự
 * được gửi; access — đường dẫn tuỳ chọn đã giải cho thế giới thực thi hiện tại.
 * Trả: tay nắm đính kèm kèm kích thước ảnh request.
 */
export function requestImageHandleText(
  ref: ImageAttachmentRef,
  version: Pick<RequestImageAttachment, "width" | "height">,
  access?: ImageAttachmentAccess,
): string {
  const preview = `Image ${imageIdentity(ref)}; request preview ${version.width}x${version.height}px.`;
  return access === undefined
    ? `${preview} It may be resized or re-encoded; source dimensions, format, and byte size may differ.`
    : preview + normalizedAccessText(ref, access);
}

/**
 * Placeholder ổn định cho từng ảnh bị bỏ vì giới hạn request.
 * Nhận: ref — đính kèm chuẩn hoá bền bị bỏ khỏi request này; access — đường dẫn tuỳ chọn do provider
 * giải cho công cụ của model.
 * Trả: danh tính, siêu dữ liệu chuẩn hoá và đường dẫn phục hồi nếu có.
 */
export function offloadedImageText(ref: ImageAttachmentRef, access?: ImageAttachmentAccess): string {
  const identity = `image omitted to fit request image limits; ${imageIdentity(ref)}.`;
  if (access === undefined) {
    return `[${identity} No local normalized image path is available; ask the user to attach it again if needed.]`;
  }
  return `[${identity}${normalizedAccessText(ref, access)}]`;
}

/**
 * Đúng khi content model đã định kiểu có chứa block ảnh. Đây là phép duyệt ảnh DUY NHẤT dùng chung
 * cho mọi chính sách ảnh (cổng năng lực, tuần tự hoá chỉ-văn-bản, khảo sát compaction), nên bên tiêu
 * thụ không thể lệch nhau một cách âm thầm.
 * Nhận: content — các block content model đã định kiểu.
 * Trả: true khi có ít nhất một block là ảnh.
 */
export function contentHasImage(content: readonly ContentBlock[]): boolean {
  return content.some((block) => block.type === "image");
}

/**
 * Đúng khi content model đã định kiểu có chứa block tệp.
 * Đọc content hiện tại ở mọi lần gọi, không giữ lại kết quả quét.
 * Nhận: content — các block content model đã định kiểu.
 * Trả: true khi có ít nhất một block là tệp.
 */
export function contentHasFile(content: readonly ContentBlock[]): boolean {
  for (const block of content) if (block.type === "file") return true;
  return false;
}

/**
 * Tay nắm ổn định cho model về một tham chiếu tệp bền: địa chỉ của bản sao lưu nguyên văn và chỉ dẫn
 * đọc nó khi cần. Đây là biểu diễn DUY NHẤT mà provider nhận được cho một tệp.
 * Nhận: ref — tham chiếu tệp nguyên văn bền; readonlyPath — đường dẫn thực thi của bản sao lưu, khi
 * giải được.
 * Trả: văn bản tay nắm tất định nêu tên tệp, kích thước và địa chỉ của nó.
 */
export function fileHandleText(ref: FileAttachmentRef, readonlyPath: string | undefined): string {
  const digest = String(ref.attachmentId).slice(7, 15);
  const identity = `File ${quoted(ref.name)} (${ref.bytes} bytes, sha256:${digest})`;
  if (readonlyPath === undefined) {
    return `[${identity} was uploaded, but the current execution environment cannot access a readable path. Report that limitation if its contents are needed; do not claim to have read it.]`;
  }
  return `[${identity}: verbatim read-only copy saved at ${quoted(readonlyPath)}. Read that path with your file tools when its contents are needed; copy it to a writable location before modifying it. When delegating file work, include this saved path in the delegation prompt; only subagents sharing this execution environment can read it.]`;
}

/**
 * Thay mọi lần xuất hiện tệp bằng văn bản tay nắm.
 * Nhận: blocks — các block content của một message; resolvePath — giải đường dẫn đọc hiện tại của
 * một tham chiếu.
 * Trả: mảng gốc khi không có tệp, ngược lại là mảng mới với văn bản tay nắm thay chỗ tệp.
 */
function replaceFilesWithHandles(
  blocks: readonly ContentBlock[],
  resolvePath: (ref: FileAttachmentRef) => string | undefined,
): readonly ContentBlock[] {
  let next: ContentBlock[] | undefined;
  for (const [index, block] of blocks.entries()) {
    if (block.type === "file") {
      next ??= blocks.slice(0, index);
      next.push({
        type: "text",
        text: fileHandleText(block.attachment, resolvePath(block.attachment)),
      });
      continue;
    }
    next?.push(block);
  }
  return next ?? blocks;
}

/**
 * Chiếu content tệp của request sang văn bản tay nắm tất định cho mọi route model. Khác ảnh, không
 * provider nào nhận block tệp một cách gốc, nên phép chiếu này là vô điều kiện trong lúc lắp request.
 * Nhận: messages — toàn bộ lịch sử request; resolvePath — giải đường dẫn đọc hiện tại trong thế giới
 * thực thi của một tham chiếu.
 * Trả: danh sách gốc khi không có tệp, ngược lại là bản sao nông của message với văn bản tay nắm.
 */
export function projectFilesToText(
  messages: readonly Message[],
  resolvePath: (ref: FileAttachmentRef) => string | undefined,
): readonly Message[];
/**
 * Bản chiếu tệp cho đầu vào request trộn message bền và message chỉ-trong-request.
 * Nhận: messages — toàn bộ đầu vào request; resolvePath — giải đường dẫn đọc trong thế giới thực thi
 * của một tham chiếu.
 * Trả: đầu vào gốc khi không có tệp, ngược lại là bản sao kèm văn bản tay nắm.
 */
export function projectFilesToText(
  messages: readonly RequestMessage[],
  resolvePath: (ref: FileAttachmentRef) => string | undefined,
): readonly RequestMessage[];
/** Cài đặt dùng chung cho cả hai dạng đầu vào ở trên; Trả: kết quả cùng kiểu với dạng đầu vào tương ứng. */
export function projectFilesToText(
  messages: readonly RequestMessage[],
  resolvePath: (ref: FileAttachmentRef) => string | undefined,
): readonly RequestMessage[] {
  if (!messages.some((message) => contentHasFile(message.content))) return messages;
  return messages.map((message) => {
    const content = replaceFilesWithHandles(message.content, resolvePath);
    return content === message.content
      ? message
      : {
          ...message,
          content,
        };
  });
}

/**
 * Độ dài base64 của byte ảnh thô, kể cả phần đệm.
 * Nhận: bytes — số byte thô.
 * Trả: số ký tự base64 tương ứng.
 */
function base64Length(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

/**
 * Duyệt mọi lần xuất hiện ảnh của content đã định kiểu theo thứ tự message.
 * Nhận: content — các block content model đã định kiểu; visit — được gọi một lần cho mỗi lần xuất hiện.
 * Trả: không (chỉ gọi visit).
 */
function visitImageBlocks(content: readonly ContentBlock[], visit: (block: ImageBlock) => void): void {
  for (const block of content) if (block.type === "image") visit(block);
}

/**
 * Thay mọi lần xuất hiện đã offload bằng placeholder của nó.
 * Nhận: blocks — các block content của một message; placeholder — dựng văn bản thay chỗ cho một
 * đính kèm đã offload.
 * Trả: mảng gốc khi không có gì bị offload, ngược lại là mảng mới đã thay chỗ.
 */
function replaceOffloadedImages(
  blocks: readonly ContentBlock[],
  placeholder: (ref: ImageAttachmentRef) => string,
): readonly ContentBlock[] {
  let next: ContentBlock[] | undefined;
  for (const [index, block] of blocks.entries()) {
    if (block.type === "image" && block.offloaded === true) {
      next ??= blocks.slice(0, index);
      next.push({
        type: "text",
        text: placeholder(block.attachment),
      });
      continue;
    }
    next?.push(block);
  }
  return next ?? blocks;
}

/**
 * Chiếu những lần xuất hiện đã offload của bề mặt sang văn bản tất định cho MỘT request. Tập đã
 * offload là dữ kiện bền của bề mặt, nên mọi route gửi cùng một tập; chỉ văn bản placeholder thuộc
 * về route.
 * Nhận: messages — lịch sử request đã dẫn xuất; placeholder — dựng văn bản thay chỗ cho một đính kèm
 * đã offload.
 * Trả: danh sách gốc khi không có gì bị offload, ngược lại là bản sao nông của message kèm placeholder.
 */
export function projectOffloadedImages(
  messages: readonly Message[],
  placeholder: (ref: ImageAttachmentRef) => string,
): readonly Message[];
/**
 * Bản chiếu ảnh đã offload cho đầu vào request trộn message bền và message chỉ-trong-request.
 * Nhận: messages — toàn bộ đầu vào request; placeholder — văn bản thay chỗ cho một đính kèm đã offload.
 * Trả: message gốc hoặc bản sao nông kèm placeholder.
 */
export function projectOffloadedImages(
  messages: readonly RequestMessage[],
  placeholder: (ref: ImageAttachmentRef) => string,
): readonly RequestMessage[];
/** Cài đặt dùng chung cho cả hai dạng đầu vào ở trên; Trả: kết quả cùng kiểu với dạng đầu vào tương ứng. */
export function projectOffloadedImages(
  messages: readonly RequestMessage[],
  placeholder: (ref: ImageAttachmentRef) => string,
): readonly RequestMessage[] {
  return messages.map((message) => {
    const content = replaceOffloadedImages(message.content, placeholder);
    return content === message.content
      ? message
      : {
          ...message,
          content,
        };
  });
}

/**
 * Số lần xuất hiện ảnh cũ nhất còn giữ mà ngân sách của một route cần bỏ, theo cả đơn vị đếm lẫn
 * lượng tử byte, một khi vượt ngân sách. Kết quả chỉ phụ thuộc các độ dài được biểu diễn, nên mọi
 * route gọi tên con số này theo cùng một cách.
 * Nhận: lengths — độ dài byte được biểu diễn của mọi lần xuất hiện còn giữ, cũ nhất trước;
 * budget — ngân sách đếm/byte và lượng tử bỏ bớt; không giới hạn khi vắng mặt.
 * Trả: số lần xuất hiện ở đầu dãy cần offload.
 */
function offloadedImagePrefixCount(
  lengths: readonly number[],
  budget: Pick<LlmImageRequestBudget, "maxBytes" | "maxImages" | "byteQuantum" | "countQuantum">,
): number {
  const total = lengths.reduce((sum, bytes) => sum + bytes, 0);
  const excessCount = budget.maxImages === undefined ? 0 : Math.max(0, lengths.length - budget.maxImages);
  const excessBytes = budget.maxBytes === undefined ? 0 : Math.max(0, total - budget.maxBytes);
  if (excessCount === 0 && excessBytes === 0) return 0;
  const countQuantum = budget.countQuantum ?? 1;
  const byteQuantum = budget.byteQuantum ?? 1;
  const removeCount = excessCount === 0 ? 0 : Math.ceil(excessCount / countQuantum) * countQuantum;
  const removeBytes = excessBytes === 0 ? 0 : Math.ceil(excessBytes / byteQuantum) * byteQuantum;
  let count = 0;
  let removedBytes = 0;
  for (const imageBytes of lengths) {
    if (
      count >= removeCount &&
      (removeBytes === 0 || (byteQuantum === 1 ? removedBytes >= removeBytes : removedBytes > removeBytes))
    ) {
      break;
    }
    removedBytes += imageBytes;
    count += 1;
  }
  return count;
}

/**
 * Số lần xuất hiện cũ nhất còn giữ mà một route vẫn phải offload trước khi request dẫn xuất vừa ngân
 * sách ở ĐÚNG độ dài byte mà route gửi; 0 khi request đã vừa. Route thất bại với
 * `IMAGE_OFFLOAD_REQUIRED` mang theo con số này thay vì tự offload.
 * Nhận: messages — lịch sử request dẫn xuất mang dấu `offloaded` của bề mặt; budget — cách biểu diễn,
 * ngân sách và lượng tử bỏ bớt của route; versionBytes — độ dài byte ảnh-request thật của một lần
 * xuất hiện còn giữ.
 * Trả: số lần xuất hiện cũ nhất còn phải offload thêm.
 */
export function requiredImageOffload(
  messages: readonly RequestMessage[],
  budget: Pick<LlmImageRequestBudget, "representation" | "maxBytes" | "maxImages" | "byteQuantum" | "countQuantum">,
  versionBytes: (block: ImageBlock) => number,
): number {
  const lengths: number[] = [];
  for (const message of messages) {
    visitImageBlocks(message.content, (block) => {
      if (block.offloaded === true) return;
      const bytes = versionBytes(block);
      lengths.push(budget.representation === "base64" ? base64Length(bytes) : bytes);
    });
  }
  return offloadedImagePrefixCount(lengths, budget);
}

/**
 * Thay mọi lần xuất hiện ảnh cho một model chỉ nhận văn bản.
 * Nhận: blocks — các block content của một message.
 * Trả: mảng gốc khi không có ảnh, ngược lại là mảng mới với placeholder chỉ-văn-bản.
 */
function replaceImagesForTextModel(blocks: readonly ContentBlock[]): readonly ContentBlock[] {
  let next: ContentBlock[] | undefined;
  for (const [index, block] of blocks.entries()) {
    if (block.type === "image") {
      next ??= blocks.slice(0, index);
      next.push({
        type: "text",
        text: textOnlyImageText(block.attachment),
      });
      continue;
    }
    next?.push(block);
  }
  return next ?? blocks;
}

/**
 * Chiếu content ảnh của request sang văn bản tất định cho ĐÚNG một model chỉ nhận văn bản.
 * Nhận: messages — toàn bộ lịch sử request.
 * Trả: danh sách gốc khi không có ảnh, ngược lại là bản sao nông của message kèm placeholder ổn định.
 */
export function projectImagesForTextModel(messages: readonly Message[]): readonly Message[];
/**
 * Bản chiếu ảnh cho model chỉ nhận văn bản, áp trên đầu vào request trộn message bền và
 * message chỉ-trong-request.
 * Nhận: messages — toàn bộ đầu vào request.
 * Trả: đầu vào gốc khi không có ảnh, ngược lại là bản sao kèm placeholder ổn định.
 */
export function projectImagesForTextModel(messages: readonly RequestMessage[]): readonly RequestMessage[];
/** Cài đặt dùng chung cho cả hai dạng đầu vào ở trên; Trả: kết quả cùng kiểu với dạng đầu vào tương ứng. */
export function projectImagesForTextModel(messages: readonly RequestMessage[]): readonly RequestMessage[] {
  if (!messages.some((message) => contentHasImage(message.content))) return messages;
  return messages.map((message) => {
    const content = replaceImagesForTextModel(message.content);
    return content === message.content
      ? message
      : {
          ...message,
          content,
        };
  });
}

/**
 * Bỏ mọi message role `developer` khỏi request.
 * Nhận: messages — các message của request.
 * Trả: mảng gốc khi không có message developer, ngược lại là mảng đã lọc.
 */
function withoutDeveloperMessages(messages: readonly RequestMessage[]): readonly RequestMessage[] {
  const retained = messages.filter((message) => message.role !== "developer");
  return retained.length === messages.length ? messages : retained;
}

/**
 * Dựng bảng khai báo công cụ từ lịch sử đã gấp của phiên.
 * Nhận: tools — schema công cụ đang hoạt động (có thể vắng); mode — chế độ cập nhật công cụ của route;
 * history — trạng thái bất biến gấp từ header đã ghi và message developer.
 * Trả: bảng khai báo theo tên, đã áp chế độ cập nhật của route.
 */
function toolDeclarations(
  tools: readonly ToolSchema[] | undefined,
  mode: ToolUpdate,
  history: ToolHistory,
): Map<string, ToolSchema> {
  const declarations = new Map<string, ToolSchema>(history.tools.map((tool): [string, ToolSchema] => [tool.name, tool]));
  for (const update of history.updates) {
    for (const tool of update.additions) {
      if (!declarations.has(tool.name)) {
        declarations.set(tool.name, {
          ...tool,
          deferLoading: true,
        });
      }
    }
  }
  switch (mode) {
    case "in-history":
      return declarations;
    case "addition-only": {
      const activeNames = new Set(tools?.map((tool) => tool.name));
      for (const name of declarations.keys()) if (!activeNames.has(name)) declarations.delete(name);
      return declarations;
    }
    /* v8 ignore next 2 -- closed-union exhaustiveness guard */
    default:
      return assertNever(mode);
  }
}

/** Message request và công cụ sau phép chiếu cập nhật công cụ của một route. */
export interface ProjectedToolUpdates {
  /** Lịch sử chỉ còn những cập nhật developer mà route và chuỗi khai báo này hỗ trợ. */
  readonly messages: readonly RequestMessage[];
  /** Khai báo provider, gồm cả định nghĩa hoãn nạp và giữ lại khi route hỗ trợ. */
  readonly tools: readonly ToolSchema[] | undefined;
}

/**
 * Dựng khai báo provider từ lịch sử đã gấp của phiên mà không đổi bộ công cụ hoạt động đã ghi.
 * Route không hỗ trợ và lịch sử không đầy đủ dùng khai báo hiện tại, không kèm cập nhật developer.
 * Công cụ nền khai báo hoãn nạp chỉ trở nên khả dụng sau lần bổ sung đầu tiên được giữ lại.
 * Nhận: messages — toàn bộ đầu vào request, hoặc tiền tố được chọn cho một lời gọi phụ trợ; tools —
 * schema công cụ đang hoạt động; toolUpdate — chế độ cập nhật của route đã giải; history — trạng thái
 * bất biến gấp từ header đã ghi và message developer (tuỳ chọn).
 * Trả: khai báo provider và lịch sử đã lọc tương ứng.
 */
export function projectToolUpdates(
  messages: readonly RequestMessage[],
  tools: readonly ToolSchema[] | undefined,
  toolUpdate: ToolUpdate | undefined,
  history?: ToolHistory,
): ProjectedToolUpdates {
  if (toolUpdate === undefined) {
    let immediateTools = tools;
    if (tools?.some((tool) => tool.deferLoading === true)) {
      immediateTools = tools.map(({ deferLoading: _loading, ...tool }) => tool);
    }
    return {
      messages: withoutDeveloperMessages(messages),
      tools: immediateTools,
    };
  }
  if (history === undefined) {
    return {
      messages: withoutDeveloperMessages(messages),
      tools,
    };
  }
  const messageIds = new Set(messages.flatMap((message) => (message.role === "developer" ? [message.id] : [])));
  if (history.updates.some((update) => !messageIds.has(update.messageId))) {
    return {
      messages: withoutDeveloperMessages(messages),
      tools,
    };
  }
  const declarations = toolDeclarations(tools, toolUpdate, history);
  const updateIds = new Set(history.updates.map((update) => update.messageId));
  const offered = new Set(history.tools.filter((tool) => !tool.deferLoading).map((tool) => tool.name));
  const projectedMessages: RequestMessage[] = [];
  for (const message of messages) {
    if (message.role !== "developer") {
      projectedMessages.push(message);
      continue;
    }
    if (!updateIds.has(message.id)) continue;
    const content = message.content.filter((block) => {
      switch (block.type) {
        case "tool-addition":
          if (!declarations.has(block.toolName) || offered.has(block.toolName)) return false;
          offered.add(block.toolName);
          return true;
        case "tool-removal":
          if (toolUpdate !== "in-history") return false;
          return offered.delete(block.toolName);
        default:
          return true;
      }
    });
    if (content.length === 0) continue;
    if (content.length === message.content.length) projectedMessages.push(message);
    else {
      projectedMessages.push({
        ...message,
        content,
      });
    }
  }
  return {
    messages:
      projectedMessages.length === messages.length && projectedMessages.every((message, index) => message === messages[index])
        ? messages
        : projectedMessages,
    tools: [...declarations.values()],
  };
}
