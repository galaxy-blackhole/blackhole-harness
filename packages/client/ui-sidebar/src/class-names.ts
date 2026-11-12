/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ghep ten lop (thay `clsx`) va bang ten lop cua hai CSS module — giu NGUYEN hash cua ban goc
 */

/** Một giá trị đầu vào của hàm ghép tên lớp. */
export type ClassValue = string | number | null | undefined | false | ClassValue[] | { [key: string]: unknown };

/**
 * Nối các tên lớp lại, bỏ mọi giá trị giả — cùng ngữ nghĩa với `clsx` mà bản gốc nhúng sẵn.
 * Viết lại tại đây vì repo không cài gói `clsx` và luật §3b không cho thêm phụ thuộc ngoài bảng seam.
 * Nhận: danh sách giá trị (chuỗi, số, mảng lồng, hoặc bản đồ tên→điều kiện).
 * Trả: chuỗi tên lớp đã nối bằng một dấu cách.
 */
export function clsx(...values: ClassValue[]): string {
  const parts: string[] = [];
  for (const value of values) {
    if (value === null || value === undefined || value === false || value === "" || value === 0) continue;
    if (typeof value === "string" || typeof value === "number") {
      parts.push(String(value));
      continue;
    }
    if (Array.isArray(value)) {
      const nested = clsx(...value);
      if (nested !== "") parts.push(nested);
      continue;
    }
    for (const [name, on] of Object.entries(value)) if (on) parts.push(name);
  }
  return parts.join(" ");
}

/** Tên lớp của `HeaderLeadingControls.module.css` — giữ nguyên hash `IW6AQa_` của bản gốc. */
export const HEADER_CLASS = {
  /** Hàng chứa hai nút điều khiển. */
  controls: "IW6AQa_controls",
  /** Nút biểu tượng vuông 28px. */
  iconButton: "IW6AQa_iconButton",
} as const;

/** Tên lớp của `SidebarRoot.module.css` — giữ nguyên hash `hHd-Xa_` của bản gốc để DOM không lệch. */
export const SIDEBAR_CLASS = {
  /** Khung cột. */
  root: "hHd-Xa_root",
  /** Trạng thái đã thu hẳn (56px rail). */
  collapsed: "hHd-Xa_collapsed",
  /** Cột đang ở trạng thái rộng. */
  wide: "hHd-Xa_wide",
  /** Nhịp mờ khi đang thu. */
  fading: "hHd-Xa_fading",
  /** Nhịp trượt khi vào rail lần đầu. */
  railIn: "hHd-Xa_railIn",
  /** Dải trên cùng (chỉ macOS desktop). */
  topStrip: "hHd-Xa_topStrip",
  /** Hàng logo. */
  logoRow: "hHd-Xa_logoRow",
  /** Nút logo (bản không phải macOS). */
  brand: "hHd-Xa_brand",
  /** Khối danh tính thương hiệu. */
  brandIdentity: "hHd-Xa_brandIdentity",
  /** Ô biểu tượng thương hiệu. */
  brandMark: "hHd-Xa_brandMark",
  /** Ô tên thương hiệu. */
  brandName: "hHd-Xa_brandName",
  /** Tên thương hiệu dự phòng. */
  fallbackBrandName: "hHd-Xa_fallbackBrandName",
  /** Nhãn bản build cục bộ. */
  localBuildBrand: "hHd-Xa_localBuildBrand",
  /** Dòng tiêu đề của nhãn bản build. */
  localBuildTitle: "hHd-Xa_localBuildTitle",
  /** Chuỗi phiên bản bản build. */
  buildVersion: "hHd-Xa_buildVersion",
  /** Nút biểu tượng chung. */
  iconButton: "hHd-Xa_iconButton",
  /** Nút mở/đóng sidebar. */
  toggle: "hHd-Xa_toggle",
  /** Biểu tượng thương hiệu trên rail. */
  railMark: "hHd-Xa_railMark",
  /** Biểu tượng panel trong nút toggle. */
  panelIcon: "hHd-Xa_panelIcon",
  /** Nút tạo phiên mới. */
  newSession: "hHd-Xa_newSession",
  /** Mặt nạ cắt nhãn phiên mới. */
  newSessionLabelMask: "hHd-Xa_newSessionLabelMask",
  /** Nội dung nút phiên mới. */
  newSessionContent: "hHd-Xa_newSessionContent",
  /** Nhãn chữ của nút phiên mới. */
  newSessionLabel: "hHd-Xa_newSessionLabel",
  /** Tổ hợp phím của phiên mới. */
  newSessionShortcut: "hHd-Xa_newSessionShortcut",
  /** Danh sách panel toàn cục. */
  panelList: "hHd-Xa_panelList",
  /** Một dòng panel. */
  panelRow: "hHd-Xa_panelRow",
  /** Dòng panel đang được chọn. */
  panelActive: "hHd-Xa_panelActive",
  /** Ô biểu tượng của dòng panel. */
  panelGlyph: "hHd-Xa_panelGlyph",
  /** Tiêu đề dòng panel khi cột rộng. */
  panelTitle: "hHd-Xa_panelTitle",
  /** Vùng duyệt workspace/phiên. */
  regionArea: "hHd-Xa_regionArea",
  /** Chân cột. */
  footArea: "hHd-Xa_footArea",
  /** Hàng hành động ở chân cột. */
  footerActions: "hHd-Xa_footerActions",
  /** Ghế Settings ở chân cột. */
  settingsArea: "hHd-Xa_settingsArea",
  /** Cột không vẽ thanh cuộn khi con trỏ ở ngoài. */
  quietBars: "hHd-Xa_quietBars",
  /** Khoá của nhịp trượt vào rail (do CSS module sinh, không dùng trong JS). */
  "rail-in": "hHd-Xa_rail-in",
  /** Khoá của nhịp mờ vào rail (do CSS module sinh, không dùng trong JS). */
  "rail-fade-in": "hHd-Xa_rail-fade-in",
  /** Khoá của nhịp mở rộng (do CSS module sinh, không dùng trong JS). */
  "wide-in": "hHd-Xa_wide-in",
} as const;
