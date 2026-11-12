<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguon doi chieu (G4) + ly do peer + bang TRUOC/SAU cua @galaxy-blackhole/gbh-session-telemetry-otel
-->

# @galaxy-blackhole/gbh-session-telemetry-otel

Bản viết lại của Galaxy Blackhole cho **gói gốc `@deepseek-ai/dsh-session-telemetry-otel`** — nhà cung cấp
**OpenTelemetry** cho năng lực **telemetry phiên**: cấp phép thu log theo **phản hồi tường minh**, dựng đường ống
SDK **chặn byte** qua seam `ctx.otel`, và giữ **hạn chót tắt ngoài cùng** của chính backend.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Giá trị |
|---|---|
| Gói gốc | `@deepseek-ai/dsh-session-telemetry-otel` **0.2.1-alpha.4** |
| Đường dẫn CHỈ ĐỌC đã đọc | `apps/host/node_modules/@deepseek-ai/dsh-session-telemetry-otel/lib/index.js` (**212 dòng**) |
| Từ vựng kiểu gốc | `…/lib/types/index.d.ts` (162 dòng) |
| Mức dẫn xuất | **Viết lại theo hành vi** — không chép code; mọi kết luận dưới đây đo trên **artifact** của cả hai bên |
| `locale/` | **CÓ** (`en.json` 58 B · `zh.json` 155 B) ⇒ **000e áp dụng**: chép **byte-for-byte** (`shasum` khớp `6d12499…` / `24354799…`) |
| `dsh.client` | **KHÔNG có** (câu hỏi 5) · **`lib/client.js` KHÔNG tồn tại** ⇒ row **MỘT MẶT** |

## 2. Năm câu hỏi bắt buộc (mục 0 của recipe)

| # | Câu hỏi | Trả lời ĐO ĐƯỢC |
|---|---|---|
| 1 | Row này có đang BẬT không? | **CÓ** trong dump mới nhất `.parity/dumps/2026-10-18T01-31-57/ours.yml` (dòng 181–182: `- id: session-telemetry-otel` + `name: '@deepseek-ai/dsh-session-telemetry-otel'`). Ở **cấu hình đang chạy** nó bị **patch của profile** đặt `config.mode = DISABLED` — xem §3. |
| 2 | Thuần host hay có mount surface client? | **Thuần host.** `lib/` chỉ có `index.js` + `types/`; **không** `lib/client.js`, **không** `loader.create/resolve`, **không** một lời gọi `__ModuleLoader__.load` nào. |
| 3 | Cần seam nào? | `extends SessionTelemetryBackend` (⇒ `extends Service` của cordis) · `SessionTelemetryCoordinator` · `Session` (`dsh-session`) · `APP_IDENTITY` (`dsh-llm`) · `getOrCreateAnonymousUserId` (`dsh-anonymous-user-id`) · `SeverityNumber` (`@opentelemetry/api-logs`) · seam **`ctx.otel`** (`dsh-otel`, đúng bảng §3b) · `schemastery`. Lý do từng cái ở §4. |
| 4 | Hành vi đo được là gì? | (a) đăng ký dịch vụ tên **`sessionTelemetry`**; (b) `sharing` = `feedback-only` \| `disabled`; (c) **chỉ** phản hồi canonical của CHÍNH phiên mới cấp phép thu; (d) mỗi bản ghi ⇒ **đúng một** `reportSessionLog` với `severityNumber` đã ánh xạ + `attributes` của coordinator; (e) `shutdown()` **từ chối ĐÚNG hạn chót** và gọi `stopPending()`; (f) **không** một dòng log nào khi ở `DISABLED` ngoài cảnh báo "không tải lên". |
| 5 | Package gốc có `dsh.client` không? | **KHÔNG.** `package.json` gốc **không có khoá `dsh`**; `ls lib/` ⇒ chỉ `index.js` + `types/`. |

## 3. `config:` gốc — nguyên văn

**Bản upstream** (`oracleA_nopatch.yml` dòng 115–131) — **có `!!js`**:

```yaml
- id: session-telemetry-otel
  name: '@deepseek-ai/dsh-session-telemetry-otel'
  config:
    mode: !!js process.env.DSH_TELEMETRY_MODE || 'FEEDBACK_ONLY'
    shutdownTimeoutMillis: 3000
    maxRequestBytes: 4000000
    exporter:
      url: !!js >-
        process.env.DSH_TELEMETRY_OTLP_URL ??
        'https://dsh-otel-collector.deepseeksvc.com/v1/logs'
      compression: gzip
      timeoutMillis: 1000
    processor:
      scheduledDelayMillis: 10000
      maxQueueSize: 2048
      maxExportBatchSize: 2048
      exportTimeoutMillis: 1500
```

**Cấu hình ĐANG CHẠY của ta** (`ours.yml` dòng 181–184): row bị **patch của
`profiles/blackhole/app.patch.yml`** thu về đúng một trường —

```yaml
- id: session-telemetry-otel
  name: '@deepseek-ai/dsh-session-telemetry-otel'
  config:
    mode: DISABLED
```

⇒ Ở `DISABLED` backend **không đọc** `exporter`/`shutdownTimeoutMillis` (đúng như bản gốc), nên cấu hình thu
gọn vẫn hợp lệ. **LEAD đã khai `gbh.row`** cho gói này (18/10/2026 08:41) với **đúng** `config: { mode: DISABLED }`
— tác giả gói **không tự khai**; test canh lại hợp đồng đó (xem §7).

## 4. Peer — sáu peer chạy thật + hai gói CHỈ MƯỢN KIỂU

`gbh.peers` = **sáu tên** dưới đây; `peerDependencies` = **sáu tên đó + `cordis` + `schemastery`**
(`gbh.peers ⊆ peerDependencies` — so **PHẦN TỬ**, có **ĐỐI CHỨNG ÂM** trong test).

| Gói | Vì sao | Bảng §3b |
|---|---|---|
| `@deepseek-ai/dsh-session-telemetry` | **KẾ THỪA `SessionTelemetryBackend`** và dùng `SessionTelemetryCoordinator`. Phải là **CÙNG một lớp**, không phải bản sao: kernel đăng ký dịch vụ theo lớp này, và `instanceof`/`super(ctx, "sessionTelemetry")` là hợp đồng. Kiểm bằng `Object.getPrototypeOf` trong test (bằng TRUE). | **ngoài** bảng — tiền lệ `dsh-bash-local` (mục 2b): *"phải là CÙNG một lớp"* ⇒ **cần Lead xác nhận** |
| `@deepseek-ai/dsh-session` | `Session.fromRestore(...)` (giá trị, không chỉ kiểu) + kiểu `SessionEvent`/`SessionId` | seam phiên |
| `@deepseek-ai/dsh-otel` | seam **`ctx.otel.createSessionLogReporter(...)`** — đúng bảng §3b (*"seam tương ứng"*) | **trong bảng** |
| `@deepseek-ai/dsh-llm` | `APP_IDENTITY.product`/`.version` đi vào `resourceAttributes` (`service.name`/`service.version`) | **trong bảng** |
| `@deepseek-ai/dsh-anonymous-user-id` | `getOrCreateAnonymousUserId()` ⇒ `user.id` trên resource. Viết lại là **viết lại chính sách danh tính** (đọc/ghi `.anonymous-user-id` trong home harness) — không thể tự chế | tiện ích hạ tầng, **cần Lead xác nhận** |
| `@opentelemetry/api-logs` | `SeverityNumber` — **số severity gửi trong OTLP**; bảng §3b bậc 3 ghi rõ *"chỉ trong row telemetry"* | **trong bảng** |

**HAI GÓI CHỈ MƯỢN KIỂU** — khai `devDependencies`, **không** `peerDependencies`, **không** `gbh.peers`:
`@deepseek-ai/dsh-command-feedback` (khai `SessionEventMap['feedback/record']`) và
`@deepseek-ai/dsh-message-feedback` (`feedback/message-put` · `feedback/message-delete` + sự kiện
`feedback/committed` trên `Context`). Hai gói này **chỉ** vào chương trình `tsc` qua
`import type {}` — **không** nạp gì lúc chạy, **không** có trong artifact.

## 5. Bảng TRƯỚC/SAU (đo trên ARTIFACT — lệnh tái lập ở §8)

| Phép đo | TRƯỚC (bản gốc) | SAU (bản ta) |
|---|---|---|
| Tập export `lib/index.js` | `Config` · `DEFAULT_SHUTDOWN_TIMEOUT_MILLIS` · `DEFAULT_TELEMETRY_MODE` · `OpenTelemetrySessionBackend` · `SessionTelemetryMode` · `default` | **Y HỆT 6 tên** (0 thiếu · 0 thừa), `default === OpenTelemetrySessionBackend` |
| `grep -c 'id: @deepseek-ai' lib/index.js` | — | **0** (`id: @galaxy-blackhole` cũng **0** — host-only) |
| `Object.getPrototypeOf(Lớp)` | `SessionTelemetryBackend` | **CÙNG một lớp** (so bằng `Object.getPrototypeOf(...) === …`: TRUE) |
| `static inject` | `["sessions", "otel"]` | **y hệt** |
| `String(Config)` | `{ mode?: "FEEDBACK_ONLY" \| "DISABLED", exporter?: any, processor?: any, shutdownTimeoutMillis?: number, maxRequestBytes?: number }` | **TRÙNG TỪNG CHỮ** |
| `Config({})` | `{ mode: "FEEDBACK_ONLY" }` | **y hệt** |
| `SessionTelemetryMode` | `{FEEDBACK_ONLY, DISABLED}` | **y hệt** |
| Tuỳ chọn `createSessionLogReporter` (scope · exporter · processor · `maxRequestBytes` · resource) | `scope.name = "@deepseek-ai/dsh-session-telemetry-otel"`, `version = "0.2.1-alpha.4"` | **TRÙNG** từng trường (kể cả `version` — xem §6) |
| **9 ca cấu hình sai** (thiếu/rỗng/không hợp lệ/sai giao thức · batch 0/lẻ · hạn chót 0/∞/>2^31−1) | 9 thông điệp | **9 thông điệp TRÙNG TỪNG CHỮ**, và **không** đăng ký dịch vụ ở cả hai bên |
| Cảnh báo `DISABLED` khi có phản hồi | `OpenTelemetry session upload is DISABLED; this feedback is not uploaded through OpenTelemetry` | **chuỗi y hệt**, đúng **4** hình dạng sự kiện (xem test) |
| Phản hồi canonical ⇒ bản ghi | 1 `reportSessionLog`: `severityNumber=INFO`, `attributes.event.seq`, `data` đã làm sạch | **vết TRÙNG** (`toEqual` giữa hai bên) |
| Sự kiện KHÔNG canonical | `session telemetry ignored an event absent from the canonical session log` | **chuỗi y hệt**, **0** bản ghi |
| `shutdown()` khi kênh log treo | từ chối `session-telemetry-otel: provider shutdown exceeded <N>ms` + **1** lượt `stopPending()` | **chuỗi y hệt**, **1** lượt `stopPending()` |
| `shutdown()` ở `DISABLED` | hoàn tất ngay (không có nhà cung cấp) | **y hệt**, **0** lượt `stopPending()` |

## 6. Hai khác biệt đã biết (có lý do, có test khẳng định)

1. **`version` của gói = `0.2.1-alpha.4`** (không phải `0.1.0` như các gói khác). Bản gốc đọc
   `createRequire(import.meta.url)("../package.json").version` rồi gửi vào **`scope.version` của OTLP** — dữ
   liệu **đi ra ngoài**. Ta giữ **nguyên cơ chế** (đọc manifest của chính gói) **và** đặt manifest bằng đúng
   phiên bản oracle ⇒ payload **trùng** bản gốc. Có test khẳng định `scope` của ta **bằng** `scope` của gói gốc.
2. **Một hằng nội bộ được đặt tên**: chuỗi `"Session log record withheld: redaction removed sourceEvent"` ở bản
   gốc viết tại chỗ; ta đưa thành `WITHHELD_RECORD_WARNING` — **chuỗi không đổi**, chỉ dễ đọc. Hành vi như cũ.

## 7. CHƯA làm (điều kiện chặn mount — nói thẳng)

- **`gbh.row` do LEAD khai** (08:41 ngày 18/10/2026), không phải tác giả gói: `id: session-telemetry-otel` ·
  `config: { mode: DISABLED }` · `tests: ["tests/host/session-telemetry-otel.test.ts"]` — **không** `moduleIds`/
  `aliases` (row MỘT MẶT). Ca test tương ứng **đổi chiều** từ TEST CANH (`gbh.row` phải vắng) sang **hợp đồng
  metadata** (id · config · test · không id module), đúng mẫu ở recipe §7 — ai sửa ba trường đó sẽ thấy test đỏ.
- **CHƯA chạy `lab:row` · CHƯA mount · CHƯA có bảng TRƯỚC/SAU trên app 5439** (thuộc lượt boot của Lead).
- **CHƯA đo `(5)` `did not activate` / `(8)` `#root`**: row host-only nên **không** có artifact client; phép
  đo đúng cho nó là **entry trong manifest** + `check:rows` **0 chằn** (mục §8).
- **Nhánh `feedback/committed` có dựng lại phiên** (`Session.fromRestore`) chỉ được đo ở nhánh **rỗng**
  (snapshot không có sự kiện ⇒ cả hai bên trả về im lặng). Dựng một `SessionInspection` **hợp lệ đầy đủ** cần
  store phiên thật — để lượt mount của Lead đo trên app thật.

## 8. Lệnh tái lập

```bash
cd packages/host/session-telemetry-otel && bun run build.ts      # lib/index.js
grep -c 'id: @deepseek-ai' lib/index.js                          # 0
bun test tests/host/session-telemetry-otel.test.ts               # 18 pass · 0 fail · 185 expect
bun run check:rows | grep session-telemetry-otel                 # 0 dòng `| chan |` cho gói này
bun run gate --no-tests                                          # 7/7 XANH
```
