<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguon doi chieu (G4) + ly do peer + bang TRUOC/SAU cua @galaxy-blackhole/gbh-workflow
-->

# @galaxy-blackhole/gbh-workflow

Bản viết lại của Galaxy Blackhole cho **gói gốc `@deepseek-ai/dsh-workflow`** — **seam năng lực
workflow** (`ctx.workflowEngine`): từ vựng yêu cầu/lượt chạy/kết quả, `WorkflowError` có mã máy
định tuyến được, và **sáu sự kiện vòng đời `workflow/*` chỉ-quan-sát**.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Giá trị |
|---|---|
| Gói gốc | `@deepseek-ai/dsh-workflow` **0.2.1-alpha.4** |
| Đường dẫn CHỈ ĐỌC đã đọc | `apps/host/node_modules/@deepseek-ai/dsh-workflow/lib/index.js` (**92 dòng**) |
| Từ vựng kiểu gốc | `…/lib/types/index.d.ts` (128) · `types.d.ts` (118) · `runtime-types.d.ts` (45) |
| Đầu ra phụ của gốc | `…/lib/types/types.js` (16 dòng) — `exports["./types"]` |
| Mức dẫn xuất | **Viết lại theo hành vi** — không chép code; mọi quyết định dưới đây đo trên **artifact** của cả hai bên |
| `locale/` | **Bản gốc KHÔNG có** ⇒ gói này **không ship** `locale/*.json` (luật 000e chỉ áp khi bản gốc có) |
| `dsh.client` | **KHÔNG có** (câu hỏi 5) ⇒ **không có nửa browser**, không có id module nào |

## 2. Năm câu hỏi bắt buộc (mục 0 của recipe)

| # | Câu hỏi | Trả lời ĐO ĐƯỢC |
|---|---|---|
| 1 | Row này có đang BẬT không? | **Đây KHÔNG phải một row.** `@deepseek-ai/dsh-workflow` **không có** trong `docs/PARITY-MATRIX.md` (205 row) và **không có** trong `apps/host/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml`; `bun run row:cost workflow` trả **"khong tim thay row workflow"**. Nó sống vì **là phụ thuộc module** của row `workflow-ptc` (đang BẬT): `dsh-workflow-ptc/lib/index.js:5` → `import WorkflowEngine, { WorkflowError, WorkflowRunId } from "@deepseek-ai/dsh-workflow"`. ⇒ **Thay gói này là thay ở tầng MODULE, không phải disable+insert một row.** |
| 2 | Thuần host hay có mount surface client? | **Thuần host.** Nhưng có **một đầu ra phụ an toàn-browser** (`exports["./types"]`) chỉ chứa hàm đóng dấu `WorkflowRunId` — ta ship lại y hệt ở `lib/types.js`. Đo: **không** bundle nào trong `apps/host/node_modules` `require("@deepseek-ai/dsh-workflow/types")` ⇒ chưa có người tiêu thụ, nhưng vẫn giữ để bề mặt gói khớp bản gốc. |
| 3 | Cần seam nào? | `extends Service` (`@deepseek-ai/cordis`) · `extends HarnessError` (`@deepseek-ai/dsh-llm`) · **không** `node:` builtin · **không** gói ngoài bảng §3b ngoài hai cái trên (lý do ở §4). |
| 4 | Hành vi đo được là gì? | (a) đăng ký service tên **`workflowEngine`**; (b) **sáu** sự kiện `workflow/*` được phát qua `ctx.events.dispatch("emit", …)` với thân y nguyên; (c) **cô định** người nghe: người ném/reject **không** chặn người sau và **không** lan ra người phát, mỗi hỏng hóc đúng **một** dòng `ctx.logger.warn`; (d) `WorkflowError` mang `code` + `fatal`, `isFatalWorkflowError` là `instanceof`; (e) `WorkflowRunId(s)` trả **chính** `s`. **Không** phát minh hành vi nào khác: lớp gốc **trừu tượng**, `start` do nhà cung cấp cài. |
| 5 | Package gốc có `dsh.client` không? | **Không.** `python3 -c "…get('dsh').get('client')"` ⇒ `False`. |

## 3. Bảng TRƯỚC/SAU (đo trên ARTIFACT — lệnh tái lập ở §6)

| Phép đo | TRƯỚC (bản gốc) | SAU (bản ta) |
|---|---|---|
| Tập export `lib/index.js` | `WorkflowEngine` · `WorkflowError` · `WorkflowRunId` · `isFatalWorkflowError` · `default` | **Y HỆT 5 tên**, `default === WorkflowEngine` |
| Prototype `WorkflowEngine` | `constructor` · `emitWorkflowEvent` | **Y HỆT** (bản gốc **không** cài `start`) |
| `lib/types.js` (đầu ra `./types`) | `WorkflowRunId` | **Y HỆT** |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |
| `grep -c "id: @galaxy-blackhole" lib/index.js` | — | **0** (host-only, không đăng ký id module) |
| Vết phát **6** sự kiện (tên + thân + thứ tự) | 6 dòng | **6 dòng TRÙNG TỪNG DÒNG** |
| Người nghe NÉM → cảnh báo | `workflow: workflow/log listener threw: Error: boom` | **chuỗi y hệt**; người nghe sau VẪN chạy |
| Người nghe REJECT → cảnh báo | `workflow: workflow/end listener rejected: Error: reject-boom` | **chuỗi y hệt** sau microtask |
| `String(error)` cũng ném | `[unrenderable thrown value]` | **y hệt** |
| `WorkflowError` (11 mã · `cause` · `fatal:false`) | `name/code/message/fatal/cause` | **y hệt từng trường**, và `instanceof HarnessError` của kernel |
| Service `workflowEngine` khi cắm qua `ctx.plugin` | có mặt, `name = "workflowEngine"` | **y hệt** |

**Khác biệt đã biết (vô hại, có lý do):** `lib/index.js` của ta **nhúng** một bản `WorkflowRunId`
riêng thay vì `import` từ `lib/types.js` (Bun gộp entrypoint). Hàm này **đồng nhất và thuần**
(không trạng thái, không so sánh danh tính ở đâu trong repo) ⇒ không đổi hành vi. Bản gốc cũng
tách `types.js` vì nó build bằng tsdown nhiều entrypoint.

## 4. Peer — vì sao đúng hai cái, và vì sao ba gói kia KHÔNG phải peer

`gbh.peers` = `peerDependencies` = **`@deepseek-ai/cordis` + `@deepseek-ai/dsh-llm`**
(`gbh.peers ⊆ peerDependencies` — có test đối chứng âm).

| Gói | Vì sao | Seam nào |
|---|---|---|
| `@deepseek-ai/cordis` | `WorkflowEngine extends Service`; `ctx.events` + `ctx.logger`; phải là **CÙNG một lớp** với kernel, không phải bản sao | seam kernel (§3b) |
| `@deepseek-ai/dsh-llm` | `WorkflowError extends HarnessError` — **hợp đồng liên gói**: `dsh-tools`/`dsh-tool-workflow` định tuyến theo `HarnessError`/`code`; một bản sao `HarnessError` sẽ làm `instanceof` trượt ⇒ mất `code` trong kết quả tool. Tiền lệ: `packages/host/user-questions` (§4 README mục `host/user-questions`) | **ngoài** bảng §3b — cần Lead xác nhận, như `user-questions` đã xin |

**Ba gói CHỈ MƯỢN KIỂU** (khai `devDependencies`, **không** `peerDependencies`, **không** `gbh.peers`):

| Gói | Chỉ dùng cho | Vì sao không phải peer |
|---|---|---|
| `@deepseek-ai/dsh-brand` | `Branded<"WorkflowRunId">` | kiểu bị **xoá** lúc build; không có mặt lúc chạy ⇒ symlink vào profile là vô nghĩa |
| `@deepseek-ai/dsh-session` | `SessionId` của `WorkflowAgentInfo.childId` | như trên (chỉ kiểu) |
| `@deepseek-ai/dsh-agent` | `Agent` của `WorkflowStartRequest.parent` | như trên (chỉ kiểu) — cùng cách `packages/host/jobs-local` xử lý `dsh-agent` |

Mọi gói trên **có thật** trong kernel (`apps/host/node_modules/@deepseek-ai/<tên>/package.json`).

## 5. Vì sao gói này KHÔNG khai `gbh.row` (và cái gì phải xảy ra trước khi khai)

1. **Không có row để tắt.** Bản gốc không nằm trong `cordis.patch.yml`; nó được `workflow-ptc`
   `import` trực tiếp. Cơ chế `disable + insert` của `bh host` **không biểu diễn được** việc thay
   một **phụ thuộc module** ⇒ khai `gbh.row` sẽ tạo một row **thừa** (id không tồn tại trong cây).
2. Gói hiện ở trạng thái **an toàn để viết dở**: chưa khai `gbh.row` ⇒ `bh host` **không mount**
   (`apps/cli/src/mount.ts:122` bỏ qua package không có `row.id`) ⇒ không thể làm hỏng app của ai.
3. **Có test canh**: `tests/host/workflow.test.ts` khẳng định `gbh.row === undefined` — ai bật sớm
   thì test ĐỎ ngay.
4. Khi Lead quyết định đường mount (alias module trong `profiles/node_modules` hoặc cơ chế khác),
   **xoá test canh** rồi mới khai.

## 6. Lệnh tái lập

```bash
cd <repo>
bun run build.ts                     # hoặc: bun run packages/host/workflow/build.ts <outDir>
grep -c 'id: @deepseek-ai' packages/host/workflow/lib/index.js      # phải = 0
bun test tests/host/workflow.test.ts                                # 15 pass · 0 fail
bun run check:rows                                                  # gói này không khai gbh.row ⇒ 0 dòng mới ở cột chan
bun run tools/lint/gate.ts --no-tests                                # cổng của gói này XANH
```

## 7. Phần CHƯA làm (nói thẳng)

- **Chưa mount** (không có row để mount) — thuộc quyết định của Lead; xem §5.
- **Chưa có** `lib/index.d.ts`: mọi package host khác của repo cũng không ship `.d.ts`; kiểu của
  seam được khai lại trong `src/` và chỉ dùng nội bộ + `declare module` cho người biên dịch repo này.
- `lab:row` **không áp dụng** cho gói này (công cụ đòi `gbh.row.id` để tắt row stock).
- Ba gói kiểu (`dsh-brand`/`dsh-session`/`dsh-agent`) chưa được Lead xác nhận là **được phép**
  khai `devDependencies`; hiện chúng chỉ phục vụ `bun run gate` (typecheck) và **không** vào profile.
