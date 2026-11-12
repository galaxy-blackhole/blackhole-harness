<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README cua @galaxy-blackhole/gbh-user-questions — ban viet lai cua dsh-user-questions (row user-questions)
-->

# @galaxy-blackhole/gbh-user-questions

Bản viết lại của Galaxy Blackhole cho row `user-questions`: seam hỏi người dùng **`ctx.userQuestions`** —
tạm dừng một lời gọi tool của agent cho tới khi NGƯỜI trả lời, cộng đơn vị chiếu phiên `userQuestions`
mà mọi Client đọc. **Row HOST-ONLY**: gói gốc KHÔNG có `dsh.client` (đã kiểm), nên không có nửa browser,
không có bẫy id module/HMR/JSX. Tên package theo cột "gbh tương ứng" của `docs/PARITY-MATRIX.md` (dòng 15).

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH (CHỈ ĐỌC) | Bản của ta |
|---|---|---|
| Row | `user-questions` (T4, host-only) | `@galaxy-blackhole/gbh-user-questions` |
| Package | `apps/host/node_modules/@deepseek-ai/dsh-user-questions` | `packages/host/user-questions/` |
| Kích thước | `lib/index.js` **695 dòng** (gộp `types/{index,projection,timed-wait}.js`) | `src/*.ts` **7 file** + `build.ts`; artifact `lib/index.js` **618 dòng** |
| Bề mặt export | `TIMED_WAIT_PARAMETER` · `UserQuestionError` · `UserQuestionService` (+`default`) · `isTimedAskUserQuestionSchema` | **y hệt** — đo trên ARTIFACT ở ca 1 |
| Hành vi | `lib/index.js` (phép gấp + service), `lib/types/*.js`, `lib/typert.host.js` (descriptor sinh sẵn) | `src/{schemas,projection,timed-wait,service,errors,types,brand}.ts` viết lại theo hành vi |
| Từ điển | `locale/{en,zh}.json` | chép **byte-for-byte** (sha `en ed3f7d58…` · `zh 21b15b1e…`) |
| Cơ chế thay row | cặp disable + insert, metadata `gbh` trong `package.json` — ADR 0004 §2 và §11 | **chưa khai `gbh.row`** (xem §5) |

`lib/typert.host.js` / `lib/typert.remote-client.js` của bản gốc là **manifest sinh sẵn** (930 + 180 dòng,
do `@galaxy-blackhole/gbh-typert-generator` sinh). Ta KHÔNG ship chúng: seam RPC chạy ở **chế độ nguồn** —
`UserQuestionService` kế thừa `TypertRemoteService` (peer `@deepseek-ai/dsh-typert-protocol`) và hai
phương thức mang decorator `@Remote` / `@Remote({ mode: "stream" })`, đúng cách row `account-controller`
của ta đang chạy thật. Bề mặt Remote được đối chứng với chính bundle gốc bằng `remoteMethods`.

## 2. Vì sao cần — bản đồ hành vi

| Phần | Việc | Ghi chú |
|---|---|---|
| `request/header` | quyết định các lời gọi `ask_user_question` theo sau có **hẹn giờ** hay không (schema tool có khai `timeout`) | lời gọi dưới schema cũ KHÔNG bao giờ được theo dõi |
| `tool/call` · `tool/ptc-dispatch` | đưa lời gọi vào `active` (`open`, hoặc `continued` cho PTC con) | tham số đọc bằng zod, sai hình dạng ⇒ bỏ qua |
| `tool/result` | thân "còn treo" hoặc mã `TOOL_OUTCOME_UNKNOWN` ⇒ `continued`; lô câu trả lời ⇒ chốt; còn lại ⇒ bỏ | |
| `user/message` nguồn `user-question-reply` | chốt câu hỏi bằng lô của lời đáp muộn | đóng bảng câu hỏi KHÔNG ghi lời đáp |
| `ask()` | kiểm đầu vào (rỗng · ý định `plan-review`) rồi chạy **vòng đua `user-questions/request`** | có agent ⇒ phát qua vật mang phạm vi của `dsh-scope` |
| `askTimed()` | lượt chờ nền: Client từ chối `ASK_TIMED_OUT` ⇒ trả `{ pending: true, callId }` | `BAD_TIMEOUT` khi thời lượng không hợp lệ |
| `attachWait()` (stream) | Client giữ lượt chờ ⇒ đồng hồ Host dừng | nhả claim khi luồng đóng |
| `answer()` | đẩy lời đáp vào agent bằng `createUserMessage` + `agent.steer` | `BAD_ANSWER` · `REPLY_QUEUED` · `CALLER_NOT_LIVE` · `DELEGATED_CALLER` |

## 3. Peer

| Peer | Vì sao | Trong bảng §3b? |
|---|---|---|
| `@deepseek-ai/cordis` | `Context`/`Service` + `ctx.inject` · `ctx.effect` · `ctx.on` · `ctx.waterfall` | ✅ |
| `@deepseek-ai/schemastery` | `static Config = z.object({})` (bản gốc cũng rỗng) | ✅ |
| `@deepseek-ai/dsh-typert-protocol` | `TypertRemoteService` + decorator `@Remote` — base class mà Gateway discovery theo | ✅ |
| `@deepseek-ai/dsh-scope` | **`scopeTarget(agent, agent)`**: `dsh-api-remotes` nhận diện sự kiện bằng `carrierKeyOf(this)` — tra bằng **WeakMap nội bộ** của chính gói đó | ❌ **ngoài §3b** |
| `@deepseek-ai/dsh-llm` | `HarnessError` (tầng tool của kernel chỉ ghi `{name, code}` khi `instanceof HarnessError`) + `createUserMessage` (danh tính tin nhắn) + `ToolCallId` | ❌ **ngoài §3b** |
| `zod` (`zod/v4`) | schema tham số tool + schema trạng thái chiếu — **cùng thư viện bản gốc dùng**, nên `strict`/`loose`/`transform` khớp từng ca | dependency (không phải DSH) |

**Hai peer ngoài danh sách ĐÓNG §3b là điều kiện SỐNG CÒN, không phải tiện tay** (đo được, có ca test):
· thiếu `dsh-scope` ⇒ không thể tạo vật mang mà `carrierKeyOf` nhận ra ⇒ `NO_PROVIDER` ⇒ **UI không bao giờ
thấy câu hỏi** (ca 6 đo `carrierKeyOf(carrier) === agent` cho CẢ HAI bản);
· thiếu `dsh-llm` ⇒ lỗi không phải `HarnessError` ⇒ kết quả tool mất `error.info.code` ⇒ UI **không vẽ được
thẻ "đã huỷ"/"bị ngắt"** (ca 8 đo `instanceof HarnessError`).
⇒ **Cần Lead xác nhận mở rộng §3b cho hai seam này** (PARITY-MATRIX dòng 15 cũng đã ghi seam của row là
*cordis, dsh-agent, dsh-llm +4*). Việc khai `gbh.peers` đã làm sẵn; `mount.ts` sẽ symlink chúng về **đúng
một instance của kernel** như luật peer.

## 4. Bảng TRƯỚC / SAU

Phép đo dưới đây chạy **TRONG TIẾN TRÌNH TEST**, trên **hai bản cài thật** (bản gốc đọc từ
`apps/host/node_modules`, bản ta từ `src/`), cùng một phòng test — nên mọi khác biệt quy về chính hai lớp đó.

| Phép đo | TRƯỚC (bản gốc) | SAU (gói của ta) |
|---|---|---|
| Tập export (ARTIFACT `lib/index.js`) | 5 tên | **5 tên, bằng nhau từng tên** (ca 1) |
| `TIMED_WAIT_PARAMETER` | `"timeout"` | **y hệt** (ca 2) |
| `isTimedAskUserQuestionSchema` (5 hình dạng) | `[true,false,false,false,false]` | **y hệt** (ca 2) |
| Bề mặt Remote | `answer` direct · `attachWait` stream | **y hệt, cùng thứ tự** (ca 3) |
| 12 ca đường lỗi (`ask`·`askTimed`·`answer`·`attachWait`) | `TênLỗi/mã/chữ` | **chuỗi bằng nhau TỪNG ca** (ca 4) |
| Phép gấp chiếu (14 sự kiện, so SAU TỪNG bước) | view đã qua schema | **bằng nhau từng bước** (ca 5) |
| `askTimed` có người trả lời / bị từ chối `ASK_TIMED_OUT` | `{pending:true,callId}` | **y hệt** + `carrierKeyOf(carrier) === agent` (ca 6) |
| `answer()`: nguồn + thân tin nhắn đẩy vào agent | `user-question-reply` + JSON lô | **y hệt từng ký tự**; lần hai `REPLY_QUEUED` (ca 7) |
| `locale/{en,zh}.json` | — | **byte-for-byte** (ca 9) |

Lệnh tái lập: `bun test tests/host/user-questions.test.ts` (**10 pass · 0 fail · 65 expect**).

**Chưa có bảng TRƯỚC/SAU ở tầng APP** (mount thật): xem §5 — đó là việc của lượt boot của Lead.

## 5. Phần CHƯA làm (bàn giao)

1. **`gbh.row` CHƯA khai** — cố ý. Bề mặt đã xong nhưng **chưa có lượt boot lab/mount nào**, mà khai
   `gbh.row` là **nhận rủi ro mount** cho MỌI người ở lượt restart kế tiếp (công thức §7). Gói vì thế
   **không thể làm hỏng app**: `check:rows` bỏ qua nó, `bh host` không sinh khối patch cho nó.
2. **CHƯA chạy**: `lab:row user-questions` · mount + `check:app` (chỉ số (8) `#root`, (9) bố cục) · A/B
   ảnh pixel. Cần **một lượt boot của Lead**; khi đó khai `gbh.row.id: "user-questions"` + `tests` +
   `aliases: []` (row không có consumer `require` id gốc — đã đo: chỉ `dsh-tool-ask-user` và
   `dsh-plan-mode` import, cả hai qua **service key** `ctx.userQuestions`, không qua bảng module).
3. **RỦI RO ĐÃ ĐO — `zod/v4` là import ngoài lúc chạy**: artifact giữ `import { z } from "zod/v4"`
   (`packages: "external"` như công thức). Tiền lệ chạy thật: `gbh-api-settings-controller` (đang mount,
   đang active trên app 5439) cũng import `zod/v4` từ profile — nên đường phân giải này đã được chứng minh;
   nếu lượt boot đầu báo `Cannot find package "zod/v4"` thì đây là chỗ sửa (bundle zod vào artifact).
4. **KHÁC BIỆT ĐÃ BIẾT về danh tính lớp lỗi**: `dsh-plan-mode` (gói gốc, chưa thay) bắt lỗi bằng
   `cause instanceof UserQuestionError` với lớp của **gói gốc**, nên thể hiện của TA không thoả ⇒ nhánh
   `ASK_CANCELLED` của plan-review rơi vào `throw cause` thay vì trả `{ approved: false }`. Ca 8
   **khẳng định đúng hiện trạng này** để không ai tưởng nó đã được xử lý. Muốn hết phải đổi `dsh-plan-mode`
   (ngoài vùng ghi của row này) hoặc cho lớp lỗi của ta thừa hưởng lớp gốc (không thể nếu không import
   chính gói đang bị thay).
5. **Nửa client KHÔNG có** — đúng bản gốc (row `ui-user-questions` là row KHÁC, vẫn của DSH).

## 6. Năm câu hỏi bắt buộc (công thức mục 0)

1. **Row có đang BẬT không?** CÓ — `profiles/blackhole` (stock.yml) có `- id: user-questions`,
   `name: '@deepseek-ai/dsh-user-questions'`, **không** `disabled`, **không** config.
2. **Thuần host hay có mount surface client?** **Thuần host**: `package.json` gốc không có `dsh.client`
   (câu hỏi 5 = `false`), `lib/` chỉ có `index.js` + `types/` + hai manifest typert sinh sẵn.
3. **Cần seam nào?** `TypertRemoteService` (typert) · `Context`/`Service` của cordis · `scopeTarget`
   (dsh-scope) · `HarnessError`/`createUserMessage`/`ToolCallId` (dsh-llm) · `sessionProjections`,
   `agents`, `session/event`, `agent/inbox/*` (tra qua `ctx.get`/`ctx.on`, KHÔNG import). Hai seam đầu
   nằm trong §3b, hai seam sau **ngoài §3b** — xem §3 (đã báo Lead).
4. **Hành vi đo được là gì?** (a) 5 tên export trên artifact · (b) hai endpoint Remote `userQuestions/answer`
   (direct) + `userQuestions/attachWait` (stream) · (c) **đơn vị chiếu phiên khoá `userQuestions`,
   `stateVersion: 2`** — ảnh chụp `{active, settled}` đi ra mọi Client · (d) một **tin nhắn người dùng**
   nguồn `user-question-reply` được đẩy vào agent khi trả lời. Cả bốn đều đo TRƯỚC/SAU được.
5. **Package gốc có `dsh.client` không?** **KHÔNG** (`python3 -c "import json;…"` ⇒ `False`) ⇒ thay row
   này **không** làm mất nửa client nào khỏi đồ thị boot.
