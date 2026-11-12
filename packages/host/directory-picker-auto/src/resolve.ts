/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bộ giải backend chọn thư mục lúc boot: MỘT quyết định thuần từ dữ kiện đã lấy mẫu của host,
 *      để capability được mount giữ nguyên suốt vòng đời service như seam yêu cầu.
 */

import { isIP } from "node:net";

/** Backend tương tác cụ thể mà bộ giải chọn giữa hai khả năng. */
export type DirectoryPickerBackendKind = "native" | "browse";

/** Các khoá môi trường mà phép giải đọc (một tập con của process.env). */
export type DirectoryPickerEnv = Readonly<Partial<Record<"DISPLAY" | "WAYLAND_DISPLAY", string>>>;

/** Dữ kiện host mà lựa chọn backend là hàm thuần của chúng, lấy mẫu MỘT LẦN lúc boot. */
export interface DirectoryPickerHostFacts {
  /** Địa chỉ bind hiệu dụng của webserver (một literal IP cụ thể của một giao diện nội bộ). */
  bindHost: string;
  /** Chính sách tin cậy của Connection có nhận authority KHÔNG-loopback hay không. */
  allowsRemoteAuthorities: boolean;
  /** Nền tảng của tiến trình host. */
  platform: NodeJS.Platform;
  /** Dữ kiện SSH của lớp tiến trình kế thừa, độc lập với giá trị trong `.env`. */
  ssh: boolean;
  /** Mẫu môi trường; DISPLAY/WAYLAND_DISPLAY đánh dấu một phiên hiển thị Linux. */
  env: DirectoryPickerEnv;
  /** Có binary chọn thư mục (zenity/kdialog) trên PATH hay không; chỉ xét khi platform là linux. */
  linuxChooser: boolean;
}

/** Một env chỉ tính khi được đặt và không rỗng (export rỗng là "không đặt" theo quy ước shell). */
function present(value: string | undefined): boolean {
  return value !== undefined && value !== "";
}

/**
 * Địa chỉ bind này có phải loopback hay không.
 *
 * Viết lại hành vi của `isLoopbackHost` bên gói webserver (không thuộc bảng peer §3b): nhận literal
 * IPv4 (127.0.0.0/8), IPv6 `::1`, và dạng IPv4-mapped (`::ffff:127.0.0.1` hoặc `::ffff:7f00:1`);
 * bỏ hậu tố vùng `%iface`. Chuỗi không phải literal IP thì KHÔNG phải loopback.
 * @param host - literal IPv4/IPv6, có thể kèm vùng.
 * @returns true khi literal trỏ về loopback.
 */
export function isLoopbackHost(host: string): boolean {
  const zoneAt = host.indexOf("%");
  const bare = zoneAt === -1 ? host : host.slice(0, zoneAt);
  if (bare === "") return false;
  const version = isIP(bare);
  if (version === 4) return bare.startsWith("127.");
  if (version !== 6) return false;
  const lower = bare.toLowerCase();
  const mapped = /(?:^|:)::ffff:(.+)$/u.exec(lower)?.[1];
  if (mapped !== undefined) {
    if (isIP(mapped) === 4) return mapped.startsWith("127.");
    // Dạng hex gộp của IPv4-mapped: 7f00:0001 → 127.0.0.1
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(mapped);
    return hex !== null && Number.parseInt(hex[1] ?? "", 16) >> 8 === 0x7f;
  }
  if (lower === "::1") return true;
  // Dạng đầy đủ 8 nhóm: 0:0:0:0:0:0:0:1
  const parts = lower.split(":");
  if (parts.length !== 8) return false;
  const words = parts.map((part) => Number.parseInt(part, 16));
  return words.every((word) => Number.isFinite(word)) && words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
}

/**
 * Giải xem backend nào phục vụ lượt boot này.
 *
 * `native` đòi MỌI dấu hiệu rằng người vận hành nhìn thấy màn hình của host và backend native
 * phục vụ được: không có tin cậy authority từ xa, bind loopback (tin cậy từ xa hoặc bind ngoài
 * loopback là đã nhận trình duyệt ở xa mà không trình chọn nào của hệ điều hành với tới), không
 * khởi động qua SSH (kết nối chuyển tiếp không hiển thị được trình chọn của server), và có phiên
 * hiển thị phục vụ được — mặc định đúng trên darwin/win32, đòi `DISPLAY`/`WAYLAND_DISPLAY` cộng
 * một binary chọn thư mục trên linux, và không bao giờ đúng ở nền tảng khác (native chỉ điều khiển
 * đúng darwin/win32/linux). Mọi trường hợp mập mờ đều về `browse`, thứ chạy được ở mọi nơi.
 * @param facts - dữ kiện host đã lấy mẫu.
 * @returns loại backend cần mount.
 */
export function resolveDirectoryPickerBackend(facts: DirectoryPickerHostFacts): DirectoryPickerBackendKind {
  if (facts.allowsRemoteAuthorities || !isLoopbackHost(facts.bindHost)) return "browse";
  if (facts.ssh) return "browse";
  if (facts.platform === "darwin" || facts.platform === "win32") return "native";
  if (facts.platform !== "linux" || !facts.linuxChooser) return "browse";
  return present(facts.env.DISPLAY) || present(facts.env.WAYLAND_DISPLAY) ? "native" : "browse";
}
