<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Row ui-input-trigger — port 1:1 CẢ HAI nửa (host apply rỗng + client pipeline / và @), bảng G4 vùng→tệp, nợ còn lại
-->

# @galaxy-blackhole/gbh-client-ui-input-trigger

Bản viết lại Galaxy Blackhole cho gói gốc **@deepseek-ai/dsh-client-ui-input-trigger** (0.2.1-alpha.4).
Mô tả gốc: *"Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered sources"*.

Wiring (nửa client + đóng gói) do Lead duyệt 19/10/2026 sau sự cố 2 writer (trùng ghi cùng package).

## 1. Trạng thái — ĐỦ HAI NỬA, row vẫn PARKED

| bên | bản gốc | gói này |
|---|---|---|
| nửa HOST (lib/index.js) | 11 dòng — `function apply() {}` + `export { apply }` | **port 1:1** — `src/index.ts` (20 dòng, thân hàm y nguyên) |
| nửa CLIENT (lib/client.js) | 1.950 dòng / 77.121 byte, 12 vùng #region | **port 1:1** — 17 tệp nguồn trong `src/`, artifact 1.853 dòng / 69.401 byte |
| từ điển | `locale/{en,zh}.json` | **chép NGUYÊN VĂN** (cmp: giống từng byte) |
| manifest | `dsh.client` = platform web + 4 inject | **khớp tuyệt đối** (JSON.stringify hai bên bằng nhau) |

Vì sao vẫn **KHÔNG khai `gbh.row`**: port xong chưa đủ để thay row stock. Còn hai phép đo của Lead —
`--dump-config` đối chiếu row id thật (`ui-input-trigger`) và **boot-smoke** chứng minh slot
`conversation.input.overlay` mount thật. Khai row trước boot-smoke = thay một row đang chạy bằng một entry
chưa được chứng minh. Trạng thái nằm ở `gbh.draft`; `gbh.tests` giữ nguyên đường dẫn test.

## 2. Vì sao nửa host rỗng (nguyên văn lý do bản gốc)

Row này là plugin UI thuần: apply rỗng để plugin **xuất hiện** trong cordis.yml / Loader của Host; nửa
browser đi qua `exports["./client"]`, được khám phá qua khai báo `dsh.client` trong package.json.

## 3. G4 — bảng vùng của lib/client.js gốc → tệp của ta

| # | vùng (`//#region`) | dòng gốc | tệp của ta | lý do / ghi chú |
|---|---|---|---|---|
| 1 | `../../util/values/src/partial-json.ts` | 12–635 | `src/partial-json.ts` (638) | vendored NGUYÊN VĂN + `@ts-nocheck` (khuôn ui-schedule); **không module nào tham chiếu** trong artifact gốc, giữ để artifact của ta phủ đúng vùng |
| 2 | `../../util/values/src/index.ts` | 636–708 | `src/values.ts` (92) | `assertNever` + `WeakMapWithValues` — typed lại, hành vi nguyên văn |
| 3 | `../../context/file-reference/src/grammar.ts` | 709–733 | `src/grammar.ts` (46) | `activeAtToken` — regex nguyên văn |
| 4 | `lib/types/core/detect.js` | 734–813 | `src/detect.ts` (84) | lõi thuần `detectTrigger`; hai ngoại lệ URL giữ nguyên |
| 5 | `lib/types/core/menu.js` | 814–967 | `src/menu.ts` (204) | `MENU_CLOSED` · `seedGroups` · bộ giảm thuần (closed/firstHighlight/validHighlight/positions/allReadyEmpty) |
| 6 | `lib/types/client/controller.js` | 968–1524 | `src/controller.ts` (812) | `InputTriggerController` dựng qua `createControllerClass(createSnapshotStore)` để nhận store lúc factory chạy |
| 7 | `lib/types/client/service.js` | 1525–1611 | `src/service.ts` (152) | `InputTriggerService` dựng qua `createServiceClass(Service, ControllerClass)` — kế thừa Service thật của cordis |
| 8 | `clsx@2.1.1` | 1612–1626 | `src/clsx.ts` (53) | viết lại tương đương (chuỗi/số/mảng/đối tượng, bỏ giá trị giả) |
| 9 | `MenuView.module.css` | 1627–1660 | `src/menu-css.ts` (64) | chuỗi CSS + bảng lớp **NGUYÊN VĂN** (`_3e4SsG_*`); id thẻ `<style>` = tên package **CỦA TA** + `/MenuView.module.css` (luật MỘT-ID, 19/10/2026) |
| 10 | `lib/types/client/MenuView.js` | 1661–1858 | `src/menu-view.ts` (293) | cây element giữ nguyên thứ tự/aria; dựng bằng jsx runtime truyền vào |
| 11 | `lib/types/client/locales.js` | 1859–1889 | `src/locales.ts` (48) | 9 khóa zh/en nguyên văn (kể cả dấu … U+2026) |
| 12 | `lib/types/client/index.js` | 1890–1942 | `src/plugin.ts` (106) | `INJECT` + `apply` + mặt plugin `{ InputTriggerController, InputTriggerService, apply, inject }` |

Tệp phụ (không ứng vùng nào): `src/ids.ts` (105 — hằng định danh), `src/ids-stock.ts` (17 — id gói GỐC,
**ngoài mọi nhánh import của bundle client**), `src/types.ts` (612 — hợp đồng kiểu cấu trúc thay cho import
gói ngoài), `src/client.ts` (14 — điểm vào export `createPlugin`), `src/index.ts` (22 — nửa host), `build.ts` (135).

## 4. Khác bản gốc có chủ đích (đọc trước khi A/B)

1. **Một id duy nhất.** Artifact chỉ có MỘT lời gọi `window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-client-ui-input-trigger" })`.
   Không đăng ký id stock — id đó thuộc `gbh.row.aliases` và tầng nạp tự sinh entry alias.
   Luật MỘT-ID (Lead, 19/10/2026) tính **cả tag CSS + dataset.plugin**: id thẻ `<style>` và `dataset.plugin`
   đều dùng id CỦA TA, nên `grep "@deepseek-ai/dsh-client-ui-input-trigger" lib/client.js` = **0**.
2. **Không `require(...)` trong artifact.** Năm specifier (`@deepseek-ai/cordis`, `@galaxy-blackhole/gbh-client-store`,
   `react/jsx-runtime`, `@galaxy-blackhole/gbh-client-ui-primitives`, `react`) được lấy qua `requireFn` **đúng thứ tự gốc**
   lúc factory chạy, nên bundle không phụ thuộc tên gói lúc nạp.
3. **Lớp dựng trong factory.** `InputTriggerController`/`InputTriggerService` là lớp do factory dựng (cần store/cordis
   lúc chạy) — cùng tên, cùng bề mặt, giống cách ui-session/ui-renderer đã làm.
4. **`buildPackage(outDir?)` trả `{ host, client }`** (trước đây trả một chuỗi). Test đã viết lại theo dạng
   hai nửa (12 ca) và đối chứng **trực tiếp với bundle GỐC** — không còn ca nào đòi hình dạng gói chỉ-có-host.
5. **partial-json** là mã chết trong artifact gốc; ta vẫn giữ nguyên văn + import tác dụng phụ để artifact
   phủ đủ 12 vùng (đo được: 7 lần chuỗi `PartialArguments` trong `lib/client.js`).

## 5. Bằng chứng đo trên máy (19/10/2026)

| phép đo | kết quả |
|---|---|
| build 2 nửa | `bun run build.ts` → `lib/index.js` + `lib/client.js` (2 lời gọi `Bun.build`) |
| số lời gọi `__ModuleLoader__` | **1** (đúng id của ta) |
| bề mặt plugin (smoke bằng factory giả) | `InputTriggerController, InputTriggerService, apply, inject` |
| `inject` | `["sessions","locale"]` (nguyên văn) |
| service | tên `inputTriggers`, `static inject = ["sessions"]` |
| slot | `conversation.input.overlay` · id `slash-menu` · order `0` · locale `slash.menu` |
| từ điển | 9 khóa: command, skill, subagent, loading, drill.aria, drill.hint, drill.key, crumbs.aria, suggestions.aria |
| pipeline | `track("/go")` → menu mở (gen 1, 1 nhóm pending) → settle → 2 ứng viên ready, highlight {command,0} → `arbitrate("down")` consumed → `arbitrate("enter")` pick-highlighted, menu đóng |
| typecheck hẹp | `tsc --noEmit --strict …` trên 16 tệp `src/*.ts` → **0 lỗi** |
| locale | `cmp` en/zh với bản gốc → giống từng byte |
| grep id GỐC trong artifact | **0 lần** (luật MỘT-ID tính cả tag CSS + `dataset.plugin`) |
| test (19/10/2026) | `bun test tests/client/ui-input-trigger.test.ts` → **12 pass / 0 fail · 75 expect** |
| A/B controller | cùng kịch bản (track → settle → move/enter → dismiss → space → claim/enter) cho **cùng** ảnh chụp menu/lexicon/breadcrumb + cùng sự kiện `bail` |
| A/B MenuView | cây element của occupant đã đăng ký **BẰNG NHAU** với bản gốc (so JSON sâu; bắt được 1 lệch thật: `key` thừa trên `<button role="option">` — đã bỏ) |
| A/B CSS + từ điển | `MENU_CSS` = chuỗi nhúng của bản gốc (4.052 ký tự); `MENU_STYLES`/`zh`/`en` bằng nhau |

## 6. NỢ / việc còn lại

1. **Lead**: `--dump-config` đối chiếu row id `ui-input-trigger` → khai `gbh.row` (moduleIds = package của ta,
   aliases = `@deepseek-ai/dsh-client-ui-input-trigger`) → `check:rows` → `lab:row` → boot-smoke.
2. ~~Test~~ **XONG 19/10/2026**: `tests/client/ui-input-trigger.test.ts` viết lại 12 ca (giữ 4 ca host, đổi
   các ca "host-only" thành khẳng định trạng thái hai nửa: `exports["./client"]`, artifact MỘT id, 0 id stock,
   `build.ts` ≥ 2 `Bun.build`, `dsh.client` deep-equal) — 12 pass / 0 fail.
3. **A/B hành vi**: chưa chạy lab/boot-smoke (ngoài phạm vi task này) — các chuỗi lỗi/aria/CSS đã port nguyên văn
   nhưng chưa có phép đo giao diện thật.
## 6. Ghi chú đóng gói (19/10/2026)

- **CSS_TAG_ID = PACKAGE_NAME + "/MenuView.module.css"** — thẻ `<style>` dùng id CỦA TA nên thoả luật
  MỘT-ID tuyệt đối; khuôn tham chiếu `ui-chat` + `ui-permission` cũng đặt tag id theo tên gói chủ.
  (Bản stock dùng tên gói gốc — ta KHÔNG giữ tên gốc, không cần ngoại lệ.)
- **Manifest giai đoạn đóng gói**: `gbh.draft` + `gbh.tests`, CHƯA có `gbh.row` (row PARKED — Lead duyệt
  mount mới thêm `gbh.row`/`gbh.row_unmounted_ly_do`).
- **Bẫy Bun 1.3.14**: build CJS/browser in chuỗi chứa `\n` thành template nhiều dòng kèm thụt lề ⇒ mọi chỗ
  so cây/text phải so CHUỖI JSON (`JSON.stringify`) chứ không chỉ deep-equal; test MenuView đã canh.
