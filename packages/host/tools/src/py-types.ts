/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Sinh mã chế độ PTC — bản Python: phép chiếu THUẦN từ schema tool đã đăng ký sang văn bản SDK
 *      Python mà model lập trình dựa vào khi runtime.language === 'python'. Anh em sinh đôi với
 *      ts-types.ts — hai phép chiếu của cùng một sổ đăng ký, chọn theo ngôn ngữ của PTC runtime.
 *      Dưới mode 'ptc', schema gốc KHÔNG gửi kèm request, nên văn bản này là nguồn DUY NHẤT cho tên
 *      tham số, trường bắt buộc, kiểu, mô tả và kiểu đầu ra chuẩn của từng tool.
 */
import { assertSupportedJsonSchema, type JsonSchemaNode } from "./json-schema.ts";
import type { ToolSdkSchema } from "./ts-types.ts";

/**
 * Văn phạm tham chiếu xid_start xid_continue* — đúng tập mà str.isidentifier() chấp nhận trên một
 * CPython có bảng Unicode khớp engine. Xem {@link isBareIdentifier} khi hai bảng lệch phiên bản.
 */
const IDENTIFIER = /^[\p{XID_Start}_]\p{XID_Continue}*$/u;

/**
 * Cho biết một tên có phát ra được dưới dạng định danh Python TRẦN, thay vì bị đẩy sang đường
 * subscript / dict[str, Any].
 *
 * Định danh Python KHÔNG phải ASCII: 路径 là tên trường hợp lệ ngang path, và từ chối nó sẽ làm hỏng
 * cả object bao ngoài — mất tên, độ bắt buộc và kiểu của MỌI trường, đúng loại thông tin mà dưới
 * mode 'ptc' chỉ văn bản sinh ra này mang.
 *
 * Tính ổn định NFKC là điều kiện thứ hai, tách biệt: CPython chuẩn hoá định danh lúc biên dịch còn
 * khoá JSON được so nguyên bản, nên ﬁeld sẽ được khai báo và truy cập như field — SDK quảng cáo một
 * khoá dưới cách viết harness không bao giờ nhận, và hai khoá chuẩn hoá về cùng một sẽ gộp thành một
 * khai báo. Những tên đó đi đường subscript, nơi giữ NGUYÊN BYTE.
 *
 * Vị từ này CỐ Ý chặt hơn isidentifier() (hàm kia không kiểm ổn định NFKC): 'ﬁeld'.isidentifier()
 * là True còn ở đây là false. Cả hai điều kiện đọc bảng Unicode của ENGINE, và hai phía được đánh
 * phiên bản độc lập — \p{XID_Start}/\p{XID_Continue} theo engine đang chạy, CPython theo bản của nó.
 * Độ lệch KHÔNG đối xứng: CPython CŨ hơn engine là hướng nguy hiểm (ký tự mới thêm vào XID được phát
 * trần nhưng tokenizer của nó từ chối, làm sập cả khối SDK — cùng bất biến "phải parse được" mà
 * {@link UNPRINTABLE}, {@link LONE_SURROGATE} và {@link MAX_LIST_NESTING} tồn tại để giữ); CPython
 * MỚI hơn chỉ đẩy một tên hợp lệ sang đường subscript, kém dễ đọc nhưng vẫn đúng. Điều kiện NFKC quy
 * về cùng độ lệch đó, vì tính ổn định chuẩn hoá bảo đảm cách chuẩn hoá của một ký tự đã gán không
 * bao giờ đổi về sau.
 *
 * Đây không phải chỗ đọc bảng engine duy nhất: {@link camelCase} đọc thêm ba điểm nữa — tập tách,
 * phép thử đầu và ánh xạ toUpperCase() — và phán quyết của vị từ này không chặn điểm nào trong số
 * đó. Một tool tên zz-<ký tự Nag Mundari>x không tới được độ lệch ở đây (dấu - loại thẳng) mà vẫn
 * phát class Zz<ký tự>xArgs, thứ CPython 3.9.6 từ chối. Bản ts-types giữ luật ASCII riêng thay vì
 * dùng chung: định danh ECMAScript là tập khác ($) và không bao giờ bị chuẩn hoá, nên một vị từ không
 * thể đúng cho cả hai.
 * Nhận: name — tên trường hoặc tên tool thô trong schema.
 * Trả: true nếu tên phát trần được, false nếu phải đi đường subscript.
 */
function isBareIdentifier(name: string): boolean {
  return IDENTIFIER.test(name) && name.normalize("NFKC") === name;
}

/**
 * Từ khoá CỨNG của Python: bị giữ chỗ ở mọi nơi, nên tool hay trường tên class / lambda hợp lệ trên
 * đường truyền nhưng không hợp lệ làm thuộc tính (tools.class là SyntaxError trong chương trình của
 * model) và cũng không hợp lệ làm trường TypedDict theo cú pháp class. Tool như vậy render dưới dạng
 * truy cập subscript, object như vậy hạ cấp thành dict[str, Any] — model vẫn với tới mọi tool và mọi
 * trường mà không đụng tên.
 *
 * Từ khoá MỀM (match, case, type, _ — trọn bộ của language reference) CỐ Ý VẮNG MẶT: mỗi cái chỉ đặc
 * biệt ở đúng một vị trí cú pháp — đầu câu lệnh (match, type), đầu mệnh đề của câu match (case), hay
 * một pattern (_) — nên match: str làm trường và async def match(...) làm method đều hợp lệ; đưa
 * chúng vào sẽ hạ cấp oan những trường search/regex phổ biến thành dict[str, Any].
 *
 * Tên bắt đầu bằng gạch dưới được xử lý RIÊNG, không ở đây: __token không phải dunder thì bị
 * name-mangle, dunder có sẵn trên object/type thì phân giải trước proxy hook, và tra cứu
 * special-method ngầm thì bỏ qua hook.
 */
const RESERVED = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class",
  "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
  "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
  "return", "try", "while", "with", "yield",
  // Không phải keyword, nhưng CPython từ chối GÁN nó lúc biên dịch
  // (SyntaxError: cannot assign to __debug__), mà trường TypedDict, tên tham số và keyword
  // argument đều là phép gán.
  "__debug__",
]);

/** Các ký hiệu của typing mà module này có thể phát, theo ĐÚNG thứ tự import tất định. */
const TYPING_ORDER = ["Any", "Literal", "NotRequired", "Protocol", "TypedDict"];

/** Hình dạng tối thiểu mà {@link describe} đọc: một node schema, hoặc wrapper { description }. */
interface Described {
  /** Mô tả annotation của node; thiếu thì coi như node không có mô tả. */
  readonly description?: string | undefined;
}

/** Trạng thái tích luỹ của một lần render: lớp đã sinh và ký hiệu typing đã dùng. */
interface PyRenderState {
  /** Các khối class …(TypedDict) theo thứ tự khai báo — lớp con TRƯỚC lớp cha tham chiếu nó. */
  classes: string[];
  /** Tên lớp đã cấp, dùng để chống trùng. */
  usedClassNames: Set<string>;
  /** Bộ đếm trùng theo từng base đã cắt trần, để không phải quét lại từ 2 mỗi lần cấp. */
  nextClassCounter: Map<string, number>;
  /** Ký hiệu typing mà lần render này đã dùng. */
  typing: Set<string>;
}

/** Một khung con đã lên lịch, kèm ngữ cảnh đặt tên và độ sâu list[…] hiện tại. */
interface PyFrameChild {
  /** Node schema của con. */
  readonly schema: JsonSchemaNode;
  /** Tên lớp gốc cho object con (hoặc tên kế thừa từ khung cha). */
  readonly className: string;
  /** Số bracket list[ đang mở tại điểm phát biểu thức này. */
  readonly listDepth: number;
}

/** Một khung của phép đi bộ bằng NGĂN XẾP TƯỜNG MINH (không đệ quy theo độ sâu schema). */
interface PyFrame {
  /** Node schema của khung. */
  readonly schema: JsonSchemaNode;
  /** Tên lớp gốc của khung. */
  readonly className: string;
  /** Pha hiện tại: start mới mở, children đang gom kiểu con. */
  phase: "start" | "children";
  /** Số bracket list[ đang mở tại khung này. */
  readonly listDepth: number;
  /** Các con đã lên lịch (chỉ khung oneOf/array/typeddict mới có). */
  children: PyFrameChild[];
  /** Chỉ số con kế tiếp cần đẩy lên ngăn xếp. */
  childIndex: number;
  /** Kiểu đã render của từng con, đúng thứ tự children. */
  childTypes: string[];
  /** Các cặp [tên trường, schema] của khung typeddict. */
  entries: ReadonlyArray<readonly [string, JsonSchemaNode]>;
  /** Loại khung đã chốt ở pha start. */
  kind?: "oneOf" | "array" | "typeddict";
  /** Node của khung typeddict (đọc required và additionalProperties). */
  node?: JsonSchemaNode;
  /** Tên lớp ĐÃ CẤP cho khung typeddict. */
  allocated?: string;
}

/**
 * Tiền tố dòng ở độ sâu indent (bốn dấu cách mỗi cấp, khớp đầu ra PEP 8).
 * Nhận: indent — độ sâu 0-based.
 * Trả: chuỗi tiền tố.
 */
function pad(indent: number): string {
  return "    ".repeat(indent);
}

/**
 * Các code point Cc sống sót qua phép gộp khoảng trắng trong {@link describe} và không có dạng in
 * được: điều khiển C0, DEL, và điều khiển C1. Chỉ U+0009 tới U+000D vắng mặt vì \s của ECMAScript
 * đã gộp chúng — \s là TAB/VT/FF/SP/NBSP/ZWNBSP/Zs cộng LF/CR/LS/PS, nên không code point C1 nào
 * nằm trong đó và cả khối U+0080 tới U+009F tới đây nguyên vẹn. Đó không phải đầu vào giả định: đó
 * là thứ byte Windows-1252 0x80 tới 0x9F (nháy cong, em dash) trở thành khi giải mã như Latin-1.
 *
 * CPython từ chối thẳng source chứa NUL (SyntaxError: source code string cannot contain null
 * bytes), dù nó nằm trong docstring hay comment, nên một byte như vậy ở bất kỳ đâu trong mô tả
 * schema sẽ làm cả SDK sinh ra không parse được — dưới mode 'ptc' đó là khai báo DUY NHẤT về tool.
 * Phần còn lại hợp lệ nhưng vô hình; escape bằng cùng luật giữ văn bản đọc được và cách xử lý đồng
 * nhất.
 *
 * Ranh giới là CATEGORY chứ không phải từng code point: \xNN phủ U+0000 tới U+00FF nên một dạng
 * escape phủ đúng Cc. Các ký tự định dạng Cf vô hình đi qua theo thiết kế — trong đó chỉ U+00AD
 * soft hyphen vừa \xNN, và escape riêng nó trong khi U+200B ZWSP, U+200E/U+200F bidi mark và
 * U+2060 word joiner đi qua sẽ để lại một luật không ra hình category cũng không ra hình
 * addressability. Cả họ hợp lệ ở cả hai nơi tiêu thụ, vì chỉ LF và CR kết thúc string literal
 * Python hay comment #. Tập đó là của tokenizer, không phải của str.splitlines(): NEL (U+0085), LS
 * (U+2028) và PS (U+2029) tách chuỗi lúc chạy nhưng không kết thúc một dòng vật lý trong source —
 * đo trên CPython 3.9.6 và 3.12.13, mỗi cái được chấp nhận ở cả hai vị trí với giá trị khứ hồi
 * nguyên vẹn — nên chúng an toàn khi đi trần tới chỗ phát văn bản, mà với cả ba là JSON.stringify,
 * tại hai điểm gọi: đường literal của {@link pyScalar}, và comment tên tool dạng subscript (tên mang
 * bất kỳ ký tự nào trong số đó luôn tới đó, vì không cái nào là XID_Continue). Đường description
 * escape NEL theo lớp trên và gộp LS/PS trong phép gộp \s+ của {@link describe}, cả hai đều là \s.
 */
const UNPRINTABLE = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/g;

/**
 * Các code point surrogate LẺ, được {@link describe} escape thành \uNNNN — dạng riêng của nó, vì
 * \xNN dừng ở U+00FF. Cờ u là thứ khiến đây là các surrogate LẺ: ở chế độ Unicode, một cặp
 * well-formed là MỘT code point astral nằm ngoài D800 tới DFFF, nên emoji trong mô tả đi qua nguyên
 * vẹn.
 *
 * Đây là ca NUL của {@link UNPRINTABLE}, không phải ca ký tự vô hình. Source Python phải mã hoá
 * được UTF-8 mà surrogate lẻ thì không, nên compile() ném UnicodeEncodeError: surrogates not allowed
 * với một cái bất kỳ ở đâu trong văn bản — đo trên 3.9 cho cả string literal lẫn comment #. Mô tả
 * tool raw hay MCP tới được đây: JSON.parse trên escape "\ud800" của đường truyền cho ra đúng một
 * code point như vậy.
 */
const LONE_SURROGATE = /[\ud800-\udfff]/gu;

/**
 * Mô tả MỘT DÒNG đã gộp của một node schema (ổn định từng byte qua mọi thay đổi định dạng), hoặc
 * undefined khi node không mang mô tả. Mọi chỗ gọi đều truyền một object — node thuộc tính đã
 * validate, bản thân ToolSdkSchema, hay wrapper { description } mà {@link docLines} tự dựng — nên chỉ
 * trường description cần canh. Mô tả gộp còn RỖNG (chuỗi rỗng, hoặc chỉ khoảng trắng) cũng là
 * undefined: nó mô tả node chẳng hơn gì mô tả vắng mặt, và phát ra sẽ để lại docstring """ rỗng hay
 * một dòng #   trơ trong SDK. Chỉ khoảng trắng ECMAScript được gộp, nên mô tả gồm khoảng trắng cộng
 * một ký tự điều khiển còn sống KHÔNG phải vắng mặt: nó gộp thành escape nhìn thấy được của ký tự đó.
 *
 * Ký tự điều khiển sót lại sau phép gộp được render thành escape \xNN (xem {@link UNPRINTABLE}) và
 * surrogate lẻ thành escape \uNNNN (xem {@link LONE_SURROGATE}); backslash của chính escape được cả
 * hai nơi tiêu thụ phát nguyên văn, vì {@link docLines} nhân đôi nó thành escape source Python còn
 * comment # mang nó y nguyên.
 * Nhận: schema — object mang trường description (node schema đã validate, hoặc wrapper).
 * Trả: mô tả một dòng đã gộp, hoặc undefined khi không có gì để phát.
 */
function describe(schema: Described): string | undefined {
  const description = schema.description;
  if (typeof description !== "string") return undefined;
  const collapsed = description
    .replace(/\s+/g, " ")
    .replace(UNPRINTABLE, (char) => `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
    .replace(LONE_SURROGATE, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`)
    .trim();
  return collapsed.length === 0 ? undefined : collapsed;
}

/**
 * Docstring một dòng cho description của tool, hoặc không dòng nào khi không có mô tả.
 * Backslash được nhân đôi trước, mọi nháy đều được escape, và backslash lẻ ở cuối không thể sống
 * sót: mô tả kết thúc bằng " hoặc bằng một số lẻ backslash sẽ gộp vào (hay escape mất) nháy ba đóng
 * và làm khối sinh ra — SDK DUY NHẤT của mode 'ptc' — thành Python sai cú pháp.
 * Nhận: description — mô tả thô của tool (có thể undefined); indent — độ sâu đặt dòng.
 * Trả: mảng dòng (rỗng khi không có mô tả).
 */
function docLines(description: string | undefined, indent: number): string[] {
  const collapsed = describe({ description });
  if (collapsed === undefined) return [];
  const escaped = collapsed.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return [`${pad(indent)}"""${escaped}"""`];
}

/**
 * Đổi một tên thành định danh kiểu Python kiểu CamelCase: ký tự không phải định danh tách từ, dấu _
 * cũng tách (nó là XID_Continue, nên tập tách phải gọi tên nó), và phần đầu không mở được định danh
 * thì nhận tiền tố Tool. Unicode sống sót, nên trường 路径 cho tên lớp dựa trên 路径 thay vì gộp về
 * đúng tiền tố trơ. Ký tự không phải XID_Continue tách kể cả khi nó là chữ cái, nên tên mà phép gấp
 * NFKC sẽ rời tập định danh không được mang qua — tập tách là của văn phạm, không phải xấp xỉ ASCII.
 *
 * Kết quả được chuẩn hoá NFKC: đây là tên SINH RA, không bao giờ so với khoá JSON, nên chuẩn hoá
 * miễn phí và giữ cho thứ CPython biên dịch trùng với thứ được phát — khác {@link isBareIdentifier},
 * nơi phải từ chối thẳng tên không ổn định. Chuẩn hoá SAU quyết định tiền tố là thứ khiến điều đó
 * đúng tại đường nối mà tiền tố tạo ra: Tool + đầu là dấu tổ hợp thì hợp nhất ở đó (U+0301 cho Tooĺ,
 * U+013A), nên chỉ chuẩn hoá phần không tiền tố sẽ phát một tên mà CPython biên dịch thành ký hiệu
 * khác. Lời gọi thứ hai là idempotent trên nhánh không tiền tố.
 *
 * Tập tách, phép thử đầu và toUpperCase() đều đọc bảng Unicode của engine, nên hàm này mang đúng độ
 * lệch phiên bản {@link isBareIdentifier} mô tả, bằng những đường độc lập với vị từ đó.
 * Nhận: raw — tên trường hoặc tên tool cần đổi.
 * Trả: một đoạn tên lớp an toàn để phát.
 */
function camelCase(raw: string): string {
  const joined = raw
    .split(/[^\p{XID_Continue}]+|_+/u)
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("")
    .normalize("NFKC");
  return (/^\p{XID_Start}/u.test(joined) ? joined : `Tool${joined}`).normalize("NFKC");
}

/** Trần độ dài base của tên lớp, giữ mỗi tên phát ra — và tổng văn bản — tuyến tính theo độ sâu schema. */
const MAX_CLASS_NAME_BASE = 120;

/**
 * Độ sâu list[…] LỒNG NHAU tối đa phát vào một annotation trước khi kiểu phần tử hạ cấp thành Any.
 * Tokenizer CPython từ chối một dòng logic có hơn 200 bracket mở đồng thời (MAXLEVEL, SyntaxError:
 * too many nested parentheses), nên chuỗi array sâu hơn thế sẽ render một khối SDK không phải Python
 * hợp lệ — đúng kiểu hỏng mà phép escape docstring trong {@link docLines} tồn tại để ngăn. 180 chừa
 * chỗ cho vài bracket mà một annotation có thể thêm quanh chuỗi, tất cả đều tính vào cùng giới hạn.
 * Theo từng điểm phát, đếm bracket mở tại điểm trong cùng của chuỗi:
 *
 * - Annotation trả về, async def f(self, args: X) -> chain: 180 list[ cộng một Literal[ trong cùng.
 *   Dấu ( của danh sách tham số đã đóng ở ) trước ->, nên nó KHÔNG mở ở đây: 181.
 * - Trường TypedDict, field: NotRequired[chain] — một dòng thân class không có bracket nào khác mở,
 *   và các con khởi đầu ở listDepth: 1 để dành chỗ cho NotRequired[, nên 179 list[ cộng Literal[:
 *   181. Trường bắt buộc dùng chung điểm khởi đầu đó cho đồng nhất, tiêu một mức độ sâu biểu diễn
 *   được vào bracket mà chúng không bao giờ phát.
 * - Annotation tham số, async def f(self, args: chain) -> Y: dấu ( VẪN còn mở quanh nó: 180 list[
 *   cộng Literal[ cộng paren, 182, ca xấu nhất. Chỉ với tới được qua một register() raw có
 *   parameters là array vào từ gốc chỉ qua các nhánh oneOf — chính array gốc, hoặc một cái lồng dưới
 *   bất kỳ độ sâu union nào, vì nhánh thừa hưởng nguyên độ sâu bao ngoài (A | B không mở bracket
 *   nào). Tổ tiên object loại nó khỏi ca này: các trường của nó khởi động lại chuỗi ở điểm 181.
 *   defineTool biên dịch một object gốc, nên annotation là tên lớp TypedDict trần hoặc dict[str, Any]
 *   một bracket khi object đó hạ cấp — không bao giờ là chuỗi.
 *
 * Đây là giới hạn VĂN PHẠM của CPython, không phải lựa chọn triển khai, nên nó cố định thay vì cấu
 * hình được. Renderer ts-types anh em không cần bản đối ứng: không gì trong văn phạm TypeScript chặn
 * độ sâu lồng, và khối SDK của nó không bao giờ được type-check. Chỉ độ sâu bracket được đếm — oneOf
 * render thành chuỗi A | B phẳng và object lồng render thành các câu class riêng, nên không cái nào
 * tích bracket mở ở bất kỳ độ sâu nào. Bất biến mà trần này phục vụ là TÍNH HỢP LỆ VĂN PHẠM; xem
 * nhánh oneOf trong {@link renderType} cho giới hạn interpreter duy nhất cố ý để không chặn.
 */
const MAX_LIST_NESTING = 180;

/**
 * Cắt base của tên lớp về trần {@link MAX_CLASS_NAME_BASE} (xem các chỗ gọi để biết vì sao cắt trần
 * giữ phép render tuyến tính). slice đếm đơn vị UTF-16, nên một ký tự astral nằm vắt qua ranh giới sẽ
 * bị cắt đôi và để lại surrogate lẻ — không phải ký tự định danh, thậm chí không phải văn bản
 * well-formed; bỏ nó đi thay vì phát ra.
 * Nhận: base — tên lớp gốc chưa cắt.
 * Trả: base đã cắt trần (không bao giờ kết thúc bằng nửa surrogate).
 */
function capClassNameBase(base: string): string {
  if (base.length <= MAX_CLASS_NAME_BASE) return base;
  const capped = base.slice(0, MAX_CLASS_NAME_BASE);
  return /[\uD800-\uDBFF]$/.test(capped) ? capped.slice(0, -1) : capped;
}

/**
 * Giành một tên lớp DUY NHẤT từ base, thêm hậu tố 2, 3, … khi trùng. Base được cắt trần
 * {@link MAX_CLASS_NAME_BASE} trước: tên lớp con suy từ tên ĐÃ CẤP của cha (ParentChild), nên một
 * schema không chặn gồm toàn object một trường sẽ làm mỗi tên dài thêm một trường mỗi cấp và tổng
 * mọi tên thành Θ(depth²). Cắt base giữ mỗi tên — và tổng văn bản phát ra — tuyến tính theo độ sâu.
 * Va chạm nối tiếp từ bộ đếm theo base trong state.nextClassCounter thay vì quét lại từ 2, nên một
 * chuỗi sâu dùng chung một base đã cắt vẫn O(1) mỗi lần cấp (khấu hao) thay vì Θ(depth²) thời gian.
 * Nhận: base — tên lớp gốc; state — trạng thái render đang tích luỹ.
 * Trả: tên lớp chưa từng dùng.
 */
function allocateClassName(base: string, state: PyRenderState): string {
  const capped = capClassNameBase(base);
  let name = capped;
  if (state.usedClassNames.has(name)) {
    let n = state.nextClassCounter.get(capped) ?? 2;
    while (state.usedClassNames.has(`${capped}${n}`)) n++;
    name = `${capped}${n}`;
    state.nextClassCounter.set(capped, n + 1);
  }
  state.usedClassNames.add(name);
  return name;
}

/**
 * Nối thêm một đoạn vào base tên lớp của cha, cắt trần kết quả ở {@link MAX_CLASS_NAME_BASE}.
 * Cắt trần NGAY KHI TRUYỀN (không chỉ trong {@link allocateClassName}) giữ mỗi cấp O(1): một chuỗi
 * oneOf hay object sâu sẽ mang một ConsString ngày càng lớn xuống cây và hiện thực hoá lại (qua
 * .length/.slice) ở mỗi cấp — Θ(depth²). Base bị chặn cộng bộ đếm va chạm vẫn cho tên duy nhất.
 *
 * Phép nối được chuẩn hoá NFKC vì hai phía chuẩn hoá riêng nhưng phép nối của chúng thì không nhất
 * thiết: base kết thúc bằng jamo L hay âm tiết LV của Hangul hợp nhất với đầu jamo V/T theo sau (가 +
 * ᆨ cho 각), nên tên lớp phát ra sẽ khác ký hiệu CPython biên dịch, và hai tên khác byte có thể gấp
 * về một — usedClassNames chống trùng theo BYTE THÔ nên bộ đếm va chạm sẽ không thấy. Chuẩn hoá tốn
 * O(cap + segment) mỗi cấp, cùng bậc với phép slice mà nó nuôi. Hai điểm nối còn lại không cần bản
 * đối ứng: Args/Output bắt đầu bằng A/O và hậu tố của {@link allocateClassName} là chữ số, không cái
 * nào hợp nhất ngược về trước.
 * Nhận: base — tên lớp của cha; segment — đoạn tên của con.
 * Trả: base mới đã nối và cắt trần.
 */
function childClassName(base: string, segment: string): string {
  return capClassNameBase(`${base}${segment}`.normalize("NFKC"));
}

/**
 * Render MỘT scalar đã validate thành literal Python (True/False, chuỗi bọc nháy kiểu JSON, số trần).
 * null không tới được đây: kiểu null render thẳng thành None, và validator hợp nhất từ chối mục
 * const/enum null trên mọi kiểu scalar khác.
 *
 * Số nguyên vượt vùng an toàn lấy chữ số từ BigInt thay vì String: số nguyên Python có độ chính xác
 * tuỳ ý, nên chữ số phát ra CHÍNH LÀ giá trị model lập trình dựa vào, còn String có thể cho một số
 * nguyên khác số double đang giữ (2 ** 60 in ra …847000 đã làm tròn, không phải …846976) hoặc không
 * cho literal nguyên nào (1e21 in ra 1e+21). String làm tròn không phải lỗi của nó: Number::toString
 * phát chuỗi thập phân NGẮN NHẤT đọc lại đúng double đó rồi đệm số 0 tới số mũ; khi chuỗi ngắn nhất
 * ngắn hơn giá trị chính xác của double, các chữ số đệm kia đặt tên một số nguyên mà không double nào
 * giữ. Truyền ngược lại sẽ phải vượt biên tham số dưới dạng số JSON — lại là double — nên SDK sẽ ghi
 * một giá trị không chương trình nào truyền được. BigInt không cần chia nhánh: nơi String đã chính
 * xác (2 ** 53, 1e20) hai cách đồng ý từng byte, nơi chưa thì BigInt mới là đúng. Bản TS không cần
 * bản đối ứng: literal của nó được parser JS đọc lại thành đúng double đó.
 *
 * JSON.stringify cũng là thứ duy nhất giữ đường này parse được, và nó phủ cả hai lớp hiểm hoạ: hai
 * loại code point CPython từ chối ở bất kỳ đâu trong source — NUL trong C0, và cả khối D800–DFFF
 * không ghép cặp (escape theo ES2019 well-formed stringification mà dải engine bảo đảm) — lẫn các
 * loại phá riêng dòng này: dấu nháy kép trần đóng literal sớm, backslash lẻ cuối ăn mất nháy đóng,
 * và LF/CR trần kết thúc dòng trước dấu chấm hết. Đường description mang {@link UNPRINTABLE} và
 * {@link LONE_SURROGATE} vì không có gì bọc nháy nó, và gộp newline trong {@link describe}.
 *
 * Điều đó dựa vào một trùng hợp đáng gọi tên: mọi escape JSON.stringify có thể phát đều CŨNG là
 * escape Python cùng nghĩa, nên Literal[…] vừa parse được vừa giải mã về đúng giá trị schema khai.
 * DEL, các điều khiển C1 (NEL trong đó) và LS/PS (U+2028/U+2029) đi ra TRẦN — hợp lệ nhưng vô hình,
 * đúng từng byte như bản TS; escape chúng là thay đổi của CẢ HAI bản.
 * Nhận: value — scalar đã validate (chuỗi, số, boolean).
 * Trả: văn bản literal Python.
 */
function pyScalar(value: string | number | boolean | null): string {
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value)) {
    return BigInt(value).toString();
  }
  return String(value);
}

/**
 * Render một scalar const/enum đã validate thành Literal[…], lùi về kiểu RỘNG khi không có ràng buộc.
 * Cố ý lệch PEP 586 (chuẩn hạn chế tham số Literal vào int/bool/str/bytes/enum/None): một số KHÔNG
 * nguyên ở const/enum phát literal float (Literal[1.5]) mà checker nghiêm sẽ từ chối. Số nguyên thì
 * không lệch — {@link pyScalar} phát chữ số int, kể cả các giá trị vượt vùng an toàn được mở rộng
 * qua BigInt, và PEP 586 nhận tham số int. Dù sao cũng vô hại — stub chỉ là văn bản tư vấn cho
 * prompt, chỉ cần parse được — và giữ đúng giá trị là cách truyền ràng buộc cho model.
 * Nhận: node — node scalar đã validate; broad — kiểu rộng khi không có ràng buộc; state — trạng thái
 * render đang tích luỹ ký hiệu typing.
 * Trả: văn bản kiểu Python.
 */
function renderConstrainedScalar(node: JsonSchemaNode, broad: string, state: PyRenderState): string {
  if (node.const !== undefined) {
    state.typing.add("Literal");
    return `Literal[${pyScalar(node.const)}]`;
  }
  if (node.enum !== undefined) {
    state.typing.add("Literal");
    return `Literal[${node.enum.map(pyScalar).join(", ")}]`;
  }
  return broad;
}

/**
 * Ánh xạ MỘT node JSON-Schema sang biểu thức kiểu Python, luồn state để gom khai báo TypedDict và ký
 * hiệu typing mà một lần render đầy đủ cần. className là tên cấp cho một node object có properties
 * (và là tiền tố cho các object lồng bên trong). Xử lý mọi cấu trúc của schema hợp nhất — oneOf (→
 * X | Y), const/enum (→ Literal[…]), integer (→ int), null (→ None) — và hạ cấp schema không hỗ trợ
 * hay sai định dạng về Any mà KHÔNG ném, giữ đúng lập trường tin-sau-validate của renderer
 * ts-types.ts anh em. {@link jsonSchemaToPy} là điểm vào không ngữ cảnh; đây là lõi có gom trạng thái.
 * Nhận: schema — node JSON-Schema (hình dạng tuỳ ý; đầu vào thù địch bị hạ cấp); className — tên
 * lớp gốc, chuỗi rỗng nghĩa là không có ngữ cảnh đặt tên; state — trạng thái render đang tích luỹ.
 * Trả: văn bản kiểu Python cho node.
 */
function renderType(schema: unknown, className: string, state: PyRenderState): string {
  /** Mở một khung ở pha start: chưa có con, chưa có kiểu con. */
  const newFrame = (frameSchema: JsonSchemaNode, frameClassName: string, listDepth: number): PyFrame => ({
    schema: frameSchema,
    className: frameClassName,
    phase: "start",
    listDepth,
    children: [],
    childIndex: 0,
    childTypes: [],
    entries: [],
  });
  try {
    // Validate TOÀN CÂY một lần rồi tin nó — đúng khế ước mà renderer ts-types anh em theo ở một biên
    // cùng tiến trình có kiểu. Mọi node sau điểm này là node JSON-schema đã validate, nên phép đi bộ
    // đọc trường của nó mà không kiểm lại. Một schema không hỗ trợ hay sai định dạng ném Ở ĐÂY (trước
    // khi phát bất cứ thứ gì) và hạ cấp về Any — bản đối ứng Python của unknown bên TS.
    assertSupportedJsonSchema(schema);
    const frames: PyFrame[] = [newFrame(schema, className, 0)];
    let result: string | undefined;
    /** Đóng khung trên cùng: đẩy biểu thức kiểu vào cha, hoặc chốt kết quả gốc. */
    const finish = (type: string): void => {
      frames.pop();
      const parent = frames.at(-1);
      if (parent === undefined) result = type;
      else parent.childTypes.push(type);
    };
    /* jscpd:ignore-start -- bộ khung đi bộ bằng ngăn xếp tường minh cố ý song song với
       renderSupportedSchema của ts-types.ts; hai renderer anh em giữ hình dạng đối xứng. */
    while (frames.length > 0) {
      const frame = frames.at(-1);
      /* v8 ignore next -- điều kiện vòng lặp bảo đảm luôn có khung hiện tại. */
      if (frame === undefined) break;
      if (frame.phase === "children") {
        if (frame.childIndex < frame.children.length) {
          const child = frame.children[frame.childIndex];
          /* v8 ignore next -- childIndex bị chặn bởi children.length. */
          if (child === undefined) throw new Error("missing python render child");
          frame.childIndex++;
          frames.push(newFrame(child.schema, child.className, child.listDepth));
          continue;
        }
        if (frame.kind === "oneOf") {
          // Nối DẦN (template literal, không phải Array.join): V8 dựng ConsString lười, nên một chuỗi
          // oneOf sâu hiện thực hoá một lần ở gốc thay vì hiện thực hoá lại chuỗi đã tích ở mỗi cấp
          // (join sẽ làm thế, khiến thành Θ(depth²)). Điều này khớp độ lười template literal của nhánh
          // array và cách tiếp cận tài liệu ghép được của ts-types — cả phép đi bộ vẫn tuyến tính.
          let union = "";
          for (const [index, childType] of frame.childTypes.entries()) {
            union = index === 0 ? childType : `${union} | ${childType}`;
          }
          finish(union);
          continue;
        }
        /* jscpd:ignore-end */
        if (frame.kind === "array") {
          // list[A | B] không cần ngoặc trong Python. Khung array luôn lên lịch đúng một con, nên kiểu
          // của nó luôn có mặt.
          /* v8 ignore next -- nhánh ?? cần khung array không con, thứ start không bao giờ dựng. */
          finish(`list[${frame.childTypes[0] ?? "Any"}]`);
          continue;
        }
        // typeddict: lắp SAU khi các con xong, nên mọi lớp lồng mà lớp này tham chiếu đã được khai
        // (thứ tự khai báo = thứ tự tham chiếu).
        const node = frame.node;
        const name = frame.allocated;
        /* v8 ignore next -- khung typeddict luôn đặt node và allocated ở pha start. */
        if (node === undefined || name === undefined) throw new Error("missing typeddict frame state");
        const required = new Set(node.required);
        const lines = [`class ${name}(TypedDict):`];
        for (let index = 0; index < frame.entries.length; index++) {
          const entry = frame.entries[index];
          const fieldType = frame.childTypes[index];
          /* v8 ignore next -- entries và childTypes tương ứng một-một. */
          if (entry === undefined || fieldType === undefined) throw new Error("missing typeddict field type");
          const [field, fieldSchema] = entry;
          // Node cha đã qua assertSupportedJsonSchema, nên mọi giá trị property là node đã validate.
          const description = describe(fieldSchema);
          if (description !== undefined) lines.push(`${pad(1)}# ${description}`);
          if (required.has(field)) {
            lines.push(`${pad(1)}${field}: ${fieldType}`);
          } else {
            state.typing.add("NotRequired");
            lines.push(`${pad(1)}${field}: NotRequired[${fieldType}]`);
          }
        }
        // Cú pháp TypedDict không diễn đạt được tính MỞ, nên object mở nói điều đó ngay trong khối:
        // annotation dù sao chỉ là tư vấn, và mode 'ptc' bỏ schema gốc, khiến dòng này là tín hiệu DUY
        // NHẤT cho model rằng khoá thừa được chấp nhận.
        if (node.additionalProperties !== false) {
          lines.push(`${pad(1)}# Additional keys beyond those declared are allowed.`);
        }
        // Object RỖNG đóng vẫn cần thân class (pass) mới hợp lệ Python; chính sự rỗng đã khai là thông tin.
        if (lines.length === 1) lines.push(`${pad(1)}pass`);
        state.classes.push(lines.join("\n"));
        finish(name);
        continue;
      }
      frame.phase = "children";
      const node = frame.schema;
      if (node.oneOf !== undefined) {
        frame.kind = "oneOf";
        // Union render thành A | B — không bracket riêng, nên các nhánh thừa hưởng nguyên độ sâu bao ngoài.
        //
        // Độ DÀI union cố ý không chặn, khác độ sâu list. Hai giới hạn khác nhau về BẢN CHẤT: hơn 200
        // bracket mở là SyntaxError của tokenizer, nên văn bản không phải Python; một chuỗi
        // A | B | … dài thì hợp lệ văn phạm ở mọi độ dài và chỉ đánh bại đệ quy C của CPython khi
        // compile() đi dọc sống BinOp lồng trái (đo được: 1.000 nhánh biên dịch được, 5.000 ném
        // RecursionError). Khối này là văn bản prompt — không gì biên dịch nó — nên giới hạn đó vô
        // nghĩa ở đây, còn chặn lại sẽ gỡ bỏ các test chuỗi sâu đang ghim thời gian tuyến tính của phép
        // đi bộ và trần truyền tên lớp. Chuẩn mà renderer này giữ là TÍNH HỢP LỆ VĂN PHẠM, không phải
        // khả năng biên dịch dưới ngăn xếp của một interpreter.
        frame.children = node.oneOf.map((branch, index) => ({
          schema: branch,
          className: childClassName(frame.className, `${index + 1}`),
          listDepth: frame.listDepth,
        }));
        continue;
      }
      if (node.type === undefined) {
        state.typing.add("Any");
        finish("Any");
        continue;
      }
      switch (node.type) {
        case "string":
          finish(renderConstrainedScalar(node, "str", state));
          break;
        case "number":
          finish(renderConstrainedScalar(node, "float", state));
          break;
        case "integer":
          finish(renderConstrainedScalar(node, "int", state));
          break;
        case "boolean":
          finish(renderConstrainedScalar(node, "bool", state));
          break;
        case "null":
          finish("None");
          break;
        case "array": {
          if (node.items === undefined) {
            state.typing.add("Any");
            finish("list[Any]");
            break;
          }
          // Quá MAX_LIST_NESTING thì thêm một list[ nữa sẽ đẩy annotation vượt giới hạn bracket mở của
          // CPython và làm cả khối SDK không parse được, nên chuỗi hạ cấp tại đây — annotation dù sao
          // cũng vô dụng, mà cái này lại là Python hợp lệ.
          if (frame.listDepth >= MAX_LIST_NESTING) {
            state.typing.add("Any");
            finish("Any");
            break;
          }
          // Array của object đặt tên kiểu phần tử theo trường array.
          frame.kind = "array";
          frame.children = [{ schema: node.items, className: frame.className, listDepth: frame.listDepth + 1 }];
          break;
        }
        case "object": {
          // properties thiếu là map property RỖNG, đúng như validator hợp nhất và renderer TS đọc —
          // KHÔNG phải hình dạng không biết. Tính mở của object rỗng kết quả được quyết bên dưới, nên
          // object rỗng đóng vẫn khai một TypedDict rỗng thay vì dict[str, Any] dễ dãi.
          const entries = Object.entries(node.properties ?? {});
          // className RỖNG đánh dấu điểm vào không ngữ cảnh jsonSchemaToPy: không có ngữ cảnh đặt tên
          // để khai vào, nên hạ cấp. Đây là className của LỜI GỌI, không phải frame.className: dấu hiệu
          // thuộc cả phép đi bộ, còn khung thì truyền một tên đã suy ra (nhánh oneOf của gốc không ngữ
          // cảnh nhận tên suy từ chỉ số 1 — childClassName nối và cắt trần, nó không đi qua camelCase),
          // nên đọc theo từng khung sẽ khai những lớp mà bên gọi không có cách nào nhận, dưới một tên
          // thậm chí không phải định danh hợp lệ: class 1(TypedDict):. Một tên trường không phải thuộc
          // tính Python hợp lệ thì không diễn đạt được thành trường TypedDict cú pháp class, nên object
          // như vậy hạ cấp TOÀN BỘ. Tên bắt đầu bằng hai gạch dưới mà không phải dunder (__token) sẽ bị
          // NAME-MANGLE trong cú pháp class (_ClassName__token), mô tả một khoá JSON khác schema đã
          // đăng ký — hạ cấp như mọi tên trường không diễn đạt được khác.
          if (
            className === "" ||
            !entries.every(
              ([name]) => isBareIdentifier(name) && !RESERVED.has(name) && !(name.startsWith("__") && !name.endsWith("__")),
            )
          ) {
            state.typing.add("Any");
            finish("dict[str, Any]");
            break;
          }
          // Object rỗng MỞ là dict bất kỳ; object rỗng ĐÓNG khai một TypedDict rỗng để "không nhận khoá
          // nào" sống sót vào SDK.
          if (entries.length === 0 && node.additionalProperties !== false) {
            state.typing.add("Any");
            finish("dict[str, Any]");
            break;
          }
          frame.kind = "typeddict";
          frame.node = node;
          frame.allocated = allocateClassName(frame.className, state);
          state.typing.add("TypedDict");
          frame.entries = entries;
          // Annotation của một trường là dòng logic RIÊNG, nên độ sâu lồng khởi động lại — ở 1, dành
          // chỗ cho bracket mà NotRequired[…] của trường tuỳ chọn bọc quanh nó. frame.allocated đã được
          // gán ba câu lệnh phía trên; nhánh ?? chỉ dành cho hệ kiểu.
          /* v8 ignore next -- allocated luôn được đặt trước khi dựng các con. */
          frame.children = entries.map(([field, child]) => ({
            schema: child,
            className: childClassName(frame.allocated ?? "", camelCase(field)),
            listDepth: 1,
          }));
          break;
        }
        /* v8 ignore next 4 -- assertSupportedJsonSchema đã thu hẹp hợp kiểu ĐÓNG này. */
        default: {
          state.typing.add("Any");
          finish("Any");
        }
      }
    }
    /* v8 ignore next -- mọi khung gốc sinh đúng một biểu thức. */
    return result ?? "Any";
  } catch {
    // Schema không hỗ trợ hay sai định dạng đã hỏng validate (trước mọi phép phát), hoặc một bất biến
    // nội bộ không tới được đã vỡ. Cả hai hạ cấp node về Any thay vì làm sập việc lắp prompt — bản đối
    // ứng Python của nhánh unknown bên TS.
    state.typing.add("Any");
    return "Any";
  }
}

/**
 * Ánh xạ MỘT node JSON-Schema sang biểu thức kiểu Python KHÔNG NGỮ CẢNH, lấy từ module typing. Xử lý
 * mọi cấu trúc của schema hợp nhất — object (hạ cấp thành dict[str, Any]: đặt tên TypedDict cần ngữ
 * cảnh render mà {@link renderToolsSdkPy} cung cấp), const/enum (→ Literal[…]), oneOf (→ union),
 * string/number/integer/boolean/null, array (items → list[T]) — và trả Any cho schema không hỗ trợ
 * hay sai định dạng, khớp nhánh unknown của bản TS. Chú thích kiểu trong SDK phát ra chỉ là tư vấn:
 * Python không cưỡng chế chúng lúc chạy.
 * Nhận: schema — node JSON-Schema (hình dạng tuỳ ý; đầu vào thù địch bị hạ cấp chứ không ném).
 * Trả: văn bản kiểu Python.
 * @throws Không ném: mọi lỗi kiểm tra hay đi bộ đều bị nuốt và hạ cấp về Any.
 */
export function jsonSchemaToPy(schema: unknown): string {
  // Một state dùng-một-lần mà bộ gom lớp không bao giờ thoát ra: object có properties không có chỗ
  // khai TypedDict và hạ cấp thành dict[str, Any]. renderToolsSdkPy mới là bên đi đường TypedDict có tên.
  return renderType(schema, "", { classes: [], usedClassNames: new Set(), nextClassCounter: new Map(), typing: new Set() });
}

/** Khế ước sử dụng cố định mà model thấy, render phía trên các khai báo. */
const SDK_INSTRUCTIONS = `## Writing code for run_code

\`run_code\` takes two required arguments: \`description\`, a short summary of what the program does, and \`code\`, the program to execute. At run time exactly two of the names declared below are bound: \`tools\` and \`ToolCallError\`. Everything else is a STATIC STUB describing argument and return types — in particular the \`TypedDict\` classes do NOT exist at run time, so build arguments as plain \`dict\`/\`list\` JSON values: \`await tools.name({"field": 1})\`, never \`FooArgs(field=1)\`, which raises \`NameError\`. Inside the program:

- Call tools as \`await tools.name(args)\` — subscript access for exotic, reserved, or underscore-leading names: \`await tools["my-tool"](args)\`. Every call resolves to the tool's typed canonical JSON value (each method's return type below). Tool arguments must be lossless JSON.
- A FAILED tool call raises \`ToolCallError\`, whose \`toolName\` identifies the failed tool and whose message is human-readable — wrap in \`try/except\` to handle and continue.
- Independent read-only calls MAY overlap under \`asyncio.gather\` (safe calls run concurrently; mutating calls run alone, in submission order). Sequence dependent work with \`await\`.
- Only values emitted as program output enter the conversation. A successful tool result containing an image is attached after the run so you can inspect it on the next step; every other intermediate result stays out of the conversation, so extract just what you need.

The available tools:`;

/**
 * Render TRỌN mục prompt tools:sdk dưới runtime.language === 'python': phần hướng dẫn dùng kiểu
 * Python cộng một TypedDict CÓ TÊN cho mỗi object tham số hay đầu ra của tool (và cho mỗi object lồng
 * bên trong), cùng một method await được cho mỗi tool hiển thị trên protocol Tools — tham số có kiểu
 * vào, giá trị đầu ra chuẩn của tool ra — với singleton tools: Tools để model gọi vào. Dòng import
 * typing liệt kê ĐÚNG các ký hiệu mà lần render đã dùng.
 *
 * Tất định — tool phát theo thứ tự tên từ điển, và các khai báo class đứng trước protocol theo đúng
 * thứ tự đó (lớp lồng trước lớp cha tham chiếu chúng), nên một tập tool không đổi cho ra văn bản
 * giống nhau TỪNG BYTE qua mọi lần lắp. Phép sắp xếp không phải thứ tự toàn phần trên các tên bằng
 * byte, nên hai schema trùng tên sẽ render theo thứ tự tham số; map năng lực hiển thị của bên gọi
 * được khoá theo tên, nên đầu vào không bao giờ mang bản trùng.
 * Nhận: schemas — các schema tool cộng schema đầu ra chuẩn cần khai (bên gọi tự loại run_code).
 * Trả: văn bản trọn mục prompt.
 * @throws {TypeError} khi schemas không phải mảng (đầu vào sai kiểu ở biên runtime) — không nhánh nào
 * bắt lại.
 */
export function renderToolsSdkPy(schemas: ToolSdkSchema[]): string {
  const sorted = [...schemas].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const state: PyRenderState = {
    classes: [],
    usedClassNames: new Set(),
    nextClassCounter: new Map(),
    typing: new Set(["Protocol"]),
  };
  // MỘT dòng thành viên có thứ tự, khớp khế ước từ điển đã ghi và bản TypeScript (bên đó đặt khoá lạ
  // ngay tại chỗ thay vì tách riêng ra). Xen kẽ ở đây miễn phí: một dòng comment nằm giữa hai dòng
  // async def không phải câu lệnh, nên nó không đổi cách thân class parse.
  const members: string[] = [];
  let statements = 0;
  for (const schema of sorted) {
    const argType = renderType(schema.parameters, `${camelCase(schema.name)}Args`, state);
    const outputType = renderType(schema.output, `${camelCase(schema.name)}Output`, state);
    if (isBareIdentifier(schema.name) && !RESERVED.has(schema.name) && !schema.name.startsWith("_")) {
      // Docstring chỉ mô tả method của nó khi nó là câu lệnh ĐẦU TIÊN trong thân method. Phát trước
      // async def thì nó thành docstring của class Tools (với tool đầu tiên) hoặc một biểu thức chết
      // (với mọi tool sau), để mọi method không được mô tả — mà dưới mode 'ptc' SDK này là mô tả DUY
      // NHẤT về việc một tool làm gì. Docstring là thân trọn vẹn, nên stub ... chỉ dành cho ca không
      // có mô tả.
      const doc = docLines(schema.description, 2);
      members.push(
        doc.length > 0
          ? `${pad(1)}async def ${schema.name}(self, args: ${argType}) -> ${outputType}:`
          : `${pad(1)}async def ${schema.name}(self, args: ${argType}) -> ${outputType}: ...`,
      );
      members.push(...doc);
      statements += 1;
    } else {
      // Không với tới được bằng tools.ten — model với qua tools[ten]. Tên lạ và từ khoá cứng không
      // phải thuộc tính hợp lệ; tên bắt đầu bằng gạch dưới (_foo) LÀ thuộc tính hợp lệ mà vẫn bị đẩy
      // vào đây, vì các dạng hỏng tách làm ba — __token không phải dunder bị name-mangle tại CHỖ GỌI,
      // dunder có trên object/type (__class__, __doc__) phân giải trước khi __getattr__ chạy, và tra
      // cứu special-method ngầm bỏ qua hook — và một luật cho cả họ không tốn gì trong khi luật riêng
      // từng dạng sẽ phải liệt kê chúng (xem {@link RESERVED}). Stub liệt kê nó thành comment dạng
      // subscript (tham chiếu cả các TypedDict có tên) để người đọc thấy cái gì với tới được; việc
      // phân giải lúc chạy đi qua __getitem__ của proxy.
      members.push(`${pad(1)}# tools[${JSON.stringify(schema.name)}](args: ${argType}) -> ${outputType}`);
      const description = describe(schema);
      if (description !== undefined) members.push(`${pad(1)}#   ${description}`);
    }
  }
  // Mục subscript là COMMENT, không phải câu lệnh: thân class chỉ gồm comment không parse được, nên
  // pass là bắt buộc mỗi khi không phát method nào — kể cả tập tool chỉ có subscript.
  const bodyLines = statements > 0 ? members : [`${pad(1)}pass`, ...members];
  const body = bodyLines.join("\n");
  const imports = TYPING_ORDER.filter((symbol) => state.typing.has(symbol));
  const classBlock = state.classes.length > 0 ? `${state.classes.join("\n\n")}\n\n` : "";
  const errorDeclaration = "class ToolCallError(Exception):\n    toolName: str";
  const declaration = `from typing import ${imports.join(", ")}\n\n${errorDeclaration}\n\n${classBlock}class Tools(Protocol):\n${body}\n\ntools: Tools`;
  return `${SDK_INSTRUCTIONS}\n\n\`\`\`python\n${declaration}\n\`\`\``;
}
