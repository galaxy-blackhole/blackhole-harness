/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Sinh BUNDLE PATCH của ta (task-191): chép 17 tệp patch của 13 bundle stock, CHỈ đổi dòng `name:` theo
 *      bảng provenance (packages/<tier>/<goi>/package.json → gbh.provenance.stock). Cổng hai chiều: số dòng bằng gốc;
 *      mọi dòng khác gốc PHẢI khớp đúng khuôn `name: '<gói ta>'` — sai là throw. Gói chưa chuyển giữ nguyên tên stock.
 *      11/11/2026: thêm phép đổi THỨ HAI — persona của 3 preset "coding agent" sang `{{model_label}}`, để route
 *      `auto` đọc là "Galaxy Blackhole" thay vì id dây `deepseek-v4.1-flash` (cổng riêng: không còn `{{model}}`).
 *      11/11/2026: thêm phép THỨ BA — CONFIG của vài row ta sở hữu (`CONFIG_ROW_LOP_BUNDLE`) + GÓI RIÊNG cho row
 *      (`GOI_RIENG_CUA_ROW`), chèn ngay tại row ở LỚP BUNDLE. Vì sao: lớp overlay `app.patch.yml` là lớp CUỐI,
 *      ghim row/config ở đó thì mọi lượt ghi vào namespace của row bị Host từ chối
 *      `settings/rejected: overridden by a home patch` (đo trên app 5439 ngày 11/11/2026).
 */
import { readFileSync, readdirSync, mkdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Gốc repo (tools/ ⇒ một cấp lên). */
const REPO = join(import.meta.dir, "..");
/** Kernel stock CHỈ ĐỌC. */
const KERNEL = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Thư mục gói bundle của ta. */
const BUNDLE = join(REPO, "packages", "host", "bundle");

/**
 * 13 bundle theo ĐÚNG thứ tự composition của app: 12 bundle trong APP_PROFILE_BUNDLES của apps/cli
 * + `dsh-experimental-voice-input-bundle` (có trong dsh.profile.bundles của profile đang chạy).
 * Tổng tệp patch = 1 (base) + 5 (web-app: cordis + 4 presets) + 11 (experimental) = 17.
 */
const BUNDLES: readonly string[] = [
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "@deepseek-ai/dsh-experimental-plugin-market-bundle",
  "@deepseek-ai/dsh-experimental-agent-team-profile",
  "@deepseek-ai/dsh-experimental-terminal-bundle",
  "@deepseek-ai/dsh-experimental-session-search",
  "@deepseek-ai/dsh-experimental-inspector-profile",
  "@deepseek-ai/dsh-experimental-auto-review",
  "@deepseek-ai/dsh-experimental-tool-worktree",
  "@deepseek-ai/dsh-experimental-cot-translation-bundle",
  "@deepseek-ai/dsh-experimental-ralph-bundle",
  "@deepseek-ai/dsh-experimental-session-titles-bundle",
  "@deepseek-ai/dsh-experimental-voice-input-bundle",
];

/** Bảng provenance: specifier stock → tên gói CỦA TA. */
interface Provenance {
  /** specifier stock (vd `@deepseek-ai/dsh-persona`). */ readonly stock: string;
  /** tên gói ta (vd `@galaxy-blackhole/gbh-persona`). */ readonly ours: string;
}

/**
 * Quét packages/{host,client,shared}/* /package.json lấy bảng provenance (stock → ours).
 * Nhận: không. Trả: bảng đã sắp xếp theo stock (khử trùng; gói khai sau không ghi đè).
 */
export function readProvenance(): Provenance[] {
  // 21/10/2026 (task-196): tra ve TAT CA cap (stock, ours), KHONG khu trung — vi mot stock co the co 2 goi cua ta
  // (vd `dsh-client-ui-approval` bi ca gbh-approval lan gbh-client-ui-approval khai). Buoc chon o generate() se
  // quyet dinh theo TEN CHUAN HOA (client half vs host half) — nguon su that la chinh ten goi stock.
  const out: Provenance[] = [];
  for (const tier of ["host", "client", "shared"]) {
    let names: string[];
    try {
      names = readdirSync(join(REPO, "packages", tier)).sort();
    } catch {
      continue;
    }
    for (const name of names) {
      let manifest: { name?: string; gbh?: { provenance?: { stock?: unknown }; row?: { stockId?: unknown; aliases?: unknown } } };
      try {
        manifest = JSON.parse(readFileSync(join(REPO, "packages", tier, name, "package.json"), "utf8")) as typeof manifest;
      } catch {
        continue;
      }
      const ours = typeof manifest.name === "string" ? manifest.name : "";
      const row = manifest.gbh?.row ?? {};
      const stock = manifest.gbh?.provenance?.stock ?? row.stockId ?? (Array.isArray(row.aliases) ? row.aliases[0] : undefined);
      if (typeof stock !== "string" || stock === "" || ours === "") continue;
      if (!out.some((entry) => entry.stock === stock && entry.ours === ours)) out.push({ stock, ours });
    }
  }
  return out.sort((a, b) => a.stock.localeCompare(b.stock));
}

/** Dấu "rowId mơ hồ" (nhiều gói cùng khai) — bị loại khỏi bảng đồ. */
const MO_HO = "?mo-ho?";

/**
 * Bang do rowId → ten goi cua ta (chi giu rowId KHONG mo ho).
 * Nhan: khong. Tra: Map rowId → specifier cua ta, da loai rowId do nhieu goi cung khai.
 */
export function readRowIdMap(): Map<string, string> {
  const out = new Map<string, string>();
  for (const tier of ["host", "client", "shared"]) {
    let names: string[] = [];
    try {
      names = readdirSync(join(REPO, "packages", tier)).sort();
    } catch {
      continue;
    }
    for (const name of names) {
      try {
        const manifest = JSON.parse(readFileSync(join(REPO, "packages", tier, name, "package.json"), "utf8")) as {
          name?: string;
          gbh?: { row?: { id?: unknown } };
        };
        const ours = typeof manifest.name === "string" ? manifest.name : "";
        const rowId = manifest.gbh?.row?.id;
        if (ours === "" || typeof rowId !== "string" || rowId === "") continue;
        // 21/10/2026 (task-196): CHỈ nhận rowId KHÔNG mơ hồ. Đo được ca thật: rowId "ui-approval" do HAI gói khai
        // (gbh-approval nửa host + gbh-client-ui-approval nửa client) ⇒ map bừa sẽ trỏ sai gói và gây
        // "service has been registered" / nạp trùng. Mơ hồ ⇒ bỏ, giữ nguyên tên stock (an toàn).
        if (out.has(rowId)) {
          out.set(rowId, MO_HO);
          continue;
        }
        out.set(rowId, ours);
      } catch {
        continue;
      }
    }
  }
  for (const [rowId, ours] of [...out.entries()]) if (ours === MO_HO) out.delete(rowId);
  return out;
}


/**
 * Row ở LỚP BUNDLE phải cắm bằng GÓI RIÊNG của nó, KHÔNG dùng subpath của gói khác.
 *
 * Vì sao (11/11/2026 — lỗi thật trên app 5439): row `subagent-model-selection-settings` nằm trong
 * `web-app.patch.yml` với `name: '@galaxy-blackhole/gbh-host-tool-subagent/model-selection-settings'` (subpath của
 * gói `gbh-host-tool-subagent`), trong khi gói KHAI `gbh.row.id` cho row đó là
 * `@galaxy-blackhole/gbh-subagent-model-selection-settings`. `bundleDefinedNames()`
 * (apps/cli/src/profile.ts) so specifier THEO CHUỖI nên không nhận ra row này là "do bundle định nghĩa", và
 * `bh host` sinh lại khối `disable + insert <id>-ours` vào overlay `app.patch.yml` MỖI lượt boot. Overlay là
 * lớp CUỐI, không ai ghi đè được nó: công tắc "Dùng đúng model chính" (Cài đặt → Subagent) trả
 * `settings/rejected: overridden by a home patch`, và id row lệch (`-ours`) nên Settings còn không thấy
 * namespace. Nay row mang ĐÚNG tên gói của nó ⇒ khớp chuỗi ⇒ không còn khối overlay nào.
 */
const GOI_RIENG_CUA_ROW: ReadonlyMap<string, string> = new Map<string, string>([
  ["subagent-model-selection-settings", "@galaxy-blackhole/gbh-subagent-model-selection-settings"],
]);

/**
 * CONFIG của row ta sở hữu, viết NGAy Ở LỚP BUNDLE — dạng dòng YAML THỤT LỀ TƯƠNG ĐỐI (0 = `config:`), chèn ngay
 * sau dòng `name:` của row (thụt lề lấy theo chính dòng đó, +2 cho con).
 *
 * Vì sao PHẢI ở lớp bundle (11/11/2026): tài liệu cài đặt của người dùng là `<profile>/cordis.patch.yml`; nó nằm
 * SAU bundle nhưng TRƯỚC overlay `app.patch.yml`. Row do overlay cắm hoặc overlay ghim `config` ⇒ mỗi lượt
 * `settings/mutate` ghi vào tài liệu người dùng xong, phép compose lại thấy giá trị bị lớp cuối nuốt ⇒ Host ném
 * `Configuration for "<id>" is overridden by a home patch or command-line overlay`. Ha xuống bundle thì cấu hình
 * người dùng thắng, công tắc trong Cài đặt lưu được (đúng luật đã ghi ở tools/check/settings-surface.ts).
 *
 * CỔNG: mỗi row id ở đây PHẢI có đúng MỘT row trong 17 tệp sinh ra (không có ⇒ throw, tránh bảng mục nát).
 */
const CONFIG_ROW_LOP_BUNDLE: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  [
    "llm-pi-ai",
    [
      "config:",
      "  providers:",
      "    auto:",
      "      displayName: Galaxy Blackhole",
      "      api: openai-completions",
      "      baseURL: https://ollama.com/v1",
      "      apiKeyEnv: GBH_GALAXY_API_KEY",
      "      defaultContextWindow: 655360",
      "      defaultMaxTokens: 32768",
      "      retryPolicy:",
      "        mode: normal",
      "        maxRetries: 6",
      "        retryableCodes:",
      "          - EMPTY_RESPONSE",
      "          - RATE_LIMIT",
      "          - SERVER",
      "          - TIMEOUT",
      "          - TRANSPORT",
      "        backoff:",
      "          initialDelayMs: 1000",
      "          maxDelayMs: 30000",
      "          jitterRatio: 0.2",
      "      models:",
      "        - id: deepseek-v4.1-flash",
      "          name: Auto",
      "          contextWindow: 655360",
      "          maxTokens: 32768",
      "          input:",
      "            - text",
      "            - image",
      "          reasoningEfforts:",
      "            off:",
      "            low: low",
      "            high: high",
      "            max: max",
    ],
  ],
  [
    "subagent-model-selection-settings",
    ["config:", "  enabled: true", "  allowedModels:", "    - provider: auto", "      model: deepseek-v4.1-flash"],
  ],
]);

/** Các row bị mặt phẳng web TẮT trong `web-app.patch.yml` nhưng CẦN BẬT trong preset (nếu không, agent
 * trong phiên mất công cụ/lệnh: Kế hoạch, Nén lịch sử, subagent, workflow). Đo được 22/10/2026: log host
 * in `agent-preset[...] cây: plan-mode [disabled]` v.v. ⇒ trang Plugins hiện "Đã tắt" và menu "+" thiếu mục.
 */
const BAT_LAI_TRONG_PRESET = new Set([
  "plan-mode",
  "compaction-basic",
  "command-compact",
  "tool-result-pruner",
  "tool-subagent-control",
  "tool-subagent",
  "workflow-ptc",
  "tool-workflow",
]);

/**
 * Bật lại các row nói trên trong tệp patch của preset bằng cách chèn `disabled: false` ngay sau dòng id.
 * Nhận: text — nội dung patch đã sinh; laPreset — chỉ áp cho tệp trong thư mục presets/.
 * Trả: nội dung sau khi chèn (hoặc nguyên bản khi không thuộc diện).
 */
function batLaiTrongPreset(text: string, laPreset: boolean): string {
  if (!laPreset) return text;
  const dong = text.split("\n");
  const ra: string[] = [];
  for (let i = 0; i < dong.length; i += 1) {
    const hienTai = dong[i] ?? "";
    ra.push(hienTai);
    const khop = /^(\s*)- id: ([A-Za-z0-9-]+)$/u.exec(hienTai);
    if (khop === null || !BAT_LAI_TRONG_PRESET.has(khop[2] ?? "")) continue;
    // Quét HẾT các dòng con của row này: nếu đã có `disabled:` thì giữ nguyên (thêm nữa thành khoá trùng ⇒ YAML hỏng).
    const thut = (khop[1] ?? "").length;
    let daCoDisabled = false;
    for (let j = i + 1; j < dong.length; j += 1) {
      const dongCon = dong[j] ?? "";
      if (dongCon.trim() === "") continue;
      const thutCon = dongCon.length - dongCon.trimStart().length;
      if (thutCon <= thut) break;
      if (/^\s*disabled:/u.test(dongCon)) { daCoDisabled = true; break; }
    }
    if (daCoDisabled) continue;
    ra.push((khop[1] ?? "") + "  disabled: false");
  }
  return ra.join("\n");
}

/** Ký tự xuống dòng — tách hằng để chuỗi trong mã không bị hiểu nhầm khi sinh. */
const NEWLINE = String.fromCharCode(10);

/** Persona stock của ba preset "coding agent" (in id model TRÊN DÂY, kể cả khi route là `auto`). */
const PERSONA_TEXT_STOCK = "You are a coding agent powered by the {{model}} model.";

/** Persona của ta: nhãn HIỂN THỊ của route (route `auto` ⇒ "Galaxy Blackhole", route khác ⇒ id model thật). */
const PERSONA_TEXT_OURS = "You are a coding agent powered by the {{model_label}} model.";

/**
 * Đổi persona của preset sang `{{model_label}}` — CHỈ tệp trong presets/ và CHỈ dòng còn nguyên văn bản stock.
 * Bản gốc viết hai hình: `prefix: You are …` (standard/ptc) và khối `prefix: >-` + dòng thụt lề (cordis), nên
 * phép đổi khớp CHUỖI VĂN BẢN persona chứ không khớp cả dòng.
 *
 * Vì sao (11/11/2026, lỗi người dùng): preset chạy SAU persona của deployment nên `prefix` của nó quyết định
 * câu mở đầu system prompt; `{{model}}` là id trên dây ⇒ chọn model "Auto" vẫn in "…deepseek-v4.1-flash model".
 * Preset tự đặt persona riêng (minimal) không khớp chuỗi stock nên giữ nguyên.
 *
 * CỔNG (c): mỗi tệp preset phải có ĐÚNG số dòng persona stock mà bản gốc có, và sau khi đổi KHÔNG được còn
 * `{{model}}` trong tệp (đổi thiếu = đúng lỗi cũ quay lại; đổi thừa = sửa vào persona của preset khác).
 * @param text — nội dung patch đã sinh; laPreset — chỉ áp cho tệp trong thư mục presets/.
 * @returns nội dung sau khi đổi (hoặc nguyên bản khi không thuộc diện).
 */
function doiPersonaPreset(text: string, laPreset: boolean): string {
  if (!laPreset) return text;
  const ra = text.split(NEWLINE).map((line) => (line.includes(PERSONA_TEXT_STOCK) ? line.replace(PERSONA_TEXT_STOCK, PERSONA_TEXT_OURS) : line));
  const conLai = ra.filter((line) => line.includes("{{model}}")).length;
  if (conLai !== 0) throw new Error("CỔNG PERSONA ĐỎ — còn " + String(conLai) + " dòng {{model}} trong preset sau khi đổi");
  return ra.join(NEWLINE);
}

/**
 * Các row cần BẬT ngay ở mặt phẳng ứng dụng (web-app.patch.yml) để tầng client thấy service:
 * `plan-mode` (menu “+ → Kế hoạch”) và `command-compact` (menu “/ → Nén”). Bản gốc tắt hai row này ở
 * mặt phẳng web rồi mount trong preset, nhưng client đọc service ở mặt phẳng web nên không thấy.
 */
// 22/10/2026: BỎ thử nghiệm bật ở mặt phẳng web — host báo "entry did not activate" (hai row này cần
// ngữ cảnh preset). Giữ RỖNG để không đổi hành vi; muốn thử lại thì thêm id vào đây.
const BAT_LAI_O_WEB = new Set<string>(["compaction-basic", "command-compact", "plan-mode"]);

/**
 * Đổi `disabled: true` thành `disabled: false` cho các row trong BAT_LAI_O_WEB (giữ nguyên số dòng).
 * Nhận: text — nội dung patch web-app; laWebApp — chỉ áp cho web-app.patch.yml.
 * Trả: nội dung sau khi đổi.
 */
function batLaiOMatPhangWeb(text: string, laWebApp: boolean): string {
  if (!laWebApp) return text;
  const dong = text.split("\n");
  let rowHienTai = "";
  for (let i = 0; i < dong.length; i += 1) {
    const idRow = /^\s*- id: (\S+)$/u.exec(dong[i] ?? "");
    if (idRow !== null) rowHienTai = idRow[1] ?? "";
    if (rowHienTai === "" || !BAT_LAI_O_WEB.has(rowHienTai)) continue;
    if (/^(\s*)disabled:\s*true\s*$/u.test(dong[i] ?? "")) {
      dong[i] = (dong[i] ?? "").replace("disabled: true", "disabled: false");
    }
  }
  return dong.join("\n");
}
/**
 * Chèn khối `config:` của CONFIG_ROW_LOP_BUNDLE ngay SAU dòng `name:` của đúng row đó.
 *
 * Chỉ chèn khi row CHƯA có `config:` (hai khoá `config:` trong một row = YAML hỏng hoặc luật sau thắng im lặng).
 * Nhận: text — nội dung patch đã sinh (sau khi đổi tên / bật lại row); idRowCoMat — id của các row THẬT SỰ có mặt
 * trong tệp này (để cổng đếm ở ngoài).
 * Trả: nội dung sau khi chèn (nguyên bản khi tệp không có row nào thuộc bảng).
 */
function chenConfigRowLopBundle(text: string, idRowCoMat: Set<string>): string {
  const dong = text.split(NEWLINE);
  const ra: string[] = [];
  let rowHienTai = "";
  for (let i = 0; i < dong.length; i += 1) {
    const hienTai = dong[i] ?? "";
    ra.push(hienTai);
    const idRow = /^\s*- id: (\S+)$/u.exec(hienTai);
    if (idRow !== null) {
      rowHienTai = idRow[1] ?? "";
      idRowCoMat.add(rowHienTai);
      continue;
    }
    const khoi = CONFIG_ROW_LOP_BUNDLE.get(rowHienTai);
    if (khoi === undefined) continue;
    const dongName = /^(\s*)name:\s/u.exec(hienTai);
    if (dongName === null) continue;
    rowHienTai = "";
    const thut = (dongName[1] ?? "").length;
    let daCoConfig = false;
    for (let j = i + 1; j < dong.length; j += 1) {
      const con = dong[j] ?? "";
      if (con.trim() === "") continue;
      if (con.length - con.trimStart().length <= thut) break;
      if (/^\s*config:/u.test(con)) {
        daCoConfig = true;
        break;
      }
    }
    if (daCoConfig) continue;
    for (const dongKhoi of khoi) ra.push(" ".repeat(thut) + dongKhoi);
  }
  return ra.join(NEWLINE);
}

/** Một dòng `name:` (kèm thụt lề + đuôi tuỳ ý như comment). */
const NAME_LINE = /^(\s*)name: '([^']+)'(.*)$/u;

/** Kết quả sinh cho một tệp. */
export interface PatchReport {
  /** Tên bundle stock. */ readonly bundle: string;
  /** Đường dẫn tương đối trong gói ta. */ readonly relative: string;
  /** Số dòng của bản gốc. */ readonly lines: number;
  /** Số dòng bị đổi `name:`. */ readonly changed: number;
  /** Số row (`- id:`) trong tệp. */ readonly rows: number;
}

/**
 * Sinh toàn bộ 17 tệp patch + package.json + lib/index.js; chạy cổng hai chiều trong lúc sinh.
 * Nhận: không. Trả: báo cáo từng tệp.
 */
export function generate(): PatchReport[] {
  // Dọn sạch đầu ra cũ (tránh tệp thừa của lần sinh trước).
  rmSync(BUNDLE, { recursive: true, force: true });
  const provenance = readProvenance();
  /** Tên chuẩn hoá: bỏ scope + tiền tố dsh-/gbh- (dùng so cặp client half ↔ host half). */
  const chuanHoa = (ten: string): string => ten.replace(/^@[^/]+\//u, "").replace(/^(?:dsh|gbh)-/u, "").replace(/^host-/u, "");
  /** Thư mục thật của từng gói ta (để kiểm export subpath). */
  const thuMuc = new Map<string, string>();
  for (const tier of ["host", "client", "shared"]) {
    let ds: string[] = [];
    try {
      ds = readdirSync(join(REPO, "packages", tier));
    } catch {
      continue;
    }
    for (const ten of ds) {
      try {
        const m = JSON.parse(readFileSync(join(REPO, "packages", tier, ten, "package.json"), "utf8")) as { name?: string };
        if (typeof m.name === "string") thuMuc.set(m.name, join(REPO, "packages", tier, ten));
      } catch {
        continue;
      }
    }
  }
  /**
   * Chọn gói của ta cho một specifier stock (có thể kèm subpath như .../tools).
   * Nhận: stock — specifier trong bundle. Trả: specifier của ta, hoặc undefined (giữ nguyên tên stock).
   */
  const giuSubpath = (goi: string, subpath: string): string | undefined => {
    const dir = thuMuc.get(goi);
    if (dir === undefined) return undefined;
    try {
      const m = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { exports?: Record<string, unknown> };
      return Object.hasOwn(m.exports ?? {}, "./" + subpath) ? goi + "/" + subpath : undefined;
    } catch {
      return undefined;
    }
  };
  const chonGoi = (stock: string, rowId: string): string | undefined => {
    const phan = stock.split("/");
    const goiStock = stock.startsWith("@") ? phan.slice(0, 2).join("/") : (phan[0] ?? stock);
    const subpath = phan.slice(stock.startsWith("@") ? 2 : 1).join("/");
    // Ung vien: uu tien provenance; neu goi stock KHONG khai provenance (vd dsh-plugin-manager) thi tim theo
    // TEN CHUAN HOA tren toan bo goi cua ta (bo scope + dsh-/gbh- + infix host-) — nguon su that la ten goi.
    const theoProvenance = provenance.filter((entry) => entry.stock === goiStock).map((entry) => entry.ours);
    const ds =
      theoProvenance.length > 0
        ? theoProvenance
        : [...thuMuc.keys()].filter((ten) => chuanHoa(ten) === chuanHoa(goiStock));
    if (ds.length === 0) return undefined;
    const dungRow = ds.filter((ours) => rowIdToOurs.get(rowId) === ours);
    const dv = dungRow.length === 1 ? dungRow[0] : undefined;
    if (dv !== undefined) return subpath === "" ? dv : giuSubpath(dv, subpath);
    const khop = ds.filter((ours) => chuanHoa(ours) === chuanHoa(goiStock));
    const chon = khop.length === 1 ? khop[0] : ds.length === 1 ? ds[0] : undefined;
    if (chon === undefined) return undefined;
    if (subpath === "") return chon;
    return giuSubpath(chon, subpath);
  };
  const rowIdToOurs = readRowIdMap();
  /** Tên chuẩn hoá để so cặp stock↔ta: bỏ scope + tiền tố dsh-/gbh- + infix host-. */
  const reports: PatchReport[] = [];
  const patchList: string[] = [];
  const put = (relative: string, text: string): void => {
    const target = join(BUNDLE, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  };
  /**
   * Header 5 dòng kiểu '#' (luật repo cho .yml) — KHÔNG tính vào cổng số dòng THÂN patch.
   * @param desc — dòng `# desc` (có thể nhiều dòng).
   * @param ngay — ngày sửa cuối; tệp bị đổi hôm nay ghi 11/11/2026, tệp còn nguyên văn gốc giữ 21/10/2026.
   * @returns khối header kết thúc bằng một dòng trống.
   */
  const header = (desc: string, ngay = "21/10/2026"): string =>
    ["# author Bùi Trọng Hiếu", "# email kevinbui210191@gmail.com", "# create date 15/10/2026", "# modify date " + ngay, "# desc " + desc, "", ""].join("\n");
  for (const bundle of BUNDLES) {
    const dirName = bundle.replace("@deepseek-ai/", "");
    const short = dirName.replace(/^dsh-/u, "");
    const manifest = JSON.parse(readFileSync(join(KERNEL, dirName, "package.json"), "utf8")) as { dsh?: { bundle?: { patch?: unknown } } };
    const declared = manifest.dsh?.bundle?.patch;
    const files = (Array.isArray(declared) ? declared : typeof declared === "string" ? [declared] : []) as string[];
    if (files.length === 0) throw new Error("bundle khong khai dsh.bundle.patch: " + bundle);
    for (const file of files) {
      const source = readFileSync(join(KERNEL, dirName, file.replace(/^\.\//u, "")), "utf8");
      const lines = source.split("\n");
      let changed = 0;
      /** Row id cua dong `- id:` gan nhat phia tren — de doi chieu voi gbh.row.id khi provenance khong khai. */
      let rowIdGanNhat = "";
      const out = lines.map((line, index) => {
        const rowId = /^\s*- id: (\S+)$/u.exec(line);
        if (rowId !== null) rowIdGanNhat = rowId[1] ?? "";
        const match = NAME_LINE.exec(line);
        if (match === null) return line;
        const stock = match[2] ?? "";
        // Row có GÓI RIÊNG (bảng GOI_RIENG_CUA_ROW) thắng mọi suy đoán khác: dùng subpath của gói khác thì
        // `bundleDefinedNames()` không khớp và overlay lại sinh khối disable+insert (xem đầu bảng).
        const ours = GOI_RIENG_CUA_ROW.get(rowIdGanNhat) ?? chonGoi(stock, rowIdGanNhat) ?? rowIdToOurs.get(rowIdGanNhat);
        if (ours === undefined || ours === stock) return line;
        // CỔNG (b): dòng đổi PHẢI khớp đúng khuôn name: '<gói ta>' — sai là throw ngay.
        const next = (match[1] ?? "") + "name: '" + ours + "'" + (match[3] ?? "");
        if (!new RegExp("^\\s*name: '" + ours.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") + "'", "u").test(next)) {
          throw new Error("CỔNG HAI CHIỀU ĐỎ — dòng " + String(index + 1) + " của " + dirName + "/" + file + " đổi sai khuôn: " + next);
        }
        changed += 1;
        return next;
      });
      // CỔNG (a): số dòng sinh ra PHẢI bằng số dòng gốc.
      if (out.length !== lines.length) throw new Error("CỔNG SỐ DÒNG ĐỎ — " + dirName + "/" + file);
      // Đường dẫn riêng cho TỪNG tệp (base ≠ web-app cordis): tránh ghi đè.
      const normalized =
        short === "base"
          ? "cordis.patch.yml"
          : short === "web-app"
            ? file.startsWith("./presets/")
              ? join("presets", file.replace("./presets/", ""))
              : "web-app.patch.yml"
            : join("experimental", short + ".patch.yml");
      // CỔNG (a) áp lên THÂN: số dòng thân sinh ra === số dòng gốc.
      if (out.length !== lines.length) throw new Error("CỔNG SỐ DÒNG ĐỎ — " + dirName + "/" + file);
      const laPreset = short === "web-app" && file.startsWith("./presets/");
      const laWebApp = short === "web-app" && !file.startsWith("./presets/");
      // Row nào của bảng CONFIG_ROW_LOP_BUNDLE có mặt trong ĐÚNG tệp này (cổng đếm ở dưới).
      const idCoMat = new Set<string>();
      // Thân patch = dòng gốc (đã đổi tên) → bật lại row preset → đổi persona. Header 5 dòng của TA đứng TRƯỚC
      // thân, và chỉ thêm dòng ghi chú persona khi tệp THẬT SỰ có persona của ta (minimal thì không).
      const body = doiPersonaPreset(batLaiTrongPreset(out.join("\n"), laPreset), laPreset);
      // Phép THỨ BA: config của row ta, chèn ngay tại row ở lớp bundle (xem CONFIG_ROW_LOP_BUNDLE).
      const thanCoConfig = chenConfigRowLopBundle(batLaiOMatPhangWeb(body, laWebApp), idCoMat);
      const idConfig = [...idCoMat].filter((id) => CONFIG_ROW_LOP_BUNDLE.has(id)).sort();
      const desc = "PATCH SINH TU DONG tu " + bundle + "/" + file + " (task-191) — chi doi dong name theo provenance."
        + (body.includes(PERSONA_TEXT_OURS) ? "\n# 11/11/2026: persona dung {{model_label}} (auto ⇒ 'Galaxy Blackhole', khac ⇒ ten model that)." : "")
        + (idConfig.length === 0 ? "" : "\n# 11/11/2026: row " + idConfig.join(", ") + " mang config NGAY O LOP BUNDLE (bang CONFIG_ROW_LOP_BUNDLE) — cong tac Settings ghi duoc.");
      put(normalized, header(desc, body.includes(PERSONA_TEXT_OURS) || idConfig.length > 0 ? "11/11/2026" : "21/10/2026") + thanCoConfig);
      patchList.push("./" + normalized);
      const rows = out.filter((line) => /^\s*- id:/u.test(line)).length;
      reports.push({ bundle, relative: normalized, lines: out.length, changed, rows });
    }
  }
  // CỔNG (d): mỗi row của CONFIG_ROW_LOP_BUNDLE phải có ĐÚNG MỘT row trong 17 tệp vừa sinh — bảng trỏ vào row
  // không tồn tại (hoặc bị chép sang tệp khác) là bảng mục nát: config sẽ NẰM IM ở đây mà không ai đọc.
  for (const rowId of CONFIG_ROW_LOP_BUNDLE.keys()) {
    const dem = reports.filter((report) => report.rows > 0 && readFileSync(join(BUNDLE, report.relative), "utf8").split(NEWLINE).some((line) => line.trim() === "- id: " + rowId)).length;
    if (dem !== 1) throw new Error("CỔNG CONFIG ROW ĐỎ — row '" + rowId + "' có mặt ở " + String(dem) + " tệp (phải đúng 1)");
  }
  const packageJson = {
    name: "@galaxy-blackhole/gbh-bundle",
    version: "0.1.0",
    private: true,
    type: "module",
    main: "lib/index.js",
    exports: {
      ".": "./lib/index.js",
      "./cordis.patch.yml": "./cordis.patch.yml",
      "./web-app.patch.yml": "./web-app.patch.yml",
      "./presets/*": "./presets/*",
      "./experimental/*": "./experimental/",
      "./package.json": "./package.json",
    },
    dsh: { bundle: { patch: patchList } },
    gbh: {
      draft: "BUNDLE-NATIVE (task-191): 17 tệp patch của 13 bundle stock, chỉ đổi name theo provenance — KHÔNG có code, không phải row.",
      tests: [],
    },
  };
  put("package.json", JSON.stringify(packageJson, null, 2) + "\n");
  put(
    "lib/index.js",
    ["/**", " * author Bùi Trọng Hiếu", " * email kevinbui210191@gmail.com", " * create date 15/10/2026", " * modify date 21/10/2026", " * desc Bundle patch của ta — KHÔNG có code (giống dsh-base/lib/index.js: \"export {};\").", " */", "", "export {};", ""].join("\n"),
  );
  return reports;
}

if (import.meta.main) {
  const reports = generate();
  const files = reports.length;
  const rows = reports.reduce((sum, report) => sum + report.rows, 0);
  const changed = reports.reduce((sum, report) => sum + report.changed, 0);
  for (const report of reports) console.log(report.bundle + " → " + report.relative + " · " + String(report.lines) + " dòng · đổi " + String(report.changed) + " name · " + String(report.rows) + " row");
  console.log("TỔNG " + String(files) + " tệp · " + String(rows) + " row · " + String(changed) + " dòng name đổi");
}
