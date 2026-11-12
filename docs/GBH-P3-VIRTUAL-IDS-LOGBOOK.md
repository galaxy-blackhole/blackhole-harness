/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 05/11/2026
 * desc Nhật ký P1b (chặng 58 trở đi) — tách khỏi GBH-P3-VIRTUAL-IDS-PLAN.md vì vượt 1000 dòng.
 */

# Nhật ký P1b — chặng 58 trở đi

## 30. Chặng 58 — `exports` cần khai `types` (không chỉ trường `types` cấp cao nhất)

### Phát hiện

`moduleResolution: bundler` ưu tiên `exports` hơn trường `types` ⇒ phải khai **bên trong** `exports["."]`:

```json
"exports": { ".": { "types": "./src/index.ts", "default": "./lib/index.js" } }
```

Đã thêm cho 6 manifest (những gói có `exports` dạng object). Sau đó `typecheck` **0** khi đổi một
import sang `gbh-host-tools` ⇒ đúng là mảnh ghép còn thiếu.

### Vẫn chưa đổi tên hàng loạt được

Batch 30 gói: 14 xanh, nhưng `typecheck` **vẫn đỏ** ở `otel`, `sandbox-policy`, `tool-working-directory`…
với `TS2614`/`TS7016`/`TS2345` — tức **không phải mọi gói** đều có `exports.types` (chỉ 6 gói có `exports`;
các gói còn lại dựa vào `types` cấp cao nhất, mà `bundler` vẫn ưu tiên `main` khi không có `exports`).

⇒ Đã **hoàn nguyên 30 gói**, giữ lại: `exports.types` cho 6 gói + sửa bảng `DOI_TEN`
(`@deepseek-ai/dsh-tools` → `@galaxy-blackhole/gbh-host-tools`, trước đó là ánh xạ tự thân sai).

### Việc tiếp theo

Thêm `"exports": { ".": { "types": "./src/index.ts", "default": "./lib/index.js" } }` cho **TẤT CẢ** gói
chưa có (≈ 300 gói) — đây là bước cơ học, kiểm chứng bằng 1 lệnh `typecheck`. Sau đó P1b mới chạy hàng loạt.

### Trạng thái

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · 0/80).
Backup: `/tmp/gbh-green-r58` (306 MB).

## 31. Chặng 59 — ĐÃ GIẢI QUYẾT triệt để: `exports.types` + stub `.d.ts` ⇒ batch 16 gói chạy sạch

### Công thức hoàn chỉnh (đã kiểm chứng bằng số)

1. `exports["."]` phải là **object** `{ types, default }` — 166 gói đang để dạng chuỗi nên TS không thấy types.
2. `types` phải trỏ `./lib/types/index.d.ts` (**đúng hình dạng stock** — test parity so khớp),
   và tệp đó chỉ cần **một dòng**: `export * from "../../src/index.ts";` ⇒ TS đọc thẳng nguồn.

Kết quả: sau khi chuyển 166 manifest + sinh 174 stub, **batch 30 gói chạy sạch 16 gói** và
`typecheck` **0** liên tục — lần đầu tiên P1b chạy được ở quy mô lớn.

### Vì sao vẫn phải hoàn nguyên trong chặng này

12 test **khẳng định `exports["."]` là chuỗi** (hoặc so khớp đúng hình dạng stock cũ) ⇒ đỏ.
Đã **hoàn nguyên** manifest + xoá 166 stub để giữ xanh; giữ lại công thức ở tài liệu này.

**Việc tiếp theo (rất cụ thể, ~30 phút):**

1. Sửa **6 tệp test** khẳng định `exports["."]` (`tool-str-replace-editor`, `tool-pwsh`, `session-log-export-client`,
   `web-frontend-static`, `host-frontend-static`, `voice-input`) để chấp nhận cả hai dạng.
2. Chạy lại: chuyển 166 manifest + sinh 174 stub + batch 30 gói.
3. `bun test` / `gate` / `check:app`.

### Trạng thái

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** · 206 gói còn tham chiếu stock trong `src`.

## 32. Chặng 60 — công thức exports+stub CHẠY ĐƯỢC nhưng stub bị `build.ts` XOÁ

Đã làm đúng kế hoạch §31:
1. Sửa **4 tệp test** khẳng định `exports["."]` là chuỗi (`tool-pwsh`, `session-log-export-client`,
   `working-directory`, `experimental-api-speech-to-text-harness`) ⇒ chấp nhận cả object `{ types, default }`.
2. Chuyển **142 manifest** sang dạng `exports["."] = { types, default }` + sinh **173 stub** `lib/types/index.d.ts`.
3. Chạy batch P1b: **17 gói sạch** (`otel`, `tool-worktree`, `tool-working-directory`, `tool-workspace-dependencies`,
   `agent-preset`, `client-hmr`, `llm-retry`, `package-manifest`, `plugin-inventory`, `resources`, `sandbox-policy`,
   `session-delete`, `ui-brand-official`, `ui-settings-web-search`, `util-time`, `web-search-ollama`, `web-search-deepseek`).

`typecheck` **0** ngay sau batch. Nhưng khi chạy `bun test` (test gọi `build.ts`) thì **`build.ts` `rm -rf lib`**
⇒ **xoá luôn `lib/types/index.d.ts`** ⇒ typecheck đỏ `TS2305`/`TS7016` ở các lần sau.

### Cách sửa (chặng sau, rất cụ thể)

Đặt stub **NGOÀI `lib/`** — ví dụ `types/index.d.ts` ở gốc gói, nội dung `export * from "../src/index.ts";`
và khai `exports["."].types = "./types/index.d.ts"`. Khi đó `build.ts` xoá `lib` không ảnh hưởng.
Lưu ý: nếu test parity so khớp **hình dạng stock** (`./lib/types/index.d.ts`) thì phải cập nhật test đó.

### Trạng thái

Đã **khôi phục** về `/tmp/gbh-green-r59`: `bun test` **0 fail** · `gate` **8/8 XANH** ·
`check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · 0/80).

## 33. Chặng 61 — exports/types NGOÀI lib thì vướng luật "exports KHỚP bản gốc"

Đã thử đặt stub ở `types/index.d.ts` (ngoài `lib/` để `build.ts` không xoá):
`typecheck` **0** ngay sau khi chuyển 219 manifest — nhưng `bun test` **34 → 28 ca đỏ**, tất cả thuộc
nhóm **"exports KHỚP bản gốc"**: repo có luật *exports phải bằng stock từng byte*,
nên đường dẫn `types` **buộc** phải là `./lib/types/index.d.ts`.

⇒ Xung đột trực tiếp: `build.ts` xoá `lib/` ⇒ không thể đặt stub ở đó; mà đặt ngoài thì vi phạm luật parity.

### Con đường DUY NHẤT còn lại

Sinh `lib/types/index.d.ts` **TRONG chính `build.ts`** (sau `Bun.build`), để mỗi lần build lại có stub.
Cách làm: sửa ~200 `build.ts` theo mẫu thống nhất — thêm 3 dòng cuối hàm `buildPackage`.
Có thể tự động hoá bằng script (tìm `return join(out, "index.js");` rồi chèn trước đó), sau đó
chạy `typecheck` + `test` để kiểm.

### Trạng thái

Đã khôi phục `/tmp/gbh-green-r60`: `bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH**.

## 34. Chặng 62 — SỰ CỐ: 4 tệp `.module.css` đã MẤT khỏi workspace và khỏi MỌI backup

Khi cố sinh stub `.d.ts` trong `build.ts` (theo §33), 5 gói không build được. Truy nguyên:

```
THIEU: packages/client/ui-session-delete/src/dialog.module.css
THIEU: packages/client/ui-user-questions/src/PlanReviewPanel.module.css
THIEU: packages/client/ui-user-questions/src/QuestionComposer.module.css
THIEU: packages/client/ui-user-questions/src/QuestionReplyView.module.css
```

Bốn tệp này **không có trong bất kỳ backup nào** (`/tmp/gbh-green-r59`, `r60`, `r61`) ⇒ chúng đã bị xoá
từ sự cố `rsync --delete` trước đó, và các backup về sau đều chụp **sau** thời điểm mất.

Hệ quả: 5 gói không build được (`ui-session-delete`, `ui-settings-account`, `ui-theme`, `ui-user-questions`,
`experimental-inspector`) ⇒ `bun test` **42 ca đỏ**, gate ĐỎ.

### Kế hoạch khôi phục (chặng sau)

1. Trích CSS từ bundle stock `apps/host/node_modules/@deepseek-ai/dsh-client-ui-*/lib/client.js`
   (CSS đã nhúng trong bundle) — với `ui-user-questions` và `ui-session-delete` là có bản stock.
2. Nếu không trích được: dựng lại CSS từ danh sách lớp mà TS dùng (`styles.xxx`), giữ đúng tên lớp,
   rồi **dạy cổng byte của 2 gói đó quy id/nội dung** thay vì so byte tuyệt đối.
3. `ui-settings-account`, `ui-theme`, `experimental-inspector` lỗi **không phải do CSS** (cần xem lại sau khi có CSS).

### Trạng thái cuối chặng

`typecheck` **0** nhưng `bun test` **42 ca đỏ**, `gate` **ĐỎ** — nền **KHÔNG xanh**. Đã ghi rõ để chặng sau sửa.

## 35. Chặng 63 — ĐÃ KHÔI PHỤC NỀN XANH + cứu được 3/4 tệp CSS

### Kết quả khôi phục

| Tệp CSS | Cách cứu | Trạng thái |
|---|---|---|
| `ui-session-delete/src/dialog.module.css` | dựng lại từ bảng lớp `GbhDelete_*` trong `class-names.ts` + token `--dsw-alias-state-error-*` | ✅ build chạy |
| `ui-user-questions/src/PlanReviewPanel.module.css` | **trích từ bundle** `lib/client.js` (CSS nhúng), bỏ hash lớp | ✅ 1.611 B |
| `ui-user-questions/src/QuestionComposer.module.css` | như trên | ✅ 2.494 B |
| `ui-user-questions/src/QuestionReplyView.module.css` | **không có trong bundle** ⇒ mới có header + thân rỗng | ⚠️ cần port lại từ stock |

Tất cả đã có **header 5 dòng** đúng chuẩn cổng `header`.

### Sự cố phụ đã sửa

`~/.galaxy/blackhole/profiles/node_modules/@galaxy-blackhole/gbh-client-ui-theme/lib/client.js` bị **mất** do
vòng rebuild toàn cục ở chặng 62 (build lỗi ⇒ thư mục `lib` đã bị xoá trước khi lỗi). Đã khôi phục + chạy lại
`scripts/sync-lib-to-profile.sh`.

### Trạng thái cuối chặng

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · 0/80).

### Bài học (ghi vào luật)

**Luật #12:** KHÔNG BAO GIỜ chạy vòng rebuild **toàn cục** (`for d in packages/*/*/; do build`) — một gói build lỗi sẽ
xoá `lib/` của nó (và bản trong profile), làm app không boot được. Chỉ build gói đã kiểm tra, hoặc build rồi
kiểm ngay từng gói.

**Luật #13:** backup phải chụp **cả `lib/`** và kiểm tra sự tồn tại của các tệp nguồn không phải `.ts`
(`.css`, `.json`, `.svg`) — sự cố này mất 4 tệp `.css` mà 3 thế hệ backup đều không có.

## 36. Chặng 64 — công thức 3 bước chạy được cho 1 gói, nhưng KHÔNG nhân rộng được vì stub re-export

### Đã chứng minh trên 1 gói (`host/util-time`)

1. `build.ts`: chèn `mkdir`/`writeFile` sinh `lib/types/index.d.ts` = `export * from "../../src/index.ts";`.
2. `package.json`: `exports["."].types = "./lib/types/index.d.ts"`.
3. `src`: đổi tự tham chiếu sang id GBH.
⇒ build OK, test gói **0 fail**, typecheck **0**. **Công thức đúng cho từng gói.**

### Nhưng batch 20 gói thì hỏng

- 12 gói xanh ngay; sau `bun test` (test rebuild nhiều gói) ⇒ **TS2614 / TS2345** ở `otel`, `tool-working-directory`,
  `tool-workspace-dependencies`: stub `export * from "../../src/index.ts"` làm TS thấy **hai bản sao định danh**
  của cùng một kiểu (một qua `src`, một qua `lib`) ⇒ không gán được cho nhau.
⇒ Đã **hoàn nguyên toàn bộ batch**.

### Kết luận kỹ thuật (quan trọng cho các chặng sau)

Stub **re-export nguồn** chỉ dùng được cho các gói **không có kiểu được chia sẻ giữa hai gói**.
Muốn nhân rộng, phải **phát `.d.ts` thật** bằng `tsc --emitDeclarationOnly` (không re-export),
hoặc dùng `paths` trong một tsconfig duy nhất để **mọi** gói GBH trỏ về cùng một nguồn.

### Bài học quy trình

- **Luật #14:** khi hoàn nguyên, phải khôi phục **cả `package.json`**, không chỉ `src` — lần này tôi trả
  `exports.types` về `./src/index.ts` cho **110 manifest** (trong đó 118 gói vốn đã đúng `./lib/types/index.d.ts`)
  ⇒ 56 ca đỏ. Đã khôi phục 332 manifest từ `/tmp/gbh-green-r63`.

### Trạng thái

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH**.
P1b: **32/254** gói sạch (thêm `util-time`).

## 37. Chặng 65 — tsc phát `.d.ts` chạy được, nhưng P1b vẫn phải tránh hằng số `STOCK_PACKAGE_NAME`

### Đo được

- `tsc --declaration --emitDeclarationOnly --outDir lib/types --rootDir src` cho `gbh-host-tools`
  sinh **13 tệp `.d.ts` thật** trong 3,8 s (có `TS5097` nếu thiếu `--allowImportingTsExtensions`).
- **18 gói** dùng `copyIfDebundled` (chép nguyên `lib/`, KHÔNG build lại) ⇒ các gói này **giữ được `lib/types`**.
  Đây là nhóm an toàn để đổi tên: `tools`, `session`, `llm`, `subagent`, `schedule`, `ui-settings-account`…

### Quy tắc mới phát hiện (rất dễ vấp)

**Luật #15:** KHÔNG đổi giá trị của hằng số **`STOCK_PACKAGE_NAME`** (và mọi hằng `*_STOCK_*`) —
chúng **phải giữ id stock** vì test dùng để khẳng định "id stock KHÔNG xuất hiện". Batch tự động đã đổi
`STOCK_PACKAGE_NAME` của `ui-permission` sang id GBH ⇒ test `not.toContain(STOCK_PACKAGE_NAME)` đỏ.

### Đã làm trong chặng

- `host/tool-skill`: **sạch** (gói 33/254).
- 4 gói còn lại (`ui-settings`, `ui-permission`, `settings-controller`, `llm-deepseek`): hoàn nguyên, sẽ làm thủ công.

### Trạng thái

`bun test` **0 fail** · `gate` **8/8 XANH** · 222 gói còn tham chiếu stock trong `src`.

## 38. Chặng 66 — phát hiện CƠ CHẾ làm gate ĐỎ giả + thêm 7 gói sạch

### Cơ chế `bun test` trả mã 1 dù 0 fail

`bun test` có thể thoát **mã 1** khi có **`# Unhandled error between tests`** — một tệp test đọc tài nguyên
(ở đây: `ui-settings-account.test.ts` đọc `lib/client.js`) mà tệp đó **không tồn tại** ⇒ ENOENT bắn ra
**giữa hai ca**, bun tính là `1 error` và trả mã 1 **dù `0 fail`**. Gate chỉ thấy exit code nên báo ĐỎ.

**Cách chẩn đoán đúng (ghi vào luật):**
```
bun -e 'const {spawnSync}=require("node:child_process"); const r=spawnSync(process.execPath,["test"],{encoding:"utf8",maxBuffer:32*1024*1024}); console.log(r.status); const o=(r.stdout||"")+(r.stderr||""); const i=o.indexOf("Unhandled error between tests"); console.log(o.slice(i-1200,i+600));'
```

### Nguyên nhân gốc của các tệp `lib/client.js` mất

Vòng rebuild toàn cục ở chặng 62 xoá `lib/` rồi build lỗi ⇒ 3 gói (`typert-gateway`, `permission-presets`,
`typert-registry`) và `ui-settings-account` mất `lib/client.js`. Đã khôi phục từ `/tmp/gbh-green-r65`.

### Đã sạch thêm trong chặng này (7 gói)

`session`* · `ui-permission` · `ui-settings` · `ui-settings-general` · `client-hmr` · `llm-retry` ·
`experimental-client-ui-voice-input` (`session` phải hoàn nguyên, xem dưới)

**Lưu ý:** `host/session` đã hoàn nguyên vì `.d.ts` sinh từ `src` của `gbh-llm` **không xuất** các tên mà
`session` cần (`TS2614/TS2724`) — tức `.d.ts` của gói de-bundle **khác** `.d.ts` sinh từ `src`.
⇒ Chỉ đổi tên khi **đích có `lib/types/index.d.ts` sẵn** (không sinh lại).

### Số đo

**SẠCH 110/332 gói** (chỉ còn tham chiếu kernel `cordis/schemastery/cosmokit` — giữ theo ADR-0030).
`bun test` **0 fail** (exit 0) · `gate` **8/8 XANH**.

## 39. Chặng 67 — thêm 12 gói sạch (114/332) + phát hiện bẫy `copyIfDebundled` tự xoá `lib/`

### Đã sạch thêm (12 gói)

`account-controller` · `locale` · `plugin-inventory` · `resources` · `session-delete` · `ui-layout` ·
`ui-renderer` · `ui-settings-agent-loop` · `ui-settings-plugins` · `ui-sidebar` (+ `ui-permission`, `ui-settings-general` từ chặng trước)

**SẠCH 114/332 gói** (chỉ còn `cordis/schemastery/cosmokit` — giữ theo ADR-0030).

### Bẫy mới: `copyIfDebundled` tự xoá `lib/` khi `outDir === pkg/lib`

Gói đã de-bundle (`src/parts/` hoặc tệp `.debundled`) được `copyIfDebundled` **chép nguyên `lib/`** sang đích.
Nhưng khi ai đó chạy `bun run build.ts $(pwd)/lib` (đích = chính `lib/`), hàm này **xoá đích rồi chép từ đích**
⇒ `lib/client.js` **biến mất** (chỉ còn `index.js` + `types`). Đây là lý do `ui-settings-account.test.ts`
báo `# Unhandled error between tests` (ENOENT khi đọc `lib/client.js`) ⇒ `bun test` exit 1 dù 0 fail.

**Luật #16:** với gói de-bundle, **KHÔNG BAO GIỜ** chạy `build.ts` với đích là `lib/` của chính nó;
chỉ để `apps/cli/src/mount.ts` gọi với đích trong profile. Nếu lỡ: khôi phục `lib/` từ backup rồi chạy
`scripts/sync-lib-to-profile.sh`.

### Ghi chú về độ ổn định

`office-to-pdf.test.ts` (hàng đợi/timing) **đỏ khi chạy song song toàn bộ**, **xanh khi chạy riêng** —
đây là flake tải, không phải lỗi logic. Gate (chạy sau 140 s yên tĩnh) **XANH 8/8**.

## 40. Chặng 68 — giải mã vì sao 218 gói còn chặn: `.d.ts` của ta KHÔNG suy ra được từ `src`

### Chuỗi thử trong chặng (đo được, đều hoàn nguyên)

1. Sinh `.d.ts` cho **18 gói đích quan trọng nhất** (`session`, `brand`, `sandbox`, `subagent`…) bằng
   `tsc --emitDeclarationOnly` từ `src` ⇒ sinh được 18/18, typecheck **0**.
2. Nối `exports["."].types` → `./lib/types/index.d.ts` cho **45 manifest** ⇒ typecheck **0**.
3. Thử đổi 1 gói (`otel` → `gbh-session`) ⇒ **TS2614: `gbh-session` has no exported member 'SessionEvent'`**.

### Nguyên nhân gốc (quan trọng nhất của cả P1b)

`packages/host/session/lib/index.js` xuất **32 tên** (gồm `SessionEvent`), nhưng `src/index.ts` chỉ khai
**30 tên** — tức **`src` KHÔNG phải nguồn sự thật của bề mặt gói**; artefact `lib/index.js` mới là.
Sinh `.d.ts` từ `src` ⇒ **thiếu tên** ⇒ gói dùng nó đỏ `TS2614`.

**Luật #17:** KHÔNG sinh `.d.ts` từ `src` để thay cho `.d.ts` của bản gốc — chỉ dùng `.d.ts` **có sẵn**
(`lib/types/index.d.ts` của gói), hoặc port nguyên `.d.ts` từ gói stock tương ứng.

### Đo thêm

Stock chỉ cung cấp `lib/types/` cho **một số** gói (thử chép cho tất cả: chỉ **1 gói** khớp) ⇒ không thể
vá hàng loạt bằng cách chép từ stock.

⇒ Để mở khoá 218 gói còn lại cần **port tay 18–20 tệp `.d.ts`** của các gói đích trụ cột
(mỗi tệp ~30–60 dòng, chép từ `lib/index.js` export list) — việc này nên làm thành **một chặng riêng**.

### Trạng thái

Đã khôi phục `/tmp/gbh-green-r67`: `gate` **8/8 XANH**. SẠCH giữ nguyên **114/332**.

## 41. Chặng 71 — PILOT `.d.ts` 5 gói: CHẠY ĐƯỢC, có số đo để chia việc

### Công cụ mới

`tools/typegen/emit-types.ts` — sinh `.d.ts` bằng **API TypeScript** (không cần binary `tsc`, chạy trong Bun):
`ts.createProgram` + `program.emit(..., /*emitOnlyDtsFiles*/ true)`. Cờ compiler **khớp cổng typecheck**.

### Nhóm A — gói KHÔNG de-bundle (src là bề mặt thật)

| Gói | Thời gian | Kết quả | Sửa test? |
|---|---|---|---|
| `host/lazy-require` | 1,8 s | sinh `lib/types/index.d.ts`, export khớp stock | **0** |
| `host/storage-domain` | 1,6 s | như trên | **0** |

Cách làm: (1) `emitDeclarations(pkgDir)`, (2) `exports["."] = { types: './lib/types/index.d.ts', default: './lib/index.js' }`,
(3) `bun install` → `typecheck` **0**, test 2 gói **18 pass / 0 fail**.

### Nhóm B — gói ĐÃ de-bundle (phải port `.d.ts` từ stock)

| Gói | Tệp .d.ts port | Sửa test? |
|---|---|---|
| `host/chunked-list` | 1 | **1 khẳng định** (`lib/types` phải rỗng → đổi thành "không có `.js` trong types") |
| `host/llm-deepseek-account` | 5 | **0** |
| `host/workflow-ptc` | 9 | **2 khẳng định** (E1 exports phải là `{types,default}` theo stock; E2 `lib/types` không rỗng) |

### Quy tắc rút ra (dùng cho teammate)

1. **De-bundle hay không?** `src/parts/` hoặc `.debundled` ⇒ **nhóm B**, cấm sinh từ `src` (luật #17).
2. **Nhóm A**: chạy `emitDeclarations`, wire exports, `bun install`, chạy test gói. Thường **không phải sửa test**.
3. **Nhóm B**: chép `apps/host/node_modules/@deepseek-ai/dsh-<x>/lib/types/*.d.ts` → `packages/**/lib/types/`,
   **rewrite id** `@deepseek-ai/dsh-Y` → `@galaxy-blackhole/gbh-Y` (chỉ khi ta có gói đó).
4. Chỉ wire `exports["."].types` khi **stock cũng** để `./lib/types/index.d.ts` (nếu stock để chuỗi ⇒ ta để chuỗi, giữ parity).
5. Test hay phải sửa: khẳng định `lib/types` phải KHÔNG tồn tại, và `"types" in exports === false`.

### Số đo chốt pilot

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` 57.080 ký tự · 48 slot · 0/80.

## 42. Chặng 72–73 — 4 teammate + subagent: `.d.ts` phủ 310/332 gói, nền XANH

### Kết quả chia việc (4 lô disjoint)

| Teammate | Task | Xong / bỏ | Test |
|---|---|---|---|
| fixer-llm-tools | task-35 (A1) | 35 / 7 | 36/36 tệp 0 fail |
| fixer-core-tests | task-36 (A2) | 39 / 5 | 38/38 tệp 0 fail |
| fixer-otel-preset | task-37 (A3) | 41 / 2 | 43/43 tệp 0 fail |
| fixer-persistence | task-38 (B1) | 43 / 1 | 44/44 tệp 0 fail |

**Phủ kiểu: 310/332 gói có `lib/types/index.d.ts`** (trước pilot: 152).

### 5 lỗi hệ thống phải sửa ở tầng Lead (quan trọng cho lần sau)

1. **`build.ts` xoá `lib/` ⇒ mất `.d.ts`** — đã vá: sinh types NGAY TRONG build cho gói mà **bản gốc KHÔNG có types**.
   Với gói mà **bản gốc CÓ types** thì **KHÔNG sinh** (phải chép stock nguyên văn, nếu không sẽ đỏ test "byte-identical").
2. **`artifact CŨ hơn mã nguồn`** — `cpSync` giữ mtime cũ ⇒ test từ chối. Vá `tools/debundle-guard.ts`
   đồng bộ mtime sau khi chép + script `sync-mtime` cho toàn repo (tính cả `build.ts`).
3. **Artefact canon bị rebuild sai** — với gói de-bundle, `lib/client.js` phải là bản **de-bundle** (nhiều dòng, `window.__ModuleLoader__.load({`),
   KHÔNG phải bản build từ `src/client.ts`. Đã khôi phục `lib/*.js` canon cho mọi gói có `src/parts`.
4. **Xoá `.d.ts.map` là SAI** — kernel (`cordis`, `schemastery`, `cosmokit`, `cordis-plugin-*`) có `.d.ts.map` trong
   “cây lib trùng từng byte” ⇒ phải chép lại đủ `.map` từ stock.
5. **Ánh xạ tên stock của kernel KHÁC quy tắc**: `gbh-cordis` ← `@deepseek-ai/cordis` (**không** có tiền tố `dsh-`).
   Script nào tra stock phải thử **cả hai** dạng: `@deepseek-ai/dsh-X` và `@deepseek-ai/X`.

### Số đo chốt

`bun test` **0 fail** (exit 0) · `gate` **8/8 XANH** · `check:app` 57.080 ký tự · 48 slot · 0/80 ·
**310/332 gói có kiểu**.

### Việc tiếp theo

1. 22 gói còn thiếu kiểu: phần lớn là gói GBH-only hoặc stock không có types (chấp nhận), 2 gói TS4023 cần annotation thủ công.
2. **Giờ mới đủ điều kiện chạy P1b đổi tên hàng loạt** — dùng `tools/p1b/rename-refs.ts` (đã viết, có `--apply` và chế độ khô).

## 43. Chặng 74 — đổi tên hàng loạt 208 gói: ĐÃ THỬ và PHẢI HOÀN NGUYÊN (453 lỗi kiểu)

Đã chạy `tools/p1b/rename-refs.ts --apply` theo **6 lô × 40 gói**: **1.087 tệp · 2.143 dòng · 143 manifest**.
Kết quả: `typecheck` **27 file lỗi / ~453 vi phạm** ⇒ hoàn nguyên toàn bộ từ `/tmp/gbh-green-r73`.

### Nguyên nhân (đo được)

`.d.ts` của ta cho các gói trụ cột là **bản chép từ stock** (đúng luật parity), nhưng bản chép đó
**không chứa module augmentation** mà các gói khác cần. Ví dụ điển hình:

```
packages/host/authorization/lib/types/index.d.ts   (bản MỎNG sinh từ src — 12 dòng)
stock: dsh-authorization/lib/types/index.d.ts      (227 dòng, CÓ declare module '@deepseek-ai/cordis')
```

Khi `account-platform` đổi import sang `gbh-authorization`, nó mất augmentation ⇒ `ctx.authorization`
không còn tồn tại trên `Context` ⇒ **TS2339/TS7006** lan sang 24 tệp khác.

Script `overwrite-stock-types.py` chỉ ghi đè **index.d.ts**; các tệp con (`errors.d.ts`, `service.d.ts`, …)
vẫn là bản mỏng ⇒ bề mặt kiểu không đầy đủ.

### Kết luận chiến lược (rút ra sau 3 lần vấp)

**Luật #18:** muốn đổi import sang id GBH, gói đích phải có **TRỌN BỘ `.d.ts` của stock**
(mọi tệp trong `lib/types/**`, không chỉ `index.d.ts`) — nếu chỉ có `index.d.ts` mỏng thì đổi tên sẽ
làm mất augmentation/kiểu con và đỏ typecheck.

**Luật #19:** đổi tên phải làm **theo lô ≤ 10 gói**, `typecheck` sau MỖI lô; không bao giờ chạy 208 gói một lượt.

### Trạng thái chốt chặng

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` 57.080 ký tự · 48 slot · 0/80 ·
**310/332 gói có kiểu** (thành quả GIỮ ĐƯỢC) · đổi tên: **114/332** (giữ nguyên, chưa tiến).

## 44. Chặng 75 — chép TRỌN BỘ `.d.ts` (267 gói) + phát hiện CHỐT: `quyId` của client build chặn đổi tên

### Đã làm được (giữ)

Chép **trọn bộ** `lib/types/**` từ stock cho **267 gói** (không chỉ `index.d.ts`) ⇒
**`typecheck` 0** và **`bun test` 0 fail**. Đây là nền đúng theo luật #18.

### Thí nghiệm quyết định (1 gói: `client/shortcuts`)

Đổi 2 dòng import trong `src` sang id GBH ⇒ **build đỏ ngay**:

```
packages/client/shortcuts/build.ts:105
const quyId = (text) => text.split(JSON.stringify(STOCK_ID)).join(JSON.stringify(PACKAGE_NAME))...
const ours = quyId(assembled);
const expected = quyId(readFileSync(STOCK_BUNDLE, "utf8"));   // so BYTE với stock
```

Bundle của gói được **ghép từ lát nguyên văn của stock**, trong đó có comment `@module @deepseek-ai/dsh-util-values`
⇒ khi ta đổi `dsh-util-values` → `gbh-util-values` trong `src`, chuỗi ghép ra **khác** chuỗi stock đã quy-id
⇒ cổng byte đỏ. `quyId` chỉ quy **id của chính gói**, không quy id gói khác.

### Kết luận kiến trúc (đây là chốt của P1b)

Kiến trúc repo yêu cầu: **artefact = stock, chỉ khác id của chính gói**. Vì vậy mọi tham chiếu tới id gói KHÁC
trong `src` của gói client de-bundle **không thể đổi** nếu không mở rộng `quyId` cho **toàn bộ bảng id**.

**Hai lựa chọn (cần anh quyết):**

| | Cách | Chi phí | Kết quả |
|---|---|---|---|
| A | Mở rộng `quyId` thành **quy toàn bảng** id trong ~50 `build.ts` client (dùng chung helper `tools/lib/quy-id.ts`) | 3–5 chặng | Đổi tên được **toàn bộ**, parity vẫn được bảo toàn vì hai vế cùng được quy |
| B | Chỉ đổi tên ở gói **host/không de-bundle**; gói client giữ id stock | 1–2 chặng | ~1/3 số tham chiếu được đổi; phần client vẫn còn id stock |

### Trạng thái chốt chặng

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` 57.080 ký tự · 48 slot · 0/80 ·
**267 gói có trọn bộ kiểu** · đổi tên: **114/332** (giữ nguyên).

## 45. Chặng 76 — dùng lại 4 teammate cho P1b theo lô nhỏ (đã dispatch)

### Phân loại an toàn / rủi ro (đo được)

| Nhóm | Số gói | Đặc điểm |
|---|---|---|
| **AN TOÀN** (không de-bundle) | **108** | build không so byte với stock ⇒ đổi tên được, chỉ cần sửa lỗi kiểu |
| **RỦI RO** (de-bundle) | **100** | `build.ts` ghép từ lát stock + `quyId` chỉ quy id của chính gói ⇒ cần mở rộng `quyId` (chặng sau) |

### Đã giao (4 task, mỗi teammate ~27 gói, lô nhỏ 5–8)

`task-39` (S1, fixer-llm-tools) · `task-40` (S2, fixer-core-tests) ·
`task-41` (S3, fixer-otel-preset) · `task-42` (S4, fixer-persistence)

Quy trình giao: rename lô nhỏ → `bun install` → `gate --only typecheck` → **sửa lỗi kiểu THẬT**
(cấm `@ts-ignore`/`any` mới) → `bun test` các gói đó → gói nào kẹt >10 phút thì hoàn nguyên riêng gói đó.

### Vì sao lần này khác 6 lần trước

6 lần trước tôi đổi **hàng loạt** rồi mới kiểm ⇒ vỡ dây chuyền. Lần này: **lô nhỏ + kiểm sau mỗi lô + hoàn nguyên cục bộ**,
và chỉ đụng nhóm AN TOÀN (108 gói). Nhóm de-bundle để chặng sau xử lý bằng helper `quy-id` dùng chung.

### Trạng thái

Nền **XANH** (test 0 fail · typecheck 0) · 267 gói có trọn bộ kiểu · đổi tên 114/332 · 4 teammate đang chạy.

## 46. Chặng 76 (tiếp) — 3 hạ tầng mới mở khoá P1b ở quy mô lớn

### (1) Farm symlink `node_modules/@galaxy-blackhole` — `tools/lib/link-scope.ts`

Trước P1b, artefact require `@deepseek-ai/dsh-*` (có sẵn trong oracle). Sau P1b, artefact require
`@galaxy-blackhole/gbh-*` ⇒ **phải có link**. Root `package.json` không khai các gói workspace là dependency
nên bun KHÔNG tạo link ⇒ mọi harness kiểu `join(KERNEL_AI, ..., 'node_modules', '@galaxy-blackhole')` đều gãy.

Đã làm: tool đọc **tên gói thật** trong từng `package.json`, tạo symlink `<scope>/<tên-gói>` → `packages/<nhóm>/<tên>`,
xoá link lạ; thêm `postinstall` vào package.json gốc ⇒ **`bun install` tự tạo lại** (đã kiểm: install xong vẫn đủ 332 link).

### (2) Tool đổi tên nay rewrite CẢ `.d.ts`

`tools/p1b/rename-refs.ts` trước chỉ sửa `src/**`. Nhưng `lib/types/**/*.d.ts` của gói A còn
`import … from '@deepseek-ai/dsh-session'` ⇒ kiểu stock ≠ kiểu của ta ⇒ **lỗi kiểu dây chuyền** (đo được: 76 lỗi toàn repo,
trong đó subagent 18, token-meter 22, time-context 6). Nay tool quét thêm `lib/types/**` bằng đúng hàm `anhXa` (idempotent).

### (3) Chính sách sửa test (giao cho teammate, có giới hạn)

Teammate ĐƯỢC sửa test **của chính gói trong lô**, chỉ 3 dạng: (a) id stock → GBH trong assert danh sách peer/tên artefact;
(b) so-với-stock → **giữ cả hai** (không thay thế); (c) staging symlink `node_modules` cho thư mục build tạm.
CẤM xoá phép kiểm / nới thành `toBeTruthy` / đổi logic / commit; mỗi dòng đổi phải có chú thích ngày.

### Phân loại ca đỏ do teammate báo (dùng cho chặng sau)

| Loại | Mô tả | Xử lý |
|---|---|---|
| #2 | A/B danh tính: artefact ta dùng `gbh-*`, bundle gốc dùng `dsh-*` ⇒ hai Symbol khác nhau | harness phải alias `dsh-*` → `gbh-*` (giống profile chạy thật) |
| #3 | test chính sách peer (`gbh.peers ⊆ peerDependencies`, peer phải có trong kernel) | cập nhật test theo P1b |
| #4 | `.d.ts` còn id stock ⇒ lỗi kiểu dây chuyền | ĐÃ sửa bằng (2) |

## 47. Chặng 77 — 5 teammate chạy song song; 3 quyết định hạ tầng

### Quyết định 1: KHÔNG đổi alias test (đã thử và hoàn nguyên)

Đã thử mở `tests/setup/kernel-alias.ts` để alias **toàn bộ** `@deepseek-ai/dsh-*` → gói của ta (một thể hiện mô-đun).
Kết quả sơ bộ khả quan (authorization+agent+commands: 39 pass / 4 fail thay vì đỏ hàng loạt), NHƯNG:
alias làm test A/B **mất tính đối chứng** (bundle gốc cũng nạp gói của ta) ⇒ đã **hoàn nguyên** về kernel-only.
⇒ Việc chịu lệch danh tính (#2) là CÁI GIÁ của kiến trúc 'artefact = stock + Δid'; sẽ xử lý ở P2 (khi kernel chuyển hẳn sang GBH).

### Quyết định 2: chính sách sửa test mở rộng có kiểm soát

Teammate được sửa test **của chính gói trong lô**, 3 dạng (a)/(b)/(c), mỗi dòng có chú thích ngày;
biến thể (c) được phép dựng `node_modules` GỘP (kernel + farm `@galaxy-blackhole`) trong thư mục tạm.
Được phép **build riêng gói của mình**; cấm `bun run gate`, cấm vòng build toàn cục, cấm commit.

### Quyết định 3: sensevoice là sai lệch CÓ CHỦ ĐÍCH, không phải stock hỏng

Đo: stock `dsh-experimental-speech-to-text-sensevoice/lib/index.js` mtime **2026-10-17**, CÓ `hf-mirror.com`.
Gói ta `src/config.ts:71-73` ghi rõ *'25/10/2026 (yêu cầu chủ dự án: loại bỏ option HF-mirror)'* ⇒
`modelOrigins` mặc định chỉ `["https://huggingface.co"]`. ⇒ sửa TEST theo sai lệch có chủ đích, không sửa src/stock.

### Nhân lực hiện tại (5 teammate)

| Teammate | Task | Trạng thái |
|---|---|---|
| fixer-llm-tools | task-39 (S1, 27 gói) | đang chạy, 13/31 tệp test xanh |
| fixer-core-tests | task-40 (S2, 27 gói) | **13/27 gói xong**, 12 gói test 0 fail |
| fixer-otel-preset | task-41 (S3, 27 gói) | **8 gói xong**, 10 hoàn nguyên có lý do |
| fixer-persistence | task-42 (S4, 27 gói) | **27/27 rename xong**, 7/27 test xanh |
| fixer-remotes | task-43 (S2b, 14 gói) | vừa giao |

### Sửa ở tầng Lead trong chặng

· `exports["."].types` cho `host/ptc-runtime` + `host/sandbox-windows-acl` (2 gói bị TS7016).
· `host/host-webserver`: bổ sung 4 dep còn thiếu so với stock (`compression`, `ipaddr.js`, `negotiator`, `@deepseek-ai/schemastery`).
· `tools/p1b/rename-refs.ts`: thêm cờ `--types-only`; đã chạy **toàn repo**: **621 tệp `.d.ts` · 1.057 dòng** ⇒ lỗi kiểu
  dây chuyền (#4) giảm từ 76 xuống mức thấp (dao động vì các lô đang chạy song song).

## 48. Chặng 77 (tiếp) — 3 lỗi hệ thống nữa được vá ở tầng tool/repo

### (4) Self-import: tool từng đổi luôn specifier trỏ về CHÍNH gói đang sửa

`packages/host/sandbox/src/index.ts` có `import { SandboxProvider, … } from "@deepseek-ai/dsh-sandbox"`
(gói tự nạp bundle GỐC của mình để re-export). Tool đổi thành chính tên nó ⇒ **vòng lặp mô-đun**:
`SyntaxError: The requested module '@galaxy-blackhole/gbh-sandbox' does not provide an export named 'SandboxProvider'`.
⇒ Đã vá `tools/p1b/rename-refs.ts`: **self-import giữ id stock** (kèm chú thích).

### (5) Bản port mỏng thiếu bề mặt so với stock

`gbh-sandbox` chỉ export `default` + `LocalSandboxProvider`, trong khi stock export **17 tên**
(`ESCALATION_TARGETS`, `writableRoots`, `sandboxDenialMarker`, …). Sau khi các gói khác đổi sang id GBH,
chúng chết ở `SyntaxError: does not provide an export named 'writableRoots'`.
⇒ Đã thêm **re-export phần bề mặt còn thiếu** từ bản gốc trong `packages/host/sandbox/src/index.ts` (12 tên) + build lại.

### (6) Manifest thiếu dep so với stock (đã vá `host-webserver`)

`host-webserver` thiếu `compression`, `ipaddr.js`, `negotiator`, `@deepseek-ai/schemastery` ⇒ web/web-runtime/web-startup
chết ở `Cannot find package 'compression'`. Đã bổ sung đúng như stock.

### Số đo giữa chặng

`typecheck` (chỉ packages): **25 tệp lỗi** · **SẠCH 142/332 gói** (đầu chặng: 114).
Nền chưa xanh vì 3 teammate còn đang chạy (S1, S3, S2b).

## 49. Chặng 78 — BIG-BANG 808 tệp: vẫn còn 25 lỗi kiểu ⇒ đã hoàn nguyên; nền XANH

### Thí nghiệm big-bang (đầy đủ, không chia lô)

Chạy `rename-refs.ts --apply` cho **TOÀN BỘ 332 gói**: **808 tệp · 1.449 dòng · 114 manifest**.
Kết quả `typecheck`: **25 lỗi còn lại trong ĐÚNG 3 gói** (agent-instructions 16, agent-loop 5, account-platform 4).

Đây là mức THẤP NHẤT từng đạt khi đổi tên (các lần trước 350–453). Nhưng 25 lỗi thuộc loại **không sửa được bằng đổi tên**:
kiểu `Session | Session` / `Agent | Agent` — TS coi hai bản khai báo là hai kiểu khác nhau dù nội dung y hệt,
vì chúng được nạp từ **hai đường dẫn khác nhau** (oracle `apps/host/node_modules` vs gói workspace).

Đã thử 3 cách chữa, đều không triệt để:
1. Trỏ `node_modules/@deepseek-ai` (root) về oracle bằng symlink ⇒ vẫn còn bản trong `node_modules/.bun/…`.
2. Repoint **1.504 symlink** trong `packages/*/*/node_modules/@deepseek-ai/*` về oracle ⇒ hết bản `.bun`, nhưng kiểu vẫn lệch.
3. Alias test (`kernel-alias.ts`) cho mọi gói ⇒ chạy được nhưng làm test A/B mất tính đối chứng ⇒ đã hoàn nguyên.

### Quyết định: hoàn nguyên để giữ nền XANH

`rsync` toàn bộ `packages/` + `tests/` từ `/tmp/gbh-green-r75`.
Kết quả: `typecheck` **0** · `bun test` **0 fail** · `gate` **8/8 XANH**.

### 3 lỗ hổng công cụ do fixer-remotes phát hiện (đáng vá trước lô sau)

1. `rename-refs.ts` map theo **hậu tố tên gói**; nên map theo `gbh.provenance.stock` — tránh tự-import
   (`dsh-llm-deepseek` → chính nó) và tránh bỏ sót row đổi tên khác quy ước (`dsh-tools` → `gbh-host-tools`).
2. Điều kiện “đích có kiểu” đang nhận `src/index.ts`; phải đòi `lib/types/index.d.ts` THẬT (fs-sandbox lọt lưới ⇒ TS7016).
3. Rename ghi đè khoá trong các **map object** (`bundle-meta-vi.ts`) ⇒ 18× TS1117; phải bỏ qua khoá đã tồn tại.

### Kết luận chiến lược (sửa lại đánh giá trước)

Vấn đề KHÔNG còn là `.d.ts` thiếu (đã có 267 gói trọn bộ) mà là **hai bản của cùng một khai báo kiểu tồn tại
ở hai đường dẫn** (oracle vs workspace). Muốn P1b xong phải làm MỘT trong hai:
· (A) Dẹp bản sao: mọi gói workspace dùng CHUNG `.d.ts` của oracle (đường dẫn duy nhất) — cần sửa cơ chế cài đặt;
· (B) P2: chuyển kernel + mọi gói sang id GBH rồi bỏ hẳn oracle, khi đó chỉ còn MỘT bản.

## 50. Chặng 79 — LỰA CHỌN A đã thử: gate nay chạy tsc qua tsconfig SINH TẠM có `paths`

### Phát hiện: cổng typecheck KHÔNG dùng tsconfig nào

`tools/lint/gate.ts` truyền cờ tay (`--strict --target …`) và danh sách file ⇒ `tsconfig.base.json` **không được đọc**.
Vì vậy `paths` (nếu có) không bao giờ áp dụng, và mỗi specifier được phân giải theo vị trí file:
cùng một `.d.ts` nạp từ `node_modules/.bun/…` (bản bun cài) và từ `packages/…` (bản workspace) ⇒ **hai kiểu khác nhau**
(`Session | Session`, `Agent | Agent`) dù nội dung y hệt. Đây là gốc của toàn bộ nhóm lỗi #4/#2.

### Đã sửa: sinh tsconfig tạm + `paths` ép một đường dẫn duy nhất

`runTypecheck` nay ghi `node_modules/.cache/gbh-typecheck.tsconfig.json` với `files` (danh sách cũ) + `compilerOptions`
（phản chiếu đúng cờ cũ) + `paths: { "@deepseek-ai/*": ["./apps/host/node_modules/@deepseek-ai/*"] }` rồi chạy `tsc -p`.

**Bài học quan trọng:** KHÔNG đặt `baseUrl` — khi có `baseUrl`, mọi import không tương đối được thử phân giải từ gốc repo trước,
kéo `zod` về bản `.bun` và sinh 2 lỗi mới ở `plugin-market` (`zod/v4/classic/external` hai đường dẫn).
Bỏ `baseUrl`, giữ `paths` ⇒ **typecheck 0 vi phạm** trên cây hiện tại.

### Đo lại big-bang sau khi có `paths`

Chạy lại đổi tên **toàn bộ 332 gói**: 1.130 tệp · 2.533 dòng · 194 manifest.
Kết quả: **25 lỗi còn lại trong 3 gói**, và bản chất ĐÃ KHÁC trước: không còn `Session | Session` do hai đường dẫn,
mà là **hai lỗi thật về module augmentation**:
· `agent-instructions`: `ctx.sessionProjections.stateOf(session, "turnBoundary")` ⇒ registry id là `never`
  (augmentation khai cho `@deepseek-ai/cordis`, còn gói dùng `Context` của ta);
· `agent-loop`: cùng họ;  · `account-platform`: đã sửa được bằng cách đổi import **subpath** `…/types` → entry gốc (4 tệp).

⇒ Kết luận: **thiếu đúng MỘT mảnh nữa — module augmentation phải trỏ cùng một kernel**.
Khi `@galaxy-blackhole/gbh-cordis` là một gói RIÊNG (không alias về stock), mọi `declare module "@deepseek-ai/cordis"`
trong `.d.ts` của ta không còn áp vào `Context` mà các gói đang dùng. Cách chữa đúng: thêm `paths` cho kernel:
`"@galaxy-blackhole/gbh-cordis": ["./apps/host/node_modules/@deepseek-ai/cordis"]` (và schemastery/cosmokit) —
đúng tinh thần ADR-0030 (một thể hiện kernel).

### Trạng thái chốt chặng

Đã hoàn nguyên `packages/` + `tests/` về r78 (nền xanh), GIỮ thay đổi gate (tsconfig sinh tạm).
`typecheck` **0** · `bun test` **0 fail** (2 ca đỏ khi chạy song song là flaky, chạy riêng đều xanh) · `gate` **8/8 XANH** ·
`check:app` 57.080 ký tự · 48 slot · 0 lỗi console · 0/80 ĐẠT.

## 51. Chặng 80 — đi tới ĐÚNG 1 file còn lỗi, rồi hoàn nguyên để giữ XANH

### Chuỗi tiến bộ trong chặng (mỗi bước đều đo lại)

| Bước | typecheck lỗi | Ghi chú |
|---|---|---|
| Big-bang + `paths` cho `@deepseek-ai/*` | 26 | hết lỗi kiểu do hai đường dẫn `.bun` vs `packages` |
| + `paths` kernel (`gbh-cordis`/`schemastery`/`cosmokit` → bản gốc, ADR-0030) | 26 | chuẩn bị cho augmentation hợp nhất |
| + thêm `exports["./types"]` cho `session-projection` + đổi 35 augmentation sang id GBH | 26 | |
| **+ lấp 17 gói còn THIẾU `lib/types/index.d.ts`** (chép trọn bộ từ stock) + nối `exports.types` cho 30 gói | **25, chỉ còn 1 FILE** | `account-platform` và `agent-loop` SẠCH |

### Vì sao không dứt điểm được ở chặng này

File cuối (`agent-instructions/src/service.ts`) lỗi vì `.d.ts` của `agent` vẫn trỏ `@deepseek-ai/dsh-session`
trong khi `src` trỏ `gbh-session` ⇒ hai kiểu `Session` khác nhau. Đã chạy `--types-only` cho toàn repo (506 tệp · 871 dòng)
nhưng **269 tệp `.d.ts` vẫn còn `dsh-session`** (phần lớn là **subpath** và comment mà tool bỏ qua vì gói đích chưa khai
`exports["./types"]` tương ứng).

⇒ Việc còn lại là một lượt **đồng bộ subpath exports** cho các gói có `.d.ts` dùng subpath (session, llm, typert-protocol…),
rồi chạy lại `--types-only`. Đây là việc CƠ HỌC, không còn ẩn số kiến trúc.

### Quyết định chặng này: hoàn nguyên, giữ XANH

`rsync` `packages/` + `tests/` từ `/tmp/gbh-green-r79`; GIỮ các cải tiến tooling:
· gate chạy `tsc -p` qua tsconfig **sinh tạm** có `paths` (không `baseUrl`);
· `paths` kernel theo ADR-0030;
· `tools/lib/link-scope.ts` + `postinstall`;
· `rename-refs.ts`: rewrite `.d.ts`, cờ `--types-only`, luật self-import.

Đo lại: `typecheck` **0** · `bun test` **0 fail**.

## 52. Chặng 81 — big-bang lần 3: 91 dòng import + 1.130 tệp, vẫn 26 lỗi ⇒ hoàn nguyên

### Đã thử (theo đúng kế hoạch đặt ra ở chặng 80)

1. Đồng bộ subpath `exports` từ stock: **0 mục thêm** (r79 đã có sẵn — vd `session` có `./types`, `./fork`, `./surface`).
2. Big-bang `rename-refs.ts --apply` toàn bộ 332 gói: **1.130 tệp · 2.533 dòng · 194 manifest** ⇒ **26 lỗi / 3 tệp**.
3. Lấp 17 gói thiếu `lib/types` + nối `exports.types` cho 30 gói ⇒ **vẫn 26 lỗi**
   (khác chặng 80 vì lúc đó cây đã ở trạng thái khác).
4. Chạy lại `--types-only` (506 tệp · 871 dòng) ⇒ vẫn 26 lỗi.
5. Viết thêm bộ đổi **chỉ dòng import/export** (bỏ qua comment): **91 dòng** ⇒ lỗi **lan sang 8 tệp khác**
   (`approval`, `command-goal`, `experimental-agent-team`…).

### Nguyên nhân gốc (đã kiểm chứng nhiều lần)

`packages/host/agent/lib/types/*.d.ts` vẫn trỏ `@deepseek-ai/dsh-session` trong khi `src` trỏ `@galaxy-blackhole/gbh-session`
⇒ TypeScript thấy **hai kiểu `Session`**; mỗi lần đổi thêm một chỗ, kiểu lại lệch ở chỗ khác (hiệu ứng bậc thang).
Đây là **cùng một `.d.ts` được nạp qua hai con đường**, không phải lỗi logic — nên không thể sửa từng tệp.

### Kết luận (dứt khoát)

1. **Không thể** hoàn tất P1b bằng cách sửa dần từng gói: mỗi lần đổi một chỗ, kiểu lệch chuyển sang chỗ khác.
2. Cần **một lượt đổi ĐỒNG BỘ** thoả CẢ 4 điều kiện sau, nếu không sẽ luôn còn lỗi:
   (a) `src/**` của mọi gói;  (b) `lib/types/**` của mọi gói;  (c) manifest (deps/peerDeps/gbh.peers);
   (d) **mọi subpath** (`/types`, `/fork`, `/surface`, `/message`…) — phải có `exports` tương ứng ở gói đích.
3. Hoặc chọn hướng P2: bỏ hẳn oracle, để chỉ còn MỘT bản khai báo ⇒ hết lệch kiểu tự nhiên.

### Trạng thái chốt chặng

`typecheck` **0** · `bun test` **0 fail** · gói SẠCH: **114/332** (không đổi — đã hoàn nguyên).
Backup: `/tmp/gbh-green-r80` (dùng lại) · `/tmp/gbh-green-r81` (mới, cùng nội dung + docs).

## 53. Chặng 82 — ĐO ĐƯỢC TRẦN KIẾN TRÚC: 892 tham chiếu DSH KHÔNG THỂ đổi

### Số đo quyết định (lần đầu tiên đo được chính xác)

Sau big-bang, quét toàn bộ `src/**` + `lib/types/**` đếm tham chiếu `@deepseek-ai/*` còn lại (trừ kernel):
**3.471 lượt / 901 specifier khác nhau**. Phân loại theo vị trí:

| Vị trí | Số lượt | Có đổi được? |
|---|---|---|
| `lib/types/**/*.d.ts` | 1.757 | ĐƯỢC (nhưng đổi xong phải đổi cả `src`) |
| `src` thường | 822 | ĐƯỢC |
| `src/parts*` (lát NGUYÊN VĂN của stock) | 800 | **KHÔNG** — so byte với stock |
| `src/client-parts` (lát NGUYÊN VĂN) | 62 | **KHÔNG** |
| `src/*slice*` (lát NGUYÊN VĂN) | 30 | **KHÔNG** |

⇒ **892 lượt (26%) nằm trong lát cắt nguyên văn của stock** — đổi là hỏng cổng byte-parity.

### Hệ quả logic (không thể tránh)

Mục tiêu *“không còn BẤT KỲ tham chiếu DSH nào trong mã chạy”* **không thể đạt** khi kiến trúc còn
cơ chế *“artefact = ghép lát NGUYÊN VĂN của stock, so byte với stock”*. Muốn đạt tuyệt đối phải đổi
**chính kiến trúc kiểm chứng** (so sau khi chuẩn hoá id), tức là việc của P2 — không phải việc đổi tên.

### Đã làm trong chặng (dù không giữ lại)

· Viết bộ đổi tên v3 dùng `gbh.provenance.stock` (349 gói có bảng) thay vì suy tên; tự thêm 96 subpath `exports`;
· Áp cho toàn repo: kết quả **vẫn 26 lỗi kiểu** vì bản đồ còn 498 specifier không có gói tương ứng và 305 subpath thiếu tệp.
· Sửa được lỗi hồi quy môi trường: sau `rsync` khôi phục, profile mount CŨ hơn mã nguồn ⇒ 2 test đỏ;
  chạy `scripts/sync-lib-to-profile.sh` là xanh lại (ghi làm luật #20: **rsync xong PHẢI sync profile**).

### Trạng thái chốt chặng

`typecheck` **0** · `bun test` **0 fail** · `gate` **8/8 XANH** · gói SẠCH **114/332**.

### Khuyến nghị (dứt khoát, dựa trên số đo)

1. **Không** tiếp tục các lượt đổi tên nữa — trần là 26% tham chiếu nằm trong lát nguyên văn.
2. Muốn đạt 100%: đổi **cơ chế kiểm chứng** sang *so sau chuẩn hoá id* (P2), rồi mới đổi tên hàng loạt.
3. Nếu chưa muốn đụng P2: giữ hiện trạng 114/332 (app lành, gate xanh) và dồn sức cho hạng mục khác.

## 54. Chặng 83 — TÌM RA CÔNG THỨC phá trần 26%: so byte SAU chuẩn hoá id

### Phát hiện cốt lõi

Trần 892 tham chiếu trong lát nguyên văn **không phải bất biến**. Có thể phá bằng cách tách ĐÔI phép biến đổi:

```
// thay vì:  ours = quyId(assembled)   // quy id ta -> gốc, rồi so
//            expected = quyId(stock)
const denTa    = (t) => t.split("@deepseek-ai/dsh-").join("@galaxy-blackhole/gbh-");  // artefact mang id CỦA TA
const ours     = denTa(assembled);
const expected = chuanHoaId(readFileSync(STOCK_BUNDLE, "utf8"));                       // so trên dạng ĐÃ CHUẨN HOÁ
if (chuanHoaId(ours) !== expected) throw ...;
```

Tức là: **cho phép lát ghép mang id GBH, miễn là HAI VẾ cùng được chuẩn hoá trước khi so.**

Đã hiện thực + chứng minh trên `client/shortcuts`:
· `tools/lib/id-normalize.ts` — `chuanHoaId(text)` quy MỌI `@galaxy-blackhole/gbh-*` → `@deepseek-ai/dsh-*`
  (theo bảng gói + quy ước tên cho gói ta chưa port).
· Sửa 8 tệp lát ghép của `shortcuts` → artefact sinh ra có **0** tham chiếu stock, vẫn đăng ký đúng id của ta.
· Cổng byte **VẪN XANH** (so sau chuẩn hoá); 4 tệp test liên quan: 6/0 · 8/0 · 13/0 · 15/0.

### Vì sao chưa giữ lại ở chặng này

Áp cho `shortcuts` + `ui-theme` xong thì **8 test của GÓI KHÁC đỏ**, vì các test đó vẫn so **byte THÔ** với bản gốc
(`Buffer.equals(ours, stock)`, `expect(oursText).toContain('from "@deepseek-ai/…"')`).
⇒ Muốn giữ, phải sửa **đồng thời** test của đúng những gói đó (đổi sang so sau chuẩn hoá) — đúng bản chất việc P2.

### Công thức cho chặng sau (đã đủ để làm hàng loạt)

1. `tools/lib/id-normalize.ts` (đã có, giữ lại).
2. Với từng gói có lát nguyên văn: build dùng `denTa` khi ghi artefact + so `chuanHoaId(ours) === chuanHoaId(stock)`.
3. Sửa test của gói đó: mọi so sánh văn bản bọc `chuanHoaId(...)` hai vế; mọi `toContain('from "@deepseek-ai/dsh-X"')`
   đổi thành kiểm **id của ta** (hoặc chuẩn hoá trước khi kiểm).
4. Làm theo lô 5–7 gói, chạy test của lô + `--only typecheck --no-tests`, rồi mới sang lô khác.

### Số đo chốt chặng

`typecheck` **0** · `bun test` **0 fail** (sau khi sync profile — xem luật #20) · gói SẠCH **114/332** (đã hoàn nguyên thí nghiệm).

## 55. Chặng 84 — thí nghiệm đầu tiên trên gói CÓ LÁT: công thức đúng một nửa, cần thêm 1 bước

### Đã làm

Chọn `client/client-ui-directory-picker-browse` (có 2 lát host + 6 lát client, test A1/C1/C3 canh byte).
1. Build ghi artefact bằng `denTa(assembled)` (id của ta) — cổng byte vẫn so trên `assembled` nguyên văn ⇒ **build XANH**.
2. Artefact `lib/index.js` nay mang id của ta (trước: 0 id ta / 1 id gốc).
3. Sửa test: `normalizeId` phủ TOÀN BỘ id (không chỉ id của gói), A1 so byte/sha trên dạng chuẩn hoá,
   C1 quy về id gốc trước khi so với bản ghép, C3 so kích thước trên dạng chuẩn hoá.

### Kết quả: 14/16 → còn 2 ca đỏ, và đây là BÀI HỌC

· **C1**: còn một dòng `Buffer.from(assembled).equals(Buffer.from(ours))` — so THÔ, phải bỏ/chuẩn hoá.
· **C3**: `normalizeId` KHÔNG đủ cho artefact **client.js** vì tệp đó còn được **đổi brand token** (`reverseBrandRename`)
  ⇒ chuẩn hoá id đơn thuần cho ra 49.675 B thay vì 49.695 B. Đúng như ca A2 của bộ test đã ghi: "+20 B · chuẩn hoá ⇒ byte-identical".

### Công thức HOÀN CHỈNH (chốt sau thí nghiệm)

```
// với artefact NỬA HOST:  denTa(assembled)  +  normalizeId khi so        ⇒ ĐỦ
// với artefact NỬA CLIENT: denTa(assembled)  +  reverseBrandRename(normalizeId(x)) khi so  ⇒ mới ĐỦ
```

Ngoài ra mỗi gói còn 1–2 dòng so **THÔ** trong test (C1 kiểu `Buffer.equals`) phải đổi sang so sau chuẩn hoá.

### Trạng thái

Đã hoàn nguyên thí nghiệm (khôi phục `build.ts` + test từ backup r79 — bài học: **backup phải kèm `tests/`**,
các bản r80–r83 thiếu thư mục này nên phải lấy từ r79).
`typecheck` **0** · `bun test` **0 fail** · gói SẠCH **114/332**.

### Kế hoạch chặng sau (đã đủ chi tiết để làm, không cần thí nghiệm nữa)

1. Viết helper dùng chung trong `tests/lib/` cho hai phép: `chuanHoaId` và `chuanHoaArtefactClient` (id + brand).
2. Với từng gói có lát: build `denTa`; test đổi mọi so sánh sang helper; bỏ so thô.
3. Lô 3–5 gói/lượt, chạy test của lô + `--only typecheck --no-tests`, **sync profile** sau mỗi lượt.

**Luật #21 (mới):** mọi bản backup phải có `tests/` — r80–r83 thiếu, phải khôi phục test từ r79.

## 56. Chặng 85 — helper chuẩn hoá dùng chung + thí nghiệm đầy đủ (15/16) rồi hoàn nguyên

### Mới trong repo

`tests/lib/artefact-normalize.ts` — hai phép chuẩn hoá dùng chung cho MỌI test canh artefact:

```ts
chuanHoaHost(text)   // quy id ta -> id goc
chuanHoaClient(text) // quy id + brand token (dung cho nua client)
soByte(text)         // Buffer.byteLength
```

### Thí nghiệm trên `client/client-ui-directory-picker-browse` (làm ĐẦY ĐỦ lần này)

· Build: `writeFileSync(file, denTa(assembled))` ⇒ `lib/index.js` mang id của ta (528 B, trước 523 B).
· Test: `normalizeId` phủ TOÀN BỘ id; `assertByteIdentical` so trên dạng chuẩn hoá; A1 đổi vai trò id;
  C1 quy về id gốc trước khi so với bản ghép; C3 đổi sang so **bản build tạm với artefact trong lib**.
· Kết quả: **15/16 pass** — chỉ còn C3 đỏ vì bản build trong `mkdtemp` khác lib ở dòng 21
  (thứ tự áp `denTa` và bước đổi brand trong `buildPackage` chưa hoà nhau).

### Kết luận kỹ thuật (đủ để chốt thiết kế)

1. Mô hình ĐÚNG cho giai đoạn P1b là: **nội dung artefact = bản gốc sau khi quy id/brand**, không phải
   “byte bằng bản gốc” cũng không phải “byte bằng hằng số chốt sẵn”. Mọi hằng số `bytes`/`sha16` cố định
   trong test phải **suy ra từ artefact** (hoặc bỏ), nếu không sẽ vỡ mỗi lần đổi tên.
2. Với mỗi gói có lát, cần sửa **3 chỗ**: (a) build ghi `denTa`; (b) test so sau chuẩn hoá; (c) bỏ/thay các
   khẳng định hằng số tuyệt đối. Trung bình 5–8 dòng test mỗi gói.

### Trạng thái

Đã hoàn nguyên thí nghiệm; `typecheck` **0** · `bun test` **0 fail** (2 ca đỏ khi chạy song song là flaky,
chạy riêng đều 0 fail). Gói SẠCH **114/332**.

### Đánh giá thẳng

Sau 3 chặng theo hướng này, tôi đã chứng minh **cơ chế** đúng nhưng chi phí mỗi gói là 5–8 dòng test + rủi ro
hằng số. Với ~35 gói có lát ⇒ khoảng **6–8 chặng** nữa, mỗi chặng phải hoàn nguyên được ngay.
Nếu anh muốn tôi tiếp, tôi sẽ làm lô 3 gói/lượt và giữ nền xanh sau từng lượt.

## 57. Chặng 86 — 3 GÓI ĐẦU TIÊN chuyển xong sang artefact mang id GBH (test xanh)

### Kết quả cụ thể (đo bằng test của chính các gói)

| Gói | Test | Artefact `lib/index.js` |
|---|---|---|
| `host/host-webserver` | **29/29 pass** | mang 1 id GBH (trước: 1 id stock), +5 B |
| `host/host-directory-picker` | **19/19 pass** | mang id GBH ở dòng JSDoc 13 (trước: id stock) |
| `host/host-directory-picker-browse` / `-native` | **21/21 pass** | build đã ghi `denTa` |

### Bốn phép sửa lặp lại được (công thức chốt)

1. **build.ts**: `writeFileSync(file, denTa(assembled))` — artefact ghi ra mang id của ta;
   cổng byte vẫn so `assembled` nguyên văn với stock nên KHÔNG đổi.
2. **test**: mọi phép so văn bản bọc `chuanHoaHost(...)` (host) hoặc `chuanHoaClient(...)` (client);
   `sha256` / `byteLength` tính trên bản ĐÃ chuẩn hoá; số dòng giữ tuyệt đối.
3. **test đếm id**: đổi vai trò — id ta 1 lần, id stock 0 lần (kèm dòng JSDoc tương ứng).
4. **thế giới tạm (mkdtemp)**: bắc thêm symlink `node_modules/@galaxy-blackhole` → farm của repo,
   nếu không artefact mang id GBH sẽ không phân giải được (đây chính là dạng lỗi #2b teammates gặp).

### Helper dùng chung (đã có trong repo)

`tests/lib/artefact-normalize.ts`: `chuanHoaHost`, `chuanHoaClient`, `soByte`.

### Số đo

· **27 gói** đã có artefact chứa id GBH (trước chặng: 0 đo được).
· `typecheck` **0**; `bun test` — chỉ còn 2 ca flaky quen thuộc (`rewrite-metadata` + 1 unnamed 3.59 ms),
  chạy riêng đều **0 fail**.

### Đánh giá

Sau 3 chặng thí nghiệm, công thức đã **chạy được thật** trên 3 gói, mỗi gói ~30–60 phút (chủ yếu là sửa test).
Còn ~32 gói có lát ⇒ ước **5–7 chặng** nếu tiếp tục. Tôi đã giữ nền xanh sau mỗi gói.

## 58. Chặng 87 — 6 gói chuyển xong hoàn chỉnh (công thức chạy đều tay)

### Danh sách gói ĐÃ CHUYỂN (artefact mang id GBH + test của gói xanh)

| Gói | Test |
|---|---|
| `host/host-webserver` | 29/29 |
| `host/host-directory-picker` | 19/19 |
| `host/host-frontend-static` | **28/28** |
| `host/host-directory-picker-browse` + `-native` | 21/21 |
| `host/api-job-controller` | 14/14 |
| `host/typert-registry` | 0 fail |

Đo trên đĩa: **98 gói** có ít nhất một tệp trong `lib/*.js` mang id GBH.

### 6 phép sửa lặp lại (bộ công cụ đã đủ)

1. `build.ts`: `writeFileSync(file, denTa(assembled))`.
2. Test: so văn bản bọc `chuanHoaHost(...)`; `sha256`/`byteLength` tính trên bản chuẩn hoá.
3. Test đếm id: đổi vai trò (id ta 1–2 lần, id stock 0).
4. Thế giới mkdtemp: bắc thêm symlink `node_modules/@galaxy-blackhole` → farm repo.
5. Kiểm bản sao: so sha bản sao với **sha của artefact ta** (không dùng hằng số sha gốc).
6. Khẳng định hai bên (`oursText`/`stockText`) phải **tách riêng**: bên ta kỳ vọng id GBH, bên gốc giữ id stock.

### Ba gói phải HOÀN NGUYÊN trong chặng

`host/api-terminal-controller`, `host/api-remote-access`, `host/api-workspace-files` — bộ test của chúng có
cấu trúc khác (so `artefact` qua nhiều tệp + đối chứng halves); chi phí sửa > 30 phút/gói nên hoàn nguyên
`build.ts` + dựng lại artefact để giữ nền xanh.

### Trạng thái

`typecheck` **0** · `bun test`: 4 ca flaky khi chạy song song (chạy riêng đều 0 fail) · gói SẠCH **114/332**.
Backup: `/tmp/gbh-green-r87`.

## 59. Chặng 88 — thử 3 gói "khó" (halves): 2 gói xong, 1 gói phải hoàn nguyên

### Kết quả

| Gói | Kết quả |
|---|---|
| `host/api-remote-access` | **CHUYỂN XONG** (15/15) — chỉ cần tách kỳ vọng `oursText`/`stockText` |
| `host/api-terminal-controller` | **CHUYỂN XONG** (24/24) — chuẩn hoá 2 ca byte + `byteLength` |
| `host/api-workspace-files` | hoàn nguyên — test A/B có `hostTypeSymbol`/`wireTypeSymbol` sinh từ artefact; phải chuẩn hoá 2 trường trước khi so, và bộ `-halves` dùng mô hình `pair.ourIds/bytes` riêng ⇒ chi phí > 45 phút |
| `host/api-job-controller` | hoàn nguyên — cùng lý do (mô hình `PAIR_INDEX/PAIR_CLIENT` + 6 ca halves) |

### Tổng số gói đã chuyển hoàn chỉnh: **7**

`host-webserver` · `host-directory-picker` · `host-directory-picker-browse` · `host-directory-picker-native` ·
`host-frontend-static` · `host/api-remote-access` · `host/api-terminal-controller` (+ `host/typert-registry` không có test).

### Bài học mới (quan trọng cho các gói còn lại)

**Luật #22:** gói nào có bộ test `-halves` dùng mô hình `PAIR_*` (`ourIds/stockIds/bytes/delta/sha16`)** phải
sửa **cả mô hình**, không chỉ vài dòng: khi artefact mang id của ta thì `stockIds = 0`, `ourIds > 0`,
`bytes`/`sha16` **không còn là hằng số** mà phải suy ra từ artefact. Trung bình 30–45 phút/gói ⇒ xếp
nhóm này làm **sau cùng**.

**Luật #23:** trước khi hoàn nguyên một gói đã chuyển, phải hoàn nguyên **ĐỒNG THỜI** `build.ts` + mọi tệp test
của gói đó (kể cả `-halves`) về cùng một mốc backup — nếu lệch mốc sẽ sinh vòng sửa qua lại (đã mất ~40 phút chặng này).

### Trạng thái

`typecheck` **0** · `bun test` còn **2 ca "(unnamed)" 1.55 ms** (flaky khi chạy song song; chạy riêng xanh) ·
**98 gói** có artefact mang id GBH · **4 build.ts** dùng `denTa`.

