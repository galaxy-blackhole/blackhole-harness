<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row job-controller — NỬA HOST: nguồn đối chiếu G4, lý do peer,
      vì sao CỐ Ý không khai gbh.row (gói hai mặt), bằng chứng đo được, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-api-job-controller (NỬA HOST)

Bản viết lại **nửa Host** của row `job-controller` trong profile `blackhole`.
Row stock: `job-controller` → `@deepseek-ai/dsh-api-job-controller` (**HAI MẶT**).

## 0. Vì sao gói này CỐ Ý **KHÔNG** khai `gbh.row` (số đo, không phải ý thích)

| Câu hỏi (HOST-ROW-REWRITE §0) | Đo được | Kết luận |
|---|---|---|
| Bản gốc có `dsh.client`? | **CÓ** — `inject: ['@deepseek-ai/dsh-api-gateway', '@deepseek-ai/dsh-client-connection']`, `external: ['@deepseek-ai/dsh-api-gateway/client']`, `platform: web` | **HAI MẶT** |
| Bản gốc có `./client` export? | **CÓ** — `exports['./client'] = ./lib/client.js` (**366 dòng** + `lib/types/client/*` **366 dòng**) | thiếu nửa client ⇒ cặp disable+insert **xoá nửa client khỏi đồ thị boot** |
| Có manifest Remote? | `lib/typert.host.js` **316** + `lib/typert.remote-client.js` **219** dòng (subpath `./typert` + `./remote`) | client gọi RPC qua manifest này |
| Tổng | host 377 + types 362 + typert 316 + remote 219 + client 366 + client-types 366 = **~2.006 dòng** | **không phải "378 dòng"** |

⇒ Sự cố đã có tiền lệ: thay row `typert-gateway` ⇒ mất nửa client của gói khác ⇒ **63 entry pending**, trang teo
từ 48.882 B xuống **68 B**. Vì vậy gói khai `gbh.peers` + `gbh.tests` mà **KHÔNG** có `gbh.row`
(`gbh.draft` ghi rõ) ⇒ **không thể được mount** ⇒ **không thể làm hỏng app của người khác**.

**22b (wave sau, sau `dsh-api-gateway`)**: nửa client + manifest remote + mount.

## 1. Nguồn đối chiếu (G4) — NỬA HOST

| Hành vi | Bản gốc (`lib/index.js` + `lib/types/*`) | Bản của ta (`src/`) | Bằng chứng |
|---|---|---|---|
| Tên service + namespace | `super(ctx, "jobController", { namespace: "job" })` | y nguyên | marker + khoá service bằng nhau (test) |
| Seam bắt buộc | `static inject = ["jobs", "typert"]` | y nguyên | mảng bằng nhau (test) |
| Schema `Config` | `observeFlushMs` (natural ≥1, default 100) · `observeMaxFrameBytes` (natural ≥1, default 65536) | y nguyên | `String(Config)` trùng; mặc định trùng; 3 ca sai ra cùng thông điệp |
| Marker Remote | `@Remote({mode:"stream"})` cho `list`/`follow`, `@Remote("kill")` | y nguyên (decorator chuẩn stage-3 của kernel) | `remoteMethods()` cho cùng danh sách marker + mode |
| `list` | khung `rows` đầu = `registry.list(sessionId)`; đánh thức bởi sự kiện vòng đời (KHÔNG bởi `output`); gộp qua `flushMs` | y nguyên | 1 ca A/B so **từng khung**; ca chứng minh sự kiện `output` **không** đánh thức |
| `follow` | neo `opened` + khung `output` (trần byte MỀM) + `status` cuối; `from` sai ⇒ ném | y nguyên | 4 ca A/B: khung, trần byte, `lossy`, job bị xoá giữa thế hệ |
| `kill` | tra có hàng rào ⇒ chuyển `kill(id, sessionId, "cancelled by the user")`; hỏng ⇒ `RemoteError("job/not-found", …)` | y nguyên | 2 ca A/B (thành công + không tìm thấy, kèm `details`) |
| Tập export | `JobController` + `default` | **bằng** (2 = 2) | đo trên ARTIFACT |
| Dọn listener | `unsubscribe()` trong `finally` của cả hai generator | y nguyên | ca đếm `unsubscribe` = 1 sau khi đóng thế hệ |

## 2. Peer và lý do (bảng §3b)

| Peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 (kernel) | kiểu `Context` + lớp `Service` — **chỉ mượn kiểu** (bị xoá lúc build) |
| `@deepseek-ai/schemastery` | 1 (kernel) | `z.object` của `Config` — **nạp lúc chạy** |
| `@deepseek-ai/dsh-typert-protocol` | 2 (seam, tiền lệ `message-feedback` · `settings-controller` · `typert-gateway`) | `Remote` · `RemoteError` · `TypertRemoteService` — **nạp lúc chạy**; decorator ghi metadata lên **prototype** nên phải là **CÙNG một thể hiện** với gateway đọc marker |
| `@deepseek-ai/dsh-jobs` | 2 (bảng §3b có `dsh-jobs`) | kiểu `JobRegistry`/`JobView`/`JobChunk` + seam `ctx.jobs` — **chỉ mượn kiểu** |
| `@deepseek-ai/dsh-session` | **ngoài bảng** (tiền lệ `approval` · `message-feedback` · `workflow`) | kiểu `SessionId` — **chỉ mượn kiểu** |

⇒ `gbh.peers` = 3 tên (ba peer ngoài hai peer tự động `cordis`/`schemastery`), **⊆ `peerDependencies`**;
`dependencies` **RỖNG**.

## 3. Test — 14 ca · 68 expect · 0 fail

```bash
~/.bun/bin/bun test tests/host/api-job-controller.test.ts
```

| Nhóm | Số ca | Đo cái gì |
|---|---|---|
| Bề mặt trên ARTIFACT | 3 | tập export ta = gốc (2 = 2) · `inject` + `String(Config)` + mặc định · **marker `@Remote`** trên prototype trùng gốc |
| `list` | 2 | khung đầu = tập nhìn thấy (job của phiên + job KHÔNG chủ, KHÔNG có job phiên khác) · sự kiện `output` **không** đánh thức, sự kiện vòng đời **có** · huỷ trước ⇒ **ném AbortError** |
| `follow` | 4 | neo + trần byte MỀM + `status` cuối · `from` sai ⇒ đúng thông điệp · `lossy` một lần · job bị xoá giữa thế hệ ⇒ đóng bằng `status` của job đã xoá |
| `kill` | 2 | chuyển đúng id/phiên/lý do, trả `requested` · `RemoteError` mã `job/not-found` + `details` |
| C6 danh tính + quy ước | 3 | hai thực thể trên **hai Context riêng** không chia sẻ bộ nghe · **không khai `gbh.row`** (đối chứng dương: bản gốc CÓ `dsh.client` + `./client`) · `gbh.peers ⊆ peerDependencies` |

**Giàn đo**: mỗi bên cài chạy trên **Context cordis THẬT** bọc Proxy đắp `jobs` (sổ job giả **điều khiển
được**: phát sự kiện, đổi vòng đệm) + `typert` + `logger`; **cùng một giàn** cho bản của ta và bản gốc
⇒ mọi khác biệt quy được về **ruột gói**.

## 4. TRƯỚC / SAU

| | TRƯỚC (bản gốc) | SAU (nửa host này) |
|---|---|---|
| Vai trò | row `job-controller` đang chạy (hai mặt) | **chưa mount** — nửa host đã có, **chưa** có nửa client |
| Tập export trên artifact | `JobController · default` | **bằng** (2 = 2) |
| `grep -c "from @deepseek-ai/cordis"` | — | **0** (chỉ mượn kiểu) |
| Test | — | **14 pass / 0 fail / 68 expect** |
| `check:rows` | — | không áp dụng (không khai `gbh.row`) |

## 5. Phần CHƯA làm (nói thẳng)

1. **Nửa client** (`lib/client.js` 366 dòng + `lib/types/client/*` 366 dòng) — chính sách job-output đếm
   tham chiếu phía trình duyệt.
2. **Manifest Remote** (`./typert` 316 dòng + `./remote` 219 dòng) — sinh bởi codegen của kernel; ta phải
   quyết định: sinh lại bằng codegen hay khai tay, **sau khi** có `dsh-api-gateway` + quy ước manifest.
3. **Mount + lab/boot**: chỉ sau (1)+(2) — cặp disable+insert lúc đó mới không xoá nửa client.
4. Hành vi **thật** với trình duyệt (`list`/`follow` qua RPC) chưa đo được — hiện chỉ đo **tầng service**
   bằng sổ job giả trên Context thật.

## 7. Bản viết tay cũ (giữ lại 19/10/2026)

Trước khi de-bundle lại theo khuôn `api-session-controller`, gói này được port **viết tay** 5 module trong `src/`
(`index` · `observe` · `rows` · `types` · `wake`). Nay toàn bộ được **chuyển nguyên văn vào `src-handwritten/`** —
không build, không nằm trong artefact, chỉ để tham chiếu (quyết định của Lead: không xoá công người trước).

## 8. Cạm bẫy ĐO ĐƯỢC (19/10/2026)

`lib/client.js` gốc có **4** lần chuỗi id stock nhưng **chỉ dòng 2 (loader)** là id module; 3 lần còn lại là JSDoc
`@module` (dòng 16 `…/client/model`, 189 `…/client/service`, 344 `…/client`) ⇒ phải giữ nguyên văn. Cổng ownership vì vậy
kiểm **số lần id của ta = số chỗ đã đổi** (`CLIENT_ID_REPLACEMENTS = 1`, `TYPERT_HOST_ID_REPLACEMENTS = 11`,
`TYPERT_REMOTE_ID_REPLACEMENTS = 10`) chứ không dùng luật “không còn id stock”.
