/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua node cua @galaxy-blackhole/gbh-client-resources: row nay khong dong gop gi cho cay host
 */

/**
 * Nửa host của mô hình resource: không đóng góp gì cho cây plugin host (mô hình nằm ở nửa browser).
 * Nhận: không.
 * Trả: không.
 */
export function apply(): void {}

/** Export mặc định để row §resources§ mount được lớp plugin này. */
export default apply;
