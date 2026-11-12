/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 vùng `lib/types/bindings.js` (dòng 277–333 của bundle
 *      @deepseek-ai/dsh-ptc-runtime-node): kiểm tên binding/error-class TRƯỚC khi spawn tiến trình,
 *      và trả lời MỘT lượt gọi binding qua kênh điều khiển có trần byte (kết quả JSON không mất mát
 *      hoặc câu từ chối).
 */

import { encodePtcJsonWire, snapshotPtcJsonValue } from "./json-wire.ts";
import type { PtcJsonWire } from "./json-wire.ts";

/**
 * Giá trị JSON không mất mát — BẢN KHAI TỐI THIỂU CỤC BỘ của kiểu peer `PtcJsonValue` trong
 * `@deepseek-ai/dsh-ptc-runtime`. Peer chưa có trong workspace của ta (gói này không có
 * `node_modules` riêng) nên import thật là TS2307; khi port xong peer thì thay bằng import thật.
 */
type PtcJsonValue = null | boolean | number | string | PtcJsonValue[] | { [key: string]: PtcJsonValue };

/**
 * Một hàm phía host phơi cho chương trình như callable async — BẢN KHAI TỐI THIỂU CỤC BỘ của peer
 * `PtcBindingFunction`. `args` và giá trị resolve BẮT BUỘC là JSON không mất mát.
 */
type PtcBindingFunction = (args: unknown) => Promise<PtcJsonValue>;

/** Hợp đồng từ chối có kiểu mà chương trình thấy — BẢN KHAI TỐI THIỂU CỤC BỘ của peer `PtcBindingErrorClass`. */
interface PtcBindingErrorClass {
  /** Tên global của constructor và `Error.name` tạo ra; cùng luật định danh di động như `global`. */
  name: string;
  /** Tên thuộc tính (own property, khác rỗng) mang tên member bị từ chối. */
  memberNameProperty: string;
}

/** Một nhóm hàm binding có tên — BẢN KHAI TỐI THIỂU CỤC BỘ của peer `PtcBindingNamespace`. */
interface PtcBindingNamespace {
  /** Định danh global mà chương trình nhìn thấy. */
  global: string;
  /** Các member callable, khoá theo ĐÚNG tên chương trình gọi. */
  functions: Record<string, PtcBindingFunction>;
  /** Hợp đồng từ chối có kiểu tuỳ chọn cho namespace này. */
  errorClass?: PtcBindingErrorClass;
}

/** Yêu cầu chạy một chương trình — BẢN KHAI TỐI THIỂU CỤC BỘ của peer `PtcRunRequest` (chỉ trường mà tệp này chạm tới). */
interface PtcRunRequest {
  /** Mã nguồn chương trình. */
  program: string;
  /** Chủ sở hữu danh tính cho trạng thái trong bộ nhớ (tuỳ chọn). */
  stateOwner?: object;
  /** Hàm host phơi cho chương trình, mỗi namespace một global. */
  bindings: PtcBindingNamespace[];
  /** Thư mục làm việc trong thế giới file/subprocess đã mount. */
  cwd?: string;
  /** Ngân sách thời gian chạy tính bằng ms; `null` là không hạn. */
  timeoutMs?: number | null;
  /** Thẩm quyền đã giải cho lượt chạy này. */
  sandboxPolicy?: unknown;
  /** Huỷ lượt chạy. */
  signal?: AbortSignal;
}

/**
 * Câu trả lời của host cho một lượt gọi binding — BẢN KHAI TỐI THIỂU CỤC BỘ của `ReplyMessage` mà
 * `./protocol.ts` (vùng khác của cùng package) sẽ khai; giữ y hệt hình dạng để thay bằng
 * `import type { ReplyMessage } from "./protocol.ts";` khi tệp ấy đã có.
 */
type ReplyMessage =
  | {
      type: "reply";
      id: number;
      ok: true;
      value: PtcJsonWire;
    }
  | {
      type: "reply";
      id: number;
      ok: false;
      message: string;
    };

/**
 * BẢN SAO CỤC BỘ của `RESERVED_BINDING_GLOBALS` trong `@deepseek-ai/dsh-ptc-runtime` — giữ NGUYÊN
 * các tên và thứ tự. Vì sao chép thay vì import: peer ấy chưa có trong workspace của ta ⇒ import
 * thật là TS2307. Mọi backend đều từ chối các tên này vì MỘT backend nào đó sở hữu slot: `console`
 * (Node bắt log) và `__dsh_main__`/`__builtins__`/`__name__`/`__debug__` (backend Python).
 */
const RESERVED_BINDING_GLOBALS: ReadonlySet<string> = new Set([
  "console",
  "__dsh_main__",
  "__builtins__",
  "__name__",
  "__debug__"
]);

/**
 * BẢN SAO CỤC BỘ của `RESERVED_ERROR_MEMBERS` — các tên `memberNameProperty` mà MỌI backend từ
 * chối: member loại trừ của `Error` JS (`name`, `message`, `stack`) và member giao thức exception
 * của Python (`args`, `with_traceback`, `add_note`).
 */
const RESERVED_ERROR_MEMBERS: ReadonlySet<string> = new Set([
  "name",
  "message",
  "stack",
  "args",
  "with_traceback",
  "add_note"
]);

/**
 * BẢN SAO CỤC BỘ của `DUNDER_MEMBER` — dạng dunder (`__x__`, phần giữa khác rỗng): slot giao thức
 * của Python, bị từ chối làm error member trên mọi backend.
 */
const DUNDER_MEMBER = /^__.+__$/;

/**
 * BẢN SAO CỤC BỘ của `PORTABLE_RESERVED_WORDS` — từ khoá của MỌI ngôn ngữ đích di động
 * (ECMAScript ∪ Python), giữ nguyên từng từ và thứ tự. Hợp đồng định danh di động hứa rằng một
 * danh sách namespace hợp lệ trên backend này là hợp lệ trên mọi backend.
 */
const PORTABLE_RESERVED_WORDS: ReadonlySet<string> = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "let",
  "static",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
  "arguments",
  "eval",
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "def",
  "del",
  "elif",
  "except",
  "from",
  "global",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "match",
  "type",
  "_"
]);

/** Kiểm và chộp các tên binding mà MỘT chương trình được dùng. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Từ chối các namespace KHÔNG dùng được TRƯỚC khi khởi động tiến trình.
 *
 * Nhận: `request` — các khai báo binding do phía host sở hữu.
 * Trả: các namespace khoá theo global mà chúng khai.
 */
export function validateBindings(request: PtcRunRequest): Map<string, PtcBindingNamespace> {
  const bindings = new Map<string, PtcBindingNamespace>();
  for (const namespace of request.bindings) {
    if (!IDENTIFIER.test(namespace.global) || PORTABLE_RESERVED_WORDS.has(namespace.global)) throw new Error(`dsh-ptc-runtime-node: binding global ${JSON.stringify(namespace.global)} is not a usable identifier`);
    if (RESERVED_BINDING_GLOBALS.has(namespace.global)) throw new Error(`dsh-ptc-runtime-node: reserved binding global ${JSON.stringify(namespace.global)}`);
    if (bindings.has(namespace.global)) throw new Error(`dsh-ptc-runtime-node: duplicate binding global ${JSON.stringify(namespace.global)}`);
    bindings.set(namespace.global, namespace);
  }
  const errorClassNames = new Set<string>();
  for (const namespace of request.bindings) {
    const descriptor = namespace.errorClass;
    if (!descriptor) continue;
    if (!IDENTIFIER.test(descriptor.name) || PORTABLE_RESERVED_WORDS.has(descriptor.name)) throw new Error(`dsh-ptc-runtime-node: binding error class ${JSON.stringify(descriptor.name)} is not a usable identifier`);
    if (RESERVED_BINDING_GLOBALS.has(descriptor.name)) throw new Error(`dsh-ptc-runtime-node: reserved binding global ${JSON.stringify(descriptor.name)}`);
    if (bindings.has(descriptor.name) || errorClassNames.has(descriptor.name)) throw new Error(`dsh-ptc-runtime-node: duplicate injected global ${JSON.stringify(descriptor.name)}`);
    const member = descriptor.memberNameProperty;
    if (member.length === 0 || RESERVED_ERROR_MEMBERS.has(member) || DUNDER_MEMBER.test(member)) throw new Error(`dsh-ptc-runtime-node: binding error member property ${JSON.stringify(descriptor.memberNameProperty)} is not usable`);
    errorClassNames.add(descriptor.name);
  }
  return bindings;
}

/**
 * Gọi một binding của host rồi mã hoá kết quả không mất mát của nó — hoặc câu từ chối trên kênh có
 * trần byte.
 *
 * Nhận: `id` — định danh tương quan do chương trình cấp; `binding` — hàm đã khai của lượt đánh giá
 * hiện tại (VẮNG nếu nó đã bị gỡ); `args` — tham số JSON đã kiểm và đã tách khỏi chương trình.
 * Trả: một câu trả lời hợp với kênh điều khiển có trần byte của runtime.
 */
export async function replyToBinding(id: number, binding: PtcBindingFunction | undefined, args: PtcJsonValue): Promise<ReplyMessage> {
  try {
    if (!binding) throw new Error("binding is unavailable in this evaluation; reacquire the current tool");
    const value = snapshotPtcJsonValue(await binding(args));
    if (value === void 0) throw new Error("binding resolution must be lossless JSON");
    return {
      type: "reply",
      id,
      ok: true,
      value: encodePtcJsonWire(value)
    };
  } catch (error) {
    return {
      type: "reply",
      id,
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
