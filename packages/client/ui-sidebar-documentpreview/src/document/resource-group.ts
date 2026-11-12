/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chuyen tiep thay doi metadata cua thanh vien toi mot ban xem tai lieu
 */

import type { ResourceSourceLike } from "../types.ts";

/** Chuyen tiep thay doi metadata cua thanh vien toi mot ban xem tai lieu. */
export class ResourceGroup {
  /** Nguon tep dung chung. */
  private readonly resources: { source(address: string): ResourceSourceLike };
  /** Danh dau ban xem dang so huu la cu. */
  private readonly changed: () => void;
  /** Ham huy dang ky theo dia chi. */
  private readonly members = new Map<string, () => void>();

  /**
   * Dung mot nhom tai nguyen.
   * Nhan: resources — nguon tep dung chung; changed — danh dau ban xem dang so huu la cu.
   * Tra: instance.
   */
  constructor(resources: { source(address: string): ResourceSourceLike }, changed: () => void) {
    this.resources = resources;
    this.changed = changed;
  }

  /**
   * Dang ky mot lan; metadata dau tien dat moc cho cac thay doi sau.
   * Nhan: address — dia chi tai nguyen day du.
   * Tra: khong.
   */
  add(address: string): void {
    if (this.members.has(address)) return;
    const source = this.resources.source(address);
    let previous: string | undefined;
    const observe = (): void => {
      const next = source.getSnapshot();
      if (next.status !== "live" && next.status !== "failed") return;
      const key = next.status === "live" ? "live:" + String(next.value?.version) : "failed:" + String(next.failure?.code);
      const changed = previous !== undefined && key !== previous;
      previous = key;
      if (changed) this.changed();
    };
    this.members.set(address, source.subscribe(observe));
    observe();
  }

  /**
   * Tra tu do nhung phu thuoc khong con trong tai lieu hien tai.
   * Nhan: addresses — thanh vien day du cua lan nap tai lieu moi nhat.
   * Tra: khong.
   */
  set(addresses: readonly string[]): void {
    const retained = new Set(addresses);
    for (const address of retained) this.add(address);
    for (const [address, release] of [...this.members]) {
      if (retained.has(address)) continue;
      this.members.delete(address);
      release();
    }
  }

  /**
   * Tra tu do moi thanh vien khi tab ban xem ket thuc.
   * Nhan: khong.
   * Tra: khong.
   */
  close(): void {
    this.set([]);
  }
}
