/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kết xuất tài liệu credentials: nâng cấp bố cục phẳng thời tiền phát hành, và các phép
 *      sửa MỘT mục giữ nguyên chú thích cùng định dạng của mọi mục không bị chạm tới
 */

import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { Document, isMap, isScalar, parseDocument } from "yaml";
import { DOCUMENT_VERSION } from "./document.ts";

/**
 * Kết xuất bố cục version-1 cho một tài liệu PHẲNG thời tiền phát hành, hoặc `undefined` cho
 * mọi thứ khác. Bố cục phẳng được nhận diện CHÍNH XÁC — một ánh xạ cấp 1 khác rỗng, khoá là
 * tên tham chiếu hợp lệ, giá trị là scalar chuỗi khác rỗng, không có khoá `version` và không có
 * chỉ thị tài liệu — và bản viết lại lồng NGUYÊN VĂN các dòng gốc xuống dưới `refs:` với thụt
 * lề hai dấu cách, nên chú thích, dòng trống và cách viết của từng giá trị sống sót từng byte.
 * Bất cứ thứ gì bộ nhận diện từ chối vẫn giữ nguyên sự TỪ CHỐI ồn ào của
 * `parseCredentialsDocument`: một tài liệu mà bản build này không chứng minh được là nó hiểu
 * thì không bao giờ bị viết lại. Gỡ bỏ cùng với lập trường tiền phát hành ở lần phát hành đầu tiên.
 * Nhận: văn bản của tài liệu.
 * Trả: văn bản đã nâng cấp, hoặc undefined khi văn bản không phải bố cục phẳng đã nhận diện.
 */
export function renderFlatLayoutMigration(text: string): string | undefined {
  const document = parseDocument(text, { prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) return undefined;
  const flat = document.contents;
  if (!isMap(flat) || flat.items.length === 0) return undefined;
  for (const line of text.split("\n")) if (/^(%|---|\.\.\.)/.test(line)) return undefined;
  for (const pair of flat.items) {
    if (!isScalar(pair.key) || typeof pair.key.value !== "string" || pair.key.value === "version") return undefined;
    try {
      credentialRef(pair.key.value);
    } catch {
      return undefined;
    }
    if (!isScalar(pair.value) || typeof pair.value.value !== "string" || pair.value.value.length === 0) return undefined;
  }
  const body = text
    .split("\n")
    .map((line) => (line.length === 0 ? line : `  ${line}`))
    .join("\n");
  return `version: ${String(DOCUMENT_VERSION)}\nrefs:\n${body}${text.endsWith("\n") ? "" : "\n"}`;
}

/**
 * Cây có thể sửa, giữ nguyên chú thích, mà một phép sửa kết xuất từ đó. Sửa chính tài liệu đã
 * phân tích thay vì dựng lại nó giữ được chú thích và định dạng của mọi mục không bị chạm tới;
 * tài liệu vắng mặt thì bắt đầu một cây mới.
 * Nhận: văn bản hiện tại của tài liệu, `undefined` khi tệp vắng mặt.
 * Trả: cây để sửa, đã mang dấu phiên bản của bản build này.
 */
function mutableDocument(text: string | undefined): Document {
  const document: Document = text === undefined ? new Document({}) : parseDocument(text, { intAsBigInt: true });
  document.setIn(["version"], DOCUMENT_VERSION);
  return document;
}

/**
 * Kết xuất văn bản kế tiếp của tài liệu với MỘT tham chiếu được đặt hoặc xoá.
 * Nhận: văn bản hiện tại (hoặc undefined khi tệp vắng mặt), tên tham chiếu và giá trị mới
 * (undefined nghĩa là xoá khoá).
 * Trả: văn bản cần ghi xuống.
 */
export function renderRef(text: string | undefined, ref: string, value: string | undefined): string {
  const document = mutableDocument(text);
  if (value === undefined) deleteSectionEntry(document, "refs", ref);
  else document.setIn(["refs", ref], value);
  return document.toString();
}

/**
 * Kết xuất văn bản kế tiếp của tài liệu với MỘT bản ghi được ghi hoặc xoá. Nút của bản ghi được
 * THAY TRỌN thay vì sửa từng trường: bản ghi do máy ghi, nên không có định dạng tay nào bên
 * trong nó cần giữ.
 * Nhận: văn bản hiện tại (hoặc undefined khi tệp vắng mặt), khoá bản ghi và bản ghi mới
 * (undefined nghĩa là xoá nó).
 * Trả: văn bản cần ghi xuống.
 */
export function renderRecord(text: string | undefined, key: string, record: unknown): string {
  const document = mutableDocument(text);
  if (record === undefined) deleteSectionEntry(document, "records", key);
  else document.setIn(["records", key], record);
  return document.toString();
}

/**
 * Gỡ MỘT mục khỏi một mục của tài liệu, mang theo cả chú thích của nó. Một khối chú thích viết
 * trên mục đầu tiên của một phần chú giải cho chính mục đó, nhưng bộ phân tích gắn nó vào ánh
 * xạ của phần chứ không vào cặp khoá-giá trị — để lại thì chú thích sẽ chuyển sang mục nào trở
 * thành đầu tiên, đọc lên như chú giải cho một credential mà không ai viết cho nó.
 * Nhận: cây đang sửa, tên phần chứa mục và khoá của mục cần gỡ.
 * Trả: không.
 */
function deleteSectionEntry(document: Document, section: string, key: string): void {
  const map = document.get(section, true);
  if (isMap(map)) {
    const first = map.items[0];
    if (first !== undefined && isScalar(first.key) && first.key.value === key) map.commentBefore = null;
  }
  document.deleteIn([section, key]);
}
