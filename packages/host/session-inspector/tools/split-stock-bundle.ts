/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cắt bundle gốc của row session-inspector thành các lát nguồn ≤ ngân sách dòng, giữ nguyên từng byte
 */

/**
 * ⚠️ 18/10/2026 — KHỐI HEADER PHẢI ĐÓNG TRONG ≤ 24 DÒNG: tools/lint/header.ts chỉ dò DẤU ĐÓNG BÌNH LUẬN
 * trong 24 dòng kể từ dòng mở, nên một header dài 29 dòng bị cổng lint:header báo "thiếu khối header". Vì vậy
 * phần giải thích dài nằm ở khối RIÊNG này; header ở trên giữ ĐÚNG 5 trường theo AGENTS.md §1.
 *
 * Nguồn đối chiếu (CHỈ ĐỌC): apps/host/node_modules/@deepseek-ai/dsh-experimental-session-inspector/lib/client.js
 * Cách dùng: bun run tools/split-stock-bundle.ts <đường-dẫn-bundle> [thư-mục-đích]
 *
 * Vì sao cắt theo `//#region`: bundle gốc do tsdown sinh ra còn nguyên dấu vùng của từng file nguồn
 * upstream, nên mỗi vùng là một đơn vị cú pháp trọn vẹn — cắt ở đó không làm đứt câu lệnh.
 *
 * ⚠️ 18/10/2026 — HAI BÀI HỌC ĐO ĐƯỢC, KHÔNG PHẢI PHÒNG XA:
 *   1. Bản đầu cắt ở "đầu câu lệnh cấp cao nhất" và lui về "dòng trống" khi bí. Hai nhát cắt đã rơi vào
 *      GIỮA một hàm ⇒ part-08/part-09 mất cân bằng ngoặc ⇒ tsc báo TS1005/TS1128 (22 dòng), cổng
 *      typecheck ĐỎ. @ts-nocheck KHÔNG cứu được lỗi CÚ PHÁP.
 *   2. Nhưng cắt ở độ sâu 0 KHÔNG ĐỦ: vùng TrajectoryTable.js chứa MỘT câu lệnh dài 1122 dòng
 *      (một component khổng lồ) — không có dòng nào ở độ sâu 0 bên trong nó.
 *
 * Cách giải: mỗi lát được ĐÓNG/MỞ lại vỏ ngoặc của nó bằng hai DÒNG ĐÁNH DẤU mà build.ts gỡ ra khi
 * ghép, nên văn bản ghép lại vẫn NGUYÊN VĂN từng byte:
 *      // __GBH_FRAGMENT_BEGIN__{{{        ← mở lại đúng số ngoặc móc đang mở ở đầu lát
 *      … dòng nguyên văn của bundle gốc …
 *      }}}// __GBH_FRAGMENT_END__          ← đóng lại đúng số ngoặc móc đang mở ở cuối lát
 * Nhờ vậy mỗi file .ts là một module HỢP LỆ (một khối lệnh trần ở cấp module là cú pháp hợp lệ),
 * tsc đọc được, mà nội dung thì vẫn là bản gốc. Chỉ cắt khi ngoặc TRÒN/VUÔNG đã đóng (0) — vỏ chỉ
 * bù được ngoặc MÓC.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FRAGMENT_BEGIN_MARKER, FRAGMENT_END_MARKER } from "../src/manifest.ts";

/** Ngưỡng dòng cho phần thân của một lát (chừa chỗ cho header 5 dòng + @ts-nocheck + hai dòng đánh dấu). */
export const PART_LINE_BUDGET = 880;

/** Dòng mở vỏ của một lát; build.ts gỡ đúng dòng khớp khuôn này khi ghép. */
export const FRAGMENT_BEGIN = FRAGMENT_BEGIN_MARKER;

/**
 * Đầu vỏ hàm của một lát cắt GIỮA một câu lệnh.
 * ⚠️ 18/10/2026: vỏ phải là HÀM chứ không phải khối trần. Vỏ khối trần làm mảnh rơi vào phạm vi
 * module, nơi `return` KHÔNG hợp lệ ⇒ tsc báo TS1128 ngay tại dòng đóng của mảnh. Trong thân hàm thì
 * mọi câu lệnh của bundle gốc đều hợp lệ, còn các khai báo vẫn chỉ là khai báo trong một hàm không
 * bao giờ được gọi (vỏ bị gỡ khi ghép nên không ảnh hưởng bản chạy).
 */
export const FRAGMENT_WRAPPER = "function __gbh_fragment__() {";

/** Dòng đóng vỏ ngoặc của một lát; build.ts gỡ đúng dòng khớp khuôn này khi ghép. */
export const FRAGMENT_END = FRAGMENT_END_MARKER;

/**
 * Dựng văn bản một mảnh ĐỨNG RIÊNG: dòng mở (kèm dấu đánh dấu ở CUỐI dòng), thân, rồi dòng đóng.
 * Dùng chung cho cả phép thử cú pháp và lúc ghi file, nên hai bên không thể lệch nhau.
 * @param opens - chuỗi dấu mở thêm (rỗng = không bọc).
 * @param text - thân mảnh, nguyên văn.
 * @param closes - chuỗi dấu đóng thêm (rỗng = không thêm gì).
 * @returns văn bản hoàn chỉnh của mảnh khi đứng riêng.
 */
export function renderPiece(opens: string, text: string, closes: string): string {
  const openLine = (opens === "" ? "" : opens + " ") + FRAGMENT_BEGIN;
  const closeLine = (closes === "" ? "" : closes + " ") + FRAGMENT_END;
  return openLine + "\n" + text + "\n" + closeLine;
}

/** Khối header 5 dòng bắt buộc của repo, in vào mọi lát để bản cắt cũng tự khai nguồn. */
const HEADER: readonly string[] = [
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-experimental-session-inspector/lib/client.js (xem tools/split-stock-bundle.ts)",
  " */",
];

/** Các từ khoá mở đầu một mệnh đề KHÔNG được đứng đầu một lát (nối tiếp câu lệnh trước). */
const CONTINUATIONS: readonly string[] = ["else", "catch", "finally", "while", "case", "default"];

/**
 * Ký tự cuối dòng khiến nhát cắt bị đứt giữa BIỂU THỨC — không được cắt ngay sau đó.
 * ⚠️ 18/10/2026: KHÔNG liệt kê "," và "{" vào đây. Cắt sau một dấu phẩy hay một ngoặc mở là HỢP LỆ vì
 *   vỏ hàm đóng lại bằng "}" — dấu phẩy cuối trong object/array là cú pháp hợp lệ, còn ngoặc tròn/vuông
 *   thì đã bị luật độ sâu loại từ trước (chúng phải bằng 0 ở đầu dòng cắt). Liệt kê thừa hai ký tự này
 *   làm công cụ không tìm được nhát cắt nào trong component 1122 dòng.
 */
const TRAILING_OPENERS = new Set<string>(["=", "+", "-", "*", "/", "%", "&", "|", "^", "~", "!", "<", ">", ".", ":", "?", "\\"]);

/** Ký tự đầu dòng khiến nhát cắt bị đứt giữa biểu thức — không được cắt ngay trước đó. */
const LEADING_OPENERS = /^[A-Za-z_$({"\[\x27`]/;

/** Một vùng nguồn trong bundle gốc. */
export interface Region {
  /** Tên vùng, ví dụ lib/types/client/TrajectoryTable.js. */
  readonly name: string;
  /** Các dòng nguyên văn của vùng, kể cả hai dòng đánh dấu //#region / //#endregion. */
  readonly lines: readonly string[];
}

/** Trạng thái của bộ quét: một NGĂN XẾP khung, vì template literal lồng được biểu thức vào trong. */
interface Frame {
  /** Loại khung: mã, chuỗi, biểu thức chính quy, bình luận, template. */
  kind: "code" | "string" | "regex" | "lineComment" | "blockComment" | "template";
  /** Số ngoặc móc đang mở trong khung mã này. */
  brace: number;
  /** Số ngoặc tròn đang mở trong khung mã này. */
  paren: number;
  /** Số ngoặc vuông đang mở trong khung mã này. */
  bracket: number;
  /** Khung mã này mở ra từ \$ { của một template literal (gặp } là quay lại template). */
  fromTemplate: boolean;
  /** Ký tự mở chuỗi khi kind = "string". */
  quote: string;
}

/** Ảnh chụp trạng thái ở ĐẦU một dòng — đủ để quyết định nhát cắt. */
export interface LineDepth {
  /** Số ngoặc móc đang mở ở đầu dòng. */
  readonly brace: number;
  /** Số ngoặc tròn đang mở ở đầu dòng. */
  readonly paren: number;
  /** Số ngoặc vuông đang mở ở đầu dòng. */
  readonly bracket: number;
  /** Chuỗi các dấu NGOẶC ĐANG MỞ theo đúng thứ tự mở, ví dụ "{([" — dùng để đóng lại đúng thứ tự. */
  readonly delims: string;
  /** true khi đầu dòng không nằm trong chuỗi/bình luận/template literal. */
  readonly clean: boolean;
}

/** Ký tự ngay trước đó khiến một dấu / được hiểu là mở biểu thức chính quy (chứ không phải phép chia). */
const REGEX_PRECEDERS = new Set<string>(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "~", "^", "<", ">"]);

/** Một khung mã mới ở trạng thái rỗng. */
function codeFrame(fromTemplate: boolean): Frame {
  return { kind: "code", brace: 0, paren: 0, bracket: 0, fromTemplate, quote: "" };
}

/**
 * Cộng dồn ngoặc của mọi khung mã đang mở trong ngăn xếp.
 * @param stack - ngăn xếp khung.
 * @returns tổng số ngoặc móc/tròn/vuông đang mở.
 */
function totals(stack: readonly Frame[]): { brace: number; paren: number; bracket: number } {
  let brace = 0;
  let paren = 0;
  let bracket = 0;
  for (const frame of stack) {
    if (frame.kind !== "code") continue;
    brace += frame.brace;
    paren += frame.paren;
    bracket += frame.bracket;
  }
  return { brace, paren, bracket };
}

/**
 * Chụp trạng thái ngoặc ở ĐẦU mỗi dòng của một vùng.
 *
 * ⚠️ 18/10/2026 — VÌ SAO TỰ VIẾT BỘ QUÉT NÀY (sau khi hai cách khác ĐÃ SAI, đo được):
 *   · Cách 1 (đếm ngoặc thô): chuỗi/bình luận/template làm lệch ⇒ đóng thừa một ngoặc ⇒ tsc TS1128.
 *   · Cách 2 (bộ quét token của TypeScript, không có bộ phân tích đi kèm): template literal LỒNG NHAU
 *     làm bộ quét mất đồng bộ (một TemplateHead nuốt 5 KB văn bản) ⇒ mọi dòng bị coi là "bẩn".
 *   · Cách 3 (cách này): ngăn xếp khung, trong đó \$ { của template MỞ một khung mã và } ĐÓNG khung đó
 *     để quay lại template — đúng như đặc tả; ngoài ra vẫn có phép thử cú pháp ở findWrapping làm quan toà.
 * @param lines - các dòng của vùng.
 * @returns mảng ảnh chụp, cùng độ dài với lines; phần tử [i] là trạng thái ở ĐẦU dòng i.
 */
export function scanDepths(lines: readonly string[]): LineDepth[] {
  const text = lines.join("\n");
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  const stack: Frame[] = [codeFrame(false)];
  const delims: string[] = [];
  const out: LineDepth[] = [];
  let line = 0;
  let previous = "";
  let i = 0;
  while (line < lines.length) {
    const at = starts[line] as number;
    while (i < at) i += 1;
    const total = totals(stack);
    const top = stack[stack.length - 1] as Frame;
    out.push({ brace: total.brace, paren: total.paren, bracket: total.bracket, delims: delims.join(""), clean: stack.length === 1 && top.kind === "code" });
    // Quét hết dòng này.
    const lineEnd = at + (lines[line] as string).length;
    while (i < lineEnd) {
      const ch = text[i] as string;
      const next = text[i + 1] ?? "";
      const frame = stack[stack.length - 1] as Frame;
      if (frame.kind === "lineComment") {
        i += 1;
        continue;
      }
      if (frame.kind === "blockComment") {
        if (ch === "*" && next === "/") {
          stack.pop();
          i += 2;
          continue;
        }
        i += 1;
        continue;
      }
      if (frame.kind === "string") {
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (ch === frame.quote) stack.pop();
        i += 1;
        continue;
      }
      if (frame.kind === "regex") {
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (ch === "/") stack.pop();
        i += 1;
        continue;
      }
      if (frame.kind === "template") {
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (ch === "`") {
          stack.pop();
          i += 1;
          continue;
        }
        if (ch === "$" && next === "{") {
          stack.push(codeFrame(true));
          i += 2;
          continue;
        }
        i += 1;
        continue;
      }
      // Khung mã.
      if (ch === "/" && next === "/") {
        stack.push({ kind: "lineComment", brace: 0, paren: 0, bracket: 0, fromTemplate: false, quote: "" });
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        stack.push({ kind: "blockComment", brace: 0, paren: 0, bracket: 0, fromTemplate: false, quote: "" });
        i += 2;
        continue;
      }
      if (ch === "/" && (previous === "" || REGEX_PRECEDERS.has(previous))) {
        stack.push({ kind: "regex", brace: 0, paren: 0, bracket: 0, fromTemplate: false, quote: "" });
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        stack.push({ kind: "string", brace: 0, paren: 0, bracket: 0, fromTemplate: false, quote: ch });
        i += 1;
        continue;
      }
      if (ch === "`") {
        stack.push({ kind: "template", brace: 0, paren: 0, bracket: 0, fromTemplate: false, quote: "" });
        i += 1;
        continue;
      }
      if (ch === "{") {
        frame.brace += 1;
        delims.push("{");
      } else if (ch === "}") {
        if (frame.brace > 0) {
          frame.brace -= 1;
          delims.pop();
        } else if (frame.fromTemplate) {
          stack.pop();
          i += 1;
          continue;
        } else {
          frame.brace -= 1;
          delims.pop();
        }
      } else if (ch === "(") {
        frame.paren += 1;
        delims.push("(");
      } else if (ch === ")") {
        frame.paren -= 1;
        delims.pop();
      } else if (ch === "[") {
        frame.bracket += 1;
        delims.push("[");
      } else if (ch === "]") {
        frame.bracket -= 1;
        delims.pop();
      }
      if (ch.trim() !== "") previous = ch;
      i += 1;
    }
    // Kết thúc dòng: bình luận dòng luôn đóng ở cuối dòng.
    const topAfter = stack[stack.length - 1] as Frame;
    if (topAfter.kind === "lineComment") stack.pop();
    line += 1;
  }
  return out;
}

/**
 * Dòng trước một nhát cắt có kết thúc ở chỗ câu lệnh đã trọn không?
 * Nếu dòng trước kết thúc bằng toán tử/mở ngoặc thì cắt ở đó là đứt giữa biểu thức.
 * @param lines - các dòng của vùng.
 * @param index - chỉ số dòng sẽ trở thành đầu lát mới.
 * @returns true khi được phép cắt.
 */
function previousLineCloses(lines: readonly string[], index: number): boolean {
  if (index <= 0) return true;
  const previous = (lines[index - 1] as string).trimEnd();
  if (previous === "") return true;
  const last = previous[previous.length - 1] as string;
  if (TRAILING_OPENERS.has(last)) return false;
  // Dòng trước mở một chuỗi/template chưa đóng thì bộ quét đã đánh dấu không sạch — đã loại ở trên.
  return true;
}

/**
 * Dòng này có phải một ỨNG VIÊN chỗ cắt không (chưa chắc đúng — còn phải qua phép thử cú pháp)?
 * @param lines - các dòng của vùng.
 * @param index - chỉ số dòng.
 * @returns true khi dòng này có thể là đầu một lát.
 */
function candidateAt(lines: readonly string[], index: number): boolean {
  if (index <= 0 || index >= lines.length) return false;
  const line = lines[index] as string;
  if (line.trim() === "") return false;
  const head = /^\s*([A-Za-z_$][\w$]*)/.exec(line)?.[1] ?? "";
  if (CONTINUATIONS.includes(head)) return false;
  if (!LEADING_OPENERS.test(line.trimStart())) return false;
  return previousLineCloses(lines, index);
}

/** Bộ đệm bộ kiểm cú pháp — tạo một lần cho cả lần chạy công cụ. */
let checker: Bun.Transpiler | null = null;

/**
 * Một đoạn văn bản có phải cú pháp TypeScript hợp lệ không?
 * Đây là QUAN TOÀ CUỐI CÙNG của việc chọn nhát cắt: mọi suy luận về độ sâu ngoặc chỉ là ứng viên, còn
 * "đứng riêng ra có parse được không" thì đo được. (Bài học 18/10/2026: tự đếm ngoặc đã sai một ngoặc,
 * và bộ quét token của TypeScript cũng lệch khi gặp template lồng nhau — nên phải THỬ rồi MỚI tin.)
 * @param text - văn bản cần kiểm.
 * @returns true khi parse được.
 */
export function parses(text: string): boolean {
  checker ??= new Bun.Transpiler({ loader: "ts" });
  try {
    checker.transformSync(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cách bọc một mảnh để nó đứng riêng mà vẫn hợp lệ.
 * Vì mảnh có thể bắt đầu GIỮA một biểu thức, ta mở lại đúng ngăn xếp ngoặc đang mở ở đầu mảnh và đóng
 * lại đúng ngăn xếp đang mở ở cuối mảnh: văn bản ở giữa chuyển ngăn xếp từ D sang E, nên D + văn bản +
 * đóng(E) là một chương trình khép kín. Hai chuỗi này bị build.ts GỠ khi ghép nên bản chạy vẫn nguyên văn.
 */
export interface Wrapping {
  /** Chuỗi dấu MỞ thêm ở đầu mảnh (rỗng = mảnh vốn đứng ở cấp cao nhất). */
  readonly opens: string;
  /** Chuỗi dấu ĐÓNG thêm ở cuối mảnh, đúng thứ tự đóng của ngăn xếp ngoặc, ví dụ "})\"]". */
  readonly closes: string;
}

/**
 * Chuỗi dấu đóng tương ứng với một chuỗi dấu mở, theo đúng thứ tự đóng (mở sau thì đóng trước).
 * @param delims - chuỗi dấu mở, ví dụ "{([".
 * @returns chuỗi dấu đóng, ví dụ "])}".
 */
export function mirrorDelims(delims: string): string {
  const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
  let out = "";
  for (let i = delims.length - 1; i >= 0; i -= 1) out += pairs[delims[i] as string] ?? "";
  return out;
}

/**
 * Tìm cách bọc một mảnh: thử KHÔNG bọc trước (giữ lát giống mã thường), rồi tới bọc trong một hàm.
 * Số ngoặc đóng cần thêm được DÒ bằng phép thử cú pháp chứ không đoán: bắt đầu từ ước lượng của bộ
 * quét rồi thử lân cận.
 * @param piece - các dòng của mảnh.
 * @param guess - số ngoặc móc đang mở ở cuối mảnh theo bộ quét (chỉ là ước lượng).
 * @returns cách bọc dùng được, hoặc null khi mảnh không thể đứng riêng.
 */
export function findWrapping(piece: readonly string[], opens: string, ends: string): Wrapping | null {
  const text = piece.join("\n");
  // ⚠️ KHONG duoc loc bo chuoi RONG: mảnh đóng đủ ngoặc thì cách bọc ĐÚNG chính là "không thêm gì".
  // Thu chuoi RONG truoc: mảnh cắt ở đầu một CÂU LỆNH thì vốn đã tự cân bằng, không cần bù gì.
  const openVariants = [...new Set(["", opens, opens.slice(0, -1)])];
  const closeVariants = [...new Set(["", mirrorDelims(ends), mirrorDelims(ends).slice(0, -1)])];
  const attempts: Wrapping[] = [];
  for (const open of openVariants) {
    for (const close of closeVariants) {
      // Boc trong HAM truoc (de cau lenh kieu return giua than ham van hop le), roi moi toi dang tran.
      attempts.push({ opens: FRAGMENT_WRAPPER + open, closes: close + "}" });
    }
  }
  for (const open of openVariants) {
    for (const close of closeVariants) attempts.push({ opens: open, closes: close });
  }
  for (const attempt of attempts) {
    if (parses(renderPiece(attempt.opens, text, attempt.closes))) return attempt;
  }
  return null;
}

/**
 * Chọn chỗ MỞ ĐẦU cho mảnh CUỐI của một vùng đang xét: quét từ cuối về, ứng viên gần ngân sách nhất mà
 * mảnh [cut, end) đứng riêng được.
 *
 * ⚠️ 18/10/2026 — VÌ SAO CẮT TỪ CUỐI VỀ (bài học đo được, không phải phong cách):
 *   Bản cắt-từ-đầu chọn mảnh đầu thoả mãn rồi để mảnh CUỐI của vùng "thừa ra" — mà mảnh cuối ấy có thể
 *   bắt đầu giữa một object literal (ví dụ dòng "pointerId: event.pointerId,") nên KHÔNG cách bọc nào
 *   cứu được, và cả vùng bị bỏ. Cắt từ cuối về thì mảnh cuối LUÔN được kiểm trước, nên không bao giờ
 *   còn lại một đuôi không hợp lệ.
 * @param lines - các dòng của vùng.
 * @param depths - ảnh chụp độ sâu của vùng.
 * @param end - chỉ số kết thúc (không tính) của mảnh cần chọn.
 * @param budget - ngân sách dòng của một mảnh.
 * @param limit - số ứng viên tối đa đem thử.
 * @returns chỉ số bắt đầu kèm cách bọc, hoặc null khi không có ứng viên nào dùng được.
 */
export function chooseTail(lines: readonly string[], depths: readonly LineDepth[], end: number, budget: number, limit = 220): { start: number; wrapping: Wrapping } | null {
  const want = end - Math.floor(budget * 0.8);
  const lowest = Math.max(1, end - budget);
  let tried = 0;
  for (let offset = 0; offset < budget; offset += 1) {
    for (const start of [want + offset, want - offset]) {
      if (start < lowest || start >= end) continue;
      if (!candidateAt(lines, start)) continue;
      tried += 1;
      if (tried > limit) return null;
      const wrapped = findWrapping(lines.slice(start, end), (depths[start] as LineDepth).delims, (depths[end] as LineDepth | undefined)?.delims ?? "");
      if (wrapped !== null) return { start, wrapping: wrapped };
    }
  }
  return null;
}

/**
 * Một mảnh của vùng: các dòng nguyên văn kèm số ngoặc móc phải mở/đóng lại để mảnh là cú pháp hợp lệ.
 */
interface Piece {
  /** Các dòng nguyên văn. */
  readonly lines: readonly string[];
  /** Chuỗi dấu mở thêm ở đầu mảnh (rỗng = mảnh vốn đứng ở cấp cao nhất). */
  readonly opens: string;
  /** Chuỗi dấu đóng thêm ở cuối mảnh (đã DÒ bằng phép thử cú pháp). */
  readonly closes: string;
  /** Tên vùng mảnh này thuộc về (dùng cho thông báo lỗi). */
  readonly region: string;
}

/**
 * Cắt một vùng thành các mảnh ≤ ngân sách, mỗi mảnh ghi kèm số ngoặc móc cần bù.
 * @param region - vùng cần cắt.
 * @param budget - ngân sách dòng của một lát.
 * @returns danh sách mảnh theo thứ tự.
 */
export function cutRegion(region: Region, budget: number): Piece[] {
  const lines = [...region.lines];
  const depths = scanDepths(lines);
  const out: Piece[] = [];
  let end = lines.length;
  while (end > budget) {
    const found = chooseTail(lines, depths, end, budget);
    if (found === null) throw new Error("vùng " + region.name + " khong co cho cat dung duoc trong " + budget + " dong (ket thuc o dong " + end + ")");
    out.unshift({ lines: lines.slice(found.start, end), opens: found.wrapping.opens, closes: found.wrapping.closes, region: region.name });
    end = found.start;
  }
  const head = lines.slice(0, end);
  const headWrap = findWrapping(head, (depths[0] as LineDepth).delims, (depths[end] as LineDepth | undefined)?.delims ?? "");
  if (headWrap === null) throw new Error("mảnh đầu của vùng " + region.name + " không đứng riêng được");
  out.unshift({ lines: head, opens: headWrap.opens, closes: headWrap.closes, region: region.name });
  return out;
}

/**
 * Gom các vùng thành các lát ≤ ngân sách dòng, chỉ cắt thêm khi một vùng tự nó đã quá dài.
 * Bất biến 1: mọi lát trả về đều ≤ budget dòng (kể cả hai dòng đánh dấu vỏ ngoặc).
 * Bất biến 2: mọi lát đều là cú pháp hợp lệ — công cụ tự kiểm bằng Bun.Transpiler trước khi ghi.
 * @param regions - danh sách vùng theo thứ tự.
 * @param budget - số dòng tối đa cho phần thân một lát.
 * @returns mảng các mảnh, đã gom thành lát theo thứ tự ghép.
 */
export function packParts(regions: readonly Region[], budget: number): Piece[][] {
  const pieces: Piece[] = [];
  for (const region of regions) pieces.push(...cutRegion(region, budget));
  const parts: Piece[][] = [];
  let current: Piece[] = [];
  let used = 0;
  for (const piece of pieces) {
    const cost = piece.lines.length + 2;
    if (used + cost > budget) {
      if (current.length > 0) parts.push(current);
      current = [];
      used = 0;
    }
    current.push(piece);
    used += cost;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

/**
 * Ghi một lát ra file: header + @ts-nocheck + các mảnh kèm dòng đánh dấu vỏ + export {};.
 * @param parts - các mảnh của lát.
 * @param name - tên file lát.
 * @param outDir - thư mục đích.
 * @returns nội dung đã ghi.
 */
function writePart(parts: readonly Piece[], name: string, outDir: string): string {
  const body: string[] = [...HEADER, "// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.", ""];
  for (const piece of parts) {
    // Dung CHUNG renderPiece voi findWrapping: phep thử cú pháp và văn bản ghi ra không thể lệch nhau.
    body.push(renderPiece(piece.opens, piece.lines.join("\n"), piece.closes));
  }
  body.push("", "export {};", "");
  const text = body.join("\n");
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  try {
    transpiler.transformSync(text);
  } catch (error) {
    throw new Error("lát " + name + " KHONG hop le ve cu phap: " + String(error));
  }
  writeFileSync(join(outDir, name), text);
  return text;
}

/**
 * Dựng danh sách ĐOẠN của thân factory, theo ĐÚNG thứ tự xuất hiện trong bundle gốc:
 * (1) prelude = `var module …` → các dòng require; (2) từng vùng //#region … //#endregion của tsdown;
 * (3) đuôi = các dòng `exports.X = …` + `return module.exports;`.
 *
 * ⚠️ Vì sao prelude/đuôi là ĐOẠN RIÊNG chứ không bỏ đi như bản ui-trajectory: bundle này có
 * `Object.defineProperty(exports, Symbol.toStringTag, …)` và `let react = require("react")` NẰM NGOÀI
 * vùng region. Bỏ chúng rồi chèn lại bằng tay là tự tạo một chỗ sửa tay thứ hai — đo byte sẽ không còn
 * nghĩa. Ở đây MỌI dòng của thân factory đều đi qua lát, nên phép so byte là so NGUYÊN THÂN.
 * @param lines - toàn bộ dòng của bundle gốc.
 * @returns các đoạn theo đúng thứ tự ghép.
 */
export function factorySegments(lines: readonly string[]): Region[] {
  const start = lines.findIndex((line) => line === "\t\tvar module = { exports: {} };");
  const end = lines.findIndex((line) => line === "\t\treturn module.exports;");
  if (start < 0) throw new Error("khong thay dong mo than factory (var module = { exports: {} }; )");
  if (end <= start) throw new Error("khong thay dong ket than factory (return module.exports;)");
  const body = lines.slice(start, end + 1);
  const segments: Region[] = [];
  let current: string[] = [];
  let inRegion = false;
  let regionName = "(prelude)";
  let gap = 0;
  for (const line of body) {
    if (!inRegion && /^\t\t\/\/#region /.test(line)) {
      // Mọi dòng NGOÀI vùng cũng là một đoạn: chúng là nguyên văn (prelude, các dòng require giữa hai
      // vùng, đuôi exports.*) và bỏ chúng đi là tự tạo chỗ sửa tay — lỗi có thật, đo được: bản đầu chỉ
      // lấy vùng nên MẤT 3 dòng `let react = require("react")` và phép so byte báo lệch 121 byte.
      if (current.length > 0) {
        gap += 1;
        segments.push({ name: "(gap " + gap + ")", lines: current });
      }
      current = [line];
      inRegion = true;
      regionName = line.trim();
      continue;
    }
    current.push(line);
    if (inRegion && /^\t\t\/\/#endregion\s*$/.test(line)) {
      segments.push({ name: regionName, lines: current });
      current = [];
      inRegion = false;
    }
  }
  if (current.length > 0) segments.push({ name: inRegion ? regionName : "(tail)", lines: current });
  return segments;
}

/**
 * Sinh các file lát vào thư mục đích.
 * @param bundlePath - đường dẫn bundle gốc.
 * @param outDir - thư mục chứa các lát.
 * @returns danh sách tên file đã ghi, theo thứ tự ghép.
 */
export function writeParts(bundlePath: string, outDir: string): string[] {
  const lines = readFileSync(bundlePath, "utf8").split("\n");
  const parts = packParts(factorySegments(lines), PART_LINE_BUDGET);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  parts.forEach((part, index) => {
    const name = "part-" + String(index + 1).padStart(2, "0") + ".ts";
    writePart(part, name, outDir);
    written.push(name);
  });
  return written;
}

/**
 * Cắt nội dung bundle thành các vùng theo dấu //#region / //#endregion của tsdown.
 * @param lines - toàn bộ dòng của bundle gốc.
 * @returns danh sách vùng theo đúng thứ tự xuất hiện.
 */
export function splitRegions(lines: readonly string[]): Region[] {
  const regions: Region[] = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const line of lines) {
    const open = /^\t\t\/\/#region (.*)$/.exec(line);
    if (open !== null) {
      current = { name: open[1] as string, lines: [line] };
      regions.push(current);
      continue;
    }
    if (/^\t\t\/\/#endregion\s*$/.test(line)) {
      current?.lines.push(line);
      current = null;
      continue;
    }
    current?.lines.push(line);
  }
  return regions;
}

if (import.meta.main) {
  const bundle = process.argv[2];
  if (bundle === undefined) throw new Error("thiếu đường dẫn bundle gốc");
  const outDir = process.argv[3] ?? join(import.meta.dir, "..", "src", "parts");
  const written = writeParts(bundle, outDir);
  console.log("đã ghi " + written.length + " lát vào " + outDir);
  for (const name of written) console.log("  " + name + " · " + readFileSync(join(outDir, name), "utf8").split("\n").length + " dòng");
  console.log("");
  console.log("PART_FILES (dan vao src/manifest.ts):");
  for (const name of written) console.log('  "parts/' + name + '",');
}