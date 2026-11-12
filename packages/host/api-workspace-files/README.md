<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc NỬA HOST của row workspace-files — nguồn đối chiếu G4, lý do CHỈ nửa host + KHÔNG khai gbh.row,
      bảng hành vi TRƯỚC/SAU, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-api-workspace-files (NỬA HOST)

Bản viết lại **1:1** phần **HOST** của `@deepseek-ai/dsh-api-workspace-files`: dịch vụ `workspaceFiles` —
**đọc trước tệp** theo dòng hoặc theo byte, **thống kê**, **liệt kê thư mục** trong workspace, và **dòng thay
đổi** của một đích, trên **seam filesystem của kernel**. Dịch vụ này **KHÔNG có phép ghi nào**.

## 0. Vì sao CHỈ nửa host và **KHÔNG** khai `gbh.row`

Row `workspace-files` **đang BẬT** trong app (`.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng 555–556,
KHÔNG `disabled`) và gói gốc là gói **HAI MẶT**:

| Bằng chứng đo được | Số đo |
|---|---|
| `package.json.dsh.client` | `inject: [@deepseek-ai/dsh-api-gateway, @deepseek-ai/dsh-client-resources]` · `platform: web` |
| Nửa client | `lib/client.js` **479** dòng + `lib/types/client/*` |
| Manifest Remote | `lib/typert.host.js` **571** + `lib/typert.remote-client.js` **460** |
| Tổng gói gốc | **~2.733** dòng (host ~1.223) |

Cặp `disable + insert` của tầng mount sẽ **xoá nửa client khỏi đồ thị boot** (sự cố có thật của
`typert-gateway`: 63 entry pending, trang còn **68 B**) ⇒ gói này **chỉ khai nửa host**, **KHÔNG khai
`gbh.row`** ⇒ **không thể được mount** ⇒ không thể làm hỏng app của người khác.

**Kiểm trùng tên TRƯỚC khi viết**: không package GBH nào khác cấp khoá service `workspaceFiles`; gói này
giữ đúng khoá đó, đúng 5 marker Remote (`read` · `readBytes` · `stat` · `list` trực tiếp, `changes` stream).

## 1. Nguồn đối chiếu (G4)

| Hành vi | Bản gốc (`lib/index.js`) | Bản của ta (`src/`) | Bằng chứng |
|---|---|---|---|
| Tập export | `WorkspaceFiles · default` | **bằng** (2 = 2), `default === WorkspaceFiles` | đo trên ARTIFACT |
| `inject` | `["fs","sandboxPolicy","sessions","typert"]` | y nguyên | mảng bằng nhau |
| Schema `Config` | 4 trần có mặc định: 2 MiB · 32 MiB (max `MAX_SAFE_INTEGER-1`) · 5 000 dòng · 2 000 mục | y nguyên | `String(Config)` trùng |
| Marker Remote | `read`/`readBytes`/`stat`/`list` trực tiếp; `changes` **stream** | y nguyên | `remoteMethods()` trả **cùng** mảng |
| Bộ tra cứu `workspaceFileScope` | `parameter/wire/resource/hostTypeSymbol/wireTypeSymbol` + resolve: đầu mục SỐNG → đầu mục ĐÃ LƯU → `undefined`; `workspaceRoot = cwd ?? sandboxPolicy.workspaceRoot` | y nguyên | mô tả + 3 đường giải **bằng** |
| `read` | trang theo dòng: mặc định offset 1/limit `maxLines`, cắt **sớm** khi byte vượt `maxBytes`, NUL ⇒ `not-text`, trả `absolutePath/version/bytes/offset/text/lines/eof` | y nguyên | 3 trang + 5 lỗi **bằng** |
| `readBytes` | cửa sổ byte (EOF theo `offset+len >= size`) hoặc cả tệp dưới `maxFileBytes` (`FS_TOO_LARGE` ⇒ `too-large`); `baseFile` giải tương đối và TỪ CHỐI đường tuyệt đối | y nguyên | 4 kết quả + 3 lỗi **bằng** |
| `stat` | tệp **ngoài** workspace vẫn đọc được (đọc tệp không bị giữ trong workspace) | y nguyên | 2 kết quả **bằng** |
| `list` | **giữ trong workspace**, gốc ⇒ `path: ""`, cắt theo `maxEntries` + `truncated`, không phải thư mục ⇒ `not-directory`, ngoài workspace ⇒ `outside-workspace` | y nguyên | 4 kết quả **bằng** |
| `changes` | `ready` → `change` cho **đúng** đích (bỏ mất hiệu lực của đích khác) → `absent: true` khi đích mất; thư mục ngoài workspace ⇒ `outside-workspace` | y nguyên | 2 ca **bằng** |
| Vòng đời | `effect` nhãn `workspace-files.changes` đóng **mọi** thế hệ khi fiber dọn | y nguyên | nhãn + dòng kết thúc **bằng** |

## 2. Peer và lý do

| Peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 (kernel) | kiểu `Context` — **chỉ mượn kiểu** |
| `@deepseek-ai/dsh-deque` | 2 (tiện ích hạ tầng) | `Deque` cho hàng đợi quan sát — **nạp lúc chạy** |
| `@deepseek-ai/dsh-typert-protocol` | 2 (seam RPC) | `Remote`/`RemoteError`/`TypertRemoteService` — **nạp lúc chạy** |
| `@deepseek-ai/schemastery` | 1 (kernel) | `z.object` của `Config` — **nạp lúc chạy** |

⇒ `gbh.peers` = 3 tên **⊆ `peerDependencies`**; `dependencies` **RỖNG**. Seam `ctx.fs` · `ctx.sandboxPolicy` ·
`ctx.sessions` · `ctx.typert` · `inject`/`on`/`effect`/`logger` khai **theo CẤU TRÚC** trong `src/seams.ts`.

**Bảy mã lỗi** (`workspace-file/not-found` …) ở bản gốc khai bằng `declare module` trên
`RemoteErrorDetailsMap`; repo này **cấm `declare module`** (luật 000d) ⇒ gói dựng lỗi qua **MỘT** helper
`remoteFailure()` trong `src/page.ts` (ép kiểu tại đúng một chỗ, giữ nguyên lớp/mã/thông điệp/chi tiết/`cause`).

## 3. Test — 14 ca · 49 expect · 0 fail

```bash
~/.bun/bin/bun test tests/host/api-workspace-files.test.ts
```

Giàn đo: **Context cordis THẬT** + **filesystem GIẢ điều khiển được** (resolve/lstat/stat/listDir/readBytes/
readByteRange/streamText/watch/contains/fileUrl/processPath + phát `fs/observed`), sổ phiên giả (đầu mục SỐNG
và ĐÃ LƯU), và `inject` cấp đúng bộ phụ thuộc. **Cùng một giàn** cho bản của ta và **bundle gốc** ⇒ mọi khác
biệt quy được về **ruột gói**.

| Nhóm | Số ca | Đo cái gì |
|---|---|---|
| Bề mặt + dựng service | 3 | export (2 = 2) · `inject`/`Config`/5 marker · bộ tra cứu (mô tả + 3 đường giải) |
| `read` | 3 | 3 trang (mặc định/cửa sổ/quá cuối) · 5 lỗi · NUL + nhị phân + trần byte |
| `readBytes`/`stat`/`list` | 4 | cả tệp/cửa sổ/EOF/tệp gốc tương đối · 3 lỗi · tệp NGOÀI workspace · cắt mục + 2 lỗi |
| `changes` | 2 | `ready`→`change`→`absent` + bỏ đích khác + watcher + nhãn hiệu ứng · thư mục ngoài workspace |
| Quy ước repo | 2 | **không `gbh.row`** + 4 đối chứng dương gói HAI MẶT · peers/dependencies |

**Bug của CHÍNH TÔI đã bắt được nhờ ca treo (ghi lại để người sau tránh):** khi thay `new RemoteError(…)` bằng
helper bằng `sed`, chính **thân** helper cũng bị thay ⇒ `remoteFailure → remoteFailure` **đệ quy vô hạn**
(CPU 97%, test treo, không có thông điệp). Đã sửa thành `return new RemoteError(…)` **trong** helper và giữ
một dòng chú thích cấm gọi lại chính nó.

## 4. TRƯỚC / SAU

| | TRƯỚC (row gốc, đang bật) | SAU (gói này) |
|---|---|---|
| Row trong app | `workspace-files` = `@deepseek-ai/dsh-api-workspace-files` (bật, hai mặt) | **không mount** — chưa khai `gbh.row` |
| Nửa host | `lib/index.js` 637 + `lib/types/index.js` 402 + `lib/types/changes.js` 168 | **`src/` 6 tệp** (`service` · `changes` · `page` · `types` · `seams` · `index`), cùng bề mặt host |
| Tập export | 2 tên | **bằng** (2 = 2) |
| Test | — | **14 pass / 0 fail / 49 expect** |
| `grep -c 'from "@deepseek-ai/cordis"'` trên artifact | — | **0** |

## 5. Phần CHƯA làm (nói thẳng)

1. **Nửa client** (`lib/client.js` 479 + `lib/types/client/*`) và **manifest Remote** (`typert.host` 571 +
   `typert.remote-client` 460) — chưa có ⇒ **không mount được**.
2. `declare module` khai `TypertLookupMap` + `RemoteErrorDetailsMap` của bản gốc chưa được thay bằng cơ chế
   tương đương có kiểu (hiện ép kiểu tại một chỗ) — cần khi nối Gateway.
3. Chưa đo hành vi thật qua Gateway (cần nửa client + `dsh-api-gateway` đã chuyển).

## 7. Bản viết tay cũ (giữ lại 19/10/2026)

Trước khi de-bundle lại theo khuôn `api-session-controller` (4 artefact + cổng byte/ownership), gói này được port **viết tay**
bằng 6 module trong `src/` (`changes.ts` 225 · `index.ts` 15 · `page.ts` 165 · `seams.ts` 237 · `service.ts` 405 · `types.ts` 132 dòng).
Theo quyết định của Lead (giữ công người trước, không xoá), toàn bộ bản viết tay được **chuyển nguyên văn vào `src-handwritten/`** —
**không được build**, không nằm trong artefact, chỉ để tham chiếu/lịch sử. Lý do chuyển: artefact phải là bản ghép NGUYÊN VĂN từ bundle
gốc (byte-identical/ownership-identical) để đạt chuẩn parity; bản viết tay tuy 1:1 về hành vi nhưng không có cổng byte.
