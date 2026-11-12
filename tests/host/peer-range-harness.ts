/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Phép kiểm MẠNH cho "dải peer" của gói row: dải khai trong `peerDependencies` của ta phải BẰNG
 *      ĐÚNG dải trong manifest STOCK của chính gói đó (parity), VÀ phải phủ bản kernel đang chạy
 *      (`Bun.semver.satisfies`) — nhờ đó vẫn chặn drift kiểu rc.5 dù stock khai dải alpha
 *      (vd cordis: stock `~4.0.5-alpha.2`, kernel đang chạy 4.0.5).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tệp này nằm ở `tests/host`). */
const REPO = join(import.meta.dir, "..", "..");
/** `node_modules` của kernel — nguồn của bản kernel đang chạy và của mọi manifest stock. */
const KERNEL_MODULES = join(REPO, "apps", "host", "node_modules");
/** Thư mục `@deepseek-ai` của kernel — nơi chứa manifest của TOÀN BỘ gói stock. */
const KERNEL_AI = join(KERNEL_MODULES, "@deepseek-ai");

/** Manifest nhìn qua đúng những trường mà phép kiểm đọc (JSON được miễn header). */
interface Manifest {
  /** Tên package. */
  name?: string;
  /** Phiên bản của chính package — dùng để tra bản kernel đang chạy. */
  version?: string;
  /** Phụ thuộc cứng. */
  dependencies?: Record<string, string>;
  /** Dải peer — nơi quy ước của repo đặt dải. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc chỉ dùng khi phát triển/test. */
  devDependencies?: Record<string, string>;
  /** Metadata của ta: danh sách peer và nguồn stock để đối chứng. */
  gbh?: { peers?: string[]; provenance?: { stock?: string } };
}

/**
 * Đọc một manifest JSON trên đĩa.
 * Nhận: path — đường dẫn tệp `package.json`.
 * Trả: manifest đã ép kiểu.
 */
function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

/**
 * Dải mà một manifest khai cho một tên, ở BẤT KỲ mục nào (peer → dependencies → devDependencies).
 * Nhận: manifest — manifest cần tra; peer — tên gói.
 * Trả: dải đã khai, hoặc `undefined` khi manifest KHÔNG khai tên đó.
 */
function declaredRange(manifest: Manifest, peer: string): string | undefined {
  return manifest.peerDependencies?.[peer] ?? manifest.dependencies?.[peer] ?? manifest.devDependencies?.[peer];
}

/** Sổ quy ước của kernel: tên peer → tập dải mà CÁC GÓI STOCK khác khai cho tên đó (dựng một lần). */
const KERNEL_CONVENTION = new Map<string, Set<string>>();

/**
 * Tập dải mà các gói stock trong kernel khai cho MỘT tên peer (quy ước chung của kernel).
 * Nhận: peer — tên gói cần tra.
 * Trả: tập dải đã sắp xếp; RỖNG khi không gói stock nào khai tên đó.
 */
function kernelConvention(peer: string): Set<string> {
  if (KERNEL_CONVENTION.size === 0) {
    for (const name of readdirSync(KERNEL_AI)) {
      const manifestPath = join(KERNEL_AI, name, "package.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = readManifest(manifestPath);
      for (const [peerName, range] of Object.entries(manifest.peerDependencies ?? {})) {
        const set = KERNEL_CONVENTION.get(peerName) ?? new Set<string>();
        set.add(range);
        KERNEL_CONVENTION.set(peerName, set);
      }
    }
  }
  return KERNEL_CONVENTION.get(peer) ?? new Set<string>();
}

/**
 * Các vi phạm quy ước dải peer của MỘT gói — phép kiểm MẠNH, KHÔNG nới lỏng:
 *   (1) dải của ta phải BẰNG ĐÚNG dải manifest stock khai cho cùng tên peer; gói GBH-ONLY (không có
 *       stock) thì dải phải nằm trong QUY ƯỚC CHUNG của kernel cho tên peer đó (tập dải mọi gói stock khai);
 *   (2) dải khai ra phải phủ bản kernel đang chạy (`Bun.semver.satisfies`) ⇒ còn chặn drift rc.5;
 *   (3) tên trong `gbh.peers` phải có mặt trong `peerDependencies`.
 * Nhận: pkgDir — thư mục gói của ta (chứa `package.json`, có thể có `gbh.provenance.stock`).
 * Trả: danh sách câu vi phạm đã sắp xếp — RỖNG mới là đạt.
 */
export function peerRangeProblems(pkgDir: string): string[] {
  const manifest = readManifest(join(pkgDir, "package.json"));
  const stockName = manifest.gbh?.provenance?.stock;
  const stock = stockName === undefined ? undefined : readManifest(join(KERNEL_MODULES, stockName, "package.json"));
  const problems: string[] = [];
  for (const peer of manifest.gbh?.peers ?? []) {
    const ours = manifest.peerDependencies?.[peer];
    const kernel = readManifest(join(KERNEL_MODULES, peer, "package.json")).version ?? "";
    const expected = stock === undefined ? undefined : declaredRange(stock, peer);
    const convention = kernelConvention(peer);
    if (ours === undefined) {
      problems.push(peer + ": thiếu trong peerDependencies");
      continue;
    }
    if (expected !== undefined && ours !== expected) problems.push(peer + ": dải ta khai " + ours + " ≠ dải stock " + expected);
    else if (expected === undefined && convention.size > 0 && !convention.has(ours)) {
      problems.push(peer + ": dải " + ours + " không nằm trong quy ước kernel {" + [...convention].sort().join(" | ") + "}");
    }
    if (!Bun.semver.satisfies(kernel, ours)) problems.push(peer + ": dải " + ours + " KHÔNG phủ bản kernel " + kernel);
  }
  return problems.sort();
}
