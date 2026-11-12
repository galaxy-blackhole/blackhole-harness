<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc PHASE B — CÔNG THỨC nhân rộng cho 15 gói còn import @deepseek-ai/dsh-tools: 12 gói chặng 1 (chỉ register)
      + 3 gói chặng 2 (get/schemas/executionMode), kèm mặt cắt từng gói và cách vá test fake ctx.
-->

# PHASE B — CÔNG THỨC (15 gói)

## ĐIỀU KIỆN TIÊN QUYẾT (Lead, 08/11/2026)

**CHẶNG 1 CHỈ ĐƯỢC ÁP SAU KHI Lead bổ sung `lib/types` cho 12 gói đang thiếu khai kiểu** (đang làm).
Nhiều consumer cần type đó mới đổi được id import (thiếu `lib/types` ⇒ tsc đỏ TS7016).
Chưa có thông báo của Lead là CHƯA được bắt đầu.

**§2e — peerDependencies dùng id STOCK là HỢP LỆ:** peer chỉ để mount dựng symlink TỪ KERNEL; đổi sang id GBH
làm mount báo `thiếu peer trong kernel`. ⇒ **KHÔNG đổi `peerDependencies`/`devDependencies`/`gbh.peers`**;
R6a chỉ áp cho **import trong mã**; peer ghi `R6b (hoãn, peer-kernel-id)`.

> Mẫu đã chạy xanh: `packages/host/tool-working-directory` (xem `docs/tien-do/PHASE-B-PILOT.md`).
> Đo 08/11/2026: còn **28 gói** import `@deepseek-ai/dsh-tools` — **15 gói có tệp viết tay** (dưới đây),
> **13 gói chỉ có trong `src/parts`** ⇒ KHÔNG sửa được (lát de-bundle byte-parity, để Phase C).

## 0. Vì sao phải refactor trước khi đổi id

`@deepseek-ai/dsh-tools` bơm `Context.tools` bằng `declare module`; `@galaxy-blackhole/gbh-host-tools` cố ý
KHÔNG augment (ADR 000d) ⇒ đổi id mà vẫn `ctx.tools` là tsc đỏ `TS2339: Property 'tools' does not exist on type 'Context'`.
Phải đọc sổ tool qua **seam cấu trúc** `ctx.get("tools")` RỒI mới đổi id.

## 1. Chặng 1 — 12 gói chỉ cần `register`

| gói | mặt cắt cần | ghi chú |
|---|---|---|
| host/agent-instructions | chỉ **import type** (`ToolExecution` · `ToolExecutionToken`) | không dùng `ctx.tools` ⇒ chỉ đổi id import |
| host/session-checkpoint-policy | chỉ **import type** | như trên |
| host/experimental-tool-agent-team | chỉ **import type** | như trên |
| host/plan-mode | `register` | |
| host/tool-ask-user | `register` | |
| host/tool-present | `register` | có `defineTool` + `ctx.tools.register` ở `index.ts` |
| host/tool-pwsh | `register` | |
| host/tool-workspace-dependencies | `register` | |
| host/tool-worktree | `register` | `gbh.peers` có `@deepseek-ai/dsh-tools` ⇒ bỏ |
| host/mcp-resources | `register` (**dùng `yield`**) | `tools.ts` dùng `yield ctx.tools.register(...)` ⇒ `yield tools.register(...)` |
| host/plugin-market | `register` | |
| host/plugin-manager | `register` | nhiều tệp import **type** (`ToolDefinition`, `ToolExecution`…) ⇒ đổi hết id import |

## 2. Chặng 2 — 3 gói cần mặt cắt rộng hơn

| gói | mặt cắt cần | cách làm |
|---|---|---|
| host/agent-loop | `executionMode` | seam cần `{ register; executionMode(...) }` — đọc `src` để chép đúng chữ ký từ `ToolRuntime` |
| host/cordis-host-runner | `register` + `schemas` | `guard.ts` là façade sandbox: seam cần `register` + `schemas` (không được lộ cả `ctx`) |
| host/tool-web | `get` + `register` | seam cần `{ get(name); register }` |

## 3. Công thức 5 bước cho mỗi gói

1. `grep -rn "@deepseek-ai/dsh-tools" packages/host/<gói>/src | grep -v /parts/` → danh sách tệp viết tay.
2. Đổi MỌI import (value + type) sang `@galaxy-blackhole/gbh-host-tools` (giữ nguyên tên import).
3. Tệp nào có `ctx.tools.X` → khai seam ngay trong tệp (JSDoc đủ "làm gì · nhận gì · trả gì"):
   ```ts
   interface ToolsLike {
     register(definition: ToolDefinition): () => void;
   }
   ```
   rồi trong hàm nhận ctx:
   ```ts
   const tools = ctx.get("tools") as ToolsLike | undefined;
   if (tools === undefined) throw new Error("<row> requires the tools seam (ctx.get(\"tools\"))");
   ```
   đổi `ctx.tools.register(` → `tools.register(` (giữ `yield` nếu có).
4. `package.json`: **KHÔNG ĐỔI** (§2e) — giữ `@deepseek-ai/dsh-tools` ở peer/dev/`gbh.peers`
   (giữ version); `gbh.peers`: **bỏ** `"@deepseek-ai/dsh-tools"` (KHÔNG thêm id GBH — mount dựng symlink peer từ KERNEL;
   gói `gbh-host-tools` là ROW nên mount tự cài).
5. Test trong `gbh.row.tests`: nếu test dựng ctx giả có `tools: {...}` thì tách biến `soTool` dùng chung và thêm
   `get(name) { … name === "tools" ? soTool : … }`; KHÔNG đổi assertion.
   Rồi chạy `bun test --timeout 60000 <tệp test của gói>`.

## 4. KHÔNG được đụng

- `src/parts/**`, `src/*-slice*.ts` (byte-parity, ADR-0008).
- id R6b/augmentation (§2c): `dsh-agent` · `dsh-session` · `dsh-scope` · `dsh-llm` · `dsh-typert-protocol` ·
  `dsh-client-ui-primitives` · `cordis` · `schemastery` · `cosmokit` · `dsh-sandbox` · `dsh-web`.
- `locale/**` (đóng băng), `gbh.provenance.stock`, `name`, `gbh.row` khác.

## 5. Tình trạng (08/11/2026)

- Pilot `host/tool-working-directory`: XANH (5 pass · 0 fail; tsc chương trình tối thiểu 0 lỗi; gate typecheck 0 vi phạm thuộc gói).
- 12 gói chặng 1: **CHƯA áp** — các gói này đang thuộc batch của dev-1..dev-5 và họ đang sửa song song;
  cần Lead phân xử ai làm để tránh ghi đè (đã báo Lead 08/11/2026).
