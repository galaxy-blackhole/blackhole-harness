/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ghép vỏ (client-wrapper.<phía>.json) + các lát thân ⇒ đúng văn bản bundle client gốc sau khi quy đổi id
 */
/** Vỏ + danh mục lát của một phía. */
export interface ClientWrapper {
    /** Dòng vỏ đầu (id đã đổi sang id của ta). */
    head: string[];
    /** Dòng vỏ cuối (gồm cả mảnh keo đẩy về). */
    tail: string[];
    /** Danh mục lát thân theo thứ tự. */
    parts: string[];
}
/**
 * Đọc vỏ + danh mục lát của một phía.
 * Nhận: side — "browser" hoặc "node".
 * Trả: ClientWrapper.
 */
export declare function readWrapper(side: string): ClientWrapper;
/**
 * Bỏ phần giao kèo của một lát thân (header · dấu · dòng trống · dòng kết thúc · vỏ hàm nếu có).
 * Nhận: source — nội dung file lát; fileName — tên file.
 * Trả: các dòng nguyên văn.
 */
export declare function stripPartScaffold(source: string, fileName: string): string[];
/**
 * Ghép một nửa client từ vỏ + các lát thân.
 * Nhận: side — "browser" hoặc "node"; partsDir — thư mục lát (mặc định src/client-parts/<side>).
 * Trả: văn bản bundle client.
 */
export declare function assembleClient(side: string, partsDir?: string): string;
