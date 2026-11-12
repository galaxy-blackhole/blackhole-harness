/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phien va duong dan ma mot dia chi gbh-resource://file/... goi ten
 */

import { parseFileAddress } from "./workspace-path.ts";

/** Phien va duong dan ma mot dia chi tep goi ten. */
export interface HostFile {
  /** Phien ma Host giai duong dan. */
  sessionId: string;
  /** Duong dan tep. */
  path: string;
}

/**
 * Doc phien va duong dan tu mot dia chi gbh-resource://file/....
 * Nhan: address — dia chi cua tab.
 * Tra: phien va duong dan de giao cho endpoint.
 */
export function hostFileOf(address: string): HostFile {
  const parsed = parseFileAddress(address);
  if (parsed?.scope !== "session" || parsed.sessionId === undefined) throw new Error('ui-sidebar-documentpreview: not a session file address "' + address + '"');
  return { sessionId: parsed.sessionId, path: parsed.path };
}
