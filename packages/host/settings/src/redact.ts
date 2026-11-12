/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Che secret theo CẤU TRÚC cho giá trị của settings: mọi trường role secret bị bỏ khỏi giá trị
 *      trước khi qua biên giới wire, kèm sổ vị trí secret để biểu mẫu vẽ ô write-only.
 */
import type { RedactedSecret, RedactedValue, SchemaLike } from "./types.ts";

/**
 * Kiểm một giá trị có phải vật dữ liệu phẳng mà bộ duyệt được phép đi xuống.
 * Nhận: giá trị bất kỳ.
 * Trả: true khi là object thường (không phải mảng, không phải null).
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Duyệt một nút schema để bỏ các trường secret khỏi giá trị.
 * Nhận: nút schema (hoặc undefined), giá trị hiện tại, đường dẫn đã đi, sổ secret cần ghi.
 * Trả: giá trị đã bỏ secret; undefined nghĩa là trường này bị bỏ khỏi cha.
 */
function walk(node: SchemaLike | undefined, value: unknown, path: string[], secrets: RedactedSecret[]): unknown {
  if (node === undefined) return value;
  if (node.meta?.role === "secret") {
    secrets.push({ path, set: value !== undefined });
    return undefined;
  }
  switch (node.type) {
    case "object": {
      const properties = node.dict ?? {};
      const source = isRecord(value) ? value : undefined;
      const rebuilt: Record<string, unknown> = {};
      if (source !== undefined) {
        for (const [key, entry] of Object.entries(source)) {
          if (key in properties) continue;
          rebuilt[key] = entry;
        }
      }
      for (const [key, child] of Object.entries(properties)) {
        const stripped = walk(child, source?.[key], [...path, key], secrets);
        if (stripped !== undefined) rebuilt[key] = stripped;
      }
      return source === undefined && Object.keys(rebuilt).length === 0 ? value : rebuilt;
    }
    case "dict": {
      if (!isRecord(value)) return value;
      const rebuilt: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        const stripped = walk(node.inner, entry, [...path, key], secrets);
        if (stripped !== undefined) rebuilt[key] = stripped;
      }
      return rebuilt;
    }
    case "array":
      if (!Array.isArray(value)) return value;
      return value.map((entry, index) => walk(node.inner, entry, [...path, String(index)], secrets));
    case "union":
    case "intersect":
      return (node.list ?? []).reduce<unknown>((current, child) => walk(child, current, path, secrets), value);
    case "transform":
      return walk(node.inner, value, path, secrets);
    default:
      return value;
  }
}

/**
 * Bỏ mọi trường role secret mà schema khai khỏi một giá trị; đầu vào KHÔNG bị sửa.
 * Nhận: schema schemastery đang sống mô tả giá trị + giá trị cần bỏ secret.
 * Trả: bản sao tách rời đã bỏ secret và sổ vị trí secret theo thứ tự duyệt (khử trùng theo đường dẫn).
 */
export function redactSecrets(schema: SchemaLike, value: unknown): RedactedValue {
  const secrets: RedactedSecret[] = [];
  const stripped = walk(schema, value, [], secrets);
  const positions = new Map<string, RedactedSecret>();
  for (const secret of secrets) {
    const key = JSON.stringify(secret.path);
    const previous = positions.get(key);
    positions.set(key, {
      ...secret,
      set: secret.set || previous?.set === true,
    });
  }
  return {
    value: stripped,
    secrets: [...positions.values()],
  };
}
