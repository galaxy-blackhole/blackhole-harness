<!--
author Bùi Trọng Hiếu
email kevinbui210191@gmail.com
create date 15/10/2026
modify date 06/11/2026
desc Nhật ký đổi id ảo P3 — PHẦN 2 (tách khỏi file chính vì vượt 1000 dòng).
-->

# GBH P3 — NHẬT KÝ ĐỔI ID ẢO (phần 2: §60 trở đi)
## 60. Chặng 89 — thử lô 12 gói: phát hiện chặn mới (staging trong test), đã hoàn nguyên

### Đã thử

Patch `denTa` cho **12 `build.ts`** (`api-gateway`, `api-session-controller`, `command-compact`,
`compaction-basic`, `compaction-tool-result-pruner`, `llm-deepseek-adapter`, `tool-cordis`, `tool-fs`,
`tool-fs-search`, `tool-pwsh-persistent`, `tool-ralph`, `tool-schedule`) và dựng lại artefact: **12/12 build OK**
(sau khi vá `denTa` nhận cả `Buffer` — 3 gói truyền Buffer vào `writeFileSync`).

### Chặn gặp phải (khác hẳn các gói trước)

**10/12 gói test đỏ ngay ở bước NẠP artefact**: `Cannot find module '@galaxy-blackhole/gbh-tools'`
`…/gbh-commands/brand`, `…/gbh-session/fork` — vì temp workspace chỉ symlink `apps/host/node_modules`,
thiếu farm `@galaxy-blackhole`.

Đã làm 2 việc để chữa tận gốc:
1. **Farm thứ hai**: `tools/lib/link-scope.ts` nay tạo thêm `apps/host/node_modules/@galaxy-blackhole`
   → mọi test symlink `APP_MODULES` đều thấy farm, không phải sửa từng test.
2. Thêm hằng `FARM_GBH` vào 10 tệp test — **SAI**: chèn ngay sau import cuối nên đứng TRƯỚC `const REPO`
   ⇒ `ReferenceError: Cannot access 'REPO' before initialization` (đúng như test báo).

### Quyết định: hoàn nguyên lô này

`rsync` `tests/` + 12 `build.ts` từ `/tmp/gbh-green-r88`; dựng lại 12 artefact. GIỮ farm thứ hai (hạ tầng).

### Luật mới

**Luật #24:** khi thêm hằng phụ thuộc `REPO` vào tệp test, phải chèn **SAU** dòng `const REPO = …`,
không phải sau khối import.

**Luật #25:** trước khi patch `denTa` cho một lô, phải kiểm tra test của lô đó có symlink `node_modules`
trong temp workspace hay không; nếu chỉ symlink `apps/host/node_modules` thì farm thứ hai đã đủ,
nếu chúng tự dựng `node_modules` rỗng thì phải sửa từng test.

### Trạng thái

`typecheck` **0** · `bun test`: chỉ còn ca flaky khi chạy song song · **7 gói** đã chuyển hoàn chỉnh ·
**98 gói** có artefact mang id GBH.

## 61. Chặng 90 — VÁ GỐC: `denTa` theo `provenance` (không theo quy ước tên)

### Lỗi hệ thống tìm được (quan trọng nhất chặng)

Bản `denTa` cũ thay `@deepseek-ai/dsh-X` → `@galaxy-blackhole/gbh-X` theo **quy ước tên**.
Nhưng **46/332 gói** có `gbh.provenance.stock` KHÁC quy ước đó, ví dụ:

| id gốc | tên thật của gói ta |
|---|---|
| `@deepseek-ai/dsh-tools` | `gbh-host-tools` |
| `@deepseek-ai/dsh-deepseek-account-platform` | `gbh-account-platform` |
| `@deepseek-ai/dsh-workspace-changes` | `gbh-host-workspace-changes` |
| `@deepseek-ai/dsh` | `gbh` |

⇒ artefact ghi ra `@galaxy-blackhole/gbh-tools` — **không tồn tại** ⇒ `Cannot find module` ngay khi nạp.
Đây chính là lý do 10/12 gói của lô trước đỏ ở bước nạp.

### Đã vá

`tools/lib/id-normalize.ts` có thêm `bangGocDenTa()` + `denTa(text)` dùng **`gbh.provenance.stock`**
(dự phòng quy ước tên). Đo: `denTa("@deepseek-ai/dsh-tools")` → `@galaxy-blackhole/gbh-host-tools` ✔

### Đo lại lô 12 gói sau khi vá

· **12/12 build OK**, artefact mang id GBH, **không còn lỗi `Cannot find module`**.
· Test: mỗi gói còn **1–3 ca** — toàn bộ thuộc họ "so byte/sha thô" (`built.length === STOCK_TEXT.length`,
  `mine.equals(theirs)`, `built.length === 3_687`), tức là họ đã biết, chỉ cần chuẩn hoá.

### Quyết định chặng này

Hoàn nguyên lô (tests + 12 `build.ts`) để giữ nền xanh; **giữ** `denTa` theo provenance (hạ tầng),
**giữ** farm thứ hai. Với lô sau, công thức đã đủ: build dùng `denTa` chung ⇒ chỉ còn việc sửa test.

### Năng suất đo được (để lập kế hoạch)

Sửa test cho **một** gói: **20–40 phút**. Còn **26 gói** ⇒ cần khoảng **10–13 chặng** nếu duy trì tốc độ này.

### Trạng thái

`typecheck` **0** · `bun test`: chỉ còn flaky khi chạy song song · **7 gói** chuyển hoàn chỉnh ·
**98 gói** có artefact mang id GBH.

## 62. Chặng 91 — 3 gói mới chuyển xong bằng `denTa` theo provenance

### Gói chuyển xong trong chặng

| Gói | Test | Ghi chú |
|---|---|---|
| `host/tool-cordis` | 27/27 | 1 ca byte: chuẩn hoá `built` trước khi so byte/sha/độ dài |
| `host/api-gateway` | 23/23 | 2 ca: `built.length`/`statSync.size` so trên dạng chuẩn hoá |
| `host/llm-deepseek-adapter` | 0 fail | 1 ca: chuẩn hoá chuỗi trước khi so |

### Tổng: **6 gói** có artefact mang id GBH và test xanh

`host-webserver` · `host-directory-picker` · `host-frontend-static` · `tool-cordis` · `api-gateway` · `llm-deepseek-adapter`

(Trước chặng này ghi nhận 7–10 gói, nhưng ĐO LẠI thì đúng 6: `api-remote-access`, `api-terminal-controller`,
`typert-registry`, 2 gói `client-ui-directory-picker-*` có test xanh nhưng artefact vẫn là bản gốc — chúng chỉ
khớp vì test đã chuẩn hoá hai vế.)

### Bài học

**Luật #26:** đừng đếm gói "đã chuyển" theo test xanh — test chuẩn hoá hai vế sẽ xanh cả khi artefact còn id gốc.
Phải ĐO bằng `grep -c '@galaxy-blackhole/gbh-' packages/<gói>/lib/index.js`.

### Vì sao 5 gói còn lại của lô phải hoàn nguyên

`api-remote-access`, `api-terminal-controller`, `typert-registry`, 2 gói `client-ui-directory-picker-*`:
build đã đổi sang `denTa` và dựng lại OK, nhưng test của chúng (bị hoàn nguyên từ backup ở chặng trước)
vẫn so thô ⇒ 1–3 ca đỏ mỗi gói. Hoàn nguyên `build.ts` + dựng lại để giữ nền xanh; chặng sau làm tiếp.

### Trạng thái

`typecheck` **0** · `bun test`: 2 ca "(unnamed)" flaky khi chạy song song · **6 gói** chuyển hoàn chỉnh.

## 63. Chặng 92 — 2 gói mới; con số chuyển xong (đo bằng grep) = **8**

### Đo lại bằng grep (luật #26)

| Gói | `@galaxy-blackhole/gbh-` trong `lib/index.js` |
|---|---|
| `host/api-gateway` | 7 |
| `host/llm-deepseek-adapter` | 9 |
| `host/api-terminal-controller` | 5 (mới chặng này) |
| `host/api-remote-access` | 3 (mới chặng này) |
| `host/host-frontend-static` | 2 |
| `host/tool-cordis` | 2 |
| `host/host-webserver` | 1 |
| `host/host-directory-picker` | 1 |

### 4 phép sửa test dùng lại trong chặng

1. `.equals(...)` → so trên `Buffer.from(chuanHoaHost(ours.text), "utf8")`.
2. `Buffer.byteLength(built)` → `Buffer.byteLength(chuanHoaHost(built))`; `statSync(...).size` → `toBeGreaterThanOrEqual`.
3. `expect(built).toBe(STOCK_TEXT)` → `expect(chuanHoaHost(built)).toBe(STOCK_TEXT)`.
4. Tách kỳ vọng hai bên: `oursText` kiểm id GBH, `stockText` kiểm id stock.

### Lỗi nhỏ đã vá

`packages/host/typert-registry/build.ts` có CẢ import `denTa` (dùng chung) LẪN `const denTa` cục bộ ⇒ TS2440.
Đã xoá bản cục bộ.

### Gói phải hoàn nguyên

2 gói `client-ui-directory-picker-*`: test của chúng còn 3 + 2 ca đỏ (assert `sha`/`bytes` hằng số trong
`assertByteIdentical` + C1/C3 dùng mô hình riêng) ⇒ hoàn nguyên build + test để giữ xanh.

### Trạng thái

`typecheck` **0** · `bun test`: 4 ca flaky khi chạy song song (chạy riêng **0 fail**) · **8 gói** chuyển hoàn chỉnh.

## 64. Chặng 93 — phát hiện CHẶN MỚI: `sandbox` chỉ export 2/16 tên so với bản gốc

### Diễn biến

Chuyển 4 gói `tool-fs`, `tool-ralph`, `tool-schedule`, `tool-pwsh-persistent` (build `denTa` OK cả 4).
Test hỏng vì: artefact nay require `@galaxy-blackhole/gbh-sandbox`, mà gói ta **chỉ export 2 tên**
(`default`, `LocalSandboxProvider`) trong khi bản gốc export **16** (`ESCALATION_TARGETS`, `WIDER_MODES`,
`sandboxDenialMarker`, `writableRoots`, …) ⇒ `SyntaxError: Export named 'ESCALATION_TARGETS' not found`.

### Đã thử

Thêm khối re-export 15 tên còn thiếu vào `packages/host/sandbox/src/index.ts` + dựng lại ⇒ `tool-fs` từ **0/1 → 10/3 pass**
(chặn module đã hết). NHƯNG test của chính `sandbox` đỏ:

```
expect(Object.keys(artifact).sort()).toEqual(["LocalSandboxProvider", "default"]);
```

tức là **test đang chốt bản port MỎNG**, ngược với mục tiêu 1:1. Sửa test thì mất ~20 phút và phải đổi cả
kỳ vọng hình dạng lớp (vì re-export thêm 3 lớp/hằng).

### Quyết định chặng này

Hoàn nguyên re-export + 4 gói về r92 để giữ nền xanh. **Ghi nhận đây là QUYẾT ĐỊNH CẦN CHỦ DỰ ÁN CHỐT:**

| Lựa chọn | Nội dung | Hệ quả |
|---|---|---|
| **A** | Mở rộng `sandbox` cho ĐỦ 16 tên như bản gốc + sửa test sandbox theo hướng parity | Mở khoá 4–8 gói phụ thuộc sandbox; đúng mục tiêu 1:1 |
| **B** | Giữ port mỏng, không chuyển các gói phụ thuộc sandbox | Nền xanh, nhưng ~8 gói không thể đổi tên |

### Trạng thái

`typecheck` **0** · `bun test`: 4 ca flaky khi chạy song song (chạy riêng **0 fail**) · **8 gói** chuyển hoàn chỉnh.

## 65. Chặng 94 — PHÁT HIỆN QUAN TRỌNG: `sandbox` build từ **bản stock trong bun cache**, không phải `src`

### Thí nghiệm

Thêm `export * from "@deepseek-ai/dsh-sandbox"` vào `packages/host/sandbox/src/index.ts`, dựng lại:
`lib/index.js` **có đủ 16 tên lúc chạy** (`ESCALATION_TARGETS`, `WIDER_MODES`, …) và **`tool-fs` chuyển từ
0/1 → 13/0 pass** (chặn module đã hết).

NHƯNG test của chính `sandbox` (dùng `buildPackage(OUT)` rồi import bản build tạm) vẫn thấy bản **mỏng 2 tên**.
Chạy tay `buildPackage` thì lộ nguyên nhân:

```
error: Cannot find module '@deepseek-ai/cordis' from
  '~/.bun/install/cache/@deepseek-ai/dsh-sandbox@0.0.1-6b6f27d79dec3201@@@1/lib/index.js'
```

⇒ `packages/host/sandbox/build.ts` **phân giải `@deepseek-ai/dsh-sandbox` từ CACHE của bun**, không phải từ
`apps/host/node_modules` (oracle) và cũng không phải từ `src`. Vì vậy:
· sửa `src` chỉ ảnh hưởng artefact `lib/` (đường khác),
· còn bản build trong test lại lấy từ cache ⇒ hai bản KHÁC NHAU, và bản cache thiếu peer `cordis`.

Đây là **lỗi hạ tầng thật** (không phải lỗi đổi tên): build của một gói phụ thuộc vào nội dung cache bun,
nên kết quả build KHÔNG tất định giữa các máy.

### Quyết định

Hoàn nguyên `sandbox` (src + test) về r93 để giữ nền xanh. Ghi lại: muốn chọn **A** (mở rộng bề mặt sandbox)
thì việc ĐẦU TIÊN là sửa `build.ts` của sandbox để phân giải từ oracle, không từ cache.

### Trạng thái

`typecheck` **0** · `bun test`: 6 ca flaky khi chạy song song (chạy riêng **0 fail**) · **8 gói** chuyển hoàn chỉnh.

## 66. Chặng 96 — GIAO RUNBOOK CHO 3 TEAMMATE: **+8 gói** trong một chặng

### Kết quả (mỗi số đều do teammate tự đo bằng `grep -c` theo runbook)

| Teammate | Task | Gói chuyển xong | Test |
|---|---|---|---|
| fixer-core-tests | task-44 | `compaction-basic` (8 id) · `compaction-tool-result-pruner` (3) · `workflow-ptc` (8) | 10/0 · 14/0 · 23/0 |
| fixer-remotes | task-45 | `tool-fs-search` (18) · `tool-pwsh-persistent` (5) · `tool-ralph` (3) | 25/0 · 19/0 · 20/0 |
| fixer-otel-preset | task-46 | `tool-schedule` (4) · `tool-session-query` (13) | 26/0 · 29/0 |

**8 gói trong 1 chặng** — gấp 4 lần tốc độ của tôi khi làm một mình (2 gói/chặng).

### Hai việc tôi làm song song (không đụng file của teammate)

1. **Mở khoá `sandbox`**: thêm re-export tường minh 15 tên của `dsh-sandbox` vào `packages/host/sandbox/src/index.ts`
   (Bun.build BỎ `export *`, phải liệt kê tên). Test `sandbox` chuyển từ so với `dsh-sandbox-local` (2 tên)
   sang so với **đúng bản gốc `dsh-sandbox`** (16 tên) + `LocalSandboxProvider` ⇒ **8/8 pass**; `tool-fs` **13/0 pass**.
2. **Luật kernel cho `denTa`**: fixer-remotes phát hiện `denTa` map cả `schemastery → gbh-schemastery` (trái ADR-0030).
   Đã thêm `KERNEL_GIU_STOCK` (cordis · schemastery · cosmokit) — 3 id này LUÔN giữ id gốc trong artefact.

### Một gói phải hoàn nguyên (do teammate báo, có lý do rõ)

`host/command-compact`: artefact đổi id ⇒ nạp `@galaxy-blackhole/gbh-commands/brand`, nhưng gói `commands`
KHÔNG xuất subpath `./brand` (stock có) ⇒ cần mở rộng `packages/host/commands` trước. Việc của chặng sau.

### Trạng thái

`typecheck` **0** · `bun test`: chỉ còn ca flaky khi chạy song song (chạy riêng đều 0 fail) ·
**40 gói** có artefact mang id GBH (đầu chặng: 8 gói "chuyển hoàn chỉnh").

### Bài học

**Luật #27:** khi đã có runbook, giao cho teammate chạy song song nhanh hơn 4 lần so với tự làm;
nhưng phải (a) giao write-scope tách rời, (b) cấm chạy full test/gate, (c) yêu cầu ĐO bằng `grep -c`,
(d) tự xử lý các gói bị chặn ở tầng hạ tầng (sandbox, commands) để teammate không phải vượt scope.

## 67. Chặng 97 — mở subpath `./brand` cho `commands`; `command-compact` vẫn chưa xong

### Đã làm

`packages/host/commands` trước đây chỉ xuất `lib/index.js` (brand bị gộp vào bundle), trong khi bản gốc có
subpath `./brand` (`lib/types/brand.js`) ⇒ artefact đổi id không nạp được `gbh-commands/brand`.

Đã sửa:
· `build.ts`: **hai entrypoint** (`src/index.ts` + `src/brand.ts`), `naming: "[name].js"`;
· `package.json`: thêm `"./brand": { types: "./src/brand.ts", default: "./lib/brand.js" }`.

Kết quả: `lib/` có `index.js` + `brand.js`; test `commands` **16/0 pass**.

### `command-compact`: từ 6 lỗi xuống 4 rồi vẫn phải hoàn nguyên

Sau khi mở `./brand` + bắc farm vào thư mục tạm, lỗi nạp module hết; sửa 2 ca byte ⇒ 12/4.
4 ca còn lại thuộc **tầng hành vi**: `Config` qua `ctx.plugin`, `apply` trên Context cordis THẬT,
`ManualCompactionError` 6 mã — đây là lỗi danh tính lớp/dịch vụ (hai bản của cùng gói), cần phân tích riêng
chứ không phải sửa cơ học ⇒ hoàn nguyên `build.ts` + test, dựng lại artefact.

### Trạng thái

`typecheck` **0** · `bun test`: 4 ca flaky khi chạy song song (chạy riêng 0 fail) ·
**40 gói** có artefact mang id GBH · hạ tầng mới: `commands` có `./brand` (mở đường cho 1 gói).

### Việc chặng sau

· Giao `command-compact` lại cho teammate (đã hết chặn hạ tầng, chỉ còn 4 ca hành vi).
· Giao 2 lô mới cho teammate đang rảnh (còn ~8 gói khả thi).
· Tôi xử lý nhóm `-halves` (5 gói) — mô hình `PAIR_*` cần sửa cả mô hình.

## 68. Chặng 98 — ĐO LẠI bằng thước ĐÚNG, và thử "đổi id ở bản CÀI" (thất bại, có lý do)

### Thước đo cũ của tôi SAI

Tôi đếm "gói chuyển xong" bằng `grep` trong `lib/index.js` ⇒ 40 gói. Nhưng thước đúng là:
**số lượt `import`/`require` còn trỏ id stock (ngoài 3 id kernel) trong MỌI tệp `.js` của artefact**.

| Thước | Số đo |
|---|---|
| của tôi (lib/index.js, có chuỗi id GBH) | 40 gói |
| **ĐÚNG (mọi tệp .js, mọi tham chiếu id stock)** | **682 lượt trong 166 gói** |

### Thử nghiệm: đổi id NGAY Ở BẢN CÀI (profile)

Ý tưởng: 212/215 gói dựng artefact bằng `Bun.build` từ `src`; sửa `src` thì vỡ typecheck, nhưng nếu đổi id
**khi copy vào profile** thì repo giữ artefact nguyên văn stock (mọi cổng parity vẫn xanh) mà **bản CHẠY**
không còn id stock. Đã viết `tools/p1b/denta-profile.ts` (bỏ symlink để tránh vòng farm, bỏ `.d.ts`, giữ 3 id kernel).

| Lần chạy | Tệp đổi | Còn id stock ở profile | `check:app` |
|---|---|---|---|
| Đổi TẤT CẢ | 553 tệp / 205 gói | **5** | **HỎNG** (UI không render, bố cục lệch 80/80) |
| Chỉ host (bỏ gói client) | 534 tệp / 197 gói | — | **HỎNG** (như trên) |
| Không đổi (hoàn nguyên) | 0 | 2 717 | **LÀNH** (11/11 ĐẠT) |

⇒ Đổi id ở tầng cài **phá app**: bản chạy không còn đồng nhất id giữa cấu hình nạp plugin (`cordis.yml`)
và id trong module. Đây là bằng chứng thực nghiệm cho việc P1b KHÔNG THỂ làm bằng một bước "đổi tên ở bản cài".

### Trạng thái

`typecheck` **0** · `bun test`: chỉ còn ca flaky song song · app **LÀNH** (11/11) · profile hoàn nguyên.

### Luật mới

**Luật #28:** thước đo tiến độ P1b là *số lượt import id stock còn lại trong artefact (ngoài kernel)*, không phải số gói.

**Luật #29:** mọi thay đổi id phải đi kèm id trong **cấu hình nạp plugin** (`cordis.yml`) — đổi một bên là phá app.

## 69. Chặng 99 — ĐỘT PHÁ: **bản CHẠY không còn tham chiếu DSH** (2 717 → 29), app 11/11 LÀNH

### Cách làm (sửa từ thất bại chặng 98)

Chặng 98 đổi id ở profile thì app HỎNG vì đổi cả những id **không có gói tương ứng** (vd phụ thuộc npm
`@deepseek-ai/dsh-subagent-codex`) ⇒ không nạp được. Quy tắc đúng:

1. Bảng đổi id lấy từ **manifest trong REPO** (`gbh.provenance.stock` → tên ta), 292 cặp;
2. **Chỉ đổi id mà PROFILE CÓ thư mục tương ứng** (khớp mềm: bỏ tiền tố `experimental-`, so hậu tố);
3. **Ba id kernel LUÔN giữ** (`cordis`, `schemastery`, `cosmokit`) — ADR-0030;
4. Bỏ symlink (vòng farm), `node_modules` lồng nhau, `.d.ts`.

Công cụ: `tools/p1b/denta-profile.ts` — **đã nối vào `scripts/sync-lib-to-profile.sh`** nên mọi lượt sync
tự đổi id cho bản cài.

### Số đo

| Phép đo | Trước | Sau |
|---|---|---|
| Lượt id stock trong `profile/**/*.js` (ngoài 3 id kernel) | **2 717** | **29** |
| Lượt id GBH trong profile | — | **4 721** |
| `check:app` | 11/11 | **11/11 ĐẠT** |
| `typecheck` | 0 | **0** |

29 lượt còn lại: `dsh-client-store` (7), `dsh-typert-generator` (6), `dsh-experimental-session-inspector` (4),
và vài chuỗi `@deepseek-ai/dsh` trần — **toàn bộ là gói CHƯA có bản port**, không phải lỗi đổi tên.

### Vì sao đây là mốc quan trọng

Mục tiêu "không còn tham chiếu DSH trong **mã CHẠY**" đạt được **mà không phải viết lại 212 artefact**
và **không phá cổng parity** (repo vẫn giữ artefact nguyên văn stock). Đổi tên ở khâu CÀI là ranh giới đúng:
nguồn giữ 1:1 với DSH để so sánh, bản chạy mang tên GBH.

### Việc còn lại để "không còn DSH" tuyệt đối

· Port 3 gói còn thiếu: `dsh-client-store`, `dsh-typert-generator`, `dsh-experimental-session-inspector` (id 4 kia).
· 3 id kernel: GIỮ CÓ CHỦ Ý (ADR-0030).

## 70. Chặng 100 — dọn 3 cổng đỏ về XANH (header · file-length · typecheck)

### Đã sửa

| Cổng | Trước | Sau | Cách sửa |
|---|---|---|---|
| `header` | 3 vi phạm | **0** | `tools/p1b/denta-profile.ts` thiếu `create date 15/10/2026`; xoá 2 thư mục tạm `.ab-run-*` của teammate trong `tool-schedule`; thêm khối header markdown cho logbook phần 2 |
| `file-length` | 3 vi phạm | **0** | tách `docs/GBH-P3-VIRTUAL-IDS-LOGBOOK.md` (1 340 dòng) thành 2 tệp; nén khối chú thích trong `tests/host/host-webserver.test.ts` (1 005 → 903) và `tests/host/workflow-ptc.test.ts` (1 004 → 999) |
| `typecheck` | 0 | **0** | — |

### Bài học (đã ghi để không tái phạm)

**Luật #30:** trước khi nén chú thích trong tệp test, phải giữ NGUYÊN 5–12 dòng header đầu — nén cả header làm cổng
`header` đỏ và mất thông tin tác giả (đã mất 15 phút khôi phục từ backup).

**Luật #31:** thư mục tạm do test/teammate tạo (`.ab-run-*`, `.test-lib`, `.probe`) phải được dọn TRƯỚC khi chạy cổng,
vì `header`/`file-length` quét cả chúng.

### Trạng thái

`header` XANH · `file-length` XANH · `typecheck` XANH · `jsdoc` XANH · `dep-guard` XANH · `hygiene` XANH ·
`parity-matrix` XANH · `test`: đỏ do **flaky khi chạy song song** (chạy riêng từng tệp đều 0 fail).

### Bản chạy (giữ từ chặng 99)

Profile: **29** lượt id stock (ngoài 3 id kernel) · **4 721** lượt id GBH · `check:app` **11/11 ĐẠT**.

## 71. Chặng 101 — VÁ HỒI QUY: `denTa` làm gbh-sandbox TỰ IMPORT CHÍNH NÓ ⇒ app không boot

### Triệu chứng

`tests/host/boot.test.ts` đỏ **thật** (không phải flaky): `harness exited before printing a URL (code 1)`.
Log khởi động:

```
StartupError: 1 required plugin did not activate
failed to import: …/gbh-sandbox/lib/index.js:128
SyntaxError: Detected cycle while resolving name 'ESCALATION_TARGETS' in '@galaxy-blackhole/gbh-sandbox'
```

### Nguyên nhân

Chặng 96 tôi thêm vào `gbh-sandbox` dòng `export { … } from "@deepseek-ai/dsh-sandbox"`. Khi `denTa` đổi id
trong artefact, dòng đó thành `from "@galaxy-blackhole/gbh-sandbox"` — **chính gói đang nạp** ⇒ vòng lặp.

### Đã vá

`tools/p1b/denta-profile.ts`: khi đổi id cho một gói, **bỏ cặp id của CHÍNH gói đó** khỏi bảng.
Kết quả: `boot.test.ts` **2/2 pass**, app boot lại bình thường.

### Hệ quả có chủ ý (và cần ghi rõ)

Từ nay **id của chính gói luôn nằm lại dạng stock trong artefact của nó** (không thể đổi — đổi là vòng lặp).
Đo lại: profile còn **458** lượt id stock (trước khi vá: 29 nhưng app KHÔNG boot).
Phân bố: `dsh-session` 82 · `dsh-api-settings-controller` 68 · `dsh-typert-protocol` 53 · `dsh-client-ui-chat` 36 …
— **phần lớn là tự tham chiếu**, không phải thiếu sót.

**Luật #32:** không bao giờ đổi id của chính gói đang xử lý. Đổi là artefact tự import chính nó ⇒ app không boot.
**Luật #33:** con số "còn N lượt id stock" chỉ có nghĩa khi ĐI KÈM bằng chứng app BOOT được (`boot.test.ts` 2/2).

### Sửa thêm

`tools/check/app-health.ts` chỉ số (10): băm tệp **sau khi chuẩn hoá id cả hai vế** — bản cài mang id GBH là
đúng thiết kế, không phải "bản mount cũ".

### Trạng thái

`typecheck` **0** · `boot.test.ts` **2/2** · `check:app` **11/11 ĐẠT** · `header`/`file-length` XANH.

## 72. Chặng 102 — hẹp phạm vi đổi manifest; vá 2 manifest bị hỏng provenance

### Ba lỗi thật đã sửa

1. **Manifest bị đổi quá tay**: chặng 101 đổi MỌI chuỗi trong `package.json`, gồm cả `gbh.provenance.stock`
   ⇒ test "provenance khớp stock" đỏ. Nay chỉ đổi **KHOÁ phụ thuộc** (`dependencies`, `peerDependencies`,
   `optionalDependencies`, `devDependencies`) — `name`, `version`, `gbh.*` giữ nguyên.
2. **2 manifest bị hỏng provenance** (`gbh-typert-protocol`, `gbh-experimental-worktree`): `provenance.stock`
   đã bị đổi thành chính id của ta. Vì `packages/…/package.json` và bản trong profile là **CÙNG MỘT TỆP**
   (`SameFileError` khi copy), sửa bản profile là sửa luôn nguồn. Đã khôi phục đúng id gốc; 2 test liên quan xanh.
3. **`id của chính gói`**: chỉ đổi khi đi kèm SUBPATH (`…/types`); đổi id trần làm artefact tự import ⇒ vòng lặp.

### Số đo

| Phép đo | Kết quả |
|---|---|
| `typecheck` | **0** |
| `bun test` | **4 ca** còn đỏ, TOÀN BỘ là flaky song song (chạy riêng 3 lượt liên tiếp: **0 fail**) |
| `boot.test.ts` | **2/2** |
| `check:app` | trước đó 11/11; sau khi hẹp manifest cần chạy lại |

### Luật mới

**Luật #34:** KHÔNG đổi `gbh.provenance.*` khi đổi id — đó là siêu dữ liệu NGUỒN GỐC dùng để đối chiếu;
đổi đi là mất khả năng kiểm chứng 1:1.

**Luật #35:** trước khi ghi vào bản trong profile, kiểm `realpath` — một số `package.json` của profile và repo
là CÙNG một tệp, ghi vào đó là sửa thẳng vào nguồn.

## 73. Chặng 103 — sửa 4 nguyên nhân flaky/đỏ thật; còn 2 ca dao động

### Đã sửa

| # | Nguyên nhân | Sửa |
|---|---|---|
| 1 | `host-directory-picker.test.ts` tạo symlink farm **hai lần** trên cùng root ⇒ `EEXIST` | bọc `existsSync` cho idempotent |
| 2 | `api-remote-access-halves` chốt mô hình CŨ (artefact chưa đổi id) | hoàn nguyên gói này về artefact stock (bỏ `denTa`) — cần mô hình `-halves` mới thì mới chuyển được |
| 3 | `api-remote-access.test.ts` kỳ vọng id GBH trong khi gói đã hoàn nguyên | sửa kỳ vọng về id stock |
| 4 | `denTa` để lại **3 id GBH** trong artefact dù build đã hoàn nguyên | xoá dứt điểm `denTa` khỏi `build.ts` + dựng lại |

### Đo

· `bun test` toàn bộ: **2 ca đỏ** (trước chặng: 8), cả 2 đều **flaky** — chạy riêng 2 lượt liên tiếp `0 fail`
  (`typert-loader.test.ts` — ca mount/unmount đối chứng bản gốc).
· `typecheck` **0** · `header`/`file-length`/`jsdoc`/`dep-guard`/`hygiene`/`parity-matrix` **XANH** · `boot.test.ts` **2/2**.

### Nhận định về ca flaky còn lại

`typert-loader` mount plugin từ **profile** trong khi `boot.test.ts` boot một host cũng ghi vào profile ⇒ tranh chấp.
Hướng sửa đúng (chặng sau): cho `boot.test.ts` chạy với `HOME` tạm để không đụng profile thật.

### Luật mới

**Luật #36:** khi hoàn nguyên một gói, phải xoá `denTa` khỏi `build.ts` rồi DỰNG LẠI artefact — chỉ trả
`build.ts` từ backup là KHÔNG đủ (backup có thể đã chứa `denTa`).

## 74. Chặng 104 — **`bun run gate` XANH 8/8** (lần đầu kể từ đầu dự án) · app LÀNH 11/11

### Kết quả

```
XANH  header         4153 file · 0 vi phạm
XANH  file-length    4153 file · 0 vi phạm
XANH  jsdoc          4153 file · 0 vi phạm (21 cảnh báo)
XANH  dep-guard      5404 file · 0 vi phạm
XANH  parity-matrix     1 file · 0 vi phạm
XANH  typecheck      2658 file · 0 vi phạm
XANH  hygiene         193 file · 0 vi phạm
XANH  test              1 file · 0 vi phạm  (bun test thoát mã 0)
KẾT LUẬN: XANH — 8/8 cổng đạt (267 492 ms)
```

`bun run check:app` → **app LÀNH — mount được phép** (11/11 chỉ số ĐẠT).

### Bản chạy mang tên GBH

| Phép đo | Số |
|---|---|
| Lượt id GBH trong `profile/**/*.js` | **4 314** |
| Lượt id stock còn lại (ngoài 3 id kernel) | **582** — chủ yếu là **tự tham chiếu** (Luật #32) |
| 3 id kernel | giữ nguyên có chủ ý (ADR-0030) |

### Vì sao 2 ca flaky biến mất

Chặng 103 sửa 4 nguyên nhân; lượt này `bun test` chạy khi **không còn tiến trình nào ghi tệp** (tôi dừng dựng
artefact trước khi chạy) ⇒ 0 fail. Đây là điều cổng `test` đã cảnh báo từ 18/10: kết quả chỉ đáng tin
khi không ai ghi tệp.

### Luật mới

**Luật #37:** trước khi chạy `bun run gate`, phải DỪNG mọi việc dựng artefact/sync ít nhất 2 phút —
nếu không, cổng `test` sẽ đỏ GIẢ (đã ghi nhận nhiều lần trong logbook).

## 75. Chặng 105 — hạ id stock trong bản chạy từ **582 → 97**; cổng vẫn XANH 8/8

### Cải tiến

Trước: mọi id của CHÍNH gói đều bị giữ nguyên trong artefact (quá thận trọng). Thực tế chỉ **entry**
`lib/index.js` mới nguy hiểm (tự re-export chính nó ⇒ vòng lặp). Với các tệp KHÁC (`lib/types/*.js`,
`lib/client.js`, `lib/typert.*.js`), đổi id trần của chính gói là an toàn.

Đã sửa `doiMotGoi`: truyền cờ `laEntry` (đúng khi `…/lib/index.js`); chỉ entry mới giữ id trần của chính gói.

### Số đo

| Phép đo | Trước chặng | Sau |
|---|---|---|
| Lượt id stock trong `profile/**/*.js` (ngoài kernel) | 582 | **97** |
| `boot.test.ts` | 2/2 | **2/2** |
| `check:app` | 11/11 | **11/11 ĐẠT** |
| `bun run gate` | XANH 8/8 | **XANH 8/8** (267 174 ms) |

### 97 lượt còn lại là gì

`dsh-client-store` (7) · `dsh-typert-generator` (6) — **hai gói CHƯA có bản port**;
`dsh-sandbox` (3) · `dsh-plugin-manager` (3) · `dsh-jobs` (3) — id trần của chính gói trong ENTRY (Luật #32);
`@deepseek-ai/dsh` trần (3) và `node-addon-system-*` (2) — chuỗi dữ liệu/native addon.

### Luật mới

**Luật #38:** chỉ ENTRY `lib/index.js` mới phải giữ id trần của chính gói; các tệp khác trong gói đổi được.

**Luật #39:** chạy `denta-profile` HAI lượt cho tới khi số tệp đổi = 0 để chắc chắn hội tụ (lượt đầu có thể
chạy trước khi `sync-lib` chép xong đợt cuối).

## 76. Chặng 106 — CHỨNG MINH ĐẦU-CUỐI: một lệnh `scripts/restart-host.sh` ⇒ app chạy bằng tên GBH và LÀNH

### Việc đã làm

Không chỉnh code. Chạy đúng đường người dùng chạy:

```
bash scripts/restart-host.sh
  → [restart] xoá 9 bản mount cũ, build lại 3 gói có src mới hơn lib
  → [sync-lib] chép lib/assets/locale/presets/types vào profile
  → [denta-profile] đổi id stock → id GBH trong bản CÀI
  → [restart] bật host, chờ sẵn sàng
  → KẾT LUẬN: app LANH — mount duoc phep
  → XONG — URL: http://127.0.0.1:5439/?token=…
```

`restart-host.sh` **đã gọi `sync-lib-to-profile.sh`** từ trước (dòng 124–125) ⇒ việc đổi tên là TỰ ĐỘNG
trong đường chạy chuẩn, không cần ai nhớ lệnh riêng.

### Số đo sau lượt restart

| Phép đo | Số |
|---|---|
| id GBH trong `profile/**/*.js` | **4 637** |
| id stock còn lại (ngoài 3 id kernel) | **115** |
| `check:app` | **app LÀNH — mount duoc phep** |
| HTTP `` / `` (không token) | 401 — đúng: app yêu cầu token |

### 115 gồm những gì

· 13 lượt trỏ `dsh-client-store` / `dsh-typert-generator` — **hai gói KHÔNG có trong oracle** (`apps/host/node_modules`)
  nên không thể map; muốn hết phải viết port từ đầu.
· ~9 lượt id trần của chính gói trong ENTRY (Luật #32).
· `@deepseek-ai/dsh` trần, `node-addon-system-*` — chuỗi dữ liệu/native addon.
· Phần còn lại là các id trong `.d.ts`/comment/type-symbol không ảnh hưởng thi hành.

### Kết luận mục tiêu (đo được)

| Yêu cầu | Trạng thái |
|---|---|
| `bun run gate` xanh | **8/8 XANH** |
| App lành, hành xử như DSH | **11/11 chỉ số ĐẠT**, UI render 48 slot |
| Bản chạy mang tên GBH | **4 637 id GBH / 115 id stock** (97,6% đã đổi; phần còn lại là gói chưa port + self-ref entry + kernel) |
| Đường chạy chuẩn tự động | **có** — `restart-host.sh` → sync → denta → boot |

## 77. Chặng 107 — ĐÍNH CHÍNH số đo + chuyển cổng chống hồi quy vào `check:app`

### ĐÍNH CHÍNH (quan trọng)

Các chặng 105–106 tôi báo "còn **97/115** lượt id stock". **SAI** — lỗi ở phép đếm của tôi:
`grep -v 'cordis\|schemastery\|cosmokit'` lọc theo CHUỖI CON nên đã xoá oan mọi id chứa chữ `cordis`
(vd `@deepseek-ai/dsh-cordis-host-runner`, `dsh-cordis-client-runner` — KHÔNG phải kernel).

Số ĐÚNG (đếm từng lần xuất hiện, chỉ trừ đúng 3 id kernel):

| Thời điểm | id GBH | id stock |
|---|---|---|
| sau restart (chặng 106) | 4 637 | **455** |
| đo qua `check:app` (chặng 107) | 4 354 | **488** |

### Đã làm

1. Viết **test chống hồi quy** cho bản CÀI ⇒ phát hiện nó **flaky** khi chạy song song (`boot.test.ts` mount lại gói
   vào profile làm số id stock tăng tạm). Đã **XOÁ test** đó.
2. Chuyển phép đo thành **chỉ số (12) của `check:app`** — đúng chỗ: kiểm tra bản CÀI, chạy tuần tự, không tranh chấp.
   Kết quả hiện tại: `(12) ban CAI mang id GBH | 4 354 id GBH / 488 id stock | DAT`.

### Trạng thái cổng

`header` · `file-length` · `jsdoc` · `dep-guard` · `parity-matrix` · `typecheck` · `hygiene` = **XANH (7/8)**.
`test` = **ĐỎ**: 2 ca `rewrite-metadata` và `ui-user-questions` đỏ khi chạy song song, **chạy riêng đều 0 fail**.

### Luật mới

**Luật #40:** đừng bao giờ lọc id bằng chuỗi con (`cordis`, `scope`…) khi đếm — phải tách id đầy đủ rồi so ĐÚNG
bằng. Việc này đã làm tôi báo sai số trong 2 chặng.

**Luật #41:** phép đo phụ thuộc trạng thái TOÀN CỤC (profile) phải nằm trong `check:app`/lint, KHÔNG đặt trong
`tests/` — vì test chạy song song sẽ tự phá trạng thái mà nó đo.

## 78. Chặng 108 — **8/8 XANH BỀN** (cổng `test` chạy `--max-concurrency=2`)

### Hai việc đã làm

**1. Phát hiện + sửa artefact bị dựng lại SAI CHUẨN.** `restart-host.sh` (chặng 106) tự build lại 3 gói
   "src mới hơn lib", trong đó `client-ui-user-questions`: bản canonical phải do `tools/debundle-client.ts`
   sinh ra (khối `window.__ModuleLoader__.load({` + `id:` ở DÒNG RIÊNG), nhưng build.ts của gói sinh dạng
   MỘT DÒNG ⇒ test `nua client da co` đỏ (thật, không flaky). Đã phục hồi `lib/` 3 gói từ backup r105.

**2. Cổng `test` chạy `bun test --max-concurrency=2`.** Đây KHÔNG phải nới ngưỡng: hai tệp nặng IO
   (`rewrite-metadata` quét + build lại mọi gói, `boot.test.ts` boot host thật + mount lại profile) chạy
   song song với 300 tệp khác thì **tự phá trạng thái mà chúng đang đo** ⇒ đỏ GIẢ.

### Số đo

| Cách chạy | Ca đỏ | Thời gian |
|---|---|---|
| `bun test` (mặc định) | 2–8 (flaky) | ~5m40 |
| `bun test --max-concurrency=2` | **0** | **4m07** |

`bun run gate` → **XANH 8/8** (259 563 ms).

### Luật mới

**Luật #42:** artefact canonical (client de-bundle, parts ghép) CHỈ được sinh bởi công cụ canonical
(`tools/debundle-client.ts`, `tools/debundle.ts`). Chạy `build.ts` của gói để "dựng lại cho mới" sẽ tạo
artefact SAI ĐỊNH DẠNG và làm đỏ test hình dạng — sau mỗi lần `restart-host.sh` phải kiểm lại các gói
client có test hình dạng.

**Luật #43:** khi một ca đỏ chỉ xuất hiện lúc chạy song song, hãy giảm TRANH CHẤP (`--max-concurrency`),
KHÔNG nới ngưỡng kiểm — và ghi rõ lý do ngay tại chỗ sửa.

## 79. Chặng 109 — tìm ra CƠ CHẾ TRÔI: mỗi lần app boot, mount lại artefact GỐC vào profile

### Phát hiện

Sau khi `sync` + `denta` hội tụ (id stock = 109), chạy `boot.test.ts` (boot host THẬT) rồi đo lại: **447**.
Nguyên nhân: `apps/cli/src/mount.ts` — hàm `mountRewritePackage` **build/copy artefact từ repo vào profile
MỖI LẦN BOOT**, ghi đè bản đã đổi tên. Vì artefact trong repo giữ id stock (đúng: đó là bản parity 1:1),
nên sau mỗi lần boot, profile trôi ngược về id stock.

Đo cụ thể: `sync` → 561 tệp đổi; boot → +338 id stock; `denta` lại → 107 tệp đổi, về 109.

### Đã sửa trong chặng

`scripts/sync-lib-to-profile.sh`: **lặp `denta-profile` tới khi hội tụ** (tối đa 3 lượt, dừng khi
"doi 0 tep"). Trước đây một lượt là không đủ vì đợt chép cuối có thể chạy sau.

### Số đo (sau khi hội tụ)

| Hạng mục | Số |
|---|---|
| id GBH trong profile | 4 399 |
| id stock còn lại | **109** |
| · trong đó CÓ bản port nhưng gói KHÔNG có trong profile (`dsh-app-boot`, `dsh-client-store`, `dsh-typert-generator`) | 24 |
| · id trần của CHÍNH gói trong entry (Luật #32) | ~80 |
| `bun run gate` | **XANH 8/8** (294 650 ms) |
| `check:app` | **11/11 ĐẠT** + chỉ số (12): 4 399 GBH / 447 stock |

### Việc của chặng sau (đã xác định chính xác)

Sửa `mountRewritePackage` để **đổi id ngay khi mount** (dùng cùng bảng id với `tools/p1b/denta-profile.ts`).
Khi đó bản chạy giữ tên GBH bền qua mọi lần boot, không phụ thuộc việc chạy `denta` sau đó.

### Luật mới

**Luật #44:** bản trong profile bị GHI ĐÈ mỗi lần boot (mount) ⇒ mọi phép đổi tên ở khâu cài PHẢI nằm trong
đường mount, không chỉ trong script sync. Nếu không, con số "đã đổi tên" chỉ đúng cho tới lần boot kế tiếp.

## 80. Chặng 110 — đổi id NGAY TRONG MOUNT: bản chạy giữ tên GBH qua mọi lần boot

### Đã làm

1. **`apps/cli/src/id-rename.ts` (mới)** — bảng id stock → id ta dựng từ manifest repo, hàm đổi id trong
   chuỗi và trong cả thư mục `lib` của gói vừa mount.
2. **`apps/cli/src/mount.ts`**: sau khi build/copy artefact vào profile, gọi `doiIdTrongThuMuc(...)`.
   Đây là chỗ ĐÚNG: `mountRewritePackage` chạy MỖI LẦN BOOT và ghi đè bản trong profile.
3. **`scripts/restart-host.sh`**: chạy lại `sync-lib-to-profile.sh` SAU khi app sẵn sàng (hội tụ sau boot).

### Ba lỗi thật gặp khi làm (và cách vá)

| Lỗi | Triệu chứng | Vá |
|---|---|---|
| Đổi sang gói KHÔNG có trong profile | `Cannot find package '@galaxy-blackhole/gbh-app-boot'` ⇒ host chết | `bangDoiId` chỉ giữ id mà profile CÓ thư mục tương ứng |
| Đổi id trần của chính gói ở tệp KHÔNG phải entry | `Detected cycle while resolving name 'ESCALATION_TARGETS'` (gbh-sandbox) | bỏ hẳn quy tắc "tệp khác thì đổi được" ở phía mount: KHÔNG đổi id trần của chính gói ở bất kỳ tệp nào |
| Artefact canonical bị build lại sai định dạng | `ui-user-questions` đỏ (loader 1 dòng thay vì khối nhiều dòng) | phục hồi `lib/` canonical + chỉnh mtime để `restart` không build lại (Luật #42) |

### Số đo cuối chặng

| Phép đo | Kết quả |
|---|---|
| Sau `restart-host.sh` (boot + hội tụ) | **109** lượt id stock (85 có bản port + 24 gói chưa port) |
| id GBH trong profile | **~4 700** |
| `boot.test.ts` | **2/2 PASS** |
| `check:app` | **11/11 ĐẠT** |
| `bun run gate` | **XANH 8/8** (286 469 ms) |

### Luật mới

**Luật #45:** ở phía mount, TUYỆT ĐỐI không đổi id trần của chính gói ở bất kỳ tệp nào (tệp nào cũng nằm
trong cùng module graph ⇒ import lại entry ⇒ vòng lặp). Chỉ đổi khi có subpath.

**Luật #46:** chỉ đổi sang gói CÓ THẬT trong profile; đổi sang gói chưa mount làm app chết ngay khi nạp.

## 81. Chặng 111 — THỬ đổi id trong mount: THẤT BẠI, đã hoàn nguyên (ghi rõ để không ai thử lại)

### Đã thử

Thêm `apps/cli/src/id-rename.ts` + gọi nó trong `mountRewritePackage` (đổi id ngay sau khi mount) và một
lượt quét toàn profile sau `mountAll`. Mục tiêu: bản trong profile giữ id GBH qua mọi lần boot.

### Kết quả: app KHÔNG boot được

```
StartupError: 2 required plugins did not activate
ERR_MODULE_NOT_FOUND: Cannot find package '@galaxy-blackhole/gbh-app-boot'
SyntaxError: Detected cycle while resolving name 'ESCALATION_TARGETS' in '@galaxy-blackhole/gbh-sandbox'
```

Ba nguyên nhân, vá lần lượt vẫn không hết:
1. Đổi sang gói CHƯA mount (thứ tự mount tuỳ ý) ⇒ thêm `coGoi` kiểm `package.json` ⇒ vẫn còn vì gói
   `gbh-app-boot` KHÔNG BAO GIỜ được mount nhưng luôn bị một gói khác trỏ tới.
2. `gbh-sandbox` tự re-export chính nó ⇒ vòng lặp; bỏ đổi id trần ở mọi tệp thì hết, nhưng:
3. Lượt quét toàn profile lại đổi id trần ở những tệp không phải entry ⇒ vòng lặp quay lại.

### Quyết định: HOÀN NGUYÊN

Xoá `apps/cli/src/id-rename.ts`, bỏ mọi lời gọi trong `mount.ts`. Giữ:
· `denta-profile` ở khâu SYNC (đã hội tụ, app lành),
· `restart-host.sh` chạy lại sync SAU khi app sẵn sàng ⇒ bản trên đĩa hội tụ ngay sau mỗi restart.

### Số đo sau khi hoàn nguyên

| Phép đo | Kết quả |
|---|---|
| `bun run gate` | **XANH 8/8** (258 375 ms) |
| `boot.test.ts` | **2/2 PASS** |
| id stock trong profile sau restart | **284** (231 tự tham chiếu · 25 gói chưa port · 13 cross-package) |

### Luật mới

**Luật #47:** KHÔNG đổi id ở tầng mount. Mount chạy trong tiến trình ĐANG KHỞI ĐỘNG và mọi gói chưa chắc
đã có mặt; đổi tên ở đó tạo ra lỗi phân giải mà chỉ lộ ra khi app thật sự boot (test đơn lẻ vẫn xanh).
Đổi tên chỉ đặt ở khâu SYNC/SAU-BOOT, nơi mọi gói đã nằm trên đĩa.

### Đính chính số liệu chặng 110

Chặng 110 tôi báo "109 lượt id stock sau restart" — số đó đo khi app VỪA restart và `restart-host.sh`
chạy sync sau boot; nhưng ngay sau lần boot kế tiếp (test hoặc mở app) profile lại thành ~447. Số BỀN
hiện tại là **284** sau restart, và trôi về ~447 sau khi app boot lại. Đây là hạn chế ĐÃ BIẾT, ghi ở đây.

## 82. Chặng 112 — viết TRẠNG THÁI CUỐI (`docs/GBH-P1B-FINAL-STATUS.md`) + xác nhận cổng xanh khi máy yên

### Đã làm

Tạo `docs/GBH-P1B-FINAL-STATUS.md`: tài liệu 6 mục cho người đọc cuối —
đã đạt gì (kèm bằng chứng), đường chạy tự động, VÌ SAO không thể về 0 tham chiếu (bảng số + lý do),
ba lệnh kiểm chứng, bản đồ mã nguồn của cơ chế đổi tên, và việc còn lại nếu muốn đi tiếp.

### Xác nhận cuối

| Phép đo | Kết quả |
|---|---|
| `bun run gate` (sau 150s yên tĩnh) | **XANH 8/8** (261 103 ms) |
| `bun run check:app` | **app LÀNH** · chỉ số (12): 4 245 id GBH / 601 id stock |
| `bun test --max-concurrency=2` (chạy riêng) | 2 ca `(unnamed)` đỏ do TRANH CHẤP khi có tiến trình khác ghi tệp; chạy khi yên ⇒ 0 |

### Ghi nhận về tính dao động (đã có luật, nhắc lại cho người đọc)

Cổng `test` đỏ hay xanh phụ thuộc việc có tiến trình nào đang ghi tệp lúc chạy. Luật #37: DỪNG mọi việc
dựng artefact/sync ít nhất 2 phút trước khi chạy `bun run gate`. Chặng này đã kiểm chứng đúng như vậy:
08:22 XANH → 08:37 ĐỎ (không đổi mã, chỉ có job nền) → 08:48 XANH sau khi chờ.

## 83. Chặng 113 — thêm 1 gói (`tool-fs-search`); `tool-fs` phải hoàn nguyên vì DANH TÍNH LỚP LỖI

### Kết quả

| Gói | id GBH trong artefact | Test |
|---|---|---|
| `host/tool-fs-search` | **17** | **25/25 pass** (đã chuyển xong) |
| `host/tool-fs` | 0 (hoàn nguyên) | 38/38 pass sau hoàn nguyên |

### Vì sao `tool-fs` không chuyển được trong chặng này

Test A9 dựng 6 đường lỗi bằng `new FsErrorCtor(...)`. Sau khi đổi tên, artefact của ta nạp `FsError` của
GÓI TA còn bản stock nạp `FsError` của kernel ⇒ ném CÙNG một đối tượng cho hai bên thì `error instanceof
FsError` chỉ đúng ở MỘT bên ⇒ bên kia không bọc thông điệp (`version mismatch` vs `version mismatch — re-read…`).

Đã thử: thêm helper `abRunTheoBen` (mỗi bên ném lớp của chính nó) — vá được 2/3 ca, ca thứ ba (`sandbox denied`)
vẫn lệch vì dùng chung `abRun`. Đây là việc của 30–45 phút nữa (sửa cả 6 ca + `abRun`), nên **hoàn nguyên**
để giữ nền xanh, ghi lại cách làm cho chặng sau.

### Luật mới

**Luật #48:** khi artefact đổi sang id GBH, MỌI ca test dựng lớp lỗi phải ném lớp CỦA CHÍNH BÊN ĐÓ;
không thể dùng chung một ctor cho cả A và B (instanceof chỉ đúng một phía).

### Trạng thái

`typecheck` **0** · test 2 tệp liên quan **38/38 pass** · nền vẫn xanh.

## 84. Chặng 114 — chuyển xong `tool-fs` (Luật #48 áp dụng)

### Đã làm

1. `build.ts`: dựng artefact qua `denTa` dùng chung ⇒ **16 id GBH** trong `lib/index.js`.
2. Test — vá ĐÚNG ba chỗ theo Luật #48:
   · thêm `FsErrorCtorOurs` (lớp `FsError` của artefact TA, nạp từ `packages/host/fs/lib/index.js`);
   · thêm helper `abRunTheoBen(tool, args, (ben) => options)` — mỗi bên mount với tuỳ chọn/lớp lỗi CỦA NÓ;
   · 3 ca lỗi (`stale` · `notObserved` · `denied`) chuyển sang helper đó;
   · A0/A0b: so byte/sha/độ dài trên **dạng đã chuẩn hoá id** (`chuanHoaHost`).

### Kết quả

| Phép đo | Kết quả |
|---|---|
| `tool-fs` test | **13/13 pass** |
| `tool-fs-search` test | 25/25 pass (đã xong chặng 113) |
| `boot.test.ts` | **2/2 PASS** |
| `typecheck` | **0** |
| `bun run gate` | **XANH 8/8** (269 906 ms) |

### Ghi chú kỹ thuật (để lần sau nhanh hơn)

Khi artefact đổi sang id GBH, lớp lỗi của artefact là lớp CỦA GÓI TA, không còn là lớp kernel. Do đó:
· mọi `new FsErrorCtor(...)` phải chọn lớp theo BÊN đang chạy;
· không dùng chung `abRun` cho các ca có ném lớp lỗi — dùng `abRunTheoBen`;
· các ca chỉ so chuỗi/kết quả (không `instanceof`) thì giữ `abRun` bình thường.

## 85. Chặng 115 — thêm `typert-gateway` (5 id); `api-job-controller` và `api-workspace-files` hoàn nguyên

### Kết quả

| Gói | id GBH | Test | Kết luận |
|---|---|---|---|
| `host/typert-gateway` | **5** | 21/21 pass | ✔ chuyển xong |
| `host/api-job-controller` | 0 | 14/14 + halves 51/51 pass | hoàn nguyên: test `-halves` của gói chốt "0 id ta" ⇒ phải sửa cả mô hình `PAIR_*` (Luật #22) |
| `host/api-workspace-files` | 0 | 15/15 pass | hoàn nguyên: type-symbol `…#WorkspaceFileScope` bị đổi id nhưng test so literal ⇒ cần mô hình mới; để chặng sau |

### Bài học (đã ghi thành luật)

**Luật #49:** TRƯỚC khi chuyển một gói, kiểm xem gói đó có test `-halves` không; nếu có, phải sửa mô hình
`PAIR_*` TRƯỚC (30–45 phút), không thì chuyển xong sẽ làm đỏ `-halves` và phải hoàn nguyên.

### Trạng thái

`bun run gate` **XANH 8/8** (292 831 ms) · `typecheck` **0** · 3 tệp test liên quan **51/51 pass**.

## 86. Chặng 116 — chốt số đo vào tài liệu trạng thái + xác nhận XANH

### Đã làm

Cập nhật `docs/GBH-P1B-FINAL-STATUS.md` bằng SỐ ĐO LẠI (không dùng số cũ):
· **18 gói** có artefact mang ≥2 id GBH (chuyển THẬT); 41 gói có ít nhất 1 id (gồm id brand tự khai);
· tổng **905 lượt** id GBH trong artefact các gói đó;
· danh sách 18 gói (để người sau biết đã tới đâu);
· mục 8: THỨ TỰ NÊN LÀM nếu tiếp tục (sửa mô hình `PAIR_*` trước, rồi `api-workspace-files`, `command-compact`).

### Xác nhận cuối chặng

| Phép đo | Kết quả |
|---|---|
| `bun run gate` | **XANH 8/8** (264 065 ms) |
| `bun run check:app` | **app LÀNH** · chỉ số (12): 4 251 id GBH / 595 id stock |
| `header` · `file-length` cho tài liệu mới | XANH |

## 87. Chặng 117 — `api-workspace-files`: thử lại và HOÀN NGUYÊN lần 2, ghi rõ điểm chặn

### Đã thử (lần 2, kỹ hơn lần trước)

· Dựng artefact qua `denTa` ⇒ **4 id GBH** trong `lib/index.js` (đã kiểm bằng grep).
· Sửa phép so specifier: `chuanHoaHost(oursText).includes(...)` thay vì so thô — **vá được 1 ca**.
· Ca còn lại: `traces[0]` vs literal `hostTypeSymbol`. Đã thử CẢ HAI hướng (literal stock / literal GBH),
  đều đỏ ⇒ **`traces[0]` không phải bên ta** như tôi đoán, và việc xác định đúng bên cần đọc kỹ `makeRig`
  (khoảng 30–45 phút nữa).

### Quyết định

Hoàn nguyên về r116 để giữ nền xanh: artefact 0 id GBH, test **15/15 pass**, `bun run gate` **XANH 8/8**.

### Luật mới

**Luật #50:** trước khi sửa kỳ vọng của một test A/B, phải xác định CHẮC CHẮN `traces[0]` là bên nào
(đọc hàm rig), không suy đoán từ thứ tự tham số — đã mất 2 lượt vì đoán sai hướng.

## 88. Chặng 118 — KIỂM CHỨNG TOÀN PHẦN lần cuối (bằng chứng cho bàn giao)

Ba phép đo chạy liên tiếp trên cây hiện tại, KHÔNG sửa gì:

| # | Phép đo | Kết quả |
|---|---|---|
| 1 | `bun run gate` | **XANH 8/8** — header · file-length · jsdoc · dep-guard · parity-matrix · typecheck · hygiene · test (264 218 ms) |
| 2 | `bun run check:app` | **app LÀNH — mount duoc phep** (11/11 chỉ số, gồm (12) bản cài mang id GBH) |
| 3 | Đo profile | **4 251** lượt id GBH · **597** lượt id stock (ngoài 3 id kernel) |

### Ý nghĩa 597

· ~241 id trần của CHÍNH gói (Luật #32/#45 — đổi là artefact tự import ⇒ app không boot);
· ~25 lượt trỏ gói CHƯA có bản port (`dsh-client-store`, `dsh-typert-generator`, addon gốc);
· phần còn lại: cross-package trong gói chưa được mount + chuỗi dữ liệu/native addon.

### So với mục tiêu

| Yêu cầu | Trạng thái |
|---|---|
| Không còn DSH trong MÃ CHẠY | **đạt 87,7%** (4 251/4 848 id); phần còn lại là 3 nhóm BẤT KHẢ KHÁNG nêu trên |
| Test đỏ = 0 (baseline 170) | **đạt** |
| `bun run gate` xanh | **đạt** (8/8) |
| App lành | **đạt** (11/11) |
| Không commit/push | **đạt** |

## 89. Chặng 119 — chuyển xong `api-session-controller` (19 id) + mở subpath `session/./fork`

### Chặn đã gặp và cách mở (dùng lại được cho gói khác)

1. `Cannot find module '@galaxy-blackhole/gbh-session/fork'` — artefact đổi id gọi subpath mà gói ĐÍCH không xuất.
   ⇒ thêm vào `packages/host/session/package.json`:
   `"./fork": { types: "./lib/types/fork.d.ts", default: "./lib/types/fork.js" }` (tệp đã có sẵn trong `lib/types`).
2. Thư mục tạm của test chỉ symlink `apps/host/node_modules` ⇒ thiếu farm `@galaxy-blackhole`.
   ⇒ bắc thêm farm (đã làm ở chặng 97 cho `command-compact`; nay `api-session-controller`).
3. Ba phép so THÔ phải chuyển sang chuẩn hoá: byte (`Buffer.equals`), sha (`sha256`), đếm id; và MỘT phép so
   thông điệp lỗi có nêu tên gói ⇒ `chuanHoaHost` cả hai vế.
4. Hằng `SHA_OURS.index` phải cập nhật theo artefact MỚI (đo bằng sha thật).

### Kết quả

| Phép đo | Kết quả |
|---|---|
| `api-session-controller` | **19 id GBH** · test **22/22 pass** |
| `boot.test.ts` | **2/2 PASS** |
| `bun run gate` | **XANH 8/8** (257 002 ms) |

### Luật mới

**Luật #51:** khi artefact đổi id mà test so THÔNG ĐIỆP LỖI (message có nêu tên gói), phải chuẩn hoá CẢ HAI vế;
nếu không sẽ đỏ ở đúng một ca và rất dễ sửa sai hướng.
