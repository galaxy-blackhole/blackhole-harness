/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-subprocess: bộ đối chứng TRỰC TIẾP với chính bundle gốc
 *      (@deepseek-ai/dsh-subprocess) — tập export đo trên ARTIFACT, hàm khử môi trường cha, seam
 *      ctx.subprocess trên Context cordis THẬT, kênh điều khiển thừa kế, và quy ước gbh.peers ⊆ peerDependencies
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/subprocess/build.ts";
import subprocessDefault, {
  DSH_ENV_PREFIX,
  SENSITIVE_ENV_PATTERN,
  SubprocessExecutableNotFoundError,
  SubprocessRuntime,
  scrubbedParentEnv,
} from "../../packages/host/subprocess/src/index.ts";
import type {
  SubprocessHandle,
  SubprocessTerminalEnvironment,
  SubprocessTerminalHandle,
} from "../../packages/host/subprocess/src/index.ts";
import {
  SUBPROCESS_CONTROL_ENV,
  SUBPROCESS_CONTROL_FD,
  openInheritedControlChannel,
} from "../../packages/host/subprocess/src/control.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-subprocess/lib/index.js";
/** Đầu ra thứ hai của bản gốc: kênh điều khiển thừa kế (subpath `./control`). */
const STOCK_CONTROL = "../../apps/host/node_modules/@deepseek-ai/dsh-subprocess/lib/control.js";
/** Cordis THẬT của kernel — cần Context thật thì `Service` mới đăng ký được dịch vụ. */
const CORDIS = "../../apps/host/node_modules/@deepseek-ai/cordis/lib/index.js";
/** Gói proxy của kernel — nguồn DUY NHẤT của chính sách proxy cho tiến trình con. */
const PROXY = "../../apps/host/node_modules/@deepseek-ai/dsh-http-proxy/lib/index.js";

/** Hình dạng bản gốc mà các ca test cần (nạp động nên tsc không kéo kiểu của nó vào chương trình). */
interface StockModule {
  /** Tiền tố namespace môi trường do harness quản lý. */
  DSH_ENV_PREFIX: "DSH_";
  /** Heuristic tên biến môi trường có hình dạng credential. */
  SENSITIVE_ENV_PATTERN: RegExp;
  /** Lớp trừu tượng của seam. */
  SubprocessRuntime: typeof SubprocessRuntime;
  /** Lỗi tra executable không thấy. */
  SubprocessExecutableNotFoundError: typeof SubprocessExecutableNotFoundError;
  /** Export mặc định của gói gốc. */
  default: typeof SubprocessRuntime;
  /** Hàm khử môi trường cha. */
  scrubbedParentEnv: () => Record<string, string>;
}

/** Hình dạng đầu ra `lib/control.js` của bản gốc. */
interface StockControlModule {
  /** Descriptor dành cho kênh điều khiển. */
  SUBPROCESS_CONTROL_FD: number;
  /** Dấu khởi chạy riêng tư. */
  SUBPROCESS_CONTROL_ENV: string;
  /** Mở kênh điều khiển thừa kế. */
  openInheritedControlChannel: () => unknown;
}

/** Hình dạng cordis mà phép kiểm cần. */
interface CordisModule {
  /** Context thật (fiber gốc). */
  Context: new () => unknown;
  /** Lớp Service mà seam phải kế thừa. */
  Service: unknown;
}

/** Hình dạng gói proxy mà phép kiểm cần. */
interface ProxyModule {
  /** Cài chính sách proxy của tiến trình; trả hàm dọn. */
  installProxyFromEnvironment(
    env: { get(name: string): { value: string } | undefined },
    report: (message: string) => void,
  ): Promise<() => Promise<void>>;
  /** Lớp phủ môi trường mà tiến trình con cần. */
  proxyEnvironmentForChild(): Readonly<Record<string, string | undefined>>;
}

/** Context cordis tối thiểu để đọc dịch vụ đã đăng ký. */
interface FakeContext {
  /** Chỗ ngồi của seam khi đã đăng ký. */
  subprocess?: { name?: string };
}

const stock = (await import(STOCK)) as StockModule;
const stockControl = (await import(STOCK_CONTROL)) as StockControlModule;
const cordis = (await import(CORDIS)) as CordisModule;
const proxy = (await import(PROXY)) as ProxyModule;

/** Đường dẫn artifact `lib/index.js` của TA (đã build trong beforeAll). */
let artifact = "";
/** Đường dẫn artifact `lib/control.js` của TA. */
let controlArtifact = "";

/** Thư mục dựng artifact của ta (dọn ở afterAll). */
let OUT_DIR = "";

/** Artefact của ta, nạp với peer trỏ về kernel: nguồn của các phép so DANH TÍNH LỚP + trạng thái proxy. */
let surface: { SubprocessRuntime: typeof SubprocessRuntime; scrubbedParentEnv: () => Record<string, string> };

beforeAll(async () => {
  const out = mkdtempSync(join(tmpdir(), "gbh-subprocess-"));
  OUT_DIR = out;
  artifact = await buildPackage(out);
  controlArtifact = join(out, "control.js");
  // Nạp artefact với peer = KERNEL (pattern tests/host/shell.test.ts): nạp từ src/ hay lib/ trong workspace
  // thì `cordis`/`dsh-http-proxy` trỏ về bản .bun của workspace — hai lớp Service, hai trạng thái proxy.
  // build.ts xoá sạch outDir nên symlink phải dựng SAU khi build xong.
  mkdirSync(join(out, "node_modules"), { recursive: true });
  symlinkSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), join(out, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(out, "node_modules", "@galaxy-blackhole"), "dir");
  surface = (await import(artifact)) as typeof surface;
});

afterAll(() => {
  if (OUT_DIR !== "") rmSync(OUT_DIR, { recursive: true, force: true });
});

/**
 * Liệt kê tên export của một file ESM đã build — DÙNG ĐÚNG hai regex mà `check:rows` dùng.
 * Nhận: nội dung file đã build.
 * Trả: tên export đã sắp xếp, gồm cả `default`.
 */
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

/** Một mục môi trường cần đặt/tháo cho một ca test. */
type EnvPatch = Record<string, string | undefined>;

/**
 * Đặt tạm một bộ biến môi trường rồi KHÔI PHỤC nguyên trạng sau khi chạy xong (kể cả khi ném).
 * Nhận: các mục cần đặt (`undefined` = xoá) và hàm cần chạy trong môi trường đó.
 * Trả: giá trị hàm đó trả về.
 */
function withEnv<T>(patch: EnvPatch, run: () => T): T {
  const saved = new Map<string, string | undefined>();
  for (const name of Object.keys(patch)) saved.set(name, process.env[name]);
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return run();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(REPO, "packages/host/subprocess/package.json");

/** Peer NGOÀI hai tên mà `mount.ts` luôn tự thêm (cordis, schemastery) — danh sách ĐÓNG của riêng gói này. */
const SEAM_PEERS = ["@deepseek-ai/dsh-http-proxy"];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Metadata của ta để `bh host` sinh khối patch. */
  gbh?: { peers?: string[]; row?: unknown };
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import` — `tests/` không resolve được `@deepseek-ai/*`).
 * Nhận: không.
 * Trả: manifest đã ép kiểu.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((name) => !declared.has(name)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * Nhận: manifest gốc.
 * Trả: bản sao độc lập.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", () => {
    const ours = exportNames(readFileSync(artifact, "utf8"));
    const theirs = exportNames(readFileSync(new URL(STOCK, import.meta.url), "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual([
      "DSH_ENV_PREFIX",
      "SENSITIVE_ENV_PATTERN",
      "SubprocessExecutableNotFoundError",
      "SubprocessRuntime",
      "default",
      "scrubbedParentEnv",
    ]);
  });

  test("đầu ra THỨ HAI (kênh điều khiển) cũng khớp tập export bản gốc", () => {
    const ours = exportNames(readFileSync(controlArtifact, "utf8"));
    const theirs = exportNames(readFileSync(new URL(STOCK_CONTROL, import.meta.url), "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual(["SUBPROCESS_CONTROL_ENV", "SUBPROCESS_CONTROL_FD", "openInheritedControlChannel"]);
    // Hình dạng bản gốc có ĐÚNG HAI đầu ra; thiếu `control.js` thì consumer `/control` trượt bảng module.
    expect(existsSync(controlArtifact)).toBe(true);
  });

  test("artifact KHÔNG đăng ký id module của gói gốc, KHÔNG chứa gói bị cấm, và giữ peer ở dạng import NGOÀI", () => {
    const indexText = readFileSync(artifact, "utf8");
    for (const text of [indexText, readFileSync(controlArtifact, "utf8")]) {
      expect(/id:\s*["']@deepseek-ai/.test(text)).toBe(false);
      expect(text.includes("@galaxy-stack/ai-coder-core")).toBe(false);
    }
    // Peer do kernel cấp MỘT thể hiện: phải là import ngoài, không bị bundle nhúng vào.
    expect(indexText).toContain('from "@deepseek-ai/cordis"');
    expect(indexText).toContain('from "@deepseek-ai/dsh-http-proxy"');
    // Chính sách proxy phải ĐI QUA gói proxy của kernel (một nguồn sự thật), không tự cài lại ở đây.
    expect(indexText).toContain("proxyEnvironmentForChild(");
    expect(indexText).not.toContain("NODE_USE_ENV_PROXY");
    expect(readFileSync(new URL(STOCK, import.meta.url), "utf8")).not.toContain("NODE_USE_ENV_PROXY");
  });

  test("hằng số: tiền tố DSH_ và mẫu credential khớp bản gốc từng giá trị", () => {
    expect(DSH_ENV_PREFIX).toBe(stock.DSH_ENV_PREFIX);
    expect(DSH_ENV_PREFIX).toBe("DSH_");
    expect(String(SENSITIVE_ENV_PATTERN)).toBe(String(stock.SENSITIVE_ENV_PATTERN));
    expect(String(SENSITIVE_ENV_PATTERN)).toBe("/KEY|PASSWORD|SECRET|TOKEN/i");
    expect(SENSITIVE_ENV_PATTERN.global).toBe(false);
  });
});

describe("scrubbedParentEnv: đối chứng TỪNG KHOÁ với bản gốc", () => {
  test("tên có hình dạng credential bị KHỬ; tên thường sống sót (cùng kết quả với gốc)", () => {
    const patch: EnvPatch = {
      DEEPSEEK_API_KEY: "sk-khong-duoc-ro",
      my_token: "tok",
      Password: "p",
      client_secret: "s",
      KEYBOARD_LAYOUT: "us",
      GBH_ORDINARY_ONE: "giu-nguyen",
    };
    withEnv(patch, () => {
      const ours = scrubbedParentEnv();
      expect(ours).toEqual(stock.scrubbedParentEnv());
      for (const name of ["DEEPSEEK_API_KEY", "my_token", "Password", "client_secret", "KEYBOARD_LAYOUT"]) {
        expect(Object.keys(ours)).not.toContain(name);
      }
      expect(ours.GBH_ORDINARY_ONE).toBe("giu-nguyen");
      expect(ours.PATH).toBe(process.env.PATH);
    });
  });

  test("mọi tên DSH_* bị KHỬ (kể cả viết thường); tên chỉ CHỨA DSH_ ở giữa thì sống sót", () => {
    const patch: EnvPatch = { DSH_HOME: "/tmp/home", DSH_PROFILE: "blackhole", dsh_home: "/tmp/khac", XDSH_HOME: "/tmp/giu" };
    withEnv(patch, () => {
      const ours = scrubbedParentEnv();
      expect(ours).toEqual(stock.scrubbedParentEnv());
      for (const name of ["DSH_HOME", "DSH_PROFILE", "dsh_home"]) expect(Object.keys(ours)).not.toContain(name);
      expect(ours.XDSH_HOME).toBe("/tmp/giu");
    });
  });

  test("giá trị được giữ NGUYÊN VĂN (UTF-8, khoảng trắng, chuỗi rỗng) — không trim, không mã hoá lại", () => {
    const patch: EnvPatch = { GBH_UNICODE_ONE: "tiếng Việt – ế", GBH_SPACES_ONE: "  a b  ", GBH_EMPTY_ONE: "" };
    withEnv(patch, () => {
      const ours = scrubbedParentEnv();
      expect(ours).toEqual(stock.scrubbedParentEnv());
      expect(ours.GBH_UNICODE_ONE).toBe("tiếng Việt – ế");
      expect(ours.GBH_SPACES_ONE).toBe("  a b  ");
      expect(ours.GBH_EMPTY_ONE).toBe("");
    });
  });

  test("ĐỐI CHỨNG ÂM: bước khử DSH_ phải KHÔNG phân biệt hoa thường (khử bằng so khớp thường sẽ hở)", () => {
    expect("dsh_home".startsWith(DSH_ENV_PREFIX)).toBe(false);
    expect("dsh_home".toUpperCase().startsWith(DSH_ENV_PREFIX)).toBe(true);
    withEnv({ dsh_home: "/tmp/khong-duoc-ro" }, () => {
      expect(Object.keys(scrubbedParentEnv())).not.toContain("dsh_home");
      expect(Object.keys(stock.scrubbedParentEnv())).not.toContain("dsh_home");
    });
  });

  test("mỗi lượt gọi trả một đối tượng MỚI (bên gọi sửa không làm hỏng lượt sau)", () => {
    const first = scrubbedParentEnv();
    const second = scrubbedParentEnv();
    expect(first).not.toBe(second);
    first.GBH_MUTATION_TEST = "x";
    expect(second.GBH_MUTATION_TEST).toBeUndefined();
  });
});

describe("proxy: tiến trình con thừa hưởng đúng chính sách proxy của tiến trình cha", () => {
  test("khi có proxy hoạt động: lớp phủ proxy đi qua ĐÚNG gói proxy của kernel, khớp gốc từng khoá", async () => {
    const baseline = scrubbedParentEnv();
    expect(baseline).toEqual(stock.scrubbedParentEnv());
    expect(baseline.NODE_USE_ENV_PROXY).toBeUndefined();

    const lookup = {
      get(name: string): { value: string } | undefined {
        const value = name === "HTTP_PROXY" ? "http://127.0.0.1:9" : undefined;
        return value === undefined ? undefined : { value };
      },
    };
    const dispose = await proxy.installProxyFromEnvironment(lookup, () => undefined);
    try {
      // Đo trên ARTIFACT (peer = kernel): chỉ khi đó ta mới thấy CÙNG trạng thái proxy mà kernel vừa cài.
      const ours = surface.scrubbedParentEnv();
      const theirs = stock.scrubbedParentEnv();
      expect(ours).toEqual(theirs);
      expect(ours.NODE_USE_ENV_PROXY).toBe("1");
      expect(ours.http_proxy).toBe("http://127.0.0.1:9");
      expect(ours.HTTP_PROXY).toBe("http://127.0.0.1:9");
      expect(ours.no_proxy).toContain("127.0.0.1");
      // ĐỐI CHỨNG ÂM: lớp phủ THẬT SỰ sống — nếu ta tự cài lại chính sách thì hai bên sẽ khác nhau.
      expect(ours).not.toEqual(baseline);
      expect(proxy.proxyEnvironmentForChild().NODE_USE_ENV_PROXY).toBe("1");
    } finally {
      // bun + undici bản cài này: `agent.close` không tồn tại ⇒ hàm dọn ném SAU khi đã khôi phục env.
      // Env mới là thứ phép kiểm này cần sạch, nên nuốt đúng lỗi đó và khẳng định lại ở dưới.
      try {
        await dispose();
      } catch {
        /* env đã được khôi phục TRƯỚC dòng ném của `installGlobalProxy`. */
      }
    }
    expect(scrubbedParentEnv()).toEqual(baseline);
  });

  test("không có proxy: lớp phủ RỖNG, và hai bản cho CÙNG một đối tượng môi trường", () => {
    expect(proxy.proxyEnvironmentForChild()).toEqual({});
    expect(scrubbedParentEnv()).toEqual(stock.scrubbedParentEnv());
  });
});

describe("SubprocessRuntime: seam đăng ký ctx.subprocess, kế thừa ĐÚNG lớp Service của kernel", () => {
  test("quan hệ kế thừa + hình dạng prototype khớp bản gốc (phép kiểm mục 2b của công thức)", () => {
    // Đo trên ARTIFACT (peer = kernel) — nạp src/ thì lớp nền là bản .bun của workspace, khác realpath kernel.
    const Seam = surface.SubprocessRuntime;
    expect(Object.getPrototypeOf(Seam)).toBe(cordis.Service);
    expect(Object.getPrototypeOf(stock.SubprocessRuntime)).toBe(cordis.Service);
    expect(Object.getPrototypeOf(Seam)).toBe(Object.getPrototypeOf(stock.SubprocessRuntime));
    expect(Seam.name).toBe(stock.SubprocessRuntime.name);
    expect(Seam.length).toBe(stock.SubprocessRuntime.length);
    // Bản gốc KHÔNG cài đặt phương thức nào trên prototype (4 phương thức là trừu tượng, bị xoá khi build).
    expect(Object.getOwnPropertyNames(SubprocessRuntime.prototype)).toEqual(
      Object.getOwnPropertyNames(stock.SubprocessRuntime.prototype),
    );
    expect(subprocessDefault).toBe(SubprocessRuntime);
    // Mỗi bản có lớp mặc định RIÊNG (đúng như bản gốc): export default của gói gốc là lớp CỦA NÓ.
    expect(stock.default).toBe(stock.SubprocessRuntime);
  });

  test("đăng ký ctx.subprocess trên Context cordis THẬT; bản thứ hai NÉM đúng thông điệp như gốc", () => {
    const ctx = new cordis.Context() as unknown as FakeContext;
    class OurImpl extends SubprocessRuntime {
      // Bốn phương thức trừu tượng của seam: ca này CHỈ kiểm việc đăng ký dịch vụ, nên chúng ném khi bị gọi.
      override async resolveExecutable(): Promise<string> {
        throw new Error("khong dung trong test");
      }
      override async terminalEnvironment(): Promise<SubprocessTerminalEnvironment> {
        throw new Error("khong dung trong test");
      }
      override spawn(): SubprocessHandle {
        throw new Error("khong dung trong test");
      }
      override async spawnTerminal(): Promise<SubprocessTerminalHandle> {
        throw new Error("khong dung trong test");
      }
    }
    const instance = new OurImpl(ctx as never);
    expect(instance.name).toBe("subprocess");
    expect(ctx.subprocess?.name).toBe("subprocess");

    let oursError: unknown;
    try {
      new OurImpl(ctx as never);
    } catch (error) {
      oursError = error;
    }

    const stockCtx = new cordis.Context() as unknown as FakeContext;
    class StockImpl extends stock.SubprocessRuntime {
      // Cùng bốn stub: bản gốc cũng là lớp TRỪU TƯỢNG với đúng bốn phương thức này.
      override async resolveExecutable(): Promise<string> {
        throw new Error("khong dung trong test");
      }
      override async terminalEnvironment(): Promise<SubprocessTerminalEnvironment> {
        throw new Error("khong dung trong test");
      }
      override spawn(): SubprocessHandle {
        throw new Error("khong dung trong test");
      }
      override async spawnTerminal(): Promise<SubprocessTerminalHandle> {
        throw new Error("khong dung trong test");
      }
    }
    new StockImpl(stockCtx as never);
    let stockError: unknown;
    try {
      new StockImpl(stockCtx as never);
    } catch (error) {
      stockError = error;
    }

    expect(String((oursError as Error).message)).toBe(String((stockError as Error).message));
    expect(String((oursError as Error).message)).toContain('service "subprocess" has been registered');
    expect(oursError instanceof Error).toBe(true);
  });
});

describe("SubprocessExecutableNotFoundError: tên ổn định, giữ nguyên lỗi gốc", () => {
  test("name · message · cause · chuỗi prototype khớp bản gốc", () => {
    const cause = new Error("lookup failed");
    const ours = new SubprocessExecutableNotFoundError("khong thay bash", { cause });
    const theirs = new stock.SubprocessExecutableNotFoundError("khong thay bash", { cause });
    expect(ours.name).toBe(theirs.name);
    expect(ours.name).toBe("SubprocessExecutableNotFoundError");
    expect(ours.message).toBe(theirs.message);
    expect(ours.cause).toBe(theirs.cause);
    expect(ours instanceof Error).toBe(true);
    expect(Object.getPrototypeOf(ours)).toBe(SubprocessExecutableNotFoundError.prototype);
    expect(SubprocessExecutableNotFoundError.name).toBe(stock.SubprocessExecutableNotFoundError.name);
    // Không có `options`: vẫn dựng được, và cause vắng mặt như gốc.
    expect(new SubprocessExecutableNotFoundError("x").cause).toBeUndefined();
  });
});

describe("control: kênh điều khiển thừa kế (subpath ./control của bản gốc)", () => {
  test("hằng số khớp bản gốc từng giá trị", () => {
    expect(SUBPROCESS_CONTROL_FD).toBe(stockControl.SUBPROCESS_CONTROL_FD);
    expect(SUBPROCESS_CONTROL_FD).toBe(7);
    expect(SUBPROCESS_CONTROL_ENV).toBe(stockControl.SUBPROCESS_CONTROL_ENV);
    expect(SUBPROCESS_CONTROL_ENV).toBe("DSH_SUBPROCESS_CONTROL");
  });

  test("thiếu dấu khởi chạy ⇒ NÉM đúng thông điệp như gốc, KHÔNG treo", () => {
    withEnv({ [SUBPROCESS_CONTROL_ENV]: undefined }, () => {
      expect(() => openInheritedControlChannel()).toThrow("subprocess control channel was not inherited");
      expect(() => stockControl.openInheritedControlChannel()).toThrow("subprocess control channel was not inherited");
    });
  });

  test("dấu khởi chạy bị TIÊU THỤ trước khi kiểm giá trị (thứ tự của bản gốc)", () => {
    withEnv({ [SUBPROCESS_CONTROL_ENV]: "khong-phai-pipe" }, () => {
      expect(() => openInheritedControlChannel()).toThrow("subprocess control channel was not inherited");
      // Bản gốc xoá dấu TRƯỚC khi so giá trị ⇒ giá trị sai cũng KHÔNG còn trong môi trường.
      expect(process.env[SUBPROCESS_CONTROL_ENV]).toBeUndefined();
      process.env[SUBPROCESS_CONTROL_ENV] = "khong-phai-pipe";
      expect(() => stockControl.openInheritedControlChannel()).toThrow("subprocess control channel was not inherited");
      expect(process.env[SUBPROCESS_CONTROL_ENV]).toBeUndefined();
    });
  });
});

describe("gbh-subprocess · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    const declared = Object.keys(manifest.peerDependencies ?? {});
    // Chống verdict RỖNG: nếu ai xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    for (const name of peers) expect(declared).toContain(name);
    expect(missingPeers(manifest)).toEqual([]);
  });

  test("peer khai ra phải có THẬT trong kernel, và phiên bản trỏ đúng bản kernel đang chạy", () => {
    const manifest = readManifest();
    /** Cách ghim phiên bản theo từng peer: cordis theo dải `~version`, gói DSH ghim đúng version. */
    const pin = (name: string, version: string): string => (name === "@deepseek-ai/cordis" ? "~" + version : version);
    for (const name of manifest.gbh?.peers ?? []) {
      const kernelFile = join(REPO, "apps/host/node_modules", name, "package.json");
      expect(existsSync(kernelFile)).toBe(true);
      const kernel = JSON.parse(readFileSync(kernelFile, "utf8")) as { version: string };
      expect(manifest.peerDependencies?.[name]).toBe(pin(name, kernel.version));
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const name of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[name];
      mutated.peerDependencies = declared;
      // Đỏ ở ĐÚNG tên vừa xoá ⇒ ca dương ở trên KHÔNG rỗng: ai xoá một peer thì test sẽ ĐỎ.
      expect(missingPeers(mutated)).toEqual([name]);
    }
    // Xoá SẠCH peerDependencies ⇒ phải báo ĐỦ mọi tên (không phải một con số).
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  test("đối chứng âm thứ hai: THỪA tên trong peerDependencies vẫn ĐẠT (⊆ chứ không phải =)", () => {
    const mutated = cloneManifest(readManifest());
    mutated.peerDependencies = { ...(mutated.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(mutated)).toEqual([]);
  });

  test("peer KHÔNG được khai trong dependencies (tránh thể hiện thứ hai)", () => {
    const manifest = readManifest();
    for (const name of manifest.gbh?.peers ?? []) expect(manifest.dependencies?.[name]).toBeUndefined();
  });

  test("mọi peer của bản GỐC cũng là peer của ta, và gói KHÔNG tự khai gbh.row (chờ Lead boot)", () => {
    const manifest = readManifest();
    const stockManifest = JSON.parse(
      readFileSync(join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-subprocess/package.json"), "utf8"),
    ) as { peerDependencies?: Record<string, string> };
    const declared = Object.keys(manifest.peerDependencies ?? {});
    for (const name of Object.keys(stockManifest.peerDependencies ?? {})) expect(declared).toContain(name);
    // Gói chưa có lượt boot của Lead ⇒ KHÔNG được khai `gbh.row`: khai sớm là tắt row stock của mọi người.
    expect(manifest.gbh?.row).toBeUndefined();
  });
});
