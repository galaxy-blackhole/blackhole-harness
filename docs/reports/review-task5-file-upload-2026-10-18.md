<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Review độc lập row file-upload (task-5) — đo trên artifact, KHÔNG đọc src để kết luận
-->

# Review độc lập — row `file-upload` (task-5)

- reviewer: **tm-reviewer** (KHÁC tác giả: dev/owner = tm-host-core)
- ngày đo: 18/10/2026 · gói: `@galaxy-blackhole/gbh-client-file-upload` ← `@deepseek-ai/dsh-client-file-upload`
- artifact build tạm: `/tmp/rev/fu/{index.js,client.js,client.bundle.js}`
- stock đối chiếu: `apps/host/node_modules/@deepseek-ai/dsh-client-file-upload/lib/{index.js,client.js,typert.host.js}`

## A. Khuôn bundle

| phép kiểm | đo được | kết luận |
|---|---|---|
| client bundle — id gốc | **0** | ĐẠT |
| client bundle — id ta | **1**, đăng ký qua hằng `PACKAGE_NAME = "@galaxy-blackhole/gbh-client-file-upload"` (artifact dòng 58/677) | ĐẠT |
| `build.ts` đọc `process.argv[2]` | **1** chỗ | ĐẠT |
| cú pháp ESM trong bundle client | **0** dòng (nạp bằng thẻ script, CJS bọc `__ModuleLoader__.load`) | ĐẠT |
| host export | `export { file_uploads_default as default, FileUploads }` = stock `export { FileUploads, FileUploads as default }` | ĐẠT |

## B. Tập SLOT + export nửa client

| nguồn | slot | client export |
|---|---|---|
| stock `client.js` | **0** (gói dịch vụ, không slot) | `apply` · `inject` |
| ta `client.js` | **0** | `apply` · `inject` (+10 tên nội bộ: workerTransport, parseFileUploadResult, FileUploadRuntime, …) |

- slot: thiếu **0**, thừa **0** ⇒ ĐẠT 0=0.
- export bắt buộc: stock ⊆ ta (2/2) ⇒ ĐẠT. Tên thêm là nội bộ, không phá hợp đồng.
- host prototype: 12 tên trùng bản gốc (chứng minh bằng test của gói `file-upload-host.test.ts:261`, tôi chạy lại pass).

## C. Cổng chống cài hai lần

- **n/a có lý do**: đây là gói dịch vụ, client bundle chỉ nạp **một entry** (`dsh.client.immediately: true`), `apply = ctx.plugin(FileUploadRuntime)` theo cordis. Bản gốc stock **cũng không có cổng idem** ⇒ port 1:1 không thêm hành vi. Không đăng ký slot nên không có lớp lỗi "hai ctx ⇒ đăng ký hai lần".

## C2. Hợp đồng Remote (keyed/store không áp dụng)

| điều kiện | bằng chứng |
|---|---|
| service namespace | host `super(ctx, "fileUploads")` — artifact `index.js:229` |
| remote seam | `Remote`, `TypertRemoteService` từ `@deepseek-ai/dsh-typert-protocol` |
| route tải byte thô | test `file-upload-host.test.ts:279` khẳng định path/methods/requestBody **trùng bản gốc** (chạy pass) |
| staged theo Session | `uploadStream`/resolve/bindPrompt/retirePrompt/commit — 12 prototype trùng stock |

## C3/C4/C5. Đo trên trang thật / lab

| phép đo | đo được | kết luận |
|---|---|---|
| app `(8) #root` | 67.167 ký tự · **0 lỗi console** | ĐẠT — gói không có slot UI nên phép đo UI là "không làm hỏng app" |
| lab (artifact của tm-evidence, không phải tác giả) | `.parity/lab-evidence/file-upload.json`: **DAT** · #root **42.190** · console 0 · page 0 · did-not-activate 0 · overlay **0** | ĐẠT |
| overlay C5 | 0 overlay | ĐẠT |

## D. Bằng chứng bắt buộc

| hạng mục | đo được |
|---|---|
| test | tôi tự chạy 4 tệp (`file-upload.test.ts` · `file-upload-host.test.ts` · `file-upload-browser.test.ts` · `file-upload-staged.test.ts`) ⇒ **55 pass · 0 fail · 215 expect** |
| check:rows | **0 chặn** cho file-upload |
| --dump-config (sau boot 21:00) | `- id: file-upload / stock / disabled: true` + `- id: file-upload-ours / name @galaxy-blackhole/gbh-client-file-upload / aliases: @deepseek-ai/dsh-client-file-upload` ⇒ **MOUNT** |
| gate --no-tests | ĐỎ 1/7 do 5 vi phạm **không thuộc gói** (`pwsh-sandbox.test.ts:915` cũ + `no-dsh-assets.ts` của tm-assets đang viết) |

## Khác biệt bề mặt gói cần GHI NỢ (không phải lỗi mount)

| khác biệt | bằng chứng / tác động |
|---|---|
| stock có subpath `./typert` + `./remote` (file generated `typert.host.js`, `typert.remote-client.js`) | ta KHÔNG có 2 subpath này. Đã grep toàn `apps/host/node_modules/@deepseek-ai/**/lib/*.js`: **0 consumer** ⇒ hiện không ảnh hưởng; nếu sau này có gói require `@deepseek-ai/dsh-client-file-upload/typert` thì phải bổ sung |
| client export thêm 10 tên nội bộ | stock ⊆ ta, không phá hợp đồng; nếu muốn parity tuyệt đối thì thu hẹp export |
| `curl POST /api/session/uploadFileBinary` trả 405 | **đúng kỳ vọng**: route đăng ký qua `ctx.connection.fetch.register` (registry nội bộ), không phải route HTTP công khai; bản gốc cũng vậy |

## F. Ký

```
row: file-upload
reviewer: tm-reviewer (KHAC tac gia)
A khuon bundle : DAT  id goc=0 · id ta=1 · argv[2]=1 · ESM=0 · host export = stock
B tap slot     : DAT  stock=0 ta=0 thieu=0 thua=0 · client export stock⊆ta 2/2
C cong idem    : n/a (goi dich vu 1 entry; stock cung khong co cong) — co ly do
C2 keyed/store : n/a keyed · Remote contract fileUploads: route + 12 prototype trung stock
C3 #root       : DAT  67.167 · 0 loi console
C4 lab         : DAT  .parity/lab-evidence/file-upload.json DAT (#root 42.190 · 0/0/0 · overlay 0)
C5 overlay     : DAT  0 overlay
D bang chung   : DAT  test 55 pass · check:rows 0 chan · dump MOUNT
ket luan       : KY  (no ky thuat: 2 subpath typert/remote khong co — 0 consumer hien tai)
```
