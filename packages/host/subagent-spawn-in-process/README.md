<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bàn giao row M6 subagent-spawn-in-process: bảng nguồn đối chiếu G4, lý do peer, bằng chứng parity, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-subagent-spawn-in-process — bàn giao row `subagent-spawn-in-process` (M6)

Thay row **`subagent-spawn-in-process`** của DSH (`@deepseek-ai/dsh-subagent-spawn-in-process`, **39 dòng**
`lib/index.js`) bằng bản viết lại tại `packages/host/subagent-spawn-in-process/`. Vai trò: **backend subagent
SPAWN trong cùng tiến trình** — đăng ký một `SubagentProvider` tên `spawn` trên seam `ctx.subagents`; mỗi con
là một `Agent` **MỚI** trên cùng context cordis (phiên riêng, system prompt riêng, **KHÔNG** mang ngữ cảnh của cha).

Trạng thái: **đã viết xong + test xanh + artifact khớp**. **CHƯA khai `gbh.row`** (chờ Lead boot) ⇒ gói
**không thể mount nhầm**; `packages/README.md` §4 đã có dòng (chuẩn bị cho lượt khai của Lead).

## 1. Năm câu hỏi bắt buộc (mục 0 của recipe)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **CÓ** — dump oracle `.parity/dumps/2026-10-17T23-25-26/ours.yml` dòng 329–332: `- id: subagent-spawn-in-process` + `name: '@deepseek-ai/dsh-subagent-spawn-in-process'` + `config: { providerName: spawn }`, **không** `disabled`. Đây là **row nền** của nhóm subagent: `tool-subagent` (provider `spawn`) và `workflow-ptc` (provider `spawn`) đều trỏ vào nó. |
| 2 | **Thuần host** hay có mount surface client? | **Thuần host.** Gói gốc **không có khoá `dsh`**, không có `lib/client.js`, không có `__ModuleLoader__`, không đăng ký slot nào. |
| 3 | Cần **seam nào**? | `inject = ["subagents"]` (sổ backend subagent của kernel) + `schemastery` cho `Config`. **Không** `extends Service`, **không** `node:` builtin, **không** route/RPC. Peer ngoài cordis/schemastery: **`@deepseek-ai/dsh-subagent`** (hợp đồng `SubagentProvider` / `SubagentCapabilities` / `ContinuableCreateSpec`). |
| 4 | **Hành vi đo được** là gì? | Một hiệu ứng ĐO ĐƯỢC sau `apply`: trong sổ `ctx.subagents` xuất hiện **đúng một** provider tên `config.providerName` với **bốn** năng lực start-time, `inheritsParentContext === false`, **không** có `start`, có `prepareContinuable` giải ra `{}` (**không** `seed`). Đo TRƯỚC/SAU bằng chính hình dạng provider + `Config` đã chuẩn hoá (§4). |
| 5 | Gói gốc có **`dsh.client`**? | **KHÔNG.** `python3 -c "import json;print(bool((json.load(open('.../dsh-subagent-spawn-in-process/package.json')).get('dsh') or {}).get('client')))"` ⇒ `False` (gói gốc không có khoá `dsh`). ⇒ **row host thuần**, cặp disable+insert **không** làm mất nửa client nào. |

## 2. Bảng nguồn đối chiếu (G4)

| Nguồn (CHỈ ĐỌC) | Dòng | Dùng để |
|---|---|---|
| `apps/host/node_modules/@deepseek-ai/dsh-subagent-spawn-in-process/lib/index.js` | **39** | Hành vi gốc: `name` · `inject` · `Config` · lớp `SpawnInProcessProvider` (4 năng lực, `inheritsParentContext = false`, `prepareContinuable` trả `{}`) · `apply` |
| `.../dsh-subagent-spawn-in-process/lib/types/index.d.ts` | 19 | Chữ ký công khai: `Config` interface (`providerName: string`), `Config: z<Config>`, `apply(ctx, config): void`; **`SpawnInProcessProvider` KHÔNG export** |
| `.../dsh-subagent-spawn-in-process/package.json` | — | Peer gốc: `dsh-subagent` + `cordis`; `schemastery` là **dependency** (ta đưa về peer theo quy ước repo) |
| `.../dsh-subagent-spawn-in-process/locale/{en,zh}.json` | 5 + 6 | **LUẬT 000e**: gói gốc CÓ locale ⇒ ta ship lại, chép **byte-for-byte** (`shasum`: `a4efd94e…` · `76ecd7ec…` khớp) |
| `apps/host/node_modules/@deepseek-ai/dsh-subagent/lib/types/types.d.ts` | 342 | Hợp đồng seam: `SubagentProvider` (name · capabilities · inheritsParentContext · optional `start`/`prepareContinuable`) · `SubagentCapabilities` (4 khoá) · `ContinuableCreateSpec` (`seed?`) |
| `apps/host/node_modules/@deepseek-ai/dsh-subagent/lib/index.js` (dòng 3256) | — | `registerProvider` THẬT: tiền kiểm `must implement start or prepareContinuable`, chống trùng tên, **tự bind vòng đời bằng `ctx.effect`** ⇒ `apply` của ta không phải giữ disposer |
| `apps/host/node_modules/@deepseek-ai/dsh-subagent-fork-in-process/lib/index.js` | 54 | **Đối chứng âm của ngữ nghĩa**: bên `fork` khai `inheritsParentContext = true` + gieo `seed` từ tiền tố lượt đã xong; SPAWN **không** làm cả hai |

Không chép code: bản viết lại tách `src/provider.ts` (lớp provider + bảng năng lực) khỏi `src/index.ts` (mặt
plugin) để artifact giữ **ĐÚNG** tập export của bản gốc (bản gốc cũng **không** export lớp provider).

## 3. Vì sao các peer này

- `@deepseek-ai/cordis` + `@deepseek-ai/schemastery`: hai peer **chuẩn** của mọi gói host; `mount.ts` tự thêm
  và symlink về kernel (dòng 133 của `apps/cli/src/mount.ts`) nên **không** nằm trong `gbh.peers`.
- `@deepseek-ai/dsh-subagent`: **không thể tránh** — nó định nghĩa chính hợp đồng mà gói này hiện thực
  (`SubagentProvider`), và cấp seam `ctx.subagents` (`registerProvider`). Bản gốc cũng khai đúng tên này ở
  `peerDependencies` ⇒ ta **giữ nguyên hợp đồng gốc**. ⚠️ **Ngoài bảng §3b** ⇒ cần Lead xác nhận việc mở
  bảng (cùng nhóm với `jobs-local` · `workflow` · `user-questions` đã khai peer `dsh-*`).
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
| `bun run build.ts` | **38 dòng** `lib/index.js` (ESM, `packages: external`) — gốc 39 dòng |
| `grep -c 'id: @deepseek-ai' lib/index.js` | **0** (row host thuần — không có `__ModuleLoader__` nào) |
| Tập export artifact **của ta** | `["Config", "apply", "inject", "name"]` |
| Tập export artifact **gốc** | **y hệt** — so bằng đọc chính hai file build (`0 thiếu · 0 thừa`) |
| `String(Config)` | `{ providerName?: string }` — **trùng từng chữ** với bản gốc |
| Hình dạng provider đã đăng ký | `keys ["name","capabilities","inheritsParentContext"]` · `start: undefined` · `prepareContinuable: function` · `prototype ["constructor","prepareContinuable"]` — **trùng** bản gốc |
| `prepareContinuable()` | `{}` ở **cả hai** bản; `Object.hasOwn(spec, "seed") === false` (`fork` thì ngược lại) |
| **Danh tính** `capabilities` giữa hai thực thể | **KHÁC nhau** ở cả hai bản (mỗi provider một object riêng — sửa một cái không lan sang cái kia). Bản đầu của ta chia sẻ một hằng `SPAWN_CAPABILITIES`; phép so **sâu** vẫn ĐẠT nên **không cổng nào thấy** — đã sửa thành `{ ...SPAWN_CAPABILITIES }` và thêm ca test so **danh tính** |
| `bun test tests/host/subagent-spawn-in-process.test.ts` | **14 pass / 0 fail · 58 expect** |
| `gbh.peers` ⊆ `peerDependencies` | **0 tên lệch** (so **PHẦN TỬ**), dải `~0.2.1-alpha.4` = **đúng kernel đang chạy** |
| **ĐỐI CHỨNG ÂM** của ca quy ước | tiêm lỗi trong **bộ nhớ** (bản sao sâu của manifest): xoá `dsh-subagent` khỏi `peerDependencies` ⇒ `missingPeers` trả **đúng tên đó**; xoá sạch ⇒ trả **đủ danh sách**; **thừa** tên vẫn ĐẠT (⊆ không phải =) |
| `bun run check:rows` | gói **không khai `gbh.row`** ⇒ không vào bảng; **cột `chan` = 0** (63 package, y mốc trước khi thêm gói) |
| `locale/{en,zh}.json` | `shasum` **khớp byte-for-byte** với bản gốc |
| `row:cost subagent-spawn-in-process` | 40 dòng row · 0 inject · **0 primitive** · **0 khoá từ điển** · **không** trạng thái sống (hạng rẻ) |

### Bảng TRƯỚC/SAU (đo trên giàn giả ĐÚNG hình dạng seam — `registerProvider(provider)`)

| Phép đo | TRƯỚC (bundle gốc) | SAU (bundle của ta) |
|---|---|---|
| Số provider được đăng ký sau `apply` | 1 | **1** |
| `name` provider (config mặc định) | `spawn` | **`spawn`** |
| `capabilities` | `{agentOptions, agentPreset, outputSchema, depthLimit} = true` | **y hệt** |
| `inheritsParentContext` | `false` | **`false`** |
| `start` | không có (`undefined`) | **không có** |
| `prepareContinuable()` | `{}` (không `seed`) | **`{}` (không `seed`)** |
| số lượt `ctx.effect` do `apply` gọi | 0 | **0** |
| `Config({})` / `Config({providerName: 5})` | `{providerName:"spawn"}` / ném `$.providerName expected string but got 5` | **y hệt, từng chữ** |

Lệnh tái lập: `bun test tests/host/subagent-spawn-in-process.test.ts` (mọi ca chạy **cả hai bản** trên cùng
một giàn rồi so từng giá trị) · `bun run build.ts` · `shasum locale/*.json`.

## 5. Phần CHƯA làm (nói thẳng)

1. **Chưa khai `gbh.row`** — theo đúng chỉ đạo: Lead khai ở lượt boot. Khi khai, dùng
   `"row": { "id": "subagent-spawn-in-process", "config": { "providerName": "spawn" }, "tests": ["tests/host/subagent-spawn-in-process.test.ts"] }`
   (có **ca test canh** sẵn: khai rồi thì `id`/`tests` phải đúng hai giá trị đó).
2. **Chưa chạy `lab:row` / mount / `check:app`** — thuộc lượt boot của Lead (gói chưa khai row nên
   `lab:row` cũng chưa nhận).
3. **Chưa đo bằng `SubagentRuntime` THẬT** — chứng minh hiện tại ở tầng **hợp đồng** (hình dạng provider +
   tiền kiểm của seam đọc từ `dsh-subagent/lib/index.js`), không phải một lượt spawn end-to-end (một lượt như
   vậy cần `dsh-agent` + LLM + session, tức cả M3). Đây là giới hạn **đã biết**, không phải bỏ sót.
