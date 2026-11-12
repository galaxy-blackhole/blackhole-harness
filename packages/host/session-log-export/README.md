<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row session-log-download (@deepseek-ai/dsh-session-log-export) —
      CHỈ nửa HOST, port 1:1 565 dòng lib/index.js, đối chứng trên Context cordis thật; KHÔNG khai gbh.row
      vì gói gốc HAI MẶT (nửa client 317 dòng CHƯA port)
-->

# @galaxy-blackhole/gbh-session-log-export — CHỈ NỬA HOST

> Row `session-log-download` (PARITY-MATRIX dòng 100, tier **T1**, chủ M3).
> Gói gốc **HAI MẶT**: `dsh.client` (5 inject, `platform: web`) + `lib/client.js` **317 dòng** (bảng tải +
> hộp thoại dùng chung). Gói này **chỉ port nửa HOST** (565 dòng) ⇒ **KHÔNG khai `gbh.row`** — quy ước
> `file-upload`/task-22: mount một nửa của gói hai mặt = **mất nửa client** ⇒ mất hộp thoại tải **âm thầm**.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `session-log-download` (tier T1 · ma trận dòng 100) | `@galaxy-blackhole/gbh-session-log-export` |
| Package | `@deepseek-ai/dsh-session-log-export` @0.2.1-alpha.4 | `@galaxy-blackhole/gbh-session-log-export` @0.1.0 (private) |
| **Nửa host** | `lib/index.js` **565 dòng** | `src/{index,archive,routes,types}.ts` — port 1:1 |
| **Nửa client** | `lib/client.js` **317 dòng** + `dsh.client` 5 inject | **CHƯA port** ⇒ không khai `dsh.client`, không khai `gbh.row` |
| `.d.ts` | `lib/types/{index,archive,routes}.d.ts` (162 dòng) | dùng làm **nguồn kiểu**, khai lại thành `src/types.ts` |
| `locale/{en,zh}.json` | có (`meta.title` = `session-log-export`) | **chép byte-for-byte** (sha256 khớp) |
| Peer | `cordis` · `dsh-session` · `dsh-session-persistence` (peer) · `dsh-brand` · `dsh-session-format` · `schemastery` · `fflate` (dep) | **tất cả thành `peerDependencies`** + `gbh.peers` (xem §3) |

## 2. Bề mặt đã port — 14 export, BẰNG TỪNG TÊN bản gốc

`name` (`session-log-download`) · `inject` (`commands` · `connection`) · `apply` · `Config` ·
`DEFAULT_SESSION_LOG_COMPRESSION_LEVEL` (6) · `SESSION_LOG_EXPORT_PATH` (`/api/session.export`) ·
`SESSION_LOG_FILENAME` (tên log canonical của thế hệ hiện tại) · `serializeSessionLog` · `readSessionLogText` ·
`flushLiveSessionLog` · `sessionLogExportDeps` · `sessionLogZipEntries` · `sessionLogZipFilename` ·
`streamSessionLogZip`.

Hành vi: đăng ký lệnh `/export` (chỉ Web) qua `ctx.effect`, đăng ký route `GET|HEAD /api/session.export`
trên tầng vận chuyển; route trả **400** (thiếu/sai `sessionId` · sai `includeDescendants`), **500** (thiếu
service, hoặc đọc log hỏng), **404** (phiên không tồn tại), **200** (ZIP theo luồng, `fflate` streaming, trần
64 KiB cho hàng đợi phản hồi). ZIP gồm: log gốc → từng subagent (`subagents/<id>/…`) → ảnh
(`media/<attachmentId>.<ext>`, khử trùng theo nội dung) → tệp (`files/<2>/<digest>/<name>`, tên đã làm sạch).

## 3. Peer — vì sao `fflate` cũng là peer (ngoại lệ CÓ LÝ DO, xin Lead duyệt)

* `cordis` · `schemastery`: kernel cấp schema/Context — **một thể hiện** (bảng §3b bậc 1).
* `dsh-session` · `dsh-session-format` · `dsh-session-persistence`: cần **CÙNG lớp/dữ liệu** của kernel.
  Cụ thể `SessionPersistenceNotFoundError` được bắt bằng `instanceof` — hai bản sao là **hai lớp khác nhau** ⇒
  phiên không tồn tại sẽ thành **500** thay vì **404**. Vì thế BẮT BUỘC peer.
* `dsh-brand` (`brandString`): chuỗi brand dùng làm `definitionId` của lệnh; một thể hiện để không lệch.
* `dsh-attachment` · `dsh-session-query`: **chỉ dùng kiểu** (`AttachmentStore` · `SessionQueryEngine`).
* `fflate`: **thư viện thứ ba** — bản gốc khai `dependencies`. Ta khai **peer** vì `apps/cli/src/mount.ts`
  **chỉ symlink `peer` vào `profiles/node_modules`**; khai `dependencies` thì lúc chạy trong profile **không có
  module** ⇒ route chết. Đây là ngoại lệ ngoài bảng §3b, đã ghi để Lead duyệt.

## 4. Bằng chứng — test đối chứng trên Context cordis THẬT

`tests/host/session-log-export.test.ts` — **29 ca / 167 expect / 0 fail**. Mỗi ca dựng **HAI giàn GIỐNG HỆT**
(Context cordis thật + service đắp bằng `ctx.provide`) rồi chạy **cả hai** bản cài:

| Mục | Ca đo |
|---|---|
| A | 14 export **BẰNG TỪNG TÊN** bản gốc trên ARTIFACT; artifact là ESM, không có `__ModuleLoader__`/`window.` |
| B | `name` · `inject` · hai đường dẫn · tên tệp log · mức nén mặc định **BẰNG**; `String(Config)` **TRÙNG TỪNG KÝ TỰ**; cấu hình sai (10 · -1 · 1.5 · chuỗi) **NÉM ở cả hai bên** |
| C | `serializeSessionLog` **BẰNG TỪNG BYTE**; dòng đầu `type: session`; `delegationDepth` mặc định 0; trường tuỳ chọn có/không |
| D | `sessionLogZipFilename` **BẰNG** cho id thường và id nguy hiểm (`../`, dấu cách, unicode, rỗng) |
| E | `readSessionLogText`: ca thường **BẰNG** + `close()` đúng 1 lần; phiên không tồn tại ⇒ **undefined** ở cả hai (dùng **đúng lớp** `SessionPersistenceNotFoundError` của kernel); lỗi khác **ném lại nguyên vẹn**; signal được **chuyển tiếp** và lỗi huỷ **y hệt** |
| F | `flushLiveSessionLog`: phiên sống flush **1 lần**; phiên lạ/vắng sổ **không flush**; signal đã huỷ ⇒ **ném trước khi flush**; lỗi flush **ném lại** |
| G | `sessionLogExportDeps` trên **Context thật**: hai bên trả **cùng** service; Context rỗng ⇒ cả bốn `undefined` |
| H | `sessionLogZipEntries`: **đúng thứ tự** gốc → 2 subagent → ảnh → tệp; **ảnh dùng chung chỉ MỘT mục**; `includeDescendants=false` ⇒ 3 mục; subagent thiếu log ⇒ **cùng thông điệp** (fail-loud) |
| I | `streamSessionLogZip`: **ZIP BẰNG TỪNG BYTE** khi đóng băng `Date.now` (fflate nhúng thời gian vào header); mức 9 so mức 0; signal huỷ ⇒ lỗi ở cả hai |
| J | `apply` trên Context thật: **1 lệnh + 1 route** đúng hình dạng; `/export` chuỗi rỗng ⇒ REQUESTED, có đường dẫn ⇒ lỗi (**BẰNG từng ký tự**); route **400/404/500/200/HEAD** với thân/header **BẰNG** bản gốc |
| K | `locale` **byte-for-byte** + `meta.title`; `package.json` **KHÔNG `gbh.row`** (ghi lý do) + `gbh.peers ⊆ peerDependencies`; **chỉ gói này** khai `name = "session-log-download"` trong repo (bài học trùng tên service) |

## 5. Lệnh

```bash
bun run build.ts                                   # → lib/index.js (ESM, node) — nhận outDir qua argv[2]
bun test tests/host/session-log-export.test.ts     # 29 ca đối chứng
bun run check:rows                                 # gói này KHÔNG khai gbh.row ⇒ cổng bỏ qua (an toàn có chủ đích)
```

## 6. CHƯA làm — điều kiện để khai `gbh.row`

1. **Nửa client** (317 dòng + `dsh.client` 5 inject): bảng tải + hộp thoại dùng chung — port + test byte-parity
   + đăng ký **một id** `@galaxy-blackhole/gbh-session-log-export` + `gbh.row.aliases` = id gốc.
2. Chỉ khi đó mới khai `gbh.row` (id `session-log-download`), chạy `check:rows` + `lab:row` + boot-smoke, rồi
   nhờ reviewer ký.
3. `locales-vi` cho namespace `session-log-download` đã nằm trong bảng đăng ký tập trung của `gbh-client-locale`
   (HANDOVER §2.2) ⇒ khi mount cần đo lại độ phủ vi.
4. **ĐO row stock có bị TẮT CÓ ĐIỀU KIỆN không** (để biết có phải dùng `insertDisabled`): đọc tệp patch
   ĐANG CHẠY (`~/.galaxy/blackhole/app.patch.yml`, 1.341 dòng, 135 dòng `disabled`) — **KHÔNG** có mục nào
   `- id: session-log-download` (cũng không có `dsh-session-log-export`) ⇒ row stock **BẬT VÔ ĐIỀU KIỆN**
   ⇒ lúc mount **không cần** `insertDisabled`, chỉ cần khối thay thế thường. (Không chạy `bh host --dump-config`
   vì lệnh đó ghi lại patch của app đang chạy.)
