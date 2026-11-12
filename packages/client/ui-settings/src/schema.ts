/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Service settingsSchema: doc/ghi duong dan trong cay gia tri + rehydrate/validate schema cua Host
 */

/**
 * Ham tao container rong theo khoa ke tiep (mang neu khoa la so, doi tuong neu khong).
 * @param nextKey - khoa se duoc ghi vao container.
 * @returns container rong dung kieu.
 */
function emptyContainer(nextKey: string): unknown {
  return /^[0-9]+$/.test(nextKey) ? [] : {};
}

/**
 * Sao chep mot container, giu nguyen kieu mang/doi tuong cua ban goc.
 * @param current - gia tri hien tai (co the undefined).
 * @param nextKey - khoa se duoc ghi vao container nay.
 * @returns ban sao container (rong neu gia tri hien tai khong phai doi tuong).
 */
function cloneContainer(current: unknown, nextKey: string): Record<string, unknown> | unknown[] {
  if (Array.isArray(current)) return [...current];
  if (typeof current === "object" && current !== null) return { ...(current as Record<string, unknown>) };
  return emptyContainer(nextKey) as Record<string, unknown> | unknown[];
}

/**
 * Sao chep cay theo mot duong dan, tao cac container con thieu.
 * @param root - gia tri goc.
 * @param path - duong dan khoa (doi tuong) hoac chi so (mang), khong rong.
 * @returns ban sao root, container cha cua la, va khoa la.
 */
function cloneSpine(root: unknown, path: readonly string[]): {
  result: Record<string, unknown> | unknown[];
  parent: Record<string, unknown> | unknown[];
  leaf: string;
} {
  const result = { ...(root as Record<string, unknown>) } as Record<string, unknown> | unknown[];
  let target = result;
  for (let index = 0; index < path.length - 1; index++) {
    const key = path[index] as string;
    const nextKey = path[index + 1] as string;
    const current = Array.isArray(target) ? target[Number(key)] : (target as Record<string, unknown>)[key];
    const child = cloneContainer(current, nextKey);
    if (Array.isArray(target)) target[Number(key)] = child;
    else (target as Record<string, unknown>)[key] = child;
    target = child;
  }
  return { result, parent: target, leaf: path[path.length - 1] as string };
}

/** Node schema da rehydrate (goi duoc nhu ham de validate). */
export interface SchemaNode {
  /** Loai node: object, dict, array... (do Host gui xuong). */
  readonly type?: string;
  /** Ban do node con khi type = object. */
  readonly dict?: Record<string, SchemaNode>;
  /** Node con khi type = dict hoac array. */
  readonly inner?: SchemaNode;
}

/** Schema da rehydrate: goi duoc de validate, nem loi khi gia tri sai. */
export type LiveSchema = ((value: unknown) => unknown) & SchemaNode;

/** Ham rehydrate cua schemastery (nhan envelope da serialize). */
export type Rehydrate = (serialized: unknown) => LiveSchema;

/**
 * Service settingsSchema: moi thao tac schema/gia tri ma cac plugin client khac can.
 *
 * Ban goc cung cap service nay de plugin khac KHONG phai import ham giua nhau
 * (cong purity cua bundle client cam import gia tri cheo plugin).
 */
export class SettingsSchemaService {
  /**
   * @param ctx - context cua plugin cung cap (giu tham chieu, dung khi can dang ky them).
   */
  constructor(private readonly ctx: unknown) {
    void ctx;
  }

  /**
   * Rehydrate mot envelope schema.toJSON() do Host gui xuong.
   * @param serialized - node schemastery da serialize.
   * @param rehydrate - ham rehydrate cua schemastery (bundle cua ta nhung san).
   * @returns node schema song.
   */
  rehydrate(serialized: unknown, rehydrate: Rehydrate): LiveSchema {
    return rehydrate(serialized);
  }

  /**
   * Validate mot ban nhap theo schema.
   * @param schema - node schema song.
   * @param draft - gia tri can kiem.
   * @returns chuoi loi, hoac undefined khi hop le.
   */
  validate(schema: LiveSchema, draft: unknown): string | undefined {
    try {
      schema(draft);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Giai mot node schema (object/dict/array) theo duong dan.
   * @param root - node goc.
   * @param path - khoa doi tuong hoac chi so mang.
   * @returns node tim duoc, hoac undefined khi khong co.
   */
  nodeAtPath(root: SchemaNode | undefined, path: readonly string[]): SchemaNode | undefined {
    let node: SchemaNode | undefined = root;
    for (const key of path) {
      if (node === undefined) return undefined;
      if (node.type === "object") node = node.dict?.[key];
      else if (node.type === "dict" || node.type === "array") node = node.inner;
      else return undefined;
    }
    return node;
  }

  /**
   * Doc gia tri long nhau theo duong dan.
   * @param value - gia tri goc.
   * @param path - khoa doi tuong hoac chi so mang.
   * @returns gia tri tim duoc, hoac undefined khi khong co.
   */
  getPath(value: unknown, path: readonly string[]): unknown {
    let current: unknown = value;
    for (const key of path) {
      if (Array.isArray(current)) {
        current = current[Number(key)];
        continue;
      }
      if (typeof current !== "object" || current === null) return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  /**
   * Kiem tra khoa cuoi cua duong dan co ton tai khong (khac voi gia tri undefined).
   * @param value - gia tri goc.
   * @param path - duong dan.
   * @returns true khi duong dan ton tai.
   */
  hasPath(value: unknown, path: readonly string[]): boolean {
    if (path.length === 0) return value !== undefined;
    const parent = this.getPath(value, path.slice(0, -1));
    const key = path[path.length - 1] as string;
    if (Array.isArray(parent)) return Number(key) < parent.length;
    if (typeof parent !== "object" || parent === null) return false;
    return key in (parent as Record<string, unknown>);
  }

  /**
   * Ghi bat bien mot gia tri long nhau, tu tao container con thieu.
   * @param root - doi tuong goc (khong bi sua).
   * @param path - duong dan khong rong.
   * @param value - gia tri thay the.
   * @returns ban sao root da chua gia tri moi.
   */
  setPath(root: unknown, path: readonly string[], value: unknown): unknown {
    if (path.length === 0) throw new Error("ui-settings: setPath needs a non-empty path");
    const { result, parent, leaf } = cloneSpine(root, path);
    if (Array.isArray(parent)) parent[Number(leaf)] = value;
    else parent[leaf] = value;
    return result;
  }

  /**
   * Xoa bat bien mot khoa long nhau.
   * @param root - doi tuong goc (khong bi sua).
   * @param path - duong dan khong rong.
   * @returns ban sao root khong con khoa, hoac chinh root khi duong dan khong ton tai.
   */
  deletePath(root: unknown, path: readonly string[]): unknown {
    if (path.length === 0) throw new Error("ui-settings: deletePath needs a non-empty path");
    if (!this.hasPath(root, path)) return root;
    const { result, parent, leaf } = cloneSpine(root, path);
    if (Array.isArray(parent)) parent.splice(Number(leaf), 1);
    else Reflect.deleteProperty(parent, leaf);
    return result;
  }
}
