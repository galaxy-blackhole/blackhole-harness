<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bàn giao row host `bash-sandbox` (T4 · M6): nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-bash-sandbox — row `bash-sandbox` (T4 · M6 · tm-tools)

Trạng thái: **đã viết lại xong + test xanh** · **CHƯA khai `gbh.row`** (chưa mount ⇒ không thể làm hỏng app của ai).

## 0. Năm câu hỏi bắt buộc (recipe §0)

| # | Câu hỏi | Trả lời (đo được) |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **BẬT trên macOS/Linux, TẮT trên Windows.** Dump cây plugin: `- id: bash-sandbox` · `name: '@deepseek-ai/dsh-bash-sandbox'` · `disabled: !!js process.platform === 'win32'` · `config: { timeoutMs: 60000 }` (nhường chỗ cho `pwsh-sandbox`, `disabled: process.platform !== 'win32'`). |
| 2 | Thuần host hay có mount surface client? | **Thuần host.** `package.json` gốc **không có** `dsh.client` (câu 5) ⇒ một mặt ⇒ thay được bằng cặp disable+insert, không cần nửa browser. Export đúng **một lớp service** (`ctx.shell`), không slot, không route. |
| 3 | Cần **seam** nào? | `subprocess` · `sandbox` · `sandboxPolicy` (ba mục `static inject`) + lớp cha `LocalBashExecutor` của `@deepseek-ai/dsh-bash-local`. Chỉ `node:` builtins ngoài các peer ấy. **Lệch bảng §3b** — xem §3 dưới. |
| 4 | Hành vi **đo được** là gì? | `ctx.shell` (một instance/tiến trình). Mỗi lệnh: (a) `danger-full-access` ⇒ spawn thẳng `["bash","-c",command]`; (b) chế độ bị cưỡng chế ⇒ `ctx.sandbox.confine(["bash","-c",command], policy, signal)` rồi spawn **argv của nhà cung cấp**; (c) `result().sandbox = { mode, denied, enforcement }`; (d) runner hỏng ⇒ `result()` ném `SANDBOX_UNAVAILABLE`; (e) tiến trình nền ⇒ `proc.sandbox` (kèm `runnerFailed` khi có). TRƯỚC/SAU ở §4. |
| 5 | Gói gốc có `dsh.client` không? | **KHÔNG** (`python3 -c "…json.load(…).get('dsh')…"` ⇒ `False`; `package.json` gốc không có khoá `dsh`). ⇒ Không mất nửa client khi thay row. |

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Đường dẫn (CHỈ ĐỌC) | Dòng | Mức dẫn xuất |
|---|---|---|---|
| Code thật của row | `apps/host/node_modules/@deepseek-ai/dsh-bash-sandbox/lib/index.js` | **170** | **viết lại theo hành vi** (không chép code): 1 lớp `SandboxBashExecutor` (6 thành viên) |
| Kiểu công khai | `…/dsh-bash-sandbox/lib/types/index.d.ts` + `lib/types/helpers.d.ts` | 74 + 11 | đọc để giữ **đúng bề mặt** (tên lớp, `Config`, chữ ký, `private`/`protected`) |
| Manifest gốc | `…/dsh-bash-sandbox/package.json` | 48 | nguồn của danh sách peer + `exports` (có `./locale/*.json`) |
| Từ điển | `…/dsh-bash-sandbox/locale/{en,zh}.json` | 5 + 6 | **chép byte-for-byte** (LUẬT 000e) — `shasum` khớp: en `1f40971a9503…` · zh `d0bdf1a7cbce…` |
| Seam nền | `dsh-bash-local/lib/index.js` (332) · `dsh-sandbox/lib/index.js` (289) · `dsh-shell/lib/index.js` (95) · `dsh-sandbox-policy/lib/index.js` (159) | — | chỉ đọc để biết hợp đồng `resolve/executeArgv/onProcessDone`, `confine`, `classifyRunnerFailure` |

Gói của ta: `src/index.ts` (247 dòng) · `src/helpers.ts` (26) · `build.ts` (30) · `tests/host/bash-sandbox.test.ts` (373).

## 2. Bản đồ hành vi đã viết lại (đối chiếu từng phần)

| Thành viên của bản gốc | Bản của ta | Ghi chú đối chiếu |
|---|---|---|
| `static inject = ["subprocess","sandbox","sandboxPolicy"]` | y hệt | test khẳng định bằng cả hai artifact |
| `mode = ctx.sandboxPolicy.defaultMode` trong constructor | y hệt | + `get sandboxMode()` trả chính giá trị ấy |
| `resolve()` → `{...super.resolve(request), sandboxPolicy: request.sandboxPolicy ?? ctx.sandboxPolicy.resolve()}` | y hệt | **A/B**: 4 dạng request ⇒ spec **y hệt** bản gốc |
| `execute()`: nhánh `danger-full-access` chạy thẳng | y hệt | đo được: **0 lời gọi `confine`**, argv spawn `["bash","-c",cmd]` |
| `execute()`: nhánh cưỡng chế qua `this.executeArgv(spec, prepare, onStarted)` | y hệt | đo được: argv tới `confine` + argv được spawn + `cwd`/env của lớp cha |
| `processFacts: Map<tiến trình, sự thật>` — xoá khi kết thúc | y hệt | test hai lời gọi **chồng lấn** với hai phương ngữ ⇒ mỗi bên tự phân loại |
| `decorateResult(ex, map, mapError)`: ghi đè `ex.result` TẠI CHỖ, memoize một lần | y hệt | tay nắm giữ nguyên danh tính (Map + `onProcessDone` khoá theo thực thể) |
| `onProcessDone`: đóng dấu `proc.sandbox`, `denied` chỉ khi **không** runner hỏng | y hệt | `runnerFailed` chỉ xuất hiện khi đúng |
| `confine()` = `ctx.sandbox.confine(["bash","-c",command], policy, signal)` | y hệt | argv **shell-shaped** đúng hợp đồng seam |
| `helpers.js`: `classifyDenial` + tái xuất 3 hàm chẩn đoán | `src/helpers.ts` | `classifyDenial(result, sigs) = matchesSignature(exitCode, stderr.text, sigs)` |

`locale/{en,zh}.json` + `exports["./locale/*.json"]` giữ nguyên (LUẬT 000e): runtime dùng `meta.title` làm
tiêu đề hàng ở màn Plugins — thiếu file thì tiêu đề rơi về tên package của ta và **khác oracle**.

## 3. Peer — vì sao, và vì sao LỆCH bảng §3b (cần Lead chốt)

Row này **không thể** trung thành nếu thiếu lớp cha: bản gốc `extends LocalBashExecutor` của
`@deepseek-ai/dsh-bash-local`, và toàn bộ cơ chế tiến trình (deadline, spill, `readOutput`, biên dịch
`onProcessDone`) là của lớp ấy. Viết lại nó là **chép 330 dòng của một seam khác** và tạo ra một
`ctx.shell` thứ hai **không cùng lớp** với thứ kernel cấp.

Bảng §3b (`packages/README.md`) hiện **đóng** ở ba peer (cordis · schemastery · dsh-typert-protocol) và
ghi *"gói nào bắt buộc kéo thêm gói DSH ngoài bảng này thì dừng lại hỏi Lead"*.
**Ma trận parity đã cấp phép cho đúng row này**: `docs/PARITY-MATRIX.md` dòng 42, cột *Phụ thuộc* =
`cordis, dsh-bash-local, dsh-sandbox +2`. Vì vậy gói này khai peer:

    "gbh": { "peers": ["@deepseek-ai/dsh-bash-local", "@deepseek-ai/dsh-sandbox",
                        "@deepseek-ai/dsh-sandbox-policy", "@deepseek-ai/dsh-shell"] }

(cộng `@deepseek-ai/cordis` + `@deepseek-ai/schemastery` do `apps/cli/src/mount.ts` tự thêm cho MỌI gói).
Cả bốn **đều là peer, không phải dependency**, để kernel cấp **đúng một instance**. **ĐỀ NGHỊ LEAD**: mở
bảng §3b một mục cho các row **T4 executor** (`bash-sandbox`, `pwsh-sandbox`, `tool-*`) — nếu không thì
mọi row M6 kiểu này đều phải dừng hỏi, trong khi ma trận đã nói rõ chúng cần những peer ấy.

### Cài peer trên bản sao mới (node_modules bị `.gitignore`)

    cd packages/host/bash-sandbox && mkdir -p node_modules/@deepseek-ai
    for p in cordis dsh-bash-local dsh-sandbox dsh-sandbox-policy dsh-shell; do
      ln -sfn ../../../../../apps/host/node_modules/@deepseek-ai/$p node_modules/@deepseek-ai/$p
    done

Trỏ về **chính bản kernel đang chạy** (không cài bản thứ hai từ registry) ⇒ test A/B của gói so được
`Object.getPrototypeOf(OurClass) === Object.getPrototypeOf(StockClass)`, tức **một** `LocalBashExecutor`.

## 4. Bảng TRƯỚC/SAU (đo bằng chính test, tái lập: `bun test tests/host/bash-sandbox.test.ts`)

| Phép đo | TRƯỚC (bản gốc) | SAU (bản của ta) |
|---|---|---|
| Tập export của artifact | `["SandboxBashExecutor","default"]` | **y hệt** (`Object.keys` của module đã nạp = 2 tên) |
| `static inject` | `["subprocess","sandbox","sandboxPolicy"]` | **y hệt** |
| Prototype + static + **lớp cha** | — | **y hệt** (cùng một `LocalBashExecutor`) |
| `resolve()` trên 4 dạng request | 4 spec | **4 spec y hệt** (kể cả nhánh "policy của bên gọi thắng") |
| `danger-full-access` | 0 lời gọi `confine` · spawn `["bash","-c",cmd]` · `{mode, denied:false}` | **y hệt** |
| Chế độ cưỡng chế | argv tới `confine` = `["bash","-c",cmd]` · spawn argv nhà cung cấp · `{mode, denied:false, enforcement:"full"}` | **y hệt** (kể cả spec spawn: `cwd`, `NO_COLOR=1`, `TERM=dumb`) |
| Bị từ chối (exit≠0 + khớp phương ngữ) | `denied: true` | **y hệt**; exit 0 + cùng stderr ⇒ `denied: false` cả hai bên |
| Runner hỏng (luật stderr) | ném `SandboxUnavailableError` · `code=SANDBOX_UNAVAILABLE` | **y hệt** (cùng mã + cùng thông điệp từng chữ) |
| Nhà cung cấp từ chối | lỗi đi thẳng ra | **y hệt**, và `spawn` = **0** (FAIL-CLOSED: không bao giờ chạy lệnh không bị cưỡng chế) |
| Spawn hỏng vì CHÍNH runner (ENOENT + đúng `argv[0]`) | `SANDBOX_UNAVAILABLE` (không phải lỗi lệnh) | **y hệt** |
| Huỷ trong lúc chờ | ném lại **lý do huỷ** | **y hệt** (không bọc thành lỗi runner) |
| Sổ sự thật theo tiến trình | mỗi tiến trình phân loại bằng sự thật CỦA MÌNH | **y hệt** (2 lời gọi chồng lấn, 2 phương ngữ) |

**11 test / 51 expect · 0 fail.** Test **đo trên ARTIFACT** (`packages/host/bash-sandbox/lib/index.js`,
tự build nếu thiếu) và **đối chứng với chính bundle gốc** — không đọc `src/` để kết luận.

## 5. Artifact & cổng

| Hạng mục | Kết quả |
|---|---|
| `bun run build.ts` | `lib/index.js` **117 dòng** · ESM · `packages: external` |
| `grep -c 'id: "@deepseek-ai' lib/index.js` | **0** (bundle này **không** đăng ký id module nào: đây là gói HOST, không có `__ModuleLoader__` ⇒ luật "một bundle ⇒ một id" áp cho gói có nửa client, gói này không có id nào để lẫn) |
| `build.ts` nhận `process.argv[2]` | ✅ `buildPackage(outDir?)` + `outDir ?? join(import.meta.dir, "lib")` + `if (import.meta.main)` |
| `locale/{en,zh}.json` | ✅ chép **byte-for-byte** khỏi gói gốc + `exports["./locale/*.json"]` |
| `bun test tests/host/bash-sandbox.test.ts` | **11 pass · 0 fail** |
| `bun run check:rows` | gói này **không có dòng nào** (chưa khai `gbh.row`) · **0 chặn** toàn repo |
| `bun run gate --no-tests` | gói này **0 vi phạm** ở cả 5 cổng tĩnh + typecheck (xem báo cáo: các cổng đỏ còn lại thuộc `sandbox-policy`, `credentials-local`, `llm-retry`, `ui-settings-general` — KHÔNG phải gói này) |

## 6. CHƯA làm (đọc trước khi mount)

1. **`gbh.row` CHƯA khai** (đúng luật: chỉ khai khi đã mount xong trong lab). Khi mount cần khai
   `"gbh": { "row": { "id": "bash-sandbox", "config": { "timeoutMs": 60000 }, "tests": ["tests/host/bash-sandbox.test.ts"] } }`
   — `config` **phải** giữ `timeoutMs: 60000` như cây gốc, nếu không sẽ **khác oracle** ở `parity:dump`.
2. **Chưa chạy lab cách ly** (`bun run lab:row` cần `gbh.row`): chưa có phép đo `#root`/`did not activate`
   trên trang thật cho row này. Với row **host-only chạy nền** (không có bundle client), bằng chứng
   activate đúng sẽ là: log host có dòng `[bh] rewrite OK @galaxy-blackhole/gbh-bash-sandbox` + chỉ số (5)
   của `check:app` = 0 dòng `did not activate` + **một lệnh bash thật chạy được qua tool** (đo bằng
   `run_code`/`bash`) với `result.sandbox.mode` khớp `DSH_PERMISSION_MODE`.
3. **Chưa đo trên Windows** (`pwsh-sandbox` giữ row này): bản gốc `disabled` trên win32, nhánh `isRunnerSpawnFailure`
   của runner Windows chưa có ca test ở đây.
4. **Chưa mount ⇒ "đã thay N row" không tăng.** Gói nằm ở trạng thái an toàn (không khai `gbh.row`).

## 7. Nhật ký

| Thời điểm | Việc | Kết quả |
|---|---|---|
| 18/10/2026 | Nhận row `bash-sandbox` (M6 · tm-tools) | gói gốc **170 dòng bundle một file**; matrix dòng 42 = `@galaxy-blackhole/gbh-bash-sandbox` |
| 18/10/2026 | Đọc trọn bản gốc (bundle + 2 `.d.ts` + 4 gói seam) | bản đồ 9 thành viên ở §2; câu 5 = **không** `dsh.client` |
| 18/10/2026 | Viết lại + test A/B trên artifact | **11 test / 51 expect · 0 fail**; `lib/index.js` 117 dòng; `id: "@deepseek-ai"` = **0** |
