/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hop dong C2: window.__ModuleLoader__.load + create, ngu nghia lazy-CJS va thu tu nap
 */

import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { readFixture, readFixtureText } from "./lib.ts";

/** Fixture mô tả bề mặt module loader đã đóng băng. */
interface LoaderFixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** SHA-256 của đoạn mã đóng băng. */
  sourceSha256: string;
  /** Các thành viên công khai. */
  members: string[];
  /** Thông điệp lỗi phải giữ nguyên. */
  errorMessages: string[];
  /** Số dòng mã. */
  sourceLines: number;
}

/** Đăng ký module theo đúng dạng loader nhận. */
interface Registration {
  /** id plugin. */
  id: string;
  /** Hàm factory, nhận hàm require nội bộ. */
  factory: (require: (specifier: string) => unknown) => unknown;
}

/** Bề mặt loader mà đoạn mã cài vào window. */
interface Loader {
  /** Chế độ hiện tại; "queue" trước khi hệ module thật boot. */
  mode: string;
  /** Hàng đợi đăng ký. */
  pendingQueue: Registration[];
  /** Đẩy một đăng ký vào hàng đợi. */
  load(registration: Registration): void;
  /** Tạo hệ module thật, chuyển giao hàng đợi cho client-modules. */
  create(options?: unknown): unknown;
}

const fixture = readFixture<LoaderFixture>("c2-module-loader.json");
const source = readFixtureText("c2-module-loader.js");

/**
 * Lấy một thông điệp lỗi hợp đồng theo mảnh nội dung.
 * Nhận: mảnh chuỗi nhận diện.
 * Trả: thông điệp đầy đủ (ném lỗi nếu fixture thiếu — nghĩa là hợp đồng đã đổi).
 */
function msg(part: string): string {
  const found = fixture.errorMessages.find((m) => m.includes(part));
  if (found === undefined) {
    throw new Error("fixture c2 thiếu thông điệp chứa: " + part + " (chạy lại tests/contract/capture.ts)");
  }
  return found;
}

/**
 * Chạy đoạn mã loader đã đóng băng với một window giả.
 * Nhận: không.
 * Trả: window giả có thuộc tính __ModuleLoader__.
 */
function bootLoader(): { window: { __ModuleLoader__: Loader } } {
  const window: { __ModuleLoader__?: Loader } = {};
  const run = new Function("window", source);
  run(window);
  return { window: window as { __ModuleLoader__: Loader } };
}

describe("C2 — module loader (lazy-CJS, memoize, thứ tự nạp)", () => {
  test("mã đóng băng không bị sửa lén (hash khớp fixture)", () => {
    expect(createHash("sha256").update(source).digest("hex")).toBe(fixture.sourceSha256);
    expect(source.replace(/\n$/, "").split("\n").length).toBe(fixture.sourceLines);
  });

  test("cài đúng bề mặt công khai ở chế độ queue", () => {
    const { window } = bootLoader();
    const loader = window.__ModuleLoader__;
    expect(loader.mode).toBe("queue");
    expect(Array.isArray(loader.pendingQueue)).toBe(true);
    expect(typeof loader.load).toBe("function");
    expect(typeof loader.create).toBe("function");
    for (const member of fixture.members) expect(member in loader).toBe(true);
  });

  test("load() chỉ xếp hàng, chưa gọi factory (lazy)", () => {
    const { window } = bootLoader();
    const loader = window.__ModuleLoader__;
    let called = 0;
    loader.load({ id: "demo", factory: () => { called++; return {}; } });
    loader.load({ id: "demo-2", factory: () => { called++; return {}; } });
    expect(loader.pendingQueue.length).toBe(2);
    expect(called).toBe(0);
    expect(loader.pendingQueue[0]?.id).toBe("demo");
  });

  test("create() khi thiếu client-modules thì báo đúng lỗi hợp đồng", () => {
    const { window } = bootLoader();
    expect(() => window.__ModuleLoader__.create({})).toThrow(msg("did not preload"));
  });

  test("create() gọi factory, gỡ khỏi hàng đợi, chặn require ngoài và trả hệ module", () => {
    const { window } = bootLoader();
    const loader = window.__ModuleLoader__;
    let seenExternal = "";
    const system = { tag: "module-system" };
    loader.load({
      id: "@deepseek-ai/dsh-client-modules",
      factory: (require) => {
        try {
          require("some-external");
        } catch (error) {
          seenExternal = String(error);
        }
        return { apply: (): void => undefined, createClientModuleSystem: (): unknown => system };
      },
    });
    const result = loader.create({ opt: 1 });
    expect(result).toBe(system);
    expect(loader.pendingQueue.length).toBe(0);
    expect(seenExternal.startsWith("Error: " + msg("requested external"))).toBe(true);
    expect(seenExternal).toContain('"some-external"');
  });

  test("create() lần hai báo lỗi vì đăng ký đã bị gỡ (memoize theo đăng ký)", () => {
    const { window } = bootLoader();
    const loader = window.__ModuleLoader__;
    loader.load({
      id: "@deepseek-ai/dsh-client-modules",
      factory: () => ({ apply: (): void => undefined, createClientModuleSystem: (): unknown => ({}) }),
    });
    loader.create({});
    expect(() => loader.create({})).toThrow(msg("did not preload"));
  });

  test("factory thiếu bề mặt bootstrap thì bị từ chối (kiểm hình dạng export)", () => {
    const { window } = bootLoader();
    const loader = window.__ModuleLoader__;
    loader.load({ id: "@deepseek-ai/dsh-client-modules", factory: () => ({}) });
    expect(() => loader.create({})).toThrow(msg("did not export the bootstrap module face"));
  });
});
