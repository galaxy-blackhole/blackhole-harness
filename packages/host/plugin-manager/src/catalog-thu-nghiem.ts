/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Entry catalog cho các bundle GBH thử nghiệm để mục "Plugin thử nghiệm" render đúng, kèm icon
 *      thương hiệu Blackhole dùng làm icon mặc định CÓ CHỦ ĐÍCH (không bịa data-URI).
 */

import type { OfficialBundleCatalogEntry } from "@deepseek-ai/dsh-app-boot";

import { BUNDLE_THU_NGHIEM_GBH, bundleMetaVi, ICON_BUNDLE_GBH } from "@galaxy-blackhole/gbh-host-bundle-labels";

export { BUNDLE_THU_NGHIEM_GBH };

/**
 * Icon thương hiệu Blackhole (bản compact) — chép NGUYÊN VĂN từ asset CÓ THẬT của repo
 * (`packages/client/ui-settings-account/src/assets.ts`, cùng bộ icon dùng cho phần "Giới thiệu").
 * Chỉ dùng khi gói bundle không tự khai icon; KHÔNG bịa data-URI (Lead chốt 08/11/2026, phương án (B)).
 */
export const ICON_THUONG_HIEU =
  "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgNDAgNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJFeGl0RnVsbHNjcmVlbkdseXBoIDEiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNMjIuNSA2LjI1VjE1QzIyLjUgMTUuNjYzIDIyLjc2MzQgMTYuMjk4OSAyMy4yMzIyIDE2Ljc2NzhDMjMuNzAxMSAxNy4yMzY2IDI0LjMzNyAxNy41IDI1IDE3LjVIMzMuNzUiIHN0cm9rZT0iIzgzNzBGMSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGlkPSJWZWN0b3JfMiIgZD0iTTE3LjUgMzMuNzVWMjVDMTcuNSAyNC4zMzcgMTcuMjM2NiAyMy43MDExIDE2Ljc2NzggMjMuMjMyMkMxNi4yOTg5IDIyLjc2MzQgMTUuNjYzIDIyLjUgMTUgMjIuNUg2LjI1IiBzdHJva2U9IiM4MzcwRjEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L2c+Cjwvc3ZnPgo=";

/**
 * Dựng entry catalog cho các bundle GBH THỬ NGHIỆM đang bật, để mục "Plugin thử nghiệm" của client
 * (`ui-plugin-manager/lib/client.js:4108-4109, :4433` — chỉ render bundle nằm trong catalog `official`)
 * hiện đúng chúng thay vì chỉ 2 entry stock của kernel.
 * Nhận: ten — danh sách tên `listBundles` đang xét; thuNghiem — tập bundle GBH thử nghiệm; daCo — vị từ
 *   "tên đã có trong catalog".
 * Trả: mảng entry cần bổ sung (rỗng khi không có bundle nào thoả).
 * @param ten - toàn bộ tên bundle mà `listBundles` đang xét.
 * @param thuNghiem - tập tên bundle GBH thử nghiệm (đã quy tên).
 * Ghi chú 10/11/2026 (Lead duyệt Cách 1): BỎ vị từ "đang bật" — 12 bundle GBH luôn có bản dịch của ta, và việc
 * ẩn entry khi bundle đang TẮT chính là thứ làm client rơi về chuỗi stock tiếng Anh trong package.json.
 * @param daCo - vị từ "tên này đã có entry trong catalog".
 * @returns mảng entry catalog cần thêm.
 */
export function entryCatalogThuNghiem(
  ten: readonly string[],
  thuNghiem: ReadonlySet<string>,
  daCo: (name: string) => boolean,
): OfficialBundleCatalogEntry[] {
  const ketQua: OfficialBundleCatalogEntry[] = [];
  for (const name of ten) {
    if (!thuNghiem.has(name) || daCo(name)) continue;
    const chuTa = bundleMetaVi(name);
    if (chuTa === undefined) continue;
    ketQua.push({
      packageName: name,
      meta: {
        title: { vi: chuTa.title, en: chuTa.title },
        description: { vi: chuTa.description, en: chuTa.description },
        icon: ICON_BUNDLE_GBH[name] ?? ICON_THUONG_HIEU,
      },
    });
  }
  return ketQua;
}

/**
 * 12 bundle GBH THỬ NGHIỆM — danh sách HẰNG, đúng bộ mà mục "Plugin thử nghiệm" của DSH liệt kê cho các bản
 * tương ứng (`MORE_BUNDLES`/`EXTENSION_BUNDLES` trong `packages/client/ui-plugin-manager/lib/client.js`).
 * Dùng HẰNG thay vì suy động: bản động (giao với tên stock bị lọc) RỖNG khi profile không còn khai id stock
 * `@deepseek-ai/dsh-experimental-*` — đo thật r77: `official=2 gbhOfficial=[]` dù profile có đủ 12 bản GBH.
 * Nguồn đối chiếu: `~/.galaxy/blackhole/profiles/blackhole/package.json` → `dsh.profile.bundles`.
 */

/**
 * true khi `ten` là id bundle STOCK thử nghiệm đã có bản GBH tương ứng trong profile ⇒ phải loại hẳn khỏi payload
 * `listBundles` (nếu còn, client render cặp đôi: bản GBH bật/tiếng Việt + bản stock tắt/tiếng Anh, và công tắc trên UI
 * sẽ gửi `target` là id stock — đo thật 10/11/2026: `setBundleEnabled` trả `@deepseek-ai/dsh-experimental-agent-team-profile`).
 * So theo KHOÁ TÍNH NĂNG với danh sách HẰNG `BUNDLE_THU_NGHIEM_GBH` (không suy động từ `names`: khi profile không còn
 * khai id stock thì phép suy động luôn rỗng và filter không cắt được gì).
 * @param ten - tên gói cần kiểm.
 * @returns true khi phải loại khỏi payload.
 */
export function laStockCoBanGbh(ten: string): boolean {
  const tienTo = "@deepseek-ai/dsh-experimental-";
  if (!ten.startsWith(tienTo)) return false;
  const khoa = ten.slice(tienTo.length).replace(/-bundle$/, "").replace(/-profile$/, "");
  return BUNDLE_THU_NGHIEM_GBH.some((g) => {
    const b = g.slice(g.lastIndexOf("/") + 1).replace(/^gbh-/, "").replace(/-bundle$/, "").replace(/-profile$/, "");
    return khoa.length >= 4 && (khoa === b || khoa.includes(b) || b.includes(khoa));
  });
}

