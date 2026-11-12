<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bàn giao row M6 subagent-fork-in-process: bảng nguồn đối chiếu G4, lý do peer, bằng chứng parity, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-subagent-fork-in-process — bàn giao row `subagent-fork-in-process` (M6)

Thay row **`subagent-fork-in-process`** của DSH (`@deepseek-ai/dsh-subagent-fork-in-process`, **54 dòng**
`lib/index.js`) bằng bản viết lại tại `packages/host/subagent-fork-in-process/`. Vai trò: **backend subagent
FORK trong cùng tiến trình** — đăng ký một `SubagentProvider` tên `fork` trên seam `ctx.subagents`; mỗi con
là một `Agent` **GIEO tiền tố lượt đã xong** của log phiên cha ⇒ con **thừa hưởng ngữ cảnh** của cha thay vì
bắt đầu tươi (đó là điểm khác duy nhất có nghĩa so với row em `subagent-spawn-in-process`).

Trạng thái: **đã viết xong + test xanh + artifact khớp**. **CHƯA khai `gbh.row`** (chờ Lead boot) ⇒ gói
**không thể mount nhầm**; `packages/README.md` §4 đã có dòng (chuẩn bị cho lượt khai của Lead).

## 1. Năm câu hỏi bắt buộc (mục 0 của recipe)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **CÓ** — dump mới nhất `.parity/dumps/2026-10-17T23-25-26/ours.yml` dòng 333–336: `- id: subagent-fork-in-process` + `name: '@deepseek-ai/dsh-subagent-fork-in-process'` + `config: { providerName: fork }`, **không** `disabled`; `oracleA.yml` cùng dump dòng 325–328 **y hệt**. Đây là row nền của nhóm subagent: `tool-subagent` (provider `fork`) và `tool-subagent-fork` dùng lại nó. |
| 2 | **Thuần host** hay có mount surface client? | **Thuần host.** Gói gốc **không có khoá `dsh`**, **không có `lib/client.js`** (đã kiểm: `test -f` ⇒ NO), không có `__ModuleLoader__`, không đăng ký slot nào. |
| 3 | Cần **seam nào**? | `inject = ["subagents"]` (sổ backend subagent của kernel) + `schemastery` cho `Config`. **Không** `extends Service`, **không** `node:` builtin, **không** route/RPC. Peer ngoài cordis/schemastery: **`@deepseek-ai/dsh-subagent`** (hợp đồng `SubagentProvider` / `SubagentCapabilities` / `ContinuableCreateRequest` / `ContinuableCreateSpec`). |
| 4 | **Hành vi đo được** là gì? | Hai hiệu ứng ĐO ĐƯỢC: (a) sau `apply`, sổ `ctx.subagents` có **đúng một** provider tên `config.providerName` với **bốn** năng lực (`agentPreset: false`), `inheritsParentContext === true`, **không** `start`; (b) `prepareContinuable({ parent })` trả **`{ seed }`** = mọi sự kiện của `parent.session.snapshotEvents()` **tới và bao gồm `turn/end` CUỐI CÙNG** (loại lượt đang chạy), và **`{}`** (không khoá `seed`) khi chưa có lượt nào hoàn tất. Đo TRƯỚC/SAU bằng chính hai hiệu ứng đó (§4). |
| 5 | Gói gốc có **`dsh.client`**? | **KHÔNG.** `python3 -c "import json;print(bool((json.load(open('.../dsh-subagent-fork-in-process/package.json')).get('dsh') or {}).get('client')))"` ⇒ `False` (gói gốc không có khoá `dsh`; `lib/` chỉ có `index.js` + `types/`). ⇒ **row host một mặt**, cặp disable+insert **không** làm mất nửa client nào. |

## 2. Bảng nguồn đối chiếu (G4)

| Nguồn (CHỈ ĐỌC) | Dòng | Dùng để |
|---|---|---|
| `apps/host/node_modules/@deepseek-ai/dsh-subagent-fork-in-process/lib/index.js` | **54** | Hành vi gốc: `name` · `inject` · `Config` · hàm `completedTurnPrefix` · lớp `ForkInProcessProvider` (4 năng lực, `inheritsParentContext = true`, `prepareContinuable` trả `{seed}`/`{}`) · `apply` |
| `.../dsh-subagent-fork-in-process/lib/types/index.d.ts` | 27 | Chữ ký công khai: `Config` interface (`providerName: string`), `Config: z<Config>`, `apply(ctx, config): void`; **`ForkInProcessProvider` + `completedTurnPrefix` KHÔNG export** ⇒ artifact chỉ được có 4 tên |
| `.../dsh-subagent-fork-in-process/package.json` | — | Peer gốc: `dsh-agent` · `dsh-session` · `dsh-subagent` · `cordis`; `schemastery` là **dependency** (ta đưa về peer theo quy ước repo) |
| `.../dsh-subagent-fork-in-process/locale/{en,zh}.json` | 5 + 6 | **LUẬT 000e**: gói gốc CÓ locale ⇒ ta ship lại, chép **byte-for-byte** (`shasum`: `fd1d6502…` · `53c78cdd…` khớp) |
| `apps/host/node_modules/@deepseek-ai/dsh-subagent/lib/types/types.d.ts` | 342 | Hợp đồng seam: `SubagentProvider` (name · capabilities · inheritsParentContext · optional `start`/`prepareContinuable`) · `SubagentCapabilities` (4 khoá) · `ContinuableCreateRequest` (`cwd` · `sessionId` · `parent: Agent` · `signal`) · `ContinuableCreateSpec` (`seed?: readonly SessionEvent[]`) |
| `apps/host/node_modules/@deepseek-ai/dsh-session/lib/types/index.d.ts` (dòng 224) | — | `snapshotEvents(fromSeq?, toSeqExclusive?): readonly SessionEvent[]` — bề mặt DUY NHẤT mà phép cắt chạm tới |
| `apps/host/node_modules/@deepseek-ai/dsh-subagent/lib/index.js` (dòng 3256) | — | `registerProvider` THẬT: tiền kiểm `must implement start or prepareContinuable`, chống trùng tên, **tự bind vòng đời bằng `ctx.effect`** ⇒ `apply` của ta không phải giữ disposer |
| `apps/host/node_modules/@deepseek-ai/dsh-subagent-spawn-in-process/lib/index.js` | 39 | **Đối chứng âm của ngữ nghĩa**: SPAWN khai `agentPreset: true` + `inheritsParentContext = false` + trả `{}`; FORK **ngược lại ở cả ba** |

Không chép code: bản viết lại tách `src/provider.ts` (lớp provider + phép cắt tiền tố + bảng năng lực) khỏi
`src/index.ts` (mặt plugin) để artifact giữ **ĐÚNG** tập export của bản gốc (bản gốc cũng **không** export
lớp provider hay hàm cắt).

## 3. Vì sao các peer này

- `@deepseek-ai/cordis` + `@deepseek-ai/schemastery`: hai peer **chuẩn** của mọi gói host; `mount.ts` tự thêm
  và symlink về kernel (dòng 133 của `apps/cli/src/mount.ts`) nên **không** nằm trong `gbh.peers`.
- `@deepseek-ai/dsh-subagent`: **không thể tránh** — nó định nghĩa chính hợp đồng mà gói này hiện thực
  (`SubagentProvider`) và cấp seam `ctx.subagents` (`registerProvider`). Bản gốc cũng khai đúng tên này ở
  `peerDependencies` ⇒ ta **giữ nguyên hợp đồng gốc**. ⚠️ **Ngoài bảng §3b** ⇒ cần Lead xác nhận việc mở
  bảng (cùng nhóm với `jobs-local` · `workflow` · `user-questions` · `subagent-spawn-in-process`).
- `dsh-agent` + `dsh-session`: bản gốc khai hai tên này, nhưng bản viết lại **chỉ mượn KIỂU** và đã khai
  **theo CẤU TRÚC** (`ParentLogSource`) + suy kiểu seed từ `ContinuableCreateSpec["seed"]` — không import
  gói nào, nên **không** khai peer (tránh symlink thừa và tránh phụ thuộc hình dạng .d.ts của kernel).
- Khai ở **HAI chỗ**: `gbh.peers` (để `mount.ts` biết đường symlink) **và** `peerDependencies` (**hợp đồng với
  trình quản lý gói** — kernel cấp đúng MỘT thể hiện; quy ước `gbh.peers` ⊆ `peerDependencies`).
  **KHÔNG** khai `dependencies` (sẽ kéo về bản thứ hai ⇒ phá luật một-instance).

```json
"peerDependencies": {
  "@deepseek-ai/cordis": "~4.0.5",
  "@deepseek-ai/schemastery": "~3.18.5",
  "@deepseek-ai/dsh-subagent": "~0.2.1-alpha.4"
},
"gbh": { "peers": ["@deepseek-ai/dsh-subagent"] }
```

## 4. Bằng chứng (đo trên ARTIFACT, không đọc src/)

| Phép đo | Kết quả |
|---|---|
| `bun run build.ts` | **46 dòng** `lib/index.js` (ESM, `packages: external`) — gốc 54 dòng |
| `grep -c 'id: @deepseek-ai' lib/index.js` | **0** (row host thuần — không có `__ModuleLoader__` nào) |
| Tập export artifact **của ta** | `["Config", "apply", "inject", "name"]` |
| Tập export artifact **gốc** | **y hệt** — so bằng đọc chính hai file build (`0 thiếu · 0 thừa`, không `default`) |
| `String(Config)` | `{ providerName?: string }` — **trùng từng chữ** với bản gốc |
| Hình dạng provider đã đăng ký | `keys ["name","capabilities","inheritsParentContext"]` · `start: undefined` · `prepareContinuable: function` · `prototype ["constructor","prepareContinuable"]` — **trùng** bản gốc |
| `capabilities` | `{agentOptions: true, agentPreset: false, outputSchema: true, depthLimit: true}` — **trùng**; và **mỗi thực thể một object riêng** (so **danh tính**, y bản gốc) |
| `inheritsParentContext` | `true` ở **cả hai** |
| `bun test tests/host/subagent-fork-in-process.test.ts` | **17 pass / 0 fail · 76 expect** |
| `gbh.peers` ⊆ `peerDependencies` | **0 tên lệch** (so **PHẦN TỬ**), dải `~0.2.1-alpha.4` = **đúng kernel đang chạy** |
| **ĐỐI CHỨNG ÂM** của ca quy ước | tiêm lỗi trong **bộ nhớ** (bản sao sâu của manifest): xoá `dsh-subagent` khỏi `peerDependencies` ⇒ `missingPeers` trả **đúng tên đó**; xoá sạch ⇒ trả **đủ danh sách**; **thừa** tên vẫn ĐẠT (⊆ không phải =) |
| `bun run check:rows` | gói **không khai `gbh.row`** ⇒ không vào bảng; **cột `chan` = 0** |
| `locale/{en,zh}.json` | `shasum` **khớp byte-for-byte** với bản gốc |
| `row:cost subagent-fork-in-process` | 55 dòng row · 0 inject · **0 primitive** · **0 khoá từ điển** · **không** trạng thái sống (hạng rẻ) |

### Bảng TRƯỚC/SAU (đo trên giàn giả ĐÚNG hình dạng seam `registerProvider(provider)`)

| Phép đo | TRƯỚC (bundle gốc) | SAU (bundle của ta) |
|---|---|---|
| Số provider được đăng ký sau `apply` | 1 | **1** |
| `name` provider (config mặc định) | `fork` | **`fork`** |
| `capabilities` | `{agentOptions:true, agentPreset:false, outputSchema:true, depthLimit:true}` | **y hệt** |
| `inheritsParentContext` | `true` | **`true`** |
| `start` | không có (`undefined`) | **không có** |
| log 7 sự kiện, `turn/end` cuối ở seq **3** | `seed` = seq `[0,1,2,3]` | **y hệt** (cùng **đối tượng** phần tử, mảng MỚI) |
| log 7 sự kiện, hai `turn/end` (seq 1 và 4) | `seed` = seq `[0,1,2,3,4]` | **y hệt** |
| log toàn lượt đang chạy (không `turn/end`) | `{}` — **không** khoá `seed` | **y hệt** |
| log rỗng | `{}` | **y hệt** |
| số lượt `snapshotEvents` mỗi lần `prepareContinuable` | 1 | **1** |
| log cha ném lỗi | **NÉM ĐỒNG BỘ** `log hong` | **y hệt** (không phải promise reject) |
| `parent` thiếu `session` | TypeError, cùng thông điệp | **y hệt** |
| số lượt `ctx.effect` do `apply` gọi | 0 | **0** |
| `Config({})` / `Config({providerName: 5})` | `{providerName:"fork"}` / ném `$.providerName expected string but got 5` | **y hệt, từng chữ** |

Lệnh tái lập: `bun test tests/host/subagent-fork-in-process.test.ts` (mọi ca chạy **cả hai bản** trên cùng
một giàn rồi so từng giá trị) · `bun run build.ts` · `shasum locale/*.json`.

## 5. Phần CHƯA làm (nói thẳng)

1. **Chưa khai `gbh.row`** — theo đúng chỉ đạo: Lead khai ở lượt boot. Khi khai, dùng
   `"row": { "id": "subagent-fork-in-process", "config": { "providerName": "fork" }, "tests": ["tests/host/subagent-fork-in-process.test.ts"] }`
   (đã có **ca test canh**: khai rồi thì `id`/`tests` phải đúng hai giá trị đó).
2. **Chưa chạy `lab:row` / mount / `check:app`** — thuộc lượt boot của Lead (gói chưa khai row nên
   `lab:row` cũng chưa nhận).
3. **Chưa đo bằng `SubagentRuntime` THẬT** — chứng minh hiện tại ở tầng **hợp đồng** (hình dạng provider +
   phép cắt log + tiền kiểm của seam đọc từ `dsh-subagent/lib/index.js`), không phải một lượt fork end-to-end
   (một lượt như vậy cần `dsh-agent` + `dsh-session` + LLM, tức cả M3). Đây là giới hạn **đã biết**.
4. **Giả định `seq` = chỉ số mảng** được **giữ nguyên** như bản gốc (tài liệu hoá trong `provider.ts`): nếu
   một kernel sau này trả `snapshotEvents` đã lọc, `slice(0, lastEnd.seq + 1)` sẽ cắt sai — nhưng **sửa**
   nó bây giờ là **khác bản gốc**, nên ghi lại để người sau quyết định.
