<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-settings-session-log cua DSH.
-->
# @galaxy-blackhole/gbh-client-ui-settings-session-log
## 1. Nguồn đối chiếu (G4)
| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-settings-session-log` (tier T3) | `@galaxy-blackhole/gbh-client-ui-settings-session-log` |
| Package | `@deepseek-ai/dsh-client-ui-settings-session-log` | `@galaxy-blackhole/gbh-client-ui-settings-session-log` |
| Kích thước bản build | **187 dòng JS** | (điền sau khi viết) |
| Hai mặt? | **CÓ** (`dsh.client`) | phải làm đủ hai nửa |
| `dsh.client.inject` | `@deepseek-ai/dsh-client-locale` · `@deepseek-ai/dsh-client-ui-settings` · `@deepseek-ai/dsh-client-ui-layout` | phải đăng ký **đúng tên service cũ** |
## 2. Vì sao cần
(điền: row này làm gì trong app, ai gọi nó)
## 3. Peer
(ghi rõ peer nào và vì sao — chỉ được dùng các gói trong bảng §3b của `packages/README.md`)
## 4. Bảng TRƯỚC / SAU
| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| (điền phép đo TRƯỚC khi mount) | | |
Lệnh tái lập: (điền)
## 5. Phần CHƯA làm
(nói thẳng nếu có — đừng giả vờ đủ)

## Trạng thái alias HMR (khai báo thật)

Bundle đăng ký **2 khoá bảng module**: id của ta (id chính, có `rev` trong manifest) và id stock
`@deepseek-ai/dsh-client-ui-settings-session-log` (để mọi bundle phụ thuộc tìm thấy).

⚠️ **Alias CHƯA khai báo theo cơ chế mới** (`gbh.row.aliases` — tm-client đang làm): id stock không phải row nên `rev`
của nó rỗng, vì vậy HMR **chưa dọn được khoá alias** sau mỗi lần build lại. Sẽ khai vào metadata ngay khi tm-client chốt
tên trường. Trước khi có cơ chế đó, không tự viết logic HMR trong row (đúng chốt thiết kế của Lead).

## Bằng chứng SAU khi mount (17/10/2026 — row client ĐẦU TIÊN của dự án)

`bun run check:app` (sau khi cập nhật `ready-url.txt` — xem ghi chú bên dưới):

| Chỉ số | Đo được | Kết quả |
| (1) trang trả về | 48.623 B | ĐẠT |
| (2) có `__DSH_BOOT__` | có | ĐẠT |
| (3) số entry boot | 71 | ĐẠT |
| (4) batches + release | 3 batch · release 0.1.0 | ĐẠT |
| (5) dòng 'did not activate' | 0 | ĐẠT |
| (6) gói CỦA TA đang chạy thật | 4 gói: modules · resources · agent-loop · **session-log** | ĐẠT |

Boot log: 8 dòng `rewrite OK` · 0 dòng `did not activate` / `failed to import` / `duplicate`.
Cây: `--dump-config | grep ui-settings-session-log-ours` = **1**. `parity:dump`: **PASS 0/0/0 · đã thay 7 row** (7 row của cả nhóm M4/M5).

**Phòng thí nghiệm TRƯỚC khi mount** (home cách ly `/tmp/gbh-exp-t15b` + cổng 5458, harness chạy TRỰC TIẾP nên không ghi đè
`ready-url.txt` của app thật): 0 cảnh báo · 74 id package · có id của ta · 0 `did not activate`.
Lab này đã bắt được lỗi stub host thiếu `apply()` TRƯỚC khi chạm app thật (xem mục 5).

⚠️ **Bài học vận hành của tôi**: lần chạy `check:app` ĐẦU TIÊN báo `68 B — KHONG DAT` làm tôi tưởng app chết; nguyên nhân là tôi
**quên ghi lại `ready-url.txt` sau restart** nên công cụ dùng token cũ ⇒ 401 ⇒ 68 B. Công cụ đúng, bước sót là của tôi.

## 5. Phần CHƯA làm / đã sửa trong vòng này

· **Đã sửa**: stub host ban đầu chỉ `export const name` ⇒ Loader báo `failed to import`. Bản gốc export `apply() {}` rỗng;
  gói ta nay làm y vậy. Cùng lỗi này cũng có ở scaffold — Lead đã sửa công cụ sinh khung và thêm cổng `check:rows`.
· **Alias HMR**: bundle đăng ký 2 khoá module (id ta làm id chính + id stock), nhưng **chưa khai `gbh.row.aliases`** —
  chờ cơ chế khai báo của `packages/client/modules` (tm-client đã chốt tên trường `aliases`; phía `apps/cli` đã đọc được).
  Trước khi khai, HMR chưa dọn khoá alias sau mỗi lần build lại.
· **Đo pixel**: tm-ui-features xác nhận row này **không tạo pixel lệch nào** ở màn Settings → General;
  1269 px lệch còn lại thuộc mục nav `Built-in plugins` (row `ui-settings-plugins`, không phải gói này).

## Xác nhận A/B pixel (17/10/2026 — tm-ui-features đo độc lập)

| Màn | Lệch ngoài mask | Kết quả |
|---|---|---|
| Settings → General (màn của row này) | **0 px / 1.119.744** (0,000%) | **PASS** |
| Plugins → tab Installed | **0 px / 1.119.744** (0,000%) | **PASS** |

Ảnh: .parity/features/2026-10-17T08-23-15/.

Vòng đo TRƯỚC đó báo màn Plugins lệch **388 px**, toàn bộ ở một cụm aria-label "Could not save preference"
phía ta: đó là lỗi THẬT của row này — UploadToast dựng bằng primitive khác + truyền hidden nên
**luôn render một phần tử** chữ "Could not save preference". Sau khi sửa (trả null khi notice === null)
cụm 388 px biến mất. Ghi lại đây vì **không cổng nào phía server bắt được lỗi đó** — chỉ A/B pixel thấy.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-settings-session-log` (shasum `en 275d2dde2774...` · `zh cf5d8565f00a...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
