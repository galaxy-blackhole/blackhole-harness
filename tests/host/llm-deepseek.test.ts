/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-llm-deepseek: mỗi ca dựng HAI giàn giống hệt nhau rồi
 *      chạy CẢ HAI bản cài (ta và chính bundle gốc @deepseek-ai/dsh-llm-deepseek-api-key), so từng giá
 *      trị; cộng ca tập export đo trên ARTIFACT, ca gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM, ca
 *      độc lập vật thể cấu hình (C6), ca locale 000e và ca canh `gbh.row` chưa khai.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/llm-deepseek/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục `@deepseek-ai` của KERNEL — mount thật symlink MỌI peer về đây, nên rig cũng phải nạp từ đây. */
const KERNEL_AI = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Thư mục build tạm của artefact ta (dọn ở afterAll). */
const OUT_DIR = mkdtempSync(join(tmpdir(), "gbh-llm-deepseek-"));
// LƯỢT ĐO 01/11/2026: bản của TA nạp từ ARTEFACT trong "profile giả" — peer trỏ KERNEL, đúng cách mount
// thật làm. Nạp thẳng `src/index.ts` thì peer phân giải về bản sao workspace (cùng nội dung, KHÁC mô-đun)
// nên `error instanceof kernel.LlmError` trượt ở cả 4 ca resolveAuth lẫn phép đo danh tính lớp cuối file.
const ARTIFACT = await buildPackage(OUT_DIR);
mkdirSync(join(OUT_DIR, "node_modules"), { recursive: true });
symlinkSync(KERNEL_AI, join(OUT_DIR, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT_DIR, "node_modules", "@galaxy-blackhole"), "dir");

/** Bề mặt của bản TA nạp từ artefact đã mount peer kernel. */
interface OurModule {
  /** Schema cấu hình (schemastery). */
  Config: (value: any) => LiveConfig;
  /** Cài plugin lên context. */
  apply: (ctx: any, config: any) => void;
  /** Service phải chờ. */
  inject: string[];
  /** Tên plugin. */
  name: string;
  /** Ảnh chụp cấu hình phẳng. */
  plainOptions: (config: any) => any;
  /** Tuỳ chọn adapter đã phân giải. */
  resolveAdapterOptions: (config: any, environment?: any) => any;
}

/** Bản của TA (nạp từ artefact). */
const oursModule = (await import(ARTIFACT)) as OurModule;
/** Các export dùng trong mọi phép so A/B dưới đây. */
const { Config, apply, inject, name, plainOptions, resolveAdapterOptions } = oursModule;

/** Dọn thư mục build tạm sau khi xong. */
afterAll(() => {
  rmSync(OUT_DIR, { recursive: true, force: true });
});

/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-llm-deepseek-api-key/lib/index.js";

/** Thư mục gói gốc trong kernel (CHỈ ĐỌC) — dùng cho luật locale 000e. */
const STOCK_DIR = new URL("../../apps/host/node_modules/@deepseek-ai/dsh-llm-deepseek-api-key/", import.meta.url);

/** Lớp lỗi do KERNEL cấp — phải là CÙNG một thể hiện với bản mà src/ ta import (đo bằng danh tính). */
const LLM = "../../apps/host/node_modules/@deepseek-ai/dsh-llm/lib/index.js";


/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as {
  name: string;
  inject: string[];
  Config: (value: any) => LiveConfig;
  apply: (ctx: any, config: any) => void;
  plainOptions: (config: any) => any;
  resolveAdapterOptions: (config: any, environment?: any) => any;
};

/** Thể hiện lỗi của kernel, nạp động cùng lý do. */
const kernel = (await import(LLM)) as { LlmError: new (message: string, code: string) => Error & { code: string } };

/** Một cấu hình SỐNG như cordis trao cho plugin: trường volatile có `.get()`. */
interface LiveConfig {
  /** Trường tham chiếu credential (volatile). */
  apiKeyEnv: { get(): string };
}

/** Một ảnh chụp môi trường khởi động tối thiểu, đúng phần mà row này đọc. */
interface Snapshot {
  /** Tra một tên biến trong các lớp môi trường. */
  get(name: string): { value: string; source: "process" } | undefined;
  /** Tra một tên chỉ trong các lớp được chỉ định. */
  getFrom(name: string, sources: readonly string[]): { value: string; source: "process" } | undefined;
}

/** Seam credentials tối thiểu: chỉ `resolve`, đúng phần row này gọi. */
interface CredentialsSeam {
  /** Trả giá trị đã lưu, hoặc `undefined` khi chưa cấu hình. */
  resolve(ref: string): Promise<{ value: string } | undefined>;
}

/** Đầu vào dựng một giàn: môi trường, credentials (vắng mặt = không có seam) và id entry. */
interface HarnessOptions {
  /** Biến môi trường khởi động nhìn thấy được. */
  env?: Record<string, string>;
  /** Credentials: `undefined` = KHÔNG có service; `{}` = có service nhưng chưa lưu gì. */
  creds?: { value?: string };
  /** Id row đang nạp plugin; vắng mặt = plugin không nạp từ entry nào. */
  entryId?: string;
}

/** Giàn giả tối thiểu nhưng ĐÚNG hình dạng seam: mọi lời gọi đăng ký đều được ghi lại. */
interface Harness {
  /** Context đưa cho `apply`. */
  ctx: never;
  /** Mục provider cấu hình được đã đăng ký. */
  providers: Record<string, unknown>[];
  /** Adapter đã đăng ký kèm danh sách route. */
  adapters: { providers: string[]; adapter: { dependencies: Dependencies } }[];
  /** Giá trị mà seam `settings.configure` nhận trong hiệu ứng con. */
  settings: unknown[];
  /** Danh sách inject mà adapter yêu cầu. */
  injects: string[][];
  /** Tên các listener đã đăng ký. */
  listeners: string[];
  /** Số lượt gọi `logger.warn`. */
  warns(): number;
}

/** Phần phụ thuộc mà adapter giữ lại — chính là những gì `apply` của ta trao cho kernel. */
interface Dependencies {
  /** Ảnh chụp kết nối MỚI cho mỗi thao tác. */
  options(): Connection;
  /** Phân giải khoá cho một request. */
  resolveAuth(connection: Connection): Promise<{ headers: Record<string, string> }>;
  /** Danh mục model, bị chặn bởi credential. */
  discoverModels(provider: string): Promise<ModelInfo[]>;
  /** Nhãn provider cho selector. */
  providerName?: string;
}

/** Ảnh chụp kết nối đã phân giải (phần test này đọc). */
interface Connection {
  /** Gốc Messages API. */
  baseURL: string;
  /** Tham chiếu credential đã đóng dấu. */
  apiKeyEnv: string;
  /** Danh mục model tư vấn. */
  models: { id: string; name?: string; inputModalities?: string[] }[];
  /** Chính sách thử lại đã phân giải. */
  retryPolicy: unknown;
}

/** Một mục danh mục model mà discovery trả về. */
interface ModelInfo {
  /** Route sở hữu. */
  provider: string;
  /** Id model. */
  id: string;
  /** Nhãn hiển thị. */
  name: string;
  /** Phương thức đầu vào. */
  inputModalities: string[];
}

/**
 * Dựng một giàn giả: sổ provider/adapter, seam credentials, môi trường và entry của loader.
 * Nhận: đầu vào giàn (môi trường · credentials · id entry).
 * Trả: giàn dùng chung được cho CẢ bản của ta lẫn bản gốc.
 */
function harness(options: HarnessOptions = {}): Harness {
  const providers: Record<string, unknown>[] = [];
  const adapters: Harness["adapters"] = [];
  const settings: unknown[] = [];
  const injects: string[][] = [];
  const listeners: string[] = [];
  let warns = 0;
  const snapshot: Snapshot = {
    get: (variable) => (options.env !== undefined && variable in options.env ? { value: options.env[variable] as string, source: "process" } : undefined),
    getFrom: () => undefined,
  };
  const credentials: CredentialsSeam | undefined =
    options.creds === undefined
      ? undefined
      : {
          resolve: async () =>
            options.creds !== undefined && options.creds.value !== undefined ? { value: options.creds.value } : undefined,
        };
  const fiber = { entry: options.entryId === undefined ? undefined : { options: { id: options.entryId } } };
  const ctx = {
    fiber,
    logger: { warn: (): void => void (warns += 1) },
    llm: {
      registerConfigurableProviders(entries: Record<string, unknown>[]): unknown {
        providers.push(...entries);
        return { replace: () => undefined, dispose: () => undefined };
      },
      registerAdapter(routes: string[], adapter: Harness["adapters"][number]["adapter"]): unknown {
        adapters.push({ providers: routes, adapter });
        return { replace: () => undefined, dispose: () => undefined };
      },
    },
    get(key: string): unknown {
      if (key === "credentials") return credentials;
      if (key === "launchEnvironment") return snapshot;
      return undefined;
    },
    inject(_deps: string[], callback: (child: unknown) => void): void {
      injects.push(_deps);
      callback({
        effect(execute: () => unknown): () => void {
          settings.push(execute());
          return () => undefined;
        },
        settings: { configure: (value: unknown) => ({ configured: value }) },
      });
    },
    on(event: string): () => void {
      listeners.push(event);
      return () => undefined;
    },
  };
  return {
    ctx: ctx as never,
    providers,
    adapters,
    settings,
    injects,
    listeners,
    warns: () => warns,
  };
}

/**
 * Chạy một bản cài trên một giàn MỚI rồi trả phần phụ thuộc nó trao cho kernel.
 * Nhận: hàm `apply` cần đo, cấu hình sống, và đầu vào giàn.
 * Trả: giàn đã dùng (đọc được sổ đăng ký) và phần phụ thuộc của adapter.
 */
function install(
  applyFn: (ctx: never, config: never) => void,
  config: unknown,
  options: HarnessOptions = {},
): { h: Harness; deps: Dependencies } {
  const h = harness(options);
  applyFn(h.ctx, config as never);
  const first = h.adapters[0];
  if (first === undefined) throw new Error("không có adapter nào được đăng ký");
  return { h, deps: first.adapter.dependencies };
}

/**
 * Chạy CÙNG một lượt phân giải khoá trên cả hai bản cài rồi so từng trường của kết quả.
 * Nhận: đầu vào giàn (môi trường · credentials · id entry).
 * Trả: kết quả của bản GỐC dạng `{ ok }` hoặc `{ err }`, để ca test khẳng định thêm giá trị tuyệt đối.
 */
async function bothAuth(options: HarnessOptions): Promise<{ ok?: unknown; err?: Record<string, unknown> }> {
  const outcome = async (applyFn: (ctx: never, config: never) => void, config: unknown): Promise<{ ok?: unknown; err?: Record<string, unknown> }> => {
    const { deps } = install(applyFn, config, options);
    try {
      return { ok: await deps.resolveAuth(deps.options()) };
    } catch (error) {
      const failure = error as Error & { code?: string };
      return {
        err: {
          name: failure.name,
          code: failure.code,
          message: failure.message,
          kernelClass: error instanceof kernel.LlmError,
        },
      };
    }
  };
  const ours = await outcome(apply as never, Config({}));
  const theirs = await outcome(stock.apply, stock.Config({}));
  expect(ours).toEqual(theirs);
  return theirs;
}

/**
 * Chạy CÙNG một lượt khám phá model trên cả hai bản cài rồi so kết quả.
 * Nhận: đầu vào giàn.
 * Trả: kết quả của bản GỐC (danh mục hoặc lỗi), để khẳng định thêm giá trị tuyệt đối.
 */
async function bothDiscovery(options: HarnessOptions): Promise<{ ok?: ModelInfo[]; err?: Record<string, unknown> }> {
  const outcome = async (applyFn: (ctx: never, config: never) => void, config: unknown): Promise<{ ok?: ModelInfo[]; err?: Record<string, unknown> }> => {
    const { deps } = install(applyFn, config, options);
    try {
      return { ok: await deps.discoverModels("deepseek-official") };
    } catch (error) {
      const failure = error as Error & { code?: string };
      return { err: { code: failure.code, message: failure.message } };
    }
  };
  const ours = await outcome(apply as never, Config({}));
  const theirs = await outcome(stock.apply, stock.Config({}));
  expect(ours).toEqual(theirs);
  return theirs;
}

/** Tên export của một file ESM đã build (đúng hai regex mà `check:rows` dùng). */
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

/** Một manifest package.json như phép kiểm §1d cần. */
interface PeerManifest {
  /** Tên package. */
  name: string;
  /** Metadata của ta. */
  gbh?: { peers?: string[]; row?: unknown };
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
}

/**
 * Phép kiểm luật M6 §1d: `gbh.peers` phải là TẬP CON của `peerDependencies`, so PHẦN TỬ.
 * Nhận: một manifest đọc từ package.json.
 * Trả: các tên peer nằm trong gbh.peers mà KHÔNG có trong peerDependencies (rỗng = đạt).
 */
function missingPeers(manifest: PeerManifest): string[] {
  const peers = manifest.gbh?.peers ?? [];
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return peers.filter((peer) => !declared.has(peer)).sort();
}

/** Đọc một package.json trong repo. */
function manifestAt(relative: string): PeerManifest {
  return JSON.parse(readFileSync(new URL("../../" + relative, import.meta.url), "utf8")) as PeerManifest;
}

/** Băm sha256 của một tệp — dùng cho luật 000e (chép byte-for-byte). */
function sha256(path: URL | string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const text = readFileSync(ARTIFACT, "utf8");
    const ours = exportNames(text);
    const theirs = exportNames(readFileSync(new URL(STOCK, import.meta.url), "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual(["Config", "apply", "inject", "name", "plainOptions", "resolveAdapterOptions"]);
    expect(ours).not.toContain("default");
    // Row HOST-ONLY: bundle KHÔNG được tự khai id module nào của gói gốc (đúng lệnh nghiệm thu).
    expect(text.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
  });

  test("name · inject khớp bản gốc từng chữ", () => {
    expect(name).toBe(stock.name);
    expect(name).toBe("llm-deepseek-api-key");
    expect(inject).toEqual(stock.inject);
    expect(inject).toEqual(["llm"]);
  });

  test("Config: CÙNG một chuỗi schema như bản gốc, và apiKeyEnv mặc định đúng", () => {
    expect(String(Config)).toBe(String(stock.Config));
    const ours = Config({});
    const theirs = stock.Config({});
    expect(ours.apiKeyEnv.get()).toBe("DEEPSEEK_API_KEY");
    expect(ours.apiKeyEnv.get()).toBe(theirs.apiKeyEnv.get());
    expect(Config({ apiKeyEnv: "MY_KEY" }).apiKeyEnv.get()).toBe("MY_KEY");
  });

  test("plainOptions: A/B trên cùng cấu hình — 19 trường, apiKeyEnv lấy giá trị SỐNG", () => {
    const ours = plainOptions(Config({ apiKeyEnv: "OTHER_KEY" }));
    const theirs = stock.plainOptions(stock.Config({ apiKeyEnv: "OTHER_KEY" }));
    expect(ours).toEqual(theirs);
    expect(Object.keys(ours).length).toBe(19);
    expect(ours.apiKeyEnv).toBe("OTHER_KEY");
  });

  test("resolveAdapterOptions: A/B từng trường, apiKeyEnv ĐÃ ĐÓNG DẤU, mặc định khi thiếu", () => {
    const environment: Snapshot = {
      get: (variable) => (variable === "DEEPSEEK_BASE_URL" ? { value: "http://gateway.test/anthropic", source: "process" } : undefined),
      getFrom: () => undefined,
    };
    const ours = resolveAdapterOptions(plainOptions(Config({})), environment);
    const theirs = stock.resolveAdapterOptions(stock.plainOptions(stock.Config({})), environment);
    expect(ours).toEqual(theirs);
    expect(ours.baseURL).toBe("http://gateway.test/anthropic");
    expect(String(ours.apiKeyEnv)).toBe("DEEPSEEK_API_KEY");
    // Không có môi trường ⇒ rơi về endpoint công khai, y bản gốc.
    const bare = resolveAdapterOptions({ apiKeyEnv: undefined });
    expect(bare.baseURL).toBe(stock.resolveAdapterOptions({}).baseURL);
    expect(String(bare.apiKeyEnv)).toBe("DEEPSEEK_API_KEY");
  });
});

describe("hành vi: mọi ca chạy CẢ HAI bản cài trên cùng một giàn", () => {
  test("apply: provider cấu hình được + adapter + hiệu ứng settings khớp bản gốc", () => {
    const ours = install(apply as never, Config({}), { entryId: "llm-deepseek" });
    const theirs = install(stock.apply, stock.Config({}), { entryId: "llm-deepseek" });
    expect(ours.h.providers).toEqual(theirs.h.providers);
    expect(ours.h.providers).toEqual([
      { provider: "deepseek-official", displayName: "DeepSeek", settingsNs: "llm-deepseek", settingsPath: [] },
    ]);
    expect(ours.h.adapters.map((entry) => entry.providers)).toEqual([["deepseek-official"]]);
    expect(ours.h.adapters.map((entry) => entry.providers)).toEqual(theirs.h.adapters.map((entry) => entry.providers));
    expect(ours.h.injects).toEqual(theirs.h.injects);
    expect(ours.h.injects).toEqual([["settings"]]);
    expect(ours.h.settings).toEqual(theirs.h.settings);
    expect(ours.h.settings).toEqual([{ configured: { auto: false } }]);
    expect(ours.h.listeners).toEqual(theirs.h.listeners);
    expect(ours.h.listeners).toEqual(["loader/volatile-update"]);
    expect(ours.deps.providerName).toBe("DeepSeek");
  });

  test("settingsNs: lấy id ROW đang nạp; không có entry thì rơi về tên plugin — y bản gốc", () => {
    const withEntry = install(apply as never, Config({}), { entryId: "llm-deepseek-ours" });
    expect(withEntry.h.providers[0]?.settingsNs).toBe("llm-deepseek-ours");
    const bare = install(apply as never, Config({}));
    const bareTheirs = install(stock.apply, stock.Config({}));
    expect(bare.h.providers[0]?.settingsNs).toBe("llm-deepseek-api-key");
    expect(bare.h.providers).toEqual(bareTheirs.h.providers);
  });

  test("resolveAuth: credentials có khoá ⇒ header x-api-key đã CẮT khoảng trắng", async () => {
    const theirs = await bothAuth({ env: {}, creds: { value: "  sk-abc  " } });
    expect(theirs.ok).toEqual({ headers: { "x-api-key": "sk-abc" } });
  });

  test("resolveAuth: credentials TRƯỢT ⇒ KHÔNG rơi sang môi trường, ném MISSING_CREDENTIAL", async () => {
    const theirs = await bothAuth({ env: { DEEPSEEK_API_KEY: "sk-env" }, creds: {} });
    expect(theirs.err?.code).toBe("MISSING_CREDENTIAL");
    expect(theirs.err?.kernelClass).toBe(true);
    expect(String(theirs.err?.message)).toContain('no API key for provider route "deepseek-official"');
  });

  test("resolveAuth: KHÔNG có seam credentials ⇒ dùng môi trường khởi động", async () => {
    const theirs = await bothAuth({ env: { DEEPSEEK_API_KEY: "sk-env" }, creds: undefined });
    expect(theirs.ok).toEqual({ headers: { "x-api-key": "sk-env" } });
  });

  test("resolveAuth: biến môi trường RỖNG bị coi là thiếu (không dùng khoá rỗng)", async () => {
    const theirs = await bothAuth({ env: { DEEPSEEK_API_KEY: "" }, creds: undefined });
    expect(theirs.err?.code).toBe("MISSING_CREDENTIAL");
  });

  test("resolveAuth: khoá RỖNG/toàn khoảng trắng ⇒ INVALID_CREDENTIAL, không lộ khoá trong thông điệp", async () => {
    const theirs = await bothAuth({ env: {}, creds: { value: "   " } });
    expect(theirs.err?.code).toBe("INVALID_CREDENTIAL");
    expect(theirs.err?.kernelClass).toBe(true);
    expect(String(theirs.err?.message)).toContain("DEEPSEEK_API_KEY");
  });

  test("resolveAuth: ký tự không đi được trong header ⇒ INVALID_CREDENTIAL", async () => {
    const theirs = await bothAuth({ env: {}, creds: { value: "sk-é" } });
    expect(theirs.err?.code).toBe("INVALID_CREDENTIAL");
    expect(String(theirs.err?.message)).toContain("characters no HTTP header can carry");
  });

  test("discoverModels: có khoá ⇒ danh mục model đầy đủ, đúng hình dạng catalogModelInfo", async () => {
    const theirs = await bothDiscovery({ env: {}, creds: { value: "sk-abc" } });
    const ids = (theirs.ok ?? []).map((entry) => entry.id);
    expect(ids.length).toBeGreaterThan(0);
    for (const entry of theirs.ok ?? []) {
      expect(entry.provider).toBe("deepseek-official");
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.inputModalities.length).toBeGreaterThan(0);
    }
    expect(theirs.ok?.[0]).toHaveProperty("id");
  });

  test("discoverModels: THIẾU khoá ⇒ trả [] (không ném) — bản gốc cũng vậy", async () => {
    const theirs = await bothDiscovery({ env: {}, creds: {} });
    expect(theirs.ok).toEqual([]);
  });

  test("discoverModels: khoá KHÔNG dùng được ⇒ NÉM lại (chỉ MISSING_CREDENTIAL được nuốt)", async () => {
    const theirs = await bothDiscovery({ env: {}, creds: { value: "sk-é" } });
    expect(theirs.err?.code).toBe("INVALID_CREDENTIAL");
  });

  test("cấu hình sai ⇒ NÉM ngay lúc nạp, TRƯỚC mọi đăng ký (fail loud như bản gốc)", () => {
    const broken = (config: (value: any) => any): string => {
      const h = harness({ env: {} });
      let message = "";
      try {
        (apply as never as (ctx: never, config: never) => void)(h.ctx, config({ thinking: "disabled", reasoningEffort: "high" }) as never);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(h.providers).toEqual([]);
      return message;
    };
    const ours = broken(Config);
    const theirs = broken(stock.Config);
    expect(ours).toBe(theirs);
    expect(ours).toBe('llm-deepseek: only reasoningEffort "off" can be configured when thinking is disabled');
  });
});

describe("C6 — vật thể cấu hình ĐỘC LẬP giữa các thực thể (kiểm bằng DANH TÍNH)", () => {
  test("hai lần cài ⇒ hai mục provider ĐỘC LẬP; sửa một KHÔNG lan sang cái kia", () => {
    const a = install(apply as never, Config({}), { entryId: "llm-deepseek" });
    const b = install(apply as never, Config({}), { entryId: "llm-deepseek" });
    const entryA = a.h.providers[0] as { settingsPath: unknown[] };
    const entryB = b.h.providers[0] as { settingsPath: unknown[] };
    expect(entryA).not.toBe(entryB);
    expect(entryA.settingsPath).not.toBe(entryB.settingsPath);
    entryA.settingsPath.push("mutated");
    expect(entryB.settingsPath).toEqual([]);
  });

  test("hai lượt options() ⇒ ảnh chụp MỚI (object · mảng · phần tử), không rò sửa đổi", () => {
    const measure = (deps: Dependencies): { fresh: boolean; models: boolean; items: boolean; leak: boolean } => {
      const first = deps.options();
      const second = deps.options();
      first.models[0]!.id = "mutated";
      return {
        fresh: first !== second,
        models: first.models !== second.models,
        items: true,
        leak: second.models[0]!.id !== "mutated",
      };
    };
    const ours = measure(install(apply as never, Config({})).deps);
    const theirs = measure(install(stock.apply, stock.Config({})).deps);
    expect(ours).toEqual(theirs);
    expect(ours).toEqual({ fresh: true, models: true, items: true, leak: true });
  });
});

describe("metadata + luật gói", () => {
  test("gbh.peers ⊆ peerDependencies (so PHẦN TỬ) và mọi peer có phiên bản thật", () => {
    const manifest = manifestAt("packages/host/llm-deepseek/package.json");
    expect(manifest.gbh?.peers).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/schemastery",
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-llm-deepseek",
      "@deepseek-ai/dsh-launch-environment",
      "@deepseek-ai/dsh-credentials",
    ]);
    expect(missingPeers(manifest)).toEqual([]);
    for (const peer of manifest.gbh?.peers ?? []) expect(typeof manifest.peerDependencies?.[peer]).toBe("string");
  });

  test("ĐỐI CHỨNG ÂM: thiếu tên trong peerDependencies thì phép kiểm PHẢI bắt được", () => {
    const broken: PeerManifest = {
      name: "x",
      gbh: { peers: ["@deepseek-ai/dsh-llm", "@deepseek-ai/khong-ton-tai"] },
      peerDependencies: { "@deepseek-ai/dsh-llm": "1" },
    };
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    // Cùng số lượng nhưng lệch phần tử vẫn phải ĐỎ (phép kiểm so số lượng là verdict RỖNG).
    const sameCount: PeerManifest = {
      name: "y",
      gbh: { peers: ["@deepseek-ai/a", "@deepseek-ai/b"] },
      peerDependencies: { "@deepseek-ai/a": "1", "@deepseek-ai/c": "1" },
    };
    expect(missingPeers(sameCount)).toEqual(["@deepseek-ai/b"]);
  });

  test("TEST CANH: gói CHƯA khai gbh.row (khai sớm là nhận rủi ro mount)", () => {
    expect(manifestAt("packages/host/llm-deepseek/package.json").gbh?.row).toBeUndefined();
  });

  test("luật 000e: stock theo PROVENANCE HIỆN TẠI (dsh-llm-deepseek-api-key) CÓ locale/ ⇒ gói ta chép BYTE-FOR-BYTE", () => {
    // 08/11/2026 (Lead chốt): provenance của gói đã đổi sang @deepseek-ai/dsh-llm-deepseek-api-key — gói đó CÓ
    // locale/en.json + zh.json. Vì vậy luật 000e phải áp theo stock HIỆN TẠI: ta ship ĐÚNG hai tệp đó, byte-for-byte,
    // và khai export "./locale/*.json". (Bản cũ khoá nhầm stock dsh-llm-deepseek — gói KHÔNG có locale — nên đỏ oan.)
    const manifest = manifestAt("packages/host/llm-deepseek/package.json") as {
      exports?: Record<string, unknown>;
      gbh?: { provenance?: { stock?: string } };
    };
    const stock = manifest.gbh?.provenance?.stock ?? "";
    expect(stock).toBe("@deepseek-ai/dsh-llm-deepseek-api-key");
    const stockLocale = join(KERNEL_AI, stock.replace("@deepseek-ai/", ""), "locale");
    expect(existsSync(stockLocale)).toBe(true);
    for (const file of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(REPO, "packages/host/llm-deepseek/locale", file));
      const theirs = readFileSync(join(stockLocale, file));
      expect(ours.equals(theirs)).toBe(true);
    }
    expect(Object.keys(manifest.exports ?? {})).toContain("./locale/*.json");
  });

  test("một thể hiện kernel duy nhất: LlmError của ta LÀ lớp của kernel (đo bằng danh tính)", async () => {
    // 1) Artefact KHÔNG nhúng bản sao lớp lỗi: nó import peer, không tự định nghĩa `LlmError`.
    const text = readFileSync(ARTIFACT, "utf8");
    expect(text).not.toMatch(/class LlmError/);
    expect(text).toMatch(/from "@deepseek-ai\/dsh-llm"/);
    // 2) Lỗi THẬT do artefact ném ra mang ĐÚNG lớp của kernel (identity, không phải so tên lớp).
    const { deps } = install(apply as never, Config({}), { env: {}, creds: {} });
    const thrown = await deps.resolveAuth(deps.options()).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(thrown instanceof kernel.LlmError).toBe(true);
    expect((thrown as Error).name).toBe("LlmError");
  });
});
