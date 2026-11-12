/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Sửa tệp patch của profile để bật/tắt MỘT plugin mà GIỮ NGUYÊN bình luận: làm phẳng cây row mà
 *      bộ soạn patch của profile địa chỉ được (nhóm đứng trước con của nó), rồi thay override khớp CUỐI
 *      hoặc thêm một override sau các insertion đang có; override chỉ còn `id` + `disabled`, không
 *      anchor, bị XOÁ (hoặc không được thêm) khi các lớp bundle và phần patch còn lại đã cho entry đúng
 *      giá trị `disabled` literal mong muốn — home patches và launch overlays KHÔNG được xét.
 */

import { readFile } from "node:fs/promises";
import { isMap, isNode, isScalar, isSeq, parseDocument } from "yaml";
import { composeEntries, loadOptionalPatches, readBundlePatches } from "@deepseek-ai/dsh-app-boot";
import type { ProfileContext } from "@deepseek-ai/dsh-app-boot";
import { writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import type { EntryOptions } from "@deepseek-ai/cordis-plugin-loader";

/**
 * Làm phẳng CHỈ những nhóm mà bộ soạn patch của profile địa chỉ được.
 * Nhận: `rows` — các entry cấp cao nhất đã soạn (nhóm có thể lồng nhau trong `config`).
 * Trả: các entry theo thứ tự duyệt sâu, mỗi nhóm đứng ngay trước các con của nó.
 */
export function flatten(rows: EntryOptions[]): EntryOptions[] {
  return rows.flatMap((row) => [row, ...(row.group && Array.isArray(row.config) ? flatten(row.config) : [])]);
}

/**
 * Thay override khớp CUỐI hoặc thêm một override sau các insertion đang có. Một override chỉ chứa
 * `id` và `disabled`, không anchor, sẽ bị xoá — hoặc không được thêm — khi các lớp bundle và các
 * patch profile còn lại đã cho entry đúng giá trị `disabled` literal mong muốn; home patches và
 * launch overlays không được xét.
 * Nhận: `profile` — profile có tệp patch bị sửa và các bundle được chọn cung cấp phép soạn để đối
 * chiếu; `id` — id duy nhất của entry trong phép soạn; `name` — tên module dùng để khớp override
 * có kèm `name`; `enabled` — trạng thái bật/tắt mong muốn của entry.
 * Trả: `true` khi tệp đã đổi, `false` khi không cần ghi (đã đúng sẵn hoặc bị lớp dưới đã quyết định).
 * @throws Lỗi đọc tệp patch khác `ENOENT`, lỗi phân tích YAML ĐẦU TIÊN của tài liệu, khi gốc patch
 *      không phải dãy YAML, hoặc lỗi của `writeFileAtomic` khi ghi tệp patch thất bại.
 */
export async function writePluginEnabled(
  profile: ProfileContext,
  id: string,
  name: string,
  enabled: boolean,
): Promise<boolean> {
  const filename = profile.patchPath;
  let text: string;
  try {
    text = await readFile(filename, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
    text = "[]\n";
  }
  const document = parseDocument(text, {
    customTags: [{ tag: "tag:yaml.org,2002:js", resolve: (value: string): unknown => value }],
  });
  const error = document.errors[0];
  if (error !== undefined) throw error;
  const contents = document.contents;
  if (!isSeq(contents)) throw new Error("Profile patch must be a YAML sequence");
  const patches = loadOptionalPatches("dsh", filename) ?? [];
  const bundlePatches = readBundlePatches("dsh", profile);
  const items = contents.items;
  const target = items.findLast((item, index) => {
    if (!isMap(item) || document.getIn([index, "id"]) !== id || item.has("insert")) return false;
    const expectedName = document.getIn([index, "name"]);
    return !expectedName || expectedName === name;
  });
  // So sánh đúng giá trị `disabled` literal của CHÍNH entry; giá trị `!!js` không bao giờ khớp, nên override của nó được GIỮ.
  const implied = (index: number): boolean => {
    const row = flatten(composeEntries([[...bundlePatches, ...patches.toSpliced(index, 1)]])).findLast(
      (entry) => entry.id === id,
    );
    return row !== undefined && (row.disabled ?? false) === !enabled;
  };
  if (isMap(target)) {
    const index = items.indexOf(target);
    // Một anchor bị xoá sẽ để lại các alias phía sau chưa phân giải.
    const onlySwitch =
      target.anchor === undefined &&
      target.items.every(
        (pair) =>
          isScalar(pair.key) &&
          isScalar(pair.value) &&
          pair.key.anchor === undefined &&
          pair.value.anchor === undefined &&
          (pair.key.value === "id" || pair.key.value === "disabled"),
      );
    if (onlySwitch && implied(index)) {
      document.deleteIn([index]);
      // Bình luận ngay trên override bị xoá có thể là header của tệp, nên nó chuyển sang item kế tiếp,
      // lên trên một dãy đã rỗng, hoặc xuống sau các item còn lại.
      const comment = target.commentBefore;
      const next = items[index];
      if (comment && isNode(next))
        next.commentBefore = next.commentBefore ? `${comment}\n${next.commentBefore}` : comment;
      else if (comment && items.length === 0) contents.commentBefore = comment;
      else if (comment) document.comment = document.comment ? `${comment}\n${document.comment}` : comment;
    } else if (document.getIn([index, "disabled"]) === !enabled) {
      return false;
    } else {
      document.setIn([index, "disabled"], !enabled);
    }
  } else {
    if (implied(items.length)) return false;
    document.add({ id, disabled: !enabled });
  }
  await writeFileAtomic(filename, String(document), { mode: 0o600 });
  return true;
}
