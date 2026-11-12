/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao nua client cua row ui-trajectory — ghep 12 lat NGUYEN VAN cua bundle goc thanh MOT bundle
 */

// Nua client cua row nay KHONG phai mot module ESM binh thuong: bundle goc la MOT pham vi ham phang
// (12 lat tham chieu ten cua nhau khong qua import), nen build.ts phai GHEP VAN BAN roi moi giao cho
// Bun.build. Vi vay diem vao nay xuat dung bon ham ghep/boc ma build.ts dung, va giu nguyen van loi goi
// dang ky module (window.__ModuleLoader__.load) trong ma nguon de cong check:rows doc duoc.
export {
  ENTRY_FILE_NAME,
  assembleBundleBody,
  assembleBundleFromDisk,
  countPlaceholder,
  embedCss,
  readCssSource,
  stripPartScaffold,
  wrapClientBundle,
  type ReadFileFn,
} from "./assemble.ts";
export { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "./ids.ts";
