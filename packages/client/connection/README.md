<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-client-connection — bản viết lại của @deepseek-ai/dsh-client-connection
-->

# @galaxy-blackhole/gbh-client-connection

Bản viết lại của Galaxy Blackhole cho row **`connection`** — row NỀN: **kênh RPC có xác thực + vòng đời thế hệ
kết nối**. Điểm chi phí 0 nhưng **bán kính nổ 14** (14 row khác inject nó), nên thiếu một hàm ở đây là nhiều row
mất kết nối. Gói có **HAI MẶT**: nửa host (node ESM) và nửa browser (script classic cho Loader).

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Hợp đồng host (16 export) | `@deepseek-ai/dsh-client-connection@0.2.1-alpha.4` — `lib/index.js` (1.072 dòng) + `lib/types/*.d.ts` |
| Hợp đồng browser (5 export) | cùng gói — `lib/client.browser.js` (1.522 dòng, trong đó ~890 dòng là thư viện vendored) |
| Ai tiêu thụ gì | `dsh-host-frontend-static` (`authorizeIndex`), `dsh-web-app` (`authenticatedUrl`), `dsh-api-gateway` (`rpc.intercept`, `admitConnection` + `mux`), `dsh-api-session-controller` + `dsh-session-log-export` + `dsh-client-ui-deliverables` (`fetch.register`), và 14 row client (`ctx.connection.rpc/generation/state/openWebSocket/reconnect/registerGenerationSource/start/isLoopback/interactions`) |
| Cơ chế thay row | cặp disable + insert, metadata `gbh` — ADR 0004 §2, §11 |

**Peer duy nhất: `@deepseek-ai/cordis`** (bảng §3b). Ba thứ bản gốc lấy từ gói ngoài bảng đã viết lại:
`credentialKey` (chỉ là `<scope>/<id>`), bộ kiểm schema (không dùng zod: tự viết `parse/safeParse` đúng ngữ nghĩa
cần), và scope của Peer (bản gốc dùng `dsh-scope`; ta dùng context của chủ sở hữu — **cách ly event theo Peer
CHƯA làm**, xem "Chưa làm").

## Trạng thái

| Hạng mục | Kết quả |
|---|---|
| Export | host 16 tên · browser 5 tên (`apply`, `inject`, `RpcId`, `transportError`, `installConnection`) — khớp bản gốc |
| Test | **22 test / 121 expect** — hàng rào tin cậy, phiên cookie (mint/303/401/400), bảng lỗi, **ca BYTE multipart**, vòng đời thế hệ, cài service |
| Lab (`lab:row connection`, cổng 5460) | trang 200 · 72 entry · **0 lỗi console** · **0 `did not activate`** · **0 khoá thô** · `/api` 200 + **115.846 B** dữ liệu thật · 415/401/404 đúng bảng lỗi |
| `gate` | 0 vi phạm thuộc gói này |

## Ba lỗi THẬT mà lab bắt được (đọc trước khi sửa gì trong gói này)

1. **Bản ghi credentials phải có `kind`**: sổ credentials chỉ nhận `{ kind: "grant", payload: { version, secret } }`.
   Thiếu `kind` ⇒ sổ từ chối ⇒ plugin **không bao giờ activate** ⇒ mọi row phụ thuộc báo
   `pending (waiting for service: connection)` (đúng 14 row). Triệu chứng nhìn y hệt "app hỏng".
2. **Không được đặt tên phương thức trùng thuộc tính**: `readonly fetch` là SỔ ĐĂNG KÝ TUYẾN; nếu đặt tên
   phương thức dispatch cũng là `fetch` thì thuộc tính che phương thức ⇒ `this.fetch is not a function` ⇒
   **mọi** `/api` trả 400/0B. Đã tách thành `dispatchRpc`.
3. **`admitConnection` phải trả `release()`** (và 409 khi socket đã bị sở hữu): thiếu `release` ⇒
   `admission.release is not a function` ⇒ **harness chết** (lỗi fatal, chỉ hiện khi có WebSocket mux).

## Luật đăng ký id module (sự cố app trắng lần hai)

`gbh.row.moduleIds` **CHỈ được khai một id — id của ta**, và bundle **chỉ** gọi `__ModuleLoader__.load` cho id
đó. Host map MỌI id trong `moduleIds` về cùng một URL bundle, nên khai hai id ⇒ bundle bị nạp hai lần ⇒ lần
thứ hai đăng ký lại chính id đó ⇒ Loader ném
`duplicate factory registration for "…" (bundle executed twice without invalidate?)` ⇒ `#root` rỗng.
Khuôn đúng có sẵn trong nhà: `locale` (48 row phụ thuộc) và `ui-reference` đều khai một id.
Tự kiểm trước khi khai: `grep -o '"@deepseek-ai/[^"]*"' packages/client/<gói>/lib/client.js` phải **rỗng**.

## Bảng TRƯỚC / SAU (lab 5460, cùng một home)

| Phép đo | TRƯỚC (row DSH stock) | SAU (gói của ta) |
|---|---|---|
| `/api/pluginInventory/list` | 200 + dữ liệu thật | **200 + 115.846 B** dữ liệu thật |
| Sai content-type · không cookie · endpoint sai | 415 · 401 · 404 | **415 · 401 · 404** (đúng chữ của bản gốc) |
| Trang · `#root` · lỗi console · khoá thô | 200 · chữ thật · 0 · 0 | **200 · chữ thật · 0 · 0** |
| `did not activate` | 0 | **0** |

## Chưa làm (bàn giao)

- **Cách ly event theo Peer chưa làm**: `dsh-scope` không thuộc bảng §3b, nên `peer.ctx` hiện là context của
  chủ sở hữu. Ai cần `scopeTarget(subject, peer)` đúng nghĩa thì phải làm thêm.
- **Giao vận do vỏ tự dựng** (worker tunnel: `ownsHost`, `loadBundle`, `openStream`): đã hỗ trợ ở mức cấu trúc
  nhưng **chưa đo** trong phiên này (app web không dùng).
- **Phản hồi nhị phân (multipart)**: đã có test đơn vị cho ca BYTE, chưa đo đầu-cuối với một endpoint thật trả
  đính kèm nhị phân.
- `/connect` đã đo bằng tay (302 + cookie) nhưng **chưa đo qua mux WebSocket thật** (Remote stream).

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-connection` (shasum `en 5a56253386fe...` · `zh 3738e4891249...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
