/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test cho @galaxy-blackhole/gbh-deepseek-account: bốn helper thuần + chính sách huỷ việc + định
 *      nghĩa Service, mỗi ca chạy CẢ HAI bên (ta và chính bundle gốc) rồi so từng giá trị; cộng ca tập
 *      export đo trên ARTIFACT và ca gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/deepseek-account/build.ts";
import type { AccountTaskContext } from "../../packages/host/deepseek-account/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục build tạm + artefact của ta (mọi ca dưới đây chạy trên ARTEFACT, không trên src/). */
const OUT = mkdtempSync(join(tmpdir(), "gbh-deepseek-account-"));
// LƯỢT ĐO 01/11/2026: nạp artefact trong "profile giả" — `node_modules/@deepseek-ai` trỏ KERNEL, đúng cách
// mount thật symlink peer. Nạp thẳng `src/index.ts` thì `@deepseek-ai/cordis` phân giải về bản sao workspace
// (cùng nội dung, KHÁC mô-đun) ⇒ lớp `Service` của ta khác của gốc, và lỗi kernel truyền vào listener không
// được nhận ra là `LlmError` (chính vì thế một ca còn là lỗi CODE: nay src dò TÊN lớp, xem account-tasks.ts).
const ARTIFACT = await buildPackage(OUT);
mkdirSync(join(OUT, "node_modules"), { recursive: true });
symlinkSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), join(OUT, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");

/** Bề mặt module của bản TA (nạp từ artefact). */
interface OurShape {
  /** Lớp định nghĩa Service. */
  DeepSeekAccount: new (ctx: unknown) => { name: string };
  /** Export mặc định — phải CHÍNH LÀ lớp trên. */
  default: unknown;
  /** Gộp Cookie header. */
  mergePlatformCookies: StockShape["mergePlatformCookies"];
  /** Header desktop. */
  desktopClientHeaders: StockShape["desktopClientHeaders"];
  /** Trọn bộ header client Platform. */
  platformClientHeaders: StockShape["platformClientHeaders"];
  /** Locale đường truyền. */
  platformWireLocale: StockShape["platformWireLocale"];
  /** Nhận diện việc đang chạy đi tuyến tài khoản. */
  isRunningAccountTask: StockShape["isRunningAccountTask"];
  /** Cài chính sách huỷ việc. */
  installAccountTaskCancellation: StockShape["installAccountTaskCancellation"];
}

/** Module đã build của ta. */
const oursModule = (await import(ARTIFACT)) as OurShape;
/** Lớp Service của ta — LẤY TỪ ARTEFACT (peer trong artefact trỏ kernel). */
const DeepSeekAccount = oursModule.DeepSeekAccount;
/** Export default của ta. */
const DeepSeekAccountDefault = oursModule.default;
/** Các helper thuần của ta, cùng nguồn artefact. */
const { desktopClientHeaders, installAccountTaskCancellation, isRunningAccountTask, mergePlatformCookies, platformClientHeaders, platformWireLocale } = oursModule;

/** Dọn thư mục build tạm sau khi xong. */
afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-deepseek-account/lib/index.js";

/** Thư mục gói gốc trong kernel (CHỈ ĐỌC) — dùng cho luật locale 000e. */
const STOCK_DIR = new URL("../../apps/host/node_modules/@deepseek-ai/dsh-deepseek-account/", import.meta.url);

/** Gói của ta trong repo — nguồn của metadata gbh.peers. */
const OURS_DIR = new URL("../../packages/host/deepseek-account/", import.meta.url);

/** Đường dẫn module dsh-llm trong kernel: PHẢI là cùng một thể hiện với bản mà src/ ta import (symlink). */
const LLM = "../../apps/host/node_modules/@deepseek-ai/dsh-llm/lib/index.js";

/** Hình dạng tối thiểu của bundle gốc mà test này chạm tới. */
interface StockShape {
  /** Lớp định nghĩa Service của bản gốc. */
  DeepSeekAccount: new (ctx: unknown) => { name: string };
  /** Export default của bản gốc. */
  default: unknown;
  /** Gộp Cookie header. */
  mergePlatformCookies: (base: string, override: string) => string;
  /** Header desktop. */
  desktopClientHeaders: (platform: "darwin" | "win32" | null) => Record<string, string>;
  /** Trọn bộ header client Platform. */
  platformClientHeaders: (
    platform: "darwin" | "win32" | null,
    client: { version: string; locale: string; timezoneOffsetSeconds: number },
  ) => Record<string, string>;
  /** Locale đường truyền. */
  platformWireLocale: (locale: string) => string;
  /** Nhận diện việc đang chạy đi tuyến tài khoản. */
  isRunningAccountTask: (agent: { status: string; session: { requestContext(): { provider?: string } | undefined } }) => boolean;
  /** Cài chính sách huỷ việc. */
  installAccountTaskCancellation: (ctx: unknown) => void;
}

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as StockShape;

/** LlmError của CHÍNH kernel — cùng thể hiện mà src/ ta import qua symlink peer. */
const llm = (await import(LLM)) as { LlmError: new (message: string, code: string) => Error };

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

/** Một lần huỷ việc đã xảy ra, ghi nguyên văn đối số. */
interface CancelCall {
  /** Tên agent bị huỷ (nhãn của giàn). */
  label: string;
  /** Lý do huỷ, nguyên văn. */
  reason: unknown;
  /** Tuỳ chọn huỷ, nguyên văn. */
  options: unknown;
}

/** Dấu vết của một lượt cài chính sách trên giàn giả. */
interface Trace {
  /** Mỗi lần `ctx.inject` được gọi, kèm danh sách tên service. */
  injected: string[][];
  /** Tên các listener đã đăng ký, theo thứ tự. */
  listeners: string[];
  /** Các sự kiện đã phát. */
  emitted: string[];
  /** Các lần huỷ việc, theo thứ tự. */
  cancelled: CancelCall[];
}

/** Một agent giả trong giàn. */
interface FakeAgent {
  /** Nhãn để đọc dấu vết. */
  label: string;
  /** Trạng thái sống. */
  status: string;
  /** Phiên với ngữ cảnh request bền. */
  session: { requestContext(): { provider?: string } | undefined };
  /** Động từ huỷ. */
  cancel(reason: unknown, options: unknown): void;
}

/** Giàn giả cho chính sách huỷ việc: context → scope → listener, có điều khiển được. */
interface Harness {
  /** Context đưa cho hàm cài chính sách. */
  ctx: unknown;
  /** Dấu vết tích luỹ. */
  trace: Trace;
  /** Bắn một listener đã đăng ký. */
  fire(event: string, payload?: unknown): void;
}

/**
 * Dựng giàn giả ĐÚNG hình dạng seam thật mà chính sách dùng (`inject` → scope → `on`/`emit`/`agents.list`).
 * Nhận: hàm dựng agent giả từ chính dấu vết của giàn (để móc huỷ ghi đúng chỗ).
 * Trả: giàn có dấu vết đọc được và hàm bắn listener.
 */
function harness(makeAgents: (trace: Trace) => FakeAgent[]): Harness {
  const trace: Trace = { injected: [], listeners: [], emitted: [], cancelled: [] };
  const agents = makeAgents(trace);
  const listeners = new Map<string, (payload?: unknown) => void>();
  const scope = {
    on(event: string, listener: (payload?: unknown) => void): () => void {
      trace.listeners.push(event);
      listeners.set(event, listener);
      return () => {
        listeners.delete(event);
      };
    },
    emit(event: string): void {
      trace.emitted.push(event);
    },
    agents: { list: (): FakeAgent[] => agents },
  };
  const ctx = {
    inject(names: readonly string[], callback: (target: unknown) => void): void {
      trace.injected.push([...names]);
      callback(scope);
    },
  };
  return {
    ctx,
    trace,
    fire(event: string, payload?: unknown): void {
      const listener = listeners.get(event);
      if (listener === undefined) throw new Error("chưa đăng ký listener cho " + event);
      listener(payload);
    },
  };
}

/**
 * Dựng một agent giả kèm móc ghi lại lần huỷ.
 * Nhận: nhãn, trạng thái sống, và provider của ngữ cảnh request gắn bền (undefined = không có ngữ cảnh).
 * Trả: agent giả đã nối móc ghi vào dấu vết của giàn.
 */
function agentOf(label: string, status: string, provider: string | null, trace: Trace): FakeAgent {
  return {
    label,
    status,
    session: {
      requestContext: (): { provider?: string } | undefined => (provider === null ? undefined : { provider }),
    },
    cancel(reason: unknown, options: unknown): void {
      trace.cancelled.push({ label, reason, options });
    },
  };
}

/**
 * Chạy cùng một kịch bản trên MỘT bản cài rồi chụp dấu vết.
 * Nhận: hàm cài chính sách cần đo, mô tả agent của giàn, và kịch bản bắn sự kiện.
 * Trả: dấu vết đã chụp (sao chép sâu để hai bên không dùng chung mảng).
 */
function runInstall<T>(
  install: (ctx: T) => void,
  agents: (trace: Trace) => FakeAgent[],
  script: (h: Harness) => void,
): Trace {
  const h = harness(agents);
  install(h.ctx as T);
  script(h);
  return JSON.parse(JSON.stringify(h.trace)) as Trace;
}

describe("bốn helper thuần: đối chứng TỪNG giá trị với chính bundle gốc", () => {
  test("mergePlatformCookies: 8 hình dạng, cùng kết quả từng ca + giá trị tuyệt đối", () => {
    const cases: [string, string][] = [
      ["", ""],
      ["a=1", ""],
      ["a=1; b=2", "b=3"],
      ["a=1;b=2", "c=3;d=4"],
      ["  a = 1 ; b = 2 ", "b=9"],
      ["=x; a=1", "; a=2"],
      ["a=1=2; b", "c="],
      ["token=abc; theme=dark", "token=def"],
    ];
    for (const [base, override] of cases) {
      expect(mergePlatformCookies(base, override)).toBe(stock.mergePlatformCookies(base, override));
    }
    expect(mergePlatformCookies("a=1; b=2", "b=3; c=4")).toBe("a=1; b=3; c=4");
    expect(mergePlatformCookies("", "")).toBe("");
  });

  test("platformWireLocale: tiểu nhãn đầu quyết định, 10 ngôn ngữ khớp bản gốc", () => {
    const locales = ["zh-CN", "zh_TW", "zh", "ZH-hant", "en-US", "en", "vi-VN", "fr-FR", "", "ZH"];
    for (const locale of locales) expect(platformWireLocale(locale) as string).toBe(stock.platformWireLocale(locale));
    expect(platformWireLocale("zh-CN")).toBe("zh_CN");
    expect(platformWireLocale("zh_TW")).toBe("zh_CN");
    expect(platformWireLocale("vi-VN")).toBe("en_US");
  });

  test("desktopClientHeaders: null ⇒ rỗng, win32 ⇒ desktop-win, darwin ⇒ desktop-mac", () => {
    for (const platform of ["darwin", "win32", null] as const) {
      expect(desktopClientHeaders(platform)).toEqual(stock.desktopClientHeaders(platform));
    }
    expect(desktopClientHeaders(null)).toEqual({});
    expect(desktopClientHeaders("win32")).toEqual({ "x-client-platform": "desktop-win" });
    expect(desktopClientHeaders("darwin")).toEqual({ "x-client-platform": "desktop-mac" });
  });

  test("platformClientHeaders: 5 header web / 6 header desktop, KỂ CẢ thứ tự khoá như bản gốc", () => {
    const client = { version: "1.4.2", locale: "zh-CN", timezoneOffsetSeconds: -25200 };
    for (const platform of ["darwin", "win32", null] as const) {
      const ours = platformClientHeaders(platform, client);
      const theirs = stock.platformClientHeaders(platform, client);
      expect(ours).toEqual(theirs);
      expect(Object.keys(ours)).toEqual(Object.keys(theirs));
    }
    expect(platformClientHeaders(null, client)).toEqual({
      "x-client-bundle-id": "",
      "x-client-platform": "web",
      "x-client-version": "1.4.2",
      "x-client-locale": "zh_CN",
      "x-client-timezone-offset": "-25200",
    });
    expect(platformClientHeaders("win32", client)["x-client-platform"]).toBe("desktop-win");
  });
});

describe("chính sách việc đang chạy khi đăng xuất", () => {
  test("isRunningAccountTask: chỉ running + provider deepseek-account, 5 hình dạng khớp bản gốc", () => {
    const shapes = [
      { status: "running", provider: "deepseek-account" },
      { status: "running", provider: "deepseek" },
      { status: "idle", provider: "deepseek-account" },
      { status: "running", provider: null },
      { status: "failed", provider: "deepseek-account" },
    ];
    for (const shape of shapes) {
      const agent = {
        status: shape.status,
        session: { requestContext: () => (shape.provider === null ? undefined : { provider: shape.provider }) },
      };
      expect(isRunningAccountTask(agent)).toBe(stock.isRunningAccountTask(agent));
    }
    const account = { status: "running", session: { requestContext: () => ({ provider: "deepseek-account" }) } };
    expect(isRunningAccountTask(account)).toBe(true);
  });

  test("cài đặt: inject ['agents'] và đăng ký ĐÚNG hai listener", () => {
    const h = harness(() => []);
    installAccountTaskCancellation(h.ctx as AccountTaskContext);
    expect(h.trace.injected).toEqual([["agents"]]);
    expect(h.trace.listeners).toEqual(["agent/error", "deepseek-account/signed-out"]);
    expect(h.trace.emitted).toEqual([]);
  });

  test("agent/error: LlmError ACCOUNT_SIGN_IN_REQUIRED ⇒ phát hướng dẫn đăng nhập; cùng dấu vết với bản gốc", () => {
    const error = new llm.LlmError("sign in first", "ACCOUNT_SIGN_IN_REQUIRED");
    const script = (h: Harness): void => h.fire("agent/error", { error });
    const ours = runInstall(installAccountTaskCancellation, () => [], script);
    const theirs = runInstall(stock.installAccountTaskCancellation, () => [], script);
    expect(ours).toEqual(theirs);
    expect(ours.emitted).toEqual(["deepseek-account/model-sign-in-required"]);
  });

  test("agent/error: mã khác HOẶC không phải LlmError ⇒ im lặng (giữ đúng phép instanceof của gốc)", () => {
    const otherCode = new llm.LlmError("rate limited", "RATE_LIMIT");
    const fakeError = Object.assign(new Error("không phải LlmError"), { code: "ACCOUNT_SIGN_IN_REQUIRED" });
    for (const error of [otherCode, fakeError]) {
      const script = (h: Harness): void => h.fire("agent/error", { error });
      const ours = runInstall(installAccountTaskCancellation, () => [], script);
      const theirs = runInstall(stock.installAccountTaskCancellation, () => [], script);
      expect(ours).toEqual(theirs);
      expect(ours.emitted).toEqual([]);
    }
  });

  test("deepseek-account/signed-out: huỷ ĐÚNG việc đang chạy đi tuyến tài khoản, kèm keepInbox", () => {
    const agents = (trace: Trace): FakeAgent[] => [
      agentOf("dang-chay-tai-khoan", "running", "deepseek-account", trace),
      agentOf("dang-chay-provider-khac", "running", "deepseek", trace),
      agentOf("dung-yen-tai-khoan", "idle", "deepseek-account", trace),
      agentOf("khong-ngu-canh", "running", null, trace),
    ];
    const script = (h: Harness): void => h.fire("deepseek-account/signed-out");
    const ours = runInstall(installAccountTaskCancellation, agents, script);
    const theirs = runInstall(stock.installAccountTaskCancellation, agents, script);
    expect(ours).toEqual(theirs);
    expect(ours.cancelled).toEqual([
      {
        label: "dang-chay-tai-khoan",
        reason: { kind: "hook", reason: "deepseek-account/signed-out" },
        options: { keepInbox: true },
      },
    ]);
  });
});

describe("định nghĩa Service deepseekAccount", () => {
  test("default CHÍNH LÀ lớp có tên; cùng lớp cha cordis với bản gốc", () => {
    expect(DeepSeekAccountDefault).toBe(DeepSeekAccount);
    expect(stock.default).toBe(stock.DeepSeekAccount);
    // Phép kiểm của recipe §2b: hai bên phải có CÙNG lớp cha (một thể hiện Service của kernel).
    expect(Object.getPrototypeOf(DeepSeekAccount)).toBe(Object.getPrototypeOf(stock.DeepSeekAccount));
    expect(Object.getOwnPropertyNames(DeepSeekAccount.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.DeepSeekAccount.prototype).sort(),
    );
  });

  test("khởi tạo: đăng ký dưới tên 'deepseekAccount' và giữ nguyên ctx, y bản gốc", () => {
    const provided: [string, unknown][] = [];
    const ctx = { reflect: { provide: (name: string, service: unknown): void => void provided.push([name, service]) } };
    const construct = (ctor: new (target: unknown) => { name: string }, target: unknown): { name: string } => new ctor(target);
    const ours = construct(DeepSeekAccount as unknown as new (target: unknown) => { name: string }, ctx);
    const theirs = construct(stock.DeepSeekAccount, ctx);
    expect(ours.name).toBe("deepseekAccount");
    expect(ours.name).toBe(theirs.name);
    expect(provided.map(([name]) => name)).toEqual(["deepseekAccount", "deepseekAccount"]);
  });
});

describe("bề mặt gói: đo trên ARTIFACT đã build", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js)", async () => {
    const artifact = ARTIFACT;
    const text = readFileSync(artifact, "utf8");
    const ours = exportNames(text);
    const theirs = exportNames(readFileSync(new URL(STOCK, import.meta.url), "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual([
      "DeepSeekAccount",
      "default",
      "desktopClientHeaders",
      "installAccountTaskCancellation",
      "isRunningAccountTask",
      "mergePlatformCookies",
      "platformClientHeaders",
      "platformWireLocale",
    ]);
    // LUẬT một bundle ⇒ một id: artifact HOST không được đăng ký id module nào.
    expect([...text.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...text.matchAll(/__ModuleLoader__/g)].length).toBe(0);
  });

  test("luật 000e: bản gốc KHÔNG có locale/ ⇒ không có gì phải chép", () => {
    expect(existsSync(new URL("locale/", STOCK_DIR))).toBe(false);
    expect(existsSync(new URL("locale/", OURS_DIR))).toBe(false);
  });
});

/** Một manifest tối thiểu để kiểm luật peer. */
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

/**
 * Đọc một package.json trong repo.
 * Nhận: đường dẫn tương đối từ gốc repo.
 * Trả: manifest đã parse.
 */
function manifestAt(relative: string): PeerManifest {
  return JSON.parse(readFileSync(new URL("../../" + relative, import.meta.url), "utf8")) as PeerManifest;
}

describe("metadata: gbh.peers ⊆ peerDependencies (so PHẦN TỬ, có đối chứng ÂM)", () => {
  test("gói ta: mọi peer đều có trong peerDependencies, kèm phiên bản thật", () => {
    const manifest = manifestAt("packages/host/deepseek-account/package.json");
    expect(manifest.gbh?.peers).toEqual(["@deepseek-ai/cordis", "@deepseek-ai/dsh-llm"]);
    expect(missingPeers(manifest)).toEqual([]);
    for (const peer of manifest.gbh?.peers ?? []) {
      expect(typeof manifest.peerDependencies?.[peer]).toBe("string");
    }
    // Hai peer KIỂU (dsh-brand, dsh-agent) có trong peerDependencies nhưng không cần thể hiện lúc chạy.
    expect(Object.keys(manifest.peerDependencies ?? {}).sort()).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-agent",
      "@deepseek-ai/dsh-brand",
      "@deepseek-ai/dsh-llm",
    ]);
  });

  test("ĐỐI CHỨNG ÂM: thiếu một tên trong peerDependencies thì phép kiểm PHẢI bắt được", () => {
    const manifest = manifestAt("packages/host/deepseek-account/package.json");
    const broken: PeerManifest = {
      name: manifest.name,
      gbh: { peers: [...(manifest.gbh?.peers ?? []), "@deepseek-ai/dsh-agent", "@deepseek-ai/gbh-khong-ton-tai"] },
      peerDependencies: { "@deepseek-ai/cordis": "~4.0.5", "@deepseek-ai/dsh-llm": "0.2.1-alpha.4" },
    };
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/dsh-agent", "@deepseek-ai/gbh-khong-ton-tai"]);
    // Và phép kiểm KHÔNG được rỗng nghĩa: peers 2 · peerDeps 2 nhưng lệch phần tử vẫn phải ĐỎ.
    const sameCount: PeerManifest = {
      name: "x",
      gbh: { peers: ["@deepseek-ai/a", "@deepseek-ai/b"] },
      peerDependencies: { "@deepseek-ai/a": "1", "@deepseek-ai/c": "1" },
    };
    expect(missingPeers(sameCount)).toEqual(["@deepseek-ai/b"]);
  });

  test("đối chứng với 6 gói host ĐANG CHẠY: 6/6 đạt (nợ peer của settings-controller ĐÃ ĐÓNG 08/11/2026)", () => {
    // 02/11/2026: gói trùng tên "webserver" ĐÃ BỊ XOÁ; gói đang chạy là thư mục "host-webserver" (row id vẫn là
    // "webserver", stock id @deepseek-ai/dsh-host-webserver). Danh sách dưới đây dùng TÊN THƯ MỤC hiện trạng.
    const running = [
      "account-controller",
      "directory-picker-auto",
      "open-in-app",
      "plugin-inventory",
      "host-webserver",
      "settings-controller",
    ];
    const missing = new Map(
      running.map((name) => [name, missingPeers(manifestAt("packages/host/" + name + "/package.json"))]),
    );
    expect(missing.get("account-controller")).toEqual([]);
    expect(missing.get("directory-picker-auto")).toEqual([]);
    expect(missing.get("open-in-app")).toEqual([]);
    expect(missing.get("plugin-inventory")).toEqual([]);
    expect(missing.get("host-webserver")).toEqual([]);
    // 08/11/2026 §2e: dev-4 trả peerDependencies của settings-controller về id stock ⇒ hiệu tập RỖNG (nợ cũ đã đóng).
    expect(missing.get("settings-controller")).toEqual([]);
  });

  test("TEST CANH: gói CHƯA khai gbh.row (khai sớm là nhận rủi ro mount)", () => {
    const manifest = manifestAt("packages/host/deepseek-account/package.json");
    expect(manifest.gbh?.row).toBeUndefined();
  });
});
