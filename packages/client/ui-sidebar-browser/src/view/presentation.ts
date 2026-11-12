/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat trinh bay tach khoi dieu huong trang va vong doi carrier
 */

/** Mat trinh bay tach khoi dieu huong trang. */
export interface BrowserPresentation {
  /**
   * Gan trang vao mot vung noi dung da cam ket.
   * Nhan: viewportId — id phan tu noi dung.
   * Tra: ham ket thuc gan vat ly (khong huy mo hinh dieu huong).
   */
  mount(viewportId: string): () => void;
}
