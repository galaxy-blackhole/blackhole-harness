/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh tính package (của ta + gốc) và QUY TẮC THAY THẾ của 3 artefact hai mặt:
 *      client thay id module, 2 manifest typert thay MỌI trường ownership "package" — typeSymbol giữ nguyên.
 */

/** Id package CỦA TA. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-api-workspace-controller";

/** Tên gói GỐC trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte). */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-api-workspace-controller";

/** Id module client CỦA TA (gbh.row.moduleIds). */
export const CLIENT_MODULE_ID = PACKAGE_NAME;

/** Id module client của bản gốc (gbh.row.aliases). */
export const STOCK_CLIENT_MODULE_ID = STOCK_PACKAGE_NAME;

/** Thư mục lib của bundle gốc. */
export const STOCK_LIB_DIR = "apps/host/node_modules/@deepseek-ai/dsh-api-workspace-controller/lib";

/** Một artefact của gói hai mặt: entry trong src, tên file đích, và phép thay thế ownership/id so với stock. */
export interface FaceArtifact {
  /** Entry trong src (chứa slice nguyên văn). */
  readonly entry: string;
  /** Tên file trong lib. */
  readonly naming: string;
  /** File gốc tương ứng trong lib của stock. */
  readonly stockFile: string;
  /** Chuỗi CẦN thay trong bản gốc để được artefact của ta. */
  readonly replaceFrom: string;
  /** Chuỗi thay vào. */
  readonly replaceTo: string;
  /** Số lần chuỗi trên phải xuất hiện trong stock (typert.host có HAI trường ownership). */
  readonly occurrences: number;
}

/** Ký tự tab (dòng id module trong bundle client bắt đầu bằng tab). */
const TAB = String.fromCharCode(9);

/** Chuỗi ownership trong manifest typert: hai dấu cách + package. */
const OWNERSHIP = "  package: '";

/** Chuỗi ownership đầy đủ của stock (kết thúc bằng dấu phẩy + nháy đơn). */
const STOCK_OWNERSHIP = OWNERSHIP + STOCK_PACKAGE_NAME + "',";

/** Chuỗi ownership đầy đủ của TA. */
const OUR_OWNERSHIP = OWNERSHIP + PACKAGE_NAME + "',";

/** Ba artefact NGUYÊN VĂN (byte-gate) của gói hai mặt. */
export const FACE_ARTIFACTS: readonly FaceArtifact[] = [
  {
    entry: "client.ts",
    naming: "client.js",
    stockFile: "client.js",
    replaceFrom: TAB + 'id: "' + STOCK_CLIENT_MODULE_ID + '",',
    replaceTo: TAB + 'id: "' + CLIENT_MODULE_ID + '",',
    occurrences: 1,
  },
  {
    entry: "typert-host-slice.ts",
    naming: "typert.host.js",
    stockFile: "typert.host.js",
    replaceFrom: STOCK_OWNERSHIP,
    replaceTo: OUR_OWNERSHIP,
    occurrences: 2,
  },
  {
    entry: "typert-remote-client-slice.ts",
    naming: "typert.remote-client.js",
    stockFile: "typert.remote-client.js",
    replaceFrom: STOCK_OWNERSHIP,
    replaceTo: OUR_OWNERSHIP,
    occurrences: 1,
  },
];