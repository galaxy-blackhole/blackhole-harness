<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row cordis-client-runner (HAI MẶT): nửa host rỗng y bản gốc + nửa browser
      de-bundle NGUYÊN VĂN 7.408 dòng thành 11 lát, thân factory + CSS byte-identical với bundle gốc
-->

# @galaxy-blackhole/gbh-cordis-client-runner

> Row `cordis-client-runner` (PARITY-MATRIX dòng 130, tier **T4**) — **HAI MẶT**, cả hai nửa đã xong:
> nửa **host** rỗng y bản gốc (11 dòng) + nửa **browser** **de-bundle nguyên văn** 7.408 dòng thành **11 lát**
> ⇒ thân factory **trùng từng byte** với bundle gốc (SHA-256 `2c2ceebd…5abe`, 399.565 B).
> Khai `gbh.row.moved: true` — **KHÔNG phải "chưa viết lại"**: gói đã có `src/` + `build.ts`; lý do THẬT là
> cổng `check:rows` **chưa phân biệt được** `load` ĐỘNG của chính bundle với `load` của bundle (xem §7.3).

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `cordis-client-runner` (tier T4 · ma trận dòng 130) | `@galaxy-blackhole/gbh-cordis-client-runner` |
| Package | `@deepseek-ai/dsh-cordis-client-runner` @0.2.1-alpha.4 | `@galaxy-blackhole/gbh-cordis-client-runner` @0.1.0 (private) |
| **Nửa host** | `lib/index.js` **11 dòng · 428 B** — export **DUY NHẤT** `apply`, thân hàm **rỗng** | `lib/index.js` **5 dòng · 91 B** — export **DUY NHẤT** `apply`, thân hàm **rỗng** |
| **Nửa browser** | `lib/client.js` **7.408 dòng · 399.710 B** | `lib/client.js` **7.417 dòng · 400.305 B** = thân gốc **NGUYÊN VĂN** + vỏ IIFE 9 dòng + header 7 dòng |
| Hai mặt? | **CÓ** — `dsh.client`: `inject` 4 id · `platform: web` · **không** `immediately` | **y hệt** (`inject` + `platform` sao nguyên; `exports["./client"]`) |
| `locale/{en,zh}.json` | có (`meta.title` = `cordis-client-runner`) | **chép byte-for-byte** — sha1 khớp (`c55c41d9…` · `ee92522c…`) |
| `peerDependencies` | `@deepseek-ai/cordis ~4.0.5-alpha.2` | **y hệt** (không dùng `dependencies` — kernel cấp MỘT thể hiện) |
| `gbh.peers` | — | `[]` — nửa host `apply` **không inject service nào** (bản gốc cũng vậy) |

## 2. Năm câu hỏi bắt buộc (mục 0 của HOST-ROW-REWRITE)

| # | Câu hỏi | Trả lời đo được |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **BẬT** — `.parity/dumps/2026-10-17T22-32-31/ours.yml:582-583` **không** có `disabled`; row tiêu thụ `ui-cordis` cũng **đang BẬT**. |
| 2 | Thuần host hay có **mount surface client**? | **HAI MẶT** — nửa host chỉ là "mặt tiền"; toàn bộ khả năng ở nửa browser (service `ctx.dynamicCordisRunner`). |
| 3 | Cần **seam** nào? | Phía host: **KHÔNG** (0 import, `apply` rỗng). Phía browser: 4 **id module** (`dsh.client.inject`) — đã khai đúng như gốc. |
| 4 | Hành vi **đo được**? | Host: **không có** — `apply` rỗng, không đọc/ghi `ctx` (test có Proxy NÉM). Browser: bundle đăng ký **1 id**; phép đo là entry activate. |
| 5 | Package gốc có `dsh.client` không? | **CÓ** ⇒ bẫy hai mặt: thay row mà thiếu nửa browser ⇒ **mất entry client** ⇒ mất service ⇒ mất chức năng **ÂM THẦM**. Row này **đã** có nửa browser. |

## 3. LUẬT MỘT ID — id bundle TỰ KHAI = TÊN PACKAGE (không phải lựa chọn thẩm mỹ)

`gbh.row` khai **một chỗ** cho id gốc, bundle đăng ký **một** id:

    "moduleIds": ["@galaxy-blackhole/gbh-cordis-client-runner"]   // CHỈ id của ta = TÊN PACKAGE
    "aliases":   ["@deepseek-ai/dsh-cordis-client-runner"]        // id stock ở ĐÚNG MỘT chỗ
    "moved":     true                                             // né CHAN OAN của moduleIdIssues — xem §7.3

**Vì sao id của ta = tên package, KHÔNG phải một id `…gbh-client-cordis-…` khác:** tầng nạp khoá bảng
factory theo **id bundle TỰ KHAI** (`register(registration.id)`), nhưng lúc cấp plugin nó tra
`materialize(id)` với id = **dòng đồ thị = TÊN PACKAGE** (`dsh-client-modules/lib/client.js:807-809`:
`no registered factory for "…"`). Hai id lệch nhau ⇒ entry chết ⇒ mất service. Đo trên 44 gói hai mặt
đang chạy trong repo: **44/44 có `moduleIds[0] === name`**.

Bundle vẫn đăng ký **ĐÚNG MỘT** id (`grep -c 'id: @deepseek-ai' lib/client.js` = **0**); id gốc đi qua
`aliases` và tầng nạp tự sinh entry alias trỏ về **cùng URL**.

## 4. Phương pháp — de-bundle NGUYÊN VĂN (không viết lại bằng tay)

    bun run tools/split-stock-bundle.ts ../../../../apps/host/node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js
    bun run build.ts

1. `tools/split-stock-bundle.ts` cắt bundle gốc thành **11 lát** `src/parts/part-NN.ts` (≤ 1000 dòng/lát;
   dài nhất **886**), cắt ở **mốc `//#region` của chính bundle** và chỉ cắt thêm khi một vùng vượt ngân sách.
   Mỗi mảnh được **đóng/mở lại vỏ ngoặc** bằng hai dòng đánh dấu (`__GBH_FRAGMENT_BEGIN__/END__`) để mỗi lát
   là **module TS hợp lệ**; `src/assemble.ts` **GỠ** đúng hai dòng đó khi ghép ⇒ bản chạy vẫn nguyên văn.
2. `src/manifest.ts` là **nguồn sự thật** duy nhất về thứ tự lát + hai dòng đánh dấu.
3. `build.ts` ghép lại, cho **Bun.build đọc thử** (target browser, cjs) để **quan toà cú pháp** bắt lỗi cắt,
   rồi ghi artifact là **thân NGUYÊN VĂN + vỏ IIFE** — **không** giao thân cho bộ biến đổi của Bun
   (nó gỡ bình luận, đổi tab ⇒ space, tức xoá mất bằng chứng đối chứng từng byte).

**Không có chỗ sửa tay nào** trong thân bundle: cả `var module`, `Object.defineProperty(exports, …)`, các dòng
`require`, các vùng `//#region`, các dòng `exports.X = …` và `return module.exports;` đều đi qua lát.
(So sánh: bản `ui-trajectory` bỏ prelude/đuôi rồi chèn lại bằng tay, nên phép so byte ở đó phải lọc bớt.)

**CSS: 0 khối.** Bundle gốc không nhúng module CSS nào (`const css$N = "…"` = **0**); CSS của *package động*
do `DynamicCordisStyles` chèn lúc chạy (`styles.insert`) — nên `CSS_REPLACEMENTS` rỗng là **đúng**, và test
khẳng định **0 = 0** thay vì bỏ qua phép kiểm.

## 5. Bảng TRƯỚC / SAU — phần đã đo được, phần chưa

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| Thân factory vs bundle gốc | — | **TRÙNG TỪNG BYTE**: 7.402 dòng · 399.565 B · SHA-256 `2c2ceebd…5abe` **=** `2c2ceebd…5abe` |
| CSS | 0 khối | **0 khối** (0 điểm thay thế, artifact không có `__GBH_`) |
| id đăng ký trong bundle | 1 (id stock) | **1** (`@galaxy-blackhole/gbh-cordis-client-runner`); `grep -c 'id: @deepseek-ai'` = **0** |
| `dsh.client` | 4 inject · `web` | **y hệt** |
| entry trong `__DSH_BOOT__` | 1 entry `@deepseek-ai/dsh-cordis-client-runner` | **ĐÃ ĐO trên app 5439** (lượt boot của Lead, 06:44): entry `@galaxy-blackhole/gbh-cordis-client-runner` · inject **đúng 4 id gốc** · `aliases: ['@deepseek-ai/dsh-cordis-client-runner']` · **entry ALIAS id gốc do tầng nạp tự sinh** ⇒ `ui-cordis` (inject id gốc) vẫn activate |
| (5) `did not activate` · (8) `#root` · (8) lỗi console | — | **0** · **66.983 ký tự** · **0 lỗi console** (`check:app`, trang 105.888 B) · (6) **có `gbh-cordis-client-runner`** trong 51 gói CỦA TA đang chạy thật · (9) **KHÔNG ĐẠT vì `span.hHd-Xa_brand*`** — khác biệt của row `ui-brand`, **không** phải row này (row này không vẽ gì) |
| `check:rows` | 63 package · 0 `chan` | **không tăng `chan`** (gói `moved: true` ⇒ 1 dòng `canh bao` "DI CHUYỂN") |
| **export/slot đối chiếu với gốc** (task-16) | — | **KHỚP**: export nửa host `[apply]` · export nửa client **11 tên** = gốc · **slot 99 = 99** (src ta = artifact ta = gốc, không thiếu/thừa) · id tĩnh **1** = tên package ta |
| `bun test tests/host/cordis-client-runner.test.ts` | — | **21 pass / 0 fail / 127 expect** |
| `bun run gate` | — | **XANH 8/8** (header · file-length · jsdoc · dep-guard · parity-matrix · typecheck 1.211 file · hygiene 67 · test) |

## 6. Đối chứng ÂM (bắt buộc — phép so byte phải CHỨNG MINH nó bắt được lệch)

Sửa **đúng 1 ký tự** trong `src/parts/part-05.ts` (``\t\tconst CLIENT_SLOT_API`` ⇒ ``\t\tconst TLIENT_SLOT_API``, byte 504):

| Lượt | Kết quả | Số đo |
|---|---|---|
| đã sửa 1 ký tự | **ĐỎ** | `14 pass / 2 fail` (đo lúc bộ test còn 16 ca) — ca "TRÙNG TỪNG BYTE" + ca "artifact chứa thân NGUYÊN VĂN" + ca đối chứng âm; SHA khác, chuỗi khác, **độ dài BẰNG NHAU** (nên phép so độ dài một mình sẽ **KHÔNG** bắt được) |
| hoàn nguyên (`cp` bản sao lưu) | **XANH** | `16 pass / 0 fail` |

Cùng phép đối chứng đó chạy **trong test** (mục F, ca cuối) bằng cách sửa **trong bộ nhớ** ⇒ tái lập được ở mọi lượt CI.

## 7. Phần CHƯA làm

1. ~~Chưa mount~~ — **ĐÃ mount** trong lượt boot của Lead (06:44: `app.patch.yml` có `- id: cordis-client-runner disabled: true` + `insert: cordis-client-runner-ours`).
   Đo được: `(5)` **0** · `(6)` **có gói** · `(8)` **0 lỗi console** · entry alias id gốc **có** trong payload ⇒ `ui-cordis` activate.
   Việc **còn lại**: `(9)` bố cục ĐỎ vì `span.hHd-Xa_brand*` (row `ui-brand`) — Lead quyết định, **không phải** row này.
2. **Chưa port 10 file `.d.ts`** của bản gốc (`runtime` · `guard` · `evaluator` · `orchestrator` · `api-catalog`
   · `slot-catalog` · `inspect-registry` · `providers` · `timer` · `index`) — bản DI CHUYỂN không ship kiểu.
3. **Nợ kỹ thuật khai báo — NAY ĐÃ ĐÓNG BẰNG TEST (18/10/2026, task-16):** `moved: true` **không phải** "chưa
   viết lại" (gói đã có `src/` + `build.ts`, thân factory byte-identical). Lý do **THẬT**: bundle gốc — và
   nên cả artifact của ta — có **ĐÚNG HAI** lời gọi đăng ký: **(1)** `load({ id: "<tên package>" })` của chính
   bundle, **(2)** `load({ id: moduleId, … })` của `DynamicCordisPackageRunner` (nạp **package động** lúc
   chạy — chính là chức năng của row này). `moduleIdIssues` của `check:rows` đếm **2 ≠ 1** nên báo
   **`chan` oan** nếu khai `moved: false` (đo bằng **chính hàm của cổng**, xem ca H.3 trong test).
   ⇒ Đối chiếu export/slot do **TEST** đảm nhiệm (ca H.1/H.2, đọc cùng phạm vi với cổng); `moved` giữ lại để
   cổng không **bỏ mount oan**. **TRIPWIRE**: khi cổng biết phân biệt `load` động, ca H.3 sẽ **ĐỎ** — lúc đó
   bỏ `moved` và để `check:rows` đối chiếu thật (như `session-inspector` đã làm cùng ngày).

## 8. Lịch sử đo

| Ngày | Việc | Kết quả |
|---|---|---|
| 18/10/2026 | Tạo gói (nửa host + locale) | artifact 5 dòng · export `apply` · id stock trong artifact = **0** |
| 18/10/2026 | **task-16: đối chiếu export/slot** | bảng kỳ vọng dựng từ bundle đang cài: export host `[apply]` ✓ · export client **11 tên** ✓ · **slot 99 = 99** (src = artifact = gốc) ✓ · `moduleIdIssues` đo được **1 `chan` oan** khi bỏ `moved` (2 lời gọi: 1 tĩnh + 1 động) ⇒ giữ `moved` + **tripwire** trong test · **21 pass / 0 fail / 127 expect** |
| 18/10/2026 | De-bundle nửa browser | **11 lát** (dài nhất 886 dòng) · thân factory **399.565 B / SHA-256 `2c2ceebd…5abe`** = bản gốc · CSS **0 = 0** · **18 test / 0 fail** · đối chứng âm **14 pass / 2 fail** ⇒ hoàn nguyên **16 / 0** |
