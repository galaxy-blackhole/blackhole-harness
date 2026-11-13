/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Tu link moi goi GBH vao node_modules CUA GOI — ban npm khong mang node_modules trong tarball, nen
 *      import cheo @galaxy-blackhole/* tu cac tep lib/ se ERR_MODULE_NOT_FOUND neu thieu buoc nay.
 *      12/11/2026: tach tu mount.ts (mount.ts vuot 1000 dong khi them buoc nay).
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { repoRoot } from "./paths.ts";
/**
 * Bao dam moi goi GBH trong packages/ phan giai duoc THEO TEN tu chinh cay goi (ban npm).
 *
 * Vi sao can (12/11/2026, do that): trong repo, bun tao `packages/<tang>/<goi>/node_modules/@galaxy-blackhole/*`
 * nen mot tep lib/ import `@galaxy-blackhole/gbh-llm` van chay. Ban npm KHONG the mang node_modules trong
 * tarball (npm bo node_modules) => goi khong co node_modules rieng, va Node do nguoc tu thu muc THAT cua tep
 * dang import (symlink duoc giai) nen khong bao gio thay node_modules cua profile:
 *   llm-deepseek-account: failed to import ERR_MODULE_NOT_FOUND @galaxy-blackhole/gbh-llm
 * => tao symlink `<goi>/node_modules/@galaxy-blackhole/<ten>` -> thu muc goi (dung kieu bun lam). Idempotent,
 * chi them khi thieu; trong repo bun da co link nen ham nay la no-op.
 * @returns so symlink vua tao.
 */
export function linkSelfPackages(): number {
  const modules = join(repoRoot(), "node_modules");
  let added = 0;
  /** Những gói không tạo được liên kết, kèm lý do — in ra thay vì nuốt lỗi. */
  const failed: string[] = [];
  for (const tang of ["host", "client", "tools"]) {
    const root = join(repoRoot(), "packages", tang);
    let names: string[];
    try {
      names = readdirSync(root);
    } catch {
      continue;
    }
    for (const name of names) {
      const dir = join(root, name);
      let specifier: unknown;
      try {
        specifier = (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: unknown }).name;
      } catch {
        continue;
      }
      if (typeof specifier !== "string" || !specifier.startsWith("@galaxy-blackhole/")) continue;
      const link = join(modules, specifier);
      const daCo = existsSync(link) || lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink() === true;
      if (daCo === true) continue;
      try {
        mkdirSync(dirname(link), { recursive: true });
        // 13/11/2026 (Lead): Windows KHÔNG cho tạo symlink thư mục nếu không bật Developer Mode / không elevated
        //   (EPERM), mà `catch { continue }` cũ nuốt lỗi ⇒ bản cài npm thiếu link ⇒ import chéo
        //   @galaxy-blackhole/* nổ ERR_MODULE_NOT_FOUND, harness chết không in URL. Junction thì không cần quyền.
        symlinkSync(dir, link, process.platform === "win32" ? "junction" : "dir");
        added += 1;
      } catch (error) {
        failed.push(specifier + " → " + dir + " (" + (error instanceof Error ? error.message : String(error)) + ")");
      }
    }
  }
  if (added > 0) console.log("[bh] tu link " + String(added) + " goi GBH vao node_modules cua goi (ban npm)");
  if (failed.length > 0) {
    // Không im lặng: thiếu link ⇒ import chéo chết, mà triệu chứng lại xuất hiện ở chỗ khác (harness không in URL).
    console.error(
      "[bh] KHÔNG tao duoc " +
        String(failed.length) +
        " lien ket goi GBH" +
        (process.platform === "win32" ? " (Windows: bat Developer Mode hoac chay bang quyen Administrator)" : "") +
        "; 3 cai dau: " +
        failed.slice(0, 3).join(" · "),
    );
  }
  return added;
}
