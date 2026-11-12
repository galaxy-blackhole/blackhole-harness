<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README gói @galaxy-blackhole/gbh-approval — nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU, C6 danh tính, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-approval

Bản viết lại của Galaxy Blackhole cho row **`approval`** của DSH (tier T4, nhóm `interaction`):
seam DUYỆT CỦA NGƯỜI — service `ctx.approval` hỏi một quyết định MỘT LẦN cho một thao tác cần cấp
quyền, qua waterfall `approval/request` có lọc phạm vi agent, kèm cặp sự kiện kiểm toán
`approval/asked` + `approval/decided` trên nhật ký phiên, và chính sách duyệt theo phiên
(`ask` · `never`) đưa vào ngữ cảnh model.

## 1. Nguồn đối chiếu (G4)

| # | Nguồn (CHỈ ĐỌC) | Đọc gì | Mức dẫn xuất |
|---|---|---|---|
| 1 | `apps/host/node_modules/@deepseek-ai/dsh-user-approval/lib/index.js` (**192 dòng**) | toàn bộ thân bundle: `OUTCOMES` · `APPROVAL_POLICIES` · `NEVER_SENTENCE`/`ASK_SENTENCE` · `hasOpenTurn` · `setApprovalPolicy` · lớp `ApprovalService` (constructor + `setPolicy` + `request` + `effectivePolicy` + `overrideOf` + `decide`) | **viết lại theo hành vi** (không chép code); HAI CHUỖI ngữ cảnh model, thông điệp "outside an open turn", thông điệp `TypeError` và chuỗi thông báo chuyển chính sách giữ **nguyên văn** vì đó là hành vi nhìn thấy được |
| 2 | `…/lib/types/index.d.ts` (158 dòng) + `…/lib/types/types.d.ts` (83 dòng) | hợp đồng công khai: 5 export, `Config`, `ApprovalRequest`/`ApprovalRequestEvent`, `ApprovalOutcome`, `ApprovalPolicy`, và BA phép khai kiểu (sự kiện phiên · nguồn tin nhắn `user-approval` · waterfall `approval/request`) | tham chiếu |
| 3 | `…/package.json` (56 dòng) | `dsh.client` **KHÔNG có** ⇒ thuần host; `exports`; peer gốc (7); `dependencies`: `schemastery` | tham chiếu |
| 4 | `…/locale/{en,zh}.json` | `meta.title` cho màn Plugins | **chép byte-for-byte** (shasum khớp: `b8c1ee86…` · `8e3d572d…`) |
| 5 | `docs/PARITY-MATRIX.md` dòng 44 · `docs/contracts/data/dsh-packages.json` (`id: approval`, `disabled: false`) · `.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng **206–211** | row ↔ gói gốc, trạng thái BẬT, `config` gốc | tham chiếu |

Ba phần KHÔNG chép nguyên văn mà viết lại, có lý do ĐO ĐƯỢC:

1. **Kiểu `Agent`** — bản gốc import `Agent` từ `@deepseek-ai/dsh-agent`; ta cũng dùng **đúng kiểu đó**
   nhưng chỉ ở tầng KIỂU (`devDependencies`, không phải peer) — cùng lối `packages/host/workflow`.
   Lý do bắt buộc: trong MỘT chương trình `tsc` của repo, gói khác đã nạp `@deepseek-ai/dsh-user-approval/types`
   (qua `dsh-api-remotes`), nên khai `Scoped<Agent>` bằng một `Agent` **khác hình dạng** làm
   `ctx.waterfall()` không chọn được overload (đã đo: TS2769). Dùng đúng kiểu kernel là cách duy nhất vừa
   trung thành vừa không tạo xung đột.
2. **Đường tra seam `systemPrompt`** — tra theo HÌNH DẠNG qua một phép cast (`src/prompt.ts`), không import
   gói seam (cùng lối `packages/host/sandbox-policy`). Nhờ vậy `dsh-system-prompt` **không** thành peer.
3. **Không ship artifact `./types`** — bản gốc có subpath `./types` (`lib/types/types.js`) chỉ chứa hàm
   đóng thương hiệu. Ta để hàm đó ở `src/types.ts` và xuất từ entry: **tập export lúc chạy y hệt**, và
   trong repo/profile **không có** người tiêu thụ nào `import "@deepseek-ai/dsh-user-approval/types"`
   (`grep -rn "dsh-user-approval" --include='*.ts'` ⇒ 0 file). Đây là khác biệt ĐÃ BIẾT, ghi ở §6.

## 2. Peer — vì sao, và thuộc seam nào

| Peer | Thuộc seam | Vì sao cần |
|---|---|---|
| `@deepseek-ai/cordis` | vòng đời plugin + `Service`/`Context` (bậc 1 §3b) | lớp service PHẢI là **cùng một instance** `Service` mà kernel cấp (đăng ký `ctx.approval`), và `ctx.waterfall`/`ctx.inject` là API của kernel |
| `@deepseek-ai/schemastery` | schema `Config` (bậc 1 §3b) | `static Config = z.object({ policy: z.union(["ask","never"]).default("ask") })` — Settings/config-editor render từng trường; **schema phải là cùng thư viện** với kernel |
| `@deepseek-ai/dsh-llm` | seam `dsh-llm` (bậc 2 §3b) | `createUserMessage` — tin nhắn thông báo chuyển chính sách phải là **cùng lớp/đóng băng như kernel**, mang `id` từ `dsh-util-crypto`, không thể tự dựng |
| `@deepseek-ai/dsh-scope` | seam `dsh-scope` (bậc 2 §3b) | `scopeTarget(agent, agent)` — **vật mang phạm vi không thể tự chế**: bộ lọc của nó là kênh duy nhất để người nghe gắn phạm vi agent nhận đúng yêu cầu |
| `@deepseek-ai/dsh-session` | seam `dsh-session` (**bậc 2 mở rộng** — xem dưới) | `SessionSeq(seq)` — **KHÔNG phải hàm đồng nhất**: nó `throw TypeError` khi `seq` không là số nguyên an toàn ≥ 0 (đo: `dsh-session/lib/index.js:21-24`); tự viết lại là **mất một đường lỗi thật** |

Đúng năm peer, đều là `peerDependencies` **và** `devDependencies`, **không** khai `dependencies`
(`dependencies` rỗng — đã có test). `@deepseek-ai/dsh-agent` **chỉ mượn KIỂU** nên nằm ở
`devDependencies` và **không** vào `gbh.peers` (tiền lệ `packages/host/workflow`).

`dsh-session` không có tên trong bảng §3b: **lý do ĐO ĐƯỢC** ở trên (hàm có kiểm tra), và
`docs/PARITY-MATRIX.md` dòng 44 (cột *Phụ thuộc*: `cordis, dsh-agent, dsh-brand +4`) đã ghi
`dsh-session` là phụ thuộc của **chính row này** ⇒ **cần Lead xác nhận** việc mở rộng §3b.

## 3. Bề mặt phải khớp (đo trên ARTIFACT)

| Hạng mục | Giá trị |
|---|---|
| Export | `APPROVAL_POLICIES` · `ApprovalRequestId` · `ApprovalService` · `default` (= `ApprovalService`) · `setApprovalPolicy` — **5 tên, y bản gốc** |
| Service | đăng ký `ctx.approval`; `static Config` (schemastery, `policy` mặc định `'ask'`); **KHÔNG** có `static inject` (y bản gốc) |
| Trường | `config` (công khai, y `d.ts` gốc) |
| Phương thức trên prototype | `constructor` · `setPolicy` · `request` · `effectivePolicy` · `overrideOf` · `decide` — **đúng 6 tên, trùng gốc** |
| Kết quả | `allowed-once` (cấp duy nhất) · `rejected` · `cancelled` · `unavailable`; ngoài từ vựng ⇒ `unavailable` |
| Kiểm toán | đúng **một cặp** `approval/asked` (id, toolName, callId?, reason?) + `approval/decided` (id, outcome), **cùng một id** |
| Tiền đề | `request()` **NÉM** khi không có lượt mở, **trước** khi ghi bất cứ gì (thông điệp nguyên văn) |
| Chính sách | `approval/policy` (sự kiện CUỐI thắng) > `config.policy` > `'ask'`; `'never'` ⇒ `rejected` **không hỏi ai** |
| Ngữ cảnh prompt | mục `approval:policy`, `order = getContextOrder("APPROVAL_POLICY")`, chữ theo chính sách hiệu lực; **không agent ⇒ chuỗi rỗng** |
| Chuyển chính sách | `setPolicy` ghi **một** `approval/policy` + đẩy **một** tin nhắn nguồn `user-approval` (chỉ khi ĐỔI) |

## 4. TRƯỚC/SAU và lệnh tái lập

| Phép đo | TRƯỚC (bản gốc) | SAU (bản của ta) |
|---|---|---|
| 6 kịch bản lượt hỏi (có/không `callId`+`reason` · `never` · không người trả lời · giá trị lạ · người trả lời ném) | oracle | **cùng outcome · cùng nhật ký · cùng số lần gọi người trả lời** |
| Huỷ TRƯỚC / huỷ GIỮA lượt | oracle | **cùng `cancelled`, câu trả lời muộn bị bỏ** |
| 5 hình dạng nhật ký cho tiền đề "lượt mở" | oracle | **cùng ném/không ném, cùng thông điệp** |
| `String(Config)` · ghi `approval/policy` · `TypeError` khi chính sách lạ | oracle | **trùng từng ký tự** |
| Ngữ cảnh prompt (ask / never / không agent) | oracle | **trùng từng ký tự** |
| Tập export trong artifact | 5 tên | **5 tên, y hệt** |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |

```bash
cd packages/host/approval && bun run build.ts        # ⇒ lib/index.js (ESM)
grep -c "id: @deepseek-ai" lib/index.js              # ⇒ 0
cd ../../.. && bun test tests/host/approval.test.ts  # ⇒ 8 pass / 0 fail / 105 expect
bun run check:rows                                   # gói này: 0 dòng `chan` (98 package TẤT CẢ đạt)
bun run gate --no-tests                              # các cổng của gói này XANH
```

**Vì sao chưa có bảng TRƯỚC/SAU trên app thật**: gói CHƯA khai `gbh.row` (xem §6) ⇒ chưa mount ⇒
chưa có phép đo trên app 5439. Mọi phép đo ở trên đều trên **artifact** hoặc **đối chứng trực tiếp
với chính bundle gốc** trên Context cordis THẬT.

## 5. Test

`tests/host/approval.test.ts` — **8 ca / 105 expect**, mọi phép so đều chạy CẢ HAI bản:

1. **ARTIFACT**: build bằng chính `build.ts`, nạp artifact, so **tập export** (5 = 5) với bundle gốc,
   `default === ApprovalService`, **tên phương thức trên prototype** (6 = 6), `APPROVAL_POLICIES`,
   `grep` hai chiều `id: @deepseek-ai` / `id: @galaxy-blackhole` ⇒ **0**, và `locale/{en,zh}.json`
   **byte-for-byte** so với gói gốc.
2. **Cặp kiểm toán + kết quả**: 6 kịch bản ⇒ cùng outcome, cùng nhật ký (id chuẩn hoá), cùng số lần
   gọi người trả lời; neo thêm giá trị cụ thể (`never` ⇒ `rejected` + **0 lần hỏi**, không người trả
   lời ⇒ `unavailable`, giá trị lạ ⇒ `unavailable`, người trả lời ném ⇒ `unavailable`).
3. **Huỷ**: tín hiệu đã huỷ TRƯỚC ⇒ `cancelled` (0 lần hỏi); huỷ GIỮA lượt ⇒ `cancelled` và câu trả
   lời muộn **bị bỏ** (y bản gốc).
4. **Tiền đề lượt mở**: 5 hình dạng nhật ký (rỗng · `turn/start` · `turn/start+turn/end` ·
   `turn/end+turn/start` · có `user/message`) ⇒ cùng quyết định; khi ném thì **không ghi gì**.
5. **Chính sách**: `String(Config)` trùng; đường ghi 1 sự kiện trùng; `TypeError` trùng thông điệp;
   ghi đè cuối cùng thắng và `overrideOf` hai bên bằng nhau.
6. **Ngữ cảnh prompt**: đúng MỘT mục `approval:policy`, `order` hỏi bằng `APPROVAL_POLICY`, chữ ba
   trạng thái (ask · never · không agent) **trùng bản gốc**.
7. **C6 — DANH TÍNH** (không phải so sâu): hai thực thể service **khác nhau** và **không dùng chung**
   vật thể cấu hình (sửa bản này không lan sang bản kia); hai lượt hỏi cho **hai vật thể kiểm toán
   riêng** (sửa `asked[0].data` không đổi `asked[1].data`); `setPolicy` trên hai agent cho **hai
   message riêng** (id riêng, đóng băng); ghi đè chính sách **theo phiên** không lan sang phiên khác.
8. **`gbh.peers` ⊆ `peerDependencies`** — so **PHẦN TỬ** (không so số lượng) + **ĐỐI CHỨNG ÂM**:
   cùng bộ so trên manifest thiếu phần tử phải báo đúng tên thiếu (`["b"]`, `["a"]`) để chứng minh
   phép kiểm KHÔNG rỗng; và `dependencies` phải rỗng.

## 6. CHƯA làm (điều kiện chặn mount, không phải ghi chú cuối báo cáo)

1. **`gbh.row` do LEAD khai** (id `approval` + `config.policy` đúng biểu thức `!!js` gốc + `tests` —
   commit `d745518`/`96b467c`), **không phải gói tự khai**. Gói đã sạch trước khi khai: `check:rows` 98
   package **0 dòng `chan`**, export 5 = 5. `config` gốc **chỉ** đọc `process.env` (KHÔNG tham chiếu
   `ctx.X`) ⇒ theo luật mới của Lead (config `!!js` dùng `ctx.X` ⇒ phải có `inject` X) row này
   **không cần `inject`**, đúng như oracle dump (row gốc cũng không có `inject`).
2. **CHƯA mount + CHƯA có bảng TRƯỚC/SAU trên app 5439** (`check:app` 11 chỉ số · parity 0/0/0) — chờ Lead.
3. **CHƯA chạy `lab:row`** (công cụ cần gói đã khai `gbh.row`) — chờ lượt boot của Lead.
4. **KHÁC BIỆT ĐÃ BIẾT**: không ship subpath `./types` (bản gốc có) — lý do + phép đo ở §1.3. Nếu
   sau này có người tiêu thụ `<gói>/types`, phải thêm lại đúng subpath đó.
5. **Row này là row NỀN của tầng quyền**: `dsh-tool-bash` (và mọi tool cần nâng quyền), `ui-approval`
   (nửa client nghe waterfall `approval/request`) và preset quyền đều gọi vào `ctx.approval`. Trước khi
   mount BẮT BUỘC đo lại nhóm này: tên service `approval`, tên sự kiện, hình dạng payload và từ vựng
   kết quả phải y hệt (đã có test đối chứng).

## 7. Năm câu hỏi bắt buộc (mục 0 của công thức) + config gốc

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có đang BẬT không? | **CÓ** — `.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng **206–211**: `- id: approval` + `name: '@deepseek-ai/dsh-user-approval'`, **KHÔNG** có `disabled` ⇒ đang bật |
| 2 | Thuần host hay có mount surface client? | **THUẦN HOST** — `lib/client.js` **KHÔNG tồn tại** (`find . -type f` trong gói gốc: chỉ `LICENSE`, 3 README, `lib/index.js`, `lib/types/*`, `locale/*`, `package.json`); bundle không có `slots.register`/`loader.create` |
| 3 | Cần seam nào? | `extends Service` (cordis) · `ctx.waterfall`/`ctx.inject` (cordis) · `scopeTarget` (dsh-scope) · `SessionSeq` (dsh-session) · `createUserMessage` (dsh-llm) · seam `systemPrompt` tra theo hình dạng · `node:crypto`. **Trong/ngoài bảng §3b: xem §2** |
| 4 | Hành vi đo được là gì? | `ctx.approval.request({agent,toolName,callId?,reason?,signal?})` trả **một** kết quả đóng; ghi **một cặp** sự kiện kiểm toán vào phiên; `setPolicy` ghi **một** `approval/policy` + đẩy **một** tin nhắn; mục `approval:policy` (order 115) góp chữ ngữ cảnh vào system prompt |
| 5 | Gói gốc có `dsh.client` không? | **KHÔNG** — `python3 -c "import json;print(bool((json.load(open('package.json')).get('dsh') or {}).get('client')))"` ⇒ `False` ⇒ **một mặt**, thay được ngay, không cần nửa browser |

**`config` gốc của row** (nguyên văn từ dump, kể cả biểu thức `!!js`):

```yaml
- id: approval
  name: '@deepseek-ai/dsh-user-approval'
  config:
    policy: !!js >-
      (process.env.DSH_PERMISSION_MODE ?? 'workspace-write') ===
      'danger-full-access' ? 'never' : 'ask'
```

⇒ Khi Lead khai `gbh.row`, khối `config` phải sinh **đúng** biểu thức này:
`{ policy: { js: "(process.env.DSH_PERMISSION_MODE ?? 'workspace-write') === 'danger-full-access' ? 'never' : 'ask'" } }`.
Schema của ta nhận đúng hai giá trị `'ask'`/`'never'` nên biểu thức trên là hợp lệ.
