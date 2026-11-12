/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-experimental-client-ui-voice-input: lib/index.js = nửa HOST (Bun.build
 *      RIÊNG) · lib/client-entry.js = marker nửa CLIENT (Bun.build RIÊNG thứ hai) · lib/client.js =
 *      nửa CLIENT ghép CƠ HỌC 1:1 từ 3 part + vỏ loader (P5), CHỈ đổi id module, có CỔNG BYTE + CỔNG ID
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import {
  assembleClient,
  clientPartNames,
  OUR_CLIENT_ID,
  readWrapper,
  STOCK_CLIENT_ID,
} from "./src/client-assemble.ts";

/** Một entrypoint của gói: nguồn trong `src/` → artifact trong `lib/`. */
export interface EntryPoint {
  /** Khoá của entry trong object `buildPackage` trả về (`host` = nửa host). */
  readonly key: "host";
  /** Tệp nguồn dưới `src/` (TS, ESM). */
  readonly source: string;
  /** Tên artifact dưới `lib/` — dùng luôn làm `naming` của Bun. */
  readonly artifact: string;
}

/**
 * Bảng entrypoint BUN của gói. Nửa client KHÔNG nằm ở đây: `lib/client.js` là bundle
 * `window.__ModuleLoader__.load(...)` ghép CƠ HỌC từ part nguyên văn (assemble + cổng byte); đưa qua
 * Bun.build sẽ bị đóng gói lại ⇒ lệch byte. Vì thế bảng chỉ có nửa host — KHÔNG gộp entry (task-130).
 */
export const ENTRY_POINTS: readonly EntryPoint[] = [
  { key: "host", source: "index.ts", artifact: "index.js" },
];

/** Nguồn của entry MARKER nửa client — build riêng thành `lib/client-entry.js`, KHÔNG nằm trong ENTRY_POINTS. */
const CLIENT_ENTRY_SOURCE = "client.ts";
/** Tên artifact marker nửa client dưới `lib/` — KHÔNG phải bundle client thật (`lib/client.js`). */
const CLIENT_ENTRY_ARTIFACT = "client-entry.js";

/** Đường dẫn artifact của từng entry đã build, tra theo khoá entrypoint. */
export interface BuiltEntries {
  /** Nửa HOST — `lib/index.js` (điểm vào `main` của package.json). */
  host: string;
  /** Nửa CLIENT — `lib/client.js` (điểm vào export `./client` của package.json). */
  client: string;
  /** Entry MARKER nửa CLIENT — `lib/client-entry.js` (bằng chứng build riêng; KHÔNG được export). */
  clientEntry: string;
}

/** Gốc repo: packages/host/<gói> → ../../.. */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Bundle gốc (CHỈ ĐỌC) — oracle của cổng byte, KHÔNG sửa. */
const STOCK_CLIENT = join(
  REPO,
  "apps",
  "host",
  "node_modules",
  "@deepseek-ai",
  "dsh-experimental-client-ui-voice-input",
  "lib",
  "client.js",
);

/**
 * Băm sha256 một chuỗi UTF-8 để ghi bằng chứng byte.
 * Nhận: text — chuỗi cần băm.
 * Trả: chuỗi hex sha256.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Vị trí ký tự ĐẦU TIÊN khác nhau giữa hai chuỗi (báo lỗi cổng byte có địa chỉ).
 * Nhận: left — chuỗi thực tế; right — chuỗi mong đợi.
 * Trả: chỉ số ký tự đầu tiên khác, hoặc -1 khi bằng nhau.
 */
function firstDifference(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) if (left[index] !== right[index]) return index;
  return left.length === right.length ? -1 : limit;
}

/**
 * Đếm số lần một chuỗi con xuất hiện (không chồng lấn).
 * Nhận: haystack — chuỗi nguồn; needle — chuỗi cần đếm.
 * Trả: số lần xuất hiện của needle trong haystack.
 */
function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Delta khai báo 26/10/2026 — chèn nhãn "Tiếng Việt" cho mã ngôn ngữ "vi" vào bảng languageNames của client stock.
 * Nhận: text — thân bundle (bản ghép hoặc bản gốc đã quy đổi id).
 * Trả: text đã chèn đúng MỘT dòng nhãn.
 */
export function withVietnameseLabel(text: string): string {
  return text.replace(
    '\t\t\t\tko: props.t("ko")',
    '\t\t\t\tko: props.t("ko"),\n\t\t\t\t// 26/10/2026 — delta khai báo: provider PhoWhisper khai ngôn ngữ "vi".\n\t\t\t\tvi: props.t("vi")',
  );
}

/**
 * Build nửa CLIENT: ghép part, kiểm KHUÔN VỎ, kiểm CỔNG BYTE với bundle gốc rồi kiểm CỔNG ID, ghi
 * `lib/client.js`.
 *
 * Nhận: outDir — thư mục `lib` đích (đã tồn tại).
 * Trả: không; ném lỗi (kèm địa chỉ ký tự lệch + sha256 hai bên + số lần id) khi lệch cổng.
 */

export function buildClient(outDir: string): void {
  const stock = readFileSync(STOCK_CLIENT, "utf8");
  // 26/10/2026 — delta khai báo (nhãn "Tiếng Việt"): áp lên bản ghép, xem chú thích ở cổng byte bên dưới.
  const assembled = withVietnameseLabel(assembleClient());
  const { head } = readWrapper();
  // CỔNG 1 — KHUÔN VỎ: 3 dòng đầu đúng khuôn, dòng id là id CỦA TA, không lẫn id gốc.
  if (head[0] !== "window.__ModuleLoader__.load({") throw new Error("vỏ client: dòng đầu không phải load({");
  if (head[1] !== '\tid: "' + OUR_CLIENT_ID + '",') throw new Error("vỏ client: dòng id không phải id của ta");
  if (head[2] !== "\tfactory: (require) => {") throw new Error("vỏ client: dòng mở factory không đúng");
  // CỔNG 2 — BYTE (mạnh hơn "quy đổi toàn bộ id"): phần THÂN phải NGUYÊN VĂN, nên bản ghép chỉ được khác
  // bundle gốc ĐÚNG MỘT dòng — dòng id module của vỏ. Lệch 1 byte ⇒ DỪNG (evidence part nguyên văn).
  const stockIdLine = '\tid: "' + STOCK_CLIENT_ID + '",';
  const ourIdLine = '\tid: "' + OUR_CLIENT_ID + '",';
  if (countOccurrences(stock, stockIdLine) !== 1) {
    throw new Error("bundle gốc: dòng id module không đúng 1 lần — DỪNG build");
  }
  // 20/10/2026: part nguồn đã REWRITE specifier gateway sang id ta (bỏ dần id stock khỏi payload) ⇒
  // bản gốc-quy-đổi phải quy tương ứng; sai lệch còn lại chỉ là id, không phải logic.
  const byteExpected = withVietnameseLabel(
    stock
      .replace(stockIdLine, ourIdLine)
      .split("@deepseek-ai/dsh-api-gateway")
      .join("@galaxy-blackhole/gbh-host-typert-gateway")
      // P3 (04/11/2026): module ao store doi id => goc-quy-doi phai quy tuong ung.
      .split("@deepseek-ai/dsh-client-store")
      .join("@galaxy-blackhole/gbh-client-store")
      .split("@deepseek-ai/dsh-client-ui-primitives")
      .join("@galaxy-blackhole/gbh-client-ui-primitives"),
  );
  if (assembled !== byteExpected) {
    throw new Error(
      "nửa client KHÔNG trùng bản gốc (chỉ đổi dòng id module): ghép " +
        String(Buffer.byteLength(assembled)) +
        " B / sha " +
        sha256(assembled) +
        " · gốc " +
        String(Buffer.byteLength(byteExpected)) +
        " B / sha " +
        sha256(byteExpected) +
        " · lệch đầu tiên ở ký tự " +
        String(firstDifference(assembled, byteExpected)) +
        " — DỪNG build",
    );
  }
  // CỔNG 3 — ID/ASSET: bundle gốc nhắc id module 3 lần (dòng `id:` của vỏ + 2 tham chiếu asset CSS:
  // tagId của <style> và dataset.plugin). Hai tham chiếu trong THÂN đổi sang id ta SAU cổng byte nên part
  // vẫn nguyên văn; số kỳ vọng ĐO TỪ stock (không hard-code), còn id gốc là DỪNG.
  const expectedOwned = countOccurrences(stock, STOCK_CLIENT_ID);
  const owned = assembled.split(STOCK_CLIENT_ID).join(OUR_CLIENT_ID);
  const stockLeft = countOccurrences(owned, STOCK_CLIENT_ID);
  const oursCount = countOccurrences(owned, OUR_CLIENT_ID);
  if (stockLeft !== 0 || oursCount !== expectedOwned) {
    throw new Error(
      "cổng id: id gốc còn " + String(stockLeft) + " lần, id ta " + String(oursCount) +
        " lần (kỳ vọng 0/" + String(expectedOwned) + ") — DỪNG build",
    );
  }
  // CỔNG 4 — MỘT-ID: dòng id module xuất hiện ĐÚNG 1 lần; bản cuối phải bằng bundle gốc quy đổi TOÀN BỘ id
  // (tương đương phép split/join của cổng byte api-remotes, chỉ khác là ở đây id gốc có 3 lần).
  if (countOccurrences(owned, ourIdLine) !== 1) {
    throw new Error("cổng id: dòng id module của ta không đúng 1 lần — DỪNG build");
  }
  // 20/10/2026: ngoài id module, part nguồn đã REWRITE specifier gateway sang id ta ⇒ quy cả specifier đó,
  // nếu không cổng "quy đổi toàn bộ id" sẽ đỏ dù artefact chỉ khác ID (không khác logic).
  // 26/10/2026 — delta khai báo (nhãn "Tiếng Việt") áp ĐỐI XỨNG cả hai vế, xem withVietnameseLabel().
  const fullyConverted = withVietnameseLabel(
    stock
      .split(STOCK_CLIENT_ID)
      .join(OUR_CLIENT_ID)
      .split("@deepseek-ai/dsh-api-gateway")
      .join("@galaxy-blackhole/gbh-host-typert-gateway")
      // P3 (04/11/2026): module ao store doi id => goc-quy-doi phai quy tuong ung.
      .split("@deepseek-ai/dsh-client-store")
      .join("@galaxy-blackhole/gbh-client-store")
      .split("@deepseek-ai/dsh-client-ui-primitives")
      .join("@galaxy-blackhole/gbh-client-ui-primitives"),
  );
  if (owned !== fullyConverted) {
    throw new Error("cổng quy đổi: bản cuối khác bundle gốc đã quy đổi toàn bộ id — DỪNG build");
  }
  writeFileSync(join(outDir, "client.js"), owned);
  console.log(
    "client: " + String(clientPartNames().length) + " part · " +
      String(Buffer.byteLength(owned)) + " B (" + String(countOccurrences(owned, "\n")) + " dòng; gốc " +
      String(Buffer.byteLength(stock)) + " B / " + String(countOccurrences(stock, "\n")) + " dòng, +" +
      String(Buffer.byteLength(owned) - Buffer.byteLength(stock)) + " byte do id ta dài hơn 5 byte × 3 lần) · sha256 " +
      sha256(owned) + " · id gốc còn lại: 0 lần · id ta: " + String(oursCount) +
      " lần (1 dòng id module + 2 tham chiếu asset CSS)",
  );
}

/**
 * Build MỘT entrypoint thành artifact ESM duy nhất trong `out`.
 *
 * Nhận: `entry` — dòng của `ENTRY_POINTS`; `out` — thư mục đích đã tồn tại.
 * Trả: đường dẫn tuyệt đối của artifact vừa build.
 * @throws {Error} khi `Bun.build` thất bại (kèm log của Bun).
 */
async function buildEntry(entry: EntryPoint, out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", entry.source)],
    outdir: out,
    target: "node",
    format: "esm",
    naming: entry.artifact,
    packages: "external",
  });
  if (!result.success) {
    throw new Error(
      "gbh-experimental-client-ui-voice-input: build " + entry.source + " thất bại: " +
        result.logs.map((log) => String(log)).join(" | "),
    );
  }
  return join(out, entry.artifact);
}

/**
 * GHI CHÚ KIẾN TRÚC (bất biến khi sửa `build.ts`): `buildClient()` + `src/client-parts/part-*.txt` +
 * `src/client-assemble.ts` là nửa client port CƠ HỌC. GIỮ lời gọi `Bun.build` RIÊNG của host và của
 * marker (hàm dưới); KHÔNG gộp hai lời gọi `Bun.build` vào một lần (task-130: prelude chia sẻ làm lệch
 * byte) và KHÔNG đưa `lib/client.js` qua `Bun.build` — bundle client phải giữ nguyên văn từng byte
 * (chỉ đổi id module ở vỏ). Bản cuối: 3 part × 990 dòng, 119.532 B, sha256 fd6775…, cổng byte + id PASS.
 */

/**
 * Build entry MARKER của nửa client (`src/client.ts` → `lib/client-entry.js`) bằng một lời gọi
 * `Bun.build` RIÊNG. Entry này chứng minh gói HAI MẶT có nửa client và giữ `ENTRY_POINTS` chỉ host để
 * bundle client thật (ghép cơ học từ part) không bị Bun đóng gói lại.
 *
 * Nhận: `outDir` — thư mục `lib` đích (đã tồn tại).
 * Trả: đường dẫn tuyệt đối của `lib/client-entry.js` vừa build.
 * @throws {Error} khi `Bun.build` thất bại (kèm log của Bun).
 */
async function buildClientEntry(outDir: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", CLIENT_ENTRY_SOURCE)],
    outdir: outDir,
    target: "node",
    format: "esm",
    naming: CLIENT_ENTRY_ARTIFACT,
    packages: "external",
  });
  if (!result.success) {
    throw new Error(
      "gbh-experimental-client-ui-voice-input: build " + CLIENT_ENTRY_SOURCE + " thất bại: " +
        result.logs.map((log) => String(log)).join(" | "),
    );
  }
  return join(outDir, CLIENT_ENTRY_ARTIFACT);
}

/**
 * Build gói vào `outDir`: nửa HOST bằng `Bun.build` RIÊNG cho từng entry của `ENTRY_POINTS`, entry
 * MARKER nửa client bằng một `Bun.build` RIÊNG, rồi nửa CLIENT thật bằng assemble + cổng byte/id.
 *
 * Nhận: `outDir` — thư mục đích (mặc định `lib` cạnh package; tầng mount truyền qua `process.argv[2]`);
 * thư mục được DỌN một lần trước khi build.
 * Trả: object `{ host, clientEntry, client }` — đường dẫn tuyệt đối của từng artifact đã build.
 * @throws {Error} khi thiếu entry host trong bảng hoặc khi Bun build/assemble hỏng.
 */
export async function buildPackage(outDir?: string): Promise<BuiltEntries> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const built = new Map<string, string>();
  for (const entry of ENTRY_POINTS) built.set(entry.key, await buildEntry(entry, out));
  const host = built.get("host");
  if (host === undefined) throw new Error("gbh-experimental-client-ui-voice-input: ENTRY_POINTS thiếu entry host");
  const clientEntry = await buildClientEntry(out);
  buildClient(out);
  return { host, clientEntry, client: join(out, "client.js") };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.clientEntry);
  console.log("built " + built.client);
}
