<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bàn giao row host `pwsh-sandbox` (T4 · M6): nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-pwsh-sandbox — row `pwsh-sandbox` (T4 · M6)

Trạng thái: **đã viết lại xong + test xanh** · **CHƯA khai `gbh.row`** (chưa mount ⇒ không thể làm hỏng app của ai).

## 0. Năm câu hỏi bắt buộc (recipe §0)

| # | Câu hỏi | Trả lời (đo được) |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **TẮT trên macOS/Linux, BẬT trên Windows.** Dump đang chạy (`.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng **203–205**): `- id: pwsh-sandbox` · `name: '@deepseek-ai/dsh-pwsh-sandbox'` · `disabled: !!js process.platform !== 'win32'` — **KHÔNG có `config:`, KHÔNG có `inject:`**. Đây là nửa còn lại của cặp platform: `bash-sandbox` `disabled: !!js process.platform === 'win32'`. |
| 2 | Thuần host hay có mount surface client? | **Thuần host.** `package.json` gốc **không có** khoá `dsh` (câu 5) ⇒ một mặt ⇒ thay được bằng cặp disable+insert, không cần nửa browser. Export đúng **một lớp service** (`ctx.shell`), không slot, không route. |
| 3 | Cần **seam** nào? | `subprocess` · `sandbox` · `sandboxPolicy` (ba mục `static inject`) + lớp cha `PwshLocalExecutor` của `@deepseek-ai/dsh-pwsh-local` + `SandboxUnavailableError` của `@deepseek-ai/dsh-sandbox`. Chỉ `node:` builtins ngoài các peer ấy. **Lệch bảng §3b** — xem §3 dưới. |
| 4 | Hành vi **đo được** là gì? | `ctx.shell` (một instance/tiến trình). Mỗi lệnh: (a) `danger-full-access` ⇒ spawn thẳng argv pwsh của lớp cha; (b) chế độ bị cưỡng chế ⇒ `ctx.sandbox.confine(this.argv(spec), policy, signal)` rồi spawn **argv của nhà cung cấp**; (c) `result().sandbox = { mode, denied, enforcement }`; (d) runner hỏng ⇒ `result()` ném `SANDBOX_UNAVAILABLE`; (e) tiến trình nền ⇒ `proc.sandbox` (kèm `runnerFailed` khi có). TRƯỚC/SAU ở §4. |
| 5 | Gói gốc có `dsh.client` không? | **KHÔNG**: `package.json` gốc **không có khoá `dsh`** (`python3 -c "…json.load(…).get('dsh')…"` ⇒ `False`) **VÀ** `lib/client.js` **KHÔNG tồn tại** (`lib/` chỉ có `index.js` + `types/`) ⇒ không mất nửa client khi thay row. |

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Đường dẫn (CHỈ ĐỌC) | Dòng | Mức dẫn xuất |
|---|---|---|---|
| Code thật của row | `apps/host/node_modules/@deepseek-ai/dsh-pwsh-sandbox/lib/index.js` | **252** | **viết lại theo hành vi** (không chép code): 1 lớp `SandboxPwshExecutor` (6 thành viên prototype) + vùng helpers nội tuyến |
| Kiểu công khai | `…/dsh-pwsh-sandbox/lib/types/index.d.ts` + `lib/types/helpers.d.ts` | 79 + 56 | đọc để giữ **đúng bề mặt** (tên lớp, `Config`, chữ ký, `private`/`protected`) |
| Manifest gốc | `…/dsh-pwsh-sandbox/package.json` | 47 | nguồn của danh sách peer + `exports` (có `./locale/*.json`) |
| Từ điển | `…/dsh-pwsh-sandbox/locale/{en,zh}.json` | 5 + 6 | **chép byte-for-byte** (LUẬT 000e) — `shasum` khớp: en `a4112462b48e…` · zh `61a53b76ead4…` |
| Seam nền | `dsh-pwsh-local/lib/index.js` (429) · `dsh-sandbox/lib/index.js` (289) · `dsh-shell/lib/types/*.d.ts` · `dsh-sandbox-policy/lib/index.js` | — | chỉ đọc để biết hợp đồng `argv/executeArgv/onProcessDone`, `confine`, `SandboxPolicyService` |

Gói của ta: `src/index.ts` (242 dòng) · `src/helpers.ts` (111) · `build.ts` (32) · `tests/host/pwsh-sandbox.test.ts` (909).

## 2. Bản đồ hành vi đã viết lại (đối chiếu từng phần)

| Thành viên của bản gốc | Bản của ta | Ghi chú đối chiếu |
|---|---|---|
| `static inject = ["subprocess","sandbox","sandboxPolicy"]` | y hệt | test khẳng định bằng cả hai artifact |
| `mode = ctx.sandboxPolicy.defaultMode` trong constructor | y hệt | **ảnh chụp MỘT LẦN**: đổi `defaultMode` sau đó KHÔNG đổi thực thể đã dựng (đo cả hai bên) |
| `resolve()` → `{...super.resolve(request), sandboxPolicy: request.sandboxPolicy ?? ctx.sandboxPolicy.resolve()}` | y hệt | **A/B**: 4 dạng request ⇒ spec **y hệt** bản gốc |
| `execute()`: nhánh `danger-full-access` chạy thẳng | y hệt | đo được: **0 lời gọi `confine`**, argv spawn = argv pwsh của lớp cha (`pwsh -NoLogo -NoProfile -NonInteractive -Command <preamble+cmd>`) |
| `execute()`: nhánh cưỡng chế qua `this.executeArgv(spec, prepare, onStarted)` | y hệt | đo được: argv tới `confine` + argv được spawn + `cwd`/env của lớp cha |
| `processFacts: Map<tiến trình, sự thật>` — xoá khi kết thúc | y hệt | test hai lời gọi **chồng lấn** với hai phương ngữ ⇒ mỗi bên tự phân loại (A/B cả hai bên) |
| `decorateResult(ex, map, mapError)`: ghi đè `ex.result` TẠI CHỖ, memoize một lần | y hệt | tay nắm giữ nguyên danh tính (Map + `onProcessDone` khoá theo thực thể) |
| `onProcessDone`: đóng dấu `proc.sandbox`, `denied` chỉ khi **không** runner hỏng | y hệt | `runnerFailed` chỉ xuất hiện khi đúng (ca ENOENT + ca luật stderr) |
| `confine()` = `ctx.sandbox.confine(this.argv(spec), policy, signal)` | y hệt | **KHÁC bản bash**: pwsh nhận chuỗi lệnh như MỘT phần tử của `-Command`, không có `-c` |
| `helpers.js` nội tuyến: `isRunnerSpawnFailure` · `classifyDenial` · `classifyRunnerFailure` · `matchesSignature` | `src/helpers.ts` | **KHÁC BIỆT CÓ Ý** (xem dưới) |

### Khác biệt CÓ Ý duy nhất: bốn hàm chẩn đoán viết TẠI CHỖ, không nhập từ seam

Bản bash nhập `classifyRunnerFailure`/`isRunnerSpawnFailure`/`matchesSignature` từ `@deepseek-ai/dsh-sandbox`;
**bản pwsh gốc thật sự MANG THEO bản sao riêng** của chúng (vùng `//#region lib/types/helpers.js` ở đầu
`lib/index.js` gốc, không có `import` nào từ seam). Bản viết lại giữ đúng như vậy ⇒ hành vi không phụ
thuộc phiên bản seam bên ngoài. Đo được: công thức từng dòng **trùng** bản sao trong `dsh-sandbox/lib/index.js`
(vùng `//#region lib/types/diagnostics.js`) — nên **ma trận 7 hình dạng** ở §4 cho **cùng sự thật** ở cả hai bên.

`locale/{en,zh}.json` + `exports["./locale/*.json"]` giữ nguyên (LUẬT 000e): runtime dùng `meta.title` làm
tiêu đề hàng ở màn Plugins — thiếu file thì tiêu đề rơi về tên package của ta và **khác oracle**.

## 3. Peer — vì sao, và vì sao LỆCH bảng §3b

Row này **không thể** trung thành nếu thiếu lớp cha: bản gốc `extends PwshLocalExecutor` của
`@deepseek-ai/dsh-pwsh-local`, và toàn bộ cơ chế tiến trình (deadline, spill, `argv()`, biên dịch
`onProcessDone`) là của lớp ấy. Viết lại nó là **chép 429 dòng của một seam khác** và tạo ra một
`ctx.shell` thứ hai **không cùng lớp** với thứ kernel cấp.

Recipe §2b (đã chốt 18/10/2026) cấp phép đúng nhóm peer này cho `pwsh-sandbox`:
`dsh-pwsh-local` (kế thừa) · `dsh-sandbox` (`ctx.sandbox.confine`) · `dsh-sandbox-policy` (`ctx.sandboxPolicy`) ·
`dsh-shell` (seam `ctx.shell`). Vì vậy gói này khai peer:

    "gbh": { "peers": ["@deepseek-ai/dsh-pwsh-local", "@deepseek-ai/dsh-sandbox",
                        "@deepseek-ai/dsh-sandbox-policy", "@deepseek-ai/dsh-shell"] }

(cộng `@deepseek-ai/cordis` do `mount.ts` tự thêm cho MỌI gói). Cả bốn **đều là peer, không phải dependency**,
để kernel cấp **đúng một instance**; `gbh.peers ⊆ peerDependencies` được kiểm **theo PHẦN TỬ** kèm
**ĐỐI CHỨNG ÂM** (xoá một tên ⇒ test đỏ đúng tên đó; xoá sạch ⇒ đỏ đủ danh sách; thừa tên ⇒ vẫn đạt).

### Cài peer trên bản sao mới (node_modules bị `.gitignore`)

    cd packages/host/pwsh-sandbox && mkdir -p node_modules/@deepseek-ai
    for p in cordis dsh-pwsh-local dsh-sandbox dsh-sandbox-policy dsh-shell; do
      ln -sfn ../../../../../apps/host/node_modules/@deepseek-ai/$p node_modules/@deepseek-ai/$p
    done

Trỏ về **chính bản kernel đang chạy** ⇒ test A/B so được
`Object.getPrototypeOf(OurClass) === Object.getPrototypeOf(StockClass)`, tức **một** `PwshLocalExecutor`.

## 4. Bảng TRƯỚC/SAU (đo bằng chính test, tái lập: `bun test tests/host/pwsh-sandbox.test.ts`)

| Phép đo | TRƯỚC (bản gốc) | SAU (bản của ta) |
|---|---|---|
| Tập export của artifact | `["SandboxPwshExecutor","default"]` | **y hệt** (`Object.keys` của module đã nạp = 2 tên) |
| `static inject` | `["subprocess","sandbox","sandboxPolicy"]` | **y hệt** |
| Prototype (6) + static own (5) + **lớp cha** | — | **y hệt** (cùng một `PwshLocalExecutor`) |
| `sandboxMode` + `resolve()` trên 4 dạng request | 4 spec | **4 spec y hệt** (kể cả nhánh "policy của bên gọi thắng") · ảnh chụp chế độ lúc dựng **giống nhau** |
| `danger-full-access` | 0 lời gọi `confine` · spawn argv pwsh · `{mode, denied:false}` | **y hệt** (kể cả spec spawn: `cwd`, `NO_COLOR=1`, `PAGER=cat`, `GIT_PAGER=cat`) |
| Chế độ cưỡng chế | argv tới `confine` = argv pwsh · spawn argv nhà cung cấp · `{mode, denied:false, enforcement:"full"}` | **y hệt** |
| Bị từ chối (exit≠0 + khớp phương ngữ) | `denied: true` | **y hệt**; exit 0 + cùng stderr ⇒ `denied: false` cả hai bên |
| Ma trận 7 hình dạng phân loại (cổng mã thoát · dòng thông tin · CRLF · exit 0 · chữ ký rỗng · chết vì tín hiệu · từ chối) | 7 sự thật | **7 sự thật y hệt** (và cùng thông điệp khi ném) |
| Runner hỏng (luật stderr) | ném `SandboxUnavailableError` · `code=SANDBOX_UNAVAILABLE` | **y hệt** (cùng mã + cùng thông điệp từng chữ) |
| Nhà cung cấp từ chối | lỗi đi thẳng ra | **y hệt**, và `spawn` = **0** (FAIL-CLOSED: không bao giờ chạy lệnh không bị cưỡng chế) |
| Spawn hỏng vì CHÍNH runner (ENOENT + đúng `argv[0]`) | `SANDBOX_UNAVAILABLE` + `runnerFailed: true` trên tiến trình | **y hệt** |
| Spawn ENOENT KHÔNG chỉ đích danh runner | lỗi đi **nguyên vẹn** (không bọc) | **y hệt** (cùng tên/mã/thông điệp, không `runnerFailed`) |
| Huỷ trong lúc chờ | ném lại **lý do huỷ** | **y hệt** (không bọc thành lỗi runner) |
| Sổ sự thật theo tiến trình | mỗi tiến trình phân loại bằng sự thật CỦA MÌNH | **y hệt** (2 lời gọi chồng lấn, 2 phương ngữ, A/B cả hai bên) |
| **C6 danh tính** | — | 2 lần `resolve()` ⇒ **2 spec + 2 chính sách** (`not.toBe`); chính sách bên gọi đi qua **nguyên danh tính**; chính sách đưa cho `confine` là **vật thể mới** (sửa nó KHÔNG lan sang spec); 2 thực thể executor có chế độ **riêng** |

**21 test / 152 expect · 0 fail.** Test **đo trên ARTIFACT** (`packages/host/pwsh-sandbox/lib/index.js` +
một bản build TƯƠI vào thư mục tạm cho phép đo bề mặt) và **đối chứng với chính bundle gốc** — không đọc
`src/` để kết luận. Ca phụ thuộc thời điểm settle dùng `waitFor` **có trần 2.000 ms** (quá trần ⇒ đỏ, không treo).

## 5. Artifact & cổng

| Hạng mục | Kết quả |
|---|---|
| `bun run build.ts` | `lib/index.js` **165 dòng** · ESM · `packages: external` |
| `grep -c 'id: @deepseek-ai' lib/index.js` | **0** (bundle này **không** đăng ký id module nào: gói HOST, không có `__ModuleLoader__`) |
| `build.ts` nhận `process.argv[2]` | ✅ `buildPackage(outDir?)` + `outDir ?? join(import.meta.dir, "lib")` + `if (import.meta.main)` |
| `locale/{en,zh}.json` | ✅ chép **byte-for-byte** khỏi gói gốc (shasum khớp) + `exports["./locale/*.json"]` |
| `bun test tests/host/pwsh-sandbox.test.ts` | **21 pass · 0 fail · 152 expect** |
| `bun run check:rows` | gói này **không có dòng nào** (chưa khai `gbh.row`) · **0 chặn** toàn repo (105 package) |
| `bun run gate --no-tests` | **7/7 XANH** (header · file-length · jsdoc · dep-guard · parity-matrix · typecheck · hygiene) |

## 6. CHƯA làm (đọc trước khi mount)

1. ~~`gbh.row` CHƯA khai~~ — ĐÃ khai. Hợp đồng mount ĐÃ SỬA 18/10/2026 (task-15): stock **`disabled: true`**,
   row chèn **`insertDisabled: {js: "process.platform !== 'win32'"}`** — `config`/`inject` vẫn rỗng; xem §8.
2. ~~Chưa chạy lab cách ly~~ — ĐÃ có bằng chứng boot cách ly: log host **0 dòng `did not activate`**,
   0 dòng lỗi cho `pwsh-sandbox-ours`; xem §8. (Ca PowerShell THẬT trên Windows vẫn chưa đo — mục 3.)
3. **Chưa đo trên Windows** — nơi row này THẬT SỰ bật (`disabled: process.platform !== 'win32'`): chuỗi runner
   ACL restricted-token và nhánh `isRunnerSpawnFailure` của runner Windows chưa có ca test ở đây; mọi phép đo
   của gói chạy trên macOS/Linux với seam `sandbox` giả.
4. **Chưa mount ⇒ "đã thay N row" không tăng.** Gói nằm ở trạng thái an toàn (không khai `gbh.row`).

## 7. Nhật ký

| Thời điểm | Việc | Kết quả |
|---|---|---|
| 18/10/2026 | Nhận row `pwsh-sandbox` (M6) · bước 0 ba phép | cặp `- id: pwsh-sandbox` + `name` ở `ours.yml` dòng 203–205 · **không** `dsh.client`, **không** `lib/client.js` ⇒ MỘT MẶT · `config`/`inject` **rỗng** |
| 18/10/2026 | Đọc trọn bản gốc (bundle + 2 `.d.ts` + 4 gói seam) | bản đồ 10 thành viên ở §2; câu 5 = **không** `dsh.client` |
| 18/10/2026 | Viết lại + test A/B trên artifact | **21 test / 152 expect · 0 fail**; `lib/index.js` 165 dòng; `id: "@deepseek-ai"` = **0** |
## 8. Sửa lỗi MOUNT 18/10/2026 (task-15) — `ctx.shell` đăng ký HAI LẦN

### Triệu chứng (log host THẬT của app, boot 21:56 trên macOS)

```text
dsh: warning: 3 entries did not activate
pwsh-sandbox-ours (@galaxy-blackhole/gbh-pwsh-sandbox): Error: service "shell" has been registered at <SandboxBashExecutor>
```

`SandboxPwshExecutor extends PwshLocalExecutor` → base `ShellExecutor` đăng ký **`ctx.shell`** (`dsh-shell/lib/index.js:85`),
ĐÚNG tên dịch vụ mà `SandboxBashExecutor` (gói `gbh-bash-sandbox` đang bật) đã đăng ký. Metadata cũ khai điều kiện
nền tảng cho row **STOCK** rồi chèn bản ta **KHÔNG disabled** ⇒ trên macOS (và cả Windows nếu bash cùng bật) bản ta
luôn chết vì trùng dịch vụ. **Không phải lỗi `disabled` nền tảng đơn thuần — là TÊN SERVICE + kiểu plugin.**

### Cách sửa (mirror đúng điều kiện nền tảng của stock, theo TẦNG)

| Row | Trước | Sau |
|---|---|---|
| `pwsh-sandbox` (stock) | `disabled: !!js process.platform !== 'win32'` | **`disabled: true`** |
| `pwsh-sandbox-ours` (chèn) | *không có dòng `disabled`* | **`disabled: !!js process.platform !== 'win32'`** (`insertDisabled`) |

Net plugin set y oracle: macOS/Linux ⇒ không executor pwsh nào (bash giữ `ctx.shell`); Windows ⇒ đúng MỘT
`ctx.shell` là bản của ta. (Trên Windows, nếu gói `gbh-bash-sandbox` cũng bật thì xung đột `ctx.shell` là ràng buộc
có sẵn của thiết kế stock — oracle giữ bash TẮT; việc gate bash theo nền tảng thuộc gói đó, không thuộc gói này.)

### Bằng chứng TRƯỚC → SAU (số đo)

| Phép đo | TRƯỚC (boot 21:56) | SAU (boot cách ly 22:26 + `--dump-config`) |
|---|---|---|
| log host: dòng `service "shell" has been registered` | **1** | **0** |
| log host: dòng `did not activate` | **1** (`3 entries did not activate`) | **0** (`/tmp/gbh-task15-host.log`) |
| `--dump-config`: `disabled` của `pwsh-sandbox-ours` | **không có** | `disabled: !!js process.platform !== 'win32'` |
| `--dump-config`: `disabled` của row stock | `!!js` nền tảng | **`disabled: true`** |
| mount (`ensureRewriteMounts`) gói này | `ok: false` (row rơi về DSH) | **`ok: true, built: true`** |
| test của gói | 21 ca | **22 ca · 22 pass · 159 expect** (+1 ca canh `renderRewriteBlock`) |
| `check:rows` | — | **125 gói · 0 chặn** |

Tái lập: `bun test tests/host/pwsh-sandbox.test.ts` · `bun run apps/cli/src/main.ts host --dump-config` ·
`bun run check:rows`. App THẬT cần một lượt boot của Lead: log 21:56 vẫn là boot CŨ nên `(5)` còn 1 dòng.
