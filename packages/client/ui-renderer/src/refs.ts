/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc O tham chieu MUON giua scoped-slots / factories / outlets — cat vong import, khong phu thuoc thu tu module
 */
//
// Vì sao cần: ba tệp kia tạo thành một vòng (scoped-slots cần FactoryOutlet, factories cần helper của
// scoped-slots, outlets cần entry component của scoped-slots). Bun gộp module vào một phạm vi hàm nên
// vòng import "chạy được" NHỜ hoisting — nhưng đó là phụ thuộc vào chi tiết bộ đóng gói. Một ô tham chiếu
// được điền lúc LẮP RÁP (client.ts) làm quan hệ phụ thuộc TƯỜNG MINH và bền với mọi bộ đóng gói.

/** Ô tham chiếu tới `FactoryOutlet` (factories.ts) — do `createFactories` điền. */
export const FactoryOutletRef: { current: unknown } = { current: null };

/** Ô tham chiếu tới `SlotOutlet` (outlets.ts) — do `createOutlets` điền. */
export const SlotOutletRef: { current: unknown } = { current: null };
