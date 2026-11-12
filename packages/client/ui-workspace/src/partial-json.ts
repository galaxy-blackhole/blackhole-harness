/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Port nguyen van util/values/partial-json (PartialArguments) — bo doc JSON dang stream cua tham so goi cong cu
 */

// ⚠️ 18/10/2026 — PHAN (a) CON THIEU cua row ui-workspace. Ban goc bundle ca module
// ../../util/values/src/partial-json.ts (620 dong) vao client.js; ban viet lai truoc day BO SOT
// hoan toan ⇒ tap ham/phuong thuc cua goi ta THIEU so voi ban goc (lop loi "ham tra thieu phuong
// thuc"). Port lai TUNG PHUONG THUC, nguyen ten, nguyen ngu nghia.

/** Bang giai ma sau gach nguoc cua JSON. */
const SIMPLE_ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

/** Ky tu buoc phai giai ma trong mot chuoi JSON (escape hoac ky tu dieu khien). */
const CONTENT_ESCAPE = /[\\\u0000-\u001f]/u;

/**
 * Khoang trang JSON.
 * Nhan: c — mot ky tu.
 * Tra: true khi la khoang trang cua JSON.
 */
function isWhitespace(c: string): boolean {
  return c === " " || c === "\n" || c === "\r" || c === "\t";
}

/**
 * Chu so thap luc phan.
 * Nhan: c — mot ky tu.
 * Tra: true khi la 0-9/a-f/A-F.
 */
function isHex(c: string): boolean {
  return (c >= "0" && c <= "9") || (c >= "a" && c <= "f") || (c >= "A" && c <= "F");
}

/**
 * Nhanh union khong the toi — dung cho default cua switch quet trang thai.
 * Nhan: value — gia tri khong the xay ra.
 * Tra: khong bao gio tra; luon nem.
 */
function assertNever(value: never): never {
  throw new Error("unreachable variant: " + (JSON.stringify(value) ?? String(value)));
}

/** Kieu dong cho ban ghi / lan doc noi bo cua bo doc (ban goc khong co kieu). */
type Dyn = any;

/**
 * Khung nhin LUOI cua cac truong cap cao cua MOT doi tuong JSON, dung tu van ban con dang stream
 * hoac tu mot doi tuong da phan tich. Khong quet gi cho toi khi co nguoi doc hoi; khung nhin nho
 * lai moi cau hoi da tra loi va bao "da doi" khi chu so huu refresh de cong bo.
 * Dung cho tham so goi cong cu cua mo hinh: mot dong doc tung truong no quan tam o bat ky muc chi tiet nao.
 */
export class PartialArguments {
  /** Khung nhin cua mot lan goi KHONG co tham so. */
  static EMPTY: PartialArguments = PartialArguments.fromObject({});

  /**
   * Van ban tham so da xong, khong quet cho toi khi co nguoi doc.
   * Nhan: text — van ban tham so day du.
   * Tra: khung nhin da niem phong.
   */
  static fromText(text: string): PartialArguments {
    const view = new PartialArguments();
    view.append(text);
    view.sealed = true;
    return view;
  }

  /**
   * Khung nhin cua mot tham so DA phan tich (vi du doi tuong dispatch cua PTC).
   * Nhan: value — gia tri da phan tich.
   * Tra: khung nhin da niem phong; payload khong phai doi tuong thi khong co truong nao.
   */
  static fromObject(value: unknown): PartialArguments {
    const view = new PartialArguments();
    view.object = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, Dyn>) : {};
    view.sealed = true;
    return view;
  }

  /** Nguon: cac doan van ban hoac doi tuong da phan tich. Ba truong duy nhat duoc liet ke. */
  chunks: string[] = [];
  /** Doi tuong da phan tich (khi khung nhin dung tu object). */
  object: Record<string, Dyn> | undefined;
  /** Khung nhin da niem phong (khong append duoc nua). */
  sealed = false;
  /** Diem ket thuc luy ke cua tung doan. */
  #ends: number[] = [];
  /** Tong so ky tu da append. */
  #size = 0;
  /** So ky tu da quet. */
  #consumed = 0;
  /** Trang thai quet. */
  #mode = "root";
  /** Dang trong escape cua chuoi dang mo. */
  #escape = false;
  /** Vi tri bat dau khoa hien tai. */
  #keyStart = 0;
  /** Khoa hien tai co escape. */
  #keyEscaped = false;
  /** Khoa hien tai. */
  #key = "";
  /** Ban ghi truong dang mo. */
  #current: Dyn = null;
  /** Ngan xep dau dong cua gia tri long nhau. */
  #nestedEnds: string[] = [];
  /** Dang trong chuoi cua gia tri long nhau. */
  #nestedInString = false;
  /** Vi tri van ban khong hop le (neu co). */
  #invalidAt: number | undefined;
  /** Co gia tri khong hop le (neu co). */
  #invalidValue = false;
  /** Ban ghi theo khoa. */
  #entries = new Map<string, Dyn>();
  /** Thu tu xuat hien cua cac khoa. */
  #order: string[] = [];
  /** Cac cau hoi da tra loi (de phat hien doi). */
  #reads = new Map<string, Dyn>();

  /** Khung nhin nay co tu choi append nua khong; KHONG quet van ban va KHONG dang ky lan doc. */
  get isSealed(): boolean {
    return this.sealed;
  }

  /** Index hoac mot lan doc noi dung co gap JSON khong hop le khong; noi dung CHUA doc thi khong kiem. */
  get invalid(): boolean {
    this.scan();
    return this.#mode === "invalid" || this.#invalidValue;
  }

  /**
   * Giu them van ban tham so dang stream, khong quet va khong so sanh cau tra loi da quan sat.
   * Nhan: fragment — van ban nam sau moi doan da append truoc do.
   * Tra: khong co.
   */
  append(fragment: string): void {
    if (this.sealed) throw new Error("PartialArguments: cannot append to a sealed view");
    if (fragment.length === 0) return;
    this.chunks.push(fragment);
    this.#size += fragment.length;
    this.#ends.push(this.#size);
  }

  /**
   * Doi chieu tien to dang stream voi van ban day du co tham quyen ma khong can noi cac doan lai.
   * Nhan: text — van ban tham so cuoi cung (thay cho cac delta thieu hoac lech).
   * Tra: chinh khung nhin nay khi moi ky tu khop (giu nguyen cache); nguoc lai khung nhin moi da niem phong.
   */
  settle(text: string): PartialArguments {
    if (this.object !== undefined || text.length !== this.#size) return PartialArguments.fromText(text);
    let offset = 0;
    for (const chunk of this.chunks) {
      if (!text.startsWith(chunk, offset)) return PartialArguments.fromText(text);
      offset += chunk.length;
    }
    this.chunks = text.length === 0 ? [] : [text];
    this.#ends = text.length === 0 ? [] : [text.length];
    this.sealed = true;
    return this;
  }

  /**
   * So sanh cau tra loi da quan sat va day moc cong bo len; khung nhin chua doc thi khong quet.
   * Tra: true khi co cau tra loi doi ke tu lan doc dau hoac lan refresh truoc.
   */
  refresh(): boolean {
    if (this.#reads.size === 0) return false;
    this.scan();
    let changed = false;
    let completions = false;
    for (const read of this.#reads.values()) {
      if (read.completion) {
        completions = true;
        continue;
      }
      changed = this.refreshRead(read) || changed;
    }
    if (completions) {
      for (const read of this.#reads.values()) if (read.completion) changed = this.refreshRead(read) || changed;
    }
    if (this.sealed) this.#reads.clear();
    return changed;
  }

  /**
   * Tinh lai mot lan doc.
   * Nhan: read — ban ghi lan doc.
   * Tra: true khi cau tra loi doi.
   */
  refreshRead(read: Dyn): boolean {
    const now = read.answer();
    if (Object.is(now, read.last)) return false;
    read.last = now;
    return true;
  }

  /** Tra: khong con truong nao den duoc nua hay khong (doi tuong ngoai da dong, index loi, hoac da niem phong). */
  closed(): boolean {
    return this.remember("closed", "", () => this.closedNow());
  }

  /** Tra: cac truong cap cao da thay, theo thu tu xuat hien dau tien. */
  keys(): string[] {
    return this.remember("keys", "", () => this.keysNow(), (keys: string[]) => keys.length);
  }

  /**
   * Mot truong cap cao da xuat hien chua.
   * Nhan: key — ten tham so.
   * Tra: true khi truong da xuat hien (chuoi da mo hoac gia tri khac da bat dau).
   */
  has(key: string): boolean {
    return this.remember("has", key, () => this.hasNow(key));
  }

  /**
   * Dau dong cua mot truong da den chua (khong kiem noi dung).
   * Nhan: key — ten tham so.
   * Tra: true khi dau dong da den va khong lan doc noi dung nao bao loi cho gia tri nay.
   */
  complete(key: string): boolean {
    return this.remember("complete", key, () => this.completeNow(key));
  }

  /**
   * Do dai chuoi ma khong can vat chat hoa van ban cua no.
   * Nhan: key — ten tham so; options — do min thay doi cho chuoi dang stream.
   * Tra: do dai UTF-16 da giai ma cua truong chuoi tinh den hien tai; undefined khi vang mat hoac khong phai chuoi.
   */
  stringLength(key: string, options?: { step?: number; offset?: number }): number | undefined {
    const step = Math.max(1, Math.floor(options?.step ?? 1));
    const offset = options?.offset ?? 0;
    return this.remember(
      "length:" + String(step) + ":" + String(offset),
      key,
      () => this.lengthNow(key),
      (length: number | undefined) => (length === undefined ? undefined : Math.ceil((length + offset) / step)),
    );
  }

  /**
   * Chuoi co vuot qua gioi han do dai UTF-16 da giai ma khong (khong vat chat hoa).
   * Nhan: key — ten tham so; maxLength — gioi han (lam tron xuong, toi thieu 0).
   * Tra: true khi chuoi dai hon gioi han; false khi vang mat hoac khong phai chuoi.
   */
  stringExceeds(key: string, maxLength: number): boolean {
    const limit = Math.max(0, Math.floor(maxLength));
    return this.remember("exceeds:" + String(limit), key, () => (this.lengthNow(key, limit + 1) ?? 0) > limit);
  }

  /**
   * Doc mot chuoi da giai ma, ke ca tien to dang stream.
   * Nhan: key — ten tham so.
   * Tra: van ban da giai ma tinh den hien tai; undefined khi vang mat hoac khong phai chuoi.
   */
  text(key: string): string | undefined {
    return this.remember("text", key, () => this.textNow(key));
  }

  /**
   * Doc toi da maxLength don vi UTF-16 dau tien da giai ma cua mot chuoi.
   * Nhan: key — ten tham so; maxLength — gioi han (lam tron xuong, toi thieu 1).
   * Tra: tien to bi chan; undefined khi vang mat hoac khong phai chuoi.
   */
  textPrefix(key: string, maxLength: number): string | undefined {
    const limit = Math.max(1, Math.floor(maxLength));
    return this.remember("prefix:" + String(limit), key, () => this.textPrefixNow(key, limit));
  }

  /**
   * Doc mot tham so KHONG phai chuoi da dong.
   * Nhan: key — ten tham so.
   * Tra: gia tri da phan tich khi da dong; undefined khi con mo, vang mat, hoac la chuoi.
   */
  value(key: string): Dyn {
    return this.remember("value", key, () => this.valueNow(key));
  }

  /**
   * Tra loi mot cau hoi va, voi khung nhin dang stream, nho lai no de phat hien thay doi.
   * Nhan: kind — loai cau hoi; key — ten truong; read — ham tra loi; comparison — ham rut gon de so sanh (tuy chon).
   * Tra: ket qua cua lan doc.
   */
  remember(kind: string, key: string, read: () => Dyn, comparison?: (value: Dyn) => Dyn): Dyn {
    this.scan();
    const result = read();
    if (!this.sealed) {
      const id = kind + "/" + key;
      if (!this.#reads.has(id))
        this.#reads.set(id, {
          completion: kind === "complete",
          answer: comparison === undefined ? read : () => comparison(read()),
          last: comparison === undefined ? result : comparison(result),
        });
    }
    return result;
  }

  /** Tra: da dong hay chua (tren nguon hien tai). */
  closedNow(): boolean {
    return this.sealed || this.#mode === "closed" || this.#mode === "invalid";
  }

  /** Tra: cac khoa tren nguon hien tai. */
  keysNow(): string[] {
    return this.object === undefined ? this.#order : Object.keys(this.object);
  }

  /**
   * Tra: co khoa tren nguon hien tai khong.
   * Nhan: key — ten truong.
   */
  hasNow(key: string): boolean {
    return this.object === undefined ? this.#entries.has(key) : Object.hasOwn(this.object, key);
  }

  /**
   * Tra: truong da du chua (tren nguon hien tai).
   * Nhan: key — ten truong.
   */
  completeNow(key: string): boolean {
    if (this.object !== undefined) return Object.hasOwn(this.object, key);
    const entry = this.#entries.get(key);
    return entry !== undefined && entry.end >= 0 && (entry.kind === "string" ? entry.invalidAt === undefined : !entry.invalid);
  }

  /**
   * Do dai da giai ma (co the dung limit de dung som).
   * Nhan: key — ten truong; limit — so don vi toi da can doc.
   * Tra: do dai, hoac undefined khi khong phai truong chuoi.
   */
  lengthNow(key: string, limit: number = Number.POSITIVE_INFINITY): number | undefined {
    if (this.object !== undefined) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : undefined;
      return typeof field === "string" ? field.length : undefined;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return undefined;
    if (entry.text !== undefined && entry.text.at === entry.end) return entry.text.length;
    const read = (entry.length ??= { at: entry.start, length: 0, text: "" });
    this.readString(entry, read, limit, false);
    return read.length;
  }

  /**
   * Van ban da giai ma cua mot truong chuoi.
   * Nhan: key — ten truong.
   * Tra: van ban, hoac undefined khi khong phai truong chuoi.
   */
  textNow(key: string): string | undefined {
    if (this.object !== undefined) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : undefined;
      return typeof field === "string" ? field : undefined;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return undefined;
    if (entry.text === undefined && entry.end >= 0 && entry.needsDecoding && entry.invalidAt === undefined) {
      let text: string | undefined;
      try {
        text = JSON.parse('"' + this.slice(entry.start, entry.end) + '"');
      } catch (_error) {
        text = undefined;
      }
      if (text !== undefined)
        entry.text = {
          at: entry.end,
          length: text.length,
          text,
        };
    }
    const read = (entry.text ??= { at: entry.start, length: 0, text: "" });
    this.readString(entry, read, Number.POSITIVE_INFINITY, true);
    return read.text;
  }

  /**
   * Tien to da giai ma cua mot truong chuoi.
   * Nhan: key — ten truong; maxLength — so don vi toi da.
   * Tra: tien to, hoac undefined khi khong phai truong chuoi.
   */
  textPrefixNow(key: string, maxLength: number): string | undefined {
    if (this.object !== undefined) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : undefined;
      return typeof field === "string" ? field.slice(0, maxLength) : undefined;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return undefined;
    const prefixes = (entry.prefixes ??= new Map<number, Dyn>());
    let read = prefixes.get(maxLength);
    if (read === undefined) {
      read = {
        at: entry.start,
        length: 0,
        text: "",
      };
      prefixes.set(maxLength, read);
    }
    this.readString(entry, read, maxLength, true);
    return read.text;
  }

  /**
   * Gia tri da phan tich cua mot truong khong phai chuoi.
   * Nhan: key — ten truong.
   * Tra: gia tri, hoac undefined khi con mo / vang mat / khong hop le.
   */
  valueNow(key: string): Dyn {
    if (this.object !== undefined) {
      if (!Object.hasOwn(this.object, key)) return undefined;
      const field = this.object[key];
      return typeof field === "string" ? undefined : field;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "value" || entry.end < 0 || entry.invalid) return undefined;
    if (entry.parsed === undefined)
      try {
        entry.parsed = JSON.parse(this.slice(entry.start, entry.end));
      } catch (_error) {
        entry.invalid = true;
        this.#invalidValue = true;
      }
    return entry.parsed;
  }

  /**
   * Chi so doan chua vi tri at (tim nhi phan tren diem ket thuc luy ke).
   * Nhan: at — vi tri ky tu.
   * Tra: chi so doan.
   */
  chunkAt(at: number): number {
    let low = 0;
    let high = this.#ends.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if ((this.#ends[mid] as number) <= at) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  /**
   * Chi vat chat hoa DUNG doan duoc hoi, khong bao gio noi ca nguon tich luy.
   * Nhan: start — vi tri bat dau; end — vi tri ket thuc (khong tinh).
   * Tra: van ban cua khoang do.
   */
  slice(start: number, end: number): string {
    if (start >= end) return "";
    const first = this.chunkAt(start);
    const last = this.chunkAt(end - 1);
    const base = first === 0 ? 0 : (this.#ends[first - 1] as number);
    if (first === last) return (this.chunks[first] as string).slice(start - base, end - base);
    const parts = [(this.chunks[first] as string).slice(start - base)];
    for (let i = first + 1; i < last; i++) parts.push(this.chunks[i] as string);
    parts.push((this.chunks[last] as string).slice(0, end - (this.#ends[last - 1] as number)));
    return parts.join("");
  }

  /**
   * Doc (va tuy chon vat chat hoa) mot phan cua truong chuoi.
   * Nhan: entry — ban ghi truong; read — ban ghi lan doc; limit — so don vi toi da; materialize — co ghep van ban khong.
   * Tra: khong co (ghi truc tiep vao read).
   */
  readString(entry: Dyn, read: Dyn, limit: number, materialize: boolean): void {
    const end = Math.min(
      entry.end < 0 ? this.#consumed : entry.end,
      entry.invalidAt ?? Number.POSITIVE_INFINITY,
      this.#invalidAt ?? Number.POSITIVE_INFINITY,
    );
    if (!entry.needsDecoding) {
      const length = Math.min(end - read.at, limit - read.length);
      if (length <= 0) return;
      if (materialize) read.text += this.slice(read.at, read.at + length);
      read.at += length;
      read.length += length;
      return;
    }
    let chunkIndex = this.chunkAt(read.at);
    while (read.at < end && read.length < limit) {
      const base = chunkIndex === 0 ? 0 : (this.#ends[chunkIndex - 1] as number);
      const chunk = this.chunks[chunkIndex] as string;
      const remaining = chunk.slice(read.at - base, Math.min(chunk.length, end - base));
      const boundary = remaining.search(CONTENT_ESCAPE);
      const length = Math.min(boundary < 0 ? remaining.length : boundary, limit - read.length);
      if (length > 0) {
        if (materialize) read.text += remaining.slice(0, length);
        read.at += length;
        read.length += length;
        if (read.at === base + chunk.length) chunkIndex++;
        continue;
      }
      const type = remaining.length > 1 ? remaining[1] : read.at + 1 < end ? (this.chunks[chunkIndex + 1] as string)[0] : undefined;
      let decoded: string | undefined;
      let width = 2;
      if (remaining[0] === "\\" && type === undefined && entry.end < 0) return;
      if (remaining[0] === "\\" && type === "u") {
        const hex = this.slice(read.at + 2, Math.min(end, read.at + 6));
        let valid = true;
        for (let i = 0; i < hex.length; i++) if (!isHex(hex[i] as string)) valid = false;
        if (valid) {
          if (hex.length < 4 && entry.end < 0) return;
          if (hex.length === 4) decoded = String.fromCharCode(Number.parseInt(hex, 16));
        }
        width = 6;
      } else if (remaining[0] === "\\" && type !== undefined) decoded = SIMPLE_ESCAPES[type];
      if (decoded === undefined) {
        entry.invalidAt = read.at;
        this.#invalidValue = true;
        return;
      }
      if (materialize) read.text += decoded;
      read.length++;
      read.at += width;
      while (chunkIndex < this.chunks.length && read.at >= (this.#ends[chunkIndex] as number)) chunkIndex++;
    }
  }

  /** Tra: khong co — dinh vi cac khoang truong MOI ma khong giai ma hay phan tich noi dung cua chung. */
  scan(): void {
    if (this.object !== undefined || this.#consumed === this.#size) return;
    for (let i = this.chunkAt(this.#consumed); i < this.chunks.length && this.#invalidAt === undefined; i++) {
      const pending = this.chunks[i] as string;
      const base = i === 0 ? 0 : (this.#ends[i - 1] as number);
      for (let index = this.#consumed - base; index < pending.length && this.#mode !== "invalid"; index++) {
        if (this.#mode === "string" || (this.#mode === "nested" && this.#nestedInString)) {
          const end = this.stringBoundary(pending, index);
          this.#consumed += end - index;
          index = end;
          if (index === pending.length) break;
        }
        this.step(pending[index] as string, this.#consumed);
        this.#consumed++;
      }
    }
  }

  /**
   * Chi dau nhay THO va chuoi gach nguoc truoc no moi ket thuc duoc mot chuoi.
   * Nhan: fragment — doan van ban; start — vi tri bat dau.
   * Tra: vi tri ket thuc chuoi trong doan.
   */
  stringBoundary(fragment: string, start: number): number {
    let at = start;
    while (true) {
      const quote = fragment.indexOf('"', at);
      const end = quote < 0 ? fragment.length : quote;
      if (this.#mode === "string") {
        const entry = this.#current;
        if (!entry.needsDecoding && CONTENT_ESCAPE.test(fragment.slice(at, end))) entry.needsDecoding = true;
      }
      let slashStart = end;
      while (slashStart > at && fragment[slashStart - 1] === "\\") slashStart--;
      const escaped = (end - slashStart) % 2 === 1 !== (slashStart === at && this.#escape);
      this.#escape = quote < 0 && escaped;
      if (quote < 0 || !escaped) return end;
      at = quote + 1;
    }
  }

  /**
   * Buoc quet mot ky tu theo trang thai hien tai.
   * Nhan: c — ky tu; at — vi tri cua no.
   * Tra: khong co.
   */
  step(c: string, at: number): void {
    switch (this.#mode) {
      case "root":
        if (isWhitespace(c)) return;
        if (c === "{") {
          this.#mode = "key-or-end";
          return;
        }
        this.fail();
        return;
      case "key-or-end":
        if (isWhitespace(c)) return;
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key-only":
        if (isWhitespace(c)) return;
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key":
        this.stepKey(c, at);
        return;
      case "colon":
        if (isWhitespace(c)) return;
        if (c === ":") {
          this.#mode = "value";
          return;
        }
        this.fail();
        return;
      case "value":
        this.beginValue(c, at);
        return;
      case "string": {
        const entry = this.#current;
        entry.end = at;
        this.#current = null;
        this.#mode = "comma-or-end";
        return;
      }
      case "scalar":
        this.stepScalar(c, at);
        return;
      case "nested":
        this.stepNested(c, at);
        return;
      case "comma-or-end":
        if (isWhitespace(c)) return;
        if (c === ",") {
          this.#mode = "key-only";
          return;
        }
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        this.fail();
        return;
      case "closed":
        if (isWhitespace(c)) return;
        this.fail();
        return;
      case "invalid":
        return;
      default:
        assertNever(this.#mode as never);
    }
  }

  /** Tra: khong co — danh dau van ban khong hop le tai vi tri dang quet. */
  fail(): void {
    this.#invalidAt = this.#consumed;
    this.#mode = "invalid";
    this.#current = null;
  }

  /**
   * Mo mot khoa moi.
   * Nhan: at — vi tri dau nhay mo khoa.
   * Tra: khong co.
   */
  beginKey(at: number): void {
    this.#mode = "key";
    this.#keyStart = at + 1;
    this.#keyEscaped = false;
    this.#escape = false;
  }

  /**
   * Buoc quet mot ky tu cua khoa; dong khoa thi chuyen sang cho dau hai cham.
   * Nhan: c — ky tu; at — vi tri cua no.
   * Tra: khong co.
   */
  stepKey(c: string, at: number): void {
    if (c < " ") {
      this.fail();
      return;
    }
    if (this.#escape) {
      this.#escape = false;
      return;
    }
    if (c === "\\") {
      this.#escape = true;
      this.#keyEscaped = true;
      return;
    }
    if (c !== '"') return;
    const raw = this.slice(this.#keyStart, at);
    if (this.#keyEscaped)
      try {
        this.#key = JSON.parse('"' + raw + '"');
      } catch (_error) {
        this.fail();
        return;
      }
    else this.#key = raw;
    this.#mode = "colon";
  }

  /**
   * Ghi ban ghi cua mot truong vao ban do va thu tu xuat hien.
   * Nhan: entry — ban ghi truong.
   * Tra: khong co.
   */
  open(entry: Dyn): void {
    if (!this.#entries.has(this.#key)) this.#order.push(this.#key);
    this.#entries.set(this.#key, entry);
    this.#current = entry;
  }

  /**
   * Mo gia tri cua truong hien tai (chuoi, gia tri long nhau, hay scalar).
   * Nhan: c — ky tu dau; at — vi tri cua no.
   * Tra: khong co.
   */
  beginValue(c: string, at: number): void {
    if (isWhitespace(c)) return;
    if (c === '"') {
      this.open({
        kind: "string",
        start: at + 1,
        end: -1,
        needsDecoding: false,
        invalidAt: undefined,
        length: undefined,
        text: undefined,
        prefixes: undefined,
      });
      this.#escape = false;
      this.#mode = "string";
      return;
    }
    if (c === "}" || c === "," || c === ":" || c === "]") {
      this.fail();
      return;
    }
    this.open({
      kind: "value",
      start: at,
      end: -1,
      parsed: undefined,
      invalid: false,
    });
    if (c === "{" || c === "[") {
      this.#mode = "nested";
      this.#nestedEnds = [c === "{" ? "}" : "]"];
      this.#nestedInString = false;
      this.#escape = false;
      return;
    }
    this.#mode = "scalar";
  }

  /**
   * Buoc quet mot gia tri scalar (so / true / false / null).
   * Nhan: c — ky tu; at — vi tri cua no.
   * Tra: khong co.
   */
  stepScalar(c: string, at: number): void {
    if (c !== "," && c !== "}" && !isWhitespace(c)) return;
    this.closeValue(at);
    this.#mode = c === "," ? "key-only" : c === "}" ? "closed" : "comma-or-end";
  }

  /**
   * Buoc quet mot gia tri long nhau (doi tuong / mang).
   * Nhan: c — ky tu; at — vi tri cua no.
   * Tra: khong co.
   */
  stepNested(c: string, at: number): void {
    if (this.#nestedInString) {
      this.#nestedInString = false;
      return;
    }
    if (c === '"') {
      this.#nestedInString = true;
      return;
    }
    if (c === "{" || c === "[") {
      this.#nestedEnds.push(c === "{" ? "}" : "]");
      return;
    }
    if (c === "}" || c === "]") {
      if (this.#nestedEnds.pop() !== c) {
        this.fail();
        return;
      }
      if (this.#nestedEnds.length === 0) {
        this.closeValue(at + 1);
        this.#mode = "comma-or-end";
      }
    }
  }

  /**
   * Dong ban ghi truong dang mo.
   * Nhan: end — vi tri ket thuc.
   * Tra: khong co.
   */
  closeValue(end: number): void {
    const entry = this.#current;
    entry.end = end;
    this.#current = null;
  }
}
