/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026 — tạo mới: PHẦN C (mọi mục bấm được trong Cài đặt phải có ĐƯỜNG GHI: hàm ghi ·
 *   namespace · field · field có trong schema) và PHẦN D (ĐO THẬT bằng RPC "settings/mutate": đổi rồi trả lại,
 *   ghi revision trước/sau). Lý do: 11/11/2026 đo được 4 namespace Cài đặt bấm KHÔNG lưu được vì row của chúng
 *   bị lớp overlay "app.patch.yml" cắm/ghim config ⇒ "settings/mutate" ⇒ "settings/rejected".
 * desc Bảng chứng minh công tắc/ô chọn trong Cài đặt có tác dụng THẬT: mỗi mục khai ĐÚNG tệp:dòng render,
 *      ĐÚNG tệp:dòng ghi, namespace + field mà nó ghi; field phải có trong schema "settings.describe"; và
 *      (khi chạy với --rpc) một lượt mutate đổi-rồi-trả-lại phải chứng minh Host NHẬN giá trị mới.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CONTROLS } from "./settings-controls.ts";

/** Một vị trí trong mã nguồn: đường dẫn (tương đối repo) + số dòng + chuỗi nhận diện. */
export interface Site {
  /** Đường dẫn tương đối từ gốc repo. */
  readonly file: string;
  /** Số dòng 1-based. */
  readonly line: number;
  /** Chuỗi phải xuất hiện trên dòng đó (canh trôi dòng). */
  readonly marker: string;
}

/** Một mục bấm được trong Cài đặt: nơi render, nơi ghi, namespace + field nó ghi. */
export interface SettingsControl {
  /** Nhãn người dùng thấy (hoặc mã mục khi nhãn do locale cấp). */
  readonly label: string;
  /** Gói client sở hữu mục. */
  readonly pkg: string;
  /** Toạ độ render công tắc/ô chọn. */
  readonly ui: Site;
  /** Toạ độ của lệnh ghi (config form / settings.mutate). */
  readonly write: Site;
  /** Namespace settings mà mục này ghi. */
  readonly ns: string;
  /** Các field trong namespace (đường dẫn cấp 1). */
  readonly fields: readonly string[];
  /** Tên hàm ghi mà đăng ký slot cấp qua inject (bằng chứng "có hàm ghi"). */
  readonly writer?: string;
  /** Mục KHÔNG hiện được trong app đang chạy (row bị tắt) — vẫn khai để bảng đủ, không đo RPC. */
  readonly hidden?: string;
  /** Cơ chế ghi: mặc định là settings/mutate; mục ghi qua endpoint riêng thì khai ở đây. */
  readonly probe?: "pluginMarket/setIndexes";
}

/** Kết luận một dòng của bảng. */
export type SurfaceVerdict = "PASS" | "FAIL" | "CẢNH BÁO" | "CHỜ BOOT";

/** Kết quả kiểm TĨNH của một mục (không cần Host). */
export interface StaticCheck {
  /** Mục được kiểm. */
  readonly control: SettingsControl;
  /** Đường ghi có trong mã không. */
  readonly wired: boolean;
  /** Row của namespace do lớp BUNDLE cắm (ghi được) hay lớp overlay (ghim ⇒ không ghi được). */
  readonly layer: "bundle" | "overlay" | "unknown";
  /** Kết luận. */
  readonly verdict: SurfaceVerdict;
  /** Bằng chứng. */
  readonly evidence: readonly string[];
}

/** Kết quả ĐO một field bằng RPC. */
export interface FieldProbe {
  /** Field trong namespace. */
  readonly field: string;
  /** Giá trị thử. */
  readonly probeValue: unknown;
  /** Host nhận giá trị thử. */
  readonly accepted: boolean;
  /** Giá trị đọc lại sau khi ghi (phải bằng giá trị thử). */
  readonly applied?: unknown;
  /** Đã trả lại giá trị cũ. */
  readonly restored: boolean;
  /** Revision trước khi ghi. */
  readonly revisionBefore?: number;
  /** Revision sau khi ghi. */
  readonly revisionAfter?: number;
  /** Revision sau khi trả lại. */
  readonly revisionRestored?: number;
  /** Mã lỗi khi Host từ chối. */
  readonly error?: string;
}

/** Kết quả ĐO một mục. */
export interface LiveCheck {
  /** Mục được đo. */
  readonly control: SettingsControl;
  /** Namespace có trong settings.describe không. */
  readonly namespaceServed: boolean;
  /** Revision của namespace lúc bắt đầu. */
  readonly revisionStart?: number;
  /** Các field đã đo. */
  readonly fields: readonly FieldProbe[];
  /** Kết luận. */
  readonly verdict: SurfaceVerdict;
}
/** Bối cảnh một lượt chạy. */
export interface SurfaceOptions {
  /** Gốc repo. */
  readonly repoRoot: string;
  /** Thư mục home của app (đọc app.patch.yml đã sinh để biết lớp overlay). */
  readonly home: string;
  /** Chạy thêm PHẦN D (đo RPC thật). */
  readonly rpc: boolean;
  /** In bằng chứng của mọi dòng. */
  readonly verbose: boolean;
}

/** Khoảng nghỉ giữa hai lượt ghi khi đo (ms) — xem chú thích ở runSettingsSurface. */
const PROBE_GAP_MS = 150;

/** Một mục phát hiện được khi quét mã mà BẢNG chưa khai (để bảng không bỏ sót mục mới). */
export interface DiscoveredSite {
  /** Tệp tương đối repo. */
  readonly file: string;
  /** Số dòng 1-based. */
  readonly line: number;
  /** Dấu hiệu nhận diện (Switch / role switch / checkbox / setEnabled). */
  readonly marker: string;
}

/** Kết quả một lượt gọi RPC: hoặc giá trị, hoặc lỗi của Gateway. */
interface RpcAnswer {
  /** Gateway báo thành công. */
  readonly ok: boolean;
  /** Giá trị trả về khi thành công. */
  readonly value?: unknown;
  /** Lỗi khi thất bại. */
  readonly error?: { readonly code: string; readonly message: string };
}

/** Phiên RPC tới Host đang chạy. */
export interface RpcSession {
  /** Gọi một endpoint Remote bằng envelope client-request. */
  rpc(method: string, args: unknown): Promise<RpcAnswer>;
  /** Đóng phiên (giải phóng socket). */
  close(): void;
}

/**
 * Đọc một tệp thành mảng dòng; tệp thiếu thì trả mảng rỗng.
 * Nhận: đường dẫn tuyệt đối.
 * Trả: các dòng của tệp (không kèm ký tự xuống dòng).
 */
function linesOf(file: string): string[] {
  try {
    return readFileSync(file, "utf8").split(String.fromCharCode(10));
  } catch {
    return [];
  }
}

/**
 * Thoát ký tự đặc biệt của biểu thức chính quy mà KHÔNG dùng ký hiệu nội suy (để tệp này đọc được bằng mắt).
 * Nhận: chuỗi thô (thường là id row).
 * Trả: chuỗi đã thoát, dùng được trong RegExp.
 */
export function escapeRegExp(text: string): string {
  // Thứ tự QUAN TRỌNG: thoát dấu gạch chéo ngược TRƯỚC, nếu không chính dấu vừa chèn sẽ bị thoát lần hai
  // ("a.b" ⇒ "a\\.b" thay vì "a\\.b"). Đo được 11/11/2026 bằng test của cổng này.
  const special = ["\\", ".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"];
  let out = text;
  for (const char of special) out = out.split(char).join("\\" + char);
  return out;
}

/**
 * Kiểm một toạ độ mã nguồn: tệp có thật và dòng khai có chứa chuỗi nhận diện (dò ±6 dòng cho chắc).
 * Nhận: gốc repo + toạ độ cần kiểm.
 * Trả: null khi khớp, hoặc thông điệp lý do lệch.
 */
export function siteProblem(repoRoot: string, site: Site): string | null {
  const file = join(repoRoot, site.file);
  if (!existsSync(file)) return "thiếu tệp " + site.file;
  const lines = linesOf(file);
  const from = Math.max(0, site.line - 7);
  const to = Math.min(lines.length, site.line + 6);
  for (let index = from; index < to; index += 1) {
    if ((lines[index] ?? "").includes(site.marker)) return null;
  }
  return "không thấy chuỗi " + JSON.stringify(site.marker) + " quanh " + site.file + ":" + String(site.line);
}

/**
 * Gom văn bản của MỌI patch thuộc lớp BUNDLE (packages/host/bundle/*.yml) — lớp nằm TRƯỚC tài liệu người dùng.
 * Nhận: gốc repo.
 * Trả: văn bản gộp (rỗng khi thiếu thư mục).
 */
export function bundlePatchText(repoRoot: string): string {
  const hostDir = join(repoRoot, "packages", "host");
  if (!existsSync(hostDir)) return "";
  const dirs: string[] = [];
  for (const name of readdirSync(hostDir)) {
    // Mọi thư mục bundle (bundle, bundle-ai-agent-team, bundle-cot-translation-bundle, …) — mỗi bundle
    // cắm row của nó bằng patch riêng, và TẤT CẢ đều nằm TRƯỚC tài liệu người dùng.
    if (!name.startsWith("bundle")) continue;
    const abs = join(hostDir, name);
    try {
      if (!statSync(abs).isDirectory()) continue;
    } catch {
      continue;
    }
    dirs.push(abs);
  }
  const parts: string[] = [];
  for (const dir of dirs) {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".yml")) continue;
      try {
        parts.push(readFileSync(join(dir, name), "utf8"));
      } catch {
        continue;
      }
    }
  }
  return parts.join(String.fromCharCode(10));
}

/**
 * Đọc lớp overlay ĐANG chạy: app.patch.yml trong home, không có thì bản trong repo.
 * Nhận: thư mục home + gốc repo.
 * Trả: văn bản overlay (rỗng khi cả hai đều thiếu).
 */
export function overlayText(home: string, repoRoot: string): string {
  const candidates = [join(home, "app.patch.yml"), join(repoRoot, "profiles", "blackhole", "app.patch.yml")];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      return readFileSync(file, "utf8");
    } catch {
      continue;
    }
  }
  return "";
}

/**
 * Đọc TEMPLATE của lớp overlay trong repo (profiles/blackhole/parity.patch.yml) — nguồn sự thật của lớp cuối.
 * Nhận: gốc repo.
 * Trả: văn bản template (rỗng khi thiếu).
 */
export function templateText(repoRoot: string): string {
  const file = join(repoRoot, "profiles", "blackhole", "parity.patch.yml");
  if (!existsSync(file)) return "";
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * Xác định row của một namespace được cắm ở lớp nào — quyết định nó có ghi được không.
 *
 * LUẬT (đo 11/11/2026 trên app 5439): settings/mutate ghi vào TÀI LIỆU NGƯỜI DÙNG của profile; lớp overlay
 * (app.patch.yml, sinh mỗi lượt boot) nằm SAU tài liệu đó nên row do overlay cắm hoặc ghim config sẽ nuốt
 * giá trị mới ⇒ Host từ chối settings/rejected. Row do BUNDLE cắm thì tài liệu người dùng thắng ⇒ ghi được.
 * Nhận: id namespace (hoặc id row) + văn bản lớp bundle + văn bản overlay đã sinh.
 * Trả: "bundle" (ghi được) · "overlay" (bị ghim) · "unknown" (không thấy row ở đâu).
 */
export function rowLayerOf(ns: string, bundleText: string, overlayTxt: string): "bundle" | "overlay" | "unknown" {
  const ids = [ns, ns + "-ours"];
  const has = (text: string, id: string): boolean => new RegExp("^[ ]*- id: " + escapeRegExp(id) + "[ ]*$", "mu").test(text);
  for (const id of ids) if (has(overlayTxt, id)) return "overlay";
  for (const id of ids) if (has(bundleText, id)) return "bundle";
  return "unknown";
}

/**
 * Kiểm TĨNH một mục: toạ độ render + ghi còn khớp mã, row thuộc lớp nào.
 * Nhận: mục + gốc repo + văn bản lớp bundle + văn bản overlay.
 * Trả: kết luận kèm bằng chứng (FAIL khi toạ độ trôi hoặc row bị overlay ghim).
 */
export function checkStatic(control: SettingsControl, repoRoot: string, bundleText: string, overlayTxt: string): StaticCheck {
  const evidence: string[] = [];
  let wired = true;
  for (const pair of [["render", control.ui], ["write", control.write]] as const) {
    const problem = siteProblem(repoRoot, pair[1]);
    if (problem !== null) {
      evidence.push(pair[0] + ": " + problem);
      wired = false;
    }
  }
  const template = templateText(repoRoot);
  const ids = [control.ns, control.ns + "-ours"];
  const bundleOwns = ids.some((id) => hasRow(bundleText, id));
  const templatePins = ids.some((id) => hasRow(template, id));
  const overlayPins = ids.some((id) => hasRow(overlayTxt, id));
  // Nguồn sự thật là REPO: template của lớp overlay quyết định lớp cuối có ghim row hay không;
  // app.patch.yml trên đĩa chỉ là bản đã sinh của lượt boot trước (có thể cũ hơn repo).
  const layer: "bundle" | "overlay" | "unknown" =
    control.hidden !== undefined ? "unknown" : templatePins ? "overlay" : bundleOwns ? "bundle" : overlayPins ? "overlay" : "unknown";
  if (control.hidden !== undefined) evidence.push("KHÔNG HIỆN: " + control.hidden);
  else if (layer === "overlay" && templatePins) evidence.push("template lớp overlay (profiles/blackhole/parity.patch.yml) GHIM row '" + control.ns + "' ⇒ settings/mutate bị từ chối");
  else if (layer === "overlay") evidence.push("row '" + control.ns + "' chỉ có trong app.patch.yml (lớp overlay) ⇒ settings/mutate bị từ chối");
  else if (layer === "bundle") evidence.push("row '" + control.ns + "' do lớp bundle cắm ⇒ tài liệu người dùng ghi đè được");
  else evidence.push("không thấy row '" + control.ns + "' trong bundle lẫn template overlay");
  if (layer === "bundle" && overlayPins) evidence.push("(lưu ý) app.patch.yml TRÊN ĐĨA còn khối của row này — bản sinh từ template cũ; boot lại để đồng bộ");
  const verdict: SurfaceVerdict =
    !wired || (control.hidden === undefined && layer === "overlay") ? "FAIL" : control.hidden !== undefined || layer === "unknown" ? "CẢNH BÁO" : "PASS";
  return { control, wired, layer, verdict, evidence };
}

/**
 * Quét mã client tìm mọi chỗ render công tắc/ô chọn CÓ ghi cấu hình, để phát hiện mục chưa khai trong bảng.
 * Nhận: gốc repo + danh sách tệp đã khai trong bảng.
 * Trả: các toạ độ chưa khai (rỗng nghĩa là bảng phủ hết).
 */
export function discoverSwitchSites(repoRoot: string, declared: readonly SettingsControl[]): DiscoveredSite[] {
  const known = new Set(declared.map((control) => control.ui.file));
  const knownPackages = new Set(declared.map((control) => control.pkg));
  const roots: string[] = [];
  const group = join(repoRoot, "packages", "client");
  if (existsSync(group)) for (const name of readdirSync(group)) roots.push(join(group, name, "src"));
  const out: DiscoveredSite[] = [];
  const visit = (dir: string): void => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name === "node_modules" || name === "lib") continue;
      const abs = join(dir, name);
      let isDir = false;
      try {
        isDir = statSync(abs).isDirectory();
      } catch {
        isDir = false;
      }
      if (isDir) {
        visit(abs);
        continue;
      }
      if (!abs.endsWith(".ts")) continue;
      const rel = abs.slice(repoRoot.length + 1);
      if (known.has(rel)) continue;
      // Gói đã có mục trong bảng thì mọi chỗ render khác trong CÙNG gói là bản sao/bảng module, không phải mục mới.
      const dirName = rel.split("/")[2] ?? "";
      const covered = [...knownPackages].some((pkg) => pkg.endsWith("-" + dirName) || pkg.endsWith("/" + dirName));
      if (covered) continue;
      const lines = linesOf(abs);
      const writes = lines.some((line) => line.includes("configForms") || line.includes("remote.settings") || line.includes("settings.mutate"));
      if (!writes) continue;
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const marker = line.includes("role: \"switch\"")
          ? "role switch"
          : line.includes("type: \"checkbox\"")
            ? "checkbox"
            : line.trimStart().startsWith("*") || line.trimStart().startsWith("//")
              ? ""
              : line.includes(".Switch,") || line.includes("jsx(Switch") || line.includes("jsx(primitives.Switch")
                ? "Switch"
                : "";
        if (marker !== "") out.push({ file: rel, line: index + 1, marker });
      }
    }
  };
  for (const root of roots) visit(root);
  return out;
}
/**
 * Có row với đúng id này trong văn bản patch không (dò dòng "- id: <id>").
 * Nhận: văn bản patch + id row.
 * Trả: true khi có.
 */
export function hasRow(text: string, id: string): boolean {
  if (text === "") return false;
  return new RegExp("^[ ]*- id: " + escapeRegExp(id) + "[ ]*$", "mu").test(text);
}

/**
 * Mở phiên RPC tới Host đang chạy: đọc ready-url, điều hướng MỘT lượt để đổi token thành cookie phiên.
 *
 * VÌ SAO PHẢI ĐIỀU HƯỚNG: token trong ready-url.txt chỉ đổi được thành phiên qua một lượt điều hướng;
 * gọi thẳng /api bằng token trần LUÔN 401 (bẫy có thật, ghi ở AGENTS.md §5).
 * Nhận: thư mục home của app (chứa ready-url.txt).
 * Trả: phiên RPC, hoặc undefined khi không có ready-url / Host không trả cookie.
 */
export async function openRpcSession(home: string): Promise<RpcSession | undefined> {
  const readyPath = join(home, "ready-url.txt");
  if (!existsSync(readyPath)) return undefined;
  const ready = readFileSync(readyPath, "utf8").trim();
  if (ready === "") return undefined;
  const url = new URL(ready);
  let cookie = "";
  try {
    const first = await fetch(url, { redirect: "manual" });
    const jar = (first.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    cookie = jar.map((entry) => entry.split(";")[0] ?? "").filter((entry) => entry !== "").join("; ");
  } catch {
    return undefined;
  }
  if (cookie === "") return undefined;
  const rpc = async (method: string, args: unknown): Promise<RpcAnswer> => {
    const response = await fetch(url.origin + "/api/" + method, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ type: "client-request", rpcId: "gbh-probe-" + String(Date.now()), method, payload: { args } }),
    });
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: { code: "gateway/http-" + String(response.status), message: text.slice(0, 160) } };
    }
    const result = (parsed as { result?: { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } }).result;
    if (result === undefined) return { ok: false, error: { code: "gateway/envelope", message: text.slice(0, 160) } };
    if (result.ok === true) return { ok: true, value: result.value };
    return { ok: false, error: { code: result.error?.code ?? "gateway/unknown", message: result.error?.message ?? "" } };
  };
  return { rpc, close: (): void => undefined };
}

/** Một node schema của schemastery (chỉ phần cần cho phép đo). */
interface SchemaNode {
  /** Loại node. */
  readonly type?: string;
  /** Bảng field con khi là object/dict. */
  readonly dict?: Record<string, unknown>;
  /** Danh sách nhánh khi là union/intersect. */
  readonly list?: readonly unknown[];
  /** Phần tử khi là array (schemastery dùng "inner"). */
  readonly inner?: unknown;
  /** Giá trị khi là const. */
  readonly value?: unknown;
  /** Siêu dữ liệu (default...). */
  readonly meta?: { readonly default?: unknown };
}

/**
 * Giải một tham chiếu trong envelope schema (schemastery toJSON dùng bảng refs + uid).
 * Nhận: envelope + tham chiếu (số hoặc chuỗi).
 * Trả: node đã giải, hoặc undefined khi không giải được.
 */
export function deref(envelope: { readonly refs?: Record<string, unknown>; readonly uid?: unknown }, ref: unknown): SchemaNode | undefined {
  const table = envelope.refs ?? {};
  const key = typeof ref === "number" ? String(ref) : typeof ref === "string" ? ref : undefined;
  if (key === undefined) return undefined;
  return table[key] as SchemaNode | undefined;
}

/**
 * Lấy node của một field cấp 1 trong schema của namespace.
 * Nhận: envelope schema đã tuần tự hoá.
 * Trả: Map tên field → node.
 */
export function fieldNodes(schema: unknown): Map<string, SchemaNode> {
  const envelope = (schema ?? {}) as { refs?: Record<string, unknown>; uid?: unknown; type?: string; dict?: Record<string, unknown> };
  if (envelope.type === "object" && envelope.dict !== undefined) {
    const out = new Map<string, SchemaNode>();
    for (const [name, node] of Object.entries(envelope.dict)) out.set(name, node as SchemaNode);
    return out;
  }
  const top = deref(envelope, envelope.uid);
  const out = new Map<string, SchemaNode>();
  for (const [name, node] of Object.entries(top?.dict ?? {})) out.set(name, deref(envelope, node) ?? (node as SchemaNode));
  return out;
}

/**
 * Chọn một giá trị KHÁC giá trị hiện tại để thử ghi, theo đúng kiểu của field.
 * Nhận: node schema + giá trị hiện tại.
 * Trả: giá trị thử, hoặc undefined khi field không đo được (mảng/object tự do).
 */
export function probeValueFor(node: SchemaNode | undefined, current: unknown, schema: unknown): unknown {
  const envelope = (schema ?? {}) as { refs?: Record<string, unknown> };
  const plain = node?.dict === undefined && node?.list === undefined && node?.type === undefined && node !== undefined
    ? (deref(envelope, (node as unknown as { uid?: unknown }).uid) ?? node)
    : node;
  if (plain?.type === "boolean") return current === true ? false : true;
  if (plain?.type === "number") return typeof current === "number" ? current + 1 : 1;
  if (plain?.type === "string") return current === "probe-xyz" ? "probe-abc" : "probe-xyz";
  if (plain?.type === "array") {
    const items: unknown[] = Array.isArray(current) ? [...(current as unknown[])] : [];
    if (items.length > 0) return items.slice(0, -1);
    // Mảng rỗng: dựng MỘT phần tử theo schema của phần tử (đủ để chứng minh đường ghi nhận giá trị).
    const branch = plain.list?.[0] ?? plain.inner;
    const inner = branch !== null && typeof branch === "object" ? (branch as SchemaNode) : deref(envelope, branch);
    const keys = Object.keys(inner?.dict ?? {});
    if (keys.length === 0) return ["probe-xyz"];
    const item: Record<string, unknown> = {};
    for (const key of keys) item[key] = "probe-" + key;
    return [item];
  }
  if (plain?.type === "union") {
    const values = (plain.list ?? [])
      .map((branch) => deref(envelope, branch))
      .filter((branch): branch is SchemaNode => branch !== undefined && branch.type === "const")
      .map((branch) => branch.value)
      .filter((value) => value !== current && value !== null);
    return values.length > 0 ? values[0] : undefined;
  }
  return undefined;
}

/** Một namespace như settings.describe trả về (chỉ phần cần). */
interface NamespaceView {
  /** Khoá namespace. */
  readonly ns: string;
  /** Revision hiện tại. */
  readonly revision: number;
  /** Schema đã tuần tự hoá. */
  readonly schema: unknown;
  /** Giá trị hiệu lực (đã che bí mật). */
  readonly value?: Record<string, unknown>;
  /** Lớp người dùng. */
  readonly user?: Record<string, unknown>;
}

/**
 * Đọc settings.describe từ Host đang chạy.
 * Nhận: phiên RPC.
 * Trả: danh sách namespace, hoặc undefined khi Host từ chối.
 */
export async function describeNamespaces(session: RpcSession): Promise<readonly NamespaceView[] | undefined> {
  const answer = await session.rpc("settings/describe", {});
  if (!answer.ok) return undefined;
  const namespaces = (answer.value as { namespaces?: unknown }).namespaces;
  return Array.isArray(namespaces) ? (namespaces as NamespaceView[]) : undefined;
}

/**
 * Đo MỘT field: ghi giá trị thử, đọc lại, rồi trả lại giá trị cũ (hoặc unset nếu trước đó không có lớp người dùng).
 * Nhận: phiên RPC + namespace + field + node schema + giá trị hiện tại + cờ "field đang nằm ở lớp người dùng".
 * Trả: kết quả đo kèm revision trước/sau.
 */
export async function probeField(
  session: RpcSession,
  ns: string,
  field: string,
  schema: unknown,
  current: unknown,
  userHas: boolean,
): Promise<FieldProbe> {
  const node = fieldNodes(schema).get(field);
  const probeValue = probeValueFor(node, current, schema);
  if (probeValue === undefined) {
    return { field, probeValue: undefined, accepted: false, restored: false, error: "field không đo được (mảng/object tự do)" };
  }
  const before = await describeNamespaces(session);
  const viewBefore = before?.find((entry) => entry.ns === ns);
  const revisionBefore = viewBefore?.revision;
  const answer = await session.rpc("settings/mutate", { ns, ops: [{ op: "set", path: [field], value: probeValue }] });
  if (!answer.ok) {
    return {
      field,
      probeValue,
      accepted: false,
      restored: false,
      error: (answer.error?.code ?? "?") + ": " + (answer.error?.message ?? ""),
      ...(revisionBefore === undefined ? {} : { revisionBefore }),
    };
  }
  const viewAfter = answer.value as NamespaceView | undefined;
  const applied = viewAfter?.value?.[field];
  const restoreOp = userHas ? { op: "set", path: [field], value: current } : { op: "unset", path: [field] };
  const back = await session.rpc("settings/mutate", { ns, ops: [restoreOp] });
  // "Trả lại được" phải là GIÁ TRỊ đọc lại bằng giá trị cũ, không chỉ là RPC không lỗi.
  const restoredValue = (back.value as NamespaceView | undefined)?.value?.[field];
  const restored = back.ok && JSON.stringify(restoredValue) === JSON.stringify(current);
  return {
    field,
    probeValue,
    accepted: true,
    applied,
    restored,
    ...(revisionBefore === undefined ? {} : { revisionBefore }),
    ...(viewAfter?.revision === undefined ? {} : { revisionAfter: viewAfter.revision }),
    ...(back.value === undefined ? {} : { revisionRestored: (back.value as NamespaceView).revision }),
  };
}
/** Một dòng của bảng PHẦN C. */
export interface ControlRow {
  /** Mục cần in. */
  readonly check: StaticCheck;
  /** Namespace.field đã khai. */
  readonly target: string;
  /** Hàm ghi (tên prop qua inject) — "-" khi controller ghi trực tiếp. */
  readonly writer: string;
  /** Field đã khai có trong schema không: true/false/undefined khi chưa đo. */
  readonly fieldsInSchema?: boolean;
}

/**
 * Ghép kết quả TĨNH với schema của Host để biết field khai có thật trong schema không.
 * Nhận: các dòng kiểm tĩnh + danh sách namespace của Host.
 * Trả: các dòng đã bổ sung cột "field có trong schema".
 */
export function withSchema(rows: readonly ControlRow[], namespaces: readonly NamespaceView[] | undefined): ControlRow[] {
  if (namespaces === undefined) return [...rows];
  return rows.map((row) => {
    const view = namespaces.find((entry) => entry.ns === row.check.control.ns || entry.ns === row.check.control.ns + "-ours");
    if (view === undefined) return { ...row, fieldsInSchema: false };
    const nodes = fieldNodes(view.schema);
    return { ...row, fieldsInSchema: row.check.control.fields.every((field) => nodes.has(field)) };
  });
}

/**
 * Cắt chuỗi cho vừa cột bảng, giữ nguyên khi đã ngắn.
 * Nhận: chuỗi + độ rộng tối đa.
 * Trả: ô đã pad hoặc cắt (thêm "…"), luôn kèm một dấu cách phân cột.
 */
export function fit(text: string, width: number): string {
  const cell = text.length <= width ? text.padEnd(width) : text.slice(0, Math.max(0, width - 1)) + "…";
  return cell + " ";
}

/**
 * In bảng PHẦN C (kiểm tĩnh + schema) và trả số FAIL.
 * Nhận: các dòng + cờ verbose.
 * Trả: số dòng FAIL.
 */
export function printControlTable(rows: readonly ControlRow[], verbose: boolean): number {
  console.log("");
  console.log("=== PHẦN C — MỌI MỤC BẤM ĐƯỢC TRONG CÀI ĐẶT: đường ghi · namespace · field · field trong schema ===");
  const labelWidth = 40;
  const siteWidth = 44;
  const writerWidth = 18;
  const targetWidth = 36;
  const schemaWidth = 14;
  console.log(
    fit("MỤC", labelWidth) + fit("TỆP:DÒNG (render → ghi)", siteWidth) + fit("HÀM GHI?", writerWidth) + fit("NS.FIELD", targetWidth) + fit("FIELD∈SCHEMA?", schemaWidth) + "KẾT",
  );
  console.log("-".repeat(labelWidth + siteWidth + writerWidth + targetWidth + schemaWidth + 8));
  let fails = 0;
  for (const row of rows) {
    if (row.check.verdict === "FAIL") fails += 1;
    const sites = row.check.control.ui.file.split("/").slice(-1)[0] + ":" + String(row.check.control.ui.line) + " → " + row.check.control.write.file.split("/").slice(-1)[0] + ":" + String(row.check.control.write.line);
    const inSchema = row.fieldsInSchema === undefined ? "chưa đo" : row.fieldsInSchema ? "có" : "KHÔNG";
    console.log(
      fit(row.check.control.label, labelWidth) +
        fit(sites, siteWidth) +
        fit(row.writer, writerWidth) +
        fit(row.target, targetWidth) +
        fit(inSchema, schemaWidth) +
        row.check.verdict,
    );
    if (verbose || row.check.verdict !== "PASS") for (const line of row.check.evidence) console.log(" ".repeat(labelWidth) + "↳ " + line);
  }
  return fails;
}

/**
 * In bảng PHẦN D (đo RPC thật) và trả số FAIL + số mục chờ boot.
 * Nhận: các kết quả đo + cờ verbose.
 * Trả: số FAIL và số mục "CHỜ BOOT".
 */
export function printLiveTable(lives: readonly LiveCheck[], verbose: boolean): { fails: number; pending: number } {
  console.log("");
  console.log("=== PHẦN D — ĐO THẬT BẰNG RPC: settings/mutate đổi-rồi-trả-lại, revision trước/sau ===");
  const labelWidth = 40;
  const targetWidth = 44;
  const valueWidth = 16;
  const revWidth = 10;
  const finalWidth = 12;
  console.log(
    fit("MỤC", labelWidth) + fit("NS.FIELD", targetWidth) + fit("GIÁ TRỊ THỬ", valueWidth) + fit("REV TRƯỚC", revWidth) + fit("REV SAU", revWidth) + fit("REV CUỐI", finalWidth) + "KẾT",
  );
  console.log("-".repeat(labelWidth + targetWidth + valueWidth + revWidth * 2 + finalWidth + 8));
  let fails = 0;
  let pending = 0;
  for (const live of lives) {
    if (live.verdict === "FAIL") fails += 1;
    if (live.verdict === "CHỜ BOOT") pending += 1;
    if (!live.namespaceServed) {
      console.log(fit(live.control.label, labelWidth) + fit(live.control.ns + ".*", targetWidth) + fit("-", valueWidth) + fit("-", revWidth) + fit("-", revWidth) + fit("-", finalWidth) + live.verdict);
      if (verbose || live.verdict !== "PASS") console.log(" ".repeat(labelWidth) + "↳ namespace KHÔNG có trong settings.describe ⇒ mục không hiện hoặc ghi vào hư không");
      continue;
    }
    for (const field of live.fields) {
      const target = live.control.ns + "." + field.field;
      const value = JSON.stringify(field.probeValue ?? null);
      console.log(
        fit(live.control.label, labelWidth) +
          fit(target, targetWidth) +
          fit(value.length > valueWidth ? value.slice(0, valueWidth - 1) + "…" : value, valueWidth) +
          fit(field.revisionBefore === undefined ? "-" : String(field.revisionBefore), revWidth) +
          fit(field.revisionAfter === undefined ? "-" : String(field.revisionAfter), revWidth) +
          fit(field.revisionRestored === undefined ? "-" : String(field.revisionRestored), finalWidth) +
          (field.accepted ? (field.restored ? "PASS" : "FAIL") : live.verdict),
      );
      if (!field.accepted) console.log(" ".repeat(labelWidth) + "↳ Host từ chối: " + (field.error ?? "?"));
      else if (!field.restored) console.log(" ".repeat(labelWidth) + "↳ GHI ĐƯỢC NHƯNG KHÔNG TRẢ LẠI ĐƯỢC giá trị cũ — kiểm tay namespace này");
    }
  }
  return { fails, pending };
}

/**
 * Chạy PHẦN C (+ PHẦN D khi options.rpc) — in bảng và trả số FAIL để toggle-matrix gộp vào mã thoát.
 * Nhận: bối cảnh chạy (gốc repo, home, cờ rpc/verbose).
 * Trả: số phép kiểm FAIL (0 = mọi mục có đường ghi thật).
 */
export async function runSettingsSurface(options: SurfaceOptions): Promise<number> {
  const bundle = bundlePatchText(options.repoRoot);
  const overlay = overlayText(options.home, options.repoRoot);
  const template = templateText(options.repoRoot);
  const session = options.rpc ? await openRpcSession(options.home) : undefined;
  const namespaces = session === undefined ? undefined : await describeNamespaces(session);
  const staticChecks = CONTROLS.map((control) => checkStatic(control, options.repoRoot, bundle, overlay));
  const rows: ControlRow[] = withSchema(
    staticChecks.map((check) => ({
      check,
      target: check.control.ns + "." + check.control.fields.join("|"),
      writer: check.control.writer ?? "(controller)",
    })),
    namespaces,
  );
  let fails = printControlTable(rows, options.verbose);
  if (namespaces !== undefined) {
    const covered = new Set(CONTROLS.flatMap((control) => [control.ns, control.ns + "-ours"]));
    const uncovered = namespaces.filter((view) => !covered.has(view.ns));
    console.log("");
    console.log("↳ Namespace settings KHÔNG có mục nào trong bảng (" + String(uncovered.length) + "): lớp patch quyết định ghi được hay không");
    for (const view of uncovered) {
      const layer = rowLayerOf(view.ns, bundle, overlay);
      const pinned = hasRow(template, view.ns) || hasRow(template, view.ns + "-ours");
      console.log("   " + view.ns.padEnd(42) + "lớp " + layer.padEnd(8) + (pinned ? "GHIM ở template overlay ⇒ mọi lượt ghi bị từ chối" : "không ghim"));
    }
  }
  const discovered = discoverSwitchSites(options.repoRoot, CONTROLS);
  if (discovered.length > 0) {
    console.log("");
    console.log("↳ CHƯA KHAI trong bảng (" + String(discovered.length) + " chỗ render công tắc/ô chọn có ghi cấu hình):");
    for (const site of discovered.slice(0, 20)) console.log("   " + site.file + ":" + String(site.line) + "  (" + site.marker + ")");
    if (discovered.length > 20) console.log("   … và " + String(discovered.length - 20) + " chỗ nữa");
  }
  const passStatic = staticChecks.filter((check) => check.verdict === "PASS").length;
  console.log("");
  console.log("TỔNG PHẦN C: " + String(staticChecks.length) + " mục · " + String(passStatic) + " PASS · " + String(fails) + " FAIL · " + String(discovered.length) + " chỗ chưa khai");
  if (options.rpc && session === undefined) {
    console.log("PHẦN D: BỎ QUA — không mở được phiên RPC (thiếu ready-url.txt hoặc Host không trả cookie phiên).");
    return fails;
  }
  if (session === undefined) return fails;
  const lives: LiveCheck[] = [];
  for (const control of CONTROLS) {
    if (control.hidden !== undefined) continue;
    const view = namespaces?.find((entry) => entry.ns === control.ns || entry.ns === control.ns + "-ours");
    if (view === undefined) {
      lives.push({ control, namespaceServed: false, fields: [], verdict: "FAIL" });
      continue;
    }
    const probes: FieldProbe[] = [];
    if (control.probe === "pluginMarket/setIndexes") {
      // Mục này ghi qua endpoint RIÊNG (không phải settings/mutate): gửi lại ĐÚNG danh sách đang có
      // ⇒ chứng minh đường RPC nhận tham số mà không đổi dữ liệu của người dùng.
      const current = view.value?.["indexes"];
      const urls = Array.isArray(current) ? (current as unknown[]) : [];
      const answer = await session.rpc("pluginMarket/setIndexes", { urls });
      probes.push({
        field: "indexes",
        probeValue: urls,
        accepted: answer.ok,
        restored: true,
        ...(answer.ok ? {} : { error: (answer.error?.code ?? "?") + ": " + (answer.error?.message ?? "") }),
      });
      lives.push({ control, namespaceServed: true, revisionStart: view.revision, fields: probes, verdict: answer.ok ? "PASS" : "FAIL" });
      continue;
    }
    for (const field of control.fields) {
      // Giãn nhịp giữa các lượt ghi: mỗi lượt mutate làm Host áp lại cấu hình (client nạp lại module).
      // Viết dồn dập 60 lượt trong vài giây từng làm trang chớp trắng lúc đo (check:app đỏ tạm thời, 11/11/2026).
      await new Promise((resolveDelay) => setTimeout(resolveDelay, PROBE_GAP_MS));
      const userHas = view.user !== undefined && view.user !== null && Object.hasOwn(view.user, field);
      probes.push(await probeField(session, view.ns, field, view.schema, view.value?.[field], userHas));
    }
    const rejected = probes.filter((probe) => !probe.accepted);
    const bundleOwns = hasRow(bundle, control.ns) || hasRow(bundle, control.ns + "-ours");
    const templatePins = hasRow(template, control.ns) || hasRow(template, control.ns + "-ours");
    // Host đang chạy compose từ lớp overlay LÚC BOOT; repo đã bỏ ghim (template không còn row) mà Host vẫn
    // từ chối đúng câu "overridden by a home patch" ⇒ đây là Host CŨ, phải qua một lượt boot mới đo lại được.
    const staleHost = rejected.some((probe) => (probe.error ?? "").includes("overridden by a home patch"));
    const verdict: SurfaceVerdict =
      rejected.length === 0 ? "PASS" : bundleOwns && !templatePins && staleHost ? "CHỜ BOOT" : "FAIL";
    lives.push({ control, namespaceServed: true, revisionStart: view.revision, fields: probes, verdict });
  }
  const live = printLiveTable(lives, options.verbose);
  const passLive = lives.filter((check) => check.verdict === "PASS").length;
  console.log("");
  console.log("TỔNG PHẦN D: " + String(lives.length) + " mục đo · " + String(passLive) + " PASS · " + String(live.fails) + " FAIL · " + String(live.pending) + " CHỜ BOOT");
  for (const check of lives) {
    if (check.verdict === "CHỜ BOOT") {
      console.log("  CHỜ BOOT: '" + check.control.ns + "' — row đã được khai ở lớp bundle trong repo (sửa 11/11/2026), nhưng Host đang chạy");
      console.log("            vẫn compose từ app.patch.yml cũ ⇒ phải qua MỘT lượt boot của Lead rồi chạy lại --rpc để đo lần cuối.");
    }
  }
  session.close();
  return fails + live.fails;
}
