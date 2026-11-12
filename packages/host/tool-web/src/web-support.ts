/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bộ chuyển HTML → Markdown nội bộ của gói tool-web: DOM tối thiểu, lõi kiểu turndown
 *      (atx · fenced · bullet '-') và các luật GFM (bảng · gạch ngang · task list) cùng ba luật
 *      riêng của bản gốc. Bản gốc dùng turndown + @joplin/turndown-plugin-gfm, nhưng manifest của
 *      gói không khai hai gói đó nên gói phải tự chứa; hành vi được đối chiếu từng byte với bản
 *      gốc qua test A/B (tests/host/tool-web.test.ts).
 */

/* ------------------------------------------------------------------------------------------------
 * 1. DOM tối thiểu — đúng phần bề mặt mà lõi chuyển đổi đọc tới (nodeType · nodeName · thuộc tính
 *    · anh em · textContent · rows/cells · style/classList · outerHTML).
 * ---------------------------------------------------------------------------------------------- */

/** Một nút trong cây DOM tối thiểu. */
type DomNode = DomElement | DomText;

/** Giá trị thuộc tính đã giải mã, giữ nguyên thứ tự xuất hiện trong thẻ. */
type AttributeList = Array<[string, string]>;

/** Ký tự backtick, viết qua mã để tệp nguồn không phải chứa ký tự đặc biệt của Markdown. */
const TICK = String.fromCharCode(96);

/** Thẻ không bao giờ có thẻ đóng. */
const PARSER_VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "command", "embed", "hr", "img", "input", "keygen",
  "link", "meta", "param", "source", "track", "wbr",
]);

/** Thẻ mà phần thân là VĂN BẢN THÔ (không phân tích thẻ con). */
const PARSER_RAW_TEXT_ELEMENTS = new Set(["script", "style", "noscript", "template", "iframe", "object", "embed"]);

/** Thẻ có phần thân là văn bản nhưng VẪN giải mã thực thể. */
const PARSER_TEXT_ONLY_ELEMENTS = new Set(["title", "textarea"]);

/** Thẻ cấp khối đóng ngầm một phần tử p đang mở (đúng danh sách trình duyệt dùng). */
const P_CLOSERS = new Set([
  "address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figcaption",
  "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "main",
  "menu", "nav", "ol", "p", "pre", "section", "table", "ul",
]);

/** Bảng thực thể HTML thường gặp; thực thể lạ được giữ nguyên văn thay vì đoán sai. */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: "\u00a0", copy: "\u00a9", reg: "\u00ae",
  trade: "\u2122", hellip: "\u2026", mdash: "\u2014", ndash: "\u2013", lsquo: "\u2018", rsquo: "\u2019",
  ldquo: "\u201c", rdquo: "\u201d", laquo: "\u00ab", raquo: "\u00bb", times: "\u00d7", divide: "\u00f7",
  deg: "\u00b0", plusmn: "\u00b1", frac12: "\u00bd", frac14: "\u00bc", frac34: "\u00be", sup2: "\u00b2",
  sup3: "\u00b3", micro: "\u00b5", para: "\u00b6", sect: "\u00a7", middot: "\u00b7", bull: "\u2022",
  euro: "\u20ac", pound: "\u00a3", yen: "\u00a5", cent: "\u00a2", larr: "\u2190", rarr: "\u2192",
  uarr: "\u2191", darr: "\u2193", harr: "\u2194", ensp: "\u2002", emsp: "\u2003", thinsp: "\u2009",
  zwnj: "\u200c", zwj: "\u200d", shy: "\u00ad", iexcl: "\u00a1", iquest: "\u00bf", szlig: "\u00df",
};

/** Giải mã thực thể HTML dạng tên và dạng số; thực thể lạ giữ nguyên văn. */
function decodeEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole: string, body: string) => {
    if (!body.startsWith("#")) return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
    const hex = body.startsWith("#x") || body.startsWith("#X");
    const code = hex ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
    return String.fromCodePoint(code);
  });
}

/** Nút chữ của DOM tối thiểu (nodeType 3). */
class DomText {
  readonly nodeType = 3;
  /** Nội dung chữ; lõi chuyển đổi ghi lại sau khi gộp khoảng trắng. */
  data: string;
  parentNode: DomElement | null = null;
  isCode = false;
  isBlank = false;
  isBlock = false;
  flankingWhitespace: { leading: string; trailing: string } = { leading: "", trailing: "" };

  /** Tạo nút chữ từ nội dung đã giải mã thực thể. */
  constructor(data: string) {
    this.data = data;
  }

  /** Tên nút của nút chữ (DOM trả "#text"). */
  get nodeName(): string {
    return "#text";
  }

  /** Bí danh của data mà một số luật của turndown đọc tới. */
  get nodeValue(): string {
    return this.data;
  }

  /** Nội dung chữ của nút. */
  get textContent(): string {
    return this.data;
  }

  /** Anh em liền trước, hoặc null. */
  get previousSibling(): DomNode | null {
    return siblingOf(this, -1);
  }

  /** Anh em liền sau, hoặc null. */
  get nextSibling(): DomNode | null {
    return siblingOf(this, 1);
  }

  /** Nút chữ không có phần tử con. */
  get childNodes(): readonly DomNode[] {
    return [];
  }
}

/** Phần tử của DOM tối thiểu (nodeType 1). */
class DomElement {
  readonly nodeType = 1;
  /** Tên thẻ dạng CHỮ HOA như DOM thật; luật của turndown so sánh theo dạng này. */
  readonly nodeName: string;
  /** Tên thẻ dạng chữ thường, dùng cho bộ tuần tự hoá và bộ phân tích. */
  readonly tagName: string;
  /** Thuộc tính theo thứ tự xuất hiện, tên đã hạ chữ thường. */
  readonly attributes: AttributeList;
  childNodes: DomNode[] = [];
  parentNode: DomElement | null = null;
  isBlock = false;
  isCode = false;
  isBlank = false;
  flankingWhitespace: { leading: string; trailing: string } = { leading: "", trailing: "" };

  /** Tạo phần tử rỗng từ tên thẻ và danh sách thuộc tính. */
  constructor(tagName: string, attributes: AttributeList = []) {
    this.tagName = tagName.toLowerCase();
    this.nodeName = this.tagName.toUpperCase();
    this.attributes = attributes;
  }

  /** Nút con đầu tiên, hoặc null. */
  get firstChild(): DomNode | null {
    return this.childNodes[0] ?? null;
  }

  /** Phần tử con cuối cùng, hoặc null. */
  get lastElementChild(): DomElement | null {
    for (let index = this.childNodes.length - 1; index >= 0; index -= 1) {
      const child = this.childNodes[index];
      if (child !== undefined && child.nodeType === 1) return child as DomElement;
    }
    return null;
  }

  /** Các phần tử con (bỏ nút chữ). */
  get children(): DomElement[] {
    return this.childNodes.filter((child): child is DomElement => child.nodeType === 1);
  }

  /** Phần tử cha, hoặc null. */
  get parentElement(): DomElement | null {
    return this.parentNode;
  }

  /** Anh em liền trước, hoặc null. */
  get previousSibling(): DomNode | null {
    return siblingOf(this, -1);
  }

  /** Anh em liền sau, hoặc null. */
  get nextSibling(): DomNode | null {
    return siblingOf(this, 1);
  }

  /** Toàn bộ chữ của cây con, nối theo thứ tự tài liệu. */
  get textContent(): string {
    let text = "";
    for (const child of this.childNodes) text += child.textContent;
    return text;
  }

  /** Giá trị thuộc tính class (chuỗi rỗng khi vắng). */
  get className(): string {
    return this.getAttribute("class") ?? "";
  }

  /** Bề mặt classList mà luật bảng đọc tới. */
  get classList(): { contains(token: string): boolean } {
    const tokens = this.className.split(/\s+/).filter((token) => token.length > 0);
    return { contains: (token: string) => tokens.includes(token) };
  }

  /** Bề mặt style dạng đối tượng camelCase (đọc textAlign là đủ cho luật bảng). */
  get style(): Record<string, string> {
    const declarations: Record<string, string> = {};
    for (const declaration of (this.getAttribute("style") ?? "").split(";")) {
      const separator = declaration.indexOf(":");
      if (separator === -1) continue;
      const property = declaration.slice(0, separator).trim();
      if (property.length === 0) continue;
      declarations[property] = declaration.slice(separator + 1).trim();
      const camel = property.toLowerCase().replace(/-([a-z])/g, (_all: string, letter: string) => letter.toUpperCase());
      declarations[camel] = declarations[property] ?? "";
    }
    return declarations;
  }

  /** Các hàng của bảng, gồm cả hàng nằm trong thead/tbody/tfoot. */
  get rows(): DomElement[] {
    const rows: DomElement[] = [];
    const collect = (element: DomElement): void => {
      for (const child of element.children) {
        if (child.nodeName === "TR") rows.push(child);
        else if (child.nodeName === "THEAD" || child.nodeName === "TBODY" || child.nodeName === "TFOOT") collect(child);
      }
    };
    collect(this);
    return rows;
  }

  /** Các ô của một hàng (th/td). */
  get cells(): DomElement[] {
    return this.children.filter((child) => child.nodeName === "TH" || child.nodeName === "TD");
  }

  /** Phần tử caption trực tiếp của bảng, hoặc null. */
  get caption(): DomElement | null {
    return this.children.find((child) => child.nodeName === "CAPTION") ?? null;
  }

  /** Thuộc tính type (ô chọn của task list đọc tới). */
  get type(): string {
    return this.getAttribute("type") ?? "";
  }

  /** Cờ checked của ô chọn. */
  get checked(): boolean {
    return this.hasAttribute("checked");
  }

  /** Đọc một thuộc tính (không phân biệt chữ hoa/thường); null khi vắng. */
  getAttribute(name: string): string | null {
    const wanted = name.toLowerCase();
    for (const [key, value] of this.attributes) if (key === wanted) return value;
    return null;
  }

  /** Kiểm một thuộc tính có mặt hay không. */
  hasAttribute(name: string): boolean {
    return this.getAttribute(name) !== null;
  }

  /** Tìm mọi phần tử con (mọi độ sâu) theo tên thẻ, theo thứ tự tài liệu. */
  getElementsByTagName(name: string): DomElement[] {
    const wanted = name.toUpperCase();
    const found: DomElement[] = [];
    const walk = (element: DomElement): void => {
      for (const child of element.children) {
        if (child.nodeName === wanted) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }

  /** Tìm phần tử con đầu tiên theo tên thẻ (chỉ cần cho caption của bảng). */
  querySelector(name: string): DomElement | null {
    return this.getElementsByTagName(name)[0] ?? null;
  }

  /** Gắn một nút con vào cuối và trả chính nút đó. */
  appendChild(node: DomNode): DomNode {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  /** Gỡ một nút con (bộ gộp khoảng trắng dùng để bỏ nút rỗng). */
  removeChild(node: DomNode): void {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentNode = null;
  }

  /** Tuần tự hoá như domino: thẻ thường, thuộc tính trong ngoặc kép, thẻ rỗng không đóng. */
  get outerHTML(): string {
    const attributes = this.attributes.map(([name, value]) => " " + name + "=\"" + escapeAttribute(value) + "\"").join("");
    const open = "<" + this.tagName + attributes + ">";
    if (PARSER_VOID_ELEMENTS.has(this.tagName)) return open;
    const children = this.childNodes.map((child) => (child.nodeType === 1 ? (child as DomElement).outerHTML : escapeText(child.textContent)));
    return open + children.join("") + "</" + this.tagName + ">";
  }
}

/** Tìm anh em liền trước/sau của một nút trong danh sách con của cha. */
function siblingOf(node: DomNode, direction: -1 | 1): DomNode | null {
  const parent = node.parentNode;
  if (parent === null) return null;
  const index = parent.childNodes.indexOf(node);
  if (index < 0) return null;
  return parent.childNodes[index + direction] ?? null;
}

/** Thoát ký tự cho giá trị thuộc tính khi tuần tự hoá. */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Thoát ký tự cho nút chữ khi tuần tự hoá (non-breaking space thành &nbsp; như domino). */
function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/\u00a0/g, "&nbsp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Trạng thái phân tích: phần tử gốc tổng hợp và ngăn xếp phần tử đang mở. */
interface ParserState {
  readonly root: DomElement;
  readonly open: DomElement[];
}

/** Đọc tên thẻ tại vị trí ngay sau dấu < hoặc </. */
function readTagName(html: string, start: number): { name: string; end: number } {
  let cursor = start;
  while (cursor < html.length && /[a-zA-Z0-9-]/.test(html[cursor] ?? "")) cursor += 1;
  return { name: html.slice(start, cursor).toLowerCase(), end: cursor };
}

/** Đọc danh sách thuộc tính của một thẻ, cờ tự đóng, và vị trí sau dấu >. */
function readAttributes(html: string, start: number): { attributes: AttributeList; selfClosing: boolean; end: number } {
  const attributes: AttributeList = [];
  let cursor = start;
  while (cursor < html.length) {
    while (cursor < html.length && /\s/.test(html[cursor] ?? "")) cursor += 1;
    const char = html[cursor];
    if (char === ">") return { attributes, selfClosing: false, end: cursor + 1 };
    if (char === "/" && html[cursor + 1] === ">") return { attributes, selfClosing: true, end: cursor + 2 };
    if (char === undefined) break;
    const nameStart = cursor;
    while (cursor < html.length && !/[\s=/>]/.test(html[cursor] ?? "")) cursor += 1;
    const name = html.slice(nameStart, cursor).toLowerCase();
    while (cursor < html.length && /\s/.test(html[cursor] ?? "")) cursor += 1;
    let value = "";
    if (html[cursor] === "=") {
      cursor += 1;
      while (cursor < html.length && /\s/.test(html[cursor] ?? "")) cursor += 1;
      const quote = html[cursor];
      if (quote === "\"" || quote === "'") {
        const valueEnd = html.indexOf(quote, cursor + 1);
        const stop = valueEnd === -1 ? html.length : valueEnd;
        value = decodeEntities(html.slice(cursor + 1, stop));
        cursor = stop + 1;
      } else {
        const valueStart = cursor;
        while (cursor < html.length && !/[\s>]/.test(html[cursor] ?? "")) cursor += 1;
        value = decodeEntities(html.slice(valueStart, cursor));
      }
    }
    if (name.length > 0 && !attributes.some(([key]) => key === name)) attributes.push([name, value]);
  }
  return { attributes, selfClosing: false, end: cursor };
}

/** Đóng ngầm các phần tử đang mở khi gặp thẻ mở mới (tập quy tắc tối thiểu của trình duyệt). */
function closeImplied(open: DomElement[], name: string): void {
  const topTag = (): string => open[open.length - 1]?.tagName ?? "";
  const popWhile = (names: readonly string[]): void => {
    while (open.length > 1 && names.includes(topTag())) open.pop();
  };
  if (P_CLOSERS.has(name)) popWhile(["p"]);
  if (name === "li") popWhile(["li"]);
  if (name === "dt" || name === "dd") popWhile(["dt", "dd"]);
  if (name === "option") popWhile(["option"]);
  if (name === "tr") popWhile(["tr", "td", "th"]);
  if (name === "td" || name === "th") popWhile(["td", "th"]);
  if (name === "thead" || name === "tbody" || name === "tfoot") popWhile(["thead", "tbody", "tfoot", "tr", "td", "th"]);
}

/** Phân tích một đoạn HTML thành cây DOM tối thiểu; hàm tự giải mã thực thể. */
function parseHtmlFragment(html: string): DomElement {
  const state: ParserState = { root: new DomElement("x-turndown"), open: [] };
  state.open.push(state.root);
  const current = (): DomElement => state.open[state.open.length - 1] ?? state.root;
  let cursor = 0;
  while (cursor < html.length) {
    const nextTag = html.indexOf("<", cursor);
    if (nextTag === -1) {
      current().appendChild(new DomText(decodeEntities(html.slice(cursor))));
      break;
    }
    if (nextTag > cursor) current().appendChild(new DomText(decodeEntities(html.slice(cursor, nextTag))));
    if (html.startsWith("<!--", nextTag)) {
      const end = html.indexOf("-->", nextTag + 4);
      cursor = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", nextTag) || html.startsWith("<?", nextTag)) {
      const end = html.indexOf(">", nextTag + 2);
      cursor = end === -1 ? html.length : end + 1;
      continue;
    }
    if (html.startsWith("</", nextTag)) {
      const closing = readTagName(html, nextTag + 2);
      const end = html.indexOf(">", closing.end);
      cursor = end === -1 ? html.length : end + 1;
      for (let index = state.open.length - 1; index > 0; index -= 1) {
        if (state.open[index]?.tagName === closing.name) {
          state.open.length = index;
          break;
        }
      }
      continue;
    }
    const opening = readTagName(html, nextTag + 1);
    if (opening.name.length === 0) {
      current().appendChild(new DomText("<"));
      cursor = nextTag + 1;
      continue;
    }
    const parsed = readAttributes(html, opening.end);
    cursor = parsed.end;
    closeImplied(state.open, opening.name);
    if (opening.name === "tr" && current().tagName === "table") {
      const body = new DomElement("tbody");
      current().appendChild(body);
      state.open.push(body);
    }
    const element = new DomElement(opening.name, parsed.attributes);
    current().appendChild(element);
    if (parsed.selfClosing || PARSER_VOID_ELEMENTS.has(opening.name)) continue;
    const raw = PARSER_RAW_TEXT_ELEMENTS.has(opening.name) || PARSER_TEXT_ONLY_ELEMENTS.has(opening.name);
    if (raw) {
      const closer = html.toLowerCase().indexOf("</" + opening.name, cursor);
      const stop = closer === -1 ? html.length : closer;
      const body = html.slice(cursor, stop);
      element.appendChild(new DomText(PARSER_RAW_TEXT_ELEMENTS.has(opening.name) ? body : decodeEntities(body)));
      cursor = closer === -1 ? html.length : closer;
      continue;
    }
    state.open.push(element);
  }
  return state.root;
}

/* ------------------------------------------------------------------------------------------------
 * 2. Lõi chuyển đổi — bản viết lại của thuật toán turndown 7.x với tuỳ chọn CỐ ĐỊNH của bản gốc
 *    (atx · fenced · bullet '-'), nên mọi nhánh setext/indented/reference không tồn tại.
 * ---------------------------------------------------------------------------------------------- */

/** Thẻ cấp khối theo danh sách của turndown. */
const BLOCK_ELEMENTS = [
  "ADDRESS", "ARTICLE", "ASIDE", "AUDIO", "BLOCKQUOTE", "BODY", "CANVAS", "CENTER", "DD", "DIR",
  "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "FRAMESET", "H1", "H2",
  "H3", "H4", "H5", "H6", "HEADER", "HGROUP", "HR", "HTML", "ISINDEX", "LI", "MAIN", "MENU", "NAV",
  "NOFRAMES", "NOSCRIPT", "OL", "OUTPUT", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT",
  "TH", "THEAD", "TR", "UL",
];

/** Thẻ rỗng theo danh sách của turndown. */
const VOID_ELEMENTS = ["AREA", "BASE", "BR", "COL", "COMMAND", "EMBED", "HR", "IMG", "INPUT", "KEYGEN", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR"];

/** Thẻ vẫn có nghĩa khi rỗng (không bị coi là nút trống). */
const MEANINGFUL_WHEN_BLANK_ELEMENTS = ["A", "TABLE", "THEAD", "TBODY", "TFOOT", "TH", "TD", "IFRAME", "SCRIPT", "AUDIO", "VIDEO"];

/** Bảng thoát ký tự Markdown, giữ NGUYÊN thứ tự của turndown. */
const MARKDOWN_ESCAPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\\/g, "\\\\"], [/\*/g, "\\*"], [/^-/g, "\\-"], [/^\+ /g, "\\+ "], [/^(=+)/g, "\\$1"],
  [/^(#{1,6}) /g, "\\$1 "], [new RegExp(TICK, "g"), "\\" + TICK], [/^~~~/g, "\\~~~"],
  [/\[/g, "\\["], [/\]/g, "\\]"], [/^>/g, "\\>"], [/_/g, "\\_"], [/^(\d+)\. /g, "$1\\. "],
];

/** Tuỳ chọn cố định — đúng bộ tuỳ chọn bản gốc truyền cho turndown. */
const CONVERTER_OPTIONS = Object.freeze({
  headingStyle: "atx",
  hr: "* * *",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  fence: TICK + TICK + TICK,
  emDelimiter: "_",
  strongDelimiter: "**",
  linkStyle: "inlined",
  br: "  ",
});

/** Thoát ký tự Markdown theo bảng của turndown. */
function escapeMarkdown(text: string): string {
  let escaped = text;
  for (const [pattern, replacement] of MARKDOWN_ESCAPES) escaped = escaped.replace(pattern, replacement);
  return escaped;
}

/** Bỏ ký tự xuống dòng ở đầu chuỗi. */
function trimLeadingNewlines(value: string): string {
  return value.replace(/^\n*/, "");
}

/** Bỏ ký tự xuống dòng ở cuối chuỗi. */
function trimTrailingNewlines(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "\n") end -= 1;
  return value.slice(0, end);
}

/** Bỏ ký tự xuống dòng ở cả hai đầu. */
function trimNewlines(value: string): string {
  return trimTrailingNewlines(trimLeadingNewlines(value));
}

/** Cho biết một phần tử thuộc danh sách tên thẻ hay không. */
function nameIn(element: DomElement, names: readonly string[]): boolean {
  return names.includes(element.nodeName);
}

/** Kiểm cây con có chứa ít nhất một thẻ thuộc danh sách không. */
function hasDescendantOf(element: DomElement, names: readonly string[]): boolean {
  return names.some((name) => element.getElementsByTagName(name).length > 0);
}

/** Kiểm phần tử có phải nút trống theo luật turndown không. */
function isBlankElement(element: DomElement): boolean {
  return (
    !nameIn(element, VOID_ELEMENTS) &&
    !nameIn(element, MEANINGFUL_WHEN_BLANK_ELEMENTS) &&
    /^\s*$/i.test(element.textContent) &&
    !hasDescendantOf(element, VOID_ELEMENTS) &&
    !hasDescendantOf(element, MEANINGFUL_WHEN_BLANK_ELEMENTS)
  );
}

/** Lấy khoảng trắng hai đầu chuỗi, tách phần ASCII và phần Unicode. */
function edgeWhitespace(value: string): {
  leading: string;
  leadingAscii: string;
  leadingNonAscii: string;
  trailing: string;
  trailingNonAscii: string;
  trailingAscii: string;
} {
  const match = value.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);
  if (match === null) return { leading: "", leadingAscii: "", leadingNonAscii: "", trailing: "", trailingNonAscii: "", trailingAscii: "" };
  return {
    leading: match[1] ?? "",
    leadingAscii: match[2] ?? "",
    leadingNonAscii: match[3] ?? "",
    trailing: match[4] ?? "",
    trailingNonAscii: match[5] ?? "",
    trailingAscii: match[6] ?? "",
  };
}

/** Kiểm một phía của nút có bị khoảng trắng của anh em kề bên phủ không. */
function isFlankedByWhitespace(side: "left" | "right", node: DomNode): boolean {
  const sibling = side === "left" ? node.previousSibling : node.nextSibling;
  if (sibling === null) return false;
  return (side === "left" ? / $/ : /^ /).test(sibling.textContent);
}

/** Tính khoảng trắng hai bên của một nút theo luật turndown. */
function flankingWhitespaceOf(node: DomNode): { leading: string; trailing: string } {
  if (node.isBlock) return { leading: "", trailing: "" };
  const edges = edgeWhitespace(node.textContent);
  let leading = edges.leading;
  let trailing = edges.trailing;
  if (edges.leadingAscii !== "" && isFlankedByWhitespace("left", node)) leading = edges.leadingNonAscii;
  if (edges.trailingAscii !== "" && isFlankedByWhitespace("right", node)) trailing = edges.trailingNonAscii;
  return { leading, trailing };
}

/** Đánh dấu một nút (khối · mã · trống · khoảng trắng) trước khi chọn luật. */
function markNode(node: DomNode): DomNode {
  node.isBlock = node.nodeType === 1 ? nameIn(node as DomElement, BLOCK_ELEMENTS) : false;
  node.isCode = node.nodeName === "CODE" || node.parentNode?.isCode === true;
  node.isBlank = node.nodeType === 1 ? isBlankElement(node as DomElement) : /^\s*$/.test(node.textContent);
  node.flankingWhitespace = flankingWhitespaceOf(node);
  return node;
}

/** Lấy nút kế tiếp theo thứ tự duyệt trước của bộ gộp khoảng trắng. */
function nextNode(previous: DomNode | null, current: DomElement, isPre: (element: DomElement) => boolean): DomNode {
  if ((previous !== null && previous.parentNode === current) || isPre(current)) {
    return (current.nextSibling ?? current.parentNode ?? current) as DomNode;
  }
  return (current.firstChild ?? current.nextSibling ?? current.parentNode ?? current) as DomNode;
}

/** Gỡ một nút khỏi cây và trả nút kế tiếp cần xét. */
function removeNode(node: DomNode): DomNode {
  const next = node.nextSibling ?? node.parentNode;
  node.parentNode?.removeChild(node);
  return (next ?? node) as DomNode;
}

/** Gộp khoảng trắng trong toàn cây theo thuật toán collapse-whitespace mà turndown dùng. */
function collapseWhitespace(root: DomElement): void {
  const isPre = (element: DomElement): boolean => element.nodeName === "PRE";
  if (root.firstChild === null || isPre(root)) return;
  let previousText: DomText | null = null;
  let keepLeadingWhitespace = false;
  let previous: DomNode | null = null;
  let node: DomNode = nextNode(previous, root, isPre);
  while (node !== root) {
    if (node.nodeType === 3) {
      const text = node as DomText;
      let data = text.data.replace(/[ \r\n\t]+/g, " ");
      if ((previousText === null || / $/.test(previousText.data)) && !keepLeadingWhitespace && data[0] === " ") data = data.slice(1);
      if (data === "") {
        node = removeNode(node);
        continue;
      }
      text.data = data;
      previousText = text;
    } else if (node.nodeType === 1) {
      const element = node as DomElement;
      if (nameIn(element, BLOCK_ELEMENTS) || element.nodeName === "BR") {
        if (previousText !== null) previousText.data = previousText.data.replace(/ $/, "");
        previousText = null;
        keepLeadingWhitespace = false;
      } else if (nameIn(element, VOID_ELEMENTS) || isPre(element)) {
        previousText = null;
        keepLeadingWhitespace = true;
      } else if (previousText !== null) {
        keepLeadingWhitespace = false;
      }
    } else {
      node = removeNode(node);
      continue;
    }
    const following = nextNode(previous, node as DomElement, isPre);
    previous = node;
    node = following;
  }
  if (previousText !== null) {
    previousText.data = previousText.data.replace(/ $/, "");
    if (previousText.data === "") removeNode(previousText);
  }
}

/* ------------------------------------------------------------------------------------------------
 * 3. Luật chuyển đổi — thứ tự MÔ PHỎNG đúng thứ tự đăng ký của bản gốc (luật thêm sau đứng trước).
 * ---------------------------------------------------------------------------------------------- */

/** Một luật chuyển đổi: bộ lọc + phần thay thế. */
interface ConversionRule {
  /** Tên thẻ, danh sách tên thẻ, hoặc phép kiểm tuỳ ý. */
  readonly filter: string | readonly string[] | ((node: DomElement) => boolean);
  /** Sinh phần Markdown cho một nút. */
  replacement(content: string, node: DomElement): string;
}

/** Luật mặc định: khối bọc hai xuống dòng, nội tuyến giữ nguyên. */
const DEFAULT_RULE: ConversionRule = {
  filter: () => true,
  replacement: (content, node) => (node.isBlock ? "\n\n" + content + "\n\n" : content),
};

/** Kiểm một luật có áp cho nút hay không. */
function ruleMatches(rule: ConversionRule, node: DomElement): boolean {
  const filter = rule.filter;
  if (typeof filter === "string") return filter === node.tagName;
  if (Array.isArray(filter)) return (filter as readonly string[]).includes(node.tagName);
  return (filter as (candidate: DomElement) => boolean)(node);
}

/** Sinh một ô bảng không nở span (luật riêng của bản gốc). */
function renderTableCell(content: string, index: number): string {
  const trimmed = content.trim().replace(/\n\r/g, "<br>").replace(/\n/g, "<br>").replace(/\|+/g, "\\|");
  return (index === 0 ? "| " : " ") + trimmed.padEnd(3, " ") + " |";
}

/** Kiểm một hàng có phải hàng tiêu đề bảng không (luật riêng của bản gốc). */
function isTableHeadingRow(row: DomElement): boolean {
  const cells = row.cells;
  const table = row.parentElement?.parentElement ?? null;
  const inHead = row.parentElement?.nodeName === "THEAD" || (table !== null && table.rows[0] === row);
  return inHead && cells.every((cell) => cell.nodeName === "TH");
}

/** Đổi căn lề của ô thành dấu phân cách GFM. */
function tableBorder(cell: DomElement): string {
  const alignment = (cell.getAttribute("align") || cell.style["textAlign"] || "").toLowerCase();
  if (alignment === "left") return ":---";
  if (alignment === "right") return "---:";
  if (alignment === "center") return ":---:";
  return "---";
}

/** Đổi căn lề thành dấu phân cách, mặc định --- (luật GFM). */
function borderFor(alignment: string): string {
  if (alignment === "left") return ":---";
  if (alignment === "right") return "---:";
  if (alignment === "center") return ":---:";
  return "---";
}

/** Lấy căn lề của một cột bằng bỏ phiếu trên mọi hàng (luật GFM). */
function columnAlignment(table: DomElement, columnIndex: number): string {
  const votes: Record<string, number> = { left: 0, right: 0, center: 0, "": 0 };
  let alignment = "";
  for (const row of table.rows) {
    const cell = row.childNodes[columnIndex];
    const element = cell !== undefined && cell.nodeType === 1 ? (cell as DomElement) : null;
    const key = (element?.getAttribute("align") || element?.style["textAlign"] || "").toLowerCase();
    votes[key] = (votes[key] ?? 0) + 1;
    if ((votes[key] ?? 0) > (votes[alignment] ?? 0)) alignment = key;
  }
  return alignment;
}

/** Đếm số cột lớn nhất của bảng (luật GFM). */
function tableColumnCount(table: DomElement): number {
  let maximum = 0;
  for (const row of table.rows) maximum = Math.max(maximum, row.childNodes.length);
  return maximum;
}

/** Kiểm nút có chứa bảng con không (luật GFM). */
function containsTable(node: DomNode): boolean {
  if (node.nodeType !== 1) return false;
  for (const child of (node as DomElement).childNodes) {
    if (child.nodeName === "TABLE") return true;
    if (containsTable(child)) return true;
  }
  return false;
}

/** Kiểm cây con có chứa thẻ thuộc danh sách không (luật GFM). */
function containsTag(node: DomNode, names: readonly string[]): boolean {
  if (node.nodeType !== 1) return false;
  for (const child of (node as DomElement).childNodes) {
    if (child.nodeType !== 1) continue;
    if (names.includes((child as DomElement).nodeName)) return true;
    if (containsTag(child, names)) return true;
  }
  return false;
}

/** Kiểm bảng phải giữ nguyên HTML thay vì chuyển thành bảng Markdown (luật GFM). */
function tableShouldStayHtml(table: DomElement): boolean {
  return containsTag(table, ["UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "HR", "BLOCKQUOTE"]);
}

/** Kiểm bảng phải bỏ qua, chỉ nối nội dung ô (luật GFM). */
function tableShouldBeSkipped(table: DomElement | null): boolean {
  const rows = table?.rows ?? [];
  const first = rows[0];
  if (table === null || first === undefined) return true;
  if (rows.length === 1 && first.childNodes.length <= 1) return true;
  return containsTable(table);
}

/** Tìm phần tử cha gần nhất là DIV (luật GFM dùng cho lớp bọc bảng). */
function parentDiv(node: DomElement): DomElement | null {
  let current: DomElement | null = node.parentNode;
  while (current !== null && current.nodeName !== "DIV") current = current.parentNode;
  return current;
}

/** Sinh phần thay thế của một bảng theo luật GFM. */
function gfmTable(content: string, node: DomElement): string {
  if (tableShouldStayHtml(node)) {
    const html = node.outerHTML;
    const wrapper = parentDiv(node);
    if (wrapper === null || !wrapper.classList.contains("joplin-table-wrapper")) return "\n\n<div class=\"joplin-table-wrapper\">" + html + "</div>\n\n";
    return html;
  }
  if (tableShouldBeSkipped(node)) return content;
  const compact = content.replace(/\n+/g, "\n");
  const lines = compact.trim().split("\n");
  const secondLine = lines.length >= 2 ? (lines[1] ?? "") : lines.join(",");
  const columns = tableColumnCount(node);
  let emptyHeader = "";
  if (columns > 0 && !/\| :?---/.test(secondLine)) {
    emptyHeader = "|" + "     |".repeat(columns) + "\n|";
    for (let index = 0; index < columns; index += 1) emptyHeader += " " + borderFor(columnAlignment(node, index)) + " |";
  }
  const captionText = node.caption?.textContent ?? "";
  const caption = captionText !== "" ? captionText + "\n\n" : "";
  return "\n\n" + caption + (emptyHeader + compact).trimStart() + "\n\n";
}

/** Sinh phần thay thế cho hàng bảng theo luật riêng của bản gốc (không nở span). */
function tableRowReplacement(content: string, row: DomElement): string {
  const border = isTableHeadingRow(row) ? row.cells.map((cell, index) => renderTableCell(tableBorder(cell), index)).join("") : "";
  return "\n" + content + (border.length > 0 ? "\n" + border : "");
}

/** Các luật, xếp đúng thứ tự ưu tiên của bản gốc. */
const CONVERSION_RULES: readonly ConversionRule[] = [
  { filter: "tr", replacement: tableRowReplacement },
  { filter: ["th", "td"], replacement: (content, node) => renderTableCell(content, node.parentNode?.childNodes.indexOf(node) ?? 0) },
  {
    filter: (node) => {
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "OBJECT", "EMBED"].includes(node.nodeName)) return true;
      if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden")?.toLowerCase() === "true") return true;
      if (node.nodeName === "INPUT" && node.getAttribute("type")?.toLowerCase() === "hidden") return true;
      return (node.getAttribute("style")?.split(";") ?? []).some((declaration) => {
        const separator = declaration.indexOf(":");
        if (separator === -1) return false;
        const property = declaration.slice(0, separator).trim().toLowerCase();
        const value = declaration.slice(separator + 1).trim().toLowerCase().replace(/\s*!important\s*$/u, "");
        return (property === "display" && value === "none") || (property === "visibility" && (value === "hidden" || value === "collapse"));
      });
    },
    replacement: () => "",
  },
  {
    filter: (node) => {
      const parent = node.parentNode;
      if (parent === null) return false;
      const grandparentIsListItem = parent.parentNode?.nodeName === "LI";
      return (node.type === "checkbox" || node.getAttribute("role") === "checkbox") && (parent.nodeName === "LI" || ((parent.nodeName === "LABEL" || parent.nodeName === "SPAN") && grandparentIsListItem));
    },
    replacement: (_content, node) => (node.checked || node.getAttribute("aria-checked") === "true" ? "[x] " : "[ ] "),
  },
  { filter: ["thead", "tbody", "tfoot"], replacement: (content) => content },
  { filter: ["colgroup", "col"], replacement: () => "" },
  { filter: "caption", replacement: () => "" },
  { filter: "table", replacement: gfmTable },
  { filter: ["del", "s", "strike"], replacement: (content) => "~~" + content + "~~" },
  {
    filter: (node) => node.nodeName === "DIV" && /highlight-(?:text|source)-([a-z0-9]+)/.test(node.className) && node.firstChild?.nodeName === "PRE",
    replacement: (_content, node) => {
      const language = (node.className.match(/highlight-(?:text|source)-([a-z0-9]+)/) ?? [null, ""])[1] ?? "";
      return "\n\n" + CONVERTER_OPTIONS.fence + language + "\n" + (node.firstChild?.textContent ?? "") + "\n" + CONVERTER_OPTIONS.fence + "\n\n";
    },
  },
  { filter: "p", replacement: (content) => "\n\n" + content + "\n\n" },
  { filter: "br", replacement: () => CONVERTER_OPTIONS.br + "\n" },
  { filter: ["h1", "h2", "h3", "h4", "h5", "h6"], replacement: (content, node) => "\n\n" + "#".repeat(Number(node.nodeName.charAt(1))) + " " + content + "\n\n" },
  { filter: "blockquote", replacement: (content) => "\n\n" + trimNewlines(content).replace(/^/gm, "> ") + "\n\n" },
  {
    filter: ["ul", "ol"],
    replacement: (content, node) => (node.parentNode?.nodeName === "LI" && node.parentNode.lastElementChild === node ? "\n" + content : "\n\n" + content + "\n\n"),
  },
  {
    filter: "li",
    replacement: (content, node) => {
      const parent = node.parentNode;
      let prefix = CONVERTER_OPTIONS.bulletListMarker + "   ";
      if (parent?.nodeName === "OL") {
        const start = parent.getAttribute("start");
        const index = parent.children.indexOf(node);
        prefix = (start !== null ? Number(start) + index : index + 1) + ".  ";
      }
      const body = (trimNewlines(content) + (/\n$/.test(content) ? "\n" : "")).replace(/\n/g, "\n" + " ".repeat(prefix.length));
      return prefix + body + (node.nextSibling !== null ? "\n" : "");
    },
  },
  {
    filter: (node) => node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
    replacement: (_content, node) => {
      const code = node.firstChild !== null && node.firstChild.nodeType === 1 ? (node.firstChild as DomElement) : null;
      const className = code?.getAttribute("class") ?? "";
      const language = (className.match(/language-(\S+)/) ?? [null, ""])[1] ?? "";
      const text = code?.textContent ?? "";
      const fenceChar = CONVERTER_OPTIONS.fence.charAt(0);
      let fenceSize = 3;
      const fenceInCode = new RegExp("^" + fenceChar + "{3,}", "gm");
      for (let match = fenceInCode.exec(text); match !== null; match = fenceInCode.exec(text)) {
        if (match[0].length >= fenceSize) fenceSize = match[0].length + 1;
      }
      const fence = fenceChar.repeat(fenceSize);
      return "\n\n" + fence + language + "\n" + text.replace(/\n$/, "") + "\n" + fence + "\n\n";
    },
  },
  { filter: "hr", replacement: () => "\n\n" + CONVERTER_OPTIONS.hr + "\n\n" },
  {
    filter: (node) => node.nodeName === "A" && node.getAttribute("href") !== null,
    replacement: (content, node) => {
      const href = escapeLinkDestination(node.getAttribute("href") ?? "");
      const title = cleanAttribute(node.getAttribute("title"));
      return "[" + content + "](" + href + (title !== "" ? " \"" + escapeLinkTitle(title) + "\"" : "") + ")";
    },
  },
  {
    filter: (node) => node.nodeName === "CODE" && !(node.parentNode?.nodeName === "PRE" && node.previousSibling === null && node.nextSibling === null),
    replacement: (content) => {
      if (content === "") return "";
      const text = content.replace(/\r?\n|\r/g, " ");
      const extraSpace = new RegExp("^" + TICK + "|^ .*?[^ ].* $|" + TICK + "$").test(text) ? " " : "";
      let delimiter = TICK;
      const tickRuns: string[] = text.match(new RegExp(TICK + "+", "g")) ?? [];
      while (tickRuns.includes(delimiter)) delimiter += TICK;
      return delimiter + extraSpace + text + extraSpace + delimiter;
    },
  },
  { filter: ["em", "i"], replacement: (content) => (content.trim() !== "" ? CONVERTER_OPTIONS.emDelimiter + content + CONVERTER_OPTIONS.emDelimiter : "") },
  { filter: ["strong", "b"], replacement: (content) => (content.trim() !== "" ? CONVERTER_OPTIONS.strongDelimiter + content + CONVERTER_OPTIONS.strongDelimiter : "") },
  {
    filter: "img",
    replacement: (_content, node) => {
      const alt = escapeMarkdown(cleanAttribute(node.getAttribute("alt")));
      const src = escapeLinkDestination(node.getAttribute("src") ?? "");
      const title = cleanAttribute(node.getAttribute("title"));
      return src !== "" ? "![" + alt + "](" + src + (title !== "" ? " \"" + escapeLinkTitle(title) + "\"" : "") + ")" : "";
    },
  },
];

/** Chọn luật đầu tiên khớp với nút, theo đúng thứ tự ưu tiên. */
function ruleForNode(node: DomElement): ConversionRule {
  for (const rule of CONVERSION_RULES) if (ruleMatches(rule, node)) return rule;
  return DEFAULT_RULE;
}

/** Chuẩn hoá giá trị thuộc tính nhiều dòng (giống turndown). */
function cleanAttribute(attribute: string | null): string {
  return attribute !== null ? attribute.replace(/(\n+\s*)+/g, "\n") : "";
}

/** Thoát đích liên kết theo luật turndown. */
function escapeLinkDestination(destination: string): string {
  const escaped = destination.replace(/([<>()])/g, "\\$1");
  return escaped.includes(" ") ? "<" + escaped + ">" : escaped;
}

/** Thoát tiêu đề liên kết theo luật turndown. */
function escapeLinkTitle(title: string): string {
  return title.replace(/"/g, "\\\"");
}

/** Sinh nội dung Markdown cho một phần tử, kèm khoảng trắng hai bên. */
function replacementForNode(node: DomElement): string {
  const rule = ruleForNode(node);
  let content = processChildren(node);
  const whitespace = node.flankingWhitespace;
  if (whitespace.leading !== "" || whitespace.trailing !== "") content = content.trim();
  return whitespace.leading + rule.replacement(content, node) + whitespace.trailing;
}

/** Ghép một phần thay thế vào đầu ra với đúng số xuống dòng mà turndown dùng. */
function join(output: string, replacement: string): string {
  const left = trimTrailingNewlines(output);
  const right = trimLeadingNewlines(replacement);
  const newlines = Math.max(output.length - left.length, replacement.length - right.length);
  return left + "\n\n".slice(0, newlines) + right;
}

/** Duyệt các nút con của một phần tử và ghép kết quả. */
function processChildren(parent: DomElement): string {
  let output = "";
  for (const child of parent.childNodes) {
    const node = markNode(child);
    let replacement = "";
    if (node.nodeType === 3) replacement = node.isCode ? node.textContent : escapeMarkdown(node.textContent);
    else replacement = replacementForNode(node as DomElement);
    output = join(output, replacement);
  }
  return output;
}

/** Cắt khoảng trắng thừa ở hai đầu kết quả cuối. */
function postProcess(output: string): string {
  return output.replace(/^[\t\r\n]+/, "").replace(/[\t\r\n\s]+$/, "");
}

/**
 * Chuyển một đoạn HTML thành Markdown đúng như bản gốc (turndown atx · fenced · bullet '-').
 * Nhận: chuỗi HTML đã giải mã của thân phản hồi.
 * Trả: Markdown đã cắt khoảng trắng thừa hai đầu; chuỗi rỗng trả chuỗi rỗng.
 * @throws {TypeError} khi đầu vào không phải chuỗi (giữ hành vi của turndown).
 */
export function convertHtmlToMarkdown(html: string): string {
  if (typeof html !== "string") throw new TypeError(String(html) + " is not a string, or an element/document/fragment node.");
  if (html === "") return "";
  const root = parseHtmlFragment(html);
  collapseWhitespace(root);
  return postProcess(processChildren(root));
}
