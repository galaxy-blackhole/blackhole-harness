<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi @galaxy-blackhole/gbh-otel — bang nguon doi chieu G4, ly do peer, TRUOC/SAU, phan CHUA lam
-->

# @galaxy-blackhole/gbh-otel — row `otel`

Bản viết lại của `@deepseek-ai/dsh-otel` (**409 dòng** `lib/index.js`): **dịch vụ cordis `otel`**
tạo hai loại kênh OTLP **độc lập** — sự kiện thường (gộp lô theo **số lượng**, HTTP huỷ được qua `got`)
và log phiên (gộp lô theo **byte**, trần 4.000.000 byte, một request một thời điểm).

## 0. Năm câu hỏi bắt buộc (mục 0 của công thức)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **CÓ** — `@deepseek-ai/dsh-base/cordis.patch.yml` dòng 202–203 khai `- id: otel` / `name: '@deepseek-ai/dsh-otel'`, **không** `disabled`, **không** `config`. `profiles/blackhole/parity.patch.yml` và `app.patch.yml` **không** tắt nó. |
| 2 | Thuần host hay có mount surface client? | **THUẦN HOST.** Package gốc **không** có `dsh.client`; không có `loader.create/resolve`, không slot, không file `locale` nào được runtime đọc cho UI — `locale/{en,zh}.json` vẫn được ship (LUẬT 000e) nhưng chỉ là metadata gói. |
| 3 | Cần **seam** nào? | `extends Service` của cordis (**1 seam duy nhất**, đăng ký dưới tên `otel`) + 8 phụ thuộc **ngoài** bảng §3b: 7 gói `@opentelemetry/*` + `got` — **cùng đúng phiên bản bản gốc khai** (`@opentelemetry/api` ^1.9.1 · `api-logs`/`otlp-exporter-base`/`sdk-logs`/`otlp-transformer` 0.222.0 · `core`/`resources` 2.11.0 · `got` ^14.6.6). Cả 8 gói **có thật trong kernel** ⇒ khai `gbh.peers` để tầng mount symlink về kernel (xem §2). |
| 4 | Hành vi đo được là gì? | **Một HTTP request OTLP JSON** tới `exporter.url`: `POST` + `content-type: application/json` (+ `content-encoding: gzip` khi `compression: "gzip"`), thân là `{"resourceLogs":[…{"logRecords":[…]}]}`. Đo được **trước/sau** bằng collector giả (§4). |
| 5 | Package gốc có `dsh.client` không? | **KHÔNG.** `python3 -c "import json;print(bool((json.load(open('…/dsh-otel/package.json')).get('dsh') or {}).get('client')))"` ⇒ `False`. Vì vậy cặp disable+insert **không** làm mất nửa client nào. |

## 1. Bảng nguồn đối chiếu (G4)

| File của ta | Nguồn gốc (CHỈ ĐỌC) | Ghi chú |
|---|---|---|
| `src/index.ts` | `apps/host/node_modules/@deepseek-ai/dsh-otel/lib/index.js` dòng 383–409 | lớp `OTel extends Service`, tên service `otel`, 2 phương thức `createEventReporter`/`createSessionLogReporter`; tái xuất **đúng tập type** của `lib/types/index.d.ts` |
| `src/transport.ts` | dòng 12–51 (`//#region lib/types/transport.js`) | `createLogExporter` · `createLogExporterMetrics` · `logTransportOptions` |
| `src/event-transport.ts` | dòng 53–125 (`//#region lib/types/event-transport.js`) | `createEventLogExporter` (got + retry 5 + trần thân 4 MiB + huy agent khi shutdown) |
| `src/event-log.ts` | dòng 126–190 (`//#region lib/types/event-log.js`) | `EventLogReporter` (gom lô theo số lượng của SDK) |
| `src/session-log.ts` | dòng 191–381 (`//#region lib/types/session-log.js`) | `SESSION_LOG_MAX_REQUEST_BYTES` · `resolveSessionLogLimits` · `SessionLogProcessor` · `SessionLogReporter` |
| `locale/{en,zh}.json` | `locale/{en,zh}.json` của gói gốc | chép **byte-for-byte** (LUẬT 000e) |

### Ba khác biệt CÓ Ý (ghi rõ để người sau không tưởng là sai sót)

1. **Lỗi HTTP được ném bằng `OTLPExporterError`** thay vì `new Error("OTLP collector returned HTTP N")`.
   Lý do **đo được**: van chuyển HTTP của SDK cũng ném `OTLPExporterError(res.statusMessage, res.statusCode, body)`
   (`otlp-exporter-base/build/src/transport/http-transport-utils.js` dòng 75), và **SDK bỏ phần `message`** khi
   dựng lại lỗi ⇒ bản gốc chỉ còn `"Internal Server Error"`, **mã trạng thái bị mất**. Dùng đúng loại lỗi của SDK
   giữ được **cả `message` lẫn `code`** cho `onFailure` của bên gọi, không đổi bất kỳ hành vi nào khác.
2. **`logTransportOptions` tách `headers`/`agentFactory` thành biến** thay vì object literal lồng — cùng giá trị,
   chỉ để `tsc --strict` suy được kiểu (object literal lồng làm `HeadersFactory` mất ngữ cảnh).
3. **`headers` gọi MỘT lần mỗi request** (bản gốc gọi hai lần trong cùng một lần gửi) — không đổi kết quả quan sát được.

## 2. Vì sao khai `gbh.peers` (và KHÔNG khai `gbh.row`)

`apps/cli/src/mount.ts` chỉ mount gói **có `gbh.row`** và **chỉ symlink peer đã khai** về kernel:

```ts
peers: ["@deepseek-ai/cordis", "@deepseek-ai/schemastery", ...(metadata.peers ?? [])]
```

Tám gói `@opentelemetry/*` + `got` **không nằm trong workspace** (repo root không có chúng; chỉ
`apps/host/node_modules` có) ⇒ nếu không khai `gbh.peers`, artifact trong profile sẽ ném
`Cannot find module '@opentelemetry/api-logs'` khi boot. Test `tests/host/otel.test.ts` **dựng lại đúng**
cách mount làm (node_modules của profile + symlink từng peer về kernel) rồi chạy trên artifact.

⚠️ **Gói CHƯA khai `gbh.row`** theo đúng yêu cầu "KHÔNG tự khai `gbh.row` (Lead boot)" — `apply`/row chỉ
được bật ở lượt boot của Lead. **Test canh** trong `tests/host/otel.test.ts` khẳng định `gbh.row` **vẫn
chưa** được khai; ai bật sớm sẽ thấy test đỏ ngay. Khối `gbh.row` cần thêm khi Lead boot (row gốc **không**
có `config`, **không** có `inject`):

```json
"gbh": {
  "row": { "id": "otel", "tests": ["tests/host/otel.test.ts"] },
  "peers": ["@opentelemetry/api", "…", "got"]
}
```

## 3. Cổng chống cài hai lần / cổng `apply`: KHÔNG ÁP DỤNG (có lý do)

Row này **là một LỚP SERVICE của cordis**, không phải plugin hàm: không có `apply`, không `slots.register`.
Việc chống cài hai lần do **chính cordis** lo: `Service` đăng ký ngay trong constructor qua
`ctx.reflect.provide(name, …)` và tự gỡ khi fiber của nó unload; đăng ký trùng tên ⇒ kernel ném
`service "otel" has been registered`. Vì vậy **không** có `let` phạm vi module + WeakSet ở đây — thêm vào sẽ
là code chết. (Cổng `check:rows` chỉ soi cổng khoá-theo-`ctx` trong `lib/client.js`, gói này không có nửa client.)

## 4. TRƯỚC/SAU — hành vi đo được

Đo bằng collector OTLP giả trong `tests/host/otel.test.ts` (server `node:http` trên cổng trống, giải nén gzip
rồi `JSON.parse`). Lệnh tái lập: `bun test tests/host/otel.test.ts`.

| Phép đo | TRƯỚC (không mount) | SAU (artifact của ta) |
|---|---|---|
| `POST <url>` khi `emit()` | không có request nào | **1 request** · `content-type: application/json` · `content-encoding: gzip` · `authorization: Bearer test` |
| Thân request | — | JSON có `resourceLogs[…].logRecords[0]`: `eventName: "sidebar_menu_click"` · `severityNumber: 9` · `attributes: count=2, ok=true, nested.kind="menu"` |
| `reportSessionLog` | — | `eventName: "session-log"` · `sessionId: "session-1"` · `content` = JSON của **nguyên** `event` |
| Bản ghi vượt `maxRequestBytes` | — | **bị từ chối**, KHÔNG gửi, `onFailure("Session log record rejected; content was not truncated")`, nội dung **không** lộ vào chẩn đoán |
| Collector trả 500 | — | `onFailure("Session log export failed", OTLPExporterError code 500)`, **không treo** |
| `shutdown(signal)` bị abort | — | trả về trong **< 2,5 s**, agent **riêng** của kênh bị `destroy()` **đúng một lần** |
| Tập export (đo trên ARTIFACT) | `["default"]` | `["default"]` — **BẰNG** |
| `grep -c 'id: "@deepseek-ai' lib/index.js` | — | **0** (gói host-only nên **không** có `id` module nào; luật "một bundle ⇒ một id" áp cho nửa client) |

## 5. Phần CHƯA làm

- **Chưa mount lên app 5439** và **chưa chạy `lab:row`**: cả hai đều cần `gbh.row` (Lead boot). Gói đang ở
  trạng thái an toàn *"chưa khai `gbh.row` ⇒ không thể làm hỏng app"*.
- **Chưa đo A/B với oracle trên app thật** (ngoài phạm vi được giao: chỉ ghi trong `packages/host/otel/` + test).
- `lib/` trong repo là bản build tay để đối chiếu; **nguồn sự thật là `src/`** (mount tự build lại).
