/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Cổng kiểm alias stock→ta trong profile: đếm alias, và liệt kê tên stock mà lib de-bundle import nhưng KHÔNG phân giải được (phải = 0).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** node_modules của profile đang chạy. */
const PROFILE = join(homedir(), ".galaxy", "blackhole", "profiles", "node_modules");

/**
 * Đọc mọi tệp .js trong một thư mục (một cấp).
 * Nhận: thư mục. Trả: danh sách đường dẫn tệp .js.
 */
function jsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(dir, name));
}

/**
 * Điểm vào: in số alias stock→ta và các tên stock KHÔNG phân giải được.
 * Nhận: không. Trả: 0 khi mọi tên stock đều phân giải được, 1 khi còn tên gãy.
 */
async function main(): Promise<number> {
  const gbhDir = join(PROFILE, "@galaxy-blackhole");
  const stockDir = join(PROFILE, "@deepseek-ai");
  const ours = existsSync(gbhDir) ? readdirSync(gbhDir).sort() : [];
  const stock = existsSync(stockDir) ? readdirSync(stockDir).sort() : [];
  const aliases: { stockName: string; target: string }[] = [];
  for (const name of stock) {
    const path = join(stockDir, name);
    let real = "";
    try {
      real = readFileSync("/dev/null", "utf8") === "" ? require("node:fs").realpathSync(path) : "";
    } catch {
      real = "";
    }
    if (real.includes("/@galaxy-blackhole/")) aliases.push({ stockName: "@deepseek-ai/" + name, target: real });
  }
  console.log("ALIAS stock→ta: " + String(aliases.length) + " / " + String(stock.length) + " tên stock trong profile");
  console.log("gói của ta trong profile: " + String(ours.length));
  console.log("");

  // Quét import tĩnh trong lib của các gói CỦA TA để tìm id stock không phân giải được.
  const missing = new Map<string, string>();
  for (const name of ours) {
    const libDir = join(gbhDir, name, "lib");
    for (const file of jsFiles(libDir)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/(?:from|import)\s*["'](@deepseek-ai\/[a-z0-9._-]+)(?:\/[^"']*)?["']/g)) {
        const spec = match[1]!;
        const pkgName = spec;
        if (existsSync(join(PROFILE, pkgName))) continue;
        missing.set(pkgName, name + ": " + file.slice(file.indexOf("/@galaxy-blackhole/") + 1));
      }
    }
  }
  if (missing.size === 0) {
    console.log("IMPORT stock trong lib của ta: TAT CA phan giai duoc (0 ten gay)");
    console.log("");
    return 0;
  }
  console.log("IMPORT stock KHONG phan giai duoc: " + String(missing.size) + " tên");
  for (const [name, where] of [...missing].sort()) console.log("  - " + name + "   (dùng ở " + where + ")");
  console.log("");
  return 1;
}

if (import.meta.main) process.exit(await main());
