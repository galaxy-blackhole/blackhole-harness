/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chọn socket vật lý cho trình duyệt, vỏ desktop và kết nối Node đã xác thực
 */

/** Socket đã mở trên giao vận đã chọn (đúng phần mà các channel tiêu thụ). */
export interface ConnectionWebSocket {
  /** Trạng thái kết nối theo chuẩn WebSocket (0 đang nối, 1 mở, 3 đã đóng). */
  readonly readyState: number;
  /** Gửi một khung văn bản. */
  send(data: string): void;
  /** Đóng socket. */
  close(code?: number, reason?: string): void;
  /** Nghe một sự kiện của socket. */
  addEventListener(type: string, listener: (event: unknown) => void): void;
}

/** Factory socket có xác thực (mặc định dùng WebSocket của trình duyệt). */
export type ConnectionWebSocketFactory = (url: string) => ConnectionWebSocket;

/**
 * Giải một channel logic theo Host tường minh hoặc theo base của tài liệu.
 *
 * Đổi scheme http(s) sang ws(s) và trả socket do bên gọi sở hữu. Ngoài tài liệu (ví dụ trong worker)
 * BẮT BUỘC có `baseUrl`, nếu không thì ném lỗi rõ ràng thay vì đoán bừa.
 * @param path - đường dẫn channel logic tuyệt đối (bắt đầu bằng "/").
 * @param factory - factory socket có xác thực; mặc định dùng WebSocket của trình duyệt.
 * @param baseUrl - base URL của Host, bắt buộc khi không có document.
 * @returns socket đang kết nối.
 * @throws Error khi không có base URL nào để giải.
 */
export function openConnectionWebSocket(path: string, factory?: ConnectionWebSocketFactory, baseUrl?: string): ConnectionWebSocket {
  const documentBase = typeof document === "undefined" ? undefined : document.baseURI;
  const base = baseUrl ?? documentBase;
  if (base === undefined) throw new Error("connection: WebSocket carrier requires streamBaseUrl outside a document");
  const url = new URL(path.slice(1), base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const create = factory ?? ((target: string) => new WebSocket(target) as unknown as ConnectionWebSocket);
  return create(url.href);
}
