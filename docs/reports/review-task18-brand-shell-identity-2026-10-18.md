<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Review độc lập task-18: hero brand (gói ui-brand) + lớp vỏ L3 (shell-identity) — đo artifact + app thật, KHÔNG đọc src để kết luận
-->

# Review độc lập — task-18: `ui-brand` (hero) + `shell-identity` (L3)

- reviewer: **tm-reviewer** (KHÔNG phải tác giả: tm-assets)
- nguồn bằng chứng của tác giả: `docs/reports/asset-task18-evidence.md`
- đo lại độc lập: 18/10/2026 · artifact build tạm + app thật 5439 (HTTP, read-only, KHÔNG boot)

## 1. Verdict

| gói | verdict | điều kiện |
|---|---|---|
| `@galaxy-blackhole/gbh-client-ui-brand` | **KÝ ĐƯỢC ở mức PACKAGE + LAB HERO** | row đang **GỠ có chủ đích** (`gbh.row_unmounted_ly_do`); mount để Lead ký sau trong cửa sổ boot sạch |
| `@galaxy-blackhole/gbh-host-shell-identity` | **KÝ ĐƯỢC (đang BẬT, đo được trên app thật)** | không chạm bootstrap; N1–N4 ĐẠT |

## 2. ui-brand — đo artifact

| phép kiểm | đo được | kết luận |
|---|---|---|
| id module trong `client.js` | id gốc = **0** · id ta = **1** | ĐẠT (MỘT bundle MỘT id) |
| slot đăng ký | **CHỈ** `conversation.hero.brand.mark` (artifact `/tmp/rev/ub/client.js:243`) | ĐẠT — đã loại đúng nguyên nhân regression 22:12 |
| `sidebar.brand.mark/name` | **0** tham chiếu trong artifact | ĐẠT — không còn tranh chấp slot `single` với `ui-brand-official` |
| trạng thái row | `gbh.row_unmounted_ly_do` (không phải `gbh.row`) + `gbh.rollback.cachGo` | đúng quy trình rollback của Lead; dump 329 entry KHÔNG có `ui-brand` |
| test | **6 pass / 0 fail / 24 expect** | ĐẠT |

- Bằng chứng hero của tác giả (§2 doc): lượt A hero = CÁ DSH (`viewBox 0 0 23.16 17.04`, path `M22.9168`) · `fishPathHits` 1; lượt B/C hero = hố đen 34×34 (`0 0 128 128`), `fishPathHits` **0**, 0 console/pageError. Reviewer đối chiếu được **điều kiện tiên quyết** của phép đo này: bundle chỉ còn 1 slot hero ⇒ khi row bật lại thì không thể tái diễn lỗi 22:12.
- **Điều kiện mount (Lead):** boot sạch (app lành sau rollback ui-renderer) → bật `row_unmounted_ly_do` → `row` → đo lại 2 lượt lab + `check:app` (8)(9). Kỳ vọng: 0 pageError · `#root` không giảm · hero hố đen · `fishPathHits` 0.

## 3. shell-identity — đo artifact + APP THẬT

| phép kiểm | đo được | kết luận |
|---|---|---|
| build | exit **0**, `/tmp/rev/si/index.js` | ĐẠT |
| marker bị cấm | `__ModuleLoader__` · `__DSH_BOOT__` · `staticModules` = **0** | ĐẠT (không chạm bootstrap/module-loader) |
| export | 14 tên (apply · inject · name · tapIndexTitle · respondRoute · faviconMatchesSource · SHELL_ROUTES · …) | ĐẠT |
| test | **6 pass / 0 fail / 42 expect** | ĐẠT |
| N1–N4 (toàn repo, `tools/check/no-dsh-assets.ts`) | N1 0 · **N2 0** · N3 0 · N4 0 ⇒ **ĐẠT** | ĐẠT (N2 từng = 1 ở `shell-identity/src/ids.ts` nay đã hết) |
| mount | dump mới: `- id: shell-identity / name @galaxy-blackhole/gbh-host-shell-identity` **đang BẬT** | ĐẠT |

**Đo trên app thật 5439 (HTTP read-only, KHÔNG boot):**

| mục | giá trị |
|---|---|
| `/favicon.svg` | HTTP **200** · 602 B · sha256 **105ca4ce73ac**… = `GBH_FAVICON_SOURCE_SHA256` (không phải favicon DSH) |
| `/favicon-dark.svg` | HTTP **200** · 602 B · sha256 105ca4ce73ac… |
| `/manifest.webmanifest` | `name: Galaxy Blackhole` · `short_name: GBH` · `display: fullscreen` |
| `<title>` trang | `<title>Galaxy Blackhole</title>` |

⇒ Lớp vỏ L3 **có tác dụng thật trên app đang chạy**, không chỉ trong lab.

## 4. Ghi chú ký (quan trọng cho Lead)

Hai gói này **KHÔNG có dòng package DSH gốc tương ứng** trong cây cài ⇒ `tools/check/signoff.ts --batch` sẽ từ chối
(batch validate `dsh` phải tồn tại trong `apps/host/node_modules/@deepseek-ai`). Đề nghị Lead chọn 1:
1. ghi chữ ký thủ công vào `docs/contracts/data/conversion-signoff.json` dưới khoá riêng (ví dụ `extra:ui-brand`,
   `extra:shell-identity`) — cần sửa nhỏ `signoff.ts`; hoặc
2. dùng chính báo cáo này làm chữ ký reviewer (không đưa vào ma trận DSH vì không có dòng tương ứng).

## 5. Kết luận

```
pkg: gbh-client-ui-brand (hero)        reviewer: tm-reviewer
package+artifact : DAT  id goc=0 · id ta=1 · CHI 1 slot conversation.hero.brand.mark (0 sidebar.brand.*)
test             : DAT  6 pass / 24 expect
lab hero (tac gia): DAT  0 console · 0 pageError · hero ho den · fishPathHits 1 -> 0 (2 luot A/B/C)
mount            : CHUA (row_unmounted_ly_do co chu dich) — ky sau trong cua so boot sach
ket luan         : KY o muc package + lab hero

pkg: gbh-host-shell-identity (L3)       reviewer: tm-reviewer
artifact         : DAT  build 0 · 0 marker bootstrap · 14 export
test             : DAT  6 pass / 42 expect
N1-N4 toan repo  : DAT  0/0/0/0
app that (HTTP)  : DAT  favicon 200/602B/sha 105ca4ce… · manifest Galaxy Blackhole/GBH · title Galaxy Blackhole
mount            : DANG BAT (dump moi)
ket luan         : KY
```
