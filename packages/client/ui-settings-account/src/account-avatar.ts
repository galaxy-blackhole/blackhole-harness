/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mot lan tai anh dai dien dung chung cho thanh ben va Settings trong suot vong doi plugin
 */

import type { AvatarSnapshot } from "./contracts.ts";

/**
 * So huu anh cua trinh duyet va bo moi callback sau khi dia chi bi thay hoac plugin bi go.
 */
export class AccountAvatarLoader {
  /** Phat thay doi anh qua anh chup tai khoan. */
  private readonly publish: (snapshot: AvatarSnapshot | undefined) => void;
  /** Lan tai hien tai. */
  private snapshot: AvatarSnapshot | undefined;
  /** Doi tuong anh cua trinh duyet. */
  private image: HTMLImageElement | undefined;
  /** Da bi go chua (moi lan tai sau do bi bo qua). */
  private disposed = false;

  /**
   * @param publish - phat thay doi anh qua anh chup tai khoan.
   */
  constructor(publish: (snapshot: AvatarSnapshot | undefined) => void) {
    this.publish = publish;
  }

  /**
   * Tai mot dia chi da doi mot lan; dia chi vang hoac rong thi xoa anh.
   * @param url - anh cua ho so thanh cong moi nhat, vang khi khong co anh.
   */
  setUrl(url: string | undefined): void {
    if (this.disposed) return;
    const source = url || undefined;
    if (this.snapshot?.url === source) return;
    if (source === undefined) {
      this.detach();
      this.update(undefined);
    } else this.load(source);
  }

  /** Thu lai mot anh da that bai mot lan; lan dang tai va lan thanh cong van dung chung. */
  retry(): void {
    if (!this.disposed && this.snapshot?.status === "failed") this.load(this.snapshot.url);
  }

  /**
   * Dua ca hai be mat ve anh mac dinh khi anh da ve nhung that bai.
   * @param snapshot - lan tai ma phan tu loi dang ve; lan da bi thay the thi bo qua.
   */
  failed(snapshot: AvatarSnapshot | undefined): void {
    if (this.disposed || this.snapshot !== snapshot || snapshot?.status !== "ready") return;
    this.detach();
    this.update({ url: snapshot.url, status: "failed" });
  }

  /** Nha anh ma khong phat; chu so huu phat avatar rong cung khung tai khoan thay the. */
  reset(): void {
    this.detach();
    this.snapshot = undefined;
  }

  /** Nha anh cua trinh duyet va chan moi lan tai hay phat ve sau. */
  dispose(): void {
    this.disposed = true;
    this.reset();
  }

  /**
   * Tai mot dia chi anh moi.
   * @param url - dia chi anh.
   */
  private load(url: string): void {
    this.detach();
    const image = new Image();
    this.image = image;
    image.referrerPolicy = "no-referrer";
    /**
     * Chot ket qua cua lan tai nay.
     * @param status - ready hoac failed.
     */
    const settle = (status: string): void => {
      if (this.image !== image) return;
      image.onload = null;
      image.onerror = null;
      this.update({ url, status });
    };
    image.onload = () => {
      settle("ready");
    };
    image.onerror = () => {
      settle("failed");
    };
    this.update({ url, status: "loading" });
    if (this.image === image) image.src = url;
  }

  /**
   * Ghi lai lan tai hien tai va phat ra ngoai.
   * @param snapshot - lan tai moi.
   */
  private update(snapshot: AvatarSnapshot | undefined): void {
    this.snapshot = snapshot;
    this.publish(snapshot);
  }

  /** Nha phan tu anh cu va go moi callback cua no. */
  private detach(): void {
    const image = this.image;
    this.image = undefined;
    if (image === undefined) return;
    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");
  }
}
