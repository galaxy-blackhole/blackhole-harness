<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row tool-worktree: nguồn đối chiếu, hợp đồng tool, lý do peer, TRƯỚC/SAU và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-tool-worktree

Row `tool-worktree` của DSH, viết lại thành package của ta. **Một mặt** (host-only):
package gốc **KHÔNG** có `dsh.client`, **KHÔNG** có `lib/client.js` (đã kiểm ở bước 0), nên chỉ có nửa host.

## 1. Nguồn đối chiếu (G4)

| Mục | Giá trị |
|---|---|
| Gói gốc | `@deepseek-ai/dsh-experimental-tool-worktree` (`0.2.1-alpha.4`) |
| Đường dẫn đọc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-experimental-tool-worktree/lib/index.js` (**66 dòng**) + `lib/types/index.d.ts` |
| Hàng trong ma trận | `docs/PARITY-MATRIX.md` dòng 200 — `tool-worktree` · T5 · phụ thuộc `cordis, dsh-experimental-worktree, dsh-tools` |
| Mức dẫn xuất | **Viết lại theo hành vi** (đọc bundle gốc để lấy hợp đồng: tên tool, mô tả, schema, cách uỷ quyền seam) — **không chép code** |
| Đối chứng | Test nạp **chính bundle gốc** và **chính artifact của ta** rồi so từng hành vi (mục 4) |

## 2. Hợp đồng bề mặt (giữ nguyên từ bundle gốc)

| Export | Giá trị | Ghi chú |
|---|---|---|
| `name` | `tool-worktree` | tên plugin cordis, **nguyên văn** (không phải tên package) |
| `inject` | `["tools", "worktrees"]` | chờ sổ tool của kernel và runtime worktree của phiên |
| `apply(ctx)` | đăng ký **đúng một** tool | `ctx.tools.register(defineTool({...}))` |

Tool đăng ký (nguyên văn từ bản gốc):

- tên `create_worktree`; hai tham số **đều không bắt buộc**: `name` (string, tên nhánh **kiêm** tên thư mục checkout) và
  `from` (string, commit/nhánh/tag **cục bộ**; bỏ trống ⇒ `HEAD` và **không fetch**);
- kết quả canonical `{ path, branch, baseCommit, repositoryRoot }` — **cả bốn bắt buộc**, `additionalProperties: false`;
- `output.render` trả đúng một khối `{ type: "text", text: JSON.stringify(value) }`;
- `presentCall` trả `{ card: "generic", title: "create_worktree", rawInput: args }`;
- `execute`: thiếu agent ⇒ ném `create_worktree requires a calling agent`; có agent ⇒
  `worktrees.create(agent, args, signal)`. **Toàn bộ** việc phân giải revision, tạo nhánh/checkout, giới hạn tài nguyên
  tiến trình và ghi bền thư mục phiên thuộc seam `worktrees` — row này **không** tự gọi `git` và **không** tự ghi đĩa.

## 3. Vì sao các peer này

| Peer | Vì sao | Thuộc seam nào |
|---|---|---|
| `@deepseek-ai/dsh-tools` | `defineTool` là thứ **dựng** định nghĩa tool (biên dịch schema, validate tham số, validate `presentCall`). Tự cài lại là tạo nguồn sự thật thứ hai cho cùng một tool schema | nhóm **`tool-*`** của `HOST-ROW-REWRITE.md` §2b và cột *Phụ thuộc* của ma trận dòng 200 |
| `@deepseek-ai/dsh-experimental-worktree` | seam `worktrees`: `create` là chủ sở hữu duy nhất của nhánh + checkout + thư mục phiên | seam của chính tool (cùng dòng ma trận) |
| `@deepseek-ai/cordis` | chỉ mượn **kiểu** `Context` (import type, bị xoá khi build) | bảng §3b (`packages/README.md`) |

Cả ba nằm ở **`peerDependencies`** (kernel cấp đúng **một** thể hiện), và `gbh.peers` ⊆ `peerDependencies`
— có **đối chứng âm** trong test (cùng số lượng nhưng lệch phần tử vẫn bị bắt; xoá đúng một tên thật thì báo đúng tên đó).

## 4. TRƯỚC / SAU (đo trên ARTIFACT, chưa mount)

| Phép đo | Bản gốc | Bản của ta |
|---|---|---|
| Tập export trên artifact | `apply` · `inject` · `name` (**3**) | **3 = 3**, 0 thiếu · 0 thừa |
| Định nghĩa tool (tên · mô tả · schema tham số · schema kết quả · `render` · `presentCall`) | — | **sâu bằng** bản gốc (so `JSON.stringify` từng phần) |
| `execute` với `{}` · `{ name }` · `{ from }` · `{ name, from }` | — | cùng kết quả; seam nhận **cùng agent**, **cùng THAM CHIẾU args**, **cùng tín hiệu** (so `===`) |
| Seam bị THAY sau `apply` | dùng seam mới | **dùng seam mới** (y hệt) |
| Đường lỗi: thiếu agent · tham số sai kiểu · tham số lạ · seam ném | — | thông điệp **và** tên lớp lỗi **khớp**; không treo; không chạm seam khi lỗi đầu vào |
| C6 — hai lượt `apply` | hai định nghĩa độc lập | **hai định nghĩa độc lập**, kiểm bằng **DANH TÍNH** (`parameters`/`output.schema`/card), có **đối chứng âm** cho thấy so sâu không đủ |
| `grep -c 'id: @deepseek-ai' lib/index.js` | 0 (row một mặt) | **0** |
| `grep -c 'id: @galaxy-blackhole' lib/index.js` | — | **0** (không đăng ký id module nào — host-only) |
| `locale/{en,zh}.json` | có (6 dòng/tệp) | **byte-for-byte** (sha khớp), có `exports["./locale/*.json"]` |
| Test | — | **11 ca / 129 expect · 0 fail** |

Tái lập:

```bash
cd packages/host/tool-worktree && bun run build.ts
grep -c "id: @deepseek-ai" lib/index.js      # 0
cd ../../.. && bun test tests/host/tool-worktree.test.ts
```

## 5. Hai khác biệt CÓ CHỦ Ý (ghi để người sau không tưởng là lỗi)

1. **Đọc seam bằng `ctx.get("worktrees")`** thay vì `ctx.worktrees`, rồi ép về một interface hẹp
   (`create`) **khai ngay trong file**, không `declare module` ambient. Lý do: luật **000d** cấm ambient cho module
   có thật — `@deepseek-ai/dsh-experimental-worktree` **có** `.d.ts` trên đĩa (và chính nó đang augment
   `Context.worktrees`), thêm một ambient nữa là rủi ro đè kiểu ở **mọi file trong cùng chương trình `tsc`**.
   `inject` vẫn giữ nguyên nên seam chắc chắn có mặt trước khi `apply` chạy.
2. Đọc seam **ở THỜI ĐIỂM GỌI**, không giữ tham chiếu từ lúc `apply` — đúng cách bản gốc đọc qua proxy cordis.
   Có ca test riêng: thay seam sau `apply` thì **cả hai** dùng seam mới.

## 6. CHƯA làm (điều kiện chặn mount)

- Gói **CHƯA khai `gbh.row`** (theo yêu cầu nhiệm vụ): chưa mount, nên **chưa có** số đo trên app 5439
  (`check:app`, `parity:dump`, `did not activate`). Có **test canh** khẳng định `gbh.row` chưa được khai —
  khi Lead khai, phải đổi ca test đó thành khẳng định `gbh.row.id = tool-worktree`.
- `lab:row` chưa chạy (cần `gbh.row`). `parity:dump` chưa có TRƯỚC/SAU của row này.
- ⚠️ **Lệch tên trong ma trận**: dòng 200 của `docs/PARITY-MATRIX.md` ghi cột "package của ta" là
  `@galaxy-blackhole/gbh-experimental-tool-worktree`, còn nhiệm vụ row này đặt gói tại
  `packages/host/tool-worktree/` với tên `@galaxy-blackhole/gbh-tool-worktree` (đúng tiền lệ
  `tool-working-directory`). Cần Lead chốt một tên trước khi khai `gbh.row` — đổi tên **sau** mount sẽ phá id bundle.
- **Chưa mount ⇒ chưa kiểm được hành vi git thật** (tạo nhánh, checkout, đổi thư mục phiên): test chỉ đo **hợp đồng**
  với seam giả có ghi vết. Phép đo đầu-cuối thuộc lượt boot của Lead.
