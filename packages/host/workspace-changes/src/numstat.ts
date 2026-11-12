/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bộ phân tích đầu ra `git diff-tree --numstat -z`: số dòng thêm/xoá theo từng tệp, nhận diện
 *      tệp nhị phân ("-") và bản ghi đổi tên (đường dẫn rỗng + tên cũ + tên mới).
 */

/** Một bản ghi `--numstat`; đường dẫn dạng slash và tương đối so với gốc repo. */
export interface NumstatEntry {
  /** Đường dẫn sau thay đổi (tên mới khi đây là bản ghi đổi tên). */
  path: string;
  /** Đường dẫn trước khi đổi tên; vắng mặt khi tệp giữ nguyên đường dẫn. */
  oldPath?: string;
  /** Số dòng thêm; 0 khi tệp nhị phân. */
  added: number;
  /** Số dòng xoá; 0 khi tệp nhị phân. */
  deleted: number;
  /** true khi git báo tệp nhị phân (cột thêm là "-"). */
  binary: boolean;
}

/**
 * Phân tích các bản ghi numstat kết thúc bằng NUL. Một bản ghi đổi tên mang đường dẫn rỗng,
 * ngay sau đó là đường dẫn cũ và đường dẫn mới.
 * Nhận: output — toàn bộ stdout của `git diff-tree -r -M -z --numstat`.
 * Trả: các bản ghi theo đúng thứ tự git in ra.
 * @throws khi một bản ghi sai hình dạng, tức đầu ra đã bị cắt cụt.
 */
export function parseNumstat(output: string): NumstatEntry[] {
  const queue: string[] = output.split("\0");
  if (queue.at(-1) !== "") throw new Error("numstat output is not NUL-terminated");
  queue.pop();
  const entries: NumstatEntry[] = [];
  while (queue.length > 0) {
    // Điều kiện vòng lặp bảo đảm queue còn phần tử, nên shift() luôn có giá trị.
    const record = queue.shift() as string;
    // Chỉ hai dấu tab đầu tiên phân tách trường; tên tệp giữ nguyên tab của chính nó.
    const first = record.indexOf("\t");
    const second = first < 0 ? -1 : record.indexOf("\t", first + 1);
    if (second < 0) throw new Error(`malformed numstat record: ${record}`);
    const added = record.slice(0, first);
    const deleted = record.slice(first + 1, second);
    const path = record.slice(second + 1);
    let target = path;
    let oldPath: string | undefined;
    if (target === "") {
      oldPath = queue.shift();
      const renamed = queue.shift();
      if (oldPath === undefined || renamed === undefined) throw new Error("malformed numstat rename record");
      target = renamed;
    }
    const binary = added === "-";
    entries.push({
      path: target,
      ...(oldPath === undefined ? {} : { oldPath }),
      added: binary ? 0 : Number(added),
      deleted: binary ? 0 : Number(deleted),
      binary,
    });
  }
  return entries;
}
