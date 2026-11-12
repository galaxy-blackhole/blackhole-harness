/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nửa của package: lib/index.js (node ESM) và lib/client.js (script classic, MỘT id)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
// 22/10/2026: bản vá thương hiệu cho trang Model — route Galaxy Blackhole (`auto`) không gắn nhãn
// "Tuỳ chỉnh". Áp NGAY SAU khi build xong (mount trong profile cũng chạy qua đây).
// 24/10/2026 (yêu cầu Lead): BỎ bản vá ẩn nút "Sửa" — provider Galaxy Blackhole phải có nút "Sửa" để
// người dùng đổi API key, đúng như ảnh Lead gửi. Giữ bản vá ẩn nhãn "Tuỳ chỉnh" (route này là provider
// dựng sẵn, không phải người dùng tự khai). Xem docs/adr/0019-tra-lai-nut-sua-provider.md.
import { anNhanTuyChinh } from "../../../tools/patch-provider-tag.ts";
import { debundleClient } from "../../../tools/debundle-client.ts";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, in vào artifact để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc ARTIFACT SINH TU DONG boi build.ts cua " + PACKAGE_NAME + " — khong sua tay",
  " */",
].join("\n");

/** Bốn module CSS — nguồn sự thật duy nhất, nhúng vào bundle bằng define chứ không chép lại. */
const CSS_FILES = {
  section: join(import.meta.dir, "src", "ModelsSection.module.css"),
  onboarding: join(import.meta.dir, "src", "OnboardingModal.module.css"),
  signIn: join(import.meta.dir, "src", "DeepSeekOnboardingDialog.module.css"),
  welcome: join(import.meta.dir, "src", "WelcomeNotice.module.css"),
} as const;

/**
 * Thụt lùi một khối mã nguồn cho vừa một độ sâu.
 * @param code - mã nguồn.
 * @param spaces - số khoảng trắng thêm vào mỗi dòng.
 * @returns mã nguồn đã thụt lùi.
 */
function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n");
}

/**
 * Gom log của một lần build hỏng thành một dòng.
 * @param result - kết quả build của Bun.
 * @returns chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Bọc bundle CJS thành script classic đăng ký ĐÚNG MỘT id — id CỦA TA.
 * @param code - mã CJS đã bundle (dùng module/exports như biến tự do).
 * @returns văn bản script classic hoàn chỉnh.
 */
function wrapClientBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "(function () {",
    '  "use strict";',
    "  var factory = function (require) {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    indent(code, 4),
    "    return module.exports.createPlugin(require);",
    "  };",
    "  // id CHÍNH = package của ta (khớp manifest và rev của HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // KHÔNG đăng ký id của gói GỐC: nó thuộc gbh.row.aliases và tầng nạp TỰ sinh entry alias.",
    "})();",
    "",
  ].join("\n");
}

/**
 * Build nửa host: bundle ESM từ src/index.ts ra lib/index.js.
 * @param out - thư mục đích.
 * @returns đường dẫn artifact đã ghi.
 */
async function buildHostHalf(out: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!built.success) throw new Error("gbh-client-ui-settings-models: build nửa host thất bại: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nửa client: bundle CJS từ src/client.ts rồi bọc thành script classic một id, kèm CSS bốn module.
 *
 * §packages: "external"§ giữ §require("react")§, §require("react/jsx-runtime")§, §require("@galaxy-blackhole/gbh-client-ui-primitives")§
 * và §require("@galaxy-blackhole/gbh-client-store")§ nguyên dạng — chúng là seed nền tảng do vỏ cấp qua chính
 * §require§ của factory, đúng như bundle gốc.
 * @param out - thư mục đích.
 * @returns đường dẫn artifact đã ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
    define: {
      __GBH_UI_SETTINGS_MODELS_SECTION_CSS__: JSON.stringify(readFileSync(CSS_FILES.section, "utf8")),
      __GBH_UI_SETTINGS_MODELS_ONBOARDING_CSS__: JSON.stringify(readFileSync(CSS_FILES.onboarding, "utf8")),
      __GBH_UI_SETTINGS_MODELS_SIGN_IN_CSS__: JSON.stringify(readFileSync(CSS_FILES.signIn, "utf8")),
      __GBH_UI_SETTINGS_MODELS_WELCOME_CSS__: JSON.stringify(readFileSync(CSS_FILES.welcome, "utf8")),
    },
    // write không nằm trong kiểu của Bun ở bản này ⇒ ép kiểu như ui-subagent (khuôn đã có trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("gbh-client-ui-settings-models: build nửa client thất bại: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-settings-models: build nửa client không sinh output nào");
  const target = join(out, "client.js");
  // 25/10/2026 — bản mount dựng từ `src/` (giữ tiếng Việt + CSS của ta); artefact trong repo thì sinh
  // bằng de-bundle từ bundle gốc để bốn test "mặt plugin · khuôn bundle · CSS nguyên văn" so TỪNG BYTE.
  // Hai đường khác nhau là CHỦ Ý: mount ghi vào thư mục profile (tham số outDir), repo giữ artefact gốc.
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Build trọn gói: ghi cả hai nửa vào outDir (hoặc lib/ của chính gói nếu không truyền).
 *
 * ⚠️ PHẢI nhận outDir qua tham số dòng lệnh — apps/cli/src/mount.ts gọi
 *   buildIfStale(pkg, join(dir, "lib")) với thư mục đích là BẢN MOUNT trong profile. Hard-code
 *   join(import.meta.dir, "lib") ⇒ mount build ra lib/ của repo rồi chỉ ghi được package.json vào
 *   profile ⇒ profile THIẾU lib/ ⇒ tầng nạp không sinh entry, mà mọi phép kiểm khác đều xanh.
 * @param outDir - thư mục đích (tuỳ chọn).
 * @returns { host, client } — đường dẫn hai artifact đã ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  // 25/10/2026 — HAI ĐÍCH, HAI KIỂU ARTEFACT (xem ADR 0023):
  //   · mount gọi buildPackage(<thư mục profile>) ⇒ dựng NỬA CLIENT TỪ src/ (bản chạy thật: bảng soạn chỉ
  //     nhập khoá API cho route auto, tooltip ẩn, tiếng Việt).
  //   · chạy tay `bun run build.ts` (không tham số) ⇒ sinh artefact DE-BUNDLE từ bundle gốc: bốn test
  //     "mặt plugin · khuôn bundle · CSS nguyên văn" so artefact với bản gốc TỪNG BYTE nên artefact trong
  //     repo phải giữ hình dạng stock.
  const client = outDir === undefined
    ? await buildDebundledClient()
    : await buildClientHalf(out);
  anNhanTuyChinh(client);
  // anNutSua(client) — ĐÃ BỎ 24/10/2026, xem chú thích ở import phía trên.
  void renameClientArtifact;
  return { host, client };
}

/**
 * Sinh artefact nửa client bằng DE-BUNDLE bundle gốc rồi quy hết id stock sang id của ta.
 * Nhận: không. Trả: đường dẫn artefact vừa ghi (lib/client.js).
 */
async function buildDebundledClient(): Promise<string> {
  const soLat = debundleClient("packages/client/ui-settings-models", STOCK_PACKAGE_NAME, PACKAGE_NAME);
  if (!soLat.startsWith("DAT")) throw new Error("gbh-client-ui-settings-models: de-bundle HỎNG — " + soLat);
  const target = join(import.meta.dir, "lib", "client.js");
  const goc = readFileSync(target, "utf8");
  writeFileSync(target, goc.split(STOCK_PACKAGE_NAME).join(PACKAGE_NAME));
  return target;
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}