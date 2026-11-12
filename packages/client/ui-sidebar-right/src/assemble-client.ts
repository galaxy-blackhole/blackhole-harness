/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc KHUNG de-bundle cho nua client (task-174): ghép vỏ head/tail + các lát nguyên văn + đổi id stock → id ta.
 *      CHƯA có lát nào (`parts: []`) ⇒ bản ghép hiện chỉ là cái vỏ; cổng byte vì vậy ĐỎ CÓ CHỦ ĐÍCH.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "./ids.ts";

/** Vỏ bundle classic: head, tail và danh sách lát theo thứ tự ghép. */
export interface ClientWrapper {
  /** Các dòng mở đầu (tới hết dòng `factory: (require) => {`). */
  readonly head: readonly string[];
  /** Các dòng kết thúc (`}`, `});`, sourceMappingURL). */
  readonly tail: readonly string[];
  /** Tên các lát trong `src/client-parts/browser/`, theo ĐÚNG thứ tự xuất hiện trong bundle gốc. */
  readonly parts: readonly string[];
}

/** Thư mục chứa lát của nửa browser. */
const PARTS_DIR = join(import.meta.dir, "client-parts", "browser");

/**
 * Đọc vỏ bundle của gói.
 * @returns vỏ đã parse từ `client-wrapper.browser.json`.
 */
export function readWrapper(): ClientWrapper {
  return JSON.parse(readFileSync(join(import.meta.dir, "client-wrapper.browser.json"), "utf8")) as ClientWrapper;
}

/**
 * Ghép nửa client từ vỏ + các lát, rồi đổi id stock → id ta.
 * Nhận: partsDir — thư mục lát (mặc định cạnh gói); partFiles — danh sách lát (mặc định theo vỏ).
 * Trả: văn bản bundle đã ghép (đã đổi id).
 */
export function assembleClientBundle(partsDir: string = PARTS_DIR, partFiles: readonly string[] = readWrapper().parts): string {
  const wrapper = readWrapper();
  const than = partFiles.map((ten) => readFileSync(join(partsDir, ten), "utf8"));
  const ghep = [...wrapper.head, ...than, ...wrapper.tail].join("\n");
  return ghep.split(STOCK_PACKAGE_NAME).join(PACKAGE_NAME);
}

/**
 * Đếm số chỗ id stock đã được đổi thành id ta trong một văn bản (cổng ownership dạng đếm).
 * Nhận: text — văn bản đã ghép. Trả: số lần id ta xuất hiện.
 */
export function countOurId(text: string): number {
  return text.split(PACKAGE_NAME).length - 1;
}

/**
 * Chuẩn hoá id ta về id stock để so byte với bản gốc.
 * Nhận: text — văn bản bundle của ta. Trả: văn bản tương đương bản gốc về mặt id.
 */
export function normalizeId(text: string): string {
  return text.split(PACKAGE_NAME).join(STOCK_PACKAGE_NAME);
}
