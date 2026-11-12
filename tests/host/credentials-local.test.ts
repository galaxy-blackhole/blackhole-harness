/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-credentials-local: so tập export trên ARTIFACT,
 *      đối chứng từng hàm thuần và từng lỗi với chính bundle gốc, rồi chạy CÙNG một kịch bản
 *      dịch vụ trên hai thực thể và so cả văn bản tài liệu còn lại
 */

import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ours, {
  CREDENTIALS_FILENAME,
  DOCUMENT_VERSION,
  LocalCredentialProvider,
  parseCredentialsDocument,
  renderFlatLayoutMigration,
  resolveSpec,
  type Config,
  type CredentialsDocument,
} from "../../packages/host/credentials-local/src/index.ts";
import { buildPackage } from "../../packages/host/credentials-local/build.ts";

/** Dòng xuống dòng, để dựng tài liệu YAML mà không phải viết ký tự escape trong mã test. */
const NL = String.fromCharCode(10);

/**
 * Ghép các dòng thành một văn bản YAML.
 * Nhận: các dòng của tài liệu.
 * Trả: văn bản đã ghép bằng ký tự xuống dòng.
 */
function doc(...lines: string[]): string {
  return lines.join(NL);
}

/**
 * Tên tham chiếu đã đóng dấu — lấy ĐÚNG kiểu của seam qua chữ ký công khai của lớp provider, nên
 * test không phải import gói seam (gói đó không resolve được từ thư mục tests/).
 */
type Ref = Parameters<LocalCredentialProvider["resolve"]>[0];

/** Khoá bản ghi đã đóng dấu — như trên. */
type Key = Parameters<LocalCredentialProvider["readRecord"]>[0];

/**
 * Đóng dấu một tên tham chiếu cho test.
 * Nhận: tên tham chiếu thô.
 * Trả: giá trị đã đóng dấu (lúc chạy vẫn là chuỗi).
 */
function ref(name: string): Ref {
  return name as unknown as Ref;
}

/**
 * Đóng dấu một khoá bản ghi cho test.
 * Nhận: khoá dạng <scope>/<id>.
 * Trả: giá trị đã đóng dấu.
 */
function key(value: string): Key {
  return value as unknown as Key;
}

/** Đường dẫn bundle GỐC (chỉ đọc) — nguồn đối chứng của mọi ca trong tệp này. */
const STOCK = join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-credentials-local/lib/index.js");

/** Bản build trong repo — ARTIFACT mà phép so tập export đo trên đó. */
const OURS_LIB = join(import.meta.dir, "../../packages/host/credentials-local/lib/index.js");

/** Phần giao diện của hai lớp provider mà test chạm tới (đều có thật lúc chạy). */
interface ProviderLike {
  ctx: unknown;
  config: Config;
  spec: { filename: string; watch: boolean; debounceMs: number };
  text: string | undefined;
  values: Map<string, string>;
  records: Map<string, unknown>;
  operations: Promise<void>;
  closed: boolean;
  set(ref: Ref, value: string): Promise<void>;
  unset(ref: Ref): Promise<void>;
  resolve(ref: Ref): Promise<{ value: string; source: string } | undefined>;
  describe(ref: Ref): Promise<{ configured: boolean; source?: string; writable: boolean }>;
  readRecord(key: Key): Promise<unknown>;
  describeRecord(key: Key): Promise<{ configured: boolean; kind?: string; writable: boolean }>;
  listRecords(): Promise<readonly { key: string; kind: string }[]>;
  modifyRecord(k: Key, mutate: (current: unknown) => Promise<unknown>): Promise<unknown>;
  deleteRecord(k: Key): Promise<void>;
  loadInitial(): Promise<void>;
  refresh(): Promise<void>;
  [symbol: symbol]: unknown;
}

/** Context giả tối thiểu: ghi lại service đã đăng ký, cảnh báo và sự kiện đã phát. */
interface FakeContext {
  /** Context truyền cho lớp provider. */
  ctx: unknown;
  /** Sự kiện đã phát vào seam, theo thứ tự. */
  events: { event: string; subject: unknown }[];
  /** Cảnh báo đã ghi qua logger. */
  warnings: unknown[][];
  /** Tên service đã đăng ký qua reflect.provide. */
  provided: string | undefined;
  /** Đăng ký một listener cho một sự kiện của seam. */
  listen(event: string, listener: (subject: unknown) => void): void;
}

/**
 * Dựng context giả: đủ để một Service của cordis đăng ký, và đủ để seam credentials phát sự kiện.
 * Nhận: ảnh chụp môi trường mà khoá launchEnvironment sẽ trả (có thể bỏ trống).
 * Trả: context giả kèm sổ ghi sự kiện.
 */
function fakeContext(launchEnvironment?: unknown): FakeContext {
  const events: { event: string; subject: unknown }[] = [];
  const warnings: unknown[][] = [];
  const listeners = new Map<string, ((subject: unknown) => void)[]>();
  const state: FakeContext = {
    ctx: undefined,
    events,
    warnings,
    provided: undefined,
    listen(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
  };
  state.ctx = {
    get: (name: string) => (name === "launchEnvironment" ? launchEnvironment : undefined),
    reflect: {
      provide: (name: string) => {
        state.provided = name;
      },
    },
    logger: {
      info: (...args: unknown[]) => {
        void args;
      },
      warn: (...args: unknown[]) => {
        warnings.push(args);
      },
    },
    events: {
      dispatch: (_mode: string, args: unknown[]) => {
        const event = String((args as unknown[])[0]);
        const subject = (args as unknown[])[1];
        events.push({ event, subject });
        return listeners.get(event) ?? [];
      },
    },
  };
  return state;
}

/** Ảnh chụp môi trường lúc khởi động, dựng theo hình dạng thật của launcher. */
function launchEnvironment(layers: { source: string; values: Record<string, string> }[]): unknown {
  return {
    getFrom: (name: string, sources: readonly string[]) => {
      for (const source of ["process", "project-env", "user-env"]) {
        if (!sources.includes(source)) continue;
        const value = layers.find((layer) => layer.source === source)?.values[name];
        if (value !== undefined) return { value, source };
      }
      return undefined;
    },
  };
}

/**
 * Dựng một thực thể provider mà KHÔNG chạy constructor cordis (constructor cần Context thật của
 * kernel), chỉ gắn các trường nội bộ đúng như constructor làm — áp dụng cho CẢ hai lớp.
 * Nhận: lớp cần dựng, context giả và cấu hình.
 * Trả: thực thể với các trường nội bộ đã ở trạng thái ban đầu.
 */
function instantiate(ctor: unknown, ctx: unknown, config: Config): ProviderLike {
  const instance = Object.create((ctor as { prototype: object }).prototype) as ProviderLike;
  instance.ctx = ctx;
  instance.config = config;
  instance.spec = resolveSpec(config);
  instance.text = undefined;
  instance.values = new Map();
  instance.records = new Map();
  instance.operations = Promise.resolve();
  instance.closed = false;
  return instance;
}

/**
 * Chạy một thao tác và ghi lại kết quả hoặc lỗi của nó.
 * Nhận: hàm cần chạy.
 * Trả: nhãn ok kèm giá trị, hoặc nhãn lỗi kèm tên lớp lỗi và thông điệp.
 */
async function outcome(run: () => unknown): Promise<unknown> {
  try {
    return { ok: await run() };
  } catch (error) {
    const shape = error as { constructor?: { name?: string }; message?: string };
    return { error: shape.constructor?.name ?? "Error", message: shape.message ?? "" };
  }
}

/** Thư mục tạm riêng cho một ca test. */
async function tempDir(tag: string): Promise<string> {
  return mkdtemp(join(tmpdir(), "gbh-cred-" + tag + "-"));
}

/**
 * Chạy MỘT kịch bản dịch vụ cố định trên một thực thể, ghi lại mọi kết quả quan sát được.
 * Nhận: thực thể provider cần chạy.
 * Trả: bản ghi kết quả theo đúng thứ tự thao tác (để hai bên so với nhau).
 */
async function scenario(p: ProviderLike): Promise<unknown[]> {
  const out: unknown[] = [];
  out.push(await outcome(() => p.resolve(ref("GBH_ONLY_ENV"))));
  out.push(await outcome(() => p.resolve(ref("GBH_ONLY_PROJECT"))));
  out.push(await outcome(() => p.resolve(ref("GBH_MISSING"))));
  out.push(await outcome(() => p.describe(ref("GBH_MISSING"))));
  out.push(await outcome(() => p.set(ref("GBH_NEW"), "v1")));
  out.push(await outcome(() => p.resolve(ref("GBH_NEW"))));
  out.push(await outcome(() => p.describe(ref("GBH_NEW"))));
  out.push(await outcome(() => p.set(ref("GBH_NEW"), "v2")));
  out.push(await outcome(() => p.resolve(ref("GBH_NEW"))));
  out.push(await outcome(() => p.set(ref("GBH_NEW"), "")));
  out.push(await outcome(() => p.readRecord(key("scope/id"))));
  out.push(await outcome(() => p.describeRecord(key("scope/id"))));
  out.push(await outcome(() => p.modifyRecord(key("scope/id"), async (current) => ({ kind: "grant", payload: { n: current === undefined ? 1 : 2 } }))));
  out.push(await outcome(() => p.readRecord(key("scope/id"))));
  out.push(await outcome(() => p.listRecords()));
  out.push(await outcome(() => p.modifyRecord(key("scope/id"), async () => undefined)));
  out.push(await outcome(() => p.modifyRecord(key("scope/id"), async () => ({ kind: "api-key", key: "" }))));
  out.push(await outcome(() => p.modifyRecord(key("scope/id"), async () => ({ kind: "grant", payload: { bad: Number.POSITIVE_INFINITY } }))));
  out.push(await outcome(() => p.deleteRecord(key("scope/id"))));
  out.push(await outcome(() => p.readRecord(key("scope/id"))));
  out.push(await outcome(() => p.unset(ref("GBH_NEW"))));
  out.push(await outcome(() => p.resolve(ref("GBH_NEW"))));
  return out;
}

describe("row credentials — đối chứng với bản gốc @deepseek-ai/dsh-credentials-local", () => {
  test("tập export của ARTIFACT BẰNG tập export của bundle gốc", async () => {
    await buildPackage();
    const ours = (await import(OURS_LIB)) as Record<string, unknown>;
    const stock = (await import(STOCK)) as Record<string, unknown>;
    const names = ["CREDENTIALS_FILENAME", "DOCUMENT_VERSION", "LocalCredentialProvider", "default", "parseCredentialsDocument", "renderFlatLayoutMigration", "resolveSpec"];
    expect(Object.keys(ours).sort()).toEqual(names);
    expect(Object.keys(stock).sort()).toEqual(names);
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(CREDENTIALS_FILENAME).toBe(String(stock.CREDENTIALS_FILENAME));
    expect(DOCUMENT_VERSION).toBe(Number(stock.DOCUMENT_VERSION));
    // Lớp mặc định là CÙNG một lớp được đặt tên, như bản gốc.
    expect(ours.default).toBe(ours.LocalCredentialProvider);
    expect((ours.default as { name: string }).name).toBe("LocalCredentialProvider");
    const bundle = await readFile(OURS_LIB, "utf8");
    expect(bundle.includes('id: "@deepseek-ai')).toBe(false);
  });

  test("parseCredentialsDocument TRÙNG kết quả với bản gốc trên tài liệu hợp lệ", async () => {
    const stock = (await import(STOCK)) as { parseCredentialsDocument: (text: string, filename: string) => CredentialsDocument };
    const corpus = [
      doc("version: 1", "refs:", "  GBH_GALAXY_API_KEY: sk-secret", "records:", "  client-connection/browser-session:", "    kind: grant", "    payload:", "      version: 1", "      secret: abc"),
      doc("version: 1"),
      "",
      doc("version: 1", "refs:", "  A: x", "foreign-key: 1"),
      doc("# chu thich dau tep", "version: 1", "refs:", "  A: one", "  B: two", "records:", "  s/i:", "    kind: api-key", "    key: k", "    env:", "      AWS_PROFILE: p"),
    ];
    for (const text of corpus) {
      const mine = parseCredentialsDocument(text, "/tmp/f.yaml");
      const theirs = stock.parseCredentialsDocument(text, "/tmp/f.yaml");
      expect([...mine.refs]).toEqual([...theirs.refs]);
      expect([...mine.records]).toEqual([...theirs.records]);
      expect(mine.ignoredKeys).toEqual(theirs.ignoredKeys);
    }
  });

  test("tài liệu SAI trả CÙNG thông điệp lỗi, và KHÔNG rò giá trị bí mật", async () => {
    const stock = (await import(STOCK)) as { parseCredentialsDocument: (text: string, filename: string) => CredentialsDocument };
    const bad = [
      doc("refs:", "  A: x"),
      doc("version: 2", "refs:", "  A: x"),
      doc("- a"),
      doc("version: 1", "refs:", "  A: 1"),
      doc("version: 1", "refs:", "  A: ''"),
      doc("version: 1", "refs:", "  1A: x"),
      doc("version: 1", "refs: [1]"),
      doc("version: 1", "refs:", "  A: x", "  A: y"),
      doc("version: 1", "records:", "  s:i:", "    kind: nope"),
      doc("version: 1", "records:", "  s/i:", "    kind: api-key", "    zz: 1"),
      doc("version: 1", "records:", "  s/i:", "    kind: grant"),
      doc("version: 1", "records:", "  s/i:", "    kind: api-key", "    env: x"),
      doc("version: 1", "records:", "  s/i:", "    kind: api-key", "    env:", "      A: ''"),
      doc("version: 1", "records:", "  s i:", "    kind: api-key"),
      doc("version: 1", "refs:", "  SECRET_NAME: super-secret-value", "  broken: ["),
    ];
    for (const text of bad) {
      const mine = await outcome(() => parseCredentialsDocument(text, "/tmp/f.yaml"));
      const theirs = await outcome(() => stock.parseCredentialsDocument(text, "/tmp/f.yaml"));
      expect(mine).toEqual(theirs);
      expect((mine as { error: string }).error).not.toBe("none");
      // An ninh: chẩn đoán KHÔNG được chứa giá trị bí mật của tài liệu.
      expect(String((mine as { message: string }).message)).not.toContain("super-secret-value");
    }
  });

  test("nâng cấp bố cục phẳng TRÙNG TỪNG BYTE, và từ chối đúng những gì bản gốc từ chối", async () => {
    const stock = (await import(STOCK)) as { renderFlatLayoutMigration: (text: string) => string | undefined };
    const corpus = [
      doc("A: one", "B: two"),
      doc("# chu thich", "", "A: one", ""),
      doc("A: one"),
      doc("version: 1", "refs:", "  A: one"),
      doc("- not", "- a", "- mapping"),
      doc("A: 1"),
      "",
      doc("---", "A: one"),
    ];
    for (const text of corpus) {
      const mine = renderFlatLayoutMigration(text);
      const theirs = stock.renderFlatLayoutMigration(text);
      expect(mine).toBe(theirs);
    }
    // Đầu vào KHÔNG có dòng cuối thì bản viết lại tự thêm một dòng cuối, y bản gốc.
    expect(renderFlatLayoutMigration(doc("A: one", "B: two"))).toBe(doc("version: 1", "refs:", "  A: one", "  B: two") + NL);
    expect(renderFlatLayoutMigration(doc("A: one") + NL)).toBe(doc("version: 1", "refs:", "  A: one") + NL);
  });

  test("cùng kịch bản dịch vụ cho CÙNG kết quả, và CÙNG văn bản tài liệu trên đĩa", async () => {
    const stock = (await import(STOCK)) as { default: unknown };
    const corpus: unknown[] = [];
    for (const [tag, ctor] of [["ours", LocalCredentialProvider], ["stock", stock.default]] as [string, unknown][]) {
      const dir = await tempDir(tag);
      const file = join(dir, "credentials.yaml");
      await writeFile(file, doc("version: 1", "refs:", "  GBH_KEEP: keep-me", "# chu thich cua A", "  GBH_EDIT: before", "records:", "  keep/one:", "    kind: grant", "    payload:", "      a: 1", ""), { mode: 0o600 });
      const state = fakeContext(
        launchEnvironment([
          { source: "process", values: { GBH_ONLY_ENV: "from-env", GBH_KEEP: "env-value" } },
          { source: "project-env", values: { GBH_ONLY_PROJECT: "from-project" } },
        ]),
      );
      const instance = instantiate(ctor, state.ctx, { path: file, watch: false });
      const transcript = await scenario(instance);
      const text = await readFile(file, "utf8");
      corpus.push({ transcript, text, events: state.events, warnings: state.warnings.length });
    }
    expect(corpus[0]).toEqual(corpus[1]);
    // Bất biến theo chiều sâu: giá trị đã lưu thắng môi trường, và mục không bị chạm còn nguyên.
    const text = (corpus[0] as { text: string }).text;
    expect(text).toContain("keep-me");
    expect(text).toContain("# chu thich cua A");
    expect(text).toContain("keep/one");
    // GBH_NEW đã được đặt rồi GỠ trong kịch bản, nên tài liệu cuối KHÔNG còn nó.
    expect(text).not.toContain("GBH_NEW");
    expect((corpus[0] as { transcript: unknown[] }).transcript).toContainEqual({ ok: { value: "v1", source: "file" } });
    expect((corpus[0] as { events: { event: string }[] }).events.map((entry) => entry.event)).toContain("credentials/reference-updated");
    expect((corpus[0] as { events: { event: string }[] }).events.map((entry) => entry.event)).toContain("credentials/record-updated");
  });

  test("an ninh: tệp ai cũng đọc được bị TỪ CHỐI bằng đúng thông điệp của bản gốc", async () => {
    const stock = (await import(STOCK)) as { default: unknown };
    const results: unknown[] = [];
    const dir = await tempDir("perm");
    const file = join(dir, "credentials.yaml");
    await writeFile(file, doc("version: 1"), { mode: 0o600 });
    await chmod(file, 0o644);
    for (const ctor of [LocalCredentialProvider, stock.default] as unknown[]) {
      const state = fakeContext();
      const instance = instantiate(ctor, state.ctx, { path: file, watch: false });
      results.push({ refused: await outcome(() => instance.loadInitial()) });
    }
    await chmod(file, 0o600);
    for (const ctor of [LocalCredentialProvider, stock.default] as unknown[]) {
      const state = fakeContext();
      const instance = instantiate(ctor, state.ctx, { path: file, watch: false });
      results.push({ accepted: await outcome(() => instance.loadInitial()) });
    }
    expect(results[0]).toEqual(results[1]);
    expect(results[2]).toEqual(results[3]);
    expect((results[0] as { refused: { message: string } }).refused.message).toContain("is readable beyond its owner");
    expect((results[0] as { refused: { message: string } }).refused.message).toContain("chmod 600");
  });

  test("dispose: mọi lối ghi bị từ chối bằng đúng thông điệp của bản gốc", async () => {
    const stock = (await import(STOCK)) as { default: unknown };
    const results: unknown[] = [];
    for (const [tag, ctor] of [["ours", LocalCredentialProvider], ["stock", stock.default]] as [string, unknown][]) {
      const dir = await tempDir(tag);
      const file = join(dir, "credentials.yaml");
      const state = fakeContext();
      const instance = instantiate(ctor, state.ctx, { path: file, watch: false });
      await instance.loadInitial();
      instance.closed = true;
      results.push({
        set: await outcome(() => instance.set(ref("A"), "v")),
        unset: await outcome(() => instance.unset(ref("A"))),
        modify: await outcome(() => instance.modifyRecord(key("s/i"), async () => ({ kind: "grant", payload: 1 }))),
        delete: await outcome(() => instance.deleteRecord(key("s/i"))),
        resolve: await outcome(() => instance.resolve(ref("A"))),
      });
    }
    expect(results[0]).toEqual(results[1]);
    expect((results[0] as { set: { message: string } }).set.message).toContain("is disposed: cannot set");
  });

  test("vòng đời thật qua Service.init: nạp tệp, phát thay đổi khi tệp bị sửa từ ngoài", async () => {
    const dir = await tempDir("watch");
    const file = join(dir, "credentials.yaml");
    await writeFile(file, doc("version: 1", "refs:", "  GBH_WATCH: before"), { mode: 0o600 });
    const state = fakeContext();
    const provider = new LocalCredentialProvider(state.ctx as never, { path: file, watch: true, debounceMs: 20 });
    expect(state.provided).toBe("credentials");
    const init = (LocalCredentialProvider as unknown as { init: symbol }).init;
    const factory = (provider as unknown as { [key: symbol]: unknown })[init] as
      | (() => AsyncGenerator<() => Promise<void> | void, void, void>)
      | undefined;
    if (factory === undefined) throw new Error("không thấy [Service.init] trên lớp provider");
    const lifecycle = factory.call(provider);
    await lifecycle.next();
    await lifecycle.next();
    expect(await provider.resolve(ref("GBH_WATCH"))).toEqual({ value: "before", source: "file" });
    await writeFile(file, doc("version: 1", "refs:", "  GBH_WATCH: after"), { mode: 0o600 });
    const deadline = Date.now() + 5_000;
    while ((await provider.resolve(ref("GBH_WATCH")))?.value !== "after" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(await provider.resolve(ref("GBH_WATCH"))).toEqual({ value: "after", source: "file" });
    expect(state.events.map((entry) => entry.event)).toContain("credentials/reference-updated");
    await lifecycle.next();
    expect(state.warnings).toEqual([]);
  });

  });
