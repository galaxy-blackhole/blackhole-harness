/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bảng định danh của row ui-cordis: id module CỦA TA, id gói gốc (chỉ đối chiếu), seam inject và nhãn hiệu ứng — giữ nguyên chuỗi của bản gốc
 */

/**
 * Id MODULE chính — package của ta. Artifact client tự khai ĐÚNG MỘT id này trong
 * `__ModuleLoader__.load`, nên đây là dòng mà manifest của Host trỏ tới và là `ownerId` để HMR tra `rev`.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-cordis";

/**
 * Id MODULE của gói GỐC — CHỈ để đối chiếu trong README.
 * ⚠️ KHÔNG BAO GIỜ truyền vào `load()`: LUẬT MỘT-ID (một bundle mà hai id ⇒ bundle chạy hai lần ⇒ duplicate
 * factory registration ⇒ #root 0 ký tự). Id gốc chỉ được khai ở `gbh.row.aliases` khi Lead khai row.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-cordis";

/**
 * Seam mà plugin khai với Loader phía browser — ĐÚNG THỨ TỰ và ĐÚNG TÊN như bản gốc (5 mục).
 * ⚠️ KHÁC `dsh.client.inject` trong package.json (8 id PACKAGE, thứ tự khác): hai danh sách KHÔNG liên quan.
 */
export const INJECT: string[] = [
  "slots",
  "locale",
  "remote",
  "remote.dynamicCordisRunner",
  "dynamicCordisRunner",
];

/** Nhãn hiệu ứng đăng ký hai bản dịch (giữ nguyên chuỗi của bản gốc). */
export const DICTIONARY_EFFECT_LABEL = "ui-cordis: dictionaries";

/** Nhãn hiệu ứng đối chiếu phê duyệt đang chờ (giữ nguyên chuỗi của bản gốc). */
export const RECONCILE_EFFECT_LABEL = "ui-cordis: reconcile pending approvals";

/** Tiền tố log khi đọc inventory hỏng (giữ nguyên chuỗi của bản gốc để chẩn đoán không lệch). */
export const INVENTORY_ERROR_LABEL = "[ui-cordis] reading the Cordis inventory failed:";

/**
 * Vì sao tên slot trong `plugin.ts` là CHUỖI LITERAL chứ không phải hằng:
 * cổng `check:rows` đọc tên slot từ mã nguồn bằng chuỗi literal (`name: "tool.call.toolview"`); viết qua hằng
 * thì cổng coi là "thiếu đăng ký slot" và gói bị bỏ qua khi mount. Ba slot row này chiếm:
 * `sidebar.footer.action`, `tool.call.toolview`, `tool.view.cordis`.
 */
