/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bind bo doc cua goi vao dia chi cua tep HTML goc
 */

import { hostFileOf } from "../rpc.ts";
import { sessionFileAddress } from "../workspace-path.ts";
import type { RelativeReadResult } from "./pack.ts";

/**
 * Bind bo doc phu thuoc vao dia chi cua tep HTML goc.
 * Nhan: readRelated — bo doc workspace dung Phien trong dia chi HTML goc; address — dia chi tep HTML goc;
 *        lifetime — vong doi tab; addResource — theo doi duong dan phu thuoc ma Host bao.
 * Tra: bo doc bo query/fragment cua URL, giai ma mot duong dan va giu nguyen loi cua Host.
 */
export function createReadHtmlRelative(
  readRelated: (address: string, path: string, signal: AbortSignal) => Promise<RelativeReadResult>,
  address: string,
  lifetime: AbortSignal,
  addResource: (address: string) => void,
): (reference: string, signal: AbortSignal) => Promise<{ data: Uint8Array; absolutePath: string }> {
  return async (reference, signal) => {
    const suffix = reference.search(/[?#]/u);
    const path = decodeURIComponent(suffix === -1 ? reference : reference.slice(0, suffix));
    if (path.length === 0 || /^(?:[a-z][a-z\d+.-]*:|[/\\])/iu.test(path) || path.includes("\0") || path.includes("\\")) throw new Error("HTML dependency must use a relative file path");
    const combined = AbortSignal.any([lifetime, signal]);
    combined.throwIfAborted();
    const file = hostFileOf(address);
    const result = await readRelated(address, path, combined);
    combined.throwIfAborted();
    if (!result.ok) {
      const detailPath = result.error.details?.path;
      if (typeof detailPath === "string") addResource(sessionFileAddress(file.sessionId, detailPath));
      throw new Error(result.error.message);
    }
    addResource(sessionFileAddress(file.sessionId, result.value.absolutePath));
    return result.value;
  };
}
