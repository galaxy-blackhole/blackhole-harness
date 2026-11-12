/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Sandbox "node:vm" cho nửa HOST của gói động: realm mới với console gắn nhãn, helper "harness", primitive mã hoá, bẫy các API Node bị thu hồi, và bản vá "instanceof" hai realm; kèm precheck cú pháp và evaluate.
 */

/**
 * Sandbox "node:vm" mà nửa HOST của một gói động được đánh giá trong đó: một realm mới với các global
 * là console ghi-thẳng có gắn nhãn, các helper đăng ký "harness", các primitive mã hoá mà một vm context
 * trần thiếu, và các bẫy gọi-được phủ lên những API Node mà sandbox CỐ Ý thu hồi. Bẫy lái công việc
 * filesystem, mạng, tiến trình và hẹn giờ về "ctx.fs", "ctx.web", "ctx.bash" và timer của Cordis.
 * Điều này giữ các gói hợp tác ở trạng thái kiểm tra được và vứt bỏ được, nhưng KHÔNG phải cách ly:
 * các hàm helper ở realm host vẫn là một đường thoát.
 *
 * Nửa trình duyệt KHÔNG bao giờ chạm module này — nó được runner phía client đánh giá trong một closure,
 * với facade riêng.
 */

import { createContext, runInContext, Script, type Context } from "node:vm";
import { sandboxDefineTool, sandboxRegisterTool } from "./guard.ts";

/** Hình dạng console mà một package động nhìn thấy: năm method, tất cả cùng ghi ra host. */
interface TaggedConsole {
  /** Ghi một dòng log. */
  log(...args: unknown[]): void;
  /** Bí danh của log. */
  info(...args: unknown[]): void;
  /** Bí danh của log. */
  warn(...args: unknown[]): void;
  /** Bí danh của log. */
  debug(...args: unknown[]): void;
  /** Ghi một dòng lỗi. */
  error(...args: unknown[]): void;
}

/**
 * Nhận: "id" — mã của package ("dyn-<n>"), dùng làm nhãn console.
 * Trả: console ghi thẳng ra stdout/stderr của host, mỗi dòng gắn nhãn "[cordis:<id>]".
 */
function taggedConsole(id: string): TaggedConsole {
  const tag = `[cordis:${id}]`;
  const log = (...args: unknown[]): void => { console.log(tag, ...args); };
  const error = (...args: unknown[]): void => { console.error(tag, ...args); };
  return { log, info: log, warn: log, debug: log, error };
}

/**
 * Chỉ vá các constructor của VM để "instanceof" chấp nhận CẢ giá trị VM lẫn giá trị host được truyền
 * vào làm tham số, sự kiện hay kết quả service; các intrinsic của host giữ nguyên.
 */
const DUAL_REALM_INSTANCEOF_PRELUDE = `
(hostIntrinsics) => {
  'use strict'
  const ordinary = Function.prototype[Symbol.hasInstance]
  for (const name of Object.keys(hostIntrinsics)) {
    const VmCtor = globalThis[name]
    const HostCtor = hostIntrinsics[name]
    if (typeof VmCtor !== 'function' || typeof HostCtor !== 'function') continue
    Object.defineProperty(VmCtor, Symbol.hasInstance, {
      value: (instance) => ordinary.call(VmCtor, instance) || ordinary.call(HostCtor, instance),
      configurable: true,
    })
  }
}
`;

/**
 * Nhận: "sandbox" — vật thể đã được contextify bởi "createContext".
 * Trả: không; prelude {@link DUAL_REALM_INSTANCEOF_PRELUDE} được chạy trong sandbox và nhận các intrinsic của host để ghép cặp.
 */
function patchDualRealmInstanceof(sandbox: object): void {
  const patch = runInContext(DUAL_REALM_INSTANCEOF_PRELUDE, sandbox as Context) as (hostIntrinsics: Record<string, unknown>) => void;
  patch({ Object, Array, Function, Error, TypeError, RangeError, SyntaxError, Promise, RegExp, Date, Map, Set });
}

/** Văn bản chuyển hướng dùng chung cho mọi API hẹn giờ của Node. */
const TIMER_REDIRECT = "Node timers are unavailable. Use the cordis timer service instead: declare inject: ['timer'] on your plugin "
  + "and call ctx.timeout / ctx.interval after querying Host Service.listService for the exact overloads. "
  + "Those calls are fiber effects, cleaned up automatically when stopped.";

/**
 * Các API Node gọi-được mà sandbox CỐ Ý vô hiệu, mỗi cái ánh xạ tới phương án cordis mà lỗi bẫy nêu tên.
 * Chỉ các global có giá trị là HÀM mới bị bẫy; một global mang DỮ LIỆU như "process" vẫn là undefined,
 * vì một accessor ném lỗi sẽ kích nổ phép dò tính năng "typeof process" phổ biến ngay lúc phân giải.
 */
const NODE_API_REDIRECTS = {
  require: "Node modules are unavailable. Use the cordis services on ctx instead — e.g. inject: ['fs'] for files, "
    + "['web'] for HTTP, ['bash'] for processes; query Service.listService with cordis_inspect_query first.",
  setTimeout: TIMER_REDIRECT,
  setInterval: TIMER_REDIRECT,
  setImmediate: TIMER_REDIRECT,
  clearTimeout: TIMER_REDIRECT,
  clearInterval: TIMER_REDIRECT,
  fetch: "Network access goes through the cordis web service: declare inject: ['web'] and call ctx.web "
    + "(query Host Service.listService with cordis_inspect_query for its methods).",
};

/**
 * Nhận: không — đọc bảng {@link NODE_API_REDIRECTS} của module.
 * Trả: bảng hàm bẫy theo tên API; gọi một hàm trong đó sẽ ném lỗi chuyển hướng.
 */
function nodeApiTraps(): Record<string, () => never> {
  const traps: Record<string, () => never> = {};
  for (const [name, redirect] of Object.entries(NODE_API_REDIRECTS)) {
    traps[name] = () => {
      throw new Error(`${name} is not available in the dynamic package sandbox — ${redirect}`);
    };
  }
  return traps;
}

/**
 * Nhận: "id" — mã package ("dyn-<n>"), dùng làm nhãn console và gốc tên tệp; "harnessExtras" — các động từ
 *   "harness" riêng của package, thêm vào cặp đăng ký ("handle").
 * Trả: vật thể sandbox đã được contextify để truyền cho {@link evaluateHostCode}.
 */
export function createSandbox(id: string, harnessExtras: Record<string, unknown> = {}): object {
  const sandbox: Record<string, unknown> = {
    ...nodeApiTraps(),
    console: taggedConsole(id),
    harness: { defineTool: sandboxDefineTool, registerTool: sandboxRegisterTool, ...harnessExtras },
    // Các Web API vắng trong vm context mới — được mở ra để model mã hoá/giải mã base64
    // mà không cần Buffer (cũng vắng). Closure của host bọc Buffer, KHÔNG BAO GIỜ là chính Buffer.
    btoa: (s: string) => Buffer.from(s, "utf-8").toString("base64"),
    atob: (s: string) => Buffer.from(s, "base64").toString("utf-8"),
    TextEncoder,
    TextDecoder,
  };
  createContext(sandbox);
  patchDualRealmInstanceof(sandbox);
  return sandbox;
}

/**
 * Nhận: "error" — giá trị bất kỳ bị ném ra (host realm hoặc sandbox realm).
 * Trả: true khi giá trị đó là một SyntaxError, nhận ra bằng thuộc tính "name" an toàn qua realm.
 */
function isSyntaxError(error: unknown): error is Error {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "SyntaxError";
}

/**
 * Phát hiện SyntaxError xuyên realm: một lần biên dịch hỏng bên trong "runInContext" dựng lỗi của nó
 * trong realm SANDBOX, nên "instanceof SyntaxError" ở host lặng lẽ sai — thuộc tính "name" là thẻ an toàn qua realm.
 *
 * Nhận: "error" — SyntaxError (host realm hoặc sandbox realm) bị ném khi biên dịch mã package.
 * Trả: tiền tố stack tính tới và bao gồm dòng "SyntaxError: …"; rơi về String(error) khi stack không có tiền tố đó.
 */
export function syntaxErrorContext(error: Error): string {
  const lines = (error.stack ?? "").split("\n");
  const messageIndex = lines.findIndex(line => line.startsWith("SyntaxError"));
  if (messageIndex === -1)
    return String(error);
  return lines.slice(0, messageIndex + 1).join("\n");
}

/**
 * Nhận: "half" — nửa nào hỏng phân tích, gọi đúng tên tham số define đã mang nó; "context" — {@link syntaxErrorContext} của lần hỏng.
 * Trả: thông điệp lỗi hướng tới model, dùng chung cho precheck lúc define và đánh giá lúc chạy.
 */
export function parseErrorMessage(half: "code.host" | "code.client", context: string): string {
  // Thu hẹp heuristic TypeScript vào DÒNG GÂY LỖI, không phải toàn bộ mã:
  // một " as " nằm trong chuỗi mô tả bình thường không được biến một lỗi
  // cú pháp thường thành thông điệp remove-annotations gây nhầm.
  const offendingLine = context.split("\n")[1] ?? "";
  if (/\bas\b/.test(offendingLine)) {
    return `dynamic package \`${half}\` failed to parse:\n${context}\n`
      + "The sandbox runs plain JavaScript, not TypeScript. Remove type annotations:\n"
      + "  ✗ { type: 'text' as const, text: x }\n"
      + "  ✓ { type: 'text', text: x }";
  }
  return `dynamic package \`${half}\` failed to parse:\n${context}\n`
    + "Note: it runs as the BODY of an async function (line numbers are offset by the 1-line wrapper). "
    + "Check bracket balance — ending the returned plugin object with \`});\` closes a call that was never opened; "
    + "a plain \`return { … }\` ends with \`}\` (an optional \`;\`), never \`)\`.";
}

/**
 * Phân tích mã nguồn của MỘT nửa mà không chạy nó: precheck lúc define, giữ mã không phân tích được ra khỏi
 * sổ đăng ký để model sửa rồi define lại thay vì phát hiện lỗi lúc chạy. "new Function" là cổng — host không
 * có "node:vm" thật (worker trình duyệt) vẫn từ chối mã không phân tích được — còn "vm.Script" chỉ là bộ
 * làm đẹp nỗ lực cuối: trên host Node, lỗi của nó mang tiền tố dòng-nguồn-và-caret mà văn bản giảng dạy dựa vào,
 * và ở nơi vm là đồ giả thì thông điệp vẫn trần. Hai bộ phân tích khác nhau ở rìa ("new.target" phân tích được
 * trong thân hàm nhưng không ở mức trên cùng của wrapper vm), một cái giá đã chấp nhận của cổng không-vm;
 * và dưới CSP của trang không có "'unsafe-eval'", "new Function" ném EvalError, lỗi này lan ra nguyên vẹn.
 *
 * Nhận: "code" — thân hàm do model viết; "half" — tham số define nào mang nó, dùng cho văn bản lỗi.
 * Trả: không.
 * @throws khi thân mã không phân tích được — kèm dòng gây lỗi và gợi ý giảng dạy.
 */
export function precheckCode(code: string, half: "code.host" | "code.client"): void {
  const wrapped = `(async () => {\n${code}\n})()`;
  try {
    // Chỉ biên dịch: dựng hàm là phân tích cú pháp, không chạy gì.
    // oxlint-disable-next-line typescript/no-implied-eval -- parse gate over model-written code; nothing is invoked
    new Function(wrapped);
  }
  catch (error) {
    if (!isSyntaxError(error))
      throw error;
    throw new Error(parseErrorMessage(half, prettyParseContext(wrapped, half, error)));
  }
}

/**
 * Nhận: "wrapped" — mã đã bọc mà "new Function" đã từ chối; "half" — tham số define nào mang nó, dùng cho tên tệp vm;
 *   "refusal" — SyntaxError của chính cổng, nguồn ngữ cảnh dự phòng.
 * Trả: prelude của vm khi vm thật sinh được, ngược lại là chính lời từ chối.
 */
function prettyParseContext(wrapped: string, half: "code.host" | "code.client", refusal: Error): string {
  try {
    new Script(wrapped, { filename: `cordis-dyn-${half}.js` });
  }
  catch (vmError) {
    if (isSyntaxError(vmError))
      return syntaxErrorContext(vmError);
    // Một vm giả (worker trình duyệt) từ chối chính Script; lỗi của cổng là ngữ cảnh duy nhất có.
  }
  return String(refusal);
}

/**
 * Đánh giá một nửa host như thân của một hàm async BÊN TRONG sandbox. "vmTimeoutMs" chỉ chặn phần ĐỒNG BỘ;
 * một thân async thoát khỏi nó — chấp nhận được theo lập trường tin cậy của module. Lỗi phân tích kèm dòng
 * gây lỗi và gợi ý gỡ TypeScript hoặc cân bằng ngoặc.
 *
 * Nhận: "sandbox" — vật thể đã contextify từ {@link createSandbox}; "code" — thân hàm do model viết, phải "return" một plugin;
 *   "id" — mã package, dùng làm tên tệp vm ("cordis-dyn-<id>.js"); "vmTimeoutMs" — trần đánh giá đồng bộ, tính bằng mili giây.
 * Trả: bất cứ thứ gì mã trả về, vẫn CHƯA được thu hẹp (vòng đời lượt chạy kiểm hình dạng plugin).
 * @throws khi thân mã không phân tích được — kèm thông điệp giảng dạy của {@link parseErrorMessage}.
 */
export async function evaluateHostCode(sandbox: object, code: string, id: string, vmTimeoutMs: number): Promise<unknown> {
  try {
    return await runInContext(`(async () => {\n${code}\n})()`, sandbox as Context, { filename: `cordis-dyn-${id}.js`, timeout: vmTimeoutMs });
  }
  catch (error) {
    if (!isSyntaxError(error))
      throw error;
    throw new Error(parseErrorMessage("code.host", syntaxErrorContext(error)));
  }
}
