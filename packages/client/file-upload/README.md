<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-client-file-upload — ban viet lai cua dsh-client-file-upload (M5, task-46)
-->

# @galaxy-blackhole/gbh-client-file-upload

Bản viết lại của Galaxy Blackhole cho row `file-upload`: **dịch vụ tải tệp nền của trình duyệt** — một worker
riêng cho mỗi thao tác tải, có tiến độ, huỷ được, và một đường RPC dự phòng cho dữ liệu đã là byte.

**Trạng thái: mới có BẢN ĐỒ HÀNH VI đo được + test canh; CHƯA viết bề mặt, `gbh.row` chưa khai.**

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Bản gốc nửa client (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-file-upload/lib/client.js` (**319 dòng**) |
| Bản gốc nửa host | `…/lib/index.js` (311 dòng) + hợp đồng typert `…/lib/typert.host.js` · `…/lib/typert.remote-client.js` · `…/lib/types/` |
| Dữ liệu thật | `tests/contract/fixtures/c1-boot-graph.json` |
| ADR liên quan | **ADR 0004 `8** — ca BYTE multipart: mọi tầng vận chuyển phải coi thân phản hồi là **BYTE**, không bao giờ là chuỗi (`String(Uint8Array)` cho ra dãy byte thập phân) |
| Test canh | `tests/client/file-upload.test.ts` |

## Bản đồ hành vi ĐO ĐƯỢC (nguyên văn)

Row trong đồ thị boot:
- `inject: ["@deepseek-ai/dsh-api-remotes"]` · **`immediately: true`** (thuộc tier nạp ngay — khác mọi row tôi từng làm)
- `dsh.client` của gói gốc: `{ inject: ["@deepseek-ai/dsh-api-remotes"], platform: "web", immediately: true }` ⇒ **phải khai lại đủ vào `gbh.row`** (bài học row `connection`: thiếu là parity báo THÊM/ĐỔI)
- **2 row inject nó**: `@deepseek-ai/dsh-client-ui-conversation` · `@deepseek-ai/dsh-api-session-controller` — chúng chờ **DỊCH VỤ `fileUpload`**, không require module
- **0 row require module của nó** ⇒ **không cần alias id stock**

Bề mặt nửa client (đọc trực tiếp `lib/client.js`):

| Thành phần | Chi tiết |
|---|---|
| `inject` | `["remote"]` |
| `apply(ctx)` | `ctx.plugin(FileUploadRuntime)` — đăng ký dịch vụ |
| Dịch vụ | tên **`fileUpload`** (cordis `Service`), hai method: `post(request)` · `upload(sessionId, data, name, signal, onProgress)` |
| Đường dẫn | `FILE_UPLOAD_ROUTE` = `api/session/uploadFileBinary` (bản gốc viết `"/api/session/uploadFileBinary".slice(1)`) |
| Nhánh Blob/stream | POST kèm `content-type: application/octet-stream`, query `sessionId` + `name`, qua **worker nền**; yêu cầu HTTP 200 rồi `parseFileUploadResult` |
| Nhánh byte | `data instanceof Uint8Array` ⇒ gọi RPC `ctx.remote.fileUploads.upload(sessionId, { data: base64, name })` |
| Worker | `fileUploadWorker(scope, createXhr, doFetch)`: Blob ⇒ `XMLHttpRequest` + `upload.onprogress`; `ReadableStream` ⇒ `fetch` với `duplex: "half"`, đọc từng chunk và báo tiến độ; gửi thông điệp `progress`/`complete`/`error` |
| Transport | `workerTransport()` tạo worker từ `Blob(["(…toString())()"])` tên `dsh-file-upload`, huỷ qua `AbortSignal` (DOMException `AbortError`), chuyển `ReadableStream` sang worker; **`customTransport(fetch)`** khi có hook `globalThis.__DSH_FILE_UPLOAD__` |
| Kết quả | `parseFileUploadResult(body)` kiểm chặt: `{ok:true, value:{receiptId, file:{attachmentId, name, bytes}}}` hoặc `{ok:false, error:{code,message,details}}` ⇒ `RemoteError`; sai hình dạng ⇒ `TypeError` |
| Lỗi | `RemoteError` có `code` · `details` · cờ cấu trúc **`isDSHRemoteError = true`** (không dùng `instanceof` xuyên bundle) |
| Tiện ích | `bytesToBase64(data)` — chuyển theo khối **32768 byte** qua `String.fromCharCode` + `btoa` (đây là chỗ **byte** phải giữ nguyên, xem ADR 0004 `8) |

## Vì sao chưa mount

Bề mặt gồm **worker + hai đường vận chuyển + hợp đồng typert ở nửa host** (311 dòng) — mount khi chưa xong sẽ
tắt row stock và **hai row kia mất dịch vụ `fileUpload`**. Vì vậy `gbh.row` chưa khai và có test canh chặn.

## Kế hoạch viết

1. Nửa host `apply()` rỗng (khuôn đã có ở `resources`) + đọc hợp đồng typert để giữ đúng bề mặt RPC.
2. Nửa browser: `RemoteError` · `bytesToBase64` · `parseFileUploadResult` · `fileUploadWorker` · `workerTransport`/`customTransport` · lớp `FileUploadRuntime` (dịch vụ `fileUpload`) · `inject = ["remote"]` + `apply(ctx){ ctx.plugin(...) }`.
3. Build CJS bọc `__ModuleLoader__.load` (một id duy nhất), `dsh.client` + `gbh.row` khai lại `inject`/`immediately`.
4. Test: hình dạng kết quả (receipt hợp lệ / lỗi / sai dạng) · `bytesToBase64` giữ byte (`ADR 0004 `8`) · nhánh byte đi RPC · worker nhận `Blob` và `ReadableStream` · huỷ qua `AbortSignal`.
5. Lab `bun run lab:row file-upload` → 0 lỗi console + 0 `did not activate` → nhắn Lead gom một lượt boot.

## License

MIT (theo repo).


## Cổng chặn mount đang báo gì (17/10/2026)

`bun run check:rows` — hai cảnh báo cho gói này, **đúng như mong đợi vì bề mặt chưa viết**:

1. **`thiếu export "FileUploads" mà bản gốc có`** — bản gốc export một mặt hợp đồng tên `FileUploads` (typert) mà bản viết lại **phải cung cấp**. Xem `apps/host/node_modules/@deepseek-ai/dsh-client-file-upload/lib/typert.host.js` + `lib/types/` để lấy đúng hình dạng trước khi viết.
2. `chưa thấy artifact trong profile` — sẽ có sau khi build/lab.

⇒ Cổng đang **CHẶN mount** cho tới khi hai điều trên xong: đúng luật (khai `gbh.row` là metadata, **mount** mới là việc phải chờ lab sạch).

## Luật khai báo (Lead sửa 17/10/2026)

- Khai `gbh.row` **được phép bất cứ lúc nào** — lab cần metadata để biết row nào bị thay.
- Điều **bị cấm** là **xin mount** (một lượt boot) khi lab chưa có **0 lỗi console** và **0 dòng `did not activate`**.
- Lead là người kiểm danh sách trước mỗi lượt boot ⇒ khai sớm mà chưa xin mount thì **không rủi ro cho app**.


`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-file-upload` (shasum `en 420231efcca9...` · `zh 92f552575424...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).

## Bản đồ hành vi NỬA HOST (đo từ `lib/index.js` 311 dòng — 17/10/2026)

| Thành phần | Chi tiết |
|---|---|
| Export BẮT BUỘC | `export { FileUploads, FileUploads as default }` — lớp `FileUploads`; cổng `check:rows` đòi đúng tên export này (`lib/typert.host.js` có `exportName: "FileUploads"`) |
| Lớp cơ sở | `TypertRemoteService` (từ `@deepseek-ai/dsh-typert-protocol` — **peer hợp lệ** theo `3b) |
| Route byte | `FILE_UPLOAD_PATH = "/api/session/uploadFileBinary"`, gắn vào **Connection fetch registry** |
| Hợp đồng HTTP | POST thôi (ngược lại **405** + `allow: POST`) · `content-type` phải là `application/octet-stream` (ngược lại **415**) · thiếu `sessionId` ⇒ **400** · `name` tuỳ chọn |
| Gọi dịch vụ | `service.uploadStream({ sessionId, data: requestBodyChunks(request.body), signal, name })` ⇒ `{ receiptId, file: { attachmentId, name, bytes } }` |
| Thân phản hồi | Luôn **JSON 200** `{ok:true,value}` hoặc `{ok:false,error:{code,message,details}}` + `cache-control: no-store`; lỗi đi qua `remoteErrorOf(error)`, không nhận ra thì `code: "gateway/internal"` |
| **Byte (ADR 0004 `8)** | `requestBodyChunks(body)` là **async generator đọc từng chunk byte** từ `request.body` (`reader.read()` → `yield chunk.value` → `releaseLock()`). Không bao giờ chuyển sang chuỗi ở tầng này — đúng bài học ADR `8 |
| Tiện ích khác | `brandString(sessionId)` khi dựng `sessionId` có thương hiệu; `randomUUID` cho receipt; `Remote/RemoteError` dùng chung lớp lỗi với nửa client (`isDSHRemoteError`) |

**Hệ quả cho bản viết lại**: nửa host phải là một `TypertRemoteService` tên `FileUploads` (export cả `default`), đăng ký route byte `/api/session/uploadFileBinary` trên fetch registry, và **stream byte** — đây chính là chỗ ADR 0004 `8 áp dụng.


### 6. Mốc hợp đồng trong bản GỐC (đọc ngày 17/10/2026, để port chính xác)

Nguồn: `apps/host/node_modules/@deepseek-ai/dsh-client-file-upload/lib/` — **chỉ đọc**.
`client.js` 319 dòng · `index.js` 311 dòng.

| Nửa | Mốc | Dòng | Nội dung cần khớp |
|---|---|---|---|
| browser | `bytesToBase64(data)` | 24–26 | chunk **32768**, ghép chuỗi nhị phân rồi `btoa` |
| browser | `RemoteError.isDSHRemoteError` | 44 | cờ nhận dạng **bắt buộc** để `remote` phân biệt lỗi của ta |
| browser | `duplex: "half"` | 138, 205 | chỉ đặt khi thân request là `ReadableStream` (XHR/`fetch` streaming) |
| browser | hook `globalThis.__DSH_FILE_UPLOAD__` | 159 | điểm tiêm transport thay thế (dùng trong test/lab) |
| browser | `parseFileUploadResult(response.body)` | 191, 272 | hàm thuần: đọc thân JSON ⇒ kết quả có kiểu |
| browser | `data: bytesToBase64(data)` | 194 | trường `data` của thân request = base64 |
| host | kiểm `content-type` | 17 | khác `application/octet-stream` ⇒ **415** |
| host | `sessionId` | 20 | thiếu/rỗng ⇒ **400** |
| host | `requestBodyChunks(request.body)` | 28, 56 | đọc thân theo **từng chunk byte**, không dựng chuỗi |
| host | `cache-control: no-store` | 52 | mọi phản hồi JSON của route |
| host | `FILE_UPLOAD_PATH` | 72 | `"/api/session/uploadFileBinary"` |
| host | `class FileUploads extends …` | 135 | lớp service phơi qua typert (`exportName: "FileUploads"`) |
| host | `resolveAgent(sessionId)` | 285–290 | tra session đang sống; không có ⇒ `RemoteError("session/not-found", …)` |

**Trạng thái (17/10/2026, 22:2x)**:
· **Nửa browser: ĐÃ VIẾT** — `src/client.ts` 266 dòng: `RemoteError` (`isDSHRemoteError`) · `bytesToBase64` (khối 32768) · `parseFileUploadResult` (kiểm chặt từng trường) · `customTransport` (`duplex:"half"` chỉ khi thân là `ReadableStream`) · `workerTransport` (XHR trong Worker, có tiến độ) · `FileUploadRuntime` (`upload` với `Uint8Array` đi RPC `remote.fileUploads.upload` base64, với Blob/luồng đi transport) · `inject = ["remote"]` · `apply(ctx) { ctx.plugin(FileUploadRuntime) }`.
· **Ca canh**: `tests/client/file-upload-browser.test.ts` 5 ca (base64 qua mốc khối · 3 nhánh `parseFileUploadResult` · `duplex` theo loại thân · `apply` cài đúng service · `Uint8Array` đi RPC chứ không qua transport) ⇒ **10 pass · 0 fail** cùng 5 ca cũ.
· **Nửa host: CHƯA VIẾT** (`src/index.ts` còn stub) — việc kế tiếp, theo bảng mốc §6 ở trên.
Gói **không khai `gbh.row`** ⇒ không thể mount ⇒ không thể làm hỏng app trong lúc viết.
Điều kiện để xin mount: hai nửa xong + `FileUploads` có mặt + lab sạch + `check:rows` không dòng chặn.


### 7. Hợp đồng nửa HOST — phần còn lại (service), đọc 17/10/2026

**Đã viết**: `src/http-route.ts` (`FILE_UPLOAD_PATH` · `handleFileUploadHttp` · `requestBodyChunks`) + 6 ca canh.
**Còn lại**: lớp service (typert face `exportName: "FileUploads"`) — hợp đồng đã chốt:

| Thành viên | Hợp đồng (nguồn: `lib/index.js`) |
|---|---|
| `upload(agent, request, signal)` | `signal.throwIfAborted()` rồi `commit(agent, () => ctx.attachments.admitEncodedFile({ data, name? }))` — nhánh RPC base64 |
| `uploadStream(request)` | `agent = await resolveAgent(request.sessionId)` rồi `commit(agent, () => ctx.attachments.saveFileStream({ data, signal?, name? }))` — nhánh byte thô |
| `resolve(agent, receiptId)` | `stagedFiles.get(agent.session)?.get(receiptId)?.file` ⇒ `undefined` cho biên nhận lạ/không thuộc |
| `bindPrompt(agent, receiptIds, requestId)` | gán `requestId` cho từng biên nhận, trả guard khôi phục `previous` khi dispose; biên nhận chưa staged ⇒ `fileNotStaged()` |
| `retirePrompt(agent, requestId)` | `retire(agent.session, requestId)` |
| `resolveAgent(sessionId)` | `ctx.agents.get(sessionId)`; nếu không có thì hỏi resolver; vẫn không ⇒ `RemoteError("session/not-found", …)` |
| Sổ staged | `stagedFiles: Map<session, Map<receiptId, { file, requestId? }>>` (theo **session**, không theo agent) |
| Đăng ký route | trên **Connection fetch registry**, không phải webserver thường |

Ghi chú quan trọng cho người viết tiếp: **lỗi nghiệp vụ KHÔNG đổi mã HTTP** — route luôn trả **200** (kể cả `ok:false`), chỉ 405/415/400 cho yêu cầu sai. Đây là chỗ dễ làm sai nhất khi port.


### 8. API typert cần dùng cho lớp service (đọc 17/10/2026, `lib/index.js` dòng 1–5 + 135)

```ts
import { Remote, RemoteError, TypertRemoteService, remoteErrorOf } from "@deepseek-ai/dsh-typert-protocol";
import { brandString } from "@deepseek-ai/dsh-brand";

class FileUploads extends TypertRemoteService {
  @Remote("upload")                       // ← DECORATOR trên phương thức RPC
  upload(agent, request, signal) { … }
}
```
· `remoteErrorOf(error)` dùng trong route để lấy `{code,message,details}`; không phải lỗi Remote ⇒ `gateway/internal` (đã cài trong `src/http-route.ts`).
· `brandString(sessionId)` khi dựng yêu cầu từ query (đã cài dạng chuỗi thường; khi port thật thì dùng `brandString`).
· `PromptFileBindingGuard` bản gốc có **`commit()`**: `dispose()` chỉ rollback khi **chưa** commit — đã port đúng trong `src/staged-files.ts` (thiếu `commit()` là port sai: sẽ khôi phục nhầm cả khi prompt đã gửi).
· Đăng ký route: trên **Connection fetch registry** (không phải webserver), gọi `handleFileUploadHttp(this, request)`.

**Trạng thái (23:4x)**: browser ✓ (266 dòng) · route host ✓ · sổ staged ✓ (gồm `commit()`) — **21 test · 0 fail**.
**Còn lại**: chỉ còn LỚP `FileUploads` (wiring typert + đăng ký route + `resolveAgent`) — mọi hợp đồng đã có ở §6/§7/§8.


### 9. ĐÍNH CHÍNH §7 — hợp đồng lớp `FileUploads` đọc TRỌN VÙNG (17/10/2026, dòng 141–311)

§7 là bản tóm tắt tôi viết **trước khi đọc trọn vùng lớp** ⇒ nó **thiếu và sai 6 chỗ**. Bảng dưới là bản đúng:

| Chỗ | §7 (sai/thiếu) | Bản gốc (đúng) |
|---|---|---|
| Tên service | `fileUpload` | **`fileUploads`** (`super(ctx, "fileUploads")`) |
| `inject` | không ghi | **`static inject = ["agents", "attachments", "commands", "connection"]`** |
| Sổ staged | `Map<session, Map<…>>` | **`WeakMap`** khoá theo **đối tượng session**; `retire` **xoá cả map con khi rỗng** |
| Đăng ký route | 'trên Connection fetch registry' | **`ctx.connection.fetch.register({ path, methods: ["POST"], requestBody: "streaming", fetch: (req) => handleFileUploadHttp(this, req) })`** trong `ctx.effect` |
| `commit()` | không ghi | có: `assertOrdinaryAgent` → `save()` (lỗi: `attachments.isAttachmentError` ⇒ `session/attachment-invalid` + `{reason}`, còn lại ⇒ `gateway/internal`) → **kiểm lại `ctx.agents.get(agent.id) !== agent` ⇒ `session/not-found` 'disposed before…'** → stage với `randomUUID()` |
| Lỗi 'chưa staged' | `FileNotStagedError` (Error thường) | **`RemoteError("session/attachment-invalid", "File was not uploaded for this session.", { reason: "FILE_NOT_STAGED" })`** |

Bổ sung §7 chưa có:
· `ctx.effect(() => ctx.commands.registerFileReceiptResolver((agent, receiptId) => this.resolve(agent, receiptId)), …)`
· `ctx.on("session/event", (session, event) => observeSessionEvent(session, event))` — chỉ `user/message` + `source.kind === "user"` + `rpcId` chuỗi ⇒ `retire(session, rpcId)`
· `ctx.on("session/disposed", (session) => this.stagedFiles.delete(session))`
· `registerAgentResolver(resolve)` — ném `Error("file-upload: Agent resolver is already registered")` nếu đã có; trả disposer
· `assertOrdinaryAgent(agent)`: `agent.session.header.origin === "subagent"` ⇒ `RemoteError("subagent/attachment-invalid", …)`
· Export: `export { FileUploads, FileUploads as default }`

**Bài học (đã ghi để không lặp)**: bản tóm tắt viết **trước khi đọc trọn vùng** sai 6/13 mục — và **test tự viết không bắt được**, vì test chỉ kiểm nhánh mình đã nghĩ tới (đúng ca `commit()`). ⇒ Với mọi lớp port từ bản gốc: **đọc trọn vùng lớp TRƯỚC, viết hợp đồng SAU**, rồi mới code.

