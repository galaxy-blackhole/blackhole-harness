/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Metadata thay row cua tung package: doc tu package.json va sinh khoi patch disable+insert (task-13).
 */

/** Gia tri config trong metadata: literal, hoac bieu thuc JS cua cordis (!!js). */
export type GbhConfigValue = string | number | boolean | { js: string };

/** Phan thay row ma mot package khai bao trong package.json (truong `gbh`). */
export interface GbhRowMetadata {
  /** Id cua row stock bi tat. */
  readonly id: string;
  /**
   * Goi GBH-ONLY: KHONG tat row nao (row stock khong ton tai), chi phat khoi `insert`.
   * Dung cho lop vo cua ta (vd `shell-identity`: favicon/manifest/title) de khong sinh canh bao
   * `patch: entry "<id>" not found` moi luot boot.
   */
  readonly insertOnly?: boolean;
  /**
   * Row do MỘT BUNDLE TÍNH NĂNG cắm (patch của bundle), KHÔNG phải row của lõi.
   * Có cờ này thì `renderRewriteBlock` KHÔNG phát khối nào ⇒ app patch không "disable row stock" và không
   * chèn `<id>-ours`; nhờ vậy bật/tắt bundle là bật/tắt đúng row (không còn cảnh báo
   * "cấu hình ưu tiên cao hơn ghi đè" khi bấm công tắc thành phần).
   */
  readonly ownedByBundle?: boolean;
  /**
   * Thay row TAI CHO (giu NGUYEN id stock) thay vi `disable + insert <id>-ours`.
   * Dung cho row ma NAMESPACE cai dat phai trung id row: khi id la `<id>-ours`, tang cai dat
   * (configEditor + settings) ghi vao settings.yaml theo id stock roi compose lai voi patch
   * `insert` (khong co config) ⇒ gia tri roi mat ⇒ UI bao "Could not save".
   * Do duoc 21/10/2026 voi row ui-settings (entry = ui-settings-ours).
   */
  readonly replaceInPlace?: boolean;
  /** Danh sach inject cua row moi (bo qua neu khong khai). */
  readonly inject?: readonly string[];
  /** Config cua row moi, giu nguyen nhu row stock. */
  readonly config?: Readonly<Record<string, GbhConfigValue>>;
  /**
   * Gia tri `disabled` cua row STOCK bi tat (bo qua = `true`).
   *
   * ⚠️ 18/10/2026 — CAN cho row TAT CO DIEU KIEN: DSH giu nguyen bieu thuc
   * (`disabled: !!js process.platform !== 'win32'`) de Loader tu quyet luc nap;
   * ghi de `true` se doi hanh vi tren nen tang khac.
   * @example { js: "process.platform !== 'win32'" }
   */
  readonly disabled?: boolean | { readonly js: string };
  /**
   * Gia tri `disabled` cho row DUOC CHEN (bo qua = row chen BAT, nhu cu).
   *
   * Vi sao can (do 18/10/2026): `disabled` o tren chi ap cho row stock; row chen
   * luon duoc render KHONG co `disabled` ⇒ muon MIRROR mot row stock dang TAT
   * (vi du oracle tat `session-title-llm`) thi khong co cach khai. Test do that:
   * khai `gbh.row` ⇒ --dump-config hien `<id>-ours` KHONG disabled ⇒ provider bat
   * ⇒ nem 'already registered'. Truong nay render dung dong `disabled` trong khoi
   * `insert`, giu nguyen dinh dang `!!js` khi can.
   * @example true
   */
  readonly insertDisabled?: boolean | { readonly js: string };
  /**
   * Cac id module KHAC ma bundle cua row nay dang ky them (alias) — bo nap cua ta se copy rev,
   * xoa khi invalidate va giu theo owner khi prune (co che cua packages/client/modules).
   * Khong tu viet logic HMR trong row: chi KHAI o day.
   */
  readonly aliases?: readonly string[];

  /** Tên package STOCK mà row này thay thế ở tầng HOST: mount tạo symlink host alias sau lượt mount toàn cục (task-110). */
  readonly hostAliases?: readonly string[];
  /**
   * Id cua row DUOC CHEN, khi can khop id voi oracle (vi du gbh-brand).
   * Mac dinh la <id>-ours. Dung khi thay mot row ma oracle chen bang id khac.
   */
  readonly insertAs?: string;
  /**
   * Chen khoi cua row nay NGAY SAU row co id nay (khop thu tu row voi oracle, vi du "ui-brand-official").
   * Chi row nao khai truong nay moi doi vi tri; cac row khac van noi vao cuoi patch.
   */
  readonly insertAfter?: string;

  /** Cac test hanh vi chung minh row nay tuong duong (duong dan tuong doi repo). */
  readonly tests?: readonly string[];
}

/** Metadata day du cua mot package viet lai. */
export interface GbhPackageMetadata {
  /** Phan thay row (thieu truong nay = package khong thay row nao). */
  readonly row?: GbhRowMetadata;
  /** Peer bo sung ngoai cordis + schemastery (chi duoc dung voi cac goi thuoc seam cua kernel). */
  readonly peers?: readonly string[];
}

/**
 * Doc metadata `gbh` tu package.json cua mot package.
 * @param packageJsonText - noi dung package.json.
 * @returns metadata, hoac undefined khi thieu/khong hop le.
 */
export function parseGbhMetadata(packageJsonText: string): GbhPackageMetadata | undefined {
  let parsed: { gbh?: unknown };
  try {
    parsed = JSON.parse(packageJsonText) as { gbh?: unknown };
  } catch {
    return undefined;
  }
  const gbh = parsed.gbh;
  if (typeof gbh !== "object" || gbh === null) return undefined;
  const row = (gbh as { row?: unknown }).row;
  if (row === undefined) return { peers: readPeers(gbh) };
  if (typeof row !== "object" || row === null) return undefined;
  const id = (row as { id?: unknown }).id;
  if (typeof id !== "string" || id.trim() === "") return undefined;
  const inject = readStringArray((row as { inject?: unknown }).inject);
  const config = readConfig((row as { config?: unknown }).config);
  const tests = readStringArray((row as { tests?: unknown }).tests);
  const aliases = readStringArray((row as { aliases?: unknown }).aliases);
  const insertAs = typeof (row as { insertAs?: unknown }).insertAs === "string" ? (row as { insertAs: string }).insertAs : undefined;
  const insertAfter = typeof (row as { insertAfter?: unknown }).insertAfter === "string" ? (row as { insertAfter: string }).insertAfter : undefined;
  const hostAliases = readStringArray((row as { hostAliases?: unknown }).hostAliases);
  const insertOnly = (row as { insertOnly?: unknown }).insertOnly === true;
  // 21/10/2026: co THAY TAI CHO (giu id stock) — xem ghi chu o type GbhRowMetadata.replaceInPlace.
  const replaceInPlace = (row as { replaceInPlace?: unknown }).replaceInPlace === true;
  // 25/10/2026 — row thuộc bundle tính năng: xem ghi chú ở type GbhRowMetadata.ownedByBundle.
  const ownedByBundle = (row as { ownedByBundle?: unknown }).ownedByBundle === true;
  const disabled = readDisabled((row as { disabled?: unknown }).disabled);
  const insertDisabled = readDisabled((row as { insertDisabled?: unknown }).insertDisabled);
  return {
    row: { id, ...(insertOnly ? { insertOnly } : {}), ...(ownedByBundle ? { ownedByBundle } : {}), ...(replaceInPlace ? { replaceInPlace } : {}), ...(hostAliases === undefined ? {} : { hostAliases }), ...(disabled === undefined ? {} : { disabled }), ...(insertDisabled === undefined ? {} : { insertDisabled }), ...(inject === undefined ? {} : { inject }), ...(config === undefined ? {} : { config }), ...(tests === undefined ? {} : { tests }), ...(aliases === undefined ? {} : { aliases }), ...(insertAs === undefined ? {} : { insertAs }), ...(insertAfter === undefined ? {} : { insertAfter }) },
    peers: readPeers(gbh),
  };
}

/**
 * Sinh khoi patch disable+insert tu metadata — dung co che ADR 0004 §2.
 * @param specifier - ten package cua ta (se la `name` cua row moi).
 * @param row - metadata row.
 * @returns van ban YAML cua khoi (da ket thuc bang newline).
 */
export function renderRewriteBlock(specifier: string, row: GbhRowMetadata): string {
  // 25/10/2026 — row của bundle tính năng: bundle patch là NGUỒN DUY NHẤT cắm row; app patch đứng ngoài.
  if (row.ownedByBundle === true) return "";
  // 19/10/2026 — GOI GBH-ONLY (vd `shell-identity` = lop vo L3 favicon/manifest): row stock KHONG TON TAI
  // ⇒ phat khoi `- id: <id> / disabled: true` se sinh canh bao `patch: entry "<id>" not found` MOI luot boot.
  // `gbh.row.insertOnly: true` ⇒ CHI phat khoi insert (khong tat row nao).
  const onlyInsert = row.insertOnly === true;
  const insertLines = ["- insert:", "    - id: " + (row.insertAs ?? row.id + "-ours"), "      name: '" + specifier + "'"];
  // 21/10/2026: `replaceInPlace` ⇒ giu id stock, chi doi `name` (khong tat row, khong insert ban sao).
  const replaceLines = ["- id: " + row.id, "  name: '" + specifier + "'"];
  const lines = row.replaceInPlace === true
    ? replaceLines
    : onlyInsert
      ? insertLines
      : ["- id: " + row.id, "  disabled: " + renderDisabled(row.disabled), "", ...insertLines];
  // Row CHEN cung can `disabled` khi phai MIRROR row stock dang tat (vd oracle tat session-title-llm).
  if (row.insertDisabled !== undefined) lines.push("      disabled: " + renderDisabled(row.insertDisabled));
  if (row.inject !== undefined && row.inject.length > 0) {
    lines.push("      inject:");
    for (const entry of row.inject) lines.push("        - " + renderInjectEntry(entry));
  }
  if (row.config !== undefined && Object.keys(row.config).length > 0) {
    lines.push("      config:");
    for (const [key, value] of Object.entries(row.config)) lines.push("        " + key + ": " + renderValue(value));
  }
  // ⚠️ BAT BUOC: phat `aliases` vao patch — neu khong thi tang nap KHONG BAO GIO thay no.
  // LOI THAT 17/10/2026 (hau qua: app suy giam, 26 -> 13 goi cua ta chay that):
  //   `aliases` da duoc DOC o docMetadata (dong ~71) va mang trong GbhRowMetadata, nhung
  //   `renderRewriteBlock` KHONG he in ra patch => `app.patch.yml` co **0 dong `aliases`**.
  //   Hau qua day chuyen: tang nap khong co gi de sinh entry alias => id stock MAT ENTRY =>
  //   moi row phu thuoc `require("<goi goc>/client")` treo; do duoc: entry 98 -> 72 va
  //   `inject treo` 4 -> 105, `id chi co o ref` 0 -> 13.
  //   => Va day la LY DO TON TAI cua 'dang khai cu': vi patch khong mang `aliases`, cach DUY NHAT
  //      de co entry stock la nhet id stock vao `moduleIds`. Tuc ca 'dang khai cu' la WORKAROUND
  //      cho mot loi cua trinh sinh patch, khong phai mot lua chon thiet ke.
  //   => Sua o DAY moi dung goc: giu duoc luat 'bundle MOT id' + `moduleIds` chi id cua ta.
  if (row.aliases !== undefined && row.aliases.length > 0) {
    const le = row.replaceInPlace === true ? "  " : "      ";
    lines.push(le + "aliases:");
    for (const entry of row.aliases) lines.push(le + "  - " + renderInjectEntry(entry));
  }
  return lines.join("\n") + "\n";
}

/**
 * Render mot entry cua `inject` theo YAML — QUOTE CHI KHI CAN.
 *
 * VI SAO KHONG QUOTE TAT CA: trong YAML, scalar bat dau bang `@` (vd `@deepseek-ai/dsh-api-remotes`)
 * la KY TU DANH RIENG ⇒ patch sinh ra KHONG PARSE DUOC ⇒ moi luot boot sau do CHET (loi that
 * 17/10/2026: `parsePatchList` nem YAML parse error, harness thoat code 1).
 * Nhung quote ca entry khong can thiet thi **khac dinh dang cua ban goc** ⇒ anh huong parity (G1)
 * va lam test ADR 0004 §2 do. ⇒ Luat: quote khi scalar KHONG an toan o dang tran, giu tran khi an toan.
 * @param entry - mot id module trong `gbh.row.inject`.
 * @returns van ban YAML cho entry do (da quote neu can).
 */
function renderInjectEntry(entry: string): string {
  return isPlainSafeYamlScalar(entry) ? entry : "'" + entry.replace(/'/g, "''") + "'";
}

/**
 * Kiem mot scalar co an toan khi viet TRAN trong YAML khong.
 *
 * YAML co nghia dac biet cho: ky tu mo dau (`@` `\`` `-` `?` `:` `,` `[` `]` `{` `}` `#`
 * `&` `*` `!` `|` `>` `'` `"` `%`), khoang trang o dau/cuoi, chuoi rong, va cac dang
 * `:` + space hay ` #`. Ngoai ra phai khong trong nhu bool/null/so de tranh bi doc thanh kieu khac.
 * @param value - gia tri can kiem.
 * @returns true khi co the viet tran.
 */
function isPlainSafeYamlScalar(value: string): boolean {
  if (value.length === 0) return false;
  if (/^[\s]|[\s]$/.test(value)) return false;
  if (/^[@\`\-?:,\[\]{}#&*!|>'"%]/.test(value)) return false;
  if (/: /.test(value) || / #/.test(value)) return false;
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(value)) return false;
  if (/^[+-]?(\d[\d_]*)(\.\d*)?([eE][+-]?\d+)?$/.test(value)) return false;
  return true;
}

/**
 * Render mot gia tri config theo YAML cua harness (!!js cho bieu thuc).
 * @param value - gia tri trong metadata.
 * @returns van ban YAML.
 */
function renderValue(value: GbhConfigValue): string {
  // ⚠️ 18/10/2026 — LOI THAT: `!!js` chua ` : ` sinh YAML HONG. Vi du row `approval`:
  //   policy: !!js (process.env.X ?? 'a') === 'b' ? 'never' : 'ask'
  //   => YAML doc `!!js (…) ? 'never'` la KHOA va `'ask'` la GIA => "Nested mappings are not
  //   allowed in compact mappings" => row CHET luc boot (`ValidationError: $.policy expected
  //   "ask" | "never" but got {"[object Object]":"ask"}`), va `ctx.approval` bi mat theo
  //   (permission-presets + auto-review chuyen sang pending).
  //   => SUA: quote NGOAC KEP khi bieu thuc khong an toan o dang tran (dung `isPlainSafeYamlScalar`,
  //   cung luat voi `renderInjectEntry`). Da chung minh bang chinh thu vien `yaml` cua harness:
  //   ngoac kep => parse OK; de tran => HONG; ngoac don => HONG (bieu thuc chua `'`).
  if (typeof value === "object" && value !== null && typeof value.js === "string") {
    const expr = value.js;
    if (isPlainSafeYamlScalar(expr)) return "!!js " + expr;
    return "!!js " + JSON.stringify(expr);
  }
  // 19/10/2026 — SU CO THAT (app chet sau khi mount host-webserver): co goi luu bieu thuc DANG CHUOI
  // `"!!js ctx.webStartup.host ?? '127.0.0.1'"` trong `gbh.row.config`. Neu quote chuoi do thi harness nhan
  // CHUOI ⇒ `webserver: host "!!js …" is not a concrete IPv4 or IPv6 address literal` ⇒ khong cap service
  // `webServer` ⇒ 8 entry pending ⇒ app chet. => Chuoi bat dau bang `!!js ` phai phat lai TAG, khong quote.
  if (typeof value === "string") {
    if (value.startsWith("!!js ")) {
      const expr = value.slice("!!js ".length);
      if (isPlainSafeYamlScalar(expr)) return "!!js " + expr;
      return "!!js " + JSON.stringify(expr);
    }
    return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value) ? value : JSON.stringify(value);
  }
  return String(value);
}

/**
 * Doc danh sach chuoi tu mot gia tri chua biet.
 * @param value - gia tri can doc.
 * @returns mang chuoi, hoac undefined.
 */
function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  return out.length === 0 ? undefined : out;
}

/**
 * Doc bang config tu mot gia tri chua biet (bo qua khoa khong hop le).
 * @param value - gia tri can doc.
 * @returns bang config, hoac undefined.
 */
function readDisabled(value: unknown): boolean | { js: string } | undefined {
  if (typeof value === "boolean") return value;
  // 19/10/2026 (row plugin-market): manifest co the khai disabled dang CHUOI `!!js '!ctx.get(...)'` — chap nhan
  // dang chuoi de giu nguyen dieu kien cua stock thay vi ep ve boolean (ep = doi hanh vi luc nap).
  if (typeof value === "string" && value.startsWith("!!js ")) return { js: value.slice(5) };
  if (typeof value === "object" && value !== null && typeof (value as { js?: unknown }).js === "string") {
    return { js: (value as { js: string }).js };
  }
  return undefined;
}

/**
 * Render gia tri `disabled` cua row trong patch — literal bool hoac `!!js` (quote khi can).
 *
 * VI SAO CAN: DSH giu nguyen bieu thuc `disabled: !!js process.platform !== 'win32'` de Loader
 * tu quyet luc nap; neu ta luon ghi `disabled: true` thi khong the mount row tat-co-dieu-kien
 * ma van giu dieu kien (bai hoc 18/10/2026 voi `pwsh-sandbox` · `config-editor` · `settings`).
 * @param value - gia tri trong metadata (bo trong = true).
 * @returns van ban YAML.
 */
function renderDisabled(value: boolean | { js: string } | undefined): string {
  if (value === undefined) return "true";
  if (typeof value === "boolean") return value ? "true" : "false";
  const expr = value.js;
  return isPlainSafeYamlScalar(expr) ? "!!js " + expr : "!!js " + JSON.stringify(expr);
}

function readConfig(value: unknown): Record<string, GbhConfigValue> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const out: Record<string, GbhConfigValue> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") out[key] = entry;
    else if (typeof entry === "object" && entry !== null && typeof (entry as { js?: unknown }).js === "string") {
      out[key] = { js: (entry as { js: string }).js };
    }
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

/**
 * Doc danh sach peer bo sung.
 * @param gbh - truong gbh da parse.
 * @returns mang chuoi, hoac undefined.
 */
function readPeers(gbh: object): string[] | undefined {
  return readStringArray((gbh as { peers?: unknown }).peers);
}