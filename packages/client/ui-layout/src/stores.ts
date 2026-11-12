/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Store khung o goc: do khung, tuy chon panel va cac bao cao trinh bay cua cot phai
 */
import { clampWidth, RIGHTBAR_DEFAULT_RATIO, RIGHTBAR_MAX_RATIO, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN } from "./columns.ts";

/** Trạng thái khung mà mọi component đọc. */
export interface LayoutInfo {
  /** Bề rộng thanh bên (0 = đang thu). */
  sidebar: number;
  /** Bề rộng khung đo được gần nhất; lần render đầu lấy từ `window.innerWidth`. */
  viewportWidth: number;
  /** Người dùng đã mở thanh bên bằng tay trong khi khung đang hẹp. */
  narrowExpanded: boolean;
  /** Bề rộng cột phải đã lưu (px), hoặc null trước lần mở đầu tiên. */
  rightbar: number | null;
  /** Cột phải có được vẽ hay không. */
  rightbarShown: boolean;
  /** Bề rộng thường của cột phải có chiếm một track của lưới hay không. */
  rightbarTrack: boolean;
  /** Cột phải đang ở dạng toàn màn hình. */
  rightbarFullscreen: boolean;
  /** Bỏ qua transition (khi thoát toàn màn hình) cho tới thao tác hình học kế tiếp. */
  rightbarInstant: boolean;
}

/** Ảnh chụp store khung. */
export interface LayoutState {
  /** Panel giữa đang chọn; null là hiện Hội thoại. */
  panelInfo: { activePanelId: string | null };
  /** Hình học và tuỳ chọn của khung. */
  layoutInfo: LayoutInfo;
}

/** Hình dạng `defineStore` mà `@galaxy-blackhole/gbh-client-store` cấp. */
export type DefineStore = (spec: {
  /** Trạng thái đầu. */
  init: () => LayoutState;
  /** Tập action; tham số đầu là bản nháp trạng thái. */
  actions: Record<string, (draft: LayoutState, ...args: never[]) => void>;
}) => unknown;

/**
 * Dựng handle của store khung.
 *
 * Với thanh bên thì TUỲ CHỌN CHÍNH LÀ bề rộng, nên đóng nó là quên luôn bề rộng đã kéo — mở lại về đúng
 * mặc định của hợp đồng. Cột phải khởi tạo ở 45% khung trong lần mở đầu và giữ nguyên tuỳ chọn px đó qua
 * các lần đổi kích thước và đóng. Thao tác kéo được kẹp vào khoảng của khung hiện tại. Nút thu/mở thanh bên
 * khi khung hẹp chỉ đổi cờ mở đè; mở cột phải thì xoá cờ mở đè đó.
 * Nhận: hàm `defineStore` của bảng module.
 * Trả: handle của store (spec + kiểu + định danh + factory trong một).
 */
export function createLayoutStore(defineStore: DefineStore): unknown {
  return defineStore({
    init: (): LayoutState => ({
      panelInfo: { activePanelId: null },
      layoutInfo: {
        sidebar: SIDEBAR_DEFAULT,
        viewportWidth: window.innerWidth,
        narrowExpanded: false,
        rightbar: null,
        rightbarShown: false,
        rightbarTrack: false,
        rightbarFullscreen: false,
        rightbarInstant: false,
      },
    }),
    actions: {
      /** Chọn panel giữa (không đụng tới phiên). */
      selectPanel: (d: LayoutState, panelId: string | null) => {
        d.panelInfo.activePanelId = panelId;
      },
      /** Bỏ chọn panel giữa vừa bị gỡ khỏi sổ `main`. */
      retainMainPanels: (d: LayoutState, panelIds: readonly string[]) => {
        if (d.panelInfo.activePanelId !== null && !panelIds.includes(d.panelInfo.activePanelId)) {
          d.panelInfo.activePanelId = null;
        }
      },
      /** Ghi bề rộng thanh bên (đã kẹp vào hợp đồng). */
      setSidebar: (d: LayoutState, px: number) => {
        d.layoutInfo.rightbarInstant = false;
        d.layoutInfo.sidebar = clampWidth(px, SIDEBAR_MIN, SIDEBAR_MAX);
      },
      /** Thu/mở thanh bên: hẹp thì đổi cờ mở đè, rộng thì đóng (0) hoặc về mặc định. */
      toggleSidebar: (d: LayoutState) => {
        d.layoutInfo.rightbarInstant = false;
        if (d.layoutInfo.viewportWidth < SIDEBAR_AUTO_COLLAPSE) {
          d.layoutInfo.narrowExpanded = !d.layoutInfo.narrowExpanded;
        } else {
          d.layoutInfo.sidebar = d.layoutInfo.sidebar === 0 ? SIDEBAR_DEFAULT : 0;
        }
      },
      /** Ghi bề rộng khung; xoá cờ mở đè khi vừa vượt ngưỡng tự thu theo một trong hai chiều. */
      setViewportWidth: (d: LayoutState, width: number) => {
        if (d.layoutInfo.viewportWidth === width) return;
        d.layoutInfo.rightbarInstant = false;
        if (d.layoutInfo.viewportWidth < SIDEBAR_AUTO_COLLAPSE !== width < SIDEBAR_AUTO_COLLAPSE) {
          d.layoutInfo.narrowExpanded = false;
        }
        d.layoutInfo.viewportWidth = width;
      },
      /** Ghi bề rộng cột phải (đã kẹp theo khung hiện tại). */
      setRightbar: (d: LayoutState, px: number) => {
        d.layoutInfo.rightbarInstant = false;
        d.layoutInfo.rightbar = clampWidth(px, 300, Math.max(300, d.layoutInfo.viewportWidth * RIGHTBAR_MAX_RATIO));
      },
      /** Báo cột phải đang hiện; lần mở đầu gieo tuỳ chọn 45% khung. */
      openRightbar: (d: LayoutState, track: boolean, fullscreen: boolean) => {
        if (!d.layoutInfo.rightbarShown || d.layoutInfo.rightbarTrack !== track || d.layoutInfo.rightbarFullscreen !== fullscreen) {
          d.layoutInfo.rightbarInstant = d.layoutInfo.rightbarFullscreen;
        }
        if (!d.layoutInfo.rightbarShown && d.layoutInfo.viewportWidth < SIDEBAR_AUTO_COLLAPSE) {
          d.layoutInfo.narrowExpanded = false;
        }
        d.layoutInfo.rightbar ??= Math.max(300, Math.round(d.layoutInfo.viewportWidth * RIGHTBAR_DEFAULT_RATIO));
        d.layoutInfo.rightbarShown = true;
        d.layoutInfo.rightbarTrack = track;
        d.layoutInfo.rightbarFullscreen = fullscreen;
      },
      /** Báo cột phải đã ẩn: không track, không tay kéo. */
      closeRightbar: (d: LayoutState) => {
        if (d.layoutInfo.rightbarShown) d.layoutInfo.rightbarInstant = d.layoutInfo.rightbarFullscreen;
        d.layoutInfo.rightbarShown = false;
        d.layoutInfo.rightbarTrack = false;
        d.layoutInfo.rightbarFullscreen = false;
      },
    },
  });
}
