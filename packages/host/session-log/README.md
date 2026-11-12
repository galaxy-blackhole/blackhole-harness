<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row session-log-deepseek (host-only) — nguồn đối chiếu G4,
      lý do peer, khác biệt CÓ Ý, bằng chứng đo được, và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-session-log

Bản viết lại **host-only** của row `session-log-deepseek` trong profile `blackhole`.

- Row stock: `session-log-deepseek` → `@deepseek-ai/dsh-session-log-deepseek` (**195 dòng** `lib/index.js`,
  **MỘT MẶT**: KHÔNG có `lib/client.js`, KHÔNG có khoá `dsh.client`).
- Gói của ta: `@galaxy-blackhole/gbh-session-log`.
- Bản gốc **ĐANG TẮT** trong profile (`ours.yml` dòng 28–30: `disabled: true`). Xem §4 — ta **mirror
  ý định sản phẩm** đó bằng `config.enabled: false` chứ KHÔNG tự tắt tính năng.

## 1. Nguồn đối chiếu (G4)

| Hành vi | Bản gốc (`lib/index.js`) | Bản của ta (`src/`) | Bằng chứng |
|---|---|---|---|
| Tên plugin | `name = "session-log-deepseek"` | y nguyên | bằng nhau (test) |
| Service bắt buộc | `inject = ["deepseekLlmApiExtensions", "sessions"]` | y nguyên, cùng thứ tự | mảng bằng nhau (test) |
| Schema `Config` | `z.object({ enabled: z.boolean().default(true).volatile(), maxBytes: z.number().step(1).min(1).default(8*1024*1024) })` | cùng hai trường, cùng chuỗi `z` | `String(Config)` trùng **từng ký tự**; ba ca cấu hình sai ra **cùng thông điệp** |
| Đăng ký | `ctx.deepseekLlmApiExtensions.register("dsh_session_log", { prepare })` | y nguyên, MỘT trường | sổ trường đã đăng ký = `["dsh_session_log"]` (cả hai bên) |
| Công tắc | `if (!config.enabled.get()) return undefined` | y nguyên, đọc lại ở MỖI request | ca `enabled=false` ⇒ `prepare()` `undefined` ở **cả hai** bản |
| Nhánh thiếu phiên | `request.sessionId === undefined` · `ctx.sessions.get(...) === undefined` | y nguyên, hai nhánh | ca "request không có sessionId" ⇒ `undefined`, 0 cảnh báo |
| Envelope | `{ version: 1, sessionFormatVersion, session: wireHeader, afterSeq }` | y nguyên | `toEqual` giữa hai bản |
| `wireHeader` | 8 trường tuỳ chọn, `seedLength` **chỉ** khi `header.isSeeded` | y nguyên từng khoá | `toEqual` + ca header đầy đủ |
| `wireEvent` | 4 nhánh: sự kiện mặt (có/không trích nguồn) · assistant · **lạ-còn-ignorable** · còn lại | y nguyên từng nhánh | 5 sự kiện một lượt: `toEqual` từng trường |
| `wireSurfaceOp` | `"append"` nguyên văn; còn lại `{ op:"replace", startSeq, endSeq }` bỏ thương hiệu | y nguyên | `toEqual` |
| Trần byte | `jsonBytes(envelope) - 1`; mỗi tiền tố cộng `1 + jsonBytes(wire)`; `candidateBytes` cộng chữ số của `seq` | y nguyên công thức | 4 mức `maxBytes` (`8 MiB · 400 · 200 · 120`) ⇒ **cùng số sự kiện** ở hai bên |
| Không sự kiện nào vừa | ghi log MỘT lần cho mỗi `(phiên, sự kiện đầu)` rồi `undefined` | y nguyên (WeakMap phạm vi module) | `maxBytes: 1` ⇒ 1 cảnh báo, chuỗi **trùng** hai bên |
| Giá trị không serialize được | nhánh cảnh báo `too large to serialize into a dsh_session_log field` | y nguyên | ca `BigInt` trong thân sự kiện ⇒ chuỗi **trùng** |
| Commit sau 2xx | `accept: () => session.append("session-log-deepseek/delivery-accepted", { sessionId, sessionFormatVersion, throughSeq })` | y nguyên, ĐÚNG một sự kiện | `toEqual` sự kiện hai bên |
| `acceptedThrough` | gộp tăng dần theo `(scannedEvents, throughSeq)`; 6 đường lỗi | y nguyên từng câu thông điệp | 11 ca bảng + ca `missing event` + ca bộ nhớ đệm — **cùng kết quả** |
| Tập export | `Config · acceptedThrough · apply · inject · name` | **bằng** (0 thiếu · 0 thừa) | đo trên **ARTIFACT** `lib/index.js` đã build |

## 2. Peer và lý do (bảng §3b)

| Peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 (kernel) | kiểu `Context` cho `apply` và kiểu `Volatile<boolean>` — **chỉ mượn kiểu**, bị xoá lúc build |
| `@deepseek-ai/schemastery` | 1 (kernel) | `z.object` của `Config` — **nạp lúc chạy** |
| `@deepseek-ai/dsh-brand` | **ngoài bảng** (tiền lệ: `workflow` · `deepseek-account`) | `brandString<SessionId>` — hàm **đồng nhất** (`value → value`); dùng chung để danh tính `SessionId` do kernel cấp vẫn là MỘT |
| `@deepseek-ai/dsh-session` | **ngoài bảng** (tiền lệ: `approval` · `message-feedback` · `workflow` · `goal-round-driver` · `session-telemetry-otel`) | `SessionSeq` · `SessionLogOffset` · `KNOWN_SESSION_EVENT_TYPES` nạp **LÚC CHẠY**; tự chế bản sao là **hai chuẩn hợp lệ khác nhau** và một bản sao `KNOWN_SESSION_EVENT_TYPES` sẽ **lệch âm thầm** mỗi lần kernel thêm loại sự kiện |
| `@deepseek-ai/dsh-util-values` | 2 (tiện ích hạ tầng; tiền lệ `session-projection-cache`) | kiểu `JsonValue` cho hình dạng wire — **chỉ mượn kiểu**, bị xoá lúc build |

⇒ `gbh.peers` = đúng năm tên trên, **⊆ `peerDependencies`** (so PHẦN TỬ, có **đối chứng âm**:
xoá-một-tên / thêm-tên-lạ). `dependencies` **RỖNG**.

## 3. Khác biệt CÓ Ý (và vì sao không phải lỗi)

1. **KHÔNG import `@deepseek-ai/dsh-deepseek-llm-api-extensions`** (bản gốc khai nó ở
   `peerDependencies`). Ta khai seam `ctx.deepseekLlmApiExtensions` **theo CẤU TRÚC** trong
   `src/seams.ts` — đúng luật **000d** (không `declare module` nào) và đúng khuôn 12 gói host khác của
   repo. Lúc chạy không cần import: seam được kernel cấp theo **tên dịch vụ**.
2. **`Config` của row được khai `enabled: false`** trong `gbh.row.config`. Đây là **mirror ý định sản
   phẩm** đã có từ trước (`profiles/blackhole/parity.patch.yml`: *"Phan dong gop session-log cho request
   official DeepSeek: tat … khong de mot setting trong Chrome doc nhu the san pham nay tai du lieu len"*),
   **KHÔNG** phải ta tự tắt tính năng: gói vẫn đăng ký provider, vẫn `apply` được, và **chứng minh được
   bằng test** rằng `prepare()` trả `undefined` ⇒ **0 byte** rời máy. Muốn bật lại chỉ cần sửa **một**
   giá trị trong `gbh.row.config`.
3. `src/` tách thành 5 tệp (index · acceptance · wire · types · seams) thay vì một `index.js` 195 dòng —
   luật ≤1000 dòng/file của repo; hành vi giữ nguyên.

## 4. Cấu hình của row trong profile `blackhole`

Đọc từ dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng 28–30 — row **ĐANG TẮT**:

```yaml
- id: session-log-deepseek
  name: '@deepseek-ai/dsh-session-log-deepseek'
  disabled: true
```

⇒ Khối patch do tầng mount sinh (ADR 0004 §11) sẽ là `- id: session-log-deepseek / disabled: true` +
`- insert: - id: session-log-deepseek-ours / name: '@galaxy-blackhole/gbh-session-log'` kèm
`config: { enabled: false, maxBytes: 8388608 }` ⇒ **row của ta BẬT nhưng KHÔNG đóng góp byte nào**,
đúng ngữ nghĩa "row gốc bị patch tắt".

## 5. Hai hành vi TINH TẾ của bản gốc mà ta giữ NGUYÊN (đo được, đừng "sửa")

1. **Sự kiện mốc NẰM TRONG hậu tố được tải**: lượt sau bắt đầu từ `afterSeq + 1`, nên chính bản ghi
   `session-log-deepseek/delivery-accepted` vừa ghi cũng được tải lên lượt kế (đo: log
   `[user, user, accepted(throughSeq=1), user]` ⇒ `events = [2, 3]`). Đây là **chủ ý** của bản gốc
   (mốc phải nằm trong log canonical để phục hồi sau restart), không phải rò dữ liệu.
2. **Sự kiện ĐÃ BIẾT nhưng không sinh mặt** (ví dụ `compaction/start`) **KHÔNG mang** `surfaceOp` /
   `sourceEventSeqs` trên wire, kể cả khi đối tượng sự kiện có hai trường đó (đo: hai bên ra cùng chuỗi
   JSON). Chỉ bản ghi **LẠ** còn `ignorable` mới mang metadata mờ.

## 6. Test

```bash
~/.bun/bin/bun test tests/host/session-log-deepseek.test.ts   # 29 ca · 151 expect · 0 fail
```

| Nhóm | Số ca | Đo cái gì |
|---|---|---|
| Bề mặt plugin trên ARTIFACT | 3 | tập export ta = gốc (`0 thiếu · 0 thừa`) · `name`/`inject`/`String(Config)` · đăng ký ĐÚNG một trường |
| `enabled=false` (ý định sản phẩm) | 2 | `prepare()` ⇒ `undefined` ở **cả hai** bản ⇒ 0 giá trị, 0 sự kiện, 0 cảnh báo · nhánh thiếu `sessionId` |
| Đối chứng từng byte | 6 | envelope + phong bì sự kiện · 5 nhánh `wireEvent` · mốc đã-nhận · 4 mức `maxBytes` · không-sự-kiện-vừa · không-serialize-được |
| `acceptedThrough` | 13 | 11 ca bảng (mốc hợp lệ / phiên khác / thế hệ khác / `-0` / không nguyên / âm / rỗng / tự trỏ) + `missing event` + bộ nhớ đệm tăng dần |
| C6 danh tính | 2 | hai lượt `Config()` ⇒ hai vật thể RIÊNG (`!==`), sửa một không lan · hai lượt cài ⇒ hai đăng ký riêng |
| Quy ước repo | 3 | `gbh.peers ⊆ peerDependencies` + **đối chứng âm** · locale **byte-for-byte** · `gbh.row` trỏ tệp test CÓ THẬT |

**Giàn đo**: mỗi bên cài chạy trên **Context cordis THẬT** (`new Context()` của chính kernel) bọc Proxy
đắp ba seam `deepseekLlmApiExtensions` · `sessions` · `logger`; **cùng một giàn** cho bản của ta và
bản gốc ⇒ mọi khác biệt quy được về **ruột gói**. Bản gốc nạp động từ
`apps/host/node_modules/@deepseek-ai/dsh-session-log-deepseek/lib/index.js` (CHỈ ĐỌC).

## 7. TRƯỚC / SAU — đo được, không ước lượng

### 7.1 Mount thật: `--dump-config` sau lượt boot của Lead (21:44)

```yaml
- id: session-log-deepseek
  name: '@deepseek-ai/dsh-session-log-deepseek'
  disabled: true
...
- id: session-log-deepseek-ours
  name: '@galaxy-blackhole/gbh-session-log'
  config:
    enabled: false
    maxBytes: 8388608
```

| Chỉ số mount | TRƯỚC | SAU |
|---|---|---|
| entry trong cây đã hợp | 327 | **329** (+2 = row stock bị tắt + row của ta được chèn — đúng cơ chế disable+insert) |
| row của ta trong cây | 0 | **1** (`session-log-deepseek-ours`, `enabled: false`) |
| byte session-log rời máy | 0 | **0** (`prepare()` trả `undefined` khi `enabled=false`) |

### 7.2 Lab cách ly (`lab:row session-log-deepseek`, home `/tmp/gbh-lab-session-log-deepseek`) — C4.2: đường nền vs có row

Hai lượt boot **cùng home + cùng profile**, chỉ đổi ĐÚNG MỘT biến (row của ta bật/tắt bằng overlay):

| Số đo (phía TRANG, Chrome headless) | ĐƯỜNG NỀN (row ta TẮT) | CÓ ROW TA | Chênh lệch |
|---|---|---|---|
| `#root` (ký tự) | **24.602** | **24.602** | **0** |
| lỗi console | **0** | **0** | 0 |
| lỗi trang (`pageerror`) | **0** | **0** | 0 |
| slot render | 25 | 25 | 0 |
| dòng `did not activate` trong log | **1** | **1** | **0** |
| `diff` hai log boot (đã chuẩn hoá home/port/token) | — | — | **4 dòng, TOÀN BỘ là URL devtools inspector ngẫu nhiên** |

⇒ **Ba số bằng nhau từng chữ số** ⇒ mọi khác biệt quy được về **ruột gói**, và ruột gói **không đổi gì** trên
trang. `#root` 24.602 là **đường nền của home lab MỚI** (chưa có phiên nào), KHÔNG so với 67.167 của app
5439 đang có phiên — so đúng là so **cùng một home, hai trạng thái row**.

**3 entry không activate trong log — KHÔNG có entry nào của gói này**:
`ui-sidebar-documentpreview-ours` (`TypeError … 'validate'`) · `config-editor-ours`
(`service "configEditor" has been registered`) · `pwsh-sandbox-ours` (`service "shell" has been registered`)
— **giống y hệt ở lượt nền** ⇒ không phải hồi quy do gói này. Row `session-log-deepseek-ours` **CÓ mặt
trong danh sách đã activate** (nó không xuất hiện trong danh sách lỗi).

### 7.3 Cổng

| Cổng | Kết quả |
|---|---|
| `bun test tests/host/session-log-deepseek.test.ts` | **29 pass · 0 fail · 151 expect** |
| `bun run check:rows` | gói này **0 `chan` · 0 cảnh báo** (không nằm trong bảng vấn đề) |
| `bun run gate --no-tests` | **7/7 XANH** (file-length có vi phạm của **tệp test người khác**, không phải gói này) |
| `tsc --noEmit` (đúng cờ của gate) trên 5 tệp nguồn | **0 lỗi** |

**CHƯA làm / thuộc về Lead**: `check:app` (5)(8)(9)(10)(11) trên app 5439 sau mount (một cửa sổ boot), và
**chữ ký reviewer độc lập**.
