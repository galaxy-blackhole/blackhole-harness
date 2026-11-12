/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test HAI MẶT của row workspace-controller: CỔNG BYTE 3 artefact so với stock đã thay đúng trường
 *      ownership/id, VALIDATE manifest qua typert-loader THẬT, và bề mặt export/static khớp gốc.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/api-workspace-controller/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "api-workspace-controller");
/** Thư mục lib stock (CHỈ ĐỌC). */
const STOCK_LIB = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-workspace-controller", "lib");
/** Id package của TA. */
const OURS = "@galaxy-blackhole/gbh-api-workspace-controller";
/** Tên gói stock. */
const STOCK = "@deepseek-ai/dsh-api-workspace-controller";
/** Thư mục build tạm dưới lib/ (lint miễn trừ). */
const OUT = join(PKG, "lib", ".test-build-faces");
/** typert-loader THẬT của kernel. */
const LOADER = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-typert-loader", "lib", "index.js");

/** Manifest host tối thiểu cần đo. */
interface HostManifest {
  /** Tên package sở hữu manifest. */
  readonly package: string;
  /** Mặt của manifest. */
  readonly face: string;
  /** Schema khai trong manifest. */
  readonly schemas: readonly unknown[];
  /** Model (services/events/objects). */
  readonly model: { readonly services: readonly unknown[] };
}

/** Manifest remote tối thiểu cần đo. */
interface RemoteManifest {
  /** Tên package sở hữu manifest. */
  readonly package?: string;
  /** Mặt của manifest. */
  readonly face?: string;
  /** Bảng method. */
  readonly methods?: Record<string, unknown>;
}

/** typert-loader THẬT. */
const loader = (await import(LOADER)) as unknown as { readonly validateTypertManifest: (pkgName: string, exported: unknown) => unknown };
/** Manifest host của TA. */
let ourTypert: HostManifest;
/** Manifest remote của TA. */
let ourRemote: RemoteManifest;

/**
 * Băm sha256 một chuỗi.
 * Nhận: text — chuỗi cần băm. Trả: hex sha256.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Đếm số lần chuỗi con xuất hiện.
 * Nhận: text — chuỗi nguồn; needle — chuỗi con. Trả: số lần.
 */
function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

beforeAll(async () => {
  await buildPackage(OUT);
  ourTypert = ((await import(join(OUT, "typert.host.js"))) as unknown as { readonly TYPERT: HostManifest }).TYPERT;
  const remoteModule = (await import(join(OUT, "typert.remote-client.js"))) as unknown as {
    readonly TYPERT_REMOTE: RemoteManifest;
    readonly default: RemoteManifest;
  };
  ourRemote = remoteModule.TYPERT_REMOTE ?? remoteModule.default;
});

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("workspace-controller — CỔNG BYTE 3 artefact hai mặt", () => {
  test("client.js = stock với id module đã thay: sha256 + byte bằng nhau", async () => {
    const stock = await readFile(join(STOCK_LIB, "client.js"), "utf8");
    // 20/10/2026: part nguồn đã REWRITE specifier gateway sang id ta (bỏ dần id stock khỏi payload) ⇒
    // gốc-quy-đổi phải quy cả specifier đó; sai lệch còn lại CHỈ là ID, không phải logic.
    const expected = stock
      .replaceAll(STOCK, OURS)
      .split("@deepseek-ai/dsh-api-gateway")
      .join("@galaxy-blackhole/gbh-host-typert-gateway")
      // P3 (04/11/2026): module ao store doi id.
      .replaceAll("@deepseek-ai/dsh-client-store", "@galaxy-blackhole/gbh-client-store");
    const ours = await readFile(join(OUT, "client.js"), "utf8");
    expect(sha256(ours)).toBe(sha256(expected));
    expect(ours.length).toBe(expected.length);
    expect(countOf(ours, STOCK)).toBe(0);
    expect(countOf(ours, OURS)).toBe(1);
  });

  test("typert.host.js = stock với ownership package đã thay: sha256 bằng nhau", async () => {
    const stock = await readFile(join(STOCK_LIB, "typert.host.js"), "utf8");
    // 20/10/2026 (task-162): gốc-quy-đổi CHỈ thay id ownership của chính gói. task-160 đã sửa lỗi THẬT:
    // KHÔNG quy tham chiếu thư viện `typert-protocol` (xem build.ts: gbh-typert-protocol không có trong
    // profile apps/host ⇒ đổi id là import nổ, typert contributor không đăng ký được). Vì vậy kỳ vọng cũ
    // (quy cả typert-protocol) là SAI và đã được bỏ — artefact giữ nguyên id stock của thư viện.
    // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator => ky vong phai quy tuong ung.
    const expected = stock
      .replaceAll(STOCK, OURS)
      .replaceAll("@deepseek-ai/dsh-typert-generator", "@galaxy-blackhole/gbh-typert-generator");
    const ours = await readFile(join(OUT, "typert.host.js"), "utf8");
    expect(sha256(ours)).toBe(sha256(expected));
    expect(countOf(ours, STOCK)).toBe(0);
  });

  test("typert.remote-client.js = stock với ownership package đã thay: sha256 bằng nhau", async () => {
    const stock = await readFile(join(STOCK_LIB, "typert.remote-client.js"), "utf8");
    // Cùng lý do task-160/task-162 ở ca typert.host.js: thư viện `typert-protocol` GIỮ id stock.
    // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator => ky vong phai quy tuong ung.
    const expected = stock
      .replaceAll(STOCK, OURS)
      .replaceAll("@deepseek-ai/dsh-typert-generator", "@galaxy-blackhole/gbh-typert-generator");
    const ours = await readFile(join(OUT, "typert.remote-client.js"), "utf8");
    expect(sha256(ours)).toBe(sha256(expected));
  });
});

describe("workspace-controller — typert-loader THẬT validate manifest", () => {
  test("manifest host của TA được loader chấp nhận", () => {
    expect(() => loader.validateTypertManifest(OURS, ourTypert)).not.toThrow();
    expect(ourTypert.package).toBe(OURS);
    expect(ourTypert.face).toBe("host");
  });

  test("cùng manifest khai tên STOCK bị loader từ chối: đúng câu lỗi", () => {
    const message = ((): string => {
      try {
        loader.validateTypertManifest(STOCK, ourTypert);
        return "(khong nem)";
      } catch (thrown: unknown) {
        return String((thrown as { readonly message?: string }).message);
      }
    })();
    expect(message).toContain("must be owned by the package that exports it");
    expect(message).toContain(JSON.stringify(OURS));
  });

  test("manifest host: số schema/service khớp gốc", async () => {
    const stockTypert = (await import(join(STOCK_LIB, "typert.host.js"))).TYPERT as HostManifest;
    expect(ourTypert.schemas.length).toBe(stockTypert.schemas.length);
    expect(ourTypert.model.services.length).toBe(stockTypert.model.services.length);
  });

  test("manifest remote: package = id của TA, face + method keys khớp stock", async () => {
    const stockRemote = (await import(join(STOCK_LIB, "typert.remote-client.js"))).TYPERT_REMOTE as RemoteManifest;
    expect(ourRemote.package).toBe(OURS);
    expect(ourRemote.face).toBe(stockRemote.face);
    expect(Object.keys(ourRemote.methods ?? {}).sort()).toEqual(Object.keys(stockRemote.methods ?? {}).sort());
  });
});