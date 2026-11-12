/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 gói THƯ VIỆN @galaxy-blackhole/gbh-deque (86 dòng, zero-dependency): deque VÒNG có
 *      chèn/xoá hai đầu khấu hao O(1), xoá là giải phóng tham chiếu ngay, và co bộ nhớ khi số phần tử sống
 *      giảm xuống còn 1/4 dung lượng.
 */

/** Dung lượng tối thiểu của bộ đệm (giữ nguyên bản gốc). */
const MIN_CAPACITY = 16;

/**
 * Deque VÒNG với chèn/xoá hai đầu khấu hao O(1).
 * Xoá phần tử là **xoá tham chiếu ngay** (tránh giữ rác), và bộ đệm **co lại** khi số phần tử sống
 * ≤ 1/4 dung lượng hiện tại — y hệt bản gốc.
 */
export class Deque<T> {
  /** Bộ đệm vòng. */
  private buffer: (T | undefined)[] = new Array(MIN_CAPACITY);
  /** Chỉ số phần tử đầu tiên. */
  private head = 0;
  /** Số phần tử đang sống. */
  private count = 0;

  /** Số phần tử có thể lấy ra. */
  get size(): number {
    return this.count;
  }

  /**
   * Thêm một phần tử vào SAU đuôi hiện tại.
   * @param value - phần tử cần thêm.
   * @returns không.
   */
  pushBack(value: T): void {
    this.ensureCapacity();
    const tail = this.head + this.count;
    this.buffer[tail < this.buffer.length ? tail : tail - this.buffer.length] = value;
    this.count += 1;
  }

  /**
   * Chèn một phần tử vào TRƯỚC đầu hiện tại.
   * @param value - phần tử cần chèn.
   * @returns không.
   */
  pushFront(value: T): void {
    this.ensureCapacity();
    this.head = this.head === 0 ? this.buffer.length - 1 : this.head - 1;
    this.buffer[this.head] = value;
    this.count += 1;
  }

  /**
   * Lấy ra phần tử ĐẦU và giải phóng tham chiếu của nó.
   * Gọi nơi mà kiểu phần tử bao gồm `undefined` phải dùng {@link size} để phân biệt deque rỗng với
   * một phần tử `undefined` — đúng ghi chú của bản gốc.
   * @returns phần tử đã lấy ra, hoặc `undefined` khi deque rỗng.
   */
  popFront(): T | undefined {
    if (this.count === 0) return undefined;
    const value = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head += 1;
    if (this.head === this.buffer.length) this.head = 0;
    this.count -= 1;
    this.compact();
    return value;
  }

  /**
   * Bỏ TOÀN BỘ phần tử và giải phóng bộ đệm hiện tại.
   * @returns không.
   */
  clear(): void {
    this.buffer = new Array(MIN_CAPACITY);
    this.head = 0;
    this.count = 0;
  }

  /**
   * Bảo đảm còn chỗ trống: đầy thì tăng gấp đôi dung lượng.
   * @returns không.
   */
  private ensureCapacity(): void {
    if (this.count < this.buffer.length) return;
    this.resize(this.buffer.length * 2);
  }

  /**
   * Co bộ đệm khi số phần tử sống ≤ 1/4 dung lượng (và dung lượng > tối thiểu).
   * @returns không.
   */
  private compact(): void {
    if (this.count === 0) {
      this.head = 0;
      return;
    }
    if (this.buffer.length > MIN_CAPACITY && this.count <= this.buffer.length / 4) {
      this.resize(Math.max(MIN_CAPACITY, this.buffer.length / 2));
    }
  }

  /**
   * Cấp bộ đệm mới với dung lượng cho trước và dồn phần tử sống về đầu.
   * @param capacity - dung lượng mới.
   * @returns không.
   */
  private resize(capacity: number): void {
    const next = new Array<T | undefined>(capacity);
    let source = this.head;
    for (let index = 0; index < this.count; index += 1) {
      next[index] = this.buffer[source];
      source += 1;
      if (source === this.buffer.length) source = 0;
    }
    this.buffer = next;
    this.head = 0;
  }
}
