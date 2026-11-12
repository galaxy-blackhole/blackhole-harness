<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc NỬA HOST của row remote-access — nguồn đối chiếu G4, lý do CHỈ nửa host và KHÔNG khai gbh.row,
      bảng hành vi TRƯỚC/SAU, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-api-remote-access (NỬA HOST)

Bản viết lại **1:1** phần **HOST** của `@deepseek-ai/dsh-api-remote-access`: **sổ chính sách truy cập mức
phương thức**, **quyết định allow/deny** cho Gateway, **lọc mục danh sách** qua `allows()`, và **ảnh chụp
quyền** theo Peer (`baseline` + `upsert`/`remove`).

## 0. Vì sao CHỈ nửa host và **KHÔNG** khai `gbh.row`

Row `remote-access` **đang BẬT** trong app (`.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng 38–39, KHÔNG
`disabled`) và gói gốc là gói **HAI MẶT**:

| Bằng chứng đo được | Số đo |
|---|---|
| `package.json.dsh.client` | `inject: [@deepseek-ai/dsh-api-gateway, @deepseek-ai/dsh-client-ui-renderer]` · `external: [@deepseek-ai/dsh-api-gateway/client]` · `platform: web` |
| Nửa client | `lib/client.js` **732** dòng + `lib/types/client/*` **285** dòng |
| Manifest Remote | `lib/typert.host.js` **233** dòng + `lib/typert.remote-client.js` **75** dòng |
| Tổng gói gốc | **2.183** dòng (host ~858 · client ~1.017 · typert ~308) |

Cặp `disable + insert` của tầng mount sẽ **xoá nửa client khỏi đồ thị boot** — sự cố có thật của
`typert-gateway` (63 entry pending, trang còn **68 B**). Vì vậy gói này **chỉ khai nửa host**, **KHÔNG khai
`gbh.row`** (ghi trong `gbh.draft`) ⇒ **không thể được mount** ⇒ không thể làm hỏng app của người khác.

**Kiểm trùng tên TRƯỚC khi viết** (đúng luật Lead): không package GBH nào khác cấp khoá service
`remoteAccess`; gói này giữ đúng khoá đó, đúng namespace `remoteAccess`, đúng 1 marker `@Remote`.

## 1. Nguồn đối chiếu (G4)

| Hành vi | Bản gốc (`lib/index.js`) | Bản của ta (`src/`) | Bằng chứng |
|---|---|---|---|
| Tập export | `REMOTE_ACCESS_SNAPSHOT_KEY · RemoteAccessService · default` | **bằng** (3 = 3), `default === RemoteAccessService` | đo trên ARTIFACT |
| Khoá service | `super(ctx, "remoteAccess")` | y nguyên | dựng service không ném |
| Marker Remote | `follow` mode `stream`, invocation `direct` | y nguyên | `remoteMethods()` trả **cùng** mảng |
| Chèn index | `inject(["webServer"])` → `on("webserver/index-inject")` → `{kind:'global', name:'__DSH_REMOTE_ACCESS__', value:{type:'baseline', owner:true}}` | y nguyên | bảng chèn **bằng** |
| Vòng đời | `effect` nhãn `remoteAccess: snapshot generations`, huỷ `lifetime` | y nguyên | dòng `follow` **kết thúc** khi dọn |
| `registerPolicy` | trùng loại ⇒ `remote access: principal kind "X" already has a policy`; dọn ⇒ gỡ + `invalidate()` | y nguyên | thông điệp **bằng**; `allows()` **true → false** sau dọn |
| `decide` | chủ ⇒ allow · `remoteAccess/follow` ⇒ allow · không chính sách ⇒ `no-allow` · mọi tài nguyên phải cho phép | y nguyên | 4 nhánh, **cùng** kết quả |
| Điều kiện | nhận `args` của lời gọi; deny kèm lý do; **ném** ⇒ `policy-failed` + log **MỘT lần**/chính sách tới `invalidate()` | y nguyên | log **2 → 4** dòng sau `invalidate()` |
| `bindings()` ném | `policy-failed` (không ném ra ngoài) | y nguyên | kết quả **bằng** |
| `explain()` | dùng khi từ chối; ném ⇒ `policy-failed` | y nguyên | lý do `you-own-nothing` **bằng** |
| `bindings()` số lần | **MỘT** lần mỗi `decide()` | y nguyên | bộ đếm = **1** |
| `allows()` | ngoài lời gọi ⇒ true · chủ ⇒ true · Peer ⇒ theo chính sách · lỗi/không chính sách ⇒ false | y nguyên | 6 nhánh **bằng** |
| `snapshotFor()` | chủ ⇒ `{owner:true}`; Peer ⇒ quyền: hành động **đã sắp xếp**, **bỏ** `event:`, gộp tài nguyên trùng, tài nguyên không còn hành động ⇒ **không cấp** | y nguyên | ảnh chụp **bằng** |
| `follow()` | Peer: 1 baseline rồi `upsert`/`remove` sau `invalidate()`; chủ: **chỉ** baseline và giữ mở | y nguyên | dòng **bằng** cả ba khung |

## 2. Peer và lý do

| Peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 (kernel) | kiểu `Context` — **chỉ mượn kiểu** (bị xoá lúc build) |
| `@deepseek-ai/dsh-typert-protocol` | 2 (seam RPC) | `Remote` + `TypertRemoteService` + `principalOf` — **nạp lúc chạy**; marker phải do **cùng** thư viện sinh thì Gateway mới thấy |

⇒ `gbh.peers` = 1 tên **⊆ `peerDependencies`**; `dependencies` **RỖNG**. Seam `effect`/`inject`/`logger`/
`invocation`/`webServer` khai **theo CẤU TRÚC** trong `src/seams.ts` (luật 000d).

## 3. Test — 15 ca · 64 expect · 0 fail

```bash
~/.bun/bin/bun test tests/host/api-remote-access.test.ts
```

Giàn đo: **Context cordis THẬT** + Proxy đắp `effect` (trả **disposer thật**) · `inject` (giả `webServer` có
`on`) · `logger` (ghi vết) · `invocation` (đặt được để mô phỏng Peer/Chủ). **Cùng một giàn** cho bản của ta
và **bundle gốc** ⇒ mọi khác biệt quy được về **ruột gói**.

| Nhóm | Số ca | Đo cái gì |
|---|---|---|
| Bề mặt + dựng service | 3 | export (3 = 3) · chèn index + nhãn hiệu ứng · marker `follow` stream |
| registerPolicy/allows | 2 | thông điệp trùng + dọn gỡ · 6 nhánh `allows()` |
| `decide()` | 4 | chủ/follow/no-policy · vai thiếu hành động + nhiều tài nguyên · điều kiện + args + `policy-failed` ghi log một lần · `bindings`/`explain` ném |
| `snapshotFor`/`follow` | 4 | sắp xếp + bỏ `event:` + gộp tài nguyên · chủ chỉ baseline · Peer baseline→upsert→remove · kết thúc khi unload |
| Quy ước repo | 2 | **không `gbh.row`** + 4 đối chứng dương gói HAI MẶT · peers/dependencies |

## 4. TRƯỚC / SAU

| | TRƯỚC (row gốc, đang bật) | SAU (gói này) |
|---|---|---|
| Row trong app | `remote-access` = `@deepseek-ai/dsh-api-remote-access` (bật, hai mặt) | **không mount** — chưa khai `gbh.row` |
| Nửa host | `lib/index.js` 441 + `lib/types/*` 417 | **`src/` 6 tệp**, cùng bề mặt host |
| Tập export | 3 tên | **bằng** (3 = 3) |
| Test | — | **15 pass / 0 fail / 64 expect** |
| `grep -c 'from "@deepseek-ai/cordis"'` trên artifact | — | **0** |

## 5. Phần CHƯA làm (nói thẳng)

1. **Nửa client** (`lib/client.js` 732 + `lib/types/client/*` 285 + `mount/state`) và **manifest Remote**
   (`typert.host` 233 + `typert.remote-client` 75) — chưa có ⇒ **không mount được**.
2. Chưa đo hành vi thật qua Gateway (cần nửa client + `dsh-api-gateway` đã chuyển).
3. Gói gốc còn một dòng `declare module '@deepseek-ai/dsh-typert-protocol'` khai `RemoteErrorDetailsMap`
   cho `remote-access/denied` — chỉ là **kiểu**, thuộc nửa client/Gateway ⇒ chưa cần ở nửa host.

## 7. Bản viết tay cũ (giữ lại 19/10/2026)

Trước khi de-bundle lại theo khuôn `api-session-controller`, gói này được port **viết tay** 7 module trong `src/`
(`compare` · `follower` · `index` · `seams` · `service` · `snapshot` · `types`). Nay toàn bộ được **chuyển nguyên văn vào
`src-handwritten/`** — không build, không nằm trong artefact, chỉ để tham chiếu/lịch sử (quyết định của Lead: không xoá công người trước).

## 8. Cạm bẫy ĐO ĐƯỢC ở gói này (19/10/2026)

`lib/client.js` có **7 lần** chuỗi id stock, nhưng **chỉ 1 lần là id module** (dòng 2, trong `__ModuleLoader__.load`).
6 lần còn lại là **dữ liệu**: `package: "@deepseek-ai/dsh-api-remote-access"` (dòng 224), `typeSymbol: "…/types#RemoteAccessFrame"` (234),
và 4 dòng JSDoc `@module …/src/snapshot | src/client/state | src/client/mount | client` (440/449/634/714).
Vì vậy cổng ownership **không thể** dùng luật “không còn id stock” (luật đó đúng cho các gói chỉ có 1 lần id ở dòng loader);
cổng ở đây kiểm: (a) chuẩn hoá id ta→stock ⇒ **byte-identical**, (b) **số lần id của ta = số chỗ đã đổi** (`CLIENT_ID_REPLACEMENTS = 1`,
`TYPERT_HOST_ID_REPLACEMENTS = 3`, `TYPERT_REMOTE_ID_REPLACEMENTS = 2`) ⇒ bắt được lỗi “quên đổi dòng loader” mà vẫn cho phép id stock nằm trong dữ liệu.
