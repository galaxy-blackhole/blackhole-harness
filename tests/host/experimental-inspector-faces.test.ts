/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test HAI MẶT của row experimental-inspector: CỔNG BYTE lib/index.js (byte-identical stock, GIỮ id stock)
 *      + lib/client.js (stock.replaceAll(id), 0 id stock), worker.js/client.page.js/devtools byte-identical,
 *      và `dsh.client` trong package.json khớp tuyệt đối stock. Chưa build lib ⇒ ca byte SKIP kèm lý do đo được.
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { describe, expect, test } from "bun:test";
import { applyHostDeviation } from "../../packages/host/experimental-inspector/build.ts";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "../../packages/host/experimental-inspector/src/ids.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "experimental-inspector");
/** Thư mục lib của ta (do build sinh ra). */
const OUR_LIB = join(PKG, "lib");
/** Thư mục package stock trong kernel (CHỈ ĐỌC). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", ...STOCK_PACKAGE_NAME.split("/"));
/** Thư mục lib stock (CHỈ ĐỌC) — oracle của mọi phép so byte. */
const STOCK_LIB = join(STOCK_PKG, "lib");
/** Manifest hai bên. */
const OUR_MANIFEST = join(PKG, "package.json");
const STOCK_MANIFEST = join(STOCK_PKG, "package.json");
/** Bốn artefact hai mặt + asset phải đối chứng. */
const OUR_HOST = join(OUR_LIB, "index.js");
const OUR_CLIENT = join(OUR_LIB, "client.js");
const OUR_WORKER = join(OUR_LIB, "worker.js");
const OUR_PAGE = join(OUR_LIB, "client.page.js");
const OUR_DEVTOOLS = join(OUR_LIB, "devtools");
/** Bản stock tương ứng. */
const STOCK_HOST = join(STOCK_LIB, "index.js");
const STOCK_CLIENT = join(STOCK_LIB, "client.js");
const STOCK_WORKER = join(STOCK_LIB, "worker.js");
const STOCK_PAGE = join(STOCK_LIB, "client.page.js");
const STOCK_DEVTOOLS = join(STOCK_LIB, "devtools");

/** Mặt client tối thiểu cần đo trong package.json. */
interface DshClientFace {
  /** Module client nạp sẵn (stock: rỗng). */
  readonly inject?: readonly string[];
  /** Nền tảng client (stock: "web"). */
  readonly platform?: string;
  /** Nạp ngay khi boot (stock: true). */
  readonly immediately?: boolean;
  /** Khoá lạ phải bị phát hiện, không được bỏ qua. */
  readonly [key: string]: unknown;
}

/** Manifest tối thiểu cần đo. */
interface PackageManifest {
  /** Tên package. */
  readonly name?: string;
  /** Khối dsh.client. */
  readonly dsh?: {
    /** Mặt client khai với harness. */
    readonly client?: DshClientFace;
    /** Khoá lạ trong dsh. */
    readonly [key: string]: unknown;
  };
  /** Khoá lạ trong manifest. */
  readonly [key: string]: unknown;
}

/**
 * Đường dẫn tương đối từ gốc repo.
 * Nhận: path — đường dẫn tuyệt đối. Trả: chuỗi bắt đầu sau tiền tố repo.
 */
function repoRelative(path: string): string {
  return path.slice(REPO.length + 1);
}

/**
 * Ghi chú SKIP kèm đường dẫn thiếu — để ca bị bỏ qua vẫn có lý do ĐO ĐƯỢC.
 * Nhận: các đường dẫn bắt buộc. Trả: chuỗi rỗng khi đủ, hoặc " — SKIP: thiếu …".
 */
function missingNote(...paths: readonly string[]): string {
  const missing = paths.filter((path) => !existsSync(path)).map(repoRelative);
  return missing.length === 0 ? "" : " — SKIP: thiếu " + missing.join(", ");
}

/**
 * Băm sha256 một mảng byte.
 * Nhận: bytes — nội dung file. Trả: hex sha256.
 */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(normalizePackageNames(new TextDecoder().decode(bytes))).digest("hex");
}

/**
 * Đếm số lần chuỗi con xuất hiện.
 * Nhận: text — chuỗi nguồn; needle — chuỗi con. Trả: số lần xuất hiện.
 */
function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Đọc manifest JSON.
 * Nhận: path — đường dẫn package.json. Trả: manifest đã parse.
 */
function readManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

/**
 * Liệt kê MỌI file dưới một thư mục, đường dẫn tương đối dùng "/".
 * Nhận: root — thư mục gốc; prefix — thư mục con đang duyệt. Trả: mảng đường dẫn tương đối.
 */
async function listRelativeFiles(root: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  for (const entry of entries) {
    const relative = prefix.length === 0 ? entry.name : prefix + "/" + entry.name;
    if (entry.isDirectory()) files.push(...(await listRelativeFiles(root, relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

describe("experimental-inspector — nguồn đối chứng stock (CHỈ ĐỌC)", () => {
  test("stock đủ 4 artefact; id stock xuất hiện đúng 1/2/3/0 lần", () => {
    for (const path of [STOCK_HOST, STOCK_CLIENT, STOCK_WORKER, STOCK_PAGE]) {
      expect(existsSync(path)).toBe(true);
    }
    // Số lần là HỢP ĐỒNG của cổng byte: index.js 1 (import.meta.resolve), client.js 2
    // (id module + PACKAGE_ID), client.page.js 3 (phải ĐỔI hết sang id ta), worker.js 0.
    expect(countOf(readFileSync(STOCK_HOST, "utf8"), STOCK_PACKAGE_NAME)).toBe(1);
    expect(countOf(readFileSync(STOCK_CLIENT, "utf8"), STOCK_PACKAGE_NAME)).toBe(2);
    expect(countOf(readFileSync(STOCK_PAGE, "utf8"), STOCK_PACKAGE_NAME)).toBe(3);
    expect(countOf(readFileSync(STOCK_WORKER, "utf8"), STOCK_PACKAGE_NAME)).toBe(0);
  });
});

describe("experimental-inspector — package.json khớp stock", () => {
  test("dsh.client khớp TUYỆT ĐỐI stock: inject/platform/immediately", () => {
    const ours = readManifest(OUR_MANIFEST);
    const stock = readManifest(STOCK_MANIFEST);
    expect(ours.name).toBe(PACKAGE_NAME);
    expect(stock.dsh?.client).toBeDefined();
    expect(ours.dsh?.client).toBeDefined();
    // JSON.stringify giữ cả THỨ TỰ khoá — đúng nghĩa "khớp tuyệt đối" với stock.
    expect(JSON.stringify(ours.dsh?.client)).toBe(JSON.stringify(stock.dsh?.client));
    expect(ours.dsh?.client).toEqual({ inject: [], platform: "web", immediately: true });
    expect(stock.dsh?.client).toEqual({ inject: [], platform: "web", immediately: true });
    expect(Object.keys(ours.dsh?.client ?? {})).toEqual(["inject", "platform", "immediately"]);
    expect(ours.dsh?.client?.inject).toEqual([]);
    expect(ours.dsh?.client?.platform).toBe("web");
    expect(ours.dsh?.client?.immediately).toBe(true);
    // Không được thêm khoá lạ cấp dsh.
    expect(Object.keys(ours.dsh ?? {})).toEqual(["client"]);
  });
});

describe("experimental-inspector — cổng byte HAI MẶT", () => {
  test.skipIf(!existsSync(OUR_HOST))(
    "lib/index.js = stock + SAI LỆCH có chủ đích (fail-soft task-152): sha256 + byte + length" + missingNote(OUR_HOST),
    async () => {
      const stockBytes = Buffer.from(applyHostDeviation((await readFile(STOCK_HOST)).toString("utf8")), "utf8");
      const replacedBytes = Buffer.from(
        stockBytes.toString("utf8").replaceAll(STOCK_PACKAGE_NAME, PACKAGE_NAME),
        "utf8",
      );
      const ours = await readFile(OUR_HOST);
      expect(ours.length).toBe(stockBytes.length);
      expect(ours.equals(stockBytes)).toBe(true);
      expect(sha256(ours)).toBe(sha256(stockBytes));
      // Mặt HOST giữ id stock: stage/mount PHẢI tạo alias <stock> → gói ta để
      // import.meta.resolve(…/package.json) trỏ đúng devtools của TA. Vì vậy KHÔNG thay id ở đây.
      expect(countOf(ours.toString("utf8"), STOCK_PACKAGE_NAME)).toBe(1);
      expect(countOf(ours.toString("utf8"), PACKAGE_NAME)).toBe(0);
      expect(ours.equals(replacedBytes)).toBe(false);
    },
  );

  test.skipIf(!existsSync(OUR_CLIENT))(
    "lib/client.js = stock.replaceAll(id): sha256 + byte; grep id stock = 0" + missingNote(OUR_CLIENT),
    async () => {
      const stockText = await readFile(STOCK_CLIENT, "utf8");
      const stockBytes = Buffer.from(stockText, "utf8");
      const expectedText = stockText.replaceAll(STOCK_PACKAGE_NAME, PACKAGE_NAME);
      const expected = Buffer.from(expectedText, "utf8");
      const ours = await readFile(OUR_CLIENT);
      expect(ours.length).toBe(expected.length);
      expect(ours.equals(expected)).toBe(true);
      // Mặt CLIENT PHẢI khác stock thô (id đã đổi) — chứng minh đã so CẢ HAI mốc.
      expect(ours.equals(stockBytes)).toBe(false);
      expect(sha256(ours)).toBe(sha256(expected));
      // YÊU CẦU ĐÍCH DANH: sau khi thay, lib/client.js KHÔNG còn id stock.
      expect(countOf(ours.toString("utf8"), STOCK_PACKAGE_NAME)).toBe(0);
      expect(countOf(ours.toString("utf8"), PACKAGE_NAME)).toBe(2);
    },
  );

  test.skipIf(!existsSync(OUR_WORKER))(
    "worker.js byte-identical stock: sha256 + byte + length" + missingNote(OUR_WORKER),
    async () => {
      const [ours, stock] = await Promise.all([readFile(OUR_WORKER), readFile(STOCK_WORKER)]);
      expect(ours.length).toBe(stock.length);
      expect(sha256(ours)).toBe(sha256(stock));
      expect(ours.equals(stock)).toBe(true);
    },
  );

  test.skipIf(!existsSync(OUR_PAGE))(
    "client.page.js = stock.replaceAll(id) (chunk cùng module phải đổi id): sha256 + byte" + missingNote(OUR_PAGE),
    async () => {
      const [ours, stock] = await Promise.all([readFile(OUR_PAGE), readFile(STOCK_PAGE)]);
      const expected = Buffer.from(
        stock
          .toString("utf8")
          .split(STOCK_PACKAGE_NAME)
          .join(PACKAGE_NAME)
          // P3 (04/11/2026): chunk cung module require id MOI cua module ao store.
          .split("@deepseek-ai/dsh-client-store")
          .join("@galaxy-blackhole/gbh-client-store")
          .split("@deepseek-ai/dsh-client-ui-primitives")
          .join("@galaxy-blackhole/gbh-client-ui-primitives"),
        "utf8",
      );
      expect(Buffer.compare(ours, expected)).toBe(0);
      expect(sha256(ours)).toBe(sha256(expected));
      // P3: them 5 B do id store moi trong chunk nay.
      expect(ours.length).toBe(
        stock.length + 3 * (PACKAGE_NAME.length - STOCK_PACKAGE_NAME.length) + 10,
      );
      expect(countOf(ours.toString("utf8"), STOCK_PACKAGE_NAME)).toBe(0);
      expect(countOf(ours.toString("utf8"), PACKAGE_NAME)).toBe(3);
    },
  );

  test.skipIf(!existsSync(OUR_DEVTOOLS))(
    "devtools/ byte-identical stock: đủ file + từng byte + tổng byte" + missingNote(OUR_DEVTOOLS),
    async () => {
      const stockFiles = (await listRelativeFiles(STOCK_DEVTOOLS)).sort();
      const ourFiles = (await listRelativeFiles(OUR_DEVTOOLS)).sort();
      expect(stockFiles.length).toBeGreaterThan(0);
      // So DANH SÁCH trước: thiếu/thừa một asset cũng là lệch cổng byte.
      expect(ourFiles).toEqual(stockFiles);
      const mismatches: string[] = [];
      let stockTotal = 0;
      let ourTotal = 0;
      for (const relative of stockFiles) {
        const [ours, stock] = await Promise.all([
          readFile(join(OUR_DEVTOOLS, relative)),
          readFile(join(STOCK_DEVTOOLS, relative)),
        ]);
        stockTotal += stock.length;
        ourTotal += ours.length;
        if (!ours.equals(stock) && mismatches.length < 20) {
          mismatches.push(relative + ": " + sha256(ours) + " != " + sha256(stock));
        }
      }
      expect(mismatches).toEqual([]);
      expect(ourTotal).toBe(stockTotal);
    },
    30_000,
  );
});