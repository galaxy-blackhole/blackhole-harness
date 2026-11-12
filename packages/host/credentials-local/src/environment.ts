/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ảnh chụp môi trường lúc khởi động, TỰ VIẾT (thay peer `dsh-launch-environment` — gói ngoài
 *      bảng §3b của recipe): row credentials cần biết lớp nào cấp giá trị cho một tên biến
 */

/** Thứ tự tin cậy của các lớp, tin cậy nhất đứng trước. */
export const SOURCE_ORDER = ["process", "project-env", "user-env"] as const;

/** Một lớp nguồn của môi trường lúc khởi động. */
export type LaunchEnvironmentSource = (typeof SOURCE_ORDER)[number];

/** Một biến đã giải được và lớp đã cấp nó. */
export interface LaunchEnvironmentEntry {
  /** Giá trị đúng như lớp đã cấp; có thể rỗng, và mỗi nơi dùng tự phán xét. */
  value: string;
  /** Lớp đã cấp giá trị. */
  source: LaunchEnvironmentSource | string;
  /** Đường dẫn tuyệt đối của tệp đã cấp giá trị; vắng mặt với lớp `process`. */
  path?: string;
}

/**
 * Ảnh chụp môi trường lúc khởi động — chỉ phần row này chạm tới.
 * Định nghĩa theo hình dạng THẬT của launcher để không phải import gói ngoài bảng §3b:
 * tra một tên trong đúng các lớp được nêu, theo thứ tự tin cậy.
 */
export interface LaunchEnvironmentSnapshot {
  /** Tra một tên trong mọi lớp. */
  get(name: string): LaunchEnvironmentEntry | undefined;
  /** Tra một tên chỉ trong các lớp đã nêu, giữ nguyên thứ tự tin cậy. */
  getFrom(name: string, sources: readonly string[]): LaunchEnvironmentEntry | undefined;
}

/**
 * Khoá tra của một tên biến: Windows coi tên biến môi trường không phân biệt hoa thường.
 * Nhận: tên biến như đã viết.
 * Trả: khoá dùng để lưu và tra.
 */
function lookupKey(name: string): string {
  return process.platform === "win32" ? name.toUpperCase() : name;
}

/**
 * Dựng ảnh chụp từ nội dung từng lớp; lớp nào không có thì không tra tới.
 * Nhận: danh sách lớp kèm giá trị thô.
 * Trả: ảnh chụp bất biến dùng để tra theo thứ tự tin cậy.
 */
export function createLaunchEnvironmentSnapshot(
  layers: readonly { source: string; path?: string; values: Record<string, string | undefined> }[],
): LaunchEnvironmentSnapshot {
  const bySource = new Map<string, { path?: string; values: Map<string, string> }>();
  for (const layer of layers) {
    bySource.set(layer.source, {
      ...(layer.path === undefined ? {} : { path: layer.path }),
      values: new Map(Object.entries(layer.values).map(([name, value]) => [lookupKey(name), value ?? ""])),
    });
  }
  const getFrom = (name: string, sources: readonly string[]): LaunchEnvironmentEntry | undefined => {
    const key = lookupKey(name);
    for (const source of SOURCE_ORDER) {
      if (!sources.includes(source)) continue;
      const layer = bySource.get(source);
      const value = layer?.values.get(key);
      if (value === undefined) continue;
      return { value, source, ...(layer?.path === undefined ? {} : { path: layer.path }) };
    }
    return undefined;
  };
  return { get: (name: string) => getFrom(name, SOURCE_ORDER), getFrom };
}

/**
 * Lấy ảnh chụp môi trường của launcher (khoá `launchEnvironment` trên Context), hoặc môi
 * trường kế thừa làm lớp DUY NHẤT khi host không cấp ảnh chụp.
 * Nhận: context của plugin.
 * Trả: ảnh chụp để tra các giá trị hướng người dùng.
 */
export function launchEnvironmentOf(ctx: unknown): LaunchEnvironmentSnapshot {
  const get = (ctx as { get?: (name: string) => unknown }).get;
  const snapshot = typeof get === "function" ? (get.call(ctx, "launchEnvironment") as LaunchEnvironmentSnapshot | undefined) : undefined;
  if (snapshot !== undefined && snapshot !== null && typeof snapshot.getFrom === "function") return snapshot;
  // Không có ảnh chụp: môi trường kế thừa là lớp duy nhất, đúng như launcher làm khi thiếu .env.
  return createLaunchEnvironmentSnapshot([{ source: "process", values: process.env }]);
}
