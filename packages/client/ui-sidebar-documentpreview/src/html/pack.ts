/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Gom phu thuoc tinh cua tai lieu HTML ma khong chay hay gan phan tu vao trang cha
 */

import { decodeText } from "./bytes.ts";
import type { HtmlAsset, HtmlBundle } from "./bootstrap.ts";

/** Tran byte cua mot phu thuoc tinh — nguyen van ban goc. */
export const MAX_ASSET_BYTES = 4 * 1024 * 1024;
/** Tran byte cua ca goi — nguyen van ban goc. */
export const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
/** Tran so phu thuoc tinh — nguyen van ban goc. */
export const MAX_ASSETS = 64;

/** Mot ket qua doc tuong doi da settled. */
export type RelativeReadResult = { ok: true; value: { data: Uint8Array; absolutePath: string } } | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

/** Ham doc mot phu thuoc tuong doi cua tai lieu goc. */
export type ReadRelative = (reference: string, signal: AbortSignal) => Promise<{ data: Uint8Array; absolutePath: string }>;

/**
 * Tham chieu nay co doc duoc tuong doi voi tai lieu goc, chu khong phai URL cua ung dung cha, khong.
 * Nhan: reference — tham chieu nguyen van.
 * Tra: true khi la duong dan tuong doi dung duoc.
 */
export function relative(reference: string): boolean {
  return reference.length > 0 && !/^(?:[a-z][a-z\d+.-]*:|[/\\#?])/iu.test(reference) && !reference.includes("\0");
}

/**
 * Gom phu thuoc tinh ma khong chay hay gan phan tu vao trang cha.
 * Nhan: data — byte UTF-8 HTML day du; readRelative — phep doc theo tai lieu goc; signal — dung doc va chan cong bo sau khi huy.
 * Tra: HTML day du va tap phu thuoc tinh huu han cua no; giai ma, gioi han va loi doc deu nem.
 */
export async function packHtml(data: Uint8Array, readRelative: ReadRelative, signal: AbortSignal): Promise<HtmlBundle> {
  signal.throwIfAborted();
  let total = data.byteLength;
  if (total > MAX_TOTAL_BYTES) throw new Error("HTML package exceeds its total byte limit");
  const template = document.createElement("template");
  template.innerHTML = decodeText(data);
  const assets: HtmlAsset[] = [];
  if (template.content.querySelector("base[href]") !== null) return { data, assets };
  const seen = new Set<string>();
  for (const element of template.content.querySelectorAll("script[src],link[href]")) {
    const script = element.localName === "script";
    const type = element.getAttribute("type")?.trim().toLowerCase() ?? "";
    if (script && !["", "text/javascript", "application/javascript"].includes(type)) continue;
    if (!script && !(element.getAttribute("rel") ?? "").toLowerCase().split(/\s+/u).includes("stylesheet")) continue;
    const reference = element.getAttribute(script ? "src" : "href") ?? "";
    const suffix = reference.search(/[?#]/u);
    const path = suffix === -1 ? reference : reference.slice(0, suffix);
    if (!relative(reference) || !(script ? /\.js$/iu : /\.css$/iu).test(path)) continue;
    const kind = script ? "script" : "stylesheet";
    const key = kind + ":" + reference;
    if (seen.has(key)) continue;
    if (assets.length >= MAX_ASSETS) throw new Error("HTML package exceeds its asset count limit");
    signal.throwIfAborted();
    const asset = await readRelative(reference, signal);
    signal.throwIfAborted();
    const size = asset.data.byteLength;
    if (size > MAX_ASSET_BYTES) throw new Error("HTML asset exceeds its byte limit");
    total += size;
    if (total > MAX_TOTAL_BYTES) throw new Error("HTML package exceeds its total byte limit");
    decodeText(asset.data);
    assets.push({ kind, reference, data: asset.data });
    seen.add(key);
  }
  return { data, assets };
}
