/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mo hinh the anh cua row ui-tool: nhan dien duong bao image cua read_image, lat cat metadata va tham chieu dinh kem
 */

import { parsedToolCall } from "./model-tool-call.ts";

/** Du lieu tho doc tu day (khoi goi tool · ket qua · metadata da luu) — giu 'any' cho gon nhu ban goc khong dat kieu. */
type Wire = any;

/** Mot tham chieu dinh kem da duoc lat cat tu mot khoi anh cua ket qua. */
interface ImageReference {
  attachmentId: string;
  mediaType: string;
  bytes: number;
  width: number;
  height: number;
  /** Ten tep, chi xuat hien khi duong bao co khai. */
  name?: string;
  /** Kich thuoc goc truoc khi thu nho, chi xuat hien khi duong bao co khai. */
  originalDimensions?: { width: number; height: number };
}

/** Mo hinh the anh da det ma hang read_image dung de render gallery. */
interface ImageCardModel {
  path: string;
  images: { attachment: ImageReference }[];
  extraText: string | null;
}

/**
 * Whether a wire value is a usable pixel or byte measure.
 * @param value - unvalidated wire value.
 * @returns true when it is a positive integer.
 */
export function positiveInteger(value: Wire): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** The envelope `formatImageReadOutput` writes, matched by shape. */
export const IMAGE_ENVELOPE = /^<path>[^\n]*<\/path>\n<type>image<\/type>\n<content>\n[\s\S]*\n<\/content>$/u;

/** The media types a durable image block may claim; anything else declines.
 *  Hand-written mirror of `ImageMediaType` from dsh-attachment — the wire
 *  boundary needs a runtime check and feature plugins must not import values
 *  from each other; a new member added there must be added here too, or the
 *  decline point below silently degrades that image to the generic card. */
export const IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);

/** Runtime membership check; the cast is safe because the set holds exactly the four members. */
export function isImageMediaType(value: string): boolean {
  return IMAGE_MEDIA_TYPES.has(value);
}

/**
 * Narrow the persisted metadata, defensively. Every field arrives unvalidated on
 * replay (an obsolete or hand-edited log reaches here), so any mismatch declines
 * to the generic card rather than throwing. An absent `meta` (a nested call
 * persists none) leaves the path to the call's own `file_path` argument.
 *
 * The attachment id is checked for existence only: it is opaque and
 * provider-owned, and consumers must not parse that representation, so
 * pattern-matching the local content-address form would reject a legitimate id
 * minted by an alternative store.
 * @param meta - persisted presentation metadata of unknown shape.
 * @returns the narrowed path, or null when it does not match.
 */
export function imageMeta(meta: Wire): { path: string } | null {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
  const { path } = meta;
  if (typeof path !== "string" || path === "") return null;
  return { path };
}

/**
 * Narrow every attachment reference carried by the result's image blocks, in
 * order.
 *
 * The content is the single source of truth for the references: it is what the
 * tool actually returned and what a post-execute hook would replace together
 * with the rest of the content. Every field arrives unvalidated over the wire,
 * so any malformed image block declines to the generic card rather than
 * rendering a partial gallery.
 *
 * The attachment id is checked for existence only — it is opaque and
 * provider-owned, so pattern-matching the local content-address form would reject
 * a legitimate id minted by an alternative store.
 * @param content - the settled result's content blocks.
 * @returns the narrowed references, or null when no valid image block is present.
 */
export function imageReferences(content: Wire): ImageReference[] | null {
  const refs: ImageReference[] = [];
  for (const part of content) {
    if (typeof part !== "object" || part === null) continue;
    const { type, attachment } = part;
    if (type !== "image") continue;
    if (typeof attachment !== "object" || attachment === null || Array.isArray(attachment)) return null;
    const { attachmentId, mediaType, bytes, width, height, name, originalDimensions } = attachment;
    if (typeof attachmentId !== "string" || attachmentId === "") return null;
    if (typeof mediaType !== "string" || !isImageMediaType(mediaType)) return null;
    if (!positiveInteger(bytes) || !positiveInteger(width) || !positiveInteger(height)) return null;
    if (name !== void 0 && typeof name !== "string") return null;
    let inputDimensions: { width: number; height: number } | undefined;
    if (originalDimensions !== void 0) {
      if (typeof originalDimensions !== "object" || originalDimensions === null || Array.isArray(originalDimensions)) return null;
      const { width: inputWidth, height: inputHeight } = originalDimensions;
      if (!positiveInteger(inputWidth) || !positiveInteger(inputHeight)) return null;
      inputDimensions = {
        width: inputWidth,
        height: inputHeight
      };
    }
    refs.push({
      attachmentId,
      mediaType,
      bytes,
      width,
      height,
      ...name === void 0 ? {} : { name },
      ...inputDimensions === void 0 ? {} : { originalDimensions: inputDimensions }
    });
  }
  return refs.length > 0 ? refs : null;
}

/**
 * Join the text blocks other than the image envelope, in order. A post-execute
 * hook that appends further text blocks keeps them visible under the gallery
 * instead of being dropped.
 * @param content - the settled result's text blocks.
 * @returns the joined text, or null when there is none.
 */
export function extraTexts(content: Wire): string | null {
  const parts: string[] = content.flatMap((part: Wire) => part.type === "text" && typeof part.text === "string" && !IMAGE_ENVELOPE.test(part.text) ? [part.text] : []);
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * Whether the content carries only blocks the card consumes.
 *
 * `ContentBlock` is a merge-extensible union, so a post-execute hook could
 * append a block of a type this card does not render (reasoning, an extension
 * type, or a non-object). Rendering the card anyway would silently hide that
 * block, so anything beyond a well-formed text or image object declines to the
 * generic card, which shows the flattened content.
 * @param content - the settled result's content blocks.
 * @returns true when every block is a text or image object with usable fields.
 */
export function fullyRendered(content: Wire): boolean {
  return content.every((part: Wire) => {
    if (typeof part !== "object" || part === null) return false;
    const { type, text } = part;
    return type === "image" || type === "text" && typeof text === "string";
  });
}

/**
 * Derive a settled image card after validating the call head, persisted
 * metadata (or its argument fallback), and the model-facing image envelope.
 *
 * The card is result-side only: a call carries no content until `execute`
 * returns, so a running `read_image` has none and this returns null for it.
 * Both root and nested calls settle as ToolResultNode. Historical nested
 * records without presentation metadata fall back to the call's own
 * `file_path` argument for the path.
 * @param block - running or settled Tool block.
 * @returns the image-card props, or null for the generic path.
 */
export function imageCardModel(block: Wire): ImageCardModel | null {
  if (!("kind" in block) || block.isError) return null;
  const call = parsedToolCall(block);
  if (call?.name !== "read_image") return null;
  const { file_path: filePath } = call.args;
  if (typeof filePath !== "string" || filePath.trim() === "") return null;
  const path = imageMeta(block.meta)?.path ?? (block.parentCallId !== void 0 ? filePath : null);
  if (path === null) return null;
  if (!fullyRendered(block.content)) return null;
  const refs = imageReferences(block.content);
  if (refs === null) return null;
  if (!block.content.some((part: Wire) => part.type === "text" && typeof part.text === "string" && IMAGE_ENVELOPE.test(part.text))) return null;
  return {
    path,
    images: refs.map((ref) => ({ attachment: ref })),
    extraText: extraTexts(block.content)
  };
}
