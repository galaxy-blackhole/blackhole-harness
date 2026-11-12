/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Mat hanh dong panel xuyen plugin (ctx.layout) — chon panel giua, toggle thanh ben, bao cot phai
 */

/** Tham chiếu CAS… không dùng ở đây; chỉ khai đúng những gì mặt này cần. */
export interface PanelInfo {
  /** Panel giữa đang chọn; null là hiện Hội thoại. */
  readonly activePanelId: string | null;
}

/** Nguồn chỉ đọc ảnh chụp panel đang chọn của store gốc. */
export interface PanelInfoSource {
  /** Ảnh chụp hiện tại. */
  getSnapshot: () => PanelInfo;
  /** Đăng ký người nghe; trả hàm gỡ. */
  subscribe: (listener: () => void) => () => void;
}

/** Tập action đã ràng buộc của store khung (bản gốc gọi là BoundActions). */
export interface PanelActions {
  /** Chọn panel giữa (không đổi phiên đang chọn). */
  selectPanel: (panelId: string | null) => void;
  /** Thu/mở thanh bên. */
  toggleSidebar: () => void;
  /** Báo cột phải đang có track và/hoặc đang toàn màn hình. */
  openRightbar: (track: boolean, fullscreen: boolean) => void;
  /** Báo cột phải đã ẩn. */
  closeRightbar: () => void;
}

/** Nhánh điều hướng mà `ctx.layout` phơi ra cho các plugin khác. */
export interface ILayout {
  /** Nguồn ảnh chụp panel giữa, dùng chung với `usePanelInfo`. */
  readonly panelInfo: PanelInfoSource;
  /** Chọn panel giữa; ném lỗi nếu khoá chưa được đăng ký. */
  selectPanel: (panelId: string | null) => void;
  /** Mở một lần điều hướng mới và trả tín hiệu huỷ của nó. */
  beginNavigation: () => AbortSignal;
  /** Huỷ mọi điều hướng đang chờ khi chủ khung bị gỡ. */
  dispose: () => void;
  /** Thu/mở thanh bên. */
  toggleSidebar: () => void;
  /** Báo cột phải có track và trạng thái toàn màn hình. */
  openRightbar: (track: boolean, fullscreen: boolean) => void;
  /** Báo cột phải đã ẩn: không track, không tay kéo. */
  closeRightbar: () => void;
}

/**
 * Mặt hành động panel mà các plugin khác với tới qua `ctx.layout`.
 *
 * Hình học panel và việc chọn panel giữa nằm trong store khung ở gốc; việc chọn PHIÊN nằm ở runtime
 * sessions. Ở đây chỉ còn hợp đồng cho các chuyển tiếp panel — mọi thao tác ghi đều nằm trong tập action
 * đã khai của store, dùng chung với đăng ký ở gốc.
 */
export class LayoutController implements ILayout {
  /** Action của instance dùng chung với ô `root`. */
  private readonly panels: PanelActions;

  /** Kiểm sổ đăng ký ô `main` đang sống có khoá này chưa. */
  private readonly hasMainPanel: (panelId: string) => boolean;

  /** Nguồn ảnh chụp panel giữa của store gốc. */
  readonly panelInfo: PanelInfoSource;

  /** Điều hướng đang chờ; huỷ trước mỗi lần chọn mới. */
  private navigation = new AbortController();

  /**
   * Nhận: action của instance dùng chung với ô `root`, hàm kiểm sổ `main`, và nguồn ảnh chụp panel giữa.
   * Trả: thực thể điều khiển khung.
   */
  constructor(panels: PanelActions, hasMainPanel: (panelId: string) => boolean, panelInfo: PanelInfoSource) {
    this.panels = panels;
    this.hasMainPanel = hasMainPanel;
    this.panelInfo = panelInfo;
  }

  /**
   * Chọn một panel giữa toàn cục, hoặc quay về Hội thoại.
   * Nhận: khoá panel, hoặc null.
   * Trả: không có; ném lỗi nếu khoá chưa được đăng ký.
   */
  selectPanel(panelId: string | null): void {
    if (panelId !== null && !this.hasMainPanel(panelId)) {
      throw new Error('layout.selectPanel: main panel "' + panelId + '" is not registered');
    }
    this.navigation.abort();
    this.panels.selectPanel(panelId);
  }

  /**
   * Mở một lần điều hướng mới.
   * Nhận: không có.
   * Trả: tín hiệu huỷ của lần điều hướng vừa mở.
   */
  beginNavigation(): AbortSignal {
    this.navigation.abort();
    this.navigation = new AbortController();
    return this.navigation.signal;
  }

  /** Huỷ mọi điều hướng đang chờ khi chủ khung bị gỡ. */
  dispose(): void {
    this.navigation.abort();
  }

  /** Thu/mở thanh bên (đang thu ⟷ về bề rộng mặc định của hợp đồng). */
  toggleSidebar(): void {
    this.panels.toggleSidebar();
  }

  /**
   * Báo cột phải có track và/hoặc đang toàn màn hình.
   * Nhận: cờ track và cờ toàn màn hình.
   * Trả: không có.
   */
  openRightbar(track: boolean, fullscreen: boolean): void {
    this.panels.openRightbar(track, fullscreen);
  }

  /** Báo cột phải đã ẩn: không track, không tay kéo. */
  closeRightbar(): void {
    this.panels.closeRightbar();
  }
}
