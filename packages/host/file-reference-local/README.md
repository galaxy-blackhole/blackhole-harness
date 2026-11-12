<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi @galaxy-blackhole/gbh-file-reference-local — bang nguon doi chieu G4, ly do peer, bang TRUOC/SAU, phan CHUA lam
-->

# `@galaxy-blackhole/gbh-file-reference-local`

Bản viết lại của Galaxy Blackhole cho row **`file-reference-local`** của DSH
(`@deepseek-ai/dsh-file-reference-local`, bản gốc **406 dòng** build trong một `lib/index.js`).

Vai trò: **tham chiếu tệp cục bộ** — nhà cung cấp seam `ctx.fileReferences` trên hệ tệp của host.
Row này **KHÔNG có nửa browser** (`lib/client.js` không tồn tại, manifest gốc không có `dsh.client`)
⇒ **MỘT MẶT**, thuần host.

---

## 1. Bước 0 — đo trên oracle dump MỚI NHẤT (`2026-10-18T01-31-57/ours.yml`)

| Phép đo | Kết quả |
|---|---|
| cặp `- id:` + `name:` | `ours.yml` **dòng 534–535**: `- id: file-reference-local` · `name: '@deepseek-ai/dsh-file-reference-local'` |
| `config:` của row | **KHÔNG CÓ** (dòng 536 là row kế tiếp `session-stats`) |
| `inject:` của row | **KHÔNG CÓ** (như trên) |
| `disabled:` | **KHÔNG** ⇒ row gốc đang BẬT |
| `!!js` trong config | **KHÔNG** ⇒ luật *"`config` dùng `ctx.X` thì `inject` phải chứa `X`"* **không áp dụng** — nhưng đã KIỂM, không bỏ qua |
| `lib/client.js` | **KHÔNG tồn tại** ⇒ MỘT MẶT |
| `locale/` | **CÓ** (`en.json` · `zh.json`) ⇒ luật **000e** áp dụng |

⇒ `gbh.row` (khi Lead khai) chỉ cần **`id` + `tests`** — **KHÔNG** `config`, **KHÔNG** `inject`,
**KHÔNG** `moduleIds`/`aliases` (row một mặt, không có id bundle nào).

---

## 2. G4 — BẢNG NGUỒN ĐỐI CHIẾU

Bản gốc là MỘT file có hai vùng `//#region`; ta tách theo đúng ranh giới ấy.

| Vùng gốc | Dòng gốc | Module của ta | Nội dung |
|---|---|---|---|
| `lib/types/search.js` | 6–312 | `src/search.ts` | `DEFAULT_FILE_SEARCH_{MAX_RESULTS,MAX_ENTRIES,EXCLUDED_DIRECTORIES}` · `WorkspaceFileSearch` (duyệt cây, liệt kê theo thư mục, xếp hạng 5 bậc + dãy con, `waitForPromise` huỷ được) |
| `lib/types/index.js` | 313–405 | `src/index.ts` | `LocalFileReferenceService` (mặt plugin: `static inject` · `static Config` · mục prompt `context:file-reference` · sổ chỉ mục theo agent · 3 sự kiện vòng đời + hiệu ứng dọn) · `validateConfig` |
| — | — | `src/types.ts` | Kiểu **theo CẤU TRÚC** cho các seam chỉ-mượn-kiểu (sổ agent · thư mục làm việc · prompt hệ thống · sổ tool · sự kiện phiên) |
| `export { … }` | 406 | `src/index.ts` | **9 tên**: `DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES` · `DEFAULT_FILE_SEARCH_MAX_ENTRIES` · `DEFAULT_FILE_SEARCH_MAX_RESULTS` · `FILE_REFERENCE_PROMPT` · `LocalFileReferenceService` · `default` · `WorkspaceFileSearch` · `activeAtToken` · `formatFileMention` |

**Hành vi trung thành đáng chú ý** (mỗi cái có ca test canh):

1. **Chỉ mục dùng chung một lượt quét**; `invalidate()` KHÔNG xoá chỉ mục — nó chỉ tăng bộ đếm, và
   lượt trả lời kế tiếp vẫn dùng các mục CŨ trong khi bản thay thế dựng ở phía sau con trỏ. Đây là
   điểm dễ "tối ưu hoá" sai nhất: xoá đi là mỗi `tool/result` lại bắt người dùng chờ một lượt duyệt
   cả workspace.
2. **Hai lớp kiểm cấu hình, hai tiền tố khác nhau** — `WorkspaceFileSearch` ném
   `"file search …"`, còn `validateConfig` của plugin ném `"file-reference-local: …"`. Giữ NGUYÊN cả
   hai; gộp lại là đổi thông điệp mà người vận hành đọc.
3. **`readWorkspaceRoot` NÉM khi đọc gốc hỏng, `readDirectory` thì trả rỗng** — gốc workspace hỏng là
   lỗi thật, thư mục con hỏng quyền thì bỏ qua.
4. **`text` của mục prompt đọc `agent.ctx.tools`, không đọc `scope.tools`** — và chữ dựng MỖI lượt
   (không nhớ sẵn), nên agent mất tool `read` thì mục rỗng ngay.
5. **`resolveDisplayDirectory` đi từng đoạn bằng `lstat`** và từ chối liên kết tượng trưng — một
   `@` không thể đi xuyên symlink ra ngoài gốc.
6. **`lib` CỐ Ý không nằm trong danh sách loại trừ** (gem Ruby và nhiều gói npm giữ mã nguồn ở đó);
   loại nó đi là `@` bỏ sót nguồn một cách im lặng.

---

## 3. Năm câu hỏi

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có đang BẬT không? | **CÓ** — `ours.yml` L534–535 không có `disabled` |
| 2 | Thuần host hay có mount surface client? | **Thuần host** — không `lib/client.js`, không `dsh.client`, không `__ModuleLoader__` trong artifact |
| 3 | Cần seam nào? | `ctx.agents` · `ctx.workingDirectory` (hai seam trong `static inject`) · `ctx.fileReferences` (seam nó CẤP) · `ctx.systemPrompt` + `ctx.tools` qua `agent.ctx.inject` · kế thừa `FileReferenceService` của kernel |
| 4 | Hành vi đo được? | RPC `fileReferences/list` của `dsh-api-session-controller` — ủy nhiệm thẳng `ctx.fileReferences.list(agent, query, signal)`; cộng mục prompt `context:file-reference` trong ngữ cảnh hệ thống của mỗi agent |
| 5 | Package gốc có `dsh.client`? | **KHÔNG** ⇒ MỘT MẶT, thay được ngay |

---

## 4. Peer — lý do ĐO ĐƯỢC

| peer | bậc §3b | vì sao |
|---|---|---|
| `@deepseek-ai/cordis` | **bậc 1** | `Service` + `Context` của kernel |
| `@deepseek-ai/schemastery` | **bậc 1** | schema `Config` (3 trường) |
| `@deepseek-ai/dsh-file-reference` | ⚠️ **NGOÀI bảng §3b** | (a) `LocalFileReferenceService extends FileReferenceService` — phải là **CÙNG một lớp**, không phải bản sao: chính constructor lớp cha gọi `super(ctx, "fileReferences")`, nên bản sao sẽ đăng ký service sai/không đăng ký; (b) ba export `FILE_REFERENCE_PROMPT` · `activeAtToken` · `formatFileMention` được **tái xuất nguyên văn**, không chép đè — test khẳng định **cùng thể hiện hàm** với gói gốc. Tiền lệ: `dsh-bash-local` cho `bash-sandbox` (§2b). **Cần Lead xác nhận mở rộng §3b.** |
| `@deepseek-ai/dsh-agent` | — | **CHỈ mượn KIỂU** (`import type { Agent }`) ⇒ ở `devDependencies`, **không** vào `gbh.peers`; đo được: artifact **không** chứa chuỗi `@deepseek-ai/dsh-agent` |

`gbh.peers = ["@deepseek-ai/dsh-file-reference"]` ⇒ **⊆ `peerDependencies` 1/1, so PHẦN TỬ**, có
**3 đối chứng âm** (xoá-một-tên · xoá-sạch · cùng-số-lượng-mà-lệch-phần-tử) ở `ca 6–8`.
`dependencies` **RỖNG**.

⚠️ **Một điểm cấu hình có thật**: symlink `node_modules/@deepseek-ai/{cordis,schemastery}` của gói
trỏ vào bản **của kernel** (`apps/host/node_modules/…`), KHÔNG phải bản ở `node_modules/.bun`. Lý do
đo được: `dsh-file-reference` phân giải `@deepseek-ai/cordis` từ `apps/host/node_modules`; trỏ sai
bản ⇒ **hai lớp `Context` khác nhau** ⇒ `tsc` báo `TS2345` ngay ở `super(ctx)` (đã vấp thật).

---

## 5. TRƯỚC / SAU

Row **CHƯA mount** (gói chưa khai `gbh.row` theo chỉ đạo của Lead) ⇒ **chưa có phép đo TRƯỚC/SAU
trên app 5439**. Bảng dưới là phép đo sẽ chạy khi Lead mount:

| Phép đo | TRƯỚC (row gốc) | SAU (row của ta) |
|---|---|---|
| `POST /api` `fileReferences/list` với `query: "src/"` | 200 · danh sách đường dẫn | **phải Y HỆT** từng ứng viên + `kind` |
| ngữ cảnh hệ thống của agent có tool `read` | 1 mục `context:file-reference` | **y hệt**, `order` lấy từ `getSectionOrder("FILE_REFERENCE")` |
| ngữ cảnh hệ thống của agent KHÔNG có `read` | mục đó **rỗng** | **y hệt** |
| `grep -c 'id: @deepseek-ai' lib/index.js` | — | **0** |

Lệnh tái lập phần đo được **ngay tại máy người viết** (không cần app):

```bash
cd <repo>
bun test tests/host/file-reference-local.test.ts      # 24 ca / 211 expect / 0 fail
cd packages/host/file-reference-local && bun run build.ts
grep -c 'id: @deepseek-ai' lib/index.js                # PHAI = 0
```

---

## 6. Khác biệt đã biết (có ý)

1. **KHÔNG ship subpath `./search`.** Bản gốc có `exports["./search"]` trỏ `lib/types/search.js`.
   Ta tách đúng vùng đó sang `src/search.ts` nhưng **không** phơi thành subpath: quét toàn repo
   (`packages/**`) + `apps/host/node_modules` ⇒ **0 ai** `import`/`require` subpath ấy (test `ca 0d`
   khẳng định lại mỗi lượt chạy). `WorkspaceFileSearch` vẫn được phơi ở **export gốc** như bản gốc.
2. **`src/types.ts` khai kiểu theo CẤU TRÚC** thay vì import `.d.ts` của từng seam. Lý do: row
   HOST-ONLY không được kéo thể hiện thứ hai của gói nào, và ambient `declare module` bị luật **000d**
   cấm khi module có thật trên đĩa. Riêng `Agent` thì mượn KIỂU thật của `dsh-agent` (chỉ `import type`).
3. **`config.excludedDirectories` chia sẻ hằng mô-đun khi dựng THẲNG bằng `new`** — **trung thành với
   bản gốc**, không "sửa" thành bản sao. Đường `ctx.plugin` (đường thật của app) áp schema nên mỗi
   thực thể nhận **mảng mới**; và chỗ TIÊU THỤ thì luôn sao (`WorkspaceFileSearch` dựng `Set` riêng).
   Cả hai vế được đo ở `ca 20` (C6 — danh tính), gồm cả phép đo bên bản gốc.

---

## 7. Phần CHƯA làm

- **Khai `gbh.row`** — thuộc Lead (test canh `ca 0c` đang khẳng định gói **KHÔNG** khai).
- **`lab:row` + mount + `check:app` + A/B trên app 5439** — thuộc lượt boot của Lead.
- **`./search` subpath** — cố ý bỏ (xem §6.1); nếu sau này có người tiêu thụ thì phải thêm đầu ra
  build thứ hai và một phép đối chứng byte với bản gốc.
