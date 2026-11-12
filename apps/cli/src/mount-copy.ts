/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Chép thư mục con (locale/assets/runtime) của gói trong repo sang bản ĐÃ MOUNT trong profile,
 *      có chặn "đích trùng nguồn" và STAMP dấu vân tay nguồn để không chép lại khi nguồn không đổi
 *      12/11/2026: tách khỏi mount.ts (giữ mount.ts ≤ 1000 dòng) + bỏ rm+cp mỗi lượt boot (~1,5 s/218 gói)
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, readdirSync, readFileSync, rmSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";

/**
 * Đích copy có TRÙNG nguồn không (entry profile là SYMLINK trỏ về chính gói trong repo).
 * Nhận: dich — đường dẫn đích; nguon — đường dẫn nguồn. Trả: true nếu cùng một thư mục thật.
 * @param dich - đường dẫn đích (có thể là symlink).
 * @param nguon - đường dẫn nguồn trong repo.
 * @returns true khi realpath của hai bên trùng nhau (hoặc đích nằm trong nguồn).
 */
export function trungNguon(dich: string, nguon: string): boolean {
  // 08/11/2026 — ca quan trọng: `dich` CHƯA tồn tại (lượt boot trước đã xoá) ⇒ realpath ném. Khi đó phải
  //   phân giải THƯ MỤC CHA rồi ghép tên, nếu không hàm trả false ⇒ `rmSync`+`cpSync(src, dest)` chạy trên
  //   cùng một đường dẫn thật (dest xuyên symlink về src) ⇒ cpSync ném EINVAL và boot chết.
  const giai = (p: string): string | null => {
    try {
      return realpathSync(p);
    } catch {
      try {
        return join(realpathSync(dirname(p)), p.slice(p.lastIndexOf("/") + 1));
      } catch {
        return null;
      }
    }
  };
  const a = giai(dich);
  const b = giai(nguon);
  if (a === null || b === null) return false;
  return a === b || a.startsWith(b + sep) || b.startsWith(a + sep);
}

/**
 * Dấu vân tay STAT của một cây nguồn: sha256 của (đường dẫn tương đối + size + mtime + ctime) từng tệp.
 * Nhận: goc — thư mục nguồn trong repo. Trả: chuỗi sha256 hex (rỗng khi không đọc được thư mục).
 * @param goc - thư mục nguồn cần lấy dấu vân tay (ví dụ `packages/host/<gói>/locale`).
 * @returns chuỗi sha256 hex đại diện trạng thái stat của cây nguồn.
 */
export function vanTayCay(goc: string): string {
  const hash = createHash("sha256");
  const duyet = (thuMuc: string): void => {
    let muc: string[] = [];
    try {
      muc = readdirSync(thuMuc).sort();
    } catch {
      return;
    }
    for (const ten of muc) {
      const duong = join(thuMuc, ten);
      let thongTin;
      try {
        thongTin = lstatSync(duong);
      } catch {
        continue;
      }
      if (thongTin.isSymbolicLink()) continue;
      if (thongTin.isDirectory()) {
        duyet(duong);
        continue;
      }
      hash.update(duong.slice(goc.length));
      hash.update("\u0000");
      hash.update(String(thongTin.size));
      hash.update("\u0000");
      hash.update(String(thongTin.mtimeMs));
      hash.update("\u0000");
      hash.update(String(thongTin.ctimeMs));
      hash.update("\u0000");
    }
  };
  duyet(goc);
  return hash.digest("hex");
}

/**
 * Chép một thư mục con (locale/assets/runtime) từ gói trong repo sang thư mục ĐÃ MOUNT, BỎ QUA khi đích
 * trùng nguồn để không bao giờ xoá nhầm tệp của repo, và bỏ qua khi NGUỒN KHÔNG ĐỔI (stamp stat).
 * Nhận: dich — thư mục gói trong profile; nguon — thư mục gói trong repo; ten — tên thư mục con.
 * Trả: true khi vừa chép lại, false khi bỏ qua.
 *
 * 12/11/2026 — VÌ SAO THÊM STAMP: trước đây mỗi lượt boot `rmSync` + `cpSync` cho MỌI gói có locale/
 * assets/runtime (đo được ~2 s/218 gói). Bản trong profile được chép từ đúng trạng thái nguồn đã ghi
 * trong stamp, nên nguồn không đổi ⇒ bản trong profile vẫn là bản đúng ⇒ bỏ qua là no-op thật.
 * Nguồn đổi (sửa 1 tệp locale, đổi size/mtime/ctime) ⇒ stamp trượt ⇒ chép lại như cũ.
 * @param dich - thư mục đích (entry profile).
 * @param nguon - thư mục nguồn trong repo.
 * @param ten - tên thư mục con cần chép (ví dụ "locale").
 * @returns true khi đã chép lại, false khi không cần chép.
 */
export function chepThuMucCon(dich: string, nguon: string, ten: string): boolean {
  // 12/11/2026 — CHẶN Ở MỨC GÓI: đích LÀ CHÍNH gói trong repo (profile trỏ symlink về repo, ví dụ
  //   gbh-client-connection -> apps/host/node_modules -> packages/client/connection) ⇒ KHÔNG chép và
  //   KHÔNG ghi stamp: mọi thao tác ghi đều rơi vào cây nguồn. Đo được 1 stamp lọt vào repo trước bản vá.
  if (trungNguon(dich, nguon)) return false;
  const src = join(nguon, ten);
  if (!existsSync(src)) return false;
  const dest = join(dich, ten);
  // ⚠️ 08/11/2026 — LỖI THẬT làm MẤT TỆP CỦA REPO: khi entry profile là SYMLINK trỏ ngược về gói trong repo
  //   thì `rmSync(dest)` xoá CHÍNH `packages/<tầng>/<gói>/<ten>` trên đĩa, rồi `cpSync(src, dest)` thất bại vì
  //   nguồn vừa bị xoá ⇒ mất vĩnh viễn. Đo được 32 tệp locale của 16 gói bị xoá qua vài lượt boot trong 10 phút.
  //   Chặn bằng so realpath: đích trùng nguồn thì KHÔNG cần chép (đã là cùng một thư mục).
  if (trungNguon(dest, src)) {
    if (process.env.BH_TRACE === "1") console.log("[trace] bo qua chep " + ten + " (dich la symlink ve nguon): " + dest);
    return false;
  }
  const stampPath = join(dich, ".gbh-copy-" + ten + ".stamp");
  const vanTay = vanTayCay(src);
  if (existsSync(dest)) {
    try {
      if (readFileSync(stampPath, "utf8").trim() === vanTay) return false;
    } catch {
      // chưa có stamp ⇒ chép lại như trước
    }
  }
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  try {
    writeFileSync(stampPath, vanTay + "\n");
  } catch {
    // Không ghi được stamp chỉ làm lượt sau chép lại, không làm sai bản cài.
  }
  return true;
}

/**
 * Gói của ta có phục vụ được subpath RUNTIME không — tức `lib/types/` chỉ có `.d.ts`.
 * Nhận: thuMucGoi — thư mục gói trong repo. Trả: true khi chỉ có khai kiểu, không có mã chạy.
 * @param thuMucGoi - đường dẫn tuyệt đối tới thư mục gói.
 * @returns true nếu `lib/types` tồn tại và chỉ chứa tệp `.d.ts`.
 */
export function chiCoKhaiKieu(thuMucGoi: string): boolean {
  const t = join(thuMucGoi, "lib", "types");
  if (!existsSync(t)) return false;
  const ds = readdirSync(t);
  return ds.length > 0 && ds.every((f) => f.endsWith(".d.ts"));
}
