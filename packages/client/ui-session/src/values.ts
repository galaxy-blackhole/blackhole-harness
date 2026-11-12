/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tra cứu theo khoá yếu kèm tập giá trị được giữ mạnh (bản viết lại của WeakMapWithValues)
 */

/**
 * Tra cứu theo khoá yếu, kèm tập giá trị được giữ mạnh và lặp được.
 *
 * Mỗi giá trị chỉ thuộc MỘT khoá. Bộ chứa không tự dọn: chủ sở hữu xoá liên kết hoặc xoá cả bộ
 * chứa ở cuối vòng đời.
 */
export class WeakMapWithValues<K extends object, V> {
  /** Khoá yếu trỏ tới giá trị. */
  private keys = new WeakMap<K, V>();
  /** Tập giá trị được giữ mạnh. */
  private readonly valueSet = new Set<V>();

  /** Giá trị còn sống, giữ mạnh, theo thứ tự chèn. */
  get values(): Set<V> {
    return this.valueSet;
  }

  /**
   * Đọc giá trị gắn với một khoá.
   * Nhận: khoá được giữ yếu.
   * Trả: giá trị đã gắn, hoặc undefined.
   */
  get(key: K): V | undefined {
    return this.keys.get(key);
  }

  /**
   * Kiểm một khoá có liên kết hay chưa.
   * Nhận: khoá được giữ yếu.
   * Trả: có hay không.
   */
  has(key: K): boolean {
    return this.keys.has(key);
  }

  /**
   * Gắn một khoá với một giá trị duy nhất của người gọi.
   * Nhận: khoá được giữ yếu và giá trị được giữ mạnh.
   * Trả: chính bộ chứa này.
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
   * Bỏ một liên kết cùng giá trị được giữ mạnh của nó.
   * Nhận: khoá được giữ yếu.
   * Trả: có xoá được liên kết nào không.
   */
  delete(key: K): boolean {
    if (!this.keys.has(key)) return false;
    const value = this.keys.get(key) as V;
    const deleted = this.keys.delete(key);
    this.valueSet.delete(value);
    return deleted;
  }

  /**
   * Bỏ mọi liên kết và mọi giá trị được giữ mạnh.
   * Nhận: không.
   * Trả: không.
   */
  clear(): void {
    this.keys = new WeakMap<K, V>();
    this.valueSet.clear();
  }
}
