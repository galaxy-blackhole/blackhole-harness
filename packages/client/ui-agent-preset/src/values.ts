/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc WeakMapWithValues — nguyen van ban goc: tra cuu theo khoa yeu (WeakMap) nhung van duyet duoc gia tri
 */

/**
 * Tra cuu theo khoa yeu (WeakMap) nhung van giu mot tap gia tri manh de duyet.
 *
 * Moi gia tri chi thuoc mot khoa. Vat chua khong tu don: chu so huu xoa rang buoc hoac clear khi het vong doi.
 * Ban goc nam o @deepseek-ai/dsh-util-values; row nay giu nguyen hinh dang vi tap "seats" cua no
 * duyet qua thuoc tinh "values".
 */
export class WeakMapWithValues<K extends object, V> {
  /** Anh xa khoa yeu sang gia tri. */
  private keys = new WeakMap<K, V>();
  /** Tap giu manh moi gia tri, theo thu tu chen. */
  private readonly valueSet = new Set<V>();
  /** Gia tri dang duoc giu manh, theo thu tu chen — ban goc phoi chinh tap nay ra ngoai. */
  readonly values: Set<V> = this.valueSet;

  /**
   * Doc gia tri gan voi mot khoa.
   * Nhan: key — khoa duoc giu yeu.
   * Tra: gia tri da gan, hoac undefined.
   */
  get(key: K): V | undefined {
    return this.keys.get(key);
  }

  /**
   * Kiem mot khoa da co rang buoc chua.
   * Nhan: key — khoa duoc giu yeu.
   * Tra: true khi khoa da co.
   */
  has(key: K): boolean {
    return this.keys.has(key);
  }

  /**
   * Gan mot khoa voi mot gia tri rieng cua nguoi goi.
   * Nhan: key — khoa duoc giu yeu; value — gia tri duoc giu manh, chi thuoc mot khoa.
   * Tra: chinh vat chua nay.
   */
  set(key: K, value: V): this {
    if (this.keys.has(key)) {
      const previous = this.keys.get(key) as V;
      if (previous === value) return this;
      this.valueSet.delete(previous);
    }
    this.keys.set(key, value);
    this.valueSet.add(value);
    return this;
  }

  /**
   * Xoa mot rang buoc va gia tri duoc giu manh cua no.
   * Nhan: key — khoa duoc giu yeu.
   * Tra: true khi co rang buoc bi xoa.
   */
  delete(key: K): boolean {
    if (!this.keys.has(key)) return false;
    const value = this.keys.get(key) as V;
    const deleted = this.keys.delete(key);
    this.valueSet.delete(value);
    return deleted;
  }

  /**
   * Xoa moi rang buoc va moi gia tri duoc giu manh.
   * Nhan: khong co.
   * Tra: khong co.
   */
  clear(): void {
    this.keys = new WeakMap<K, V>();
    this.valueSet.clear();
  }
}
