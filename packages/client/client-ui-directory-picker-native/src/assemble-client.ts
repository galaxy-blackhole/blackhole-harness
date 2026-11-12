/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép vỏ (client-wrapper.browser.json) + số lát thân theo gói (đọc từ client-wrapper.<side>.json) ⇒ đúng văn bản bundle client SAU KHI quy đổi id sang id của ta
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { stripPartScaffold } from "../../../host/typert-gateway/src/client-assemble.ts";

/** Vỏ + danh mục lát của nửa client browser. */
export interface ClientWrapper {
  /** Dòng vỏ đầu (đã mang id của ta). */
  readonly head: readonly string[];
  /** Dòng vỏ cuối. */
  readonly tail: readonly string[];
  /** Danh mục lát thân theo đúng thứ tự. */
  readonly parts: readonly string[];
}

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/**
 * Đọc vỏ + danh mục lát của nửa client browser CỦA GÓI NÀY (không đọc vỏ của gói khác).
 * Nhận: không. Trả: ClientWrapper.
 */
export function readWrapper(): ClientWrapper {
  return JSON.parse(readFileSync(join(import.meta.dir, "client-wrapper.browser.json"), "utf8")) as ClientWrapper;
}

/**
 * Ghép nửa client browser từ vỏ + các lát thân.
 * Nhận: partsDir — thư mục lát (mặc định src/client-parts/browser). Trả: văn bản bundle client.
 */
export function assembleClientBundle(partsDir?: string): string {
  const vo = readWrapper();
  const dir = partsDir ?? join(import.meta.dir, "client-parts", "browser");
  const than: string[] = [];
  for (const file of vo.parts) than.push(...stripPartScaffold(readFileSync(join(dir, file), "utf8"), file));
  return [...vo.head, ...than, ...vo.tail].join(EOL);
}