/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B (19 ca) cho @galaxy-blackhole/gbh-host-directory-picker: artefact byte-identical với
 *      bundle gốc (sha256 · byte · dòng), id stock 1 lần ở JSDoc dòng 13, ghép 3 lát bằng src/assemble.ts,
 *      manifest gói THƯ VIỆN (không row), exports khớp gốc, và hành vi trên Context cordis THẬT
 *      (ctx.plugin ⇒ ctx.directoryPicker, lỗi DirectoryPickerError cùng name/message, prototype công khai).
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { assembleBundle, stripSliceScaffold } from "../../packages/host/host-directory-picker/src/assemble.ts";
import { MODULE_TAIL, PACKAGE_NAME, PART_FILES, SLICE_MARKER, STOCK_ID } from "../../packages/host/host-directory-picker/src/manifest.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const PKG = join(REPO, "packages", "host", "host-directory-picker");
/** node_modules của kernel — nơi cả hai bản phân giải peer cordis. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Thư mục bundle GỐC (CHỈ ĐỌC) — oracle. */
const STOCK_DIR = join(APP_MODULES, "@deepseek-ai", "dsh-host-directory-picker");
/** Artefact GỐC. */
const STOCK_ARTIFACT = join(STOCK_DIR, "lib", "index.js");
/** Artefact của ta. */
const OURS_ARTIFACT = join(PKG, "lib", "index.js");
/** manifest của gói. */
const MANIFEST = join(PKG, "package.json");
/** Đường dẫn tương đối của chính tệp test này (tính từ gốc repo). */
const TEST_REL = "tests/host/host-directory-picker.test.ts";
/** Tên service mà lớp DirectoryPicker đăng ký. */
const SERVICE_NAME = "directoryPicker";
/** Tên ký tự xuống dòng. */
const EOL = String.fromCharCode(10);
/** sha256 của bundle gốc (đo 19/10/2026). */
const EXPECTED_SHA = "a02b64f588a546c5278ba35ae4aca9825baf43c5f7a105c864698cb4805c3dd9";
/** Số byte của bundle gốc. */
const EXPECTED_BYTES = 1845;
/** Số dòng theo nghĩa wc -l của bundle gốc. */
const EXPECTED_LINES = 44;
/** Đầu vào SAI cho primitive browse (đường dẫn không tuyệt đối). */
const BAD_PATHS: readonly unknown[] = ["relative/dir", "", "C:\\tmp"];

/** Lớp lỗi thương mại của gói: code đóng + đường dẫn tuyệt đối. */
interface PickerError extends Error {
  /** Mã nghiệp vụ đóng của lỗi. */
  code: string;
  /** Đường dẫn tuyệt đối mà lỗi nói tới. */
  path: string;
}

/** Hàm dựng DirectoryPickerError của một bên. */
interface PickerErrorCtor {
  /** Dựng lỗi từ code + path + message. */
  new (code: string, path: string, message?: string): PickerError;
  /** Nguyên mẫu dùng để so bề mặt công khai. */
  prototype: PickerError;
}

/** Instance service sau khi cordis bọc tracker (chỉ chạm bề mặt công khai). */
interface PickerInstance {
  /** Tên service đã đăng ký. */
  name: string;
  /** Capability — chỉ có ở lớp con triển khai. */
  capability?(): { kind: string };
  /** Context sở hữu service. */
  ctx?: unknown;
}

/** Hàm dựng lớp service của một bên. */
interface PickerCtor {
  /** Dựng service trên một Context cordis. */
  new (ctx: CtxLike, config?: unknown): PickerInstance;
  /** Nguyên mẫu dùng để so tập phương thức công khai. */
  prototype: PickerInstance;
  /** Số tham số hình thức của hàm dựng. */
  readonly length: number;
  /** Tên lớp. */
  readonly name: string;
}

/** Bề mặt ESM của một bundle (kết quả await import). */
interface PickerModule {
  /** Export default — phải là chính lớp DirectoryPicker. */
  default: PickerCtor;
  /** Lớp service trừu tượng. */
  DirectoryPicker: PickerCtor;
  /** Lớp lỗi thương mại. */
  DirectoryPickerError: PickerErrorCtor;
}

/** Fiber cordis tối thiểu: await được, có dispose và context riêng. */
interface FiberLike extends PromiseLike<unknown> {
  /** Context của fiber. */
  ctx?: CtxLike;
  /** Dọn fiber (gỡ service khỏi context). */
  dispose(): Promise<void>;
}

/** Context cordis tối thiểu mà test chạm tới. */
interface CtxLike {
  /** Service do lớp DirectoryPicker đăng ký. */
  directoryPicker?: PickerInstance;
  /** Fiber gốc của context. */
  fiber?: FiberLike;
  /** Sổ đăng ký service. */
  reflect?: { get(name: string): PickerInstance | undefined };
  /** Nạp một lớp plugin vào context. */
  plugin(plugin: PickerCtor, config?: unknown): FiberLike;
}

/** Thế giới A/B: cordis thật + hai bản nạp từ bản sao trong mkdtemp. */
interface Harness {
  /** Thư mục tạm (dọn ở afterAll). */
  root: string;
  /** Hàm dựng Context cordis thật. */
  Context: new () => CtxLike;
  /** Lớp Service của cordis (để kiểm instance). */
  Service: Function;
  /** Bản của ta nạp bằng await import(). */
  ours: PickerModule;
  /** Bản gốc nạp bằng await import(). */
  stock: PickerModule;
  /** Entry Bun.build (lib/index-entry.js) của ta. */
  entry: Record<string, unknown>;
  /** Dọn toàn bộ thư mục tạm. */
  dispose(): void;
}

/** Manifest package.json tối thiểu mà test đọc. */
interface Manifest {
  /** Tên package. */
  name?: string;
  /** Kiểu module. */
  type?: string;
  /** Entry chính. */
  main?: string;
  /** Bảng export. */
  exports?: Record<string, unknown>;
  /** Peer dependencies. */
  peerDependencies?: Record<string, string>;
  /** Metadata của repo. */
  gbh?: {
    /** Lý do/ghi chú port. */
    draft?: string;
    /** Test phủ gói. */
    tests?: string[];
    /** Peer khai báo. */
    peers?: string[];
    /** Row mount (gói THƯ VIỆN phải KHÔNG có). */
    row?: unknown;
    /** Row đã gỡ (gói THƯ VIỆN phải KHÔNG có). */
    row_unmounted_ly_do?: unknown;
  };
  /** Khối client (không được có ở gói này). */
  dsh?: unknown;
}

/** Primitive browse dựng trong test để chạm đường lỗi của gói. */
interface BrowsePrimitiveService extends PickerInstance {
  /** Trả capability browse. */
  capability(): { kind: string };
  /** Liệt kê một đường dẫn tuyệt đối; sai ⇒ DirectoryPickerError. */
  list(path: unknown): string[];
}

/** Kết quả bắt lỗi đồng bộ. */
interface Caught {
  /** Lỗi bắt được, hoặc undefined khi không ném. */
  error?: unknown;
}

/** Thế giới A/B dựng trong beforeAll. */
let world: Harness | undefined;

/**
 * Băm SHA-256 của một buffer.
 * Nhận: data — bytes cần băm. Trả: chuỗi hex 64 ký tự.
 */
function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Đếm số dòng theo nghĩa wc -l (số ký tự xuống dòng).
 * Nhận: text — văn bản cần đếm. Trả: số dòng.
 */
function lineCount(text: string): number {
  const matches = text.match(/\n/gu);
  return matches === null ? 0 : matches.length;
}

/**
 * Vị trí (1-based) các dòng chứa một chuỗi.
 * Nhận: text — văn bản; needle — chuỗi cần tìm. Trả: mảng số dòng.
 */
function lineNumbers(text: string, needle: string): number[] {
  const found: number[] = [];
  const lines = text.split(EOL);
  for (let index = 0; index < lines.length; index += 1) {
    if ((lines[index] ?? "").includes(needle)) found.push(index + 1);
  }
  return found;
}

/**
 * Đọc + parse một tệp package.json.
 * Nhận: path — đường dẫn tuyệt đối. Trả: manifest đã parse.
 */
function readJson(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

/**
 * Gom mọi đích tệp trong bảng exports (bỏ mẫu có dấu *).
 * Nhận: value — nhánh exports; found — mảng tích luỹ. Trả: danh sách đích tương đối.
 */
function exportTargets(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.startsWith("./") && !value.includes("*")) found.push(value);
    return found;
  }
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) exportTargets(nested, found);
  }
  return found;
}

/**
 * Bề mặt export của một module ESM để so A/B.
 * Nhận: mod — module đã nạp. Trả: hình dạng quan sát được.
 */
function moduleSurface(mod: PickerModule): Record<string, unknown> {
  const sample = new mod.DirectoryPickerError("code", "/path", "message");
  return {
    exports: Object.keys(mod).sort(),
    hasOwnDefault: Object.prototype.hasOwnProperty.call(mod, "default"),
    defaultIsPicker: mod.default === mod.DirectoryPicker,
    pickerKind: typeof mod.DirectoryPicker,
    errorKind: typeof mod.DirectoryPickerError,
    errorIsError: mod.DirectoryPickerError.prototype instanceof Error,
    errorName: sample.name,
  };
}

/**
 * Hình dạng lỗi để so A/B (không so stack).
 * Nhận: error — giá trị bắt được. Trả: name/message/code/path/isError.
 */
function errorShape(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { name: "NonError", message: String(error), isError: false };
  const typed = error as PickerError;
  const shape: Record<string, unknown> = { name: typed.name, message: typed.message, isError: true };
  if (typeof typed.code === "string") shape.code = typed.code;
  if (typeof typed.path === "string") shape.path = typed.path;
  return shape;
}

/**
 * Chạy một phép đồng bộ, bắt lỗi thay vì ném.
 * Nhận: fn — phép cần chạy. Trả: { error } hoặc {}.
 */
function caught(fn: () => unknown): Caught {
  try {
    fn();
    return {};
  } catch (error) {
    return { error };
  }
}

/**
 * Chạy một phép (đồng bộ hoặc bất đồng bộ), trả mô tả lỗi thay vì ném.
 * Nhận: fn — phép cần chạy. Trả: chuỗi "Ten: message" hoặc "(khong nem)".
 */
async function rejectionOf(fn: () => unknown): Promise<string> {
  try {
    await fn();
    return "(khong nem)";
  } catch (error) {
    return error instanceof Error ? error.name + ": " + error.message : String(error);
  }
}

/**
 * Tập tên phương thức công khai trên chuỗi nguyên mẫu (bỏ Object.prototype).
 * Nhận: ctor — hàm dựng lớp. Trả: tên đã sắp xếp.
 */
function prototypeMethodNames(ctor: PickerCtor): string[] {
  const names = new Set<string>();
  let proto: object | null = ctor.prototype;
  while (proto !== null && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) names.add(name);
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return [...names].sort();
}

/**
 * Dựng Context cordis mới của một bên.
 * Nhận: harness — thế giới A/B. Trả: context rỗng.
 */
function newContext(harness: Harness): CtxLike {
  return new harness.Context();
}

/**
 * Mount một lớp service như loader cordis: ctx.plugin(Lop, config) rồi chờ ACTIVE.
 * Nhận: harness — thế giới; ctor — lớp service; config — cấu hình tuỳ chọn.
 * Trả: { ctx, fiber }.
 */
async function mount(harness: Harness, ctor: PickerCtor, config?: unknown): Promise<{ ctx: CtxLike; fiber: FiberLike }> {
  const ctx = newContext(harness);
  const fiber = ctx.plugin(ctor, config);
  await fiber;
  return { ctx, fiber };
}

/**
 * Lấy service ctx.directoryPicker, ném nếu chưa xuất hiện.
 * Nhận: ctx — context cordis. Trả: instance service.
 */
function serviceOf(ctx: CtxLike): PickerInstance {
  const service = ctx.directoryPicker;
  if (service === undefined) throw new Error("ctx.directoryPicker khong xuat hien");
  return service;
}

/**
 * Dọn fiber gốc của một context (nếu có).
 * Nhận: ctx — context cordis. Trả: không.
 */
async function disposeContext(ctx: CtxLike): Promise<void> {
  const fiber = ctx.fiber;
  if (fiber !== undefined) await fiber.dispose();
}

/**
 * Hình dạng service trên context để so A/B (không so danh tính instance).
 * Nhận: harness — thế giới; mod — bên cần đo; ctx — context đã mount.
 * Trả: hình dạng quan sát được.
 */
function serviceShape(harness: Harness, mod: PickerModule, ctx: CtxLike): Record<string, unknown> {
  const service = ctx.directoryPicker;
  return {
    root: typeof service,
    fiberCtx: typeof ctx.fiber?.ctx?.directoryPicker,
    reflect: ctx.reflect?.get(SERVICE_NAME)?.name ?? null,
    name: service?.name ?? null,
    capability: typeof service?.capability,
    protoIsPicker: service !== undefined && Object.getPrototypeOf(service) === mod.DirectoryPicker.prototype,
    instanceOfPicker: service instanceof mod.DirectoryPicker,
    instanceOfService: service instanceof harness.Service,
    ownKeys: service === undefined ? [] : Object.keys(service).sort(),
  };
}

/**
 * Lớp con triển khai capability browse (hình dạng service thật của seam).
 * Nhận: mod — bên dựng lớp. Trả: lớp service.
 */
function browseClass(mod: PickerModule): PickerCtor {
  class BrowsePicker extends mod.DirectoryPicker {
    /**
     * Trả capability browse.
     * Nhận: không. Trả: { kind: "browse" }.
     */
    override capability(): { kind: string } {
      return { kind: "browse" };
    }
  }
  return BrowsePicker as unknown as PickerCtor;
}

/**
 * Lớp con có primitive browse list() — dùng để chạm DirectoryPickerError của gói.
 * Nhận: mod — bên dựng lớp. Trả: lớp service.
 */
function primitiveClass(mod: PickerModule): PickerCtor {
  class BrowsePrimitive extends mod.DirectoryPicker {
    /**
     * Trả capability browse.
     * Nhận: không. Trả: { kind: "browse" }.
     */
    override capability(): { kind: string } {
      return { kind: "browse" };
    }

    /**
     * Liệt kê một đường dẫn tuyệt đối; sai ⇒ DirectoryPickerError của chính module.
     * Nhận: path — đường dẫn cần kiểm. Trả: mảng chứa đường dẫn hợp lệ.
     */
    list(path: unknown): string[] {
      if (typeof path !== "string" || !path.startsWith("/")) {
        throw new mod.DirectoryPickerError("invalid-path", String(path), "duong dan phai TUYET DOI");
      }
      return [path];
    }
  }
  return BrowsePrimitive as unknown as PickerCtor;
}

/**
 * Chạy phép mount qua ctx.plugin rồi đo hình dạng service.
 * Nhận: harness — thế giới; mod — bên cần đo. Trả: hình dạng service.
 */
async function pluginShape(harness: Harness, mod: PickerModule): Promise<Record<string, unknown>> {
  const { ctx, fiber } = await mount(harness, mod.DirectoryPicker, { ignored: true });
  try {
    return serviceShape(harness, mod, ctx);
  } finally {
    await fiber.dispose();
  }
}

/**
 * Dựng service bằng constructor trực tiếp (đường cordis dựng Service) rồi đo.
 * Nhận: harness — thế giới; mod — bên cần đo.
 * Trả: { shape, afterDispose, instanceIsPicker }.
 */
async function directShape(harness: Harness, mod: PickerModule): Promise<Record<string, unknown>> {
  const ctx = newContext(harness);
  const instance = new mod.DirectoryPicker(ctx);
  const shape = serviceShape(harness, mod, ctx);
  await disposeContext(ctx);
  return { shape, afterDispose: typeof ctx.directoryPicker, instanceIsPicker: instance instanceof mod.DirectoryPicker };
}

/**
 * Mount lần hai trên cùng context để đo lỗi trùng service + trạng thái sau dispose.
 * Nhận: harness — thế giới; mod — bên cần đo. Trả: { duplicate, afterDispose }.
 */
async function duplicateShape(harness: Harness, mod: PickerModule): Promise<Record<string, unknown>> {
  const { ctx, fiber } = await mount(harness, mod.DirectoryPicker, {});
  const duplicate = await rejectionOf(() => ctx.plugin(mod.DirectoryPicker, {}));
  await fiber.dispose();
  return { duplicate, afterDispose: typeof ctx.directoryPicker };
}

/**
 * Mount lớp con browse rồi đo capability/instance.
 * Nhận: harness — thế giới; mod — bên cần đo. Trả: hình dạng capability.
 */
async function browseShape(harness: Harness, mod: PickerModule): Promise<Record<string, unknown>> {
  const ctor = browseClass(mod);
  const { ctx, fiber } = await mount(harness, ctor, {});
  try {
    const service = serviceOf(ctx);
    return {
      capability: service.capability?.() ?? null,
      name: service.name,
      instanceOfBrowse: service instanceof ctor,
      instanceOfPicker: service instanceof mod.DirectoryPicker,
    };
  } finally {
    await fiber.dispose();
  }
}

/**
 * Gọi primitive browse với các tham số SAI, trả hình dạng lỗi + lỗi thô.
 * Nhận: harness — thế giới; mod — bên cần đo.
 * Trả: { shapes, errors } — shapes so A/B, errors để kiểm instanceof.
 */
async function primitiveErrors(harness: Harness, mod: PickerModule): Promise<{ shapes: Record<string, unknown>[]; errors: unknown[] }> {
  const ctor = primitiveClass(mod);
  const { ctx, fiber } = await mount(harness, ctor, {});
  try {
    const service = serviceOf(ctx) as unknown as BrowsePrimitiveService;
    const shapes: Record<string, unknown>[] = [];
    const errors: unknown[] = [];
    for (const input of BAD_PATHS) {
      const result = caught(() => service.list(input));
      shapes.push({ input, ...errorShape(result.error) });
      errors.push(result.error);
    }
    return { shapes, errors };
  } finally {
    await fiber.dispose();
  }
}

/**
 * Gọi capability() trên lớp base (không có phương thức) để đo lỗi.
 * Nhận: harness — thế giới; mod — bên cần đo. Trả: hình dạng lỗi.
 */
async function baseCapabilityFailure(harness: Harness, mod: PickerModule): Promise<Record<string, unknown>> {
  const { ctx, fiber } = await mount(harness, mod.DirectoryPicker, {});
  try {
    const service = serviceOf(ctx);
    const result = caught(() => (service as unknown as { capability(): unknown }).capability());
    return result.error === undefined ? { thrown: false } : { thrown: true, ...errorShape(result.error) };
  } finally {
    await fiber.dispose();
  }
}

/**
 * Lấy thế giới A/B đã dựng; ném nếu beforeAll chưa xong.
 * Nhận: không. Trả: harness.
 */
function requireWorld(): Harness {
  if (world === undefined) throw new Error("harness A/B chua san sang");
  return world;
}

/**
 * Dựng thế giới A/B trong mkdtemp: symlink apps/host/node_modules rồi copy hai bundle.
 * Nhận: không. Trả: harness (dọn thư mục tạm bằng dispose()).
 */
async function createHarness(): Promise<Harness> {
  const root = mkdtempSync(join(tmpdir(), "gbh-host-directory-picker-ab-"));
  let ready = false;
  try {
    symlinkSync(APP_MODULES, join(root, "node_modules"), "dir");
    // 05/11/2026 (P1b): artefact cua ta require @galaxy-blackhole/* ⇒ bac farm cua repo vao the gioi tam.
    // 06/11/2026: idempotent — createHarness chạy nhiều lần trên cùng root ⇒ lần sau symlink đã tồn tại.
    if (!existsSync(join(root, "node_modules", "@galaxy-blackhole"))) {
      symlinkSync(join(REPO, "node_modules", "@galaxy-blackhole"), join(root, "node_modules", "@galaxy-blackhole"), "dir");
    }
    mkdirSync(join(root, "ours"), { recursive: true });
    mkdirSync(join(root, "stock"), { recursive: true });
    copyFileSync(OURS_ARTIFACT, join(root, "ours", "index.js"));
    copyFileSync(join(PKG, "lib", "index-entry.js"), join(root, "ours", "index-entry.js"));
    copyFileSync(STOCK_ARTIFACT, join(root, "stock", "index.js"));
    const cordis = (await import(pathToFileURL(join(root, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js")).href)) as {
      Context: new () => CtxLike;
      Service: Function;
    };
    const ours = (await import(pathToFileURL(join(root, "ours", "index.js")).href)) as unknown as PickerModule;
    const stock = (await import(pathToFileURL(join(root, "stock", "index.js")).href)) as unknown as PickerModule;
    const entry = (await import(pathToFileURL(join(root, "ours", "index-entry.js")).href)) as Record<string, unknown>;
    ready = true;
    return {
      root,
      Context: cordis.Context,
      Service: cordis.Service,
      ours,
      stock,
      entry,
      dispose: () => rmSync(root, { recursive: true, force: true }),
    };
  } finally {
    if (!ready) rmSync(root, { recursive: true, force: true });
  }
}

beforeAll(async () => {
  world = await createHarness();
});

afterAll(() => {
  world?.dispose();
  world = undefined;
});

describe("A · artefact NGUYÊN BẢN: byte · sha256 · byte · dòng", () => {
  test("ca 1 · lib/index.js TRÙNG TỪNG BYTE bản gốc + sha256 + 1.845 B + 44 dòng", () => {
    const ours = readFileSync(OURS_ARTIFACT);
    const stock = readFileSync(STOCK_ARTIFACT);
    // 05/11/2026 (P1b): artefact cua ta mang id CUA TA ⇒ so TUNG BYTE tren DANG DA CHUAN HOA id.
    const oursChuan = Buffer.from(chuanHoaHost(ours.toString("utf8")), "utf8");
    expect(oursChuan.equals(stock)).toBe(true);
    expect(sha256(oursChuan)).toBe(EXPECTED_SHA);
    expect(sha256(stock)).toBe(EXPECTED_SHA);
    expect(oursChuan.byteLength).toBe(EXPECTED_BYTES);
    expect(stock.byteLength).toBe(EXPECTED_BYTES);
    expect(statSync(OURS_ARTIFACT).size).toBeGreaterThanOrEqual(EXPECTED_BYTES);
    expect(lineCount(ours.toString("utf8"))).toBe(EXPECTED_LINES);
    expect(lineCount(stock.toString("utf8"))).toBe(EXPECTED_LINES);
    expect(statSync(STOCK_ARTIFACT).size).toBe(EXPECTED_BYTES);
  });

  test("ca 2 · lib/types/* byte-identical; index.d.ts re-export; index-entry.js (Bun.build) tồn tại và phủ đúng 3 export", () => {
    const typeFiles = ["lib/types/index.js", "lib/types/index.d.ts", "lib/types/types.js", "lib/types/types.d.ts"];
    for (const rel of typeFiles) {
      expect(existsSync(join(PKG, rel))).toBe(true);
      const ours = readFileSync(join(PKG, rel));
      const stock = readFileSync(join(STOCK_DIR, rel));
      expect(ours.equals(stock)).toBe(true);
      expect(sha256(ours)).toBe(sha256(stock));
      expect(ours.byteLength).toBe(stock.byteLength);
      expect(lineCount(ours.toString("utf8"))).toBe(lineCount(stock.toString("utf8")));
    }
    // Stock khai types thẳng trong lib/types; gói ta thêm lib/index.d.ts làm cửa re-export.
    expect(readFileSync(join(PKG, "lib", "index.d.ts"), "utf8")).toBe('export * from "./types/index.js";' + EOL);
    expect(existsSync(join(PKG, "lib", "types", "index.d.ts"))).toBe(true);
    expect(readdirSync(join(PKG, "lib")).sort()).toEqual(["index-entry.js", "index.d.ts", "index.js", "types"]);
    const harness = requireWorld();
    expect(Object.keys(harness.entry).sort()).toEqual(["DirectoryPicker", "DirectoryPickerError", "default"]);
    expect(harness.entry["default"]).toBe(harness.entry["DirectoryPicker"]);
    expect(typeof harness.entry["DirectoryPickerError"]).toBe("function");
  });
});

describe("B · id stock 1 lần ở JSDoc dòng 13 · id ta 0 lần", () => {
  test("ca 3 · đếm id: stock = 1 (dòng 13) · ta = 0 · không đổi tên", () => {
    const text = readFileSync(OURS_ARTIFACT, "utf8");
    const stockText = readFileSync(STOCK_ARTIFACT, "utf8");
    // 05/11/2026 (P1b): artefact gio mang id CUA TA ⇒ vai tro hai id doi cho nhau (cung dong 13).
    expect(lineNumbers(text, PACKAGE_NAME)).toEqual([13]);
    expect(lineNumbers(text, STOCK_ID)).toEqual([]);
    expect(lineNumbers(stockText, STOCK_ID)).toEqual([13]);
    expect(lineNumbers(stockText, PACKAGE_NAME)).toEqual([]);
    expect(text.split(PACKAGE_NAME).length - 1).toBe(1);
    expect(text.split(STOCK_ID).length - 1).toBe(0);
    expect(text.split(EOL)[12] ?? "").toContain("@module " + PACKAGE_NAME);
  });

  test("ca 4 · manifest là nguồn DUY NHẤT của id + 3 lát, khớp package.json hai bên", () => {
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-host-directory-picker");
    expect(STOCK_ID).toBe("@deepseek-ai/dsh-host-directory-picker");
    expect(PART_FILES).toEqual(["part-00-head.ts", "part-01-index.ts", "part-02-tail.ts"]);
    expect(readdirSync(join(PKG, "src", "parts")).sort()).toEqual([...PART_FILES].sort());
    expect(readJson(MANIFEST).name).toBe(PACKAGE_NAME);
    expect(readJson(join(STOCK_DIR, "package.json")).name).toBe(STOCK_ID);
  });
});

describe("C · ghép lát === artefact (src/assemble.ts của chính gói)", () => {
  test("ca 5 · assembleBundle() === lib/index.js === bundle gốc (Buffer.equals + sha256)", () => {
    const assembled = assembleBundle();
    const ours = readFileSync(OURS_ARTIFACT, "utf8");
    const stock = readFileSync(STOCK_ARTIFACT, "utf8");
    // 05/11/2026 (P1b): lat ghep la NGUYEN VAN stock; artefact mang id cua ta ⇒ so sau chuan hoa.
    expect(assembled).toBe(chuanHoaHost(ours));
    expect(assembled).toBe(stock);
    expect(assembled).toBe(assembleBundle(join(PKG, "src", "parts")));
    expect(Buffer.from(assembled, "utf8").equals(Buffer.from(stock, "utf8"))).toBe(true);
    expect(sha256(Buffer.from(assembled, "utf8"))).toBe(EXPECTED_SHA);
    expect(lineCount(assembled)).toBe(EXPECTED_LINES);
  });

  test("ca 6 · 3 lát khớp manifest, không sót dấu scaffold, mỗi lát ≤1000 dòng; thiếu header ⇒ ném", () => {
    const partsDir = join(PKG, "src", "parts");
    const rebuilt: string[] = [];
    for (const fileName of PART_FILES) {
      const text = readFileSync(join(partsDir, fileName), "utf8");
      expect(lineCount(text)).toBeLessThanOrEqual(1000);
      expect(text).toContain(SLICE_MARKER);
      expect(text.trimEnd().endsWith(MODULE_TAIL)).toBe(true);
      const body = stripSliceScaffold(text, fileName);
      expect(body.length).toBeGreaterThan(0);
      const bodyText = body.join(EOL);
      expect(bodyText).not.toContain(SLICE_MARKER);
      expect(bodyText).not.toContain("__GBH_FRAGMENT_");
      expect(bodyText).not.toContain(MODULE_TAIL);
      rebuilt.push(bodyText);
    }
    // 05/11/2026 (P1b): artefact mang id cua ta; lat ghep la nguyen van ⇒ so sau chuan hoa.
    expect(rebuilt.join(EOL)).toBe(chuanHoaHost(readFileSync(OURS_ARTIFACT, "utf8")));
    const noHeader = "// @ts-nocheck" + EOL + EOL + "noi dung" + EOL + EOL + MODULE_TAIL + EOL;
    expect(() => stripSliceScaffold(noHeader, "thieu-header.ts")).toThrow("thieu khoi header 5 dong");
    const noMarker = "/**" + EOL + " * desc x" + EOL + " */" + EOL + EOL + MODULE_TAIL + EOL;
    expect(() => stripSliceScaffold(noMarker, "thieu-dau.ts")).toThrow("khong thay dong danh dau");
  });
});

describe("D · package.json: gói THƯ VIỆN — không row, có draft/tests, exports khớp gốc", () => {
  test("ca 7 · KHÔNG gbh.row · KHÔNG gbh.row_unmounted_ly_do (Lead 19/10) · có draft + tests trỏ tệp này", () => {
    const manifest = readJson(MANIFEST);
    const gbh = manifest.gbh ?? {};
    expect(gbh.row).toBeUndefined();
    expect(gbh.row_unmounted_ly_do).toBeUndefined();
    expect("row" in gbh).toBe(false);
    expect("row_unmounted_ly_do" in gbh).toBe(false);
    expect(typeof gbh.draft).toBe("string");
    expect((gbh.draft ?? "").length).toBeGreaterThan(0);
    expect(gbh.draft ?? "").toContain("THƯ VIỆN");
    expect(gbh.tests).toEqual([TEST_REL]);
    expect(gbh.peers).toEqual(["@deepseek-ai/cordis"]);
    expect(manifest.peerDependencies?.["@deepseek-ai/cordis"]).toBeString();
    for (const rel of gbh.tests ?? []) expect(existsSync(join(REPO, rel))).toBe(true);
  });

  test("ca 8 · exports + main + type khớp TUYỆT ĐỐI bản gốc; mọi đích export tồn tại trong gói", () => {
    const ours = readJson(MANIFEST);
    const stock = readJson(join(STOCK_DIR, "package.json"));
    expect(ours.exports).toEqual(stock.exports);
    expect(Object.keys(ours.exports ?? {}).sort()).toEqual([".", "./package.json", "./src/*", "./types"]);
    expect(ours.main).toBe(stock.main);
    expect(ours.type).toBe(stock.type);
    const targets = exportTargets(ours.exports);
    expect(targets.sort()).toEqual(exportTargets(stock.exports).sort());
    for (const target of targets) {
      const resolved = join(PKG, target);
      expect(relative(PKG, resolved).startsWith("..")).toBe(false);
      expect(existsSync(resolved)).toBe(true);
    }
  });
});

describe("E · export surface A/B bằng await import()", () => {
  test("ca 9 · cùng tập export + default chính là DirectoryPicker ở CẢ HAI", () => {
    const harness = requireWorld();
    expect(moduleSurface(harness.ours)).toEqual(moduleSurface(harness.stock));
    expect(moduleSurface(harness.ours)).toEqual({
      exports: ["DirectoryPicker", "DirectoryPickerError", "default"],
      hasOwnDefault: true,
      defaultIsPicker: true,
      pickerKind: "function",
      errorKind: "function",
      errorIsError: true,
      errorName: "DirectoryPickerError",
    });
  });

  test("ca 10 · DirectoryPickerError: name/message/code/path + prototype khớp hai bên", () => {
    const harness = requireWorld();
    const ours = new harness.ours.DirectoryPickerError("invalid-path", "/tmp/x", "duong dan sai");
    const stock = new harness.stock.DirectoryPickerError("invalid-path", "/tmp/x", "duong dan sai");
    expect(errorShape(ours)).toEqual(errorShape(stock));
    expect(errorShape(ours)).toEqual({
      name: "DirectoryPickerError",
      message: "duong dan sai",
      isError: true,
      code: "invalid-path",
      path: "/tmp/x",
    });
    expect(Object.keys(ours).sort()).toEqual(["code", "name", "path"]);
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.getOwnPropertyNames(harness.ours.DirectoryPickerError.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(harness.stock.DirectoryPickerError.prototype).sort(),
    );
    expect(ours instanceof Error).toBe(true);
    expect(stock instanceof Error).toBe(true);
    const silentOurs = new harness.ours.DirectoryPickerError("x", "/y");
    const silentStock = new harness.stock.DirectoryPickerError("x", "/y");
    expect(errorShape(silentOurs)).toEqual(errorShape(silentStock));
    expect(silentOurs.message).toBe("");
    expect(silentStock.message).toBe("");
  });

  test("ca 11 · prototype cùng tập tên phương thức công khai + static + arity", () => {
    const harness = requireWorld();
    const ours = prototypeMethodNames(harness.ours.DirectoryPicker);
    const stock = prototypeMethodNames(harness.stock.DirectoryPicker);
    expect(ours).toEqual(stock);
    expect(ours).toEqual(["constructor"]);
    expect(ours).not.toContain("capability");
    expect(ours).not.toContain("browse");
    expect(Object.getOwnPropertyNames(harness.ours.DirectoryPicker).sort()).toEqual(
      Object.getOwnPropertyNames(harness.stock.DirectoryPicker).sort(),
    );
    expect(Object.getOwnPropertyNames(harness.ours.DirectoryPicker).sort()).toEqual(["length", "name", "prototype"]);
    expect(harness.ours.DirectoryPicker.length).toBe(harness.stock.DirectoryPicker.length);
    expect(harness.ours.DirectoryPicker.length).toBe(1);
    expect(Object.getPrototypeOf(harness.ours.DirectoryPicker.prototype)).toBe(
      Object.getPrototypeOf(harness.stock.DirectoryPicker.prototype),
    );
    expect(Object.getPrototypeOf(harness.ours.DirectoryPicker.prototype).constructor.name).toBe("Service");
  });
});

describe("F · hành vi trên Context cordis THẬT", () => {
  test("ca 12 · ctx.plugin(DirectoryPicker, cfg) ⇒ ctx.directoryPicker xuất hiện ở CẢ HAI", async () => {
    const harness = requireWorld();
    const ours = await pluginShape(harness, harness.ours);
    const stock = await pluginShape(harness, harness.stock);
    expect(ours).toEqual(stock);
    expect(ours).toEqual({
      root: "object",
      fiberCtx: "object",
      reflect: SERVICE_NAME,
      name: SERVICE_NAME,
      capability: "undefined",
      protoIsPicker: true,
      instanceOfPicker: true,
      instanceOfService: true,
      ownKeys: ["ctx", "name"],
    });
  });

  test("ca 13 · new DirectoryPicker(ctx) đăng ký trực tiếp như nhau; dispose gỡ service", async () => {
    const harness = requireWorld();
    const ours = await directShape(harness, harness.ours);
    const stock = await directShape(harness, harness.stock);
    expect(ours).toEqual(stock);
    expect(ours["shape"]).toEqual({
      root: "object",
      fiberCtx: "object",
      reflect: SERVICE_NAME,
      name: SERVICE_NAME,
      capability: "undefined",
      protoIsPicker: true,
      instanceOfPicker: true,
      instanceOfService: true,
      ownKeys: ["ctx", "name"],
    });
    expect(ours["instanceIsPicker"]).toBe(true);
    expect(ours["afterDispose"]).toBe("undefined");
    expect(stock["afterDispose"]).toBe("undefined");
  });

  test("ca 14 · mount lần hai ⇒ cùng name/message; dispose ⇒ service biến mất ở cả hai", async () => {
    const harness = requireWorld();
    const ours = await duplicateShape(harness, harness.ours);
    const stock = await duplicateShape(harness, harness.stock);
    expect(ours).toEqual(stock);
    expect(String(ours["duplicate"])).toBe(String(stock["duplicate"]));
    expect(String(ours["duplicate"])).toContain('service "directoryPicker" has been registered');
    expect(ours["afterDispose"]).toBe("undefined");
    expect(stock["afterDispose"]).toBe("undefined");
  });

  test("ca 15 · subclass browse: capability().kind = browse ở cả hai, cùng hình dạng", async () => {
    const harness = requireWorld();
    const ours = await browseShape(harness, harness.ours);
    const stock = await browseShape(harness, harness.stock);
    expect(ours).toEqual(stock);
    expect(ours).toEqual({
      capability: { kind: "browse" },
      name: SERVICE_NAME,
      instanceOfBrowse: true,
      instanceOfPicker: true,
    });
  });

  test("ca 16 · primitive browse với tham số SAI ⇒ DirectoryPickerError CÙNG name/message (3 đầu vào)", async () => {
    const harness = requireWorld();
    const ours = await primitiveErrors(harness, harness.ours);
    const stock = await primitiveErrors(harness, harness.stock);
    expect(ours.shapes).toEqual(stock.shapes);
    for (let index = 0; index < BAD_PATHS.length; index += 1) {
      expect(ours.shapes[index]).toEqual({
        input: BAD_PATHS[index],
        name: "DirectoryPickerError",
        message: "duong dan phai TUYET DOI",
        isError: true,
        code: "invalid-path",
        path: String(BAD_PATHS[index]),
      });
      expect(stock.shapes[index]).toEqual(ours.shapes[index]);
    }
    expect(ours.errors.every((error) => error instanceof harness.ours.DirectoryPickerError)).toBe(true);
    expect(stock.errors.every((error) => error instanceof harness.stock.DirectoryPickerError)).toBe(true);
    expect(ours.errors.every((error) => error instanceof harness.stock.DirectoryPickerError)).toBe(false);
    expect(stock.errors.every((error) => error instanceof harness.ours.DirectoryPickerError)).toBe(false);
  });

  test("ca 17 · gọi capability() trên lớp base ⇒ cùng TypeError ở cả hai", async () => {
    const harness = requireWorld();
    const ours = await baseCapabilityFailure(harness, harness.ours);
    const stock = await baseCapabilityFailure(harness, harness.stock);
    expect(ours).toEqual(stock);
    expect(ours["thrown"]).toBe(true);
    expect(ours["name"]).toBe("TypeError");
    expect(String(ours["message"])).toContain("capability");
  });
});

describe("G · client + phủ tệp test", () => {
  test("ca 18 · gói KHÔNG có dsh.client ⇒ không cần client-entry; artefact 0 lần __ModuleLoader__.load", () => {
    const manifest = readJson(MANIFEST);
    expect(manifest.dsh).toBeUndefined();
    expect("dsh" in manifest).toBe(false);
    expect(existsSync(join(PKG, "lib", "client-entry.js"))).toBe(false);
    expect(existsSync(join(PKG, "src", "client.ts"))).toBe(false);
    const text = readFileSync(OURS_ARTIFACT, "utf8");
    expect(text.split("window.__ModuleLoader__.load({").length - 1).toBe(0);
    expect(text).not.toContain("CLIENT_LOADER_SHAPE");
  });

  test("ca 19 · tệp này có ≥10 ca và gbh.tests trỏ đúng nó", () => {
    const own = readFileSync(join(REPO, TEST_REL), "utf8");
    const declared = own.match(/^ {2}test\("/gmu) ?? [];
    expect(declared.length).toBeGreaterThanOrEqual(10);
    expect(existsSync(join(REPO, TEST_REL))).toBe(true);
    expect(readJson(MANIFEST).gbh?.tests).toEqual([TEST_REL]);
  });
});
