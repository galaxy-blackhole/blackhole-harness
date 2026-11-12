<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row tool-working-directory: nguồn đối chiếu, hợp đồng tool, lý do peer, TRƯỚC/SAU và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-tool-working-directory

Row `tool-working-directory` của DSH, viết lại thành package của ta. **Một mặt** (host-only):
package gốc **KHÔNG** có `dsh.client`, **KHÔNG** có `lib/client.js` (đã kiểm ở bước 0), nên chỉ có nửa host.

## 1. Nguồn đối chiếu (G4)

| Mục | Giá trị |
|---|---|
| Gói gốc | `@deepseek-ai/dsh-tool-working-directory` (`0.2.1-alpha.4`) |
| Đường dẫn đọc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-tool-working-directory/lib/index.js` (**45 dòng**) + `lib/types/index.d.ts` |
| Hàng trong ma trận | `docs/PARITY-MATRIX.md` dòng 31 — `tool-working-directory` · T1 · phụ thuộc `cordis, dsh-tools, dsh-working-directory` |
| Mức dẫn xuất | **Viết lại theo hành vi** (đọc bundle gốc để lấy hợp đồng: tên tool, mô tả, schema, cách uỷ quyền seam) — **không chép code** |
| Đối chứng | Test nạp **chính bundle gốc** và **chính artifact của ta** rồi so từng hành vi (mục 4) |

## 2. Hợp đồng bề mặt (giữ nguyên từ bundle gốc)

| Export | Giá trị | Ghi chú |
|---|---|---|
| `name` | `tool-working-directory` | tên plugin cordis, **nguyên văn** (không phải tên package) |
| `inject` | `["tools", "workingDirectory"]` | chờ sổ tool của kernel và chủ sở hữu thư mục của phiên |
| `apply(ctx)` | đăng ký **đúng một** tool | `ctx.tools.register(defineTool({...}))` |

Tool đăng ký (nguyên văn từ bản gốc):

- tên `working_directory`; tham số duy nhất `cd` (string, **không bắt buộc**) — bỏ trống nghĩa là **đọc** thư mục hiện tại;
- kết quả canonical `{ cwd }` với `cwd` **bắt buộc**, `additionalProperties: false`;
- `output.render` trả đúng một khối `{ type: "text", text: cwd }`;
- `execute`: thiếu agent ⇒ ném `working_directory requires an agent Session`; không `cd` ⇒ `workingDirectory.ensure(agent, signal)`;
  có `cd` ⇒ `workingDirectory.set(agent, path, signal)`. **Toàn bộ** việc kiểm tra tồn tại, khôi phục, ghi bền và
  thông báo ngữ cảnh thuộc seam `workingDirectory` — row này **không** tự đọc/ghi đĩa.

## 3. Vì sao các peer này

| Peer | Vì sao | Thuộc seam nào |
|---|---|---|
| `@deepseek-ai/dsh-tools` | `defineTool` là thứ **dựng** định nghĩa tool (biên dịch schema, validate tham số). Tự cài lại là tạo nguồn sự thật thứ hai cho cùng một tool schema | nhóm **`tool-*`** của `HOST-ROW-REWRITE.md` §2b và cột *Phụ thuộc* của ma trận dòng 31 |
| `@deepseek-ai/dsh-working-directory` | seam `workingDirectory`: `ensure`/`set` là chủ sở hữu duy nhất của thư mục phiên | seam của chính tool (cùng dòng ma trận) |
| `@deepseek-ai/cordis` | chỉ mượn **kiểu** `Context` (import type, bị xoá khi build) | bảng §3b (`packages/README.md`) |

Cả ba nằm ở **`peerDependencies`** (kernel cấp đúng **một** thể hiện), và `gbh.peers` ⊆ `peerDependencies`
— có **đối chứng âm** trong test (cùng số lượng nhưng lệch phần tử vẫn bị bắt; xoá đúng một tên thật thì báo đúng tên đó).

## 4. TRƯỚC / SAU (đo trên ARTIFACT, chưa mount)

| Phép đo | Bản gốc | Bản của ta |
|---|---|---|
| Tập export trên artifact | `apply` · `inject` · `name` (**3**) | **3 = 3**, 0 thiếu · 0 thừa |
| Định nghĩa tool (tên · mô tả · schema tham số · schema kết quả · `render`) | — | **sâu bằng** bản gốc (so `JSON.stringify` từng phần) |
| `execute` với `{}` · `{ cd: "src" }` · `{ cd: "/tmp/tuyet-doi" }` | — | cùng kết quả, cùng **vết lời gọi seam** (`ensure` → `set` → `set`), cùng **agent** và **tín hiệu** (so `===`) |
| Đường lỗi: thiếu agent · `cd` sai kiểu · seam ném | — | thông điệp **và** tên lớp lỗi **khớp**; không treo; không gọi seam khi thiếu agent |
| `grep -c 'id: @deepseek-ai' lib/index.js` | 0 (row một mặt) | **0** |
| `grep -c 'id: @galaxy-blackhole' lib/index.js` | — | **0** (không đăng ký id module nào — host-only) |
| Test | — | **6 ca / 72 expect · 0 fail** |

Tái lập:

```bash
cd packages/host/tool-working-directory && bun run build.ts
grep -c 'id: @deepseek-ai' lib/index.js      # 0
cd ../../.. && bun test tests/host/tool-working-directory.test.ts
```

## 5. Một khác biệt CÓ CHỦ Ý (ghi để người sau không tưởng là lỗi)

Bản gốc đọc seam bằng `ctx.workingDirectory`; bản của ta đọc bằng `ctx.get("workingDirectory")` rồi ép về một
interface hẹp (`ensure`/`set`) **khai ngay trong file**, không `declare module` ambient.
Lý do: luật **000d** cấm ambient cho module có thật — `@deepseek-ai/dsh-working-directory` **có** `.d.ts` trên đĩa,
và một ambient ở đây sẽ đè kiểu thật ở **mọi file trong cùng chương trình `tsc`**. `inject` vẫn giữ nguyên nên
seam chắc chắn có mặt trước khi `apply` chạy; test chứng minh **cùng một thể hiện seam**, cùng tham số, cùng thứ tự.

## 6. CHƯA làm (điều kiện chặn mount)

- Gói **CHƯA khai `gbh.row`** (theo yêu cầu nhiệm vụ): chưa mount, nên **chưa có** số đo trên app 5439 (`check:app`, `parity:dump`, `did not activate`).
  Có **test canh** khẳng định `gbh.row` chưa được khai — khi Lead khai, phải đổi ca test đó thành khẳng định `gbh.row.id = tool-working-directory`.
- `lab:row` chưa chạy (cần `gbh.row`). `parity:dump` chưa có TRƯỚC/SAU của row này.
- `locale/`: **không áp** — package gốc **không** ship `locale/*.json` (đã kiểm), nên luật 000e không có gì để chép.
