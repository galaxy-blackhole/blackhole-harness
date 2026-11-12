/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 gói THƯ VIỆN @galaxy-blackhole/gbh-util-crypto (UUID v4 + base64 an toàn mọi
 *      môi trường JS mà repo này chạy tới). Bản gốc 35 dòng, zero-dependency, 2 export.
 */

/**
 * Mã hoá bytes thành base64 CHUẨN, không vượt giới hạn số tham số của hàm.
 * Vì sao chia lô 32 KiB: `String.fromCharCode(...data)` ném RangeError khi mảng quá lớn
 * (giới hạn ngăn xếp của engine), nên phải ghép theo từng khối — y hệt bản gốc.
 * @param data - Bytes cần mã hoá.
 * @returns chuỗi base64.
 */
export function bytesToBase64(data: Uint8Array): string {
  let binary = "";
  const chunk = 32768;
  for (let offset = 0; offset < data.length; offset += chunk) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

/**
 * Sinh UUID v4 từ `crypto.getRandomValues`.
 * Vì sao KHÔNG dùng `crypto.randomUUID`: đó là Web API chỉ có trong secure context — trang hoặc worker
 * phục vụ qua HTTP thường trên địa chỉ LAN không có hàm này, còn `getRandomValues` thì mọi nơi đều có
 * (browser, worker, Node ≥ 19). Bản gốc ghi đúng lý do này trong JSDoc của nó.
 * @returns chuỗi UUID.
 */
export function randomUUID(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte, index) => {
    return (index === 6 ? (byte & 15) | 64 : index === 8 ? (byte & 63) | 128 : byte).toString(16).padStart(2, "0");
  }).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
