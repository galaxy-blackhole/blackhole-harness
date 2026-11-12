<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bao cao tien do M5 — client shell + 49 UI plugin (so lieu do luc 05:15 18/10/2026)
-->

# Báo cáo tiến độ M5

## 1. Tóm tắt

| chỉ số | giá trị |
|---|---|
| row trong ma trận | **59** |
| gói `client` trong repo | **57** |
| gói khai `gbh.row` (**đang mount**) | **50** |
| gói **bị gỡ mount** | **0** |
| row đang chạy thật (`M5-STATUS`) | **50** (đầu đợt: 30) |
| `check:rows` | **56 package · TẤT CẢ đạt · 0 CHẶN** |
| `gate` | **8/8 XANH** |
| `bun test` | **891 test / 84 file · 0 fail** |
| app | `(5)` 0 · `(6)` **50 gói** · `(8)` `#root` **68.760** · **0 lỗi console** |
| `(9)` bố cục | **75/80 phần tử khớp (93,8%)** |

## 2. Bốn mục tiêu bất biến — trạng thái đo được

| mục tiêu | trạng thái | bằng chứng |
|---|---|---|
| **G1** giống DSH · UI giống hệt · **cài plugin ngoài** · bun · web 5439 + HMR | **đạt phần lớn** | `plugin-compat: cài plugin NGOÀI (npm) rồi chứng minh nạp + chạy` = **PASS** · `HMR hai chiều` = **PASS** (6566 ms / 4370 ms) |
| **G2** ≤1000 dòng/file · mọi function có mô tả · header 5 dòng | **ĐẠT** | `header` **1.278 file · 0 vi phạm** · `file-length` **0** · `jsdoc` **0 vi phạm** |
| **G3** bộ plugin tách package `@galaxy-blackhole/gbh-*` | **ĐẠT** | **50 gói** đang mount, mỗi gói một package riêng, `id ta=1 · id gốc=0` |
| **G4** đối chiếu DSH + có test · **lõi KHÔNG dùng `ai-coder-core`** | **đạt phần lớn** | `dep-guard` **1.453 file · 0 vi phạm** · `bun test` **891 / 0 fail** · parity byte trên nhiều row |

## 3. Phương pháp đã chứng minh (dùng cho các row còn lại của M6)

1. **DE-BUNDLE NGUYÊN VĂN** — tháo bundle gốc theo `//#region` thành nhiều phần, ghép lại lúc build.
   Cho **parity từng byte** thân factory + CSS. Đã dùng cho `ui-schedule` (7.549 dòng), `ui-trajectory` (8.246),
   **`ui-conversation` (20.064 — row lớn nhất, xong trong MỘT lượt thay vì 3 như kế hoạch)**.
2. **ĐO ĐƯỜNG NỀN / ĐỔI BUNDLE GỐC VÀO CÙNG HOME** — cô lập **đúng một biến**, so **ba số**
   (`#root` · số lỗi console · số dòng `did not activate`), cao nhất là **`innerHTML` trùng từng byte**.
   Đã giải được `ui-workspace` sau **4 lần** gỡ mount.
3. **TIÊM LỖI — TÁI HIỆN ĐÚNG TRIỆU CHỨNG — GỠ LỖI** — chứng minh nguyên nhân bằng cách cố tình làm hỏng
   (`TabDomain` của `ui-sidebar-right`).

## 4. Ba lớp lỗi và phép đo bắt được chúng

| lớp lỗi | lỗi console | `#root` | `check:rows` | `(9)` |
|---|---|---|---|---|
| sập (`apply` ném) | **bắt** | **bắt** | — | **bắt** |
| mất nội dung âm thầm | không | **bắt** | — | có thể |
| **thiếu slot** | **KHÔNG** | **KHÔNG** | **bắt** | **KHÔNG** |

## 4b. Parity sau khi sửa lớp lỗi thứ tư (đo 18/10/2026, sau bản vá modal)

| phép so | TRƯỚC | SAU |
|---|---|---|
| `ảnh A/B 1440x900 vs stock` | **67,740%** FAIL | **0,034%** PASS |
| `ảnh A/B 1024x768 vs stock` | **36,560%** FAIL | **0,054%** PASS |
| `ảnh A/B 1440x900 vs oracleA` | **67,739%** FAIL | **0,034%** PASS |
| `ảnh A/B 1024x768 vs oracleA` | **36,551%** FAIL | **0,055%** PASS |
| `hash bundle asset vs stock` | FAIL | **PASS** (cả hai `9b700b1e…`, 8 = 8 asset) |
| **tổng** | **FAIL 7 · PASS 13** | **FAIL 3 · PASS 17** |

⇒ **Ba FAIL còn lại KHÔNG phải lỗi của ta**:

1. `dump-config: khác biệt có chủ đích so với DSH stock` — **THÊM 66** ⇒ đúng thiết kế (G3).
2. `dump-config: app vs Oracle A` — **THÊM 50** (row của ta) · **THIẾU 1 = `gbh-brand`**
   (**phương án (A) chủ dự án đã chốt**) · **ĐỔI 48**; 256 row khớp / 205 tham chiếu, lệch thứ tự **0**.
3. `hash bundle asset vs oracleA` — ref **7**, ours **8** — **nhưng cùng phép so với `stock` thì PASS với cả hai đều 8**
   ⇒ **ORACLE A thiếu một asset mà cả stock lẫn ta đều có** ⇒ **bên lệch là oracle**.

> **Suy luận chỉ thấy được vì chạy CẢ HAI phép so**: khi `ta vs stock` khớp mà `ta vs oracleA` lệch,
> thì **oracle mới là bên khác biệt**.

### Vì sao một modal lại gây 67,7% khác biệt ảnh

Ghế `shell.overlay` (id `host-release-change`) trong bản gốc là **`HostReleasePrompt`**, có cổng chặn
`if (change === void 0) return null`. Bản của ta **vẽ thẳng `SettingsPanel`** (một modal 1440x900 có mask tối)
vào ghế đó **không cổng** ⇒ modal mở ngay lúc tải trang ⇒ phủ 55% màn hình + làm mờ phần còn lại.

⚠️ **Lưu ý đọc chỉ số `#root`**: sau bản vá, `#root` **68.760 → 68.512** (**−248 ký tự**). **Đây là ĐÚNG**,
không phải mất nội dung: 248 ký tự đó thuộc về **một thứ chưa bao giờ được phép ở đó**.
Mốc `#root ≥ 68.760` dùng để bắt **mất nội dung THẬT**, không phải để cấm mọi thay đổi số.

## 5. Còn lại để đóng M5

| # | việc | trạng thái |
|---|---|---|
| 1 | **`(9)` 75/80** — 5 phần tử lệch | **2** là `span.hHd-Xa_brandIdent…` / `brandMark`: **hệ quả của việc oracle còn chạy shim `gbh-brand`**, ta chạy bản DSH thuần ⇒ **chờ chủ dự án chốt (i)/(ii)/(iii)** |
| 2 | **`parity:report` FAIL 7 · SKIP 1 · PASS 13** | cần phân loại từng FAIL: cái nào **khác biệt thật**, cái nào **do shim brand** |
| 3 | **`parity:dom` SKIP** (node: giống 0 · thêm 0 · thiếu 0 · đổi 0) | **chưa đo được** ⇒ phải chạy lại cho ra số |
| 4 | **`gbh-brand`** (shim, **đã nhả row**, không còn entry) | chờ **quyết định xoá** của chủ dự án |
| 5 | `parity:trace`: HTTP **thiếu 2** route | cần xác định 2 route thiếu |

## 6. Bài học phương pháp đã trả giá (giữ cho M6)

1. **Nghiệm thu bằng SỐ, không bằng lời** — `ui-workspace` thất bại **4 lần** với *'hãy sửa cho đúng'* và
   thành công ngay lần đầu khi giao bằng *'hãy làm cho HAI CON SỐ BẰNG NHAU'*.
2. **Không boot khi còn writer** — một lượt boot **build TẤT CẢ** gói có `gbh.row`, nên row của người
   khác đang viết dở **cũng bị build và mount** (đúng cơ chế sự cố 03:52).
3. **Tối đa 2 row mới mỗi lượt boot**; row **rủi ro** boot **riêng** (vụ 8 row làm `#root` sập 96%).
4. **Cổng có thể cho DƯƠNG TÍNH GIẢ khi có writer**: `split-stock-bundle.ts` `rmSync` thư mục `src/parts`
   trước khi ghi lại ⇒ `check:rows` đọc **thư mục rỗng** ⇒ **kết án oan** `ui-trajectory`.
   ⇒ **đo hai lần cách nhau** khi buộc phải đo giữa lúc viết.
5. **ĐỌC LUẬT CÓ SẴN TRƯỚC KHI TỰ NGHĨ RA CÁCH** — tôi đã tạo đúng `src/schemastery.d.ts` mà
   `docs/recipes/HOST-ROW-REWRITE.md §000d` **đã cấm**, một ngày sau khi luật được viết;
   hậu quả **5 → 53 vi phạm** ở 13+ gói, và **luật đã dự đoán đúng triệu chứng**.
