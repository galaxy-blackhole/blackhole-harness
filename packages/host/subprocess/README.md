<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README gói @galaxy-blackhole/gbh-subprocess — bản viết lại seam tiến trình con của DSH (row `subprocess`)
-->

# @galaxy-blackhole/gbh-subprocess

Bản viết lại của Galaxy Blackhole cho seam tiến trình con của DSH. Gói phơi **dịch vụ trừu tượng**
`ctx.subprocess` (tra executable, spawn có quản lý dải tiến trình, stdio thô hoặc thu gom có spill, một
primitive terminal) cùng **hàm khử môi trường cha** `scrubbedParentEnv` mà mọi spawner trong repo dùng
chung. Đây là **nền của nhóm executor T4** (M6): `bash-sandbox`, `pwsh-sandbox`, `tool-*` đều spawn qua
seam này.

## 1. Nguồn đối chiếu (G4)

| | |
|---|---|
| Gói upstream | `@deepseek-ai/dsh-subprocess` **0.2.1-alpha.4** |
| Đường dẫn đọc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-subprocess/` |
| Đầu ra so sánh | `lib/index.js` (**103 dòng**) + `lib/control.js` (**27 dòng**) + `lib/types/*.d.ts` |
| Mức dẫn xuất | **viết lại theo hành vi** — không chép code; mọi nhánh đều đối chứng với chính bundle gốc trong test |

### Bảng đối chiếu TỪNG PHẦN

| Phần của bản gốc | Bản của ta | Bằng chứng khớp |
|---|---|---|
| `SENSITIVE_ENV_PATTERN` = mẫu `/KEY\|PASSWORD\|SECRET\|TOKEN/i` | `src/index.ts` | test so `String(regex)`, cờ `global=false` |
| `DSH_ENV_PREFIX = "DSH_"` | `src/types.ts` (re-export ở `src/index.ts`) | test so chuỗi |
| `scrubbedParentEnv()` (khử credential + `DSH_*` không phân biệt hoa thường, rồi phủ lớp proxy) | `src/index.ts` | 5 ca đối chứng từng khoá với bản gốc + 1 ca lớp phủ proxy + 1 ca đối chứng âm |
| `class SubprocessRuntime extends Service` đăng ký `ctx.subprocess`, 4 phương thức trừu tượng | `src/index.ts` | prototype TRÙNG `Object.getOwnPropertyNames` (`constructor`); `Object.getPrototypeOf` = `Service` của kernel; đăng ký trên **Context cordis THẬT**; bản thứ hai ném CÙNG thông điệp |
| `SubprocessExecutableNotFoundError` | `src/index.ts` | `name` · `message` · `cause` · chuỗi prototype |
| `export default SubprocessRuntime` | `src/index.ts` | tập export đo trên artifact |
| `SUBPROCESS_CONTROL_FD = 7` · `SUBPROCESS_CONTROL_ENV = "DSH_SUBPROCESS_CONTROL"` · `openInheritedControlChannel()` | `src/control.ts` → `lib/control.js` (subpath `./control`) | tập export artifact thứ hai; thông điệp ném; **thứ tự TIÊU THỤ dấu trước khi kiểm giá trị** |
| Từ vựng `types.d.ts` (20 khai báo) | `src/types.ts` | port đủ từng khai báo, giữ nguyên chữ ký |

`locale/`: **bản gốc KHÔNG có** (`ls` gói gốc chỉ ra `lib/`, `package.json`, 3 file README/LICENSE) ⇒ luật
000e không áp cho row này.

## 2. Vì sao peer (và vì sao hai tên này)

| Peer | Vì sao | Có phải dependency không |
|---|---|---|
| `@deepseek-ai/cordis` | `Service`/Context của kernel — seam là một dịch vụ cordis | KHÔNG (peer, kernel cấp một thể hiện) |
| `@deepseek-ai/dsh-http-proxy` | `scrubbedParentEnv` **phải** lấy lớp phủ proxy từ ĐÚNG chính sách của tiến trình (`proxyEnvironmentForChild`) | KHÔNG |

⚠️ **`dsh-http-proxy` nằm NGOÀI danh sách ĐÓNG ở `packages/README.md` §3b** — giống tiền lệ
`user-questions` (`dsh-scope` · `dsh-llm`) và `jobs-local`. Lý do đo được: bản gốc import chính hàm đó, và
**tự cài lại chính sách proxy là tạo nguồn sự thật thứ hai** — con sẽ đi tuyến khác cha (đúng lớp lỗi dự án
muốn tránh). Test khẳng định artifact chỉ có **import ngoài** + lời gọi `proxyEnvironmentForChild(`, và
**không** chứa `NODE_USE_ENV_PROXY`. **Cần Lead xác nhận mở rộng §3b** (hoặc chấp nhận ngoại lệ này).

## 3. Trạng thái mount

**CHƯA khai `gbh.row`** — chờ lượt boot của Lead. Gói đã có `gbh.peers` (đúng một tên ngoài bảng luôn-tự-thêm
`cordis`/`schemastery`). Test có ca canh: `manifest.gbh.row` **phải** `undefined`, để ai bật sớm thì test đỏ.

| Phép đo | TRƯỚC (kernel) | SAU (gói của ta) |
|---|---|---|
| Tập export `lib/index.js` (đo trên ARTIFACT) | 6: `DSH_ENV_PREFIX` · `SENSITIVE_ENV_PATTERN` · `SubprocessExecutableNotFoundError` · `SubprocessRuntime` · `default` · `scrubbedParentEnv` | **6 — THIẾU 0 · THỪA 0** |
| Tập export `lib/control.js` | 3: `SUBPROCESS_CONTROL_ENV` · `SUBPROCESS_CONTROL_FD` · `openInheritedControlChannel` | **3 — THIẾU 0 · THỪA 0** |
| `grep -c 'id: @deepseek-ai' lib/index.js` | — | **0** (và 0 ở `lib/control.js`) |
| `gbh.peers` ⊆ `peerDependencies` (so PHẦN TỬ) | — | **⊆: thiếu 0 tên** (kèm đối chứng âm xoá từng tên ⇒ báo đúng tên đó) |
| `bun test tests/host/subprocess.test.ts` | — | **23 pass · 0 fail · 98 expect** |
| `bun run check:rows` | 63 gói · **0 dòng `chan`** | **63 gói · 0 dòng `chan`** (gói chưa khai `gbh.row` nên không vào phép kiểm) |
| `bun run tools/lint/gate.ts --no-tests` | **XANH 7/7** | **XANH 7/7** |
| App 5439 (`check:app`) | — | **chưa đo** (chưa mount — thuộc lượt boot của Lead) |

Lệnh tái lập:

```bash
cd packages/host/subprocess && bun run build.ts          # ⇒ lib/index.js + lib/control.js
grep -c 'id: @deepseek-ai' lib/index.js                  # ⇒ 0
cd <repo> && bun test tests/host/subprocess.test.ts      # ⇒ 0 fail
bun run check:rows | grep -c '| chan |'                  # ⇒ 0
```

## 4. ⚠️ Phát hiện cần Lead quyết: MA TRẬN ghi row `subprocess` → `dsh-subprocess-local`

`docs/PARITY-MATRIX.md` **hàng 39** (`| 39 | subprocess | @deepseek-ai/dsh-subprocess-local | …`): row `subprocess` → plugin `@deepseek-ai/dsh-subprocess-local` (**1.692 dòng**).
Cây thật cũng vậy (`.parity/dumps/*/ours.yml`: `- id: subprocess` + `name: '@deepseek-ai/dsh-subprocess-local'`).
Nghĩa là **seam `@deepseek-ai/dsh-subprocess` KHÔNG phải một row** — nó là **thư viện** mà row
`subprocess-local` (và `dsh-shell`, `dsh-host-open-in-app`, `dsh-mcp-client`, `dsh-plugin-manager`,
`dsh-web-app`, `dsh-sandbox-windows-acl`, `dsh-ptc-runtime-node`) import.

Vì vậy **cơ chế disable+insert theo `gbh.row` không thay được seam này**: nếu khai `gbh.row.id: "subprocess"`,
`check:rows` sẽ đối chiếu export với **`dsh-subprocess-local`** (`LocalSubprocessRuntime` + `default`) ⇒ báo
thiếu export, và patch sẽ tắt **row đang chạy** `subprocess-local`. Cần một trong hai:
(a) một **row id riêng** cho seam (khi ma trận/cơ chế mount có đường thay thư viện), hoặc
(b) gói này là **thư viện của ta** được `gbh-subprocess-local` (row `subprocess`) import thay cho seam gốc.

## 5. Test (23 ca)

| Nhóm | Nội dung |
|---|---|
| ARTIFACT | tập export `index` + `control` **bằng** bản gốc · không id module gốc · không gói bị cấm · peer ở dạng import ngoài · không tự cài chính sách proxy |
| `scrubbedParentEnv` | 3 bảng env (credential · `DSH_*` kể cả viết thường · UTF-8/khoảng trắng/rỗng) đối chứng từng khoá · **đối chứng âm** cho tính không-phân-biệt-hoa-thường · mỗi lượt trả object MỚI |
| Proxy | cài chính sách proxy thật rồi so **cùng khoá** với bản gốc · **đối chứng âm** (khác đường nền) · không proxy ⇒ lớp phủ rỗng |
| Seam | quan hệ kế thừa `Service` (**phép kiểm mục 2b**) · prototype trùng · đăng ký `ctx.subprocess` trên Context cordis THẬT · **bản thứ hai ném CÙNG thông điệp** |
| Lỗi | `SubprocessExecutableNotFoundError`: `name` · `message` · `cause` · prototype |
| `./control` | hằng số · thông điệp ném · **thứ tự tiêu thụ dấu** trước khi kiểm giá trị |
| Peer | `gbh.peers` ⊆ `peerDependencies` (so phần tử) · peer có thật trong kernel + đúng phiên bản · **2 đối chứng âm** (xoá tên / thừa tên) · peer không nằm trong `dependencies` · peer gốc ⊆ peer ta · **chưa khai `gbh.row`** |

## 6. CHƯA làm (điều kiện chặn mount)

1. **Khai `gbh.row`** — chờ Lead quyết mục 4 (row id nào cho seam).
2. **`lab:row`** + boot home cách ly: chưa chạy (không có `gbh.row` nên `lab:row` không nhận gói).
3. **TRƯỚC/SAU trên app 5439** (`check:app` 11 chỉ số): chưa đo — chưa mount.
4. **`dsh-subprocess-local` chưa được viết lại**: seam mới là nửa *hợp đồng*; phần cài đặt thật (spawn,
   PTY, dải tiến trình) vẫn là gói gốc. Row `subprocess` vì thế **chưa được thay**.
