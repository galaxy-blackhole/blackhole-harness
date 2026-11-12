/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hình dạng tối thiểu của các module do bảng module cấp mà row này cần
 */

/** Node credential đã che mà thẻ SecretText vẽ. */
export interface MaskedSecretNode {
  /** Id luật đã sinh node. */
  id: string;
  /** Vị trí bắt đầu trong chữ gốc. */
  start: number;
  /** Vị trí kết thúc. */
  end: number;
  /** Dạng hiển thị đã che. */
  data: { masked: string };
}
