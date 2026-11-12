<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bàn giao row M6 agent-default-model: bảng nguồn đối chiếu G4, lý do peer, bằng chứng parity, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-agent-default-model — bàn giao row `agent-default-model` (M6)

Thay row **`agent-default-model`** của DSH (`@deepseek-ai/dsh-agent-default-model`, **69 dòng**
`lib/index.js`) bằng bản viết lại tại `packages/host/agent-default-model/`. Vai trò: **model mặc định cho
Agent** — dịch vụ `ctx.agentDefaultModel` trả lời đúng MỘT câu hỏi (*Agent mới nên dùng model nào?*) để các
điểm vào Agent hỏi nó thay vì tự dựng lại mặc định.

Trạng thái: **đã viết xong + test xanh + artifact khớp**. **CHƯA khai `gbh.row`** (chờ Lead boot) ⇒ gói
**không thể mount nhầm**; có **TEST CANH** khẳng định `gbh.row` vắng mặt (§4).

## 1. Năm câu hỏi bắt buộc (mục 0 của recipe)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **CÓ** — dump mới nhất `.parity/dumps/2026-10-17T23-25-26/ours.yml` dòng 60–64: `- id: agent-default-model` + `name: '@deepseek-ai/dsh-agent-default-model'` + `config: { provider: auto, model: deepseek-v4.1-flash }`, **không** `disabled`; `oracleA.yml` cùng dump dòng 58–62 **y hệt**. |
| 2 | **Thuần host** hay có mount surface client? | **Thuần host.** Gói gốc **không có khoá `dsh`**, **không có `lib/client.js`** (đã kiểm: `find` chỉ ra `lib/index.js` + `lib/types/index.d.ts`), không `__ModuleLoader__`, không đăng ký slot. |
| 3 | Cần **seam nào**? | `extends Service` (cordis) đăng ký tên **`agentDefaultModel`** · `schemastery` cho `Config` (ba trường `volatile()`) · seam **`settings`** qua `ctx.inject(["settings"])` để xin `configure({ auto: false })` · seam **`configEditor`** qua `ctx.get("configEditor")` · `ownerContext.fiber.entry` của tầng Loader. **Không** `node:` builtin, **không** route/RPC. Peer ngoài cordis/schemastery: **`@deepseek-ai/dsh-llm`** (`ReasoningEffortId` — import LÚC CHẠY). |
| 4 | **Hành vi đo được** là gì? | Bốn phép đo: (a) `currentSelection()` trả `{ provider, model, reasoningEffort? }` đọc từ **tham chiếu SỐNG** — sửa `Volatile` tại chỗ thì lượt đọc sau thấy **ngay**; (b) `saveSelection(next)` đẩy **cấu hình THÔ đầy đủ** cho `configEditor.edit`, **bỏ hẳn khoá** `reasoningEffort` khi lựa chọn không có nó; (c) không có `fiber.entry` hoặc không có `configEditor` ⇒ **không ghi, không ném**; (d) các lượt ghi **xếp hàng theo thứ tự NỘP**, lượt ghi hỏng chỉ từ chối **chính người gọi đó**. Đo TRƯỚC/SAU bằng đúng bốn phép đó (§4). |
| 5 | Gói gốc có **`dsh.client`**? | **KHÔNG.** Gói gốc **không có khoá `dsh`** trong `package.json` và **không có `lib/client.js`** ⇒ **row host MỘT MẶT**, cặp disable+insert **không** làm mất nửa client nào. |

## 2. Bảng nguồn đối chiếu (G4)

| Nguồn (CHỈ ĐỌC) | Dòng | Dùng để |
|---|---|---|
| `apps/host/node_modules/@deepseek-ai/dsh-agent-default-model/lib/index.js` | **69** | Hành vi gốc: `selection()` (chiếu + đóng dấu hiệu `ReasoningEffortId`) · lớp `AgentDefaultModelConfig` (`static Config` 3 trường `volatile` · `currentSelection` · `saveSelection` với hàng đợi `saves`) · `export { AgentDefaultModelConfig, AgentDefaultModelConfig as default }` |
| `.../dsh-agent-default-model/lib/types/index.d.ts` | 52 | Chữ ký công khai: `Config` (`Volatile<string>` ×2 + `Volatile<string \| undefined>`) · `currentSelection(): ModelSelection` · `saveSelection(next: ModelSelection): Promise<void>` · `declare module '@deepseek-ai/cordis' { agentDefaultModel }`; **`selection` KHÔNG export** ⇒ artifact chỉ được có 2 tên |
| `.../dsh-agent-default-model/package.json` | — | Peer gốc: `dsh-agent` · `dsh-llm` · `cordis`; `schemastery` + `dsh-config-editor` là **dependency** (ta đưa `schemastery` về peer theo quy ước repo; `dsh-config-editor` **không** cần vì chỉ tra bằng `ctx.get`) |
| `.../dsh-agent-default-model/locale/{en,zh}.json` | 5 + 6 | **LUẬT 000e**: gói gốc CÓ locale ⇒ ta ship lại, chép **byte-for-byte** (`shasum`: `2a2bc3de…` · `4444097d…` khớp) |
| `apps/host/node_modules/@deepseek-ai/dsh-agent/lib/types/model-selection.d.ts` | 16–23 | Hợp đồng `ModelSelection` = `{ provider, model, reasoningEffort?: ReasoningEffortId }` — kiểu MƯỢN, không phải seam lúc chạy |
| `apps/host/node_modules/@deepseek-ai/dsh-llm/lib/index.js` (dòng 930) | — | `ReasoningEffortId(id)` = `brandString(id)` — **không kiểm**, lúc chạy trả CHÍNH chuỗi đó (nên `String()` và so sánh được) |
| `apps/host/node_modules/@deepseek-ai/cordis/lib/types/{service,reflect,fiber}.d.ts` | — | `Service(ctx, name)` đăng ký NGAY khi dựng · `ctx.get(name)` trả `any` cho tên không khai kiểu · `Context.fiber` |
| `apps/host/node_modules/@deepseek-ai/cordis-plugin-loader/lib/types/index.d.ts` (44) | — | `interface Fiber { entry?: Entry }` — Loader mở rộng `Fiber`; ta đọc **hình dạng** (`entry`) chứ không kéo gói này thành peer |
| `apps/host/node_modules/@deepseek-ai/dsh-settings/lib/types/index.d.ts` (80) | — | `configure(presentation, owner?)` — chính sách trang TỰ ĐỘNG của một thể hiện plugin |
| `apps/host/node_modules/@deepseek-ai/dsh-config-editor/lib/types/index.d.ts` (34) | — | `edit(entry, change)` — ghi cấu hình THÔ đầy đủ rồi Loader đối soát |

## 3. Vì sao các peer này

| Peer | Loại | Vì sao |
|---|---|---|
| `@deepseek-ai/cordis` | `peerDependencies` + `devDependencies` | seam kernel (§3b): `Service` để đăng ký tên `agentDefaultModel`, `Context`, `Volatile` (kiểu). `mount.ts` tự thêm peer này. |
| `@deepseek-ai/schemastery` | `peerDependencies` + `devDependencies` | seam kernel (§3b): `z.object(...)` cho `static Config` để Settings/config-editor render được field. `mount.ts` tự thêm peer này. |
| **`@deepseek-ai/dsh-llm`** | `peerDependencies` + `gbh.peers` | **import LÚC CHẠY** (`ReasoningEffortId`) — thiếu trong profile thì entry **chết** (`Cannot find package`). **Ngoài bảng §3b** ⇒ giữ đúng hợp đồng peer của bản gốc, **cần Lead xác nhận** (tiền lệ: `user-questions` · `workflow` · `deepseek-account`). |
| `@deepseek-ai/dsh-agent` | **`devDependencies`** | **Chỉ mượn KIỂU** (`ModelSelection`) — bị xoá lúc build ⇒ **không** phải seam lúc chạy, **không** vào `gbh.peers` (cùng quy ước `workflow` dùng cho `dsh-agent`/`dsh-session`). |
| `@deepseek-ai/dsh-config-editor` | **không khai** | Chỉ tra bằng `ctx.get("configEditor")` và gọi **một** phương thức `edit` qua hình dạng hẹp trong `src/index.ts` ⇒ không cần thể hiện thứ hai, không phải peer. |

## 4. Bằng chứng (đo trên ARTIFACT, không đọc src/)

| Phép đo | Kết quả |
|---|---|
| `bun run build.ts` | **60 dòng** `lib/index.js` (ESM, `packages: external`) — gốc **69** |
| `grep -c 'id: @deepseek-ai' lib/index.js` | **0** (row host thuần — không có `__ModuleLoader__` nào) |
| Tập export artifact **của ta** | `["AgentDefaultModelConfig", "default"]` |
| Tập export artifact **gốc** | **y hệt** — so bằng đọc chính hai file build (`0 thiếu · 0 thừa`) |
| `String(Config)` | `{ provider: string, model: string, reasoningEffort?: string }` — **trùng từng chữ** |
| Schema từ chối cấu hình thiếu trường | `$.provider missing required value` — **cùng thông điệp** |
| Tên dịch vụ đăng ký | `agentDefaultModel` — đo qua **đường nạp THẬT** (`ctx.plugin`) ở **cả hai** bản |
| Prototype | `["constructor", "currentSelection", "saveSelection"]` — **trùng** |
| `bun test tests/host/agent-default-model.test.ts` | **21 pass / 0 fail · 82 expect** |
| `gbh.peers` ⊆ `peerDependencies` | **0 tên lệch** (so **PHẦN TỬ**), dải `~0.2.1-alpha.4` = **đúng kernel đang chạy** |
| **ĐỐI CHỨNG ÂM** của ca quy ước | tiêm lỗi trong **bộ nhớ** (bản sao sâu manifest): xoá `dsh-llm` khỏi `peerDependencies` ⇒ `missingPeers` trả **đúng tên đó**; xoá sạch ⇒ trả **đủ danh sách**; **thừa** tên vẫn ĐẠT (⊆ không phải =) |
| `locale/{en,zh}.json` | `shasum` **khớp byte-for-byte** với bản gốc |
| `row:cost agent-default-model` | 70 dòng · **0 inject** · **0 primitive** · **0 khoá từ điển** · không trạng thái sống (hạng rẻ) |

### Bảng TRƯỚC/SAU (đo trên Context cordis THẬT, cùng giàn cho cả hai bản)

| Phép đo | TRƯỚC (bundle gốc) | SAU (bundle của ta) |
|---|---|---|
| `currentSelection()`, cấu hình `{provider: auto, model: deepseek-v4.1-flash}` | `{provider:"auto", model:"deepseek-v4.1-flash"}` | **y hệt** (không có khoá `reasoningEffort`) |
| `currentSelection()`, có `reasoningEffort: high` | `reasoningEffort` = `"high"` (đã đóng dấu hiệu ở tầng kiểu) | **y hệt** |
| Sửa `Volatile` tại chỗ rồi đọc lại (`symbol cosmokit.volatile.write`) | `provider` đổi ngay | **y hệt** |
| Sửa object `currentSelection()` trả về | lượt đọc sau **KHÔNG** đổi (object tách rời) | **y hệt** |
| `saveSelection` với `reasoningEffort` / không có | `{provider, model, reasoningEffort:"high"}` / `{provider, model}` | **y hệt** (khoá vắng mặt, không phải `undefined`) |
| Không `fiber.entry` / không `configEditor` | 0 lượt `edit`, không ném | **y hệt** |
| 3 lượt ghi chồng lên nhau (lượt đầu hỏng) | thứ tự `[slow, fast, after]` · `[rejected, fulfilled, fulfilled]` · lý do `boom` | **y hệt** |
| Hai vật thể cấu hình của hai lượt ghi | **KHÁC danh tính**, sửa bản trước không lan sang bản sau | **y hệt** |
| Hai thực thể dịch vụ (hàng đợi riêng) | lỗi bên này không chặn bên kia | **y hệt** |
| `settings.configure` sau khi dựng | đúng 1 lượt, `{auto: false}`, có trao `fiber` chủ | **y hệt** |

## 5. CHƯA làm (nói thẳng)

1. **Chưa khai `gbh.row`** — theo luật "khai muộn": gói chưa mount được thì không thể làm hỏng app của người khác. Việc khai + mount + TRƯỚC/SAU **trên app 5439** thuộc **lượt boot của Lead**.
2. **Chưa chạy `lab:row`** — công cụ này đòi gói đã khai `gbh.row` (nó lấy `gbh.row.id` làm mốc tắt row stock), nên không chạy được trước bước 1.
3. **`@deepseek-ai/dsh-llm` nằm NGOÀI bảng §3b** — giữ đúng hợp đồng của bản gốc vì `ReasoningEffortId` là **import lúc chạy**; **cần Lead xác nhận** mở rộng §3b (như `user-questions` · `workflow`).
4. **Module augmentation `declare module "@deepseek-ai/cordis" { agentDefaultModel }`** giữ nguyên như bản gốc để bề mặt KIỂU trùng; nó **không** phải shim ambient cho một peer không resolve được (đúng luật **000d**): `cordis` resolve được thật trong `node_modules` của gói.
5. **Ba thứ bản gốc KHÔNG kiểm, ta cũng KHÔNG kiểm** (giữ đúng hành vi): `provider`/`model` có tồn tại trong catalog không · `reasoningEffort` có hợp lệ với model không · ghi có thắng được revision của profile không (việc của `configEditor`).
