/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-experimental-inspector: ghép 5 lát host + 4 lát client (asset nguyên văn), đổi id module client, chép worker.js/devtools, CỔNG BYTE delta 0 rồi mới ghi lib/.
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";



import {
  CLIENT_MODULE_ID,
  HOST_PART_COUNT,
  PACKAGE_NAME,
  STOCK_CLIENT_MODULE_ID,
  STOCK_LIB_DIR,
  STOCK_PACKAGE_NAME,
} from "./src/ids.ts";

/** Gốc repo, tính từ gốc gói (packages/host/experimental-inspector ⇒ ba cấp lên). */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Ký tự xuống dòng LF — bundle gốc dùng LF, gặp CR trong lát nghĩa là lát đã bị sửa tay. */
const EOL = String.fromCharCode(10);

/** Dòng THROW GỐC của stock (HostBridgePublisher.setState) — mốc để đảo ngược sai lệch có chủ đích. */
const DEVIATION_GOC = '\t\tif (this.closed) throw new Error("inspector: Host source is closed");';

/** Khối FAIL-SOFT của ta thay cho dòng throw trên (task-152 · HANDOVER §8: ném làm chết host). */
const DEVIATION_HIEN_TAI = [
"\t\tif (this.closed) {",
"\t\t\t// SAI LỆCH CÓ CHỦ ĐÍCH (task-152 · HANDOVER §8): stock ném ở đây khi Worker chết (ECONNRESET) ⇒ fatal",
"\t\t\t// uncaught exception ⇒ host exit. Fail-soft: cảnh báo ĐÚNG MỘT LẦN rồi bỏ qua lần ghi để host sống.",
"\t\t\tif (!this.closedLogged) {",
"\t\t\t\tthis.closedLogged = true;",
"\t\t\t\tconsole.warn(\"inspector: Host source is closed — bo qua setState (fail-soft, tranh lam chet host)\");",
"\t\t\t}",
"\t\t\treturn;",
"\t\t}",
].join("\n");

/** Hai dòng FIELD thêm vào lớp (task-152): comment + `closedLogged = false;` — stock không có. */
const FIELD_LINES = [
"\t/** true khi đã cảnh báo lần đầu source closed (fail-soft: tránh ném làm chết host, chỉ warn 1 lần). */",
"\tclosedLogged = false;",
].join(EOL);

/** Khối field kèm dòng xuống trước nó (dùng để ĐẢO NGƯỢC khi canh byte). */
const FIELD_HIEN_TAI = EOL + FIELD_LINES;

/**
 * Đảo ngược SAI LỆCH CÓ CHỦ ĐÍCH của lát host về đúng stock: bỏ 2 dòng field `closedLogged`, thay khối
 * fail-soft bằng dòng throw gốc. NÉM nếu mỗi sai lệch xuất hiện ≠ 1 lần (không bao giờ canh nhầm bản đã lệch).
 * Nhận: text — văn bản ghép từ 5 lát host. Trả: văn bản đã đảo ngược sai lệch.
 */
/**
 * ÁP sai lệch có chủ đích lên văn bản ĐÃ KHỚP BYTE với stock (để artefact THẬT SỰ chứa fail-soft):
 * thêm 2 dòng field `closedLogged` và thay dòng throw bằng khối fail-soft (task-152).
 * Nhận: text — văn bản đã đảo ngược sai lệch (khớp stock). Trả: văn bản mang sai lệch.
 */
export function applyHostDeviation(text: string): string {
  const marker = "\tclosed = false;" + EOL;
  const index = text.indexOf(marker);
  if (index === -1) throw new Error("không thấy dòng `closed = false;` để áp sai lệch field (task-152)");
  const at = index + marker.length;
  const withField = text.slice(0, at) + FIELD_LINES + EOL + text.slice(at);
  return withField.split(DEVIATION_GOC).join(DEVIATION_HIEN_TAI);
}

/**
 * Đảo ngược SAI LỆCH CÓ CHỦ ĐÍCH của lát host: thay khối fail-soft bằng dòng throw gốc để cổng byte canh TỪNG BYTE
 * với stock. NÉM nếu mỗi sai lệch xuất hiện ≠ 1 lần (không bao giờ canh nhầm một bản đã lệch chỗ khác).
 * Nhận: text — văn bản ghép từ 5 lát host. Trả: văn bản đã đảo ngược sai lệch.
 */
export function normalizeHostDeviation(text: string): string {
  const fieldCount = text.split(FIELD_HIEN_TAI).length - 1;
  if (fieldCount !== 1) throw new Error("lát host phải có ĐÚNG 1 khối field closedLogged (task-152), thấy " + String(fieldCount));
  const blockCount = text.split(DEVIATION_HIEN_TAI).length - 1;
  if (blockCount !== 1) throw new Error("lát host phải có ĐÚNG 1 khối fail-soft (task-152), thấy " + String(blockCount));
  // 20/10/2026: quy MỌI tên global brand của ta (`__GBH_*`) về stock trước khi so byte — artefact chỉ khác
  // bản gốc ở TÊN brand, không đổi logic. (Trước đây chỉ quy `__GBH_BOOT__` nên thiếu `__GBH_INSPECTOR__`.)
  const quyTen = text.split("__GBH_").join("__DSH_");
  const restored = quyTen.split(FIELD_HIEN_TAI).join("").split(DEVIATION_HIEN_TAI).join(DEVIATION_GOC);
  return restored.endsWith(EOL) ? restored : restored + EOL;
}

/** Ký tự tab mở đầu dòng đăng ký id của module loader trong bundle client. */
const TAB = String.fromCharCode(9);

/** Dấu đóng khối header bắt buộc ở đầu mỗi lát. */
const HEADER_END = "*/";

/** Dòng đánh dấu lát nguyên văn (miễn kiểm kiểu cho thân lát). */
const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS do bộ tách chèn vào cuối mỗi lát. */
const MODULE_TAIL = "export {};";

/** Dòng đánh dấu vỏ hàm của mảnh bị cắt giữa câu lệnh — gỡ CẢ DÒNG khi ghép (precedent ui-trajectory). */
const FRAGMENT_MARKER_LINE = /\/\/ __DSH_FRAGMENT_(?:BEGIN|END)__\s*$/u;

/** Số lát client theo kế hoạch de-bundle (README §Cấu trúc port: 4 lát). */
const CLIENT_PART_COUNT = 4;

/** Tên lát trang client — KHÔNG nằm trong danh mục lát của bundle client.js. */
export const CLIENT_PAGE_PART = "client-page.ts";

/** Dòng đăng ký id GỐC trong bundle client (tab ở đầu dòng, dấu phẩy ở cuối). */
const STOCK_REGISTRATION_LINE = TAB + 'id: "' + STOCK_CLIENT_MODULE_ID + '",';

/** Dòng đăng ký id CỦA TA trong bundle client (cùng khuôn với dòng gốc). */
const OUR_REGISTRATION_LINE = TAB + 'id: "' + CLIENT_MODULE_ID + '",';

/** Thứ tự thử các kiểu ghép: thô trước, rồi chuẩn hoá dòng cuối, rồi cắt dòng trống biên. */
const JOIN_MODES: readonly JoinMode[] = ["raw", "line", "edge"];

/** Cách ghép lát khi dựng lại văn bản gốc. */
export type JoinMode = "raw" | "line" | "edge";

/** Một bộ lát đã đọc từ đĩa, sẵn sàng ghép. */
export interface PartSet {
  /** Thư mục chứa lát. */
  readonly dir: string;
  /** Tên các lát theo ĐÚNG thứ tự ghép (đã sắp xếp từ điển). */
  readonly files: readonly string[];
  /** Thân nguyên văn của từng lát (đã bỏ phần giao kèo). */
  readonly bodies: readonly (readonly string[])[];
}

/** Kết quả ghép + đối chiếu byte của một bộ lát. */
export interface AssemblyMatch {
  /** Văn bản đã ghép SAU phép chuẩn hoá (ví dụ đổi id client). */
  readonly text: string;
  /** Văn bản thô trước phép chuẩn hoá. */
  readonly raw: string;
  /** Kiểu ghép đã khớp cổng byte. */
  readonly mode: JoinMode;
}

/** Tuỳ chọn của cổng byte. */
export interface GateOptions {
  /** Số byte của bản gốc stock (mặc định bằng số byte bản kỳ vọng). */
  readonly stockBytes?: number;
  /** Ghi chú in kèm trong báo cáo. */
  readonly note?: string;
}

/** Số đo cổng byte của một artefact. */
export interface ByteGateReport {
  /** Tên artefact trong lib. */
  readonly name: string;
  /** Số byte bản của ta. */
  readonly bytes: number;
  /** Số byte bản gốc stock (trước khi đổi id, nếu có). */
  readonly stockBytes: number;
  /** Số byte bản kỳ vọng (stock đã quy đổi nếu có). */
  readonly expectedBytes: number;
  /** Số byte lệch so với bản kỳ vọng — phải là 0. */
  readonly delta: number;
  /** sha256 bản của ta. */
  readonly sha256: string;
  /** sha256 bản kỳ vọng. */
  readonly expectedSha256: string;
  /** Ghi chú đo được (kiểu ghép, số lần đổi id...). */
  readonly note: string;
}

/** Số đo một lần copy nguyên văn (tệp hoặc cây thư mục). */
export interface CopyReport {
  /** Tên artefact trong lib (dùng để in báo cáo). */
  readonly name: string;
  /** Đường dẫn nguồn CHỈ ĐỌC đã copy. */
  readonly source: string;
  /** Số tệp đã copy. */
  readonly files: number;
  /** Tổng số byte đã copy. */
  readonly bytes: number;
  /** Số byte lệch sau copy — phải là 0. */
  readonly delta: number;
  /** sha256 của tệp, hoặc sha256 manifest (đường dẫn + nội dung) với cây thư mục. */
  readonly sha256: string;
}

/** Tuỳ chọn build (đường dẫn ghi đè dùng cho test/soak). */
export interface BuildOptions {
  /** Thư mục đích (mặc định lib/ của gói). */
  readonly outDir?: string;
  /** Thư mục lát host (mặc định src/parts-host). */
  readonly hostPartsDir?: string;
  /** Thư mục lát client (mặc định src/parts-client). */
  readonly clientPartsDir?: string;
}

/** Báo cáo đầy đủ của một lượt build. */
export interface BuildReport {
  /** Id package của ta. */
  readonly packageName: string;
  /** Id package gốc bị thay thế. */
  readonly stockPackageName: string;
  /** Thư mục đã ghi artefact. */
  readonly outDir: string;
  /** Tên 5 lát host theo thứ tự ghép. */
  readonly hostFiles: readonly string[];
  /** Tên 4 lát client theo thứ tự ghép. */
  readonly clientFiles: readonly string[];
  /** Kiểu ghép đã khớp cổng byte của host. */
  readonly hostMode: JoinMode;
  /** Kiểu ghép đã khớp cổng byte của client. */
  readonly clientMode: JoinMode;
  /** Kiểu ghép đã khớp cổng byte của trang client. */
  readonly pageMode: JoinMode;
  /** Số lần id stock được đổi sang id của ta trong client.js. */
  readonly clientIdSwaps: number;
  /** Số id module đã thay trong client.page.js. */
  readonly pageIdSwaps: number;
  /** Số đo ba artefact ghép (index.js · client.js · client.page.js). */
  readonly artifacts: readonly ByteGateReport[];
  /** Số đo hai artefact copy (worker.js · devtools/). */
  readonly copies: readonly CopyReport[];
}

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Tìm byte lệch đầu tiên giữa hai buffer; một bên là tiền tố của bên kia thì trả độ dài bên ngắn.
 * Nhận: left — buffer bản ghép; right — buffer bản gốc.
 * Trả: chỉ số byte lệch đầu tiên (0-based).
 */
export function firstByteDifference(left: Uint8Array, right: Uint8Array): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return limit;
}

/**
 * Đếm số byte lệch giữa hai buffer: số vị trí khác nhau cộng chênh lệch độ dài.
 * Nhận: left — buffer bản ghép; right — buffer bản gốc.
 * Trả: 0 khi hai buffer giống hệt từng byte; ngược lại là số byte lệch.
 */
export function byteDelta(left: Uint8Array, right: Uint8Array): number {
  const limit = Math.min(left.length, right.length);
  let delta = Math.abs(left.length - right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) delta += 1;
  }
  return delta;
}

/**
 * Bỏ phần GIAO KÈO của một lát: khối header 5 dòng, dòng `// @ts-nocheck`, một dòng trống phân cách
 * sau dấu, một dòng trống phân cách trước dòng `export {};`, chính dòng đó, và các dòng đánh dấu vỏ mảnh.
 * Thân còn lại là NGUYÊN VĂN bundle gốc — không thêm, không bớt dòng nội dung nào.
 * Nhận: source — toàn văn tệp lát; fileName — tên tệp (dùng cho thông báo lỗi).
 * Trả: các dòng nguyên văn của lát, đúng thứ tự.
 */
export function stripSliceScaffold(source: string, fileName: string): string[] {
  if (source.includes("\r")) throw new Error(fileName + ": lát chứa CR — bundle gốc dùng LF nên cổng byte sẽ đỏ");
  const lines = source.split(EOL);
  const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
  if (marker < 0) throw new Error(fileName + ": thiếu dòng đánh dấu lát nguyên văn");
  const hasHeader = lines.slice(0, marker).some((line) => line.trim() === HEADER_END);
  if (!hasHeader) throw new Error(fileName + ": thiếu khối header 5 dòng trước dòng đánh dấu lát");
  const tail = lines.lastIndexOf(MODULE_TAIL);
  if (tail < 0) throw new Error(fileName + ": thiếu dòng kết thúc module");
  if (tail <= marker) throw new Error(fileName + ": dòng kết thúc module phải nằm SAU dòng đánh dấu lát");
  let start = marker + 1;
  if ((lines[start] ?? "x").trim() === "") start += 1;
  let end = tail;
  if ((lines[end - 1] ?? "x").trim() === "") end -= 1;
  if (end < start) throw new Error(fileName + ": thân lát rỗng sau khi bỏ phần giao kèo");
  return lines.slice(start, end).filter((line) => !FRAGMENT_MARKER_LINE.test(line));
}

/**
 * Liệt kê các lát `.ts` trong một thư mục theo thứ tự từ điển (tên part-00…part-NN đã zero-pad).
 * Nhận: dir — thư mục lát; excluded — tên tệp không phải lát (ví dụ client-page.ts).
 * Trả: danh sách tên tệp lát đã sắp xếp.
 */
export function listPartFiles(dir: string, excluded: readonly string[] = []): string[] {
  if (!existsSync(dir)) throw new Error("thiếu thư mục lát: " + dir);
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts"))
    .map((entry) => entry.name)
    .filter((name) => !excluded.includes(name) && name !== "index.ts")
    .sort();
  if (files.length === 0) throw new Error("thư mục lát rỗng: " + dir);
  return files;
}

/**
 * Đọc trọn một bộ lát: kiểm ĐÚNG số lượng, bóc phần giao kèo từng lát, giữ thứ tự ghép.
 * Nhận: dir — thư mục lát; expectedCount — số lát bắt buộc; excluded — tên tệp không phải lát.
 * Trả: PartSet gồm tên tệp và thân nguyên văn từng lát.
 */
export function readPartSet(dir: string, expectedCount: number, excluded: readonly string[] = []): PartSet {
  const files = listPartFiles(dir, excluded);
  if (files.length !== expectedCount) {
    throw new Error("thư mục " + dir + ": cần ĐÚNG " + String(expectedCount) + " lát, đo được " + String(files.length) + " (" + files.join(", ") + ")");
  }
  const bodies = files.map((file) => stripSliceScaffold(readFileSync(join(dir, file), "utf8"), file));
  return { dir, files, bodies };
}

/**
 * Ghép thân các lát thành văn bản theo một kiểu ghép.
 * Nhận: bodies — thân lát theo thứ tự; mode — "raw" giữ nguyên dòng biên, "line" bỏ một dòng trống cuối
 * mỗi lát rồi chuẩn hoá dòng cuối theo bản gốc, "edge" cắt mọi dòng trống biên rồi chuẩn hoá dòng cuối;
 * endsWithEol — bản gốc có kết thúc bằng LF hay không.
 * Trả: văn bản đã ghép.
 */
export function joinParts(bodies: readonly (readonly string[])[], mode: JoinMode, endsWithEol: boolean): string {
  const normalized = bodies.map((body) => {
    const copy = [...body];
    if (mode === "edge") {
      while (copy.length > 0 && (copy[0] ?? "").trim() === "") copy.shift();
      while (copy.length > 0 && (copy[copy.length - 1] ?? "").trim() === "") copy.pop();
    } else if (mode === "line" && copy.length > 0 && (copy[copy.length - 1] ?? "").trim() === "") {
      copy.pop();
    }
    return copy;
  });
  let text = normalized.map((body) => body.join(EOL)).join(EOL);
  if (mode !== "raw") {
    if (endsWithEol && !text.endsWith(EOL)) text += EOL;
    if (!endsWithEol && text.endsWith(EOL)) text = text.slice(0, -1);
  }
  return text;
}

/**
 * Ghép lát rồi đối chiếu TỪNG BYTE với bản kỳ vọng; thử lần lượt ba kiểu ghép, kiểu nào khớp byte thì dùng.
 * Nhận: partSet — bộ lát đã đọc; expected — văn bản kỳ vọng; normalize — phép chuẩn hoá áp lên bản ghép
 * trước khi so (mặc định giữ nguyên).
 * Trả: AssemblyMatch gồm văn bản đã ghép, bản thô và kiểu ghép đã khớp.
 */
export function matchParts(
  partSet: PartSet,
  expected: string,
  normalize: (text: string) => string = (text) => text,
): AssemblyMatch {
  const expectedBytes = Buffer.from(expected, "utf8");
  const failures: string[] = [];
  for (const mode of JOIN_MODES) {
    const raw = joinParts(partSet.bodies, mode, expected.endsWith(EOL));
    const text = normalize(raw);
    const textBytes = Buffer.from(text, "utf8");
    if (textBytes.equals(expectedBytes)) return { text, raw, mode };
    failures.push(mode + ": " + String(textBytes.length) + " B, lệch byte đầu " + String(firstByteDifference(textBytes, expectedBytes)));
  }
  throw new Error(
    "CỔNG BYTE ĐỎ — " + partSet.dir + " (" + partSet.files.join(", ") + ") không ghép ra đúng bản kỳ vọng: " +
      failures.join(" · ") + " · kỳ vọng " + String(expectedBytes.length) + " B",
  );
}

/**
 * Cổng BYTE: so bản ghép với bản kỳ vọng, lệch một byte là ném lỗi; đạt thì trả số đo để in báo cáo.
 * Nhận: name — tên artefact; actual — văn bản bản ghép; expected — văn bản kỳ vọng; options — số byte stock
 * và ghi chú.
 * Trả: ByteGateReport với bytes/delta/sha256 của hai bên.
 */
export function gateBytes(name: string, actual: string, expected: string, options: GateOptions = {}): ByteGateReport {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  const delta = byteDelta(actualBytes, expectedBytes);
  if (delta !== 0) {
    throw new Error(
      name + ": CỔNG BYTE ĐỎ — bản ghép " + String(actualBytes.length) + " B / sha " + sha256(actual).slice(0, 16) +
        " · kỳ vọng " + String(expectedBytes.length) + " B / sha " + sha256(expected).slice(0, 16) +
        " · delta " + String(delta) + " B · lệch đầu tiên ở byte " + String(firstByteDifference(actualBytes, expectedBytes)),
    );
  }
  return {
    name,
    bytes: actualBytes.length,
    stockBytes: options.stockBytes ?? expectedBytes.length,
    expectedBytes: expectedBytes.length,
    delta,
    sha256: sha256(actual),
    expectedSha256: sha256(expected),
    note: options.note ?? "",
  };
}

/**
 * Khẳng định bundle client đã mang ĐÚNG MỘT dòng đăng ký id của ta và KHÔNG còn id stock.
 * Nhận: client — văn bản lib/client.js sau khi đổi id; swaps — số lần đã đổi (để báo lỗi).
 * Trả: không (ném khi sai).
 */
export function assertClientRegistration(client: string, swaps: number): void {
  const ours = client.split(OUR_REGISTRATION_LINE).length - 1;
  if (ours !== 1) {
    throw new Error("lib/client.js: dòng đăng ký id của ta phải xuất hiện ĐÚNG 1 lần, đo được " + String(ours) + " (đã đổi " + String(swaps) + " lần)");
  }
  const left = client.split(STOCK_CLIENT_MODULE_ID).length - 1;
  if (left !== 0) throw new Error("lib/client.js: còn " + String(left) + " lần id stock sau khi đổi");
}

/**
 * Khẳng định stock client.js đúng khuôn đã đo: một dòng đăng ký id và hai lần id stock (đăng ký + PACKAGE_ID).
 * Nhận: stockClient — văn bản stock lib/client.js.
 * Trả: không (ném khi stock trôi khỏi bản đã đo).
 */
export function assertStockRegistration(stockClient: string): void {
  const registration = stockClient.split(STOCK_REGISTRATION_LINE).length - 1;
  if (registration !== 1) {
    throw new Error("stock client.js: dòng đăng ký id phải xuất hiện ĐÚNG 1 lần, đo được " + String(registration));
  }
  const total = stockClient.split(STOCK_CLIENT_MODULE_ID).length - 1;
  if (total !== 2) {
    throw new Error("stock client.js: id stock phải xuất hiện ĐÚNG 2 lần (dòng đăng ký module + PACKAGE_ID), đo được " + String(total));
  }
}

/**
 * Copy NGUYÊN VĂN một tệp rồi so lại từng byte với nguồn.
 * Nhận: source — tệp nguồn CHỈ ĐỌC; dest — tệp đích; name — tên artefact để báo cáo.
 * Trả: CopyReport (1 tệp, bytes, delta 0, sha256).
 */
export function copyFileByteIdentical(source: string, dest: string, name: string): CopyReport {
  if (!existsSync(source)) throw new Error(name + ": không thấy nguồn chỉ đọc " + source);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(source, dest);
  const from = readFileSync(source);
  const to = readFileSync(dest);
  if (!from.equals(to)) {
    throw new Error(name + ": CỔNG BYTE ĐỎ sau copy — " + String(from.length) + " B nguồn vs " + String(to.length) + " B đích");
  }
  return { name, source, files: 1, bytes: from.length, delta: 0, sha256: createHash("sha256").update(from).digest("hex") };
}

/**
 * Liệt kê MỌI tệp trong một cây thư mục (đệ quy, đường dẫn tuyệt đối, đã sắp xếp).
 * Nhận: dir — thư mục gốc.
 * Trả: danh sách đường dẫn tệp theo thứ tự từ điển.
 */
export function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(dir);
  out.sort();
  return out;
}

/**
 * Copy NGUYÊN VĂN một cây thư mục rồi so lại từng byte từng tệp với nguồn.
 * Nhận: sourceDir — cây nguồn CHỈ ĐỌC; destDir — cây đích; name — tên artefact để báo cáo.
 * Trả: CopyReport (số tệp, tổng bytes, delta 0, sha256 manifest đường-dẫn+nội-dung).
 */
export function copyTreeByteIdentical(sourceDir: string, destDir: string, name: string): CopyReport {
  if (!existsSync(sourceDir)) throw new Error(name + ": không thấy cây nguồn chỉ đọc " + sourceDir);
  rmSync(destDir, { recursive: true, force: true });
  cpSync(sourceDir, destDir, { recursive: true });
  const files = listFilesRecursive(sourceDir);
  if (files.length === 0) throw new Error(name + ": cây nguồn rỗng " + sourceDir);
  const manifest = createHash("sha256");
  let bytes = 0;
  for (const file of files) {
    const rel = relative(sourceDir, file);
    const from = readFileSync(file);
    const to = readFileSync(join(destDir, rel));
    if (!from.equals(to)) {
      throw new Error(name + ": CỔNG BYTE ĐỎ sau copy ở " + rel + " — " + String(from.length) + " B nguồn vs " + String(to.length) + " B đích");
    }
    bytes += from.length;
    manifest.update(rel, "utf8").update(String.fromCharCode(0)).update(from);
  }
  return { name, source: sourceDir, files: files.length, bytes, delta: 0, sha256: manifest.digest("hex") };
}

/**
 * Dựng văn bản báo cáo cho người đọc: bytes · delta · sha256 · kiểu ghép · số lần đổi id.
 * Nhận: report — báo cáo build.
 * Trả: chuỗi nhiều dòng (mỗi artefact một dòng).
 */
export function renderReport(report: BuildReport): string {
  const lines: string[] = [];
  lines.push("CỔNG BYTE ĐẠT · " + report.packageName + " (thay " + report.stockPackageName + ")");
  for (const item of report.artifacts) {
    const stock = item.bytes === item.stockBytes ? "" : " · stock " + String(item.stockBytes) + " B";
    lines.push(
      "  " + item.name.padEnd(18, " ") + String(item.bytes).padStart(7, " ") + " B" + stock +
        " · delta " + String(item.delta) + " · sha256 " + item.sha256 + (item.note === "" ? "" : " · " + item.note),
    );
  }
  for (const item of report.copies) {
    lines.push(
      "  " + item.name.padEnd(18, " ") + String(item.bytes).padStart(7, " ") + " B · delta " + String(item.delta) +
        " · sha256 " + item.sha256 + " · " + String(item.files) + " tệp copy nguyên văn",
    );
  }
  lines.push(
    "  lát host: " + String(report.hostFiles.length) + " (" + report.hostFiles.join(", ") + ") · kiểu ghép " + report.hostMode,
  );
  lines.push(
    "  lát client: " + String(report.clientFiles.length) + " (" + report.clientFiles.join(", ") + ") · kiểu ghép " +
      report.clientMode + " · trang " + report.pageMode,
  );
  lines.push(
    "  id module client: " + String(report.clientIdSwaps) + " lần " + STOCK_CLIENT_MODULE_ID + " → " + CLIENT_MODULE_ID,
  );
  return lines.join(EOL);
}

/**
 * Build toàn bộ gói: ghép 5 lát host (cổng byte delta 0 với stock index.js), ghép 4 lát client + đổi id
 * module (cổng byte với stock.replaceAll(id)), dựng client.page.js từ lát trang (byte-identical), rồi mới
 * ghi lib/ và copy nguyên văn worker.js + devtools/ (so lại từng byte sau copy).
 * Nhận: options — BuildOptions HOẶC đường dẫn thư mục đích (chuỗi) để tương thích quy ước repo
 *   `buildPackage(outDir?: string)` (mặc định lib/, src/parts-host, src/parts-client).
 * Trả: BuildReport đầy đủ để in báo cáo.
 */
export function buildPackage(options: BuildOptions | string = {}): BuildReport {
  const resolved: BuildOptions = typeof options === "string" ? { outDir: options } : options;
  const outDir = resolved.outDir ?? join(import.meta.dir, "lib");
  const hostDir = resolved.hostPartsDir ?? join(import.meta.dir, "src", "parts-host");
  const clientDir = resolved.clientPartsDir ?? join(import.meta.dir, "src", "parts-client");
  const stockLib = join(REPO, STOCK_LIB_DIR);
  const stockHostPath = join(stockLib, "index.js");
  const stockClientPath = join(stockLib, "client.js");
  const stockPagePath = join(stockLib, "client.page.js");
  const stockWorkerPath = join(stockLib, "worker.js");
  const stockDevtoolsPath = join(stockLib, "devtools");
  for (const path of [stockHostPath, stockClientPath, stockPagePath, stockWorkerPath, stockDevtoolsPath]) {
    if (!existsSync(path)) throw new Error("không thấy nguồn chỉ đọc " + path);
  }
  const stockHost = readFileSync(stockHostPath, "utf8");
  const stockClient = readFileSync(stockClientPath, "utf8");
  const stockPage = readFileSync(stockPagePath, "utf8");
  assertStockRegistration(stockClient);
  const hostSet = readPartSet(hostDir, HOST_PART_COUNT);
  // Cổng byte canh TỪNG BYTE sau khi đảo ngược sai lệch có chủ đích (task-152: fail-soft source closed).
  const host = matchParts(hostSet, stockHost, normalizeHostDeviation);
  const hostReport = gateBytes("lib/index.js", host.text, stockHost, { note: "5 lát · kiểu ghép " + host.mode });

  // Cổng 2/3 — CLIENT: 4 lát + đổi id module, phải bằng ĐÚNG stock client.js đã replaceAll(id).
  const expectedClient = stockClient.split(STOCK_CLIENT_MODULE_ID).join(CLIENT_MODULE_ID);
  const clientSet = readPartSet(clientDir, CLIENT_PART_COUNT, [CLIENT_PAGE_PART]);
  // 20/10/2026: lát client đọc `__GBH_BOOT__` (vỏ của ta) thay vì `__DSH_BOOT__` ⇒ quy tên rồi mới so byte.
  const client = matchParts(clientSet, expectedClient, (text) =>
    text
      .split(STOCK_CLIENT_MODULE_ID)
      .join(CLIENT_MODULE_ID)
      // P3 (04/11/2026): lat client mang id MOI cua module ao store => quy nguoc truoc khi so byte.
      .split("@galaxy-blackhole/gbh-client-store")
      .join("@deepseek-ai/dsh-client-store")
      // P3 (04/11/2026): lát client của ta đã đổi id module ảo store sang id GBH ⇒ quy ngược trước khi so byte.
      .split("@galaxy-blackhole/gbh-client-store")
      .join("@galaxy-blackhole/gbh-client-store")
      .split("__GBH_")
      .join("__DSH_"));
  const swaps = client.raw.split(STOCK_CLIENT_MODULE_ID).length - 1;
  assertClientRegistration(client.text, swaps);
  const clientReport = gateBytes("lib/client.js", client.text, expectedClient, {
    stockBytes: Buffer.from(stockClient, "utf8").length,
    note: "4 lát · kiểu ghép " + client.mode + " · đổi " + String(swaps) + " id stock → id ta",
  });

  // Cổng 3/3 — PAGE: một lát nguyên văn, byte-identical với stock client.page.js (GIỮ id stock theo đề).
  const pageSource = readFileSync(join(clientDir, CLIENT_PAGE_PART), "utf8");
  const pageSet: PartSet = {
    dir: clientDir,
    files: [CLIENT_PAGE_PART],
    bodies: [stripSliceScaffold(pageSource, CLIENT_PAGE_PART)],
  };
  // Cổng 3/3 — PAGE: chunk của CÙNG module ⇒ phải đổi id stock sang id của ta (luật MỘT-ID).
  const expectedPage = stockPage.split(STOCK_CLIENT_MODULE_ID).join(CLIENT_MODULE_ID);
  const page = matchParts(pageSet, expectedPage, (text) => text.split(STOCK_CLIENT_MODULE_ID).join(CLIENT_MODULE_ID));
  const pageSwaps = page.raw.split(STOCK_CLIENT_MODULE_ID).length - 1;
  const pageReport = gateBytes("lib/client.page.js", page.text, expectedPage, { note: "1 lát · đổi " + String(pageSwaps) + " id module · byte-gate vs stock.replaceAll(id)" });

  // Mọi cổng đã xanh ⇒ mới ghi đích.
  mkdirSync(outDir, { recursive: true });
  // Artefact PHẢI mang sai lệch (fail-soft); cổng byte đã canh bản normalize ở trên.
  writeFileSync(join(outDir, "index.js"), applyHostDeviation(host.text), "utf8");
  writeFileSync(join(outDir, "client.js"), client.text, "utf8");
  writeFileSync(join(outDir, "client.page.js"), page.text, "utf8");
  const workerReport = copyFileByteIdentical(stockWorkerPath, join(outDir, "worker.js"), "lib/worker.js");
  const devtoolsReport = copyTreeByteIdentical(stockDevtoolsPath, join(outDir, "devtools"), "lib/devtools/");

  return {
    packageName: PACKAGE_NAME,
    stockPackageName: STOCK_PACKAGE_NAME,
    outDir,
    hostFiles: hostSet.files,
    clientFiles: clientSet.files,
    hostMode: host.mode,
    clientMode: client.mode,
    pageMode: page.mode,
    clientIdSwaps: swaps,
    pageIdSwaps: pageSwaps,
    artifacts: [hostReport, clientReport, pageReport],
    copies: [workerReport, devtoolsReport],
  };
}

/**
 * Biên dịch THẬT entry nửa client (`src/client.ts`) bằng Bun.build — bằng chứng build nửa client mà
 * cổng `tools/check/rows.ts` đòi cho gói khai `dsh.client` (2 lời gọi Bun.build trong build.ts).
 * Artefact byte-exact vẫn do bước ghép sinh (lib/client.js); các tệp dưới đây chỉ là artefact kiểm cú pháp.
 * Nhận: outDir — thư mục đích (lib/ hoặc thư mục build của tool mount). Trả: không (ném khi build lỗi).
 */
export async function buildClientEntries(outDir: string): Promise<void> {
  const entry = join(import.meta.dir, "src", "client.ts");
  const browser = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    target: "browser",
    format: "esm",
    naming: "client-entry.js",
    packages: "external",
  });
  if (!browser.success) throw new Error("build entry client (esm) thất bại: " + browser.logs.map((log) => String(log)).join(" | "));
  const iife = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    target: "browser",
    format: "iife",
    naming: "client-entry.iife.js",
    packages: "external",
  });
  if (!iife.success) throw new Error("build entry client (iife) thất bại: " + iife.logs.map((log) => String(log)).join(" | "));
}

if (import.meta.main) {
  const report = buildPackage({ outDir: process.argv[2] });
  await buildClientEntries(report.outDir);
  console.log(renderReport(report));
}