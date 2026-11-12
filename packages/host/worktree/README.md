<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 10/11/2026 — ghi lại NGUỒN cắm row thật (bundle-tool-worktree) sau sự cố "tắt plugin mà vẫn chạy"
 desc Ban viet lai cua Galaxy Blackhole cho row worktree (@deepseek-ai/dsh-experimental-worktree): nguon doi chieu G4, ly do peer, bang TRUOC/SAU, va phan CHUA lam
-->

# `@galaxy-blackhole/gbh-worktree` — row `worktree` (T5 · experimental · M6)

Bản viết lại **trung thành** của `@deepseek-ai/dsh-experimental-worktree` — seam **`ctx.worktrees`**:
tạo một nhánh Git **mới** + checkout **mới** tại một revision **cục bộ** rồi đưa **phiên gọi** vào đó,
dưới hạn tài nguyên tiến trình và **chính sách tệp hiện có** của chính phiên.

## 1. Bước 0 — xác nhận cặp row (ĐO, không suy)

| Việc | Kết quả |
|---|---|
| Dump MỚI NHẤT | `.parity/dumps/2026-10-18T01-31-57/ours.yml` (mtime 18/10/2026 08:32) |
| Cặp `- id` + `name` | `- id: worktree` + `name: '@deepseek-ai/dsh-experimental-worktree'` ở `ours.yml` **dòng 1475–1476** (order **198**) — **CÓ THẬT** |
| Trạng thái | **ĐANG BẬT** (không dòng `disabled`, không bị `app.patch.yml` tắt) |
| `config:` của row | **RỖNG** (row trần, không phải dạng `!!js`) ⇒ luật *"config dùng `ctx.<X>` thì `inject` PHẢI chứa `<X>`"* **không áp dụng** — đã kiểm tường minh, không bỏ qua |
| `inject:` của row | **RỖNG** ⇒ gói ta **không** khai `inject` trong `gbh.row` (khai thêm là lệch row gốc) |
| `lib/client.js` của gói gốc | **KHÔNG TỒN TẠI** (`find` chỉ ra `lib/index.js` + 4 tệp `lib/types/*.d.ts`) ⇒ row **MỘT MẶT** |
| Khoá `dsh` trong `package.json` gốc | **KHÔNG CÓ** ⇒ câu hỏi 5 = **KHÔNG** (không có nửa browser) |
| Có trong `stock.yml` (188 row)? | **KHÔNG** ⇒ row thử nghiệm, chỉ tồn tại ở cây oracle/ours |
| Cặp row lân cận KHÁC | `- id: tool-worktree` → `@deepseek-ai/dsh-experimental-tool-worktree` (đã tắt trong patch; gói `gbh-tool-worktree` của ta giữ **row riêng**) — **không** nhầm hai row |

## 2. Năm câu hỏi bắt buộc (§0 của `HOST-ROW-REWRITE.md`)

| # | Câu hỏi | Trả lời ĐO ĐƯỢC |
|---|---|---|
| 1 | Row này có **đang BẬT** không? | **CÓ** — `ours.yml` dòng 1475–1476 không `disabled`; patch đang chạy không có khối tắt `worktree` |
| 2 | Thuần **host** hay có mount surface client? | **Thuần HOST** — không `lib/client.js`, không `dsh.client`, không `slots.*`, không `__ModuleLoader__` |
| 3 | Cần **seam** nào? | `extends Service` (cordis, **bậc 1**) · `schemastery` (**bậc 1**, schema `Config`) · `dsh-timeout` (**bậc 2**: `deadline` + `MAX_TIMER_DELAY_MS`) · và **năm seam cấp dịch vụ** — `workingDirectory` · `fs` · `subprocess` · `sandbox` · `sandboxPolicy` — khai **theo CẤU TRÚC** (mục 3) |
| 4 | **Hành vi đo được** là gì? | `ctx.worktrees.create(agent, request?, signal?)` → `{path, branch, baseCommit, repositoryRoot}` + **đổi thư mục phiên**; đo bằng **8 lệnh Git/Node** trên giàn giả (mục 5) |
| 5 | Gói gốc có `dsh.client` không? | **KHÔNG** (đo cả `package.json` lẫn `lib/`) ⇒ MỘT MẶT |

## 3. Peer — vì sao CHỈ ba tên, và vì sao năm seam khai theo CẤU TRÚC

`gbh.peers` = `peerDependencies` = **`@deepseek-ai/cordis`** (bậc 1) · **`@deepseek-ai/schemastery`** (bậc 1) ·
**`@deepseek-ai/dsh-timeout`** (bậc 2 — bảng **§3b**). **0 peer ngoài bảng §3b** ⇒ không cần Lead duyệt mở rộng.

Năm seam còn lại (`workingDirectory` · `fs` · `subprocess` · `sandbox` · `sandboxPolicy`) row này **gọi lúc chạy**
nhưng **không import**: kiểu của chúng được khai **theo CẤU TRÚC** trong `src/seams.ts`, đúng khuôn gói
`packages/host/working-directory` đã dùng. **Lý do ĐO ĐƯỢC**: `.d.ts` của `dsh-fs`/`dsh-subprocess`/
`dsh-sandbox-policy`/`dsh-working-directory` kéo theo `@deepseek-ai/dsh-agent` + `@deepseek-ai/dsh-session` —
hai gói **ngoài bảng §3b**; import chúng để lấy một chữ ký sẽ **mở rộng bảng peer** mà không đổi hành vi.
Bề mặt thật của row là **tên service + phương thức**, và nó được canh bằng phép A/B ở mục 5 chứ không bằng kiểu.

Hai điều **cố ý** giữ nguyên như bản gốc:
- `static inject = ["workingDirectory", "fs", "subprocess", "sandbox", "sandboxPolicy"]` — **nguyên văn**;
- tên service **`worktrees`** — hợp đồng với row `tool-worktree` (`ctx.worktrees.create`); đổi tên là làm chết row kia **âm thầm**.

## 4. Bảng nguồn đối chiếu (G4)

| Phần | Nguồn (CHỈ ĐỌC) | Cách ta làm |
|---|---|---|
| `Config` (7 núm + mặc định) | `lib/index.js` `static Config` | chép **nguyên giá trị** mặc định (`.agents/worktrees` · `worktree-` · `git` · `node` · `6e4` · `3e3` · `65536`) |
| Kiểm cấu hình trong constructor | `lib/index.js` dòng 205–223 | **cùng thứ tự kiểm**, **cùng câu lỗi tiếng Anh** |
| `GIT_ENV` (15 bia mộ) | `lib/types/process.js` | danh sách **nguyên văn 15 tên**; test so từng tên với chính artifact gốc |
| `PREPARE_DIRECTORY` | `lib/types/directory.js` | chuỗi **nguyên văn TỪNG BYTE** (test so thân template literal của hai artifact) |
| `runCommand` | `lib/types/process.js` | cùng thứ tự: `deadline` → `resolveExecutable` → `confine` (bỏ qua khi `danger-full-access`) → `spawn` → `done` → đọc `collected` → `terminate`+`waitForExit` |
| `create` / `resolve` / `createCheckout` | `lib/types/index.d.ts` (chữ ký) + `lib/index.js` (thân) | cùng **thứ tự 8 bước**, cùng **bọc lỗi** `Could not finish worktree …` |
| Vô hiệu hoá bộ lọc Git | `lib/index.js` dòng 319–355 | cùng `--get-regexp`, cùng `lastIndexOf(".")`, cùng `separator > 7`, cùng thứ tự 4 thuộc tính × driver |
| Tập export | `lib/index.js` (`export { WorktreeService, WorktreeService as default }`) | **2 = 2** trên ARTIFACT: `WorktreeService` + `default` (ba kiểu của bản gốc xuất dạng `export type`, bị xoá khi build ⇒ **0 thiếu · 0 thừa**) |
| `locale/` | gói gốc **KHÔNG có** | **000e**: không ship `locale/` (test khẳng định cả hai bên đều không có) |

## 5. TRƯỚC / SAU — phép đo và lệnh tái lập

Row **host**, nên phép đo là **chuỗi lệnh + kết quả**, không phải pixel.

```bash
cd galaxy-blackhole/blackhole-tauri
bun test tests/host/worktree.test.ts     # 22 pass · 401 expect · 0 fail
bun run build.ts                         # trong packages/host/worktree
grep -c "id: @deepseek-ai" lib/index.js   # 0
bun run check:rows | grep worktree        # 0 dòng (không có vấn đề nào cho gói này)
bun run gate --no-tests                   # 7/7 XANH
```

| Phép đo | TRƯỚC (bản gốc) | SAU (bản ta) |
|---|---|---|
| Tập export trên ARTIFACT | `WorktreeService` · `default` | **y hệt** (2 = 2, 0 thiếu · 0 thừa) |
| `Object.getPrototypeOf(WorktreeService)` | `Service` của cordis | **CÙNG một lớp cha thật** (test khẳng định **danh tính**, không phải tên) |
| `create({name:"feat-x"})` | 8 lệnh: `check-ref-format` → `rev-parse --show-toplevel` → `rev-parse --verify` → `show-ref` → `node -e PREPARE_DIRECTORY` → `worktree add` → `config --get-regexp` → `reset --hard` | **y hệt từng argv · từng cwd · từng môi trường (kể cả 15 bia mộ) · từng stdio · từng graceMs** |
| Kết quả `create` | `{path,branch,baseCommit,repositoryRoot}` | **y hệt từng byte** (JSON bằng nhau) |
| Môi trường lượt `reset` khi có 2 driver lọc | `GIT_CONFIG_COUNT=8` + 8 cặp KEY/VALUE | **y hệt, cùng thứ tự chèn** |
| 18 cấu hình hỏng | 18 câu lỗi tiếng Anh | **trùng từng ký tự** |
| 9 tên nhánh sai + revision rỗng | câu lỗi + **0 lệnh nào chạy** | **y hệt** |
| 5 nhánh lỗi lúc chạy | `worktree branch already exists` · `worktree path already exists` · `worktree command failed (1)` · `(SIGTERM)` · `output exceeds maxOutputBytes` | **y hệt** |
| `danger-full-access` | **0** lượt `confine`, argv đi thẳng | **y hệt** |
| C6 — hai thực thể | `lifetime`/`pending`/`config` **riêng** | **y hệt**, kiểm bằng **DANH TÍNH** (`not.toBe`) + **đối chứng âm** cho thấy so sâu không đủ |

## 6. Phần CHƯA làm (nói thẳng)

- **CHƯA mount lên app 5439** và **chưa chạy `lab:row`**: hai việc đó thuộc **lượt boot của Lead** (luật: không ai tự tắt app 5439).
  Vì vậy **chưa có** số `(5) did not activate` · `(8) #root` · `(10) file khớp repo` cho row này.
- `gbh.row` **do LEAD khai NGOÀI phiên viết gói** (commit `70ac35e`) — phiên viết gói **không tự khai**, đúng luật.
  **ĐÍNH CHÍNH 10/11/2026 — nguồn cắm row nay là BUNDLE, không còn overlay**: `packages/host/bundle-tool-worktree/cordis.patch.yml`
  cắm `- id: worktree` + `name: '@galaxy-blackhole/gbh-worktree'` (không `inject`, không `config`), còn `gbh.row` của gói
  khai `ownedByBundle: true` nên `app.patch.yml` **không** phát khối `worktree-ours` nữa. Nhờ vậy tắt bundle
  `gbh-tool-worktree-bundle` thì row biến mất thật (trước đó khối `-ours` vẫn nạp gói ⇒ tắt mà tính năng vẫn chạy).
  Bảng đo và cách kiểm lại: `tools/check/toggle-matrix.ts`; sai khác có chủ đích: `docs/GBH-SAI-KHAC-CO-CHU-DICH.md` §2j.
- **Chưa có ca test với Git THẬT** (chỉ có giàn seam giả): đó là chủ ý — test đơn vị không được tạo nhánh/thư mục trong repo của người khác.
  Phép đo Git thật thuộc nghiệm thu lab/mount.

## 7. Khác biệt CÓ Ý (đã cân nhắc, không phải sơ suất)

1. **Không ship `lib/types/*.d.ts`** như bản gốc: bản gốc ship 4 tệp khai kiểu cho các module nội bộ
   (`directory` · `process` · `types`). Ta khai kiểu **trong `src/*.ts`** và chỉ build MỘT `lib/index.js` —
   đúng khuôn của mọi gói host đang chạy trong repo. Bề mặt `export` trên ARTIFACT **không đổi** (2 = 2).
2. **Hai hàm phụ không export từ `index`**: `runCommand` + `PREPARE_DIRECTORY` là bề mặt `lib/types/*.d.ts` của bản gốc
   nhưng **không** nằm trong `lib/index.js` gốc ⇒ ta giữ chúng ở module nội bộ (`src/process.ts`, `src/directory.ts`),
   **không** xuất từ entry. Xuất từ entry sẽ là **THỪA** so với artifact gốc.
