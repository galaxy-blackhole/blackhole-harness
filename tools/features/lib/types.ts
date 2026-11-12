/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Kiểu dữ liệu chung của giàn ảnh theo tính năng: kịch bản, bước thao tác, vùng mask, phần tử DOM
 */

import type { NetEntry } from "./net.ts";

/** Một khung nhìn khi chụp (đơn vị CSS pixel). */
export interface Viewport {
  /** Nhãn dùng trong tên file, ví dụ 1440x900. */
  name: string;
  /** Chiều rộng khung nhìn. */
  width: number;
  /** Chiều cao khung nhìn. */
  height: number;
}

/** Loại bước thao tác trên trang: điều hướng lại, bấm, gõ phím, chờ, rê chuột, nhập chữ, chạy mã. */
export type StepKind = "goto" | "click" | "clickAt" | "press" | "wait" | "hover" | "fill" | "eval";

/** Một bước thao tác; hai bên nhận CÙNG danh sách bước nên thao tác luôn đối xứng. */
export interface Step {
  /** Nhãn bước để ghi vào artifact khi bước hỏng. */
  label: string;
  /** Loại bước. */
  kind: StepKind;
  /** Selector (click/hover/fill), tên phím (press), số mili giây (wait), đoạn mã (eval). */
  value: string;
  /** Chữ cần gõ, chỉ dùng với kind=fill. */
  text?: string;
  /** true khi bước này là điều kiện sống còn; hỏng thì kịch bản coi như không chụp được. */
  required?: boolean;
}

/** Một vùng bỏ qua khi so pixel, định nghĩa theo tỉ lệ khung để dùng lại cho mọi viewport. */
export interface MaskRegion {
  /** Tên ngắn của vùng. */
  name: string;
  /** Nhóm: brand (khác biệt có chủ ý) hoặc state (trạng thái sống của từng instance). */
  kind: "brand" | "state";
  /** Vì sao vùng này được bỏ qua — bắt buộc, để không ai mask lặng lẽ. */
  reason: string;
  /** Toạ độ trái theo tỉ lệ chiều rộng. */
  x: number;
  /** Toạ độ trên theo tỉ lệ chiều cao. */
  y: number;
  /** Chiều rộng theo tỉ lệ. */
  w: number;
  /** Chiều cao theo tỉ lệ. */
  h: number;
}

/** Trạng thái cuộn của trang lúc chụp — phải bằng 0 ở cả hai bên để phép so là công bằng. */
export interface ScrollState {
  /** scrollTop của document TRƯỚC khi đưa về 0. */
  documentBefore: number;
  /** scrollTop của document SAU khi đưa về 0 (phải là 0). */
  documentAfter: number;
  /** Các vùng cuộn chính tìm được: số thứ tự, chiều cao nội dung, scrollTop trước và sau. */
  regions: { index: number; scrollHeight: number; clientHeight: number; before: number; after: number }[];
}

/** Dấu vân tay trạng thái cây plugin, đọc từ `__DSH_BOOT__` ngay lúc chụp. */
export interface BootFingerprint {
  /** Chuỗi rev của cây (rỗng nếu không đọc được). */
  rev: string;
  /** Số entry client. */
  entries: number;
  /** Số batch nạp. */
  batches: number;
  /** sha256 của danh sách "id@rev" đã sắp xếp — phân biệt được cả khi số entry bằng nhau. */
  hash: string;
  /** Phiên bản harness trong trường release. */
  version: string;
}

/** Điều kiện sẵn sàng riêng của một màn hình: phải thấy nội dung thật, không phải khung xương đang tải. */
export interface Readiness {
  /** Mô tả điều kiện cho người đọc (hiển thị trong ma trận). */
  description: string;
  /** Selector phải xuất hiện mới coi là đã tải; bỏ trống nếu chỉ cần chờ mạng lặng. */
  selector?: string;
  /** Số phần tử tối thiểu phải thấy. */
  minCount?: number;
  /** Thời gian chờ tối đa, mili giây (mặc định 15000). */
  timeoutMs?: number;
  /** true khi bắt buộc phải thấy ít nhất một phản hồi RPC 200 mới coi là nội dung đã tải. */
  requireApi?: boolean;
}

/** Một màn hình/tính năng cần chụp cặp ảnh A/B. */
export interface Scenario {
  /** Khoá ngắn dùng trong tên file ảnh. */
  id: string;
  /** Tên màn hình hiển thị trong ma trận. */
  title: string;
  /** Nhóm chức năng (Trang chào, Sidebar, Chat, Plugins, Settings...). */
  group: string;
  /** Tính năng DSH mà màn hình này chứng minh. */
  feature: string;
  /** Chế độ màu ép cho cả hai bên; mặc định là light như phiên parity. */
  scheme?: "light" | "dark";
  /** Các bước thao tác, chạy giống hệt nhau trên hai bên. */
  steps: Step[];
  /** Vùng mask kèm lý do cho riêng màn hình này. */
  masks: MaskRegion[];
  /** Điều kiện sẵn sàng riêng; bỏ trống nghĩa là màn hình tĩnh, chỉ cần trang tải xong. */
  ready?: Readiness;
  /** Yêu cầu hợp lệ riêng: bắt buộc ô soạn tin, nhãn ô tìm kiếm, chữ nhận diện màn hình... */
  validity?: { composer?: boolean; searchLabel?: string; anchorText?: string };
  /** Ghi chú vận hành (vì sao cần plugin, vì sao có thể không mở được...). */
  note?: string;
}

/** Một phần tử tương tác đọc từ DOM, đã gọn hoá để so cấu trúc giữa hai bên. */
export interface ElementRow {
  /** Tên thẻ, ví dụ button. */
  tag: string;
  /** Vai trò ARIA nếu có. */
  role: string;
  /** Nhãn ARIA nếu có. */
  aria: string;
  /** data-testid nếu có. */
  testid: string;
  /** Chữ hiển thị (đã cắt ngắn). */
  text: string;
  /** Toạ độ trái theo pixel. */
  x: number;
  /** Toạ độ trên theo pixel. */
  y: number;
  /** Chiều rộng pixel. */
  w: number;
  /** Chiều cao pixel. */
  h: number;
}

/** Kết quả một bước sau khi chạy trên một bên. */
export interface StepOutcome {
  /** Nhãn bước. */
  label: string;
  /** true khi bước chạy xong không lỗi. */
  ok: boolean;
  /** Lý do hỏng, hoặc kết quả của kind=eval. */
  note?: string;
}

/** Một bên (ours hoặc ref) sau khi chụp một kịch bản. */
export interface SideCapture {
  /** Khoá bên: ours hoặc ref. */
  key: string;
  /** Nhãn hiển thị của bên. */
  label: string;
  /** Cổng server. */
  port: number;
  /** URL đã mở. */
  url: string;
  /** true khi chụp được ảnh. */
  ok: boolean;
  /** Lý do khi ok=false. */
  error?: string;
  /** Mã HTTP của lần điều hướng. */
  httpStatus: number;
  /** Tiêu đề tài liệu. */
  title: string;
  /** Ảnh PNG chụp màn hình (chỉ có khi ok=true). */
  png?: Buffer;
  /** Danh sách phần tử tương tác tại thời điểm chụp. */
  inventory: ElementRow[];
  /** Nhật ký từng bước. */
  steps: StepOutcome[];
  /** Số hộp thoại một lần đã đóng trước khi so (khác biệt trạng thái onboarding). */
  dismissed: number;
  /** true khi trang vẫn còn hộp thoại chặn thao tác lúc chụp. */
  blockedByDialog: boolean;
  /** Dấu hiệu bất thường đọc được trong chữ hiển thị (rỗng nghĩa là trang sạch). */
  symptoms: string[];
  /** Lỗi console của trang, tối đa 20 dòng — bằng chứng cho khác biệt thật. */
  consoleErrors: string[];
  /** Danh sách nhãn phần tử tương tác (đã sắp xếp) để so cấu trúc. */
  labels: string[];
  /** true khi nội dung thật đã tải (điều kiện sẵn sàng đạt). */
  ready: boolean;
  /** Mô tả điều kiện sẵn sàng đã áp và thời gian đã chờ. */
  readyNote: string;
  /** Các request KHÔNG phải asset tĩnh đã ghi được (đã lọc secret). */
  net: NetEntry[];
  /** Request còn treo lúc chụp ảnh — bằng chứng của RPC không trả. */
  pending: NetEntry[];
  /** Số asset tĩnh đã bỏ qua khi ghi nhật ký mạng. */
  staticAssets: number;
  /** Dấu vân tay cây plugin của bên này lúc chụp. */
  fingerprint: BootFingerprint;
  /** Chữ của tiêu đề đầu tiên trên trang (h1/h2/role=heading). */
  headingText: string;
  /** Toạ độ y của tiêu đề đầu tiên (-1 khi trang không có tiêu đề). */
  headingY: number;
  /** Trạng thái cuộn đã chuẩn hoá về 0 trước khi chụp. */
  scroll: ScrollState;
}
