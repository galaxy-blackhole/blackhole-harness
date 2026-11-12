/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh tính package + quy tắc thay OWNERSHIP trong 2 manifest typert của gói subagent:
 *      mọi trường `package:` phải là id CỦA TA; cổng byte + cổng ownership trong build.ts.
 */

/** Id package CỦA TA. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-subagent";

/** Tên gói GỐC trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte). */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-subagent";

/** Thư mục lib của bundle gốc. */
export const STOCK_LIB_DIR = "apps/host/node_modules/@deepseek-ai/dsh-subagent/lib";

/** Một artefact typert: entry trong src, file đích, số lần ownership phải thay. */
export interface FaceArtifact {
  /** Các phần trong src (mỗi phần một slice nguyên văn, ghép theo thứ tự). */
  readonly parts: readonly string[];
  /** Tên file trong lib. */
  readonly naming: string;
  /** File gốc tương ứng trong lib của stock. */
  readonly stockFile: string;
  /** Số trường ownership `package:` phải xuất hiện trong stock. */
  readonly occurrences: number;
}

/** Chuỗi ownership gốc. */
const STOCK_OWNERSHIP = "  package: '" + STOCK_PACKAGE_NAME + "',";

/** Chuỗi ownership của TA. */
const OUR_OWNERSHIP = "  package: '" + PACKAGE_NAME + "',";

/** Hai artefact typert NGUYÊN VĂN (byte-gate) của gói. */
export const FACE_ARTIFACTS: readonly FaceArtifact[] = [
  { parts: ["typert-host-slice-a.ts", "typert-host-slice-b.ts"], naming: "typert.host.js", stockFile: "typert.host.js", occurrences: 2 },
  { parts: ["typert-remote-client-slice.ts"], naming: "typert.remote-client.js", stockFile: "typert.remote-client.js", occurrences: 1 },
];

/** Cặp thay thế ownership dùng chung cho cả 2 manifest. */
export const OWNERSHIP_SWAP: readonly [string, string] = [STOCK_OWNERSHIP, OUR_OWNERSHIP];