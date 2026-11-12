<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README gói @galaxy-blackhole/gbh-fs-sandbox — nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-fs-sandbox

Bản viết lại của Galaxy Blackhole cho row **`fs-sandbox`** của DSH (tier T4, nhóm `fs`): backend
**`ctx.fs` CƯỠNG CHẾ sandbox** — rào hai phép THAY ĐỔI (`writeText` · `editText`) theo chế độ của
TỪNG lời gọi, còn ĐỌC đi xuyên không rào. Row **MỘT MẶT**: bản gốc **không có** `lib/client.js`
(đã kiểm), nên thay row không làm mất nửa browser nào.

## 1. Nguồn đối chiếu (G4)

| # | Nguồn (CHỈ ĐỌC) | Đọc gì | Mức dẫn xuất |
|---|---|---|---|
| 1 | `apps/host/node_modules/@deepseek-ai/dsh-fs-sandbox/lib/index.js` (**169 dòng**, khớp `bun run row:cost`) | toàn bộ thân bundle: vùng `containment` (`MISSING_CODES` · `isMissing` · `comparablePath` · `isLexicallyUnder` · `statIfPresent` · `sameIdentity` · `isPathUnder`) và lớp `SandboxedFileSystem` (`static inject` · `defaultMode` · `sandboxMode` · `writeText` · `editText` · `checkedTarget`) | **viết lại theo hành vi** (không chép code); hai CHUỖI từ chối giữ **nguyên văn** vì chúng là hành vi nhìn thấy được (`cannot write "<path>": file access denied under read-only mode` · `… under workspace-write mode`) |
| 2 | `…/lib/types/index.d.ts` (94 dòng) + `…/lib/types/containment.d.ts` (20 dòng) | hợp đồng công khai: `Config` (= `LocalConfig`), `SandboxedFileSystem` + `default`, chữ ký hai phép thay đổi và `checkedTarget` | tham chiếu |
| 3 | `…/package.json` | `dsh.client` **KHÔNG có** ⇒ thuần host; `exports`; 5 peer; `locale/` | tham chiếu |
| 4 | `…/locale/{en,zh}.json` | `meta.title` cho màn Plugins | **chép byte-for-byte** — sha256: `0fddb456…` (en) · `2cbe05ca…` (zh) |
| 5 | `.parity/dumps/*/ours.yml` (**81 dump** có cặp `- id: fs-sandbox` + `name: '@deepseek-ai/dsh-fs-sandbox'`; dump mới nhất `2026-10-17T23-54-01` dòng 452–453) | row ↔ gói gốc, trạng thái BẬT, và **`config:` — KHÔNG có khoá `config`** (row chỉ có `id` + `name`) | tham chiếu cho Lead khi khai `gbh.row` |

Hai phần KHÔNG chép nguyên văn mà viết lại theo hành vi, có ghi lý do:
1. **`isMissing`** — bản gốc đọc `error.code` của một giá trị chưa kiểu; ta kiểm `typeof code === "string"`
   trước khi tra `Set`. Hành vi như nhau với mọi lỗi `stat` thật (mã lỗi luôn là chuỗi).
2. **Đường tra seam** — `ctx.sandboxPolicy` đọc qua một phép cast về kiểu `SandboxPolicyService` của gói
   peer (cùng lối `packages/host/bash-sandbox`); nhờ vậy gói KHÔNG có thể hiện thứ hai của seam.

## 2. Peer — vì sao, và thuộc bậc nào của §3b

| Peer | Bậc §3b | Vì sao cần (đo được) |
|---|---|---|
| `@deepseek-ai/cordis` | **bậc 1** | lớp `Service`/`Context`: backend đăng ký `ctx.fs` nên phải là **cùng một thể hiện** kernel cấp |
| `@deepseek-ai/dsh-fs` | bậc 2 | `FsError` — lỗi từ chối phải **CÙNG LỚP** để tầng tool bắt `code === "FS_SANDBOX_DENIED"` |
| `@deepseek-ai/dsh-fs-local` | **ngoài bảng §3b — lý do 2b** | gói **KẾ THỪA** `LocalFileSystem`; phải là **CÙNG một lớp**, không phải bản sao. Bằng chứng: `Object.getPrototypeOf(ta) === Object.getPrototypeOf(gốc)` ⇒ **TRUE** (ca test ở §5) |
| `@deepseek-ai/dsh-sandbox` | bậc 2 (nhóm executor, 2b) | `writableRoots(policy)` — tập ghi được **dùng chung** với hồ sơ Seatbelt; tự chế tập này là tạo dị biệt "tool ghi được /tmp mà bash không" |
| `@deepseek-ai/dsh-sandbox-policy` | bậc 2 | kiểu `SandboxPolicyService` của seam `sandboxPolicy` mà `static inject` đòi; bản gốc cũng khai peer này |

Cả năm đều là **`peerDependencies` + `devDependencies`** (không bao giờ `dependencies`) **và** có trong
`gbh.peers`. Kiểm bằng phép **so PHẦN TỬ** `gbh.peers ⊆ peerDependencies` (M6-MOUNT-PLAN §1d) — có
**đối chứng âm** ở §5.
`node_modules` của gói là **symlink tới bản thật trong `apps/host/node_modules`** (luật 000d: không shim
ambient; symlink giữ ĐÚNG một thể hiện cho mỗi peer).

## 3. Bề mặt phải khớp (đo trên ARTIFACT)

| Hạng mục | Giá trị |
|---|---|
| Export | `SandboxedFileSystem` · `default` (= `SandboxedFileSystem`) — **đúng 2 tên như gốc** |
| Kiểu export | `Config` (= `Config` của `dsh-fs-local`) — **type-only**, không vào artifact |
| Service | tên `fs` (thừa hưởng `FileSystem`); `static inject = ["sandboxPolicy"]` |
| Trường | `defaultMode` (private) lấy từ `ctx.sandboxPolicy.defaultMode`; getter `sandboxMode` trả chính nó |
| Phương thức | `writeText(target, content, expected?, signal?, sandboxPolicy?)` · `editText(target, edit, expected?, signal?, sandboxPolicy?)` · `checkedTarget(target, sandboxPolicy?)` |
| Chế độ | `read-only` ⇒ **từ chối MỌI** thay đổi; `workspace-write` ⇒ chỉ cho đích **chuẩn tắc hoá lại ngay** nằm dưới `writableRoots(policy)`; `danger-full-access` ⇒ trả **ĐÚNG** đích bên gọi, không rào |
| Lỗi | `FsError` mã `FS_SANDBOX_DENIED`, thông điệp **nguyên văn** hai chế độ |
| Kế thừa | đọc/`stat`/liệt kê/`resolve`/vòng khoá per-targetKey là của `LocalFileSystem`, **không viết lại** |
| Id module | **0** cả hai chiều (`id: @deepseek-ai` = 0 · `id: @galaxy-blackhole` = 0) — host-only |

## 4. TRƯỚC/SAU và lệnh tái lập

| Phép đo | TRƯỚC (bản gốc) | SAU (bản của ta) |
|---|---|---|
| Tập export trong artifact | `SandboxedFileSystem` + `default` | **y hệt**, `default === SandboxedFileSystem` |
| `inject` tĩnh | `["sandboxPolicy"]` | trùng |
| Tên trên prototype / static | `constructor` · `sandboxMode` · `writeText` · `editText` · `checkedTarget` | **trùng tập** |
| Lớp cha | `LocalFileSystem` của kernel | **CÙNG một lớp** (`Object.getPrototypeOf` bằng nhau) |
| `checkedTarget` × 4 chế độ (đích trong gốc / ngoài gốc) | oracle | **trùng từng ký tự** thông điệp lỗi, trùng `targetKey` khi đạt |
| `writeText` (workspace-write, trong gốc) | oracle | trùng `operation`/`before`/`after`; tệp trên đĩa = `hello` |
| `writeText` (read-only · ngoài gốc) | oracle | **cùng lỗi** `FS_SANDBOX_DENIED`; tệp **KHÔNG** được tạo |
| `editText` (sửa được · read-only · tệp vắng mặt) | oracle | trùng nội dung; read-only chặn; vắng mặt ⇒ cùng lỗi `FsError` |
| Chính sách dự phòng (`ctx.sandboxPolicy.resolve()`) | oracle | trùng, và **có gọi** `resolve()` thật |
| `danger-full-access` | trả đích bên gọi | **cùng danh tính** (`toBe`), không chuẩn tắc hoá |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |

```bash
cd packages/host/fs-sandbox && ~/.bun/bin/bun run build.ts    # ⇒ lib/index.js (ESM, 98 dòng)
grep -c "id: @deepseek-ai" lib/index.js                       # ⇒ 0
cd ../../.. && ~/.bun/bin/bun test tests/host/fs-sandbox.test.ts   # ⇒ 13 pass / 0 fail / 98 expect
~/.bun/bin/bun run check:rows                                 # 87 package co gbh.row — TAT CA dat (0 chan)
~/.bun/bin/bun run gate --no-tests                            # 7/7 XANH
```

**Vì sao bảng TRƯỚC/SAU ở đây đo trên ARTIFACT**: `gbh.row` do **LEAD** khai (commit `b34e23c`) và row
vào lượt boot `eeaec37` — phép đo trên cổng 5439 ((5) `did not activate` · (8) `#root`/console) thuộc
**lượt boot của Lead**, gói không tự đo. Mọi phép đo ở trên đều trên **artifact** hoặc **đối chứng trực
tiếp với chính bundle gốc** (chạy CẢ HAI bản trên cùng dữ kiện).

## 5. Test

`tests/host/fs-sandbox.test.ts` — **13 ca / 98 expect**, mọi phép so hành vi chạy **CẢ HAI bản**:

1. **ARTIFACT**: build bằng chính `build.ts`, nạp artifact, so tập export với bundle gốc (`0 thiếu / 0 thừa`),
   so `default`, so **`inject`**, so **tên prototype/static**, và `grep` hai chiều `id: @…` ⇒ **0/0**.
2. **Kế thừa (2b)**: `Object.getPrototypeOf(ta) === Object.getPrototypeOf(gốc) === LocalFileSystem` của kernel
   ⇒ **peer `dsh-fs-local` trỏ về ĐÚNG thể hiện**, không phải bản sao.
3. **Rào theo từng lời gọi**: `checkedTarget` × {read-only, workspace-write, danger-full-access} × {trong gốc,
   ngoài gốc}, cộng **chính sách dự phòng** từ `ctx.sandboxPolicy.resolve()` — so từng ký tự kết cục.
4. **Đường thay đổi THẬT** (qua cơ chế kế thừa, có đĩa thật): `writeText`/`editText` trong gốc ghi được;
   `read-only` và **ngoài gốc** bị chặn **trước khi chạm đĩa** (khẳng định tệp KHÔNG tồn tại); tệp vắng mặt ⇒
   cùng lỗi như gốc, không treo.
5. **`gbh.peers ⊆ peerDependencies`** — so **PHẦN TỬ**, cộng **HAI đối chứng âm**: xoá một peer ⇒ phép kiểm
   báo ĐÚNG tên đó; hai danh sách **cùng số lượng nhưng lệch phần tử** ⇒ vẫn ĐỎ (chống verdict rỗng).
6. **000e**: `locale/en.json` + `zh.json` **byte-for-byte** với gói gốc, và manifest export `./locale/*.json`.
7. **C6 (danh tính)**: mỗi lượt rào sinh đích **MỚI** — `toEqual` nhưng `not.toBe`, sửa bản này không lan
   sang bản kia; hai thực thể **KHÔNG** chia sẻ vật thể `config` (đối chứng dương: cùng thực thể ⇒ đúng một
   thể hiện).

## 6. CHƯA làm (điều kiện chặn mount, không phải ghi chú cuối báo cáo)

1. **`gbh.row` do LEAD khai, KHÔNG phải gói tự khai** — commit `b34e23c`: `id: fs-sandbox` + `tests`,
   **không có `config`** vì oracle KHÔNG có `config:` (81 dump `ours.yml` chỉ có `id` + `name`). Phiên viết
   gói này **không tự khai** — đúng luật "KHÔNG tự khai `gbh.row`".
2. **Gói KHÔNG tự đo app 5439**: row đã vào lượt boot `eeaec37` của Lead; các phép `(5)` `did not
   activate` · `(8)` `#root`/console · `check:app` 11 chỉ số · parity 0/0/0 là **việc của lượt boot đó**.
3. **CHƯA chạy `lab:row`** (công cụ cần gói đã khai `gbh.row`) — chờ lượt boot của Lead.
4. Row này là **row NỀN**: tầng tool (`dsh-tool-fs`) đọc `fs.sandboxMode` để quảng bá nâng quyền và bắt
   `FS_SANDBOX_DENIED`; trước khi mount **BẮT BUỘC** đo lại: `ctx.fs` vẫn là service tên `fs`, `sandboxMode`
   vẫn là chế độ mặc định của deployment, mã lỗi + thông điệp từ chối y hệt (đã có test đối chứng).

## 7. Năm câu hỏi bắt buộc (mục 0 của công thức)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có đang BẬT không? | **CÓ** — 81 dump `ours.yml` liệt kê `- id: fs-sandbox` + `name: '@deepseek-ai/dsh-fs-sandbox'` **không** kèm `disabled`; dump mới nhất `2026-10-17T23-54-01` dòng 452–453 (KHÔNG chạy `bh host --dump-config` vì lệnh đó ghi lại `app.patch.yml` của app đang chạy) |
| 2 | Thuần host hay có mount surface client? | **THUẦN HOST** — `lib/client.js` **KHÔNG tồn tại** (đã `ls`), `dsh.client` vắng; bundle chỉ export lớp + `default`, không `slots.register`/`loader.create` |
| 3 | Cần seam nào? | `extends LocalFileSystem` (`dsh-fs-local`) + `Service` (cordis) + seam `ctx.sandboxPolicy` + `writableRoots` (`dsh-sandbox`) + `FsError` (`dsh-fs`) + `node:fs/promises` · `node:path`. **Đều thuộc bảng §3b hoặc lý do 2b** |
| 4 | Hành vi đo được là gì? | `ctx.fs.sandboxMode` = `sandboxPolicy.defaultMode`; `writeText`/`editText` bị chặn theo chế độ (`FS_SANDBOX_DENIED` + thông điệp nguyên văn) và **đi xuyên** khi `danger-full-access`; đọc/liệt kê/ghi trong gốc không đổi so với `fs-local` |
| 5 | Gói gốc có `dsh.client` không? | **KHÔNG** — `package.json` gốc không có khoá `dsh`; `lib/client.js` không tồn tại ⇒ **MỘT MẶT**, thay được ngay, không cần nửa browser |
