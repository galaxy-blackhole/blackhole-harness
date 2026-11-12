/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-commands — mot id module, mot ten slot nguyen van, mot muc danh sach
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-commands";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio dang ky trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-commands";

/**
 * Namespace tu dien do plugin nay so huu (khop LocaleNamespaceMap.command cua ban goc).
 * Nhan: khong co.
 * Tra: chuoi namespace.
 */
export const LOCALE_NS = "command";

/**
 * Ten slot NGUYEN VAN ma ban goc chiem: lop phu cua hop soan tin.
 * Nhan: khong co.
 * Tra: chuoi ten slot.
 */
export const SLOT_NAME = "conversation.input.overlay";

/**
 * Id NGUYEN VAN cua muc trong slot kieu DANH SACH — ban goc dat "command-popup".
 * Thieu id nay thi slot danh sach nem 'requires options.id' => apply nem => ca trang chet.
 * Nhan: khong co.
 * Tra: chuoi id muc.
 */
export const SLOT_ENTRY_ID = "command-popup";

/**
 * Thu tu cua muc trong slot kieu danh sach — nguyen van tu ban goc.
 * Nhan: khong co.
 * Tra: so thu tu.
 */
export const SLOT_ENTRY_ORDER = 1;

/**
 * Nam dich vu bat buoc ma nua client can — nguyen van tu bundle goc.
 * Nhan: khong co.
 * Tra: mang ten dich vu.
 */
export const INJECT: readonly string[] = ["inputTriggers", "sessions", "remote", "remote.commands", "locale"];

/**
 * Ba dich vu ma khoi gan slot doi hoi truoc khi chay (nguyen van tu ban goc).
 * Nhan: khong co.
 * Tra: mang ten dich vu.
 */
export const SLOT_INJECT: readonly string[] = ["slots", "commandUi", "sessions"];

/**
 * Bon dich vu ma service commandUi doi hoi (nguyen van tu static inject cua ban goc).
 * Nhan: khong co.
 * Tra: mang ten dich vu.
 */
export const RUNTIME_INJECT: readonly string[] = ["inputTriggers", "sessions", "remote", "remote.commands"];

/**
 * Nhan hieu ung vong doi — giu nguyen van de doc log ra la biet ngay cho nao hong.
 * Nhan: khong co.
 * Tra: doi tuong nhan.
 */
export const EFFECT = {
  dictionaries: "ui-commands: dictionaries",
  source: "command: slash source",
  popup: "command: session popup",
  register: "command.register()",
  decorate: "command.decorate()",
} as const;

/**
 * Tran chieu cao cua the chon (cung ho MenuDropdown voi menu '/').
 * Nhan: khong co.
 * Tra: so pixel.
 */
export const MAX_HEIGHT = 320;

/**
 * Duoi duong dan module CSS ma the style tu khai — giu nguyen khuon cua ban goc de khong nhay hai lan.
 * Nhan: khong co.
 * Tra: chuoi duoi duong dan.
 */
export const STYLE_TAG_SUFFIX = "/PopupSelectView.module.css";

/**
 * Nhan cua tuy chon source khi giu mot phien qua mot lan goi RPC danh muc.
 * Nhan: khong co.
 * Tra: chuoi nhan.
 */
export const CATALOG_SOURCE = "commandCatalog";

/**
 * Ten su kien ma service phat khi mot lenh duoc thuc thi xong (nguyen van tu ban goc).
 * Nhan: khong co.
 * Tra: chuoi ten su kien.
 */
export const EXECUTED_EVENT = "command/executed";

/**
 * Ten su kien ma hop soan tin nghe de tieu thu token (nguyen van tu ban goc).
 * Nhan: khong co.
 * Tra: chuoi ten su kien.
 */
export const CONSUME_EVENT = "slash/input-consume-token";

/**
 * Ba su kien ma service nghe o tang goc (nguyen van tu ban goc).
 * Nhan: khong co.
 * Tra: doi tuong nhan su kien.
 */
export const EVENTS = {
  commandsChange: "commands/change",
  presetSelected: "agent-preset/selected",
  connectionReset: "connection/reset",
} as const;
