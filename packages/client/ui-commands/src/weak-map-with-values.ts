/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Anh xa khoa YEU sang gia tri duoc GIU MANH, kem tap gia tri de duyet theo thu tu
 */

/**
 * Tra cuu theo khoa yeu, dong thoi giu manh mot tap gia tri de duyet duoc.
 *
 * Moi gia tri chi thuoc MOT khoa. Bo chua khong tu don: chu so huu xoa lien ket hoac
 * clear bo chua vao cuoi vong doi.
 */
export class WeakMapWithValues<K extends object, V extends object> {
  /** Anh xa khoa yeu -> gia tri. */
  private keys = new WeakMap<K, V>();

  /** Tap gia tri duoc giu manh (duyet theo thu tu them vao). */
  private valueSet = new Set<V>();

  /**
   * Cac gia tri dang duoc giu manh, theo thu tu them vao.
   * Nhan: khong co.
   * Tra: tap gia tri song.
   */
  get values(): ReadonlySet<V> {
    return this.valueSet;
  }

  /**
   * Doc gia tri gan voi mot khoa.
   * Nhan: key — khoa tra cuu duoc giu yeu.
   * Tra: gia tri da gan, hoac undefined.
   */
  get(key: K): V | undefined {
    return this.keys.get(key);
  }

  /**
   * Kiem mot khoa da duoc gan chua.
   * Nhan: key — khoa tra cuu duoc giu yeu.
   * Tra: true khi khoa co mat.
   */
  has(key: K): boolean {
    return this.keys.has(key);
  }

  /**
   * Gan mot khoa voi mot gia tri rieng cua nguoi goi.
   * Nhan: key — khoa duoc giu yeu; value — gia tri duoc giu manh va khong thuoc khoa nao khac.
   * Tra: chinh bo chua nay.
   */
  set(key: K, value: V): this {
    if (this.keys.has(key)) {
      const previous = this.keys.get(key);
      if (previous === value) return this;
      if (previous !== undefined) this.valueSet.delete(previous);
    }
    this.keys.set(key, value);
    this.valueSet.add(value);
    return this;
  }

  /**
   * Go mot lien ket va gia tri duoc giu manh tuong ung.
   * Nhan: key — khoa duoc giu yeu.
   * Tra: true khi co lien ket bi go.
   */
  delete(key: K): boolean {
    if (!this.keys.has(key)) return false;
    const value = this.keys.get(key);
    const deleted = this.keys.delete(key);
    if (value !== undefined) this.valueSet.delete(value);
    return deleted;
  }

  /**
   * Go moi lien ket va moi gia tri duoc giu manh.
   * Nhan: khong co.
   * Tra: khong co.
   */
  clear(): void {
    this.keys = new WeakMap<K, V>();
    this.valueSet.clear();
  }
}
