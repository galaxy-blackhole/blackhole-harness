<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bản viết lại Galaxy Blackhole cho row ui-cordis (@deepseek-ai/dsh-client-ui-cordis) — ĐỦ HAI MẶT:
      nửa host apply() rỗng + nửa browser (bốn thẻ tool view + bảng Cordis) chia 19 tệp client ≤1000 dòng
-->

# @galaxy-blackhole/gbh-client-ui-cordis — ĐỦ HAI MẶT (row PARKED)

> Row `ui-cordis` (PARITY-MATRIX, tier **T4**, chủ M6): thẻ định nghĩa plugin động `cordis_define` kèm
> **công tắc chạy/dừng** (`cordis_run` · `cordis_stop` · `cordis_undefine`) và **bảng Cordis** phê duyệt /
> chọn phiên bản ở chân thanh bên.
> Gói gốc là **HAI MẶT**: nửa host **11 dòng `apply() {}`**, nửa browser **1.495 dòng** đi qua
> `exports["./client"]` + `dsh.client` (8 inject, `platform: web`). Bản này port **cả hai**.

Wiring (nửa client + đóng gói) do Lead duyệt 19/10/2026 sau sự cố 2 writer (trùng ghi cùng package).

## 0. Ba luật sắt — xác nhận

| Luật | Trạng thái | Bằng chứng đo |
|---|---|---|
| (1) `dsh.client` KHỚP TUYỆT ĐỐI bản gốc | **ĐẠT** | `JSON.parse(package.json).dsh.client === JSON.parse(stock).dsh.client` ⇒ `true`; 8 inject đúng thứ tự, `platform: "web"` |
| (2) `exports["./client"]` có mặt | **ĐẠT** | `"./client": "./lib/client.js"` (+ `"."`, `"./locale/*.json"`, `"./package.json"`, `"./src/*"`) |
| (3) `build.ts` build THẬT nửa client | **ĐẠT** | **2 lời gọi `Bun.build`**: host (`src/index.ts` → `lib/index.js`, ESM/node) + client (`src/client.ts` → `lib/client.js`, CJS/browser rồi bọc script classic) |
| LUẬT MỘT-ID | **ĐẠT** | artifact có **đúng 1** `__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-client-ui-cordis" })`; không giữ id stock ở vị trí `id` (build tự chặn) |

## 1. Nguồn đối chiếu (G4) — 14 vùng #region → 14 tệp + 5 tệp hạ tầng

| # | Vùng `#region` trong `lib/client.js` gốc | Dòng | Tệp của ta | Vì sao tách / ghi chú |
|---|---|---|---|---|
| 1 | `card-model.js` | 10–114 | `src/card-model.ts` | Mô hình hiển thị thuần (không JSX) — tách được sạch, không cần bộ chạy |
| 2 | `CordisRunRow.module.css` | 115–139 | `src/styles/run-row.ts` | Chuỗi CSS **2.281 ký tự** chép NGUYÊN VĂN + bảng lớp `cvtE3a_*` (12 khoá); tách riêng để không phình tệp component |
| 3 | `CordisPreparingRow.js` | 140–166 | `src/preparing-row.ts` | Dùng chung cho cả ba họ thẻ ⇒ phải đứng trước chúng |
| 4 | `CordisActionRow.js` | 167–225 | `src/action-row.ts` | Thẻ `cordis_stop`/`cordis_undefine` |
| 5 | `status.js` | 226–250 | `src/status.ts` | Suy ra trạng thái Package — dùng bởi Define, Run và bảng |
| 6 | `CordisDefineRow.module.css` | 251–290 | `src/styles/define-row.ts` | Chuỗi CSS **4.492 ký tự** nguyên văn + bảng lớp `gNWCoW_*` (27 khoá) |
| 7 | `CordisDefineRow.js` | 291–450 | `src/define-row.ts` | Thẻ `cordis_define` + hai tab nguồn Host/Client |
| 8 | `run-card-index.js` | 451–500 | `src/run-card-index.ts` | Sổ chỉ mục theo phiên (Store + Registry) — thứ tự tham số `observe(pointer)` giữ nguyên |
| 9 | `CordisRunRow.js` | 501–631 | `src/run-row.ts` | Thẻ `cordis_run` + chỗ đặt `tool.view.cordis` |
| 10 | `CordisPanel.module.css` | 632–673 | `src/styles/panel.ts` | Chuỗi CSS **5.207 ký tự** nguyên văn + bảng lớp `Nqubda_*` (29 khoá) |
| 11 | `CordisPanel.js` | 674–1130 | `src/panel.ts` | Vùng lớn nhất (456 dòng gốc / **797 dòng** ở ta — vẫn ≤1000): bảng inventory, phê duyệt, chọn phiên bản, chuyển/hoàn phiên bản |
| 12 | `inventory.js` | 1131–1223 | `src/inventory.ts` | Đọc đơn tuyến + reset theo thế hệ kết nối |
| 13 | `locales.js` | 1224–1335 | `src/locales.ts` | Hai từ điển **51 khoá** chép nguyên văn (`zh` trước, `en` sau, đúng thứ tự khoá) |
| 14 | `index.js` | 1336–1489 | `src/plugin.ts` | `createPlugin(require)` = thân factory gốc: 2 hiệu ứng + 4 sự kiện Remote + `connection/reset` + 5 đăng ký slot |

Tệp **thêm** (không có trong bundle gốc vì bản gốc dồn tất cả vào một closure):

| Tệp | Vì sao có |
|---|---|
| `src/ids.ts` | Id module CỦA TA, id gói gốc (chỉ đối chiếu), `INJECT` 5 seam, nhãn hiệu ứng |
| `src/events.ts` | Hình dạng dữ liệu thay cho phần `export type` của `@deepseek-ai/dsh-api-remotes/client` (để typecheck hẹp không cần node_modules của kernel) |
| `src/runtime.ts` | Ba bảng module (`react/jsx-runtime`, `react`, `ui-primitives`) + `createRuntime(requireFn)` = bốn lệnh `require` đầu factory gốc |
| `src/styles/inject.ts` | Ba khối chèn `<style>` ở đầu mỗi vùng CSS gốc, gom một chỗ (idempotent theo `data-plugin-css`) |
| `src/client.ts` | Điểm vào của `Bun.build` nửa client ⇒ `export { createPlugin }` (factory trong `lib/client.js` gọi) |

## 2. Hợp đồng một-id của artifact

```js
// lib/client.js (sinh tự động)
window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-client-ui-cordis", factory: factory });
```

* **KHÔNG** đăng ký `@deepseek-ai/dsh-client-ui-cordis` trong bundle: id gốc chỉ khai ở `gbh.row.aliases`
  khi Lead khai row (tầng nạp tự sinh entry alias). Hai id ⇒ cùng bundle chạy hai lần ⇒
  `duplicate factory registration` ⇒ `#root` 0 ký tự.
* `build.ts` tự kiểm artifact trước khi ghi: đúng **1** lời gọi đăng ký, id = id của ta, không lọt
  `import`/`export` cấp cao nhất (thẻ `<script>` classic).

## 3. Bằng chứng đã đo (không chạy lab/boot-smoke — theo phạm vi được giao)

1. **Typecheck hẹp** `tsc --noEmit --strict … --noUncheckedIndexedAccess --noImplicitOverride --verbatimModuleSyntax`
   trên toàn bộ `src/**/*.ts` + `build.ts`: **0 lỗi**.
2. **Build 2 nửa**: `lib/index.js` (5 dòng, `export { apply }`) + `lib/client.js` (**1.666 dòng**).
3. **Parity cây render với bundle GỐC** (nạp cả hai artifact vào cùng một bộ giả lập module, gọi component
   thật, so cây element đã chuẩn hoá): **23/23 ca KHỚP** — 18 ca thẻ (define started/preparing/lỗi/đã-xoá ·
   run đang-chạy/client-pending/chờ-duyệt/hỏng/bị-thay/cập-nhật · stop started/preparing · undefine lỗi ·
   panel đầy/hẹp/rỗng/đang-đọc/lỗi-đọc) + 5 ca **bảng đang MỞ** (chờ duyệt + lỗi + nhiều phiên bản · không lỗi ·
   đang chạy · dòng đầy đủ · dòng khác + bản cũ) — cây 3.200–4.100 ký tự mỗi ca.
4. **Bề mặt đăng ký**: 5 occupant đúng tên/khoá (`sidebar.footer.action/cordis-panel`,
   `tool.call.toolview/cordis_define|cordis_run|cordis_stop|cordis_undefine`), 2 nhãn hiệu ứng
   (`ui-cordis: dictionaries`, `ui-cordis: reconcile pending approvals`), 4 sự kiện Remote + `connection/reset`,
   từ điển `cordis` 51 khoá (`zh`/`en` cùng tập khoá).
5. **locale/{en,zh}.json**: sha256 **khớp byte** gói gốc (`b7acbe6f…` / `57fc94ba…`, giữ `meta.title`).

## 4. Bẫy đã dẫm phải (ghi lại để không tái diễn)

**Bộ in của Bun 1.3.14 biến chuỗi chứa `\n` thành TEMPLATE NHIỀU DÒNG và chèn thụt lề vào literal.**
Đo được: `text.indexOf("\n")` trong nguồn ra artifact thành `text.indexOf(\`<xuống dòng + 4 dấu cách>\`)` ⇒
không khớp gì nữa ⇒ `errorSummary` in **cả khối nhiều dòng** (parity bắt được đúng ca `define/lỗi`).
Cách chữa: `const NEWLINE = String.fromCharCode(10)` (bộ in không thể biến đổi) — **nghĩa y hệt**, đã đo lại
23/23 ca khớp. Mọi chuỗi khác trong bundle đều một dòng nên không bị ảnh hưởng.

## 5. NỢ (bàn giao)

1. **`gbh.row` CHƯA khai** — row `ui-cordis` PARKED. Điều kiện mở khoá: (a) Lead đối chiếu lại row bằng
   `--dump-config`, (b) `bun run check:rows`, (c) `lab:row ui-cordis`, (d) **boot-smoke**: thẻ
   `cordis_define`/`cordis_run` + bảng Cordis phải hiện; rồi mới khai `gbh.row` với
   `moduleIds: ["@galaxy-blackhole/gbh-client-ui-cordis"]`, `aliases: ["@deepseek-ai/dsh-client-ui-cordis"]`.
2. ~~Test cũ chỉ-nửa-host~~ **ĐÃ XONG 19/10/2026**: `tests/client/ui-cordis.test.ts` viết lại theo hợp đồng
   HAI MẶT — **14 ca / 74 expect / 0 fail** (giữ nguyên 10 ca cũ, chỉ đổi khẳng định host-only thành khẳng
   định trạng thái mới; thêm ca A/B nạp artifact client như thẻ `<script>` classic).
3. **Chèn style** chạy trong `createPlugin` (lúc factory được gọi) thay vì lúc đánh giá module — khác **thời
   điểm**, cùng kết quả (bản gốc cũng chỉ chèn khi factory chạy).
4. **`id` của thẻ style** là id CỦA TA (`@galaxy-blackhole/…`) thay vì id gốc — đúng LUẬT MỘT-ID; chuỗi CSS
   và tên lớp **không đổi** nên bề mặt DOM không lệch.
5. **Hai chỗ viết khác nhưng nghĩa y hệt**: (a) `firstLine`/`resultText` dùng `NEWLINE` (mục 4);
   (b) ba wrapper `onApprove`/`onDecline` trong bảng `return undefined;` tường minh để kiểu `runAction` hẹp.
6. Typecheck của gói dùng hình dạng dữ liệu **cục bộ** (`src/events.ts`) thay cho type của
   `@deepseek-ai/dsh-api-remotes/client` — cố ý, để typecheck hẹp không phụ thuộc `node_modules` của kernel.

## 6. Lệnh

```bash
bun run build.ts                     # → lib/index.js + lib/client.js (nhận outDir qua argv[2])
bun test tests/client/ui-cordis.test.ts   # 14 ca / 74 expect — HAI MẶT (host + artifact client)
bun run check:rows                   # chỉ có hiệu lực khi Lead khai gbh.row
```
