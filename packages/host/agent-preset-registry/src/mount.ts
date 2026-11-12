/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mount một revision preset vào scope riêng + audit hàng + phát hiện service RÒ — port 1:1
 *      `PresetTree`, `withinFiber`, `leakedServices`, `serviceForMount`, `detailBranches`, `mountDetail`,
 *      `auditRows`, `mountPreset`.
 */

import { Context } from "@deepseek-ai/cordis";
import { prepareProfileEntries } from "@deepseek-ai/dsh-app-boot";
import { scopeOf } from "@deepseek-ai/dsh-scope";
import { EntryTree } from "@deepseek-ai/cordis-plugin-loader";

import { collectEntryNames, isUnresolvedStockName, readNestedRedirects, rewriteNestedNames } from "./nested-mount.ts";
import type { PresetMount, RowAudit } from "./types.ts";

/** Fiber tối thiểu để so membership theo ĐỊNH DANH VẬT THỂ. */
interface FiberLike {
  /** Fiber cha (chính nó khi là gốc). */
  readonly parent: { readonly fiber: FiberLike };
}

/** Store service nội bộ của cordis mà row này đọc. */
interface StoreHost {
  /** Bảng store service theo symbol. */
  readonly reflect: { readonly store: Record<symbol, { readonly name: string; readonly fiber: unknown; readonly value: unknown } | undefined> };
  /** Realm isolate của context gốc. */
  readonly root: Record<symbol, Record<string, symbol> | undefined>;
}

/** Context đủ để dựng và audit một cây preset. */
interface MountContext extends StoreHost {
  /** Fiber của scope preset. */
  readonly fiber: FiberLike & { readonly entry?: unknown; await(): Promise<void> };
  /** Base URL dùng khi nạp entry. */
  readonly baseUrl?: string;
  /** Đăng ký effect thuộc scope. */
  effect(callback: () => () => unknown, label: string): unknown;
}

/** Cây entry của Loader, chỉ ghi đè `write` (không bao giờ ghi tệp). */
class PresetTree extends EntryTree {
  /**
   * Dựng cây preset dưới context cho trước.
   * Nhận: ctx — context cordis của scope preset.
   * Trả: cây entry sẵn dùng.
   */
  constructor(ctx: Context) {
    const owner = (ctx as unknown as { readonly fiber: { readonly entry?: { subtree?: unknown; subgroup?: unknown } } }).fiber.entry;
    const subtree = owner?.subtree;
    const subgroup = owner?.subgroup;
    super(ctx);
    if (owner !== undefined) {
      if (subtree === undefined) delete owner.subtree;
      else owner.subtree = subtree;
      if (subgroup === undefined) delete owner.subgroup;
      else owner.subgroup = subgroup;
    }
  }

  /** Cây preset chỉ sống trong bộ nhớ — profile editor mới là nơi lưu định nghĩa. */
  override write(): void {}
}

/**
 * Kiểm một fiber có nằm trong cây con của `root` hay không (so ĐỊNH DANH VẬT THỂ).
 * Nhận: fiber — fiber cần tìm; root — gốc cây con.
 * Trả: true khi fiber thuộc cây con.
 */
export function withinFiber(fiber: FiberLike, root: unknown): boolean {
  let current: unknown = fiber;
  while (true) {
    if (current === root) return true;
    const parent = (current as FiberLike).parent.fiber;
    if (parent === current) return false;
    current = parent;
  }
}

/**
 * Tên service mà cây con đã mount RÒ vào realm gốc.
 * Nhận: ctx — context của runtime cần soi store; mount — fiber gốc của cây con.
 * Trả: danh sách tên service rò, theo thứ tự từ điển.
 */
export function leakedServices(ctx: unknown, mount: unknown): string[] {
  const host = ctx as unknown as StoreHost;
  const store = host.reflect.store;
  const rootIsolate = host.root[Context.isolate] ?? {};
  const leaked: string[] = [];
  for (const key of Object.getOwnPropertySymbols(store)) {
    const impl = store[key];
    if (impl === undefined) continue;
    if (!withinFiber(impl.fiber as FiberLike, mount)) continue;
    if (rootIsolate[impl.name] === key) leaked.push(impl.name);
  }
  return leaked.sort((left, right) => left.localeCompare(right));
}

/**
 * Đọc service do MỘT revision giữ, kể cả realm isolate.
 * Nhận: ctx — context của runtime; mount — revision cần soi; name — tên service.
 * Trả: giá trị service, hoặc undefined khi revision không cấp.
 */
export function serviceForMount(ctx: unknown, mount: { readonly fiber: unknown }, name: string): unknown {
  const store = (ctx as unknown as StoreHost).reflect.store;
  for (const key of Object.getOwnPropertySymbols(store)) {
    const impl = store[key];
    if (impl === undefined) continue;
    if (impl.name !== name) continue;
    if (withinFiber(impl.fiber as FiberLike, mount.fiber)) return impl.value;
  }
  return undefined;
}

/**
 * Các NHÁNH nguyên nhân của một lỗi mà thông điệp của nó chưa mang.
 * Nhận: error — lỗi cần đọc nhánh.
 * Trả: các nhánh cần hiển thị dưới `error.message`, có thể rỗng.
 */
export function detailBranches(error: Record<string, unknown>): readonly unknown[] {
  if (error instanceof AggregateError) return error.errors;
  const cause = (error as { readonly cause?: unknown }).cause;
  return cause instanceof AggregateError ? cause.errors : [];
}

/**
 * Văn bản báo cáo của một lỗi mount (kèm nhánh aggregate nếu có).
 * Nhận: error — giá trị mà lượt mount reject.
 * Trả: mô tả một dòng mỗi nguyên nhân.
 */
export function mountDetail(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const branches = detailBranches(error as unknown as Record<string, unknown>);
  if (branches.length === 0) return error.message;
  return [error.message, ...branches.map((branch) => "- " + mountDetail(branch).replaceAll("\n", "\n  "))].join("\n");
}

/**
 * Audit các hàng của một cây đã mount: chờ cây, rồi báo hàng import hỏng, hàng không activate, và hàng
 * đang chờ service mà composition không cấp.
 * Nhận: tree — cây đã mount.
 * Trả: hai danh sách failed/pending (rỗng khi mọi hàng bật đều dùng được).
 */
export async function auditRows(tree: { await(): Promise<void>; entries(): Iterable<unknown> }): Promise<RowAudit> {
  await tree.await();
  const failed: string[] = [];
  const pending: string[] = [];
  for (const value of tree.entries()) {
    const entry = value as {
      readonly disabled: boolean;
      readonly options: { readonly id: string; readonly name: string };
      readonly fiber?: { readonly inject: Record<string, unknown>; readonly ctx: { get(name: string): unknown }; await(): Promise<void> };
    };
    if (entry.disabled) continue;
    if (entry.fiber === undefined) {
      failed.push(entry.options.id + " (" + entry.options.name + "): never started");
      continue;
    }
    try {
      await entry.fiber.await();
    } catch (error) {
      failed.push(entry.options.id + " (" + entry.options.name + "): " + mountDetail(error));
      continue;
    }
    const missing = Object.keys(entry.fiber.inject).filter((name) => entry.fiber?.ctx.get(name) === undefined);
    if (missing.length > 0) pending.push(entry.options.id + " (" + entry.options.name + "): waiting for " + missing.join(", "));
  }
  return { failed, pending };
}

/**
 * In lai danh sach tool o cac moc MUON (5s/10s/20s) — để bắt trường hợp tool chỉ đăng ký khi đã có PHIÊN/AGENT
 * (giả thuyết còn lại sau khi loại H1/H2). Chỉ log, timer unref, không đổi hành vi.
 * Nhận: scopeContext — context scope preset; presetId — nhãn log. Trả: không.
 */
function logToolsLater(scopeContext: unknown, presetId: string, cheDo: string): void {
  for (const moc of [5000, 10000, 20000]) {
    const timer = setTimeout(() => {
      const liet = describeTools(scopeContext);
      console.log("agent-preset[" + presetId + "] probe (" + cheDo + ") tool da dang ky (muon " + String(moc) + "ms): " + liet);
    }, moc);
    (timer as unknown as { unref?: () => void }).unref?.();
  }
}

/**
 * In lai danh sach tool SAU KHI mount settle — vì plugin tool của DSH đăng ký BẤT ĐỒNG BỘ qua `ctx.inject([...])`
 * (đo được ở tests/host/tool-schedule.test.ts: 0 tool ngay sau apply, 4 tool sau macrotask), nên `tools.schemas()`
 * tại thời điểm mount xong vẫn rỗng. Hàm này thử lại vài mốc (không giữ tiến trình sống: timer unref).
 * Nhận: scopeContext — context của scope preset; presetId — id preset để gắn nhãn log.
 * Trả: không (chỉ log; lỗi được nuốt vì đây là phép đo, không phải đường nghiệp vụ).
 */
function logToolsAfterSettle(scopeContext: unknown, presetId: string, tree: { entries(): Iterable<unknown> } | undefined, cheDo: string): void {
  const moc = [200, 700, 1500, 3000];
  let da = 0;
  const thu = (): void => {
    const liet = describeTools(scopeContext);
    const coSchedule = liet.includes("schedule_");
    if (coSchedule || da === moc.length - 1) {
      console.log("agent-preset[" + presetId + "] probe (" + cheDo + ") tool da dang ky (sau mount settle, moc " + String(moc[da]) + "ms): " + liet);
      // Chẩn đoán DỊCH VỤ trong CHÍNH realm của preset — chặn thật nằm ở inject ĐỘNG `ctx.inject(['schedule'])`
      // bên trong apply của plugin, nên phải đo `ctx.get('schedule')` ở đây chứ không chỉ đọc inject tĩnh.
      console.log("agent-preset[" + presetId + "] dich vu trong realm preset: " + describeService(scopeContext, "schedule") + " · " + describeService(scopeContext, "tools"));
      console.log("agent-preset[" + presetId + "] tool trong ROOT runtime loc 'schedule': " + describeRootScheduleTools(scopeContext));
      void describeEntryFiber(tree, presetId);
      if (!coSchedule) console.log("agent-preset[" + presetId + "] inject chua tho (sau settle): " + describeInjectState(tree));
      return;
    }
    da += 1;
    const delay = moc[da] ?? 3000;
    const timer = setTimeout(thu, delay - (moc[da - 1] ?? 0));
    (timer as unknown as { unref?: () => void }).unref?.();
  };
  const first = setTimeout(thu, moc[0] ?? 200);
  (first as unknown as { unref?: () => void }).unref?.();
}

/**
 * Doc danh sach tool `schedule_*` tu runtime Ơ ROOT (nơi agent thật sự chạy tool), không phải scope preset.
 * Nhận: scopeContext — context của scope preset (dùng để lần lên gốc).
 * Trả: chuỗi tên tool khớp `schedule_`, hoặc mô tả vì sao không đọc được.
 */
function describeRootScheduleTools(scopeContext: unknown): string {
  /**
   * Đọc một thuộc tính mà KHÔNG làm ném: cordis ném `cannot get property "ctx" without inject` khi một context
   * chưa khai `inject` mà đọc `.ctx`/service ⇒ chính phép CHẨN ĐOÁN này từng ném và che mất lỗi thật (task-187).
   * Nhận: vật thể và tên thuộc tính. Trả: giá trị, hoặc undefined nếu ném.
   */
  const readSafe = (target: unknown, key: string): unknown => {
    try {
      return (target as Record<string, unknown>)[key];
    } catch {
      return undefined;
    }
  };
  try {
    let current = scopeContext as { get?(n: string): unknown; ctx?: unknown; root?: unknown } | undefined;
    const seen = new Set<unknown>();
    let root: { get(n: string): unknown } | undefined;
    while (current !== undefined && current !== null && !seen.has(current)) {
      seen.add(current);
      if (typeof current.get === "function" && readSafe(current, "root") === current) {
        root = current as { get(n: string): unknown };
        break;
      }
      const next = readSafe(current, "ctx") ?? readSafe(current, "root");
      current = typeof next === "object" && next !== null ? (next as typeof current) : undefined;
    }
    if (root === undefined) return "(khong lan duoc len context goc)";
    const tools = root.get("tools") as { schemas?: () => unknown } | undefined;
    if (tools === undefined || typeof tools.schemas !== "function") return "(root khong co service tools)";
    const list = tools.schemas();
    if (!Array.isArray(list)) return "(schemas() khong tra mang)";
    const names = list
      .map((item) => (typeof item === "object" && item !== null ? (item as { name?: unknown }).name : undefined))
      .filter((item): item is string => typeof item === "string")
      .filter((item) => item.includes("schedule"))
      .sort();
    return names.length === 0 ? "(khong co tool schedule_* trong root)" : names.join(", ");
  } catch (error) {
    return "(loi doc root tools: " + String(error).slice(0, 80) + ")";
  }
}

/**
 * Choi fiber của entry `tool-schedule` xem apply có chạy xong / ném lỗi gì (giả thuyết H2: apply không chạy).
 * Nhận: tree — cây đã mount; presetId — nhãn log; Trả: promise in kết quả (không ném ra ngoài).
 */
async function describeEntryFiber(tree: { entries(): Iterable<unknown> } | undefined, presetId: string): Promise<void> {
  if (tree === undefined) return;
  try {
    for (const value of tree.entries()) {
      const entry = value as {
        readonly options?: { readonly id?: string; readonly name?: string };
        readonly fiber?: { await(): Promise<void> };
      };
      if (entry.options?.name?.includes("gbh-tool-schedule") !== true) continue;
      const fiber = entry.fiber;
      if (fiber === undefined) {
        console.log("agent-preset[" + presetId + "] fiber tool-schedule: (khong co fiber)");
        continue;
      }
      try {
        await fiber.await();
        console.log("agent-preset[" + presetId + "] fiber tool-schedule: apply xong KHONG loi");
      } catch (error) {
        console.log("agent-preset[" + presetId + "] fiber tool-schedule: LOI " + String(error).slice(0, 160));
      }
    }
  } catch (error) {
    console.log("agent-preset[" + presetId + "] fiber tool-schedule: loi doc cay " + String(error).slice(0, 80));
  }
}

/**
 * Mo ta mot service trong realm của scope: có/không, kiểu, và (nếu là object) vài khoá đầu — để phân biệt
 * "service thật" với undefined khi chẩn đoán inject động.
 * Nhận: scopeContext — context của scope preset; name — tên service (vd 'schedule').
 * Trả: chuỗi dạng `schedule=object{list,create,…}` hoặc `schedule=THIEU` hoặc `schedule=<loi: …>`.
 */
function describeService(scopeContext: unknown, name: string): string {
  try {
    const context = scopeContext as { get(n: string): unknown };
    const value = context.get(name);
    if (value === undefined) return name + "=THIEU";
    if (value === null) return name + "=null";
    if (typeof value !== "object" && typeof value !== "function") return name + "=" + typeof value;
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const head = keys.slice(0, 6).join(",");
    const proto = Object.getPrototypeOf(value) as { constructor?: { name?: string } } | null;
    const protoName = proto?.constructor?.name ?? "?";
    const serviceName = typeof record["name"] === "string" ? String(record["name"]) : "?";
    // API thật của service `schedule` là các phương thức nghiệp vụ; nếu các khoá chỉ là chain/ctx/initialized/… thì
    // đó là FIBER của cordis chứ không phải service ⇒ in thêm prototype + typeof từng phương thức để khỏi kết luận sai.
    const api = ["list", "create", "delete", "update", "retention", "runtime"]
      .map((member) => member + ":" + typeof record[member])
      .join(" ");
    return (
      name + "=" + typeof value + " proto=" + protoName + " ten=" + serviceName + " api{" + api + "}" +
      " keys{" + (keys.length > 6 ? head + ",…(" + String(keys.length) + ")" : head) + "}"
    );
  } catch (error) {
    return name + "=<loi doc: " + String(error).slice(0, 60) + ">";
  }
}

/**
 * Liet ke trang thai inject cua cac entry LIEN QUAN trong cay preset — để biết VÌ SAO tool không đăng ký
 * (ví dụ `tool-schedule` chờ service `schedule` mà realm của preset không thấy).
 * Nhận: tree — cây đã mount (có entries()).
 * Trả: chuỗi mô tả, mỗi entry một mục dạng `id(name): inject{a=ok, b=THIEU}`.
 */
function describeInjectState(tree?: { entries(): Iterable<unknown> }): string {
  if (tree === undefined) return "(khong co cay)";
  const out: string[] = [];
  try {
    for (const value of tree.entries()) {
      const entry = value as {
        readonly options?: { readonly id?: string; readonly name?: string };
        readonly disabled?: boolean;
        readonly fiber?: { readonly inject?: Record<string, unknown>; readonly ctx?: { get(name: string): unknown } };
      };
      const entryName = entry.options?.name ?? "?";
      const entryId = entry.options?.id ?? "?";
      const related = entryName.includes("gbh-tool-schedule") || entryId.includes("tool-schedule");
      if (!related) continue;
      const inject = entry.fiber?.inject ?? {};
      const keys = Object.keys(inject).sort();
      if (keys.length === 0) {
        out.push(entryId + "(" + entryName + "): khong khai inject");
        continue;
      }
      const chiTiet = keys.map((name) => name + "=" + (entry.fiber?.ctx?.get(name) === undefined ? "THIEU" : "ok")).join(", ");
      out.push(entryId + "(" + entryName + "): " + (entry.disabled === true ? "disabled · " : "") + "inject{" + chiTiet + "}");
    }
  } catch (error) {
    return "(loi doc cay: " + String(error).slice(0, 80) + ")";
  }
  return out.length === 0 ? "(khong thay entry tool-schedule trong cay)" : out.join(" | ");
}

/**
 * Liet ke ten cac tool da dang ky trong mot scope (bang chung runtime cho mount row long).
 * Nhận: scopeContext — context của scope đang mount preset.
 * Trả: chuỗi "a, b, c" hoặc "(khong doc duoc service tools)" khi scope chưa có service đó.
 */
function describeTools(scopeContext: unknown): string {
  try {
    const context = scopeContext as { get(name: string): unknown };
    const tools = context.get("tools") as { schemas?: () => unknown } | undefined;
    if (tools === undefined || typeof tools.schemas !== "function") return "(khong doc duoc service tools)";
    const list = tools.schemas();
    if (!Array.isArray(list)) return "(schemas() khong tra mang)";
    const names = list
      .map((item) => (typeof item === "object" && item !== null ? (item as { name?: unknown }).name : undefined))
      .filter((name): name is string => typeof name === "string")
      .sort();
    return names.length === 0 ? "(rong)" : names.join(", ");
  } catch (error) {
    return "(loi doc tools: " + String(error).slice(0, 80) + ")";
  }
}

/**
 * Liet ke cac cap (ten stock -> ten moi) da doi trong mot lan mount preset.
 * Nhận: truoc — danh sách entry gốc; sau — danh sách đã viết lại.
 * Trả: các dòng mô tả (rỗng khi không đổi gì).
 */
function describeRedirects(truoc: readonly unknown[], sau: readonly unknown[]): string[] {
  const out: string[] = [];
  const walk = (a: unknown, b: unknown): void => {
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let index = 0; index < a.length; index += 1) walk(a[index], b[index]);
      return;
    }
    if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return;
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const nameBefore = left["name"];
    const nameAfter = right["name"];
    if (typeof nameBefore === "string" && typeof nameAfter === "string" && nameBefore !== nameAfter) {
      const pluginId = typeof left["id"] === "string" ? left["id"] : "?";
      out.push("redirect row long: " + pluginId + " " + nameBefore + " -> " + nameAfter);
    }
    for (const key of Object.keys(left)) if (key !== "name") walk(left[key], right[key]);
  };
  walk(truoc, sau);
  return out;
}

/** Ban do redirect row long — doc MOT lan cho ca tien trinh (profile khong doi trong vong doi app). */
let nestedCache: { readonly map: ReadonlyMap<string, string>; readonly warnings: readonly string[] } | undefined;

/**
 * Ban do redirect row long, cache theo tien trinh; in canh bao MOT lan cho moi goi khong dung duoc.
 * Nhận: không. Trả: bản đồ stockId → specifier của ta (rỗng khi không có khai báo nào).
 */
function nestedRedirectsOnce(): { readonly map: ReadonlyMap<string, string>; readonly warnings: readonly string[] } {
  if (nestedCache !== undefined) return nestedCache;
  try {
    const read = readNestedRedirects();
    for (const warning of read.warnings) console.warn(warning);
    nestedCache = read;
  } catch (error) {
    console.warn("agent-preset: doc ban do redirect row long that bai ⇒ giu ten stock: " + String(error));
    nestedCache = { map: new Map(), warnings: [] };
  }
  return nestedCache;
}

/** Đã thử đọc LẠI bản đồ một lần hay chưa (chống quét profile lặp lại vô hạn). */
let nestedRefreshed = false;

/**
 * Bản đồ redirect đủ cho MỘT cây plugin: dùng cache, nhưng nếu trong cây còn TÊN STOCK chưa được phủ thì
 * đọc lại profile MỘT lần nữa. Lý do (task-169): cache đọc ở lượt mount preset ĐẦU TIÊN, khi các gói row-long
 * mount SAU đó (hoặc vừa copy vào profile) chưa có mặt ⇒ nhóm lồng như `delegation` giữ nguyên tên stock
 * suốt vòng đời app dù gói đã sẵn sàng.
 * Nhận: plugins — danh sách entry sắp mount. Trả: bản đồ redirect (có thể đọc lại) + cảnh báo đã in.
 */
function nestedRedirectsFor(plugins: readonly unknown[]): { readonly map: ReadonlyMap<string, string>; readonly warnings: readonly string[] } {
  const current = nestedRedirectsOnce();
  if (nestedRefreshed) return current;
  const stockNames = collectEntryNames(plugins).filter((name) => name.startsWith("@deepseek-ai/"));
  const unresolved = stockNames.filter((name) => isUnresolvedStockName(name, current.map));
  if (unresolved.length === 0) return current;
  nestedRefreshed = true;
  try {
    const fresh = readNestedRedirects();
    for (const warning of fresh.warnings) console.warn(warning);
    if (fresh.map.size > current.map.size) {
      console.log("agent-preset: doc LAI ban do redirect row long (" + String(current.map.size) + " -> " + String(fresh.map.size) + " muc) vi con ten stock chua phu: " + unresolved.slice(0, 4).join(", "));
    }
    nestedCache = fresh;
  } catch (error) {
    console.warn("agent-preset: doc LAI ban do redirect row long that bai ⇒ giu ten stock: " + String(error));
  }
  return nestedCache ?? current;
}

/**
 * Nạp và audit MỘT revision dưới scope do registry sở hữu.
 * Nhận: ctx — context scope (kế thừa base phân giải của Loader khai báo); id — danh tính preset;
 * plugins — danh sách entry Cordis đã khai.
 * Trả: revision đang sống (scope dispose sở hữu việc dọn).
 */
export async function mountPreset(ctx: unknown, id: string, plugins: readonly unknown[]): Promise<PresetMount> {
  const scopeContext = ctx as unknown as MountContext & { readonly baseUrl?: string };
  if (scopeOf(scopeContext as never) === undefined) throw new Error("agent-preset: mounting requires a scope");
  await scopeContext.fiber.await();
  const tree = new PresetTree(scopeContext as never);
  scopeContext.effect(() => () => {
    (tree as unknown as { root: { stop(): void } }).root.stop();
  }, "agent-preset.tree");
  // ADR 0007 — mount row LONG: doi ten module STOCK -> goi cua ta theo metadata `gbh.nested` da copy vao profile.
  // FAIL-SOFT: khong doc duoc ban do / goi chua co trong profile ⇒ giu nguyen ten stock (chi canh bao 1 dong),
  // khong bao gio nem o day — nem se lam chet ca cay boot (su co 18/10/2026).
  const nested = nestedRedirectsFor(plugins);
  const effectivePlugins = nested.map.size === 0 ? plugins : rewriteNestedNames(plugins, nested.map, id);
  // Bằng chứng RUNTIME (ADR 0007 §5): in 1 dòng cho mỗi plugin bị đổi tên — đây là log để đối chiếu khi boot,
  // vì `--dump-config` KHÔNG thấy được (redirect xảy ra lúc mount, không nằm trong văn bản config).
  if (effectivePlugins !== plugins) {
    for (const line of describeRedirects(plugins, effectivePlugins)) console.log("agent-preset[" + id + "] " + line);
  }
  const prepared = prepareProfileEntries(scopeContext as never, effectivePlugins as never, scopeContext.baseUrl as never);
  await (tree as unknown as { root: { update(value: unknown): Promise<void> } }).root.update(prepared);
  const audit = await auditRows(tree as unknown as { await(): Promise<void>; entries(): Iterable<unknown> });
  // task-204 — BẰNG CHỨNG RUNTIME: liệt kê entry ĐÃ KHAI vs entry CÓ THẬT trong cây sau khi mount, kèm lý do loại.
  // Mục đích: thấy đúng chỗ preset cordis đánh rơi `tool-schedule` (không phải đoán).
  {
    /** Rút (id, name, disabled) từ một node entry bất kỳ của Loader. */
    const identify = (value: unknown): { id: string; name: string; disabled: boolean; error: string } => {
      const record = value as {
        id?: string;
        name?: string;
        disabled?: boolean;
        options?: { id?: string; name?: string };
        error?: unknown;
      };
      const error = record.error === undefined || record.error === null ? "" : String((record.error as { message?: string }).message ?? record.error);
      // Hai hình dạng: node của Loader (`options.id/name`) và node ĐÃ CHUẨN BỊ (`id/name` phẳng).
      return {
        id: String(record.options?.id ?? record.id ?? "?"),
        name: String(record.options?.name ?? record.name ?? "?"),
        disabled: record.disabled === true,
        error,
      };
    };
    /** Thu thập mọi entry con (mọi độ sâu) của cây. */
    const flatten = (nodes: readonly unknown[], out: ReturnType<typeof identify>[] = []): ReturnType<typeof identify>[] => {
      for (const node of nodes) {
        out.push(identify(node));
        const children = (node as { children?: readonly unknown[] }).children;
        if (Array.isArray(children)) flatten(children, out);
      }
      return out;
    };
    const declared = flatten(Array.isArray(prepared) ? prepared : []);
    const mounted = [...tree.entries()].map(identify);
    const mountedIds = new Set(mounted.map((row) => row.id));
    const dropped = declared.filter((row) => !row.disabled && !mountedIds.has(row.id));
    console.log(
      "agent-preset[" + id + "] task-204: khai " + String(declared.length) + " · cây có " + String(mounted.length) +
        " · BỊ RƠI " + String(dropped.length) +
        (dropped.length === 0 ? "" : " ⇒ " + dropped.map((row) => row.id + "(" + row.name + ")" + (row.error === "" ? "" : " loi=" + row.error)).join(" | ")),
    );
    if (id === "cordis") {
      for (const row of declared) console.log("agent-preset[cordis] task-204 khai: " + row.id + " (" + row.name + ")" + (row.disabled ? " [disabled]" : ""));
      for (const row of mounted) console.log("agent-preset[cordis] task-204 cây: " + row.id + " (" + row.name + ")" + (row.disabled ? " [disabled]" : "") + (row.error === "" ? "" : " loi=" + row.error));
      for (const row of audit.failed) console.log("agent-preset[cordis] task-204 audit FAILED: " + row);
      for (const row of audit.pending) console.log("agent-preset[cordis] task-204 audit PENDING: " + row);
    }
  }
  // Bằng chứng RUNTIME cho ADR 0007 §5/§7.4: chạy SONG SONG ở cả hai chế độ (redirect bật/tắt) để A/B đúng nghĩa
  // — chỉ cần preset CÓ plugin tool-schedule là đủ, không phụ thuộc việc có redirect hay không.
  const hasSchedulePlugin = JSON.stringify(plugins).includes("tool-schedule");
  if (hasSchedulePlugin) {
    const cheDo = effectivePlugins === plugins ? "redirect:OFF" : "redirect:ON";
    console.log("agent-preset[" + id + "] probe (" + cheDo + ") tool da dang ky (ngay sau mount): " + describeTools(scopeContext));
    logToolsAfterSettle(scopeContext, id, tree as unknown as { entries(): Iterable<unknown> }, cheDo);
    logToolsLater(scopeContext, id, cheDo);
  }
  const leaked = leakedServices(scopeContext, scopeContext.fiber);
  if (audit.failed.length > 0) throw new Error(audit.failed.join("\n"));
  if (leaked.length > 0) throw new Error("Preset services require isolate realms: " + leaked.join(", "));
  return {
    presetId: id,
    fiber: scopeContext.fiber,
    tree: tree as unknown as PresetMount["tree"],
    key: scopeOf(scopeContext as never) as object,
  };
}

/**
 * Đổi tên plugin con (mọi độ sâu, kể cả group lồng) từ id stock sang id GBH — dùng cho row preset ghi lại
 * cây config mà Sổ cài đặt → Plugin đọc (task-173). Fail-soft: lỗi đọc bản đồ ⇒ giữ nguyên tên stock.
 * Nhận: plugins — danh sách entry preset. Trả: danh sách đã đổi (idempotent; map rỗng ⇒ bản sao nguyên văn).
 */
export function redirectPluginNames(plugins: readonly unknown[]): unknown[] {
  try {
    const nested = nestedRedirectsFor(plugins);
    return nested.map.size === 0 ? [...plugins] : rewriteNestedNames(plugins, nested.map);
  } catch (error) {
    console.warn("agent-preset-registry: khong doi duoc ten row long ⇒ giu ten stock: " + String(error));
    return [...plugins];
  }
}
