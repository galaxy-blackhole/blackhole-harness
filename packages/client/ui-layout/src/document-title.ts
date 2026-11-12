/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tieu de trinh duyet: theo panel giua / session dang giu, tra ve tieu de san pham khi go
 */

/** Ảnh chụp phiên mà component đọc. */
export interface SessionsSnapshot {
  /** Phiên theo id. */
  readonly byId: Readonly<Record<string, { readonly id?: string; readonly title?: string; readonly retainedBy?: { readonly mainView?: number } }>>;
}

/** Phụ thuộc để dựng `DocumentTitle`. */
export interface DocumentTitleDeps {
  /** Hiệu ứng vòng đời của React. */
  useEffect: (callback: () => void | (() => void), deps: unknown[]) => void;
}

/** Props mà ô `root` truyền xuống. */
export interface DocumentTitleProps {
  /** Hook chọn từ ảnh chụp phiên. */
  useSessions: (select: (state: SessionsSnapshot) => string | undefined) => string | undefined;
  /** Hook chọn từ thông tin panel giữa. */
  usePanelInfo: (select: (info: { readonly activePanelId: string | null }) => boolean) => boolean;
  /** Tiêu đề sản phẩm do bản build chọn. */
  productTitle: string;
}

/**
 * Dựng component tiêu đề trình duyệt.
 *
 * Việc chọn tiêu đề đi theo panel giữa đang bật mà KHÔNG đăng ký khung vào từng lần đổi panel: khi panel
 * đang chọn là null (đang xem Hội thoại) thì lấy tiêu đề của phiên đang được giữ trong khung chính,
 * ngược lại trả về tiêu đề sản phẩm. Khi tháo gỡ, tiêu đề sản phẩm được trả lại.
 * Nhận: phụ thuộc React.
 * Trả: component `DocumentTitle` (không render gì).
 */
export function createDocumentTitle(deps: DocumentTitleDeps): (props: DocumentTitleProps) => null {
  /**
   * Chiếu tiêu đề phiên đang giữ vào tiêu đề trình duyệt.
   * Nhận: hai hook chọn của framework và tiêu đề sản phẩm.
   * Trả: null — component không render nội dung nào.
   */
  function DocumentTitle({ useSessions, usePanelInfo, productTitle }: DocumentTitleProps): null {
    const showSessionTitle = usePanelInfo((info) => info.activePanelId === null);
    const title = useSessions((state) => {
      const current = Object.values(state.byId).find((session) => (session.retainedBy?.mainView ?? 0) > 0)?.id;
      return !showSessionTitle || current === undefined ? undefined : state.byId[current]?.title;
    });
    deps.useEffect(() => {
      document.title = title === undefined ? productTitle : title + " — " + productTitle;
      return () => {
        document.title = productTitle;
      };
    }, [productTitle, title]);
    return null;
  }

  return DocumentTitle;
}
