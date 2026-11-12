<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 20/10/2026
 desc Báo cáo tổng kết chuyển đổi DSH → GBH: bằng chứng đo được + phần tàn dư CÓ CĂN CỨ
-->

# Chuyển đổi DSH → GBH/Galaxy Blackhole — báo cáo tổng kết

## 1. Ba điều kiện định lượng (đo tại 20/10/2026)

| Điều kiện | Bằng chứng | Trạng thái |
|---|---|---|
| Mọi package có bản GBH 1:1 (đối chiếu source DSH) | `bun run tools/check/conversion-matrix.ts` → `tong 292 · ✓ 292 · - 0 · X 0` | ✅ |
| Unit test + e2e/lab evidence | `bun run gate` → **8/8 XANH**, cổng `test` = **5.291 pass / 0 fail** | ✅ |
| Đủ 3 chữ ký/package | `docs/contracts/data/conversion-signoff.json` (292 mục, mỗi mục 3 chữ ký) | ✅ |
| `entry gốc còn đang chạy` = 0 | matrix §3 `= 0`; `--list` không còn dòng ACTIVE; `check:app` 11/11 | ✅ |
| Không còn tham chiếu DSH trong UI | `dsh-residue`: **178 DSH · 1.163 `dsh-`** (đầu phiên 230 · 1.770) | ⚠️ một phần |

## 2. Sức khoẻ app (mỗi lần tuyên bố đều phải qua)

```
bun run check:app →
  (3) entry boot 79 · (5) did-not-activate 0 · (8) #root 47.584 ký tự · 46 slot · 0 lỗi console
  (9) bố cục 0/80 khác · (10) 381 file khớp repo · (11) HMR sống
  ⇒ KẾT LUẬN: app LANH
```

## 3. Phần ĐÃ chuyển sạch (không còn DSH)

| Lớp | Bằng chứng |
|---|---|
| Thương hiệu/CSS/token | `--dsh-*` trong repo = **0**; `--gbh-*` phủ 472+ chỗ; dist của ta đang phục vụ (`--gbh-boot-bg=1`) |
| Global brand | `__DSH_BOOT__`, `__DSH_BOOT_READY__`, `__DSH_TRANSPORT__`, `__DSH_CODE_ICON_INSTANCE__`, `__DSH_REMOTE_ACCESS__`, `__DSH_INSPECTOR__` đã đổi sang `__GBH_*`; alias stock đã bỏ |
| tagId + `dataset.plugin` | đổi theo neo ranh giới 2 đầu, có cổng đảo ngược byte |
| Vỏ SPA (dist) | rename 122 chỗ (CSS token + JS global), cổng đảo ngược byte-identical, phục vụ qua `scripts/sync-frontend-dist.sh` |

## 4. Phần CÒN LẠI — bản chất và vì sao

Phân rã payload boot (đo trên HTML phục vụ):

| Nhóm | Số | Bản chất | Kết luận |
|---|---|---|---|
| id gói stock trong `entries[].inject/external` + alias row | ~108 chỗ (25 id khác nhau) | **hợp đồng của module table**: module được đăng ký/分 giải theo id stock (alias row) | ❌ buộc giữ |
| chuỗi scheme/route `dsh-resource://` | ít | **hợp đồng dữ liệu** (URL đã lưu trong session) | ❌ buộc giữ |
| id thư viện nền tảng (`dsh-client-store`, `dsh-client-ui-primitives`, `dsh-typert-registry`, …) | phần lớn 1.163 | thư viện không có module client riêng | ❌ buộc giữ (đổi = trắng UI, đã xảy ra 2 lần) |

**Đã thử và hoàn tác (có số đo)**: đổi 339 id trong `dsh.client.inject/external` của 74 gói ⇒ app đỏ
(`(8) 5.933 ký tự · 0 slot · 7 lỗi console`); hoàn tác ⇒ app 11/11. Chi tiết ở `docs/HANDOVER.md` §13.

## 5. Muốn tiến tới literal 0 — kế hoạch đề xuất (chưa thực thi)

Phải đổi **đồng thời** 3 thứ trong MỘT lần, có cờ rollback và đo `(3)/(5)/(8)` sau mỗi bước:
1. **Module table** (`packages/client/modules`): đăng ký module theo id GBH làm **khoá chính**, giữ id stock
   như alias tạm.
2. **`dsh.client.inject/external`** của 74 gói: trỏ id GBH.
3. **Alias row**: bỏ khi (1)+(2) đã phủ.

Rủi ro: trắng UI nếu thứ tự sai; nên làm sau khi có test e2e mount cho module table (hiện `(5)/(8)` là lưới an toàn).
