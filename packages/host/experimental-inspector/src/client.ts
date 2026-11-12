/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào phía client của inspector: tệp mỏng mô tả artifact lib/client.js do build.ts ghép từ 4 lát nguyên văn + thay id module
 */

/**
 * Nửa client CỦA TA của row experimental-inspector.
 *
 * `lib/client.js` KHÔNG được viết tay ở đây. `build.ts` ghép bốn lát NGUYÊN VĂN
 * `src/parts-client/part-00.ts` … `part-03.ts` (cùng phép bóc lát với `assembleClientParts()` và
 * `stripClientSlice` trong `assemble-client.ts`), rồi THAY id module stock trong dòng `id:`
 * của lời gọi đăng ký bằng `CLIENT_MODULE_ID` (xem `src/ids.ts`) trước khi ghi artifact. Vì vậy bốn
 * lát giữ nguyên id stock, còn artifact `lib/client.js` chỉ đăng ký đúng một id — id CỦA TA.
 *
 * Chỗ đăng ký module nằm ở dòng đầu của bundle đã ghép:
 *
 * ```js
 * window.__ModuleLoader__.load({
 *   id: PACKAGE_NAME,
 *   factory: (require) => { ... }
 * });
 * ```
 *
 * Cùng khuôn đó, `src/parts-client/client-page.ts` cấp `lib/client.page.js` mà factory nạp động qua
 * `require.async("./client.page.js")`.
 *
 * Tệp này cố ý KHÔNG re-export và KHÔNG chứa thân bundle: thân bundle là văn bản đã đóng gói, được đối
 * chiếu BYTE với bản gốc sau khi ghép; đưa nó vào chương trình `tsc` chỉ tạo lỗi cú pháp vô nghĩa.
 * Cổng rows đọc chuỗi `__ModuleLoader__.load` ngay trong khối này để thấy nơi đăng ký.
 */
export {};
