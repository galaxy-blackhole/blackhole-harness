/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-harness-dev-context: đối chứng TRỰC TIẾP với chính
 *      bundle gốc (@deepseek-ai/dsh-harness-dev-context) trên cùng một giàn giả — mọi ca chạy CẢ
 *      HAI bên rồi so từng lượt đăng ký, từng câu prompt, từng bước gộp chiếu; cộng ca tập export
 *      đo trên ARTIFACT, ca C6 (danh tính) và quy ước gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/harness-dev-context/build.ts";
import { apply, inject, name } from "../../packages/host/harness-dev-context/src/index.ts";
import { brandNeutral, brandToGbh } from "../lib/brand-neutral.ts";
import { DIST_READ_NAMES, normalizeBrand } from "../lib/brand-parity.ts";

/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-harness-dev-context/lib/index.js";

/** Gói của ta trên đĩa — nguồn của manifest cho ca peer/canh. */
const PKG = join(import.meta.dir, "..", "..", "packages", "host", "harness-dev-context");

/** Gốc repo, tính từ vị trí file test (`tests/host/`). */
const REPO = join(import.meta.dir, "..", "..");

/** Đường dẫn tuyệt đối tới artifact bản gốc. */
const STOCK_PATH = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-harness-dev-context", "lib", "index.js");

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as { name: string; inject: string[]; apply: (ctx: unknown) => void };

/** Văn bản của một mục prompt: chuỗi tĩnh, hoặc hàm dựng theo ngữ cảnh render. */
type PromptText = string | ((context: PromptContextLike) => string);

/** Ngữ cảnh render mà seam `systemPrompt` đưa vào hàm `text`. */
interface PromptContextLike {
  /** Agent đang chạy (nếu có). */
  agent?: { session?: unknown };
}

/** Hai đoạn văn mang giá trị của system prompt mới nhất mà phiên đã nhận. */
interface LegacyPrompt {
  /** Đoạn mang checkout triển khai. */
  source: string | null;
  /** Đoạn mang URL Web GUI. */
  web: string | null;
}

/** Một mục prompt/dòng context đã đăng ký, như giàn ghi lại. */
interface Registration {
  /** Tên mục. */
  name: string;
  /** Thứ tự dựng. */
  order: number;
  /** Cờ giữ nguyên văn. */
  interpolate?: boolean;
  /** Văn bản hoặc hàm dựng văn bản. */
  text: PromptText;
}

/** Một định nghĩa đơn vị chiếu đã đăng ký, như giàn ghi lại. */
interface Projection {
  /** Khoá chiếu. */
  key: string;
  /** Phiên bản trạng thái. */
  stateVersion: number;
  /** Schema kiểm trạng thái đã lưu. */
  stateSchema: { parse(value: unknown): LegacyPrompt };
  /** Trạng thái cho log rỗng. */
  init(header?: unknown, inheritedEventCount?: number): LegacyPrompt;
  /** Phép gộp thuần. */
  apply(state: LegacyPrompt, event: PromptEvent): LegacyPrompt;
}

/** Một sự kiện phiên mà phép gộp đọc. */
interface PromptEvent {
  /** Loại sự kiện. */
  type: string;
  /** Dữ liệu mang theo. */
  data: { message?: { content: { type: string; text: string }[] } };
}

/** Bảng vị trí trung tâm mà seam `systemPrompt` của giàn trả về. */
interface OrderTables {
  /** Vị trí mục prompt theo tên ổn định. */
  sectionOrders: Record<string, number>;
  /** Vị trí dòng context theo tên ổn định. */
  contextOrders: Record<string, number>;
  /** URL mà `webApp.getAdvertisedUrl()` trả về. */
  url: string;
}

/** Giàn giả tối thiểu nhưng ĐÚNG hình dạng seam thật: mọi đăng ký được ghi, trạng thái được ĐIỀU KHIỂN. */
interface Harness {
  /** Context đưa cho `apply`. */
  ctx: unknown;
  /** Các mục prompt đã đăng ký. */
  sections: Registration[];
  /** Các dòng runtime context đã đăng ký. */
  contexts: Registration[];
  /** Các đơn vị chiếu đã đăng ký. */
  projections: Projection[];
  /** Nhật ký tên đã hỏi vị trí, theo thứ tự gọi. */
  orderQueries: string[];
  /** Mở một phiên: mồi trạng thái `init` cho mọi đơn vị chiếu. */
  open(): object;
  /** Gộp một sự kiện đã cam kết vào MỌI đơn vị chiếu của phiên. */
  commit(session: object, event: PromptEvent): void;
  /** Đọc trạng thái hiện tại của một khoá chiếu cho một phiên. */
  stateOf(session: object, key: string): LegacyPrompt | undefined;
}

/**
 * Dựng một giàn giả dùng chung được cho CẢ bản của ta lẫn bản gốc.
 * Nhận: bảng vị trí + URL (mặc định giống bảng thật của kernel).
 * Trả: giàn với ba seam, mỗi đăng ký được ghi lại và trạng thái chiếu điều khiển được.
 */
function harness(overrides: Partial<OrderTables> = {}): Harness {
  const tables: OrderTables = {
    sectionOrders: { HARNESS_SOURCE: 10_000, WEB_SURFACE: 10_100 },
    contextOrders: { HARNESS_SOURCE: 200, WEB_SURFACE: 210 },
    url: "http://127.0.0.1:55440/?token=lab",
    ...overrides,
  };
  const sections: Registration[] = [];
  const contexts: Registration[] = [];
  const projections: Projection[] = [];
  const orderQueries: string[] = [];
  const states = new Map<object, Map<string, LegacyPrompt>>();
  const ctx = {
    systemPrompt: {
      section(section: Registration): unknown {
        // Seam THẬT ném khi order không hữu hạn — giữ đúng để bắt tên vị trí sai.
        if (!Number.isFinite(section.order)) throw new TypeError("prompt section \"" + section.name + "\" order must be a finite number");
        sections.push(section);
        return () => undefined;
      },
      context(entry: Registration): unknown {
        if (!Number.isFinite(entry.order)) throw new TypeError("prompt context \"" + entry.name + "\" order must be a finite number");
        contexts.push(entry);
        return () => undefined;
      },
      getSectionOrder(order: string): number {
        orderQueries.push("section:" + order);
        return tables.sectionOrders[order] as number;
      },
      getContextOrder(order: string): number {
        orderQueries.push("context:" + order);
        return tables.contextOrders[order] as number;
      },
    },
    sessionProjections: {
      register(definition: Projection): unknown {
        // Seam THẬT ném khi stateVersion không phải số nguyên an toàn ≥ 0.
        if (!Number.isSafeInteger(definition.stateVersion) || definition.stateVersion < 0) {
          throw new Error("session projection " + JSON.stringify(definition.key) + " stateVersion must be a non-negative integer");
        }
        projections.push(definition);
        return () => undefined;
      },
      stateOf(session: object, key: string): LegacyPrompt | undefined {
        return states.get(session)?.get(key);
      },
    },
    webApp: { getAdvertisedUrl: (): string => tables.url },
  };
  return {
    ctx,
    sections,
    contexts,
    projections,
    orderQueries,
    open(): object {
      const session = {};
      const cell = new Map<string, LegacyPrompt>();
      for (const definition of projections) cell.set(definition.key, definition.init({}, 0));
      states.set(session, cell);
      return session;
    },
    commit(session: object, event: PromptEvent): void {
      const cell = states.get(session);
      if (cell === undefined) throw new Error("phiên chưa mở");
      for (const definition of projections) {
        cell.set(definition.key, definition.apply(cell.get(definition.key) as LegacyPrompt, event));
      }
    },
    stateOf(session: object, key: string): LegacyPrompt | undefined {
      return states.get(session)?.get(key);
    },
  };
}

/** Cài một bản plugin lên giàn mới. */
function install(plugin: (ctx: unknown) => void, tables: Partial<OrderTables> = {}): Harness {
  const rig = harness(tables);
  plugin(rig.ctx);
  return rig;
}

/** Dựng văn bản của một đăng ký theo ngữ cảnh render. */
function render(registration: Registration, context: PromptContextLike): string {
  return typeof registration.text === "function" ? registration.text(context) : registration.text;
}

/**
 * Quy văn bản prompt của TA về nhãn GỐC để so NGUYÊN VĂN: brand + token `__GBH_`→`__DSH_`, RIÊNG 4 tên vỏ
 * dist cũng quy về tên DSH vì đây là VĂN BẢN prompt (không phải byte dist — dist của ta đọc `__GBH_BOOT__`,
 * xem tests/host/boot.test.ts). Dùng helper chung; chỉ THÊM phép quy 4 tên vỏ, không chép lại logic brand.
 * Nhận: text — câu prompt/section. Trả: văn bản đã chuẩn hoá (gọi được cho CẢ HAI vế).
 */
function promptNeutral(text: string): string {
  let out = normalizeBrand(text);
  for (const name of DIST_READ_NAMES) out = out.split(name).join(name.replace("__GBH_", "__DSH_"));
  return brandNeutral(out);
}

/**
 * Chiều NGƯỢC của promptNeutral: nhãn GỐC → nhãn TA cho VĂN BẢN prompt (gồm cả 4 tên vỏ dist).
 * Nhận: text — prompt lấy từ bundle gốc. Trả: prompt phiên bản GBH để nạp cho bản cài của ta.
 */
function promptToGbh(text: string): string {
  let out = brandToGbh(text);
  for (const name of DIST_READ_NAMES) out = out.split(name.replace("__GBH_", "__DSH_")).join(name);
  return out;
}



/** Ảnh chụp phần KHAI BÁO của mọi đăng ký (không phụ thuộc giá trị đường dẫn của từng bản cài). */
function declarationTrace(rig: Harness): unknown {
  return {
    orderQueries: rig.orderQueries,
    sections: rig.sections.map((section) => ({ name: section.name, order: section.order, interpolate: section.interpolate })),
    contexts: rig.contexts.map((entry) => ({ name: entry.name, order: entry.order, interpolate: entry.interpolate })),
    projections: rig.projections.map((definition) => ({ key: definition.key, stateVersion: definition.stateVersion })),
  };
}

/** Một sự kiện `system/message` mang đúng một khối văn bản. */
function systemMessage(text: string): PromptEvent {
  return { type: "system/message", data: { message: { content: [{ type: "text", text }] } } };
}

/** Tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng). */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Hình dạng tối thiểu của manifest mà các phép kiểm cần đọc. */
interface Manifest {
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Metadata của ta (lượt này CHƯA khai `row`). */
  gbh?: { peers?: string[]; row?: unknown };
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import`).
 * Nhận: không.
 * Trả: manifest đã ép kiểu.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — peerDependencies thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/** Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật. */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-harness-dev-context-")));
    const text = readFileSync(artifact, "utf8");
    const ours = exportNames(text);
    const theirs = exportNames(readFileSync(STOCK_PATH, "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual(["apply", "inject", "name"]);
    expect(ours).not.toContain("default");
    // Row host-only: bundle KHÔNG được đăng ký id module nào của gói gốc (điều kiện nghiệm thu).
    expect(text.match(/id: @deepseek-ai/g)?.length ?? 0).toBe(0);
  });

  test("name · inject khớp bản gốc từng chữ", () => {
    expect(name).toBe(stock.name);
    expect(name).toBe("harness-dev-context");
    expect(inject).toEqual(stock.inject);
    expect(inject).toEqual(["systemPrompt", "sessionProjections", "webApp"]);
  });
});

describe("hành vi: A/B trực tiếp với chính bundle gốc trên CÙNG một giàn", () => {
  test("đăng ký: đúng thứ tự, đúng tên, đúng order, interpolate:false, hai mục + hai dòng + một chiếu", () => {
    const ours = install(apply as unknown as (ctx: unknown) => void);
    const theirs = install(stock.apply);
    expect(declarationTrace(ours)).toEqual(declarationTrace(theirs));
    expect(ours.orderQueries).toEqual(["section:HARNESS_SOURCE", "context:HARNESS_SOURCE", "section:WEB_SURFACE", "context:WEB_SURFACE"]);
    expect(ours.sections.map((section) => section.name)).toEqual(["harness:source", "app:web-surface"]);
    expect(ours.contexts.map((entry) => entry.name)).toEqual(["harness:source", "app:web-surface"]);
    expect(ours.sections.map((section) => section.interpolate)).toEqual([false, false]);
    expect(ours.contexts.map((entry) => entry.interpolate)).toEqual([false, false]);
    expect(ours.projections.map((definition) => [definition.key, definition.stateVersion])).toEqual([["harnessDevLegacyPrompt", 1]]);
  });

  test("câu fallback của hai mục prompt BẰNG bản gốc từng byte — và KHÔNG chứa đường dẫn/URL", () => {
    const ours = install(apply as unknown as (ctx: unknown) => void);
    const theirs = install(stock.apply);
    for (const context of [{}, { agent: {} }] as PromptContextLike[]) {
      expect(promptNeutral(render(ours.sections[0] as Registration, context))).toBe(promptNeutral(render(theirs.sections[0] as Registration, context)));
      expect(promptNeutral(render(ours.sections[1] as Registration, context))).toBe(promptNeutral(render(theirs.sections[1] as Registration, context)));
      const source = render(ours.sections[0] as Registration, context);
      const web = render(ours.sections[1] as Registration, context);
      expect(source).not.toContain(resolve(dirname(STOCK_PATH), "../../../.."));
      expect(source).not.toContain("127.0.0.1");
      expect(web).not.toContain("127.0.0.1");
      expect(source.length).toBeGreaterThan(0);
      expect(web.length).toBeGreaterThan(0);
    }
  });

  test("runtime context: dòng URL bằng bản gốc; dòng checkout dùng ĐÚNG biểu thức ../../../.. của từng bản cài", () => {
    const ours = install(apply as unknown as (ctx: unknown) => void);
    const theirs = install(stock.apply);
    // ĐÚNG biểu thức của bản gốc — `fileURLToPath` giữ dấu "/" cuối vì URL kết thúc bằng thư mục.
    const ourSourceRoot = fileURLToPath(new URL("../../../..", pathToFileURL(join(REPO, "packages", "host", "harness-dev-context", "src", "index.ts"))));
    const theirSourceRoot = fileURLToPath(new URL("../../../..", pathToFileURL(STOCK_PATH)));
    expect(render(ours.contexts[0] as Registration, {})).toBe("Current Galaxy Blackhole implementation checkout: " + JSON.stringify(ourSourceRoot) + ".");
    expect(render(theirs.contexts[0] as Registration, {})).toBe("Current DeepSeek Harness implementation checkout: " + JSON.stringify(theirSourceRoot) + ".");
    const urlLine = render(ours.contexts[1] as Registration, {});
    expect(brandNeutral(urlLine)).toBe(brandNeutral(render(theirs.contexts[1] as Registration, {})));
    expect(urlLine).toBe('Current Galaxy Blackhole Web GUI URL: "http://127.0.0.1:55440/?token=lab".');
  });

  test("đoạn đã nhận: gộp prompt legacy ⇒ hai mục trả NGUYÊN VĂN đoạn, bằng bản gốc", () => {
    // Mốc cắt lấy từ CHÍNH artifact gốc (không chép tay) ⇒ sai một ký tự là ca này đỏ.
    const stockText = readFileSync(STOCK_PATH, "utf8");
    const prefixes = [...stockText.matchAll(/prefix:\s*("(?:[^"\\]|\\.)*")/g)].map((match) => JSON.parse(match[1] as string) as string);
    const suffixes = [...stockText.matchAll(/suffix:\s*("(?:[^"\\]|\\.)*")/g)].map((match) => JSON.parse(match[1] as string) as string);
    const [sourcePrefix, webPrefix] = prefixes;
    const [sourceSuffix, webSuffix] = suffixes;
    if (sourcePrefix === undefined || webPrefix === undefined || sourceSuffix === undefined || webSuffix === undefined) {
      throw new Error("không trích được mốc cắt legacy từ bundle gốc");
    }
    const checkout = JSON.stringify("/tmp/gbh-legacy-checkout");
    const url = JSON.stringify("http://127.0.0.1:5439/?token=legacy");
    const expectedSource = sourcePrefix + checkout + sourceSuffix;
    const expectedWeb = webPrefix + url + webSuffix;
    const prompt = expectedSource + "\n\n" + expectedWeb;

    const ours = install(apply as unknown as (ctx: unknown) => void);
    const theirs = install(stock.apply);
    const ourSession = ours.open();
    const theirSession = theirs.open();
    // Mốc cắt lấy từ bundle GỐC (nhãn DSH); bản cài của ta dùng nhãn GBH ⇒ nạp cho ta bản đã đổi nhãn.
    const promptForOurs = promptToGbh(prompt);
    ours.commit(ourSession, systemMessage(promptForOurs));
    theirs.commit(theirSession, systemMessage(prompt));
    expect(promptNeutral(JSON.stringify(ours.stateOf(ourSession, "harnessDevLegacyPrompt")))).toBe(
      promptNeutral(JSON.stringify(theirs.stateOf(theirSession, "harnessDevLegacyPrompt"))),
    );
    expect(ours.stateOf(ourSession, "harnessDevLegacyPrompt")).toEqual({ source: promptToGbh(expectedSource), web: promptToGbh(expectedWeb) });
    // Mục prompt của phiên đã nhận đoạn ⇒ trả ĐÚNG đoạn đó (không phải câu fallback), hai bên bằng nhau.
    const context = { agent: { session: ourSession } };
    const theirContext = { agent: { session: theirSession } };
    expect(render(ours.sections[0] as Registration, context)).toBe(promptToGbh(expectedSource));
    expect(render(ours.sections[1] as Registration, context)).toBe(promptToGbh(expectedWeb));
    expect(promptNeutral(render(ours.sections[0] as Registration, context))).toBe(promptNeutral(render(theirs.sections[0] as Registration, theirContext)));
    expect(promptNeutral(render(ours.sections[1] as Registration, context))).toBe(promptNeutral(render(theirs.sections[1] as Registration, theirContext)));
  });

  test("phép gộp: chỉ MỘT khối text không rỗng mới là phiên bản prompt — so TỪNG BƯỚC với bản gốc", () => {
    const ours = install(apply as unknown as (ctx: unknown) => void);
    const theirs = install(stock.apply);
    const ourSession = ours.open();
    const theirSession = theirs.open();
    const events: PromptEvent[] = [
      { type: "turn/start", data: {} },
      { type: "system/message", data: { message: { content: [{ type: "text", text: "no anchor here" }] } } },
      { type: "system/message", data: { message: { content: [{ type: "text", text: "" }] } } },
      { type: "system/message", data: { message: { content: [{ type: "tool-call", text: "x" }] } } },
      { type: "system/message", data: { message: { content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] } } },
    ];
    for (const event of events) {
      const beforeOurs = ours.stateOf(ourSession, "harnessDevLegacyPrompt");
      const beforeTheirs = theirs.stateOf(theirSession, "harnessDevLegacyPrompt");
      ours.commit(ourSession, event);
      theirs.commit(theirSession, event);
      const afterOurs = ours.stateOf(ourSession, "harnessDevLegacyPrompt");
      const afterTheirs = theirs.stateOf(theirSession, "harnessDevLegacyPrompt");
      expect(afterOurs).toEqual(afterTheirs);
      // Giữ nguyên THAM CHIẾU khi không đổi — cùng quy ước hai bên.
      expect(afterOurs === beforeOurs).toBe(afterTheirs === beforeTheirs);
    }
  });

  test("schema trạng thái: nhận đúng hình dạng, TỪ CHỐI dữ liệu sai — cùng kết quả hai bên", () => {
    const ours = install(apply as unknown as (ctx: unknown) => void);
    const theirs = install(stock.apply);
    const ourSchema = (ours.projections[0] as Projection).stateSchema;
    const theirSchema = (theirs.projections[0] as Projection).stateSchema;
    for (const value of [{ source: null, web: null }, { source: "a", web: null }]) {
      expect(ourSchema.parse(value)).toEqual(theirSchema.parse(value));
    }
    for (const value of ["x", null, { source: 1, web: null }, { web: null }, {}]) {
      expect(() => ourSchema.parse(value)).toThrow();
      expect(() => theirSchema.parse(value)).toThrow();
    }
  });
});

describe("C6 — vật thể cấu hình phải ĐỘC LẬP giữa các thực thể (so DANH TÍNH)", () => {
  test("hai lượt cài cho vật thể RIÊNG; sửa bên này KHÔNG lan sang bên kia", () => {
    const first = install(apply as unknown as (ctx: unknown) => void);
    const second = install(apply as unknown as (ctx: unknown) => void);
    for (const index of [0, 1]) {
      expect(first.sections[index]).not.toBe(second.sections[index]);
      expect(first.contexts[index]).not.toBe(second.contexts[index]);
    }
    expect(first.projections[0]).not.toBe(second.projections[0]);
    // Sửa một vật thể KHÔNG được lan sang vật thể kia (phép so sâu không bắt được lớp lỗi này).
    (first.sections[0] as Registration).name = "harness:source:mutated";
    (first.projections[0] as Projection).key = "harnessDevLegacyPrompt:mutated";
    expect((second.sections[0] as Registration).name).toBe("harness:source");
    expect((second.projections[0] as Projection).key).toBe("harnessDevLegacyPrompt");
    // Bản gốc cũng tạo vật thể MỚI mỗi lượt cài — ta giữ đúng quy ước đó.
    const stockFirst = install(stock.apply);
    const stockSecond = install(stock.apply);
    expect(stockFirst.sections[0] === stockSecond.sections[0]).toBe(first.sections[1] === second.sections[1]);
  });

  test("trạng thái init dùng CHUNG một vật thể — hành vi của bản gốc, giữ nguyên có chủ đích", () => {
    const ours = install(apply as unknown as (ctx: unknown) => void);
    const theirs = install(stock.apply);
    const ourInit = (ours.projections[0] as Projection).init;
    const theirInit = (theirs.projections[0] as Projection).init;
    expect(ourInit() === ourInit()).toBe(theirInit() === theirInit());
    expect(ourInit()).toEqual(theirInit());
    expect(ourInit()).toEqual({ source: null, web: null });
  });
});

describe("manifest: quy ước gbh.peers ⊆ peerDependencies (so PHẦN TỬ) + vùng an toàn", () => {
  test("mọi tên trong gbh.peers đều có trong peerDependencies, có thật trong kernel, đúng dải phiên bản", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: khẳng định DANH SÁCH, không chỉ khẳng định phép ⊆.
    expect(peers).toEqual(["@deepseek-ai/dsh-session-projection", "@deepseek-ai/dsh-system-prompt", "@deepseek-ai/dsh-web-app"]);
    expect(missingPeers(manifest)).toEqual([]);
    for (const peer of peers) {
      expect(manifest.peerDependencies?.[peer]).toBeDefined();
      const kernelPath = join(REPO, "apps", "host", "node_modules", peer, "package.json");
      expect(existsSync(kernelPath)).toBe(true);
      const kernel = JSON.parse(readFileSync(kernelPath, "utf8")) as { version: string };
      // Lượt pin exact (01/11/2026) đổi peer từ dải "~x" sang ĐÚNG phiên bản kernel: nhận CẢ HAI dạng,
      // nhưng phiên bản khai PHẢI trỏ đúng bản kernel đang chạy (không nhận dải khác).
      const declaredVersion = manifest.peerDependencies?.[peer];
      // Nhận CẢ dạng exact lẫn dải "~x", nhưng PHẢI trỏ đúng phiên bản kernel đang chạy.
      expect(declaredVersion === kernel.version || declaredVersion === "~" + kernel.version).toBe(true);
      // Peer KHÔNG được nằm ở dependencies (một thể hiện do kernel cấp).
      expect(manifest.dependencies?.[peer]).toBeUndefined();
    }
    expect(manifest.dependencies?.zod).toBeDefined();
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT tên khỏi peerDependencies ⇒ phép kiểm báo ĐÚNG tên đó; thừa tên vẫn ĐẠT", () => {
    const manifest = readManifest();
    expect(missingPeers(manifest)).toEqual([]);
    for (const peer of manifest.gbh?.peers ?? []) {
      const mutated = cloneManifest(manifest);
      delete (mutated.peerDependencies ?? {})[peer];
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    // Đối chứng âm thứ hai: phép so SỐ LƯỢNG sẽ nói "OK" trong khi phép so PHẦN TỬ bắt được.
    const sneaky: Manifest = { gbh: { peers: ["a", "z"] }, peerDependencies: { a: "1", b: "1" } };
    expect(sneaky.gbh?.peers?.length).toBe(Object.keys(sneaky.peerDependencies ?? {}).length);
    expect(missingPeers(sneaky)).toEqual(["z"]);
    // Thừa tên trong peerDependencies KHÔNG phải vi phạm (quy ước là ⊆).
    const generous: Manifest = { gbh: { peers: ["a"] }, peerDependencies: { a: "1", b: "1" } };
    expect(missingPeers(generous)).toEqual([]);
  });

  });
