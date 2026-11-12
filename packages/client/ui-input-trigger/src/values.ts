/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng ../../util/values/src/index.ts của bản gốc — assertNever + WeakMapWithValues, NGUYÊN VĂN hành vi
 */

/**
 * Đánh dấu một nhánh liên hợp đóng không bao giờ tới được.
 * Nhận: value — giá trị không thể xảy ra; context — nhãn điểm switch (tuỳ chọn) để đưa vào thông điệp lỗi.
 * Trả: never — một giá trị lọt khỏi kiểu của nó luôn ném lỗi.
 */
export function assertNever(value: never, context?: string): never {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}

/**
 * Tra cứu khóa yếu kèm một tập giá trị liên kết được giữ mạnh và lặp được.
 *
 * Mỗi giá trị chỉ thuộc một khóa. Container không tự dọn; chủ sở hữu xóa liên kết hoặc clear lúc hết vòng đời.
 * Nhận: cặp khóa yếu K và giá trị giữ mạnh V khi gắn.
 * Trả: container tra cứu được theo khóa (get/has/set/delete/clear).
 */
export class WeakMapWithValues<K extends object, V> {
  /** Bảng khóa yếu. */
  keys = new WeakMap<K, V>();

  /** Tập giá trị giữ mạnh. */
  valueSet = new Set<V>();

  /** Giá trị giữ mạnh theo thứ tự chèn (cùng thân với valueSet). */
  values = this.valueSet;

  /**
   * Đọc giá trị gắn với một khóa.
   * Nhận: key — khóa tra cứu giữ yếu.
   * Trả: giá trị liên kết, hoặc undefined khi không có.
   */
  get(key: K): V | undefined {
    return this.keys.get(key);
  }

  /**
   * Kiểm tra một khóa có liên kết hay không.
   * Nhận: key — khóa tra cứu giữ yếu.
   * Trả: true khi khóa có mặt.
   */
  has(key: K): boolean {
    return this.keys.has(key);
  }

  /**
   * Gắn một khóa với một giá trị duy nhất của người gọi.
   * Nhận: key — khóa giữ yếu; value — giá trị giữ mạnh, không thuộc khóa nào khác.
   * Trả: chính container này.
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
   * Bỏ một liên kết cùng giá trị giữ mạnh của nó.
   * Nhận: key — khóa tra cứu giữ yếu.
   * Trả: true khi có liên kết bị bỏ.
   */
  delete(key: K): boolean {
    if (!this.keys.has(key)) return false;
    const value = this.keys.get(key);
    const deleted = this.keys.delete(key);
    if (value !== undefined) this.valueSet.delete(value);
    return deleted;
  }

  /**
   * Bỏ mọi liên kết và mọi giá trị giữ mạnh.
   * Nhận: không có.
   * Trả: không có.
   */
  clear(): void {
    this.keys = new WeakMap<K, V>();
    this.valueSet.clear();
  }
}
