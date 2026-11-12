<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-session-stats — bảng nguồn đối chiếu G4, lý do peer, TRƯỚC/SAU, phần chưa làm
-->

# @galaxy-blackhole/gbh-session-stats

Bản viết lại của Galaxy Blackhole cho **MỘT row HOST** của DSH: `session-stats` —
`@deepseek-ai/dsh-session-stats` (**198 dòng**, **một mặt**, **ĐANG BẬT** trong oracle).

Vai trò: **thống kê phiên** — đơn vị chiếu `sessionStats` gộp TOÀN BỘ log phiên thành số đếm lượt/bước
và bốn loại thời gian tường (mô hình · công cụ · token đầu · giải mã), phục vụ qua seam
`ctx.sessionProjections`. Plugin chỉ sở hữu **phép gộp**; việc phát (ảnh chụp sổ đăng ký, kênh thay
đổi, mọi vật mang chiếu) là của seam.

## 1. Bảng nguồn đối chiếu (G4)

| Mục | Giá trị |
|---|---|
| Gói upstream | `@deepseek-ai/dsh-session-stats` **0.2.1-alpha.4** |
| Đường dẫn bản gốc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-session-stats/` (`lib/index.js` 198 dòng · `lib/types/*.js` · `lib/types/*.d.ts` · `locale/{en,zh}.json`) |
| Mức dẫn xuất | **viết lại theo HÀNH VI** — không chép code. Đọc `.d.ts` + `lib/*.js` để nắm phép gộp, rồi viết lại theo từng nhánh, có **đối chứng A/B từng bước** với chính bundle gốc |
| Khoá chiếu | `sessionStats` — **nguyên văn** (client đọc đúng khoá này) |
| `stateVersion` | `1` — nguyên văn |

### Bước 0 — dữ kiện đo trước khi tạo gói

| Phép kiểm | Kết quả |
|---|---|
| Cặp row trong `ours.yml` **mới nhất** (`.parity/dumps/2026-10-18T01-31-57`, dòng 536–537) | `- id: session-stats` + `name: '@deepseek-ai/dsh-session-stats'` — **có thật** |
| `config:` gốc của row | **KHÔNG CÓ** — đoạn row chỉ có đúng dòng `name` (không `config`, không `!!js …`), **không** `disabled` ⇒ **đang BẬT** |
| `lib/client.js` của gói gốc | **KHÔNG TỒN TẠI** (`lib/types/client.js` chỉ là `export {}`, 10 dòng, không có `__ModuleLoader__`) ⇒ **MỘT MẶT** |
| `dsh.client` trong manifest gốc | **không có** |

## 2. Vì sao peer — và vì sao đúng hai peer

`gbh.peers` = `peerDependencies` = **2 tên** (`gbh.peers ⊆ peerDependencies`, so **PHẦN TỬ**):

| Peer | Bậc trong §3b | Lý do ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/dsh-llm` | 2 (seam DSH) | Phép gộp **GỌI THẬT** `assistantStreamFirstTokenTime(stream)` của kernel để đọc mốc token đầu trong dòng gói đã nén. Đây là hàm **dựng lại mốc thời gian của cụm delta** (`time0` + cộng dồn `dt`, và cụm `tool-call-chunks` **có tên** thì lấy `time0`): một **bản sao** sẽ lệch ngay khi kernel đổi cách đóng gói run, mà **cổng không thấy** (số đo vẫn "hợp lý"). Cùng một hàm ⇒ số liệu khớp tuyệt đối với phép gộp cửa sổ của client, thứ mà bản gốc tuyên bố phản chiếu từng trường. |
| `@deepseek-ai/dsh-session-projection` | 2 (seam DSH) | Row **đăng ký vào** `ctx.sessionProjections` — seam này do gói đó cấp; `inject: ["sessionProjections"]` là **toàn bộ mục đích** của plugin. Bản gốc cũng khai đúng peer này. |

Không có peer nào ngoài bảng. `zod` là **`dependencies`** (thư viện thường — bậc 3 của §3b), không
phải peer: **1 thể hiện duy nhất** không phải điều kiện sống còn ở đây (schema chỉ dùng trong tiến
trình host), và đây là quy ước đang chạy của 7 gói host khác trong repo.

⚠️ **Nhắc người sau**: `gbh.peers` là danh sách **mount.ts symlink từ kernel vào profile** — thêm một
peer không có trong `apps/host/node_modules` ⇒ mount báo `thieu peer trong kernel` và **không mount**.

## 3. Hình dạng gói (một mặt, host-only)

| File | Vai trò |
|---|---|
| `src/index.ts` | `name` = `"session-stats"` · `inject` = `["sessionProjections"]` · `apply` đăng ký MỘT đơn vị chiếu |
| `src/projection.ts` | Phép gộp: schema trạng thái/khung nhìn, tám tổng + ba ranh giới đang bay, chuyển tiếp từng loại sự kiện |
| `src/types.ts` | Từ vựng của miền — khai **theo CẤU TRÚC** cho seam `sessionProjections` và sự kiện phiên (`SessionEvent`), chỉ **import KIỂU** `AssistantStreamRecord` từ `dsh-llm` |
| `build.ts` | Build ESM một file; **nhận thư mục đích qua `process.argv[2]`** (mount.ts truyền `<profile>/lib`) |
| `locale/{en,zh}.json` | **Chép byte-for-byte** từ bản gốc (luật 000e) — sha256 khớp, có khoá `meta.title` |

**Tập export = tập export gốc**: `{ apply, inject, name }` — đo trên **ARTIFACT** (`lib/index.js`
đã build) của **cả hai bên**, không đọc báo cáo.

Vì sao **không** ship `./types` và `./client` như bản gốc: hai lối đó **thuần kiểu** (`export {}` lúc
chạy) phục vụ `client aggregate`; gói ta là **một mặt**, không ai `import` chúng, còn bản gốc vẫn
nằm nguyên trong kernel cho consumer của nó. Đây là khác biệt **có chủ ý**, không phải thiếu sót.

## 4. Bảng TRƯỚC/SAU

Phép đo **cùng một lệnh**, cùng một home; row chỉ **thay thế 1-1** (không thêm entry) nên `(6)`/`(10)`
**không đổi** — đọc đúng bốn phép xác nhận từng row của `M6-MOUNT-PLAN.md` §3.

| Phép đo | TRƯỚC (row stock) | SAU (row của ta) |
|---|---|---|
| Sự kiện `step/end` trong một lượt | `turns` +1 cho lượt mới, `steps` +1 mỗi bước | **y hệt** (A/B từng bước, 23 sự kiện) |
| Bước bị huỷ (không lắp tin) | `steps` +1, **không** cộng `llmMs`/`ttftMs` | **y hệt** |
| Mốc token đầu trong cụm đóng gói | `time0` + `dt` dồn (có tên ⇒ `time0`) | **y hệt** — cùng một hàm của kernel |
| `usage.outputTokens` hỏng | bỏ qua ⇒ không `decodeMs` | **y hệt** (5 dạng) |
| callId trùng tên prototype (`constructor`) | đọc là **không khớp** ⇒ `toolMs` không thành `NaN` | **y hệt** |
| Câu lỗi schema | — | **cùng câu, cùng lớp** (7 dạng hỏng) |
| Khoá chiếu trên dây | `sessionStats` | **nguyên văn** |

Lệnh tái lập:

```bash
cd <repo>
bun test tests/host/session-stats.test.ts      # 22 ca / 185 expect, 0 fail
cd packages/host/session-stats && bun run build.ts && grep -c 'id: @deepseek-ai' lib/index.js   # = 0
```

## 5. Trạng thái khai `gbh.row` và phần CHƯA làm (nói thẳng)

1. **`gbh.row` do LEAD khai, KHÔNG do phiên viết gói.** Phiên này nhận chỉ đạo *"chưa khai `row`"*
   và đã giữ đúng như vậy; khoá row xuất hiện lúc **08:41:42 ngày 18/10/2026** trong commit
   `d745518` của Lead, với hình dạng **`{ id: "session-stats", tests: [...] }`** — **KHÔNG `config`**
   (khớp dữ kiện `config` gốc **KHÔNG CÓ**, ca 0a), **KHÔNG `moduleIds`/`aliases`** (row một mặt,
   không có id bundle nào). Bản nháp của ca 0c (*"chưa khai row"*) đã được Lead gỡ cùng lúc khai —
   đúng quy trình: khai row là việc của Lead; ca 0c nay canh **HÌNH DẠNG khai báo** đó (và canh ba
   khoá KHÔNG được thêm).
2. **Lượt boot/mount là của Lead** — đo được *trong commit của Lead*: `(b)` cặp patch **id=2**
   (disable + insert) và `(c)` thư mục profile có gói. Đây **không phải** phép đo của phiên viết gói;
   phiên này chỉ đọc lại được hai dấu hiệu tĩnh đó.
3. **CHƯA đo `(5)` `did not activate` · `(8)` `#root` · `check:app` cho row này** — row host không
   chạm UI, nhưng điều đó chỉ chứng minh được bằng một lượt boot do Lead đọc.
4. **CHƯA chạy `parity:dump` sau mount** — kỳ vọng `THÊM 0 · THIẾU 0 · ĐỔI 0` và "đã thay N row"
   +1; thuộc lượt của Lead.
