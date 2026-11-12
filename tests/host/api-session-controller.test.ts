/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test đối chứng (A/B) cho @galaxy-blackhole/gbh-api-session-controller: 4 artefact lib
 *      (byte-identical / chuẩn hoá brand + quy id qua normalizeIdsInText), bề mặt export + package.json + khuôn loader client,
 *      service sessionController trên Context cordis THẬT với dịch vụ GIẢ, Config/inject/prototype,
 *      và các nhánh lỗi "hai bên ném CÙNG name|code|message"; API cần Agent/session THẬT thì chỉ so
 *      nhánh cùng-ném và ghi lý do ngay trong tên ca — không bịa hành vi.
 */
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { normalizeIdsInText, sameAfterIdMap } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "api-session-controller");
/** Thư mục bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-session-controller");
/** Id của ta — luật MỘT-ID của artefact. */
const OUR_ID = "@galaxy-blackhole/gbh-api-session-controller";
/** Id stock — chỉ dùng để chuẩn hoá khi so byte và đếm vết tích. */
const STOCK_ID = "@deepseek-ai/dsh-api-session-controller";
/** Id CỔNG của ta (41 ký tự) — nửa client require nó (rewrite CÓ CHỦ ĐÍCH). */
const GATEWAY_ID = "@galaxy-blackhole/gbh-host-typert-gateway";
/** Id CỔNG của bản stock (28 ký tự). */
const STOCK_GATEWAY_ID = "@deepseek-ai/dsh-api-gateway";
/** Chênh lệch độ dài id (5 ký tự) — nhân với số id cho ra chênh lệch byte. */
const ID_DELTA = OUR_ID.length - STOCK_ID.length;
/** Chênh lệch độ dài id CỔNG (13 ký tự). */
const GATEWAY_DELTA = GATEWAY_ID.length - STOCK_GATEWAY_ID.length;
/** Bốn artefact của ta. */
const OURS = {
  index: join(PKG, "lib", "index.js"),
  client: join(PKG, "lib", "client.js"),
  typertHost: join(PKG, "lib", "typert.host.js"),
  typertRemote: join(PKG, "lib", "typert.remote-client.js"),
} as const;
/** Bốn artefact của bundle gốc. */
const STOCK_FILES = {
  index: join(STOCK_PKG, "lib", "index.js"),
  client: join(STOCK_PKG, "lib", "client.js"),
  typertHost: join(STOCK_PKG, "lib", "typert.host.js"),
  typertRemote: join(STOCK_PKG, "lib", "typert.remote-client.js"),
} as const;
/** sha256 (16 ký tự đầu) của artefact ta — cổng chống trôi byte. */
const SHA_OURS = {
  // 06/11/2026 (P1b): index.js nay mang id GBH ⇒ sha đổi (đo lại trên artefact thật).
  index: "17b8cd8b647aa218",
  // 20/10/2026: nửa client đổi thêm require gateway sang id ta ⇒ sha đổi (rewrite CÓ CHỦ ĐÍCH).
  client: "b65a353c6093c6db",
  typertHost: "199eee8b94c8890d",
  typertRemote: "0104703e0a65a762",
} as const;
/** sha256 (16 ký tự đầu) của artefact gốc. */
const SHA_STOCK = {
  index: "a9801acb577b0305",
  client: "82f2301c18f0e513",
  typertHost: "0c12316ed398710b",
  typertRemote: "f8760911d70173fc",
} as const;
/** Số id ta trong từng artefact (đúng 1 / 57 / 56); index.js phải là 0. */
const OUR_ID_COUNTS = { client: 1, typertHost: 57, typertRemote: 56 } as const;
/** Số lần id CỔNG của ta trong nửa client (dòng require) — mỗi lần +13 B. */
const CLIENT_GATEWAY_IDS = 1;
/** Chênh lệch byte so với bản gốc (0 / +18 / +285 / +280). */
// P3 (04/11/2026): client.js mang them id MOI cua module ao store (+5 byte).
const BYTE_DELTAS = { index: 0, client: 23, typertHost: 290, typertRemote: 285 } as const;
/** 6 tên export đọc từ dòng export CUỐI bundle host. */
const EXPORT_NAMES = ["ApiSessionNotFound", "SessionController", "SessionFileReferences", "SessionSkillCatalog", "buildModelCatalog", "default"];
/** 12 dịch vụ mà SessionController khai ở inject tĩnh. */
const INJECT_NAMES = [
  "agentDefaultModel",
  "agents",
  "attachments",
  "fileUploads",
  "fs",
  "llm",
  "remoteAccess",
  "sessions",
  "sessionProjections",
  "sessionQuery",
  "typert",
  "workspaceRegistry",
];
/** 26 tên hàm trên prototype (gồm constructor) — đo từ bundle gốc. */
const PROTOTYPE_METHODS = [
  "attachment",
  "canOpenWorkspacePath",
  "cancel",
  "constructor",
  "control",
  "create",
  "follow",
  "fork",
  "initializeDefaultModel",
  "inspect",
  "list",
  "liveProjections",
  "modelCatalog",
  "openWorkspacePath",
  "page",
  "projections",
  "promote",
  "prompt",
  "rename",
  "resolveAgent",
  "search",
  "selectModel",
  "updateQueue",
  "verifyDesktopPath",
  "workspaceDesktop",
  "workspacePathApplications",
];
/** Thư mục mkdtemp chứa bản sao artefact để import (gói chưa link đủ peer vào node_modules riêng). */
const TEMP = mkdtempSync(join(tmpdir(), "gbh-session-controller-"));
/** Tín hiệu chưa huỷ dùng chung cho các ca A/B. */
const SIGNAL = new AbortController().signal;
/** Thư mục làm việc GIẢ cấp cho các dịch vụ giả. */
const CWD = "/tmp/gbh-session-cwd";

/** Bề mặt module (của ta hoặc gốc). */
type Api = Record<string, unknown>;

/** Bề mặt Context cordis tối thiểu mà test chạm tới. */
interface Ctx {
  /** Lấy dịch vụ theo tên (undefined khi chưa cấp). */
  get(name: string): unknown;
  /** Cấp một dịch vụ GIẢ; trả hàm rút dịch vụ. */
  provide(name: string, value: unknown): unknown;
  /** Fiber của Context — dispose để kiểm nhánh Context đã đóng. */
  readonly fiber: { readonly state?: number; dispose(): Promise<unknown> };
}

/** Schema Config kiểu schemastery: gọi được VÀ có chuẩn standard. */
interface ConfigSchema {
  /** Gọi schema để nhận cấu hình đã áp mặc định (ném ValidationError khi sai). */
  (input: unknown): Record<string, unknown>;
  /** Chuẩn validate không ném: trả { value } hoặc { issues }. */
  readonly "~standard": { validate(value: unknown): { value?: unknown; issues?: unknown } };
}

/** Hình dạng lớp SessionController mà test chạm tới. */
interface ServiceCtor {
  /** Dựng service trên Context (cordis tự đăng ký key sessionController). */
  new (ctx: unknown, config: unknown): ServiceLike;
  /** Tên lớp. */
  readonly name: string;
  /** Dịch vụ yêu cầu trước khi service chạy. */
  readonly inject: readonly string[];
  /** Schema cấu hình. */
  readonly Config: ConfigSchema;
  /** Prototype để đọc tập phương thức công khai. */
  readonly prototype: Record<string, unknown>;
}

/** Hình dạng service sessionController mà test chạm tới. */
interface ServiceLike {
  /** Tên service đã đăng ký với cordis. */
  readonly name: string;
  /** Liên kết Typert Gateway: khoá service + namespace wire. */
  readonly typertRemote: { readonly serviceKey: string; readonly namespace: string };
  /** Đọc danh sách phiên (cần sessionQuery + remoteAccess). */
  list(request: unknown, signal: AbortSignal): unknown;
  /** Tìm trong nội dung phiên (cần sessionQuery thật). */
  search(request: unknown, signal: AbortSignal): unknown;
  /** Tạo phiên mới. */
  create(request: unknown): unknown;
  /** Nhận prompt cho một phiên. */
  prompt(request: unknown, signal: AbortSignal): unknown;
  /** Đọc projection của một phiên. */
  projections(request: unknown, signal: AbortSignal): unknown;
  /** Mở luồng trạng thái sống (async generator). */
  control(signal: AbortSignal): AsyncIterable<unknown>;
}

/**
 * Băm SHA-256 một chuỗi UTF-8 hoặc một Buffer.
 * Nhận: value — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Đọc số byte của một tệp.
 * Nhận: path — đường dẫn tệp.
 * Trả: số byte trên đĩa.
 */
function bytesOf(path: string): number {
  return readFileSync(path).length;
}

/**
 * Đếm số lần một chuỗi con xuất hiện.
 * Nhận: text — chuỗi nguồn; needle — chuỗi con cần đếm.
 * Trả: số lần xuất hiện (0 khi không có).
 */
function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Đọc tên export từ dòng export CUỐI bundle.
 * Nhận: bundle — đường dẫn tệp bundle.
 * Trả: danh sách tên export đã sắp xếp (bí danh "X as default" cho ra "default").
 */
function exportNamesOf(bundle: string): string[] {
  const matches = [...readFileSync(bundle, "utf8").matchAll(/^export \{([^}]*)\};?$/gm)];
  const last = matches[matches.length - 1];
  if (last === undefined) throw new Error("bundle khong co dong export cuoi");
  return (last[1] ?? "")
    .split(",")
    .map((part) => {
      const pieces = part.trim().split(" as ");
      return (pieces.length > 1 ? pieces[1] : pieces[0])?.trim() ?? "";
    })
    .filter((name) => name.length > 0)
    .sort();
}

/**
 * Đọc package.json của một gói.
 * Nhận: path — đường dẫn package.json.
 * Trả: manifest đã parse (name + exports).
 */
function readManifest(path: string): {
  name?: string;
  exports?: Record<string, unknown>;
  dsh?: { client?: { inject?: readonly string[]; external?: readonly string[]; platform?: string } };
} {
  return JSON.parse(readFileSync(path, "utf8")) as { name?: string; exports?: Record<string, unknown> };
}

/**
 * Nạp cordis THẬT từ runtime của app.
 * Nhận: không.
 * Trả: lớp Context.
 */
async function loadCordis(): Promise<new () => unknown> {
  const mod = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"))) as {
    Context: new () => unknown;
  };
  return mod.Context;
}

/**
 * Sao artefact vào mkdtemp + symlink node_modules runtime để import được (gói chưa link đủ peer).
 * Nhận: source — artefact thật; folder — thư mục con trong TEMP.
 * Trả: đường dẫn bản sao byte-identical.
 */
function prepareBundleCopy(source: string, folder: string): string {
  const dir = join(TEMP, folder);
  mkdirSync(dir, { recursive: true });
  const copy = join(dir, "index.js");
  copyFileSync(source, copy);
  const modules = join(TEMP, "node_modules");
  if (!existsSync(modules)) {
    symlinkSync(join(REPO, "apps", "host", "node_modules"), modules, "dir");
    // 06/11/2026 (P1b): artefact cua ta nap @galaxy-blackhole/* ⇒ bac farm cua repo vao the gioi tam.
    const farm = join(modules, "@galaxy-blackhole");
    if (!existsSync(farm)) symlinkSync(join(REPO, "node_modules", "@galaxy-blackhole"), farm, "dir");
  }
  return copy;
}

/**
 * Cài dịch vụ GIẢ tối thiểu để SessionController dựng được trên Context cordis THẬT.
 * Nhận: không; cố ý KHÔNG cấp sessionQuery/remoteAccess (nhánh "dịch vụ thiếu" của ca C7).
 * Trả: Context đã cấp typert/sessionProjections/fileUploads/sessions/agents/workspaceRegistry…
 */
function makeContext(): Ctx {
  const ctx = new ContextCtor() as unknown as Ctx;
  const noop = (): void => undefined;
  const services: Record<string, unknown> = {
    typert: {
      resources: { register: noop },
      lookups: { configure: noop },
      contexts: { configureHost: noop },
    },
    sessionProjections: {
      register: noop,
      onChanged: noop,
      snapshot: () => ({ asOfSeq: 0, values: {} }),
    },
    fileUploads: { registerAgentResolver: noop },
    sessions: { get: () => undefined, list: () => [] },
    agents: { get: () => undefined, list: () => [] },
    workspaceRegistry: { archivedSessionIds: [] },
    attachments: {
      imageLimits: {
        maxImageBytes: 1,
        maxImagesPerMessage: 1,
        maxMessageImageBytes: 1,
        maxImagePixels: 1,
        maxImageDimension: 1,
        mediaTypes: [],
      },
    },
    fileReferences: { list: async () => [] },
    connection: { fetch: { register: () => () => undefined } },
    fs: {},
    workingDirectory: { defaultDirectory: CWD },
  };
  for (const [name, value] of Object.entries(services)) {
    ctx.provide(name, value);
  }
  return ctx;
}

/**
 * Dựng service sessionController của một bên trên Context cordis mới bằng export DEFAULT
 * (default === SessionController — ca B canh đẳng thức này).
 * Nhận: api — bề mặt module; config — cấu hình thô (mặc định nativeOpen=true).
 * Trả: { ctx, service } sau khi cordis đăng ký key sessionController.
 */
function mount(api: Api, config: unknown = { nativeOpen: true }): { ctx: Ctx; service: ServiceLike } {
  const ctx = makeContext();
  const service = new (api["default"] as ServiceCtor)(ctx, config);
  return { ctx, service };
}

/**
 * Chạy một lượt và ghi lại kết quả hoặc lỗi thành chuỗi so sánh được.
 * Nhận: run — hàm cần chạy (sync hoặc async).
 * Trả: "ok:<JSON>" hoặc "nem|<name>|<code>|<message>".
 */
async function outcome(run: () => unknown): Promise<string> {
  try {
    return "ok:" + JSON.stringify(await run());
  } catch (error) {
    const failure = error as Error & { code?: string };
    return ["nem", failure.name, failure.code ?? "-", failure.message].join("|");
  }
}

/**
 * Mount service của một bên rồi chạy kịch bản, gói mọi lỗi thành chuỗi.
 * Nhận: api — bề mặt module; config — cấu hình; scenario — kịch bản nhận service.
 * Trả: chuỗi kết quả/lỗi.
 */
async function outcomeWith(api: Api, config: unknown, scenario: (service: ServiceLike) => unknown): Promise<string> {
  return outcome(() => scenario(mount(api, config).service));
}

/**
 * Chạy CÙNG kịch bản trên artefact của ta và bundle gốc.
 * Nhận: config — cấu hình; scenario — kịch bản nhận service.
 * Trả: cặp [kết quả của ta, kết quả gốc].
 */
async function outcomeBoth(config: unknown, scenario: (service: ServiceLike) => unknown): Promise<[string, string]> {
  return [await outcomeWith(ours, config, scenario), await outcomeWith(stock, config, scenario)];
}

/**
 * Đọc schema Config của một bên qua chuẩn standard và validate đầu vào.
 * Nhận: api — bề mặt module; input — giá trị thô.
 * Trả: { value } khi hợp lệ, { issues } khi sai.
 */
function validateConfig(api: Api, input: unknown): { value?: unknown; issues?: unknown } {
  const holder = api["SessionController"] as ServiceCtor;
  return holder.Config["~standard"].validate(input);
}

/**
 * Gọi thẳng Config(input) của một bên (đường constructor dùng) và gói kết quả/lỗi.
 * Nhận: api — bề mặt module; input — giá trị thô.
 * Trả: "ok:<JSON>" hoặc "nem|<name>|<code>|<message>".
 */
function configOutcome(api: Api, input: unknown): string {
  try {
    return "ok:" + JSON.stringify((api["SessionController"] as ServiceCtor).Config(input));
  } catch (error) {
    const failure = error as Error & { code?: string };
    return ["nem", failure.name, failure.code ?? "-", failure.message].join("|");
  }
}

/**
 * Lấy prototype của SessionController một bên.
 * Nhận: api — bề mặt module.
 * Trả: object prototype.
 */
function prototypeOf(api: Api): Record<string, unknown> {
  return (api["SessionController"] as ServiceCtor).prototype;
}

/**
 * Liệt kê tên thuộc tính riêng trên prototype (gồm khoá marker typert-protocol).
 * Nhận: api — bề mặt module.
 * Trả: danh sách tên đã sắp xếp.
 */
function prototypeNamesOf(api: Api): string[] {
  return Object.getOwnPropertyNames(prototypeOf(api)).sort();
}

/**
 * Liệt kê tên PHƯƠNG THỨC công khai trên prototype.
 * Nhận: api — bề mặt module.
 * Trả: danh sách tên hàm đã sắp xếp.
 */
function prototypeMethodsOf(api: Api): string[] {
  const prototype = prototypeOf(api);
  return prototypeNamesOf(api).filter((name) => typeof prototype[name] === "function");
}

/**
 * Dựng service trên Context TRỐNG rồi gói lỗi thành chuỗi.
 * Nhận: api — bề mặt module.
 * Trả: chuỗi lỗi của lần dựng.
 */
async function emptyContextOutcome(api: Api): Promise<string> {
  return outcome(() => new (api["SessionController"] as ServiceCtor)(new ContextCtor(), { nativeOpen: true }));
}

/**
 * Dựng Context GIẢ rồi dispose, sau đó thử dựng service — gói lỗi thành chuỗi.
 * Nhận: api — bề mặt module.
 * Trả: chuỗi lỗi của lần dựng sau dispose.
 */
async function disposedContextOutcome(api: Api): Promise<string> {
  return outcome(async () => {
    const ctx = makeContext();
    await ctx.fiber.dispose();
    new (api["SessionController"] as ServiceCtor)(ctx, { nativeOpen: true });
  });
}

/** Lớp Context cordis THẬT của runtime app. */
const ContextCtor = await loadCordis();
/** Bản sao artefact host trong mkdtemp (byte-identical — ca A5 canh). */
const OURS_COPY = prepareBundleCopy(OURS.index, "ours");
/** Bề mặt artefact của ta (nạp từ bản sao). */
const ours = (await import(OURS_COPY)) as Api;
/** Bề mặt bundle gốc (nạp tại chỗ — CHỈ ĐỌC). */
const stock = (await import(STOCK_FILES.index)) as Api;

afterAll(() => {
  rmSync(TEMP, { recursive: true, force: true });
});

describe("artefact: 4 tệp lib so với bundle gốc", () => {
  test("index.js: byte-identical SAU KHI chuan hoa sai khac co chu y (loc phien da xoa)", async () => {
    // 01/11/2026: goi nay co MOT sai khac co chu y — `list()` bo qua phien con song nhung nhat ky da bi
    // xoa (loi nguoi dung: xoa phien xong van thay trong danh sach). build.ts cong bo DEVIATION; o day
    // chuan hoa DUNG phep thay the do roi moi so byte, nho vay moi sai khac KHAC van bi bat.
    const { DEVIATION } = (await import(join(PKG, "build.ts"))) as { DEVIATION: { ourBlock: string; stockBlock: string } };
    const built = Buffer.from(readFileSync(OURS.index, "utf8").split(DEVIATION.ourBlock).join(DEVIATION.stockBlock), "utf8");
    const original = readFileSync(STOCK_FILES.index);
    // 06/11/2026 (P1b): artefact mang id CUA TA ⇒ so tung byte tren dang da chuan hoa id.
    expect(Buffer.from(chuanHoaHost(built.toString("utf8")), "utf8").equals(original)).toBe(true);
    // 06/11/2026 (P1b): bo so byte THO (id dai hon ⇒ lech); phép so co nghia la phép chuẩn hoá ở trên.
    expect(Buffer.compare(built, original)).toBeGreaterThanOrEqual(0);
    // 06/11/2026 (P1b): sha tren dang da chuan hoa id.
    expect(sha256(chuanHoaHost(built.toString("utf8")))).toBe(sha256(original));
    // 06/11/2026 (P1b): SHA của TA tính trên artefact THẬT (đã đổi id).
    expect(sha256(readFileSync(OURS.index, "utf8")).slice(0, 16)).toBe(SHA_OURS.index);
    expect(sha256(original).slice(0, 16)).toBe(SHA_STOCK.index);
    // Kich thuoc: artefact THAT to hon stock dung phan chen cua DEVIATION; sau chuan hoa phai bang.
    const rawBuilt = readFileSync(OURS.index, "utf8");
    expect(rawBuilt.includes(DEVIATION.ourBlock)).toBe(true);
    // 06/11/2026 (P1b): kích thước thật = stock + chênh DEVIATION + chênh do id dài hơn ⇒ so SAU chuẩn hoá.
    // 06/11/2026 (P1b): artefact mang id GBH (dài hơn id stock) nên LỚN HƠN bản gốc; đẳng thức byte đã kiểm ở trên.
    expect(Buffer.byteLength(readFileSync(OURS.index, "utf8"))).toBeGreaterThan(bytesOf(STOCK_FILES.index));
    expect(bytesOf(STOCK_FILES.index)).toBe(132150);
    // Bản gốc tự nhắc id stock đúng 1 lần (chú thích module); artefact KHÔNG mang id ta.
    // 06/11/2026 (P1b): artefact mang id TA ⇒ đếm trên dạng chuẩn hoá (vẫn đúng 1 id stock trong chú thích).
    expect(countOf(chuanHoaHost(built.toString("utf8")), STOCK_ID)).toBe(1);
    // 06/11/2026 (P1b): artefact mang id TA ⇒ đảo vai trò: có id ta, không còn id stock trần ngoài chú thích.
    expect(countOf(readFileSync(OURS.index, "utf8"), OUR_ID)).toBeGreaterThan(0);
  });

  test("client.js: chuẩn hoá brand + quy id ta→stock ⇒ byte-identical, đúng 1 id ta + 1 id gateway, 0 id stock, +18 byte", () => {
    const built = readFileSync(OURS.client, "utf8");
    const original = readFileSync(STOCK_FILES.client, "utf8");
    // 20/10/2026 — nửa client nay mang NHIỀU id ta (module + require gateway) ⇒ quy bằng bản đồ 566 id,
    // áp cho CẢ HAI VẾ rồi mới so byte/sha.
    const normalized = normalizeIdsInText(built);
    const originalNormalized = normalizeIdsInText(original);
    expect(Buffer.from(normalized, "utf8").equals(Buffer.from(originalNormalized, "utf8"))).toBe(true);
    expect(sha256(normalized)).toBe(sha256(originalNormalized));
    expect(countOf(built, OUR_ID)).toBe(OUR_ID_COUNTS.client);
    expect(countOf(built, GATEWAY_ID + "/client")).toBe(CLIENT_GATEWAY_IDS);
    expect(countOf(built, STOCK_ID)).toBe(0);
    expect(countOf(built, STOCK_GATEWAY_ID)).toBe(0);
    expect(bytesOf(OURS.client) - bytesOf(STOCK_FILES.client)).toBe(BYTE_DELTAS.client);
    // P3: cong them 5 byte cua id store moi.
    expect(OUR_ID_COUNTS.client * ID_DELTA + CLIENT_GATEWAY_IDS * GATEWAY_DELTA + 5).toBe(BYTE_DELTAS.client);
    expect(sha256(built).slice(0, 16)).toBe(SHA_OURS.client);
    expect(sha256(original).slice(0, 16)).toBe(SHA_STOCK.client);
  });

  test("typert.host.js: chuẩn hoá ⇒ byte-identical, 57 id ta, 0 id stock, +290 byte", () => {
    const built = readFileSync(OURS.typertHost, "utf8");
    const original = readFileSync(STOCK_FILES.typertHost, "utf8");
    const normalized = normalizeIdsInText(built);
    const originalNormalized = normalizeIdsInText(original);
    expect(Buffer.from(normalized, "utf8").equals(Buffer.from(originalNormalized, "utf8"))).toBe(true);
    expect(sha256(normalized)).toBe(sha256(originalNormalized));
    expect(countOf(built, OUR_ID)).toBe(OUR_ID_COUNTS.typertHost);
    expect(countOf(built, STOCK_ID)).toBe(0);
    expect(bytesOf(OURS.typertHost) - bytesOf(STOCK_FILES.typertHost)).toBe(BYTE_DELTAS.typertHost);
    // P3 (04/11/2026): header typert mang id MOI (+5 byte) nam ngoai phep dem id goi.
    expect(OUR_ID_COUNTS.typertHost * ID_DELTA + 5).toBe(BYTE_DELTAS.typertHost);
    expect(sha256(built).slice(0, 16)).toBe(SHA_OURS.typertHost);
    expect(sha256(original).slice(0, 16)).toBe(SHA_STOCK.typertHost);
  });

  test("typert.remote-client.js: chuẩn hoá ⇒ byte-identical, 56 id ta, 0 id stock, +285 byte", () => {
    const built = readFileSync(OURS.typertRemote, "utf8");
    const original = readFileSync(STOCK_FILES.typertRemote, "utf8");
    const normalized = normalizeIdsInText(built);
    const originalNormalized = normalizeIdsInText(original);
    expect(Buffer.from(normalized, "utf8").equals(Buffer.from(originalNormalized, "utf8"))).toBe(true);
    expect(sha256(normalized)).toBe(sha256(originalNormalized));
    expect(countOf(built, OUR_ID)).toBe(OUR_ID_COUNTS.typertRemote);
    expect(countOf(built, STOCK_ID)).toBe(0);
    expect(bytesOf(OURS.typertRemote) - bytesOf(STOCK_FILES.typertRemote)).toBe(BYTE_DELTAS.typertRemote);
    // P3 (04/11/2026): header typert mang id MOI (+5 byte) nam ngoai phep dem id goi.
    expect(OUR_ID_COUNTS.typertRemote * ID_DELTA + 5).toBe(BYTE_DELTAS.typertRemote);
    expect(sha256(built).slice(0, 16)).toBe(SHA_OURS.typertRemote);
    expect(sha256(original).slice(0, 16)).toBe(SHA_STOCK.typertRemote);
  });

  test("bản sao nạp để chạy hành vi (mkdtemp) trùng từng byte artefact thật", () => {
    const copy = readFileSync(OURS_COPY);
    const real = readFileSync(OURS.index);
    expect(copy.equals(real)).toBe(true);
    expect(sha256(copy)).toBe(sha256(real));
    expect(bytesOf(OURS_COPY)).toBe(bytesOf(OURS.index));
  });
});

describe("bề mặt export A/B", () => {
  test("danh sách tên export từ dòng export cuối bundle trùng nhau + khớp module thật", () => {
    const ourNames = exportNamesOf(OURS.index);
    const theirNames = exportNamesOf(STOCK_FILES.index);
    expect(ourNames).toEqual(theirNames);
    expect(ourNames).toEqual(EXPORT_NAMES.slice().sort());
    expect(Object.keys(ours).sort()).toEqual(ourNames);
    expect(Object.keys(stock).sort()).toEqual(theirNames);
    expect(ours["default"]).toBe(ours["SessionController"]);
    expect(stock["default"]).toBe(stock["SessionController"]);
    expect(typeof ours["SessionController"]).toBe("function");
    expect(typeof stock["SessionController"]).toBe("function");
  });

  test("package.json exports khớp bản gốc ở MỌI mục (đã bổ sung ./remote-events + ./locale/*.json)", () => {
    const ourManifest = readManifest(join(PKG, "package.json"));
    const stockManifest = readManifest(join(STOCK_PKG, "package.json"));
    expect(ourManifest.name).toBe(OUR_ID);
    expect(stockManifest.name).toBe(STOCK_ID);
    // 19/10/2026 — ĐÃ BỔ SUNG ./remote-events (trỏ vào lib/types/remote-events.js có sẵn trong cây kiểu chép từ gốc)
    // và ./locale/*.json (chép locale/en.json + zh.json của gốc) ⇒ khớp TOÀN BỘ bản gốc, không còn delta.
    // 08/11/2026 (Lead chốt chính sách types): CÓ `lib/types/index.d.ts` thì giữ `./lib/types/index.d.ts` (khớp stock,
    // test pin pass); CHỈ khi thiếu tệp đó mới dùng `./src/index.ts`. Gói này CÓ lib/types ⇒ kỳ vọng là lib/types.
    // Vẫn chuẩn hoá khoá `types` của HAI bên về cùng một dạng trước khi so phần còn lại của exports.
    const normalized = (manifest: { exports?: Record<string, unknown> }): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(manifest.exports ?? {})) {
        out[key] =
          value !== null && typeof value === "object" && "types" in (value as Record<string, unknown>)
            ? { ...(value as Record<string, unknown>), types: "<types>" }
            : value;
      }
      return out;
    };
    expect(normalized(ourManifest)).toEqual(normalized(stockManifest));
    expect((ourManifest.exports?.["."] as { types?: string } | undefined)?.types).toBe("./lib/types/index.d.ts");
    expect(ourManifest.exports?.["./remote-events"]).toBeDefined();
    expect(ourManifest.exports?.["./locale/*.json"]).toBeDefined();
  });

  // 19/10/2026 — CA CHỐNG HỒI QUY (sự cố thật khi boot-smoke): thiếu `dsh.client` thì client-modules KHÔNG đưa nửa client
  // vào bảng web ⇒ không ai `provide("sessions")` ⇒ 58 entry client pending ⇒ #root 6.402. Vì vậy gói HAI MẶT bắt buộc
  // phải khai `dsh.client` KHỚP bản gốc (inject/external/platform) và phải có export `./client`.
  test("gói hai mặt: package.json có dsh.client KHỚP bản gốc + export ./client (chống hồi quy sự cố 58 entry pending)", () => {
    const ourManifest = readManifest(join(PKG, "package.json"));
    const stockManifest = readManifest(join(STOCK_PKG, "package.json"));
    // 20/10/2026: `dsh.client.inject/external` nay trỏ id CỦA TA (rewrite có chủ đích để bỏ dần id stock khỏi
    // payload) ⇒ so SAU KHI quy đổi id (đối xứng), giữ nguyên thứ tự + độ dài; platform/immediately vẫn so khắt khe.
    expect(sameAfterIdMap(ourManifest.dsh, stockManifest.dsh)).toBe(true);
    expect(ourManifest.dsh?.client?.platform).toBe("web");
    expect((ourManifest.dsh?.client?.inject ?? []).length).toBeGreaterThan(0);
    expect(ourManifest.exports?.["./client"]).toEqual(stockManifest.exports?.["./client"]);
  });

  test("src/client.ts khai CLIENT_LOADER_SHAPE chứa id ta; lib/client-entry.js tồn tại và khai cùng khuôn", async () => {
    const entryPath = join(PKG, "lib", "client-entry.js");
    expect(existsSync(entryPath)).toBe(true);
    const source = (await import(join(PKG, "src", "client.ts"))) as { CLIENT_LOADER_SHAPE?: unknown };
    const entry = (await import(entryPath)) as { CLIENT_LOADER_SHAPE?: unknown };
    expect(typeof source.CLIENT_LOADER_SHAPE).toBe("string");
    expect(source.CLIENT_LOADER_SHAPE).toBe(entry.CLIENT_LOADER_SHAPE);
    expect(source.CLIENT_LOADER_SHAPE).toContain(OUR_ID);
    expect(source.CLIENT_LOADER_SHAPE).not.toContain(STOCK_ID);
    const clientText = readFileSync(OURS.client, "utf8");
    expect(clientText).toContain('id: "' + OUR_ID + '"');
    expect(clientText).not.toContain(STOCK_ID);
  });
});

describe("service sessionController trên Context cordis THẬT", () => {
  test("new SessionController(ctx, config) ⇒ ctx.sessionController xuất hiện ở cả hai bên", () => {
    const our = mount(ours);
    const their = mount(stock);
    expect(typeof our.ctx.get("sessionController")).toBe("object");
    expect(typeof their.ctx.get("sessionController")).toBe("object");
    expect(our.ctx.get("sessionController")).not.toBeUndefined();
    expect(their.ctx.get("sessionController")).not.toBeUndefined();
    expect((our.ctx.get("sessionController") as ServiceLike).name).toBe("sessionController");
    expect((their.ctx.get("sessionController") as ServiceLike).name).toBe("sessionController");
    expect(our.service).toBeDefined();
    expect(their.service).toBeDefined();
  }, 30_000);

  test("cùng tên service sessionController + cùng namespace session", () => {
    const our = mount(ours);
    const their = mount(stock);
    expect(our.service.name).toBe(their.service.name);
    expect(our.service.name).toBe("sessionController");
    expect(our.service.typertRemote.serviceKey).toBe(their.service.typertRemote.serviceKey);
    expect(our.service.typertRemote.serviceKey).toBe("sessionController");
    expect(our.service.typertRemote.namespace).toBe(their.service.typertRemote.namespace);
    expect(our.service.typertRemote.namespace).toBe("session");
  }, 30_000);

  test("Config validate({}) cho cùng mặc định listWorkSliceMs:16 (nativeOpen vắng mặt)", () => {
    const our = validateConfig(ours, {});
    const their = validateConfig(stock, {});
    expect(our.issues).toBeUndefined();
    expect(their.issues).toBeUndefined();
    expect(JSON.stringify(our.value)).toBe(JSON.stringify(their.value));
    const value = our.value as Record<string, unknown>;
    expect(value["listWorkSliceMs"]).toBe(16);
    expect("nativeOpen" in value).toBe(false);
    expect(configOutcome(ours, { nativeOpen: true })).toBe(configOutcome(stock, { nativeOpen: true }));
    expect(configOutcome(ours, { nativeOpen: true })).toBe('ok:{"nativeOpen":true,"listWorkSliceMs":16}');
    expect(configOutcome(ours, { nativeOpen: false, listWorkSliceMs: 4 })).toBe(configOutcome(stock, { nativeOpen: false, listWorkSliceMs: 4 }));
    expect(configOutcome(ours, { nativeOpen: false, listWorkSliceMs: 4 })).toBe('ok:{"nativeOpen":false,"listWorkSliceMs":4}');
    expect(configOutcome(ours, null)).toBe(configOutcome(stock, null));
  });

  test("Config validate vài giá trị sai cho cùng issues", () => {
    const invalid: unknown[] = [
      { nativeOpen: "yes" },
      { listWorkSliceMs: 0 },
      { listWorkSliceMs: 16.5 },
      { listWorkSliceMs: -3 },
      { listWorkSliceMs: "x" },
      "khong-phai-object",
    ];
    for (const input of invalid) {
      const our = validateConfig(ours, input);
      const their = validateConfig(stock, input);
      expect(our.value).toBeUndefined();
      expect(their.value).toBeUndefined();
      expect(JSON.stringify(our.issues)).toBe(JSON.stringify(their.issues));
      expect(JSON.stringify(our.issues)).toContain("expected");
    }
  });

  test("prototype cùng tập tên + 26 phương thức công khai", () => {
    expect(prototypeNamesOf(ours)).toEqual(prototypeNamesOf(stock));
    expect(prototypeNamesOf(ours)).toContain("@deepseek-ai/dsh-typert-protocol/remote-methods");
    expect(prototypeMethodsOf(ours)).toEqual(prototypeMethodsOf(stock));
    expect(prototypeMethodsOf(ours)).toEqual(PROTOTYPE_METHODS);
    for (const name of ["list", "search", "create", "selectModel", "rename", "prompt", "page", "follow", "projections", "control"]) {
      expect(prototypeMethodsOf(ours)).toContain(name);
    }
  });

  test("static inject trùng mảng 12 dịch vụ", () => {
    const our = (ours["SessionController"] as ServiceCtor).inject;
    const their = (stock["SessionController"] as ServiceCtor).inject;
    expect(JSON.stringify(our)).toBe(JSON.stringify(their));
    expect([...our]).toEqual(INJECT_NAMES);
    expect((ours["SessionController"] as ServiceCtor).name).toBe((stock["SessionController"] as ServiceCtor).name);
  });

  test("cùng ném: search khi THIẾU dịch vụ sessionQuery ⇒ cùng RemoteError gateway/internal (không dựng nổi session-query THẬT)", async () => {
    const [our, their] = await outcomeBoth({ nativeOpen: true }, (service) => service.search({ query: "x" }, SIGNAL));
    // 06/11/2026 (P1b): thông điệp lỗi nêu TÊN GÓI ⇒ chuẩn hoá id trước khi so.
    expect(chuanHoaHost(String(our))).toBe(chuanHoaHost(String(their)));
    expect(our).toContain("nem|RemoteError|gateway/internal|");
    expect(chuanHoaHost(String(our))).toContain("session search is unavailable: this deployment does not mount @deepseek-ai/dsh-session-query");
  }, 30_000);

  test("control(signal) trên Context chưa có phiên ⇒ cùng khung baseline (cần Agent THẬT để đi xa hơn)", async () => {
    const [our, their] = await outcomeBoth({ nativeOpen: true }, async (service) => {
      const iterator = service.control(SIGNAL)[Symbol.asyncIterator]();
      const first = await iterator.next();
      await iterator.return?.(undefined);
      return [first.value];
    });
    expect(our).toBe(their);
    expect(our).toContain('"type":"baseline"');
    expect(our).toContain('"projections":{}');
  }, 30_000);
});

describe("nhánh lỗi: hai bên ném CÙNG name|code|message", () => {
  test("Context TRỐNG ⇒ cùng TypeError (cần typert/sessionProjections THẬT nên không dựng nổi dịch vụ)", async () => {
    const our = await emptyContextOutcome(ours);
    const their = await emptyContextOutcome(stock);
    expect(our).toBe(their);
    expect(our).toContain("nem|TypeError|-|");
    expect(our).toContain("ctx.typert.resources");
  }, 30_000);

  test("Context đã dispose ⇒ cùng TypeError; Context còn sống vẫn mount được", async () => {
    const our = await disposedContextOutcome(ours);
    const their = await disposedContextOutcome(stock);
    expect(our).toBe(their);
    expect(our).toContain("nem|TypeError|-|");
    expect(our).toContain("ctx.typert.resources");
    // Đối chứng: CÙNG bộ dịch vụ giả nhưng chưa dispose thì service dựng được — lỗi đến từ dispose.
    const live = mount(ours);
    expect(live.service.name).toBe("sessionController");
    expect(typeof live.ctx.get("sessionController")).toBe("object");
  }, 30_000);

  test("config sai kiểu (string/number/boolean) ⇒ cùng ValidationError", async () => {
    for (const bad of ["khong-phai-object", 42, true]) {
      const our = await outcome(() => new (ours["SessionController"] as ServiceCtor)(makeContext(), bad));
      const their = await outcome(() => new (stock["SessionController"] as ServiceCtor)(makeContext(), bad));
      expect(our).toBe(their);
      expect(our).toContain("nem|ValidationError|-|expected object but got");
    }
  }, 30_000);

  test("create(null) ⇒ cùng TypeError; create(workspaceId + cwd) ⇒ cùng RemoteError gateway/bad-request", async () => {
    const [ourNull, theirNull] = await outcomeBoth({ nativeOpen: true }, (service) => service.create(null));
    expect(ourNull).toBe(theirNull);
    expect(ourNull).toContain("nem|TypeError|-|null is not an object");
    const [ourBoth, theirBoth] = await outcomeBoth({ nativeOpen: true }, (service) => service.create({ workspaceId: "w1", cwd: CWD }));
    expect(ourBoth).toBe(theirBoth);
    expect(ourBoth).toContain("nem|RemoteError|gateway/bad-request|");
    expect(ourBoth).toContain("session.create accepts workspaceId or cwd, not both");
  }, 30_000);

  test("prompt rỗng + projections(sessionId rỗng) ⇒ cùng RemoteError gateway/bad-request", async () => {
    const [our, their] = await outcomeBoth({ nativeOpen: true }, async (service) => {
      const collected: string[] = [];
      const runs = [() => service.prompt({ content: [] }, SIGNAL), () => service.projections({ sessionId: "" }, SIGNAL)];
      for (const run of runs) {
        try {
          await run();
          collected.push("khong-nem");
        } catch (error) {
          const failure = error as Error & { code?: string };
          collected.push([failure.name, failure.code ?? "-", failure.message].join("|"));
        }
      }
      return collected;
    });
    expect(our).toBe(their);
    expect(our).toContain("prompt content must include non-whitespace text or an attachment");
    expect(our).toContain("sessionId must not be empty");
    expect(our).toContain("gateway/bad-request");
  }, 30_000);
});
