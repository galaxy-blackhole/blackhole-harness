/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B trực tiếp cho @galaxy-blackhole/gbh-attachment-local: nạp bundle gốc @deepseek-ai/dsh-attachment-local (A) và artifact BUILD của gói ta (B), so tập export, hằng số, cấu hình mặc định, hành vi thật trên Context cordis thật (validateImage, saveImage/readImage, chuẩn hoá qua sharp, saveFile/readFileStream, readImageRequest) và thông điệp lỗi.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/attachment-local/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta — nơi chứa node_modules dùng để phân giải peer cho artifact build. */
const PKG = join(REPO, "packages", "host", "attachment-local");
/** Kernel node_modules — nguồn THẬT của mọi peer và của sharp. */
const KERNEL = join(REPO, "apps", "host", "node_modules");
/** Bundle GỐC (A) đã build trong kernel. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-attachment-local/lib/index.js";
/** Cordis THẬT của kernel — cần Context thật thì Service mới đăng ký được. */
const CORDIS = "../../apps/host/node_modules/@deepseek-ai/cordis/lib/index.js";
/** Thư mục build tạm của artifact B (bị buildPackage xoá sạch mỗi lượt). */
const BUILD_DIR = "/tmp/gbh-attach-ab-build";
/** Kernel có sharp hay không — quyết định các ca ảnh thật chạy hay SKIP kèm lý do. */
const HAS_SHARP = existsSync(join(KERNEL, "sharp"));

/** Peer bắt buộc phải phân giải được từ package của ta (đúng danh sách trong package.json). */
const PEER_NAMES = ["dsh-attachment", "dsh-home-paths", "dsh-lazy-require", "cordis", "schemastery"] as const;

/** Đầu vào một ảnh đã mã hoá, như SaveImageAttachment của gói gốc. */
interface ImageInput {
  /** Toàn bộ bytes ảnh đã mã hoá. */
  data: Uint8Array;
  /** Media type bên gọi khai. */
  mediaType: string;
  /** Tên hiển thị tuỳ chọn. */
  name?: string;
}

/** Tham chiếu ảnh bền vững, như ImageAttachmentRef của gói gốc. */
interface ImageRef {
  /** Id địa chỉ hoá theo nội dung (sha256:<64 hex>). */
  attachmentId: string;
  /** Media type của đối tượng đã lưu. */
  mediaType: string;
  /** Chiều rộng đã lưu. */
  width: number;
  /** Chiều cao đã lưu. */
  height: number;
  /** Số byte đã lưu. */
  bytes: number;
  /** Tên hiển thị đã làm sạch, nếu có. */
  name?: string;
  /** Kích thước nguồn khi ảnh bị thu nhỏ. */
  originalDimensions?: { width: number; height: number };
}

/** Tham chiếu tệp bền vững, như FileAttachmentRef của gói gốc. */
interface FileRef {
  /** Id địa chỉ hoá theo nội dung (sha256:<64 hex>). */
  attachmentId: string;
  /** Tên hiển thị đã làm sạch, nếu có. */
  name?: string;
  /** Số byte đã lưu. */
  bytes: number;
}

/** Đích biến đổi ảnh cho yêu cầu model, như ImageRequestTarget của gói gốc. */
interface RequestTarget {
  /** Cạnh rộng đích. */
  width: number;
  /** Cạnh cao đích. */
  height: number;
  /** Trần byte đã mã hoá của route. */
  maxBytes: number;
}

/** Ảnh yêu cầu model đã sinh/cache, như RequestImageAttachment của gói gốc. */
interface RequestImage {
  /** Danh tính biến thể tất định. */
  variantId: string;
  /** Tham chiếu ảnh nguồn. */
  attachment: ImageRef;
  /** Byte của biến thể. */
  data: Uint8Array;
  /** Media type của biến thể. */
  mediaType: string;
  /** Số byte của biến thể. */
  bytes: number;
  /** Chiều rộng biến thể. */
  width: number;
  /** Chiều cao biến thể. */
  height: number;
  /** Độ sâu mẫu đã giải mã. */
  depth: string;
  /** Không gian màu đã giải mã. */
  space: string;
  /** Biến thể có kênh alpha hay không. */
  hasAlpha: boolean;
}

/** Hình dạng tối thiểu mà phép đối chứng cần ở một kho đính kèm (A hoặc B). */
interface StoreLike {
  /** Gốc lưu trữ tuyệt đối <DSH_HOME>/attachments/v1. */
  root: string;
  /** Điều kiện nhận ảnh đã chốt. */
  imageLimits: Record<string, unknown>;
  /** Chính sách chuẩn hoá đã chốt. */
  normalizationPolicy: Record<string, unknown>;
  /** Trần đồng thời đã chốt. */
  imageCompressionConcurrency: number;
  /** Kiểm một ảnh mà không lưu. */
  validateImage(input: ImageInput): Promise<void>;
  /** Lưu một ảnh. */
  saveImage(input: ImageInput): Promise<ImageRef>;
  /** Lưu một lô ảnh theo thứ tự. */
  saveImages(inputs: readonly ImageInput[]): Promise<readonly ImageRef[]>;
  /** Đọc lại một ảnh đã lưu. */
  readImage(ref: ImageRef): Promise<{ ref: ImageRef; data: Uint8Array }>;
  /** Đường dẫn host của ảnh đã chuẩn hoá. */
  imageHostPath(ref: ImageRef): string;
  /** Lưu nguyên byte một tệp. */
  saveFile(input: { data: Uint8Array; name?: string }): Promise<FileRef>;
  /** Đọc một tệp đã lưu thành các khúc. */
  readFileStream(ref: FileRef): AsyncIterable<Uint8Array>;
  /** Đường dẫn host của tệp đã lưu. */
  fileHostPath(ref: FileRef): string;
  /** Sinh/dùng lại biến thể ảnh cho yêu cầu model. */
  readImageRequest(ref: ImageRef, target: RequestTarget): Promise<RequestImage>;
}

/** Lớp kho đính kèm kèm schema cấu hình tĩnh. */
interface StoreClass {
  /** Dựng kho từ Context cordis thật và cấu hình đã hợp nhất. */
  new (ctx: unknown, config: Record<string, unknown>): StoreLike;
  /** Nguyên mẫu của lớp — dùng kiểm chuỗi kế thừa. */
  readonly prototype: StoreLike;
  /** Schema schemastery của cấu hình. */
  Config(value: Record<string, unknown>): Record<string, unknown>;
}

/** Hình dạng module mà phép đối chứng cần (A và B dùng chung). */
interface LibModule {
  /** Lớp kho đính kèm cục bộ. */
  LocalAttachmentStore: StoreClass;
  /** Export mặc định — phải CHÍNH LÀ lớp trên. */
  default: StoreClass;
  /** Mọi export còn lại (hằng số, hàm) tra theo tên. */
  [name: string]: unknown;
}

/** Dấu vết lỗi đã chuẩn hoá để so A với B. */
interface Failure {
  /** Tên lớp lỗi. */
  name: string;
  /** Mã lỗi ổn định, hoặc null khi lỗi không mang mã. */
  code: string | null;
  /** Thông điệp người đọc. */
  message: string;
}

/** Kết cục của một phép chạy: thành công kèm giá trị, hoặc thất bại kèm dấu vết lỗi. */
type Outcome = { ok: true; value: unknown } | { ok: false; error: Failure };

/**
 * Tạo (chỉ khi chưa có) một symlink thư mục.
 * Nhận: target — đường dẫn THẬT của thư mục đích; linkPath — đường dẫn symlink cần dựng.
 * Trả: true khi vừa tạo mới, false khi liên kết còn sống đã có sẵn.
 */
function ensureLink(target: string, linkPath: string): boolean {
  try {
    lstatSync(linkPath);
    if (existsSync(linkPath)) return false;
    rmSync(linkPath, { force: true });
  } catch {
    // Chưa có gì ở đích — dựng mới bên dưới.
  }
  symlinkSync(target, linkPath, "dir");
  return true;
}

/**
 * Dựng các symlink peer trong node_modules CỦA PACKAGE trỏ tới thư mục THẬT trong kernel.
 * Nhận: không — đọc hằng PEER_NAMES, KERNEL và PKG.
 * Trả: mảng tên peer vừa được tạo liên kết (rỗng nghĩa là mọi liên kết đã có sẵn).
 */
function ensurePeers(): string[] {
  const created: string[] = [];
  const scope = join(PKG, "node_modules", "@deepseek-ai");
  mkdirSync(scope, { recursive: true });
  for (const name of PEER_NAMES) {
    const target = join(KERNEL, "@deepseek-ai", name);
    if (!existsSync(target)) continue;
    if (ensureLink(target, join(scope, name))) created.push(name);
  }
  const sharp = join(KERNEL, "sharp");
  if (existsSync(sharp) && ensureLink(sharp, join(PKG, "node_modules", "sharp"))) created.push("sharp");
  return created;
}

/**
 * Cho artifact trong /tmp phân giải peer đúng như bản cài của package: trỏ node_modules của nó về
 * node_modules của package (nơi ensurePeers vừa dựng liên kết), không đụng tới tệp nào trong repo.
 * Nhận: buildDir — thư mục build tạm vừa được buildPackage dựng lại.
 * Trả: không; có thể tạo symlink <buildDir>/node_modules.
 */
function ensureBuildPeers(buildDir: string): void {
  // LƯỢT ĐO 01/11/2026: KHÔNG trỏ về `PKG/node_modules` (bản SAO workspace) — peer của artifact phải
  // phân giải về KERNEL thì `AttachmentStore` mới là CÙNG một lớp với bản gốc; `sharp` cũng lấy từ
  // kernel đúng như lúc mount thật.
  const modules = join(buildDir, "node_modules");
  mkdirSync(modules, { recursive: true });
  ensureLink(join(KERNEL, "@deepseek-ai"), join(modules, "@deepseek-ai"));
  const sharp = join(KERNEL, "sharp");
  if (existsSync(sharp)) ensureLink(sharp, join(modules, "sharp"));
}

/**
 * Tạo thư mục nhà tạm riêng cho một bên A hoặc B.
 * Nhận: label — nhãn ngắn gắn vào tên thư mục để dễ đọc khi lỗi.
 * Trả: đường dẫn tuyệt đối của thư mục tạm mới.
 */
function newHome(label: string): string {
  return mkdtempSync(join(tmpdir(), "gbh-attach-" + label + "-"));
}

/**
 * Dựng một kho đính kèm trên Context cordis THẬT.
 * Nhận: library — module A hoặc B; home — nhà harness riêng của bên đó.
 * Trả: thể hiện kho đã cấu hình { dshHome: home }.
 */
function makeStore(library: LibModule, home: string): StoreLike {
  return new library.LocalAttachmentStore(new Context(), { dshHome: home });
}

/**
 * Thay mọi lần xuất hiện của gốc tạm bằng token <HOME> để so hai bên sau khi chuẩn hoá đường dẫn.
 * Nhận: value — giá trị bất kỳ (thường là ref hoặc đường dẫn); home — gốc tạm của bên đó.
 * Trả: bản sao JSON của value đã thay gốc tạm; không đụng tới Uint8Array (không truyền byte vào đây).
 */
function scrub<T>(value: T, home: string): T {
  const text = JSON.stringify(value) ?? "null";
  return JSON.parse(text.replaceAll(home, "<HOME>")) as T;
}

/**
 * Chạy một phép và ghi lại kết cục thay vì ném ra ngoài.
 * Nhận: run — hàm không tham số trả promise của phép cần đo.
 * Trả: { ok: true, value } khi thành công, { ok: false, error } khi ném (kèm name/code/message).
 */
async function outcome(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error: describeFailure(error) };
  }
}

/**
 * Chuẩn hoá một giá trị bị ném thành dấu vết so sánh được giữa hai bản.
 * Nhận: error — giá trị bất kỳ bị ném.
 * Trả: { name, code, message }; code là null khi lỗi không mang mã chuỗi.
 */
function describeFailure(error: unknown): Failure {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { name: error.name, code: typeof code === "string" ? code : null, message: error.message };
  }
  return { name: typeof error, code: null, message: String(error) };
}

/**
 * Gom toàn bộ khúc của một luồng bất đồng bộ thành một Buffer.
 * Nhận: stream — luồng các khúc byte theo thứ tự.
 * Trả: promise Buffer nối đúng thứ tự các khúc.
 */
async function collectChunks(stream: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/**
 * Đăng ký một ca cần sharp thật; thiếu sharp trong kernel thì SKIP kèm lý do thay vì báo đỏ oan.
 * Nhận: name — tên ca; run — thân ca.
 * Trả: không.
 */
function imageTest(name: string, run: () => Promise<void>): void {
  if (HAS_SHARP) test(name, run);
  else test.skip(name + " — SKIP: kernel node_modules không có sharp nên không kiểm được đường ảnh thật", run);
}

// ---------------------------------------------------------------------------
// Dựng môi trường: symlink peer → build artifact B → nạp A và B.
// ---------------------------------------------------------------------------
ensurePeers();
const artifact = await buildPackage(BUILD_DIR);
ensureBuildPeers(BUILD_DIR);

/** Cordis thật của kernel — chỉ cần hàm dựng Context. */
const { Context } = (await import(CORDIS)) as { Context: new () => unknown };
/** A — bundle gốc trong kernel (CHỈ ĐỌC). */
const A = (await import(STOCK)) as unknown as LibModule;
/** B — artifact THẬT vừa build từ src/index.ts của package ta. */
const B = (await import(pathToFileURL(artifact).href)) as unknown as LibModule;

/** PNG 1×1 hợp lệ tối thiểu (70 byte) — nguồn đi thẳng chuẩn hoá, không cần biến đổi. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
/** GIF 1×1 hợp lệ — buộc đi qua sharp (GIF không bao giờ đi thẳng). */
const GIF_1X1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
/** Byte tệp thường để kiểm đường lưu/đọc nguyên byte. */
const FILE_BYTES = Buffer.from("đính kèm thử nghiệm\n", "utf8");

describe("dựng môi trường A/B", () => {
  test("artifact BUILD nạp được và cả hai bên có LocalAttachmentStore", () => {
    expect(existsSync(artifact)).toBe(true);
    expect(existsSync(join(BUILD_DIR, "node_modules"))).toBe(true);
    expect(typeof A.LocalAttachmentStore).toBe("function");
    expect(typeof B.LocalAttachmentStore).toBe("function");
  });
});

describe("bề mặt export", () => {
  test("tập tên export của B BẰNG tập của A", () => {
    const namesA = Object.keys(A).sort();
    const namesB = Object.keys(B).sort();
    expect(namesB).toEqual(namesA);
    expect(namesA).toContain("LocalAttachmentStore");
    expect(namesA).toContain("default");
    expect(namesA).toContain("DEFAULT_MAX_IMAGE_BYTES");
    expect(namesA).toContain("readRequestImageFile");
  });

  test("default export là class, có static Config và kế thừa cùng base AttachmentStore", () => {
    expect(typeof B.default).toBe("function");
    expect(B.default).toBe(B.LocalAttachmentStore);
    expect(typeof B.LocalAttachmentStore.Config).toBe("function");
    const baseA = Object.getPrototypeOf(A.LocalAttachmentStore) as { name?: string; prototype: object };
    const baseB = Object.getPrototypeOf(B.LocalAttachmentStore) as { name?: string; prototype: object };
    expect(baseB).toBe(baseA);
    expect(baseB.name).toBe("AttachmentStore");
    expect(Object.getPrototypeOf(B.LocalAttachmentStore.prototype)).toBe(baseB.prototype);
    expect(Object.getPrototypeOf(A.LocalAttachmentStore.prototype)).toBe(baseA.prototype);
  });
});

describe("hằng số và cấu hình", () => {
  test("hằng DEFAULT_*/MAX_* trùng tên và giá trị tuyệt đối", () => {
    const constantNames = (library: LibModule): string[] => Object.keys(library).filter((name) => /^(?:DEFAULT|MAX)_/.test(name)).sort();
    const namesA = constantNames(A);
    expect(constantNames(B)).toEqual(namesA);
    expect(namesA.length).toBe(10);
    for (const name of namesA) {
      expect(typeof B[name]).toBe("number");
      expect(B[name]).toBe(A[name]);
    }
  });

  test("Config({}) của B trùng mặc định của A và trùng hằng số", () => {
    const defaultsA = A.LocalAttachmentStore.Config({});
    const defaultsB = B.LocalAttachmentStore.Config({});
    expect(defaultsB).toEqual(defaultsA);
    expect(defaultsA["dshHome"]).toBeUndefined();
    expect(defaultsA["maxImageBytes"]).toBe(A.DEFAULT_MAX_IMAGE_BYTES);
    expect(defaultsA["maxImagesPerMessage"]).toBe(A.DEFAULT_MAX_IMAGES_PER_MESSAGE);
    expect(defaultsA["imageCompressionConcurrency"]).toBe(A.DEFAULT_IMAGE_COMPRESSION_CONCURRENCY);
  });

  test("hai kho trên Context cordis thật có cùng root/limits/policy/trần đồng thời", () => {
    const homeA = newHome("cfg-a");
    const homeB = newHome("cfg-b");
    const storeA = makeStore(A, homeA);
    const storeB = makeStore(B, homeB);
    expect(scrub(storeB.root, homeB)).toBe(scrub(storeA.root, homeA));
    expect(scrub(storeB.root, homeB)).toBe("<HOME>/attachments/v1");
    expect(storeB.imageLimits).toEqual(storeA.imageLimits);
    expect(storeB.normalizationPolicy).toEqual(storeA.normalizationPolicy);
    expect(storeB.imageCompressionConcurrency).toBe(storeA.imageCompressionConcurrency);
  });
});

describe("hành vi thật trên Context cordis", () => {
  imageTest("validateImage nhận PNG 1×1: A và B cùng chấp nhận", async () => {
    const storeA = makeStore(A, newHome("va"));
    const storeB = makeStore(B, newHome("vb"));
    const resultA = await outcome(() => storeA.validateImage({ data: PNG_1X1, mediaType: "image/png" }));
    const resultB = await outcome(() => storeB.validateImage({ data: PNG_1X1, mediaType: "image/png" }));
    expect(resultB).toEqual(resultA);
    expect(resultA).toEqual({ ok: true, value: undefined });
  });

  imageTest("saveImage + readImage PNG 1×1: tham chiếu, byte và đường dẫn host trùng sau chuẩn hoá gốc tạm", async () => {
    const homeA = newHome("sa");
    const homeB = newHome("sb");
    const storeA = makeStore(A, homeA);
    const storeB = makeStore(B, homeB);
    const refA = await storeA.saveImage({ data: PNG_1X1, mediaType: "image/png", name: "../ảnh.png" });
    const refB = await storeB.saveImage({ data: PNG_1X1, mediaType: "image/png", name: "../ảnh.png" });
    expect(scrub(refB, homeB)).toEqual(scrub(refA, homeA));
    expect(refB.name).toBe("ảnh.png");
    expect(refB.attachmentId.startsWith("sha256:")).toBe(true);

    const readA = await storeA.readImage(refA);
    const readB = await storeB.readImage(refB);
    expect(scrub(readB.ref, homeB)).toEqual(scrub(readA.ref, homeA));
    expect(Buffer.from(readB.data).equals(Buffer.from(readA.data))).toBe(true);
    expect(Buffer.from(readB.data).equals(PNG_1X1)).toBe(true);

    expect(scrub(storeB.imageHostPath(refB), homeB)).toBe(scrub(storeA.imageHostPath(refA), homeA));
    const expectedPath = "<HOME>/attachments/v1/objects/" + refB.attachmentId.slice(7, 9) + "/" + refB.attachmentId.slice(7);
    expect(scrub(storeB.imageHostPath(refB), homeB)).toBe(expectedPath);
  });

  imageTest("chuẩn hoá qua sharp: GIF 1×1 thành WebP, tham chiếu và byte trùng", async () => {
    const homeA = newHome("ga");
    const homeB = newHome("gb");
    const storeA = makeStore(A, homeA);
    const storeB = makeStore(B, homeB);
    const resultA = await outcome(() => storeA.validateImage({ data: GIF_1X1, mediaType: "image/gif" }));
    const resultB = await outcome(() => storeB.validateImage({ data: GIF_1X1, mediaType: "image/gif" }));
    expect(resultB).toEqual(resultA);
    expect(resultA).toEqual({ ok: true, value: undefined });

    const refA = await storeA.saveImage({ data: GIF_1X1, mediaType: "image/gif" });
    const refB = await storeB.saveImage({ data: GIF_1X1, mediaType: "image/gif" });
    expect(scrub(refB, homeB)).toEqual(scrub(refA, homeA));
    expect(refB.mediaType).toBe("image/webp");
    expect(refB.width).toBe(1);
    expect(refB.height).toBe(1);
    expect(Buffer.from((await storeB.readImage(refB)).data).equals(Buffer.from((await storeA.readImage(refA)).data))).toBe(true);
  });

  test("saveFile + readFileStream: tên làm sạch, tham chiếu và byte trùng", async () => {
    const homeA = newHome("fa");
    const homeB = newHome("fb");
    const storeA = makeStore(A, homeA);
    const storeB = makeStore(B, homeB);
    const refA = await storeA.saveFile({ data: FILE_BYTES, name: "thư mục/ghi chú.txt" });
    const refB = await storeB.saveFile({ data: FILE_BYTES, name: "thư mục/ghi chú.txt" });
    expect(scrub(refB, homeB)).toEqual(scrub(refA, homeA));
    expect(refB.name).toBe("ghi chú.txt");
    expect(scrub(storeB.fileHostPath(refB), homeB)).toBe(scrub(storeA.fileHostPath(refA), homeA));

    const bytesA = await collectChunks(storeA.readFileStream(refA));
    const bytesB = await collectChunks(storeB.readFileStream(refB));
    expect(bytesB.equals(bytesA)).toBe(true);
    expect(bytesB.equals(FILE_BYTES)).toBe(true);
  });

  imageTest("readImageRequest: cùng variantId, mediaType và byte", async () => {
    const homeA = newHome("ra");
    const homeB = newHome("rb");
    const storeA = makeStore(A, homeA);
    const storeB = makeStore(B, homeB);
    const refA = await storeA.saveImage({ data: PNG_1X1, mediaType: "image/png" });
    const refB = await storeB.saveImage({ data: PNG_1X1, mediaType: "image/png" });
    const target: RequestTarget = { width: 1, height: 1, maxBytes: 1 };
    const requestA = await storeA.readImageRequest(refA, target);
    const requestB = await storeB.readImageRequest(refB, target);
    expect(requestB.variantId).toBe(requestA.variantId);
    expect(requestB.mediaType).toBe("image/webp");
    const factsB = {
      attachment: scrub(requestB.attachment, homeB),
      mediaType: requestB.mediaType,
      bytes: requestB.bytes,
      width: requestB.width,
      height: requestB.height,
      depth: requestB.depth,
      space: requestB.space,
      hasAlpha: requestB.hasAlpha,
    };
    const factsA = {
      attachment: scrub(requestA.attachment, homeA),
      mediaType: requestA.mediaType,
      bytes: requestA.bytes,
      width: requestA.width,
      height: requestA.height,
      depth: requestA.depth,
      space: requestA.space,
      hasAlpha: requestA.hasAlpha,
    };
    expect(factsB).toEqual(factsA);
    expect(Buffer.from(requestB.data).equals(Buffer.from(requestA.data))).toBe(true);
  });
});

describe("đường lỗi: thông điệp B phải BẰNG A", () => {
  test("dữ liệu ảnh rỗng", async () => {
    const storeA = makeStore(A, newHome("ea"));
    const storeB = makeStore(B, newHome("eb"));
    const resultA = await outcome(() => storeA.validateImage({ data: new Uint8Array(), mediaType: "image/png" }));
    const resultB = await outcome(() => storeB.validateImage({ data: new Uint8Array(), mediaType: "image/png" }));
    expect(resultB).toEqual(resultA);
    expect(resultA).toEqual({ ok: false, error: { name: "AttachmentError", code: "INVALID_IMAGE", message: "Image is empty." } });
  });

  imageTest("mediaType khai sai so với bytes", async () => {
    const storeA = makeStore(A, newHome("ta"));
    const storeB = makeStore(B, newHome("tb"));
    const resultA = await outcome(() => storeA.validateImage({ data: PNG_1X1, mediaType: "image/jpeg" }));
    const resultB = await outcome(() => storeB.validateImage({ data: PNG_1X1, mediaType: "image/jpeg" }));
    expect(resultB).toEqual(resultA);
    expect(resultA).toEqual({
      ok: false,
      error: { name: "AttachmentError", code: "IMAGE_TYPE_MISMATCH", message: "Declared image type does not match its bytes." },
    });
  });

  imageTest("bytes rác khai là PNG", async () => {
    const storeA = makeStore(A, newHome("xa"));
    const storeB = makeStore(B, newHome("xb"));
    const garbage = new Uint8Array([1, 2, 3, 4]);
    const resultA = await outcome(() => storeA.validateImage({ data: garbage, mediaType: "image/png" }));
    const resultB = await outcome(() => storeB.validateImage({ data: garbage, mediaType: "image/png" }));
    expect(resultB).toEqual(resultA);
    expect(resultA).toEqual({
      ok: false,
      error: { name: "AttachmentError", code: "INVALID_IMAGE", message: "Unsupported or malformed image data." },
    });
  });

  test("mediaType lạ trong một lô ảnh", async () => {
    const storeA = makeStore(A, newHome("ua"));
    const storeB = makeStore(B, newHome("ub"));
    const resultA = await outcome(() => storeA.saveImages([{ data: PNG_1X1, mediaType: "image/avif" }]));
    const resultB = await outcome(() => storeB.saveImages([{ data: PNG_1X1, mediaType: "image/avif" }]));
    expect(resultB).toEqual(resultA);
    expect(resultA).toEqual({
      ok: false,
      error: { name: "AttachmentError", code: "UNSUPPORTED_IMAGE_TYPE", message: "Image type image/avif is not accepted by this deployment." },
    });
  });

  test("lô vượt trần số ảnh", async () => {
    const storeA = makeStore(A, newHome("ca"));
    const storeB = makeStore(B, newHome("cb"));
    const many: ImageInput[] = Array.from({ length: 21 }, () => ({ data: PNG_1X1, mediaType: "image/png" }));
    const resultA = await outcome(() => storeA.saveImages(many));
    const resultB = await outcome(() => storeB.saveImages(many));
    expect(resultB).toEqual(resultA);
    expect(resultA).toEqual({
      ok: false,
      error: { name: "AttachmentError", code: "TOO_MANY_IMAGES", message: "Image batch exceeds the configured image-count limit." },
    });
  });

  test("imageCompressionConcurrency ngoài khoảng 1..8", async () => {
    for (const value of [0, 9]) {
      const homeA = newHome("na");
      const homeB = newHome("nb");
      const resultA = await outcome(async () => new A.LocalAttachmentStore(new Context(), { dshHome: homeA, imageCompressionConcurrency: value }));
      const resultB = await outcome(async () => new B.LocalAttachmentStore(new Context(), { dshHome: homeB, imageCompressionConcurrency: value }));
      expect(resultB).toEqual(resultA);
      expect(resultA).toEqual({
        ok: false,
        error: {
          name: "Error",
          code: null,
          message: "attachment-local: imageCompressionConcurrency must be an integer from 1 through 8",
        },
      });
    }
  });

  test("tham chiếu ảnh sai định dạng", async () => {
    const storeA = makeStore(A, newHome("ia"));
    const storeB = makeStore(B, newHome("ib"));
    const bad: ImageRef = { attachmentId: "nope", mediaType: "image/png", width: 1, height: 1, bytes: 1 };
    const resultA = await outcome(() => storeA.readImage(bad));
    const resultB = await outcome(() => storeB.readImage(bad));
    expect(resultB).toEqual(resultA);
    expect(resultA).toEqual({
      ok: false,
      error: { name: "AttachmentError", code: "INVALID_ATTACHMENT_REF", message: "Attachment reference is invalid." },
    });
  });

  test("tham chiếu tệp sai định dạng", async () => {
    const storeA = makeStore(A, newHome("ja"));
    const storeB = makeStore(B, newHome("jb"));
    const bad: FileRef = { attachmentId: "nope", name: "x", bytes: 1 };
    const resultA = await outcome(async () => storeA.fileHostPath(bad));
    const resultB = await outcome(async () => storeB.fileHostPath(bad));
    expect(resultB).toEqual(resultA);
    expect(resultA).toEqual({
      ok: false,
      error: { name: "AttachmentError", code: "INVALID_ATTACHMENT_REF", message: "File attachment reference is invalid." },
    });
  });
});
