<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Nửa HOST của row office-to-pdf — nguồn đối chiếu G4, ĐÃ MOUNT 19/10/2026 (kit nạp lười nên boot không cần binary), số đo TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-office-to-pdf (nửa HOST)

Bản viết lại **1:1** phần **HOST** của `@deepseek-ai/dsh-office-to-pdf`: chuyển tài liệu Office
(`doc · docx · xls · xlsx · ppt · pptx`) sang **PDF** qua kit LibreOffice, với **hàng đợi theo thế hệ**, hạn mức
đọc/ghi, **kiểm PDF đầu ra** và **dọn thư mục tạm**.

## 0. TRẠNG THÁI: ĐÃ MOUNT (19/10/2026) — quyết định cuối của Lead

`package.json` khai `gbh.row = { id: "office-to-pdf", moduleIds: ["@galaxy-blackhole/gbh-office-to-pdf"],
aliases: ["@deepseek-ai/dsh-office-to-pdf"], tests: [...] }`; row stock bị `disabled: true` và row của ta được chèn.

**Vì sao mount được dù cần binary ngoài**: `libreoffice-kit` nạp **LƯỜI** trong nhà máy mặc định ⇒ boot không cần
LibreOffice; chỉ lần chuyển đổi ĐẦU TIÊN mới cần binary. Bằng chứng nghiệm thu:

| phép đo | kết quả |
|---|---|
| `lab:row office-to-pdf` | ĐẠT — #root 22.204 · 0 console · 0 pageerror · 0 did-not-activate · overlay 0 |
| mount thật (Lead boot) | `check:app` **11/11 ĐẠT** (135 entry · 46 slot · 0 console · 0 pageerror · 9: 0/80) |
| test A/B | 18 ca / 59 expect (converter GIẢ; máy KHÔNG có LibreOffice) |

**NỢ đã khai**: render THẬT của LibreOffice KHÔNG đo được trên máy này (không có binary) — nếu cần, phải cài
LibreOffice rồi chạy 1 ca chuyển đổi thật. Đường lùi: đổi `gbh.row` → `gbh.row_unmounted_ly_do`.

## 0a. LỊCH SỬ: vì sao từng **KHÔNG** khai `gbh.row` (phương án A — trước khi đổi quyết định 19/10/2026)

| Đo được | Số đo |
|---|---|
| Hình dạng gói | **MỘT MẶT**: `dsh: null`, KHÔNG `exports["./client"]`, KHÔNG `lib/client.js`; có manifest Remote (`typert.host` 266 + `typert.remote-client` 162) |
| **Binary ngoài** | `import { createConverter } from "@deepseek-ai/libreoffice-kit"`; kit **spawn engine native** (`lib/cli.js`: `spawnNative(engine.executable, …)`), phụ thuộc **`koffi` (FFI native)**, `fontkit`, `fflate`, `saxes`; `bin: dsoffice` |
| Máy này | **KHÔNG có LibreOffice** (`which soffice/libreoffice` rỗng, `/Applications/LibreOffice.app` không tồn tại) |
| Row trong dump | **TOP-LEVEL và ĐANG BẬT** (`.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng **661–662**) |

⇒ `gbh.row` **không khai**; `gbh.row_unmounted_ly_do` = *binary ngoài (LibreOffice qua `@deepseek-ai/libreoffice-kit`
có native `koffi`) + peer stock chưa chuyển + row gốc đang bật top-level*. Hệ quả: **0 rủi ro production**.

## 1. Nguồn đối chiếu (G4)

| Hành vi | Bản gốc (`lib/index.js` 659 dòng) | Bản của ta (`src/`) | Bằng chứng |
|---|---|---|---|
| Tập export | `Config · OfficeSourceKey · OfficeToPdf · default · OfficeToPdfError · OfficeToPdfGeneration · OfficeToPdfKey` | **bằng** (7 = 7) | đo trên ARTIFACT |
| Khoá service | `super(ctx, "officeToPdf")` | y nguyên | dựng service |
| Marker Remote | `render` trực tiếp; `getGeneration` xuất tên `generation` | y nguyên | marker + endpoint |
| `Config` | 17 trường, mặc định 2 · 8 · 32 · 100 MiB · 1 · 8 · 128 MiB · 64 · 60 s · 50 MiB · 100 MiB · 192 · 10 000 · 250 MiB · `fontDirectories` · 20 000 · 256 MiB · 512 MiB | y nguyên từng số | `String(Config)` **trùng**; `Config({})` **trùng** |
| Validation constructor | `fontDirectories must contain absolute paths.` · `maxSourceBytes must be at least maxInputBytes.` | y nguyên từng chữ | 2 = 2 |
| Thế hệ | `OfficeToPdfGeneration(randomUUID())`; `getGeneration` `throwIfAborted` rồi trả cùng giá trị | y nguyên | **trùng** |
| `OfficeToPdfError` | `name`/`code`/message/`cause` | y nguyên | **trùng** |
| Ánh xạ lỗi Remote | `gateway/cancelled` khi huỷ · `document-render/failed` + `{reason}` khi `OfficeToPdfError` · thiếu service ⇒ `unavailable` · đuôi lạ ⇒ `unsupported-format` | y nguyên | **trùng** |
| Hàng đợi | `ConversionQueue`: nhận theo `key+version+extension`, khử trùng theo **digest sha256**, chia sẻ một lần chuyển đổi, LRU bộ đệm + bí danh nguồn | y nguyên | 8 ca hành vi |
| Đọc/ghi đĩa | `mkdtemp(join(tmpdir(),"dsh-office-to-pdf-"))`, ghi `source.<ext>` (`wx`, mode 384), `converted.pdf`, **`rm` recursive trong `finally`** | y nguyên | ca "thư mục tạm luôn bị dọn" |
| Kiểm PDF | `readPdf`: `lstat` phải là tệp, mở `O_NOFOLLOW`, trần `maxOutputBytes`, đủ `%PDF-\d\.\d` đầu + `%%EOF` cuối, độ dài khớp `stat` | y nguyên | 3 ca |

## 2. Khác biệt DUY NHẤT so với bản gốc: nhà máy bộ chuyển đổi được TIÊM

Bản gốc `import { createConverter }` **tĩnh**. Gói này nạp **ĐỘNG** trong nhà máy mặc định:
`(await import("@deepseek-ai/libreoffice-kit")).createConverter(options)` — chạy thật thì y nguyên, nhưng đường
test **tiêm được bộ chuyển đổi GIẢ** (máy này không có LibreOffice). Tham số thứ ba của constructor là tuỳ chọn;
bỏ trống ⇒ đúng hành vi gốc.

## 3. Peer — có MỘT **ngoại lệ có ghi chú**

| Peer | Vì sao |
|---|---|
| `@deepseek-ai/cordis` | lớp `Service`/`Context` — **chỉ mượn kiểu** |
| `@deepseek-ai/dsh-brand` | `brandString` — **nạp lúc chạy** |
| `@deepseek-ai/dsh-typert-protocol` | `Remote`/`RemoteError`/`TypertRemoteService` — **nạp lúc chạy** |
| `@deepseek-ai/schemastery` | `z.object` của `Config` — **nạp lúc chạy** |
| **`@deepseek-ai/libreoffice-kit`** | **NGOẠI LỆ CÓ GHI CHÚ (tiền lệ fflate/task-23)**: kit **chưa chuyển** sang GBH, lại có **native `koffi`**; gói này **KHÔNG mount** nên kit **không bao giờ vào profile**. Mount (nếu sau này) **buộc** mang kit native ⇒ chỉ làm khi Lead quyết riêng |

`dependencies` **RỖNG** (mọi phụ thuộc là peer, đúng luật mount).

## 4. Test — 18 ca · 59 expect · 0 fail

```bash
~/.bun/bin/bun test tests/host/office-to-pdf.test.ts
```

**Nhóm A/B (CẢ HAI bản trên Context cordis THẬT — an toàn vì bộ chuyển đổi tạo LƯỜI):** tập export (7 = 7) ·
`Config` (chuỗi schema + 17 mặc định) · thế hệ · validation constructor · `OfficeToPdfError` · **ánh xạ lỗi
Remote** (thiếu service ⇒ `unavailable`, đuôi lạ ⇒ `unsupported-format`).
**Nhóm HÀNH VI (bản của ta + bộ chuyển đổi GIẢ):** thành công + dọn thư mục tạm · không phải PDF/thiếu `%%EOF` ⇒
`invalid-output` · vượt `maxOutputBytes` ⇒ `output-too-large` · mã engine `timeout` giữ nguyên, mã lạ ⇒
`failed` · `input-too-large` · `source-changed` · **bộ đệm theo nội dung** (2 đọc → 1 chuyển đổi, PDF là bản
sao độc lập) · `busy` · huỷ giữa chừng + huỷ trước khi gọi · dọn provider ⇒ `unavailable` · đồng thời 1 ⇒ chạy
**tuần tự** · thư mục tạm **luôn** bị dọn kể cả khi engine ném.

## 5. TRƯỚC / SAU + nợ kỹ thuật

| | TRƯỚC (row gốc, đang bật) | SAU (gói này) |
|---|---|---|
| Row trong app | `office-to-pdf` (top-level, **đang bật**) | **không mount** — không khai `gbh.row` |
| Nửa host | `lib/index.js` **659** dòng | **`src/` 7 tệp**: `service` · `queue` · `output` · `identity` · `errors` · `types` · `index` |
| Tập export | 7 tên | **bằng** (7 = 7) |
| Test | — | **18 pass / 0 fail / 59 expect** |

**CHƯA làm (nợ, nói thẳng)**
1. **Render THẬT của LibreOffice KHÔNG đo được** trên máy này ⇒ mọi ca chuyển đổi dùng bộ chuyển đổi GIẢ.
2. **Mount** cần kit native trong profile + quyết định riêng của Lead.
3. `declare module` khai `RemoteErrorDetailsMap['document-render/failed']` chưa được thay bằng cơ chế có kiểu
   (repo cấm `declare module`) — hiện dựng qua helper `documentRenderFailure()`.
