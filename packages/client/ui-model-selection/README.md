<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README goi ui-model-selection: DU HAI NUA (host rong 1:1 + client 1:1), bang G4 vung→tep, LUAT MOT-ID, NO — row PARKED (gbh.draft + gbh.tests)
-->

# `@galaxy-blackhole/gbh-client-ui-model-selection`

Bản viết lại **1:1** của `@deepseek-ai/dsh-client-ui-model-selection` — Model selection over the shared model catalog, Session projection, and session.selectModel — **đã đủ HAI NỬA** (host + client). Row **CHƯA khai `gbh.row`**: Lead sẽ boot-smoke rồi mới cho khai; manifest giữ `gbh.draft` + `gbh.tests`.

> **Wiring (nửa client + đóng gói) do Lead duyệt 19/10/2026 sau sự cố 2 writer.**

## 1. Trạng thái hai nửa

| nửa | artifact | kích thước đo được | nội dung |
|---|---|---|---|
| **host** | `lib/index.js` | **5 dòng / 56 B** | `function apply() {}` — RỖNG có chủ đích, **giữ nguyên 1:1**, KHÔNG đổi hành vi host |
| **client** | `lib/client.js` | **1.946 dòng / 78.965 B** | script classic, đăng ký **MỘT id của ta**; đủ menu hai tầng model/effort + dịch vụ thư mục + lệnh `/model` + vùng partial-json |

Nguồn client gốc: `lib/client.js` **1.908 dòng / 78.428 B**, tách theo **11 `#region`**.

## 2. G4 — bảng vùng của `lib/client.js` gốc → tệp của ta

| # | vùng (`//#region`) | dòng gốc | tệp của ta (dòng) | xử lý / ghi chú |
|---|---|---|---|---|
| 1 | `../../util/values/src/partial-json.ts` | 13–636 | `src/partial-json.ts` (640) | **vendored NGUYÊN VĂN** + `@ts-nocheck` (khuôn ui-input-trigger); mã chết trong bundle gốc — `src/client.ts` import **tác dụng phụ** để artifact phủ đủ vùng (7 lần `PartialArguments`); import `assertNever` từ `values.ts` vì region kế tiếp nằm cùng factory ở bản gốc |
| 2 | `../../util/values/src/index.ts` | 637–709 | `src/values.ts` (90) | `assertNever` + `WeakMapWithValues`; hành vi nguyên văn |
| 3 | `lib/types/client/catalog.js` | 710–801 | `src/catalog.ts` (130) | nguyên văn `ModelCatalogDirectory` |
| 4 | `lib/types/client/directory.js` | 802–984 | `src/directory.ts` (269) | nguyên văn `ModelDirectory` + `modelSelectionProjection` |
| 5 | `lib/types/client/service.js` | 985–1043 | `src/service.ts` (112) | nguyên văn; lớp dựng trong factory vì `Service` đến từ `require` |
| 6 | `clsx@2.1.1` | 1044–1058 | `src/clsx.ts` (64) | nguyên văn hành vi |
| 7 | `ModelSelect.module.css` | 1059–1100 | `src/ModelSelect.module.css` (9) · `src/class-names.ts` (40) | CSS **nguyên văn từng byte** (tiền tố hash `_7KE1Ra_`) + bảng tên lớp |
| 8 | `lib/types/client/provider-order.js` | 1101–1111 | `src/provider-order.ts` (20) | nguyên văn |
| 9 | `lib/types/client/ModelSelect.js` | 1112–1710 | `src/model-select.ts` (860) | nguyên văn logic/cây render |
| 10 | `lib/types/client/locales.js` | 1711–1773 | `src/locales.ts` (73) | nguyên văn từng khoá từng chuỗi |
| 11 | `lib/types/client/index.js` | 1774–1900 | `src/plugin.ts` (283) | nguyên văn + cổng chống cài hai lần ở phạm vi module |

Tệp phụ (không ứng vùng nào): `src/ids.ts` (79) · `src/types.ts` (257) · `src/runtime.ts` (202) · `src/store.ts` (33) · `src/client.ts` (18) · `src/index.ts` (19) · `build.ts` (150).

Tệp lớn nhất: `src/model-select.ts` **860 dòng** (ngưỡng 1.000). Tổng `src/`: **3.198 dòng / 18 tệp**.

## 3. Bộ ba bắt buộc (đo được)

1. **`dsh.client` deep-equal bản gốc** — `platform: "web"`, `inject` **4 phần tử nguyên thứ tự**:
   `@deepseek-ai/dsh-api-session-controller` · `@deepseek-ai/dsh-client-locale` · `@deepseek-ai/dsh-client-ui-commands` · `@deepseek-ai/dsh-api-remotes`.
2. **`exports["./client"] = "./lib/client.js"`** (+ `"./locale/*.json"` như bản gốc).
3. **`build.ts` có 2 lời gọi `Bun.build`** (host: `src/index.ts` → `lib/index.js` ESM; client: `src/client.ts` → bundle CJS → bọc script classic → `lib/client.js`), nhận `outDir` qua `argv[2]`, và **sinh `lib/client.js` thật**.

## 4. LUẬT MỘT-ID

`lib/client.js` chỉ có **một** `window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-client-ui-model-selection", ... })`.
Id stock **không xuất hiện** trong artifact — kể cả chunk, `tagId` của thẻ CSS và `dataset.plugin`:

- `tagId = PACKAGE_NAME + "/ModelSelect.module.css"`
- `tag.dataset.plugin = PACKAGE_NAME`

`grep -c "@deepseek-ai/dsh-client-ui-model-selection" lib/client.js` ⇒ **0**.

## 5. Slot đã chiếm

| slot | ai khai | ghi chú |
|---|---|---|
| `conversation.input.model` | `ui-conversation` khai báo (children table) · **gói này là occupant DUY NHẤT** | đã grep toàn repo: chỉ có khai báo slot + `renderSlot` (consumer) + ví dụ tài liệu (`cordis-client-runner`), **không có occupant nào khác** |

## 6. Kiểm

```bash
bun test tests/client/ui-model-selection.test.ts    # 9 ca
bun run packages/client/ui-model-selection/build.ts # sinh lib/index.js + lib/client.js
```

9 ca: nửa host 1:1 + A/B Context thật · `exports["./client"]` + `dsh.client` deep-equal · artifact MỘT id của ta + grep id stock = 0 ·
`build.ts` ≥2 `Bun.build` · slot duy nhất `conversation.input.model` · từ điển + CSS nguyên văn · **vùng partial-json nguyên văn** ·
**bundle thật chạy trong loader giả** (từ điển + plugin + `/model` + 1 slot + thẻ CSS mang id của ta + `directoryFor("s1").load()` ra `status: "ready"`).

## 7. NỢ kỹ thuật

- **`gbh.row` CHƯA khai** (row PARKED; chỉ `gbh.draft` + `gbh.tests`): chờ Lead `--dump-config` đối chiếu row id thật, `lab:row` + boot-smoke.
- Cổng chống cài hai lần ở phạm vi module là phần **thêm** so với bản gốc (khuôn của 41 gói đã port, bài học 18/10/2026: slot `single` chỉ một chủ) — không đổi hành vi ở nhánh cài **một lần**.
- `partial-json` là **mã chết** trong artifact gốc (không module nào tham chiếu). Ta giữ nguyên văn + import tác dụng phụ để artifact phủ đủ vùng G4; bỏ import này không đổi hành vi, chỉ giảm kích thước artifact.
