<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bàn giao row M6 mcp-resources: bảng nguồn đối chiếu G4, lý do peer, bằng chứng parity, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-mcp-resources — bàn giao row `mcp-resources` (M6)

Thay row **`mcp-resources`** của DSH (`@deepseek-ai/dsh-mcp-resources`, **181 dòng** `lib/index.js`) bằng bản
viết lại tại `packages/host/mcp-resources/`. Vai trò: **tài nguyên MCP có phạm vi** — một service
`ctx.mcpResources` giữ sổ provider **theo scope**, một mục system prompt nêu tên server khả kiến, và **ba tool
dùng chung** (`list_mcp_resources` · `list_mcp_resource_templates` · `read_mcp_resource`) sống lâu hơn plugin
của bất kỳ server nào.

Trạng thái: **đã viết xong + test xanh + artifact khớp**. **CHƯA khai `gbh.row`** (chờ Lead boot) ⇒ gói
**không thể mount nhầm**; `packages/README.md` §4 đã có dòng (chuẩn bị cho lượt khai của Lead).

## 1. Năm câu hỏi bắt buộc (mục 0 của recipe)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **CÓ** — dump mới nhất `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng 436–437: `- id: mcp-resources` + `name: '@deepseek-ai/dsh-mcp-resources'`, **không** `disabled`; cùng dump `oracleA.yml` dòng 422–423 **y hệt**. **`config:` của row: KHÔNG CÓ** — row này không có trường cấu hình nào (đúng như README gốc: *"This package has no configuration fields"*). |
| 2 | **Thuần host** hay có mount surface client? | **Thuần host.** Gói gốc **không có khoá `dsh`**, **không có `lib/client.js`** (đã kiểm: `find` chỉ ra `lib/index.js` + `lib/types/*.d.ts`), không có `__ModuleLoader__`, không đăng ký slot nào. |
| 3 | Cần **seam nào**? | `extends Service` (cordis — tên service `mcpResources`, `static inject = ["tools"]`) · `ScopedLayers`/`NamedEntries`/`createScope`/`scopeOf` của **`@deepseek-ai/dsh-scope`** (vật mang phạm vi **không thể tự chế**) · `defineTool` của **`@deepseek-ai/dsh-tools`** · `ctx.inject(["systemPrompt"], …)` để chèn mục prompt. **Không** `node:` builtin, **không** route/RPC. |
| 4 | **Hành vi đo được** là gì? | Bốn hiệu ứng ĐO ĐƯỢC: (a) sau `register(server, provider)` ĐẦU TIÊN trong một scope, sổ tool có **đúng ba** definition (`list_mcp_resources` · `list_mcp_resource_templates` · `read_mcp_resource`) với **`description` nguyên văn** + `parameters` đã biên dịch + `output.schema` = `{}` (lossless JSON); (b) mỗi lượt gọi trả **`MCP server: <tên>\n<JSON>`**, `blob` dạng chuỗi hoá thành `[binary resource: N base64 characters; available to programmatic callers]`; (c) server **không khả kiến** ⇒ ném `MCP resource server "<tên>" is unavailable in this agent's scope` **trước** mọi phép toán mạng; (d) mục prompt `mcp-resource-servers` order **3100**, `interpolate: false`, văn bản **rỗng** khi chưa có server và liệt kê tên **ĐÃ SẮP XẾP** khi có. |
| 5 | Gói gốc có **`dsh.client`**? | **KHÔNG.** Gói gốc không có khoá `dsh`, không có `lib/client.js` ⇒ **row MỘT MẶT**: cặp disable+insert **không** làm mất nửa client nào (khác lớp sự cố `typert-gateway`/`api-gateway`). |

**LUẬT 000e**: bản gốc trong kernel **CÓ** `locale/{en,zh}.json` (bản 0.2.0-rc.2 trong app bundle thì không,
nhưng bản **kernel đang chạy** 0.2.1-alpha.4 thì có) ⇒ gói ta ship lại **byte-for-byte**:
`shasum -a 256` khớp `2b56c0f8…` (en) · `9ac65c1c…` (zh); `meta.title` = `mcp-resources` / `MCP 资源访问` là
tiêu đề hàng trong màn Plugins.

## 2. Bảng nguồn đối chiếu (G4)

| Nguồn (CHỈ ĐỌC) | Dòng | Dùng để |
|---|---|---|
| `apps/host/node_modules/@deepseek-ai/dsh-mcp-resources/lib/index.js` | **181** | Hành vi gốc: `renderResourceResult` · ba `defineTool` · `ResourceLayer` · `McpResourceRuntime` (`inject` · `layers` · `selfCtx` · `register` · `registerTools` · `request`) · mục prompt `mcp-resource-servers` |
| `.../dsh-mcp-resources/lib/types/index.d.ts` | 52 | Chữ ký công khai: `McpResourceRequest` · `McpResourceProvider` · lớp `McpResourceRuntime` (chỉ `register` là công khai; `registerTools`/`request` **private**) · `default` = lớp |
| `.../dsh-mcp-resources/lib/types/render.d.ts` | 14 | `renderResourceResult(server, value): ContentBlock[]` — **KHÔNG export từ entry** |
| `.../dsh-mcp-resources/lib/types/tools.d.ts` | 18 | `registerResourceTools(ctx, request): () => void` + kiểu `RequestResource` — **KHÔNG export từ entry** |
| `.../dsh-mcp-resources/package.json` | — | Peer gốc: `cordis` · `dsh-llm` · `dsh-scope` · `dsh-system-prompt` (**optional**) · `dsh-tools`; `dsh-util-values` là **dependency** (chỉ dùng cho KIỂU `JsonValue`) |
| `apps/host/node_modules/@deepseek-ai/dsh-scope/lib/types/store.d.ts` | — | Hợp đồng `NamedEntries.insert/get/keys/isEmpty` + `ScopedLayers.merge/effect` (vật mang phạm vi) |
| `apps/host/node_modules/@deepseek-ai/dsh-tools/lib/types/schema.d.ts` | — | `defineTool` (`parameters` **biên dịch** thành JSON Schema thô; `output.schema` là JSON Schema) + `ToolRunContext extends ToolExecution` |
| `apps/host/node_modules/@deepseek-ai/dsh-system-prompt/lib/types/index.d.ts` dòng 145 | — | `MCP_SERVERS: 3100` — vị trí mục prompt mà bản gốc dùng |

Không chép code: bản viết lại tách **ba module** theo đúng ba mối quan tâm của bản gốc —
`src/render.ts` (phép chiếu) · `src/tools.ts` (ba tool + schema) · `src/index.ts` (service + phạm vi) — cộng
`src/types.ts` (từ vựng). Artifact vẫn giữ **ĐÚNG** tập export của bản gốc (hai tên), vì chỉ `src/index.ts`
được build làm entry.

## 3. Vì sao các peer này

- `@deepseek-ai/cordis` + `@deepseek-ai/schemastery`: hai peer **chuẩn** của mọi gói host; `mount.ts` tự thêm
  và symlink về kernel (`apps/cli/src/mount.ts` dòng 133) nên **không** nằm trong `gbh.peers`. Gói này
  **không** dùng schemastery (row không có `Config`), khai cho khớp lệ mount.
- `@deepseek-ai/dsh-scope`: **không thể tránh** — `NamedEntries`/`ScopedLayers`/`createScope`/`scopeOf` là
  **vật mang phạm vi** của kernel; tự chế bản sao là tạo **hai nguồn sự thật** về scope. Bảng §3b bậc 2 đã cho phép.
- `@deepseek-ai/dsh-tools`: seam `ctx.tools` + `defineTool` (biên dịch + kiểm schema). Bậc 2.
- `@deepseek-ai/dsh-system-prompt`: chỉ để **mục prompt** vào đúng sổ và đúng vị trí `MCP_SERVERS`; bản gốc
  cũng khai peer này (và đánh dấu **optional**). Bậc 2.
- `@deepseek-ai/dsh-llm`: **chỉ mượn KIỂU** `ContentBlock` cho kết quả render; bản gốc khai peer này trong
  `peerDependencies` nên ta giữ nguyên hợp đồng gốc. Bậc 2.
- ⚠️ `@deepseek-ai/dsh-util-values` (`JsonValue`) **cố ý KHÔNG thành peer**: với gói này nó **chỉ là kiểu**
  (bị xoá lúc build) ⇒ khai tại chỗ theo **CẤU TRÚC** trong `src/types.ts` (tiền lệ: `dsh-agent`/`dsh-session`
  của `subagent-fork-in-process`). Thêm peer cho một import không tồn tại lúc chạy là tạo **thể hiện thứ hai** vô cớ.

## 4. Bằng chứng parity (đo trên ARTIFACT, đối chứng với chính bundle gốc)

| Phép đo | Kết quả |
|---|---|
| **Tập export** (M6 §1c) | **2 = 2, 0 thiếu · 0 thừa**: `McpResourceRuntime` · `default`. Gốc cũng **không** export `renderResourceResult`/`registerResourceTools`/`ResourceLayer` — ta cũng không. |
| `grep -c "id: @deepseek-ai" lib/index.js` | **0** (row host thuần: không `__ModuleLoader__`) |
| `gbh.peers ⊆ peerDependencies` (M6 §1d) | **0 tên lệch**, so **PHẦN TỬ**; có **ĐỐI CHỨNG ÂM** (xoá từng tên ⇒ báo đúng tên đó · xoá sạch ⇒ báo đủ danh sách · **thừa** tên vẫn đạt vì quy ước là ⊆) |
| Hành vi | **21 test / 126 expect / 0 fail**: ba tool (tên · mô tả · tham số **đã biên dịch** · schema) · phép render **6 ca** (`blob` chuỗi · `blob` không-chuỗi · lồng · chuỗi trần · `null`) · chuyển tiếp yêu cầu (`resources/list` · `resources/templates/list` + cursor · `resources/read` + uri) + **danh tính `exec`** · đường lỗi server không khả kiến (**không chạm provider**) · mục prompt (tên · order 3100 · `interpolate:false` · rỗng/khi có) · vòng đời tool theo provider đầu/cuối · tên trùng trong **cùng** scope |
| **C6 danh tính** | hai scope khác nhau đăng ký **cùng** tên server ⇒ **không ném**, mỗi bên **chỉ thấy** provider của mình; hai thực thể tool **không** chia sẻ `parameters`/`output` (phép so SÂU vẫn đạt ⇒ phải so **danh tính**); sửa bảng của runtime này **không** lan sang runtime kia |
| `bun run check:rows` | xem §6 — **không thêm dòng `chan`** nào |
| `locale/` (000e) | `en.json` · `zh.json` chép **byte-for-byte** từ kernel (sha256 khớp), `exports["./locale/*.json"]` có; ca test `Buffer.equals` canh |
| `bun run gate --no-tests` | **7/7 XANH** (typecheck 1343 file · 0 vi phạm) |

**Bảng TRƯỚC/SAU:** chưa đo được trên app 5439 vì gói **chưa khai `gbh.row`** (chờ Lead boot) — xem §5.

## 5. CHƯA làm (điều kiện chặn mount)

1. **Chưa khai `gbh.row`** — theo luật *"khai `gbh.row` = nhận rủi ro mount"*: chỉ khai khi có lượt boot của Lead.
2. **Chưa có bảng TRƯỚC/SAU trên app thật** — cần một lượt boot: TRƯỚC (row stock) và SAU (row của ta) đo
   (5) `did not activate`, entry của từng row trong manifest, và **ba tool có mặt trong payload tool**.
3. **Chưa chạy `lab:row`** — công cụ cần gói đã khai `gbh.row` (nó lấy `gbh.row.id` làm mốc tắt row stock).