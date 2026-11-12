<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README cua @galaxy-blackhole/gbh-authorization — bản viết lại của dsh-authorization (seam uỷ quyền ctx.authorization)
-->

# @galaxy-blackhole/gbh-authorization

Bản viết lại của Galaxy Blackhole cho row **`authorization`**: seam uỷ quyền **`ctx.authorization`** —
sổ các **luồng lấy credential qua hội thoại với người**, **MỘT lượt cho mỗi khoá**, xác nhận nửa hợp
đồng commit của luồng, và phát **`authorization/settled`** cho **mọi** kết cục (kể cả thất bại).

Đây là row **MỘT MẶT** — đã kiểm ở bước 0: gói gốc **KHÔNG có `lib/client.js`**, **KHÔNG có `dsh.client`**
trong `package.json` ⇒ không nửa browser, không bẫy id module/alias/HMR/JSX. Nửa host gốc **253 dòng**
(`apps/host/node_modules/@deepseek-ai/dsh-authorization/lib/index.js`, chỉ đọc).

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `authorization` (T4) — `ours.yml` **L86–87**, đang BẬT, **không `config`** | `@galaxy-blackhole/gbh-authorization` |
| Package | `@deepseek-ai/dsh-authorization@0.2.1-alpha.4` | cùng bề mặt, viết lại |
| Kích thước bản build | **253 dòng JS** (`lib/index.js`) | **180 dòng JS** sau build (không chép khối JSDoc/type của gốc) |
| Hai mặt? | **KHÔNG** (`lib/client.js` vắng mặt; `dsh.client` vắng mặt) | — |
| Tập export | `AuthorizationDeclinedError` · `AuthorizationError` · `AuthorizationService` · `default` (**4**) | **4 = 4**, đo trên artifact |
| Hợp đồng kiểu | `lib/types/index.d.ts` + `lib/types/types.d.ts` (chỉ đọc) | `src/types.ts` viết lại theo hợp đồng đó |
| Lỗi nền | `HarnessError` của `@deepseek-ai/dsh-llm` | **cùng lớp của kernel** (peer), không phải bản sao |
| Sự kiện | `authorization/settled(key, settlement)` — `@mode emit` | nguyên văn tên + tham số + chế độ |
| `locale/` | `en.json` `zh.json` | **chép byte-for-byte** (`en 8baeed41…` · `zh 1ed2aba8…`) |
| Cơ chế thay row | cặp disable + insert, metadata `gbh` trong `package.json` — ADR 0004 §2/§11 | `app.patch.yml`: `- id: authorization` + `disabled: true` **và** `- insert: - id: authorization-ours` |

## 2. Bản đồ hành vi (đo từ bản gốc, rồi viết lại)

| Bề mặt | Việc |
|---|---|
| `static inject = ["credentials"]` | commit mà seam xác nhận **là** một lần ghi bản ghi credential ⇒ kho credential BẮT BUỘC |
| `registerFlow(flow)` | đăng ký MỘT luồng cho khoá của nó; **trùng khoá ⇒ ném `DUPLICATE_FLOW`**; trả disposer rút luồng **và** huỷ lượt đang chạy của khoá |
| `list()` · `describe(key)` | ảnh công khai **mới mỗi lần gọi**: `{ key, label, methods, inFlight }` |
| `cancel(key)` | rút lượt đang chạy; **đã vào pha commit thì KHÔNG cắt** (`committing = true`) |
| `begin(request)` | chạy MỘT lượt; trả `authorized` / `cancelled`; ném `NO_FLOW` · `UNKNOWN_METHOD` · `ALREADY_IN_FLIGHT` · `NOT_COMMITTED` · `CANCELLED` |
| `session.commit(record)` | `signal.throwIfAborted()` trước, kiểm **chính lượt này còn hiệu lực** (so **danh tính** `controller.signal`), bật `committing`, rồi `ctx.credentials.modifyRecord` |
| `session.notify` / `session.prompt` | bắn-rồi-quên: bề mặt ném ⇒ **ghi log, luồng vẫn chạy**; prompt bị từ chối bằng `AuthorizationDeclinedError` ⇒ ghi cờ `declined` để lượt kết thúc là `cancelled` |
| `authorization/settled` | phát **sau khi đã nhả khoá**; lỗi người nghe (đồng bộ **và** bất đồng bộ) **được bao lại**, không đổi kết cục |

### Năm ranh giới hành vi đã đo (đừng "sửa" cho gọn)

1. **Huỷ TRƯỚC khi bắt đầu ⇒ `cancelled` NGAY và KHÔNG phát `authorization/settled`**: `begin` trả sớm
   **trước** khi dựng lượt. Chỉ lượt ĐÃ dựng mới có sự kiện kết thúc.
2. **Chỉ chữ "không" của NGƯỜI mới đổi kết cục**: một luồng **tự ném `AuthorizationDeclinedError`** mà
   không đi qua `prompt` thì lỗi vẫn **ném ra** (`failed`), không thành `cancelled`.
3. **`NOT_COMMITTED` có HAI mặt**: luồng phân giải mà **không** commit, **hoặc** đã commit rồi **xoá** bản ghi
   (`describeRecord(key).configured === false`). Cả hai đều là "không có bản ghi trong lượt này".
4. **Lượt thứ hai bị TỪ CHỐI, không nhập chung** (`ALREADY_IN_FLIGHT`): hai bên gọi sẽ hỏi hai người khác
   nhau qua cùng một luồng.
5. **`commit` khoá theo DANH TÍNH tín hiệu**: nếu `running.get(key)` không còn (hoặc là tín hiệu của lượt
   khác) ⇒ `CANCELLED` — chống một luồng chạy trễ ghi vào lượt đã bị thay.

## 3. Peer (bảng §3b của `packages/README.md`)

| Peer | Bậc | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 — kernel | `Service` nền, `ctx.effect`/`ctx.on`/`ctx.events.dispatch`, tăng cường `Context`+`Events` |
| `@deepseek-ai/dsh-llm` | 2 — seam | `AuthorizationError extends HarnessError` ⇒ **phải CÙNG một lớp** thì `instanceof` của mọi gói mới đúng |
| `@deepseek-ai/dsh-credentials` | 2 — seam | `CredentialKey`/`CredentialRecord` + `modifyRecord`/`describeRecord` + sự kiện `credentials/record-updated` |

**KHÔNG có `dependencies`**: peer luôn là `peerDependencies` (kernel cấp ĐÚNG MỘT thể hiện) và mọi tên
trong `gbh.peers` đều có mặt ở `peerDependencies` — **so PHẦN TỬ**, có **ĐỐI CHỨNG ÂM** trong test.

## 4. Bảng TRƯỚC / SAU (cùng một phép đo, app 5439)

| Phép đo | TRƯỚC (row DSH stock) | SAU (gói của ta) | Diễn giải |
|---|---|---|---|
| Trang `/` (cookie jar) | 200 | **200 · 106.614 B** | row host không vẽ gì lên UI |
| `__DSH_BOOT__` | có | **có (`boot=1`) · 0 lỗi frontend** | nửa FRONTEND vẫn được cấp |
| Cặp patch | — | `- id: authorization` + `disabled: true` · `- insert: - id: authorization-ours` | phép (b) của M6-MOUNT-PLAN §3 |
| `did not activate` | 0 | **0** | row activate được, không treo |
| `check:rows` | 0 dòng `chan` | **0 dòng `chan`** cho gói này | export 4 = 4 so với chính bundle gốc |
| `gate --no-tests` | 7/7 | xem §6 | gói này **0 vi phạm** |

Lệnh tái lập: `bun test tests/host/authorization.test.ts` · `bun run check:rows | grep authorization` ·
`bun run gate --no-tests` · `bun run check:app`.

## 5. Test — 11 test / 182 expect, 0 fail

Chạy: `bun test tests/host/authorization.test.ts`.

| Ca | Chứng minh gì |
|---|---|
| ARTIFACT | tập export **4 = 4** so với chính bundle gốc · `default` = `AuthorizationService` · prototype **trùng tên từng phương thức** · `static inject` = `["credentials"]` · `grep -c "id: @deepseek-ai"` **= 0** · `build.ts` nhận `process.argv[2]` · `locale/{en,zh}.json` **byte-for-byte** |
| Hai lớp lỗi | `AuthorizationDeclinedError extends AuthorizationError` · mã `DECLINED` · **`instanceof HarnessError` của kernel** đúng cho cả hai bản |
| **Ma trận 10 kịch bản** | chạy CÙNG kịch bản trên **Context cordis THẬT của từng bản** (hai bản cài khác nhau): **cùng kết cục · cùng mã lỗi · cùng dấu vết commit · cùng chuỗi `authorization/settled` · cùng số phiên** |
| MỘT lượt mỗi khoá | `ALREADY_IN_FLIGHT` cho bên gọi thứ hai, lượt đầu vẫn xong `authorized` |
| `cancel()` | giữa lượt ⇒ `cancelled`, **0 lần ghi** · sau khi xong ⇒ no-op không ném |
| `commit` GỌI TRỄ | phiên của lượt ĐÃ XONG gọi `commit` ⇒ **`CANCELLED`** ("no longer active"), **0 lần ghi** — khoá theo **danh tính tín hiệu** |
| `DUPLICATE_FLOW` | ném đúng mã, **luồng đầu còn nguyên**, disposer chỉ rút đúng luồng của nó |
| `authorization/settled` | 3 người nghe (ném đồng bộ · reject bất đồng bộ · bình thường) ⇒ **cả ba đều chạy**, kết cục **không đổi**; chẩn đoán nêu đúng khoá + in **cả hai** lỗi; `notify` hỏng cũng được ghi log |
| **Ca BYTE** | bản ghi đi qua seam **NGUYÊN VẸN**: **cùng tham chiếu** (không copy, không round-trip JSON); `Uint8Array`/`DataView` còn nguyên byte — `String(view)` ≠ byte thật (ADR 0004 §8) |
| **C6 danh tính** | hai thực thể **độc lập** (đăng ký ở A không thấy ở B) · `describe`/`list` trả **vật thể MỚI** mỗi lần · **phiên của mỗi lượt RIÊNG** (khác `signal`, sửa một không lan sang kia) |
| Manifest | `gbh.peers ⊆ peerDependencies` **so phần tử** + **ĐỐI CHỨNG ÂM** (3 manifest thiếu phần tử) · `dependencies` rỗng · `gbh.row` khai **ĐÚNG** `id: authorization` + đúng file test |

## 6. Trạng thái mount + phần CHƯA làm

- **`config:` gốc: KHÔNG CÓ.** Trong dump mới nhất (`.parity/dumps/2026-10-18T01-31-57/ours.yml`
  L86–87) row `authorization` chỉ có `id` + `name`; **không một dòng `!!js` nào** ⇒ không có biểu thức
  `ctx.X` nào cần `inject` đi kèm (luật mới sau sự cố `web-runtime` **không áp dụng** — đã kiểm, không bỏ qua).
- **`gbh.row` do LEAD khai** (commit `83164c5`, sau khi đối chiếu artifact 4 = 4), **không phải tác giả gói**.
  Test canh đã **lật** sang khẳng định ngược: khai báo phải **đúng** `id: authorization` + đúng file test.
- **KHÁC HÌNH DẠNG CÓ Ý**: gói gốc có thêm subpath `exports["./types"]` (`lib/types/types.js` + `.d.ts`).
  Ta **không ship** subpath đó: đã quét toàn repo + `apps/host/node_modules` — **0 ai** `import`/`require`
  `@deepseek-ai/dsh-authorization/types` (chỉ chính gói gốc nhắc tới nó). Hai gói khai nó là **peer** trong
  `package.json` (`dsh-llm-pi-ai`, `dsh-deepseek-account-platform`) nhưng **0 file code** nào import gói này —
  chúng chỉ gọi `ctx.authorization`. Nếu sau này có người tiêu thụ subpath đó thì phải thêm `src/types.ts`
  làm điểm vào `exports["./types"]` **trước** khi dùng.
- Nửa host của row này **không có route HTTP nào**: bề mặt đo được là **tầng dịch vụ** (4 export + 1 sự kiện),
  nên nghiệm thu dùng **tập export** (M6-MOUNT-PLAN §1c) chứ không dùng slot/ảnh A/B.
- `locale/{en,zh}.json` được giữ vì runtime dùng `meta.title` làm **tiêu đề hàng trong màn Plugins**; thiếu
  file thì tiêu đề rơi về tên package của ta ⇒ khác oracle.
