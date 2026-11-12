/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Kiểm kê gói stock còn trong profile + kernel và đối chiếu bản GBH đã có ⇒ "danh sách cần chuyển" chính thức.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Gốc repo (tools/check ⇒ hai cấp lên). */
const REPO = join(import.meta.dir, "..", "..");
/** node_modules của kernel đóng băng (CHỈ ĐỌC). */
const KERNEL = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** node_modules của profile đang chạy. */
const PROFILE = join(homedir(), ".galaxy", "blackhole", "profiles", "node_modules", "@deepseek-ai");

/** Một gói stock nhìn từ đĩa. */
interface StockPackage {
  /** Tên đầy đủ, vd `@deepseek-ai/dsh-settings`. */ readonly name: string;
  /** Nơi thấy: `profile`, `kernel`, hay cả hai. */ readonly where: string;
  /** Có khai `dsh.bundle.patch` (⇒ là gói BUNDLE của DSH). */ readonly isBundle: boolean;
  /** Có khai `dsh.client` (⇒ có nửa browser). */ readonly isClient: boolean;
  /** package.json khai tên gói CỦA TA ⇒ đây là entry ALIAS (stock-name trỏ về gói GBH) ⇒ coi như đã chuyển. */
  readonly aliasOfOurs: boolean;
}

/** Một gói GBH trong repo. */
interface OursPackage {
  /** Tên đầy đủ, vd `@galaxy-blackhole/gbh-settings`. */ readonly name: string;
  /** Đường dẫn thư mục. */ readonly dir: string;
  /** Tên gói stock mà gói này thay thế (nếu khai). */ readonly stock: readonly string[];
  /** Có khai `dsh.bundle.patch` ⇒ là gói bundle của ta. */ readonly isBundle: boolean;
}

/**
 * Đọc mọi gói `@deepseek-ai/*` trong một thư mục node_modules.
 * Nhận: thư mục scope và nhãn nơi (`profile`/`kernel`).
 * Trả: danh sách gói stock đọc được (bỏ qua mục không có package.json).
 */
function readStock(scopeDir: string, label: string): StockPackage[] {
  if (!existsSync(scopeDir)) return [];
  const out: StockPackage[] = [];
  for (const name of readdirSync(scopeDir).sort()) {
    const manifestPath = join(scopeDir, name, "package.json");
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name?: string;
        dsh?: { bundle?: { patch?: unknown }; client?: unknown };
      };
      const full = typeof manifest.name === "string" && manifest.name !== "" ? manifest.name : "@deepseek-ai/" + name;
      // Tên nhận diện = `@deepseek-ai/<tên thư mục>` (KHÔNG lấy manifest.name: profile dùng tên thư mục stock
      // cho entry alias trỏ về gói của ta, nên manifest.name có thể là `@galaxy-blackhole/...`).
      out.push({
        name: "@deepseek-ai/" + name,
        where: label,
        isBundle: manifest.dsh?.bundle?.patch !== undefined,
        isClient: manifest.dsh?.client !== undefined,
        aliasOfOurs: full.startsWith("@galaxy-blackhole/"),
      });
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Đọc mọi gói GBH trong `packages/{host,client,shared}` và rút quan hệ với gói stock.
 * Nhận: không.
 * Trả: danh sách gói của ta đã chuẩn hoá thông tin.
 */
function readOurs(): OursPackage[] {
  const out: OursPackage[] = [];
  for (const tier of ["host", "client", "shared"]) {
    const tierDir = join(REPO, "packages", tier);
    if (!existsSync(tierDir)) continue;
    for (const name of readdirSync(tierDir).sort()) {
      const dir = join(tierDir, name);
      const manifestPath = join(dir, "package.json");
      if (!existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
          name?: string;
          dsh?: { bundle?: { patch?: unknown } };
          gbh?: {
            provenance?: { stock?: unknown };
            row?: { id?: unknown; aliases?: unknown; moduleIds?: unknown };
            nested?: { stockId?: unknown } | { stockId?: unknown }[];
            draft?: unknown;
          };
        };
        const stock = new Set<string>();
        const provenance = manifest.gbh?.provenance?.stock;
        if (typeof provenance === "string") stock.add(provenance);
        const aliases = manifest.gbh?.row?.aliases;
        if (Array.isArray(aliases)) for (const alias of aliases) if (typeof alias === "string") stock.add(alias);
        const nested = manifest.gbh?.nested;
        const nestedList = Array.isArray(nested) ? nested : nested === undefined ? [] : [nested];
        for (const item of nestedList) {
          const stockId = (item as { stockId?: unknown } | undefined)?.stockId;
          if (typeof stockId === "string") stock.add(stockId);
        }
        out.push({
          name: typeof manifest.name === "string" ? manifest.name : "@galaxy-blackhole/gbh-" + name,
          dir,
          stock: [...stock],
          isBundle: manifest.dsh?.bundle?.patch !== undefined,
        });
      } catch {
        continue;
      }
    }
  }
  return out;
}

/**
 * Quy ước tên: `@deepseek-ai/dsh-X` → `@galaxy-blackhole/gbh-X` (bỏ tiền tố `dsh-`).
 * Nhận: tên gói stock. Trả: tên gói ta tương ứng THEO QUY ƯỚC (chưa chắc tồn tại).
 */
function conventionalName(stock: string): string {
  const short = stock.replace("@deepseek-ai/dsh-", "").replace("@deepseek-ai/", "");
  return "@galaxy-blackhole/gbh-" + short;
}

/**
 * Phân nhóm một gói stock CHƯA chuyển.
 * Nhận: gói stock. Trả: `(i) bundle` · `(ii) phụ thuộc kỹ thuật` · `(iii) gói thật chưa port`.
 */
function classify(pkg: StockPackage): "(i) bundle" | "(ii) phụ thuộc kỹ thuật" | "(iii) gói thật chưa port" {
  if (pkg.isBundle) return "(i) bundle";
  const short = pkg.name.replace("@deepseek-ai/", "");
  // (ii) = hạ tầng/kỹ thuật: kernel cordis, util, và BINARY native (không phải plugin viết lại được).
  const technical = [
    "cordis",
    "schemastery",
    "cosmokit",
    "util-",
    "loader-",
    "plugin-",
    "reflect-",
    "inject-",
    "logger-",
    "timer-",
    "libreoffice-kit",
    "node-addon-system",
  ];
  // Gói CLI của chính DSH (`@deepseek-ai/dsh`) là hạ tầng, không phải plugin.
  if (short === "dsh") return "(ii) phụ thuộc kỹ thuật";
  if (technical.some((prefix) => short.startsWith(prefix) || short.includes(prefix))) return "(ii) phụ thuộc kỹ thuật";
  return "(iii) gói thật chưa port";
}

/**
 * Điểm vào: kiểm kê rồi in bảng + tổng số.
 * Nhận: không. Trả: mã thoát (0 luôn — đây là lệnh ĐO, không phải cổng chặn).
 */
async function main(): Promise<number> {
  const stockAll = new Map<string, StockPackage>();
  for (const pkg of [...readStock(PROFILE, "profile"), ...readStock(KERNEL, "kernel")]) {
    const previous = stockAll.get(pkg.name);
    stockAll.set(pkg.name, {
      name: pkg.name,
      where: previous === undefined ? pkg.where : previous.where === pkg.where ? pkg.where : "profile+kernel",
      isBundle: pkg.isBundle || (previous?.isBundle ?? false),
      isClient: pkg.isClient || (previous?.isClient ?? false),
      aliasOfOurs: pkg.aliasOfOurs || (previous?.aliasOfOurs ?? false),
    });
  }
  const ours = readOurs();
  const oursByName = new Map(ours.map((pkg) => [pkg.name, pkg]));
  const stockToOurs = new Map<string, string>();
  for (const pkg of ours) for (const stockName of pkg.stock) stockToOurs.set(stockName, pkg.name);

  const converted: { stock: string; ours: string; via: string }[] = [];
  const pending: StockPackage[] = [];
  for (const pkg of [...stockAll.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const viaProvenance = stockToOurs.get(pkg.name);
    const viaName = oursByName.get(conventionalName(pkg.name))?.name;
    if (pkg.aliasOfOurs) converted.push({ stock: pkg.name, ours: "(entry alias trong profile)", via: "alias trong profile" });
    else if (viaProvenance !== undefined) converted.push({ stock: pkg.name, ours: viaProvenance, via: "provenance/alias" });
    else if (viaName !== undefined) converted.push({ stock: pkg.name, ours: viaName, via: "tên chuẩn hoá" });
    else pending.push(pkg);
  }

  console.log("");
  console.log("KIEM KE GOI STOCK ⇒ GBH");
  console.log("nguồn: profile " + PROFILE);
  console.log("       kernel  " + KERNEL);
  console.log("");
  console.log("TONG: " + String(stockAll.size) + " gói stock · ĐÃ CHUYỂN " + String(converted.length) + " · CHƯA CHUYỂN " + String(pending.length));
  console.log("");
  const groups = new Map<string, StockPackage[]>();
  for (const pkg of pending) {
    const group = classify(pkg);
    groups.set(group, [...(groups.get(group) ?? []), pkg]);
  }
  for (const group of [...groups.keys()].sort()) {
    const list = groups.get(group) ?? [];
    console.log(group + ": " + String(list.length) + " gói");
    for (const pkg of list) console.log("  - " + pkg.name + "  [" + pkg.where + (pkg.isClient ? " · client" : "") + "]");
    console.log("");
  }
  console.log("ĐÃ CHUYỂN (theo nguồn nhận diện):");
  for (const row of converted.slice(0, 12)) console.log("  - " + row.stock + " → " + row.ours + " (" + row.via + ")");
  if (converted.length > 12) console.log("  … và " + String(converted.length - 12) + " gói nữa");
  console.log("");
  console.log("KET LUAN: cần chuyển " + String(pending.length) + " gói — xem nhóm ở trên.");
  console.log("");
  return 0;
}

if (import.meta.main) process.exit(await main());
