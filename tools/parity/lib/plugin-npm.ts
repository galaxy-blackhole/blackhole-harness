/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Phần npm/pnpm của phép đo plugin-compat: gói ngoài, đối chiếu tarball theo BYTE, và đường
 *      cài CHÍNH THỨC của DSH (dsh plugin --profile <p> ... chuyển tiếp tham số cho pnpm)
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { repoPath, resolveNodeBin } from "./paths.ts";

/**
 * Plugin NGOÀI dùng làm bằng chứng G1: gói npm của BÊN THỨ BA (tác giả bowluna, không phải DeepSeek),
 * không nằm trong repo này và không do ta viết. Version/integrity lấy nguyên từ registry npm.
 */
export const EXTERNAL_PLUGIN = Object.freeze({
  /** Tên gói trên npm. */
  name: "dsh-custom-mode",
  /** Phiên bản đã đo. */
  version: "2.2.4",
  /** SRI sha512 của tarball trên registry (đối chiếu BYTE, không tin HTTP 200). */
  integrity: "sha512-v/eNsZjHrTlef/4OjRsdyLd6VF1/sEfBu+XSmvfABPNuXsJpvWBpEkQYtXHfiwmkaGJUE70uXeCDpnpxuyQ3qQ==",
  /** Tác giả gói. */
  author: "bowluna",
  /** Giấy phép. */
  license: "MIT",
  /** Kho mã nguồn. */
  repository: "https://github.com/BOWLUNA/dsh-custom-mode",
  /** Route riêng mà nửa host của plugin đăng ký — bằng chứng nó ĐANG CHẠY. */
  route: "/api/custom-mode",
  /** Id row mà bundle patch của plugin chèn vào cây. */
  dumpRowId: "custom-mode",
  /** Chuỗi chỉ có trong bundle client của plugin — bằng chứng nửa client đã tới trình duyệt. */
  clientMarker: "settings.customMode",
  /** Nhãn trang Settings theo từng ngôn ngữ của plugin (dùng để nhận diện UI). */
  navLabels: Object.freeze(["自定义模式", "Custom mode"]),
  /** Các tệp plugin gieo vào home khi nó chạy thật (dấu vết tác dụng phụ cần dọn). */
  seededPresetFiles: Object.freeze(["agent.cordis.yml", "preset.yml", "prompt.md", "prompt-reader.mjs", "prompt-tool.mjs"]),
});

/** Kết quả một lần gọi pnpm/dsh. */
export interface CommandRun {
  /** true khi exit code = 0. */
  ok: boolean;
  /** Exit code. */
  exitCode: number;
  /** stdout + stderr đã gộp (đã cắt bớt). */
  output: string;
  /** Thời gian chạy (ms). */
  durationMs: number;
}

/** Kết quả đối chiếu tarball trên registry. */
export interface TarballCheck {
  /** URL tarball. */
  url: string;
  /** Mã HTTP (chỉ tham khảo — KHÔNG dùng làm bằng chứng). */
  httpStatus: number;
  /** Số byte tải được. */
  bytes: number;
  /** true khi sha512 khớp đúng SRI của registry. */
  integrityOk: boolean;
  /** true khi byte đầu là magic gzip 1f 8b. */
  gzipMagicOk: boolean;
  /** Thời gian tải (ms). */
  ms: number;
}

/** Thông tin pnpm dùng để cài. */
export interface PnpmInfo {
  /** true khi có pnpm chạy được. */
  ok: boolean;
  /** Đường dẫn pnpm. */
  bin: string;
  /** Phiên bản. */
  version: string;
  /** Nguồn tìm được (PATH / tiền tố cục bộ / vừa cài). */
  source: string;
  /** Ghi chú cho báo cáo. */
  note: string;
}

/**
 * Băm một tệp thành sha256 hex.
 * @param file đường dẫn tệp.
 * @returns chuỗi hex, hoặc chuỗi rỗng nếu không đọc được.
 */
export function hashFile(file: string): string {
  try {
    return createHash("sha256").update(readFileSync(file)).digest("hex");
  } catch {
    return "";
  }
}

/**
 * Băm một buffer thành sha512 base64 (đúng dạng SRI của registry npm).
 * @param data dữ liệu.
 * @returns chuỗi SRI.
 */
export function sriSha512(data: Buffer): string {
  return "sha512-" + createHash("sha512").update(data).digest("base64");
}

/**
 * Đường dẫn `bin.js` của harness mà app đang pin.
 * @returns đường dẫn tuyệt đối.
 */
export function dshBin(): string {
  return repoPath("apps", "host", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
}

/**
 * PATH có sẵn node >= 26 ở đầu. Shim của pnpm dùng shebang `#!/usr/bin/env node`, nên thiếu node
 * trên PATH là pnpm thoát ngay — đây chính là lý do lệnh cài trả 127 "pnpm was not found".
 * @param path PATH hiện tại (mặc định lấy từ môi trường).
 * @returns PATH đã chèn thư mục bin của node.
 */
export function pathWithNode(path: string = process.env.PATH ?? ""): string {
  const nodeDir = dirname(resolveNodeBin());
  return path.split(":").includes(nodeDir) ? path : nodeDir + ":" + path;
}

/**
 * Tìm pnpm và, nếu máy chưa có, cài nó vào một tiền tố RIÊNG (không đụng cài đặt toàn cục).
 * DSH cài plugin bằng cách chuyển tiếp tham số cho pnpm trong thư mục profile, nên đây là điều
 * kiện tiên quyết để dùng ĐÚNG đường của DSH thay vì tự chép tay vào node_modules.
 * @returns thông tin pnpm, kèm ok=false và lý do khi không thể có pnpm.
 */
export function ensurePnpm(): PnpmInfo {
  const prefix = process.env.GBH_PNPM_PREFIX ?? "/tmp/gbh-pnpm-tools";
  const env = { ...process.env, PATH: pathWithNode() };
  const candidates: { bin: string; source: string }[] = [
    { bin: process.env.GBH_PNPM ?? "", source: "GBH_PNPM" },
    { bin: "pnpm", source: "PATH" },
    { bin: join(prefix, "node_modules", ".bin", "pnpm"), source: "tiền tố cục bộ " + prefix },
  ];
  const probeOne = (bin: string): string | null => {
    if (bin === "") return null;
    const probe = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 60_000, env });
    const version = (probe.stdout ?? "").trim();
    return probe.status === 0 && version.length > 0 ? version : null;
  };
  for (const candidate of candidates) {
    const version = probeOne(candidate.bin);
    if (version !== null) return { ok: true, bin: candidate.bin, version, source: candidate.source, note: "đã có sẵn" };
  }
  // Chưa có pnpm: cài vào tiền tố riêng bằng npm (máy này npm nằm trong bin của nvm node 26).
  const npmCandidates = [process.env.GBH_NPM ?? "", "/Users/buitronghieu/.nvm/versions/node/v26.9.0/bin/npm", "npm"];
  const npm = npmCandidates.find((value) => value !== "" && spawnSync(value, ["--version"], { encoding: "utf8", timeout: 60_000, env }).status === 0);
  if (npm === undefined) {
    return {
      ok: false,
      bin: "",
      version: "",
      source: "không có",
      note: "không thấy pnpm lẫn npm — không dùng được đường cài chính thức của DSH",
    };
  }
  const install = spawnSync(npm, ["install", "--prefix", prefix, "pnpm@9", "--no-fund", "--no-audit", "--loglevel=error"], {
    encoding: "utf8",
    timeout: 300_000,
    env,
  });
  const version = probeOne(join(prefix, "node_modules", ".bin", "pnpm"));
  if (version === null) {
    return { ok: false, bin: "", version: "", source: "npm " + npm, note: "npm cài pnpm thất bại: " + (install.stdout ?? "").slice(-200) };
  }
  return {
    ok: true,
    bin: join(prefix, "node_modules", ".bin", "pnpm"),
    version,
    source: "vừa cài bằng npm vào " + prefix,
    note: "máy không có pnpm trên PATH — parity tự cài pnpm vào tiền tố cục bộ, không đụng cài đặt toàn cục",
  };
}

/**
 * Chạy một lệnh quản lý plugin của DSH (đường chính thức để cài/gỡ plugin của profile).
 * @param home DSH_HOME của app.
 * @param profile tên profile.
 * @param args tham số sau plugin --profile <p> (ví dụ: add -w <pkg>).
 * @param pnpmBin đường dẫn pnpm để đặt lên đầu PATH.
 * @returns kết quả lệnh kèm output đã cắt.
 */
export function runDshPlugin(home: string, profile: string, args: readonly string[], pnpmBin: string): CommandRun {
  const startedAt = Date.now();
  const withPnpm = pnpmBin === "" ? pathWithNode() : pathWithNode(dirname(pnpmBin) + ":" + (process.env.PATH ?? ""));
  const probe = spawnSync(resolveNodeBin(), [dshBin(), "plugin", "--profile", profile, ...args], {
    cwd: repoPath(),
    env: { ...process.env, DSH_HOME: home, PATH: withPnpm },
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = ((probe.stdout ?? "") + (probe.stderr ?? "")).trim().split("\n").slice(-14).join("\n");
  return { ok: probe.status === 0, exitCode: probe.status ?? -1, output, durationMs: Date.now() - startedAt };
}

/**
 * Tải tarball từ registry và đối chiếu BYTE với SRI (không tin mã HTTP).
 * @param name tên gói.
 * @param version phiên bản.
 * @param integrity chuỗi SRI kỳ vọng.
 * @returns kết quả đối chiếu.
 */
export async function checkTarball(name: string, version: string, integrity: string): Promise<TarballCheck> {
  const url = "https://registry.npmjs.org/" + name + "/-/" + name + "-" + version + ".tgz";
  const startedAt = Date.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  const data = Buffer.from(await response.arrayBuffer());
  return {
    url,
    httpStatus: response.status,
    bytes: data.length,
    integrityOk: sriSha512(data) === integrity,
    gzipMagicOk: data.length > 2 && data[0] === 0x1f && data[1] === 0x8b,
    ms: Date.now() - startedAt,
  };
}
