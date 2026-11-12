> ⚠️ **Ghi chú 18/10/2026 (Lead):** các đường dẫn trong ADR này là **bản ghi LỊCH SỬ** tại thời điểm quyết định
> — nhiều đường dẫn trỏ tới layout **trước khi đổi tên** (`galaxy-code/…`) nên **KHÔNG còn tồn tại**.
> Đây **không phải dẫn chiếu chết cần sửa**: ADR là **ảnh chụp quyết định**, không phải tài liệu hướng dẫn hiện hành.
> Tài liệu hiện hành: `docs/ARCHITECTURE.md` · `docs/recipes/*` · `docs/M6-REMAINING.md`.

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc ADR 0003: brand Galaxy va lop patch ngu nghia oracle cho M1a (tam thoi, M5 se thay)
-->

# ADR 0003 — Brand Galaxy & lớp patch ngữ nghĩa oracle (M1a)

- **Trạng thái:** đã chốt 17/10/2026 (Lead duyệt), **tạm cho M1**
- **Bối cảnh:** task-1 (M0) đã boot được harness pin `0.2.1-alpha.4` ở 5439 với credentials chung và
  cách ly home. Nhưng `parity:dump` cho thấy app **THIẾU 1 · ĐỔI 12** row so với Oracle A (tiến trình
  4001): oracle không chỉ khác *runtime* mà còn khác *ngữ nghĩa patch* (route `auto`, brand, telemetry,
  feedback). Task-4 (M1a) đóng khoảng cách đó: app phải compose y hệt 4001.

## Quyết định

### 1. Ngữ nghĩa sản phẩm nằm ở MỘT lớp sinh tự động, cuối cùng

- Nguồn: `profiles/blackhole/parity.patch.yml` — chép nguyên ngữ nghĩa từ 4 patch của oracle
  (`galaxy-code/web/patches/gbh-web.patch.yml` 10 row, `gbh-brand.patch.yml` khối brand,
  `gbh-ui.patch.yml` rỗng nên không có gì để chép, `/tmp/gbh-alpha/gbh-overlay.patch.yml` row credentials).
- `bh host` ghép: header → các row ngữ nghĩa (tuỳ chọn kèm khối brand) → row `credentials` ghim
  `~/.galaxy/credentials.yaml`, rồi ghi **một** file:
  - `<DSH_HOME>/app.patch.yml` — bản runtime, truyền bằng `--patch` (lớp **cuối cùng**, nên nó quyết định);
  - `<repo>/profiles/blackhole/app.patch.yml` — bản sao để `parity:dump` và người đọc thấy đúng lớp đó
    (hai bản luôn sinh cùng lúc nên không lệch nhau).
- **Vì sao không để trong patch của profile:** hai lớp cùng quyết định một row là lỗi im lặng (lớp sau
  thắng mà không ai thấy); app đóng gói có thể nằm trong thư mục chỉ đọc; và đường dẫn credentials phụ
  thuộc `$HOME` nên phải sinh lúc chạy. Xem thêm ADR 0002.

### 2. Tuỳ chỉnh của người dùng nằm ở patch của profile

- `profiles/blackhole/cordis.patch.yml` được seed **một lần** vào profile trong home của app, mặc định
  **rỗng** (`[]`) — đúng như oracle hiện tại, nơi không có row `locale`. Muốn đổi ngôn ngữ/theme thì
  thêm row ở đây.

### 3. Brand cho M1: symlink vào bản của galaxy-code (ĐỌC thôi)

- Oracle tắt `ui-brand-official` và insert row `gbh-brand` = `@galaxy-stack/gbh-brand` (private), resolve
  được vì `gbh web` symlink nó vào `<DSH_HOME>/profiles/node_modules`.
- Ta làm y hệt: `bh host` (qua `ensureBrandLink`) tạo
  `~/.galaxy/blackhole/profiles/node_modules/@galaxy-stack/gbh-brand` → `galaxy-code/web/brand`
  (nguồn chỉ **đọc**; không bao giờ ghi vào `~/.galaxy/gbh`). Thứ tự tìm: `GBH_BRAND_PATH` → checkout
  `galaxy-code` cạnh repo → đích symlink sẵn có trong `~/.galaxy/gbh` hoặc `GBH_ORACLE_HOME`.
- Nếu không tìm thấy package brand, `bh host` **bỏ khối brand** khỏi patch (giữ brand stock) và in cảnh
  báo — app vẫn boot được trên máy không có galaxy-code.
- **Đây là tạm cho M1.** M5 sẽ thay bằng `@galaxy-blackhole/gbh-brand` do ta viết (mục tiêu G3 —
  bộ plugin ban đầu tách thành package riêng), lúc đó bỏ hẳn phụ thuộc vào checkout galaxy-code.

## Hệ quả & giới hạn đã biết

- `ui-settings-general.config.welcomeNoticeVersion` được **ghim ở lớp app** (giá trị oracle đang có). Lý do:
  oracle giữ nó ở lớp profile, nhưng lớp profile là **trạng thái sống** — UI của chính oracle đã từng ghi
  đè file đó trong lúc làm M1a (row `locale` biến mất, row `ui-settings-general` xuất hiện). Ghim ở lớp app
  giúp cây plugin của ta ổn định, không phụ thuộc việc UI đã chạy hay chưa.
- Vì oracle là tiến trình đang chạy với file patch có thể bị UI của nó sửa, diff `ours vs oracleA` là
  **so với trạng thái sống**: nếu người dùng đổi setting trên 4001, parity có thể lệch lại (đúng thiết kế
  của `parity:dump`, không phải bug).
- Không có secret nào trong patch: chỉ đường dẫn file và **tên** biến env (`GBH_GALAXY_API_KEY` là
  `apiKeyEnv`, giá trị nằm trong credential store). Test `tests/host/profile.test.ts` ghi một
  credentials.yaml giả rồi khẳng định giá trị của nó không xuất hiện trong patch.

## Bằng chứng (17/10/2026)

| Việc | Kết quả |
|---|---|
| `bun run parity:dump` → `diff-oracleA-vs-ours.md` | **PASS — THÊM 0 · THIẾU 0 · ĐỔI 0** (205 row, 205 giống hệt) |
| cùng bộ patch, chạy bin của ta (`oracleA_rc2`) | PASS — 0/0/0 (tách được hệ quả VERSION) |
| `ours vs stock` | FAIL có chủ đích: THÊM 17 (12 bundle experimental) · ĐỔI 13 (ngữ nghĩa sản phẩm) |
| `bun test tests/host` | 21+ test pass, gồm `gate:home-isolation` 0 unexplained |
| Boot 5439 | 200 · 48.882 B · boot payload có `gbh-brand/client.js` · 0 dòng `failed to import`/`did not activate` |

## Việc tiếp theo (không thuộc M1a)

1. M2: đóng băng hợp đồng C1–C7 và thay `parity.patch.yml` bằng cấu hình có kiểm chứng.
2. M5: viết `@galaxy-blackhole/gbh-brand`, xoá symlink tạm và bỏ phụ thuộc galaxy-code.

