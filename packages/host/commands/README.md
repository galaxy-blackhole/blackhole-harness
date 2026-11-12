<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Gói viết lại row commands của DSH: nguồn đối chiếu, vì sao peer, bảng TRƯỚC/SAU và phần chưa làm
-->

# @galaxy-blackhole/gbh-commands — row `commands` (Lệnh)

Sổ đăng ký **lệnh cho người** do plugin sở hữu, dùng chung cho mọi adapter UI tương tác.
Thay row `commands` của DSH bằng bản viết lại trung thành của `@deepseek-ai/dsh-commands`.

> Trạng thái: **đã viết xong**; **`gbh.row` do LEAD khai NGOÀI phiên viết gói** (mtime `package.json`
> 10:18:00 ngày 18/10/2026: `id: commands` + `tests`, **KHÔNG** `config`/`inject`/`moduleIds`/`aliases` —
> khớp đúng row gốc). Gói tự nó **không** khai; **chưa mount** (chờ lượt boot của Lead).

## 1. Nguồn đối chiếu (G4)

| Thứ | Đường dẫn (CHỈ ĐỌC) |
|---|---|
| Gói gốc | `apps/host/node_modules/@deepseek-ai/dsh-commands/` |
| Bundle gốc (oracle) | `apps/host/node_modules/@deepseek-ai/dsh-commands/lib/index.js` — **478 dòng** |
| Kiểu gốc | `lib/types/{index,types,brand}.d.ts` (159 + 120 + 31 dòng) |
| Từ điển | `locale/{en,zh}.json` — chép **byte-for-byte** (sha `205f598b…` · `fe4cd5aa…`) |

Bản gốc chỉ ship `lib/` (không có `src/`), nên mọi phép so hành vi đều đo trên **artifact**.

## 2. Bản đồ module của ta

| File | Vai trò | Nguồn gốc tương ứng |
|---|---|---|
| `src/index.ts` | `CommandRuntime` (service `commands`) + `name` + điều phối xuất | `lib/index.js` phần `CommandRuntime` |
| `src/layer.ts` | `CommandLayer`: bảng tên + thông điệp trùng tên theo phạm vi | `CommandLayer` |
| `src/normalize.ts` | `normalizeDefinition` · `normalizeResult` (ranh giới không tin cậy) | cùng tên trong gốc |
| `src/parse.ts` | `parseCommand` — biểu thức nguyên văn | `parseCommand` |
| `src/support.ts` | `abortError` · `cancellationOf` · `renderThrown` · `withAbort` | cùng tên trong gốc |
| `src/attachments.ts` | `admitCommandAttachments` (thuật toán hai lượt + khôi phục thứ tự) | cùng tên trong gốc |
| `src/brand.ts` | `CommandDefinitionId` · `CommandId` + kiểu `Branded` tại chỗ | `lib/types/brand.js` |
| `src/seq.ts` | `SessionSeq` (hàm ĐỒNG NHẤT, khai tại chỗ) | `@deepseek-ai/dsh-session` |
| `src/types.ts` | Từ vựng kiểu + hình dạng **cấu trúc** của agent/block | `lib/types/types.d.ts` |

Bề mặt service giữ nguyên: `register` · `registerFileReceiptResolver` · `list` · `find` ·
`execute`, hai endpoint Remote **`commands/list`** + **`commands/execute`** (`@Remote`, chế độ
`direct`), sự kiện `commands/change`, và hai sự kiện log `command/run` / `command/done`.

## 3. Vì sao từng peer (§3b)

| Peer | Bậc | Lý do ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 | `Context`/`Service`/`effect`/`events` — kernel; `TypertRemoteService` kế thừa `Service` của chính nó |
| `@deepseek-ai/dsh-typert-protocol` | 2 | `TypertRemoteService` + `@Remote`: Gateway discovery qua `typertRemote`; **phải là CÙNG lớp** thì marker mới thấy |
| `@deepseek-ai/dsh-scope` | 2 | `NamedEntries`/`ScopedLayers`: phạm vi khoá bằng **ký hiệu riêng của module** (`kScope`) — bản sao thì `scopeOf(ctx)` **không bao giờ khớp** ⇒ lớp theo agent chết im lặng |
| `@deepseek-ai/dsh-attachment` | ⚠️ ngoài bảng | `instanceof AttachmentError` (bản gốc dùng đúng phép này để biến lỗi nhận đính kèm thành **kết quả lỗi** thay vì ném) + `admitEncodedImages` (ghi ảnh vào store theo hợp đồng của chính store). Hai thể hiện ⇒ `instanceof` trượt ⇒ **đổi hành vi**. **Cần Lead duyệt** — xem §7 |

**Không** khai `dependencies` (peer luôn là một thể hiện do kernel cấp).

Ba peer **chỉ mượn KIỂU** nên KHÔNG khai (theo tiền lệ `system-prompt`): `dsh-llm`
(`ImageBlock`/`FileBlock`), `dsh-agent` (`Agent`), `dsh-brand` (`Branded`), và `dsh-session`
(`SessionSeq` — hàm đồng nhất). Thay vào đó `src/types.ts` khai hình dạng **cấu trúc** tương đương,
và `src/seq.ts` + `src/brand.ts` khai hàm nhãn tại chỗ.

## 4. Bảng TRƯỚC / SAU (đo trên artifact)

| Phép đo | TRƯỚC (bản gốc) | SAU (bản của ta) |
|---|---|---|
| Tập export trên `lib/index.js` | 6 (`CommandDefinitionId` · `CommandId` · `CommandRuntime` · `default` · `name` · `parseCommand`) | **6 = 6** — 0 thiếu · 0 thừa |
| `Object.getOwnPropertyNames(prototype)` | 11 | **11 = 11** |
| `remoteMethods(service)` | `list` + `execute`, cả hai `direct` | **y hệt, cùng thứ tự** |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |
| `dsh.client` / `lib/client.js` | KHÔNG / KHÔNG | KHÔNG / KHÔNG ⇒ **MỘT MẶT** |

## 5. Bằng chứng test

`tests/host/commands.test.ts` — **16 ca · 194 expect · 0 fail**. Mọi ca hành vi chạy **CẢ HAI**
bản (ta + **bundle gốc**) trên **Context cordis THẬT** của hai bản cài, rồi so **từng ký tự**
(`canonical` giữ cả `undefined`):

- `parseCommand`: 14 hình dạng dòng (tab/xuống dòng/`\r`/khoảng trắng cuối/dấu `!`/`NBSP`/…) — cùng kết quả, cùng ĐÓNG BĂNG;
- đăng ký: descriptor đã sắp theo tên, ĐÓNG BĂNG, giữ `definitionId`/`input`; trùng tên ⇒ **cùng thông điệp** (global + theo phạm vi); gỡ đăng ký nhả tên; `commands/change` báo **cả hai chiều**;
- phạm vi: lớp theo agent **che** lớp toàn cục — cùng kết quả hai bên;
- `execute`: kết quả + cặp `command/run`/`command/done` y hệt (chuẩn hoá `commandId`), id dạng `cmd-<8 hex>-<n>` tăng đơn điệu; `recordInput: false` bỏ `args`;
- đường lỗi: tên lạ/sai cú pháp ⇒ `undefined` và **0 bản ghi**; handler ném (Error + chuỗi) · trả sai hình dạng (9 hình dạng) · `Promise.reject` giá trị lạ ⇒ **cùng TypeError/thông điệp**, vẫn có `command/done` `error`;
- huỷ: trước khi chạy (không ghi gì) và trong handler (`withAbort` cắt chờ) — cùng lỗi, cùng bản ghi;
- đính kèm: không khai `input.attachments` / thiếu store ⇒ cùng kết quả lỗi; có store + bộ giải biên nhận ⇒ block theo **đúng thứ tự gửi** (tệp · ảnh · ảnh · tệp, tệp trùng giải một lần), biên nhận lạ ⇒ `AttachmentError`; không đính kèm ⇒ **cùng một mảng rỗng ĐÓNG BĂNG** cho mọi lượt (như gốc);
- **C6 danh tính**: hai bản cài có sổ riêng (cùng tên không ném), bộ đếm riêng (mỗi bên `-1`), token riêng, bộ giải biên nhận riêng; `list()` trả **mảng MỚI** nhưng **descriptor BỀN** — đo cả hai bên;
- **`gbh.peers` ⊆ `peerDependencies` 4/4, so PHẦN TỬ + ĐỐI CHỨNG ÂM** (xoá-một-tên · xoá-sạch · thừa-tên).

## 6. Khác biệt CÓ Ý (đã cân nhắc, không phải thiếu sót)

1. **Không ship subpath `./typert` / `./remote`.** Bản gốc ship `lib/typert.host.js` (937 dòng,
   **do `@galaxy-blackhole/gbh-typert-generator` sinh từ FaceModel**) + `lib/typert.remote-client.js`.
   Đo được: `typert-loader` chỉ nạp gói có export `./typert`, và khi **không** khai trong
   `config.packages` thì thiếu nó là **im lặng** (không ném); còn **discovery + dispatch** của
   Gateway chạy bằng `remoteMethods()` phản chiếu trên chính lớp — test chứng minh hai endpoint
   hiện ra y hệt. Viết tay một FaceModel sinh tự động là **tạo nguồn lệch thứ hai**; nếu Lead muốn
   parity cả tệp sinh, đó là việc chạy lại generator chứ không phải chép tay.
2. **`randomUUID` lấy từ `node:crypto`** thay vì peer `dsh-util-crypto` (gói đó nằm ngoài bảng
   §3b và bản gốc khai nó ở `dependencies`). Cùng hình dạng UUID v4 ⇒ cùng độ dài tiền tố 8 ký tự.
3. **Không augment `Context`/`Events`/`SessionEventMap`.** Bản gốc khai `declare module` trong
   `.d.ts`; augment trong gói của ta sẽ **đụng** khai báo của gói gốc khi cả hai vào cùng chương
   trình tsc (bài học `TS2717` của `system-prompt`). Bề mặt chạy **không đổi**: `ctx.commands`
   vẫn do `Service` đăng ký, `ctx.events.dispatch` nhận `string`.
4. **Hai phép ép kiểu trong `src/attachments.ts`** (`imageRefs[i]`, `files.get(...)`) **không sinh
   mã lúc chạy**: hợp đồng `saveImages` trả đúng một tham chiếu mỗi ảnh, và lượt 1 đã giải mọi biên
   nhận tệp hoặc đã ném. Chúng chỉ để `noUncheckedIndexedAccess` không báo oan.

## 7. Còn lại (bàn giao)

- **⚠️ Cần Lead duyệt peer `@deepseek-ai/dsh-attachment`** — nằm **ngoài** bảng §3b; lý do đo được
  ở §3. Nếu Lead không duyệt, hai lựa chọn: (a) bỏ nhánh đính kèm (mất chức năng so với gốc — KHÔNG
  khuyến nghị), hoặc (b) chờ tới khi bảng §3b bổ sung dòng `dsh-attachment`.
- **`gbh.row` do LEAD khai NGOÀI phiên viết gói** (mtime 10:18:00 ngày 18/10/2026, hình dạng
  `{ id: "commands", tests: [...] }` — có ca canh hình dạng trong test, đọc **cả hai dạng**). Gói này
  **không tự khai**. Sau khi Lead khai, `check:rows` **đã kiểm luôn gói này** (107 package · 0 `chan`).
- **CHƯA** `lab:row`, **CHƯA** mount 5439, **CHƯA** `check:app`, **CHƯA** A/B pixel. Đó là việc của lượt boot của Lead.
- **CHƯA** viết nửa client (`lib/client.js`) — **không cần**: bản gốc **MỘT MẶT**.
